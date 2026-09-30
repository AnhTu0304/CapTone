import React, { useState, useEffect, useCallback } from 'react';
import { Building2, RefreshCw, CheckCircle2, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { getOrganizations } from '../../../services/adminOrganizationsService';
import OrganizationTable from '../../../components/admin/organizations/OrganizationTable';
import OrganizationFilters from '../../../components/admin/organizations/OrganizationFilters';

export const OrganizationsListPage = ({ onNavigate }) => {
  const [organizations, setOrganizations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [planFilter, setPlanFilter] = useState('ALL');

  const fetchOrganizationsData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getOrganizations({
        status: statusFilter,
        plan: planFilter,
        query: searchQuery,
      });
      setOrganizations(data);
    } catch (err) {
      console.error('Lỗi khi tải danh sách tổ chức:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, planFilter, searchQuery]);

  useEffect(() => {
    fetchOrganizationsData();
  }, [fetchOrganizationsData]);

  const handleSelectOrg = (org) => {
    if (onNavigate) {
      onNavigate(`/admin/organizations/${org.id}`);
    }
  };

  const activeCount = organizations.filter((o) => o.status === 'ACTIVE').length;
  const trialCount = organizations.filter((o) => o.status === 'TRIAL').length;
  const suspendedCount = organizations.filter((o) => o.status === 'SUSPENDED').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: '#ECFDF5',
                color: '#065F46',
                border: '1px solid #A7F3D0',
                fontWeight: 700,
                fontSize: '0.6875rem',
              }}
            >
              <ShieldCheck size={12} /> Cấp Độ Quản Trị Hệ Thống (Platform Super Admin)
            </span>
          </div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: 'var(--dash-text-primary)',
              margin: '8px 0 4px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Building2 size={26} style={{ color: '#059669' }} />
            Quản Lý Tổ Chức & Doanh Nghiệp (Tenants)
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0 }}>
            Quản lý tập trung toàn bộ doanh nghiệp thuê bao đa người dùng (Multi-tenant), phân bổ hạn mức hạ tầng K8s và giám sát sức khỏe tác tử.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={fetchOrganizationsData}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              color: 'var(--dash-text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'spin-icon' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>TỔNG SỐ TỔ CHỨC</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '4px' }}>
            {organizations.length}
          </div>
        </div>

        <div
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #BBF7D0',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#065F46', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={13} /> ĐANG HOẠT ĐỘNG
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
            {activeCount}
          </div>
        </div>

        <div
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #FEF08A',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#854D0E', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={13} /> ĐANG DÙNG THỬ (TRIAL)
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#CA8A04', marginTop: '4px' }}>
            {trialCount}
          </div>
        </div>

        <div
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #FECACA',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#991B1B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={13} /> TẠM DỪNG (SUSPENDED)
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
            {suspendedCount}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <OrganizationFilters
        search={searchQuery}
        onSearchChange={setSearchQuery}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        plan={planFilter}
        onPlanChange={setPlanFilter}
        totalCount={organizations.length}
      />

      {/* Organizations Table */}
      <OrganizationTable
        organizations={organizations}
        isLoading={isLoading}
        onSelectOrganization={handleSelectOrg}
      />
    </div>
  );
};

export default OrganizationsListPage;
