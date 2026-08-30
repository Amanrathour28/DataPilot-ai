import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Cpu, Activity, CheckCircle2, XCircle, Clock, Search, ChevronRight,
  RefreshCw, Terminal, Layers, Sparkles, AlertCircle, ShieldCheck
} from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { CardSkeleton } from '../../components/ui/Skeleton'
import useWorkspaceStore from '../../stores/workspaceStore'
import { analyticsApi } from '../../services/api'
import { PageShell, PageHeader } from '../../components/layout/PageShell'
import { clsx } from 'clsx'

const AGENT_ROLES = [
  {
    n: '01',
    id: 'Supervisor',
    name: 'Investigation Orchestrator',
    role: 'Central Graph Router & Goal Formulation',
    description: 'Generates structured investigation roadmaps, breaks objectives into step-by-step tasks, and coordinates multi-agent graph execution.',
    capabilities: ['Dynamic Planning', 'State Monitoring', 'Task Allocation', 'Convergence Gatekeeper'],
    tools: ['LangGraph State Engine', 'Goal Boundary Checker', 'Task Allocator']
  },
  {
    n: '02',
    id: 'Analyst',
    name: 'Data Analysis Agent',
    role: 'Statistical Slicing & Metric Variance',
    description: 'Executes sandboxed Python and Pandas analysis, anomaly detection, cohort segmentation, and period-over-period variance calculations.',
    capabilities: ['Pandas Slicing', 'Cohort Segmentation', 'Outlier Isolation'],
    tools: ['DuckDB OLAP Engine', 'Pandas Sandbox', 'Variance Matrix']
  },
  {
    n: '03',
    id: 'PythonExecutor',
    name: 'Python Execution Agent',
    role: 'Sandboxed Python & DuckDB Execution',
    description: 'Executes verifiable Python analytical scripts within a secure AST-isolated sandbox environment with strict execution bounds.',
    capabilities: ['AST Sandbox Security', 'Deterministic Python Run', 'Checksum Verification'],
    tools: ['Python 3.11 Runtime', 'Pandas / NumPy', 'DuckDB Client']
  },
  {
    n: '04',
    id: 'Hypothesis',
    name: 'Hypothesis Generator & Tester',
    role: 'Causal Candidate Formulation & Falsification',
    description: 'Formulates candidate causal models and evaluates each against empirical data, classifying findings into Supported or Rejected.',
    capabilities: ['Causal Model Prior', 'Welch t-Test', 'Chi-Square Significance', 'Falsification Criteria'],
    tools: ['SciPy Stats Suite', 'Hypothesis Matrix', 'Significance Evaluator']
  },
  {
    n: '05',
    id: 'RAG',
    name: 'RAG Context Agent',
    role: 'Semantic Document Intelligence',
    description: 'Cross-references qualitative PDF strategy memos, meeting transcripts, and earnings decks against quantitative anomalies.',
    capabilities: ['Hybrid Vector Search', 'Contextual Reranking', 'Citation Lineage'],
    tools: ['Vector Embeddings', 'Page-Level Reranker', 'Citation Extractor']
  },
  {
    n: '06',
    id: 'Critic',
    name: 'Critic & Verification Agent',
    role: 'Causal Auditing & Rigor Evaluation',
    description: 'Independently evaluates every hypothesis, challenges correlation versus causation, and calculates analytical confidence scores.',
    capabilities: ['Correlation vs Causation Audit', 'Significance Verification', 'Evidence Ledger Integrity'],
    tools: ['Causal Claim Checker', 'Contradiction Detector', 'Calibrated Scorer']
  },
]

export default function Agents() {
  const { activeWorkspace } = useWorkspaceStore()
  const [activeAgentIdx, setActiveAgentIdx] = useState(0)

  // Fetch recent agent runs
  const { data: activityRaw = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['agents-activity', activeWorkspace?.id],
    queryFn: () => analyticsApi.agentsActivity(activeWorkspace.id),
    enabled: !!activeWorkspace?.id,
    refetchInterval: (data, query) => {
      if (query?.state?.error) return false
      return 10000
    },
  })

  const activity = Array.isArray(activityRaw) ? activityRaw : []
  const activeAgent = AGENT_ROLES[activeAgentIdx]

  if (!activeWorkspace) {
    return (
      <PageShell>
        <PageHeader eyebrow="System" title="Agent Swarm" description="Loading workspace context…" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton /><CardSkeleton />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Autonomous Architecture"
        title="Specialized Agent Swarm"
        description="Seven deterministic AI agents collaborating across immutable state graphs to investigate, test, and verify root causes."
        actions={
          <IconButton icon={RefreshCw} label="Refresh Activity" onClick={() => refetch()} />
        }
      />

      {/* Two-Column Agent Directory (DayNight Style) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Interactive Agent Roster */}
        <div className="lg:col-span-6 border border-white/[0.08] bg-[#0c0c0c] divide-y divide-white/[0.06]">
          {AGENT_ROLES.map((agent, idx) => {
            const isSelected = activeAgentIdx === idx
            return (
              <div
                key={agent.id}
                onClick={() => setActiveAgentIdx(idx)}
                className={clsx(
                  'p-6 flex items-start justify-between gap-4 cursor-pointer transition-all',
                  isSelected ? 'bg-white/[0.04]' : 'hover:bg-white/[0.01]'
                )}
              >
                <div className="flex items-start gap-4 min-w-0">
                  <span className={clsx(
                    'font-mono text-xs pt-0.5',
                    isSelected ? 'text-[#d4ff58] font-bold' : 'text-[#f2f2ef]/30'
                  )}>
                    {agent.n}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <h3 className={clsx(
                      'font-display font-bold text-base sm:text-lg uppercase tracking-tight transition-colors truncate',
                      isSelected ? 'text-[#d4ff58]' : 'text-[#f2f2ef]'
                    )}>
                      {agent.name}
                    </h3>
                    <p className="font-mono text-[11px] text-[#f2f2ef]/50 uppercase tracking-wider">
                      {agent.role}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1 flex-shrink-0">
                  <span className="w-2 h-2 rounded-full bg-[#d4ff58]" />
                  <ChevronRight size={14} className={clsx('text-[#f2f2ef]/40 transition-transform', isSelected && 'rotate-90 text-[#d4ff58]')} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Right Column: Selected Agent Telemetry & Inspection */}
        <div className="lg:col-span-6 border border-white/[0.08] bg-[#0c0c0c] p-6 sm:p-8 space-y-6 sticky top-8">
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <div>
              <span className="font-mono text-[10px] text-[#d4ff58] uppercase tracking-widest block">
                Agent Specification &middot; {activeAgent.n} / 06
              </span>
              <h3 className="font-display font-extrabold text-xl uppercase text-[#f2f2ef] mt-1">
                {activeAgent.name}
              </h3>
            </div>
            <span className="font-mono text-[10px] text-[#d4ff58] uppercase px-2 py-0.5 border border-[#d4ff58]/30 bg-[#d4ff58]/10 font-bold">
              Autonomous
            </span>
          </div>

          <p className="text-xs sm:text-sm text-[#f2f2ef]/70 leading-relaxed font-sans">
            {activeAgent.description}
          </p>

          {/* Capabilities */}
          <div className="space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#f2f2ef]/40 block">
              Core Capabilities
            </span>
            <div className="flex flex-wrap gap-2">
              {activeAgent.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="px-2.5 py-1 text-[11px] font-mono border border-white/[0.1] bg-[#080808] text-[#f2f2ef]/80"
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>

          {/* Tool Suite */}
          <div className="space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#f2f2ef]/40 block">
              Integrated Tools
            </span>
            <div className="flex flex-wrap gap-2">
              {activeAgent.tools.map((tool) => (
                <span
                  key={tool}
                  className="px-2.5 py-1 text-[11px] font-mono border border-[#d4ff58]/20 bg-[#d4ff58]/5 text-[#d4ff58]"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>

          {/* Live Recent Executions for this Agent */}
          <div className="pt-4 border-t border-white/[0.06] space-y-3 font-mono text-xs">
            <span className="text-[#f2f2ef]/40 text-[10px] uppercase tracking-widest block">
              Recent Workspace Task Dispatches
            </span>
            {activity.length === 0 ? (
              <p className="text-[#f2f2ef]/30 py-4 text-center text-[11px]">
                No recent task dispatches logged for this agent.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {activity.slice(0, 4).map((act, idx) => (
                  <div key={idx} className="p-3 bg-[#080808] border border-white/[0.06] space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-[#f2f2ef]/40">
                      <span className="text-[#d4ff58] font-bold uppercase">{act.agent_name || activeAgent.name}</span>
                      <span>{act.created_at ? new Date(act.created_at).toLocaleTimeString() : 'Recent'}</span>
                    </div>
                    <p className="text-[11px] text-[#f2f2ef]/80 truncate font-sans">
                      {act.thought || act.summary || act.action || 'Executed analytical step'}
                    </p>
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
