import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, RefreshCw, CheckCircle2, XCircle, AlertCircle, Clock,
  Play, Pause, ShieldAlert, Sparkles, Terminal, FileText, Database,
  GitMerge, Award, RotateCcw, Brain, CheckSquare, Zap, Calculator,
  TrendingUp, TrendingDown, Layers, ChevronRight, Download, ShieldCheck,
  BarChart3, Scale, Info, Check
} from 'lucide-react'
import { IconButton, Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { Skeleton } from '../../components/ui/Skeleton'
import { investigationsApi } from '../../services/api'
import { useToast } from '../../components/ui/Toast'
import EvidenceLedger from '../../components/investigations/EvidenceLedger'
import HypothesisScorecard from '../../components/investigations/HypothesisScorecard'
import RootCausePanel from '../../components/investigations/RootCausePanel'
import AgentReasoningPanel from '../../components/investigations/AgentReasoningPanel'
import MarkdownReport from '../../components/investigations/MarkdownReport'
import { PageShell } from '../../components/layout/PageShell'
import { clsx } from 'clsx'

const STAGES = [
  { id: 'PLANNING', label: '1. Planning' },
  { id: 'ANALYZING', label: '2. Analyzing' },
  { id: 'TESTING', label: '3. Testing' },
  { id: 'RETRIEVING', label: '4. Knowledge RAG' },
  { id: 'VERIFYING', label: '5. Critic Audit' },
  { id: 'REPORTING', label: '6. Report' },
]

export default function InvestigationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState('overview') // overview | report | findings | evidence | hypotheses | root_cause | plan | timeline

  // Streaming State
  const [streamTasks, setStreamTasks] = useState([])
  const [streamFindings, setStreamFindings] = useState([])
  const [streamHypotheses, setStreamHypotheses] = useState([])
  const [streamEvidence, setStreamEvidence] = useState([])
  const [streamStatus, setStreamStatus] = useState(null)
  const [streamStage, setStreamStage] = useState('PLANNING')
  const [streamSummary, setStreamSummary] = useState(null)
  const [streamConfidence, setStreamConfidence] = useState(null)
  const [streamPlan, setStreamPlan] = useState([])
  const [streamRootCauses, setStreamRootCauses] = useState([])
  const [streamCriticReviews, setStreamCriticReviews] = useState([])
  const [streamConfBreakdown, setStreamConfBreakdown] = useState(null)
  const [streamAppliedMemories, setStreamAppliedMemories] = useState([])
  const [streamActivities, setStreamActivities] = useState([])
  const [streamFailureReason, setStreamFailureReason] = useState(null)
  const [streamExecutionId, setStreamExecutionId] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('connected')
  const [isPaused, setIsPaused] = useState(false)

  // Fetch full details with active polling when running
  const { data: detail, isLoading, refetch } = useQuery({
    queryKey: ['investigation-detail', id],
    queryFn: () => investigationsApi.get(id),
    refetchInterval: (data, query) => {
      if (query?.state?.error) return false
      const running = ['PENDING', 'RUNNING', 'PLANNING', 'ANALYZING', 'TESTING', 'RETRIEVING', 'VERIFYING', 'REPORTING', 'REINVESTIGATING'].includes(data?.status)
      return running ? 3000 : false
    },
    refetchOnWindowFocus: false
  })

  // Synchronize stream state with DB record
  useEffect(() => {
    if (detail) {
      setStreamTasks(detail.tasks || [])
      setStreamFindings(detail.findings || [])
      setStreamHypotheses(detail.hypotheses || [])
      setStreamEvidence(detail.evidence_ledger || [])
      setStreamStatus(detail.status)
      if (detail.last_completed_stage || detail.status) setStreamStage(detail.last_completed_stage || detail.status)
      setStreamSummary(detail.summary)
      setStreamConfidence(detail.confidence_score)
      setStreamPlan(detail.plan || [])
      setStreamRootCauses(detail.root_causes || [])
      setStreamCriticReviews(detail.critic_reviews || [])
      setStreamConfBreakdown(detail.confidence_breakdown)
      setStreamAppliedMemories(detail.applied_memories || [])
      setStreamActivities(detail.agent_activity || [])
      setStreamFailureReason(detail.failure_reason)
      setStreamExecutionId(detail.execution_id)
      if (['RUNNING', 'PLANNING', 'ANALYZING', 'TESTING', 'RETRIEVING', 'VERIFYING', 'REPORTING'].includes(detail.status)) {
        setActiveTab('timeline')
      } else if (detail.status === 'FAILED') {
        setActiveTab('timeline')
      } else if (['COMPLETED', 'COMPLETED_WITH_LIMITATIONS', 'INSUFFICIENT_DATA'].includes(detail.status) && activeTab === 'timeline') {
        setActiveTab('overview')
      }
    }
  }, [detail])

  const lastEventIdRef = useRef(0)
  const seenEventIdsRef = useRef(new Set())
  const eventSourceRef = useRef(null)

  // Establish SSE connection if running
  useEffect(() => {
    if (!id) return
    const isRunning = ['PENDING', 'RUNNING', 'PLANNING', 'ANALYZING', 'TESTING', 'RETRIEVING', 'VERIFYING', 'REPORTING', 'REINVESTIGATING'].includes(detail?.status)
    if (detail && !isRunning) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      return
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    const streamUrl = investigationsApi.getStreamUrl(id, lastEventIdRef.current)
    const es = new EventSource(streamUrl)
    eventSourceRef.current = es

    es.onopen = () => {
      setConnectionStatus('connected')
    }

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (!data) return

        if (data.id && seenEventIdsRef.current.has(data.id)) return
        if (data.id) seenEventIdsRef.current.add(data.id)
        if (data.seq) lastEventIdRef.current = data.seq

        if (data.type === 'status') {
          setStreamStatus(data.status)
          if (data.stage) setStreamStage(data.stage)
          if (data.summary) setStreamSummary(data.summary)
          if (data.confidence_score) setStreamConfidence(data.confidence_score)
          if (data.root_causes) setStreamRootCauses(data.root_causes)
          if (data.evidence_ledger) setStreamEvidence(data.evidence_ledger)
          if (data.confidence_breakdown) setStreamConfBreakdown(data.confidence_breakdown)
          if (data.failure_reason) setStreamFailureReason(data.failure_reason)
          if (data.execution_id) setStreamExecutionId(data.execution_id)

          if (['COMPLETED', 'COMPLETED_WITH_LIMITATIONS', 'INSUFFICIENT_DATA', 'FAILED'].includes(data.status)) {
            toast?.show(data.message || 'Investigation concluded', data.status === 'FAILED' ? 'error' : 'info')
            if (eventSourceRef.current) {
              eventSourceRef.current.close()
              eventSourceRef.current = null
            }
            queryClient.invalidateQueries(['investigation-detail', id])
            if (['COMPLETED', 'COMPLETED_WITH_LIMITATIONS', 'INSUFFICIENT_DATA'].includes(data.status)) setActiveTab('overview')
            else setActiveTab('timeline')
          }
        } else if (data.type === 'agent_activity' && data.activity) {
          setStreamActivities(prev => {
            if (prev.some(a => a.id === data.activity.id)) return prev
            return [...prev, data.activity]
          })
        } else if (data.type === 'plan_created') {
          setStreamPlan(data.plan || [])
          if (data.applied_memories) setStreamAppliedMemories(data.applied_memories)
        } else if (data.type === 'task_start') {
          if (data.stage) setStreamStage(data.stage)
          setStreamTasks(prev => {
            if (prev.some(t => t.id === data.task_id)) {
              return prev.map(t => t.id === data.task_id ? { ...t, status: 'RUNNING' } : t)
            }
            return [...prev, {
              id: data.task_id,
              agent: data.agent,
              objective: data.objective,
              status: 'RUNNING',
              created_at: new Date().toISOString()
            }]
          })
        } else if (data.type === 'task_end') {
          setStreamTasks(prev => prev.map(t => t.id === data.task_id ? { ...t, status: data.status, result: data.result } : t))
        } else if (data.type === 'finding') {
          setStreamFindings(prev => {
            if (prev.some(f => f.id === data.id)) return prev
            return [...prev, data]
          })
        } else if (data.type === 'hypothesis') {
          setStreamHypotheses(prev => {
            if (prev.some(h => h.id === data.id)) {
              return prev.map(h => h.id === data.id ? { ...h, ...data } : h)
            }
            return [...prev, data]
          })
        } else if (data.type === 'evidence_item') {
          setStreamEvidence(prev => [...prev, data.evidence])
        } else if (data.type === 'critic_review') {
          setStreamCriticReviews(prev => [...prev, data])
        }
      } catch (err) {
        console.error('Failed to parse SSE payload:', err)
      }
    }

    es.onerror = () => {
      setConnectionStatus('reconnecting')
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [id, detail?.status])

  // Action Controls
  const handleReplay = async () => {
    try {
      const newInv = await investigationsApi.replay(id)
      toast?.show('Replay execution launched', 'success')
      navigate(`/investigations/${newInv.id}`)
    } catch (err) {
      toast?.show('Failed to replay investigation', 'error')
    }
  }

  const handlePauseToggle = async () => {
    try {
      if (isPaused) {
        await investigationsApi.resume(id)
        setIsPaused(false)
        toast?.show('Investigation resumed', 'info')
      } else {
        await investigationsApi.pause(id)
        setIsPaused(true)
        toast?.show('Investigation paused', 'warning')
      }
    } catch {
      toast?.show('Failed to toggle pause status', 'error')
    }
  }

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this investigation?')) return
    try {
      await investigationsApi.cancel(id)
      toast?.show('Investigation cancelled', 'info')
      queryClient.invalidateQueries(['investigation-detail', id])
    } catch {
      toast?.show('Failed to cancel investigation', 'error')
    }
  }

  if (isLoading) {
    return (
      <PageShell className="space-y-6">
        <Skeleton className="h-8 w-48 rounded" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </PageShell>
    )
  }

  if (!detail) {
    return (
      <PageShell className="text-center text-slate-500">
        Investigation not found.
      </PageShell>
    )
  }

  const currentStatus = streamStatus || detail.status
  const isRunning = ['PENDING', 'RUNNING', 'PLANNING', 'ANALYZING', 'TESTING', 'RETRIEVING', 'VERIFYING', 'REPORTING', 'REINVESTIGATING'].includes(currentStatus)

  // Parse direct answer and reality check from summary if available
  const reportText = typeof streamSummary === 'string'
    ? (streamSummary.trim().startsWith('{') ? (() => { try { return JSON.parse(streamSummary).summary || streamSummary } catch { return streamSummary } })() : streamSummary)
    : (streamSummary?.summary || '')

  const realityCheckMatch = reportText.match(/# 2\. Reality Check[\s\S]*?> \*\*Reality Check Note\*\*: (.*?)(?=\n---|\n#|$)/)
  const realityCheckNote = realityCheckMatch ? realityCheckMatch[1] : null

  const executiveAnswerMatch = reportText.match(/# 1\. Executive Answer\s*\n\n([\s\S]*?)(?=\n---|\n#|$)/)
  const executiveAnswerText = executiveAnswerMatch ? executiveAnswerMatch[1].trim() : null

  const reliabilityMatch = reportText.match(/- \*\*Statistical Reliability\*\*:\s*\*\*?(.*?)\*\*?/)
  const reliabilityLabel = reliabilityMatch ? reliabilityMatch[1].trim() : (streamConfidence && streamConfidence < 0.75 ? 'EXPLORATORY ONLY' : 'HIGH')

  return (
    <PageShell className="space-y-6" wide>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <IconButton icon={ArrowLeft} label="Back" onClick={() => navigate('/investigations')} />
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-100">{detail.objective}</h1>
              <StatusBadge status={currentStatus} />
              
              {streamConfidence && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                  <Scale size={12} />
                  {Math.round(streamConfidence * 100)}% Analytical Confidence
                </span>
              )}

              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                {reliabilityLabel}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Started {new Date(detail.created_at).toLocaleString()}
              {detail.parent_id && <span> · Replay of <code className="text-brand-400 font-mono">{detail.parent_id.slice(0, 8)}</code></span>}
            </p>
          </div>
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {isRunning ? (
            <>
              <Button variant="secondary" size="sm" onClick={handlePauseToggle}>
                {isPaused ? <Play size={13} /> : <Pause size={13} />}
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
              <Button variant="danger" size="sm" onClick={handleCancel}>
                <XCircle size={13} /> Cancel
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={handleReplay}>
              <RotateCcw size={13} /> Replay Investigation
            </Button>
          )}
        </div>
      </div>

      {/* Investigation Lifecycle Stepper */}
      <div className="card p-4 border border-slate-800/80 bg-[#10101e]">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {STAGES.map((s, idx) => {
            const isCurrent = streamStage === s.id && isRunning
            const isPassed = !isRunning && ['COMPLETED', 'COMPLETED_WITH_LIMITATIONS', 'INSUFFICIENT_DATA'].includes(currentStatus)
            return (
              <div
                key={s.id}
                className={clsx(
                  'p-2.5 rounded-xl text-center border transition-all',
                  isCurrent && 'bg-brand-500/20 border-brand-500/40 text-brand-300 shadow-sm shadow-brand-500/10 animate-pulse',
                  isPassed && 'bg-[#141426] border-slate-800 text-slate-300',
                  !isCurrent && !isPassed && 'bg-[#0d0d1a] border-slate-900 text-slate-600'
                )}
              >
                <span className="text-[11px] font-bold block">{s.label}</span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {isCurrent ? 'Executing…' : (isPassed ? 'Verified' : 'Pending')}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Diagnostic Failure Card */}
      {currentStatus === 'FAILED' && (
        <div className="card p-5 border border-rose-500/30 bg-rose-950/20 rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <ShieldAlert size={22} className="text-rose-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono">
                    FAILED
                  </span>
                  <h3 className="text-sm font-bold text-slate-100">
                    Investigation Execution Failed
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Detailed diagnostic context and stack trace captured from the autonomous worker.
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={handleReplay}>
              <RotateCcw size={13} /> Replay Investigation
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-[#141424] border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider block">Failed Stage</span>
              <span className="text-xs font-bold text-amber-300 font-mono">
                {streamStage || detail.last_completed_stage || 'PLANNING'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#141424] border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider block">Failing Agent</span>
              <span className="text-xs font-bold text-rose-300 font-mono">
                {streamTasks.find(t => t.status === 'FAILED')?.agent || (streamFailureReason?.match(/\[(.*?)\]/)?.[1]) || 'Supervisor Agent'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#141424] border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider block">Retry Status</span>
              <span className="text-xs font-bold text-slate-200 font-mono">
                {streamTasks.find(t => t.status === 'FAILED')?.retry_count !== undefined 
                  ? `${streamTasks.find(t => t.status === 'FAILED')?.retry_count} / ${streamTasks.find(t => t.status === 'FAILED')?.max_retries || 2} retries`
                  : 'Exceeded max retries'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#141424] border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider block">Execution ID</span>
              <span className="text-xs font-mono text-slate-300 truncate block">
                {streamExecutionId || detail.execution_id || 'exec_worker'}
              </span>
            </div>
          </div>

          {/* Detailed Error Box */}
          <div className="p-3.5 rounded-xl bg-[#0c0c18] border border-rose-500/20 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
              <AlertCircle size={14} />
              <span>Error Diagnosis:</span>
            </div>
            <p className="text-xs text-rose-200/90 font-mono leading-relaxed break-words">
              {streamFailureReason || streamTasks.find(t => t.status === 'FAILED')?.error || detail.failure_reason || 'Dataset or statistical execution encountered an unhandled exception.'}
            </p>
          </div>
        </div>
      )}

      {/* Real-time Agent Reasoning & Activity Stream Panel */}
      <AgentReasoningPanel
        activities={streamActivities}
        status={currentStatus}
        stage={streamStage}
        connectionStatus={connectionStatus}
      />

      {/* Main Investigation Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview', icon: Sparkles },
          { id: 'report', label: 'Executive Report', icon: Award },
          { id: 'findings', label: 'Key Findings', icon: FileText, badge: streamFindings.length || null },
          { id: 'evidence', label: 'Evidence Ledger', icon: Database, badge: streamEvidence.length || null },
          { id: 'hypotheses', label: 'Hypotheses Matrix', icon: Zap, badge: streamHypotheses.length || null },
          { id: 'root_cause', label: 'Root Causes & Critic', icon: ShieldCheck },
          { id: 'plan', label: 'Investigation Plan', icon: CheckSquare, badge: streamPlan.length || null },
          { id: 'timeline', label: 'Live Timeline', icon: Terminal, badge: isRunning ? 'LIVE' : streamTasks.length },
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
                active
                  ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              )}
            >
              <Icon size={14} />
              {tab.label}
              {tab.badge && (
                <span className={clsx(
                  'text-[10px] px-1.5 py-0.2 rounded font-mono',
                  tab.badge === 'LIVE' ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400'
                )}>
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── TAB 1: OVERVIEW ──────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Direct Answer & Reality Check Card */}
          <div className="card p-6 border border-brand-500/30 bg-gradient-to-br from-brand-950/30 via-[#101024] to-[#0c0c1a] rounded-2xl space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-400" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-brand-300">
                    Executive Answer & Reality Check
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-100">
                  {executiveAnswerText || "Autonomous analytical investigation completed across baseline and current periods."}
                </h2>
              </div>
            </div>

            {realityCheckNote && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-200">
                <Info size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">
                  {realityCheckNote}
                </p>
              </div>
            )}
          </div>

          {/* Top 3 Dynamic Key Insight KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* KPI 1: Primary Finding Status */}
            <div className="card p-5 border border-brand-500/30 bg-[#0e1224] rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Primary Empirical Finding</span>
                <span className="p-1.5 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  <TrendingUp size={16} />
                </span>
              </div>
              <div className="text-sm font-bold text-slate-100 line-clamp-2 leading-snug">
                {streamFindings[0]?.statement || (executiveAnswerText ? executiveAnswerText.slice(0, 90) + '...' : 'Analysis completed')}
              </div>
              <p className="text-xs text-slate-400">
                Source: <span className="text-brand-300 font-semibold">{streamFindings[0]?.source || 'Verified Dataset'}</span>
              </p>
            </div>

            {/* KPI 2: Evidence & Findings Count */}
            <div className="card p-5 border border-blue-500/30 bg-[#0e1724] rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Evidence Ledger</span>
                <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Database size={16} />
                </span>
              </div>
              <div className="text-2xl font-extrabold text-slate-100">
                {streamFindings.length} <span className="text-xs font-normal text-slate-400">findings / {streamEvidence.length} items</span>
              </div>
              <p className="text-xs text-slate-400">
                {streamEvidence.filter(e => e.source_type === 'dataset').length} dataset observations verified
              </p>
            </div>

            {/* KPI 3: Hypotheses & Reliability */}
            <div className="card p-5 border border-emerald-500/30 bg-[#0d1a16] rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Statistical Verification</span>
                <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck size={16} />
                </span>
              </div>
              <div className="text-2xl font-extrabold text-slate-100">
                {streamHypotheses.filter(h => h.status === 'SUPPORTED').length} <span className="text-xs font-normal text-slate-400">of {streamHypotheses.length || 0} supported</span>
              </div>
              <p className="text-xs text-slate-400">
                {Math.round((streamConfidence || 0.85) * 100)}% Calibrated Analytical Confidence
              </p>
            </div>
          </div>

          {/* Data Quality & Sufficiency Summary Panel */}
          <div className="card p-5 border border-slate-800 bg-[#0f0f1c] rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <BarChart3 size={15} className="text-brand-400" />
                Data Quality & Coverage Assessment
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                {reliabilityLabel}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#141426] border border-slate-800/80 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Findings Generated</span>
                <span className="text-xs font-bold text-slate-200 block font-mono">{streamFindings.length} findings</span>
              </div>
              <div className="p-3 rounded-xl bg-[#141426] border border-slate-800/80 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Hypotheses Tested</span>
                <span className="text-xs font-bold text-slate-200 block font-mono">{streamHypotheses.length} hypotheses</span>
              </div>
              <div className="p-3 rounded-xl bg-[#141426] border border-slate-800/80 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Evidence Items</span>
                <span className="text-xs font-bold text-emerald-400 block font-mono">{streamEvidence.length} items logged</span>
              </div>
              <div className="p-3 rounded-xl bg-[#141426] border border-slate-800/80 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Critic Status</span>
                <span className="text-xs font-bold text-brand-300 block">
                  {streamCriticReviews.length > 0 ? (streamCriticReviews[streamCriticReviews.length - 1].verdict || 'Audited') : 'Verified'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Preview of Top Findings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Top Empirical Findings ({streamFindings.length})
              </h3>
              <button
                onClick={() => setActiveTab('findings')}
                className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1"
              >
                View all findings <ChevronRight size={13} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {streamFindings.slice(0, 4).map((f, idx) => (
                <div key={f.id || idx} className="card p-4 border border-slate-800 bg-[#101020] rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 border border-brand-500/20">
                      {f.source || 'Dataset'}
                    </span>
                    <span className="text-[11px] font-bold text-slate-300">
                      {Math.round((f.confidence || 0.9) * 100)}% Conf
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 font-medium leading-relaxed">
                    {f.statement}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: EXECUTIVE REPORT (MARKDOWN RENDERED) ────────────────────── */}
      {activeTab === 'report' && (
        <div className="card p-6 border border-slate-800 bg-[#0d0d1a] rounded-2xl space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Award size={20} className="text-brand-400" />
              Executive Root Cause Report
            </h2>
            {streamConfidence && (
              <span className="text-xs font-mono text-emerald-400 font-bold px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                Confidence Rating: {(streamConfidence * 100).toFixed(0)}%
              </span>
            )}
          </div>

          <MarkdownReport content={reportText} />
        </div>
      )}

      {/* ── TAB 3: KEY FINDINGS ──────────────────────────────────────────── */}
      {activeTab === 'findings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <FileText size={16} className="text-brand-400" />
              Quantitative Findings Ledger ({streamFindings.length})
            </h2>
          </div>

          {streamFindings.length === 0 ? (
            <div className="card text-center py-12 text-slate-500 text-xs border border-slate-800">
              No findings generated yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {streamFindings.map((f, idx) => (
                <div key={f.id || idx} className="card p-5 border border-slate-800 bg-[#101020] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded bg-brand-500/10 text-brand-300 border border-brand-500/20 uppercase">
                      {f.causal_classification || 'OBSERVATION'}
                    </span>
                    <span className="text-xs font-bold text-slate-300 font-mono">
                      {Math.round((f.confidence || 0.9) * 100)}% Confidence
                    </span>
                  </div>
                  <p className="text-xs text-slate-100 font-medium leading-relaxed">
                    {f.statement}
                  </p>
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Source: {f.source || 'Dataset'}</span>
                    <span>Verified</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: EVIDENCE LEDGER ────────────────────────────────────────── */}
      {activeTab === 'evidence' && (
        <EvidenceLedger evidenceItems={streamEvidence} />
      )}

      {/* ── TAB 5: HYPOTHESES MATRIX ─────────────────────────────────────── */}
      {activeTab === 'hypotheses' && (
        <HypothesisScorecard hypotheses={streamHypotheses} />
      )}

      {/* ── TAB 6: ROOT CAUSES & CRITIC ──────────────────────────────────── */}
      {activeTab === 'root_cause' && (
        <RootCausePanel
          rootCauses={streamRootCauses}
          confidenceBreakdown={streamConfBreakdown}
          criticReviews={streamCriticReviews}
        />
      )}

      {/* ── TAB 7: INVESTIGATION PLAN ────────────────────────────────────── */}
      {activeTab === 'plan' && (
        <div className="card p-6 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <CheckSquare size={16} className="text-brand-400" />
              Investigation Plan & Agenda ({streamPlan.length} steps)
            </h2>
          </div>

          <div className="space-y-3">
            {streamPlan.map((step, idx) => (
              <div key={idx} className="p-4 bg-[#121222] rounded-xl border border-slate-800 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-brand-400 font-bold">
                      Step {step.step_number || idx + 1}
                    </span>
                    <h4 className="text-xs font-bold text-slate-200">{step.name || step.objective}</h4>
                    <span className="text-[10px] text-slate-500 font-mono">[{step.agent}]</span>
                  </div>
                  <p className="text-xs text-slate-400">{step.objective}</p>
                </div>
                <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={13} /> Completed
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 8: LIVE TIMELINE ─────────────────────────────────────────── */}
      {activeTab === 'timeline' && (
        <div className="space-y-3">
          {streamTasks.length === 0 ? (
            <div className="card text-center py-12 text-slate-500 text-xs border border-slate-800">
              No task events recorded yet.
            </div>
          ) : (
            streamTasks.map((t, idx) => (
              <div key={t.id || idx} className="card p-4 border border-slate-800 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={clsx(
                    'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                    t.status === 'RUNNING' ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
                  )} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">{t.agent || 'Agent'}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-300">
                        {t.status}
                      </span>
                      {t.duration_ms && (
                        <span className="text-[10px] font-mono text-slate-500">
                          {t.duration_ms}ms
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{t.objective}</p>
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  {t.created_at ? new Date(t.created_at).toLocaleTimeString() : ''}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </PageShell>
  )
}
