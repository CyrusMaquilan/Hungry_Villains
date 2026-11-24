<?php
require_once __DIR__ . '/session_guard.php';
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__ . '/pos_support.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    pos_json(['success' => false, 'message' => 'POST required.'], 405);
    exit;
}
require_once __DIR__ . '/db.php';

$data = json_decode(file_get_contents('php://input', false, null, 0, 4096), true);
$username = is_string($data['username'] ?? null) ? trim($data['username']) : '';
$password = $data['password'] ?? null;
if ($username === '' || strlen($username) > 200 || !is_string($password) || strlen($password) > 256) {
    pos_json(['success' => false, 'message' => 'Enter a valid username and password.'], 422);
    exit;
}

try {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $now = time();
    $keys = [hash('sha256', 'ip:' . $ip) => 60, hash('sha256', 'account:' . $ip . ':' . strtolower($username)) => 12];
    $limit = $pdo->prepare(
        'INSERT INTO pos_login_limits (attempt_key, attempts, window_end) VALUES (?, 1, ?)
         ON DUPLICATE KEY UPDATE attempts = IF(window_end <= ?, 1, LEAST(attempts + 1, 100000)),
         window_end = IF(window_end <= ?, VALUES(window_end), window_end)'
    );
    $read = $pdo->prepare('SELECT attempts FROM pos_login_limits WHERE attempt_key = ?');
    $pdo->beginTransaction();
    $blocked = false;
    foreach ($keys as $key => $max) {
        $limit->execute([$key, $now + 600, $now, $now]);
        $read->execute([$key]);
        $blocked = (int)$read->fetchColumn() > $max;
        if ($blocked) break;
    }
    $pdo->commit();
    if ($blocked) {
        pos_json(['success' => false, 'message' => 'Too many sign-in attempts. Try again in 10 minutes.'], 429);
        exit;
    }
    if (random_int(1, 50) === 1) {
        $pdo->prepare('DELETE FROM pos_login_limits WHERE window_end < ?')->execute([$now]);
    }

    $stmt = $pdo->prepare('SELECT id, username, password, is_admin, is_cashier FROM users WHERE username = ?');
    $stmt->execute([$username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    $valid = password_verify($password, $user['password'] ?? '$2y$10$u3DR7xVmDmHz1GFlIZmOk.dDDZ/avtAFme4x5/tGJAG.D7YgKcKWG');
    if (!$user || !$valid || (!(int)$user['is_admin'] && !(int)$user['is_cashier'])) {
        pos_json(['success' => false, 'message' => 'Invalid credentials or account access.'], 401);
        exit;
    }

    unset($user['password']);
    session_start();
    session_regenerate_id(true);
    $_SESSION = ['user_id' => $user['id'], 'username' => $user['username'],
        'is_admin' => $user['is_admin'], 'is_cashier' => $user['is_cashier']];
    pos_json(['success' => true] + $user);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log($error->getMessage());
    pos_json(['success' => false, 'message' => 'Sign-in unavailable. Check the database setup.'], 503);
}
