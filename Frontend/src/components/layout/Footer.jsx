import React from 'react';
import './Footer.css';

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
      data-testid="footer-greptile"
      aria-label="Footer hệ thống SelfHeal"
    >
      {/* ================= TOP DOUBLE-DASHED DIVIDER ================= */}
      <div className="footer-divider-dashed" aria-hidden="true" />

      {/* ================= MAIN 5-COLUMN SHELL ================= */}
      <div className="footer-shell">
        {/* ================= COLUMN 1: ARCHITECTURAL CAD BLUEPRINT LOGO ================= */}
        <div className="footer-col-logo">
          <svg
            viewBox="0 0 280 280"
            className="footer-blueprint-canvas"
            aria-label="SelfHeal Blueprint Logo"
            role="img"
          >
            {/* 1. CAD Construction & Drafting Guide Lines */}
            <g stroke="#9E9AA8" strokeWidth="0.75" strokeDasharray="3 3" opacity="0.85">
              {/* Outer boundary box */}
              <rect x="20" y="20" width="240" height="240" fill="none" />
              {/* Inner boundary box */}
              <rect x="48" y="48" width="184" height="184" fill="none" opacity="0.6" strokeDasharray="2 2" />

              {/* Center Crosshairs */}
              <line x1="8" y1="118" x2="272" y2="118" />
              <line x1="140" y1="8" x2="140" y2="272" />

              {/* 45-degree Technical Drafting Diagonals */}
              <line x1="20" y1="20" x2="260" y2="260" opacity="0.55" strokeDasharray="4 4" />
              <line x1="260" y1="20" x2="20" y2="260" opacity="0.55" strokeDasharray="4 4" />

              {/* Concentric Guide Circles */}
              <circle cx="140" cy="118" r="88" fill="none" opacity="0.5" strokeDasharray="2 3" />
              <circle cx="140" cy="118" r="54" fill="none" opacity="0.5" strokeDasharray="2 3" />

              {/* Wordmark Baseline Guidelines */}
              <line x1="12" y1="228" x2="268" y2="228" strokeDasharray="2 2" />
              <line x1="12" y1="264" x2="268" y2="264" strokeDasharray="2 2" />
            </g>

            {/* 2. Geometric Isometric Mint Emblem */}
            <g id="logo-emblem" transform="translate(140, 118)">
              {/* Top-Left Quadrant */}
              <polygon points="0,-72 -68,-4 -36,28 0,-8" fill="#28E99F" />
              {/* Top-Right Quadrant */}
              <polygon points="0,-72 68,-4 36,28 0,-8" fill="#20D48F" />
              {/* Bottom-Left Quadrant */}
              <polygon points="-68,-4 0,64 0,28 -36,-8" fill="#20D48F" />
              {/* Bottom-Right Quadrant */}
              <polygon points="68,-4 0,64 0,28 36,-8" fill="#18B87A" />

              {/* Center Floating Core Healing Polygon */}
              <polygon
                points="0,-16 16,0 0,16 -16,0"
                fill="#EDEDF0"
                stroke="#28E99F"
                strokeWidth="2.5"
              />
            </g>

            {/* 3. Lower Brand Wordmark */}
            <text
              x="140"
              y="256"
              textAnchor="middle"
              fontFamily="'Anybody', 'Inter', -apple-system, sans-serif"
              fontWeight="800"
              fontSize="38"
              letterSpacing="-2px"
              fill="#28E99F"
            >
              selfheal
            </text>
          </svg>
        </div>

        {/* CAD Double Solid Vertical Divider */}
        <div className="footer-divider-double-v" aria-hidden="true" />

        {/* ================= COLUMN 2: PRODUCT & STATUS ================= */}
        <nav className="footer-col-nav" aria-label="Product Links">
          <span className="footer-col-title">PRODUCT</span>
          <div className="footer-links-group">
            <a href="/features" onClick={(e) => handleLinkClick(e, '/features')} className="footer-link">
              ENTERPRISE
            </a>
            <a href="/pricing" onClick={(e) => handleLinkClick(e, '/pricing')} className="footer-link">
              PRICING
            </a>
            <a href="/docs" onClick={(e) => handleLinkClick(e, '/docs')} className="footer-link">
              DOCS
            </a>
            <a href="/get-started" onClick={(e) => handleLinkClick(e, '/get-started')} className="footer-link">
              K8S AGENT
            </a>
          </div>

          <div className="footer-status-wrapper">
            <span className="footer-col-title">STATUS</span>
            <a
              href="/guide"
              onClick={(e) => handleLinkClick(e, '/guide')}
              className="footer-status-link"
              aria-label="View system status"
            >
              <span className="footer-status-dot" aria-hidden="true" />
              <span>VIEW STATUS</span>
            </a>
          </div>
        </nav>

        {/* CAD Double Solid Vertical Divider */}
        <div className="footer-divider-double-v" aria-hidden="true" />

        {/* ================= COLUMN 3: COMPANY ================= */}
        <nav className="footer-col-nav" aria-label="Company Links">
          <span className="footer-col-title">COMPANY</span>
          <div className="footer-links-group">
            <a href="/about" onClick={(e) => handleLinkClick(e, '/about')} className="footer-link">
              EXAMPLES
            </a>
            <a href="/about" onClick={(e) => handleLinkClick(e, '/about')} className="footer-link">
              CAREERS
            </a>
            <a href="/guide" onClick={(e) => handleLinkClick(e, '/guide')} className="footer-link">
              BLOG
            </a>
            <a href="/docs" onClick={(e) => handleLinkClick(e, '/docs')} className="footer-link">
              CHANGELOG
            </a>
            <a href="/about" onClick={(e) => handleLinkClick(e, '/about')} className="footer-link">
              CASE STUDIES
            </a>
            <a href="/design" onClick={(e) => handleLinkClick(e, '/design')} className="footer-link">
              BRAND
            </a>
          </div>
        </nav>

        {/* CAD Double Solid Vertical Divider */}
        <div className="footer-divider-double-v" aria-hidden="true" />

        {/* ================= COLUMN 4: RESOURCES ================= */}
        <nav className="footer-col-nav" aria-label="Resources Links">
          <span className="footer-col-title">RESOURCES</span>
          <div className="footer-links-group">
            <a href="/docs" onClick={(e) => handleLinkClick(e, '/docs')} className="footer-link">
              SELFHEAL ENGINE
            </a>
            <a href="/docs" onClick={(e) => handleLinkClick(e, '/docs')} className="footer-link">
              CONTENT LIBRARY
            </a>
            <a href="/docs" onClick={(e) => handleLinkClick(e, '/docs')} className="footer-link">
              WHAT IS K8S SELF-HEALING?
            </a>
            <a href="/docs" onClick={(e) => handleLinkClick(e, '/docs')} className="footer-link">
              INCIDENT RUNBOOK CHECKLIST
            </a>
            <a href="/docs" onClick={(e) => handleLinkClick(e, '/docs')} className="footer-link">
              BENCHMARKS
            </a>
            <a href="/docs" onClick={(e) => handleLinkClick(e, '/docs')} className="footer-link">
              REPORTS
            </a>
            <a href="/about" onClick={(e) => handleLinkClick(e, '/about')} className="footer-link">
              SELFHEAL VS MANUAL SRE
            </a>
            <a href="/about" onClick={(e) => handleLinkClick(e, '/about')} className="footer-link">
              SELFHEAL VS PROMETHEUS
            </a>
            <a href="/about" onClick={(e) => handleLinkClick(e, '/about')} className="footer-link">
              SELFHEAL VS OPERATORS
            </a>
            <a href="/get-started" onClick={(e) => handleLinkClick(e, '/get-started')} className="footer-link">
              FOR CLOUD ENTERPRISES
            </a>
          </div>
        </nav>

        {/* CAD Double Solid Vertical Divider */}
        <div className="footer-divider-double-v" aria-hidden="true" />

        {/* ================= COLUMN 5: SUPPORT & SOCIALS ================= */}
        <div className="footer-col-nav" aria-label="Support and Social Links">
          <span className="footer-col-title">SUPPORT</span>
          <div className="footer-links-group">
            <a href="/about" onClick={(e) => handleLinkClick(e, '/about')} className="footer-link">
              CONTACT US
            </a>
            <a href="/docs" onClick={(e) => handleLinkClick(e, '/docs')} className="footer-link">
              SECURITY (SOC 2)
            </a>
            <a href="#privacy" onClick={(e) => e.preventDefault()} className="footer-link">
              PRIVACY POLICY
            </a>
            <a href="#terms" onClick={(e) => e.preventDefault()} className="footer-link">
              TERMS OF SERVICE
            </a>
            <a href="/docs" onClick={(e) => handleLinkClick(e, '/docs')} className="footer-link">
              REPORT AN ISSUE
            </a>
          </div>

          <div className="footer-social-wrapper">
            <span className="footer-col-title">SOCIALS</span>
            <div className="footer-social-icons">
              {/* GitHub */}
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-btn"
                aria-label="GitHub"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
              </a>

              {/* X / Twitter */}
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-btn"
                aria-label="X (Twitter)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>

              {/* LinkedIn */}
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-btn"
                aria-label="LinkedIn"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.45 1.45 0 0 0 0-2.9 1.45 1.45 0 0 0 0 2.9m1.4 9.74V10.13H5.06v8.37h2.8z" />
                </svg>
              </a>

              {/* Discord */}
              <a
                href="https://discord.com"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-btn"
                aria-label="Discord"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ================= BOTTOM SINGLE-DASHED DIVIDER ================= */}
      <div className="footer-divider-single-dashed" aria-hidden="true" />

      {/* ================= COPYRIGHT BOTTOM BAR ================= */}
      <div className="footer-bottom-bar">
        <div className="footer-bottom-meta">
          <span>SELFHEAL SYSTEM ARCHITECTURE</span>
          <span style={{ opacity: 0.4 }}>|</span>
          <span className="footer-bottom-meta-accent">K8S CLUSTER AUTONOMY</span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span>COMPLIANT K8S 1.28+</span>
        </div>

        <div className="footer-bottom-copyright">
          &copy; {new Date().getFullYear()} SelfHeal Systems, Inc. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
