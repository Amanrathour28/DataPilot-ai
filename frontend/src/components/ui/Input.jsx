import { clsx } from 'clsx'

export function Input({ label, error, className = '', id, ...props }) {
  return (
    <div className="w-full">
      {label && <label htmlFor={id} className="label">{label}</label>}
      <input
        id={id}
        className={clsx('input', error && 'border-red-500/60 focus:border-red-500/60', className)}
        {...props}
      />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  )
}

export function Textarea({ label, error, className = '', id, ...props }) {
  return (
    <div className="w-full">
      {label && <label htmlFor={id} className="label">{label}</label>}
      <textarea
        id={id}
        className={clsx('input resize-none', error && 'border-red-500/60', className)}
        {...props}
      />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  )
}
