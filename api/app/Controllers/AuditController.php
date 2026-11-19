<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Config\Database;
use App\Core\Request;
use App\Core\Response;
use PDO;

/**
 * Audit Trail Controller (SRS Section 3.11, FR-AUD-1 & FR-AUD-2)
 * Read-only log of changes, logins, and administrative actions.
 */
class AuditController
{
    /**
     * GET /api/v1/audit-log (FR-AUD-2)
     */
    public function index(Request $request): void
    {
        $pdo = Database::getConnection();

        // 1. Pagination
        $page = max(1, (int)$request->query('page', 1));
        $perPage = (int)$request->query('per_page', 25);
        if (!in_array($perPage, [10, 25, 50, 100], true)) {
            $perPage = 25;
        }
        $offset = ($page - 1) * $perPage;

        // 2. Filters
        $where = [];
        $params = [];

        $userId = (int)$request->query('user_id', 0);
        if ($userId > 0) {
            $where[] = 'a.user_id = :user_id';
            $params[':user_id'] = $userId;
        }

        $action = trim((string)$request->query('action', ''));
        if (!empty($action)) {
            $where[] = 'a.action = :action';
            $params[':action'] = $action;
        }

        $entity = trim((string)$request->query('entity', ''));
        if (!empty($entity)) {
            $where[] = 'a.entity = :entity';
            $params[':entity'] = $entity;
        }

        $dateFrom = $request->query('date_from');
        if (!empty($dateFrom) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
            $where[] = 'a.created_at >= :date_from';
            $params[':date_from'] = $dateFrom . ' 00:00:00';
        }

        $dateTo = $request->query('date_to');
        if (!empty($dateTo) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
            $where[] = 'a.created_at <= :date_to';
            $params[':date_to'] = $dateTo . ' 23:59:59';
        }

        $whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        // 3. Count Total Records
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM audit_log a {$whereClause}");
        $countStmt->execute($params);
        $totalRecords = (int)$countStmt->fetchColumn();
        $totalPages = (int)ceil($totalRecords / $perPage);

        // 4. Query Audit Records
        $sql = "
            SELECT 
                a.id, a.user_id, a.action, a.entity, a.entity_id, a.details,
                a.ip_address, a.user_agent, a.created_at,
                u.name AS user_name, u.email AS user_email
            FROM audit_log a
            LEFT JOIN users u ON u.id = a.user_id
            {$whereClause}
            ORDER BY a.created_at DESC, a.id DESC
            LIMIT {$perPage} OFFSET {$offset}
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['id'] = (int)$row['id'];
            $row['user_id'] = $row['user_id'] ? (int)$row['user_id'] : null;
            if (!empty($row['details'])) {
                $decoded = json_decode($row['details'], true);
                $row['details'] = is_array($decoded) ? $decoded : $row['details'];
            }
        }

        Response::json($rows, [
            'pagination' => [
                'page'          => $page,
                'per_page'      => $perPage,
                'total_records' => $totalRecords,
                'total_pages'   => $totalPages,
            ],
        ]);
    }
}
