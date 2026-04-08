import { type FC } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Activity,
  ChevronRight,
  HelpCircle,
  LayoutDashboard,
  PlusCircle,
  ShieldCheck,
  TimerReset,
  User,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import type { UserRole } from '../../auth/types'
import { StatusBadge } from '../ui/Premium'

const links = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['user', 'nominee', 'admin'] as UserRole[] },
  { label: 'Add Asset', href: '/assets/new', icon: PlusCircle, roles: ['user', 'admin'] as UserRole[] },
  { label: 'Nominees', href: '/nominees', icon: Users, roles: ['user', 'nominee', 'admin'] as UserRole[] },
  { label: 'Security', href: '/security', icon: ShieldCheck, roles: ['user', 'admin'] as UserRole[] },
  { label: 'Admin Panel', href: '/admin', icon: TimerReset, roles: ['admin'] as UserRole[] },
  { label: 'Activity Logs', href: '/activity', icon: Activity, roles: ['admin'] as UserRole[] },
  { label: 'Profile', href: '/profile', icon: User, roles: ['user', 'nominee', 'admin'] as UserRole[] },
  { label: 'Help', href: '/help', icon: HelpCircle, roles: ['user', 'nominee', 'admin'] as UserRole[] },
]

function SidebarLink({ label, href, Icon }: { label: string; href: string; Icon: FC<{ className?: string }> }) {
  return (
    <NavLink
      to={href}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
          isActive
            ? 'border-[var(--border-strong)] bg-[color:var(--accent-soft)] text-[var(--text-primary)] shadow-[0_20px_48px_-32px_rgba(45,212,191,0.7)]'
            : 'border-white/8 bg-white/[0.03] text-[var(--text-secondary)] hover:border-white/14 hover:bg-white/[0.05] hover:text-[var(--text-primary)]'
        }`
      }
    >
      <Icon className="h-5 w-5 text-[var(--accent)]" />
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 opacity-60" />
    </NavLink>
  )
}

function SidebarLinkWithClose({
  label,
  href,
  Icon,
  onClose,
}: {
  label: string
  href: string
  Icon: FC<{ className?: string }>
  onClose?: () => void
}) {
  return (
    <NavLink
      to={href}
      onClick={onClose}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
          isActive
            ? 'border-[var(--border-strong)] bg-[color:var(--accent-soft)] text-[var(--text-primary)] shadow-[0_20px_48px_-32px_rgba(45,212,191,0.7)]'
            : 'border-white/8 bg-white/[0.03] text-[var(--text-secondary)] hover:border-white/14 hover:bg-white/[0.05] hover:text-[var(--text-primary)]'
        }`
      }
    >
      <Icon className="h-5 w-5 text-[var(--accent)]" />
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 opacity-60" />
    </NavLink>
  )
}

export function Sidebar({
  mobile = false,
  onClose,
}: {
  mobile?: boolean
  onClose?: () => void
}) {
  const { user } = useAuth()
  const visibleLinks = links.filter((link) => user && link.roles.includes(user.role))

  return (
    <aside className={`${mobile ? 'flex h-full w-full max-w-sm flex-col' : 'hidden w-[290px] shrink-0 flex-col xl:flex'} gap-4`}>
      <div className="panel rounded-[30px] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-[11px]">Control center</p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Legacy control</h2>
          </div>
          {mobile && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          Navigate the vault, trusted circle, timer controls, and audit trail from one secure workspace.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <StatusBadge tone="success">Vault healthy</StatusBadge>
          <StatusBadge tone="accent">{user?.role === 'admin' ? 'Admin oversight' : 'Timer active'}</StatusBadge>
        </div>
      </div>

      <div className="space-y-3">
        {visibleLinks.map((link) => (
          mobile ? (
            <SidebarLinkWithClose key={link.href} label={link.label} href={link.href} Icon={link.icon} onClose={onClose} />
          ) : (
            <SidebarLink key={link.href} label={link.label} href={link.href} Icon={link.icon} />
          )
        ))}
      </div>

      <div className="panel rounded-[30px] p-5 text-sm text-[var(--text-secondary)]">
        <p className="text-[var(--text-primary)]">Security posture</p>
        <div className="mt-4 space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
              <span>Encryption</span>
              <span>98%</span>
            </div>
            <div className="h-2 rounded-full bg-black/10">
              <div className="h-2 w-[98%] rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-strong))]" />
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
              <span>Consensus readiness</span>
              <span>81%</span>
            </div>
            <div className="h-2 rounded-full bg-black/10">
              <div className="h-2 w-[81%] rounded-full bg-[linear-gradient(90deg,var(--accent-strong),#34d399)]" />
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
