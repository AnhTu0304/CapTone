export type AuditStatus = 'SUCCESS' | 'FAILURE' | 'DENIED' | 'WARN' | 'ERROR';

export type AuditActorType = 'USER' | 'SYSTEM' | 'AGENT';

export type AuditAction =
  // Authentication
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILURE'
  | 'AUTH_LOGOUT'
  | 'AUTH_SESSION_REVOKED'
  | 'AUTH_PASSWORD_CHANGED'
  // Authorization & Access Controls
  | 'ACCESS_DENIED_ROLE'
  | 'ACCESS_DENIED_TENANT'
  | 'ACCESS_DENIED_AUTH'
  // System Role & User Management
  | 'SYSTEM_ROLE_ASSIGNED'
  | 'USER_STATUS_UPDATED'
  // Organization & Membership
  | 'ORG_CREATED'
  | 'ORG_UPDATED'
  | 'ORG_DELETED'
  | 'ORG_STATUS_CHANGED'
  | 'MEMBER_INVITED'
  | 'MEMBER_JOINED'
  | 'MEMBER_ROLE_CHANGED'
  | 'MEMBER_REMOVED'
  | 'INVITATION_REVOKED'
  // Cluster & Agent Governance
  | 'CLUSTER_CREATED'
  | 'CLUSTER_DELETED'
  | 'CLUSTER_TOKEN_ROTATED'
  | 'CLUSTER_CONFIG_UPDATED'
  | 'AGENT_CONNECTED'
  | 'AGENT_DISCONNECTED'
  // Dangerous / Sensitive Remediation
  | 'REMEDIATION_NODE_DRAINED'
  | 'REMEDIATION_POD_RESTARTED';

export type AuditReasonCode =
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_REVOKED'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_INACTIVE'
  | 'ROLE_REQUIRED'
  | 'ORG_MEMBERSHIP_REQUIRED'
  | 'ORG_ROLE_REQUIRED'
  | 'TENANT_SCOPE_VIOLATION'
  | 'ORG_SUSPENDED'
  | 'RESOURCE_NOT_FOUND'
  | 'SELF_ACTION_PROHIBITED'
  | 'INTERNAL_ERROR';

export interface IAuditLog {
  id: string;
  organization_id?: string | null;
  user_id?: string | null;
  actor_type: AuditActorType;
  action: AuditAction | string;
  resource_type?: string | null;
  resource_id?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  description?: string | null;
  status: AuditStatus | string;
  reason_code?: AuditReasonCode | string | null;
  request_id?: string | null;
  user_agent?: string | null;
  ip_address?: string | null;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  created_at: Date;
}

export interface ICreateAuditLogInput {
  organization_id?: string | null;
  user_id?: string | null;
  actor_type?: AuditActorType;
  action: AuditAction | string;
  resource_type?: string | null;
  resource_id?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  description?: string | null;
  status: AuditStatus | string;
  reason_code?: AuditReasonCode | string | null;
  request_id?: string | null;
  user_agent?: string | null;
  ip_address?: string | null;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface IAuditLogFilter {
  organization_id?: string;
  user_id?: string;
  action?: string;
  status?: string;
  resource_type?: string;
  resource_id?: string;
  request_id?: string;
  reason_code?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}
