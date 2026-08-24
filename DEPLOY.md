# Deploying the demo

Two free services: the Express API and the Next.js site. Both build from this
repo. Nothing here contains a secret — every value below is pasted into the
hosting dashboard once.

The MongoDB Atlas cluster is **already seeded** with the demo dataset (16
students, 4 groups running 24/7, 484 lessons, invoices, payments, expenses,
fines, payroll and leads).

---

## 1. Push the repo

Both platforms deploy from GitHub, so the branch has to be pushed first:

```bash
git push -u origin feat/crm-panels-online-tests
```

---

## 2. Backend — Render (free)

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**
2. Pick this repository. Render reads `render.yaml` and offers both services.
3. Fill in the values it asks for on `leader-api`:

| Variable | Value |
|---|---|
| `MONGO_URL` | your Atlas URI, **with `/leader` before the `?`** |
| `JWT_SECRET` | the 64-char secret generated for you (see the chat, or make a new one) |
| `ENCRYPTION_KEY` | the 64-hex-char key generated for you |
| `CORS_ORIGINS` | leave blank for now — filled in at step 4 |
| `SEED_SUPERADMIN_PHONE` | `+998123456789` |
| `SEED_SUPERADMIN_PASSWORD` | your boss password |

4. Deploy. When it is up, check `https://<api>.onrender.com/api/v1/health` —
   it must report `{"data":{"status":"ok","db":"connected"}}`.

The Atlas URI must end with the database name, or Mongo connects to `test` and
the app finds an empty centre:

```
mongodb+srv://USER:PASS@cluster0.xxxx.mongodb.net/leader?appName=Cluster0
```

**Atlas network access:** add `0.0.0.0/0` under Network Access, or Render's
containers cannot reach the cluster. That is fine for a demo; tighten it after.

---

## 3. Frontend — Vercel (free, recommended) or Render

Vercel is the better host for Next.js and has no cold start, which matters when
a client is watching.

**Vercel:** New Project → import the repo → then override the defaults, because
this is a monorepo:

| Setting | Value |
|---|---|
| Framework preset | Next.js |
| Root Directory | `.` (repo root — **not** `apps/web`) |
| Install Command | `npm ci` |
| Build Command | `npm run build:shared && npm run build --workspace=@leader/web` |
| Output Directory | `apps/web/.next-build` |

The non-default output directory is deliberate: `next.config.ts` gives `dev` and
`build` separate directories so building never overwrites the chunks a running
dev server is serving. Vercel needs to be told where the build actually landed.

Environment variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<api>.onrender.com` |
| `API_URL` | `https://<api>.onrender.com` |

`NEXT_PUBLIC_API_URL` is read by the browser, so it is baked into the bundle at
**build** time. Changing it later needs a redeploy, not a restart.

**Or Render:** the blueprint already defines `leader-web`. Same two variables.

---

## 4. Close the loop on CORS

Go back to `leader-api` on Render, set

```
CORS_ORIGINS=https://<your-web-domain>
```

and redeploy. Until this is set the browser blocks every API call and the panels
sit on a spinner. Several origins are comma-separated, no spaces.

---

## 5. Demo logins

| Role | Phone | Password |
|---|---|---|
| SuperAdmin (boss) | `+998123456789` | whatever you set as `SEED_SUPERADMIN_PASSWORD` |
| Manager | `+998900000102` | `DemoParol2026!` |
| Teacher | `+998900000103` | `DemoParol2026!` |
| Teacher | `+998900000104` | `DemoParol2026!` |
| Student | `+998901000000` | `DemoParol2026!` |

The boss account is created with `mustChangePassword`, so the first sign-in asks
for a new password. Set it before the demo rather than during it.

---

## 6. Re-seeding later

The seed is idempotent — it never overwrites a collection that already has rows,
so running it twice is safe and does nothing the second time.

```bash
MONGO_URL="mongodb+srv://…/leader?appName=Cluster0" npm run seed
```

To rebuild the demo from scratch, drop the `leader` database in Atlas first,
then run the same command.

---

## After the demo

- **Rotate the Atlas password.** It was shared in plain text to set this up, so
  treat it as compromised: Atlas → Database Access → Edit → Edit Password, then
  update `MONGO_URL` on Render.
- **Remove `SEED_SUPERADMIN_*`** from Render once the boss account exists. They
  are only needed to create the very first account.
- **Narrow Atlas Network Access** from `0.0.0.0/0` to Render's egress IPs.
- **Turn on 2FA** for the boss account (`/account` → two-factor). It is the only
  account that can read every branch's finance.
