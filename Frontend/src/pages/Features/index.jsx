import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Activity, Cpu, Search, UserCheck, Zap, ShieldCheck, CheckCircle2, ArrowRight, BookOpen } from 'lucide-react';
import BlueprintWireframeCard from './components/BlueprintWireframeCard';
import telemetryRadarAvatar from '../../assets/telemetry-radar-avatar.png';
import gruForecasterAvatar from '../../assets/gru-forecaster-avatar.png';
import rcaDiagnosticCore from '../../assets/rca-diagnostic-core.png';
import hitlApprovalSeal from '../../assets/hitl-approval-seal.png';
import k8sRollingAgent from '../../assets/k8s-rolling-agent.png';
import auditVaultCore from '../../assets/audit-vault-core.png';
import './Features.css';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export const FeaturesPage = ({ onNavigate }) => {
  const { t } = useTranslation('features');
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const notebookContainerRef = useRef(null);
  const notebookCanvasRef = useRef(null);

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

    const renderNotebook = () => {
      const nCanvas = notebookCanvasRef.current;
      const nContainer = notebookContainerRef.current;
      if (!nCanvas || !nContainer) return;

      const nCtx = nCanvas.getContext('2d');
      if (!nCtx) return;

      const rect = nContainer.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width === 0 || height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      nCanvas.width = width * dpr;
      nCanvas.height = height * dpr;
      nCanvas.style.width = `${width}px`;
      nCanvas.style.height = `${height}px`;

      nCtx.save();
      nCtx.scale(dpr, dpr);
      nCtx.clearRect(0, 0, width, height);

      const padX = width > 640 ? 12 : 6;
      const padTop = 18;
      const padBottom = 12;
      const bookX = padX;
      const bookY = padTop;
      const bookW = width - padX * 2;
      const bookH = height - padTop - padBottom;
      const radius = 6;

      const drawRoundRect = (x, y, w, h, r) => {
        nCtx.beginPath();
        nCtx.moveTo(x + r, y);
        nCtx.lineTo(x + w - r, y);
        nCtx.arcTo(x + w, y, x + w, y + r, r);
        nCtx.lineTo(x + w, y + h - r);
        nCtx.arcTo(x + w, y + h, x + w - r, y + h, r);
        nCtx.lineTo(x + r, y + h);
        nCtx.arcTo(x, y + h, x, y + h - r, r);
        nCtx.lineTo(x, y + r);
        nCtx.arcTo(x, y, x + r, y, r);
        nCtx.closePath();
      };

      drawRoundRect(bookX + 4, bookY + 4, bookW, bookH, radius);
      nCtx.fillStyle = '#D4D4DA';
      nCtx.fill();

      drawRoundRect(bookX + 2, bookY + 2, bookW, bookH, radius);
      nCtx.fillStyle = '#E2E2E8';
      nCtx.fill();

      drawRoundRect(bookX, bookY, bookW, bookH, radius);
      nCtx.fillStyle = '#EEEEEE';
      nCtx.fill();
      nCtx.strokeStyle = 'rgba(61, 59, 79, 0.22)';
      nCtx.lineWidth = 1;
      nCtx.stroke();

      nCtx.save();
      drawRoundRect(bookX, bookY, bookW, bookH, radius);
      if (typeof nCtx.clip === 'function') {
        nCtx.clip();
      }

      const gridSize = 24;
      nCtx.strokeStyle = 'rgba(61, 59, 79, 0.05)';
      nCtx.lineWidth = 1;
      nCtx.beginPath();
      for (let gx = bookX; gx <= bookX + bookW; gx += gridSize) {
        nCtx.moveTo(gx + 0.5, bookY);
        nCtx.lineTo(gx + 0.5, bookY + bookH);
      }
      for (let gy = bookY; gy <= bookY + bookH; gy += gridSize) {
        nCtx.moveTo(bookX, gy + 0.5);
        nCtx.lineTo(bookX + bookW, gy + 0.5);
      }
      nCtx.stroke();
      nCtx.restore();

      const perfY = bookY + 28;
      nCtx.save();
      if (typeof nCtx.setLineDash === 'function') {
        nCtx.setLineDash([4, 4]);
      }
      nCtx.strokeStyle = 'rgba(61, 59, 79, 0.18)';
      nCtx.beginPath();
      nCtx.moveTo(bookX, perfY + 0.5);
      nCtx.lineTo(bookX + bookW, perfY + 0.5);
      nCtx.stroke();
      nCtx.restore();

      const ringStep = width > 500 ? 36 : 28;
      const ringStart = bookX + 28;
      const ringEnd = bookX + bookW - 24;

      for (let rx = ringStart; rx <= ringEnd; rx += ringStep) {
        nCtx.beginPath();
        if (typeof nCtx.ellipse === 'function') {
          nCtx.ellipse(rx, bookY + 14, 3.5, 5, 0, 0, Math.PI * 2);
        } else {
          nCtx.rect(rx - 3, bookY + 9, 6, 10);
        }
        nCtx.fillStyle = '#B8B8C4';
        nCtx.fill();
        nCtx.strokeStyle = '#8E8D9D';
        nCtx.lineWidth = 1;
        nCtx.stroke();

        nCtx.beginPath();
        nCtx.moveTo(rx - 3, bookY + 16);
        nCtx.bezierCurveTo(rx - 6, bookY - 10, rx + 6, bookY - 10, rx + 3, bookY + 16);
        nCtx.lineWidth = 2.5;
        nCtx.strokeStyle = '#3D3B4F';
        nCtx.stroke();

        nCtx.beginPath();
        nCtx.moveTo(rx - 1.5, bookY + 12);
        nCtx.bezierCurveTo(rx - 3.5, bookY - 7, rx + 3.5, bookY - 7, rx + 1.5, bookY + 12);
        nCtx.lineWidth = 0.9;
        nCtx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        nCtx.stroke();
      }

      nCtx.restore();
    };

    renderGridAndSprockets();
    renderNotebook();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        renderGridAndSprockets();
        renderNotebook();
        if (typeof ScrollTrigger !== 'undefined' && ScrollTrigger.refresh) {
          ScrollTrigger.refresh();
        }
      });
      observer.observe(container);
      if (notebookContainerRef.current) {
        observer.observe(notebookContainerRef.current);
      }
      return () => observer.disconnect();
    }
  }, []);

  useGSAP(
    () => {
      const sections = gsap.utils.toArray('.features-section');
      sections.forEach((sec) => {
        gsap.from(sec, {
          y: 24,
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
    <div className="features-page-root" data-testid="features-page">
      <header className="features-top-hero" data-testid="features-top-hero">
        <h1 className="features-hero-title">
          {t('hero.title')}
        </h1>
        <p className="features-hero-subtitle">
          {t('hero.subtitle')}
        </p>
      </header>

      <section
        ref={containerRef}
        className="features-sheet-section"
        data-testid="features-sheet-section"
      >
        <canvas
          ref={canvasRef}
          className="features-sheet-canvas"
          data-testid="features-sheet-canvas"
          aria-hidden="true"
        />

        <main className="features-content-container">
          <div className="features-lifecycle-header">
            <h2 className="features-lifecycle-title">{t('lifecycle.title')}</h2>
            <p className="features-lifecycle-desc">
              {t('lifecycle.desc')}
            </p>
          </div>

          <section id="step-detect" className="features-section features-step-row" data-testid="features-section-detect">
            <div className="features-step-text-col">
              <span className="features-step-badge features-step-badge--detect">{t('steps.detect.badge')}</span>
              <h3 className="features-step-title">{t('steps.detect.title')}</h3>
              <p className="features-step-desc">
                {t('steps.detect.desc')}
              </p>
              <ul className="features-step-list">
                {(Array.isArray(t('steps.detect.bullets', { returnObjects: true })) ? t('steps.detect.bullets', { returnObjects: true }) : []).map((bullet, idx) => (
                  <li key={idx} className="features-step-item">
                    <CheckCircle2 size={18} className="features-step-check" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="features-visual-box">
              <BlueprintWireframeCard
                avatarColor="#059669"
                username="telemetry.probe // ebpf-kernel"
                nodeColor="#10B981"
                nodeLabels={['pod: auth-gw // 0.8ms', 'node: worker-01 // OK', 'ebpf: 14.8k/s']}
                radarSweep={true}
                showCard={false}
                testId="telemetry-pulse-card"
              />
            </div>
          </section>

          <section id="step-predict" className="features-section features-step-row features-step-row--reverse" data-testid="features-section-predict">
            <div className="features-visual-box">
              <BlueprintWireframeCard
                avatarColor="#F59E0B"
                avatarImage={gruForecasterAvatar}
                avatarIcon={<Cpu size={22} />}
                username="gru.forecaster // time-series"
                message={t('steps.predict.cardMsg')}
                meshVariant="timeseries"
                showCard={false}
                nodeColor="#F43F5E"
                testId="ai-prediction-card"
              />
            </div>
            <div className="features-step-text-col">
              <span className="features-step-badge features-step-badge--predict">{t('steps.predict.badge')}</span>
              <h3 className="features-step-title">{t('steps.predict.title')}</h3>
              <p className="features-step-desc">
                {t('steps.predict.desc')}
              </p>
              <ul className="features-step-list">
                {(Array.isArray(t('steps.predict.bullets', { returnObjects: true })) ? t('steps.predict.bullets', { returnObjects: true }) : []).map((bullet, idx) => (
                  <li key={idx} className="features-step-item">
                    <CheckCircle2 size={18} className="features-step-check" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section id="step-diagnose" className="features-section features-step-row" data-testid="features-section-diagnose">
            <div className="features-step-text-col">
              <span className="features-step-badge features-step-badge--diagnose">{t('steps.diagnose.badge')}</span>
              <h3 className="features-step-title">{t('steps.diagnose.title')}</h3>
              <p className="features-step-desc">
                {t('steps.diagnose.desc')}
              </p>
              <ul className="features-step-list">
                {(Array.isArray(t('steps.diagnose.bullets', { returnObjects: true })) ? t('steps.diagnose.bullets', { returnObjects: true }) : []).map((bullet, idx) => (
                  <li key={idx} className="features-step-item">
                    <CheckCircle2 size={18} className="features-step-check" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="features-visual-box">
              <BlueprintWireframeCard
                avatarColor="#DC2626"
                avatarImage={rcaDiagnosticCore}
                avatarIcon={<Search size={22} />}
                username="rca.engine // graph-diagnostics"
                message={t('steps.diagnose.cardMsg')}
                meshVariant="causal-dag"
                showCard={false}
                nodeColor="#EF4444"
                testId="root-cause-card"
              />
            </div>
          </section>

          <section id="step-verify" className="features-section features-step-row features-step-row--reverse" data-testid="features-section-verify">
            <div className="features-visual-box">
              <BlueprintWireframeCard
                avatarColor="#6366F1"
                avatarImage={hitlApprovalSeal}
                avatarIcon={<UserCheck size={22} />}
                username="hitl.guardrail // approval-gate"
                message={t('steps.verify.cardMsg')}
                meshVariant="yaml-diff-gate"
                showCard={false}
                nodeColor="#A855F7"
                testId="hitl-yaml-diff-card"
              />
            </div>
            <div className="features-step-text-col">
              <span className="features-step-badge features-step-badge--verify">{t('steps.verify.badge')}</span>
              <h3 className="features-step-title">{t('steps.verify.title')}</h3>
              <p className="features-step-desc">
                {t('steps.verify.desc')}
              </p>
              <ul className="features-step-list">
                {(Array.isArray(t('steps.verify.bullets', { returnObjects: true })) ? t('steps.verify.bullets', { returnObjects: true }) : []).map((bullet, idx) => (
                  <li key={idx} className="features-step-item">
                    <CheckCircle2 size={18} className="features-step-check" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section id="step-recover" className="features-section features-step-row" data-testid="features-section-recover">
            <div className="features-step-text-col">
              <span className="features-step-badge features-step-badge--recover">{t('steps.recover.badge')}</span>
              <h3 className="features-step-title">{t('steps.recover.title')}</h3>
              <p className="features-step-desc">
                {t('steps.recover.desc')}
              </p>
              <ul className="features-step-list">
                {(Array.isArray(t('steps.recover.bullets', { returnObjects: true })) ? t('steps.recover.bullets', { returnObjects: true }) : []).map((bullet, idx) => (
                  <li key={idx} className="features-step-item">
                    <CheckCircle2 size={18} className="features-step-check" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="features-visual-box">
              <BlueprintWireframeCard
                avatarColor="#0284C7"
                avatarImage={k8sRollingAgent}
                avatarIcon={<Zap size={22} />}
                username="k8s.agent // rolling-remedy"
                message={t('steps.recover.cardMsg')}
                meshVariant="rolling-switchboard"
                showCard={false}
                nodeColor="#00F2FE"
                testId="self-healing-timeline-card"
              />
            </div>
          </section>

          <section id="step-audit" className="features-section features-step-row features-step-row--reverse" data-testid="features-section-audit">
            <div className="features-visual-box">
              <BlueprintWireframeCard
                avatarColor="#0D9488"
                avatarImage={auditVaultCore}
                avatarIcon={<ShieldCheck size={22} />}
                username="audit.vault // immutable-log"
                message={t('steps.audit.cardMsg')}
                meshVariant="audit-ledger"
                showCard={false}
                nodeColor="#14B8A6"
                testId="security-audit-chain-card"
              />
            </div>
            <div className="features-step-text-col">
              <span className="features-step-badge features-step-badge--audit">{t('steps.audit.badge')}</span>
              <h3 className="features-step-title">{t('steps.audit.title')}</h3>
              <p className="features-step-desc">
                {t('steps.audit.desc')}
              </p>
              <ul className="features-step-list">
                {(Array.isArray(t('steps.audit.bullets', { returnObjects: true })) ? t('steps.audit.bullets', { returnObjects: true }) : []).map((bullet, idx) => (
                  <li key={idx} className="features-step-item">
                    <CheckCircle2 size={18} className="features-step-check" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="features-section features-section--cta" data-testid="features-section-cta">
            <div
              ref={notebookContainerRef}
              className="features-notebook-card"
              data-testid="features-notebook-card"
            >
              <canvas
                ref={notebookCanvasRef}
                className="features-notebook-canvas"
                data-testid="features-notebook-canvas"
                aria-hidden="true"
              />
              <div className="features-notebook-content">
                <h2 className="features-cta-headline">{t('cta.headline')}</h2>
                <p className="features-cta-desc">
                  {t('cta.desc')}
                </p>
                <div className="features-cta-group">
                  <button
                    type="button"
                    className="features-btn-primary"
                    onClick={() => onNavigate && onNavigate('/login')}
                    data-testid="features-cta-explore-btn"
                    title={t('cta.explore')}
                  >
                    <span>{t('cta.explore')}</span>
                    <ArrowRight size={18} strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    className="features-btn-secondary"
                    onClick={() => onNavigate && onNavigate('/contact')}
                    data-testid="features-cta-contact-btn"
                    title={t('cta.contact')}
                  >
                    <BookOpen size={18} strokeWidth={2.2} color="#2A2A2A" />
                    <span>{t('cta.contact')}</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </section>
    </div>
  );
};

export default FeaturesPage;
