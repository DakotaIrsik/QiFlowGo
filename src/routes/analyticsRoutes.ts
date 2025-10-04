import { Router, Request, Response } from 'express';
import { AnalyticsService } from '../services/analyticsService';
import { cache } from '../services/cacheService';

const router = Router();

/**
 * GET /api/v1/analytics/performance
 * Get performance metrics for swarms
 * Query params: swarm_id, start_date, end_date
 * Used by mobile app Analytics & Insights - Performance Metrics (Issue #12)
 */
router.get('/analytics/performance', async (req: Request, res: Response) => {
  try {
    const { swarm_id, start_date, end_date } = req.query;

    const cacheKey = `analytics:performance:${swarm_id || 'all'}:${start_date || 'none'}:${end_date || 'none'}`;

    // Check cache first (60s TTL)
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    const startDate = start_date ? new Date(start_date as string) : undefined;
    const endDate = end_date ? new Date(end_date as string) : undefined;

    const metrics = await AnalyticsService.getPerformanceMetrics(
      swarm_id as string | undefined,
      startDate,
      endDate
    );

    // Cache for 60 seconds
    cache.set(cacheKey, metrics, 60000);

    res.json({
      success: true,
      data: metrics,
      cached: false,
    });
  } catch (error: any) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch performance metrics',
    });
  }
});

/**
 * GET /api/v1/analytics/costs
 * Get cost analysis for swarms
 * Query params: swarm_id, start_date, end_date
 * Used by mobile app Analytics & Insights - Cost Analysis (Issue #12)
 */
router.get('/analytics/costs', async (req: Request, res: Response) => {
  try {
    const { swarm_id, start_date, end_date } = req.query;

    const cacheKey = `analytics:costs:${swarm_id || 'all'}:${start_date || 'none'}:${end_date || 'none'}`;

    // Check cache first (60s TTL)
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    const startDate = start_date ? new Date(start_date as string) : undefined;
    const endDate = end_date ? new Date(end_date as string) : undefined;

    const costMetrics = await AnalyticsService.getCostAnalysis(
      swarm_id as string | undefined,
      startDate,
      endDate
    );

    // Cache for 60 seconds
    cache.set(cacheKey, costMetrics, 60000);

    res.json({
      success: true,
      data: costMetrics,
      cached: false,
    });
  } catch (error: any) {
    console.error('Error fetching cost analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch cost analysis',
    });
  }
});

/**
 * GET /api/v1/analytics/comparison
 * Compare performance across multiple swarms
 * Query params: swarm_ids[] (optional), start_date, end_date
 * Used by mobile app Analytics & Insights - Swarm Comparison (Issue #12)
 */
router.get('/analytics/comparison', async (req: Request, res: Response) => {
  try {
    const { swarm_ids, start_date, end_date } = req.query;

    const swarmIdArray = swarm_ids
      ? Array.isArray(swarm_ids)
        ? swarm_ids as string[]
        : [swarm_ids as string]
      : undefined;

    const cacheKey = `analytics:comparison:${swarmIdArray?.join(',') || 'all'}:${start_date || 'none'}:${end_date || 'none'}`;

    // Check cache first (60s TTL)
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    const startDate = start_date ? new Date(start_date as string) : undefined;
    const endDate = end_date ? new Date(end_date as string) : undefined;

    const comparison = await AnalyticsService.getSwarmComparison(
      swarmIdArray,
      startDate,
      endDate
    );

    // Cache for 60 seconds
    cache.set(cacheKey, comparison, 60000);

    res.json({
      success: true,
      data: comparison,
      cached: false,
    });
  } catch (error: any) {
    console.error('Error fetching swarm comparison:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch swarm comparison',
    });
  }
});

/**
 * GET /api/v1/analytics/alerts
 * Get alerts and anomalies for swarms
 * Query params: swarm_id, alert_types[]
 * Used by mobile app Analytics & Insights - Alerts & Anomalies (Issue #12)
 */
router.get('/analytics/alerts', async (req: Request, res: Response) => {
  try {
    const { swarm_id, alert_types } = req.query;

    const alertTypesArray = alert_types
      ? Array.isArray(alert_types)
        ? alert_types as string[]
        : [alert_types as string]
      : undefined;

    const cacheKey = `analytics:alerts:${swarm_id || 'all'}:${alertTypesArray?.join(',') || 'all'}`;

    // Check cache first (30s TTL for more real-time alerts)
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    const alerts = await AnalyticsService.getAlertsAndAnomalies(
      swarm_id as string | undefined,
      alertTypesArray
    );

    // Cache for 30 seconds
    cache.set(cacheKey, alerts, 30000);

    res.json({
      success: true,
      data: alerts,
      cached: false,
    });
  } catch (error: any) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch alerts',
    });
  }
});

/**
 * GET /api/v1/analytics/timeseries
 * Get time-series data for charts
 * Query params: swarm_id (required), metric (velocity|cost|resource), start_date, end_date
 * Used by mobile app Analytics & Insights - Chart rendering (Issue #12)
 */
router.get('/analytics/timeseries', async (req: Request, res: Response) => {
  try {
    const { swarm_id, metric, start_date, end_date } = req.query;

    // Validation
    if (!swarm_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: swarm_id',
      });
    }

    if (!metric || !['velocity', 'cost', 'resource'].includes(metric as string)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid metric. Must be one of: velocity, cost, resource',
      });
    }

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: start_date, end_date',
      });
    }

    const cacheKey = `analytics:timeseries:${swarm_id}:${metric}:${start_date}:${end_date}`;

    // Check cache first (60s TTL)
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    const startDate = new Date(start_date as string);
    const endDate = new Date(end_date as string);

    const timeSeriesData = await AnalyticsService.getTimeSeriesData(
      swarm_id as string,
      metric as 'velocity' | 'cost' | 'resource',
      startDate,
      endDate
    );

    // Cache for 60 seconds
    cache.set(cacheKey, timeSeriesData, 60000);

    res.json({
      success: true,
      data: timeSeriesData,
      cached: false,
    });
  } catch (error: any) {
    console.error('Error fetching time series data:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch time series data',
    });
  }
});

/**
 * GET /api/v1/analytics/export
 * Export analytics data as CSV or PDF
 * Query params: swarm_id, type (performance|costs|comparison), format (csv|pdf), start_date, end_date
 * Used by mobile app Analytics & Insights - Export functionality (Issue #12)
 */
router.get('/analytics/export', async (req: Request, res: Response) => {
  try {
    const { swarm_id, type, format, start_date, end_date } = req.query;

    // Validation
    if (!type || !['performance', 'costs', 'comparison'].includes(type as string)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid type. Must be one of: performance, costs, comparison',
      });
    }

    if (!format || !['csv', 'pdf'].includes(format as string)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid format. Must be one of: csv, pdf',
      });
    }

    const startDate = start_date ? new Date(start_date as string) : undefined;
    const endDate = end_date ? new Date(end_date as string) : undefined;

    let data: any;
    let filename: string;

    switch (type) {
      case 'performance':
        data = await AnalyticsService.getPerformanceMetrics(
          swarm_id as string | undefined,
          startDate,
          endDate
        );
        filename = `performance_metrics_${swarm_id || 'all'}_${Date.now()}`;
        break;

      case 'costs':
        data = await AnalyticsService.getCostAnalysis(
          swarm_id as string | undefined,
          startDate,
          endDate
        );
        filename = `cost_analysis_${swarm_id || 'all'}_${Date.now()}`;
        break;

      case 'comparison':
        data = await AnalyticsService.getSwarmComparison(undefined, startDate, endDate);
        filename = `swarm_comparison_${Date.now()}`;
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid export type',
        });
    }

    if (format === 'csv') {
      // Generate CSV
      const csvContent = this.generateCSV(data, type as string);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csvContent);
    } else {
      // For PDF, return data structure (mobile app will handle PDF generation)
      res.json({
        success: true,
        data: {
          filename: `${filename}.pdf`,
          content: data,
          type,
        },
        message: 'PDF data ready for client-side generation',
      });
    }
  } catch (error: any) {
    console.error('Error exporting analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to export analytics',
    });
  }
});

/**
 * Helper function to generate CSV from analytics data
 */
function generateCSV(data: any, type: string): string {
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return '';
    }

    // Get headers from first object
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    // Add data rows
    for (const row of data) {
      const values = headers.map((header) => {
        const value = row[header];
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  } else if (type === 'comparison') {
    // Handle comparison data structure
    const headers = ['swarm_id', 'swarm_name', 'velocity', 'uptime', 'cost', 'issues_closed', 'test_pass_rate'];
    const csvRows = [headers.join(',')];

    for (const swarm of data.swarms) {
      const values = headers.map((header) => swarm[header]);
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  return '';
}

export default router;
