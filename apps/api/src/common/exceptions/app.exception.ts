import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base class for domain-specific exceptions. Prefer throwing a subclass of
 * this (or a built-in Nest HttpException) over a bare Error — anything that
 * isn't an HttpException is treated as an unexpected 500 by
 * HttpExceptionFilter and logged at error level.
 */
export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: unknown,
  ) {
    super(message, status);
  }
}

export class TenantMismatchException extends AppException {
  constructor() {
    super(
      'TENANT_MISMATCH',
      'Resource does not belong to the current organisation',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class ResourceNotFoundException extends AppException {
  constructor(entityType: string, id: string) {
    super(
      'RESOURCE_NOT_FOUND',
      `${entityType} with id "${id}" was not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}
