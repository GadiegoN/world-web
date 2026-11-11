/**
 * VOLUME 11.4 — LIMITES DE USO INTERNOS (Rate Limiting)
 * Protege a aplicação contra abuso de pesquisa e consultas repetitivas por IP.
 */

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

const WINDOW_MS = 60 * 1000; // Janela de 1 minuto
const MAX_REQUESTS_PER_WINDOW = 30; // Até 30 pesquisas por minuto por cliente

export function checkInternalRateLimit(clientKey: string): {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const existing = buckets.get(clientKey);

  if (!existing || now > existing.resetAt) {
    buckets.set(clientKey, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_WINDOW - 1,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt - now) / 1000)
    );
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_WINDOW - existing.count,
    retryAfterSeconds: 0,
  };
}

