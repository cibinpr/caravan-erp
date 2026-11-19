/**
 * REST API Client for Caravan Accounting
 * Implements standard envelope handling and CSRF injection (SRS Section 4.2 & NFR-SEC-3)
 */

let csrfToken = null;

export function setCsrfToken(token) {
  csrfToken = token;
}

export function getCsrfToken() {
  return csrfToken;
}

const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(message, code = 'ERROR', fields = null, status = 400) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.fields = fields;
    this.status = status;
  }
}

export async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();

  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  // Attach CSRF token on mutating requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  // Handle JSON vs FormData
  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body === 'object') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const response = await fetch(url, {
    ...options,
    method,
    headers,
    body,
    credentials: 'include', // Send and receive session cookies (FR-AUTH-3)
  });

  // Extract fresh CSRF token from header if backend sends one
  const headerCsrf = response.headers.get('X-CSRF-Token');
  if (headerCsrf) {
    setCsrfToken(headerCsrf);
  }

  // Handle 401 Unauthorized
  if (response.status === 401 && !endpoint.includes('/auth/login')) {
    // Notify listeners or trigger logout
    window.dispatchEvent(new CustomEvent('caravan:unauthorized'));
  }

  // Parse JSON response
  let json;
  try {
    json = await response.json();
  } catch {
    throw new ApiError('Unexpected response from server.', 'INVALID_RESPONSE', null, response.status);
  }

  if (!response.ok || json.error) {
    const err = json.error || {};
    throw new ApiError(
      err.message || 'Request failed.',
      err.code || 'BAD_REQUEST',
      err.fields || null,
      response.status
    );
  }

  // Update CSRF token if returned in response data
  if (json.data && json.data.csrf_token) {
    setCsrfToken(json.data.csrf_token);
  }

  return {
    data: json.data,
    meta: json.meta,
  };
}

export const api = {
  get: (url, options) => request(url, { ...options, method: 'GET' }),
  post: (url, body, options) => request(url, { ...options, method: 'POST', body }),
  put: (url, body, options) => request(url, { ...options, method: 'PUT', body }),
  patch: (url, body, options) => request(url, { ...options, method: 'PATCH', body }),
  delete: (url, options) => request(url, { ...options, method: 'DELETE' }),
  upload: (url, formData, options) => request(url, { ...options, method: 'POST', body: formData }),
};
