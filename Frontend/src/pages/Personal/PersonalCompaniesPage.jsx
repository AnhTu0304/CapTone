import React, { useState } from 'react';
import {
  Building2,
  Search,
  Plus,
  AlertTriangle,
  ArrowRight,
  LogOut,
  Mail,
  X,
  Check,
} from 'lucide-react';
import { personalPortalService } from '../../services/personalPortalService';

export const PersonalCompaniesPage = ({ onNavigate }) => {
  const [companies, setCompanies] = useState(() => personalPortalService.getMyCompanies());
  const [invitations, setInvitations] = useState(() => personalPortalService.getInvitations());
  const [activeTab, setActiveTab] = useState('joined'); // 'joined' | 'invitations'

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [leaveModalOrg, setLeaveModalOrg] = useState(null);

  // Form tạo công ty mới
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [newOrgDomain, setNewOrgDomain] = useState('');
  const [newOrgPlan, setNewOrgPlan] = useState('SME Starter');
  const [newOrgDesc, setNewOrgDesc] = useState('');
  const [createError, setCreateError] = useState('');

  const handleNameChange = (val) => {
    setNewOrgName(val);
    const autoSlug = val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    setNewOrgSlug(autoSlug);
  };

  const handleCreateCompany = (e) => {
    e.preventDefault();
    if (!newOrgName.trim()) {
      setCreateError('Vui lòng nhập tên công ty');
      return;
    }
    try {
      personalPortalService.createCompany({
        name: newOrgName,
        slug: newOrgSlug || 'new-company',
        domain: newOrgDomain,
        plan: newOrgPlan,
        description: newOrgDesc,
      });
      setCompanies(personalPortalService.getMyCompanies());
      setIsCreateModalOpen(false);
      setNewOrgName('');
      setNewOrgSlug('');
      setNewOrgDomain('');
      setNewOrgDesc('');
      setCreateError('');
    } catch (err) {
      setCreateError(err.message || 'Lỗi khi tạo công ty');
    }
  };

  const handleEnterWorkspace = (company) => {
    localStorage.setItem('selfheal_active_org_id', company.id);
    localStorage.setItem('selfheal_active_org_name', company.name);
    if (onNavigate) {
      onNavigate('/dashboard');
    }
  };

  const handleConfirmLeave = () => {
    if (!leaveModalOrg) return;
    try {
      personalPortalService.leaveCompany(leaveModalOrg.id);
      setCompanies(personalPortalService.getMyCompanies());
      setLeaveModalOrg(null);
    } catch (err) {
      alert(err.message || 'Không thể rời công ty');
    }
  };

  const handleAcceptInvite = (invId) => {
    personalPortalService.respondInvitation(invId, true);
    setInvitations(personalPortalService.getInvitations());
    setCompanies(personalPortalService.getMyCompanies());
  };

  const handleRejectInvite = (invId) => {
    personalPortalService.respondInvitation(invId, false);
    setInvitations(personalPortalService.getInvitations());
  };

  // Filtered companies
  const filteredCompanies = companies.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.slug.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || c.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
            My Companies — Công Ty Của Tôi
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '3px 0 0 0' }}>
            Quản trị các tổ chức bạn đang trực thuộc, chuyển đổi không gian làm việc hoặc tạo mới công ty.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          style={{
            padding: '9px 18px',
            borderRadius: '9px',
            backgroundColor: '#059669',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '0.8125rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
          }}
        >
          <Plus size={16} />
          <span>Tạo Company Mới</span>
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #E2E8F0',
          gap: '24px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('joined')}
          style={{
            padding: '10px 4px',
            fontSize: '0.875rem',
            fontWeight: activeTab === 'joined' ? 700 : 500,
            color: activeTab === 'joined' ? '#059669' : '#64748B',
            border: 'none',
            borderBottom: activeTab === 'joined' ? '2px solid #059669' : '2px solid transparent',
            background: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Building2 size={16} />
          <span>Company Đang Tham Gia ({companies.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('invitations')}
          style={{
            padding: '10px 4px',
            fontSize: '0.875rem',
            fontWeight: activeTab === 'invitations' ? 700 : 500,
            color: activeTab === 'invitations' ? '#059669' : '#64748B',
            border: 'none',
            borderBottom: activeTab === 'invitations' ? '2px solid #059669' : '2px solid transparent',
            background: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Mail size={16} />
          <span>Lời Mời Đang Chờ ({invitations.length})</span>
          {invitations.length > 0 && (
            <span
              style={{
                backgroundColor: '#EF4444',
                color: '#FFFFFF',
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '9999px',
              }}
            >
              {invitations.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: JOINED COMPANIES */}
      {activeTab === 'joined' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filter Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div
              style={{
                position: 'relative',
                flex: 1,
                minWidth: '240px',
              }}
            >
              <Search
                size={16}
                color="#94A3B8"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên Company hoặc slug..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  backgroundColor: '#FFFFFF',
                }}
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.8125rem',
                backgroundColor: '#FFFFFF',
                color: '#334155',
                outline: 'none',
                fontWeight: 500,
              }}
            >
              <option value="ALL">Tất cả vai trò</option>
              <option value="SME_OWNER">SME Owner (Chủ sở hữu)</option>
              <option value="DEVOPS">DevOps Lead</option>
              <option value="VIEWER">Viewer (Người xem)</option>
            </select>
          </div>

          {/* Company Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '16px',
            }}
          >
            {filteredCompanies.map((company) => (
              <div
                key={company.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                  transition: 'box-shadow 0.15s ease',
                }}
              >
                <div>
                  {/* Card Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '10px',
                          backgroundColor: '#EFF6FF',
                          color: '#2563EB',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.25rem',
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {company.name.charAt(0)}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                          {company.name}
                        </h4>
                        <span style={{ fontSize: '0.75rem', color: '#64748B', fontFamily: 'var(--font-mono, monospace)' }}>
                          {company.domain || `${company.slug}.com`}
                        </span>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        backgroundColor: '#ECFDF5',
                        color: '#059669',
                      }}
                    >
                      {company.status === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm khóa'}
                    </span>
                  </div>

                  {/* Role & Metadata */}
                  <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78125rem' }}>
                      <span style={{ color: '#64748B' }}>Vai trò của bạn:</span>
                      <strong style={{ color: '#0F172A' }}>{company.roleTitle}</strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78125rem' }}>
                      <span style={{ color: '#64748B' }}>Gói dịch vụ:</span>
                      <span style={{ fontWeight: 600, color: '#4338CA' }}>{company.plan}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78125rem' }}>
                      <span style={{ color: '#64748B' }}>Hạ tầng K8s:</span>
                      <span>{company.clustersCount} Cụm • {company.activeWorkloads} Workloads</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78125rem' }}>
                      <span style={{ color: '#64748B' }}>Thành viên:</span>
                      <span>{company.membersCount} người</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #F1F5F9', paddingTop: '14px' }}>
                  <button
                    type="button"
                    onClick={() => handleEnterWorkspace(company)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#059669',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '0.78125rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>Vào Workspace</span>
                    <ArrowRight size={14} />
                  </button>

                  {/* Leave Company (Allowed if not the only Owner) */}
                  <button
                    type="button"
                    onClick={() => setLeaveModalOrg(company)}
                    title="Rời khỏi Company này"
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: '#F8FAFC',
                      color: '#64748B',
                      border: '1px solid #E2E8F0',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredCompanies.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 24px',
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px dashed #CBD5E1',
                color: '#64748B',
              }}
            >
              <Building2 size={36} color="#94A3B8" style={{ margin: '0 auto 12px auto' }} />
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1E293B' }}>Không tìm thấy Company nào</div>
              <p style={{ fontSize: '0.8125rem', margin: '4px 0 0 0' }}>
                Thử thay đổi từ khóa tìm kiếm hoặc bấm nút "Tạo Company Mới" phía trên.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INVITATIONS */}
      {activeTab === 'invitations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {invitations.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 24px',
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px dashed #CBD5E1',
                color: '#64748B',
              }}
            >
              <Mail size={36} color="#94A3B8" style={{ margin: '0 auto 12px auto' }} />
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1E293B' }}>
                Không có lời mời nào đang chờ
              </div>
              <p style={{ fontSize: '0.8125rem', margin: '4px 0 0 0' }}>
                Khi một doanh nghiệp mời email của bạn tham gia dự án, lời mời sẽ hiển thị tại đây để bạn xác nhận.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #BFDBFE',
                    padding: '20px',
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          backgroundColor: '#EFF6FF',
                          color: '#2563EB',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                        }}
                      >
                        {inv.organizationName.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A' }}>
                          {inv.organizationName}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                          Lời mời từ: <strong>{inv.inviterName}</strong> ({inv.inviterEmail})
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: '14px',
                        backgroundColor: '#F8FAFC',
                        borderRadius: '8px',
                        padding: '12px',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78125rem' }}>
                        <span style={{ color: '#64748B' }}>Vai trò được chỉ định:</span>
                        <strong style={{ color: '#059669' }}>{inv.invitedRoleTitle}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78125rem', marginTop: '6px' }}>
                        <span style={{ color: '#64748B' }}>Hạn chót phản hồi:</span>
                        <span>{inv.expiresAt}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => handleAcceptInvite(inv.id)}
                      style={{
                        flex: 1,
                        padding: '9px',
                        borderRadius: '8px',
                        backgroundColor: '#059669',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <Check size={16} />
                      <span>Chấp Nhận Tham Gia</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRejectInvite(inv.id)}
                      style={{
                        padding: '9px 16px',
                        borderRadius: '8px',
                        backgroundColor: '#F1F5F9',
                        color: '#64748B',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Từ Chối
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE COMPANY MODAL */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={20} color="#059669" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Tạo Mới Doanh Nghiệp (Company)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            {createError && (
              <div
                style={{
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#DC2626',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '0.8125rem',
                  marginBottom: '16px',
                }}
              >
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateCompany} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Tên Doanh Nghiệp / Công Ty *
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: TechHub Vietnam Co., Ltd"
                  value={newOrgName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8125rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Định danh Slug URL (Hệ thống tự sinh) *
                </label>
                <input
                  type="text"
                  value={newOrgSlug}
                  onChange={(e) => setNewOrgSlug(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8125rem',
                    fontFamily: 'var(--font-mono, monospace)',
                    outline: 'none',
                    backgroundColor: '#F8FAFC',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Tên Miền Doanh Nghiệp (Domain)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: techhub.vn"
                  value={newOrgDomain}
                  onChange={(e) => setNewOrgDomain(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8125rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Gói Dịch Vụ
                </label>
                <select
                  value={newOrgPlan}
                  onChange={(e) => setNewOrgPlan(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8125rem',
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <option value="SME Starter">SME Starter (Miễn phí 1 Cluster K8s)</option>
                  <option value="SME Pro">SME Pro (Tối đa 5 Clusters, Giám sát AI)</option>
                  <option value="Enterprise Cloud">Enterprise Cloud (Không giới hạn)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Mô Tả Ngắn
                </label>
                <textarea
                  rows={2}
                  placeholder="Lĩnh vực kinh doanh hoặc mục đích cụm máy chủ..."
                  value={newOrgDesc}
                  onChange={(e) => setNewOrgDesc(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8125rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#F1F5F9',
                    color: '#64748B',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    backgroundColor: '#059669',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Xác Nhận Tạo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM LEAVE MODAL */}
      {leaveModalOrg && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#DC2626', marginBottom: '12px' }}>
              <AlertTriangle size={24} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0 }}>Xác Nhận Rời Company</h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Bạn có chắc chắn muốn rời khỏi tổ chức <strong>{leaveModalOrg.name}</strong>? Bạn sẽ mất toàn bộ quyền truy cập vào các cụm K8s và tài nguyên của công ty này.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setLeaveModalOrg(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#F1F5F9',
                  color: '#64748B',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmLeave}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Xác Nhận Rời
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalCompaniesPage;
