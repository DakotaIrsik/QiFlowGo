import axios from 'axios';
import { discordWebhookService, DiscordWebhookService } from './discordWebhookService';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('DiscordWebhookService', () => {
  let service: DiscordWebhookService;
  const webhookUrl = 'https://discord.com/api/webhooks/test';

  beforeEach(() => {
    service = new DiscordWebhookService();
    jest.clearAllMocks();
    // Mock successful response
    mockedAxios.post.mockResolvedValue({ data: {} });
  });

  describe('sendWebhook', () => {
    it('should send webhook with payload', async () => {
      const payload = {
        content: 'Test message',
      };

      await service.sendWebhook(webhookUrl, payload);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        webhookUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    });

    it('should warn and return if webhook URL is empty', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await service.sendWebhook('', { content: 'test' });

      expect(consoleSpy).toHaveBeenCalledWith('Discord webhook URL not provided');
      expect(mockedAxios.post).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should throw error if webhook fails', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        service.sendWebhook(webhookUrl, { content: 'test' })
      ).rejects.toThrow('Network error');
    });
  });

  describe('sendCommitNotification', () => {
    it('should send commit notification with correct embed', async () => {
      const commit = {
        sha: 'abc123def456',
        message: 'Fix: Updated authentication logic',
        author: 'John Doe',
        url: 'https://github.com/repo/commit/abc123',
        branch: 'main',
        repository: 'QiFlowGo',
      };

      await service.sendCommitNotification(webhookUrl, commit);

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      const payload: any = mockedAxios.post.mock.calls[0][1];

      expect(payload.embeds).toHaveLength(1);
      expect(payload.embeds[0].title).toBe('📝 New Commit');
      expect(payload.embeds[0].description).toBe(commit.message);
      expect(payload.embeds[0].color).toBe(0x5865F2);
      expect(payload.embeds[0].fields).toContainEqual({
        name: 'Repository',
        value: commit.repository,
        inline: true,
      });
      expect(payload.embeds[0].fields).toContainEqual({
        name: 'Branch',
        value: commit.branch,
        inline: true,
      });
      expect(payload.embeds[0].fields).toContainEqual({
        name: 'Author',
        value: commit.author,
        inline: true,
      });
      expect(payload.username).toBe('QiFlow Git Bot');
    });

    it('should truncate commit SHA to 7 characters', async () => {
      const commit = {
        sha: 'abcdef1234567890',
        message: 'Test commit',
        author: 'Test Author',
        url: 'https://github.com/test',
        branch: 'main',
        repository: 'TestRepo',
      };

      await service.sendCommitNotification(webhookUrl, commit);

      const payload: any = mockedAxios.post.mock.calls[0][1];
      const commitField = payload.embeds[0].fields.find((f: any) => f.name === 'Commit');

      expect(commitField.value).toContain('abcdef1');
      expect(commitField.value).not.toContain('abcdef1234567890');
    });
  });

  describe('sendReleaseNotification', () => {
    it('should send release notification for regular release', async () => {
      const release = {
        name: 'v1.0.0',
        tag: 'v1.0.0',
        body: 'Release notes here',
        author: 'Release Manager',
        url: 'https://github.com/repo/releases/v1.0.0',
        repository: 'QiFlowGo',
        prerelease: false,
      };

      await service.sendReleaseNotification(webhookUrl, release);

      const payload: any = mockedAxios.post.mock.calls[0][1];

      expect(payload.embeds[0].title).toBe('🎉 Release Published');
      expect(payload.embeds[0].color).toBe(0x57F287); // Green
      expect(payload.username).toBe('QiFlow Release Bot');
    });

    it('should send pre-release notification with different color', async () => {
      const release = {
        name: 'v1.0.0-beta',
        tag: 'v1.0.0-beta',
        body: 'Beta release notes',
        author: 'Release Manager',
        url: 'https://github.com/repo/releases/v1.0.0-beta',
        repository: 'QiFlowGo',
        prerelease: true,
      };

      await service.sendReleaseNotification(webhookUrl, release);

      const payload: any = mockedAxios.post.mock.calls[0][1];

      expect(payload.embeds[0].title).toBe('🚧 Pre-Release Published');
      expect(payload.embeds[0].color).toBe(0xFEE75C); // Yellow
    });

    it('should truncate long release notes', async () => {
      const longBody = 'a'.repeat(2000);
      const release = {
        name: 'v1.0.0',
        tag: 'v1.0.0',
        body: longBody,
        author: 'Release Manager',
        url: 'https://github.com/repo/releases/v1.0.0',
        repository: 'QiFlowGo',
        prerelease: false,
      };

      await service.sendReleaseNotification(webhookUrl, release);

      const payload: any = mockedAxios.post.mock.calls[0][1];
      const notesField = payload.embeds[0].fields.find((f: any) => f.name === 'Release Notes');

      expect(notesField.value.length).toBeLessThanOrEqual(1024);
      expect(notesField.value.endsWith('...')).toBe(true);
    });
  });

  describe('sendFeatureRequestNotification', () => {
    it('should send feature request notification', async () => {
      const featureRequest = {
        title: 'Add dark mode',
        description: 'Please add dark mode support',
        author: 'User123',
        url: 'https://github.com/repo/issues/42',
        repository: 'QiFlowGo',
        labels: ['enhancement', 'ui'],
      };

      await service.sendFeatureRequestNotification(webhookUrl, featureRequest);

      const payload: any = mockedAxios.post.mock.calls[0][1];

      expect(payload.embeds[0].title).toBe('💡 New Feature Request');
      expect(payload.embeds[0].description).toBe(featureRequest.title);
      expect(payload.embeds[0].color).toBe(0xEB459E); // Pink
      expect(payload.username).toBe('QiFlow Issues Bot');
    });

    it('should include labels in notification', async () => {
      const featureRequest = {
        title: 'Test Feature',
        description: 'Test description',
        author: 'TestUser',
        url: 'https://github.com/test',
        repository: 'TestRepo',
        labels: ['bug', 'critical'],
      };

      await service.sendFeatureRequestNotification(webhookUrl, featureRequest);

      const payload: any = mockedAxios.post.mock.calls[0][1];
      const labelsField = payload.embeds[0].fields.find((f: any) => f.name === 'Labels');

      expect(labelsField.value).toBe('bug, critical');
    });
  });

  describe('sendCustomNotification', () => {
    it('should send custom notification with default color', async () => {
      await service.sendCustomNotification(
        webhookUrl,
        'Test Title',
        'Test Message'
      );

      const payload: any = mockedAxios.post.mock.calls[0][1];

      expect(payload.embeds[0].title).toBe('Test Title');
      expect(payload.embeds[0].description).toBe('Test Message');
      expect(payload.embeds[0].color).toBe(0x5865F2);
      expect(payload.username).toBe('QiFlow Bot');
    });

    it('should send custom notification with custom color and fields', async () => {
      const fields = [
        { name: 'Field 1', value: 'Value 1', inline: true },
        { name: 'Field 2', value: 'Value 2', inline: false },
      ];

      await service.sendCustomNotification(
        webhookUrl,
        'Custom Title',
        'Custom Message',
        0xFF0000,
        fields
      );

      const payload: any = mockedAxios.post.mock.calls[0][1];

      expect(payload.embeds[0].color).toBe(0xFF0000);
      expect(payload.embeds[0].fields).toEqual(fields);
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(discordWebhookService).toBeInstanceOf(DiscordWebhookService);
    });
  });
});
