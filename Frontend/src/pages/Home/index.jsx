import React, { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import HeroSectionSlot from './HeroSectionSlot';
import HowItWorksSection from './components/HowItWorksSection';
import AdaptationLearningSection from './components/AdaptationLearningSection';
import OnboardingWorkflowSection from './components/OnboardingWorkflowSection';
import HumanControlSection from './components/HumanControlSection';
import FAQSection from './components/FAQSection';
import ConnectClusterSection from './components/ConnectClusterSection';

gsap.registerPlugin(ScrollTrigger, useGSAP);

export const HomePage = ({ onNavigate, reducedMotion = false }) => {
  const homeRef = useRef(null);

  useGSAP(
    () => {
      const rootEl = homeRef.current;
      if (!rootEl || reducedMotion) return undefined;

      // Note: We use native browser scrolling (no wheel hijacking) so that
      // mouse scroll speed matches other pages, while ScrollTrigger drives visual entrance effects.

      // --- GSAP ScrollTrigger Animations for Each Section ---

      // 1. Hero parallax on scroll
      const heroRightCol = rootEl.querySelector('.hero-right-col');
      if (heroRightCol) {
        gsap.fromTo(
          heroRightCol,
          { y: 0 },
          {
            y: -45,
            ease: 'none',
            scrollTrigger: {
              trigger: '.hero-section',
              start: 'top top',
              end: 'bottom top',
              scrub: 0.5,
            },
          }
        );
      }

      // 2. SocialProofSection: 4 tool logo cells staggered entrance
      const toolCells = gsap.utils.toArray('.sp-tool-cell', rootEl);
      if (toolCells.length > 0) {
        gsap.fromTo(
          toolCells,
          { y: 36, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.7,
            stagger: 0.1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: '.sp-tools-block',
              start: 'top 90%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      }

      // 2b. SocialProofSection: Framed quote card entrance
      const quoteCard = rootEl.querySelector('.sp-overview-framed-card');
      if (quoteCard) {
        gsap.fromTo(
          quoteCard,
          { y: 48, opacity: 0, scale: 0.97 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.85,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: quoteCard,
              start: 'top 86%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      }

      // 3. FeatureStrip: Agent bridge banner entrance
      const agentBox = rootEl.querySelector('.agent-framed-box-wrapper');
      if (agentBox) {
        gsap.fromTo(
          agentBox,
          { y: 44, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: '.agent-bridge-banner',
              start: 'top 86%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      }

      // 4. HowItWorksSection: 3 Runbook step cards staggered entrance
      const hiwCards = gsap.utils.toArray('.hiw-card', rootEl);
      if (hiwCards.length > 0) {
        gsap.fromTo(
          hiwCards,
          { y: 56, opacity: 0, scale: 0.97 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.85,
            stagger: 0.15,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: '.hiw-grid',
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      }

      // 5. AdaptationLearningSection: Header + 2 Adaptive cards
      const alsHeader = rootEl.querySelector('.als-header-container');
      if (alsHeader) {
        gsap.fromTo(
          alsHeader,
          { y: 36, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.75,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: alsHeader,
              start: 'top 88%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      }

      const alsCards = gsap.utils.toArray('.als-card', rootEl);
      if (alsCards.length > 0) {
        gsap.fromTo(
          alsCards,
          { y: 52, opacity: 0, scale: 0.97 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.85,
            stagger: 0.16,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: '.als-grid',
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      }

      // 6. OnboardingWorkflowSection: Header + 4 workflow cards
      const owsHeader = rootEl.querySelector('.ows-header-container');
      if (owsHeader) {
        gsap.fromTo(
          owsHeader,
          { y: 36, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.75,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: owsHeader,
              start: 'top 88%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      }

      const owsCards = gsap.utils.toArray('.ows-card', rootEl);
      if (owsCards.length > 0) {
        gsap.fromTo(
          owsCards,
          { y: 48, opacity: 0, scale: 0.97 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.8,
            stagger: 0.12,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: '.ows-grid',
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      }

      // 7. HumanControlSection: Header & Interactive stage
      const hcsHeader = rootEl.querySelector('.hcs-header-container');
      if (hcsHeader) {
        gsap.fromTo(
          hcsHeader,
          { y: 36, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.75,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: hcsHeader,
              start: 'top 88%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      }

      const hcsStage = rootEl.querySelector('.hcs-canvas-wrapper');
      if (hcsStage) {
        gsap.fromTo(
          hcsStage,
          { y: 48, opacity: 0, scale: 0.97 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.85,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: hcsStage,
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      }

      // 8. FAQSection: FAQ items staggered entrance
      const faqItems = gsap.utils.toArray('.faq-item', rootEl);
      if (faqItems.length > 0) {
        gsap.fromTo(
          faqItems,
          { y: 32, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.65,
            stagger: 0.08,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: '.faq-list',
              start: 'top 86%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      }

      // 9. ConnectClusterSection: Final CTA stage smooth scale-in
      const ccsGrid = rootEl.querySelector('.ccs-grid');
      if (ccsGrid) {
        gsap.fromTo(
          ccsGrid,
          { y: 44, scale: 0.96, opacity: 0 },
          {
            y: 0,
            scale: 1,
            opacity: 1,
            duration: 0.85,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: ccsGrid,
              start: 'top 86%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      }

      // Refresh ScrollTrigger positions once layout settles
      const refreshTimer = setTimeout(() => {
        ScrollTrigger.refresh();
      }, 150);

      return () => {
        clearTimeout(refreshTimer);
      };
    },
    { scope: homeRef, dependencies: [reducedMotion] }
  );

  return (
    <div className="home-page" ref={homeRef}>
      {/* 1. HERO SECTION (INCL. HERO CANVAS, SOCIAL PROOF & AGENT BRIDGE BANNER) */}
      <div id="overview">
        <HeroSectionSlot onNavigate={onNavigate} />
      </div>

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
