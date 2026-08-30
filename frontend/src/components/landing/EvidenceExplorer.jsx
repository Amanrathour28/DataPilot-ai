import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, ShieldCheck, Database, FileText } from 'lucide-react'

const TRAIL_STEPS = [
  {
    stage: '01 / RAW DATA',
    title: 'Ingestion & Schema Profiling',
    desc: 'sales_q3.csv (124,892 rows) and customers.csv mapped with zero loss of column fidelity.',
    badge: 'Empirical Data',
  },
  {
    stage: '02 / ANOMALY',
    title: 'Variance Isolation',
    desc: 'Q3 revenue fell 23.4%. Regional segmentation isolates West territory as primary contributor (-41%).',
    badge: 'Observed Fact',
  },
  {
    stage: '03 / HYPOTHESIS',
    title: 'Candidate Formulation',
    desc: 'Hypothesis H1 formulated: "New customer acquisition contracted following marketing spend pause."',
    badge: 'Prior Theory',
  },
  {
    stage: '04 / RETRIEVAL',
    title: 'Contextual Vector Match',
    desc: 'RAG agent cross-references q3_marketing_report.pdf (Chunk #12, Page 14) confirming spend cuts.',
    badge: 'Document Proof',
  },
  {
    stage: '05 / COMPUTATION',
    title: 'Python Statistical Falsification',
    desc: 'AOV hypothesis tested and rejected (+1.4%). Acquisition drop verified (-42.8%, p < 0.001).',
    badge: 'Mathematical Check',
  },
  {
    stage: '06 / VERIFICATION',
    title: 'Critic Causal Certification',
    desc: 'Critic Agent audits link, flags sales vacancies as boundary factor, certifies 91% causal confidence.',
    badge: 'Causal Proof',
  },
]

export default function EvidenceExplorer() {
  const [activeStep, setActiveStep] = useState(3)

  return (
    <section id="evidence" className="py-24 md:py-36 border-b border-white/[0.08] bg-[#080808]">
      <div className="dn-container">

        {/* Section Marker */}
        <div className="editorial-label">
          <span className="num">(04)</span>
          <span>The Evidence Trail</span>
        </div>

        {/* Section Headline */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16 md:mb-24">
          <div className="lg:col-span-8">
            <h2 className="font-display font-extrabold text-3xl sm:text-5xl md:text-6xl uppercase tracking-tight text-[#f2f2ef] leading-[1.05]">
              Every conclusion has a trail<span className="text-[#d4ff58]">.</span>
            </h2>
          </div>
          <div className="lg:col-span-4 flex flex-col justify-end">
            <p className="text-sm md:text-base text-[#f2f2ef]/60 leading-relaxed font-sans">
              DataPilot does not fabricate summaries or make unsupported claims. Every conclusion maps 
              linearly to verified dataset rows and qualitative citations.
            </p>
          </div>
        </div>

        {/* Sequential Visual Evidence Chain (DayNight Style) */}
        <div className="border-t border-white/[0.08] divide-y divide-white/[0.08]">
          {TRAIL_STEPS.map((step, idx) => {
            const isSelected = activeStep === idx
            return (
              <div
                key={step.stage}
                onClick={() => setActiveStep(idx)}
                className={`py-8 md:py-10 transition-all duration-200 cursor-pointer group ${
                  isSelected ? 'bg-white/[0.02]' : 'hover:bg-white/[0.01]'
                }`}
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 items-center">
                  
                  {/* Step Stage */}
                  <div className="md:col-span-3">
                    <span className={`font-mono text-xs uppercase tracking-widest block transition-colors ${
                      isSelected ? 'text-[#d4ff58]' : 'text-[#f2f2ef]/40 group-hover:text-[#f2f2ef]/70'
                    }`}>
                      {step.stage}
                    </span>
                  </div>

                  {/* Step Title */}
                  <div className="md:col-span-4">
                    <h3 className={`font-display font-bold text-lg sm:text-xl uppercase tracking-tight transition-colors ${
                      isSelected ? 'text-[#f2f2ef]' : 'text-[#f2f2ef]/70 group-hover:text-[#f2f2ef]'
                    }`}>
                      {step.title}
                    </h3>
                  </div>

                  {/* Description */}
                  <div className="md:col-span-4">
                    <p className="text-xs sm:text-sm text-[#f2f2ef]/60 font-sans leading-relaxed">
                      {step.desc}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div className="md:col-span-1 flex justify-end">
                    <span className={`px-2 py-1 text-[10px] font-mono uppercase tracking-wider border whitespace-nowrap ${
                      isSelected
                        ? 'border-[#d4ff58] text-[#d4ff58] bg-[#d4ff58]/10'
                        : 'border-white/[0.1] text-[#f2f2ef]/40'
                    }`}>
                      {step.badge}
                    </span>
                  </div>

                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom Callout */}
        <div className="mt-12 p-8 border border-white/[0.08] bg-[#0c0c0c] flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <ShieldCheck size={20} className="text-[#d4ff58]" />
            <span className="font-mono text-xs text-[#f2f2ef]/80 uppercase tracking-wider">
              Cryptographically verifiable citation trail attached to every executive report
            </span>
          </div>
          <span className="font-mono text-xs text-[#d4ff58] uppercase tracking-widest font-bold">
            100% Traceable
          </span>
        </div>

      </div>
    </section>
  )
}
