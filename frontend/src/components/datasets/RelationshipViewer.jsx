import { useQuery } from '@tanstack/react-query'
import { GitMerge, ArrowRight, CheckCircle, Database, Layers, Sparkles } from 'lucide-react'
import { datasetsApi } from '../../services/api'
import { clsx } from 'clsx'

export default function RelationshipViewer({ workspaceId }) {
  const { data: relationships = [], isLoading } = useQuery({
    queryKey: ['dataset-relationships', workspaceId],
    queryFn: () => datasetsApi.relationships(workspaceId),
    enabled: !!workspaceId,
  })

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-slate-500">Discovering dataset relationships…</div>
  }

  if (relationships.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-500 text-xs border border-slate-800">
        <GitMerge size={24} className="mx-auto mb-2 text-slate-600" />
        No cross-dataset join relationships detected yet. Upload at least 2 profiled datasets sharing entity IDs.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <GitMerge size={16} className="text-brand-400" />
            Detected Dataset Relationships & Join Candidates
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated primary/foreign key discovery enabling cross-table multi-agent investigations.
          </p>
        </div>
        <span className="text-xs text-slate-500 font-mono">{relationships.length} relationships</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {relationships.map((rel, idx) => (
          <div key={idx} className="card p-4 border border-slate-800 hover:border-slate-700 transition-all space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 border border-brand-500/20">
                {rel.relationship_type.replace(/_/g, ' ')}
              </span>
              <span className="text-xs font-semibold text-emerald-400">
                {Math.round(rel.confidence_score * 100)}% Confidence
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 p-3 bg-[#111122] rounded-xl border border-slate-800/80 font-mono text-xs">
              <div className="space-y-0.5 truncate">
                <span className="text-[10px] text-slate-500 block">{rel.source_dataset_name}</span>
                <span className="text-slate-200 font-bold">{rel.source_column}</span>
              </div>

              <ArrowRight size={14} className="text-brand-400 flex-shrink-0" />

              <div className="space-y-0.5 truncate text-right">
                <span className="text-[10px] text-slate-500 block">{rel.target_dataset_name}</span>
                <span className="text-slate-200 font-bold">{rel.target_column}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>Value Overlap: <strong className="text-slate-300">{rel.value_overlap_pct}%</strong></span>
              <span>Matched Keys: <strong className="text-slate-300">{rel.intersection_count}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
