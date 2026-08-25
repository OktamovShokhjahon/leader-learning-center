import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { MATERIAL_TYPES } from '@leader/shared/schemas'

const materialSchema = new Schema(
  {
    title: { uz: { type: String, required: true }, ru: String, en: String },
    description: { uz: String, ru: String, en: String },
    type: { type: String, enum: MATERIAL_TYPES, required: true, index: true },
    section: { type: String, required: true, default: 'General', index: true },
    fileUrl: { type: String, required: true },
    coverUrl: String,
    courseIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Course' }], default: [] },
    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: false, index: true },
    isFree: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
  },
  { timestamps: true },
)

materialSchema.index({ section: 1, order: 1 })

export type MaterialDocument = HydratedDocument<InferSchemaType<typeof materialSchema>>
export const Material = model('Material', materialSchema)
