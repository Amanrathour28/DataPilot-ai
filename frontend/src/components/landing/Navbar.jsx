import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import useAuthStore from '../../stores/authStore'

const NAV_LINKS = [
  { label: 'Product',      href: '#what-we-do' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Agents',       href: '#agents' },
  { label: 'Evidence',     href: '#evidence' },
  { label: 'Metrics',      href: '#metrics' },
  { label: 'FAQ',          href: '#faq' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, token } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (href) => {
    setMobileOpen(false)
    const el = document.querySelector(href)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#080808]/92 backdrop-blur-md border-b border-white/[0.08] py-4'
          : 'bg-transparent py-6'
      }`}
    >
      <div className="dn-container flex items-center justify-between">

        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-2.5 h-2.5 bg-[#d4ff58] transition-transform duration-300 group-hover:scale-125" />
          <span className="font-display font-extrabold text-base md:text-lg tracking-tight uppercase text-[#f2f2ef]">
            DataPilot<span className="text-[#d4ff58]">.</span>ai
          </span>
        </Link>

        {/* Desktop Nav Items */}
        <nav className="hidden lg:flex items-center gap-8" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <button
              key={link.label}
              onClick={() => scrollTo(link.href)}
              className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#f2f2ef]/60 hover:text-[#d4ff58] transition-colors cursor-pointer"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Desktop CTA / Auth */}
        <div className="hidden lg:flex items-center gap-4">
          {token && user ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-dn-primary text-xs py-2 px-4 flex items-center gap-1.5"
            >
              <span>Workspace</span>
              <ArrowUpRight size={14} />
            </button>
          ) : (
            <>
              <Link
                to="/login"
                className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#f2f2ef]/60 hover:text-[#f2f2ef] px-3 py-2 transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="btn-dn-outline text-xs py-2 px-4 flex items-center gap-1.5"
              >
                <span>Get Started</span>
                <ArrowUpRight size={14} />
              </Link>
            </>
          )}
        </div>

        {/* Mobile Toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden text-[#f2f2ef] p-1 cursor-pointer"
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="lg:hidden overflow-hidden bg-[#0a0a0a] border-b border-white/[0.08]"
          >
            <div className="dn-container py-8 space-y-4">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.label}
                  onClick={() => scrollTo(link.href)}
                  className="block w-full text-left font-display font-bold text-xl uppercase tracking-tight text-[#f2f2ef] hover:text-[#d4ff58] transition-colors py-2"
                >
                  {link.label}
                </button>
              ))}

              <div className="pt-6 border-t border-white/[0.08] flex flex-col gap-3">
                {token && user ? (
                  <button
                    onClick={() => { setMobileOpen(false); navigate('/dashboard') }}
                    className="btn-dn-primary w-full justify-center"
                  >
                    Open Workspace
                  </button>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setMobileOpen(false)}
                      className="block text-center py-3 font-mono text-xs uppercase tracking-widest text-[#f2f2ef]/70 hover:text-white"
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setMobileOpen(false)}
                      className="btn-dn-primary w-full justify-center"
                    >
                      Get Started
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
