import { Check, X } from 'lucide-react'
import { clsx } from 'clsx'

export function checkPasswordCriteria(password = '') {
  return {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  }
}

export default function PasswordStrengthIndicator({ password = '' }) {
  const criteria = checkPasswordCriteria(password)

  const items = [
    { key: 'minLength', label: '8+ characters', met: criteria.minLength },
    { key: 'hasUpper', label: '1 uppercase letter', met: criteria.hasUpper },
    { key: 'hasLower', label: '1 lowercase letter', met: criteria.hasLower },
    { key: 'hasNumber', label: '1 number', met: criteria.hasNumber },
  ]

  const metCount = Object.values(criteria).filter(Boolean).length

  return (
    <div className="space-y-2 mt-2">
      {/* Strength meter bar */}
      <div className="flex gap-1.5 h-1">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={clsx(
              'h-full flex-1 rounded-full transition-all duration-300',
              step <= metCount
                ? metCount === 4
                  ? 'bg-emerald-500'
                  : metCount >= 2
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
                : 'bg-slate-800'
            )}
          />
        ))}
      </div>

      {/* Criteria checklist */}
      <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1">
        {items.map((item) => (
          <div
            key={item.key}
            className={clsx(
              'flex items-center gap-1.5 transition-colors',
              item.met ? 'text-emerald-400' : 'text-slate-500'
            )}
          >
            {item.met ? (
              <Check size={12} className="text-emerald-400 flex-shrink-0" />
            ) : (
              <div className="w-1.5 h-1.5 rounded-full bg-slate-700 mx-0.5 flex-shrink-0" />
            )}
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
