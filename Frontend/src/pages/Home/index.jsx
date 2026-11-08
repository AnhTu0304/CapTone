import React from 'react';
import HeroSectionSlot from './HeroSectionSlot';
import HowItWorksSection from './components/HowItWorksSection';
import AdaptationLearningSection from './components/AdaptationLearningSection';
import OnboardingWorkflowSection from './components/OnboardingWorkflowSection';
import HumanControlSection from './components/HumanControlSection';
import FAQSection from './components/FAQSection';
import CTASection from '../../components/marketing/CTASection';

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

      {/* 7. FINAL CTA */}
      <section style={{ backgroundColor: 'var(--color-canvas)', borderTop: '1px dashed rgba(61, 59, 79, 0.16)' }}>
        <div className="container-custom">
          <CTASection
            title="Sẵn sàng kết nối môi trường Kubernetes của bạn?"
            description="Cài đặt SelfHeal agent nhẹ nhàng vào cluster của bạn trong chưa đầy 3 phút bằng file helm hoặc kubectl manifest tiêu chuẩn. Không bị khóa vào bất kỳ nhà cung cấp nào."
            primaryButtonText="Bắt đầu ngay"
            secondaryButtonText="Xem hướng dẫn"
            onPrimaryClick={() => onNavigate && onNavigate('/get-started')}
            onSecondaryClick={() => onNavigate && onNavigate('/guide')}
          />
        </div>
      </section>
    </div>
  );
};

export default HomePage;
