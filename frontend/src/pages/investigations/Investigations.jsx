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
        <PageHeader eyebrow="Workspace" title="Investigations" description="Loading workspace…" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Registry"
        title="Investigations"
        description={`${investigations.length} recorded investigation${investigations.length !== 1 ? 's' : ''} in workspace “${activeWorkspace.name}”`}
        actions={
          <div className="flex items-center gap-3">
            <IconButton icon={RefreshCw} label="Refresh" onClick={() => refetch()} />
            <Button variant="primary" onClick={() => navigate('/investigations/new')}>
              <Plus size={15} />
              <span>New Investigation</span>
            </Button>
          </div>
        }
      />

      {/* Error state alert */}
      {isError && (
        <div className="p-4 border border-[#ff4e4e]/30 bg-[#ff4e4e]/10 text-xs font-mono text-[#ff4e4e] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="flex-shrink-0" />
            <span>{error?.response?.data?.detail || error?.message || 'Could not connect to backend server.'}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Search Input Bar */}
      {investigations.length > 0 && (
        <div className="relative max-w-lg">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#f2f2ef]/40" />
          <input
            type="text"
            placeholder="Search by question, objective, or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-10 text-xs font-mono"
          />
        </div>
      )}

      {/* Content List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={search ? 'No matching investigations' : 'No investigations recorded'}
          description={search ? `No results matching "${search}". Try another query.` : 'Start an autonomous investigation to analyze anomalies and test hypotheses.'}
          action={
            !search && (
              <Button variant="primary" onClick={() => navigate('/investigations/new')}>
                Start First Investigation &rarr;
              </Button>
            )
          }
        />
      ) : (
        <div className="border border-white/[0.08] bg-[#0c0c0c] divide-y divide-white/[0.06]">
          {filtered.map((inv) => (
            <div
              key={inv.id}
              onClick={() => navigate(`/investigations/${inv.id}`)}
              className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors cursor-pointer group"
            >
              <div className="min-w-0 space-y-1.5 flex-1 pr-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-[#f2f2ef]/40 uppercase tracking-widest">
                    ID {inv.id.slice(0, 8)}
                  </span>
                  <StatusBadge status={inv.status} />
                </div>
                <h3 className="font-display font-bold text-base sm:text-lg uppercase tracking-tight text-[#f2f2ef] group-hover:text-[#d4ff58] transition-colors">
                  {inv.objective || inv.title || 'Untitled Investigation'}
                </h3>
                <div className="flex items-center gap-4 font-mono text-[11px] text-[#f2f2ef]/40">
                  <span>Started {new Date(inv.created_at).toLocaleString()}</span>
                  {inv.dataset_name && (
                    <>
                      <span>&middot;</span>
                      <span>Dataset: {inv.dataset_name}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-right font-mono text-xs hidden sm:block">
                  <span className="text-[#f2f2ef]/40 block text-[10px] uppercase">Confidence</span>
                  <span className="font-bold text-[#d4ff58]">
                    {inv.confidence_score ? `${Math.round(inv.confidence_score * 100)}%` : 'Calibrated'}
                  </span>
                </div>
                <ArrowRight size={16} className="text-[#f2f2ef]/30 group-hover:text-[#d4ff58] group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  )
}
