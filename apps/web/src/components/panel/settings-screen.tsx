'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { RotateCcw } from 'lucide-react'
import { useQuery, useMutation, type Paginated } from '@/lib/api/use-api'
import { Panel, Loading, ErrorBox } from './primitives'
import { FilterChip } from './table-kit'
import { INPUT, MoneyInput, Action, Saved, DialogError, type Localized } from './form-kit'
import { cn } from '@/lib/utils'

type SettingRow = {
  key: string
  value: unknown
  effective: unknown
  scope: 'global' | 'branch'
  control: 'number' | 'percent' | 'money' | 'boolean' | 'text' | 'secret' | 'json'
  group: 'money' | 'academic' | 'notifications' | 'integrations' | 'content'
  isDefault: boolean
  isOverride: boolean
}

type Branch = { _id: string; name: Localized }

const GROUPS = ['money', 'academic', 'notifications', 'integrations', 'content'] as const

/**
 * Setting keys are dotted (`money.discountCeilingPercent`) and next-intl reads a
 * dot in a message path as nesting, so the label dictionary is keyed on the same
 * name with underscores. Falling back to the raw key means a newly registered
 * setting shows up in the editor immediately, untranslated but usable, rather
 * than disappearing until someone writes three strings for it.
 */
function labelFor(t: ReturnType<typeof useTranslations>, key: string): string {
  const slug = `keys.${key.replace(/\./g, '_')}`
  return t.has(slug) ? t(slug) : key
}

/**
 * TZ §21.1 — the settings the boss actually tunes.
 *
 * Branches, courses, rooms, fine rules and salary schemes are also on the §21.1
 * list and are all *collections* with their own screens; what is left — and what
 * this edits — is the numbers and switches several modules read.
 *
 * The `isDefault` / `isOverride` distinction is shown rather than hidden,
 * because "20%" meaning *the shipped default* and "20%" meaning *somebody chose
 * this* are different facts, and only the second survives a change to the
 * default.
 */
export function SettingsScreen() {
  const t = useTranslations('panel.settings')
  const [group, setGroup] = useState<(typeof GROUPS)[number]>('money')
  const [branchId, setBranchId] = useState<string | null>(null)

  const query = branchId ? `?branchId=${branchId}` : ''
  const { data, loading, error, refetch } = useQuery<SettingRow[]>(`/settings${query}`)
  const { data: branches } = useQuery<Paginated<Branch>>('/branches?limit=100')

  const rows = (data ?? []).filter((row) => row.group === group)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-1.5">
        {GROUPS.map((option) => (
          <FilterChip
            key={option}
            label={t(`groups.${option}`)}
            active={group === option}
            onClick={() => setGroup(option)}
          />
        ))}
      </div>

      {/* A branch override only makes sense for `scope: 'branch'` keys, so the
          picker is here rather than per row. */}
      {branches && branches.items.length > 1 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-2xs text-ink-muted">{t('scope')}</span>
          <FilterChip
            label={t('centreWide')}
            active={branchId === null}
            onClick={() => setBranchId(null)}
          />
          {branches.items.map((branch) => (
            <FilterChip
              key={branch._id}
              label={branch.name?.uz ?? '—'}
              active={branchId === branch._id}
              onClick={() => setBranchId(branch._id)}
            />
          ))}
        </div>
      ) : null}

      {loading ? <Loading /> : null}
      {error ? <ErrorBox code={error.code} message={error.message} /> : null}

      {rows.length > 0 ? (
        <Panel>
          <ul className="divide-y divide-border-subtle">
            {rows.map((row) => (
              <SettingRowEditor
                key={row.key}
                row={row}
                branchId={branchId}
                onSaved={refetch}
              />
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  )
}

function SettingRowEditor({
  row,
  branchId,
  onSaved,
}: {
  row: SettingRow
  branchId: string | null
  onSaved: () => void
}) {
  const t = useTranslations('panel.settings')
  const [draft, setDraft] = useState<unknown>(row.effective)
  const [saved, setSaved] = useState(false)

  const save = useMutation<{ key: string; value: unknown; branchId?: string }, unknown>(
    '/settings',
    'PATCH',
  )
  const clear = useMutation<undefined, unknown>(
    `/settings/${row.key}${branchId ? `?branchId=${branchId}` : ''}`,
    'DELETE',
  )

  // A branch-scoped key cannot be overridden while looking at the centre-wide
  // view, and a global key has no branch column at all.
  const editable = row.scope === 'global' ? branchId === null : true

  const commit = async (value: unknown) => {
    const result = await save.mutate({
      key: row.key,
      value,
      ...(branchId && row.scope === 'branch' ? { branchId } : {}),
    })
    if (result) {
      setSaved(true)
      onSaved()
    }
  }

  return (
    <li className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-xs font-medium text-ink dark:text-white">
            {labelFor(t, row.key)}
            {row.isOverride ? (
              <span className="rounded-pill bg-clay-500/15 px-2 py-0.5 text-2xs text-clay-600 dark:text-clay-300">
                {t('overridden')}
              </span>
            ) : row.isDefault ? (
              <span className="rounded-pill bg-navy-50 px-2 py-0.5 text-2xs text-ink-muted dark:bg-navy-800">
                {t('default')}
              </span>
            ) : null}
          </span>
          <span className="font-mono text-2xs text-ink-muted">{row.key}</span>
        </div>

        {row.isOverride || !row.isDefault ? (
          <button
            type="button"
            disabled={clear.pending}
            onClick={async () => {
              const result = await clear.mutate()
              if (result !== null) onSaved()
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-border-subtle px-3 text-2xs text-ink-muted hover:text-navy-700 disabled:opacity-50 dark:hover:text-white"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            {t('reset')}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {row.control === 'boolean' ? (
          <button
            type="button"
            disabled={!editable}
            onClick={() => {
              const next = !(draft as boolean)
              setDraft(next)
              void commit(next)
            }}
            aria-pressed={Boolean(draft)}
            className={cn(
              'inline-flex h-9 w-16 items-center rounded-pill px-1 transition-colors disabled:opacity-50',
              draft ? 'bg-success justify-end' : 'bg-navy-200 justify-start dark:bg-navy-700',
            )}
          >
            <span className="size-7 rounded-pill bg-white shadow-raise" />
          </button>
        ) : row.control === 'money' ? (
          <div className="flex flex-1 items-center gap-2">
            <div className="min-w-40 flex-1">
              <MoneyInput
                value={(draft as number) ?? null}
                onChange={(value) => setDraft(value)}
                disabled={!editable}
              />
            </div>
            <Action label={t('save')} pending={save.pending} onClick={() => commit(draft)} />
          </div>
        ) : row.control === 'json' ? (
          <div className="flex flex-1 flex-col gap-2">
            <textarea
              rows={3}
              disabled={!editable}
              value={typeof draft === 'string' ? draft : JSON.stringify(draft, null, 0)}
              onChange={(event) => setDraft(event.target.value)}
              className={cn(INPUT, 'resize-y font-mono text-2xs')}
            />
            <Action
              label={t('save')}
              pending={save.pending}
              onClick={() => {
                try {
                  commit(typeof draft === 'string' ? JSON.parse(draft) : draft)
                } catch {
                  // A malformed edit stays in the box rather than being sent.
                }
              }}
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center gap-2">
            <input
              type={row.control === 'secret' ? 'password' : row.control === 'text' ? 'text' : 'number'}
              disabled={!editable}
              placeholder={row.control === 'secret' ? t('secretPlaceholder') : undefined}
              value={row.control === 'secret' ? '' : String(draft ?? '')}
              onChange={(event) =>
                setDraft(
                  row.control === 'text' || row.control === 'secret'
                    ? event.target.value
                    : Number(event.target.value),
                )
              }
              className={cn(INPUT, 'min-w-40 flex-1')}
            />
            {row.control === 'percent' ? <span className="text-xs text-ink-muted">%</span> : null}
            <Action label={t('save')} pending={save.pending} onClick={() => commit(draft)} />
          </div>
        )}
      </div>

      {save.error ? <DialogError error={save.error} /> : null}
      {saved && !save.error ? <Saved label={t('saved')} /> : null}
      {!editable ? <p className="text-2xs text-ink-muted">{t('globalOnly')}</p> : null}
    </li>
  )
}
