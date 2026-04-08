import type { ButtonHTMLAttributes, DetailedHTMLProps } from 'react'
import type { HTMLMotionProps } from 'framer-motion'
import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'

type ButtonProps = Omit<DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>, 'as'> &
  HTMLMotionProps<'button'> & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
  }

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'border border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(94,234,212,0.95),rgba(59,130,246,0.92))] text-slate-950 shadow-[0_24px_60px_-24px_rgba(45,212,191,0.75)] hover:-translate-y-0.5 hover:shadow-[0_28px_90px_-30px_rgba(45,212,191,0.35)] hover:brightness-105',
  secondary:
    'border border-white/10 bg-white/[0.04] text-[var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-white/[0.06] hover:shadow-[0_18px_45px_-28px_rgba(255,255,255,0.25)]',
  ghost: 'border border-transparent text-[var(--text-secondary)] hover:bg-white/[0.05] hover:text-[var(--text-primary)]',
  danger: 'border border-red-500/20 bg-red-500/10 text-red-500 hover:-translate-y-0.5 hover:border-red-500/30 hover:bg-red-500/20',
}

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-10 rounded-2xl px-4 text-sm',
  md: 'h-11 rounded-2xl px-5 text-sm',
  lg: 'h-12 rounded-2xl px-6 text-sm',
}

export function Button({ className, variant = 'primary', size = 'md', type = 'button', ...props }: ButtonProps) {
  const reduceMotion = useReducedMotion()
  const isDisabled = Boolean(props.disabled)

  return (
    <motion.button
      type={type}
      whileHover={
        reduceMotion || isDisabled
          ? undefined
          : {
              scale: 1.05,
              y: -1,
            }
      }
      whileTap={reduceMotion || isDisabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      className={clsx(
        'inline-flex transform-gpu items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-300 ease-in-out will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 disabled:cursor-not-allowed disabled:opacity-55',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  )
}
