import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers, Cpu, Server, Database, Code, Search, Shield, ChevronDown
} from 'lucide-react'

const ARCHITECTURE_LAYERS = [
  {
    id: 'exp',
    icon: Layers,
    title: 'Experience Layer',
    technologies: ['React', 'TypeScript', 'Tailwind CSS', 'Framer Motion'],
    desc: 'High-performance visual dashboard rendering, real-time investigation timeline streams, interactive hypothesis tree nodes, and detailed evidence explorer panels.'
  },
  {
    id: 'app',
    icon: Server,
    title: 'Application Services',
    technologies: ['FastAPI', 'OAuth2 / JWT', 'REST APIs', 'WebSockets (Real-time Events)'],
    desc: 'Session routing, workspace scoping, auth validations, background task scheduling, and secure payload delivery pipelines.'
  },
  {
    id: 'intel',
    icon: Cpu,
    title: 'Multi-Agent Intelligence',
    technologies: ['Supervisor Agent', 'Specialized Agents', 'Structured Outputs', 'Agent Orchestration'],
    desc: 'Central supervisor agent routes sub-tasks, monitors global investigation states, triggers python executors, and handles critic model verification audits.'
  },
  {
    id: 'data',
    icon: Database,
    title: 'Storage & Cache',
    technologies: ['PostgreSQL', 'Redis Cache', 'Raw Datasets', 'Document Blocks', 'Memory Graph'],
    desc: 'Relational data persistence, temporal session caching, raw dataset metadata records, vectorized business reports, and workspace preference memory lists.'
  },
  {
    id: 'analysis',
    icon: Code,
    title: 'Analysis Sandbox',
    technologies: ['Python Runtime', 'Pandas DataFrame', 'DuckDB Engine', 'Isolated Execution Environment'],
    desc: 'Generates sandboxed Python queries dynamically. DuckDB executes highly optimized SQL/CSV filtering directly in memory under strict time resource limits.'
  },
  {
    id: 'know',
    icon: Search,
    title: 'Knowledge & RAG',
    technologies: ['Hybrid Vector Search', 'Dense/Sparse Retrievers', 'Document Chunking', 'Cross-Encoder Reranking'],
    desc: 'Splits DOCX/PDF business context files into chunks, creates vector embeddings, and performs hybrid search queries to supplement numeric data findings.'
  },
  {
    id: 'rel',
    icon: Shield,
    title: 'Reliability & Guardrails',
    technologies: ['Structured LLM Guardrails', 'Trace Auditing', 'Evaluation Tests', 'Prompt Guard'],
    desc: 'Intercepts prompts for anomalies, checks for hallucinations via critic agent, verifies citation boundaries, and tracks execution trace logs.'
  }
]

export default function TechArchitecture() {
  const [activeLayer, setActiveLayer] = useState('intel')

  return (
    <section id="architecture" className="py-24 bg-[#0a0a14] relative overflow-hidden border-t border-[#181830]">
      {/* Background visual grids */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-cyan-600/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 uppercase tracking-wider">
            SYSTEM ARCHITECTURE
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-100 mt-4 tracking-tight">
            Designed as a real AI system, <span className="text-cyan-400">not a demo.</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-400">
            A production-ready stack designed for execution containment, high-speed structured analytical queries, and full audit lineage.
          </p>
        </div>

        {/* Stack Visualization */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-5xl mx-auto">
          {/* Left: Layered Stack list */}
          <div className="lg:col-span-6 space-y-2.5">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">SYSTEM LAYERS (TOP TO BOTTOM)</p>
            
            {ARCHITECTURE_LAYERS.map((layer) => {
              const Icon = layer.icon
              const isActive = activeLayer === layer.id
              return (
                <div
                  key={layer.id}
                  onMouseEnter={() => setActiveLayer(layer.id)}
                  onClick={() => setActiveLayer(layer.id)}
                  className={`p-4 rounded-xl cursor-pointer border transition-all flex items-center justify-between group ${
                    isActive
                      ? 'bg-[#14142c] border-cyan-500 shadow-md shadow-cyan-600/10'
                      : 'bg-[#0e0e1c] border-[#1e1e3b] hover:border-[#2a2a4c]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors ${
                      isActive ? 'bg-cyan-600/25 border-cyan-500/40 text-cyan-300' : 'bg-[#15152a] border-[#222244] text-slate-400'
                    }`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-200">{layer.title}</h3>
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5">{layer.technologies.slice(0, 3).join(' • ')}</p>
                    </div>
                  </div>
                  <ChevronDown
                    size={14}
                    className={`text-slate-500 transition-transform ${isActive ? 'rotate-90 text-cyan-400' : 'group-hover:text-slate-300'}`}
                  />
                </div>
              )
            })}
          </div>

          {/* Right: Active Layer Inspector */}
          <div className="lg:col-span-6 lg:sticky lg:top-28">
            <div className="bg-[#0e0e1c] border border-[#202042] rounded-2xl p-6 shadow-2xl relative min-h-[320px] flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-600/5 rounded-full blur-3xl pointer-events-none" />

              <AnimatePresence mode="wait">
                {ARCHITECTURE_LAYERS.map((layer) => {
                  if (layer.id !== activeLayer) return null
                  const Icon = layer.icon
                  return (
                    <motion.div
                      key={layer.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-5 my-auto"
                    >
                      <div className="flex items-center gap-3 border-b border-[#1e1e3b] pb-4">
                        <div className="w-10 h-10 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                          <Icon size={20} />
                        </div>
                        <div>
                          <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest">LAYER DETAIL</span>
                          <h4 className="text-sm font-bold text-slate-100 mt-0.5">{layer.title}</h4>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Technologies & Abstractions</p>
                        <div className="flex flex-wrap gap-1.5">
                          {layer.technologies.map((tech) => (
                            <span
                              key={tech}
                              className="px-2.5 py-1 rounded bg-[#090915] border border-[#1b1b36] text-[11px] font-mono text-slate-300"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Subsystem Functionality</p>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {layer.desc}
                        </p>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              <div className="mt-6 pt-4 border-t border-[#1e1e3b] flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>DataPilot Platform Stack</span>
                <span className="text-cyan-400">Developer Docs Available</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
