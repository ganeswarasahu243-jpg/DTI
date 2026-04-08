import { motion, useReducedMotion } from 'framer-motion'

function splitCountdown(value: string) {
  if (value.includes(':')) {
    const [minutes = '00', seconds = '00'] = value.split(':')
    return { minutes, seconds }
  }

  return { minutes: '--', seconds: '--' }
}

export function AnimatedCountdown({
  value,
  label,
}: {
  value: string
  label?: string
}) {
  const reduceMotion = useReducedMotion()
  const { minutes, seconds } = splitCountdown(value)

  return (
    <div className="countdown-glow rounded-[1.75rem] border border-[var(--border-strong)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_14%,transparent),color-mix(in_srgb,var(--surface)_88%,transparent))] p-4 sm:p-5">
      {label ? <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">{label}</p> : null}
      <div className="mt-3 flex items-end gap-3">
        {[minutes, seconds].map((segment, index) => (
          <div key={`${index}-${segment}`} className="flex items-center gap-3">
            <motion.div
              key={segment}
              initial={reduceMotion ? false : { opacity: 0.4, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="rounded-[1.25rem] border border-white/10 bg-[var(--surface)] px-4 py-3 shadow-[0_16px_36px_-28px_rgba(0,0,0,0.85)]"
            >
              <span className="block text-3xl font-semibold tabular-nums text-[var(--text-primary)] sm:text-4xl">{segment}</span>
            </motion.div>
            {index === 0 ? <span className="pb-3 text-2xl font-semibold text-[var(--text-muted)]">:</span> : null}
          </div>
        ))}
      </div>
    </div>
  )
}
