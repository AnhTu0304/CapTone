import React from 'react';
import { useTranslation } from 'react-i18next';
import logoPng from '../../assets/Logo-transparent.png';
import './Footer.css';

export const Footer = ({ onNavigate }) => {
  const { t } = useTranslation('common');
  const handleLinkClick = (e, path) => {
    if (path.startsWith('http')) return;

    if (path.startsWith('#')) {
      e.preventDefault();
      if (window.location.pathname === '/') {
        const target = document.querySelector(path);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
          return;
        }
      }
      if (onNavigate) {
        onNavigate('/' + path);
      } else {
        window.history.pushState({}, '', '/' + path);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
      return;
    }

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
      aria-label={t('footer.ariaLabel')}
    >
      {/* ================= TOP DOUBLE-DASHED DIVIDER ================= */}
      <div className="footer-divider-dashed" aria-hidden="true" />

      {/* ================= MAIN 4-COLUMN SHELL ================= */}
      <div className="footer-shell">
        {/* ================= COLUMN 1: ARCHITECTURAL CAD BLUEPRINT LOGO (~23%) ================= */}
        <div className="footer-col-logo" data-testid="footer-col-brand">
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

            {/* 2. Official Brand Logo Emblem */}
            <g id="logo-emblem">
              <image
                href={logoPng}
                x="80"
                y="58"
                width="120"
                height="120"
                preserveAspectRatio="xMidYMid meet"
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

        {/* CAD Double Solid Vertical Divider 1 */}
        <div className="footer-divider-double-v" aria-hidden="true" />

        {/* ================= COLUMN 2: PLATFORM (~25%) ================= */}
        <nav className="footer-col-nav footer-col-platform" aria-label={t('footer.platform.aria')}>
          <span className="footer-col-title">{t('footer.platform.title')}</span>
          <div className="footer-links-group">
            <a href="#overview" onClick={(e) => handleLinkClick(e, '#overview')} className="footer-link">
              {t('footer.platform.overview')}
            </a>
            <a href="#monitoring" onClick={(e) => handleLinkClick(e, '#monitoring')} className="footer-link">
              {t('footer.platform.monitoring')}
            </a>
            <a href="#prediction" onClick={(e) => handleLinkClick(e, '#prediction')} className="footer-link">
              {t('footer.platform.prediction')}
            </a>
            <a href="/features#rca" onClick={(e) => handleLinkClick(e, '/features#rca')} className="footer-link">
              {t('footer.platform.rca')}
            </a>
            <a href="#self-healing" onClick={(e) => handleLinkClick(e, '#self-healing')} className="footer-link">
              {t('footer.platform.selfHealing')}
            </a>
            <a href="#human-approval" onClick={(e) => handleLinkClick(e, '#human-approval')} className="footer-link">
              {t('footer.platform.humanApproval')}
            </a>
          </div>
        </nav>

        {/* CAD Double Solid Vertical Divider 2 */}
        <div className="footer-divider-double-v" aria-hidden="true" />

        {/* ================= COLUMN 3: RESOURCES (~27%) ================= */}
        <nav className="footer-col-nav footer-col-resources" aria-label={t('footer.resources.aria')}>
          <span className="footer-col-title">{t('footer.resources.title')}</span>
          <div className="footer-links-group">
            <a href="/guide" onClick={(e) => handleLinkClick(e, '/guide')} className="footer-link">
              {t('footer.resources.guide')}
            </a>
            <a href="/login" onClick={(e) => handleLinkClick(e, '/login')} className="footer-link">
              {t('footer.resources.getStarted')}
            </a>
            <a href="/dashboard/agents" onClick={(e) => handleLinkClick(e, '/dashboard/agents')} className="footer-link">
              {t('footer.resources.installAgent')}
            </a>
            <a href="/about" onClick={(e) => handleLinkClick(e, '/about')} className="footer-link">
              {t('footer.resources.about')}
            </a>
          </div>
        </nav>

        {/* CAD Double Solid Vertical Divider 3 */}
        <div className="footer-divider-double-v" aria-hidden="true" />

        {/* ================= COLUMN 4: SUPPORT & SOCIALS (~25%) ================= */}
        <div className="footer-col-nav footer-col-support" aria-label={t('footer.support.aria')}>
          <span className="footer-col-title">{t('footer.support.title')}</span>
          <div className="footer-links-group">
            <a href="/about#contact" onClick={(e) => handleLinkClick(e, '/about#contact')} className="footer-link">
              {t('footer.support.contact')}
            </a>
            <a href="#faq" onClick={(e) => handleLinkClick(e, '#faq')} className="footer-link">
              {t('footer.support.faq')}
            </a>
            <a href="/portal/help" onClick={(e) => handleLinkClick(e, '/portal/help')} className="footer-link">
              {t('footer.support.feedback')}
            </a>
            <a href="/security" onClick={(e) => handleLinkClick(e, '/security')} className="footer-link">
              {t('footer.support.security')}
            </a>
            <a href="/privacy" onClick={(e) => handleLinkClick(e, '/privacy')} className="footer-link">
              {t('footer.support.privacy')}
            </a>
            <a href="/terms" onClick={(e) => handleLinkClick(e, '/terms')} className="footer-link">
              {t('footer.support.terms')}
            </a>
            <a
              href="https://github.com/phamthaisang1710/captone/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              {t('footer.support.reportIssue')}
            </a>
          </div>

          <div className="footer-social-wrapper">
            <span className="footer-col-title">{t('footer.support.socialsTitle')}</span>
            <div className="footer-social-icons">
              {/* GitHub */}
              <a
                href="https://github.com/phamthaisang1710/captone"
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
            </div>
          </div>
        </div>
      </div>

      {/* ================= COPYRIGHT BOTTOM BAR ================= */}
      <div className="footer-bottom-bar">
        <div className="footer-bottom-meta">
          <span>{t('footer.bottom.arch')}</span>
          <span style={{ opacity: 0.4 }}>|</span>
          <span className="footer-bottom-meta-accent">{t('footer.bottom.k8s')}</span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span>{t('footer.bottom.spec')}</span>
        </div>

        <div className="footer-bottom-copyright">
          {t('footer.bottom.copyright', { year: new Date().getFullYear() })}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
