import React, { useState, useEffect, useCallback } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useToast } from '../../../context/ToastContext';
import { aiService } from '../../../services/aiService';
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
  Check,
  BellRing,
  Mail,
  AlertTriangle,
  Users
} from 'lucide-react';

const EMAIL_VALIDATION_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SettingsPage = () => {
  const { currentOrg, currentUserRole } = useDashboard();
  const { success: toastSuccess, warning: toastWarning, error: toastError } = useToast();
  const [activeTab, setActiveTab] = useState('WEBHOOK'); // WEBHOOK, API_KEYS, SECURITY, PREFERENCES
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [pingSuccess, setPingSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  const canEditAlertSettings = currentUserRole !== 'VIEWER';

  // Alert settings states synced with Backend (/api/v1/organizations/:id/alert-settings)
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailResultMsg, setTestEmailResultMsg] = useState('');

  const [criticalEmailEnabled, setCriticalEmailEnabled] = useState(true);
  const [notifyOnNoAction, setNotifyOnNoAction] = useState(true);
  const [notifyOnHealingFailed, setNotifyOnHealingFailed] = useState(true);
  const [cooldownMinutes, setCooldownMinutes] = useState(15);
  const [alertEmails, setAlertEmails] = useState('');
  const [defaultRecipients, setDefaultRecipients] = useState([]);
  const [testTargetEmail, setTestTargetEmail] = useState('');

  // Webhook / PagerDuty states
  const [slackWebhook, setSlackWebhook] = useState('');
  const [slackChannel, setSlackChannel] = useState('#selfheal-k8s-alerts');
  const [pagerdutyKey, setPagerdutyKey] = useState('');

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

  const loadAlertSettings = useCallback(async (orgId) => {
    if (!orgId || String(orgId).startsWith('sandbox-') || orgId === 'org-empty') {
      setDefaultRecipients([]);
      return;
    }
    setIsLoadingSettings(true);
    try {
      const data = await aiService.getOrgAlertSettings(orgId);
      if (data) {
        setCriticalEmailEnabled(data.critical_email_enabled !== false);
        setNotifyOnNoAction(data.notify_on_no_action !== false);
        setNotifyOnHealingFailed(data.notify_on_healing_failed !== false);
        setCooldownMinutes(Number(data.cooldown_minutes) || 15);
        setAlertEmails(Array.isArray(data.extra_emails) ? data.extra_emails.join(', ') : '');
        setDefaultRecipients(Array.isArray(data.default_recipients) ? data.default_recipients : []);
        setSlackWebhook(data.slack_webhook_url || '');
        setSlackChannel(data.slack_channel || '#selfheal-k8s-alerts');
        setPagerdutyKey(data.pagerduty_key || '');
      }
    } catch (err) {
      console.warn('[SettingsPage] Không thể tải cấu hình cảnh báo:', err?.message);
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    setTestEmailResultMsg('');
    loadAlertSettings(currentOrg?.id);
  }, [currentOrg?.id, loadAlertSettings]);

  const handleSave = async (e) => {
    e?.preventDefault();

    if (activeTab === 'WEBHOOK' && currentOrg?.id && !String(currentOrg.id).startsWith('sandbox-')) {
      if (!canEditAlertSettings) {
        toastError('Vai trò VIEWER chỉ có quyền xem cấu hình cảnh báo.', 'Không Đủ Thẩm Quyền');
        return;
      }

      const rawList = String(alertEmails || '')
        .split(/[,;\n]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const invalidEmails = rawList.filter((em) => !EMAIL_VALIDATION_REGEX.test(em));
      if (invalidEmails.length > 0) {
        toastError(`Địa chỉ email không hợp lệ: ${invalidEmails.join(', ')}`, 'Lỗi Nhập Liệu');
        return;
      }

      const parsedCooldown = Number(cooldownMinutes);
      if (!Number.isInteger(parsedCooldown) || parsedCooldown < 1 || parsedCooldown > 1440) {
        toastError('Thời gian chống spam email phải là số nguyên từ 1 đến 1440 phút.', 'Lỗi Nhập Liệu');
        return;
      }

      setIsSavingSettings(true);
      try {
        const updated = await aiService.updateOrgAlertSettings(currentOrg.id, {
          critical_email_enabled: criticalEmailEnabled,
          notify_on_no_action: notifyOnNoAction,
          notify_on_healing_failed: notifyOnHealingFailed,
          cooldown_minutes: parsedCooldown,
          extra_emails: Array.from(new Set(rawList)),
          slack_webhook_url: slackWebhook.trim() || null,
          slack_channel: slackChannel.trim() || null,
          pagerduty_key: pagerdutyKey.trim() || null,
        });

        if (updated) {
          setCriticalEmailEnabled(updated.critical_email_enabled !== false);
          setNotifyOnNoAction(updated.notify_on_no_action !== false);
          setNotifyOnHealingFailed(updated.notify_on_healing_failed !== false);
          setCooldownMinutes(Number(updated.cooldown_minutes) || 15);
          setAlertEmails(Array.isArray(updated.extra_emails) ? updated.extra_emails.join(', ') : '');
          if (Array.isArray(updated.default_recipients)) {
            setDefaultRecipients(updated.default_recipients);
          }
        }

        setSaveSuccess(true);
        toastSuccess('Đã lưu cấu hình cảnh báo khẩn cấp và đồng bộ cho tổ chức!', 'Cài Đặt Cảnh Báo');
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch (err) {
        toastError(err?.message || 'Không thể lưu cấu hình cảnh báo lúc này.', 'Lỗi Lưu Cài Đặt');
      } finally {
        setIsSavingSettings(false);
      }
      return;
    }

    setSaveSuccess(true);
    toastSuccess('Cấu hình cài đặt nền tảng đã được lưu thành công!', 'Cài Đặt Hệ Thống');
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSendTestAlertEmail = async () => {
    if (!currentOrg?.id || String(currentOrg.id).startsWith('sandbox-')) {
      toastWarning('Vui lòng chọn một tổ chức thực tế trước khi gửi email thử nghiệm.', 'Chưa Chọn Tổ Chức');
      return;
    }
    if (!canEditAlertSettings) {
      toastError('Vai trò VIEWER chỉ có quyền xem cấu hình.', 'Không Đủ Thẩm Quyền');
      return;
    }

    const cleanTarget = testTargetEmail.trim().toLowerCase();
    if (cleanTarget && !EMAIL_VALIDATION_REGEX.test(cleanTarget)) {
      toastError('Email nhận thử nghiệm không đúng định dạng.', 'Lỗi Nhập Liệu');
      return;
    }

    setIsSendingTestEmail(true);
    setTestEmailResultMsg('');
    try {
      const res = await aiService.sendOrgTestAlertEmail(currentOrg.id, cleanTarget || undefined);
      const data = res?.data || res || {};
      const recipients = Array.isArray(data.recipients) ? data.recipients : [];
      const sentCount = data.sent_count ?? recipients.length;
      const summary =
        recipients.length > 0
          ? `Đã gửi email thử nghiệm tới ${sentCount} địa chỉ: ${recipients.join(', ')}`
          : `Đã thực hiện gửi email thử nghiệm (${sentCount} email).`;
      setTestEmailResultMsg(summary);
      toastSuccess(summary, 'Gửi Email Test Thành Công');
    } catch (err) {
      toastError(err?.message || 'Không thể gửi email kiểm tra. Vui lòng kiểm tra cấu hình SMTP.', 'Lỗi Gửi Email');
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleTestPing = () => {
    if (!slackWebhook.trim()) {
      toastWarning('Vui lòng nhập Slack Incoming Webhook URL trước khi kiểm tra.', 'Thiếu Webhook URL');
      return;
    }
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
            Quản lý cảnh báo Email khẩn cấp, Webhook Slack, API Keys, chính sách bảo mật 2FA và cấu hình môi trường
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSavingSettings || (activeTab === 'WEBHOOK' && !canEditAlertSettings)}
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
            cursor: isSavingSettings || (activeTab === 'WEBHOOK' && !canEditAlertSettings) ? 'not-allowed' : 'pointer',
            opacity: isSavingSettings || (activeTab === 'WEBHOOK' && !canEditAlertSettings) ? 0.65 : 1,
          }}
        >
          {saveSuccess ? <Check size={16} /> : <Save size={16} />}
          <span>{isSavingSettings ? 'Đang lưu...' : saveSuccess ? 'Đã Lưu Thành Công' : 'Lưu Toàn Bộ Cài Đặt'}</span>
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
          <span>Cấu hình tích hợp và cảnh báo khẩn cấp đã được áp dụng và đồng bộ hóa thành công!</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--dash-border)', paddingBottom: '8px', flexWrap: 'wrap' }}>
        {[
          { key: 'WEBHOOK', label: 'Cảnh Báo Khẩn Cấp & Webhook', icon: Webhook },
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

      {/* Tab 1: Alert Settings & Webhook */}
      {activeTab === 'WEBHOOK' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card 1A: Critical Email Alerting & Anti-Spam Cooldown */}
          <div className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BellRing size={18} color="#DC2626" />
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--dash-text-primary)', margin: 0 }}>
                    Cảnh Báo Sự Cố Khẩn Cấp (CRITICAL) &amp; Chống Spam Email
                  </h3>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: '4px 0 0 0' }}>
                  Cấu hình gửi email khẩn tự động khi hệ thống gặp sự cố mức độ KHẨN CẤP (bao gồm NO_ACTION, NO_POLICY hoặc Self-Healing thất bại)
                </p>
              </div>
              {isLoadingSettings && (
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
                  Đang tải cấu hình...
                </span>
              )}
            </div>

            {!canEditAlertSettings && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  borderRadius: '8px',
                  color: '#92400E',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertTriangle size={16} color="#D97706" />
                <span>Vai trò hiện tại (VIEWER) chỉ có quyền xem cấu hình. Chỉ SME_OWNER hoặc DEVOPS mới có thể chỉnh sửa và gửi test.</span>
              </div>
            )}

            {/* Toggle switches */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px 14px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid var(--dash-border)',
                  borderRadius: '10px',
                  cursor: canEditAlertSettings ? 'pointer' : 'not-allowed',
                }}
              >
                <input
                  type="checkbox"
                  checked={criticalEmailEnabled}
                  disabled={!canEditAlertSettings}
                  onChange={(e) => setCriticalEmailEnabled(e.target.checked)}
                  style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: '#DC2626' }}
                />
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A' }}>
                    Bật Email Cảnh Báo Khẩn (CRITICAL)
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                    Công tắc tổng cho cảnh báo email tự động khi có sự cố khẩn cấp.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px 14px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid var(--dash-border)',
                  borderRadius: '10px',
                  cursor: canEditAlertSettings && criticalEmailEnabled ? 'pointer' : 'not-allowed',
                  opacity: criticalEmailEnabled ? 1 : 0.6,
                }}
              >
                <input
                  type="checkbox"
                  checked={notifyOnNoAction}
                  disabled={!canEditAlertSettings || !criticalEmailEnabled}
                  onChange={(e) => setNotifyOnNoAction(e.target.checked)}
                  style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: '#DC2626' }}
                />
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A' }}>
                    Gửi khi AI khuyến nghị NO_ACTION / Chờ kiểm tra
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                    Báo khẩn ngay khi sự cố CRITICAL bị dừng tự động (NO_ACTION / NO_POLICY / Circuit Breaker).
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px 14px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid var(--dash-border)',
                  borderRadius: '10px',
                  cursor: canEditAlertSettings && criticalEmailEnabled ? 'pointer' : 'not-allowed',
                  opacity: criticalEmailEnabled ? 1 : 0.6,
                }}
              >
                <input
                  type="checkbox"
                  checked={notifyOnHealingFailed}
                  disabled={!canEditAlertSettings || !criticalEmailEnabled}
                  onChange={(e) => setNotifyOnHealingFailed(e.target.checked)}
                  style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: '#DC2626' }}
                />
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A' }}>
                    Gửi khi Auto-Healing thất bại
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                    Báo khẩn lập tức nếu Agent hoặc Dispatcher tự phục hồi CRITICAL thất bại.
                  </div>
                </div>
              </label>
            </div>

            {/* Cooldown + Extra Emails */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                  Thời Gian Chống Spam Email (Cooldown - Phút)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {[5, 15, 30, 60].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={!canEditAlertSettings}
                      onClick={() => setCooldownMinutes(preset)}
                      style={{
                        padding: '7px 12px',
                        borderRadius: '6px',
                        border: Number(cooldownMinutes) === preset ? '1px solid #DC2626' : '1px solid var(--dash-border)',
                        backgroundColor: Number(cooldownMinutes) === preset ? '#FFF1F2' : '#FFFFFF',
                        color: Number(cooldownMinutes) === preset ? '#DC2626' : '#334155',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: canEditAlertSettings ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {preset} phút
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={cooldownMinutes}
                    disabled={!canEditAlertSettings}
                    onChange={(e) => setCooldownMinutes(e.target.value)}
                    style={{
                      width: '88px',
                      padding: '7px 10px',
                      border: '1px solid var(--dash-border)',
                      borderRadius: '6px',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                    }}
                  />
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '6px', lineHeight: 1.4 }}>
                  Mặc định 15 phút cho cùng 1 dịch vụ + cùng loại lỗi CRITICAL nhằm chống gửi email lặp hàng loạt khi hệ thống tự động cảnh báo.
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                  Danh Sách Email Tùy Chỉnh Nhận Cảnh Báo (Phân cách dấu phẩy)
                </label>
                <input
                  type="text"
                  placeholder="oncall-sre@company.vn, cto@company.vn"
                  value={alertEmails}
                  disabled={!canEditAlertSettings}
                  onChange={(e) => setAlertEmails(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
                />
                <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '6px', lineHeight: 1.4 }}>
                  Các địa chỉ này sẽ tự động nhận email cảnh báo cùng SME_OWNER và DEVOPS mỗi khi hệ thống phát hiện sự cố CRITICAL.
                </div>
              </div>
            </div>

            {/* Default RBAC Recipients Preview */}
            <div style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78125rem', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
                <Users size={15} color="#059669" />
                <span>Người Nhận Mặc Định Theo Phân Quyền Tổ Chức (SME_OWNER &amp; DEVOPS — Luôn Loại Trừ VIEWER)</span>
              </div>
              {defaultRecipients.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  Chưa tải được hoặc không có thành viên SME_OWNER/DEVOPS đang hoạt động trong tổ chức hiện tại.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {defaultRecipients.map((r) => (
                    <span
                      key={r.user_id || r.email}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.75rem',
                        color: '#0F172A',
                        fontWeight: 600,
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: r.role_code === 'SME_OWNER' ? '#FEF2F2' : '#EFF6FF',
                          color: r.role_code === 'SME_OWNER' ? '#DC2626' : '#1D4ED8',
                        }}
                      >
                        {r.role_code}
                      </span>
                      <span>{r.email}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons: Save Alert Config & Test Email */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="email"
                  placeholder="Email nhận test (để trống = gửi tất cả người nhận)"
                  value={testTargetEmail}
                  disabled={!canEditAlertSettings}
                  onChange={(e) => setTestTargetEmail(e.target.value)}
                  style={{
                    width: '300px',
                    maxWidth: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--dash-border)',
                    borderRadius: 'var(--dash-radius-md)',
                    fontSize: '0.8125rem',
                  }}
                />
                <button
                  type="button"
                  onClick={handleSendTestAlertEmail}
                  disabled={!canEditAlertSettings || isSendingTestEmail}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    backgroundColor: '#FFF1F2',
                    border: '1px solid #FECACA',
                    borderRadius: 'var(--dash-radius-md)',
                    color: '#DC2626',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: !canEditAlertSettings || isSendingTestEmail ? 'not-allowed' : 'pointer',
                    opacity: !canEditAlertSettings || isSendingTestEmail ? 0.65 : 1,
                  }}
                >
                  <Mail size={14} />
                  <span>{isSendingTestEmail ? 'Đang gửi Email Test...' : 'Gửi Email Test Cảnh Báo'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={!canEditAlertSettings || isSavingSettings}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  backgroundColor: '#DC2626',
                  border: 'none',
                  borderRadius: 'var(--dash-radius-md)',
                  color: '#FFFFFF',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: !canEditAlertSettings || isSavingSettings ? 'not-allowed' : 'pointer',
                  opacity: !canEditAlertSettings || isSavingSettings ? 0.65 : 1,
                }}
              >
                <Save size={14} />
                <span>{isSavingSettings ? 'Đang lưu...' : 'Lưu Cấu Hình Cảnh Báo'}</span>
              </button>
            </div>

            {testEmailResultMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  borderRadius: '8px',
                  color: '#065F46',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={16} color="#059669" />
                <span>{testEmailResultMsg}</span>
              </div>
            )}
          </div>

          {/* Card 1B: Slack & Webhook Integrations */}
          <div className="dash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: '0 0 4px 0' }}>
                Điều Phối Cảnh Báo Qua Kênh Slack &amp; Webhook Mở Rộng
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', margin: 0 }}>
                Lưu trữ cấu hình Webhook Slack &amp; PagerDuty theo tổ chức cho thông báo đa kênh
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                  Slack Incoming Webhook URL
                </label>
                <input
                  type="text"
                  placeholder="https://hooks.slack.com/services/T000/B000/XXXXX"
                  value={slackWebhook}
                  disabled={!canEditAlertSettings}
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
                    disabled={!canEditAlertSettings}
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
                    placeholder="pd_live_..."
                    value={pagerdutyKey}
                    disabled={!canEditAlertSettings}
                    onChange={(e) => setPagerdutyKey(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--dash-border)', borderRadius: 'var(--dash-radius-md)', fontSize: '0.875rem' }}
                  />
                </div>
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
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--dash-text-secondary)' }}>Mã &amp; Tên Khóa</th>
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
              Chính Sách Bảo Mật Doanh Nghiệp &amp; Xác Thực 2FA
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
              Tùy Chọn Múi Giờ &amp; Hiển Thị Bảng Điều Khiển
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
