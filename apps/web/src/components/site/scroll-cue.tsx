'use client'

import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'

/**
 * The cue that there is more below the fold.
 *
 * The hero is a full 100svh portal, so without this the page can read as a
 * finished screen rather than the top of one. A slow 2.4 s loop is enough to
 * catch the eye without pulling at it.
 *
 * It fades out as soon as the visitor starts scrolling — once they know, the
 * cue has done its job and continuing to bob would be noise. Purely decorative,
 * so it is `aria-hidden` and never announced.
 */
export function ScrollCue() {
  const reduceMotion = useReducedMotion()
  const { scrollY } = useScroll()
  // Gone within the first 120 px of travel.
  const opacity = useTransform(scrollY, [0, 120], [1, 0])

  if (reduceMotion) return null

  return (
    <motion.span
      aria-hidden
      style={{ opacity }}
      className="pointer-events-none absolute bottom-5 left-1/2 hidden -translate-x-1/2 md:block"
    >
      <span className="flex h-9 w-5.5 items-start justify-center rounded-pill border border-white/35 p-1">
        <motion.span
          className="block size-1 rounded-full bg-white/70"
          animate={{ y: [0, 12, 0], opacity: [0, 1, 0] }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: [0.25, 1, 0.5, 1],
            times: [0, 0.5, 1],
          }}
        />
      </span>
    </motion.span>
  )
}
