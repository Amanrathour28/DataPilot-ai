import { motion } from 'framer-motion'
import { Database, FileText, Sparkles, ArrowRight, Layers, FileCheck, Search } from 'lucide-react'

export default function RagDataSection() {
  return (
    <section className="py-24 bg-[#0a0a14] relative overflow-hidden border-t border-[#181830]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 uppercase tracking-wider">
            QUANTITATIVE + QUALITATIVE FUSION
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-100 mt-4 tracking-tight">
            Numbers tell you what changed.{' '}
            <span className="text-indigo-400">Context helps explain why.</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-400">
            Pure CSV analysis only discovers anomalies. DataPilot combines structured dataset queries with RAG search across uploaded business documents to reveal true business causes.
          </p>
        </div>

        {/* Dual Stream Visual Flow */}
        <div className="grid grid-cols-1 lg:grid-cols-11 gap-6 items-center">
          {/* Stream 1: Structured Data */}
          <motion.div
            whileHover={{ y: -4 }}
            className="lg:col-span-4 p-6 rounded-2xl bg-[#0e0e1e] border border-[#202042] space-y-4 shadow-xl"
          >
            <div className="flex items-center gap-3 border-b border-[#1c1c38] pb-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <Database size={18} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Structured Datasets</h3>
                <p className="text-[11px] text-slate-400">CSV, Excel, SQL, JSON</p>
              </div>
            </div>

            <div className="space-y-2 font-mono text-xs">
              <div className="p-3 rounded-lg bg-[#14142a] border border-[#222246] flex items-center justify-between">
                <span className="text-slate-400">Q3 Revenue</span>
                <span className="font-bold text-red-400">-23.4% ($1.42M)</span>
              </div>
              <div className="p-3 rounded-lg bg-[#14142a] border border-[#222246] flex items-center justify-between">
                <span className="text-slate-400">New Customers</span>
                <span className="font-bold text-amber-400">-42.8% (7,103)</span>
              </div>
              <div className="p-3 rounded-lg bg-[#14142a] border border-[#222246] flex items-center justify-between">
                <span className="text-slate-400">West Territory</span>
                <span className="font-bold text-red-400">-41.0% drop</span>
              </div>
            </div>
          </motion.div>

          {/* Center Fusion Connector */}
          <div className="lg:col-span-3 text-center flex flex-col items-center justify-center p-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/50 flex items-center justify-center shadow-xl shadow-indigo-600/30 animate-pulse mb-3">
              <Sparkles size={22} className="text-indigo-400" />
            </div>
            <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">RAG + DATA FUSION</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-[200px]">Cross-references metrics with business document text</p>
          </div>

          {/* Stream 2: Business Context Documents */}
          <motion.div
            whileHover={{ y: -4 }}
            className="lg:col-span-4 p-6 rounded-2xl bg-[#0e0e1e] border border-[#202042] space-y-4 shadow-xl"
          >
            <div className="flex items-center gap-3 border-b border-[#1c1c38] pb-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                <FileText size={18} className="text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Business Documents</h3>
                <p className="text-[11px] text-slate-400">PDF, DOCX, Strategy, Reports</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-lg bg-[#14142a] border border-[#222246]">
                <p className="font-semibold text-indigo-300">q3_marketing_report.pdf</p>
                <p className="text-slate-400 text-[11px] mt-0.5">&quot;Digital marketing budget reduced by 35% in August.&quot;</p>
              </div>
              <div className="p-3 rounded-lg bg-[#14142a] border border-[#222246]">
                <p className="font-semibold text-indigo-300">regional_notes.docx</p>
                <p className="text-slate-400 text-[11px] mt-0.5">&quot;West region sales campaign paused mid-quarter.&quot;</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom Merged Finding Result */}
        <div className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-[#111126] via-[#151532] to-[#111126] border border-indigo-500/40 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
              <FileCheck size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">UNIFIED EVIDENCE FINDING</p>
              <p className="text-sm font-bold text-slate-100 mt-0.5">
                West territory customer signups dropped 42.8% following the August marketing budget cuts documented in <span className="underline decoration-indigo-400 font-mono">q3_marketing_report.pdf (Page 14)</span>.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
            Confidence: 91% (HIGH)
          </span>
        </div>
      </div>
    </section>
  )
}
