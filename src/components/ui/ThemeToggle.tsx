import { useEffect, useState } from 'react'
import { MoonStar, SunMedium } from 'lucide-react'
import { useTheme } from 'next-themes'

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? theme !== 'light' : true

  return (
    <button
      type="button"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] transition hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] ${
        compact ? 'h-10 w-10' : 'h-11 w-11'
      }`}
    >
      {isDark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
    </button>
  )
}
