<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Config\Database;
use App\Core\Audit;
use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use PDO;

/**
 * User Management Controller (SRS Section 3.2, FR-USR-1 to FR-USR-4)
 * Restricted to Administrator role only.
 */
class UserController
{
    /**
     * GET /api/v1/users (FR-USR-1)
     */
    public function index(Request $request): void
    {
        $pdo = Database::getConnection();

        $stmt = $pdo->query('
            SELECT 
                u.id, u.name, u.email, u.role, u.is_active, u.last_login_at, u.created_at,
                (SELECT COUNT(*) FROM transactions WHERE created_by = u.id) AS transactions_count
            FROM users u
            ORDER BY u.role ASC, u.name ASC
        ');
        $users = $stmt->fetchAll();

        foreach ($users as &$u) {
            $u['id'] = (int)$u['id'];
            $u['is_active'] = (bool)$u['is_active'];
            $u['transactions_count'] = (int)$u['transactions_count'];
        }

        Response::json($users);
    }

    /**
     * POST /api/v1/users (FR-USR-1, FR-USR-4)
     */
    public function store(Request $request): void
    {
        $name = trim((string)$request->input('name', ''));
        $email = strtolower(trim((string)$request->input('email', '')));
        $password = (string)$request->input('password', '');
        $role = trim((string)$request->input('role', 'viewer'));

        $errors = [];
        if (empty($name)) {
            $errors['name'] = 'Full name is required.';
        }
        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'A valid email address is required.';
        }
        if (strlen($password) < 8) {
            $errors['password'] = 'Password must be at least 8 characters long.';
        }
        if (!in_array($role, ['admin', 'viewer'], true)) {
            $errors['role'] = 'Role must be either "admin" or "viewer".';
        }

        if (!empty($errors)) {
            Response::error('Validation failed.', 'VALIDATION_FAILED', $errors, 422);
        }

        $pdo = Database::getConnection();

        // Check unique email (FR-USR-4)
        $checkStmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $checkStmt->execute([':email' => $email]);
        if ($checkStmt->fetch()) {
            Response::error('A user with this email address already exists.', 'EMAIL_EXISTS', ['email' => 'Email already registered.'], 409);
        }

        $passwordHash = Auth::hashPassword($password);

        $stmt = $pdo->prepare('
            INSERT INTO users (name, email, password_hash, role, is_active, created_at)
            VALUES (:name, :email, :hash, :role, 1, NOW())
        ');
        $stmt->execute([
            ':name'  => $name,
            ':email' => $email,
            ':hash'  => $passwordHash,
            ':role'  => $role,
        ]);
        $newId = (int)$pdo->lastInsertId();

        Audit::log(Auth::id(), 'CREATE_USER', 'USER', (string)$newId, [
            'name'  => $name,
            'email' => $email,
            'role'  => $role,
        ], $request->getIp(), $request->getUserAgent());

        Response::json([
            'id'        => $newId,
            'name'      => $name,
            'email'     => $email,
            'role'      => $role,
            'is_active' => true,
        ], ['message' => "User '{$name}' created successfully."], 201);
    }

    /**
     * GET /api/v1/users/{id}
     */
    public function show(Request $request, array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare('SELECT id, name, email, role, is_active, last_login_at, created_at FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch();

        if (!$user) {
            Response::notFound('User not found.');
        }

        $user['id'] = (int)$user['id'];
        $user['is_active'] = (bool)$user['is_active'];

        Response::json($user);
    }

    /**
     * PUT /api/v1/users/{id} (FR-USR-1, FR-USR-3, FR-USR-4)
     */
    public function update(Request $request, array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $name = trim((string)$request->input('name', ''));
        $email = strtolower(trim((string)$request->input('email', '')));
        $role = trim((string)$request->input('role', ''));

        $pdo = Database::getConnection();

        $stmt = $pdo->prepare('SELECT id, name, email, role, is_active FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch();

        if (!$user) {
            Response::notFound('User not found.');
        }

        $errors = [];
        if (empty($name)) {
            $errors['name'] = 'Full name is required.';
        }
        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'Valid email is required.';
        }
        if (!in_array($role, ['admin', 'viewer'], true)) {
            $errors['role'] = 'Role must be "admin" or "viewer".';
        }

        if (!empty($errors)) {
            Response::error('Validation failed.', 'VALIDATION_FAILED', $errors, 422);
        }

        // Check email uniqueness excluding self
        $checkStmt = $pdo->prepare('SELECT id FROM users WHERE email = :email AND id != :id LIMIT 1');
        $checkStmt->execute([':email' => $email, ':id' => $id]);
        if ($checkStmt->fetch()) {
            Response::error('Email is already registered by another user.', 'EMAIL_EXISTS', ['email' => 'Email taken.'], 409);
        }

        // Enforce FR-USR-3: Prevent demoting the last active admin
        if ($user['role'] === 'admin' && $role === 'viewer') {
            if ($this->getActiveAdminCount($pdo) <= 1) {
                Response::error(
                    'Cannot demote this user. There must always be at least one active administrator in the system.',
                    'CANNOT_DEMOTE_LAST_ADMIN',
                    [],
                    400
                );
            }
        }

        $updateStmt = $pdo->prepare('
            UPDATE users SET name = :name, email = :email, role = :role, updated_at = NOW()
            WHERE id = :id
        ');
        $updateStmt->execute([
            ':name'  => $name,
            ':email' => $email,
            ':role'  => $role,
            ':id'    => $id,
        ]);

        Audit::log(Auth::id(), 'UPDATE_USER', 'USER', (string)$id, [
            'before' => ['name' => $user['name'], 'email' => $user['email'], 'role' => $user['role']],
            'after'  => ['name' => $name, 'email' => $email, 'role' => $role],
        ], $request->getIp(), $request->getUserAgent());

        Response::json([
            'id'        => $id,
            'name'      => $name,
            'email'     => $email,
            'role'      => $role,
            'is_active' => (bool)$user['is_active'],
        ], ['message' => 'User profile updated successfully.']);
    }

    /**
     * PATCH /api/v1/users/{id}/active (FR-USR-1, FR-USR-3)
     */
    public function toggleActive(Request $request, array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare('SELECT id, name, role, is_active FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch();

        if (!$user) {
            Response::notFound('User not found.');
        }

        $currentlyActive = ((int)$user['is_active'] === 1);
        $newActive = $currentlyActive ? 0 : 1;

        // Enforce FR-USR-3: Prevent deactivating the last active admin
        if ($currentlyActive && $user['role'] === 'admin') {
            if ($this->getActiveAdminCount($pdo) <= 1) {
                Response::error(
                    'Cannot deactivate this account. There must always be at least one active administrator in the system.',
                    'CANNOT_DEACTIVATE_LAST_ADMIN',
                    [],
                    400
                );
            }
        }

        $updateStmt = $pdo->prepare('UPDATE users SET is_active = :active, updated_at = NOW() WHERE id = :id');
        $updateStmt->execute([':active' => $newActive, ':id' => $id]);

        Audit::log(Auth::id(), 'TOGGLE_USER_ACTIVE', 'USER', (string)$id, [
            'name'      => $user['name'],
            'is_active' => (bool)$newActive,
        ], $request->getIp(), $request->getUserAgent());

        Response::json([
            'id'        => $id,
            'is_active' => (bool)$newActive,
        ], ['message' => $newActive ? "User '{$user['name']}' activated." : "User '{$user['name']}' deactivated."]);
    }

    /**
     * POST /api/v1/users/{id}/reset-password (FR-USR-2)
     */
    public function resetPassword(Request $request, array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $newPassword = (string)$request->input('password', '');

        if (strlen($newPassword) < 8) {
            Response::error('Password must be at least 8 characters long.', 'VALIDATION_FAILED', ['password' => 'Minimum 8 characters.'], 422);
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare('SELECT id, name, email FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch();

        if (!$user) {
            Response::notFound('User not found.');
        }

        $hash = Auth::hashPassword($newPassword);
        $updateStmt = $pdo->prepare('UPDATE users SET password_hash = :hash, updated_at = NOW() WHERE id = :id');
        $updateStmt->execute([':hash' => $hash, ':id' => $id]);

        Audit::log(Auth::id(), 'RESET_PASSWORD', 'USER', (string)$id, [
            'target_user' => $user['email'],
            'action'      => 'Admin reset user password',
        ], $request->getIp(), $request->getUserAgent());

        Response::json(['message' => "Password for '{$user['name']}' has been reset successfully."]);
    }

    /**
     * DELETE /api/v1/users/{id} (FR-USR-1, FR-USR-3)
     */
    public function destroy(Request $request, array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare('SELECT id, name, role, is_active FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch();

        if (!$user) {
            Response::notFound('User not found.');
        }

        // Enforce FR-USR-3
        if ($user['role'] === 'admin') {
            if ($this->getActiveAdminCount($pdo) <= 1) {
                Response::error(
                    'Cannot delete the last active administrator.',
                    'CANNOT_DELETE_LAST_ADMIN',
                    [],
                    400
                );
            }
        }

        // Prevent self-deletion
        if ($id === Auth::id()) {
            Response::error('You cannot delete your own account.', 'CANNOT_DELETE_SELF', [], 400);
        }

        // Check if user has created transactions
        $txStmt = $pdo->prepare('SELECT COUNT(*) FROM transactions WHERE created_by = :id');
        $txStmt->execute([':id' => $id]);
        $txCount = (int)$txStmt->fetchColumn();

        if ($txCount > 0) {
            Response::error(
                "User '{$user['name']}' has created {$txCount} transaction(s) and cannot be hard deleted. You can deactivate their account instead.",
                'USER_HAS_RECORDS',
                ['transaction_count' => $txCount],
                409
            );
        }

        $delStmt = $pdo->prepare('DELETE FROM users WHERE id = :id');
        $delStmt->execute([':id' => $id]);

        Audit::log(Auth::id(), 'DELETE_USER', 'USER', (string)$id, [
            'name' => $user['name'],
            'role' => $user['role'],
        ], $request->getIp(), $request->getUserAgent());

        Response::json(['message' => "User '{$user['name']}' deleted successfully."]);
    }

    private function getActiveAdminCount(PDO $pdo): int
    {
        $stmt = $pdo->query('SELECT COUNT(*) FROM users WHERE role = "admin" AND is_active = 1');
        return (int)$stmt->fetchColumn();
    }
}
