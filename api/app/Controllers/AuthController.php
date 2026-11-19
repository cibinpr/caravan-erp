<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Config\Database;
use App\Core\Audit;
use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;

/**
 * Authentication Endpoints Controller (SRS Section 3.1)
 */
class AuthController
{
    /**
     * POST /api/v1/auth/login
     */
    public function login(Request $request): void
    {
        $email = trim((string)$request->input('email', ''));
        $password = (string)$request->input('password', '');

        $errors = [];
        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'A valid email address is required.';
        }
        if (empty($password)) {
            $errors['password'] = 'Password is required.';
        }

        if (!empty($errors)) {
            Response::error('Validation failed.', 'VALIDATION_FAILED', $errors, 422);
        }

        $result = Auth::attempt($email, $password, $request->getIp());

        Response::json([
            'user'       => $result['user'],
            'csrf_token' => $result['csrf_token'],
        ], ['message' => 'Login successful']);
    }

    /**
     * POST /api/v1/auth/logout
     */
    public function logout(Request $request): void
    {
        Auth::logout();
        Response::json(['message' => 'Logged out successfully.']);
    }

    /**
     * GET /api/v1/auth/me
     */
    public function me(Request $request): void
    {
        Auth::initSession();

        if (!Auth::check()) {
            Response::unauthorized('Not authenticated.');
        }

        Response::json([
            'user'       => Auth::user(),
            'csrf_token' => Auth::getOrCreateCsrfToken(),
        ]);
    }

    /**
     * POST /api/v1/auth/change-password (FR-AUTH-8)
     */
    public function changePassword(Request $request): void
    {
        Auth::initSession();
        if (!Auth::check()) {
            Response::unauthorized();
        }

        $userId = Auth::id();
        $currentPassword = (string)$request->input('current_password', '');
        $newPassword = (string)$request->input('new_password', '');
        $confirmPassword = (string)$request->input('confirm_password', '');

        $errors = [];
        if (empty($currentPassword)) {
            $errors['current_password'] = 'Current password is required.';
        }
        if (strlen($newPassword) < 8) {
            $errors['new_password'] = 'New password must be at least 8 characters long.';
        }
        if ($newPassword !== $confirmPassword) {
            $errors['confirm_password'] = 'Password confirmation does not match.';
        }

        if (!empty($errors)) {
            Response::error('Validation failed.', 'VALIDATION_FAILED', $errors, 422);
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $userId]);
        $row = $stmt->fetch();

        if (!$row || !password_verify($currentPassword, $row['password_hash'])) {
            Response::error('Current password is incorrect.', 'INVALID_PASSWORD', ['current_password' => 'Incorrect password.'], 422);
        }

        $newHash = Auth::hashPassword($newPassword);
        $updateStmt = $pdo->prepare('UPDATE users SET password_hash = :hash, updated_at = NOW() WHERE id = :id');
        $updateStmt->execute([
            ':hash' => $newHash,
            ':id'   => $userId,
        ]);

        Audit::log($userId, 'PASSWORD_CHANGE', 'USER', (string)$userId, [
            'action' => 'User changed own password',
        ], $request->getIp(), $request->getUserAgent());

        Response::json(['message' => 'Password updated successfully.']);
    }
}
