/**
 * Shared API envelope contracts. Every apps/api response must conform to
 * these shapes (see apps/api/src/common/interceptors and docs/api/conventions.md).
 */

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
  requestId: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface OffsetPaginationParams {
  page?: number;
  pageSize?: number;
}

export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
}

export interface OffsetPaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CursorPaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SortParam {
  field: string;
  direction: 'asc' | 'desc';
}
