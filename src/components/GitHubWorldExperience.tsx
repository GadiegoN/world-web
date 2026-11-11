"use client";

/**
 * VOLUME 01, 07 & 10 — EXPERIÊNCIA PRINCIPAL DO GITHUB WORLD
 * Orquestra o fluxo de pesquisa por username, estados de interface (Volume 10.7),
 * autenticação GitHub OAuth, controles de câmera/atmosfera e painéis modulares.
 */

import { SearchWorldResponse } from "@/application/searchAndGenerateWorld";
import { Building, SearchFlowState, World } from "@/domain/types";
import type { PersistedWorldSummary } from "@/infrastructure/persistence/worldRepository";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BadgeReadmeModal from "./BadgeReadmeModal";
import CitySidebar from "./CitySidebar";
import EngineeringAuditModal from "./EngineeringAuditModal";
import WorldCanvas, {
  AtmosphereTimeMode,
  CameraScaleMode,
  WorldCanvasHandle,
} from "./WorldCanvas";

const FLOW_STATE_LABELS: Record<
  SearchFlowState,
  { label: string; description: string; badgeClass: string }
> = {
  idle: {
    label: "Pesquisa não preenchida",
    description:
      "Informe um username do GitHub para localizar ou gerar seu mundo tridimensional.",
    badgeClass: "bg-slate-800 text-slate-300 border-slate-700",
  },
  searching: {
    label: "Pesquisa em andamento",
    description:
      "Consultando a existência do perfil e repositórios públicos na API do GitHub...",
    badgeClass: "bg-sky-950/90 text-sky-300 border-sky-500/40 animate-pulse",
  },
  user_found: {
    label: "Usuário encontrado",
    description: "Perfil identificado. Coletando e validando métricas públicas...",
    badgeClass: "bg-sky-900/80 text-sky-200 border-sky-400/50",
  },
  user_not_found: {
    label: "Usuário inexistente",
    description:
      "Nenhum perfil público corresponde ao username pesquisado no GitHub.",
    badgeClass: "bg-rose-950/90 text-rose-300 border-rose-500/50",
  },
  profile_unavailable: {
    label: "Perfil indisponível",
    description:
      "O perfil consultado possui restrições de acesso ou indisponibilidade.",
    badgeClass: "bg-amber-950/90 text-amber-300 border-amber-500/50",
  },
  github_error: {
    label: "Erro de comunicação com o GitHub",
    description: "Não foi possível completar a consulta externa no momento.",
    badgeClass: "bg-rose-950/90 text-rose-300 border-rose-500/50",
  },
  processing_data: {
    label: "Dados sendo processados",
    description:
      "Normalizando métricas e distinguindo valores zero de ausentes...",
    badgeClass:
      "bg-indigo-950/90 text-indigo-300 border-indigo-500/40 animate-pulse",
  },
  generating_world: {
    label: "Mundo em geração",
    description:
      "Executando geração procedural determinística (Planeta → Pangeia → Cidade → Construções)...",
    badgeClass:
      "bg-purple-950/90 text-purple-300 border-purple-500/40 animate-pulse",
  },
  city_ready: {
    label: "Cidade pronta para visualização",
    description: "Mundo gerado e validado com rastreabilidade completa.",
    badgeClass: "bg-emerald-950/90 text-emerald-300 border-emerald-500/40",
  },
  empty_repositories: {
    label: "Usuário sem repositórios públicos",
    description:
      "O usuário possui mundo, Pangeia e cidade demarcada, porém sem construções públicas.",
    badgeClass: "bg-amber-950/90 text-amber-300 border-amber-500/40",
  },
  partial_data: {
    label: "Dados parcialmente disponíveis",
    description:
      "Cidade renderizada com subconjunto disponível ou cache persistido.",
    badgeClass: "bg-amber-950/90 text-amber-200 border-amber-500/40",
  },
};

const QUICK_USERS = [
  "torvalds",
  "gaearon",
  "sindresorhus",
  "yyx990803",
  "tj",
  "shadcn",
];

interface GitHubWorldExperienceProps {
  initialUsername?: string;
}

export default function GitHubWorldExperience({
  initialUsername,
}: GitHubWorldExperienceProps) {
  const canvasRef = useRef<WorldCanvasHandle | null>(null);

  const [usernameInput, setUsernameInput] = useState(initialUsername ?? "");
  const [flowState, setFlowState] = useState<SearchFlowState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [world, setWorld] = useState<World | null>(null);

  const [cameraMode, setCameraMode] = useState<CameraScaleMode>("orbital");
  const [timeMode, setTimeMode] = useState<AtmosphereTimeMode>("night");
  const [showLabels, setShowLabels] = useState(true);
  const [highlightedLanguage, setHighlightedLanguage] = useState<string | null>(
    null
  );
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    null
  );
  const [repoFilter, setRepoFilter] = useState("");
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [showEngineeringModal, setShowEngineeringModal] = useState(false);

  // Sessão GitHub OAuth & Mundos Salvos no PostgreSQL
  const [authUser, setAuthUser] = useState<{
    githubId: number;
    login: string;
    displayName: string | null;
    avatarUrl: string;
  } | null>(null);
  const [recentDbWorlds, setRecentDbWorlds] = useState<PersistedWorldSummary[]>(
    []
  );

  // Comparador Versus
  const [compareInput, setCompareInput] = useState("");
  const [comparedWorld, setComparedWorld] = useState<World | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const transitionTimersRef = useRef<NodeJS.Timeout[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasAutoLoadedRef = useRef<string | null>(null);

  const clearTransitionTimers = () => {
    for (const t of transitionTimersRef.current) {
      clearTimeout(t);
    }
    transitionTimersRef.current = [];
  };

  const fetchSessionAndRecentWorlds = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const data = await res.json();
        setAuthUser(data.user ?? null);
        setRecentDbWorlds(data.recentWorlds ?? []);
      }
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    fetchSessionAndRecentWorlds();
  }, [fetchSessionAndRecentWorlds]);

  const executeSearch = useCallback(
    async (targetUsername: string, forceRefresh = false) => {
      const trimmed = targetUsername.trim();
      if (!trimmed) {
        setFlowState("idle");
        setErrorMessage("Digite um username do GitHub antes de pesquisar.");
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      clearTransitionTimers();
      setErrorMessage(null);
      setSelectedBuildingId(null);
      setFlowState("searching");
      setCameraMode("orbital");

      try {
        const res = await fetch(
          `/api/worlds/${encodeURIComponent(trimmed)}${
            forceRefresh ? "?refresh=true" : ""
          }`,
          { signal: controller.signal }
        );
        if (controller.signal.aborted) return;

        const payload = (await res.json()) as SearchWorldResponse;
        if (controller.signal.aborted) return;

        if (!payload.ok || !payload.world) {
          setFlowState(payload.flowState || "github_error");
          setErrorMessage(
            payload.error?.message ??
              "Não foi possível carregar o mundo solicitado."
          );
          return;
        }

        if (typeof window !== "undefined") {
          const shareUrl = `/u/${encodeURIComponent(payload.world.user.login)}`;
          window.history.replaceState(null, "", shareUrl);
        }

        setFlowState("user_found");
        const t1 = setTimeout(() => {
          if (controller.signal.aborted) return;
          setFlowState("generating_world");
          setWorld(payload.world!);
          setCameraMode("continental");
        }, 350);

        const t2 = setTimeout(() => {
          if (controller.signal.aborted) return;
          setFlowState(payload.flowState);
          setCameraMode("city");
          fetchSessionAndRecentWorlds();
        }, 1600);

        transitionTimersRef.current.push(t1, t2);
      } catch (err) {
        if ((err as Error)?.name === "AbortError" || controller.signal.aborted) {
          return;
        }
        setFlowState("github_error");
        setErrorMessage(
          "Falha de rede ao comunicar com o servidor do GitHub World."
        );
      }
    },
    [fetchSessionAndRecentWorlds]
  );

  useEffect(() => {
    if (initialUsername) {
      if (hasAutoLoadedRef.current === initialUsername) return;
      hasAutoLoadedRef.current = initialUsername;
      setUsernameInput(initialUsername);
      executeSearch(initialUsername, false);
      return;
    }
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const userParam = params.get("user");
      if (userParam && hasAutoLoadedRef.current !== userParam) {
        hasAutoLoadedRef.current = userParam;
        setUsernameInput(userParam);
        executeSearch(userParam, false);
      }
    }
  }, [initialUsername, executeSearch]);

  const executeCompareSearch = useCallback(async (targetUsername: string) => {
    const trimmed = targetUsername.trim();
    if (!trimmed) return;
    setIsComparing(true);
    setCompareError(null);
    try {
      const res = await fetch(`/api/worlds/${encodeURIComponent(trimmed)}`);
      const payload = (await res.json()) as SearchWorldResponse;
      if (!payload.ok || !payload.world) {
        setCompareError(
          payload.error?.message ?? "Usuário de comparação não encontrado."
        );
        return;
      }
      setComparedWorld(payload.world);
    } catch {
      setCompareError("Erro de rede ao consultar segundo mundo.");
    } finally {
      setIsComparing(false);
    }
  }, []);

  const selectedBuilding: Building | null = useMemo(() => {
    if (!world || !selectedBuildingId) return null;
    return world.buildings.find((b) => b.id === selectedBuildingId) ?? null;
  }, [world, selectedBuildingId]);

  const filteredBuildings = useMemo(() => {
    if (!world) return [];
    const q = repoFilter.trim().toLowerCase();
    return world.buildings.filter((b) => {
      if (
        highlightedLanguage &&
        b.appearanceParameters.languageLabel.toLowerCase() !==
          highlightedLanguage.toLowerCase()
      ) {
        return false;
      }
      if (!q) return true;
      return (
        b.repositoryName.toLowerCase().includes(q) ||
        b.appearanceParameters.languageLabel.toLowerCase().includes(q)
      );
    });
  }, [world, repoFilter, highlightedLanguage]);

  const cityAnalytics = useMemo(() => {
    if (!world) return null;
    const totalStars = world.repositories.reduce(
      (acc, r) => acc + (r.stars.value ?? 0),
      0
    );
    const totalForks = world.repositories.reduce(
      (acc, r) => acc + (r.forks.value ?? 0),
      0
    );
    const totalHeightMeters = Number(
      world.buildings
        .reduce((acc, b) => acc + b.geometryParameters.height, 0)
        .toFixed(1)
    );
    const tallestBuilding = world.buildings[0] ?? null;

    const nowMs = new Date(
      world.metadata.dataCollectedAt || world.generatedAt
    ).getTime();
    let minDaysSincePush = 9999;
    for (const r of world.repositories) {
      if (r.pushedAt) {
        const pMs = new Date(r.pushedAt).getTime();
        if (!Number.isNaN(pMs) && !Number.isNaN(nowMs)) {
          const d = Math.max(
            0,
            Math.round((nowMs - pMs) / (1000 * 60 * 60 * 24))
          );
          if (d < minDaysSincePush) minDaysSincePush = d;
        }
      }
    }

    const vegetationBadge =
      minDaysSincePush <= 30
        ? { label: "🌿 Vegetação Viva (< 1 mês)", color: "#22c55e" }
        : minDaysSincePush <= 180
          ? { label: "🌱 Verde Moderado (1–6m)", color: "#65a30d" }
          : minDaysSincePush <= 365
            ? { label: "🍂 Outono Amarelado (6–12m)", color: "#eab308" }
            : { label: "🏜️ Inverno Seco (> 1 ano)", color: "#a8a29e" };

    return {
      totalStars,
      totalForks,
      totalHeightMeters,
      tallestBuilding,
      vegetationBadge,
    };
  }, [world]);

  const handleSelectBuilding = useCallback((buildingId: string | null) => {
    setSelectedBuildingId(buildingId);
    if (buildingId) {
      setCameraMode("building");
    }
  }, []);

  const handleSelectUsername = useCallback(
    (login: string) => {
      setUsernameInput(login);
      executeSearch(login, false);
    },
    [executeSearch]
  );

  const handleCopyShareLink = () => {
    if (typeof window === "undefined") return;
    const url = world
      ? `${window.location.origin}/u/${encodeURIComponent(world.user.login)}`
      : window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 2200);
  };

  const currentFlowMeta = FLOW_STATE_LABELS[flowState];

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Universo 3D Principal */}
      <div className="relative flex-1 h-full">
        <WorldCanvas
          ref={canvasRef}
          world={world}
          cameraMode={cameraMode}
          timeMode={timeMode}
          showLabels={showLabels}
          highlightedLanguage={highlightedLanguage}
          selectedBuildingId={selectedBuildingId}
          onSelectBuilding={handleSelectBuilding}
          onCameraModeChange={setCameraMode}
          onSelectFollower={handleSelectUsername}
        />

        {/* Barra Superior: Pesquisa, Estados e Controles de Câmera / Atmosfera */}
        <header className="pointer-events-none absolute top-0 left-0 right-0 z-20 flex flex-wrap items-start justify-between gap-4 p-4 md:p-5">
          {/* Card Principal de Pesquisa */}
          <div className="pointer-events-auto flex flex-col gap-2.5 rounded-2xl border border-slate-800/90 bg-slate-950/85 p-4 shadow-2xl backdrop-blur-xl w-full max-w-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 border border-sky-400/40 text-sky-300 font-bold text-lg">
                  🌐
                </div>
                <div>
                  <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                    GITHUB WORLD
                    <span className="rounded-md bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-sky-300 border border-sky-500/30">
                      v1.4 • 3D ENGINE
                    </span>
                  </h1>
                  <p className="text-xs text-slate-400">
                    1 Mundo, 1 Planeta, 1 Pangeia e 1 Cidade 3D determinística
                    por usuário
                  </p>
                </div>
              </div>

              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${currentFlowMeta.badgeClass}`}
              >
                {currentFlowMeta.label}
              </span>
            </div>

            {/* Barra de Login com GitHub OAuth */}
            <div className="flex items-center justify-between rounded-xl border border-slate-800/90 bg-slate-900/60 px-3 py-1.5 text-xs">
              {authUser ? (
                <div className="flex w-full items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={authUser.avatarUrl}
                      alt={authUser.login}
                      className="h-5 w-5 rounded-full border border-emerald-400"
                    />
                    <span className="text-slate-300 truncate">
                      Conectado como{" "}
                      <strong className="text-white font-mono">
                        @{authUser.login}
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={
                        flowState === "searching" ||
                        flowState === "generating_world"
                      }
                      onClick={() => {
                        setUsernameInput(authUser.login);
                        executeSearch(authUser.login, false);
                      }}
                      className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 cursor-pointer"
                    >
                      🏠 Minha Cidade
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch("/api/auth/session", { method: "POST" });
                        setAuthUser(null);
                      }}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-400 hover:text-white cursor-pointer"
                    >
                      Sair
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400">
                    Entre com sua conta para pousar direto na sua cidade (5.000
                    req/h):
                  </span>
                  <a
                    href="/api/auth/github"
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-white hover:border-sky-400 hover:bg-slate-700 transition shrink-0"
                  >
                    <span>🐙</span>
                    <span>Entrar com GitHub</span>
                  </a>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                executeSearch(usernameInput, false);
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="Pesquisar username do GitHub (ex: torvalds, gaearon)..."
                  aria-label="Username do GitHub"
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-900/90 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                />
              </div>
              <button
                type="submit"
                disabled={
                  flowState === "searching" || flowState === "generating_world"
                }
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50 cursor-pointer"
              >
                {flowState === "searching" || flowState === "generating_world"
                  ? "Gerando..."
                  : "Explorar Mundo"}
              </button>
              {world && (
                <button
                  type="button"
                  disabled={
                    flowState === "searching" ||
                    flowState === "generating_world"
                  }
                  onClick={() => executeSearch(world.user.login, true)}
                  title="Regenerar sob demanda consultando o GitHub novamente"
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:border-sky-400/50 hover:text-white disabled:opacity-50 cursor-pointer"
                >
                  ↻
                </button>
              )}
            </form>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-slate-500">Exemplos:</span>
                {QUICK_USERS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    disabled={
                      flowState === "searching" ||
                      flowState === "generating_world"
                    }
                    onClick={() => {
                      setUsernameInput(u);
                      executeSearch(u, false);
                    }}
                    className="rounded-md border border-slate-800 bg-slate-900/80 px-2 py-0.5 text-[11px] font-mono text-slate-300 hover:border-sky-500/50 hover:text-sky-300 disabled:opacity-50 cursor-pointer"
                  >
                    @{u}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-400">
                {currentFlowMeta.description}
              </span>
            </div>

            {recentDbWorlds.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto border-t border-slate-800/80 pt-2 text-[11px]">
                <span className="text-slate-500 shrink-0">🌍 No Banco:</span>
                {recentDbWorlds.slice(0, 6).map((w) => (
                  <button
                    key={w.worldId}
                    type="button"
                    disabled={
                      flowState === "searching" ||
                      flowState === "generating_world"
                    }
                    onClick={() => {
                      setUsernameInput(w.login);
                      executeSearch(w.login, false);
                    }}
                    className="flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/90 px-2 py-0.5 font-mono text-[10px] text-slate-200 hover:border-emerald-500/50 hover:text-emerald-300 disabled:opacity-50 shrink-0 cursor-pointer"
                  >
                    {w.avatarUrl && (
                      <img
                        src={w.avatarUrl}
                        alt={w.login}
                        className="h-3.5 w-3.5 rounded-full"
                      />
                    )}
                    <span>@{w.login}</span>
                    <span className="text-amber-300">★{w.totalStars}</span>
                  </button>
                ))}
              </div>
            )}

            {errorMessage && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/60 px-3 py-2 text-xs text-rose-200">
                <strong className="font-semibold">Atenção:</strong>{" "}
                {errorMessage}
              </div>
            )}
            {world && world.metadata.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-950/50 px-3 py-1.5 text-[11px] text-amber-200">
                {world.metadata.warnings.join(" ")}
              </div>
            )}
          </div>

          {/* Controles de Escala de Câmera, Atmosfera e Exportação Social */}
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-slate-800/90 bg-slate-950/85 p-1.5 shadow-xl backdrop-blur-xl">
              <button
                type="button"
                onClick={() => {
                  setSelectedBuildingId(null);
                  setCameraMode("orbital");
                }}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                  cameraMode === "orbital"
                    ? "bg-sky-500 text-slate-950 font-semibold"
                    : "text-slate-300 hover:bg-slate-900"
                }`}
              >
                1. Orbital
              </button>
              <button
                type="button"
                disabled={!world}
                onClick={() => {
                  setSelectedBuildingId(null);
                  setCameraMode("continental");
                }}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition cursor-pointer disabled:opacity-40 ${
                  cameraMode === "continental"
                    ? "bg-sky-500 text-slate-950 font-semibold"
                    : "text-slate-300 hover:bg-slate-900"
                }`}
              >
                2. Pangeia
              </button>
              <button
                type="button"
                disabled={!world}
                onClick={() => {
                  setSelectedBuildingId(null);
                  setCameraMode("city");
                }}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition cursor-pointer disabled:opacity-40 ${
                  cameraMode === "city"
                    ? "bg-sky-500 text-slate-950 font-semibold"
                    : "text-slate-300 hover:bg-slate-900"
                }`}
              >
                3. Cidade ({world ? world.buildings.length : 0})
              </button>
              <button
                type="button"
                disabled={!world}
                onClick={() => {
                  setSelectedBuildingId(null);
                  setCameraMode("drone");
                }}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition cursor-pointer disabled:opacity-40 ${
                  cameraMode === "drone"
                    ? "bg-sky-500 text-slate-950 font-semibold"
                    : "text-slate-300 hover:bg-slate-900"
                }`}
              >
                🚁 Tour Drone
              </button>
              <button
                type="button"
                disabled={!world}
                onClick={() => {
                  setSelectedBuildingId(null);
                  setCameraMode("street");
                }}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition cursor-pointer disabled:opacity-40 ${
                  cameraMode === "street"
                    ? "bg-sky-500 text-slate-950 font-semibold"
                    : "text-slate-300 hover:bg-slate-900"
                }`}
              >
                🚶 Rua
              </button>
              {selectedBuilding && (
                <button
                  type="button"
                  onClick={() => setCameraMode("building")}
                  className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                    cameraMode === "building"
                      ? "bg-sky-500 text-slate-950 font-semibold"
                      : "text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  🏢 Construção
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-800/90 bg-slate-950/85 p-1.5 shadow-xl backdrop-blur-xl">
              {(
                [
                  { id: "night", label: "🌙 Noite" },
                  { id: "sunset", label: "🌅 Crepúsculo" },
                  { id: "day", label: "☀️ Dia" },
                  { id: "cyber", label: "⚡ Cyber" },
                ] as { id: AtmosphereTimeMode; label: string }[]
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setTimeMode(preset.id)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
                    timeMode === preset.id
                      ? "bg-indigo-500/30 text-indigo-200 border border-indigo-400/50"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`}
                >
                  {preset.label}
                </button>
              ))}

              <span className="h-4 w-px bg-slate-800 mx-0.5" />

              <button
                type="button"
                onClick={() => setShowLabels((v) => !v)}
                className={`rounded-lg px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
                  showLabels
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "text-slate-400 hover:bg-slate-900"
                }`}
              >
                🏷️ Rótulos 3D
              </button>

              <button
                type="button"
                onClick={() => canvasRef.current?.exportPostcardPng()}
                className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/25 cursor-pointer"
                title="Baixar cartão postal em alta resolução (.png)"
              >
                📸 Postal PNG
              </button>

              {world && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowBadgeModal(true)}
                    className="rounded-lg border border-purple-500/40 bg-purple-500/15 px-2.5 py-1 text-[11px] font-semibold text-purple-300 hover:bg-purple-500/25 cursor-pointer"
                    title="Gerar Card SVG dinâmico para o README do seu perfil no GitHub"
                  >
                    🪪 Badge README
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-sky-400/50 cursor-pointer"
                  >
                    {copiedShareLink ? "✓ Link Copiado!" : "🔗 Compartilhar"}
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Telemetria Geográfica no Rodapé Esquerdo */}
        {world && cityAnalytics && (
          <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-2 md:left-6 md:bottom-6">
            <div className="pointer-events-auto flex items-center gap-3.5 rounded-2xl border border-slate-800/90 bg-slate-950/85 px-4 py-2.5 text-xs shadow-xl backdrop-blur-xl">
              <img
                src={world.user.avatarUrl}
                alt={world.user.login}
                className="h-10 w-10 rounded-full border border-sky-400/50"
              />
              <div>
                <div className="font-semibold text-white flex items-center gap-2">
                  {world.user.displayName ?? world.user.login}
                  <span className="font-mono text-[11px] text-sky-400">
                    @{world.user.login}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Seed: {world.seed} • Pangeia (
                  {world.city.sphericalPosition.latitude}°,{" "}
                  {world.city.sphericalPosition.longitude}°) • ★{" "}
                  {cityAnalytics.totalStars} Stars • Skyline:{" "}
                  {cityAnalytics.totalHeightMeters}m •{" "}
                  <span style={{ color: cityAnalytics.vegetationBadge.color }}>
                    {cityAnalytics.vegetationBadge.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modais Sob Demanda */}
        {showBadgeModal && world && (
          <BadgeReadmeModal
            world={world}
            onClose={() => setShowBadgeModal(false)}
          />
        )}
        {showEngineeringModal && (
          <EngineeringAuditModal
            world={world}
            recentDbWorlds={recentDbWorlds}
            onSelectWorldUsername={(login) => {
              setUsernameInput(login);
              executeSearch(login, false);
            }}
            onClose={() => setShowEngineeringModal(false)}
          />
        )}
      </div>

      {/* Painel Lateral Enxuto (Cidade, Comunidade e Versus) */}
      <CitySidebar
        world={world}
        selectedBuilding={selectedBuilding}
        filteredBuildings={filteredBuildings}
        repoFilter={repoFilter}
        onRepoFilterChange={setRepoFilter}
        highlightedLanguage={highlightedLanguage}
        onHighlightLanguage={setHighlightedLanguage}
        onSelectBuilding={handleSelectBuilding}
        onCameraModeChange={setCameraMode}
        onSelectUsername={handleSelectUsername}
        cityAnalytics={cityAnalytics}
        comparedWorld={comparedWorld}
        compareInput={compareInput}
        onCompareInputChange={setCompareInput}
        onExecuteCompare={executeCompareSearch}
        isComparing={isComparing}
        compareError={compareError}
        onOpenEngineeringModal={() => setShowEngineeringModal(true)}
      />
    </div>
  );
}
