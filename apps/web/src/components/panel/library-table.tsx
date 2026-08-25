'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { BookOpen, Pencil, Trash2, Eye, EyeOff, FileText, Music, Video } from 'lucide-react'
import { MATERIAL_TYPES } from '@leader/shared/schemas'
import type { Locale } from '@leader/shared/locales'
import { useQuery, useMutation, type Paginated } from '@/lib/api/use-api'
import { Panel, TableShell, Th, Td, Loading, ErrorBox, Empty } from './primitives'
import { NewButton, RowAction, FilterChip, Pagination } from './table-kit'
import {
  Dialog,
  Field,
  INPUT,
  Select,
  LocalizedTabs,
  Checkbox,
  Action,
  DialogError,
  ConfirmDialog,
  FileUpload,
  type Localized,
} from './form-kit'
import { cn } from '@/lib/utils'

type Course = { _id: string; name: Localized; slug: string }

type Material = {
  _id: string
  title: Localized
  description?: Localized
  type: (typeof MATERIAL_TYPES)[number]
  section: string
  fileUrl: string
  coverUrl?: string
  courseIds: string[]
  order: number
  isPublished: boolean
  isFree: boolean
}

const TYPE_ICONS = { pdf: FileText, audio: Music, video: Video } as const

export function LibraryTable() {
  const t = useTranslations('panel.library')
  const locale = useLocale() as Locale

  const [section, setSection] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Material | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Material | null>(null)

  const query = new URLSearchParams({ page: String(page), limit: '25', sort: 'order' })
  if (section) query.set('section', section)

  const { data, loading, error, refetch } = useQuery<Paginated<Material>>(`/materials?${query}`)
  const remove = useMutation<undefined, unknown>(
    () => `/materials/${deleting?._id ?? ''}`,
    'DELETE',
  )

  const sections = [...new Set((data?.items ?? []).map((item) => item.section))]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            label={t('allSections')}
            active={section === null}
            onClick={() => {
              setSection(null)
              setPage(1)
            }}
          />
          {sections.map((name) => (
            <FilterChip
              key={name}
              label={name}
              active={section === name}
              onClick={() => {
                setSection(name)
                setPage(1)
              }}
            />
          ))}
        </div>
        <span className="flex-1" />
        <NewButton label={t('create')} onClick={() => setEditing('new')} />
      </div>

      {loading ? <Loading /> : null}
      {error ? <ErrorBox code={error.code} message={error.message} /> : null}
      {data && data.items.length === 0 ? <Empty title={t('none')} Icon={BookOpen} /> : null}

      {data && data.items.length > 0 ? (
        <Panel action={<span className="text-2xs text-ink-muted">{t('count', { n: data.total })}</span>}>
          <TableShell>
            <thead>
              <tr>
                <Th>{t('title')}</Th>
                <Th>{t('section')}</Th>
                <Th>{t('typeLabel')}</Th>
                <Th>{t('statusLabel')}</Th>
                <Th className="text-right" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((material) => {
                const Icon = TYPE_ICONS[material.type]
                return (
                  <tr key={material._id} className="hover:bg-navy-50/50 dark:hover:bg-navy-800/40">
                    <Td className="font-medium text-ink dark:text-white">
                      {material.title?.[locale] || material.title?.uz}
                    </Td>
                    <Td className="text-2xs text-ink-muted">{material.section}</Td>
                    <Td>
                      <span className="inline-flex items-center gap-1.5 text-2xs text-ink-muted">
                        <Icon className="size-3.5" aria-hidden />
                        {t(`types.${material.type}`)}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-2xs font-medium',
                          material.isPublished
                            ? 'bg-success/12 text-success'
                            : 'bg-navy-50 text-ink-muted dark:bg-navy-800',
                        )}
                      >
                        {material.isPublished ? (
                          <Eye className="size-3" aria-hidden />
                        ) : (
                          <EyeOff className="size-3" aria-hidden />
                        )}
                        {t(material.isPublished ? 'published' : 'draft')}
                      </span>
                    </Td>
                    <Td className="text-right">
                      <span className="flex justify-end gap-2">
                        <RowAction label={t('edit')} Icon={Pencil} onClick={() => setEditing(material)} />
                        <RowAction
                          label={t('delete')}
                          Icon={Trash2}
                          tone="danger"
                          onClick={() => setDeleting(material)}
                        />
                      </span>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </TableShell>
        </Panel>
      ) : null}

      <Pagination page={page} pages={data?.pages ?? 1} onChange={setPage} />

      {editing ? (
        <MaterialDialog
          material={editing === 'new' ? null : editing}
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
          body={t('deleteBody', { name: deleting.title?.uz ?? '' })}
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

function MaterialDialog({
  material,
  onClose,
  onSaved,
}: {
  material: Material | null
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('panel.library')
  const creating = material === null

  const [title, setTitle] = useState<Localized>(material?.title ?? { uz: '' })
  const [description, setDescription] = useState<Localized>(material?.description ?? { uz: '' })
  const [type, setType] = useState<(typeof MATERIAL_TYPES)[number]>(material?.type ?? 'pdf')
  const [section, setSection] = useState(material?.section ?? '')
  const [fileUrl, setFileUrl] = useState(material?.fileUrl ?? '')
  const [order, setOrder] = useState(material?.order ?? 0)
  const [isPublished, setIsPublished] = useState(material?.isPublished ?? false)
  const [isFree, setIsFree] = useState(material?.isFree ?? false)

  const save = useMutation<Record<string, unknown>, Material>(
    creating ? '/materials' : `/materials/${material._id}`,
    creating ? 'POST' : 'PATCH',
  )

  const acceptFor = (kind: (typeof MATERIAL_TYPES)[number]) => {
    if (kind === 'pdf') return '.pdf,application/pdf'
    if (kind === 'audio') return 'audio/*,.mp3,.m4a,.wav,.ogg'
    return 'video/*,.mp4,.webm,.mov'
  }

  const ready = title.uz.trim().length > 0 && section.trim().length > 0 && fileUrl.trim().length > 0

  return (
    <Dialog title={creating ? t('create') : (title.uz || t('edit'))} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <Field label={t('title')} required>
          <LocalizedTabs value={title} onChange={setTitle} />
        </Field>

        <Field label={t('description')}>
          <LocalizedTabs value={description} onChange={setDescription} multiline />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('typeLabel')} required>
            <Select
              value={type}
              onChange={setType}
              options={MATERIAL_TYPES.map((option) => ({
                value: option,
                label: t(`types.${option}`),
              }))}
            />
          </Field>
          <Field label={t('section')} required hint={t('sectionHint')}>
            <input value={section} onChange={(e) => setSection(e.target.value)} className={INPUT} />
          </Field>
        </div>

        <FileUpload
          label={t('file')}
          accept={acceptFor(type)}
          value={fileUrl}
          onUploaded={setFileUrl}
        />

        <Field label={t('order')}>
          <input
            type="number"
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
            className={INPUT}
          />
        </Field>

        <Checkbox label={t('published')} checked={isPublished} onChange={setIsPublished} />
        <Checkbox label={t('free')} hint={t('freeHint')} checked={isFree} onChange={setIsFree} />

        {save.error ? <DialogError error={save.error} /> : null}

        <Action
          label={creating ? t('create') : t('save')}
          tone="primary"
          pending={save.pending}
          disabled={!ready}
          onClick={async () => {
            const result = await save.mutate({
              title,
              ...(description.uz?.trim() ? { description } : {}),
              type,
              section: section.trim(),
              fileUrl,
              order,
              isPublished,
              isFree,
            })
            if (result) onSaved()
          }}
        />
      </div>
    </Dialog>
  )
}
