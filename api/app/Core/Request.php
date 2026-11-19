<?php

declare(strict_types=1);

namespace App\Core;

/**
 * HTTP Request Abstraction for Caravan Accounting REST API
 */
class Request
{
    private string $method;
    private string $path;
    private array $queryParams;
    private array $body;
    private array $headers;
    private array $files;

    public function __construct()
    {
        $this->method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        
        // Strip query string from REQUEST_URI
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        $uriParts = explode('?', $uri, 2);
        $this->path = rawurldecode($uriParts[0]);

        $this->queryParams = $_GET;
        $this->headers = $this->extractHeaders();
        $this->files = $_FILES;
        $this->body = $this->parseBody();
    }

    public function getMethod(): string
    {
        return $this->method;
    }

    public function getPath(): string
    {
        return $this->path;
    }

    public function getQueryParams(): array
    {
        return $this->queryParams;
    }

    public function query(string $key, mixed $default = null): mixed
    {
        return $this->queryParams[$key] ?? $default;
    }

    public function all(): array
    {
        return $this->body;
    }

    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body[$key] ?? $default;
    }

    public function file(string $key): ?array
    {
        if (isset($this->files[$key]) && $this->files[$key]['error'] !== UPLOAD_ERR_NO_FILE) {
            return $this->files[$key];
        }
        return null;
    }

    public function getHeader(string $name): ?string
    {
        $nameLower = strtolower($name);
        return $this->headers[$nameLower] ?? null;
    }

    public function getCsrfToken(): ?string
    {
        return $this->getHeader('x-csrf-token') ?? $this->input('_csrf');
    }

    public function getIp(): string
    {
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $parts = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            return trim($parts[0]);
        }
        return $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    }

    public function getUserAgent(): string
    {
        return substr($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown', 0, 255);
    }

    private function parseBody(): array
    {
        if ($this->method === 'GET' || $this->method === 'HEAD') {
            return [];
        }

        $contentType = $this->getHeader('content-type') ?? '';

        if (str_contains($contentType, 'application/json')) {
            $rawInput = file_get_contents('php://input');
            if (empty($rawInput)) {
                return [];
            }
            $decoded = json_decode($rawInput, true);
            return is_array($decoded) ? $decoded : [];
        }

        // Standard multipart/form-data or form-urlencoded
        return $_POST;
    }

    private function extractHeaders(): array
    {
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $headerName = strtolower(str_replace('_', '-', substr($key, 5)));
                $headers[$headerName] = $value;
            } elseif (in_array($key, ['CONTENT_TYPE', 'CONTENT_LENGTH'])) {
                $headerName = strtolower(str_replace('_', '-', $key));
                $headers[$headerName] = $value;
            }
        }
        return $headers;
    }
}
