import GitHubWorldExperience from "@/components/GitHubWorldExperience";
import type { Metadata } from "next";
import { connection } from "next/server";
import React, { Suspense } from "react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const resolved = await params;
  const username = decodeURIComponent(resolved.username || "github");
  const title = `Cidade 3D de @${username} • GitHub World`;
  const description = `Explore o Planeta, a Pangeia única e a Cidade Tridimensional determinística gerada a partir dos repositórios públicos de @${username} no GitHub.`;
  const badgeUrl = `/api/badge/${encodeURIComponent(username)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: badgeUrl,
          width: 760,
          height: 250,
          alt: `Skyline 3D de @${username} no GitHub World`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [badgeUrl],
    },
  };
}

async function UserWorldDynamicContent({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  await connection();
  const resolved = await params;
  const username = decodeURIComponent(resolved.username || "");
  return <GitHubWorldExperience initialUsername={username} />;
}

export default function UserWorldPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-sky-300 font-mono text-sm">
          Inicializando telemetria orbital do GitHub World...
        </div>
      }
    >
      <UserWorldDynamicContent params={params} />
    </Suspense>
  );
}
