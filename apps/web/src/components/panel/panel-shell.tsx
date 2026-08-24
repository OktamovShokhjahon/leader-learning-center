'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { LogOut, Loader2, ShieldCheck, ShieldAlert, MonitorSmartphone } from 'lucide-react'
import type { Role } from '@leader/shared/permissions'
import { useRouter } from '@/i18n/navigation'
import { useAuth, apiFetch } from '@/lib/auth/auth-context'
import { GirihStar } from '@/components/ui/girih-star'
import { cn } from '@/lib/utils'
import { describeDevice } from '@/lib/auth/device-name'

type Session = {
  id: string
  deviceName: string | null
  userAgent: string | null
  ip: string | null
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string
  isCurrent: boolean
}

/**
 * The signed-in shell.
 *
 * This is not the CRM — students, groups, attendance, payments and the finance
 * dashboard are Phases 1–5 and are not built. What it does do is make the login
 * real: it proves who you are signed in as, which roles and branches you hold,
 * and which devices hold a live session, and it lets you end any of them.
 *
 * "Faol qurilmalar" is TZ §8 / PIC 10, so this is a genuine requirement
 * delivered early rather than a placeholder.
 */
/** `expectedRole` is omitted on /account, which every signed-in role may open. */
export function PanelShell({ expectedRole }: { expectedRole?: Role[] }) {
  const t = useTranslations('panel')
  const router = useRouter()
  const { user, status, signOut, getToken } = useAuth()

  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Guard: an anonymous visitor goes to the sign-in page, not a blank shell.
  useEffect(() => {
    if (status === 'anonymous') router.replace('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    let cancelled = false
    void (async () => {
      const token = await getToken()
      const response = await apiFetch('/auth/sessions', token)
      if (!response.ok || cancelled) return
      const body = await response.json().catch(() => null)
      if (!cancelled) setSessions(body?.data ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [status, getToken])

  const endSession = async (id: string) => {
    setBusyId(id)
    try {
      const token = await getToken()
      const response = await apiFetch(`/auth/sessions/${id}`, token, { method: 'DELETE' })
      if (response.ok) setSessions((current) => current?.filter((s) => s.id !== id) ?? null)
    } finally {
      setBusyId(null)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60svh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-glaze-600" aria-hidden />
        <span className="sr-only">{t('loading')}</span>
      </div>
    )
  }

  if (!user) return null

  const roleMismatch =
    Boolean(expectedRole) && !user.roles.some((a) => expectedRole!.includes(a.role))

  return (
    <div className="container-site flex flex-col gap-8 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2.5 text-2xs font-medium uppercase tracking-[0.18em] text-glaze-700 dark:text-glaze-300">
            <GirihStar className="size-3.5 text-clay-500" />
            {t('eyebrow')}
          </p>
          <h1 className="display-section text-ink dark:text-white">{user.fullName}</h1>
          <p className="font-mono text-xs text-ink-muted">{user.phone}</p>
        </div>

        <button
          type="button"
          onClick={async () => {
            await signOut()
            router.replace('/login')
          }}
          className="inline-flex h-12 items-center gap-2 rounded-pill border border-navy-600/25 px-5 text-xs font-medium text-navy-700 transition-colors duration-200 hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-800"
        >
          <LogOut className="size-4" aria-hidden />
          {t('signOut')}
        </button>
      </header>

      {/* The panel this account actually belongs in, if it is not this one. */}
      {roleMismatch ? (
        <p className="flex items-start gap-2 rounded-input border border-warning/30 bg-warning/5 p-4 text-xs text-warning">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('roleMismatch')}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Roles and branches — §4.1, one role per branch. */}
        <section className="panel-frame-ink flex flex-col gap-4 rounded-card bg-surface p-6">
          <h2 className="font-display text-base text-ink dark:text-white">{t('access')}</h2>
          <ul className="flex flex-col gap-2">
            {user.roles.map((assignment, index) => (
              <li
                key={`${assignment.role}-${index}`}
                className="flex items-center justify-between gap-4 border-b border-border-subtle pb-2 text-xs last:border-b-0 last:pb-0"
              >
                <span className="font-medium text-ink dark:text-white">
                  {t(`roles.${assignment.role}`)}
                </span>
                <span className="text-ink-muted">
                  {assignment.branchName ?? t('allBranches')}
                </span>
              </li>
            ))}
          </ul>

          <p className="flex items-center gap-2 pt-1 text-2xs text-ink-muted">
            {user.twoFactorEnabled ? (
              <ShieldCheck className="size-4 text-success" aria-hidden />
            ) : (
              <ShieldAlert className="size-4 text-warning" aria-hidden />
            )}
            {user.twoFactorEnabled ? t('twoFactorOn') : t('twoFactorOff')}
          </p>
        </section>

        {/* Faol qurilmalar — §8 / PIC 10. */}
        <section className="panel-frame-ink flex flex-col gap-4 rounded-card bg-surface p-6">
          <h2 className="flex items-center gap-2 font-display text-base text-ink dark:text-white">
            <MonitorSmartphone className="size-4.5 text-glaze-600" aria-hidden />
            {t('devices')}
          </h2>

          {sessions === null ? (
            <p className="text-xs text-ink-muted">{t('loading')}</p>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-ink-muted">{t('noDevices')}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex items-center justify-between gap-4 border-b border-border-subtle pb-3 last:border-b-0 last:pb-0"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-xs font-medium text-ink dark:text-white">
                      {session.deviceName ||
                        describeDevice(session.userAgent ?? '') ||
                        t('unknownDevice')}
                      {session.isCurrent ? (
                        <span className="ml-2 rounded-pill bg-success/15 px-2 py-0.5 text-2xs text-success">
                          {t('thisDevice')}
                        </span>
                      ) : null}
                    </span>
                    <span className="font-mono text-2xs text-ink-muted">{session.ip ?? '—'}</span>
                  </span>

                  {!session.isCurrent ? (
                    <button
                      type="button"
                      onClick={() => endSession(session.id)}
                      disabled={busyId === session.id}
                      className={cn(
                        'shrink-0 rounded-pill border border-danger/30 px-3 py-1.5 text-2xs font-medium text-danger transition-colors duration-200',
                        busyId === session.id ? 'opacity-50' : 'hover:bg-danger/10',
                      )}
                    >
                      {t('endSession')}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Passwords are issued and rotated by an administrator from the Accounts
          screen; there is no self-service change anywhere on the site. */}
      <p className="rounded-card border border-dashed border-border-subtle bg-surface/50 p-6 text-xs leading-relaxed text-ink-soft dark:text-navy-200">
        {t('passwordPolicy')}
      </p>
    </div>
  )
}
