import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  Sliders,
  X,
  Building2,
  Layers,
  Zap,
  Activity,
  Bot,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { useDebounce } from '../../../hooks/useDebounce';

const INITIAL_ALERTS = [
  {
    id: 'alt-01',
    title: 'Agent Mất Kết Nối Hàng Loạt (Mass Disconnect Warning)',
    detail: 'Phát hiện 3 tác tử eBPF tại cụm k8s viettel-k8s-hn-01 mất kết nối đồng thời trong 2 phút.',
    service: 'eBPF Ingestion',
    scope: 'org-viettel-04 (Viettel SME Cloud)',
    severity: 'CRITICAL',
    status: 'INVESTIGATING',
    timestamp: '14 phút trước',
  },
  {
    id: 'alt-02',
    title: 'Độ Trễ Nhịp Tim Tác Tử Vượt Ngưỡng (High Heartbeat Delay)',
    detail: 'Agent trên node finflow-k8s-master-01 có độ trễ phản hồi nhịp tim 8.4ms (ngưỡng: 5.0ms).',
    service: 'Telemetry Pipeline',
    scope: 'org-finflow-02 (FinFlow Pay Platform)',
    severity: 'HIGH',
    status: 'PENDING',
    timestamp: '28 phút trước',
  },
  {
    id: 'alt-03',
    title: 'Lỗi Xác Thực Token Tác Tử (Agent JWT Authentication Failure)',
    detail: 'Mã Token tác tử trên node vt-cloud-worker-03 đã hết hạn, yêu cầu xoay vòng token bảo mật.',
    service: 'Auth Gateway',
    scope: 'org-viettel-04 (Viettel SME Cloud)',
    severity: 'HIGH',
    status: 'INVESTIGATING',
    timestamp: '42 phút trước',
  },
  {
    id: 'alt-04',
    title: 'Tải Trọng AI Inference Tăng Đột Biến (AI Traffic Surge)',
    detail: 'Tần suất suy luận đạt đỉnh 1,840 req/s trên cụm acme-production-us-east. Độ trễ vẫn an toàn (1.4ms).',
    service: 'AI Backend (FastAPI)',
    scope: 'org-acme-01 (Acme Infrastructure Corp)',
    severity: 'MEDIUM',
    status: 'RESOLVED',
    timestamp: '1 giờ trước',
  },
];

const INITIAL_INCIDENTS = [
  {
    id: 'inc-9021',
    companyName: 'Acme Infrastructure Corp',
    companyId: 'org-acme-01',
    service: 'order-processing-service',
    cluster: 'acme-production-us-east',
    errorType: 'CrashLoopBackOff (OOM)',
    rootCause: 'Rò rỉ bộ nhớ Java Heap tại hàm checkoutOrder()',
    healingAction: 'Tự động mở rộng RAM lên 2Gi và khởi động lại Pod',
    healingStatus: 'RESOLVED',
    mttr: '42 giây',
    timestamp: '2 giờ trước',
  },
  {
    id: 'inc-9022',
    companyName: 'FinFlow Pay Platform',
    companyId: 'org-finflow-02',
    service: 'payment-gateway-proxy',
    cluster: 'finflow-prod-hcm',
    errorType: 'HTTP 504 Gateway Timeout',
    rootCause: 'Tắc nghẽn kết nối Database Pool tại Redis Cache',
    healingAction: 'Tự động thanh lọc Redis cache và cân bằng tải',
    healingStatus: 'RESOLVED',
    mttr: '1 phút 15 giây',
    timestamp: '3 giờ trước',
  },
  {
    id: 'inc-9023',
    companyName: 'Viettel SME Cloud',
    companyId: 'org-viettel-04',
    service: 'cloud-storage-node',
    cluster: 'viettel-k8s-hn-01',
    errorType: 'Agent Disconnect (Offline)',
    rootCause: 'Token hết hạn gây gián đoạn đường ống gRPC',
    healingAction: 'Chờ Quản Trị Viên phê duyệt xoay vòng Token (HITL)',
    healingStatus: 'PENDING_APPROVAL',
    mttr: 'Đang xử lý',
    timestamp: '14 phút trước',
  },
];

export const AdminAlertsPage = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState('alerts'); // 'alerts' | 'incidents'
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  const [incidents, setIncidents] = useState(INITIAL_INCIDENTS);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Modal Cấu hình ngưỡng cảnh báo
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [thresholds, setThresholds] = useState({
    massDisconnectCount: 5,
    aiLatencyLimitMs: 50,
    apiErrorRatePercent: 2.0,
    dbMemoryThreshold: 85,
  });

  const debouncedSearch = useDebounce(search, 250);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      const matchSearch =
        !debouncedSearch ||
        a.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        a.detail.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        a.scope.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        a.service.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchSeverity = severityFilter === 'ALL' || a.severity === severityFilter;
      const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;
      return matchSearch && matchSeverity && matchStatus;
    });
  }, [alerts, debouncedSearch, severityFilter, statusFilter]);

  const handleUpdateAlertStatus = (alertId, newStatus) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, status: newStatus } : a))
    );
    showToast(`Đã chuyển trạng thái cảnh báo sang: ${newStatus}!`);
  };

  const handleSaveThresholds = (e) => {
    e.preventDefault();
    setIsThresholdModalOpen(false);
    showToast('Đã lưu cấu hình ngưỡng cảnh báo nền tảng thành công!');
  };

  return (
    <div
      className="admin-alerts-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '1440px',
        margin: '0 auto',
        paddingBottom: '48px',
      }}
    >
      {/* 1. Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
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
            <AlertTriangle size={26} style={{ color: '#DC2626' }} />
            Quản Lý Cảnh Báo & Sự Cố Hệ Thống (Incidents & Alerts)
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0 }}>
            Giám sát cảnh báo hạ tầng cốt lõi, phát hiện tác tử đứt kết nối diện rộng và tổng hợp sự cố tự phục hồi của mọi công ty.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setIsThresholdModalOpen(true)}
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
            <Sliders size={14} />
            <span>Cấu Hình Ngưỡng Cảnh Báo</span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            fontSize: '0.8125rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} color="#059669" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 2. Mass Disconnect Warning Banner */}
      <div
        style={{
          padding: '16px 20px',
          borderRadius: '12px',
          backgroundColor: '#FEF2F2',
          border: '1px solid #FECACA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#991B1B' }}>
              Cảnh Báo Tác Tử Mất Kết Nối Cụm (Mass Disconnect Detection)
            </div>
            <div style={{ fontSize: '0.75rem', color: '#7F1D1D', marginTop: '2px' }}>
              Cụm <strong>viettel-k8s-hn-01</strong> ghi nhận 3 tác tử chuyển trạng thái Offline do Token hết hạn. Vui lòng xoay vòng Token tại trang Quản lý Agent.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (onNavigate) onNavigate('/admin/agents');
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 14px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: '#DC2626',
            color: '#FFFFFF',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <span>Đến Quản Lý Agent</span>
          <ArrowUpRight size={13} />
        </button>
      </div>

      {/* 3. Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--dash-border)', paddingBottom: '2px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('alerts')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            borderBottom: activeTab === 'alerts' ? '2px solid #059669' : '2px solid transparent',
            backgroundColor: activeTab === 'alerts' ? '#ECFDF5' : 'transparent',
            color: activeTab === 'alerts' ? '#065F46' : 'var(--dash-text-muted)',
            fontWeight: 700,
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={16} />
          <span>Cảnh Báo Nền Tảng ({alerts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('incidents')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            borderBottom: activeTab === 'incidents' ? '2px solid #059669' : '2px solid transparent',
            backgroundColor: activeTab === 'incidents' ? '#ECFDF5' : 'transparent',
            color: activeTab === 'incidents' ? '#065F46' : 'var(--dash-text-muted)',
            fontWeight: 700,
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Building2 size={16} />
          <span>Tổng Hợp Sự Cố Doanh Nghiệp & RCA ({incidents.length})</span>
        </button>
      </div>

      {/* 4. Tab 1: Platform Alerts */}
      {activeTab === 'alerts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filters Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              backgroundColor: '#FFFFFF',
              padding: '14px 18px',
              borderRadius: '12px',
              border: '1px solid var(--dash-border)',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
              <div style={{ position: 'relative', minWidth: '260px' }}>
                <Search size={14} color="var(--dash-text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Tìm theo tiêu đề, phạm vi, dịch vụ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 12px 6px 30px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.8125rem',
                    backgroundColor: '#F8FAFC',
                    color: 'var(--dash-text-primary)',
                  }}
                />
              </div>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--dash-text-primary)',
                  fontWeight: 600,
                }}
              >
                <option value="ALL">Mọi Mức Độ</option>
                <option value="CRITICAL">Nghiêm Trọng (Critical)</option>
                <option value="HIGH">Cao (High)</option>
                <option value="MEDIUM">Trung Bình (Medium)</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--dash-text-primary)',
                  fontWeight: 600,
                }}
              >
                <option value="ALL">Mọi Trạng Thái</option>
                <option value="PENDING">Chờ Xử Lý (Pending)</option>
                <option value="INVESTIGATING">Đang Điều Tra</option>
                <option value="RESOLVED">Đã Giải Quyết</option>
              </select>
            </div>
          </div>

          {/* Alerts Table */}
          <div
            style={{
              border: '1px solid var(--dash-border)',
              borderRadius: '14px',
              overflowX: 'auto',
              backgroundColor: '#FFFFFF',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Tiêu Đề Cảnh Báo & Chi Tiết</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Dịch Vụ & Phạm Vi</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Mức Độ</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Trạng Thái</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Thời Gian</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map((alt) => (
                  <tr key={alt.id} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                    <td style={{ padding: '14px 16px', maxWidth: '380px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{alt.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', marginTop: '2px' }}>{alt.detail}</div>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>{alt.service}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>{alt.scope}</div>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          fontSize: '0.6875rem',
                          backgroundColor: alt.severity === 'CRITICAL' ? '#FEF2F2' : alt.severity === 'HIGH' ? '#FFFBEB' : '#EFF6FF',
                          color: alt.severity === 'CRITICAL' ? '#DC2626' : alt.severity === 'HIGH' ? '#D97706' : '#2563EB',
                          border: alt.severity === 'CRITICAL' ? '1px solid #FECACA' : alt.severity === 'HIGH' ? '1px solid #FDE68A' : '1px solid #BFDBFE',
                        }}
                      >
                        {alt.severity}
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          backgroundColor: alt.status === 'RESOLVED' ? '#ECFDF5' : alt.status === 'INVESTIGATING' ? '#FFFBEB' : '#F1F5F9',
                          color: alt.status === 'RESOLVED' ? '#065F46' : alt.status === 'INVESTIGATING' ? '#92400E' : '#475569',
                        }}
                      >
                        {alt.status}
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px', color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>
                      {alt.timestamp}
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      {alt.status !== 'RESOLVED' ? (
                        <button
                          type="button"
                          onClick={() => handleUpdateAlertStatus(alt.id, 'RESOLVED')}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid #BBF7D0',
                            backgroundColor: '#F0FDF4',
                            color: '#15803D',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Đánh Dấu Giải Quyết
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 600 }}>Hoàn tất</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Tab 2: Company Incidents Overview */}
      {activeTab === 'incidents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              border: '1px solid var(--dash-border)',
              borderRadius: '14px',
              overflowX: 'auto',
              backgroundColor: '#FFFFFF',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Mã Sự Cố & Công Ty</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Vi Dịch Vụ & Cụm</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Loại Lỗi Phát Hiện</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Nguyên Nhân Gốc (RCA)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Kết Quả Tự Lành (Self-Healing)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>MTTR</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => (
                  <tr key={inc.id} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{inc.companyName}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>{inc.id}</div>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>{inc.service}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>{inc.cluster}</div>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          backgroundColor: '#FFFBEB',
                          color: '#B45309',
                          border: '1px solid #FDE68A',
                        }}
                      >
                        {inc.errorType}
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px', maxWidth: '280px', color: 'var(--dash-text-secondary)', fontSize: '0.75rem' }}>
                      {inc.rootCause}
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: inc.healingStatus === 'RESOLVED' ? '#059669' : '#D97706' }}>
                        {inc.healingAction}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
                        Trạng thái: <strong>{inc.healingStatus}</strong>
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#059669' }}>
                      {inc.mttr}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Modal Cấu Hình Ngưỡng Cảnh Báo */}
      {isThresholdModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={20} color="#059669" />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
                  Cấu Hình Ngưỡng Cảnh Báo Cấp Nền Tảng
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsThresholdModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveThresholds} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  Ngưỡng Tác Tử Mất Kết Nối Đồng Thời (Nodes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={thresholds.massDisconnectCount}
                  onChange={(e) => setThresholds({ ...thresholds, massDisconnectCount: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.8125rem',
                  }}
                />
                <span style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                  Kích hoạt cảnh báo đỏ khi số lượng agent offline cùng lúc vượt ngưỡng này.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  Giới Hạn Độ Trễ Suy Luận AI Backend (ms)
                </label>
                <input
                  type="number"
                  min="5"
                  max="500"
                  value={thresholds.aiLatencyLimitMs}
                  onChange={(e) => setThresholds({ ...thresholds, aiLatencyLimitMs: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.8125rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '4px' }}>
                  Ngưỡng Tỷ Lệ Lỗi 5xx API Gateway (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10"
                  value={thresholds.apiErrorRatePercent}
                  onChange={(e) => setThresholds({ ...thresholds, apiErrorRatePercent: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.8125rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsThresholdModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    backgroundColor: '#FFFFFF',
                    color: 'var(--dash-text-primary)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#059669',
                    color: '#FFFFFF',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Lưu Cấu Hình
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAlertsPage;
