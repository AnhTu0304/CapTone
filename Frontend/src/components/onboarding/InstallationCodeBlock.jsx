import React, { useState } from 'react';
import { Terminal } from 'lucide-react';
import CopyButton from './CopyButton';

export const InstallationCodeBlock = ({
  clusterName = 'k8s-prod-east-01',
  token = 'sh_live_sec_token',
  environmentName = 'Staging',
  className = '',
}) => {
  const [method, setMethod] = useState('helm'); // 'helm' | 'kubectl'

  const helmCode = `# 1. Add SelfHeal Helm Repository
helm repo add selfheal https://charts.selfheal.systems
helm repo update

# 2. Install Agent DaemonSet with Least-Privilege RBAC
helm install selfheal-agent selfheal/agent \\
  --namespace selfheal-system \\
  --create-namespace \\
  --set cluster.name="${clusterName}" \\
  --set cluster.environment="${environmentName.toLowerCase()}" \\
  --set agent.token="${token}" \\
  --set security.rbacLevel="standard-least-privilege"`;

  const kubectlCode = `# 1. Create Dedicated Namespace
kubectl create namespace selfheal-system

# 2. Store Secure Agent Secret
kubectl create secret generic selfheal-agent-secret \\
  --namespace selfheal-system \\
  --from-literal=token="${token}"

# 3. Apply Scoped DaemonSet & ServiceAccount
kubectl apply -f https://install.selfheal.systems/v1/agent.yaml \\
  --namespace selfheal-system \\
  --cluster="${clusterName}"`;

  const currentCode = method === 'helm' ? helmCode : kubectlCode;

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
              Thực thi trong terminal cụm máy chủ của bạn thông qua Helm 3 (khuyên dùng) hoặc kubectl manifests trực tiếp.
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
          <button
            type="button"
            onClick={() => setMethod('kubectl')}
            style={{
              padding: '4px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem',
              fontWeight: 700,
              backgroundColor: method === 'kubectl' ? 'var(--color-primary)' : 'transparent',
              color: method === 'kubectl' ? '#FFFFFF' : 'var(--color-primary)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            kubectl
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
              <span>bash - {method === 'helm' ? 'helm-install.sh' : 'kubectl-deploy.sh'}</span>
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
    </div>
  );
};

export default InstallationCodeBlock;
