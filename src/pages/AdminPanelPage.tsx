import { useState } from 'react'
import { CheckCircle2, FileText, Search, ShieldCheck, Users, XCircle } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { PageTransition } from '../components/ui/PageTransition'

const userRows = [
  { id: 'usr_1', name: 'Ariana Ray', email: 'ariana@loom.local', role: 'User', status: 'Active', risk: 'Low' },
  { id: 'usr_2', name: 'Priya Nair', email: 'priya@loom.local', role: 'Nominee', status: 'Pending', risk: 'Medium' },
  { id: 'usr_3', name: 'Marcus Bell', email: 'marcus@loom.local', role: 'User', status: 'Flagged', risk: 'High' },
]

const initialClaims = [
  { id: 'clm_1', owner: 'Ariana Ray', claimant: 'Priya Nair', status: 'Pending', timer: '5 min', approvals: '1/3' },
  { id: 'clm_2', owner: 'Marcus Bell', claimant: 'Elena Ross', status: 'Approved', timer: 'Expired', approvals: '3/3' },
  { id: 'clm_3', owner: 'Noah Chen', claimant: 'Ava Chen', status: 'Review', timer: '3 min', approvals: '2/3' },
]

export default function AdminPanelPage() {
  const [query, setQuery] = useState('')
  const [claims, setClaims] = useState(initialClaims)

  const filteredUsers = userRows.filter((row) =>
    `${row.name} ${row.email} ${row.role}`.toLowerCase().includes(query.toLowerCase()),
  )

  const filteredClaims = claims.filter((claim) =>
    `${claim.owner} ${claim.claimant} ${claim.status}`.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <PageTransition className="space-y-6">
      <section className="section-shell hero-panel rounded-[2rem] p-6 sm:p-8">
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-end">
          <div>
            <p className="eyebrow">Demo Admin Access</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--text-primary)]">Admin oversight for LOOM operations.</h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--text-secondary)]">
              Review user health, monitor claim progress, and keep the platform secure with clear audit visibility and operational controls.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="panel card-hover rounded-[1.75rem] p-5">
              <p className="text-sm text-[var(--text-muted)]">Total users</p>
              <p className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">1,248</p>
            </div>
            <div className="panel card-hover rounded-[1.75rem] p-5">
              <p className="text-sm text-[var(--text-muted)]">Open claims</p>
              <p className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">36</p>
            </div>
            <div className="panel card-hover rounded-[1.75rem] p-5">
              <p className="text-sm text-[var(--text-muted)]">Fraud flags</p>
              <p className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">4</p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel rounded-[2rem] p-6">
        <div className="flex items-center gap-3 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <Search className="h-4 w-4 text-[var(--text-muted)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search users or claims"
            className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.56fr_0.44fr]">
        <div className="panel rounded-[2rem] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Users</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">User directory</h2>
            </div>
            <Users className="h-5 w-5 text-[var(--accent)]" />
          </div>

          <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-[var(--border)]">
            <div className="hidden xl:grid grid-cols-[1.2fr_1.4fr_0.8fr_0.8fr_0.7fr] bg-[var(--bg-muted)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
              <span>Name</span>
              <span>Email</span>
              <span>Role</span>
              <span>Status</span>
              <span>Risk</span>
            </div>
            {filteredUsers.map((row) => (
              <div key={row.id} className="grid gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm xl:grid-cols-[1.2fr_1.4fr_0.8fr_0.8fr_0.7fr] xl:items-center">
                <div>
                  <span className="block text-[var(--text-muted)] xl:hidden">Name</span>
                  <p className="font-semibold text-[var(--text-primary)]">{row.name}</p>
                </div>
                <div>
                  <span className="block text-[var(--text-muted)] xl:hidden">Email</span>
                  <p className="text-[var(--text-secondary)]">{row.email}</p>
                </div>
                <div>
                  <span className="block text-[var(--text-muted)] xl:hidden">Role</span>
                  <p className="text-[var(--text-secondary)]">{row.role}</p>
                </div>
                <div>
                  <span className="block text-[var(--text-muted)] xl:hidden">Status</span>
                  <p className="text-[var(--text-secondary)]">{row.status}</p>
                </div>
                <div>
                  <span className="block text-[var(--text-muted)] xl:hidden">Risk</span>
                  <p className={`${row.risk === 'High' ? 'text-rose-400' : row.risk === 'Medium' ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {row.risk}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel rounded-[2rem] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Claims</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Claim approvals</h2>
            </div>
            <FileText className="h-5 w-5 text-[var(--accent)]" />
          </div>

          <div className="mt-6 space-y-4">
            {filteredClaims.map((claim) => (
              <article key={claim.id} className="panel card-hover rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">{claim.claimant}</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">Requesting access to {claim.owner}</p>
                  </div>
                  <div className="rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                    {claim.status}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-[var(--text-secondary)]">
                  <span>Timer: {claim.timer}</span>
                  <span>Approvals: {claim.approvals}</span>
                </div>
                <div className="mt-5 flex gap-3">
                  <Button
                    size="sm"
                    onClick={() =>
                      setClaims((current) =>
                        current.map((item) => (item.id === claim.id ? { ...item, status: 'Approved' } : item)),
                      )
                    }
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setClaims((current) =>
                        current.map((item) => (item.id === claim.id ? { ...item, status: 'Rejected' } : item)),
                      )
                    }
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="panel rounded-[2rem] p-6">
          <ShieldCheck className="h-5 w-5 text-[var(--accent)]" />
          <h3 className="mt-4 text-xl font-semibold text-[var(--text-primary)]">Security status</h3>
          <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">Login rate limiting, anomaly detection, and audit logging are all active.</p>
        </div>
        <div className="panel rounded-[2rem] p-6">
          <Users className="h-5 w-5 text-[var(--accent)]" />
          <h3 className="mt-4 text-xl font-semibold text-[var(--text-primary)]">Trusted circle health</h3>
          <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">Most claims are reaching majority approval in the first review cycle.</p>
        </div>
        <div className="panel rounded-[2rem] p-6">
          <FileText className="h-5 w-5 text-[var(--accent)]" />
          <h3 className="mt-4 text-xl font-semibold text-[var(--text-primary)]">Audit readiness</h3>
          <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">Sensitive actions remain logged with timestamps for post-incident review.</p>
        </div>
      </section>
    </PageTransition>
  )
}
