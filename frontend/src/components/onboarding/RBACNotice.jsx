import React, { useState } from 'react';
import { ShieldCheck, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

export const RBACNotice = ({ className = '', onNavigate }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`onboarding-rbac-notice ${className}`}
      style={{
        padding: '16px 18px',
        backgroundColor: 'rgba(40, 233, 159, 0.08)',
        border: '1px solid var(--color-accent)',
        borderLeft: '4px solid var(--color-accent)',
        borderRadius: '0px',
        marginBottom: '24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <ShieldCheck size={20} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.875rem',
                fontWeight: 700,
                color: '#065F46',
                marginBottom: '4px',
              }}
            >
              Chính sách Zero Cluster-Admin: Phân quyền RBAC tối thiểu
            </div>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.8125rem',
                color: '#047857',
                lineHeight: 1.45,
                margin: 0,
              }}
            >
              SelfHeal không bao giờ yêu cầu đặc quyền <code>cluster-admin</code>. Tác tử hoạt động hoàn toàn thông qua một <code>ClusterRole</code> phạm vi hẹp chỉ đọc với số liệu Pod và quyền hành động phân lập trên các namespace được chỉ định.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none',
            border: 'none',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6875rem',
            color: '#065F46',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flexShrink: 0,
          }}
        >
          <span>{expanded ? 'Ẩn Chi tiết' : 'Xem Quyền hạn'}</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expanded && (
        <div
          style={{
            marginTop: '14px',
            paddingTop: '12px',
            borderTop: '1px dashed rgba(40, 233, 159, 0.4)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: '#064E3B',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '6px' }}>Nhóm API Kubernetes được yêu cầu rõ ràng:</div>
          <ul style={{ margin: '0 0 10px 18px', padding: 0, lineHeight: 1.5 }}>
            <li><code>core</code>: pods, services, endpoints, nodes (get, list, watch)</li>
            <li><code>apps</code>: deployments, statefulsets, replicasets (get, list, watch)</li>
            <li><code>metrics.k8s.io</code>: podmetrics, nodemetrics (get, list)</li>
            <li><code>events.k8s.io</code>: events (get, list, watch)</li>
          </ul>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Đọc tài liệu kiến trúc bảo mật tại</span>
            <a
              href="/docs"
              onClick={(e) => {
                e.preventDefault();
                if (onNavigate) onNavigate('/docs');
              }}
              style={{
                color: '#059669',
                fontWeight: 700,
                textDecoration: 'underline',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              <span>Kiến trúc Bảo mật & RBAC</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default RBACNotice;
