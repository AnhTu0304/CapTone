import React, { useState, useEffect, useMemo } from 'react';
import { aiService } from '../../../services/aiService';
import {
  X,
  GitBranch,
  CheckCircle2,
  Zap,
  Terminal,
  ShieldCheck,
  Check,
  Copy,
  Activity,
  Sliders,
  FileText,
  Cpu,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Database,
  Layers,
  Clock,
  HardDrive,
  Server
} from 'lucide-react';

export const RootCauseModal = ({ incident, onClose, onResolve }) => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'causal' | 'io'
  const [isCopied, setIsCopied] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [evidenceList, setEvidenceList] = useState(incident?.evidences || []);
  const [incidentDetail, setIncidentDetail] = useState(null);
  const [parsedAnalysis, setParsedAnalysis] = useState(null);
  const [predictionInputs, setPredictionInputs] = useState([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const targetId = incident?.rawId || incident?.id;

    if (targetId) {
      setIsLoadingDetail(true);
      Promise.all([
        aiService.getIncidentEvidences(targetId),
        aiService.getIncidentDetail(targetId),
      ])
        .then(async ([evData, detailData]) => {
          if (!isMounted) return;
          const items = Array.isArray(evData) ? evData : evData?.items || [];
          if (items.length > 0) {
            const mapped = items.map((ev, idx) => {
              let summary = '';
              try {
                const d = typeof ev.evidence_data === 'string' ? JSON.parse(ev.evidence_data) : ev.evidence_data;
                summary = d?.summary || JSON.stringify(d);
              } catch {
                summary = String(ev.evidence_data || ev.source_reference || '');
              }
              return {
                type: ev.source_type || 'AI_TELEMETRY',
                ref: ev.source_reference || incident?.service,
                summary: summary || 'Ghi nhận bất thường qua viễn trắc',
                score: `${Math.round((Number(ev.importance_score || 0.95) - idx * 0.02) * 100)}%`,
              };
            });
            setEvidenceList(mapped);
          }

          if (detailData) {
            setIncidentDetail(detailData);
            let parsed = null;
            if (detailData.analysis_result) {
              try {
                parsed = typeof detailData.analysis_result === 'string'
                  ? JSON.parse(detailData.analysis_result)
                  : detailData.analysis_result;
              } catch {}
            }
            setParsedAnalysis(parsed);

            const predId = detailData.prediction_id || incident.predictionId;
            if (predId) {
              try {
                const inputs = await aiService.getPredictionInputs(predId);
                if (isMounted && Array.isArray(inputs)) {
                  setPredictionInputs(inputs);
                }
              } catch {}
            }
          }
        })
        .catch((err) => {
          console.warn('[RootCauseModal] Lỗi nạp chi tiết:', err);
        })
        .finally(() => {
          if (isMounted) setIsLoadingDetail(false);
        });
    } else {
      setEvidenceList(incident?.evidences || []);
    }

    return () => {
      isMounted = false;
    };
  }, [incident?.rawId, incident?.id, incident?.service, incident?.predictionId]);
  const isResolved = (incidentDetail?.status || incident?.status || '').toLowerCase().includes('resolve') ||
    (incident?.status && incident?.status.includes('hoàn tất'));

  const rawConfidence = incidentDetail?.rca_confidence ?? incident?.confidence ?? parsedAnalysis?.root_cause?.confidence ?? 0.60;
  const confidence = Math.round(Number(rawConfidence) <= 1 ? Number(rawConfidence) * 100 : Number(rawConfidence));

  const rootCauseType = incidentDetail?.root_cause_type || parsedAnalysis?.root_cause?.cause || incident?.rootCauseType || 'Unstable application pod';
  const rootCauseDesc = incidentDetail?.root_cause_description || parsedAnalysis?.explanation || incident?.rootCause || 'Hệ thống tự động phát hiện mẫu hành vi bất thường từ chuỗi viễn trắc AI.';
  const severity = incidentDetail?.severity || parsedAnalysis?.root_cause?.severity || incident?.severity || 'HIGH';
  const recAction = parsedAnalysis?.recommendation?.action || incident?.recommendationAction || 'RESTART_POD';
  const recReason = parsedAnalysis?.recommendation?.reason || incident?.recommendationReason || 'The affected pod is unhealthy or repeatedly restarting';
  const thresholds = parsedAnalysis?.prediction?.thresholds;

  const handleCopyLogs = () => {
    const logText = evidenceList && evidenceList.length > 0
      ? evidenceList.map((e) => `[${e.type}] (${e.ref}) ${e.summary}`).join('\n')
      : `kernel: readiness probe failing on ${incident?.service}`;
    navigator.clipboard?.writeText(logText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleExecuteRemediation = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      if (onResolve) onResolve(incident?.id, incident?.rawId);
    }, 600);
  };



  // Chuỗi 12 mốc viễn trắc đầu vào nhóm theo thời điểm
  const formattedTimesteps = useMemo(() => {
    if (!predictionInputs || predictionInputs.length === 0) return [];

    const map = new Map();
    predictionInputs.forEach((item) => {
      const key = item.collected_at ? new Date(item.collected_at).toISOString() : (item.id || Math.random().toString());
      if (!map.has(key)) {
        const d = new Date(item.collected_at);
        const timeLabel = isNaN(d.getTime())
          ? ''
          : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        map.set(key, {
          rawTime: item.collected_at,
          timeLabel,
          cpu: 0,
          ram: 0,
          disk: 0,
          latency: 0,
          request_rate: 0,
          http_5xx_rate: 0,
          pod_restart_count: 0,
          replica_count: 0,
        });
      }
      const entry = map.get(key);
      const mName = item.metric_name?.toLowerCase();
      const val = parseFloat(item.metric_value) || 0;
      if (mName && entry[mName] !== undefined) {
        entry[mName] = val;
      }
    });

    const sorted = Array.from(map.values()).sort(
      (a, b) => new Date(a.rawTime) - new Date(b.rawTime)
    );

    return sorted.map((item, idx) => ({
      ...item,
      step: idx + 1,
      stepLabel: `T${idx + 1}`,
      displayTime: item.timeLabel || `T${idx + 1}`,
    }));
  }, [predictionInputs]);

  // Thống kê 8 chỉ số tổng hợp (Hiện tại T12, TB, Max)
  const metricSummary = useMemo(() => {
    if (formattedTimesteps.length === 0) return null;
    const len = formattedTimesteps.length;
    const latest = formattedTimesteps[len - 1];

    const getStats = (key) => {
      const vals = formattedTimesteps.map((t) => Number(t[key]) || 0);
      const sum = vals.reduce((a, b) => a + b, 0);
      const avg = sum / len;
      const max = Math.max(...vals);
      return {
        current: Number(latest[key]) || 0,
        avg: Math.round(avg * 100) / 100,
        max: Math.round(max * 100) / 100,
      };
    };

    return {
      cpu: getStats('cpu'),
      ram: getStats('ram'),
      disk: getStats('disk'),
      latency: getStats('latency'),
      request_rate: getStats('request_rate'),
      http_5xx_rate: getStats('http_5xx_rate'),
      pod_restart_count: latest.pod_restart_count || 0,
      replica_count: latest.replica_count || 0,
    };
  }, [formattedTimesteps]);

    // Chuỗi quan hệ nhân quả suy diễn động 4 bước
  const causalChainSteps = useMemo(() => {
    const rc = (rootCauseType || '').toLowerCase();

    // 1. Lỗi ứng dụng / HTTP 5xx spike
    if (rc.includes('http_5xx') || rc.includes('application error') || rc.includes('5xx') || rc.includes('lỗi')) {
      const spike5xx = metricSummary?.http_5xx_rate?.max ? `${metricSummary.http_5xx_rate.max}%` : 'tới hạn';
      return [
        {
          step: '1. Đột biến mã lỗi HTTP 5xx',
          desc: `Tác tử eBPF & Ingress ghi nhận tỷ lệ lỗi HTTP 5xx leo thang chạm đỉnh ${spike5xx} trên dịch vụ ${incident?.service}.`,
        },
        {
          step: '2. Suy giảm chất lượng dịch vụ SLA',
          desc: 'Các yêu cầu xử lý từ phía client liên tục thất bại, gián đoạn phiên làm việc và kích hoạt cảnh báo SLO.',
        },
        {
          step: '3. Định vị & Phân tích nguyên nhân',
          desc: `Mô hình AI chẩn đoán trạng thái Application errors (độ tin cậy ${confidence}%), phân tích chi tiết nhật ký rca_evidences.`,
        },
        {
          step: '4. Tự phục hồi Zero-Downtime',
          desc: `MAPE-K điều phối hành động ${recAction} để tái tạo trạng thái sạch và phục hồi thông suốt dịch vụ.`,
        },
      ];
    }

    // 2. Quá tải CPU
    if (rc.includes('cpu') || rc.includes('saturation') || rc.includes('overload')) {
      const maxCpu = metricSummary?.cpu?.max ? `${metricSummary.cpu.max}%` : '95%+';
      return [
        {
          step: '1. Đột biến tải lưu lượng',
          desc: `Lưu lượng yêu cầu xử lý tăng vọt đột biến trên dịch vụ ${incident?.service}.`,
        },
        {
          step: '2. Bão hòa tài nguyên CPU',
          desc: `CPU utilization leo thang chạm ngưỡng tới hạn ${maxCpu} trong chuỗi viễn trắc 12 mốc thời gian.`,
        },
        {
          step: '3. Phân tích lịch sử tự lành',
          desc: 'Hệ thống đối chiếu lịch sử hành động trước đó, loại trừ giải pháp thất bại và xác định quy mô cần bù đắp.',
        },
        {
          step: '4. Tự phục hồi quy mô',
          desc: `MAPE-K kích hoạt ${recAction} để mở rộng bản sao và phân tán tải đều trên cụm K8s.`,
        },
      ];
    }

    // 3. Quá tải độ trễ / Latency
    if (rc.includes('latency') || rc.includes('chậm') || rc.includes('trễ')) {
      const maxLat = metricSummary?.latency?.max ? `${metricSummary.latency.max} ms` : 'cao';
      return [
        {
          step: '1. Gia tăng độ trễ mạng/xử lý',
          desc: `Độ trễ phản hồi (latency) tăng cao chạm mốc ${maxLat} trên ${incident?.service}.`,
        },
        {
          step: '2. Nghẽn luồng truy vấn (I/O Bottleneck)',
          desc: 'Các yêu cầu bị ứ đọng trong hàng đợi dịch vụ, làm chậm thời gian hoàn tất giao dịch.',
        },
        {
          step: '3. Đánh giá chuỗi phụ thuộc',
          desc: 'Mô hình AI phát hiện điểm nghẽn và đưa ra khuyến nghị tối ưu hóa tài nguyên.',
        },
        {
          step: '4. Phục hồi hiệu năng',
          desc: `MAPE-K thực thi ${recAction} để tái cân bằng tải và giảm độ trễ về dưới ngưỡng chuẩn.`,
        },
      ];
    }

    // 4. Pod không ổn định / CrashLoopBackOff / Restarts
    if (rc.includes('unstable') || rc.includes('pod') || rc.includes('crash') || rc.includes('restart')) {
      const restarts = metricSummary?.pod_restart_count ?? incidentDetail?.restart_count ?? 1;
      return [
        {
          step: '1. Kiểm tra Liveness/Readiness',
          desc: `Kubelet Probe ghi nhận Pod ${incident?.service} không phản hồi endpoint kiểm tra sẵn sàng.`,
        },
        {
          step: '2. Tích tụ lỗi tiến trình',
          desc: `Tiến trình bên trong container gặp ngoại lệ, số lần khởi động lại tăng lên ${restarts} lần.`,
        },
        {
          step: '3. Cách ly & Suy diễn hạ tầng',
          desc: `Mô hình AI chẩn đoán trạng thái Unstable application pod, phân luồng lưu lượng truy cập an toàn.`,
        },
        {
          step: '4. Tự phục hồi Zero-Downtime',
          desc: `MAPE-K kích hoạt lệnh ${recAction} để tái sinh Pod sạch và khôi phục hoạt động bình thường.`,
        },
      ];
    }

    return incident?.causalSteps || [
      { step: '1. Tín hiệu sơ cấp', desc: `Phát hiện dị thường viễn trắc từ eBPF Kernel Probe trên ${incident?.service}.` },
      { step: '2. Tích tụ tài nguyên', desc: 'Mô hình AI dự báo xu hướng suy giảm hiệu năng vượt ngưỡng cảnh báo.' },
      { step: '3. Đánh giá chuỗi lan truyền', desc: 'Kubelet ghi nhận cảnh báo bất thường, kích hoạt chẩn đoán nguyên nhân gốc rễ.' },
      { step: '4. Tự lành & Khôi phục', desc: `MAPE-K thực thi ${recAction} nhằm bảo toàn SLA dịch vụ.` },
    ];
  }, [rootCauseType, incident?.service, recAction, confidence, metricSummary, incidentDetail, incident?.causalSteps]);

  const previousActionInfo = parsedAnalysis?.previous_action || incidentDetail?.previous_action || 'RESTART_POD';
  const previousActionResult = parsedAnalysis?.previous_action_result || incidentDetail?.previous_action_result || (isResolved ? 'SUCCESS' : 'PENDING');

  if (!incident) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
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
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '92vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 60px -15px rgba(6, 95, 70, 0.35), 0 0 0 1px rgba(16, 185, 129, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Glossy Emerald Gradient */}
        <div
          style={{
            padding: '16px 22px',
            background: 'linear-gradient(135deg, #065F46 0%, #047857 55%, #059669 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 6px rgba(6, 95, 70, 0.15)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '9px',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)',
              }}
            >
              <GitBranch size={20} color="#A7F3D0" />
            </div>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Chi Tiết Sự Cố &amp; Phân Tích Nguyên Nhân Gốc Rễ (RCA)</span>
                <span
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: '#FFFFFF',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.6875rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                  }}
                >
                  {incident?.id}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#D1FAE5', marginTop: '2px', fontWeight: 500 }}>
                Dịch vụ: <strong style={{ color: '#FFFFFF' }}>{incident?.service}</strong> &bull; Cụm K8s:{' '}
                <strong style={{ color: '#FFFFFF' }}>{incidentDetail?.cluster_name || incident.cluster || 'k8s-cluster'}</strong> &bull; Tin cậy AI:{' '}
                <span
                  style={{
                    backgroundColor: 'rgba(253, 230, 138, 0.25)',
                    color: '#FDE68A',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontWeight: 700,
                  }}
                >
                  {confidence}% Multi-Agent
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#D1FAE5',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Sub-navigation Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            padding: '0 22px',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '10px 14px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: activeTab === 'overview' ? '#059669' : '#64748B',
              border: 'none',
              borderBottom: activeTab === 'overview' ? '2px solid #059669' : '2px solid transparent',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Sparkles size={14} />
            <span>Chẩn Đoán &amp; Tự Lành</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('causal')}
            style={{
              padding: '10px 14px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: activeTab === 'causal' ? '#059669' : '#64748B',
              border: 'none',
              borderBottom: activeTab === 'causal' ? '2px solid #059669' : '2px solid transparent',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <GitBranch size={14} />
            <span>Chuỗi Nhân Quả &amp; Bằng Chứng</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('io')}
            style={{
              padding: '10px 14px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: activeTab === 'io' ? '#059669' : '#64748B',
              border: 'none',
              borderBottom: activeTab === 'io' ? '2px solid #059669' : '2px solid transparent',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Database size={14} />
            <span>Dữ Liệu Vào / Ra Chi Tiết (LLM I/O)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px', flex: '1 1 auto' }}>
          {isLoadingDetail && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#059669', backgroundColor: '#ECFDF5', padding: '6px 12px', borderRadius: '6px', border: '1px solid #A7F3D0' }}>
              <RefreshCw size={12} className="animate-spin" />
              <span>Đang đồng bộ dữ liệu chi tiết từ cơ sở dữ liệu PostgreSQL...</span>
            </div>
          )}

          {/* TAB 1: OVERVIEW & REMEDIATION */}
          {activeTab === 'overview' && (
            <>
              {/* PHẦN 1: KẾT LUẬN NGUYÊN NHÂN CỐT LÕI */}
              <div
                style={{
                  padding: '16px 18px',
                  backgroundColor: isResolved ? '#F0FDF4' : '#FEF2F2',
                  borderRadius: '12px',
                  border: isResolved ? '1px solid #BBF7D0' : '1px solid #FECACA',
                  borderLeft: isResolved ? '5px solid #10B981' : '5px solid #EF4444',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: isResolved ? '#166534' : '#991B1B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={15} />
                    <span>KẾT LUẬN NGUYÊN NHÂN CỐT LÕI (RCA ROOT CAUSE)</span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '10px',
                      backgroundColor: isResolved ? '#DCFCE7' : '#FEE2E2',
                      color: isResolved ? '#15803D' : '#B91C1C',
                    }}
                  >
                    Mức độ: {severity === 'HIGH' ? 'CAO (HIGH)' : severity}
                  </span>
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: isResolved ? '#15803D' : '#B91C1C', marginBottom: '6px' }}>
                  {rootCauseType}
                </div>
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '0.8125rem',
                    color: '#334155',
                    lineHeight: 1.6,
                    marginBottom: '8px',
                  }}
                >
                  <strong style={{ color: '#0F172A' }}>Diễn giải AI SRE: </strong>
                  {rootCauseDesc}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#EFF6FF',
                      color: '#1D4ED8',
                      border: '1px solid #BFDBFE',
                    }}
                  >
                    Rủi ro: {incident.primaryRisk || 'CPU_OVERLOAD / UNSTABLE_POD'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    &bull; Thuật toán: <span style={{ color: '#2563EB', fontWeight: 600 }}>{incidentDetail?.analysis_method || 'AI_DETERMINISTIC_RULES'}</span> &bull; Trạng thái: <strong style={{ color: isResolved ? '#10B981' : '#DC2626' }}>{isResolved ? 'ĐÃ KHẮC PHỤC' : 'ĐANG XỬ LÝ'}</strong>
                  </span>
                </div>
              </div>

              {/* PHẦN 2: HÀNH ĐỘNG MAPE-K & TỰ PHỤC HỒI */}
              <div
                style={{
                  padding: '16px 18px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: isResolved ? '1px solid #BBF7D0' : '1px solid #BFDBFE',
                  borderLeft: isResolved ? '5px solid #10B981' : '5px solid #2563EB',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#065F46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Zap size={16} color="#059669" />
                      <span>HÀNH ĐỘNG KHUYẾN NGHỊ: {recAction}</span>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#334155', marginTop: '4px', maxWidth: '580px', lineHeight: 1.5 }}>
                      {recReason}
                    </div>
                    <div style={{ fontSize: '0.71875rem', color: '#059669', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldCheck size={14} />
                      <span>Bảo toàn quy trình Zero-Downtime &bull; Sẵn sàng can thiệp tự động MAPE-K</span>
                    </div>
                  </div>

                  {!isResolved ? (
                    <button
                      type="button"
                      onClick={handleExecuteRemediation}
                      disabled={isExecuting}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '9px 18px',
                        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                        color: '#FFFFFF',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '0.78125rem',
                        fontWeight: 700,
                        cursor: isExecuting ? 'not-allowed' : 'pointer',
                        boxShadow: '0 3px 8px rgba(5, 150, 105, 0.25)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Zap size={14} />
                      <span>{isExecuting ? 'Đang thực thi tự lành...' : 'Kích Hoạt Tự Khắc Phục Ngay'}</span>
                    </button>
                  ) : (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 14px',
                        backgroundColor: '#DCFCE7',
                        color: '#15803D',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.78125rem',
                        border: '1px solid #86EFAC',
                      }}
                    >
                      <CheckCircle2 size={15} />
                      <span>Đã Tự Khắc Phục Hoàn Tất</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 2: CAUSAL INFERENCE & EVIDENCE */}
          {activeTab === 'causal' && (
            <>
              {/* CHUỖI NHÂN QUẢ SUY DIỄN 4 BƯỚC */}
              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <GitBranch size={15} color="#059669" />
                  <span>CHUỖI NHÂN QUẢ SUY DIỄN CỤ THỂ (CAUSAL INFERENCE CHAIN)</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  {causalChainSteps.map((step, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 14px',
                        backgroundColor: '#F8FAFC',
                        borderRadius: '10px',
                        border: '1px solid #E2E8F0',
                        borderTop: '3px solid #059669',
                      }}
                    >
                      <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#059669' }}>
                        {step.step}
                      </div>
                      <div style={{ fontSize: '0.78125rem', color: '#334155', marginTop: '4px', lineHeight: 1.45 }}>
                        {step.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* BẰNG CHỨNG VIỄN TRẮC & NHẬT KÝ CONTAINER */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Terminal size={15} color="#0284C7" />
                    <span>BẰNG CHỨNG VIỄN TRẮC &amp; NHẬT KÝ THỰC TẾ ({evidenceList.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyLogs}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #CBD5E1',
                      borderRadius: '5px',
                      cursor: 'pointer',
                    }}
                  >
                    {isCopied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                    <span>{isCopied ? 'Đã sao chép' : 'Sao chép nhật ký'}</span>
                  </button>
                </div>

                <div
                  style={{
                    backgroundColor: '#0F172A',
                    color: '#E2E8F0',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    lineHeight: 1.6,
                    maxHeight: '180px',
                    overflowY: 'auto',
                    border: '1px solid #1E293B',
                  }}
                >
                  <div style={{ color: '#94A3B8', marginBottom: '6px', borderBottom: '1px solid #1E293B', paddingBottom: '4px' }}>
                    # eBPF Kernel Probe &amp; K8s Event Inspector &bull; Service: {incident?.service} &bull; RCA ID: {incidentDetail?.rca_id ? incidentDetail.rca_id.slice(0, 8) : (incident?.rawId ? incident?.rawId.slice(0, 8) : 'N/A')}
                  </div>

                  {evidenceList && evidenceList.length > 0 ? (
                    evidenceList.map((ev, i) => (
                      <div key={i} style={{ marginBottom: '6px' }}>
                        <span style={{ color: '#38BDF8', fontWeight: 700 }}>[{ev.type}]</span>{' '}
                        <span style={{ color: '#94A3B8' }}>({ev.ref}):</span>{' '}
                        <span style={{ color: '#FDE047' }}>{ev.summary}</span>{' '}
                        <span style={{ color: '#A7F3D0', fontSize: '0.6875rem' }}>(Trọng số: {ev.score})</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: '#94A3B8', fontStyle: 'italic' }}>
                      Chưa có bản ghi nhật ký chi tiết trong bảng rca_evidences.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 3: FULL LLM I/O INSPECTOR */}
          {activeTab === 'io' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* KHỐI ĐẦU VÀO AI / LLM */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '12px 16px',
                    backgroundColor: '#EFF6FF',
                    borderBottom: '1px solid #BFDBFE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={16} color="#2563EB" />
                    <span>1. DỮ LIỆU ĐẦU VÀO AI / LLM (INPUT PAYLOAD &amp; TELEMETRY)</span>
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: '#1D4ED8', fontWeight: 600, backgroundColor: '#DBEAFE', padding: '2px 8px', borderRadius: '4px' }}>
                    Nguồn: Agent eBPF &amp; K8s API • Chuỗi 12 Mốc Thời Gian (60 Giây)
                  </span>
                </div>

                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Bảng 8 Chỉ số tổng hợp (KPI Cards) */}
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sliders size={13} color="#2563EB" />
                      <span>Tổng Hợp 8 Chỉ Số Viễn Trắc Đầu Vào (Summary Metrics):</span>
                    </div>

                    {isLoadingDetail ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#059669', fontSize: '0.8125rem', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                        <RefreshCw size={15} className="animate-spin" style={{ display: 'inline', marginRight: '6px' }} />
                        Đang đồng bộ 12 mốc viễn trắc từ cơ sở dữ liệu...
                      </div>
                    ) : metricSummary ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                        {/* CPU */}
                        <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#F0FDF4', border: '1px solid #DCFCE7' }}>
                          <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#15803D', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Cpu size={11} /> CPU (%)
                          </div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                            {metricSummary.cpu.current}%
                          </div>
                          <div style={{ fontSize: '0.625rem', color: '#166534', marginTop: '2px' }}>
                            TB: <strong>{metricSummary.cpu.avg}%</strong> &bull; Max: <strong>{metricSummary.cpu.max}%</strong>
                          </div>
                        </div>

                        {/* RAM */}
                        <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#EFF6FF', border: '1px solid #DBEAFE' }}>
                          <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <HardDrive size={11} /> RAM (%)
                          </div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                            {metricSummary.ram.current}%
                          </div>
                          <div style={{ fontSize: '0.625rem', color: '#1E40AF', marginTop: '2px' }}>
                            TB: <strong>{metricSummary.ram.avg}%</strong> &bull; Max: <strong>{metricSummary.ram.max}%</strong>
                          </div>
                        </div>

                        {/* Disk */}
                        <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#FFFBEB', border: '1px solid #FEF3C7' }}>
                          <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#B45309', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Database size={11} /> ĐĨA DISK (%)
                          </div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                            {metricSummary.disk.current}%
                          </div>
                          <div style={{ fontSize: '0.625rem', color: '#92400E', marginTop: '2px' }}>
                            TB: <strong>{metricSummary.disk.avg}%</strong> &bull; Max: <strong>{metricSummary.disk.max}%</strong>
                          </div>
                        </div>

                        {/* Latency */}
                        <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#F5F3FF', border: '1px solid #EDE9FE' }}>
                          <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#6D28D9', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={11} /> ĐỘ TRỄ (MS)
                          </div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                            {metricSummary.latency.current} ms
                          </div>
                          <div style={{ fontSize: '0.625rem', color: '#5B21B6', marginTop: '2px' }}>
                            TB: <strong>{metricSummary.latency.avg}</strong> &bull; Max: <strong>{metricSummary.latency.max}</strong>
                          </div>
                        </div>

                        {/* Request Rate */}
                        <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#ECFEFF', border: '1px solid #CFFAFE' }}>
                          <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#0E7490', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Activity size={11} /> LƯU LƯỢNG (REQ/S)
                          </div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                            {metricSummary.request_rate.current} <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>req/s</span>
                          </div>
                          <div style={{ fontSize: '0.625rem', color: '#155E75', marginTop: '2px' }}>
                            TB: <strong>{metricSummary.request_rate.avg}</strong> &bull; Max: <strong>{metricSummary.request_rate.max}</strong>
                          </div>
                        </div>

                        {/* HTTP 5xx */}
                        <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: metricSummary.http_5xx_rate.max > 0 ? '#FEF2F2' : '#F8FAFC', border: metricSummary.http_5xx_rate.max > 0 ? '1px solid #FECACA' : '1px solid #E2E8F0' }}>
                          <div style={{ fontSize: '0.625rem', fontWeight: 700, color: metricSummary.http_5xx_rate.max > 0 ? '#DC2626' : '#64748B', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={11} /> LỖI 5XX (%)
                          </div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 800, color: metricSummary.http_5xx_rate.max > 0 ? '#DC2626' : '#0F172A', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                            {metricSummary.http_5xx_rate.current}%
                          </div>
                          <div style={{ fontSize: '0.625rem', color: metricSummary.http_5xx_rate.max > 0 ? '#B91C1C' : '#64748B', marginTop: '2px' }}>
                            Đỉnh điểm: <strong>{metricSummary.http_5xx_rate.max}%</strong>
                          </div>
                        </div>

                        {/* Pod Restarts */}
                        <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#FDF2F8', border: '1px solid #FCE7F3' }}>
                          <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#BE185D', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <RefreshCw size={11} /> SỐ LẦN RESTART
                          </div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                            {metricSummary.pod_restart_count} <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>lần</span>
                          </div>
                          <div style={{ fontSize: '0.625rem', color: '#9D174D', marginTop: '2px' }}>
                            Trạng thái container K8s
                          </div>
                        </div>

                        {/* Replicas */}
                        <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#EEF2FF', border: '1px solid #E0E7FF' }}>
                          <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#4338CA', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Layers size={11} /> BẢN SAO PODS
                          </div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                            {metricSummary.replica_count} <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>pods</span>
                          </div>
                          <div style={{ fontSize: '0.625rem', color: '#3730A3', marginTop: '2px' }}>
                            Quy mô triển khai
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '0.8125rem', fontStyle: 'italic', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                        Chưa có chuỗi 12 mốc viễn trắc cho sự cố này
                      </div>
                    )}
                  </div>

                  {/* BẢNG NHẬT KÝ 12 MỐC VIỄN TRẮC THỜI GIAN (Audit Table) */}
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={13} color="#2563EB" />
                        <span>Bảng Nhật Ký Chuỗi 12 Bước Viễn Trắc Đầu Vào (T1 &rarr; T12):</span>
                      </div>
                      {formattedTimesteps.length > 0 && (
                        <span style={{ fontSize: '0.6875rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                          Chu kỳ: 5 giây/mốc (T1 &rarr; T12: 60s)
                        </span>
                      )}
                    </div>

                    {formattedTimesteps.length > 0 ? (
                      <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'center' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 700 }}>
                              <th style={{ padding: '8px 10px' }}>Mốc</th>
                              <th style={{ padding: '8px 10px' }}>Thời Điểm</th>
                              <th style={{ padding: '8px 10px' }}>CPU (%)</th>
                              <th style={{ padding: '8px 10px' }}>RAM (%)</th>
                              <th style={{ padding: '8px 10px' }}>Disk (%)</th>
                              <th style={{ padding: '8px 10px' }}>Req Rate (req/s)</th>
                              <th style={{ padding: '8px 10px' }}>Độ Trễ (ms)</th>
                              <th style={{ padding: '8px 10px' }}>Lỗi 5xx (%)</th>
                              <th style={{ padding: '8px 10px' }}>Restarts</th>
                              <th style={{ padding: '8px 10px' }}>Replicas</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formattedTimesteps.map((row, idx) => {
                              const isSpike5xx = row.http_5xx_rate > 0;
                              const isHighLatency = row.latency > 100;
                              const isHighCpu = row.cpu > 70;

                              return (
                                <tr
                                  key={idx}
                                  style={{
                                    borderBottom: '1px solid #F1F5F9',
                                    backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                                    fontFamily: 'var(--font-mono)',
                                  }}
                                >
                                  <td style={{ padding: '7px 10px', fontWeight: 700, color: '#4F46E5', backgroundColor: '#EEF2FF' }}>
                                    {row.stepLabel || `T${idx + 1}`}
                                  </td>
                                  <td style={{ padding: '7px 10px', color: '#64748B' }}>
                                    {row.displayTime || '-'}
                                  </td>
                                  <td style={{ padding: '7px 10px', fontWeight: isHighCpu ? 800 : 500, color: isHighCpu ? '#DC2626' : '#10B981', backgroundColor: isHighCpu ? '#FEF2F2' : 'transparent' }}>
                                    {row.cpu}%
                                  </td>
                                  <td style={{ padding: '7px 10px', color: '#3B82F6' }}>
                                    {row.ram}%
                                  </td>
                                  <td style={{ padding: '7px 10px', color: '#F59E0B' }}>
                                    {row.disk}%
                                  </td>
                                  <td style={{ padding: '7px 10px', color: '#06B6D4' }}>
                                    {row.request_rate}
                                  </td>
                                  <td style={{ padding: '7px 10px', fontWeight: isHighLatency ? 800 : 500, color: isHighLatency ? '#D97706' : '#8B5CF6', backgroundColor: isHighLatency ? '#FEF3C7' : 'transparent' }}>
                                    {row.latency} ms
                                  </td>
                                  <td style={{ padding: '7px 10px', fontWeight: isSpike5xx ? 800 : 500, color: isSpike5xx ? '#DC2626' : '#64748B', backgroundColor: isSpike5xx ? '#FEE2E2' : 'transparent' }}>
                                    {row.http_5xx_rate}%
                                  </td>
                                  <td style={{ padding: '7px 10px', color: row.pod_restart_count > 0 ? '#DC2626' : '#64748B', fontWeight: row.pod_restart_count > 0 ? 700 : 400 }}>
                                    {row.pod_restart_count}
                                  </td>
                                  <td style={{ padding: '7px 10px', color: '#4338CA', fontWeight: 600 }}>
                                    {row.replica_count}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '0.75rem', fontStyle: 'italic', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                        Dữ liệu viễn trắc đang được ghi nhận từ Agent...
                      </div>
                    )}
                  </div>

                  {/* K8s Events & Previous Action */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                    <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                        Sự Kiện &amp; Bằng Chứng Kubernetes:
                      </div>
                      <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#DC2626', backgroundColor: '#FEF2F2', padding: '6px 8px', borderRadius: '4px', border: '1px solid #FECACA' }}>
                        {evidenceList && evidenceList.length > 0 ? (
                          evidenceList.slice(0, 2).map((ev, i) => (
                            <div key={i}>&bull; [{ev.type}] {ev.summary}</div>
                          ))
                        ) : (
                          <div>&bull; {incident.impact || incident.title}</div>
                        )}
                      </div>
                    </div>

                    <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                        Lịch Sử Tự Phục Hồi Trước Đó (Previous Action):
                      </div>
                      <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
                        Action: <strong style={{ color: '#2563EB' }}>{previousActionInfo}</strong> &bull; Kết quả:{' '}
                        <span style={{ color: previousActionResult === 'SUCCESS' ? '#059669' : (previousActionResult === 'FAILED' ? '#DC2626' : '#D97706'), fontWeight: 700 }}>
                          {previousActionResult}
                        </span>{' '}
                        (Nguồn: MAPE-K Self-Healing Engine)
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Thresholds */}
                  {thresholds && (
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                        Ngưỡng rủi ro động của mô hình GRU (Dynamic Thresholds):
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {Object.entries(thresholds).map(([k, v]) => (
                          <span
                            key={k}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              backgroundColor: '#F1F5F9',
                              border: '1px solid #CBD5E1',
                              fontSize: '0.6875rem',
                              fontFamily: 'var(--font-mono)',
                              color: '#334155',
                            }}
                          >
                            {k}: <strong>{((parseFloat(v) || 0) * 100).toFixed(1)}%</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* KHỐI ĐẦU RA AI / LLM */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '12px 16px',
                    backgroundColor: '#ECFDF5',
                    borderBottom: '1px solid #A7F3D0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#065F46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={16} color="#059669" />
                    <span>2. KẾT QUẢ ĐẦU RA TỪ AI / LLM (STRUCTURED OUTPUT)</span>
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: '#047857', fontWeight: 600, backgroundColor: '#D1FAE5', padding: '2px 8px', borderRadius: '4px' }}>
                    Chuẩn hóa Schema SRE Agent (JSON Output)
                  </span>
                </div>

                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div
                    style={{
                      backgroundColor: '#0F172A',
                      color: '#F8FAFC',
                      padding: '14px 16px',
                      borderRadius: '8px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      lineHeight: 1.6,
                      overflowX: 'auto',
                      border: '1px solid #1E293B',
                    }}
                  >
                    <pre style={{ margin: 0 }}>
                      {JSON.stringify(
                        parsedAnalysis || {
                          root_cause: { cause: rootCauseType, confidence: confidence / 100, severity },
                          recommendation: { action: recAction, reason: recReason, priority: severity },
                          explanation: rootCauseDesc,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 22px',
            backgroundColor: '#F8FAFC',
            borderTop: '1px solid var(--dash-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
            Thời điểm ghi nhận: {new Date(incidentDetail?.detected_at || incident.detectedAt || Date.now()).toLocaleString('vi-VN')}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 18px',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--dash-border)',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
              boxShadow: 'var(--dash-shadow-xs)',
              transition: 'all 0.15s ease',
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default RootCauseModal;
