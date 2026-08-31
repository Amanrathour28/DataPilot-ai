import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Database, RefreshCw, Trash2, AlertCircle,
  Loader2, CheckCircle, Clock, Table, BarChart2
} from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { Skeleton } from '../../components/ui/Skeleton'
import ProfileView from '../../components/datasets/ProfileView'
import DataExplorer from '../../components/datasets/DataExplorer'
import { useToast } from '../../components/ui/Toast'
import { datasetsApi } from '../../services/api'
import { PageShell } from '../../components/layout/PageShell'
import { useState } from 'react'
import { clsx } from 'clsx'

function StatusMessage({ dataset }) {
  if (dataset.status === 'PROFILING') {
    return (
      <div className="flex items-center gap-3 p-4 border border-amber-400/20 bg-amber-400/5 font-mono text-xs text-amber-300">
        <Loader2 size={15} className="animate-spin flex-shrink-0" />
        <div>
          <p className="font-bold uppercase">Profiling in Progress</p>
          <p className="text-[11px] opacity-80 mt-0.5">Analyzing column distributions, null ratios, and statistical variances…</p>
        </div>
      </div>
    )
  }
  if (dataset.status === 'UPLOADED') {
    return (
      <div className="flex items-center gap-3 p-4 border border-sky-400/20 bg-sky-400/5 font-mono text-xs text-sky-300">
        <Clock size={15} className="flex-shrink-0" />
        <div>
          <p className="font-bold uppercase">Profiling Queued</p>
          <p className="text-[11px] opacity-80 mt-0.5">Analysis job queued for Profiler Agent.</p>
        </div>
      </div>
    )
  }
  if (dataset.status === 'ERROR') {
    return (
      <div className="flex items-center gap-3 p-4 border border-[#ff4e4e]/30 bg-[#ff4e4e]/10 font-mono text-xs text-[#ff4e4e]">
        <AlertCircle size={15} className="flex-shrink-0" />
        <div>
          <p className="font-bold uppercase">Profiling Exception</p>
          <p className="text-[11px] opacity-80 mt-0.5">{dataset.error_message || 'An error occurred during dataset analysis.'}</p>
        </div>
      </div>
    )
  }
  return null
}

export default function DatasetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [deleting, setDeleting] = useState(false)
  const [isReprofiling, setIsReprofiling] = useState(false)
  const [activeTab, setActiveTab] = useState('profile') // 'profile' | 'explorer'

  const { data: dataset, isLoading, error, refetch: refetchDataset } = useQuery({
    queryKey: ['dataset', id],
    queryFn: () => datasetsApi.get(id),
    enabled: !!id,
    refetchInterval: (query) => {
      const d = query.state.data
      return d && (d.status === 'PROFILING' || d.status === 'UPLOADING') ? 3000 : false
    },
  })

  const {
    data: profile,
    isLoading: isProfileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ['datasetProfile', id],
    queryFn: () => datasetsApi.profile(id),
    enabled: !!id,
    retry: 1,
    staleTime: 10000,
  })

  const handleReprofile = async () => {
    setIsReprofiling(true)
    try {
      await datasetsApi.reprofile(id)
      toast?.show('Dataset profile recomputed successfully', 'success')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dataset', id] }),
        queryClient.invalidateQueries({ queryKey: ['datasetProfile', id] }),
      ])
    } catch (err) {
      const msg = err.userMessage || err.detail || err.response?.data?.detail || err.message || 'Failed to reprofile dataset'
      toast?.show(msg, 'error')
    } finally {
      setIsReprofiling(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this dataset?')) return
    setDeleting(true)
    try {
      await datasetsApi.delete(id)
      toast?.show('Dataset deleted successfully', 'success')
      queryClient.invalidateQueries({ queryKey: ['datasets'] })
      navigate('/datasets')
    } catch (err) {
      toast?.show('Failed to delete dataset', 'error')
      setDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <PageShell className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </PageShell>
    )
  }

  if (error || !dataset) {
    return (
      <PageShell>
        <div className="p-8 border border-white/[0.08] bg-[#0c0c0c] text-center space-y-3 font-mono text-xs">
          <p className="text-[#ff4e4e]">Failed to load dataset metadata.</p>
          <Button variant="secondary" size="sm" onClick={() => navigate('/datasets')}>
            &larr; Return to Datasets
          </Button>
        </div>
      </PageShell>
    )
  }

  const name = dataset.name || dataset.original_filename || 'Untitled Dataset'

  return (
    <PageShell wide className="space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-white/[0.08]">
        <div className="flex items-start gap-4 min-w-0">
          <IconButton icon={ArrowLeft} label="Back" onClick={() => navigate('/datasets')} className="mt-1" />
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-[#d4ff58] uppercase tracking-widest">
                Dataset / {id.slice(0, 8)}
              </span>
              <StatusBadge status={dataset.status} />
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl uppercase tracking-tight text-[#f2f2ef] truncate">
              {name}
            </h1>
            <p className="font-mono text-xs text-[#f2f2ef]/40">
              {dataset.original_filename} &middot; Ingested {new Date(dataset.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <Button
            variant="secondary"
            size="sm"
            disabled={isReprofiling}
            onClick={handleReprofile}
          >
            <RefreshCw size={13} className={clsx(isReprofiling && 'animate-spin')} />
            <span>{isReprofiling ? 'Profiling…' : 'Reprofile'}</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/investigations/new')}
          >
            Investigate Dataset &rarr;
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={deleting}
            onClick={handleDelete}
          >
            <Trash2 size={13} />
            <span>{deleting ? 'Deleting…' : 'Delete'}</span>
          </Button>
        </div>
      </div>

      <StatusMessage dataset={dataset} />

      {/* Dataset Metadata Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
        <div className="p-4 border border-white/[0.08] bg-[#0c0c0c]">
          <span className="text-[#f2f2ef]/40 uppercase text-[10px] block mb-1">Total Records</span>
          <span className="text-[#f2f2ef] font-bold text-lg">
            {dataset.row_count != null ? dataset.row_count.toLocaleString() : (profile?.quality_report?.total_rows?.toLocaleString() ?? '—')}
          </span>
        </div>

        <div className="p-4 border border-white/[0.08] bg-[#0c0c0c]">
          <span className="text-[#f2f2ef]/40 uppercase text-[10px] block mb-1">Column Attributes</span>
          <span className="text-[#f2f2ef] font-bold text-lg">
            {dataset.column_count != null ? dataset.column_count : (profile?.quality_report?.total_columns ?? profile?.column_profiles?.length ?? '—')}
          </span>
        </div>

        <div className="p-4 border border-white/[0.08] bg-[#0c0c0c]">
          <span className="text-[#f2f2ef]/40 uppercase text-[10px] block mb-1">File Storage</span>
          <span className="text-[#f2f2ef] font-bold text-lg">
            {dataset.file_size_bytes ? `${(dataset.file_size_bytes / 1024).toFixed(1)} KB` : '—'}
          </span>
        </div>

        <div className="p-4 border border-white/[0.08] bg-[#0c0c0c]">
          <span className="text-[#f2f2ef]/40 uppercase text-[10px] block mb-1">DuckDB Profiling</span>
          <span className="text-[#d4ff58] font-bold text-lg uppercase">
            {dataset.status}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-white/[0.08]">
        {[
          { id: 'profile',  label: 'Schema & Profiling Analysis', icon: BarChart2 },
          { id: 'explorer', label: 'Raw Tabular Explorer',        icon: Table },
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-5 py-3 font-mono text-xs uppercase tracking-wider border-b-2 -mb-px transition-all cursor-pointer',
                active
                  ? 'text-[#d4ff58] border-[#d4ff58] font-bold'
                  : 'text-[#f2f2ef]/50 border-transparent hover:text-[#f2f2ef]'
              )}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Panels */}
      {activeTab === 'profile' ? (
        <ProfileView
          profile={profile}
          dataset={dataset}
          isLoading={isProfileLoading}
          error={profileError}
          onReprofile={handleReprofile}
          isReprofiling={isReprofiling}
        />
      ) : (
        <DataExplorer datasetId={dataset.id} />
      )}

    </PageShell>
  )
}
