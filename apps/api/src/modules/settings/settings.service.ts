import { ApiError } from '@leader/shared/errors'
import {
  SETTING_KEYS,
  SETTING_KEY_LIST,
  settingDefault,
  parseSetting,
  isSecretSetting,
  type SettingKey,
  type SettingValue,
} from '@leader/shared/settings'
import { Setting } from './setting.model.js'
import { Branch } from '../branches/branch.model.js'
import { User, type UserDocument } from '../users/user.model.js'
import { recordAudit, type RequestMeta } from '../audit/audit.service.js'

/**
 * TZ §21.1 — the one place a configurable number is read from.
 *
 * The cascade is **branch override → centre-wide row → registry default**, and
 * it matters that all three exist. A centre with two branches charging different
 * prices still wants one discount ceiling by default and the ability to raise it
 * for one of them; a fresh install with an empty collection must still boot with
 * sane numbers rather than `undefined` reaching a payment calculation.
 *
 * Three later modules — fines, expenses and payroll — read ceilings through
 * here, which is why it exists before any of them.
 */

/** Cached per process: settings change rarely and are read on nearly every request. */
type CacheEntry = { value: unknown; at: number }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 30_000

function cacheKey(key: SettingKey, branchId?: string | null) {
  return `${key}:${branchId ?? ''}`
}

/** Called after every write so a saved change is visible immediately. */
export function invalidateSettingsCache(key?: SettingKey) {
  if (!key) {
    cache.clear()
    return
  }
  for (const existing of cache.keys()) {
    if (existing.startsWith(`${key}:`)) cache.delete(existing)
  }
}

export async function resolveSetting<K extends SettingKey>(
  key: K,
  branchId?: string | null,
): Promise<SettingValue<K>> {
  const cached = cache.get(cacheKey(key, branchId))
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value as SettingValue<K>
  }

  const definition = SETTING_KEYS[key]
  // A global key ignores the branch entirely, so asking for one with a branch
  // selected must not miss the row that actually holds the value.
  const wantsBranch = definition.scope === 'branch' && Boolean(branchId)

  const rows = await Setting.find({
    key,
    branchId: { $in: wantsBranch ? [branchId, null] : [null] },
  }).lean()

  const override = wantsBranch ? rows.find((row) => row.branchId?.toString() === branchId) : null
  const global = rows.find((row) => !row.branchId)

  const raw = override?.value ?? global?.value
  let value: SettingValue<K>
  try {
    value = raw === undefined || raw === null ? settingDefault(key) : parseSetting(key, raw)
  } catch {
    // A stored value that no longer parses — the key's schema was tightened, say
    // — must not take an endpoint down. Fall back and keep serving.
    value = settingDefault(key)
  }

  cache.set(cacheKey(key, branchId), { value, at: Date.now() })
  return value
}

/** Several keys at once, for a screen that needs a whole group. */
export async function resolveSettings<K extends SettingKey>(
  keys: readonly K[],
  branchId?: string | null,
): Promise<Record<K, SettingValue<K>>> {
  const entries = await Promise.all(
    keys.map(async (key) => [key, await resolveSetting(key, branchId)] as const),
  )
  return Object.fromEntries(entries) as Record<K, SettingValue<K>>
}

export type SettingRow = {
  key: SettingKey
  value: unknown
  effective: unknown
  scope: (typeof SETTING_KEYS)[SettingKey]['scope']
  control: (typeof SETTING_KEYS)[SettingKey]['control']
  group: (typeof SETTING_KEYS)[SettingKey]['group']
  isDefault: boolean
  isOverride: boolean
}

/**
 * Every key with its effective value, for the settings screen.
 *
 * A secret never leaves the server: the row reports whether one is set, and the
 * editor shows a "replace" field rather than the current value.
 */
export async function listSettings(branchId?: string | null): Promise<SettingRow[]> {
  const rows = await Setting.find({ branchId: { $in: [branchId ?? null, null] } }).lean()

  return Promise.all(
    SETTING_KEY_LIST.map(async (key) => {
      const definition = SETTING_KEYS[key]
      const wantsBranch = definition.scope === 'branch' && Boolean(branchId)
      const override = wantsBranch
        ? rows.find((row) => row.key === key && row.branchId?.toString() === branchId)
        : undefined
      const global = rows.find((row) => row.key === key && !row.branchId)
      const stored = override ?? global

      const effective = await resolveSetting(key, branchId)
      const secret = isSecretSetting(key)

      return {
        key,
        value: secret ? (stored?.value ? '••••••••' : '') : (stored?.value ?? null),
        effective: secret ? (effective ? '••••••••' : '') : effective,
        scope: definition.scope,
        control: definition.control,
        group: definition.group,
        isDefault: stored === undefined,
        isOverride: Boolean(override),
      }
    }),
  )
}

export async function setSetting(
  actor: UserDocument,
  key: SettingKey,
  value: unknown,
  branchId: string | undefined,
  req: RequestMeta,
) {
  const definition = SETTING_KEYS[key]

  if (branchId && definition.scope === 'global') {
    throw ApiError.badRequest(`"${key}" is a centre-wide setting and takes no branch`)
  }
  if (branchId && !(await Branch.exists({ _id: branchId, deletedAt: null }))) {
    throw ApiError.badRequest('Unknown branch')
  }

  let parsed: unknown
  try {
    parsed = parseSetting(key, value)
  } catch {
    throw ApiError.badRequest(`That value is not valid for "${key}"`)
  }

  const filter = { key, branchId: branchId ?? null }
  const before = await Setting.findOne(filter).lean()

  await Setting.findOneAndUpdate(
    filter,
    { $set: { value: parsed, updatedBy: actor._id } },
    { upsert: true, new: true },
  )
  invalidateSettingsCache(key)

  await recordAudit({
    action: 'setting.update',
    actorId: actor._id,
    actorName: actor.fullName,
    entity: 'Setting',
    entityId: key,
    branchId: branchId ?? undefined,
    // A secret's value is never written to the audit log either (§8).
    before: isSecretSetting(key) ? { set: Boolean(before?.value) } : { value: before?.value },
    after: isSecretSetting(key) ? { set: true } : { value: parsed },
    req,
  })

  return resolveSetting(key, branchId)
}

/** Removing an override falls the key back to the centre-wide value. */
export async function clearSetting(
  actor: UserDocument,
  key: SettingKey,
  branchId: string | undefined,
  req: RequestMeta,
) {
  await Setting.deleteOne({ key, branchId: branchId ?? null })
  invalidateSettingsCache(key)

  await recordAudit({
    action: 'setting.clear',
    actorId: actor._id,
    actorName: actor.fullName,
    entity: 'Setting',
    entityId: key,
    branchId: branchId ?? undefined,
    req,
  })

  return resolveSetting(key, branchId)
}

/**
 * Bootstrap — writes nothing, but confirms the registry and the collection
 * agree. Called by the seed so a fresh database reports its configuration
 * rather than staying silently empty.
 */
export async function settingsHealth() {
  const stored = await Setting.countDocuments({})
  const orphans = await Setting.distinct('key', {
    key: { $nin: SETTING_KEY_LIST as unknown as string[] },
  })
  return { registered: SETTING_KEY_LIST.length, stored, orphans }
}

export { SETTING_KEY_LIST, User }
