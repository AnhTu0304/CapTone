import React, { useState, useEffect, useCallback } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useToast } from '../../../context/ToastContext';
import { aiService } from '../../../services/aiService';
import {
  Settings,
  CheckCircle2,
  Save,
  BellRing,
  AlertTriangle,
  Users
} from 'lucide-react';

const EMAIL_VALIDATION_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SettingsPage = () => {
  const { currentOrg, currentUserRole } = useDashboard();
  const { success: toastSuccess, warning: toastWarning, error: toastError } = useToast();
  const [saveSuccess, setSaveSuccess] = useState(false);

  const canEditAlertSettings = currentUserRole !== 'VIEWER';

  // Alert settings states synced with Backend (/api/v1/organizations/:id/alert-settings)
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [criticalEmailEnabled, setCriticalEmailEnabled] = useState(true);
  const [notifyOnNoAction, setNotifyOnNoAction] = useState(true);
  const [notifyOnHealingFailed, setNotifyOnHealingFailed] = useState(true);
  const [cooldownMinutes, setCooldownMinutes] = useState(15);
  const [alertEmails, setAlertEmails] = useState('');
  const [defaultRecipients, setDefaultRecipients] = useState([]);

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
      }
    } catch (err) {
      console.warn('[SettingsPage] Không thể tải cấu hình cảnh báo:', err?.message);
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    loadAlertSettings(currentOrg?.id);
  }, [currentOrg?.id, loadAlertSettings]);

  const handleSave = async (e) => {
    e?.preventDefault();

    if (!currentOrg?.id || String(currentOrg.id).startsWith('sandbox-') || currentOrg.id === 'org-empty') {
      toastWarning('Vui lòng chọn một tổ chức thực tế trước khi lưu cấu hình.', 'Chưa Chọn Tổ Chức');
      return;
    }

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
  };

  return (
    <div className="dashboard-settings-page" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.12)',
            }}
          >
            <Settings size={19} color="#059669" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
              Cài Đặt Hệ Thống &amp; Cảnh Báo
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '2px 0 0 0' }}>
              Cấu hình gửi email cảnh báo sự cố khẩn cấp &amp; quy tắc chống spam cho tổ chức
            </p>
          </div>
        </div>
      </div>

      {/* Hàng 3 Thẻ KPI Trạng Thái Cấu Hình Cảnh Báo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(226, 232, 240, 0.95)', borderTop: `2.5px solid ${criticalEmailEnabled ? '#10B981' : '#94A3B8'}`, borderRadius: '12px', padding: '11px 14px', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>EMAIL CẢNH BÁO KHẨN</span>
            <BellRing size={14} color={criticalEmailEnabled ? '#10B981' : '#94A3B8'} />
          </div>
          <div style={{ marginTop: '6px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 9px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: criticalEmailEnabled ? '#ECFDF5' : '#F1F5F9', color: criticalEmailEnabled ? '#047857' : '#64748B', border: `1px solid ${criticalEmailEnabled ? '#A7F3D0' : '#E2E8F0'}` }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: criticalEmailEnabled ? '#10B981' : '#94A3B8' }} />
              {criticalEmailEnabled ? 'Đang kích hoạt' : 'Đang tạm tắt'}
            </span>
          </div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(226, 232, 240, 0.95)', borderTop: '2.5px solid #F59E0B', borderRadius: '12px', padding: '11px 14px', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>CHỐNG SPAM (COOLDOWN)</span>
            <AlertTriangle size={14} color="#F59E0B" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>{cooldownMinutes}</span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>phút / sự cố trùng</span>
          </div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(226, 232, 240, 0.95)', borderTop: '2.5px solid #3B82F6', borderRadius: '12px', padding: '11px 14px', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.02em' }}>NGƯỜI NHẬN RBAC</span>
            <Users size={14} color="#3B82F6" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0F172A' }}>{defaultRecipients.length}</span>
            <span style={{ fontSize: '0.7rem', color: '#64748B' }}>SME Owner &amp; DevOps</span>
          </div>
        </div>
      </div>

      {saveSuccess && (
        <div
          style={{
            padding: '11px 15px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: '12px',
            color: '#047857',
            fontSize: '0.82rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={17} color="#059669" />
          <span>Cấu hình cảnh báo khẩn cấp đã được áp dụng và đồng bộ hóa thành công!</span>
        </div>
      )}

      {/* Card: Cảnh Báo Sự Cố Khẩn Cấp & Chống Spam Email */}
      <div className="dash-card" style={{ padding: '18px 20px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BellRing size={17} color="#DC2626" />
            </div>
            <div>
              <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Cảnh Báo Sự Cố Khẩn Cấp &amp; Chống Spam Email
              </h3>
              <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '2px 0 0 0' }}>
                Cấu hình gửi email khẩn tự động khi hệ thống gặp sự cố mức độ KHẨN CẤP (bao gồm NO_ACTION, NO_POLICY hoặc Self-Healing thất bại)
              </p>
            </div>
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
              borderRadius: '10px',
              color: '#92400E',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertTriangle size={15} color="#D97706" />
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
              border: '1px solid #E2E8F0',
              borderRadius: '11px',
              cursor: canEditAlertSettings ? 'pointer' : 'not-allowed',
            }}
          >
            <input
              type="checkbox"
              checked={criticalEmailEnabled}
              disabled={!canEditAlertSettings}
              onChange={(e) => setCriticalEmailEnabled(e.target.checked)}
              style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: '#059669' }}
            />
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A' }}>
                Bật Email Cảnh Báo Khẩn Cấp
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '2px' }}>
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
              border: '1px solid #E2E8F0',
              borderRadius: '11px',
              cursor: canEditAlertSettings && criticalEmailEnabled ? 'pointer' : 'not-allowed',
              opacity: criticalEmailEnabled ? 1 : 0.6,
            }}
          >
            <input
              type="checkbox"
              checked={notifyOnNoAction}
              disabled={!canEditAlertSettings || !criticalEmailEnabled}
              onChange={(e) => setNotifyOnNoAction(e.target.checked)}
              style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: '#059669' }}
            />
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A' }}>
                Gửi khi AI khuyến nghị NO_ACTION / Chờ kiểm tra
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '2px' }}>
                Báo khẩn ngay khi sự cố khẩn cấp bị dừng tự động (NO_ACTION / NO_POLICY / Circuit Breaker).
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
              border: '1px solid #E2E8F0',
              borderRadius: '11px',
              cursor: canEditAlertSettings && criticalEmailEnabled ? 'pointer' : 'not-allowed',
              opacity: criticalEmailEnabled ? 1 : 0.6,
            }}
          >
            <input
              type="checkbox"
              checked={notifyOnHealingFailed}
              disabled={!canEditAlertSettings || !criticalEmailEnabled}
              onChange={(e) => setNotifyOnHealingFailed(e.target.checked)}
              style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: '#059669' }}
            />
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A' }}>
                Gửi khi Auto-Healing thất bại
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '2px' }}>
                Báo khẩn lập tức nếu Agent hoặc Dispatcher tự phục hồi sự cố khẩn cấp thất bại.
              </div>
            </div>
          </label>
        </div>

        {/* Cooldown + Extra Emails */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Thời Gian Chống Spam Email
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {[5, 15, 30, 60].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={!canEditAlertSettings}
                  onClick={() => setCooldownMinutes(preset)}
                  style={{
                    height: '34px',
                    padding: '0 12px',
                    borderRadius: '9px',
                    border: Number(cooldownMinutes) === preset ? '1px solid #059669' : '1px solid #E2E8F0',
                    backgroundColor: Number(cooldownMinutes) === preset ? '#ECFDF5' : '#FFFFFF',
                    color: Number(cooldownMinutes) === preset ? '#047857' : '#475569',
                    fontSize: '0.76rem',
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
                  width: '84px',
                  height: '34px',
                  padding: '0 10px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '9px',
                  backgroundColor: '#F8FAFC',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: '#0F172A',
                }}
              />
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '6px', lineHeight: 1.4 }}>
              Mặc định 15 phút cho cùng 1 dịch vụ + cùng loại lỗi nhằm chống gửi email lặp hàng loạt khi hệ thống tự động cảnh báo.
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Danh Sách Email Tùy Chỉnh Nhận Cảnh Báo (Phân cách dấu phẩy)
            </label>
            <input
              type="text"
              placeholder="oncall-sre@company.vn, cto@company.vn"
              value={alertEmails}
              disabled={!canEditAlertSettings}
              onChange={(e) => setAlertEmails(e.target.value)}
              style={{ width: '100%', height: '34px', padding: '0 12px', border: '1px solid #E2E8F0', borderRadius: '10px', backgroundColor: '#F8FAFC', fontSize: '0.82rem', color: '#0F172A' }}
            />
            <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '6px', lineHeight: 1.4 }}>
              Các địa chỉ này sẽ tự động nhận email cảnh báo cùng SME_OWNER và DEVOPS mỗi khi hệ thống phát hiện sự cố khẩn cấp.
            </div>
          </div>
        </div>

        {/* Default RBAC Recipients Preview */}
        <div style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
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
                    border: '1px solid #E2E8F0',
                    fontSize: '0.74rem',
                    color: '#0F172A',
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.64rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '999px',
                      backgroundColor: r.role_code === 'SME_OWNER' ? '#ECFDF5' : '#EFF6FF',
                      color: r.role_code === 'SME_OWNER' ? '#047857' : '#1D4ED8',
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

        {/* Action Button: Save Alert Config */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '14px' }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canEditAlertSettings || isSavingSettings}
            style={{
              height: '34px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 16px',
              backgroundColor: '#059669',
              border: '1px solid #059669',
              borderRadius: '10px',
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.2)',
              color: '#FFFFFF',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: !canEditAlertSettings || isSavingSettings ? 'not-allowed' : 'pointer',
              opacity: !canEditAlertSettings || isSavingSettings ? 0.65 : 1,
            }}
          >
            <Save size={14} />
            <span>{isSavingSettings ? 'Đang lưu...' : 'Lưu Cấu Hình Cảnh Báo'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
