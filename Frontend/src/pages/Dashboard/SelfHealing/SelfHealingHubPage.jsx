import React, { useState, useEffect } from 'react';
import { useDashboard } from '../context/DashboardContext';
import ActionHistoryPage from './ActionHistoryPage';
import ApprovalsPage from './ApprovalsPage';
import HealingActionsPage from './HealingActionsPage';
import { History, CheckCircle2, Zap } from 'lucide-react';

export const SelfHealingHubPage = ({ currentPath = '/dashboard/self-healing', onNavigate }) => {
  const { pendingApprovalsCount } = useDashboard();

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'approvals') return 'approvals';
      if (params.get('tab') === 'actions') return 'actions';
      if (window.location.pathname.includes('/self-healing/approvals')) return 'approvals';
      if (window.location.pathname.includes('/self-healing/actions')) return 'actions';
    }
    if (currentPath.includes('/self-healing/approvals')) return 'approvals';
    if (currentPath.includes('/self-healing/actions')) return 'actions';
    return 'history';
  });

  useEffect(() => {
    if (currentPath.includes('/self-healing/approvals')) {
      setActiveTab('approvals');
    } else if (currentPath.includes('/self-healing/actions')) {
      setActiveTab('actions');
    } else if (currentPath.includes('/self-healing/history') || currentPath === '/dashboard/self-healing') {
      setActiveTab('history');
    }
  }, [currentPath]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (onNavigate) {
      if (tab === 'approvals') onNavigate('/dashboard/self-healing/approvals');
      else if (tab === 'actions') onNavigate('/dashboard/self-healing/actions');
      else onNavigate('/dashboard/self-healing/history');
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
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => handleTabChange('history')}
          style={{
            padding: '10px 18px',
            fontSize: '0.875rem',
            fontWeight: activeTab === 'history' ? 800 : 600,
            color: activeTab === 'history' ? '#059669' : '#64748B',
            borderBottom: activeTab === 'history' ? '3px solid #059669' : '3px solid transparent',
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
          <History size={16} />
          <span>1. Lịch Sử Phục Hồi</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('approvals')}
          style={{
            padding: '10px 18px',
            fontSize: '0.875rem',
            fontWeight: activeTab === 'approvals' ? 800 : 600,
            color: activeTab === 'approvals' ? '#D97706' : '#64748B',
            borderBottom: activeTab === 'approvals' ? '3px solid #D97706' : '3px solid transparent',
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
          <CheckCircle2 size={16} />
          <span>2. Cổng Phê Duyệt (HITL)</span>
          {pendingApprovalsCount > 0 && (
            <span
              style={{
                backgroundColor: '#FEF3C7',
                color: '#B45309',
                fontSize: '0.6875rem',
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: '10px',
                border: '1px solid #FCD34D',
              }}
            >
              {pendingApprovalsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('actions')}
          style={{
            padding: '10px 18px',
            fontSize: '0.875rem',
            fontWeight: activeTab === 'actions' ? 800 : 600,
            color: activeTab === 'actions' ? '#7C3AED' : '#64748B',
            borderBottom: activeTab === 'actions' ? '3px solid #7C3AED' : '3px solid transparent',
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
          <Zap size={16} />
          <span>3. Danh Mục Hành Động</span>
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'history' && <ActionHistoryPage onNavigate={onNavigate} />}
        {activeTab === 'approvals' && <ApprovalsPage onNavigate={onNavigate} />}
        {activeTab === 'actions' && <HealingActionsPage onNavigate={onNavigate} />}
      </div>
    </div>
  );
};

export default SelfHealingHubPage;
