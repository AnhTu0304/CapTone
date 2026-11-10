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

              {/* Radial Spokes connecting Satellites to Center Card */}
              <line x1="270" y1="40" x2="270" y2="105" stroke="#9CE8C9" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.55" />
              <line x1="470" y1="100" x2="400" y2="150" stroke="#9CE8C9" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.55" />
              <line x1="470" y1="320" x2="400" y2="280" stroke="#9CE8C9" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.55" />
              <line x1="270" y1="380" x2="270" y2="320" stroke="#9CE8C9" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.55" />
              <line x1="70" y1="320" x2="140" y2="280" stroke="#9CE8C9" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.55" />
              <line x1="70" y1="100" x2="140" y2="150" stroke="#9CE8C9" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.55" />
            </svg>

            {/* Central Floating K8s Diff Card */}
            <div className="ccs-center-card">
              <div className="ccs-file-header">
                <span>deployment/order-processor.yaml</span>
                <span style={{ color: '#059669', fontWeight: 700 }}>SYNCHRONIZED</span>
              </div>

              {/* Code Diff Rows */}
              <div className="ccs-diff-row-pink">
                <span>01 -</span>
                <span>replicas: 1  # single point of failure</span>
              </div>
              <div className="ccs-diff-row-mint">
                <span>01 +</span>
                <span>replicas: 3  # high availability cluster</span>
              </div>
              <div className="ccs-diff-row-mint">
                <span>02 +</span>
                <span>auto-recovery: enabled (OOM threshold: 85%)</span>
              </div>

              {/* Comments Thread */}
              <div className="ccs-comments-box">
                <div className="ccs-comment-row">
                  <div className="ccs-comment-avatar-agent">
                    <Bot size={12} />
                  </div>
                  <div>
                    <span className="ccs-comment-sender">selfheal-agent</span>
                    <span className="ccs-comment-time">vừa xong</span>
                    <p className="ccs-comment-text">
                      Cụm k8s-prod-01 đã đồng bộ telemetry. Toàn bộ 3 pods sẵn sàng tự phục hồi.
                    </p>
                  </div>
                </div>

                <div className="ccs-comment-row">
                  <div className="ccs-comment-avatar-user">
                    <User size={12} />
                  </div>
                  <div>
                    <span className="ccs-comment-sender">sre-lead</span>
                    <span className="ccs-comment-time">1 phút trước</span>
                    <p className="ccs-comment-text">
                      Chính sách đã được xác thực, sẵn sàng deploy!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 6 Satellite Nodes (Hexagon Constellation) */}
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
