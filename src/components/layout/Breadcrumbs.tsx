import { ChevronRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const labelMap: Record<string, string> = {
  dashboard: 'Dashboard',
  assets: 'Assets',
  new: 'Add Asset',
  security: 'Security',
  nominees: 'Trusted Circle',
  profile: 'Profile',
  help: 'Help',
  activity: 'Audit Logs',
  admin: 'Admin Panel',
}

function segmentLabel(segment: string) {
  return labelMap[segment] || segment.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export function Breadcrumbs() {
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)

  if (segments.length === 0) {
    return null
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
      <Link to="/dashboard" className="transition hover:text-[var(--text-primary)]">
        Workspace
      </Link>
      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join('/')}`
        const isLast = index === segments.length - 1

        return (
          <span key={href} className="inline-flex items-center gap-2">
            <ChevronRight className="h-4 w-4" />
            {isLast ? (
              <span className="text-[var(--text-primary)]">{segmentLabel(segment)}</span>
            ) : (
              <Link to={href} className="transition hover:text-[var(--text-primary)]">
                {segmentLabel(segment)}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
