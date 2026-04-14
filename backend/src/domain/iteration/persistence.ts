import { db } from '../../../drizzle/config.js';
import { iterations } from '../../../drizzle/schema.js';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import type { Iteration, CreateIterationInput, UpdateIterationInput } from './schema.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('IterationPersistence');

/**
 * Repository for Iteration persistence operations
 */
export class IterationRepository {
  /**
   * Create a new iteration
   */
  async create(input: CreateIterationInput): Promise<Iteration> {
    const now = Date.now();
    const [result] = await db
      .insert(iterations)
      .values({
        id: input.id || this.generateId(),
        projectId: input.projectId,
        type: input.type,
        title: input.title,
        description: input.description,
        status: input.status || 'planned',
        qualityBefore: input.qualityBefore ?? 0,
        qualityAfter: input.qualityAfter,
        filesChanged: input.filesChanged || [],
        testCoverageBefore: input.testCoverageBefore ?? 0,
        testCoverageAfter: input.testCoverageAfter,
        createdAt: now,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        analysis: input.analysis,
        plan: input.plan as any,
        error: input.error,
        metadata: input.metadata as any,
      })
      .returning();

    logger.info('Created iteration', { id: result.id, projectId: result.projectId });
    return result;
  }

  /**
   * Get an iteration by ID
   */
  async findById(id: string): Promise<Iteration | null> {
    const [result] = await db.select().from(iterations).where(eq(iterations.id, id)).limit(1);
    return result || null;
  }

  /**
   * Get all iterations for a project
   */
  async findByProjectId(projectId: string): Promise<Iteration[]> {
    return await db
      .select()
      .from(iterations)
      .where(eq(iterations.projectId, projectId))
      .orderBy(desc(iterations.createdAt));
  }

  /**
   * Get iterations by status
   */
  async findByStatus(status: string, limit?: number): Promise<Iteration[]> {
    let query = db
      .select()
      .from(iterations)
      .where(eq(iterations.status, status as any))
      .orderBy(desc(iterations.createdAt));

    if (limit) {
      query = query.limit(limit);
    }

    return await query;
  }

  /**
   * Update an iteration
   */
  async update(id: string, input: UpdateIterationInput): Promise<Iteration | null> {
    const [result] = await db
      .update(iterations)
      .set(input as any)
      .where(eq(iterations.id, id))
      .returning();

    if (result) {
      logger.info('Updated iteration', { id, updates: Object.keys(input) });
    }

    return result || null;
  }

  /**
   * Start an iteration
   */
  async start(id: string): Promise<Iteration | null> {
    const [result] = await db
      .update(iterations)
      .set({
        status: 'in_progress',
        startedAt: Date.now(),
      })
      .where(eq(iterations.id, id))
      .returning();

    if (result) {
      logger.info('Iteration started', { id });
    }

    return result || null;
  }

  /**
   * Complete an iteration
   */
  async complete(
    id: string,
    results: {
      qualityAfter?: number;
      testCoverageAfter?: number;
      filesChanged?: string[];
      analysis?: string;
    }
  ): Promise<Iteration | null> {
    const [result] = await db
      .update(iterations)
      .set({
        status: 'completed',
        completedAt: Date.now(),
        qualityAfter: results.qualityAfter,
        testCoverageAfter: results.testCoverageAfter,
        filesChanged: results.filesChanged,
        analysis: results.analysis,
      })
      .where(eq(iterations.id, id))
      .returning();

    if (result) {
      logger.info('Iteration completed', { id });
    }

    return result || null;
  }

  /**
   * Mark iteration as failed
   */
  async markFailed(id: string, error: string): Promise<Iteration | null> {
    const [result] = await db
      .update(iterations)
      .set({
        status: 'failed',
        completedAt: Date.now(),
        error,
      })
      .where(eq(iterations.id, id))
      .returning();

    if (result) {
      logger.info('Iteration marked as failed', { id, error });
    }

    return result || null;
  }

  /**
   * Delete an iteration
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(iterations).where(eq(iterations.id, id));
    logger.info('Deleted iteration', { id });
    return result.rowCount > 0;
  }

  /**
   * Count iterations by project and status
   */
  async countByProjectAndStatus(projectId: string, status?: string): Promise<number> {
    let query = db
      .select({ count: sql<number>`count(*)` })
      .from(iterations)
      .where(eq(iterations.projectId, projectId));

    if (status) {
      query = query.where(and(eq(iterations.projectId, projectId), eq(iterations.status, status as any)));
    }

    const [result] = await query;
    return result?.count ?? 0;
  }

  /**
   * Get latest iteration for a project
   */
  async getLatestForProject(projectId: string): Promise<Iteration | null> {
    const results = await db
      .select()
      .from(iterations)
      .where(eq(iterations.projectId, projectId))
      .orderBy(desc(iterations.createdAt))
      .limit(1);
    return results[0] || null;
  }

  /**
   * Generate a unique ID for an iteration
   */
  private generateId(): string {
    return `iter_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

// Export singleton instance
export const iterationRepository = new IterationRepository();
