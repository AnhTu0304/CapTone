-- Rollback Migration 29 (Destructive only if tables were empty; take backup before running)
DROP TABLE IF EXISTS public.alert_event_history;
DROP TABLE IF EXISTS public.alert_events;
DROP TABLE IF EXISTS public.alert_rules;
