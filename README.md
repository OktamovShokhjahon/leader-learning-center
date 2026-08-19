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

**Phase 0 (setup), Phase 6 (public site) and the authentication half of Phase 1
are in place.**

Done:
- Monorepo, shared package, design tokens and UI kit
- Full public website: all 15 routes of TZ §6.1 in uz / ru / en, prerendered with
  ISR, hreflang, JSON-LD, dynamic sitemap and robots
- The "living glaze" WebGL hero (§25.4) with its static / reduced-motion fallbacks
- Registration: short inline form and the three-step flow (§7.1), validated by the
  shared zod schema on both sides
- **Authentication (§8)** — argon2id passwords with a shared common-password
  blocklist, 15-minute access tokens plus 30-day refresh cookies rotated on every
  use with reuse detection, the "Faol qurilmalar" session list with remote
  termination, progressive lockout on phone + IP, TOTP 2FA (mandatory for
  SuperAdmin, with a bootstrap path for the first account), and an audit entry
  with IP and user-agent on every auth event
- **Branches (§5)** — CRUD, archive-not-delete, and the SuperAdmin branch
  switcher whose selection lives on the session document, not in a cookie
- **Staff (§4.2)** — user CRUD, role assignment, password reset and
  deactivation, with the "who may create whom" matrix enforced in the service
- `GET /leads` and the funnel counts (§7.2, §23), which double as the end-to-end
  proof that the §5.1 branch-scope plugin filters a controller that never
  mentions `branchId`

Not yet done in Phase 1:
- Students, courses, groups, rooms, lessons and the schedule grid (§9)
- The CRM and boss panels in `apps/web` — the API surface above has no UI yet;
  `/kirish` is still a placeholder
- SMS OTP login for students and parents (§8) — needs the Eskiz.uz account (§31 Q5)

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

## First sign-in

There is no public staff registration (§8), so the first SuperAdmin is seeded
from the environment. Set both variables in `apps/api/.env`:

```bash
SEED_SUPERADMIN_PHONE=+998901234567
SEED_SUPERADMIN_PASSWORD=<a long password you have not used elsewhere>
```

Restart the API. Because §8 makes 2FA mandatory for SuperAdmin, that account
cannot sign in until it has enrolled one:

1. `POST /api/v1/auth/2fa/bootstrap` with the phone and password — returns a
   secret and an `otpauth://` URI to scan.
2. `POST /api/v1/auth/2fa/bootstrap/verify` with the phone, password and the
   6-digit code.
3. `POST /api/v1/auth/login` now works with `totpCode`.

Then change the password and remove `SEED_SUPERADMIN_*` from the environment.

# leader-learning-center
