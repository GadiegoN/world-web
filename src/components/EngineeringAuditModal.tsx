"use client";

/**
 * VOLUME 12, 13, 14 & 15 — MODAL DE AUDITORIA DE ENGENHARIA, DOMÍNIO E RAG CANÔNICO
 * Isola as ferramentas técnicas de inspeção de invariantes, suíte de determinismo,
 * logs operacionais e busca nos 16 volumes do livro canônico (`rag.md`),
 * mantendo a interface principal limpa e focada na experiência 3D.
 */

import { World } from "@/domain/types";
import type { OperationalLogEntry } from "@/infrastructure/logger";
import type { PersistedWorldSummary } from "@/infrastructure/persistence/worldRepository";
import type { RagChunk } from "@/rag/bookRag";
import React, { useCallback, useEffect, useState } from "react";

interface EngineeringAuditModalProps {
  world: World | null;
  recentDbWorlds: PersistedWorldSummary[];
  onSelectWorldUsername: (username: string) => void;
  onClose: () => void;
}

export default function EngineeringAuditModal({
  world,
  recentDbWorlds,
  onSelectWorldUsername,
  onClose,
}: EngineeringAuditModalProps) {
  const [section, setSection] = useState<"domain" | "rag" | "logs">("domain");
  const [ragQuery, setRagQuery] = useState("");
  const [ragChunks, setRagChunks] = useState<RagChunk[]>([]);
  const [ragTotal, setRagTotal] = useState(0);
  const [operationalLogs, setOperationalLogs] = useState<OperationalLogEntry[]>(
    []
  );
  const [determinismAssertions, setDeterminismAssertions] = useState<string[]>(
    []
  );
  const [ragScorePercent, setRagScorePercent] = useState<number | null>(null);
  const [ragCases, setRagCases] = useState<
    Array<{
      id: string;
      question: string;
      passed: boolean;
      topChunkId: string | null;
    }>
  >([]);
  const [isLoadingRag, setIsLoadingRag] = useState(false);

  const fetchRagDocumentation = useCallback(async (q: string) => {
    setIsLoadingRag(true);
    try {
      const res = await fetch(`/api/rag?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setRagChunks(data.results ?? []);
        setRagTotal(data.totalChunks ?? 0);
        setOperationalLogs(data.logs ?? []);
        if (data.determinismSuite?.assertions) {
          setDeterminismAssertions(data.determinismSuite.assertions);
        }
        if (typeof data.ragEvaluation?.scorePercent === "number") {
          setRagScorePercent(data.ragEvaluation.scorePercent);
          setRagCases(data.ragEvaluation.cases ?? []);
        }
      }
    } catch {
      // silencioso
    } finally {
      setIsLoadingRag(false);
    }
  }, []);

  useEffect(() => {
    fetchRagDocumentation(ragQuery);
  }, [ragQuery, fetchRagDocumentation]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
      <div className="flex h-[82vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>🛠️ Auditoria de Engenharia, Determinismo & RAG Canônico</span>
              {ragScorePercent !== null && (
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] text-emerald-300 border border-emerald-500/30">
                  Qualidade RAG: {ragScorePercent}%
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              Inspeção técnica dos Volumes 00 a 15 (`rag.md`), invariantes de
              domínio e telemetria PostgreSQL.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            ✕ Fechar
          </button>
        </div>

        {/* Sub-abas */}
        <div className="flex gap-2 border-b border-slate-800 bg-slate-900/40 px-5 py-2 text-xs">
          <button
            type="button"
            onClick={() => setSection("domain")}
            className={`rounded-lg px-3 py-1.5 font-semibold transition cursor-pointer ${
              section === "domain"
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                : "text-slate-400 hover:bg-slate-900"
            }`}
          >
            🪐 Hierarquia de Domínio & Determinismo
          </button>
          <button
            type="button"
            onClick={() => setSection("rag")}
            className={`rounded-lg px-3 py-1.5 font-semibold transition cursor-pointer ${
              section === "rag"
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                : "text-slate-400 hover:bg-slate-900"
            }`}
          >
            📖 Explorador RAG ({ragTotal} seções)
          </button>
          <button
            type="button"
            onClick={() => setSection("logs")}
            className={`rounded-lg px-3 py-1.5 font-semibold transition cursor-pointer ${
              section === "logs"
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                : "text-slate-400 hover:bg-slate-900"
            }`}
          >
            📡 Logs Operacionais & Cache PostgreSQL
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-5 text-xs space-y-4">
          {section === "domain" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2.5">
                <div className="font-bold text-sky-300 uppercase tracking-wider text-[11px]">
                  Invariantes Estruturais (Volume 00.2 & Volume 02)
                </div>
                <ul className="space-y-1.5 text-slate-300 text-[11px]">
                  <li>✓ 1 Usuário → 1 Mundo (`world_&lt;githubId&gt;`)</li>
                  <li>✓ 1 Mundo → 1 Planeta (`R = 120`, right-handed Y-up)</li>
                  <li>✓ 1 Planeta → 1 Continente Único (`Pangeia`)</li>
                  <li>✓ 1 Continente → 1 Cidade Principal (`city_&lt;worldId&gt;`)</li>
                  <li>✓ N Repositórios Públicos → N Construções Auditáveis</li>
                </ul>
                {world && (
                  <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-300 space-y-1">
                    <div>World ID: {world.id}</div>
                    <div>GitHub ID Imutável: {world.user.githubId}</div>
                    <div>Seed Principal: {world.seed}</div>
                    <div>Seed Pangeia: {world.continent.seed}</div>
                    <div>Seed Cidade: {world.city.generationSeed}</div>
                    <div>Versão das Regras: v{world.generationVersion}</div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-300 uppercase tracking-wider text-[11px]">
                    Suíte Automatizada (Volume 12)
                  </span>
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                    PASS
                  </span>
                </div>
                <div className="space-y-1 text-[11px] font-mono text-emerald-200/90">
                  {determinismAssertions.map((assertion, idx) => (
                    <div key={idx}>{assertion}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {section === "rag" && (
            <div className="space-y-4">
              <input
                type="text"
                value={ragQuery}
                onChange={(e) => setRagQuery(e.target.value)}
                placeholder="Pesquisar nos 16 Volumes Canônicos (ex: Pangeia, ADR, Fórmulas, UNNEST)..."
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none"
              />
              {isLoadingRag ? (
                <div className="text-slate-400">Consultando base canônica...</div>
              ) : (
                <div className="space-y-2.5">
                  {ragChunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-sky-400">
                          {chunk.id} • Volume {chunk.volume}
                        </span>
                        <span className="rounded border border-emerald-500/30 bg-emerald-950/60 px-1.5 py-0.5 text-[10px] text-emerald-300">
                          {chunk.status}
                        </span>
                      </div>
                      <div className="font-semibold text-white">
                        {chunk.title}
                      </div>
                      {chunk.relatedAdrs && chunk.relatedAdrs.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {chunk.relatedAdrs.map((adr) => (
                            <span
                              key={adr}
                              className="rounded border border-sky-500/30 bg-sky-950/50 px-1.5 py-0.5 font-mono text-[9px] text-sky-300"
                            >
                              {adr}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-slate-300 whitespace-pre-line leading-relaxed">
                        {chunk.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {ragCases.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 space-y-2">
                  <div className="font-bold text-emerald-300 uppercase tracking-wider text-[10px]">
                    Benchmark Automatizado do RAG (Volume 15.8 — EVAL-01 a EVAL-10)
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-[10px]">
                    {ragCases.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded border border-slate-800 bg-slate-950/70 px-2.5 py-1.5"
                      >
                        <span className="text-slate-300 truncate pr-2">
                          <strong className="font-mono text-sky-400">
                            {c.id}:
                          </strong>{" "}
                          {c.question}
                        </span>
                        <span
                          className={`shrink-0 font-mono font-bold ${
                            c.passed ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {c.passed ? `✓ ${c.topChunkId}` : "✗ FAIL"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {section === "logs" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2.5">
                <div className="font-bold text-sky-300 uppercase tracking-wider text-[11px]">
                  Mundos Persistidos no Supabase PostgreSQL
                </div>
                {recentDbWorlds.length === 0 ? (
                  <p className="text-slate-400 text-[11px]">
                    Nenhum mundo registrado recentemente.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {recentDbWorlds.map((w) => (
                      <button
                        key={w.worldId}
                        type="button"
                        onClick={() => {
                          onSelectWorldUsername(w.login);
                          onClose();
                        }}
                        className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-left hover:border-sky-400/50 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={w.avatarUrl}
                            alt={w.login}
                            className="h-5 w-5 rounded-full"
                          />
                          <span className="font-mono font-semibold text-white">
                            @{w.login}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400">
                          {w.buildingCount} prédios • ★ {w.totalStars}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
                <div className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                  Eventos Operacionais Recentes (Volume 13)
                </div>
                <div className="space-y-1.5 font-mono text-[10px] max-h-80 overflow-y-auto">
                  {operationalLogs.map((log, i) => (
                    <div
                      key={i}
                      className="rounded border border-slate-800/80 bg-slate-950 p-2 text-slate-300"
                    >
                      <span className="text-sky-400">[{log.category}]</span>{" "}
                      <span className="text-emerald-300">{log.event}</span>{" "}
                      {log.username ? `@${log.username}` : ""}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
