import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, AlertCircle, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
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
      setErrors({ form: result.error || 'Invalid email or password.' })
      toast?.show(result.error || 'Invalid email or password.', 'error')
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
      toast?.show(result.error || 'Demo sign-in failed. Please try again.', 'error')
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] text-[#f2f2ef] flex flex-col justify-between p-6 sm:p-10 font-sans selection:bg-[#d4ff58] selection:text-black">
      
      {/* Top Header */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between pb-8 border-b border-white/[0.08]">
        <Link to="/" className="inline-block group">
          <BrandWordmark compact />
        </Link>
        <Link
          to="/"
          className="font-mono text-xs uppercase tracking-widest text-[#f2f2ef]/50 hover:text-[#d4ff58] transition-colors"
        >
          &larr; Back to Home
        </Link>
      </div>

      {/* Main Editorial Form Container */}
      <div className="w-full max-w-[460px] mx-auto py-12 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-8"
        >
          {/* Eyebrow & Headline */}
          <div>
            <div className="editorial-label mb-3">
              <span className="num">/</span>
              <span>Authentication</span>
            </div>
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl uppercase tracking-tight text-[#f2f2ef] leading-[0.95]">
              Welcome<br />Back<span className="text-[#d4ff58]">.</span>
            </h1>
            <p className="text-sm text-[#f2f2ef]/55 font-sans mt-3">
              Continue your autonomous multi-agent investigation.
            </p>
          </div>

          {/* Google Sign-In */}
          <div className="space-y-6">
            <GoogleAuthButton mode="signin" disabled={isLoading} />

            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-white/[0.08]" />
              <span className="font-mono text-[10px] text-[#f2f2ef]/40 uppercase tracking-widest">
                Or Continue With Email
              </span>
              <div className="h-px flex-1 bg-white/[0.08]" />
            </div>
          </div>

          {/* Form Error Banner */}
          {errors.form && (
            <div className="p-3.5 bg-[#ff4e4e]/10 border border-[#ff4e4e]/20 text-xs font-mono text-[#ff4e4e] flex items-start gap-2.5">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <span>{errors.form}</span>
            </div>
          )}

          {/* Form Fields */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="label">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (errors.email || errors.form) setErrors((prev) => ({ ...prev, email: '', form: '' }))
                }}
                autoComplete="email"
                autoFocus
                disabled={isLoading}
                className={`input ${errors.email ? 'border-[#ff4e4e]' : ''}`}
              />
              {errors.email && (
                <p className="font-mono text-[11px] text-[#ff4e4e] mt-1">{errors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="label m-0">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  tabIndex={-1}
                  className="font-mono text-[11px] text-[#d4ff58] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errors.password || errors.form) setErrors((prev) => ({ ...prev, password: '', form: '' }))
                  }}
                  autoComplete="current-password"
                  disabled={isLoading}
                  className={`input pr-10 ${errors.password ? 'border-[#ff4e4e]' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#f2f2ef]/40 hover:text-[#f2f2ef] transition-colors cursor-pointer"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && (
                <p className="font-mono text-[11px] text-[#ff4e4e] mt-1">{errors.password}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-dn-primary w-full py-4 flex items-center justify-between px-6 group cursor-pointer mt-4"
            >
              <span>{isLoading ? 'Signing in…' : 'Sign in'}</span>
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              )}
            </button>

            {/* One-click Demo Button */}
            <button
              type="button"
              onClick={handleDemoSignIn}
              disabled={isLoading}
              className="w-full py-3 border border-white/[0.08] bg-[#0c0c0c] hover:bg-[#121212] hover:border-white/[0.18] text-[#f2f2ef]/70 hover:text-[#f2f2ef] font-mono text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer text-center"
            >
              <span>One-Click Demo Workspace</span>
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="pt-6 border-t border-white/[0.08] text-center font-mono text-xs text-[#f2f2ef]/50">
            <span>Don&apos;t have an account? </span>
            <Link
              to="/register"
              className="text-[#d4ff58] hover:underline font-semibold ml-1 uppercase tracking-wider"
            >
              Sign up &rarr;
            </Link>
          </div>

        </motion.div>
      </div>

      {/* Bottom Footer Metadata */}
      <div className="w-full max-w-5xl mx-auto pt-8 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[11px] text-[#f2f2ef]/40">
        <span>&copy; {new Date().getFullYear()} DataPilot AI. All rights reserved.</span>
        <div className="flex items-center gap-4">
          <span>Encrypted Auth</span>
          <span>·</span>
          <span>Zero-Knowledge Tokens</span>
        </div>
      </div>

    </div>
  )
}
