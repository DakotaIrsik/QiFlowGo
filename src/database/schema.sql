-- QiFlow Control Center Database Schema
-- Human Intervention Flagging System

-- Intervention Flags Table
CREATE TABLE IF NOT EXISTS intervention_flags (
  id SERIAL PRIMARY KEY,
  swarm_id VARCHAR(255) NOT NULL,
  issue_number INT NOT NULL,
  github_url TEXT,
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('critical', 'review')),
  reason VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN (
    'blocked_duration',
    'agent_failure',
    'security_vulnerability',
    'test_failure',
    'merge_conflict',
    'manual'
  )),
  agent_message TEXT,
  blocked_duration_hours INT,
  failure_count INT,
  flagged_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),
  resolution_note TEXT,
  metadata JSONB,
  UNIQUE(swarm_id, issue_number, trigger_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_flags_swarm ON intervention_flags(swarm_id);
CREATE INDEX IF NOT EXISTS idx_flags_unresolved ON intervention_flags(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_flags_priority ON intervention_flags(priority);
CREATE INDEX IF NOT EXISTS idx_flags_trigger_type ON intervention_flags(trigger_type);

-- Agent Failure Tracking Table
CREATE TABLE IF NOT EXISTS agent_failures (
  id SERIAL PRIMARY KEY,
  swarm_id VARCHAR(255) NOT NULL,
  issue_number INT NOT NULL,
  agent_name VARCHAR(255),
  error_message TEXT,
  failed_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB,
  UNIQUE(swarm_id, issue_number, failed_at)
);

CREATE INDEX IF NOT EXISTS idx_agent_failures_issue ON agent_failures(swarm_id, issue_number);

-- Issue Status Tracking Table
CREATE TABLE IF NOT EXISTS issue_status_history (
  id SERIAL PRIMARY KEY,
  swarm_id VARCHAR(255) NOT NULL,
  issue_number INT NOT NULL,
  status VARCHAR(50) NOT NULL,
  changed_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_issue_status_history ON issue_status_history(swarm_id, issue_number, changed_at DESC);
