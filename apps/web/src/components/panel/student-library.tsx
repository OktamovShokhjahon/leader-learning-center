'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { BookOpen, FileText, Music, Video, X } from 'lucide-react'
import type { Locale } from '@leader/shared/locales'
import { useQuery, mediaUrl } from '@/lib/api/use-api'
import { Loading, ErrorBox, Empty } from './primitives'
import { cn } from '@/lib/utils'

type Localized = { uz: string; ru?: string; en?: string }

type Material = {
  _id: string
  title: Localized
  description?: Localized
  type: 'pdf' | 'audio' | 'video'
  section: string
  fileUrl: string
  coverUrl?: string
}

const TYPE_ICONS = { pdf: FileText, audio: Music, video: Video } as const

export function StudentLibrary() {
  const t = useTranslations('panel.library')
  const locale = useLocale() as Locale
  const [open, setOpen] = useState<Material | null>(null)

  const { data, loading, error } = useQuery<Material[]>('/materials/mine')

  if (loading) return <Loading />
  if (error) return <ErrorBox code={error.code} message={error.message} />
  if (!data || data.length === 0) return <Empty title={t('noneStudent')} Icon={BookOpen} />

  const label = (value: Localized | undefined) => value?.[locale] || value?.uz || ''

  const bySection = new Map<string, Material[]>()
  for (const material of data) {
    if (!bySection.has(material.section)) bySection.set(material.section, [])
    bySection.get(material.section)!.push(material)
  }

  return (
    <div className="flex flex-col gap-8">
      {[...bySection.entries()].map(([section, items]) => (
        <section key={section} className="flex flex-col gap-4">
          <h2 className="border-b border-border-subtle pb-2 font-display text-sm text-ink dark:text-white">
            {section}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((material) => {
              const Icon = TYPE_ICONS[material.type]
              return (
                <li key={material._id}>
                  <button
                    type="button"
                    onClick={() => setOpen(material)}
                    className="group flex h-full w-full flex-col gap-3 rounded-card border border-border-subtle bg-surface p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-glaze-300 hover:shadow-float"
                  >
                    <span className="flex aspect-[3/4] items-center justify-center rounded-input bg-navy-100 dark:bg-navy-800">
                      <Icon className="size-10 text-navy-400" aria-hidden />
                    </span>
                    <span className="text-xs font-medium text-ink dark:text-white">
                      {label(material.title)}
                    </span>
                    <span className="text-2xs text-ink-muted">{t(`types.${material.type}`)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {open ? <Reader material={open} onClose={() => setOpen(null)} label={label(open.title)} /> : null}
    </div>
  )
}

function Reader({
  material,
  onClose,
  label,
}: {
  material: Material
  onClose: () => void
  label: string
}) {
  const t = useTranslations('panel.library')
  const src = mediaUrl(material.fileUrl)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'flex w-full flex-col gap-4 rounded-card bg-surface p-5 shadow-float',
          material.type === 'pdf' ? 'max-w-5xl' : 'max-w-4xl',
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-base text-ink dark:text-white">{label}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-pill text-ink-muted hover:bg-navy-50 dark:hover:bg-navy-800"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {material.type === 'pdf' ? (
          <iframe src={src} title={label} className="h-[70vh] w-full rounded-input border-0" />
        ) : material.type === 'audio' ? (
          <audio src={src} controls className="w-full" controlsList="nodownload" />
        ) : (
          <video
            src={src}
            controls
            controlsList="nodownload"
            disablePictureInPicture
            onContextMenu={(e) => e.preventDefault()}
            className="aspect-video w-full rounded-input bg-black"
          />
        )}
      </div>
    </div>
  )
}
