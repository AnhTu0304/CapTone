import React, { useState, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import RootCauseModal from './RootCauseModal';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  GitBranch
} from 'lucide-react';

const INITIAL_INCIDENTS = [
  {
    id: 'INC-2026-081',
    title: 'Pod payment-service bị OOMKilled do rò rỉ bộ nhớ queue',
    service: 'payment-service',
    namespace: 'production',
    severity: 'CRITICAL',
    status: 'Đang tự phục hồi',
    time: '6 phút trước',
    impact: 'HTTP 500 tăng 4.2% trên checkout',
    rootCause: 'Rò rỉ bộ nhớ (Memory leak) trong buffer xử lý giao dịch khiến RAM vượt ngưỡng 2048MiB kích hoạt OOM-Killer.',
    mttr: 'Đang chạy (1.2s)',
  },
  {
    id: 'INC-2026-079',
    title: 'Quá tải CPU trên worker-03 do xung đột 3 cron jobs',
    service: 'worker-03',
    namespace: 'cluster-wide',
    severity: 'MAJOR',
    status: 'Chờ phê duyệt HITL',
    time: '18 phút trước',
    impact: 'Độ trễ kubelet tăng lên 450ms',
    rootCause: '3 batch jobs chạy đồng thời trên cùng node vật lý, cần tháo tải máy chủ (Drain node).',
    mttr: 'Chờ duyệt',
  },
  {
    id: 'INC-2026-075',
    title: 'Liveness Probe timeout trên order-processor',
    service: 'order-processor',
    namespace: 'production',
    severity: 'MINOR',
    status: 'Đã khắc phục hoàn tất',
    time: '3 giờ trước',
    impact: 'Không ảnh hưởng người dùng cuối',
    rootCause: 'Khóa tạm thời bảng cơ sở dữ liệu khi chạy sao lưu tự động.',
    mttr: '1.4 giây (Tự phục hồi)',
  },
  {
    id: 'INC-2026-068',
    title: 'Tái truyền gói tin TCP đột biến trên ingress-nginx',
    service: 'ingress-nginx',
    namespace: 'ingress-nginx',
    severity: 'MINOR',
    status: 'Đã khắc phục hoàn tất',
    time: '1 ngày trước',
    impact: 'Độ trễ P99 tăng thêm 14ms',
    rootCause: 'Nghẽn băng thông mạng tạm thời tại cổng NAT Gateway.',
    mttr: '2.8 giây (Tự phục hồi)',
  },
];

export const IncidentsPage = ({ initialRcaOpen = false }) => {
  const { currentOrg, currentEnv, isRefreshing, triggerRefresh } = useDashboard();
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [incidents, setIncidents] = useState(INITIAL_INCIDENTS);
  const [activeModalIncident, setActiveModalIncident] = useState(initialRcaOpen ? INITIAL_INCIDENTS[0] : null);

  const handleResolveIncident = (id) => {
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === id ? { ...inc, status: 'Đã khắc phục hoàn tất', mttr: '1.8 giây (Tự phục hồi)' } : inc
      )
    );
  };

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const matchSeverity = selectedSeverity === 'all' || inc.severity === selectedSeverity;
      const matchStatus = selectedStatus === 'all' || inc.status === selectedStatus;
      const matchSearch =
        !searchQuery ||
        inc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.service.toLowerCase().includes(searchQuery.toLowerCase());

      return matchSeverity && matchStatus && matchSearch;
    });
  }, [incidents, selectedSeverity, selectedStatus, searchQuery]);

  return (
    <div className="dashboard-incidents-page" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Quản Lý Sự Cố & Phân Tích Nguyên Nhân Gốc Rễ (RCA)
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            {currentOrg.name} &bull; <span style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv.name}</span> &bull; Tự động phân loại mức độ và suy diễn cây nguyên nhân nhân quả
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={triggerRefresh}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: 'var(--dash-radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Làm mới danh sách</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="dash-card"
        style={{
          padding: '14px 18px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          {/* Severity Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Mức độ:</span>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              style={{
                height: '32px',
                padding: '0 8px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-sm)',
                backgroundColor: '#FFFFFF',
              }}
            >
              <option value="all">Tất cả mức độ</option>
              <option value="CRITICAL">CRITICAL (Nguy cấp)</option>
              <option value="MAJOR">MAJOR (Nghiêm trọng)</option>
              <option value="MINOR">MINOR (Nhẹ)</option>
            </select>
          </div>

          {/* Status Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Trạng thái:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                height: '32px',
                padding: '0 8px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-sm)',
                backgroundColor: '#FFFFFF',
              }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="Đang tự phục hồi">Đang tự phục hồi</option>
              <option value="Chờ phê duyệt HITL">Chờ phê duyệt HITL</option>
              <option value="Đã khắc phục hoàn tất">Đã khắc phục hoàn tất</option>
            </select>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Tìm kiếm sự cố theo mã, dịch vụ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                height: '32px',
                width: '240px',
                padding: '0 10px 0 28px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: 'var(--dash-radius-sm)',
                outline: 'none',
              }}
            />
            <Search size={14} style={{ position: 'absolute', left: '8px', top: '9px', color: 'var(--dash-text-muted)' }} />
          </div>
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
          Tổng cộng <strong>{filteredIncidents.length}</strong> sự cố ghi nhận
        </div>
      </div>

      {/* Incidents Table */}
      <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)', width: '120px' }}>MÃ SỰ CỐ</th>
              <th style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)', width: '110px' }}>MỨC ĐỘ</th>
              <th style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)', width: '160px' }}>DỊCH VỤ / NODE</th>
              <th style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)' }}>TIÊU ĐỀ & NGUYÊN NHÂN TỔNG QUAN</th>
              <th style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)', width: '140px' }}>TRẠNG THÁI</th>
              <th style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)', width: '120px' }}>THỜI ĐIỂM</th>
              <th style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--dash-text-secondary)', width: '130px', textAlign: 'right' }}>THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            {filteredIncidents.map((item) => {
              const isCrit = item.severity === 'CRITICAL';
              const isMaj = item.severity === 'MAJOR';

              return (
                <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                    {item.id}
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        backgroundColor: isCrit ? '#FFF1F2' : isMaj ? '#FFFBEB' : '#EFF6FF',
                        color: isCrit ? '#E11D48' : isMaj ? '#D97706' : '#2563EB',
                        border: `1px solid ${isCrit ? '#FDA4AF' : isMaj ? '#FDE68A' : '#BFDBFE'}`,
                      }}
                    >
                      {item.severity}
                    </span>
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--dash-primary)' }}>
                      {item.service}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      ns: {item.namespace}
                    </div>
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '2px' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                      {item.impact} &bull; <span style={{ color: 'var(--dash-text-muted)' }}>{item.mttr}</span>
                    </div>
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: item.status.includes('hoàn tất')
                          ? '#059669'
                          : item.status.includes('phê duyệt')
                          ? '#D97706'
                          : '#2563EB',
                      }}
                    >
                      {item.status.includes('hoàn tất') ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                      <span>{item.status}</span>
                    </span>
                  </td>

                  <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
                    {item.time}
                  </td>

                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => setActiveModalIncident(item)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 10px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid var(--dash-border)',
                        color: 'var(--dash-primary)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: 'var(--dash-shadow-xs)',
                      }}
                    >
                      <GitBranch size={13} />
                      <span>Xem RCA</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* RCA Modal */}
      {activeModalIncident && (
        <RootCauseModal
          incident={activeModalIncident}
          onClose={() => setActiveModalIncident(null)}
          onResolve={handleResolveIncident}
        />
      )}
    </div>
  );
};

export default IncidentsPage;
