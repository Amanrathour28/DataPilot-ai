import { clsx } from 'clsx'

export function Card({ children, className = '', onClick }) {
  return (
    <div
      className={clsx('card p-5', onClick && 'cursor-pointer hover:border-cyan-400/30 transition-colors', className)}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export function StatCard({ label, value, sub, icon: Icon, color = 'brand' }) {
  const colors = {
    brand:   'text-cyan-300 bg-cyan-500/10 border-cyan-400/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-400/20',
    amber:   'text-amber-400 bg-amber-500/10 border-amber-400/20',
    red:     'text-red-400 bg-red-500/10 border-red-400/20',
    slate:   'text-violet-300 bg-violet-500/10 border-violet-400/20',
  }

  return (
    <div className="card p-5 flex items-start gap-4 hover:border-white/10 transition-colors">
      {Icon && (
        <div className={clsx('p-2.5 rounded-xl border', colors[color])}>
          <Icon size={18} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-[0.12em]">{label}</p>
        <p className="text-2xl font-bold text-slate-50 mt-1 tracking-tight">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
    </div>
  )
}
