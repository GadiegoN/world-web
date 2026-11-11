/**
 * VOLUME 03.4, 04.4 & 06.7 — POSICIONAMENTO DA CIDADE E DISTRIBUIÇÃO URBANA
 * Posiciona a cidade deterministicamente sobre a Pangeia e organiza os repositórios
 * em quadras centradas (livres de colisão com ruas) conectadas a um Anel Viário Perimetral.
 */

import {
  Building,
  City,
  CityContributor,
  Continent,
  PangeiaFollowerOutpost,
  Planet,
  Repository,
  UrbanDistrict,
  UrbanRoad,
} from "@/domain/types";
import type {
  RawContributorItem,
  RawFollowerItem,
} from "@/integrations/github/githubProvider";
import { generateBuildingFromRepository } from "./buildingGenerator";
import {
  computeTangentBasis,
  evaluatePangeiaElevation,
  sphericalToCartesian,
} from "./geographyGenerator";
import { createSeededRng, deriveCitySeed, GENERATION_VERSION } from "./seed";

/**
 * Encontra deterministicamente uma coordenada terrestre firme dentro da Pangeia para fundar a cidade do usuário.
 */
function findDeterministicCityCoordinates(
  continent: Continent,
  citySeed: number
): { latitude: number; longitude: number; elevation: number } {
  const rng = createSeededRng(citySeed);

  for (let attempt = 0; attempt < 64; attempt++) {
    const radialFraction = (0.1 + rng() * 0.45) * (1 - attempt / 90);
    const angle = rng() * Math.PI * 2;
    const maxOffsetDeg = continent.angularRadius * 0.45;

    const candidateLat = Math.max(
      -68,
      Math.min(
        68,
        continent.centerCoordinates.latitude +
          Math.sin(angle) * maxOffsetDeg * radialFraction
      )
    );
    const candidateLon =
      continent.centerCoordinates.longitude +
      Math.cos(angle) * maxOffsetDeg * radialFraction;

    const elevation = evaluatePangeiaElevation(
      candidateLat,
      candidateLon,
      continent
    );
    if (elevation > 0.18) {
      return {
        latitude: Number(candidateLat.toFixed(4)),
        longitude: Number(candidateLon.toFixed(4)),
        elevation: Number(elevation.toFixed(4)),
      };
    }
  }

  const centerElev = Math.max(
    0.25,
    evaluatePangeiaElevation(
      continent.centerCoordinates.latitude,
      continent.centerCoordinates.longitude,
      continent
    )
  );
  return {
    latitude: continent.centerCoordinates.latitude,
    longitude: continent.centerCoordinates.longitude,
    elevation: Number(centerElev.toFixed(4)),
  };
}

/**
 * Etapa 3, 4, 5 e 6: Gera a Cidade, sua malha viária conectada ao Anel Viário Perimetral,
 * seus distritos por linguagem e todas as Construções centralizadas dentro das quadras.
 */
export function generateCityAndBuildings(
  worldId: string,
  worldSeed: number,
  planet: Planet,
  continent: Continent,
  repositories: Repository[],
  referenceTimestampIso: string,
  rawContributors: RawContributorItem[] = [],
  rawFollowers: RawFollowerItem[] = []
): { city: City; buildings: Building[] } {
  const citySeed = deriveCitySeed(worldSeed, GENERATION_VERSION);
  const cityId = `city_${worldId}`;

  const sphericalPosition = findDeterministicCityCoordinates(
    continent,
    citySeed
  );
  const surfaceRadius =
    planet.radius * (1 + sphericalPosition.elevation * 0.045);
  const position = sphericalToCartesian(
    sphericalPosition.latitude,
    sphericalPosition.longitude,
    surfaceRadius
  );
  const tangentBasis = computeTangentBasis(
    sphericalPosition.latitude,
    sphericalPosition.longitude
  );

  // Ordenação determinística dos repositórios: mais relevantes no centro (Downtown)
  const sortedRepos = [...repositories].sort((a, b) => {
    const starsDiff = (b.stars.value ?? 0) - (a.stars.value ?? 0);
    if (starsDiff !== 0) return starsDiff;
    return a.githubRepositoryId - b.githubRepositoryId;
  });

  // Agrupamento de distritos por linguagem
  const languageGroups = new Map<string, Repository[]>();
  for (const repo of sortedRepos) {
    const langKey = repo.language.value ?? "Outras";
    const list = languageGroups.get(langKey) ?? [];
    list.push(repo);
    languageGroups.set(langKey, list);
  }

  const sortedLanguages = Array.from(languageGroups.entries()).sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])
  );

  const districts: UrbanDistrict[] = [];
  const roads: UrbanRoad[] = [];
  const buildings: Building[] = [];

  /**
   * Geometria de Quadras Sem Colisão:
   * - As ruas passam exatamente nos múltiplos inteiros de `BLOCK_PITCH` (k * 18.0m: 0m, ±18m, ±36m...).
   * - Cada lote/construção fica estritamente no CENTRO da quadra: `(gx + 0.5) * 18.0m` (±9m, ±27m, ±45m...).
   * - Como uma construção tem largura máxima de 8.4m (+1.2m de calçada = 9.6m, ou ±4.8m a partir do centro do lote),
   *   ela ocupa no máximo [4.2m, 13.8m], deixando ampla folga tanto para a avenida central [-2.4m, +2.4m]
   *   quanto para as ruas secundárias em [16.6m, 19.4m]. Nenhum prédio jamais toca uma rua!
   */
  const BLOCK_PITCH = 18.0;
  const totalRepos = sortedRepos.length;

  // Espiral ortogonal de índices de quadra (gx, gz) iniciando nos 4 blocos ao redor da Praça Marco Zero:
  // (0,0)->(+9,+9), (-1,0)->(-9,+9), (-1,-1)->(-9,-9), (0,-1)->(+9,-9), etc.
  const spiralCoords: { gx: number; gz: number }[] = [];
  let gx = 0;
  let gz = 0;
  let dx = 1;
  let dz = 0;
  let segmentLength = 1;
  let segmentPassed = 0;
  let turnCounter = 0;

  for (let i = 0; i < Math.max(totalRepos, 1); i++) {
    spiralCoords.push({ gx, gz });
    gx += dx;
    gz += dz;
    segmentPassed++;
    if (segmentPassed === segmentLength) {
      segmentPassed = 0;
      const temp = dx;
      dx = -dz;
      dz = temp;
      turnCounter++;
      if (turnCounter % 2 === 0) {
        segmentLength++;
      }
    }
  }

  // Calcula o raio máximo ocupado pelas construções para dimensionar o Anel Viário Perimetral
  let maxBuildingRadialDist = 24;
  for (let i = 0; i < totalRepos; i++) {
    const c = spiralCoords[i];
    const cx = (c.gx + 0.5) * BLOCK_PITCH;
    const cz = (c.gz + 0.5) * BLOCK_PITCH;
    const dist = Math.sqrt(cx * cx + cz * cz) + 12;
    if (dist > maxBuildingRadialDist) {
      maxBuildingRadialDist = dist;
    }
  }

  // Raio exato do Anel Viário Perimetral onde todas as ruas terminam e se conectam
  const urbanRadius = Math.max(42, Math.ceil(maxBuildingRadialDist / 6) * 6);

  sortedLanguages.forEach(([language, groupRepos], idx) => {
    const sectorAngle =
      (idx / Math.max(1, sortedLanguages.length)) * Math.PI * 2;
    const distFromCenter =
      sortedLanguages.length === 1 ? 0 : Math.min(urbanRadius * 0.4, 28);
    districts.push({
      id: `dist_${idx}_${language.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
      name: `Distrito ${language}`,
      language,
      center: {
        x: Number((Math.cos(sectorAngle) * distFromCenter).toFixed(2)),
        z: Number((Math.sin(sectorAngle) * distFromCenter).toFixed(2)),
      },
      radius: Number(
        Math.max(16, Math.sqrt(groupRepos.length) * 12).toFixed(2)
      ),
      repositoryCount: groupRepos.length,
    });
  });

  // Posiciona cada construção exatamente no centro da sua quadra ((gx + 0.5) * BLOCK_PITCH)
  sortedRepos.forEach((repo, index) => {
    const coord = spiralCoords[index];
    const x = Number(((coord.gx + 0.5) * BLOCK_PITCH).toFixed(2));
    const z = Number(((coord.gz + 0.5) * BLOCK_PITCH).toFixed(2));

    const langKey = repo.language.value ?? "Outras";
    const district =
      districts.find((d) => d.language === langKey) ??
      districts[0] ?? {
        id: "dist_central",
        name: "Distrito Central",
        language: "Geral",
        center: { x: 0, z: 0 },
        radius: 25,
        repositoryCount: totalRepos,
      };

    const buildingRng = createSeededRng(repo.githubRepositoryId);
    const rotationY = (Math.floor(buildingRng() * 4) * Math.PI) / 2;

    const building = generateBuildingFromRepository(
      repo,
      cityId,
      {
        x,
        y: 0,
        z,
        rotationY: Number(rotationY.toFixed(4)),
        districtId: district.id,
        lotIndex: index,
      },
      referenceTimestampIso
    );

    buildings.push(building);
  });

  // Duas grandes Avenidas Arteriais cruzando X=0 e Z=0 de ponta a ponta até o Anel Viário Perimetral (urbanRadius)
  roads.push({
    id: "road_arterial_ew",
    start: { x: -urbanRadius, z: 0 },
    end: { x: urbanRadius, z: 0 },
    width: 4.8,
    kind: "arterial",
  });
  roads.push({
    id: "road_arterial_ns",
    start: { x: 0, z: -urbanRadius },
    end: { x: 0, z: urbanRadius },
    width: 4.8,
    kind: "arterial",
  });

  // Ruas secundárias nos múltiplos inteiros de BLOCK_PITCH, com comprimento exato de corda até o Anel Perimetral!
  const maxStreetIndex = Math.floor((urbanRadius - 6) / BLOCK_PITCH);
  for (let line = 1; line <= maxStreetIndex; line++) {
    const offset = line * BLOCK_PITCH;
    // Comprimento exato da corda para que a rua encoste perfeitamente no Anel Viário Perimetral sem sobrar nem faltar
    const chordHalfLength = Number(
      Math.sqrt(
        Math.max(0, urbanRadius * urbanRadius - offset * offset)
      ).toFixed(2)
    );

    if (chordHalfLength < 8) continue;

    roads.push({
      id: `road_ew_pos_${line}`,
      start: { x: -chordHalfLength, z: offset },
      end: { x: chordHalfLength, z: offset },
      width: 2.8,
      kind: "street",
    });
    roads.push({
      id: `road_ew_neg_${line}`,
      start: { x: -chordHalfLength, z: -offset },
      end: { x: chordHalfLength, z: -offset },
      width: 2.8,
      kind: "street",
    });
    roads.push({
      id: `road_ns_pos_${line}`,
      start: { x: offset, z: -chordHalfLength },
      end: { x: offset, z: chordHalfLength },
      width: 2.8,
      kind: "street",
    });
    roads.push({
      id: `road_ns_neg_${line}`,
      start: { x: -offset, z: -chordHalfLength },
      end: { x: -offset, z: chordHalfLength },
      width: 2.8,
      kind: "street",
    });
  }

  // Converte contribuidores reais dos repositórios em veículos determinísticos nas estradas da cidade
  const routes: CityContributor["routeKind"][] = [
    "arterial_ew",
    "arterial_ns",
    "ring_road",
  ];
  const contributors: CityContributor[] = rawContributors.map((c, idx) => {
    const targetBldg = buildings.find((b) => b.repositoryId === c.repositoryId);
    const vehicleColor =
      targetBldg?.appearanceParameters.primaryColor ?? "#38bdf8";
    const cRng = createSeededRng(c.id + idx * 97);
    const routeKind = routes[idx % routes.length];
    const speed = Number(
      (7.5 + Math.min(8, Math.log10(1 + c.contributions) * 3.5)).toFixed(2)
    );
    const initialPhase = Number((cRng() * 2 - 1).toFixed(4));

    return {
      id: `contrib_veh_${c.id}_${idx}`,
      login: c.login,
      githubId: c.id,
      avatarUrl: c.avatar_url,
      profileUrl: c.html_url,
      contributions: c.contributions,
      repositoryId: c.repositoryId,
      repositoryName: c.repositoryName,
      vehicleColor,
      routeKind,
      speed,
      initialPhase,
    };
  });

  // Posiciona os Seguidores do perfil como assentamentos vizinhos na superfície da Pangeia ao redor da cidade principal
  const followerColors = [
    "#34d399",
    "#a78bfa",
    "#f472b6",
    "#fbbf24",
    "#38bdf8",
    "#fb7185",
  ];
  const followerOutposts: PangeiaFollowerOutpost[] = rawFollowers.map(
    (f, idx) => {
      const fRng = createSeededRng(f.id + idx * 131 + citySeed);
      let chosenLat = sphericalPosition.latitude;
      let chosenLon = sphericalPosition.longitude;
      let chosenElev = sphericalPosition.elevation;

      const ringIndex = Math.floor(idx / 6);
      const baseAngle =
        ((idx % 6) / 6) * Math.PI * 2 + ringIndex * 0.52 + fRng() * 0.35;
      const baseDistDeg = 7.5 + ringIndex * 5.8 + fRng() * 3.2;

      for (let attempt = 0; attempt < 36; attempt++) {
        const tryAngle = baseAngle + attempt * 0.42;
        const tryDist = Math.max(
          5.5,
          baseDistDeg * (1 - (attempt > 18 ? (attempt - 18) * 0.03 : 0))
        );
        const candLat = Math.max(
          -72,
          Math.min(72, sphericalPosition.latitude + Math.sin(tryAngle) * tryDist)
        );
        const candLon =
          sphericalPosition.longitude + Math.cos(tryAngle) * tryDist;
        const elev = evaluatePangeiaElevation(candLat, candLon, continent);
        if (elev > 0.06) {
          chosenLat = Number(candLat.toFixed(4));
          chosenLon = Number(candLon.toFixed(4));
          chosenElev = Number(elev.toFixed(4));
          break;
        }
      }

      const fRadius = planet.radius * (1 + chosenElev * 0.048);
      const fPos = sphericalToCartesian(chosenLat, chosenLon, fRadius);

      return {
        id: `follower_outpost_${f.id}`,
        githubId: f.id,
        login: f.login,
        avatarUrl: f.avatar_url,
        profileUrl: f.html_url,
        position: fPos,
        sphericalPosition: {
          latitude: chosenLat,
          longitude: chosenLon,
          elevation: chosenElev,
        },
        color: followerColors[idx % followerColors.length],
      };
    }
  );

  const city: City = {
    id: cityId,
    worldId,
    position,
    sphericalPosition,
    tangentBasis,
    generationSeed: citySeed,
    generationVersion: GENERATION_VERSION,
    repositoryCount: buildings.length,
    urbanRadius,
    roads,
    districts,
    contributors,
    followerOutposts,
  };

  return { city, buildings };
}
