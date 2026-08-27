'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { UserPlus, ArrowRightLeft, Snowflake, Play } from 'lucide-react'
import { STUDENT_STATUSES, DROP_REASONS, GENDERS, formatPhone } from '@leader/shared/schemas'
import type { Locale } from '@leader/shared/locales'
import { useQuery, useMutation, type Paginated } from '@/lib/api/use-api'
import {
  Dialog,
  Field,
  INPUT,
  Select,
  MoneyInput,
  DateField,
  Action,
  Divider,
  DialogError,
  Saved,
  type Localized,
} from './form-kit'
import { cn } from '@/lib/utils'

export type PanelStudent = {
  _id: string
  fullName: string
  phone?: string
  parentName?: string
  parentPhone?: string
  telegramId?: string
  birthDate?: string
  gender?: string
  schoolClass?: string
  age?: number
  address?: string
  status: string
  dropReason?: string
  monthlyFee: number
  discountPercent?: number
  joinedAt?: string
  notes?: string
}

type Branch = { _id: string; name: Localized }
type Group = { _id: string; name: string }

/**
 * TZ §9.1 — the student card's editable side.
 *
 * The field set is the workbook's columns, in the workbook's order: `F.I`,
 * `Telefon`, `Status`, `Kelgan sanasi`, `Sinf`, `Yosh`, `Chek`. Staff already
 * know that shape by heart, and a form that reorders it for tidiness costs them
 * time on every single entry.
 *
 * Transfer and freeze are separate actions with their own buttons, not fields on
 * the form. Both do more than set a column — a transfer moves unpaid invoices
 * across a branch boundary — and burying either inside a general Save would make
 * the consequence impossible to predict.
 */
export function StudentDialog({
  student,
  onClose,
  onSaved,
}: {
  student: PanelStudent | null
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('panel.studentForm')
  const creating = student === null

  const [fullName, setFullName] = useState(student?.fullName ?? '')
  const [phone, setPhone] = useState(student?.phone ?? '')
  const [parentName, setParentName] = useState(student?.parentName ?? '')
  const [parentPhone, setParentPhone] = useState(student?.parentPhone ?? '')
  const [telegramId, setTelegramId] = useState(student?.telegramId ?? '')
  const [birthDate, setBirthDate] = useState((student?.birthDate ?? '').slice(0, 10))
  const [gender, setGender] = useState(student?.gender ?? '')
  const [schoolClass, setSchoolClass] = useState(student?.schoolClass ?? '')
  const [age, setAge] = useState(student?.age ? String(student.age) : '')
  const [address, setAddress] = useState(student?.address ?? '')
  const [status, setStatus] = useState(student?.status ?? 'pending')
  const [dropReason, setDropReason] = useState(student?.dropReason ?? '')
  const [monthlyFee, setMonthlyFee] = useState<number | null>(student?.monthlyFee ?? null)
  const [joinedAt, setJoinedAt] = useState(
    (student?.joinedAt ?? new Date().toISOString()).slice(0, 10),
  )
  const [notes, setNotes] = useState(student?.notes ?? '')
  const [saved, setSaved] = useState(false)

  const save = useMutation<Record<string, unknown>, PanelStudent>(
    creating ? '/students' : `/students/${student._id}`,
    creating ? 'POST' : 'PATCH',
  )

  // §9.1 — `dropped` "requires a reason from a dropdown … for the churn report".
  const needsReason = status === 'dropped' && !dropReason
  const ready = fullName.trim().length >= 3 && !needsReason

  return (
    <Dialog title={creating ? t('create') : fullName} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <Field label={t('fullName')} required>
          <input
            value={fullName}
            autoFocus
            onChange={(e) => setFullName(e.target.value)}
            className={INPUT}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('phone')} hint={phone.trim() ? formatPhone(phone) : undefined}>
            <input
              value={phone}
              inputMode="tel"
              placeholder="+998 90 123 45 67"
              onChange={(e) => setPhone(e.target.value)}
              className={cn(INPUT, 'font-mono')}
            />
          </Field>
          <Field label={t('telegram')}>
            <input
              value={telegramId}
              placeholder="@username"
              onChange={(e) => setTelegramId(e.target.value)}
              className={INPUT}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('parentName')}>
            <input
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              className={INPUT}
            />
          </Field>
          <Field
            label={t('parentPhone')}
            hint={parentPhone.trim() ? formatPhone(parentPhone) : undefined}
          >
            <input
              value={parentPhone}
              inputMode="tel"
              onChange={(e) => setParentPhone(e.target.value)}
              className={cn(INPUT, 'font-mono')}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('birthDate')}>
            <DateField value={birthDate} onChange={setBirthDate} />
          </Field>
          <Field label={t('gender')}>
            <Select
              value={gender}
              onChange={setGender}
              placeholder="—"
              options={GENDERS.map((option) => ({ value: option, label: t(`genders.${option}`) }))}
            />
          </Field>
          <Field label={t('age')}>
            <input
              type="number"
              min={3}
              max={99}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className={INPUT}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('schoolClass')}>
            <input
              value={schoolClass}
              onChange={(e) => setSchoolClass(e.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label={t('joinedAt')}>
            <DateField value={joinedAt} onChange={setJoinedAt} />
          </Field>
        </div>

        <Field label={t('address')}>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={INPUT} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('status')}>
            <Select
              value={status}
              onChange={(next) => {
                setStatus(next)
                if (next !== 'dropped') setDropReason('')
              }}
              options={STUDENT_STATUSES.map((option) => ({
                value: option,
                label: t(`statuses.${option}`),
              }))}
            />
          </Field>
          <Field label={t('monthlyFee')} hint={t('feeHint')}>
            <MoneyInput value={monthlyFee} onChange={setMonthlyFee} />
          </Field>
        </div>

        {/* §9.1 — the churn report needs the reason, so the form insists on it. */}
        {status === 'dropped' ? (
          <Field label={t('dropReason')} required error={needsReason ? t('reasonRequired') : undefined}>
            <Select
              value={dropReason}
              onChange={setDropReason}
              placeholder={t('choose')}
              options={DROP_REASONS.map((option) => ({
                value: option,
                label: t(`dropReasons.${option}`),
              }))}
            />
          </Field>
        ) : null}

        <Field label={t('notes')}>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={cn(INPUT, 'resize-y')}
          />
        </Field>

        {save.error ? <DialogError error={save.error} /> : null}
        {saved && !save.error ? <Saved label={t('saved')} /> : null}

        <Action
          label={creating ? t('create') : t('save')}
          Icon={UserPlus}
          tone="primary"
          pending={save.pending}
          disabled={!ready}
          onClick={async () => {
            const result = await save.mutate({
              fullName: fullName.trim(),
              ...(phone.trim() ? { phone: phone.trim() } : {}),
              ...(parentName.trim() ? { parentName: parentName.trim() } : {}),
              ...(parentPhone.trim() ? { parentPhone: parentPhone.trim() } : {}),
              ...(telegramId.trim() ? { telegramId: telegramId.trim() } : {}),
              ...(birthDate ? { birthDate: new Date(birthDate).toISOString() } : {}),
              ...(gender ? { gender } : {}),
              ...(schoolClass.trim() ? { schoolClass: schoolClass.trim() } : {}),
              ...(age ? { age: Number(age) } : {}),
              ...(address.trim() ? { address: address.trim() } : {}),
              status,
              ...(dropReason ? { dropReason } : {}),
              monthlyFee: monthlyFee ?? 0,
              joinedAt: new Date(joinedAt).toISOString(),
              ...(notes.trim() ? { notes: notes.trim() } : {}),
            })
            if (result) {
              setSaved(true)
              onSaved()
            }
          }}
        />

        {!creating ? <StudentActions student={student} onDone={onSaved} /> : null}
      </div>
    </Dialog>
  )
}

/**
 * The two actions that are not field edits.
 *
 * Both are kept below a divider and away from Save, because a transfer rewrites
 * which branch owns the student's unpaid invoices and a freeze stops their
 * billing — neither is something to trip over while correcting a phone number.
 */
function StudentActions({ student, onDone }: { student: PanelStudent; onDone: () => void }) {
  const t = useTranslations('panel.studentForm')
  const locale = useLocale() as Locale
  const [showTransfer, setShowTransfer] = useState(false)
  const [toBranchId, setToBranchId] = useState('')
  const [toGroupId, setToGroupId] = useState('')

  const { data: branches } = useQuery<Paginated<Branch>>('/branches?limit=100')
  const { data: groups } = useQuery<Paginated<Group>>('/groups?limit=100&status=active')

  const transfer = useMutation<Record<string, unknown>, unknown>(
    `/students/${student._id}/transfer`,
  )

  const branchName = (branch: Branch) => branch.name?.[locale] || branch.name?.uz || '—'

  return (
    <>
      <Divider />

      {student.status === 'frozen' ? (
        <UnfreezeAction studentId={student._id} onDone={onDone} />
      ) : (
        <FreezeAction studentId={student._id} onDone={onDone} />
      )}
      <p className="-mt-2 text-2xs text-ink-muted">{t('freezeHint')}</p>

      {!showTransfer ? (
        <Action
          label={t('transfer')}
          Icon={ArrowRightLeft}
          onClick={() => setShowTransfer(true)}
        />
      ) : (
        <div className="flex flex-col gap-3 rounded-input border border-border-subtle p-4">
          <p className="text-2xs leading-relaxed text-ink-muted">{t('transferHint')}</p>

          <Field label={t('toBranch')}>
            <Select
              value={toBranchId}
              onChange={setToBranchId}
              placeholder={t('sameBranch')}
              options={(branches?.items ?? []).map((branch) => ({
                value: branch._id,
                label: branchName(branch),
              }))}
            />
          </Field>

          <Field label={t('toGroup')}>
            <Select
              value={toGroupId}
              onChange={setToGroupId}
              placeholder={t('noGroup')}
              options={(groups?.items ?? []).map((group) => ({
                value: group._id,
                label: group.name,
              }))}
            />
          </Field>

          {transfer.error ? <DialogError error={transfer.error} /> : null}

          <Action
            label={t('confirmTransfer')}
            tone="danger"
            pending={transfer.pending}
            disabled={!toBranchId && !toGroupId}
            onClick={async () => {
              const result = await transfer.mutate({
                ...(toBranchId ? { toBranchId } : {}),
                ...(toGroupId ? { toGroupId } : {}),
              })
              if (result) {
                setShowTransfer(false)
                onDone()
              }
            }}
          />
        </div>
      )}
    </>
  )
}

/**
 * A4 — freezing needs a record (fromDate/toDate/amount/reason), not a bare
 * toggle: it must show up in payment history and auto-reverse on `toDate`
 * (see `autoUnfreezeStudents` in the API's payment.service.ts). Mirrors the
 * transfer action's collapsed-form pattern above.
 */
function FreezeAction({ studentId, onDone }: { studentId: string; onDone: () => void }) {
  const t = useTranslations('panel.studentForm')
  const [open, setOpen] = useState(false)
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [toDate, setToDate] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [reason, setReason] = useState('')

  const freeze = useMutation<Record<string, unknown>, unknown>(`/students/${studentId}/freeze`)

  if (!open) {
    return <Action label={t('freeze')} Icon={Snowflake} onClick={() => setOpen(true)} />
  }

  return (
    <div className="flex flex-col gap-3 rounded-input border border-border-subtle p-4">
      <p className="text-2xs leading-relaxed text-ink-muted">{t('freezeFormHint')}</p>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('freezeFrom')}>
          <DateField value={fromDate} onChange={setFromDate} />
        </Field>
        <Field label={t('freezeTo')}>
          <DateField value={toDate} onChange={setToDate} min={fromDate} />
        </Field>
      </div>

      <Field label={t('freezeAmount')} hint={t('freezeAmountHint')}>
        <MoneyInput value={amount} onChange={setAmount} />
      </Field>

      <Field label={t('freezeReason')} required>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          className={INPUT}
        />
      </Field>

      {freeze.error ? <DialogError error={freeze.error} /> : null}

      <Action
        label={t('confirmFreeze')}
        tone="danger"
        pending={freeze.pending}
        disabled={!toDate || reason.trim().length < 3}
        onClick={async () => {
          const result = await freeze.mutate({
            fromDate,
            toDate,
            reason: reason.trim(),
            ...(amount ? { amount } : {}),
          })
          if (result) {
            setOpen(false)
            onDone()
          }
        }}
      />
    </div>
  )
}

/** A4 — unfreezing is a single confirmed action; no fields to collect. */
function UnfreezeAction({ studentId, onDone }: { studentId: string; onDone: () => void }) {
  const t = useTranslations('panel.studentForm')
  const unfreeze = useMutation<undefined, unknown>(`/students/${studentId}/unfreeze`)

  return (
    <Action
      label={t('unfreeze')}
      Icon={Play}
      pending={unfreeze.pending}
      onClick={async () => {
        const result = await unfreeze.mutate()
        if (result !== null) onDone()
      }}
    />
  )
}
