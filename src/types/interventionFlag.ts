// Type definitions for Human Intervention Flagging System

export type FlagPriority = 'critical' | 'review';

export type TriggerType =
  | 'blocked_duration'
  | 'agent_failure'
  | 'security_vulnerability'
  | 'test_failure'
  | 'merge_conflict'
  | 'manual';

export interface InterventionFlag {
  id: number;
  swarm_id: string;
  issue_number: number;
  github_url?: string;
  priority: FlagPriority;
  reason: string;
  trigger_type: TriggerType;
  agent_message?: string;
  blocked_duration_hours?: number;
  failure_count?: number;
  flagged_at: Date;
  resolved_at?: Date;
  resolved_by?: string;
  resolution_note?: string;
  metadata?: Record<string, any>;
}

export interface CreateInterventionFlagParams {
  swarm_id: string;
  issue_number: number;
  github_url?: string;
  priority: FlagPriority;
  reason: string;
  trigger_type: TriggerType;
  agent_message?: string;
  blocked_duration_hours?: number;
  failure_count?: number;
  metadata?: Record<string, any>;
}

export interface ResolveInterventionFlagParams {
  flag_id: number;
  resolved_by: string;
  resolution_note?: string;
}

export interface InterventionFlagQuery {
  swarm_id: string;
  priority?: FlagPriority;
  resolved?: boolean;
  limit?: number;
  offset?: number;
}

export interface InterventionFlagCount {
  critical: number;
  review: number;
  total: number;
}

export interface AgentFailure {
  id: number;
  swarm_id: string;
  issue_number: number;
  agent_name?: string;
  error_message?: string;
  failed_at: Date;
  metadata?: Record<string, any>;
}

export interface IssueStatusHistory {
  id: number;
  swarm_id: string;
  issue_number: number;
  status: string;
  changed_at: Date;
  metadata?: Record<string, any>;
}
