import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'

export default function Footer() {
  const handleScrollTo = (id) => {
    const el = document.querySelector(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <footer className="bg-[#06060c] border-t border-[#181830] py-16 text-slate-400 relative overflow-hidden">
      {/* Footer Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 grid grid-cols-2 md:grid-cols-5 gap-8">
        {/* Column 1: Brand & Logo */}
        <div className="col-span-2 space-y-4">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md">
              <Sparkles size={16} className="text-white" />
            </div>
            <div className="flex items-center gap-1">
              <span className="font-extrabold text-slate-100 tracking-tight">DataPilot</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
                AI
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
            Autonomous multi-agent investigation platform that goes beyond simple dashboards to test hypotheses and pinpoint root causes.
          </p>
        </div>

        {/* Column 2: Product */}
        <div>
          <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-widest mb-4">Product</h4>
          <ul className="space-y-2.5 text-xs">
            <li>
              <button onClick={() => handleScrollTo('#workflow')} className="hover:text-slate-200 transition-colors text-left">
                How It Works
              </button>
            </li>
            <li>
              <button onClick={() => handleScrollTo('#agents')} className="hover:text-slate-200 transition-colors text-left">
                Agents
              </button>
            </li>
            <li>
              <button onClick={() => handleScrollTo('#architecture')} className="hover:text-slate-200 transition-colors text-left">
                Technology
              </button>
            </li>
            <li>
              <button onClick={() => handleScrollTo('#security')} className="hover:text-slate-200 transition-colors text-left">
                Security
              </button>
            </li>
          </ul>
        </div>

        {/* Column 3: Developers */}
        <div>
          <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-widest mb-4">Developers</h4>
          <ul className="space-y-2.5 text-xs text-slate-500">
            <li>
              <span className="cursor-not-allowed">Architecture</span>
            </li>
            <li>
              <span className="cursor-not-allowed">Documentation</span>
            </li>
            <li>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-slate-200 transition-colors inline-flex items-center gap-1">
                GitHub
                <svg
                  viewBox="0 0 24 24"
                  width="12"
                  height="12"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="inline-block"
                >
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                  <path d="M9 18c-4.51 2-5-2-7-2" />
                </svg>
              </a>
            </li>
          </ul>
        </div>

        {/* Column 4: Company & Legal */}
        <div>
          <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-widest mb-4">Company</h4>
          <ul className="space-y-2.5 text-xs text-slate-500">
            <li>
              <span className="cursor-not-allowed">About</span>
            </li>
            <li>
              <span className="cursor-not-allowed">Contact</span>
            </li>
            <li>
              <span className="cursor-not-allowed">Privacy Policy</span>
            </li>
            <li>
              <span className="cursor-not-allowed">Terms of Service</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-8 border-t border-[#181830] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600 font-mono">
        <span>© 2026 DataPilot AI. All rights reserved.</span>
        <span>Autonomously investigating Q3 since 2026.</span>
      </div>
    </footer>
  )
}
