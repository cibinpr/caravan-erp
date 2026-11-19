<?php

declare(strict_types=1);

use App\Controllers\AuthController;
use App\Controllers\AuditController;
use App\Controllers\CategoryController;
use App\Controllers\DashboardController;
use App\Controllers\HealthController;
use App\Controllers\LedgerController;
use App\Controllers\ReportController;
use App\Controllers\TransactionController;
use App\Controllers\UserController;
use App\Core\Router;
use App\Middleware\AuthMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Middleware\RoleMiddleware;

/**
 * Route Definitions for Caravan Accounting REST API (/api/v1)
 *
 * @var Router $router
 */

// 1. System & Monitoring (DEP-9)
$router->get('/api/v1/health', [HealthController::class, 'check']);

// 2. Authentication (SRS Section 3.1)
$router->post('/api/v1/auth/login', [AuthController::class, 'login']);
$router->post('/api/v1/auth/logout', [AuthController::class, 'logout'], [CsrfMiddleware::class]);
$router->get('/api/v1/auth/me', [AuthController::class, 'me'], [AuthMiddleware::class]);
$router->post('/api/v1/auth/change-password', [AuthController::class, 'changePassword'], [
    AuthMiddleware::class,
    CsrfMiddleware::class,
]);

// 3. Categories Management (SRS Section 3.4)
$router->get('/api/v1/categories', [CategoryController::class, 'index'], [AuthMiddleware::class]);
$router->post('/api/v1/categories', [CategoryController::class, 'store'], [
    AuthMiddleware::class,
    RoleMiddleware::adminOnly(),
    CsrfMiddleware::class,
]);
$router->put('/api/v1/categories/{id}', [CategoryController::class, 'update'], [
    AuthMiddleware::class,
    RoleMiddleware::adminOnly(),
    CsrfMiddleware::class,
]);
$router->patch('/api/v1/categories/{id}/active', [CategoryController::class, 'toggleActive'], [
    AuthMiddleware::class,
    RoleMiddleware::adminOnly(),
    CsrfMiddleware::class,
]);
$router->delete('/api/v1/categories/{id}', [CategoryController::class, 'destroy'], [
    AuthMiddleware::class,
    RoleMiddleware::adminOnly(),
    CsrfMiddleware::class,
]);

// 4. Transactions Management & Bills (SRS Section 3.5, 3.6, 3.7)
$router->get('/api/v1/transactions', [TransactionController::class, 'index'], [AuthMiddleware::class]);
$router->post('/api/v1/transactions', [TransactionController::class, 'store'], [
    AuthMiddleware::class,
    RoleMiddleware::adminOnly(),
    CsrfMiddleware::class,
]);
$router->get('/api/v1/transactions/{id}', [TransactionController::class, 'show'], [AuthMiddleware::class]);
$router->post('/api/v1/transactions/{id}', [TransactionController::class, 'update'], [
    AuthMiddleware::class,
    RoleMiddleware::adminOnly(),
    CsrfMiddleware::class,
]);
$router->put('/api/v1/transactions/{id}', [TransactionController::class, 'update'], [
    AuthMiddleware::class,
    RoleMiddleware::adminOnly(),
    CsrfMiddleware::class,
]);
$router->delete('/api/v1/transactions/{id}', [TransactionController::class, 'destroy'], [
    AuthMiddleware::class,
    RoleMiddleware::adminOnly(),
    CsrfMiddleware::class,
]);
$router->get('/api/v1/transactions/{id}/bill', [TransactionController::class, 'streamBill'], [AuthMiddleware::class]);

// 5. Dashboard Aggregations (SRS Section 3.8)
$router->get('/api/v1/dashboard/summary', [DashboardController::class, 'summary'], [AuthMiddleware::class]);
$router->get('/api/v1/dashboard/recent', [DashboardController::class, 'recent'], [AuthMiddleware::class]);
$router->get('/api/v1/dashboard/monthly', [DashboardController::class, 'monthly'], [AuthMiddleware::class]);
$router->get('/api/v1/dashboard/by-category', [DashboardController::class, 'byCategory'], [AuthMiddleware::class]);

// 6. Account Ledger (SRS Section 3.9)
$router->get('/api/v1/ledger', [LedgerController::class, 'index'], [AuthMiddleware::class]);

// 7. Reports & Statements (SRS Section 3.10)
$router->get('/api/v1/reports/monthly', [ReportController::class, 'monthly'], [AuthMiddleware::class]);
$router->get('/api/v1/reports/range', [ReportController::class, 'range'], [AuthMiddleware::class]);
$router->get('/api/v1/reports/yearly', [ReportController::class, 'yearly'], [AuthMiddleware::class]);

// 8. User Management (SRS Section 3.2 - Admin Only)
$router->get('/api/v1/users', [UserController::class, 'index'], [
    AuthMiddleware::class,
    RoleMiddleware::adminOnly(),
]);
$router->post('/api/v1/users', [UserController::class, 'store'], [
    AuthMiddleware::class,
    RoleMiddleware::adminOnly(),
    CsrfMiddleware::class,
]);
$router->get('/api/v1/users/{id}', [UserController::class, 'show'], [
    AuthMiddleware::class,
    RoleMiddleware::adminOnly(),
]);
$router->put('/api/v1/users/{id}', [UserController::class, 'update'], [
    AuthMiddleware::class,
    RoleMiddleware::adminOnly(),
    CsrfMiddleware::class,
]);
$router->patch('/api/v1/users/{id}/active', [UserController::class, 'toggleActive'], [
    AuthMiddleware::class,
    RoleMiddleware::adminOnly(),
    CsrfMiddleware::class,
]);
$router->post('/api/v1/users/{id}/reset-password', [UserController::class, 'resetPassword'], [
    AuthMiddleware::class,
    RoleMiddleware::adminOnly(),
    CsrfMiddleware::class,
]);
$router->delete('/api/v1/users/{id}', [UserController::class, 'destroy'], [
    AuthMiddleware::class,
    RoleMiddleware::adminOnly(),
    CsrfMiddleware::class,
]);

// 9. Audit Log (SRS Section 3.11 - Admin Only)
$router->get('/api/v1/audit-log', [AuditController::class, 'index'], [
    AuthMiddleware::class,
    RoleMiddleware::adminOnly(),
]);
