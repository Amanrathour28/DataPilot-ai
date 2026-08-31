import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Table, Play, Search, Download, Filter, Database,
  Loader2, AlertCircle, CheckCircle, Terminal, RefreshCw, Sparkles
} from 'lucide-react'
import { Button } from '../ui/Button'
import { datasetsApi } from '../../services/api'
import { clsx } from 'clsx'

const SAMPLE_QUERIES = [
  { label: 'Top 25 Rows', sql: 'SELECT * FROM df LIMIT 25;' },
  { label: 'Count Rows', sql: 'SELECT COUNT(*) AS total_rows FROM df;' },
  { label: 'Schema Describe', sql: 'DESCRIBE df;' },
  { label: 'Empty Test', sql: 'SELECT * FROM df WHERE 1 = 0;' },
]

export default function DataExplorer({ datasetId }) {
  const [activeTab, setActiveTab] = useState('table')
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM df LIMIT 25;')
  const [queryResult, setQueryResult] = useState(null)
  const [queryLoading, setQueryLoading] = useState(false)
  const [queryError, setQueryError] = useState(null)
  const [columnFilter, setColumnFilter] = useState('')

  // Fetch raw preview rows
  const {
    data: previewData,
    isLoading: loadingPreview,
    error: previewError,
    refetch: refetchPreview,
    isRefetching: refetchingPreview,
  } = useQuery({
    queryKey: ['dataset-preview', datasetId],
    queryFn: () => datasetsApi.preview(datasetId, 50, 0),
    retry: 1,
  })

  // Run DuckDB SQL query
  const handleExecuteSql = async (e) => {
    e?.preventDefault()
    if (!sqlQuery.trim()) return

    setQueryLoading(true)
    setQueryError(null)
    try {
      const res = await datasetsApi.query(datasetId, sqlQuery)
      setQueryResult(res)
    } catch (err) {
      const rawDetail = err.response?.data?.detail
      let message = err.userMessage || 'Failed to execute query.'

      if (typeof rawDetail === 'string') {
        message = rawDetail
      } else if (Array.isArray(rawDetail)) {
        message = rawDetail.map(d => (typeof d === 'string' ? d : d.msg || d.message || JSON.stringify(d))).join('; ')
      } else if (rawDetail && typeof rawDetail === 'object') {
        message = rawDetail.message || rawDetail.error || JSON.stringify(rawDetail)
      } else if (err.userMessage) {
        message = err.userMessage
      } else if (err.message) {
        message = err.message
      }

      setQueryError(message)
      setQueryResult(null)
    } finally {
      setQueryLoading(false)
    }
  }

  const columns = previewData?.columns || []
  const rows = previewData?.rows || []

  const filteredColumns = columnFilter
    ? columns.filter(c => c.toLowerCase().includes(columnFilter.toLowerCase()))
    : columns

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('table')}
            className={clsx(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all',
              activeTab === 'table'
                ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40 shadow-sm'
                : 'bg-[#161626] text-slate-400 hover:text-slate-200 border border-slate-800'
            )}
          >
            <Table size={14} /> Data Table Preview
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={clsx(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all',
              activeTab === 'sql'
                ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40 shadow-sm'
                : 'bg-[#161626] text-slate-400 hover:text-slate-200 border border-slate-800'
            )}
          >
            <Terminal size={14} /> DuckDB SQL Console
          </button>
        </div>

        {activeTab === 'table' && (
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Filter columns..."
                value={columnFilter}
                onChange={(e) => setColumnFilter(e.target.value)}
                className="w-full bg-[#111122] border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetchPreview()}
              disabled={loadingPreview || refetchingPreview}
            >
              <RefreshCw size={12} className={clsx((loadingPreview || refetchingPreview) && 'animate-spin')} />
            </Button>
          </div>
        )}
      </div>

      {/* Tab 1: Table Preview */}
      {activeTab === 'table' && (
        <div className="card border border-slate-800 overflow-hidden rounded-2xl bg-[#0e0e1a] shadow-xl">
          {loadingPreview ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
              <Loader2 size={16} className="animate-spin text-brand-400" />
              <span className="text-xs">Loading dataset preview rows…</span>
            </div>
          ) : previewError ? (
            <div className="p-8 text-center space-y-3">
              <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <AlertCircle size={20} />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h4 className="text-xs font-bold text-slate-200">Could Not Load Dataset Preview</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {previewError.response?.data?.detail || previewError.message || 'Dataset file or snapshot could not be loaded.'}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => refetchPreview()}>
                <RefreshCw size={12} /> Retry Preview
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              No rows available in this dataset.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead className="bg-[#141426] border-b border-slate-800 sticky top-0 z-10 text-[11px] uppercase tracking-wider text-slate-300 font-bold">
                  <tr>
                    <th className="py-3 px-3.5 text-slate-500 font-mono w-12 border-r border-slate-800/60">#</th>
                    {filteredColumns.map((col) => (
                      <th key={col} className="py-3 px-3.5 text-slate-200 font-semibold border-r border-slate-800/40 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 font-mono text-[11px]">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3.5 text-slate-600 border-r border-slate-800/60 select-none">{idx + 1}</td>
                      {filteredColumns.map((col) => (
                        <td key={col} className="py-2.5 px-3.5 text-slate-300 border-r border-slate-800/40 whitespace-nowrap max-w-xs truncate">
                          {String(row[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="p-3.5 bg-[#121224] border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between font-mono">
            <span>Showing top {rows.length} rows</span>
            <span>{columns.length} columns total {previewData?.source ? `(source: ${previewData.source})` : ''}</span>
          </div>
        </div>
      )}

      {/* Tab 2: DuckDB SQL Runner */}
      {activeTab === 'sql' && (
        <div className="space-y-4">
          <div className="card p-5 border border-slate-800 space-y-4 rounded-2xl bg-[#0e0e1a] shadow-xl">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <Database size={15} className="text-brand-400" />
                Query Dataset Table (<code className="text-brand-300 font-mono px-1.5 py-0.5 rounded bg-brand-500/10 border border-brand-500/20">df</code>)
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {SAMPLE_QUERIES.map((sq) => (
                  <button
                    key={sq.label}
                    onClick={() => setSqlQuery(sq.sql)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-[#141426] text-slate-400 hover:text-brand-300 hover:border-brand-500/40 border border-slate-800 transition-colors"
                  >
                    {sq.label}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={3}
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              placeholder="SELECT * FROM df LIMIT 25;"
              className="w-full bg-[#090914] border border-slate-700/80 rounded-xl p-3.5 font-mono text-xs text-brand-200 focus:outline-none focus:border-brand-500 leading-relaxed shadow-inner"
            />

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                DuckDB in-memory analytical SQL engine. Aliases: <code className="text-slate-400">df</code>, <code className="text-slate-400">dataset</code>, <code className="text-slate-400">data</code>
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={handleExecuteSql}
                disabled={queryLoading}
              >
                {queryLoading ? (
                  <><Loader2 size={13} className="animate-spin" /> Executing…</>
                ) : (
                  <><Play size={13} /> Run SQL Query</>
                )}
              </Button>
            </div>
          </div>

          {queryError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-3 shadow-lg">
              <AlertCircle size={17} className="flex-shrink-0 mt-0.5 text-rose-400" />
              <div className="space-y-0.5">
                <p className="font-bold text-rose-200">Query Execution Error</p>
                <p className="font-mono text-[11px] leading-relaxed text-rose-300/90">{queryError}</p>
              </div>
            </div>
          )}

          {queryResult && (
            <div className="card border border-slate-800 overflow-hidden rounded-2xl bg-[#0e0e1a] shadow-xl">
              <div className="p-3.5 bg-[#121224] border-b border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle size={14} /> Query succeeded ({queryResult.row_count} {queryResult.row_count === 1 ? 'row' : 'rows'} matched{queryResult.execution_time_ms ? ` in ${queryResult.execution_time_ms}ms` : ''})
                </span>
                {queryResult.source && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 border border-brand-500/20">
                    Source: {queryResult.source}
                  </span>
                )}
              </div>
              {queryResult.rows.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 font-mono">
                  Query returned 0 rows (valid empty result).
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#141426] border-b border-slate-800 sticky top-0 z-10 text-[11px] uppercase tracking-wider text-slate-300 font-bold">
                      <tr>
                        {queryResult.columns.map((col) => (
                          <th key={col} className="py-2.5 px-3.5 text-slate-200 font-semibold border-r border-slate-800/40 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 font-mono text-[11px]">
                      {queryResult.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                          {queryResult.columns.map((col) => (
                            <td key={col} className="py-2.5 px-3.5 text-slate-300 border-r border-slate-800/40 whitespace-nowrap max-w-xs truncate">
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
