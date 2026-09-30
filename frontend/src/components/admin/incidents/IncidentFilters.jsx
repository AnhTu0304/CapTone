import React from 'react';
import { Search, Filter, RotateCcw } from 'lucide-react';

export const IncidentFilters = ({
  search = '',
  onSearchChange,
  severity = 'ALL',
  onSeverityChange,
  status = 'ALL',
  onStatusChange,
  onReset,
}) => {
  return (
    <div
      className="dash-card"
      style={{
        padding: '14px 18px',
        backgroundColor: '#FFFFFF',
        borderRadius: '14px',
        border: '1px solid var(--dash-border)',
        boxShadow: 'var(--dash-shadow-xs)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}
    >
      {/* Search Input */}
      <div style={{ position: 'relative', width: '340px', maxWidth: '100%' }}>
        <input
          type="text"
          placeholder="Tìm mã sự cố, tiêu đề, tổ chức, cụm..."
          aria-label="Tìm kiếm sự cố"
          value={search}
          onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px 8px 34px',
            fontSize: '0.8125rem',
            borderRadius: '8px',
            border: '1px solid var(--dash-border)',
            backgroundColor: '#FFFFFF',
            color: 'var(--dash-text-primary)',
            outline: 'none',
          }}
        />
        <Search
          size={15}
          style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--dash-text-muted)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {/* Severity Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={14} style={{ color: 'var(--dash-text-muted)' }} />
          <select
            aria-label="Lọc theo mức độ nghiêm trọng"
            value={severity}
            onChange={(e) => onSeverityChange && onSeverityChange(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-primary)',
              fontWeight: 500,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">Tất cả mức độ</option>
            <option value="CRITICAL">Nghiêm Trọng (P1)</option>
            <option value="MAJOR">Đáng Kể (P2)</option>
            <option value="MINOR">Nhỏ (P3)</option>
            <option value="INFO">Thông Tin</option>
          </select>
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <select
            aria-label="Lọc theo trạng thái xử lý"
            value={status}
            onChange={(e) => onStatusChange && onStatusChange(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-primary)',
              fontWeight: 500,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="RESOLVED">Đã Khắc Phục</option>
            <option value="HEALING">Đang Tự Phục Hồi</option>
            <option value="AWAITING_APPROVAL">Chờ Duyệt HITL</option>
            <option value="RCA_COMPLETED">Đã Có RCA</option>
            <option value="INVESTIGATING">Đang Điều Tra</option>
          </select>
        </div>

        {/* Reset Button */}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            aria-label="Đặt lại bộ lọc"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-secondary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={12} />
            <span>Đặt lại</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default IncidentFilters;
