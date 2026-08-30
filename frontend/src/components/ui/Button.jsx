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
    primary:   'bg-[#d4ff58] text-[#080808] border border-[#d4ff58] hover:bg-white hover:border-white font-bold',
    secondary: 'bg-[#121212] text-[#f2f2ef] border border-white/[0.15] hover:border-white/[0.3] hover:bg-[#181818]',
    outline:   'bg-transparent text-[#f2f2ef] border border-white/[0.2] hover:border-[#d4ff58] hover:text-[#d4ff58]',
    ghost:     'bg-transparent text-[#f2f2ef]/70 hover:text-[#f2f2ef] hover:bg-white/[0.05]',
    danger:    'bg-[#ff4e4e]/10 text-[#ff4e4e] border border-[#ff4e4e]/30 hover:bg-[#ff4e4e]/20',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-xs font-mono uppercase tracking-wider',
    md: 'px-4 py-2.5 text-xs font-display font-bold uppercase tracking-wider',
    lg: 'px-6 py-3.5 text-sm font-display font-bold uppercase tracking-wider',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-none transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
        variants[variant] || variants.primary,
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}

export function IconButton({ icon: Icon, label, onClick, className = '', variant = 'ghost', size = 15 }) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center justify-center w-8 h-8 rounded-none transition-colors border border-white/[0.08] bg-[#0d0d0d] text-[#f2f2ef]/70 hover:text-[#f2f2ef] hover:border-white/[0.2] cursor-pointer',
        variant === 'danger' && 'hover:bg-[#ff4e4e]/10 text-[#ff4e4e] border-[#ff4e4e]/30',
        className
      )}
    >
      <Icon size={size} />
    </button>
  )
}
