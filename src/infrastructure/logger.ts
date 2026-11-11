/**
 * VOLUME 13 — OPERAÇÃO E OBSERVABILIDADE (Persistência em PostgreSQL + Buffer em Memória)
 */

import {
  ensureDatabaseSchema,
  getPostgresPool,
} from "@/infrastructure/database/postgres";

export type OperationalCategory =
  | "integration"
  | "domain"
  | "generation"
  | "persistence"
  | "rendering"
  | "performance";

export type OperationalEventType =
  | "search_started"
  | "user_found"
  | "github_query_completed"
  | "partial_collection"
  | "generation_started"
  | "generation_completed"
  | "generation_failed"
  | "world_restored_from_storage"
  | "world_updated";

export interface OperationalLogEntry {
  timestamp: string;
  event: OperationalEventType;
  category: OperationalCategory;
  username?: string;
  worldId?: string;
  details?: Record<string, unknown>;
}

const recentLogs: OperationalLogEntry[] = [];
const MAX_LOGS = 100;

export function logOperationalEvent(
  event: OperationalEventType,
  category: OperationalCategory,
  details?: { username?: string; worldId?: string; [key: string]: unknown }
): void {
  const entry: OperationalLogEntry = {
    timestamp: new Date().toISOString(),
    event,
    category,
    username: details?.username,
    worldId: details?.worldId,
    details,
  };

  recentLogs.unshift(entry);
  if (recentLogs.length > MAX_LOGS) {
    recentLogs.pop();
  }

  // Grava de forma assíncrona não-bloqueante na tabela operational_logs do PostgreSQL
  void (async () => {
    try {
      const ok = await ensureDatabaseSchema();
      const pool = getPostgresPool();
      if (!ok || !pool) return;
      await pool.query(
        `
        INSERT INTO operational_logs (timestamp, event, category, username, world_id, details)
        VALUES ($1, $2, $3, $4, $5, $6);
        `,
        [
          entry.timestamp,
          entry.event,
          entry.category,
          entry.username ?? null,
          entry.worldId ?? null,
          details ? JSON.stringify(details) : null,
        ]
      );
    } catch {
      // Não bloqueia fluxo principal se o log falhar
    }
  })();
}

export async function getRecentOperationalLogs(
  limit = 15
): Promise<OperationalLogEntry[]> {
  try {
    const ok = await ensureDatabaseSchema();
    const pool = getPostgresPool();
    if (ok && pool) {
      const res = await pool.query<{
        timestamp: string;
        event: OperationalEventType;
        category: OperationalCategory;
        username: string | null;
        world_id: string | null;
        details: Record<string, unknown> | null;
      }>(
        `
        SELECT timestamp, event, category, username, world_id, details
        FROM operational_logs
        ORDER BY timestamp DESC
        LIMIT $1;
        `,
        [limit]
      );
      if (res.rowCount && res.rowCount > 0) {
        return res.rows.map((r) => ({
          timestamp: new Date(r.timestamp).toISOString(),
          event: r.event,
          category: r.category,
          username: r.username ?? undefined,
          worldId: r.world_id ?? undefined,
          details: r.details ?? undefined,
        }));
      }
    }
  } catch {
    // Usa buffer em memória caso falhe
  }
  return recentLogs.slice(0, limit);
}
