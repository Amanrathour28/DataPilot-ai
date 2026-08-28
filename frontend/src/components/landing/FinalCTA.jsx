import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'

export default function FinalCTA() {
  return (
    <section className="py-28 relative overflow-hidden border-t border-white/[0.06]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(6,182,212,0.14),rgba(255,255,255,0))]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[300px] bg-violet-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/25 text-cyan-200 text-[11px] font-semibold tracking-wider uppercase">
          <Sparkles size={12} className="text-cyan-400 animate-pulse" />
          <span>Deploy autonomous investigation</span>
        </div>

        <h2 className="text-4xl sm:text-6xl font-display text-slate-50 tracking-tight leading-[1.15]">
          Stop searching for answers.{' '}
          <br />
          <span className="text-gradient italic">Start investigating them.</span>
        </h2>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Upload your files, ask the question, and let DataPilot investigate what changed, test correlation versus causation, and deliver verified evidence.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            to="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl text-sm font-semibold bg-gradient-to-b from-cyan-300 to-cyan-600 text-cyan-950 shadow-xl shadow-cyan-600/25 transition-all hover:brightness-110"
          >
            Start your investigation
            <ArrowRight size={16} />
          </Link>
          <a
            href="#workflow"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-white/[0.04] hover:bg-white/[0.07] text-slate-200 border border-white/[0.08] transition-all"
          >
            Explore the platform
          </a>
        </div>

        <p className="text-[10px] font-mono text-slate-500 tracking-wide uppercase">
          Multi-agent AI · Data profiling · Vector RAG · Hypothesis verification · Root cause lineage
        </p>
      </div>
    </section>
  )
}
