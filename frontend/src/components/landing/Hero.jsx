import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, Database, Search, ShieldCheck, Cpu, GitBranch } from 'lucide-react'
import HeroInvestigationDemo from './HeroInvestigationDemo'

const CAPABILITY_PILLS = [
  { icon: Cpu, label: 'Multi-Agent Orchestration' },
  { icon: Database, label: 'Structured Data Analysis' },
  { icon: Search, label: 'RAG Document Retrieval' },
  { icon: GitBranch, label: 'Hypothesis Testing' },
  { icon: ShieldCheck, label: 'Evidence Verification' },
]

export default function Hero() {
  return (
    <section id="hero" className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
      {/* Background glowing meshes & grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.25),rgba(255,255,255,0))]" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
      
      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f3a15_1px,transparent_1px),linear-gradient(to_bottom,#1f1f3a15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        {/* Top Badge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-6 shadow-lg shadow-indigo-500/10 backdrop-blur-md"
        >
          <Sparkles size={14} className="text-indigo-400 animate-pulse" />
          <span>AUTONOMOUS MULTI-AGENT DATA INVESTIGATION</span>
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-slate-100 tracking-tight leading-[1.1] max-w-4xl mx-auto"
        >
          Ask the question.{' '}
          <br className="hidden sm:inline" />
          Let your data{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent underline decoration-indigo-500/40 underline-offset-8">
            investigate
          </span>{' '}
          the answer.
        </motion.h1>

        {/* Supporting Copy */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 text-base sm:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed"
        >
          DataPilot is an autonomous multi-agent platform that analyzes your datasets and documents, formulates and tests hypotheses, retrieves contextual evidence, and pinpoints what caused your metric to change.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            to="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Start Investigating
            <ArrowRight size={16} />
          </Link>
          <a
            href="#workflow"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-[#16162d] hover:bg-[#1f1f3e] text-slate-200 border border-[#2b2b4d] transition-all hover:scale-[1.02]"
          >
            Explore the Platform
          </a>
        </motion.div>

        {/* Capability Pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-2.5"
        >
          {CAPABILITY_PILLS.map((pill) => {
            const Icon = pill.icon
            return (
              <div
                key={pill.label}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#121226] border border-[#202040] text-xs font-medium text-slate-400"
              >
                <Icon size={12} className="text-indigo-400" />
                <span>{pill.label}</span>
              </div>
            )
          })}
        </motion.div>

        {/* Hero Interactive Visual Simulation */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          <HeroInvestigationDemo />
        </motion.div>
      </div>
    </section>
  )
}
