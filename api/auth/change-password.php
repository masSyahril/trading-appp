<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

tl_require_method('POST');
tl_check_same_origin();

$user = tl_require_auth();
$ip = tl_client_ip();
tl_check_rate_limit($ip, 'change_password', 8, 15);

$body = tl_read_json_body();
$currentPassword = (string) ($body['current_password'] ?? '');
$newPassword = (string) ($body['new_password'] ?? '');

if ($currentPassword === '' || $newPassword === '') {
    tl_error('Please fill in both password fields.');
}
if (($err = tl_validate_password($newPassword)) !== null) {
    tl_error($err);
}

$pdo = tl_db();
$stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = :id');
$stmt->execute([':id' => $user['id']]);
$row = $stmt->fetch();

if ($row === false || !password_verify($currentPassword, $row['password_hash'])) {
    tl_record_attempt($ip, 'change_password', false);
    tl_error('Current password is incorrect.', 401);
}

tl_record_attempt($ip, 'change_password', true);

$newHash = password_hash($newPassword, PASSWORD_DEFAULT);
$update = $pdo->prepare('UPDATE users SET password_hash = :hash WHERE id = :id');
$update->execute([':hash' => $newHash, ':id' => $user['id']]);

// Sign out every other device - same reasoning as a token-based reset: if
// this change was you, one re-login elsewhere is a small price; if it
// wasn't, this is what actually locks the other party out. The caller's
// own current session is left alone so this page doesn't kick itself out.
$revoked = tl_revoke_other_sessions((int) $user['id']);

tl_json([
    'message' => 'Password updated.',
    'other_sessions_revoked' => $revoked,
]);
