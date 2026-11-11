/**
 * VOLUME 04 — GERAÇÃO PROCEDURAL (Sementes e Determinismo)
 * Garante reprodutibilidade estrita a partir de entradas conhecidas e versão das regras.
 */

export const GENERATION_VERSION = "1.5.0";

/**
 * Converte uma string arbitrária em um inteiro de 32 bits não-negativo de forma determinística (FNV-1a + avalanche).
 */
export function hashStringToSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Avalanche final tipo Murmur3
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/**
 * Gerador pseudoaleatório determinístico (Mulberry32).
 * Retorna função que produz floats no intervalo [0, 1).
 */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deriva a semente principal do mundo a partir do githubId imutável do usuário e da versão.
 */
export function deriveWorldSeed(githubId: number, version: string = GENERATION_VERSION): number {
  return hashStringToSeed(`github-world:user:${githubId}:v:${version}`);
}

/**
 * Deriva semente secundária para a Pangeia do planeta.
 */
export function deriveContinentSeed(worldSeed: number, version: string = GENERATION_VERSION): number {
  return hashStringToSeed(`github-world:pangeia:${worldSeed}:v:${version}`);
}

/**
 * Deriva semente secundária para o posicionamento e malha urbana da cidade.
 */
export function deriveCitySeed(worldSeed: number, version: string = GENERATION_VERSION): number {
  return hashStringToSeed(`github-world:city:${worldSeed}:v:${version}`);
}

/**
 * Deriva semente secundária individual para cada construção a partir do githubRepositoryId estável.
 * Conforme Volume 04.3, evita que a inclusão de um novo repositório altere a geometria individual dos demais.
 */
export function deriveBuildingSeed(githubRepositoryId: number, version: string = GENERATION_VERSION): number {
  return hashStringToSeed(`github-world:repo:${githubRepositoryId}:v:${version}`);
}

