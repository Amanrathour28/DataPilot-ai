import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import { BrandWordmark } from '../../components/ui/Logo'
import useAuthStore from '../../stores/authStore'
import GoogleAuthButton from '../../components/auth/GoogleAuthButton'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [errors, setErrors] = useState({})

  const { login, isLoading, token, user } = useAuthStore()
  const toast = useToast()
  const navigate = useNavigate()

  if (token && user) return <Navigate to="/dashboard" replace />

  const validate = () => {
    const e = {}
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      e.email = 'Email address is required'
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(trimmedEmail)) {
        e.email = 'Please enter a valid email address'
      }
    }

    if (!password) {
      e.password = 'Password is required'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (isLoading) return
    if (!validate()) return

    const result = await login(email.trim().toLowerCase(), password)
    if (result.success) {
      navigate('/dashboard')
    } else {
      setErrors({ form: result.error || 'Invalid email or password' })
      toast?.show(result.error || 'Invalid email or password', 'error')
    }
  }

  const handleDemoSignIn = async () => {
    if (isLoading) return
    setEmail('demo@datapilot.ai')
    setPassword('Password123!')
    setErrors({})
    const result = await login('demo@datapilot.ai', 'Password123!')
    if (result.success) {
      navigate('/dashboard')
    } else {
      toast?.show(result.error || 'Demo sign in failed', 'error')
    }
  }

  return (
    <div className="min-h-screen app-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-8">
          <Link to="/"><BrandWordmark /></Link>
        </div>
        <div className="text-center mb-6">
          <h1 className="text-3xl font-display text-slate-50 font-bold">Welcome back</h1>
          <p className="text-slate-400 mt-2 text-xs">Sign in to continue your investigations.</p>
        </div>

        <div className="card p-8 shadow-2xl border border-slate-800 rounded-2xl bg-[#0e0e1a]">
          {/* Google Sign-In */}
          <div className="space-y-4">
            <GoogleAuthButton mode="signin" disabled={isLoading} />

            <div className="flex items-center gap-3 my-4">
              <div className="h-px flex-1 bg-slate-800" />
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Or continue with</span>
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
              id="email"
              type="email"
              label="Email address"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (errors.email || errors.form) setErrors((prev) => ({ ...prev, email: '', form: '' }))
              }}
              error={errors.email}
              autoComplete="email"
              autoFocus
              disabled={isLoading}
            />

            <div className="w-full">
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="label text-xs font-semibold text-slate-300 m-0">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  tabIndex={-1}
                  className="text-[11px] text-brand-400 hover:text-brand-300 transition-colors font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errors.password || errors.form) setErrors((prev) => ({ ...prev, password: '', form: '' }))
                  }}
                  autoComplete="current-password"
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
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={isLoading}
              disabled={isLoading}
              className="w-full mt-6"
              size="lg"
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
              {!isLoading && <ArrowRight size={16} />}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleDemoSignIn}
              disabled={isLoading}
              loading={isLoading && email === 'demo@datapilot.ai'}
              className="w-full mt-3 border-slate-700/80 hover:bg-slate-800/40"
              size="md"
            >
              One-click demo account
            </Button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-6 pt-5 border-t border-slate-800/80">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-brand-400 hover:text-brand-300 font-semibold transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
