# ADR 0002 — Two-factor authentication is opt-in, including for SuperAdmin

**Status:** accepted · **Date:** 2026-08-21

## Context

TZ §8 states: *"2FA (TOTP) **mandatory for SuperAdmin**, optional for Admin."*

As built, that meant a freshly seeded SuperAdmin could not sign in at all until
it had enrolled a second factor. Enrolling needs a session and a session needed
enrolment, so the API carried a pair of `POST /auth/2fa/bootstrap` routes to
break the deadlock by re-checking the password and issuing a secret without a
token.

The client asked for sign-in to be phone + password only, and for the extra step
to be removed.

## Decision

TOTP is now **opt-in for every role**, SuperAdmin included.

- `login()` no longer rejects a SuperAdmin that has not enrolled.
- The `POST /auth/2fa/bootstrap` and `/2fa/bootstrap/verify` routes are deleted;
  they existed only to work around the mandate.
- `ERROR_CODES.TOTP_SETUP_REQUIRED` is removed — nothing can raise it.
- Enrolment still works for anyone from a signed-in session:
  `POST /auth/2fa/enable` → `POST /auth/2fa/verify`. An account with 2FA on is
  still challenged at login (`TOTP_REQUIRED`), and a wrong code still counts
  toward the progressive lockout.

Everything else in §8 is untouched: argon2id hashing, the 15-minute access
token, the 30-day rotating refresh cookie with reuse detection, session listing
and remote termination, and the progressive phone+IP lockout.

## Consequences

**This weakens the account with the widest blast radius.** SuperAdmin is global
across branches and is the only role that can read revenue, profit, payroll and
cross-branch comparisons (§15). With 2FA off, a single leaked or guessed
password is sufficient to reach all of it, and §21.3 audit entries then record
the compromise rather than prevent it.

Mitigations that remain in force: the common-password blocklist, the progressive
lockout, `mustChangePassword` on the seeded account, and the audit log on every
authentication event and every `403` on a finance route.

**Recommendation before go-live:** enable TOTP on the SuperAdmin account through
the panel. Restoring the mandate is a single guard in `auth.service.ts:login()`
plus re-adding the error code; the enrolment flow it depends on is still here and
still tested.
