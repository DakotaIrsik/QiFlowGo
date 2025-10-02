export type HostStatus = 'online' | 'offline' | 'error';
export type OSType = 'linux' | 'windows';

export interface Host {
  host_id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  os_type: OSType;
  status: HostStatus;
  last_seen: Date | null;
  ssh_key_path: string | null;
  capacity_max_swarms: number;
  current_swarms: number;
  metadata: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateHostParams {
  host_id: string;
  name: string;
  hostname: string;
  port?: number;
  username: string;
  os_type: OSType;
  ssh_key_path?: string;
  capacity_max_swarms?: number;
  metadata?: Record<string, any>;
}

export interface UpdateHostParams {
  host_id: string;
  name?: string;
  hostname?: string;
  port?: number;
  username?: string;
  os_type?: OSType;
  status?: HostStatus;
  ssh_key_path?: string;
  capacity_max_swarms?: number;
  current_swarms?: number;
  metadata?: Record<string, any>;
}

export interface CommandAuditLog {
  id: number;
  host_id: string;
  command: string;
  executed_by: string | null;
  executed_at: Date;
  exit_code: number | null;
  output: string | null;
  error: string | null;
  duration_ms: number | null;
  success: boolean | null;
  metadata: Record<string, any> | null;
}

export interface CreateAuditLogParams {
  host_id: string;
  command: string;
  executed_by?: string;
  exit_code?: number;
  output?: string;
  error?: string;
  duration_ms?: number;
  success?: boolean;
  metadata?: Record<string, any>;
}

export interface RemoteCommandResult {
  success: boolean;
  exit_code: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
}

export interface SSHConnection {
  host_id: string;
  connected: boolean;
  last_used: Date;
}
