import { Search, Plus, Clock } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useNavigate } from 'react-router-dom'

export default function Investigations() {
  const navigate = useNavigate()
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Investigations</h1>
          <p className="text-sm text-slate-500 mt-0.5">Autonomous data investigations powered by AI agents</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/investigations/new')}>
          <Plus size={15} /> New Investigation
        </Button>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#1e1e35] flex items-center justify-center mb-5">
          <Search size={28} className="text-slate-600" />
        </div>
        <h2 className="text-base font-semibold text-slate-200 mb-2">No investigations yet</h2>
        <p className="text-sm text-slate-500 max-w-xs mb-6">
          Ask a business question and let AI agents autonomously investigate your data.
        </p>
        <Button variant="primary" onClick={() => navigate('/investigations/new')}>
          <Plus size={15} /> Start Investigation
        </Button>
        <p className="text-xs text-slate-600 mt-4">
          Multi-agent investigation — Coming in Phase 4
        </p>
      </div>
    </div>
  )
}
