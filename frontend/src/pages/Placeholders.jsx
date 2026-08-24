import { Construction } from 'lucide-react'

function ComingSoon({ title, phase, description }) {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#1e1e35] flex items-center justify-center mb-4">
          <Construction size={24} className="text-slate-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-100 mb-2">{title}</h1>
        <p className="text-sm text-slate-500 max-w-xs mb-3">{description}</p>
        <span className="badge-info badge text-xs">Phase {phase}</span>
      </div>
    </div>
  )
}

export function Knowledge() {
  return <ComingSoon title="Knowledge Base" phase="5" description="Upload business documents and let agents use them as context during investigations." />
}

export function Agents() {
  return <ComingSoon title="Agent Activity" phase="4" description="Real-time view of all active agents, their tasks, tools used, and execution traces." />
}

export function Analytics() {
  return <ComingSoon title="Analytics" phase="9" description="Investigation metrics, agent performance, cost tracking, and evaluation results." />
}

export function Memory() {
  return <ComingSoon title="Memory" phase="7" description="View and manage what DataPilot has learned about your preferences and business context." />
}

export function SettingsPage() {
  return <ComingSoon title="Settings" phase="10" description="Workspace configuration, API keys, notification preferences, and more." />
}
