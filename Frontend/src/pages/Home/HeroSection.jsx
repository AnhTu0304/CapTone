import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BookOpen } from 'lucide-react';
import ChickenMascot from '../../components/mascot/ChickenMascot';
import SocialProofSection from './components/SocialProofSection';
import FeatureStrip from './components/FeatureStrip';
import './HeroSection.css';

export const HeroSection = ({ onNavigate }) => {
  const { t } = useTranslation('home');
  const handleLinkClick = (e, path) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <>
      <section className="hero-section">
        <div className="hero-full-canvas">
          <div className="hero-grid-layout">
            {/* ================= LEFT COLUMN ================= */}
            <div className="hero-left-col">
              <h1 className="hero-heading font-anybody text-slate font-bold tracking-tight animate-hero-fade-up">
                {t('hero.heading')}
              </h1>

              <p className="hero-description font-dm-sans">
                {t('hero.description')}
              </p>

              <div className="hero-cta-group">
                <a
                  href="/login"
                  onClick={(e) => handleLinkClick(e, '/login')}
                  className="hero-btn-primary"
                  title={t('hero.startNow')}
                >
                  <span>{t('hero.startNow')}</span>
                  <ArrowRight size={18} strokeWidth={2.2} />
                </a>

                <a
                  href="/guide"
                  onClick={(e) => handleLinkClick(e, '/guide')}
                  className="hero-btn-secondary"
                  title={t('hero.viewGuide')}
                >
                  <BookOpen size={18} strokeWidth={2.2} color="#000000" />
                  <span>{t('hero.viewGuide')}</span>
                </a>
              </div>

              <div className="hero-sublink-wrapper">
                <a
                  href="/guide"
                  onClick={(e) => handleLinkClick(e, '/guide')}
                  className="hero-sublink"
                >
                  {t('hero.sublink')}
                </a>
              </div>
            </div>

            {/* ================= RIGHT COLUMN (HALFTONE CHICKEN MASCOT) ================= */}
            <div className="hero-right-col">
              <ChickenMascot />
            </div>
          </div>
        </div>
      </section>

      {/* ================= SOCIAL PROOF & PLATFORM OVERVIEW (4 CORE TOOLS + QUOTE) ================= */}
      <SocialProofSection onNavigate={onNavigate} />

      {/* ================= SUB-HERO AGENT BRIDGE BANNER ================= */}
      <FeatureStrip onNavigate={onNavigate} />
    </>
  );
};

export default HeroSection;
