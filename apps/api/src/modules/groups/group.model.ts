import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose'
import {
  SCHEDULE_PATTERNS_GROUP,
  GROUP_STATUSES,
  ATTENDANCE_STATUSES,
} from '@leader/shared/schemas'
import { branchScopePlugin } from '../../middleware/branch-scope.js'

/** TZ §22 — `courses`. Not branch-scoped: a course is a product, offered by many branches. */
const localized = ({ required = false } = {}) => ({
  uz: { type: String, required },
  ru: String,
  en: String,
})

const courseSchema = new Schema(
  {
    name: { type: localized({ required: true }), required: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: localized(),
    level: String,
    durationMonths: { type: Number, default: 8 },
    /** Default only — the real price is per group, per branch (§5.3). */
    defaultPrice: { type: Number, default: 0, min: 0 },
    cover: String,
    isPublic: { type: Boolean, default: true },
    order: { type: Number, default: 0 },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
  },
  { timestamps: true },
)

export const Course = model('Course', courseSchema)

/** TZ §22 — `groups`: course + teacher + room + schedule + students. */
const groupSchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    name: { type: String, required: true, trim: true },
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assistantTeacherId: { type: Schema.Types.ObjectId, ref: 'User' },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room' },

    schedule: {
      pattern: { type: String, enum: SCHEDULE_PATTERNS_GROUP, default: 'juft' },
      /** ISO weekdays, 1 = Monday. */
      days: { type: [Number], default: [] },
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
    },

    startDate: { type: Date, required: true },
    endDate: Date,
    capacity: { type: Number, default: 12, min: 1 },
    /** §26.4 — whole so'm. Overrides the course default for this branch. */
    price: { type: Number, default: 0, min: 0 },
    /** §14.1 — the `Статистика` sheet uses 0.6. */
    teacherShare: { type: Number, default: 0.6, min: 0, max: 1 },
    status: { type: String, enum: GROUP_STATUSES, default: 'planned', index: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
  },
  { timestamps: true },
)

groupSchema.index({ branchId: 1, status: 1 })
groupSchema.plugin(branchScopePlugin)

export type GroupDocument = HydratedDocument<InferSchemaType<typeof groupSchema>>
export const Group = model('Group', groupSchema)

/** TZ §22 — `enrollments`. A student may sit in several groups at once (§9.1). */
const enrollmentSchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    startDate: { type: Date, default: Date.now },
    endDate: Date,
    /** Snapshot of the fee at enrolment, so a later price change is not retroactive. */
    price: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    status: { type: String, enum: ['active', 'finished', 'dropped'], default: 'active' },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
  },
  { timestamps: true },
)

// One live enrolment per student per group.
enrollmentSchema.index(
  { studentId: 1, groupId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
)
enrollmentSchema.plugin(branchScopePlugin)

export const Enrollment = model('Enrollment', enrollmentSchema)

/** TZ §22 — `lessons`, generated for the whole period when a group is created (§9.3). */
const lessonSchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    date: { type: Date, required: true, index: true },
    startTime: String,
    endTime: String,
    teacherId: { type: Schema.Types.ObjectId, ref: 'User' },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room' },
    topic: String,
    status: { type: String, enum: ['planned', 'held', 'cancelled'], default: 'planned' },
    cancelReason: String,

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
  },
  { timestamps: true },
)

lessonSchema.index({ groupId: 1, date: 1 })
lessonSchema.plugin(branchScopePlugin)

export type LessonDocument = HydratedDocument<InferSchemaType<typeof lessonSchema>>
export const Lesson = model('Lesson', lessonSchema)

/** TZ §22 — `attendance`. Students and parents can never write here (§10.2). */
const attendanceSchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
    reason: String,
    parentInformed: { type: Boolean, default: false },

    markedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    markedAt: { type: Date, default: Date.now },
    /** §10.1 — an edit after 48 h needs Admin and is logged. */
    editedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    editedAt: Date,
  },
  { timestamps: true },
)

// §22 — one row per student per lesson.
attendanceSchema.index({ lessonId: 1, studentId: 1 }, { unique: true })
attendanceSchema.plugin(branchScopePlugin)

export const Attendance = model('Attendance', attendanceSchema)

/** TZ §22 — `rooms`, for the schedule grid and double-booking checks (§9.3). */
const roomSchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    name: { type: String, required: true },
    capacity: { type: Number, default: 12 },
    equipment: { type: [String], default: [] },
    deletedAt: Date,
  },
  { timestamps: true },
)

roomSchema.plugin(branchScopePlugin)
export const Room = model('Room', roomSchema)
