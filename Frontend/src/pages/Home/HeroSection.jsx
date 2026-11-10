import React from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';
import ChickenMascot from '../../components/mascot/ChickenMascot';
import FeatureStrip from './components/FeatureStrip';
import './HeroSection.css';

export const HeroSection = ({ onNavigate }) => {
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
              <h1 className="hero-heading font-anybody text-slate text-6xl font-bold tracking-tight leading-[0.9] animate-hero-fade-up">
                AI Self <br className="hero-title-break" />
                Healing
              </h1>

              <p className="hero-description">
                SelfHeal giúp các doanh nghiệp vừa và nhỏ giám sát môi trường
                Kubernetes, dự đoán các sự cố tiềm ẩn và tự động khôi phục dịch
                vụ — với sự giám sát của con người khi cần thiết.
              </p>

              <div className="hero-cta-group">
                <a
                  href="/get-started"
                  onClick={(e) => handleLinkClick(e, '/get-started')}
                  className="hero-btn-primary"
                  title="Bắt đầu ngay"
                >
                  <span>Bắt đầu ngay</span>
                  <ArrowRight size={18} strokeWidth={2.2} />
                </a>

                <a
                  href="/guide"
                  onClick={(e) => handleLinkClick(e, '/guide')}
                  className="hero-btn-secondary"
                  title="Xem hướng dẫn"
                >
                  <BookOpen size={18} strokeWidth={2.2} color="#000000" />
                  <span>Xem hướng dẫn</span>
                </a>
              </div>

              <div className="hero-sublink-wrapper">
                <a
                  href="/guide"
                  onClick={(e) => handleLinkClick(e, '/guide')}
                  className="hero-sublink"
                >
                  onboard with your agent &rarr;
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

      {/* ================= SUB-HERO AGENT BRIDGE BANNER ================= */}
      <FeatureStrip onNavigate={onNavigate} />
    </>
  );
};

export default HeroSection;
