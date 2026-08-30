import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { clsx } from 'clsx'
import { Award, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

function renderBadge(text) {
  if (typeof text !== 'string') return null
  const t = text.trim()
  if (t === 'CONFIRMED' || t === 'SUPPORTED' || t === 'Growing') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider bg-[#d4ff58]/10 text-[#d4ff58] border border-[#d4ff58]/30">
        <CheckCircle2 size={10} /> {t}
      </span>
    )
  }
  if (t === 'CONTRADICTED' || t === 'Declining' || t === 'REJECTED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider bg-[#ff4e4e]/10 text-[#ff4e4e] border border-[#ff4e4e]/30">
        <XCircle size={10} /> {t}
      </span>
    )
  }
  if (t === 'PRIMARY DRIVER' || t === 'PRIMARY_ROOT_CAUSE') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-wider bg-[#d4ff58] text-black">
        <Award size={10} /> PRIMARY DRIVER
      </span>
    )
  }
  return null
}

export default function MarkdownReport({ content, className }) {
  if (!content) {
    return (
      <div className="border border-white/[0.08] bg-[#0c0c0c] p-12 text-center text-xs font-mono text-[#f2f2ef]/40">
        No report generated yet. Investigation in progress.
      </div>
    )
  }

  return (
    <div className={clsx('border border-white/[0.08] bg-[#0c0c0c] p-6 sm:p-10 space-y-8 font-sans text-sm leading-relaxed text-[#f2f2ef]/85', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl uppercase tracking-tight text-[#f2f2ef] pb-3 border-b border-white/[0.08] mt-8 mb-4">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-display font-bold text-xl sm:text-2xl uppercase tracking-tight text-[#f2f2ef] pb-2 border-b border-white/[0.06] mt-6 mb-3">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-display font-bold text-base sm:text-lg uppercase tracking-tight text-[#d4ff58] mt-5 mb-2">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-sm leading-relaxed text-[#f2f2ef]/75 mb-4">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1.5 mb-4 text-xs sm:text-sm text-[#f2f2ef]/75 pl-2">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1.5 mb-4 text-xs sm:text-sm text-[#f2f2ef]/75 pl-2 font-mono">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[#d4ff58] pl-4 py-1.5 my-4 bg-white/[0.01] italic text-[#f2f2ef]/90 text-xs sm:text-sm">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-6 border border-white/[0.08]">
              <table className="w-full text-left border-collapse text-xs font-mono">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-white/[0.08] bg-[#080808] p-3 text-[10px] font-bold uppercase tracking-wider text-[#f2f2ef]/60">
              {children}
            </th>
          ),
          td: ({ children }) => {
            const badge = typeof children === 'string' ? renderBadge(children) : null
            return (
              <td className="border-b border-white/[0.04] p-3 text-xs text-[#f2f2ef]/80">
                {badge || children}
              </td>
            )
          },
          code: ({ children, className }) => (
            <code className={clsx('font-mono text-xs px-1.5 py-0.5 bg-[#080808] text-[#d4ff58] border border-white/[0.06]', className)}>
              {children}
            </code>
          ),
          hr: () => <hr className="my-8 border-t border-white/[0.08]" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
