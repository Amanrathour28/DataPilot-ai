import React, { useState, useEffect } from 'react'
import { ShieldCheck, Filter, Search, Clock, FileText, CheckCircle2, UserCheck, AlertCircle } from 'lucide-react'
import { PageShell } from '../../components/layout/PageShell'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import useOrganizationStore from '../../stores/organizationStore'
import { organizationsApi } from '../../services/api'
import { useToast } from '../../components/ui/Toast'

export default function AuditLogsPage() {
  const { activeOrganization } = useOrganizationStore()
  const toast = useToast()

  const [logs, setLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  const loadLogs = async () => {
    if (!activeOrganization?.id) return
    try {
      setIsLoading(true)
      const data = await organizationsApi.auditLogs(activeOrganization.id, 150)
      setLogs(data || [])
    } catch (err) {
      toast?.show('Failed to load audit logs', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [activeOrganization?.id])

  const filteredLogs = logs.filter((log) => {
    const matchesAction = filterAction === 'ALL' || log.action.includes(filterAction.toLowerCase())
    const matchesSearch =
      !searchQuery ||
      log.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesAction && matchesSearch
  })

  const getActionBadgeVariant = (action) => {
    if (action.includes('created') || action.includes('joined') || action.includes('approved'))
      return 'primary'
    if (action.includes('removed') || action.includes('revoked') || action.includes('rejected'))
      return 'danger'
    if (action.includes('invited') || action.includes('updated'))
      return 'info'
    return 'secondary'
  }

  return (
    <PageShell className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#c8ff00]">
              COMPLIANCE & AUDITABILITY
            </span>
            <span className="text-[#f2f2ef]/20">/</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#f2f2ef]/40">
              LEDGER
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#f2f2ef] tracking-tight">
            Organization Audit Trail
          </h1>
          <p className="font-sans text-xs text-[#f2f2ef]/60 mt-1 max-w-2xl">
            Append-only chronological record of all user actions, permissions, AI executions, human
            approvals, and dataset operations in <span className="text-[#f2f2ef] font-semibold">{activeOrganization?.name}</span>.
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="btn-dn-secondary px-3 py-1.5 text-xs font-mono self-start sm:self-auto cursor-pointer"
        >
          Refresh Audit Trail ↺
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f2f2ef]/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by actor name, email, or action..."
            className="w-full pl-9 pr-3 py-2 bg-[#0c0c0c] border border-white/[0.08] text-xs font-mono text-[#f2f2ef] focus:border-[#c8ff00] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={13} className="text-[#f2f2ef]/40 shrink-0" />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="w-full sm:w-48 bg-[#0c0c0c] border border-white/[0.08] px-3 py-2 text-xs font-mono text-[#f2f2ef] focus:border-[#c8ff00] focus:outline-none"
          >
            <option value="ALL">All Actions ({logs.length})</option>
            <option value="INVESTIGATION">Investigations</option>
            <option value="MEMBER">Members & Roles</option>
            <option value="FINDING">Human Approvals</option>
            <option value="WORKSPACE">Workspaces</option>
          </select>
        </div>
      </div>

      {/* Audit Logs Table */}
      <Card className="border-white/[0.08] p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-[#c8ff00]" />
            <span className="font-mono text-xs uppercase tracking-wider text-[#f2f2ef] font-semibold">
              EVENT LOG ({filteredLogs.length})
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] bg-black/40 font-mono text-[10px] uppercase tracking-widest text-[#f2f2ef]/40">
                <th className="py-3 px-5">Timestamp</th>
                <th className="py-3 px-5">Actor</th>
                <th className="py-3 px-5">Action</th>
                <th className="py-3 px-5">Resource Type</th>
                <th className="py-3 px-5">Metadata / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center font-mono text-xs text-[#f2f2ef]/40">
                    No matching audit logs found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-5 font-mono text-[11px] text-[#f2f2ef]/50 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex flex-col">
                        <span className="font-semibold text-[#f2f2ef]">{log.user_name || 'System'}</span>
                        <span className="font-mono text-[10px] text-[#f2f2ef]/40">{log.user_email || 'system_actor'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <Badge variant={getActionBadgeVariant(log.action)} className="font-mono text-[10px]">
                        {log.action}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[11px] text-[#f2f2ef]/70">
                      {log.resource_type}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[10px] text-[#f2f2ef]/50 max-w-xs truncate">
                      {log.metadata_json && Object.keys(log.metadata_json).length > 0
                        ? JSON.stringify(log.metadata_json)
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </PageShell>
  )
}
