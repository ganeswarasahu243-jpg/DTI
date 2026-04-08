import { useMemo, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Menu, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import type { UserRole } from '../../auth/types'
import { Button } from '../ui/Button'
import { ThemeToggle } from '../ui/ThemeToggle'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', roles: ['user', 'nominee', 'admin'] as UserRole[] },
  { label: 'Assets', href: '/assets/new', roles: ['user', 'admin'] as UserRole[] },
  { label: 'Nominees', href: '/nominees', roles: ['user', 'nominee', 'admin'] as UserRole[] },
  { label: 'Profile', href: '/profile', roles: ['user', 'nominee', 'admin'] as UserRole[] },
  { label: 'Help', href: '/help', roles: ['user', 'nominee', 'admin'] as UserRole[] },
  { label: 'Security', href: '/security', roles: ['user', 'admin'] as UserRole[] },
  { label: 'Audit Logs', href: '/activity', roles: ['admin'] as UserRole[] },
  { label: 'Admin', href: '/admin', roles: ['admin'] as UserRole[] },
]

function AppLogo() {
  return (
    <Link to="/dashboard" className="inline-flex items-center gap-3 text-white">
      <div className="icon-chip h-11 w-11 rounded-2xl">
        <Sparkles className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[var(--accent)]">LOOM</p>
        <p className="brand-display text-[1.3rem] leading-none text-[var(--text-primary)]">Legacy OS</p>
      </div>
    </Link>
  )
}

export function Navbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const visibleNavItems = navItems.filter((item) => user && item.roles.includes(user.role))
  const searchTargets = useMemo(
    () => visibleNavItems.map((item) => ({
      href: item.href,
      label: item.label,
      haystack: `${item.label} ${item.href}`.toLowerCase(),
    })),
    [visibleNavItems],
  )
  const title =
    location.pathname === '/dashboard'
      ? 'Inheritance command center'
      : location.pathname === '/admin'
        ? 'Admin oversight'
        : 'Secure workspace'

  const handleSearch = () => {
    const normalized = searchQuery.trim().toLowerCase()
    if (!normalized) {
      return
    }

    const exactMatch = searchTargets.find((target) => target.haystack.includes(normalized))
    if (exactMatch) {
      navigate(exactMatch.href)
      setSearchQuery('')
      return
    }

    navigate('/help')
    setSearchQuery('')
  }

  const secureActionHref = user?.role === 'nominee'
    ? '/profile'
    : user?.role === 'admin'
      ? '/admin'
      : '/assets/new'

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-5 xl:px-8">
      <div className="mx-auto flex w-full max-w-full flex-wrap items-center justify-between gap-3 rounded-[28px] border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur-2xl sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] transition duration-200 ease-in-out hover:border-[var(--border-strong)] xl:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <AppLogo />
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 text-sm text-[var(--text-secondary)] lg:flex">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                `rounded-full px-4 py-2 transition ${isActive ? 'bg-[var(--accent-soft)] text-[var(--text-primary)]' : 'hover:text-[var(--text-primary)]'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 md:flex">
            <Search className="h-4 w-4" />
            <div className="min-w-[220px]">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleSearch()
                  }
                }}
                placeholder="Search workspace pages"
                className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
              <p className="text-xs text-[var(--text-muted)]">Search records, claims, and audit trails</p>
            </div>
            <Button size="sm" variant="ghost" className="h-9 px-3" onClick={handleSearch}>
              Go
            </Button>
          </div>
          <div className="hidden items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 xl:flex">
            <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[var(--text-muted)]">Trust layer</p>
              <p className="text-sm text-[var(--text-primary)]">Encrypted and monitored</p>
            </div>
          </div>
          <ThemeToggle />
          <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] transition duration-200 ease-in-out hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]">
            <Bell className="h-5 w-5" />
          </button>
          <Link to="/profile" className="hidden items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 transition duration-200 ease-in-out hover:border-[var(--border-strong)] sm:flex">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[linear-gradient(135deg,rgba(94,234,212,0.18),rgba(59,130,246,0.22))] text-sm font-semibold text-[var(--text-primary)]">
              {user?.name?.slice(0, 2).toUpperCase() || 'LO'}
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-[var(--text-primary)]">{user?.name || 'Secure user'}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {location.pathname === '/dashboard' ? `${user?.role || 'user'} overview` : title}
              </p>
            </div>
          </Link>
          <Button size="sm" variant="secondary" className="hidden lg:inline-flex" onClick={logout}>Log out</Button>
          <Link to={secureActionHref} className="hidden lg:inline-flex">
            <Button size="sm">
              Open secure action
            </Button>
          </Link>
        </div>

        <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 lg:hidden">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--text-primary)]">{title}</p>
            <p className="truncate text-xs text-[var(--text-muted)]">
              {user?.name ? `${user.name} • ${user.role}` : 'Secure workspace'}
            </p>
          </div>
          <Button size="sm" variant="secondary" className="shrink-0" onClick={logout}>Log out</Button>
        </div>
      </div>
    </header>
  )
}
