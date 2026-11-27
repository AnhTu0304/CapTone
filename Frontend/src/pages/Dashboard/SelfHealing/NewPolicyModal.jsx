import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { selfHealingService } from '../../../services/selfHealingService';
import {
  X,
  Zap,
  Activity,
  Cpu,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

export const NewPolicyModal = ({
  isOpen,
  onClose,
  onCreated,
  currentOrg,
  currentEnv,
}) => {
  const { t } = useTranslation('dashHealing');

  const STANDARD_METRICS = useMemo(() => [
    { value: 'CPU_USAGE', label: t('newPolicy.metrics.CPU_USAGE'), unit: '%', defaultVal: 80, category: t('newPolicy.metrics.catResource') },
    { value: 'MEMORY_USAGE', label: t('newPolicy.metrics.MEMORY_USAGE'), unit: '%', defaultVal: 85, category: t('newPolicy.metrics.catResource') },
    { value: 'HTTP_5XX_RATE', label: t('newPolicy.metrics.HTTP_5XX_RATE'), unit: '%', defaultVal: 5, category: t('newPolicy.metrics.catTraffic') },
    { value: 'POD_RESTART_COUNT', label: t('newPolicy.metrics.POD_RESTART_COUNT'), unit: t('newPolicy.metrics.unitTimes'), defaultVal: 3, category: t('newPolicy.metrics.catApp') },
    { value: 'LATENCY_P95', label: t('newPolicy.metrics.LATENCY_P95'), unit: 'ms', defaultVal: 600, category: t('newPolicy.metrics.catTraffic') },
    { value: 'DISK_USAGE', label: t('newPolicy.metrics.DISK_USAGE'), unit: '%', defaultVal: 90, category: t('newPolicy.metrics.catStorage') },
  ], [t]);

  const STANDARD_OPERATORS = useMemo(() => [
    { value: '>', label: t('newPolicy.operators.gt') },
    { value: '>=', label: t('newPolicy.operators.gte') },
    { value: '<', label: t('newPolicy.operators.lt') },
  ], [t]);

  const STANDARD_DURATIONS = useMemo(() => [
    { value: '30s', label: t('newPolicy.durations.30s') },
    { value: '1m', label: t('newPolicy.durations.1m') },
    { value: '2m', label: t('newPolicy.durations.2m') },
    { value: '5m', label: t('newPolicy.durations.5m') },
  ], [t]);

  const STANDARD_NAMESPACES = useMemo(() => [
    { value: 'test-lab', label: t('newPolicy.namespaces.testLab') },
    { value: 'default', label: t('newPolicy.namespaces.default') },
    { value: 'production', label: t('newPolicy.namespaces.production') },
    { value: 'all', label: t('newPolicy.namespaces.all') },
  ], [t]);

  const STANDARD_ACTIONS = useMemo(() => [
    {
      id: 'd0000000-0000-0000-0000-000000000002',
      code: 'SCALE_REPLICAS',
      name: t('newPolicy.actions.SCALE_REPLICAS_name'),
      description: t('newPolicy.actions.SCALE_REPLICAS_desc'),
      defaultRisk: 'LOW',
      defaultHitl: false,
    },
    {
      id: 'd0000000-0000-0000-0000-000000000001',
      code: 'RESTART_POD',
      name: t('newPolicy.actions.RESTART_POD_name'),
      description: t('newPolicy.actions.RESTART_POD_desc'),
      defaultRisk: 'LOW',
      defaultHitl: false,
    },
    {
      id: 'd0000000-0000-0000-0000-000000000008',
      code: 'REPLACE_POD',
      name: t('newPolicy.actions.REPLACE_POD_name'),
      description: t('newPolicy.actions.REPLACE_POD_desc'),
      defaultRisk: 'MEDIUM',
      defaultHitl: false,
    },
    {
      id: 'd0000000-0000-0000-0000-000000000009',
      code: 'RESTART_DEPLOYMENT',
      name: t('newPolicy.actions.RESTART_DEPLOYMENT_name'),
      description: t('newPolicy.actions.RESTART_DEPLOYMENT_desc'),
      defaultRisk: 'MEDIUM',
      defaultHitl: true,
    },
    {
      id: 'd0000000-0000-0000-0000-000000000003',
      code: 'ROLLBACK_DEPLOYMENT',
      name: t('newPolicy.actions.ROLLBACK_DEPLOYMENT_name'),
      description: t('newPolicy.actions.ROLLBACK_DEPLOYMENT_desc'),
      defaultRisk: 'HIGH',
      defaultHitl: true,
    },
    {
      id: 'd0000000-0000-0000-0000-000000000004',
      code: 'CLEANUP_TEMP_FILES',
      name: t('newPolicy.actions.CLEANUP_TEMP_FILES_name'),
      description: t('newPolicy.actions.CLEANUP_TEMP_FILES_desc'),
      defaultRisk: 'LOW',
      defaultHitl: false,
    },
    {
      id: 'd0000000-0000-0000-0000-000000000007',
      code: 'DRAIN_NODE',
      name: t('newPolicy.actions.DRAIN_NODE_name'),
      description: t('newPolicy.actions.DRAIN_NODE_desc'),
      defaultRisk: 'CRITICAL',
      defaultHitl: true,
    },
  ], [t]);

  const [selectedMetric, setSelectedMetric] = useState('CPU_USAGE');
  const [selectedOperator, setSelectedOperator] = useState('>');
  const [thresholdValue, setThresholdValue] = useState(80);
  const [selectedDuration, setSelectedDuration] = useState('1m');
  const [selectedNamespace, setSelectedNamespace] = useState('test-lab');
  const [selectedActionId, setSelectedActionId] = useState('d0000000-0000-0000-0000-000000000002');

  const [ruleName, setRuleName] = useState('');
  const [isCustomName, setIsCustomName] = useState(false);
  const [riskLevel, setRiskLevel] = useState('LOW');
  const [hitlRequired, setHitlRequired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active Metric Object
  const currentMetricObj = useMemo(() => {
    return STANDARD_METRICS.find((m) => m.value === selectedMetric) || STANDARD_METRICS[0];
  }, [STANDARD_METRICS, selectedMetric]);

  // Active Duration Label
  const currentDurationLabel = useMemo(() => {
    return STANDARD_DURATIONS.find((d) => d.value === selectedDuration)?.label || selectedDuration;
  }, [STANDARD_DURATIONS, selectedDuration]);

  // Active Action Object
  const currentActionObj = useMemo(() => {
    return STANDARD_ACTIONS.find((a) => a.id === selectedActionId) || STANDARD_ACTIONS[0];
  }, [STANDARD_ACTIONS, selectedActionId]);

  // When metric changes, update default threshold
  const handleMetricChange = (val) => {
    setSelectedMetric(val);
    const m = STANDARD_METRICS.find((item) => item.value === val);
    if (m) {
      setThresholdValue(m.defaultVal);
    }
  };

  // When action changes, update recommended risk and HITL
  const handleActionChange = (actionId) => {
    setSelectedActionId(actionId);
    const a = STANDARD_ACTIONS.find((item) => item.id === actionId);
    if (a) {
      setRiskLevel(a.defaultRisk);
      setHitlRequired(a.defaultHitl);
    }
  };

  // Formatted condition string
  const formattedCondition = useMemo(() => {
    return t('newPolicy.conditionFormat', {
      metric: currentMetricObj.label.split(' (')[0],
      op: selectedOperator,
      val: thresholdValue,
      unit: currentMetricObj.unit,
      duration: currentDurationLabel,
    });
  }, [t, currentMetricObj, selectedOperator, thresholdValue, currentDurationLabel]);

  // Auto-generated Rule Name
  const autoGeneratedName = useMemo(() => {
    const actionShort = currentActionObj.name.split(' (')[0];
    const metricShort = currentMetricObj.label.split(' (')[0];
    return t('newPolicy.autoNameFormat', {
      action: actionShort,
      metric: metricShort,
      op: selectedOperator,
      val: thresholdValue,
      unit: currentMetricObj.unit,
    });
  }, [t, currentActionObj, currentMetricObj, selectedOperator, thresholdValue]);

  // Sync rule name if not manually edited
  useEffect(() => {
    if (!isCustomName) {
      setRuleName(autoGeneratedName);
    }
  }, [autoGeneratedName, isCustomName]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const activeOrgId = currentOrg?.id || '00000000-0000-0000-0000-000000000001';
      const activeEnvId = currentEnv?.environment_id || currentEnv?.clusterId || currentEnv?.id;

      await selfHealingService.createPolicy({
        organization_id: activeOrgId,
        environment_id: activeEnvId,
        name: `POL-${Date.now().toString().slice(-4)}`,
        description: ruleName || autoGeneratedName,
        risk_type: currentMetricObj.category,
        risk_level: riskLevel,
        requires_approval: hitlRequired,
        trigger_type: formattedCondition,
        action_type_id: selectedActionId,
        execution_mode: hitlRequired ? 'MANUAL' : 'AUTO',
        is_active: true,
      });

      if (onCreated) {
        await onCreated();
      }
      onClose();
    } catch (err) {
      console.error('[NewPolicyModal] Lỗi tạo quy tắc:', err);
      alert(t('newPolicy.saveError', { msg: err.message || t('newPolicy.unknownError') }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="dash-card"
        style={{
          width: '100%',
          maxWidth: '620px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--dash-border, #E2E8F0)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--dash-border, #E2E8F0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#059669',
              }}
            >
              <Zap size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                {t('newPolicy.title')}
              </h3>
              <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '1px' }}>
                {t('newPolicy.subtitle')}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
              borderRadius: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          {/* 1. Trigger Condition Builder */}
          <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={14} color="#059669" />
              {t('newPolicy.section1')}
            </div>

            <div className="dash-grid-3" style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  {t('newPolicy.metricLabel')}
                </label>
                <select
                  value={selectedMetric}
                  onChange={(e) => handleMetricChange(e.target.value)}
                  style={{ width: '100%', height: '36px', padding: '0 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8125rem', backgroundColor: '#FFFFFF', fontWeight: 600 }}
                >
                  {STANDARD_METRICS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  {t('newPolicy.operatorLabel')}
                </label>
                <select
                  value={selectedOperator}
                  onChange={(e) => setSelectedOperator(e.target.value)}
                  style={{ width: '100%', height: '36px', padding: '0 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8125rem', backgroundColor: '#FFFFFF', fontWeight: 600 }}
                >
                  {STANDARD_OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  {t('newPolicy.thresholdLabel', { unit: currentMetricObj.unit })}
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={thresholdValue}
                  onChange={(e) => setThresholdValue(Number(e.target.value))}
                  style={{ width: '100%', height: '36px', padding: '0 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.875rem', backgroundColor: '#FFFFFF', fontWeight: 700, fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>

            <div className="dash-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  {t('newPolicy.durationLabel')}
                </label>
                <select
                  value={selectedDuration}
                  onChange={(e) => setSelectedDuration(e.target.value)}
                  style={{ width: '100%', height: '36px', padding: '0 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8125rem', backgroundColor: '#FFFFFF' }}
                >
                  {STANDARD_DURATIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  {t('newPolicy.namespaceLabel')}
                </label>
                <select
                  value={selectedNamespace}
                  onChange={(e) => setSelectedNamespace(e.target.value)}
                  style={{ width: '100%', height: '36px', padding: '0 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8125rem', backgroundColor: '#FFFFFF', fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                >
                  {STANDARD_NAMESPACES.map((ns) => (
                    <option key={ns.value} value={ns.value}>
                      {ns.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. Remediation Action Selection */}
          <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={14} color="#0284C7" />
              {t('newPolicy.section2')}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                {t('newPolicy.actionTypeLabel')}
              </label>
              <select
                value={selectedActionId}
                onChange={(e) => handleActionChange(e.target.value)}
                style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8125rem', backgroundColor: '#FFFFFF', fontWeight: 700, color: '#0F172A' }}
              >
                {STANDARD_ACTIONS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '4px' }}>
                {t('newPolicy.descPrefix', { desc: currentActionObj.description })}
              </div>
            </div>

            <div className="dash-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px', alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  {t('newPolicy.riskLevelLabel')}
                </label>
                <select
                  value={riskLevel}
                  onChange={(e) => setRiskLevel(e.target.value)}
                  style={{ width: '100%', height: '36px', padding: '0 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8125rem', backgroundColor: '#FFFFFF', fontWeight: 700 }}
                >
                  <option value="LOW">{t('newPolicy.riskLow')}</option>
                  <option value="MEDIUM">{t('newPolicy.riskMed')}</option>
                  <option value="HIGH">{t('newPolicy.riskHigh')}</option>
                  <option value="CRITICAL">{t('newPolicy.riskCrit')}</option>
                </select>
              </div>

              <div style={{ paddingTop: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8125rem', color: '#0F172A', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={hitlRequired}
                    onChange={(e) => setHitlRequired(e.target.checked)}
                    style={{ accentColor: '#059669', width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span>{t('newPolicy.hitlCheckbox')}</span>
                </label>
              </div>
            </div>
          </div>

          {/* 3. Name & Live Rule Summary */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569' }}>
                {t('newPolicy.ruleNameLabel')}
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsCustomName(false);
                  setRuleName(autoGeneratedName);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#059669',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Sparkles size={11} /> {t('newPolicy.regenerateName')}
              </button>
            </div>
            <input
              type="text"
              required
              value={ruleName}
              onChange={(e) => {
                setIsCustomName(true);
                setRuleName(e.target.value);
              }}
              style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8125rem', fontWeight: 600 }}
            />
          </div>

          {/* Live Preview Box */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
            }}
          >
            <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#047857', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={13} /> {t('newPolicy.previewTitle')}
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#065F46', marginTop: '4px', lineHeight: 1.5, fontWeight: 500 }}>
              {t('newPolicy.previewIf')} <strong>{currentMetricObj.label.split(' (')[0]}</strong> {selectedOperator} <strong>{thresholdValue}{currentMetricObj.unit}</strong> {t('newPolicy.previewFor', { duration: currentDurationLabel })} <strong>{selectedNamespace}</strong> {t('newPolicy.previewThen')} <strong>{currentActionObj.name.split(' (')[0]}</strong> ({hitlRequired ? t('newPolicy.previewHitl') : t('newPolicy.previewAuto')}).
            </div>
          </div>

          {/* Modal Footer Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: '#64748B',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                backgroundColor: '#059669',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isSubmitting ? t('newPolicy.saving') : t('newPolicy.submitBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewPolicyModal;
