import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, AlertCircle, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { BrandWordmark } from '../../components/ui/Logo'
import useAuthStore from '../../stores/authStore'
import GoogleAuthButton from '../../components/auth/GoogleAuthButton'
import PasswordStrengthIndicator, { checkPasswordCriteria } from '../../components/auth/PasswordStrengthIndicator'
import { useToast } from '../../components/ui/Toast'

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
      e.password = 'Password must include uppercase, lowercase, and numbers'
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

      {/* Main Container */}
      <div className="w-full max-w-[480px] mx-auto py-12 md:py-16">
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
              <span>New Account</span>
            </div>
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl uppercase tracking-tight text-[#f2f2ef] leading-[0.95]">
              Get Started<span className="text-[#d4ff58]">.</span>
            </h1>
            <p className="text-sm text-[#f2f2ef]/55 font-sans mt-3">
              Start autonomous multi-agent data investigations in seconds.
            </p>
          </div>

          {/* Google Sign-Up */}
          <div className="space-y-6">
            <GoogleAuthButton mode="signup" disabled={isLoading} />

            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-white/[0.08]" />
              <span className="font-mono text-[10px] text-[#f2f2ef]/40 uppercase tracking-widest">
                Or Register With Email
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
            
            {/* Name Field */}
            <div className="space-y-1.5">
              <label htmlFor="name" className="label">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (errors.name || errors.form) setErrors((prev) => ({ ...prev, name: '', form: '' }))
                }}
                autoComplete="name"
                autoFocus
                disabled={isLoading}
                className={`input ${errors.name ? 'border-[#ff4e4e]' : ''}`}
              />
              {errors.name && (
                <p className="font-mono text-[11px] text-[#ff4e4e] mt-1">{errors.name}</p>
              )}
            </div>

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
                disabled={isLoading}
                className={`input ${errors.email ? 'border-[#ff4e4e]' : ''}`}
              />
              {errors.email && (
                <p className="font-mono text-[11px] text-[#ff4e4e] mt-1">{errors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errors.password || errors.form) setErrors((prev) => ({ ...prev, password: '', form: '' }))
                  }}
                  autoComplete="new-password"
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
              <PasswordStrengthIndicator password={password} />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-dn-primary w-full py-4 flex items-center justify-between px-6 group cursor-pointer mt-6"
            >
              <span>{isLoading ? 'Creating account…' : 'Create Account'}</span>
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              )}
            </button>
          </form>

          {/* Sign In Link */}
          <div className="pt-6 border-t border-white/[0.08] text-center font-mono text-xs text-[#f2f2ef]/50">
            <span>Already have an account? </span>
            <Link
              to="/login"
              className="text-[#d4ff58] hover:underline font-semibold ml-1 uppercase tracking-wider"
            >
              Sign in &rarr;
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
