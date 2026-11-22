-- Phase 2 CP-9B: Ensure approval metadata columns exist without modifying existing data
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS approval_token TEXT;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS approval_channel VARCHAR(50);
