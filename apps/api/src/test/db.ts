import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'

/**
 * A real MongoDB for integration tests — a single-node **replica set**, not a
 * standalone `mongod`, because the money modules of Phase 3 run their writes in
 * transactions (§26.4) and a standalone server rejects those. Getting that wrong
 * here would mean the tests pass and production fails.
 *
 * The `mongod` binary is downloaded once and cached under `node_modules/.cache`;
 * the first run in a fresh checkout is slow, every later run is not.
 */
let replSet: MongoMemoryReplSet | null = null

export async function connectTestDatabase(): Promise<void> {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  })
  await mongoose.connect(replSet.getUri(), { serverSelectionTimeoutMS: 30_000 })
  // TTL and unique indexes are load-bearing in the auth module (session expiry,
  // the lockout window, one account per phone), so build them before asserting
  // on behaviour that depends on them.
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()))
}

export async function disconnectTestDatabase(): Promise<void> {
  await mongoose.disconnect()
  await replSet?.stop()
  replSet = null
}

/** Wipes every collection between tests, leaving indexes in place. */
export async function clearTestDatabase(): Promise<void> {
  const collections = await mongoose.connection.db!.collections()
  await Promise.all(collections.map((collection) => collection.deleteMany({})))
}
