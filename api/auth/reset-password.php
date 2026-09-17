<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

tl_require_method('POST');
tl_check_same_origin();

$body = tl_read_json_body();
$token = (string) ($body['token'] ?? '');
$password = (string) ($body['password'] ?? '');

if ($token === '') {
    tl_error('Missing reset token.');
}
if (($err = tl_validate_password($password)) !== null) {
    tl_error($err);
}

$hash = hash('sha256', $token);
$pdo = tl_db();

$stmt = $pdo->prepare(
    'SELECT id, user_id FROM password_reset_tokens
     WHERE token_hash = :hash AND used_at IS NULL AND expires_at > NOW()'
);
$stmt->execute([':hash' => $hash]);
$row = $stmt->fetch();

if ($row === false) {
    tl_error('This reset link is invalid or has expired. Request a new one.', 400);
}

$newHash = password_hash($password, PASSWORD_DEFAULT);

$pdo->beginTransaction();
try {
    $updatePw = $pdo->prepare('UPDATE users SET password_hash = :hash WHERE id = :id');
    $updatePw->execute([':hash' => $newHash, ':id' => $row['user_id']]);

    $markUsed = $pdo->prepare('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = :id');
    $markUsed->execute([':id' => $row['id']]);

    // Invalidate every other outstanding reset token for this user, so an
    // old, still-unused email link can't be used later on top of this reset.
    $invalidateOthers = $pdo->prepare(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = :user_id AND used_at IS NULL'
    );
    $invalidateOthers->execute([':user_id' => $row['user_id']]);

    // Sign the account out everywhere. If someone else triggered this reset
    // maliciously, this is what actually kicks them out; if it was really
    // you, logging back in on one device is a small price for that.
    $killSessions = $pdo->prepare('DELETE FROM sessions WHERE user_id = :user_id');
    $killSessions->execute([':user_id' => $row['user_id']]);

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('reset-password failed: ' . $e->getMessage());
    tl_error('Something went wrong resetting your password. Please try again.', 500);
}

tl_json(['message' => 'Password updated. Please log in with your new password.']);
