# ADR 0004 — The Admin role is removed; SuperAdmin absorbs it and Manager takes the front desk

**Status:** accepted · **Date:** 2026-08-23

Supersedes the parts of [ADR 0003](0003-manager-opens-teacher-and-student-accounts.md) that reason about Admin/Manager rank. Note 11 itself survives.

## Context

TZ §4.1 defines six roles, of which **Admin (branch director)** sat between SuperAdmin
and Manager. The centre asked for it to go: *"dont need admin role, superadmin
enough, and manager need as well, dont remove it, improve it"*.

That is one decision with two halves. Removing a role is easy; deciding where its
twenty-odd permissions land is the actual work, and doing it carelessly either
concentrates everything on the boss (so nobody can run a branch day to day) or
pushes it all down to the front desk (so §15's whole point — that only the owner
sees the money — quietly dies).

## Decision

**`admin` is gone from `ROLES`.** Five roles remain: superadmin, manager, teacher,
student, parent.

Admin's grants were split on one rule: *operational acts move to Manager, acts
that rewrite history or reveal money stay with SuperAdmin.*

**Moved to Manager** (the three the centre named):

| Grant | Was | Now |
|---|---|---|
| `group.manage` | Manager 🟡 — "may create a group but cannot set its price" (note 1) | Manager ✅, price included. Note 1 is deleted, along with the `canPrice` guards in `group.routes.ts`. |
| `payment.approve` | Admin ✅, Manager ❌ | Manager ✅. With the Admin gone this would otherwise land on the boss alone, and approving is a front-desk act on one payment. |
| `lead.manage` (new action) | leads rode on `student.manage` | Manager ✅. §4.1 calls a Manager "reception / call-centre, works with leads and payments", so the funnel is theirs. Tying "may reassign a lead" to "may edit a student record" would have bitten as soon as the lead pipeline gets a write side. |

**Kept by SuperAdmin alone:** `payment.refund`, `student.setFee`, `discount.give`,
`fine.issue`, `fine.cancel`, `expense.approve`, `expense.viewBranchTotal`,
`student.transfer`, `attendance.editAfter48h`, `site.edit`, `audit.view`.

`attendance.editAfter48h` is the one worth naming: the centre was offered it for
Manager and declined. A late edit rewrites an attendance record that payroll and
invoicing have already been computed from, so it stays with the owner.

**Six §4.2 notes died with the role** — 1, 3, 4, 6, 8 and 9 each described a limit
on a grant nobody holds any more, and a limited grant with no holder is just
dead text. Notes 2, 5, 7, 10 and 11 survive with their holders.

`staff.createAdminOrManager` is renamed `staff.createManager` — an action naming a
role that no longer exists is a trap for the next reader.

## Failing safe on unmigrated data

Shrinking the enum is the *second* step, never the first, because of this:

```ts
export function grantFor(role, action) {
  return PERMISSIONS[action][role]      // undefined for an unknown role
}
export function can(role, action) {
  return grantFor(role, action) !== 'none'   // undefined !== 'none'  →  TRUE
}
```

A User document still holding `{role:'admin'}` is an *unknown* role once the map
drops the column — and `can()` would have answered **true for every action**.
Deleting the role without hardening this first would not have locked those
accounts out; it would have silently promoted each of them past every
`requirePermission` check in the API.

So `grantFor` now ends `?? 'none'`, `GRANTABLE_ROLES` is a proxy defaulting to
`[]`, and `HOME_PANEL[role]` is `|| '/'` at its one call site. An unrecognised
role is powerless, which is the only safe direction to fail. There is a test for
exactly this — *"gives an account still holding the retired admin role no powers
at all"* — which writes the retired role straight past the enum with a raw
collection update and asserts the account can reach nothing.

Relatedly, `auditLogs.role` is no longer pinned to the `ROLES` enum. §21.3 retains
those rows for three years, so entries written by a role that has since been
retired must stay writable and readable.

## Migrating existing accounts

`apps/api/scripts/migrate-admin-role.mjs`, driver-level rather than through the
Mongoose models — the models would refuse to load the very documents it exists to
fix. Default is a dry run; nothing is written without `--to`.

```bash
node apps/api/scripts/migrate-admin-role.mjs --dry-run
node apps/api/scripts/migrate-admin-role.mjs --to=manager
```

**`--to=manager` is the right default, not `--to=superadmin`.** The centre's
decision is that SuperAdmin absorbs Admin's powers *in the permission matrix* —
that is a statement about the matrix, not about the people. Auto-promoting a
branch director to SuperAdmin would hand them §15 revenue, profit, payroll and
every other branch's data, which is precisely what §4.2 and §15 exist to prevent.
Promote a named individual with `--only=<phone> --to=superadmin`, deliberately.

The migration keeps the branch on a Manager assignment, dedupes if the account
already holds Manager in that branch, and revokes the affected sessions — §8
treats a role change as a sign-out-everywhere event.

**Run the migration before deploying the enum change**, and note that the reverse
is only possible while `ROLES` still contains `'admin'`: to roll back, revert the
shared package first, then restore the roles.

## Consequences

**The boss now has more day-to-day work.** Refunds, discounts, fee changes,
student transfers, fines and expense approval all route to one person. For a
centre with several branches that is a real load, and the honest mitigation is
that most of these are low-frequency. If it turns out not to be, the fix is a new
role — not a resurrected Admin.

**A Manager can now price a group.** That is genuine authority over revenue: an
under-priced group is lost income that no approval step catches. It is audited
like every other mutation, and the boss sees it in the audit log.

**Two acceptance criteria change wording.** §30.2 says "an Admin account receives
403 on every finance endpoint"; the Manager is now the account that criterion is
really about — the one that handles money daily and still must not see the
centre's finances. The finance test asserts exactly that. §30.3's "Admin opens
Qarzdorlar" is likewise the Manager.

**The demo seed no longer creates an Admin.** Demo staff are one Manager and two
Teachers; the boss comes from `SEED_SUPERADMIN_*`.
