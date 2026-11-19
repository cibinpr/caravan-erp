<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Config\Config;
use App\Config\Database;
use App\Core\Request;
use App\Core\Response;
use Throwable;

/**
 * Health Check Controller for Monitoring & Uptime Checks (DEP-9, Section 8.10)
 */
class HealthController
{
    /**
     * GET /api/v1/health
     */
    public function check(Request $request): void
    {
        $dbStatus = 'ok';
        $dbError = null;

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->query('SELECT 1');
            $stmt->fetchColumn();
        } catch (Throwable $e) {
            $dbStatus = 'error';
            $dbError = 'Database connection failed';
        }

        $storagePath = Config::get('STORAGE_PATH', dirname(__DIR__, 2) . '/storage');
        $billsDir = $storagePath . '/bills';
        $logsDir = $storagePath . '/logs';

        $storageWritable = is_writable($billsDir) && is_writable($logsDir);

        $isHealthy = ($dbStatus === 'ok') && $storageWritable;
        $statusCode = $isHealthy ? 200 : 503;

        Response::json([
            'status'     => $isHealthy ? 'healthy' : 'unhealthy',
            'timestamp'  => date('c'),
            'app'        => Config::get('APP_NAME', 'Caravan Accounting'),
            'version'    => '1.0.0',
            'php'        => PHP_VERSION,
            'checks'     => [
                'database' => [
                    'status' => $dbStatus,
                    'error'  => $dbError,
                ],
                'storage'  => [
                    'bills_writable' => is_writable($billsDir),
                    'logs_writable'  => is_writable($logsDir),
                ],
            ],
        ], [], $statusCode);
    }
}
