import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import { pinoHttp } from 'pino-http'
import { ERROR_CODES } from '@leader/shared/errors'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { connectionState } from './config/db.js'
import { branchScopeMiddleware } from './middleware/branch-scope.js'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'
import { publicRouter } from './modules/public/public.routes.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { branchRouter } from './modules/branches/branch.routes.js'
import { userRouter } from './modules/users/user.routes.js'
import { leadRouter } from './modules/leads/lead.routes.js'
import { testRouter } from './modules/tests/test.routes.js'
import { studentRouter } from './modules/students/student.routes.js'
import { groupRouter } from './modules/groups/group.routes.js'
import { paymentRouter } from './modules/payments/payment.routes.js'
import { financeRouter } from './modules/finance/finance.routes.js'

export function createApp() {
  const app = express()

  // Behind Caddy/Nginx in every environment (§28) — needed for correct req.ip
  // and therefore for rate limiting to key on the real client.
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use(helmet())
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))
  // The refresh token is an httpOnly cookie (§8); nothing else in the API reads
  // cookies, and no session state is kept in one.
  app.use(cookieParser())
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req: { url?: string }) => req.url === '/api/v1/health' },
    }),
  )

  // §5.1 — request scope must wrap every handler, so it is registered before routes.
  app.use(branchScopeMiddleware)

  // §27 — rate limiting on all public endpoints.
  app.use(
    '/api/v1',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 120,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: { code: ERROR_CODES.RATE_LIMITED, message: 'Too many requests' } },
    }),
  )

  app.get('/api/v1/health', (_req, res) => {
    res.json({
      data: {
        status: 'ok',
        env: env.NODE_ENV,
        db: connectionState(),
        uptime: Math.round(process.uptime()),
      },
    })
  })

  app.use('/api/v1/public', publicRouter)
  app.use('/api/v1/auth', authRouter)
  app.use('/api/v1/branches', branchRouter)
  app.use('/api/v1/users', userRouter)
  app.use('/api/v1/leads', leadRouter)
  app.use('/api/v1/tests', testRouter)
  app.use('/api/v1/students', studentRouter)
  app.use('/api/v1/groups', groupRouter)
  app.use('/api/v1/payments', paymentRouter)
  // §4.3 / §15 — the finance router carries its own hard superadmin guard.
  app.use('/api/v1/finance', financeRouter)

  // TODO Phase 1+: /students, /groups, /attendance, /payments,
  // /fines, /expenses, /payroll, /finance (§23). Finance and payroll routers get
  // a hard requireRole('superadmin') at mount time (§4.3, §15).

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
