<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Standardized JSON API Response Envelope (SRS Section 4.2)
 * format: { "data": ..., "meta": {...}, "error": null }
 */
class Response
{
    public static function json(mixed $data = null, array $meta = [], int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');

        echo json_encode([
            'data'  => $data,
            'meta'  => !empty($meta) ? $meta : null,
            'error' => null,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function error(
        string $message,
        string $code = 'BAD_REQUEST',
        array $fields = [],
        int $status = 400
    ): void {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');

        echo json_encode([
            'data'  => null,
            'meta'  => null,
            'error' => [
                'code'    => $code,
                'message' => $message,
                'fields'  => !empty($fields) ? $fields : null,
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function unauthorized(string $message = 'Authentication required.'): void
    {
        self::error($message, 'UNAUTHORIZED', [], 401);
    }

    public static function forbidden(string $message = 'You do not have permission to perform this action.'): void
    {
        self::error($message, 'FORBIDDEN', [], 403);
    }

    public static function notFound(string $message = 'Resource not found.'): void
    {
        self::error($message, 'NOT_FOUND', [], 404);
    }

    public static function serverError(string $message = 'An unexpected server error occurred.'): void
    {
        self::error($message, 'SERVER_ERROR', [], 500);
    }

    /**
     * Authenticated file stream for bills (FR-BILL-4)
     */
    public static function streamFile(string $filePath, string $filename, string $mimeType, bool $inline = true): void
    {
        if (!file_exists($filePath) || !is_readable($filePath)) {
            self::notFound('Attachment file not found on disk.');
        }

        $disposition = $inline ? 'inline' : 'attachment';
        header('Content-Type: ' . $mimeType);
        header('Content-Length: ' . filesize($filePath));
        header('Content-Disposition: ' . $disposition . '; filename="' . rawurlencode($filename) . '"');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: private, max-age=3600');

        readfile($filePath);
        exit;
    }
}
