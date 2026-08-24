import { defineConfig } from 'vitest/config'
import { cpus } from 'node:os'

/**
 * Every integration suite starts its own single-node MongoDB replica set (see
 * `src/test/db.ts`), so the number of test *files* running at once is the number
 * of `mongod` processes running at once.
 *
 * Unbounded, that is how the suite starts failing with
 * `MongoClientClosedError: Operation interrupted because client was closed` on a
 * machine under load — not because anything is wrong with the code, which is the
 * worst kind of test failure to hand someone. Capping the pool trades a little
 * wall-clock for a result that means what it says.
 */
const MAX_PARALLEL_MONGO = Math.max(2, Math.min(4, cpus().length - 1))

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Spinning up a replica set is slow on a cold cache; the default 5s hook
    // timeout trips long before `mongod` is listening.
    hookTimeout: 120_000,
    testTimeout: 30_000,
    // Pool-agnostic, and set as a pair: naming only the max leaves the default
    // min above it, which Tinypool rejects outright.
    minWorkers: 1,
    maxWorkers: MAX_PARALLEL_MONGO,
    // TZ §27 — ≥70% coverage on services/ is the gate; wired up as modules land.
    coverage: { provider: 'v8', include: ['src/**/*.service.ts'] },
  },
})
