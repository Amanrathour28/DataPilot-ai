import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FileText, UploadCloud, Search, Trash2, Plus, RefreshCw, CheckCircle2,
  Clock, AlertCircle, Sparkles, Layers, BookOpen, ExternalLink, X, ArrowRight
} from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import useWorkspaceStore from '../../stores/workspaceStore'
import { documentsApi } from '../../services/api'
import { PageShell, PageHeader, EmptyState } from '../../components/layout/PageShell'
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
      <PageShell>
        <PageHeader eyebrow="Workspace" title="Documents (RAG)" description="Loading workspace context…" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton /><CardSkeleton />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Knowledge Corpus"
        title="Document Intelligence"
        description={`${documents.length} document${documents.length !== 1 ? 's' : ''} embedded for qualitative cross-referencing in “${activeWorkspace.name}”`}
        actions={
          <div className="flex items-center gap-3">
            <IconButton icon={RefreshCw} label="Refresh" onClick={() => refetch()} />
            <Button variant="primary" onClick={() => setShowUpload(!showUpload)}>
              <Plus size={15} />
              <span>{showUpload ? 'Close Upload' : 'Upload Document'}</span>
            </Button>
          </div>
        }
      />

      {/* Upload Drawer */}
      {showUpload && (
        <div className="border border-white/[0.1] bg-[#0c0c0c] p-6 sm:p-8 space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <h3 className="font-display font-bold text-base uppercase text-[#f2f2ef]">
              Upload PDF / Strategic Memo / Report
            </h3>
            <button onClick={() => setShowUpload(false)} className="text-[#f2f2ef]/40 hover:text-white cursor-pointer">
              [Close]
            </button>
          </div>

          <label className="border-2 border-dashed border-white/[0.15] bg-[#080808] p-10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-[#d4ff58] transition-colors">
            <UploadCloud size={28} className="text-[#d4ff58]" />
            <span className="font-bold text-[#f2f2ef] uppercase tracking-wider">
              {uploading ? 'Embedding Document…' : 'Select PDF or Document to Index'}
            </span>
            <span className="text-[10px] text-[#f2f2ef]/40">
              PDF, TXT, DOCX &middot; Vectorized automatically into Hybrid RAG Index
            </span>
            <input
              type="file"
              accept=".pdf,.txt,.md,.docx,.json"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>
      )}

      {/* Semantic Vector Search Tester */}
      <div className="border border-white/[0.08] bg-[#0c0c0c] p-6 sm:p-8 space-y-4">
        <div>
          <span className="font-mono text-[10px] text-[#d4ff58] uppercase tracking-widest block mb-1">
            Hybrid RAG Retrieval
          </span>
          <h3 className="font-display font-bold text-base uppercase tracking-tight text-[#f2f2ef]">
            Test Semantic Search Over Uploaded Documents
          </h3>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. Q3 marketing budget pause or territory realignments…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input text-xs font-mono flex-1"
          />
          <Button variant="secondary" type="submit" loading={isSearching} disabled={isSearching || !searchQuery.trim()}>
            Query &rarr;
          </Button>
        </form>

        {searchResults.length > 0 && (
          <div className="pt-4 border-t border-white/[0.06] space-y-3 font-mono text-xs">
            <span className="text-[#d4ff58] uppercase tracking-widest text-[10px] block">
              Retrieved Semantic Vector Chunks ({searchResults.length})
            </span>
            <div className="space-y-2">
              {searchResults.map((res, idx) => (
                <div key={idx} className="p-3 bg-[#080808] border border-white/[0.06] space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-[#f2f2ef]/50">
                    <span>{res.document_name || 'Document Chunk'}</span>
                    <span className="text-[#d4ff58]">Score: {(res.similarity || res.score || 0.9).toFixed(2)}</span>
                  </div>
                  <p className="font-sans text-xs text-[#f2f2ef]/90 italic leading-relaxed">
                    &ldquo;{res.content || res.text}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Document Registry Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents uploaded yet"
          description="Upload strategy PDFs, earnings decks, or meeting transcripts for the RAG agent to cross-reference with numbers."
          action={
            <Button variant="primary" onClick={() => setShowUpload(true)}>
              Upload First Document &rarr;
            </Button>
          }
        />
      ) : (
        <div className="border border-white/[0.08] bg-[#0c0c0c] divide-y divide-white/[0.06]">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.01] transition-colors"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-[#f2f2ef]/40 uppercase tracking-widest">
                    {doc.file_type || 'PDF'}
                  </span>
                  <StatusBadge status={doc.status || 'PROCESSED'} />
                </div>
                <h4 className="font-display font-bold text-base uppercase tracking-tight text-[#f2f2ef] truncate">
                  {doc.title || doc.filename}
                </h4>
                <p className="font-mono text-[11px] text-[#f2f2ef]/40">
                  {doc.chunk_count ? `${doc.chunk_count} vector chunks` : 'Indexed'} &middot; Uploaded {new Date(doc.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => handleInspect(doc.id)}
                  className="font-mono text-xs text-[#d4ff58] hover:underline uppercase tracking-wider cursor-pointer"
                >
                  Inspect &rarr;
                </button>
                <IconButton
                  icon={Trash2}
                  label="Delete"
                  variant="danger"
                  onClick={() => handleDelete(doc.id, doc.title || doc.filename)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Document Inspector Modal / Overlay */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl border border-white/[0.12] bg-[#0c0c0c] p-6 sm:p-8 space-y-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div>
                <span className="font-mono text-[10px] text-[#d4ff58] uppercase tracking-widest block">
                  Document Metadata
                </span>
                <h3 className="font-display font-bold text-lg uppercase text-[#f2f2ef]">
                  {selectedDoc.title || selectedDoc.filename}
                </h3>
              </div>
              <IconButton icon={X} label="Close" onClick={() => setSelectedDoc(null)} />
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-[#080808] border border-white/[0.06]">
                  <span className="text-[#f2f2ef]/40 text-[10px] uppercase block">Total Chunks</span>
                  <span className="text-[#f2f2ef] font-bold">{selectedDoc.chunk_count || '—'}</span>
                </div>
                <div className="p-3 bg-[#080808] border border-white/[0.06]">
                  <span className="text-[#f2f2ef]/40 text-[10px] uppercase block">Status</span>
                  <span className="text-[#d4ff58] font-bold uppercase">{selectedDoc.status || 'INDEXED'}</span>
                </div>
              </div>

              {selectedDoc.sample_chunks && selectedDoc.sample_chunks.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-[#f2f2ef]/40 text-[10px] uppercase tracking-widest block">
                    Sample Vector Embeddings
                  </span>
                  {selectedDoc.sample_chunks.map((chunk, idx) => (
                    <div key={idx} className="p-3 bg-[#080808] border border-white/[0.06]">
                      <p className="font-sans text-xs italic text-[#f2f2ef]/85">&ldquo;{chunk.content}&rdquo;</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </PageShell>
  )
}
