export interface SwarmStatus {
  swarm_id: string;
  name: string;
  host_url: string;
  status: 'online' | 'offline' | 'degraded';
  last_seen: Date;
  health_status: {
    cpu_percent: number;
    memory_percent: number;
    disk_percent: number;
  };
  active_agents: number;
  project_completion?: number;
  created_at: Date;
  updated_at: Date;
}

export interface SwarmMetrics {
  swarm_id: string;
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  active_agents: number;
  total_agents: number;
  issues_open: number;
  issues_closed: number;
  project_completion_percent: number;
  last_updated: Date;
}

export interface SwarmHostResponse {
  status: string;
  cpu: number;
  memory: number;
  disk: number;
  agents: {
    active: number;
    total: number;
  };
}

export interface SwarmProjectResponse {
  completion: number;
  issues: {
    open: number;
    closed: number;
    total: number;
  };
}

export interface CreateSwarmParams {
  swarm_id: string;
  name: string;
  host_url: string;
}

export interface UpdateSwarmStatusParams {
  swarm_id: string;
  status?: 'online' | 'offline' | 'degraded';
  health_status?: {
    cpu_percent: number;
    memory_percent: number;
    disk_percent: number;
  };
  active_agents?: number;
  project_completion?: number;
}
