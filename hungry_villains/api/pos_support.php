<?php

const POS_OFFLINE_SECONDS = 12 * 60 * 60;
const POS_MAX_CENTS = 9999999999;

function pos_json(array $body, int $status = 200): void {
    http_response_code($status);
    echo json_encode($body, JSON_INVALID_UTF8_SUBSTITUTE);
}

function pos_audit(PDO $pdo, string $event, int $entity, array $details = []): void {
    $stmt = $pdo->prepare(
        "INSERT INTO pos_audit_log (actor_id, event_type, entity_id, details) VALUES (?, ?, ?, ?)"
    );
    $stmt->execute([$_SESSION['user_id'], $event, $entity, json_encode($details, JSON_THROW_ON_ERROR)]);
}

function pos_stock(PDO $pdo, int $product, ?int $order, int $delta, int $balance, string $reason): void {
    if ($delta === 0) return;
    $stmt = $pdo->prepare(
        "INSERT INTO pos_stock_movements (product_id, order_id, actor_id, quantity_delta, balance_after, reason)
         VALUES (?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([$product, $order, $_SESSION['user_id'], $delta, $balance, $reason]);
}

function pos_quote_key(PDO $pdo): string {
    $key = $pdo->query("SELECT setting_value FROM pos_settings WHERE setting_key = 'quote_key'")->fetchColumn();
    if ($key !== false) return $key;

    $stmt = $pdo->prepare("INSERT IGNORE INTO pos_settings (setting_key, setting_value) VALUES ('quote_key', ?)");
    $stmt->execute([bin2hex(random_bytes(32))]);
    return pos_quote_key($pdo);
}

function pos_quote(string $key, int $user, int $product, int $price, int $issued): string {
    return hash_hmac('sha256', "$user:$product:$price:$issued", $key);
}

function pos_money(int $cents): string {
    return intdiv($cents, 100) . '.' . str_pad((string)($cents % 100), 2, '0', STR_PAD_LEFT);
}

function pos_datetime(int $timestamp): string {
    return gmdate('Y-m-d\TH:i:s\Z', $timestamp);
}
