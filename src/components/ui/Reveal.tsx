import type { PropsWithChildren } from 'react'
import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'

export function Reveal({
  children,
  className,
  delay = 0,
  y = 20,
}: PropsWithChildren<{ className?: string; delay?: number; y?: number }>) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={clsx(className)}
    >
      {children}
    </motion.div>
  )
}
