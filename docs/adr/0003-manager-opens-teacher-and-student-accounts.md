# ADR 0003 — A Manager opens teacher and student accounts; account rank is enforced separately

**Status:** accepted · **Date:** 2026-08-22

## Context

TZ §4.2 gives `staff.createTeacher` to SuperAdmin and Admin, and nothing in the
Staff block to a Manager. The service layer read that literally: a Manager could
grant `student` and `parent` and nothing else, and the route guard on
`/api/v1/users` shut them out of the account list entirely.

The centre asked for two things:

1. the boss account to see and control **every** account, and to open a new one
   with **any** role, a second SuperAdmin included;
2. a Manager to be able to add **teachers and students**, because a Manager is
   the person who actually assembles a group and the people in it.

(1) was already true of the API and only lacked a screen. (2) is a genuine
departure from the §4.2 table.

## Decision

**`staff.createTeacher` is `limited` for a Manager (note 11).** A Manager may
open `teacher`, `student` and `parent` accounts, in their own branch only. They
may never grant `admin`, `manager` or `superadmin` — that stays the boss's call,
unchanged from §4.2.

**Account rank is now a separate check from role granting.** `GRANTABLE_ROLES`
answers "what may this actor hand out"; it says nothing about which *existing*
accounts they may touch. That distinction did not matter while only an Admin and
the boss held the grant, because the route guard was the whole answer. It
matters now: the same guard covers `PATCH /users/:id`, `POST /users/:id/password`
and `DELETE /users/:id`, so without a second check a Manager would have
inherited the ability to reset the password of the Admin sitting in their own
branch — an escalation no grant check would ever see, because no role is being
handed out.

So `packages/shared/src/permissions.ts` now also carries:

- `ROLE_RANK` — superadmin 5, admin 4, manager 3, teacher 2, student/parent 1;
- `mayAdminister(actorRoles, targetRoles)` — strictly below your own rank, and a
  SuperAdmin may act on anyone, another SuperAdmin included.

`user.service.ts` calls it from `updateUser`, `updateRoles`, `resetPassword` and
`deactivateUser`, and it replaces the ad-hoc "only a SuperAdmin can touch a
SuperAdmin" checks those functions each carried separately. Acting on your own
account is exempt (a profile edit is not a takeover); `updateRoles` and
`deactivateUser` keep their own self-checks on top, because nobody edits their
own permissions or locks themselves out.

Both tables live in `@leader/shared` rather than in the API, so the "new account"
form offers exactly the roles the API would accept and the row actions are shown
only where they would succeed. The API still checks on every request — §4.3:
hiding a button is a convenience, never a security control.

The screen is `/crm/staff`, one route for all three roles. What each of them
sees is decided by the API — a SuperAdmin's list is every account in every
branch, an Admin's and a Manager's is their own branch's — so there is no
separate boss-only route to keep in step.

## Consequences

**A Manager is now a staffing role.** They can create an account that teaches
classes and, through it, everything a teacher may do. The blast radius is bounded
by the branch (`assertMayGrant` refuses a branch the Manager holds no role in)
and by rank (they cannot create or touch anyone at their level or above), and
every create, role change, password reset and deactivation is already an audit
entry under §21.3.

**§4.2 note 11 is a documented deviation, not a bug.** Anyone reading the table
against the code will find the Manager column disagrees; `LIMITS['staff.createTeacher']`
and this ADR are where that disagreement is recorded.

**An Admin can no longer administer another Admin.** That is a tightening, and it
follows from the same rank rule. It was already true of *creating* one (§4.2, and
the test that asserts it), so the two halves now agree; before this change an
Admin could not create a peer but could reset that peer's password.

Reverting is a one-line change to `GRANTABLE_ROLES.manager` plus flipping the
Manager cell of `staff.createTeacher` back to `none`. The rank check is worth
keeping either way.
