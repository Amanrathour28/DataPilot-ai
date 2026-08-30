import { clsx } from 'clsx'

export function Badge({ children, variant = 'muted', className = '' }) {
  const variants = {
    success: 'border-[#d4ff58]/30 bg-[#d4ff58]/10 text-[#d4ff58]',
    warning: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    error:   'border-[#ff4e4e]/30 bg-[#ff4e4e]/10 text-[#ff4e4e]',
    info:    'border-sky-400/30 bg-sky-400/10 text-sky-300',
    muted:   'border-white/[0.1] bg-white/[0.03] text-[#f2f2ef]/50',
  }
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider border rounded-none',
      variants[variant] || variants.muted,
      className
    )}>
      {children}
    </span>
  )
}

export function StatusBadge({ status }) {
  const map = {
    UPLOADED:  { variant: 'info',    label: 'Uploaded' },
    UPLOADING: { variant: 'warning', label: 'Uploading…' },
    PROFILING: { variant: 'warning', label: 'Profiling…' },
    PROFILED:  { variant: 'success', label: 'Profiled' },
    ERROR:     { variant: 'error',   label: 'Error' },
    PENDING:   { variant: 'muted',   label: 'Pending' },
    RUNNING:   { variant: 'warning', label: 'Running' },
    COMPLETED:                  { variant: 'success', label: 'Completed' },
    COMPLETED_WITH_LIMITATIONS: { variant: 'warning', label: 'Completed w/ Limits' },
    INSUFFICIENT_DATA:          { variant: 'warning', label: 'Insufficient Data' },
    FAILED:                     { variant: 'error',   label: 'Failed' },
    CANCELLED:                  { variant: 'muted',   label: 'Cancelled' },
    PLANNING:                   { variant: 'info',    label: 'Planning' },
    ANALYZING:                  { variant: 'info',    label: 'Analyzing' },
    TESTING:                    { variant: 'warning', label: 'Testing' },
    RETRIEVING:                 { variant: 'info',    label: 'Retrieving' },
    VERIFYING:                  { variant: 'warning', label: 'Verifying' },
    REPORTING:                  { variant: 'info',    label: 'Reporting' },
    // Hypothesis & Evidence statuses
    PROPOSED:                   { variant: 'muted',   label: 'Proposed' },
    UNDER_INVESTIGATION:        { variant: 'warning', label: 'Investigating' },
    SUPPORTED:                  { variant: 'success', label: 'Supported' },
    PARTIALLY_SUPPORTED:        { variant: 'warning', label: 'Partially Supported' },
    REJECTED:                   { variant: 'error',   label: 'Rejected' },
    INCONCLUSIVE:               { variant: 'muted',   label: 'Inconclusive' },
    INSUFFICIENT_EVIDENCE:      { variant: 'muted',   label: 'Insufficient Evidence' },
  }
  const { variant, label } = map[status] || { variant: 'muted', label: status || 'Unknown' }
  return <Badge variant={variant}>{label}</Badge>
}
