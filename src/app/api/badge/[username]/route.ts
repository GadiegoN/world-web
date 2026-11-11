/**
 * GERADOR DE CARD SVG DINÂMICO PARA GITHUB PROFILE README
 * Renderiza um cartão vetorial SVG em tempo real com:
 * - Identidade do usuário, World Seed e Coordenadas na Pangeia
 * - Planeta + Pangeia vetorial
 * - Skyline 2.5D proporcional às alturas e cores reais das construções da cidade do usuário
 */

import { searchAndGenerateWorldUseCase } from "@/application/searchAndGenerateWorld";
import { checkInternalRateLimit } from "@/infrastructure/rateLimiter";
import { NextRequest, NextResponse } from "next/server";

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local-client";
  const rateLimit = checkInternalRateLimit(`badge-render:${clientIp}`);
  if (!rateLimit.allowed) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": String(rateLimit.retryAfterSeconds),
      },
    });
  }

  const { username } = await context.params;
  const result = await searchAndGenerateWorldUseCase(username);

  if (!result.ok || !result.world) {
    const errorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="220" viewBox="0 0 720 220">
      <rect width="720" height="220" rx="16" fill="#030712" stroke="#1e293b" stroke-width="2"/>
      <text x="36" y="105" fill="#f43f5e" font-family="monospace" font-size="16" font-weight="bold">GITHUB WORLD • Mundo indisponível (@${escapeXml(username)})</text>
      <text x="36" y="132" fill="#94a3b8" font-family="monospace" font-size="12">${escapeXml(result.error?.message ?? "Verifique o username informado.")}</text>
    </svg>`;
    return new NextResponse(errorSvg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  const { world } = result;
  const totalStars = world.repositories.reduce(
    (acc, r) => acc + (r.stars.value ?? 0),
    0
  );
  const totalForks = world.repositories.reduce(
    (acc, r) => acc + (r.forks.value ?? 0),
    0
  );
  const topDistrict = world.city.districts[0]?.language ?? "Poliglota";

  // Seleciona até 18 construções para compor a silhueta do Skyline no SVG
  const skylineBuildings = world.buildings.slice(0, 18);
  const baseLineY = 188;
  const startX = 330;
  const availableWidth = 356;
  const slotWidth = availableWidth / Math.max(1, skylineBuildings.length);

  const buildingRects = skylineBuildings
    .map((b, idx) => {
      // Ordena visualmente com as maiores torres mais próximas do centro do skyline
      const centeredOrder =
        idx % 2 === 0
          ? Math.floor(skylineBuildings.length / 2) + Math.floor(idx / 2)
          : Math.floor(skylineBuildings.length / 2) - Math.ceil(idx / 2);
      const bx = Math.round(startX + centeredOrder * slotWidth + 2);
      const bw = Math.max(8, Math.round(slotWidth - 4));
      const bh = Math.max(
        14,
        Math.min(132, Math.round(b.geometryParameters.height * 1.95))
      );
      const by = baseLineY - bh;
      const color = b.appearanceParameters.primaryColor;
      const spire =
        b.geometryParameters.antennaHeight > 0
          ? `<line x1="${bx + bw / 2}" y1="${by - 8}" x2="${bx + bw / 2}" y2="${by}" stroke="#f43f5e" stroke-width="1.5"/>
             <circle cx="${bx + bw / 2}" cy="${by - 8}" r="1.8" fill="#f43f5e"/>`
          : "";

      return `<g>
        ${spire}
        <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="2" fill="${color}" fill-opacity="0.88" stroke="#0f172a" stroke-width="1"/>
        <rect x="${bx + 2}" y="${by + 4}" width="${Math.max(2, bw - 4)}" height="${Math.max(4, bh - 8)}" fill="#e0f2fe" fill-opacity="0.16"/>
      </g>`;
    })
    .join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="220" viewBox="0 0 720 220">
    <defs>
      <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#030712"/>
        <stop offset="60%" stop-color="#091526"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
      <radialGradient id="planetGrad" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.45"/>
        <stop offset="65%" stop-color="${world.planet.oceanColor}"/>
        <stop offset="100%" stop-color="#020617"/>
      </radialGradient>
    </defs>

    <!-- Fundo Espacial -->
    <rect width="720" height="220" rx="16" fill="url(#bgGrad)" stroke="#1e293b" stroke-width="2"/>

    <!-- Estrelas de fundo -->
    <circle cx="420" cy="28" r="1.2" fill="#e2e8f0" opacity="0.7"/>
    <circle cx="510" cy="42" r="1.5" fill="#38bdf8" opacity="0.8"/>
    <circle cx="615" cy="24" r="1.1" fill="#e2e8f0" opacity="0.6"/>
    <circle cx="680" cy="55" r="1.4" fill="#fde047" opacity="0.7"/>
    <circle cx="370" cy="52" r="1.0" fill="#e2e8f0" opacity="0.5"/>

    <!-- Planeta + Pangeia Estilizada à direita ao fundo -->
    <circle cx="645" cy="70" r="38" fill="url(#planetGrad)" stroke="${world.planet.atmosphereColor}" stroke-width="1" stroke-opacity="0.45"/>
    <path d="M628,55 Q645,42 664,58 T658,86 Q638,94 625,75 Z" fill="${world.continent.palette.highland}" opacity="0.85"/>
    <circle cx="648" cy="68" r="3" fill="#38bdf8"/>
    <circle cx="648" cy="68" r="6" fill="none" stroke="#38bdf8" stroke-width="1" opacity="0.75"/>

    <!-- Cabeçalho e Identidade -->
    <text x="28" y="38" fill="#38bdf8" font-family="monospace" font-size="12" font-weight="bold" letter-spacing="1.5">🌐 GITHUB WORLD • UNIVERSO 3D DETERMINÍSTICO</text>
    <text x="28" y="68" fill="#ffffff" font-family="sans-serif" font-size="22" font-weight="bold">@${escapeXml(world.user.login)}</text>
    <text x="28" y="90" fill="#94a3b8" font-family="monospace" font-size="12">Seed: ${world.seed} • Pangeia (${world.city.sphericalPosition.latitude}°, ${world.city.sphericalPosition.longitude}°)</text>

    <!-- Métricas da Cidade -->
    <g transform="translate(28, 112)">
      <rect x="0" y="0" width="86" height="48" rx="8" fill="#0f172a" stroke="#1e293b"/>
      <text x="12" y="19" fill="#64748b" font-family="sans-serif" font-size="10">CONSTRUÇÕES</text>
      <text x="12" y="38" fill="#38bdf8" font-family="monospace" font-size="15" font-weight="bold">${world.buildings.length}</text>

      <rect x="96" y="0" width="96" height="48" rx="8" fill="#0f172a" stroke="#1e293b"/>
      <text x="108" y="19" fill="#64748b" font-family="sans-serif" font-size="10">TOTAL STARS</text>
      <text x="108" y="38" fill="#fbbf24" font-family="monospace" font-size="15" font-weight="bold">★ ${totalStars.toLocaleString()}</text>

      <rect x="202" y="0" width="96" height="48" rx="8" fill="#0f172a" stroke="#1e293b"/>
      <text x="214" y="19" fill="#64748b" font-family="sans-serif" font-size="10">DISTRITO LÍDER</text>
      <text x="214" y="38" fill="#34d399" font-family="monospace" font-size="12" font-weight="bold">${escapeXml(topDistrict.slice(0, 10))}</text>
    </g>

    <text x="28" y="188" fill="#64748b" font-family="monospace" font-size="11">Forks: ${totalForks.toLocaleString()} • Contribuidores em trânsito: ${world.city.contributors?.length ?? 0} • Gen v${world.generationVersion}</text>

    <!-- Silhueta do Skyline 3D da Cidade -->
    ${buildingRects}
    <line x1="322" y1="${baseLineY}" x2="696" y2="${baseLineY}" stroke="#38bdf8" stroke-width="2" stroke-opacity="0.7"/>
    <text x="510" y="206" text-anchor="middle" fill="#38bdf8" font-family="monospace" font-size="10" opacity="0.85">SKYLINE PROCEDURAL DA CIDADE DE @${escapeXml(world.user.login.toUpperCase())}</text>
  </svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

