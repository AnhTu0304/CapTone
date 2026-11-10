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
      {/* Continuous Left & Right Vertical Dashed Guidelines spanning through the [ AGENT ] banner */}
      <span aria-hidden="true" className="agent-guide-v-left" />
      <span aria-hidden="true" className="agent-guide-v-right" />

      {/* Top boundary green hexagon guide pin nodes */}
      <span aria-hidden="true" className="agent-node-pin agent-node-pin-left" />
      <span aria-hidden="true" className="agent-node-pin agent-node-pin-right" />

      <div className="agent-bridge-container">
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
    </section>
  );
};

export default FeatureStrip;
