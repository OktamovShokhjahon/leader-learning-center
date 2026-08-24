/**
 * One-off migration — retire the `admin` role (ADR 0004).
 *
 *   node apps/api/scripts/migrate-admin-role.mjs --dry-run
 *   node apps/api/scripts/migrate-admin-role.mjs --to=manager
 *   node apps/api/scripts/migrate-admin-role.mjs --to=superadmin --only=+998900000101
 *
 * `admin` is gone from the ROLES enum, so any User document still holding it
 * fails validation the next time anything calls `.save()` on it — including an
 * unrelated profile edit. This rewrites those role assignments before that can
 * happen.
 *
 * It talks to the driver directly rather than through the Mongoose models, for
 * exactly that reason: the models would refuse to load the very documents this
 * exists to fix.
 *
 * Default is `--dry-run`. Nothing is written unless `--to` is given.
 */
import { MongoClient } from 'mongodb'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))

/** `apps/api/.env` is not loaded for us here — read MONGO_URL out of it. */
function mongoUrl() {
  if (process.env.MONGO_URL) return process.env.MONGO_URL
  try {
    const env = readFileSync(resolve(HERE, '..', '.env'), 'utf8')
    const line = env.split(/\r?\n/).find((row) => row.startsWith('MONGO_URL='))
    if (line) return line.slice('MONGO_URL='.length).trim()
  } catch {
    /* fall through to the default */
  }
  return 'mongodb://localhost:27017/leader'
}

const args = process.argv.slice(2)
const flag = (name) => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`))
  if (!hit) return undefined
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : true
}

const target = flag('to')
const only = flag('only')
const dryRun = !target || flag('dry-run') === true

if (target && !['manager', 'superadmin'].includes(target)) {
  console.error(`--to must be "manager" or "superadmin", got "${target}"`)
  process.exit(1)
}

const client = new MongoClient(mongoUrl())

try {
  await client.connect()
  const users = client.db().collection('users')

  const filter = { 'roles.role': 'admin', ...(only ? { phone: only } : {}) }
  const affected = await users.find(filter).toArray()

  if (affected.length === 0) {
    console.log('\nNothing to migrate — no account holds the admin role.\n')
    process.exit(0)
  }

  console.log(`\n${affected.length} account(s) hold the admin role:\n`)
  for (const user of affected) {
    const before = user.roles.map((r) => r.role).join(', ')
    // A SuperAdmin is global (§4.1) and carries no branch; a Manager keeps the
    // branch the Admin was responsible for.
    const after = user.roles
      .map((r) => (r.role === 'admin' ? target ?? '?' : r.role))
      .join(', ')
    console.log(`  ${user.phone.padEnd(15)} ${user.fullName}`)
    console.log(`    ${before}  ->  ${after}`)
  }

  if (dryRun) {
    console.log('\nDry run — nothing written. Re-run with --to=manager or --to=superadmin.\n')
    process.exit(0)
  }

  let migrated = 0
  for (const user of affected) {
    const roles = []
    for (const assignment of user.roles) {
      if (assignment.role !== 'admin') {
        roles.push(assignment)
        continue
      }
      // §4.1 — superadmin is global and must carry no branchId at all.
      roles.push(target === 'superadmin' ? { role: 'superadmin' } : { ...assignment, role: 'manager' })
    }

    // Two admin roles in different branches both becoming superadmin would
    // leave the account holding the same global role twice.
    const seen = new Set()
    const deduped = roles.filter((assignment) => {
      const key = `${assignment.role}:${assignment.branchId ?? ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    await users.updateOne({ _id: user._id }, { $set: { roles: deduped, updatedAt: new Date() } })
    migrated += 1
  }

  // Their sessions carry a role that no longer exists — §8 says a role change
  // takes effect immediately, so end them and make everyone sign in again.
  const revoked = await client
    .db()
    .collection('sessions')
    .updateMany(
      { userId: { $in: affected.map((u) => u._id) }, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: 'role_changed' } },
    )

  console.log(
    `\nMigrated ${migrated} account(s) to "${target}". ` +
      `Revoked ${revoked.modifiedCount} session(s) — they must sign in again.\n`,
  )
} finally {
  await client.close()
}
