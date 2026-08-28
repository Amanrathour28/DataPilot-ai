import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, Database, Search, ShieldCheck, Cpu, GitBranch } from 'lucide-react'
import HeroInvestigationDemo from './HeroInvestigationDemo'

const CAPABILITY_PILLS = [
  { icon: Cpu, label: 'Multi-agent orchestration' },
  { icon: Database, label: 'Structured data analysis' },
  { icon: Search, label: 'RAG document retrieval' },
  { icon: GitBranch, label: 'Hypothesis testing' },
  { icon: ShieldCheck, label: 'Evidence verification' },
]

export default function Hero() {
  return (
    <section id="hero" className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,182,212,0.22),rgba(255,255,255,0))]" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-violet-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/25 text-cyan-200 text-xs font-semibold mb-6 shadow-lg shadow-cyan-500/10 backdrop-blur-md"
        >
          <Sparkles size={14} className="text-cyan-400 animate-pulse" />
          <span>Autonomous multi-agent investigation</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-6xl lg:text-7xl font-display text-slate-50 tracking-tight leading-[1.08] max-w-4xl mx-auto"
        >
          Ask the question.{' '}
          <br className="hidden sm:inline" />
          Let your data{' '}
          <span className="text-gradient italic">investigate</span>{' '}
          the answer.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 text-base sm:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed"
        >
          DataPilot is an autonomous multi-agent platform that analyzes datasets and documents, tests hypotheses, retrieves evidence, and pinpoints what caused a metric to change.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            to="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl text-sm font-semibold bg-gradient-to-b from-cyan-300 to-cyan-600 text-cyan-950 shadow-xl shadow-cyan-600/25 transition-all hover:brightness-110"
          >
            Start investigating
            <ArrowRight size={16} />
          </Link>
          <a
            href="#workflow"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-white/[0.04] hover:bg-white/[0.07] text-slate-200 border border-white/[0.08] transition-all"
          >
            Explore the platform
          </a>
        </motion.div>

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
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-xs font-medium text-slate-400"
              >
                <Icon size={12} className="text-cyan-400" />
                <span>{pill.label}</span>
              </div>
            )
          })}
        </motion.div>

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
