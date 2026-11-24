<?php
require_once __DIR__ . "/session_guard.php";
header("Content-Type: application/json; charset=UTF-8");
include_once 'db.php';
include_once 'admin_auth.php';
require_admin($pdo);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "POST requests only."]);
    exit;
}
if (stripos(isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '', 'application/json') !== 0) {
    http_response_code(415);
    echo json_encode(["success" => false, "message" => "Content-Type must be application/json."]);
    exit;
}

$data = json_decode(file_get_contents("php://input"));
if (!is_object($data) || !isset($data->username) || !is_string($data->username) || trim($data->username) === '') {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "A username is required."]);
    exit;
}

try {
    $username = trim($data->username);
    $stmt = $pdo->prepare("UPDATE users SET is_admin = 1 WHERE username = :username");
    $stmt->execute(['username' => $username]);
    if ($stmt->rowCount() > 0) {
        echo json_encode(["success" => true, "message" => "Administrator role granted."]);
    } else {
        $check = $pdo->prepare("SELECT is_admin FROM users WHERE username = :username");
        $check->execute(['username' => $username]);
        $isAdmin = $check->fetchColumn();
        echo json_encode([
            "success" => $isAdmin !== false && (int)$isAdmin === 1,
            "message" => $isAdmin === false ? "User not found." : "User already has admin access."
        ]);
    }
} catch (PDOException $error) {
    error_log("Admin promotion failed: " . $error->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Unable to update user role."]);
}
?>
