'use client'

import { useTranslations } from 'next-intl'
import { GraduationCap } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { Loading, Empty } from './primitives'
import { StudentCabinet } from './student-cabinet'

/**
 * Resolves which student record the signed-in person is looking at.
 *
 * A `User` is not a `Student`: a learner has a login linked to their student
 * record. The link comes down on the session as `studentId`, deliberately —
 * a student holds no `student.manage` grant, so looking the record up by
 * listing students would 403 for exactly the person the cabinet is for.
 *
 * A parent (§4.1) is linked to one or more children through a table that lands
 * with the parent module; until then a parent account sees the same honest
 * "not linked yet" state rather than an empty calendar that looks broken.
 */
export function CabinetView() {
  const t = useTranslations('panel.cabinet')
  const { user, status } = useAuth()

  if (status === 'loading') return <Loading />
  if (!user) return null

  if (!user.studentId) {
    return <Empty title={t('unlinked')} Icon={GraduationCap} />
  }

  return <StudentCabinet studentId={user.studentId} />
}
