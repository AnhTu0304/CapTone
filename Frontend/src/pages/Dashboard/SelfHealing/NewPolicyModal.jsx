import React, { useState, useEffect, useMemo } from 'react';
import { selfHealingService } from '../../../services/selfHealingService';
import {
  X,
  Zap,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Server,
  Activity,
  Cpu,
  Clock,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

const STANDARD_METRICS = [
  { value: 'CPU_USAGE', label: 'Mức sử dụng CPU (CPU Usage)', unit: '%', defaultVal: 80, category: 'Tài nguyên & Cấu hình' },
  { value: 'MEMORY_USAGE', label: 'Bộ nhớ RAM (Memory / OOM Risk)', unit: '%', defaultVal: 85, category: 'Tài nguyên & Cấu hình' },
  { value: 'HTTP_5XX_RATE', label: 'Tỷ lệ lỗi HTTP 5xx (500/502/503)', unit: '%', defaultVal: 5, category: 'Lưu lượng & Mạng' },
  { value: 'POD_RESTART_COUNT', label: 'Số lần Pod Restart (CrashLoopBackOff)', unit: 'lần', defaultVal: 3, category: 'Tiến trình Ứng dụng' },
  { value: 'LATENCY_P95', label: 'Độ trễ phản hồi P95 (Network Latency)', unit: 'ms', defaultVal: 600, category: 'Lưu lượng & Mạng' },
  { value: 'DISK_USAGE', label: 'Dung lượng ổ đĩa tạm (/tmp Disk Full)', unit: '%', defaultVal: 90, category: 'Lưu trữ & Dữ liệu' },
];

const STANDARD_OPERATORS = [
  { value: '>', label: '> (Vượt quá ngưỡng)' },
  { value: '>=', label: '>= (Chạm hoặc vượt ngưỡng)' },
  { value: '<', label: '< (Thấp hơn ngưỡng)' },
];

const STANDARD_DURATIONS = [
  { value: '30 giây liên tiếp', label: '30 giây liên tiếp' },
  { value: '60 giây liên tiếp', label: '1 phút liên tiếp' },
  { value: '2 phút liên tiếp', label: '2 phút liên tiếp' },
  { value: '5 phút liên tiếp', label: '5 phút liên tiếp' },
];

const STANDARD_NAMESPACES = [
  { value: 'test-lab', label: 'test-lab (Môi trường Lab thực nghiệm)' },
  { value: 'default', label: 'default (Namespace mặc định K8s)' },
  { value: 'production', label: 'production (Môi trường vận hành chính)' },
  { value: 'all', label: 'all (Toàn bộ các namespace trong cụm)' },
];

const STANDARD_ACTIONS = [
  {
    id: 'd0000000-0000-0000-0000-000000000002',
    code: 'SCALE_REPLICAS',
    name: 'Scale Replicas (Mở rộng thêm bản sao Pod)',
    description: 'Tăng bản sao Pod để san sẻ tải trọng CPU/RAM',
    defaultRisk: 'LOW',
    defaultHitl: false,
  },
  {
    id: 'd0000000-0000-0000-0000-000000000001',
    code: 'RESTART_POD',
    name: 'Restart Pod (Khởi động lại Pod bị treo liveness probe)',
    description: 'Gửi tín hiệu khởi động lại Pod đơn lẻ',
    defaultRisk: 'LOW',
    defaultHitl: false,
  },
  {
    id: 'd0000000-0000-0000-0000-000000000008',
    code: 'REPLACE_POD',
    name: 'Replace Pod (Hủy Pod lỗi và tạo mới qua ReplicaSet)',
    description: 'Xóa tận gốc Pod bị rò rỉ RAM hoặc crash lặp lại',
    defaultRisk: 'MEDIUM',
    defaultHitl: false,
  },
  {
    id: 'd0000000-0000-0000-0000-000000000009',
    code: 'RESTART_DEPLOYMENT',
    name: 'Restart Deployment (Zero-downtime rolling restart)',
    description: 'Rolling restart toàn bộ các Pod của Deployment',
    defaultRisk: 'MEDIUM',
    defaultHitl: true,
  },
  {
    id: 'd0000000-0000-0000-0000-000000000003',
    code: 'ROLLBACK_DEPLOYMENT',
    name: 'Rollback Deployment (Hoàn nguyên phiên bản trước)',
    description: 'Trở về bản phát hành trước đó khi dính lỗi 5xx',
    defaultRisk: 'HIGH',
    defaultHitl: true,
  },
  {
    id: 'd0000000-0000-0000-0000-000000000004',
    code: 'CLEANUP_TEMP_FILES',
    name: 'Cleanup Temporary Files (Dọn dẹp file rác /tmp)',
    description: 'Giải phóng bộ nhớ đệm ổ đĩa',
    defaultRisk: 'LOW',
    defaultHitl: false,
  },
  {
    id: 'd0000000-0000-0000-0000-000000000007',
    code: 'DRAIN_NODE',
    name: 'Drain Node (Di tản và cô lập Node phần cứng bị hỏng)',
    description: 'Cách ly máy chủ gặp sự cố vật lý',
    defaultRisk: 'CRITICAL',
    defaultHitl: true,
  },
];

export const NewPolicyModal = ({
  isOpen,
  onClose,
  onCreated,
  currentOrg,
  currentEnv,
}) => {
  const [selectedMetric, setSelectedMetric] = useState(STANDARD_METRICS[0].value);
  const [selectedOperator, setSelectedOperator] = useState('>');
  const [thresholdValue, setThresholdValue] = useState(STANDARD_METRICS[0].defaultVal);
  const [selectedDuration, setSelectedDuration] = useState(STANDARD_DURATIONS[1].value);
  const [selectedNamespace, setSelectedNamespace] = useState('test-lab');
  const [selectedActionId, setSelectedActionId] = useState(STANDARD_ACTIONS[0].id);

  const [ruleName, setRuleName] = useState('');
  const [isCustomName, setIsCustomName] = useState(false);
  const [riskLevel, setRiskLevel] = useState(STANDARD_ACTIONS[0].defaultRisk);
  const [hitlRequired, setHitlRequired] = useState(STANDARD_ACTIONS[0].defaultHitl);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active Metric Object
  const currentMetricObj = useMemo(() => {
    return STANDARD_METRICS.find((m) => m.value === selectedMetric) || STANDARD_METRICS[0];
  }, [selectedMetric]);

  // Active Action Object
  const currentActionObj = useMemo(() => {
    return STANDARD_ACTIONS.find((a) => a.id === selectedActionId) || STANDARD_ACTIONS[0];
  }, [selectedActionId]);

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
    return `${currentMetricObj.label.split(' (')[0]} ${selectedOperator} ${thresholdValue}${currentMetricObj.unit} trong ${selectedDuration}`;
  }, [currentMetricObj, selectedOperator, thresholdValue, selectedDuration]);

  // Auto-generated Rule Name
  const autoGeneratedName = useMemo(() => {
    const actionShort = currentActionObj.name.split(' (')[0];
    const metricShort = currentMetricObj.label.split(' (')[0];
    return `Tự động ${actionShort} khi ${metricShort} ${selectedOperator} ${thresholdValue}${currentMetricObj.unit}`;
  }, [currentActionObj, currentMetricObj, selectedOperator, thresholdValue]);

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
      alert('Không thể lưu quy tắc: ' + (err.message || 'Lỗi không xác định'));
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
                Thêm Quy Tắc Tự Phục Hồi Mới
              </h3>
              <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '1px' }}>
                Bộ chọn thông số chuẩn hóa (Chống hoàn toàn lỗi sai chính tả)
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
              1. ĐIỀU KIỆN VIỄN TRẮC KÍCH HOẠT (TRIGGER CONDITION)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  CHỈ SỐ THEO DÕI
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
                  PHÉP SO SÁNH
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
                  NGƯỠNG ({currentMetricObj.unit})
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  THỜI GIAN DUY TRÌ
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
                  NAMESPACE MỤC TIÊU
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
              2. HÀNH ĐỘNG SỬA LỖI TỰ ĐỘNG (MAPE-K REMEDIATION)
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                LOẠI HÀNH ĐỘNG KUBERNETES CHUẨN HÓA
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
                Mô tả: {currentActionObj.description}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px', alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  MỨC ĐỘ RỦI RO
                </label>
                <select
                  value={riskLevel}
                  onChange={(e) => setRiskLevel(e.target.value)}
                  style={{ width: '100%', height: '36px', padding: '0 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8125rem', backgroundColor: '#FFFFFF', fontWeight: 700 }}
                >
                  <option value="LOW">Thấp (LOW)</option>
                  <option value="MEDIUM">Vừa (MEDIUM)</option>
                  <option value="HIGH">Cao (HIGH)</option>
                  <option value="CRITICAL">Nghiêm trọng (CRITICAL)</option>
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
                  <span>Bắt buộc duyệt HITL trước khi chạy</span>
                </label>
              </div>
            </div>
          </div>

          {/* 3. Name & Live Rule Summary */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569' }}>
                TÊN QUY TẮC HIỂN THỊ
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
                <Sparkles size={11} /> Tự tạo lại tên chuẩn
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
              <ShieldCheck size={13} /> TÓM TẮT QUY TẮC TỰ LÀNH ĐÃ CẤU HÌNH:
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#065F46', marginTop: '4px', lineHeight: 1.5, fontWeight: 500 }}>
              Nếu <strong>{currentMetricObj.label.split(' (')[0]}</strong> {selectedOperator} <strong>{thresholdValue}{currentMetricObj.unit}</strong> (trong {selectedDuration}) tại namespace <strong>{selectedNamespace}</strong> ➔ Hệ thống sẽ thực thi <strong>{currentActionObj.name.split(' (')[0]}</strong> ({hitlRequired ? 'Cần người duyệt HITL' : 'Tự động 100%'}).
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
              Hủy
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
              {isSubmitting ? 'Đang lưu...' : 'Thêm Quy Tắc Chuẩn'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewPolicyModal;
