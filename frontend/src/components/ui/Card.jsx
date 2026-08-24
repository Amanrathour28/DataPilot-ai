import { clsx } from 'clsx'

export function Card({ children, className = '', onClick }) {
  return (
    <div
      className={clsx('card p-5', onClick && 'cursor-pointer hover:border-brand-600/40 transition-colors', className)}
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
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export function StatCard({ label, value, sub, icon: Icon, color = 'brand' }) {
  const colors = {
    brand:   'text-brand-400 bg-brand-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    amber:   'text-amber-400 bg-amber-500/10',
    red:     'text-red-400 bg-red-500/10',
    slate:   'text-slate-400 bg-slate-500/10',
  }

  return (
    <div className="card p-5 flex items-start gap-4">
      {Icon && (
        <div className={clsx('p-2.5 rounded-xl', colors[color])}>
          <Icon size={20} className={clsx('', colors[color].split(' ')[0])} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-100 mt-1">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
