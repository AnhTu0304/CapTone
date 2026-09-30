import React from 'react';
import { Search, Filter, Tag } from 'lucide-react';

export const OrganizationFilters = ({
  search,
  onSearchChange,
  status,
  onStatusChange,
  plan,
  onPlanChange,
  totalCount = 0,
}) => {
  return (
    <div
      className="dash-card"
      style={{
        padding: '16px 20px',
        backgroundColor: '#FFFFFF',
        borderRadius: '14px',
        border: '1px solid var(--dash-border)',
        boxShadow: 'var(--dash-shadow-xs)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
      }}
    >
      {/* Search Input */}
      <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
        <input
          type="text"
          placeholder="Tìm theo tên tổ chức, slug hoặc email..."
          aria-label="Tìm kiếm tổ chức"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px 8px 34px',
            fontSize: '0.8125rem',
            borderRadius: '9px',
            border: '1px solid var(--dash-border)',
            backgroundColor: 'var(--dash-bg-canvas)',
            color: 'var(--dash-text-primary)',
            outline: 'none',
            transition: 'border-color 0.15s ease',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--dash-primary)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--dash-border)')}
        />
        <Search
          size={15}
          color="#94A3B8"
          style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Filter Controls & Count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {/* Status Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={14} color="#64748B" />
          <select
            aria-label="Lọc theo trạng thái"
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: 'var(--dash-bg-canvas)',
              color: 'var(--dash-text-primary)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="ALL">Mọi Trạng Thái</option>
            <option value="ACTIVE">Đang Hoạt Động</option>
            <option value="TRIAL">Dùng Thử Nghiệm</option>
            <option value="SUSPENDED">Đang Tạm Dừng</option>
          </select>
        </div>

        {/* Plan Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Tag size={14} color="#64748B" />
          <select
            aria-label="Lọc theo gói cước"
            value={plan}
            onChange={(e) => onPlanChange(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: 'var(--dash-bg-canvas)',
              color: 'var(--dash-text-primary)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="ALL">Mọi Gói Dịch Vụ</option>
            <option value="SME Starter">SME Starter</option>
            <option value="SME Pro">SME Pro</option>
            <option value="Enterprise Cloud">Enterprise Cloud</option>
          </select>
        </div>

        {/* Total Count Pill */}
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--dash-text-muted)',
            fontFamily: 'var(--font-mono)',
            padding: '4px 10px',
            backgroundColor: 'var(--dash-bg-canvas)',
            borderRadius: '6px',
            border: '1px solid var(--dash-border)',
          }}
        >
          Tổng cộng: <strong style={{ color: 'var(--dash-text-primary)' }}>{totalCount}</strong> tổ chức
        </div>
      </div>
    </div>
  );
};

export default OrganizationFilters;
