import Navbar from '../components/landing/Navbar'
import Hero from '../components/landing/Hero'
import CapabilityStrip from '../components/landing/CapabilityStrip'
import ProblemComparison from '../components/landing/ProblemComparison'
import HeroInvestigationDemo from '../components/landing/HeroInvestigationDemo'
import AgentNetwork from '../components/landing/AgentNetwork'
import EvidenceExplorer from '../components/landing/EvidenceExplorer'
import MetricsSection from '../components/landing/MetricsSection'
import InvestigationWorkflow from '../components/landing/InvestigationWorkflow'
import FAQSection from '../components/landing/FAQSection'
import FinalCTA from '../components/landing/FinalCTA'
import Footer from '../components/landing/Footer'

export default function Landing() {
  return (
    <div className="bg-[#080808] text-[#f2f2ef] min-h-screen font-sans antialiased selection:bg-[#d4ff58] selection:text-black">
      
      {/* Navigation */}
      <Navbar />

      {/* Hero */}
      <Hero />

      {/* Capability Marquee Ticker */}
      <CapabilityStrip />

      {/* (01) What DataPilot Does */}
      <ProblemComparison />

      {/* (02) The Investigation Experience / Case Study */}
      <HeroInvestigationDemo />

      {/* (03) The Specialized Agents */}
      <AgentNetwork />

      {/* (04) The Evidence Trail */}
      <EvidenceExplorer />

      {/* (05) System Metrics */}
      <MetricsSection />

      {/* (06) How DataPilot Investigates */}
      <InvestigationWorkflow />

      {/* (07) Questions, Answered (FAQ) */}
      <FAQSection />

      {/* (08) Final CTA */}
      <FinalCTA />

      {/* Footer */}
      <Footer />

    </div>
  )
}
