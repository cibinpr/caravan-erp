<?php

declare(strict_types=1);

namespace App\Config;

/**
 * Global Configuration Loader for Caravan Accounting API
 */
class Config
{
    private static array $settings = [];
    private static bool $loaded = false;

    public static function load(): void
    {
        if (self::$loaded) {
            return;
        }

        // Search for .env in potential locations (current folder, parent, or /var/www/caravan/shared/.env)
        $envPaths = [
            dirname(__DIR__, 2) . '/.env',
            dirname(__DIR__, 3) . '/shared/.env',
            dirname(__DIR__) . '/.env',
        ];

        foreach ($envPaths as $path) {
            if (file_exists($path)) {
                self::parseEnvFile($path);
                break;
            }
        }

        // Apply defaults
        self::$settings = array_merge([
            'APP_NAME' => 'Caravan Accounting',
            'APP_ENV' => 'production',
            'APP_DEBUG' => 'false',
            'APP_URL' => 'http://localhost:5173',
            'APP_TIMEZONE' => 'Asia/Kolkata',

            'DB_HOST' => '127.0.0.1',
            'DB_PORT' => '3306',
            'DB_DATABASE' => 'caravan_accounting',
            'DB_USERNAME' => 'root',
            'DB_PASSWORD' => '',

            'SESSION_LIFETIME_MINUTES' => '30',
            'COOKIE_SECURE' => 'false',
            'COOKIE_SAMESITE' => 'Lax',
            'MAX_LOGIN_ATTEMPTS' => '5',
            'LOCKOUT_MINUTES' => '15',

            'STORAGE_PATH' => dirname(__DIR__, 2) . '/storage',
            'MAX_BILL_FILE_SIZE_MB' => '5',
            'ALLOWED_BILL_MIMES' => 'image/jpeg,image/png,application/pdf',

            'COMPANY_NAME' => 'Caravan Accounting',
            'COMPANY_CURRENCY' => 'INR',
            'COMPANY_CURRENCY_SYMBOL' => '₹',
        ], self::$settings);

        self::$loaded = true;

        // Timezone setup
        date_default_timezone_set((string)self::get('APP_TIMEZONE', 'Asia/Kolkata'));

        // PHP Security & Error Logging configuration (NFR-SEC-7)
        $isDebug = filter_var(self::get('APP_DEBUG', 'false'), FILTER_VALIDATE_BOOLEAN);
        ini_set('display_errors', $isDebug ? '1' : '0');
        ini_set('display_startup_errors', $isDebug ? '1' : '0');
        ini_set('log_errors', '1');

        $logDir = self::get('STORAGE_PATH') . '/logs';
        if (!is_dir($logDir)) {
            @mkdir($logDir, 0755, true);
        }
        ini_set('error_log', $logDir . '/php_error.log');
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        if (!self::$loaded) {
            self::load();
        }
        return self::$settings[$key] ?? getenv($key) ?: $default;
    }

    private static function parseEnvFile(string $filePath): void
    {
        $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            return;
        }

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            if (str_contains($line, '=')) {
                [$key, $val] = explode('=', $line, 2);
                $key = trim($key);
                $val = trim($val);
                // Strip enclosing quotes if present
                if (preg_match('/^"(.+)"$/', $val, $matches) || preg_match("/^'(.+)'$/", $val, $matches)) {
                    $val = $matches[1];
                }
                self::$settings[$key] = $val;
                putenv("{$key}={$val}");
            }
        }
    }
}
