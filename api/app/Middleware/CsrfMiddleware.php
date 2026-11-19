<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;

/**
 * CSRF Protection Middleware (NFR-SEC-3)
 * Validates X-CSRF-Token header on all state-changing requests
 */
class CsrfMiddleware
{
    public function handle(Request $request): void
    {
        $method = $request->getMethod();

        // Safe HTTP methods do not require CSRF token
        if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
            return;
        }

        Auth::initSession();

        $token = $request->getCsrfToken();

        if (!Auth::validateCsrfToken($token)) {
            Response::error('Invalid or missing CSRF token.', 'CSRF_TOKEN_INVALID', [], 403);
        }
    }
}
