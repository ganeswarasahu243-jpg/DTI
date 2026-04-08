export function PageSkeleton() {
  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="loading-shimmer h-16 rounded-[2rem] border border-[var(--border)] bg-[var(--surface)]" />
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="loading-shimmer h-[420px] rounded-[2rem] border border-[var(--border)] bg-[var(--surface)]" />
          <div className="space-y-6">
            <div className="loading-shimmer h-48 rounded-[2rem] border border-[var(--border)] bg-[var(--surface)]" />
            <div className="loading-shimmer h-[168px] rounded-[2rem] border border-[var(--border)] bg-[var(--surface)]" />
          </div>
        </div>
      </div>
    </div>
  )
}
