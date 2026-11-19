<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Config\Database;
use App\Core\Request;
use App\Core\Response;
use PDO;

/**
 * Account Ledger Controller with Running Balance Calculation (SRS Section 3.9)
 */
class LedgerController
{
    /**
     * GET /api/v1/ledger (FR-LED-1 to FR-LED-4)
     */
    public function index(Request $request): void
    {
        $pdo = Database::getConnection();

        // 1. Date Range (defaults to current month if omitted)
        $dateFrom = $request->query('date_from', date('Y-m-01'));
        $dateTo = $request->query('date_to', date('Y-m-t'));
        $categoryId = (int)$request->query('category_id', 0);
        $paymentMode = $request->query('payment_mode');
        $format = strtolower((string)$request->query('format', 'json'));

        // 2. Compute Opening Balance (All transactions prior to date_from) (FR-LED-3)
        $openStmt = $pdo->prepare('
            SELECT 
                COALESCE(SUM(CASE WHEN type = "income" THEN amount ELSE -amount END), 0) AS opening_balance
            FROM transactions
            WHERE txn_date < :date_from
        ');
        $openStmt->execute([':date_from' => $dateFrom]);
        $openingBalance = (float)$openStmt->fetchColumn();

        // 3. Build Query for Selected Range
        $where = ['t.txn_date BETWEEN :date_from AND :date_to'];
        $params = [
            ':date_from' => $dateFrom,
            ':date_to'   => $dateTo,
        ];

        if ($categoryId > 0) {
            $where[] = 't.category_id = :category_id';
            $params[':category_id'] = $categoryId;
        }

        if (!empty($paymentMode)) {
            $where[] = 't.payment_mode = :payment_mode';
            $params[':payment_mode'] = $paymentMode;
        }

        $whereClause = 'WHERE ' . implode(' AND ', $where);

        // Fetch all transactions in chronological order for running balance
        $sql = "
            SELECT 
                t.id, t.type, t.category_id, t.amount, t.payment_mode,
                t.description, t.txn_date, t.bill_file, t.bill_original_name,
                c.name AS category_name
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            {$whereClause}
            ORDER BY t.txn_date ASC, t.id ASC
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $allRangeRows = $stmt->fetchAll();

        // 4. Calculate Chronological Running Balance & Totals (FR-LED-1, FR-LED-3)
        $totalCredits = 0.0;
        $totalDebits = 0.0;
        $runningBalance = $openingBalance;

        $ledgerEntries = [];
        foreach ($allRangeRows as $row) {
            $amount = (float)$row['amount'];
            $isIncome = ($row['type'] === 'income');

            $debit = $isIncome ? 0.0 : $amount;
            $credit = $isIncome ? $amount : 0.0;

            if ($isIncome) {
                $totalCredits += $amount;
                $runningBalance += $amount;
            } else {
                $totalDebits += $amount;
                $runningBalance -= $amount;
            }

            $ledgerEntries[] = [
                'id'                 => (int)$row['id'],
                'txn_date'           => $row['txn_date'],
                'type'               => $row['type'],
                'category_name'      => $row['category_name'] ?: 'Uncategorized',
                'description'        => $row['description'] ?: '',
                'payment_mode'       => $row['payment_mode'],
                'debit'              => $debit,
                'credit'             => $credit,
                'running_balance'    => round($runningBalance, 2),
                'bill_file'          => $row['bill_file'],
                'bill_original_name' => $row['bill_original_name'],
            ];
        }

        $closingBalance = round($runningBalance, 2);

        // 5. CSV Export Format Handling (FR-LED-4)
        if ($format === 'csv') {
            $this->exportCsv($dateFrom, $dateTo, $openingBalance, $totalCredits, $totalDebits, $closingBalance, $ledgerEntries);
            return;
        }

        // 6. JSON Response with Pagination (optional query page/per_page)
        $page = max(1, (int)$request->query('page', 1));
        $perPage = (int)$request->query('per_page', 50);
        $totalRecords = count($ledgerEntries);
        $totalPages = (int)ceil($totalRecords / $perPage);
        $offset = ($page - 1) * $perPage;

        $pagedEntries = array_slice($ledgerEntries, $offset, $perPage);

        Response::json($pagedEntries, [
            'summary' => [
                'date_from'       => $dateFrom,
                'date_to'         => $dateTo,
                'opening_balance' => round($openingBalance, 2),
                'total_credits'   => round($totalCredits, 2),
                'total_debits'    => round($totalDebits, 2),
                'closing_balance' => $closingBalance,
            ],
            'pagination' => [
                'page'          => $page,
                'per_page'      => $perPage,
                'total_records' => $totalRecords,
                'total_pages'   => $totalPages,
            ],
        ]);
    }

    private function exportCsv(
        string $dateFrom,
        string $dateTo,
        float $openingBalance,
        float $totalCredits,
        float $totalDebits,
        float $closingBalance,
        array $entries
    ): void {
        $filename = "ledger_{$dateFrom}_to_{$dateTo}.csv";

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Pragma: no-cache');
        header('Expires: 0');

        $out = fopen('php://output', 'w');

        // CSV Header Block
        fputcsv($out, ['CARAVAN ACCOUNTING - GENERAL LEDGER']);
        fputcsv($out, ['Period:', "{$dateFrom} to {$dateTo}"]);
        fputcsv($out, ['Generated At:', date('d-m-Y H:i:s')]);
        fputcsv($out, []);

        // Balance Summary Header
        fputcsv($out, ['Opening Balance', number_format($openingBalance, 2, '.', '')]);
        fputcsv($out, ['Total Credits (Income)', number_format($totalCredits, 2, '.', '')]);
        fputcsv($out, ['Total Debits (Expense)', number_format($totalDebits, 2, '.', '')]);
        fputcsv($out, ['Closing Balance', number_format($closingBalance, 2, '.', '')]);
        fputcsv($out, []);

        // Column Headers
        fputcsv($out, ['Date', 'Type', 'Category', 'Description', 'Payment Mode', 'Debit (INR)', 'Credit (INR)', 'Running Balance (INR)']);

        // Data Rows
        foreach ($entries as $e) {
            fputcsv($out, [
                $e['txn_date'],
                ucfirst($e['type']),
                $e['category_name'],
                $e['description'],
                $e['payment_mode'],
                $e['debit'] > 0 ? number_format($e['debit'], 2, '.', '') : '',
                $e['credit'] > 0 ? number_format($e['credit'], 2, '.', '') : '',
                number_format($e['running_balance'], 2, '.', ''),
            ]);
        }

        fclose($out);
        exit;
    }
}
