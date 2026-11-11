import {
  destroyCurrentGitHubSession,
  getCurrentGitHubSession,
} from "@/infrastructure/persistence/authRepository";
import { listRecentWorldsFromDatabase } from "@/infrastructure/persistence/worldRepository";
import { NextResponse } from "next/server";

export async function GET() {
  const [session, recentWorlds] = await Promise.all([
    getCurrentGitHubSession(),
    listRecentWorldsFromDatabase(12),
  ]);

  return NextResponse.json({
    authenticated: Boolean(session),
    user: session
      ? {
          githubId: session.githubId,
          login: session.login,
          displayName: session.displayName,
          avatarUrl: session.avatarUrl,
        }
      : null,
    recentWorlds,
  });
}

export async function POST() {
  await destroyCurrentGitHubSession();
  return NextResponse.json({ ok: true });
}

