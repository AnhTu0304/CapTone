-- Migration 06: Bảng `organization_invitations` quản lý vòng đời lời mời tham gia tổ chức
CREATE TABLE IF NOT EXISTS organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    token_hash TEXT NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- PENDING, ACCEPTED, REVOKED, EXPIRED
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_org ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_org_invitations_token_hash ON organization_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_org_invitations_status ON organization_invitations(status);
