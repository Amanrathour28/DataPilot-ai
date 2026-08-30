import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'

const STAGES = [
  {
    n: '01',
    name: 'Understand',
    role: 'Supervisor Agent',
    desc: 'Interprets the natural language question, maps key business metrics, and establishes workspace dataset and document boundaries.',
    artifact: 'Objective Graph & Scope Boundary',
  },
  {
    n: '02',
    name: 'Plan',
    role: 'Planner & Profiler',
    desc: 'Determines the execution sequence, defines required data transformations, and designs candidate hypotheses.',
    artifact: 'Structured JSON Investigation Roadmap',
  },
  {
    n: '03',
    name: 'Investigate',
    role: 'Data Analyst & Python Sandbox',
    desc: 'Executes sandboxed DuckDB/Python queries to slice metrics by region, cohort, and product segment, isolating core anomalies.',
    artifact: 'Segment Variance & Empirical Delta Matrix',
  },
  {
    n: '04',
    name: 'Hypothesize',
    role: 'Hypothesis Generator & Tester',
    desc: 'Formulates candidate causal models and evaluates each against empirical data, classifying findings into Supported or Rejected.',
    artifact: 'Hypothesis Matrix with Confidence P-Values',
  },
  {
    n: '05',
    name: 'Verify',
    role: 'RAG Context & Critic Agent',
    desc: 'Cross-references qualitative PDF strategy documents, challenges causal claims, and evaluates statistical reliability.',
    artifact: 'Multi-Modal Citation & Ground-Truth Trail',
  },
  {
    n: '06',
    name: 'Explain',
    role: 'Report Generator & Supervisor',
    desc: 'Synthesizes executive findings, outlines verified root causes, specifies uncertainty boundaries, and outputs actionable next steps.',
    artifact: 'Audited Executive Investigation Report',
  },
]

export default function InvestigationWorkflow() {
  const [activeStage, setActiveStage] = useState(0)

  return (
    <section id="how-it-works" className="py-24 md:py-36 border-b border-white/[0.08] bg-[#080808]">
      <div className="dn-container">

        {/* Section Marker */}
        <div className="editorial-label">
          <span className="num">(06)</span>
          <span>How DataPilot Investigates</span>
        </div>

        {/* Section Headline */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16 md:mb-24">
          <div className="lg:col-span-8">
            <h2 className="font-display font-extrabold text-3xl sm:text-5xl md:text-6xl uppercase tracking-tight text-[#f2f2ef] leading-[1.05]">
              From question to verified root cause<span className="text-[#d4ff58]">.</span>
            </h2>
          </div>
          <div className="lg:col-span-4 flex flex-col justify-end">
            <p className="text-sm md:text-base text-[#f2f2ef]/60 leading-relaxed font-sans">
              A continuous, 6-stage autonomous investigation pipeline designed to replace manual 
              spreadsheet analysis with verifiable algorithmic rigor.
            </p>
          </div>
        </div>

        {/* Sequential Editorial Timeline (DayNight Style) */}
        <div className="border-t border-white/[0.08] divide-y divide-white/[0.08]">
          {STAGES.map((stage, idx) => {
            const isActive = activeStage === idx
            return (
              <div
                key={stage.n}
                onMouseEnter={() => setActiveStage(idx)}
                onClick={() => setActiveStage(idx)}
                className={`py-8 md:py-10 transition-all duration-200 cursor-pointer group ${
                  isActive ? 'bg-white/[0.02]' : 'hover:bg-white/[0.01]'
                }`}
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 items-start">
                  
                  {/* Number */}
                  <div className="md:col-span-1">
                    <span className={`font-mono text-xs uppercase tracking-widest block transition-colors ${
                      isActive ? 'text-[#d4ff58]' : 'text-[#f2f2ef]/30 group-hover:text-[#f2f2ef]/60'
                    }`}>
                      {stage.n} / 06
                    </span>
                  </div>

                  {/* Stage Name & Role */}
                  <div className="md:col-span-4">
                    <h3 className={`font-display font-bold text-2xl sm:text-3xl uppercase tracking-tight transition-all duration-200 ${
                      isActive ? 'text-[#d4ff58] translate-x-2' : 'text-[#f2f2ef] group-hover:text-[#f2f2ef]/80'
                    }`}>
                      {stage.name}
                    </h3>
                    <span className="font-mono text-xs text-[#f2f2ef]/40 uppercase tracking-wider block mt-1">
                      {stage.role}
                    </span>
                  </div>

                  {/* Description */}
                  <div className="md:col-span-4">
                    <p className="text-sm sm:text-base text-[#f2f2ef]/60 font-sans leading-relaxed">
                      {stage.desc}
                    </p>
                  </div>

                  {/* Artifact / Output */}
                  <div className="md:col-span-3 flex md:justify-end items-center">
                    <div className="p-3 border border-white/[0.08] bg-[#0c0c0c] w-full md:w-auto">
                      <span className="font-mono text-[10px] text-[#d4ff58] uppercase tracking-widest block mb-0.5">
                        Delivered Artifact
                      </span>
                      <span className="font-mono text-xs text-[#f2f2ef]/80 block">
                        {stage.artifact}
                      </span>
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
