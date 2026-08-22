'use client'

import { Children, useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform, useSpring } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * TZ §25.5 — "one orchestrated page-load sequence: hero elements stagger in over
 * 600 ms". Each direct child is one beat of that sequence.
 *
 * Two things beyond the plain stagger, both cheap and both transform/opacity
 * only:
 *
 *   · a small blur that resolves as each line settles, which hides the rough
 *     edge of a pure fade and makes the type feel like it comes into focus;
 *   · a slow parallax drift as the hero scrolls away, spring-damped so it
 *     tracks the scroll without the twitch raw `scrollY` gives you.
 *
 * Both are dropped entirely under `prefers-reduced-motion` — the content
 * appears, and nothing moves.
 */
export function HeroIntro({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const items = Children.toArray(children)
  const step = 0.6 / Math.max(items.length, 1)

  // 0 → 1 across the hero leaving the viewport.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })
  const damped = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.4 })
  const lift = useTransform(damped, [0, 1], [0, -64])
  const fade = useTransform(damped, [0, 0.75], [1, 0])

  return (
    <motion.div
      ref={ref}
      className="flex flex-col gap-7"
      style={reduceMotion ? undefined : { y: lift, opacity: fade }}
    >
      {items.map((child, index) => (
        <motion.div
          key={index}
          initial={
            reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 24, filter: 'blur(6px)' }
          }
          animate={
            reduceMotion
              ? { opacity: 1 }
              : { opacity: 1, y: 0, filter: 'blur(0px)' }
          }
          transition={{
            duration: 0.75,
            delay: index * step,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}
