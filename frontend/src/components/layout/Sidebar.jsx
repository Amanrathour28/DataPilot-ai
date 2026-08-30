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
} from 'lucide-react'
import { useState } from 'react'
import useAuthStore from '../../stores/authStore'
import useWorkspaceStore from '../../stores/workspaceStore'
import { BrandWordmark } from '../ui/Logo'

const NAV_ITEMS = [
  { to: '/dashboard',      label: 'Overview',        icon: LayoutDashboard, category: 'WORKSPACE' },
  { to: '/investigations', label: 'Investigations',  icon: Search,          category: 'WORKSPACE' },
  { to: '/datasets',       label: 'Datasets',         icon: Database,        category: 'DATA' },
  { to: '/knowledge',      label: 'Documents (RAG)',  icon: FileText,        category: 'DATA' },
  { to: '/agents',         label: 'Agents Swarm',     icon: Cpu,             category: 'SYSTEM' },
  { to: '/analytics',      label: 'Analytics',        icon: BarChart3,       category: 'SYSTEM' },
  { to: '/memory',         label: 'Memory Bank',      icon: Brain,           category: 'SYSTEM' },
  { to: '/settings',       label: 'Settings',         icon: Settings,        category: 'SYSTEM' },
]

function WorkspaceSwitcher() {
  const { activeWorkspace, workspaces, setActiveWorkspace } = useWorkspaceStore()
  const [open, setOpen] = useState(false)

  if (!activeWorkspace) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-white/[0.08] bg-[#0c0c0c] hover:border-white/[0.2] transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-4 h-4 bg-[#d4ff58] text-black font-mono font-bold text-[10px] flex items-center justify-center flex-shrink-0">
            {activeWorkspace.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-mono text-xs text-[#f2f2ef] font-semibold truncate leading-none">
              {activeWorkspace.name}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#f2f2ef]/40 mt-1">
              Workspace
            </p>
          </div>
        </div>
        <ChevronDown
          size={12}
          className={clsx('text-[#f2f2ef]/40 transition-transform flex-shrink-0', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#0f0f0f] border border-white/[0.12] z-50 py-1 shadow-2xl">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => { setActiveWorkspace(ws); setOpen(false) }}
              className={clsx(
                'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-mono transition-colors text-left cursor-pointer',
                activeWorkspace.id === ws.id
                  ? 'bg-white/[0.06] text-[#d4ff58]'
                  : 'text-[#f2f2ef]/70 hover:bg-white/[0.03] hover:text-[#f2f2ef]'
              )}
            >
              <div className="w-3.5 h-3.5 bg-white/[0.1] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                {ws.name.charAt(0)}
              </div>
              <span className="truncate">{ws.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  return (
    <aside className="w-[230px] flex-shrink-0 flex flex-col h-full border-r border-white/[0.08] bg-[#090909]">
      
      {/* Brand Header */}
      <div className="p-5 border-b border-white/[0.08]">
        <button onClick={() => navigate('/dashboard')} className="text-left cursor-pointer">
          <BrandWordmark compact />
        </button>
      </div>

      {/* Workspace Selector */}
      <div className="p-3 border-b border-white/[0.08]">
        <WorkspaceSwitcher />
      </div>

      {/* Action Button */}
      <div className="p-3">
        <button
          onClick={() => navigate('/investigations/new')}
          className="btn-dn-primary w-full py-2.5 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus size={14} />
          <span>New Investigation</span>
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-6" aria-label="Sidebar navigation">
        
        {/* Workspace */}
        <div className="space-y-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#f2f2ef]/30 px-3 block mb-2">
            WORKSPACE
          </span>
          {NAV_ITEMS.filter(i => i.category === 'WORKSPACE').map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => clsx('sidebar-item', isActive && 'active')}
            >
              <Icon size={14} />
              <span className="font-mono text-xs">{label}</span>
            </NavLink>
          ))}
        </div>

        {/* Data */}
        <div className="space-y-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#f2f2ef]/30 px-3 block mb-2">
            DATA ASSETS
          </span>
          {NAV_ITEMS.filter(i => i.category === 'DATA').map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => clsx('sidebar-item', isActive && 'active')}
            >
              <Icon size={14} />
              <span className="font-mono text-xs">{label}</span>
            </NavLink>
          ))}
        </div>

        {/* System */}
        <div className="space-y-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#f2f2ef]/30 px-3 block mb-2">
            SYSTEM ENGINE
          </span>
          {NAV_ITEMS.filter(i => i.category === 'SYSTEM').map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => clsx('sidebar-item', isActive && 'active')}
            >
              <Icon size={14} />
              <span className="font-mono text-xs">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* User Footer */}
      <div className="border-t border-white/[0.08] p-3 bg-[#070707]">
        <div className="flex items-center justify-between gap-2 p-1.5">
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
            onClick={() => { logout(); navigate('/login') }}
            title="Sign out"
            className="text-[#f2f2ef]/40 hover:text-[#ff4e4e] transition-colors p-1 cursor-pointer"
            aria-label="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

    </aside>
  )
}
