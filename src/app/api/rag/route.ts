import { verifyDeterministicGenerationSuite } from "@/generation/determinismVerifier";
import { getRecentOperationalLogs } from "@/infrastructure/logger";
import {
  ensureCanonicalBookLoadedAsync,
  searchCanonicalRag,
} from "@/rag/bookRag";
import { evaluateCanonicalRag } from "@/rag/ragEvaluator";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  await ensureCanonicalBookLoadedAsync();
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const ragResult = searchCanonicalRag(q, 8);
  const logs = await getRecentOperationalLogs(15);
  const determinismSuite = verifyDeterministicGenerationSuite();
  const ragEvaluation = evaluateCanonicalRag();

  return NextResponse.json({
    ...ragResult,
    logs,
    determinismSuite,
    ragEvaluation,
  });
}
