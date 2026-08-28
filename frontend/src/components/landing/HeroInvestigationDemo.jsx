import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2, AlertTriangle, TrendingDown, ArrowDownRight,
  Search, ShieldCheck, FileText, Database, Sparkles, Layers,
  ChevronRight, Activity, Terminal, ExternalLink
} from 'lucide-react'

const SIMULATED_STEPS = [
  { id: 1, label: 'Understanding objective & scope', agent: 'Supervisor', done: true, time: '0.1s' },
  { id: 2, label: 'Profiling sales_q3.csv (124,892 transactions)', agent: 'Profiler Agent', done: true, time: '0.4s' },
  { id: 3, label: 'Anomaly detected: Q3 Revenue -23.4% ($1.42M vs $1.85M Q2)', agent: 'Analyst Agent', done: true, time: '0.8s' },
  { id: 4, label: 'Segmenting performance by region — West region identified (-41%)', agent: 'Python Executor', done: true, time: '1.2s' },
  { id: 5, label: 'Testing Hypothesis: New Customer Acquisition drop', agent: 'Hypothesis Tester', done: true, active: true, time: '1.8s' },
  { id: 6, label: 'Cross-referencing q3_marketing_report.pdf context via RAG', agent: 'RAG Agent', done: false, time: '2.4s' },
  { id: 7, label: 'Critic Agent verifying correlation vs causation', agent: 'Critic Agent', done: false, time: '2.9s' },
]

export default function HeroInvestigationDemo() {
  const [activeTab, setActiveTab] = useState('stream')
  const [stepProgress, setStepProgress] = useState(5)

  // Cycle demo progression loop
  useEffect(() => {
    const interval = setInterval(() => {
      setStepProgress((prev) => (prev >= 7 ? 3 : prev + 1))
    }, 3200)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative w-full max-w-5xl mx-auto mt-12 rounded-2xl bg-[#0e0e1c] border border-[#222244] shadow-2xl overflow-hidden backdrop-blur-xl">
      {/* Glow background behind card */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header bar */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-[#14142b] border-b border-[#202040]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 mr-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <div className="flex items-center gap-2 bg-[#0b0b16] px-3 py-1 rounded-lg border border-[#1f1f3a] text-xs font-mono text-slate-300">
            <Search size={13} className="text-cyan-400" />
            <span className="text-slate-400">Question:</span>
            <span className="font-semibold text-slate-100">Why did revenue decline in Q3?</span>
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex items-center gap-1 bg-[#090912] p-1 rounded-lg border border-[#1c1c38]">
          {[
            { id: 'stream', label: 'Live Investigation', icon: Activity },
            { id: 'evidence', label: 'Evidence Card', icon: Database },
            { id: 'tree', label: 'Hypothesis Tree', icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-600/90 text-white shadow-md shadow-cyan-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={12} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Container Content */}
      <div className="p-6 min-h-[380px] flex flex-col justify-between">
        {activeTab === 'stream' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Top alert bar */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center">
                  <Sparkles size={16} className="text-cyan-400 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-cyan-300">SUPERVISOR ORCHESTRATOR</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      5 Specialized Agents Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Investigating <span className="font-semibold text-white">sales_q3.csv</span> & <span className="font-semibold text-white">q3_marketing_report.pdf</span>
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Confidence</p>
                <p className="text-sm font-extrabold text-emerald-400 font-mono">91% (HIGH)</p>
              </div>
            </div>

            {/* Stepper Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 bg-[#090914] p-4 rounded-xl border border-[#1b1b36]">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Terminal size={12} className="text-cyan-400" />
                  Agent Execution Log
                </p>

                {SIMULATED_STEPS.map((step) => {
                  const isDone = step.id <= stepProgress
                  const isActive = step.id === stepProgress
                  return (
                    <div
                      key={step.id}
                      className={`flex items-start gap-2.5 p-2 rounded-lg text-xs transition-all ${
                        isActive
                          ? 'bg-cyan-600/15 border border-cyan-500/40 text-slate-100'
                          : isDone
                          ? 'text-slate-300'
                          : 'text-slate-500 opacity-60'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                      ) : isActive ? (
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin flex-shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-slate-600 flex-shrink-0 mt-0.5" />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[11px] text-cyan-300">{step.agent}</span>
                          <span className="text-[10px] font-mono text-slate-500">{step.time}</span>
                        </div>
                        <p className="truncate text-slate-200 mt-0.5">{step.label}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Live Findings Highlight */}
              <div className="space-y-3 flex flex-col justify-between">
                <div className="bg-[#090914] p-4 rounded-xl border border-[#1b1b36] space-y-3">
                  <div className="flex items-center justify-between border-b border-[#1c1c38] pb-2">
                    <span className="text-xs font-semibold text-slate-300">KEY ANOMALY DETECTED</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">
                      -23.4% Revenue Drop
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-[#14142b] border border-[#222244]">
                      <p className="text-[10px] text-slate-400">Q2 Revenue</p>
                      <p className="text-sm font-bold text-slate-200 font-mono mt-0.5">$1.85M</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#14142b] border border-[#222244]">
                      <p className="text-[10px] text-slate-400">Q3 Revenue</p>
                      <p className="text-sm font-bold text-red-400 font-mono mt-0.5">$1.42M</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-xs space-y-1">
                    <p className="font-semibold text-cyan-300 flex items-center gap-1">
                      <Layers size={13} />
                      Root Cause Finding:
                    </p>
                    <p className="text-slate-300 leading-relaxed text-[11px]">
                      West region customer acquisition dropped <span className="text-amber-400 font-semibold">-42.8%</span> following a 35% cut in regional marketing spend during August.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#090914] border border-[#1b1b36] flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                    <ShieldCheck size={14} className="text-emerald-400" />
                    Verified by Critic Agent
                  </span>
                  <span className="text-[11px] text-cyan-400 font-mono">0 Unsupported Claims</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'evidence' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-[#090914] border border-[#1d1d3a] space-y-1">
                <p className="text-[10px] text-slate-400 font-mono">PRIMARY FACT</p>
                <p className="text-sm font-bold text-slate-100">Revenue Change</p>
                <p className="text-xl font-mono font-extrabold text-red-400">-23.4%</p>
                <p className="text-[11px] text-slate-500">Source: sales_q3.csv (Row 1 to 124,892)</p>
              </div>

              <div className="p-4 rounded-xl bg-[#090914] border border-[#1d1d3a] space-y-1">
                <p className="text-[10px] text-slate-400 font-mono">AFFECTED METRIC</p>
                <p className="text-sm font-bold text-slate-100">New Customers</p>
                <p className="text-xl font-mono font-extrabold text-amber-400">12.4k → 7.1k</p>
                <p className="text-[11px] text-slate-500">Source: customers_q3.csv (-42.8%)</p>
              </div>

              <div className="p-4 rounded-xl bg-[#090914] border border-[#1d1d3a] space-y-1">
                <p className="text-[10px] text-slate-400 font-mono">CONTEXTUAL EVIDENCE</p>
                <p className="text-sm font-bold text-slate-100">Marketing Strategy</p>
                <p className="text-xs text-cyan-300 font-medium font-sans">Budget reduced in August</p>
                <p className="text-[11px] text-slate-500">Source: q3_report.pdf (Page 14)</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#090914] border border-[#1d1d3a] space-y-2">
              <p className="text-xs font-semibold text-slate-200">Evidence Lineage Citation</p>
              <div className="text-xs text-slate-300 font-mono bg-[#121226] p-3 rounded-lg border border-[#202042] space-y-1">
                <p><span className="text-cyan-400">[1] sales_q3.csv</span>: `SELECT SUM(revenue), region FROM sales GROUP BY quarter, region`</p>
                <p><span className="text-cyan-400">[2] q3_marketing_report.pdf</span>: &quot;West territory digital campaigns paused on Aug 15th due to re-allocation.&quot;</p>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'tree' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-[#090914] border border-[#1d1d3a] space-y-4"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 border-b border-[#1c1c38] pb-2">
              <span>Hypothesis Investigation Graph</span>
              <span className="text-[11px] text-cyan-400 font-mono">3 Hypotheses Evaluated</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <span className="font-bold text-emerald-400 font-mono mr-2">H1: SUPPORTED (91%)</span>
                  <span className="text-slate-200">New customer acquisition dropped in West Region</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Verified</span>
              </div>

              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-between">
                <div>
                  <span className="font-bold text-red-400 font-mono mr-2">H2: REJECTED</span>
                  <span className="text-slate-200">Average Order Value (AOV) declined</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-300">No Change (+$2.10)</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-400 font-mono mr-2">H3: INCONCLUSIVE</span>
                  <span className="text-slate-300">Product availability / supply chain delays</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700/50 text-slate-400">Insufficient Data</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Footer bar */}
      <div className="px-5 py-3 bg-[#0a0a14] border-t border-[#1e1e3b] flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Real-time Multi-Agent Trace</span>
        </div>
        <span className="font-mono text-cyan-400 hover:text-cyan-300 cursor-pointer flex items-center gap-1">
          Explore Live Execution Demo →
        </span>
      </div>
    </div>
  )
}
