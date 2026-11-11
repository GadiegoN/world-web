import { searchAndGenerateWorldUseCase } from "@/application/searchAndGenerateWorld";
import { checkInternalRateLimit } from "@/infrastructure/rateLimiter";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local-client";

  const rateLimit = checkInternalRateLimit(`world-search:${clientIp}`);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        flowState: "github_error",
        error: {
          code: "rate_limited",
          message: `Muitas pesquisas consecutivas. Aguarde ${rateLimit.retryAfterSeconds}s antes de tentar novamente.`,
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      }
    );
  }

  const { username } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const forceRefresh = searchParams.get("refresh") === "true";

  const result = await searchAndGenerateWorldUseCase(username, {
    forceRefresh,
  });

  const statusMap: Record<string, number> = {
    invalid_username: 400,
    user_not_found: 404,
    profile_unavailable: 451,
    rate_limited: 429,
    github_error: 502,
    internal_error: 500,
  };

  const statusCode = result.ok
    ? 200
    : statusMap[result.error?.code ?? "internal_error"] ?? 500;

  return NextResponse.json(result, { status: statusCode });
}
