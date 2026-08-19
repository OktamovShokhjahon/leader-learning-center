'use client'

import { Children } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * TZ §25.5 — "one orchestrated page-load sequence: hero elements stagger in
 * over 600 ms". Each direct child is one beat of that sequence.
 */
export function HeroIntro({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion()
  const items = Children.toArray(children)
  const step = 0.6 / Math.max(items.length, 1)

  return (
    <div className="flex flex-col gap-7">
      {items.map((child, index) => (
        <motion.div
          key={index}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{
            duration: 0.7,
            delay: index * step,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  )
}
