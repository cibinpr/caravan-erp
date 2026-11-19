<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Config\Database;
use App\Core\Request;
use App\Core\Response;
use PDO;

/**
 * Dashboard Aggregation Controller (SRS Section 3.8 & UI-D12)
 */
class DashboardController
{
    /**
     * GET /api/v1/dashboard/summary (FR-DSH-1, FR-DSH-2, FR-DSH-3)
     */
    public function summary(Request $request): void
    {
        $pdo = Database::getConnection();
        $period = $request->query('period', 'this_month');

        $today = date('Y-m-d');

        switch ($period) {
            case 'today':
                $periodStart = $today;
                $periodEnd = $today;
                $label = 'Today';
                break;
            case 'this_week':
                $periodStart = date('Y-m-d', strtotime('monday this week'));
                $periodEnd = date('Y-m-d', strtotime('sunday this week'));
                $label = 'This Week';
                break;
            case 'this_year':
                $periodStart = date('Y-01-01');
                $periodEnd = date('Y-12-31');
                $label = 'This Year';
                break;
            case 'this_month':
            default:
                $periodStart = date('Y-m-01');
                $periodEnd = date('Y-m-t');
                $label = 'This Month';
                break;
        }

        // Today's Totals
        $todayStmt = $pdo->prepare('
            SELECT 
                COALESCE(SUM(CASE WHEN type = "income" THEN amount ELSE 0 END), 0) AS income,
                COALESCE(SUM(CASE WHEN type = "expense" THEN amount ELSE 0 END), 0) AS expense
            FROM transactions
            WHERE txn_date = :today
        ');
        $todayStmt->execute([':today' => $today]);
        $todayTotals = $todayStmt->fetch();

        // Selected Period Totals
        $periodStmt = $pdo->prepare('
            SELECT 
                COALESCE(SUM(CASE WHEN type = "income" THEN amount ELSE 0 END), 0) AS income,
                COALESCE(SUM(CASE WHEN type = "expense" THEN amount ELSE 0 END), 0) AS expense
            FROM transactions
            WHERE txn_date BETWEEN :start AND :end
        ');
        $periodStmt->execute([':start' => $periodStart, ':end' => $periodEnd]);
        $periodTotals = $periodStmt->fetch();

        $pIncome = (float)$periodTotals['income'];
        $pExpense = (float)$periodTotals['expense'];
        $pNet = $pIncome - $pExpense;

        // All-Time Totals
        $allStmt = $pdo->query('
            SELECT 
                COALESCE(SUM(CASE WHEN type = "income" THEN amount ELSE 0 END), 0) AS income,
                COALESCE(SUM(CASE WHEN type = "expense" THEN amount ELSE 0 END), 0) AS expense
            FROM transactions
        ');
        $allTotals = $allStmt->fetch();

        Response::json([
            'today'    => [
                'income'  => (float)$todayTotals['income'],
                'expense' => (float)$todayTotals['expense'],
            ],
            'period'   => [
                'label'      => $label,
                'date_start' => $periodStart,
                'date_end'   => $periodEnd,
                'income'     => $pIncome,
                'expense'    => $pExpense,
                'net'        => $pNet,
            ],
            'all_time' => [
                'income'  => (float)$allTotals['income'],
                'expense' => (float)$allTotals['expense'],
            ],
        ]);
    }

    /**
     * GET /api/v1/dashboard/recent (FR-DSH-6)
     */
    public function recent(Request $request): void
    {
        $pdo = Database::getConnection();
        $limit = min(50, max(1, (int)$request->query('limit', 10)));

        $stmt = $pdo->prepare("
            SELECT 
                t.id, t.type, t.category_id, t.amount, t.payment_mode,
                t.description, t.txn_date, t.bill_file, t.bill_original_name,
                c.name AS category_name
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            ORDER BY t.txn_date DESC, t.id DESC
            LIMIT {$limit}
        ");
        $stmt->execute();
        $rows = $stmt->fetchAll();

        foreach ($rows as &$r) {
            $r['id'] = (int)$r['id'];
            $r['category_id'] = (int)$r['category_id'];
            $r['amount'] = (float)$r['amount'];
            $r['has_bill'] = !empty($r['bill_file']);
        }

        Response::json($rows);
    }

    /**
     * GET /api/v1/dashboard/monthly (FR-DSH-4: Income vs Expense by month for selected year)
     */
    public function monthly(Request $request): void
    {
        $pdo = Database::getConnection();
        $year = (int)$request->query('year', date('Y'));
        if ($year < 2000 || $year > 2100) {
            $year = (int)date('Y');
        }

        $stmt = $pdo->prepare('
            SELECT 
                MONTH(txn_date) AS month_num,
                COALESCE(SUM(CASE WHEN type = "income" THEN amount ELSE 0 END), 0) AS income,
                COALESCE(SUM(CASE WHEN type = "expense" THEN amount ELSE 0 END), 0) AS expense
            FROM transactions
            WHERE YEAR(txn_date) = :year
            GROUP BY MONTH(txn_date)
            ORDER BY month_num ASC
        ');
        $stmt->execute([':year' => $year]);
        $rows = $stmt->fetchAll();

        // Index by month_num
        $monthlyMap = [];
        foreach ($rows as $r) {
            $monthlyMap[(int)$r['month_num']] = [
                'income'  => (float)$r['income'],
                'expense' => (float)$r['expense'],
            ];
        }

        $monthNames = [
            1 => 'Jan', 2 => 'Feb', 3 => 'Mar', 4 => 'Apr', 5 => 'May', 6 => 'Jun',
            7 => 'Jul', 8 => 'Aug', 9 => 'Sep', 10 => 'Oct', 11 => 'Nov', 12 => 'Dec'
        ];

        $result = [];
        for ($m = 1; $m <= 12; $m++) {
            $inc = $monthlyMap[$m]['income'] ?? 0.0;
            $exp = $monthlyMap[$m]['expense'] ?? 0.0;
            $result[] = [
                'month'   => $m,
                'name'    => $monthNames[$m],
                'income'  => $inc,
                'expense' => $exp,
                'net'     => $inc - $exp,
            ];
        }

        Response::json($result, ['year' => $year]);
    }

    /**
     * GET /api/v1/dashboard/by-category (FR-DSH-5 & UI-D6: Expense breakdown by category)
     */
    public function byCategory(Request $request): void
    {
        $pdo = Database::getConnection();
        $type = $request->query('type', 'expense');
        if (!in_array($type, ['income', 'expense'], true)) {
            $type = 'expense';
        }

        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        // Default to current month if no dates passed
        if (empty($dateFrom) || empty($dateTo)) {
            $dateFrom = date('Y-m-01');
            $dateTo = date('Y-m-t');
        }

        $stmt = $pdo->prepare('
            SELECT 
                c.id, c.name,
                COALESCE(SUM(t.amount), 0) AS total_amount,
                COUNT(t.id) AS count
            FROM categories c
            INNER JOIN transactions t ON t.category_id = c.id
            WHERE t.type = :type
              AND t.txn_date BETWEEN :date_from AND :date_to
            GROUP BY c.id
            ORDER BY total_amount DESC
        ');
        $stmt->execute([
            ':type'      => $type,
            ':date_from' => $dateFrom,
            ':date_to'   => $dateTo,
        ]);
        $rows = $stmt->fetchAll();

        $grandTotal = 0;
        foreach ($rows as $r) {
            $grandTotal += (float)$r['total_amount'];
        }

        // Limit to top 7 categories and group remaining as "Other" (UI-D6)
        $topCategories = [];
        $otherAmount = 0;
        $otherCount = 0;

        foreach ($rows as $index => $row) {
            $amount = (float)$row['total_amount'];
            $pct = $grandTotal > 0 ? round(($amount / $grandTotal) * 100, 1) : 0;

            if ($index < 7) {
                $topCategories[] = [
                    'id'         => (int)$row['id'],
                    'name'       => $row['name'],
                    'amount'     => $amount,
                    'percentage' => $pct,
                    'count'      => (int)$row['count'],
                ];
            } else {
                $otherAmount += $amount;
                $otherCount += (int)$row['count'];
            }
        }

        if ($otherAmount > 0) {
            $otherPct = $grandTotal > 0 ? round(($otherAmount / $grandTotal) * 100, 1) : 0;
            $topCategories[] = [
                'id'         => 0,
                'name'       => 'Other Categories',
                'amount'     => $otherAmount,
                'percentage' => $otherPct,
                'count'      => $otherCount,
            ];
        }

        Response::json($topCategories, [
            'type'        => $type,
            'date_from'   => $dateFrom,
            'date_to'     => $dateTo,
            'grand_total' => $grandTotal,
        ]);
    }
}
