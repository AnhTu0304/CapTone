import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import CopyButton from './CopyButton';

export const TroubleshootingAccordion = ({ className = '' }) => {
  const [openIdx, setOpenIdx] = useState(null);

  const troubleshootingItems = [
    {
      title: 'Pod Tác tử ở trạng thái CrashLoopBackOff hoặc Error',
      diagnostic: 'Kiểm tra nhật ký container để tìm lỗi cấu hình hoặc trạng thái thiếu bộ nhớ (OOM):',
      command: 'kubectl logs -n selfheal-system -l app.kubernetes.io/name=selfheal-agent --tail=100',
      solution: 'Đảm bảo các node cụm máy chủ đáp ứng giới hạn tối thiểu 64MB RAM cho mỗi pod tác tử daemon.',
    },
    {
      title: 'Bị từ chối quyền (Permission Denied) / User forbidden trong log',
      diagnostic: 'Xác minh ServiceAccount và ClusterRoleBinding đã được liên kết chính xác:',
      command: 'kubectl get clusterrolebinding selfheal-agent-binding -o yaml',
      solution: 'Chạy lại lệnh cài đặt với cờ --set security.rbacLevel="standard-least-privilege" để tái cài đặt vai trò RBAC phạm vi hẹp.',
    },
    {
      title: 'Token Hết hạn hoặc Bị từ chối xác thực',
      diagnostic: 'Kiểm tra secret của tác tử trong cụm có khớp với token không gian làm việc hay không:',
      command: 'kubectl get secret -n selfheal-system selfheal-agent-secret -o jsonpath="{.data.token}" | base64 -d',
      solution: 'Tạo một token mới ở Bước 3 và cập nhật secret bằng lệnh: kubectl create secret generic selfheal-agent-secret --namespace selfheal-system --from-literal=token="<NEW_TOKEN>" --dry-run=client -o yaml | kubectl apply -f -',
    },
    {
      title: 'Tường lửa Outbound / Proxy Doanh nghiệp chặn tín hiệu',
      diagnostic: 'Kiểm tra kết nối HTTPS chiều đi từ pod cụm tới endpoint viễn trắc:',
      command: 'kubectl run curl-test --rm -it --image=curlimages/curl -- curl -Iv https://telemetry.selfheal.systems/healthz',
      solution: 'Cho phép cổng TCP 443 chiều ra tới *.selfheal.systems trong Security Groups hoặc Network Policies của bạn.',
    },
  ];

  return (
    <div
      className={`onboarding-troubleshooting-accordion ${className}`}
      style={{
        padding: '20px',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '0px',
        marginBottom: '24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <HelpCircle size={18} color="var(--color-primary)" />
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.9375rem',
            fontWeight: 700,
            color: 'var(--color-ink)',
            margin: 0,
          }}
        >
          Xử lý sự cố kết nối Tác tử
        </h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {troubleshootingItems.map((item, idx) => {
          const isOpen = openIdx === idx;

          return (
            <div
              key={idx}
              style={{
                border: '1px solid var(--border-default)',
                borderRadius: '0px',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  backgroundColor: isOpen ? 'rgba(61, 59, 79, 0.04)' : '#FFFFFF',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: 'var(--color-ink)',
                  }}
                >
                  {item.title}
                </span>
                {isOpen ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
              </button>

              {isOpen && (
                <div
                  style={{
                    padding: '14px',
                    backgroundColor: '#FFFFFF',
                    borderTop: '1px dashed var(--border-default)',
                    fontSize: '0.75rem',
                  }}
                >
                  <p style={{ fontFamily: 'var(--font-body)', color: 'var(--text-muted)', margin: '0 0 8px 0' }}>
                    {item.diagnostic}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      backgroundColor: '#1E1E1E',
                      color: '#E5E7EB',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.6875rem',
                      marginBottom: '10px',
                      overflowX: 'auto',
                    }}
                  >
                    <code>{item.command}</code>
                    <CopyButton text={item.command} label="Sao chép" style={{ padding: '3px 6px', fontSize: '0.625rem' }} />
                  </div>

                  <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-primary)', fontWeight: 600, margin: 0 }}>
                    <strong>Giải pháp khắc phục:</strong> {item.solution}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TroubleshootingAccordion;
