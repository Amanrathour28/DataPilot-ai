import { useState } from 'react'
import {
  Zap, CheckCircle2, XCircle, Clock, AlertCircle,
  HelpCircle, ChevronRight, BarChart2, ShieldAlert
} from 'lucide-react'
import { clsx } from 'clsx'

export default function HypothesisScorecard({ hypotheses = [] }) {
  return (
    <div className="space-y-6">
      {hypotheses.length === 0 ? (
        <div className="border border-white/[0.08] bg-[#0c0c0c] p-12 text-center text-xs font-mono text-[#f2f2ef]/40">
          No hypotheses generated for this investigation yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hypotheses.map((h, idx) => {
            const isSupported = h.status === 'SUPPORTED'
            const isRejected = h.status === 'REJECTED'
            const isTesting = h.status === 'TESTING' || h.status === 'UNDER_INVESTIGATION'

            return (
              <div
                key={h.id || idx}
                className={clsx(
                  'border p-6 bg-[#0c0c0c] flex flex-col justify-between space-y-4 transition-all',
                  isSupported && 'border-[#d4ff58]/40 bg-[#d4ff58]/[0.02]',
                  isRejected && 'border-white/[0.08] opacity-75',
                  isTesting && 'border-amber-400/40',
                  !isSupported && !isRejected && !isTesting && 'border-white/[0.08]'
                )}
              >
                <div>
                  {/* Status & Confidence Header */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/[0.06] mb-3">
                    <span className={clsx(
                      'font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border font-semibold',
                      isSupported && 'border-[#d4ff58] text-[#d4ff58] bg-[#d4ff58]/10',
                      isRejected && 'border-[#ff4e4e] text-[#ff4e4e] bg-[#ff4e4e]/10',
                      isTesting && 'border-amber-400 text-amber-400 bg-amber-400/10 animate-pulse',
                      h.status === 'PROPOSED' && 'border-white/[0.2] text-[#f2f2ef]/60',
                    )}>
                      {h.status?.replace('_', ' ') || 'PROPOSED'}
                    </span>

                    <span className="font-mono text-xs font-bold text-[#f2f2ef]">
                      {Math.round((h.confidence || 0.5) * 100)}% Confidence
                    </span>
                  </div>

                  <h3 className="font-display font-bold text-base sm:text-lg uppercase tracking-tight text-[#f2f2ef] mb-2 leading-snug">
                    {h.title || `Hypothesis H${idx + 1}`}
                  </h3>

                  {h.description && (
                    <p className="text-xs sm:text-sm text-[#f2f2ef]/60 font-sans leading-relaxed">
                      {h.description}
                    </p>
                  )}
                </div>

                {/* Evidentiary Details */}
                <div className="pt-3 border-t border-white/[0.06] font-mono text-[11px] flex items-center justify-between text-[#f2f2ef]/40">
                  <span>{h.causal_classification ? h.causal_classification.replace(/_/g, ' ') : 'Empirical Hypothesis'}</span>
                  {h.evidence_count !== undefined && (
                    <span className="text-[#d4ff58]">{h.evidence_count} Evidence Citations</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
