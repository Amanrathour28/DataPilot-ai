import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'

const CAPABILITIES = [
  {
    n: '01',
    title: 'Autonomous Multi-Agent Investigation',
    summary: 'Orchestrates specialized AI agents to autonomously decompose complex business questions into structured execution steps.',
    detail: 'Supervisor, Profiler, Analyst, and RAG agents coordinate concurrently without manual handoffs.',
  },
  {
    n: '02',
    title: 'Structured Data & Python Sandbox',
    summary: 'Analyzes high-dimensional CSVs and databases with sandboxed Python/DuckDB for verifiable mathematical computation.',
    detail: 'Isolates cohorts, calculates metric variances, tests period-over-period significance in milliseconds.',
  },
  {
    n: '03',
    title: 'Document Intelligence & Vector RAG',
    summary: 'Cross-references qualitative PDF strategy memos, meeting notes, and earnings reports against quantitative trends.',
    detail: 'Embeds and retrieves semantic chunks with exact page, paragraph, and table citation lineage.',
  },
  {
    n: '04',
    title: 'Hypothesis Generation & Falsification',
    summary: 'Formulates candidate explanations for observed anomalies and rigorously tests each against raw empirical evidence.',
    detail: 'Classifies every hypothesis into Supported, Rejected, or Inconclusive with quantifiable confidence.',
  },
  {
    n: '05',
    title: 'Evidence Ledger & Lineage Tracing',
    summary: 'Every output statement links directly to specific dataset rows, calculated metrics, or verified document excerpts.',
    detail: 'Zero hallucinations. Transparent chain-of-thought and mathematical lineage available for executive audit.',
  },
  {
    n: '06',
    title: 'Critic Verification & Root Cause Lineage',
    summary: 'An independent Critic Agent audits every claim to distinguish true causal drivers from spurious correlation.',
    detail: 'Surfaces explicit uncertainty boundaries, data limitations, and actionable executive recommendations.',
  },
]

export default function ProblemComparison() {
  const [hoveredIdx, setHoveredIdx] = useState(null)

  return (
    <section id="what-we-do" className="py-24 md:py-36 border-b border-white/[0.08]">
      <div className="dn-container">

        {/* Editorial Section Marker */}
        <div className="editorial-label">
          <span className="num">(01)</span>
          <span>What DataPilot Does</span>
        </div>

        {/* Section Headline */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16 md:mb-24">
          <div className="lg:col-span-8">
            <h2 className="font-display font-bold text-3xl sm:text-5xl md:text-6xl uppercase tracking-tight text-[#f2f2ef] leading-[1.05]">
              Dashboards show what happened<span className="text-[#d4ff58]">.</span>
              <br />
              <span className="text-[#f2f2ef]/40">DataPilot investigates why.</span>
            </h2>
          </div>
          <div className="lg:col-span-4 flex flex-col justify-end">
            <p className="text-sm md:text-base text-[#f2f2ef]/60 leading-relaxed font-sans">
              Traditional BI leaves analysts stranded with charts and alerts. DataPilot executes the 
              entire analytical investigation end-to-end — from hypothesis to verified root cause.
            </p>
          </div>
        </div>

        {/* Editorial Service/Capability List (DayNight Style) */}
        <div className="border-t border-white/[0.08]">
          {CAPABILITIES.map((item, idx) => {
            const isHovered = hoveredIdx === idx
            return (
              <div
                key={item.n}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="group border-b border-white/[0.08] py-8 md:py-12 transition-all duration-300 cursor-pointer"
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 items-start">
                  
                  {/* Number */}
                  <div className="md:col-span-1 font-mono text-xs text-[#d4ff58] uppercase tracking-widest pt-1">
                    {item.n} / 06
                  </div>

                  {/* Title */}
                  <div className="md:col-span-5">
                    <h3 className="font-display font-bold text-xl sm:text-2xl md:text-3xl uppercase tracking-tight text-[#f2f2ef] group-hover:text-[#d4ff58] group-hover:translate-x-1.5 transition-all duration-200">
                      {item.title}
                    </h3>
                  </div>

                  {/* Description */}
                  <div className="md:col-span-5">
                    <p className="text-sm sm:text-base text-[#f2f2ef]/60 font-sans leading-relaxed">
                      {item.summary}
                    </p>
                    <p className="text-xs font-mono text-[#f2f2ef]/40 mt-2 leading-relaxed">
                      {item.detail}
                    </p>
                  </div>

                  {/* Arrow Indicator */}
                  <div className="md:col-span-1 flex justify-end items-center pt-1">
                    <div className="w-8 h-8 rounded-full border border-white/[0.1] flex items-center justify-center group-hover:border-[#d4ff58] group-hover:bg-[#d4ff58] group-hover:text-black transition-all duration-200">
                      <ArrowUpRight size={16} className="text-[#f2f2ef] group-hover:text-black transition-colors" />
                    </div>
                  </div>

                </div>
              </div>
            )
          })}
        </div>

      </div>
    </section>
  )
}
