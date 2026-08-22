import { cn } from '@/lib/utils'

/**
 * The stand-in for a photograph.
 *
 * The client has not run a photo session yet (§31 Q15), and a grey box with a
 * camera icon reads as broken. This renders a glazed majolica tile instead: the
 * course/branch accent under the girih lattice, with optional initials cut into
 * it. It is a deliberate graphic, so a page full of them still looks designed.
 *
 * Swap for `next/image` the moment real photographs exist — the component keeps
 * the same box, so nothing around it has to change.
 */
const GRADIENTS = [
  'from-navy-600 via-glaze-600 to-aqua-500',
  'from-navy-700 via-navy-500 to-glaze-500',
  'from-glaze-600 via-aqua-500 to-aqua-300',
  'from-clay-500 via-clay-400 to-glaze-500',
  'from-navy-800 via-glaze-700 to-glaze-500',
  'from-glaze-700 via-glaze-500 to-aqua-400',
  'from-navy-600 via-navy-400 to-aqua-400',
  'from-clay-600 via-clay-500 to-navy-500',
] as const

/** Stable per seed, so a given teacher or album keeps its tile across renders. */
function hash(seed: string): number {
  let value = 0
  for (let index = 0; index < seed.length; index += 1) {
    value = (value * 31 + seed.charCodeAt(index)) >>> 0
  }
  return value
}

export function CeramicTile({
  seed,
  label,
  className,
  dense = false,
}: {
  seed: string
  /** Usually initials. Omitted for pure texture. */
  label?: string
  className?: string
  /** Half-scale lattice, for tiles smaller than about 200px. */
  dense?: boolean
}) {
  const gradient = GRADIENTS[hash(seed) % GRADIENTS.length]

  return (
    <div
      aria-hidden
      className={cn(
        'relative flex items-center justify-center overflow-hidden bg-gradient-to-br',
        gradient,
        className,
      )}
    >
      <div
        className={cn(
          'absolute inset-0 text-white/15 transition-colors duration-300 group-hover:text-white/25',
          'tile-star',
          dense && 'tile-star-sm',
        )}
      />
      {label ? (
        <span className="relative font-display text-2xl font-semibold tracking-[-0.03em] text-white/85">
          {label}
        </span>
      ) : null}
    </div>
  )
}

/** "Aziza Yusupova" → "AY". Falls back to the first character for one-word names. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase()
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
}
