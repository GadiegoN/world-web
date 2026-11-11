import {
  createGitHubAuthSession,
  SESSION_COOKIE_NAME,
} from "@/infrastructure/persistence/authRepository";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const savedState = request.cookies.get("ghw_oauth_state")?.value;
  const origin = request.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/?auth_error=missing_code`);
  }

  // Validação estrita de state contra ataques CSRF no OAuth (Volume 11.1)
  if (!returnedState || !savedState || returnedState !== savedState) {
    return NextResponse.redirect(`${origin}/?auth_error=invalid_oauth_state`);
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/?auth_error=missing_oauth_config`);
  }

  try {
    // 1. Troca o authorization code pelo access_token OAuth no GitHub
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      }
    );

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
    };

    if (!tokenData.access_token) {
      return NextResponse.redirect(`${origin}/?auth_error=token_exchange_failed`);
    }

    // 2. Obtém o perfil do usuário autenticado no GitHub
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "GitHub-World-Engine/1.2",
      },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(`${origin}/?auth_error=user_fetch_failed`);
    }

    const ghUser = (await userRes.json()) as {
      id: number;
      login: string;
      name: string | null;
      avatar_url: string;
    };

    // 3. Cria sessão no PostgreSQL (Supabase) e define cookie HttpOnly seguro
    const session = await createGitHubAuthSession({
      githubId: ghUser.id,
      login: ghUser.login,
      displayName: ghUser.name ?? null,
      avatarUrl: ghUser.avatar_url,
      accessToken: tokenData.access_token,
    });

    // Redireciona diretamente para a Cidade 3D do usuário recém-autenticado!
    const response = NextResponse.redirect(
      `${origin}/u/${encodeURIComponent(ghUser.login)}`
    );

    response.cookies.set(SESSION_COOKIE_NAME, session.sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14, // 14 dias
    });
    response.cookies.delete("ghw_oauth_state");

    return response;
  } catch (err) {
    console.error("[GitHub World OAuth] Erro no callback:", err);
    return NextResponse.redirect(`${origin}/?auth_error=callback_exception`);
  }
}

