'use client'

import { motion, useReducedMotion } from 'motion/react'

/**
 * The hero headline, revealed word by word.
 *
 * Each word sits in an `overflow-hidden` line and rises from below it, so the
 * type appears to be *set* rather than to fade in — the clip edge is what makes
 * it read as deliberate rather than as a generic opacity transition.
 *
 * Words, not characters: per-letter staggers on a headline this size run to
 * dozens of animated nodes and read as a gimmick. One word at 55 ms is enough
 * to carry the eye across the line, and the whole reveal stays under 600 ms as
 * §25.5 requires.
 *
 * Under `prefers-reduced-motion` the headline is plain text with no wrappers at
 * all, which also keeps it a single selectable string for a screen reader.
 */
export function HeroHeadline({ text, className }: { text: string; className?: string }) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) return <h1 className={className}>{text}</h1>

  const words = text.split(' ')

  return (
    /*
     * `aria-label` carries the headline for assistive tech, and the split words
     * are hidden from it. A second `sr-only` copy would also work for screen
     * readers but puts the sentence in the DOM twice, and a crawler reading an
     * h1 twice reads it as keyword stuffing.
     */
    <h1 className={className} aria-label={text}>
      <span aria-hidden className="inline">
        {words.map((word, index) => (
          <span key={`${word}-${index}`} className="inline-block overflow-hidden pb-[0.12em] align-bottom">
            <motion.span
              className="inline-block"
              initial={{ y: '110%' }}
              animate={{ y: '0%' }}
              transition={{
                duration: 0.7,
                delay: 0.1 + index * 0.055,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {word}
              {index < words.length - 1 ? ' ' : ''}
            </motion.span>
          </span>
        ))}
      </span>
    </h1>
  )
}
