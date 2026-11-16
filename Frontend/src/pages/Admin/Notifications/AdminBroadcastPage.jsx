import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Send,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Megaphone,
  Radio,
  ShieldAlert,
  Building2,
  RefreshCw,
  Mail,
} from 'lucide-react';
import {
  fetchAdminBroadcasts,
  createAdminBroadcast,
  deleteAdminBroadcast,
} from '../../../services/adminBroadcastService';

export const AdminBroadcastPage = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('INFO'); // 'INFO' | 'WARNING' | 'CRITICAL'
  const [audience, setAudience] = useState('ALL'); // 'ALL' | 'OWNERS' | 'DEVOPS'
  const [showStickyBanner, setShowStickyBanner] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);

  // Broadcasts list & alerts state from PostgreSQL
  const [broadcasts, setBroadcasts] = useState([]);
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Nạp dữ liệu từ PostgreSQL qua Backend API
  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await fetchAdminBroadcasts();
      if (Array.isArray(data?.broadcasts)) {
        setBroadcasts(data.broadcasts);
      }
      if (Array.isArray(data?.systemAlerts)) {
        setSystemAlerts(data.systemAlerts);
      }
    } catch (err) {
      console.warn('[AdminBroadcastPage] Lỗi tải dữ liệu thông báo toàn mạng:', err);
      setErrorMessage(err.message || 'Không thể nạp dữ liệu thông báo từ máy chủ.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Xử lý gửi thông báo mới
  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle || trimmedTitle.length < 3) {
      setErrorMessage('Tiêu đề thông báo phải có ít nhất 3 ký tự.');
      return;
    }

    if (!trimmedContent || trimmedContent.length < 5) {
      setErrorMessage('Nội dung thông báo phải có ít nhất 5 ký tự.');
      return;
    }

    setIsSubmitting(true);
    setFeedbackMessage('');
    setErrorMessage('');

    try {
      const newBroadcast = await createAdminBroadcast({
        title: trimmedTitle,
        content: trimmedContent,
        priority,
        audience,
        showStickyBanner,
        sendEmail,
      });

      setBroadcasts((prev) => [newBroadcast, ...prev]);
      setTitle('');
      setContent('');
      setFeedbackMessage(
        sendEmail || priority === 'CRITICAL'
          ? 'Đã phát sóng thông báo toàn mạng và kích hoạt tiến trình gửi email tới người dùng thành công!'
          : 'Đã phát sóng thông báo toàn mạng và gửi vào hộp thư người dùng thành công!'
      );
      setTimeout(() => setFeedbackMessage(''), 5000);
    } catch (err) {
      let msg = err.message || 'Lỗi khi phát sóng thông báo vào hệ thống cơ sở dữ liệu.';
      if (typeof msg === 'string' && msg.trim().startsWith('[') && msg.includes('"message"')) {
        try {
          const parsed = JSON.parse(msg);
          if (Array.isArray(parsed) && parsed[0]?.message) {
            msg = parsed[0].message;
          }
        } catch {}
      }
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý gỡ bỏ thông báo
  const handleDeleteBroadcast = async (id) => {
    try {
      await deleteAdminBroadcast(id);
      setBroadcasts((prev) => prev.filter((b) => b.id !== id));
      setFeedbackMessage('Đã gỡ bỏ thông báo toàn mạng thành công!');
      setTimeout(() => setFeedbackMessage(''), 4000);
    } catch (err) {
      setErrorMessage(err.message || 'Không thể gỡ bỏ thông báo này.');
    }
  };

  return (
    <div
      className="admin-broadcast-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '1440px',
        margin: '0 auto',
        paddingBottom: '48px',
      }}
    >
      {/* 1. Page Header Chuẩn Hóa Với Logo Gradient */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 10px rgba(5, 150, 105, 0.25)',
              flexShrink: 0,
            }}
          >
            <Bell size={24} />
          </div>
          <div>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--dash-text-primary)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Trung Tâm Phát Thông Báo Toàn Mạng
            </h1>
            <p
              style={{
                fontSize: '0.8125rem',
                color: 'var(--dash-text-secondary)',
                margin: '4px 0 0 0',
              }}
            >
              Soạn và ghim thông báo bảo trì, tin tức nâng cấp AI hoặc cảnh báo an ninh cho toàn thể người dùng nền tảng.
            </p>
          </div>
        </div>

        {/* Nút Làm Mới */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing || isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              backgroundColor: isRefreshing ? '#94A3B8' : '#FFFFFF',
              color: 'var(--dash-text-primary)',
              borderRadius: '9px',
              border: '1px solid var(--dash-border)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: isRefreshing || isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: 'var(--dash-shadow-xs)',
            }}
          >
            <RefreshCw
              size={13}
              style={{ animation: isRefreshing || isLoading ? 'spin 1s linear infinite' : 'none' }}
            />
            <span>{isRefreshing ? 'Đang Nạp...' : 'Làm Mới'}</span>
          </button>
        </div>
      </div>

      {/* Thông Báo Thành Công */}
      {feedbackMessage && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            fontSize: '0.8125rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} color="#059669" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Thông Báo Lỗi */}
      {errorMessage && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#991B1B',
            fontSize: '0.8125rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={16} color="#DC2626" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2. Main Grid: Form Soạn Thảo (Trái) + Cảnh Báo Hệ Thống (Phải) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '24px',
        }}
      >
        {/* Form Soạn Thông Báo */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: 'var(--dash-shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Megaphone size={18} color="#059669" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
              Soạn Thông Báo Mới
            </h3>
          </div>

          <form onSubmit={handleSendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--dash-text-primary)',
                  marginBottom: '6px',
                }}
              >
                Tiêu đề thông báo * <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--dash-text-muted)' }}>(tối thiểu 3 ký tự)</span>
              </label>
              <input
                type="text"
                required
                minLength={3}
                placeholder="VD: Nâng cấp mô hình AI v2.4 hoặc Lịch bảo trì cụm..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  backgroundColor: 'var(--dash-bg-canvas)',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--dash-text-primary)',
                  marginBottom: '6px',
                }}
              >
                Nội dung chi tiết * <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--dash-text-muted)' }}>(tối thiểu 5 ký tự)</span>
              </label>
              <textarea
                required
                minLength={5}
                rows={4}
                placeholder="Nhập nội dung thông báo gửi tới các khách hàng và người dùng (ít nhất 5 ký tự)..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--dash-border)',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  backgroundColor: 'var(--dash-bg-canvas)',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--dash-text-muted)',
                    marginBottom: '4px',
                  }}
                >
                  Mức độ ưu tiên
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <option value="INFO">Thông Tin (Bình thường)</option>
                  <option value="WARNING">Cảnh Báo (Màu vàng)</option>
                  <option value="CRITICAL">Khẩn Cấp / Bảo Trì (Màu đỏ)</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--dash-text-muted)',
                    marginBottom: '4px',
                  }}
                >
                  Đối tượng tiếp nhận
                </label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--dash-border)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <option value="ALL">Toàn bộ Người Dùng</option>
                  <option value="OWNERS">Chỉ Chủ Doanh Nghiệp (Owners)</option>
                  <option value="DEVOPS">Chỉ Kỹ Sư DevOps</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="stickyBannerCheck"
                  checked={showStickyBanner}
                  onChange={(e) => setShowStickyBanner(e.target.checked)}
                  style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--dash-primary)' }}
                />
                <label
                  htmlFor="stickyBannerCheck"
                  style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', cursor: 'pointer' }}
                >
                  Ghim thanh thông báo nổi (Banner) trên đầu màn hình của người dùng
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="sendEmailCheck"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#059669' }}
                />
                <label
                  htmlFor="sendEmailCheck"
                  style={{
                    fontSize: '0.8125rem',
                    color: sendEmail ? '#065F46' : 'var(--dash-text-primary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Mail size={15} color={sendEmail ? '#059669' : '#64748B'} />
                  <span>Đồng thời gửi email thông báo này tới hòm thư người dùng (SMTP Gmail)</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '11px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: isSubmitting ? '#94A3B8' : '#059669',
                color: '#FFFFFF',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                marginTop: '6px',
                transition: 'background-color 0.15s ease',
              }}
            >
              <Send size={15} />
              <span>{isSubmitting ? 'Đang Phát Sóng...' : 'Phát Thông Báo Toàn Mạng Ngay'}</span>
            </button>
          </form>
        </div>

        {/* Hộp Thư Cảnh Báo An Ninh & Mô Hình AI */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--dash-border)',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: 'var(--dash-shadow-xs)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={18} color="#D97706" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
                Hộp Thư Cảnh Báo An Ninh & Mô Hình AI
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#D97706' }}>
              {systemAlerts.filter((a) => a.unread).length} cảnh báo mới
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
            {systemAlerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: alert.unread ? '1px solid #FCD34D' : '1px solid var(--dash-border)',
                  backgroundColor: alert.unread ? '#FEFCE8' : 'var(--dash-bg-canvas)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <div style={{ marginTop: '2px' }}>
                  {alert.type === 'ORG' && <Building2 size={16} color="#059669" />}
                  {alert.type === 'AI' && <AlertTriangle size={16} color="#D97706" />}
                  {alert.type === 'SECURITY' && <ShieldAlert size={16} color="#DC2626" />}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--dash-text-primary)' }}>
                    {alert.title}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginTop: '4px',
                      fontSize: '0.6875rem',
                      color: 'var(--dash-text-muted)',
                    }}
                  >
                    <span>
                      Nguồn: <strong>{alert.source}</strong>
                    </span>
                    <span>&bull;</span>
                    <span>{alert.time}</span>
                  </div>
                </div>

                {alert.unread && (
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#D97706',
                      marginTop: '4px',
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: '1px dashed var(--dash-border)',
              textAlign: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setSystemAlerts(systemAlerts.map((a) => ({ ...a, unread: false })));
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--dash-primary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Đánh dấu tất cả cảnh báo là đã đọc &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* 3. Bảng Lịch Sử Thông Báo Đã Phát Sóng Từ PostgreSQL */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--dash-border)',
          borderRadius: '12px',
          boxShadow: 'var(--dash-shadow-xs)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--dash-border)' }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--dash-text-primary)', margin: 0 }}>
            Lịch Sử Thông Báo Đã Phát Sóng ({broadcasts.length})
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', margin: '2px 0 0 0' }}>
            Dữ liệu thời gian thực được đồng bộ trực tiếp từ cơ sở dữ liệu PostgreSQL
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--dash-bg-canvas)',
                  borderBottom: '1px solid var(--dash-border)',
                  color: 'var(--dash-text-muted)',
                }}
              >
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>TIÊU ĐỀ THÔNG BÁO</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>MỨC ĐỘ</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>ĐỐI TƯỢNG</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>TRẠNG THÁI</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>THỜI ĐIỂM GỬI</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>LƯỢT TIẾP CẬN</th>
                <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && broadcasts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                    Đang nạp dữ liệu thông báo từ máy chủ...
                  </td>
                </tr>
              ) : broadcasts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                    Chưa có thông báo toàn mạng nào được phát sóng.
                  </td>
                </tr>
              ) : (
                broadcasts.map((b) => (
                  <tr
                    key={b.id}
                    style={{
                      borderBottom: '1px solid var(--dash-border)',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--dash-bg-subtle)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontFamily: 'var(--font-mono)',
                            color: '#059669',
                            backgroundColor: 'rgba(5, 150, 105, 0.08)',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontWeight: 700,
                          }}
                        >
                          {b.broadcast_code || 'BC'}
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{b.title}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginTop: '4px' }}>
                        {b.content?.slice(0, 90)}...
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          backgroundColor:
                            b.priority === 'CRITICAL'
                              ? '#FEF2F2'
                              : b.priority === 'WARNING'
                              ? '#FEFCE8'
                              : '#EFF6FF',
                          color:
                            b.priority === 'CRITICAL'
                              ? '#DC2626'
                              : b.priority === 'WARNING'
                              ? '#D97706'
                              : '#1D4ED8',
                          border: `1px solid ${
                            b.priority === 'CRITICAL'
                              ? '#FECACA'
                              : b.priority === 'WARNING'
                              ? '#FDE68A'
                              : '#BFDBFE'
                          }`,
                        }}
                      >
                        {b.priority}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--dash-text-secondary)', fontWeight: 500 }}>
                      {b.audience}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: b.status === 'Đang hiển thị' ? '#059669' : 'var(--dash-text-muted)',
                        }}
                      >
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: b.status === 'Đang hiển thị' ? '#059669' : '#94A3B8',
                          }}
                        />
                        {b.status}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        color: 'var(--dash-text-muted)',
                      }}
                    >
                      {b.formatted_date || b.created_at || 'Vừa xong'}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                      {b.views_count ?? b.views ?? 0} lượt
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteBroadcast(b.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '6px',
                          cursor: 'pointer',
                          color: '#DC2626',
                          borderRadius: '6px',
                        }}
                        title="Gỡ bỏ thông báo này khỏi hệ thống"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminBroadcastPage;
