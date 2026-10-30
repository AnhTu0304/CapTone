import { personalPortalService, INITIAL_COMPANIES, INITIAL_INVITATIONS, INITIAL_PERSONAL_NOTIFS } from './personalPortalService';
import * as apiClient from './apiClient';

jest.mock('./apiClient', () => ({
  request: jest.fn(),
  getAuthToken: jest.fn(),
}));

describe('personalPortalService Data Synchronization Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('TC01 & TC02: Initial constants are empty arrays (no hardcoded Acme/VNG)', () => {
    expect(INITIAL_COMPANIES).toEqual([]);
    expect(INITIAL_INVITATIONS).toEqual([]);
    expect(INITIAL_PERSONAL_NOTIFS).toEqual([]);

    // getMyCompanies returns empty array when storage is empty
    expect(personalPortalService.getMyCompanies()).toEqual([]);
  });

  test('TC01: Khi API trả về mảng rỗng (User chưa có Organization) -> fetchMyCompanies lưu và trả về mảng rỗng', async () => {
    apiClient.getAuthToken.mockReturnValue('valid_user_jwt_token');
    apiClient.request.mockResolvedValue({
      success: true,
      data: [],
    });

    const result = await personalPortalService.fetchMyCompanies();
    expect(result).toEqual([]);
    expect(personalPortalService.getMyCompanies()).toEqual([]);
  });

  test('TC02 & TC06: Khi User không có quyền hoặc chưa đăng nhập -> không trả về dữ liệu mẫu hay leak thông tin', async () => {
    apiClient.getAuthToken.mockReturnValue(null);

    const result = await personalPortalService.fetchMyCompanies();
    expect(result).toEqual([]);
    expect(apiClient.request).not.toHaveBeenCalled();
  });

  test('TC03: Khi API trả về danh sách Organization thực tế -> Chuyển đổi đúng cấu trúc và lưu cache', async () => {
    apiClient.getAuthToken.mockReturnValue('valid_user_jwt_token');
    apiClient.request.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'org-test-123',
          name: 'Vietnam K8s Solutions',
          slug: 'vn-k8s',
          status: 'ACTIVE',
          role_in_org: 'DEVOPS',
          created_at: '2026-10-28T08:00:00Z',
          clusters_count: 3,
          members_count: 6,
        },
      ],
    });

    const result = await personalPortalService.fetchMyCompanies();
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Vietnam K8s Solutions');
    expect(result[0].role).toBe('DEVOPS');
    expect(result[0].roleTitle).toBe('Kỹ Sư Vận Hành Hạ Tầng (DevOps)');
    expect(result[0].clustersCount).toBe(3);
    expect(result[0].membersCount).toBe(6);
  });

  test('TC04: Khi API ném lỗi (500 hoặc mất kết nối DB) -> Ném lỗi ra ngoài, không âm thầm fallback sang mock data', async () => {
    apiClient.getAuthToken.mockReturnValue('valid_user_jwt_token');
    apiClient.request.mockRejectedValue(new Error('Internal Server Error 500'));

    await expect(personalPortalService.fetchMyCompanies()).rejects.toThrow(
      'Internal Server Error 500'
    );
  });

  test('TC05: fetchDashboardSummary tính đúng KPI từ kết quả thực tế', async () => {
    apiClient.getAuthToken.mockReturnValue('valid_user_jwt_token');
    apiClient.request
      .mockResolvedValueOnce({
        success: true,
        data: [
          { id: '1', name: 'Org 1', status: 'ACTIVE' },
          { id: '2', name: 'Org 2', status: 'INACTIVE' },
        ],
      })
      .mockResolvedValueOnce({
        success: true,
        data: [],
      });

    const data = await personalPortalService.fetchDashboardSummary();
    expect(data.summary.totalCompanies).toBe(2);
    expect(data.summary.activeCompanies).toBe(1);
    expect(data.summary.pendingInvitations).toBe(0);
    expect(data.summary.unreadNotifs).toBe(0);
  });
});
