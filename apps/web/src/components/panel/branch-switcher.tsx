'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Building2, Check, ChevronDown, Loader2 } from 'lucide-react'
import { can } from '@leader/shared/permissions'
import type { Locale } from '@leader/shared/locales'
import { useQuery, useMutation, type Paginated } from '@/lib/api/use-api'
import { useAuth } from '@/lib/auth/auth-context'
import { cn } from '@/lib/utils'

type Branch = { _id: string; name: { uz: string; ru?: string; en?: string }; slug: string }

/**
 * TZ §5.2 — the branch switcher.
 *
 * §5.1 puts a branch on every operational document, and the scope for a write
 * comes from the *session*, not from a header or a form field — which means a
 * SuperAdmin sitting in the consolidated `'ALL'` scope has no branch to write
 * into. `requireSingleBranch` refuses those writes rather than letting a student
 * or a payment land in no branch at all, so without this control the boss can
 * read everything and create nothing.
 *
 * Switching reloads the page deliberately. §30.1 requires that "every figure on
 * screen changes accordingly", and the panel's data layer keys its cache on the
 * request path — which does not change when the branch does. A reload is the
 * one thing guaranteed to leave nothing behind from the previous branch.
 */
export function BranchSwitcher() {
  const t = useTranslations('panel.branchSwitcher')
  const locale = useLocale() as Locale
  const { user, getToken } = useAuth()
  const [open, setOpen] = useState(false)

  const roles = user?.roles.map((assignment) => assignment.role) ?? []
  const mayConsolidate = roles.some((role) => can(role, 'branch.viewConsolidated'))
  const maySwitch = roles.some((role) => can(role, 'branch.switch'))

  // Everyone else is pinned to the branches they hold a role in; the API returns
  // exactly those, so no filtering is needed here.
  const { data } = useQuery<Paginated<Branch>>('/branches?limit=100&sort=slug')
  const switchTo = useMutation<{ branchId: string }, { activeBranchId: string }>('/auth/branch')

  const branches = data?.items ?? []
  // A single-branch account has nothing to choose between.
  if (!user || branches.length === 0 || (!maySwitch && branches.length < 2)) return null

  const active = user.activeBranchId
  const label =
    active === 'ALL' || active === null
      ? t('allBranches')
      : (branches.find((branch) => branch._id === active)?.name?.[locale] ??
        branches.find((branch) => branch._id === active)?.name?.uz ??
        t('pickOne'))

  const choose = async (branchId: string) => {
    const token = await getToken()
    if (!token) return
    const result = await switchTo.mutate({ branchId })
    if (result) window.location.reload()
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-pill border px-3 text-2xs font-medium transition-colors',
          active === 'ALL' || active === null
            ? 'border-clay-500/40 text-clay-600 dark:text-clay-300'
            : 'border-border-subtle text-ink-soft hover:border-navy-600/40 dark:text-navy-200',
        )}
      >
        {switchTo.pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Building2 className="size-3.5" aria-hidden />
        )}
        <span className="max-w-36 truncate">{label}</span>
        <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open ? (
        <>
          {/* Click-away, so the menu does not need a document listener. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <ul
            role="listbox"
            className="absolute right-0 z-50 mt-2 min-w-56 overflow-hidden rounded-card border border-border-subtle bg-surface py-1 shadow-float"
          >
            {/* §5.1 — the consolidated scope reads across branches and writes to none. */}
            {mayConsolidate ? (
              <li>
                <Option
                  label={t('allBranches')}
                  hint={t('allBranchesHint')}
                  active={active === 'ALL'}
                  onClick={() => choose('ALL')}
                />
              </li>
            ) : null}

            {branches.map((branch) => (
              <li key={branch._id}>
                <Option
                  label={branch.name?.[locale] || branch.name?.uz || branch.slug}
                  active={active === branch._id}
                  onClick={() => choose(branch._id)}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}

function Option({
  label,
  hint,
  active,
  onClick,
}: {
  label: string
  hint?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-navy-50/60 dark:hover:bg-navy-800/50"
    >
      <Check
        className={cn('mt-0.5 size-3.5 shrink-0', active ? 'text-success' : 'opacity-0')}
        aria-hidden
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-ink dark:text-white">{label}</span>
        {hint ? <span className="text-2xs text-ink-muted">{hint}</span> : null}
      </span>
    </button>
  )
}
