import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import './SecurityPractices.css';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export const SecurityPracticesPage = () => {
  const { t } = useTranslation('security');
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderGridAndSprockets = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width === 0 || height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.save();
      ctx.scale(dpr, dpr);

      ctx.fillStyle = '#EEEEEE';
      ctx.fillRect(0, 0, width, height);

      const gridSize = 24;
      ctx.strokeStyle = 'rgba(61, 59, 79, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= width; x += gridSize) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
      }
      for (let y = 0; y <= height; y += gridSize) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
      }
      ctx.stroke();

      if (width > 640) {
        const holeW = 16;
        const holeH = 20;
        const radius = 5;
        const stepY = 36;
        const leftX = 26;
        const rightX = width - 26 - holeW;

        const drawHole = (x, y) => {
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.arcTo(x + holeW, y, x + holeW, y + holeH, radius);
          ctx.arcTo(x + holeW, y + holeH, x, y + holeH, radius);
          ctx.arcTo(x, y + holeH, x, y, radius);
          ctx.arcTo(x, y, x + holeW, y, radius);
          ctx.closePath();
          ctx.fillStyle = '#E0E0E6';
          ctx.fill();
          ctx.strokeStyle = '#B8B8C2';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        };

        for (let y = 8; y < height; y += stepY) {
          drawHole(leftX, y);
          drawHole(rightX, y);
        }
      }

      ctx.restore();
    };

    renderGridAndSprockets();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => renderGridAndSprockets());
      observer.observe(container);
      return () => observer.disconnect();
    }
  }, []);

  useGSAP(
    () => {
      const sections = gsap.utils.toArray('.security-content-container section');
      sections.forEach((sec) => {
        gsap.from(sec, {
          y: 20,
          opacity: 0,
          duration: 0.65,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sec,
            start: 'top 88%',
            toggleActions: 'play none none none',
          },
        });
      });
    },
    { scope: containerRef }
  );

  return (
    <div className="security-page-root" data-testid="security-practices-page">
      <header className="security-top-hero" data-testid="security-top-hero">
        <h1 className="security-hero-title">{t('hero.title')}</h1>
        <p className="security-hero-subtitle">
          {t('hero.subtitle')}
        </p>
      </header>

      <section
        ref={containerRef}
        className="security-sheet-section"
        data-testid="security-sheet-section"
      >
        <canvas
          ref={canvasRef}
          className="security-sheet-canvas"
          data-testid="security-sheet-canvas"
          aria-hidden="true"
        />

        <main className="security-content-container">
          <div className="security-last-updated" data-testid="security-last-updated">
            {t('lastUpdated')}
          </div>

          <p className="security-intro-paragraph">
            {t('intro')}
          </p>

          {/* Section 01: Security Overview */}
          <section id="security-overview" data-testid="security-section-overview">
            <h2 className="security-heading-1">{t('sections.overview.heading')}</h2>
            <p className="security-body-paragraph">
              {t('sections.overview.p1')}
            </p>
            <p className="security-body-paragraph">
              {t('sections.overview.p2')}
            </p>
          </section>

          {/* Section 02: Application Security */}
          <section id="application-security" data-testid="security-section-app">
            <h2 className="security-heading-1">{t('sections.app.heading')}</h2>
            <p className="security-body-paragraph">
              {t('sections.app.intro')}
            </p>
            <h3 className="security-heading-2">{t('sections.app.sqliHeading')}</h3>
            <p className="security-body-paragraph">
              {t('sections.app.sqliBody')}
            </p>
            <h3 className="security-heading-2">{t('sections.app.headersHeading')}</h3>
            <p className="security-body-paragraph">
              {t('sections.app.headersP1')}
            </p>
            <p className="security-body-paragraph">
              {t('sections.app.headersP2')}
            </p>
          </section>

          {/* Section 03: Authentication & Access Control */}
          <section id="auth-access-control" data-testid="security-section-auth">
            <h2 className="security-heading-1">{t('sections.auth.heading')}</h2>
            <p className="security-body-paragraph">
              {t('sections.auth.intro')}
            </p>
            <h3 className="security-heading-2">{t('sections.auth.jwtHeading')}</h3>
            <p className="security-body-paragraph">
              {t('sections.auth.jwtBody')}
            </p>
            <h3 className="security-heading-2">{t('sections.auth.rbacHeading')}</h3>
            <p className="security-body-paragraph">
              {t('sections.auth.rbacBody')}
            </p>
          </section>

          {/* Section 04: Kubernetes & Agent Security */}
          <section id="kubernetes-agent-security" data-testid="security-section-k8s">
            <h2 className="security-heading-1">{t('sections.k8s.heading')}</h2>
            <p className="security-body-paragraph">
              {t('sections.k8s.intro')}
            </p>
            <h3 className="security-heading-2">{t('sections.k8s.rbacHeading')}</h3>
            <p className="security-body-paragraph">
              {t('sections.k8s.rbacBody')}
            </p>
            <h3 className="security-heading-2">{t('sections.k8s.pssHeading')}</h3>
            <p className="security-body-paragraph">
              {t('sections.k8s.pssBody')}
            </p>
            <h3 className="security-heading-2">{t('sections.k8s.inboundHeading')}</h3>
            <p className="security-body-paragraph">
              {t('sections.k8s.inboundBody')}
            </p>
          </section>

          {/* Section 05: Data Protection */}
          <section id="data-protection" data-testid="security-section-data">
            <h2 className="security-heading-1">{t('sections.data.heading')}</h2>
            <p className="security-body-paragraph">
              {t('sections.data.intro')}
            </p>
            <h3 className="security-heading-2">{t('sections.data.transitHeading')}</h3>
            <p className="security-body-paragraph">
              {t('sections.data.transitBody')}
            </p>
            <h3 className="security-heading-2">{t('sections.data.redactionHeading')}</h3>
            <p className="security-body-paragraph">
              {t('sections.data.redactionBody')}
            </p>
          </section>

          {/* Section 06: AI & Remediation Security */}
          <section id="ai-remediation-security" data-testid="security-section-ai">
            <h2 className="security-heading-1">{t('sections.ai.heading')}</h2>
            <p className="security-body-paragraph">
              {t('sections.ai.intro')}
            </p>
            <h3 className="security-heading-2">{t('sections.ai.hitlHeading')}</h3>
            <p className="security-body-paragraph">
              {t('sections.ai.hitlBody')}
            </p>
            <h3 className="security-heading-2">{t('sections.ai.auditHeading')}</h3>
            <p className="security-body-paragraph">
              {t('sections.ai.auditBody')}
            </p>
          </section>

          {/* Section 07: Monitoring & Incident Response */}
          <section id="monitoring-incident-response" data-testid="security-section-monitoring">
            <h2 className="security-heading-1">{t('sections.monitoring.heading')}</h2>
            <p className="security-body-paragraph">
              {t('sections.monitoring.intro')}
            </p>
            <h3 className="security-heading-2">{t('sections.monitoring.telemetryHeading')}</h3>
            <p className="security-body-paragraph">
              {t('sections.monitoring.telemetryBody')}
            </p>
            <h3 className="security-heading-2">{t('sections.monitoring.investigationHeading')}</h3>
            <p className="security-body-paragraph">
              {t('sections.monitoring.investigationBody')}
            </p>
          </section>

          {/* Section 08: Vulnerability Management & Reporting */}
          <section id="vulnerability-management" data-testid="security-section-vulnerability">
            <h2 className="security-heading-1">{t('sections.vulnerability.heading')}</h2>
            <p className="security-body-paragraph">
              {t('sections.vulnerability.intro')}
            </p>
            <h3 className="security-heading-2">{t('sections.vulnerability.cveHeading')}</h3>
            <p className="security-body-paragraph">
              {t('sections.vulnerability.cveBody')}
            </p>
            <h3 className="security-heading-2">{t('sections.vulnerability.disclosureHeading')}</h3>
            <p className="security-body-paragraph">
              {t('sections.vulnerability.disclosureBefore')}<span className="security-contact-highlight">security@selfheal.dev</span>{t('sections.vulnerability.disclosureAfter')}
            </p>
          </section>
        </main>
      </section>
    </div>
  );
};

export default SecurityPracticesPage;
