import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Settings, Sliders, Cpu, Key, Database, Shield,
  CheckCircle2, AlertCircle, RefreshCw, Server, Sparkles, User, Save
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import useWorkspaceStore from '../../stores/workspaceStore'
import { workspacesApi, systemApi } from '../../services/api'
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

  // LLM Config state (stored in localStorage or workspace metadata)
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
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Settings className="text-brand-400" size={24} />
          <h1 className="text-2xl font-bold text-slate-100">Settings & Configuration</h1>
        </div>
        <p className="text-sm text-slate-400">
          Manage workspace preferences, LLM reasoning providers, and environment telemetry.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'general', label: 'Workspace Details', icon: Sliders },
          { id: 'llm', label: 'LLM & Agent Engine', icon: Cpu },
          { id: 'health', label: 'System Diagnostics', icon: Server },
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all',
                active
                  ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              )}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* General Workspace Settings */}
      {activeTab === 'general' && (
        <div className="card p-6 border border-slate-800 max-w-2xl space-y-6">
          <h2 className="text-base font-semibold text-slate-200">Workspace Settings</h2>
          <form onSubmit={handleSaveWorkspace} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Workspace Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#111122] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Description & Purpose
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Sales, Marketing, and Operations data analysis workspace"
                className="w-full bg-[#111122] border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="pt-2">
              <Button type="submit" variant="primary" disabled={savingWs}>
                <Save size={14} /> {savingWs ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* LLM & Agent Engine Settings */}
      {activeTab === 'llm' && (
        <div className="card p-6 border border-slate-800 max-w-2xl space-y-6">
          <div>
            <h2 className="text-base font-semibold text-slate-200">LLM Reasoning Engine</h2>
            <p className="text-xs text-slate-400 mt-1">
              Select and configure the language model powering the autonomous agent swarm.
            </p>
          </div>

          <form onSubmit={handleSaveLLM} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                LLM Reasoning Provider
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'groq', label: 'Groq Cloud', badge: 'Ultra-Fast', desc: 'Llama 3.3 70B' },
                  { id: 'ollama', label: 'Ollama', badge: 'Local / Free', desc: 'Llama 3.2' },
                  { id: 'openai', label: 'OpenAI', badge: 'Cloud API', desc: 'GPT-4o Mini' },
                  { id: 'anthropic', label: 'Claude', badge: 'Cloud API', desc: 'Claude 3.5' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setLlmProvider(p.id)}
                    className={clsx(
                      'p-3 rounded-xl border text-left flex flex-col justify-between transition-all',
                      llmProvider === p.id
                        ? 'border-brand-500 bg-brand-500/15 text-slate-200 shadow-sm ring-1 ring-brand-500/50'
                        : 'border-slate-800 bg-[#121222] text-slate-400 hover:border-slate-700'
                    )}
                  >
                    <div>
                      <span className="text-xs font-bold block">{p.label}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">{p.desc}</span>
                    </div>
                    <span className="text-[9px] uppercase font-semibold text-brand-400 mt-2">{p.badge}</span>
                  </button>
                ))}
              </div>
            </div>

            {llmProvider === 'groq' && (
              <div className="space-y-3 p-4 rounded-xl bg-brand-500/5 border border-brand-500/20">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-brand-300">
                    Groq API Key
                  </label>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-brand-400 hover:text-brand-300 underline"
                  >
                    Get free Groq API Key →
                  </a>
                </div>
                <div className="relative">
                  <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    placeholder="gsk_..."
                    className="w-full bg-[#111122] border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Groq Model
                  </label>
                  <select
                    value={groqModel}
                    onChange={(e) => setGroqModel(e.target.value)}
                    className="w-full bg-[#111122] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-brand-500"
                  >
                    <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Recommended)</option>
                    <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Fastest)</option>
                    <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
                  </select>
                </div>
                <p className="text-[11px] text-slate-400">
                  Tip: You can also set <code className="text-brand-300">GROQ_API_KEY</code> in your environment variables or <code className="text-brand-300">.env</code> file.
                </p>
              </div>
            )}

            {llmProvider === 'ollama' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Ollama Server Endpoint
                  </label>
                  <input
                    type="text"
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="w-full bg-[#111122] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Model Tag
                  </label>
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="llama3.2, mistral, qwen2.5:14b"
                    className="w-full bg-[#111122] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            )}

            {(llmProvider === 'openai' || llmProvider === 'anthropic') && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  {llmProvider === 'openai' ? 'OpenAI' : 'Anthropic'} API Key
                </label>
                <div className="relative">
                  <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder={llmProvider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                    className="w-full bg-[#111122] border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-400">
                  Agent Temperature ({temperature})
                </label>
                <span className="text-[10px] text-slate-500">Lower = More deterministic SQL & data code</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="w-full accent-brand-500 cursor-pointer"
              />
            </div>

            <div className="pt-2">
              <Button type="submit" variant="primary">
                <Save size={14} /> Save LLM Configuration
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* System Diagnostics */}
      {activeTab === 'health' && (
        <div className="card p-6 border border-slate-800 max-w-2xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-200">System Diagnostics</h2>
              <p className="text-xs text-slate-400 mt-0.5">Live status of backend microservices and database engines.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => refetchHealth()}>
              <RefreshCw size={13} className={clsx(checkingHealth && 'animate-spin')} />
              Check Now
            </Button>
          </div>

          <div className="space-y-3">
            {/* FastAPI Service */}
            <div className="p-4 bg-[#121222] rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Server size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">FastAPI Backend Core</h4>
                  <p className="text-[11px] text-slate-500">Async REST API & Agent Orchestrator</p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle2 size={14} /> {health?.status === 'ok' ? 'Operational' : 'Online'}
              </span>
            </div>

            {/* PostgreSQL & pgvector */}
            <div className="p-4 bg-[#121222] rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <Database size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">PostgreSQL + pgvector</h4>
                  <p className="text-[11px] text-slate-500">Relational metadata & Vector Embeddings</p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle2 size={14} /> Connected
              </span>
            </div>

            {/* In-Memory DuckDB Engine */}
            <div className="p-4 bg-[#121222] rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                  <Cpu size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">DuckDB OLAP Engine</h4>
                  <p className="text-[11px] text-slate-500">In-memory vectorized SQL execution</p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle2 size={14} /> Ready
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
