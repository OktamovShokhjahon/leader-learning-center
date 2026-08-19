# Leader LC — CRM + Public Website

Monorepo for Leader Learning Centre (Urganch, Xorazm). Built to `docs/tz.md`.

| Workspace | What it is |
|---|---|
| `apps/web` | Next.js 15 — public website, and later the cabinet / CRM / boss panels |
| `apps/api` | Express 5 + Mongoose 8 — all business logic and persistence |
| `packages/shared` | Permission map, zod schemas, money and locale helpers, shared by both |
| `packages/config` | Base tsconfig |
| `infra` | Docker Compose: MongoDB replica set, Redis, MinIO |

`apps/web` never talks to MongoDB. Its `app/api/*` routes are a BFF proxy only (TZ §24.1).

---

## Requirements

| | |
|---|---|
| Node | **22 LTS** (`.nvmrc`). Newer majors lack prebuilt binaries for `argon2`, `sharp`, `mupdf` and the ffmpeg bindings the later phases need. |
| npm | 11+ (workspaces) |
| Docker | Needed for MongoDB. Transactions require a replica set (TZ §26.4), so a standalone `mongod` will not do. |

## Setup

```bash
npm install
npm run build:shared
```

`packages/shared` is compiled to `dist` and consumed as built JS by both apps, so
the same permission map and zod schemas are used on the client, on the server and
in tests. The `predev` / `prebuild` / `pretest` hooks rebuild it automatically;
run `npm run dev --workspace=@leader/shared` to watch it while working on it.

## Running

```bash
docker compose -f infra/docker-compose.yml up -d
```

```bash
cp apps/api/.env.example apps/api/.env
```

Set `MONGO_URL=mongodb://localhost:27017/leader?replicaSet=rs0&directConnection=true`
in `apps/api/.env`, then:

```bash
npm run dev:api
```

```bash
npm run dev
```

- Website — http://localhost:3000/uz
- API — http://localhost:4000/api/v1/health

For the website's application form to reach the API, add `API_URL=http://localhost:4000`
to `apps/web/.env.local`. Without it the form returns a clear `API_NOT_CONFIGURED`
error rather than pretending to succeed.

### Without Docker

`USE_MEMORY_DB=true` starts an in-memory single-node replica set, downloading a
`mongod` binary from `fastdl.mongodb.org` on first run. If that host is
unreachable, the API still starts and serves everything that does not touch
Mongo — health, validation, the error envelope — and logs a clear warning.
Endpoints that need the database fail fast rather than hanging.

## Checks

```bash
npm run typecheck && npm run test && npm run build
```

## Status

**Phase 0 (setup) and Phase 6 (public site) are in place.**

Done:
- Monorepo, shared package, design tokens and UI kit
- Full public website: all 15 routes of TZ §6.1 in uz / ru / en, prerendered with
  ISR, hreflang, JSON-LD, dynamic sitemap and robots
- The "living glaze" WebGL hero (§25.4) with its static / reduced-motion fallbacks
- Registration: short inline form and the three-step flow (§7.1), validated by the
  shared zod schema on both sides
- API skeleton: env validation, error envelope, rate limiting, the
  `AsyncLocalStorage` branch-scope plugin (§5.1), `leads` and `branches` models,
  public lead and contact endpoints

Not yet done on the public site, and why:
- **SMS OTP and Cloudflare Turnstile** on the registration form (§7.1) — need the
  client's Eskiz.uz account and an approved sender name (§31 Q5). The honeypot and
  rate limiting are already in place.
- **Real content** — teacher names and photos, student results, testimonials, news,
  gallery, branch addresses. Everything in `apps/web/src/content/` is a flagged
  placeholder; results and testimonials ship *empty* on purpose rather than
  inventing exam scores. Needs §31 Q10 and Q15.
- **Public offer and privacy policy** text — must come from the centre's lawyer,
  and is legally required before online payment goes live (§11.4).
- **Analytics** (Yandex.Metrica, GA4, Meta Pixel) — need account IDs.
- **Lighthouse CI budget** (§30.13) — to be wired in the Phase 8 performance pass.

`/kirish` is a placeholder: real authentication is Phase 1 (§8).
# leader-learning-center
