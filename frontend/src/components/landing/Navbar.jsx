import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, X, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import useAuthStore from '../../stores/authStore'
import { BrandWordmark } from '../ui/Logo'

const NAV_LINKS = [
  { label: 'Product',      href: '#hero' },
  { label: 'How it works', href: '#workflow' },
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
          ? 'bg-[#06070b]/80 backdrop-blur-xl border-b border-white/[0.06] py-3 shadow-2xl shadow-black/40'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <Link to="/">
          <BrandWordmark compact />
        </Link>

        <nav className="hidden md:flex items-center gap-1 glass px-2 py-1 rounded-full">
          {NAV_LINKS.map((link) => (
            <button
              key={link.label}
              onClick={() => scrollTo(link.href)}
              className="text-xs font-medium text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded-full hover:bg-white/[0.05] transition-colors"
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {token && user ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-b from-cyan-300 to-cyan-600 text-cyan-950 shadow-lg shadow-cyan-500/20 transition-all hover:brightness-110"
            >
              Open workspace
              <ArrowRight size={14} />
            </button>
          ) : (
            <>
              <Link
                to="/login"
                className="text-xs font-semibold text-slate-300 hover:text-white px-3.5 py-2 rounded-xl hover:bg-white/[0.05] transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-b from-cyan-300 to-cyan-600 text-cyan-950 shadow-lg shadow-cyan-500/20 transition-all hover:brightness-110"
              >
                Get started
                <ArrowRight size={14} />
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-slate-400 hover:text-white p-2 rounded-lg bg-white/[0.04] border border-white/[0.08]"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#07090e] border-b border-white/[0.06] px-4 pt-3 pb-6 overflow-hidden"
          >
            <div className="flex flex-col gap-2">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.label}
                  onClick={() => scrollTo(link.href)}
                  className="text-left text-sm font-medium text-slate-300 hover:text-white py-2 px-3 rounded-lg hover:bg-white/[0.04]"
                >
                  {link.label}
                </button>
              ))}

              <div className="border-t border-white/[0.06] my-2 pt-3 flex flex-col gap-2">
                {token && user ? (
                  <button
                    onClick={() => { setMobileOpen(false); navigate('/dashboard') }}
                    className="w-full text-center py-2.5 rounded-xl text-xs font-semibold bg-cyan-500 text-cyan-950"
                  >
                    Open workspace
                  </button>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setMobileOpen(false)}
                      className="w-full text-center py-2.5 rounded-xl text-xs font-semibold bg-white/[0.04] text-slate-200 border border-white/[0.08]"
                    >
                      Sign in
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setMobileOpen(false)}
                      className="w-full text-center py-2.5 rounded-xl text-xs font-semibold bg-cyan-500 text-cyan-950"
                    >
                      Get started →
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
