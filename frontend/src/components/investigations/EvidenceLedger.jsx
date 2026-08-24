import { useState } from 'react'
import {
  FileText, Database, Zap, Calculator, Search, Filter,
  CheckCircle2, XCircle, ChevronRight, ExternalLink, ShieldCheck, Tag
} from 'lucide-react'
import { clsx } from 'clsx'

const SOURCE_FILTERS = [
  { id: 'all', label: 'All Evidence', icon: Zap },
  { id: 'statistical', label: 'Statistical Tests', icon: Calculator, color: 'text-purple-400' },
  { id: 'dataset', label: 'Dataset Queries', icon: Database, color: 'text-blue-400' },
  { id: 'document', label: 'Document Citations', icon: FileText, color: 'text-emerald-400' },
]

export default function EvidenceLedger({ evidenceItems = [] }) {
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const filteredItems = evidenceItems.filter(item => {
    const matchesFilter = selectedFilter === 'all' || item.source_type === selectedFilter
    const matchesSearch =
      item.claim?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.result_summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.source_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.causal_classification?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  return (
    <div className="space-y-4">
      {/* Search & Source Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {SOURCE_FILTERS.map(f => {
            const Icon = f.icon
            const active = selectedFilter === f.id
            return (
              <button
                key={f.id}
                onClick={() => setSelectedFilter(f.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap',
                  active
                    ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                    : 'bg-[#161626] text-slate-400 hover:text-slate-200 border border-slate-800'
                )}
              >
                <Icon size={13} className={f.color} />
                {f.label}
              </button>
            )
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search claims or metrics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#111122] border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="card text-center py-12 text-slate-500 text-xs border border-slate-800">
          No evidence items match the selected filter criteria.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item, idx) => {
            const isExpanded = expandedId === (item.evidence_id || idx)
            return (
              <div
                key={item.evidence_id || idx}
                className={clsx(
                  'card p-4 border transition-all cursor-pointer',
                  item.supports_claim ? 'border-slate-800/90 hover:border-slate-700' : 'border-red-500/30 bg-red-500/5'
                )}
                onClick={() => setExpandedId(isExpanded ? null : (item.evidence_id || idx))}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={clsx(
                      'p-2 rounded-lg flex-shrink-0 mt-0.5',
                      item.source_type === 'statistical' && 'bg-purple-500/10 text-purple-400',
                      item.source_type === 'dataset' && 'bg-blue-500/10 text-blue-400',
                      item.source_type === 'document' && 'bg-emerald-500/10 text-emerald-400',
                    )}>
                      {item.source_type === 'statistical' && <Calculator size={16} />}
                      {item.source_type === 'dataset' && <Database size={16} />}
                      {item.source_type === 'document' && <FileText size={16} />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-200">{item.source_name}</span>
                        <span className={clsx(
                          'text-[10px] px-2 py-0.5 rounded font-mono uppercase',
                          item.source_type === 'statistical' && 'bg-purple-500/10 text-purple-300 border border-purple-500/20',
                          item.source_type === 'dataset' && 'bg-blue-500/10 text-blue-300 border border-blue-500/20',
                          item.source_type === 'document' && 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
                        )}>
                          {item.source_type}
                        </span>

                        {item.causal_classification && (
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-800 text-amber-300 border border-amber-500/20">
                            {item.causal_classification.replace(/_/g, ' ')}
                          </span>
                        )}

                        <span className="text-[11px] text-slate-400 font-medium">
                          Confidence: {Math.round((item.confidence || 0.8) * 100)}%
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 font-medium leading-relaxed">
                        {item.claim}
                      </p>

                      <p className="text-xs text-slate-400">
                        {item.result_summary}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center text-xs text-slate-500 flex-shrink-0">
                    <span className={clsx(
                      'flex items-center gap-1 text-[11px] font-medium',
                      item.supports_claim ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      {item.supports_claim ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                      {item.supports_claim ? 'Supports' : 'Contradicts'}
                    </span>
                    <ChevronRight
                      size={15}
                      className={clsx('transition-transform text-slate-500', isExpanded && 'rotate-90')}
                    />
                  </div>
                </div>

                {/* Expandable Technical & Query Proof */}
                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-3 animate-fade-in text-xs">
                    {item.query_or_method && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase">Analysis Method / Query</span>
                        <div className="p-3 bg-[#0c0c16] rounded-xl font-mono text-[11px] text-brand-300 border border-slate-800 overflow-x-auto whitespace-pre-wrap">
                          {item.query_or_method}
                        </div>
                      </div>
                    )}

                    {item.statistical_metrics && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        <div className="p-2.5 bg-[#121222] rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">Test Applied</span>
                          <span className="font-semibold text-slate-200 truncate block">{item.statistical_metrics.test_name}</span>
                        </div>
                        <div className="p-2.5 bg-[#121222] rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">p-Value</span>
                          <span className={clsx('font-bold', (item.statistical_metrics.p_value || 1) < 0.05 ? 'text-emerald-400' : 'text-amber-400')}>
                            {item.statistical_metrics.p_value !== null ? item.statistical_metrics.p_value.toFixed(4) : 'N/A'}
                          </span>
                        </div>
                        <div className="p-2.5 bg-[#121222] rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">Effect Size ({item.statistical_metrics.effect_size_type || "d"})</span>
                          <span className="font-bold text-purple-400">
                            {item.statistical_metrics.effect_size !== null ? item.statistical_metrics.effect_size.toFixed(2) : 'N/A'}
                          </span>
                        </div>
                        <div className="p-2.5 bg-[#121222] rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">Agent Verified</span>
                          <span className="font-medium text-slate-300">{item.created_by_agent}</span>
                        </div>
                      </div>
                    )}

                    {item.document_citation && (
                      <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20 text-xs text-slate-300">
                        <div className="flex items-center justify-between text-[11px] text-emerald-400 font-semibold mb-1">
                          <span>Document: {item.document_citation.document_name} ({item.document_citation.section || 'Passage'})</span>
                          <span>Relevance: {Math.round(item.document_citation.relevance_score * 100)}%</span>
                        </div>
                        <p className="italic text-slate-300">
                          "{item.document_citation.excerpt}"
                        </p>
                      </div>
                    )}
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
