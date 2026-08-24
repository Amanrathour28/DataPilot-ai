import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'

export default function FinalCTA() {
  return (
    <section className="py-28 bg-[#080812] relative overflow-hidden border-t border-[#181830]">
      {/* Background glow meshes & subtle grids */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(99,102,241,0.15),rgba(255,255,255,0))]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[300px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
      
      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f3a10_1px,transparent_1px),linear-gradient(to_bottom,#1f1f3a10_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-8">
        {/* Top Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold tracking-wider uppercase">
          <Sparkles size={12} className="text-indigo-400 animate-pulse" />
          <span>Deploy Autonomous Investigation</span>
        </div>

        {/* Headline */}
        <h2 className="text-4xl sm:text-6xl font-extrabold text-slate-100 tracking-tight leading-[1.15]">
          Stop searching for answers.{' '}
          <br />
          <span className="bg-gradient-to-r from-indigo-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
            Start investigating them.
          </span>
        </h2>

        {/* Supporting Copy */}
        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Upload your files, ask the question, and let DataPilot investigate what changed, formulate hypotheses, test correlation vs causation, and deliver verified evidence.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            to="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Start Your Investigation
            <ArrowRight size={16} />
          </Link>
          <a
            href="#workflow"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-[#16162d] hover:bg-[#1f1f3e] text-slate-200 border border-[#2b2b4d] transition-all hover:scale-[1.02]"
          >
            Explore the Platform
          </a>
        </div>

        {/* Capability indicator */}
        <p className="text-[10px] font-mono text-slate-500 tracking-wide uppercase">
          Multi-Agent AI • Data Profiling • Vector RAG • Hypothesis Verification • Root Cause Lineage
        </p>
      </div>
    </section>
  )
}
