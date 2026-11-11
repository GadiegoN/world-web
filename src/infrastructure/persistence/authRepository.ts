/**
 * VOLUME 01.5 & VOLUME 11.2 — REPOSITÓRIO DE AUTENTICAÇÃO E SESSÕES GITHUB OAUTH
 * Gerencia sessões OAuth persistidas na tabela `auth_sessions` do PostgreSQL (Supabase)
 * e cookies HttpOnly seguros no servidor Next.js.
 */

import {
  ensureDatabaseSchema,
  getPostgresPool,
} from "@/infrastructure/database/postgres";
import crypto from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "ghw_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 dias

export interface AuthenticatedGitHubSession {
  sessionToken: string;
  githubId: number;
  login: string;
  displayName: string | null;
  avatarUrl: string;
  accessToken: string;
  expiresAt: string;
}

const memorySessions = new Map<string, AuthenticatedGitHubSession>();

export async function createGitHubAuthSession(input: {
  githubId: number;
  login: string;
  displayName: string | null;
  avatarUrl: string;
  accessToken: string;
}): Promise<AuthenticatedGitHubSession> {
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const session: AuthenticatedGitHubSession = {
    sessionToken,
    githubId: input.githubId,
    login: input.login,
    displayName: input.displayName,
    avatarUrl: input.avatarUrl,
    accessToken: input.accessToken,
    expiresAt,
  };

  memorySessions.set(sessionToken, session);

  const schemaOk = await ensureDatabaseSchema();
  const pool = getPostgresPool();
  if (schemaOk && pool) {
    try {
      await pool.query(
        `
        INSERT INTO auth_sessions (
          session_token, github_id, login, display_name, avatar_url, access_token, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (session_token) DO UPDATE SET
          access_token = EXCLUDED.access_token,
          expires_at = EXCLUDED.expires_at;
        `,
        [
          sessionToken,
          input.githubId,
          input.login,
          input.displayName,
          input.avatarUrl,
          input.accessToken,
          expiresAt,
        ]
      );
    } catch (err) {
      console.error("[GitHub World Auth] Erro ao salvar sessão no PostgreSQL:", err);
    }
  }

  return session;
}

export async function getCurrentGitHubSession(): Promise<AuthenticatedGitHubSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const mem = memorySessions.get(token);
    if (mem) {
      if (Date.now() < new Date(mem.expiresAt).getTime()) {
        return mem;
      }
      memorySessions.delete(token);
    }

    const schemaOk = await ensureDatabaseSchema();
    const pool = getPostgresPool();
    if (!schemaOk || !pool) return null;

    const res = await pool.query<{
      session_token: string;
      github_id: string | number;
      login: string;
      display_name: string | null;
      avatar_url: string;
      access_token: string;
      expires_at: string;
    }>(
      `
      SELECT session_token, github_id, login, display_name, avatar_url, access_token, expires_at
      FROM auth_sessions
      WHERE session_token = $1 AND expires_at > NOW()
      LIMIT 1;
      `,
      [token]
    );

    if (res.rowCount === 0) return null;
    const row = res.rows[0];
    const session: AuthenticatedGitHubSession = {
      sessionToken: row.session_token,
      githubId: Number(row.github_id),
      login: row.login,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      accessToken: row.access_token,
      expiresAt: new Date(row.expires_at).toISOString(),
    };
    memorySessions.set(token, session);
    return session;
  } catch {
    return null;
  }
}

export async function destroyCurrentGitHubSession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      memorySessions.delete(token);
      const pool = getPostgresPool();
      if (pool) {
        await pool
          .query(`DELETE FROM auth_sessions WHERE session_token = $1`, [token])
          .catch(() => {});
      }
    }
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch {
    // silencioso
  }
}

