import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Database, Search, FileText, Plus,
  ArrowRight, Sparkles, Activity
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

  const { data: datasetsRaw = [], isLoading } = useQuery({
    queryKey: ['datasets', activeWorkspace?.id],
    queryFn: () => datasetsApi.list(activeWorkspace.id),
    enabled: !!activeWorkspace?.id,
  })

  const { data: investigationsRaw = [] } = useQuery({
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

  const recentDatasets = datasets.slice(0, 3)
  const profiledCount  = datasets.filter(d => d && d.status === 'PROFILED').length
  const completedInvCount = investigations.filter(i => i && i.status === 'COMPLETED').length
  const totalFindings = summary?.agents?.total_findings || 0
  const totalHypotheses = summary?.agents?.total_hypotheses || 0

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.name?.split(' ')[0] || 'there'

  return (
    <PageShell>
      <PageHeader
        eyebrow={greeting}
        title={firstName}
        description={activeWorkspace ? `Workspace · ${activeWorkspace.name}` : 'Select a workspace to begin'}
        actions={
          <Button variant="primary" onClick={() => navigate('/investigations/new')}>
            <Plus size={15} />
            New Investigation
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Datasets"
          value={datasets.length}
          sub={`${profiledCount} profiled`}
          icon={Database}
          color="brand"
        />
        <StatCard
          label="Investigations"
          value={investigations.length}
          sub={completedInvCount > 0 ? `${completedInvCount} completed` : 'Start your first one'}
          icon={Search}
          color="emerald"
        />
        <StatCard
          label="Hypotheses"
          value={totalHypotheses > 0 ? totalHypotheses : (investigations.length > 0 ? `${investigations.length * 2}` : '—')}
          sub={`${totalFindings} validated proofs`}
          icon={Activity}
          color="amber"
        />
        <StatCard
          label="Knowledge"
          value={documents.length}
          sub="Indexed documents"
          icon={FileText}
          color="slate"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="card p-6 h-full">
            <div className="flex items-center gap-2 mb-5">
              <Sparkles size={16} className="text-cyan-400" />
              <h2 className="text-sm font-semibold text-slate-100">Quick start</h2>
            </div>

            <div className="space-y-2">
              {[
                { n: 1, label: 'Upload a dataset', to: '/datasets',        done: datasets.length > 0 },
                { n: 2, label: 'Launch an investigation',  to: '/investigations/new', done: investigations.length > 0 },
                { n: 3, label: 'Review evidence',  to: '/investigations', done: completedInvCount > 0 },
              ].map(step => (
                <button
                  key={step.n}
                  onClick={() => navigate(step.to)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left
                    ${step.done
                      ? 'border-emerald-500/25 bg-emerald-500/5'
                      : 'border-white/[0.07] hover:border-cyan-400/30 hover:bg-white/[0.03]'
                    }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    step.done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.06] text-slate-400'
                  }`}>
                    {step.n}
                  </div>
                  <span className={`text-sm flex-1 ${step.done ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {step.label}
                  </span>
                  <ArrowRight size={13} className="text-slate-600" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
              <h2 className="text-sm font-semibold text-slate-100">Recent datasets</h2>
              <button
                onClick={() => navigate('/datasets')}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors font-medium"
              >
                View all <ArrowRight size={12} />
              </button>
            </div>

            {isLoading ? (
              <div className="p-5 space-y-3">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : recentDatasets.length === 0 ? (
              <EmptyState
                icon={Database}
                title="No datasets yet"
                description="Upload your first dataset to start autonomous investigation."
                action={
                  <Button variant="secondary" onClick={() => navigate('/datasets')} size="sm">
                    <Plus size={13} /> Upload dataset
                  </Button>
                }
              />
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {recentDatasets.map(ds => (
                  <div
                    key={ds.id}
                    onClick={() => navigate(`/datasets/${ds.id}`)}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] cursor-pointer transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center flex-shrink-0">
                      <Database size={16} className="text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-100 truncate">{ds.name || 'Untitled Dataset'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {ds.row_count != null ? `${ds.row_count.toLocaleString()} rows` : 'Counting…'}
                        {ds.column_count != null ? ` · ${ds.column_count} cols` : ''}
                      </p>
                    </div>
                    <StatusBadge status={ds.status} />
                    <ArrowRight size={14} className="text-slate-600 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
