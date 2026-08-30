import { useEffect, useRef } from 'react'
import {
  CheckCircle2, AlertCircle, XCircle, Clock,
  ArrowRight, Activity, Wifi, WifiOff, ShieldAlert
} from 'lucide-react'
import { clsx } from 'clsx'

const AGENT_COLORS = {
  'Supervisor Agent': 'text-purple-400',
  'Planning Agent': 'text-sky-400',
  'Data Analyst': 'text-cyan-400',
  'Hypothesis Agent': 'text-amber-400',
  'Hypothesis Tester': 'text-[#d4ff58]',
  'RAG Search Agent': 'text-sky-400',
  'Critic Agent': 'text-[#ff4e4e]',
  'Report Agent': 'text-yellow-400',
  'System': 'text-[#f2f2ef]/60'
}

export default function AgentReasoningPanel({
  activities = [],
  status = 'PENDING',
  stage = 'PLANNING',
  connectionStatus = 'connected'
}) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [activities.length])

  const isRunning = ['PENDING', 'RUNNING', 'PLANNING', 'ANALYZING', 'TESTING', 'RETRIEVING', 'VERIFYING', 'REPORTING', 'REINVESTIGATING'].includes(status)

  return (
    <div className="border border-white/[0.08] bg-[#0c0c0c] p-6 space-y-4 font-mono text-xs">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#d4ff58] animate-pulse" />
          <h3 className="font-display font-bold text-sm uppercase tracking-tight text-[#f2f2ef]">
            Live Agent Reasoning Feed
          </h3>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[#f2f2ef]/40">
          <span>SSE Stream: {connectionStatus}</span>
          <span>&middot;</span>
          <span>{activities.length} entries</span>
        </div>
      </div>

      {/* Activity Log List */}
      <div
        ref={containerRef}
        className="max-h-72 overflow-y-auto space-y-2 pr-2 divide-y divide-white/[0.04]"
      >
        {activities.length === 0 ? (
          <p className="text-[#f2f2ef]/30 py-6 text-center text-[11px]">
            Awaiting agent task dispatches…
          </p>
        ) : (
          activities.map((act, idx) => (
            <div key={act.id || idx} className="pt-2 flex items-start gap-3">
              <span className="text-[10px] text-[#f2f2ef]/30 pt-0.5">
                {(idx + 1).toString().padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className={clsx('font-bold uppercase text-[10px]', AGENT_COLORS[act.agent_name] || 'text-[#d4ff58]')}>
                    {act.agent_name || 'Agent'}
                  </span>
                  {act.action && (
                    <span className="text-[10px] text-[#f2f2ef]/40">
                      [{act.action}]
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#f2f2ef]/80 leading-relaxed">
                  {act.thought || act.summary || act.message || JSON.stringify(act)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  )
}
