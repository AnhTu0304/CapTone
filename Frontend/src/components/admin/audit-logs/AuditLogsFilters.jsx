import React from 'react';
import PropTypes from 'prop-types';
import { Search, RotateCcw, X, Filter } from 'lucide-react';

/**
 * AuditLogsFilters Component
 * Hỗ trợ thanh tìm kiếm toàn văn, 7 bộ lọc chuyên sâu và danh sách filter chips.
 */
export const AuditLogsFilters = ({
  filters,
  onFilterChange,
  onResetFilters,
  onRemoveFilterChip,
}) => {
  const {
    search = '',
    dateRange = 'ALL',
    actor = '',
    actorType = 'ALL',
    action = 'ALL',
    resourceType = 'ALL',
    organization = 'ALL',
    status = 'ALL',
  } = filters;

  // Xác định các bộ lọc đang kích hoạt để render Filter Chips
  const activeChips = [];
  if (search.trim()) {
    activeChips.push({ key: 'search', label: `Từ khóa: "${search}"` });
  }
  if (dateRange !== 'ALL') {
    activeChips.push({
      key: 'dateRange',
      label: `Thời gian: ${dateRange === '24H' ? '24 giờ qua' : dateRange === '7D' ? '7 ngày qua' : dateRange === '30D' ? '30 ngày qua' : dateRange}`,
    });
  }
  if (actor.trim()) {
    activeChips.push({ key: 'actor', label: `Tác nhân: "${actor}"` });
  }
  if (actorType !== 'ALL') {
    activeChips.push({ key: 'actorType', label: `Loại tác nhân: ${actorType}` });
  }
  if (action !== 'ALL') {
    activeChips.push({ key: 'action', label: `Hành động: ${action}` });
  }
  if (resourceType !== 'ALL') {
    activeChips.push({ key: 'resourceType', label: `Tài nguyên: ${resourceType}` });
  }
  if (organization !== 'ALL') {
    activeChips.push({ key: 'organization', label: `Tổ chức: ${organization}` });
  }
  if (status !== 'ALL') {
    activeChips.push({ key: 'status', label: `Trạng thái: ${status}` });
  }

  const hasActiveFilters = activeChips.length > 0;

  return (
    <div
      className="dash-card"
      style={{
        padding: '16px',
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid var(--dash-border)',
        boxShadow: 'var(--dash-shadow-xs)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Top Filter Row: Search & Dropdowns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '10px',
          alignItems: 'center',
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', gridColumn: 'span 2' }}>
          <input
            type="text"
            placeholder="Tìm theo tác nhân, hành động, ID tài nguyên, IP, băm SHA-256..."
            value={search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#F8FAFC',
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

        {/* 1. Date Range Filter */}
        <select
          aria-label="Lọc theo khoảng thời gian"
          value={dateRange}
          onChange={(e) => onFilterChange('dateRange', e.target.value)}
          style={{
            padding: '8px 10px',
            borderRadius: '8px',
            fontSize: '0.8125rem',
            border: '1px solid var(--dash-border)',
            backgroundColor: '#FFFFFF',
            color: 'var(--dash-text-primary)',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="ALL">Mọi thời điểm (Date Range)</option>
          <option value="24H">24 giờ qua</option>
          <option value="7D">7 ngày qua</option>
          <option value="30D">30 ngày qua</option>
        </select>

        {/* 2. Actor Type Filter */}
        <select
          aria-label="Lọc theo loại tác nhân"
          value={actorType}
          onChange={(e) => onFilterChange('actorType', e.target.value)}
          style={{
            padding: '8px 10px',
            borderRadius: '8px',
            fontSize: '0.8125rem',
            border: '1px solid var(--dash-border)',
            backgroundColor: '#FFFFFF',
            color: 'var(--dash-text-primary)',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="ALL">Tất cả loại tác nhân (Actor Type)</option>
          <option value="USER">USER (Người dùng / Admin)</option>
          <option value="SYSTEM_AI">SYSTEM_AI (Động cơ AI / MAPE-K)</option>
          <option value="EBPF_AGENT">EBPF_AGENT (Tác tử Kernel)</option>
          <option value="API_KEY">API_KEY (Khóa API tích hợp)</option>
        </select>

        {/* 3. Action Filter */}
        <select
          aria-label="Lọc theo hành động"
          value={action}
          onChange={(e) => onFilterChange('action', e.target.value)}
          style={{
            padding: '8px 10px',
            borderRadius: '8px',
            fontSize: '0.8125rem',
            border: '1px solid var(--dash-border)',
            backgroundColor: '#FFFFFF',
            color: 'var(--dash-text-primary)',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="ALL">Tất cả hành động (Action)</option>
          <option value="HITL_APPROVAL_GRANTED">HITL_APPROVAL_GRANTED</option>
          <option value="K8S_LIMIT_PATCH">K8S_LIMIT_PATCH</option>
          <option value="POLICY_CONFIG_UPDATED">POLICY_CONFIG_UPDATED</option>
          <option value="ROLLING_RESTART">ROLLING_RESTART</option>
          <option value="ORG_QUOTA_ADJUSTED">ORG_QUOTA_ADJUSTED</option>
          <option value="TENANT_SUSPEND">TENANT_SUSPEND</option>
          <option value="KERNEL_PROBE_ANOMALY">KERNEL_PROBE_ANOMALY</option>
          <option value="AUDIT_EXPORT_CSV">AUDIT_EXPORT_CSV</option>
          <option value="SECRET_DECRYPT_ATTEMPT">SECRET_DECRYPT_ATTEMPT</option>
          <option value="NODE_CORDON_DRAIN">NODE_CORDON_DRAIN</option>
          <option value="CLUSTER_SYNC">CLUSTER_SYNC</option>
          <option value="AGENT_SELF_HEAL">AGENT_SELF_HEAL</option>
        </select>

        {/* 4. Resource Type Filter */}
        <select
          aria-label="Lọc theo loại tài nguyên"
          value={resourceType}
          onChange={(e) => onFilterChange('resourceType', e.target.value)}
          style={{
            padding: '8px 10px',
            borderRadius: '8px',
            fontSize: '0.8125rem',
            border: '1px solid var(--dash-border)',
            backgroundColor: '#FFFFFF',
            color: 'var(--dash-text-primary)',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="ALL">Tất cả tài nguyên (Resource)</option>
          <option value="Deployment">Deployment</option>
          <option value="Node">Node</option>
          <option value="Policy">Policy</option>
          <option value="Organization">Organization</option>
          <option value="Cluster">Cluster</option>
          <option value="Secret">Secret</option>
        </select>

        {/* 5. Organization Filter */}
        <select
          aria-label="Lọc theo tổ chức"
          value={organization}
          onChange={(e) => onFilterChange('organization', e.target.value)}
          style={{
            padding: '8px 10px',
            borderRadius: '8px',
            fontSize: '0.8125rem',
            border: '1px solid var(--dash-border)',
            backgroundColor: '#FFFFFF',
            color: 'var(--dash-text-primary)',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="ALL">Tất cả tổ chức (Organization)</option>
          <option value="FinTech Global">FinTech Global</option>
          <option value="Retail Corp">Retail Corp</option>
          <option value="LogiChain Logistics">LogiChain Logistics</option>
          <option value="TechCorp Solutions">TechCorp Solutions</option>
          <option value="Global Platform">Global Platform</option>
        </select>

        {/* 6. Status Filter */}
        <select
          aria-label="Lọc theo trạng thái"
          value={status}
          onChange={(e) => onFilterChange('status', e.target.value)}
          style={{
            padding: '8px 10px',
            borderRadius: '8px',
            fontSize: '0.8125rem',
            border: '1px solid var(--dash-border)',
            backgroundColor: '#FFFFFF',
            color: 'var(--dash-text-primary)',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="ALL">Tất cả trạng thái (Status)</option>
          <option value="SUCCESS">Thành công (SUCCESS)</option>
          <option value="FAILED">Thất bại (FAILED)</option>
          <option value="BLOCKED">Bị chặn (BLOCKED)</option>
          <option value="PENDING_VERIFY">Đang xác thực (PENDING)</option>
        </select>
      </div>

      {/* Filter Chips Bar */}
      {hasActiveFilters && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            paddingTop: '8px',
            borderTop: '1px solid var(--dash-border)',
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--dash-text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Filter size={12} /> Đang áp dụng ({activeChips.length}):
          </span>

          {activeChips.map((chip) => (
            <span
              key={chip.key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: '#EFF6FF',
                color: '#1D4ED8',
                border: '1px solid #BFDBFE',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              <span>{chip.label}</span>
              <button
                type="button"
                onClick={() => onRemoveFilterChip(chip.key)}
                aria-label={`Xóa bộ lọc ${chip.key}`}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: '#2563EB',
                }}
              >
                <X size={12} />
              </button>
            </span>
          ))}

          <button
            type="button"
            onClick={onResetFilters}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#DC2626',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            <RotateCcw size={11} />
            <span>Xóa tất cả</span>
          </button>
        </div>
      )}
    </div>
  );
};

AuditLogsFilters.propTypes = {
  filters: PropTypes.object.isRequired,
  onFilterChange: PropTypes.func.isRequired,
  onResetFilters: PropTypes.func.isRequired,
  onRemoveFilterChip: PropTypes.func.isRequired,
};

export default AuditLogsFilters;
