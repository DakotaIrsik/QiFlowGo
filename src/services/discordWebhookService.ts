import axios from 'axios';

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  timestamp?: string;
  footer?: {
    text: string;
  };
  author?: {
    name: string;
    url?: string;
    icon_url?: string;
  };
  url?: string;
}

export interface DiscordWebhookPayload {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

export class DiscordWebhookService {
  /**
   * Send a message to a Discord webhook
   */
  async sendWebhook(webhookUrl: string, payload: DiscordWebhookPayload): Promise<void> {
    if (!webhookUrl) {
      console.warn('Discord webhook URL not provided');
      return;
    }

    try {
      await axios.post(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Failed to send Discord webhook:', error);
      throw error;
    }
  }

  /**
   * Send a commit notification to Discord
   */
  async sendCommitNotification(
    webhookUrl: string,
    commit: {
      sha: string;
      message: string;
      author: string;
      url: string;
      branch: string;
      repository: string;
    }
  ): Promise<void> {
    const embed: DiscordEmbed = {
      title: '📝 New Commit',
      description: commit.message,
      color: 0x5865F2, // Discord Blurple
      fields: [
        {
          name: 'Repository',
          value: commit.repository,
          inline: true,
        },
        {
          name: 'Branch',
          value: commit.branch,
          inline: true,
        },
        {
          name: 'Author',
          value: commit.author,
          inline: true,
        },
        {
          name: 'Commit',
          value: `[\`${commit.sha.substring(0, 7)}\`](${commit.url})`,
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'QiFlow Control Center',
      },
    };

    await this.sendWebhook(webhookUrl, {
      embeds: [embed],
      username: 'QiFlow Git Bot',
    });
  }

  /**
   * Send a release notification to Discord
   */
  async sendReleaseNotification(
    webhookUrl: string,
    release: {
      name: string;
      tag: string;
      body: string;
      author: string;
      url: string;
      repository: string;
      prerelease: boolean;
    }
  ): Promise<void> {
    const embed: DiscordEmbed = {
      title: release.prerelease ? '🚧 Pre-Release Published' : '🎉 Release Published',
      description: release.name || release.tag,
      color: release.prerelease ? 0xFEE75C : 0x57F287, // Yellow for pre-release, Green for release
      fields: [
        {
          name: 'Repository',
          value: release.repository,
          inline: true,
        },
        {
          name: 'Tag',
          value: `[\`${release.tag}\`](${release.url})`,
          inline: true,
        },
        {
          name: 'Author',
          value: release.author,
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'QiFlow Control Center',
      },
    };

    // Add release notes if available
    if (release.body) {
      // Truncate release notes to 1024 characters (Discord field limit)
      const truncatedBody = release.body.length > 1024
        ? release.body.substring(0, 1021) + '...'
        : release.body;

      embed.fields?.push({
        name: 'Release Notes',
        value: truncatedBody,
        inline: false,
      });
    }

    await this.sendWebhook(webhookUrl, {
      embeds: [embed],
      username: 'QiFlow Release Bot',
    });
  }

  /**
   * Send a feature request notification to Discord
   */
  async sendFeatureRequestNotification(
    webhookUrl: string,
    featureRequest: {
      title: string;
      description: string;
      author: string;
      url: string;
      repository: string;
      labels: string[];
    }
  ): Promise<void> {
    const embed: DiscordEmbed = {
      title: '💡 New Feature Request',
      description: featureRequest.title,
      color: 0xEB459E, // Pink
      fields: [
        {
          name: 'Repository',
          value: featureRequest.repository,
          inline: true,
        },
        {
          name: 'Author',
          value: featureRequest.author,
          inline: true,
        },
        {
          name: 'Link',
          value: `[View Issue](${featureRequest.url})`,
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'QiFlow Control Center',
      },
    };

    // Add labels if available
    if (featureRequest.labels.length > 0) {
      embed.fields?.push({
        name: 'Labels',
        value: featureRequest.labels.join(', '),
        inline: false,
      });
    }

    // Add description if available
    if (featureRequest.description) {
      // Truncate description to 1024 characters
      const truncatedDesc = featureRequest.description.length > 1024
        ? featureRequest.description.substring(0, 1021) + '...'
        : featureRequest.description;

      embed.fields?.push({
        name: 'Description',
        value: truncatedDesc,
        inline: false,
      });
    }

    await this.sendWebhook(webhookUrl, {
      embeds: [embed],
      username: 'QiFlow Issues Bot',
    });
  }

  /**
   * Send a custom notification to Discord
   */
  async sendCustomNotification(
    webhookUrl: string,
    title: string,
    message: string,
    color?: number,
    fields?: DiscordEmbedField[]
  ): Promise<void> {
    const embed: DiscordEmbed = {
      title,
      description: message,
      color: color || 0x5865F2,
      fields,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'QiFlow Control Center',
      },
    };

    await this.sendWebhook(webhookUrl, {
      embeds: [embed],
      username: 'QiFlow Bot',
    });
  }
}

// Singleton instance
export const discordWebhookService = new DiscordWebhookService();
