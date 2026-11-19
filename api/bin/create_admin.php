<?php

declare(strict_types=1);

/**
 * CLI Tool: Create Admin Account
 * Usage: php bin/create_admin.php "Admin Name" "admin@example.com" "password123"
 */

// Simple autoloader
spl_autoload_register(function (string $class) {
    if (str_starts_with($class, 'App\\Config\\')) {
        $sub = substr($class, strlen('App\\Config\\'));
        $file = dirname(__DIR__) . '/config/' . $sub . '.php';
        if (!file_exists($file)) {
            $file = dirname(__DIR__) . '/config/' . strtolower($sub) . '.php';
        }
        if (file_exists($file)) {
            require_once $file;
        }
    } elseif (str_starts_with($class, 'App\\Core\\')) {
        $file = dirname(__DIR__) . '/app/Core/' . substr($class, strlen('App\\Core\\')) . '.php';
        if (file_exists($file)) {
            require_once $file;
        }
    }
});

use App\Config\Config;
use App\Config\Database;
use App\Core\Auth;

Config::load();

if (php_sapi_name() !== 'cli') {
    echo "This script can only be run from the command line.\n";
    exit(1);
}

$name = $argv[1] ?? null;
$email = $argv[2] ?? null;
$password = $argv[3] ?? null;

if (!$name || !$email || !$password) {
    echo "Usage: php create_admin.php \"<Name>\" \"<Email>\" \"<Password>\"\n";
    exit(1);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo "Error: Invalid email format.\n";
    exit(1);
}

if (strlen($password) < 8) {
    echo "Error: Password must be at least 8 characters long.\n";
    exit(1);
}

try {
    $pdo = Database::getConnection();
    $hash = Auth::hashPassword($password);

    $stmt = $pdo->prepare('
        INSERT INTO users (name, email, password_hash, role, is_active, created_at)
        VALUES (:name, :email, :hash, "admin", 1, NOW())
        ON DUPLICATE KEY UPDATE 
            name = VALUES(name),
            password_hash = VALUES(password_hash),
            role = "admin",
            is_active = 1,
            updated_at = NOW()
    ');

    $stmt->execute([
        ':name'  => $name,
        ':email' => $email,
        ':hash'  => $hash,
    ]);

    echo "✅ Admin user '{$email}' created or updated successfully.\n";
} catch (\Throwable $e) {
    echo "❌ Error creating admin user: " . $e->getMessage() . "\n";
    exit(1);
}
