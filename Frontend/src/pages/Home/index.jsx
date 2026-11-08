import React from 'react';
import HeroSectionSlot from './HeroSectionSlot';
import HowItWorksSection from './components/HowItWorksSection';
import AdaptationLearningSection from './components/AdaptationLearningSection';
import OnboardingWorkflowSection from './components/OnboardingWorkflowSection';
import HumanControlSection from './components/HumanControlSection';
import FAQSection from './components/FAQSection';
import ConnectClusterSection from './components/ConnectClusterSection';

export const HomePage = ({ onNavigate }) => {
  return (
    <div className="home-page">
      {/* 1. HERO SECTION + [ AGENT ] BRIDGE BANNER */}
      <HeroSectionSlot onNavigate={onNavigate} />

      {/* 2. [ HOW IT WORKS ] 3-STEP CYBERNETIC BLUEPRINT SECTION */}
      <HowItWorksSection />

      {/* 3. [ ADAPTATION & LEARNING ] CONTINUOUS POLICY ADAPTATION SECTION */}
      <AdaptationLearningSection onNavigate={onNavigate} />

      {/* 4. [ YOUR WORKFLOW ] 4-STEP ONBOARDING & LAUNCH SECTION */}
      <OnboardingWorkflowSection onNavigate={onNavigate} />

      {/* 5. [ HUMAN CONTROL ] CYBERNETIC AUTONOMOUS CONTROL & VERIFICATION SECTION */}
      <HumanControlSection onNavigate={onNavigate} />

      {/* 6. [ FAQ ] CAD ACCORDION WITH CONSTELLATION GRIDS */}
      <FAQSection onNavigate={onNavigate} />

      {/* 7. [ CONNECT CLUSTER ] GREPTILE DARK NAVY FINAL CTA WITH SATELLITE MESH */}
      <ConnectClusterSection onNavigate={onNavigate} />
    </div>
  );
};

export default HomePage;
