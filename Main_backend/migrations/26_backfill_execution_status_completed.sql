-- SB-01.1: Safely backfill any historical 'SUCCEEDED' execution_status rows to canonical 'COMPLETED'.
-- Uses ::text comparison so it never fails on databases where 'SUCCEEDED' is absent from the enum.
-- Reversible note: Legacy 'SUCCEEDED' rows cannot be distinguished from 'COMPLETED' after normalization
-- without pre-migration snapshot; take pg_dump backup before running on legacy databases.
UPDATE healing_actions
SET execution_status = 'COMPLETED'::execution_status
WHERE execution_status::text = 'SUCCEEDED';

UPDATE execution_attempts
SET status = 'COMPLETED'::execution_status
WHERE status::text = 'SUCCEEDED';
