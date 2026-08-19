import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * TZ §25.6 — touch targets ≥ 44 px, visible focus rings, AA contrast.
 * The `primary` variant carries the signature gradient (§25.2).
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'gradient-glaze text-white shadow-raise hover:shadow-float hover:brightness-110 active:brightness-95',
        secondary: 'bg-navy-600 text-white hover:bg-navy-700 active:bg-navy-800',
        clay: 'bg-clay-500 text-white hover:bg-clay-600 active:bg-clay-700',
        outline:
          'border border-navy-600/25 bg-transparent text-navy-700 hover:border-navy-600/50 hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-800',
        ghost: 'bg-transparent text-navy-700 hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-800',
        onDark: 'bg-white/12 text-white backdrop-blur-sm hover:bg-white/20',
      },
      size: {
        sm: 'h-11 px-4 text-xs',
        md: 'h-12 px-6 text-sm',
        lg: 'h-14 px-8 text-base',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { buttonVariants }
