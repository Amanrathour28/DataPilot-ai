import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FileText, UploadCloud, Search, Trash2, Plus, RefreshCw, CheckCircle2,
  Clock, AlertCircle, Sparkles, Layers, BookOpen, ExternalLink, X
} from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import useWorkspaceStore from '../../stores/workspaceStore'
import { documentsApi } from '../../services/api'
import { clsx } from 'clsx'

export default function Knowledge() {
  const { activeWorkspace } = useWorkspaceStore()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState(null)

  // Fetch documents list
  const { data: documentsRaw = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['documents', activeWorkspace?.id],
    queryFn: () => documentsApi.list(activeWorkspace.id),
    enabled: !!activeWorkspace?.id,
    refetchInterval: (data, query) => {
      if (query?.state?.error) return false
      const hasPending = Array.isArray(data) && data.some(d => d && ['UPLOADED', 'PROCESSING'].includes(d.status))
      return hasPending ? 3000 : false
    }
  })

  const documents = Array.isArray(documentsRaw) ? documentsRaw : []

  // Handle file drop/selection
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !activeWorkspace) return

    setUploading(true)
    try {
      await documentsApi.upload(activeWorkspace.id, file)
      toast?.show(`${file.name} uploaded. Indexing chunks…`, 'success')
      setShowUpload(false)
      await queryClient.invalidateQueries(['documents', activeWorkspace.id])
    } catch (err) {
      toast?.show(err.response?.data?.detail || 'Failed to upload document', 'error')
    } finally {
      setUploading(false)
    }
  }

  // Handle semantic search query
  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim() || !activeWorkspace) return

    setIsSearching(true)
    try {
      const results = await documentsApi.search(activeWorkspace.id, searchQuery)
      setSearchResults(Array.isArray(results?.results) ? results.results : Array.isArray(results) ? results : [])
      toast?.show(`Found ${Array.isArray(results?.results) ? results.results.length : 0} semantic matches`, 'info')
    } catch (err) {
      toast?.show(err.response?.data?.detail || 'Semantic search failed', 'error')
    } finally {
      setIsSearching(false)
    }
  }

  const handleDelete = async (docId, title) => {
    if (!confirm(`Delete "${title}" and all associated semantic vector chunks?`)) return
    try {
      await documentsApi.delete(docId)
      toast?.show(`Deleted "${title}"`, 'success')
      queryClient.invalidateQueries(['documents', activeWorkspace?.id])
    } catch (err) {
      toast?.show(err.response?.data?.detail || 'Failed to delete document', 'error')
    }
  }

  const handleInspect = async (docId) => {
    try {
      const doc = await documentsApi.get(docId)
      setSelectedDoc(doc)
    } catch (err) {
      toast?.show('Could not fetch document details', 'error')
    }
  }

  if (!activeWorkspace) {
    return (
      <div className="page-shell space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Knowledge Base</h1>
            <p className="text-xs text-slate-500 mt-1">Loading workspace context…</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CardSkeleton /><CardSkeleton /><CardSkeleton />
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
            <BookOpen className="text-brand-400" size={24} />
            <h1 className="text-2xl font-bold text-slate-100">Knowledge Base & RAG Index</h1>
          </div>
          <p className="text-xs text-slate-400">
            Domain context, SLAs, and policy documents ingested into vector index for autonomous multi-agent retrieval.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <IconButton icon={RefreshCw} label="Refresh List" onClick={() => refetch()} size={15} />
          <Button variant="primary" onClick={() => setShowUpload(!showUpload)}>
            <Plus size={15} />
            {showUpload ? 'Cancel' : 'Upload Document'}
          </Button>
        </div>
      </div>

      {/* Error state alert */}
      {isError && (
        <div className="card p-5 border border-red-500/30 bg-red-500/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-red-300">Failed to load documents</h3>
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

      {/* Upload Drawer / Card */}
      {showUpload && (
        <div className="card p-6 border-dashed border-[#333366] bg-[#121226] animate-slide-up space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Upload Business Document</h2>
            <IconButton icon={X} label="Close" onClick={() => setShowUpload(false)} />
          </div>

          <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[#2a2a52] rounded-xl hover:border-brand-500/50 cursor-pointer bg-[#0c0c1a] transition-all group">
            <UploadCloud size={32} className="text-slate-500 group-hover:text-brand-400 mb-2 transition-colors" />
            <p className="text-xs font-semibold text-slate-300">Click to upload or drag and drop</p>
            <p className="text-[11px] text-slate-500 mt-1">PDF, TXT, MD, DOCX, JSON (Max 50MB)</p>
            <input
              type="file"
              onChange={handleFileUpload}
              accept=".pdf,.txt,.md,.docx,.json"
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
      )}

      {/* Semantic Search Sandbox */}
      <div className="card p-5 space-y-4 bg-[#111122]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-brand-400" />
            <h2 className="text-sm font-semibold text-slate-200">RAG Semantic Search Test</h2>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Vector Cosine Similarity Sandbox</span>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Test a natural language RAG query (e.g., 'West region SLA response times')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9 text-xs py-2 w-full"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" loading={isSearching}>
            Search Vector Index
          </Button>
        </form>

        {/* Search Results Display */}
        {searchResults.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[#1e1e35] animate-slide-up">
            <p className="text-xs font-semibold text-slate-400">Top Semantic Matches</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {searchResults.map((res, i) => (
                <div key={i} className="card p-3.5 bg-[#0e0e20] border-[#222244] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200 truncate">{res.document_title || 'Document'}</span>
                    <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                      {(((res.similarity_score || 0)) * 100).toFixed(1)}% match
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-mono line-clamp-3">
                    &ldquo;{res.content || ''}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Documents Grid / Table */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1e1e35] flex items-center justify-center mb-4">
            <BookOpen size={28} className="text-slate-600" />
          </div>
          <h2 className="text-base font-semibold text-slate-200 mb-1">No documents uploaded</h2>
          <p className="text-xs text-slate-500 max-w-xs mb-5">
            Upload PDF reports, strategy docs, or policies to give agents contextual knowledge during investigations.
          </p>
          <Button variant="primary" onClick={() => setShowUpload(true)}>
            <Plus size={15} /> Upload First Document
          </Button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Chunks</th>
                <th>Size</th>
                <th>Status</th>
                <th>Uploaded</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-[#1b1b36] transition-colors">
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center flex-shrink-0">
                        <FileText size={15} />
                      </div>
                      <div>
                        <button
                          onClick={() => handleInspect(doc.id)}
                          className="font-medium text-slate-200 hover:text-brand-400 text-left transition-colors text-xs"
                        >
                          {doc.title || doc.original_filename || 'Untitled Document'}
                        </button>
                        <p className="text-[11px] text-slate-500 font-mono">{doc.original_filename || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-xs font-mono">{doc.chunk_count ?? 0} chunks</td>
                  <td className="text-xs text-slate-400 font-mono">
                    {(((doc.file_size_bytes || 0)) / 1024 / 1024).toFixed(2)} MB
                  </td>
                  <td>
                    <StatusBadge status={doc.status} />
                  </td>
                  <td className="text-xs text-slate-500">
                    {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        icon={Layers}
                        label="Inspect Chunks"
                        onClick={() => handleInspect(doc.id)}
                        size={14}
                      />
                      <IconButton
                        icon={Trash2}
                        label="Delete"
                        variant="danger"
                        onClick={() => handleDelete(doc.id, doc.title || 'document')}
                        size={14}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Document Chunks Drawer/Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-2xl max-h-[80vh] flex flex-col p-6 space-y-4 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-[#1e1e35] pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100">{selectedDoc.title}</h3>
                <p className="text-xs text-slate-500">{selectedDoc.chunk_count || 0} indexed semantic chunks</p>
              </div>
              <IconButton icon={X} label="Close" onClick={() => setSelectedDoc(null)} />
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {!Array.isArray(selectedDoc.chunks) || selectedDoc.chunks.length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center">No chunks available for this document.</p>
              ) : (
                selectedDoc.chunks.map((c) => (
                  <div key={c.id || c.chunk_index} className="card p-3 bg-[#0d0d1e] border-[#1d1d36] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded">
                        Chunk #{c.chunk_index}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {c.token_count || 0} tokens
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                      {c.content || ''}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
