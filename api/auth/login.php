<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

tl_require_method('POST');
tl_check_same_origin();

$ip = tl_client_ip();
tl_check_rate_limit($ip, 'login', 8, 15);

$body = tl_read_json_body();
$email = tl_normalize_email((string) ($body['email'] ?? ''));
$password = (string) ($body['password'] ?? '');

if ($email === '' || $password === '') {
    tl_error('Please enter your email and password.');
}

$pdo = tl_db();
$stmt = $pdo->prepare('SELECT id, password_hash, display_name, email, status FROM users WHERE email_normalized = :email');
$stmt->execute([':email' => $email]);
$user = $stmt->fetch();

// Same generic message whether the email doesn't exist or the password is
// wrong - telling them apart lets an attacker enumerate registered emails.
$genericError = 'Invalid email or password.';

if ($user === false || !password_verify($password, $user['password_hash'])) {
    tl_record_attempt($ip, 'login', false);
    tl_error($genericError, 401);
}

if ($user['status'] !== 'active') {
    tl_record_attempt($ip, 'login', false);
    tl_error('This account has been disabled. Contact support if you think this is a mistake.', 403);
}

tl_record_attempt($ip, 'login', true);
tl_create_session((int) $user['id']);

$verified = $pdo->prepare('SELECT email_verified_at FROM users WHERE id = :id');
$verified->execute([':id' => $user['id']]);
$verifiedAt = $verified->fetchColumn();

tl_json([
    'user' => [
        'id' => (int) $user['id'],
        'email' => $user['email'],
        'display_name' => $user['display_name'],
        'email_verified' => $verifiedAt !== null,
    ],
]);
