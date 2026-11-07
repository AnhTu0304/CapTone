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
              <h1 className="hero-heading">
                Quan sát. Dự đoán.{' '}
                <span className="hero-heading-accent">Khôi phục.</span>
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
                >
                  <span>Bắt đầu ngay</span>
                  <ArrowRight size={17} />
                </a>

                <a
                  href="/guide"
                  onClick={(e) => handleLinkClick(e, '/guide')}
                  className="hero-btn-secondary"
                >
                  <BookOpen size={17} color="var(--color-ink)" />
                  <span>Xem hướng dẫn</span>
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

      {/* ================= SUB-HERO FEATURE STRIP ================= */}
      <FeatureStrip />
    </>
  );
};

export default HeroSection;
