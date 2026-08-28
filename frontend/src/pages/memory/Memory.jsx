import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Brain, Plus, Search, Trash2, Edit3, CheckCircle2, XCircle,
  Tag, Sparkles, Filter, RefreshCw, AlertCircle, Eye, Check, X
} from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import useWorkspaceStore from '../../stores/workspaceStore'
import { memoriesApi } from '../../services/api'
import { clsx } from 'clsx'

const CATEGORIES = [
  { id: 'all', label: 'All Memories', icon: Brain, color: 'text-brand-400' },
  { id: 'preference', label: 'Preferences', icon: Sparkles, color: 'text-amber-400' },
  { id: 'business_rule', label: 'Business Rules', icon: Tag, color: 'text-emerald-400' },
  { id: 'domain_knowledge', label: 'Domain Knowledge', icon: Filter, color: 'text-purple-400' },
  { id: 'context', label: 'Context', icon: Brain, color: 'text-blue-400' },
]

export default function Memory() {
  const { activeWorkspace } = useWorkspaceStore()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingMemory, setEditingMemory] = useState(null)

  // Form State
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('business_rule')
  const [saving, setSaving] = useState(false)

  // Query Memories
  const { data: memoriesRaw = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['memories', activeWorkspace?.id, selectedCategory],
    queryFn: () => memoriesApi.list(
      activeWorkspace.id,
      selectedCategory === 'all' ? null : selectedCategory
    ),
    enabled: !!activeWorkspace?.id,
  })

  const memories = Array.isArray(memoriesRaw) ? memoriesRaw : []

  // Create / Update Memory
  const handleSave = async (e) => {
    e.preventDefault()
    if (!content.trim() || !activeWorkspace) return

    setSaving(true)
    try {
      if (editingMemory) {
        await memoriesApi.update(editingMemory.id, { content, category })
        toast?.show('Memory updated successfully', 'success')
      } else {
        await memoriesApi.create(activeWorkspace.id, { content, category })
        toast?.show('Memory created successfully', 'success')
      }
      setShowAddModal(false)
      setEditingMemory(null)
      setContent('')
      queryClient.invalidateQueries(['memories', activeWorkspace.id])
    } catch (err) {
      toast?.show(err.response?.data?.detail || 'Failed to save memory', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Toggle active status
  const handleToggleActive = async (mem) => {
    try {
      await memoriesApi.update(mem.id, { is_active: !mem.is_active })
      queryClient.invalidateQueries(['memories', activeWorkspace.id])
      toast?.show(mem.is_active ? 'Memory deactivated' : 'Memory activated', 'info')
    } catch {
      toast?.show('Failed to toggle memory status', 'error')
    }
  }

  // Delete Memory
  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this memory item?')) return
    try {
      await memoriesApi.delete(id)
      queryClient.invalidateQueries(['memories', activeWorkspace.id])
      toast?.show('Memory removed', 'success')
    } catch {
      toast?.show('Failed to delete memory', 'error')
    }
  }

  const openEdit = (mem) => {
    setEditingMemory(mem)
    setContent(mem.content || '')
    setCategory(mem.category || 'business_rule')
    setShowAddModal(true)
  }

  const filteredMemories = memories.filter(m => {
    if (!m) return false
    const contentStr = (m.content || '').toLowerCase()
    const catStr = (m.category || '').toLowerCase()
    const q = (searchQuery || '').toLowerCase()
    return contentStr.includes(q) || catStr.includes(q)
  })

  if (!activeWorkspace) {
    return (
      <div className="page-shell space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Workspace Memory</h1>
            <p className="text-xs text-slate-500 mt-1">Loading workspace context…</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton /><CardSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="text-brand-400" size={24} />
            <h1 className="text-2xl font-bold text-slate-100">Workspace Memory</h1>
          </div>
          <p className="text-sm text-slate-400">
            Explicit business context and learned domain rules utilized by agents during data investigations in &ldquo;{activeWorkspace.name}&rdquo;.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setEditingMemory(null)
            setContent('')
            setCategory('business_rule')
            setShowAddModal(true)
          }}
        >
          <Plus size={16} /> Add Memory
        </Button>
      </div>

      {/* Error state alert */}
      {isError && (
        <div className="card p-5 border border-red-500/30 bg-red-500/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-red-300">Failed to load memories</h3>
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

      {/* Category Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon
            const active = selectedCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                  active
                    ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                    : 'bg-[#161626] text-slate-400 hover:text-slate-200 border border-slate-800'
                )}
              >
                <Icon size={14} className={cat.color} />
                {cat.label}
              </button>
            )
          })}
        </div>

        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#161626] border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Memory List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : filteredMemories.length === 0 ? (
        <div className="card text-center py-16 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-400 mb-3">
            <Brain size={24} />
          </div>
          <h3 className="text-base font-semibold text-slate-200 mb-1">No Memories Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mb-4">
            {searchQuery
              ? 'No memories matched your search keywords.'
              : 'Add business terminology, target KPI thresholds, or domain rules for agents to reference.'}
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setEditingMemory(null)
              setContent('')
              setShowAddModal(true)
            }}
          >
            <Plus size={14} /> Create First Memory
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMemories.map(mem => (
            <div
              key={mem.id}
              className={clsx(
                'card p-5 flex flex-col justify-between transition-all group border',
                mem.is_active ? 'border-slate-800/80 hover:border-slate-700' : 'opacity-60 border-slate-900'
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className={clsx(
                    'px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wider',
                    mem.category === 'preference' && 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
                    mem.category === 'business_rule' && 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
                    mem.category === 'domain_knowledge' && 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
                    mem.category === 'context' && 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
                  )}>
                    {(mem.category || 'general').replace('_', ' ')}
                  </span>

                  <button
                    onClick={() => handleToggleActive(mem)}
                    title={mem.is_active ? 'Active in agent investigations' : 'Inactive'}
                    className={clsx(
                      'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors',
                      mem.is_active
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-slate-800 border-slate-700 text-slate-500'
                    )}
                  >
                    {mem.is_active ? (
                      <><CheckCircle2 size={12} /> Active</>
                    ) : (
                      <><XCircle size={12} /> Inactive</>
                    )}
                  </button>
                </div>

                <p className="text-sm text-slate-200 leading-relaxed font-normal whitespace-pre-wrap">
                  {mem.content}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800/60 text-xs text-slate-500">
                <span>Updated {mem.updated_at || mem.created_at ? new Date(mem.updated_at || mem.created_at).toLocaleDateString() : '—'}</span>
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(mem)}
                    className="p-1 hover:text-brand-400 text-slate-400 transition-colors"
                    title="Edit Memory"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(mem.id)}
                    className="p-1 hover:text-red-400 text-slate-400 transition-colors"
                    title="Delete Memory"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-lg p-6 space-y-4 border border-slate-700 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Brain size={18} className="text-brand-400" />
                {editingMemory ? 'Edit Memory' : 'Add Domain Context / Rule'}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#111122] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="business_rule">Business Rule (e.g. "Fiscal year starts in April")</option>
                  <option value="domain_knowledge">Domain Knowledge (e.g. "Churn is defined as 60d no-activity")</option>
                  <option value="preference">User Preference (e.g. "Prefer weekly cohort charts")</option>
                  <option value="context">General Context</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Memory Rule / Insight Content
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. 'Discount rates above 25% require VP approval and usually cause margin compression in EMEA.'"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-[#111122] border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : (editingMemory ? 'Update Memory' : 'Save Memory')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
