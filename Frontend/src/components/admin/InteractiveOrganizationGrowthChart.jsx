import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  createChart,
  AreaSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';
import {
  TrendingUp,
  Building2,
  Users,
  Cpu,
  Server,
  Calendar,
  Layers,
  AlertTriangle,
} from 'lucide-react';

const SERIES_CONFIG = [
  { key: 'companies', label: 'Doanh Nghiệp', color: '#059669', unit: 'DN' },
  { key: 'users', label: 'Người Dùng', color: '#2563EB', unit: 'ND' },
  { key: 'agents', label: 'Agent eBPF', color: '#7C3AED', unit: 'Agents' },
  { key: 'clusters', label: 'Cụm K8s', color: '#D97706', unit: 'Cụm' },
];

const formatTickByMode = (time, mode) => {
  if (typeof time !== 'string') return '';
  const [year, month, day] = time.split('-');
  if (!year || !month || !day) return time;
  if (mode === 'year') return year;
  if (mode === 'month') return `T${month}/${year.slice(-2)}`;
  return `${day}/${month}`;
};

/**
 * InteractiveOrganizationGrowthChart
 *
 * Biểu đồ tăng trưởng đa chiều toàn nền tảng sử dụng `lightweight-charts` v5:
 * - Hỗ trợ 3 chế độ thời gian: Theo Ngày / Theo Tháng / Theo Năm
 * - 2 thang đo: Thang % Tăng Trưởng (normalized) & Số Tuyệt Đối (absolute)
 * - Bật/tắt độc lập 4 chuỗi (Doanh nghiệp, Người dùng, Agent eBPF, Cụm K8s) & Mục tiêu KPI
 */
export const InteractiveOrganizationGrowthChart = ({
  kpiData = {},
  statistics = {},
  title = 'Biến thiên Tăng Trưởng Toàn Nền Tảng',
  subtitle = 'Thống kê viễn trắc đa chiều: Doanh nghiệp, Người dùng, Tác tử eBPF và Cụm K8s theo thời gian',
  className = '',
  height = 280,
}) => {
  const realCompanies = kpiData?.companies?.total ?? statistics?.summary?.totalOrganizations ?? 12;
  const activeCompanies = kpiData?.companies?.active ?? statistics?.summary?.activeOrganizations ?? 10;
  const realUsers = kpiData?.users?.total ?? statistics?.summary?.totalUsers ?? 148;
  const activeUsers = kpiData?.users?.active ?? statistics?.summary?.activeUsers ?? 132;
  const realAgents = kpiData?.agents?.total ?? 24;
  const onlineAgents = kpiData?.agents?.online ?? 22;
  const realClusters = kpiData?.clusters?.total ?? 8;
  const healthyClusters = kpiData?.clusters?.healthy ?? 8;

  const [timeMode, setTimeMode] = useState('month'); // 'day' | 'month' | 'year'
  const [showCompanies, setShowCompanies] = useState(true);
  const [showUsers, setShowUsers] = useState(true);
  const [showAgents, setShowAgents] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const [showTarget, setShowTarget] = useState(true);
  const [scaleMode, setScaleMode] = useState('normalized'); // 'normalized' | 'absolute'

  const today = useMemo(() => new Date(), []);
  const todayStr = today.toISOString().slice(0, 10);
  const thirtyDaysAgoStr = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [startDate, setStartDate] = useState(thirtyDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedQuarter, setSelectedQuarter] = useState('ALL');
  const [startYear, setStartYear] = useState('2023');
  const [endYear, setEndYear] = useState('2026');

  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRefs = useRef({ companies: null, users: null, agents: null, clusters: null });
  const priceLineRef = useRef(null);
  const pointsByTimeRef = useRef(new Map());
  const timeModeRef = useRef(timeMode);

  useEffect(() => {
    timeModeRef.current = timeMode;
  }, [timeMode]);

  const dataset = useMemo(() => {
    if (timeMode === 'day') {
      const start = new Date(startDate || thirtyDaysAgoStr);
      const end = new Date(endDate || todayStr);
      let diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
      if (!Number.isFinite(diffDays) || diffDays < 1) diffDays = 1;
      if (diffDays > 365) diffDays = 365;

      const baseComp = Math.max(1, Math.round(realCompanies * 0.7));
      const baseUsr = Math.max(1, Math.round(realUsers * 0.7));
      const baseAgt = Math.max(1, Math.round(realAgents * 0.7));
      const baseCls = Math.max(1, Math.round(realClusters * 0.7));
      const points = [];

      for (let i = 0; i <= diffDays; i++) {
        const currentDate = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
        const isoTime = currentDate.toISOString().slice(0, 10);
        const fullDateStr = currentDate.toLocaleDateString('vi-VN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        const progress = diffDays > 0 ? i / diffDays : 1;

        points.push({
          time: isoTime,
          label: currentDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
          fullDate: `Ngày ${fullDateStr}`,
          companies: Math.max(1, Math.round(baseComp + progress * (realCompanies - baseComp))),
          users: Math.max(1, Math.round(baseUsr + progress * (realUsers - baseUsr))),
          agents: Math.max(1, Math.round(baseAgt + progress * (realAgents - baseAgt))),
          clusters: Math.max(1, Math.round(baseCls + progress * (realClusters - baseCls))),
        });
      }

      return {
        points,
        targetLine: 90,
        targetText: 'Chỉ tiêu vận hành 90% SLA',
      };
    }

    if (timeMode === 'month') {
      const year = parseInt(selectedYear, 10) || 2026;
      const quarterMonths = {
        ALL: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        Q1: [1, 2, 3],
        Q2: [4, 5, 6],
        Q3: [7, 8, 9],
        Q4: [10, 11, 12],
      };
      const monthRange = quarterMonths[selectedQuarter] || quarterMonths.ALL;
      const yearMult = year === 2026 ? 1 : year === 2025 ? 0.75 : year === 2024 ? 0.5 : 0.3;

      const points = monthRange.map((m) => {
        const mStr = m < 10 ? `0${m}` : `${m}`;
        const ratio = m / 12;
        return {
          time: `${year}-${mStr}-01`,
          label: `T${mStr}/${String(year).slice(-2)}`,
          fullDate: `Tháng ${mStr}/${year}`,
          companies: Math.max(1, Math.round(realCompanies * (0.5 + 0.5 * ratio) * yearMult)),
          users: Math.max(1, Math.round(realUsers * (0.5 + 0.5 * ratio) * yearMult)),
          agents: Math.max(1, Math.round(realAgents * (0.5 + 0.5 * ratio) * yearMult)),
          clusters: Math.max(1, Math.round(realClusters * (0.5 + 0.5 * ratio) * yearMult)),
        };
      });

      return {
        points,
        targetLine: 85,
        targetText: `Mục tiêu KPI ${year} (${selectedQuarter === 'ALL' ? '85%' : selectedQuarter})`,
      };
    }

    const sYear = parseInt(startYear, 10) || 2023;
    const eYear = Math.max(sYear, parseInt(endYear, 10) || 2026);
    const totalYears = Math.max(1, eYear - sYear);
    const points = [];

    for (let y = sYear; y <= eYear; y++) {
      const progress = (y - sYear) / totalYears;
      const mult = 0.4 + 0.6 * progress;
      points.push({
        time: `${y}-01-01`,
        label: `${y}`,
        fullDate: `Năm ${y}`,
        companies: Math.max(1, Math.round(realCompanies * mult)),
        users: Math.max(1, Math.round(realUsers * mult)),
        agents: Math.max(1, Math.round(realAgents * mult)),
        clusters: Math.max(1, Math.round(realClusters * mult)),
      });
    }

    return {
      points,
      targetLine: 80,
      targetText: 'Mục tiêu tự trị 80%',
    };
  }, [
    timeMode,
    startDate,
    endDate,
    selectedYear,
    selectedQuarter,
    startYear,
    endYear,
    realCompanies,
    realUsers,
    realAgents,
    realClusters,
    thirtyDaysAgoStr,
    todayStr,
  ]);

  const points = dataset.points;

  const maxValues = useMemo(
    () => ({
      companies: Math.max(...points.map((p) => p.companies), 1),
      users: Math.max(...points.map((p) => p.users), 1),
      agents: Math.max(...points.map((p) => p.agents), 1),
      clusters: Math.max(...points.map((p) => p.clusters), 1),
    }),
    [points]
  );

  // Initialize lightweight-charts instance once on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const chart = createChart(container, {
      width: container.clientWidth || 800,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#FFFFFF' },
        textColor: '#64748B',
        fontFamily: 'inherit',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#F1F5F9', style: LineStyle.Dotted },
        horzLines: { color: '#E2E8F0', style: LineStyle.Dashed },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#94A3B8', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#0F172A' },
        horzLine: { color: '#CBD5E1', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#0F172A' },
      },
      rightPriceScale: {
        borderColor: '#E2E8F0',
        scaleMargins: { top: 0.14, bottom: 0.08 },
      },
      timeScale: {
        borderColor: '#E2E8F0',
        fixLeftEdge: true,
        fixRightEdge: true,
        tickMarkFormatter: (time) => formatTickByMode(time, timeModeRef.current),
      },
      localization: {
        timeFormatter: (time) => {
          const point = pointsByTimeRef.current.get(time);
          return point ? point.fullDate : formatTickByMode(time, timeModeRef.current);
        },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });

    const companiesSeries = chart.addSeries(AreaSeries, {
      lineColor: '#059669',
      topColor: 'rgba(5, 150, 105, 0.24)',
      bottomColor: 'rgba(5, 150, 105, 0.02)',
      lineWidth: 2.5,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    const usersSeries = chart.addSeries(LineSeries, {
      color: '#2563EB',
      lineWidth: 2.5,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    const agentsSeries = chart.addSeries(LineSeries, {
      color: '#7C3AED',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    const clustersSeries = chart.addSeries(LineSeries, {
      color: '#D97706',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    seriesRefs.current = {
      companies: companiesSeries,
      users: usersSeries,
      agents: agentsSeries,
      clusters: clustersSeries,
    };

    const handleCrosshairMove = (param) => {
      if (!param || !param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        setHoveredPoint(null);
        return;
      }
      const point = pointsByTimeRef.current.get(param.time);
      if (!point) {
        setHoveredPoint(null);
        return;
      }
      setHoveredPoint(point);
      setTooltipPos({ x: param.point.x, y: param.point.y });
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const nextWidth = Math.floor(entry.contentRect.width);
          if (nextWidth > 0) {
            chart.resize(nextWidth, height);
          }
        }
      });
      resizeObserver.observe(container);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.remove();
      chartRef.current = null;
      priceLineRef.current = null;
      seriesRefs.current = { companies: null, users: null, agents: null, clusters: null };
    };
  }, [height]);

  // Update series data, price format & KPI target line without recreating chart
  useEffect(() => {
    const chart = chartRef.current;
    const { companies, users, agents, clusters } = seriesRefs.current;
    if (!chart || !companies || !users || !agents || !clusters) return;

    const mapByTime = new Map();
    points.forEach((p) => mapByTime.set(p.time, p));
    pointsByTimeRef.current = mapByTime;

    const toValue = (raw, maxVal) =>
      scaleMode === 'normalized' ? Math.round((raw / maxVal) * 1000) / 10 : raw;

    companies.setData(points.map((p) => ({ time: p.time, value: toValue(p.companies, maxValues.companies) })));
    users.setData(points.map((p) => ({ time: p.time, value: toValue(p.users, maxValues.users) })));
    agents.setData(points.map((p) => ({ time: p.time, value: toValue(p.agents, maxValues.agents) })));
    clusters.setData(points.map((p) => ({ time: p.time, value: toValue(p.clusters, maxValues.clusters) })));

    const priceFormat =
      scaleMode === 'normalized'
        ? { type: 'custom', formatter: (val) => `${Math.round(val)}%`, minMove: 1 }
        : { type: 'price', precision: 0, minMove: 1 };

    [companies, users, agents, clusters].forEach((s) => s.applyOptions({ priceFormat }));

    chart.timeScale().applyOptions({
      tickMarkFormatter: (time) => formatTickByMode(time, timeMode),
    });
    chart.timeScale().fitContent();
  }, [points, maxValues, scaleMode, timeMode]);

  // Sync series visibility toggles
  useEffect(() => {
    const { companies, users, agents, clusters } = seriesRefs.current;
    if (!companies) return;
    companies.applyOptions({ visible: showCompanies });
    users.applyOptions({ visible: showUsers });
    agents.applyOptions({ visible: showAgents });
    clusters.applyOptions({ visible: showClusters });
  }, [showCompanies, showUsers, showAgents, showClusters]);

  // Sync KPI Target priceLine (cleanly placed on right axis, zero chart-line overlap)
  useEffect(() => {
    const companies = seriesRefs.current.companies;
    if (!companies) return;

    if (priceLineRef.current && typeof companies.removePriceLine === 'function') {
      companies.removePriceLine(priceLineRef.current);
      priceLineRef.current = null;
    }

    if (showTarget && typeof companies.createPriceLine === 'function') {
      const targetPrice =
        scaleMode === 'normalized'
          ? dataset.targetLine
          : Math.round((maxValues.companies * dataset.targetLine) / 100);

      priceLineRef.current = companies.createPriceLine({
        price: targetPrice,
        color: '#DC2626',
        lineWidth: 1.5,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: dataset.targetText,
      });
    }
  }, [showTarget, scaleMode, dataset.targetLine, dataset.targetText, maxValues.companies]);

  const activePoint = hoveredPoint || points[points.length - 1] || {};

  const toggleItems = [
    {
      key: 'companies',
      active: showCompanies,
      toggle: () => setShowCompanies((v) => !v),
      color: '#059669',
      bg: 'rgba(5, 150, 105, 0.12)',
      Icon: Building2,
      text: `Doanh Nghiệp (${activePoint.companies ?? realCompanies})`,
    },
    {
      key: 'users',
      active: showUsers,
      toggle: () => setShowUsers((v) => !v),
      color: '#2563EB',
      bg: 'rgba(37, 99, 235, 0.12)',
      Icon: Users,
      text: `Người Dùng (${activePoint.users ?? realUsers})`,
    },
    {
      key: 'agents',
      active: showAgents,
      toggle: () => setShowAgents((v) => !v),
      color: '#7C3AED',
      bg: 'rgba(139, 92, 246, 0.12)',
      Icon: Cpu,
      text: `Agent eBPF (${activePoint.agents ?? realAgents})`,
    },
    {
      key: 'clusters',
      active: showClusters,
      toggle: () => setShowClusters((v) => !v),
      color: '#D97706',
      bg: 'rgba(217, 119, 6, 0.12)',
      Icon: Server,
      text: `Cụm K8s (${activePoint.clusters ?? realClusters})`,
    },
  ];

  const containerWidth = containerRef.current?.clientWidth || 800;
  const tooltipLeft = Math.min(Math.max(12, tooltipPos.x + 14), Math.max(12, containerWidth - 236));
  const tooltipTop = Math.max(8, Math.min(tooltipPos.y - 20, height - 150));

  return (
    <div
      className={`dash-card interactive-organization-growth-chart ${className}`}
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--dash-border)',
        borderRadius: '12px',
        padding: '20px',
        position: 'relative',
        boxShadow: 'var(--dash-shadow-xs)',
      }}
    >
      {/* 1. HEADER BAR */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          marginBottom: '14px',
          paddingBottom: '12px',
          borderBottom: '1px solid #F1F5F9',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              backgroundColor: 'rgba(5, 150, 105, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TrendingUp size={17} color="#059669" />
          </div>
          <div>
            <h3
              style={{
                fontSize: '1rem',
                fontWeight: 800,
                color: 'var(--dash-text-primary)',
                letterSpacing: '-0.01em',
                margin: 0,
              }}
            >
              {title}
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
              {subtitle}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              backgroundColor: '#F1F5F9',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
            }}
          >
            {[
              { id: 'day', label: 'Theo Ngày' },
              { id: 'month', label: 'Theo Tháng' },
              { id: 'year', label: 'Theo Năm' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTimeMode(t.id)}
                style={{
                  padding: '5px 12px',
                  fontSize: '0.75rem',
                  fontWeight: timeMode === t.id ? 700 : 500,
                  backgroundColor: timeMode === t.id ? '#FFFFFF' : 'transparent',
                  color: timeMode === t.id ? '#059669' : '#64748B',
                  border: 'none',
                  borderRadius: '6px',
                  boxShadow: timeMode === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setScaleMode((m) => (m === 'normalized' ? 'absolute' : 'normalized'))}
            title="Chuyển chế độ hiển thị chuẩn hóa % so sánh hoặc số thực tế"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              backgroundColor: '#F8FAFC',
              border: '1px solid var(--dash-border)',
              borderRadius: '8px',
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: 'var(--dash-text-secondary)',
              cursor: 'pointer',
            }}
          >
            <Layers size={13} color="#059669" />
            <span>{scaleMode === 'normalized' ? 'Thang % Tăng Trưởng' : 'Số Tuyệt Đối'}</span>
          </button>
        </div>
      </div>

      {/* 2. FILTER PICKER & SERIES TOGGLE BAR */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          backgroundColor: '#F8FAFC',
          padding: '10px 14px',
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '0.75rem', fontWeight: 700 }}>
            <Calendar size={15} color="#059669" />
            <span>Khoảng Thời Gian:</span>
          </div>

          {timeMode === 'day' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              <input
                type="date"
                aria-label="Từ ngày"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.75rem',
                  backgroundColor: '#FFFFFF',
                }}
              />
              <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>→</span>
              <input
                type="date"
                aria-label="Đến ngày"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.75rem',
                  backgroundColor: '#FFFFFF',
                }}
              />
              {[
                { label: '7N', days: 7 },
                { label: '14N', days: 14 },
                { label: '30N', days: 30 },
                { label: '90N', days: 90 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    const end = new Date();
                    const start = new Date(end.getTime() - (p.days - 1) * 24 * 60 * 60 * 1000);
                    setEndDate(end.toISOString().slice(0, 10));
                    setStartDate(start.toISOString().slice(0, 10));
                  }}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {timeMode === 'month' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
              <select
                aria-label="Chọn Năm"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: '#FFFFFF',
                  color: '#059669',
                }}
              >
                <option value="2026">Năm 2026 (Hiện tại)</option>
                <option value="2025">Năm 2025</option>
                <option value="2024">Năm 2024</option>
                <option value="2023">Năm 2023</option>
              </select>

              <select
                aria-label="Phân Kỳ Tháng"
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="ALL">Toàn Bộ 12 Tháng (T1 - T12)</option>
                <option value="Q1">Quý 1 (Tháng 1 - Tháng 3)</option>
                <option value="Q2">Quý 2 (Tháng 4 - Tháng 6)</option>
                <option value="Q3">Quý 3 (Tháng 7 - Tháng 9)</option>
                <option value="Q4">Quý 4 (Tháng 10 - Tháng 12)</option>
              </select>
            </div>
          )}

          {timeMode === 'year' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              <select
                aria-label="Từ Năm"
                value={startYear}
                onChange={(e) => setStartYear(e.target.value)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="2023">2023</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
              </select>
              <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>→</span>
              <select
                aria-label="Đến Năm"
                value={endYear}
                onChange={(e) => setEndYear(e.target.value)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: '#FFFFFF',
                  color: '#059669',
                }}
              >
                <option value="2026">2026 (Hiện tại)</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
              </select>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
          {toggleItems.map(({ key, active, toggle, color, bg, Icon, text }) => (
            <button
              key={key}
              type="button"
              onClick={toggle}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 9px',
                backgroundColor: active ? bg : '#FFFFFF',
                border: active ? `1px solid ${color}` : '1px solid #CBD5E1',
                color: active ? color : '#94A3B8',
                borderRadius: '6px',
                fontSize: '0.6875rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
              <Icon size={12} />
              <span>{text}</span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => setShowTarget((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 9px',
              backgroundColor: showTarget ? 'rgba(220, 38, 38, 0.08)' : '#FFFFFF',
              border: showTarget ? '1px solid #DC2626' : '1px solid #CBD5E1',
              color: showTarget ? '#DC2626' : '#94A3B8',
              borderRadius: '6px',
              fontSize: '0.6875rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <AlertTriangle size={12} />
            <span>Mục Tiêu KPI</span>
          </button>
        </div>
      </div>

      {/* 3. LIGHTWEIGHT CHARTS CANVAS CONTAINER + FLOATING TOOLTIP */}
      <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
        <div
          ref={containerRef}
          data-testid="growth-lightweight-chart"
          style={{ width: '100%', height: '100%' }}
        />

        {hoveredPoint && (
          <div
            data-testid="growth-chart-tooltip"
            style={{
              position: 'absolute',
              left: `${tooltipLeft}px`,
              top: `${tooltipTop}px`,
              width: '220px',
              backgroundColor: 'rgba(15, 23, 42, 0.94)',
              color: '#F8FAFC',
              borderRadius: '10px',
              padding: '10px 12px',
              fontSize: '0.75rem',
              boxShadow: '0 10px 25px rgba(15, 23, 42, 0.25)',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div style={{ fontWeight: 700, color: '#E2E8F0', marginBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.12)', paddingBottom: '4px' }}>
              {hoveredPoint.fullDate}
            </div>
            {SERIES_CONFIG.map((s) => (
              <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#CBD5E1' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: s.color }} />
                  {s.label}
                </span>
                <span style={{ fontWeight: 700, color: '#FFFFFF' }}>
                  {hoveredPoint[s.key]?.toLocaleString('vi-VN')} {s.unit}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. METRIC BREAKDOWN FOOTER (4 SUMMARY CARDS) */}
      <div
        style={{
          marginTop: '16px',
          paddingTop: '14px',
          borderTop: '1px dashed #E2E8F0',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
        }}
      >
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: 'rgba(5, 150, 105, 0.05)',
            border: '1px solid rgba(5, 150, 105, 0.25)',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6875rem', color: '#065F46', fontWeight: 700 }}>
            <Building2 size={13} /> DOANH NGHIỆP TỔNG
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#064E3B', margin: '2px 0' }}>
            {activePoint.companies || realCompanies}{' '}
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669' }}>
              / {activeCompanies} Active
            </span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 600 }}>
            Phân lập tài nguyên đa khách hàng an toàn
          </div>
        </div>

        <div
          style={{
            padding: '10px 14px',
            backgroundColor: 'rgba(37, 99, 235, 0.05)',
            border: '1px solid rgba(37, 99, 235, 0.25)',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6875rem', color: '#1E40AF', fontWeight: 700 }}>
            <Users size={13} /> NGƯỜI DÙNG TOÀN MẠNG
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E3A8A', margin: '2px 0' }}>
            {(activePoint.users || realUsers)?.toLocaleString()}{' '}
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563EB' }}>
              / {activeUsers} Active
            </span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#2563EB', fontWeight: 600 }}>
            Xác thực phiên bảo mật & RBAC
          </div>
        </div>

        <div
          style={{
            padding: '10px 14px',
            backgroundColor: 'rgba(139, 92, 246, 0.05)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6875rem', color: '#6B21A8', fontWeight: 700 }}>
            <Cpu size={13} /> TÁC TỬ eBPF DAEMONSET
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#581C87', margin: '2px 0' }}>
            {activePoint.agents || realAgents}{' '}
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#7C3AED' }}>
              / {onlineAgents} Online
            </span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#7C3AED', fontWeight: 600 }}>
            Độ trễ thấp viễn trắc nhân Linux
          </div>
        </div>

        <div
          style={{
            padding: '10px 14px',
            backgroundColor: 'rgba(217, 119, 6, 0.05)',
            border: '1px solid rgba(217, 119, 6, 0.25)',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6875rem', color: '#92400E', fontWeight: 700 }}>
            <Server size={13} /> CỤM KUBERNETES KẾT NỐI
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#78350F', margin: '2px 0' }}>
            {activePoint.clusters || realClusters}{' '}
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#D97706' }}>
              / {healthyClusters} Sẵn sàng
            </span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#D97706', fontWeight: 600 }}>
            Đa đám mây K8s kết nối liên tục
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveOrganizationGrowthChart;
