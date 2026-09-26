import React, { useState, useRef } from 'react';
import { 
  ArrowRight, 
  BookOpen, 
  Layers, 
  Brain, 
  Shield, 
  Activity, 
  Sparkles, 
  Zap 
} from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import HeroDashboardLive from './components/HeroDashboardLive';
import FloatingCard from './components/FloatingCard';
import FeatureStrip from './components/FeatureStrip';
import HeroAmbientDecor from './components/HeroAmbientDecor';

gsap.registerPlugin(useGSAP);

export const HeroSection = ({ onNavigate }) => {
  const containerRef = useRef(null);
  const tiltBoxRef = useRef(null);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });

  const { contextSafe } = useGSAP({ scope: containerRef });

  const handleMouseMove = contextSafe((e) => {
    if (!containerRef.current || !tiltBoxRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2; // -1 to 1
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2; // -1 to 1

    // GSAP 3D Tilt with smooth spring deceleration
    gsap.to(tiltBoxRef.current, {
      rotateY: -5.5 + x * 5.0,
      rotateX: 2.5 - y * 4.0,
      duration: 0.5,
      ease: 'power2.out',
      overwrite: 'auto',
    });

    // Multi-plane parallax on floating YAML diff card
    const yamlCard = tiltBoxRef.current.querySelector('.hero-yaml-diff-card');
    if (yamlCard) {
      gsap.to(yamlCard, {
        x: x * 16,
        y: y * 12,
        duration: 0.6,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    }

    // Parallax on ambient floating cards
    const floatingCards = containerRef.current.querySelectorAll('.floating-card-slot');
    floatingCards.forEach((card, index) => {
      const factor = (index % 2 === 0 ? 1 : -1) * (14 + index * 4);
      gsap.to(card, {
        x: x * factor,
        y: y * factor * 0.7,
        duration: 0.65,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    });

    // Dynamic specular glare position
    const glareX = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const glareY = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setGlarePos({ x: glareX, y: glareY });
  });

  const handleMouseLeave = contextSafe(() => {
    if (tiltBoxRef.current) {
      gsap.to(tiltBoxRef.current, {
        rotateY: -5.5,
        rotateX: 2.5,
        duration: 0.9,
        ease: 'elastic.out(1, 0.6)',
        overwrite: 'auto',
      });

      const yamlCard = tiltBoxRef.current.querySelector('.hero-yaml-diff-card');
      if (yamlCard) {
        gsap.to(yamlCard, {
          x: 0,
          y: 0,
          duration: 0.8,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      }
    }

    if (containerRef.current) {
      const floatingCards = containerRef.current.querySelectorAll('.floating-card-slot');
      floatingCards.forEach((card) => {
        gsap.to(card, {
          x: 0,
          y: 0,
          duration: 0.85,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      });
    }

    setGlarePos({ x: 50, y: 50 });
  });

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
      <section
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="hero-section"
        style={{
          position: 'relative',
          backgroundColor: 'var(--bg-canvas)',
          paddingTop: '48px',
          paddingBottom: '90px',
          overflow: 'visible',
          borderBottom: '1px dashed rgba(61, 59, 79, 0.16)',
        }}
      >
        {/* Full-Bleed Canvas Container with 1400px Guideline Rails */}
        <div
          className="hero-full-canvas"
          style={{
            width: '100%',
            maxWidth: 'var(--content-max-width)',
            margin: '0 auto',
            padding: '0 var(--space-6)',
            position: 'relative',
            zIndex: 2,
            borderLeft: '1px dashed rgba(61, 59, 79, 0.18)',
            borderRight: '1px dashed rgba(61, 59, 79, 0.18)',
          }}
        >
          <div
            className="hero-grid-layout"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1.38fr',
              gap: '64px',
              alignItems: 'center',
            }}
          >
            {/* ================= LEFT COLUMN ================= */}
            <div className="hero-left-col" style={{ maxWidth: '580px' }}>
              
              {/* Main Heading without badge */}
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(2.75rem, 4.8vw, 4.25rem)',
                  fontWeight: 800,
                  lineHeight: 1.08,
                  letterSpacing: '-0.035em',
                  color: 'var(--color-ink)',
                  marginBottom: '24px',
                }}
              >
                Quan sát. Dự đoán.{' '}
                <span
                  style={{
                    color: 'var(--color-accent)',
                    display: 'inline-block',
                  }}
                >
                  Khôi phục.
                </span>
              </h1>

              {/* Subtitle */}
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '1.125rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  marginBottom: '36px',
                }}
              >
                SelfHeal giúp các doanh nghiệp vừa và nhỏ giám sát môi trường Kubernetes, dự đoán các sự cố tiềm ẩn và tự động khôi phục dịch vụ — với sự giám sát của con người khi cần thiết.
              </p>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  flexWrap: 'wrap',
                  marginBottom: '42px',
                }}
              >
                <a
                  href="/get-started"
                  onClick={(e) => handleLinkClick(e, '/get-started')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 28px',
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-canvas)',
                    fontWeight: 600,
                    fontSize: '1rem',
                    fontFamily: 'var(--font-display)',
                    borderRadius: '0px',
                    border: '1px solid var(--color-primary)',
                    boxShadow: 'none',
                    transition: 'transform 0.15s ease, background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#2A2838';
                    e.currentTarget.style.transform = 'translateX(-4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  <span>Bắt đầu ngay</span>
                  <ArrowRight size={17} />
                </a>

                <a
                  href="/guide"
                  onClick={(e) => handleLinkClick(e, '/guide')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 26px',
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-ink)',
                    fontWeight: 600,
                    fontSize: '1rem',
                    fontFamily: 'var(--font-display)',
                    borderRadius: '0px',
                    border: '1px solid var(--color-accent)',
                    boxShadow: 'none',
                    transition: 'transform 0.15s ease, background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1FE092';
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-accent)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  <BookOpen size={17} color="var(--color-ink)" />
                  <span>Xem hướng dẫn</span>
                </a>
              </div>

              {/* 3 Trust Metrics */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  paddingTop: '24px',
                  borderTop: '1px solid var(--border-default)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '0px',
                      backgroundColor: 'rgba(61, 59, 79, 0.08)',
                      color: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    <Layers size={14} />
                  </div>
                  <span style={{ fontWeight: 600 }}>Native Kubernetes</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '0px',
                      backgroundColor: 'rgba(40, 233, 159, 0.15)',
                      color: 'var(--color-accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    <Brain size={14} />
                  </div>
                  <span style={{ fontWeight: 600 }}>Ứng dụng AI</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '0px',
                      backgroundColor: 'rgba(61, 59, 79, 0.08)',
                      color: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    <Shield size={14} />
                  </div>
                  <span style={{ fontWeight: 600 }}>Con người kiểm soát</span>
                </div>
              </div>

            </div>

            {/* ================= RIGHT COLUMN (ENLARGED 3D DASHBOARD & AMBIENT VISUALS) ================= */}
            <div
              className="hero-right-col"
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 10px',
              }}
            >
              {/* 3D Container with gentle perspective and subtle tilt */}
              <div
                className="dashboard-3d-wrapper"
                style={{
                  position: 'relative',
                  perspective: '1400px',
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                {/* 3D Tilt Box - Smooth GSAP 3D Transform with depth */}
                <div
                  ref={tiltBoxRef}
                  className="hero-3d-tilt-box"
                  style={{
                    transform: 'rotateY(-5.5deg) rotateX(2.5deg) translateZ(0)',
                    transformStyle: 'preserve-3d',
                    position: 'relative',
                    width: '100%',
                    maxWidth: '860px',
                    zIndex: 10,
                    willChange: 'transform',
                  }}
                >
                  <HeroDashboardLive glarePos={glarePos} />
                </div>

                {/* 3D Ambient Visual Elements (Kubernetes Halo Wheel & Floating Isometric Cubes) */}
                <HeroAmbientDecor />

                {/* ================= 4 FLOATING GLASSMORPHIC CARDS =================
                    Carefully positioned OUTSIDE the dashboard data areas so they NEVER occlude
                    metrics, charts, or recent activity!
                */}
                
                {/* CARD 1: Giám sát (Top-Left, above search bar) */}
                <div
                  className="floating-card-slot floating-card-tl"
                  style={{
                    position: 'absolute',
                    top: '-36px',
                    left: '-15px',
                    zIndex: 25,
                  }}
                >
                  <FloatingCard
                    icon={Activity}
                    iconBg="#ECFDF5"
                    iconColor="#059669"
                    category="Giám sát"
                    title="CPU: 42%"
                    metric="↓ 6,2%"
                    badge="Hệ thống bình thường"
                    badgeType="success"
                    animationName="emergeOrbitDissolveTL"
                    animationDuration="11s"
                    animationDelay="0s"
                  />
                </div>

                {/* CARD 2: Dự đoán AI (Top-Right, above status pill & avatar) */}
                <div
                  className="floating-card-slot floating-card-tr"
                  style={{
                    position: 'absolute',
                    top: '-45px',
                    right: '-25px',
                    zIndex: 25,
                  }}
                >
                  <FloatingCard
                    icon={Sparkles}
                    iconBg="#F5F3FF"
                    iconColor="#7C3AED"
                    category="Dự đoán AI"
                    title="Bất thường bộ nhớ"
                    badge="Rủi ro: Trung bình"
                    badgeType="warning"
                    animationName="emergeOrbitDissolveTR"
                    animationDuration="11s"
                    animationDelay="2.8s"
                  />
                </div>

                {/* CARD 3: Tự phục hồi (Bottom-Left, in margin outside the sidebar base) */}
                <div
                  className="floating-card-slot floating-card-bl"
                  style={{
                    position: 'absolute',
                    bottom: '24px',
                    left: '-75px',
                    zIndex: 25,
                  }}
                >
                  <FloatingCard
                    icon={Zap}
                    iconBg="#ECFDF5"
                    iconColor="#059669"
                    category="Tự phục hồi"
                    title="Pod khởi động lại thành công"
                    badge="✔ Phục hồi: 4,2s"
                    badgeType="success"
                    animationName="emergeOrbitDissolveBL"
                    animationDuration="11s"
                    animationDelay="5.5s"
                  />
                </div>

                {/* CARD 4: Kubernetes (Mid-Right, floating in the right margin) */}
                <div
                  className="floating-card-slot floating-card-mr"
                  style={{
                    position: 'absolute',
                    top: '28%',
                    right: '-75px',
                    zIndex: 25,
                  }}
                >
                  <FloatingCard
                    icon={Layers}
                    iconBg="#EFF6FF"
                    iconColor="#2563EB"
                    category="Kubernetes"
                    title="24 Pod • 8 Service"
                    badge="Đã kết nối"
                    badgeType="info"
                    animationName="emergeOrbitDissolveMR"
                    animationDuration="11s"
                    animationDelay="8.2s"
                  />
                </div>

              </div>
            </div>

          </div>

          {/* Blueprint Corner Crosshairs (+) on Hero Border */}
          <span className="blueprint-crosshair bp-ch-bl" aria-hidden="true">+</span>
          <span className="blueprint-crosshair bp-ch-br" aria-hidden="true">+</span>

          {/* Hexagonal Bolt Anchor Marker at Bottom-Left Guide Line */}
          <span className="blueprint-bolt-anchor blueprint-bolt-left" aria-hidden="true" title="Anchor Bolt Marker">
            <svg width="13" height="15" viewBox="0 0 13 15" fill="none">
              <polygon points="6.5,0.5 12.5,4 12.5,11 6.5,14.5 0.5,11 0.5,4" fill="#8B8999" stroke="#686677" strokeWidth="1" opacity="0.85" />
            </svg>
          </span>
        </div>
      </section>

      {/* ================= SUB-HERO FEATURE STRIP ================= */}
      <FeatureStrip />

      <style>{`
        /* ================= 3D EMERGE -> ORBIT -> DISSOLVE ANIMATIONS ================= */
        @keyframes emergeOrbitDissolveTL {
          0% {
            opacity: 0;
            transform: translate3d(0, 16px, -35px) scale(0.88);
          }
          15% {
            opacity: 1;
            transform: translate3d(0, 0, 10px) scale(1);
          }
          65% {
            opacity: 1;
            transform: translate3d(-6px, -6px, 15px) scale(1);
          }
          85%, 100% {
            opacity: 0;
            transform: translate3d(-10px, -18px, 25px) scale(1.04);
          }
        }

        @keyframes emergeOrbitDissolveTR {
          0% {
            opacity: 0;
            transform: translate3d(0, 16px, -35px) scale(0.88);
          }
          15% {
            opacity: 1;
            transform: translate3d(0, 0, 10px) scale(1);
          }
          65% {
            opacity: 1;
            transform: translate3d(6px, -6px, 15px) scale(1);
          }
          85%, 100% {
            opacity: 0;
            transform: translate3d(12px, -18px, 25px) scale(1.04);
          }
        }

        @keyframes emergeOrbitDissolveBL {
          0% {
            opacity: 0;
            transform: translate3d(0, 16px, -35px) scale(0.88);
          }
          15% {
            opacity: 1;
            transform: translate3d(0, 0, 10px) scale(1);
          }
          65% {
            opacity: 1;
            transform: translate3d(-8px, 4px, 15px) scale(1);
          }
          85%, 100% {
            opacity: 0;
            transform: translate3d(-14px, -12px, 25px) scale(1.04);
          }
        }

        @keyframes emergeOrbitDissolveMR {
          0% {
            opacity: 0;
            transform: translate3d(0, 16px, -35px) scale(0.88);
          }
          15% {
            opacity: 1;
            transform: translate3d(0, 0, 10px) scale(1);
          }
          65% {
            opacity: 1;
            transform: translate3d(8px, 2px, 15px) scale(1);
          }
          85%, 100% {
            opacity: 0;
            transform: translate3d(14px, -14px, 25px) scale(1.04);
          }
        }

        /* Responsive Breakpoints */
        @media (max-width: 1240px) {
          .hero-grid-layout {
            grid-template-columns: 1fr !important;
            gap: 56px !important;
          }
          .hero-left-col {
            max-width: 100% !important;
            text-align: center;
          }
          .hero-left-col > div {
            justify-content: center !important;
          }
          .dashboard-3d-wrapper > div:first-child {
            transform: none !important;
          }
          .floating-card-mr {
            right: -10px !important;
          }
          .floating-card-bl {
            left: -15px !important;
          }
        }

        @media (max-width: 768px) {
          .floating-card-slot {
            position: static !important;
            transform: none !important;
            margin: 6px 0;
            width: 100% !important;
          }
          .hero-floating-card {
            animation: none !important;
            opacity: 1 !important;
            width: 100% !important;
          }
          .dashboard-3d-wrapper {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
        }
      `}</style>
    </>
  );
};

export default HeroSection;
