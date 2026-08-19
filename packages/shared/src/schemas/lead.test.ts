import { describe, it, expect } from 'vitest'
import { normalizePhone, formatPhone, phoneSchema, quickLeadSchema } from './lead.js'

describe('normalizePhone', () => {
  it('accepts a 998-prefixed number in any spacing', () => {
    expect(normalizePhone('+998 90 123 45 67')).toBe('+998901234567')
    expect(normalizePhone('998901234567')).toBe('+998901234567')
    expect(normalizePhone('+998-90-123-45-67')).toBe('+998901234567')
  })

  it('accepts a bare 9-digit national number', () => {
    expect(normalizePhone('901234567')).toBe('+998901234567')
  })

  it('accepts the old domestic trunk format', () => {
    expect(normalizePhone('8 90 123 45 67')).toBe('+998901234567')
  })

  it('does NOT reinterpret a foreign number as Uzbek', () => {
    // Regression: this used to become +998790012345 — a valid-looking Uzbek
    // number the applicant does not own.
    const normalized = normalizePhone('+7 900 123 45 67')
    expect(normalized).not.toMatch(/^\+998\d{9}$/)
    expect(phoneSchema.safeParse('+7 900 123 45 67').success).toBe(false)
  })

  it('rejects a number that is too short', () => {
    expect(phoneSchema.safeParse('+998 90 123').success).toBe(false)
  })
})

describe('formatPhone', () => {
  it('masks Uzbek input progressively', () => {
    expect(formatPhone('90')).toBe('+998 90')
    expect(formatPhone('901234567')).toBe('+998 90 123 45 67')
    expect(formatPhone('+998901234567')).toBe('+998 90 123 45 67')
  })

  it('leaves over-long input untouched so the user can see the problem', () => {
    expect(formatPhone('+7 900 123 45 67 89')).toBe('+7 900 123 45 67 89')
  })
})

describe('quickLeadSchema', () => {
  const valid = {
    fullName: 'Aziza Rahimova',
    phone: '+998 90 123 45 67',
    courseSlug: 'ielts',
    consent: true as const,
  }

  it('accepts a valid application and normalises the phone', () => {
    const result = quickLeadSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.phone).toBe('+998901234567')
  })

  it('requires consent', () => {
    const result = quickLeadSchema.safeParse({ ...valid, consent: false })
    expect(result.success).toBe(false)
  })

  it('rejects a filled honeypot', () => {
    const result = quickLeadSchema.safeParse({ ...valid, website: 'http://spam.example' })
    expect(result.success).toBe(false)
  })
})
