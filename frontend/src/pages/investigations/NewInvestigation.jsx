import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Play, Sparkles, Database, FileText, Loader2, AlertCircle } from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { PageShell } from '../../components/layout/PageShell'
import useWorkspaceStore from '../../stores/workspaceStore'
import { datasetsApi, investigationsApi } from '../../services/api'
import { useToast } from '../../components/ui/Toast'

const SUGGESTED_PROMPTS = [
  {
    title: 'Analyze Q3 revenue drop',
    desc: 'Investigate sales cohorts, regional contribution, and transaction delta.',
    prompt: 'Why did our revenue decline in Q3? Analyze regional trends and customer transaction values.',
  },
  {
    title: 'Profile customer churn',
    desc: 'Understand retention rate fluctuations and identify key churn cohorts.',
    prompt: 'Identify the primary drivers of customer churn. Segment active vs churned user counts.',
  },
  {
    title: 'Evaluate marketing conversion',
    desc: 'Compare campaign spend against generated sales volume across regions.',
    prompt: 'How did marketing campaign spend affect sales conversions across product categories?',
  }
]

export default function NewInvestigation() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const toast = useToast()
  const { activeWorkspace } = useWorkspaceStore()
  const [objective, setObjective] = useState(searchParams.get('prompt') || '')
  const parentId = searchParams.get('parent_id') || null
  const [selectedDatasetId, setSelectedDatasetId] = useState('')
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
    const isGeneralQuery = /what is|how should i|explain|give me.*ideas|brainstorm|difference between/i.test(objective)
    if (profiledDatasets.length === 0 && !isGeneralQuery && !selectedDatasetId) {
      toast?.show('Tip: Upload a dataset for empirical calculations, or ask general conceptual/strategic questions.', 'info')
    }

    if (!activeWorkspace?.id) {
      toast?.show('No active workspace selected. Please select a workspace first.', 'error')
      return
    }

    setLoading(true)
    try {
      const payload = {
        objective: objective.trim(),
        workspace_id: activeWorkspace.id,
      }
      if (parentId) {
        payload.parent_id = parentId
      }
      if (selectedDatasetId) {
        payload.dataset_id = selectedDatasetId
        payload.dataset_ids = [selectedDatasetId]
      }
      const result = await investigationsApi.create(activeWorkspace.id, payload)
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

      const fullError = status ? `Investigation initiation failed: ${detailMsg}` : `Investigation initiation failed: ${detailMsg}`
      console.warn('Investigation error:', err)
      toast?.show(fullError, 'error')
      setLoading(false)
    }
  }

  if (!activeWorkspace) {
    return (
      <PageShell>
        <p className="font-mono text-xs text-[#f2f2ef]/50">Select a workspace to start an investigation.</p>
      </PageShell>
    )
  }

  return (
    <PageShell className="max-w-4xl">
      
      {/* Top Header */}
      <div className="flex items-center justify-between pb-6 border-b border-white/[0.08]">
        <div className="flex items-center gap-4">
          <IconButton icon={ArrowLeft} label="Back" onClick={() => navigate('/investigations')} />
          <div>
            <div className="editorial-label m-0">
              <span className="num">/</span>
              <span>New Task</span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl uppercase tracking-tight text-[#f2f2ef]">
              Deploy Investigation
            </h1>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <CardSkeleton /><CardSkeleton />
        </div>
      ) : (
        <form onSubmit={handleLaunch} className="space-y-10">
          
          {/* Main Question Studio */}
          <div className="border border-white/[0.08] bg-[#0c0c0c] p-6 sm:p-10 space-y-6">
            <div>
              <span className="font-mono text-xs text-[#d4ff58] uppercase tracking-widest block mb-2">
                Step 01 / Objective
              </span>
              <h2 className="font-display font-extrabold text-2xl sm:text-3xl uppercase tracking-tight text-[#f2f2ef]">
                What Do You Want To Investigate<span className="text-[#d4ff58]">?</span>
              </h2>
              <p className="text-xs sm:text-sm text-[#f2f2ef]/50 font-sans mt-1">
                Ask a natural business question. DataPilot will determine the multi-agent investigation path.
              </p>
            </div>

            <div className="space-y-2">
              <textarea
                rows={4}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="e.g. Why did revenue decline in Q3? Analyze regional sales trends, conversion drops, and marketing budget changes."
                className="input text-base sm:text-lg leading-relaxed p-4 resize-none bg-[#080808]"
                autoFocus
                disabled={loading}
              />
              <span className="font-mono text-[10px] text-[#f2f2ef]/40 block text-right">
                Natural Language &middot; Auto-Parsed by Supervisor Agent
              </span>
            </div>

            {/* Prompt Starter Chips */}
            <div className="pt-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#f2f2ef]/40 block mb-3">
                Suggested Prompts
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p.title}
                    type="button"
                    onClick={() => setObjective(p.prompt)}
                    className="p-3 border border-white/[0.06] bg-[#080808] hover:border-[#d4ff58]/40 hover:bg-white/[0.02] text-left transition-all cursor-pointer group"
                  >
                    <span className="font-display font-bold text-xs uppercase tracking-tight text-[#f2f2ef] group-hover:text-[#d4ff58] block transition-colors">
                      {p.title}
                    </span>
                    <span className="text-[11px] text-[#f2f2ef]/50 font-sans mt-1 block leading-normal line-clamp-2">
                      {p.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dataset & Document Context Selection */}
          <div className="border border-white/[0.08] bg-[#0c0c0c] p-6 sm:p-10 space-y-6">
            <div>
              <span className="font-mono text-xs text-[#d4ff58] uppercase tracking-widest block mb-2">
                Step 02 / Data Context
              </span>
              <h3 className="font-display font-extrabold text-xl sm:text-2xl uppercase tracking-tight text-[#f2f2ef]">
                Select Primary Dataset
              </h3>
              <p className="text-xs text-[#f2f2ef]/50 font-sans mt-1">
                Attach a profiled tabular dataset for sandboxed Python and statistical analysis.
              </p>
            </div>

            {profiledDatasets.length === 0 ? (
              <div className="p-6 border border-amber-400/20 bg-amber-400/5 text-amber-300 text-xs font-mono flex items-center justify-between gap-4">
                <span>No profiled datasets available in this workspace. Upload a CSV first.</span>
                <Button variant="secondary" size="sm" onClick={() => navigate('/datasets')}>
                  Upload Dataset
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {profiledDatasets.map((d) => {
                  const isSelected = selectedDatasetId === d.id
                  return (
                    <div
                      key={d.id}
                      onClick={() => setSelectedDatasetId(isSelected ? '' : d.id)}
                      className={`p-4 border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#d4ff58] bg-[#d4ff58]/5'
                          : 'border-white/[0.06] bg-[#080808] hover:border-white/[0.2]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-[#f2f2ef] truncate">
                          {d.original_filename || d.name}
                        </span>
                        {isSelected && (
                          <span className="font-mono text-[10px] text-[#d4ff58] font-bold uppercase">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[10px] text-[#f2f2ef]/40 mt-2 flex items-center gap-3">
                        <span>{d.row_count ? `${d.row_count.toLocaleString()} rows` : 'Table'}</span>
                        <span>&middot;</span>
                        <span>{d.column_count ? `${d.column_count} columns` : 'Profiled'}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Action Launch Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/[0.08]">
            <span className="font-mono text-xs text-[#f2f2ef]/40">
              {profiledDatasets.length > 0
                ? 'Ready to deploy 7 autonomous data agents'
                : 'Dataset profiling required before launch'}
            </span>

            <button
              type="submit"
              disabled={loading || !objective.trim() || profiledDatasets.length === 0}
              className="btn-dn-primary py-4 px-8 flex items-center gap-2 group cursor-pointer w-full sm:w-auto justify-center"
            >
              <span>{loading ? 'Launching Agents…' : 'Start Investigation'}</span>
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              )}
            </button>
          </div>

        </form>
      )}

    </PageShell>
  )
}
