import React from 'react';
import { ArrowRight } from 'lucide-react';
import logoPng from '../../../assets/Logo-transparent.png';
import kubernetesLogo from '../../../assets/kubernetes-logo.png';
import dockerLogo from '../../../assets/docker-logo.png';
import prometheusLogo from '../../../assets/prometheus-icon.png';
import grafanaLogo from '../../../assets/grafana-icon.png';
import './SocialProofSection.css';

export const SocialProofSection = ({ onNavigate }) => {
  const handleCtaClick = (e, path) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const coreTools = [
    {
      name: 'Kubernetes',
      logo: kubernetesLogo,
    },
    {
      name: 'Docker',
      logo: dockerLogo,
    },
    {
      name: 'Prometheus',
      logo: prometheusLogo,
    },
    {
      name: 'Grafana',
      logo: grafanaLogo,
    },
  ];

  return (
    <section
      className="social-proof-section"
      data-testid="social-proof-section"
      aria-label="Hệ sinh thái công cụ cốt lõi và tổng quan nền tảng"
    >
      {/* ================= 1. HÀNG 4 LOGO CÔNG CỤ CỐT LÕI (FULL-WIDTH TOÀN MÀN HÌNH) ================= */}
      <div className="sp-tools-block" role="region" aria-label="Các công cụ cốt lõi tích hợp">
        <div className="sp-tools-grid" role="list">
          {coreTools.map((tool) => (
            <div key={tool.name} className="sp-tool-cell" role="listitem">
              <div className="sp-tool-logo-wrapper" title={tool.name}>
                <img
                  src={tool.logo}
                  alt={`${tool.name} Logo`}
                  className="sp-tool-logo-img"
                  width={28}
                  height={28}
                />
                <span className="sp-tool-name">{tool.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ================= 2. KHUNG TRÍCH DẪN TỔNG QUAN DỰ ÁN (TRANSPARENT FRAME) ================= */}
      <div className="sp-inner-container">
        <div className="sp-overview-framed-card" data-testid="sp-overview-card">
          {/* 4 Chốt định vị góc chữ thập CAD */}
          <span className="sp-corner-pin pin-top-left" aria-hidden="true">+</span>
          <span className="sp-corner-pin pin-top-right" aria-hidden="true">+</span>
          <span className="sp-corner-pin pin-bottom-left" aria-hidden="true">+</span>
          <span className="sp-corner-pin pin-bottom-right" aria-hidden="true">+</span>

          {/* Biểu tượng ngoặc kép kỹ thuật CAD */}
          <div className="sp-quote-glyph-wrapper" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sp-quote-glyph">
              <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2H4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h4" />
              <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2h-4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h4" />
            </svg>
          </div>

          {/* Tiêu đề trích dẫn mô tả tổng quát dự án */}
          <blockquote className="sp-quote-text">
            &ldquo;SelfHeal là nền tảng AI tự hành giám sát và dự báo sớm nguy cơ hạ tầng với sự kiểm soát minh bạch của con người.&rdquo;
          </blockquote>


          {/* Nút hành động cắt góc (Chamfered Hexagonal Button) */}
          <div className="sp-action-wrapper">
            <a
              href="/features"
              onClick={(e) => handleCtaClick(e, '/features')}
              className="sp-hex-btn"
              title="Khám phá kiến trúc hệ thống"
            >
              <span>Khám phá kiến trúc hệ thống</span>
              <ArrowRight size={16} strokeWidth={2.2} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SocialProofSection;
