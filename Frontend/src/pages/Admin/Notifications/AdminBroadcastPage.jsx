import React, { useState } from 'react';
import {
  Bell,
  Send,
  AlertTriangle,
  Info,
  CheckCircle2,
  Trash2,
  Eye,
  Megaphone,
  Radio,
  Clock,
  ShieldAlert,
  UserCheck,
  Building2,
  Layers,
} from 'lucide-react';

export const AdminBroadcastPage = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('INFO'); // 'INFO' | 'WARNING' | 'CRITICAL'
  const [audience, setAudience] = useState('ALL'); // 'ALL' | 'OWNERS' | 'DEVOPS'
  const [showStickyBanner, setShowStickyBanner] = useState(true);

  // Broadcasts list state
  const [broadcasts, setBroadcasts] = useState([
    {
      id: 'BC-2026-09',
      title: 'Thông báo cập nhật thuật toán AI Model v2.4.1 (ONNX Runtime)',
      content: 'Hệ thống đã triển khai phiên bản mô hình phát hiện dị thường mới với độ trễ suy luận chỉ 1.2ms và giảm 82% tỷ lệ báo động nhầm.',
      priority: 'INFO',
      audience: 'Tất cả người dùng',
      status: 'Đang hiển thị',
      date: '21/10/2026 22:00',
      views: 1240,
    },
    {
      id: 'BC-2026-08',
      title: 'Bảo trì hạ tầng cơ sở dữ liệu định kỳ Quý 4',
      content: 'Hệ thống sẽ tiến hành bảo trì tối ưu hóa cơ sở dữ liệu PostgreSQL trong 15 phút vào 02:00 Chủ Nhật ngày 25/10/2026.',
      priority: 'WARNING',
      audience: 'Chủ Doanh nghiệp & DevOps',
      status: 'Đã lên lịch',
      date: '19/10/2026 14:30',
      views: 890,
    },
    {
      id: 'BC-2026-07',
      title: 'Cảnh báo an ninh: Đã kích hoạt cơ chế mã hóa kiểm toán SHA-256',
      content: 'Toàn bộ thao tác phân quyền và tự phục hồi từ nay được bảo vệ bằng chữ ký số bất khả xâm phạm.',
      priority: 'INFO',
      audience: 'Tất cả người dùng',
      status: 'Đã kết thúc',
      date: '10/10/2026 09:00',
      views: 2450,
    },
  ]);

  // Hộp thư Cảnh báo Hệ thống dành cho Super Admin
  const [systemAlerts, setSystemAlerts] = useState([
    {
      id: 'ALT-101',
      title: 'Tổ chức mới đăng ký tài khoản cần phê duyệt hạn mức',
      source: 'FinFlow Pay Platform',
      time: '10 phút trước',
      type: 'ORG',
      unread: true,
    },
    {
      id: 'ALT-102',
      title: 'Mô hình Pod Failure Predictor đạt ngưỡng an toàn drift score 5.2%',
      source: 'AI Governance Engine',
      time: '1 giờ trước',
      type: 'AI',
      unread: true,
    },
    {
      id: 'ALT-103',
      title: 'Phát hiện 5 lần đăng nhập thất bại liên tiếp từ IP lạ (Đã tự động khóa tạm thời)',
      source: 'Security Firewall',
      time: '3 giờ trước',
      type: 'SECURITY',
      unread: false,
    },
  ]);

  const [feedbackMessage, setFeedbackMessage] = useState('');

  const handleSendBroadcast = (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const newBroadcast = {
      id: `BC-2026-${String(broadcasts.length + 10).padStart(2, '0')}`,
      title: title.trim(),
      content: content.trim(),
      priority,
      audience: audience === 'ALL' ? 'Tất cả người dùng' : (audience === 'OWNERS' ? 'Chủ Doanh nghiệp' : 'Kỹ sư DevOps'),
      status: 'Đang hiển thị',
      date: 'Vừa xong',
      views: 1,
    };

    setBroadcasts([newBroadcast, ...broadcasts]);
    setTitle('');
    setContent('');
    setFeedbackMessage('Đã phát sóng thông báo toàn mạng thành công!');
    setTimeout(() => setFeedbackMessage(''), 4000);
  };

  const handleDeleteBroadcast = (id) => {
    setBroadcasts(broadcasts.filter((b) => b.id !== id));
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
      {/* 1. Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--dash-text-primary)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Trung Tâm Phát Thông Báo Toàn Mạng (System Broadcast)
            </h1>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                color: '#059669',
                fontSize: '0.6875rem',
                fontWeight: 700,
                border: '1px solid rgba(5, 150, 105, 0.25)',
              }}
            >
              SUPER ADMIN
            </span>
          </div>
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--dash-text-secondary)',
              marginTop: '4px',
              margin: '4px 0 0 0',
            }}
          >
            Soạn và ghim thông báo bảo trì, tin tức nâng cấp AI hoặc cảnh báo an ninh cho toàn thể người dùng nền tảng.
          </p>
        </div>
      </div>

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

      {/* 2. Main Grid: Form on Left + System Alerts on Right */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '24px',
        }}
      >
        {/* Compose Form Card */}
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
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Tiêu đề thông báo *
              </label>
              <input
                type="text"
                required
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
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--dash-text-primary)', marginBottom: '6px' }}>
                Nội dung chi tiết *
              </label>
              <textarea
                required
                rows={4}
                placeholder="Nhập nội dung thông báo gửi tới các khách hàng và người dùng..."
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
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-muted)', marginBottom: '4px' }}>
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
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--dash-text-muted)', marginBottom: '4px' }}>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <input
                type="checkbox"
                id="stickyBannerCheck"
                checked={showStickyBanner}
                onChange={(e) => setShowStickyBanner(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="stickyBannerCheck" style={{ fontSize: '0.8125rem', color: 'var(--dash-text-secondary)', cursor: 'pointer' }}>
                Ghim thanh thông báo nổi (Banner) trên đầu màn hình của người dùng
              </label>
            </div>

            <button
              type="submit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '11px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#059669',
                color: '#FFFFFF',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: 'pointer',
                marginTop: '6px',
              }}
            >
              <Send size={15} />
              <span>Phát Thông Báo Toàn Mạng Ngay</span>
            </button>
          </form>
        </div>

        {/* System Alerts Inbox for Super Admin */}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '0.6875rem', color: 'var(--dash-text-muted)' }}>
                    <span>Nguồn: <strong>{alert.source}</strong></span>
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

          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed var(--dash-border)', textAlign: 'center' }}>
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

      {/* 3. Broadcasts History Table */}
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
            Quản lý và gỡ bỏ các thông báo đã gửi cho toàn thể hệ thống
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--dash-bg-canvas)', borderBottom: '1px solid var(--dash-border)', color: 'var(--dash-text-muted)' }}>
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
              {broadcasts.map((b) => (
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
                    <div style={{ fontWeight: 700, color: 'var(--dash-text-primary)' }}>{b.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)', marginTop: '2px' }}>
                      {b.content.slice(0, 80)}...
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
                  <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
                    {b.date}
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--dash-text-primary)' }}>
                    {b.views} views
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
                      title="Gỡ bỏ thông báo này"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminBroadcastPage;
