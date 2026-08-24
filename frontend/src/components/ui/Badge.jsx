import { clsx } from 'clsx'

export function Badge({ children, variant = 'muted', className = '' }) {
  const variants = {
    success: 'badge-success',
    warning: 'badge-warning',
    error:   'badge-error',
    info:    'badge-info',
    muted:   'badge-muted',
  }
  return (
    <span className={clsx(variants[variant], className)}>
      {children}
    </span>
  )
}

export function StatusBadge({ status }) {
  const map = {
    UPLOADED:  { variant: 'info',    label: 'Uploaded' },
    UPLOADING: { variant: 'warning', label: 'Uploading' },
    PROFILING: { variant: 'warning', label: 'Profiling…' },
    PROFILED:  { variant: 'success', label: 'Profiled' },
    ERROR:     { variant: 'error',   label: 'Error' },
    // Hypothesis statuses
    PROPOSED:           { variant: 'muted',   label: 'Proposed' },
    UNDER_INVESTIGATION:{ variant: 'warning', label: 'Investigating' },
    SUPPORTED:          { variant: 'success', label: 'Supported' },
    REJECTED:           { variant: 'error',   label: 'Rejected' },
    INCONCLUSIVE:       { variant: 'muted',   label: 'Inconclusive' },
  }
  const { variant, label } = map[status] || { variant: 'muted', label: status }
  return <Badge variant={variant}>{label}</Badge>
}
