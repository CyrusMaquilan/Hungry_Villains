<?php
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$username = trim($argv[1] ?? '');
$password = getenv('HV_ADMIN_PASSWORD');
if (!preg_match('/^[a-zA-Z0-9_.-]{1,50}$/D', $username) || $password === false || strlen($password) < 12
    || strlen($password) > 72) {
    fwrite(STDERR, "Pass a username and set HV_ADMIN_PASSWORD to a password of 12 to 72 bytes.\n");
    exit(1);
}

require __DIR__ . '/../api/db.php';
try {
    $stmt = $pdo->prepare('INSERT INTO users (username, password, is_admin, is_cashier) VALUES (?, ?, 1, 1)');
    $stmt->execute([$username, password_hash($password, PASSWORD_DEFAULT)]);
    fwrite(STDOUT, "Administrator created.\n");
} catch (PDOException $error) {
    fwrite(STDERR, "Unable to create the account. Check database access and choose an unused username.\n");
    exit(1);
}
