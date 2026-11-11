/**
 * VOLUME 02 — MODELO DE DOMÍNIO
 * Entidades principais, estados e contratos de rastreabilidade do GitHub World.
 */

export type WorldStatus =
  | "not_generated"
  | "queued"
  | "generating"
  | "ready"
  | "stale"
  | "failed";

export type SearchFlowState =
  | "idle" // Pesquisa não preenchida
  | "searching" // Pesquisa em andamento
  | "user_found" // Usuário encontrado
  | "user_not_found" // Usuário inexistente
  | "profile_unavailable" // Perfil indisponível
  | "github_error" // Erro de comunicação com o GitHub
  | "processing_data" // Dados sendo processados
  | "generating_world" // Mundo em geração
  | "city_ready" // Cidade pronta para visualização
  | "empty_repositories" // Usuário sem repositórios públicos
  | "partial_data"; // Dados parcialmente disponíveis

export type MetricValueState<T> = {
  value: T | null;
  status: "available" | "zero" | "not_available" | "not_collected" | "error";
  source: string;
};

export interface GitHubUser {
  id: string; // Identificador interno (ex: usr_<githubId>)
  githubId: number; // Identificador numérico imutável do GitHub (ADR-P001 / Recomendação 01.2)
  login: string; // Username atual
  displayName: string | null;
  avatarUrl: string;
  profileUrl: string;
  bio: string | null;
  publicReposCount: number;
  followers: number;
  following: number;
  githubCreatedAt: string;
  createdAt: string; // Data de criação do registro interno
  updatedAt: string; // Última atualização interna
}

export interface Repository {
  id: string; // Identificador interno (ex: repo_<githubRepositoryId>)
  githubRepositoryId: number; // Identificador estável do GitHub (02.3)
  ownerId: string; // Usuário proprietário (GitHubUser.id)
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  language: MetricValueState<string>;
  stars: MetricValueState<number>;
  forks: MetricValueState<number>;
  openIssues: MetricValueState<number>;
  sizeKb: MetricValueState<number>;
  isFork: boolean;
  archived: boolean;
  topics: string[];
  createdAt: string;
  updatedAt: string;
  pushedAt: string | null;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface SphericalCoordinates {
  latitude: number; // graus (-90 a 90)
  longitude: number; // graus (-180 a 180)
  elevation: number; // elevação normalizada sobre o raio base
}

export interface Planet {
  id: string;
  worldId: string;
  radius: number;
  center: Vector3D;
  axialTilt: number;
  oceanColor: string;
  atmosphereColor: string;
  coordinateSystem: "right-handed-y-up";
}

export interface Continent {
  id: string;
  planetId: string;
  name: "Pangeia";
  seed: number;
  centerCoordinates: SphericalCoordinates;
  angularRadius: number; // Extensão angular da massa continental única
  coastlineComplexity: number;
  palette: {
    lowland: string;
    highland: string;
    mountain: string;
    coast: string;
  };
}

export interface UrbanRoad {
  id: string;
  start: { x: number; z: number };
  end: { x: number; z: number };
  width: number;
  kind: "arterial" | "avenue" | "street";
}

export interface UrbanDistrict {
  id: string;
  name: string;
  language: string;
  center: { x: number; z: number };
  radius: number;
  repositoryCount: number;
}

export interface CityContributor {
  id: string;
  login: string;
  githubId: number;
  avatarUrl: string;
  profileUrl: string;
  contributions: number;
  repositoryId: string;
  repositoryName: string;
  vehicleColor: string;
  routeKind: "arterial_ew" | "arterial_ns" | "ring_road";
  speed: number;
  initialPhase: number;
}

export interface PangeiaFollowerOutpost {
  id: string;
  githubId: number;
  login: string;
  avatarUrl: string;
  profileUrl: string;
  position: Vector3D; // Posição 3D na superfície da Pangeia ao lado da cidade principal
  sphericalPosition: SphericalCoordinates;
  color: string;
}

export interface City {
  id: string;
  worldId: string;
  position: Vector3D; // Posição 3D na superfície da Pangeia
  sphericalPosition: SphericalCoordinates;
  tangentBasis: {
    normal: Vector3D;
    tangentEast: Vector3D;
    tangentNorth: Vector3D;
  };
  generationSeed: number;
  generationVersion: string;
  repositoryCount: number;
  urbanRadius: number;
  roads: UrbanRoad[];
  districts: UrbanDistrict[];
  contributors: CityContributor[];
  followerOutposts?: PangeiaFollowerOutpost[];
}

export interface MetricTrace {
  metricName: string;
  sourceEndpoint: string;
  rawValue: number | string | null;
  valueStatus: "available" | "zero" | "not_available" | "not_collected" | "error";
  normalizationFormula: string;
  normalizedValue: number;
  visualAttribute: string;
  visualRange: [number, number] | string;
  resultingValue: number | string;
  formulaVersion: string;
}

export interface BuildingGeometryParameters {
  width: number; // Largura da base (m)
  depth: number; // Profundidade da base (m)
  height: number; // Altura total (m)
  floors: number; // Número de pavimentos
  tierCount: number; // Recuos escalonados da torre
  roofStyle: "flat" | "spire" | "dome" | "crown" | " pitched";
  antennaHeight: number;
  footprintScale: number;
}

export type VegetationSeason =
  | "lush_green" // <= 30 dias (< 1 mês): Verde exuberante
  | "moderate_green" // 31 a 180 dias (1 a 6 meses): Menos verde / oliva
  | "autumn_yellow" // 181 a 365 dias (6 a 12 meses): Amarelo outonal
  | "arid_dry"; // > 365 dias (> 1 ano): Seco / inverno acinzentado

export interface BuildingAppearanceParameters {
  primaryColor: string;
  secondaryColor: string;
  emissiveColor: string;
  windowDensity: number;
  activityGlow: number; // 0 a 1 (baseado em quão recente foi o último push)
  daysSinceLastPush?: number | null;
  vegetationSeason?: VegetationSeason;
  foliageColor?: string;
  isArchived?: boolean;
  isFork?: boolean;
  topics?: string[];
  languageLabel: string;
  architecturalArchetype: "monolith" | "stepped-tower" | "campus-block" | "citadel" | "observatory";
}

export interface Building {
  id: string;
  cityId: string;
  repositoryId: string; // Repository.id
  githubRepositoryId: number;
  repositoryName: string;
  repositoryUrl: string;
  position: {
    x: number; // Coordenada local tangente da cidade (Leste-Oeste)
    y: number; // Elevação local da base
    z: number; // Coordenada local tangente da cidade (Norte-Sul)
    rotationY: number;
    districtId: string;
    lotIndex: number;
  };
  geometryParameters: BuildingGeometryParameters;
  appearanceParameters: BuildingAppearanceParameters;
  traceability: MetricTrace[]; // Rastreabilidade completa (Volume 00.4 #7 e Volume 06.3)
  generationSeed: number;
  generationVersion: string;
}

export interface WorldGenerationMetadata {
  generationVersion: string;
  seed: number;
  dataCollectedAt: string;
  worldGeneratedAt: string;
  isPartialData: boolean;
  fromCache: boolean;
  warnings: string[];
}

export interface World {
  id: string;
  userId: string;
  generationVersion: string;
  seed: number;
  status: WorldStatus;
  generatedAt: string;
  updatedAt: string;
  user: GitHubUser;
  planet: Planet;
  continent: Continent;
  city: City;
  repositories: Repository[];
  buildings: Building[];
  metadata: WorldGenerationMetadata;
}

