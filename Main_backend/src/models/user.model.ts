export interface IUser {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  avatar_url?: string;
  status: string;
  last_login_at?: Date;
  created_at: Date;
  update_at?: Date;
}

export interface IEmailVerificationToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  verified_at?: Date;
  created_at: Date;
}
