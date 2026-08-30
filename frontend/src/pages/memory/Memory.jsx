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
import { PageShell, PageHeader, EmptyState } from '../../components/layout/PageShell'
import { clsx } from 'clsx'

const CATEGORIES = [
  { id: 'all', label: 'All Memories', icon: Brain },
  { id: 'preference', label: 'Preferences', icon: Sparkles },
  { id: 'business_rule', label: 'Business Rules', icon: Tag },
  { id: 'domain_knowledge', label: 'Domain Knowledge', icon: Filter },
  { id: 'context', label: 'Context', icon: Brain },
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
        toast?.show('Memory committed to workspace', 'success')
      }
      setShowAddModal(false)
      setEditingMemory(null)
      setContent('')
      queryClient.invalidateQueries(['memories', activeWorkspace?.id])
    } catch (err) {
      toast?.show(err.response?.data?.detail || 'Failed to persist memory', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this memory item?')) return
    try {
      await memoriesApi.delete(id)
      toast?.show('Memory deleted', 'success')
      queryClient.invalidateQueries(['memories', activeWorkspace?.id])
    } catch (err) {
      toast?.show(err.response?.data?.detail || 'Failed to delete memory', 'error')
    }
  }

  const handleOpenEdit = (mem) => {
    setEditingMemory(mem)
    setContent(mem.content)
    setCategory(mem.category || 'business_rule')
    setShowAddModal(true)
  }

  const filtered = memories.filter(m => {
    if (!m) return false
    const q = searchQuery.toLowerCase()
    return (m.content || '').toLowerCase().includes(q) || (m.category || '').toLowerCase().includes(q)
  })

  if (!activeWorkspace) {
    return (
      <PageShell>
        <PageHeader eyebrow="Workspace" title="Memory Bank" description="Loading workspace context…" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton /><CardSkeleton />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Context Memory"
        title="Workspace Memory Bank"
        description={`Contextual rules, domain constraints, and organizational priors for workspace “${activeWorkspace.name}”.`}
        actions={
          <div className="flex items-center gap-3">
            <IconButton icon={RefreshCw} label="Refresh" onClick={() => refetch()} />
            <Button variant="primary" onClick={() => { setEditingMemory(null); setContent(''); setShowAddModal(true) }}>
              <Plus size={15} />
              <span>Add Memory</span>
            </Button>
          </div>
        }
      />

      {/* Category Pills & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map(c => {
            const Icon = c.icon
            const active = selectedCategory === c.id
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider border transition-all whitespace-nowrap cursor-pointer',
                  active
                    ? 'border-[#d4ff58] bg-[#d4ff58] text-black font-bold'
                    : 'border-white/[0.08] bg-[#0c0c0c] text-[#f2f2ef]/60 hover:text-[#f2f2ef] hover:border-white/[0.2]'
                )}
              >
                <Icon size={12} />
                <span>{c.label}</span>
              </button>
            )
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f2f2ef]/40" />
          <input
            type="text"
            placeholder="Search memory rules…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 text-xs font-mono py-1.5"
          />
        </div>
      </div>

      {/* Memory Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Brain}
          title={searchQuery ? 'No matching memories' : 'Memory bank is empty'}
          description={searchQuery ? `No memory rules match "${searchQuery}".` : 'Add strategic context or business constraints that AI agents must obey during investigations.'}
          action={
            !searchQuery && (
              <Button variant="primary" onClick={() => { setEditingMemory(null); setContent(''); setShowAddModal(true) }}>
                Add First Memory &rarr;
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((mem) => (
            <div
              key={mem.id}
              className="border border-white/[0.08] bg-[#0c0c0c] p-6 flex flex-col justify-between space-y-4 hover:border-white/[0.2] transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                  <span className="font-mono text-[10px] text-[#d4ff58] uppercase tracking-wider px-2 py-0.5 border border-[#d4ff58]/30 bg-[#d4ff58]/10 font-semibold">
                    {mem.category?.replace(/_/g, ' ') || 'RULE'}
                  </span>
                  <span className="font-mono text-[10px] text-[#f2f2ef]/40">
                    {new Date(mem.created_at || Date.now()).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#f2f2ef]/85 leading-relaxed font-sans">
                  {mem.content}
                </p>
              </div>

              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-end gap-2">
                <IconButton icon={Edit3} label="Edit" onClick={() => handleOpenEdit(mem)} />
                <IconButton icon={Trash2} label="Delete" variant="danger" onClick={() => handleDelete(mem.id)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg border border-white/[0.12] bg-[#0c0c0c] p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <h3 className="font-display font-bold text-lg uppercase text-[#f2f2ef]">
                {editingMemory ? 'Edit Memory Rule' : 'Add Context Memory'}
              </h3>
              <IconButton icon={X} label="Close" onClick={() => setShowAddModal(false)} />
            </div>

            <form onSubmit={handleSave} className="space-y-4 font-mono text-xs">
              <div className="space-y-1.5">
                <label className="label">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input bg-[#080808]"
                >
                  <option value="business_rule">Business Rule</option>
                  <option value="preference">User Preference</option>
                  <option value="domain_knowledge">Domain Knowledge</option>
                  <option value="context">Organizational Context</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="label">Memory Content & Context</label>
                <textarea
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="e.g. In Q3, sales reps in the West region were undergoing a compensation migration."
                  className="input resize-none bg-[#080808]"
                  required
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" loading={saving}>
                  {editingMemory ? 'Update Rule' : 'Save Rule'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </PageShell>
  )
}
