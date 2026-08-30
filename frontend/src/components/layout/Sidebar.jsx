import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard,
  Database,
  FileText,
  Search,
  Settings,
  LogOut,
  Plus,
  Cpu,
  BarChart3,
  Brain,
  ChevronDown,
  Building2,
  Users,
  ShieldCheck,
  Check,
  X,
  ListTodo,
} from 'lucide-react'
import useAuthStore from '../../stores/authStore'
import useWorkspaceStore from '../../stores/workspaceStore'
import useOrganizationStore from '../../stores/organizationStore'
import NotificationCenter from './NotificationCenter'
import { BrandWordmark } from '../ui/Logo'

function OrgWorkspaceSwitcher() {
  const { organizations, activeOrganization, setActiveOrganization, fetchOrganizations, createOrganization } =
    useOrganizationStore()
  const { workspaces, activeWorkspace, setActiveWorkspace, fetchWorkspaces, createWorkspace } =
    useWorkspaceStore()

  const [open, setOpen] = useState(false)
  const [showNewOrgModal, setShowNewOrgModal] = useState(false)
  const [showNewWsModal, setShowNewWsModal] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [newWsName, setNewWsName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchOrganizations()
  }, [])

  useEffect(() => {
    if (activeOrganization?.id) {
      fetchWorkspaces(activeOrganization.id)
    }
  }, [activeOrganization?.id])

  const handleCreateOrg = async (e) => {
    e.preventDefault()
    if (!newOrgName.trim()) return
    try {
      setIsSubmitting(true)
      const newOrg = await createOrganization({ name: newOrgName.trim() })
      setNewOrgName('')
      setShowNewOrgModal(false)
      if (newOrg?.id) fetchWorkspaces(newOrg.id)
    } catch (err) {
      console.error('Failed to create organization:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateWs = async (e) => {
    e.preventDefault()
    if (!newWsName.trim() || !activeOrganization?.id) return
    try {
      setIsSubmitting(true)
      await createWorkspace({
        name: newWsName.trim(),
        organization_id: activeOrganization.id,
      })
      setNewWsName('')
      setShowNewWsModal(false)
    } catch (err) {
      console.error('Failed to create workspace:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-white/[0.08] bg-[#0c0c0c] hover:border-white/[0.2] transition-colors text-left cursor-pointer group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-4 h-4 bg-[#c8ff00] text-black font-mono font-bold text-[10px] flex items-center justify-center flex-shrink-0">
              {activeOrganization?.name?.charAt(0)?.toUpperCase() || 'D'}
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[11px] text-[#f2f2ef] font-semibold truncate leading-none">
                {activeOrganization?.name || 'My Organization'}
              </p>
              <p className="font-mono text-[9px] uppercase tracking-widest text-[#f2f2ef]/40 mt-1 truncate">
                {activeWorkspace?.name ? `${activeWorkspace.name} Workspace` : 'Workspace'}
              </p>
            </div>
          </div>
          <ChevronDown
            size={12}
            className={clsx('text-[#f2f2ef]/40 transition-transform flex-shrink-0', open && 'rotate-180')}
          />
        </button>

        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#0c0c0c] border border-white/[0.12] z-50 py-2 shadow-2xl divide-y divide-white/[0.06] font-sans">
            {/* Organizations Selection */}
            <div className="px-3 py-1.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#f2f2ef]/40 block mb-1.5">
                COMPANIES
              </span>
              <div className="space-y-0.5 max-h-28 overflow-y-auto">
                {organizations.map((org) => {
                  const isSelected = activeOrganization?.id === org.id
                  return (
                    <button
                      key={org.id}
                      onClick={() => {
                        setActiveOrganization(org)
                        fetchWorkspaces(org.id)
                      }}
                      className={clsx(
                        'w-full flex items-center justify-between px-2 py-1.5 text-xs font-mono transition-colors text-left cursor-pointer',
                        isSelected ? 'bg-white/[0.08] text-[#c8ff00]' : 'text-[#f2f2ef]/70 hover:bg-white/[0.03] hover:text-[#f2f2ef]'
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Building2 size={12} className={isSelected ? 'text-[#c8ff00]' : 'text-[#f2f2ef]/40'} />
                        <span className="truncate">{org.name}</span>
                      </div>
                      {isSelected && <Check size={11} className="text-[#c8ff00] shrink-0" />}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => {
                  setOpen(false)
                  setShowNewOrgModal(true)
                }}
                className="w-full mt-1.5 flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono text-[#c8ff00] hover:underline cursor-pointer"
              >
                <Plus size={11} />
                <span>New Organization</span>
              </button>
            </div>

            {/* Workspaces under Active Org */}
            <div className="px-3 py-1.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#f2f2ef]/40 block mb-1.5">
                WORKSPACES
              </span>
              <div className="space-y-0.5 max-h-28 overflow-y-auto">
                {workspaces.map((ws) => {
                  const isSelected = activeWorkspace?.id === ws.id
                  return (
                    <button
                      key={ws.id}
                      onClick={() => {
                        setActiveWorkspace(ws)
                        setOpen(false)
                      }}
                      className={clsx(
                        'w-full flex items-center justify-between px-2 py-1.5 text-xs font-mono transition-colors text-left cursor-pointer',
                        isSelected ? 'bg-white/[0.08] text-[#c8ff00]' : 'text-[#f2f2ef]/70 hover:bg-white/[0.03] hover:text-[#f2f2ef]'
                      )}
                    >
                      <span className="truncate">{ws.name}</span>
                      {isSelected && <Check size={11} className="text-[#c8ff00] shrink-0" />}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => {
                  setOpen(false)
                  setShowNewWsModal(true)
                }}
                className="w-full mt-1.5 flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono text-[#c8ff00] hover:underline cursor-pointer"
              >
                <Plus size={11} />
                <span>Create Workspace</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: New Organization */}
      {showNewOrgModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm border border-white/[0.12] bg-[#0c0c0c] p-5 font-sans space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#f2f2ef]/60">
                CREATE ORGANIZATION
              </span>
              <button onClick={() => setShowNewOrgModal(false)} className="text-[#f2f2ef]/40 hover:text-white">
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleCreateOrg} className="space-y-3">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#f2f2ef]/50 mb-1">
                  Company / Organization Name
                </label>
                <input
                  type="text"
                  required
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="e.g. Acme Analytics"
                  className="w-full px-3 py-2 bg-black border border-white/[0.12] text-xs font-mono text-[#f2f2ef] focus:border-[#c8ff00] focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewOrgModal(false)}
                  className="px-3 py-1.5 text-xs font-mono text-[#f2f2ef]/60 hover:text-white border border-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-dn-primary px-3 py-1.5 text-xs font-mono"
                >
                  {isSubmitting ? 'Creating...' : 'Create Company →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Workspace */}
      {showNewWsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm border border-white/[0.12] bg-[#0c0c0c] p-5 font-sans space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#f2f2ef]/60">
                CREATE WORKSPACE
              </span>
              <button onClick={() => setShowNewWsModal(false)} className="text-[#f2f2ef]/40 hover:text-white">
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleCreateWs} className="space-y-3">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#f2f2ef]/50 mb-1">
                  Workspace Department / Name
                </label>
                <input
                  type="text"
                  required
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  placeholder="e.g. Marketing or Finance"
                  className="w-full px-3 py-2 bg-black border border-white/[0.12] text-xs font-mono text-[#f2f2ef] focus:border-[#c8ff00] focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewWsModal(false)}
                  className="px-3 py-1.5 text-xs font-mono text-[#f2f2ef]/60 hover:text-white border border-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-dn-primary px-3 py-1.5 text-xs font-mono"
                >
                  {isSubmitting ? 'Creating...' : 'Create Workspace →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  return (
    <aside className="w-[230px] flex-shrink-0 flex flex-col h-full border-r border-white/[0.08] bg-[#090909] select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
        <button onClick={() => navigate('/dashboard')} className="text-left cursor-pointer">
          <BrandWordmark compact />
        </button>
        <NotificationCenter />
      </div>

      {/* Multi-Tenant Switcher */}
      <div className="p-3 border-b border-white/[0.08]">
        <OrgWorkspaceSwitcher />
      </div>

      {/* Primary Action Button */}
      <div className="p-3">
        <button
          onClick={() => navigate('/investigations/new')}
          className="btn-dn-primary w-full py-2 text-xs flex items-center justify-center gap-1.5 cursor-pointer font-mono"
        >
          <Plus size={13} />
          <span>New Investigation</span>
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto space-y-5 font-sans" aria-label="Sidebar navigation">
        {/* Workspace */}
        <div className="space-y-0.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#f2f2ef]/30 px-3 block mb-1">
            WORKSPACE
          </span>
          <NavLink to="/dashboard" className={({ isActive }) => clsx('sidebar-item', isActive && 'active')}>
            <LayoutDashboard size={13} />
            <span className="font-mono text-xs">Overview</span>
          </NavLink>
          <NavLink to="/investigations" className={({ isActive }) => clsx('sidebar-item', isActive && 'active')}>
            <Search size={13} />
            <span className="font-mono text-xs">Investigations</span>
          </NavLink>
          <NavLink to="/investigations?filter=assigned" className={({ isActive }) => clsx('sidebar-item', isActive && 'active')}>
            <ListTodo size={13} />
            <span className="font-mono text-xs">My Assigned Tasks</span>
          </NavLink>
        </div>

        {/* Data Assets */}
        <div className="space-y-0.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#f2f2ef]/30 px-3 block mb-1">
            DATA ASSETS
          </span>
          <NavLink to="/datasets" className={({ isActive }) => clsx('sidebar-item', isActive && 'active')}>
            <Database size={13} />
            <span className="font-mono text-xs">Datasets</span>
          </NavLink>
          <NavLink to="/knowledge" className={({ isActive }) => clsx('sidebar-item', isActive && 'active')}>
            <FileText size={13} />
            <span className="font-mono text-xs">Documents (RAG)</span>
          </NavLink>
        </div>

        {/* Intelligence Engine */}
        <div className="space-y-0.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#f2f2ef]/30 px-3 block mb-1">
            INTELLIGENCE
          </span>
          <NavLink to="/analytics" className={({ isActive }) => clsx('sidebar-item', isActive && 'active')}>
            <BarChart3 size={13} />
            <span className="font-mono text-xs">Evidence & Metrics</span>
          </NavLink>
          <NavLink to="/memory" className={({ isActive }) => clsx('sidebar-item', isActive && 'active')}>
            <Brain size={13} />
            <span className="font-mono text-xs">Memory Bank</span>
          </NavLink>
          <NavLink to="/agents" className={({ isActive }) => clsx('sidebar-item', isActive && 'active')}>
            <Cpu size={13} />
            <span className="font-mono text-xs">Agents Swarm</span>
          </NavLink>
        </div>

        {/* Admin & Governance */}
        <div className="space-y-0.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#f2f2ef]/30 px-3 block mb-1">
            ADMIN & GOVERNANCE
          </span>
          <NavLink to="/team" className={({ isActive }) => clsx('sidebar-item', isActive && 'active')}>
            <Users size={13} />
            <span className="font-mono text-xs">Team Members</span>
          </NavLink>
          <NavLink to="/audit-logs" className={({ isActive }) => clsx('sidebar-item', isActive && 'active')}>
            <ShieldCheck size={13} />
            <span className="font-mono text-xs">Audit Logs</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => clsx('sidebar-item', isActive && 'active')}>
            <Settings size={13} />
            <span className="font-mono text-xs">Settings</span>
          </NavLink>
        </div>
      </nav>

      {/* User Footer */}
      <div className="border-t border-white/[0.08] p-3 bg-[#070707]">
        <div className="flex items-center justify-between gap-2 p-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 bg-white/[0.1] text-[#f2f2ef] font-mono font-bold text-[10px] flex items-center justify-center flex-shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="font-mono text-xs font-semibold text-[#f2f2ef] truncate leading-none">
                {user?.name || 'Operator'}
              </p>
              <p className="font-mono text-[9px] text-[#f2f2ef]/40 truncate mt-1">
                {user?.email || 'authenticated'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            title="Sign out"
            className="text-[#f2f2ef]/40 hover:text-[#ff4e4e] transition-colors p-1 cursor-pointer"
            aria-label="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}
