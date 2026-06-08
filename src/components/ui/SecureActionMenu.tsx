import { useEffect, useRef, useState } from 'react'
import { ChevronDown, KeyRound, Landmark, Plus, ShieldCheck, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Button } from './Button'

type SecureActionMenuProps = {
  className?: string
  fullWidth?: boolean
}

type MenuAction = {
  label: string
  href: string
  Icon: typeof Plus
  visible: boolean
}

export function SecureActionMenu({ className, fullWidth = false }: SecureActionMenuProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) {
        return
      }

      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const actions: MenuAction[] = [
    {
      label: 'Add Asset',
      href: '/assets/new',
      Icon: Plus,
      visible: user?.role === 'user' || user?.role === 'admin',
    },
    {
      label: 'Manage Trusted Circle',
      href: '/nominees',
      Icon: Users,
      visible: user?.role === 'user' || user?.role === 'admin',
    },
    {
      label: 'Open Digital Vault',
      href: '/digital-vault',
      Icon: Landmark,
      visible: Boolean(user),
    },
    {
      label: 'Claim Access',
      href: '/claim-access',
      Icon: KeyRound,
      visible: user?.role === 'nominee',
    },
  ]

  const visibleActions = actions.filter((action) => action.visible)

  if (!user) {
    return null
  }

  return (
    <div ref={menuRef} className={`relative ${className || ''}`}>
      <Button
        onClick={() => setOpen((current) => !current)}
        className={`${fullWidth ? 'w-full justify-between' : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Secure Action
        </span>
        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[260px] rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-2 shadow-[0_24px_60px_-28px_rgba(56,189,248,0.45)] backdrop-blur-xl"
        >
          {visibleActions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text-secondary)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)]"
              onClick={() => {
                setOpen(false)
                navigate(action.href)
              }}
            >
              <action.Icon className="h-4 w-4 text-[var(--accent)]" />
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
