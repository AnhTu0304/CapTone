import React from 'react';
import {
  X,
  GitBranch,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Zap
} from 'lucide-react';

export const RootCauseModal = ({ incident, onClose, onResolve }) => {
  if (!incident) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '840px',
          maxHeight: '90vh',
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '18px',
          boxShadow: '0 25px 50px -12px rgba(6, 95, 70, 0.22), 0 0 0 1px rgba(16, 185, 129, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header - Soft Glossy Emerald */}
        <div
          style={{
            padding: '18px 24px',
            background: 'linear-gradient(135deg, #065F46 0%, #047857 55%, #059669 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 6px rgba(6, 95, 70, 0.15)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.3)',
              }}
            >
              <GitBranch size={20} color="#A7F3D0" />
            </div>
            <div>
              <div style={{ fontSize: '1.0625rem', fontWeight: 800, letterSpacing: '-0.01em', textShadow: '0 1px 2px rgba(0, 0, 0, 0.15)' }}>
                Phân Tích Nguyên Nhân Gốc Rễ (RCA) & Cây Nhân Quả
              </div>
              <div style={{ fontSize: '0.75rem', color: '#D1FAE5', fontFamily: 'var(--font-mono)', marginTop: '2px', fontWeight: 500 }}>
                SỰ CỐ: {incident.id} &bull; {incident.service} &bull; Mức độ: <span style={{ color: '#FDE68A', fontWeight: 700 }}>{incident.severity}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng phân tích RCA"
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

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Summary Box */}
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: '#FEF2F2',
              borderRadius: '12px',
              border: '1px solid #FECACA',
              borderLeft: '4px solid #EF4444',
              boxShadow: '0 1px 3px rgba(239, 68, 68, 0.05)',
            }}
          >
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#991B1B', marginBottom: '4px' }}>
              Kết luận Nguyên nhân Cốt lõi (Root Cause Finding)
            </div>
            <p style={{ fontSize: '0.8125rem', color: '#B91C1C', margin: 0, lineHeight: 1.5 }}>
              {incident.rootCause || 'Rò rỉ bộ nhớ (Memory leak) trong tiến trình xử lý batch queue làm cạn kiệt giới hạn 2048MiB RAM, kích hoạt cơ chế Linux OOM-Killer chấm dứt Pod chính.'}
            </p>
          </div>

          {/* Causal Inference Tree Graph */}
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '10px' }}>
              Chuỗi Nhân Quả Suy Diễn (Causal Chain)
            </div>

            <div
              style={{
                padding: '16px',
                backgroundColor: '#F8FAFC',
                borderRadius: '14px',
                border: '1px solid var(--dash-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {[
                { step: '1. NGUYÊN NHÂN SƠ CẤP', text: 'Đột biến 14,200 requests/s sau đợt flash sale làm nghẽn Kafka consumer buffer', icon: Activity, color: '#0284C7' },
                { step: '2. TÍCH TỤ TÀI NGUYÊN', text: 'Memory RSS của container payment-service leo thang từ 48% lên 98% trong 12 phút', icon: AlertTriangle, color: '#D97706' },
                { step: '3. HỆ QUẢ HẠ TẦNG', text: 'Kubelet gửi tín hiệu SIGKILL (Exit code 137: OOMKilled)', icon: AlertTriangle, color: '#DC2626' },
                { step: '4. TÁC ĐỘNG DỊCH VỤ', text: 'Tỷ lệ lỗi HTTP 502/503 tăng vọt 8.4% đối với các giao dịch thẻ quốc tế', icon: CheckCircle2, color: '#991B1B' },
              ].map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '10px',
                      border: `1.5px solid ${item.color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    }}
                  >
                    <item.icon size={16} color={item.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 700, color: item.color }}>
                      {item.step}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-primary)' }}>
                      {item.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence Log Snippet */}
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '8px' }}>
              Chứng Cứ Nhật Ký Container (Evidence Log Snippet)
            </div>
            <div
              style={{
                backgroundColor: '#1E293B',
                color: '#E2E8F0',
                padding: '14px 18px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                lineHeight: 1.55,
                borderRadius: '12px',
                border: '1px solid #334155',
                overflowX: 'auto',
                boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.25)',
              }}
            >
              <div style={{ color: '#94A3B8' }}>[14:24:16.890] [production/payment-service-7f8d-x9b2q]</div>
              <div style={{ color: '#F87171' }}>
                kernel: [18420.912] oom_reaper: reaped process 4812 (node), now anon-rss:0kB, file-rss:0kB, shmem-rss:0kB
              </div>
              <div style={{ color: '#FDE68A' }}>
                kubelet: container payment-service in pod payment-service-7f8d-x9b2q failed liveness probe, restarting
              </div>
            </div>
          </div>

          {/* Recommended Autonomous Remediation */}
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '8px' }}>
              Biện Pháp Khắc Phục Khuyến Nghị Bởi MAPE-K
            </div>
            <div
              style={{
                padding: '16px',
                backgroundColor: 'rgba(5, 150, 105, 0.06)',
                borderRadius: '14px',
                border: '1px solid #A7F3D0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#065F46' }}>
                  Hành động: Rolling Patch Memory Limit 4096MiB & Thêm 1 Replica
                </div>
                <div style={{ fontSize: '0.75rem', color: '#047857', marginTop: '2px' }}>
                  Đã kiểm tra an toàn: Máy chủ worker-02 còn dư 6.1 GB RAM khả dụng
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (onResolve) onResolve(incident.id);
                  onClose();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 18px',
                  backgroundColor: 'var(--dash-primary)',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Zap size={14} />
                <span>Kích Hoạt Tự Khắc Phục Ngay</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 24px',
            backgroundColor: 'var(--dash-bg-canvas)',
            borderTop: '1px solid var(--dash-border)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
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
