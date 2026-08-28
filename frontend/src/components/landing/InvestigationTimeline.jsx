import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play, RotateCcw, Clock, CheckCircle2, Search, Terminal,
  GitBranch, ShieldCheck, ChevronRight, Activity
} from 'lucide-react'

const TIMELINE_EVENTS = [
  { timeOffset: '0.0s', timeText: '10:32:04', desc: 'Dataset profiling completed', detail: 'Identified schema in sales_q3.csv (124k rows) and customer_signups.json.', icon: Search, color: 'text-sky-400 bg-sky-500/10' },
  { timeOffset: '3.1s', timeText: '10:32:07', desc: 'Revenue anomaly detected', detail: 'Isolated outlier drop of -23.4% in overall Q3 revenue.', icon: Activity, color: 'text-red-400 bg-red-500/10' },
  { timeOffset: '6.4s', timeText: '10:32:10', desc: 'Regional analysis started', detail: 'Python Agent executing geographic metric slice in sandboxed environment.', icon: Terminal, color: 'text-emerald-400 bg-emerald-500/10' },
  { timeOffset: '9.8s', timeText: '10:32:14', desc: 'West region identified', detail: 'West region identified as source of 78% of the sales decrease.', icon: Search, color: 'text-cyan-400 bg-cyan-500/10' },
  { timeOffset: '13.2s', timeText: '10:32:18', desc: '4 hypotheses generated', detail: 'Formulated explanations including churn, acquisition drop, and AOV shift.', icon: GitBranch, color: 'text-amber-400 bg-amber-500/10' },
  { timeOffset: '16.5s', timeText: '10:32:22', desc: 'Testing customer acquisition hypothesis', detail: 'Calculated signup velocity Q2 vs Q3. Observed a 42.8% drop.', icon: Terminal, color: 'text-emerald-400 bg-emerald-500/10' },
  { timeOffset: '20.2s', timeText: '10:32:28', desc: 'Supporting evidence discovered', detail: 'RAG Agent matched August marketing pause details in q3_marketing_report.pdf.', icon: Search, color: 'text-purple-400 bg-purple-500/10' },
  { timeOffset: '24.0s', timeText: '10:32:34', desc: 'Critic verification started', detail: 'Reviewing claim linkage for correlation vs causation integrity.', icon: ShieldCheck, color: 'text-rose-400 bg-rose-500/10' },
]

export default function InvestigationTimeline() {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)

  // Autoplay progression simulation
  useEffect(() => {
    if (!isPlaying) return

    const timer = setTimeout(() => {
      if (currentIdx < TIMELINE_EVENTS.length - 1) {
        setCurrentIdx(currentIdx + 1)
      } else {
        // Pause or loop back
        setIsPlaying(false)
      }
    }, 2800)

    return () => clearTimeout(timer)
  }, [currentIdx, isPlaying])

  const restartSimulation = () => {
    setCurrentIdx(0)
    setIsPlaying(true)
  }

  return (
    <section className="py-24 bg-[#080812] relative overflow-hidden border-t border-[#181830]">
      {/* Background graphic nodes */}
      <div className="absolute right-0 top-1/4 w-[500px] h-[500px] bg-cyan-600/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mb-16">
          <div className="lg:col-span-6">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 uppercase tracking-wider">
              REAL-TIME EXECUTION TRACE
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-100 mt-4 tracking-tight">
              Watch the investigation unfold.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-400 leading-relaxed">
              Every query, sandbox calculation, and RAG document lookup is recorded in a transparent, real-time audit log. Watch how specialized agents work in parallel.
            </p>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={restartSimulation}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#121226] hover:bg-[#1a1a36] text-slate-200 border border-[#202042] transition-colors"
              >
                <RotateCcw size={14} />
                Replay Trace
              </button>
              {!isPlaying && currentIdx === TIMELINE_EVENTS.length - 1 && (
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  Trace completed in 24.0 seconds
                </span>
              )}
              {isPlaying && (
                <span className="text-xs text-cyan-400 font-medium flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  Agents executing...
                </span>
              )}
            </div>
          </div>

          {/* Right Panel: Simulated Live Console */}
          <div className="lg:col-span-6 bg-[#0e0e1c] border border-[#202040] rounded-2xl overflow-hidden shadow-2xl">
            {/* Header bar */}
            <div className="px-5 py-3.5 bg-[#14142b] border-b border-[#202042] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/75" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/75" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/75" />
                </div>
                <span className="text-xs font-mono text-slate-400 ml-1">datapilot-trace-session</span>
              </div>
              <span className="text-[10px] font-mono bg-[#090914] px-2 py-0.5 rounded text-cyan-400 border border-[#1d1d36]">
                ACTIVE AGENT: {TIMELINE_EVENTS[currentIdx]?.desc.split(' ').slice(-1)[0]}
              </span>
            </div>

            {/* Event Log Body */}
            <div className="p-5 space-y-4 max-h-[380px] overflow-y-auto">
              <AnimatePresence>
                {TIMELINE_EVENTS.map((event, idx) => {
                  const isVisible = idx <= currentIdx
                  const isActive = idx === currentIdx
                  const Icon = event.icon

                  if (!isVisible) return null

                  return (
                    <motion.div
                      key={event.timeOffset}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex gap-4 items-start ${isActive ? 'p-2 rounded-xl bg-cyan-600/10 border border-cyan-500/30' : ''}`}
                    >
                      {/* Timestamp */}
                      <span className="font-mono text-xs text-slate-500 mt-1 flex-shrink-0 w-14">
                        {event.timeText}
                      </span>

                      {/* Icon */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border border-[#202040] ${event.color}`}>
                        <Icon size={14} />
                      </div>

                      {/* Message details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-200 leading-tight">
                            {event.desc}
                          </p>
                          <span className="text-[9px] font-mono text-slate-500 uppercase flex-shrink-0">
                            +{event.timeOffset}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                          {event.detail}
                        </p>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>

            {/* Footer console status */}
            <div className="px-5 py-3 bg-[#0a0a14] border-t border-[#1a1a36] flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'}`} />
                <span>Status: {isPlaying ? 'Streaming Trace' : 'Idle'}</span>
              </div>
              <span>Timeline Speed: 1.0x</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
