export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="panel rounded-[28px] border-dashed p-12 text-center text-[var(--text-secondary)]">
      <p className="text-sm uppercase tracking-[0.35em] text-[var(--text-muted)]">Empty state</p>
      <h2 className="mt-4 text-2xl font-semibold text-[var(--text-primary)]">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--text-secondary)]">{description}</p>
    </div>
  )
}
