import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { ROLES } from '@leader/shared/permissions'
import { LOCALES } from '@leader/shared/locales'

/**
 * TZ §22 — `users`.
 *
 * Users are **not** branch-scoped: a single account may hold one role per branch
 * (§4.1), so scoping the collection itself would make a two-branch employee
 * invisible from one of their own branches. Access to a user record is decided
 * by the permission map, not by the query plugin.
 */
const roleAssignmentSchema = new Schema(
  {
    role: { type: String, enum: ROLES, required: true },
    /** Absent for `superadmin`, which is global (§4.1). */
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  },
  { _id: false },
)

const userSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    /** Login identifier. Normalised to +998XXXXXXXXX by the shared phone schema. */
    phone: { type: String, required: true, unique: true, index: true },
    email: { type: String, lowercase: true, trim: true },
    /** argon2id (§8). Never selected by default — see the `select: false` below. */
    passwordHash: { type: String, required: true, select: false },
    /** Set when an administrator issued the password, cleared on first change. */
    mustChangePassword: { type: Boolean, default: false },
    passwordChangedAt: Date,
    photo: String,
    locale: { type: String, enum: LOCALES, default: 'uz' },

    roles: {
      type: [roleAssignmentSchema],
      required: true,
      validate: {
        validator: (roles: unknown[]) => roles.length > 0,
        message: 'A user must hold at least one role',
      },
    },

    /** §8 — TOTP: mandatory for SuperAdmin, optional for Admin. */
    twoFactor: {
      enabled: { type: Boolean, default: false },
      /** AES-256-GCM ciphertext, never returned to any client. */
      secret: { type: String, select: false },
      confirmedAt: Date,
      /** argon2 hashes of single-use recovery codes. */
      recoveryCodes: { type: [String], select: false, default: undefined },
    },

    /** §8 / PIC 10 — optional "Kirish kodi" for the student cabinet. */
    pinCodeHash: { type: String, select: false },

    lastLoginAt: Date,
    lastLoginIp: String,
    isActive: { type: Boolean, default: true },
    /** Set when a user is deactivated, so the reason survives in the audit trail. */
    deactivatedReason: String,

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
  },
  { timestamps: true },
)

// Finding "everyone who works at this branch" is the staff list's only query.
userSchema.index({ 'roles.branchId': 1, 'roles.role': 1 })
userSchema.index({ fullName: 'text', phone: 'text' })

/**
 * `select: false` keeps secrets out of *queries*, but not out of a document the
 * process just built: `User.create(...)` has the hash in memory, so returning
 * that document from a controller would serialise it straight to the client.
 *
 * Stripping the fields in `toJSON` closes it once, for every present and future
 * endpoint, instead of relying on each controller to remember. A service that
 * genuinely needs the hash reads `user.passwordHash` directly, which still works.
 */
userSchema.set('toJSON', {
  transform: (_document, plain: Record<string, unknown>) => {
    delete plain.passwordHash
    delete plain.pinCodeHash
    const twoFactor = plain.twoFactor as Record<string, unknown> | undefined
    if (twoFactor) {
      delete twoFactor.secret
      delete twoFactor.recoveryCodes
    }
    return plain
  },
})

export type UserDocument = HydratedDocument<InferSchemaType<typeof userSchema>>
export const User = model('User', userSchema)

/**
 * The role a user acts with inside a given branch.
 *
 * SuperAdmin outranks everything and is global, so it wins regardless of the
 * requested branch — including the consolidated `'ALL'` scope, which only they
 * can select (§5.1).
 */
export function roleInBranch(user: UserDocument, branchId: string | 'ALL' | null | undefined) {
  const superadmin = user.roles.find((assignment) => assignment.role === 'superadmin')
  if (superadmin) return 'superadmin' as const
  if (!branchId || branchId === 'ALL') return null
  const match = user.roles.find((assignment) => assignment.branchId?.toString() === branchId)
  return match?.role ?? null
}

/** Branch ids this user may act in; empty for a SuperAdmin, who may act in all. */
export function branchIdsOf(user: UserDocument): string[] {
  return user.roles
    .map((assignment) => assignment.branchId?.toString())
    .filter((id): id is string => Boolean(id))
}

export function isSuperadmin(user: UserDocument): boolean {
  return user.roles.some((assignment) => assignment.role === 'superadmin')
}
