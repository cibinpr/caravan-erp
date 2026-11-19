<?php

declare(strict_types=1);

namespace App\Services;

use App\Config\Config;
use App\Core\Response;
use finfo;
use RuntimeException;

/**
 * File Service for Secure Bill / Receipt Attachments (SRS Section 3.6)
 */
class FileService
{
    private const ALLOWED_MIMES = [
        'image/jpeg'      => 'jpg',
        'image/png'       => 'png',
        'application/pdf' => 'pdf',
    ];

    public static function getStorageDir(): string
    {
        $base = Config::get('STORAGE_PATH', dirname(__DIR__, 3) . '/storage');
        $billsDir = rtrim($base, '/\\') . '/bills';

        if (!is_dir($billsDir)) {
            @mkdir($billsDir, 0750, true);
        }

        return $billsDir;
    }

    /**
     * Validates and saves an uploaded bill receipt (FR-BILL-1, FR-BILL-2, FR-BILL-3)
     */
    public static function storeBill(array $file): array
    {
        if ($file['error'] !== UPLOAD_ERR_OK) {
            throw new RuntimeException("Upload failed with error code: {$file['error']}");
        }

        // Validate file size (FR-BILL-2: Default 5 MB)
        $maxBytes = (int)Config::get('MAX_BILL_FILE_SIZE_MB', 5) * 1024 * 1024;
        if ($file['size'] > $maxBytes) {
            Response::error(
                "File exceeds maximum allowed size of " . Config::get('MAX_BILL_FILE_SIZE_MB', 5) . " MB.",
                'FILE_TOO_LARGE',
                ['bill' => 'File size exceeds 5 MB limit.'],
                422
            );
        }

        // Validate MIME type via magic bytes / fileinfo (FR-BILL-1)
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $detectedMime = $finfo->file($file['tmp_name']);

        if (!isset(self::ALLOWED_MIMES[$detectedMime])) {
            Response::error(
                "Invalid file type '{$detectedMime}'. Only JPG, PNG, and PDF files are allowed.",
                'INVALID_FILE_TYPE',
                ['bill' => 'Allowed formats are JPG, PNG, and PDF only.'],
                422
            );
        }

        $extension = self::ALLOWED_MIMES[$detectedMime];
        // Generate random, unguessable filename (FR-BILL-3)
        $randomName = bin2hex(random_bytes(20)) . '_' . time() . '.' . $extension;
        $targetPath = self::getStorageDir() . '/' . $randomName;

        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            throw new RuntimeException("Failed to move uploaded bill to private storage.");
        }

        // Set secure permissions (read/write only by owner)
        @chmod($targetPath, 0640);

        return [
            'filename'      => $randomName,
            'original_name' => basename($file['name']),
            'mime'          => $detectedMime,
            'size'          => $file['size'],
        ];
    }

    public static function deleteBill(?string $filename): bool
    {
        if (empty($filename)) {
            return false;
        }

        // Prevent directory traversal attacks
        $safeName = basename($filename);
        $filePath = self::getStorageDir() . '/' . $safeName;

        if (file_exists($filePath)) {
            return @unlink($filePath);
        }

        return false;
    }

    public static function getBillPath(?string $filename): ?string
    {
        if (empty($filename)) {
            return null;
        }

        $safeName = basename($filename);
        $filePath = self::getStorageDir() . '/' . $safeName;

        return file_exists($filePath) ? $filePath : null;
    }
}
