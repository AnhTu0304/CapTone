import React from 'react';
import HealBotAnimation from './HealBotAnimation';
import './ConnectClusterSection.css';

export const ConnectClusterSection = ({ className = '', onNavigate }) => {
  const handleNav = (e, path) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <section
      className={`connect-cluster-section ${className}`.trim()}
      data-testid="connect-cluster-section"
      aria-label="Kết nối môi trường Kubernetes với SelfHeal"
    >
      {/* Greptile-Inspired Vertical Architectural Background Grid */}
      <div className="ccs-bg-grid" data-testid="ccs-bg-grid" aria-hidden="true">
        <span className="ccs-grid-marker ccs-marker-1" />
        <span className="ccs-grid-marker ccs-marker-2" />
        <span className="ccs-grid-marker ccs-marker-3" />
        <span className="ccs-grid-marker ccs-marker-4" />
        <span className="ccs-grid-marker ccs-marker-5" />
        <span className="ccs-grid-marker ccs-marker-6" />
      </div>

      <div className="ccs-container">
        <div className="ccs-grid">
          {/* ================= LEFT COLUMN ================= */}
          <div className="ccs-left-col">
            <h2 className="ccs-title">
              SelfHeal xây dựng lớp tự phục hồi hạ tầng để bạn an tâm phát triển sản phẩm.
            </h2>

            {/* Dual-Hexagon Connected Pill Button Group */}
            <div className="ccs-btn-group">
              <a
                href="/guide"
                onClick={(e) => handleNav(e, '/guide')}
                className="ccs-btn-left"
              >
                <span>Xem hướng dẫn</span>
              </a>

              <a
                href="/get-started"
                onClick={(e) => handleNav(e, '/get-started')}
                className="ccs-btn-right"
              >
                <span>Bắt đầu ngay</span>
              </a>
            </div>
          </div>

          {/* ================= RIGHT COLUMN: HEALBOT EVOLUTION MASCOT ================= */}
          <div className="ccs-mesh-wrapper" data-testid="ccs-mascot-wrapper">
            <HealBotAnimation />
          </div>
        </div>
      </div>
    </section>
  );
};

export default ConnectClusterSection;
