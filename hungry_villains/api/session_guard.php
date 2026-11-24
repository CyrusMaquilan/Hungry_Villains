<?php
// Same-origin API only; reject cross-site browser mutations.
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site' && !in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET','HEAD'], true)) {
    http_response_code(403); echo json_encode(['success'=>false,'message'=>'Cross-site request denied.']); exit;
}
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_samesite', 'Strict');
ini_set('session.use_strict_mode', '1');
if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ini_set('session.cookie_secure', '1');
