<?php

declare(strict_types=1);

namespace App\Core;

use App\Config\Config;
use App\Config\Database;
use PDO;

/**
 * Authentication & Session Management Service (SRS Section 3.1 & 3.3)
 */
class Auth
{
    private const SESSION_USER_KEY = 'caravan_auth_user';
    private const SESSION_LAST_ACTIVITY = 'caravan_last_activity';
    private const SESSION_CSRF_KEY = 'caravan_csrf_token';

    public static function initSession(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        Config::load();
        $isSecure = filter_var(Config::get('COOKIE_SECURE', false), FILTER_VALIDATE_BOOLEAN);
        $sameSite = Config::get('COOKIE_SAMESITE', 'Lax');

        // Set secure cookie params (FR-AUTH-3)
        session_set_cookie_params([
            'lifetime' => 0, // Until browser closes
            'path'     => '/',
            'domain'   => '',
            'secure'   => $isSecure,
            'httponly' => true,
            'samesite' => $sameSite,
        ]);

        session_name('caravan_session');
        session_start();

        // Enforce 30-minute inactivity expiration (FR-AUTH-7)
        if (self::check()) {
            $lifetimeSeconds = (int)Config::get('SESSION_LIFETIME_MINUTES', 30) * 60;
            $lastActivity = $_SESSION[self::SESSION_LAST_ACTIVITY] ?? 0;

            if ($lastActivity > 0 && (time() - $lastActivity) > $lifetimeSeconds) {
                self::logout();
                Response::unauthorized('Session expired due to inactivity. Please log in again.');
            }

            $_SESSION[self::SESSION_LAST_ACTIVITY] = time();
        }
    }

    public static function check(): bool
    {
        return !empty($_SESSION[self::SESSION_USER_KEY]['id']);
    }

    public static function user(): ?array
    {
        return $_SESSION[self::SESSION_USER_KEY] ?? null;
    }

    public static function id(): ?int
    {
        return isset($_SESSION[self::SESSION_USER_KEY]['id']) ? (int)$_SESSION[self::SESSION_USER_KEY]['id'] : null;
    }

    public static function role(): ?string
    {
        return $_SESSION[self::SESSION_USER_KEY]['role'] ?? null;
    }

    public static function isAdmin(): bool
    {
        return self::role() === 'admin';
    }

    public static function isViewer(): bool
    {
        return self::role() === 'viewer';
    }

    /**
     * Authenticates user against database with lockout checks (FR-AUTH-1, FR-AUTH-5)
     */
    public static function attempt(string $email, string $password, string $ip): array
    {
        self::initSession();
        $pdo = Database::getConnection();

        // Check rate limiting / lockout (FR-AUTH-5: 5 attempts within 15 minutes)
        if (self::isLockedOut($email, $ip)) {
            Audit::log(null, 'LOGIN_BLOCKED', 'AUTH', null, [
                'email' => $email,
                'reason' => 'Rate limit exceeded (lockout)',
            ], $ip);

            Response::error(
                'Too many failed login attempts. Account is locked for 15 minutes. Please try again later.',
                'ACCOUNT_LOCKED',
                [],
                429
            );
        }

        $stmt = $pdo->prepare('SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = :email LIMIT 1');
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            self::recordFailedAttempt($email, $ip);

            Audit::log(null, 'LOGIN_FAILED', 'AUTH', null, [
                'email' => $email,
            ], $ip);

            Response::error('Invalid email or password.', 'INVALID_CREDENTIALS', [], 401);
        }

        if ((int)$user['is_active'] !== 1) {
            Audit::log($user['id'], 'LOGIN_DEACTIVATED', 'AUTH', (string)$user['id'], [
                'email' => $email,
            ], $ip);

            Response::forbidden('Your account is deactivated. Please contact an administrator.');
        }

        // Authentication successful: clear failed attempts
        self::clearFailedAttempts($email, $ip);

        // Regenerate session ID on login to prevent session fixation (FR-AUTH-3)
        session_regenerate_id(true);

        // Store user in session
        $userData = [
            'id'    => (int)$user['id'],
            'name'  => $user['name'],
            'email' => $user['email'],
            'role'  => $user['role'],
        ];
        $_SESSION[self::SESSION_USER_KEY] = $userData;
        $_SESSION[self::SESSION_LAST_ACTIVITY] = time();

        // Update last_login_at in database
        $updateStmt = $pdo->prepare('UPDATE users SET last_login_at = NOW() WHERE id = :id');
        $updateStmt->execute([':id' => $user['id']]);

        // Audit log success
        Audit::log((int)$user['id'], 'LOGIN_SUCCESS', 'AUTH', (string)$user['id'], [
            'email' => $email,
        ], $ip);

        // Generate and return CSRF token
        $csrfToken = self::getOrCreateCsrfToken();

        return [
            'user'       => $userData,
            'csrf_token' => $csrfToken,
        ];
    }

    public static function logout(): void
    {
        self::initSession();

        if (self::check()) {
            Audit::log(self::id(), 'LOGOUT', 'AUTH', (string)self::id(), []);
        }

        $_SESSION = [];

        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params['path'],
                $params['domain'],
                $params['secure'],
                $params['httponly']
            );
        }

        session_destroy();
    }

    public static function getOrCreateCsrfToken(): string
    {
        self::initSession();
        if (empty($_SESSION[self::SESSION_CSRF_KEY])) {
            $_SESSION[self::SESSION_CSRF_KEY] = bin2hex(random_bytes(32));
        }
        return $_SESSION[self::SESSION_CSRF_KEY];
    }

    public static function validateCsrfToken(?string $token): bool
    {
        self::initSession();
        if (empty($token) || empty($_SESSION[self::SESSION_CSRF_KEY])) {
            return false;
        }
        return hash_equals($_SESSION[self::SESSION_CSRF_KEY], $token);
    }

    public static function hashPassword(string $password): string
    {
        // Use Argon2id if available, otherwise bcrypt (FR-AUTH-2)
        if (defined('PASSWORD_ARGON2ID')) {
            return password_hash($password, PASSWORD_ARGON2ID);
        }
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    private static function isLockedOut(string $email, string $ip): bool
    {
        $pdo = Database::getConnection();
        $lockoutMinutes = (int)Config::get('LOCKOUT_MINUTES', 15);
        $maxAttempts = (int)Config::get('MAX_LOGIN_ATTEMPTS', 5);

        $stmt = $pdo->prepare('
            SELECT COUNT(*) FROM login_attempts 
            WHERE (email = :email OR ip_address = :ip)
              AND attempted_at >= (NOW() - INTERVAL :minutes MINUTE)
        ');
        $stmt->execute([
            ':email'   => $email,
            ':ip'      => $ip,
            ':minutes' => $lockoutMinutes,
        ]);

        return (int)$stmt->fetchColumn() >= $maxAttempts;
    }

    private static function recordFailedAttempt(string $email, string $ip): void
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('INSERT INTO login_attempts (email, ip_address, attempted_at) VALUES (:email, :ip, NOW())');
        $stmt->execute([
            ':email' => $email,
            ':ip'    => $ip,
        ]);
    }

    private static function clearFailedAttempts(string $email, string $ip): void
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('DELETE FROM login_attempts WHERE email = :email OR ip_address = :ip');
        $stmt->execute([
            ':email' => $email,
            ':ip'    => $ip,
        ]);
    }
}
