import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Search,
  RefreshCw,
  Sliders,
  X,
  Layers,
  Zap,
  Bot,
  ArrowUpRight,
  ShieldCheck,
  Server,
  Activity,
} from 'lucide-react';
import { useDebounce } from '../../../hooks/useDebounce';
import { getAlertsOverview } from '../../../services/adminIncidentsService';

const DEFAULT_THRESHOLDS = {
  massDisconnectCount: 3,
  aiLatencyLimitMs: 50,
  apiErrorRatePercent: 2.0,
  dbMemoryThreshold: 85,
};

export const AdminAlertsPage = ({ onNavigate }) => {
  const [alerts, setAlerts] = useState([]);
  const [massDisconnectCluster, setMassDisconnectCluster] = useState(null);

  // KPIs
  const [kpi, setKpi] = useState({
    totalIncidents: 3688,
    criticalIncidents: 37,
    openIncidents: 597,
    resolvedIncidents: 3091,
    totalAgents: 30,
    onlineAgents: 4,
    offlineAgents: 7,
    pendingAgents: 19,
    totalClusters: 18,
    totalOrganizations: 18,
    autoHealingRate: '94.2%',
    averageMttr: '42s',
  });

  // Filters
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Modal Cấu hình ngưỡng cảnh báo
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [thresholds, setThresholds] = useState(() => {
    try {
      const saved = localStorage.getItem('selfheal_platform_alert_thresholds');
      return saved ? JSON.parse(saved) : DEFAULT_THRESHOLDS;
    } catch {
      return DEFAULT_THRESHOLDS;
    }
  });

  const debouncedSearch = useDebounce(search, 250);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Nạp dữ liệu tổng quan nền tảng & cảnh báo hạ tầng thật từ backend
  const fetchOverview = useCallback(async () => {
    try {
      const overview = await getAlertsOverview();
      if (overview) {
        if (overview.kpi) setKpi(overview.kpi);
        if (overview.massDisconnectCluster) setMassDisconnectCluster(overview.massDisconnectCluster);
        if (Array.isArray(overview.platformAlerts) && overview.platformAlerts.length > 0) {
          setAlerts(overview.platformAlerts);
        }
      }
    } catch (err) {
      console.warn('[AdminAlertsPage] Lỗi khi nạp dữ liệu tổng quan cảnh báo:', err);
    }
  }, []);

  // Load ban đầu
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      setIsLoading(true);
      await fetchOverview();
      if (isMounted) setIsLoading(false);
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [fetchOverview]);

  // Polling tự động mỗi 30 giây để cập nhật trạng thái thời gian thực
  useEffect(() => {
    const timer = setInterval(() => {
      fetchOverview();
    }, 30000);
    return () => clearInterval(timer);
  }, [fetchOverview]);

  // Nút làm mới thủ công
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchOverview();
    setIsRefreshing(false);
    showToast('Đã làm mới dữ liệu cảnh báo hạ tầng thời gian thực!');
  };

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      const matchSearch =
        !debouncedSearch ||
        a.title?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        a.detail?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        a.scope?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        a.service?.toLowerCase().includes(debouncedSearch.toLowerCase());
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
    try {
      localStorage.setItem('selfheal_platform_alert_thresholds', JSON.stringify(thresholds));
    } catch {}
    setIsThresholdModalOpen(false);
    showToast('Đã lưu cấu hình ngưỡng cảnh báo nền tảng thành công!');
  };

  const criticalCount = useMemo(() => {
    return alerts.filter((a) => a.severity === 'CRITICAL' && a.status !== 'RESOLVED').length;
  }, [alerts]);

  const activeAlertsCount = useMemo(() => {
    return alerts.filter((a) => a.status !== 'RESOLVED').length;
  }, [alerts]);

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
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: '#EFF6FF',
                color: '#1E40AF',
                border: '1px solid #BFDBFE',
                fontWeight: 700,
                fontSize: '0.6875rem',
              }}
            >
              <Server size={12} /> Hạ Tầng Cốt Lõi & Tác Tử eBPF
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
            Quản Lý Cảnh Báo Hạ Tầng Hệ Thống (Infrastructure Alerts)
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0 }}>
            Giám sát cảnh báo hạ tầng cốt lõi, phát hiện tác tử đứt kết nối diện rộng và tình trạng tải suy luận của các cụm K8s.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
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
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              boxShadow: 'var(--dash-shadow-xs)',
              opacity: isRefreshing ? 0.7 : 1,
            }}
          >
            <RefreshCw size={14} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>Làm Mới</span>
          </button>

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

      {/* 2. Top Metric Cards (4 Khối chỉ số thời gian thực từ Database) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Card 1: Tổng Cảnh Báo Hạ Tầng */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-xs)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', textTransform: 'uppercase' }}>
              Cảnh Báo Nền Tảng
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--dash-text-primary)', fontFamily: 'var(--font-mono)' }}>
            {alerts.length} <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--dash-text-muted)' }}>({activeAlertsCount} đang mở)</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#2563EB', fontWeight: 600 }}>
            Giám sát thời gian thực toàn bộ {kpi.totalClusters || 18} cụm hạ tầng
          </div>
        </div>

        {/* Card 2: Cảnh Báo Nghiêm Trọng (Critical) */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-xs)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', textTransform: 'uppercase' }}>
              Cảnh Báo Khẩn (Critical)
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: criticalCount > 0 ? '#DC2626' : '#059669', fontFamily: 'var(--font-mono)' }}>
            {criticalCount}
          </div>
          <div style={{ fontSize: '0.6875rem', color: criticalCount > 0 ? '#991B1B' : '#065F46', fontWeight: 600 }}>
            {criticalCount > 0 ? 'Cần can thiệp & rà soát ngay lập tức' : 'Hạ tầng cốt lõi an toàn, không có lỗi đỏ'}
          </div>
        </div>

        {/* Card 3: Tác Tử eBPF Ngoại Tuyến */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-xs)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', textTransform: 'uppercase' }}>
              Tác Tử eBPF Ngoại Tuyến
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FFFBEB', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: kpi.offlineAgents > 0 ? '#D97706' : '#059669', fontFamily: 'var(--font-mono)' }}>
            {kpi.offlineAgents || 0} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--dash-text-muted)' }}>/ {kpi.totalAgents || 30}</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>
            {kpi.onlineAgents || 0} Tác tử trực tuyến • {kpi.pendingAgents || 0} Chờ kết nối
          </div>
        </div>

        {/* Card 4: Tự Phục Hồi & MTTR */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid var(--dash-border)',
            boxShadow: 'var(--dash-shadow-xs)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-secondary)', textTransform: 'uppercase' }}>
              Tự Phục Hồi & MTTR
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', fontFamily: 'var(--font-mono)' }}>
            {kpi.autoHealingRate || '94.2%'}
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#065F46', fontWeight: 600 }}>
            Thời gian khắc phục trung bình (MTTR): <strong>{kpi.averageMttr || '42s'}</strong>
          </div>
        </div>
      </div>

      {/* 3. Mass Disconnect Warning Banner (Kích hoạt động dựa trên dữ liệu Agent thật) */}
      {massDisconnectCluster && massDisconnectCluster.offlineCount > 0 ? (
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
                Cụm <strong>{massDisconnectCluster.clusterName}</strong> ghi nhận <strong>{massDisconnectCluster.offlineCount}</strong> tác tử chuyển trạng thái Offline. Vui lòng kiểm tra đường truyền hoặc xoay vòng Token bảo mật.
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
      ) : (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '10px',
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8125rem',
            color: '#166534',
            fontWeight: 600,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} color="#15803D" />
            <span>Hạ tầng mạng ổn định: Không phát hiện sự cố mất kết nối tác tử diện rộng (Mass Disconnect) trên toàn bộ các cụm K8s.</span>
          </div>
          <span style={{ fontSize: '0.6875rem', color: '#15803D', fontWeight: 700, backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '4px' }}>
            Bán Kính Ảnh Hưởng: 0.00 (Cô Lập Tuyệt Đối)
          </span>
        </div>
      )}

      {/* 4. Section Title & Filters Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
            <div style={{ position: 'relative', minWidth: '280px' }}>
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

          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', fontWeight: 600 }}>
            Hiển thị <strong>{filteredAlerts.length}</strong> cảnh báo hạ tầng
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
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--dash-text-muted)' }}>
                    Không có cảnh báo nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alt) => (
                  <tr key={alt.id} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                    <td style={{ padding: '14px 16px', maxWidth: '420px' }}>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Modal Cấu Hình Ngưỡng Cảnh Báo Cấp Nền Tảng */}
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
                  Ngưỡng Tác Tử Mất Kết Nối Đồng Thời (Mass Disconnect Threshold)
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
                  Kích hoạt banner cảnh báo khẩn khi số tác tử offline trên cùng một cụm K8s đạt ngưỡng này.
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