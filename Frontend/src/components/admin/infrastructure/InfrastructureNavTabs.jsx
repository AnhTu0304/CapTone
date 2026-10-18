import React from 'react';
import { Layers, Activity, Server, Box } from 'lucide-react';

export const INFRASTRUCTURE_TABS = [
  {
    id: 'clusters',
    label: 'Cụm Kubernetes',
    path: '/admin/infrastructure/clusters',
    icon: Layers,
    description: 'Quản trị các cụm K8s đa nền tảng và môi trường',
  },
  {
    id: 'agents',
    label: 'Tác Tử eBPF',
    path: '/admin/infrastructure/agents',
    icon: Activity,
    description: 'Giám sát nhịp tim và độ trễ các sensor eBPF',
  },
  {
    id: 'nodes',
    label: 'Máy Chủ (Nodes)',
    path: '/admin/infrastructure/nodes',
    icon: Server,
    description: 'Dung lượng CPU, RAM và sức khỏe máy chủ',
  },
  {
    id: 'workloads',
    label: 'Khối Công Việc (Workloads)',
    path: '/admin/infrastructure/workloads',
    icon: Box,
    description: 'Triển khai Pods, Deployments, StatefulSets và DaemonSets',
  },
];

export const InfrastructureNavTabs = ({ activeTab = 'clusters', onSelectTab }) => {
  return (
    <div
      role="tablist"
      aria-label="Điều hướng hạ tầng nền tảng"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        overflowX: 'auto',
        borderBottom: '1px solid var(--dash-border)',
        paddingBottom: '8px',
      }}
    >
      {INFRASTRUCTURE_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onSelectTab && onSelectTab(tab.id, tab.path)}
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
            <Icon size={16} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default InfrastructureNavTabs;
