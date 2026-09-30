import React from 'react';

export const Footer = ({ onNavigate }) => {
  const handleLinkClick = (e, path) => {
    if (path.startsWith('http') || path.startsWith('#')) return;
    e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <footer
      className="footer-greptile"
      style={{
        backgroundColor: 'var(--color-canvas)',
        borderTop: '1px solid var(--border-default)',
        padding: '0',
        marginTop: 'auto',
        fontFamily: 'var(--font-mono)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Drafting Guideline Bar */}
      <div
        style={{
          borderBottom: '1px dashed var(--border-default)',
          height: '16px',
          width: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.015)',
        }}
      />

      <div className="container-custom" style={{ paddingLeft: '0', paddingRight: '0' }}>
        {/* 4-COLUMN MAIN FOOTER GRID */}
        <div className="footer-grid-4cols">

          {/* COLUMN 1: PROMINENT BRAND LOGO WITH BLUEPRINT DRAFTING GRID */}
          <div className="footer-col footer-col-logo">
            <div className="blueprint-logo-wrapper">
              <svg
                viewBox="0 0 240 240"
                className="blueprint-svg-canvas"
                aria-label="SelfHeal Blueprint Logo"
              >
                <defs>
                  {/* Linear gradient for logo facets */}
                  <linearGradient id="facetGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#28E99F" />
                    <stop offset="100%" stopColor="#1fd48f" />
                  </linearGradient>
                  <linearGradient id="facetGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#22c788" />
                    <stop offset="100%" stopColor="#28E99F" />
                  </linearGradient>
                  <linearGradient id="facetGrad3" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#1bb87c" />
                    <stop offset="100%" stopColor="#148e5f" />
                  </linearGradient>
                </defs>

                {/* 1. Technical Blueprint Construction Grid Lines */}
                <g stroke="#C2C2C2" strokeWidth="0.75" strokeDasharray="3,3" opacity="0.85">
                  {/* Bounding box lines */}
                  <rect x="25" y="25" width="190" height="190" fill="none" />
                  <rect x="50" y="50" width="140" height="140" fill="none" />
                  
                  {/* Center Crosshairs */}
                  <line x1="10" y1="120" x2="230" y2="120" />
                  <line x1="120" y1="10" x2="120" y2="230" />

                  {/* 45-degree Drafting Diagonals */}
                  <line x1="20" y1="20" x2="220" y2="220" />
                  <line x1="220" y1="20" x2="20" y2="220" />

                  {/* Concentric Guide Circles */}
                  <circle cx="120" cy="120" r="92" fill="none" />
                  <circle cx="120" cy="120" r="64" fill="none" />
                  <circle cx="120" cy="120" r="32" fill="none" />

                  {/* Horizontal Alignment Guides */}
                  <line x1="0" y1="60" x2="240" y2="60" />
                  <line x1="0" y1="180" x2="240" y2="180" />
                </g>

                {/* 2. Geometric Isometric Logo Geometry */}
                <g id="logo-glyph" transform="translate(120, 105)">
                  {/* Outer Diamond / Isometric Cube Structure */}
                  {/* Top-Left Quadrant */}
                  <path
                    d="M 0 -68 L -58 -10 L -30 18 L 0 -12 Z"
                    fill="url(#facetGrad1)"
                    stroke="#148e5f"
                    strokeWidth="1.5"
                  />
                  {/* Top-Right Quadrant */}
                  <path
                    d="M 0 -68 L 58 -10 L 30 18 L 0 -12 Z"
                    fill="url(#facetGrad2)"
                    stroke="#148e5f"
                    strokeWidth="1.5"
                  />
                  {/* Bottom-Left Quadrant */}
                  <path
                    d="M -58 -10 L 0 48 L 0 16 L -30 -14 Z"
                    fill="url(#facetGrad2)"
                    stroke="#148e5f"
                    strokeWidth="1.5"
                  />
                  {/* Bottom-Right Quadrant */}
                  <path
                    d="M 58 -10 L 0 48 L 0 16 L 30 -14 Z"
                    fill="url(#facetGrad3)"
                    stroke="#148e5f"
                    strokeWidth="1.5"
                  />

                  {/* Center Core Floating Healing Cube / K8s Node */}
                  <polygon
                    points="0,-16 16,0 0,16 -16,0"
                    fill="#3D3B4F"
                    stroke="#28E99F"
                    strokeWidth="1.5"
                  />
                  <circle cx="0" cy="0" r="3" fill="#28E99F" />
                </g>

                {/* 3. Lower Blueprint Typography Baseline Guidelines */}
                <g stroke="#C2C2C2" strokeWidth="0.75" strokeDasharray="2,2" opacity="0.75">
                  <line x1="20" y1="192" x2="220" y2="192" />
                  <line x1="20" y1="222" x2="220" y2="222" />
                </g>

                {/* 4. Brand Wordmark */}
                <text
                  x="120"
                  y="214"
                  textAnchor="middle"
                  fontFamily="Anybody, sans-serif"
                  fontWeight="800"
                  fontSize="28"
                  letterSpacing="-1.2"
                  fill="#28E99F"
                  style={{ textTransform: 'lowercase' }}
                >
                  selfheal
                </text>
              </svg>
            </div>
          </div>

          {/* COLUMN 2: PRODUCT & STATUS */}
          <div className="footer-col">
            <div className="footer-section">
              <div className="footer-col-title">SẢN PHẨM</div>
              <ul className="footer-links-list">
                <li>
                  <a href="/features" onClick={(e) => handleLinkClick(e, '/features')}>
                    DOANH NGHIỆP
                  </a>
                </li>
                <li>
                  <a href="/features" onClick={(e) => handleLinkClick(e, '/features')}>
                    BẢNG GIÁ
                  </a>
                </li>
                <li>
                  <a href="/docs" onClick={(e) => handleLinkClick(e, '/docs')}>
                    TÀI LIỆU
                  </a>
                </li>
                <li>
                  <a href="/get-started" onClick={(e) => handleLinkClick(e, '/get-started')}>
                    TÁC TỬ KUBERNETES
                  </a>
                </li>
              </ul>
            </div>

            <div className="footer-section" style={{ marginTop: '36px' }}>
              <div className="footer-col-title">TRẠNG THÁI</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="status-indicator-dot" />
                <a
                  href="/guide"
                  onClick={(e) => handleLinkClick(e, '/guide')}
                  className="status-link"
                >
                  XEM TRẠNG THÁI
                </a>
              </div>
            </div>
          </div>

          {/* COLUMN 3: COMPANY & RESOURCES */}
          <div className="footer-col">
            <div className="footer-section">
              <div className="footer-col-title">CÔNG TY</div>
              <ul className="footer-links-list">
                <li>
                  <a href="/about" onClick={(e) => handleLinkClick(e, '/about')}>
                    DỰ ÁN MẪU
                  </a>
                </li>
                <li>
                  <a href="/about" onClick={(e) => handleLinkClick(e, '/about')}>
                    TUYỂN DỤNG
                  </a>
                </li>
                <li>
                  <a href="/guide" onClick={(e) => handleLinkClick(e, '/guide')}>
                    BÀI VIẾT
                  </a>
                </li>
                <li>
                  <a href="/docs" onClick={(e) => handleLinkClick(e, '/docs')}>
                    LỊCH SỬ CẬP NHẬT
                  </a>
                </li>
                <li>
                  <a href="/about" onClick={(e) => handleLinkClick(e, '/about')}>
                    CÂU CHUYỆN THÀNH CÔNG
                  </a>
                </li>
                <li>
                  <a href="/guide" onClick={(e) => handleLinkClick(e, '/guide')}>
                    PODCAST
                  </a>
                </li>
                <li>
                  <a href="/about" onClick={(e) => handleLinkClick(e, '/about')}>
                    THƯƠNG HIỆU
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* COLUMN 4: SUPPORT & SOCIALS */}
          <div className="footer-col footer-col-last">
            <div className="footer-section">
              <div className="footer-col-title">HỖ TRỢ</div>
              <ul className="footer-links-list">
                <li>
                  <a href="/about" onClick={(e) => handleLinkClick(e, '/about')}>
                    LIÊN HỆ
                  </a>
                </li>
                <li>
                  <a href="/docs" onClick={(e) => handleLinkClick(e, '/docs')}>
                    BẢO MẬT
                  </a>
                </li>
                <li>
                  <a href="#privacy" onClick={(e) => e.preventDefault()}>
                    CHÍNH SÁCH BẢO MẬT
                  </a>
                </li>
                <li>
                  <a href="#terms" onClick={(e) => e.preventDefault()}>
                    ĐIỀU KHOẢN DỊCH VỤ
                  </a>
                </li>
                <li>
                  <a href="/docs" onClick={(e) => handleLinkClick(e, '/docs')}>
                    BÁO CÁO LỖI
                  </a>
                </li>
              </ul>
            </div>

            <div className="footer-section" style={{ marginTop: '36px' }}>
              <div className="footer-col-title">KẾT NỐI</div>
              <div className="footer-social-icons">
                {/* GitHub */}
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-icon-btn"
                  title="GitHub"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                </a>

                {/* X / Twitter */}
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-icon-btn"
                  title="X (Twitter)"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>

                {/* LinkedIn */}
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-icon-btn"
                  title="LinkedIn"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.45 1.45 0 0 0 0-2.9 1.45 1.45 0 0 0 0 2.9m1.4 9.74V10.13H5.06v8.37h2.8z" />
                  </svg>
                </a>

                {/* Discord */}
                <a
                  href="https://discord.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-icon-btn"
                  title="Discord"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* BOTTOM COPYRIGHT BAR */}
      <div
        style={{
          borderTop: '1px dashed var(--border-default)',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          backgroundColor: 'rgba(0, 0, 0, 0.02)',
        }}
      >
        <div className="container-custom no-crosshair" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '16px', padding: 0, borderLeft: 'none', borderRight: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span>&copy; {new Date().getFullYear()} CÔNG TY HỆ THỐNG SELFHEAL</span>
            <span style={{ color: 'var(--border-default)' }}>|</span>
            <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>HẠ TẦNG TỰ TRỊ KUBERNETES CLOUD</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span>PHIÊN BẢN 1.2.0-ỔN ĐỊNH</span>
            <span style={{ color: 'var(--border-default)' }}>•</span>
            <span>CHUẨN TƯƠNG THÍCH K8S 1.28+</span>
          </div>
        </div>
      </div>

      {/* STYLES FOR GREPTILE BLUEPRINT FOOTER */}
      <style>{`
        .footer-grid-4cols {
          display: grid;
          grid-template-columns: 320px 1fr 1fr 1fr;
          border-left: 1px solid var(--border-default);
          border-right: 1px solid var(--border-default);
        }

        .footer-col {
          padding: 48px 32px;
          border-right: 1px solid var(--border-default);
          display: flex;
          flex-direction: column;
        }

        .footer-col-last {
          border-right: none;
        }

        .footer-col-logo {
          display: flex;
          align-items: center;
          justifyContent: center;
          padding: 32px 24px;
          background-color: rgba(0, 0, 0, 0.015);
        }

        .blueprint-logo-wrapper {
          width: 100%;
          max-width: 260px;
          aspect-ratio: 1 / 1;
          display: flex;
          align-items: center;
          justifyContent: center;
          transition: transform 0.2s ease;
        }

        .blueprint-logo-wrapper:hover {
          transform: scale(1.02);
        }

        .blueprint-svg-canvas {
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        .footer-col-title {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--color-ink);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 24px;
        }

        .footer-links-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .footer-links-list a {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: #555368;
          text-decoration: none;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          transition: color 0.15s ease, transform 0.15s ease;
          display: inline-block;
        }

        .footer-links-list a:hover {
          color: var(--color-primary);
          transform: translateX(4px);
        }

        .status-indicator-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          background-color: #28E99F;
          border-radius: 0px;
          box-shadow: 0 0 6px #28E99F;
          animation: pulseStatus 2s infinite ease-in-out;
        }

        @keyframes pulseStatus {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(0.85);
          }
        }

        .status-link {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--color-ink);
          text-decoration: underline;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          transition: color 0.15s ease;
        }

        .status-link:hover {
          color: var(--color-accent-dark, #1aa36f);
        }

        .footer-social-icons {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .social-icon-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #555368;
          transition: color 0.15s ease, transform 0.15s ease;
        }

        .social-icon-btn:hover {
          color: var(--color-ink);
          transform: translateY(-2px);
        }

        @media (max-width: 1024px) {
          .footer-grid-4cols {
            grid-template-columns: 1fr 1fr;
          }
          .footer-col {
            border-bottom: 1px solid var(--border-default);
          }
          .footer-col-logo {
            border-right: 1px solid var(--border-default);
          }
        }

        @media (max-width: 640px) {
          .footer-grid-4cols {
            grid-template-columns: 1fr;
          }
          .footer-col {
            border-right: none;
            padding: 32px 20px;
          }
        }
      `}</style>
    </footer>
  );
};

export default Footer;
