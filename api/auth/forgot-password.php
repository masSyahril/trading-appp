<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

tl_require_method('POST');
tl_check_same_origin();

$ip = tl_client_ip();
tl_check_rate_limit($ip, 'forgot_password', 5, 60);

$body = tl_read_json_body();
$email = tl_normalize_email((string) ($body['email'] ?? ''));

if (!tl_validate_email($email)) {
    tl_error('Please enter a valid email address.');
}

$pdo = tl_db();
$stmt = $pdo->prepare('SELECT id, email, display_name FROM users WHERE email_normalized = :email');
$stmt->execute([':email' => $email]);
$user = $stmt->fetch();

// Always the same response whether or not the email is registered - this is
// the one endpoint where revealing "not found" would let anyone harvest a
// list of valid accounts by trying addresses one at a time.
$genericResponse = ['message' => 'If that email is registered, a password reset link has been sent.'];

tl_record_attempt($ip, 'forgot_password', $user !== false);

if ($user === false) {
    tl_json($genericResponse);
}

[$rawToken, $tokenHash] = tl_generate_token();
$tokenStmt = $pdo->prepare(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES (:user_id, :hash, DATE_ADD(NOW(), INTERVAL 1 HOUR))'
);
$tokenStmt->execute([':user_id' => $user['id'], ':hash' => $tokenHash]);

$baseUrl = rtrim((string) (tl_app_config()['app']['base_url'] ?? ''), '/');
$resetLink = $baseUrl . '/pages/auth/reset-password.html?token=' . urlencode($rawToken);
tl_send_mail(
    $user['email'],
    $user['display_name'],
    'Reset your TradeLite password',
    "Hi {$user['display_name']},\n\nSomeone (hopefully you) asked to reset your TradeLite password. Open this link to choose a new one:\n\n{$resetLink}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email - your password won't change.\n"
);

tl_json($genericResponse);
