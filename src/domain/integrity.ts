/**
 * VOLUME 02.5 — INTEGRIDADE DO DOMÍNIO
 * Valida todas as invariantes exigidas pelo Livro Técnico do GitHub World.
 */

import { World } from "./types";

export interface IntegrityCheckResult {
  valid: boolean;
  violations: string[];
}

export function validateWorldIntegrity(world: World): IntegrityCheckResult {
  const violations: string[] = [];

  // 1. Um mundo deve pertencer a um único usuário válido
  if (!world.userId || world.userId !== world.user.id) {
    violations.push("Invariante violada: O mundo não possui correspondência íntegra com o usuário proprietário.");
  }

  // 2. Uma cidade deve pertencer a um único mundo
  if (!world.city || world.city.worldId !== world.id) {
    violations.push("Invariante violada: A cidade não pertence exclusivamente a este mundo.");
  }

  // 3. Planeta e Pangeia única
  if (!world.planet || world.planet.worldId !== world.id) {
    violations.push("Invariante violada: O planeta não está associado corretamente ao mundo.");
  }
  if (!world.continent || world.continent.planetId !== world.planet.id || world.continent.name !== "Pangeia") {
    violations.push("Invariante violada: O planeta deve conter uma única massa continental denominada Pangeia.");
  }

  // 4. A geração deve registrar sua versão
  if (!world.generationVersion || world.city.generationVersion !== world.generationVersion) {
    violations.push("Invariante violada: Versão de geração ausente ou inconsistente entre mundo e cidade.");
  }

  // 5. Uma construção deve possuir uma origem identificável e não pode pertencer a duas cidades
  const repoIds = new Set(world.repositories.map((r) => r.id));
  const seenBuildingRepoIds = new Set<string>();

  for (const building of world.buildings) {
    if (building.cityId !== world.city.id) {
      violations.push(`Invariante violada: Construção ${building.id} pertence a outra cidade (${building.cityId}).`);
    }
    if (!repoIds.has(building.repositoryId)) {
      violations.push(`Invariante violada: Construção ${building.id} não possui repositório de origem identificável.`);
    }
    if (seenBuildingRepoIds.has(building.repositoryId)) {
      violations.push(`Invariante violada: Repositório ${building.repositoryId} possui múltiplas construções duplicadas.`);
    }
    seenBuildingRepoIds.add(building.repositoryId);

    if (!building.generationVersion) {
      violations.push(`Invariante violada: Construção ${building.id} não registra versão da regra aplicada.`);
    }
    if (!building.traceability || building.traceability.length === 0) {
      violations.push(`Invariante violada: Construção ${building.id} não possui rastreabilidade de métricas.`);
    }

    // 5b. Nenhuma construção pode invadir as Avenidas Arteriais centrais (X=0 ou Z=0, largura 4.8m -> semi-largura 2.4m)
    const halfW = building.geometryParameters.width / 2 + 0.6;
    const halfD = building.geometryParameters.depth / 2 + 0.6;
    if (
      Math.abs(building.position.x) - halfW < 2.4 ||
      Math.abs(building.position.z) - halfD < 2.4
    ) {
      violations.push(
        `Invariante espacial violada: Construção ${building.id} invade a avenida arterial central.`
      );
    }

    // 5c. Vegetação sazonal (ADR-017) e Monumentos Arquivados (ADR-020)
    if (
      !building.appearanceParameters.vegetationSeason ||
      !building.appearanceParameters.foliageColor
    ) {
      violations.push(
        `Invariante violada: Construção ${building.id} não possui estação de vegetação sazonal (ADR-017).`
      );
    }
    if (
      building.appearanceParameters.isArchived &&
      building.appearanceParameters.vegetationSeason !== "arid_dry"
    ) {
      violations.push(
        `Invariante violada: Construção arquivada ${building.id} deve estar preservada como monumento com estação arid_dry (ADR-020).`
      );
    }
  }

  // 6. Quantidade de repositórios representados deve coincidir com construções
  if (world.city.repositoryCount !== world.buildings.length) {
    violations.push(
      `Invariante violada: City.repositoryCount (${world.city.repositoryCount}) difere do total de construções (${world.buildings.length}).`
    );
  }

  // 7. Assentamentos de seguidores na Pangeia devem estar sobre terra firme (ADR-018)
  if (world.city.followerOutposts) {
    for (const outpost of world.city.followerOutposts) {
      if (outpost.sphericalPosition.elevation < 0.05) {
        violations.push(
          `Invariante geográfica violada: Assentamento do seguidor @${outpost.login} posicionado fora da terra firme da Pangeia.`
        );
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

