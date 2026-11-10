import React from 'react';
import './FeatureStrip.css';

export const FeatureStrip = ({ className = '', onNavigate }) => {
  const handleLearnMore = (e) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate('/guide');
    } else {
      window.history.pushState({}, '', '/guide');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <section
      className={`agent-bridge-banner ${className}`.trim()}
      data-testid="agent-bridge-section"
      aria-label="Agent Bridge Section"
    >
      {/* 2. Top Parallel Pinstripe Scanline Bar with Guideline Nodes */}
      <div className="agent-scan-track" aria-hidden="true">
        <span className="agent-track-node agent-node-top-left" />
        <span className="agent-track-node agent-node-top-right" />
      </div>

      {/* 3. Continuous Vertical Guidelines */}
      <span aria-hidden="true" className="agent-guide-v-left" />
      <span aria-hidden="true" className="agent-guide-v-right" />

      {/* 4. Framed Box (Horizontal Tracks + 4 Corner Hexagon Pin Nodes + Inner Content Box) */}
      <div className="agent-framed-box-wrapper">
        {/* Full-width Top Horizontal Guideline */}
        <div className="agent-box-line-track agent-line-top" aria-hidden="true" />

        {/* 4 Corner Hexagon Pin Nodes at the 4 Box Intersections */}
        <span aria-hidden="true" className="agent-corner-pin pin-tl" />
        <span aria-hidden="true" className="agent-corner-pin pin-tr" />
        <span aria-hidden="true" className="agent-corner-pin pin-bl" />
        <span aria-hidden="true" className="agent-corner-pin pin-br" />

        {/* Inner Content Area framed directly between the vertical guidelines */}
        <div className="agent-box-inner">
          {/* Left Content: [ AGENT ] tag, headline, concise bridge description */}
          <div className="agent-bridge-content">
            <div className="agent-tag">[ AGENT ]</div>

            <h2 className="agent-heading">
              Cách Agent kết nối với dự án của bạn
            </h2>

            <p className="agent-description">
              SelfHeal Agent đóng vai trò cầu nối liên kết trực tiếp giữa dự án của bạn với chúng tôi, tự động đồng bộ trạng thái hạ tầng và kích hoạt quy trình khôi phục tức thì khi phát hiện sự cố tiềm ẩn.
            </p>
          </div>

          {/* Right Hexagon Button */}
          <div className="agent-bridge-action">
            <a
              href="/guide"
              onClick={handleLearnMore}
              className="agent-btn-learn-more"
              title="Tìm hiểu thêm"
            >
              Tìm hiểu thêm
            </a>
          </div>
        </div>

        {/* Full-width Bottom Horizontal Guideline */}
        <div className="agent-box-line-track agent-line-bottom" aria-hidden="true" />
      </div>

      {/* Bottom spacer for clean cadence before HowItWorksSection */}
      <div className="agent-bottom-spacer" aria-hidden="true" />
    </section>
  );
};

export default FeatureStrip;
