import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Database, RefreshCw, Grid, List, AlertCircle, Loader2 } from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button'
import { CardSkeleton } from '../../components/ui/Skeleton'
import DatasetCard from '../../components/datasets/DatasetCard'
import UploadDropzone from '../../components/datasets/UploadDropzone'
import RelationshipViewer from '../../components/datasets/RelationshipViewer'
import { useToast } from '../../components/ui/Toast'
import { PageShell, PageHeader, EmptyState } from '../../components/layout/PageShell'
import useWorkspaceStore from '../../stores/workspaceStore'
import { datasetsApi } from '../../services/api'
import { StatusBadge } from '../../components/ui/Badge'
import { clsx } from 'clsx'

function EmptyDatasets({ onShowUpload }) {
  return (
    <EmptyState
      icon={Database}
      title="No datasets yet"
      description="Upload your first dataset to begin autonomous data investigation."
      action={
        <Button variant="primary" onClick={onShowUpload}>
          <Plus size={15} /> Upload Dataset
        </Button>
      }
    />
  )
}

export default function Datasets() {
  const { activeWorkspace } = useWorkspaceStore()
  const [showUpload, setShowUpload] = useState(false)
  const [search, setSearch]         = useState('')
  const [view, setView]             = useState('grid') // 'grid' | 'list'
  const toast        = useToast()
  const queryClient  = useQueryClient()
  const navigate     = useNavigate()

  const {
    data: datasetsRaw = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
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
      <PageShell>
        <PageHeader eyebrow="Workspace" title="Datasets" description="Loading workspace…" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
      </PageShell>
    )
  }

  const pageDescription = isLoading
    ? 'Loading datasets…'
    : isError
    ? 'Error connecting to dataset service'
    : `${datasets.length} dataset${datasets.length !== 1 ? 's' : ''} in “${activeWorkspace.name}”`

  return (
    <PageShell>
      <PageHeader
        eyebrow="Workspace"
        title="Datasets"
        description={pageDescription}
        actions={
          <div className="flex items-center gap-2">
            <IconButton
              icon={RefreshCw}
              label="Refresh"
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
              className={clsx((isLoading || isRefetching) && 'animate-spin')}
              size={15}
            />
            <Button variant="primary" onClick={() => setShowUpload(!showUpload)}>
              <Plus size={15} />
              {showUpload ? 'Cancel' : 'Upload Dataset'}
            </Button>
          </div>
        }
      />

      {/* Upload panel */}
      {showUpload && (
        <div className="card p-6 mb-6 animate-slide-up">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Upload Datasets</h2>
          <UploadDropzone onUpload={handleUpload} workspaceId={activeWorkspace.id} />
        </div>
      )}

      {/* Search + View toggle (shown only when datasets exist and not in error state) */}
      {!isError && datasets.length > 0 && (
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
          <div className="flex items-center gap-1 bg-white/[0.04] rounded-xl p-1 border border-white/[0.08]">
            <button
              onClick={() => setView('grid')}
              className={clsx('p-1.5 rounded transition-colors', view === 'grid' ? 'bg-[#2a2a4a] text-slate-200' : 'text-slate-500')}
              title="Grid View"
            >
              <Grid size={14} />
            </button>
            <button
              onClick={() => setView('list')}
              className={clsx('p-1.5 rounded transition-colors', view === 'list' ? 'bg-[#2a2a4a] text-slate-200' : 'text-slate-500')}
              title="List View"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Content Rendering: Clean State Separation */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <div className="card p-12 text-center space-y-4 border border-rose-500/30 bg-rose-500/5 rounded-2xl shadow-xl">
          <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle size={28} />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-sm font-bold text-slate-100">Failed to Load Datasets</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              {error?.response?.data?.detail || error?.message || 'Could not connect to the backend server. Please verify your connection or retry.'}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            <RefreshCw size={13} /> Retry Loading Datasets
          </Button>
        </div>
      ) : datasets.length === 0 ? (
        <EmptyDatasets onShowUpload={() => setShowUpload(true)} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 card border border-slate-800/80 rounded-2xl">
          <p className="text-slate-400 text-sm">No datasets match &ldquo;{search}&rdquo;</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(ds => <DatasetCard key={ds.id} dataset={ds} />)}
        </div>
      ) : (
        <div className="card overflow-hidden border border-slate-800 rounded-2xl bg-[#0e0e1a]">
          <table className="data-table w-full text-left text-xs border-collapse">
            <thead className="bg-[#141426] border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
              <tr>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Rows</th>
                <th className="py-3 px-4">Columns</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Uploaded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filtered.map(ds => (
                <tr
                  key={ds.id}
                  onClick={() => navigate(`/datasets/${ds.id}`)}
                  className="cursor-pointer hover:bg-slate-800/30 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Database size={14} className="text-brand-400 flex-shrink-0" />
                      <span className="font-medium text-slate-200">{ds.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 pl-5 font-mono">{ds.original_filename}</p>
                  </td>
                  <td className="py-3 px-4 font-mono">{ds.row_count?.toLocaleString() ?? '—'}</td>
                  <td className="py-3 px-4 font-mono">{ds.column_count ?? '—'}</td>
                  <td className="py-3 px-4 font-mono">{((ds.file_size_bytes || 0) / 1024 / 1024).toFixed(2)} MB</td>
                  <td className="py-3 px-4"><StatusBadge status={ds.status} /></td>
                  <td className="py-3 px-4 text-slate-400">{ds.created_at ? new Date(ds.created_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dataset Relationships Section */}
      {!isError && datasets.length >= 2 && (
        <div className="mt-8 pt-8 border-t border-white/[0.06]">
          <RelationshipViewer workspaceId={activeWorkspace.id} />
        </div>
      )}
    </PageShell>
  )
}
