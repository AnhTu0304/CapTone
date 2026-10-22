import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import multiTabSync, { SYNC_EVENTS, broadcastSyncEvent, subscribeSyncEvent } from '../../../services/multiTabSync';
import { usePermissions, PERMISSIONS } from '../../../hooks/usePermissions';
import { PermissionGate } from '../../../components/common/PermissionGate';
import { environmentService } from '../../../services/environmentService';
import apiClient from '../../../services/apiClient';

// Mock contexts
jest.mock('../../Dashboard/context/DashboardContext', () => ({
  useDashboard: () => ({
    currentOrg: { id: 'org-test-1', name: 'Test Org 1', role_in_org: 'DEVOPS' },
    currentUserRole: 'DEVOPS',
    orgList: [{ id: 'org-test-1', name: 'Test Org 1' }, { id: 'org-test-2', name: 'Test Org 2' }],
    triggerRefresh: jest.fn(),
  }),
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-1', email: 'devops@test.com' },
    isSuperAdmin: () => false,
    isAdmin: () => false,
    isDevOps: () => true,
    isViewer: () => false,
  }),
}));

describe('TASK [S2][PB07] 3.2 — Multi-Tab Sync & Permission-Based UI Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  describe('1. Multi-Tab Authentication & State Synchronization (Phase 3 & 4)', () => {
    test('1.1. BroadcastChannel or StorageEvent fires and dispatches message to subscribers', () => {
      const mockHandler = jest.fn();
      const unsub = subscribeSyncEvent(SYNC_EVENTS.AUTH_LOGOUT, mockHandler);

      // Simulate receiving an event from another tab
      const otherTabMessage = {
        type: SYNC_EVENTS.AUTH_LOGOUT,
        payload: { reason: 'user_action' },
        senderId: 'other_tab_999',
        timestamp: Date.now(),
      };

      // Kích hoạt storage event mô phỏng nhận thông điệp từ tab khác
      const storageEvent = new StorageEvent('storage', {
        key: 'selfheal_tab_sync_ping',
        newValue: JSON.stringify(otherTabMessage),
      });
      window.dispatchEvent(storageEvent);

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith({ reason: 'user_action' }, expect.any(Object));

      unsub();
    });

    test('1.2. Ignores broadcast messages sent from the current tab to prevent event loops', () => {
      const mockHandler = jest.fn();
      const unsub = subscribeSyncEvent(SYNC_EVENTS.AUTH_LOGOUT, mockHandler);

      const selfMessage = {
        type: SYNC_EVENTS.AUTH_LOGOUT,
        payload: {},
        senderId: multiTabSync.getTabId(), // same tab id
        timestamp: Date.now(),
      };

      const storageEvent = new StorageEvent('storage', {
        key: 'selfheal_tab_sync_ping',
        newValue: JSON.stringify(selfMessage),
      });
      window.dispatchEvent(storageEvent);

      expect(mockHandler).not.toHaveBeenCalled();
      unsub();
    });

    test('1.3. ORG_SWITCHED event broadcasts payload with non-sensitive identifiers only', () => {
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
      broadcastSyncEvent(SYNC_EVENTS.ORG_SWITCHED, {
        orgId: 'org-abc-123',
        orgName: 'Alpha Corp',
        orgRole: 'SME_OWNER',
      });

      expect(setItemSpy).toHaveBeenCalledWith(
        'selfheal_tab_sync_ping',
        expect.stringContaining('org-abc-123')
      );
      // Ensures no secrets are transmitted
      expect(setItemSpy).not.toHaveBeenCalledWith(
        'selfheal_tab_sync_ping',
        expect.stringContaining('password')
      );
      setItemSpy.mockRestore();
    });
  });

  describe('2. Permission Hook & RBAC Gate (Phase 5)', () => {
    const TestPermissionConsumer = () => {
      const { can, canManageOrg, canApproveHitl, canManageEnv, role } = usePermissions();
      return (
        <div>
          <div data-testid="user-role">{role}</div>
          <div data-testid="can-manage-org">{String(canManageOrg)}</div>
          <div data-testid="can-approve-hitl">{String(canApproveHitl)}</div>
          <div data-testid="can-manage-env">{String(canManageEnv)}</div>
          <div data-testid="can-view-metrics">{String(can(PERMISSIONS.METRICS_VIEW))}</div>
        </div>
      );
    };

    test('2.1. usePermissions evaluates permissions based on tenant role (DEVOPS)', () => {
      render(<TestPermissionConsumer />);

      expect(screen.getByTestId('user-role')).toHaveTextContent('DEVOPS');
      expect(screen.getByTestId('can-manage-org')).toHaveTextContent('false');
      expect(screen.getByTestId('can-approve-hitl')).toHaveTextContent('false');
      expect(screen.getByTestId('can-manage-env')).toHaveTextContent('true');
      expect(screen.getByTestId('can-view-metrics')).toHaveTextContent('true');
    });

    test('2.2. PermissionGate renders disabled button with tooltip when role lacks permission', () => {
      const onAction = jest.fn();

      render(
        <PermissionGate
          permission={PERMISSIONS.HITL_APPROVE}
          renderDisabled={true}
          disabledTooltip="Chỉ Owner mới có quyền duyệt"
        >
          <button type="button" onClick={onAction}>
            Phê Duyệt HITL
          </button>
        </PermissionGate>
      );

      const btn = screen.getByRole('button', { name: /Phê Duyệt HITL/i });
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute('title', 'Chỉ Owner mới có quyền duyệt');

      fireEvent.click(btn);
      expect(onAction).not.toHaveBeenCalled();
    });

    test('2.3. PermissionGate renders fallback when permission is missing', () => {
      render(
        <PermissionGate
          permission={PERMISSIONS.ORG_MANAGE}
          fallback={<div data-testid="denied-box">Không đủ quyền quản trị</div>}
        >
          <button type="button">Xóa tổ chức</button>
        </PermissionGate>
      );

      expect(screen.queryByRole('button', { name: /Xóa tổ chức/i })).not.toBeInTheDocument();
      expect(screen.getByTestId('denied-box')).toHaveTextContent('Không đủ quyền quản trị');
    });

    test('2.4. PermissionGate renders children when permission is granted (ENV_MANAGE)', () => {
      render(
        <PermissionGate permission={PERMISSIONS.ENV_MANAGE}>
          <button type="button">Tạo Môi Trường</button>
        </PermissionGate>
      );

      expect(screen.getByRole('button', { name: /Tạo Môi Trường/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Tạo Môi Trường/i })).not.toBeDisabled();
    });
  });

  describe('3. Resource APIs Service (Phase 2)', () => {
    test('3.1. environmentService calls API with orgId in endpoint', async () => {
      const mockRequest = jest.spyOn(apiClient, 'request').mockResolvedValueOnce({
        data: { items: [{ id: 'env-1', name: 'dev-cluster' }], total: 1 },
      });

      const res = await environmentService.getEnvironments('org-uuid-123', { page: 1, limit: 10 });
      expect(mockRequest).toHaveBeenCalledWith(
        expect.stringContaining('/organizations/org-uuid-123/environments?page=1&limit=10')
      );
      expect(res.items).toHaveLength(1);
      mockRequest.mockRestore();
    });

    test('3.2. environmentService createEnvironment sends POST with body', async () => {
      const mockRequest = jest.spyOn(apiClient, 'request').mockResolvedValueOnce({
        data: { id: 'env-new', name: 'staging-k8s' },
      });

      const payload = { name: 'staging-k8s', type: 'STAGING' };
      const res = await environmentService.createEnvironment('org-uuid-123', payload);

      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-uuid-123/environments',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      );
      expect(res.name).toBe('staging-k8s');
      mockRequest.mockRestore();
    });
  });
});
