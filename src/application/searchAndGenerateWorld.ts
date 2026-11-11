/**
 * VOLUME 07.3 & 07.7 — CAMADA DE APLICAÇÃO / CASOS DE USO
 * Orquestra o fluxo completo com PostgreSQL (Supabase) e Sessão OAuth do GitHub:
 * Pesquisa -> Validação -> Persistência Relacional -> Consulta GitHub (OAuth/Server Token) ->
 * Normalização -> Geração Determinística -> Persistência PostgreSQL -> Resposta estruturada.
 */

import { SearchFlowState, World } from "@/domain/types";
import { generateWorld } from "@/generation/worldGenerator";
import { logOperationalEvent } from "@/infrastructure/logger";
import { getCurrentGitHubSession } from "@/infrastructure/persistence/authRepository";
import {
  findWorldByUsername,
  saveWorldToRepository,
} from "@/infrastructure/persistence/worldRepository";
import {
  fetchGitHubUserAndRepositories,
  GitHubIntegrationError,
  validateGitHubUsername,
} from "@/integrations/github/githubProvider";

export interface SearchWorldResponse {
  ok: boolean;
  flowState: SearchFlowState;
  world?: World;
  error?: {
    code: string;
    message: string;
  };
}

export async function searchAndGenerateWorldUseCase(
  rawUsername: string,
  options?: { forceRefresh?: boolean }
): Promise<SearchWorldResponse> {
  // 1. Validação de entrada
  let username: string;
  try {
    username = validateGitHubUsername(rawUsername);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Username inválido informado na pesquisa.";
    return {
      ok: false,
      flowState: "idle",
      error: { code: "invalid_username", message },
    };
  }

  logOperationalEvent("search_started", "integration", { username });

  // 2. Verifica mundo persistido válido no PostgreSQL/Cache se não foi solicitado refresh forçado
  if (!options?.forceRefresh) {
    const cached = await findWorldByUsername(username, { allowStale: false });
    if (cached) {
      logOperationalEvent("world_restored_from_storage", "persistence", {
        username,
        worldId: cached.world.id,
      });
      const flowState: SearchFlowState =
        cached.world.repositories.length === 0
          ? "empty_repositories"
          : cached.world.metadata.isPartialData
            ? "partial_data"
            : "city_ready";
      return {
        ok: true,
        flowState,
        world: cached.world,
      };
    }
  }

  // 3. Consulta à API do GitHub (usando token OAuth do usuário logado ou GITHUB_TOKEN do servidor)
  try {
    const session = await getCurrentGitHubSession();
    const githubData = await fetchGitHubUserAndRepositories(username, {
      accessToken: session?.accessToken,
    });

    logOperationalEvent("user_found", "integration", {
      username: githubData.user.login,
      githubId: githubData.user.githubId,
    });

    logOperationalEvent("github_query_completed", "integration", {
      username: githubData.user.login,
      repositoryCount: githubData.repositories.length,
      contributorsCount: githubData.contributors.length,
      isPartialData: githubData.isPartialData,
    });

    if (githubData.isPartialData) {
      logOperationalEvent("partial_collection", "integration", {
        username: githubData.user.login,
        warnings: githubData.warnings,
      });
    }

    // 4. Geração determinística do Mundo, Planeta, Pangeia, Cidade, Construções e Veículos de Contribuidores
    logOperationalEvent("generation_started", "generation", {
      username: githubData.user.login,
      githubId: githubData.user.githubId,
    });

    const world = generateWorld({
      user: githubData.user,
      repositories: githubData.repositories,
      contributors: githubData.contributors,
      followers: githubData.followers,
      dataCollectedAt: githubData.collectedAt,
      isPartialData: githubData.isPartialData,
      warnings: githubData.warnings,
    });

    // 5. Persistência relacional no PostgreSQL (Supabase)
    await saveWorldToRepository(world);

    logOperationalEvent("generation_completed", "generation", {
      username: githubData.user.login,
      worldId: world.id,
      buildings: world.buildings.length,
    });

    const flowState: SearchFlowState =
      world.repositories.length === 0
        ? "empty_repositories"
        : world.metadata.isPartialData
          ? "partial_data"
          : "city_ready";

    return {
      ok: true,
      flowState,
      world,
    };
  } catch (err) {
    // Requisito Volume 11.7: A indisponibilidade do GitHub não deve tornar impossível
    // visualizar um mundo previamente gerado e persistido no banco de dados.
    const staleFallback = await findWorldByUsername(username, {
      allowStale: true,
    });
    if (
      staleFallback &&
      err instanceof GitHubIntegrationError &&
      (err.code === "github_error" || err.code === "rate_limited")
    ) {
      staleFallback.world.metadata.warnings = [
        ...staleFallback.world.metadata.warnings,
        `GitHub temporariamente indisponível (${err.message}). Exibindo mundo recuperado do banco de dados PostgreSQL.`,
      ];
      logOperationalEvent("world_restored_from_storage", "persistence", {
        username,
        worldId: staleFallback.world.id,
        fallbackFromError: err.code,
      });
      return {
        ok: true,
        flowState: "partial_data",
        world: staleFallback.world,
      };
    }

    if (err instanceof GitHubIntegrationError) {
      const stateMap: Record<GitHubIntegrationError["code"], SearchFlowState> = {
        invalid_username: "idle",
        user_not_found: "user_not_found",
        profile_unavailable: "profile_unavailable",
        rate_limited: "github_error",
        github_error: "github_error",
      };

      return {
        ok: false,
        flowState: stateMap[err.code],
        error: {
          code: err.code,
          message: err.message,
        },
      };
    }

    logOperationalEvent("generation_failed", "generation", {
      username,
      error: err instanceof Error ? err.message : String(err),
    });

    return {
      ok: false,
      flowState: "github_error",
      error: {
        code: "internal_error",
        message:
          err instanceof Error
            ? err.message
            : "Ocorreu um erro inesperado ao gerar o mundo tridimensional.",
      },
    };
  }
}
