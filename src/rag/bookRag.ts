/**
 * VOLUME 15 — SISTEMA DE DOCUMENTAÇÃO E RAG
 * Indexa semanticamente o Livro Técnico Canônico (`rag.md` na raiz do repositório)
 * preservando Título, Hierarquia, Identificador, Status (CONFIRMADO, PROPOSTA, PENDENTE) e ADRs.
 */

import {
  ensureDatabaseSchema,
  getPostgresPool,
} from "@/infrastructure/database/postgres";
import fs from "fs";
import path from "path";

export type DocumentConstraintStatus = "confirmed" | "proposed" | "pending" | "mixed";

export interface RagChunk {
  id: string;
  volume: string;
  title: string;
  hierarchy: string;
  status: DocumentConstraintStatus;
  content: string;
  relatedAdrs: string[];
}

let cachedChunks: RagChunk[] | null = null;
let cachedMtimeMs = 0;

function detectSectionStatus(text: string): DocumentConstraintStatus {
  const hasConfirmed = /CONFIRMADO/i.test(text);
  const hasPending = /PENDENTE|NÃO DEFINIDO/i.test(text);
  const hasProposed = /PROPOSTA/i.test(text);

  if (hasConfirmed && !hasPending && !hasProposed) return "confirmed";
  if (hasPending && !hasConfirmed) return "pending";
  if (hasProposed && !hasConfirmed && !hasPending) return "proposed";
  if (hasConfirmed || hasPending || hasProposed) return "mixed";
  return "confirmed";
}

function extractRelatedAdrs(text: string): string[] {
  const matches = text.match(/ADR-(?:P)?\d{3}/g);
  return matches ? Array.from(new Set(matches)) : [];
}

function parseMarkdownIntoChunks(rawMarkdown: string): RagChunk[] {
  const lines = rawMarkdown.split(/\r?\n/);
  const chunks: RagChunk[] = [];

  let currentVolume = "PRE";
  let currentVolumeTitle = "Controle Documental";
  let currentSectionTitle = "Introdução";
  let buffer: string[] = [];
  const volumeCounters = new Map<string, number>();

  const flushChunk = () => {
    const content = buffer.join("\n").trim();
    if (content.length < 30) {
      buffer = [];
      return;
    }
    const nextIdx = (volumeCounters.get(currentVolume) ?? 0) + 1;
    volumeCounters.set(currentVolume, nextIdx);
    const id = `GW-${currentVolume}-${String(nextIdx).padStart(3, "0")}`;
    chunks.push({
      id,
      volume: currentVolume,
      title: currentSectionTitle,
      hierarchy: `${currentVolumeTitle} > ${currentSectionTitle}`,
      status: detectSectionStatus(content),
      content,
      relatedAdrs: extractRelatedAdrs(content),
    });
    buffer = [];
  };

  for (const line of lines) {
    const volMatch = line.match(/^#\s+VOLUME\s+(\d+)\s+—\s+(.+)$/i);
    const annexMatch = line.match(/^#\s+ANEXO\s+([A-Z])\s+—\s+(.+)$/i);
    const h2Match = line.match(/^##\s+(.+)$/);

    if (volMatch) {
      flushChunk();
      currentVolume = volMatch[1];
      currentVolumeTitle = `Volume ${volMatch[1]} — ${volMatch[2].trim()}`;
      currentSectionTitle = currentVolumeTitle;
      buffer.push(line);
    } else if (annexMatch) {
      flushChunk();
      currentVolume = `ANEXO-${annexMatch[1]}`;
      currentVolumeTitle = `Anexo ${annexMatch[1]} — ${annexMatch[2].trim()}`;
      currentSectionTitle = currentVolumeTitle;
      buffer.push(line);
    } else if (h2Match) {
      flushChunk();
      currentSectionTitle = h2Match[1].trim();
      buffer.push(line);
    } else {
      buffer.push(line);
    }
  }
  flushChunk();
  return chunks;
}

export function loadAndIndexCanonicalBook(): RagChunk[] {
  const candidatePaths = [
    path.resolve(process.cwd(), "..", "rag.md"),
    path.resolve(process.cwd(), "rag.md"),
  ];

  let rawMarkdown = "";
  let currentMtime = 0;
  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
        const stat = fs.statSync(/*turbopackIgnore: true*/ p);
        currentMtime = stat.mtimeMs;
        if (cachedChunks && cachedMtimeMs === currentMtime) {
          return cachedChunks;
        }
        rawMarkdown = fs.readFileSync(/*turbopackIgnore: true*/ p, "utf-8");
        break;
      }
    } catch {
      // continua
    }
  }

  if (!rawMarkdown) {
    return cachedChunks ?? [];
  }

  const chunks = parseMarkdownIntoChunks(rawMarkdown);
  cachedChunks = chunks;
  cachedMtimeMs = currentMtime;
  return chunks;
}

/**
 * Fallback assíncrono para ambientes serverless onde `../rag.md` não está no disco local:
 * carrega os 16 volumes diretamente da tabela `rag_documents` no PostgreSQL (Supabase).
 */
export async function ensureCanonicalBookLoadedAsync(): Promise<RagChunk[]> {
  const local = loadAndIndexCanonicalBook();
  if (local.length > 0) return local;

  const schemaOk = await ensureDatabaseSchema();
  const pool = getPostgresPool();
  if (!schemaOk || !pool) return [];

  try {
    const res = await pool.query<{ content: string }>(
      `SELECT content FROM rag_documents ORDER BY volume ASC;`
    );
    if (res.rowCount && res.rowCount > 0) {
      const combined = res.rows.map((r) => r.content).join("\n\n");
      const chunks = parseMarkdownIntoChunks(combined);
      if (chunks.length > 0) {
        cachedChunks = chunks;
        return chunks;
      }
    }
  } catch {
    // silencioso
  }
  return [];
}

export function searchCanonicalRag(query: string, limit = 6): {
  query: string;
  totalChunks: number;
  results: RagChunk[];
} {
  const chunks = loadAndIndexCanonicalBook();
  const normalizedQuery = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (!normalizedQuery) {
    return {
      query,
      totalChunks: chunks.length,
      results: chunks.slice(0, limit),
    };
  }

  const terms = normalizedQuery.split(/\s+/).filter((t) => t.length >= 2);

  const scored = chunks.map((chunk) => {
    const searchable = `${chunk.id} ${chunk.hierarchy} ${chunk.content} ${chunk.relatedAdrs.join(" ")}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const normalizedAdrs = chunk.relatedAdrs.map((a) => a.toLowerCase());

    let score = 0;
    for (const term of terms) {
      if (normalizedAdrs.includes(term)) {
        score += 8; // Peso prioritário para match exato de ADR (Volume 15.7)
      }
      if (
        chunk.title
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .includes(term)
      ) {
        score += 5;
      }
      if (
        chunk.hierarchy
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .includes(term)
      ) {
        score += 3;
      }
      if (searchable.includes(term)) {
        score += 1;
      }
    }
    return { chunk, score };
  });

  const filtered = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.chunk);

  return {
    query,
    totalChunks: chunks.length,
    results: filtered,
  };
}
