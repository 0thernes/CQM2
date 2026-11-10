-- CQM2 v2.1.0 Forward Migration 002: Immutable Append-Only Audit Events Ledger (I-133, T-087, T-088, T-120)
CREATE TABLE IF NOT EXISTS audit_events (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_uid TEXT NOT NULL UNIQUE DEFAULT ('aud_' || lower(hex(randomblob(12)))),
  actor_id TEXT NOT NULL CHECK (length(trim(actor_id)) > 0),
  action_name TEXT NOT NULL CHECK (length(trim(action_name)) > 0),
  target_resource TEXT NOT NULL CHECK (length(trim(target_resource)) > 0),
  before_json TEXT NOT NULL DEFAULT '{}',
  after_json TEXT NOT NULL DEFAULT '{}',
  request_id TEXT NOT NULL DEFAULT 'local',
  created_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at_iso DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_request ON audit_events(request_id);

CREATE TRIGGER IF NOT EXISTS trg_audit_events_no_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is immutable and append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_events_no_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is immutable and append-only');
END;
