import { DeploymentModel } from './DeploymentModel';
import pool from '../database/db';

// Mock the database pool
jest.mock('../database/db', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

describe('DeploymentModel', () => {
  const mockPool = pool as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new deployment with draft status', async () => {
      const mockDeployment = {
        deployment_id: 'deploy_123',
        status: 'draft',
        config: JSON.stringify({}),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockDeployment],
        command: 'INSERT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await DeploymentModel.create();

      expect(result).toMatchObject({
        status: 'draft',
      });
      expect(result.deployment_id).toMatch(/^deploy_/);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it('should generate unique deployment_id', async () => {
      const mockDeployment = {
        deployment_id: expect.stringMatching(/^deploy_/),
        status: 'draft',
        config: JSON.stringify({}),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockDeployment],
        command: 'INSERT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      await DeploymentModel.create();

      const call = mockPool.query.mock.calls[0];
      expect(call[1][0]).toMatch(/^deploy_\d+_[a-z0-9]+$/);
    });
  });

  describe('updateStep', () => {
    it('should update deployment step data', async () => {
      const stepData = { host_id: 'host_123' };
      const mockDeployment = {
        deployment_id: 'deploy_123',
        status: 'draft',
        config: JSON.stringify({ step1: stepData }),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockDeployment],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await DeploymentModel.updateStep('deploy_123', 'step1', stepData);

      expect(result).not.toBeNull();
      expect(result?.step1).toEqual(stepData);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE deployments'),
        [JSON.stringify(stepData), 'deploy_123']
      );
    });

    it('should return null when deployment not found', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        command: 'UPDATE',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      const result = await DeploymentModel.updateStep('nonexistent', 'step1', {});

      expect(result).toBeNull();
    });

    it('should handle complex step data', async () => {
      const complexData = {
        agents: [
          { role: 'developer', responsibilities: ['coding', 'testing'] },
          { role: 'reviewer', responsibilities: ['code review'] },
        ],
      };
      const mockDeployment = {
        deployment_id: 'deploy_123',
        status: 'draft',
        config: JSON.stringify({ step4: complexData }),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockDeployment],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await DeploymentModel.updateStep('deploy_123', 'step4', complexData);

      expect(result?.step4).toEqual(complexData);
    });
  });

  describe('getById', () => {
    it('should return deployment by ID', async () => {
      const mockDeployment = {
        deployment_id: 'deploy_123',
        status: 'draft',
        config: JSON.stringify({
          step1: { host_id: 'host_123' },
          step2: { github_repo: 'test-repo' },
        }),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockDeployment],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await DeploymentModel.getById('deploy_123');

      expect(result).not.toBeNull();
      expect(result?.deployment_id).toBe('deploy_123');
      expect(result?.step1).toEqual({ host_id: 'host_123' });
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM deployments WHERE deployment_id = $1',
        ['deploy_123']
      );
    });

    it('should return null when deployment not found', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      const result = await DeploymentModel.getById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle empty config steps', async () => {
      const mockDeployment = {
        deployment_id: 'deploy_123',
        status: 'draft',
        config: JSON.stringify({}),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockDeployment],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await DeploymentModel.getById('deploy_123');

      expect(result?.step1).toEqual({});
      expect(result?.step2).toEqual({});
      expect(result?.step3).toEqual({});
      expect(result?.step4).toEqual({});
      expect(result?.step5).toEqual({});
    });
  });

  describe('updateStatus', () => {
    it('should update deployment status to deploying', async () => {
      const mockDeployment = {
        deployment_id: 'deploy_123',
        status: 'deploying',
        config: JSON.stringify({}),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockDeployment],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await DeploymentModel.updateStatus('deploy_123', 'deploying');

      expect(result?.status).toBe('deploying');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE deployments'),
        ['deploying', 'deploy_123']
      );
    });

    it('should update deployment status to deployed', async () => {
      const mockDeployment = {
        deployment_id: 'deploy_123',
        status: 'deployed',
        config: JSON.stringify({}),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockDeployment],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await DeploymentModel.updateStatus('deploy_123', 'deployed');

      expect(result?.status).toBe('deployed');
    });

    it('should update deployment status to failed', async () => {
      const mockDeployment = {
        deployment_id: 'deploy_123',
        status: 'failed',
        config: JSON.stringify({}),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockDeployment],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await DeploymentModel.updateStatus('deploy_123', 'failed');

      expect(result?.status).toBe('failed');
    });

    it('should return null when deployment not found', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        command: 'UPDATE',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      const result = await DeploymentModel.updateStatus('nonexistent', 'deployed');

      expect(result).toBeNull();
    });
  });

  describe('createProgress', () => {
    it('should create deployment progress record', async () => {
      const mockProgress = {
        deployment_id: 'deploy_123',
        status: 'deploying',
        current_step: 'initializing',
        progress_percent: 0,
        logs: JSON.stringify([]),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockProgress],
        command: 'INSERT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await DeploymentModel.createProgress('deploy_123');

      expect(result).toMatchObject({
        deployment_id: 'deploy_123',
        status: 'deploying',
        current_step: 'initializing',
        progress_percent: 0,
        logs: [],
      });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO deployment_progress'),
        ['deploy_123', 'deploying', 'initializing', 0, JSON.stringify([])]
      );
    });
  });

  describe('updateProgress', () => {
    it('should update deployment progress status', async () => {
      const mockProgress = {
        deployment_id: 'deploy_123',
        status: 'deployed',
        current_step: 'complete',
        progress_percent: 100,
        logs: JSON.stringify([]),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockProgress],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await DeploymentModel.updateProgress('deploy_123', {
        status: 'deployed',
      });

      expect(result?.status).toBe('deployed');
    });

    it('should update progress percent and step', async () => {
      const mockProgress = {
        deployment_id: 'deploy_123',
        status: 'deploying',
        current_step: 'installing_dependencies',
        progress_percent: 50,
        logs: JSON.stringify([]),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockProgress],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await DeploymentModel.updateProgress('deploy_123', {
        current_step: 'installing_dependencies',
        progress_percent: 50,
      });

      expect(result?.current_step).toBe('installing_dependencies');
      expect(result?.progress_percent).toBe(50);
    });

    it('should append log entries', async () => {
      const mockProgress = {
        deployment_id: 'deploy_123',
        status: 'deploying',
        current_step: 'installing_dependencies',
        progress_percent: 50,
        logs: JSON.stringify(['Installing packages...']),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockProgress],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await DeploymentModel.updateProgress('deploy_123', {
        log: 'Installing packages...',
      });

      expect(result?.logs).toContain('Installing packages...');
    });

    it('should set error message', async () => {
      const mockProgress = {
        deployment_id: 'deploy_123',
        status: 'failed',
        current_step: 'installing_dependencies',
        progress_percent: 50,
        logs: JSON.stringify([]),
        error: 'Connection timeout',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockProgress],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await DeploymentModel.updateProgress('deploy_123', {
        status: 'failed',
        error: 'Connection timeout',
      });

      expect(result?.status).toBe('failed');
      expect(result?.error).toBe('Connection timeout');
    });

    it('should update multiple fields at once', async () => {
      const mockProgress = {
        deployment_id: 'deploy_123',
        status: 'deploying',
        current_step: 'configuring_agents',
        progress_percent: 75,
        logs: JSON.stringify(['Step 3: Configuring agents']),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockProgress],
        command: 'UPDATE',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await DeploymentModel.updateProgress('deploy_123', {
        current_step: 'configuring_agents',
        progress_percent: 75,
        log: 'Step 3: Configuring agents',
      });

      expect(result?.current_step).toBe('configuring_agents');
      expect(result?.progress_percent).toBe(75);
    });

    it('should return null when deployment not found', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        command: 'UPDATE',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      const result = await DeploymentModel.updateProgress('nonexistent', {
        status: 'deployed',
      });

      expect(result).toBeNull();
    });
  });

  describe('getProgress', () => {
    it('should return deployment progress', async () => {
      const mockProgress = {
        deployment_id: 'deploy_123',
        status: 'deploying',
        current_step: 'installing_dependencies',
        progress_percent: 50,
        logs: JSON.stringify(['Started deployment', 'Installing packages']),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockProgress],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await DeploymentModel.getProgress('deploy_123');

      expect(result).not.toBeNull();
      expect(result?.deployment_id).toBe('deploy_123');
      expect(result?.status).toBe('deploying');
      expect(result?.progress_percent).toBe(50);
      expect(result?.logs).toEqual(['Started deployment', 'Installing packages']);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM deployment_progress WHERE deployment_id = $1',
        ['deploy_123']
      );
    });

    it('should return null when progress not found', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      const result = await DeploymentModel.getProgress('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle progress with error', async () => {
      const mockProgress = {
        deployment_id: 'deploy_123',
        status: 'failed',
        current_step: 'ssh_connection',
        progress_percent: 25,
        logs: JSON.stringify(['Connecting to host', 'Connection failed']),
        error: 'SSH authentication failed',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockProgress],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await DeploymentModel.getProgress('deploy_123');

      expect(result?.status).toBe('failed');
      expect(result?.error).toBe('SSH authentication failed');
    });
  });
});
