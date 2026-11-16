import React from 'react';
import { ArrowUpRight, Radio, Users, Ban, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import OrganizationStatusBadge from './OrganizationStatusBadge';

const getAgentHealthStyle = (health) => {
  if (!health || health === 'Chưa kết nối') {
    return { color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1' };
  }
  if (health.includes('100%') || health === 'ONLINE') {
    return { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' };
  }
  if (health.includes('%') || health.includes('Degraded')) {
    return { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' };
  }
  return { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' };
};

export const OrganizationTable = ({
  organizations = [],
  onViewDetails,
  onSelectOrganization,
  onToggleStatus,
  isLoading = false,
  totalCount,
  page = 1,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
}) => {
  const total = typeof totalCount === 'number' ? totalCount : organizations.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
      role="region"
      aria-label="Bảng danh sách tổ chức doanh nghiệp"
      tabIndex={0}
      style={{
        border: '1px solid var(--dash-border)',
        borderRadius: '14px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        boxShadow: 'var(--dash-shadow-xs)',
        backgroundColor: '#FFFFFF',
      }}
    >
      <table className="dash-table" style={{ width: '100%', fontSize: '0.8125rem' }}>
        <thead>
          <tr>
            <th style={{ minWidth: '240px' }}>Tổ Chức & Tên Miền</th>
            <th style={{ minWidth: '120px' }}>Thành Viên</th>
            <th style={{ minWidth: '140px' }}>Cụm K8s & Pods</th>
            <th style={{ minWidth: '130px' }}>Tác Tử eBPF</th>
            <th style={{ minWidth: '120px' }}>Trạng Thái</th>
            <th style={{ minWidth: '110px' }}>Ngày Tạo</th>
            <th style={{ minWidth: '170px', textAlign: 'right' }}>Thao Tác Quản Trị</th>
          </tr>
        </thead>
        <tbody>
          {organizations.map((org) => {
            const initial = org.name ? org.name.charAt(0).toUpperCase() : 'O';

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
                        flexShrink: 0,
                        border: '1px solid #A7F3D0',
                      }}
                    >
                      {initial}
                    </div>
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          color: 'var(--dash-text-primary)',
                          cursor: 'pointer',
                        }}
                        onClick={() => handleSelect(org)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelect(org);
                          }
                        }}
                      >
                        {org.name}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {org.domain}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Members Count */}
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--dash-text-secondary)', fontWeight: 600 }}>
                    <Users size={13} />
                    <span>{org.membersCount || 1} người</span>
                  </div>
                </td>

                {/* Clusters & Pods */}
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                    {org.clustersCount} / {org.clustersLimit} Cụm
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                    {org.podsCount || 0} Pods
                  </div>
                </td>

                {/* eBPF Agent Status */}
                <td>
                  {(() => {
                    const health = org.agentHealth || 'Chưa kết nối';
                    const style = getAgentHealthStyle(health);
                    return (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: style.bg,
                          border: `1px solid ${style.border}`,
                        }}
                      >
                        <Radio size={12} style={{ color: style.color }} />
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            color: style.color,
                          }}
                        >
                          {health}
                        </span>
                      </div>
                    );
                  })()}
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
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {/* Toggle Suspend / Activate */}
                    {onToggleStatus && (
                      <button
                        type="button"
                        onClick={() => onToggleStatus(org)}
                        title={org.status === 'SUSPENDED' ? 'Mở lại công ty' : 'Tạm ngưng công ty'}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: org.status === 'SUSPENDED' ? '1px solid #BBF7D0' : '1px solid #FECACA',
                          backgroundColor: org.status === 'SUSPENDED' ? '#F0FDF4' : '#FEF2F2',
                          color: org.status === 'SUSPENDED' ? '#15803D' : '#DC2626',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {org.status === 'SUSPENDED' ? <CheckCircle2 size={11} /> : <Ban size={11} />}
                        <span>{org.status === 'SUSPENDED' ? 'Kích Hoạt' : 'Tạm Ngưng'}</span>
                      </button>
                    )}

                    {/* View Details */}
                    <button
                      type="button"
                      onClick={() => handleSelect(org)}
                      aria-label={`Xem chi tiết tổ chức ${org.name}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid var(--dash-border)',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--dash-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      <span>Chi Tiết</span>
                      <ArrowUpRight size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Pagination Footer */}
      {onPageChange && (
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--dash-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: '#FAFAFA',
            fontSize: '0.8125rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--dash-text-muted)' }}>Hiển thị:</span>
            {onPageSizeChange && (
              <select
                aria-label="Số doanh nghiệp mỗi trang"
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--dash-border)',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--dash-text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value={10}>10 doanh nghiệp</option>
                <option value={20}>20 doanh nghiệp</option>
                <option value={50}>50 doanh nghiệp</option>
              </select>
            )}
            <span style={{ color: 'var(--dash-text-secondary)', marginLeft: '4px' }}>
              Hiển thị{' '}
              <strong style={{ color: 'var(--dash-text-primary)' }}>
                {total > 0 ? (page - 1) * pageSize + 1 : 0} - {Math.min(page * pageSize, total)}
              </strong>{' '}
              trên tổng số <strong style={{ color: 'var(--dash-text-primary)' }}>{total}</strong> doanh nghiệp
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label="Trang trước"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: 'var(--dash-radius-sm)',
                border: '1px solid var(--dash-border)',
                backgroundColor: page <= 1 ? '#F1F5F9' : '#FFFFFF',
                color: page <= 1 ? '#94A3B8' : 'var(--dash-text-primary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronLeft size={14} />
              <span>Trước</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                return (
                  <React.Fragment key={p}>
                    {prev && p - prev > 1 && (
                      <span style={{ padding: '0 4px', color: '#94A3B8', fontSize: '0.75rem' }}>...</span>
                    )}
                    <button
                      type="button"
                      onClick={() => onPageChange(p)}
                      aria-label={`Trang ${p}`}
                      style={{
                        minWidth: '28px',
                        height: '28px',
                        padding: '0 6px',
                        borderRadius: 'var(--dash-radius-sm)',
                        border: '1px solid var(--dash-border)',
                        backgroundColor: page === p ? 'var(--dash-primary)' : '#FFFFFF',
                        color: page === p ? '#FFFFFF' : 'var(--dash-text-secondary)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                );
              })}

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              aria-label="Trang tiếp theo"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: 'var(--dash-radius-sm)',
                border: '1px solid var(--dash-border)',
                backgroundColor: page >= totalPages ? '#F1F5F9' : '#FFFFFF',
                color: page >= totalPages ? '#94A3B8' : 'var(--dash-text-primary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              <span>Tiếp</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationTable;
