'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarCheck, Table2, GraduationCap, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AttendanceGrid } from './attendance-grid'
import { AttendanceReport } from './attendance-report'
import { GradeGrid } from './grade-grid'

type Tab = 'mark' | 'report' | 'grades'

function TabButton({
  active,
  onClick,
  Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  Icon: LucideIcon
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-pill px-4 py-2 text-xs font-medium transition-colors',
        active
          ? 'bg-navy-600 text-white'
          : 'text-ink-soft hover:bg-navy-50 dark:text-navy-200 dark:hover:bg-navy-800',
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  )
}

/**
 * B1/C1 — the day-of tap-to-mark screen stays the default (§10.1's whole
 * design is speed on the day), with the attendance report grid and the
 * grading panel one tab away each, since all three operate on the same
 * group + lesson-date context.
 */
export function AttendanceWorkspace({ groupId }: { groupId: string }) {
  const t = useTranslations('panel.attendanceReport')
  const g = useTranslations('panel.grades')
  const [tab, setTab] = useState<Tab>('mark')

  return (
    <div className="flex flex-col gap-5">
      <div className="inline-flex w-fit gap-1 rounded-pill border border-border-subtle p-1">
        <TabButton active={tab === 'mark'} onClick={() => setTab('mark')} Icon={CalendarCheck} label={t('tabMark')} />
        <TabButton active={tab === 'report'} onClick={() => setTab('report')} Icon={Table2} label={t('tabReport')} />
        <TabButton active={tab === 'grades'} onClick={() => setTab('grades')} Icon={GraduationCap} label={g('tab')} />
      </div>

      {tab === 'mark' ? <AttendanceGrid groupId={groupId} /> : null}
      {tab === 'report' ? <AttendanceReport initialGroupId={groupId} /> : null}
      {tab === 'grades' ? <GradeGrid groupId={groupId} /> : null}
    </div>
  )
}
