import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useToast } from '../ui/Toast'
import useAuthStore from '../../stores/authStore'

export default function GoogleAuthButton({ mode = 'signin', disabled = false }) {
  const [loading, setLoading] = useState(false)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [scriptError, setScriptError] = useState(false)
  const buttonContainerRef = useRef(null)

  const { loginWithGoogle } = useAuthStore()
  const toast = useToast()
  const navigate = useNavigate()

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  // 1. Script Loading & GIS Initialization
  useEffect(() => {
    if (!googleClientId) return

    const initializeGis = () => {
      if (!window.google?.accounts?.id) return

      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        setScriptLoaded(true)

        if (buttonContainerRef.current) {
          buttonContainerRef.current.innerHTML = ''
          window.google.accounts.id.renderButton(buttonContainerRef.current, {
            theme: 'filled_black',
            size: 'large',
            type: 'standard',
            shape: 'rectangular',
            text: mode === 'signup' ? 'signup_with' : 'signin_with',
            logo_alignment: 'left',
            width: buttonContainerRef.current.offsetWidth || 384,
          })
        }
      } catch (initErr) {
        console.warn('[Google Auth] Identity initialization note:', initErr)
      }
    }

    if (window.google?.accounts?.id) {
      initializeGis()
    } else if (!document.getElementById('google-client-script')) {
      const script = document.createElement('script')
      script.id = 'google-client-script'
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = () => {
        initializeGis()
      }
      script.onerror = () => {
        setScriptError(true)
      }
      document.body.appendChild(script)
    } else {
      const existingScript = document.getElementById('google-client-script')
      existingScript.addEventListener('load', initializeGis)
    }
  }, [googleClientId, mode])

  useEffect(() => {
    if (scriptLoaded && window.google?.accounts?.id && buttonContainerRef.current) {
      try {
        buttonContainerRef.current.innerHTML = ''
        window.google.accounts.id.renderButton(buttonContainerRef.current, {
          theme: 'filled_black',
          size: 'large',
          type: 'standard',
          shape: 'rectangular',
          text: mode === 'signup' ? 'signup_with' : 'signin_with',
          logo_alignment: 'left',
          width: buttonContainerRef.current.offsetWidth || 384,
        })
      } catch (renderErr) {
        console.warn('[Google Auth] renderButton note:', renderErr)
      }
    }
  }, [scriptLoaded, mode])

  // 2. Credential Response Handler
  const handleGoogleCredentialResponse = async (response) => {
    if (!response?.credential) {
      toast?.show('Google sign-in was cancelled.', 'warning')
      return
    }

    setLoading(true)
    try {
      const res = await loginWithGoogle(response.credential)
      if (res.success) {
        toast?.show('Signed in with Google successfully!', 'success')
        navigate('/dashboard')
      } else {
        toast?.show(res.error || 'Failed to authenticate with Google.', 'error')
      }
    } catch (err) {
      toast?.show(err.message || 'Google authentication error.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleFallbackClick = () => {
    if (loading || disabled) return

    if (!googleClientId) {
      toast?.show('Google authentication is temporarily unavailable. Please sign in with email and password.', 'info')
      return
    }

    if (scriptError) {
      toast?.show('Google sign-in service failed to load. Please check your network connection.', 'error')
      return
    }

    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt()
      } catch (promptErr) {
        console.warn('[Google Auth] Prompt note:', promptErr)
      }
    }
  }

  return (
    <div className="w-full">
      {/* Container where Google's interactive button is mounted when available */}
      {googleClientId && scriptLoaded && (
        <div
          ref={buttonContainerRef}
          className={loading || disabled ? 'opacity-50 pointer-events-none w-full flex justify-center' : 'w-full flex justify-center'}
        />
      )}

      {/* Styled DayNight button fallback / standard presentation */}
      {(!googleClientId || !scriptLoaded) && (
        <button
          type="button"
          onClick={handleFallbackClick}
          disabled={disabled || loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-white/[0.12] bg-[#0d0d0d] hover:bg-[#141414] hover:border-white/[0.25] text-[#f2f2ef] font-mono text-xs uppercase tracking-wider transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin text-[#d4ff58]" />
          ) : (
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>{mode === 'signup' ? 'Sign up with Google' : 'Continue with Google'}</span>
        </button>
      )}
    </div>
  )
}
