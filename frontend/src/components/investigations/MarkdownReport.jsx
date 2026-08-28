import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { clsx } from 'clsx'
import {
  Award, CheckCircle2, AlertTriangle, XCircle, Info,
  TrendingUp, TrendingDown, Layers, FileText, ChevronRight
} from 'lucide-react'

// Custom Badge formatter for table cells and inline markers
function renderBadge(text) {
  if (typeof text !== 'string') return null
  const t = text.trim()
  if (t === 'CONFIRMED' || t === 'SUPPORTED' || t === 'Growing') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
        <CheckCircle2 size={11} /> {t}
      </span>
    )
  }
  if (t === 'CONTRADICTED' || t === 'Declining' || t === 'REJECTED') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
        <XCircle size={11} /> {t}
      </span>
    )
  }
  if (t === 'PARTIALLY_CONFIRMED' || t === 'PARTIALLY CONFIRMED' || t === 'Stable') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
        <AlertTriangle size={11} /> {t}
      </span>
    )
  }
  if (t === 'PRIMARY DRIVER' || t === 'PRIMARY_ROOT_CAUSE') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-brand-500/20 text-brand-300 border border-brand-500/40">
        <Award size={11} /> PRIMARY DRIVER
      </span>
    )
  }
  if (t === 'CONTRIBUTING FACTOR' || t === 'CONTRIBUTING_FACTOR') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
        CONTRIBUTING FACTOR
      </span>
    )
  }
  if (t === 'EXPLORATORY ONLY') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
        EXPLORATORY ONLY
      </span>
    )
  }
  return null
}

export default function MarkdownReport({ content, className }) {
  if (!content) {
    return (
      <div className="text-center py-8 text-slate-500 text-xs">
        No report content available.
      </div>
    )
  }

  return (
    <div className={clsx("markdown-report space-y-4 text-slate-300 text-xs leading-relaxed", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => (
            <div className="border-b border-slate-800/90 pb-2.5 mt-8 mb-4 first:mt-0">
              <h1 className="text-base sm:text-lg font-extrabold text-slate-100 tracking-tight flex items-center gap-2" {...props} />
            </div>
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-sm sm:text-base font-bold text-brand-300 mt-6 mb-3 flex items-center gap-2" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-xs sm:text-sm font-bold text-slate-200 mt-4 mb-2 uppercase tracking-wide" {...props} />
          ),
          p: ({ node, children, ...props }) => {
            return <p className="mb-3 text-slate-300 leading-relaxed font-normal" {...props}>{children}</p>
          },
          table: ({ node, ...props }) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-slate-800/90 bg-[#0d0d1a] shadow-md">
              <table className="w-full text-left border-collapse text-xs" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-[#141426] border-b border-slate-800 text-slate-300 text-[11px] font-bold uppercase tracking-wider" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody className="divide-y divide-slate-800/40" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-slate-800/30 transition-colors" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-4 py-3 font-bold text-slate-200 whitespace-nowrap" {...props} />
          ),
          td: ({ node, children, ...props }) => {
            const textContent = Array.isArray(children)
              ? children.map(c => (typeof c === 'string' ? c : (c?.props?.children || ''))).join('')
              : (typeof children === 'string' ? children : '')
            
            const badge = renderBadge(textContent)
            return (
              <td className="px-4 py-2.5 text-slate-300 font-normal leading-normal whitespace-nowrap" {...props}>
                {badge || children}
              </td>
            )
          },
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-5 space-y-1.5 my-3 text-slate-300 marker:text-brand-400" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal pl-5 space-y-1.5 my-3 text-slate-300 marker:text-brand-400 font-medium" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-relaxed" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="p-3.5 my-3.5 rounded-xl bg-brand-500/10 border-l-4 border-brand-400 text-slate-200 text-xs leading-relaxed shadow-sm" {...props} />
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-6 border-slate-800/80" {...props} />
          ),
          code: ({ node, inline, ...props }) => {
            if (inline) {
              return <code className="px-1.5 py-0.5 rounded bg-slate-800/90 text-brand-300 font-mono text-[11px] border border-slate-700/60" {...props} />
            }
            return <code className="block p-3 rounded-xl bg-[#090914] font-mono text-xs text-slate-200 border border-slate-800 my-3 overflow-x-auto" {...props} />
          },
          strong: ({ node, children, ...props }) => {
            const textContent = typeof children === 'string' ? children : (Array.isArray(children) ? children.join('') : '')
            const badge = renderBadge(textContent)
            if (badge) return badge
            return <strong className="font-bold text-slate-100" {...props}>{children}</strong>
          },
          em: ({ node, ...props }) => (
            <em className="text-slate-400 italic" {...props} />
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
