import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Table, Play, Search, Download, Filter, Database,
  Loader2, AlertCircle, CheckCircle, Terminal
} from 'lucide-react'
import { Button } from '../ui/Button'
import { datasetsApi } from '../../services/api'
import { clsx } from 'clsx'

export default function DataExplorer({ datasetId }) {
  const [activeTab, setActiveTab] = useState('table')
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM df LIMIT 25;')
  const [queryResult, setQueryResult] = useState(null)
  const [queryLoading, setQueryLoading] = useState(false)
  const [queryError, setQueryError] = useState(null)
  const [columnFilter, setColumnFilter] = useState('')

  // Fetch raw preview rows
  const { data: previewData, isLoading: loadingPreview } = useQuery({
    queryKey: ['dataset-preview', datasetId],
    queryFn: () => datasetsApi.preview(datasetId, 50, 0),
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
      setQueryError(err.response?.data?.detail || 'Failed to execute query.')
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
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              activeTab === 'table'
                ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                : 'bg-[#161626] text-slate-400 hover:text-slate-200 border border-slate-800'
            )}
          >
            <Table size={14} /> Data Table Preview
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              activeTab === 'sql'
                ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                : 'bg-[#161626] text-slate-400 hover:text-slate-200 border border-slate-800'
            )}
          >
            <Terminal size={14} /> DuckDB SQL Console
          </button>
        </div>

        {activeTab === 'table' && (
          <div className="relative w-64">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Filter columns..."
              value={columnFilter}
              onChange={(e) => setColumnFilter(e.target.value)}
              className="w-full bg-[#111122] border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>
        )}
      </div>

      {/* Tab 1: Table Preview */}
      {activeTab === 'table' && (
        <div className="card border border-slate-800 overflow-hidden">
          {loadingPreview ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Loading dataset rows…</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">No rows available to preview.</div>
          ) : (
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#121222] border-b border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 text-slate-500 font-mono w-12 border-r border-slate-800/60">#</th>
                    {filteredColumns.map((col) => (
                      <th key={col} className="py-2.5 px-3 text-slate-300 font-semibold border-r border-slate-800/40 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 font-mono">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 px-3 text-slate-600 border-r border-slate-800/60 select-none">{idx + 1}</td>
                      {filteredColumns.map((col) => (
                        <td key={col} className="py-2 px-3 text-slate-300 border-r border-slate-800/40 whitespace-nowrap max-w-xs truncate">
                          {String(row[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="p-3 bg-[#111122] border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Showing top {rows.length} rows</span>
            <span>{columns.length} columns total</span>
          </div>
        </div>
      )}

      {/* Tab 2: DuckDB SQL Runner */}
      {activeTab === 'sql' && (
        <div className="space-y-4">
          <div className="card p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Database size={14} className="text-brand-400" />
                Query Dataset Table (<code className="text-brand-400">df</code>)
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleExecuteSql}
                disabled={queryLoading}
              >
                {queryLoading ? (
                  <><Loader2 size={13} className="animate-spin" /> Running…</>
                ) : (
                  <><Play size={13} /> Run SQL Query</>
                )}
              </Button>
            </div>

            <textarea
              rows={3}
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              placeholder="SELECT * FROM df LIMIT 25;"
              className="w-full bg-[#0c0c16] border border-slate-700/80 rounded-xl p-3 font-mono text-xs text-brand-300 focus:outline-none focus:border-brand-500"
            />
          </div>

          {queryError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Query Execution Error</p>
                <p className="mt-0.5">{queryError}</p>
              </div>
            </div>
          )}

          {queryResult && (
            <div className="card border border-slate-800 overflow-hidden">
              <div className="p-3 bg-[#111122] border-b border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle size={14} /> Query succeeded ({queryResult.row_count} rows returned)
                </span>
              </div>
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#121222] border-b border-slate-800 sticky top-0 z-10">
                    <tr>
                      {queryResult.columns.map((col) => (
                        <th key={col} className="py-2.5 px-3 text-slate-300 font-semibold border-r border-slate-800/40 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 font-mono">
                    {queryResult.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                        {queryResult.columns.map((col) => (
                          <td key={col} className="py-2 px-3 text-slate-300 border-r border-slate-800/40 whitespace-nowrap max-w-xs truncate">
                            {String(row[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
