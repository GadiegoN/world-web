"use client";

import { World } from "@/domain/types";
import React, { useState } from "react";

interface BadgeReadmeModalProps {
  world: World;
  onClose: () => void;
}

export default function BadgeReadmeModal({
  world,
  onClose,
}: BadgeReadmeModalProps) {
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://githubworld.dev";
  const mdCode = `[![Cidade 3D de @${world.user.login} no GitHub World](${origin}/api/badge/${encodeURIComponent(world.user.login)})](${origin}/u/${encodeURIComponent(world.user.login)})`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">
              🪪 Card SVG Dinâmico para o seu GitHub README
            </h2>
            <p className="text-xs text-slate-400">
              Exiba o Skyline determinístico da cidade de @{world.user.login}{" "}
              diretamente no perfil do GitHub.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:text-white cursor-pointer"
          >
            ✕ Fechar
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2 flex justify-center">
          <img
            src={`/api/badge/${encodeURIComponent(world.user.login)}`}
            alt={`GitHub World Skyline de @${world.user.login}`}
            className="w-full max-w-[720px] h-auto rounded-lg"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-sky-300">
            Snippet Markdown (cole no seu README.md):
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={mdCode}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(mdCode);
                setCopiedMarkdown(true);
                setTimeout(() => setCopiedMarkdown(false), 2200);
              }}
              className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 cursor-pointer shrink-0"
            >
              {copiedMarkdown ? "✓ Copiado!" : "Copiar Markdown"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

