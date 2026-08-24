import { clsx } from 'clsx'
import { AlertTriangle, Eye, Hash, Calendar, List, Fingerprint, Shield } from 'lucide-react'

function typeIcon(col) {
  if (col.is_datetime)    return <Calendar size={12} />
  if (col.is_numeric)     return <Hash size={12} />
  if (col.is_identifier)  return <Fingerprint size={12} />
  if (col.is_categorical) return <List size={12} />
  return <Eye size={12} />
}

function typeLabel(col) {
  if (col.is_datetime)    return 'Date/Time'
  if (col.is_numeric)     return 'Numeric'
  if (col.is_identifier)  return 'Identifier'
  if (col.is_categorical) return 'Categorical'
  return 'Text'
}

function typeColor(col) {
  if (col.is_datetime)    return 'text-purple-400 bg-purple-500/10'
  if (col.is_numeric)     return 'text-emerald-400 bg-emerald-500/10'
  if (col.is_identifier)  return 'text-amber-400 bg-amber-500/10'
  if (col.is_categorical) return 'text-sky-400 bg-sky-500/10'
  return 'text-slate-400 bg-slate-500/10'
}

function NullBar({ pct }) {
  const filled = Math.min(pct, 100)
  const color = pct > 50 ? 'bg-red-500' : pct > 10 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2">
      <div className="progress-bar flex-1">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${filled}%` }} />
      </div>
      <span className={clsx(
        'text-xs w-10 text-right',
        pct > 50 ? 'text-red-400' : pct > 10 ? 'text-amber-400' : 'text-slate-500'
      )}>
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs text-slate-300 font-mono">{value}</span>
    </div>
  )
}

function ColumnCard({ col }) {
  const color = typeColor(col)
  return (
    <div className="card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-200 truncate font-mono">{col.name}</p>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">{col.dtype}</p>
        </div>
        <div className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0', color)}>
          {typeIcon(col)}
          {typeLabel(col)}
        </div>
      </div>

      {/* PII warning */}
      {col.pii_risk && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />
          <Shield size={12} className="text-amber-400 flex-shrink-0" />
          <span className="text-xs text-amber-400">Potential PII detected</span>
        </div>
      )}

      {/* Null rate */}
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-xs text-slate-500">Missing values</span>
          <span className="text-xs text-slate-400">{col.null_count.toLocaleString()}</span>
        </div>
        <NullBar pct={col.null_pct} />
      </div>

      {/* Stats */}
      <div className="border-t border-[#1e1e35] pt-2 space-y-0.5">
        <StatRow label="Unique values" value={`${col.unique_count.toLocaleString()} (${col.unique_pct.toFixed(1)}%)`} />

        {col.is_numeric && col.stats && (
          <>
            <StatRow label="Mean"   value={col.stats.mean?.toLocaleString()} />
            <StatRow label="Median" value={col.stats.median?.toLocaleString()} />
            <StatRow label="Min"    value={col.stats.min?.toLocaleString()} />
            <StatRow label="Max"    value={col.stats.max?.toLocaleString()} />
            <StatRow label="Std"    value={col.stats.std?.toLocaleString()} />
          </>
        )}

        {col.is_categorical && col.top_values && (
          <div>
            <span className="text-xs text-slate-500">Top values</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {Object.entries(col.top_values).slice(0, 4).map(([v, c]) => (
                <span key={v} className="badge-muted badge text-xs">
                  {String(v).length > 16 ? String(v).slice(0, 14) + '…' : v}
                  <span className="text-slate-600 ml-0.5">×{c}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {col.sample_values?.length > 0 && (
          <div className="pt-1">
            <span className="text-xs text-slate-500">Sample values</span>
            <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
              {col.sample_values.slice(0, 4).map(String).join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ProfileView({ profile }) {
  if (!profile) return null

  const { quality_report: qr, column_profiles, sample_rows, schema_info } = profile

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Quality Report */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">Data Quality</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Rows',    value: qr?.total_rows?.toLocaleString()   ?? '—' },
            { label: 'Total Columns', value: qr?.total_columns                  ?? '—' },
            { label: 'Duplicates',    value: `${qr?.duplicate_rows ?? 0} (${qr?.duplicate_pct ?? 0}%)` },
            { label: 'Missing Cells', value: `${qr?.missing_cells ?? 0} (${qr?.missing_pct ?? 0}%)` },
          ].map(s => (
            <div key={s.label} className="text-center p-3 bg-[#1e1e35] rounded-xl">
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className="text-base font-bold text-slate-200">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Quality score */}
        {qr?.quality_score != null && (
          <div className="mt-4">
            <div className="flex justify-between mb-1.5">
              <span className="text-xs text-slate-400">Quality Score</span>
              <span className={clsx(
                'text-xs font-bold',
                qr.quality_score >= 80 ? 'text-emerald-400' :
                qr.quality_score >= 60 ? 'text-amber-400' : 'text-red-400'
              )}>
                {qr.quality_score}/100
              </span>
            </div>
            <div className="progress-bar">
              <div
                className={clsx(
                  'h-full rounded-full transition-all',
                  qr.quality_score >= 80 ? 'bg-emerald-500' :
                  qr.quality_score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                )}
                style={{ width: `${qr.quality_score}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Column Profiles Grid */}
      <div>
        <h3 className="text-sm font-semibold text-slate-200 mb-3">
          Column Explorer
          <span className="text-slate-500 font-normal ml-2 text-xs">{column_profiles?.length} columns</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {column_profiles?.map(col => (
            <ColumnCard key={col.name} col={col} />
          ))}
        </div>
      </div>

      {/* Sample Data */}
      {sample_rows?.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1e1e35]">
            <h3 className="text-sm font-semibold text-slate-200">Sample Data</h3>
            <p className="text-xs text-slate-500 mt-0.5">First 10 rows</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {schema_info?.columns?.map(col => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sample_rows.map((row, i) => (
                  <tr key={i}>
                    {schema_info?.columns?.map(col => (
                      <td key={col} className="font-mono text-xs max-w-[200px] truncate">
                        {row[col] == null ? (
                          <span className="text-slate-600 italic">null</span>
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
