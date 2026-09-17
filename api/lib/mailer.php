<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

/**
 * Dependency-free mailer (no Composer/PHPMailer): speaks raw SMTP with
 * STARTTLS/implicit-TLS and AUTH LOGIN over a plain socket. That's enough
 * for "send a verification/reset link through Gmail or any normal SMTP
 * provider" without installing anything on the server.
 *
 * When api/config/secrets.local.php has no smtp.host configured, this falls
 * back to DEV MODE: the message is appended to api/logs/mail.log instead of
 * being sent, so the register -> verify -> login flow can still be tested
 * end-to-end before real SMTP credentials exist.
 */
function tl_send_mail(string $toEmail, string $toName, string $subject, string $body): bool {
    $smtp = tl_app_config()['smtp'] ?? [];
    if (($smtp['host'] ?? '') === '') {
        return tl_send_mail_devmode($toEmail, $subject, $body);
    }
    return tl_send_mail_smtp($smtp, $toEmail, $toName, $subject, $body);
}

function tl_send_mail_devmode(string $toEmail, string $subject, string $body): bool {
    $logDir = __DIR__ . '/../logs';
    if (!is_dir($logDir)) {
        mkdir($logDir, 0770, true);
    }
    $entry = sprintf("\n----- %s -----\nTo: %s\nSubject: %s\n\n%s\n", date('Y-m-d H:i:s'), $toEmail, $subject, $body);
    file_put_contents($logDir . '/mail.log', $entry, FILE_APPEND | LOCK_EX);
    return true;
}

function tl_send_mail_smtp(array $config, string $toEmail, string $toName, string $subject, string $body): bool {
    $host = (string) $config['host'];
    $port = (int) ($config['port'] ?? 587);
    $encryption = $config['encryption'] ?? 'tls'; // 'tls' = STARTTLS, 'ssl' = implicit TLS, '' = none
    $username = (string) ($config['username'] ?? '');
    $password = (string) ($config['password'] ?? '');
    $fromEmail = (string) ($config['from_email'] ?? 'no-reply@localhost');
    $fromName = (string) ($config['from_name'] ?? 'TradeLite');

    $transport = ($encryption === 'ssl') ? ('ssl://' . $host) : $host;
    $fp = @stream_socket_client($transport . ':' . $port, $errno, $errstr, 10);
    if (!$fp) {
        error_log("tl_send_mail_smtp: connect to {$host}:{$port} failed: {$errstr} ({$errno})");
        return false;
    }
    stream_set_timeout($fp, 10);

    $readReply = function () use ($fp): string {
        $line = '';
        do {
            $chunk = fgets($fp, 515);
            if ($chunk === false) {
                break;
            }
            $line = $chunk;
        } while (isset($chunk[3]) && $chunk[3] === '-'); // multi-line replies use "250-" until the final "250 "
        return $line;
    };
    $sendLine = function (string $cmd) use ($fp): void {
        fwrite($fp, $cmd . "\r\n");
    };
    $expectCode = function (string $expectedPrefix, string $reply, string $step) use ($fp): bool {
        if (strpos($reply, $expectedPrefix) !== 0) {
            error_log("tl_send_mail_smtp: unexpected reply at {$step}: {$reply}");
            fclose($fp);
            return false;
        }
        return true;
    };

    $readReply(); // greeting
    $localHost = $_SERVER['SERVER_NAME'] ?? 'localhost';
    $sendLine('EHLO ' . $localHost);
    $readReply();

    if ($encryption === 'tls') {
        $sendLine('STARTTLS');
        if (!$expectCode('220', $readReply(), 'STARTTLS')) {
            return false;
        }
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            error_log('tl_send_mail_smtp: TLS negotiation failed');
            fclose($fp);
            return false;
        }
        $sendLine('EHLO ' . $localHost);
        $readReply();
    }

    if ($username !== '') {
        $sendLine('AUTH LOGIN');
        $readReply();
        $sendLine(base64_encode($username));
        $readReply();
        $sendLine(base64_encode($password));
        if (!$expectCode('235', $readReply(), 'AUTH LOGIN')) {
            return false;
        }
    }

    $sendLine('MAIL FROM:<' . $fromEmail . '>');
    if (!$expectCode('250', $readReply(), 'MAIL FROM')) {
        return false;
    }
    $sendLine('RCPT TO:<' . $toEmail . '>');
    if (!$expectCode('250', $readReply(), 'RCPT TO')) {
        return false;
    }
    $sendLine('DATA');
    if (!$expectCode('354', $readReply(), 'DATA')) {
        return false;
    }

    $headers = [
        'From: ' . tl_mime_encode_word($fromName) . ' <' . $fromEmail . '>',
        'To: ' . ($toName !== '' ? tl_mime_encode_word($toName) . ' <' . $toEmail . '>' : $toEmail),
        'Subject: ' . tl_mime_encode_word($subject),
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Date: ' . date('r'),
    ];
    // Dot-stuff any body line starting with '.' per RFC 5321, so the SMTP
    // server doesn't mistake it for the end-of-DATA marker.
    $escapedBody = preg_replace('/^\./m', '..', $body);
    $sendLine(implode("\r\n", $headers) . "\r\n\r\n" . $escapedBody . "\r\n.");
    $finalReply = $readReply();
    $sendLine('QUIT');
    fclose($fp);

    return strpos($finalReply, '250') === 0;
}

function tl_mime_encode_word(string $text): string {
    if (preg_match('/^[\x20-\x7E]*$/', $text) === 1) {
        return $text;
    }
    return '=?UTF-8?B?' . base64_encode($text) . '?=';
}
