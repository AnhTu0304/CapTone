import React from 'react';
import { Zap, Layers, Sliders, BarChart3 } from 'lucide-react';

export const SelfHealingNavTabs = ({ currentSection = 'actions', onNavigate }) => {
  const tabs = [
    {
      id: 'actions',
      label: 'Hành Động Cứu Hộ',
      path: '/admin/self-healing/actions',
      icon: Zap,
    },
    {
      id: 'action-types',
      label: 'Danh Mục Loại Hành Động',
      path: '/admin/self-healing/action-types',
      icon: Layers,
    },
    {
      id: 'policies',
      label: 'Chính Sách Tự Lành',
      path: '/admin/self-healing/policies',
      icon: Sliders,
    },
    {
      id: 'analytics',
      label: 'Số Liệu Phân Tích',
      path: '/admin/self-healing/analytics',
      icon: BarChart3,
    },
  ];

  const handleTabClick = (path) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        overflowX: 'auto',
        borderBottom: '1px solid var(--dash-border)',
        paddingBottom: '8px',
      }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentSection === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabClick(tab.path)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              fontWeight: isActive ? 700 : 500,
              border: 'none',
              backgroundColor: isActive ? '#059669' : '#FFFFFF',
              color: isActive ? '#FFFFFF' : 'var(--dash-text-secondary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
              boxShadow: isActive ? '0 2px 4px rgba(5, 150, 105, 0.2)' : 'none',
            }}
          >
            <Icon size={15} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default SelfHealingNavTabs;
