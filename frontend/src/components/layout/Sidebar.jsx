import { NavLink, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard,
  Database,
  FileText,
  Search,
  Activity,
  Settings,
  LogOut,
  ChevronDown,
  Plus,
  Bot,
  BarChart3,
  Brain,
  Sparkles,
} from 'lucide-react'
import useAuthStore from '../../stores/authStore'
import useWorkspaceStore from '../../stores/workspaceStore'
import { useState } from 'react'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/investigations', label: 'Investigations', icon: Search },
  { to: '/datasets',       label: 'Datasets',        icon: Database },
  { to: '/knowledge',      label: 'Knowledge Base',  icon: FileText },
  { to: '/agents',         label: 'Agent Activity',  icon: Bot },
  { to: '/analytics',      label: 'Analytics',       icon: BarChart3 },
  { to: '/memory',         label: 'Memory',          icon: Brain },
]

function WorkspaceSwitcher() {
  const { activeWorkspace, workspaces, setActiveWorkspace } = useWorkspaceStore()
  const [open, setOpen] = useState(false)

  if (!activeWorkspace) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#1e1e35] transition-colors text-left"
      >
        <div className="w-7 h-7 rounded-lg bg-brand-600/30 border border-brand-600/40 flex items-center justify-center flex-shrink-0">
          <span className="text-brand-400 text-xs font-bold">
            {activeWorkspace.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">{activeWorkspace.name}</p>
          <p className="text-xs text-slate-500 truncate">Workspace</p>
        </div>
        <ChevronDown size={14} className={clsx('text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1c1c32] border border-[#2a2a4a] rounded-xl shadow-xl z-50 py-1">
          {workspaces.map(ws => (
            <button
              key={ws.id}
              onClick={() => { setActiveWorkspace(ws); setOpen(false) }}
              className={clsx(
                'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#252542] transition-colors',
                activeWorkspace.id === ws.id ? 'text-brand-400' : 'text-slate-300'
              )}
            >
              <div className="w-5 h-5 rounded bg-brand-600/20 flex items-center justify-center flex-shrink-0">
                <span className="text-brand-400 text-xs font-bold">{ws.name.charAt(0)}</span>
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

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col h-full bg-[#0d0d1f] border-r border-[#1e1e35]">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#1e1e35]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-slate-100 text-sm tracking-tight">DataPilot</span>
            <span className="text-brand-400 text-xs font-medium ml-1">AI</span>
          </div>
        </div>
      </div>

      {/* Workspace Switcher */}
      <div className="px-3 py-3 border-b border-[#1e1e35]">
        <WorkspaceSwitcher />
      </div>

      {/* New Investigation CTA */}
      <div className="px-3 pt-3">
        <button
          onClick={() => navigate('/investigations/new')}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg
                     bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium
                     transition-colors shadow-lg shadow-brand-600/20"
        >
          <Plus size={15} />
          New Investigation
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <p className="section-title mt-2">Navigation</p>

        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx('sidebar-item', isActive && 'active')
            }
          >
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}

        <div className="divider" />
        <p className="section-title">System</p>

        <NavLink
          to="/settings"
          className={({ isActive }) => clsx('sidebar-item', isActive && 'active')}
        >
          <Settings size={16} />
          <span>Settings</span>
        </NavLink>
      </nav>

      {/* User Profile */}
      <div className="border-t border-[#1e1e35] px-3 py-3">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="text-slate-500 hover:text-red-400 transition-colors"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
