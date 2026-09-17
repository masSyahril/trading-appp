<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

tl_require_method('POST');
tl_check_same_origin();

$user = tl_require_auth();

if ($user['email_verified']) {
    tl_error('Your email is already verified.', 409);
}

tl_check_rate_limit('user:' . $user['id'], 'resend_verification', 3, 15);

$pdo = tl_db();
[$rawToken, $tokenHash] = tl_generate_token();
$tokenStmt = $pdo->prepare(
    'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
     VALUES (:user_id, :hash, DATE_ADD(NOW(), INTERVAL 24 HOUR))'
);
$tokenStmt->execute([':user_id' => $user['id'], ':hash' => $tokenHash]);

$baseUrl = rtrim((string) (tl_app_config()['app']['base_url'] ?? ''), '/');
$verifyLink = $baseUrl . '/pages/auth/verify-email.html?token=' . urlencode($rawToken);
tl_send_mail(
    $user['email'],
    $user['display_name'],
    'Verify your TradeLite account',
    "Hi {$user['display_name']},\n\nHere's your new verification link:\n\n{$verifyLink}\n\nThis link expires in 24 hours.\n"
);

tl_record_attempt('user:' . $user['id'], 'resend_verification', true);
tl_json(['message' => 'Verification email sent.']);
