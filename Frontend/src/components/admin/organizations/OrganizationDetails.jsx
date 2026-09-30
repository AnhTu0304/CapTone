import React from 'react';
import { Mail, Globe, Calendar, Layers, Box, Lock, ArrowLeft } from 'lucide-react';
import OrganizationStatusBadge from './OrganizationStatusBadge';

export const OrganizationDetails = ({ organization, onBack, onToggleStatus }) => {
  if (!organization) return null;

  const clusterPercent = Math.round((organization.clustersCount / organization.clustersLimit) * 100);
  const podPercent = Math.round((organization.podsCount / organization.podsLimit) * 100);

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
      {/* Top Bar with Back Button & Admin Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Quay lại danh sách tổ chức"
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
          <span>Quay lại danh sách tổ chức</span>
        </button>

        {/* Platform Admin Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={onToggleStatus}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: organization.status === 'ACTIVE' ? '1px solid #FECACA' : '1px solid #A7F3D0',
              backgroundColor: organization.status === 'ACTIVE' ? '#FEF2F2' : '#ECFDF5',
              color: organization.status === 'ACTIVE' ? '#DC2626' : '#065F46',
              transition: 'all 0.15s ease',
            }}
          >
            {organization.status === 'ACTIVE' ? 'Tạm Dừng Hoạt Động Tenant' : 'Kích Hoạt Hoạt Động Tenant'}
          </button>
        </div>
      </div>

      {/* Main Header Info */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #065F46 0%, #059669 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.25rem',
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
              flexShrink: 0,
            }}
          >
            {organization.name.charAt(0).toUpperCase()}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
                {organization.name}
              </h1>
              <OrganizationStatusBadge status={organization.status} />
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--dash-bg-canvas)',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: 'var(--dash-text-secondary)',
                }}
              >
                {organization.plan}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '0.75rem', color: 'var(--dash-text-muted)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)' }}>
                <Globe size={13} />
                <span>{organization.domain}</span>
              </span>
              <span>&bull;</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)' }}>
                <Mail size={13} />
                <span>{organization.contactEmail}</span>
              </span>
              <span>&bull;</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)' }}>
                <Calendar size={13} />
                <span>Khởi tạo: {organization.createdAt}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Security / 2FA Badge */}
        <div
          style={{
            padding: '8px 14px',
            borderRadius: '10px',
            backgroundColor: organization.enforce2FA ? '#F0FDF4' : '#FFFBEB',
            border: organization.enforce2FA ? '1px solid #BBF7D0' : '1px solid #FDE68A',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.75rem',
          }}
        >
          <Lock size={15} color={organization.enforce2FA ? '#059669' : '#D97706'} />
          <div>
            <div style={{ fontWeight: 700, color: organization.enforce2FA ? '#065F46' : '#92400E' }}>
              {organization.enforce2FA ? 'Bắt Buộc Xác Thực 2FA' : 'Chưa Áp Đặt 2FA Bắt Buộc'}
            </div>
            <div style={{ fontSize: '0.6875rem', color: organization.enforce2FA ? '#047857' : '#B45309' }}>
              Chính sách bảo mật đăng nhập
            </div>
          </div>
        </div>
      </div>

      {/* Quota Progress Indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginTop: '4px' }}>
        {/* Cluster Quota */}
        <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid var(--dash-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={14} color="#059669" />
              <span>HẠN MỨC CỤM KUBERNETES</span>
            </span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#065F46', fontFamily: 'var(--font-mono)' }}>
              {organization.clustersCount} / {organization.clustersLimit} Cụm ({clusterPercent}%)
            </span>
          </div>
          <div style={{ height: '7px', backgroundColor: '#E2E8F0', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{ width: `${clusterPercent}%`, height: '100%', backgroundColor: '#10B981', borderRadius: '9999px' }} />
          </div>
        </div>

        {/* Pods Quota */}
        <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid var(--dash-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Box size={14} color="#0284C7" />
              <span>HẠN MỨC PODS HOẠT ĐỘNG</span>
            </span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0369A1', fontFamily: 'var(--font-mono)' }}>
              {organization.podsCount} / {organization.podsLimit} Pods ({podPercent}%)
            </span>
          </div>
          <div style={{ height: '7px', backgroundColor: '#E2E8F0', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{ width: `${podPercent}%`, height: '100%', backgroundColor: '#0284C7', borderRadius: '9999px' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationDetails;
