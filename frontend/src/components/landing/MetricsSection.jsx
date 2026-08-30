import { motion } from 'framer-motion'

const METRICS = [
  {
    value: '07',
    label: 'Specialized Agents',
    desc: 'Autonomous multi-agent orchestration graph running concurrent analytical pipelines.',
  },
  {
    value: '06',
    label: 'Investigation Stages',
    desc: 'End-to-end process from goal parsing and SQL slicing to critic causal certification.',
  },
  {
    value: '100%',
    label: 'Evidence Traceability',
    desc: 'Every finding mapped directly to underlying database rows and verified PDF citations.',
  },
  {
    value: '~30s',
    label: 'Avg Execution Latency',
    desc: 'Automated benchmark completion time across multi-dimensional CSV and document corpora.',
  },
]

export default function MetricsSection() {
  return (
    <section id="metrics" className="py-24 md:py-36 border-b border-white/[0.08] bg-[#090909]">
      <div className="dn-container">

        {/* Section Marker */}
        <div className="editorial-label">
          <span className="num">(05)</span>
          <span>System Metrics</span>
        </div>

        {/* Section Headline */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16 md:mb-24">
          <div className="lg:col-span-8">
            <h2 className="font-display font-extrabold text-3xl sm:text-5xl md:text-6xl uppercase tracking-tight text-[#f2f2ef] leading-[1.05]">
              Built for precision<span className="text-[#d4ff58]">.</span>
              <br />
              <span className="text-[#f2f2ef]/40">Engineered for rigor.</span>
            </h2>
          </div>
          <div className="lg:col-span-4 flex flex-col justify-end">
            <p className="text-sm md:text-base text-[#f2f2ef]/60 leading-relaxed font-sans">
              DataPilot combines the speed of autonomous agent execution with the strict mathematical 
              standards required for executive decision making.
            </p>
          </div>
        </div>

        {/* Large Numbers Grid (DayNight Style) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-t border-l border-white/[0.08]">
          {METRICS.map((metric) => (
            <div
              key={metric.label}
              className="border-r border-b border-white/[0.08] p-8 md:p-12 flex flex-col justify-between group hover:bg-white/[0.02] transition-colors"
            >
              <div>
                <span className="font-display font-extrabold text-5xl sm:text-6xl md:text-7xl text-[#f2f2ef] group-hover:text-[#d4ff58] transition-colors duration-200 tracking-tight block mb-4">
                  {metric.value}
                </span>
                <h3 className="font-display font-bold text-lg uppercase tracking-tight text-[#f2f2ef] mb-2">
                  {metric.label}
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-[#f2f2ef]/50 font-sans leading-relaxed mt-4">
                {metric.desc}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
