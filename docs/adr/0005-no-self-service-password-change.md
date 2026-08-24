# ADR 0005 — Passwords are issued by an administrator; there is no self-service change

**Status:** accepted · **Date:** 2026-08-23

## Context

TZ §8 assumed the usual arrangement: an administrator issues a password with
`mustChangePassword` set, and the holder replaces it at first login through
`POST /auth/password`. That endpoint revoked every *other* session, so a user who
suspected their password was known could lock everyone else out themselves.

The centre asked for the ability to change your own password to be removed from
the whole site.

## Decision

**Self-service password change is gone.** A password is issued and rotated only
by a SuperAdmin or a Manager, from `/crm/staff` → Manage → "Set this password".

- `POST /auth/password` is deleted, and `changePassword()` with it.
- `changePasswordSchema` is removed from `@leader/shared`.
- `ChangePassword` is deleted; `/account` now states the policy instead.
- `mustChangePassword` stops being set. The flag meant "replace this yourself at
  next login", and there is no longer a way to. The column stays on the model —
  dropping a field from a live collection is a migration, not a tidy-up — and
  `POST /users/:id/password` still writes it, but nothing reads it into a prompt.

The administrator reset keeps everything it had: the new password is argon2id
hashed, `passwordChangedAt` is stamped, and **every** session is revoked, so
issuing a new password still signs the holder out everywhere.

## Consequences

**This is the significant one: a compromised password can only be rotated by
somebody else.** Between noticing and reaching an administrator, the holder has
no way to close the window themselves. That was the one thing self-service
change was good at, and it is the thing being given up.

What still limits the damage: the argon2id hash, the common-password blocklist
on the issued password, the progressive phone+IP lockout, "Faol qurilmalar" —
where a user can still see every live session and end any device they do not
recognise — and an audit entry on every authentication event.

**Operationally, whoever issues passwords now owns them.** There is no recovery
path that does not go through a person, so the centre should expect password
resets to become a routine front-desk task and should keep the SuperAdmin
account's own password somewhere it cannot be lost — nobody can reset the last
SuperAdmin but another SuperAdmin.

**Recommendation:** enable TOTP (§8, ADR 0002) on the SuperAdmin account. With
self-service change gone, the second factor is the only control the account
holder can still operate alone.

Restoring the flow is small: the route, the service function, the schema and the
component were removed together and are recoverable from this commit's parent.
