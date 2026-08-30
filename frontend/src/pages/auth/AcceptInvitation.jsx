import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Building2, UserPlus, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react'
import { organizationsApi } from '../../services/api'
import useAuthStore from '../../stores/authStore'
import useOrganizationStore from '../../stores/organizationStore'
import useWorkspaceStore from '../../stores/workspaceStore'
import { BrandWordmark } from '../../components/ui/Logo'
import { useToast } from '../../components/ui/Toast'

export default function AcceptInvitation() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { user, token: authToken } = useAuthStore()
  const { fetchOrganizations, setActiveOrganization } = useOrganizationStore()
  const { fetchWorkspaces } = useWorkspaceStore()
  const toast = useToast()

  const [invite, setInvite] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAccepting, setIsAccepting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadInvite = async () => {
      try {
        setIsLoading(true)
        const data = await organizationsApi.getInvitation(token)
        setInvite(data)
      } catch (err) {
        setError(err.response?.data?.detail || 'Invalid or expired invitation token.')
      } finally {
        setIsLoading(false)
      }
    }
    if (token) loadInvite()
  }, [token])

  const handleAccept = async () => {
    if (!authToken) {
      navigate(`/login?redirect=/invite/${token}`)
      return
    }

    try {
      setIsAccepting(true)
      const org = await organizationsApi.acceptInvitation(token)
      toast?.show(`Joined ${org.name} successfully!`, 'success')
      await fetchOrganizations()
      setActiveOrganization(org)
      await fetchWorkspaces(org.id)
      navigate('/dashboard')
    } catch (err) {
      toast?.show(err.response?.data?.detail || 'Failed to accept invitation', 'error')
    } finally {
      setIsAccepting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#070707] text-[#f2f2ef] flex flex-col justify-center items-center p-6 select-none font-sans">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <BrandWordmark />
        </div>

        <div className="border border-white/[0.12] bg-[#0c0c0c] p-6 sm:p-8 space-y-6 shadow-2xl">
          {isLoading ? (
            <div className="py-12 text-center font-mono text-xs text-[#f2f2ef]/40 animate-pulse">
              Validating organization invitation...
            </div>
          ) : error ? (
            <div className="space-y-4 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <AlertCircle size={18} />
              </div>
              <h2 className="font-serif text-xl text-[#f2f2ef]">Invitation Invalid</h2>
              <p className="font-sans text-xs text-[#f2f2ef]/60">{error}</p>
              <Link to="/login" className="btn-dn-secondary inline-block px-4 py-2 text-xs font-mono">
                Return to Sign In →
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <div className="w-10 h-10 mx-auto bg-[#c8ff00]/10 border border-[#c8ff00]/30 flex items-center justify-center text-[#c8ff00]">
                  <Building2 size={20} />
                </div>
                <h2 className="font-serif text-2xl text-[#f2f2ef] tracking-tight">
                  Join {invite?.organization_name}
                </h2>
                <p className="font-sans text-xs text-[#f2f2ef]/60">
                  <span className="text-[#f2f2ef] font-semibold">{invite?.invited_by_name || 'An administrator'}</span>{' '}
                  has invited you to collaborate as a{' '}
                  <span className="text-[#c8ff00] font-mono font-bold">{invite?.role}</span> in DataPilot AI.
                </p>
              </div>

              <div className="border border-white/[0.08] bg-black/50 p-4 space-y-2 font-mono text-xs">
                <div className="flex justify-between text-[#f2f2ef]/60">
                  <span>Organization:</span>
                  <span className="text-[#f2f2ef] font-semibold">{invite?.organization_name}</span>
                </div>
                <div className="flex justify-between text-[#f2f2ef]/60">
                  <span>Workspace:</span>
                  <span className="text-[#f2f2ef]">{invite?.workspace_name || 'General'}</span>
                </div>
                <div className="flex justify-between text-[#f2f2ef]/60">
                  <span>Invited Email:</span>
                  <span className="text-[#f2f2ef]">{invite?.email}</span>
                </div>
                <div className="flex justify-between text-[#f2f2ef]/60">
                  <span>Role Permissions:</span>
                  <span className="text-[#c8ff00]">{invite?.role}</span>
                </div>
              </div>

              {authToken ? (
                <button
                  onClick={handleAccept}
                  disabled={isAccepting}
                  className="btn-dn-primary w-full py-3 text-xs flex items-center justify-center gap-2 cursor-pointer font-mono font-bold"
                >
                  <span>{isAccepting ? 'Joining Workspace...' : 'Accept Invitation & Enter →'}</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <div className="space-y-3">
                  <Link
                    to={`/register?email=${encodeURIComponent(invite?.email || '')}&redirect=/invite/${token}`}
                    className="btn-dn-primary w-full py-3 text-xs flex items-center justify-center gap-2 font-mono font-bold"
                  >
                    <span>Create Account & Join →</span>
                  </Link>
                  <Link
                    to={`/login?email=${encodeURIComponent(invite?.email || '')}&redirect=/invite/${token}`}
                    className="btn-dn-secondary w-full py-2.5 text-xs flex items-center justify-center gap-2 font-mono text-center block"
                  >
                    <span>Already have an account? Sign In</span>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
