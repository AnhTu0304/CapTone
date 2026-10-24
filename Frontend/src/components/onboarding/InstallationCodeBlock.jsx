import React, { useState } from 'react';
import { Terminal } from 'lucide-react';
import CopyButton from './CopyButton';

export const InstallationCodeBlock = ({
  clusterName = 'k8s-prod-east-01',
  token = '',
  environmentName = 'Staging',
  className = '',
}) => {
  const [method, setMethod] = useState('powershell'); // 'powershell' | 'bash' | 'helm'

  const effectiveToken = token && typeof token === 'string' && token.length > 20
    ? token
    : '<MÃ_TOKEN_DO_HỆ_THỐNG_CẤP>';

  const powershellCode = `# 1. Mở PowerShell với quyền Administrator tại thư mục dự án
Set-ExecutionPolicy RemoteSigned -Scope Process -Force

# 2. Chạy Script cài đặt SelfHeal Agent tự động với Token
.\\Agent\\installer\\install-agent.ps1 -Token "${effectiveToken}"`;

  const bashCode = `# 1. Cấp quyền thực thi cho script cài đặt
chmod +x ./Agent/installer/install-agent.sh

# 2. Thực thi cài đặt Agent vào cụm Kubernetes
./Agent/installer/install-agent.sh --token "${effectiveToken}"`;

  const helmCode = `# Cài đặt trực tiếp bằng Helm Chart nội bộ của dự án
helm upgrade --install selfheal-agent ./Agent/deploy/helm/selfheal-agent \\
  --namespace selfheal-system \\
  --create-namespace \\
  --set secret.agentToken="${effectiveToken}" \\
  --set config.clusterName="${clusterName}" \\
  --set securityContext.runAsNonRoot=true`;

  const codeMap = {
    powershell: powershellCode,
    bash: bashCode,
    helm: helmCode,
  };

  const currentCode = codeMap[method] || powershellCode;

  return (
    <div
      className={`onboarding-install-code-block ${className}`}
      style={{
        padding: '20px',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '0px',
        marginBottom: '20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              backgroundColor: 'var(--color-primary)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            3
          </div>
          <div>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--color-ink)',
                margin: 0,
              }}
            >
              Cài đặt Tác tử SelfHeal
            </h3>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                margin: 0,
              }}
            >
              Thực thi trong terminal máy chủ của bạn thông qua PowerShell (Windows), Bash (Linux/macOS) hoặc Helm 3.
            </p>
          </div>
        </div>

        {/* Method Toggle Buttons */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'rgba(61, 59, 79, 0.06)',
            padding: '2px',
            border: '1px solid var(--border-default)',
          }}
        >
          <button
            type="button"
            onClick={() => setMethod('powershell')}
            style={{
              padding: '4px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem',
              fontWeight: 700,
              backgroundColor: method === 'powershell' ? 'var(--color-primary)' : 'transparent',
              color: method === 'powershell' ? '#FFFFFF' : 'var(--color-primary)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            PowerShell
          </button>
          <button
            type="button"
            onClick={() => setMethod('bash')}
            style={{
              padding: '4px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem',
              fontWeight: 700,
              backgroundColor: method === 'bash' ? 'var(--color-primary)' : 'transparent',
              color: method === 'bash' ? '#FFFFFF' : 'var(--color-primary)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Bash (Linux)
          </button>
          <button
            type="button"
            onClick={() => setMethod('helm')}
            style={{
              padding: '4px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem',
              fontWeight: 700,
              backgroundColor: method === 'helm' ? 'var(--color-primary)' : 'transparent',
              color: method === 'helm' ? '#FFFFFF' : 'var(--color-primary)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Helm 3
          </button>
        </div>
      </div>

      {/* Terminal Output Window */}
      <div
        style={{
          backgroundColor: '#2A2A2A',
          border: '1px solid #3D3B4F',
          borderRadius: '0px',
          overflow: 'hidden',
        }}
      >
        {/* Terminal Header */}
        <div
          style={{
            backgroundColor: '#1E1E1E',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
            <span
              style={{
                marginLeft: '8px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6875rem',
                color: '#9CA3AF',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Terminal size={12} />
              <span>
                {method === 'powershell'
                  ? 'powershell - install-agent.ps1'
                  : method === 'bash'
                  ? 'bash - install-agent.sh'
                  : 'helm - deploy/helm/selfheal-agent'}
              </span>
            </span>
          </div>

          <CopyButton text={currentCode} label="Sao chép lệnh" />
        </div>

        {/* Code Content */}
        <pre
          style={{
            padding: '16px',
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            lineHeight: 1.6,
            color: '#E5E7EB',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          <code>{currentCode}</code>
        </pre>
      </div>

      <div
        style={{
          marginTop: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.6875rem',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span>⚠️ Lệnh cài đặt chứa Token kết nối xác thực cụm. Tuyệt đối không chia sẻ trên các kênh thông tin công khai.</span>
      </div>
    </div>
  );
};

export default InstallationCodeBlock;
