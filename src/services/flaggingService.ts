import { InterventionFlagModel } from '../models/InterventionFlagModel';
import { CreateInterventionFlagParams } from '../types/interventionFlag';

export class FlaggingService {
  /**
   * Check and flag issues that have been blocked for >24 hours
   * Should be called by hourly cron job
   */
  static async checkBlockedIssues(): Promise<number> {
    // This would integrate with your issue tracking system
    // For now, this is a placeholder that demonstrates the logic

    let flaggedCount = 0;

    // TODO: Implement actual integration with issue tracking
    // const blockedIssues = await getIssuesInStatus('blocked');

    // Example logic:
    // for (const issue of blockedIssues) {
    //   const durationHours = await InterventionFlagModel.getBlockedDuration(
    //     issue.swarm_id,
    //     issue.number
    //   );
    //
    //   if (durationHours && durationHours > 24) {
    //     await this.flagBlockedIssue(
    //       issue.swarm_id,
    //       issue.number,
    //       durationHours,
    //       issue.github_url
    //     );
    //     flaggedCount++;
    //   }
    // }

    return flaggedCount;
  }

  /**
   * Flag an issue that has been blocked too long
   */
  static async flagBlockedIssue(
    swarmId: string,
    issueNumber: number,
    durationHours: number,
    githubUrl?: string
  ): Promise<void> {
    const params: CreateInterventionFlagParams = {
      swarm_id: swarmId,
      issue_number: issueNumber,
      github_url: githubUrl,
      priority: 'review',
      reason: `Blocked for ${durationHours} hours`,
      trigger_type: 'blocked_duration',
      blocked_duration_hours: durationHours,
    };

    await InterventionFlagModel.create(params);
  }

  /**
   * Handle agent run completion and check for repeated failures
   */
  static async onAgentRunComplete(
    swarmId: string,
    issueNumber: number,
    status: 'success' | 'failed',
    agentName?: string,
    errorMessage?: string,
    githubUrl?: string
  ): Promise<void> {
    if (status === 'failed') {
      // Track the failure
      const failureCount = await InterventionFlagModel.trackAgentFailure(
        swarmId,
        issueNumber,
        agentName,
        errorMessage
      );

      // Flag if 3 or more consecutive failures
      if (failureCount >= 3) {
        await this.flagAgentFailure(
          swarmId,
          issueNumber,
          failureCount,
          errorMessage,
          githubUrl
        );
      }
    }
  }

  /**
   * Flag an issue due to repeated agent failures
   */
  static async flagAgentFailure(
    swarmId: string,
    issueNumber: number,
    failureCount: number,
    errorMessage?: string,
    githubUrl?: string
  ): Promise<void> {
    const params: CreateInterventionFlagParams = {
      swarm_id: swarmId,
      issue_number: issueNumber,
      github_url: githubUrl,
      priority: 'critical',
      reason: `Agent failed ${failureCount} consecutive times`,
      trigger_type: 'agent_failure',
      failure_count: failureCount,
      agent_message: errorMessage,
    };

    await InterventionFlagModel.create(params);
  }

  /**
   * Flag an issue due to security vulnerability
   */
  static async flagSecurityVulnerability(
    swarmId: string,
    issueNumber: number,
    vulnerabilityDetails: string,
    severity: string,
    githubUrl?: string
  ): Promise<void> {
    const params: CreateInterventionFlagParams = {
      swarm_id: swarmId,
      issue_number: issueNumber,
      github_url: githubUrl,
      priority: 'critical',
      reason: `Security vulnerability detected (${severity})`,
      trigger_type: 'security_vulnerability',
      agent_message: vulnerabilityDetails,
      metadata: {
        severity,
        details: vulnerabilityDetails,
      },
    };

    await InterventionFlagModel.create(params);
  }

  /**
   * Flag an issue due to high test failure rate
   */
  static async flagTestFailures(
    swarmId: string,
    issueNumber: number,
    failureRate: number,
    failedTests: string[],
    githubUrl?: string
  ): Promise<void> {
    if (failureRate <= 0.10) {
      // Only flag if >10% failure rate
      return;
    }

    const params: CreateInterventionFlagParams = {
      swarm_id: swarmId,
      issue_number: issueNumber,
      github_url: githubUrl,
      priority: 'review',
      reason: `Test failure rate: ${(failureRate * 100).toFixed(1)}%`,
      trigger_type: 'test_failure',
      metadata: {
        failure_rate: failureRate,
        failed_tests: failedTests,
      },
    };

    await InterventionFlagModel.create(params);
  }

  /**
   * Flag an issue due to merge conflict that agent cannot resolve
   */
  static async flagMergeConflict(
    swarmId: string,
    issueNumber: number,
    conflictingFiles: string[],
    errorMessage: string,
    githubUrl?: string
  ): Promise<void> {
    const params: CreateInterventionFlagParams = {
      swarm_id: swarmId,
      issue_number: issueNumber,
      github_url: githubUrl,
      priority: 'critical',
      reason: 'Unable to resolve merge conflict',
      trigger_type: 'merge_conflict',
      agent_message: errorMessage,
      metadata: {
        conflicting_files: conflictingFiles,
      },
    };

    await InterventionFlagModel.create(params);
  }

  /**
   * Track issue status change
   */
  static async trackIssueStatusChange(
    swarmId: string,
    issueNumber: number,
    newStatus: string
  ): Promise<void> {
    await InterventionFlagModel.trackStatusChange(swarmId, issueNumber, newStatus);
  }
}
