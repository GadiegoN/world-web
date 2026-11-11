# GitHub World (`v1.5.0`)

Universo tridimensional determinístico onde cada usuário do GitHub possui um **Planeta** (`R = 120`), uma **Pangeia única** gerada por harmônicos esféricos 3D e uma **Cidade** cujas construções, vegetação sazonal, monumentos e tráfego de veículos refletem métricas reais dos seus repositórios públicos.

---

## Arquitetura do Repositório

- [`rag.md`](../rag.md) — **Livro Técnico e Funcional Canônico** (Volumes `00` a `15` e decisões `ADR-001` a `ADR-020`).
- [`docs/`](../docs/README.md) — Documentação modular gerada e validada automaticamente com frontmatter YAML (`00-fundamentos` a `15-rag`).
- `world-web/` — Aplicação web Next.js 16 (App Router) + Three.js WebGL + PostgreSQL (Supabase):
  - `src/domain/` — Entidades (`GitHubUser`, `World`, `Planet`, `Continent`, `City`, `Repository`, `Building`) e validação de invariantes (`integrity.ts`).
  - `src/generation/` — Sementes determinísticas FNV-1a/Mulberry32 (`seed.ts`), geografia esférica (`geographyGenerator.ts`), urbanismo espiral, seguidores na Pangeia e tráfego (`cityGenerator.ts`), fórmulas logarítmicas auditáveis (`buildingGenerator.ts`).
  - `src/rendering/` — Motor 3D modularizado (`atmospherePresets.ts`, `facadeMaterialCache.ts`, `cameraController.ts`, `planetSceneBuilder.ts`, `citySceneBuilder.ts`) com `THREE.InstancedMesh` e suporte a mouse, teclado (`1..6`, `WASD`) e toque mobile (pinch-to-zoom).
  - `src/integrations/github/` — Cliente REST API v3 do GitHub com paginação, coleta de contribuidores e seguidores.
  - `src/infrastructure/` — Pool PostgreSQL/Supabase (`postgres.ts`), persistência vetorial em lote via `UNNEST` (`worldRepository.ts`), sessões GitHub OAuth 2.0 (`authRepository.ts`), logs e rate limiting.
  - `src/rag/` — Indexador semântico (`bookRag.ts`) com fallback em PostgreSQL (`rag_documents`) e suíte de benchmark (`ragEvaluator.ts`).

---

## Variáveis de Ambiente (`.env`)

Crie um arquivo `.env` em `world-web/.env`:

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Comandos Principais

```bash
# Instalar dependências
npm install

# Sincronizar documentação canônica (rag.md -> docs/ + PostgreSQL) e rodar suíte de testes
npm test

# Iniciar servidor de desenvolvimento
npm run dev

# Executar build de produção
npm run build
```

---

## Rotas Principais

- `/` — Experiência 3D orbital e pesquisa interativa por `@username`.
- `/u/[username]` — Link direto compartilhável da cidade 3D com OpenGraph e Twitter Card dinâmicos.
- `/api/worlds/[username]` — Geração/recuperação determinística do mundo com cache SWR no PostgreSQL (`?refresh=true` para forçar atualização).
- `/api/badge/[username]` — Cartão vetorial SVG dinâmico com skyline 2.5D para incorporar no `README.md` do perfil GitHub.
- `/api/auth/github` & `/api/auth/session` — Fluxo completo de login OAuth 2.0 com GitHub.
- `/api/rag` — Consulta semântica e benchmark dos 16 volumes canônicos.
