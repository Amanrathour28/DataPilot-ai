import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, Check, AlertCircle } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import { BrandWordmark } from '../../components/ui/Logo'
import useAuthStore from '../../stores/authStore'
import GoogleAuthButton from '../../components/auth/GoogleAuthButton'
import PasswordStrengthIndicator, { checkPasswordCriteria } from '../../components/auth/PasswordStrengthIndicator'

const FEATURES = [
  'Autonomous multi-agent data investigation',
  'Hypothesis generation & testing',
  'Evidence-backed root cause analysis',
  'Real-time agent activity tracking',
]

export default function Register() {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [errors, setErrors]     = useState({})

  const { register, isLoading, token, user } = useAuthStore()
  const toast    = useToast()
  const navigate = useNavigate()

  if (token && user) return <Navigate to="/dashboard" replace />

  const validate = () => {
    const e = {}
    if (!name.trim()) e.name = 'Full name is required'

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      e.email = 'Email address is required'
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(trimmedEmail)) {
        e.email = 'Please enter a valid email address'
      }
    }

    const criteria = checkPasswordCriteria(password)
    if (!criteria.minLength) {
      e.password = 'Password must be at least 8 characters long'
    } else if (!criteria.hasUpper || !criteria.hasLower || !criteria.hasNumber) {
      e.password = 'Password must include uppercase, lowercase, and numeric characters'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (isLoading) return
    if (!validate()) return

    const result = await register(email.trim().toLowerCase(), password, name.trim())
    if (result.success) {
      toast?.show('Account created! Welcome to DataPilot.', 'success')
      navigate('/dashboard')
    } else {
      setErrors({ form: result.error || 'Registration failed' })
      toast?.show(result.error || 'Registration failed', 'error')
    }
  }

  return (
    <div className="min-h-screen app-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-4xl relative z-10 flex gap-12 items-center">
        {/* Left side brand banner */}
        <div className="hidden lg:flex flex-col gap-6 flex-1">
          <div>
            <BrandWordmark />
            <h1 className="text-4xl font-display text-slate-50 leading-tight mt-8 font-bold">
              Evidence, not dashboards.
            </h1>
            <p className="text-slate-400 mt-3 text-sm leading-relaxed">
              An autonomous multi-agent platform that investigates your tabular datasets, generates hypotheses, runs statistical tests, and delivers evidence-backed root cause analysis.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center flex-shrink-0">
                  <Check size={11} className="text-cyan-300" />
                </div>
                <span className="text-xs text-slate-300 font-medium">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right side form */}
        <div className="w-full max-w-md">
          <div className="text-center mb-6 lg:hidden">
            <div className="flex justify-center mb-4"><BrandWordmark compact /></div>
            <h1 className="text-2xl font-display text-slate-50 font-bold">Create your account</h1>
          </div>
          <div className="hidden lg:block mb-6">
            <h2 className="text-xl font-bold text-slate-100">Create your account</h2>
            <p className="text-xs text-slate-400 mt-1">Start autonomous data investigations in seconds.</p>
          </div>

          <div className="card p-8 shadow-2xl border border-slate-800 rounded-2xl bg-[#0e0e1a]">
            {/* Google Sign-Up */}
            <div className="space-y-4">
              <GoogleAuthButton mode="signup" disabled={isLoading} />

              <div className="flex items-center gap-3 my-4">
                <div className="h-px flex-1 bg-slate-800" />
                <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Or sign up with email</span>
                <div className="h-px flex-1 bg-slate-800" />
              </div>
            </div>

            {errors.form && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2.5 mb-4">
                <AlertCircle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errors.form}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <Input
                id="name"
                type="text"
                label="Full name"
                placeholder="Jane Smith"
                value={name}
                onChange={e => {
                  setName(e.target.value)
                  if (errors.name || errors.form) setErrors(prev => ({ ...prev, name: '', form: '' }))
                }}
                error={errors.name}
                autoComplete="name"
                autoFocus
                disabled={isLoading}
              />

              <Input
                id="email"
                type="email"
                label="Email address"
                placeholder="you@company.com"
                value={email}
                onChange={e => {
                  setEmail(e.target.value)
                  if (errors.email || errors.form) setErrors(prev => ({ ...prev, email: '', form: '' }))
                }}
                error={errors.email}
                autoComplete="email"
                disabled={isLoading}
              />

              <div className="w-full">
                <label htmlFor="password" className="label text-xs font-semibold text-slate-300">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value)
                      if (errors.password || errors.form) setErrors(prev => ({ ...prev, password: '', form: '' }))
                    }}
                    autoComplete="new-password"
                    disabled={isLoading}
                    className={`input pr-10 ${errors.password ? 'border-red-500/60' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && <p className="text-[11px] text-red-400 mt-1">{errors.password}</p>}
                <PasswordStrengthIndicator password={password} />
              </div>

              <Button
                type="submit"
                variant="primary"
                loading={isLoading}
                disabled={isLoading}
                className="w-full mt-6"
                size="lg"
              >
                {isLoading ? 'Creating account…' : 'Create account'}
                {!isLoading && <ArrowRight size={16} />}
              </Button>
            </form>

            <p className="text-center text-xs text-slate-400 mt-6 pt-5 border-t border-slate-800/80">
              Already have an account?{' '}
              <Link to="/login" className="text-brand-400 hover:text-brand-300 font-semibold transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
