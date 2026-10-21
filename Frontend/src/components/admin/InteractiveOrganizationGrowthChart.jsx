import React, { useState, useMemo, useRef } from 'react';
import {
  TrendingUp,
  Building2,
  Users,
  Cpu,
  Server,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

/**
 * InteractiveOrganizationGrowthChart
 * Biểu đồ biến thiên động hỗ trợ cả 4 trụ cột hệ thống SelfAI:
 * 1. Doanh Nghiệp (Companies)
 * 2. Người Dùng (Users)
 * 3. Tác Tử eBPF (Agents)
 * 4. Cụm Kubernetes (Clusters)
 *
 * Hỗ trợ chọn thời gian tự do không bị cố định:
 * - Theo Ngày: Cho phép chọn khoảng ngày từ Date Picker HTML5 (Từ ngày -> Đến ngày) hoặc phím tắt (7N, 14N, 30N, 90N)
 * - Theo Tháng: Cho phép chọn Năm cụ thể (2026, 2025, 2024...) và các quý / khoảng tháng
 * - Theo Năm: Cho phép chọn khoảng dải năm tùy ý (Từ năm ... Đến năm ...)
 */
export const InteractiveOrganizationGrowthChart = ({
  title = 'Biến thiên Tăng Trưởng Toàn Nền Tảng (Platform Growth Dynamics)',
  subtitle = 'Thống kê viễn trắc đa chiều: Doanh nghiệp, Người dùng, Tác tử eBPF và Cụm K8s theo thời gian',
  className = '',
  height = 280,
}) => {
  // Mode: 'day' | 'month' | 'year'
  const [timeMode, setTimeMode] = useState('month');

  // Series Toggles: 4 Core Entities + KPI Target
  const [showCompanies, setShowCompanies] = useState(true);
  const [showUsers, setShowUsers] = useState(true);
  const [showAgents, setShowAgents] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const [showTarget, setShowTarget] = useState(true);

  // View mode: 'normalized' (tỷ lệ % tăng trưởng) | 'absolute' (số thực tế)
  const [scaleMode, setScaleMode] = useState('normalized'); // 'normalized' | 'absolute'

  // --- Date Picker States for 'day' mode ---
  // Default: last 30 days up to 2026-10-22
  const [startDate, setStartDate] = useState('2026-09-22');
  const [endDate, setEndDate] = useState('2026-10-22');

  // --- States for 'month' mode ---
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedQuarter, setSelectedQuarter] = useState('ALL'); // 'ALL' | 'Q1' | 'Q2' | 'Q3' | 'Q4'

  // --- States for 'year' mode ---
  const [startYear, setStartYear] = useState('2021');
  const [endYear, setEndYear] = useState('2026');

  // Hover state for interactive crosshair & tooltip
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

  // --- Generate dynamic dataset based on user picker filters ---
  const dataset = useMemo(() => {
    // 1. DAY MODE: Generate daily points between startDate and endDate
    if (timeMode === 'day') {
      const start = new Date(startDate || '2026-09-22');
      const end = new Date(endDate || '2026-10-22');

      // Safeguard: Ensure valid range
      let diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays < 1) diffDays = 1;
      if (diffDays > 365) diffDays = 365;

      const points = [];
      const baseCompanies = 68;
      const baseUsers = 1120;
      const baseAgents = 98;
      const baseClusters = 26;

      for (let i = 0; i <= diffDays; i++) {
        const currentDate = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
        const dayStr = currentDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
        const fullDateStr = currentDate.toLocaleDateString('vi-VN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });

        const progress = i / diffDays;
        // Non-linear realistic growth increments
        const compInc = Math.floor(progress * 18 + Math.sin(i * 0.4) * 1.5);
        const userInc = Math.floor(progress * 300 + Math.sin(i * 0.5) * 25);
        const agentInc = Math.floor(progress * 30 + Math.cos(i * 0.3) * 2);
        const clusterInc = Math.floor(progress * 8 + Math.sin(i * 0.2) * 1);

        points.push({
          label: dayStr,
          fullDate: `Ngày ${fullDateStr}`,
          companies: Math.max(baseCompanies, Math.min(86, baseCompanies + compInc)),
          users: Math.max(baseUsers, Math.min(1420, baseUsers + userInc)),
          agents: Math.max(baseAgents, Math.min(128, baseAgents + agentInc)),
          clusters: Math.max(baseClusters, Math.min(34, baseClusters + clusterInc)),
          newCompanies: i % 2 === 0 ? 1 : 0,
          newUsers: Math.floor(10 + Math.sin(i) * 5),
        });
      }

      return {
        points,
        periodLabel: `Từ ${start.toLocaleDateString('vi-VN')} đến ${end.toLocaleDateString('vi-VN')} (${points.length} Ngày)`,
        targetLine: 82,
        targetText: 'NGƯỠNG MỤC TIÊU 80 COMPANY',
      };
    }

    // 2. MONTH MODE: Generate 12 months (or filtered quarter) of selectedYear
    if (timeMode === 'month') {
      const year = parseInt(selectedYear, 10) || 2026;
      let monthRange = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

      if (selectedQuarter === 'Q1') monthRange = [1, 2, 3];
      else if (selectedQuarter === 'Q2') monthRange = [4, 5, 6];
      else if (selectedQuarter === 'Q3') monthRange = [7, 8, 9];
      else if (selectedQuarter === 'Q4') monthRange = [10, 11, 12];

      // Growth profiles based on selected year
      const yearMultiplier = year === 2026 ? 1 : year === 2025 ? 0.75 : year === 2024 ? 0.52 : 0.35;

      const points = monthRange.map((m) => {
        const mStr = m < 10 ? `0${m}` : `${m}`;
        const ratio = m / 12;

        const companies = Math.round((35 + ratio * 51) * yearMultiplier);
        const users = Math.round((550 + ratio * 870) * yearMultiplier);
        const agents = Math.round((45 + ratio * 83) * yearMultiplier);
        const clusters = Math.round((12 + ratio * 22) * yearMultiplier);

        return {
          label: `T${mStr}/${String(year).slice(-2)}`,
          fullDate: `Tháng ${mStr}/${year}`,
          companies: Math.max(1, companies),
          users: Math.max(10, users),
          agents: Math.max(1, agents),
          clusters: Math.max(1, clusters),
          newCompanies: Math.round(2 + ratio * 3),
          newUsers: Math.round(40 + ratio * 60),
        };
      });

      return {
        points,
        periodLabel: `Năm ${year} ${selectedQuarter !== 'ALL' ? `• ${selectedQuarter}` : '• Toàn bộ 12 Tháng'}`,
        targetLine: 80,
        targetText: `MỤC TIÊU NĂM ${year}: 80 COMPANY`,
      };
    }

    // 3. YEAR MODE: Generate years from startYear to endYear
    const sYear = parseInt(startYear, 10) || 2021;
    const eYear = parseInt(endYear, 10) || 2026;
    const points = [];

    const historicalMap = {
      2020: { companies: 8, users: 120, agents: 10, clusters: 4 },
      2021: { companies: 18, users: 280, agents: 24, clusters: 7 },
      2022: { companies: 32, users: 510, agents: 46, clusters: 14 },
      2023: { companies: 52, users: 840, agents: 78, clusters: 21 },
      2024: { companies: 69, users: 1120, agents: 102, clusters: 27 },
      2025: { companies: 78, users: 1290, agents: 116, clusters: 31 },
      2026: { companies: 86, users: 1420, agents: 128, clusters: 34 },
    };

    for (let y = sYear; y <= eYear; y++) {
      const data = historicalMap[y] || {
        companies: Math.round(18 + (y - 2021) * 14),
        users: Math.round(280 + (y - 2021) * 230),
        agents: Math.round(24 + (y - 2021) * 21),
        clusters: Math.round(7 + (y - 2021) * 5),
      };

      points.push({
        label: `${y}`,
        fullDate: `Năm ${y}`,
        companies: data.companies,
        users: data.users,
        agents: data.agents,
        clusters: data.clusters,
        newCompanies: Math.round(data.companies * 0.25),
        newUsers: Math.round(data.users * 0.3),
      });
    }

    return {
      points,
      periodLabel: `Khoảng năm: ${sYear} - ${eYear} (${points.length} Năm)`,
      targetLine: 75,
      targetText: 'KẾ HOẠCH NĂM 2026: 80+ ORGS',
    };
  }, [timeMode, startDate, endDate, selectedYear, selectedQuarter, startYear, endYear]);

  const points = dataset.points;

  // Chart dimensions
  const padding = { top: 25, right: 30, bottom: 35, left: 45 };
  const width = 800;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate maximum values for normalization
  const maxValues = useMemo(() => {
    const maxComp = Math.max(...points.map((p) => p.companies), 1);
    const maxUsr = Math.max(...points.map((p) => p.users), 1);
    const maxAgt = Math.max(...points.map((p) => p.agents), 1);
    const maxCls = Math.max(...points.map((p) => p.clusters), 1);
    return { maxComp, maxUsr, maxAgt, maxCls };
  }, [points]);

  // Coordinates
  const getX = (index) => padding.left + (index / Math.max(1, points.length - 1)) * chartWidth;

  // Map each series value to SVG Y position (0% - 100% relative height)
  const getYCompanies = (val) => {
    const ratio = scaleMode === 'normalized' ? val / maxValues.maxComp : val / 100;
    return padding.top + chartHeight - Math.min(1, Math.max(0, ratio)) * chartHeight;
  };

  const getYUsers = (val) => {
    const ratio = scaleMode === 'normalized' ? val / maxValues.maxUsr : val / 1500;
    return padding.top + chartHeight - Math.min(1, Math.max(0, ratio)) * chartHeight;
  };

  const getYAgents = (val) => {
    const ratio = scaleMode === 'normalized' ? val / maxValues.maxAgt : val / 150;
    return padding.top + chartHeight - Math.min(1, Math.max(0, ratio)) * chartHeight;
  };

  const getYClusters = (val) => {
    const ratio = scaleMode === 'normalized' ? val / maxValues.maxCls : val / 40;
    return padding.top + chartHeight - Math.min(1, Math.max(0, ratio)) * chartHeight;
  };

  // SVG polylines & areas
  const compPoints = points.map((d, i) => `${getX(i)},${getYCompanies(d.companies)}`).join(' ');
  const userPoints = points.map((d, i) => `${getX(i)},${getYUsers(d.users)}`).join(' ');
  const agentPoints = points.map((d, i) => `${getX(i)},${getYAgents(d.agents)}`).join(' ');
  const clusterPoints = points.map((d, i) => `${getX(i)},${getYClusters(d.clusters)}`).join(' ');

  const compArea = `${getX(0)},${getYCompanies(0)} ${compPoints} ${getX(points.length - 1)},${getYCompanies(0)}`;
  const userArea = `${getX(0)},${getYUsers(0)} ${userPoints} ${getX(points.length - 1)},${getYUsers(0)}`;

  // Handle Mouse Move for vertical crosshair
  const handleMouseMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const relativeX = (mouseX / rect.width) * width;

    if (relativeX < padding.left || relativeX > width - padding.right) {
      setHoverIndex(null);
      return;
    }

    const ratio = (relativeX - padding.left) / chartWidth;
    const idx = Math.round(ratio * (points.length - 1));
    setHoverIndex(Math.max(0, Math.min(points.length - 1, idx)));
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const activePoint = hoverIndex !== null ? points[hoverIndex] : points[points.length - 1] || {};

  return (
    <div
      className={`interactive-organization-growth-chart ${className}`}
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--dash-border)',
        borderRadius: '12px',
        padding: '20px',
        position: 'relative',
        boxShadow: 'var(--dash-shadow-xs)',
      }}
    >
      {/* 1. HEADER BAR: Title, Subtitle, Time Range Modes & Scale Switcher */}
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
        <div>
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
              <p
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--dash-text-secondary)',
                  margin: '2px 0 0 0',
                }}
              >
                {subtitle} &bull; <strong style={{ color: '#059669' }}>{dataset.periodLabel}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Top-Right: Mode Tabs & Scale Toggle */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          {/* Main Time Tabs: Theo Ngày / Theo Tháng / Theo Năm */}
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

          {/* Scale mode: Normalized % vs Counts */}
          <button
            type="button"
            onClick={() => setScaleMode(scaleMode === 'normalized' ? 'absolute' : 'normalized')}
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

      {/* 2. DYNAMIC DATE / FILTER PICKER BAR */}
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
        {/* Dynamic Controls depending on 'day', 'month', or 'year' */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '0.75rem', fontWeight: 700 }}>
            <Calendar size={15} color="#059669" />
            <span>Khoảng Thời Gian:</span>
          </div>

          {/* CASE 1: THEO NGÀY -> DATE RANGE PICKER HTML5 */}
          {timeMode === 'day' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>Từ:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.75rem',
                    fontFamily: 'inherit',
                    backgroundColor: '#FFFFFF',
                    color: 'var(--dash-text-primary)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>Đến:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.75rem',
                    fontFamily: 'inherit',
                    backgroundColor: '#FFFFFF',
                    color: 'var(--dash-text-primary)',
                  }}
                />
              </div>

              {/* Quick shortcut pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
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
                      const end = new Date('2026-10-22');
                      const start = new Date(end.getTime() - (p.days - 1) * 24 * 60 * 60 * 1000);
                      setEndDate('2026-10-22');
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
            </div>
          )}

          {/* CASE 2: THEO THÁNG -> SELECT YEAR & QUARTER PICKER */}
          {timeMode === 'month' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>Chọn Năm:</span>
                <select
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
                  <option value="2022">Năm 2022</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>Phân Kỳ Tháng:</span>
                <select
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
            </div>
          )}

          {/* CASE 3: THEO NĂM -> SELECT RANGE OF YEARS */}
          {timeMode === 'year' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>Từ Năm:</span>
                <select
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
                  <option value="2020">2020</option>
                  <option value="2021">2021</option>
                  <option value="2022">2022</option>
                  <option value="2023">2023</option>
                  <option value="2024">2024</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>Đến Năm:</span>
                <select
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
            </div>
          )}
        </div>

        {/* 4 CORE ENTITY TOGGLES (SERIES SWITCHES) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
          {/* Series 1: Company */}
          <button
            type="button"
            onClick={() => setShowCompanies(!showCompanies)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 9px',
              backgroundColor: showCompanies ? 'rgba(5, 150, 105, 0.12)' : '#FFFFFF',
              border: showCompanies ? '1px solid #059669' : '1px solid #CBD5E1',
              color: showCompanies ? '#059669' : '#94A3B8',
              borderRadius: '6px',
              fontSize: '0.6875rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#059669' }} />
            <Building2 size={12} />
            <span>Doanh Nghiệp ({activePoint.companies || 86})</span>
          </button>

          {/* Series 2: Users */}
          <button
            type="button"
            onClick={() => setShowUsers(!showUsers)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 9px',
              backgroundColor: showUsers ? 'rgba(37, 99, 235, 0.12)' : '#FFFFFF',
              border: showUsers ? '1px solid #2563EB' : '1px solid #CBD5E1',
              color: showUsers ? '#2563EB' : '#94A3B8',
              borderRadius: '6px',
              fontSize: '0.6875rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2563EB' }} />
            <Users size={12} />
            <span>Người Dùng ({activePoint.users?.toLocaleString() || '1,420'})</span>
          </button>

          {/* Series 3: Agents */}
          <button
            type="button"
            onClick={() => setShowAgents(!showAgents)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 9px',
              backgroundColor: showAgents ? 'rgba(139, 92, 246, 0.12)' : '#FFFFFF',
              border: showAgents ? '1px solid #8B5CF6' : '1px solid #CBD5E1',
              color: showAgents ? '#7C3AED' : '#94A3B8',
              borderRadius: '6px',
              fontSize: '0.6875rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#8B5CF6' }} />
            <Cpu size={12} />
            <span>Agent eBPF ({activePoint.agents || 128})</span>
          </button>

          {/* Series 4: Clusters */}
          <button
            type="button"
            onClick={() => setShowClusters(!showClusters)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 9px',
              backgroundColor: showClusters ? 'rgba(217, 119, 6, 0.12)' : '#FFFFFF',
              border: showClusters ? '1px solid #D97706' : '1px solid #CBD5E1',
              color: showClusters ? '#D97706' : '#94A3B8',
              borderRadius: '6px',
              fontSize: '0.6875rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#D97706' }} />
            <Server size={12} />
            <span>Cụm K8s ({activePoint.clusters || 34})</span>
          </button>

          {/* Target Threshold */}
          <button
            type="button"
            onClick={() => setShowTarget(!showTarget)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 9px',
              backgroundColor: showTarget ? '#FEF2F2' : '#FFFFFF',
              border: showTarget ? '1px solid #F87171' : '1px solid #CBD5E1',
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

      {/* 3. SVG CHART AREA WITH CROSSHAIR & TOOLTIP */}
      <div
        style={{ width: '100%', position: 'relative', cursor: 'crosshair', userSelect: 'none' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        >
          <defs>
            {/* Emerald Gradient for Companies */}
            <linearGradient id="multiCompGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
            </linearGradient>

            {/* Blue Gradient for Users */}
            <linearGradient id="multiUserGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines (0, 25, 50, 75, 100%) */}
          {[0, 25, 50, 75, 100].map((val) => {
            const y = padding.top + chartHeight - (val / 100) * chartHeight;
            return (
              <g key={val}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke={val === 0 ? '#CBD5E1' : '#F1F5F9'}
                  strokeWidth="1"
                  strokeDasharray={val === 0 ? 'none' : '3 3'}
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontFamily="monospace"
                  fontSize="10"
                  fill="#94A3B8"
                >
                  {scaleMode === 'normalized' ? `${val}%` : val}
                </text>
              </g>
            );
          })}

          {/* KPI Target Reference Line */}
          {showTarget && (
            <g>
              <line
                x1={padding.left}
                y1={padding.top + chartHeight - (dataset.targetLine / 100) * chartHeight}
                x2={width - padding.right}
                y2={padding.top + chartHeight - (dataset.targetLine / 100) * chartHeight}
                stroke="#DC2626"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                strokeOpacity="0.85"
              />
              <rect
                x={width - padding.right - 170}
                y={padding.top + chartHeight - (dataset.targetLine / 100) * chartHeight - 10}
                width="170"
                height="20"
                rx="4"
                fill="#FEF2F2"
                stroke="#FECACA"
                strokeWidth="1"
              />
              <text
                x={width - padding.right - 85}
                y={padding.top + chartHeight - (dataset.targetLine / 100) * chartHeight + 4}
                textAnchor="middle"
                fontFamily="monospace"
                fontSize="9"
                fontWeight="700"
                fill="#B91C1C"
              >
                {dataset.targetText}
              </text>
            </g>
          )}

          {/* SERIES 1: COMPANIES (Emerald Area + Line) */}
          {showCompanies && (
            <>
              <polygon points={compArea} fill="url(#multiCompGrad)" />
              <polyline
                fill="none"
                stroke="#059669"
                strokeWidth="2.5"
                points={compPoints}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* SERIES 2: USERS (Blue Area + Line) */}
          {showUsers && (
            <>
              <polygon points={userArea} fill="url(#multiUserGrad)" />
              <polyline
                fill="none"
                stroke="#2563EB"
                strokeWidth="2.2"
                points={userPoints}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* SERIES 3: AGENTS (Violet Line) */}
          {showAgents && (
            <polyline
              fill="none"
              stroke="#8B5CF6"
              strokeWidth="2.2"
              points={agentPoints}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={scaleMode === 'normalized' ? 'none' : '4 2'}
            />
          )}

          {/* SERIES 4: CLUSTERS (Amber Line) */}
          {showClusters && (
            <polyline
              fill="none"
              stroke="#D97706"
              strokeWidth="2.2"
              points={clusterPoints}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* X Axis Time Labels */}
          {points.map((d, i) => {
            // Label density handling
            const shouldShow =
              points.length <= 15
                ? true
                : points.length <= 31
                ? i % 3 === 0 || i === points.length - 1
                : i % Math.ceil(points.length / 10) === 0 || i === points.length - 1;

            if (!shouldShow) return null;

            return (
              <text
                key={i}
                x={getX(i)}
                y={height - 10}
                textAnchor="middle"
                fontFamily="monospace"
                fontSize="10"
                fill="#64748B"
              >
                {d.label}
              </text>
            );
          })}

          {/* Crosshair indicator when hovering */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={padding.top}
                x2={getX(hoverIndex)}
                y2={height - padding.bottom}
                stroke="#0F172A"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
              {showCompanies && (
                <circle
                  cx={getX(hoverIndex)}
                  cy={getYCompanies(activePoint.companies)}
                  r="5"
                  fill="#FFFFFF"
                  stroke="#059669"
                  strokeWidth="2.5"
                />
              )}
              {showUsers && (
                <circle
                  cx={getX(hoverIndex)}
                  cy={getYUsers(activePoint.users)}
                  r="5"
                  fill="#FFFFFF"
                  stroke="#2563EB"
                  strokeWidth="2.5"
                />
              )}
              {showAgents && (
                <circle
                  cx={getX(hoverIndex)}
                  cy={getYAgents(activePoint.agents)}
                  r="4.5"
                  fill="#FFFFFF"
                  stroke="#8B5CF6"
                  strokeWidth="2.5"
                />
              )}
              {showClusters && (
                <circle
                  cx={getX(hoverIndex)}
                  cy={getYClusters(activePoint.clusters)}
                  r="4.5"
                  fill="#FFFFFF"
                  stroke="#D97706"
                  strokeWidth="2.5"
                />
              )}
            </g>
          )}
        </svg>

        {/* Floating Tooltip Box (HTML Overlay for crisp typography) */}
        {hoverIndex !== null && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: `${Math.min(Math.max((getX(hoverIndex) / width) * 100, 18), 72)}%`,
              transform: 'translateX(-50%)',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              padding: '12px 16px',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              pointerEvents: 'none',
              zIndex: 30,
              minWidth: '240px',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6875rem',
                color: '#94A3B8',
                marginBottom: '8px',
                borderBottom: '1px solid rgba(255,255,255,0.12)',
                paddingBottom: '4px',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>MỐC THỜI GIAN:</span>
              <strong style={{ color: '#F8FAFC' }}>{activePoint.fullDate}</strong>
            </div>

            {/* 1. Companies */}
            {showCompanies && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  marginBottom: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34D399' }}>
                  <Building2 size={13} />
                  <span>Doanh Nghiệp:</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 800, color: '#34D399' }}>{activePoint.companies} Công ty</span>
                </div>
              </div>
            )}

            {/* 2. Users */}
            {showUsers && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  marginBottom: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#60A5FA' }}>
                  <Users size={13} />
                  <span>Người Dùng:</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 800, color: '#60A5FA' }}>
                    {activePoint.users?.toLocaleString()} Users
                  </span>
                </div>
              </div>
            )}

            {/* 3. Agents */}
            {showAgents && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  marginBottom: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#C084FC' }}>
                  <Cpu size={13} />
                  <span>Tác Tử eBPF:</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 800, color: '#C084FC' }}>{activePoint.agents} Tác tử</span>
                </div>
              </div>
            )}

            {/* 4. Clusters */}
            {showClusters && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  marginBottom: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FBBF24' }}>
                  <Server size={13} />
                  <span>Cụm K8s:</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 800, color: '#FBBF24' }}>{activePoint.clusters} Cụm</span>
                </div>
              </div>
            )}

            {/* Status evaluation */}
            <div
              style={{
                marginTop: '8px',
                paddingTop: '6px',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.625rem',
                display: 'flex',
                justifyContent: 'space-between',
                color: '#34D399',
              }}
            >
              <span>TIẾN ĐỘ VẬN HÀNH:</span>
              <span style={{ fontWeight: 700 }}>100% SẴN SÀNG</span>
            </div>
          </div>
        )}
      </div>

      {/* 4. METRIC BREAKDOWN FOOTER (4 SUMMARY CARDS FOR ALL 4 CORE PILLARS) */}
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
        {/* Card 1: Companies */}
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
            {activePoint.companies || 86} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669' }}>/ 82 Active</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 600 }}>
            Tăng trưởng: +18.4% trong chu kỳ
          </div>
        </div>

        {/* Card 2: Users */}
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
            {activePoint.users?.toLocaleString() || '1,420'}{' '}
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563EB' }}>/ 1,385 Active</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#2563EB', fontWeight: 600 }}>
            Phiên hoạt động: 94.2% ổn định
          </div>
        </div>

        {/* Card 3: Agents */}
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
            {activePoint.agents || 128}{' '}
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#7C3AED' }}>/ 122 Online</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#7C3AED', fontWeight: 600 }}>
            Độ trễ trung bình: 1.1ms
          </div>
        </div>

        {/* Card 4: Clusters */}
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: 'rgba(217, 119, 6, 0.05)',
            border: '1px solid rgba(217, 119, 6, 0.25)',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6875rem', color: '#92400E', fontWeight: 700 }}>
            <Server size={13} /> CỤM KUBERNETES TOÀN CẦU
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#78350F', margin: '2px 0' }}>
            {activePoint.clusters || 34}{' '}
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#D97706' }}>/ 31 Khỏe mạnh</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#D97706', fontWeight: 600 }}>
            Phủ sóng: 6 Vùng địa lý
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveOrganizationGrowthChart;
