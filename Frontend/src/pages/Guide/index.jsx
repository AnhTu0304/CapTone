import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Bookmark, Compass } from 'lucide-react';
import SectionTitleCanvas from './components/SectionTitleCanvas';
import CodeBlock from '../../components/common/CodeBlock';
import AlertCard from '../../components/common/AlertCard';
import NotebookNoticeCard from './components/NotebookNoticeCard';
import Breadcrumb from '../../components/common/Breadcrumb';
import useScrollSpy from '../../hooks/useScrollSpy';
import './GuidePage.css';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export const GuidePage = () => {
  const { t } = useTranslation('guide');
  const translatedSections = t('sections', { returnObjects: true });
  const guideSections = Array.isArray(translatedSections) ? translatedSections : [];

  const sectionIds = guideSections.map((s) => s.id);
  const activeId = useScrollSpy(sectionIds, 120);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // 1. Full Open-Notebook Canvas with 24px Grid and Sprocket Holes matching Page Security
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderOpenNotebookCanvas = () => {
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

      // Clean sheet background (#EEEEEE matching SelfHeal design tokens)
      ctx.fillStyle = '#EEEEEE';
      ctx.fillRect(0, 0, width, height);

      // 24px subtle coordinate grid
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

      // Sprocket tractor punch holes along left and right margins (matching Page Security)
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

      // Center notebook spine crease / soft fold line between Left Nav and Right Content
      if (width > 1024) {
        const padX = width > 1024 ? 84 : 56;
        const layoutMaxW = Math.min(1360, Math.max(0, width - padX * 2));
        const layoutLeft = (width - layoutMaxW) / 2;
        const foldX = layoutLeft + 310 + 24; // in the gap between nav and content

        // Soft crease gradient shadow
        const creaseGrad = ctx.createLinearGradient(foldX - 24, 0, foldX + 24, 0);
        creaseGrad.addColorStop(0, 'rgba(0, 0, 0, 0.03)');
        creaseGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.005)');
        creaseGrad.addColorStop(1, 'rgba(0, 0, 0, 0.03)');
        ctx.fillStyle = creaseGrad;
        ctx.fillRect(foldX - 24, 0, 48, height);

        // Dashed technical spine stitch line
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = 'rgba(61, 59, 79, 0.15)';
        ctx.lineWidth = 1;
        ctx.moveTo(foldX, 0);
        ctx.lineTo(foldX, height);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    };

    renderOpenNotebookCanvas();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => renderOpenNotebookCanvas());
      observer.observe(container);
      return () => observer.disconnect();
    }
  }, []);

  // 2. Reading scroll progress calculation
  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll > 0) {
        const progress = (window.scrollY / totalScroll) * 100;
        setScrollProgress(Math.min(100, Math.max(0, progress)));
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 3. GSAP ScrollTrigger for smooth section entrance matching Page Security
  useGSAP(
    () => {
      if (typeof window === 'undefined') return;
      const sections = gsap.utils.toArray('.guide-content-section');
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

  const handleScrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 88;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  return (
    <div className="guide-page-root" data-testid="guide-page-root">
      {/* ================= 1. TOP HERO SECTION (Matching Page Security) ================= */}
      <header className="guide-top-hero" data-testid="guide-top-hero">
        <div className="guide-hero-breadcrumb">
          <Breadcrumb
            items={[
              { label: t('breadcrumb.home'), href: '/' },
              { label: t('breadcrumb.current') },
            ]}
          />
        </div>
        <h1 className="guide-hero-title">
          {t('hero.title')}
        </h1>
        <p className="guide-hero-subtitle">
          {t('hero.subtitle')}
        </p>
      </header>

      {/* ================= 2. LOWER SHEET SECTION WITH SPROCKET CANVAS ================= */}
      <section
        ref={containerRef}
        className="guide-sheet-section"
        data-testid="guide-sheet-section"
      >
        <canvas
          ref={canvasRef}
          className="guide-sheet-canvas"
          data-testid="guide-sheet-canvas"
          aria-hidden="true"
        />

        {/* Mobile Collapsible Bar */}
        <div className="guide-mobile-open-bar">
          <button
            type="button"
            onClick={() => setMobileTocOpen(!mobileTocOpen)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              backgroundColor: '#EAEAEF',
              border: '1px solid rgba(61, 59, 79, 0.28)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-primary)',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            }}
          >
            <span>{t('toc.mobileToggle', { count: guideSections.length })}</span>
            <span>{mobileTocOpen ? '▲' : '▼'}</span>
          </button>

          {mobileTocOpen && (
            <div
              style={{
                marginTop: '8px',
                backgroundColor: '#EEEEEE',
                border: '1px solid rgba(61, 59, 79, 0.25)',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                maxHeight: '50vh',
                overflowY: 'auto',
                boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)',
              }}
            >
              {guideSections.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setMobileTocOpen(false);
                    handleScrollToSection(item.id);
                  }}
                  style={{
                    padding: '8px 10px',
                    textAlign: 'left',
                    background: activeId === item.id ? 'rgba(40, 233, 159, 0.15)' : 'none',
                    border: 'none',
                    borderLeft: activeId === item.id ? '3px solid #28E99F' : '3px solid transparent',
                    fontSize: '0.8125rem',
                    fontWeight: activeId === item.id ? 700 : 400,
                    color: '#3D3B4F',
                    cursor: 'pointer',
                  }}
                >
                  {item.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ================= 3. FULL OPEN NOTEBOOK SPREAD LAYOUT ================= */}
        <div className="open-notebook-full-layout" data-testid="open-notebook-container">
          {/* CỘT TRÁI: MỤC LỤC & STICKY NAV NẰM TRỰC TIẾP TRÊN TRANG SỔ TAY */}
          <aside
            className="notebook-left-nav-col"
            aria-label={t('toc.asideAria')}
          >
            <div className="notebook-left-nav-card">
              <div className="notebook-left-stamp">
                <Compass size={13} color="#059669" />
                <span>SRE NOTEBOOK // VOL.01</span>
              </div>
              <h2 className="notebook-left-title">{t('toc.navHeading')}</h2>

              {/* Reading Progress */}
              <div className="notebook-progress-box">
                <div className="notebook-progress-meta">
                  <span>{t('toc.readingProgress')}</span>
                  <span>{Math.round(scrollProgress)}%</span>
                </div>
                <div className="notebook-progress-bar">
                  <div
                    className="notebook-progress-fill"
                    style={{ width: `${scrollProgress}%` }}
                  />
                </div>
              </div>

              {/* Sticky Chapter Tabs */}
              <div className="notebook-left-tabs-list" role="navigation">
                {guideSections.map((item, index) => {
                  const isActive = activeId === item.id;
                  const numStr = String(index + 1).padStart(2, '0');

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleScrollToSection(item.id)}
                      className={`notebook-chapter-tab ${isActive ? 'active' : ''}`}
                      aria-current={isActive ? 'true' : undefined}
                      title={item.title}
                    >
                      <Bookmark
                        size={12}
                        strokeWidth={2.5}
                        color={isActive ? '#059669' : '#8C8A99'}
                      />
                      <span className="notebook-tab-prefix">{numStr}</span>
                      <span className="notebook-tab-title">
                        {item.title.replace(/^\d+\s*/, '')}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Left Page Bottom Footer Stamp */}
              <div className="notebook-left-footer-stamp">
                <span>PAGE // 01</span>
                <span>SELFHEAL SRE RUNBOOK</span>
              </div>
            </div>
          </aside>

          {/* CỘT PHẢI: CHI TIẾT NỘI DUNG 11 CHƯƠNG */}
          <main className="notebook-right-content-col" role="main">
            <div className="notebook-right-header-meta">
              <span>VOLUME 01 // KUBERNETES SRE RUNBOOK</span>
              <span>STATUS: CERTIFIED</span>
              <span>PAGE // 02</span>
            </div>

            {/* CHAPTER 01 */}
            <section id="sec-01" className="guide-content-section">
              <header className="guide-content-header">
                <SectionTitleCanvas chapterNumber="01" />
                <h2 className="guide-content-title">{guideSections[0]?.title}</h2>
              </header>
              <p className="guide-content-desc">
                {t('ch01.desc')}
              </p>
              <div className="open-notebook-prereq">
                <div className="open-notebook-prereq-title">{t('ch01.prereqTitle')}</div>
                <ul style={{ paddingLeft: '20px', color: '#555368', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: 1.5 }}>
                  <li>{t('ch01.prereq1')}</li>
                  <li>{t('ch01.prereq2Before')}<code>kubectl</code>{t('ch01.prereq2After')}</li>
                  <li>{t('ch01.prereq3Before')}<code>api.selfheal.infra</code>{t('ch01.prereq3After')}</li>
                </ul>
              </div>
              <NotebookNoticeCard
                type="warning"
                important={true}
                title={t('ch01.noticeTitle')}
              >
                {t('ch01.noticeBody')}
              </NotebookNoticeCard>
            </section>

            {/* CHAPTER 02 */}
            <section id="sec-02" className="guide-content-section">
              <header className="guide-content-header">
                <SectionTitleCanvas chapterNumber="02" />
                <h2 className="guide-content-title">{guideSections[1]?.title}</h2>
              </header>
              <p className="guide-content-desc">
                {t('ch02.desc')}
              </p>
              <ol style={{ paddingLeft: '20px', color: '#3D3B4F', fontSize: '0.9375rem', display: 'flex', flexDirection: 'column', gap: '12px', lineHeight: 1.6, marginBottom: '20px' }}>
                <li>
                  <strong>{t('ch02.step1Label')}</strong>{t('ch02.step1Text')}
                </li>
                <li>
                  <strong>{t('ch02.step2Label')}</strong>{t('ch02.step2Before')}<code>acme-fintech</code>{t('ch02.step2After')}
                </li>
                <li>
                  <strong>{t('ch02.step3Label')}</strong>{t('ch02.step3Text')}
                </li>
              </ol>
              <NotebookNoticeCard
                type="tip"
                title={t('ch02.noticeTitle')}
              >
                {t('ch02.noticeBodyBefore')}<em>{t('ch02.noticeRole1')}</em>{t('ch02.noticeRole1Desc')}<em>{t('ch02.noticeRole2')}</em>{t('ch02.noticeRole2Desc')}<em>{t('ch02.noticeRole3')}</em>{t('ch02.noticeRole3Desc')}
              </NotebookNoticeCard>
            </section>

            {/* CHAPTER 03 */}
            <section id="sec-03" className="guide-content-section">
              <header className="guide-content-header">
                <SectionTitleCanvas chapterNumber="03" />
                <h2 className="guide-content-title">{guideSections[2]?.title}</h2>
              </header>
              <p className="guide-content-desc">
                {t('ch03.descPart1')}<code>Production</code>, <code>Staging</code>{t('ch03.descPart2')}<code>Development</code>{t('ch03.descPart3')}
              </p>
              <div className="open-notebook-prereq">
                <div className="open-notebook-prereq-title">{t('ch03.prereqTitle')}</div>
                <p style={{ fontSize: '0.875rem', color: '#555368', margin: 0, lineHeight: 1.6 }}>
                  {t('ch03.pBefore')}<strong>Staging</strong>{t('ch03.pMid1')}<em>{t('ch03.pAuto')}</em>{t('ch03.pMid2')}<strong>Production</strong>{t('ch03.pMid3')}<em>{t('ch03.pHuman')}</em>{t('ch03.pAfter')}
                </p>
              </div>
            </section>

            {/* CHAPTER 04 */}
            <section id="sec-04" className="guide-content-section">
              <header className="guide-content-header">
                <SectionTitleCanvas chapterNumber="04" />
                <h2 className="guide-content-title">{guideSections[3]?.title}</h2>
              </header>
              <p className="guide-content-desc">
                {t('ch04.p1Before')}<strong>{t('ch04.p1Strong')}</strong>{t('ch04.p1Mid')}<code>k8s-prod-us-east-1</code>{t('ch04.p1After')}
              </p>
              <p className="guide-content-desc">
                {t('ch04.p2Before')}<strong>{t('ch04.p2Strong')}</strong>{t('ch04.p2After')}
              </p>
            </section>

            {/* CHAPTER 05 */}
            <section id="sec-05" className="guide-content-section">
              <header className="guide-content-header">
                <SectionTitleCanvas chapterNumber="05" />
                <h2 className="guide-content-title">{guideSections[4]?.title}</h2>
              </header>
              <p className="guide-content-desc">
                {t('ch05.descBefore')}<code>selfheal-system</code>{t('ch05.descAfter')}
              </p>
              <CodeBlock
                language="bash"
                title={t('ch05.codeTitle')}
                code={t('ch05.code')}
              />
              <NotebookNoticeCard
                type="warning"
                important={true}
                title={t('ch05.noticeTitle')}
                style={{ marginTop: '20px' }}
              >
                {t('ch05.noticeBody')}
              </NotebookNoticeCard>
            </section>

            {/* CHAPTER 06 */}
            <section id="sec-06" className="guide-content-section">
              <header className="guide-content-header">
                <SectionTitleCanvas chapterNumber="06" />
                <h2 className="guide-content-title">{guideSections[5]?.title}</h2>
              </header>
              <p className="guide-content-desc">
                {t('ch06.p1')}
              </p>
              <p className="guide-content-desc">
                {t('ch06.p2')}
              </p>
              <CodeBlock
                language="bash"
                title={t('ch06.codeTitle')}
                code={`kubectl get pods -n selfheal-system\n# NAME                              READY   STATUS    RESTARTS   AGE\n# selfheal-agent-5b98f79cd4-v8m4k   1/1     Running   0          2m14s`}
              />
            </section>

            {/* CHAPTER 07 */}
            <section id="sec-07" className="guide-content-section">
              <header className="guide-content-header">
                <SectionTitleCanvas chapterNumber="07" />
                <h2 className="guide-content-title">{guideSections[6]?.title}</h2>
              </header>
              <p className="guide-content-desc">
                {t('ch07.desc')}
              </p>
              <ul style={{ paddingLeft: '20px', color: '#555368', fontSize: '0.9375rem', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: 1.5, marginBottom: '20px' }}>
                {(Array.isArray(t('ch07.items', { returnObjects: true })) ? t('ch07.items', { returnObjects: true }) : []).map((item, idx) => (
                  <li key={idx}><strong>{item.label}</strong>{item.text}</li>
                ))}
              </ul>
            </section>

            {/* CHAPTER 08 */}
            <section id="sec-08" className="guide-content-section">
              <header className="guide-content-header">
                <SectionTitleCanvas chapterNumber="08" />
                <h2 className="guide-content-title">{guideSections[7]?.title}</h2>
              </header>
              <p className="guide-content-desc">
                {t('ch08.desc')}
              </p>
              <div className="open-notebook-prereq">
                <ol style={{ paddingLeft: '20px', color: '#3D3B4F', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: 1.5, margin: 0 }}>
                  <li>{t('ch08.item1Before')}<code>worker</code>{t('ch08.item1Mid')}<code>7b91a</code>{t('ch08.item1After')}</li>
                  <li>{t('ch08.item2')}</li>
                  <li>{t('ch08.item3')}</li>
                </ol>
              </div>
            </section>

            {/* CHAPTER 09 */}
            <section id="sec-09" className="guide-content-section">
              <header className="guide-content-header">
                <SectionTitleCanvas chapterNumber="09" />
                <h2 className="guide-content-title">{guideSections[8]?.title}</h2>
              </header>
              <p className="guide-content-desc">
                {t('ch09.desc')}
              </p>
              <ul style={{ paddingLeft: '20px', color: '#555368', fontSize: '0.9375rem', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: 1.5, marginBottom: '20px' }}>
                {(Array.isArray(t('ch09.items', { returnObjects: true })) ? t('ch09.items', { returnObjects: true }) : []).map((item, idx) => (
                  <li key={idx}><strong>{item.label}</strong>{item.text}</li>
                ))}
              </ul>
            </section>

            {/* CHAPTER 10 */}
            <section id="sec-10" className="guide-content-section">
              <header className="guide-content-header">
                <SectionTitleCanvas chapterNumber="10" />
                <h2 className="guide-content-title">{guideSections[9]?.title}</h2>
              </header>
              <p className="guide-content-desc">
                {t('ch10.desc')}
              </p>
              <NotebookNoticeCard
                type="tip"
                title={t('ch10.noticeTitle')}
              >
                {t('ch10.noticeBodyBefore')}<em>{t('ch10.noticeEm')}</em>{t('ch10.noticeBodyAfter')}
              </NotebookNoticeCard>
            </section>

            {/* CHAPTER 11 */}
            <section id="sec-11" className="guide-content-section">
              <header className="guide-content-header">
                <SectionTitleCanvas chapterNumber="11" />
                <h2 className="guide-content-title">{guideSections[10]?.title}</h2>
              </header>
              <p className="guide-content-desc">
                {t('ch11.descBefore')}<strong>{t('ch11.descStrong')}</strong>{t('ch11.descAfter')}
              </p>
              <ol style={{ paddingLeft: '20px', color: '#3D3B4F', fontSize: '0.9375rem', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: 1.5 }}>
                {(Array.isArray(t('ch11.items', { returnObjects: true })) ? t('ch11.items', { returnObjects: true }) : []).map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ol>
            </section>
          </main>
        </div>
      </section>
    </div>
  );
};

export default GuidePage;
