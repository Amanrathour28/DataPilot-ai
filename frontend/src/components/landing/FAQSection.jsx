import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus } from 'lucide-react'

const FAQS = [
  {
    q: 'What is DataPilot?',
    a: 'DataPilot is an autonomous multi-agent data investigation platform. Unlike standard BI dashboards that only display retrospective charts, DataPilot analyzes underlying datasets and documents, formulates hypotheses, isolates anomalies, and identifies verified root causes.',
  },
  {
    q: 'How does the multi-agent system work?',
    a: 'DataPilot coordinates seven specialized AI agents (Supervisor, Profiler, Data Analyst, Python Execution, Hypothesis Generator, RAG Context, and Critic). Each agent performs distinct analytical roles, sharing an immutable state graph to eliminate errors and verify intermediate calculations.',
  },
  {
    q: 'What data formats and sources can DataPilot analyze?',
    a: 'DataPilot natively ingests structured tabular datasets (CSV, parquet, SQL databases) and unstructured qualitative documentation (PDFs, strategy memos, earnings reports, Word documents) within a unified workspace.',
  },
  {
    q: 'How does DataPilot use documents during an investigation?',
    a: 'The RAG Context Agent indexes corporate documents with hybrid semantic search. When an anomaly is detected in numbers, DataPilot searches uploaded PDFs to find qualitative context (such as marketing budget changes, pricing notices, or territory realignments) with exact page citations.',
  },
  {
    q: 'How does hypothesis testing and falsification work?',
    a: 'When an anomaly is identified, the Hypothesis Generator creates multiple candidate explanations. The Python Execution and Hypothesis Testing agents execute targeted calculations to attempt to prove or disprove each candidate, classifying them into Supported, Rejected, or Inconclusive.',
  },
  {
    q: 'How does DataPilot verify conclusions to avoid hallucinations?',
    a: 'The Critic Agent independently audits every causal claim, testing whether observed patterns represent true causation versus simple correlation. Every finding in the final report must be backed by reproducible code execution or verified document excerpts.',
  },
  {
    q: 'How is analytical confidence calculated?',
    a: 'Confidence is computed deterministically using statistical significance (p-values, cohort sample size, variance coverage) combined with critic consensus. The score reflects empirical data density, ensuring low-data conclusions are explicitly labeled as exploratory.',
  },
]

export default function FAQSection() {
  const [openIdx, setOpenIdx] = useState(null)

  const toggle = (idx) => {
    setOpenIdx((prev) => (prev === idx ? null : idx))
  }

  return (
    <section id="faq" className="py-24 md:py-36 border-b border-white/[0.08] bg-[#090909]">
      <div className="dn-container">

        {/* Section Marker */}
        <div className="editorial-label">
          <span className="num">(07)</span>
          <span>Questions, Answered</span>
        </div>

        {/* Section Headline */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16 md:mb-24">
          <div className="lg:col-span-8">
            <h2 className="font-display font-extrabold text-3xl sm:text-5xl md:text-6xl uppercase tracking-tight text-[#f2f2ef] leading-[1.05]">
              Frequently Asked Questions<span className="text-[#d4ff58]">.</span>
            </h2>
          </div>
          <div className="lg:col-span-4 flex flex-col justify-end">
            <p className="text-sm md:text-base text-[#f2f2ef]/60 leading-relaxed font-sans">
              Everything you need to know about the autonomous multi-agent investigation platform, 
              data security, and verification methodology.
            </p>
          </div>
        </div>

        {/* Accordion List (DayNight Style) */}
        <div className="border-t border-white/[0.08] divide-y divide-white/[0.08]">
          {FAQS.map((faq, idx) => {
            const isOpen = openIdx === idx
            return (
              <div key={idx} className="transition-colors">
                <button
                  onClick={() => toggle(idx)}
                  className="w-full py-6 md:py-8 flex items-center justify-between text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-4 md:gap-8">
                    <span className="font-mono text-xs text-[#d4ff58]">
                      0{idx + 1}
                    </span>
                    <h3 className={`font-display font-bold text-lg sm:text-xl md:text-2xl uppercase tracking-tight transition-colors ${
                      isOpen ? 'text-[#d4ff58]' : 'text-[#f2f2ef] group-hover:text-[#f2f2ef]/80'
                    }`}>
                      {faq.q}
                    </h3>
                  </div>
                  <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                    isOpen
                      ? 'border-[#d4ff58] bg-[#d4ff58] text-black'
                      : 'border-white/[0.1] text-[#f2f2ef]/40 group-hover:border-white/[0.3]'
                  }`}>
                    {isOpen ? <Minus size={14} /> : <Plus size={14} />}
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden pb-8 pl-8 md:pl-16 pr-4 max-w-3xl"
                    >
                      <p className="text-sm sm:text-base text-[#f2f2ef]/70 leading-relaxed font-sans">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>

      </div>
    </section>
  )
}
