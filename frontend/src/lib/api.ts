function defaultApiUrl(): string {
  if (typeof window === 'undefined') {
    // Server-side (SSR / Route Handler / API route):
    // In Docker, localhost inside Next.js container != backend.
    // Use host.docker.internal so server-side fetch reaches the backend container.
    return 'http://host.docker.internal:3001';
  }

  try {
    const url = new URL(window.location.href);
    url.port = '3001';
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return url.origin;
  } catch {
    return 'http://localhost:3001';
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || defaultApiUrl();

declare global {
  interface Window {
    __lastTraceId__?: string;
    __authToken__?: string;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
    /** Trace ID from the failing response, if the server emitted one. */
    public readonly traceId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function parseErrorMessage(body: unknown): string {
  if (body == null || typeof body !== 'object') {
    return 'Request failed';
  }
  const b = body as Record<string, unknown>;
  const m = b.message;
  if (typeof m === 'string') return m;
  if (Array.isArray(m)) return m.map(String).join(', ');
  if (typeof b.error === 'string') return b.error;
  return 'Request failed';
}

interface RequestOptions extends RequestInit {
  token?: string;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    // Persist so the error logger can include it without needing the store
    window.__authToken__ = token;
  }

  // Forward the last trace ID so the backend can correlate with the originating request
  if (window.__lastTraceId__) {
    headers['X-Trace-Id'] = window.__lastTraceId__;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  // Capture trace ID from every response so subsequent errors are correlated
  const traceId = response.headers.get('x-trace-id');
  if (traceId) {
    window.__lastTraceId__ = traceId;
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');
  const body = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    throw new ApiError(parseErrorMessage(body), response.status, body, traceId ?? undefined);
  }

  if (response.status === 204 || !isJson) {
    return undefined as T;
  }

  return body as T;
}

export const api = {
  get: <T>(endpoint: string, token?: string) =>
    request<T>(endpoint, { method: 'GET', token }),

  post: <T>(endpoint: string, data?: unknown, token?: string) =>
    request<T>(endpoint, {
      method: 'POST',
      body: data !== undefined ? JSON.stringify(data) : undefined,
      token,
    }),

  put: <T>(endpoint: string, data?: unknown, token?: string) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: data !== undefined ? JSON.stringify(data) : undefined,
      token,
    }),

  patch: <T>(endpoint: string, data?: unknown, token?: string) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: data !== undefined ? JSON.stringify(data) : undefined,
      token,
    }),

  delete: <T>(endpoint: string, token?: string) =>
    request<T>(endpoint, { method: 'DELETE', token }),
};
