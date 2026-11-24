-- SB-01.1: Ensure canonical 'COMPLETED' value exists on PostgreSQL execution_status enum.
-- Safe and idempotent across both fresh (00_init_full_database.sql) and legacy schemas.
ALTER TYPE execution_status ADD VALUE IF NOT EXISTS 'COMPLETED';
