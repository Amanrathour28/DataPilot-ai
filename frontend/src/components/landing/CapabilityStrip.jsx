import { motion } from 'framer-motion'
import { Cpu, Database, FileSearch, GitBranch, ShieldCheck, LineChart, Layers, Terminal } from 'lucide-react'

const CAPABILITIES = [
  { icon: Cpu,         label: 'Multi-Agent Orchestration' },
  { icon: Database,    label: 'Structured Data Analysis' },
  { icon: FileSearch,  label: 'RAG Contextual Retrieval' },
  { icon: GitBranch,   label: 'Hypothesis Testing' },
  { icon: LineChart,   label: 'Root Cause Analysis' },
  { icon: ShieldCheck, label: 'Evidence Verification' },
  { icon: Terminal,    label: 'Python Sandbox Execution' },
  { icon: Layers,      label: 'Interactive Hypothesis Tree' },
]

export default function CapabilityStrip() {
  return (
    <div className="w-full bg-[#080812] border-y border-[#181830] py-6 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 mb-3 text-center">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
          AUTONOMOUS INVESTIGATION ENGINE CAPABILITIES
        </p>
      </div>

      <div className="relative flex overflow-x-hidden">
        <motion.div
          animate={{ x: ['0%', '-50%'] }}
          transition={{ repeat: Infinity, duration: 25, ease: 'linear' }}
          className="flex items-center gap-8 whitespace-nowrap"
        >
          {[...CAPABILITIES, ...CAPABILITIES].map((item, idx) => {
            const Icon = item.icon
            return (
              <div
                key={idx}
                className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[#121226]/80 border border-[#202042] text-xs font-semibold text-slate-300 shadow-sm"
              >
                <Icon size={14} className="text-indigo-400" />
                <span>{item.label}</span>
              </div>
            )
          })}
        </motion.div>
      </div>
    </div>
  )
}
