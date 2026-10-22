import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  RefreshCw,
  KeyRound,
  Radio,
  ArrowRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import StepHeader from '../../components/onboarding/StepHeader';
import CopyButton from '../../components/onboarding/CopyButton';
import PrimaryButton from '../../components/onboarding/PrimaryButton';
import SecondaryButton from '../../components/onboarding/SecondaryButton';
import TroubleshootingAccordion from '../../components/onboarding/TroubleshootingAccordion';
import { useOnboarding } from '../../context/OnboardingContext';
import { useAuth } from '../../context/AuthContext';
import { onboardingService } from '../../services/onboardingService';
import { personalPortalService } from '../../services/personalPortalService';

export const VerifyAgentStep = ({ onNavigate }) => {
  const {
    organization,
    environment,
    cluster,
    agentStatus,
    updateOrganization,
    updateEnvironment,
    updateCluster,
    retryAgentVerification,
    setStep,
  } = useOnboarding();

  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('helm'); // 'helm' | 'kubectl' | 'docker'
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const token = cluster?.token || 'sh_live_sec_default_token';
  const clusterName = cluster?.name || 'k8s-cluster-01';
  const serverEndpoint = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

  // Tự động kiểm tra tín hiệu một lần khi mở trang (không chặn người dùng)
  useEffect(() => {
    retryAgentVerification();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualCheck = async () => {
    setChecking(true);
    try {
      await retryAgentVerification();
    } finally {
      setTimeout(() => setChecking(false), 600);
    }
  };

  const handleBack = () => {
    setStep(3);
    if (onNavigate) {
      onNavigate('/onboarding/kubernetes');
    }
  };

  /**
   * Lưu toàn bộ cấu hình 1 lần duy nhất vào Database khi chuyển từ Bước 4 sang Bước 5
   * (Tổ chức -> Môi trường -> Tác tử Agent -> Đồng bộ Personal Portal)
   */
  const handleContinue = async () => {
    setSaving(true);
    setSaveError('');

    try {
      let currentOrgId = organization?.id;
      let currentOrgData = organization;

      // Xác thực xem Organization ID có tồn tại thực sự trong DB không
      if (currentOrgId) {
        try {
          const checkedOrg = await onboardingService.getOrganizationById(currentOrgId);
          currentOrgData = checkedOrg;
        } catch {
          console.warn(`[VerifyAgentStep] ID tổ chức ${currentOrgId} không tồn tại trên DB, tiến hành tạo mới`);
          currentOrgId = null;
        }
      }

      // 1. Tạo mới Tổ chức (Organization) trên Backend Database
      if (!currentOrgId) {
        const orgName = (organization?.name || 'Doanh Nghiệp K8s').trim();
        let orgSlug = (organization?.slug || orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')).trim();
        if (!orgSlug) orgSlug = `org-${Date.now()}`;

        try {
          const createdOrg = await onboardingService.createOrganization({
            name: orgName,
            slug: orgSlug,
            description: organization?.description ? organization.description.trim() : 'Không gian làm việc Onboarding',
            email: user?.email,
          });
          currentOrgId = createdOrg.id;
          currentOrgData = createdOrg;
        } catch (orgErr) {
          console.warn('[VerifyAgentStep] Lỗi tạo tổ chức mới, tiến hành giải quyết:', orgErr.message);

          // Nếu slug bị trùng (Conflict), tự động sinh slug duy nhất có đuôi ngẫu nhiên
          if (orgErr.message && (orgErr.message.includes('tồn tại') || orgErr.message.includes('Conflict') || orgErr.message.includes('409'))) {
            try {
              const uniqueSlug = `${orgSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
              const retryOrg = await onboardingService.createOrganization({
                name: orgName,
                slug: uniqueSlug,
                description: organization?.description ? organization.description.trim() : 'Không gian làm việc Onboarding',
                email: user?.email,
              });
              currentOrgId = retryOrg.id;
              currentOrgData = retryOrg;
            } catch (retryErr) {
              console.warn('[VerifyAgentStep] Thử lại với slug ngẫu nhiên không thành công:', retryErr);
            }
          }

          // Nếu vẫn chưa có ID, tìm kiếm trong danh sách tổ chức sẵn có của user
          if (!currentOrgId) {
            try {
              const myOrgs = await onboardingService.getMyOrganizations();
              const matchedOrg =
                myOrgs.find((o) => o.slug === orgSlug) ||
                myOrgs.find((o) => o.name?.trim().toLowerCase() === orgName.toLowerCase()) ||
                myOrgs[0];
              if (matchedOrg) {
                currentOrgId = matchedOrg.id;
                currentOrgData = matchedOrg;
              } else {
                currentOrgId = `sandbox-org-${Date.now()}`;
              }
            } catch {
              currentOrgId = `sandbox-org-${Date.now()}`;
            }
          }
        }
      }

      // 2. Tạo Môi trường (Environment) liên kết với Organization vừa tạo
      let currentEnvId = environment?.id;
      let currentEnvData = environment;
      if (currentOrgId && !currentEnvId && !String(currentOrgId).startsWith('sandbox-')) {
        try {
          const envType = environment?.type === 'development' ? 'DEV' : 'STAGING';
          const envName = (environment?.name || 'Production').trim();
          const createdEnv = await onboardingService.createEnvironment(currentOrgId, {
            name: envName,
            environment_type: envType,
            description: environment?.description ? environment.description.trim() : 'Cụm máy chủ sản xuất chính',
          });
          currentEnvId = createdEnv.id;
          currentEnvData = createdEnv;
        } catch (envErr) {
          console.warn('[VerifyAgentStep] Lỗi tạo môi trường, kiểm tra môi trường sẵn có:', envErr.message);
          try {
            const existingEnvs = await onboardingService.getEnvironments(currentOrgId);
            if (existingEnvs && existingEnvs.length > 0) {
              currentEnvId = existingEnvs[0].id;
              currentEnvData = existingEnvs[0];
            }
          } catch {}
        }
      }

      // 3. Đăng ký Tác tử Agent K8s & Token liên kết với Org và Environment
      if (currentOrgId && currentEnvId && !cluster?.agentId && !String(currentOrgId).startsWith('sandbox-')) {
        try {
          const agName = (clusterName || cluster?.name || 'k8s-cluster-01').trim();
          const agToken = cluster?.token || `ag_live_${Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;

          const createdAgent = await onboardingService.createAgent(currentOrgId, {
            name: agName,
            environment_id: currentEnvId,
            version: 'v1.0.0',
            initial_token: agToken,
          });
          if (createdAgent?.token?.raw_token) {
            updateCluster({
              agentId: createdAgent.agent?.id,
              token: createdAgent.token.raw_token,
              tokenGeneratedAt: createdAgent.token.created_at || new Date().toISOString(),
              isRegistered: true,
            });
          }
        } catch (agentErr) {
          console.warn('[VerifyAgentStep] Lỗi đăng ký agent:', agentErr.message);
        }
      }

      // 4. Đồng bộ Doanh nghiệp vào Không gian Cá nhân (Personal Portal) & Active Session
      if (currentOrgData?.name) {
        try {
          personalPortalService.createCompany({
            id: currentOrgId,
            name: currentOrgData.name,
            slug: currentOrgData.slug || currentOrgData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            plan: 'SME Starter',
            domain: `${currentOrgData.slug || 'company'}.com`,
            description: currentOrgData.description || 'Hạ tầng Kubernetes doanh nghiệp',
          });
        } catch (portalErr) {
          console.warn('[VerifyAgentStep] Lỗi đồng bộ sang personal portal:', portalErr);
        }
      }

      if (currentOrgId) {
        try {
          localStorage.setItem('selfheal_active_org_id', currentOrgId);
          if (currentOrgData?.name) {
            localStorage.setItem('selfheal_active_org_name', currentOrgData.name);
          }
        } catch {}
      }

      // Cập nhật State trong Context
      if (currentOrgData) updateOrganization(currentOrgData);
      if (currentEnvData) updateEnvironment(currentEnvData);

      // Chuyển sang Bước 5 (Hoàn tất)
      setStep(5);
      if (onNavigate) {
        onNavigate('/onboarding/complete');
      }
    } catch (finalErr) {
      console.error('[VerifyAgentStep] Lỗi lưu cấu hình:', finalErr);
      setSaveError(finalErr.message || 'Không thể lưu cấu hình vào hệ thống. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const isConnected = agentStatus?.state === 'connected';

  // Câu lệnh Helm Chart
  const helmCommand = `# 1. Thêm kho lưu trữ SelfHeal Helm repository
helm repo add selfheal https://charts.selfheal.systems
helm repo update

# 2. Cài đặt Tác tử SelfHeal Agent vào cụm Kubernetes
helm install selfheal-agent selfheal/agent \\
  --namespace selfheal-system --create-namespace \\
  --set agent.token="${token}" \\
  --set agent.clusterName="${clusterName}" \\
  --set server.endpoint="${serverEndpoint}"`;

  // Câu lệnh Kubectl Script một dòng
  const kubectlCommand = `# Triển khai nhanh bằng kubectl một dòng lệnh
curl -sSL https://raw.githubusercontent.com/selfheal/agent/main/deploy.sh | bash -s -- \\
  --token "${token}" \\
  --cluster "${clusterName}" \\
  --endpoint "${serverEndpoint}"`;

  // Câu lệnh Docker Container
  const dockerCommand = `# Triển khai SelfHeal Agent dưới dạng Docker container
docker run -d --name selfheal-agent --restart always \\
  -e AGENT_TOKEN="${token}" \\
  -e CLUSTER_NAME="${clusterName}" \\
  -e SERVER_ENDPOINT="${serverEndpoint}" \\
  -v /var/run/docker.sock:/var/run/docker.sock \\
  selfheal/agent:latest`;

  return (
    <div className="onboarding-step-verify-agent">
      <StepHeader
        stepNumber={4}
        totalSteps={5}
        category="CHỈ DẪN KẾT NỐI TÁC TỬ"
        title="Chỉ dẫn kết nối Tác tử (SelfHeal Agent)"
        description="Thực hiện kết nối cụm máy chủ của bạn theo các bước chỉ dẫn chi tiết dưới đây. Bạn có thể cài đặt ngay hoặc bấm Tiếp tục để lưu cấu hình và hoàn tất thiết lập tài khoản."
      />

      {/* Thông báo không bắt buộc kết nối ngay */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: '14px 16px',
          backgroundColor: '#F0FDF4',
          border: '1px solid #A7F3D0',
          marginBottom: '24px',
        }}
      >
        <CheckCircle2 size={18} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.8125rem', color: '#065F46', lineHeight: 1.5 }}>
          <strong>Lưu ý quan trọng:</strong> Bước này <strong>không bắt buộc</strong> phải có kết nối thành công mới được tiếp tục. 
          Toàn bộ cấu hình (Tổ chức, Môi trường, Cụm) sẽ được lưu 1 lần an toàn khi bạn bấm <strong>"Tiếp tục Hoàn tất"</strong> để vào Không gian cá nhân.
        </div>
      </div>

      {/* Thông báo lỗi nếu có */}
      {saveError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '14px 16px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <AlertTriangle size={18} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#991B1B' }}>
                Lưu cấu hình gặp sự cố
              </div>
              <div style={{ fontSize: '0.75rem', color: '#B91C1C', marginTop: '2px' }}>
                {saveError}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setStep(5);
              if (onNavigate) onNavigate('/onboarding/complete');
            }}
            style={{
              padding: '6px 12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #F87171',
              color: '#DC2626',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Bỏ qua & Tiếp tục (Sandbox)
          </button>
        </div>
      )}

      {/* Thông tin kết nối Tác tử */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--border-default)',
          padding: '20px',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <KeyRound size={18} color="var(--color-primary)" />
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.9375rem',
              fontWeight: 700,
              color: 'var(--color-ink)',
              margin: 0,
            }}
          >
            Thông Tin Xác Thực Kết Nối
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          <div>
            <div style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '4px' }}>
              TỔ CHỨC:
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-ink)' }}>
              {organization?.name || 'Tổ chức của bạn'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '4px' }}>
              TÊN CỤM (CLUSTER NAME):
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-ink)' }}>
              {clusterName}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '4px' }}>
              MÔI TRƯỜNG:
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-ink)' }}>
              {environment?.name || 'Mặc định'} ({environment?.type ? environment.type.toUpperCase() : 'STAGING'})
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '4px' }}>
              MÃ BẢO MẬT TÁC TỬ (AGENT TOKEN):
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: '#F8FAFC',
                border: '1px solid var(--border-default)',
                gap: '10px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8125rem',
                  color: 'var(--color-primary)',
                  wordBreak: 'break-all',
                }}
              >
                {token}
              </span>
              <CopyButton text={token} label="Sao chép Token" />
            </div>
          </div>
        </div>
      </div>

      {/* Hướng dẫn 3 bước kết nối chi tiết */}
      <div style={{ marginBottom: '28px' }}>
        {/* Bước 1 */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--border-default)',
            padding: '20px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span
              style={{
                width: '24px',
                height: '24px',
                backgroundColor: 'var(--color-primary)',
                color: '#FFFFFF',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              1
            </span>
            <h4
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.875rem',
                fontWeight: 700,
                color: 'var(--color-ink)',
                margin: 0,
              }}
            >
              Triển khai Tác tử vào cụm máy chủ của bạn
            </h4>
          </div>

          <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-muted)', marginBottom: '14px', lineHeight: 1.5 }}>
            Chọn công cụ bạn đang sử dụng và chạy lệnh tương ứng trên Terminal hoặc máy chủ điều khiển (Bastion Host):
          </p>

          {/* Tab chọn công cụ */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', borderBottom: '1px solid var(--border-default)', paddingBottom: '8px' }}>
            {[
              { id: 'helm', label: 'Helm Chart (Khuyên dùng)' },
              { id: 'kubectl', label: 'Kubectl Apply' },
              { id: 'docker', label: 'Docker Container' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '6px 14px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: activeTab === tab.id ? 'var(--color-primary)' : 'transparent',
                  color: activeTab === tab.id ? '#FFFFFF' : 'var(--color-primary)',
                  border: '1px solid var(--border-default)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Khung lệnh theo tab */}
          <div style={{ position: 'relative' }}>
            <pre
              style={{
                backgroundColor: '#0F172A',
                color: '#E2E8F0',
                padding: '16px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8125rem',
                lineHeight: 1.6,
                overflowX: 'auto',
                margin: 0,
              }}
            >
              {activeTab === 'helm' && helmCommand}
              {activeTab === 'kubectl' && kubectlCommand}
              {activeTab === 'docker' && dockerCommand}
            </pre>
            <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
              <CopyButton
                text={
                  activeTab === 'helm'
                    ? helmCommand
                    : activeTab === 'kubectl'
                    ? kubectlCommand
                    : dockerCommand
                }
                label="Sao chép lệnh"
              />
            </div>
          </div>
        </div>

        {/* Bước 2 */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--border-default)',
            padding: '20px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span
              style={{
                width: '24px',
                height: '24px',
                backgroundColor: 'var(--color-primary)',
                color: '#FFFFFF',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              2
            </span>
            <h4
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.875rem',
                fontWeight: 700,
                color: 'var(--color-ink)',
                margin: 0,
              }}
            >
              Kiểm tra trạng thái Pod Tác tử đang chạy
            </h4>
          </div>

          <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-muted)', marginBottom: '10px' }}>
            Sau khi chạy lệnh cài đặt, kiểm tra xem Pod đã khởi động thành công trong namespace <code>selfheal-system</code>:
          </p>

          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <pre
              style={{
                backgroundColor: '#0F172A',
                color: '#38BDF8',
                padding: '12px 16px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8125rem',
                margin: 0,
              }}
            >
              kubectl get pods -n selfheal-system
            </pre>
            <div style={{ position: 'absolute', top: '8px', right: '10px' }}>
              <CopyButton text="kubectl get pods -n selfheal-system" label="Copy" />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', fontFamily: 'var(--font-mono)' }}>
            ✓ Trạng thái mong đợi: <code>STATUS: Running (1/1 Ready)</code>
          </div>
        </div>

        {/* Bước 3 */}
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--border-default)',
            padding: '20px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span
              style={{
                width: '24px',
                height: '24px',
                backgroundColor: 'var(--color-primary)',
                color: '#FFFFFF',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              3
            </span>
            <h4
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.875rem',
                fontWeight: 700,
                color: 'var(--color-ink)',
                margin: 0,
              }}
            >
              Kiểm tra nhật ký truyền dữ liệu viễn trắc (Logs)
            </h4>
          </div>

          <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-muted)', marginBottom: '10px' }}>
            Kiểm tra log của Agent để đảm bảo kết nối WebSocket và gói tin nhịp tim (Heartbeat) đã hoạt động:
          </p>

          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <pre
              style={{
                backgroundColor: '#0F172A',
                color: '#38BDF8',
                padding: '12px 16px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8125rem',
                margin: 0,
              }}
            >
              kubectl logs -n selfheal-system -l app.kubernetes.io/name=selfheal-agent --tail=50 -f
            </pre>
            <div style={{ position: 'absolute', top: '8px', right: '10px' }}>
              <CopyButton text="kubectl logs -n selfheal-system -l app.kubernetes.io/name=selfheal-agent --tail=50 -f" label="Copy" />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', fontFamily: 'var(--font-mono)' }}>
            ✓ Dòng log xác nhận: <code>[INFO] Connected to SelfHeal Control Plane. Heartbeat sent successfully.</code>
          </div>
        </div>
      </div>

      {/* Trạng thái lắng nghe tín hiệu tự động (Không bắt buộc) */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '16px 20px',
          backgroundColor: isConnected ? '#F0FDF4' : '#F8FAFC',
          border: isConnected ? '1px solid #86EFAC' : '1px dashed var(--border-default)',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Radio size={18} color={isConnected ? '#059669' : '#64748B'} className={checking ? 'animate-pulse' : ''} />
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: isConnected ? '#065F46' : 'var(--color-ink)' }}>
              {isConnected
                ? 'Đã nhận được tín hiệu Heartbeat từ cụm của bạn!'
                : 'Đang tự động lắng nghe tín hiệu từ Tác tử...'}
            </div>
            <div style={{ fontSize: '0.75rem', color: isConnected ? '#047857' : 'var(--text-muted)' }}>
              {isConnected
                ? 'Cụm đã sẵn sàng đồng bộ chỉ số tài nguyên và kích hoạt tự phục hồi.'
                : 'Bạn không cần chờ tín hiệu ngay bây giờ. Có thể bấm Tiếp tục bất cứ lúc nào.'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleManualCheck}
          disabled={checking}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--border-default)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'var(--color-primary)',
            cursor: checking ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={13} className={checking ? 'animate-spin' : ''} />
          <span>{checking ? 'Đang kiểm tra...' : 'Kiểm tra tín hiệu'}</span>
        </button>
      </div>

      {/* Hướng dẫn xử lý sự cố kết nối */}
      <TroubleshootingAccordion />

      {/* Thanh điều hướng tiếp tục - LƯU TẤT CẢ VÀO DATABASE KHI CHUYỂN SANG BƯỚC 5 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '32px',
          paddingTop: '20px',
          borderTop: '1px dashed var(--border-default)',
        }}
      >
        <SecondaryButton onClick={handleBack} disabled={saving}>
          Quay lại Bước 3
        </SecondaryButton>

        <PrimaryButton
          onClick={handleContinue}
          disabled={saving}
          style={{
            backgroundColor: 'var(--color-primary)',
            color: '#FFFFFF',
            fontWeight: 700,
            minWidth: '180px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Đang lưu vào hệ thống...</span>
            </>
          ) : (
            <>
              <span>Tiếp tục Hoàn tất</span>
              <ArrowRight size={16} />
            </>
          )}
        </PrimaryButton>
      </div>
    </div>
  );
};

export default VerifyAgentStep;
