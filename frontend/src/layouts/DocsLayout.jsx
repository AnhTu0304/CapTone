import React, { useState } from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import DocumentationSidebar from '../components/navigation/DocumentationSidebar';
import { Menu, X } from 'lucide-react';

export const DocsLayout = ({
  children,
  currentPath = '/docs',
  activeDocId,
  onSelectDoc,
  onNavigate,
  tocComponent,
}) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div
      className="docs-layout"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      <Header currentPath={currentPath} onNavigate={onNavigate} />

      {/* Mobile Docs Sub-bar with toggle */}
      <div
        className="mobile-docs-bar"
        style={{
          display: 'none',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: 'var(--text-primary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {mobileSidebarOpen ? <X size={16} /> : <Menu size={16} />}
          <span>Documentation Topics</span>
        </button>
      </div>

      <div
        className="container-custom"
        style={{
          display: 'flex',
          flex: 1,
          paddingTop: '32px',
          paddingBottom: '64px',
          gap: '40px',
          position: 'relative',
        }}
      >
        {/* Left Sticky Sidebar */}
        <div className={`docs-sidebar-desktop ${mobileSidebarOpen ? 'mobile-sidebar-active' : ''}`}>
          <DocumentationSidebar
            activeDocId={activeDocId}
            onSelectDoc={(id) => {
              setMobileSidebarOpen(false);
              if (onSelectDoc) onSelectDoc(id);
            }}
          />
        </div>

        {/* Center Main Documentation Article */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            maxWidth: 'var(--docs-content-width)',
          }}
        >
          {children}
        </main>

        {/* Right "On This Page" Table of Contents */}
        {tocComponent && (
          <div
            className="docs-toc-desktop"
            style={{
              width: '220px',
              flexShrink: 0,
            }}
          >
            {tocComponent}
          </div>
        )}
      </div>

      <Footer onNavigate={onNavigate} />

      <style>{`
        @media (max-width: 992px) {
          .mobile-docs-bar {
            display: flex !important;
          }
          .docs-sidebar-desktop {
            display: none;
          }
          .docs-sidebar-desktop.mobile-sidebar-active {
            display: block !important;
            position: fixed;
            top: 110px;
            left: 0;
            bottom: 0;
            width: 280px;
            background: #FFFFFF;
            z-index: 900;
            padding: 20px;
            box-shadow: var(--shadow-lg);
            border-right: 1px solid var(--border-default);
            overflow-y: auto;
          }
          .docs-toc-desktop {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default DocsLayout;
