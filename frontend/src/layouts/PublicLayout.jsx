import React from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';

export const PublicLayout = ({ children, currentPath = '/', onNavigate }) => {
  return (
    <div
      className="public-layout blueprint-canvas-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        position: 'relative',
        overflowX: 'clip',
      }}
    >
      {/* Blueprint Gutter Overlays with Millimeter Grid (Screen width > 1400px) */}
      <div className="blueprint-gutter-left" aria-hidden="true" />
      <div className="blueprint-gutter-right" aria-hidden="true" />

      <Header currentPath={currentPath} onNavigate={onNavigate} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
        {children}
      </main>
      <Footer onNavigate={onNavigate} />
    </div>
  );
};

export default PublicLayout;
