<?php

declare(strict_types=1);

namespace App\Core;

use App\Config\Database;
use PDO;
use Throwable;

/**
 * Centralized Audit Logging Service (SRS Section 3.11 & 5.1)
 */
class Audit
{
    public static function log(
        ?int $userId,
        string $action,
        string $entity,
        ?string $entityId = null,
        ?array $details = null,
        ?string $ip = null,
        ?string $userAgent = null
    ): void {
        try {
            $pdo = Database::getConnection();

            $clientIp = $ip ?? ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1');
            $ua = $userAgent ?? substr($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown', 0, 255);
            $detailsJson = $details !== null ? json_encode($details, JSON_UNESCAPED_UNICODE) : null;

            $stmt = $pdo->prepare('
                INSERT INTO audit_log (user_id, action, entity, entity_id, details, ip_address, user_agent, created_at)
                VALUES (:user_id, :action, :entity, :entity_id, :details, :ip_address, :user_agent, NOW())
            ');

            $stmt->execute([
                ':user_id'    => $userId,
                ':action'     => $action,
                ':entity'     => $entity,
                ':entity_id'  => $entityId,
                ':details'    => $detailsJson,
                ':ip_address' => $clientIp,
                ':user_agent' => $ua,
            ]);
        } catch (Throwable $e) {
            // Write to error log to ensure auditing failure doesn't silently break
            error_log("Failed to write to audit_log: " . $e->getMessage());
        }
    }
}
