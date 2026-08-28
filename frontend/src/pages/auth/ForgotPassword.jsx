import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
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
      // Security: Even if API throws or rate limits, show generic response or specific server error
      const msg = apiErr.response?.data?.detail || 'Request processed. Please check your email.'
      toast?.show(msg, 'info')
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen app-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-8">
          <Link to="/"><BrandWordmark /></Link>
        </div>

        <div className="card p-8 shadow-2xl border border-slate-800 rounded-2xl bg-[#0e0e1a]">
          {!submitted ? (
            <div>
              <div className="text-center mb-6">
                <div className="inline-flex p-3 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 mb-3">
                  <Mail size={22} />
                </div>
                <h1 className="text-2xl font-display text-slate-50 font-bold">Reset your password</h1>
                <p className="text-slate-400 mt-1.5 text-xs leading-relaxed">
                  Enter the email address associated with your account and we&apos;ll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  id="email"
                  type="email"
                  label="Email address"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (error) setError('')
                  }}
                  error={error}
                  autoComplete="email"
                  autoFocus
                  disabled={loading}
                />

                <Button
                  type="submit"
                  variant="primary"
                  loading={loading}
                  disabled={loading}
                  className="w-full mt-4"
                  size="lg"
                >
                  {loading ? 'Sending link…' : 'Send Reset Link'}
                  {!loading && <ArrowRight size={15} />}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-slate-800/80 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors font-medium"
                >
                  <ArrowLeft size={13} /> Back to Sign in
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-2 space-y-5">
              <div className="inline-flex p-3.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 size={26} />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-100">Check your inbox</h2>
                <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                  If an account exists for <span className="font-semibold text-slate-200">{email}</span>, we&apos;ve sent a secure password reset link.
                </p>
                <p className="text-[11px] text-slate-500">
                  The link will expire in 15 minutes. Be sure to check your spam folder.
                </p>
              </div>

              <div className="pt-4 space-y-3">
                <Link to="/login">
                  <Button variant="outline" className="w-full" size="md">
                    <ArrowLeft size={14} /> Return to Sign in
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false)
                    setEmail('')
                  }}
                  className="text-xs text-brand-400 hover:text-brand-300 transition-colors block mx-auto pt-1"
                >
                  Didn&apos;t receive it? Try another email
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
