/**
 * VOLUME 03 & VOLUME 04.4 — GERAÇÃO PLANETÁRIA E CONTINENTAL (PANGEIA)
 * Define a matemática determinística do Planeta, da Pangeia única e do sistema de coordenadas esféricas.
 */

import { Continent, Planet, SphericalCoordinates, Vector3D } from "@/domain/types";
import { createSeededRng, deriveContinentSeed } from "./seed";

export const PLANET_BASE_RADIUS = 120; // Unidades espaciais no modo orbital

const OCEAN_PALETTES = [
  { ocean: "#0a2444", atmosphere: "#38bdf8" },
  { ocean: "#082f49", atmosphere: "#22d3ee" },
  { ocean: "#0f172a", atmosphere: "#60a5fa" },
  { ocean: "#06283d", atmosphere: "#34d399" },
];

const CONTINENT_PALETTES = [
  { lowland: "#1e4d3b", highland: "#2d6a4f", mountain: "#64748b", coast: "#d4a373" },
  { lowland: "#234e38", highland: "#3a6b4c", mountain: "#78716c", coast: "#ca8a4b" },
  { lowland: "#1b4332", highland: "#40916c", mountain: "#94a3b8", coast: "#e9c46a" },
  { lowland: "#283618", highland: "#606c38", mountain: "#7f8c8d", coast: "#dda15e" },
];

/**
 * Converte coordenadas esféricas (latitude/longitude em graus) para vetor 3D no sistema Right-Handed Y-Up.
 * Origem: (0,0,0) no centro do planeta.
 * Eixo Y+: Polo Norte (lat = +90°).
 * Eixo Z+: Meridiano Primário (lat = 0°, lon = 0°).
 * Eixo X+: Leste (lat = 0°, lon = +90°).
 */
export function sphericalToCartesian(
  latitudeDeg: number,
  longitudeDeg: number,
  radius: number
): Vector3D {
  const latRad = (latitudeDeg * Math.PI) / 180;
  const lonRad = (longitudeDeg * Math.PI) / 180;

  const cosLat = Math.cos(latRad);
  return {
    x: radius * cosLat * Math.sin(lonRad),
    y: radius * Math.sin(latRad),
    z: radius * cosLat * Math.cos(lonRad),
  };
}

/**
 * Calcula a base ortonormal tangente à superfície esférica em uma dada coordenada (Normal, Leste, Norte).
 */
export function computeTangentBasis(latitudeDeg: number, longitudeDeg: number): {
  normal: Vector3D;
  tangentEast: Vector3D;
  tangentNorth: Vector3D;
} {
  const latRad = (latitudeDeg * Math.PI) / 180;
  const lonRad = (longitudeDeg * Math.PI) / 180;

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);

  const normal: Vector3D = {
    x: cosLat * sinLon,
    y: sinLat,
    z: cosLat * cosLon,
  };

  const tangentEast: Vector3D = {
    x: cosLon,
    y: 0,
    z: -sinLon,
  };

  const tangentNorth: Vector3D = {
    x: -sinLat * sinLon,
    y: cosLat,
    z: -sinLat * cosLon,
  };

  return { normal, tangentEast, tangentNorth };
}

/**
 * Distância angular em radianos entre dois pontos esféricos sobre a esfera (fórmula do cosseno esférico/haversine).
 */
export function angularDistanceRad(
  lat1Deg: number,
  lon1Deg: number,
  lat2Deg: number,
  lon2Deg: number
): number {
  const lat1 = (lat1Deg * Math.PI) / 180;
  const lon1 = (lon1Deg * Math.PI) / 180;
  const lat2 = (lat2Deg * Math.PI) / 180;
  const lon2 = (lon2Deg * Math.PI) / 180;

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * Math.atan2(Math.sqrt(Math.max(0, a)), Math.sqrt(Math.max(0, 1 - a)));
}

/**
 * Ruído harmônico esférico determinístico para esculpir a Pangeia única.
 * Retorna a elevação relativa [-1, +1], onde valores > 0 pertencem à massa continental da Pangeia
 * e valores <= 0 pertencem ao oceano global (Panthalassa).
 */
export function evaluatePangeiaElevation(
  latitudeDeg: number,
  longitudeDeg: number,
  continent: Continent
): number {
  const distRad = angularDistanceRad(
    latitudeDeg,
    longitudeDeg,
    continent.centerCoordinates.latitude,
    continent.centerCoordinates.longitude
  );

  const maxRadiusRad = (continent.angularRadius * Math.PI) / 180;

  // Coordenadas 3D unitárias para harmônicos esféricos contínuos sem costura no antimeridiano
  const u = sphericalToCartesian(latitudeDeg, longitudeDeg, 1.0);
  const s = (continent.seed % 10000) / 1000;

  // Harmônicos de baixa e média frequência para costas orgânicas de uma única supermassa continental
  const harmonic1 =
    0.22 * Math.sin(u.x * 2.7 + s) * Math.cos(u.y * 2.3 - s) +
    0.18 * Math.cos(u.z * 3.1 + s * 1.3);
  const harmonic2 =
    0.12 *
    continent.coastlineComplexity *
    (Math.sin(u.x * 5.9 + u.z * 4.7 + s * 2.1) + Math.cos(u.y * 6.3 - u.x * 3.8));
  const ridgeNoise =
    0.08 * (1 - Math.abs(Math.sin(u.x * 8.5 + u.y * 7.2 - u.z * 6.1 + s * 3.7)));

  // Máscara radial suave garante uma única grande massa continental (Pangeia) ao redor do centro continental
  const normalizedDist = distRad / maxRadiusRad;
  const continentalMask = 1.0 - Math.pow(normalizedDist, 1.85);

  const rawElevation = continentalMask + harmonic1 + harmonic2 + ridgeNoise;
  return Math.max(-1, Math.min(1, rawElevation));
}

/**
 * Etapa 1: Geração Planetária
 */
export function generatePlanet(worldId: string, worldSeed: number): Planet {
  const rng = createSeededRng(worldSeed);
  const palette = OCEAN_PALETTES[Math.floor(rng() * OCEAN_PALETTES.length)];
  const axialTilt = Number((8 + rng() * 16).toFixed(2));

  return {
    id: `planet_${worldId}`,
    worldId,
    radius: PLANET_BASE_RADIUS,
    center: { x: 0, y: 0, z: 0 },
    axialTilt,
    oceanColor: palette.ocean,
    atmosphereColor: palette.atmosphere,
    coordinateSystem: "right-handed-y-up",
  };
}

/**
 * Etapa 2: Geração Continental (Pangeia única)
 */
export function generateContinent(planetId: string, worldSeed: number): Continent {
  const continentSeed = deriveContinentSeed(worldSeed);
  const rng = createSeededRng(continentSeed);

  // Centro da Pangeia posicionado em latitudes temperadas/tropicais visíveis
  const centerLat = Number(((rng() - 0.5) * 44).toFixed(4)); // -22° a +22°
  const centerLon = Number(((rng() - 0.5) * 90).toFixed(4)); // -45° a +45°
  const angularRadius = Number((58 + rng() * 14).toFixed(2)); // ~58° a 72° de raio angular
  const coastlineComplexity = Number((0.75 + rng() * 0.5).toFixed(3));
  const palette = CONTINENT_PALETTES[Math.floor(rng() * CONTINENT_PALETTES.length)];

  const centerCoordinates: SphericalCoordinates = {
    latitude: centerLat,
    longitude: centerLon,
    elevation: 0.35,
  };

  return {
    id: `continent_${planetId}`,
    planetId,
    name: "Pangeia",
    seed: continentSeed,
    centerCoordinates,
    angularRadius,
    coastlineComplexity,
    palette,
  };
}

