<?php

declare(strict_types=1);

/**
 * Caravan Accounting REST API - Front Controller
 * Base Path: /api/v1
 */

// Simple PSR-4 Autoloader
spl_autoload_register(function (string $class) {
    $prefix = 'App\\';
    $baseDir = dirname(__DIR__) . '/app/';

    if (str_starts_with($class, 'App\\Config\\')) {
        $file = dirname(__DIR__) . '/config/' . substr($class, strlen('App\\Config\\')) . '.php';
        if (file_exists($file)) {
            require_once $file;
            return;
        }
    }

    if (str_starts_with($class, $prefix)) {
        $relativeClass = substr($class, strlen($prefix));
        $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';
        if (file_exists($file)) {
            require_once $file;
        }
    }
});

use App\Config\Config;
use App\Core\Request;
use App\Core\Response;
use App\Core\Router;

// Load Configuration and Error settings
Config::load();

// Global Exception & Fatal Error Handler
set_exception_handler(function (\Throwable $e) {
    error_log("Unhandled Exception [{$e->getCode()}]: {$e->getMessage()} in {$e->getFile()}:{$e->getLine()}");
    
    $isDebug = filter_var(Config::get('APP_DEBUG', false), FILTER_VALIDATE_BOOLEAN);
    $message = $isDebug ? $e->getMessage() : 'An unexpected internal server error occurred.';
    $code = $isDebug ? (string)$e->getCode() : 'INTERNAL_SERVER_ERROR';

    Response::error($message, $code, [], 500);
});

// Security Headers (NFR-SEC-5)
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('X-XSS-Protection: 1; mode=block');

// CORS Handling for Vite dev server / production SPA (Section 4.4)
$appUrl = rtrim(Config::get('APP_URL', 'http://localhost:5173'), '/');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (!empty($origin)) {
    // In production, enforce origin match; in local dev allow localhost Vite
    $isAllowed = ($origin === $appUrl) || 
                 (Config::get('APP_ENV') === 'local' && str_starts_with($origin, 'http://localhost:'));

    if ($isAllowed) {
        header("Access-Control-Allow-Origin: {$origin}");
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token, X-Requested-With');
    }
}

// Handle preflight OPTIONS
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Instantiate Request and Router
$request = new Request();
$router = new Router();

// Load Routes
require dirname(__DIR__) . '/routes/api.php';

// Dispatch Request
$router->dispatch($request);
