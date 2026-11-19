<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;

/**
 * Ensures request is from an authenticated session (FR-AUTH-4)
 */
class AuthMiddleware
{
    public function handle(Request $request): void
    {
        Auth::initSession();

        if (!Auth::check()) {
            Response::unauthorized('Authentication required to access this resource.');
        }
    }
}
