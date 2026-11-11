/**
 * VOLUME 05 & VOLUME 11 — INTEGRAÇÃO COM GITHUB
 * Consulta pública de usuários e repositórios com paginação, validação de entrada,
 * distinção de erros e normalização estrita de métricas.
 */

import { GitHubUser, MetricValueState, Repository } from "@/domain/types";

export type GitHubFetchErrorCode =
  | "invalid_username"
  | "user_not_found"
  | "profile_unavailable"
  | "rate_limited"
  | "github_error";

export class GitHubIntegrationError extends Error {
  constructor(
    public readonly code: GitHubFetchErrorCode,
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "GitHubIntegrationError";
  }
}

export interface RawContributorItem {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  contributions: number;
  repositoryId: string;
  repositoryName: string;
}

export interface RawFollowerItem {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
}

export interface NormalizedGitHubData {
  user: GitHubUser;
  repositories: Repository[];
  contributors: RawContributorItem[];
  followers: RawFollowerItem[];
  collectedAt: string;
  isPartialData: boolean;
  warnings: string[];
}

const GITHUB_USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

export function validateGitHubUsername(rawUsername: string): string {
  const trimmed = rawUsername.trim();
  if (!trimmed || !GITHUB_USERNAME_REGEX.test(trimmed)) {
    throw new GitHubIntegrationError(
      "invalid_username",
      "O username informado não possui um formato válido do GitHub (use 1 a 39 caracteres alfanuméricos ou hífens internos)."
    );
  }
  return trimmed;
}

function buildGitHubHeaders(overrideAccessToken?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "GitHub-World-Engine/1.2",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  // Prioriza o token OAuth do usuário autenticado; fallback para o GITHUB_TOKEN do servidor (Volume 11.2)
  const token = overrideAccessToken || process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function normalizeNumberMetric(
  raw: unknown,
  source: string
): MetricValueState<number> {
  if (raw === null || raw === undefined || typeof raw !== "number" || Number.isNaN(raw)) {
    return {
      value: null,
      status: "not_available",
      source,
    };
  }
  return {
    value: raw,
    status: raw === 0 ? "zero" : "available",
    source,
  };
}

function normalizeStringMetric(
  raw: unknown,
  source: string
): MetricValueState<string> {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return {
      value: null,
      status: "not_available",
      source,
    };
  }
  return {
    value: raw.trim(),
    status: "available",
    source,
  };
}

interface RawGitHubUserResponse {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}

interface RawGitHubRepoResponse {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  size?: number;
  fork?: boolean;
  archived?: boolean;
  topics?: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
}

/**
 * Consulta o perfil público do usuário e pagina seus repositórios públicos no GitHub.
 */
export async function fetchGitHubUserAndRepositories(
  rawUsername: string,
  options?: { accessToken?: string }
): Promise<NormalizedGitHubData> {
  const username = validateGitHubUsername(rawUsername);
  const headers = buildGitHubHeaders(options?.accessToken);
  const collectedAt = new Date().toISOString();

  // 1. Consulta de perfil do usuário
  let userRes: Response;
  try {
    userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers,
      next: { revalidate: 300 },
    });
  } catch {
    throw new GitHubIntegrationError(
      "github_error",
      "Falha de comunicação de rede ao consultar a API do GitHub."
    );
  }

  if (userRes.status === 404) {
    throw new GitHubIntegrationError(
      "user_not_found",
      `O usuário "${username}" não foi encontrado no GitHub.`,
      404
    );
  }

  if (userRes.status === 451) {
    throw new GitHubIntegrationError(
      "profile_unavailable",
      `O perfil "${username}" está indisponível por restrições da plataforma.`,
      451
    );
  }

  if (userRes.status === 403 || userRes.status === 429) {
    const remaining = userRes.headers.get("x-ratelimit-remaining");
    if (remaining === "0" || userRes.status === 429) {
      throw new GitHubIntegrationError(
        "rate_limited",
        "Limite de requisições da API do GitHub atingido. Configure GITHUB_TOKEN no servidor ou aguarde alguns minutos.",
        userRes.status
      );
    }
    throw new GitHubIntegrationError(
      "profile_unavailable",
      `Acesso negado ao consultar o perfil "${username}".`,
      userRes.status
    );
  }

  if (!userRes.ok) {
    throw new GitHubIntegrationError(
      "github_error",
      `Erro inesperado da API do GitHub (HTTP ${userRes.status}).`,
      userRes.status
    );
  }

  const rawUser = (await userRes.json()) as RawGitHubUserResponse;
  if (!rawUser || typeof rawUser.id !== "number" || typeof rawUser.login !== "string") {
    throw new GitHubIntegrationError(
      "github_error",
      "Resposta de perfil do GitHub incompleta ou malformada."
    );
  }

  const user: GitHubUser = {
    id: `usr_${rawUser.id}`,
    githubId: rawUser.id,
    login: rawUser.login,
    displayName: rawUser.name ?? null,
    avatarUrl: rawUser.avatar_url,
    profileUrl: rawUser.html_url,
    bio: rawUser.bio ?? null,
    publicReposCount: typeof rawUser.public_repos === "number" ? rawUser.public_repos : 0,
    followers: typeof rawUser.followers === "number" ? rawUser.followers : 0,
    following: typeof rawUser.following === "number" ? rawUser.following : 0,
    githubCreatedAt: rawUser.created_at,
    createdAt: collectedAt,
    updatedAt: collectedAt,
  };

  // 2. Coleta paginada de repositórios públicos (Volume 05.3)
  const repositories: Repository[] = [];
  const warnings: string[] = [];
  let isPartialData = false;

  const maxPages = 3; // Até 300 repositórios públicos por geração sob demanda
  const perPage = 100;

  for (let page = 1; page <= maxPages; page++) {
    if (user.publicReposCount === 0) break;

    try {
      const reposUrl = `https://api.github.com/users/${encodeURIComponent(
        rawUser.login
      )}/repos?per_page=${perPage}&page=${page}&sort=updated&direction=desc&type=owner`;

      const reposRes = await fetch(reposUrl, {
        headers,
        next: { revalidate: 300 },
      });

      if (!reposRes.ok) {
        isPartialData = true;
        warnings.push(
          `Coleta parcial na página ${page} de repositórios (HTTP ${reposRes.status}).`
        );
        break;
      }

      const rawRepos = (await reposRes.json()) as RawGitHubRepoResponse[];
      if (!Array.isArray(rawRepos)) {
        isPartialData = true;
        warnings.push(`Formato inesperado na página ${page} de repositórios.`);
        break;
      }

      for (const r of rawRepos) {
        if (!r || typeof r.id !== "number" || typeof r.name !== "string") continue;

        repositories.push({
          id: `repo_${r.id}`,
          githubRepositoryId: r.id,
          ownerId: user.id,
          name: r.name,
          fullName: r.full_name ?? `${user.login}/${r.name}`,
          description: r.description ?? null,
          htmlUrl: r.html_url,
          language: normalizeStringMetric(r.language, "github:repos.language"),
          stars: normalizeNumberMetric(r.stargazers_count, "github:repos.stargazers_count"),
          forks: normalizeNumberMetric(r.forks_count, "github:repos.forks_count"),
          openIssues: normalizeNumberMetric(r.open_issues_count, "github:repos.open_issues_count"),
          sizeKb: normalizeNumberMetric(r.size, "github:repos.size"),
          isFork: Boolean(r.fork),
          archived: Boolean(r.archived),
          topics: Array.isArray(r.topics) ? r.topics : [],
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          pushedAt: r.pushed_at ?? null,
        });
      }

      if (rawRepos.length < perPage) {
        break;
      }

      if (page === maxPages && user.publicReposCount > repositories.length) {
        isPartialData = true;
        warnings.push(
          `Exibindo os ${repositories.length} repositórios mais recentes de um total de ${user.publicReposCount} repositórios públicos.`
        );
      }
    } catch {
      isPartialData = true;
      warnings.push(`Falha de comunicação ao obter a página ${page} de repositórios.`);
      break;
    }
  }

  // 3. Coleta de contribuidores reais dos principais repositórios para o tráfego urbano (Volume 05.4)
  const contributors: RawContributorItem[] = [];
  if (repositories.length > 0) {
    const candidateRepos = [...repositories]
      .filter((r) => (r.sizeKb.value ?? 0) > 0)
      .sort((a, b) => (b.stars.value ?? 0) - (a.stars.value ?? 0))
      .slice(0, 5);

    const contribPromises = candidateRepos.map(async (repo) => {
      try {
        const contribUrl = `https://api.github.com/repos/${encodeURIComponent(
          user.login
        )}/${encodeURIComponent(repo.name)}/contributors?per_page=8`;
        const res = await fetch(contribUrl, {
          headers,
          next: { revalidate: 600 },
        });
        if (!res.ok) return [];
        const data = (await res.json()) as Array<{
          login?: string;
          id?: number;
          avatar_url?: string;
          html_url?: string;
          contributions?: number;
          type?: string;
        }>;
        if (!Array.isArray(data)) return [];
        return data
          .filter(
            (c) =>
              c &&
              typeof c.login === "string" &&
              typeof c.id === "number" &&
              c.type !== "Bot"
          )
          .map((c) => ({
            login: c.login!,
            id: c.id!,
            avatar_url: c.avatar_url ?? "",
            html_url: c.html_url ?? `https://github.com/${c.login}`,
            contributions: typeof c.contributions === "number" ? c.contributions : 1,
            repositoryId: repo.id,
            repositoryName: repo.name,
          }));
      } catch {
        return [];
      }
    });

    const settled = await Promise.all(contribPromises);
    const flatContribs = settled.flat();

    // Prioriza contribuidores externos (diferentes do dono) e mescla em rodízio entre projetos diferentes
    const externalContribs = flatContribs.filter(
      (c) => c.login.toLowerCase() !== user.login.toLowerCase()
    );
    const ownerContribs = flatContribs.filter(
      (c) => c.login.toLowerCase() === user.login.toLowerCase()
    );

    const seenPairs = new Set<string>();
    for (const item of [...externalContribs, ...ownerContribs]) {
      const key = `${item.login.toLowerCase()}:${item.repositoryId}`;
      if (!seenPairs.has(key)) {
        seenPairs.add(key);
        contributors.push(item);
      }
      if (contributors.length >= 16) break;
    }
  }

  // 4. Coleta dos seguidores do perfil para posicionamento de assentamentos vizinhos na Pangeia
  const followers: RawFollowerItem[] = [];
  if (user.followers > 0) {
    try {
      const followersUrl = `https://api.github.com/users/${encodeURIComponent(
        rawUser.login
      )}/followers?per_page=24`;
      const followersRes = await fetch(followersUrl, {
        headers,
        next: { revalidate: 600 },
      });
      if (followersRes.ok) {
        const rawFollowers = (await followersRes.json()) as Array<{
          login?: string;
          id?: number;
          avatar_url?: string;
          html_url?: string;
          type?: string;
        }>;
        if (Array.isArray(rawFollowers)) {
          for (const f of rawFollowers) {
            if (
              f &&
              typeof f.login === "string" &&
              typeof f.id === "number" &&
              f.type !== "Bot"
            ) {
              followers.push({
                login: f.login,
                id: f.id,
                avatar_url: f.avatar_url ?? "",
                html_url: f.html_url ?? `https://github.com/${f.login}`,
              });
            }
          }
        }
      }
    } catch {
      // Falha não-crítica na coleta de seguidores
    }
  }

  return {
    user,
    repositories,
    contributors,
    followers,
    collectedAt,
    isPartialData,
    warnings,
  };
}

