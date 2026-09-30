import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useToast } from '../../../context/ToastContext';
import {
  Settings,
  Webhook,
  Key,
  Shield,
  Clock,
  CheckCircle2,
  Save,
  Plus,
  Trash2,
  Copy,
  Send,
  Check
} from 'lucide-react';

export const SettingsPage = () => {
  const { currentOrg, currentEnv } = useDashboard();
  const { success: toastSuccess, warning: toastWarning } = useToast();
  const [activeTab, setActiveTab] = useState('WEBHOOK'); // WEBHOOK, API_KEYS, SECURITY, PREFERENCES
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [pingSuccess, setPingSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  // Form states
  const [slackWebhook, setSlackWebhook] = useState('https://hooks.slack.com/services/T00/B00/XXXXX');
  const [slackChannel, setSlackChannel] = useState('#selfheal-k8s-alerts');
  const [pagerdutyKey, setPagerdutyKey] = useState('pd_live_8941bb02fe7a');
  const [alertEmails, setAlertEmails] = useState('devops@acmecorp.vn, owner@acmecorp.vn');

  // API Tokens
  const [tokens, setTokens] = useState([
    {
      id: 'TOK-PROD-01',
      name: 'Agent Cluster Ingestion Key',
      token: 'sh_live_9f82aa10e82c1b9942a',
      scope: 'cluster:metrics:write',
      createdAt: '01/08/2026',
      status: 'Active',
    },
    {
      id: 'TOK-CI-02',
      name: 'GitHub Actions Deployment Token',
      token: 'sh_live_33bb77a11cd99ef01a8',
      scope: 'cluster:deployments:admin',
      createdAt: '15/08/2026',
      status: 'Active',
    },
  ]);

  // Modal new token
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenScope, setNewTokenScope] = useState('read-only');

  const handleSave = (e) => {
    e?.preventDefault();
    setSaveSuccess(true);
    toastSuccess('Cấu hình cài đặt nền tảng đã được lưu thành công!', 'Cài Đặt Hệ Thống');
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleTestPing = () => {
    setPingSuccess(true);
    toastSuccess('Gửi gói tin ping kiểm tra Webhook thành công! Phản hồi HTTP 200 OK.', 'Kiểm Tra Webhook');
    setTimeout(() => setPingSuccess(false), 3000);
  };

  const handleCopy = (val) => {
    navigator.clipboard?.writeText(val);
    setCopiedKey(val);
    toastSuccess('Đã sao chép khóa API vào clipboard!', 'Sao Chép Thành Công');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDeleteToken = (id) => {
    setTokens(tokens.filter((t) => t.id !== id));
    toastWarning('Đã thu hồi khóa API Token khỏi hệ thống.', 'Bảo Mật API');
  };

  return (
    <div className="dashboard-settings-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={22} color="var(--dash-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--dash-text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Cài Đặt Nền Tảng & Tích Hợp Hệ Thống
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--dash-text-secondary)', marginTop: '4px', margin: 0 }}>
            {currentOrg.name} &bull; <span style={{ fontFamily: 'var(--font-mono)' }}>{currentEnv.name}</span> &bull; Quản lý Webhook thông báo Slack, API Keys, chính sách bảo mật 2FA và cấu hình môi trường
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            backgroundColor: 'var(--dash-primary)',
            border: 'none',
            borderRadius: 'var(--dash-radius-md)',
            color: '#FFFFFF',
            fontSize: '0.8125rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {saveSuccess ? <Check size={16} /> : <Save size={16} />}
          <span>{saveSuccess ? 'Đã Lưu Thành Công' : 'Lưu Toàn Bộ Cài Đặt'}</span>
        </button>
      </div>

      {saveSuccess && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: 'var(--dash-radius-md)',
            color: '#065F46',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={18} color="#059669" />
          <span>Cấu hình tích hợp và bảo mật đã được áp dụng và đồng bộ hóa thành công!</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--dash-border)', paddingBottom: '8px', flexWrap: 'wrap' }}>
        {[
          { key: 'WEBHOOK', label: 'Tích Hợp Webhook & Cảnh Báo', icon: Webhook },
          { key: 'API_KEYS', label: 'Khóa Truy Cập API Tokens', icon: Key },
          { key: 'SECURITY', label: 'Bảo Mật & Xác Thực 2FA', icon: Shield },
          { key: 'PREFERENCES', label: 'Tùy Chọn Múi Giờ & Cụm', icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                border: 'none',
                backgroundColor: isActive ? 'var(--dash-mint-100)' : 'transparent',
                color: isActive ? 'var(--dash-primary)' : 'var(--dash-text-secondary)',
                borderRadius: 'var(--dash-radius-md)',
                fontSize: '0.8125rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Webhook */}
      {activeTab === 'WEBHOOK' && (
        <div className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: '0 0 4px 0' }}>
              Điều Phối Cảnh Báo Qua Kênh Slack & Webhook
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0 }}>
              Gửi tín hiệu tức thời khi AI phát hiện nguy cơ bão hòa tải hoặc cần con người phê duyệt HITL
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Slack Incoming Webhook URL
              </label>
              <input
                type="text"
                value={slackWebhook}
                onChange={(e) => setSlackWebhook(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                  Kênh Slack Mục Tiêu
                </label>
                <input
                  type="text"
                  value={slackChannel}
                  onChange={(e) => setSlackChannel(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                  PagerDuty Integration Key (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={pagerdutyKey}
                  onChange={(e) => setPagerdutyKey(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Email Nhận Cảnh Báo Khẩn Cấp (Phân cách bằng dấu phẩy)
              </label>
              <input
                type="text"
                value={alertEmails}
                onChange={(e) => setAlertEmails(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '8px' }}>
              <button
                type="button"
                onClick={handleTestPing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--dash-border)',
                  borderRadius: 'var(--dash-radius-md)',
                  color: 'var(--dash-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Send size={14} />
                <span>Gửi Thử Cảnh Báo Test Ping Tới Slack</span>
              </button>

              {pingSuccess && (
                <span style={{ fontSize: '0.8125rem', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={16} />
                  <span>Tin nhắn Test Ping đã gửi tới {slackChannel}!</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: API Keys */}
      {activeTab === 'API_KEYS' && (
        <div className="dash-card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--dash-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Khóa Truy Cập API Tokens Cụm
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
                Xác thực giao tiếp an toàn giữa các tác tử eBPF Agent và máy chủ SelfHeal Control Plane
              </p>
            </div>
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                backgroundColor: 'var(--dash-primary)',
                border: 'none',
                borderRadius: 'var(--dash-radius-md)',
                color: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Plus size={16} />
              <span>Tạo Khóa Mới</span>
            </button>
          </div>

          <div className="dash-table-container" style={{ border: '1px solid var(--dash-border)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Mã & Tên Khóa</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Mã Token Bí Mật</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Phạm Vi Quyền Hạn</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Ngày Khởi Tạo</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((tok) => (
                  <tr key={tok.id} style={{ borderBottom: '1px solid var(--dash-border)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{tok.name}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--dash-text-muted)', fontFamily: 'var(--font-mono)' }}>{tok.id}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <button
                        type="button"
                        onClick={() => handleCopy(tok.token)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 8px',
                          backgroundColor: '#F8FAFC',
                          border: '1px solid var(--dash-border)',
                          borderRadius: 'var(--dash-radius-sm)',
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-mono)',
                          cursor: 'pointer',
                        }}
                      >
                        <span>{tok.token.substring(0, 14)}...</span>
                        {copiedKey === tok.token ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                      </button>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', padding: '2px 6px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: '4px' }}>
                        {tok.scope}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--dash-text-muted)' }}>{tok.createdAt}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteToken(tok.id)}
                        style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}
                        title="Thu hồi khóa"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Security */}
      {activeTab === 'SECURITY' && (
        <div className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: '0 0 4px 0' }}>
              Chính Sách Bảo Mật Doanh Nghiệp & Xác Thực 2FA
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0 }}>
              Áp dụng cơ chế xác thực đa yếu tố cho toàn bộ thành viên có quyền phê duyệt HITL
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: 'var(--dash-radius-md)' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)', fontSize: '0.9375rem' }}>
                  Xác Thực Đa Yếu Tố (Two-Factor Authentication 2FA)
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', marginTop: '2px' }}>
                  Bắt buộc quét mã TOTP Google Authenticator khi đăng nhập và khi ký duyệt hành động HITL
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#059669', backgroundColor: '#ECFDF5', padding: '4px 10px', borderRadius: 'var(--dash-radius-full)', border: '1px solid #A7F3D0' }}>
                ĐÃ BẬT
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: 'var(--dash-bg-canvas)', borderRadius: 'var(--dash-radius-md)' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)', fontSize: '0.9375rem' }}>
                  Đăng Nhập Một Lần Doanh Nghiệp (SSO SAML / Google Workspace)
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', marginTop: '2px' }}>
                  Đồng bộ hóa danh bạ nhân sự và quyền truy cập qua domain công ty
                </div>
              </div>
              <button
                type="button"
                style={{ padding: '6px 12px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', backgroundColor: '#FFFFFF', fontSize: '0.75rem', fontWeight: 700, color: 'var(--dash-primary)', cursor: 'pointer' }}
              >
                Cấu hình SSO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Preferences */}
      {activeTab === 'PREFERENCES' && (
        <div className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: '0 0 4px 0' }}>
              Tùy Chọn Múi Giờ & Hiển Thị Bảng Điều Khiển
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0 }}>
              Chuẩn hóa khung giờ ghi nhận sự kiện viễn trắc tương ứng với múi giờ vận hành
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Múi Giờ Vận Hành (Timezone)
              </label>
              <select
                defaultValue="Asia/Ho_Chi_Minh"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
              >
                <option value="Asia/Ho_Chi_Minh">Việt Nam (GMT+7 - Asia/Ho Chi Minh)</option>
                <option value="UTC">Giờ Quốc Tế (UTC+0)</option>
                <option value="America/New_York">Hoa Kỳ Miền Đông (US East - EST)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Ngôn Ngữ Giao Diện Mặc Định
              </label>
              <select
                defaultValue="vi"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
              >
                <option value="vi">Tiếng Việt (Chuẩn Kỹ Thuật Hệ Thống)</option>
                <option value="en">English (US)</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
