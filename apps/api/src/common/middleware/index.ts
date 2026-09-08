/**
 * Reserved for cross-cutting request middleware that must run before
 * routing/guards (e.g. raw-body capture for webhook signature verification
 * in modules/integrations). Intentionally empty in Phase 1 — most
 * request-pipeline concerns (auth, tenant scoping, response shape) are
 * handled by guards/interceptors instead, see ../guards and ../interceptors.
 */
export {};
