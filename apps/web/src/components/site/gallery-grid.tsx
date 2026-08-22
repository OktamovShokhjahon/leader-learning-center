'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { CeramicTile } from '@/components/ui/ceramic-tile'
import { cn } from '@/lib/utils'

export type GalleryEntry = {
  id: string
  caption: string
  image: string | null
}

/**
 * TZ §6.1 — the gallery, with a lightbox.
 *
 * Items with no photograph yet render as ceramic tiles rather than empty
 * frames, so an album reads as designed while the photo session is pending.
 *
 * The lightbox is a real dialog: Escape closes it, arrows move between items,
 * focus is trapped by `<dialog>`'s own modal behaviour, and the page behind is
 * locked from scrolling.
 */
export function GalleryGrid({ entries, label }: { entries: GalleryEntry[]; label: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const close = useCallback(() => setOpenIndex(null), [])
  const move = useCallback(
    (delta: number) =>
      setOpenIndex((current) =>
        current === null ? null : (current + delta + entries.length) % entries.length,
      ),
    [entries.length],
  )

  useEffect(() => {
    if (openIndex === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
      if (event.key === 'ArrowRight') move(1)
      if (event.key === 'ArrowLeft') move(-1)
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [openIndex, close, move])

  const open = openIndex === null ? null : entries[openIndex]

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {entries.map((entry, index) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              className="group block w-full overflow-hidden rounded-card border border-border-subtle transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1"
            >
              {entry.image ? (
                <Image
                  src={entry.image}
                  alt={entry.caption}
                  width={480}
                  height={360}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <CeramicTile seed={entry.id} className="aspect-[4/3] w-full" />
              )}
              <span className="block bg-surface px-3 py-2.5 text-left text-2xs text-ink-soft dark:text-navy-200">
                {entry.caption}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/85 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            aria-label={label}
            className="absolute right-4 top-4 inline-flex size-11 items-center justify-center rounded-pill text-white/80 transition-colors hover:bg-white/12 hover:text-white"
          >
            <X className="size-5" aria-hidden />
          </button>

          <NavButton side="left" onClick={() => move(-1)} />
          <NavButton side="right" onClick={() => move(1)} />

          <figure
            className="flex max-h-full w-full max-w-3xl flex-col gap-4"
            onClick={(event) => event.stopPropagation()}
          >
            {open.image ? (
              <Image
                src={open.image}
                alt={open.caption}
                width={1280}
                height={960}
                className="w-full rounded-card object-contain"
              />
            ) : (
              <CeramicTile seed={open.id} className="aspect-[4/3] w-full rounded-card" />
            )}
            <figcaption className="text-center text-sm text-white/80">{open.caption}</figcaption>
          </figure>
        </div>
      ) : null}
    </>
  )
}

function NavButton({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        'absolute top-1/2 z-10 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-pill text-white/70 transition-colors hover:bg-white/12 hover:text-white',
        side === 'left' ? 'left-2 sm:left-6' : 'right-2 sm:right-6',
      )}
    >
      <Icon className="size-6" aria-hidden />
    </button>
  )
}
