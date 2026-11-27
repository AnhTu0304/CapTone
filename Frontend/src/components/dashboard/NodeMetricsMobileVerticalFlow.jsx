import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Database,
  HardDrive,
  Layers,
  Radio,
  Search,
  Server,
  Wifi,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { LightweightMetricChart } from './NodeMetricsChartsPanel';
import { formatThroughput, formatPercent } from '../../utils/nodeMetricsChartUtils';
import i18n, { getIntlLocale } from '../../i18n';

function formatUnixTime(unixSec) {
  if (typeof unixSec !== 'number' || !Number.isFinite(unixSec)) return '';
  return new Date(unixSec * 1000).toLocaleTimeString(getIntlLocale(i18n.language), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const StageArrow = ({ active = false, color = '#94A3B8', label = '' }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3px 0',
      gap: '2px',
    }}
  >
    <div style={{ width: '2px', height: '10px', borderLeft: `2px ${active ? 'solid' : 'dashed'} ${color}` }} />
    {label ? (
      <span
        style={{
          fontSize: '0.625rem',
          fontWeight: 700,
          color,
          backgroundColor: '#FFFFFF',
          border: `1px solid ${color}40`,
          borderRadius: '999px',
          padding: '1px 8px',
        }}
      >
        {label}
      </span>
    ) : null}
    <ArrowDown size={14} color={color} />
  </div>
);

/**
 * NodeMetricsMobileVerticalFlow
 * Bố cục dọc tối ưu cho điện thoại (<= 860px hoặc .device-mode-mobile):
 * 01 Cụm K8s & eBPF -> 02 Máy chủ Nodes -> 03 4 Biểu đồ Viễn trắc + Trục thời gian -> 04 Bảng tải Node.
 */
export const NodeMetricsMobileVerticalFlow = ({
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
  onSwitchToHorizontal = null,
}) => {
  const { t } = useTranslation('dashMonitoring');
  const resolvedClusterName = clusterName || t('common.noCluster');
  const resolvedPresetLabel = presetLabel || t('timeRanges.15m');
  const summary = chartModel?.summary;
  const visibleNodes = tableRows.slice(0, 6);
  const selectedNodeRow = tableRows.find((n) => n.name === selectedNodeKey);

  return (
    <div
      data-testid="node-metrics-mobile-vertical"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '8px 10px 28px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Thanh đầu trang Mobile + Nút chuyển Sơ đồ ngang */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          border: '1px solid #CBD5E1',
          borderRadius: '12px',
          padding: '8px 10px',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>
            {t('nodeFlow.mobile.title')}
          </span>
        </div>
        <button
          type="button"
          data-testid="toggle-mobile-layout-mode"
          onClick={onSwitchToHorizontal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 9px',
            borderRadius: '7px',
            border: '1px solid #CBD5E1',
            backgroundColor: '#F8FAFC',
            color: '#334155',
            fontSize: '0.6875rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Layers size={12} />
          <span>{t('nodeFlow.mobile.switchHorizontal')}</span>
        </button>
      </div>

      {/* BƯỚC 01: CỤM KUBERNETES & eBPF AGENT */}
      <section
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.97)',
          border: isClusterOnline ? '1.5px solid #10B981' : '1.5px solid #CBD5E1',
          borderRadius: '14px',
          padding: '12px',
          boxShadow: '0 6px 18px rgba(15, 23, 42, 0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', gap: '8px' }}>
          <span
            style={{
              padding: '3px 9px',
              borderRadius: '999px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              color: '#047857',
              fontSize: '0.6875rem',
              fontWeight: 800,
            }}
          >
            {t('nodeFlow.stages.ebpfSource')}
          </span>
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px',
              backgroundColor: isClusterOnline ? '#ECFDF5' : '#FEF2F2',
              color: isClusterOnline ? '#059669' : '#DC2626',
              border: isClusterOnline ? '1px solid #6EE7B7' : '1px solid #FECACA',
            }}
          >
            {isClusterOnline ? t('common.liveUpper') : t('common.offlineUpper')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              backgroundColor: isClusterOnline ? '#ECFDF5' : '#F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Radio size={16} color={isClusterOnline ? '#059669' : '#64748B'} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              {t('nodeFlow.clusterCard.title')}
            </div>
            <div
              style={{
                fontSize: '0.95rem',
                fontWeight: 800,
                color: '#0F172A',
                fontFamily: 'var(--font-mono)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {resolvedClusterName}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px', fontSize: '0.72rem' }}>
          <div style={{ padding: '6px 8px', borderRadius: '8px', backgroundColor: '#F8FAFC' }}>
            <span style={{ color: '#64748B', display: 'block', fontSize: '0.65rem' }}>{t('nodeFlow.clusterCard.activeNode')}</span>
            <strong style={{ color: '#0F172A', fontFamily: 'var(--font-mono)' }}>{selectedNodeKey || '—'}</strong>
          </div>
          <div style={{ padding: '6px 8px', borderRadius: '8px', backgroundColor: '#F8FAFC' }}>
            <span style={{ color: '#64748B', display: 'block', fontSize: '0.65rem' }}>{t('nodeFlow.clusterCard.podsOnNode')}</span>
            <strong style={{ color: '#1D4ED8', fontFamily: 'var(--font-mono)' }}>
              {t('metrics.controls.podsCount', { count: selectedNodeRow?.podsCount ?? (selectedNodeKey === 'minikube' ? 13 : 11) })}
            </strong>
          </div>
          <div style={{ padding: '6px 8px', borderRadius: '8px', backgroundColor: '#F8FAFC' }}>
            <span style={{ color: '#64748B', display: 'block', fontSize: '0.65rem' }}>{t('nodeFlow.clusterCard.totalNodes')}</span>
            <strong style={{ color: '#059669', fontFamily: 'var(--font-mono)' }}>
              {t('nodeFlow.clusterCard.nodeCount', { count: allNodesCount || tableRows.length })}
            </strong>
          </div>
          <div style={{ padding: '6px 8px', borderRadius: '8px', backgroundColor: '#F8FAFC' }}>
            <span style={{ color: '#64748B', display: 'block', fontSize: '0.65rem' }}>{t('nodeFlow.clusterCard.windowSamples')}</span>
            <strong style={{ color: '#334155', fontFamily: 'var(--font-mono)' }}>
              {resolvedPresetLabel} • {chartModel?.samples?.length || 0}
            </strong>
          </div>
        </div>
      </section>

      <StageArrow active={isClusterOnline && visibleNodes.length > 0} color={isClusterOnline ? '#10B981' : '#94A3B8'} label={t('nodeFlow.mobile.arrowCollect')} />

      {/* BƯỚC 02: MÁY CHỦ K8S (CHẠM ĐỂ CHỌN NODE) */}
      <section
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.97)',
          border: '1.5px solid #BFDBFE',
          borderRadius: '14px',
          padding: '12px',
          boxShadow: '0 6px 18px rgba(15, 23, 42, 0.05)',
        }}
      >
        <div style={{ marginBottom: '10px' }}>
          <span
            style={{
              padding: '3px 9px',
              borderRadius: '999px',
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              color: '#1D4ED8',
              fontSize: '0.6875rem',
              fontWeight: 800,
            }}
          >
            {t('nodeFlow.stages.k8sNodes', { count: tableRows.length })}
          </span>
        </div>

        {visibleNodes.length === 0 ? (
          <div
            style={{
              border: '1.5px dashed #CBD5E1',
              borderRadius: '12px',
              padding: '18px 12px',
              textAlign: 'center',
              color: '#64748B',
            }}
          >
            <Server size={24} color="#94A3B8" style={{ margin: '0 auto 6px' }} />
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>{t('nodeFlow.emptyNodes.title')}</div>
            <div style={{ fontSize: '0.72rem', marginTop: '3px' }}>
              {t('nodeFlow.emptyNodes.description')}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {visibleNodes.map((node, idx) => {
              const isSelected = node.name === selectedNodeKey || (!selectedNodeKey && idx === 0);
              const isAlert = node.isAlert ?? (node.status !== 'Sẵn sàng' && node.status !== 'Ready');
              return (
                <button
                  key={node.name}
                  type="button"
                  data-testid={`mobile-node-card-${node.name}`}
                  onClick={() => onSelectNode && onSelectNode(node.name)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    backgroundColor: isSelected ? '#F0FDF4' : '#F8FAFC',
                    border: isSelected ? '2px solid #10B981' : '1px solid #E2E8F0',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <Server size={14} color={isSelected ? '#059669' : '#475569'} />
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          fontFamily: 'var(--font-mono)',
                          color: '#0F172A',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {node.name}
                      </span>
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
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
                            backgroundColor: '#EFF6FF',
                            color: '#1D4ED8',
                          }}
                        >
                          <Boxes size={9} />
                          {t('metrics.controls.podsCount', { count: node.podsCount })}
                        </span>
                      )}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '2px 6px',
                          borderRadius: '999px',
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          backgroundColor: isAlert ? '#FFF1F2' : '#ECFDF5',
                          color: isAlert ? '#E11D48' : '#059669',
                        }}
                      >
                        {isAlert ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
                        {node.status}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px', fontSize: '0.68rem', fontFamily: 'var(--font-mono)' }}>
                    <span>CPU: <strong>{node.cpuPercent}%</strong></span>
                    <span>RAM: <strong>{node.memPercent}%</strong></span>
                    <span>Disk: <strong>{node.diskPercent}%</strong></span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <StageArrow active={hasData} color={hasData ? '#7C3AED' : '#94A3B8'} label={t('nodeFlow.mobile.arrowCharts')} />

      {/* BƯỚC 03: 4 BIỂU ĐỒ VIỄN TRẮC ĐỒNG BỘ */}
      <section
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.97)',
          border: '1.5px solid #DDD6FE',
          borderRadius: '14px',
          padding: '12px',
          boxShadow: '0 6px 18px rgba(15, 23, 42, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span
            style={{
              alignSelf: 'flex-start',
              padding: '3px 9px',
              borderRadius: '999px',
              backgroundColor: '#F5F3FF',
              border: '1px solid #DDD6FE',
              color: '#6D28D9',
              fontSize: '0.6875rem',
              fontWeight: 800,
            }}
          >
            {t('nodeFlow.stages.telemetryCharts')}
          </span>

          {/* Thanh điều khiển Trục thời gian */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '4px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '9px',
              padding: '5px 8px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} color="#64748B" />
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569' }}>{t('nodeFlow.timeAxis.label')}</span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <button type="button" onClick={onChartPanLeft} title={t('nodeFlow.timeAxis.panLeftTitle')} style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', borderRadius: '5px', padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#334155' }}>
                <ChevronLeft size={13} />
              </button>
              <button type="button" onClick={onChartZoomIn} title={t('nodeFlow.timeAxis.zoomInTitle')} style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', borderRadius: '5px', padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#334155' }}>
                <ZoomIn size={13} />
              </button>
              <button type="button" onClick={onChartZoomOut} title={t('nodeFlow.timeAxis.zoomOutTitle')} style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', borderRadius: '5px', padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#334155' }}>
                <ZoomOut size={13} />
              </button>
              <button type="button" onClick={onChartPanRight} title={t('nodeFlow.timeAxis.panRightTitle')} style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', borderRadius: '5px', padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#334155' }}>
                <ChevronRight size={13} />
              </button>
              <button type="button" onClick={onChartResetZoom} title={t('nodeFlow.timeAxis.resetTitle')} style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', borderRadius: '5px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 700, color: '#334155' }}>
                {t('nodeFlow.timeAxis.fit')}
              </button>
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div
            style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '12px',
              padding: '20px 14px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={28} color="#DC2626" />
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#991B1B' }}>{t('nodeFlow.error.title')}</div>
            <div style={{ fontSize: '0.78rem', color: '#7F1D1D' }}>{errorMessage}</div>
            {onRetry && (
              <button type="button" onClick={onRetry} style={{ padding: '6px 14px', backgroundColor: '#DC2626', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                {t('common.retry')}
              </button>
            )}
          </div>
        ) : !isLoading && !hasData ? (
          <div
            style={{
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '22px 14px',
              textAlign: 'center',
            }}
          >
            <Activity size={28} color="#64748B" style={{ margin: '0 auto 6px' }} />
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1E293B' }}>
              {t('nodeFlow.emptyCharts.title')}
            </div>
            <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '4px', lineHeight: 1.45 }}>
              {t('nodeFlow.emptyCharts.mobileNoSamplesPrefix')} <strong>{selectedNodeKey || t('nodeFlow.emptyCharts.selectedNodeMobileFallback')}</strong> {t('nodeFlow.emptyCharts.mobileNoSamplesMiddle')} <strong>{resolvedPresetLabel}</strong>.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* CPU */}
            <div data-testid="chart-panel-cpu" style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderTop: '3px solid #059669', borderRadius: '12px', padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cpu size={14} color="#059669" />
                  <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>{t('nodeFlow.charts.cpuTitle')}</h4>
                </div>
                {activeSample && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 800, color: '#059669' }}>
                    {formatPercent(activeSample.cpu_usage_percent, 1)} • {formatUnixTime(activeSample.time)}
                  </span>
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
                height={180}
                isAutoRefreshing={isSilentRefresh}
                disableCanvasGestureConflict={true}
                onHoverTimeChange={onHoverTimeChange}
                onRangeChange={onRangeChange}
                onRegisterChart={onRegisterChart}
                onUnregisterChart={onUnregisterChart}
              />
            </div>

            {/* RAM */}
            <div data-testid="chart-panel-ram" style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderTop: '3px solid #2563EB', borderRadius: '12px', padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Database size={14} color="#2563EB" />
                  <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>{t('nodeFlow.charts.ramTitle')}</h4>
                </div>
                {activeSample && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 800, color: '#2563EB' }}>
                    {formatPercent(activeSample.ram_usage_percent, 1)}
                  </span>
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
                height={180}
                isAutoRefreshing={isSilentRefresh}
                disableCanvasGestureConflict={true}
                onHoverTimeChange={onHoverTimeChange}
                onRangeChange={onRangeChange}
                onRegisterChart={onRegisterChart}
                onUnregisterChart={onUnregisterChart}
              />
            </div>

            {/* Disk */}
            <div data-testid="chart-panel-disk" style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderTop: '3px solid #7C3AED', borderRadius: '12px', padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HardDrive size={14} color="#7C3AED" />
                  <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>
                    {t('nodeFlow.charts.diskTitle')} {selectedMount !== 'ALL' ? `[${selectedMount}]` : ''}
                  </h4>
                </div>
                {activeSample && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 800, color: '#7C3AED' }}>
                    {formatPercent(activeSample.disk_usage_percent, 1)}
                  </span>
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
                height={180}
                isAutoRefreshing={isSilentRefresh}
                disableCanvasGestureConflict={true}
                onHoverTimeChange={onHoverTimeChange}
                onRangeChange={onRangeChange}
                onRegisterChart={onRegisterChart}
                onUnregisterChart={onUnregisterChart}
              />
            </div>

            {/* Network */}
            <div data-testid="chart-panel-network" style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderTop: '3px solid #0891B2', borderRadius: '12px', padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '6px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wifi size={14} color="#0891B2" />
                  <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>{t('nodeFlow.charts.networkTitle')}</h4>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <button
                    type="button"
                    data-testid="toggle-net-rx"
                    onClick={onToggleNetRx}
                    style={{
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
                height={180}
                isAutoRefreshing={isSilentRefresh}
                disableCanvasGestureConflict={true}
                onHoverTimeChange={onHoverTimeChange}
                onRangeChange={onRangeChange}
                onRegisterChart={onRegisterChart}
                onUnregisterChart={onUnregisterChart}
              />
            </div>
          </div>
        )}
      </section>

      {/* BƯỚC 04: BẢNG PHÂN BỔ TẢI THEO NODE (CÓ TÌM KIẾM) */}
      {(tableRows.length > 0 || searchTerm) && (
        <>
          <StageArrow active={tableRows.length > 0} color="#64748B" label={t('nodeFlow.mobile.arrowTable')} />
          <section
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.97)',
              border: '1px solid #CBD5E1',
              borderRadius: '14px',
              padding: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>
                {t('nodeFlow.stages.nodeLoadTable')}
              </span>
              {onSearchTermChange && (
                <div style={{ position: 'relative', flex: '1 1 160px', maxWidth: '220px' }}>
                  <Search size={12} color="#94A3B8" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => onSearchTermChange(e.target.value)}
                    placeholder={t('nodeFlow.mobile.searchPlaceholder')}
                    style={{
                      width: '100%',
                      padding: '4px 8px 4px 26px',
                      fontSize: '0.72rem',
                      borderRadius: '7px',
                      border: '1px solid #CBD5E1',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', textAlign: 'left' }}>
                    <th style={{ padding: '6px 4px' }}>{t('nodeFlow.mobile.colNode')}</th>
                    <th style={{ padding: '6px 4px', textAlign: 'right' }}>{t('nodeFlow.mobile.colCpu')}</th>
                    <th style={{ padding: '6px 4px', textAlign: 'right' }}>{t('nodeFlow.mobile.colRam')}</th>
                    <th style={{ padding: '6px 4px', textAlign: 'right' }}>{t('nodeFlow.mobile.colDisk')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => {
                    const selected = row.name === selectedNodeKey;
                    return (
                      <tr
                        key={row.name}
                        onClick={() => onSelectNode && onSelectNode(row.name)}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          backgroundColor: selected ? '#ECFDF5' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <td style={{ padding: '7px 4px', fontWeight: 700, color: '#0F172A' }}>{row.name}</td>
                        <td style={{ padding: '7px 4px', textAlign: 'right', color: '#059669' }}>{row.cpuPercent}%</td>
                        <td style={{ padding: '7px 4px', textAlign: 'right', color: '#2563EB' }}>{row.memPercent}%</td>
                        <td style={{ padding: '7px 4px', textAlign: 'right', color: '#7C3AED' }}>{row.diskPercent}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default NodeMetricsMobileVerticalFlow;
