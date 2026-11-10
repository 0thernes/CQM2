-- CQM2 v2.1.0 Rollback Migration 002: Cleanly removes audit_events without altering 001_initial_3nf tables
DROP TRIGGER IF EXISTS trg_audit_events_no_delete;
DROP TRIGGER IF EXISTS trg_audit_events_no_update;
DROP INDEX IF EXISTS idx_audit_events_request;
DROP INDEX IF EXISTS idx_audit_events_created;
DROP TABLE IF EXISTS audit_events;
DELETE FROM schema_migrations WHERE version = '002_audit_events_ledger';
