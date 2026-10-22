import React, { useState } from 'react';
import {
  History,
  Search,
  Activity,
  UserCheck,
  ShieldCheck,
  Building2,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { personalPortalService } from '../../services/personalPortalService';

export const PersonalActivityPage = () => {
  const [activities] = useState(() => personalPortalService.getActivityHistory());
  const [categoryFilter, setCategoryFilter] = useState('ALL'); // 'ALL' | 'AUTH' | 'PROFILE' | 'COMPANY' | 'SECURITY'
  const [searchTerm, setSearchTerm] = useState('');

  // Filter logic
  const filtered = activities.filter((act) => {
    const matchesCategory = categoryFilter === 'ALL' || act.category === categoryFilter;
    const matchesSearch =
      act.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      act.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      act.ipAddress.includes(searchTerm);
    return matchesCategory && matchesSearch;
  });

  const handleExportCSV = () => {
    const headers = 'ID,Hành động,Mô tả,Thời gian,IP,Danh mục,Trạng thái\n';
    const rows = filtered
      .map(
        (a) =>
          `"${a.id}","${a.title}","${a.description}","${a.timestamp}","${a.ipAddress}","${a.category}","${a.status}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `personal_activity_log_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCategoryBadge = (cat) => {
    switch (cat) {
      case 'AUTH':
        return { label: 'Đăng nhập / Đăng xuất', bg: '#EFF6FF', text: '#2563EB', icon: History };
      case 'PROFILE':
        return { label: 'Cập nhật hồ sơ', bg: '#F5F3FF', text: '#7C3AED', icon: UserCheck };
      case 'COMPANY':
        return { label: 'Tổ chức Company', bg: '#ECFDF5', text: '#059669', icon: Building2 };
      case 'SECURITY':
        return { label: 'Bảo mật & 2FA', bg: '#FEF3C7', text: '#D97706', icon: ShieldCheck };
      default:
        return { label: 'Chung', bg: '#F1F5F9', text: '#475569', icon: Activity };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
            Activity History — Lịch Sử Hoạt Động Cá Nhân
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '3px 0 0 0' }}>
            Nhật ký kiểm toán toàn diện ghi nhận các thao tác đăng nhập, đổi bảo mật và tham gia/rời Company của bạn.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            backgroundColor: '#FFFFFF',
            color: '#334155',
            border: '1px solid #CBD5E1',
            fontSize: '0.78125rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Download size={15} />
          <span>Xuất Báo Cáo CSV</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: '#FFFFFF',
          borderRadius: '10px',
          padding: '12px 16px',
          border: '1px solid #E2E8F0',
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search
            size={16}
            color="#94A3B8"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Tìm theo hành động, IP, chi tiết sự kiện..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              fontSize: '0.8125rem',
              outline: 'none',
            }}
          />
        </div>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #CBD5E1',
            fontSize: '0.8125rem',
            backgroundColor: '#FFFFFF',
            outline: 'none',
          }}
        >
          <option value="ALL">Tất cả hành động</option>
          <option value="AUTH">Đăng nhập / Đăng xuất</option>
          <option value="PROFILE">Cập nhật hồ sơ</option>
          <option value="COMPANY">Tham gia / Rời Company</option>
          <option value="SECURITY">Thay đổi bảo mật (Mật khẩu, 2FA)</option>
        </select>
      </div>

      {/* Activities Timeline Table */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#64748B' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Hành Động & Chi Tiết</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Phân Loại</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Địa Chỉ IP</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Thời Gian Thực Thi</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Trạng Thái</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((act) => {
                const badge = getCategoryBadge(act.category);
                const BadgeIcon = badge.icon;

                return (
                  <tr key={act.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{act.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                        {act.description}
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: badge.bg,
                          color: badge.text,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        <BadgeIcon size={13} />
                        <span>{badge.label}</span>
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono, monospace)', color: '#334155' }}>
                      {act.ipAddress}
                    </td>

                    <td style={{ padding: '14px 16px', color: '#64748B' }}>{act.timestamp}</td>

                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          backgroundColor: '#ECFDF5',
                          color: '#059669',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <CheckCircle2 size={12} />
                        <span>Hoàn thành</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              color: '#64748B',
            }}
          >
            <History size={36} color="#94A3B8" style={{ margin: '0 auto 12px auto' }} />
            <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1E293B' }}>Không có hoạt động nào</div>
            <p style={{ fontSize: '0.8125rem', margin: '4px 0 0 0' }}>
              Không có sự kiện phù hợp với từ khóa hoặc bộ lọc đã chọn.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalActivityPage;
