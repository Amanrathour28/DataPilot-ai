import { NavLink, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard,
  Database,
  FileText,
  Search,
  Settings,
  LogOut,
  ChevronDown,
  Plus,
  Bot,
  BarChart3,
  Brain,
} from 'lucide-react'
import useAuthStore from '../../stores/authStore'
import useWorkspaceStore from '../../stores/workspaceStore'
import { useState } from 'react'
import { BrandWordmark } from '../ui/Logo'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/investigations', label: 'Investigations', icon: Search },
  { to: '/datasets',       label: 'Datasets',        icon: Database },
  { to: '/knowledge',      label: 'Knowledge',  icon: FileText },
  { to: '/agents',         label: 'Agents',  icon: Bot },
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
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-white/[0.04] transition-colors text-left border border-transparent hover:border-white/[0.06]"
      >
        <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-400/25 flex items-center justify-center flex-shrink-0">
          <span className="text-cyan-300 text-xs font-bold">
            {activeWorkspace.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100 truncate">{activeWorkspace.name}</p>
          <p className="text-[11px] text-slate-500 truncate">Workspace</p>
        </div>
        <ChevronDown size={14} className={clsx('text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 glass rounded-xl shadow-2xl z-50 py-1 overflow-hidden">
          {workspaces.map(ws => (
            <button
              key={ws.id}
              onClick={() => { setActiveWorkspace(ws); setOpen(false) }}
              className={clsx(
                'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/[0.05] transition-colors',
                activeWorkspace.id === ws.id ? 'text-cyan-300' : 'text-slate-300'
              )}
            >
              <div className="w-5 h-5 rounded bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
                <span className="text-cyan-300 text-[10px] font-bold">{ws.name.charAt(0)}</span>
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
    <aside className="w-[260px] flex-shrink-0 flex flex-col h-full relative z-20 border-r border-white/[0.06] bg-[#07090e]/80 backdrop-blur-xl">
      <div className="px-4 py-5">
        <BrandWordmark />
      </div>

      <div className="px-3 pb-3">
        <WorkspaceSwitcher />
      </div>

      <div className="px-3 pb-3">
        <button
          onClick={() => navigate('/investigations/new')}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                     bg-gradient-to-b from-cyan-300 to-cyan-600 text-cyan-950 text-sm font-semibold
                     transition-all shadow-lg shadow-cyan-500/15 hover:brightness-110"
        >
          <Plus size={15} />
          New Investigation
        </button>
      </div>

      <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto">
        <p className="section-title mt-2">Workspace</p>

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

      <div className="border-t border-white/[0.06] px-3 py-3">
        <div className="flex items-center gap-2.5 px-1.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-violet-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
            <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-white/[0.04]"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
