import { clsx } from 'clsx'

export default function Logo({ size = 32, className = '' }) {
  return (
    <div
      className={clsx(
        'relative flex items-center justify-center rounded-xl overflow-hidden',
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
        <rect width="32" height="32" rx="9" fill="url(#dp-bg)" />
        <path
          d="M8 21.5c3.2-1.4 5.4-4.8 5.4-8.6 0-1.4-.3-2.7-.8-3.9C16.8 10.4 20 14.6 20 19.4c0 .9-.1 1.7-.4 2.5 1.6-.6 3-1.8 3.8-3.3-1.1 5.1-5.6 8.7-10.7 8.7-2.1 0-4-.6-5.7-1.8Z"
          fill="url(#dp-mark)"
        />
        <circle cx="11.2" cy="11.2" r="2.3" fill="#ecfeff" />
        <defs>
          <linearGradient id="dp-bg" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#22d3ee" />
            <stop offset="1" stopColor="#0e7490" />
          </linearGradient>
          <linearGradient id="dp-mark" x1="8" y1="9" x2="24" y2="27" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ecfeff" />
            <stop offset="1" stopColor="#a5f3fc" stopOpacity="0.75" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

export function BrandWordmark({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <Logo size={compact ? 28 : 32} className="shadow-lg shadow-cyan-500/20 flex-shrink-0" />
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="font-bold text-slate-50 tracking-tight text-sm">DataPilot</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300/90">AI</span>
        </div>
        {!compact && (
          <p className="text-[10px] text-slate-500 leading-none mt-0.5 truncate">Investigation platform</p>
        )}
      </div>
    </div>
  )
}
