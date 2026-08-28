import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Cpu, Activity, CheckCircle2, XCircle, Clock, Search, ChevronRight,
  RefreshCw, Terminal, Layers, Sparkles, AlertCircle
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { CardSkeleton } from '../../components/ui/Skeleton'
import useWorkspaceStore from '../../stores/workspaceStore'
import { analyticsApi } from '../../services/api'
import { clsx } from 'clsx'

const AGENT_ROLES = [
  {
    id: 'Supervisor',
    name: 'Supervisor / Orchestrator Agent',
    description: 'Generates structured investigation plans, breaks objectives into step-by-step tasks, and coordinates multi-agent execution.',
    icon: Cpu,
    color: 'from-purple-500 to-cyan-600',
    capabilities: ['Dynamic Planning', 'Execution Leases', 'Task Allocation']
  },
  {
    id: 'Analyst',
    name: 'Data Analysis Agent',
    description: 'Executes sandboxed Python and Pandas analysis, anomaly detection, cohort segmentation, and variance calculations.',
    icon: Activity,
    color: 'from-blue-500 to-cyan-600',
    capabilities: ['AST Python Sandbox', 'Pandas Profiling', 'Cohort Segmentation']
  },
  {
    id: 'Hypothesis',
    name: 'Hypothesis Generation & Test Agent',
    description: 'Formulates causal hypotheses and deterministically evaluates them using SciPy statistical hypothesis tests.',
    icon: Sparkles,
    color: 'from-amber-500 to-orange-600',
    capabilities: ['Causal Hypothesis Formulation', 'Welch t-Test', 'Chi-Square Test']
  },
  {
    id: 'Root Cause',
    name: 'Root Cause Synthesis Agent',
    description: 'Aggregates statistical evidence, ranks root causes dynamically by impact, and calculates transparent calibrated confidence.',
    icon: Layers,
    color: 'from-emerald-500 to-teal-600',
    capabilities: ['Evidence Synthesis', 'Dynamic Root Cause Ranking', 'Calibrated Confidence Scoring']
  },
  {
    id: 'Critic',
    name: 'Critic & Audit Agent',
    description: 'Audits evidence ledger, verifies statistical significance, catches correlation vs causation fallacies, and enforces analytical rigor.',
    icon: CheckCircle2,
    color: 'from-rose-500 to-pink-600',
    capabilities: ['Correlation vs Causation Audit', 'Significance Verification', 'Evidence Ledger Integrity']
  }
]

export default function Agents() {
  const { activeWorkspace } = useWorkspaceStore()
  const [selectedRole, setSelectedRole] = useState('ALL')
  const [selectedRun, setSelectedRun] = useState(null)

  // Fetch recent agent runs
  const { data: activityRaw = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['agents-activity', activeWorkspace?.id],
    queryFn: () => analyticsApi.agentsActivity(activeWorkspace.id),
    enabled: !!activeWorkspace?.id,
    refetchInterval: (data, query) => {
      if (query?.state?.error) return false
      return 10000
    },
  })

  const activity = Array.isArray(activityRaw) ? activityRaw : []

  const filteredActivity = selectedRole === 'ALL'
    ? activity
    : activity.filter(a => a && (a.agent_role || '').toLowerCase().includes(selectedRole.toLowerCase()))

  if (!activeWorkspace) {
    return (
      <div className="page-shell space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Autonomous Agent Swarm</h1>
            <p className="text-xs text-slate-500 mt-1">Loading workspace context…</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton /><CardSkeleton />
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
            <Cpu className="text-brand-400" size={24} />
            <h1 className="text-2xl font-bold text-slate-100">Autonomous Agent Swarm</h1>
          </div>
          <p className="text-sm text-slate-400">
            Real-time telemetry, execution traces, and orchestration graph for all specialized investigation agents.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw size={14} className={clsx(isFetching && 'animate-spin')} />
            {isFetching ? 'Refreshing…' : 'Refresh Telemetry'}
          </Button>
        </div>
      </div>

      {/* Error state alert */}
      {isError && (
        <div className="card p-5 border border-red-500/30 bg-red-500/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-red-300">Failed to load agent telemetry</h3>
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

      {/* Agent Roles Swarm Grid */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <Layers size={16} className="text-brand-400" />
          Specialized Agent Architecture (5 Autonomous Roles)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AGENT_ROLES.map((role) => {
            const Icon = role.icon
            const roleRunCount = activity.filter(a => a && (a.agent_role || '').toLowerCase().includes(role.id.toLowerCase())).length
            return (
              <div
                key={role.id}
                onClick={() => setSelectedRole(selectedRole === role.id ? 'ALL' : role.id)}
                className={clsx(
                  'card p-5 cursor-pointer transition-all duration-200 space-y-3 relative overflow-hidden',
                  selectedRole === role.id
                    ? 'border-brand-500 ring-1 ring-brand-500/50 bg-[#14142a]'
                    : 'hover:border-slate-700'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center text-white bg-gradient-to-br', role.color)}>
                    <Icon size={18} />
                  </div>
                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-[#1e1e38] text-slate-400 border border-[#2a2a50]">
                    {roleRunCount} run{roleRunCount !== 1 ? 's' : ''}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-100">{role.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
                    {role.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {role.capabilities.map((cap, i) => (
                    <span key={i} className="text-[10px] bg-[#111124] text-slate-400 px-2 py-0.5 rounded border border-[#222244]">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Execution Telemetry Trace Log */}
      <div className="card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Terminal size={16} className="text-brand-400" />
              Agent Execution Telemetry Traces
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live audit logs of tool calls, prompt executions, and LLM reasoning steps
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {['ALL', 'Supervisor', 'Analyst', 'Hypothesis', 'Root Cause', 'Critic'].map(f => (
              <button
                key={f}
                onClick={() => setSelectedRole(f)}
                className={clsx(
                  'text-xs px-3 py-1 rounded-lg transition-colors font-medium whitespace-nowrap',
                  selectedRole === f
                    ? 'bg-brand-600 text-white'
                    : 'bg-[#191932] text-slate-400 hover:text-slate-200 border border-[#2a2a50]'
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* List of Traces */}
        {isLoading ? (
          <div className="space-y-3">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : filteredActivity.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No agent execution traces recorded yet for &ldquo;{selectedRole}&rdquo;. Run an investigation to observe live telemetry.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredActivity.map((run) => (
              <div
                key={run.id || Math.random()}
                className="p-4 bg-[#111124] rounded-xl border border-[#202040] hover:border-slate-700 transition-colors cursor-pointer"
                onClick={() => setSelectedRun(selectedRun?.id === run.id ? null : run)}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center flex-shrink-0">
                      <Cpu size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200">{run.agent_name || run.agent_role || 'Autonomous Agent'}</span>
                        <StatusBadge status={run.status || 'COMPLETED'} />
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 truncate font-mono">
                        Task: {run.task_description || run.action || 'Executed investigation step'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0 text-xs text-slate-500">
                    <span className="font-mono text-[11px] hidden sm:inline">
                      {((run.execution_time_ms || 0) / 1000).toFixed(2)}s
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <Clock size={11} />
                      {run.created_at ? new Date(run.created_at).toLocaleTimeString() : '—'}
                    </span>
                    <ChevronRight
                      size={14}
                      className={clsx(
                        'transition-transform text-slate-500',
                        selectedRun?.id === run.id && 'rotate-90'
                      )}
                    />
                  </div>
                </div>

                {/* Expanded Trace Details */}
                {selectedRun?.id === run.id && (
                  <div className="mt-4 pt-3 border-t border-slate-800 space-y-3 animate-fade-in">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                      <Terminal size={14} className="text-brand-400" />
                      Tool Invocations & Trace Details
                    </div>

                    {Array.isArray(run.tool_calls) && run.tool_calls.length > 0 ? (
                      <div className="space-y-2">
                        {run.tool_calls.map((tc, idx) => (
                          <div key={idx} className="p-3 bg-[#0c0c16] rounded-xl border border-slate-800/80 font-mono text-xs text-slate-300">
                            <div className="text-brand-400 font-semibold mb-1">Tool: {tc.tool_name || tc.tool || 'python_exec'}</div>
                            <pre className="text-[11px] text-slate-400 overflow-x-auto whitespace-pre-wrap">
                              {typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments || tc.input || tc, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No external tool calls recorded for this step.</p>
                    )}

                    {run.error_message && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                        Error: {run.error_message}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
