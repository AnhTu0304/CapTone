import React, { useState, useEffect } from 'react';
import LogsPage from './LogsPage';
import EventsPage from './EventsPage';
import { FileText, Activity } from 'lucide-react';

export const LogsAndEventsPage = ({ currentPath = '/dashboard/monitoring/logs', onNavigate }) => {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'events') return 'events';
      if (window.location.pathname.includes('/monitoring/events')) return 'events';
    }
    return currentPath.includes('/monitoring/events') ? 'events' : 'logs';
  });

  useEffect(() => {
    if (currentPath.includes('/monitoring/events')) {
      setActiveTab('events');
    } else if (currentPath.includes('/monitoring/logs')) {
      setActiveTab('logs');
    }
  }, [currentPath]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (onNavigate) {
      onNavigate(tab === 'events' ? '/dashboard/monitoring/events' : '/dashboard/monitoring/logs');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Tab Switcher */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderBottom: '1px solid #E2E8F0',
          paddingBottom: '2px',
          backgroundColor: '#FFFFFF',
          padding: '12px 20px 0 20px',
          borderRadius: '12px 12px 0 0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <button
          type="button"
          onClick={() => handleTabChange('logs')}
          style={{
            padding: '10px 18px',
            fontSize: '0.875rem',
            fontWeight: activeTab === 'logs' ? 800 : 600,
            color: activeTab === 'logs' ? '#0284C7' : '#64748B',
            borderBottom: activeTab === 'logs' ? '3px solid #0284C7' : '3px solid transparent',
            backgroundColor: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <FileText size={16} />
          <span>1. Nhật Ký Container (Logs)</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('events')}
          style={{
            padding: '10px 18px',
            fontSize: '0.875rem',
            fontWeight: activeTab === 'events' ? 800 : 600,
            color: activeTab === 'events' ? '#059669' : '#64748B',
            borderBottom: activeTab === 'events' ? '3px solid #059669' : '3px solid transparent',
            backgroundColor: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <Activity size={16} />
          <span>2. Sự Kiện Kubernetes (Events)</span>
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'logs' ? <LogsPage /> : <EventsPage />}
      </div>
    </div>
  );
};

export default LogsAndEventsPage;
