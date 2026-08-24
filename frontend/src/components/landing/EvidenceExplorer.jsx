import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Database, ShieldCheck, CheckCircle2, ChevronRight,
  TrendingDown, Info, ExternalLink, AlertCircle, FileSpreadsheet, Lock
} from 'lucide-react'

const SIMULATED_FINDINGS = [
  {
    id: 'finding-1',
    metric: 'Revenue Decline',
    title: 'Revenue declined 23.4% in Q3.',
    confidence: '94%',
    confidenceStatus: 'High',
    confidenceColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    summary: 'The main revenue drop was isolated to the West region, primarily driven by a sharp contraction in new customer acquisition starting mid-August.',
    evidenceItems: [
      {
        type: 'dataset',
        name: 'sales_q3.csv',
        desc: '124,892 transactions profiled',
        badge: 'Fact',
        badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      },
      {
        type: 'dataset',
        name: 'customers.csv',
        desc: 'New customer acquisition ↓ 42.8%',
        badge: 'Statistical Association',
        badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
      },
      {
        type: 'document',
        name: 'q3_marketing_report.pdf',
        desc: 'West region marketing campaign paused on Aug 15th',
        badge: 'Contextual Proof',
        badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30'
      }
    ],
    uncertainty: 'Marketing cuts are strongly correlated with acquisition decline, but regional sales team vacancies (3 roles open in Q3) represent a minor unquantified contributing factor.'
  },
  {
    id: 'finding-2',
    metric: 'Customer Churn',
    title: 'Enterprise customer churn rose to 4.2% in October.',
    confidence: '88%',
    confidenceStatus: 'Moderate-High',
    confidenceColor: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10',
    summary: 'Churn spiked among customers utilizing API v1 integrations following the deprecation notice issued in late July.',
    evidenceItems: [
      {
        type: 'dataset',
        name: 'churn_records.csv',
        desc: '2,401 enterprise accounts tracked',
        badge: 'Fact',
        badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      },
      {
        type: 'dataset',
        name: 'api_gateway_logs.json',
        desc: '5.2M API requests analyzed showing high latency on v1 endpoints',
        badge: 'Statistical Association',
        badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
      },
      {
        type: 'document',
        name: 'api_migration_roadmap.docx',
        desc: 'V1 deprecation timeline schedule details matching churn spikes',
        badge: 'Contextual Proof',
        badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30'
      }
    ],
    uncertainty: 'We observe a strong relationship between API latency and churn, but competitors launching aggressive Q4 pricing campaigns might account for up to 15% of the losses.'
  },
  {
    id: 'finding-3',
    metric: 'CAC Increase',
    title: 'Customer Acquisition Cost (CAC) spiked by 18.2%.',
    confidence: '91%',
    confidenceStatus: 'High',
    confidenceColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    summary: 'Paid ad CPCs increased across search networks, combined with lower conversion rates on secondary landing pages.',
    evidenceItems: [
      {
        type: 'dataset',
        name: 'ad_network_spend.csv',
        desc: 'CPC rose from $2.40 to $3.15 average',
        badge: 'Fact',
        badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      },
      {
        type: 'dataset',
        name: 'web_analytics_conversions.json',
        desc: 'Sign-up funnel drop-off at Step 2 (+12% drop)',
        badge: 'Statistical Association',
        badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
      },
      {
        type: 'document',
        name: 'competitor_intelligence.pdf',
        desc: 'Competitor bidding on same high-intent keywords increased keyword auction density',
        badge: 'Contextual Proof',
        badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30'
      }
    ],
    uncertainty: 'Attribution data is restricted for iOS mobile users, leaving 12% of the traffic source mapping with default organic attributes.'
  }
]

export default function EvidenceExplorer() {
  const [activeIdx, setActiveIdx] = useState(0)
  const activeFinding = SIMULATED_FINDINGS[activeIdx]

  return (
    <section id="evidence" className="py-24 bg-[#080812] relative overflow-hidden border-t border-[#181830]">
      {/* Background radial highlight */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[600px] h-[300px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 uppercase tracking-wider">
            EVIDENCE-BACKED PROOF
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-100 mt-4 tracking-tight">
            Don&apos;t just get an answer. <span className="text-indigo-400">Inspect the evidence.</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-400">
            DataPilot does not fabricate text or summarize assumptions. Every finding is mapped directly to source metrics and document citations with full confidence levels and explicit boundaries of uncertainty.
          </p>
        </div>

        {/* Tab Selector & Explorer Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left: Tab Selectors */}
          <div className="lg:col-span-4 flex flex-row lg:flex-col gap-3 overflow-x-auto lg:overflow-x-visible pb-4 lg:pb-0">
            {SIMULATED_FINDINGS.map((item, idx) => {
              const isActive = idx === activeIdx
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveIdx(idx)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex-shrink-0 lg:flex-shrink flex items-center justify-between group ${
                    isActive
                      ? 'bg-[#14142c] border-indigo-500 shadow-lg shadow-indigo-500/10'
                      : 'bg-[#0e0e1a]/60 border-[#1f1f3a] hover:border-[#2b2b54] hover:bg-[#0e0e1c]'
                  }`}
                >
                  <div>
                    <span className={`text-[10px] font-mono font-bold tracking-wider uppercase ${
                      isActive ? 'text-indigo-400' : 'text-slate-500'
                    }`}>
                      Finding {idx + 1}
                    </span>
                    <p className="text-sm font-bold text-slate-200 mt-0.5">{item.metric}</p>
                  </div>
                  <ChevronRight
                    size={16}
                    className={`transition-transform hidden lg:block ${
                      isActive ? 'text-indigo-400 translate-x-1' : 'text-slate-500 group-hover:text-slate-300'
                    }`}
                  />
                </button>
              )
            })}

            <div className="hidden lg:block p-4 rounded-xl bg-indigo-950/15 border border-indigo-500/20 mt-4 text-[11px] text-slate-400 leading-relaxed">
              <p className="font-semibold text-slate-300 flex items-center gap-1 mb-1">
                <Info size={12} className="text-indigo-400" />
                Analytical Integrity
              </p>
              DataPilot distinguishes observed facts, statistical relationships, supported hypotheses, and unresolved uncertainty.
            </div>
          </div>

          {/* Right: Detailed Evidence Card */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeFinding.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="h-full rounded-2xl bg-[#0e0e1c] border border-indigo-500/30 p-6 sm:p-8 flex flex-col justify-between shadow-2xl shadow-indigo-600/5 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

                <div className="space-y-6">
                  {/* Top Stats: Finding & Confidence */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f1f3a] pb-5">
                    <div>
                      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">ACTIVE INVESTIGATION REPORT</p>
                      <h3 className="text-lg sm:text-xl font-bold text-slate-100 mt-1">{activeFinding.title}</h3>
                    </div>
                    <div className="flex-shrink-0 text-left sm:text-right">
                      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Confidence Score</p>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border mt-1.5 ${activeFinding.confidenceColor}`}>
                        <ShieldCheck size={13} />
                        {activeFinding.confidence} ({activeFinding.confidenceStatus})
                      </span>
                    </div>
                  </div>

                  {/* Summary text */}
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Executive Summary</p>
                    <p className="text-sm text-slate-300 leading-relaxed mt-2">{activeFinding.summary}</p>
                  </div>

                  {/* Evidence List */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Lineage & Evidence Citations</p>
                    <div className="space-y-2.5">
                      {activeFinding.evidenceItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-[#090914] border border-[#1b1b36]"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0 ${
                              item.type === 'dataset'
                                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                                : 'bg-purple-500/10 border border-purple-500/30 text-purple-400'
                            }`}>
                              {item.type === 'dataset' ? <Database size={15} /> : <FileText size={15} />}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-200 font-mono flex items-center gap-1">
                                {item.name}
                              </p>
                              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{item.desc}</p>
                            </div>
                          </div>
                          <span className={`inline-block text-[10px] font-mono font-semibold px-2 py-0.5 rounded border self-start sm:self-center ${item.badgeColor}`}>
                            {item.badge}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Uncertainty section */}
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex gap-3 text-xs leading-relaxed text-slate-300">
                    <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-400">Boundary of Uncertainty:</span>{' '}
                      {activeFinding.uncertainty}
                    </div>
                  </div>
                </div>

                {/* Bottom Link */}
                <div className="mt-8 pt-5 border-t border-[#1f1f3a] flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-mono">ID: dp-report-v1.43</span>
                  <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
                    <span>View Full Investigation Report</span>
                    <ExternalLink size={13} />
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
