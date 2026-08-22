import mongoose from 'mongoose'
import { env } from './env.js'
import { logger } from './logger.js'

/**
 * TZ §26.4 / §28 — MongoDB runs as a replica set even on a single node, because
 * payment + invoice writes must run inside a transaction.
 */

mongoose.set('strictQuery', true)
// Fail fast instead of buffering for 10s when the connection is down: a clear
// error beats a hung request, and beats a hung page for the visitor.
mongoose.set('bufferCommands', false)

/** Human-readable connection state for the health endpoint. */
export function connectionState(): string {
  const states: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  }
  return states[mongoose.connection.readyState] ?? 'unknown'
}

let memoryServer: { stop: () => Promise<boolean> } | null = null

export async function connectDatabase(): Promise<string> {
  let uri = env.MONGO_URL

  if (!uri && env.USE_MEMORY_DB) {
    // Dev/test only — an in-memory single-node replica set so transactions work
    // without Docker on a developer machine. Guarded against production in env.ts.
    const { MongoMemoryReplSet } = await import('mongodb-memory-server')
    const replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    })
    memoryServer = replSet
    uri = replSet.getUri()
    logger.warn('Using in-memory MongoDB replica set — data is discarded on shutdown')
  }

  if (!uri) {
    throw new Error(
      'No database configured. Set MONGO_URL to a replica-set connection string, ' +
        'or USE_MEMORY_DB=true for local development without Docker.',
    )
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 })
  logger.info('MongoDB connected')
  return uri
}

/**
 * TZ §26.4 — payment and invoice writes run inside a transaction, which needs a
 * replica set (even a single-node one). A standalone mongod accepts every other
 * write and then fails only at the first payment, with a driver error nobody
 * can act on. This resolves it once, at boot, so the problem is visible before
 * a cashier hits it.
 */
let transactional: boolean | null = null

export async function supportsTransactions(): Promise<boolean> {
  if (transactional !== null) return transactional
  try {
    const info = await mongoose.connection.db?.admin().command({ hello: 1 })
    // A replica set member reports a set name; mongos reports it is a router.
    transactional = Boolean(info?.setName || info?.msg === 'isdbgrid')
  } catch {
    transactional = false
  }
  return transactional
}

export async function assertTransactionSupport(): Promise<void> {
  if (await supportsTransactions()) return
  logger.error(
    [
      'MongoDB is running STANDALONE, so payments are disabled: money writes need a',
      'transaction (TZ §26.4) and a transaction needs a replica set.',
      '  Fix with Docker:  docker compose -f infra/docker-compose.yml up -d',
      '  Or convert this server:  mongod --replSet rs0   then in mongosh: rs.initiate()',
      '  To click through the CRM locally only: ALLOW_NON_TRANSACTIONAL_PAYMENTS=true',
    ].join('\n'),
  )
}

export async function disconnectDatabase() {
  await mongoose.disconnect()
  if (memoryServer) {
    await memoryServer.stop()
    memoryServer = null
  }
}
