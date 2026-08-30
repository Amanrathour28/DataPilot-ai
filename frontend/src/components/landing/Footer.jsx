import { Link } from 'react-router-dom'

const PRODUCT_LINKS = [
  { label: 'What DataPilot Does', href: '#what-we-do' },
  { label: 'How It Works',        href: '#how-it-works' },
  { label: 'The Agents',          href: '#agents' },
  { label: 'Evidence Trail',      href: '#evidence' },
  { label: 'System Metrics',      href: '#metrics' },
  { label: 'FAQ',                 href: '#faq' },
]

const SYSTEM_LINKS = [
  { label: 'Workspace Dashboard', href: '/dashboard' },
  { label: 'New Investigation',   href: '/investigations/new' },
  { label: 'Dataset Catalog',     href: '/datasets' },
  { label: 'Knowledge Base',      href: '/knowledge' },
]

export default function Footer() {
  const scrollTo = (href) => {
    if (href.startsWith('#')) {
      const el = document.querySelector(href)
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <footer className="py-16 md:py-24 bg-[#080808]">
      <div className="dn-container space-y-16">

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start">
          
          {/* Brand Col */}
          <div className="md:col-span-5 space-y-4">
            <Link to="/" className="inline-flex items-center gap-2 group">
              <div className="w-3 h-3 bg-[#d4ff58]" />
              <span className="font-display font-extrabold text-xl tracking-tight uppercase text-[#f2f2ef]">
                DataPilot<span className="text-[#d4ff58]">.</span>ai
              </span>
            </Link>
            <p className="text-sm text-[#f2f2ef]/50 font-sans max-w-sm leading-relaxed">
              Autonomous multi-agent investigation platform. Analyzes datasets, tests hypotheses, 
              cross-references documents, and delivers verified root-cause explanations.
            </p>
            <div className="pt-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#d4ff58] animate-pulse" />
              <span className="font-mono text-xs text-[#f2f2ef]/60 uppercase tracking-widest">
                All Autonomous Systems Operational
              </span>
            </div>
          </div>

          {/* Navigation Cols */}
          <div className="md:col-span-3 space-y-3">
            <span className="font-mono text-xs uppercase tracking-widest text-[#d4ff58] block mb-4">
              Architecture
            </span>
            <ul className="space-y-2.5">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.label}>
                  <button
                    onClick={() => scrollTo(link.href)}
                    className="font-mono text-xs uppercase tracking-wider text-[#f2f2ef]/60 hover:text-[#d4ff58] transition-colors cursor-pointer text-left"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-4 space-y-3">
            <span className="font-mono text-xs uppercase tracking-widest text-[#d4ff58] block mb-4">
              Application
            </span>
            <ul className="space-y-2.5">
              {SYSTEM_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="font-mono text-xs uppercase tracking-wider text-[#f2f2ef]/60 hover:text-[#d4ff58] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Bottom Metadata */}
        <div className="pt-8 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[11px] text-[#f2f2ef]/40">
          <div>
            &copy; {new Date().getFullYear()} DataPilot AI Inc. All rights reserved.
          </div>
          <div className="flex items-center gap-6 uppercase tracking-wider">
            <span>Multi-Agent Engine</span>
            <span>·</span>
            <span>Vector RAG</span>
            <span>·</span>
            <span>Statistical Verification</span>
          </div>
        </div>

      </div>
    </footer>
  )
}
