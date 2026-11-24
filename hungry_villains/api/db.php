<?php
$host = getenv('HV_DB_HOST') ?: 'localhost';
$db = getenv('HV_DB_NAME') ?: 'hungry_villains_db';
$port = (int)(getenv('HV_DB_PORT') ?: 3306);
$user = getenv('HV_DB_USER') ?: 'root';
$pass = getenv('HV_DB_PASS') ?: '';

try {
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
    $pdo->exec("SET time_zone = '+08:00'");
} catch (PDOException $e) {
    error_log('Database connection failed: ' . $e->getMessage());
    http_response_code(503);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode(['success' => false, 'message' => 'Database connection unavailable.']);
    if (PHP_SAPI === 'cli') exit(1);
    exit;
}
?>
