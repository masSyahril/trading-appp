<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

tl_require_method('POST');
tl_check_same_origin();

$ip = tl_client_ip();
tl_check_rate_limit($ip, 'register', 10, 60);

$body = tl_read_json_body();
$email = tl_normalize_email((string) ($body['email'] ?? ''));
$password = (string) ($body['password'] ?? '');
$displayName = trim((string) ($body['display_name'] ?? ''));

if (!tl_validate_email($email)) {
    tl_error('Please enter a valid email address.');
}
if ($displayName === '' || mb_strlen($displayName) > 100) {
    tl_error('Please enter a name (up to 100 characters).');
}
if (($err = tl_validate_password($password)) !== null) {
    tl_error($err);
}

$pdo = tl_db();

$existing = $pdo->prepare('SELECT id FROM users WHERE email_normalized = :email');
$existing->execute([':email' => $email]);
if ($existing->fetch() !== false) {
    tl_record_attempt($ip, 'register', false);
    // Unlike login/forgot-password, we do reveal "already registered" here -
    // it's the expected UX for a signup form and the enumeration risk is
    // much lower than on login or password reset.
    tl_error('An account with this email already exists.', 409);
}

$hash = password_hash($password, PASSWORD_DEFAULT);

$insert = $pdo->prepare(
    'INSERT INTO users (email, email_normalized, password_hash, display_name)
     VALUES (:email_raw, :email_norm, :hash, :name)'
);
$insert->execute([
    ':email_raw' => (string) ($body['email'] ?? ''),
    ':email_norm' => $email,
    ':hash' => $hash,
    ':name' => $displayName,
]);
$userId = (int) $pdo->lastInsertId();

[$rawToken, $tokenHash] = tl_generate_token();
$tokenStmt = $pdo->prepare(
    'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
     VALUES (:user_id, :hash, DATE_ADD(NOW(), INTERVAL 24 HOUR))'
);
$tokenStmt->execute([':user_id' => $userId, ':hash' => $tokenHash]);

$baseUrl = rtrim((string) (tl_app_config()['app']['base_url'] ?? ''), '/');
$verifyLink = $baseUrl . '/pages/auth/verify-email.html?token=' . urlencode($rawToken);
tl_send_mail(
    (string) ($body['email'] ?? ''),
    $displayName,
    'Verify your TradeLite account',
    "Hi {$displayName},\n\nWelcome to TradeLite! Please verify your email address by opening this link:\n\n{$verifyLink}\n\nThis link expires in 24 hours. If you didn't create this account, you can ignore this email.\n"
);

tl_record_attempt($ip, 'register', true);
tl_create_session($userId);

tl_json([
    'message' => 'Account created. Please check your email to verify your address.',
    'user' => [
        'id' => $userId,
        'email' => (string) ($body['email'] ?? ''),
        'display_name' => $displayName,
        'email_verified' => false,
    ],
], 201);
