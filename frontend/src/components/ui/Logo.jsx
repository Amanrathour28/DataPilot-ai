import { clsx } from 'clsx'

export default function Logo({ size = 28, className = '' }) {
  return (
    <div
      className={clsx(
        'relative flex items-center justify-center overflow-hidden flex-shrink-0',
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
        <rect width="32" height="32" fill="#121212" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <path
          d="M8 21.5c3.2-1.4 5.4-4.8 5.4-8.6 0-1.4-.3-2.7-.8-3.9C16.8 10.4 20 14.6 20 19.4c0 .9-.1 1.7-.4 2.5 1.6-.6 3-1.8 3.8-3.3-1.1 5.1-5.6 8.7-10.7 8.7-2.1 0-4-.6-5.7-1.8Z"
          fill="#d4ff58"
        />
        <circle cx="11.2" cy="11.2" r="2.2" fill="#ffffff" />
      </svg>
    </div>
  )
}

export function BrandWordmark({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <Logo size={compact ? 24 : 28} />
      <div className="min-w-0">
        <div className="flex items-baseline gap-1">
          <span className="font-display font-bold text-white tracking-tight text-sm uppercase">DataPilot</span>
          <span className="text-[10px] font-mono font-bold text-[#d4ff58]">.AI</span>
        </div>
        {!compact && (
          <p className="text-[10px] font-mono text-[#f2f2ef]/40 leading-none mt-0.5 truncate uppercase tracking-widest">
            Autonomous Engine
          </p>
        )}
      </div>
    </div>
  )
}
