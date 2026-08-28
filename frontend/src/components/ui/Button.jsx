import { clsx } from 'clsx'
import { Loader2 } from 'lucide-react'

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  onClick,
  type = 'button',
  ...props
}) {
  const variants = {
    primary:   'btn-primary',
    secondary: 'btn-secondary',
    ghost:     'btn-ghost',
    danger:    'btn-danger',
    outline:   'btn-outline',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(variants[variant] || variants.primary, sizes[size], className)}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}

export function IconButton({ icon: Icon, label, onClick, className = '', variant = 'ghost', size = 16 }) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center justify-center w-9 h-9 rounded-xl transition-colors border border-transparent',
        variant === 'ghost' && 'hover:bg-white/[0.05] text-slate-400 hover:text-slate-100 hover:border-white/[0.06]',
        variant === 'danger' && 'hover:bg-red-600/20 text-slate-400 hover:text-red-400',
        className
      )}
    >
      <Icon size={size} />
    </button>
  )
}
