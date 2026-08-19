import pino from 'pino'
import { env } from './env.js'

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.isProduction
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }),
  redact: {
    // Never log credentials or personal contact details (§27 data protection).
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.passwordHash', '*.otpCode'],
    remove: true,
  },
})
