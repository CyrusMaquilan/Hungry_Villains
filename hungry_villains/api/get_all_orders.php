<?php
require_once __DIR__ . "/session_guard.php";
header("Content-Type: application/json; charset=UTF-8");
include_once 'db.php';
session_start();
include_once 'admin_auth.php';

require_cashier($pdo);

try {
    $sql = "SELECT o.*, u.username FROM orders o 
            JOIN users u ON o.user_id = u.id 
            WHERE COALESCE(o.status, 'Pending') != 'Completed'
            ORDER BY o.created_at DESC";
    $stmt = $pdo->query($sql);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["success" => true, "orders" => $orders]);
} catch (PDOException $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>
