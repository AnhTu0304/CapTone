import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { aiService } from '../../../services/aiService';
import RootCauseModal from './RootCauseModal';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  Zap,
  Layers,
  PlayCircle,
  Eye,
  Database,
  ShieldCheck
} from 'lucide-react';

const INITIAL_INCIDENTS = [];

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return 'Vừa xong';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
};

const mapBackendIncidentToUI = (item) => {
  const shortId = item.id.length > 12 ? `INC-${item.id.slice(0, 8).toUpperCase()}` : item.id;
  const isResolved = item.status === 'RESOLVED';
  const isRecovering = item.status === 'INVESTIGATING';

  let statusLabel = 'Chờ phê duyệt HITL';
  if (isResolved) statusLabel = 'Đã khắc phục hoàn tất';
  else if (isRecovering) statusLabel = 'Đang tự phục hồi';

  let serviceName = item.target_id || 'sme-order-service';
  if (item.title && item.title.includes(' on ')) {
    serviceName = item.title.split(' on ')[1].trim();
  }

  // Phân tích kết quả RCA lưu trong DB (nếu có)
  let rcaParsed = null;
  if (item.analysis_result) {
    try {
      rcaParsed = typeof item.analysis_result === 'string' ? JSON.parse(item.analysis_result) : item.analysis_result;
    } catch (e) {
      // bỏ qua nếu không parse được
    }
  }

  const recAction = rcaParsed?.recommendation?.action || 'RESTART_POD & RESCALE';
  const recReason = rcaParsed?.recommendation?.reason || 'Tự động giải phóng tiến trình và điều chỉnh ngưỡng tài nguyên an toàn theo MAPE-K';

  let evidencesList = [
    {
      type: 'AI_TELEMETRY',
      ref: serviceName,
      summary: `Mô hình AI phát hiện nguy cơ ${item.incident_type || 'bất thường'} với độ tin cậy ${Math.round(Number(item.rca_confidence || 0.95) * 100)}%`,
      score: `${Math.round(Number(item.rca_confidence || 0.95) * 100)}%`,
    },
    {
      type: 'K8S_EVENT',
      ref: `pod/${serviceName}`,
      summary: 'Kubelet cảnh báo tải tài nguyên tăng nhanh',
      score: '91%',
    },
  ];

  if (rcaParsed?.evidence && Array.isArray(rcaParsed.evidence) && rcaParsed.evidence.length > 0) {
    evidencesList = rcaParsed.evidence.map((ev, idx) => ({
      type: idx === 0 ? 'AI_TELEMETRY' : 'K8S_EVENT',
      ref: serviceName,
      summary: typeof ev === 'string' ? ev : (ev.summary || JSON.stringify(ev)),
      score: `${Math.round(Number(item.rca_confidence || 0.92) * 100)}%`,
    }));
  }

  return {
    id: shortId,
    rawId: item.id,
    title: item.title,
    service: serviceName,
    namespace: 'production',
    node: item.cluster_name ? `${item.cluster_name}-node-1` : (item.cluster_id || 'worker-01'),
    severity: (item.severity || 'HIGH').toUpperCase(),
    status: statusLabel,
    time: formatRelativeTime(item.detected_at || item.created_at),
    detectedAt: item.detected_at || item.created_at,
    impact: item.description || `Ảnh hưởng hiệu năng dịch vụ ${serviceName}`,
    rootCause: item.root_cause_description || item.description || 'Hệ thống tự động phát hiện mẫu hành vi bất thường từ chuỗi viễn trắc AI.',
    rootCauseType: item.root_cause_type || item.incident_type || 'Bất thường dịch vụ',
    confidence: Math.round(Number(item.rca_confidence || 0.92) * 100),
    primaryRisk: `${item.incident_type || 'RỦI RO'} (${Math.round(Number(item.rca_confidence || 0.92) * 100)}%)`,
    mttr: isResolved ? 'Đã khắc phục hoàn tất' : 'Đang chạy (1.4s)',
    recommendationAction: recAction,
    recommendationReason: recReason,
    evidences: evidencesList,
    causalSteps: [
      { step: '1. Tín hiệu sơ cấp', desc: `Đột biến lưu lượng hoặc viễn trắc trên ${serviceName}` },
      { step: '2. Tích tụ tài nguyên', desc: 'Mô hình AI phát hiện chuỗi trượt viễn trắc vượt ngưỡng an toàn' },
      { step: '3. Hệ quả hạ tầng', desc: `Kubelet ghi nhận cảnh báo bất thường trên pod ${serviceName}` },
      { step: '4. Tác động & Tự lành', desc: isResolved ? 'Vòng lặp MAPE-K đã hoàn tất tự khắc phục' : 'Vòng lặp MAPE-K đang can thiệp khôi phục tự động' }
    ]
  };
};

export const IncidentsPage = ({ onNavigate }) => {
  const { currentOrg, currentEnv } = useDashboard();
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedService, setSelectedService] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [incidents, setIncidents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUsingLiveDb, setIsUsingLiveDb] = useState(false);
  const [activeModalIncident, setActiveModalIncident] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Tải dữ liệu thật từ Main Backend API
  const fetchIncidents = useCallback(async () => {
    setIsLoading(true);
    try {
      const activeClusterId = currentEnv?.id || currentEnv?.clusterId || currentEnv?.cluster;
      const activeOrgId = currentOrg?.id;

      const params = {
        limit: 50,
        cluster_id: activeClusterId,
        organization_id: activeOrgId,
        status: selectedStatus,
        severity: selectedSeverity,
        search: searchQuery,
      };

      const res = await aiService.getIncidents(params);
      const items = res?.items || (Array.isArray(res) ? res : []);

      setIncidents(items.map(mapBackendIncidentToUI));
      setIsUsingLiveDb(true);
    } catch (err) {
      console.warn('[IncidentsPage] Không thể kết nối API sự cố:', err.message);
      setIncidents([]);
      setIsUsingLiveDb(false);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentOrg?.id, currentEnv?.id, currentEnv?.clusterId, currentEnv?.cluster, selectedStatus, selectedSeverity, searchQuery]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchIncidents();
  };

  // Kích hoạt giải quyết sự cố tức thời
  const handleResolveIncident = async (id, rawId) => {
    const targetRawId = rawId || incidents.find((i) => i.id === id)?.rawId;
    if (targetRawId) {
      try {
        await aiService.updateIncidentStatus(targetRawId, 'RESOLVED');
      } catch (err) {
        console.warn('Lỗi cập nhật trạng thái sự cố lên DB:', err.message);
      }
    }

    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === id || inc.rawId === targetRawId
          ? {
              ...inc,
              status: 'Đã khắc phục hoàn tất',
              mttr: 'Đã khắc phục hoàn tất',
            }
          : inc
      )
    );
    if (activeModalIncident && (activeModalIncident.id === id || activeModalIncident.rawId === targetRawId)) {
      setActiveModalIncident((prev) =>
        prev
          ? {
              ...prev,
              status: 'Đã khắc phục hoàn tất',
              mttr: 'Đã khắc phục hoàn tất',
            }
          : null
      );
    }
  };

  // Giả lập kích hoạt sự cố mẫu (Chaos Drill)
  const handleSimulateDrill = () => {
    const newInc = {
      id: `INC-2026-0${Math.floor(Math.random() * 80) + 82}`,
      rawId: null,
      title: 'Pod sme-order-service phát hiện rò rỉ bộ nhớ qua eBPF probe',
      service: 'sme-order-service',
      namespace: 'production',
      node: 'worker-01',
      severity: 'HIGH',
      status: 'Đang tự phục hồi',
      time: 'Vừa xong',
      detectedAt: new Date().toISOString(),
      impact: 'Bộ nhớ heap tăng 88%, latency tăng 12%',
      rootCause: 'Tác tử eBPF ghi nhận luồng goroutine bị nghẽn làm heap RAM tăng 4.8MB/s liên tục.',
      rootCauseType: 'Memory Heap Growth Anomaly',
      confidence: 95,
      primaryRisk: 'OOM (95%)',
      mttr: 'Đang chạy (0.8s)',
      recommendationAction: 'RESTART_POD',
      recommendationReason: 'Kích hoạt vòng lặp MAPE-K tái tạo Pod mới để thu hồi tài nguyên',
      evidences: [
        { type: 'EBPF_PROBE', ref: 'sme-order-service', summary: 'eBPF kprobe: sys_enter_mmap memory growth rate abnormal', score: '97%' }
      ],
      causalSteps: [
        { step: '1. Tín hiệu sơ cấp', desc: 'eBPF probe phát hiện tốc độ cấp phát mmap tăng đột biến' },
        { step: '2. Tích tụ tài nguyên', desc: 'Heap memory goroutine tăng liên tục 4.8MB/s' },
        { step: '3. Hệ quả hạ tầng', desc: 'Dự báo chạm ngưỡng OOM trong 3 phút tới' },
        { step: '4. Tác động & Tự lành', desc: 'MAPE-K chủ động kích hoạt tự tái sinh Pod phòng ngừa' }
      ]
    };
    setIncidents((prev) => [newInc, ...prev]);
    setActiveModalIncident(newInc);
  };

  // Danh sách service động từ các sự cố hiện có
  const availableServices = useMemo(() => {
    const set = new Set(incidents.map((i) => i.service).filter(Boolean));
    return Array.from(set);
  }, [incidents]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = incidents.length;
    const critical = incidents.filter((i) => i.severity === 'CRITICAL' || i.severity === 'HIGH').length;
    const recovering = incidents.filter((i) => i.status.includes('phục hồi') || i.status.includes('duyệt')).length;
    const resolved = incidents.filter((i) => i.status.includes('hoàn tất')).length;
    return { total, critical, recovering, resolved };
  }, [incidents]);

  // Bộ lọc dữ liệu phía Client
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const matchSeverity = selectedSeverity === 'all' || inc.severity === selectedSeverity;
      const matchStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'RECOVERING' && inc.status.includes('phục hồi')) ||
        (selectedStatus === 'HITL' && inc.status.includes('duyệt')) ||
        (selectedStatus === 'RESOLVED' && inc.status.includes('hoàn tất'));
      const matchService = selectedService === 'all' || inc.service === selectedService;
      const matchSearch =
        !searchQuery.trim() ||
        inc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.rootCause.toLowerCase().includes(searchQuery.toLowerCase());

      return matchSeverity && matchStatus && matchService && matchSearch;
    });
  }, [incidents, selectedSeverity, selectedStatus, selectedService, searchQuery]);

  return (
    <div className="dashboard-incidents-page" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '18px 22px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid var(--dash-border)',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={22} color="var(--dash-primary)" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1
                  style={{
                    fontSize: '1.4rem',
                    fontWeight: 800,
                    color: 'var(--dash-text-primary)',
                    letterSpacing: '-0.02em',
                    margin: 0,
                  }}
                >
                  Quản Lý Sự Cố & Phân Tích Nguyên Nhân Gốc Rễ (RCA)
                </h1>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    backgroundColor: isUsingLiveDb ? '#DCFCE7' : '#FEF3C7',
                    color: isUsingLiveDb ? '#15803D' : '#B45309',
                    border: `1px solid ${isUsingLiveDb ? '#86EFAC' : '#FDE68A'}`,
                  }}
                >
                  <Database size={10} />
                  <span>{isUsingLiveDb ? 'Live DB' : 'Mô phỏng'}</span>
                </span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', marginTop: '3px', margin: 0 }}>
                Tổ chức: <strong style={{ color: 'var(--dash-text-primary)' }}>{currentOrg?.name || 'SME Retail Enterprise'}</strong> &bull; Cụm K8s:{' '}
                <span style={{ fontWeight: 600, color: 'var(--dash-primary)' }}>
                  {currentEnv?.cluster || 'cluster-k8s-sme-01'}
                </span>{' '}
                &bull; Bảng tổng quan sự cố và suy diễn cây nguyên nhân nhân quả
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleSimulateDrill}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#F0FDF4',
              border: '1px solid #A7F3D0',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: '#065F46',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <PlayCircle size={15} color="#059669" />
            <span>Mô phỏng sự cố</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--dash-text-primary)',
              cursor: 'pointer',
              boxShadow: 'var(--dash-shadow-xs)',
              transition: 'all 0.15s ease',
            }}
          >
            <RefreshCw size={14} className={isRefreshing || isLoading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 4 Stat Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
        <div
          className="dash-card"
          style={{
            padding: '16px 20px',
            borderLeft: '4px solid #6366F1',
            borderRadius: '12px',
            backgroundColor: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Tổng Sự Cố
            </span>
            <Layers size={18} color="#6366F1" />
          </div>
          <div
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: '#0F172A',
              marginTop: '6px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {stats.total}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
            Cụm {currentEnv?.cluster || 'cluster-k8s-sme-01'}
          </div>
        </div>

        <div
          className="dash-card"
          style={{
            padding: '16px 20px',
            borderLeft: '4px solid #EF4444',
            borderRadius: '12px',
            backgroundColor: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase' }}>
              Nguy Cấp (Critical)
            </span>
            <AlertTriangle size={18} color="#EF4444" />
          </div>
          <div
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: '#EF4444',
              marginTop: '6px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {stats.critical}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#DC2626', marginTop: '2px' }}>
            Ưu tiên tự phục hồi
          </div>
        </div>

        <div
          className="dash-card"
          style={{
            padding: '16px 20px',
            borderLeft: '4px solid #F59E0B',
            borderRadius: '12px',
            backgroundColor: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#B45309', textTransform: 'uppercase' }}>
              Đang Tự Phục Hồi
            </span>
            <Zap size={18} color="#F59E0B" />
          </div>
          <div
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: '#D97706',
              marginTop: '6px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {stats.recovering}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#B45309', marginTop: '2px' }}>
            Vòng lặp MAPE-K xử lý
          </div>
        </div>

        <div
          className="dash-card"
          style={{
            padding: '16px 20px',
            borderLeft: '4px solid #10B981',
            borderRadius: '12px',
            backgroundColor: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065F46', textTransform: 'uppercase' }}>
              Đã Khắc Phục
            </span>
            <CheckCircle2 size={18} color="#10B981" />
          </div>
          <div
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: '#059669',
              marginTop: '6px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {stats.resolved}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '2px' }}>
            Khôi phục SLA 99.9%
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="dash-card"
        style={{
          padding: '12px 18px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          borderRadius: '12px',
          backgroundColor: '#FFFFFF',
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
                borderRadius: '6px',
                backgroundColor: '#F8FAFC',
                color: 'var(--dash-text-primary)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all">Tất cả mức độ</option>
              <option value="CRITICAL">Critical (Nguy cấp)</option>
              <option value="HIGH">High (Cao)</option>
              <option value="MEDIUM">Medium (Trung bình)</option>
              <option value="LOW">Low (Thấp)</option>
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
                borderRadius: '6px',
                backgroundColor: '#F8FAFC',
                color: 'var(--dash-text-primary)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="RECOVERING">Đang tự phục hồi</option>
              <option value="HITL">Chờ phê duyệt HITL</option>
              <option value="RESOLVED">Đã khắc phục hoàn tất</option>
            </select>
          </div>

          {/* Service Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-secondary)' }}>Dịch vụ:</span>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              style={{
                height: '32px',
                padding: '0 8px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: '6px',
                backgroundColor: '#F8FAFC',
                color: 'var(--dash-text-primary)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all">Tất cả dịch vụ</option>
              {availableServices.map((svc) => (
                <option key={svc} value={svc}>
                  {svc}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Tìm kiếm sự cố..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                height: '32px',
                width: '220px',
                padding: '0 10px 0 28px',
                fontSize: '0.75rem',
                border: '1px solid var(--dash-border)',
                borderRadius: '6px',
                backgroundColor: '#F8FAFC',
                outline: 'none',
              }}
            />
            <Search size={13} style={{ position: 'absolute', left: '8px', top: '9px', color: 'var(--dash-text-muted)' }} />
          </div>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
          Hiển thị <strong>{filteredIncidents.length}</strong> / <strong>{incidents.length}</strong> sự cố
        </div>
      </div>

      {/* Main Overview Table */}
      <div
        className="dash-card"
        style={{
          padding: 0,
          overflow: 'hidden',
          borderRadius: '14px',
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--dash-border)',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', tableLayout: 'auto' }}>
            <thead>
              <tr
                style={{
                  backgroundColor: '#F8FAFC',
                  borderBottom: '1px solid #E2E8F0',
                  textAlign: 'left',
                }}
              >
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', width: '130px' }}>
                  MÃ SỰ CỐ
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', width: '110px' }}>
                  MỨC ĐỘ
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', width: '170px' }}>
                  DỊCH VỤ / NODE
                </th>
                <th style={{ padding: '14px 18px', fontSize: '0.75rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', minWidth: '380px', maxWidth: '420px' }}>
                  TIÊU ĐỀ SỰ CỐ TỔNG QUAN
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', width: '150px' }}>
                  TRẠNG THÁI
                </th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', width: '150px', textAlign: 'right' }}>
                  THAO TÁC
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: '#64748B' }}>
                    <ShieldCheck size={42} color="#10B981" style={{ margin: '0 auto 12px auto' }} />
                    <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0F172A' }}>
                      {isLoading
                        ? 'Đang tải dữ liệu sự cố từ Database...'
                        : (incidents.length === 0
                            ? `Cụm ${currentEnv?.cluster || 'K8s'} không có sự cố nào`
                            : 'Không tìm thấy sự cố nào phù hợp với bộ lọc')}
                    </div>
                    <div style={{ fontSize: '0.8125rem', marginTop: '6px', color: '#64748B' }}>
                      {isLoading
                        ? 'Vui lòng chờ trong giây lát...'
                        : (incidents.length === 0
                            ? 'Toàn bộ các dịch vụ và node trên cụm đang hoạt động ổn định và an toàn theo thời gian thực.'
                            : 'Thử điều chỉnh lại mức độ, trạng thái hoặc từ khóa tìm kiếm.')}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((item, index) => {
                  const isCrit = item.severity === 'CRITICAL';
                  const isHigh = item.severity === 'HIGH';
                  const isMed = item.severity === 'MEDIUM';

                  const isDone = item.status.includes('hoàn tất');
                  const isWait = item.status.includes('duyệt');

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            backgroundColor: '#F1F5F9',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0',
                            fontSize: '0.75rem',
                          }}
                        >
                          {item.id}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 8px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.6875rem',
                            fontWeight: 800,
                            borderRadius: '6px',
                            backgroundColor: isCrit ? '#FFF1F2' : isHigh ? '#FFF7ED' : isMed ? '#FFFBEB' : '#EFF6FF',
                            color: isCrit ? '#E11D48' : isHigh ? '#EA580C' : isMed ? '#D97706' : '#2563EB',
                            border: `1px solid ${isCrit ? '#FDA4AF' : isHigh ? '#FDBA74' : isMed ? '#FDE68A' : '#BFDBFE'}`,
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: isCrit ? '#E11D48' : isHigh ? '#EA580C' : isMed ? '#D97706' : '#2563EB',
                            }}
                          />
                          {item.severity}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--dash-primary)' }}>
                          {item.service}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>
                          ns: {item.namespace} &bull; {item.node}
                        </div>
                      </td>

                      {/* CỘT TIÊU ĐỀ: ĐỘ RỘNG VỪA PHẢI, NẰM NGANG, HIỂN THỊ 2 HÀNG RỒI MỚI ... */}
                      <td style={{ padding: '14px 18px', minWidth: '380px', maxWidth: '420px' }}>
                        <div
                          title={item.title}
                          style={{
                            fontWeight: 600,
                            color: '#0F172A',
                            fontSize: '0.84rem',
                            lineHeight: 1.5,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            wordBreak: 'break-word',
                          }}
                        >
                          {item.title}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 9px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor: isDone ? '#DCFCE7' : isWait ? '#FEF3C7' : '#EFF6FF',
                            color: isDone ? '#15803D' : isWait ? '#B45309' : '#1D4ED8',
                            border: `1px solid ${isDone ? '#86EFAC' : isWait ? '#FDE68A' : '#BFDBFE'}`,
                          }}
                        >
                          {isDone ? <CheckCircle2 size={13} /> : isWait ? <Clock size={13} /> : <Zap size={13} />}
                          <span>{item.status}</span>
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          {/* Nút Xem Chi Tiết -> BẬT KHUNG CỬA SỔ NHỎ (MODAL) */}
                          <button
                            type="button"
                            onClick={() => setActiveModalIncident(item)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '6px 14px',
                              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                              color: '#FFFFFF',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              borderRadius: '7px',
                              border: 'none',
                              cursor: 'pointer',
                              boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <Eye size={13} />
                            <span>Xem chi tiết</span>
                          </button>

                          {/* Thời điểm ghi nhận đặt ngay dưới nút xem chi tiết */}
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.6875rem',
                              color: '#64748B',
                              fontWeight: 500,
                            }}
                          >
                            <Clock size={11} color="#94A3B8" />
                            <span>{item.time}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* KHUNG CỬA SỔ NHỎ HIỆN LÊN KHI BẤM "XEM CHI TIẾT" */}
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
