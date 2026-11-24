<?php
require_once __DIR__ . "/session_guard.php";
header("Content-Type: application/json; charset=UTF-8");
include_once 'db.php';
include_once 'admin_auth.php';
require_admin($pdo);

try {
    $stmt = $pdo->query(
        "SELECT product_id, product_code, product_name, category, price, quantity, status,
                description, icon, image_path, created_at
         FROM products
         ORDER BY product_name ASC, product_id ASC"
    );
    $products = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["success" => true, "products" => $products]);
} catch (PDOException $error) {
    error_log("Inventory query failed: " . $error->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Unable to load inventory."]);
}
?>
