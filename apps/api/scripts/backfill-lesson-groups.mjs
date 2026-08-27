/**
 * One-off migration — D1's grandfather clause.
 *
 *   node apps/api/scripts/backfill-lesson-groups.mjs --dry-run
 *   node apps/api/scripts/backfill-lesson-groups.mjs --apply
 *
 * `VideoLesson.groupIds` is a new explicit allow-list: empty means "no access
 * until granted." Applied cold to lessons that existed before the field did,
 * that reads as "revoke everyone's access" — nobody asked for that. This seeds
 * `groupIds` once, for every non-free lesson with an empty list, from the
 * groups that currently hold an active enrolment in that lesson's course —
 * i.e. whoever can watch it today keeps watching it after this runs. Any
 * lesson created after this shipped already got a real (possibly empty)
 * `groupIds` at creation time and is left untouched.
 *
 * Default is `--dry-run`. Nothing is written unless `--apply` is given.
 */
import { MongoClient, ObjectId } from 'mongodb'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))

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

const apply = process.argv.includes('--apply')

const client = new MongoClient(mongoUrl())

try {
  await client.connect()
  const db = client.db()
  const lessons = db.collection('videolessons')
  const enrollments = db.collection('enrollments')
  const groups = db.collection('groups')

  const candidates = await lessons
    .find({
      deletedAt: { $in: [null, undefined] },
      isFree: { $ne: true },
      $or: [{ groupIds: { $exists: false } }, { groupIds: { $size: 0 } }],
    })
    .toArray()

  if (candidates.length === 0) {
    console.log('\nNothing to backfill — every lesson already has an access list or is free.\n')
    process.exit(0)
  }

  console.log(`\n${candidates.length} lesson(s) predate the access list:\n`)

  let toWrite = []
  for (const lesson of candidates) {
    const courseGroups = await groups.find({ courseId: lesson.courseId }).project({ _id: 1 }).toArray()
    const courseGroupIds = courseGroups.map((g) => g._id)
    if (courseGroupIds.length === 0) {
      console.log(`  ${lesson.title?.uz ?? lesson._id}  ->  no groups for this course, skipped`)
      continue
    }

    const activeGroupIds = await enrollments.distinct('groupId', {
      groupId: { $in: courseGroupIds },
      status: 'active',
    })

    console.log(
      `  ${(lesson.title?.uz ?? String(lesson._id)).padEnd(40)} -> ${activeGroupIds.length} group(s)`,
    )
    if (activeGroupIds.length > 0) {
      toWrite.push({ _id: lesson._id, groupIds: activeGroupIds })
    }
  }

  if (!apply) {
    console.log('\nDry run — nothing written. Re-run with --apply.\n')
    process.exit(0)
  }

  let written = 0
  for (const row of toWrite) {
    await lessons.updateOne({ _id: new ObjectId(row._id) }, { $set: { groupIds: row.groupIds } })
    written += 1
  }

  console.log(`\nBackfilled ${written} lesson(s).\n`)
} finally {
  await client.close()
}
