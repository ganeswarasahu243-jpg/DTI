import { motion, useReducedMotion } from 'framer-motion'

export function AnimatedProgressBar({
  value,
  className = '',
  trackClassName = '',
}: {
  value: number
  className?: string
  trackClassName?: string
}) {
  const reduceMotion = useReducedMotion()
  const normalized = Math.max(0, Math.min(100, value))

  return (
    <div
      className={`h-2 overflow-hidden rounded-full bg-black/10 ${trackClassName}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={normalized}
    >
      <motion.div
        className={`h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-strong))] ${className}`}
        initial={reduceMotion ? false : { width: 0 }}
        whileInView={{ width: `${normalized}%` }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: reduceMotion ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  )
}
