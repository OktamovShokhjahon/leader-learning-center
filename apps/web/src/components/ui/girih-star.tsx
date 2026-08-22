import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/**
 * TZ §25.3 — the structural glyph.
 *
 * The eight-point star of Khiva majolica, drawn the way the tilemakers build
 * it: two squares sharing a centre, one turned 45°. It marks every section
 * eyebrow, so the page is punctuated by the motif rather than by a generic dot.
 */
export function GirihStar({
  className,
  style,
  strokeWidth = 1.6,
}: {
  className?: string
  style?: CSSProperties
  strokeWidth?: number
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      className={cn('shrink-0', className)}
      style={style}
      aria-hidden
    >
      <rect x="5" y="5" width="14" height="14" />
      <rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)" />
    </svg>
  )
}
