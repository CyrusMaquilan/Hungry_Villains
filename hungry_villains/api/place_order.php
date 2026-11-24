<?php
require_once __DIR__ . '/session_guard.php';
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__ . '/pos_support.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    pos_json(['success' => false, 'message' => 'POST required.'], 405);
    exit;
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/admin_auth.php';
require_cashier($pdo);
$uid = (int)$_SESSION['user_id'];
$username = $_SESSION['username'];
session_write_close();

function read_sale(): array {
    $data = json_decode(file_get_contents('php://input', false, null, 0, 65536), true);
    if (!is_array($data)) throw new InvalidArgumentException('Invalid sale request.');
    if (($data['user_id'] ?? null) !== (int)$_SESSION['user_id']) {
        pos_json(['success' => false, 'message' => 'Sign in as the cashier who recorded this sale.'], 401);
        exit;
    }
    $key = $data['sale_key'] ?? null;
    $sold = $data['sold_at'] ?? null;
    $issued = $data['issued_at'] ?? null;
    $items = $data['items'] ?? null;
    $amount = $data['amount_cents'] ?? null;
    $discount = $data['discount_cents'] ?? null;
    $reason = is_string($data['discount_reason'] ?? null) ? trim($data['discount_reason']) : '';
    $method = $data['method'] ?? null;
    $reference = is_string($data['reference'] ?? null) ? trim($data['reference']) : '';
    $offline = $data['offline'] ?? null;

    if (!is_string($key) || !preg_match('/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/D', $key)
        || !is_int($sold) || !is_int($issued) || !is_bool($offline)
        || !is_array($items) || count($items) < 1 || count($items) > 100
        || !is_int($amount) || $amount < 0 || $amount > POS_MAX_CENTS
        || !is_int($discount) || $discount < 0 || $discount > POS_MAX_CENTS
        || strlen($reason) > 120 || ($discount > 0 && $reason === '')
        || !in_array($method, ['cash', 'ewallet', 'card'], true)
        || strlen($reference) > 80 || ($method !== 'cash' && ($reference === '' || $offline))) {
        throw new InvalidArgumentException('Check the sale, discount and payment details.');
    }

    $lines = [];
    foreach ($items as $line) {
        $id = $line['id'] ?? null;
        $qty = $line['quantity'] ?? null;
        $price = $line['price_cents'] ?? null;
        $quote = $line['quote'] ?? null;
        if (!is_int($id) || $id < 1 || $id > 2147483647 || isset($lines[$id])
            || !is_int($qty) || $qty < 1 || $qty > 999
            || !is_int($price) || $price < 0 || $price > POS_MAX_CENTS
            || !is_string($quote) || strlen($quote) !== 64) {
            throw new InvalidArgumentException('Invalid sale line.');
        }
        $lines[$id] = ['id' => $id, 'quantity' => $qty, 'price_cents' => $price, 'quote' => $quote];
    }
    ksort($lines, SORT_NUMERIC);
    return [$key, $sold, $issued, $lines, $amount, $discount, $reason, $method, $reference, $offline];
}

try {
    $sale = read_sale();
    [$key, $sold, $issued, $lines, $amount, $discount, $reason, $method, $reference, $offline] = $sale;
    $hash = hash('sha256', json_encode([$uid, $sale], JSON_THROW_ON_ERROR));
    $quoteKey = pos_quote_key($pdo);
    $subtotal = array_sum(array_map(fn($item) => $item['price_cents'] * $item['quantity'], $lines));
    $total = $subtotal - $discount;
    if ($subtotal > POS_MAX_CENTS || $total < 0 || $amount < $total || ($method !== 'cash' && $amount !== $total)) {
        throw new InvalidArgumentException('Payment or discount does not match the sale total.');
    }
    $change = $amount - $total;

    $pdo->beginTransaction();
    $claim = $pdo->prepare(
        "INSERT INTO pos_sales (sale_key, request_hash, cashier_name, subtotal_cents, discount_cents,
            discount_reason, captured_offline) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE sale_key = sale_key"
    );
    $claim->execute([$key, $hash, $username, $subtotal, $discount, $reason, (int)$offline]);
    $claim = $pdo->prepare("SELECT request_hash, order_id FROM pos_sales WHERE sale_key = ? FOR UPDATE");
    $claim->execute([$key]);
    $saved = $claim->fetch(PDO::FETCH_ASSOC);
    if (!hash_equals($saved['request_hash'], $hash)) {
        throw new DomainException('This receipt number already belongs to another sale.');
    }
    if ($saved['order_id'] !== null) {
        $pdo->commit();
        pos_json(['success' => true, 'order_id' => (int)$saved['order_id'], 'receipt_id' => $key]);
        exit;
    }

    if ($sold < $issued - 120 || $sold > $issued + POS_OFFLINE_SECONDS || $sold > time() + 120) {
        throw new DomainException('Sale time is outside the authorized catalog window. Check the register clock.');
    }

    $product = $pdo->prepare(
        "SELECT product_name, price, quantity, status FROM products WHERE product_id = ? FOR UPDATE"
    );
    $receipt = [];
    $balances = [];
    foreach ($lines as $line) {
        $id = $line['id'];
        if (!hash_equals(pos_quote($quoteKey, $uid, $id, $line['price_cents'], $issued), $line['quote'])) {
            throw new DomainException('The catalog price for this sale could not be verified.');
        }

        $product->execute([$id]);
        $row = $product->fetch(PDO::FETCH_ASSOC);
        if (!$row || $row['status'] !== 'Active' || (int)$row['quantity'] < $line['quantity']) {
            $name = $row['product_name'] ?? "Product #$id";
            throw new DomainException("$name is inactive or has insufficient stock. Ask a manager to review stock before retrying.");
        }
        $balances[$id] = (int)$row['quantity'] - $line['quantity'];
        $receipt[] = ['id' => $id, 'name' => $row['product_name'], 'quantity' => $line['quantity'],
            'price' => pos_money($line['price_cents'])];
    }

    $order = $pdo->prepare(
        "INSERT INTO orders (user_id, total_price, address, items, status, created_at)
         VALUES (?, ?, 'Over the counter', ?, 'Preparing', FROM_UNIXTIME(?))"
    );
    $order->execute([$uid, pos_money($total), json_encode($receipt, JSON_THROW_ON_ERROR), $sold]);
    $id = (int)$pdo->lastInsertId();

    $lineInsert = $pdo->prepare(
        "INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_order) VALUES (?, ?, ?, ?)"
    );
    $stock = $pdo->prepare("UPDATE products SET quantity = ? WHERE product_id = ?");
    foreach ($receipt as $line) {
        $lineInsert->execute([$id, $line['id'], $line['quantity'], $line['price']]);
        $stock->execute([$balances[$line['id']], $line['id']]);
        pos_stock($pdo, $line['id'], $id, -$line['quantity'], $balances[$line['id']], 'sale');
    }

    $pdo->prepare(
        "INSERT INTO pos_payments (order_id, method, tendered_cents, change_cents, payment_reference)
         VALUES (?, ?, ?, ?, ?)"
    )->execute([$id, $method, $amount, $change, $reference]);
    $pdo->prepare("UPDATE pos_sales SET order_id = ? WHERE sale_key = ?")->execute([$id, $key]);
    pos_audit($pdo, 'sale_recorded', $id, ['receipt' => $key, 'payment' => $method, 'offline' => $offline]);
    $pdo->commit();
    pos_json(['success' => true, 'order_id' => $id, 'receipt_id' => $key]);
} catch (InvalidArgumentException | DomainException $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    pos_json(['success' => false, 'message' => $error->getMessage()], $error instanceof DomainException ? 409 : 422);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log($error->getMessage());
    pos_json(['success' => false, 'message' => 'Sale sync unavailable. The register will retry.'], 503);
}
