/**
 * Claims embedded in the signed JWT access token. `role` is singular — the
 * schema gives each User exactly one Role (packages/database's User.roleId),
 * not a many-to-many. `permissions` is the flattened set resolved from that
 * one role's RolePermission rows at token-issue time.
 */
export interface TokenPayload {
  sub: string; // userId
  organisationId: string;
  email: string;
  role: string;
  permissions: string[];
  iat?: number;
  exp?: number;
}

/**
 * Resolved per-request tenant/identity context. Populated by JwtAuthGuard +
 * TenantGuard (apps/api/src/common/guards) from the validated token, then
 * injected into services via @CurrentUser()/@CurrentTenant() so business
 * logic never reads organisationId from anywhere else (query params,
 * headers, body) — see docs/architecture/multi-tenancy.md.
 */
export interface TenantContext {
  userId: string;
  organisationId: string;
  email: string;
  role: string;
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
