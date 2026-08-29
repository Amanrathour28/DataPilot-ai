import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from '../ui/Button'

const ACCEPTED = {
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/json': ['.json'],
}

const MAX_MB = 100

function FileItem({ file, progress, status, error, onRemove }) {
  const sizeMB = (file.size / 1024 / 1024).toFixed(2)
  return (
    <div className="flex items-center gap-3 p-3 bg-[#1c1c32] rounded-xl border border-[#2a2a4a]">
      <div className="w-9 h-9 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0">
        <File size={16} className="text-brand-400" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">{file.name}</p>
        <p className="text-xs text-slate-500">{sizeMB} MB</p>

        {status === 'uploading' && (
          <div className="progress-bar mt-1.5">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}
        {error && <p className="text-xs text-red-400 mt-0.5">{error}</p>}
      </div>

      <div className="flex-shrink-0">
        {status === 'uploading' && <Loader2 size={16} className="animate-spin text-brand-400" />}
        {status === 'done'      && <CheckCircle size={16} className="text-emerald-400" />}
        {status === 'error'     && <AlertCircle size={16} className="text-red-400" />}
        {status === 'pending'   && (
          <button onClick={() => onRemove(file)} className="text-slate-500 hover:text-red-400 transition-colors">
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

export default function UploadDropzone({ onUpload, onBatchComplete, workspaceId }) {
  const [queue, setQueue] = useState([]) // { file, progress, status, error }
  const [isProcessingBatch, setIsProcessingBatch] = useState(false)

  const onDrop = useCallback((accepted, rejected) => {
    const newItems = accepted.map(f => ({ file: f, progress: 0, status: 'pending', error: null }))
    setQueue(q => [...q, ...newItems])

    rejected.forEach(({ file, errors }) => {
      const err = errors[0]?.message || 'Invalid file type or size exceeded'
      setQueue(q => [...q, { file, progress: 0, status: 'error', error: err }])
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: MAX_MB * 1024 * 1024,
  })

  const removeFile = (file) => {
    setQueue(q => q.filter(i => i.file !== file))
  }

  const uploadAll = async () => {
    const pending = queue.filter(i => i.status === 'pending')
    if (pending.length === 0) return

    setIsProcessingBatch(true)
    const results = []

    for (const item of pending) {
      setQueue(q => q.map(i => i.file === item.file ? { ...i, status: 'uploading', error: null } : i))

      try {
        const res = await onUpload(item.file, (pct) => {
          setQueue(q => q.map(i => i.file === item.file ? { ...i, progress: pct } : i))
        })
        setQueue(q => q.map(i => i.file === item.file ? { ...i, status: 'done', progress: 100 } : i))
        results.push({ file: item.file, status: 'done', data: res })
      } catch (err) {
        const msg = err.userMessage || err.response?.data?.detail || err.message || 'Upload failed'
        setQueue(q => q.map(i => i.file === item.file ? { ...i, status: 'error', error: msg } : i))
        results.push({ file: item.file, status: 'error', error: msg })
      }
    }

    setIsProcessingBatch(false)
    if (onBatchComplete) {
      await onBatchComplete(results)
    }
  }

  const pendingCount   = queue.filter(i => i.status === 'pending').length
  const uploadingCount = queue.filter(i => i.status === 'uploading').length

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={clsx(
          'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all',
          isDragActive
            ? 'border-brand-500 bg-brand-500/5 scale-[1.01]'
            : 'border-[#2a2a4a] hover:border-brand-600/50 hover:bg-[#1e1e35]/50'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className={clsx(
            'w-14 h-14 rounded-2xl flex items-center justify-center transition-colors',
            isDragActive ? 'bg-brand-500/20' : 'bg-[#1e1e35]'
          )}>
            <Upload size={24} className={isDragActive ? 'text-brand-400' : 'text-slate-500'} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">
              {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              or <span className="text-brand-400">browse to upload</span> · CSV, XLSX, JSON · Max {MAX_MB} MB
            </p>
          </div>
        </div>
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div className="space-y-2">
          {queue.map((item, i) => (
            <FileItem
              key={i}
              file={item.file}
              progress={item.progress}
              status={item.status}
              error={item.error}
              onRemove={removeFile}
            />
          ))}

          {pendingCount > 0 && (
            <Button
              variant="primary"
              onClick={uploadAll}
              loading={isProcessingBatch || uploadingCount > 0}
              className="w-full mt-2"
            >
              {isProcessingBatch || uploadingCount > 0 ? 'Uploading files…' : `Upload ${pendingCount} file${pendingCount > 1 ? 's' : ''}`}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
