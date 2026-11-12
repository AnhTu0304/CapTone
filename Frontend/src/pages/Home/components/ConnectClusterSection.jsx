import React from 'react';
import { Bot, User } from 'lucide-react';
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

          {/* ================= RIGHT COLUMN: SATELLITE MESH & DIFF CARD ================= */}
          <div className="ccs-mesh-wrapper" aria-hidden="true">
            {/* SVG Connecting Cybernetic Leader Lines */}
            <svg
              className="ccs-mesh-svg"
              viewBox="0 0 540 420"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Hexagon Perimeter Lines between 6 Satellite Nodes */}
              <line x1="270" y1="30" x2="480" y2="90" stroke="#60A5FA" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.45" />
              <line x1="480" y1="90" x2="480" y2="330" stroke="#60A5FA" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.45" />
              <line x1="480" y1="330" x2="270" y2="390" stroke="#60A5FA" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.45" />
              <line x1="270" y1="390" x2="60" y2="330" stroke="#60A5FA" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.45" />
              <line x1="60" y1="330" x2="60" y2="90" stroke="#60A5FA" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.45" />
              <line x1="60" y1="90" x2="270" y2="30" stroke="#60A5FA" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.45" />

              {/* Diagonal Cross-Link Guidance Lines */}
              <line x1="270" y1="30" x2="270" y2="390" stroke="#60A5FA" strokeWidth="0.75" strokeDasharray="4 4" strokeOpacity="0.25" />
              <line x1="60" y1="90" x2="480" y2="330" stroke="#60A5FA" strokeWidth="0.75" strokeDasharray="4 4" strokeOpacity="0.25" />
              <line x1="60" y1="330" x2="480" y2="90" stroke="#60A5FA" strokeWidth="0.75" strokeDasharray="4 4" strokeOpacity="0.25" />
            </svg>

            {/* Central Diff Card with YAML Manifest & Comment Thread */}
            <div className="ccs-center-card">
              <div className="ccs-file-header">
                <span>deployment/order-processor.yaml</span>
                <span style={{ color: '#10B981' }}>+1 auto-remediation</span>
              </div>

              {/* Diff Code Rows */}
              <div className="ccs-diff-row-pink">
                <span>-</span>
                <span>replicas: 1 # failure: single point of failure</span>
              </div>
              <div className="ccs-diff-row-mint">
                <span>+</span>
                <span>replicas: 3 # high availability cluster</span>
              </div>

              {/* In-Line Audit Comment Thread */}
              <div className="ccs-comments-box">
                {/* Agent Remediated */}
                <div className="ccs-comment-row">
                  <div className="ccs-comment-avatar-agent">
                    <Bot size={11} strokeWidth={2.5} />
                  </div>
                  <div>
                    <span className="ccs-comment-sender">SelfHeal Agent</span>
                    <span className="ccs-comment-time">14:02:18</span>
                    <p className="ccs-comment-text">
                      Đã áp dụng chính sách: tăng replicas lên 3 pods để giảm thiểu tắc nghẽn queue.
                    </p>
                  </div>
                </div>

                {/* SRE Verified */}
                <div className="ccs-comment-row">
                  <div className="ccs-comment-avatar-user">
                    <User size={11} strokeWidth={2.5} />
                  </div>
                  <div>
                    <span className="ccs-comment-sender">Minh (SRE Lead)</span>
                    <span className="ccs-comment-time">14:02:40</span>
                    <p className="ccs-comment-text">
                      Đã xác minh qua telemetry: zero downtime ghi nhận.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 6 Satellite Diagnostic Badges */}
            {/* 1. Top */}
            <div className="ccs-satellite ccs-sat-top">
              <div className="ccs-satellite-bar-pink" />
              <div className="ccs-satellite-bar-mint" />
              <div className="ccs-satellite-bar-mint" />
              <span className="ccs-satellite-label">DIFF</span>
            </div>

            {/* 2. Top-Right */}
            <div className="ccs-satellite ccs-sat-top-right">
              <div className="ccs-satellite-bar-pink" />
              <div className="ccs-satellite-bar-mint" />
              <div className="ccs-satellite-bar-mint" />
              <span className="ccs-satellite-label">DIFF</span>
            </div>

            {/* 3. Bottom-Right */}
            <div className="ccs-satellite ccs-sat-bottom-right">
              <div className="ccs-satellite-bar-pink" />
              <div className="ccs-satellite-bar-mint" />
              <div className="ccs-satellite-bar-mint" />
              <span className="ccs-satellite-label">DIFF</span>
            </div>

            {/* 4. Bottom */}
            <div className="ccs-satellite ccs-sat-bottom">
              <div className="ccs-satellite-bar-pink" />
              <div className="ccs-satellite-bar-mint" />
              <div className="ccs-satellite-bar-mint" />
              <span className="ccs-satellite-label">DIFF</span>
            </div>

            {/* 5. Bottom-Left */}
            <div className="ccs-satellite ccs-sat-bottom-left">
              <div className="ccs-satellite-bar-pink" />
              <div className="ccs-satellite-bar-mint" />
              <div className="ccs-satellite-bar-mint" />
              <span className="ccs-satellite-label">DIFF</span>
            </div>

            {/* 6. Top-Left */}
            <div className="ccs-satellite ccs-sat-top-left">
              <div className="ccs-satellite-bar-pink" />
              <div className="ccs-satellite-bar-mint" />
              <div className="ccs-satellite-bar-mint" />
              <span className="ccs-satellite-label">DIFF</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ConnectClusterSection;
