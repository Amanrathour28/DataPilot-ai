import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, RotateCcw, Pause, Play, XCircle, CheckCircle2,
  Terminal, ShieldCheck, Database, Zap, FileText, CheckSquare,
  Award, Sparkles, Scale, Info, AlertCircle, ChevronRight,
  TrendingUp, BarChart3, Check, ShieldAlert, Users, UserPlus,
  MessageSquare, UserCheck, CheckCircle
} from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button'
import { StatusBadge, Badge } from '../../components/ui/Badge'
import { Skeleton } from '../../components/ui/Skeleton'
import { PageShell } from '../../components/layout/PageShell'
import { useToast } from '../../components/ui/Toast'
import { investigationsApi, collaborationApi, organizationsApi } from '../../services/api'
import AgentReasoningPanel from '../../components/investigations/AgentReasoningPanel'
import EvidenceLedger from '../../components/investigations/EvidenceLedger'
import HypothesisScorecard from '../../components/investigations/HypothesisScorecard'
import RootCausePanel from '../../components/investigations/RootCausePanel'
import MarkdownReport from '../../components/investigations/MarkdownReport'
import DiscussionTab from '../../components/investigation/DiscussionTab'
import useAuthStore from '../../stores/authStore'
import useOrganizationStore from '../../stores/organizationStore'
import { clsx } from 'clsx'

const STAGES = [
  { id: 'PLANNING',    label: '01 Plan',        desc: 'Decompose objective' },
  { id: 'ANALYZING',   label: '02 Investigate', desc: 'Isolate anomalies' },
  { id: 'TESTING',     label: '03 Hypothesize', desc: 'Formulate explanations' },
  { id: 'RETRIEVING',  label: '04 Retrieve',    desc: 'Cross-reference documents' },
  { id: 'VERIFYING',   label: '05 Verify',      desc: 'Critic causal audit' },
  { id: 'REPORTING',   label: '06 Explain',     desc: 'Root cause synthesis' },
]

export default function InvestigationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState('overview')
  const [isPaused, setIsPaused] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('connecting')

  // Real-time SSE event states
  const [streamStatus, setStreamStatus] = useState(null)
  const [streamStage, setStreamStage] = useState(null)
  const [streamTasks, setStreamTasks] = useState([])
  const [streamFindings, setStreamFindings] = useState([])
  const [streamHypotheses, setStreamHypotheses] = useState([])
  const [streamEvidence, setStreamEvidence] = useState([])
  const [streamActivities, setStreamActivities] = useState([])
  const [streamSummary, setStreamSummary] = useState(null)
  const [streamConfidence, setStreamConfidence] = useState(null)
  const [streamConfBreakdown, setStreamConfBreakdown] = useState(null)
  const [streamRootCauses, setStreamRootCauses] = useState([])
  const [streamPlan, setStreamPlan] = useState([])
  const [streamCriticReviews, setStreamCriticReviews] = useState([])
  const [streamAppliedMemories, setStreamAppliedMemories] = useState([])
  const [streamFailureReason, setStreamFailureReason] = useState(null)
  const [streamExecutionId, setStreamExecutionId] = useState(null)

  // Multi-tenant & Collaboration State
  const { user } = useAuthStore()
  const { activeOrganization } = useOrganizationStore()
  const [collaborators, setCollaborators] = useState([])
  const [reviews, setReviews] = useState([])
  const [showAddCollabModal, setShowAddCollabModal] = useState(false)
  const [orgMembers, setOrgMembers] = useState([])
  const [selectedCollabUserId, setSelectedCollabUserId] = useState('')
  const [selectedCollabRole, setSelectedCollabRole] = useState('EDITOR')
  const [isAddingCollab, setIsAddingCollab] = useState(false)
  const [reviewNote, setReviewNote] = useState('')

  const eventSourceRef = useRef(null)
  const lastEventIdRef = useRef(0)
  const seenEventIdsRef = useRef(new Set())

  const loadCollaborationData = async () => {
    if (!id) return
    try {
      const [collabs, revs] = await Promise.all([
        collaborationApi.getMembers(id).catch(() => []),
        collaborationApi.getReviews(id).catch(() => []),
      ])
      setCollaborators(collabs || [])
      setReviews(revs || [])
    } catch (err) {
      console.warn('Failed to load investigation collaboration data:', err)
    }
  }

  useEffect(() => {
    loadCollaborationData()
  }, [id])

  const openAddCollabModal = async () => {
    setShowAddCollabModal(true)
    if (activeOrganization?.id) {
      try {
        const members = await organizationsApi.members(activeOrganization.id)
        setOrgMembers(members || [])
      } catch (err) {
        console.warn('Failed to fetch org members for collaborator invite:', err)
      }
    }
  }

  const handleAddCollaborator = async (e) => {
    e.preventDefault()
    if (!selectedCollabUserId || !id) return
    try {
      setIsAddingCollab(true)
      await collaborationApi.addMember(id, {
        user_id: selectedCollabUserId,
        role: selectedCollabRole,
      })
      toast?.show('Collaborator attached to investigation', 'success')
      setShowAddCollabModal(false)
      loadCollaborationData()
    } catch (err) {
      toast?.show(err.response?.data?.detail || 'Failed to add collaborator', 'error')
    } finally {
      setIsAddingCollab(false)
    }
  }

  const handleFindingReview = async (findingId, rootCauseIndex, status) => {
    try {
      await collaborationApi.submitReview(id, {
        finding_id: findingId,
        root_cause_index: rootCauseIndex,
        status: status,
        reviewer_role_title: 'Domain Reviewer',
        notes: reviewNote || undefined,
      })
      toast?.show(`Finding marked as ${status}`, 'success')
      setReviewNote('')
      loadCollaborationData()
    } catch (err) {
      toast?.show(err.response?.data?.detail || 'Failed to submit review', 'error')
    }
  }

  // Initial Fetch & Regular Polling Fallback
  const { data: detail, isLoading, refetch } = useQuery({
    queryKey: ['investigation-detail', id],
    queryFn: () => investigationsApi.get(id),
    enabled: !!id,
    staleTime: 3000,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (['COMPLETED', 'COMPLETED_WITH_LIMITATIONS', 'INSUFFICIENT_DATA', 'FAILED', 'CANCELLED'].includes(status)) {
        return false
      }
      return 4000
    },
  })

  // Hydrate state from DB payload when detail query resolves
  // Hydrate state from DB payload when detail query resolves
  useEffect(() => {
    if (!detail) return

    const terminalStatuses = ['COMPLETED', 'COMPLETED_WITH_LIMITATIONS', 'INSUFFICIENT_DATA', 'INSUFFICIENT_EVIDENCE', 'FAILED', 'CANCELLED']
    
    // Authoritatively synchronize terminal status from database query
    if (terminalStatuses.includes(detail.status)) {
      setStreamStatus(detail.status)
      setConnectionStatus('disconnected')
    } else if (!streamStatus) {
      setStreamStatus(detail.status)
    }

    if (detail.last_completed_stage) setStreamStage(detail.last_completed_stage)
    if (detail.findings?.length > 0) setStreamFindings(detail.findings)
    if (detail.hypotheses?.length > 0) setStreamHypotheses(detail.hypotheses)
    if (detail.evidence_ledger?.length > 0) setStreamEvidence(detail.evidence_ledger)
    if (detail.summary) setStreamSummary(detail.summary)
    if (detail.confidence_score) setStreamConfidence(detail.confidence_score)
    if (detail.confidence_breakdown) setStreamConfBreakdown(detail.confidence_breakdown)
    if (detail.root_causes?.length > 0) setStreamRootCauses(detail.root_causes)
    if (detail.plan?.length > 0) setStreamPlan(detail.plan)
    if (detail.critic_reviews?.length > 0) setStreamCriticReviews(detail.critic_reviews)
    if (detail.failure_reason) setStreamFailureReason(detail.failure_reason)
    if (detail.execution_id) setStreamExecutionId(detail.execution_id)
  }, [detail])

  // Setup Server-Sent Events (SSE) Stream
  useEffect(() => {
    if (!id) return

    const terminalStatuses = ['COMPLETED', 'COMPLETED_WITH_LIMITATIONS', 'INSUFFICIENT_DATA', 'INSUFFICIENT_EVIDENCE', 'FAILED', 'CANCELLED']
    if (detail?.status && terminalStatuses.includes(detail.status)) {
      setConnectionStatus('disconnected')
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

          if (terminalStatuses.includes(data.status)) {
            toast?.show(data.message || 'Investigation concluded', data.status === 'FAILED' ? 'error' : 'info')
            setConnectionStatus('disconnected')
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

          // Check if this activity is a terminal event from Supervisor
          if (data.agent === 'Supervisor Agent' && (data.event_type === 'COMPLETED' || data.event_type === 'FAILED')) {
            const finalSt = data.details?.status || (data.event_type === 'FAILED' ? 'FAILED' : 'COMPLETED')
            setStreamStatus(finalSt)
            setStreamStage('COMPLETED')
            setConnectionStatus('disconnected')
            if (eventSourceRef.current) {
              eventSourceRef.current.close()
              eventSourceRef.current = null
            }
            queryClient.invalidateQueries(['investigation-detail', id])
            if (finalSt !== 'FAILED') setActiveTab('overview')
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
        console.warn('Failed to parse SSE payload:', err)
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
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </PageShell>
    )
  }

  if (!detail) {
    return (
      <PageShell className="text-center font-mono text-xs text-[#f2f2ef]/40 py-20">
        Investigation record not found.
      </PageShell>
    )
  }

  const currentStatus = streamStatus || detail.status
  const isRunning = ['PENDING', 'RUNNING', 'PLANNING', 'ANALYZING', 'TESTING', 'RETRIEVING', 'VERIFYING', 'REPORTING', 'REINVESTIGATING'].includes(currentStatus)

  const reportText = typeof streamSummary === 'string'
    ? (streamSummary.trim().startsWith('{') ? (() => { try { return JSON.parse(streamSummary).summary || streamSummary } catch { return streamSummary } })() : streamSummary)
    : (streamSummary?.summary || '')

  const realityCheckMatch = reportText.match(/# 2\. Reality Check[\s\S]*?> \*\*Reality Check Note\*\*: (.*?)(?=\n---|\n#|$)/)
  const realityCheckNote = realityCheckMatch ? realityCheckMatch[1] : null

  const executiveAnswerMatch = reportText.match(/# 1\. Executive Answer\s*\n\n([\s\S]*?)(?=\n---|\n#|$)/)
  const executiveAnswerText = executiveAnswerMatch ? executiveAnswerMatch[1].trim() : null

  const reliabilityMatch = reportText.match(/- \*\*Statistical Reliability\*\*:\s*\*\*?(.*?)\*\*?/)
  const reliabilityLabel = reliabilityMatch ? reliabilityMatch[1].trim() : (streamConfidence && streamConfidence < 0.75 ? 'EXPLORATORY' : 'HIGH RIGOR')

  return (
    <PageShell wide className="space-y-8">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/[0.08]">
        <div className="flex items-start gap-4 min-w-0">
          <IconButton icon={ArrowLeft} label="Back" onClick={() => navigate('/investigations')} className="mt-1" />
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-xs text-[#c8ff00] uppercase tracking-widest">
                ID / {id.slice(0, 10)}
              </span>
              <StatusBadge status={currentStatus} />
              {streamConfidence && (
                <span className="font-mono text-[11px] font-bold text-[#c8ff00] border border-[#c8ff00]/30 bg-[#c8ff00]/10 px-2 py-0.5">
                  {Math.round(streamConfidence * 100)}% Analytical Rigor
                </span>
              )}
              <span className="font-mono text-[10px] text-[#f2f2ef]/50 uppercase tracking-widest border border-white/[0.08] px-2 py-0.5">
                {detail.visibility || 'WORKSPACE'}
              </span>
            </div>

            <h1 className="font-display font-extrabold text-xl sm:text-2xl md:text-3xl uppercase tracking-tight text-[#f2f2ef] leading-tight">
              {detail.objective || detail.title}
            </h1>

            {/* Team Collaborators Strip */}
            <div className="flex items-center gap-3 flex-wrap font-mono text-xs pt-1">
              <div className="flex items-center gap-1.5 text-[#f2f2ef]/60">
                <span className="text-[#f2f2ef]/40">Creator:</span>
                <span className="text-[#f2f2ef] font-semibold">{detail.created_by_name || 'Operator'}</span>
              </div>

              {detail.assigned_to_name && (
                <div className="flex items-center gap-1.5 text-[#f2f2ef]/60">
                  <span className="text-[#f2f2ef]/40">&middot; Assigned to:</span>
                  <span className="text-[#c8ff00] font-semibold">{detail.assigned_to_name}</span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <span className="text-[#f2f2ef]/40">&middot; Collaborators:</span>
                <div className="flex items-center -space-x-1.5">
                  {collaborators.map((c) => (
                    <div
                      key={c.id}
                      title={`${c.name} (${c.role})`}
                      className="w-5 h-5 rounded-full bg-white/[0.1] border border-black text-[#f2f2ef] font-mono text-[9px] font-bold flex items-center justify-center"
                    >
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                  ))}
                </div>
                <button
                  onClick={openAddCollabModal}
                  className="flex items-center gap-1 text-[10px] font-mono text-[#c8ff00] hover:underline ml-1 cursor-pointer"
                >
                  <UserPlus size={11} />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isRunning ? (
            <>
              <Button variant="secondary" size="sm" onClick={handlePauseToggle}>
                {isPaused ? <Play size={13} /> : <Pause size={13} />}
                <span>{isPaused ? 'Resume' : 'Pause'}</span>
              </Button>
              <Button variant="danger" size="sm" onClick={handleCancel}>
                <XCircle size={13} />
                <span>Cancel</span>
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={handleReplay}>
              <RotateCcw size={13} />
              <span>Replay Investigation</span>
            </Button>
          )}
        </div>
      </div>

      {/* Add Collaborator Modal */}
      {showAddCollabModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm border border-white/[0.12] bg-[#0c0c0c] p-6 font-sans space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#c8ff00]">
                ADD INVESTIGATION COLLABORATOR
              </span>
              <button onClick={() => setShowAddCollabModal(false)} className="text-[#f2f2ef]/40 hover:text-white">
                ✕
              </button>
            </div>
            <form onSubmit={handleAddCollaborator} className="space-y-3">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#f2f2ef]/50 mb-1">
                  Select Teammate
                </label>
                <select
                  required
                  value={selectedCollabUserId}
                  onChange={(e) => setSelectedCollabUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-white/[0.12] text-xs font-mono text-[#f2f2ef] focus:border-[#c8ff00] focus:outline-none"
                >
                  <option value="">Choose colleague...</option>
                  {orgMembers.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name} ({m.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#f2f2ef]/50 mb-1">
                  Collaborator Role
                </label>
                <select
                  value={selectedCollabRole}
                  onChange={(e) => setSelectedCollabRole(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-white/[0.12] text-xs font-mono text-[#f2f2ef] focus:border-[#c8ff00] focus:outline-none"
                >
                  <option value="EDITOR">EDITOR (Add comments & follow-ups)</option>
                  <option value="REVIEWER">REVIEWER (Verify & approve findings)</option>
                  <option value="VIEWER">VIEWER (Read-only access)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCollabModal(false)}
                  className="px-3 py-1.5 text-xs font-mono text-[#f2f2ef]/60 hover:text-white border border-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingCollab || !selectedCollabUserId}
                  className="btn-dn-primary px-3 py-1.5 text-xs font-mono"
                >
                  {isAddingCollab ? 'Attaching...' : 'Attach Teammate →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6-Stage Investigation Lifecycle Stepper (DayNight Rail) */}
      <div className="border border-white/[0.08] bg-[#0c0c0c] p-4 sm:p-6">
        <div className="flex items-center gap-0 overflow-x-auto">
          {STAGES.map((s, idx) => {
            const isCompleted = ['COMPLETED', 'COMPLETED_WITH_LIMITATIONS', 'INSUFFICIENT_DATA', 'INSUFFICIENT_EVIDENCE'].includes(currentStatus)
            
            let taskPassed = isCompleted
            let taskExecuting = false
            
            if (s.id === 'PLANNING') {
              taskPassed = isCompleted || ['ANALYZING', 'TESTING', 'RETRIEVING', 'VERIFYING', 'REPORTING', 'COMPLETED'].includes(streamStage) || streamPlan.length > 0
              taskExecuting = (streamStage === 'PLANNING' || currentStatus === 'PENDING' || currentStatus === 'QUEUED' || currentStatus === 'PLANNING') && isRunning && !taskPassed
            } else if (s.id === 'ANALYZING') {
              taskPassed = isCompleted || ['TESTING', 'RETRIEVING', 'VERIFYING', 'REPORTING', 'COMPLETED'].includes(streamStage) || streamFindings.length > 0
              taskExecuting = (streamStage === 'ANALYZING' || currentStatus === 'ANALYZING') && isRunning && !taskPassed
            } else if (s.id === 'TESTING') {
              taskPassed = isCompleted || ['RETRIEVING', 'VERIFYING', 'REPORTING', 'COMPLETED'].includes(streamStage) || streamHypotheses.length > 0
              taskExecuting = (streamStage === 'TESTING' || currentStatus === 'TESTING') && isRunning && !taskPassed
            } else if (s.id === 'RETRIEVING') {
              taskPassed = isCompleted || ['VERIFYING', 'REPORTING', 'COMPLETED'].includes(streamStage) || streamEvidence.some(e => e.source_type === 'document')
              taskExecuting = (streamStage === 'RETRIEVING' || currentStatus === 'RETRIEVING') && isRunning && !taskPassed
            } else if (s.id === 'VERIFYING') {
              taskPassed = isCompleted || ['REPORTING', 'COMPLETED'].includes(streamStage) || streamCriticReviews.length > 0
              taskExecuting = (streamStage === 'VERIFYING' || currentStatus === 'VERIFYING') && isRunning && !taskPassed
            } else if (s.id === 'REPORTING') {
              taskPassed = isCompleted
              taskExecuting = (streamStage === 'REPORTING' || streamStage === 'REPORT' || currentStatus === 'REPORTING') && isRunning && !taskPassed
            }

            return (
              <div key={s.id} className="flex items-center flex-1 min-w-[120px]">
                <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5 py-1 px-2">
                  <div className={clsx(
                    'w-5 h-5 rounded-none border flex items-center justify-center transition-all',
                    taskExecuting && 'border-[#d4ff58] bg-[#d4ff58] text-black shadow-[0_0_8px_rgba(212,255,88,0.5)]',
                    taskPassed && 'border-[#d4ff58]/60 bg-[#d4ff58]/10 text-[#d4ff58]',
                    !taskExecuting && !taskPassed && 'border-white/[0.1] bg-transparent text-[#f2f2ef]/20'
                  )}>
                    {taskExecuting ? (
                      <span className="w-1.5 h-1.5 bg-black animate-pulse" />
                    ) : taskPassed ? (
                      <Check size={11} className="text-[#d4ff58]" />
                    ) : (
                      <span className="w-1 h-1 bg-white/20" />
                    )}
                  </div>
                  <span className={clsx(
                    'font-mono text-[10px] uppercase tracking-wider whitespace-nowrap',
                    taskExecuting && 'text-[#d4ff58] font-bold',
                    taskPassed && 'text-[#f2f2ef]/70',
                    !taskExecuting && !taskPassed && 'text-[#f2f2ef]/30'
                  )}>
                    {s.label}
                  </span>
                </div>
                {idx < STAGES.length - 1 && (
                  <div className={clsx('h-px flex-1 max-w-[28px] transition-colors', taskPassed ? 'bg-[#d4ff58]/40' : 'bg-white/[0.06]')} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Failure Diagnostic Alert */}
      {currentStatus === 'FAILED' && (
        <div className="p-6 border border-[#ff4e4e]/30 bg-[#ff4e4e]/10 text-xs font-mono space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#ff4e4e] font-bold uppercase">
              <ShieldAlert size={16} />
              <span>Execution Exception Diagnostic</span>
            </div>
            <Button variant="secondary" size="sm" onClick={handleReplay}>
              <RotateCcw size={13} /> Replay
            </Button>
          </div>
          <p className="text-[#ff4e4e]/90 leading-relaxed break-words">
            {streamFailureReason || detail.failure_reason || 'Dataset computation encountered an unhandled exception.'}
          </p>
        </div>
      )}

      {/* Real-time Agent Reasoning Stream */}
      <AgentReasoningPanel
        activities={streamActivities}
        status={currentStatus}
        stage={streamStage}
        connectionStatus={connectionStatus}
      />

      {/* Navigation Tabs (Underline Editorial Style) */}
      <div className="flex items-center gap-0 border-b border-white/[0.08] overflow-x-auto">
        {[
          { id: 'overview',   label: 'Overview',          icon: Sparkles },
          { id: 'discussion', label: 'Discussion & Follow-ups', icon: MessageSquare },
          { id: 'report',     label: 'Executive Report',   icon: Award },
          { id: 'findings',   label: 'Key Findings',       icon: FileText,   badge: streamFindings.length || null },
          { id: 'evidence',   label: 'Evidence Ledger',    icon: Database,   badge: streamEvidence.length || null },
          { id: 'hypotheses', label: 'Hypotheses Matrix',  icon: Zap,        badge: streamHypotheses.length || null },
          { id: 'root_cause', label: 'Root Causes & Critic', icon: ShieldCheck },
          { id: 'plan',       label: 'Investigation Plan', icon: CheckSquare, badge: streamPlan.length || null },
          { id: 'timeline',   label: 'Live Timeline',      icon: Terminal,   badge: isRunning ? 'LIVE' : streamTasks.length },
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-5 py-3 font-mono text-xs uppercase tracking-wider border-b-2 -mb-px transition-all whitespace-nowrap cursor-pointer',
                active
                  ? 'text-[#d4ff58] border-[#d4ff58] font-bold'
                  : 'text-[#f2f2ef]/50 border-transparent hover:text-[#f2f2ef] hover:border-white/[0.2]'
              )}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={clsx(
                  'text-[9px] px-1.5 py-px font-mono',
                  tab.badge === 'LIVE' ? 'bg-[#ff4e4e] text-white animate-pulse' : 'bg-white/[0.08] text-[#f2f2ef]/70'
                )}>
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── TAB 1: OVERVIEW ──────────────────────────────────────────────── */}
      {activeTab === 'overview' && currentStatus !== 'CANCELLED' && (
        <div className="space-y-6">
          
          {/* Direct Answer & Reality Check Card */}
          <div className="border border-white/[0.08] bg-[#0c0c0c] p-6 sm:p-8 space-y-4">
            <div>
              <span className="font-mono text-[10px] text-[#d4ff58] uppercase tracking-widest block mb-1">
                Executive Synthesis & Reality Check
              </span>
              <div className="font-sans text-base sm:text-lg font-bold text-[#f2f2ef] whitespace-pre-line leading-relaxed">
                {executiveAnswerText || detail.summary || "Investigation concluded. See empirical findings and evidence citations below."}
              </div>
            </div>

            {realityCheckNote && (
              <div className="p-4 border border-amber-400/20 bg-amber-400/5 font-mono text-xs text-amber-300 leading-relaxed">
                <strong>Reality Check:</strong> {realityCheckNote}
              </div>
            )}
          </div>

          {/* Key Insight KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-white/[0.08] bg-[#0c0c0c] p-6 space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#f2f2ef]/40 block">
                Primary Root Cause Driver
              </span>
              <p className="font-display font-bold text-base uppercase text-[#f2f2ef] line-clamp-2">
                {streamFindings[0]?.statement || (executiveAnswerText ? executiveAnswerText.slice(0, 90) + '...' : 'Analysis verified')}
              </p>
              <span className="font-mono text-xs text-[#d4ff58] block">
                Source: {streamFindings[0]?.source || 'Dataset Slicing'}
              </span>
            </div>

            <div className="border border-white/[0.08] bg-[#0c0c0c] p-6 space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#f2f2ef]/40 block">
                Evidence Ledger
              </span>
              <p className="font-display font-extrabold text-3xl text-[#f2f2ef]">
                {streamEvidence.length} <span className="text-xs font-mono font-normal text-[#f2f2ef]/40">verified entries</span>
              </p>
              <span className="font-mono text-xs text-[#f2f2ef]/50 block">
                {streamFindings.length} analytical findings generated
              </span>
            </div>

            <div className="border border-white/[0.08] bg-[#0c0c0c] p-6 space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#f2f2ef]/40 block">
                Hypotheses Supported
              </span>
              <p className="font-display font-extrabold text-3xl text-[#d4ff58]">
                {streamHypotheses.filter(h => h.status === 'SUPPORTED').length} <span className="text-xs font-mono font-normal text-[#f2f2ef]/40">of {streamHypotheses.length || 0}</span>
              </p>
              <span className="font-mono text-xs text-[#f2f2ef]/50 block">
                {Math.round((streamConfidence || 0.85) * 100)}% Calibrated Confidence
              </span>
            </div>
          </div>

          {/* Quick Findings Preview */}
          {streamFindings.length > 0 && (
            <div className="border border-white/[0.08] bg-[#0c0c0c] p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <h3 className="font-display font-bold text-sm uppercase tracking-tight text-[#f2f2ef]">
                  Empirical Findings ({streamFindings.length})
                </h3>
                <button
                  onClick={() => setActiveTab('findings')}
                  className="font-mono text-xs text-[#d4ff58] hover:underline uppercase tracking-wider cursor-pointer"
                >
                  View All &rarr;
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {streamFindings.slice(0, 4).map((f, idx) => (
                  <div key={f.id || idx} className="p-4 border border-white/[0.06] bg-[#080808] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-[#d4ff58] uppercase">
                        {f.source || 'Dataset'}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#f2f2ef]/80">
                        {Math.round((f.confidence || 0.9) * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-[#f2f2ef] font-medium leading-relaxed">
                      {f.statement}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── TAB 1.5: DISCUSSION & FOLLOW-UPS ──────────────────────────────── */}
      {activeTab === 'discussion' && (
        <DiscussionTab
          investigationId={id}
          onFollowUpTriggered={() => refetch()}
        />
      )}

      {/* ── TAB 2: EXECUTIVE REPORT ────────────────────────────────────────── */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <h2 className="font-display font-bold text-lg uppercase tracking-tight text-[#f2f2ef] flex items-center gap-2">
              <Award size={18} className="text-[#c8ff00]" />
              <span>Audited Executive Report</span>
            </h2>
            {streamConfidence && (
              <span className="font-mono text-xs text-[#c8ff00] font-bold border border-[#c8ff00]/30 bg-[#c8ff00]/10 px-3 py-1">
                Confidence: {(streamConfidence * 100).toFixed(0)}%
              </span>
            )}
          </div>
          <MarkdownReport content={reportText} />
        </div>
      )}

      {/* ── TAB 3: KEY FINDINGS & HUMAN VERIFICATION ────────────────────────── */}
      {activeTab === 'findings' && (
        <div className="space-y-4">
          <div className="border-b border-white/[0.08] pb-3 flex items-center justify-between">
            <h3 className="font-display font-bold text-base uppercase tracking-tight text-[#f2f2ef]">
              Quantitative Findings & Human Verification Ledger ({streamFindings.length})
            </h3>
            <span className="font-mono text-xs text-[#f2f2ef]/40">
              Verified: {reviews.filter((r) => r.status === 'APPROVED').length} / {streamFindings.length}
            </span>
          </div>

          {streamFindings.length === 0 ? (
            <div className="border border-white/[0.08] bg-[#0c0c0c] p-12 text-center text-xs font-mono text-[#f2f2ef]/40">
              No findings generated yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {streamFindings.map((f, idx) => {
                const findingReview = reviews.find((r) => r.finding_id === f.id || r.root_cause_index === idx)
                const isApproved = findingReview?.status === 'APPROVED'
                const isRejected = findingReview?.status === 'REJECTED'

                return (
                  <div key={f.id || idx} className="p-5 border border-white/[0.08] bg-[#0c0c0c] space-y-3 font-sans">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-[#c8ff00]/30 bg-[#c8ff00]/10 text-[#c8ff00]">
                        {f.causal_classification || 'OBSERVATION'}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#f2f2ef]">
                        {Math.round((f.confidence || 0.9) * 100)}% Rigor
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-[#f2f2ef] leading-relaxed">
                      {f.statement}
                    </p>

                    {/* Human Verification Stamp */}
                    <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                      {isApproved ? (
                        <div className="flex items-center gap-1.5 text-xs text-[#c8ff00] font-mono">
                          <CheckCircle2 size={13} />
                          <span>✓ Verified by {findingReview.reviewer_name || 'Expert'}</span>
                        </div>
                      ) : isRejected ? (
                        <div className="flex items-center gap-1.5 text-xs text-red-400 font-mono">
                          <XCircle size={13} />
                          <span>✕ Challenged by {findingReview.reviewer_name || 'Reviewer'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-[#f2f2ef]/40 font-mono">
                          <span>AI Synthesized (Unreviewed)</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleFindingReview(f.id || `f_${idx}`, idx, 'APPROVED')}
                          disabled={isApproved}
                          className="px-2 py-1 bg-white/[0.04] hover:bg-[#c8ff00]/20 hover:text-[#c8ff00] border border-white/[0.08] text-[10px] font-mono transition-colors cursor-pointer"
                          title="Approve & Stamp Finding"
                        >
                          Approve ✓
                        </button>
                        <button
                          onClick={() => handleFindingReview(f.id || `f_${idx}`, idx, 'REJECTED')}
                          disabled={isRejected}
                          className="px-2 py-1 bg-white/[0.04] hover:bg-red-500/20 hover:text-red-400 border border-white/[0.08] text-[10px] font-mono transition-colors cursor-pointer"
                          title="Challenge or Reject Finding"
                        >
                          Reject ✕
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
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
        <div className="border border-white/[0.08] bg-[#0c0c0c] p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <h3 className="font-display font-bold text-base uppercase text-[#f2f2ef]">
              Investigation Plan ({streamPlan.length} steps)
            </h3>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {streamPlan.map((step, idx) => (
              <div key={idx} className="p-4 bg-[#080808] border border-white/[0.06] flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[#d4ff58] font-bold">
                      Step {(step.step_number || idx + 1).toString().padStart(2, '0')}
                    </span>
                    <span className="font-bold text-[#f2f2ef] uppercase">
                      {step.name || step.objective}
                    </span>
                    <span className="text-[#f2f2ef]/40">[{step.agent}]</span>
                  </div>
                  <p className="text-[#f2f2ef]/70 font-sans text-xs">{step.objective}</p>
                </div>
                <span className="text-[#d4ff58] text-[11px] font-bold flex items-center gap-1">
                  <Check size={12} /> Complete
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 8: LIVE TIMELINE ─────────────────────────────────────────── */}
      {activeTab === 'timeline' && (
        <div className="space-y-3 font-mono text-xs">
          {streamTasks.length === 0 ? (
            <div className="border border-white/[0.08] bg-[#0c0c0c] p-12 text-center text-[#f2f2ef]/40">
              No task events recorded yet.
            </div>
          ) : (
            streamTasks.map((t, idx) => (
              <div key={t.id || idx} className="p-4 border border-white/[0.08] bg-[#0c0c0c] flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={clsx(
                    'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                    t.status === 'RUNNING' ? 'bg-[#d4ff58] animate-ping' : 'bg-[#d4ff58]'
                  )} />
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold uppercase text-[#f2f2ef]">{t.agent || 'Agent'}</span>
                      <span className="text-[10px] text-[#f2f2ef]/40">[{t.status}]</span>
                    </div>
                    <p className="text-xs text-[#f2f2ef]/70 font-sans leading-relaxed truncate">{t.objective}</p>
                  </div>
                </div>
                {t.created_at && (
                  <span className="text-[10px] text-[#f2f2ef]/40 flex-shrink-0">
                    {new Date(t.created_at).toLocaleTimeString()}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}

    </PageShell>
  )
}
