import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'

export default function FinalCTA() {
  return (
    <section className="py-28 md:py-44 border-b border-white/[0.08] relative overflow-hidden bg-[#080808]">
      <div className="dn-container relative z-10">

        {/* Section Marker */}
        <div className="editorial-label">
          <span className="num">(08)</span>
          <span>Deploy Autonomous Investigation</span>
        </div>

        {/* Massive Headline */}
        <div className="max-w-5xl my-10 md:my-16">
          <h2 className="font-display font-extrabold text-[clamp(2.5rem,7vw,6.5rem)] uppercase leading-[0.94] tracking-[-0.04em] text-[#f2f2ef]">
            Stop guessing<span className="text-[#d4ff58]">.</span>
            <br />
            Start <span className="text-[#d4ff58] italic font-normal">investigating</span> your data<span className="text-[#d4ff58]">.</span>
          </h2>
        </div>

        {/* Subtitle & Action */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end pt-8 md:pt-16 border-t border-white/[0.08]">
          <div className="lg:col-span-7">
            <p className="text-base sm:text-xl text-[#f2f2ef]/60 leading-relaxed font-sans max-w-xl">
              Give DataPilot a business question and let seven autonomous AI agents analyze your datasets, 
              test candidate hypotheses, and certify root causes.
            </p>
          </div>

          <div className="lg:col-span-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-start lg:justify-end gap-4">
            <Link
              to="/register"
              className="btn-dn-primary group"
            >
              <span>Start an Investigation</span>
              <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </div>

      </div>
    </section>
  )
}
