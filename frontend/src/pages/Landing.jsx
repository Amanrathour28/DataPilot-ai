import Navbar from '../components/landing/Navbar'
import Hero from '../components/landing/Hero'
import CapabilityStrip from '../components/landing/CapabilityStrip'
import ProblemComparison from '../components/landing/ProblemComparison'
import InvestigationWorkflow from '../components/landing/InvestigationWorkflow'
import AgentNetwork from '../components/landing/AgentNetwork'
import HypothesisTree from '../components/landing/HypothesisTree'
import RagDataSection from '../components/landing/RagDataSection'
import EvidenceExplorer from '../components/landing/EvidenceExplorer'
import CorrelationSection from '../components/landing/CorrelationSection'
import InvestigationTimeline from '../components/landing/InvestigationTimeline'
import MemorySection from '../components/landing/MemorySection'
import SecuritySection from '../components/landing/SecuritySection'
import TechArchitecture from '../components/landing/TechArchitecture'
import FinalCTA from '../components/landing/FinalCTA'
import Footer from '../components/landing/Footer'

export default function Landing() {
  return (
    <div className="bg-[#0f0f1a] text-slate-100 min-h-screen font-sans antialiased selection:bg-indigo-500/30 selection:text-white">
      {/* Premium Sticky Navigation Bar */}
      <Navbar />

      {/* Hero Section */}
      <Hero />

      {/* Capability Strip */}
      <CapabilityStrip />

      {/* Problem Section ( dashboards vs investigation comparison ) */}
      <ProblemComparison />

      {/* Investigation Pipeline (How It Works) */}
      <InvestigationWorkflow />

      {/* Agent Network Visualization */}
      <AgentNetwork />

      {/* Hypothesis Tree Visualization */}
      <HypothesisTree />

      {/* Rag + Data streams fusion section */}
      <RagDataSection />

      {/* Evidence Explorer Result Cards */}
      <EvidenceExplorer />

      {/* Correlation vs Causation Analysis Section */}
      <CorrelationSection />

      {/* Real-time Investigation Event Timeline */}
      <InvestigationTimeline />

      {/* Memory & Personalization Section */}
      <MemorySection />

      {/* Security Features */}
      <SecuritySection />

      {/* Technology Architecture Layer Stack */}
      <TechArchitecture />

      {/* Final Call to Action */}
      <FinalCTA />

      {/* Landing Footer */}
      <Footer />
    </div>
  )
}
