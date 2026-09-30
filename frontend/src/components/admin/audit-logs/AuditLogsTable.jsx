import React from 'react';
import PropTypes from 'prop-types';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Database
} from 'lucide-react';
import ActorTypeBadge from './ActorTypeBadge';
import AuditStatusBadge from './AuditStatusBadge';

/**
 * AuditLogsTable Component
 * Bảng dữ liệu nhật ký kiểm toán doanh nghiệp 9 cột:
 * - Timestamp
 * - Actor
 * - Actor Type
 * - Action
 * - Resource Type
 * - Resource ID
 * - Organization
 * - Status
 * - IP Address
 * 
 * Hỗ trợ sắp xếp (sorting), phân trang (pagination), và chọn dòng mở drawer chi tiết.
 */
export const AuditLogsTable = ({
  logs = [],
  total = 0,
  page = 1,
  pageSize = 10,
  sorting = { field: 'timestamp', direction: 'desc' },
  onSortChange,
  onPageChange,
  onPageSizeChange,
  onSelectLog,
  loading = false,
}) => {
  const totalPages = Math.ceil(total / pageSize) || 1;

  const handleHeaderClick = (field) => {
    if (!onSortChange) return;
    if (sorting.field === field) {
      onSortChange({
        field,
        direction: sorting.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      onSortChange({ field, direction: 'desc' });
    }
  };

  const renderSortIcon = (field) => {
    if (sorting.field !== field) {
      return <ArrowUpDown size={12} style={{ color: 'var(--dash-text-muted)', opacity: 0.6 }} />;
    }
    return sorting.direction === 'asc' ? (
      <ArrowUp size={12} style={{ color: '#059669' }} />
    ) : (
      <ArrowDown size={12} style={{ color: '#059669' }} />
    );
  };

  return (
    <div
      className="dash-card"
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '14px',
        border: '1px solid var(--dash-border)',
        boxShadow: 'var(--dash-shadow-xs)',
        overflow: 'hidden',
      }}
    >
      {/* Table Container with Smooth Scroll & Keyboard Focus */}
      <div 
        className="dash-table-container"
        role="region"
        aria-label="Bảng nhật ký kiểm toán"
        tabIndex={0}
        style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
      >
        <table
          className="dash-table"
          style={{
            width: '100%',
            fontSize: '0.8125rem',
            borderCollapse: 'collapse',
            textAlign: 'left',
          }}
        >
          <thead>
            <tr
              style={{
                background: 'linear-gradient(180deg, #F0FDF4 0%, #DCFCE7 100%)',
                borderBottom: '1px solid #BBF7D0',
                color: '#166534',
                userSelect: 'none',
              }}
            >
              {/* 1. Timestamp */}
              <th
                onClick={() => handleHeaderClick('timestamp')}
                style={{
                  minWidth: '150px',
                  padding: '12px 14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Thời Gian (Timestamp)</span>
                  {renderSortIcon('timestamp')}
                </div>
              </th>

              {/* 2. Actor */}
              <th
                onClick={() => handleHeaderClick('actor')}
                style={{
                  minWidth: '180px',
                  padding: '12px 14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Tác Nhân (Actor)</span>
                  {renderSortIcon('actor')}
                </div>
              </th>

              {/* 3. Actor Type */}
              <th style={{ minWidth: '120px', padding: '12px 14px', fontWeight: 700 }}>
                Loại Tác Nhân (Actor Type)
              </th>

              {/* 4. Action */}
              <th
                onClick={() => handleHeaderClick('action')}
                style={{
                  minWidth: '180px',
                  padding: '12px 14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Hành Động (Action)</span>
                  {renderSortIcon('action')}
                </div>
              </th>

              {/* 5. Resource Type */}
              <th style={{ minWidth: '130px', padding: '12px 14px', fontWeight: 700 }}>
                Loại Tài Nguyên (Resource Type)
              </th>

              {/* 6. Resource ID */}
              <th style={{ minWidth: '180px', padding: '12px 14px', fontWeight: 700 }}>
                Định Danh (Resource ID)
              </th>

              {/* 7. Organization */}
              <th
                onClick={() => handleHeaderClick('organization')}
                style={{
                  minWidth: '150px',
                  padding: '12px 14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Tổ Chức (Organization)</span>
                  {renderSortIcon('organization')}
                </div>
              </th>

              {/* 8. Status */}
              <th
                onClick={() => handleHeaderClick('status')}
                style={{
                  minWidth: '130px',
                  padding: '12px 14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Trạng Thái (Status)</span>
                  {renderSortIcon('status')}
                </div>
              </th>

              {/* 9. IP Address */}
              <th style={{ minWidth: '140px', padding: '12px 14px', fontWeight: 700 }}>
                Địa Chỉ IP (IP Address)
              </th>

              {/* Action column for visual affordance */}
              <th style={{ minWidth: '60px', padding: '12px 14px', textAlign: 'right' }}>
                Chi Tiết
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ padding: '36px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                  Đang đồng bộ nhật ký kiểm toán bất biến SHA-256...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: '40px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--dash-text-muted)' }}>
                    <Database size={28} />
                    <span style={{ fontWeight: 600 }}>Không tìm thấy bản ghi kiểm toán nào phù hợp với bộ lọc</span>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => onSelectLog && onSelectLog(log)}
                  style={{
                    borderBottom: '1px solid var(--dash-border)',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(240, 253, 244, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {/* 1. Timestamp */}
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-primary)' }}>
                    {log.timestamp}
                  </td>

                  {/* 2. Actor */}
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{log.actor}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {log.id}
                    </div>
                  </td>

                  {/* 3. Actor Type */}
                  <td style={{ padding: '12px 14px' }}>
                    <ActorTypeBadge actorType={log.actorType} />
                  </td>

                  {/* 4. Action */}
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#1E40AF', fontSize: '0.75rem' }}>
                    {log.action}
                  </td>

                  {/* 5. Resource Type */}
                  <td style={{ padding: '12px 14px' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: '#F1F5F9',
                        color: 'var(--dash-text-primary)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {log.resourceType}
                    </span>
                  </td>

                  {/* 6. Resource ID */}
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-primary)' }}>
                    {log.resourceId}
                  </td>

                  {/* 7. Organization */}
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                    {log.organization}
                  </td>

                  {/* 8. Status */}
                  <td style={{ padding: '12px 14px' }}>
                    <AuditStatusBadge status={log.status} />
                  </td>

                  {/* 9. IP Address */}
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
                    {log.ipAddress}
                  </td>

                  {/* Action */}
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                    <button
                      type="button"
                      aria-label={`Xem chi tiết ${log.id}`}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '4px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: '#059669',
                      }}
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--dash-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: '#F8FAFC',
          fontSize: '0.8125rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--dash-text-muted)' }}>Hiển thị:</span>
          <select
            aria-label="Số bản ghi mỗi trang"
            value={pageSize}
            onChange={(e) => onPageSizeChange && onPageSizeChange(Number(e.target.value))}
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
            <option value={10}>10 bản ghi</option>
            <option value={25}>25 bản ghi</option>
            <option value={50}>50 bản ghi</option>
          </select>
          <span style={{ color: 'var(--dash-text-muted)', marginLeft: '6px' }}>
            Tổng số: <strong>{total}</strong> bản ghi
          </span>
        </div>

        {/* Page Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--dash-text-muted)' }}>
            Trang <strong>{page}</strong> / {totalPages}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange && onPageChange(page - 1)}
              aria-label="Trang trước"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                border: '1px solid var(--dash-border)',
                backgroundColor: '#FFFFFF',
                color: page <= 1 ? '#CBD5E1' : 'var(--dash-text-primary)',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronLeft size={16} />
            </button>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange && onPageChange(page + 1)}
              aria-label="Trang tiếp theo"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                border: '1px solid var(--dash-border)',
                backgroundColor: '#FFFFFF',
                color: page >= totalPages ? '#CBD5E1' : 'var(--dash-text-primary)',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

AuditLogsTable.propTypes = {
  logs: PropTypes.arrayOf(PropTypes.object),
  total: PropTypes.number,
  page: PropTypes.number,
  pageSize: PropTypes.number,
  sorting: PropTypes.object,
  onSortChange: PropTypes.func,
  onPageChange: PropTypes.func,
  onPageSizeChange: PropTypes.func,
  onSelectLog: PropTypes.func,
  loading: PropTypes.bool,
};

export default AuditLogsTable;
