<?php
require_once __DIR__ . "/session_guard.php";
header("Content-Type: application/json; charset=UTF-8");
include_once 'db.php';
include_once 'admin_auth.php';
require_cashier($pdo);

try {
    $stmt = $pdo->query(
        "SELECT o.id, o.created_at, o.total_price, o.status, o.items,
                COALESCE(s.cashier_name, u.username) AS username, s.sale_key AS receipt_id,
                p.method AS payment_method, p.tendered_cents, s.subtotal_cents, s.discount_cents,
                UNIX_TIMESTAMP(o.created_at) AS sale_timestamp
         FROM orders o
         LEFT JOIN users u ON o.user_id = u.id
         LEFT JOIN pos_sales s ON s.order_id = o.id
         LEFT JOIN pos_payments p ON p.order_id = o.id
         ORDER BY o.created_at DESC, o.id DESC
         LIMIT 500"
    );
    $transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($transactions as &$transaction) {
        $items = json_decode($transaction['items'], true);
        if (!is_array($items)) {
            throw new UnexpectedValueException("Invalid item data for transaction #" . $transaction['id']);
        }
        $transaction['items'] = $items;
    }
    unset($transaction);

    echo json_encode(["success" => true, "transactions" => $transactions]);
} catch (PDOException $error) {
    error_log("Transaction history query failed: " . $error->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Unable to load transaction history."]);
} catch (UnexpectedValueException $error) {
    error_log("Transaction history data error: " . $error->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Transaction history contains invalid item data."]);
}
?>
