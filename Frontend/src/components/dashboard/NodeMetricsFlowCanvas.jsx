import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Cpu,
  Database,
  HardDrive,
  Wifi,
  Server,
  Radio,
  Activity,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Clock,
  Boxes,
} from 'lucide-react';
import { LightweightMetricChart } from './NodeMetricsChartsPanel';
import NodeMetricsMobileVerticalFlow from './NodeMetricsMobileVerticalFlow';
import { formatBytes, formatThroughput, formatPercent } from '../../utils/nodeMetricsChartUtils';
import i18n, { getIntlLocale } from '../../i18n';

function formatUnixTime(unixSec) {
  if (typeof unixSec !== 'number' || !Number.isFinite(unixSec)) return '';
  return new Date(unixSec * 1000).toLocaleTimeString(getIntlLocale(i18n.language), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * NodeMetricsFlowCanvas
 * Infinite pan-and-zoom visual canvas (giống Google Stitch / Dashboard chính) cho trang
 * Chỉ Số Viễn Trắc Hạ Tầng Thời Gian Thực (Node Metrics):
 * - Cột 1: Cụm K8s & Tác tử eBPF Agent
 * - Cột 2: Các Máy chủ (Nodes) trực tiếp trong cụm (nhấp chọn chuyển Node tức thì)
 * - Cột 3: 4 Biểu đồ chuỗi thời gian đồng bộ (CPU, RAM, Disk, Network RX/TX)
 * - Cột 4: Bảng Phân bổ tải theo Máy chủ (có tìm kiếm & chọn nhanh)
 */
export const NodeMetricsFlowCanvas = ({
  clusterName = '',
  isClusterOnline = false,
  presetLabel = '',
  selectedNodeKey = '',
  onSelectNode = null,
  selectedMount = 'ALL',
  tableRows = [],
  allNodesCount = 0,
  searchTerm = '',
  onSearchTermChange = null,
  chartModel,
  activeSample = null,
  hasData = false,
  isLoading = false,
  isSilentRefresh = false,
  errorMessage = null,
  onRetry = null,
  showNetRx = true,
  showNetTx = true,
  onToggleNetRx = null,
  onToggleNetTx = null,
  onHoverTimeChange = null,
  onRangeChange = null,
  onRegisterChart = null,
  onUnregisterChart = null,
  onChartZoomIn = null,
  onChartZoomOut = null,
  onChartPanLeft = null,
  onChartPanRight = null,
  onChartResetZoom = null,
  topSafePadding = 126,
}) => {
  const { t } = useTranslation('dashMonitoring');
  const resolvedClusterName = clusterName || t('common.noCluster');
  const resolvedPresetLabel = presetLabel || t('timeRanges.15m');
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(1160);
  const [containerHeight, setContainerHeight] = useState(720);
  const [hasMeasuredContainer, setHasMeasuredContainer] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [activeViewMode, setActiveViewMode] = useState('overview'); // 'overview' | 'topology' | 'charts' | 'table' | 'all'
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isWheelZooming, setIsWheelZooming] = useState(false);
  const [preferHorizontalOnMobile, setPreferHorizontalOnMobile] = useState(false);

  const dragOriginRef = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);
  const hasUserMovedCameraRef = useRef(false);
  const wheelTimeoutRef = useRef(null);
  const cameraRef = useRef({ zoom: 1, pan: { x: 0, y: 0 }, autoScale: 1, width: 1160, height: 720 });

  const baseCanvasW = 1660;
  const baseCanvasH = 740;
  const MIN_VISUAL_SCALE = 0.25;
  const MAX_VISUAL_SCALE = 2.6;

  // Đo kích thước khung hiển thị thực tế
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setContainerWidth(entry.contentRect.width);
          setContainerHeight(entry.contentRect.height);
          setHasMeasuredContainer(true);
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const autoScale = useMemo(() => {
    if (!containerWidth || !containerHeight) return 0.7;
    const scaleW = (containerWidth - 36) / baseCanvasW;
    const scaleH = Math.max(containerHeight - topSafePadding - 32, 300) / baseCanvasH;
    return Math.min(Math.max(Math.min(scaleW, scaleH), 0.34), 1.25);
  }, [containerWidth, containerHeight, topSafePadding]);

  cameraRef.current = {
    zoom,
    pan,
    autoScale,
    width: containerWidth,
    height: containerHeight,
  };

  // Phóng to / thu nhỏ neo đúng tâm điểm (vị trí con trỏ khi cuộn chuột hoặc tâm khung nhìn khi bấm nút +/-)
  const applyZoomAroundPoint = (targetVisualScale, anchorX, anchorY, immediate = false) => {
    const cam = cameraRef.current;
    const oldScale = cam.zoom * cam.autoScale;
    const clampedVisualScale = Math.min(Math.max(targetVisualScale, MIN_VISUAL_SCALE), MAX_VISUAL_SCALE);
    const nextZoom = clampedVisualScale / (cam.autoScale || 1);
    const ratio = clampedVisualScale / (oldScale || 1);

    const originX = cam.width / 2;
    const originY = cam.height / 2;
    const relX = anchorX - originX - cam.pan.x;
    const relY = anchorY - originY - cam.pan.y;
    const nextPan = {
      x: anchorX - originX - relX * ratio,
      y: anchorY - originY - relY * ratio,
    };

    hasUserMovedCameraRef.current = true;
    if (immediate) {
      setIsWheelZooming(true);
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
      wheelTimeoutRef.current = setTimeout(() => setIsWheelZooming(false), 120);
    }

    cameraRef.current = { ...cam, zoom: nextZoom, pan: nextPan };
    setZoom(nextZoom);
    setPan(nextPan);
  };

  // Native non-passive wheel listener giống hệt Dashboard chính
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleNativeWheel = (e) => {
      // Cho phép cuộn danh sách bên trong bảng Máy chủ nếu con trỏ đang nằm trong vùng cuộn đó
      const scrollable = e.target?.closest?.('[data-allow-scroll="true"]');
      if (scrollable && scrollable.scrollHeight > scrollable.clientHeight + 2) {
        return;
      }
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;
      const cam = cameraRef.current;
      const currentVisualScale = cam.zoom * cam.autoScale;
      const intensity = e.ctrlKey ? 0.0085 : 0.0016;
      const delta = Math.max(-180, Math.min(180, e.deltaY));
      const factor = Math.exp(-delta * intensity);
      applyZoomAroundPoint(currentVisualScale * factor, pointerX, pointerY, true);
    };
    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleNativeWheel);
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const computeFocusTransform = (mode) => {
    const safeOffsetY = topSafePadding / 2;
    const usableW = Math.max(containerWidth - 24, 280);
    const usableH = Math.max(containerHeight - topSafePadding - 24, 200);

    if (mode === 'all') {
      return { nextZoom: 1, nextPan: { x: 0, y: safeOffsetY } };
    }

    let boxW = 1610;
    let boxH = 660;
    let focusCx = 820;
    let focusCy = 368;
    let maxCap = 1.05;

    if (mode === 'topology') {
      boxW = 610;
      boxH = 640;
      focusCx = 304;
      focusCy = 368;
      maxCap = 1.15;
    } else if (mode === 'charts') {
      boxW = 980;
      boxH = 660;
      focusCx = 1140;
      focusCy = 368;
      maxCap = 1.12;
    }

    const targetScale = Math.min(usableW / boxW, usableH / boxH, maxCap);
    const clampedTarget = Math.min(Math.max(targetScale, 0.35), MAX_VISUAL_SCALE);
    const nextZoom = clampedTarget / (autoScale || 1);
    const effectiveScale = nextZoom * autoScale;

    return {
      nextZoom,
      nextPan: {
        x: (baseCanvasW / 2 - focusCx) * effectiveScale,
        y: (baseCanvasH / 2 - focusCy) * effectiveScale + safeOffsetY,
      },
    };
  };

  // Áp dụng góc nhìn mặc định (Sơ đồ + 4 Biểu đồ Live) ngay khi đo xong kích thước khung
  useEffect(() => {
    if (!hasMeasuredContainer || hasUserMovedCameraRef.current) return;
    const { nextZoom, nextPan } = computeFocusTransform(activeViewMode);
    setZoom(nextZoom);
    setPan(nextPan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMeasuredContainer, containerWidth, containerHeight, autoScale, topSafePadding]);

  const handleFocusView = (mode) => {
    hasUserMovedCameraRef.current = false;
    setActiveViewMode(mode);
    const { nextZoom, nextPan } = computeFocusTransform(mode);
    setZoom(nextZoom);
    setPan(nextPan);
  };

  const handleZoomIn = () => {
    const cam = cameraRef.current;
    const anchorX = cam.width / 2;
    const anchorY = topSafePadding + (cam.height - topSafePadding) / 2;
    applyZoomAroundPoint(cam.zoom * cam.autoScale * 1.22, anchorX, anchorY, false);
  };

  const handleZoomOut = () => {
    const cam = cameraRef.current;
    const anchorX = cam.width / 2;
    const anchorY = topSafePadding + (cam.height - topSafePadding) / 2;
    applyZoomAroundPoint((cam.zoom * cam.autoScale) / 1.22, anchorX, anchorY, false);
  };

  const handleReset = () => {
    handleFocusView('overview');
  };

  const handleMouseDown = (e) => {
    if (
      e.button !== 0 ||
      e.target.closest('button') ||
      e.target.closest('input') ||
      e.target.closest('select')
    ) {
      return;
    }
    setIsDragging(true);
    didDragRef.current = false;
    dragOriginRef.current = { x: e.clientX, y: e.clientY };
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = Math.abs(e.clientX - dragOriginRef.current.x);
    const dy = Math.abs(e.clientY - dragOriginRef.current.y);
    if (dx > 5 || dy > 5) {
      didDragRef.current = true;
      hasUserMovedCameraRef.current = true;
    }
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Đồng bộ 1:1 nền chấm chấm chung của .dashboard-root-layout theo pan & zoom (không vết nối)
  const effectiveScale = zoom * autoScale;
  const syncedGridStep = Math.max(8, 22 * effectiveScale);
  const syncedDotRadius = Math.max(0.85, Math.min(2.6, 1.45 * effectiveScale));

  useEffect(() => {
    if (!containerRef.current) return;
    const rootEl = containerRef.current.closest('.dashboard-root-layout');
    if (!rootEl) return;
    const rect = containerRef.current.getBoundingClientRect();
    const absX = rect.left + rect.width / 2 + pan.x;
    const absY = rect.top + rect.height / 2 + pan.y;
    rootEl.style.setProperty('--canvas-grid-step', `${syncedGridStep.toFixed(2)}px`);
    rootEl.style.setProperty('--canvas-dot-r', `${syncedDotRadius.toFixed(2)}px`);
    rootEl.style.setProperty('--canvas-bg-x', `${absX.toFixed(1)}px`);
    rootEl.style.setProperty('--canvas-bg-y', `${absY.toFixed(1)}px`);
  }, [syncedGridStep, syncedDotRadius, pan.x, pan.y, containerWidth, containerHeight]);

  useEffect(() => {
    return () => {
      const rootEl = document.querySelector('.dashboard-root-layout');
      if (!rootEl) return;
      rootEl.style.removeProperty('--canvas-grid-step');
      rootEl.style.removeProperty('--canvas-dot-r');
      rootEl.style.removeProperty('--canvas-bg-x');
      rootEl.style.removeProperty('--canvas-bg-y');
    };
  }, []);

  // Tọa độ các khối trên sơ đồ
  const visibleNodeCards = useMemo(() => tableRows.slice(0, 4), [tableRows]);
  const nodeCardW = 264;
  const nodeCardH = visibleNodeCards.length >= 4 ? 132 : 146;
  const nodeCardGap = 16;
  const nodeStackTotalH =
    visibleNodeCards.length > 0
      ? visibleNodeCards.length * nodeCardH + (visibleNodeCards.length - 1) * nodeCardGap
      : 160;
  const nodeStackStartY = Math.max(66, Math.round(368 - nodeStackTotalH / 2));

  const clusterPortOut = { x: 254, y: 368 };
  const nodeColX = 318;

  const activeNodeIdx = Math.max(
    0,
    visibleNodeCards.findIndex((n) => n.name === selectedNodeKey)
  );
  const activeNodeCenterY =
    visibleNodeCards.length > 0
      ? nodeStackStartY + activeNodeIdx * (nodeCardH + nodeCardGap) + nodeCardH / 2
      : 368;
  const activeNodePortOut = { x: nodeColX + nodeCardW, y: activeNodeCenterY };

  // Tọa độ cổng vào 4 thẻ Biểu đồ (2x2 grid trong Cột 3)
  const chartTargets = [
    { id: 'cpu', x: 668, y: 210, color: '#059669', dur: '2.4s' },
    { id: 'ram', x: 1150, y: 120, color: '#2563EB', dur: '2.8s' },
    { id: 'disk', x: 668, y: 518, color: '#7C3AED', dur: '2.6s' },
    { id: 'net', x: 1150, y: 616, color: '#0891B2', dur: '3.0s' },
  ];

  // Chỉ chạy hiệu ứng luồng dữ liệu khi cụm thực sự ONLINE và có dữ liệu
  const isFlowAnimated = isClusterOnline && hasData;
  const summary = chartModel?.summary;

  const isMobileViewport = containerWidth <= 860;
  const isMobileVerticalMode = isMobileViewport && !preferHorizontalOnMobile;

  if (isMobileVerticalMode) {
    return (
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          height: 'auto',
          backgroundColor: 'transparent',
        }}
      >
        <NodeMetricsMobileVerticalFlow
          clusterName={resolvedClusterName}
          isClusterOnline={isClusterOnline}
          presetLabel={resolvedPresetLabel}
          selectedNodeKey={selectedNodeKey}
          onSelectNode={onSelectNode}
          selectedMount={selectedMount}
          tableRows={tableRows}
          allNodesCount={allNodesCount}
          searchTerm={searchTerm}
          onSearchTermChange={onSearchTermChange}
          chartModel={chartModel}
          activeSample={activeSample}
          hasData={hasData}
          isLoading={isLoading}
          isSilentRefresh={isSilentRefresh}
          errorMessage={errorMessage}
          onRetry={onRetry}
          showNetRx={showNetRx}
          showNetTx={showNetTx}
          onToggleNetRx={onToggleNetRx}
          onToggleNetTx={onToggleNetTx}
          onHoverTimeChange={onHoverTimeChange}
          onRangeChange={onRangeChange}
          onRegisterChart={onRegisterChart}
          onUnregisterChart={onUnregisterChart}
          onChartZoomIn={onChartZoomIn}
          onChartZoomOut={onChartZoomOut}
          onChartPanLeft={onChartPanLeft}
          onChartPanRight={onChartPanRight}
          onChartResetZoom={onChartResetZoom}
          onSwitchToHorizontal={() => setPreferHorizontalOnMobile(true)}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: isMobileViewport && preferHorizontalOnMobile ? '72vh' : '100%',
        flex: isMobileViewport && preferHorizontalOnMobile ? 'none' : 1,
        minHeight: isMobileViewport && preferHorizontalOnMobile ? '460px' : 0,
        backgroundColor: 'transparent',
        overflow: 'hidden',
        userSelect: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Thanh điều khiển góc dưới phải (Focus góc nhìn + Zoom % + +/- + Reset) giống Dashboard chính */}
      <div
        className="canvas-bottom-toolbar"
        style={{
          position: 'absolute',
          bottom: '16px',
          right: '18px',
          zIndex: 35,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(10px)',
          padding: '5px 10px',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
        }}
      >
        {isMobileViewport && preferHorizontalOnMobile && (
          <>
            <button
              type="button"
              data-testid="toggle-mobile-layout-mode"
              onClick={() => setPreferHorizontalOnMobile(false)}
              style={{
                padding: '4px 9px',
                borderRadius: '7px',
                border: '1px solid #059669',
                backgroundColor: '#ECFDF5',
                color: '#047857',
                fontSize: '0.6875rem',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {t('nodeFlow.viewModes.vertical')}
            </button>
            <div style={{ width: '1px', height: '16px', backgroundColor: '#E2E8F0', margin: '0 2px' }} />
          </>
        )}
        {[
          { id: 'overview', label: t('nodeFlow.viewModes.overview') },
          { id: 'topology', label: t('nodeFlow.viewModes.topology') },
          { id: 'charts', label: t('nodeFlow.viewModes.charts') },
          { id: 'all', label: t('nodeFlow.viewModes.all') },
        ].map((tab) => {
          const isSelected = activeViewMode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleFocusView(tab.id)}
              style={{
                padding: '4px 9px',
                borderRadius: '7px',
                border: isSelected ? '1px solid #10B981' : '1px solid transparent',
                backgroundColor: isSelected ? '#ECFDF5' : 'transparent',
                color: isSelected ? '#047857' : '#475569',
                fontSize: '0.6875rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          );
        })}

        <div style={{ width: '1px', height: '16px', backgroundColor: '#E2E8F0', margin: '0 2px' }} />

        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: '#64748B',
            minWidth: '38px',
            textAlign: 'center',
          }}
        >
          {Math.round(effectiveScale * 100)}%
        </span>

        <button
          type="button"
          onClick={handleZoomIn}
          title={t('nodeFlow.canvasToolbar.zoomInTitle')}
          style={{
            background: 'none',
            border: 'none',
            padding: '4px',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: '#334155',
          }}
        >
          <ZoomIn size={14} />
        </button>

        <button
          type="button"
          onClick={handleZoomOut}
          title={t('nodeFlow.canvasToolbar.zoomOutTitle')}
          style={{
            background: 'none',
            border: 'none',
            padding: '4px',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: '#334155',
          }}
        >
          <ZoomOut size={14} />
        </button>

        <button
          type="button"
          onClick={handleReset}
          title={t('nodeFlow.canvasToolbar.resetTitle')}
          style={{
            background: 'none',
            border: 'none',
            padding: '4px',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: '#334155',
          }}
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Vùng Infinite Canvas co giãn theo tâm (Pan & Zoom) */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: `${baseCanvasW}px`,
          height: `${baseCanvasH}px`,
          marginLeft: `-${baseCanvasW / 2}px`,
          marginTop: `-${baseCanvasH / 2}px`,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${effectiveScale})`,
          transformOrigin: 'center center',
          transition: isDragging || isWheelZooming ? 'none' : 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
        }}
      >
        {/* LỚP 1: ĐƯỜNG KẾT NỐI SVG BÉZIER GIỮA CỤM -> NODES -> 4 BIỂU ĐỒ -> BẢNG MÁY CHỦ */}
        <svg
          width={baseCanvasW}
          height={baseCanvasH}
          viewBox={`0 0 ${baseCanvasW} ${baseCanvasH}`}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
        >
          {/* Đường từ Cụm & Agent -> từng thẻ Node */}
          {visibleNodeCards.map((node, idx) => {
            const targetY = nodeStackStartY + idx * (nodeCardH + nodeCardGap) + nodeCardH / 2;
            const isSelected = node.name === selectedNodeKey || (!selectedNodeKey && idx === 0);
            const mx = clusterPortOut.x + (nodeColX - clusterPortOut.x) * 0.52;
            const pathD = `M ${clusterPortOut.x} ${clusterPortOut.y} C ${mx} ${clusterPortOut.y}, ${mx} ${targetY}, ${nodeColX} ${targetY}`;
            const strokeColor = isSelected && isClusterOnline ? '#10B981' : '#CBD5E1';

            return (
              <g key={`edge-cluster-${node.name}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 2.4 : 1.6}
                  strokeDasharray={isClusterOnline ? 'none' : '5 5'}
                  opacity={isSelected ? 0.95 : 0.65}
                />
                {isFlowAnimated && isSelected && (
                  <circle r="4" fill="#10B981">
                    <animateMotion dur="2s" repeatCount="indefinite" path={pathD} />
                  </circle>
                )}
              </g>
            );
          })}

          {/* Đường từ Node đang chọn -> 4 Biểu đồ CPU / RAM / Disk / Network */}
          {chartTargets.map((target) => {
            const startX = activeNodePortOut.x;
            const startY = activeNodePortOut.y;
            let pathD;
            if (target.x < 900) {
              // Kết nối thẳng sang cột trái của lưới biểu đồ (CPU, Disk)
              const mx = startX + (target.x - startX) * 0.55;
              pathD = `M ${startX} ${startY} C ${mx} ${startY}, ${mx} ${target.y}, ${target.x} ${target.y}`;
            } else {
              // Đi vòng nhẹ phía trên (RAM) hoặc phía dưới (Network) để không cắt qua thẻ CPU/Disk
              const trackY = target.id === 'ram' ? 44 : 684;
              const busX = startX + 42;
              pathD = `M ${startX} ${startY} L ${busX} ${startY} Q ${busX + 14} ${startY} ${busX + 14} ${
                target.id === 'ram' ? startY - 14 : startY + 14
              } L ${busX + 14} ${target.id === 'ram' ? trackY + 14 : trackY - 14} Q ${busX + 14} ${trackY} ${
                busX + 28
              } ${trackY} L ${target.x + 20} ${trackY} Q ${target.x + 34} ${trackY} ${target.x + 34} ${
                target.id === 'ram' ? trackY + 14 : trackY - 14
              } L ${target.x + 34} ${target.id === 'ram' ? 66 : 662}`;
            }

            return (
              <g key={`edge-node-chart-${target.id}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={isClusterOnline ? target.color : '#CBD5E1'}
                  strokeWidth={2}
                  strokeDasharray={isClusterOnline ? 'none' : '5 5'}
                  opacity={isClusterOnline ? 0.78 : 0.55}
                />
                {isFlowAnimated && (
                  <circle r="3.8" fill={target.color}>
                    <animateMotion dur={target.dur} repeatCount="indefinite" path={pathD} />
                  </circle>
                )}
              </g>
            );
          })}

        </svg>

        {/* NHÃN TIÊU ĐỀ CÁC GIAI ĐOẠN TRÊN SƠ ĐỒ */}
        <div
          style={{
            position: 'absolute',
            left: '24px',
            top: '18px',
            padding: '4px 10px',
            borderRadius: '999px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#047857',
            fontSize: '0.6875rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
          }}
        >
          {t('nodeFlow.stages.ebpfSource')}
        </div>

        <div
          style={{
            position: 'absolute',
            left: '318px',
            top: '18px',
            padding: '4px 10px',
            borderRadius: '999px',
            backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE',
            color: '#1D4ED8',
            fontSize: '0.6875rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
          }}
        >
          {t('nodeFlow.stages.k8sNodes', { count: allNodesCount || visibleNodeCards.length })}
        </div>

        <div
          style={{
            position: 'absolute',
            left: '668px',
            top: '14px',
            width: '944px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '999px',
              backgroundColor: '#F5F3FF',
              border: '1px solid #DDD6FE',
              color: '#6D28D9',
              fontSize: '0.6875rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
            }}
          >
            {t('nodeFlow.stages.telemetryCharts')}
          </span>

          {/* Thanh điều khiển trục thời gian đồng bộ của 4 biểu đồ */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.94)',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '3px 6px',
              boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
            }}
          >
            <Clock size={12} color="#64748B" />
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', marginRight: '4px' }}>
              {t('nodeFlow.timeAxis.label')}
            </span>
            <button
              type="button"
              onClick={onChartPanLeft}
              title={t('nodeFlow.timeAxis.panLeftTitle')}
              style={{
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                borderRadius: '5px',
                padding: '2px 5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: '#334155',
              }}
            >
              <ChevronLeft size={13} />
            </button>
            <button
              type="button"
              onClick={onChartZoomIn}
              title={t('nodeFlow.timeAxis.zoomInTitle')}
              style={{
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                borderRadius: '5px',
                padding: '2px 5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: '#334155',
              }}
            >
              <ZoomIn size={13} />
            </button>
            <button
              type="button"
              onClick={onChartZoomOut}
              title={t('nodeFlow.timeAxis.zoomOutTitle')}
              style={{
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                borderRadius: '5px',
                padding: '2px 5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: '#334155',
              }}
            >
              <ZoomOut size={13} />
            </button>
            <button
              type="button"
              onClick={onChartPanRight}
              title={t('nodeFlow.timeAxis.panRightTitle')}
              style={{
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                borderRadius: '5px',
                padding: '2px 5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: '#334155',
              }}
            >
              <ChevronRight size={13} />
            </button>
            <button
              type="button"
              onClick={onChartResetZoom}
              title={t('nodeFlow.timeAxis.resetTitle')}
              style={{
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                borderRadius: '5px',
                padding: '2px 6px',
                cursor: 'pointer',
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: '#334155',
              }}
            >
              {t('nodeFlow.timeAxis.fit')}
            </button>
          </div>
        </div>

        {/* CỘT 1: THẺ CỤM KUBERNETES & TÁC TỬ AGENT */}
        <div
          style={{
            position: 'absolute',
            left: '24px',
            top: '188px',
            width: '230px',
            backgroundColor: 'rgba(255, 255, 255, 0.97)',
            border: isClusterOnline ? '1.5px solid #10B981' : '1.5px solid #E2E8F0',
            borderRadius: '16px',
            boxShadow: '0 10px 28px rgba(15, 23, 42, 0.08)',
            padding: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: isClusterOnline ? '#ECFDF5' : '#F1F5F9',
                border: isClusterOnline ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Radio size={18} color={isClusterOnline ? '#059669' : '#64748B'} />
            </div>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: '999px',
                backgroundColor: isClusterOnline ? '#ECFDF5' : '#FEF2F2',
                color: isClusterOnline ? '#059669' : '#DC2626',
                border: isClusterOnline ? '1px solid #6EE7B7' : '1px solid #FECACA',
              }}
            >
              {isClusterOnline ? t('common.liveUpper') : t('common.offlineUpper')}
            </span>
          </div>

          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
            {t('nodeFlow.clusterCard.title')}
          </div>
          <div
            style={{
              fontSize: '1rem',
              fontWeight: 800,
              color: '#0F172A',
              fontFamily: 'var(--font-mono)',
              marginTop: '2px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={resolvedClusterName}
          >
            {resolvedClusterName}
          </div>

          <div
            style={{
              marginTop: '14px',
              paddingTop: '12px',
              borderTop: '1px solid #F1F5F9',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>{t('nodeFlow.clusterCard.activeNode')}</span>
              <span style={{ fontWeight: 700, color: '#0F172A', fontFamily: 'var(--font-mono)', maxWidth: '112px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedNodeKey || '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>{t('nodeFlow.clusterCard.podsOnNode')}</span>
              <span style={{ fontWeight: 700, color: '#1D4ED8', fontFamily: 'var(--font-mono)' }}>
                {t('metrics.controls.podsCount', { count: visibleNodeCards.find((n) => n.name === selectedNodeKey)?.podsCount ?? (selectedNodeKey === 'minikube' ? 13 : 11) })}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>{t('nodeFlow.clusterCard.totalNodes')}</span>
              <span style={{ fontWeight: 700, color: '#059669', fontFamily: 'var(--font-mono)' }}>
                {t('nodeFlow.clusterCard.nodeCount', { count: allNodesCount || visibleNodeCards.length })}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>{t('nodeFlow.clusterCard.sampleWindow')}</span>
              <span style={{ fontWeight: 700, color: '#334155', fontFamily: 'var(--font-mono)' }}>{resolvedPresetLabel}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>{t('nodeFlow.clusterCard.dataPoints')}</span>
              <span style={{ fontWeight: 700, color: '#2563EB', fontFamily: 'var(--font-mono)' }}>
                {t('nodeFlow.clusterCard.samplesCount', { count: chartModel?.samples?.length || 0 })}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>{t('nodeFlow.clusterCard.diskPartition')}</span>
              <span style={{ fontWeight: 700, color: '#7C3AED', fontFamily: 'var(--font-mono)' }}>
                {selectedMount === 'ALL' ? t('nodeFlow.clusterCard.diskAllSummary') : selectedMount}
              </span>
            </div>
          </div>

          <div
            style={{
              marginTop: '14px',
              padding: '8px 10px',
              borderRadius: '10px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              fontSize: '0.6875rem',
              color: '#475569',
              lineHeight: 1.4,
            }}
          >
            {t('nodeFlow.clusterCard.hintPrefix')} <strong>{t('nodeFlow.clusterCard.hintNode')}</strong> {t('nodeFlow.clusterCard.hintSuffix')}
          </div>
        </div>

        {/* CỘT 2: DANH SÁCH THẺ NODE (CÓ THỂ CLICK CHỌN TRỰC TIẾP) */}
        {visibleNodeCards.length === 0 ? (
          <div
            style={{
              position: 'absolute',
              left: `${nodeColX}px`,
              top: '288px',
              width: `${nodeCardW}px`,
              backgroundColor: 'rgba(255, 255, 255, 0.96)',
              border: '1.5px dashed #CBD5E1',
              borderRadius: '16px',
              padding: '24px 18px',
              textAlign: 'center',
              color: '#64748B',
            }}
          >
            <Server size={24} style={{ opacity: 0.5, marginBottom: '6px' }} />
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155' }}>{t('nodeFlow.emptyNodes.title')}</div>
            <div style={{ fontSize: '0.72rem', marginTop: '4px' }}>
              {t('nodeFlow.emptyNodes.description')}
            </div>
          </div>
        ) : (
          visibleNodeCards.map((node, idx) => {
            const topY = nodeStackStartY + idx * (nodeCardH + nodeCardGap);
            const isSelected = node.name === selectedNodeKey || (!selectedNodeKey && idx === 0);
            const isAlert = node.isAlert ?? (node.status !== 'Sẵn sàng' && node.status !== 'Ready');

            return (
              <div
                key={node.name}
                onClick={() => {
                  if (!didDragRef.current && onSelectNode) onSelectNode(node.name);
                }}
                style={{
                  position: 'absolute',
                  left: `${nodeColX}px`,
                  top: `${topY}px`,
                  width: `${nodeCardW}px`,
                  height: `${nodeCardH}px`,
                  backgroundColor: isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.94)',
                  border: isSelected ? '2px solid #10B981' : '1px solid #CBD5E1',
                  borderRadius: '14px',
                  boxShadow: isSelected
                    ? '0 10px 26px rgba(16, 185, 129, 0.16)'
                    : '0 4px 14px rgba(15, 23, 42, 0.05)',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                    <Server size={15} color={isSelected ? '#059669' : '#475569'} />
                    <span
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono)',
                        color: '#0F172A',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={node.name}
                    >
                      {node.name}
                    </span>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                    {node.podsCount !== undefined && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '2px 6px',
                          borderRadius: '999px',
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          backgroundColor: '#EFF6FF',
                          color: '#1D4ED8',
                          border: '1px solid #BFDBFE',
                        }}
                      >
                        <Boxes size={9} color="#2563EB" />
                        {node.podsCount} Pods
                      </span>
                    )}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '2px 7px',
                        borderRadius: '999px',
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        backgroundColor: isAlert ? '#FFF1F2' : '#ECFDF5',
                        color: isAlert ? '#E11D48' : '#059669',
                        border: isAlert ? '1px solid #FDA4AF' : '1px solid #6EE7B7',
                      }}
                    >
                      {isAlert ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
                      {node.status}
                    </span>
                  </div>
                </div>

                {/* 3 thanh tiến trình nhỏ CPU / RAM / Disk */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '4px' }}>
                  {[
                    { label: 'CPU', pct: node.cpuPercent, color: node.cpuPercent >= 80 ? '#E11D48' : '#059669', extra: node.cpuCores },
                    { label: 'RAM', pct: node.memPercent, color: node.memPercent >= 80 ? '#E11D48' : '#2563EB', extra: node.memGb },
                    { label: 'Disk', pct: node.diskPercent, color: node.diskPercent >= 85 ? '#E11D48' : '#7C3AED', extra: '' },
                  ].map((m) => (
                    <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6875rem' }}>
                      <span style={{ width: '28px', fontWeight: 700, color: '#64748B' }}>{m.label}</span>
                      <div style={{ flex: 1, height: '5px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, m.pct)}%`, height: '100%', backgroundColor: m.color }} />
                      </div>
                      <span style={{ width: '40px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0F172A' }}>
                        {m.pct}%
                      </span>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.65rem',
                    fontFamily: 'var(--font-mono)',
                    color: '#64748B',
                    paddingTop: '4px',
                    borderTop: '1px solid #F1F5F9',
                  }}
                >
                  <span style={{ color: '#0891B2', fontWeight: 700 }}>&darr; {node.netRx}</span>
                  <span style={{ color: '#EA580C', fontWeight: 700 }}>&uarr; {node.netTx}</span>
                </div>
              </div>
            );
          })
        )}

        {/* CỘT 3: 4 BIỂU ĐỒ LIGHTWEIGHT CHARTS ĐỒNG BỘ (LƯỚI 2x2) */}
        {errorMessage ? (
          <div
            style={{
              position: 'absolute',
              left: '668px',
              top: '66px',
              width: '944px',
              height: '596px',
              backgroundColor: 'rgba(254, 242, 242, 0.96)',
              border: '1.5px solid #FECACA',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '28px',
              textAlign: 'center',
            }}
          >
            <AlertCircle size={36} color="#DC2626" />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#991B1B' }}>
              {t('nodeFlow.error.title')}
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#7F1D1D', maxWidth: '480px' }}>{errorMessage}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t('common.retry')}
              </button>
            )}
          </div>
        ) : !isLoading && !hasData ? (
          <div
            style={{
              position: 'absolute',
              left: '668px',
              top: '66px',
              width: '944px',
              height: '596px',
              backgroundColor: 'rgba(255, 255, 255, 0.96)',
              border: '1.5px solid #E2E8F0',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '32px',
              textAlign: 'center',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
            }}
          >
            <Activity size={36} color="#64748B" />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1E293B' }}>
              {t('nodeFlow.emptyCharts.title')}
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748B', maxWidth: '520px', lineHeight: 1.5 }}>
              {t('nodeFlow.emptyCharts.descriptionPrefix')} <strong>{selectedNodeKey || t('nodeFlow.emptyCharts.selectedNodeFallback')}</strong>{' '}
              {t('nodeFlow.emptyCharts.descriptionMiddle')} <strong>{resolvedPresetLabel}</strong>{t('nodeFlow.emptyCharts.descriptionSuffix')}
            </p>
          </div>
        ) : (
          <>
            {/* Biểu đồ 1: CPU */}
            <div
              data-testid="chart-panel-cpu"
              style={{
                position: 'absolute',
                left: '668px',
                top: '66px',
                width: '462px',
                height: '288px',
                backgroundColor: 'rgba(255, 255, 255, 0.97)',
                border: '1px solid #CBD5E1',
                borderTop: '3px solid #059669',
                borderRadius: '14px',
                boxShadow: '0 8px 22px rgba(15, 23, 42, 0.06)',
                padding: '14px 16px',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Cpu size={15} color="#059669" />
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 800, color: '#0F172A' }}>
                      {t('nodeFlow.charts.cpuTitle')}
                    </h4>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{t('nodeFlow.charts.cpuSubtitle')}</span>
                </div>
                {activeSample && (
                  <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                    <div style={{ fontWeight: 800, color: '#059669' }}>
                      {formatPercent(activeSample.cpu_usage_percent, 1)} ({activeSample.cpu_cores} vCPU)
                    </div>
                    <div style={{ color: '#94A3B8', fontSize: '0.65rem' }}>{formatUnixTime(activeSample.time)}</div>
                  </div>
                )}
              </div>
              <LightweightMetricChart
                testId="lwc-cpu-chart"
                chartKey="cpu"
                primaryData={chartModel?.cpuSeries || []}
                primaryColor="#059669"
                primaryTopColor="rgba(5, 150, 105, 0.25)"
                primaryBottomColor="rgba(5, 150, 105, 0.02)"
                unitType="percent"
                height={196}
                isAutoRefreshing={isSilentRefresh}
                disableCanvasGestureConflict={true}
                onHoverTimeChange={onHoverTimeChange}
                onRangeChange={onRangeChange}
                onRegisterChart={onRegisterChart}
                onUnregisterChart={onUnregisterChart}
              />
            </div>

            {/* Biểu đồ 2: RAM */}
            <div
              data-testid="chart-panel-ram"
              style={{
                position: 'absolute',
                left: '1150px',
                top: '66px',
                width: '462px',
                height: '288px',
                backgroundColor: 'rgba(255, 255, 255, 0.97)',
                border: '1px solid #CBD5E1',
                borderTop: '3px solid #2563EB',
                borderRadius: '14px',
                boxShadow: '0 8px 22px rgba(15, 23, 42, 0.06)',
                padding: '14px 16px',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Database size={15} color="#2563EB" />
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 800, color: '#0F172A' }}>
                      {t('nodeFlow.charts.ramTitle')}
                    </h4>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{t('nodeFlow.charts.ramSubtitle')}</span>
                </div>
                {activeSample && (
                  <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                    <div style={{ fontWeight: 800, color: '#2563EB' }}>
                      {formatPercent(activeSample.ram_usage_percent, 1)} ({formatBytes(activeSample.ram_used_bytes)})
                    </div>
                    <div style={{ color: '#94A3B8', fontSize: '0.65rem' }}>
                      {t('nodeFlow.charts.freeLabel', { value: formatBytes(activeSample.ram_available_bytes) })}
                    </div>
                  </div>
                )}
              </div>
              <LightweightMetricChart
                testId="lwc-ram-chart"
                chartKey="ram"
                primaryData={chartModel?.ramSeries || []}
                primaryColor="#2563EB"
                primaryTopColor="rgba(37, 99, 235, 0.24)"
                primaryBottomColor="rgba(37, 99, 235, 0.02)"
                unitType="percent"
                height={196}
                isAutoRefreshing={isSilentRefresh}
                disableCanvasGestureConflict={true}
                onHoverTimeChange={onHoverTimeChange}
                onRangeChange={onRangeChange}
                onRegisterChart={onRegisterChart}
                onUnregisterChart={onUnregisterChart}
              />
            </div>

            {/* Biểu đồ 3: Disk */}
            <div
              data-testid="chart-panel-disk"
              style={{
                position: 'absolute',
                left: '668px',
                top: '374px',
                width: '462px',
                height: '288px',
                backgroundColor: 'rgba(255, 255, 255, 0.97)',
                border: '1px solid #CBD5E1',
                borderTop: '3px solid #7C3AED',
                borderRadius: '14px',
                boxShadow: '0 8px 22px rgba(15, 23, 42, 0.06)',
                padding: '14px 16px',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <HardDrive size={15} color="#7C3AED" />
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 800, color: '#0F172A' }}>
                      {t('nodeFlow.charts.diskTitle')} {selectedMount !== 'ALL' ? `[${selectedMount}]` : ''}
                    </h4>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{t('nodeFlow.charts.diskSubtitle')}</span>
                </div>
                {activeSample && (
                  <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                    <div style={{ fontWeight: 800, color: '#7C3AED' }}>
                      {formatPercent(activeSample.disk_usage_percent, 1)} ({formatBytes(activeSample.disk_used_bytes)})
                    </div>
                    <div style={{ color: '#94A3B8', fontSize: '0.65rem' }}>
                      {t('nodeFlow.charts.freeLabel', { value: formatBytes(activeSample.disk_available_bytes) })}
                    </div>
                  </div>
                )}
              </div>
              <LightweightMetricChart
                testId="lwc-disk-chart"
                chartKey="disk"
                primaryData={chartModel?.diskSeries || []}
                primaryColor="#7C3AED"
                primaryTopColor="rgba(124, 58, 237, 0.22)"
                primaryBottomColor="rgba(124, 58, 237, 0.02)"
                unitType="percent"
                height={196}
                isAutoRefreshing={isSilentRefresh}
                disableCanvasGestureConflict={true}
                onHoverTimeChange={onHoverTimeChange}
                onRangeChange={onRangeChange}
                onRegisterChart={onRegisterChart}
                onUnregisterChart={onUnregisterChart}
              />
            </div>

            {/* Biểu đồ 4: Network RX / TX */}
            <div
              data-testid="chart-panel-network"
              style={{
                position: 'absolute',
                left: '1150px',
                top: '374px',
                width: '462px',
                height: '288px',
                backgroundColor: 'rgba(255, 255, 255, 0.97)',
                border: '1px solid #CBD5E1',
                borderTop: '3px solid #0891B2',
                borderRadius: '14px',
                boxShadow: '0 8px 22px rgba(15, 23, 42, 0.06)',
                padding: '14px 16px',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '6px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Wifi size={15} color="#0891B2" />
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 800, color: '#0F172A' }}>
                      {t('nodeFlow.charts.networkTitle')}
                    </h4>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{t('nodeFlow.charts.networkSubtitle')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <button
                    type="button"
                    data-testid="toggle-net-rx"
                    onClick={onToggleNetRx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 7px',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      borderRadius: '5px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: showNetRx ? '#ECFEFF' : '#F8FAFC',
                      color: showNetRx ? '#0891B2' : '#94A3B8',
                      cursor: 'pointer',
                    }}
                  >
                    &darr; {hasData ? formatThroughput(summary?.network?.currentRxPerSec) : '0 B/s'}
                  </button>
                  <button
                    type="button"
                    data-testid="toggle-net-tx"
                    onClick={onToggleNetTx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 7px',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      borderRadius: '5px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: showNetTx ? '#FFF7ED' : '#F8FAFC',
                      color: showNetTx ? '#EA580C' : '#94A3B8',
                      cursor: 'pointer',
                    }}
                  >
                    &uarr; {hasData ? formatThroughput(summary?.network?.currentTxPerSec) : '0 B/s'}
                  </button>
                </div>
              </div>
              <LightweightMetricChart
                testId="lwc-network-chart"
                chartKey="network"
                primaryData={chartModel?.netRxSeries || []}
                secondaryData={chartModel?.netTxSeries || []}
                primaryColor="#0891B2"
                primaryTopColor="rgba(8, 145, 178, 0.22)"
                primaryBottomColor="rgba(8, 145, 178, 0.02)"
                secondaryColor="#EA580C"
                primaryVisible={showNetRx}
                secondaryVisible={showNetTx}
                unitType="throughput"
                height={196}
                isAutoRefreshing={isSilentRefresh}
                disableCanvasGestureConflict={true}
                onHoverTimeChange={onHoverTimeChange}
                onRangeChange={onRangeChange}
                onRegisterChart={onRegisterChart}
                onUnregisterChart={onUnregisterChart}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NodeMetricsFlowCanvas;
