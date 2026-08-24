import { motion } from 'framer-motion'
import { XCircle, CheckCircle2, ArrowRight, AlertTriangle, Layers, Zap, Clock, ShieldCheck } from 'lucide-react'

export default function ProblemComparison() {
  return (
    <section className="py-24 bg-[#0a0a14] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 uppercase tracking-wider">
            THE PARADIGM SHIFT
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-100 mt-4 tracking-tight">
            Dashboards show what happened.{' '}
            <span className="text-slate-400">Finding out why is still manual.</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-400">
            Traditional BI gives you charts and alerts, leaving human analysts to dig through multiple tools, run queries, and guess root causes. DataPilot automates the entire investigation pipeline.
          </p>
        </div>

        {/* Side-by-side comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Traditional Manual Workflow */}
          <motion.div
            whileHover={{ y: -4 }}
            className="p-8 rounded-2xl bg-[#0e0e1a] border border-red-500/20 shadow-xl relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <XCircle size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Traditional BI & Analysis Workflow</h3>
                <p className="text-xs text-slate-400">Fragmented, slow & prone to speculation</p>
              </div>
            </div>

            <div className="space-y-4">
              {[
                { step: '01', title: 'Dashboard Anomaly Alert', desc: 'Metric drops on chart. No explanation provided.' },
                { step: '02', title: 'Manual SQL & Data Exports', desc: 'Analyst pulls CSVs across regional DBs manually.' },
                { step: '03', title: 'Spreadsheet Pivot Tables', desc: 'Slicing metrics in Excel hoping to notice a pattern.' },
                { step: '04', title: 'Searching Slack & PDFs', desc: 'Digging through strategy docs and email chains for context.' },
                { step: '05', title: 'Uncertain Executive Summary', desc: 'Hypothesis presented without verified evidence or confidence score.' },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3 p-3.5 rounded-xl bg-[#141424] border border-[#202038]">
                  <span className="text-xs font-mono font-bold text-slate-500 px-2 py-0.5 rounded bg-[#1c1c34]">
                    {item.step}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">{item.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-[#1e1e35] flex items-center justify-between text-xs text-red-400">
              <span className="flex items-center gap-1.5 font-medium">
                <Clock size={14} /> Average investigation time: 3–5 Days
              </span>
              <span className="font-mono">Manual / Low Trust</span>
            </div>
          </motion.div>

          {/* DataPilot Autonomous Workflow */}
          <motion.div
            whileHover={{ y: -4 }}
            className="p-8 rounded-2xl bg-gradient-to-b from-[#121228] to-[#0e0e1c] border border-indigo-500/40 shadow-2xl shadow-indigo-600/10 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/25 border border-indigo-500/40 flex items-center justify-center">
                <CheckCircle2 size={20} className="text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">DataPilot Autonomous Investigation</h3>
                <p className="text-xs text-indigo-300 font-medium">Autonomous multi-agent orchestration</p>
              </div>
            </div>

            <div className="space-y-4">
              {[
                { step: '01', title: 'Ask Business Question', desc: '"Why did revenue decline in Q3?"' },
                { step: '02', title: 'Autonomous Multi-Agent Plan', desc: 'Planner & Profiler map schema & target metrics.' },
                { step: '03', title: 'Python Analysis & Hypothesis Testing', desc: 'Data Analyst & Python agent run sandboxed queries.' },
                { step: '04', title: 'RAG Context Cross-Referencing', desc: 'RAG agent searches strategy docs & connects context.' },
                { step: '05', title: 'Verified Root Cause Report', desc: 'Critic Agent verifies claims; output delivered with confidence score.' },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3 p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/30">
                  <span className="text-xs font-mono font-bold text-indigo-400 px-2 py-0.5 rounded bg-indigo-900/40 border border-indigo-500/30">
                    {item.step}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-100">{item.title}</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-indigo-500/30 flex items-center justify-between text-xs text-emerald-400">
              <span className="flex items-center gap-1.5 font-medium">
                <Zap size={14} className="text-emerald-400" /> Average investigation time: ~30 Seconds
              </span>
              <span className="font-mono font-semibold">Autonomous / High Confidence</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
