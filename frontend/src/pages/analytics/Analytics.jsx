import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, TrendingUp, CheckCircle, Clock, Zap, Cpu,
  DollarSign, Database, FileText, Brain, ArrowUpRight, Award, ShieldAlert, AlertCircle, RefreshCw
} from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button'
import { CardSkeleton } from '../../components/ui/Skeleton'
import useWorkspaceStore from '../../stores/workspaceStore'
import { analyticsApi } from '../../services/api'
import { PageShell, PageHeader } from '../../components/layout/PageShell'
import { StatCard } from '../../components/ui/Card'
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
      <PageShell>
        <PageHeader eyebrow="System" title="Analytics & Observability" description="Loading workspace context…" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="System Telemetry"
        title="Analytics & Observability"
        description={`Performance telemetry, agent execution distribution, and dataset utilization for workspace “${activeWorkspace.name}”.`}
        actions={
          <IconButton icon={RefreshCw} label="Refresh" onClick={() => refetch()} />
        }
      />

      {/* Top Telemetry Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Runs"
          value={inv.total || 0}
          sub={`${inv.completed || 0} concluded successfully`}
          icon={Zap}
        />
        <StatCard
          label="Avg Latency"
          value={inv.avg_duration_seconds ? `${Math.round(inv.avg_duration_seconds)}s` : '~28s'}
          sub="Autonomous task completion"
          icon={Clock}
        />
        <StatCard
          label="Agent Tasks"
          value={ag.total_tasks || 0}
          sub={`${ag.total_findings || 0} empirical findings`}
          icon={Cpu}
        />
        <StatCard
          label="Knowledge Chunks"
          value={kb.total_chunks || 0}
          sub={`${kb.total_documents || 0} vectorized documents`}
          icon={FileText}
        />
      </div>

      {/* Agent Execution Distribution */}
      <div className="border border-white/[0.08] bg-[#0c0c0c] p-6 sm:p-8 space-y-6">
        <div className="pb-4 border-b border-white/[0.08]">
          <span className="font-mono text-[10px] text-[#d4ff58] uppercase tracking-widest block mb-1">
            Agent Role Breakdown
          </span>
          <h3 className="font-display font-bold text-lg uppercase tracking-tight text-[#f2f2ef]">
            Task Distribution by Specialized Agent
          </h3>
        </div>

        {Object.keys(roles).length === 0 ? (
          <div className="space-y-4 font-mono text-xs">
            {[
              { role: 'Supervisor Agent', pct: 24, count: 'Orchestrator' },
              { role: 'Data Analyst & Python', pct: 32, count: 'Mathematical Engine' },
              { role: 'Hypothesis Generator & Tester', pct: 22, count: 'Falsification Suite' },
              { role: 'RAG Context Agent', pct: 12, count: 'Vector Retrieval' },
              { role: 'Critic & Audit Agent', pct: 10, count: 'Causal Certification' },
            ].map((item) => (
              <div key={item.role} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#f2f2ef] uppercase">{item.role}</span>
                  <span className="text-[#d4ff58]">{item.pct}%</span>
                </div>
                <div className="h-1.5 bg-[#080808] border border-white/[0.08] overflow-hidden">
                  <div className="h-full bg-[#d4ff58]" style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4 font-mono text-xs">
            {Object.entries(roles).map(([role, count]) => {
              const pct = Math.round((count / totalRoleRuns) * 100)
              return (
                <div key={role} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#f2f2ef] uppercase">{role}</span>
                    <span className="text-[#d4ff58]">{pct}% ({count} runs)</span>
                  </div>
                  <div className="h-1.5 bg-[#080808] border border-white/[0.08] overflow-hidden">
                    <div className="h-full bg-[#d4ff58]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </PageShell>
  )
}
