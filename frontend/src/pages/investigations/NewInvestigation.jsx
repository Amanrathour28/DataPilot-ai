import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Play, AlertTriangle, Sparkles, Database, FileText } from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { PageShell } from '../../components/layout/PageShell'
import useWorkspaceStore from '../../stores/workspaceStore'
import { datasetsApi, investigationsApi } from '../../services/api'
import { useToast } from '../../components/ui/Toast'

const SUGGESTED_PROMPTS = [
  {
    title: 'Analyze Q3 revenue drop',
    desc: 'Investigate sales segments, average transaction values, and regional drops.',
    prompt: 'Why did our revenue decline in Q3? Analyze regional trends and customer transaction values.',
  },
  {
    title: 'Profile customer churn',
    desc: 'Understand retention rate fluctuations and identify key churn cohorts.',
    prompt: 'Identify the primary drivers of customer churn. Segment active vs churned user counts.',
  },
  {
    title: 'Evaluate marketing lead conversion',
    desc: 'Compare campaign budgets against generated sales volume.',
    prompt: 'How did marketing campaign spend affect sales conversions across product categories?',
  }
]

export default function NewInvestigation() {
  const navigate = useNavigate()
  const toast = useToast()
  const { activeWorkspace } = useWorkspaceStore()
  const [objective, setObjective] = useState('')
  const [loading, setLoading] = useState(false)

  // Fetch datasets to ensure at least one profiled dataset exists
  const { data: datasets = [], isLoading } = useQuery({
    queryKey: ['datasets', activeWorkspace?.id],
    queryFn: () => datasetsApi.list(activeWorkspace.id),
    enabled: !!activeWorkspace?.id,
  })

  const profiledDatasets = datasets.filter(d => d.status === 'PROFILED')

  const handleLaunch = async (e) => {
    e.preventDefault()
    if (loading) return
    if (!objective.trim()) return
    if (profiledDatasets.length === 0) {
      toast?.show('Please upload and profile a dataset first.', 'error')
      return
    }

    if (!activeWorkspace?.id) {
      toast?.show('Failed to start investigation: 400 - No active workspace selected.', 'error')
      return
    }

    setLoading(true)
    try {
      const result = await investigationsApi.create(activeWorkspace.id, {
        objective: objective.trim(),
        workspace_id: activeWorkspace.id,
      })
      toast?.show('AI Agents launched successfully', 'success')
      navigate(`/investigations/${result.id}`)
    } catch (err) {
      const status = err.response?.status
      const data = err.response?.data
      let detailMsg = 'Failed to start investigation'

      if (typeof data?.detail === 'string') {
        detailMsg = data.detail
      } else if (Array.isArray(data?.detail)) {
        detailMsg = data.detail.map(d => `${d.loc ? d.loc.slice(-1)[0] + ': ' : ''}${d.msg}`).join(', ')
      } else if (data?.message) {
        detailMsg = data.message
      } else if (err.message) {
        detailMsg = err.message
      }

      const fullError = status ? `Failed to start investigation: ${status} - ${detailMsg}` : `Failed to start investigation: ${detailMsg}`
      console.error('Investigation creation failed', {
        status,
        response: data,
        payload: { workspace_id: activeWorkspace.id, objective: objective.trim() },
        error: err
      })
      toast?.show(fullError, 'error')
      setLoading(false)
    }
  }

  if (!activeWorkspace) {
    return (
      <PageShell>
        <p className="text-slate-500 text-sm">Select a workspace to start an investigation.</p>
      </PageShell>
    )
  }

  return (
    <PageShell className="max-w-3xl">
      {/* Back Header */}
      <div className="flex items-center gap-3 mb-8">
        <IconButton icon={ArrowLeft} label="Back" onClick={() => navigate('/investigations')} />
        <div>
          <h1 className="text-xl font-bold text-slate-100">Start Investigation</h1>
          <p className="text-sm text-slate-500 mt-0.5">Define your goal and deploy specialized data agents</p>
        </div>
      </div>

      {isLoading ? (
        <CardSkeleton />
      ) : profiledDatasets.length === 0 ? (
        <div className="card p-6 border-red-500/20 bg-red-500/5 mb-6 text-center space-y-4">
          <AlertTriangle size={32} className="mx-auto text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-200">No profiled datasets available</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Investigations require structured data. Please upload a dataset on the Datasets page and wait for profiling to complete before running investigations.
          </p>
          <Button variant="primary" onClick={() => navigate('/datasets')} className="mx-auto">
            Go to Datasets
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active datasets info */}
          <div className="card p-4 flex items-center justify-between border-emerald-500/15 bg-emerald-500/5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Database size={16} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-300">Data Sources Active</p>
                <p className="text-xs text-slate-500">{profiledDatasets.length} profiled dataset(s) will be analyzed</p>
              </div>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Ready
            </span>
          </div>

          <form onSubmit={handleLaunch} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400">
                What would you like the agents to investigate?
              </label>
              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Ask a question (e.g. Why did our Q3 revenue decline? Segment sales by product category...)"
                rows={4}
                className="input text-sm p-4 leading-relaxed"
                required
              />
            </div>

            {/* Suggestions */}
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                Suggested Scenarios
              </p>
              <div className="grid grid-cols-1 gap-3">
                {SUGGESTED_PROMPTS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setObjective(item.prompt)}
                    className="card p-3.5 text-left hover:border-brand-500/35 hover:bg-[#1b1b36] transition-all group flex items-start justify-between"
                  >
                    <div className="pr-4">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Sparkles size={12} className="text-brand-400" />
                        <h4 className="text-xs font-semibold text-slate-200 group-hover:text-brand-400 transition-colors">
                          {item.title}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 leading-normal">{item.desc}</p>
                    </div>
                    <Play size={12} className="text-slate-600 mt-1 opacity-0 group-hover:opacity-100 group-hover:text-brand-400 transition-all transform group-hover:translate-x-1" />
                  </button>
                ))}
              </div>
            </div>

            {/* Launch button */}
            <div className="pt-2">
              <Button
                variant="primary"
                type="submit"
                loading={loading}
                className="w-full justify-center text-sm py-2.5"
              >
                <Sparkles size={14} className="animate-pulse" /> Launch AI Investigation Team
              </Button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  )
}
