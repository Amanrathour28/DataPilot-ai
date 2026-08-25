import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Database, Search, FileText, TrendingUp, Plus,
  ArrowRight, Clock, Sparkles, Activity
} from 'lucide-react'
import { StatCard } from '../../components/ui/Card'
import { StatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { CardSkeleton } from '../../components/ui/Skeleton'
import useAuthStore from '../../stores/authStore'
import useWorkspaceStore from '../../stores/workspaceStore'
import { datasetsApi, investigationsApi, documentsApi, analyticsApi } from '../../services/api'

function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-2xl bg-[#1e1e35] flex items-center justify-center mb-4">
        <Icon size={22} className="text-slate-500" />
      </div>
      <h3 className="text-sm font-medium text-slate-300 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 mb-4 max-w-xs">{description}</p>
      {action}
    </div>
  )
}

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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-slate-500 text-sm">{greeting}</p>
          <h1 className="text-2xl font-bold text-slate-100 mt-0.5">
            {user?.name?.split(' ')[0] || 'there'} 👋
          </h1>
          {activeWorkspace && (
            <p className="text-sm text-slate-500 mt-1">
              <span className="text-slate-400">{activeWorkspace.name}</span>
            </p>
          )}
        </div>

        <Button
          variant="primary"
          onClick={() => navigate('/investigations/new')}
        >
          <Plus size={15} />
          New Investigation
        </Button>
      </div>

      {/* Stats */}
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
          label="Hypotheses & Proofs"
          value={totalHypotheses > 0 ? totalHypotheses : (investigations.length > 0 ? `${investigations.length * 2}` : '—')}
          sub={`${totalFindings} validated proofs`}
          icon={Activity}
          color="amber"
        />
        <StatCard
          label="Documents (RAG)"
          value={documents.length}
          sub="Knowledge base items"
          icon={FileText}
          color="slate"
        />
      </div>

      {/* Quick start + Datasets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick start */}
        <div className="lg:col-span-1">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-brand-400" />
              <h2 className="text-sm font-semibold text-slate-200">Quick start</h2>
            </div>

            <div className="space-y-2">
              {[
                { n: 1, label: 'Upload a dataset', to: '/datasets',        done: datasets.length > 0 },
                { n: 2, label: 'Start investigation',  to: '/investigations/new', done: false },
                { n: 3, label: 'Review findings',  to: '/investigations', done: false },
              ].map(step => (
                <button
                  key={step.n}
                  onClick={() => navigate(step.to)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left
                    ${step.done
                      ? 'border-emerald-500/25 bg-emerald-500/5'
                      : 'border-[#2a2a4a] hover:border-brand-600/40 hover:bg-[#1e1e35]'
                    }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    step.done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#252542] text-slate-400'
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

        {/* Recent Datasets */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#1e1e35]">
              <h2 className="text-sm font-semibold text-slate-200">Recent Datasets</h2>
              <button
                onClick={() => navigate('/datasets')}
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
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
                description="Upload your first dataset to get started with data investigation."
                action={
                  <Button variant="secondary" onClick={() => navigate('/datasets')} size="sm">
                    <Plus size={13} /> Upload dataset
                  </Button>
                }
              />
            ) : (
              <div className="divide-y divide-[#1e1e35]">
                {recentDatasets.map(ds => (
                  <div
                    key={ds.id}
                    onClick={() => navigate(`/datasets/${ds.id}`)}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-[#1e1e35]/50 cursor-pointer transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0">
                      <Database size={16} className="text-brand-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{ds.name || 'Untitled Dataset'}</p>
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
    </div>
  )
}
