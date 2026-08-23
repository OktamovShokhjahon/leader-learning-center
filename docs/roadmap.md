# Roadmap — from here to a complete TZ

Derived from `docs/tz.md` by diffing it against what is actually built.
Written 2026-08-23, immediately after Phase 0 landed.

**Where the build stands:** 13 of the 29 collections in §22 exist. 71 routes are
mounted across 10 routers. Of the 15 panel screens, four have any create/edit
affordance at all. The public site, auth, branches, students, groups, attendance,
invoicing, payments and the finance dashboard are real; fines, expenses, payroll,
materials, notifications, exams, parents, settings and the content CMS are not.

Rough remaining effort: **16–18 weeks solo**, 10–12 with a second developer on the
frontend from Phase 2 onward. The TZ's own §29 estimate of 23 weeks total is
consistent with this — Phases 0–3 and 6 of that plan are largely done.

---

## Why this order differs from TZ §29

| §29 says | This says | Why |
|---|---|---|
| Lead kanban in Phase 6, with the public site | **Phase 4**, standalone | The `Lead` model and public form already exist; only the write side is missing. An application that arrives and cannot be worked is the one gap costing the centre money today. The *content CMS* half of §29's Phase 6 genuinely does belong late — it is Phase 8 here. |
| Audit log in Phase 8 | **Phase 1** | The writer is already built and called everywhere. Acceptance criterion §30.2 needs only a viewer: one endpoint, one screen, about a day. |
| Settings last, inside Module 16 | **Phase 1** | Three later phases read ceilings and templates from it. |
| Courses and rooms done in "Phase 1 Core" | **Phase 1 residue** | `Course` is read-only over HTTP; `Room` has no routes at all. The schedule grid (Phase 2) and the CMS (Phase 8) both block on this. |
| Excel migration in Phase 9 only | **Skeleton from Phase 2**, promoted in Phase 12 | §31 Q1 (the `к`/`б` marks) and Q2 (`Chek` units) get answered by attempting the import, and both answers shape `PAYMENT_METHODS` and the money scale. |
| Content protection in Phase 7 | **Phase 10, gated** | Highest cost, lowest certainty, and formally gated on the client signing the §18.3 acknowledgement. Nothing else depends on it. |

---

## Phase 0 — Ground clearing ✅ *partially done*

**Done** (commit `4b28675`):

- Admin role removed; Manager elevated on group pricing, leads and payment
  approval. `grantFor` hardened so an unknown role is powerless rather than
  omnipotent. Migration script, ADR 0004.
- Seed files merged into one entry point.
- Three latent bugs: the test-import course path, the payment double-approve, the
  never-resolving `useQuery` spinner.

**Still outstanding in this phase:**

- **0.5 Shared form kit.** Promote the unexported `Field` / `INPUT` / `Toggle` /
  `Action` / `Divider` / `DialogError` and the dialog shell out of
  `apps/web/src/components/panel/user-dialog.tsx` into `form-kit.tsx`, and add
  what the next ten forms need: `Select`, `MoneyInput` (integer so'm, separators
  as you type — §26.4), `DateField`, `LocalizedTabs` (uz required, ru/en falling
  back — §21.2), `ConfirmDialog`. Add `table-kit.tsx` for `FilterChip`,
  `Pagination` and `SearchBox`, which are currently duplicated between
  `students-table.tsx` and `users-table.tsx`. Refactor the three existing tables
  onto both in the same change, or this adds a third copy instead of removing two.
  **Do this before Phase 2** — every later screen is cheaper afterwards.
- **0.6 Panel route guards.** `middleware.ts` is next-intl only, so any signed-in
  role can open any CRM URL and hit an uninterpretable wall. Add a
  `<RequirePermission>` client wrapper using the same `can()` map the nav uses.
- **0.7 Apply `requireSingleBranch`.** It is fully implemented in
  `middleware/auth.ts` and mounted on *zero* routes — a SuperAdmin sitting in the
  consolidated `ALL` scope can currently POST a student, group or payment into no
  branch at all. Add a `writeGuards(action)` composer and use it on every write
  route, so later phases cannot forget it by omission.
- **0.9 Test net.** `payments`, `groups`, `students` and `leads` have no tests —
  that is the entire attendance, invoicing and payment-acceptance surface, and
  Phases 6 and 7 both rewrite parts of it. Extract the copy-pasted `makeActor` /
  `makeBranch` / `nextPhone` helpers into `apps/api/src/test/actors.ts` first.

---

## Phase 1 — Settings, catalogue, audit viewer (~1 week)

Closes acceptance criterion §30.2.

Typed `SETTING_KEYS` registry in shared; `settings` collection for global,
non-branch config (SMS credentials, notification templates per locale, holiday
calendar, feature toggles) with a `resolveSetting(key, branchId)` cascade
Branch.settings → global → `DEFAULT_LIMITS`. **Do not migrate the branch numeric
ceilings into it** — they already have typed homes on `branch.model.ts`, and
`fineRules` / `expenseCategories` / `salarySchemes` are structured collections,
not key/value rows.

Extract `Course` and `Room` out of `group.model.ts` into their own modules with
full CRUD. `createCourseSchema` / `updateCourseSchema` already exist unused in
`schemas/academic.ts` — reuse them.

Audit viewer: `/audit`, superadmin-only (note 9 died with the Admin role), filtered
by actor/entity/action/period. The indexes already exist.

Screens: `boss/settings` (tabs: branches, courses, rooms, ceilings, templates) and
`boss/audit`.

## Phase 2 — Academic operations completion (~1.5 weeks)

Groups and students become manageable instead of read-only. Group archive
(§9.2 keeps all history), student transfer (§23), xlsx export, `unfreeze`, and
`dropReason` enforced on the `dropped` transition (`DROP_REASONS` exists, unused).
Week schedule grid with drag-to-reschedule, reusing `findScheduleConflicts` from
`group.service.ts` for the pre-save check. Holiday calendar consumed by
`generateLessons`, so holiday lessons are not billed.

Depends on Phase 1 — a group form cannot pick a course or room that has no CRUD.

## Phase 3 — Notifications, parents, job runner, receipts (~1.5 weeks)

Closes §30.4.

`notify({ event, recipients, data, channels })` is the one function every later
phase calls: in-app always on, SMS and Telegram behind a `Channel` interface that
no-ops until §31 Q5 credentials arrive. Job runner (bullmq + Redis) with a
`jobRuns` collection; the first jobs wrap logic that already exists as manual
endpoints — invoice generation and overdue recalculation — plus reminders at
T−3/T/T+3/T+7. Receipts via pdfkit, reused later by certificates and report
exports. Parent linking with a one-time code.

## Phase 4 — Leads and the conversion funnel (~1 week)

Closes §30.12. Manager owns the pipeline: `PATCH /leads/:id`, `POST /leads/:id/convert`
(reusing the student create service and `enrollStudent` rather than duplicating),
trial lessons, funnel report. Kanban with `@dnd-kit`. The `lead.manage` action is
already in the permission map.

Deferred and flagged: Turnstile and SMS OTP on the public form — both need client
accounts, and `public.routes.ts` already carries the TODO.

## Phase 5 — Expenses / harajat (~1 week)

Closes §30.6. §13 in full: quick-add under 10 seconds (floating button, four
fields, icon tiles not a dropdown, camera capture, 10-second Undo toast),
categories seeded from §13.2, budgets, recurring drafts as a daily job,
approval above `expenseApprovalCeiling`, xlsx export shaped like the `Молия` sheet.
Manager's note 5 becomes a `pettyCash` flag on the category plus a ceiling.

## Phase 6 — Fines / jarima (~1 week)

Closes §30.5. Students and employees both. The invoice item type `'fine'` already
exists, so a student fine attaches as a line with no schema change; employee fines
accrue for payroll. Rules are off by default and run on the Phase 3 job runner.
`/fine-rules` is already in `SUPERADMIN_ONLY_ROUTE_PREFIXES`.

## Phase 7 — Payroll, salary schemes, finance completion (~1.5 weeks)

Closes §30.7. Percentage schemes compute on money **actually collected** — extract
`collectedIn()` from `finance.routes.ts` into a shared service so payroll and the
dashboard cannot drift. Approved payroll writes an `Expense` in the `Oylik`
category, which is what makes the three `Молия` streams reconcile without double
entry. Finance gains `/expenses`, `/profit`, `/cashflow`, `/pnl?year=`, `/export`.

## Phase 8 — Public site content from the database (~1 week)

`teachers` (profile) and `posts` collections; `Course` extended with the public
fields the site already renders, shaped to match `content/courses.ts` exactly so
the repoint is mechanical. `GET /public/courses|teachers|posts|results`. A migration
imports the existing `content/*.ts` fixtures, then those files go. Editors under
`boss/content` on `LocalizedTabs`. Watch §30.13 — Lighthouse must survive the fetches.

## Phase 9 — Exams, ranking, certificates, cabinet (~1.5 weeks)

§16 offline themed exams (distinct from the existing online `TestModule`), bulk
entry grid with paste-from-Excel, certificates with a QR verification page, parent
cabinet with a children switcher. Students and parents stay read-only throughout —
§10.2 and §16 are explicit about that.

## Phase 10 — Materials and content protection (~2.5 weeks, GATED)

**Do not start** without the client's signed §18.3 acknowledgement and a two-day
infra spike on MinIO + ffmpeg HLS/AES + pdfium. Signed 60-second URLs bound to user
and IP, per-user burned-in watermarks, segment-fetch anomaly detection. Verified
against §30.9 and §30.10 exactly as written.

## Phase 11 — Reports, exports, quality pass (~1.5 weeks)

One report component contract (§20) across academic, sales, operations and finance.
Offline attendance queue (§27). Virtualise lists past 100 rows. i18n lint rule
failing the build on hard-coded UI text. Swagger. Accessibility sweep against §25.6.
Command palette and the ⌘B branch switcher — the endpoint and the accent colour
already exist, only the UI is missing.

## Phase 12 — Migration, backups, handover (~1.5 weeks)

Promote the importer, reconcile against the workbook totals with the client, daily
backup with a *tested* restore onto a clean environment (§30.14), Uzbek-language
video guides, final walk of all fifteen §30 criteria.

---

## Conventions every phase follows

- Permissions only in `packages/shared/src/permissions.ts`, enforced by the
  middleware in `apps/api/src/middleware/auth.ts` through the `writeGuards()`
  composer.
- Every operational model calls `schema.plugin(branchScopePlugin)`. `users`,
  `courses`, `posts`, `auditLogs` and global `settings` deliberately do not.
- Every mutation calls `recordAudit()`, using `diff()` for PATCH bodies.
- Money is an integer number of so'm end to end; render only through `<Money>`.
- Zod schemas in `packages/shared/src/schemas/`, shared by both apps; list
  endpoints extend `paginationSchema` and sort through `parseSort`.
- All three of `messages/{uz,ru,en}.json` land in the same change — never one
  locale ahead of another.
- Each phase extends `apps/api/scripts/crm-smoke.mjs` with its role walk and adds
  a `*.routes.test.ts`.
- Any deviation from the TZ gets an ADR in `docs/adr/`.
