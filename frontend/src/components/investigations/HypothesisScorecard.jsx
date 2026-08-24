import { useState } from 'react'
import {
  Zap, CheckCircle2, XCircle, Clock, AlertCircle,
  HelpCircle, ChevronRight, BarChart2, ShieldAlert
} from 'lucide-react'
import { clsx } from 'clsx'

export default function HypothesisScorecard({ hypotheses = [] }) {
  const [selectedHyp, setSelectedHyp] = useState(null)

  return (
    <div className="space-y-4">
      {hypotheses.length === 0 ? (
        <div className="card text-center py-12 text-slate-500 text-xs border border-slate-800">
          No hypotheses generated yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hypotheses.map((h) => {
            const isSupported = h.status === 'SUPPORTED'
            const isRejected = h.status === 'REJECTED'
            const isTesting = h.status === 'TESTING' || h.status === 'UNDER_INVESTIGATION'

            return (
              <div
                key={h.id}
                className={clsx(
                  'card p-5 border transition-all flex flex-col justify-between',
                  isSupported && 'border-emerald-500/30 bg-emerald-500/5',
                  isRejected && 'border-slate-800/80 bg-[#121220] opacity-80',
                  isTesting && 'border-amber-500/40 bg-amber-500/5',
                  !isSupported && !isRejected && !isTesting && 'border-slate-800'
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={clsx(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider border',
                      isSupported && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
                      isRejected && 'bg-slate-800 border-slate-700 text-slate-400',
                      isTesting && 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse',
                      h.status === 'PROPOSED' && 'bg-blue-500/10 border-blue-500/30 text-blue-400',
                    )}>
                      {h.status.replace('_', ' ')}
                    </span>

                    {h.causal_classification && (
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-[#111122] text-amber-300 border border-slate-800">
                        {h.causal_classification.replace(/_/g, ' ')}
                      </span>
                    )}

                    <span className="text-xs font-bold text-slate-300">
                      {Math.round((h.confidence || 0.5) * 100)}% Conf
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 mb-2 leading-snug">
                    {h.title}
                  </h3>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    {h.description}
                  </p>

                  {/* Variables & Statistical test outcomes */}
                  {h.details?.variables && h.details.variables.length > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase">Variables:</span>
                      {h.details.variables.map((v, i) => (
                        <span key={i} className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Statistical Details Footer */}
                {h.statistical_results && (
                  <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-300">
                    <div className="flex items-center gap-1.5 text-slate-400 font-semibold mb-1">
                      <BarChart2 size={13} className="text-brand-400" />
                      Statistical Test Result
                    </div>
                    <p className="text-slate-400 italic">
                      {h.statistical_results.interpretation || JSON.stringify(h.statistical_results)}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
