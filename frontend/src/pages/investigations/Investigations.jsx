import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus, Clock, ArrowRight, Activity, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/Badge'
import { useNavigate } from 'react-router-dom'
import { PageShell, PageHeader, EmptyState } from '../../components/layout/PageShell'
import useWorkspaceStore from '../../stores/workspaceStore'
import { investigationsApi } from '../../services/api'

export default function Investigations() {
  const navigate = useNavigate()
  const { activeWorkspace } = useWorkspaceStore()
  const [search, setSearch] = useState('')

  const { data: investigationsRaw = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['investigations', activeWorkspace?.id],
    queryFn: () => investigationsApi.list(activeWorkspace.id),
    enabled: !!activeWorkspace?.id,
    refetchInterval: (data, query) => {
      if (query?.state?.error) return false
      const hasRunning = Array.isArray(data) && data.some(inv => inv && ['RUNNING', 'PENDING'].includes(inv.status))
      return hasRunning ? 3000 : false
    },
  })

  const investigations = Array.isArray(investigationsRaw) ? investigationsRaw : []

  const filtered = investigations.filter(inv => {
    if (!inv) return false
    const titleStr = (inv.title || '').toLowerCase()
    const objStr = (inv.objective || '').toLowerCase()
    const q = (search || '').toLowerCase()
    return titleStr.includes(q) || objStr.includes(q)
  })

  if (!activeWorkspace) {
    return (
      <PageShell>
        <PageHeader eyebrow="Agents" title="Investigations" description="Loading workspace…" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Agents"
        title="Investigations"
        description={`${investigations.length} investigation${investigations.length !== 1 ? 's' : ''} in “${activeWorkspace.name}”`}
        actions={
          <div className="flex items-center gap-2">
            <IconButton icon={RefreshCw} label="Refresh" onClick={() => refetch()} />
            <Button variant="primary" onClick={() => navigate('/investigations/new')}>
              <Plus size={15} /> New Investigation
            </Button>
          </div>
        }
      />

      {/* Error state alert */}
      {isError && (
        <div className="card p-5 border border-red-500/30 bg-red-500/10 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-red-300">Failed to load investigations</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {error?.response?.data?.detail || error?.message || 'Could not connect to backend server.'}
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            <RefreshCw size={14} /> Retry
          </Button>
        </div>
      )}

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
      ) : filtered.length === 0 && investigations.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No investigations yet"
          description="Ask a business question and let AI agents autonomously investigate your data."
          action={
            <Button variant="primary" onClick={() => navigate('/investigations/new')}>
              <Plus size={15} /> Start first investigation
            </Button>
          }
        />
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
              className="card p-5 hover:border-cyan-400/30 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <StatusBadge status={inv.status} />
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock size={12} />
                    {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-100 text-sm group-hover:text-cyan-300 transition-colors line-clamp-2">
                  {inv.title || inv.objective || 'Untitled Investigation'}
                </h3>
                <p className="text-xs text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                  {inv.objective || '—'}
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-500">
                <span>
                  Confidence: <strong className="text-slate-300 font-semibold">{Math.round(((inv.confidence_score || 0)) * 100)}%</strong>
                </span>
                <span className="flex items-center gap-1 text-cyan-400 group-hover:translate-x-0.5 transition-transform">
                  View Report <ArrowRight size={13} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  )
}
