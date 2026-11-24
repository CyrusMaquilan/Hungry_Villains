<?php
require_once __DIR__ . "/session_guard.php";
if (($_SERVER["REQUEST_METHOD"] ?? "") !== "POST") { http_response_code(405); header("Content-Type: application/json"); echo json_encode(["success"=>false,"message"=>"POST required."]); exit; }
header("Content-Type: application/json; charset=UTF-8");
include_once 'db.php';
include_once 'admin_auth.php';
require_once __DIR__ . '/pos_support.php';
require_cashier($pdo);

$data = json_decode(file_get_contents("php://input"));

if(isset($data->order_id)) {
    try {
        $pdo->beginTransaction();
        $sql = "UPDATE orders SET status = 'Completed' WHERE id = :oid AND COALESCE(status, '') <> 'Completed'";
        $stmt = $pdo->prepare($sql);
        $stmt->execute(['oid' => $data->order_id]);

        if ($stmt->rowCount() === 0) {
            $check = $pdo->prepare("SELECT status FROM orders WHERE id = :oid");
            $check->execute(['oid' => $data->order_id]);
            if ($check->fetchColumn() === false) {
                $pdo->rollBack();
                http_response_code(404);
                echo json_encode(["success" => false, "message" => "Sale not found."]);
                exit;
            }
        } else {
            pos_audit($pdo, 'sale_fulfilled', (int)$data->order_id);
        }
        $pdo->commit();

        echo json_encode(["success" => true, "message" => "Sale marked as completed."]);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log("Sale status update failed: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Unable to update sale status."]);
    }
} else {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Sale ID is required."]);
}
?>
