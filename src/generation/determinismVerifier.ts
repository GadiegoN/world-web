/**
 * VOLUME 12 — TESTES E QUALIDADE (Domínio, Determinismo e Integridade)
 * Verifica programaticamente:
 * - Identidade e associação entre Usuário, Mundo, Planeta, Pangeia, Cidade e Construções
 * - Determinismo estrito (mesmas entradas + mesma versão = mesma semente, mesma posição da cidade e mesmos parâmetros geométricos)
 * - Distinção entre métricas ausentes (not_available) e valores iguais a zero (zero)
 */

import { validateWorldIntegrity } from "@/domain/integrity";
import { GitHubUser, Repository } from "@/domain/types";
import { generateWorld } from "./worldGenerator";

export function verifyDeterministicGenerationSuite(): {
  passed: boolean;
  assertions: string[];
} {
  const mockUser: GitHubUser = {
    id: "usr_1024",
    githubId: 1024,
    login: "octocat-architect",
    displayName: "Octocat Architect",
    avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
    profileUrl: "https://github.com/octocat",
    bio: "Building 3D worlds",
    publicReposCount: 2,
    followers: 120,
    following: 15,
    githubCreatedAt: "2020-01-01T00:00:00Z",
    createdAt: "2026-11-10T00:00:00Z",
    updatedAt: "2026-11-10T00:00:00Z",
  };

  const mockRepos: Repository[] = [
    {
      id: "repo_9001",
      githubRepositoryId: 9001,
      ownerId: "usr_1024",
      name: "core-engine",
      fullName: "octocat-architect/core-engine",
      description: "Core 3D engine",
      htmlUrl: "https://github.com/octocat/core-engine",
      language: { value: "TypeScript", status: "available", source: "test" },
      stars: { value: 450, status: "available", source: "test" },
      forks: { value: 32, status: "available", source: "test" },
      openIssues: { value: 0, status: "zero", source: "test" },
      sizeKb: { value: 4200, status: "available", source: "test" },
      isFork: false,
      archived: false,
      topics: ["3d", "webgl"],
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
      pushedAt: "2026-10-15T00:00:00Z",
    },
    {
      id: "repo_9002",
      githubRepositoryId: 9002,
      ownerId: "usr_1024",
      name: "mystery-docs",
      fullName: "octocat-architect/mystery-docs",
      description: null,
      htmlUrl: "https://github.com/octocat/mystery-docs",
      language: { value: null, status: "not_available", source: "test" },
      stars: { value: 0, status: "zero", source: "test" },
      forks: { value: 0, status: "zero", source: "test" },
      openIssues: { value: 5, status: "available", source: "test" },
      sizeKb: { value: 120, status: "available", source: "test" },
      isFork: false,
      archived: false,
      topics: [],
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2026-09-01T00:00:00Z",
      pushedAt: null,
    },
    {
      id: "repo_9003",
      githubRepositoryId: 9003,
      ownerId: "usr_1024",
      name: "legacy-monument",
      fullName: "octocat-architect/legacy-monument",
      description: "Historical archived fork repository",
      htmlUrl: "https://github.com/octocat/legacy-monument",
      language: { value: "Rust", status: "available", source: "test" },
      stars: { value: 85, status: "available", source: "test" },
      forks: { value: 12, status: "available", source: "test" },
      openIssues: { value: 1, status: "available", source: "test" },
      sizeKb: { value: 980, status: "available", source: "test" },
      isFork: true,
      archived: true,
      topics: ["legacy", "monument"],
      createdAt: "2021-01-01T00:00:00Z",
      updatedAt: "2024-05-01T00:00:00Z",
      pushedAt: "2024-05-01T00:00:00Z",
    },
  ];

  const mockFollowers = [
    {
      id: 3001,
      login: "torvalds-neighbor",
      avatar_url: "https://avatars.githubusercontent.com/u/1024025?v=4",
      html_url: "https://github.com/torvalds",
    },
  ];

  const refTime = "2026-11-10T12:00:00Z";
  const worldRunA = generateWorld({
    user: mockUser,
    repositories: mockRepos,
    followers: mockFollowers,
    dataCollectedAt: refTime,
  });

  const worldRunB = generateWorld({
    user: mockUser,
    repositories: [...mockRepos].reverse(), // Ordem invertida de entrada não deve alterar resultado!
    followers: mockFollowers,
    dataCollectedAt: refTime,
  });

  const assertions: string[] = [];

  // 1. Integridade de domínio
  const integrityA = validateWorldIntegrity(worldRunA);
  if (!integrityA.valid) {
    throw new Error(`Falha de integridade: ${integrityA.violations.join(", ")}`);
  }
  assertions.push("Integridade do domínio (Volume 02.5) validada.");

  // 2. Determinismo de semente e coordenadas da cidade
  if (worldRunA.seed !== worldRunB.seed) {
    throw new Error("A semente do mundo divergiu para as mesmas entradas.");
  }
  if (
    worldRunA.city.position.x !== worldRunB.city.position.x ||
    worldRunA.city.position.y !== worldRunB.city.position.y ||
    worldRunA.city.position.z !== worldRunB.city.position.z
  ) {
    throw new Error("A posição espacial 3D da cidade divergiu.");
  }
  assertions.push("Determinismo de semente e posicionamento da cidade na Pangeia validado.");

  // 3. Determinismo de distribuição e parâmetros geométricos das construções
  if (
    JSON.stringify(worldRunA.buildings) !== JSON.stringify(worldRunB.buildings)
  ) {
    throw new Error("A distribuição ou geometria das construções divergiu.");
  }
  assertions.push("Determinismo de distribuição urbana e geometria das construções validado.");

  // 4. Distinção entre valor zero e ausente (Volume 02.5 & 06.6)
  const docBuilding = worldRunA.buildings.find((b) => b.githubRepositoryId === 9002);
  const langTrace = docBuilding?.traceability.find((t) =>
    t.metricName.includes("language")
  );
  if (langTrace?.valueStatus !== "not_available") {
    throw new Error("Métrica ausente (language=null) não foi preservada como not_available.");
  }
  assertions.push("Distinção estrita entre métrica ausente (not_available) e zero validada.");

  // 5. Vegetação sazonal por recência de push (ADR-017)
  const activeBuilding = worldRunA.buildings.find((b) => b.githubRepositoryId === 9001);
  if (activeBuilding?.appearanceParameters.vegetationSeason !== "lush_green") {
    throw new Error("Repositório com push < 30 dias deve possuir vegetação lush_green (ADR-017).");
  }
  assertions.push("Vegetação sazonal por recência de push (ADR-017) validada.");

  // 6. Monumentos de repositórios arquivados, forks e tópicos (ADR-020)
  const monumentBuilding = worldRunA.buildings.find((b) => b.githubRepositoryId === 9003);
  if (
    !monumentBuilding?.appearanceParameters.isArchived ||
    !monumentBuilding?.appearanceParameters.isFork ||
    monumentBuilding.appearanceParameters.primaryColor !== "#78716c" ||
    monumentBuilding.appearanceParameters.vegetationSeason !== "arid_dry"
  ) {
    throw new Error("Repositório arquivado não recebeu acabamento de monumento histórico (ADR-020).");
  }
  assertions.push("Monumentos arquivados, emblemas de fork e tópicos (ADR-020) validados.");

  // 7. Assentamentos vizinhos de seguidores na Pangeia (ADR-018)
  if (
    !worldRunA.city.followerOutposts ||
    worldRunA.city.followerOutposts.length !== 1 ||
    worldRunA.city.followerOutposts[0].sphericalPosition.elevation < 0.05
  ) {
    throw new Error("Assentamento de seguidor na Pangeia inválido (ADR-018).");
  }
  assertions.push("Assentamentos determinísticos de seguidores na Pangeia (ADR-018) validados.");

  return {
    passed: true,
    assertions,
  };
}

