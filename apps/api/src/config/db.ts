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

export async function disconnectDatabase() {
  await mongoose.disconnect()
  if (memoryServer) {
    await memoryServer.stop()
    memoryServer = null
  }
}
