import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { 
  ShieldAlert, 
  Lock, 
  RefreshCw, 
  CheckCircle2, 
  FileSpreadsheet, 
  Bot, 
  Users 
} from 'lucide-react';
import { 
  getAuditLogs, 
  getAuditSummaryKPIs 
} from '../../../services/adminAuditLogsService';

import AuditLogsFilters from '../../../components/admin/audit-logs/AuditLogsFilters';
import AuditLogsTable from '../../../components/admin/audit-logs/AuditLogsTable';
import AuditDetailDrawer from '../../../components/admin/audit-logs/AuditDetailDrawer';
import { useDebounce } from '../../../hooks/useDebounce';
import { AdminErrorState } from '../../../components/admin/common';

/**
 * AdminAuditLogsPage Component
 * Tuyến đường: /admin/audit-logs
 * 
 * Bảng nhật ký kiểm toán chuẩn doanh nghiệp:
 * - 9 Cột: Timestamp, Actor, Actor Type, Action, Resource Type, Resource ID, Organization, Status, IP Address
 * - 7 Bộ lọc: Date range, Actor, Actor type, Action, Resource, Organization, Status
 * - Bổ sung: pagination, sorting, search, filter chips, detail drawer
 * - Ranh giới an toàn: Nghiêm cấm chỉnh sửa bản ghi từ UI (Append-only & SHA-256 sealed).
 */
export const AdminAuditLogsPage = ({ onNavigate }) => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [summaryKPIs, setSummaryKPIs] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sorting state
  const [sorting, setSorting] = useState({ field: 'timestamp', direction: 'desc' });

  // Filters state
  const [filters, setFilters] = useState({
    search: '',
    dateRange: 'ALL',
    actor: '',
    actorType: 'ALL',
    action: 'ALL',
    resourceType: 'ALL',
    organization: 'ALL',
    status: 'ALL',
  });

  const debouncedSearch = useDebounce(filters.search, 300);

  // Load Overview KPIs independently (not refetched on every pagination click)
  const fetchSummaryKPIs = useCallback(async () => {
    try {
      const kpiRes = await getAuditSummaryKPIs();
      setSummaryKPIs(kpiRes);
    } catch (err) {
      console.error('Lỗi khi nạp KPI tổng quan kiểm toán:', err);
    }
  }, []);

  useEffect(() => {
    fetchSummaryKPIs();
  }, [fetchSummaryKPIs]);

  // Selected Log for Detail Drawer
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchAuditData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const activeFilters = {
        ...filters,
        search: debouncedSearch,
      };
      const auditRes = await getAuditLogs(activeFilters, { page, pageSize }, sorting);
      setLogs(auditRes.data);
      setTotal(auditRes.total);
    } catch (err) {
      console.error('Lỗi khi nạp dữ liệu nhật ký kiểm toán:', err);
      setError('Không thể tải nhật ký kiểm toán từ máy chủ. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  }, [filters, debouncedSearch, page, pageSize, sorting]);

  useEffect(() => {
    fetchAuditData();
  }, [fetchAuditData]);

  // Handle single filter change
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
    setPage(1); // Reset to page 1 on filter
  };

  // Handle resetting all filters
  const handleResetFilters = () => {
    setFilters({
      search: '',
      dateRange: 'ALL',
      actor: '',
      actorType: 'ALL',
      action: 'ALL',
      resourceType: 'ALL',
      organization: 'ALL',
      status: 'ALL',
    });
    setPage(1);
  };

  // Handle removing a single filter chip
  const handleRemoveFilterChip = (key) => {
    setFilters((prev) => ({
      ...prev,
      [key]: key === 'search' || key === 'actor' ? '' : 'ALL',
    }));
    setPage(1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #065F46 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
              color: '#FFFFFF',
            }}
          >
            <ShieldAlert size={26} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: 'var(--dash-text-primary)',
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}
              >
                Nhật Ký Kiểm Toán SHA-256 (Audit Logs)
              </h1>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  backgroundColor: '#ECFDF5',
                  color: '#065F46',
                  border: '1px solid #A7F3D0',
                }}
              >
                <Lock size={11} /> Append-Only Immutable Ledger
              </span>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
              Lưu trữ tập trung mọi can thiệp từ quản trị viên, động cơ AI MAPE-K và tác tử eBPF. Dữ liệu được ký số SHA-256 bất biến, không thể sửa đổi từ giao diện.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={fetchAuditData}
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
              cursor: 'pointer',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {summaryKPIs && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
          }}
        >
          {/* 1. Total Logs */}
          <div
            className="dash-card"
            style={{
              padding: '16px',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid var(--dash-border)',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <FileSpreadsheet size={14} style={{ color: '#059669' }} /> TỔNG BẢN GHI KIỂM TOÁN
            </div>
            <div style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              {summaryKPIs.totalLogs}
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
              Đã niêm phong mật mã
            </div>
          </div>

          {/* 2. Cryptographic Integrity */}
          <div
            className="dash-card"
            style={{
              padding: '16px',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #BBF7D0',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#065F46', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <CheckCircle2 size={14} /> TÍNH TOÀN VẸN MẬT MÃ
            </div>
            <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#059669', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              {summaryKPIs.verifiedIntegrity}
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#065F46', fontWeight: 600, marginTop: '2px' }}>
              Không có xung đột băm
            </div>
          </div>

          {/* 3. Blocked Violations */}
          <div
            className="dash-card"
            style={{
              padding: '16px',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #FECDD3',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#BE123C', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ShieldAlert size={14} /> HÀNH VI BỊ CHẶN (BLOCKED)
            </div>
            <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#E11D48', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              {summaryKPIs.blockedViolations}
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#BE123C', fontWeight: 600, marginTop: '2px' }}>
              Ngăn chặn vi phạm RBAC
            </div>
          </div>

          {/* 4. Autonomous Actions */}
          <div
            className="dash-card"
            style={{
              padding: '16px',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid var(--dash-border)',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Bot size={14} style={{ color: '#2563EB' }} /> CAN THIỆP TỰ ĐỘNG AI
            </div>
            <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#1D4ED8', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              {summaryKPIs.autonomousActions}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600, marginTop: '2px' }}>
              MAPE-K & K8s Operator
            </div>
          </div>

          {/* 5. Active Actors */}
          <div
            className="dash-card"
            style={{
              padding: '16px',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid var(--dash-border)',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Users size={14} style={{ color: '#7C3AED' }} /> TÁC NHÂN ĐÃ GHI NHẬN
            </div>
            <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#6D28D9', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              {summaryKPIs.activeActorsCount}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600, marginTop: '2px' }}>
              Quản trị viên, AI & Tác tử eBPF
            </div>
          </div>
        </div>
      )}

      {/* Filters Bar with Filter Chips */}
      <AuditLogsFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        onRemoveFilterChip={handleRemoveFilterChip}
      />

      {/* Error state if fetch failed */}
      {error && (
        <AdminErrorState
          title="Không thể tải nhật ký kiểm toán"
          message={error}
          onRetry={fetchAuditData}
          isRetrying={isLoading}
        />
      )}

      {/* Main Enterprise Audit Table */}
      <AuditLogsTable
        logs={logs}
        total={total}
        page={page}
        pageSize={pageSize}
        sorting={sorting}
        onSortChange={setSorting}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
        onSelectLog={(log) => setSelectedLog(log)}
        loading={isLoading}
      />

      {/* Slide-out Audit Detail Drawer */}
      {selectedLog && (
        <AuditDetailDrawer
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
};

AdminAuditLogsPage.propTypes = {
  onNavigate: PropTypes.func,
};

export default AdminAuditLogsPage;
