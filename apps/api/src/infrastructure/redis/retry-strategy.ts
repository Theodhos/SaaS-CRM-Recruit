/**
 * ioredis `retryStrategy` shared by the Redis and queue modules.
 *
 * In development Redis is optional and often absent, so the clients give up after the first failure (`null`) and the
 * API boots without it — the behaviour these modules always had. In production a Redis restart or failover is a
 * normal event: a client that never reconnects would leave the queue producers dead until the API is restarted, so
 * there we reconnect with a capped backoff. Override either way with REDIS_RECONNECT=true|false.
 */
export function redisRetryStrategy(env: NodeJS.ProcessEnv = process.env): (attempt: number) => number | null {
  const reconnect = (env.REDIS_RECONNECT ?? (env.NODE_ENV === 'production' ? 'true' : 'false')) === 'true';
  return reconnect ? (attempt) => Math.min(attempt * 500, 10_000) : () => null;
}
