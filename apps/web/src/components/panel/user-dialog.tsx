'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, Loader2, UserPlus, Check, KeyRound, Ban, RotateCcw, Plus, Trash2 } from 'lucide-react'
import { ROLE_RANK, type Role } from '@leader/shared/permissions'
import { LOCALES, LOCALE_LABELS, type Locale } from '@leader/shared/locales'
import { formatPhone } from '@leader/shared/schemas'
import { useMutation, type ApiError } from '@/lib/api/use-api'
import { ErrorBox } from './primitives'
import { cn } from '@/lib/utils'

export type PanelUser = {
  _id: string
  fullName: string
  phone: string
  email?: string
  locale?: Locale
  isActive: boolean
  mustChangePassword?: boolean
  twoFactor?: { enabled?: boolean }
  roles: { role: Role; branchId?: string | null }[]
}

type Branch = { _id: string; name: { uz: string; ru?: string; en?: string }; slug: string }

/** A role row being edited. `branchId` is empty for `superadmin`, which is global. */
type RoleDraft = { role: Role; branchId: string }

/**
 * What a fresh role row starts as.
 *
 * A SuperAdmin may grant every role, so the first entry of their grantable list
 * is `superadmin` — a terrible default for a form that opens ordinary
 * accounts. Preferring the lowest rank means the dangerous choice is one the
 * boss has to make on purpose.
 */
function defaultRole(grantable: Role[]): Role {
  const byRank = [...grantable].sort((a, b) => ROLE_RANK[a] - ROLE_RANK[b])
  return byRank.find((role) => role === 'student') ?? byRank[0] ?? 'student'
}

/**
 * A teacher account is opened on the Teachers screen, never here.
 *
 * A teacher who exists as a login and not as a card is invisible to the public
 * site, which is the one thing a teacher record is for. Opening the account
 * from the card makes that impossible. Editing is untouched: an account that
 * already holds the role keeps it on the menu below, so a branch change or a
 * password reset still happens here.
 */
function creatableRoles(grantable: Role[]): Role[] {
  return grantable.filter((role) => role !== 'teacher')
}

/**
 * TZ §23 — the one place an account is opened or changed.
 *
 * Creating and editing share a dialog because they are the same six fields plus
 * a role list; splitting them would mean maintaining the branch picker twice.
 * The editing side is deliberately three separate saves — profile, roles,
 * password — because the API treats them as three separate acts with three
 * different consequences: only a role change and a password reset sign the user
 * out of every device (§8), and burying that inside one "Save" button would
 * make an accidental sign-out impossible to predict.
 */
export function UserDialog({
  user,
  grantable,
  branches,
  isSelf,
  onClose,
  onSaved,
}: {
  user: PanelUser | null
  grantable: Role[]
  branches: Branch[]
  isSelf: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('panel.staff')
  const creating = user === null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={creating ? t('create') : t('manage')}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-t-card bg-surface p-6 shadow-float sm:rounded-card"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-display text-base text-ink dark:text-white">
            {creating ? t('create') : user.fullName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-pill text-ink-muted hover:bg-navy-50 dark:hover:bg-navy-800"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {creating ? (
          <CreateForm grantable={grantable} branches={branches} onSaved={onSaved} />
        ) : (
          <EditForms
            user={user}
            grantable={grantable}
            branches={branches}
            isSelf={isSelf}
            onSaved={onSaved}
          />
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function CreateForm({
  grantable,
  branches,
  onSaved,
}: {
  grantable: Role[]
  branches: Branch[]
  onSaved: () => void
}) {
  const t = useTranslations('panel.staff')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [locale, setLocale] = useState<Locale>('uz')
  const creatable = useMemo(() => creatableRoles(grantable), [grantable])
  const [roles, setRoles] = useState<RoleDraft[]>(() => {
    const role = defaultRole(creatableRoles(grantable))
    return [{ role, branchId: role === 'superadmin' ? '' : (branches[0]?._id ?? '') }]
  })

  const { mutate, pending, error } = useMutation<Record<string, unknown>, PanelUser>('/users')

  const ready =
    fullName.trim().length >= 3 &&
    phone.trim().length >= 9 &&
    password.length >= 8 &&
    roles.every((draft) => draft.role === 'superadmin' || draft.branchId)

  const submit = async () => {
    if (!ready) return
    const created = await mutate({
      fullName: fullName.trim(),
      phone: phone.trim(),
      password,
      ...(email.trim() ? { email: email.trim() } : {}),
      locale,
      roles: roles.map((draft) =>
        draft.role === 'superadmin'
          ? { role: draft.role }
          : { role: draft.role, branchId: draft.branchId },
      ),
    })
    if (created) onSaved()
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label={t('fullName')}>
        <input
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          autoFocus
          className={INPUT}
        />
      </Field>

      <Field label={t('phone')} hint={phone.trim() ? formatPhone(phone) : undefined}>
        <input
          value={phone}
          inputMode="tel"
          placeholder="+998 90 123 45 67"
          onChange={(event) => setPhone(event.target.value)}
          className={cn(INPUT, 'font-mono')}
        />
      </Field>

      <Field label={t('password')} hint={t('passwordHint')}>
        <input
          value={password}
          type="text"
          onChange={(event) => setPassword(event.target.value)}
          className={cn(INPUT, 'font-mono')}
        />
      </Field>

      <Field label={t('email')}>
        <input
          value={email}
          type="email"
          onChange={(event) => setEmail(event.target.value)}
          className={INPUT}
        />
      </Field>

      <Field label={t('locale')}>
        <div className="grid grid-cols-3 gap-2">
          {LOCALES.map((option) => (
            <Toggle
              key={option}
              label={LOCALE_LABELS[option]}
              active={locale === option}
              onClick={() => setLocale(option)}
            />
          ))}
        </div>
      </Field>

      <RoleEditor
        roles={roles}
        setRoles={setRoles}
        grantable={creatable}
        branches={branches}
        label={t('rolesLabel')}
      />

      <p className="-mt-1 text-2xs text-ink-muted">{t('teacherElsewhere')}</p>

      {error ? <DialogError error={error} /> : null}

      <button
        type="button"
        onClick={submit}
        disabled={pending || !ready}
        className="mt-1 inline-flex h-13 w-full items-center justify-center gap-2 rounded-pill bg-clay-500 text-sm font-medium text-white transition-colors hover:bg-clay-400 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <UserPlus className="size-4" aria-hidden />
        )}
        {t('create')}
      </button>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function EditForms({
  user,
  grantable,
  branches,
  isSelf,
  onSaved,
}: {
  user: PanelUser
  grantable: Role[]
  branches: Branch[]
  isSelf: boolean
  onSaved: () => void
}) {
  const t = useTranslations('panel.staff')

  const [fullName, setFullName] = useState(user.fullName)
  const [email, setEmail] = useState(user.email ?? '')
  const [locale, setLocale] = useState<Locale>(user.locale ?? 'uz')
  const [roles, setRoles] = useState<RoleDraft[]>(
    user.roles.map((assignment) => ({
      role: assignment.role,
      branchId: assignment.branchId ?? '',
    })),
  )
  const [newPassword, setNewPassword] = useState('')
  const [saved, setSaved] = useState<string | null>(null)

  const profile = useMutation<Record<string, unknown>, PanelUser>(`/users/${user._id}`, 'PATCH')
  const roleSave = useMutation<{ roles: unknown[] }, PanelUser>(
    `/users/${user._id}/roles`,
    'PATCH',
  )
  const password = useMutation<{ newPassword: string; mustChange: boolean }, unknown>(
    `/users/${user._id}/password`,
  )
  const activation = useMutation<Record<string, unknown>, unknown>(
    `/users/${user._id}`,
    'PATCH',
  )

  /**
   * Every role this account already holds stays on the menu even when the actor
   * could not grant it: dropping it silently would rewrite an Admin into a
   * Teacher the moment someone saved an unrelated branch change.
   */
  const roleOptions = useMemo(() => {
    const held = user.roles.map((assignment) => assignment.role)
    return Array.from(new Set([...grantable, ...held]))
  }, [grantable, user.roles])

  const rolesChanged =
    JSON.stringify(roles) !==
    JSON.stringify(
      user.roles.map((a) => ({ role: a.role, branchId: a.branchId ?? '' })),
    )

  const anyError =
    profile.error ?? roleSave.error ?? password.error ?? activation.error ?? null

  return (
    <div className="flex flex-col gap-6">
      {/* Profile — no session consequence, so it saves on its own. */}
      <section className="flex flex-col gap-4">
        <Field label={t('fullName')}>
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className={INPUT}
          />
        </Field>

        <Field label={t('email')}>
          <input
            value={email}
            type="email"
            onChange={(event) => setEmail(event.target.value)}
            className={INPUT}
          />
        </Field>

        <Field label={t('locale')}>
          <div className="grid grid-cols-3 gap-2">
            {LOCALES.map((option) => (
              <Toggle
                key={option}
                label={LOCALE_LABELS[option]}
                active={locale === option}
                onClick={() => setLocale(option)}
              />
            ))}
          </div>
        </Field>

        <Action
          label={t('saveProfile')}
          Icon={Check}
          pending={profile.pending}
          onClick={async () => {
            const result = await profile.mutate({
              fullName: fullName.trim(),
              email: email.trim(),
              locale,
            })
            if (result) {
              setSaved('profile')
              onSaved()
            }
          }}
        />
      </section>

      <Divider />

      {/* Roles — §8: saving this signs the account out of every device. */}
      <section className="flex flex-col gap-4">
        <RoleEditor
          roles={roles}
          setRoles={setRoles}
          grantable={roleOptions}
          branches={branches}
          label={t('rolesLabel')}
          disabled={isSelf}
        />
        {isSelf ? (
          <p className="text-2xs text-ink-muted">{t('cannotEditOwnRoles')}</p>
        ) : (
          <>
            <p className="text-2xs text-ink-muted">{t('rolesSignOutWarning')}</p>
            <Action
              label={t('saveRoles')}
              Icon={Check}
              pending={roleSave.pending}
              disabled={!rolesChanged}
              onClick={async () => {
                const result = await roleSave.mutate({
                  roles: roles.map((draft) =>
                    draft.role === 'superadmin'
                      ? { role: draft.role }
                      : { role: draft.role, branchId: draft.branchId },
                  ),
                })
                if (result) {
                  setSaved('roles')
                  onSaved()
                }
              }}
            />
          </>
        )}
      </section>

      <Divider />

      {/* Password — the account must change it at next login (§8). */}
      <section className="flex flex-col gap-4">
        <Field label={t('newPassword')} hint={t('resetHint')}>
          <input
            value={newPassword}
            type="text"
            onChange={(event) => setNewPassword(event.target.value)}
            className={cn(INPUT, 'font-mono')}
          />
        </Field>
        <Action
          label={t('resetPassword')}
          Icon={KeyRound}
          pending={password.pending}
          disabled={newPassword.length < 8}
          onClick={async () => {
            const result = await password.mutate({ newPassword, mustChange: true })
            if (result !== null) {
              setNewPassword('')
              setSaved('password')
            }
          }}
        />
      </section>

      {!isSelf ? (
        <>
          <Divider />
          {/* Deactivation, not deletion — years of records point at this account. */}
          <Action
            tone="danger"
            label={user.isActive ? t('deactivate') : t('reactivate')}
            Icon={user.isActive ? Ban : RotateCcw}
            pending={activation.pending}
            onClick={async () => {
              const result = await activation.mutate({ isActive: !user.isActive })
              if (result) {
                setSaved('activation')
                onSaved()
              }
            }}
          />
          <p className="-mt-2 text-2xs text-ink-muted">{t('deactivateHint')}</p>
        </>
      ) : null}

      {anyError ? <DialogError error={anyError} /> : null}
      {saved && !anyError ? (
        <p className="flex items-center gap-2 rounded-input border border-success/30 bg-success/5 p-3 text-2xs text-success">
          <Check className="size-3.5" aria-hidden />
          {t('saved')}
        </p>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/** §4.1 — one role per branch, so each row is a role and the branch it applies in. */
function RoleEditor({
  roles,
  setRoles,
  grantable,
  branches,
  label,
  disabled = false,
}: {
  roles: RoleDraft[]
  setRoles: (next: RoleDraft[]) => void
  grantable: Role[]
  branches: Branch[]
  label: string
  disabled?: boolean
}) {
  const t = useTranslations('panel.staff')

  const update = (index: number, patch: Partial<RoleDraft>) =>
    setRoles(roles.map((draft, at) => (at === index ? { ...draft, ...patch } : draft)))

  return (
    <Field label={label}>
      <div className="flex flex-col gap-2">
        {roles.map((draft, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <select
              value={draft.role}
              disabled={disabled}
              onChange={(event) => {
                const role = event.target.value as Role
                // SuperAdmin is global (§4.1) and carries no branch at all.
                update(index, { role, branchId: role === 'superadmin' ? '' : draft.branchId })
              }}
              className={cn(INPUT, 'h-11 min-w-32 flex-1')}
            >
              {grantable.map((option) => (
                <option key={option} value={option}>
                  {t(`role.${option}`)}
                </option>
              ))}
            </select>

            {draft.role === 'superadmin' ? (
              <span className="flex h-11 flex-1 items-center px-2 text-2xs text-ink-muted">
                {t('allBranches')}
              </span>
            ) : (
              <select
                value={draft.branchId}
                disabled={disabled}
                onChange={(event) => update(index, { branchId: event.target.value })}
                className={cn(INPUT, 'h-11 min-w-32 flex-1')}
              >
                <option value="">{t('chooseBranch')}</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name.uz}
                  </option>
                ))}
              </select>
            )}

            {roles.length > 1 && !disabled ? (
              <button
                type="button"
                aria-label={t('removeRole')}
                onClick={() => setRoles(roles.filter((_, at) => at !== index))}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-input border border-border-subtle text-ink-muted hover:border-danger/40 hover:text-danger"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>
        ))}

        {!disabled ? (
          <button
            type="button"
            onClick={() => setRoles([...roles, { role: defaultRole(grantable), branchId: '' }])}
            className="inline-flex h-10 w-fit items-center gap-1.5 rounded-pill border border-dashed border-border-subtle px-3 text-2xs text-ink-muted hover:border-navy-600/40 hover:text-navy-700 dark:hover:text-white"
          >
            <Plus className="size-3.5" aria-hidden />
            {t('addRole')}
          </button>
        ) : null}
      </div>
    </Field>
  )
}

/* -------------------------------------------------------------------------- */

const INPUT =
  'w-full rounded-input border border-border-subtle bg-background px-4 py-3 text-sm text-ink outline-none focus:border-glaze-500 dark:text-white'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-soft dark:text-navy-200">{label}</span>
      {children}
      {hint ? <span className="text-2xs text-ink-muted">{hint}</span> : null}
    </label>
  )
}

function Toggle({
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
        'h-11 rounded-input border text-xs font-medium transition-colors',
        active
          ? 'border-transparent bg-navy-600 text-white'
          : 'border-border-subtle text-ink-soft hover:border-navy-600/40 dark:text-navy-200',
      )}
    >
      {label}
    </button>
  )
}

function Action({
  label,
  Icon,
  pending,
  disabled = false,
  tone = 'default',
  onClick,
}: {
  label: string
  Icon: typeof Check
  pending: boolean
  disabled?: boolean
  tone?: 'default' | 'danger'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending || disabled}
      className={cn(
        'inline-flex h-12 w-full items-center justify-center gap-2 rounded-pill border text-xs font-medium transition-colors disabled:opacity-50',
        tone === 'danger'
          ? 'border-danger/30 text-danger hover:bg-danger/10'
          : 'border-navy-600/25 text-navy-700 hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-800',
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Icon className="size-4" aria-hidden />
      )}
      {label}
    </button>
  )
}

function Divider() {
  return <span className="h-px w-full bg-border-subtle" aria-hidden />
}

/**
 * `VALIDATION_FAILED` carries a per-field map of i18n keys (§21.2), and for this
 * form those fields are the whole message — "password too common" is useless as
 * a generic "something went wrong".
 */
function DialogError({ error }: { error: ApiError }) {
  const t = useTranslations('validation')
  const details = error.details as Record<string, string[]> | undefined

  if (error.code === 'VALIDATION_FAILED' && details) {
    return (
      <ul role="alert" className="flex flex-col gap-1 rounded-input border border-danger/30 bg-danger/5 p-3 text-2xs text-danger">
        {Object.entries(details).map(([field, messages]) => (
          <li key={field}>{messages.map((key) => (t.has(key) ? t(key) : key)).join(' · ')}</li>
        ))}
      </ul>
    )
  }
  return <ErrorBox code={error.code} message={error.message} />
}
