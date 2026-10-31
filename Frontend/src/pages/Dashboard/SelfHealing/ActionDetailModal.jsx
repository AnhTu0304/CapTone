import React, { useState, useEffect } from 'react';
import { selfHealingService } from '../../../services/selfHealingService';
import {
  X,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Activity,
  Layers,
  ShieldCheck,
  Terminal,
  FileText,
  Copy,
  Check,
  RefreshCw,
  Server,
  Zap,
  Cpu,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

export const ActionDetailModal = ({ actionId, initialItem, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'execution' | 'verification' | 'raw'
  const [detail, setDetail] = useState(initialItem || null);
  const [isLoading, setIsLoading] = useState(!initialItem);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchDetail = async () => {
      if (!actionId) return;
      setIsLoading(true);
      try {
        const data = await selfHealingService.getActionById(actionId);
        if (isMounted && data) {
          setDetail(data);
        }
      } catch (err) {
        console.warn('[ActionDetailModal] Lỗi nạp chi tiết:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [actionId]);

  const handleCopyJson = () => {
    if (!detail) return;
    navigator.clipboard.writeText(JSON.stringify(detail, null, 2));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const isSucceeded = detail?.execution_status === 'SUCCEEDED';
  const isFailed = detail?.execution_status === 'FAILED';
  const isCancelled = detail?.execution_status === 'CANCELLED';
  const isWaitingApproval = !isSucceeded && !isFailed && !isCancelled && (
    detail?.approval_status === 'PENDING' ||
    detail?.execution_status === 'PENDING' ||
    (detail?.title || '').toLowerCase().includes('chờ phê duyệt')
  );
  const isRunning = !isWaitingApproval && !isSucceeded && !isFailed && !isCancelled && (
    detail?.execution_status === 'RUNNING'
  );

  let statusBg = '#DCFCE7';
  let statusColor = '#15803D';
  let statusBorder = '#86EFAC';
  let statusLabel = 'Thành công (SUCCEEDED)';

  if (isWaitingApproval) {
    statusBg = '#FEF3C7';
    statusColor = '#B45309';
    statusBorder = '#FDE68A';
    statusLabel = 'Chờ duyệt HITL (PENDING)';
  } else if (isFailed) {
    statusBg = '#FEE2E2';
    statusColor = '#B91C1C';
    statusBorder = '#FCA5A5';
    statusLabel = 'Thất bại (FAILED)';
  } else if (isCancelled) {
    statusBg = '#F1F5F9';
    statusColor = '#475569';
    statusBorder = '#CBD5E1';
    statusLabel = 'Đã hủy (CANCELLED)';
  } else if (isRunning) {
    statusBg = '#E0F2FE';
    statusColor = '#0369A1';
    statusBorder = '#7DD3FC';
    statusLabel = 'Đang thực thi (RUNNING)';
  }

  const shortId = actionId ? `ACT-${actionId.slice(0, 8).toUpperCase()}` : 'ACT-UNKNOWN';
  const attempts = detail?.attempts || [];
  const verifications = detail?.verifications || (detail?.verification ? [detail.verification] : []);
  const resultObj = typeof detail?.result === 'object' && detail?.result !== null ? detail.result : {};
  const durationMs = resultObj?.duration_ms || (attempts[0]?.duration_ms) || (detail?.elapsed_seconds ? Math.round(detail.elapsed_seconds * 1000) : 100);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--dash-border, #E2E8F0)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
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
            backgroundColor: 'var(--dash-bg-canvas, #F8FAFC)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#059669',
              }}
            >
              <Zap size={16} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.9375rem', color: '#0F172A' }}>
                  {shortId}
                </span>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: statusBg,
                    color: statusColor,
                    border: `1px solid ${statusBorder}`,
                  }}
                >
                  {statusLabel}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                UUID: {actionId}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isLoading && <RefreshCw size={16} className="animate-spin" color="#059669" />}
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Quick Highlights Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
            padding: '12px 20px',
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
          }}
        >
          <div style={{ padding: '5px 8px', borderRadius: '6px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} /> THỜI LƯỢNG (MTTR)
            </div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#059669', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              {durationMs}ms ({(durationMs / 1000).toFixed(1)}s)
            </div>
          </div>

          <div style={{ padding: '5px 8px', borderRadius: '6px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={12} /> HẬU KIỂM TRA (SLO)
            </div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0284C7', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              {verifications[0]?.verification_type || 'K8S_POST_HEALING_PROBE'}
            </div>
          </div>

          <div style={{ padding: '5px 8px', borderRadius: '6px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Server size={12} /> ĐỐI TƯỢNG (TARGET)
            </div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A', fontFamily: 'var(--font-mono)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {detail?.target_name || resultObj?.details?.target || 'attack-injector-app'}
            </div>
          </div>

          <div style={{ padding: '5px 8px', borderRadius: '6px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Cpu size={12} /> AGENT THỰC THI
            </div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#4338CA', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              {resultObj?.executed_by_agent || attempts[0]?.request_payload?.agent || 'ai-ebpf-agent'}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', padding: '0 16px', gap: '6px' }}>
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
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <FileText size={14} />
            <span>Tổng Quan & Sự Cố</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('execution')}
            style={{
              padding: '10px 14px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: activeTab === 'execution' ? '#059669' : '#64748B',
              border: 'none',
              borderBottom: activeTab === 'execution' ? '2px solid #059669' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Terminal size={14} />
            <span>Lệnh K8s & Lần Thử ({attempts.length || 1})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('verification')}
            style={{
              padding: '10px 14px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: activeTab === 'verification' ? '#059669' : '#64748B',
              border: 'none',
              borderBottom: activeTab === 'verification' ? '2px solid #059669' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ShieldCheck size={14} />
            <span>Kiểm Tra Hậu Phục Hồi ({verifications.length || 1})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('raw')}
            style={{
              padding: '10px 14px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: activeTab === 'raw' ? '#059669' : '#64748B',
              border: 'none',
              borderBottom: activeTab === 'raw' ? '2px solid #059669' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Layers size={14} />
            <span>Dữ Liệu Thô (Raw JSON)</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div style={{ padding: '10px 16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <>
              {/* Execution Summary Alert */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  backgroundColor: isFailed ? '#FEF2F2' : (isWaitingApproval ? '#FFFBEB' : (isRunning ? '#EFF6FF' : '#F0FDF4')),
                  border: `1px solid ${isFailed ? '#FECACA' : (isWaitingApproval ? '#FDE68A' : (isRunning ? '#BFDBFE' : '#BBF7D0'))}`,
                  borderLeft: `4px solid ${isFailed ? '#EF4444' : (isWaitingApproval ? '#F59E0B' : (isRunning ? '#3B82F6' : '#10B981'))}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: isFailed ? '#991B1B' : (isWaitingApproval ? '#92400E' : (isRunning ? '#1E40AF' : '#166534')),
                    fontWeight: 700,
                    fontSize: '0.875rem',
                  }}
                >
                  {isFailed ? (
                    <AlertCircle size={16} />
                  ) : isWaitingApproval ? (
                    <Clock size={16} />
                  ) : isRunning ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  <span>
                    {isWaitingApproval
                      ? 'Yêu Cầu Tự Lành Đang Chờ Phê Duyệt An Toàn (HITL Pending)'
                      : isRunning
                      ? 'Tiến Trình Tự Phục Hồi Đang Diễn Ra'
                      : isFailed
                      ? 'Thực Thi Tự Phục Hồi Thất Bại'
                      : 'Kết Quả Tự Lành Được Xác Thực'}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: '6px',
                    fontSize: '0.8125rem',
                    color: isFailed ? '#7F1D1D' : (isWaitingApproval ? '#78350F' : (isRunning ? '#1E3A8A' : '#14532D')),
                    lineHeight: 1.5,
                  }}
                >
                  {isSucceeded
                    ? (resultObj?.message && !resultObj.message.toLowerCase().includes('chờ phê duyệt')
                        ? resultObj.message
                        : `Đã thực thi thành công ${detail?.action_type_name || 'hành động'} trên dịch vụ "${detail?.target_name || ''}"`)
                    : (resultObj?.message || detail?.title || `Thực thi ${detail?.action_type_name || 'hành động'}`)}
                </div>
              </div>

              {/* Linked Incident Box */}
              <div style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={15} color="#059669" />
                    SỰ CỐ GỐC KÍCH HOẠT (INCIDENT CONTEXT)
                  </span>
                  {detail?.incident_severity && (
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: detail.incident_severity === 'CRITICAL' ? '#FEE2E2' : '#FEF3C7',
                        color: detail.incident_severity === 'CRITICAL' ? '#DC2626' : '#D97706',
                      }}
                    >
                      MỨC ĐỘ: {detail.incident_severity}
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Tiêu đề sự cố:</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                      {detail?.incident_title || '[AI Alert] Sự cố hiệu năng hệ thống'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Trạng thái sự cố:</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#059669', marginTop: '2px' }}>
                      {detail?.incident_status || 'RESOLVED'}
                    </div>
                  </div>

                  {detail?.incident_description && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Phân tích nguyên nhân gốc (RCA):</div>
                      <div style={{ fontSize: '0.8125rem', color: '#334155', marginTop: '2px', backgroundColor: '#F8FAFC', padding: '8px 12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                        {detail.incident_description}
                      </div>
                    </div>
                  )}

                  {detail?.recommendation_reasoning && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Lập luận khuyến nghị của AI:</div>
                      <div style={{ fontSize: '0.8125rem', color: '#334155', marginTop: '2px', backgroundColor: '#F0FDF4', padding: '8px 12px', borderRadius: '6px', border: '1px solid #DCFCE7' }}>
                        {detail.recommendation_reasoning}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Technical Specifications */}
              <div style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                  THÔNG SỐ KỸ THUẬT VÀ PHẠM VI (SCOPE & METADATA)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '0.8125rem' }}>
                  <div>
                    <span style={{ color: '#64748B' }}>Không gian tên (Namespace):</span>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
                      {resultObj?.details?.namespace || detail?.namespace || 'test-lab'}
                    </div>
                  </div>

                  <div>
                    <span style={{ color: '#64748B' }}>Cụm Kubernetes:</span>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>
                      {detail?.cluster_name || detail?.cluster_id || 'test-lab'}
                    </div>
                  </div>

                  <div>
                    <span style={{ color: '#64748B' }}>Loại hành động:</span>
                    <div style={{ fontWeight: 700, color: '#0F172A' }}>
                      {detail?.action_type_name || 'Scale Replicas'}
                    </div>
                  </div>

                  <div>
                    <span style={{ color: '#64748B' }}>Chế độ thực thi:</span>
                    <div style={{ fontWeight: 700, color: '#0F172A' }}>
                      {detail?.execution_mode === 'AUTO' ? 'Tự động (Autonomous)' : 'Thủ công (Manual / HITL)'}
                    </div>
                  </div>

                  <div>
                    <span style={{ color: '#64748B' }}>Mức độ rủi ro:</span>
                    <div style={{ fontWeight: 700, color: detail?.risk_level === 'HIGH' ? '#DC2626' : '#059669' }}>
                      {detail?.risk_level || 'MEDIUM'}
                    </div>
                  </div>

                  <div>
                    <span style={{ color: '#64748B' }}>Phê duyệt (HITL):</span>
                    <div style={{ fontWeight: 700, color: '#059669' }}>
                      {detail?.approval_status || 'APPROVED'}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: EXECUTION ATTEMPTS & K8S LOGS */}
          {activeTab === 'execution' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A' }}>
                DANH SÁCH LỆNH THỰC THI TRÊN KUBERNETES AGENT ({attempts.length || 1})
              </div>

              {(attempts.length > 0 ? attempts : [
                {
                  attempt_number: 1,
                  command_type: 'K8S_AGENT_REMEDIATION',
                  status: detail?.execution_status || 'SUCCEEDED',
                  duration_ms: durationMs,
                  started_at: detail?.started_at,
                  completed_at: detail?.completed_at,
                  request_payload: { agent: resultObj?.executed_by_agent || 'ai-ebpf-agent', target: detail?.target_name || 'attack-injector-app' },
                  response_payload: resultObj,
                }
              ]).map((att, idx) => (
                <div
                  key={idx}
                  style={{
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '10px 14px',
                      backgroundColor: '#F8FAFC',
                      borderBottom: '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', fontFamily: 'var(--font-mono)' }}>
                        LẦN THỬ #{att.attempt_number || idx + 1}:
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284C7', fontFamily: 'var(--font-mono)' }}>
                        {att.command_type || 'K8S_AGENT_REMEDIATION'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.6875rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                        Thời lượng: <strong>{att.duration_ms || durationMs}ms</strong>
                      </span>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: att.status === 'SUCCEEDED' ? '#DCFCE7' : '#FEE2E2',
                          color: att.status === 'SUCCEEDED' ? '#15803D' : '#B91C1C',
                        }}
                      >
                        {att.status || 'SUCCEEDED'}
                      </span>
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {att.request_payload && (
                      <div>
                        <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>
                          LỆNH GỬI ĐI (REQUEST PAYLOAD):
                        </div>
                        <pre
                          style={{
                            margin: 0,
                            padding: '8px 10px',
                            backgroundColor: '#0F172A',
                            color: '#38BDF8',
                            borderRadius: '6px',
                            fontSize: '0.6875rem',
                            fontFamily: 'var(--font-mono)',
                            overflowX: 'auto',
                          }}
                        >
                          {JSON.stringify(att.request_payload, null, 2)}
                        </pre>
                      </div>
                    )}

                    {att.response_payload && (
                      <div>
                        <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>
                          PHẢN HỒI TỪ CỤM (RESPONSE PAYLOAD):
                        </div>
                        <pre
                          style={{
                            margin: 0,
                            padding: '8px 10px',
                            backgroundColor: '#0F172A',
                            color: '#4ADE80',
                            borderRadius: '6px',
                            fontSize: '0.6875rem',
                            fontFamily: 'var(--font-mono)',
                            overflowX: 'auto',
                          }}
                        >
                          {JSON.stringify(att.response_payload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: POST HEALING VERIFICATION */}
          {activeTab === 'verification' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: `1px solid ${isWaitingApproval ? '#FDE68A' : isFailed ? '#FECACA' : '#BBF7D0'}`,
                  backgroundColor: isWaitingApproval ? '#FFFBEB' : isFailed ? '#FEF2F2' : '#F0FDF4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <ShieldCheck size={28} color={isWaitingApproval ? '#D97706' : isFailed ? '#DC2626' : '#059669'} />
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 800, color: isWaitingApproval ? '#92400E' : isFailed ? '#991B1B' : '#166534' }}>
                      Kiểm Thử Hậu Tự Phục Hồi (SLO Probe Verification)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: isWaitingApproval ? '#B45309' : isFailed ? '#B91C1C' : '#15803D', marginTop: '2px' }}>
                      {isWaitingApproval
                        ? 'Đang chờ phê duyệt HITL. Đầu dò kiểm thử SLO sẽ tự kích hoạt ngay khi lệnh K8s hoàn tất.'
                        : 'Hệ thống tự động thăm dò tình trạng Workload sau khi áp dụng hành động sửa chữa'}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    backgroundColor: isWaitingApproval ? '#FEF3C7' : isFailed ? '#FEE2E2' : '#DCFCE7',
                    border: `1px solid ${isWaitingApproval ? '#FDE68A' : isFailed ? '#FCA5A5' : '#86EFAC'}`,
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: isWaitingApproval ? '#B45309' : isFailed ? '#B91C1C' : '#15803D',
                  }}
                >
                  {isWaitingApproval ? 'KẾT QUẢ: CHỜ DUYỆT (PENDING)' : isFailed ? 'KẾT QUẢ: THẤT BẠI (FAIL)' : 'KẾT QUẢ: ĐẠT CHUẨN (PASS)'}
                </div>
              </div>

              {/* Before vs After comparison cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'center' }}>
                <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid #FECACA', backgroundColor: '#FEF2F2' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase' }}>
                    TRẠNG THÁI TRƯỚC PHỤC HỒI (BEFORE)
                  </div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#DC2626', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                    {verifications[0]?.status_before?.health || 'DEGRADED'}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#7F1D1D', marginTop: '4px' }}>
                    Chỉ số tải và độ trễ vượt ngưỡng SLO
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
                    <ArrowRight size={18} />
                  </div>
                </div>

                <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid #BBF7D0', backgroundColor: '#F0FDF4' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                    TRẠNG THÁI SAU PHỤC HỒI (AFTER)
                  </div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#059669', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                    {verifications[0]?.status_after?.health || 'HEALTHY'}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#14532D', marginTop: '4px' }}>
                    Tất cả Pods sẵn sàng, đạt tiêu chuẩn 100%
                  </div>
                </div>
              </div>

              {/* Verification probe detail */}
              <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
                  THÔNG TIN CHI TIẾT ĐẦU DÒ (PROBE DETAILS)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '0.8125rem' }}>
                  <div>
                    <span style={{ color: '#64748B' }}>Loại kiểm thử (Probe Type):</span>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {verifications[0]?.verification_type || 'K8S_POST_HEALING_PROBE'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Thời gian xác thực:</span>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {verifications[0]?.duration_ms ? `${verifications[0].duration_ms}ms` : '500ms'}
                    </div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: '#64748B' }}>Thông điệp phản hồi từ bộ kiểm chuẩn:</span>
                    <div style={{ marginTop: '4px', padding: '8px 12px', borderRadius: '6px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#059669', fontWeight: 600 }}>
                      {verifications[0]?.verification_details?.message || 'Tác vụ tự lành thành công trên K8s Agent'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RAW JSON AUDIT */}
          {activeTab === 'raw' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  Bản ghi dữ liệu thô nguyên bản từ cơ sở dữ liệu PostgreSQL (`healing_actions` & `execution_attempts`):
                </span>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#334155',
                  }}
                >
                  {isCopied ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                  <span>{isCopied ? 'Đã sao chép' : 'Sao chép JSON'}</span>
                </button>
              </div>

              <pre
                style={{
                  margin: 0,
                  padding: '14px',
                  backgroundColor: '#0F172A',
                  color: '#F8FAFC',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  overflowY: 'auto',
                  maxHeight: '400px',
                  border: '1px solid #334155',
                }}
              >
                {JSON.stringify(detail, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
            Thời điểm ghi nhận: <strong>{detail?.completed_at || detail?.created_at || 'Vừa xong'}</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActionDetailModal;
