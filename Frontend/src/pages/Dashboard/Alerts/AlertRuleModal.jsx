import React, { useState, useEffect, useMemo } from 'react';
import { X, Sliders, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { alertService, DEFAULT_RULE_METADATA } from '../../../services/alertService';

const EVAL_WINDOW_REGEX = /^([1-9]\d*)(s|m|h)$/i;

export const validateAlertRuleForm = (form, unitsMap = DEFAULT_RULE_METADATA.units_map) => {
  const errors = {};

  const name = String(form.name || '').trim();
  if (!name || name.length < 2) {
    errors.name = 'Tên cấu hình cảnh báo phải có ít nhất 2 ký tự';
  } else if (name.length > 255) {
    errors.name = 'Tên cấu hình không được vượt quá 255 ký tự';
  }

  if (!form.metric_type) {
    errors.metric_type = 'Vui lòng chọn loại chỉ số (Metric Type)';
  }

  if (!form.operator) {
    errors.operator = 'Vui lòng chọn toán tử so sánh (Operator)';
  }

  const allowedUnits = unitsMap?.[form.metric_type] || ['%'];
  if (!form.unit || !allowedUnits.includes(form.unit)) {
    errors.unit = `Đơn vị '${form.unit || ''}' không hợp lệ cho chỉ số ${form.metric_type}. Cho phép: ${allowedUnits.join(', ')}`;
  }

  const thresholdNum = Number(form.threshold_value);
  if (form.threshold_value === '' || form.threshold_value === null || form.threshold_value === undefined || !Number.isFinite(thresholdNum)) {
    errors.threshold_value = 'Giá trị ngưỡng phải là một số hợp lệ';
  } else if (form.unit === '%') {
    if (thresholdNum < 0 || thresholdNum > 100) {
      errors.threshold_value = 'Ngưỡng phần trăm (%) phải nằm trong khoảng từ 0 đến 100';
    }
  } else if (thresholdNum <= 0) {
    errors.threshold_value = `Ngưỡng cảnh báo theo đơn vị '${form.unit}' phải lớn hơn 0`;
  }

  const evalWin = String(form.evaluation_window || '').trim();
  if (!evalWin || !EVAL_WINDOW_REGEX.test(evalWin)) {
    errors.evaluation_window = 'Cửa sổ đánh giá phải có định dạng hợp lệ (vd: 30s, 1m, 5m, 15m, 1h)';
  }

  const durationNum = Number(form.duration);
  if (form.duration === '' || !Number.isInteger(durationNum) || durationNum < 0) {
    errors.duration = 'Thời gian duy trì (Duration) phải là số nguyên không âm (giây)';
  }

  const cooldownNum = Number(form.cooldown_seconds);
  if (form.cooldown_seconds === '' || !Number.isInteger(cooldownNum) || cooldownNum < 0) {
    errors.cooldown_seconds = 'Thời gian chờ lặp lại (Cooldown) phải là số nguyên không âm (giây)';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const AlertRuleModal = ({
  isOpen,
  onClose,
  editingRule = null,
  clusters = [],
  metadata = DEFAULT_RULE_METADATA,
  canManageRules = false,
  onSaved,
}) => {
  const effectiveMeta = metadata || DEFAULT_RULE_METADATA;
  const metricTypes = effectiveMeta.metric_types || DEFAULT_RULE_METADATA.metric_types;
  const operators = effectiveMeta.operators || DEFAULT_RULE_METADATA.operators;
  const severities = effectiveMeta.severities || DEFAULT_RULE_METADATA.severities;
  const unitsMap = effectiveMeta.units_map || DEFAULT_RULE_METADATA.units_map;

  const [form, setForm] = useState({
    name: '',
    description: '',
    metric_type: 'CPU',
    operator: 'GREATER_THAN',
    threshold_value: '80',
    unit: '%',
    severity: 'WARNING',
    evaluation_window: '5m',
    duration: '60',
    cooldown_seconds: '300',
    cluster_id: '',
    enabled: true,
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFieldErrors({});
    setSubmitError(null);
    setSubmitSuccess(null);

    if (editingRule) {
      setForm({
        name: editingRule.name || '',
        description: editingRule.description || '',
        metric_type: editingRule.metric_type || 'CPU',
        operator: editingRule.operator || 'GREATER_THAN',
        threshold_value:
          editingRule.threshold_value !== undefined && editingRule.threshold_value !== null
            ? String(editingRule.threshold_value)
            : '80',
        unit: editingRule.unit || (unitsMap[editingRule.metric_type]?.[0] || '%'),
        severity: editingRule.severity || 'WARNING',
        evaluation_window: editingRule.evaluation_window || '5m',
        duration:
          editingRule.duration !== undefined && editingRule.duration !== null
            ? String(editingRule.duration)
            : '60',
        cooldown_seconds:
          editingRule.cooldown_seconds !== undefined && editingRule.cooldown_seconds !== null
            ? String(editingRule.cooldown_seconds)
            : '300',
        cluster_id: editingRule.cluster_id || '',
        enabled: editingRule.enabled !== undefined ? Boolean(editingRule.enabled) : true,
      });
    } else {
      setForm({
        name: '',
        description: '',
        metric_type: 'CPU',
        operator: 'GREATER_THAN',
        threshold_value: '80',
        unit: '%',
        severity: 'WARNING',
        evaluation_window: '5m',
        duration: '60',
        cooldown_seconds: '300',
        cluster_id: '',
        enabled: true,
      });
    }
  }, [editingRule, isOpen, unitsMap]);

  const availableUnits = useMemo(() => {
    return unitsMap[form.metric_type] || ['%'];
  }, [unitsMap, form.metric_type]);

  if (!isOpen) return null;

  const handleMetricTypeChange = (newMetricType) => {
    const allowed = unitsMap[newMetricType] || ['%'];
    const defaultUnit = allowed[0] || '%';
    let defaultThreshold = form.threshold_value;
    if (defaultUnit === '%' && (Number(defaultThreshold) > 100 || Number(defaultThreshold) < 0)) {
      defaultThreshold = '80';
    } else if (defaultUnit !== '%' && Number(defaultThreshold) <= 0) {
      defaultThreshold = '3';
    }
    setForm((prev) => ({
      ...prev,
      metric_type: newMetricType,
      unit: allowed.includes(prev.unit) ? prev.unit : defaultUnit,
      threshold_value: defaultThreshold,
    }));
    setFieldErrors((prev) => ({ ...prev, metric_type: null, unit: null, threshold_value: null }));
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canManageRules) {
      setSubmitError('Bạn không có quyền tạo hoặc chỉnh sửa cấu hình cảnh báo.');
      return;
    }

    setSubmitError(null);
    setSubmitSuccess(null);

    const validation = validateAlertRuleForm(form, unitsMap);
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description ? form.description.trim() : null,
        metric_type: form.metric_type,
        operator: form.operator,
        threshold_value: Number(form.threshold_value),
        unit: form.unit,
        severity: form.severity,
        evaluation_window: form.evaluation_window.trim(),
        duration: Number(form.duration),
        cooldown_seconds: Number(form.cooldown_seconds),
        cluster_id: form.cluster_id ? form.cluster_id : null,
        enabled: Boolean(form.enabled),
      };

      let saved;
      if (editingRule?.id) {
        saved = await alertService.updateAlertRule(editingRule.id, payload);
        setSubmitSuccess('Cập nhật cấu hình cảnh báo thành công!');
      } else {
        saved = await alertService.createAlertRule(payload);
        setSubmitSuccess('Tạo cấu hình cảnh báo mới thành công!');
      }

      if (onSaved) {
        onSaved(saved, Boolean(editingRule?.id));
      }
      setTimeout(() => {
        onClose();
      }, 400);
    } catch (err) {
      setSubmitError(err.message || 'Không thể lưu cấu hình cảnh báo');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="alert-rule-modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(3px)',
        zIndex: 120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        data-testid="alert-rule-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '92vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          boxShadow: '0 20px 50px rgba(15, 23, 42, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--dash-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={20} color="var(--dash-primary)" />
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
                {editingRule ? 'Cập Nhật Quy Tắc Cảnh Báo (Edit Alert Rule)' : 'Tạo Quy Tắc Cảnh Báo Mới (Create Alert Rule)'}
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)', margin: '2px 0 0 0' }}>
                Thiết lập điều kiện ngưỡng cho Hạ tầng (Node), Kubernetes và APM
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="btn-close-rule-modal"
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '8px',
              border: '1px solid var(--dash-border)',
              backgroundColor: '#FFFFFF',
              cursor: 'pointer',
              color: 'var(--dash-text-secondary)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {submitError && (
            <div
              data-testid="rule-form-error"
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#DC2626',
                fontSize: '0.8125rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{submitError}</span>
            </div>
          )}

          {submitSuccess && (
            <div
              data-testid="rule-form-success"
              style={{
                padding: '12px 14px',
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
              <CheckCircle2 size={16} />
              <span>{submitSuccess}</span>
            </div>
          )}

          {/* Row 1: Rule Name & Cluster */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Tên quy tắc (Rule Name) <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type="text"
                data-testid="input-rule-name"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="VD: Cảnh báo Bão hòa CPU Máy chủ"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: fieldErrors.name ? '1px solid #DC2626' : '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  boxSizing: 'border-box',
                }}
              />
              {fieldErrors.name && (
                <div data-testid="err-rule-name" style={{ color: '#DC2626', fontSize: '0.75rem', marginTop: '4px' }}>
                  {fieldErrors.name}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Phạm vi Cụm K8s (Cluster)
              </label>
              <select
                data-testid="select-rule-cluster"
                value={form.cluster_id}
                onChange={(e) => handleChange('cluster_id', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="">Toàn tổ chức (All Clusters / Org-Wide)</option>
                {clusters.map((c) => (
                  <option key={c.id || c.clusterId} value={c.id || c.clusterId}>
                    {c.cluster || c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
              Mô tả chi tiết (Description)
            </label>
            <textarea
              data-testid="input-rule-description"
              rows={2}
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Mô tả mục đích giám sát và hướng dẫn xử lý khi vượt ngưỡng..."
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                fontSize: '0.8125rem',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Row 3: Metric Type & Operator */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Loại Chỉ số (Metric Type) <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select
                data-testid="select-rule-metric-type"
                value={form.metric_type}
                onChange={(e) => handleMetricTypeChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: fieldErrors.metric_type ? '1px solid #DC2626' : '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  backgroundColor: '#FFFFFF',
                }}
              >
                {metricTypes.map((m) => (
                  <option key={m.code} value={m.code}>
                    [{m.category}] {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Toán tử điều kiện (Operator) <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select
                data-testid="select-rule-operator"
                value={form.operator}
                onChange={(e) => handleChange('operator', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: fieldErrors.operator ? '1px solid #DC2626' : '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  backgroundColor: '#FFFFFF',
                }}
              >
                {operators.map((op) => (
                  <option key={op.code} value={op.code}>
                    {op.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Threshold, Unit, Severity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Ngưỡng kích hoạt (Threshold) <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type="number"
                step="any"
                data-testid="input-rule-threshold"
                value={form.threshold_value}
                onChange={(e) => handleChange('threshold_value', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: fieldErrors.threshold_value ? '1px solid #DC2626' : '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  boxSizing: 'border-box',
                }}
              />
              {fieldErrors.threshold_value && (
                <div data-testid="err-rule-threshold" style={{ color: '#DC2626', fontSize: '0.72rem', marginTop: '4px' }}>
                  {fieldErrors.threshold_value}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Đơn vị đo (Unit) <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select
                data-testid="select-rule-unit"
                value={form.unit}
                onChange={(e) => handleChange('unit', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: fieldErrors.unit ? '1px solid #DC2626' : '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  backgroundColor: '#FFFFFF',
                }}
              >
                {availableUnits.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              {fieldErrors.unit && (
                <div data-testid="err-rule-unit" style={{ color: '#DC2626', fontSize: '0.72rem', marginTop: '4px' }}>
                  {fieldErrors.unit}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Mức độ nghiêm trọng (Severity) <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select
                data-testid="select-rule-severity"
                value={form.severity}
                onChange={(e) => handleChange('severity', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  backgroundColor: '#FFFFFF',
                  fontWeight: 700,
                }}
              >
                {severities.map((sev) => (
                  <option key={sev.code} value={sev.code}>
                    {sev.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 5: Evaluation Window, Duration, Cooldown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Cửa sổ đánh giá (Eval Window) <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type="text"
                data-testid="input-rule-eval-window"
                value={form.evaluation_window}
                onChange={(e) => handleChange('evaluation_window', e.target.value)}
                placeholder="VD: 30s, 5m, 15m, 1h"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: fieldErrors.evaluation_window ? '1px solid #DC2626' : '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  boxSizing: 'border-box',
                }}
              />
              {fieldErrors.evaluation_window && (
                <div data-testid="err-rule-eval-window" style={{ color: '#DC2626', fontSize: '0.72rem', marginTop: '4px' }}>
                  {fieldErrors.evaluation_window}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Thời gian duy trì (Duration - giây) <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type="number"
                data-testid="input-rule-duration"
                value={form.duration}
                onChange={(e) => handleChange('duration', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: fieldErrors.duration ? '1px solid #DC2626' : '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  boxSizing: 'border-box',
                }}
              />
              {fieldErrors.duration && (
                <div data-testid="err-rule-duration" style={{ color: '#DC2626', fontSize: '0.72rem', marginTop: '4px' }}>
                  {fieldErrors.duration}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Thời gian chờ (Cooldown - giây) <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                type="number"
                data-testid="input-rule-cooldown"
                value={form.cooldown_seconds}
                onChange={(e) => handleChange('cooldown_seconds', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: fieldErrors.cooldown_seconds ? '1px solid #DC2626' : '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  boxSizing: 'border-box',
                }}
              />
              {fieldErrors.cooldown_seconds && (
                <div data-testid="err-rule-cooldown" style={{ color: '#DC2626', fontSize: '0.72rem', marginTop: '4px' }}>
                  {fieldErrors.cooldown_seconds}
                </div>
              )}
            </div>
          </div>

          {/* Row 6: Enabled Toggle */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: '#F8FAFC',
              border: '1px solid var(--dash-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                Kích hoạt quy tắc cảnh báo (Enabled)
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-secondary)' }}>
                Rule Engine sẽ tự động quét và đánh giá quy tắc này trong mỗi chu kỳ
              </div>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                data-testid="checkbox-rule-enabled"
                checked={Boolean(form.enabled)}
                onChange={(e) => handleChange('enabled', e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: form.enabled ? '#059669' : 'var(--dash-text-muted)' }}>
                {form.enabled ? 'Đang bật (Enabled)' : 'Đang tắt (Disabled)'}
              </span>
            </label>
          </div>

          {/* Footer Buttons */}
          <div
            style={{
              paddingTop: '12px',
              borderTop: '1px solid var(--dash-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                backgroundColor: '#FFFFFF',
                color: 'var(--dash-text-secondary)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Hủy bỏ
            </button>

            <button
              type="submit"
              data-testid="btn-submit-rule-form"
              disabled={isSubmitting || !canManageRules}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: isSubmitting || !canManageRules ? '#94A3B8' : 'var(--dash-primary, #059669)',
                color: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: isSubmitting || !canManageRules ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting && <RefreshCw size={14} className="animate-spin" />}
              <span>{isSubmitting ? 'Đang lưu...' : editingRule ? 'Lưu Cập Nhật' : 'Tạo Quy Tắc'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AlertRuleModal;
