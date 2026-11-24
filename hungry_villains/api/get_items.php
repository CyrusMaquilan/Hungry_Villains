<?php
require_once __DIR__ . '/session_guard.php';
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/admin_auth.php';
require_once __DIR__ . '/pos_support.php';
require_cashier($pdo);

try {
    $issued = time();
    $uid = (int)$_SESSION['user_id'];
    $key = pos_quote_key($pdo);
    $items = $pdo->query(
        "SELECT product_id AS id, product_name AS name, product_code AS sku, category,
                price, icon, description, image_path, quantity AS stock_quantity,
                CASE WHEN status = 'Active' THEN 1 ELSE 0 END AS is_available
         FROM products ORDER BY product_id"
    )->fetchAll(PDO::FETCH_ASSOC);

    foreach ($items as &$item) {
        $item['quote'] = pos_quote($key, $uid, (int)$item['id'], (int)round($item['price'] * 100), $issued);
    }
    unset($item);

    pos_json(['success' => true, 'user_id' => $uid, 'issued_at' => $issued,
        'expires_at' => $issued + POS_OFFLINE_SECONDS, 'items' => $items]);
} catch (Throwable $error) {
    error_log($error->getMessage());
    pos_json(['success' => false, 'message' => 'Catalog unavailable. Check the database setup.'], 503);
}
