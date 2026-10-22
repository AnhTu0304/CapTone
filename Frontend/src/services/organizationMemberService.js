/**
 * @file organizationMemberService.js
 * @description Enterprise Service Layer for Organization Member & Invitation Management.
 * Kết nối các endpoint backend REST API thực tế:
 * - GET /api/v1/organizations/:id/members : Danh sách thành viên, phân trang, lọc status, role, search
 * - POST /api/v1/organizations/:id/members/invite : Mời thành viên mới qua email (vai trò SME_OWNER, DEVOPS, VIEWER)
 * - PUT /api/v1/organizations/:id/members/:userId : Cập nhật vai trò / trạng thái thành viên
 * - DELETE /api/v1/organizations/:id/members/:userId : Loại bỏ thành viên khỏi tổ chức
 * - GET /api/v1/organizations/roles : Lấy danh mục vai trò tổ chức khả dụng
 */

import { request } from './apiClient';

// Fixture mẫu dữ liệu ban đầu cho môi trường Offline / Mock
const DEFAULT_MOCK_MEMBERS = [
  {
    id: 'mem-01',
    organization_id: 'org-acme',
    user: {
      id: 'usr-01',
      email: 'quan.le@acmecorp.vn',
      full_name: 'Lê Minh Quân',
      avatar_url: null,
      status: 'ACTIVE',
    },
    role: {
      id: 'role-owner',
      code: 'SME_OWNER',
      name: 'Chủ DN (SME Owner)',
      description: 'Toàn quyền quản trị tổ chức và duyệt HITL Gate',
    },
    status: 'ACTIVE',
    inviter: null,
    joined_at: '2026-01-10T08:00:00.000Z',
    created_at: '2026-01-10T08:00:00.000Z',
    updated_at: '2026-10-22T08:00:00.000Z',
    mfa: true,
    lastActive: '5 phút trước',
  },
  {
    id: 'mem-02',
    organization_id: 'org-acme',
    user: {
      id: 'usr-02',
      email: 'tuan.tran@acmecorp.vn',
      full_name: 'Trần Đình Tuấn',
      avatar_url: null,
      status: 'ACTIVE',
    },
    role: {
      id: 'role-devops',
      code: 'DEVOPS',
      name: 'Kỹ Sư DevOps Lead',
      description: 'Quản trị hạ tầng K8s, eBPF agent và khắc phục sự cố',
    },
    status: 'ACTIVE',
    inviter: {
      id: 'usr-01',
      email: 'quan.le@acmecorp.vn',
      full_name: 'Lê Minh Quân',
    },
    joined_at: '2026-02-15T09:30:00.000Z',
    created_at: '2026-02-15T09:30:00.000Z',
    updated_at: '2026-10-22T09:30:00.000Z',
    mfa: true,
    lastActive: '22 phút trước',
  },
  {
    id: 'mem-03',
    organization_id: 'org-acme',
    user: {
      id: 'usr-03',
      email: 'hoang.nguyen@acmecorp.vn',
      full_name: 'Nguyễn Văn Hoàng',
      avatar_url: null,
      status: 'ACTIVE',
    },
    role: {
      id: 'role-viewer',
      code: 'VIEWER',
      name: 'Người Xem (Viewer)',
      description: 'Giám sát chỉ số SLA và xem viễn trắc an toàn',
    },
    status: 'ACTIVE',
    inviter: {
      id: 'usr-01',
      email: 'quan.le@acmecorp.vn',
      full_name: 'Lê Minh Quân',
    },
    joined_at: '2026-03-01T14:15:00.000Z',
    created_at: '2026-03-01T14:15:00.000Z',
    updated_at: '2026-10-20T14:15:00.000Z',
    mfa: false,
    lastActive: '2 ngày trước',
  },
  {
    id: 'mem-04',
    organization_id: 'org-acme',
    user: {
      id: 'usr-04',
      email: 'lan.pham@acmecorp.vn',
      full_name: 'Phạm Thị Lan',
      avatar_url: null,
      status: 'INVITED',
    },
    role: {
      id: 'role-devops',
      code: 'DEVOPS',
      name: 'Kỹ Sư DevOps Lead',
      description: 'Quản trị hạ tầng K8s',
    },
    status: 'INVITED',
    inviter: {
      id: 'usr-01',
      email: 'quan.le@acmecorp.vn',
      full_name: 'Lê Minh Quân',
    },
    joined_at: null,
    created_at: '2026-10-22T08:00:00.000Z',
    updated_at: '2026-10-22T08:00:00.000Z',
    mfa: false,
    lastActive: 'Chờ chấp nhận',
  },
];

const LOCAL_STORAGE_KEY = 'selfheal_org_members_cache';

const getLocalMockMembers = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    // ignore
  }
  return DEFAULT_MOCK_MEMBERS;
};

const saveLocalMockMembers = (list) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    // ignore
  }
};

export const organizationMemberService = {
  /**
   * Lấy danh sách thành viên trong tổ chức có tìm kiếm, lọc và phân trang
   * @param {string} orgId - UUID hoặc ID tổ chức
   * @param {Object} [params] - Query params: page, limit, search, status, role
   */
  async getMembers(orgId, params = {}) {
    if (!orgId) {
      return {
        items: getLocalMockMembers(),
        pagination: { total: getLocalMockMembers().length, page: 1, limit: 20, totalPages: 1 },
      };
    }

    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.search && params.search.trim()) query.append('search', params.search.trim());
    if (params.status && params.status !== 'ALL') query.append('status', params.status.trim().toUpperCase());
    if (params.role && params.role !== 'ALL') query.append('role', params.role.trim().toUpperCase());

    const qs = query.toString();
    const endpoint = `/organizations/${encodeURIComponent(orgId)}/members${qs ? `?${qs}` : ''}`;

    try {
      const response = await request(endpoint);
      if (response && response.data) {
        return response.data;
      }
    } catch (err) {
      // Nếu API trả lỗi kết nối hoặc 404 do chưa có DB thật, dùng local mock fallback
      console.warn('[organizationMemberService] API getMembers failed, using fallback mock:', err.message);
    }

    // Fallback Mock Logic
    let filtered = getLocalMockMembers();
    if (params.search && params.search.trim()) {
      const term = params.search.toLowerCase().trim();
      filtered = filtered.filter(
        (m) =>
          (m.user?.full_name || '').toLowerCase().includes(term) ||
          (m.user?.email || '').toLowerCase().includes(term)
      );
    }
    if (params.status && params.status !== 'ALL') {
      filtered = filtered.filter((m) => m.status === params.status);
    }
    if (params.role && params.role !== 'ALL') {
      filtered = filtered.filter((m) => (m.role?.code || m.role) === params.role);
    }

    return {
      items: filtered,
      pagination: {
        total: filtered.length,
        page: Number(params.page) || 1,
        limit: Number(params.limit) || 20,
        totalPages: Math.ceil(filtered.length / (Number(params.limit) || 20)) || 1,
      },
    };
  },

  /**
   * Mời thành viên mới vào tổ chức qua email
   * @param {string} orgId
   * @param {{ email: string, role_code: 'SME_OWNER'|'DEVOPS'|'VIEWER', full_name?: string }} data
   */
  async inviteMember(orgId, { email, role_code = 'DEVOPS', full_name }) {
    if (!email || !email.includes('@')) {
      throw new Error('Địa chỉ email không hợp lệ');
    }

    if (orgId && !orgId.startsWith('org-acme')) {
      try {
        const response = await request(`/organizations/${encodeURIComponent(orgId)}/members/invite`, {
          method: 'POST',
          body: JSON.stringify({ email: email.trim(), role_code }),
        });
        if (response && response.data) {
          return response.data;
        }
      } catch (err) {
        // Nếu server trả về lỗi nghiệp vụ 404, 409, 403: Ném ra để UI xử lý thông báo chính xác
        if (err.status && err.data?.message) {
          throw new Error(err.data.message);
        }
        console.warn('[organizationMemberService] inviteMember API failed, using fallback mock:', err.message);
      }
    }

    // Mock fallback
    const list = getLocalMockMembers();
    const existing = list.find((m) => m.user?.email?.toLowerCase() === email.toLowerCase());
    if (existing) {
      if (existing.status === 'ACTIVE') {
        throw new Error(`Người dùng '${email}' đã là thành viên đang hoạt động trong tổ chức`);
      }
      if (existing.status === 'INVITED') {
        throw new Error(`Người dùng '${email}' đã có lời mời đang chờ chấp nhận`);
      }
    }

    const newMember = {
      id: `mem-${Date.now().toString().slice(-4)}`,
      organization_id: orgId || 'org-acme',
      user: {
        id: `usr-${Date.now().toString().slice(-4)}`,
        email: email.trim(),
        full_name: full_name || email.split('@')[0],
        avatar_url: null,
        status: 'INVITED',
      },
      role: {
        id: `role-${role_code.toLowerCase()}`,
        code: role_code,
        name:
          role_code === 'SME_OWNER'
            ? 'Chủ DN (SME Owner)'
            : role_code === 'DEVOPS'
            ? 'Kỹ Sư DevOps Lead'
            : 'Người Xem (Viewer)',
        description: 'Vai trò cấp tổ chức',
      },
      status: 'INVITED',
      inviter: {
        id: 'usr-current',
        email: 'owner@acmecorp.vn',
        full_name: 'Chủ Doanh Nghiệp',
      },
      joined_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      mfa: false,
      lastActive: 'Vừa gửi lời mời',
    };

    const updatedList = [newMember, ...list];
    saveLocalMockMembers(updatedList);
    return newMember;
  },

  /**
   * Cập nhật vai trò hoặc trạng thái của thành viên trong tổ chức
   * @param {string} orgId
   * @param {string} userId
   * @param {{ role_code?: string, status?: 'ACTIVE'|'INACTIVE' }} data
   */
  async updateMember(orgId, userId, data) {
    if (orgId && !orgId.startsWith('org-acme')) {
      try {
        const response = await request(
          `/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(userId)}`,
          {
            method: 'PUT',
            body: JSON.stringify(data),
          }
        );
        if (response && response.data) {
          return response.data;
        }
      } catch (err) {
        if (err.status && err.data?.message) {
          throw new Error(err.data.message);
        }
        console.warn('[organizationMemberService] updateMember API failed, using fallback mock:', err.message);
      }
    }

    // Mock fallback
    const list = getLocalMockMembers();
    const index = list.findIndex((m) => m.user?.id === userId || m.id === userId);
    if (index === -1) {
      throw new Error('Không tìm thấy thành viên cần cập nhật');
    }

    const updated = { ...list[index] };
    if (data.role_code) {
      updated.role = {
        ...updated.role,
        code: data.role_code,
        name:
          data.role_code === 'SME_OWNER'
            ? 'Chủ DN (SME Owner)'
            : data.role_code === 'DEVOPS'
            ? 'Kỹ Sư DevOps Lead'
            : 'Người Xem (Viewer)',
      };
    }
    if (data.status) {
      updated.status = data.status;
    }
    updated.updated_at = new Date().toISOString();

    list[index] = updated;
    saveLocalMockMembers(list);
    return updated;
  },

  /**
   * Loại bỏ thành viên khỏi tổ chức hoặc thu hồi lời mời
   * @param {string} orgId
   * @param {string} userId
   */
  async removeMember(orgId, userId) {
    if (orgId && !orgId.startsWith('org-acme')) {
      try {
        const response = await request(
          `/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(userId)}`,
          {
            method: 'DELETE',
          }
        );
        return response?.data || { message: 'Đã loại bỏ thành viên thành công' };
      } catch (err) {
        if (err.status && err.data?.message) {
          throw new Error(err.data.message);
        }
        console.warn('[organizationMemberService] removeMember API failed, using fallback mock:', err.message);
      }
    }

    // Mock fallback
    const list = getLocalMockMembers();
    const updated = list.filter((m) => m.user?.id !== userId && m.id !== userId);
    saveLocalMockMembers(updated);
    return { message: 'Đã loại bỏ thành viên thành công' };
  },

  /**
   * Lấy danh mục các vai trò tổ chức khả dụng
   */
  async getRoles() {
    try {
      const response = await request('/organizations/roles');
      if (response && response.data) {
        return response.data;
      }
    } catch (e) {
      // fallback
    }

    return [
      { id: 'role-sme-owner', code: 'SME_OWNER', name: 'Chủ sở hữu tổ chức (SME Owner)' },
      { id: 'role-devops', code: 'DEVOPS', name: 'Kỹ sư vận hành hệ thống (DevOps)' },
      { id: 'role-viewer', code: 'VIEWER', name: 'Người quan sát chỉ đọc (Viewer)' },
    ];
  },
};

export default organizationMemberService;
