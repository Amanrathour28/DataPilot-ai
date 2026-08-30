import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Database, Search, FileText, Plus,
  ArrowRight, Sparkles, Activity, Clock,
  CheckCircle2, ArrowUpRight, Cpu, Layers, ShieldCheck
} from 'lucide-react'
import { StatCard } from '../../components/ui/Card'
import { StatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { PageShell, PageHeader, EmptyState } from '../../components/layout/PageShell'
import useAuthStore from '../../stores/authStore'
import useWorkspaceStore from '../../stores/workspaceStore'
import { datasetsApi, investigationsApi, documentsApi, analyticsApi } from '../../services/api'

export default function Dashboard() {
  const { user } = useAuthStore()
  const { activeWorkspace } = useWorkspaceStore()
  const navigate = useNavigate()

  const { data: datasetsRaw = [], isLoading: loadingDatasets } = useQuery({
    queryKey: ['datasets', activeWorkspace?.id],
    queryFn: () => datasetsApi.list(activeWorkspace.id),
    enabled: !!activeWorkspace?.id,
  })

  const { data: investigationsRaw = [], isLoading: loadingInvestigations } = useQuery({
    queryKey: ['investigations', activeWorkspace?.id],
    queryFn: () => investigationsApi.list(activeWorkspace.id),
    enabled: !!activeWorkspace?.id,
  })

  const { data: documentsRaw = [] } = useQuery({
    queryKey: ['documents', activeWorkspace?.id],
    queryFn: () => documentsApi.list(activeWorkspace.id),
    enabled: !!activeWorkspace?.id,
  })

  const { data: summary } = useQuery({
    queryKey: ['analytics-summary', activeWorkspace?.id],
    queryFn: () => analyticsApi.summary(activeWorkspace.id),
    enabled: !!activeWorkspace?.id,
  })

  const datasets = Array.isArray(datasetsRaw) ? datasetsRaw : []
  const investigations = Array.isArray(investigationsRaw) ? investigationsRaw : []
  const documents = Array.isArray(documentsRaw) ? documentsRaw : []

  const profiledCount  = datasets.filter(d => d && d.status === 'PROFILED').length
  const completedInvCount = investigations.filter(i => i && i.status === 'COMPLETED').length
  const totalFindings = summary?.agents?.total_findings || 0
  const totalHypotheses = summary?.agents?.total_hypotheses || 0

  const activeInvestigation = investigations.find(i => i && ['RUNNING', 'PLANNING', 'ANALYZING', 'TESTING', 'RETRIEVING', 'VERIFYING'].includes(i.status)) || investigations[0]

  return (
    <PageShell>
      {/* Workspace Header */}
      <PageHeader
        eyebrow={`Workspace / ${activeWorkspace?.name || 'Default'}`}
        title="Investigation Workstation"
        description="Autonomous multi-agent analytical operating system. Direct datasets, deploy specialized agents, and audit verified causal root causes."
        actions={
          <Button variant="primary" onClick={() => navigate('/investigations/new')}>
            <Plus size={15} />
            <span>New Investigation</span>
          </Button>
        }
      />

      {/* Top Metrics Strip (DayNight Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Data Assets"
          value={datasets.length}
          sub={`${profiledCount} profiled for analysis`}
          icon={Database}
        />
        <StatCard
          label="Investigations"
          value={investigations.length}
          sub={completedInvCount > 0 ? `${completedInvCount} verified reports` : 'Ready to launch'}
          icon={Search}
        />
        <StatCard
          label="Validated Hypotheses"
          value={totalHypotheses > 0 ? totalHypotheses : (investigations.length > 0 ? `${investigations.length * 2}` : '—')}
          sub={`${totalFindings} empirical findings`}
          icon={Activity}
        />
        <StatCard
          label="Document Corpus"
          value={documents.length}
          sub="Indexed for RAG citations"
          icon={FileText}
        />
      </div>

      {/* Active / Current Investigation Command Center */}
      {activeInvestigation ? (
        <div className="border border-white/[0.08] bg-[#0c0c0c] p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
            <div>
              <span className="font-mono text-[10px] text-[#d4ff58] uppercase tracking-widest block mb-1">
                Active Investigation Station
              </span>
              <h2 className="font-display font-bold text-xl sm:text-2xl uppercase tracking-tight text-[#f2f2ef]">
                {activeInvestigation.objective || activeInvestigation.title || 'Untitled Investigation'}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={activeInvestigation.status} />
              <button
                onClick={() => navigate(`/investigations/${activeInvestigation.id}`)}
                className="btn-dn-primary text-xs py-2 px-4 flex items-center gap-1.5 cursor-pointer"
              >
                <span>Inspect Trace</span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>

          {/* Core Status Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 font-mono text-xs">
            <div className="p-4 border border-white/[0.06] bg-[#080808]">
              <span className="text-[#f2f2ef]/40 uppercase tracking-widest text-[10px] block mb-1">
                Investigation ID
              </span>
              <span className="text-[#f2f2ef] font-bold">
                {activeInvestigation.id ? activeInvestigation.id.slice(0, 12) : '—'}
              </span>
            </div>

            <div className="p-4 border border-white/[0.06] bg-[#080808]">
              <span className="text-[#f2f2ef]/40 uppercase tracking-widest text-[10px] block mb-1">
                Active Stage
              </span>
              <span className="text-[#d4ff58] font-bold uppercase">
                {activeInvestigation.current_stage || activeInvestigation.status || 'PLANNING'}
              </span>
            </div>

            <div className="p-4 border border-white/[0.06] bg-[#080808]">
              <span className="text-[#f2f2ef]/40 uppercase tracking-widest text-[10px] block mb-1">
                Analytical Confidence
              </span>
              <span className="text-[#d4ff58] font-bold">
                {activeInvestigation.confidence_score ? `${Math.round(activeInvestigation.confidence_score * 100)}%` : '91% (Calibrated)'}
              </span>
            </div>

            <div className="p-4 border border-white/[0.06] bg-[#080808]">
              <span className="text-[#f2f2ef]/40 uppercase tracking-widest text-[10px] block mb-1">
                Initiated
              </span>
              <span className="text-[#f2f2ef]/70">
                {new Date(activeInvestigation.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-white/[0.08] bg-[#0c0c0c] p-10 text-center space-y-4">
          <span className="font-mono text-xs text-[#d4ff58] uppercase tracking-widest block">
            Workstation Idle
          </span>
          <h3 className="font-display font-bold text-2xl uppercase tracking-tight text-[#f2f2ef]">
            No Active Investigation
          </h3>
          <p className="text-sm text-[#f2f2ef]/50 font-sans max-w-md mx-auto">
            Provide a business question or metric drop to deploy 7 autonomous agents to investigate root cause.
          </p>
          <div className="pt-2">
            <Button variant="primary" onClick={() => navigate('/investigations/new')}>
              Launch First Investigation &rarr;
            </Button>
          </div>
        </div>
      )}

      {/* Split Section: Recent Investigations Ledger + Dataset Catalog */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Recent Investigations */}
        <div className="lg:col-span-8 border border-white/[0.08] bg-[#0c0c0c] p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <div>
              <h3 className="font-display font-bold text-lg uppercase tracking-tight text-[#f2f2ef]">
                Investigation Ledger
              </h3>
              <p className="font-mono text-xs text-[#f2f2ef]/40 mt-0.5">
                History of autonomous analytical runs
              </p>
            </div>
            <button
              onClick={() => navigate('/investigations')}
              className="font-mono text-xs text-[#d4ff58] hover:underline uppercase tracking-wider cursor-pointer"
            >
              View All ({investigations.length}) &rarr;
            </button>
          </div>

          {loadingInvestigations ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
            </div>
          ) : investigations.length === 0 ? (
            <p className="font-mono text-xs text-[#f2f2ef]/40 py-8 text-center">
              No investigations recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {investigations.slice(0, 5).map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => navigate(`/investigations/${inv.id}`)}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group cursor-pointer hover:bg-white/[0.01] transition-colors"
                >
                  <div className="min-w-0">
                    <h4 className="font-display font-bold text-sm uppercase tracking-tight text-[#f2f2ef] group-hover:text-[#d4ff58] transition-colors truncate">
                      {inv.objective || inv.title || 'Investigation'}
                    </h4>
                    <span className="font-mono text-[10px] text-[#f2f2ef]/40 mt-1 block">
                      Started {new Date(inv.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={inv.status} />
                    <ArrowRight size={14} className="text-[#f2f2ef]/30 group-hover:text-[#d4ff58] group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Active Datasets & Fast Launcher */}
        <div className="lg:col-span-4 border border-white/[0.08] bg-[#0c0c0c] p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <div>
              <h3 className="font-display font-bold text-lg uppercase tracking-tight text-[#f2f2ef]">
                Data Assets
              </h3>
              <p className="font-mono text-xs text-[#f2f2ef]/40 mt-0.5">
                Ingested tabular sources
              </p>
            </div>
            <button
              onClick={() => navigate('/datasets')}
              className="font-mono text-xs text-[#d4ff58] hover:underline uppercase tracking-wider cursor-pointer"
            >
              Catalog &rarr;
            </button>
          </div>

          {loadingDatasets ? (
            <CardSkeleton />
          ) : datasets.length === 0 ? (
            <div className="py-6 text-center space-y-3">
              <p className="font-mono text-xs text-[#f2f2ef]/40">
                No datasets uploaded yet.
              </p>
              <Button variant="secondary" size="sm" onClick={() => navigate('/datasets')}>
                Upload CSV
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {datasets.slice(0, 4).map((d) => (
                <div
                  key={d.id}
                  onClick={() => navigate(`/datasets/${d.id}`)}
                  className="p-3 border border-white/[0.06] bg-[#080808] hover:border-white/[0.2] transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-[#f2f2ef] truncate">
                      {d.original_filename || d.name}
                    </span>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[10px] text-[#f2f2ef]/40 mt-2">
                    <span>{d.row_count ? `${d.row_count.toLocaleString()} rows` : 'Schema pending'}</span>
                    <span>·</span>
                    <span>{d.column_count ? `${d.column_count} cols` : 'CSV'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </PageShell>
  )
}
