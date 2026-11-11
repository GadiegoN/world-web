"use client";

/**
 * VOLUME 01.5, 06.3 & 10.4 — PAINEL LATERAL DA CIDADE (INSPEÇÃO, COMUNIDADE E VERSUS)
 * Focado exclusivamente na experiência do usuário final:
 * 1. 🏙️ Cidade & Construções (com Matriz de Rastreabilidade por edifício e filtro por linguagem)
 * 2. 🤝 Comunidade (Contribuidores nas Avenidas e Portais de Seguidores na Pangeia)
 * 3. ⚔️ Versus (Comparador Lado a Lado entre dois Mundos)
 */

import { Building, World } from "@/domain/types";
import { CameraScaleMode } from "@/rendering/atmospherePresets";
import React, { useState } from "react";

interface CitySidebarProps {
  world: World | null;
  selectedBuilding: Building | null;
  filteredBuildings: Building[];
  repoFilter: string;
  onRepoFilterChange: (v: string) => void;
  highlightedLanguage: string | null;
  onHighlightLanguage: (lang: string | null) => void;
  onSelectBuilding: (buildingId: string | null) => void;
  onCameraModeChange: (mode: CameraScaleMode) => void;
  onSelectUsername: (username: string) => void;
  cityAnalytics: {
    totalStars: number;
    totalForks: number;
    totalHeightMeters: number;
    tallestBuilding: Building | null;
    vegetationBadge: { label: string; color: string };
  } | null;
  comparedWorld: World | null;
  compareInput: string;
  onCompareInputChange: (v: string) => void;
  onExecuteCompare: (username: string) => void;
  isComparing: boolean;
  compareError: string | null;
  onOpenEngineeringModal: () => void;
}

export default function CitySidebar({
  world,
  selectedBuilding,
  filteredBuildings,
  repoFilter,
  onRepoFilterChange,
  highlightedLanguage,
  onHighlightLanguage,
  onSelectBuilding,
  onCameraModeChange,
  onSelectUsername,
  cityAnalytics,
  comparedWorld,
  compareInput,
  onCompareInputChange,
  onExecuteCompare,
  isComparing,
  compareError,
  onOpenEngineeringModal,
}: CitySidebarProps) {
  const [activeTab, setActiveTab] = useState<"city" | "community" | "versus">(
    "city"
  );

  return (
    <aside className="z-20 flex h-full w-96 flex-col border-l border-slate-800/90 bg-slate-950/95 backdrop-blur-xl">
      {/* Abas Principais Enxutas (focadas na experiência 3D) */}
      <div className="grid grid-cols-3 border-b border-slate-800 p-1.5 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("city")}
          className={`rounded-lg py-2 text-xs font-semibold transition cursor-pointer ${
            activeTab === "city"
              ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
              : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
          }`}
        >
          🏙️ Cidade ({world ? world.buildings.length : 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("community")}
          className={`rounded-lg py-2 text-xs font-semibold transition cursor-pointer ${
            activeTab === "community"
              ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
              : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
          }`}
        >
          🤝 Rede (
          {world
            ? (world.city.contributors?.length ?? 0) +
              (world.city.followerOutposts?.length ?? 0)
            : 0}
          )
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("versus")}
          className={`rounded-lg py-2 text-xs font-semibold transition cursor-pointer ${
            activeTab === "versus"
              ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
              : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
          }`}
        >
          ⚔️ Versus
        </button>
      </div>

      {/* ABA 1: CIDADE & CONSTRUÇÕES */}
      {activeTab === "city" && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {!world ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-slate-400">
              <div className="mb-3 text-3xl">🛰️</div>
              <p className="text-sm font-medium text-slate-200">
                Sonda em Órbita Planetária
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Pesquise um usuário do GitHub ou clique em um dos exemplos para
                pousar na Pangeia e explorar sua cidade.
              </p>
            </div>
          ) : selectedBuilding ? (
            <div className="flex flex-1 flex-col overflow-y-auto p-4 space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    onSelectBuilding(null);
                    onCameraModeChange("city");
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-sky-300 hover:bg-slate-800 cursor-pointer"
                >
                  ← Voltar à Cidade
                </button>
                <a
                  href={selectedBuilding.repositoryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-sky-400 hover:underline font-mono"
                >
                  Abrir no GitHub ↗
                </a>
              </div>

              <div className="rounded-xl border border-sky-500/30 bg-slate-900/90 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-white truncate">
                    {selectedBuilding.repositoryName}
                  </h2>
                  <span
                    className="rounded-md px-2 py-0.5 text-[10px] font-semibold text-white shrink-0"
                    style={{
                      backgroundColor:
                        selectedBuilding.appearanceParameters.primaryColor,
                    }}
                  >
                    {selectedBuilding.appearanceParameters.languageLabel}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="rounded-lg bg-slate-950/80 p-2 border border-slate-800">
                    <div className="text-slate-400">Altura</div>
                    <div className="font-mono font-bold text-sky-300">
                      {selectedBuilding.geometryParameters.height}m
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-950/80 p-2 border border-slate-800">
                    <div className="text-slate-400">Pavimentos</div>
                    <div className="font-mono font-bold text-sky-300">
                      {selectedBuilding.geometryParameters.floors}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-950/80 p-2 border border-slate-800">
                    <div className="text-slate-400">Base</div>
                    <div className="font-mono font-bold text-sky-300">
                      {selectedBuilding.geometryParameters.width}×
                      {selectedBuilding.geometryParameters.depth}m
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>
                    Arquétipo:{" "}
                    {
                      selectedBuilding.appearanceParameters
                        .architecturalArchetype
                    }
                  </span>
                  <span>
                    {selectedBuilding.appearanceParameters.isArchived
                      ? "🏛️ Arquivado"
                      : selectedBuilding.appearanceParameters.isFork
                        ? "🔀 Fork"
                        : "✨ Autoral"}
                  </span>
                </div>
                {(selectedBuilding.appearanceParameters.topics?.length ?? 0) >
                  0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedBuilding.appearanceParameters.topics!
                      .slice(0, 6)
                      .map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-sky-500/30 bg-sky-950/60 px-2 py-0.5 font-mono text-[10px] text-sky-300"
                        >
                          #{t}
                        </span>
                      ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Matriz de Rastreabilidade (Dados → Geometria)
                </h3>
                <div className="space-y-2.5">
                  {selectedBuilding.traceability.map((trace, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sky-300">
                          {trace.metricName}
                        </span>
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                          status: {trace.valueStatus}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300">
                        <span className="text-slate-500">Valor Bruto:</span>{" "}
                        <code className="text-white font-mono">
                          {trace.rawValue === null
                            ? "null (ausente)"
                            : String(trace.rawValue)}
                        </code>{" "}
                        → <span className="text-slate-500">Norm:</span>{" "}
                        <code className="text-sky-300 font-mono">
                          {trace.normalizedValue}
                        </code>
                      </div>
                      <div className="text-[11px] text-slate-300">
                        <span className="text-slate-500">Atributo Visual:</span>{" "}
                        {trace.visualAttribute}
                      </div>
                      <div className="text-[11px] text-emerald-300 font-medium">
                        Resultado: {trace.resultingValue}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">
                        Fórmula (v{trace.formulaVersion}):{" "}
                        {trace.normalizationFormula}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              {cityAnalytics && (
                <div className="grid grid-cols-3 gap-1.5 p-3 border-b border-slate-800 bg-slate-900/40 text-center text-[11px]">
                  <div className="rounded-lg border border-slate-800/80 bg-slate-950/70 p-2">
                    <div className="text-slate-400">Estrelas</div>
                    <div className="font-mono font-bold text-amber-300">
                      ★ {cityAnalytics.totalStars.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-800/80 bg-slate-950/70 p-2">
                    <div className="text-slate-400">Maior Torre</div>
                    <div className="font-mono font-bold text-sky-300">
                      {cityAnalytics.tallestBuilding
                        ? `${cityAnalytics.tallestBuilding.geometryParameters.height}m`
                        : "0m"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-800/80 bg-slate-950/70 p-2">
                    <div className="text-slate-400">Distritos</div>
                    <div className="font-mono font-bold text-emerald-300">
                      {world.city.districts.length}
                    </div>
                  </div>
                </div>
              )}

              {/* Filtro por Distrito de Linguagem */}
              {world.city.districts.length > 1 && (
                <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-800 bg-slate-950/60 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onHighlightLanguage(null)}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 cursor-pointer ${
                      !highlightedLanguage
                        ? "bg-sky-500 text-slate-950 font-semibold"
                        : "bg-slate-900 text-slate-400 hover:text-white"
                    }`}
                  >
                    Todas
                  </button>
                  {world.city.districts.map((d) => {
                    const active =
                      highlightedLanguage?.toLowerCase() ===
                      d.language.toLowerCase();
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() =>
                          onHighlightLanguage(active ? null : d.language)
                        }
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 cursor-pointer ${
                          active
                            ? "bg-sky-500 text-slate-950 font-semibold"
                            : "bg-slate-900 text-slate-300 hover:text-white"
                        }`}
                      >
                        {d.language} ({d.repositoryCount})
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="p-3 border-b border-slate-800">
                <input
                  type="text"
                  value={repoFilter}
                  onChange={(e) => onRepoFilterChange(e.target.value)}
                  placeholder="Filtrar construções por nome ou linguagem..."
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none"
                />
              </div>

              {world.buildings.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Este usuário não possui repositórios públicos para converter em
                  construções. A Praça Marco Zero permanece demarcada na Pangeia.
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
                  {filteredBuildings.map((b) => {
                    const stars = b.traceability[0]?.rawValue ?? 0;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => onSelectBuilding(b.id)}
                        className="w-full text-left p-3 hover:bg-slate-900/90 transition flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{
                                backgroundColor:
                                  b.appearanceParameters.primaryColor,
                              }}
                            />
                            <span className="font-semibold text-xs text-white truncate">
                              {b.repositoryName}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                            <span>{b.appearanceParameters.languageLabel}</span>
                            <span>•</span>
                            <span>★ {stars}</span>
                            <span>•</span>
                            <span>Lote #{b.position.lotIndex + 1}</span>
                          </div>
                        </div>
                        <div className="text-right font-mono text-xs text-sky-300 shrink-0">
                          <div>{b.geometryParameters.height}m</div>
                          <div className="text-[10px] text-slate-500">
                            {b.geometryParameters.floors} pav.
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ABA 2: REDE / COMUNIDADE (SEGUIDORES NA PANGEIA E CONTRIBUIDORES NAS AVENIDAS) */}
      {activeTab === "community" && (
        <div className="flex flex-1 flex-col overflow-y-auto p-4 space-y-4 text-xs">
          {!world ? (
            <p className="text-slate-400 text-center py-8">
              Carregue um mundo para visualizar os contribuidores e seguidores.
            </p>
          ) : (
            <>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-300 uppercase tracking-wider text-[11px]">
                    🤝 Portais de Seguidores na Pangeia (
                    {world.city.followerOutposts?.length ?? 0})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectBuilding(null);
                      onCameraModeChange("continental");
                    }}
                    className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
                  >
                    🌍 Ver na Pangeia
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Clique em qualquer seguidor abaixo para viajar até o mundo e a
                  cidade 3D dele:
                </p>
                {(world.city.followerOutposts?.length ?? 0) === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    Nenhum seguidor público retornado.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {world.city.followerOutposts!.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => onSelectUsername(f.login)}
                        className="flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-950 px-2.5 py-1 text-[11px] text-slate-200 hover:border-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                      >
                        {f.avatarUrl && (
                          <img
                            src={f.avatarUrl}
                            alt={f.login}
                            className="h-4 w-4 rounded-full"
                          />
                        )}
                        <span className="font-mono">@{f.login}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-2.5">
                <div className="font-bold text-sky-300 uppercase tracking-wider text-[11px]">
                  🚗 Contribuidores nas Avenidas (
                  {world.city.contributors?.length ?? 0})
                </div>
                <p className="text-[11px] text-slate-400">
                  Contribuidores reais dos repositórios trafegando pelas
                  avenidas da cidade:
                </p>
                {(world.city.contributors?.length ?? 0) === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    Nenhum contribuidor listado nos repositórios principais.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {world.city.contributors.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 py-1.5"
                      >
                        <button
                          type="button"
                          onClick={() => onSelectUsername(c.login)}
                          className="flex items-center gap-2 hover:text-sky-300 cursor-pointer"
                        >
                          {c.avatarUrl && (
                            <img
                              src={c.avatarUrl}
                              alt={c.login}
                              className="h-4 w-4 rounded-full"
                            />
                          )}
                          <span className="font-mono font-semibold">
                            @{c.login}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const b = world.buildings.find(
                              (bldg) => bldg.repositoryId === c.repositoryId
                            );
                            if (b) onSelectBuilding(b.id);
                          }}
                          className="text-[10px] text-slate-400 hover:text-white font-mono truncate max-w-[140px] cursor-pointer"
                        >
                          {c.contributions} commits → {c.repositoryName}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ABA 3: COMPARADOR DE MUNDOS (VERSUS) */}
      {activeTab === "versus" && (
        <div className="flex flex-1 flex-col overflow-y-auto p-4 space-y-4 text-xs">
          <div>
            <h3 className="font-bold text-sky-300 uppercase tracking-wider text-[11px]">
              Comparador de Cidades & Mundos (Volume 01.5)
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Compare a escala arquitetônica, altura do skyline e métricas entre
              dois mundos independentes.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onExecuteCompare(compareInput);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={compareInput}
              onChange={(e) => onCompareInputChange(e.target.value)}
              placeholder="Segundo username (ex: yyx990803)..."
              className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isComparing}
              className="rounded-lg bg-sky-500 px-3 py-1.5 font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 cursor-pointer"
            >
              {isComparing ? "..." : "Comparar"}
            </button>
          </form>

          {compareError && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-950/50 p-2.5 text-[11px] text-rose-200">
              {compareError}
            </div>
          )}

          {world && comparedWorld && (
            <div className="grid grid-cols-2 gap-2.5">
              {[world, comparedWorld].map((w, idx) => {
                const stars = w.repositories.reduce(
                  (a, r) => a + (r.stars.value ?? 0),
                  0
                );
                const maxH = w.buildings[0]?.geometryParameters.height ?? 0;
                return (
                  <div
                    key={`${w.id}_${idx}`}
                    className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <img
                        src={w.user.avatarUrl}
                        alt={w.user.login}
                        className="h-6 w-6 rounded-full"
                      />
                      <span className="font-mono font-bold text-white truncate">
                        @{w.user.login}
                      </span>
                    </div>
                    <div className="space-y-1 font-mono text-[11px] text-slate-300">
                      <div>Prédios: {w.buildings.length}</div>
                      <div>Stars: ★ {stars.toLocaleString()}</div>
                      <div>Topo: {maxH}m</div>
                      <div>Raio: {w.city.urbanRadius}m</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Rodapé Discreto para Ferramentas de Engenharia / RAG */}
      <div className="border-t border-slate-800/90 bg-slate-950 px-3 py-2 flex items-center justify-between text-[11px] text-slate-400">
        <span className="font-mono text-[10px]">
          Gen v{world?.generationVersion ?? "1.5.0"}
        </span>
        <button
          type="button"
          onClick={onOpenEngineeringModal}
          className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-[10px] font-medium text-slate-300 hover:border-sky-500/40 hover:text-sky-300 cursor-pointer"
        >
          🛠️ Auditoria, Domínio & RAG
        </button>
      </div>
    </aside>
  );
}

