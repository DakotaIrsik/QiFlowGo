# Discord Integration

QiFlow Control Center supports Discord webhook notifications for commits, releases, and feature requests.

## Setup

### 1. Create Discord Webhooks

1. Open your Discord server
2. Go to Server Settings → Integrations → Webhooks
3. Click "New Webhook"
4. Configure the webhook:
   - **Name**: QiFlow Git Bot (for commits) or QiFlow Release Bot (for releases)
   - **Channel**: Select the channel where notifications should be posted
5. Copy the Webhook URL
6. Repeat for different notification types if desired

### 2. Configure GitHub Secrets

Add the following secrets to your GitHub repository:

- **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these secrets:

- `DISCORD_COMMIT_CHANNEL`: Discord webhook URL for commit notifications
- `DISCORD_RELEASE_CHANNEL`: Discord webhook URL for release notifications

## Notifications

### Commit Notifications

Automatically posts to Discord when commits are pushed to `main` or `develop` branches.

**Includes:**
- Commit message
- Repository name
- Branch name
- Author
- Commit SHA (shortened)
- Link to commit

### Release Notifications

Automatically posts to Discord when a new release is published.

**Includes:**
- Release name/tag
- Repository name
- Author
- Release notes (truncated to 1024 characters)
- Link to release
- Pre-release indicator (if applicable)

**Color Coding:**
- 🎉 Green: Regular releases
- 🚧 Yellow: Pre-releases

## Programmatic Usage

You can also use the Discord webhook service programmatically in your code:

```typescript
import { discordWebhookService } from './services/discordWebhookService';

// Send a commit notification
await discordWebhookService.sendCommitNotification(
  webhookUrl,
  {
    sha: 'abc123def456',
    message: 'Fix: Updated authentication logic',
    author: 'John Doe',
    url: 'https://github.com/repo/commit/abc123',
    branch: 'main',
    repository: 'QiFlowGo',
  }
);

// Send a release notification
await discordWebhookService.sendReleaseNotification(
  webhookUrl,
  {
    name: 'v1.0.0',
    tag: 'v1.0.0',
    body: 'Release notes here',
    author: 'Release Manager',
    url: 'https://github.com/repo/releases/v1.0.0',
    repository: 'QiFlowGo',
    prerelease: false,
  }
);

// Send a custom notification
await discordWebhookService.sendCustomNotification(
  webhookUrl,
  'Custom Title',
  'Custom Message',
  0xFF0000, // Red color
  [
    { name: 'Field 1', value: 'Value 1', inline: true },
    { name: 'Field 2', value: 'Value 2', inline: false },
  ]
);
```

## Testing

Run the test suite to verify the Discord webhook service:

```bash
npm test -- discordWebhookService.test.ts
```

## Troubleshooting

### Notifications not appearing

1. Verify that the GitHub secrets are set correctly
2. Check that the webhook URL is valid
3. Ensure the webhook has permission to post in the channel
4. Review GitHub Actions logs for error messages

### Partial notifications

- Discord has a 2000 character limit for messages
- Release notes are automatically truncated to 1024 characters
- If you need longer notifications, consider linking to the full content

## Security

- Never commit webhook URLs to the repository
- Always use GitHub Secrets to store webhook URLs
- Webhook URLs should be treated as sensitive credentials
- Consider using different webhooks for different environments (production, staging, etc.)
