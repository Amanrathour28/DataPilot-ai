import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUpRight, Terminal, CheckCircle2, ShieldCheck, Database, Layers } from 'lucide-react'

const PIPELINE_STEPS = [
  { id: '01', agent: 'Supervisor',  action: 'Objective formulation',   time: '0.1s', status: 'done' },
  { id: '02', agent: 'Profiler',    action: 'Schema profiling',        time: '0.4s', status: 'done' },
  { id: '03', agent: 'Analyst',     action: 'Anomaly isolation: Q3',   time: '0.8s', status: 'done' },
  { id: '04', agent: 'Python Env',  action: 'Regional breakdown',      time: '1.3s', status: 'done' },
  { id: '05', agent: 'Hypothesis',  action: 'H1: Acquisition testing', time: '1.9s', status: 'done' },
  { id: '06', agent: 'RAG Agent',   action: 'Marketing PDF citation',  time: '2.5s', status: 'done' },
  { id: '07', agent: 'Critic',      action: 'Causal verification',     time: '3.1s', status: 'active' },
]

export default function HeroInvestigationDemo() {
  const [activeTab, setActiveTab] = useState('summary')
  const [stepIdx, setStepIdx] = useState(6)

  useEffect(() => {
    const id = setInterval(() => {
      setStepIdx((prev) => (prev >= 6 ? 2 : prev + 1))
    }, 3200)
    return () => clearInterval(id)
  }, [])

  return (
    <section id="investigation-showcase" className="py-24 md:py-36 border-b border-white/[0.08] bg-[#090909]">
      <div className="dn-container">

        {/* Section Marker */}
        <div className="editorial-label">
          <span className="num">(02)</span>
          <span>The Investigation Experience</span>
        </div>

        {/* Section Heading */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 md:mb-16">
          <div>
            <span className="font-mono text-xs text-[#d4ff58] uppercase tracking-widest block mb-2">
              Case Study 01 / 06
            </span>
            <h2 className="font-display font-extrabold text-3xl sm:text-5xl md:text-6xl uppercase tracking-tight text-[#f2f2ef] leading-[1.02]">
              Why Did Revenue Decline in Q3<span className="text-[#d4ff58]">?</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {['summary', 'trace', 'evidence'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`btn-dn-sm border ${
                  activeTab === tab
                    ? 'border-[#d4ff58] bg-[#d4ff58] text-black'
                    : 'border-white/[0.1] text-[#f2f2ef]/50 hover:text-[#f2f2ef]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Large Case Study Canvas (Selected Work Style) */}
        <div className="border border-white/[0.1] bg-[#0c0c0c] overflow-hidden">

          {/* Top Metadata Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-white/[0.08] font-mono text-[11px]">
            <div className="p-4 sm:p-6 border-r border-white/[0.08]">
              <span className="text-[#f2f2ef]/40 uppercase tracking-widest block mb-1">Dataset Input</span>
              <span className="text-[#f2f2ef] font-semibold">sales_q3.csv (124.8k rows)</span>
            </div>
            <div className="p-4 sm:p-6 border-r border-white/[0.08]">
              <span className="text-[#f2f2ef]/40 uppercase tracking-widest block mb-1">Document Context</span>
              <span className="text-[#f2f2ef] font-semibold">q3_marketing_report.pdf</span>
            </div>
            <div className="p-4 sm:p-6 border-r border-white/[0.08]">
              <span className="text-[#f2f2ef]/40 uppercase tracking-widest block mb-1">Execution Mode</span>
              <span className="text-[#d4ff58] font-semibold">7 Agents Autonomous</span>
            </div>
            <div className="p-4 sm:p-6">
              <span className="text-[#f2f2ef]/40 uppercase tracking-widest block mb-1">Analytical Confidence</span>
              <span className="text-[#d4ff58] font-bold text-sm">91% High Rigor</span>
            </div>
          </div>

          {/* Main Visual Display */}
          <div className="p-6 sm:p-10 md:p-14">
            <AnimatePresence mode="wait">
              {activeTab === 'summary' && (
                <motion.div
                  key="summary"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-12"
                >
                  {/* Large Metrics Hero */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start border-b border-white/[0.08] pb-12">
                    <div className="md:col-span-4">
                      <span className="font-mono text-xs uppercase tracking-widest text-[#ff4e4e] block mb-2">
                        Observed Metric Anomaly
                      </span>
                      <div className="font-display font-extrabold text-5xl sm:text-7xl text-[#ff4e4e] tracking-tight">
                        -23.4%
                      </div>
                      <p className="font-mono text-xs text-[#f2f2ef]/50 mt-2">
                        Quarterly Revenue Delta ($1.85M → $1.42M)
                      </p>
                    </div>

                    <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="border-l-2 border-[#d4ff58] pl-6 space-y-2">
                        <span className="font-mono text-xs uppercase tracking-widest text-[#d4ff58]">
                          Primary Root Cause Driver
                        </span>
                        <h4 className="font-display font-bold text-xl sm:text-2xl uppercase text-[#f2f2ef]">
                          West Region Acquisition Drop (-42.8%)
                        </h4>
                        <p className="text-sm text-[#f2f2ef]/60 leading-relaxed font-sans">
                          Signups dropped from 12,421 in Q2 to 7,103 in Q3. This single regional cohort accounts for 78% of total variance.
                        </p>
                      </div>

                      <div className="border-l-2 border-white/[0.2] pl-6 space-y-2">
                        <span className="font-mono text-xs uppercase tracking-widest text-[#f2f2ef]/50">
                          Qualitative Document Ground-Truth
                        </span>
                        <h4 className="font-display font-bold text-xl sm:text-2xl uppercase text-[#f2f2ef]">
                          Regional Budget Cut (-35%)
                        </h4>
                        <p className="text-sm text-[#f2f2ef]/60 leading-relaxed font-sans">
                          <span className="font-mono text-xs text-[#d4ff58]">q3_marketing_report.pdf (p.14)</span> confirms West digital campaigns paused Aug 15th.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Causal Verification Lineage */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                    <div className="border border-white/[0.08] p-6 bg-[#080808]">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-[#d4ff58] block mb-2">
                        Hypothesis H1 · Tested
                      </span>
                      <h5 className="font-display font-bold text-lg uppercase text-[#f2f2ef] mb-1">
                        New Customer Acquisition
                      </h5>
                      <p className="text-xs text-[#f2f2ef]/60 leading-relaxed font-sans mb-4">
                        Supported by raw transaction timestamps and customer registration logs.
                      </p>
                      <span className="font-mono text-xs font-bold text-[#d4ff58] uppercase">
                        Verdict: Supported (91%)
                      </span>
                    </div>

                    <div className="border border-white/[0.08] p-6 bg-[#080808]">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-[#ff4e4e] block mb-2">
                        Hypothesis H2 · Rejected
                      </span>
                      <h5 className="font-display font-bold text-lg uppercase text-[#f2f2ef] mb-1">
                        Average Order Value (AOV)
                      </h5>
                      <p className="text-xs text-[#f2f2ef]/60 leading-relaxed font-sans mb-4">
                        Falsified: Basket size remained stable ($148.50 → $150.60, +1.4%).
                      </p>
                      <span className="font-mono text-xs font-bold text-[#ff4e4e] uppercase">
                        Verdict: Rejected (98%)
                      </span>
                    </div>

                    <div className="border border-white/[0.08] p-6 bg-[#080808]">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-[#f2f2ef]/40 block mb-2">
                        Critic Audit Boundary
                      </span>
                      <h5 className="font-display font-bold text-lg uppercase text-[#f2f2ef] mb-1">
                        Uncertainty Evaluation
                      </h5>
                      <p className="text-xs text-[#f2f2ef]/60 leading-relaxed font-sans mb-4">
                        Sales team vacancy (3 open roles) represents a potential 12% contributing factor.
                      </p>
                      <span className="font-mono text-xs font-bold text-[#f2f2ef]/70 uppercase">
                        Audit: Causal Link Established
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'trace' && (
                <motion.div
                  key="trace"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4 font-mono text-xs"
                >
                  <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                    <span className="text-[#d4ff58] uppercase tracking-widest">
                      Live Multi-Agent Execution Log
                    </span>
                    <span className="text-[#f2f2ef]/40">7 of 7 tasks verified</span>
                  </div>

                  <div className="divide-y divide-white/[0.06]">
                    {PIPELINE_STEPS.map((step, idx) => {
                      const isPast = idx < stepIdx
                      const isCurrent = idx === stepIdx
                      return (
                        <div
                          key={step.id}
                          className={`py-3.5 flex items-center justify-between gap-4 transition-colors ${
                            isCurrent
                              ? 'text-[#d4ff58] bg-[#d4ff58]/5 px-3'
                              : isPast
                              ? 'text-[#f2f2ef]/80'
                              : 'text-[#f2f2ef]/25'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <span className="text-[#f2f2ef]/30 font-bold">{step.id}</span>
                            <span className="font-bold uppercase w-28">{step.agent}</span>
                            <span className="font-sans">{step.action}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-[#f2f2ef]/40">{step.time}</span>
                            {isPast && <CheckCircle2 size={14} className="text-[#d4ff58]" />}
                            {isCurrent && <span className="w-2 h-2 rounded-full bg-[#d4ff58] animate-ping" />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              )}

              {activeTab === 'evidence' && (
                <motion.div
                  key="evidence"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6 font-mono text-xs"
                >
                  <div className="border-b border-white/[0.08] pb-4 flex items-center justify-between">
                    <span className="text-[#f2f2ef] uppercase tracking-widest font-bold">
                      Source Lineage & Evidence Ledger
                    </span>
                    <span className="text-[#d4ff58]">3 Citations Verified</span>
                  </div>

                  <div className="space-y-4">
                    <div className="border border-white/[0.08] p-5 bg-[#080808] space-y-2">
                      <div className="flex items-center justify-between text-[#d4ff58]">
                        <span>[Fact 01] sales_q3.csv</span>
                        <span className="text-[10px] text-[#f2f2ef]/40">124,892 rows</span>
                      </div>
                      <p className="font-mono text-[#f2f2ef]/80">
                        SELECT region, SUM(revenue) FROM sales GROUP BY region ORDER BY SUM(revenue) ASC;
                      </p>
                      <p className="text-[11px] text-[#f2f2ef]/50 font-sans">
                        Result: West region revenue $412,000 (Q3) vs $698,000 (Q2).
                      </p>
                    </div>

                    <div className="border border-white/[0.08] p-5 bg-[#080808] space-y-2">
                      <div className="flex items-center justify-between text-[#d4ff58]">
                        <span>[Context 02] q3_marketing_report.pdf</span>
                        <span className="text-[10px] text-[#f2f2ef]/40">Vector Chunk #12, Page 14</span>
                      </div>
                      <p className="font-sans text-[#f2f2ef]/90 italic border-l border-[#d4ff58] pl-3 py-1">
                        &ldquo;Paid search and top-of-funnel acquisition budgets in the Western sales territory were temporarily reduced by 35% starting August 15th to reallocate capital.&rdquo;
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom Action Footer */}
          <div className="border-t border-white/[0.08] p-6 bg-[#080808] flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="font-mono text-xs text-[#f2f2ef]/50">
              Interactive demonstration powered by DataPilot Multi-Agent Architecture.
            </span>
            <button className="text-xs font-mono font-bold text-[#d4ff58] uppercase tracking-widest flex items-center gap-1.5 hover:underline cursor-pointer">
              <span>Inspect Full Investigation Artifact</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

        </div>

      </div>
    </section>
  )
}
