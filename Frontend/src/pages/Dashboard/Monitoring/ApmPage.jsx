import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { telemetryService } from '../../../services/telemetryService';
import ApmChartsPanel from '../../../components/dashboard/ApmChartsPanel';
import {
  APM_TIME_RANGE_PRESETS,
  transformApmMetricsForCharts,
  formatLatency,
  formatRps,
  formatErrorRate,
  formatAvailability,
  getServiceHealthStatus,
  formatUnixTime,
} from '../../../utils/apmChartUtils';
import {
  Zap,
  Activity,
  Clock,
  TrendingUp,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Server,
  Layers,
  ArrowRight,
} from 'lucide-react';

export const ApmPage = ({ onNavigate }) => {
  const { currentOrg, currentEnv } = useDashboard();

  const activeClusterId = currentEnv?.clusterId || currentEnv?.id;
  const isClusterOnline = Boolean(
    (currentEnv?.agentStatus === 'ONLINE' || currentEnv?.status === 'Healthy' || currentEnv?.status === 'Ready') &&
    activeClusterId &&
    activeClusterId !== 'null' &&
    !String(activeClusterId).startsWith('sandbox-')
  );

  const [servicesList, setServicesList] = useState([]);
  const [selectedService, setSelectedService] = useState('hello-minikube');
  const [timeRange, setTimeRange] = useState('15m');
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  const [rawSequence, setRawSequence] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [refreshWarning, setRefreshWarning] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortField, setSortField] = useState('service_name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date());

  const abortControllerRef = useRef(null);
  const requestSeqRef = useRef(0);

  // 1. Fetch APM services list scoped by Organization & Cluster
  const loadServices = useCallback(async () => {
    if (!currentOrg?.id || !isClusterOnline) {
      setServicesList([]);
      setRawSequence([]);
      setIsLoading(false);
      return;
    }

    try {
      const list = await telemetryService.getApmServices(60, {
        organizationId: currentOrg.id,
        clusterId: activeClusterId,
      });
      if (Array.isArray(list) && list.length > 0) {
        setServicesList(list);
        setSelectedService((prev) => {
          if (prev && list.some((s) => s.service_id === prev || s.service_name === prev)) {
            return prev;
          }
          return list[0].service_id || list[0].service_name || 'hello-minikube';
        });
      } else {
        setServicesList([]);
        setRawSequence([]);
      }
    } catch (err) {
      console.warn('[ApmPage] Không thể tải danh sách APM services:', err.message);
      setServicesList([]);
      setRawSequence([]);
    }
  }, [currentOrg?.id, activeClusterId, isClusterOnline]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  // 2. Fetch Metrics Sequence for the selected service
  const fetchServiceMetrics = useCallback(
    async (silent = false) => {
      if (!selectedService) return;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const currentSeq = ++requestSeqRef.current;

      if (!silent) {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const preset =
          APM_TIME_RANGE_PRESETS.find((p) => p.id === timeRange) ||
          APM_TIME_RANGE_PRESETS[1];

        if (!isClusterOnline) {
          setRawSequence([]);
          setIsLoading(false);
          return;
        }

        const sequence = await telemetryService.getMetricsSequence(selectedService, {
          limit: preset.limit,
          bucket_seconds: preset.bucketSeconds,
          range: preset.id,
          cluster_id: activeClusterId,
          organization_id: currentOrg?.id,
          signal: controller.signal,
        });

        if (currentSeq !== requestSeqRef.current || controller.signal.aborted) {
          return;
        }

        setRawSequence(Array.isArray(sequence) ? sequence : []);
        setLastRefreshedAt(new Date());
        setRefreshWarning(null);
      } catch (err) {
        if (err?.name === 'AbortError' || controller.signal.aborted) {
          return;
        }
        if (currentSeq !== requestSeqRef.current) {
          return;
        }
        if (silent && rawSequence.length > 0) {
          setRefreshWarning(
            `Lần làm mới nền gần nhất không thành công (${err.message || 'Lỗi mạng'}). Đang hiển thị số liệu đã lưu trong bộ nhớ tạm.`
          );
        } else {
          setErrorMessage(err.message || 'Không thể tải chuỗi dữ liệu APM từ máy chủ');
          setRawSequence([]);
        }
      } finally {
        if (currentSeq === requestSeqRef.current && !controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [selectedService, timeRange, rawSequence.length]
  );

  useEffect(() => {
    fetchServiceMetrics(false);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchServiceMetrics]);

  // Auto-refresh interval (15s)
  useEffect(() => {
    if (!isAutoRefresh) return undefined;
    const timer = setInterval(() => {
      fetchServiceMetrics(true);
      loadServices();
    }, 15000);
    return () => clearInterval(timer);
  }, [isAutoRefresh, fetchServiceMetrics, loadServices]);

  // 3. Transform raw sequence for charts & summary
  const presetConfig = useMemo(
    () => APM_TIME_RANGE_PRESETS.find((p) => p.id === timeRange) || APM_TIME_RANGE_PRESETS[1],
    [timeRange]
  );

  const chartModel = useMemo(
    () =>
      transformApmMetricsForCharts(rawSequence, {
        maxPoints: presetConfig.maxChartPoints,
        bucketSeconds: presetConfig.bucketSeconds,
        nowMs: Date.now(),
      }),
    [rawSequence, presetConfig.maxChartPoints, presetConfig.bucketSeconds]
  );

  const { summary } = chartModel;

  // Filtered & Sorted services table
  const filteredAndSortedServices = useMemo(() => {
    let result = [...servicesList];

    // 1. Text Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          (s.service_name || '').toLowerCase().includes(term) ||
          (s.service_id || '').toLowerCase().includes(term)
      );
    }

    // 2. Status Filter
    if (statusFilter !== 'ALL') {
      result = result.filter((s) => {
        const health = getServiceHealthStatus(s.avg_error_rate, s.avg_latency_ms);
        return health.status === statusFilter;
      });
    }

    // 3. Sorting
    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'service_name') {
        valA = (valA || a.service_id || '').toLowerCase();
        valB = (valB || b.service_id || '').toLowerCase();
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      if (sortField === 'status') {
        const order = { CRITICAL: 3, WARNING: 2, HEALTHY: 1, UNKNOWN: 0 };
        valA = order[getServiceHealthStatus(a.avg_error_rate, a.avg_latency_ms).status] || 0;
        valB = order[getServiceHealthStatus(b.avg_error_rate, b.avg_latency_ms).status] || 0;
      } else {
        valA = typeof valA === 'number' ? valA : 0;
        valB = typeof valB === 'number' ? valB : 0;
      }

      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    return result;
  }, [servicesList, searchTerm, statusFilter, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div
      className="dashboard-apm-page"
      data-testid="dashboard-apm-page"
      style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
    >
      {/* 1. Header & Navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#ECFDF5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #A7F3D0',
              }}
            >
              <Zap size={20} color="#059669" />
            </div>
            <div>
              <h1
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: 'var(--dash-text-primary, #0F172A)',
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}
              >
                Giám Sát Hiệu Năng Ứng Dụng (APM)
              </h1>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--dash-text-secondary, #64748B)',
                  margin: '4px 0 0 0',
                }}
              >
                {currentOrg?.name || 'Tổ chức'} &bull;{' '}
                <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                  {currentEnv?.name || 'Môi trường'}
                </span>{' '}
                &bull; Độ trễ thời gian thực, thông lượng truy vấn &amp; tỷ lệ lỗi ứng dụng
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher: Node Metrics vs APM */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            data-testid="apm-switch-to-nodes-btn"
            onClick={() => onNavigate && onNavigate('/dashboard/monitoring/metrics')}
            style={{
              padding: '6px 12px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              backgroundColor: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '6px',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Server size={14} />
            <span>Hạ Tầng (Node Metrics)</span>
          </button>
          <button
            type="button"
            disabled
            style={{
              padding: '6px 12px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              backgroundColor: '#059669',
              border: '1px solid #059669',
              borderRadius: '6px',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Zap size={14} />
            <span>Ứng Dụng (APM)</span>
          </button>
        </div>
      </div>

      {/* 2. Filter & Controls Bar */}
      <div
        className="dash-card"
        style={{
          padding: '14px 18px',
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--dash-border, #E2E8F0)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Service Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="#0284C7" />
            <label
              htmlFor="apm-service-select"
              style={{
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: '#0F172A',
              }}
            >
              Dịch vụ (Service):
            </label>
            <select
              id="apm-service-select"
              data-testid="apm-service-select"
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              style={{
                height: '34px',
                padding: '0 12px',
                fontSize: '0.8125rem',
                fontWeight: 700,
                fontFamily: 'var(--font-mono, monospace)',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                backgroundColor: '#F8FAFC',
                color: '#0F172A',
                cursor: 'pointer',
              }}
            >
              {servicesList.length === 0 ? (
                <option value="">{isClusterOnline ? '-- Chưa có dịch vụ nào --' : '-- Cụm chưa kết nối tác tử --'}</option>
              ) : (
                servicesList.map((s) => (
                  <option key={s.service_id} value={s.service_id}>
                    {s.service_name || s.service_id} ({s.service_type || 'Service'})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Active Health Badge */}
          {summary?.health && (
            <span
              data-testid="apm-health-badge"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: summary.health.bg,
                color: summary.health.color,
                border: `1px solid ${summary.health.border}`,
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: summary.health.color,
                }}
              />
              {summary.health.label}
            </span>
          )}
        </div>

        {/* Time Presets & Refresh Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Time range preset buttons */}
          <div
            role="group"
            aria-label="Khoảng thời gian APM"
            style={{
              display: 'flex',
              backgroundColor: '#F1F5F9',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
            }}
          >
            {APM_TIME_RANGE_PRESETS.map((preset) => {
              const active = timeRange === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="button"
                  tabIndex={0}
                  aria-pressed={active}
                  aria-label={`Chọn khoảng thời gian ${preset.label}`}
                  data-testid={`apm-range-${preset.id}`}
                  onClick={() => setTimeRange(preset.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setTimeRange(preset.id);
                    }
                  }}
                  style={{
                    padding: '4px 10px',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: active ? '#FFFFFF' : 'transparent',
                    color: active ? '#059669' : '#64748B',
                    border: 'none',
                    borderRadius: '6px',
                    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Auto Refresh Toggle */}
          <button
            type="button"
            data-testid="apm-autorefresh-toggle"
            onClick={() => setIsAutoRefresh((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: isAutoRefresh ? '1px solid #A7F3D0' : '1px solid #CBD5E1',
              backgroundColor: isAutoRefresh ? '#ECFDF5' : '#F8FAFC',
              color: isAutoRefresh ? '#059669' : '#64748B',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: isAutoRefresh ? '#10B981' : '#94A3B8',
              }}
            />
            <span>Auto 15s</span>
          </button>

          {/* Manual Refresh Button */}
          <button
            type="button"
            data-testid="apm-refresh-btn"
            onClick={() => {
              fetchServiceMetrics(false);
              loadServices();
            }}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 2.5 Non-destructive Refresh Warning Banner if background auto-refresh fails */}
      {refreshWarning && (
        <div
          data-testid="apm-refresh-warning-banner"
          style={{
            padding: '10px 16px',
            backgroundColor: '#FEF3C7',
            border: '1px solid #FCD34D',
            borderRadius: '8px',
            color: '#92400E',
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={16} color="#D97706" />
          <span>{refreshWarning}</span>
        </div>
      )}

      {/* 3. Four Core APM KPI Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '14px',
        }}
      >
        {/* KPI 1: Response Time */}
        <div
          className="dash-card"
          data-testid="kpi-card-response-time"
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Thời Gian Phản Hồi (Avg)
            </span>
            <Clock size={16} color="#0284C7" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', marginTop: '6px', fontFamily: 'monospace' }}>
            {formatLatency(summary?.latency?.avg)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <span>
              p50: <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{formatLatency(summary?.latency?.p50)}</strong>
            </span>
            <span>&bull;</span>
            <span>
              p95: <strong style={{ color: '#0369A1', fontFamily: 'monospace' }}>{formatLatency(summary?.latency?.p95)}</strong>
            </span>
            <span>&bull;</span>
            <span>
              p99: <strong style={{ color: '#7C3AED', fontFamily: 'monospace' }}>{formatLatency(summary?.latency?.p99)}</strong>
            </span>
            <span>&bull;</span>
            <span>
              Đỉnh: <strong style={{ fontFamily: 'monospace' }}>{formatLatency(summary?.latency?.max)}</strong>
            </span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#94A3B8', marginTop: '6px' }}>
            Cửa sổ đo: <strong>{presetConfig.label}</strong>
          </div>
        </div>

        {/* KPI 2: Throughput (RPS) */}
        <div
          className="dash-card"
          data-testid="kpi-card-throughput"
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Lưu Lượng (Throughput)
            </span>
            <TrendingUp size={16} color="#6366F1" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', marginTop: '6px', fontFamily: 'monospace' }}>
            {formatRps(summary?.throughput?.avg)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px', display: 'flex', gap: '8px' }}>
            <span>
              Hiện tại: <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{formatRps(summary?.throughput?.current)}</strong>
            </span>
            <span>&bull;</span>
            <span>
              Đỉnh:{' '}
              <strong style={{ color: '#4F46E5', fontFamily: 'monospace' }}>
                {formatRps(summary?.throughput?.max)}
              </strong>
            </span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#94A3B8', marginTop: '6px' }}>
            Cửa sổ đo: <strong>{presetConfig.label}</strong>
          </div>
        </div>

        {/* KPI 3: Error Rate (5xx) */}
        <div
          className="dash-card"
          data-testid="kpi-card-error-rate"
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Tỷ Lệ Lỗi (HTTP 5xx)
            </span>
            <ShieldAlert size={16} color={summary?.errorRate?.avg > 0 ? '#EF4444' : '#10B981'} />
          </div>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: summary?.errorRate?.avg > 0 ? '#DC2626' : '#10B981',
              marginTop: '6px',
              fontFamily: 'monospace',
            }}
          >
            {formatErrorRate(summary?.errorRate?.avg)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px', display: 'flex', gap: '8px' }}>
            <span>
              Hiện tại: <strong style={{ fontFamily: 'monospace' }}>{formatErrorRate(summary?.errorRate?.current)}</strong>
            </span>
            <span>&bull;</span>
            <span>
              Đỉnh:{' '}
              <strong style={{ color: summary?.errorRate?.max > 0 ? '#DC2626' : '#64748B', fontFamily: 'monospace' }}>
                {formatErrorRate(summary?.errorRate?.max)}
              </strong>
            </span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#94A3B8', marginTop: '6px' }}>
            Cửa sổ đo: <strong>{presetConfig.label}</strong>
          </div>
        </div>

        {/* KPI 4: Availability / SLO */}
        <div
          className="dash-card"
          data-testid="kpi-card-availability"
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Độ Khả Dụng (Availability)
            </span>
            <CheckCircle2 size={16} color="#059669" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', marginTop: '6px', fontFamily: 'monospace' }}>
            {formatAvailability(summary?.availability)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px', display: 'flex', gap: '8px' }}>
            <span>
              Replicas: <strong>{summary?.replicas ?? '--'}</strong>
            </span>
            <span>&bull;</span>
            <span>
              Restarts: <strong>{summary?.restarts ?? '--'}</strong>
            </span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#94A3B8', marginTop: '6px' }}>
            Cửa sổ đo: <strong>{presetConfig.label}</strong>
          </div>
        </div>
      </div>

      {/* 4. APM Time-Series Charts Panel */}
      <ApmChartsPanel
        chartModel={chartModel}
        serviceName={selectedService}
        isLoading={isLoading}
        errorMessage={!isClusterOnline ? 'Cụm Kubernetes chưa kết nối hoặc Tác tử eBPF đang ngoại tuyến tại tổ chức này.' : errorMessage}
        onRetry={() => fetchServiceMetrics(false)}
      />

      {/* 5. Microservices & Endpoints Performance Table */}
      <div
        className="dash-card"
        data-testid="apm-services-table-panel"
        style={{
          padding: '20px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Bảng Tổng Hợp Dịch Vụ Vi Mô &amp; Endpoints
            </h2>
            <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '4px 0 0 0' }}>
              Danh sách các vi dịch vụ đang được eBPF Agent giám sát hiệu năng APM trong cụm
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Status Filter */}
            <div
              role="group"
              aria-label="Lọc trạng thái dịch vụ"
              style={{
                display: 'flex',
                backgroundColor: '#F1F5F9',
                padding: '2px',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
              }}
            >
              {[
                { id: 'ALL', label: 'Tất cả' },
                { id: 'HEALTHY', label: 'Khỏe mạnh' },
                { id: 'WARNING', label: 'Cảnh báo' },
                { id: 'CRITICAL', label: 'Nguy hiểm' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  data-testid={`apm-filter-${btn.id.toLowerCase()}`}
                  onClick={() => setStatusFilter(btn.id)}
                  style={{
                    padding: '3px 8px',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    backgroundColor: statusFilter === btn.id ? '#FFFFFF' : 'transparent',
                    color: statusFilter === btn.id ? '#059669' : '#64748B',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    boxShadow: statusFilter === btn.id ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#F8FAFC',
              }}
            >
              <Search size={14} color="#64748B" />
              <input
                type="text"
                data-testid="apm-search-input"
                placeholder="Tìm dịch vụ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  outline: 'none',
                  fontSize: '0.8125rem',
                  color: '#0F172A',
                  width: '140px',
                }}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.8125rem',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th
                  onClick={() => handleSort('service_name')}
                  style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
                >
                  Tên Dịch Vụ {sortField === 'service_name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Loại</th>
                <th
                  onClick={() => handleSort('avg_request_rate')}
                  style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
                >
                  Lưu Lượng {sortField === 'avg_request_rate' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('avg_latency_ms')}
                  style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
                >
                  Độ Trễ (Avg) {sortField === 'avg_latency_ms' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('max_latency_ms')}
                  style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
                >
                  Đỉnh Trễ (Max) {sortField === 'max_latency_ms' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('avg_error_rate')}
                  style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
                >
                  Tỷ Lệ Lỗi {sortField === 'avg_error_rate' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('replica_count')}
                  style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
                >
                  Bản Sao {sortField === 'replica_count' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th
                  onClick={() => handleSort('status')}
                  style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
                >
                  Trạng Thái {sortField === 'status' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedServices.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>
                    {!isClusterOnline
                      ? 'Chưa có dữ liệu do Cụm Kubernetes chưa kết nối hoặc Tác tử eBPF đang ngoại tuyến tại tổ chức này.'
                      : 'Không tìm thấy dịch vụ nào phù hợp với tìm kiếm'}
                  </td>
                </tr>
              ) : (
                filteredAndSortedServices.map((svc) => {
                  const isSelected = svc.service_id === selectedService;
                  const health = getServiceHealthStatus(svc.avg_error_rate, svc.avg_latency_ms);

                  return (
                    <tr
                      key={svc.service_id}
                      data-testid={`apm-service-row-${svc.service_id}`}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: isSelected ? '#F0FDF4' : 'transparent',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0F172A' }}>
                        <span style={{ fontFamily: 'monospace' }}>{svc.service_name || svc.service_id}</span>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#64748B' }}>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#F1F5F9',
                            color: '#475569',
                          }}
                        >
                          {svc.service_type || 'ClusterIP'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 600 }}>
                        {formatRps(svc.avg_request_rate)}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace' }}>
                        {formatLatency(svc.avg_latency_ms)}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#64748B' }}>
                        {formatLatency(svc.max_latency_ms)}
                      </td>
                      <td
                        style={{
                          padding: '12px 14px',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          color: svc.avg_error_rate > 0 ? '#DC2626' : '#10B981',
                        }}
                      >
                        {formatErrorRate(svc.avg_error_rate)}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace' }}>
                        {svc.replica_count || 1}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            backgroundColor: health.bg,
                            color: health.color,
                            border: `1px solid ${health.border}`,
                          }}
                        >
                          {health.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <button
                          type="button"
                          data-testid={`select-service-${svc.service_id}`}
                          onClick={() => setSelectedService(svc.service_id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            borderRadius: '6px',
                            border: isSelected ? '1px solid #059669' : '1px solid #CBD5E1',
                            backgroundColor: isSelected ? '#059669' : '#FFFFFF',
                            color: isSelected ? '#FFFFFF' : '#334155',
                            cursor: 'pointer',
                          }}
                        >
                          <span>{isSelected ? 'Đang Xem' : 'Xem Biểu Đồ'}</span>
                          <ArrowRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ApmPage;
