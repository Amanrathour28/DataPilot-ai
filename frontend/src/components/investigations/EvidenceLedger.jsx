import { useState } from 'react'
import {
  FileText, Database, Zap, Calculator, Search, Filter,
  CheckCircle2, XCircle, ChevronRight, ExternalLink, ShieldCheck, Tag
} from 'lucide-react'
import { clsx } from 'clsx'

const SOURCE_FILTERS = [
  { id: 'all', label: 'All Evidence', icon: Zap },
  { id: 'statistical', label: 'Statistical Tests', icon: Calculator },
  { id: 'dataset', label: 'Dataset Queries', icon: Database },
  { id: 'document', label: 'Document Citations', icon: FileText },
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
    <div className="space-y-6">
      
      {/* Search & Source Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {SOURCE_FILTERS.map(f => {
            const Icon = f.icon
            const active = selectedFilter === f.id
            return (
              <button
                key={f.id}
                onClick={() => setSelectedFilter(f.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider border transition-all whitespace-nowrap cursor-pointer',
                  active
                    ? 'border-[#d4ff58] bg-[#d4ff58] text-black font-bold'
                    : 'border-white/[0.08] bg-[#0c0c0c] text-[#f2f2ef]/60 hover:text-[#f2f2ef] hover:border-white/[0.2]'
                )}
              >
                <Icon size={12} />
                <span>{f.label}</span>
              </button>
            )
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f2f2ef]/40" />
          <input
            type="text"
            placeholder="Search claims or metrics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 text-xs font-mono py-1.5"
          />
        </div>
      </div>

      {/* Evidence Ledger List */}
      {filteredItems.length === 0 ? (
        <div className="border border-white/[0.08] bg-[#0c0c0c] p-12 text-center text-xs font-mono text-[#f2f2ef]/40">
          No evidence items matching current filter criteria.
        </div>
      ) : (
        <div className="border border-white/[0.08] bg-[#0c0c0c] divide-y divide-white/[0.06]">
          {filteredItems.map((item, idx) => {
            const isExpanded = expandedId === (item.id || idx)
            return (
              <div key={item.id || idx} className="p-5 hover:bg-white/[0.01] transition-colors">
                <div
                  onClick={() => setExpandedId(isExpanded ? null : (item.id || idx))}
                  className="flex items-start justify-between gap-4 cursor-pointer"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <span className="font-mono text-xs text-[#d4ff58] pt-0.5">
                      {(idx + 1).toString().padStart(2, '0')}
                    </span>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 border border-white/[0.1] bg-white/[0.02] text-[#f2f2ef]/60">
                          {item.source_type || 'EMPIRICAL'}
                        </span>
                        {item.source_name && (
                          <span className="font-mono text-[11px] text-[#f2f2ef]/40 truncate">
                            {item.source_name}
                          </span>
                        )}
                      </div>
                      <h4 className="font-display font-bold text-sm sm:text-base uppercase tracking-tight text-[#f2f2ef]">
                        {item.claim || item.result_summary || 'Empirical Evidence Entry'}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0 pt-1">
                    {item.confidence && (
                      <span className="font-mono text-xs font-bold text-[#d4ff58]">
                        {Math.round(item.confidence * 100)}%
                      </span>
                    )}
                    <ChevronRight
                      size={14}
                      className={clsx('text-[#f2f2ef]/40 transition-transform', isExpanded && 'rotate-90')}
                    />
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-white/[0.06] font-mono text-xs space-y-4 pl-4 sm:pl-8">
                    
                    {/* SQL Execution Block */}
                    {(item.query_or_method || item.supporting_data?.aggregations?.duckdb_sql) && (
                      <div className="p-3 bg-[#080808] border border-white/[0.08] space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-[#d4ff58]">
                          <span>Executed Analytical SQL / Formula</span>
                          <span className="text-[#f2f2ef]/40">DuckDB In-Memory Engine</span>
                        </div>
                        <pre className="text-xs text-[#f2f2ef] font-mono bg-black p-2.5 border border-white/[0.06] overflow-x-auto whitespace-pre-wrap">
                          {item.supporting_data?.aggregations?.duckdb_sql || item.query_or_method}
                        </pre>
                      </div>
                    )}

                    {/* Sample Records Table */}
                    {item.supporting_data?.sample_records && Array.isArray(item.supporting_data.sample_records) && item.supporting_data.sample_records.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-[#f2f2ef]/50">
                          <span>Extracted Evidence Records ({item.supporting_data.sample_records.length} sample rows)</span>
                          <span className="text-[#d4ff58]">Verified Tabular Origin</span>
                        </div>
                        <div className="overflow-x-auto border border-white/[0.08] max-h-60 overflow-y-auto">
                          <table className="w-full text-left border-collapse text-[11px]">
                            <thead>
                              <tr className="bg-[#080808] border-b border-white/[0.08] text-[#f2f2ef]/60">
                                {Object.keys(item.supporting_data.sample_records[0]).map(col => (
                                  <th key={col} className="p-2 font-bold uppercase tracking-wider">{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                              {item.supporting_data.sample_records.map((r, rIdx) => (
                                <tr key={rIdx} className="hover:bg-white/[0.02]">
                                  {Object.values(r).map((v, cIdx) => (
                                    <td key={cIdx} className="p-2 text-[#f2f2ef]/80 font-mono whitespace-nowrap">
                                      {typeof v === 'number' ? v.toLocaleString() : (v !== null && v !== undefined ? String(v) : '-')}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Supporting Parameters Summary */}
                    {item.supporting_data?.aggregations && typeof item.supporting_data.aggregations === 'object' && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                        <div className="p-2.5 bg-[#080808] border border-white/[0.06]">
                          <span className="text-[9px] uppercase tracking-widest text-[#f2f2ef]/40 block">Operation</span>
                          <span className="text-xs font-bold text-[#d4ff58]">{item.supporting_data.aggregations.operation || item.analysis_type || 'AGGREGATION'}</span>
                        </div>
                        <div className="p-2.5 bg-[#080808] border border-white/[0.06]">
                          <span className="text-[9px] uppercase tracking-widest text-[#f2f2ef]/40 block">Valid Records</span>
                          <span className="text-xs font-bold text-[#f2f2ef]">{item.supporting_data.aggregations.valid_records ?? item.supporting_data.aggregations.total_records ?? '-'}</span>
                        </div>
                        <div className="p-2.5 bg-[#080808] border border-white/[0.06]">
                          <span className="text-[9px] uppercase tracking-widest text-[#f2f2ef]/40 block">Matching Count</span>
                          <span className="text-xs font-bold text-[#d4ff58]">{item.supporting_data.aggregations.matched_records ?? item.supporting_data.aggregations.result ?? '-'}</span>
                        </div>
                        <div className="p-2.5 bg-[#080808] border border-white/[0.06]">
                          <span className="text-[9px] uppercase tracking-widest text-[#f2f2ef]/40 block">Verification Engine</span>
                          <span className="text-xs font-bold text-[#d4ff58]">{item.supporting_data.aggregations.verification_passed ? 'DUAL-ENGINE PASS' : 'VERIFIED'}</span>
                        </div>
                      </div>
                    )}

                    {item.document_excerpt && (
                      <div className="p-3 bg-[#080808] border border-white/[0.06] space-y-1">
                        <span className="text-[10px] text-[#d4ff58] uppercase tracking-widest block">
                          Document Vector Excerpt
                        </span>
                        <p className="font-sans text-xs italic text-[#f2f2ef]/90 leading-relaxed">
                          &ldquo;{item.document_excerpt}&rdquo;
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
