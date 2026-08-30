import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'

const AGENTS = [
  {
    n: '01',
    name: 'Investigation Orchestrator',
    role: 'Central Graph Router & Goal Formulation',
    summary: 'Parses the business question, sets the objective boundary, dynamically generates tasks, and coordinates the multi-agent graph until sufficient empirical proof is established.',
    sampleInput: 'Objective: "Determine primary cause of Q3 gross margin compression."',
    sampleOutput: 'Delegated 4 concurrent sub-tasks: Profiler, Python Analyst, RAG Search, Hypothesis Tester.',
    tools: ['Graph Routing Engine', 'State Tree Monitor', 'Convergence Gatekeeper'],
  },
  {
    n: '02',
    name: 'Data Analyst Agent',
    role: 'Statistical Slicing & Metric Variance',
    summary: 'Analyzes tabular datasets, compares time periods, detects outliers, and isolates statistical variance across regional, product, and customer cohort dimensions.',
    sampleInput: 'Group transaction records by region, product category, and discount band.',
    sampleOutput: 'Isolated anomaly: West region signup contraction (-42.8%) accounts for 78% of overall drop.',
    tools: ['Metric Variance Calculator', 'Cohort Slicer', 'Outlier Detector'],
  },
  {
    n: '03',
    name: 'Python Execution Agent',
    role: 'Sandboxed Python & DuckDB Execution',
    summary: 'Executes verifiable Python/Pandas/DuckDB analytical scripts within a secure, isolated sandbox environment with strict execution bounds.',
    sampleInput: 'df.groupby(["quarter", "region"])["revenue"].sum().pct_change()',
    sampleOutput: 'Generated DataFrame [4 rows x 3 cols] executed in 38ms with verified checksum.',
    tools: ['DuckDB OLAP Engine', 'Pandas Sandbox', 'Statistical Test Suite'],
  },
  {
    n: '04',
    name: 'Hypothesis Generator',
    role: 'Causal Candidate Formulation',
    summary: 'Formulates prioritized testable candidate explanations for observed anomalies, establishing required evidentiary criteria for falsification.',
    sampleInput: 'Observed anomalies: Revenue down 23.4%, West region down 41%, AOV flat.',
    sampleOutput: 'Formulated H1 (Acquisition contraction), H2 (AOV decline), H3 (Cancellation spike).',
    tools: ['Causal Prior Generator', 'Falsification Criteria Builder', 'Hypothesis Matrix'],
  },
  {
    n: '05',
    name: 'RAG Context Agent',
    role: 'Semantic Document Intelligence',
    summary: 'Cross-references qualitative corporate PDFs, strategy decks, and operational meeting notes to provide semantic context for quantitative anomalies.',
    sampleInput: 'Vector search: "Q3 marketing budget changes and West territory campaigns"',
    sampleOutput: 'Matched 3 chunks in q3_marketing_report.pdf (Page 14, 94% semantic similarity).',
    tools: ['Hybrid Vector Index', 'Contextual Reranker', 'Citation Extractor'],
  },
  {
    n: '06',
    name: 'Critic & Verification Agent',
    role: 'Causal Auditing & Rigor Evaluation',
    summary: 'Independently evaluates every hypothesis, checks for unsupported conclusions, challenges correlation versus causation, and calculates analytical confidence scores.',
    sampleInput: 'Claim: "Marketing budget pause caused West territory revenue decline."',
    sampleOutput: 'Audit: Supported causal link (91% confidence). Uncertainty: 3 open sales vacancies.',
    tools: ['Causal Claim Checker', 'Contradiction Detector', 'Confidence Calculator'],
  },
]

export default function AgentNetwork() {
  const [activeIdx, setActiveIdx] = useState(0)
  const activeAgent = AGENTS[activeIdx]

  return (
    <section id="agents" className="py-24 md:py-36 border-b border-white/[0.08]">
      <div className="dn-container">

        {/* Section Marker */}
        <div className="editorial-label">
          <span className="num">(03)</span>
          <span>The Specialized Agents</span>
        </div>

        {/* Section Headline */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16 md:mb-24">
          <div className="lg:col-span-8">
            <h2 className="font-display font-extrabold text-3xl sm:text-5xl md:text-6xl uppercase tracking-tight text-[#f2f2ef] leading-[1.05]">
              One investigation<span className="text-[#d4ff58]">.</span>
              <br />
              <span className="text-[#f2f2ef]/40">A team of specialized agents.</span>
            </h2>
          </div>
          <div className="lg:col-span-4 flex flex-col justify-end">
            <p className="text-sm md:text-base text-[#f2f2ef]/60 leading-relaxed font-sans">
              DataPilot does not rely on a single generic prompt. Seven specialized AI agents collaborate,
              challenge findings, execute code, and audit conclusions.
            </p>
          </div>
        </div>

        {/* Editorial Agent Roster & Live Detail Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start border-t border-white/[0.08] pt-8">

          {/* Left Column: Interactive List (DayNight Style) */}
          <div className="lg:col-span-7 divide-y divide-white/[0.08]">
            {AGENTS.map((agent, idx) => {
              const isActive = activeIdx === idx
              return (
                <div
                  key={agent.n}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => setActiveIdx(idx)}
                  className="py-6 md:py-8 group cursor-pointer transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 md:gap-6">
                      <span className={`font-mono text-xs pt-1 transition-colors ${
                        isActive ? 'text-[#d4ff58]' : 'text-[#f2f2ef]/30 group-hover:text-[#f2f2ef]/60'
                      }`}>
                        {agent.n}
                      </span>
                      <div>
                        <h3 className={`font-display font-bold text-xl sm:text-2xl md:text-3xl uppercase tracking-tight transition-all duration-200 ${
                          isActive
                            ? 'text-[#d4ff58] translate-x-2'
                            : 'text-[#f2f2ef] group-hover:text-[#f2f2ef]/80 group-hover:translate-x-1'
                        }`}>
                          {agent.name}
                        </h3>
                        <p className="font-mono text-xs text-[#f2f2ef]/50 mt-1 uppercase tracking-wider">
                          {agent.role}
                        </p>
                      </div>
                    </div>

                    <div className="pt-1">
                      <div className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-200 ${
                        isActive
                          ? 'border-[#d4ff58] bg-[#d4ff58] text-black'
                          : 'border-white/[0.1] text-[#f2f2ef]/40 group-hover:border-white/[0.3]'
                      }`}>
                        <ArrowUpRight size={14} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right Column: Active Agent Inspection Panel */}
          <div className="lg:col-span-5 sticky top-28">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeAgent.n}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="border border-white/[0.1] bg-[#0c0c0c] p-6 sm:p-8 space-y-6"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                  <div>
                    <span className="font-mono text-xs text-[#d4ff58] uppercase tracking-widest block">
                      Agent Profile {activeAgent.n} / 06
                    </span>
                    <h4 className="font-display font-bold text-xl uppercase text-[#f2f2ef] mt-1">
                      {activeAgent.name}
                    </h4>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-[#d4ff58] animate-pulse" />
                </div>

                {/* Summary */}
                <p className="text-sm text-[#f2f2ef]/70 leading-relaxed font-sans">
                  {activeAgent.summary}
                </p>

                {/* Sample I/O */}
                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3.5 bg-[#080808] border border-white/[0.06] space-y-1">
                    <span className="text-[#f2f2ef]/40 uppercase tracking-widest text-[10px] block">
                      Sample Agent Input
                    </span>
                    <p className="text-[#f2f2ef]/90">{activeAgent.sampleInput}</p>
                  </div>

                  <div className="p-3.5 bg-[#080808] border border-[#d4ff58]/20 space-y-1">
                    <span className="text-[#d4ff58] uppercase tracking-widest text-[10px] block">
                      Autonomous Analytical Output
                    </span>
                    <p className="text-[#f2f2ef]/90">{activeAgent.sampleOutput}</p>
                  </div>
                </div>

                {/* Tool Suite */}
                <div className="pt-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[#f2f2ef]/40 block mb-2">
                    Integrated Tool Suite
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {activeAgent.tools.map((tool) => (
                      <span
                        key={tool}
                        className="px-2.5 py-1 text-[11px] font-mono border border-white/[0.1] text-[#f2f2ef]/70 bg-white/[0.02]"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>

              </motion.div>
            </AnimatePresence>
          </div>

        </div>

      </div>
    </section>
  )
}
