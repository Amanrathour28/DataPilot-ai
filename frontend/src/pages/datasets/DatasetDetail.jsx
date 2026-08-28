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
      <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <Loader2 size={16} className="text-amber-400 animate-spin flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-400">Profiling in progress</p>
          <p className="text-xs text-slate-500 mt-0.5">Analyzing column types, statistics, and data quality…</p>
        </div>
      </div>
    )
  }
  if (dataset.status === 'UPLOADED') {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-brand-500/10 border border-brand-500/20">
        <Clock size={16} className="text-brand-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-brand-400">Profiling queued</p>
          <p className="text-xs text-slate-500 mt-0.5">Analysis will begin shortly.</p>
        </div>
      </div>
    )
  }
  if (dataset.status === 'ERROR') {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
        <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-red-400">Profiling failed</p>
          <p className="text-xs text-slate-500 mt-0.5">{dataset.error_message || 'An error occurred during profiling.'}</p>
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
  const [activeTab, setActiveTab] = useState('profile')

  const { data: dataset, isLoading: loadingDs } = useQuery({
    queryKey: ['dataset', id],
    queryFn: () => datasetsApi.get(id),
    refetchInterval: (data) => {
      return ['UPLOADING', 'PROFILING', 'UPLOADED'].includes(data?.status) ? 3000 : false
    },
  })

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['dataset-profile', id],
    queryFn: () => datasetsApi.profile(id),
    enabled: dataset?.status === 'PROFILED',
    retry: false,
  })

  const handleReprofile = async () => {
    await datasetsApi.reprofile(id)
    queryClient.invalidateQueries(['dataset', id])
    queryClient.invalidateQueries(['dataset-profile', id])
    toast?.show('Profiling restarted', 'info')
  }

  const handleDelete = async () => {
    if (!confirm(`Delete dataset "${dataset?.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await datasetsApi.delete(id)
      toast?.show('Dataset deleted', 'success')
      navigate('/datasets')
    } catch {
      toast?.show('Failed to delete dataset', 'error')
      setDeleting(false)
    }
  }

  if (loadingDs) {
    return (
      <PageShell>
        <Skeleton className="h-8 w-48 rounded mb-6" />
        <Skeleton className="h-24 w-full rounded-xl mb-4" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </PageShell>
    )
  }

  if (!dataset) {
    return (
      <PageShell className="text-center">
        <p className="text-slate-500">Dataset not found.</p>
        <Button variant="ghost" onClick={() => navigate('/datasets')} className="mt-3">
          <ArrowLeft size={14} /> Back
        </Button>
      </PageShell>
    )
  }

  return (
    <PageShell className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <IconButton icon={ArrowLeft} label="Back" onClick={() => navigate('/datasets')} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-xl font-bold text-slate-100 truncate">{dataset.name}</h1>
            <StatusBadge status={dataset.status} />
          </div>
          <p className="text-sm text-slate-500">
            {dataset.original_filename} ·{' '}
            {(dataset.file_size_bytes / 1024 / 1024).toFixed(2)} MB ·{' '}
            Uploaded {new Date(dataset.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {dataset.status === 'PROFILED' && (
            <IconButton icon={RefreshCw} label="Re-profile" onClick={handleReprofile} />
          )}
          <IconButton icon={Trash2} label="Delete" onClick={handleDelete} variant="danger" />
        </div>
      </div>

      {/* Status indicator */}
      {dataset.status !== 'PROFILED' && (
        <div>
          <StatusMessage dataset={dataset} />
        </div>
      )}

      {/* Tabs */}
      {dataset.status === 'PROFILED' && (
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('profile')}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all',
              activeTab === 'profile'
                ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            )}
          >
            <BarChart2 size={14} /> Statistical Profile & Insights
          </button>

          <button
            onClick={() => setActiveTab('explorer')}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all',
              activeTab === 'explorer'
                ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            )}
          >
            <Table size={14} /> Data Explorer & SQL Runner
          </button>
        </div>
      )}

      {/* Profile Tab */}
      {dataset.status === 'PROFILED' && activeTab === 'profile' && (
        loadingProfile ? (
          <div className="flex items-center gap-2 text-slate-500 py-8">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading profile…</span>
          </div>
        ) : profile ? (
          <ProfileView profile={profile} />
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-500 text-sm">Profile not available.</p>
            <Button variant="secondary" onClick={handleReprofile} className="mt-3">
              <RefreshCw size={13} /> Run profiling
            </Button>
          </div>
        )
      )}

      {/* Data Explorer Tab */}
      {dataset.status === 'PROFILED' && activeTab === 'explorer' && (
        <DataExplorer datasetId={id} />
      )}
    </PageShell>
  )
}

