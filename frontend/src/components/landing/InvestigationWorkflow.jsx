import { useState } from 'react'
import { motion } from 'framer-motion'
import { Brain, FileCode, Search, GitBranch, ShieldCheck, FileCheck, ArrowRight } from 'lucide-react'

const PIPELINE_STEPS = [
  {
    step: '01',
    title: 'UNDERSTAND',
    icon: Brain,
    summary: 'DataPilot interprets the business question and examines available workspace datasets and documents.',
    detail: 'Parses objective, identifies target key metrics (e.g. revenue, churn, CAC), and verifies dataset schema readiness.',
  },
  {
    step: '02',
    title: 'PLAN',
    icon: FileCode,
    summary: 'The Planning Agent creates a structured investigation roadmap and determines target analyses.',
    detail: 'Generates JSON execution plan detailing data slicing, period comparisons, and hypothesis candidates.',
  },
  {
    step: '03',
    title: 'INVESTIGATE',
    icon: Search,
    summary: 'Specialized agents execute sandboxed Python/DuckDB code to slice data and detect anomalies.',
    detail: 'Compares quarter-over-quarter metrics, isolates outliers, ranks segment contributions (e.g. region, customer cohort).',
  },
  {
    step: '04',
    title: 'HYPOTHESIZE',
    icon: GitBranch,
    summary: 'DataPilot generates plausible candidate explanations for observed data anomalies.',
    detail: 'Formulates candidate hypotheses (H1, H2, H3) with required evidence criteria and initial status assignments.',
  },
  {
    step: '05',
    title: 'VERIFY',
    icon: ShieldCheck,
    summary: 'Hypotheses are rigorously tested against structured metrics and RAG document context.',
    detail: 'Evaluates statistical significance, queries uploaded PDFs/docs for strategy context, and marks hypotheses Supported or Rejected.',
  },
  {
    step: '06',
    title: 'EXPLAIN',
    icon: FileCheck,
    summary: 'The Critic Agent audits conclusions and produces an evidence-backed root cause report.',
    detail: 'Distinguishes correlation from causation, highlights remaining uncertainties, and provides actionable recommendations.',
  },
]

export default function InvestigationWorkflow() {
  const [activeStep, setActiveStep] = useState(2) // 0-indexed

  return (
    <section id="workflow" className="py-24 bg-[#080812] relative overflow-hidden border-t border-[#181830]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 uppercase tracking-wider">
            PIPELINE ARCHITECTURE
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-100 mt-4 tracking-tight">
            From question to evidence.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-400">
            A stateful, 6-stage autonomous investigation pipeline that doesn&apos;t stop at basic visualizations—it rigorously proves root causes.
          </p>
        </div>

        {/* 6-Step Connected Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative">
          {PIPELINE_STEPS.map((item, index) => {
            const Icon = item.icon
            const isActive = activeStep === index
            return (
              <motion.div
                key={item.step}
                onClick={() => setActiveStep(index)}
                whileHover={{ y: -4 }}
                className={`p-6 rounded-2xl cursor-pointer transition-all border relative overflow-hidden ${
                  isActive
                    ? 'bg-gradient-to-b from-[#14142d] to-[#0f0f20] border-cyan-500/60 shadow-xl shadow-cyan-600/15'
                    : 'bg-[#0e0e1a] border-[#1f1f3a] hover:border-[#2f2f58]'
                }`}
              >
                {/* Step number badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    isActive ? 'bg-cyan-600/30 border border-cyan-500/50 text-cyan-300' : 'bg-[#181832] text-slate-400'
                  }`}>
                    <Icon size={20} />
                  </div>
                  <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-md ${
                    isActive ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-[#141428] text-slate-500'
                  }`}>
                    STEP {item.step}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-100 tracking-wide mb-2">{item.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-3">{item.summary}</p>
                <div className="p-3 rounded-xl bg-[#090914] border border-[#1b1b36] text-[11px] text-slate-400 font-mono">
                  {item.detail}
                </div>

                {isActive && (
                  <div className="mt-4 flex items-center gap-1.5 text-xs text-cyan-400 font-semibold">
                    <span>Active Pipeline Step</span>
                    <ArrowRight size={12} />
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
