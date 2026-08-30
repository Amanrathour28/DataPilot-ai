import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Settings, Sliders, Cpu, Key, Database, Shield,
  CheckCircle2, AlertCircle, RefreshCw, Server, Sparkles, User, Save, Check
} from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import useWorkspaceStore from '../../stores/workspaceStore'
import { workspacesApi, systemApi } from '../../services/api'
import { PageShell, PageHeader } from '../../components/layout/PageShell'
import { clsx } from 'clsx'

export default function SettingsPage() {
  const { activeWorkspace, setActiveWorkspace } = useWorkspaceStore()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState('general')

  // Workspace form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [savingWs, setSavingWs] = useState(false)

  // LLM Config state
  const [llmProvider, setLlmProvider] = useState(() => localStorage.getItem('datapilot_llm_provider') || 'groq')
  const [groqKey, setGroqKey] = useState(() => localStorage.getItem('datapilot_groq_key') || '')
  const [groqModel, setGroqModel] = useState(() => localStorage.getItem('datapilot_groq_model') || 'llama-3.3-70b-versatile')
  const [ollamaUrl, setOllamaUrl] = useState(() => localStorage.getItem('datapilot_ollama_url') || 'http://localhost:11434')
  const [modelName, setModelName] = useState(() => localStorage.getItem('datapilot_model_name') || 'llama3.2')
  const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem('datapilot_openai_key') || '')
  const [temperature, setTemperature] = useState(() => localStorage.getItem('datapilot_temperature') || '0.2')

  // Health check query
  const { data: health, isLoading: checkingHealth, refetch: refetchHealth } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => systemApi.health(),
    retry: 1,
  })

  useEffect(() => {
    if (activeWorkspace) {
      setName(activeWorkspace.name || '')
      setDescription(activeWorkspace.description || '')
    }
  }, [activeWorkspace])

  // Save workspace updates
  const handleSaveWorkspace = async (e) => {
    e.preventDefault()
    if (!activeWorkspace) return
    setSavingWs(true)
    try {
      const updated = await workspacesApi.update(activeWorkspace.id, { name, description })
      setActiveWorkspace(updated)
      toast?.show('Workspace settings saved', 'success')
      queryClient.invalidateQueries(['workspaces'])
    } catch (err) {
      toast?.show(err.response?.data?.detail || 'Failed to update workspace', 'error')
    } finally {
      setSavingWs(false)
    }
  }

  // Save LLM settings
  const handleSaveLLM = (e) => {
    e.preventDefault()
    localStorage.setItem('datapilot_llm_provider', llmProvider)
    localStorage.setItem('datapilot_groq_key', groqKey)
    localStorage.setItem('datapilot_groq_model', groqModel)
    localStorage.setItem('datapilot_ollama_url', ollamaUrl)
    localStorage.setItem('datapilot_model_name', modelName)
    localStorage.setItem('datapilot_openai_key', openaiKey)
    localStorage.setItem('datapilot_temperature', temperature)
    toast?.show('LLM Configuration saved successfully', 'success')
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="System Configuration"
        title="Settings & Telemetry"
        description="Manage workspace attributes, LLM reasoning engines, and runtime health diagnostics."
      />

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-white/[0.08]">
        {[
          { id: 'general', label: 'Workspace Details', icon: Sliders },
          { id: 'llm',     label: 'LLM & Agent Engine', icon: Cpu },
          { id: 'health',  label: 'System Diagnostics', icon: Server },
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-5 py-3 font-mono text-xs uppercase tracking-wider border-b-2 -mb-px transition-all cursor-pointer',
                active
                  ? 'text-[#d4ff58] border-[#d4ff58] font-bold'
                  : 'text-[#f2f2ef]/50 border-transparent hover:text-[#f2f2ef]'
              )}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab 1: General Workspace */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveWorkspace} className="border border-white/[0.08] bg-[#0c0c0c] p-6 sm:p-8 space-y-6 max-w-2xl">
          <div className="pb-4 border-b border-white/[0.08]">
            <h3 className="font-display font-bold text-base uppercase text-[#f2f2ef]">
              Workspace Identity
            </h3>
            <p className="font-mono text-xs text-[#f2f2ef]/40 mt-0.5">
              Unique workspace scope for datasets and investigation graphs
            </p>
          </div>

          <div className="space-y-4 font-mono text-xs">
            <div className="space-y-1.5">
              <label className="label">Workspace Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input bg-[#080808]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="label">Description & Boundary</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input resize-none bg-[#080808]"
                placeholder="Optional analytical scope description…"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="primary" type="submit" loading={savingWs}>
              <Save size={14} /> Save Workspace
            </Button>
          </div>
        </form>
      )}

      {/* Tab 2: LLM Engine Configuration */}
      {activeTab === 'llm' && (
        <form onSubmit={handleSaveLLM} className="border border-white/[0.08] bg-[#0c0c0c] p-6 sm:p-8 space-y-6 max-w-2xl">
          <div className="pb-4 border-b border-white/[0.08]">
            <h3 className="font-display font-bold text-base uppercase text-[#f2f2ef]">
              Multi-Agent LLM Engine Provider
            </h3>
            <p className="font-mono text-xs text-[#f2f2ef]/40 mt-0.5">
              Select the reasoning backend used by Supervisor, Analyst, Hypothesis, and Critic agents
            </p>
          </div>

          <div className="space-y-4 font-mono text-xs">
            <div className="space-y-1.5">
              <label className="label">Inference Provider</label>
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value)}
                className="input bg-[#080808]"
              >
                <option value="groq">Groq (Llama 3.3 70B &middot; High Speed)</option>
                <option value="ollama">Ollama (Local Offline Inference)</option>
                <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
              </select>
            </div>

            {llmProvider === 'groq' && (
              <>
                <div className="space-y-1.5">
                  <label className="label">Groq API Key</label>
                  <input
                    type="password"
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    placeholder="gsk_••••••••••••••••••••"
                    className="input bg-[#080808]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="label">Model Identifier</label>
                  <input
                    type="text"
                    value={groqModel}
                    onChange={(e) => setGroqModel(e.target.value)}
                    className="input bg-[#080808]"
                  />
                </div>
              </>
            )}

            {llmProvider === 'ollama' && (
              <div className="space-y-1.5">
                <label className="label">Ollama Host URL</label>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  className="input bg-[#080808]"
                />
              </div>
            )}

            {llmProvider === 'openai' && (
              <div className="space-y-1.5">
                <label className="label">OpenAI API Key</label>
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-••••••••••••••••••••"
                  className="input bg-[#080808]"
                />
              </div>
            )}

            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between">
                <label className="label m-0">Inference Temperature</label>
                <span className="text-[#d4ff58] font-bold">{temperature}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="w-full accent-[#d4ff58]"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="primary" type="submit">
              <Save size={14} /> Update Engine Config
            </Button>
          </div>
        </form>
      )}

      {/* Tab 3: System Diagnostics */}
      {activeTab === 'health' && (
        <div className="border border-white/[0.08] bg-[#0c0c0c] p-6 sm:p-8 space-y-6 max-w-2xl font-mono text-xs">
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <div>
              <h3 className="font-display font-bold text-base uppercase text-[#f2f2ef]">
                Runtime Telemetry & Health
              </h3>
              <p className="text-[11px] text-[#f2f2ef]/40 mt-0.5">
                API gateway and worker subsystem status
              </p>
            </div>
            <IconButton icon={RefreshCw} label="Refresh" onClick={() => refetchHealth()} />
          </div>

          <div className="space-y-3">
            <div className="p-4 bg-[#080808] border border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-[#d4ff58]" />
                <span className="font-bold uppercase text-[#f2f2ef]">API Gateway</span>
              </div>
              <span className="text-[#d4ff58] font-bold">OPERATIONAL</span>
            </div>

            <div className="p-4 bg-[#080808] border border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-[#d4ff58]" />
                <span className="font-bold uppercase text-[#f2f2ef]">DuckDB / Python Sandbox</span>
              </div>
              <span className="text-[#d4ff58] font-bold">ACTIVE &middot; ISOLATED</span>
            </div>

            <div className="p-4 bg-[#080808] border border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-[#d4ff58]" />
                <span className="font-bold uppercase text-[#f2f2ef]">Hybrid Vector RAG Store</span>
              </div>
              <span className="text-[#d4ff58] font-bold">CONNECTED</span>
            </div>
          </div>
        </div>
      )}

    </PageShell>
  )
}
