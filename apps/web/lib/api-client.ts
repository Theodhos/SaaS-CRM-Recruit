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

/**
 * Single fetch wrapper every service/* module goes through. Unwraps the
 * shared ApiResponse envelope (see @crm/types and apps/api's
 * ResponseEnvelopeInterceptor/HttpExceptionFilter) so callers get plain
 * data or a typed ApiClientError, never a raw Response to re-parse.
 */
export async function apiClient<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const json = (await response.json()) as ApiResponse<T>;

  if (!json.success) {
    throw new ApiClientError(json.error.message, json.error.code, response.status, json.requestId);
  }

  return json.data;
}
