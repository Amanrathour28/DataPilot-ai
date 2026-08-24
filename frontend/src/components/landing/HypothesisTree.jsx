import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GitBranch, CheckCircle2, XCircle, HelpCircle, Layers, ArrowRight, Database, FileText } from 'lucide-react'

const HYPOTHESIS_NODES = [
  {
    id: 'root',
    title: 'Q3 Revenue Drop (-23.4%)',
    status: 'OBSERVED_ANOMALY',
    confidence: '100%',
    evidenceCount: '124.8k transactions',
    description: 'Primary problem metric identified by Data Analyst Agent from sales_q3.csv.',
    details: {
      metrics: [
        { label: 'Q2 Revenue', val: '$1.85M' },
        { label: 'Q3 Revenue', val: '$1.42M' },
        { label: 'Variance', val: '-$430,000 (-23.4%)' },
      ],
      source: 'sales_q3.csv',
    },
  },
  {
    id: 'h1',
    parentId: 'root',
    title: 'H1: New Customer Acquisition Drop',
    status: 'SUPPORTED',
    confidence: '91%',
    evidenceCount: '3 data sources',
    description: 'New customer signups in West region dropped by 42.8% during Q3.',
    details: {
      metrics: [
        { label: 'Q2 New Signups', val: '12,421' },
        { label: 'Q3 New Signups', val: '7,103' },
        { label: 'Signup Delta', val: '-5,318 (-42.8%)' },
      ],
      source: 'customers_q3.csv & sales_q3.csv',
      ragContext: 'q3_marketing_report.pdf: "West region campaign budget paused Aug 15th."',
    },
  },
  {
    id: 'h2',
    parentId: 'root',
    title: 'H2: Average Order Value (AOV) Drop',
    status: 'REJECTED',
    confidence: '98%',
    evidenceCount: 'sales_q3.csv',
    description: 'Hypothesis that customer basket size decreased during Q3.',
    details: {
      metrics: [
        { label: 'Q2 AOV', val: '$148.50' },
        { label: 'Q3 AOV', val: '$150.60' },
        { label: 'Variance', val: '+$2.10 (+1.4%)' },
      ],
      source: 'sales_q3.csv',
      rejectionReason: 'AOV remained stable and actually increased slightly (+1.4%).',
    },
  },
  {
    id: 'h3',
    parentId: 'root',
    title: 'H3: Customer Churn Spike',
    status: 'INCONCLUSIVE',
    confidence: '45%',
    evidenceCount: 'churn_report.csv',
    description: 'Hypothesis that existing customer cancellation rate increased.',
    details: {
      metrics: [
        { label: 'Q2 Churn', val: '2.1%' },
        { label: 'Q3 Churn', val: '2.3%' },
      ],
      source: 'churn_report.csv',
      rejectionReason: 'Statistically insignificant variance (+0.2%). Insufficient evidence.',
    },
  },
]

export default function HypothesisTree() {
  const [selectedNode, setSelectedNode] = useState(HYPOTHESIS_NODES[1])

  return (
    <section className="py-24 bg-[#080812] relative overflow-hidden border-t border-[#181830]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 uppercase tracking-wider">
            EXPLAINABILITY & RIGOR
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-100 mt-4 tracking-tight">
            See how every conclusion was investigated.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-400">
            DataPilot visualizes every branch of investigation. Inspect supported, rejected, and inconclusive hypotheses backed by concrete evidence.
          </p>
        </div>

        {/* Tree Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Visual Interactive Tree Nodes */}
          <div className="lg:col-span-7 space-y-4">
            {/* Root node */}
            <div
              onClick={() => setSelectedNode(HYPOTHESIS_NODES[0])}
              className={`p-4 rounded-xl cursor-pointer transition-all border ${
                selectedNode.id === 'root'
                  ? 'bg-[#161633] border-indigo-500 shadow-xl shadow-indigo-600/20'
                  : 'bg-[#0e0e1c] border-[#202040] hover:border-[#303058]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                    <Layers size={16} className="text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-100">{HYPOTHESIS_NODES[0].title}</p>
                    <p className="text-[11px] text-slate-400">{HYPOTHESIS_NODES[0].description}</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">
                  Anomaly
                </span>
              </div>
            </div>

            {/* Branch lines */}
            <div className="pl-6 space-y-3 border-l-2 border-indigo-500/30 ml-4">
              {HYPOTHESIS_NODES.slice(1).map((node) => {
                const isSelected = selectedNode.id === node.id
                let badgeClass = ''
                let Icon = CheckCircle2

                if (node.status === 'SUPPORTED') {
                  badgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  Icon = CheckCircle2
                } else if (node.status === 'REJECTED') {
                  badgeClass = 'bg-red-500/15 text-red-400 border-red-500/30'
                  Icon = XCircle
                } else {
                  badgeClass = 'bg-slate-700/30 text-slate-400 border-slate-600/40'
                  Icon = HelpCircle
                }

                return (
                  <motion.div
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    whileHover={{ x: 4 }}
                    className={`p-4 rounded-xl cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-[#151532] border-indigo-500 shadow-xl shadow-indigo-600/20'
                        : 'bg-[#0d0d1b] border-[#1e1e3b] hover:border-[#2f2f56]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Icon size={16} className={node.status === 'SUPPORTED' ? 'text-emerald-400' : node.status === 'REJECTED' ? 'text-red-400' : 'text-slate-400'} />
                        <div>
                          <p className="text-xs font-bold text-slate-100">{node.title}</p>
                          <p className="text-[11px] text-slate-400 truncate">{node.description}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${badgeClass}`}>
                        {node.status}
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Node Inspector Panel */}
          <div className="lg:col-span-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedNode.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-6 rounded-2xl bg-[#0e0e22] border border-indigo-500/30 shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between border-b border-[#202042] pb-3">
                  <div>
                    <p className="text-[10px] font-mono text-slate-400 uppercase">HYPOTHESIS DETAIL</p>
                    <h3 className="text-sm font-bold text-slate-100 mt-0.5">{selectedNode.title}</h3>
                  </div>
                  <span className="text-xs font-mono font-bold text-indigo-400">
                    Confidence: {selectedNode.confidence}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {selectedNode.description}
                </p>

                {/* Metrics Breakdown */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-mono text-slate-400 uppercase">EVOLUTION OF METRICS</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {selectedNode.details.metrics.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-[#080816] border border-[#1a1a36] text-xs">
                        <span className="text-slate-400">{m.label}</span>
                        <span className="font-mono font-semibold text-slate-200">{m.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sources & Citations */}
                <div className="p-3 rounded-xl bg-[#121226] border border-[#202044] space-y-1 text-xs">
                  <p className="font-semibold text-indigo-300 flex items-center gap-1.5">
                    <Database size={13} /> Source Data Citation:
                  </p>
                  <p className="font-mono text-slate-300 text-[11px]">{selectedNode.details.source}</p>

                  {selectedNode.details.ragContext && (
                    <div className="pt-2 border-t border-[#1e1e3b] mt-2">
                      <p className="font-semibold text-indigo-300 flex items-center gap-1.5">
                        <FileText size={13} /> RAG Document Citation:
                      </p>
                      <p className="font-mono text-slate-300 text-[11px]">{selectedNode.details.ragContext}</p>
                    </div>
                  )}

                  {selectedNode.details.rejectionReason && (
                    <div className="pt-2 border-t border-[#1e1e3b] mt-2">
                      <p className="font-semibold text-red-400 flex items-center gap-1.5">
                        <XCircle size={13} /> Verdict Explanation:
                      </p>
                      <p className="text-slate-300 text-[11px]">{selectedNode.details.rejectionReason}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
