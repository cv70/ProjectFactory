import { db } from '../../../drizzle/config.js';
import { projects } from '../../../drizzle/schema.js';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import type { Project, CreateProjectInput, UpdateProjectInput } from './schema.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('ProjectPersistence');

/**
 * Repository for Project persistence operations
 */
export class ProjectRepository {
  /**
   * Create a new project
   */
  async create(input: CreateProjectInput): Promise<Project> {
    const now = Date.now();
    const [result] = await db
      .insert(projects)
      .values({
        id: input.id || this.generateId(),
        ideaId: input.ideaId,
        name: input.name,
        description: input.description,
        type: input.type,
        status: input.status || 'initializing',
        path: input.path,
        gitRepo: input.gitRepo,
        version: input.version || '0.1.0',
        qualityScore: input.qualityScore ?? 0,
        testCoverage: input.testCoverage ?? 0,
        lintErrors: input.lintErrors ?? 0,
        buildSuccess: input.buildSuccess ?? false,
        createdAt: now,
        completedAt: input.completedAt,
        architecture: input.architecture as any,
        structure: input.structure as any,
        error: input.error,
        metadata: input.metadata as any,
      })
      .returning();

    logger.info('Created project', { id: result.id, name: result.name });
    return result;
  }

  /**
   * Get a project by ID
   */
  async findById(id: string): Promise<Project | null> {
    const [result] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return result || null;
  }

  /**
   * Get all projects with optional filtering
   */
  async findAll(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Project[]> {
    let query = db.select().from(projects);

    if (options?.status) {
      query = query.where(eq(projects.status, options.status as any));
    }

    query = query.orderBy(desc(projects.createdAt));

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    return await query;
  }

  /**
   * Get active projects (not completed or failed)
   */
  async findActive(): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .where(
        sql`${projects.status} IN ('initializing', 'generating', 'testing', 'building', 'reviewing')`
      )
      .orderBy(desc(projects.createdAt));
  }

  /**
   * Get next queued project for processing
   */
  async getNextQueued(): Promise<Project | null> {
    const results = await db
      .select()
      .from(projects)
      .where(eq(projects.status, 'initializing'))
      .orderBy(asc(projects.createdAt))
      .limit(1);
    return results[0] || null;
  }

  /**
   * Update a project
   */
  async update(id: string, input: UpdateProjectInput): Promise<Project | null> {
    const [result] = await db
      .update(projects)
      .set(input as any)
      .where(eq(projects.id, id))
      .returning();

    if (result) {
      logger.info('Updated project', { id, updates: Object.keys(input) });
    }

    return result || null;
  }

  /**
   * Mark project as completed
   */
  async markCompleted(id: string): Promise<Project | null> {
    const [result] = await db
      .update(projects)
      .set({
        status: 'completed',
        completedAt: Date.now(),
      })
      .where(eq(projects.id, id))
      .returning();

    if (result) {
      logger.info('Project marked as completed', { id });
    }

    return result || null;
  }

  /**
   * Mark project as failed
   */
  async markFailed(id: string, error?: string): Promise<Project | null> {
    const [result] = await db
      .update(projects)
      .set({
        status: 'failed',
        completedAt: Date.now(),
        error,
      })
      .where(eq(projects.id, id))
      .returning();

    if (result) {
      logger.info('Project marked as failed', { id, error });
    }

    return result || null;
  }

  /**
   * Update project status
   */
  async updateStatus(id: string, status: string): Promise<Project | null> {
    return await this.update(id, { status: status as any });
  }

  /**
   * Update project quality metrics
   */
  async updateQualityMetrics(
    id: string,
    metrics: {
      qualityScore?: number;
      testCoverage?: number;
      lintErrors?: number;
      buildSuccess?: boolean;
    }
  ): Promise<Project | null> {
    return await this.update(id, {
      qualityScore: metrics.qualityScore,
      testCoverage: metrics.testCoverage,
      lintErrors: metrics.lintErrors,
      buildSuccess: metrics.buildSuccess,
    } as any);
  }

  /**
   * Delete a project
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id));
    logger.info('Deleted project', { id });
    return result.rowCount > 0;
  }

  /**
   * Count projects by status
   */
  async countByStatus(status?: string): Promise<number> {
    let query = db.select({ count: sql<number>`count(*)` }).from(projects);

    if (status) {
      query = query.where(eq(projects.status, status as any));
    }

    const [result] = await query;
    return result?.count ?? 0;
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<Record<string, number>> {
    const results = await db
      .select({
        status: projects.status,
        count: sql<number>`count(*)`,
      })
      .from(projects)
      .groupBy(projects.status);

    return results.reduce(
      (acc, r) => {
        acc[r.status as string] = r.count;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  /**
   * Generate a unique ID for a project
   */
  private generateId(): string {
    return `proj_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

// Export singleton instance
export const projectRepository = new ProjectRepository();
