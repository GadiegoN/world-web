/**
 * VOLUME 06 — SISTEMA DE CONSTRUÇÕES
 * Converte métricas reais de repositórios do GitHub em parâmetros geométricos e visuais
 * com normalização logarítmica limitada e rastreabilidade formal por atributo.
 */

import {
  Building,
  BuildingAppearanceParameters,
  BuildingGeometryParameters,
  MetricTrace,
  Repository,
} from "@/domain/types";
import { createSeededRng, deriveBuildingSeed, GENERATION_VERSION } from "./seed";

export const FORMULA_VERSION = "1.0.0";

const LANGUAGE_COLOR_MAP: Record<string, { primary: string; secondary: string; emissive: string }> = {
  TypeScript: { primary: "#3178c6", secondary: "#1e40af", emissive: "#60a5fa" },
  JavaScript: { primary: "#eab308", secondary: "#a16207", emissive: "#fde047" },
  Python: { primary: "#3b82f6", secondary: "#fbbf24", emissive: "#93c5fd" },
  Rust: { primary: "#ea580c", secondary: "#7c2d12", emissive: "#fdba74" },
  Go: { primary: "#06b6d4", secondary: "#0e7490", emissive: "#67e8f9" },
  Java: { primary: "#dc2626", secondary: "#7f1d1d", emissive: "#fca5a5" },
  "C++": { primary: "#ec4899", secondary: "#831843", emissive: "#f472b6" },
  C: { primary: "#64748b", secondary: "#334155", emissive: "#cbd5e1" },
  "C#": { primary: "#16a34a", secondary: "#14532d", emissive: "#86efac" },
  HTML: { primary: "#f97316", secondary: "#9a3412", emissive: "#fdba74" },
  CSS: { primary: "#8b5cf6", secondary: "#4c1d95", emissive: "#c4b5fd" },
  Vue: { primary: "#10b981", secondary: "#065f46", emissive: "#6ee7b7" },
  Ruby: { primary: "#e11d48", secondary: "#881337", emissive: "#fda4af" },
  PHP: { primary: "#6366f1", secondary: "#312e81", emissive: "#a5b4fc" },
  Swift: { primary: "#f43f5e", secondary: "#881337", emissive: "#fda4af" },
  Kotlin: { primary: "#a855f7", secondary: "#581c87", emissive: "#d8b4fe" },
  Shell: { primary: "#22c55e", secondary: "#14532d", emissive: "#86efac" },
  Dart: { primary: "#0284c7", secondary: "#0c4a6e", emissive: "#7dd3fc" },
};

const DEFAULT_UNSPECIFIED_PALETTE = {
  primary: "#475569",
  secondary: "#1e293b",
  emissive: "#94a3b8",
};

/**
 * Normalização logarítmica limitada em [0, 1].
 * f(x) = min(1, log10(1 + max(0, x)) / log10(1 + maxRef))
 */
export function normalizeLogarithmic(value: number, maxRef: number): number {
  if (value <= 0) return 0;
  const norm = Math.log10(1 + value) / Math.log10(1 + maxRef);
  return Number(Math.max(0, Math.min(1, norm)).toFixed(4));
}

/**
 * Converte um único Repositório em uma Construção com rastreabilidade explícita.
 */
export function generateBuildingFromRepository(
  repo: Repository,
  cityId: string,
  placement: {
    x: number;
    y: number;
    z: number;
    rotationY: number;
    districtId: string;
    lotIndex: number;
  },
  referenceTimestampIso: string
): Building {
  const buildingSeed = deriveBuildingSeed(repo.githubRepositoryId, GENERATION_VERSION);
  const rng = createSeededRng(buildingSeed);
  const traces: MetricTrace[] = [];

  // 1. ALTURA E PAVIMENTOS <- Stars (stargazers_count)
  const starsVal = repo.stars.value ?? 0;
  const starsNorm = normalizeLogarithmic(starsVal, 5000); // 5000 stars atinge o topo da escala logarítmica padrão
  const minHeight = 4.5;
  const maxHeight = 68.0;
  const height = Number((minHeight + starsNorm * (maxHeight - minHeight)).toFixed(2));
  const floors = Math.max(1, Math.round(height / 2.2));

  traces.push({
    metricName: "stargazers_count (Stars)",
    sourceEndpoint: "GET /users/{username}/repos -> stargazers_count",
    rawValue: repo.stars.value,
    valueStatus: repo.stars.status,
    normalizationFormula: "min(1, log10(1 + stars) / log10(1 + 5000))",
    normalizedValue: starsNorm,
    visualAttribute: "height & floors (Altura e Pavimentos)",
    visualRange: [minHeight, maxHeight],
    resultingValue: `${height}m (${floors} pavimentos)`,
    formulaVersion: FORMULA_VERSION,
  });

  // 2. LARGURA / VOLUME DE BASE <- Tamanho do repositório (size em KB)
  const sizeVal = repo.sizeKb.value ?? 0;
  const sizeNorm = normalizeLogarithmic(sizeVal, 100000); // 100 MB ref
  const minWidth = 2.6;
  const maxWidth = 8.4;
  const width = Number((minWidth + sizeNorm * (maxWidth - minWidth)).toFixed(2));
  // Pequena variação determinística de proporção (aspect ratio) sem violar a área derivada dos dados
  const aspectDelta = 0.88 + rng() * 0.24;
  const depth = Number(Math.max(2.4, Math.min(8.8, width * aspectDelta)).toFixed(2));

  traces.push({
    metricName: "size (Tamanho em KB)",
    sourceEndpoint: "GET /users/{username}/repos -> size",
    rawValue: repo.sizeKb.value,
    valueStatus: repo.sizeKb.status,
    normalizationFormula: "min(1, log10(1 + sizeKb) / log10(1 + 100000))",
    normalizedValue: sizeNorm,
    visualAttribute: "width & depth (Largura e Profundidade da Base)",
    visualRange: [minWidth, maxWidth],
    resultingValue: `${width}m × ${depth}m`,
    formulaVersion: FORMULA_VERSION,
  });

  // 3. COMPLEXIDADE GEOMÉTRICA (Tiers / Escalonamento) <- Forks (forks_count)
  const forksVal = repo.forks.value ?? 0;
  const forksNorm = normalizeLogarithmic(forksVal, 1000);
  const tierCount = 1 + Math.floor(forksNorm * 3.99); // 1 a 4 blocos escalonados

  traces.push({
    metricName: "forks_count (Forks)",
    sourceEndpoint: "GET /users/{username}/repos -> forks_count",
    rawValue: repo.forks.value,
    valueStatus: repo.forks.status,
    normalizationFormula: "1 + floor(min(1, log10(1 + forks) / log10(1 + 1000)) * 3.99)",
    normalizedValue: forksNorm,
    visualAttribute: "tierCount (Complexidade de Escalonamento Arquitetônico)",
    visualRange: [1, 4],
    resultingValue: tierCount,
    formulaVersion: FORMULA_VERSION,
  });

  // 4. ANTENA / SINALIZADOR DE TOPO <- Open Issues (open_issues_count)
  const issuesVal = repo.openIssues.value ?? 0;
  const issuesNorm = normalizeLogarithmic(issuesVal, 250);
  const antennaHeight = issuesVal > 0 ? Number((1.2 + issuesNorm * 7.8).toFixed(2)) : 0;

  traces.push({
    metricName: "open_issues_count (Issues Abertas)",
    sourceEndpoint: "GET /users/{username}/repos -> open_issues_count",
    rawValue: repo.openIssues.value,
    valueStatus: repo.openIssues.status,
    normalizationFormula: "issues > 0 ? 1.2 + min(1, log10(1 + issues) / log10(1 + 250)) * 7.8 : 0",
    normalizedValue: issuesNorm,
    visualAttribute: "antennaHeight (Torre/Sinalizador de Topo)",
    visualRange: [0, 9.0],
    resultingValue: `${antennaHeight}m`,
    formulaVersion: FORMULA_VERSION,
  });

  // 5. IDENTIDADE CROMÁTICA <- Linguagem principal (language)
  // Tratamento explícito de ausência (Volume 06.6): linguagem ausente (null) usa paleta neutra documentada
  const langValue = repo.language.value;
  const palette =
    langValue && LANGUAGE_COLOR_MAP[langValue]
      ? LANGUAGE_COLOR_MAP[langValue]
      : DEFAULT_UNSPECIFIED_PALETTE;
  const languageLabel = langValue ?? "Não especificada";

  traces.push({
    metricName: "language (Linguagem Principal)",
    sourceEndpoint: "GET /users/{username}/repos -> language",
    rawValue: langValue,
    valueStatus: repo.language.status,
    normalizationFormula: "Mapeamento categórico determinístico (ausente -> paleta neutra #475569)",
    normalizedValue: langValue ? 1 : 0,
    visualAttribute: "primaryColor & secondaryColor (Fachada e Acabamento)",
    visualRange: "Paleta cromática por linguagem",
    resultingValue: `${languageLabel} (${palette.primary})`,
    formulaVersion: FORMULA_VERSION,
  });

  // 6. ILUMINAÇÃO DE ATIVIDADE E VEGETAÇÃO SAZONAL <- Último push (pushed_at)
  let activityGlow = 0.2;
  let daysSincePush: number | null = null;
  if (repo.pushedAt) {
    const refTime = new Date(referenceTimestampIso).getTime();
    const pushTime = new Date(repo.pushedAt).getTime();
    if (!Number.isNaN(pushTime) && !Number.isNaN(refTime)) {
      daysSincePush = Math.max(0, Math.round((refTime - pushTime) / (1000 * 60 * 60 * 24)));
      // Decaimento suave ao longo de 365 dias
      activityGlow = Number(Math.max(0.15, Math.min(1.0, Math.exp(-daysSincePush / 180))).toFixed(3));
    }
  }

  // Classificação sazonal das árvores conforme recência de atualização do repositório:
  // <= 30 dias (< 1 mês): Verde exuberante (#22c55e)
  // 31 a 180 dias (1 a 6 meses): Menos verde / verde-oliva (#65a30d)
  // 181 a 365 dias (6 meses a 1 ano): Perde o verde e fica amarela (#eab308)
  // > 365 dias (> 1 ano): Seca / inverno terroso-acinzentado (#a8a29e)
  const vegetationSeason: BuildingAppearanceParameters["vegetationSeason"] =
    daysSincePush === null
      ? "arid_dry"
      : daysSincePush <= 30
        ? "lush_green"
        : daysSincePush <= 180
          ? "moderate_green"
          : daysSincePush <= 365
            ? "autumn_yellow"
            : "arid_dry";

  const foliageColor =
    vegetationSeason === "lush_green"
      ? "#22c55e"
      : vegetationSeason === "moderate_green"
        ? "#65a30d"
        : vegetationSeason === "autumn_yellow"
          ? "#eab308"
          : "#a8a29e";

  const seasonLabel =
    vegetationSeason === "lush_green"
      ? "Verde Exuberante (<=30d)"
      : vegetationSeason === "moderate_green"
        ? "Verde Moderado (1-6m)"
        : vegetationSeason === "autumn_yellow"
          ? "Amarelo Outonal (6-12m)"
          : "Seco/Inverno (>1 ano)";

  traces.push({
    metricName: "pushed_at (Recência de Atividade & Vegetação)",
    sourceEndpoint: "GET /users/{username}/repos -> pushed_at",
    rawValue: repo.pushedAt,
    valueStatus: repo.pushedAt ? "available" : "not_available",
    normalizationFormula:
      "glow = clamp(0.15, 1.0, exp(-days/180)); árvores: <=30d verde vivo, 31-180d oliva, 181-365d amarelo, >365d seco",
    normalizedValue: activityGlow,
    visualAttribute: "activityGlow & foliageColor (Janelas e Cor das Árvores)",
    visualRange: [0.15, 1.0],
    resultingValue:
      daysSincePush !== null
        ? `${activityGlow} • ${seasonLabel} (${daysSincePush}d desde o último push)`
        : `${activityGlow} • ${seasonLabel} (sem data)`,
    formulaVersion: FORMULA_VERSION,
  });

  // 7. ESTADO DO PROJETO (Arquivado, Fork e Tópicos) <- archived, fork, topics
  const isArchived = Boolean(repo.archived);
  const isFork = Boolean(repo.isFork);
  const topics = Array.isArray(repo.topics) ? repo.topics : [];

  const finalPrimaryColor = isArchived ? "#78716c" : palette.primary;
  const finalSecondaryColor = isArchived ? "#44403c" : palette.secondary;
  const finalEmissiveColor = isArchived ? "#d97706" : palette.emissive;
  const finalActivityGlow = isArchived ? 0.08 : activityGlow;
  const finalVegetationSeason = isArchived ? "arid_dry" : vegetationSeason;
  const finalFoliageColor = isArchived ? "#a8a29e" : foliageColor;

  traces.push({
    metricName: "archived, fork & topics (Estado e Classificação)",
    sourceEndpoint: "GET /users/{username}/repos -> archived, fork, topics",
    rawValue: `archived=${isArchived}, fork=${isFork}, topics=[${topics.slice(0, 4).join(", ")}]`,
    valueStatus: "available",
    normalizationFormula:
      "archived ? monumento histórico (#78716c, glow=0.08) : (fork ? emblema bifurcado : projeto autoral)",
    normalizedValue: isArchived ? 0 : isFork ? 0.5 : 1,
    visualAttribute: "isArchived, isFork & topics (Acabamento de Relíquia/Autoral)",
    visualRange: "Autoral | Fork | Arquivado",
    resultingValue: isArchived
      ? "🏛️ Monumento Histórico Arquivado"
      : isFork
        ? "🔀 Ramificação (Fork)"
        : "✨ Projeto Original Autoral",
    formulaVersion: FORMULA_VERSION,
  });

  // Escolha determinística de estilo de cobertura e arquétipo baseada nas métricas reais
  const roofStyles: BuildingGeometryParameters["roofStyle"][] = [
    "flat",
    "spire",
    "dome",
    "crown",
    " pitched",
  ];
  const roofStyle =
    starsNorm > 0.65
      ? "spire"
      : forksNorm > 0.5
        ? "crown"
        : sizeNorm > 0.6
          ? "dome"
          : roofStyles[Math.floor(rng() * 2)];

  const architecturalArchetype: BuildingAppearanceParameters["architecturalArchetype"] =
    tierCount >= 3
      ? "stepped-tower"
      : height > 30
        ? "citadel"
        : width > 5.5
          ? "campus-block"
          : antennaHeight > 3
            ? "observatory"
            : "monolith";

  const geometryParameters: BuildingGeometryParameters = {
    width,
    depth,
    height,
    floors,
    tierCount,
    roofStyle,
    antennaHeight,
    footprintScale: Number(((width * depth) / (minWidth * minWidth)).toFixed(2)),
  };

  const appearanceParameters: BuildingAppearanceParameters = {
    primaryColor: finalPrimaryColor,
    secondaryColor: finalSecondaryColor,
    emissiveColor: finalEmissiveColor,
    windowDensity: Number((0.45 + starsNorm * 0.45).toFixed(2)),
    activityGlow: finalActivityGlow,
    daysSinceLastPush: daysSincePush,
    vegetationSeason: finalVegetationSeason,
    foliageColor: finalFoliageColor,
    isArchived,
    isFork,
    topics,
    languageLabel,
    architecturalArchetype,
  };

  return {
    id: `bldg_${repo.githubRepositoryId}`,
    cityId,
    repositoryId: repo.id,
    githubRepositoryId: repo.githubRepositoryId,
    repositoryName: repo.name,
    repositoryUrl: repo.htmlUrl,
    position: placement,
    geometryParameters,
    appearanceParameters,
    traceability: traces,
    generationSeed: buildingSeed,
    generationVersion: GENERATION_VERSION,
  };
}

