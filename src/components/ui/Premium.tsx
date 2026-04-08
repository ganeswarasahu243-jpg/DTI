import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'
import { AlertCircle, ArrowUpRight, CheckCircle2 } from 'lucide-react'

type Tone = 'default' | 'accent' | 'success' | 'warning'

const toneClasses: Record<Tone, string> = {
  default: 'border-white/10 bg-white/[0.03] text-[var(--text-secondary)]',
  accent: 'border-[var(--border-strong)] bg-[color:var(--accent-soft)] text-[var(--text-primary)]',
  success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
  warning: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  aside,
}: {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
  aside?: ReactNode
}) {
  return (
    <section className="hero-panel overflow-hidden rounded-[32px] px-6 py-7 sm:px-8 sm:py-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div className="space-y-4">
          <div className="eyebrow">{eyebrow}</div>
          <div className="max-w-3xl space-y-3">
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-4xl">
              {title}
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-[var(--text-secondary)] sm:text-base">
              {description}
            </p>
          </div>
          {actions ? <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">{actions}</div> : null}
        </div>
        {aside ? <div className="info-panel rounded-[28px] p-5">{aside}</div> : null}
      </div>
    </section>
  )
}

export function Panel({
  children,
  className,
  tone = 'default',
}: {
  children: ReactNode
  className?: string
  tone?: Tone
}) {
  return <section className={clsx('panel rounded-[28px] p-5 sm:p-6', toneClasses[tone], className)}>{children}</section>
}

export function SectionTitle({
  label,
  title,
  description,
  action,
}: {
  label?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        {label ? <div className="eyebrow text-[11px]">{label}</div> : null}
        <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">{title}</h2>
        {description ? <p className="max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function MetricCard({
  label,
  value,
  delta,
  detail,
  tone = 'default',
}: {
  label: string
  value: string
  delta?: string
  detail?: string
  tone?: Tone
}) {
  return (
    <Panel tone={tone} className="card-hover space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.26em] text-[var(--text-muted)]">{label}</p>
        {delta ? <StatusBadge tone={tone === 'warning' ? 'warning' : tone === 'success' ? 'success' : 'accent'}>{delta}</StatusBadge> : null}
      </div>
      <div className="space-y-2">
        <p className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">{value}</p>
        {detail ? <p className="text-sm leading-6 text-[var(--text-secondary)]">{detail}</p> : null}
      </div>
    </Panel>
  )
}

export function StatusBadge({
  children,
  tone = 'default',
  icon,
}: {
  children: ReactNode
  tone?: Tone
  icon?: ReactNode
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium tracking-[0.12em]',
        toneClasses[tone],
      )}
    >
      {icon}
      {children}
    </span>
  )
}

export function InsightList({
  items,
}: {
  items: Array<{ label: string; value: string; tone?: Tone }>
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-black/15 px-4 py-3"
        >
          <span className="text-sm text-[var(--text-secondary)]">{item.label}</span>
          <StatusBadge tone={item.tone ?? 'default'}>{item.value}</StatusBadge>
        </div>
      ))}
    </div>
  )
}

export function FeatureList({
  items,
}: {
  items: Array<{ title: string; description: string }>
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.title} className="rounded-2xl border border-white/8 bg-black/15 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--accent)]" />
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{item.description}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function DataCard({
  title,
  eyebrow,
  description,
  footer,
  status,
  className,
}: {
  title: string
  eyebrow?: string
  description?: string
  footer?: ReactNode
  status?: ReactNode
  className?: string
}) {
  return (
    <Panel className={clsx('card-hover space-y-4', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          {eyebrow ? <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--text-muted)]">{eyebrow}</p> : null}
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
        </div>
        {status}
      </div>
      {description ? <p className="text-sm leading-6 text-[var(--text-secondary)]">{description}</p> : null}
      {footer ? <div>{footer}</div> : null}
    </Panel>
  )
}

export function EmptyStatePanel({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="panel flex min-h-[260px] flex-col items-center justify-center rounded-[28px] border-dashed px-6 py-10 text-center">
      <div className="icon-chip mb-4">
        <AlertCircle className="h-5 w-5" />
      </div>
      <h2 className="text-2xl font-semibold text-[var(--text-primary)]">{title}</h2>
      <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--text-secondary)]">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="grid gap-2.5 text-sm">
      <span className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
        {label}
        {required ? <span className="text-[var(--accent)]">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="inline-flex items-center gap-2 text-xs text-rose-300">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs text-[var(--text-muted)]">{hint}</span>
      ) : null}
    </label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx('field-input', props.className)} />
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx('field-input', props.className)} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx('field-input min-h-[140px] resize-y py-3.5', props.className)} />
}

export function MessageBanner({
  tone = 'accent',
  title,
  description,
}: {
  tone?: Tone
  title: string
  description: string
}) {
  return (
    <div className={clsx('rounded-2xl border px-4 py-3.5', toneClasses[tone])}>
      <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
      <p className="mt-1 text-sm leading-6 text-current/80">{description}</p>
    </div>
  )
}

export function QuickAction({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="group rounded-2xl border border-white/8 bg-black/15 p-4 transition duration-200 hover:border-[var(--border-strong)] hover:bg-white/[0.05]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
        </div>
        <ArrowUpRight className="h-4 w-4 text-[var(--text-muted)] transition group-hover:text-[var(--accent)]" />
      </div>
    </div>
  )
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <div className="rounded-3xl border border-white/8 bg-black/15 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-base font-medium text-[var(--text-primary)]">{label}</p>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
        </div>
        <button
          type="button"
          aria-pressed={checked}
          onClick={onChange}
          className={clsx(
            'relative inline-flex h-9 w-16 shrink-0 rounded-full border p-1 transition duration-200',
            checked
              ? 'border-[var(--border-strong)] bg-[color:var(--accent-soft)]'
              : 'border-white/10 bg-white/[0.05]',
          )}
        >
          <span
            className={clsx(
              'h-7 w-7 rounded-full bg-[var(--text-primary)] shadow-lg transition duration-200',
              checked ? 'translate-x-7 bg-[var(--accent)]' : 'translate-x-0 bg-white/90',
            )}
          />
        </button>
      </div>
    </div>
  )
}
