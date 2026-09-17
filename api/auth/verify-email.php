<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

tl_require_method('GET');

$token = (string) ($_GET['token'] ?? '');
if ($token === '') {
    tl_error('Missing verification token.');
}

$hash = hash('sha256', $token);
$pdo = tl_db();

$stmt = $pdo->prepare(
    'SELECT id, user_id FROM email_verification_tokens
     WHERE token_hash = :hash AND used_at IS NULL AND expires_at > NOW()'
);
$stmt->execute([':hash' => $hash]);
$row = $stmt->fetch();

if ($row === false) {
    tl_error('This verification link is invalid or has expired. Request a new one from your account menu.', 400);
}

$pdo->beginTransaction();
try {
    $markUsed = $pdo->prepare('UPDATE email_verification_tokens SET used_at = NOW() WHERE id = :id');
    $markUsed->execute([':id' => $row['id']]);

    $markVerified = $pdo->prepare(
        'UPDATE users SET email_verified_at = NOW() WHERE id = :id AND email_verified_at IS NULL'
    );
    $markVerified->execute([':id' => $row['user_id']]);

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('verify-email failed: ' . $e->getMessage());
    tl_error('Something went wrong verifying your email. Please try again.', 500);
}

tl_json(['message' => 'Email verified. You can now use your account.']);
