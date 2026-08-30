import { clsx } from 'clsx'

export function PageShell({ children, className = '', wide = false }) {
  return (
    <div className={clsx(
      'w-full mx-auto px-6 py-8 md:px-10 md:py-10 space-y-8',
      wide ? 'max-w-[1500px]' : 'max-w-[1360px]',
      className
    )}>
      {children}
    </div>
  )
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/[0.08]">
      <div className="min-w-0 space-y-1.5">
        {eyebrow && (
          <div className="editorial-label m-0">
            <span className="num">/</span>
            <span>{eyebrow}</span>
          </div>
        )}
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl md:text-4xl uppercase tracking-tight text-[#f2f2ef] leading-tight">
          {title}
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-[#f2f2ef]/55 font-sans leading-relaxed max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="border border-white/[0.08] bg-[#0c0c0c] p-12 md:p-16 text-center flex flex-col items-center justify-center space-y-4">
      {Icon && (
        <div className="w-12 h-12 rounded border border-white/[0.1] bg-white/[0.02] flex items-center justify-center text-[#d4ff58] mb-2">
          <Icon size={20} />
        </div>
      )}
      <div className="space-y-1.5 max-w-md">
        <h3 className="font-display font-bold text-lg uppercase tracking-tight text-[#f2f2ef]">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-[#f2f2ef]/50 font-sans leading-relaxed">
          {description}
        </p>
      </div>
      {action && <div className="pt-4">{action}</div>}
    </div>
  )
}

export function AlertBanner({ tone = 'error', icon: Icon, title, description, action }) {
  const tones = {
    error:   'border-[#ff4e4e]/30 bg-[#ff4e4e]/10 text-[#ff4e4e]',
    warning: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    info:    'border-sky-400/30 bg-sky-400/10 text-sky-300',
  }
  return (
    <div className={clsx('border p-4 flex items-center justify-between gap-4', tones[tone])}>
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <Icon size={18} className="flex-shrink-0" />}
        <div className="min-w-0">
          <h3 className="font-display font-bold text-xs uppercase tracking-wider">{title}</h3>
          {description && <p className="font-mono text-[11px] opacity-80 mt-0.5 truncate">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}
