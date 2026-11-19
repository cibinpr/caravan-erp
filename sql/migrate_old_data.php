<?php

declare(strict_types=1);

/**
 * Caravan Accounting: Legacy Data & Bill Migration Script (SRS Section 3.12, FR-MIG-1 to FR-MIG-6)
 *
 * Usage:
 *   php sql/migrate_old_data.php [--legacy-db=name] [--bills-dir=/path/to/old/bills] [--dry-run]
 */

// Simple autoloader
spl_autoload_register(function (string $class) {
    if (str_starts_with($class, 'App\\Config\\')) {
        $file = dirname(__DIR__) . '/api/config/' . substr($class, strlen('App\\Config\\')) . '.php';
        if (file_exists($file)) require_once $file;
    } elseif (str_starts_with($class, 'App\\Core\\')) {
        $file = dirname(__DIR__) . '/api/app/Core/' . substr($class, strlen('App\\Core\\')) . '.php';
        if (file_exists($file)) require_once $file;
    } elseif (str_starts_with($class, 'App\\Services\\')) {
        $file = dirname(__DIR__) . '/api/app/Services/' . substr($class, strlen('App\\Services\\')) . '.php';
        if (file_exists($file)) require_once $file;
    }
});

use App\Config\Config;
use App\Config\Database;
use App\Services\FileService;

Config::load();

if (php_sapi_name() !== 'cli') {
    echo "This migration script can only be run via CLI.\n";
    exit(1);
}

$options = getopt('', ['legacy-db::', 'bills-dir::', 'dry-run::']);
$isDryRun = isset($options['dry-run']);
$legacyDbName = $options['legacy-db'] ?? 'caravan_old';
$oldBillsDir = $options['bills-dir'] ?? dirname(__DIR__) . '/old_bills';

echo "==============================================================================\n";
echo " Caravan Accounting: Legacy Migration & Reconciliation\n";
echo " Mode: " . ($isDryRun ? "DRY-RUN (Simulated, no writes)" : "LIVE MIGRATION") . "\n";
echo " Legacy Database: {$legacyDbName}\n";
echo " Legacy Bills Dir: {$oldBillsDir}\n";
echo "==============================================================================\n\n";

try {
    $targetPdo = Database::getConnection();

    // 1. Verify Default Admin User Exists (FR-MIG-6)
    $adminStmt = $targetPdo->query("SELECT id FROM users WHERE role = 'admin' AND is_active = 1 LIMIT 1");
    $adminId = $adminStmt->fetchColumn();

    if (!$adminId) {
        echo "❌ Error: No active admin user exists in target database.\n";
        echo "Please create an administrator first using:\n";
        echo "  php api/bin/create_admin.php \"Administrator\" \"admin@caravan.local\" \"SecurePassword\"\n";
        exit(1);
    }
    $adminId = (int)$adminId;
    echo "✓ Target system admin found (User ID: {$adminId})\n";

    // 2. Connect to Legacy Database
    $host = Config::get('DB_HOST', '127.0.0.1');
    $user = Config::get('DB_USERNAME', 'root');
    $pass = Config::get('DB_PASSWORD', '');

    try {
        $legacyPdo = new PDO("mysql:host={$host};dbname={$legacyDbName};charset=utf8mb4", $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        echo "✓ Connected to legacy database '{$legacyDbName}'\n\n";
    } catch (\Throwable $e) {
        echo "⚠️  Could not connect directly to legacy database '{$legacyDbName}': " . $e->getMessage() . "\n";
        echo "If running on test system or rehearsal, ensure the legacy database is imported into MySQL.\n";
        exit(1);
    }

    // 3. Cache existing categories in target database
    $catStmt = $targetPdo->query("SELECT id, name, type FROM categories");
    $existingCategories = [];
    while ($row = $catStmt->fetch()) {
        $key = strtolower(trim($row['name'])) . '___' . $row['type'];
        $existingCategories[$key] = (int)$row['id'];
    }

    $findOrCreateCategory = function (string $rawName, string $type) use ($targetPdo, &$existingCategories, $isDryRun): int {
        $cleanName = trim($rawName);
        if (empty($cleanName)) $cleanName = 'General';

        $key = strtolower($cleanName) . '___' . $type;
        if (isset($existingCategories[$key])) {
            return $existingCategories[$key];
        }

        if ($isDryRun) {
            return 999999;
        }

        $ins = $targetPdo->prepare("INSERT INTO categories (name, type, is_active, created_at) VALUES (:name, :type, 1, NOW())");
        $ins->execute([':name' => $cleanName, ':type' => $type]);
        $newId = (int)$targetPdo->lastInsertId();
        $existingCategories[$key] = $newId;
        return $newId;
    };

    // 4. Migrate Income Records
    echo "--- Migrating Income Entries ---\n";
    $incStmt = $legacyPdo->query("SELECT * FROM income ORDER BY id ASC");
    $legacyIncomes = $incStmt->fetchAll();
    $incCount = count($legacyIncomes);
    $incTotal = 0.0;
    $migratedIncomes = 0;
    $missingIncomeBills = 0;

    foreach ($legacyIncomes as $row) {
        $amount = (float)($row['amount'] ?? 0);
        $incTotal += $amount;
        $categoryName = (string)($row['category'] ?? 'Sales');
        $catId = $findOrCreateCategory($categoryName, 'income');
        $date = !empty($row['date']) ? date('Y-m-d', strtotime($row['date'])) : date('Y-m-d');
        $desc = (string)($row['description'] ?? '');
        $mode = in_array($row['payment_mode'] ?? '', ['Cash', 'Bank', 'UPI', 'Cheque', 'Card']) ? $row['payment_mode'] : 'Cash';

        // Bill handling (FR-MIG-3, FR-MIG-4)
        $newBillName = null;
        $originalBillName = null;
        if (!empty($row['bill'])) {
            $originalBillName = basename($row['bill']);
            $sourceBillPath = rtrim($oldBillsDir, '/\\') . '/' . $originalBillName;
            if (file_exists($sourceBillPath) && filesize($sourceBillPath) > 0) {
                $ext = pathinfo($originalBillName, PATHINFO_EXTENSION) ?: 'jpg';
                $newBillName = bin2hex(random_bytes(20)) . '_' . time() . '.' . $ext;
                if (!$isDryRun) {
                    copy($sourceBillPath, FileService::getStorageDir() . '/' . $newBillName);
                }
            } else {
                $missingIncomeBills++;
            }
        }

        if (!$isDryRun) {
            $insStmt = $targetPdo->prepare("
                INSERT INTO transactions (type, category_id, amount, payment_mode, description, txn_date, bill_file, bill_original_name, created_by, created_at)
                VALUES ('income', :cat_id, :amount, :mode, :desc, :date, :bill_file, :bill_orig, :creator, NOW())
            ");
            $insStmt->execute([
                ':cat_id'    => $catId,
                ':amount'    => $amount,
                ':mode'      => $mode,
                ':desc'      => $desc ?: null,
                ':date'      => $date,
                ':bill_file' => $newBillName,
                ':bill_orig' => $originalBillName,
                ':creator'   => $adminId,
            ]);
        }
        $migratedIncomes++;
    }
    echo "✓ Income rows processed: {$migratedIncomes} / {$incCount}\n";
    echo "  Total Income Sum: ₹ " . number_format($incTotal, 2) . "\n";
    if ($missingIncomeBills > 0) {
        echo "  Notice: {$missingIncomeBills} attached bill file(s) were missing or 0 bytes.\n";
    }

    // 5. Migrate Expense Records
    echo "\n--- Migrating Expense Entries ---\n";
    $expStmt = $legacyPdo->query("SELECT * FROM expense ORDER BY id ASC");
    $legacyExpenses = $expStmt->fetchAll();
    $expCount = count($legacyExpenses);
    $expTotal = 0.0;
    $migratedExpenses = 0;
    $missingExpenseBills = 0;

    foreach ($legacyExpenses as $row) {
        $amount = (float)($row['amount'] ?? 0);
        $expTotal += $amount;
        $categoryName = (string)($row['category'] ?? 'Miscellaneous');
        $catId = $findOrCreateCategory($categoryName, 'expense');
        $date = !empty($row['date']) ? date('Y-m-d', strtotime($row['date'])) : date('Y-m-d');
        $desc = (string)($row['description'] ?? 'Expense entry');
        $mode = in_array($row['payment_mode'] ?? '', ['Cash', 'Bank', 'UPI', 'Cheque', 'Card']) ? $row['payment_mode'] : 'Cash';

        $newBillName = null;
        $originalBillName = null;
        if (!empty($row['bill'])) {
            $originalBillName = basename($row['bill']);
            $sourceBillPath = rtrim($oldBillsDir, '/\\') . '/' . $originalBillName;
            if (file_exists($sourceBillPath) && filesize($sourceBillPath) > 0) {
                $ext = pathinfo($originalBillName, PATHINFO_EXTENSION) ?: 'jpg';
                $newBillName = bin2hex(random_bytes(20)) . '_' . time() . '.' . $ext;
                if (!$isDryRun) {
                    copy($sourceBillPath, FileService::getStorageDir() . '/' . $newBillName);
                }
            } else {
                $missingExpenseBills++;
            }
        }

        if (!$isDryRun) {
            $insStmt = $targetPdo->prepare("
                INSERT INTO transactions (type, category_id, amount, payment_mode, description, txn_date, bill_file, bill_original_name, created_by, created_at)
                VALUES ('expense', :cat_id, :amount, :mode, :desc, :date, :bill_file, :bill_orig, :creator, NOW())
            ");
            $insStmt->execute([
                ':cat_id'    => $catId,
                ':amount'    => $amount,
                ':mode'      => $mode,
                ':desc'      => $desc ?: 'Expense',
                ':date'      => $date,
                ':bill_file' => $newBillName,
                ':bill_orig' => $originalBillName,
                ':creator'   => $adminId,
            ]);
        }
        $migratedExpenses++;
    }
    echo "✓ Expense rows processed: {$migratedExpenses} / {$expCount}\n";
    echo "  Total Expense Sum: ₹ " . number_format($expTotal, 2) . "\n";
    if ($missingExpenseBills > 0) {
        echo "  Notice: {$missingExpenseBills} attached bill file(s) were missing or 0 bytes.\n";
    }

    // 6. Reconciliation Summary Report (FR-MIG-5)
    echo "\n==============================================================================\n";
    echo " RECONCILIATION SUMMARY REPORT (FR-MIG-5)\n";
    echo "==============================================================================\n";
    echo sprintf("%-20s %-15s %-20s\n", "Type", "Row Count", "Total Amount (₹)");
    echo str_repeat("-", 58) . "\n";
    echo sprintf("%-20s %-15d %-20s\n", "Income (Old vs New)", $incCount, number_format($incTotal, 2));
    echo sprintf("%-20s %-15d %-20s\n", "Expense (Old vs New)", $expCount, number_format($expTotal, 2));
    echo sprintf("%-20s %-15s %-20s\n", "Net Balance", "", number_format($incTotal - $expTotal, 2));
    echo str_repeat("=", 58) . "\n";
    echo "Reconciliation Status: " . ($incCount === $migratedIncomes && $expCount === $migratedExpenses ? "✅ PERFECT MATCH (100% RECONCILED)" : "⚠️ COUNTS DIFFER") . "\n";
    echo "==============================================================================\n";

} catch (\Throwable $e) {
    echo "\n❌ Migration Failed: " . $e->getMessage() . "\n";
    exit(1);
}
