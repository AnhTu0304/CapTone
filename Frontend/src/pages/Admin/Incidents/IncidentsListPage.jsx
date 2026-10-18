import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, RefreshCw, ShieldCheck, CheckCircle2, Clock, Zap } from 'lucide-react';
import { getIncidents, getIncidentKPIs } from '../../../services/adminIncidentsService';
import IncidentTable from '../../../components/admin/incidents/IncidentTable';
import IncidentFilters from '../../../components/admin/incidents/IncidentFilters';
import { useDebounce } from '../../../hooks/useDebounce';
import { AdminErrorState } from '../../../components/admin/common';

export const IncidentsListPage = ({ onNavigate }) => {
  const [incidents, setIncidents] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const debouncedSearch = useDebounce(search, 300);

  // Load KPIs
  useEffect(() => {
    let isMounted = true;
    getIncidentKPIs()
      .then((data) => {
        if (isMounted) setKpis(data);
      })
      .catch((err) => {
        console.error('Lỗi khi nạp KPI sự cố:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch incidents list
  const fetchIncidentsData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getIncidents({
        search: debouncedSearch,
        severity: severityFilter,
        status: statusFilter,
      });
      setIncidents(data);
    } catch (err) {
      console.error('Lỗi khi tải danh sách sự cố:', err);
      setError('Không thể tải danh sách sự cố từ máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, severityFilter, statusFilter]);

  useEffect(() => {
    fetchIncidentsData();
  }, [fetchIncidentsData]);

  const handleViewIncident = (inc) => {
    if (onNavigate) {
      onNavigate(`/admin/incidents/${inc.id}`);
    }
  };

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
            <AlertCircle size={26} style={{ color: '#059669' }} />
            Quản Lý Sự Cố & Điều Tra Nguyên Nhân Gốc Rễ (RCA)
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0 }}>
            Giám sát tập trung toàn bộ sự cố đa tổ chức (Multi-tenant), phân tích nguyên nhân gốc rễ và theo dõi chu trình tự phục hồi MAPE-K 8 giai đoạn.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={fetchIncidentsData}
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

      {/* KPI Overview Cards */}
      {kpis && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
          }}
        >
          <div style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--dash-border)', boxShadow: 'var(--dash-shadow-xs)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>TỔNG SỐ SỰ CỐ</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '4px' }}>
              {kpis.totalIncidents}
            </div>
          </div>

          <div style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #FECACA', boxShadow: 'var(--dash-shadow-xs)' }}>
            <div style={{ fontSize: '0.75rem', color: '#991B1B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertCircle size={13} /> NGHIÊM TRỌNG (P1)
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
              {kpis.criticalCount}
            </div>
          </div>

          <div style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #FDE68A', boxShadow: 'var(--dash-shadow-xs)' }}>
            <div style={{ fontSize: '0.75rem', color: '#92400E', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={13} /> CHỜ DUYỆT HITL
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>
              {kpis.awaitingApprovalCount}
            </div>
          </div>

          <div style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #BBF7D0', boxShadow: 'var(--dash-shadow-xs)' }}>
            <div style={{ fontSize: '0.75rem', color: '#065F46', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} /> ĐÃ KHẮC PHỤC
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
              {kpis.resolvedCount}
            </div>
          </div>

          <div style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--dash-border)', boxShadow: 'var(--dash-shadow-xs)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Zap size={13} style={{ color: '#059669' }} /> MTTR TRUNG BÌNH
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
              {kpis.averageMTTR}
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <IncidentFilters
        search={search}
        onSearchChange={setSearch}
        severity={severityFilter}
        onSeverityChange={setSeverityFilter}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        onReset={() => {
          setSearch('');
          setSeverityFilter('ALL');
          setStatusFilter('ALL');
        }}
      />

      {/* Error State if fetch failed */}
      {error && (
        <AdminErrorState
          title="Không thể tải danh sách sự cố"
          message={error}
          onRetry={fetchIncidentsData}
          isRetrying={isLoading}
        />
      )}

      {/* Incidents Table */}
      <IncidentTable
        incidents={incidents}
        isLoading={isLoading}
        onViewIncident={handleViewIncident}
      />
    </div>
  );
};

export default IncidentsListPage;
