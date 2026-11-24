<?php
require_once __DIR__ . "/session_guard.php";
session_start();
header("Content-Type: application/json; charset=UTF-8");
include_once 'db.php';
include_once 'admin_auth.php';

function respond($status, $payload) {
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function parse_role($value, &$parsed) {
    if ($value === true || $value === 1 || $value === '1') {
        $parsed = 1;
        return true;
    }
    if ($value === false || $value === 0 || $value === '0') {
        $parsed = 0;
        return true;
    }
    return false;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ["success" => false, "message" => "POST requests only."]);
}
if (stripos(isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '', 'application/json') !== 0) {
    respond(415, ["success" => false, "message" => "Content-Type must be application/json."]);
}

require_admin($pdo);

$data = json_decode(file_get_contents("php://input"));
if (!is_object($data) || !isset($data->action)) {
    respond(400, ["success" => false, "message" => "Invalid request."]);
}

try {
    if ($data->action === 'list') {
        $stmt = $pdo->query(
            "SELECT u.id, u.username, u.created_at, u.is_admin, u.is_cashier,
                    EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id) AS has_orders
             FROM users u ORDER BY u.id"
        );
        respond(200, ["success" => true, "users" => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }

    if ($data->action === 'create' || $data->action === 'update') {
        $isCreate = $data->action === 'create';
        if (!isset($data->username) || !is_string($data->username) ||
            (isset($data->password) && !is_string($data->password))) {
            respond(400, ["success" => false, "message" => "Invalid username or password."]);
        }
        $username = trim($data->username);
        $password = isset($data->password) ? $data->password : '';
        $isAdmin = 0;
        $isCashier = 0;

        if ($username === '' || strlen($username) > 50) {
            respond(400, ["success" => false, "message" => "Username must be between 1 and 50 characters."]);
        }
        if ($isCreate && strlen($password) < 8) {
            respond(400, ["success" => false, "message" => "Password must be at least 8 characters."]);
        }
        if (!$isCreate && $password !== '' && strlen($password) < 8) {
            respond(400, ["success" => false, "message" => "New password must be at least 8 characters."]);
        }
        if (!parse_role(isset($data->is_admin) ? $data->is_admin : false, $isAdmin) ||
            !parse_role(isset($data->is_cashier) ? $data->is_cashier : false, $isCashier)) {
            respond(400, ["success" => false, "message" => "Invalid user role values."]);
        }

        if ($isCreate) {
            if ($isAdmin !== 1 && $isCashier !== 1) {
                respond(400, ["success" => false, "message" => "Assign at least one role to the account."]);
            }
            $stmt = $pdo->prepare(
                "INSERT INTO users (username, password, is_admin, is_cashier)
                 VALUES (:username, :password, :is_admin, :is_cashier)"
            );
            $stmt->execute([
                'username' => $username,
                'password' => password_hash($password, PASSWORD_DEFAULT),
                'is_admin' => $isAdmin,
                'is_cashier' => $isCashier
            ]);
            respond(201, ["success" => true, "message" => "User created."]);
        }

        $id = filter_var(isset($data->id) ? $data->id : null, FILTER_VALIDATE_INT);
        if (!$id || $id < 1) {
            respond(400, ["success" => false, "message" => "Invalid user ID."]);
        }
        if ((int)$id === (int)$_SESSION['user_id'] && $isAdmin !== 1) {
            respond(400, ["success" => false, "message" => "You cannot remove your own admin access."]);
        }

        $pdo->beginTransaction();
        $lockedAdmins = $pdo->query("SELECT id FROM users WHERE is_admin = 1 FOR UPDATE")->fetchAll(PDO::FETCH_COLUMN);
        $targetStmt = $pdo->prepare("SELECT is_admin FROM users WHERE id = :id FOR UPDATE");
        $targetStmt->execute(['id' => $id]);
        $target = $targetStmt->fetch(PDO::FETCH_ASSOC);
        if (!$target) {
            $pdo->rollBack();
            respond(404, ["success" => false, "message" => "User not found."]);
        }
        $targetIsAdmin = (int)$target['is_admin'] === 1;
        if ($targetIsAdmin && $isAdmin !== 1 && count($lockedAdmins) <= 1) {
            $pdo->rollBack();
            respond(400, ["success" => false, "message" => "Cannot remove the last administrator."]);
        }

        if ($password === '') {
            $stmt = $pdo->prepare(
                "UPDATE users SET username = :username, is_admin = :is_admin, is_cashier = :is_cashier WHERE id = :id"
            );
            $stmt->execute([
                'username' => $username,
                'is_admin' => $isAdmin,
                'is_cashier' => $isCashier,
                'id' => $id
            ]);
        } else {
            $stmt = $pdo->prepare(
                "UPDATE users SET username = :username, password = :password, is_admin = :is_admin, is_cashier = :is_cashier WHERE id = :id"
            );
            $stmt->execute([
                'username' => $username,
                'password' => password_hash($password, PASSWORD_DEFAULT),
                'is_admin' => $isAdmin,
                'is_cashier' => $isCashier,
                'id' => $id
            ]);
        }

        $pdo->commit();
        respond(200, ["success" => true, "message" => "User updated."]);
    }

    if ($data->action === 'delete') {
        $id = filter_var(isset($data->id) ? $data->id : null, FILTER_VALIDATE_INT);
        if (!$id || $id < 1) {
            respond(400, ["success" => false, "message" => "Invalid user ID."]);
        }
        if ((int)$id === (int)$_SESSION['user_id']) {
            respond(400, ["success" => false, "message" => "You cannot delete your own account."]);
        }

        $pdo->beginTransaction();
        $lockedAdmins = $pdo->query("SELECT id FROM users WHERE is_admin = 1 FOR UPDATE")->fetchAll(PDO::FETCH_COLUMN);
        $targetStmt = $pdo->prepare("SELECT id FROM users WHERE id = :id FOR UPDATE");
        $targetStmt->execute(['id' => $id]);
        if (!$targetStmt->fetchColumn()) {
            $pdo->rollBack();
            respond(404, ["success" => false, "message" => "User not found."]);
        }
        $ordersStmt = $pdo->prepare("SELECT COUNT(*) FROM orders WHERE user_id = :id");
        $ordersStmt->execute(['id' => $id]);
        if ((int)$ordersStmt->fetchColumn() > 0) {
            $pdo->rollBack();
            respond(409, ["success" => false, "message" => "Users with order history cannot be deleted."]);
        }
        if (in_array((string)$id, array_map('strval', $lockedAdmins), true) && count($lockedAdmins) <= 1) {
            $pdo->rollBack();
            respond(400, ["success" => false, "message" => "Cannot delete the last administrator."]);
        }

        $stmt = $pdo->prepare("DELETE FROM users WHERE id = :id");
        $stmt->execute(['id' => $id]);
        if ($stmt->rowCount() === 0) {
            $pdo->rollBack();
            respond(404, ["success" => false, "message" => "User not found."]);
        }
        $pdo->commit();
        respond(200, ["success" => true, "message" => "User deleted."]);
    }

    respond(400, ["success" => false, "message" => "Unknown action."]);
} catch (PDOException $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("Admin user management failed: " . $error->getMessage());
    if ($error->getCode() === '23000') {
        respond(409, ["success" => false, "message" => "That username is already in use."]);
    }
    respond(500, ["success" => false, "message" => "Unable to complete user management request."]);
}
?>
