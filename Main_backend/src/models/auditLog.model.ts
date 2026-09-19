export interface IAuditLog {
  id: string;
  user_id?: string;
  company_id?: string;
  cluster_id?: string;
  agent_id?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  description?: string;
  status: string;
  metadata?: Record<string, unknown>;
  created_at: Date;
}
