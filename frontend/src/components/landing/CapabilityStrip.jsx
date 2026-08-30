const TICKER_ITEMS = [
  'AI INVESTIGATION',
  'MULTI-AGENT ORCHESTRATION',
  'STRUCTURED DATA ANALYSIS',
  'PYTHON SANDBOX EXECUTION',
  'VECTOR RAG RETRIEVAL',
  'HYPOTHESIS TESTING',
  'EVIDENCE VERIFICATION',
  'ROOT CAUSE ANALYSIS',
  'CRITIC CAUSAL AUDITING',
  'STATISTICAL PROFILING',
]

const ITEMS = [...TICKER_ITEMS, ...TICKER_ITEMS]

export default function CapabilityStrip() {
  return (
    <div className="w-full border-b border-white/[0.08] py-5 overflow-hidden bg-[#0a0a0a]">
      <div className="animate-marquee flex items-center whitespace-nowrap">
        {ITEMS.map((item, idx) => (
          <div key={idx} className="flex items-center group cursor-default">
            <span className="font-display font-bold text-xs md:text-sm uppercase tracking-[0.2em] text-[#f2f2ef]/40 px-6 group-hover:text-[#d4ff58] transition-colors duration-200">
              {item}
            </span>
            <span className="text-[#d4ff58]/40 font-mono text-xs">/</span>
          </div>
        ))}
      </div>
    </div>
  )
}
