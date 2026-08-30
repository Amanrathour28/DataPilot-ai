import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { BrandWordmark } from '../../components/ui/Logo'
import { authApi } from '../../services/api'
import { useToast } from '../../components/ui/Toast'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()

  const validateEmail = (val) => {
    if (!val.trim()) return 'Email address is required'
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!re.test(val.trim())) return 'Please enter a valid email address'
    return ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = validateEmail(email)
    if (err) {
      setError(err)
      return
    }
    setError('')
    setLoading(true)
    try {
      await authApi.forgotPassword(email.trim().toLowerCase())
      setSubmitted(true)
    } catch (apiErr) {
      const msg = apiErr.response?.data?.detail || 'Request processed. Please check your email.'
      toast?.show(msg, 'info')
      setSubmitted(true)
    } finally {
      setLoading(false)
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
          to="/login"
          className="font-mono text-xs uppercase tracking-widest text-[#f2f2ef]/50 hover:text-[#d4ff58] transition-colors"
        >
          &larr; Back to Sign In
        </Link>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-[460px] mx-auto py-12 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-8"
        >
          {!submitted ? (
            <div className="space-y-8">
              <div>
                <div className="editorial-label mb-3">
                  <span className="num">/</span>
                  <span>Recovery</span>
                </div>
                <h1 className="font-display font-extrabold text-4xl sm:text-5xl uppercase tracking-tight text-[#f2f2ef] leading-[0.95]">
                  Reset<br />Password<span className="text-[#d4ff58]">.</span>
                </h1>
                <p className="text-sm text-[#f2f2ef]/55 font-sans mt-3">
                  Enter your email address and we&apos;ll dispatch a secure recovery token.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
                      if (error) setError('')
                    }}
                    autoComplete="email"
                    autoFocus
                    disabled={loading}
                    className={`input ${error ? 'border-[#ff4e4e]' : ''}`}
                  />
                  {error && (
                    <p className="font-mono text-[11px] text-[#ff4e4e] mt-1">{error}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-dn-primary w-full py-4 flex items-center justify-between px-6 group cursor-pointer mt-4"
                >
                  <span>{loading ? 'Sending link…' : 'Send Reset Link'}</span>
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  )}
                </button>
              </form>

              <div className="pt-6 border-t border-white/[0.08] text-center font-mono text-xs text-[#f2f2ef]/50">
                <Link
                  to="/login"
                  className="text-[#f2f2ef]/60 hover:text-[#d4ff58] transition-colors uppercase tracking-wider"
                >
                  &larr; Return to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="editorial-label mb-3">
                <span className="num">✓</span>
                <span>Dispatched</span>
              </div>
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl uppercase tracking-tight text-[#f2f2ef]">
                Check Your Inbox<span className="text-[#d4ff58]">.</span>
              </h2>
              <p className="text-sm text-[#f2f2ef]/60 leading-relaxed font-sans">
                If an account exists for <span className="text-[#f2f2ef] font-mono">{email}</span>, a secure password reset link has been sent.
              </p>

              <div className="pt-4 space-y-4">
                <Link
                  to="/login"
                  className="btn-dn-primary w-full py-3.5 text-center justify-center block"
                >
                  Return to Sign In
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false)
                    setEmail('')
                  }}
                  className="font-mono text-xs text-[#d4ff58] hover:underline uppercase tracking-wider block mx-auto pt-2 cursor-pointer"
                >
                  Try another email &rarr;
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Bottom Footer Metadata */}
      <div className="w-full max-w-5xl mx-auto pt-8 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[11px] text-[#f2f2ef]/40">
        <span>&copy; {new Date().getFullYear()} DataPilot AI. All rights reserved.</span>
        <span>Secure Password Recovery</span>
      </div>

    </div>
  )
}
