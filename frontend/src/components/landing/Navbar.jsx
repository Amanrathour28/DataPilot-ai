import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sparkles, Menu, X, ArrowRight, ShieldCheck, Cpu, GitBranch, Layers } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import useAuthStore from '../../stores/authStore'

const NAV_LINKS = [
  { label: 'Product',      href: '#hero' },
  { label: 'How It Works', href: '#workflow' },
  { label: 'Agents',       href: '#agents' },
  { label: 'Evidence',     href: '#evidence' },
  { label: 'Technology',   href: '#architecture' },
  { label: 'Security',     href: '#security' },
]

export default function Navbar() {
  const [scrolled, setScrolled]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, token } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollTo = (id) => {
    setMobileOpen(false)
    const el = document.querySelector(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#0a0a14]/85 backdrop-blur-md border-b border-[#1e1e35] py-3.5 shadow-2xl shadow-black/50'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
            <Sparkles size={18} className="text-white" />
            <div className="absolute inset-0 rounded-xl bg-indigo-500/30 blur-md -z-10 group-hover:opacity-100 opacity-60 transition-opacity" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-slate-100 text-lg tracking-tight">DataPilot</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              AI
            </span>
          </div>
        </Link>

        {/* Desktop Nav links */}
        <nav className="hidden md:flex items-center gap-1 bg-[#141427]/70 border border-[#222240] px-4 py-1.5 rounded-full backdrop-blur-md">
          {NAV_LINKS.map((link) => (
            <button
              key={link.label}
              onClick={() => scrollTo(link.href)}
              className="text-xs font-medium text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded-full hover:bg-[#1e1e38] transition-colors"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Right Action buttons */}
        <div className="hidden md:flex items-center gap-3">
          {token && user ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Go to Dashboard
              <ArrowRight size={14} />
            </button>
          ) : (
            <>
              <Link
                to="/login"
                className="text-xs font-semibold text-slate-300 hover:text-white px-3.5 py-2 rounded-xl hover:bg-[#1c1c35] transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Get Started
                <ArrowRight size={14} />
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-slate-400 hover:text-white p-2 rounded-lg bg-[#16162e] border border-[#242444]"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#0d0d1b] border-b border-[#20203c] px-4 pt-3 pb-6 overflow-hidden"
          >
            <div className="flex flex-col gap-2">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.label}
                  onClick={() => scrollTo(link.href)}
                  className="text-left text-sm font-medium text-slate-300 hover:text-white py-2 px-3 rounded-lg hover:bg-[#1a1a34]"
                >
                  {link.label}
                </button>
              ))}

              <div className="border-t border-[#1e1e38] my-2 pt-3 flex flex-col gap-2">
                {token && user ? (
                  <button
                    onClick={() => { setMobileOpen(false); navigate('/dashboard') }}
                    className="w-full text-center py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white"
                  >
                    Go to Dashboard
                  </button>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setMobileOpen(false)}
                      className="w-full text-center py-2.5 rounded-xl text-xs font-semibold bg-[#181832] text-slate-200 border border-[#2a2a4c]"
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setMobileOpen(false)}
                      className="w-full text-center py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white"
                    >
                      Get Started →
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
