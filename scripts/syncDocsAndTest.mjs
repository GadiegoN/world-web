/**
 * VOLUME 12 & VOLUME 15.4 — SINCRONIZADOR DOCUMENTAL CANÔNICO & SUÍTE DE TESTES CLI
 * - Materializa a árvore `docs/00-fundamentos` .. `docs/15-rag` a partir de `rag.md` com frontmatter YAML
 * - Executa os testes automatizados de determinismo, geometria urbana, normalização e RAG via `node --test`
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const RAG_FILE = path.join(ROOT_DIR, "rag.md");
const DOCS_DIR = path.join(ROOT_DIR, "docs");

const VOLUME_FOLDER_MAP = {
  "00": { folder: "00-fundamentos", category: "foundation" },
  "01": { folder: "01-produto", category: "product" },
  "02": { folder: "02-dominio", category: "domain" },
  "03": { folder: "03-universo-3d", category: "3d-universe" },
  "04": { folder: "04-geracao-procedural", category: "procedural-generation" },
  "05": { folder: "05-integracao-github", category: "github-integration" },
  "06": { folder: "06-construcoes", category: "buildings" },
  "07": { folder: "07-arquitetura", category: "architecture" },
  "08": { folder: "08-dados", category: "data-persistence" },
  "09": { folder: "09-performance", category: "performance" },
  "10": { folder: "10-interface", category: "ui-ux" },
  "11": { folder: "11-seguranca", category: "security" },
  "12": { folder: "12-testes", category: "testing" },
  "13": { folder: "13-operacao", category: "operations" },
  "14": { folder: "14-decisoes", category: "adr" },
  "15": { folder: "15-rag", category: "rag" },
};

function detectVolumeStatus(text) {
  const hasConfirmed = /CONFIRMADO/i.test(text);
  const hasPending = /PENDENTE|NÃO DEFINIDO/i.test(text);
  if (hasConfirmed && !hasPending) return "confirmed";
  if (hasConfirmed && hasPending) return "mixed";
  if (hasPending) return "pending";
  return "confirmed";
}

export function syncCanonicalDocsTree() {
  const rawBook = fs.readFileSync(RAG_FILE, "utf-8");
  fs.mkdirSync(DOCS_DIR, { recursive: true });

  // 1. Copia livro integral consolidado para docs/BOOK.md
  fs.writeFileSync(path.join(DOCS_DIR, "BOOK.md"), rawBook, "utf-8");

  // 2. Gera docs/README.md com índice navegável dos 16 volumes
  const indexLines = [
    "---",
    "id: GW-DOC-000",
    "title: Índice Geral da Documentação Canônica do GitHub World",
    'volume: "ALL"',
    "status: confirmed",
    'version: "1.5.0"',
    "category: index",
    "language: pt-BR",
    'created_at: "2026-11-11"',
    'updated_at: "2026-11-11"',
    "---",
    "",
    "# Documentação Canônica — GitHub World",
    "",
    "Estrutura documental gerada e sincronizada a partir da fonte canônica [`rag.md`](../rag.md) (Volume 15.4).",
    "",
    "## Volumes",
    "",
  ];

  // Divide o livro por `# VOLUME XX — TÍTULO`
  const volumeRegex = /^#\s+VOLUME\s+(\d{2})\s+—\s+(.+)$/gm;
  const matches = [...rawBook.matchAll(volumeRegex)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const volNum = match[1];
    const volTitle = match[2].trim();
    const startIdx = match.index;
    const endIdx =
      i + 1 < matches.length ? matches[i + 1].index : rawBook.length;
    const volContent = rawBook.slice(startIdx, endIdx).trim();

    const meta = VOLUME_FOLDER_MAP[volNum];
    if (!meta) continue;

    const volDir = path.join(DOCS_DIR, meta.folder);
    fs.mkdirSync(volDir, { recursive: true });

    const status = detectVolumeStatus(volContent);
    const nextVolNum = String((Number(volNum) + 1) % 16).padStart(2, "0");

    const fileContent = [
      "---",
      `id: GW-${volNum}-001`,
      `title: "Volume ${volNum} — ${volTitle}"`,
      `volume: "${volNum}"`,
      `status: ${status}`,
      'version: "1.5.0"',
      `category: ${meta.category}`,
      "language: pt-BR",
      'created_at: "2026-11-11"',
      'updated_at: "2026-11-11"',
      "related:",
      `  - GW-${nextVolNum}-001`,
      "---",
      "",
      volContent,
      "",
    ].join("\n");

    fs.writeFileSync(path.join(volDir, "README.md"), fileContent, "utf-8");
    indexLines.push(`- [Volume ${volNum} — ${volTitle}](./${meta.folder}/README.md)`);
  }

  // 3. Gera os 4 documentos especializados de docs/15-rag/ (Volume 15.4)
  const ragDir = path.join(DOCS_DIR, "15-rag");
  fs.mkdirSync(ragDir, { recursive: true });

  fs.writeFileSync(
    path.join(ragDir, "metadata-schema.md"),
    [
      "---",
      "id: GW-15-002",
      'title: "Esquema de Metadados Documentais (Volume 15.5)"',
      'volume: "15"',
      "status: confirmed",
      'version: "1.5.0"',
      "category: rag",
      "language: pt-BR",
      "---",
      "",
      "# Esquema de Metadados Documentais",
      "",
      "Cada documento e chunk indexado no RAG do GitHub World possui os seguintes campos obrigatórios:",
      "- `id`: Identificador único monotônico (`GW-<VOLUME>-<SEQ>`).",
      "- `title`: Título canônico da seção ou volume.",
      "- `volume`: Número de 2 dígitos do volume (`00` a `15`) ou `PRE`.",
      "- `status`: `confirmed`, `proposed`, `pending` ou `mixed`.",
      "- `relatedAdrs`: Lista de ADRs referenciados (`ADR-001`..`ADR-020`).",
      "",
    ].join("\n"),
    "utf-8"
  );

  fs.writeFileSync(
    path.join(ragDir, "indexing-strategy.md"),
    [
      "---",
      "id: GW-15-003",
      'title: "Estratégia de Indexação e Chunking Semântico (Volume 15.6)"',
      'volume: "15"',
      "status: confirmed",
      'version: "1.5.0"',
      "category: rag",
      "language: pt-BR",
      "---",
      "",
      "# Estratégia de Indexação Semântica",
      "",
      "A indexação em `src/rag/bookRag.ts` divide `rag.md` respeitando a hierarquia `# VOLUME XX` e `## Seção`, mantendo cada regra de domínio, fórmula matemática e tabela ADR íntegra dentro do mesmo chunk com contadores monotônicos por volume.",
      "",
    ].join("\n"),
    "utf-8"
  );

  fs.writeFileSync(
    path.join(ragDir, "retrieval-strategy.md"),
    [
      "---",
      "id: GW-15-004",
      'title: "Estratégia de Recuperação e Ranking (Volume 15.7)"',
      'volume: "15"',
      "status: confirmed",
      'version: "1.5.0"',
      "category: rag",
      "language: pt-BR",
      "---",
      "",
      "# Estratégia de Recuperação",
      "",
      "A busca atribui pesos diferenciados para correspondências no identificador de ADR (+8), título da seção (+5), hierarquia de volume (+3) e corpo textual (+1 por termo), retornando o status epistemológico (`confirmed` vs `pending`) junto de cada trecho.",
      "",
    ].join("\n"),
    "utf-8"
  );

  fs.writeFileSync(
    path.join(ragDir, "evaluation.md"),
    [
      "---",
      "id: GW-15-005",
      'title: "Suíte de Avaliação de Qualidade do RAG (Volume 15.8)"',
      'volume: "15"',
      "status: confirmed",
      'version: "1.5.0"',
      "category: rag",
      "language: pt-BR",
      "---",
      "",
      "# Avaliação Automatizada do RAG",
      "",
      "O módulo `src/rag/ragEvaluator.ts` executa perguntas canônicas de referência verificando se os volumes, ADRs e status esperados são recuperados no Top-K com pontuação de precisão auditável em `/api/rag`.",
      "",
    ].join("\n"),
    "utf-8"
  );

  fs.writeFileSync(
    path.join(DOCS_DIR, "README.md"),
    indexLines.join("\n") + "\n",
    "utf-8"
  );
}

// Sincroniza sempre ao rodar
syncCanonicalDocsTree();

// Funções matemáticas espelhadas para validação no runner CLI
function hashStringToSeed(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function normalizeLogarithmic(value, maxRef) {
  if (value <= 0) return 0;
  const norm = Math.log10(1 + value) / Math.log10(1 + maxRef);
  return Number(Math.max(0, Math.min(1, norm)).toFixed(4));
}

describe("GitHub World — Suíte Oficial de Qualidade, Determinismo e Documentação (Volume 12 & 15)", () => {
  it("1. Deve gerar e validar todos os 16 volumes modulares em docs/ (Volume 15.4 & 15.5)", () => {
    assert.ok(fs.existsSync(path.join(DOCS_DIR, "README.md")));
    assert.ok(fs.existsSync(path.join(DOCS_DIR, "BOOK.md")));

    for (const [volNum, meta] of Object.entries(VOLUME_FOLDER_MAP)) {
      const readmePath = path.join(DOCS_DIR, meta.folder, "README.md");
      assert.ok(
        fs.existsSync(readmePath),
        `Arquivo ausente: docs/${meta.folder}/README.md`
      );
      const content = fs.readFileSync(readmePath, "utf-8");
      assert.match(content, new RegExp(`id: GW-${volNum}-001`));
      assert.match(content, /version: "1\.5\.0"/);
    }

    for (const subFile of [
      "metadata-schema.md",
      "indexing-strategy.md",
      "retrieval-strategy.md",
      "evaluation.md",
    ]) {
      assert.ok(
        fs.existsSync(path.join(DOCS_DIR, "15-rag", subFile)),
        `Subarquivo RAG ausente: docs/15-rag/${subFile}`
      );
    }
  });

  it("2. Deve produzir sementes determinísticas idênticas para o mesmo githubId e versão (Volume 04.2)", () => {
    const seedA = hashStringToSeed("github-world:user:1024:v:1.2.0");
    const seedB = hashStringToSeed("github-world:user:1024:v:1.2.0");
    const seedDiffUser = hashStringToSeed("github-world:user:2048:v:1.2.0");

    assert.equal(seedA, seedB);
    assert.notEqual(seedA, seedDiffUser);
  });

  it("3. Deve posicionar quadras sem nenhuma colisão com Avenidas Arteriais ou Ruas Secundárias (Volume 06.7)", () => {
    const BLOCK_PITCH = 18.0;
    const MAX_BUILDING_HALF_SPAN = 8.4 / 2 + 0.6; // 4.8m
    const ARTERIAL_HALF_WIDTH = 4.8 / 2; // 2.4m

    for (let gx = -10; gx <= 10; gx++) {
      const centerX = (gx + 0.5) * BLOCK_PITCH;
      const minEdge = Math.abs(centerX) - MAX_BUILDING_HALF_SPAN;
      assert.ok(
        minEdge > ARTERIAL_HALF_WIDTH,
        `Colisão detectada na quadra gx=${gx}: minEdge=${minEdge} <= ${ARTERIAL_HALF_WIDTH}`
      );
    }
  });

  it("4. Deve normalizar métricas logaritmicamente no intervalo [0, 1] (Volume 06.4)", () => {
    assert.equal(normalizeLogarithmic(0, 5000), 0);
    assert.equal(normalizeLogarithmic(5000, 5000), 1);
    assert.equal(normalizeLogarithmic(250000, 5000), 1); // Teto respeitado para repos gigantes como linux
    const mid = normalizeLogarithmic(100, 5000);
    assert.ok(mid > 0.4 && mid < 0.65);
  });

  it("5. Deve preservar todas as decisões confirmadas ADR-001 a ADR-020 no livro canônico (Volume 14)", () => {
    const book = fs.readFileSync(RAG_FILE, "utf-8");
    for (let i = 1; i <= 20; i++) {
      const adrId = `ADR-${String(i).padStart(3, "0")}`;
      assert.ok(book.includes(adrId), `Decisão ${adrId} não encontrada em rag.md`);
    }
  });

  it("6. Deve conectar ao PostgreSQL (Supabase) e garantir as tabelas relacionais do domínio (Volume 08)", async () => {
    const envPath = path.join(__dirname, "..", ".env");
    if (!fs.existsSync(envPath)) return;

    const envRaw = fs.readFileSync(envPath, "utf-8");
    const envVars = {};
    for (const line of envRaw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
      if (m) envVars[m[1]] = m[2].trim();
    }

    const connStr = envVars.DIRECT_URL || envVars.DATABASE_URL;
    if (!connStr) return;

    const pool = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
    });

    try {
      await pool.query(`
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
      `);

      // Sincroniza os 16 volumes canônicos em rag_documents no PostgreSQL (Volume 15.9)
      for (const [volNum, meta] of Object.entries(VOLUME_FOLDER_MAP)) {
        const readmePath = path.join(DOCS_DIR, meta.folder, "README.md");
        if (fs.existsSync(readmePath)) {
          const content = fs.readFileSync(readmePath, "utf-8");
          const status = detectVolumeStatus(content);
          await pool.query(
            `INSERT INTO rag_documents (id, volume, title, status, category, content, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (id) DO UPDATE SET
               title = EXCLUDED.title,
               status = EXCLUDED.status,
               category = EXCLUDED.category,
               content = EXCLUDED.content,
               updated_at = NOW()`,
            [
              `GW-${volNum}-001`,
              volNum,
              `Volume ${volNum} — ${meta.folder}`,
              status,
              meta.category,
              content,
            ]
          );
        }
      }

      const tablesRes = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('github_users', 'worlds', 'cities', 'repositories', 'buildings', 'auth_sessions', 'operational_logs', 'rag_documents');
      `);
      assert.equal(tablesRes.rowCount, 8, "Todas as 8 tabelas relacionais e RAG devem existir no Supabase PostgreSQL");
    } finally {
      await pool.end();
    }
  });
});

