import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'

const revealVariant = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      delay: i * 0.12,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
}

export default function Hero() {
  return (
    <section className="relative min-h-[92vh] flex flex-col justify-between pt-36 pb-16 md:pt-48 md:pb-24 border-b border-white/[0.08]">
      <div className="dn-container relative z-10 flex flex-col justify-between flex-1">
        
        {/* Top Eyebrow & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 md:pb-16 border-b border-white/[0.08]">
          <motion.div
            custom={0}
            initial="hidden"
            animate="visible"
            variants={revealVariant}
            className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-[#f2f2ef]/50"
          >
            <span className="w-2 h-2 rounded-full bg-[#d4ff58] animate-pulse" />
            <span>Autonomous Multi-Agent Investigation</span>
          </motion.div>

          <motion.div
            custom={1}
            initial="hidden"
            animate="visible"
            variants={revealVariant}
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#f2f2ef]/40"
          >
            Delhi / India · Autonomous Engine
          </motion.div>
        </div>

        {/* Massive Editorial Headline */}
        <div className="py-12 md:py-20 max-w-6xl">
          <motion.h1
            custom={2}
            initial="hidden"
            animate="visible"
            variants={revealVariant}
            className="font-display font-extrabold uppercase text-[clamp(2.75rem,7.5vw,7.25rem)] leading-[0.92] tracking-[-0.04em] text-[#f2f2ef]"
          >
            Ask the question<span className="text-[#d4ff58]">.</span>
            <br />
            Let your data{' '}
            <span className="text-[#d4ff58] italic font-normal">investigate</span> the answer<span className="text-[#d4ff58]">.</span>
          </motion.h1>
        </div>

        {/* Bottom Sub-statement & CTAs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end pt-8 md:pt-16 border-t border-white/[0.08]">
          <motion.div
            custom={3}
            initial="hidden"
            animate="visible"
            variants={revealVariant}
            className="lg:col-span-7"
          >
            <p className="text-base sm:text-xl text-[#f2f2ef]/60 leading-relaxed font-sans max-w-2xl">
              DataPilot is an autonomous multi-agent platform that inspects datasets, tests 
              hypotheses, cross-references documents, and delivers verified root-cause explanations with statistical proof.
            </p>
          </motion.div>

          <motion.div
            custom={4}
            initial="hidden"
            animate="visible"
            variants={revealVariant}
            className="lg:col-span-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-start lg:justify-end gap-4"
          >
            <Link
              to="/register"
              className="btn-dn-primary group"
            >
              <span>Start an Investigation</span>
              <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <a
              href="#how-it-works"
              className="btn-dn-outline"
            >
              <span>How It Works</span>
            </a>
          </motion.div>
        </div>

      </div>
    </section>
  )
}
