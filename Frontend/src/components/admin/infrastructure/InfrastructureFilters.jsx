import React from 'react';
import { Search, Filter, RotateCcw } from 'lucide-react';

export const InfrastructureFilters = ({
  search = '',
  onSearchChange,
  placeholder = 'Tìm kiếm tài nguyên hạ tầng...',
  status = 'ALL',
  onStatusChange,
  statusOptions = [
    { value: 'ALL', label: 'Tất cả trạng thái' },
    { value: 'READY', label: 'Sẵn sàng (Ready)' },
    { value: 'WARNING', label: 'Cảnh báo (Warning)' },
    { value: 'CRITICAL', label: 'Nguy cấp (Critical)' },
  ],
  secondaryValue,
  onSecondaryChange,
  secondaryLabel = 'Phân loại',
  secondaryOptions = null,
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
      <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
        <input
          type="text"
          placeholder={placeholder}
          aria-label="Tìm kiếm hạ tầng"
          value={search}
          onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px 8px 34px',
            fontSize: '0.8125rem',
            borderRadius: '8px',
            border: '1px solid var(--dash-border)',
            backgroundColor: 'var(--dash-card-bg, #FFFFFF)',
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

      {/* Dropdown Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {/* Status Dropdown */}
        {statusOptions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} style={{ color: 'var(--dash-text-muted)' }} />
            <select
              aria-label="Lọc theo trạng thái"
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
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Secondary Dropdown (e.g. Type, Cluster, Organization) */}
        {secondaryOptions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>
              {secondaryLabel}:
            </span>
            <select
              aria-label={`Lọc theo ${secondaryLabel}`}
              value={secondaryValue}
              onChange={(e) => onSecondaryChange && onSecondaryChange(e.target.value)}
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
              {secondaryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Reset Filters */}
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

export default InfrastructureFilters;
