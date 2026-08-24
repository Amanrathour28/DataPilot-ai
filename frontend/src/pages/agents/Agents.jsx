import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bot, Cpu, Network, Activity, CheckCircle2, Clock,
  AlertCircle, ChevronRight, Terminal, RefreshCw, Layers, ShieldCheck, Zap
} from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import useWorkspaceStore from '../../stores/workspaceStore'
import { analyticsApi } from '../../services/api'
import { clsx } from 'clsx'

const AGENT_ROLES = [
  {
    id: 'Supervisor',
    title: 'Supervisor Agent',
    description: 'Deconstructs business questions, orchestrates child agents, and manages execution graph loop.',
    badge: 'Orchestrator',
    color: 'border-brand-500/30 bg-brand-500/10 text-brand-400',
    icon: Network,
  },
  {
    id: 'Planner',
    title: 'Planning Agent',
    description: 'Generates analytical investigation step-by-step plans mapped against dataset schema.',
    badge: 'Strategy',
    color: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    icon: Layers,
  },
  {
    id: 'Analyst',
    title: 'Data Analyst Agent',
    description: 'Writes and executes Python/Pandas & DuckDB queries to compute metrics, segmentations, and correlations.',
    badge: 'Code & Math',
    color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    icon: Cpu,
  },
  {
    id: 'Hypothesis Generator & Tester',
    title: 'Hypothesis Agents',
    description: 'Formulates candidate causal explanations and rigorously validates them against evidence with statistical confidence.',
    badge: 'Causality',
    color: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    icon: Zap,
  },
  {
    id: 'Root Cause & RAG',
    title: 'Root Cause Agent',
    description: 'Cross-references quantitative findings with domain knowledge base documents to explain the "why".',
    badge: 'Synthesis',
    color: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
    icon: Bot,
  },
  {
    id: 'Critic',
    title: 'Critic & Validator',
    description: 'Evaluates logical consistency, flags hallucinations, and verifies confidence thresholds before report compilation.',
    badge: 'Verification',
    color: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
    icon: ShieldCheck,
  },
]

export default function Agents() {
  const { activeWorkspace } = useWorkspaceStore()
  const [selectedRole, setSelectedRole] = useState('ALL')
  const [selectedRun, setSelectedRun] = useState(null)

  // Fetch recent agent runs
  const { data: activity = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['agents-activity', activeWorkspace?.id],
    queryFn: () => analyticsApi.agentsActivity(activeWorkspace.id),
    enabled: !!activeWorkspace?.id,
    refetchInterval: 5000, // Poll every 5s for live agent runs
  })

  const filteredActivity = selectedRole === 'ALL'
    ? activity
    : activity.filter(a => (a.agent_role || '').toLowerCase().includes(selectedRole.toLowerCase()))

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
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

      {/* Agent Roles Swarm Grid */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Specialized Agent Swarm Mesh
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AGENT_ROLES.map((role) => {
            const Icon = role.icon
            return (
              <div
                key={role.id}
                className="card p-4 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-800/80 flex items-center justify-center text-slate-300">
                        <Icon size={16} />
                      </div>
                      <span className="text-sm font-semibold text-slate-200">{role.title}</span>
                    </div>
                    <span className={clsx('text-[10px] font-medium px-2 py-0.5 rounded border', role.color)}>
                      {role.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mt-2">
                    {role.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Ready & Idle
                  </span>
                  <span>Autonomous Tool Calling</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Execution Stream and Logs */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="text-brand-400" size={18} />
            <h2 className="text-base font-semibold text-slate-200">Live Agent Execution Telemetry</h2>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {['ALL', 'Supervisor', 'Analyst', 'Hypothesis', 'Root Cause', 'Critic'].map(f => (
              <button
                key={f}
                onClick={() => setSelectedRole(f)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                  selectedRole === f
                    ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                    : 'bg-[#161626] text-slate-400 hover:text-slate-200 border border-slate-800'
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : filteredActivity.length === 0 ? (
          <div className="card text-center py-16 flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-400 mb-3">
              <Bot size={24} />
            </div>
            <h3 className="text-base font-semibold text-slate-200 mb-1">No Agent Activity Logged</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              Start an investigation from the Investigations tab to see live agent traces and tool invocations.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredActivity.map((run) => (
              <div
                key={run.id}
                className="card p-4 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer"
                onClick={() => setSelectedRun(selectedRun?.id === run.id ? null : run)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      run.status === 'COMPLETED' ? 'bg-emerald-400' :
                      run.status === 'RUNNING' ? 'bg-amber-400 animate-ping' :
                      'bg-red-400'
                    )} />

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-200">{run.agent_role}</span>
                        <span className={clsx(
                          'text-[10px] px-2 py-0.5 rounded font-mono',
                          run.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' :
                          run.status === 'RUNNING' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-red-500/10 text-red-400'
                        )}>
                          {run.status}
                        </span>
                        {run.duration_ms && (
                          <span className="text-[11px] text-slate-500">
                            {(run.duration_ms / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                        Investigation: <span className="text-slate-300 font-medium">{run.investigation_objective}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>{new Date(run.created_at).toLocaleTimeString()}</span>
                    <ChevronRight
                      size={16}
                      className={clsx(
                        'transition-transform text-slate-400',
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

                    {run.tool_calls && run.tool_calls.length > 0 ? (
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
                        <strong>Error:</strong> {run.error_message}
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
