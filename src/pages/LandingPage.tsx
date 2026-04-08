import { motion } from 'framer-motion'
import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LockKeyhole,
  Menu,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { AnimatedProgressBar } from '../components/ui/AnimatedProgressBar'
import { PageTransition } from '../components/ui/PageTransition'
import { ParallaxSurface } from '../components/ui/ParallaxSurface'
import { Reveal } from '../components/ui/Reveal'
import { ThemeToggle } from '../components/ui/ThemeToggle'

const features = [
  {
    title: 'AES-256 encrypted vaults',
    description: 'Sensitive records, legal documents, and digital assets stay protected at rest and in transit.',
    icon: LockKeyhole,
  },
  {
    title: 'Trusted circle consensus',
    description: 'Majority approvals and audit trails ensure access is deliberate, verified, and tamper resistant.',
    icon: Users,
  },
  {
    title: "Dead man's switch timer",
    description: 'Automate release checks with secure inactivity windows and final verification before any asset is exposed.',
    icon: Clock3,
  },
  {
    title: 'Continuous security posture',
    description: 'MFA, anomaly detection, and role-based access keep every workflow trust-first by default.',
    icon: ShieldCheck,
  },
]

const landingNavItems = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Trust', href: '#trust' },
]

const steps = [
  {
    title: 'Protect your estate',
    description: 'Upload digital records, wallets, policies, and instructions into one encrypted inheritance workspace.',
  },
  {
    title: 'Name the right people',
    description: 'Add trusted contacts, define approval thresholds, and control who participates in sensitive release events.',
  },
  {
    title: 'Set the release logic',
    description: 'Use timers, MFA, and secure verification checkpoints so inheritance access only happens under the right conditions.',
  },
  {
    title: 'Respond with confidence',
    description: 'Claimants enter a separate portal, verify identity, and receive limited read-only access when consensus is satisfied.',
  },
]

const testimonials = [
  {
    quote: 'LOOM feels like the rare product that treats both design and security as first-class citizens.',
    name: 'Ariana Ray',
    role: 'Family office operator',
  },
  {
    quote: 'Our claim flow is clearer, calmer, and dramatically easier for non-technical beneficiaries.',
    name: 'Marcus Bell',
    role: 'Estate planning advisor',
  },
]

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <PageTransition className="min-h-screen py-4 sm:py-6">
      <div className="landing-container">
        <header className="sticky top-3 z-30 rounded-[24px] border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-3 shadow-[var(--shadow-soft)] backdrop-blur-2xl sm:top-4 sm:rounded-[28px] sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] md:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <Link to="/" className="inline-flex items-center gap-3">
                <div className="icon-chip h-11 w-11 rounded-2xl">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[var(--accent)]">LOOM</p>
                  <p className="brand-display text-[1.35rem] leading-none text-[var(--text-primary)]">Digital Legacy</p>
                </div>
              </Link>
            </div>

            <div className="hidden items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 text-sm text-[var(--text-secondary)] md:flex">
              {landingNavItems.map((item) => (
                <a key={item.href} href={item.href} className="rounded-full px-4 py-2 transition-all duration-300 ease-in-out hover:text-[var(--text-primary)]">
                  {item.label}
                </a>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link to="/auth">
                <Button variant="secondary" className="hidden sm:inline-flex">Login</Button>
              </Link>
              <Link to="/auth">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </header>

        <AnimatePresence>
          {mobileMenuOpen ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 overflow-hidden bg-[rgba(7,17,31,0.96)] p-5 sm:hidden"
            >
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ duration: 0.24, ease: 'easeInOut' }}
                className="mx-auto flex h-full max-w-sm flex-col gap-6 rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold text-[var(--text-primary)]">Navigate LOOM</p>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)] text-[var(--text-primary)]"
                    aria-label="Close navigation menu"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <nav className="flex flex-col gap-3">
                  {landingNavItems.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="interactive-ring rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-4 text-base font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface)]"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
                <div className="mt-auto grid gap-3">
                  <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full">Get Started</Button>
                  </Link>
                  <Link to="/claim-access" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="secondary" className="w-full">Open Claim Portal</Button>
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <Reveal className="landing-section pt-10 sm:pt-12">
          <section className="section-shell hero-panel relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-8 sm:py-14 lg:rounded-[2.5rem] lg:px-12 lg:py-16">
            <div className="grid gap-10 lg:gap-16 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
              <div className="landing-copy">
                <div className="trust-chip text-xs font-semibold uppercase tracking-[0.32em]">
                  <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
                  Trust-first digital inheritance
                </div>

                <h1 className="mt-6 max-w-4xl text-balance text-4xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-5xl md:text-6xl lg:text-7xl">
                  Secure Your Digital Legacy
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--text-secondary)] sm:text-lg">
                  LOOM gives families a secure, calm, and modern way to protect digital assets,
                  verify inheritance claims, and release access only when the right safeguards align.
                </p>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
                  <Link to="/auth">
                    <Button size="lg" className="w-full sm:w-auto">
                      Get Started
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/auth">
                    <Button variant="secondary" size="lg" className="w-full sm:w-auto">Login</Button>
                  </Link>
                  <Link to="/claim-access">
                    <Button variant="ghost" size="lg" className="w-full sm:w-auto text-[var(--text-primary)]">
                      Claim Access
                    </Button>
                  </Link>
                </div>

                <div className="mt-8 flex flex-wrap gap-3 sm:gap-4">
                  <div className="trust-chip">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    Audit-ready workflows
                  </div>
                  <div className="trust-chip">
                    <LockKeyhole className="h-4 w-4 text-[var(--accent)]" />
                    Encrypted release paths
                  </div>
                  <div className="trust-chip">
                    <Users className="h-4 w-4 text-[var(--accent-strong)]" />
                    Trusted circle controls
                  </div>
                </div>
              </div>

              <ParallaxSurface className="rounded-[2rem]">
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.08, ease: [0.22,1,0.36,1] }}
                  className="panel card-hover landing-card"
                >
                  <div className="grid gap-6">
                    <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-7">
                      <div className="flex items-center justify-between gap-4">
                        <div className="landing-copy">
                          <p className="eyebrow">Security posture</p>
                          <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Inheritance orchestration</h2>
                        </div>
                        <div className="icon-chip">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="mt-8 grid gap-6 sm:grid-cols-2">
                        <div className="rounded-[20px] border border-[var(--border)] bg-[var(--bg-muted)] p-7">
                          <p className="text-sm text-[var(--text-muted)]">Protected assets</p>
                          <p className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">148</p>
                        </div>
                        <div className="rounded-[20px] border border-[var(--border)] bg-[var(--bg-muted)] p-7">
                          <p className="text-sm text-[var(--text-muted)]">Consensus health</p>
                          <p className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">99.2%</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-[0.9fr_1.1fr]">
                      <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-7">
                        <p className="eyebrow">Claim flow</p>
                        <div className="mt-6 space-y-4">
                          {['OTP verified', 'Timer expired', 'Majority approved', 'Read-only token issued'].map((item, index) => (
                            <div key={item} className="flex items-center gap-3">
                              <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent-soft)] text-sm font-semibold text-[var(--text-primary)]">
                                {index + 1}
                              </div>
                              <span className="text-sm text-[var(--text-secondary)]">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[20px] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(29,78,216,0.16),rgba(13,148,136,0.12))] p-7">
                        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--text-muted)]">Secure preview</p>
                        <div className="mt-6 rounded-[20px] border border-white/10 bg-black/10 p-7 backdrop-blur">
                          <p className="text-sm text-[var(--text-muted)]">Release timer</p>
                          <p className="mt-3 text-3xl font-semibold text-[var(--text-primary)] timer-chip sm:text-4xl">05:00</p>
                          <div className="mt-6">
                            <AnimatedProgressBar value={72} />
                          </div>
                          <div className="mt-6 flex items-center justify-between text-sm text-[var(--text-secondary)]">
                            <span>2 of 3 approvals complete</span>
                            <span>Read-only mode</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </ParallaxSurface>
            </div>
          </section>
        </Reveal>

        <section id="features" className="landing-section landing-feature-section pt-0">
          <div className="landing-grid">
          {features.map((feature, index) => (
            <motion.article
              key={feature.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.35, delay: index * 0.04 }}
              whileHover={{ y: -6, scale: 1.01 }}
              className="panel card-hover landing-card"
            >
              <div className="icon-chip">
                <feature.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-6 text-xl font-semibold text-[var(--text-primary)]">{feature.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{feature.description}</p>
            </motion.article>
          ))}
          </div>
        </section>

        <Reveal className="landing-section pt-0">
          <section id="how-it-works" className="landing-how-grid">
            <div className="panel landing-copy landing-how-copy rounded-[20px] p-7 sm:p-8 lg:p-10">
              <p className="eyebrow">How LOOM works</p>
              <h2 className="mt-4 text-3xl font-semibold text-[var(--text-primary)]">A secure flow that stays simple for families.</h2>
              <p className="mt-4 text-base leading-8 text-[var(--text-secondary)]">
                Designed for clarity under pressure, LOOM guides owners, nominees, and administrators
                through one calm, trustworthy system from setup to claim resolution.
              </p>
              <Link to="/claim-access" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] transition-all duration-300 ease-in-out hover:translate-x-1">
                Explore the claim access portal
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="landing-steps-grid">
              {steps.map((step, index) => (
                <Reveal key={step.title} delay={index * 0.05}>
                  <div className="panel card-hover landing-card landing-step-card">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--accent-soft)] text-sm font-semibold text-[var(--text-primary)]">
                        {index + 1}
                      </div>
                      <h3 className="text-xl font-semibold text-[var(--text-primary)]">{step.title}</h3>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">{step.description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal className="landing-section pt-0">
          <section id="trust" className="grid gap-8 lg:gap-10 lg:grid-cols-[1fr_1fr]">
            <div className="panel landing-copy rounded-[20px] p-7 sm:p-8 lg:p-10">
              <p className="eyebrow">Trust indicators</p>
              <h2 className="mt-4 text-3xl font-semibold text-[var(--text-primary)]">Security cues built directly into the product.</h2>
              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                {[
                  'Short-lived access tokens',
                  'Read-only claimant sessions',
                  'OTP verification and retry limits',
                  'Tamper-evident audit trails',
                ].map((item) => (
                  <div key={item} className="card-hover rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-7 py-7 text-sm text-[var(--text-secondary)]">
                    <CheckCircle2 className="mb-3 h-4 w-4 text-emerald-400" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6">
              {testimonials.map((testimonial) => (
                <div key={testimonial.name} className="panel card-hover landing-card">
                  <p className="text-lg leading-8 text-[var(--text-primary)]">"{testimonial.quote}"</p>
                  <div className="mt-6">
                    <p className="font-semibold text-[var(--text-primary)]">{testimonial.name}</p>
                    <p className="text-sm text-[var(--text-secondary)]">{testimonial.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal className="landing-section pt-0">
          <footer className="flex flex-col gap-5 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-6 py-7 text-sm text-[var(--text-secondary)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div>
              <p className="font-semibold text-[var(--text-primary)]">LOOM</p>
              <p className="mt-1">Digital inheritance workflows for modern families and administrators.</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link to="/auth" className="transition-all duration-300 ease-in-out hover:text-[var(--text-primary)]">Get Started</Link>
              <Link to="/claim-access" className="transition-all duration-300 ease-in-out hover:text-[var(--text-primary)]">Claim Access</Link>
              <Link to="/help" className="transition-all duration-300 ease-in-out hover:text-[var(--text-primary)]">Help</Link>
            </div>
          </footer>
        </Reveal>
      </div>
    </PageTransition>
  )
}
