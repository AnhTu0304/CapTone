import React from 'react';
import PropTypes from 'prop-types';
import { Cpu, Box, Sparkles, GitCommit, Activity, Scale } from 'lucide-react';

export const AINavTabs = ({ currentSection, activeTab, onNavigate, onTabChange }) => {
  const active = activeTab || currentSection || 'overview';

  const tabs = [
    {
      id: 'overview',
      label: 'Tổng Quan AI',
      path: '/admin/ai/overview',
      icon: Cpu,
    },
    {
      id: 'models',
      label: 'Kho Mô Hình Học Máy',
      path: '/admin/ai/models',
      icon: Box,
    },
    {
      id: 'comparison',
      label: 'Đánh Giá & So Sánh Trước/Sau',
      path: '/admin/ai/comparison',
      icon: Scale,
    },
    {
      id: 'predictions',
      label: 'Dự Báo Dị Thường',
      path: '/admin/ai/predictions',
      icon: Sparkles,
    },
    {
      id: 'rca',
      label: 'Đồ Thị Nhân Quả RCA',
      path: '/admin/ai/rca',
      icon: GitCommit,
    },
    {
      id: 'performance',
      label: 'Hiệu Năng & Kiểm Chuẩn',
      path: '/admin/ai/performance',
      icon: Activity,
    },
  ];

  const handleTabClick = (tab) => {
    if (onTabChange) {
      onTabChange(tab.id);
    }
    if (onNavigate) {
      onNavigate(tab.path);
    }
  };

  return (
    <>
      <style>{`
        .ai-nav-tabs-wrapper::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div
        className="ai-nav-tabs-wrapper"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          backgroundColor: '#FFFFFF',
          padding: '6px',
          borderRadius: '12px',
          border: '1px solid var(--dash-border)',
          boxShadow: 'var(--dash-shadow-xs)',
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.8125rem',
                fontWeight: isActive ? 700 : 600,
                border: 'none',
                backgroundColor: isActive ? '#059669' : 'transparent',
                color: isActive ? '#FFFFFF' : 'var(--dash-text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 2px 6px rgba(5, 150, 105, 0.25)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = '#F8FAFC';
                  e.currentTarget.style.color = 'var(--dash-text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--dash-text-secondary)';
                }
              }}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};

AINavTabs.propTypes = {
  currentSection: PropTypes.string,
  activeTab: PropTypes.string,
  onNavigate: PropTypes.func,
  onTabChange: PropTypes.func,
};

export default AINavTabs;
