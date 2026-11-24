<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

function require_admin(PDO $pdo) {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(["success" => false, "message" => "Please log in."]);
        exit;
    }

    try {
        $stmt = $pdo->prepare("SELECT is_admin FROM users WHERE id = :id");
        $stmt->execute(['id' => $_SESSION['user_id']]);
        if ((int)$stmt->fetchColumn() !== 1) {
            $_SESSION['is_admin'] = 0;
            http_response_code(403);
            echo json_encode(["success" => false, "message" => "Admin access required."]);
            exit;
        }
        $_SESSION['is_admin'] = 1;
    } catch (PDOException $error) {
        error_log("Admin authorization check failed: " . $error->getMessage());
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Unable to verify admin access."]);
        exit;
    }
}

function require_cashier(PDO $pdo) {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(["success" => false, "message" => "Please log in."]);
        exit;
    }

    try {
        $stmt = $pdo->prepare("SELECT is_admin, is_cashier FROM users WHERE id = :id");
        $stmt->execute(['id' => $_SESSION['user_id']]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$user || ((int)$user['is_admin'] !== 1 && (int)$user['is_cashier'] !== 1)) {
            http_response_code(403);
            echo json_encode(["success" => false, "message" => "Cashier access required."]);
            exit;
        }
    } catch (PDOException $error) {
        error_log("Cashier authorization check failed: " . $error->getMessage());
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Unable to verify cashier access."]);
        exit;
    }
}
?>
