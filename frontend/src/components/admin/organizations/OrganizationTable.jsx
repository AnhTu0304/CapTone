import React from 'react';
import { Layers, ArrowUpRight, Radio } from 'lucide-react';
import OrganizationStatusBadge from './OrganizationStatusBadge';

export const OrganizationTable = ({
  organizations = [],
  onViewDetails,
  onSelectOrganization,
  isLoading = false,
}) => {
  const handleSelect = (org) => {
    if (onSelectOrganization) {
      onSelectOrganization(org);
    } else if (onViewDetails) {
      onViewDetails(org.id);
    }
  };

  if (isLoading) {
    return (
      <div
        className="dash-card"
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid var(--dash-border)',
          color: 'var(--dash-text-muted)',
          fontSize: '0.875rem',
        }}
      >
        Đang tải danh sách tổ chức & tenants...
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div
        className="dash-card"
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px dashed var(--dash-border)',
          color: 'var(--dash-text-muted)',
          fontSize: '0.875rem',
        }}
      >
        Không tìm thấy tổ chức nào phù hợp với bộ lọc hiện tại.
      </div>
    );
  }

  return (
    <div
      className="dash-table-container"
      style={{
        border: '1px solid var(--dash-border)',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: 'var(--dash-shadow-xs)',
        backgroundColor: '#FFFFFF',
      }}
    >
      <table className="dash-table" style={{ width: '100%', fontSize: '0.8125rem' }}>
        <thead>
          <tr>
            <th style={{ minWidth: '220px' }}>Tổ Chức & Tên Miền</th>
            <th style={{ minWidth: '140px' }}>Gói Dịch Vụ</th>
            <th style={{ minWidth: '140px' }}>Cụm K8s (Dùng / Hạn Mức)</th>
            <th style={{ minWidth: '140px' }}>Pods Hoạt Động</th>
            <th style={{ minWidth: '130px' }}>Tác Tử eBPF</th>
            <th style={{ minWidth: '130px' }}>Trạng Thái</th>
            <th style={{ minWidth: '100px' }}>Ngày Tạo</th>
            <th style={{ minWidth: '110px', textAlign: 'right' }}>Thao Tác</th>
          </tr>
        </thead>
        <tbody>
          {organizations.map((org) => {
            const initial = org.name.charAt(0).toUpperCase();

            return (
              <tr key={org.id} style={{ transition: 'background-color 0.15s ease' }}>
                {/* Org Name & Domain */}
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '9px',
                        background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
                        color: '#065F46',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.875rem',
                        border: '1px solid #A7F3D0',
                        flexShrink: 0,
                      }}
                    >
                      {initial}
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => handleSelect(org)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          textAlign: 'left',
                          fontWeight: 700,
                          color: 'var(--dash-text-primary)',
                          cursor: 'pointer',
                          display: 'block',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#059669')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--dash-text-primary)')}
                      >
                        {org.name}
                      </button>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {org.slug} &bull; {org.domain}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Subscription Plan */}
                <td>
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      backgroundColor:
                        org.plan === 'Enterprise Cloud'
                          ? '#EFF6FF'
                          : org.plan === 'SME Pro'
                          ? '#F5F3FF'
                          : '#F1F5F9',
                      color:
                        org.plan === 'Enterprise Cloud'
                          ? '#1D4ED8'
                          : org.plan === 'SME Pro'
                          ? '#6D28D9'
                          : '#475569',
                      border: `1px solid ${
                        org.plan === 'Enterprise Cloud'
                          ? '#BFDBFE'
                          : org.plan === 'SME Pro'
                          ? '#DDD6FE'
                          : '#E2E8F0'
                      }`,
                    }}
                  >
                    {org.plan}
                  </span>
                </td>

                {/* Clusters Quota */}
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={14} style={{ color: 'var(--dash-text-muted)' }} />
                    <span style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                      {org.clustersCount} / {org.clustersLimit} Cụm
                    </span>
                  </div>
                  <div
                    style={{
                      width: '90px',
                      height: '4px',
                      backgroundColor: '#E2E8F0',
                      borderRadius: '2px',
                      marginTop: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, Math.round((org.clustersCount / org.clustersLimit) * 100))}%`,
                        height: '100%',
                        backgroundColor: '#059669',
                        borderRadius: '2px',
                      }}
                    />
                  </div>
                </td>

                {/* Pods Quota */}
                <td>
                  <span style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                    {org.podsCount.toLocaleString('vi-VN')} / {org.podsLimit.toLocaleString('vi-VN')} Pods
                  </span>
                </td>

                {/* eBPF Agent Status */}
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Radio
                      size={13}
                      style={{
                        color: org.agentHealth.includes('100%')
                          ? '#059669'
                          : org.agentHealth.includes('Degraded')
                          ? '#D97706'
                          : '#DC2626',
                      }}
                    />
                    <span
                      style={{
                        fontWeight: 600,
                        color: org.agentHealth.includes('100%')
                          ? '#059669'
                          : org.agentHealth.includes('Degraded')
                          ? '#D97706'
                          : '#DC2626',
                      }}
                    >
                      {org.agentHealth}
                    </span>
                  </div>
                </td>

                {/* Status */}
                <td>
                  <OrganizationStatusBadge status={org.status} />
                </td>

                {/* Creation Date */}
                <td style={{ color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                  {org.createdAt}
                </td>

                {/* Actions */}
                <td style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => handleSelect(org)}
                    aria-label={`Xem chi tiết tổ chức ${org.name}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '5px 12px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--dash-border)',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--dash-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: 'var(--dash-shadow-xs)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--dash-primary)';
                      e.currentTarget.style.backgroundColor = 'var(--dash-primary-light)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--dash-border)';
                      e.currentTarget.style.backgroundColor = '#FFFFFF';
                    }}
                  >
                    <span>Xem Chi Tiết</span>
                    <ArrowUpRight size={13} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default OrganizationTable;
