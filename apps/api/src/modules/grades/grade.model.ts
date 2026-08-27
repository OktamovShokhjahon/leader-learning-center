import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { branchScopePlugin } from '../../middleware/branch-scope.js'

/**
 * C — Grading ("Baho"), one row per student per lesson, mirroring `Attendance`
 * exactly (same shape discipline: one Lesson, one entry per student, an
 * append-only edit trail). Deliberately its own collection rather than a
 * field bolted onto `Attendance` — a lesson can be graded without anyone's
 * presence being in question, and vice versa.
 */
const gradeSchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    /** 1–5, the school-grade convention (GRADE_MIN/GRADE_MAX in the shared schema). */
    value: { type: Number, required: true, min: 1, max: 5 },
    comment: String,

    gradedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    gradedAt: { type: Date, default: Date.now },
    editedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    editedAt: Date,
  },
  { timestamps: true },
)

// One grade per student per lesson — re-grading updates this row, never adds a second.
gradeSchema.index({ lessonId: 1, studentId: 1 }, { unique: true })
gradeSchema.plugin(branchScopePlugin)

export type GradeDocument = HydratedDocument<InferSchemaType<typeof gradeSchema>>
export const Grade = model('Grade', gradeSchema)
