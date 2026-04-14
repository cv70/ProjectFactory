import { db } from '../../../drizzle/config.js';
import { qualityMetrics } from '../../../drizzle/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { QualityMetric, CreateQualityMetricInput } from './schema.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('QualityMetricsPersistence');

/**
 * Repository for QualityMetrics persistence operations
 */
export class QualityMetricsRepository {
  /**
   * Create a new quality metrics record
   */
  async create(input: CreateQualityMetricInput): Promise<QualityMetric> {
    const [result] = await db
      .insert(qualityMetrics)
      .values({
        id: input.id || this.generateId(),
        projectId: input.projectId,
        timestamp: input.timestamp || Date.now(),
        codeComplexity: input.codeComplexity,
        maintainabilityIndex: input.maintainabilityIndex,
        technicalDebt: input.technicalDebt,
        documentationCoverage: input.documentationCoverage,
        securityScore: input.securityScore,
        performanceScore: input.performanceScore,
        duplicateCodePercentage: input.duplicateCodePercentage,
        customMetrics: input.customMetrics as any,
      })
      .returning();

    logger.info('Created quality metrics', { id: result.id, projectId: result.projectId });
    return result;
  }

  /**
   * Get quality metrics by ID
   */
  async findById(id: string): Promise<QualityMetric | null> {
    const [result] = await db
      .select()
      .from(qualityMetrics)
      .where(eq(qualityMetrics.id, id))
      .limit(1);
    return result || null;
  }

  /**
   * Get latest quality metrics for a project
   */
  async getLatestForProject(projectId: string): Promise<QualityMetric | null> {
    const results = await db
      .select()
      .from(qualityMetrics)
      .where(eq(qualityMetrics.projectId, projectId))
      .orderBy(desc(qualityMetrics.timestamp))
      .limit(1);
    return results[0] || null;
  }

  /**
   * Get all quality metrics for a project
   */
  async findByProjectId(projectId: string, limit?: number): Promise<QualityMetric[]> {
    let query = db
      .select()
      .from(qualityMetrics)
      .where(eq(qualityMetrics.projectId, projectId))
      .orderBy(desc(qualityMetrics.timestamp));

    if (limit) {
      query = query.limit(limit);
    }

    return await query;
  }

  /**
   * Get quality metrics history for a project
   */
  async getHistoryForProject(projectId: string, limit: number = 10): Promise<QualityMetric[]> {
    return await this.findByProjectId(projectId, limit);
  }

  /**
   * Calculate average metrics for a project
   */
  async getAverageMetricsForProject(projectId: string): Promise<Partial<QualityMetric> | null> {
    const results = await db
      .select({
        avgCodeComplexity: sql<number>`AVG(${qualityMetrics.codeComplexity})`,
        avgMaintainability: sql<number>`AVG(${qualityMetrics.maintainabilityIndex})`,
        avgTechnicalDebt: sql<number>`AVG(${qualityMetrics.technicalDebt})`,
        avgDocumentation: sql<number>`AVG(${qualityMetrics.documentationCoverage})`,
        avgSecurity: sql<number>`AVG(${qualityMetrics.securityScore})`,
        avgPerformance: sql<number>`AVG(${qualityMetrics.performanceScore})`,
        avgDuplicates: sql<number>`AVG(${qualityMetrics.duplicateCodePercentage})`,
        count: sql<number>`count(*)`,
      })
      .from(qualityMetrics)
      .where(eq(qualityMetrics.projectId, projectId));

    if (!results[0] || results[0].count === 0) {
      return null;
    }

    return {
      codeComplexity: Math.round(results[0].avgCodeComplexity || 0),
      maintainabilityIndex: Math.round(results[0].avgMaintainability || 0),
      technicalDebt: Math.round(results[0].avgTechnicalDebt || 0),
      documentationCoverage: Math.round(results[0].avgDocumentation || 0),
      securityScore: Math.round(results[0].avgSecurity || 0),
      performanceScore: Math.round(results[0].avgPerformance || 0),
      duplicateCodePercentage: Math.round(results[0].avgDuplicates || 0),
    };
  }

  /**
   * Delete metrics for a project
   */
  async deleteByProjectId(projectId: string): Promise<boolean> {
    const result = await db
      .delete(qualityMetrics)
      .where(eq(qualityMetrics.projectId, projectId));
    logger.info('Deleted quality metrics for project', { projectId });
    return result.rowCount > 0;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `qm_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

// Export singleton instance
export const qualityMetricsRepository = new QualityMetricsRepository();
