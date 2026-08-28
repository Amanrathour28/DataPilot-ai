import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingDown, ArrowRight, ShieldCheck, Check, Sparkles, HelpCircle,
  AlertTriangle, RefreshCw
} from 'lucide-react'

const CORRELATION_STEPS = [
  {
    id: 'observed',
    label: '1. Observed Metrics',
    title: 'Observed Association',
    desc: 'Standard BI dashboards highlight that Marketing Spend and Revenue both dropped during Q3, implying a simple connection.'
  },
  {
    id: 'investigating',
    label: '2. Deep Investigation',
    title: 'Rigorous Multi-Agent Check',
    desc: 'DataPilot examines potential confounding variables (seasonality, competitor activity, pricing shifts) to isolate cause.'
  },
  {
    id: 'conclusion',
    label: '3. Plausible Causal Verdict',
    title: 'Evidence-Backed Conclusion',
    desc: 'Confirms marketing budget reduction is strongly associated with the customer acquisition drop. Causation is plausible but not strictly mathematically proven.'
  }
]

export default function CorrelationSection() {
  const [activeStep, setActiveStep] = useState('observed')
  const [autoRotate, setAutoRotate] = useState(true)

  // Rotate between steps automatically unless user clicks
  useEffect(() => {
    if (!autoRotate) return
    const sequence = ['observed', 'investigating', 'conclusion']
    const interval = setInterval(() => {
      setActiveStep((prev) => {
        const nextIdx = (sequence.indexOf(prev) + 1) % sequence.length
        return sequence[nextIdx]
      })
    }, 4500)
    return () => clearInterval(interval)
  }, [autoRotate])

  const selectStep = (stepId) => {
    setActiveStep(stepId)
    setAutoRotate(false)
  }

  return (
    <section className="py-24 bg-[#0a0a14] relative overflow-hidden border-t border-[#181830]">
      {/* Subtle background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-cyan-500/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 uppercase tracking-wider">
            ANALYTICAL RIGOR
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-100 mt-4 tracking-tight">
            Correlation is not a root cause.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-400">
            A linear decline in two metrics does not prove one caused the other. DataPilot tests for confounding factors, seasonal priors, and sample size bias before making causal claims.
          </p>
        </div>

        {/* Step controls */}
        <div className="flex justify-center gap-2 sm:gap-4 mb-10 max-w-xl mx-auto bg-[#0e0e1c] p-1.5 rounded-xl border border-[#1e1e3b]">
          {CORRELATION_STEPS.map((step) => {
            const isActive = activeStep === step.id
            return (
              <button
                key={step.id}
                onClick={() => selectStep(step.id)}
                className={`flex-1 text-center py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#15152a]'
                }`}
              >
                {step.label}
              </button>
            )
          })}
        </div>

        {/* Interactive Comparison Board */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-5xl mx-auto">
          {/* Left panel: Interactive visual simulation */}
          <div className="lg:col-span-7 bg-[#0e0e1c] border border-[#202042] rounded-2xl p-6 min-h-[340px] flex flex-col justify-between shadow-2xl relative">
            <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] text-slate-500 font-mono">
              <RefreshCw size={10} className={`text-cyan-400 ${autoRotate ? 'animate-spin' : ''}`} />
              <span>{autoRotate ? 'Auto-cycling' : 'Interactive Mode'}</span>
            </div>

            <AnimatePresence mode="wait">
              {activeStep === 'observed' && (
                <motion.div
                  key="observed"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6 my-auto"
                >
                  <p className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">STEP 1: OBSERVED METRIC CORRELATION</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-400">Marketing Spend</p>
                        <p className="text-lg font-bold font-mono text-red-400 mt-0.5">-35.0%</p>
                      </div>
                      <TrendingDown className="text-red-400" size={24} />
                    </div>

                    <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-400">Total Revenue</p>
                        <p className="text-lg font-bold font-mono text-red-400 mt-0.5">-23.4%</p>
                      </div>
                      <TrendingDown className="text-red-400" size={24} />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#14142b] border border-[#202042] text-xs text-slate-300 flex items-center gap-2.5">
                    <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
                    <span>
                      <strong>BI Platform Verdict:</strong> Strong positive correlation detected (R = 0.91). Traditional dashboards suggest marketing cuts caused the drop.
                    </span>
                  </div>
                </motion.div>
              )}

              {activeStep === 'investigating' && (
                <motion.div
                  key="investigating"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 my-auto"
                >
                  <p className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">STEP 2: DATAPILOT INVESTIGATION TRACE</p>
                  
                  <div className="space-y-2">
                    {[
                      { query: 'Is this Coincidence?', result: 'Unlikely. Time-lag alignment matches spend reduction date within 3 days.', passed: true },
                      { query: 'Is this seasonality?', result: 'Controlled. Checked against 3-year historical August cycles. Segment variance is outlier.', passed: true },
                      { query: 'Are there confounding factors?', result: 'Identified. West region accounts for 78% of drop. Other regions stable.', passed: true },
                      { query: 'Is there a plausible causal chain?', result: 'Verified. Budget cuts stopped digital ads → West region signups dropped 42.8% → Revenue declined.', passed: true }
                    ].map((item, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-[#090916] border border-[#1b1b36] flex items-start gap-2.5 text-xs">
                        <Check size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-slate-200">{item.query}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{item.result}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeStep === 'conclusion' && (
                <motion.div
                  key="conclusion"
                  initial={{ opacity: 0, scale: 1.02 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 my-auto"
                >
                  <p className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">STEP 3: INVESTIGATION VERDICT</p>

                  <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/40 space-y-3">
                    <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
                      <span className="text-xs font-bold text-slate-200">CAUSAL RELATIONSHIP</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Causal Link Supported
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      Marketing budget reduction is strongly associated with reduced customer acquisition. Causation cannot be proven mathematically, but the temporal evidence chain is consistent.
                    </p>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="bg-[#090915] p-2.5 rounded-lg border border-[#1d1d3c]">
                        <p className="text-[10px] text-slate-500">Causation Verdict</p>
                        <p className="text-xs font-bold text-slate-300 mt-0.5">Contributing Factor</p>
                      </div>
                      <div className="bg-[#090915] p-2.5 rounded-lg border border-[#1d1d3c]">
                        <p className="text-[10px] text-slate-500">Confidence Score</p>
                        <p className="text-xs font-bold text-emerald-400 font-mono mt-0.5">87%</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right panel: Static explanatory copy */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 text-cyan-400">
                <Sparkles size={16} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-200">How DataPilot Investigates Causality</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  DataPilot runs randomized simulations, filters out global trend noise, and isolates segment control groups to confirm whether a statistical correlation is backed by structural realities.
                </p>
              </div>
            </div>

            {CORRELATION_STEPS.map((step) => {
              const isActive = activeStep === step.id
              return (
                <div
                  key={step.id}
                  onClick={() => selectStep(step.id)}
                  className={`p-4 rounded-xl cursor-pointer border transition-all ${
                    isActive
                      ? 'bg-[#121226] border-cyan-500 shadow-md shadow-cyan-600/10'
                      : 'bg-transparent border-[#1f1f3a] hover:border-[#2b2b52]'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-200">{step.title}</p>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{step.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
