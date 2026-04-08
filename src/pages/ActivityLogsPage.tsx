import { useEffect, useMemo, useState } from 'react'
import { Filter, Search, ShieldCheck } from 'lucide-react'
import { fetchActivityLogs, type ActivityLog } from '../activity/api'
import { useAuth } from '../auth/AuthContext'
import { PageTransition } from '../components/ui/PageTransition'

const filters = ['All', 'info', 'warn'] as const

export default function ActivityLogsPage() {
  const { token } = useAuth()
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>('All')

  useEffect(() => {
    let cancelled = false

    async function loadLogs() {
      if (!token) {
        setLoading(false)
        return
      }

      try {
        const response = await fetchActivityLogs(token)
        if (!cancelled) {
          setLogs(response.logs)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load activity logs.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadLogs()

    return () => {
      cancelled = true
    }
  }, [token])

  const filteredLogs = useMemo(() => logs.filter((log) => {
    const matchesFilter = activeFilter === 'All' || log.severity === activeFilter
    const haystack = `${log.eventType} ${log.message} ${log.deviceInfo || ''}`.toLowerCase()
    const matchesQuery = !query || haystack.includes(query.toLowerCase())

    return matchesFilter && matchesQuery
  }), [activeFilter, logs, query])

  return (
    <PageTransition className="space-y-6">
      <section className="section-shell hero-panel rounded-[2rem] p-6 sm:p-8">
        <p className="eyebrow">Audit trail</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--text-primary)]">Review every security event with context.</h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--text-secondary)]">
          Search, filter, and review the event history behind logins, access changes, and suspicious activity flags.
        </p>
      </section>

      <section className="panel rounded-[2rem] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-3 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <Search className="h-4 w-4 text-[var(--text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search logs"
              className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeFilter === filter
                    ? 'bg-[var(--accent-soft)] text-[var(--text-primary)]'
                    : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]'
                }`}
              >
                {filter === 'All' ? filter : filter.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error ? <div className="panel rounded-[2rem] p-6 text-sm text-rose-300">{error}</div> : null}
      {loading ? <div className="panel rounded-[2rem] p-6 text-sm text-[var(--text-secondary)]">Loading logs...</div> : null}

      {!loading ? (
        <section className="grid gap-4">
          {filteredLogs.length === 0 ? (
            <div className="panel rounded-[2rem] p-6 text-sm text-[var(--text-secondary)]">
              No logs matched your current search and filter settings.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <article key={log.id} className="panel rounded-[2rem] p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="icon-chip">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-[var(--text-primary)]">{log.eventType}</p>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{log.message}</p>
                      <p className="mt-2 text-xs text-[var(--text-muted)]">{log.deviceInfo || 'Unknown device'} {log.ipAddress ? `• ${log.ipAddress}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <div className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text-secondary)]">
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                    <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-[var(--text-muted)]">
                      <Filter className="h-3.5 w-3.5" />
                      {log.severity}
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      ) : null}
    </PageTransition>
  )
}
