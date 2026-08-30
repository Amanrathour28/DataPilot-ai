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

export default function Datasets() {
  const { activeWorkspace } = useWorkspaceStore()
  const [showUpload, setShowUpload] = useState(false)
  const [search, setSearch]         = useState('')
  const [view, setView]             = useState('grid')
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
    queryFn: () => datasetsApi.list(activeWorkspace?.id),
    enabled: !!activeWorkspace?.id,
    staleTime: 10000,
    retry: 2,
    refetchInterval: (query) => {
      const data = query?.state?.data || []
      const hasPending = Array.isArray(data) && data.some(d => d && ['UPLOADING', 'PROFILING'].includes(d.status))
      return hasPending ? 4000 : false
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
    if (!activeWorkspace?.id) throw new Error('No workspace selected')
    const result = await datasetsApi.upload(activeWorkspace.id, file, onProgress)
    return result
  }

  const handleBatchComplete = async (uploadResults) => {
    await queryClient.invalidateQueries({ queryKey: ['datasets', activeWorkspace?.id] })
    const successList = uploadResults.filter(r => r.status === 'done')
    const failedList = uploadResults.filter(r => r.status === 'error')

    if (successList.length > 0) {
      toast?.show(`Uploaded ${successList.length} dataset${successList.length > 1 ? 's' : ''}. Profiling started.`, 'success')
    }
    if (failedList.length > 0) {
      toast?.show(`${failedList.length} file${failedList.length > 1 ? 's' : ''} failed to upload.`, 'error')
    }
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

  return (
    <PageShell>
      <PageHeader
        eyebrow="Data Assets"
        title="Datasets"
        description={`${datasets.length} tabular file${datasets.length !== 1 ? 's' : ''} registered in workspace “${activeWorkspace.name}”`}
        actions={
          <div className="flex items-center gap-3">
            <IconButton icon={RefreshCw} label="Refresh" onClick={() => refetch()} />
            <Button variant="primary" onClick={() => setShowUpload(!showUpload)}>
              <Plus size={15} />
              <span>{showUpload ? 'Close Upload' : 'Upload Dataset'}</span>
            </Button>
          </div>
        }
      />

      {/* Upload Drawer / Accordion */}
      {showUpload && (
        <div className="border border-white/[0.1] bg-[#0c0c0c] p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <div>
              <h3 className="font-display font-bold text-base uppercase text-[#f2f2ef]">
                Upload CSV / Parquet File
              </h3>
              <p className="font-mono text-xs text-[#f2f2ef]/40 mt-0.5">
                DataPilot will ingest, parse schemas, and compute statistical profiles
              </p>
            </div>
            <button
              onClick={() => setShowUpload(false)}
              className="font-mono text-xs text-[#f2f2ef]/40 hover:text-white cursor-pointer"
            >
              [Close]
            </button>
          </div>
          <UploadDropzone onUpload={handleUpload} onComplete={handleBatchComplete} />
        </div>
      )}

      {/* Controls Bar: Search & View Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {datasets.length > 0 && (
          <div className="relative max-w-lg flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#f2f2ef]/40" />
            <input
              type="text"
              placeholder="Search datasets by name or filename…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 text-xs font-mono"
            />
          </div>
        )}

        <div className="flex items-center gap-2 self-end sm:self-center">
          <div className="border border-white/[0.08] p-0.5 flex items-center bg-[#0c0c0c]">
            <button
              onClick={() => setView('grid')}
              className={clsx('p-1.5 cursor-pointer transition-colors', view === 'grid' ? 'bg-white/[0.1] text-[#d4ff58]' : 'text-[#f2f2ef]/40 hover:text-[#f2f2ef]')}
              title="Grid View"
            >
              <Grid size={14} />
            </button>
            <button
              onClick={() => setView('list')}
              className={clsx('p-1.5 cursor-pointer transition-colors', view === 'list' ? 'bg-white/[0.1] text-[#d4ff58]' : 'text-[#f2f2ef]/40 hover:text-[#f2f2ef]')}
              title="List View"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Database}
          title={search ? 'No matching datasets' : 'No datasets yet'}
          description={search ? `No results found for "${search}".` : 'Upload your first CSV dataset to begin autonomous multi-agent analysis.'}
          action={
            !search && (
              <Button variant="primary" onClick={() => setShowUpload(true)}>
                Upload Dataset &rarr;
              </Button>
            )
          }
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(d => <DatasetCard key={d.id} dataset={d} />)}
        </div>
      ) : (
        <div className="border border-white/[0.08] bg-[#0c0c0c] divide-y divide-white/[0.06]">
          {filtered.map(d => (
            <div
              key={d.id}
              onClick={() => navigate(`/datasets/${d.id}`)}
              className="p-5 flex items-center justify-between gap-4 hover:bg-white/[0.01] transition-colors cursor-pointer group"
            >
              <div className="min-w-0 space-y-1">
                <h4 className="font-display font-bold text-sm uppercase tracking-tight text-[#f2f2ef] group-hover:text-[#d4ff58] transition-colors truncate">
                  {d.name || d.original_filename}
                </h4>
                <p className="font-mono text-[10px] text-[#f2f2ef]/40">
                  {d.row_count ? `${d.row_count.toLocaleString()} rows` : '0 rows'} &middot; {d.column_count || 0} cols
                </p>
              </div>
              <div className="flex items-center gap-4">
                <StatusBadge status={d.status} />
                <span className="font-mono text-xs text-[#d4ff58] opacity-0 group-hover:opacity-100 transition-opacity">
                  Inspect &rarr;
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  )
}
