import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, RefreshCw, CheckCircle2, XCircle, AlertCircle, Clock,
  Play, Pause, ShieldAlert, Sparkles, Terminal, FileText, Database,
  GitMerge, Award, RotateCcw, Brain, CheckSquare, Zap, Calculator,
  TrendingUp, Layers, ChevronRight, Download
} from 'lucide-react'
import { IconButton, Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { Skeleton } from '../../components/ui/Skeleton'
import { investigationsApi } from '../../services/api'
import { useToast } from '../../components/ui/Toast'
import EvidenceLedger from '../../components/investigations/EvidenceLedger'
import HypothesisScorecard from '../../components/investigations/HypothesisScorecard'
import RootCausePanel from '../../components/investigations/RootCausePanel'
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

  const [activeTab, setActiveTab] = useState('report') // report | plan | timeline | evidence | hypotheses | root_cause

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
  const [isPaused, setIsPaused] = useState(false)

  // Fetch full details
  const { data: detail, isLoading, refetch } = useQuery({
    queryKey: ['investigation-detail', id],
    queryFn: () => investigationsApi.get(id),
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
      setStreamSummary(detail.summary)
      setStreamConfidence(detail.confidence_score)
      setStreamPlan(detail.plan || [])
      setStreamRootCauses(detail.root_causes || [])
      setStreamCriticReviews(detail.critic_reviews || [])
      setStreamConfBreakdown(detail.confidence_breakdown)
      setStreamAppliedMemories(detail.applied_memories || [])
      if (['RUNNING', 'PLANNING', 'ANALYZING', 'TESTING', 'RETRIEVING', 'VERIFYING', 'REPORTING'].includes(detail.status)) {
        setActiveTab('timeline')
      }
    }
  }, [detail])

  // Establish SSE connection if running
  useEffect(() => {
    if (!id) return
    const isRunning = ['PENDING', 'RUNNING', 'PLANNING', 'ANALYZING', 'TESTING', 'RETRIEVING', 'VERIFYING', 'REPORTING', 'REINVESTIGATING'].includes(detail?.status)
    if (detail && !isRunning) return

    const streamUrl = investigationsApi.getStreamUrl(id)
    const eventSource = new EventSource(streamUrl)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (!data) return

        if (data.type === 'status') {
          setStreamStatus(data.status)
          if (data.stage) setStreamStage(data.stage)
          if (data.summary) setStreamSummary(data.summary)
          if (data.confidence_score) setStreamConfidence(data.confidence_score)
          if (data.root_causes) setStreamRootCauses(data.root_causes)
          if (data.evidence_ledger) setStreamEvidence(data.evidence_ledger)
          if (data.confidence_breakdown) setStreamConfBreakdown(data.confidence_breakdown)

          if (data.status === 'COMPLETED' || data.status === 'FAILED') {
            toast?.show(data.message || 'Investigation concluded', 'info')
            eventSource.close()
            queryClient.invalidateQueries(['investigation-detail', id])
            setActiveTab('report')
          }
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

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => {
      eventSource.close()
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
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48 rounded" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="p-8 text-center text-slate-500">
        Investigation not found.
      </div>
    )
  }

  const currentStatus = streamStatus || detail.status
  const isRunning = ['PENDING', 'RUNNING', 'PLANNING', 'ANALYZING', 'TESTING', 'RETRIEVING', 'VERIFYING', 'REPORTING', 'REINVESTIGATING'].includes(currentStatus)

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <IconButton icon={ArrowLeft} label="Back" onClick={() => navigate('/investigations')} />
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-100">{detail.objective}</h1>
              <StatusBadge status={currentStatus} />
              {streamConfidence && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {Math.round(streamConfidence * 100)}% Calibrated Confidence
                </span>
              )}
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
            const isPassed = !isRunning && currentStatus === 'COMPLETED'
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

      {/* Business Memory Applied Context Indicator */}
      {streamAppliedMemories.length > 0 && (
        <div className="card p-3 bg-brand-500/5 border border-brand-500/20 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-brand-300 font-medium">
            <Brain size={15} className="text-brand-400 flex-shrink-0" />
            <span>Business Context Injected:</span>
            <span className="text-slate-300 font-normal truncate max-w-xl">
              {streamAppliedMemories.map(m => m.content).join(' · ')}
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-bold">
            {streamAppliedMemories.length} rules active
          </span>
        </div>
      )}

      {/* Main Investigation Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        {[
          { id: 'report', label: 'Executive Report', icon: Award },
          { id: 'plan', label: 'Investigation Plan', icon: CheckSquare, badge: streamPlan.length || null },
          { id: 'evidence', label: 'Evidence Ledger', icon: Database, badge: streamEvidence.length || null },
          { id: 'hypotheses', label: 'Hypotheses Matrix', icon: Zap, badge: streamHypotheses.length || null },
          { id: 'root_cause', label: 'Root Causes & Critic', icon: Award },
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

      {/* Tab 1: Executive Report */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          <div className="card p-6 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Award size={18} className="text-brand-400" />
                Evidence-Backed Root Cause Analysis Report
              </h2>
              {streamConfidence && (
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  Confidence Rating: {(streamConfidence * 100).toFixed(0)}%
                </span>
              )}
            </div>

            <div className="prose prose-invert max-w-none text-xs text-slate-300 leading-relaxed font-normal whitespace-pre-wrap">
              {streamSummary || (
                isRunning
                  ? "Investigation is currently in progress. Generating empirical analysis..."
                  : "No summary report available."
              )}
            </div>
          </div>

          {/* Key Findings Card Grid */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Validated Findings & Proof Points ({streamFindings.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {streamFindings.map((f, idx) => (
                <div key={f.id || idx} className="card p-4 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 border border-brand-500/20">
                      {f.source || 'Dataset Anomaly'}
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

      {/* Tab 2: Investigation Plan */}
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

      {/* Tab 3: Evidence Ledger */}
      {activeTab === 'evidence' && (
        <EvidenceLedger evidenceItems={streamEvidence} />
      )}

      {/* Tab 4: Hypotheses Matrix */}
      {activeTab === 'hypotheses' && (
        <HypothesisScorecard hypotheses={streamHypotheses} />
      )}

      {/* Tab 5: Root Causes & Critic */}
      {activeTab === 'root_cause' && (
        <RootCausePanel
          rootCauses={streamRootCauses}
          confidenceBreakdown={streamConfBreakdown}
          criticReviews={streamCriticReviews}
        />
      )}

      {/* Tab 6: Live Timeline */}
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
    </div>
  )
}
