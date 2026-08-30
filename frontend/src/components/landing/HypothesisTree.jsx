import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, HelpCircle, Layers, Database, FileText } from 'lucide-react'

const STATUS_CONFIG = {
  OBSERVED_ANOMALY: { color: '#f87171', icon: Layers,       label: 'Anomaly' },
  SUPPORTED:        { color: '#34d399', icon: CheckCircle2, label: 'Supported' },
  REJECTED:         { color: '#f87171', icon: XCircle,      label: 'Rejected' },
  INCONCLUSIVE:     { color: '#64748b', icon: HelpCircle,   label: 'Inconclusive' },
}

const NODES = [
  {
    id: 'root',
    title: 'Q3 Revenue Drop (−23.4%)',
    status: 'OBSERVED_ANOMALY',
    confidence: '100%',
    description: 'Primary problem metric identified from sales_q3.csv.',
    details: {
      metrics: [
        { label: 'Q2 Revenue', val: '$1.85M' },
        { label: 'Q3 Revenue', val: '$1.42M' },
        { label: 'Variance',   val: '−$430,000 (−23.4%)' },
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
    description: 'New customer signups in West region dropped 42.8% during Q3.',
    details: {
      metrics: [
        { label: 'Q2 New Signups', val: '12,421' },
        { label: 'Q3 New Signups', val: '7,103' },
        { label: 'Delta',          val: '−5,318 (−42.8%)' },
      ],
      source: 'customers_q3.csv & sales_q3.csv',
      ragContext: 'q3_marketing_report.pdf: "West region campaign budget paused Aug 15th."',
    },
  },
  {
    id: 'h2',
    parentId: 'root',
    title: 'H2: Average Order Value Decline',
    status: 'REJECTED',
    confidence: '98%',
    description: 'Hypothesis that customer basket size decreased in Q3.',
    details: {
      metrics: [
        { label: 'Q2 AOV', val: '$148.50' },
        { label: 'Q3 AOV', val: '$150.60' },
        { label: 'Delta',   val: '+$2.10 (+1.4%)' },
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

const fadeIn = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, delay },
})

export default function HypothesisTree() {
  const [selected, setSelected] = useState(NODES[1])

  return (
    <section id="hypotheses" className="py-28 border-t border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        {/* Section label */}
        <motion.div {...fadeIn()}>
          <p className="section-label">
            <span className="section-number">(05)</span>
            The Verification
          </p>
        </motion.div>

        <motion.h2
          {...fadeIn(0.06)}
          className="headline-section text-[clamp(1.75rem,4vw,3rem)] max-w-2xl mb-4"
        >
          Every hypothesis tested.
          <br />
          <span className="text-slate-500">Only the proven ones remain.</span>
        </motion.h2>

        <motion.p
          {...fadeIn(0.12)}
          className="text-slate-500 text-base max-w-lg leading-relaxed mb-14"
        >
          DataPilot tests each candidate explanation against data. Supported hypotheses are
          verified with evidence. Rejected ones show exactly why they failed.
        </motion.p>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Hypothesis tree — left */}
          <motion.div {...fadeIn(0.16)} className="lg:col-span-7 space-y-3">

            {/* Root anomaly */}
            <button
              onClick={() => setSelected(NODES[0])}
              className={`w-full text-left flex items-center justify-between p-4 rounded-lg border transition-all ${
                selected.id === 'root'
                  ? 'border-brand-500/40 bg-brand-500/5'
                  : 'border-white/[0.05] hover:border-white/[0.09] bg-[#07090f]/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded flex items-center justify-center bg-red-500/10 flex-shrink-0">
                  <Layers size={13} className="text-red-400" />
                </div>
                <div>
                  <p className="text-[0.8125rem] font-semibold text-slate-200">{NODES[0].title}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">{NODES[0].description}</p>
                </div>
              </div>
              <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded border border-red-500/20 bg-red-500/8 text-red-400 flex-shrink-0 ml-3">
                ANOMALY
              </span>
            </button>

            {/* Hypothesis branches */}
            <div className="ml-4 pl-5 border-l border-white/[0.07] space-y-2.5">
              {NODES.slice(1).map((node) => {
                const cfg = STATUS_CONFIG[node.status]
                const Icon = cfg.icon
                const isSelected = selected.id === node.id
                return (
                  <button
                    key={node.id}
                    onClick={() => setSelected(node)}
                    className={`w-full text-left flex items-center justify-between p-4 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-brand-500/40 bg-brand-500/5'
                        : 'border-white/[0.05] hover:border-white/[0.09] bg-[#07090f]/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={14} style={{ color: cfg.color }} className="flex-shrink-0" />
                      <div>
                        <p className="text-[0.8125rem] font-semibold text-slate-300">{node.title}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5 truncate max-w-[280px]">{node.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className="text-[10px] font-mono" style={{ color: cfg.color }}>{node.confidence}</span>
                      <span
                        className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded border"
                        style={{ color: cfg.color, borderColor: `${cfg.color}28`, background: `${cfg.color}0a` }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </motion.div>

          {/* Detail panel — right */}
          <div className="lg:col-span-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="border border-white/[0.06] rounded-lg overflow-hidden bg-[#06070b]"
              >
                {/* Header */}
                <div className="px-5 py-4 border-b border-white/[0.05]">
                  <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mb-1">Hypothesis Detail</p>
                  <h3 className="text-sm font-bold text-slate-100 mb-1">{selected.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-600">Confidence:</span>
                    <span className="text-[11px] font-mono font-bold text-brand-400">{selected.confidence}</span>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <p className="text-xs text-slate-400 leading-relaxed">{selected.description}</p>

                  {/* Metrics */}
                  <div>
                    <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mb-2">Metric Evolution</p>
                    <div className="space-y-1.5">
                      {selected.details.metrics.map((m, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-b-0 text-xs">
                          <span className="text-slate-500">{m.label}</span>
                          <span className="font-mono font-semibold text-slate-200">{m.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Citations */}
                  <div className="bg-[#090b11] border border-white/[0.05] rounded p-3.5 space-y-2.5 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Database size={11} className="text-brand-400" />
                      <span className="font-mono">{selected.details.source}</span>
                    </div>
                    {selected.details.ragContext && (
                      <div className="flex items-start gap-1.5 text-slate-500 pt-2 border-t border-white/[0.04]">
                        <FileText size={11} className="text-brand-400 flex-shrink-0 mt-0.5" />
                        <span className="font-mono">{selected.details.ragContext}</span>
                      </div>
                    )}
                    {selected.details.rejectionReason && (
                      <div className="flex items-start gap-1.5 text-red-400/70 pt-2 border-t border-white/[0.04]">
                        <XCircle size={11} className="text-red-400 flex-shrink-0 mt-0.5" />
                        <span>{selected.details.rejectionReason}</span>
                      </div>
                    )}
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
