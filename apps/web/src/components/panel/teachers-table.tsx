'use client'

import { useId, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  UserSquare2,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  ImagePlus,
  X,
  KeyRound,
  ShieldOff,
  MinusCircle,
} from 'lucide-react'
import { LOCALES, LOCALE_LABELS, type Locale } from '@leader/shared/locales'
import { formatPhone } from '@leader/shared/schemas'
import { useQuery, useMutation, uploadFile, mediaUrl, type Paginated } from '@/lib/api/use-api'
import { useAuth } from '@/lib/auth/auth-context'
import { Panel, TableShell, Th, Td, Loading, ErrorBox, Empty } from './primitives'
import { SearchBox, NewButton, RowAction, Pagination, useDebounced } from './table-kit'
import {
  Dialog,
  Field,
  INPUT,
  Select,
  Toggle,
  LocalizedTabs,
  Checkbox,
  Action,
  DialogError,
  ConfirmDialog,
  Divider,
  type Localized,
} from './form-kit'
import { CeramicTile, initials } from '@/components/ui/ceramic-tile'
import { cn } from '@/lib/utils'

/** What the list returns for a profile's linked login, when it has one. */
type LinkedAccount = { _id: string; fullName: string; phone: string; isActive: boolean }

type TeacherProfile = {
  _id: string
  slug: string
  fullName: string
  role: Localized
  bio?: Localized
  subjects: string[]
  certificates: string[]
  experienceYears: number
  photo?: string
  userId?: LinkedAccount | null
  isPublic: boolean
  order: number
}

type Staff = { _id: string; fullName: string; phone: string }
type Branch = { _id: string; name: { uz: string; ru?: string; en?: string } }

/** How the account half of the dialog is being used on this save. */
type AccountMode = 'open' | 'link' | 'none'

/**
 * TZ §21.1 "Public site content" — the teacher cards the landing page shows,
 * and the one place a teacher's login is opened.
 *
 * A profile is still not an account: the centre wants faces on the site before
 * those people ever sign in, and wants them to stay after someone's login is
 * deactivated, so this is its own record with an optional link to a `User`.
 * What changed is the direction of travel — a teacher account is now opened
 * *from* the card rather than on the Accounts screen, so a teacher can no
 * longer exist as a login with no face on the site.
 */
export function TeachersTable() {
  const t = useTranslations('panel.teacherProfiles')
  const locale = useLocale() as Locale

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<TeacherProfile | 'new' | null>(null)
  const [deleting, setDeleting] = useState<TeacherProfile | null>(null)

  const term = useDebounced(search)
  const query = new URLSearchParams({ page: String(page), limit: '25', sort: 'order' })
  if (term.trim().length >= 2) query.set('search', term.trim())

  const { data, loading, error, refetch } = useQuery<Paginated<TeacherProfile>>(
    `/content/teachers?${query}`,
  )
  const remove = useMutation<undefined, unknown>(
    () => `/content/teachers/${deleting?._id ?? ''}`,
    'DELETE',
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={search} onChange={setSearch} placeholder={t('searchPlaceholder')} />
        <NewButton label={t('create')} onClick={() => setEditing('new')} />
      </div>

      {loading ? <Loading /> : null}
      {error ? <ErrorBox code={error.code} message={error.message} /> : null}
      {data && data.items.length === 0 ? (
        <Empty title={t('none')} hint={t('noneHint')} Icon={UserSquare2} />
      ) : null}

      {data && data.items.length > 0 ? (
        <Panel
          action={<span className="text-2xs text-ink-muted">{t('count', { n: data.total })}</span>}
        >
          <TableShell>
            <thead>
              <tr>
                <Th className="text-right">#</Th>
                <Th>{t('name')}</Th>
                <Th>{t('role')}</Th>
                <Th>{t('subjects')}</Th>
                <Th className="text-right">{t('experience')}</Th>
                <Th>{t('accountColumn')}</Th>
                <Th>{t('visibility')}</Th>
                <Th className="text-right" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((teacher) => (
                <tr key={teacher._id} className="hover:bg-navy-50/50 dark:hover:bg-navy-800/40">
                  <Td className="text-right font-mono text-2xs text-ink-muted">{teacher.order}</Td>
                  <Td>
                    <span className="flex items-center gap-3">
                      <Portrait
                        photo={teacher.photo}
                        seed={teacher._id}
                        name={teacher.fullName}
                        className="size-9"
                      />
                      <span className="flex flex-col">
                        <span className="font-medium text-ink dark:text-white">
                          {teacher.fullName}
                        </span>
                        <span className="font-mono text-2xs text-ink-muted">{teacher.slug}</span>
                      </span>
                    </span>
                  </Td>
                  <Td className="text-2xs text-ink-muted">
                    {teacher.role?.[locale] || teacher.role?.uz}
                  </Td>
                  <Td className="text-2xs text-ink-muted">
                    {teacher.subjects?.length ? teacher.subjects.join(' · ') : '—'}
                  </Td>
                  <Td className="text-right font-mono tabular-nums text-2xs">
                    {teacher.experienceYears ? t('years', { n: teacher.experienceYears }) : '—'}
                  </Td>
                  <Td>
                    <AccountBadge account={teacher.userId} />
                  </Td>
                  <Td>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-2xs font-medium',
                        teacher.isPublic
                          ? 'bg-success/12 text-success'
                          : 'bg-navy-50 text-ink-muted dark:bg-navy-800',
                      )}
                    >
                      {teacher.isPublic ? (
                        <Eye className="size-3" aria-hidden />
                      ) : (
                        <EyeOff className="size-3" aria-hidden />
                      )}
                      {t(teacher.isPublic ? 'visible' : 'hidden')}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <span className="flex justify-end gap-2">
                      <RowAction
                        label={t('edit')}
                        Icon={Pencil}
                        onClick={() => setEditing(teacher)}
                      />
                      <RowAction
                        label={t('delete')}
                        Icon={Trash2}
                        tone="danger"
                        onClick={() => setDeleting(teacher)}
                      />
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Panel>
      ) : null}

      <Pagination page={page} pages={data?.pages ?? 1} onChange={setPage} />

      {editing ? (
        <TeacherDialog
          teacher={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void refetch()
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={t('deleteTitle')}
          body={t('deleteBody', { name: deleting.fullName })}
          confirmLabel={t('delete')}
          pending={remove.pending}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const result = await remove.mutate()
            if (result !== null) {
              setDeleting(null)
              void refetch()
            }
          }}
        />
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * The teacher's face, at whatever size the caller needs.
 *
 * The panel shows the same portrait the site does, so the boss is looking at
 * the public card while they edit it — and the woven tile stays as the fallback
 * for a teacher who has no photo yet, rather than a grey silhouette.
 */
function Portrait({
  photo,
  seed,
  name,
  className,
}: {
  photo?: string
  seed: string
  name: string
  className?: string
}) {
  if (photo) {
    return (
      // The API host is configured at runtime, so a panel portrait cannot go
      // through next/image's remote-pattern allow-list.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={mediaUrl(photo)}
        alt=""
        className={cn('shrink-0 rounded-input object-cover', className)}
      />
    )
  }
  return (
    <CeramicTile
      seed={seed}
      label={initials(name)}
      dense
      className={cn('shrink-0 rounded-input', className)}
    />
  )
}

/** Answers one question in one glance: can this teacher sign in? */
function AccountBadge({ account }: { account?: LinkedAccount | null }) {
  const t = useTranslations('panel.teacherProfiles')

  if (!account) {
    return (
      <span className="inline-flex items-center gap-1.5 text-2xs text-ink-muted">
        <MinusCircle className="size-3" aria-hidden />
        {t('accountNone')}
      </span>
    )
  }
  if (!account.isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 text-2xs text-danger">
        <ShieldOff className="size-3" aria-hidden />
        {t('accountInactive')}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-2xs text-ink-soft dark:text-navy-200">
      <KeyRound className="size-3 text-success" aria-hidden />
      {formatPhone(account.phone)}
    </span>
  )
}

/* -------------------------------------------------------------------------- */

function TeacherDialog({
  teacher,
  onClose,
  onSaved,
}: {
  teacher: TeacherProfile | null
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('panel.teacherProfiles')
  const creating = teacher === null

  /* The card — what a visitor sees. */
  const [fullName, setFullName] = useState(teacher?.fullName ?? '')
  const [slug, setSlug] = useState(teacher?.slug ?? '')
  const [role, setRole] = useState<Localized>(teacher?.role ?? { uz: '' })
  const [bio, setBio] = useState<Localized>(teacher?.bio ?? { uz: '' })
  const [subjects, setSubjects] = useState((teacher?.subjects ?? []).join(', '))
  const [certificates, setCertificates] = useState((teacher?.certificates ?? []).join(', '))
  const [experienceYears, setExperienceYears] = useState(teacher?.experienceYears ?? 0)
  const [photo, setPhoto] = useState(teacher?.photo ?? '')
  const [isPublic, setIsPublic] = useState(teacher?.isPublic ?? true)
  const [order, setOrder] = useState(teacher?.order ?? 0)

  /* The account — how they sign in. */
  const linked = teacher?.userId ?? null
  // Creating, the login is the point of the screen, so the form opens on it.
  // Editing, it is not: someone here to fix a bio should not have to dismiss a
  // password field to save.
  const [mode, setMode] = useState<AccountMode>(creating ? 'open' : 'none')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [branchId, setBranchId] = useState('')
  const [accountLocale, setAccountLocale] = useState<Locale>('uz')
  const [userId, setUserId] = useState('')

  const { data: staff } = useQuery<Paginated<Staff>>('/users?role=teacher&limit=100&status=active')
  const { data: branches } = useQuery<Paginated<Branch>>('/branches?limit=100&sort=slug')
  const save = useMutation<Record<string, unknown>, TeacherProfile>(
    creating ? '/content/teachers' : `/content/teachers/${teacher._id}`,
    creating ? 'POST' : 'PATCH',
  )

  // A slug is a URL, and nobody enjoys inventing one. Derive it from the name
  // on create, and leave it alone afterwards so a published link never moves.
  const onName = (value: string) => {
    setFullName(value)
    if (creating) {
      setSlug(
        value
          .toLowerCase()
          .replace(/['’`]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
      )
    }
  }

  const list = (value: string) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

  const cardReady =
    fullName.trim().length >= 3 && slug.trim().length >= 2 && role.uz.trim().length > 0
  const accountReady =
    mode === 'none' ||
    (mode === 'link' && Boolean(userId)) ||
    (mode === 'open' && phone.trim().length >= 9 && password.length >= 8 && Boolean(branchId))
  const ready = cardReady && accountReady

  return (
    <Dialog title={creating ? t('create') : fullName} onClose={onClose} wide>
      <div className="flex flex-col gap-5">
        {/* ── The card ─────────────────────────────────────────────────── */}
        <SectionHeading title={t('cardSection')} hint={t('cardSectionHint')} />

        <PhotoField
          value={photo}
          seed={teacher?._id ?? 'new'}
          name={fullName}
          onChange={setPhoto}
        />

        <Field label={t('name')} required>
          <input
            value={fullName}
            autoFocus
            onChange={(event) => onName(event.target.value)}
            className={INPUT}
          />
        </Field>

        <Field label={t('slug')} hint={t('slugHint')} required>
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            className={cn(INPUT, 'font-mono')}
          />
        </Field>

        <Field label={t('role')} required>
          <LocalizedTabs value={role} onChange={setRole} />
        </Field>

        <Field label={t('bio')} hint={t('bioHint')}>
          <LocalizedTabs value={bio} onChange={setBio} multiline />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('subjects')} hint={t('listHint')}>
            <input
              value={subjects}
              onChange={(event) => setSubjects(event.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label={t('certificates')} hint={t('listHint')}>
            <input
              value={certificates}
              onChange={(event) => setCertificates(event.target.value)}
              className={INPUT}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('experience')}>
            <input
              type="number"
              min={0}
              max={70}
              value={experienceYears}
              onChange={(event) => setExperienceYears(Number(event.target.value))}
              className={INPUT}
            />
          </Field>
          <Field label={t('order')} hint={t('orderHint')}>
            <input
              type="number"
              value={order}
              onChange={(event) => setOrder(Number(event.target.value))}
              className={INPUT}
            />
          </Field>
        </div>

        <Checkbox
          label={t('publicToggle')}
          hint={t('publicHint')}
          checked={isPublic}
          onChange={setIsPublic}
        />

        <Divider />

        {/* ── The account ──────────────────────────────────────────────── */}
        <SectionHeading title={t('accountSection')} hint={t('accountSectionHint')} />

        {linked ? (
          <LinkedAccountCard account={linked} />
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              <Toggle
                label={t('modeOpen')}
                active={mode === 'open'}
                onClick={() => setMode('open')}
              />
              <Toggle
                label={t('modeLink')}
                active={mode === 'link'}
                onClick={() => setMode('link')}
              />
              <Toggle
                label={t('modeNone')}
                active={mode === 'none'}
                onClick={() => setMode('none')}
              />
            </div>

            {mode === 'open' ? (
              <div className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label={t('phone')}
                    hint={phone.trim() ? formatPhone(phone) : t('phoneHint')}
                    required
                  >
                    <input
                      value={phone}
                      inputMode="tel"
                      placeholder="+998 90 123 45 67"
                      onChange={(event) => setPhone(event.target.value)}
                      className={cn(INPUT, 'font-mono')}
                    />
                  </Field>
                  <Field label={t('password')} hint={t('passwordHint')} required>
                    <input
                      value={password}
                      type="text"
                      onChange={(event) => setPassword(event.target.value)}
                      className={cn(INPUT, 'font-mono')}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t('branch')} hint={t('branchHint')} required>
                    <Select
                      value={branchId}
                      onChange={setBranchId}
                      placeholder={t('chooseBranch')}
                      options={(branches?.items ?? []).map((branch) => ({
                        value: branch._id,
                        label: branch.name.uz,
                      }))}
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
                </div>

                <Field label={t('locale')}>
                  <div className="grid grid-cols-3 gap-2">
                    {LOCALES.map((option) => (
                      <Toggle
                        key={option}
                        label={LOCALE_LABELS[option]}
                        active={accountLocale === option}
                        onClick={() => setAccountLocale(option)}
                      />
                    ))}
                  </div>
                </Field>
              </div>
            ) : null}

            {mode === 'link' ? (
              <Field label={t('account')} hint={t('accountHint')}>
                <Select
                  value={userId}
                  onChange={setUserId}
                  placeholder={t('chooseAccount')}
                  options={(staff?.items ?? []).map((person) => ({
                    value: person._id,
                    label: `${person.fullName} · ${formatPhone(person.phone)}`,
                  }))}
                />
              </Field>
            ) : null}

            {mode === 'none' ? (
              <p className="rounded-input border border-border-subtle bg-background p-3 text-2xs text-ink-muted">
                {t('modeNoneHint')}
              </p>
            ) : null}
          </>
        )}

        {save.error ? <DialogError error={save.error} /> : null}

        <Action
          label={creating ? t('create') : t('save')}
          tone="primary"
          pending={save.pending}
          disabled={!ready}
          onClick={async () => {
            const result = await save.mutate({
              fullName: fullName.trim(),
              slug: slug.trim(),
              role,
              ...(bio.uz?.trim() ? { bio } : {}),
              subjects: list(subjects),
              certificates: list(certificates),
              experienceYears,
              ...(photo.trim() ? { photo: photo.trim() } : {}),
              isPublic,
              order,
              ...(linked
                ? {}
                : mode === 'link' && userId
                  ? { userId }
                  : mode === 'open'
                    ? {
                        account: {
                          phone: phone.trim(),
                          password,
                          branchId,
                          ...(email.trim() ? { email: email.trim() } : {}),
                          locale: accountLocale,
                        },
                      }
                    : {}),
            })
            if (result) onSaved()
          }}
        />
      </div>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */

function SectionHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="font-display text-sm text-ink dark:text-white">{title}</h3>
      <p className="text-2xs text-ink-muted">{hint}</p>
    </div>
  )
}

/**
 * The photo, uploaded where it is shown.
 *
 * A path typed into a text box was a guess about a file the boss could not see;
 * this is the card's own portrait, and pressing it opens the file picker. What
 * is stored is still the `/uploads/...` path the public endpoint returns.
 */
function PhotoField({
  value,
  seed,
  name,
  onChange,
}: {
  value: string
  seed: string
  name: string
  onChange: (url: string) => void
}) {
  const t = useTranslations('panel.teacherProfiles')
  const tu = useTranslations('panel.upload')
  const { getToken } = useAuth()
  const inputId = useId()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-ink-soft dark:text-navy-200">{t('photo')}</span>
      <div className="flex items-center gap-4">
        <label
          htmlFor={inputId}
          className={cn(
            'group relative cursor-pointer overflow-hidden rounded-card border border-dashed border-border-subtle transition-colors hover:border-glaze-500',
            pending && 'pointer-events-none opacity-60',
          )}
        >
          <Portrait photo={value || undefined} seed={seed} name={name || '—'} className="size-24" />
          <span className="absolute inset-0 flex items-center justify-center bg-ink/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {pending ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="size-5" aria-hidden />
            )}
          </span>
        </label>

        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-2xs text-ink-muted">{t('photoHint')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={inputId}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-pill border border-navy-600/25 px-3 text-2xs font-medium text-navy-700 transition-colors hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-800"
            >
              {value ? tu('replace') : tu('choose')}
            </label>
            {value ? (
              <button
                type="button"
                onClick={() => onChange('')}
                className="inline-flex h-9 items-center gap-1.5 rounded-pill px-3 text-2xs text-ink-muted transition-colors hover:text-danger"
              >
                <X className="size-3.5" aria-hidden />
                {t('photoRemove')}
              </button>
            ) : null}
          </div>
          {error ? <span className="text-2xs text-danger">{error}</span> : null}
        </div>
      </div>

      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={pending}
        className="sr-only"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          setPending(true)
          setError(null)
          const token = await getToken()
          const result = await uploadFile(file, token)
          setPending(false)
          if (!result?.url) {
            setError(tu('failed'))
            return
          }
          onChange(result.url)
        }}
      />
    </div>
  )
}

/**
 * An account that already exists is shown, not edited.
 *
 * §8 makes a password reset and a role change sign every device out, so both
 * stay on the Accounts screen where that consequence is spelled out — this is
 * the pointer to it, not a second copy of it.
 */
function LinkedAccountCard({ account }: { account: LinkedAccount }) {
  const t = useTranslations('panel.teacherProfiles')

  return (
    <div className="flex flex-col gap-2 rounded-input border border-border-subtle bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-medium text-ink dark:text-white">
          <KeyRound className="size-3.5 text-success" aria-hidden />
          {account.fullName}
        </span>
        <span className="font-mono text-2xs text-ink-muted">{formatPhone(account.phone)}</span>
      </div>
      <p className="text-2xs text-ink-muted">
        {account.isActive ? t('accountManageHint') : t('accountInactiveHint')}
      </p>
    </div>
  )
}
