import React, { useState, useEffect } from 'react'
import {
  Users,
  UserPlus,
  Shield,
  Mail,
  CheckCircle2,
  Trash2,
  Copy,
  Check,
  X,
  Clock,
  Building2,
  AlertCircle,
} from 'lucide-react'
import { PageShell } from '../../components/layout/PageShell'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import useOrganizationStore from '../../stores/organizationStore'
import useWorkspaceStore from '../../stores/workspaceStore'
import useAuthStore from '../../stores/authStore'
import { organizationsApi } from '../../services/api'
import { useToast } from '../../components/ui/Toast'

export default function TeamPage() {
  const { activeOrganization } = useOrganizationStore()
  const { workspaces } = useWorkspaceStore()
  const { user } = useAuthStore()
  const toast = useToast()

  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('MEMBER')
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [copiedToken, setCopiedToken] = useState(null)

  const isOrgAdmin =
    activeOrganization?.user_role === 'OWNER' || activeOrganization?.user_role === 'ADMIN'

  const loadData = async () => {
    if (!activeOrganization?.id) return
    try {
      setIsLoading(true)
      const [membersData, invitesData] = await Promise.all([
        organizationsApi.members(activeOrganization.id),
        isOrgAdmin ? organizationsApi.invitations(activeOrganization.id) : Promise.resolve([]),
      ])
      setMembers(membersData || [])
      setInvitations(invitesData || [])
    } catch (err) {
      toast?.show('Failed to load team members', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [activeOrganization?.id, activeOrganization?.user_role])

  const handleInviteSubmit = async (e) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !activeOrganization?.id) return
    try {
      setIsInviting(true)
      const newInv = await organizationsApi.createInvitation(activeOrganization.id, {
        email: inviteEmail.trim(),
        role: inviteRole,
        workspace_id: inviteWorkspaceId || undefined,
      })
      toast?.show(`Invitation issued for ${inviteEmail}`, 'success')
      setInviteEmail('')
      setShowInviteModal(false)
      loadData()
    } catch (err) {
      toast?.show(err.response?.data?.detail || 'Failed to send invitation', 'error')
    } finally {
      setIsInviting(false)
    }
  }

  const handleRoleChange = async (targetUserId, newRole) => {
    try {
      await organizationsApi.updateMemberRole(activeOrganization.id, targetUserId, newRole)
      toast?.show('Member role updated', 'success')
      setMembers((prev) =>
        prev.map((m) => (m.user_id === targetUserId ? { ...m, role: newRole } : m))
      )
    } catch (err) {
      toast?.show(err.response?.data?.detail || 'Failed to update role', 'error')
    }
  }

  const handleRemoveMember = async (targetUserId, name) => {
    if (!confirm(`Are you sure you want to remove ${name} from this organization?`)) return
    try {
      await organizationsApi.removeMember(activeOrganization.id, targetUserId)
      toast?.show('Member removed from organization', 'info')
      setMembers((prev) => prev.filter((m) => m.user_id !== targetUserId))
    } catch (err) {
      toast?.show(err.response?.data?.detail || 'Failed to remove member', 'error')
    }
  }

  const handleRevokeInvite = async (inviteId) => {
    try {
      await organizationsApi.revokeInvitation(activeOrganization.id, inviteId)
      toast?.show('Invitation revoked', 'info')
      setInvitations((prev) => prev.filter((i) => i.id !== inviteId))
    } catch (err) {
      toast?.show('Failed to revoke invitation', 'error')
    }
  }

  const copyInviteLink = (token) => {
    const origin = window.location.origin
    const link = `${origin}/invite/${token}`
    navigator.clipboard.writeText(link)
    setCopiedToken(token)
    toast?.show('Invitation link copied to clipboard', 'info')
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const ownersCount = members.filter((m) => m.role === 'OWNER').length
  const adminsCount = members.filter((m) => m.role === 'ADMIN').length

  return (
    <PageShell className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#c8ff00]">
              ORGANIZATION / {activeOrganization?.name?.toUpperCase() || 'COMPANY'}
            </span>
            <span className="text-[#f2f2ef]/20">/</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#f2f2ef]/40">
              ROSTER
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#f2f2ef] tracking-tight">
            Team & Access Governance
          </h1>
          <p className="font-sans text-xs text-[#f2f2ef]/60 mt-1 max-w-2xl">
            Manage multi-user memberships, roles, workspace permissions, and secure invitations for{' '}
            <span className="text-[#f2f2ef] font-semibold">{activeOrganization?.name}</span>.
          </p>
        </div>

        {isOrgAdmin && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-1.5 font-mono text-xs cursor-pointer"
          >
            <UserPlus size={13} />
            <span>Invite Colleague →</span>
          </Button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 border-white/[0.08]">
          <span className="font-mono text-[9px] uppercase tracking-widest text-[#f2f2ef]/40 block mb-1">
            TOTAL MEMBERS
          </span>
          <span className="font-serif text-2xl text-[#f2f2ef]">{members.length}</span>
        </Card>
        <Card className="p-4 border-white/[0.08]">
          <span className="font-mono text-[9px] uppercase tracking-widest text-[#f2f2ef]/40 block mb-1">
            OWNERS & ADMINS
          </span>
          <span className="font-serif text-2xl text-[#c8ff00]">{ownersCount + adminsCount}</span>
        </Card>
        <Card className="p-4 border-white/[0.08]">
          <span className="font-mono text-[9px] uppercase tracking-widest text-[#f2f2ef]/40 block mb-1">
            PENDING INVITES
          </span>
          <span className="font-serif text-2xl text-[#f2f2ef]/70">{invitations.length}</span>
        </Card>
        <Card className="p-4 border-white/[0.08]">
          <span className="font-mono text-[9px] uppercase tracking-widest text-[#f2f2ef]/40 block mb-1">
            YOUR ROLE
          </span>
          <Badge variant="primary" className="mt-1 font-mono text-[10px]">
            {activeOrganization?.user_role || 'MEMBER'}
          </Badge>
        </Card>
      </div>

      {/* Members Table */}
      <Card className="border-white/[0.08] p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-[#c8ff00]" />
            <span className="font-mono text-xs uppercase tracking-wider text-[#f2f2ef] font-semibold">
              ACTIVE COLLABORATORS ({members.length})
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] bg-black/40 font-mono text-[10px] uppercase tracking-widest text-[#f2f2ef]/40">
                <th className="py-3 px-5">Member</th>
                <th className="py-3 px-5">Role</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Joined</th>
                {isOrgAdmin && <th className="py-3 px-5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {members.map((m) => {
                const isSelf = m.user_id === user?.id
                return (
                  <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 bg-white/[0.08] border border-white/[0.1] text-[#f2f2ef] font-mono text-xs font-bold flex items-center justify-center shrink-0">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#f2f2ef]">{m.name}</span>
                            {isSelf && (
                              <span className="px-1.5 py-0.2 rounded bg-white/[0.08] font-mono text-[9px] text-[#f2f2ef]/60">
                                YOU
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[11px] text-[#f2f2ef]/40">{m.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      {isOrgAdmin && !isSelf && m.role !== 'OWNER' ? (
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                          className="bg-black border border-white/[0.12] px-2 py-1 text-xs font-mono text-[#f2f2ef] focus:border-[#c8ff00] focus:outline-none"
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="MEMBER">MEMBER</option>
                          <option value="VIEWER">VIEWER</option>
                        </select>
                      ) : (
                        <Badge
                          variant={
                            m.role === 'OWNER'
                              ? 'primary'
                              : m.role === 'ADMIN'
                              ? 'info'
                              : 'secondary'
                          }
                          className="font-mono text-[10px]"
                        >
                          {m.role}
                        </Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-1.5 text-xs text-[#f2f2ef]/70">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#c8ff00]" />
                        <span className="font-mono text-[11px]">{m.status}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[11px] text-[#f2f2ef]/40">
                      {new Date(m.joined_at).toLocaleDateString()}
                    </td>
                    {isOrgAdmin && (
                      <td className="py-3.5 px-5 text-right">
                        {!isSelf && m.role !== 'OWNER' && (
                          <button
                            onClick={() => handleRemoveMember(m.user_id, m.name)}
                            className="text-[#f2f2ef]/30 hover:text-red-400 p-1 transition-colors cursor-pointer"
                            title="Remove member"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pending Invitations Section */}
      {isOrgAdmin && (
        <Card className="border-white/[0.08] p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-[#c8ff00]" />
              <span className="font-mono text-xs uppercase tracking-wider text-[#f2f2ef] font-semibold">
                PENDING INVITATIONS ({invitations.length})
              </span>
            </div>
          </div>

          {invitations.length === 0 ? (
            <div className="py-8 text-center font-mono text-xs text-[#f2f2ef]/40">
              No pending invitations for this organization.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-black/40 font-mono text-[10px] uppercase tracking-widest text-[#f2f2ef]/40">
                    <th className="py-3 px-5">Invited Email</th>
                    <th className="py-3 px-5">Assigned Role</th>
                    <th className="py-3 px-5">Target Workspace</th>
                    <th className="py-3 px-5">Expires</th>
                    <th className="py-3 px-5 text-right">Link & Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-white/[0.02]">
                      <td className="py-3.5 px-5 font-mono text-xs text-[#f2f2ef]">{inv.email}</td>
                      <td className="py-3.5 px-5">
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {inv.role}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-[11px] text-[#f2f2ef]/60">
                        {workspaces.find((w) => w.id === inv.workspace_id)?.name || 'General'}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-[11px] text-[#f2f2ef]/40">
                        {new Date(inv.expires_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => copyInviteLink(inv.token)}
                            className="flex items-center gap-1 font-mono text-[10px] py-1 px-2"
                          >
                            {copiedToken === inv.token ? (
                              <>
                                <Check size={11} className="text-[#c8ff00]" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={11} />
                                <span>Copy Link</span>
                              </>
                            )}
                          </Button>
                          <button
                            onClick={() => handleRevokeInvite(inv.id)}
                            className="text-[#f2f2ef]/30 hover:text-red-400 p-1 transition-colors cursor-pointer"
                            title="Revoke invitation"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md border border-white/[0.12] bg-[#0c0c0c] p-6 font-sans space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#c8ff00]">
                INVITE TEAM MEMBER
              </span>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-[#f2f2ef]/40 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#f2f2ef]/50 mb-1">
                  Colleague's Work Email
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="analyst@company.com"
                  className="w-full px-3 py-2 bg-black border border-white/[0.12] text-xs font-mono text-[#f2f2ef] focus:border-[#c8ff00] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#f2f2ef]/50 mb-1">
                    Organization Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-white/[0.12] text-xs font-mono text-[#f2f2ef] focus:border-[#c8ff00] focus:outline-none"
                  >
                    <option value="MEMBER">MEMBER (Investigate & Upload)</option>
                    <option value="ADMIN">ADMIN (Manage Team & Workspace)</option>
                    <option value="VIEWER">VIEWER (Read-only Access)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#f2f2ef]/50 mb-1">
                    Initial Workspace
                  </label>
                  <select
                    value={inviteWorkspaceId}
                    onChange={(e) => setInviteWorkspaceId(e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-white/[0.12] text-xs font-mono text-[#f2f2ef] focus:border-[#c8ff00] focus:outline-none"
                  >
                    <option value="">Default (All / General)</option>
                    {workspaces.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 bg-white/[0.02] border border-white/[0.06] text-xs text-[#f2f2ef]/60 leading-relaxed font-sans">
                The invited colleague will receive a secure token to join{' '}
                <span className="text-[#f2f2ef] font-semibold">{activeOrganization?.name}</span> with
                the selected permissions.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-xs font-mono text-[#f2f2ef]/60 hover:text-white border border-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="btn-dn-primary px-4 py-2 text-xs font-mono"
                >
                  {isInviting ? 'Sending...' : 'Generate & Send Invite →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  )
}
