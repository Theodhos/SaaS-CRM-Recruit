import type { ApiResponse } from '@crm/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

async function unwrap<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const json = (await response.json()) as ApiResponse<T>;

  if (!json.success) {
    throw new ApiClientError(json.error.message, json.error.code, response.status, json.requestId);
  }

  return json.data;
}

/**
 * Single fetch wrapper every service/* module goes through. Unwraps the
 * shared ApiResponse envelope (see @crm/types and apps/api's
 * ResponseEnvelopeInterceptor/HttpExceptionFilter) so callers get plain
 * data or a typed ApiClientError, never a raw Response to re-parse.
 */
export async function apiClient<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const send = () =>
    fetch(`${API_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        // Only requests that actually carry a JSON body declare a JSON content
        // type. Sending it on bodiless GETs turns every read into a CORS
        // "non-simple" request, which costs an extra OPTIONS preflight round trip.
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

  return unwrap<T>(await withSessionRefresh(path, send));
}

const RETRY_AFTER_MS = [800, 2000];

/**
 * fetch() rejects ("Failed to fetch") when the server cannot be reached at all — it is restarting, or the network
 * dropped for a moment. The request never arrived, so it is safe to send again: twice more, a little later each
 * time. If it still fails, the caller gets an ApiClientError with words a person can read.
 */
async function reachServer(request: () => Promise<Response>): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      const wait = RETRY_AFTER_MS[attempt];
      if (wait === undefined) throw new ApiClientError('The server cannot be reached right now. Check your connection and try again.', 'NETWORK_ERROR', 0);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Silent session refresh. The access cookie expires after 15 minutes while the refresh cookie lasts 7 days; a 401 on
 * a normal call therefore usually means "access token expired", not "signed out". Refresh once (shared across
 * concurrent calls), retry the original request, and only send the user to /login when the refresh itself fails.
 */
async function withSessionRefresh(path: string, request: () => Promise<Response>): Promise<Response> {
  const send = () => reachServer(request);
  const first = await send();
  if (first.status !== 401 || path.startsWith('/auth/')) return first;

  refreshInFlight ??= fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  const refreshed = await refreshInFlight;
  if (!refreshed) {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.assign(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`);
    }
    return first;
  }
  return send();
}

/**
 * Multipart upload variant of apiClient — no Content-Type header (the
 * browser sets the multipart boundary itself), body is a FormData.
 */
export async function apiUpload<T>(path: string, formData: FormData, method: 'POST' | 'PUT' = 'POST'): Promise<T> {
  const send = () =>
    fetch(`${API_URL}${path}`, {
      method,
      credentials: 'include',
      body: formData,
    });

  return unwrap<T>(await withSessionRefresh(path, send));
}

/** A file served by the API (not the JSON envelope), e.g. a document preview. Errors still arrive as the envelope. */
export async function apiBlob(path: string): Promise<Blob> {
  const response = await withSessionRefresh(path, () => fetch(`${API_URL}${path}`, { credentials: 'include' }));
  if (!response.ok) await unwrap<never>(response);
  return response.blob();
}
