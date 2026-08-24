import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Cpu, Terminal, GitBranch, ShieldCheck, FileSearch,
  LineChart, CheckCircle2, ChevronRight, Layers, Check
} from 'lucide-react'

const AGENTS = [
  {
    id: 'supervisor',
    name: 'Investigation Orchestrator',
    role: 'Central Orchestration & Dynamic Task Routing',
    icon: Sparkles,
    color: 'from-indigo-500 to-purple-600',
    borderColor: 'border-indigo-500/50',
    description: 'Understands the objective, monitors investigation graph state, dynamically creates follow-up tasks, and determines when sufficient evidence exists.',
    exampleInput: 'Objective: "Identify primary drivers of Q3 revenue decline"',
    exampleOutput: 'Delegated Task 1 -> Profiler, Task 2 -> Data Analyst, Task 3 -> RAG Agent',
    tools: ['Graph Router', 'State Monitor', 'Task Evaluator'],
    isCentral: true,
  },
  {
    id: 'analyst',
    name: 'Data Analyst Agent',
    role: 'Metrics, Segment Slicing & Anomaly Detection',
    icon: LineChart,
    color: 'from-sky-500 to-indigo-600',
    borderColor: 'border-sky-500/40',
    description: 'Explores datasets, compares time periods, ranks segment contributions, and flags statistical anomalies.',
    exampleInput: 'Compare Q2 vs Q3 sales grouped by territory & channel',
    exampleOutput: 'Finding: West Region revenue declined 41% (contributed 78% of overall drop)',
    tools: ['Metric Slicer', 'Anomaly Detector', 'Statistical Test'],
  },
  {
    id: 'python',
    name: 'Python Execution Agent',
    role: 'Sandboxed Python & DuckDB Analysis',
    icon: Terminal,
    color: 'from-emerald-500 to-teal-600',
    borderColor: 'border-emerald-500/40',
    description: 'Executes pandas/duckdb code in a restricted execution environment with resource limits and filesystem isolation.',
    exampleInput: 'df.groupby(["quarter","region"])["revenue"].sum().pct_change()',
    exampleOutput: 'Execution output: Pandas DataFrame [4 rows x 3 cols] in 42ms',
    tools: ['Pandas Sandbox', 'DuckDB Engine', 'NumPy Stats'],
  },
  {
    id: 'hypothesis_gen',
    name: 'Hypothesis Generator',
    role: 'Formulates Candidate Explanations',
    icon: GitBranch,
    color: 'from-amber-500 to-orange-600',
    borderColor: 'border-amber-500/40',
    description: 'Receives preliminary findings and formulates testable candidate explanations with required evidence criteria.',
    exampleInput: 'Findings: Revenue -23%, West Region -41%',
    exampleOutput: 'Formulated H1 (Customer Acquisition drop), H2 (AOV decline), H3 (Supply chain)',
    tools: ['Reasoning Engine', 'Prior Generator', 'Criterion Builder'],
  },
  {
    id: 'hypothesis_test',
    name: 'Hypothesis Testing Agent',
    role: 'Validates Hypotheses Against Data',
    icon: Cpu,
    color: 'from-purple-500 to-pink-600',
    borderColor: 'border-purple-500/40',
    description: 'Attempts to prove or disprove candidate hypotheses by executing targeted calculations against metrics.',
    exampleInput: 'Test H1: Evaluate new customer signup count Q2 vs Q3',
    exampleOutput: 'Verdict: SUPPORTED (Confidence: 91%, Q2: 12.4k -> Q3: 7.1k)',
    tools: ['Hypothesis Validator', 'Cohort Compare', 'Significance Test'],
  },
  {
    id: 'rag',
    name: 'RAG Context Agent',
    role: 'Retrieves Document Evidence & Citations',
    icon: FileSearch,
    color: 'from-blue-500 to-indigo-600',
    borderColor: 'border-blue-500/40',
    description: 'Searches uploaded PDFs, strategy docs, and marketing reports to provide qualitative explanation for quantitative data.',
    exampleInput: 'Search query: "August marketing budget changes West territory"',
    exampleOutput: 'Retrieved text segment from q3_report.pdf (Page 14, Chunk #12)',
    tools: ['Vector Store', 'Hybrid Search', 'Reranker', 'Citation Extractor'],
  },
  {
    id: 'critic',
    name: 'Critic & Verification Agent',
    role: 'Audits Logic & Distinguishes Causation',
    icon: ShieldCheck,
    color: 'from-rose-500 to-red-600',
    borderColor: 'border-rose-500/40',
    description: 'Independently evaluates findings, checks for unsupported claims, flags correlation vs causation, and challenges confidence scores.',
    exampleInput: 'Claim: "Marketing cuts caused revenue decline"',
    exampleOutput: 'Audit: Supported association (87%). Causation plausible but unproven.',
    tools: ['Claim Checker', 'Contradiction Detector', 'Correlation Audit'],
  },
]

export default function AgentNetwork() {
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0])

  return (
    <section id="agents" className="py-24 bg-[#0a0a14] relative overflow-hidden border-t border-[#181830]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 uppercase tracking-wider">
            MULTI-AGENT ORCHESTRATION
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-100 mt-4 tracking-tight">
            One investigation.{' '}
            <span className="text-indigo-400">A team of specialized agents.</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-400">
            DataPilot coordinates a team of autonomous AI agents that collaborate, analyze, hypothesize, search context, and verify conclusions.
          </p>
        </div>

        {/* Interactive Layout: Left Node Selection Grid, Right Inspector Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Node Grid */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {AGENTS.map((agent) => {
              const Icon = agent.icon
              const isSelected = selectedAgent.id === agent.id
              return (
                <motion.div
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`p-4 rounded-xl cursor-pointer transition-all border ${
                    agent.isCentral ? 'sm:col-span-2' : ''
                  } ${
                    isSelected
                      ? 'bg-[#151532] border-indigo-500 shadow-xl shadow-indigo-600/20 ring-1 ring-indigo-500/50'
                      : 'bg-[#0e0e1c] border-[#1e1e3b] hover:border-[#2f2f58]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center shadow-md flex-shrink-0`}>
                      <Icon size={18} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-100 truncate">{agent.name}</p>
                        {isSelected && <Check size={14} className="text-indigo-400 flex-shrink-0" />}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{agent.role}</p>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Inspector Drawer */}
          <div className="lg:col-span-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedAgent.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="p-6 rounded-2xl bg-[#0f0f24] border border-indigo-500/30 shadow-2xl space-y-5"
              >
                {/* Agent Title Header */}
                <div className="flex items-center gap-3 border-b border-[#202042] pb-4">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${selectedAgent.color} flex items-center justify-center shadow-lg`}>
                    <selectedAgent.icon size={22} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100">{selectedAgent.name}</h3>
                    <p className="text-xs text-indigo-400 font-medium">{selectedAgent.role}</p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-300 leading-relaxed">
                  {selectedAgent.description}
                </p>

                {/* Example Input / Output */}
                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-[#080816] border border-[#1b1b36]">
                    <p className="text-[10px] font-mono font-semibold text-slate-500 uppercase">EXAMPLE AGENT INPUT</p>
                    <p className="text-xs font-mono text-slate-300 mt-1">{selectedAgent.exampleInput}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#080816] border border-[#1b1b36]">
                    <p className="text-[10px] font-mono font-semibold text-indigo-400 uppercase">EXAMPLE AGENT OUTPUT</p>
                    <p className="text-xs font-mono text-slate-200 mt-1">{selectedAgent.exampleOutput}</p>
                  </div>
                </div>

                {/* Tools used */}
                <div>
                  <p className="text-[10px] font-mono font-semibold text-slate-400 uppercase mb-2">Tools & Capabilities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedAgent.tools.map((tool) => (
                      <span
                        key={tool}
                        className="px-2.5 py-1 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-[11px] font-mono text-indigo-300"
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
