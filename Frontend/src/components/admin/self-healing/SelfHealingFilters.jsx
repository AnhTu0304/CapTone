import React from 'react';
import { Search, Filter, RotateCcw } from 'lucide-react';

export const SelfHealingFilters = ({
  search = '',
  onSearchChange,
  riskLevel = 'ALL',
  onRiskLevelChange,
  executionMode = 'ALL',
  onExecutionModeChange,
  executionStatus = 'ALL',
  onExecutionStatusChange,
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
          placeholder="Tìm hành động, tài nguyên K8s, tổ chức..."
          aria-label="Tìm kiếm hành động tự phục hồi"
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

      {/* Select Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {/* Risk Level Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={14} style={{ color: 'var(--dash-text-muted)' }} />
          <select
            aria-label="Lọc theo mức độ rủi ro"
            value={riskLevel}
            onChange={(e) => onRiskLevelChange && onRiskLevelChange(e.target.value)}
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
            <option value="ALL">Tất cả mức rủi ro</option>
            <option value="LOW">Thấp (Low)</option>
            <option value="MEDIUM">Trung Bình (Medium)</option>
            <option value="HIGH">Cao (High)</option>
            <option value="CRITICAL">Nguy Cấp (Critical)</option>
          </select>
        </div>

        {/* Execution Mode Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <select
            aria-label="Lọc theo chế độ thực thi"
            value={executionMode}
            onChange={(e) => onExecutionModeChange && onExecutionModeChange(e.target.value)}
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
            <option value="ALL">Tất cả chế độ</option>
            <option value="AUTONOMOUS">Tự Trị AI (Autonomous)</option>
            <option value="HITL_GATE">Cổng Duyệt HITL</option>
            <option value="MANUAL">Thủ Công (Manual)</option>
          </select>
        </div>

        {/* Execution Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <select
            aria-label="Lọc theo trạng thái thực thi"
            value={executionStatus}
            onChange={(e) => onExecutionStatusChange && onExecutionStatusChange(e.target.value)}
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
            <option value="SUCCEEDED">Thành Công</option>
            <option value="EXECUTING">Đang Thi Hành</option>
            <option value="FAILED">Thất Bại</option>
            <option value="ROLLED_BACK">Đã Hoàn Nguyên</option>
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
              backgroundColor: '#F8FAFC',
              color: 'var(--dash-text-secondary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={13} />
            <span>Đặt lại</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default SelfHealingFilters;
