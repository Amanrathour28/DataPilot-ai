import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { BrandWordmark } from '../../components/ui/Logo'
import { authApi } from '../../services/api'
import { useToast } from '../../components/ui/Toast'
import PasswordStrengthIndicator, { checkPasswordCriteria } from '../../components/auth/PasswordStrengthIndicator'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const toast = useToast()

  const [verifying, setVerifying] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenEmail, setTokenEmail] = useState('')
  const [tokenErrorMsg, setTokenErrorMsg] = useState('')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setVerifying(false)
      setTokenValid(false)
      setTokenErrorMsg('No password reset token provided in the link.')
      return
    }

    const checkToken = async () => {
      setVerifying(true)
      try {
        const res = await authApi.verifyResetToken(token)
        if (res.valid) {
          setTokenValid(true)
          setTokenEmail(res.email || '')
        } else {
          setTokenValid(false)
          setTokenErrorMsg(res.message || 'This reset link is invalid or has expired.')
        }
      } catch (err) {
        setTokenValid(false)
        setTokenErrorMsg(err.response?.data?.detail || 'Failed to verify reset token.')
      } finally {
        setVerifying(false)
      }
    }

    checkToken()
  }, [token])

  const validate = () => {
    const e = {}
    const criteria = checkPasswordCriteria(password)

    if (!criteria.minLength) {
      e.password = 'Password must be at least 8 characters long'
    } else if (!criteria.hasUpper || !criteria.hasLower || !criteria.hasNumber) {
      e.password = 'Password must include uppercase, lowercase, and numeric characters'
    }

    if (!confirmPassword) {
      e.confirmPassword = 'Please confirm your new password'
    } else if (password !== confirmPassword) {
      e.confirmPassword = 'Passwords do not match'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate() || submitting) return

    setSubmitting(true)
    try {
      await authApi.resetPassword(token, password)
      setResetSuccess(true)
      toast?.show('Password updated successfully! Please sign in.', 'success')
      setTimeout(() => {
        navigate('/login')
      }, 2500)
    } catch (apiErr) {
      const msg = apiErr.response?.data?.detail || 'Failed to reset password. The link may have expired.'
      setErrors({ form: msg })
      toast?.show(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen app-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-8">
          <Link to="/"><BrandWordmark /></Link>
        </div>

        <div className="card p-8 shadow-2xl border border-slate-800 rounded-2xl bg-[#0e0e1a]">
          {verifying ? (
            <div className="py-12 text-center space-y-3">
              <Loader2 size={24} className="animate-spin text-brand-400 mx-auto" />
              <p className="text-xs text-slate-400 font-medium">Verifying reset token…</p>
            </div>
          ) : !tokenValid ? (
            <div className="text-center py-4 space-y-4">
              <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <AlertCircle size={24} />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-slate-100">Invalid or Expired Link</h2>
                <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                  {tokenErrorMsg || 'This password reset link has expired or has already been used.'}
                </p>
              </div>
              <div className="pt-2">
                <Link to="/forgot-password">
                  <Button variant="primary" className="w-full" size="md">
                    Request a New Reset Link
                  </Button>
                </Link>
              </div>
            </div>
          ) : resetSuccess ? (
            <div className="text-center py-4 space-y-4">
              <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 size={26} />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-slate-100">Password Reset Complete</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Your password has been updated. Redirecting you to Sign In…
                </p>
              </div>
              <div className="pt-2">
                <Link to="/login">
                  <Button variant="primary" className="w-full" size="md">
                    Sign in Now <ArrowRight size={14} />
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-center mb-6">
                <div className="inline-flex p-3 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 mb-3">
                  <KeyRound size={22} />
                </div>
                <h1 className="text-2xl font-display text-slate-50 font-bold">Set new password</h1>
                {tokenEmail && (
                  <p className="text-slate-400 mt-1 text-xs">
                    Resetting password for <span className="text-slate-200 font-semibold">{tokenEmail}</span>
                  </p>
                )}
              </div>

              {errors.form && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-start gap-2 mb-4">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  <span>{errors.form}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New Password */}
                <div>
                  <label htmlFor="password" className="label text-xs font-semibold text-slate-300">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Minimum 8 characters"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (errors.password) setErrors((prev) => ({ ...prev, password: '' }))
                      }}
                      autoComplete="new-password"
                      className={`input pr-10 ${errors.password ? 'border-red-500/60' : ''}`}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-[11px] text-red-400 mt-1">{errors.password}</p>}
                  <PasswordStrengthIndicator password={password} />
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="confirmPassword" className="label text-xs font-semibold text-slate-300">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPass ? 'text' : 'password'}
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value)
                        if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: '' }))
                      }}
                      autoComplete="new-password"
                      className={`input pr-10 ${errors.confirmPassword ? 'border-red-500/60' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showConfirmPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-[11px] text-red-400 mt-1">{errors.confirmPassword}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  loading={submitting}
                  disabled={submitting}
                  className="w-full mt-4"
                  size="lg"
                >
                  {submitting ? 'Updating Password…' : 'Reset Password'}
                  {!submitting && <ArrowRight size={15} />}
                </Button>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors font-medium"
                >
                  <ArrowLeft size={13} /> Back to Sign in
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
