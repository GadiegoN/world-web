/**
 * VOLUME 08 & ADR-P010 — INFRAESTRUTURA DE BANCO DE DADOS RELACIONAL (PostgreSQL / Supabase)
 * Gerencia o pool de conexões PostgreSQL via DATABASE_URL / DIRECT_URL e garante
 * a criação e migração idempotente das tabelas relacionais do domínio.
 */

import { Pool } from "pg";

declare global {
  var __ghwPgPool: Pool | undefined;
  var __ghwSchemaReady: Promise<void> | undefined;
}

export function getPostgresPool(): Pool | null {
  const connectionString =
    process.env.DATABASE_URL || process.env.DIRECT_URL || "";
  if (!connectionString) {
    return null;
  }

  if (!global.__ghwPgPool) {
    global.__ghwPgPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 8000,
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }

  return global.__ghwPgPool;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS github_users (
  id TEXT PRIMARY KEY,
  github_id BIGINT UNIQUE NOT NULL,
  login TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT NOT NULL,
  profile_url TEXT NOT NULL,
  bio TEXT,
  public_repos_count INTEGER NOT NULL DEFAULT 0,
  followers INTEGER NOT NULL DEFAULT 0,
  following INTEGER NOT NULL DEFAULT 0,
  github_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_github_users_login_lower ON github_users (LOWER(login));

CREATE TABLE IF NOT EXISTS worlds (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES github_users(id) ON DELETE CASCADE,
  github_id BIGINT UNIQUE NOT NULL,
  login TEXT NOT NULL,
  generation_version TEXT NOT NULL,
  seed BIGINT NOT NULL,
  status TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  world_payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_worlds_login_lower ON worlds (LOWER(login));
CREATE INDEX IF NOT EXISTS idx_worlds_updated_at ON worlds (updated_at DESC);

CREATE TABLE IF NOT EXISTS cities (
  id TEXT PRIMARY KEY,
  world_id TEXT UNIQUE NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  elevation DOUBLE PRECISION NOT NULL,
  urban_radius DOUBLE PRECISION NOT NULL,
  repository_count INTEGER NOT NULL DEFAULT 0,
  generation_seed BIGINT NOT NULL,
  generation_version TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  github_repository_id BIGINT UNIQUE NOT NULL,
  owner_id TEXT NOT NULL REFERENCES github_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  description TEXT,
  html_url TEXT NOT NULL,
  language TEXT,
  stars INTEGER,
  forks INTEGER,
  open_issues INTEGER,
  size_kb INTEGER,
  is_fork BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  topics TEXT[] NOT NULL DEFAULT '{}',
  pushed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE repositories ADD COLUMN IF NOT EXISTS is_fork BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS topics TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS buildings (
  id TEXT PRIMARY KEY,
  city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  github_repository_id BIGINT NOT NULL,
  repository_name TEXT NOT NULL,
  pos_x DOUBLE PRECISION NOT NULL,
  pos_z DOUBLE PRECISION NOT NULL,
  height DOUBLE PRECISION NOT NULL,
  floors INTEGER NOT NULL,
  width DOUBLE PRECISION NOT NULL,
  depth DOUBLE PRECISION NOT NULL,
  tier_count INTEGER NOT NULL,
  primary_color TEXT NOT NULL,
  is_fork BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  vegetation_season TEXT NOT NULL DEFAULT 'lush_green',
  foliage_color TEXT NOT NULL DEFAULT '#22c55e',
  generation_seed BIGINT NOT NULL,
  generation_version TEXT NOT NULL
);

ALTER TABLE buildings ADD COLUMN IF NOT EXISTS is_fork BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS vegetation_season TEXT NOT NULL DEFAULT 'lush_green';
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS foliage_color TEXT NOT NULL DEFAULT '#22c55e';

CREATE TABLE IF NOT EXISTS auth_sessions (
  session_token TEXT PRIMARY KEY,
  github_id BIGINT NOT NULL,
  login TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT NOT NULL,
  access_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS operational_logs (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event TEXT NOT NULL,
  category TEXT NOT NULL,
  username TEXT,
  world_id TEXT,
  details JSONB
);

CREATE TABLE IF NOT EXISTS rag_documents (
  id TEXT PRIMARY KEY,
  volume TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export async function ensureDatabaseSchema(): Promise<boolean> {
  const pool = getPostgresPool();
  if (!pool) return false;

  if (!global.__ghwSchemaReady) {
    global.__ghwSchemaReady = (async () => {
      // Fast-path: se a tabela mais recente (`rag_documents`) e a coluna `foliage_color` já existem, evita rodar 18 DDLs no cold-start
      const checkRes = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'buildings'
          AND column_name = 'foliage_color'
        LIMIT 1;
      `);
      if (checkRes.rowCount && checkRes.rowCount > 0) {
        return;
      }
      await pool.query(SCHEMA_SQL);
    })().catch((err) => {
      global.__ghwSchemaReady = undefined;
      console.error("[GitHub World DB] Erro ao inicializar schema PostgreSQL:", err);
      throw err;
    });
  }

  try {
    await global.__ghwSchemaReady;
    return true;
  } catch {
    return false;
  }
}

