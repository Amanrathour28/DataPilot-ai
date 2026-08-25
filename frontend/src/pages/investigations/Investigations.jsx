import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus, Clock, ArrowRight, Activity, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/Badge'
import { useNavigate } from 'react-router-dom'
import useWorkspaceStore from '../../stores/workspaceStore'
import { investigationsApi } from '../../services/api'

export default function Investigations() {
  const navigate = useNavigate()
  const { activeWorkspace } = useWorkspaceStore()
  const [search, setSearch] = useState('')

  const { data: investigations = [], isLoading, refetch } = useQuery({
    queryKey: ['investigations', activeWorkspace?.id],
    queryFn: () => investigationsApi.list(activeWorkspace.id),
    enabled: !!activeWorkspace?.id,
    refetchInterval: (data) => {
      const hasRunning = data?.some(inv => inv.status === 'RUNNING' || inv.status === 'PENDING')
      return hasRunning ? 3000 : false
    },
  })

  const filtered = investigations.filter(inv =>
    inv.title?.toLowerCase().includes(search.toLowerCase()) ||
    inv.objective?.toLowerCase().includes(search.toLowerCase())
  )

  if (!activeWorkspace) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-slate-100">Investigations</h1>
            <p className="text-sm text-slate-500 mt-0.5">Loading workspace…</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Investigations</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {investigations.length} investigation{investigations.length !== 1 ? 's' : ''} in this workspace
          </p>
        </div>
        <div className="flex items-center gap-2">
          <IconButton icon={RefreshCw} label="Refresh" onClick={() => refetch()} />
          <Button variant="primary" onClick={() => navigate('/investigations/new')}>
            <Plus size={15} /> New Investigation
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      {investigations.length > 0 && (
        <div className="relative max-w-md mb-6">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search investigations by title or objective…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9 text-sm"
          />
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : investigations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1e1e35] flex items-center justify-center mb-5">
            <Search size={28} className="text-slate-600" />
          </div>
          <h2 className="text-base font-semibold text-slate-200 mb-2">No investigations yet</h2>
          <p className="text-sm text-slate-500 max-w-xs mb-6">
            Ask a business question and let AI agents autonomously investigate your data.
          </p>
          <Button variant="primary" onClick={() => navigate('/investigations/new')}>
            <Plus size={15} /> Start First Investigation
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-500 text-sm">No investigations match &ldquo;{search}&rdquo;</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(inv => (
            <div
              key={inv.id}
              onClick={() => navigate(`/investigations/${inv.id}`)}
              className="card p-5 hover:border-brand-500/40 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <StatusBadge status={inv.status} />
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(inv.created_at).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-200 text-sm group-hover:text-brand-300 transition-colors line-clamp-2">
                  {inv.title || inv.objective}
                </h3>
                <p className="text-xs text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                  {inv.objective}
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Confidence: <strong className="text-slate-300 font-semibold">{Math.round((inv.confidence_score || 0) * 100)}%</strong>
                </span>
                <span className="flex items-center gap-1 text-brand-400 group-hover:translate-x-0.5 transition-transform">
                  View Report <ArrowRight size={13} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
