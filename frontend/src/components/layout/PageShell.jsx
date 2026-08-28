import { clsx } from 'clsx'

export function PageShell({ children, className = '', wide = false }) {
  return (
    <div className={clsx('page-shell', wide && 'max-w-[88rem]', className)}>
      {children}
    </div>
  )
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="page-header">
      <div className="min-w-0">
        {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mb-4 shadow-inner">
        {Icon && <Icon size={22} className="text-cyan-400/80" />}
      </div>
      <h3 className="text-sm font-semibold text-slate-200 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 mb-5 max-w-sm leading-relaxed">{description}</p>
      {action}
    </div>
  )
}

export function AlertBanner({ tone = 'error', icon: Icon, title, description, action }) {
  const tones = {
    error: 'border-red-500/25 bg-red-500/10',
    warning: 'border-amber-500/25 bg-amber-500/10',
    info: 'border-cyan-500/25 bg-cyan-500/10',
  }
  return (
    <div className={clsx('card p-4 mb-6 flex items-center justify-between gap-4', tones[tone])}>
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <Icon size={18} className="text-red-400 flex-shrink-0" />}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          {description && <p className="text-xs text-slate-400 mt-0.5 truncate">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}
