import { useState } from 'react'
import { clsx } from 'clsx'
import {
  AlertTriangle, Eye, Hash, Calendar, List, Fingerprint, Shield,
  Search, RefreshCw, AlertCircle, CheckCircle2, Table, LayoutGrid, ToggleLeft, ToggleRight
} from 'lucide-react'
import { Button } from '../ui/Button'
import { Skeleton } from '../ui/Skeleton'

function typeIcon(col) {
  if (col.is_boolean)     return <ToggleLeft size={12} />
  if (col.is_datetime)    return <Calendar size={12} />
  if (col.is_numeric)     return <Hash size={12} />
  if (col.is_identifier)  return <Fingerprint size={12} />
  if (col.is_categorical) return <List size={12} />
  return <Eye size={12} />
}

function typeLabel(col) {
  if (col.is_boolean)     return 'Boolean'
  if (col.is_datetime)    return 'Date / Time'
  if (col.is_numeric)     return 'Numeric'
  if (col.is_identifier)  return 'Identifier'
  if (col.is_categorical) return 'Categorical'
  return 'Text'
}

function typeColor(col) {
  if (col.is_boolean)     return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
  if (col.is_datetime)    return 'text-purple-400 bg-purple-500/10 border-purple-500/20'
  if (col.is_numeric)     return 'text-[#d4ff58] bg-[#d4ff58]/10 border-[#d4ff58]/20'
  if (col.is_identifier)  return 'text-sky-400 bg-sky-500/10 border-sky-500/20'
  if (col.is_categorical) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
  return 'text-slate-400 bg-slate-500/10 border-slate-500/20'
}

function NullBar({ pct }) {
  const filled = Math.min(Math.max(pct, 0), 100)
  const color = pct > 50 ? 'bg-rose-500' : pct > 10 ? 'bg-amber-400' : 'bg-[#d4ff58]'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 bg-white/[0.06] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${filled}%` }} />
      </div>
      <span className={clsx(
        'font-mono text-[10px] w-10 text-right',
        pct > 50 ? 'text-rose-400 font-bold' : pct > 10 ? 'text-amber-300' : 'text-[#f2f2ef]/40'
      )}>
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}

function StatRow({ label, value }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="flex items-center justify-between py-0.5 text-xs font-mono">
      <span className="text-[#f2f2ef]/40 text-[11px]">{label}</span>
      <span className="text-[#f2f2ef] text-[11px] font-semibold">{value}</span>
    </div>
  )
}

function ColumnCard({ col }) {
  const color = typeColor(col)
  const displayType = col.sql_type || col.dtype || 'VARCHAR'

  return (
    <div className="border border-white/[0.08] bg-[#0c0c0c] p-4 space-y-3 font-sans hover:border-white/[0.16] transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs font-bold text-[#f2f2ef] truncate" title={col.name}>
            {col.name}
          </p>
          <p className="font-mono text-[10px] text-[#f2f2ef]/40 mt-0.5 uppercase">
            {displayType}
          </p>
        </div>
        <div className={clsx('flex items-center gap-1 px-2 py-0.5 border text-[10px] font-mono uppercase font-semibold flex-shrink-0', color)}>
          {typeIcon(col)}
          <span>{typeLabel(col)}</span>
        </div>
      </div>

      {/* PII warning */}
      {col.pii_risk && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono text-[10px]">
          <AlertTriangle size={11} className="text-amber-400 flex-shrink-0" />
          <Shield size={11} className="text-amber-400 flex-shrink-0" />
          <span>Potential PII attribute detected</span>
        </div>
      )}

      {/* Null rate */}
      <div className="space-y-1">
        <div className="flex justify-between font-mono text-[10px]">
          <span className="text-[#f2f2ef]/40 uppercase tracking-wider">Missing Values</span>
          <span className="text-[#f2f2ef]/80">{col.null_count?.toLocaleString() ?? 0}</span>
        </div>
        <NullBar pct={col.null_pct ?? 0} />
      </div>

      {/* Stats Breakdown */}
      <div className="border-t border-white/[0.06] pt-2 space-y-0.5">
        <StatRow
          label="Unique Values"
          value={`${col.unique_count?.toLocaleString() ?? 0} (${(col.unique_pct ?? 0).toFixed(1)}%)`}
        />

        {col.is_numeric && col.stats && (
          <>
            <StatRow label="Mean"   value={col.stats.mean?.toLocaleString()} />
            <StatRow label="Median" value={col.stats.median?.toLocaleString()} />
            <StatRow label="Min"    value={col.stats.min?.toLocaleString()} />
            <StatRow label="Max"    value={col.stats.max?.toLocaleString()} />
            <StatRow label="Std Dev" value={col.stats.std?.toLocaleString()} />
          </>
        )}

        {col.is_datetime && (col.min_date || col.max_date) && (
          <>
            <StatRow label="Earliest" value={col.min_date?.slice(0, 19)} />
            <StatRow label="Latest"   value={col.max_date?.slice(0, 19)} />
          </>
        )}

        {(col.is_categorical || col.is_boolean) && col.top_values && (
          <div className="pt-1">
            <span className="font-mono text-[10px] text-[#f2f2ef]/40 block mb-1 uppercase tracking-wider">
              Top Categories
            </span>
            <div className="flex flex-wrap gap-1">
              {Object.entries(col.top_values).slice(0, 4).map(([v, c]) => (
                <span key={v} className="px-1.5 py-0.5 bg-white/[0.04] border border-white/[0.06] font-mono text-[10px] text-[#f2f2ef]/80">
                  {String(v).length > 14 ? String(v).slice(0, 12) + '…' : String(v)}
                  <span className="text-[#d4ff58] ml-1">×{c}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {col.sample_values?.length > 0 && (
          <div className="pt-1">
            <span className="font-mono text-[10px] text-[#f2f2ef]/40 block mb-0.5 uppercase tracking-wider">
              Sample Data
            </span>
            <p className="font-mono text-[10px] text-[#f2f2ef]/60 truncate" title={col.sample_values.map(String).join(', ')}>
              {col.sample_values.slice(0, 4).map(String).join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ProfileView({
  profile,
  dataset,
  isLoading = false,
  error = null,
  onReprofile = null,
  isReprofiling = false,
}) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL') // 'ALL' | 'NUMERIC' | 'CATEGORICAL' | 'DATETIME' | 'IDENTIFIER' | 'TEXT'
  const [viewMode, setViewMode] = useState('cards') // 'cards' | 'table'

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="p-6 border border-white/[0.08] bg-[#0c0c0c] space-y-4">
          <div className="flex items-center gap-3 font-mono text-xs text-[#d4ff58]">
            <RefreshCw size={14} className="animate-spin" />
            <span>Analyzing dataset schema, calculating distributions and profiling with DuckDB...</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 border border-rose-500/20 bg-rose-500/5 text-center space-y-4 font-mono text-xs">
        <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <AlertCircle size={20} />
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h4 className="text-sm font-bold text-[#f2f2ef] uppercase">Profiling Data Unavailable</h4>
          <p className="text-[11px] text-rose-300/80 leading-relaxed">
            {error?.userMessage || error?.detail || error?.message || 'Could not load statistical profile for this dataset.'}
          </p>
        </div>
        {onReprofile && (
          <div className="pt-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={isReprofiling}
              onClick={onReprofile}
            >
              <RefreshCw size={12} className={clsx(isReprofiling && 'animate-spin')} />
              <span>{isReprofiling ? 'Running Profiler…' : 'Reprofile Dataset Now'}</span>
            </Button>
          </div>
        )}
      </div>
    )
  }

  if (!profile || (!profile.column_profiles?.length && !profile.schema_info?.columns?.length)) {
    return (
      <div className="p-8 border border-white/[0.08] bg-[#0c0c0c] text-center space-y-4 font-mono text-xs">
        <div className="inline-flex p-3 rounded-full bg-white/[0.04] text-[#f2f2ef]/40 border border-white/[0.08]">
          <Table size={20} />
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h4 className="text-sm font-bold text-[#f2f2ef] uppercase">No Profiling Information</h4>
          <p className="text-[11px] text-[#f2f2ef]/50 leading-relaxed">
            This dataset has not been profiled yet or contains no readable columns.
          </p>
        </div>
        {onReprofile && (
          <div className="pt-2">
            <Button
              variant="primary"
              size="sm"
              disabled={isReprofiling}
              onClick={onReprofile}
            >
              <RefreshCw size={12} className={clsx(isReprofiling && 'animate-spin')} />
              <span>{isReprofiling ? 'Generating Profile…' : 'Generate Profile'}</span>
            </Button>
          </div>
        )}
      </div>
    )
  }

  const { quality_report: qr, column_profiles = [], sample_rows = [], schema_info } = profile

  const filteredColumns = column_profiles.filter(col => {
    if (!col) return false
    const matchesSearch = (col.name || '').toLowerCase().includes(search.toLowerCase())
    if (!matchesSearch) return false

    if (typeFilter === 'NUMERIC') return col.is_numeric
    if (typeFilter === 'CATEGORICAL') return col.is_categorical
    if (typeFilter === 'DATETIME') return col.is_datetime
    if (typeFilter === 'BOOLEAN') return col.is_boolean
    if (typeFilter === 'IDENTIFIER') return col.is_identifier
    if (typeFilter === 'TEXT') return !col.is_numeric && !col.is_categorical && !col.is_datetime && !col.is_boolean
    return true
  })

  return (
    <div className="space-y-8 animate-slide-up font-sans">
      
      {/* 1. Data Quality & Health Strip */}
      <div className="border border-white/[0.08] bg-[#0c0c0c] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#f2f2ef]/50">
            DATASET QUALITY & HEALTH
          </span>
          {qr?.quality_score != null && (
            <span className={clsx(
              'font-mono text-xs font-bold px-2 py-0.5 border',
              qr.quality_score >= 80 ? 'text-[#d4ff58] border-[#d4ff58]/30 bg-[#d4ff58]/10' :
              qr.quality_score >= 60 ? 'text-amber-300 border-amber-400/30 bg-amber-400/10' :
              'text-rose-400 border-rose-500/30 bg-rose-500/10'
            )}>
              HEALTH SCORE: {qr.quality_score}/100
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
          {[
            { label: 'TOTAL ROWS',      value: qr?.total_rows?.toLocaleString() ?? dataset?.row_count?.toLocaleString() ?? '—' },
            { label: 'TOTAL COLUMNS',   value: qr?.total_columns ?? dataset?.column_count ?? column_profiles.length },
            { label: 'DUPLICATE ROWS',  value: `${qr?.duplicate_rows ?? 0} (${(qr?.duplicate_pct ?? 0).toFixed(1)}%)` },
            { label: 'MISSING CELLS',   value: `${qr?.missing_cells ?? 0} (${(qr?.missing_pct ?? 0).toFixed(1)}%)` },
          ].map(s => (
            <div key={s.label} className="p-3 border border-white/[0.06] bg-black">
              <p className="text-[10px] text-[#f2f2ef]/40 mb-1">{s.label}</p>
              <p className="text-sm font-bold text-[#f2f2ef]">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Column Attributes Explorer Controls */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-bold text-sm uppercase tracking-tight text-[#f2f2ef]">
              SCHEMA & COLUMN ATTRIBUTES
            </h3>
            <p className="font-mono text-[11px] text-[#f2f2ef]/40">
              Showing {filteredColumns.length} of {column_profiles.length} attributes detected in dataset
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center border border-white/[0.08] bg-black p-0.5">
              <button
                onClick={() => setViewMode('cards')}
                className={clsx(
                  'p-1.5 text-xs transition-colors cursor-pointer',
                  viewMode === 'cards' ? 'bg-white/[0.12] text-[#d4ff58]' : 'text-[#f2f2ef]/40 hover:text-white'
                )}
                title="Cards View"
              >
                <LayoutGrid size={13} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={clsx(
                  'p-1.5 text-xs transition-colors cursor-pointer',
                  viewMode === 'table' ? 'bg-white/[0.12] text-[#d4ff58]' : 'text-[#f2f2ef]/40 hover:text-white'
                )}
                title="Table View"
              >
                <Table size={13} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#f2f2ef]/40" />
              <input
                type="text"
                placeholder="Search columns..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-black border border-white/[0.08] text-xs font-mono text-[#f2f2ef] focus:border-[#d4ff58] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Type Filter Pills */}
        <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
          {[
            { id: 'ALL', label: 'All Columns' },
            { id: 'NUMERIC', label: 'Numeric' },
            { id: 'CATEGORICAL', label: 'Categorical' },
            { id: 'DATETIME', label: 'Date / Time' },
            { id: 'BOOLEAN', label: 'Boolean' },
            { id: 'IDENTIFIER', label: 'Identifiers' },
            { id: 'TEXT', label: 'Text' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setTypeFilter(f.id)}
              className={clsx(
                'px-2.5 py-1 border transition-colors cursor-pointer uppercase',
                typeFilter === f.id
                  ? 'border-[#d4ff58] bg-[#d4ff58]/10 text-[#d4ff58] font-bold'
                  : 'border-white/[0.08] bg-black text-[#f2f2ef]/50 hover:text-[#f2f2ef]'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Column Display */}
        {filteredColumns.length === 0 ? (
          <div className="p-8 border border-white/[0.08] bg-[#0c0c0c] text-center font-mono text-xs text-[#f2f2ef]/40">
            No columns match the current filter or search criteria.
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredColumns.map(col => (
              <ColumnCard key={col.name} col={col} />
            ))}
          </div>
        ) : (
          /* Table Schema View */
          <div className="border border-white/[0.08] bg-[#0c0c0c] overflow-x-auto">
            <table className="w-full text-left font-mono text-xs divide-y divide-white/[0.08]">
              <thead className="bg-black text-[#f2f2ef]/50 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="p-3">Column Name</th>
                  <th className="p-3">Data Type</th>
                  <th className="p-3">Semantic Role</th>
                  <th className="p-3 text-right">Missing</th>
                  <th className="p-3 text-right">Distinct Values</th>
                  <th className="p-3">Summary Statistics / Top Values</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-[#f2f2ef]">
                {filteredColumns.map((col) => (
                  <tr key={col.name} className="hover:bg-white/[0.01]">
                    <td className="p-3 font-bold text-[#f2f2ef] truncate max-w-[200px]">
                      {col.name}
                    </td>
                    <td className="p-3 text-[#f2f2ef]/60 uppercase text-[11px]">
                      {col.sql_type || col.dtype}
                    </td>
                    <td className="p-3">
                      <span className={clsx('inline-flex items-center gap-1 px-1.5 py-0.5 border text-[10px] uppercase', typeColor(col))}>
                        {typeIcon(col)}
                        <span>{typeLabel(col)}</span>
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <span className={clsx(col.null_pct > 10 ? 'text-amber-300 font-bold' : 'text-[#f2f2ef]/70')}>
                        {col.null_count?.toLocaleString() ?? 0} ({(col.null_pct ?? 0).toFixed(1)}%)
                      </span>
                    </td>
                    <td className="p-3 text-right text-[#f2f2ef]/70">
                      {col.unique_count?.toLocaleString() ?? 0} ({(col.unique_pct ?? 0).toFixed(1)}%)
                    </td>
                    <td className="p-3 text-[11px] text-[#f2f2ef]/60 max-w-[280px] truncate">
                      {col.is_numeric && col.stats ? (
                        `min: ${col.stats.min} | max: ${col.stats.max} | mean: ${col.stats.mean}`
                      ) : col.top_values ? (
                        Object.keys(col.top_values).slice(0, 3).join(', ')
                      ) : col.sample_values ? (
                        col.sample_values.slice(0, 3).join(', ')
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Sample Data Preview Table */}
      {sample_rows?.length > 0 && (
        <div className="border border-white/[0.08] bg-[#0c0c0c] space-y-3 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-sm uppercase tracking-tight text-[#f2f2ef]">
                SAMPLE DATA PREVIEW
              </h3>
              <p className="font-mono text-[11px] text-[#f2f2ef]/40">
                First {Math.min(sample_rows.length, 10)} records extracted from dataset
              </p>
            </div>
            <span className="font-mono text-[10px] uppercase text-[#d4ff58] border border-[#d4ff58]/30 px-2 py-0.5 bg-[#d4ff58]/5">
              Verified In-Memory
            </span>
          </div>

          <div className="border border-white/[0.06] overflow-x-auto">
            <table className="w-full text-left font-mono text-xs divide-y divide-white/[0.06]">
              <thead className="bg-black text-[#f2f2ef]/50 text-[10px] uppercase tracking-wider">
                <tr>
                  {(schema_info?.columns || Object.keys(sample_rows[0] || {})).map(col => (
                    <th key={col} className="p-2.5 whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {sample_rows.slice(0, 10).map((row, i) => (
                  <tr key={i} className="hover:bg-white/[0.01]">
                    {(schema_info?.columns || Object.keys(sample_rows[0] || {})).map(col => (
                      <td key={col} className="p-2.5 whitespace-nowrap max-w-[220px] truncate text-[#f2f2ef]/80">
                        {row[col] === null || row[col] === undefined ? (
                          <span className="text-[#f2f2ef]/20 italic font-mono text-[10px]">null</span>
                        ) : String(row[col])}
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
  )
}
