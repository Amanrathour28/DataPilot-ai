import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Database, RefreshCw, Grid, List, AlertCircle } from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button'
import { CardSkeleton } from '../../components/ui/Skeleton'
import DatasetCard from '../../components/datasets/DatasetCard'
import UploadDropzone from '../../components/datasets/UploadDropzone'
import RelationshipViewer from '../../components/datasets/RelationshipViewer'
import { useToast } from '../../components/ui/Toast'
import useWorkspaceStore from '../../stores/workspaceStore'
import { datasetsApi } from '../../services/api'
import { StatusBadge } from '../../components/ui/Badge'
import { clsx } from 'clsx'

function EmptyDatasets({ onShowUpload }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#1e1e35] flex items-center justify-center mb-5">
        <Database size={28} className="text-slate-600" />
      </div>
      <h2 className="text-base font-semibold text-slate-200 mb-2">No datasets yet</h2>
      <p className="text-sm text-slate-500 max-w-xs mb-6">
        Upload your first dataset to begin autonomous data investigation.
      </p>
      <Button variant="primary" onClick={onShowUpload}>
        <Plus size={15} /> Upload Dataset
      </Button>
    </div>
  )
}

export default function Datasets() {
  const { activeWorkspace } = useWorkspaceStore()
  const [showUpload, setShowUpload] = useState(false)
  const [search, setSearch]         = useState('')
  const [view, setView]             = useState('grid') // 'grid' | 'list'
  const toast        = useToast()
  const queryClient  = useQueryClient()

  const { data: datasetsRaw = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['datasets', activeWorkspace?.id],
    queryFn: () => datasetsApi.list(activeWorkspace.id),
    enabled: !!activeWorkspace?.id,
    refetchInterval: (data) => {
      const hasPending = Array.isArray(data) && data.some(d => d && ['UPLOADING', 'PROFILING'].includes(d.status))
      return hasPending ? 3000 : false
    },
  })

  const datasets = Array.isArray(datasetsRaw) ? datasetsRaw : []

  const filtered = datasets.filter(d => {
    if (!d) return false
    const nameStr = (d.name || '').toLowerCase()
    const fileStr = (d.original_filename || '').toLowerCase()
    const q = (search || '').toLowerCase()
    return nameStr.includes(q) || fileStr.includes(q)
  })

  const handleUpload = async (file, onProgress) => {
    if (!activeWorkspace) throw new Error('No workspace selected')
    const result = await datasetsApi.upload(activeWorkspace.id, file, onProgress)
    await queryClient.invalidateQueries(['datasets', activeWorkspace.id])
    toast?.show(`${result.name || 'Dataset'} uploaded. Profiling started…`, 'success')
    return result
  }

  if (!activeWorkspace) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-slate-100">Datasets</h1>
            <p className="text-sm text-slate-500 mt-0.5">Loading workspace…</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Datasets</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {datasets.length} dataset{datasets.length !== 1 ? 's' : ''} in workspace &ldquo;{activeWorkspace.name}&rdquo;
          </p>
        </div>
        <div className="flex items-center gap-2">
          <IconButton icon={RefreshCw} label="Refresh" onClick={() => refetch()} size={15} />
          <Button variant="primary" onClick={() => setShowUpload(!showUpload)}>
            <Plus size={15} />
            {showUpload ? 'Cancel' : 'Upload Dataset'}
          </Button>
        </div>
      </div>

      {/* Upload panel */}
      {showUpload && (
        <div className="card p-6 mb-6 animate-slide-up">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Upload Datasets</h2>
          <UploadDropzone onUpload={handleUpload} workspaceId={activeWorkspace.id} />
        </div>
      )}

      {/* Error state alert */}
      {isError && (
        <div className="card p-5 border border-red-500/30 bg-red-500/10 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-red-300">Failed to load datasets</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {error?.response?.data?.detail || error?.message || 'Could not connect to backend server.'}
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            <RefreshCw size={14} /> Retry
          </Button>
        </div>
      )}

      {/* Search + View toggle */}
      {datasets.length > 0 && (
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search datasets…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-1 bg-[#1e1e35] rounded-lg p-1 border border-[#2a2a4a]">
            <button
              onClick={() => setView('grid')}
              className={clsx('p-1.5 rounded transition-colors', view === 'grid' ? 'bg-[#2a2a4a] text-slate-200' : 'text-slate-500')}
            >
              <Grid size={14} />
            </button>
            <button
              onClick={() => setView('list')}
              className={clsx('p-1.5 rounded transition-colors', view === 'list' ? 'bg-[#2a2a4a] text-slate-200' : 'text-slate-500')}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 && datasets.length === 0 ? (
        <EmptyDatasets onShowUpload={() => setShowUpload(true)} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-500 text-sm">No datasets match &ldquo;{search}&rdquo;</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(ds => <DatasetCard key={ds.id} dataset={ds} />)}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Rows</th>
                <th>Columns</th>
                <th>Size</th>
                <th>Status</th>
                <th>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(ds => (
                <tr
                  key={ds.id}
                  onClick={() => window.location.href = `/datasets/${ds.id}`}
                  className="cursor-pointer"
                >
                  <td>
                    <div className="flex items-center gap-2">
                      <Database size={14} className="text-brand-400 flex-shrink-0" />
                      <span className="font-medium text-slate-200">{ds.name}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 pl-5">{ds.original_filename}</p>
                  </td>
                  <td>{ds.row_count?.toLocaleString() ?? '—'}</td>
                  <td>{ds.column_count ?? '—'}</td>
                  <td>{((ds.file_size_bytes || 0) / 1024 / 1024).toFixed(2)} MB</td>
                  <td><StatusBadge status={ds.status} /></td>
                  <td>{ds.created_at ? new Date(ds.created_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dataset Relationships Section */}
      {datasets.length >= 2 && (
        <div className="mt-8 pt-8 border-t border-slate-800">
          <RelationshipViewer workspaceId={activeWorkspace.id} />
        </div>
      )}
    </div>
  )
}
