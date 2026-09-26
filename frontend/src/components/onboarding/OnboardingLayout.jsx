import React from 'react';
import OnboardingHeader from './OnboardingHeader';
import OnboardingProgress from './OnboardingProgress';

export const OnboardingLayout = ({
  currentStep = 1,
  onStepClick,
  onNavigate,
  children,
}) => {
  return (
    <div
      className="onboarding-layout-root"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-primary)',
        position: 'relative',
      }}
    >
      {/* Top Global Onboarding Header */}
      <OnboardingHeader onNavigate={onNavigate} />

      {/* Main Content Area: 2-Column Responsive Layout */}
      <div
        className="onboarding-main-container"
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 'var(--content-max-width)',
          margin: '0 auto',
          padding: '32px var(--space-6)',
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          gap: '48px',
          alignItems: 'start',
          position: 'relative',
        }}
      >
        {/* Left Column: Progress Stepper & Explanations (Desktop sticky, Mobile top bar) */}
        <aside
          className="onboarding-left-col"
          style={{
            position: 'sticky',
            top: '84px',
          }}
        >
          <OnboardingProgress currentStep={currentStep} onStepClick={onStepClick} />
        </aside>

        {/* Right Column: Centered Form Content Box with Technical Blueprint Corner Crosshairs */}
        <main
          className="onboarding-right-col"
          style={{
            width: '100%',
            maxWidth: '720px',
            margin: '0 auto',
            position: 'relative',
            backgroundColor: 'transparent',
          }}
        >
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .onboarding-main-container {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
            padding: 16px 20px !important;
          }
          .onboarding-left-col {
            position: static !important;
          }
          .onboarding-right-col {
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
};

export default OnboardingLayout;
