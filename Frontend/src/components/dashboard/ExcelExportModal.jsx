import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getIntlLocale } from '../../i18n';
import {
  X,
  FileSpreadsheet,
  Check,
  TrendingUp,
  BarChart2,
  PieChart,
  ShieldAlert,
  Users,
  Grid,
  AlertOctagon,
  Activity,
  Server,
  Layers,
  Image as ImageIcon,
  Download,
  Sparkles,
} from 'lucide-react';
import { REPORT_EXCEL_SECTIONS } from '../../utils/reportExcelExport';

const SECTION_ICONS = {
  kpi_summary: Layers,
  sla_trend: TrendingUp,
  action_trend: BarChart2,
  incident_type: PieChart,
  incident_severity: ShieldAlert,
  actor_breakdown: Users,
  error_action_matrix: Grid,
  failure_reasons: AlertOctagon,
  action_history: Activity,
  service_sla: Server,
};

const PRESETS = [
  {
    id: 'ALL',
    labelKey: 'excelModal.presets.ALL',
    ids: REPORT_EXCEL_SECTIONS.map((s) => s.id),
  },
  {
    id: 'CHARTS_ONLY',
    labelKey: 'excelModal.presets.CHARTS_ONLY',
    ids: [
      'sla_trend',
      'action_trend',
      'incident_type',
      'incident_severity',
      'actor_breakdown',
      'error_action_matrix',
      'failure_reasons',
    ],
  },
  {
    id: 'ACTION_DEEPDIVE',
    labelKey: 'excelModal.presets.ACTION_DEEPDIVE',
    ids: [
      'kpi_summary',
      'action_trend',
      'actor_breakdown',
      'error_action_matrix',
      'failure_reasons',
      'action_history',
    ],
  },
  {
    id: 'SLA_EXEC',
    labelKey: 'excelModal.presets.SLA_EXEC',
    ids: ['kpi_summary', 'sla_trend', 'incident_type', 'incident_severity', 'service_sla'],
  },
  {
    id: 'NONE',
    labelKey: 'excelModal.presets.NONE',
    ids: [],
  },
];

export const ExcelExportModal = ({
  isOpen,
  onClose,
  onConfirmExport,
  meta = {},
  counts = {},
  isExporting = false,
}) => {
  const { t, i18n } = useTranslation('dashAdmin');
  const intlLocale = getIntlLocale(i18n.language);

  const defaultSelected = useMemo(
    () => REPORT_EXCEL_SECTIONS.map((s) => s.id),
    []
  );

  const [selectedIds, setSelectedIds] = useState(defaultSelected);
  const [includeChartImages, setIncludeChartImages] = useState(true);
  const [actionScopeMode, setActionScopeMode] = useState('CURRENT_PAGE'); // 'CURRENT_PAGE' | 'UP_TO_500'
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    if (isOpen) {
      const orgSlug = (meta.orgName || 'sme')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const tr = (meta.timeRange || '1M').toLowerCase();
      setFileName(`bao-cao-sla-${orgSlug || 'doanh-nghiep'}-${tr}.xlsx`);
    }
  }, [isOpen, meta.orgName, meta.timeRange]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isExporting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExporting, onClose]);

  if (!isOpen) return null;

  const toggleSection = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const getCountLabel = (id) => {
    switch (id) {
      case 'kpi_summary':
        return t('excelModal.counts.kpi_summary');
      case 'sla_trend':
        return t('excelModal.counts.sla_trend', { count: counts.slaTrendPoints ?? 0 });
      case 'action_trend':
        return t('excelModal.counts.action_trend', { count: counts.actionTrendPoints ?? 0 });
      case 'incident_type':
        return t('excelModal.counts.incident_type', { count: counts.incidentTypesCount ?? 0 });
      case 'incident_severity':
        return t('excelModal.counts.incident_severity');
      case 'actor_breakdown':
        return t('excelModal.counts.actor_breakdown', { count: counts.actorsCount ?? 0 });
      case 'error_action_matrix':
        return t('excelModal.counts.error_action_matrix', { count: counts.matrixCellsCount ?? 0 });
      case 'failure_reasons':
        return t('excelModal.counts.failure_reasons', { count: counts.failureReasonsCount ?? 0 });
      case 'action_history':
        return t('excelModal.counts.action_history', {
          count: (counts.totalMatchedActions ?? counts.currentActionRows ?? 0).toLocaleString(intlLocale),
        });
      case 'service_sla':
        return t('excelModal.counts.service_sla', { count: counts.servicesCount ?? 0 });
      default:
        return '';
    }
  };

  const chartSections = REPORT_EXCEL_SECTIONS.filter((s) => s.group === 'CHARTS');
  const tableSections = REPORT_EXCEL_SECTIONS.filter((s) => s.group === 'TABLES');
  const isActionTableSelected = selectedIds.includes('action_history');

  const handleConfirm = () => {
    if (selectedIds.length === 0 || isExporting) return;
    onConfirmExport({
      selectedSections: selectedIds,
      includeChartImages,
      actionScopeMode,
      fileName: fileName.trim() || 'bao-cao-sla-bieu-do.xlsx',
    });
  };

  const renderCard = (sec) => {
    const isChecked = selectedIds.includes(sec.id);
    const Icon = SECTION_ICONS[sec.id] || BarChart2;
    const secBadge = t(`excelModal.sections.${sec.id}.badge`, { defaultValue: sec.badge });
    const secTitle = t(`excelModal.sections.${sec.id}.title`, { defaultValue: sec.title });
    const secDesc = t(`excelModal.sections.${sec.id}.description`, { defaultValue: sec.description });

    return (
      <button
        key={sec.id}
        type="button"
        role="checkbox"
        aria-checked={isChecked}
        data-section-id={sec.id}
        onClick={() => toggleSection(sec.id)}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '11px',
          padding: '12px 13px',
          borderRadius: '11px',
          border: isChecked ? '1.5px solid #059669' : '1px solid #E2E8F0',
          backgroundColor: isChecked ? '#F0FDF4' : '#FFFFFF',
          textAlign: 'left',
          cursor: 'pointer',
          transition: 'all 0.14s ease',
          width: '100%',
        }}
      >
        <div
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '6px',
            border: isChecked ? '1.5px solid #059669' : '1.5px solid #CBD5E1',
            backgroundColor: isChecked ? '#059669' : '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '2px',
          }}
        >
          {isChecked && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon size={14} color={isChecked ? '#047857' : '#2563EB'} />
              <span
                style={{
                  fontSize: '0.675rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '5px',
                  backgroundColor: isChecked ? '#DCFCE7' : '#EFF6FF',
                  color: isChecked ? '#047857' : '#1D4ED8',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {secBadge}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              {sec.supportsImage && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    color: '#0284C7',
                    backgroundColor: '#E0F2FE',
                    padding: '1px 5px',
                    borderRadius: '4px',
                  }}
                >
                  <ImageIcon size={10} />
                  <span>{t('excelModal.imageAndTable')}</span>
                </span>
              )}
              <span
                style={{
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  color: '#475569',
                  backgroundColor: '#F1F5F9',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {getCountLabel(sec.id)}
              </span>
            </div>
          </div>

          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', marginTop: '5px', lineHeight: 1.3 }}>
            {secTitle}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '3px', lineHeight: 1.35 }}>
            {secDesc}
          </div>
          <div style={{ fontSize: '0.64rem', color: '#94A3B8', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
            {t('excelModal.sheetPrefix')} {sec.sheetName}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div
      className="no-print"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isExporting) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="excel-export-modal-title"
        style={{
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          border: '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#DCFCE7',
                border: '1px solid #A7F3D0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileSpreadsheet size={20} color="#059669" />
            </div>
            <div>
              <h2
                id="excel-export-modal-title"
                style={{ fontSize: '1.08rem', fontWeight: 800, color: '#0F172A', margin: 0 }}
              >
                {t('excelModal.title')}
              </h2>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '3px 0 0 0' }}>
                {meta.orgName || t('excelModal.orgFallback')} · {t('excelModal.subtitlePrefix')}{' '}
                <strong>{meta.scopeLabel || t('excelModal.scopeFallback')}</strong> · {t('excelModal.subtitlePeriod')}{' '}
                <strong>{meta.timeRangeLabel || t('excelModal.periodFallback')}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => !isExporting && onClose()}
            aria-label={t('excelModal.closeAria')}
            style={{
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              color: '#64748B',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Presets Bar */}
        <div
          style={{
            padding: '12px 22px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            backgroundColor: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
              <Sparkles size={13} color="#059669" />
              {t('excelModal.quickSelect')}
            </span>
            {PRESETS.map((preset) => {
              const isExactMatch =
                preset.ids.length === selectedIds.length &&
                preset.ids.every((id) => selectedIds.includes(id));

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedIds(preset.ids)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '999px',
                    border: isExactMatch ? '1px solid #059669' : '1px solid #E2E8F0',
                    backgroundColor: isExactMatch ? '#ECFDF5' : '#F8FAFC',
                    color: isExactMatch ? '#047857' : '#334155',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {t(preset.labelKey)}
                </button>
              );
            })}
          </div>

          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              color: selectedIds.length > 0 ? '#059669' : '#DC2626',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {t('excelModal.selectedCount', { selected: selectedIds.length, total: REPORT_EXCEL_SECTIONS.length })}
          </span>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '16px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
              {t('excelModal.groupCharts')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
              {chartSections.map(renderCard)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
              {t('excelModal.groupTables')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
              {tableSections.map(renderCard)}
            </div>
          </div>

          {/* Options */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#F8FAFC',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#0F172A' }}>
              <input
                type="checkbox"
                checked={includeChartImages}
                onChange={(e) => setIncludeChartImages(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#059669' }}
              />
              <span>{t('excelModal.includeImagesLabel')}</span>
            </label>

            {isActionTableSelected && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', paddingLeft: '25px', fontSize: '0.76rem', color: '#334155' }}>
                <span style={{ fontWeight: 700 }}>{t('excelModal.actionScopeLabel')}</span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="actionScopeMode"
                    value="CURRENT_PAGE"
                    checked={actionScopeMode === 'CURRENT_PAGE'}
                    onChange={() => setActionScopeMode('CURRENT_PAGE')}
                    style={{ accentColor: '#059669' }}
                  />
                  <span>{t('excelModal.currentPageScope', { count: counts.currentActionRows ?? 0 })}</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="actionScopeMode"
                    value="UP_TO_500"
                    checked={actionScopeMode === 'UP_TO_500'}
                    onChange={() => setActionScopeMode('UP_TO_500')}
                    style={{ accentColor: '#059669' }}
                  />
                  <span>
                    {t('excelModal.upTo500Scope', {
                      count: (counts.totalMatchedActions ?? 0).toLocaleString(intlLocale),
                    })}
                  </span>
                </label>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <label htmlFor="excel-filename-input" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                {t('excelModal.fileNameLabel')}
              </label>
              <input
                id="excel-filename-input"
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: '240px',
                  padding: '6px 10px',
                  borderRadius: '7px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-mono)',
                  backgroundColor: '#FFFFFF',
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: selectedIds.length === 0 ? '#DC2626' : '#475569', fontWeight: 600 }}>
            {selectedIds.length === 0
              ? t('excelModal.footerEmptyError')
              : t('excelModal.footerSummary', { count: selectedIds.length })}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => !isExporting && onClose()}
              disabled={isExporting}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#334155',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: isExporting ? 'not-allowed' : 'pointer',
              }}
            >
              {t('excelModal.cancel')}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedIds.length === 0 || isExporting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '8px 18px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: selectedIds.length === 0 || isExporting ? '#94A3B8' : '#059669',
                color: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: selectedIds.length === 0 || isExporting ? 'not-allowed' : 'pointer',
              }}
            >
              <Download size={15} />
              <span>{isExporting ? t('excelModal.exporting') : t('excelModal.download')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExcelExportModal;
