/**
 * VOLUME 04 & VOLUME 07.6 — WORLD GENERATOR
 * Orquestra as 6 etapas da geração procedural determinística e valida invariantes de domínio.
 */

import { validateWorldIntegrity } from "@/domain/integrity";
import { GitHubUser, Repository, World } from "@/domain/types";
import type {
  RawContributorItem,
  RawFollowerItem,
} from "@/integrations/github/githubProvider";
import { generateCityAndBuildings } from "./cityGenerator";
import { generateContinent, generatePlanet } from "./geographyGenerator";
import { deriveWorldSeed, GENERATION_VERSION } from "./seed";

export interface GenerateWorldInput {
  user: GitHubUser;
  repositories: Repository[];
  contributors?: RawContributorItem[];
  followers?: RawFollowerItem[];
  dataCollectedAt: string;
  isPartialData?: boolean;
  warnings?: string[];
}

export function generateWorld(input: GenerateWorldInput): World {
  const {
    user,
    repositories,
    contributors = [],
    followers = [],
    dataCollectedAt,
    isPartialData = false,
    warnings = [],
  } = input;

  // Identidade do mundo vinculada ao githubId numérico imutável (ADR-P001 / Recomendação 01.2 & 02.3)
  const worldId = `world_${user.githubId}`;
  const worldSeed = deriveWorldSeed(user.githubId, GENERATION_VERSION);

  // Etapa 1: Geração planetária
  const planet = generatePlanet(worldId, worldSeed);

  // Etapa 2: Geração continental (Pangeia única)
  const continent = generateContinent(planet.id, worldSeed);

  // Etapas 3, 4, 5 e 6: Posicionamento da cidade, espaço urbano, distribuição, construções e seguidores na Pangeia
  const { city, buildings } = generateCityAndBuildings(
    worldId,
    worldSeed,
    planet,
    continent,
    repositories,
    dataCollectedAt,
    contributors,
    followers
  );

  const nowIso = new Date().toISOString();

  const world: World = {
    id: worldId,
    userId: user.id,
    generationVersion: GENERATION_VERSION,
    seed: worldSeed,
    status: "ready",
    generatedAt: nowIso,
    updatedAt: nowIso,
    user,
    planet,
    continent,
    city,
    repositories,
    buildings,
    metadata: {
      generationVersion: GENERATION_VERSION,
      seed: worldSeed,
      dataCollectedAt,
      worldGeneratedAt: nowIso,
      isPartialData,
      fromCache: false,
      warnings,
    },
  };

  const integrity = validateWorldIntegrity(world);
  if (!integrity.valid) {
    throw new Error(`Falha de integridade na geração do mundo: ${integrity.violations.join("; ")}`);
  }

  return world;
}

