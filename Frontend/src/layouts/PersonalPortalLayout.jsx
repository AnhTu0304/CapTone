import React, { useState } from 'react';
import PersonalSidebar from '../components/personal/PersonalSidebar';
import PersonalHeader from '../components/personal/PersonalHeader';

export const PersonalPortalLayout = ({ currentPath, onNavigate, children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: 'var(--dash-bg-canvas, #F8FAFC)',
      }}
    >
      {/* Desktop Sidebar */}
      <PersonalSidebar
        currentPath={currentPath}
        onNavigate={onNavigate}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {/* Top Header */}
        <PersonalHeader
          currentPath={currentPath}
          onNavigate={onNavigate}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />

        {/* Scrollable Page Body */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
          }}
        >
          <div
            style={{
              maxWidth: '1440px',
              margin: '0 auto',
              width: '100%',
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default PersonalPortalLayout;
