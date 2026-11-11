/**
 * VOLUME 08 & VOLUME 11.7 — REPOSITÓRIO RELACIONAL DE MUNDOS (PostgreSQL / Supabase)
 * Persiste todas as entidades do domínio (GitHubUser, World, City, Repository, Building)
 * no PostgreSQL do Supabase usando Bulk Inserts (UNNEST) em uma única transação rápida,
 * evitando centenas de round-trips sequenciais na rede.
 */

import { World } from "@/domain/types";
import { GENERATION_VERSION } from "@/generation/seed";
import {
  ensureDatabaseSchema,
  getPostgresPool,
} from "@/infrastructure/database/postgres";

export interface PersistedWorldSummary {
  worldId: string;
  githubId: number;
  login: string;
  displayName: string | null;
  avatarUrl: string;
  seed: number;
  latitude: number;
  longitude: number;
  buildingCount: number;
  totalStars: number;
  updatedAt: string;
}

interface MemoryWorldRecord {
  world: World;
  storedAt: string;
  expiresAt: string;
}

const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutos de validade primária

const memoryByGithubId = new Map<number, MemoryWorldRecord>();
const memoryLoginToGithubId = new Map<string, number>();
let recentWorldsMemoryCache: {
  items: PersistedWorldSummary[];
  expiresAt: number;
} | null = null;

export async function saveWorldToRepository(world: World): Promise<void> {
  const now = Date.now();
  const storedAtIso = new Date(now).toISOString();
  const expiresAtIso = new Date(now + CACHE_TTL_MS).toISOString();

  // Invalida cache de listagem recente para incluir o mundo recém-salvo
  recentWorldsMemoryCache = null;

  // 1. Atualiza imediatamente o cache em memória de primeiro nível
  memoryByGithubId.set(world.user.githubId, {
    world,
    storedAt: storedAtIso,
    expiresAt: expiresAtIso,
  });
  memoryLoginToGithubId.set(
    world.user.login.toLowerCase(),
    world.user.githubId
  );

  // 2. Persiste em lote (Bulk UNNEST) no PostgreSQL (Supabase)
  const schemaOk = await ensureDatabaseSchema();
  const pool = getPostgresPool();
  if (!schemaOk || !pool) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 2a. Upsert GitHubUser
    await client.query(
      `
      INSERT INTO github_users (
        id, github_id, login, display_name, avatar_url, profile_url,
        bio, public_repos_count, followers, following, github_created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (github_id) DO UPDATE SET
        login = EXCLUDED.login,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        profile_url = EXCLUDED.profile_url,
        bio = EXCLUDED.bio,
        public_repos_count = EXCLUDED.public_repos_count,
        followers = EXCLUDED.followers,
        following = EXCLUDED.following,
        updated_at = NOW();
      `,
      [
        world.user.id,
        world.user.githubId,
        world.user.login,
        world.user.displayName,
        world.user.avatarUrl,
        world.user.profileUrl,
        world.user.bio,
        world.user.publicReposCount,
        world.user.followers,
        world.user.following,
        world.user.githubCreatedAt || null,
      ]
    );

    // 2b. Upsert World
    await client.query(
      `
      INSERT INTO worlds (
        id, user_id, github_id, login, generation_version, seed,
        status, generated_at, updated_at, expires_at, world_payload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10)
      ON CONFLICT (github_id) DO UPDATE SET
        login = EXCLUDED.login,
        generation_version = EXCLUDED.generation_version,
        seed = EXCLUDED.seed,
        status = EXCLUDED.status,
        updated_at = NOW(),
        expires_at = EXCLUDED.expires_at,
        world_payload = EXCLUDED.world_payload;
      `,
      [
        world.id,
        world.user.id,
        world.user.githubId,
        world.user.login,
        world.generationVersion,
        world.seed,
        world.status,
        world.generatedAt,
        expiresAtIso,
        JSON.stringify(world),
      ]
    );

    // 2c. Upsert City
    await client.query(
      `
      INSERT INTO cities (
        id, world_id, latitude, longitude, elevation,
        urban_radius, repository_count, generation_seed, generation_version, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (world_id) DO UPDATE SET
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        elevation = EXCLUDED.elevation,
        urban_radius = EXCLUDED.urban_radius,
        repository_count = EXCLUDED.repository_count,
        generation_seed = EXCLUDED.generation_seed,
        generation_version = EXCLUDED.generation_version,
        updated_at = NOW();
      `,
      [
        world.city.id,
        world.id,
        world.city.sphericalPosition.latitude,
        world.city.sphericalPosition.longitude,
        world.city.sphericalPosition.elevation,
        world.city.urbanRadius,
        world.city.repositoryCount,
        world.city.generationSeed,
        world.city.generationVersion,
      ]
    );

    // 2d. Bulk Upsert de todos os Repositórios em UMA ÚNICA query SQL via UNNEST
    if (world.repositories.length > 0) {
      const rIds: string[] = [];
      const rGhIds: number[] = [];
      const rOwners: string[] = [];
      const rNames: string[] = [];
      const rFullNames: string[] = [];
      const rDescs: (string | null)[] = [];
      const rUrls: string[] = [];
      const rLangs: (string | null)[] = [];
      const rStars: (number | null)[] = [];
      const rForks: (number | null)[] = [];
      const rIssues: (number | null)[] = [];
      const rSizes: (number | null)[] = [];
      const rIsForks: boolean[] = [];
      const rArchived: boolean[] = [];
      const rPushed: (string | null)[] = [];

      for (const repo of world.repositories) {
        rIds.push(repo.id);
        rGhIds.push(repo.githubRepositoryId);
        rOwners.push(world.user.id);
        rNames.push(repo.name);
        rFullNames.push(repo.fullName);
        rDescs.push(repo.description);
        rUrls.push(repo.htmlUrl);
        rLangs.push(repo.language.value);
        rStars.push(repo.stars.value);
        rForks.push(repo.forks.value);
        rIssues.push(repo.openIssues.value);
        rSizes.push(repo.sizeKb.value);
        rIsForks.push(Boolean(repo.isFork));
        rArchived.push(Boolean(repo.archived));
        rPushed.push(repo.pushedAt || null);
      }

      await client.query(
        `
        INSERT INTO repositories (
          id, github_repository_id, owner_id, name, full_name,
          description, html_url, language, stars, forks, open_issues, size_kb,
          is_fork, archived, pushed_at, updated_at
        )
        SELECT * FROM UNNEST(
          $1::text[], $2::bigint[], $3::text[], $4::text[], $5::text[],
          $6::text[], $7::text[], $8::text[], $9::int[], $10::int[], $11::int[], $12::int[],
          $13::boolean[], $14::boolean[], $15::timestamptz[]
        ), NOW()
        ON CONFLICT (github_repository_id) DO UPDATE SET
          name = EXCLUDED.name,
          full_name = EXCLUDED.full_name,
          description = EXCLUDED.description,
          html_url = EXCLUDED.html_url,
          language = EXCLUDED.language,
          stars = EXCLUDED.stars,
          forks = EXCLUDED.forks,
          open_issues = EXCLUDED.open_issues,
          size_kb = EXCLUDED.size_kb,
          is_fork = EXCLUDED.is_fork,
          archived = EXCLUDED.archived,
          pushed_at = EXCLUDED.pushed_at,
          updated_at = NOW();
        `,
        [
          rIds,
          rGhIds,
          rOwners,
          rNames,
          rFullNames,
          rDescs,
          rUrls,
          rLangs,
          rStars,
          rForks,
          rIssues,
          rSizes,
          rIsForks,
          rArchived,
          rPushed,
        ]
      );
    }

    // 2e. Bulk Replace das Construções em UMA ÚNICA query SQL via UNNEST
    await client.query(`DELETE FROM buildings WHERE city_id = $1`, [
      world.city.id,
    ]);

    if (world.buildings.length > 0) {
      const bIds: string[] = [];
      const bCityIds: string[] = [];
      const bRepoIds: string[] = [];
      const bGhRepoIds: number[] = [];
      const bRepoNames: string[] = [];
      const bPosX: number[] = [];
      const bPosZ: number[] = [];
      const bHeights: number[] = [];
      const bFloors: number[] = [];
      const bWidths: number[] = [];
      const bDepths: number[] = [];
      const bTiers: number[] = [];
      const bColors: string[] = [];
      const bIsForks: boolean[] = [];
      const bArchived: boolean[] = [];
      const bSeasons: string[] = [];
      const bFoliageColors: string[] = [];
      const bSeeds: number[] = [];
      const bVersions: string[] = [];

      for (const bldg of world.buildings) {
        bIds.push(bldg.id);
        bCityIds.push(world.city.id);
        bRepoIds.push(bldg.repositoryId);
        bGhRepoIds.push(bldg.githubRepositoryId);
        bRepoNames.push(bldg.repositoryName);
        bPosX.push(bldg.position.x);
        bPosZ.push(bldg.position.z);
        bHeights.push(bldg.geometryParameters.height);
        bFloors.push(bldg.geometryParameters.floors);
        bWidths.push(bldg.geometryParameters.width);
        bDepths.push(bldg.geometryParameters.depth);
        bTiers.push(bldg.geometryParameters.tierCount);
        bColors.push(bldg.appearanceParameters.primaryColor);
        bIsForks.push(Boolean(bldg.appearanceParameters.isFork));
        bArchived.push(Boolean(bldg.appearanceParameters.isArchived));
        bSeasons.push(bldg.appearanceParameters.vegetationSeason ?? "lush_green");
        bFoliageColors.push(bldg.appearanceParameters.foliageColor ?? "#22c55e");
        bSeeds.push(bldg.generationSeed);
        bVersions.push(bldg.generationVersion);
      }

      await client.query(
        `
        INSERT INTO buildings (
          id, city_id, repository_id, github_repository_id, repository_name,
          pos_x, pos_z, height, floors, width, depth, tier_count,
          primary_color, is_fork, archived, vegetation_season, foliage_color,
          generation_seed, generation_version
        )
        SELECT * FROM UNNEST(
          $1::text[], $2::text[], $3::text[], $4::bigint[], $5::text[],
          $6::float8[], $7::float8[], $8::float8[], $9::int[], $10::float8[], $11::float8[], $12::int[],
          $13::text[], $14::boolean[], $15::boolean[], $16::text[], $17::text[],
          $18::bigint[], $19::text[]
        )
        ON CONFLICT (id) DO UPDATE SET
          pos_x = EXCLUDED.pos_x,
          pos_z = EXCLUDED.pos_z,
          height = EXCLUDED.height,
          floors = EXCLUDED.floors,
          width = EXCLUDED.width,
          depth = EXCLUDED.depth,
          tier_count = EXCLUDED.tier_count,
          primary_color = EXCLUDED.primary_color,
          is_fork = EXCLUDED.is_fork,
          archived = EXCLUDED.archived,
          vegetation_season = EXCLUDED.vegetation_season,
          foliage_color = EXCLUDED.foliage_color,
          generation_seed = EXCLUDED.generation_seed,
          generation_version = EXCLUDED.generation_version;
        `,
        [
          bIds,
          bCityIds,
          bRepoIds,
          bGhRepoIds,
          bRepoNames,
          bPosX,
          bPosZ,
          bHeights,
          bFloors,
          bWidths,
          bDepths,
          bTiers,
          bColors,
          bIsForks,
          bArchived,
          bSeasons,
          bFoliageColors,
          bSeeds,
          bVersions,
        ]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[GitHub World DB] Erro ao persistir mundo no PostgreSQL:", err);
  } finally {
    client.release();
  }
}

export async function findWorldByUsername(
  username: string,
  options?: { allowStale?: boolean }
): Promise<{ world: World; isStale: boolean } | null> {
  const key = username.trim().toLowerCase();

  // 1. Consulta rápida em memória
  const memGithubId = memoryLoginToGithubId.get(key);
  if (memGithubId) {
    const memRecord = memoryByGithubId.get(memGithubId);
    if (
      memRecord &&
      memRecord.world.generationVersion === GENERATION_VERSION
    ) {
      const isExpired = Date.now() > new Date(memRecord.expiresAt).getTime();
      if (!isExpired || options?.allowStale) {
        return {
          world: {
            ...memRecord.world,
            status: isExpired ? "stale" : "ready",
            metadata: { ...memRecord.world.metadata, fromCache: true },
          },
          isStale: isExpired,
        };
      }
    }
  }

  // 2. Consulta no PostgreSQL (Supabase)
  const schemaOk = await ensureDatabaseSchema();
  const pool = getPostgresPool();
  if (!schemaOk || !pool) return null;

  try {
    const res = await pool.query<{
      world_payload: World;
      expires_at: string;
      generation_version: string;
    }>(
      `
      SELECT world_payload, expires_at, generation_version
      FROM worlds
      WHERE LOWER(login) = $1
      LIMIT 1;
      `,
      [key]
    );

    if (res.rowCount === 0) return null;
    const row = res.rows[0];
    if (row.generation_version !== GENERATION_VERSION) {
      return null;
    }

    const isExpired = Date.now() > new Date(row.expires_at).getTime();
    if (isExpired && !options?.allowStale) {
      return null;
    }

    const dbWorld = row.world_payload;
    memoryByGithubId.set(dbWorld.user.githubId, {
      world: dbWorld,
      storedAt: dbWorld.generatedAt,
      expiresAt: row.expires_at,
    });
    memoryLoginToGithubId.set(
      dbWorld.user.login.toLowerCase(),
      dbWorld.user.githubId
    );

    return {
      world: {
        ...dbWorld,
        status: isExpired ? "stale" : "ready",
        metadata: {
          ...dbWorld.metadata,
          fromCache: true,
        },
      },
      isStale: isExpired,
    };
  } catch (err) {
    console.error("[GitHub World DB] Erro ao buscar mundo no PostgreSQL:", err);
    return null;
  }
}

export async function listRecentWorldsFromDatabase(
  limit = 12
): Promise<PersistedWorldSummary[]> {
  if (
    recentWorldsMemoryCache &&
    Date.now() < recentWorldsMemoryCache.expiresAt &&
    recentWorldsMemoryCache.items.length > 0
  ) {
    return recentWorldsMemoryCache.items.slice(0, limit);
  }

  const schemaOk = await ensureDatabaseSchema();
  const pool = getPostgresPool();
  if (!schemaOk || !pool) return [];

  try {
    // Consulta relacional leve (sem transferir o JSONB gigante de world_payload pela rede)
    const res = await pool.query<{
      world_id: string;
      github_id: string | number;
      login: string;
      display_name: string | null;
      avatar_url: string;
      seed: string | number;
      latitude: number;
      longitude: number;
      repository_count: number;
      total_stars: string | number;
      updated_at: string;
    }>(
      `
      SELECT
        w.id AS world_id,
        w.github_id,
        u.login,
        u.display_name,
        u.avatar_url,
        w.seed,
        c.latitude,
        c.longitude,
        c.repository_count,
        COALESCE((SELECT SUM(r.stars) FROM repositories r WHERE r.owner_id = u.id), 0) AS total_stars,
        w.updated_at
      FROM worlds w
      JOIN github_users u ON u.id = w.user_id
      JOIN cities c ON c.world_id = w.id
      WHERE w.generation_version = $1
      ORDER BY w.updated_at DESC
      LIMIT $2;
      `,
      [GENERATION_VERSION, limit]
    );

    const items = res.rows.map((r) => ({
      worldId: r.world_id,
      githubId: Number(r.github_id),
      login: r.login,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      seed: Number(r.seed),
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      buildingCount: Number(r.repository_count),
      totalStars: Number(r.total_stars),
      updatedAt: new Date(r.updated_at).toISOString(),
    }));

    recentWorldsMemoryCache = {
      items,
      expiresAt: Date.now() + 45_000, // 45s de cache em memória para /api/auth/session instantâneo
    };

    return items;
  } catch {
    return [];
  }
}
