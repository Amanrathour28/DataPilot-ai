import { useEffect } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { clsx } from 'clsx'

const ICONS = {
  success: CheckCircle,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
}

const STYLES = {
  success: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400',
  error:   'bg-red-500/10 border-red-500/25 text-red-400',
  warning: 'bg-amber-500/10 border-amber-500/25 text-amber-400',
  info:    'bg-brand-500/10 border-brand-500/25 text-brand-400',
}

export function Toast({ message, type = 'info', onClose }) {
  const Icon = ICONS[type]

  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className={clsx(
      'flex items-start gap-3 px-4 py-3 rounded-2xl border text-sm shadow-2xl max-w-sm w-full animate-slide-up backdrop-blur-xl bg-[#0e1118]/90',
      STYLES[type]
    )}>
      <Icon size={16} className="mt-0.5 flex-shrink-0" />
      <span className="flex-1 text-slate-200">{typeof message === 'string' ? message : JSON.stringify(message)}</span>
      <button onClick={onClose} className="flex-shrink-0 text-slate-500 hover:text-slate-300">
        <X size={14} />
      </button>
    </div>
  )
}

// Simple imperative toast system via React context
import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const show = useCallback((message, type = 'info') => {
    const id = ++toastId
    setToasts(t => [...t, { id, message, type }])
  }, [])

  const remove = useCallback((id) => {
    setToasts(t => t.filter(toast => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-50">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
