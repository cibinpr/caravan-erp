<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Config\Config;
use App\Config\Database;
use App\Core\Request;
use App\Core\Response;
use PDO;

/**
 * Reports & Financial Statements Controller (SRS Section 3.10)
 */
class ReportController
{
    /**
     * GET /api/v1/reports/monthly (FR-RPT-1, FR-RPT-3)
     */
    public function monthly(Request $request): void
    {
        $year = (int)$request->query('year', date('Y'));
        $month = (int)$request->query('month', date('n'));
        $format = strtolower((string)$request->query('format', 'json'));

        if ($month < 1 || $month > 12) $month = (int)date('n');
        if ($year < 2000 || $year > 2100) $year = (int)date('Y');

        $dateFrom = sprintf('%04d-%02d-01', $year, $month);
        $dateTo = date('Y-m-t', strtotime($dateFrom));

        $data = $this->generatePeriodReport($dateFrom, $dateTo);

        if ($format === 'csv') {
            $this->exportMonthlyCsv($year, $month, $data);
            return;
        }

        Response::json($data, [
            'report_type' => 'monthly',
            'year'        => $year,
            'month'       => $month,
            'date_from'   => $dateFrom,
            'date_to'     => $dateTo,
        ]);
    }

    /**
     * GET /api/v1/reports/range (FR-RPT-2, FR-RPT-3)
     */
    public function range(Request $request): void
    {
        $dateFrom = $request->query('date_from', date('Y-m-01'));
        $dateTo = $request->query('date_to', date('Y-m-t'));
        $format = strtolower((string)$request->query('format', 'json'));

        $data = $this->generatePeriodReport($dateFrom, $dateTo);

        if ($format === 'csv') {
            $this->exportRangeCsv($dateFrom, $dateTo, $data);
            return;
        }

        Response::json($data, [
            'report_type' => 'range',
            'date_from'   => $dateFrom,
            'date_to'     => $dateTo,
        ]);
    }

    /**
     * GET /api/v1/reports/yearly (FR-RPT-4: Month-by-month summary for selected year)
     */
    public function yearly(Request $request): void
    {
        $pdo = Database::getConnection();
        $year = (int)$request->query('year', date('Y'));
        $format = strtolower((string)$request->query('format', 'json'));

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

        $monthMap = [];
        foreach ($rows as $r) {
            $monthMap[(int)$r['month_num']] = [
                'income'  => (float)$r['income'],
                'expense' => (float)$r['expense'],
            ];
        }

        $monthNames = [
            1 => 'January', 2 => 'February', 3 => 'March', 4 => 'April',
            5 => 'May', 6 => 'June', 7 => 'July', 8 => 'August',
            9 => 'September', 10 => 'October', 11 => 'November', 12 => 'December'
        ];

        $yearSummary = [];
        $totalYearIncome = 0;
        $totalYearExpense = 0;

        for ($m = 1; $m <= 12; $m++) {
            $inc = $monthMap[$m]['income'] ?? 0.0;
            $exp = $monthMap[$m]['expense'] ?? 0.0;
            $net = $inc - $exp;

            $totalYearIncome += $inc;
            $totalYearExpense += $exp;

            $yearSummary[] = [
                'month'   => $m,
                'name'    => $monthNames[$m],
                'income'  => $inc,
                'expense' => $exp,
                'net'     => $net,
            ];
        }

        $data = [
            'year'          => $year,
            'total_income'  => $totalYearIncome,
            'total_expense' => $totalYearExpense,
            'net_savings'   => $totalYearIncome - $totalYearExpense,
            'months'        => $yearSummary,
        ];

        if ($format === 'csv') {
            $this->exportYearlyCsv($year, $data);
            return;
        }

        Response::json($data);
    }

    private function generatePeriodReport(string $dateFrom, string $dateTo): array
    {
        $pdo = Database::getConnection();

        // 1. Overview Totals
        $sumStmt = $pdo->prepare('
            SELECT 
                COUNT(*) as total_transactions,
                COALESCE(SUM(CASE WHEN type = "income" THEN amount ELSE 0 END), 0) AS total_income,
                COALESCE(SUM(CASE WHEN type = "expense" THEN amount ELSE 0 END), 0) AS total_expense
            FROM transactions
            WHERE txn_date BETWEEN :date_from AND :date_to
        ');
        $sumStmt->execute([':date_from' => $dateFrom, ':date_to' => $dateTo]);
        $sumRow = $sumStmt->fetch();

        $totalIncome = (float)$sumRow['total_income'];
        $totalExpense = (float)$sumRow['total_expense'];
        $net = $totalIncome - $totalExpense;

        // 2. Category-Wise Summary with Percentage Shares (FR-RPT-3)
        $catStmt = $pdo->prepare('
            SELECT 
                t.type,
                c.id as category_id,
                c.name as category_name,
                COALESCE(SUM(t.amount), 0) AS total_amount,
                COUNT(t.id) AS count
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            WHERE t.txn_date BETWEEN :date_from AND :date_to
            GROUP BY t.type, c.id
            ORDER BY t.type ASC, total_amount DESC
        ');
        $catStmt->execute([':date_from' => $dateFrom, ':date_to' => $dateTo]);
        $catRows = $catStmt->fetchAll();

        $incomeCategories = [];
        $expenseCategories = [];

        foreach ($catRows as $row) {
            $amt = (float)$row['total_amount'];
            if ($row['type'] === 'income') {
                $pct = $totalIncome > 0 ? round(($amt / $totalIncome) * 100, 1) : 0;
                $incomeCategories[] = [
                    'id'         => (int)$row['category_id'],
                    'name'       => $row['category_name'] ?: 'Uncategorized',
                    'amount'     => $amt,
                    'percentage' => $pct,
                    'count'      => (int)$row['count'],
                ];
            } else {
                $pct = $totalExpense > 0 ? round(($amt / $totalExpense) * 100, 1) : 0;
                $expenseCategories[] = [
                    'id'         => (int)$row['category_id'],
                    'name'       => $row['category_name'] ?: 'Uncategorized',
                    'amount'     => $amt,
                    'percentage' => $pct,
                    'count'      => (int)$row['count'],
                ];
            }
        }

        // 3. Payment Mode Summary
        $modeStmt = $pdo->prepare('
            SELECT 
                payment_mode,
                COALESCE(SUM(CASE WHEN type = "income" THEN amount ELSE 0 END), 0) AS income_amount,
                COALESCE(SUM(CASE WHEN type = "expense" THEN amount ELSE 0 END), 0) AS expense_amount
            FROM transactions
            WHERE txn_date BETWEEN :date_from AND :date_to
            GROUP BY payment_mode
            ORDER BY payment_mode ASC
        ');
        $modeStmt->execute([':date_from' => $dateFrom, ':date_to' => $dateTo]);
        $modeRows = $modeStmt->fetchAll();

        return [
            'summary' => [
                'total_income'       => $totalIncome,
                'total_expense'      => $totalExpense,
                'net_result'         => $net,
                'total_transactions' => (int)$sumRow['total_transactions'],
            ],
            'income_categories'  => $incomeCategories,
            'expense_categories' => $expenseCategories,
            'payment_modes'      => $modeRows,
        ];
    }

    private function exportMonthlyCsv(int $year, int $month, array $data): void
    {
        $filename = "monthly_report_{$year}_{$month}.csv";
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');

        $out = fopen('php://output', 'w');
        fputcsv($out, ['CARAVAN ACCOUNTING - MONTHLY FINANCIAL STATEMENT']);
        fputcsv($out, ['Year:', $year, 'Month:', date('F', mktime(0, 0, 0, $month, 10))]);
        fputcsv($out, ['Generated:', date('d-m-Y H:i:s')]);
        fputcsv($out, []);

        fputcsv($out, ['FINANCIAL OVERVIEW']);
        fputcsv($out, ['Total Income (INR)', number_format($data['summary']['total_income'], 2, '.', '')]);
        fputcsv($out, ['Total Expense (INR)', number_format($data['summary']['total_expense'], 2, '.', '')]);
        fputcsv($out, ['Net Savings / Profit (INR)', number_format($data['summary']['net_result'], 2, '.', '')]);
        fputcsv($out, []);

        fputcsv($out, ['EXPENSE CATEGORY BREAKDOWN']);
        fputcsv($out, ['Category', 'Amount (INR)', 'Percentage Share (%)', 'Transaction Count']);
        foreach ($data['expense_categories'] as $c) {
            fputcsv($out, [$c['name'], number_format($c['amount'], 2, '.', ''), $c['percentage'] . '%', $c['count']]);
        }
        fputcsv($out, []);

        fputcsv($out, ['INCOME CATEGORY BREAKDOWN']);
        fputcsv($out, ['Category', 'Amount (INR)', 'Percentage Share (%)', 'Transaction Count']);
        foreach ($data['income_categories'] as $c) {
            fputcsv($out, [$c['name'], number_format($c['amount'], 2, '.', ''), $c['percentage'] . '%', $c['count']]);
        }

        fclose($out);
        exit;
    }

    private function exportRangeCsv(string $dateFrom, string $dateTo, array $data): void
    {
        $filename = "report_{$dateFrom}_to_{$dateTo}.csv";
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');

        $out = fopen('php://output', 'w');
        fputcsv($out, ['CARAVAN ACCOUNTING - PERIOD STATEMENT']);
        fputcsv($out, ['Period:', "{$dateFrom} to {$dateTo}"]);
        fputcsv($out, ['Generated:', date('d-m-Y H:i:s')]);
        fputcsv($out, []);

        fputcsv($out, ['Total Income (INR)', number_format($data['summary']['total_income'], 2, '.', '')]);
        fputcsv($out, ['Total Expense (INR)', number_format($data['summary']['total_expense'], 2, '.', '')]);
        fputcsv($out, ['Net Profit / Loss (INR)', number_format($data['summary']['net_result'], 2, '.', '')]);
        fputcsv($out, []);

        fputcsv($out, ['EXPENSE BREAKDOWN']);
        fputcsv($out, ['Category', 'Amount (INR)', 'Share (%)', 'Entries']);
        foreach ($data['expense_categories'] as $c) {
            fputcsv($out, [$c['name'], number_format($c['amount'], 2, '.', ''), $c['percentage'] . '%', $c['count']]);
        }
        fputcsv($out, []);

        fputcsv($out, ['INCOME BREAKDOWN']);
        fputcsv($out, ['Category', 'Amount (INR)', 'Share (%)', 'Entries']);
        foreach ($data['income_categories'] as $c) {
            fputcsv($out, [$c['name'], number_format($c['amount'], 2, '.', ''), $c['percentage'] . '%', $c['count']]);
        }

        fclose($out);
        exit;
    }

    private function exportYearlyCsv(int $year, array $data): void
    {
        $filename = "yearly_summary_{$year}.csv";
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');

        $out = fopen('php://output', 'w');
        fputcsv($out, ['CARAVAN ACCOUNTING - YEARLY FINANCIAL SUMMARY']);
        fputcsv($out, ['Year:', $year]);
        fputcsv($out, ['Total Year Income (INR)', number_format($data['total_income'], 2, '.', '')]);
        fputcsv($out, ['Total Year Expense (INR)', number_format($data['total_expense'], 2, '.', '')]);
        fputcsv($out, ['Net Savings (INR)', number_format($data['net_savings'], 2, '.', '')]);
        fputcsv($out, []);

        fputcsv($out, ['Month', 'Income (INR)', 'Expense (INR)', 'Net (INR)']);
        foreach ($data['months'] as $m) {
            fputcsv($out, [
                $m['name'],
                number_format($m['income'], 2, '.', ''),
                number_format($m['expense'], 2, '.', ''),
                number_format($m['net'], 2, '.', ''),
            ]);
        }

        fclose($out);
        exit;
    }
}
