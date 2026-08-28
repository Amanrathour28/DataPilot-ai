import { useEffect, useRef } from 'react'
import {
  Sparkles, CheckCircle2, AlertCircle, XCircle, Clock,
  ArrowRight, Activity, Wifi, WifiOff, ShieldAlert
} from 'lucide-react'
import { clsx } from 'clsx'

const AGENT_COLORS = {
  'Supervisor Agent': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Planning Agent': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Data Analyst': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'Hypothesis Agent': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Hypothesis Tester': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'RAG Search Agent': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'Critic Agent': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  'Report Agent': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  'System': 'bg-slate-800 text-slate-300 border-slate-700'
}

export default function AgentReasoningPanel({
  activities = [],
  status = 'PENDING',
  stage = 'PLANNING',
  connectionStatus = 'connected' // connected | reconnecting | disconnected
}) {
  const containerRef = useRef(null)

  // Smoothly auto-scroll to the bottom when new activity items arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [activities.length])

  const isRunning = ['PENDING', 'RUNNING', 'PLANNING', 'ANALYZING', 'TESTING', 'RETRIEVING', 'VERIFYING', 'REPORTING', 'REINVESTIGATING'].includes(status)
  const isFailed = status === 'FAILED'
  const isCancelled = status === 'CANCELLED'

  return (
    <div className="card p-5 border border-slate-800 bg-[#0e0e1a] rounded-2xl space-y-4 shadow-xl">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
            <Activity size={18} className={isRunning ? "animate-pulse" : ""} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Live Agent Activity & Reasoning Stream
              <Sparkles size={14} className="text-amber-400" />
            </h3>
            <p className="text-[11px] text-slate-400">
              Autonomous multi-agent execution feed with user-safe analytical summaries
            </p>
          </div>
        </div>

        {/* Connection & Status Badges */}
        <div className="flex items-center gap-2">
          {connectionStatus === 'reconnecting' && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
              <WifiOff size={11} /> Reconnecting SSE...
            </span>
          )}

          {connectionStatus === 'disconnected' && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
              <WifiOff size={11} /> Offline
            </span>
          )}

          {isRunning ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              LIVE FEED
            </span>
          ) : isFailed ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <XCircle size={11} /> FAILED
            </span>
          ) : isCancelled ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
              <ShieldAlert size={11} /> CANCELLED
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-brand-500/10 text-brand-300 border border-brand-500/20">
              <CheckCircle2 size={11} /> CONCLUDED
            </span>
          )}
        </div>
      </div>

      {/* Activity Log Feed Container */}
      <div
        ref={containerRef}
        className="max-h-[380px] overflow-y-auto space-y-2.5 pr-2 scrollbar-thin scrollbar-thumb-slate-800"
      >
        {activities.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <Clock size={24} className="mx-auto text-slate-600 animate-spin" />
            <p className="text-xs text-slate-400 font-medium">
              Initializing multi-agent graph... Awaiting initial activity broadcast.
            </p>
          </div>
        ) : (
          activities.map((item, idx) => {
            const isCompleted = item.status === 'completed'
            const isFailed = item.status === 'failed'
            const isWarning = item.status === 'warning'
            const isRunning = item.status === 'running'

            const badgeStyle = AGENT_COLORS[item.agent] || 'bg-slate-800 text-slate-300 border-slate-700'

            return (
              <div
                key={item.id || idx}
                className={clsx(
                  'p-3 rounded-xl border transition-all flex items-start justify-between gap-3 text-xs',
                  isRunning && 'bg-brand-500/5 border-brand-500/20 shadow-sm shadow-brand-500/5',
                  isCompleted && 'bg-[#121222] border-slate-800/80',
                  isFailed && 'bg-rose-500/5 border-rose-500/20 text-rose-200',
                  isWarning && 'bg-amber-500/5 border-amber-500/20 text-amber-200'
                )}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  {/* Status Indicator Icon */}
                  <div className="mt-0.5 flex-shrink-0">
                    {isCompleted && <CheckCircle2 size={15} className="text-emerald-400" />}
                    {isRunning && (
                      <span className="relative flex h-3.5 w-3.5 mt-0.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500" />
                      </span>
                    )}
                    {isFailed && <XCircle size={15} className="text-rose-400" />}
                    {isWarning && <AlertCircle size={15} className="text-amber-400" />}
                  </div>

                  {/* Activity Details */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold border font-mono', badgeStyle)}>
                        {item.agent || 'Agent'}
                      </span>
                      <span className="font-semibold text-slate-200 truncate max-w-lg">
                        {item.action}
                      </span>
                    </div>

                    {/* Optional Short Finding or Output Result */}
                    {item.finding && (
                      <div className="p-2 rounded-lg bg-[#18182e] border border-slate-800 text-[11px] text-slate-300 leading-relaxed font-normal">
                        <span className="text-brand-400 font-semibold mr-1 font-mono">Finding:</span>
                        {item.finding}
                      </div>
                    )}
                  </div>
                </div>

                {/* Timestamp */}
                <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap flex-shrink-0">
                  {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ''}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
