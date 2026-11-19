<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Config\Database;
use App\Core\Audit;
use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use PDO;
use Throwable;

/**
 * Category Management Controller (SRS Section 3.4)
 */
class CategoryController
{
    /**
     * GET /api/v1/categories
     */
    public function index(Request $request): void
    {
        $pdo = Database::getConnection();

        $type = $request->query('type');
        $activeOnly = filter_var($request->query('active_only', false), FILTER_VALIDATE_BOOLEAN);

        $sql = '
            SELECT c.id, c.name, c.type, c.is_active, c.created_at,
                   COUNT(t.id) AS usage_count
            FROM categories c
            LEFT JOIN transactions t ON t.category_id = c.id
        ';

        $where = [];
        $params = [];

        if (!empty($type) && in_array($type, ['income', 'expense'], true)) {
            $where[] = 'c.type = :type';
            $params[':type'] = $type;
        }

        if ($activeOnly) {
            $where[] = 'c.is_active = 1';
        }

        if (!empty($where)) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }

        $sql .= ' GROUP BY c.id ORDER BY c.type ASC, c.name ASC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $categories = $stmt->fetchAll();

        // Cast boolean & integer fields
        foreach ($categories as &$cat) {
            $cat['id'] = (int)$cat['id'];
            $cat['is_active'] = (bool)$cat['is_active'];
            $cat['usage_count'] = (int)$cat['usage_count'];
        }

        Response::json($categories);
    }

    /**
     * POST /api/v1/categories (Admin only - FR-CAT-1, FR-CAT-5)
     */
    public function store(Request $request): void
    {
        $name = trim((string)$request->input('name', ''));
        $type = trim((string)$request->input('type', ''));

        $errors = [];
        if (empty($name)) {
            $errors['name'] = 'Category name is required.';
        } elseif (mb_strlen($name) > 100) {
            $errors['name'] = 'Category name must not exceed 100 characters.';
        }

        if (!in_array($type, ['income', 'expense'], true)) {
            $errors['type'] = 'Category type must be either "income" or "expense".';
        }

        if (!empty($errors)) {
            Response::error('Validation failed.', 'VALIDATION_FAILED', $errors, 422);
        }

        $pdo = Database::getConnection();

        // Check uniqueness per type (FR-CAT-5)
        $checkStmt = $pdo->prepare('SELECT id FROM categories WHERE name = :name AND type = :type LIMIT 1');
        $checkStmt->execute([':name' => $name, ':type' => $type]);
        if ($checkStmt->fetch()) {
            Response::error(
                "A {$type} category named '{$name}' already exists.",
                'CATEGORY_EXISTS',
                ['name' => "Category '{$name}' already exists for {$type}."],
                409
            );
        }

        $stmt = $pdo->prepare('
            INSERT INTO categories (name, type, is_active, created_at)
            VALUES (:name, :type, 1, NOW())
        ');
        $stmt->execute([':name' => $name, ':type' => $type]);
        $newId = (int)$pdo->lastInsertId();

        Audit::log(Auth::id(), 'CREATE', 'CATEGORY', (string)$newId, [
            'name' => $name,
            'type' => $type,
        ], $request->getIp(), $request->getUserAgent());

        Response::json([
            'id'          => $newId,
            'name'        => $name,
            'type'        => $type,
            'is_active'   => true,
            'usage_count' => 0,
        ], ['message' => 'Category created successfully.'], 201);
    }

    /**
     * PUT /api/v1/categories/{id} (Admin only - FR-CAT-2, FR-CAT-5)
     */
    public function update(Request $request, array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $name = trim((string)$request->input('name', ''));

        if (empty($name)) {
            Response::error('Category name is required.', 'VALIDATION_FAILED', ['name' => 'Name cannot be empty.'], 422);
        }

        $pdo = Database::getConnection();

        $fetchStmt = $pdo->prepare('SELECT id, name, type, is_active FROM categories WHERE id = :id LIMIT 1');
        $fetchStmt->execute([':id' => $id]);
        $category = $fetchStmt->fetch();

        if (!$category) {
            Response::notFound('Category not found.');
        }

        // Check if name is already taken by another category of same type
        $checkStmt = $pdo->prepare('SELECT id FROM categories WHERE name = :name AND type = :type AND id != :id LIMIT 1');
        $checkStmt->execute([':name' => $name, ':type' => $category['type'], ':id' => $id]);
        if ($checkStmt->fetch()) {
            Response::error(
                "A {$category['type']} category named '{$name}' already exists.",
                'CATEGORY_EXISTS',
                ['name' => 'Category name already in use.'],
                409
            );
        }

        $oldName = $category['name'];
        $updateStmt = $pdo->prepare('UPDATE categories SET name = :name, updated_at = NOW() WHERE id = :id');
        $updateStmt->execute([':name' => $name, ':id' => $id]);

        Audit::log(Auth::id(), 'UPDATE', 'CATEGORY', (string)$id, [
            'old_name' => $oldName,
            'new_name' => $name,
            'type'     => $category['type'],
        ], $request->getIp(), $request->getUserAgent());

        Response::json([
            'id'        => $id,
            'name'      => $name,
            'type'      => $category['type'],
            'is_active' => (bool)$category['is_active'],
        ], ['message' => 'Category renamed successfully.']);
    }

    /**
     * PATCH /api/v1/categories/{id}/active (Admin only - FR-CAT-3)
     */
    public function toggleActive(Request $request, array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $pdo = Database::getConnection();

        $fetchStmt = $pdo->prepare('SELECT id, name, is_active FROM categories WHERE id = :id LIMIT 1');
        $fetchStmt->execute([':id' => $id]);
        $category = $fetchStmt->fetch();

        if (!$category) {
            Response::notFound('Category not found.');
        }

        $newActive = ((int)$category['is_active'] === 1) ? 0 : 1;
        $updateStmt = $pdo->prepare('UPDATE categories SET is_active = :active, updated_at = NOW() WHERE id = :id');
        $updateStmt->execute([':active' => $newActive, ':id' => $id]);

        Audit::log(Auth::id(), 'TOGGLE_ACTIVE', 'CATEGORY', (string)$id, [
            'name'      => $category['name'],
            'is_active' => (bool)$newActive,
        ], $request->getIp(), $request->getUserAgent());

        Response::json([
            'id'        => $id,
            'is_active' => (bool)$newActive,
        ], ['message' => $newActive ? 'Category activated.' : 'Category deactivated.']);
    }

    /**
     * DELETE /api/v1/categories/{id} (Admin only - FR-CAT-4)
     */
    public function destroy(Request $request, array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $pdo = Database::getConnection();

        $fetchStmt = $pdo->prepare('SELECT id, name FROM categories WHERE id = :id LIMIT 1');
        $fetchStmt->execute([':id' => $id]);
        $category = $fetchStmt->fetch();

        if (!$category) {
            Response::notFound('Category not found.');
        }

        // FR-CAT-4: Category in use shall not be deleted
        $usageStmt = $pdo->prepare('SELECT COUNT(*) FROM transactions WHERE category_id = :id');
        $usageStmt->execute([':id' => $id]);
        $count = (int)$usageStmt->fetchColumn();

        if ($count > 0) {
            Response::error(
                "Category '{$category['name']}' is assigned to {$count} transaction(s) and cannot be deleted. You can deactivate it instead.",
                'CATEGORY_IN_USE',
                ['usage_count' => $count],
                409
            );
        }

        $deleteStmt = $pdo->prepare('DELETE FROM categories WHERE id = :id');
        $deleteStmt->execute([':id' => $id]);

        Audit::log(Auth::id(), 'DELETE', 'CATEGORY', (string)$id, [
            'name' => $category['name'],
        ], $request->getIp(), $request->getUserAgent());

        Response::json(['message' => "Category '{$category['name']}' deleted successfully."]);
    }
}
