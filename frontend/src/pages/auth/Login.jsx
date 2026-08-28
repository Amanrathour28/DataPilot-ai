import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import { BrandWordmark } from '../../components/ui/Logo'
import useAuthStore from '../../stores/authStore'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [errors, setErrors]     = useState({})

  const { login, isLoading, token, user } = useAuthStore()
  const toast    = useToast()
  const navigate = useNavigate()

  if (token && user) return <Navigate to="/dashboard" replace />

  const validate = () => {
    const e = {}
    if (!email)    e.email    = 'Email is required'
    if (!password) e.password = 'Password is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!validate()) return
    const result = await login(email, password)
    if (result.success) {
      navigate('/dashboard')
    } else {
      toast?.show(result.error, 'error')
    }
  }

  const handleDemoSignIn = async () => {
    setEmail('demo@datapilot.ai')
    setPassword('Password123!')
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
          <h1 className="text-3xl font-display text-slate-50">Welcome back</h1>
          <p className="text-slate-500 mt-2 text-sm">Sign in to continue investigating.</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="email"
              type="email"
              label="Email address"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              error={errors.email}
              autoComplete="email"
              autoFocus
            />

            <div className="w-full">
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className={`input pr-10 ${errors.password ? 'border-red-500/60' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password}</p>}
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={isLoading}
              className="w-full mt-6"
              size="lg"
            >
              Sign in
              <ArrowRight size={16} />
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleDemoSignIn}
              loading={isLoading}
              className="w-full mt-3"
              size="lg"
            >
              One-click demo
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
