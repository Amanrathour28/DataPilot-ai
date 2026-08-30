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
      className="border border-white/[0.08] bg-[#0c0c0c] p-6 cursor-pointer hover:border-white/[0.2] transition-all group space-y-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 border border-white/[0.1] bg-white/[0.02] flex items-center justify-center flex-shrink-0 text-[#f2f2ef]/60 group-hover:text-[#d4ff58] group-hover:border-[#d4ff58]/30 transition-colors">
            <Database size={13} />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-bold text-sm uppercase tracking-tight text-[#f2f2ef] group-hover:text-[#d4ff58] transition-colors truncate">
              {name}
            </h3>
            <p className="font-mono text-[10px] text-[#f2f2ef]/40 truncate mt-0.5">
              {originalFile} &middot; {formatBytes(dataset.file_size_bytes)}
            </p>
          </div>
        </div>
        <StatusBadge status={dataset.status} />
      </div>

      <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between font-mono text-[11px] text-[#f2f2ef]/40">
        <div className="flex items-center gap-3">
          {dataset.row_count != null && (
            <span>{Number(dataset.row_count).toLocaleString()} rows</span>
          )}
          {dataset.column_count != null && (
            <>
              <span>&middot;</span>
              <span>{dataset.column_count} cols</span>
            </>
          )}
        </div>
        <ArrowRight size={13} className="text-[#f2f2ef]/30 group-hover:text-[#d4ff58] group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  )
}
