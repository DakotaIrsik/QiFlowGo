export interface Host {
  host_id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  status: 'online' | 'offline' | 'unknown';
  capacity: {
    max_swarms: number;
    active_swarms: number;
  };
  created_at: Date;
  updated_at: Date;
}

export interface DeploymentStep1Data {
  host_id: string;
}

export interface DeploymentStep2Data {
  github_repo: string;
  github_owner: string;
  github_token?: string;
}

export interface DeploymentStep3Data {
  schedule_preset?: 'continuous' | 'business_hours' | 'nightly' | 'custom';
  cron_expression?: string;
}

export interface DeploymentStep4Data {
  agents: Array<{
    role: string;
    responsibilities: string[];
  }>;
}

export interface DeploymentStep5Data {
  customer_id?: string;
  customer_name: string;
  project_name: string;
  billing_rate?: number;
}

export interface DeploymentConfig {
  deployment_id: string;
  step1: DeploymentStep1Data;
  step2: DeploymentStep2Data;
  step3: DeploymentStep3Data;
  step4: DeploymentStep4Data;
  step5: DeploymentStep5Data;
  status: 'draft' | 'deploying' | 'deployed' | 'failed';
  created_at: Date;
  updated_at: Date;
}

export interface DeploymentProgress {
  deployment_id: string;
  status: 'deploying' | 'deployed' | 'failed';
  current_step: string;
  progress_percent: number;
  logs: string[];
  error?: string;
}

export interface SchedulePreset {
  name: string;
  description: string;
  cron_expression: string;
}

export const SCHEDULE_PRESETS: Record<string, SchedulePreset> = {
  continuous: {
    name: 'Continuous',
    description: 'Run swarm continuously, 24/7',
    cron_expression: '* * * * *',
  },
  business_hours: {
    name: 'Business Hours',
    description: 'Run during business hours (9 AM - 6 PM, Mon-Fri)',
    cron_expression: '0 9-18 * * 1-5',
  },
  nightly: {
    name: 'Nightly',
    description: 'Run overnight (10 PM - 6 AM)',
    cron_expression: '0 22-6 * * *',
  },
};
