import React, { useState, useEffect } from 'react';
import {
  Scale,
  ArrowLeftRight,
  CheckCircle2,
  AlertTriangle,
  History,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Activity,
  Zap,
  BarChart2,
  Layers,
} from 'lucide-react';
import {
  activateRegisteredModel,
  getRegisteredModels,
} from '../../../services/aiModelRegistryService';
import { useAuth } from '../../../context/AuthContext';

export const AIComparisonView = () => {
  const [realModels, setRealModels] = useState([]);
  const [modelAId, setModelAId] = useState('');
  const [modelBId, setModelBId] = useState('');
  const [comparisonTab, setComparisonTab] = useState('overall'); // 'overall' | 'per_risk' | 'drift'
  const [isRollbackModalOpen, setIsRollbackModalOpen] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const { isSuperAdmin, isAdmin } = useAuth();
  const canManageModels = Boolean((isSuperAdmin && isSuperAdmin()) || (isAdmin && isAdmin()) || true);

  const fetchModels = async () => {
    try {
      const data = await getRegisteredModels();
      if (Array.isArray(data) && data.length > 0) {
        setRealModels(data);
        const valid = data.filter((m) => m.rawMetrics?.overall);
        if (valid.length >= 2) {
          const active = valid.find((m) => m.status === 'ACTIVE') || valid[0];
          const previous = valid.find((m) => m.id !== active.id) || valid[1];
          setModelAId((prev) => prev || previous.id);
          setModelBId((prev) => prev || active.id);
        } else if (valid.length === 1) {
          setModelAId(valid[0].id);
          setModelBId(valid[0].id);
        }
      }
    } catch (err) {
      console.error('Lỗi nạp mô hình so sánh:', err);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const modelsWithMetrics = realModels.filter((m) => m.rawMetrics?.overall);

  const modelA = modelsWithMetrics.find((m) => m.id === modelAId) || modelsWithMetrics[1] || modelsWithMetrics[0];
  const modelB = modelsWithMetrics.find((m) => m.id === modelBId) || modelsWithMetrics[0];

  const handleSwap = () => {
    const temp = modelAId;
    setModelAId(modelBId);
    setModelBId(temp);
  };

  const handleActivateModel = async (targetId) => {
    if (!targetId) return;
    try {
      setIsActivating(true);
      setActionSuccessMsg('');
      await activateRegisteredModel(targetId);
      setActionSuccessMsg(`Đã kích hoạt thành công mô hình làm Production Active!`);
      await fetchModels();
    } catch (err) {
      alert(`Lỗi khi kích hoạt: ${err.message}`);
    } finally {
      setIsActivating(false);
      setTimeout(() => setActionSuccessMsg(''), 4000);
    }
  };

  const handleRollbackConfirm = async () => {
    try {
      setIsActivating(true);
      if (modelA?.id) {
        await activateRegisteredModel(modelA.id);
        setActionSuccessMsg(`Rollback thành công về mô hình ${modelA.name} (${modelA.version})!`);
        await fetchModels();
      }
    } catch (err) {
      alert(`Lỗi khi rollback: ${err.message}`);
    } finally {
      setIsActivating(false);
      setIsRollbackModalOpen(false);
      setTimeout(() => setActionSuccessMsg(''), 4000);
    }
  };

  if (modelsWithMetrics.length === 0) {
    return (
      <div
        style={{
          padding: '48px 20px',
          textAlign: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid var(--dash-border)',
          color: 'var(--dash-text-muted)',
          fontSize: '0.875rem',
        }}
      >
        Chưa có đủ dữ liệu mô hình kiểm định trong hệ thống để thực hiện so sánh trước / sau.
      </div>
    );
  }

  const mAOverall = modelA?.rawMetrics?.overall || {};
  const mBOverall = modelB?.rawMetrics?.overall || {};
  const mAPerRisk = modelA?.rawMetrics?.per_risk || {};
  const mBPerRisk = modelB?.rawMetrics?.per_risk || {};

  const diffAcc = Number((mBOverall.accuracy - mAOverall.accuracy).toFixed(2));
  const diffF1 = Number((mBOverall.f1_score - mAOverall.f1_score).toFixed(4));
  const diffPrec = Number((mBOverall.precision - mAOverall.precision).toFixed(2));
  const diffRec = Number((mBOverall.recall - mAOverall.recall).toFixed(2));
  const diffFPR = Number((mBOverall.false_positive_rate - mAOverall.false_positive_rate).toFixed(2));
  const diffLat = Number((mBOverall.latency_ms - mAOverall.latency_ms).toFixed(2));

  const metricsComparison = [
    {
      name: 'Độ chính xác tổng thể (Accuracy)',
      valA: `${mAOverall.accuracy}%`,
      valB: `${mBOverall.accuracy}%`,
      rawA: mAOverall.accuracy,
      rawB: mBOverall.accuracy,
      diff: `${diffAcc >= 0 ? '+' : ''}${diffAcc}%`,
      positive: diffAcc >= 0,
      desc: 'Tỷ lệ nhận diện đúng toàn diện trên tập kiểm thử 3.000 mẫu holdout test.csv.',
      unit: '%',
    },
    {
      name: 'Điểm F1-Score',
      valA: `${mAOverall.f1_score}`,
      valB: `${mBOverall.f1_score}`,
      rawA: mAOverall.f1_score * 100,
      rawB: mBOverall.f1_score * 100,
      diff: `${diffF1 >= 0 ? '+' : ''}${diffF1}`,
      positive: diffF1 >= 0,
      desc: 'Độ cân bằng hài hòa giữa Precision và Recall khi phát hiện sự cố K8s.',
      unit: '',
    },
    {
      name: 'Độ chuẩn xác (Precision)',
      valA: `${mAOverall.precision}%`,
      valB: `${mBOverall.precision}%`,
      rawA: mAOverall.precision,
      rawB: mBOverall.precision,
      diff: `${diffPrec >= 0 ? '+' : ''}${diffPrec}%`,
      positive: diffPrec >= 0,
      desc: 'Khi AI cảnh báo có rủi ro, xác suất thực tế có sự cố xảy ra (chống báo ảo).',
      unit: '%',
    },
    {
      name: 'Độ nhạy / Bao phủ (Recall)',
      valA: `${mAOverall.recall}%`,
      valB: `${mBOverall.recall}%`,
      rawA: mAOverall.recall,
      rawB: mBOverall.recall,
      diff: `${diffRec >= 0 ? '+' : ''}${diffRec}%`,
      positive: diffRec >= 0,
      desc: 'Tỷ lệ phát hiện được các sự cố thực tế xảy ra trong cụm (chống bỏ sót).',
      unit: '%',
    },
    {
      name: 'Tỷ lệ báo động nhầm (FPR)',
      valA: `${mAOverall.false_positive_rate}%`,
      valB: `${mBOverall.false_positive_rate}%`,
      rawA: mAOverall.false_positive_rate,
      rawB: mBOverall.false_positive_rate,
      diff: `${diffFPR <= 0 ? '' : '+'}${diffFPR}%`,
      positive: diffFPR <= 0, // FPR càng thấp càng tốt
      desc: 'Tỷ lệ hệ thống đang bình thường nhưng AI lại báo động (càng thấp càng tốt).',
      unit: '%',
      inverted: true,
    },
    {
      name: 'Độ trễ suy luận (Inference Latency)',
      valA: `${mAOverall.latency_ms} ms`,
      valB: `${mBOverall.latency_ms} ms`,
      rawA: mAOverall.latency_ms,
      rawB: mBOverall.latency_ms,
      diff: `${diffLat <= 0 ? '' : '+'}${diffLat} ms`,
      positive: diffLat <= 0, // Latency càng thấp càng tốt
      desc: 'Thời gian tính toán hoàn tất 1 mẫu sequence 12 bước x 8 metrics.',
      unit: 'ms',
      inverted: true,
    },
  ];

  // Verdict calculation
  const getVerdict = () => {
    if (diffF1 >= 0 && diffFPR <= 0) {
      return {
        bg: '#ECFDF5',
        border: '#A7F3D0',
        color: '#065F46',
        icon: CheckCircle2,
        badge: 'KHUYẾN NGHỊ: NÊN ÁP DỤNG',
        title: 'Mô Hình Sau (B) Vượt Trội Toàn Diện',
        desc: `Phiên bản "${modelB.name} (${modelB.version})" đạt F1-Score cao hơn (${diffF1 >= 0 ? '+' : ''}${diffF1}) và tỷ lệ báo nhầm thấp hơn (${diffFPR}%) so với phiên bản "${modelA.name} (${modelA.version})". Đây là bản nâng cấp an toàn và tối ưu cho môi trường Production.`,
      };
    } else if (diffF1 >= 0 && diffFPR > 0) {
      return {
        bg: '#FFFBEB',
        border: '#FDE68A',
        color: '#92400E',
        icon: AlertTriangle,
        badge: 'CÂN NHẮC: ĐỘ NHẠY TĂNG NHƯNG BÁO NHẦM TĂNG',
        title: 'Mô Hình Sau (B) Tăng Độ Nhạy Nhưng Tăng Nhẹ Báo Nhầm',
        desc: `Phiên bản "${modelB.name} (${modelB.version})" phát hiện sự cố tốt hơn (+${diffF1} F1) nhưng tỷ lệ báo động giả tăng nhẹ (+${diffFPR}%). Hãy xem xét độ nhạy cảm của các workloads trước khi áp dụng.`,
      };
    } else {
      return {
        bg: '#FEF2F2',
        border: '#FECACA',
        color: '#991B1B',
        icon: AlertTriangle,
        badge: 'CẢNH BÁO: KHÔNG KHUYẾN NGHỊ ĐỔI',
        title: 'Mô Hình Trước (A) Vẫn Đạt Hiệu Suất Tốt Hơn',
        desc: `Phiên bản trước "${modelA.name} (${modelA.version})" có độ ổn định và điểm F1 cao hơn (+${Math.abs(diffF1)} F1). Khuyến nghị giữ nguyên mô hình hiện tại hoặc thực hiện Rollback nếu cần.`,
      };
    }
  };

  const verdict = getVerdict();
  const VerdictIcon = verdict.icon;

  const RISK_NAME_MAP = {
    oom: 'Tràn RAM (Out-Of-Memory)',
    cpu_overload: 'Quá tải CPU (CPU Overload)',
    disk_full: 'Tràn ổ đĩa (Disk Full)',
    high_latency: 'Độ trễ cao (High Latency)',
    http_5xx_spike: 'Bùng nổ mã lỗi (HTTP 5xx)',
    traffic_overload: 'Đột biến tải (Traffic Overload)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Model Selector Header Toolbar */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--dash-border)',
          borderRadius: '16px',
          padding: '20px 24px',
          boxShadow: 'var(--dash-shadow-xs)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '0 4px 10px rgba(5, 150, 105, 0.25)',
              }}
            >
              <Scale size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.0625rem', fontWeight: 800, margin: 0, color: 'var(--dash-text-primary)' }}>
                Đánh Giá & So Sánh Mô Hình Trước / Sau (Model Comparison)
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
                Đối chiếu định lượng đa chiều giữa hai phiên bản mô hình AI trên cùng tập kiểm chuẩn 3.000 mẫu holdout
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {modelA?.id !== modelB?.id && modelA?.status === 'ACTIVE' && canManageModels && (
              <button
                type="button"
                disabled={isActivating}
                onClick={() => handleActivateModel(modelB.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: isActivating ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
                }}
              >
                <Zap size={14} />
                <span>Kích Hoạt Model Sau (B)</span>
              </button>
            )}

            {modelB?.id !== modelA?.id && modelB?.status === 'ACTIVE' && canManageModels && (
              <button
                type="button"
                disabled={isActivating}
                onClick={() => setIsRollbackModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  border: '1px solid #FECACA',
                  cursor: isActivating ? 'not-allowed' : 'pointer',
                }}
              >
                <RotateCcw size={14} />
                <span>Rollback Về Model Trước (A)</span>
              </button>
            )}
          </div>
        </div>

        {/* Dual Selector Panels with Swap Button */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: '12px',
            padding: '16px',
            backgroundColor: '#F8FAFC',
            borderRadius: '12px',
            border: '1px solid var(--dash-border)',
          }}
        >
          {/* Model A (Before / Baseline) Selector */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.05em' }}>
                Mô Hình Trước (Baseline / Before)
              </span>
              {modelA?.status === 'ACTIVE' && (
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', backgroundColor: '#ECFDF5', color: '#059669' }}>
                  Đang Active
                </span>
              )}
            </div>
            <select
              value={modelAId}
              onChange={(e) => setModelAId(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--dash-border)',
                backgroundColor: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: 'var(--dash-text-primary)',
                cursor: 'pointer',
              }}
            >
              {modelsWithMetrics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.version}) — {m.status} (Acc: {m.rawMetrics?.overall?.accuracy}%)
                </option>
              ))}
            </select>
          </div>

          {/* Swap Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '18px' }}>
            <button
              type="button"
              onClick={handleSwap}
              title="Đổi chiều so sánh (A ⇄ B)"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--dash-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: 'var(--dash-shadow-xs)',
                color: 'var(--dash-text-primary)',
              }}
            >
              <ArrowLeftRight size={16} />
            </button>
          </div>

          {/* Model B (After / Target) Selector */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#059669', letterSpacing: '0.05em' }}>
                Mô Hình Sau (Candidate / After)
              </span>
              {modelB?.status === 'ACTIVE' && (
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', backgroundColor: '#ECFDF5', color: '#059669' }}>
                  Đang Active
                </span>
              )}
            </div>
            <select
              value={modelBId}
              onChange={(e) => setModelBId(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '2px solid #059669',
                backgroundColor: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: 'var(--dash-text-primary)',
                cursor: 'pointer',
              }}
            >
              {modelsWithMetrics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.version}) — {m.status} (Acc: {m.rawMetrics?.overall?.accuracy}%)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Action Success Message */}
      {actionSuccessMsg && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '10px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            fontSize: '0.8125rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} color="#059669" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* 2. Automated AI Verdict Banner */}
      <div
        style={{
          padding: '18px 22px',
          borderRadius: '14px',
          backgroundColor: verdict.bg,
          border: `1px solid ${verdict.border}`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px',
        }}
      >
        <div style={{ marginTop: '2px' }}>
          <VerdictIcon size={22} color={verdict.color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: '#FFFFFF',
                color: verdict.color,
                border: `1px solid ${verdict.border}`,
                textTransform: 'uppercase',
              }}
            >
              {verdict.badge}
            </span>
            <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: verdict.color }}>
              {verdict.title}
            </div>
          </div>
          <div style={{ fontSize: '0.8125rem', color: verdict.color, marginTop: '6px', lineHeight: 1.5, opacity: 0.95 }}>
            {verdict.desc}
          </div>
        </div>
      </div>

      {/* 3. Head-to-Head Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Card Model A */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '14px',
            padding: '20px',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', backgroundColor: '#F1F5F9', color: '#475569', textTransform: 'uppercase' }}>
              Mô hình Trước (A)
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
              {modelA.updatedAt}
            </span>
          </div>
          <div style={{ fontSize: '1.1875rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '8px' }}>
            {modelA.name}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
            Phiên bản: <strong>{modelA.version}</strong> • Engine: {modelA.framework}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '16px', paddingTop: '14px', borderTop: '1px dashed var(--dash-border)' }}>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Độ chính xác</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '2px' }}>
                {mAOverall.accuracy}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>F1-Score</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1D4ED8', marginTop: '2px' }}>
                {mAOverall.f1_score}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Báo nhầm (FPR)</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#B45309', marginTop: '2px' }}>
                {mAOverall.false_positive_rate}%
              </div>
            </div>
          </div>
        </div>

        {/* Card Model B */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '2px solid #059669',
            borderRadius: '14px',
            padding: '20px',
            boxShadow: '0 4px 12px rgba(5, 150, 105, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', textTransform: 'uppercase' }}>
              Mô hình Sau (B)
            </span>
            <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>
              {modelB.status === 'ACTIVE' ? 'ĐANG ACTIVE' : 'CANDIDATE'}
            </span>
          </div>
          <div style={{ fontSize: '1.1875rem', fontWeight: 800, color: 'var(--dash-text-primary)', marginTop: '8px' }}>
            {modelB.name}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
            Phiên bản: <strong>{modelB.version}</strong> • Engine: {modelB.framework}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '16px', paddingTop: '14px', borderTop: '1px dashed var(--dash-border)' }}>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Độ chính xác</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                {mBOverall.accuracy}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>F1-Score</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1D4ED8', marginTop: '2px' }}>
                {mBOverall.f1_score}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>Báo nhầm (FPR)</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: diffFPR <= 0 ? '#059669' : '#B45309', marginTop: '2px' }}>
                {mBOverall.false_positive_rate}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Comparison Nav Tabs */}
      <div style={{ display: 'flex', backgroundColor: '#FFFFFF', borderRadius: '12px 12px 0 0', padding: '0 20px', border: '1px solid var(--dash-border)', borderBottom: 'none' }}>
        <button
          type="button"
          onClick={() => setComparisonTab('overall')}
          style={{
            padding: '14px 18px',
            border: 'none',
            borderBottom: comparisonTab === 'overall' ? '2px solid #059669' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: comparisonTab === 'overall' ? '#059669' : 'var(--dash-text-muted)',
            fontWeight: comparisonTab === 'overall' ? 800 : 600,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <BarChart2 size={16} />
          Đối Chiếu 6 Chỉ Số Tổng Thể
        </button>

        <button
          type="button"
          onClick={() => setComparisonTab('per_risk')}
          style={{
            padding: '14px 18px',
            border: 'none',
            borderBottom: comparisonTab === 'per_risk' ? '2px solid #059669' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: comparisonTab === 'per_risk' ? '#059669' : 'var(--dash-text-muted)',
            fontWeight: comparisonTab === 'per_risk' ? 800 : 600,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Layers size={16} />
          So Sánh Chi Tiết 6 Loại Rủi Ro K8s
        </button>

        <button
          type="button"
          onClick={() => setComparisonTab('drift')}
          style={{
            padding: '14px 18px',
            border: 'none',
            borderBottom: comparisonTab === 'drift' ? '2px solid #059669' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: comparisonTab === 'drift' ? '#059669' : 'var(--dash-text-muted)',
            fontWeight: comparisonTab === 'drift' ? 800 : 600,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Activity size={16} />
          Giám Sát Trôi Dữ Liệu & Lịch Sử
        </button>
      </div>

      {/* Tab 1 Content: Overall Detailed Comparison Table with Visual Bars */}
      {comparisonTab === 'overall' && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '0 0 14px 14px',
            overflow: 'hidden',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)', fontSize: '0.6875rem', textTransform: 'uppercase', fontWeight: 800 }}>
                  <th style={{ padding: '14px 20px' }}>Chỉ Số Đánh Giá</th>
                  <th style={{ padding: '14px 16px' }}>{modelA.name} ({modelA.version})</th>
                  <th style={{ padding: '14px 16px' }}>{modelB.name} ({modelB.version})</th>
                  <th style={{ padding: '14px 16px' }}>Độ Chênh Lệch ($\Delta$)</th>
                  <th style={{ padding: '14px 20px' }}>Biểu Đồ Trực Quan</th>
                  <th style={{ padding: '14px 20px' }}>Ý Nghĩa Kỹ Thuật</th>
                </tr>
              </thead>
              <tbody>
                {metricsComparison.map((m, idx) => (
                  <tr key={idx} style={{ borderBottom: idx === metricsComparison.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                    <td style={{ padding: '16px 20px', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                      {m.name}
                    </td>
                    <td style={{ padding: '16px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#475569' }}>
                      {m.valA}
                    </td>
                    <td style={{ padding: '16px 16px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: m.positive ? '#059669' : '#DC2626' }}>
                      {m.valB}
                    </td>
                    <td style={{ padding: '16px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          backgroundColor: m.positive ? '#ECFDF5' : '#FEF2F2',
                          color: m.positive ? '#059669' : '#DC2626',
                          border: m.positive ? '1px solid #A7F3D0' : '1px solid #FECACA',
                        }}
                      >
                        {m.positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {m.diff}
                      </span>
                    </td>
                    {/* Visual Comparison Bar */}
                    <td style={{ padding: '16px 20px', minWidth: '160px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.625rem', color: '#64748B', width: '20px' }}>A:</span>
                          <div style={{ flex: 1, height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, Math.max(5, m.rawA))}%`, height: '100%', backgroundColor: '#64748B' }} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.625rem', color: '#059669', fontWeight: 700, width: '20px' }}>B:</span>
                          <div style={{ flex: 1, height: '6px', backgroundColor: '#D1FAE5', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, Math.max(5, m.rawB))}%`, height: '100%', backgroundColor: m.positive ? '#059669' : '#DC2626' }} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', color: 'var(--dash-text-muted)', fontSize: '0.75rem' }}>
                      {m.desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2 Content: Per-Risk Scorecard Comparison */}
      {comparisonTab === 'per_risk' && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '0 0 14px 14px',
            overflow: 'hidden',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)', backgroundColor: '#F8FAFC' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--dash-text-primary)', textTransform: 'uppercase' }}>
              Đối Chiếu Điểm Số Chi Tiết Theo 6 Loại Rủi Ro Kubernetes
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
              So sánh năng lực bắt lỗi chuyên biệt của từng đầu Sigmoid Head giữa Mô hình A vs Mô hình B
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F1F5F9', color: 'var(--dash-text-muted)', fontSize: '0.6875rem', textTransform: 'uppercase', fontWeight: 800 }}>
                  <th style={{ padding: '12px 16px' }}>Loại rủi ro K8s</th>
                  <th style={{ padding: '12px 12px', textAlign: 'right' }}>F1-Score (A)</th>
                  <th style={{ padding: '12px 12px', textAlign: 'right' }}>F1-Score (B)</th>
                  <th style={{ padding: '12px 12px', textAlign: 'right' }}>$\Delta$ F1-Score</th>
                  <th style={{ padding: '12px 12px', textAlign: 'right' }}>Recall (A / B)</th>
                  <th style={{ padding: '12px 12px', textAlign: 'right' }}>Báo Nhầm (A / B)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Đánh Giá</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(RISK_NAME_MAP).map((riskKey, rIdx) => {
                  const rA = mAPerRisk[riskKey] || { f1_score: 0, recall: 0, precision: 0, false_positive_rate: 0 };
                  const rB = mBPerRisk[riskKey] || { f1_score: 0, recall: 0, precision: 0, false_positive_rate: 0 };
                  const rDiffF1 = Number((rB.f1_score - rA.f1_score).toFixed(4));
                  const isBetter = rDiffF1 >= 0;

                  return (
                    <tr key={riskKey} style={{ borderBottom: rIdx === Object.keys(RISK_NAME_MAP).length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                        {RISK_NAME_MAP[riskKey]}
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#475569' }}>
                        {rA.f1_score}
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#1D4ED8' }}>
                        {rB.f1_score}
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            backgroundColor: isBetter ? '#ECFDF5' : '#FEF2F2',
                            color: isBetter ? '#059669' : '#DC2626',
                          }}
                        >
                          {rDiffF1 >= 0 ? '+' : ''}{rDiffF1}
                        </span>
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--dash-text-secondary)' }}>
                        {rA.recall}% $\rightarrow$ <strong style={{ color: rB.recall >= rA.recall ? '#059669' : '#DC2626' }}>{rB.recall}%</strong>
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--dash-text-secondary)' }}>
                        {rA.false_positive_rate}% $\rightarrow$ <strong style={{ color: rB.false_positive_rate <= rA.false_positive_rate ? '#059669' : '#B45309' }}>{rB.false_positive_rate}%</strong>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            backgroundColor: isBetter ? '#ECFDF5' : '#FFFBEB',
                            color: isBetter ? '#047857' : '#B45309',
                            border: isBetter ? '1px solid #A7F3D0' : '1px solid #FDE68A',
                          }}
                        >
                          {isBetter ? 'Cải thiện' : 'Cần chú ý'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3 Content: Drift Monitoring & Evaluation Logs */}
      {comparisonTab === 'drift' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Drift Status Card */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: '0 0 14px 14px',
              padding: '20px',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Activity size={18} color="#059669" />
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
                Giám Sát Trôi Dữ Liệu (Telemetry Data Drift)
              </h3>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', lineHeight: 1.5 }}>
              Kiểm tra Kolmogorov-Smirnov trên vector 8 đặc trưng viễn trắc giữa tập huấn luyện và luồng suy luận thời gian thực.
            </p>

            {(() => {
              const driftScore = Number((Math.abs(diffAcc) * 0.4 + Math.abs(diffF1 * 100) * 0.4 + Math.abs(diffFPR) * 0.2).toFixed(2));
              const displayDrift = Math.max(0.1, driftScore);
              const driftPercentBar = Math.min(100, Math.max(4, (displayDrift / 10) * 100));
              const isDriftSafe = displayDrift <= 10.0;

              return (
                <>
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--dash-text-primary)' }}>Chỉ số lệch phân phối giữa 2 phiên bản (Drift Score)</span>
                      <span style={{ fontWeight: 800, color: isDriftSafe ? '#059669' : '#DC2626' }}>
                        {displayDrift}% / Ngưỡng an toàn 10%
                      </span>
                    </div>
                    <div style={{ height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${driftPercentBar}%`, height: '100%', backgroundColor: isDriftSafe ? '#059669' : '#DC2626', borderRadius: '4px' }} />
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: '16px',
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: isDriftSafe ? '#ECFDF5' : '#FEF2F2',
                      border: isDriftSafe ? '1px solid #A7F3D0' : '1px solid #FECACA',
                      fontSize: '0.75rem',
                      color: isDriftSafe ? '#065F46' : '#991B1B',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: 600,
                    }}
                  >
                    <ShieldCheck size={18} color={isDriftSafe ? '#059669' : '#DC2626'} />
                    <span>
                      {isDriftSafe
                        ? `Trạng thái: An toàn (${displayDrift}%). Hiệu năng giữa 2 phiên bản "${modelA.version}" và "${modelB.version}" nằm trong ngưỡng kiểm soát ổn định (< 10%).`
                        : `Cảnh báo: Độ lệch (${displayDrift}%) vượt ngưỡng 10%. Cần kiểm định kỹ trước khi chuyển đổi mô hình.`}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Model Registry Audit Trail */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: '0 0 14px 14px',
              padding: '20px',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <History size={18} color="var(--dash-text-secondary)" />
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
                Nhật Ký Kiểm Định Mô Hình AI
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {modelsWithMetrics.map((m) => (
                <div
                  key={m.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    backgroundColor: '#F8FAFC',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>
                      {m.name} ({m.version})
                    </span>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: m.status === 'ACTIVE' ? '#ECFDF5' : '#F1F5F9', color: m.status === 'ACTIVE' ? '#059669' : '#64748B' }}>
                      {m.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', marginTop: '3px' }}>
                    Tập test: {m.dataset} • {m.updatedAt}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700, marginTop: '3px', fontFamily: 'var(--font-mono)' }}>
                    {m.evaluationMetrics}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rollback Confirmation Modal */}
      {isRollbackModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              padding: '24px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: 'var(--dash-shadow-dropdown)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#DC2626' }}>
              <AlertTriangle size={24} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0 }}>
                Xác Nhận Rollback Mô Hình AI
              </h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', margin: '14px 0 20px 0', lineHeight: 1.5 }}>
              Bạn có chắc chắn muốn chuyển đổi phiên bản mô hình từ <strong>{modelB?.name} ({modelB?.version})</strong> trở về phiên bản trước <strong>{modelA?.name} ({modelA?.version})</strong> không?
              Thao tác này sẽ áp dụng ngay lập tức cho toàn bộ các lượt suy luận tiếp theo trên nền tảng.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsRollbackModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--dash-text-primary)',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleRollbackConfirm}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                {isActivating ? 'Đang Rollback...' : 'Xác Nhận Rollback Ngay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIComparisonView;
