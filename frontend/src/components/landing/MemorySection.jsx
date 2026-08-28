import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Trash2, CheckCircle2, ShieldCheck, ToggleLeft, ToggleRight,
  Info, ShieldAlert, Sparkles, RefreshCw
} from 'lucide-react'

const INITIAL_MEMORIES = [
  { id: 'mem-1', text: 'Prefers concise executive summaries with bullet points first.', category: 'Formatting Preference' },
  { id: 'mem-2', text: 'Frequently analyzes subscription sales & customer cohort datasets.', category: 'Data Scope' },
  { id: 'mem-3', text: 'Uses quarterly period-over-period comparison metrics for reports.', category: 'Analysis Style' },
  { id: 'mem-4', text: 'Focuses primarily on customer acquisition & conversion velocity.', category: 'Primary Focus' },
  { id: 'mem-5', text: 'Excludes internal QA workspace test records from raw CSV tables.', category: 'Data Filter' }
]

export default function MemorySection() {
  const [memories, setMemories] = useState(INITIAL_MEMORIES)
  const [personalizationEnabled, setPersonalizationEnabled] = useState(true)

  const deleteMemory = (id) => {
    setMemories(memories.filter((mem) => mem.id !== id))
  }

  const restoreMemories = () => {
    setMemories(INITIAL_MEMORIES)
  }

  return (
    <section className="py-24 bg-[#0a0a14] relative overflow-hidden border-t border-[#181830]">
      {/* Background visual highlight */}
      <div className="absolute left-0 bottom-0 w-[600px] h-[300px] bg-cyan-500/5 rounded-full blur-[130px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Explanatory copy */}
          <div className="lg:col-span-5 space-y-6">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 uppercase tracking-wider">
              SMART PERSONALIZATION
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-100 tracking-tight leading-tight">
              An AI that adapts to how you work.
            </h2>
            <p className="text-base text-slate-400 leading-relaxed">
              DataPilot maintains a secure, user-auditable memory graph of your preferences, frequent filters, and metrics of interest. It avoids asking the same framing questions twice.
            </p>

            <div className="p-4 rounded-xl bg-cyan-950/15 border border-cyan-500/20 text-xs text-slate-400 space-y-2">
              <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-cyan-400" />
                Privacy & Data Sovereignty
              </p>
              <p className="leading-relaxed">
                You control what DataPilot remembers. View, edit, or delete individual memory links at any time. Memories are encrypted and never shared.
              </p>
            </div>

            {/* Toggle memory state */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0e0e1c] border border-[#1e1e3b] text-xs">
              <span className="text-slate-300 font-semibold flex items-center gap-2">
                <Brain size={14} className="text-cyan-400" />
                Personalized Memory Engine
              </span>
              <button
                onClick={() => setPersonalizationEnabled(!personalizationEnabled)}
                className="text-cyan-400 hover:text-cyan-300 transition-colors"
                aria-label="Toggle Memory Engine"
              >
                {personalizationEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} className="text-slate-500" />}
              </button>
            </div>
          </div>

          {/* Right Column: Simulated Memory Interface */}
          <div className="lg:col-span-7">
            <div className="bg-[#0e0e1c] border border-[#202042] rounded-2xl p-6 shadow-2xl relative">
              <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-600/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between border-b border-[#202042] pb-4 mb-5">
                <div>
                  <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">WORKSPACE SETTINGS</p>
                  <h3 className="text-sm font-bold text-slate-100 mt-0.5">DataPilot Core Memory Graph</h3>
                </div>
                {memories.length < INITIAL_MEMORIES.length && (
                  <button
                    onClick={restoreMemories}
                    className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2.5 py-1 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-all"
                  >
                    <RefreshCw size={10} />
                    Restore Default list
                  </button>
                )}
              </div>

              {/* Memory List Container */}
              <div className="space-y-3 min-h-[220px]">
                <AnimatePresence mode="popLayout">
                  {!personalizationEnabled ? (
                    <motion.div
                      key="disabled-overlay"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-[220px] flex flex-col items-center justify-center text-center p-4 border border-dashed border-[#202040] rounded-xl bg-[#090915]"
                    >
                      <ShieldAlert size={32} className="text-slate-500 animate-pulse mb-2" />
                      <p className="text-xs font-semibold text-slate-300">Memory engine is currently paused</p>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                        DataPilot will run standard analytical scripts without custom layout or data context adaptation.
                      </p>
                    </motion.div>
                  ) : memories.length === 0 ? (
                    <motion.div
                      key="empty-state"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-[220px] flex flex-col items-center justify-center text-center p-4 border border-dashed border-[#202040] rounded-xl bg-[#090915]"
                    >
                      <Brain size={32} className="text-cyan-500/50 mb-2" />
                      <p className="text-xs font-semibold text-slate-300">No active memory vectors</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Use the restore button in the header or prompt the supervisor agent to record a metric preference.
                      </p>
                    </motion.div>
                  ) : (
                    memories.map((mem) => (
                      <motion.div
                        key={mem.id}
                        layout
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95, x: 20 }}
                        className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-[#090915] border border-[#1d1d3a] hover:border-[#282852] transition-colors"
                      >
                        <div className="flex items-start gap-2.5">
                          <CheckCircle2 size={14} className="text-cyan-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="inline-block text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 mb-1.5">
                              {mem.category}
                            </span>
                            <p className="text-xs text-slate-200 leading-normal">{mem.text}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => deleteMemory(mem.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                          title="Delete memory node"
                          aria-label="Delete memory vector"
                        >
                          <Trash2 size={13} />
                        </button>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>

              {/* Control Footer */}
              <div className="mt-5 pt-4 border-t border-[#202042] flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1 font-mono">
                  <Sparkles size={11} className="text-cyan-400" />
                  {personalizationEnabled ? `${memories.length} vector keys registered` : 'Memory off'}
                </span>
                <button
                  disabled={!personalizationEnabled}
                  className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Manage All Memories
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
