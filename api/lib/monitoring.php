<?php
declare(strict_types=1);

/**
 * Minimal, dependency-free error reporting hook. Every uncaught
 * exception/fatal error in the app (wired up in bootstrap.php) comes
 * through here, structured and appended to api/logs/error.log - same
 * append-only pattern as lib/mailer.php's DEV MODE mail.log, so there's
 * always a local record even before any external monitoring is set up.
 *
 * Once you have a Sentry account and DSN (see the roadmap doc for the
 * signup steps), install the SDK with `composer require sentry/sentry` and
 * call \Sentry\captureException($e) right after the file_put_contents
 * below - that's the one line this function is designed to grow into.
 */
function tl_report_error(Throwable $e, array $context = []): void {
    $logDir = __DIR__ . '/../logs';
    if (!is_dir($logDir)) {
        mkdir($logDir, 0770, true);
    }

    $entry = sprintf(
        "\n----- %s -----\n%s: %s\nFile: %s:%d\nContext: %s\nTrace:\n%s\n",
        gmdate('Y-m-d H:i:s') . ' UTC',
        get_class($e),
        $e->getMessage(),
        $e->getFile(),
        $e->getLine(),
        $context === [] ? '(none)' : json_encode($context),
        $e->getTraceAsString()
    );
    file_put_contents($logDir . '/error.log', $entry, FILE_APPEND | LOCK_EX);

    // TODO once the Sentry SDK is installed (composer require sentry/sentry):
    // if (class_exists(\Sentry\State\Hub::class)) { \Sentry\captureException($e); }
}

/**
 * Registers tl_report_error() as the app-wide catch-all for anything an
 * endpoint didn't already handle itself. Call once, early in bootstrap.php.
 * Endpoints that already catch their own exceptions (e.g. tl_db()'s
 * PDOException handling) are unaffected - this only fires for what would
 * otherwise reach PHP's default (blank-page) error behavior.
 */
function tl_register_error_reporting(): void {
    set_exception_handler(function (Throwable $e): void {
        tl_report_error($e);
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode(['error' => 'Something went wrong. Please try again.']);
    });

    set_error_handler(function (int $severity, string $message, string $file, int $line): bool {
        if (!(error_reporting() & $severity)) {
            return false; // respect @-suppressed / excluded error levels
        }
        tl_report_error(new ErrorException($message, 0, $severity, $file, $line));
        return true;
    });
}
