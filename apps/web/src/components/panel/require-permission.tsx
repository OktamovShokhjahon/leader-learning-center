'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { ShieldAlert, Loader2 } from 'lucide-react'
import { can, canFully, type Action, type Role } from '@leader/shared/permissions'
import { useRouter } from '@/i18n/navigation'
import { useAuth } from '@/lib/auth/auth-context'

/**
 * TZ §4.3 — "hiding a button in the UI is a convenience, never a security
 * control". This is that convenience, applied at the page level.
 *
 * The API refuses the data either way. What this stops is a teacher who follows
 * a bookmarked `/crm/payments` link landing on a screen that renders three
 * simultaneous 403 boxes and no explanation. It says the one true thing —
 * this section is not for your role — and points at the one that is.
 *
 * An anonymous visitor goes to sign-in instead, which previously only happened
 * on `/account`, because that was the only page mounting `PanelShell`.
 */
export function RequirePermission({
  action,
  full = false,
  roles,
  children,
}: {
  /** Passes for a `full` *or* `limited` grant — the service narrows a limited one. */
  action?: Action
  /** Require a *full* grant instead, for sections a limited grant does not open. */
  full?: boolean
  /** Or an outright role list, for sections the permission map does not name. */
  roles?: Role[]
  children: React.ReactNode
}) {
  const t = useTranslations('panel')
  const router = useRouter()
  const { user, status } = useAuth()

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login')
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60svh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-glaze-600" aria-hidden />
        <span className="sr-only">{t('loading')}</span>
      </div>
    )
  }

  if (!user) return null

  const held = user.roles.map((assignment) => assignment.role)
  const allowed =
    (!action && !roles) ||
    (roles ? roles.some((role) => held.includes(role)) : false) ||
    (action ? held.some((role) => (full ? canFully : can)(role, action)) : false)

  if (!allowed) {
    return (
      <div className="container-site flex min-h-[50svh] flex-col items-center justify-center gap-4 py-16 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-pill bg-warning/12 text-warning">
          <ShieldAlert className="size-6" aria-hidden />
        </span>
        <p className="max-w-md text-sm text-ink-soft dark:text-navy-200">{t('roleMismatch')}</p>
      </div>
    )
  }

  return <>{children}</>
}
