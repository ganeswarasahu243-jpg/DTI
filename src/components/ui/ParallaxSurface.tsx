import { useEffect, useState, type PropsWithChildren } from 'react'
import clsx from 'clsx'
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'

export function ParallaxSurface({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  const reduceMotion = useReducedMotion()
  const [enabled, setEnabled] = useState(false)
  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)
  const springX = useSpring(rotateX, { stiffness: 180, damping: 18, mass: 0.2 })
  const springY = useSpring(rotateY, { stiffness: 180, damping: 18, mass: 0.2 })

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(pointer: fine) and (min-width: 1024px)')
    const update = () => setEnabled(mediaQuery.matches && !reduceMotion)

    update()
    mediaQuery.addEventListener('change', update)

    return () => mediaQuery.removeEventListener('change', update)
  }, [reduceMotion])

  if (!enabled) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={clsx('transform-gpu', className)}
      style={{ rotateX: springX, rotateY: springY, transformStyle: 'preserve-3d' }}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top
        const xPct = x / rect.width - 0.5
        const yPct = y / rect.height - 0.5
        rotateX.set(yPct * -8)
        rotateY.set(xPct * 10)
      }}
      onMouseLeave={() => {
        rotateX.set(0)
        rotateY.set(0)
      }}
    >
      {children}
    </motion.div>
  )
}
