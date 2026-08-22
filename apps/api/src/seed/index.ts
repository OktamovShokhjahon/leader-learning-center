/**
 * Seed runner — `npm run seed` from the repo root.
 *
 * Every seeder is idempotent: running this twice creates nothing the second
 * time. That is what makes it safe to run on staging after each deploy, and it
 * is the same property TZ §26.3 requires of the scheduled jobs.
 *
 * It is deliberately a separate entry point from `server.ts`. Seeding is an
 * operator action with a visible report and an exit code, not a side effect of
 * starting the API.
 */
import { connectDatabase, disconnectDatabase } from '../config/db.js'
import { logger } from '../config/logger.js'
import { env } from '../config/env.js'
import { seedBranches } from './seed-branches.js'
import { seedSuperadmin } from './seed-superadmin.js'
import { seedDemo } from './seed-demo.js'

type SeedResult = { name: string; created: number; note?: string }

async function run(): Promise<SeedResult[]> {
  const results: SeedResult[] = []

  const branches = await seedBranches()
  results.push({
    name: 'branches',
    created: branches,
    note: branches === 0 ? 'already present' : undefined,
  })

  const superadmin = await seedSuperadmin()
  results.push({
    name: 'superadmin',
    created: superadmin ? 1 : 0,
    note: superadmin
      ? 'must enrol 2FA before it can sign in (§8)'
      : env.SEED_SUPERADMIN_PHONE
        ? 'already present'
        : 'skipped — set SEED_SUPERADMIN_PHONE and SEED_SUPERADMIN_PASSWORD',
  })

  // Development and staging only — never fabricates data in production.
  if (!env.isProduction) {
    const demo = await seedDemo()
    results.push({ name: 'demo data', created: demo.created ? 1 : 0, note: demo.note })
  }

  return results
}

async function main() {
  await connectDatabase()

  try {
    const results = await run()

    const width = Math.max(...results.map((result) => result.name.length))
    const lines = results.map((result) => {
      const name = result.name.padEnd(width)
      const count = String(result.created).padStart(3)
      return `  ${name}  ${count} created${result.note ? `  — ${result.note}` : ''}`
    })

    const total = results.reduce((sum, result) => sum + result.created, 0)
    process.stdout.write(`\nSeed complete — ${total} document(s) created\n${lines.join('\n')}\n\n`)
  } finally {
    await disconnectDatabase()
  }
}

main().catch((error) => {
  logger.fatal({ err: error }, 'seed failed')
  process.exitCode = 1
  void disconnectDatabase()
})
