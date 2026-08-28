import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, TrendingUp, CheckCircle, Clock, Zap, Cpu,
  DollarSign, Database, FileText, Brain, ArrowUpRight, Award, ShieldAlert, AlertCircle, RefreshCw
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { CardSkeleton } from '../../components/ui/Skeleton'
import useWorkspaceStore from '../../stores/workspaceStore'
import { analyticsApi } from '../../services/api'
import { clsx } from 'clsx'

export default function Analytics() {
  const { activeWorkspace } = useWorkspaceStore()

  const { data: analytics, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['analytics-summary', activeWorkspace?.id],
    queryFn: () => analyticsApi.summary(activeWorkspace.id),
    enabled: !!activeWorkspace?.id,
  })

  const inv = analytics?.investigations || {}
  const ds = analytics?.datasets || {}
  const kb = analytics?.knowledge_base || {}
  const ag = analytics?.agents || {}

  const roles = (ag?.roles_distribution && typeof ag.roles_distribution === 'object') ? ag.roles_distribution : {}
  const totalRoleRuns = Object.values(roles).reduce((a, b) => (typeof b === 'number' ? a + b : a), 0) || 1

  if (!activeWorkspace) {
    return (
      <div className="page-shell space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Analytics & Observability</h1>
            <p className="text-xs text-slate-500 mt-1">Loading workspace context…</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="text-brand-400" size={24} />
            <h1 className="text-2xl font-bold text-slate-100">Analytics & Observability</h1>
          </div>
          <p className="text-sm text-slate-400">
            Performance metrics, agent operational efficiency, and token economics for workspace &ldquo;{activeWorkspace.name}&rdquo;.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            <RefreshCw size={14} /> Refresh Metrics
          </Button>
        </div>
      </div>

      {/* Error state alert */}
      {isError && (
        <div className="card p-5 border border-red-500/30 bg-red-500/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-red-300">Failed to load analytics</h3>
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

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <>
          {/* Top KPI Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Investigations */}
            <div className="card p-5 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Investigations</span>
                <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400">
                  <TrendingUp size={16} />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-extrabold text-slate-100">{inv.total || 0}</div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <span className="text-emerald-400 font-medium">{inv.success_rate_percent || 100}% Success Rate</span>
                  <span>· {inv.completed || 0} completed</span>
                </div>
              </div>
            </div>

            {/* Hypotheses & Evidence */}
            <div className="card p-5 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Findings & Proofs</span>
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                  <Zap size={16} />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-extrabold text-slate-100">{ag.total_findings || 0}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Across <span className="text-slate-300 font-medium">{ag.total_hypotheses || 0}</span> validated hypotheses
                </div>
              </div>
            </div>

            {/* Analyst Hours Saved */}
            <div className="card p-5 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Analyst Time Saved</span>
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                  <Clock size={16} />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-extrabold text-slate-100">{ag.estimated_analyst_hours_saved || 0} <span className="text-sm font-normal text-slate-400">hrs</span></div>
                <div className="text-xs text-slate-500 mt-1">
                  Estimated manual investigation time
                </div>
              </div>
            </div>

            {/* Cost Efficiency */}
            <div className="card p-5 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estimated ROI</span>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <DollarSign size={16} />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-extrabold text-slate-100">${ag.estimated_cost_saved_usd || '0.00'}</div>
                <div className="text-xs text-emerald-400 mt-1">
                  Autonomous data engineering savings
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Agent Role Execution Distribution */}
            <div className="card p-6 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Cpu size={16} className="text-brand-400" />
                  Agent Execution Distribution
                </h2>
                <span className="text-xs text-slate-500 font-mono">{ag.total_runs || 0} total steps</span>
              </div>

              {Object.keys(roles).length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No agent run data recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(roles).map(([role, count]) => {
                    const pct = Math.round(((typeof count === 'number' ? count : 0) / totalRoleRuns) * 100)
                    return (
                      <div key={role} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-300 font-medium">{role}</span>
                          <span className="text-slate-400 font-mono">{count} runs ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-brand-500 to-cyan-500 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Knowledge & Data Footprint */}
            <div className="card p-6 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Database size={16} className="text-brand-400" />
                  Data & Domain Knowledge Footprint
                </h2>
                <span className="text-xs text-slate-500 font-mono">{ds.total_size_mb || 0} MB indexed</span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-[#121222] rounded-xl border border-slate-800/80">
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                    <Database size={14} className="text-blue-400" /> Structured Datasets
                  </div>
                  <div className="text-xl font-bold text-slate-200">{ds.total_datasets || 0}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{((ds.total_rows || 0)).toLocaleString()} rows analyzed</div>
                </div>

                <div className="p-4 bg-[#121222] rounded-xl border border-slate-800/80">
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                    <FileText size={14} className="text-purple-400" /> RAG Knowledge Docs
                  </div>
                  <div className="text-xl font-bold text-slate-200">{kb.total_documents || 0}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{kb.total_chunks || 0} semantic embeddings</div>
                </div>
              </div>

              <div className="p-4 bg-[#121222] rounded-xl border border-slate-800/80 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                    <Brain size={14} className="text-amber-400" /> Active Workspace Rules
                  </div>
                  <div className="text-lg font-bold text-slate-200">{analytics?.memories?.total_memories || 0} items</div>
                </div>
                <div className="text-xs text-slate-500 max-w-[200px] text-right">
                  Injected into agent context dynamically
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
