<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Config\Database;
use App\Core\Audit;
use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Services\FileService;
use PDO;
use Throwable;

/**
 * Transaction Management Controller (SRS Section 3.5, 3.6, 3.7)
 */
class TransactionController
{
    private const ALLOWED_MODES = ['Cash', 'Bank', 'UPI', 'Cheque', 'Card'];

    /**
     * GET /api/v1/transactions (FR-LST-1 to FR-LST-7)
     */
    public function index(Request $request): void
    {
        $pdo = Database::getConnection();

        // 1. Parse Pagination
        $page = max(1, (int)$request->query('page', 1));
        $perPage = (int)$request->query('per_page', 25);
        if (!in_array($perPage, [10, 25, 50, 100], true)) {
            $perPage = 25;
        }
        $offset = ($page - 1) * $perPage;

        // 2. Parse Sorting (FR-LST-5)
        $sort = strtolower((string)$request->query('sort', 'txn_date'));
        $order = strtoupper((string)$request->query('order', 'DESC'));
        if (!in_array($order, ['ASC', 'DESC'], true)) {
            $order = 'DESC';
        }

        $sortColumns = [
            'date'     => 't.txn_date',
            'txn_date' => 't.txn_date',
            'amount'   => 't.amount',
            'category' => 'c.name',
            'id'       => 't.id',
        ];
        $orderByCol = $sortColumns[$sort] ?? 't.txn_date';
        $orderBySql = "{$orderByCol} {$order}, t.id {$order}";

        // 3. Build Filters (FR-LST-3, FR-LST-4)
        $where = [];
        $params = [];

        // Type filter (income / expense)
        $type = $request->query('type');
        if (!empty($type) && in_array($type, ['income', 'expense'], true)) {
            $where[] = 't.type = :type';
            $params[':type'] = $type;
        }

        // Category filter
        $categoryId = (int)$request->query('category_id', 0);
        if ($categoryId > 0) {
            $where[] = 't.category_id = :category_id';
            $params[':category_id'] = $categoryId;
        }

        // Payment mode filter
        $mode = $request->query('payment_mode');
        if (!empty($mode) && in_array($mode, self::ALLOWED_MODES, true)) {
            $where[] = 't.payment_mode = :payment_mode';
            $params[':payment_mode'] = $mode;
        }

        // Date range
        $dateFrom = $request->query('date_from');
        if (!empty($dateFrom) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
            $where[] = 't.txn_date >= :date_from';
            $params[':date_from'] = $dateFrom;
        }

        $dateTo = $request->query('date_to');
        if (!empty($dateTo) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
            $where[] = 't.txn_date <= :date_to';
            $params[':date_to'] = $dateTo;
        }

        // Amount range
        $minAmount = $request->query('min_amount');
        if ($minAmount !== null && is_numeric($minAmount)) {
            $where[] = 't.amount >= :min_amount';
            $params[':min_amount'] = (float)$minAmount;
        }

        $maxAmount = $request->query('max_amount');
        if ($maxAmount !== null && is_numeric($maxAmount)) {
            $where[] = 't.amount <= :max_amount';
            $params[':max_amount'] = (float)$maxAmount;
        }

        // Has bill filter
        $hasBill = $request->query('has_bill');
        if ($hasBill === '1' || $hasBill === 'true') {
            $where[] = 't.bill_file IS NOT NULL AND t.bill_file != ""';
        } elseif ($hasBill === '0' || $hasBill === 'false') {
            $where[] = '(t.bill_file IS NULL OR t.bill_file = "")';
        }

        // Free-text search (FR-LST-4 across description and category name)
        $q = trim((string)$request->query('q', ''));
        if (!empty($q)) {
            $where[] = '(t.description LIKE :query OR c.name LIKE :query)';
            $params[':query'] = '%' . $q . '%';
        }

        $whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        // 4. Calculate Aggregate Totals for Filtered Result Set (FR-LST-7)
        $totalsSql = "
            SELECT 
                COUNT(*) as total_count,
                COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) AS total_income,
                COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS total_expense
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            {$whereClause}
        ";
        $totalsStmt = $pdo->prepare($totalsSql);
        $totalsStmt->execute($params);
        $totalsRow = $totalsStmt->fetch();

        $totalRecords = (int)$totalsRow['total_count'];
        $totalIncome = (float)$totalsRow['total_income'];
        $totalExpense = (float)$totalsRow['total_expense'];
        $net = $totalIncome - $totalExpense;
        $totalPages = (int)ceil($totalRecords / $perPage);

        // 5. Query Paginated Records
        $querySql = "
            SELECT 
                t.id, t.type, t.category_id, t.amount, t.payment_mode,
                t.description, t.txn_date, t.bill_file, t.bill_original_name,
                t.created_by, t.updated_by, t.created_at, t.updated_at,
                c.name AS category_name,
                u.name AS creator_name
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            LEFT JOIN users u ON u.id = t.created_by
            {$whereClause}
            ORDER BY {$orderBySql}
            LIMIT {$perPage} OFFSET {$offset}
        ";

        $dataStmt = $pdo->prepare($querySql);
        $dataStmt->execute($params);
        $rows = $dataStmt->fetchAll();

        // Format numerical & boolean fields
        foreach ($rows as &$row) {
            $row['id'] = (int)$row['id'];
            $row['category_id'] = (int)$row['category_id'];
            $row['amount'] = (float)$row['amount'];
            $row['has_bill'] = !empty($row['bill_file']);
        }

        Response::json($rows, [
            'pagination' => [
                'page'          => $page,
                'per_page'      => $perPage,
                'total_records' => $totalRecords,
                'total_pages'   => $totalPages,
            ],
            'totals'     => [
                'income'  => $totalIncome,
                'expense' => $totalExpense,
                'net'     => $net,
            ],
        ]);
    }

    /**
     * GET /api/v1/transactions/{id}
     */
    public function show(Request $request, array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare('
            SELECT 
                t.id, t.type, t.category_id, t.amount, t.payment_mode,
                t.description, t.txn_date, t.bill_file, t.bill_original_name,
                t.created_by, t.updated_by, t.created_at, t.updated_at,
                c.name AS category_name,
                u.name AS creator_name,
                up.name AS updater_name
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            LEFT JOIN users u ON u.id = t.created_by
            LEFT JOIN users up ON up.id = t.updated_by
            WHERE t.id = :id
            LIMIT 1
        ');
        $stmt->execute([':id' => $id]);
        $txn = $stmt->fetch();

        if (!$txn) {
            Response::notFound('Transaction not found.');
        }

        $txn['id'] = (int)$txn['id'];
        $txn['category_id'] = (int)$txn['category_id'];
        $txn['amount'] = (float)$txn['amount'];
        $txn['has_bill'] = !empty($txn['bill_file']);

        Response::json($txn);
    }

    /**
     * POST /api/v1/transactions (Admin only - FR-TXN-1, FR-TXN-2, FR-TXN-6, FR-TXN-7)
     */
    public function store(Request $request): void
    {
        $type = trim((string)$request->input('type', ''));
        $categoryId = (int)$request->input('category_id', 0);
        $amount = (float)$request->input('amount', 0);
        $paymentMode = trim((string)$request->input('payment_mode', 'Cash'));
        $description = trim((string)$request->input('description', ''));
        $txnDate = trim((string)$request->input('txn_date', ''));

        // Validation (FR-TXN-1, FR-TXN-2)
        $errors = [];
        if (!in_array($type, ['income', 'expense'], true)) {
            $errors['type'] = 'Transaction type must be "income" or "expense".';
        }

        if ($amount <= 0) {
            $errors['amount'] = 'Amount must be greater than zero.';
        }

        if (!in_array($paymentMode, self::ALLOWED_MODES, true)) {
            $errors['payment_mode'] = 'Invalid payment mode selected.';
        }

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $txnDate)) {
            $errors['txn_date'] = 'Transaction date must be a valid date (YYYY-MM-DD).';
        }

        // FR-TXN-2: Description optional for income, required for expense
        if ($type === 'expense' && empty($description)) {
            $errors['description'] = 'Description is required for expense transactions.';
        }

        $pdo = Database::getConnection();

        // Validate category exists and matches type (Section 5.2)
        $catStmt = $pdo->prepare('SELECT id, name, type, is_active FROM categories WHERE id = :id LIMIT 1');
        $catStmt->execute([':id' => $categoryId]);
        $category = $catStmt->fetch();

        if (!$category) {
            $errors['category_id'] = 'Selected category does not exist.';
        } elseif ($category['type'] !== $type) {
            $errors['category_id'] = "Selected category belongs to '{$category['type']}', not '{$type}'.";
        }

        if (!empty($errors)) {
            Response::error('Validation failed.', 'VALIDATION_FAILED', $errors, 422);
        }

        // Handle Bill File Upload if provided (FR-BILL-1 to FR-BILL-3)
        $uploadedFile = $request->file('bill');
        $storedBill = null;
        if ($uploadedFile) {
            $storedBill = FileService::storeBill($uploadedFile);
        }

        $userId = Auth::id();

        // Database Write in Transaction (Section 6.3)
        $newId = Database::transaction(function (PDO $db) use (
            $type, $categoryId, $amount, $paymentMode, $description, $txnDate, $storedBill, $userId
        ) {
            $stmt = $db->prepare('
                INSERT INTO transactions (
                    type, category_id, amount, payment_mode, description,
                    txn_date, bill_file, bill_original_name, created_by, created_at
                ) VALUES (
                    :type, :category_id, :amount, :payment_mode, :description,
                    :txn_date, :bill_file, :bill_original_name, :created_by, NOW()
                )
            ');

            $stmt->execute([
                ':type'               => $type,
                ':category_id'        => $categoryId,
                ':amount'             => $amount,
                ':payment_mode'       => $paymentMode,
                ':description'        => $description ?: null,
                ':txn_date'           => $txnDate,
                ':bill_file'          => $storedBill['filename'] ?? null,
                ':bill_original_name' => $storedBill['original_name'] ?? null,
                ':created_by'         => $userId,
            ]);

            return (int)$db->lastInsertId();
        });

        Audit::log($userId, 'CREATE', 'TRANSACTION', (string)$newId, [
            'type'         => $type,
            'amount'       => $amount,
            'category_id'  => $categoryId,
            'payment_mode' => $paymentMode,
            'txn_date'     => $txnDate,
            'has_bill'     => !empty($storedBill),
        ], $request->getIp(), $request->getUserAgent());

        Response::json([
            'id'                 => $newId,
            'type'               => $type,
            'category_id'        => $categoryId,
            'category_name'      => $category['name'],
            'amount'             => $amount,
            'payment_mode'       => $paymentMode,
            'description'        => $description,
            'txn_date'           => $txnDate,
            'bill_file'          => $storedBill['filename'] ?? null,
            'bill_original_name' => $storedBill['original_name'] ?? null,
        ], ['message' => ucfirst($type) . ' transaction created successfully.'], 201);
    }

    /**
     * POST / PUT /api/v1/transactions/{id} (Admin only - FR-TXN-3)
     */
    public function update(Request $request, array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $pdo = Database::getConnection();

        $fetchStmt = $pdo->prepare('SELECT * FROM transactions WHERE id = :id LIMIT 1');
        $fetchStmt->execute([':id' => $id]);
        $oldTxn = $fetchStmt->fetch();

        if (!$oldTxn) {
            Response::notFound('Transaction not found.');
        }

        $type = trim((string)$request->input('type', $oldTxn['type']));
        $categoryId = (int)$request->input('category_id', $oldTxn['category_id']);
        $amount = (float)$request->input('amount', $oldTxn['amount']);
        $paymentMode = trim((string)$request->input('payment_mode', $oldTxn['payment_mode']));
        $description = trim((string)$request->input('description', $oldTxn['description'] ?? ''));
        $txnDate = trim((string)$request->input('txn_date', $oldTxn['txn_date']));
        $removeBill = filter_var($request->input('remove_bill', false), FILTER_VALIDATE_BOOLEAN);

        $errors = [];
        if ($amount <= 0) {
            $errors['amount'] = 'Amount must be greater than zero.';
        }
        if (!in_array($paymentMode, self::ALLOWED_MODES, true)) {
            $errors['payment_mode'] = 'Invalid payment mode selected.';
        }
        if ($type === 'expense' && empty($description)) {
            $errors['description'] = 'Description is required for expense transactions.';
        }

        // Validate category
        $catStmt = $pdo->prepare('SELECT id, name, type FROM categories WHERE id = :id LIMIT 1');
        $catStmt->execute([':id' => $categoryId]);
        $category = $catStmt->fetch();

        if (!$category) {
            $errors['category_id'] = 'Selected category does not exist.';
        } elseif ($category['type'] !== $type) {
            $errors['category_id'] = "Selected category belongs to '{$category['type']}', not '{$type}'.";
        }

        if (!empty($errors)) {
            Response::error('Validation failed.', 'VALIDATION_FAILED', $errors, 422);
        }

        // Handle Bill File changes
        $uploadedFile = $request->file('bill');
        $newBillFile = $oldTxn['bill_file'];
        $newBillOriginal = $oldTxn['bill_original_name'];
        $oldBillToDelete = null;

        if ($uploadedFile) {
            $storedBill = FileService::storeBill($uploadedFile);
            $oldBillToDelete = $oldTxn['bill_file'];
            $newBillFile = $storedBill['filename'];
            $newBillOriginal = $storedBill['original_name'];
        } elseif ($removeBill) {
            $oldBillToDelete = $oldTxn['bill_file'];
            $newBillFile = null;
            $newBillOriginal = null;
        }

        $userId = Auth::id();

        Database::transaction(function (PDO $db) use (
            $id, $type, $categoryId, $amount, $paymentMode, $description, $txnDate,
            $newBillFile, $newBillOriginal, $userId
        ) {
            $stmt = $db->prepare('
                UPDATE transactions SET
                    type = :type,
                    category_id = :category_id,
                    amount = :amount,
                    payment_mode = :payment_mode,
                    description = :description,
                    txn_date = :txn_date,
                    bill_file = :bill_file,
                    bill_original_name = :bill_original_name,
                    updated_by = :updated_by,
                    updated_at = NOW()
                WHERE id = :id
            ');

            $stmt->execute([
                ':id'                 => $id,
                ':type'               => $type,
                ':category_id'        => $categoryId,
                ':amount'             => $amount,
                ':payment_mode'       => $paymentMode,
                ':description'        => $description ?: null,
                ':txn_date'           => $txnDate,
                ':bill_file'          => $newBillFile,
                ':bill_original_name' => $newBillOriginal,
                ':updated_by'         => $userId,
            ]);
        });

        // Unlink replaced or removed bill file from disk
        if ($oldBillToDelete) {
            FileService::deleteBill($oldBillToDelete);
        }

        Audit::log($userId, 'UPDATE', 'TRANSACTION', (string)$id, [
            'before' => [
                'type'   => $oldTxn['type'],
                'amount' => $oldTxn['amount'],
                'date'   => $oldTxn['txn_date'],
            ],
            'after'  => [
                'type'   => $type,
                'amount' => $amount,
                'date'   => $txnDate,
            ],
        ], $request->getIp(), $request->getUserAgent());

        Response::json([
            'id'                 => $id,
            'type'               => $type,
            'category_id'        => $categoryId,
            'category_name'      => $category['name'],
            'amount'             => $amount,
            'payment_mode'       => $paymentMode,
            'description'        => $description,
            'txn_date'           => $txnDate,
            'bill_file'          => $newBillFile,
            'bill_original_name' => $newBillOriginal,
        ], ['message' => 'Transaction updated successfully.']);
    }

    /**
     * DELETE /api/v1/transactions/{id} (Admin only - FR-TXN-4)
     */
    public function destroy(Request $request, array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare('SELECT id, type, amount, bill_file FROM transactions WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $txn = $stmt->fetch();

        if (!$txn) {
            Response::notFound('Transaction not found.');
        }

        $billFile = $txn['bill_file'];
        $userId = Auth::id();

        Database::transaction(function (PDO $db) use ($id) {
            $deleteStmt = $db->prepare('DELETE FROM transactions WHERE id = :id');
            $deleteStmt->execute([':id' => $id]);
        });

        // Remove attached bill file from private storage (FR-TXN-4)
        if ($billFile) {
            FileService::deleteBill($billFile);
        }

        Audit::log($userId, 'DELETE', 'TRANSACTION', (string)$id, [
            'type'     => $txn['type'],
            'amount'   => $txn['amount'],
            'had_bill' => !empty($billFile),
        ], $request->getIp(), $request->getUserAgent());

        Response::json(['message' => 'Transaction deleted successfully.']);
    }

    /**
     * GET /api/v1/transactions/{id}/bill (FR-BILL-4: Authenticated file stream)
     */
    public function streamBill(Request $request, array $params): void
    {
        $id = (int)($params['id'] ?? 0);
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare('SELECT id, bill_file, bill_original_name FROM transactions WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $txn = $stmt->fetch();

        if (!$txn || empty($txn['bill_file'])) {
            Response::notFound('No bill attachment associated with this transaction.');
        }

        $filePath = FileService::getBillPath($txn['bill_file']);
        if (!$filePath) {
            Response::notFound('Bill file not found on disk storage.');
        }

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($filePath) ?: 'application/octet-stream';
        $originalName = $txn['bill_original_name'] ?: basename($filePath);

        $download = filter_var($request->query('download', false), FILTER_VALIDATE_BOOLEAN);

        Response::streamFile($filePath, $originalName, $mime, !$download);
    }
}
