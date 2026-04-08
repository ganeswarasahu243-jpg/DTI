import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Outlet } from 'react-router-dom'
import { Breadcrumbs } from './Breadcrumbs'
import { Navbar } from './Navbar'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    if (!mobileSidebarOpen) return

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileSidebarOpen(false)
      }
    }

    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [mobileSidebarOpen])

  useEffect(() => {
    document.body.style.overflow = mobileSidebarOpen ? 'hidden' : ''

    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileSidebarOpen])

  return (
    <div className="min-h-screen overflow-x-hidden text-[var(--text-primary)]">
      <Navbar onOpenSidebar={() => setMobileSidebarOpen(true)} />
      <div className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-full flex-col gap-4 px-3 pb-8 pt-4 sm:gap-6 sm:px-5 sm:pt-6 xl:flex-row xl:px-8">
        <Sidebar />
        <main className="min-w-0 flex-1 rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] backdrop-blur-xl sm:rounded-[32px] sm:p-6 xl:p-7">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
      <AnimatePresence>
        {mobileSidebarOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex xl:hidden"
          >
            <button
              type="button"
              aria-label="Close navigation overlay"
              className="absolute inset-0 bg-[rgba(2,6,23,0.78)] backdrop-blur-sm"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: -32, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -32, opacity: 0 }}
              transition={{ duration: 0.24, ease: 'easeInOut' }}
              className="relative z-10 h-full w-full max-w-sm p-3"
            >
              <Sidebar mobile onClose={() => setMobileSidebarOpen(false)} />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
