import type { PropsWithChildren } from 'react'
import clsx from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'

export function PageTransition({ children, className }: PropsWithChildren<{ className?: string }>) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -10, filter: 'blur(8px)' }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className={clsx(className)}
    >
      {children}
    </motion.div>
  )
}
