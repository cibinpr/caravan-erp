<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;

/**
 * Role-Based Access Control Middleware (SRS Section 3.3)
 * Enforces role restrictions at the API level (FR-RBAC-1, FR-RBAC-2)
 */
class RoleMiddleware
{
    private string $requiredRole;

    public function __construct(string $requiredRole = 'admin')
    {
        $this->requiredRole = $requiredRole;
    }

    public static function adminOnly(): callable
    {
        return function (Request $request) {
            Auth::initSession();
            if (!Auth::check()) {
                Response::unauthorized();
            }
            if (!Auth::isAdmin()) {
                Response::forbidden('Admin privileges required for this action.');
            }
        };
    }

    public static function readOnlyAllowed(): callable
    {
        return function (Request $request) {
            Auth::initSession();
            if (!Auth::check()) {
                Response::unauthorized();
            }
            // If request attempts to write (POST/PUT/PATCH/DELETE) and user is only viewer, forbid it (FR-RBAC-2)
            $method = $request->getMethod();
            if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true) && Auth::isViewer()) {
                Response::forbidden('Viewers have read-only permissions and cannot modify data.');
            }
        };
    }

    public function handle(Request $request): void
    {
        Auth::initSession();
        if (!Auth::check()) {
            Response::unauthorized();
        }

        if (Auth::role() !== $this->requiredRole) {
            Response::forbidden("Action requires '{$this->requiredRole}' role.");
        }
    }
}
