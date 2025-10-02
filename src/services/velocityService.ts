import { VelocityMetricsModel, VelocityMetric } from '../models/VelocityMetricsModel';

export interface VelocityData {
  issues_per_day: number;
  last_n_days: number[];
  period_days: number;
  period_start: string;
  period_end: string;
}

export interface TrendData {
  trend: 'increasing' | 'stable' | 'decreasing';
  trend_percentage: number;
  slope: number;
}

export interface ForecastData {
  estimated_completion_date: string;
  days_remaining: number;
  confidence_level: number;
  confidence_label: 'High' | 'Medium' | 'Low';
  based_on_velocity: number;
  remaining_issues: number;
}

export class VelocityService {
  /**
   * Calculate velocity (rolling average) for a swarm
   */
  static async calculateVelocity(
    swarmId: string,
    days: number = 7
  ): Promise<VelocityData> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const metrics = await VelocityMetricsModel.findBySwarmAndDateRange(
      swarmId,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    // Sort by date ascending for proper ordering
    metrics.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const dailyCounts = metrics.map(m => m.issues_closed);
    const totalClosed = dailyCounts.reduce((sum, count) => sum + count, 0);
    const averagePerDay = totalClosed / days;

    return {
      issues_per_day: parseFloat(averagePerDay.toFixed(2)),
      last_n_days: dailyCounts,
      period_days: days,
      period_start: startDate.toISOString().split('T')[0],
      period_end: endDate.toISOString().split('T')[0],
    };
  }

  /**
   * Detect trend using linear regression
   */
  static detectTrend(dailyMetrics: number[]): TrendData {
    const n = dailyMetrics.length;

    // Handle edge case: insufficient data
    if (n < 2) {
      return {
        trend: 'stable',
        trend_percentage: 0,
        slope: 0,
      };
    }

    // X values are day indices (0, 1, 2, ...)
    const xValues = Array.from({ length: n }, (_, i) => i);
    const yValues = dailyMetrics;

    // Calculate sums for linear regression
    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

    // Calculate slope: m = (n*Σ(xy) - Σx*Σy) / (n*Σ(x²) - (Σx)²)
    const denominator = n * sumX2 - sumX * sumX;
    const slope = denominator !== 0
      ? (n * sumXY - sumX * sumY) / denominator
      : 0;

    // Calculate trend percentage relative to mean
    const mean = sumY / n;
    const trendPercentage = mean !== 0 ? (slope / mean) * 100 : 0;

    // Determine trend direction
    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (trendPercentage > 10) trend = 'increasing';
    if (trendPercentage < -10) trend = 'decreasing';

    return {
      trend,
      trend_percentage: parseFloat(trendPercentage.toFixed(2)),
      slope: parseFloat(slope.toFixed(4)),
    };
  }

  /**
   * Calculate standard deviation
   */
  static calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;

    return Math.sqrt(variance);
  }

  /**
   * Calculate confidence level based on velocity variance
   */
  static calculateConfidence(velocityData: VelocityData): number {
    if (velocityData.last_n_days.length === 0) return 0.5;

    const stdDev = this.calculateStdDev(velocityData.last_n_days);
    const mean = velocityData.issues_per_day;

    // Handle edge case: mean is zero
    if (mean === 0) return 0.5;

    // Coefficient of variation (CV) = stdDev / mean
    const coefficientOfVariation = stdDev / mean;

    // Lower CV = higher confidence
    let confidence = 0.95; // High
    if (coefficientOfVariation > 0.3) confidence = 0.75; // Medium
    if (coefficientOfVariation > 0.5) confidence = 0.50; // Low

    return confidence;
  }

  /**
   * Adjust forecast based on trend
   */
  static adjustForTrend(daysToCompletion: number, trend: TrendData): number {
    if (trend.trend === 'increasing') {
      // Getting faster, reduce estimate by trend percentage
      const adjustment = Math.abs(trend.trend_percentage) / 100;
      return daysToCompletion * (1 - adjustment);
    } else if (trend.trend === 'decreasing') {
      // Getting slower, increase estimate by trend percentage
      const adjustment = Math.abs(trend.trend_percentage) / 100;
      return daysToCompletion * (1 + adjustment);
    }

    return daysToCompletion;
  }

  /**
   * Generate completion forecast
   */
  static async generateForecast(
    swarmId: string,
    totalIssues: number,
    completedIssues: number
  ): Promise<ForecastData> {
    const velocity = await this.calculateVelocity(swarmId, 7);
    const trend = this.detectTrend(velocity.last_n_days);

    const remainingIssues = totalIssues - completedIssues;

    // Handle edge case: no remaining issues
    if (remainingIssues <= 0) {
      return {
        estimated_completion_date: new Date().toISOString().split('T')[0],
        days_remaining: 0,
        confidence_level: 1.0,
        confidence_label: 'High',
        based_on_velocity: velocity.issues_per_day,
        remaining_issues: 0,
      };
    }

    // Handle edge case: zero velocity
    if (velocity.issues_per_day === 0) {
      return {
        estimated_completion_date: 'N/A',
        days_remaining: -1,
        confidence_level: 0.0,
        confidence_label: 'Low',
        based_on_velocity: 0,
        remaining_issues: remainingIssues,
      };
    }

    // Calculate base estimate
    let daysToCompletion = remainingIssues / velocity.issues_per_day;

    // Adjust for trend
    daysToCompletion = this.adjustForTrend(daysToCompletion, trend);

    // Calculate estimated completion date
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + Math.ceil(daysToCompletion));

    // Calculate confidence
    const confidence = this.calculateConfidence(velocity);
    const confidenceLabel = confidence > 0.85 ? 'High' : confidence > 0.65 ? 'Medium' : 'Low';

    return {
      estimated_completion_date: estimatedDate.toISOString().split('T')[0],
      days_remaining: Math.ceil(daysToCompletion),
      confidence_level: parseFloat(confidence.toFixed(2)),
      confidence_label: confidenceLabel,
      based_on_velocity: velocity.issues_per_day,
      remaining_issues: remainingIssues,
    };
  }

  /**
   * Aggregate daily metrics (for cron job)
   */
  static async aggregateDailyMetrics(date: string): Promise<void> {
    // Get all swarms with velocity data
    const swarmIds = await VelocityMetricsModel.getAllSwarmIds();

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    for (const swarmId of swarmIds) {
      const completions = await VelocityMetricsModel.getCompletionsByDateRange(
        swarmId,
        startDate,
        endDate
      );

      const issuesClosed = completions.length;
      const avgCompletionTime = issuesClosed > 0
        ? completions.reduce((sum, c) => sum + (c.time_to_complete_hours || 0), 0) / issuesClosed
        : null;

      await VelocityMetricsModel.upsert(
        swarmId,
        date,
        issuesClosed,
        0, // issuesOpened - will be populated when GitHub webhook is available
        avgCompletionTime
      );
    }
  }
}
