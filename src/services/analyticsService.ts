import { SwarmModel } from '../models/SwarmModel';
import { VelocityMetricsModel } from '../models/VelocityMetricsModel';

export interface PerformanceMetrics {
  swarm_id: string;
  swarm_name: string;
  avg_velocity: number;
  total_issues_closed: number;
  total_prs_merged: number;
  avg_time_to_close: number; // hours
  test_pass_rate: number; // percentage
  deployment_frequency: number; // per day
  uptime_percentage: number;
  cpu_avg: number;
  memory_avg: number;
  disk_avg: number;
  response_time_avg: number; // ms
}

export interface CostMetrics {
  swarm_id: string;
  swarm_name: string;
  api_calls_total: number;
  api_cost_usd: number;
  compute_cost_usd: number;
  storage_cost_usd: number;
  total_cost_usd: number;
  cost_per_issue: number;
  cost_per_pr: number;
  revenue_share: number; // percentage
}

export interface SwarmComparison {
  swarms: Array<{
    swarm_id: string;
    swarm_name: string;
    velocity: number;
    uptime: number;
    cost: number;
    issues_closed: number;
    test_pass_rate: number;
  }>;
  best_performer: {
    velocity: string;
    cost_efficiency: string;
    uptime: string;
    quality: string;
  };
}

export interface Alert {
  swarm_id: string;
  swarm_name: string;
  alert_type: 'critical' | 'warning' | 'info';
  category: 'performance' | 'cost' | 'resource' | 'quality';
  message: string;
  threshold: number;
  current_value: number;
  timestamp: Date;
}

export class AnalyticsService {
  /**
   * Get performance metrics for a specific swarm or all swarms
   */
  static async getPerformanceMetrics(
    swarm_id?: string,
    start_date?: Date,
    end_date?: Date
  ): Promise<PerformanceMetrics[]> {
    const swarms = swarm_id
      ? [await SwarmModel.findById(swarm_id)]
      : await SwarmModel.findAll();

    if (swarm_id && !swarms[0]) {
      throw new Error('Swarm not found');
    }

    const metrics: PerformanceMetrics[] = [];

    for (const swarm of swarms) {
      if (!swarm) continue;

      // Get velocity metrics
      const velocityMetrics = await VelocityMetricsModel.findBySwarmId(swarm.swarm_id);
      const recentMetrics = start_date && end_date
        ? velocityMetrics.filter(
            (m) =>
              new Date(m.date) >= start_date && new Date(m.date) <= end_date
          )
        : velocityMetrics.slice(-30); // Last 30 days

      const avgVelocity = recentMetrics.length > 0
        ? recentMetrics.reduce((sum, m) => sum + m.issues_closed, 0) / recentMetrics.length
        : 0;

      const totalIssuesClosed = recentMetrics.reduce((sum, m) => sum + m.issues_closed, 0);
      const totalPRsMerged = recentMetrics.reduce((sum, m) => sum + (m.prs_merged || 0), 0);

      // Calculate uptime percentage
      const uptimePercentage = swarm.health_status
        ? Math.max(
            0,
            100 - (swarm.health_status.cpu_percent * 0.3 +
                   swarm.health_status.memory_percent * 0.3 +
                   swarm.health_status.disk_percent * 0.4)
          )
        : 100;

      metrics.push({
        swarm_id: swarm.swarm_id,
        swarm_name: swarm.name,
        avg_velocity: avgVelocity,
        total_issues_closed: totalIssuesClosed,
        total_prs_merged: totalPRsMerged,
        avg_time_to_close: 24, // Placeholder - would need issue tracking
        test_pass_rate: 95, // Placeholder - would need CI/CD integration
        deployment_frequency: totalPRsMerged / (recentMetrics.length || 1),
        uptime_percentage: uptimePercentage,
        cpu_avg: swarm.health_status?.cpu_percent || 0,
        memory_avg: swarm.health_status?.memory_percent || 0,
        disk_avg: swarm.health_status?.disk_percent || 0,
        response_time_avg: 150, // Placeholder - would need monitoring data
      });
    }

    return metrics;
  }

  /**
   * Get cost analysis for swarms
   */
  static async getCostAnalysis(
    swarm_id?: string,
    start_date?: Date,
    end_date?: Date
  ): Promise<CostMetrics[]> {
    const swarms = swarm_id
      ? [await SwarmModel.findById(swarm_id)]
      : await SwarmModel.findAll();

    if (swarm_id && !swarms[0]) {
      throw new Error('Swarm not found');
    }

    const costMetrics: CostMetrics[] = [];

    for (const swarm of swarms) {
      if (!swarm) continue;

      // Get velocity metrics for issue/PR counts
      const velocityMetrics = await VelocityMetricsModel.findBySwarmId(swarm.swarm_id);
      const recentMetrics = start_date && end_date
        ? velocityMetrics.filter(
            (m) =>
              new Date(m.date) >= start_date && new Date(m.date) <= end_date
          )
        : velocityMetrics.slice(-30);

      const totalIssuesClosed = recentMetrics.reduce((sum, m) => sum + m.issues_closed, 0);
      const totalPRsMerged = recentMetrics.reduce((sum, m) => sum + (m.prs_merged || 0), 0);

      // Estimate costs (placeholder values - would need real billing data)
      const apiCallsTotal = (totalIssuesClosed + totalPRsMerged) * 50; // Estimate 50 API calls per issue/PR
      const apiCostUSD = apiCallsTotal * 0.0001; // $0.0001 per API call
      const computeCostUSD = recentMetrics.length * 1.5; // $1.50 per day
      const storageCostUSD = 5.0; // Fixed $5 per month
      const totalCostUSD = apiCostUSD + computeCostUSD + storageCostUSD;

      costMetrics.push({
        swarm_id: swarm.swarm_id,
        swarm_name: swarm.name,
        api_calls_total: apiCallsTotal,
        api_cost_usd: parseFloat(apiCostUSD.toFixed(2)),
        compute_cost_usd: parseFloat(computeCostUSD.toFixed(2)),
        storage_cost_usd: parseFloat(storageCostUSD.toFixed(2)),
        total_cost_usd: parseFloat(totalCostUSD.toFixed(2)),
        cost_per_issue: totalIssuesClosed > 0
          ? parseFloat((totalCostUSD / totalIssuesClosed).toFixed(2))
          : 0,
        cost_per_pr: totalPRsMerged > 0
          ? parseFloat((totalCostUSD / totalPRsMerged).toFixed(2))
          : 0,
        revenue_share: 70, // Placeholder - 70% revenue share
      });
    }

    return costMetrics;
  }

  /**
   * Compare performance across multiple swarms
   */
  static async getSwarmComparison(
    swarm_ids?: string[],
    start_date?: Date,
    end_date?: Date
  ): Promise<SwarmComparison> {
    const swarms = swarm_ids && swarm_ids.length > 0
      ? await Promise.all(swarm_ids.map((id) => SwarmModel.findById(id)))
      : await SwarmModel.findAll();

    const validSwarms = swarms.filter((s) => s !== null);

    if (validSwarms.length === 0) {
      throw new Error('No swarms found for comparison');
    }

    const performanceMetrics = await this.getPerformanceMetrics(undefined, start_date, end_date);
    const costMetrics = await this.getCostAnalysis(undefined, start_date, end_date);

    const comparisonData = validSwarms.map((swarm) => {
      const perf = performanceMetrics.find((p) => p.swarm_id === swarm!.swarm_id);
      const cost = costMetrics.find((c) => c.swarm_id === swarm!.swarm_id);

      return {
        swarm_id: swarm!.swarm_id,
        swarm_name: swarm!.name,
        velocity: perf?.avg_velocity || 0,
        uptime: perf?.uptime_percentage || 0,
        cost: cost?.total_cost_usd || 0,
        issues_closed: perf?.total_issues_closed || 0,
        test_pass_rate: perf?.test_pass_rate || 0,
      };
    });

    // Find best performers
    const bestVelocity = comparisonData.reduce((best, current) =>
      current.velocity > best.velocity ? current : best
    );

    const bestCostEfficiency = comparisonData.reduce((best, current) => {
      const currentEfficiency = current.issues_closed / (current.cost || 1);
      const bestEfficiency = best.issues_closed / (best.cost || 1);
      return currentEfficiency > bestEfficiency ? current : best;
    });

    const bestUptime = comparisonData.reduce((best, current) =>
      current.uptime > best.uptime ? current : best
    );

    const bestQuality = comparisonData.reduce((best, current) =>
      current.test_pass_rate > best.test_pass_rate ? current : best
    );

    return {
      swarms: comparisonData,
      best_performer: {
        velocity: bestVelocity.swarm_name,
        cost_efficiency: bestCostEfficiency.swarm_name,
        uptime: bestUptime.swarm_name,
        quality: bestQuality.swarm_name,
      },
    };
  }

  /**
   * Get alerts and anomalies for swarms
   */
  static async getAlertsAndAnomalies(
    swarm_id?: string,
    alert_types?: string[]
  ): Promise<Alert[]> {
    const swarms = swarm_id
      ? [await SwarmModel.findById(swarm_id)]
      : await SwarmModel.findAll();

    if (swarm_id && !swarms[0]) {
      throw new Error('Swarm not found');
    }

    const alerts: Alert[] = [];

    for (const swarm of swarms) {
      if (!swarm) continue;

      // Check resource alerts
      if (swarm.health_status) {
        if (swarm.health_status.cpu_percent > 90) {
          alerts.push({
            swarm_id: swarm.swarm_id,
            swarm_name: swarm.name,
            alert_type: 'critical',
            category: 'resource',
            message: 'CPU usage critically high',
            threshold: 90,
            current_value: swarm.health_status.cpu_percent,
            timestamp: new Date(),
          });
        } else if (swarm.health_status.cpu_percent > 75) {
          alerts.push({
            swarm_id: swarm.swarm_id,
            swarm_name: swarm.name,
            alert_type: 'warning',
            category: 'resource',
            message: 'CPU usage elevated',
            threshold: 75,
            current_value: swarm.health_status.cpu_percent,
            timestamp: new Date(),
          });
        }

        if (swarm.health_status.memory_percent > 90) {
          alerts.push({
            swarm_id: swarm.swarm_id,
            swarm_name: swarm.name,
            alert_type: 'critical',
            category: 'resource',
            message: 'Memory usage critically high',
            threshold: 90,
            current_value: swarm.health_status.memory_percent,
            timestamp: new Date(),
          });
        } else if (swarm.health_status.memory_percent > 75) {
          alerts.push({
            swarm_id: swarm.swarm_id,
            swarm_name: swarm.name,
            alert_type: 'warning',
            category: 'resource',
            message: 'Memory usage elevated',
            threshold: 75,
            current_value: swarm.health_status.memory_percent,
            timestamp: new Date(),
          });
        }

        if (swarm.health_status.disk_percent > 90) {
          alerts.push({
            swarm_id: swarm.swarm_id,
            swarm_name: swarm.name,
            alert_type: 'critical',
            category: 'resource',
            message: 'Disk usage critically high',
            threshold: 90,
            current_value: swarm.health_status.disk_percent,
            timestamp: new Date(),
          });
        } else if (swarm.health_status.disk_percent > 75) {
          alerts.push({
            swarm_id: swarm.swarm_id,
            swarm_name: swarm.name,
            alert_type: 'warning',
            category: 'resource',
            message: 'Disk usage elevated',
            threshold: 75,
            current_value: swarm.health_status.disk_percent,
            timestamp: new Date(),
          });
        }
      }

      // Check performance alerts
      const velocityMetrics = await VelocityMetricsModel.findBySwarmId(swarm.swarm_id);
      const recentMetrics = velocityMetrics.slice(-7); // Last 7 days

      if (recentMetrics.length >= 7) {
        const avgVelocity = recentMetrics.reduce((sum, m) => sum + m.issues_closed, 0) / 7;

        if (avgVelocity < 1) {
          alerts.push({
            swarm_id: swarm.swarm_id,
            swarm_name: swarm.name,
            alert_type: 'warning',
            category: 'performance',
            message: 'Low velocity detected',
            threshold: 1,
            current_value: avgVelocity,
            timestamp: new Date(),
          });
        }
      }

      // Check status alerts
      if (swarm.status === 'offline') {
        alerts.push({
          swarm_id: swarm.swarm_id,
          swarm_name: swarm.name,
          alert_type: 'critical',
          category: 'performance',
          message: 'Swarm is offline',
          threshold: 0,
          current_value: 0,
          timestamp: new Date(),
        });
      } else if (swarm.status === 'degraded') {
        alerts.push({
          swarm_id: swarm.swarm_id,
          swarm_name: swarm.name,
          alert_type: 'warning',
          category: 'performance',
          message: 'Swarm performance degraded',
          threshold: 0,
          current_value: 1,
          timestamp: new Date(),
        });
      }
    }

    // Filter by alert types if specified
    if (alert_types && alert_types.length > 0) {
      return alerts.filter((a) => alert_types.includes(a.alert_type));
    }

    return alerts;
  }

  /**
   * Generate time-series data for charts
   */
  static async getTimeSeriesData(
    swarm_id: string,
    metric: 'velocity' | 'cost' | 'resource',
    start_date: Date,
    end_date: Date
  ): Promise<Array<{ date: Date; value: number }>> {
    const swarm = await SwarmModel.findById(swarm_id);
    if (!swarm) {
      throw new Error('Swarm not found');
    }

    const velocityMetrics = await VelocityMetricsModel.findBySwarmId(swarm_id);
    const filteredMetrics = velocityMetrics.filter(
      (m) => new Date(m.date) >= start_date && new Date(m.date) <= end_date
    );

    switch (metric) {
      case 'velocity':
        return filteredMetrics.map((m) => ({
          date: new Date(m.date),
          value: m.issues_closed,
        }));

      case 'cost':
        return filteredMetrics.map((m) => ({
          date: new Date(m.date),
          value: (m.issues_closed + (m.prs_merged || 0)) * 50 * 0.0001 + 1.5, // Simplified cost calc
        }));

      case 'resource':
        // For now, return current resource usage (would need historical data)
        return filteredMetrics.map((m) => ({
          date: new Date(m.date),
          value: swarm.health_status?.cpu_percent || 0,
        }));

      default:
        throw new Error('Invalid metric type');
    }
  }
}
