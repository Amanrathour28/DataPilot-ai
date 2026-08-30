import { clsx } from 'clsx'

export function Card({ children, className = '', onClick }) {
  return (
    <div
      className={clsx(
        'border border-white/[0.08] bg-[#0c0c0c] p-6 transition-all duration-200',
        onClick && 'cursor-pointer hover:border-white/[0.2] hover:bg-[#101010]',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-5 pb-3 border-b border-white/[0.06]">
      <div>
        <h3 className="font-display font-bold text-sm uppercase tracking-tight text-[#f2f2ef]">{title}</h3>
        {subtitle && <p className="font-mono text-xs text-[#f2f2ef]/50 mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export function StatCard({ label, value, sub, icon: Icon, color = 'brand' }) {
  return (
    <div className="border border-white/[0.08] bg-[#0c0c0c] p-6 flex flex-col justify-between hover:border-white/[0.18] transition-colors group">
      <div className="flex items-center justify-between gap-2 mb-4">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#f2f2ef]/50">
          {label}
        </span>
        {Icon && (
          <div className="w-7 h-7 rounded border border-white/[0.08] bg-white/[0.02] flex items-center justify-center text-[#f2f2ef]/60 group-hover:text-[#d4ff58] group-hover:border-[#d4ff58]/30 transition-colors">
            <Icon size={14} />
          </div>
        )}
      </div>
      <div>
        <p className="font-display font-extrabold text-3xl sm:text-4xl text-[#f2f2ef] tracking-tight group-hover:text-[#d4ff58] transition-colors">
          {value}
        </p>
        {sub && (
          <p className="font-mono text-xs text-[#f2f2ef]/40 mt-2">
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}
