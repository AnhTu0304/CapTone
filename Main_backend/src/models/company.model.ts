export interface ICompany {
  id: string;
  name: string;
  code: string;
  type?: string;
  description?: string;
  status: string;
  created_by: string;
  created_at: Date;
  updated_at?: Date;
  deleted_at?: Date;
}

export interface ICompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: string;
  status: string;
  invited_by?: string;
  joined_at?: Date;
  created_at: Date;
  update_at?: Date;
}
