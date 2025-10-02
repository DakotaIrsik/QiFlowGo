import request from 'supertest';
import app from '../app';
import { DeploymentModel } from '../models/DeploymentModel';
import { HostModel } from '../models/HostModel';

// Mock the models
jest.mock('../models/DeploymentModel');
jest.mock('../models/HostModel');
jest.mock('../services/deploymentService');

describe('Deployment Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/deployments', () => {
    it('should create a new deployment', async () => {
      const mockDeployment = {
        deployment_id: 'deploy_123',
        status: 'draft',
        step1: {},
        step2: {},
        step3: {},
        step4: {},
        step5: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      (DeploymentModel.create as jest.Mock).mockResolvedValue(mockDeployment);

      const response = await request(app)
        .post('/api/v1/deployments')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockDeployment);
    });
  });

  describe('PUT /api/v1/deployments/:deployment_id/step1', () => {
    it('should update step 1 with valid host', async () => {
      const mockHost = {
        host_id: 'host_123',
        name: 'Test Host',
        hostname: 'test.example.com',
        port: 22,
        username: 'user',
        os_type: 'linux',
        status: 'online',
        capacity: {
          max_swarms: 5,
          active_swarms: 2,
        },
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockDeployment = {
        deployment_id: 'deploy_123',
        status: 'draft',
        step1: { host_id: 'host_123' },
        step2: {},
        step3: {},
        step4: {},
        step5: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      (HostModel.findById as jest.Mock).mockResolvedValue(mockHost);
      (HostModel.findAvailable as jest.Mock).mockResolvedValue([mockHost]);
      (DeploymentModel.updateStep as jest.Mock).mockResolvedValue(mockDeployment);

      const response = await request(app)
        .put('/api/v1/deployments/deploy_123/step1')
        .send({ host_id: 'host_123' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.step1.host_id).toBe('host_123');
    });

    it('should return 400 if host_id is missing', async () => {
      const response = await request(app)
        .put('/api/v1/deployments/deploy_123/step1')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('host_id is required');
    });

    it('should return 404 if host not found', async () => {
      (HostModel.findById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .put('/api/v1/deployments/deploy_123/step1')
        .send({ host_id: 'nonexistent' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/deployments/:deployment_id/step2', () => {
    it('should update step 2 with GitHub repo info', async () => {
      const mockDeployment = {
        deployment_id: 'deploy_123',
        status: 'draft',
        step1: {},
        step2: {
          github_repo: 'test-repo',
          github_owner: 'test-owner',
        },
        step3: {},
        step4: {},
        step5: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      (DeploymentModel.updateStep as jest.Mock).mockResolvedValue(mockDeployment);

      const response = await request(app)
        .put('/api/v1/deployments/deploy_123/step2')
        .send({
          github_repo: 'test-repo',
          github_owner: 'test-owner',
          github_token: 'ghp_token',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.step2.github_repo).toBe('test-repo');
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .put('/api/v1/deployments/deploy_123/step2')
        .send({ github_repo: 'test-repo' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/deployments/:deployment_id/step3', () => {
    it('should update step 3 with schedule preset', async () => {
      const mockDeployment = {
        deployment_id: 'deploy_123',
        status: 'draft',
        step1: {},
        step2: {},
        step3: { schedule_preset: 'business_hours' },
        step4: {},
        step5: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      (DeploymentModel.updateStep as jest.Mock).mockResolvedValue(mockDeployment);

      const response = await request(app)
        .put('/api/v1/deployments/deploy_123/step3')
        .send({ schedule_preset: 'business_hours' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 400 for invalid preset', async () => {
      const response = await request(app)
        .put('/api/v1/deployments/deploy_123/step3')
        .send({ schedule_preset: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/deployments/:deployment_id/step4', () => {
    it('should update step 4 with agents config', async () => {
      const agents = [
        { role: 'developer', responsibilities: ['code'] },
        { role: 'tester', responsibilities: ['test'] },
      ];

      const mockDeployment = {
        deployment_id: 'deploy_123',
        status: 'draft',
        step1: {},
        step2: {},
        step3: {},
        step4: { agents },
        step5: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      (DeploymentModel.updateStep as jest.Mock).mockResolvedValue(mockDeployment);

      const response = await request(app)
        .put('/api/v1/deployments/deploy_123/step4')
        .send({ agents })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 400 if agents array is empty', async () => {
      const response = await request(app)
        .put('/api/v1/deployments/deploy_123/step4')
        .send({ agents: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/deployments/:deployment_id/step5', () => {
    it('should update step 5 with customer info', async () => {
      const mockDeployment = {
        deployment_id: 'deploy_123',
        status: 'draft',
        step1: {},
        step2: {},
        step3: {},
        step4: {},
        step5: {
          customer_name: 'Acme Corp',
          project_name: 'Acme Project',
        },
        created_at: new Date(),
        updated_at: new Date(),
      };

      (DeploymentModel.updateStep as jest.Mock).mockResolvedValue(mockDeployment);

      const response = await request(app)
        .put('/api/v1/deployments/deploy_123/step5')
        .send({
          customer_name: 'Acme Corp',
          project_name: 'Acme Project',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/deployments/:deployment_id/deploy', () => {
    it('should start deployment', async () => {
      const response = await request(app)
        .post('/api/v1/deployments/deploy_123/deploy')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Deployment started');
    });
  });

  describe('GET /api/v1/deployments/:deployment_id/progress', () => {
    it('should get deployment progress', async () => {
      const mockProgress = {
        deployment_id: 'deploy_123',
        status: 'deploying',
        current_step: 'Installing dependencies',
        progress_percent: 60,
        logs: ['Log 1', 'Log 2'],
      };

      (DeploymentModel.getProgress as jest.Mock).mockResolvedValue(mockProgress);

      const response = await request(app)
        .get('/api/v1/deployments/deploy_123/progress')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.progress_percent).toBe(60);
    });

    it('should return 404 if progress not found', async () => {
      (DeploymentModel.getProgress as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/deployments/deploy_123/progress')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/deployments/:deployment_id', () => {
    it('should get deployment by ID', async () => {
      const mockDeployment = {
        deployment_id: 'deploy_123',
        status: 'draft',
        step1: {},
        step2: {},
        step3: {},
        step4: {},
        step5: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      (DeploymentModel.getById as jest.Mock).mockResolvedValue(mockDeployment);

      const response = await request(app)
        .get('/api/v1/deployments/deploy_123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deployment_id).toBe('deploy_123');
    });
  });

  describe('GET /api/v1/deployments/schedule-presets', () => {
    it('should get schedule presets', async () => {
      const response = await request(app)
        .get('/api/v1/deployments/schedule-presets')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('continuous');
      expect(response.body.data).toHaveProperty('business_hours');
      expect(response.body.data).toHaveProperty('nightly');
    });
  });
});
