import { Router } from 'express'
import { mkdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import multer from 'multer'
import { ApiError } from '@leader/shared/errors'
import { asyncRoute } from '../../middleware/error-handler.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { env } from '../../config/env.js'

const UPLOAD_DIR = env.uploadDir
mkdirSync(UPLOAD_DIR, { recursive: true })

const ALLOWED: Record<string, string[]> = {
  video: ['.mp4', '.webm', '.mov', '.mkv'],
  audio: ['.mp3', '.m4a', '.wav', '.ogg'],
  pdf: ['.pdf'],
  image: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
}

const allExtensions = new Set(Object.values(ALLOWED).flat())

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase()
    cb(null, `${randomUUID()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: env.uploadMaxBytes },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase()
    if (!allExtensions.has(ext)) {
      cb(new Error('File type not allowed'))
      return
    }
    cb(null, true)
  },
})

function kindFor(ext: string): keyof typeof ALLOWED {
  for (const [kind, extensions] of Object.entries(ALLOWED)) {
    if (extensions.includes(ext)) return kind as keyof typeof ALLOWED
  }
  return 'pdf'
}

/**
 * SuperAdmin-only file uploads saved to the local `/uploads` folder.
 * Returns a public URL the web app can store on lessons and library items.
 */
export const uploadRouter = Router()

uploadRouter.use(requireAuth, requireRole('superadmin'))

uploadRouter.post(
  '/',
  upload.single('file'),
  asyncRoute(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('No file uploaded')

    const ext = extname(req.file.filename).toLowerCase()
    const url = `/uploads/${req.file.filename}`

    res.status(201).json({
      data: {
        url,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        kind: kindFor(ext),
      },
    })
  }),
)

export { UPLOAD_DIR }
