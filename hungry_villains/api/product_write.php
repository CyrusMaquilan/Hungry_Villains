<?php
require_once __DIR__ . '/session_guard.php';
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__ . '/pos_support.php';

function write_product(string $action): void {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        pos_json(['success' => false, 'message' => 'POST required.'], 405);
        return;
    }
    require __DIR__ . '/db.php';
    require_once __DIR__ . '/admin_auth.php';
    require_once __DIR__ . '/product_image.php';
    require_admin($pdo);
    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) {
        pos_json(['success' => false, 'message' => 'Invalid product data.'], 422);
        return;
    }
    $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
    if ($action !== 'create' && (!$id || $id < 1)) {
        pos_json(['success' => false, 'message' => 'Product ID is required.'], 422);
        return;
    }

    try {
        $pdo->beginTransaction();
        $existing = null;
        if ($action !== 'create') {
            $stmt = $pdo->prepare('SELECT quantity, status, price FROM products WHERE product_id = ? FOR UPDATE');
            $stmt->execute([$id]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$existing) throw new DomainException('Product not found.');
        }

        if ($action === 'deactivate') {
            $pdo->prepare("UPDATE products SET status = 'Inactive' WHERE product_id = ?")->execute([$id]);
            pos_audit($pdo, 'product_deactivated', $id);
        } else {
            $name = is_string($data['name'] ?? null) ? trim($data['name']) : '';
            $category = is_string($data['category'] ?? null) ? trim($data['category']) : '';
            $price = $data['price'] ?? null;
            $description = $data['description'] ?? '';
            $icon = $data['icon'] ?? '';
            $stock = filter_var($data['stock_quantity'] ?? null, FILTER_VALIDATE_INT,
                ['options' => ['min_range' => 0, 'max_range' => 2147483647]]);
            $expected = filter_var($data['expected_stock'] ?? null, FILTER_VALIDATE_INT);
            $status = !empty($data['is_available']) ? 'Active' : 'Inactive';

            if ($name === '' || mb_strlen($name) > 100 || mb_strlen($category) > 50
                || !is_numeric($price) || !preg_match('/^\d{1,8}(?:\.\d{1,2})?$/D', (string)$price)
                || !is_string($description) || strlen($description) > 4000
                || !is_string($icon) || mb_strlen($icon) > 512 || $stock === false) {
                throw new InvalidArgumentException('Check the product name, category, price and stock.');
            }
            if ($existing && $expected !== (int)$existing['quantity']) {
                throw new DomainException('Stock changed while this product was open. Reopen it and check the latest count.');
            }

            $image = save_product_image($data['image_data'] ?? null);
            if ($existing) {
                $stmt = $pdo->prepare(
                    'UPDATE products SET product_name = ?, category = ?, price = ?, quantity = ?,
                      status = ?, description = ?, icon = ?, image_path = COALESCE(?, image_path)
                      WHERE product_id = ?'
                );
                $stmt->execute([$name, $category, $price, $stock, $status, $description, $icon, $image, $id]);
            } else {
                $stmt = $pdo->prepare(
                    'INSERT INTO products (product_code, product_name, category, price, quantity,
                     status, description, icon, image_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
                );
                $stmt->execute(['HV' . strtoupper(bin2hex(random_bytes(6))), $name, $category, $price,
                    $stock, $status, $description, $icon, $image]);
                $id = (int)$pdo->lastInsertId();
            }
            $previous = (int)($existing['quantity'] ?? 0);
            pos_stock($pdo, $id, null, $stock - $previous, $stock, $existing ? 'stock_adjustment' : 'opening_stock');
            pos_audit($pdo, $existing ? 'product_updated' : 'product_created', $id,
                ['previous_stock' => $previous, 'stock' => $stock, 'price' => $price, 'status' => $status]);
        }

        $pdo->commit();
        pos_json(['success' => true, 'id' => $id, 'message' => 'Product saved.']);
    } catch (PDOException $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log($error->getMessage());
        pos_json(['success' => false, 'message' => 'Unable to save the product.'], 500);
    } catch (RuntimeException | LogicException $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        pos_json(['success' => false, 'message' => $error->getMessage()], $error instanceof DomainException ? 409 : 422);
    }
}
