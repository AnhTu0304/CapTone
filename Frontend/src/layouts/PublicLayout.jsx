import React from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';

export const PublicLayout = ({ children, currentPath = '/', onNavigate }) => {
  const isFullBleedPage =
    currentPath === '/security' ||
    currentPath === '/security-practices' ||
    currentPath === '/about' ||
    currentPath === '/privacy' ||
    currentPath === '/terms' ||
    currentPath === '/guide' ||
    currentPath === '/features';

  return (
    <div
      className={`public-layout blueprint-canvas-root ${isFullBleedPage ? 'public-layout--no-gutters' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        position: 'relative',
        overflowX: 'clip',
      }}
    >
      {!isFullBleedPage && (
        <>
          <div className="blueprint-gutter-left" aria-hidden="true" />
          <div className="blueprint-gutter-right" aria-hidden="true" />
        </>
      )}

      <Header currentPath={currentPath} onNavigate={onNavigate} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {children}
      </main>
      <Footer onNavigate={onNavigate} />
    </div>
  );
};

export default PublicLayout;
