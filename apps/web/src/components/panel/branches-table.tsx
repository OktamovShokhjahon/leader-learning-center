'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Building2, Pencil, Archive, MapPin } from 'lucide-react'
import type { Locale } from '@leader/shared/locales'
import { useQuery, useMutation, type Paginated } from '@/lib/api/use-api'
import { Panel, TableShell, Th, Td, Loading, ErrorBox, Empty } from './primitives'
import { NewButton, RowAction } from './table-kit'
import {
  Dialog,
  Field,
  INPUT,
  LocalizedTabs,
  Action,
  DialogError,
  ConfirmDialog,
  type Localized,
} from './form-kit'
import { cn } from '@/lib/utils'

type Branch = {
  _id: string
  slug: string
  name: Localized
  city?: Localized
  address?: Localized
  workingHours?: Localized
  phones?: string[]
  email?: string
  isActive: boolean
}

/**
 * TZ §5.3 / §21.1 — branches.
 *
 * The API has had full CRUD since Phase 1 and there was no screen for it, so a
 * second branch could only be opened by inserting a document. Since §5 calls
 * multi-branch "a core requirement, not an add-on", that gap made the core
 * feature unusable by the person who owns it.
 */
export function BranchesTable() {
  const t = useTranslations('panel.branches')
  const locale = useLocale() as Locale

  const [editing, setEditing] = useState<Branch | 'new' | null>(null)
  const [archiving, setArchiving] = useState<Branch | null>(null)

  const { data, loading, error, refetch } = useQuery<Paginated<Branch>>('/branches?limit=100')
  const archive = useMutation<undefined, unknown>(
    () => `/branches/${archiving?._id ?? ''}`,
    'DELETE',
  )

  const label = (value?: Localized) => value?.[locale] || value?.uz || '—'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-2xs text-ink-muted">{t('count', { n: data?.total ?? 0 })}</span>
        <NewButton label={t('create')} onClick={() => setEditing('new')} />
      </div>

      {loading ? <Loading /> : null}
      {error ? <ErrorBox code={error.code} message={error.message} /> : null}
      {data && data.items.length === 0 ? <Empty title={t('none')} Icon={Building2} /> : null}

      {data && data.items.length > 0 ? (
        <Panel>
          <TableShell>
            <thead>
              <tr>
                <Th>{t('name')}</Th>
                <Th>{t('address')}</Th>
                <Th>{t('phones')}</Th>
                <Th>{t('statusLabel')}</Th>
                <Th className="text-right" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((branch) => (
                <tr key={branch._id} className="hover:bg-navy-50/50 dark:hover:bg-navy-800/40">
                  <Td>
                    <span className="font-medium text-ink dark:text-white">
                      {label(branch.name)}
                    </span>
                    <span className="ml-2 font-mono text-2xs text-ink-muted">{branch.slug}</span>
                  </Td>
                  <Td className="text-2xs text-ink-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3" aria-hidden />
                      {label(branch.address)}
                    </span>
                  </Td>
                  <Td className="font-mono text-2xs text-ink-soft dark:text-navy-200">
                    {branch.phones?.join(', ') || '—'}
                  </Td>
                  <Td>
                    <span
                      className={cn(
                        'inline-flex rounded-pill px-2.5 py-1 text-2xs font-medium',
                        branch.isActive
                          ? 'bg-success/12 text-success'
                          : 'bg-navy-100 text-ink-muted dark:bg-navy-800',
                      )}
                    >
                      {t(branch.isActive ? 'active' : 'archived')}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <span className="flex justify-end gap-2">
                      <RowAction label={t('edit')} Icon={Pencil} onClick={() => setEditing(branch)} />
                      {branch.isActive ? (
                        <RowAction
                          label={t('archive')}
                          Icon={Archive}
                          tone="danger"
                          onClick={() => setArchiving(branch)}
                        />
                      ) : null}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Panel>
      ) : null}

      {editing ? (
        <BranchDialog
          branch={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void refetch()
          }}
        />
      ) : null}

      {archiving ? (
        <ConfirmDialog
          title={t('archiveTitle')}
          body={t('archiveBody', { name: label(archiving.name) })}
          confirmLabel={t('archive')}
          pending={archive.pending}
          onClose={() => setArchiving(null)}
          onConfirm={async () => {
            const result = await archive.mutate()
            if (result !== null) {
              setArchiving(null)
              void refetch()
            }
          }}
        />
      ) : null}
    </div>
  )
}

function BranchDialog({
  branch,
  onClose,
  onSaved,
}: {
  branch: Branch | null
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('panel.branches')
  const creating = branch === null

  const [name, setName] = useState<Localized>(branch?.name ?? { uz: '' })
  const [city, setCity] = useState<Localized>(branch?.city ?? { uz: '' })
  const [address, setAddress] = useState<Localized>(branch?.address ?? { uz: '' })
  const [workingHours, setWorkingHours] = useState<Localized>(branch?.workingHours ?? { uz: '' })
  const [slug, setSlug] = useState(branch?.slug ?? '')
  const [phones, setPhones] = useState((branch?.phones ?? []).join(', '))
  const [email, setEmail] = useState(branch?.email ?? '')

  const save = useMutation<Record<string, unknown>, Branch>(
    creating ? '/branches' : `/branches/${branch._id}`,
    creating ? 'POST' : 'PATCH',
  )

  return (
    <Dialog title={creating ? t('create') : (name.uz || t('edit'))} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <Field label={t('name')} required>
          <LocalizedTabs value={name} onChange={setName} />
        </Field>

        <Field label={t('slug')} hint={t('slugHint')} required>
          <input
            value={slug}
            disabled={!creating}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="urganch-markaz"
            className={cn(INPUT, 'font-mono')}
          />
        </Field>

        <Field label={t('city')}>
          <LocalizedTabs value={city} onChange={setCity} />
        </Field>

        <Field label={t('address')}>
          <LocalizedTabs value={address} onChange={setAddress} />
        </Field>

        <Field label={t('workingHours')}>
          <LocalizedTabs value={workingHours} onChange={setWorkingHours} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('phones')} hint={t('phonesHint')}>
            <input
              value={phones}
              onChange={(event) => setPhones(event.target.value)}
              className={cn(INPUT, 'font-mono')}
            />
          </Field>
          <Field label={t('email')}>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={INPUT}
            />
          </Field>
        </div>

        {save.error ? <DialogError error={save.error} /> : null}

        <Action
          label={creating ? t('create') : t('save')}
          tone="primary"
          pending={save.pending}
          disabled={name.uz.trim().length === 0 || slug.trim().length < 2}
          onClick={async () => {
            const result = await save.mutate({
              name,
              ...(creating ? { slug: slug.trim() } : {}),
              ...(city.uz?.trim() ? { city } : {}),
              ...(address.uz?.trim() ? { address } : {}),
              ...(workingHours.uz?.trim() ? { workingHours } : {}),
              phones: phones
                .split(',')
                .map((phone) => phone.trim())
                .filter(Boolean),
              ...(email.trim() ? { email: email.trim() } : {}),
            })
            if (result) onSaved()
          }}
        />
      </div>
    </Dialog>
  )
}
