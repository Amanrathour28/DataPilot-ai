import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, Check } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import { BrandWordmark } from '../../components/ui/Logo'
import useAuthStore from '../../stores/authStore'

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
    if (!name)                     e.name     = 'Name is required'
    if (!email)                    e.email    = 'Email is required'
    if (password.length < 8)       e.password = 'Password must be at least 8 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!validate()) return
    const result = await register(email, password, name)
    if (result.success) {
      toast?.show('Account created! Welcome to DataPilot.', 'success')
      navigate('/dashboard')
    } else {
      toast?.show(result.error, 'error')
    }
  }

  return (
    <div className="min-h-screen app-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-4xl relative z-10 flex gap-12 items-center">
        <div className="hidden lg:flex flex-col gap-6 flex-1">
          <div>
            <BrandWordmark />
            <h1 className="text-4xl font-display text-slate-50 leading-tight mt-8">
              Evidence, not dashboards.
            </h1>
            <p className="text-slate-400 mt-3 text-base leading-relaxed">
              An autonomous multi-agent platform that investigates your data, generates hypotheses, and delivers evidence-backed root cause analysis.
            </p>
          </div>

          <div className="space-y-3">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center flex-shrink-0">
                  <Check size={11} className="text-cyan-300" />
                </div>
                <span className="text-sm text-slate-300">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full max-w-md">
          <div className="text-center mb-6 lg:hidden">
            <div className="flex justify-center mb-4"><BrandWordmark compact /></div>
            <h1 className="text-2xl font-display text-slate-50">Create your account</h1>
          </div>
          <div className="hidden lg:block mb-6">
            <h2 className="text-xl font-bold text-slate-100">Create your account</h2>
            <p className="text-sm text-slate-500 mt-1">Free forever. No credit card required.</p>
          </div>

          <div className="card p-8 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="name"
                type="text"
                label="Full name"
                placeholder="Jane Smith"
                value={name}
                onChange={e => setName(e.target.value)}
                error={errors.name}
                autoComplete="name"
                autoFocus
              />

              <Input
                id="email"
                type="email"
                label="Email address"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                error={errors.email}
                autoComplete="email"
              />

              <div className="w-full">
                <label htmlFor="password" className="label">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
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
                Create account
                <ArrowRight size={16} />
              </Button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
