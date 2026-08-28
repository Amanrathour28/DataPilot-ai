import { useNavigate } from 'react-router-dom'
import { Database, ArrowRight, Columns, Rows } from 'lucide-react'
import { StatusBadge } from '../ui/Badge'

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso) {
  if (!iso) return 'Recent'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return 'Recent'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return 'Recent'
  }
}

export default function DatasetCard({ dataset }) {
  const navigate = useNavigate()

  if (!dataset) return null

  const name = dataset.name || dataset.original_filename || 'Untitled Dataset'
  const originalFile = dataset.original_filename || name

  return (
    <div
      onClick={() => navigate(`/datasets/${dataset.id}`)}
      className="card p-5 cursor-pointer hover:border-cyan-400/30 hover:-translate-y-0.5 transition-all group"
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-500/20 transition-colors">
          <Database size={18} className="text-brand-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-200 truncate">{name}</h3>
            <StatusBadge status={dataset.status} />
          </div>

          <p className="text-xs text-slate-500 mb-3 truncate">
            {originalFile} · {formatBytes(dataset.file_size_bytes)} · {formatDate(dataset.created_at)}
          </p>

          {/* Stats row */}
          <div className="flex items-center gap-4 text-xs text-slate-500">
            {dataset.row_count != null && (
              <span className="flex items-center gap-1">
                <Rows size={11} />
                {Number(dataset.row_count).toLocaleString()} rows
              </span>
            )}
            {dataset.column_count != null && (
              <span className="flex items-center gap-1">
                <Columns size={11} />
                {dataset.column_count} cols
              </span>
            )}
            <span className="flex items-center gap-1 ml-auto text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity">
              View details <ArrowRight size={11} />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
