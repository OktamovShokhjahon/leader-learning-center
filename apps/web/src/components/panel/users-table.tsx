'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search, UserPlus, Users, ShieldCheck, Ban, RotateCcw, Pencil } from 'lucide-react'
import { ROLES, GRANTABLE_ROLES, mayAdminister, type Role } from '@leader/shared/permissions'
import { useQuery, type Paginated } from '@/lib/api/use-api'
import { useAuth } from '@/lib/auth/auth-context'
import { Panel, TableShell, Th, Td, Loading, ErrorBox, Empty } from './primitives'
import { CeramicTile, initials } from '@/components/ui/ceramic-tile'
import { UserDialog, type PanelUser } from './user-dialog'
import { cn } from '@/lib/utils'

type Branch = { _id: string; name: { uz: string; ru?: string; en?: string }; slug: string }

/**
 * TZ §23 `STAFF` — the account list, and everything done to an account.
 *
 * One screen for three roles, because the API already answers each of them
 * differently: a SuperAdmin's list is every account in every branch, an Admin's
 * and a Manager's is their own branch's. The rows are the same rows; what
 * differs is what came back and which buttons are live.
 *
 * Every button here is mirrored by a check in `user.service.ts`. Hiding one is
 * a courtesy to the person clicking, never the thing that stops them (§4.3).
 */
export function UsersTable() {
  const t = useTranslations('panel.staff')
  const { user } = useAuth()

  const [search, setSearch] = useState('')
  const [role, setRole] = useState<Role | null>(null)
  const [status, setStatus] = useState<'active' | 'inactive' | null>('active')
  const [branchId, setBranchId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  /** `'new'` opens the create form; a user opens the editor for that account. */
  const [editing, setEditing] = useState<PanelUser | 'new' | null>(null)

  const actorRoles = useMemo<Role[]>(
    () => user?.roles.map((assignment) => assignment.role) ?? [],
    [user],
  )
  const isBoss = actorRoles.includes('superadmin')

  /** The roles this account may hand out — the union across the roles it holds. */
  const grantable = useMemo(() => {
    const allowed = new Set(actorRoles.flatMap((held) => GRANTABLE_ROLES[held]))
    return ROLES.filter((option) => allowed.has(option))
  }, [actorRoles])

  const query = new URLSearchParams({ page: String(page), limit: '25', sort: 'fullName' })
  if (search.trim().length >= 2) query.set('search', search.trim())
  if (role) query.set('role', role)
  if (status) query.set('status', status)
  if (branchId) query.set('branchId', branchId)

  const { data, loading, error, refetch } = useQuery<Paginated<PanelUser>>(`/users?${query}`)
  // The branch switcher and the "new account" form both need names for ids.
  // A centre has a handful of branches, so one unpaginated read covers both.
  const { data: branches } = useQuery<Paginated<Branch>>('/branches?limit=100&sort=slug')

  const branchName = (id?: string | null) =>
    branches?.items.find((branch) => branch._id === id)?.name.uz ?? null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder={t('searchPlaceholder')}
            className="h-12 w-full rounded-input border border-border-subtle bg-surface pl-11 pr-4 text-sm text-ink outline-none focus:border-glaze-500 dark:text-white"
          />
        </div>

        {grantable.length > 0 ? (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-pill bg-clay-500 px-5 text-xs font-medium text-white transition-colors hover:bg-clay-400"
          >
            <UserPlus className="size-4" aria-hidden />
            {t('create')}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip
          label={t('roleAll')}
          active={role === null}
          onClick={() => {
            setRole(null)
            setPage(1)
          }}
        />
        {ROLES.map((option) => (
          <Chip
            key={option}
            label={t(`role.${option}`)}
            active={role === option}
            onClick={() => {
              setRole(option)
              setPage(1)
            }}
          />
        ))}

        <span className="mx-1 h-5 w-px bg-border-subtle" aria-hidden />

        {(['active', 'inactive'] as const).map((option) => (
          <Chip
            key={option}
            label={t(`status.${option}`)}
            active={status === option}
            onClick={() => {
              setStatus(status === option ? null : option)
              setPage(1)
            }}
          />
        ))}
      </div>

      {/* §5.2 — only the boss reads across branches, so only they get this row. */}
      {isBoss && branches && branches.items.length > 1 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip
            label={t('branchAll')}
            active={branchId === null}
            onClick={() => {
              setBranchId(null)
              setPage(1)
            }}
          />
          {branches.items.map((branch) => (
            <Chip
              key={branch._id}
              label={branch.name.uz}
              active={branchId === branch._id}
              onClick={() => {
                setBranchId(branch._id)
                setPage(1)
              }}
            />
          ))}
        </div>
      ) : null}

      {loading ? <Loading /> : null}
      {error ? <ErrorBox code={error.code} message={error.message} /> : null}

      {data && data.items.length === 0 ? <Empty title={t('none')} Icon={Users} /> : null}

      {data && data.items.length > 0 ? (
        <Panel
          action={<span className="text-2xs text-ink-muted">{t('count', { n: data.total })}</span>}
        >
          <TableShell>
            <thead>
              <tr>
                <Th>{t('person')}</Th>
                <Th>{t('phone')}</Th>
                <Th>{t('rolesLabel')}</Th>
                <Th>{t('statusLabel')}</Th>
                <Th className="text-right">{t('actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => {
                const rowRoles = row.roles.map((assignment) => assignment.role)
                // Self is always editable — that is a profile edit, not a takeover.
                const controllable =
                  row._id === user?.id || mayAdminister(actorRoles, rowRoles)

                return (
                  <tr key={row._id} className="hover:bg-navy-50/50 dark:hover:bg-navy-800/40">
                    <Td>
                      <span className="flex items-center gap-3">
                        <CeramicTile
                          seed={row._id}
                          label={initials(row.fullName)}
                          dense
                          className="size-9 shrink-0 rounded-input"
                        />
                        <span className="flex flex-col">
                          <span className="font-medium text-ink dark:text-white">
                            {row.fullName}
                          </span>
                          {row.email ? (
                            <span className="text-2xs text-ink-muted">{row.email}</span>
                          ) : null}
                        </span>
                      </span>
                    </Td>
                    <Td className="font-mono text-2xs text-ink-soft dark:text-navy-200">
                      {row.phone}
                    </Td>
                    <Td>
                      <span className="flex flex-wrap gap-1.5">
                        {row.roles.map((assignment, index) => (
                          <RolePill
                            key={`${assignment.role}-${index}`}
                            role={assignment.role}
                            label={t(`role.${assignment.role}`)}
                            branch={
                              assignment.role === 'superadmin'
                                ? t('allBranches')
                                : branchName(assignment.branchId)
                            }
                          />
                        ))}
                      </span>
                    </Td>
                    <Td>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            'inline-flex rounded-pill px-2.5 py-1 text-2xs font-medium',
                            row.isActive
                              ? 'bg-success/12 text-success'
                              : 'bg-navy-100 text-ink-muted dark:bg-navy-800',
                          )}
                        >
                          {t(row.isActive ? 'status.active' : 'status.inactive')}
                        </span>
                        {row.twoFactor?.enabled ? (
                          <span
                            title={t('twoFactorOn')}
                            className="inline-flex items-center gap-1 rounded-pill bg-info/12 px-2 py-1 text-2xs text-info"
                          >
                            <ShieldCheck className="size-3" aria-hidden />
                          </span>
                        ) : null}
                      </span>
                    </Td>
                    <Td className="text-right">
                      {controllable ? (
                        <button
                          type="button"
                          onClick={() => setEditing(row)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-border-subtle px-3 text-2xs font-medium text-ink-soft transition-colors hover:border-navy-600/40 hover:text-navy-700 dark:text-navy-200 dark:hover:text-white"
                        >
                          {row.isActive ? (
                            <Pencil className="size-3.5" aria-hidden />
                          ) : (
                            <RotateCcw className="size-3.5" aria-hidden />
                          )}
                          {t('manage')}
                        </button>
                      ) : (
                        <span
                          title={t('outranked')}
                          className="inline-flex items-center gap-1.5 text-2xs text-ink-muted"
                        >
                          <Ban className="size-3.5" aria-hidden />
                          {t('outranked')}
                        </span>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </TableShell>
        </Panel>
      ) : null}

      {data && data.pages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
            className="h-11 rounded-pill border border-border-subtle px-4 text-xs disabled:opacity-40"
          >
            {t('prev')}
          </button>
          <span className="font-mono text-2xs text-ink-muted">
            {page} / {data.pages}
          </span>
          <button
            type="button"
            disabled={page >= data.pages}
            onClick={() => setPage((current) => current + 1)}
            className="h-11 rounded-pill border border-border-subtle px-4 text-xs disabled:opacity-40"
          >
            {t('next')}
          </button>
        </div>
      ) : null}

      {editing ? (
        <UserDialog
          user={editing === 'new' ? null : editing}
          grantable={grantable}
          branches={branches?.items ?? []}
          isSelf={editing !== 'new' && editing._id === user?.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void refetch()
          }}
        />
      ) : null}
    </div>
  )
}

/** Rank read as colour: the higher the role, the warmer the pill. */
const ROLE_TONE: Record<Role, string> = {
  superadmin: 'bg-clay-500/15 text-clay-600 dark:text-clay-300',
  manager: 'bg-navy-600/12 text-navy-700 dark:text-navy-100',
  teacher: 'bg-info/12 text-info',
  student: 'bg-navy-50 text-ink-soft dark:bg-navy-800 dark:text-navy-200',
  parent: 'bg-navy-50 text-ink-soft dark:bg-navy-800 dark:text-navy-200',
}

function RolePill({
  role,
  label,
  branch,
}: {
  role: Role
  label: string
  branch: string | null
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-2xs font-medium',
        ROLE_TONE[role],
      )}
    >
      {label}
      {branch ? <span className="opacity-60">· {branch}</span> : null}
    </span>
  )
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-pill border px-3 py-2 text-2xs font-medium transition-colors',
        active
          ? 'border-transparent bg-navy-600 text-white'
          : 'border-border-subtle text-ink-muted hover:text-navy-700 dark:hover:text-white',
      )}
    >
      {label}
    </button>
  )
}
