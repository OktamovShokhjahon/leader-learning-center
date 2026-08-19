import { createApp } from './app.js'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { connectDatabase, disconnectDatabase } from './config/db.js'
import { seedBranches } from './seed/seed-branches.js'

async function main() {
  let dbReady = false

  try {
    await connectDatabase()
    dbReady = true
    // A lead cannot exist without a branch (§5.1), so make sure one exists.
    if (!env.isProduction) await seedBranches()
  } catch (error) {
    // In production a database is not optional — fail loudly and stay down.
    if (env.isProduction) throw error

    // In development, start anyway so the HTTP layer, validation and the
    // website's error paths can be worked on. Endpoints that need Mongo will
    // fail with a clear error rather than the whole API being absent.
    logger.error(
      { err: error },
      'DATABASE UNAVAILABLE — starting without persistence. ' +
        'Endpoints that touch Mongo will fail. Fix by either:\n' +
        '  · docker compose -f infra/docker-compose.yml up -d   (then set MONGO_URL)\n' +
        '  · pointing MONGO_URL at any MongoDB replica set\n' +
        '  · USE_MEMORY_DB=true, which downloads a mongod binary on first run',
    )
  }

  const app = createApp()
  const server = app.listen(env.PORT, () => {
    logger.info(
      { db: dbReady ? 'connected' : 'unavailable' },
      `API listening on http://localhost:${env.PORT}/api/v1`,
    )
  })

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down')
    server.close()
    if (dbReady) await disconnectDatabase()
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((error) => {
  logger.fatal({ err: error }, 'failed to start API')
  process.exit(1)
})
