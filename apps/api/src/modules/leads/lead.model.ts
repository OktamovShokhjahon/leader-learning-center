import { Schema, model, type InferSchemaType } from 'mongoose'
import { LEAD_STATUSES, LEAD_SOURCES, SCHEDULE_PATTERNS, TIME_SLOTS } from '@leader/shared/schemas'
import { LOCALES } from '@leader/shared/locales'
import { branchScopePlugin } from '../../middleware/branch-scope.js'

/**
 * TZ §22 — `leads` collection.
 *
 * Note `branchId` is required and indexed (§5.1); the branch-scope plugin fills
 * it from the request context and filters every read by it.
 */
const historyEntrySchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    note: String,
  },
  { _id: false },
)

const leadSchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, index: true },
    age: Number,
    schoolClass: String,
    courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
    /** Kept alongside courseId so a lead survives a course being renamed or removed. */
    courseSlug: { type: String, required: true },
    branchSlug: { type: String, required: true },
    preferredDays: { type: String, enum: SCHEDULE_PATTERNS },
    preferredTime: { type: String, enum: TIME_SLOTS },
    source: { type: String, enum: LEAD_SOURCES },
    comment: String,
    locale: { type: String, enum: LOCALES, default: 'uz' },
    status: { type: String, enum: LEAD_STATUSES, default: 'yangi', index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    nextActionAt: Date,
    history: { type: [historyEntrySchema], default: [] },
    convertedStudentId: { type: Schema.Types.ObjectId, ref: 'Student' },
    utm: {
      source: String,
      medium: String,
      campaign: String,
      content: String,
      term: String,
    },
    /** §7.1 — a returning applicant is merged, not duplicated. */
    isReturning: { type: Boolean, default: false },
    ip: String,

    // §22 — every collection carries these.
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
  },
  { timestamps: true },
)

// §22 index list
leadSchema.index({ branchId: 1, status: 1, createdAt: -1 })

leadSchema.plugin(branchScopePlugin)

export type LeadDocument = InferSchemaType<typeof leadSchema>
export const Lead = model('Lead', leadSchema)
