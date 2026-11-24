<?php
require_once __DIR__ . '/session_guard.php';
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/admin_auth.php';
require_once __DIR__ . '/pos_support.php';
require_cashier($pdo);
$stmt = $pdo->prepare('SELECT id, username, is_admin, is_cashier FROM users WHERE id = ?');
$stmt->execute([$_SESSION['user_id']]);
pos_json(['success' => true, 'user' => $stmt->fetch(PDO::FETCH_ASSOC)]);
