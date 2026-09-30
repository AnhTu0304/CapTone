import React from 'react';
import { ArrowLeft, Building2, Layers, AlertCircle, Clock, Zap, ArrowRight, ShieldCheck } from 'lucide-react';
import SeverityBadge from './SeverityBadge';
import IncidentStatusBadge from './IncidentStatusBadge';

export const IncidentDetail = ({ incident, onBack, onNavigateToApprovals }) => {
  if (!incident) return null;

  return (
    <div
      className="dash-card"
      style={{
        padding: '24px',
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid var(--dash-border)',
        boxShadow: 'var(--dash-shadow-xs)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* Top Bar with Back Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Quay lại danh sách sự cố"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            color: 'var(--dash-text-secondary)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '6px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--dash-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--dash-text-secondary)')}
        >
          <ArrowLeft size={16} />
          <span>Quay lại danh sách sự cố</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '0.75rem',
              color: '#065F46',
              backgroundColor: '#ECFDF5',
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid #A7F3D0',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <ShieldCheck size={13} /> Giám Sát Cấp Quản Trị Hệ Thống (Platform Super Admin)
          </span>
        </div>
      </div>

      {/* Main Title and Badges */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1rem', color: '#059669' }}>
            {incident.id}
          </span>
          <SeverityBadge severity={incident.severity} />
          <IncidentStatusBadge status={incident.status} />
        </div>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0, lineHeight: 1.4 }}>
          {incident.title}
        </h1>
      </div>

      {/* HITL Approval Gate Notice Banner if awaiting approval */}
      {incident.status === 'AWAITING_APPROVAL' && (
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} style={{ color: '#DC2626', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#991B1B' }}>
                Hành Động Cứu Hộ Đang Chờ Phê Duyệt Cổng HITL Gate
              </div>
              <div style={{ fontSize: '0.75rem', color: '#B91C1C', marginTop: '2px' }}>
                Theo nguyên tắc an toàn, hành động không thực thi trực tiếp tại trang này mà phải qua Cổng Phê Duyệt HITL.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateToApprovals}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
            }}
          >
            <span>Đến Cổng Phê Duyệt HITL</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Meta Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          padding: '16px',
          backgroundColor: '#F8FAFC',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
        }}
      >
        <div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>TỔ CHỨC CHỦ QUẢN</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
            <Building2 size={14} style={{ color: 'var(--dash-text-muted)' }} />
            <span>{incident.organizationName}</span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>CỤM K8S & MÔI TRƯỜNG</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
            <Layers size={14} style={{ color: 'var(--dash-text-muted)' }} />
            <span>{incident.clusterName} ({incident.environment})</span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>NGUỒN PHÁT HIỆN SỰ CỐ</div>
          <div style={{ marginTop: '4px', fontWeight: 600, color: 'var(--dash-text-secondary)', fontSize: '0.8125rem' }}>
            {incident.source}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>THỜI GIAN PHỤC HỒI (MTTR)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontWeight: 800, color: '#059669', fontSize: '1rem' }}>
            <Zap size={16} />
            <span>{incident.recoveryDuration}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncidentDetail;
