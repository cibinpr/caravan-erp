<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Lightweight REST Router for Caravan Accounting API
 */
class Router
{
    private array $routes = [];

    public function get(string $path, array|callable $handler, array $middlewares = []): void
    {
        $this->addRoute('GET', $path, $handler, $middlewares);
    }

    public function post(string $path, array|callable $handler, array $middlewares = []): void
    {
        $this->addRoute('POST', $path, $handler, $middlewares);
    }

    public function put(string $path, array|callable $handler, array $middlewares = []): void
    {
        $this->addRoute('PUT', $path, $handler, $middlewares);
    }

    public function patch(string $path, array|callable $handler, array $middlewares = []): void
    {
        $this->addRoute('PATCH', $path, $handler, $middlewares);
    }

    public function delete(string $path, array|callable $handler, array $middlewares = []): void
    {
        $this->addRoute('DELETE', $path, $handler, $middlewares);
    }

    private function addRoute(string $method, string $path, array|callable $handler, array $middlewares): void
    {
        // Convert route pattern like /api/v1/users/{id} to regex
        $pattern = preg_replace('/\{([a-zA-Z0-9_]+)\}/', '(?P<$1>[^/]+)', $path);
        $regex = '#^' . $pattern . '$#';

        $this->routes[] = [
            'method'      => $method,
            'path'        => $path,
            'regex'       => $regex,
            'handler'     => $handler,
            'middlewares' => $middlewares,
        ];
    }

    public function dispatch(Request $request): void
    {
        $method = $request->getMethod();
        $path = $request->getPath();

        // Handle preflight OPTIONS request
        if ($method === 'OPTIONS') {
            http_response_code(204);
            exit;
        }

        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }

            if (preg_match($route['regex'], $path, $matches)) {
                // Extract named route parameters
                $params = [];
                foreach ($matches as $key => $val) {
                    if (is_string($key)) {
                        $params[$key] = $val;
                    }
                }

                // Execute middleware stack
                foreach ($route['middlewares'] as $middleware) {
                    if (is_callable($middleware)) {
                        $middleware($request);
                    } elseif (is_string($middleware) && class_exists($middleware)) {
                        $instance = new $middleware();
                        if (method_exists($instance, 'handle')) {
                            $instance->handle($request);
                        }
                    }
                }

                // Execute handler
                $handler = $route['handler'];
                if (is_callable($handler)) {
                    $handler($request, $params);
                    return;
                }

                if (is_array($handler) && count($handler) === 2) {
                    [$class, $action] = $handler;
                    $controller = new $class();
                    $controller->$action($request, $params);
                    return;
                }
            }
        }

        // No route matched
        Response::notFound("Endpoint not found: {$method} {$path}");
    }
}
