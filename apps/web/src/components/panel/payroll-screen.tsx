'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Calculator, Check, Banknote, Receipt, ChevronDown } from 'lucide-react'
import { SALARY_SCHEMES } from '@leader/shared/schemas'
import { useQuery, useMutation, type Paginated } from '@/lib/api/use-api'
import { Panel, TableShell, Th, Td, Money, Loading, ErrorBox, Empty, StatusPill } from './primitives'
import { FilterChip, RowAction } from './table-kit'
import { Dialog, Field, INPUT, Select, MoneyInput, Action, DialogError } from './form-kit'
import { cn } from '@/lib/utils'

type Payslip = {
  _id: string
  period: string
  scheme: string
  gross: number
  net: number
  status: string
  userId?: { _id: string; fullName: string } | string
  basis?: {
    collectedTotal?: number
    lessonsTaught?: number
    activeStudents?: number
    share?: number
    paymentIds?: string[]
  }
  deductions?: { label: string; amount: number }[]
}

type Scheme = {
  _id: string
  scheme: string
  baseAmount: number
  share?: number
  rate: number
  isActive: boolean
  userId?: { _id: string; fullName: string } | string
}

type Staff = { _id: string; fullName: string; roles: { role: string }[] }

const currentPeriod = () => new Date().toISOString().slice(0, 7)

/**
 * TZ §14 — the payroll run.
 *
 * §30.7 is the acceptance criterion: *"a percentage-based teacher's figure is
 * traceable to the exact collected payments that produced it."* So each row
 * expands to show its basis — what was collected, at what share, and how many
 * payments made it up. A payslip that just shows a number cannot be checked, and
 * the first question anyone asks about their pay is how it was arrived at.
 */
export function PayrollScreen() {
  const t = useTranslations('panel.payroll')

  const [period, setPeriod] = useState(currentPeriod())
  const [tab, setTab] = useState<'runs' | 'schemes'>('runs')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editingScheme, setEditingScheme] = useState<Scheme | 'new' | null>(null)

  const { data, loading, error, refetch } = useQuery<
    Paginated<Payslip> & { grossTotal: number; netTotal: number }
  >(`/payroll?period=${period}&limit=100`)
  const schemes = useQuery<{ items: Scheme[] }>('/payroll/schemes')

  const calculate = useMutation<{ period: string }, { calculated: number }>('/payroll/calculate')

  const name = (value: Payslip['userId']) =>
    typeof value === 'object' ? value?.fullName : t('unknown')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          <FilterChip label={t('runs')} active={tab === 'runs'} onClick={() => setTab('runs')} />
          <FilterChip
            label={t('schemes')}
            active={tab === 'schemes'}
            onClick={() => setTab('schemes')}
          />
        </div>

        <span className="flex-1" />

        {tab === 'runs' ? (
          <>
            <input
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className={cn(INPUT, 'h-12 w-44 py-0')}
            />
            <button
              type="button"
              disabled={calculate.pending}
              onClick={async () => {
                const result = await calculate.mutate({ period })
                if (result) void refetch()
              }}
              className="inline-flex h-12 items-center gap-2 rounded-pill bg-clay-500 px-5 text-xs font-medium text-white hover:bg-clay-400 disabled:opacity-50"
            >
              <Calculator className="size-4" aria-hidden />
              {t('calculate')}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEditingScheme('new')}
            className="inline-flex h-12 items-center gap-2 rounded-pill bg-clay-500 px-5 text-xs font-medium text-white hover:bg-clay-400"
          >
            {t('newScheme')}
          </button>
        )}
      </div>

      {calculate.error ? <DialogError error={calculate.error} /> : null}

      {tab === 'runs' ? (
        <>
          {loading ? <Loading /> : null}
          {error ? <ErrorBox code={error.code} message={error.message} /> : null}
          {data && data.items.length === 0 ? <Empty title={t('none')} Icon={Receipt} /> : null}

          {data && data.items.length > 0 ? (
            <Panel
              action={
                <span className="flex gap-4 text-2xs text-ink-muted">
                  <span>
                    {t('gross')} <Money amount={data.grossTotal} className="text-ink dark:text-white" />
                  </span>
                  <span>
                    {t('net')} <Money amount={data.netTotal} className="text-ink dark:text-white" />
                  </span>
                </span>
              }
            >
              <TableShell>
                <thead>
                  <tr>
                    <Th>{t('person')}</Th>
                    <Th>{t('scheme')}</Th>
                    <Th className="text-right">{t('gross')}</Th>
                    <Th className="text-right">{t('deductions')}</Th>
                    <Th className="text-right">{t('net')}</Th>
                    <Th>{t('statusLabel')}</Th>
                    <Th className="text-right" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((payslip) => {
                    const open = expanded === payslip._id
                    const deducted = (payslip.deductions ?? []).reduce(
                      (sum, row) => sum + row.amount,
                      0,
                    )

                    return (
                      <tr key={payslip._id} className="hover:bg-navy-50/50 dark:hover:bg-navy-800/40">
                        <Td>
                          <button
                            type="button"
                            onClick={() => setExpanded(open ? null : payslip._id)}
                            className="flex items-center gap-2 font-medium text-ink dark:text-white"
                          >
                            <ChevronDown
                              className={cn('size-3.5 transition-transform', open && 'rotate-180')}
                              aria-hidden
                            />
                            {name(payslip.userId)}
                          </button>

                          {/* §30.7 — the trace. */}
                          {open ? (
                            <dl className="mt-2 flex flex-col gap-1 rounded-input bg-navy-50/60 p-3 text-2xs dark:bg-navy-800/50">
                              {payslip.basis?.collectedTotal ? (
                                <div className="flex justify-between gap-4">
                                  <dt className="text-ink-muted">{t('collected')}</dt>
                                  <dd>
                                    <Money amount={payslip.basis.collectedTotal} compact />
                                    {payslip.basis.share ? (
                                      <span className="ml-1 text-ink-muted">
                                        × {payslip.basis.share}
                                      </span>
                                    ) : null}
                                  </dd>
                                </div>
                              ) : null}
                              {payslip.basis?.lessonsTaught ? (
                                <div className="flex justify-between gap-4">
                                  <dt className="text-ink-muted">{t('lessons')}</dt>
                                  <dd>{payslip.basis.lessonsTaught}</dd>
                                </div>
                              ) : null}
                              {payslip.basis?.activeStudents ? (
                                <div className="flex justify-between gap-4">
                                  <dt className="text-ink-muted">{t('students')}</dt>
                                  <dd>{payslip.basis.activeStudents}</dd>
                                </div>
                              ) : null}
                              {payslip.basis?.paymentIds?.length ? (
                                <div className="flex justify-between gap-4">
                                  <dt className="text-ink-muted">{t('payments')}</dt>
                                  <dd>{payslip.basis.paymentIds.length}</dd>
                                </div>
                              ) : null}
                              {(payslip.deductions ?? []).map((row, index) => (
                                <div key={index} className="flex justify-between gap-4 text-danger">
                                  <dt>{row.label}</dt>
                                  <dd>
                                    −<Money amount={row.amount} compact />
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          ) : null}
                        </Td>
                        <Td className="text-2xs text-ink-muted">{t(`schemeNames.${payslip.scheme}`)}</Td>
                        <Td className="text-right">
                          <Money amount={payslip.gross} compact />
                        </Td>
                        <Td className="text-right">
                          {deducted > 0 ? (
                            <Money amount={deducted} compact className="text-danger" />
                          ) : (
                            <span className="text-ink-muted">—</span>
                          )}
                        </Td>
                        <Td className="text-right font-medium">
                          <Money amount={payslip.net} compact />
                        </Td>
                        <Td>
                          <StatusPill
                            status={
                              payslip.status === 'paid'
                                ? 'paid'
                                : payslip.status === 'approved'
                                  ? 'active'
                                  : 'pending'
                            }
                            label={t(`statuses.${payslip.status}`)}
                          />
                        </Td>
                        <Td className="text-right">
                          <PayslipActions payslip={payslip} onDone={refetch} />
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </TableShell>
            </Panel>
          ) : null}
        </>
      ) : (
        <SchemesTable
          schemes={schemes.data?.items ?? []}
          loading={schemes.loading}
          onEdit={setEditingScheme}
        />
      )}

      {editingScheme ? (
        <SchemeDialog
          scheme={editingScheme === 'new' ? null : editingScheme}
          onClose={() => setEditingScheme(null)}
          onSaved={() => {
            setEditingScheme(null)
            void schemes.refetch()
          }}
        />
      ) : null}
    </div>
  )
}

function PayslipActions({ payslip, onDone }: { payslip: Payslip; onDone: () => void }) {
  const t = useTranslations('panel.payroll')
  const approve = useMutation<undefined, unknown>(`/payroll/${payslip._id}/approve`)
  const pay = useMutation<undefined, unknown>(`/payroll/${payslip._id}/pay`)

  if (payslip.status === 'paid') return null

  return (
    <span className="flex justify-end gap-2">
      {payslip.status === 'draft' ? (
        <RowAction
          label={t('approve')}
          Icon={Check}
          onClick={async () => {
            if (await approve.mutate()) onDone()
          }}
        />
      ) : (
        <RowAction
          label={t('markPaid')}
          Icon={Banknote}
          onClick={async () => {
            if (await pay.mutate()) onDone()
          }}
        />
      )}
    </span>
  )
}

function SchemesTable({
  schemes,
  loading,
  onEdit,
}: {
  schemes: Scheme[]
  loading: boolean
  onEdit: (scheme: Scheme) => void
}) {
  const t = useTranslations('panel.payroll')
  if (loading) return <Loading />
  if (schemes.length === 0) return <Empty title={t('noSchemes')} Icon={Calculator} />

  return (
    <Panel>
      <TableShell>
        <thead>
          <tr>
            <Th>{t('person')}</Th>
            <Th>{t('scheme')}</Th>
            <Th className="text-right">{t('base')}</Th>
            <Th className="text-right">{t('share')}</Th>
            <Th className="text-right">{t('rate')}</Th>
            <Th className="text-right" />
          </tr>
        </thead>
        <tbody>
          {schemes.map((scheme) => (
            <tr key={scheme._id} className="hover:bg-navy-50/50 dark:hover:bg-navy-800/40">
              <Td className="font-medium text-ink dark:text-white">
                {typeof scheme.userId === 'object' ? scheme.userId?.fullName : '—'}
              </Td>
              <Td className="text-2xs">{t(`schemeNames.${scheme.scheme}`)}</Td>
              <Td className="text-right">
                <Money amount={scheme.baseAmount} compact />
              </Td>
              <Td className="text-right font-mono tabular-nums">{scheme.share ?? '—'}</Td>
              <Td className="text-right">
                <Money amount={scheme.rate} compact />
              </Td>
              <Td className="text-right">
                <RowAction label={t('edit')} onClick={() => onEdit(scheme)} />
              </Td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </Panel>
  )
}

function SchemeDialog({
  scheme,
  onClose,
  onSaved,
}: {
  scheme: Scheme | null
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('panel.payroll')
  const creating = scheme === null

  const [userId, setUserId] = useState(
    typeof scheme?.userId === 'object' ? (scheme.userId?._id ?? '') : (scheme?.userId ?? ''),
  )
  const [kind, setKind] = useState(scheme?.scheme ?? 'percentage')
  const [baseAmount, setBaseAmount] = useState<number | null>(scheme?.baseAmount ?? 0)
  const [share, setShare] = useState(String(scheme?.share ?? 0.6))
  const [rate, setRate] = useState<number | null>(scheme?.rate ?? 0)

  const { data: staff } = useQuery<Paginated<Staff>>('/users?limit=100&status=active')
  const save = useMutation<Record<string, unknown>, Scheme>('/payroll/schemes')

  // Which inputs matter depends on the scheme (§14.1) — showing all five always
  // would ask a fixed-salary admin for a percentage share.
  const needsBase = kind === 'fixed' || kind === 'mixed'
  const needsShare = kind === 'percentage' || kind === 'mixed'
  const needsRate = kind === 'per_lesson' || kind === 'per_student'

  return (
    <Dialog title={creating ? t('newScheme') : t('editScheme')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label={t('person')} required>
          <Select
            value={userId}
            onChange={setUserId}
            placeholder={t('choose')}
            options={(staff?.items ?? []).map((person) => ({
              value: person._id,
              label: person.fullName,
            }))}
          />
        </Field>

        <Field label={t('scheme')} hint={t('schemeHint')}>
          <Select
            value={kind}
            onChange={setKind}
            options={SALARY_SCHEMES.map((option) => ({
              value: option,
              label: t(`schemeNames.${option}`),
            }))}
          />
        </Field>

        {needsBase ? (
          <Field label={t('base')}>
            <MoneyInput value={baseAmount} onChange={setBaseAmount} />
          </Field>
        ) : null}

        {needsShare ? (
          <Field label={t('share')} hint={t('shareHint')}>
            <input
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={share}
              onChange={(event) => setShare(event.target.value)}
              className={INPUT}
            />
          </Field>
        ) : null}

        {needsRate ? (
          <Field label={t('rate')} hint={t('rateHint')}>
            <MoneyInput value={rate} onChange={setRate} />
          </Field>
        ) : null}

        {save.error ? <DialogError error={save.error} /> : null}

        <Action
          label={t('save')}
          tone="primary"
          pending={save.pending}
          disabled={!userId}
          onClick={async () => {
            const result = await save.mutate({
              userId,
              scheme: kind,
              baseAmount: baseAmount ?? 0,
              ...(needsShare ? { share: Number(share) } : {}),
              rate: rate ?? 0,
              isActive: true,
            })
            if (result) onSaved()
          }}
        />
      </div>
    </Dialog>
  )
}
