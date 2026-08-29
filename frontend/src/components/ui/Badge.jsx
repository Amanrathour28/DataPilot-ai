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
    PENDING:   { variant: 'muted',   label: 'Pending' },
    RUNNING:   { variant: 'warning', label: 'Running' },
    COMPLETED:                  { variant: 'success', label: 'Completed' },
    COMPLETED_WITH_LIMITATIONS: { variant: 'warning', label: 'Completed with Limitations' },
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
  const { variant, label } = map[status] || { variant: 'muted', label: status }
  return <Badge variant={variant}>{label}</Badge>
}
