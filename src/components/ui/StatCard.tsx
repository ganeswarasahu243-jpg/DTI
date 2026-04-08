import type { ReactNode } from 'react'

export function StatCard({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="panel card-hover rounded-[28px] p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">{value}</p>
      {children ? <div className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">{children}</div> : null}
    </div>
  )
}
