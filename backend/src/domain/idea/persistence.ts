import { db } from '../../../drizzle/config.js';
import { ideas } from '../../../drizzle/schema.js';
import { eq, and, isNull, asc, desc, sql } from 'drizzle-orm';
import type { Idea, CreateIdeaInput, UpdateIdeaInput } from './schema.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('IdeaPersistence');

/**
 * Repository for Idea persistence operations
 */
export class IdeaRepository {
  /**
   * Create a new idea
   */
  async create(input: CreateIdeaInput): Promise<Idea> {
    const now = Date.now();
    const [result] = await db
      .insert(ideas)
      .values({
        id: input.id || this.generateId(),
        title: input.title,
        description: input.description,
        projectType: input.projectType,
        features: input.features || [],
        techStack: input.techStack || [],
        targetAudience: input.targetAudience,
        complexity: input.complexity,
        status: input.status || 'pending',
        createdAt: now,
        metadata: input.metadata,
      })
      .returning();

    logger.info('Created idea', { id: result.id, title: result.title });
    return result;
  }

  /**
   * Get an idea by ID
   */
  async findById(id: string): Promise<Idea | null> {
    const [result] = await db.select().from(ideas).where(eq(ideas.id, id)).limit(1);
    return result || null;
  }

  /**
   * Get all ideas
   */
  async findAll(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Idea[]> {
    let query = db.select().from(ideas);

    if (options?.status) {
      query = query.where(eq(ideas.status, options.status as any));
    }

    query = query.orderBy(desc(ideas.createdAt));

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    return await query;
  }

  /**
   * Get queued ideas in order
   */
  async findQueued(limit?: number): Promise<Idea[]> {
    let query = db
      .select()
      .from(ideas)
      .where(eq(ideas.status, 'queued'))
      .orderBy(asc(ideas.queuePosition));

    if (limit) {
      query = query.limit(limit);
    }

    return await query;
  }

  /**
   * Get next idea from queue
   */
  async getNextQueued(): Promise<Idea | null> {
    const results = await this.findQueued(1);
    return results[0] || null;
  }

  /**
   * Get pending ideas (not yet queued)
   */
  async findPending(): Promise<Idea[]> {
    return await db
      .select()
      .from(ideas)
      .where(eq(ideas.status, 'pending'))
      .orderBy(asc(ideas.createdAt));
  }

  /**
   * Update an idea
   */
  async update(id: string, input: UpdateIdeaInput): Promise<Idea | null> {
    const [result] = await db
      .update(ideas)
      .set(input)
      .where(eq(ideas.id, id))
      .returning();

    if (result) {
      logger.info('Updated idea', { id, updates: Object.keys(input) });
    }

    return result || null;
  }

  /**
   * Update idea status
   */
  async updateStatus(id: string, status: string, error?: string): Promise<Idea | null> {
    const updates: any = { status };

    if (status === 'in_progress') {
      updates.pickedAt = Date.now();
    } else if (status === 'completed' || status === 'failed') {
      updates.completedAt = Date.now();
      if (error) {
        updates.error = error;
      }
    }

    return await this.update(id, updates);
  }

  /**
   * Add idea to queue
   */
  async addToQueue(id: string): Promise<Idea | null> {
    // Get the current max queue position
    const [{ maxPosition }] = await db
      .select({ maxPosition: sql<number>`COALESCE(MAX(${ideas.queuePosition}), 0)` })
      .from(ideas);

    return await this.update(id, {
      status: 'queued',
      queuePosition: (maxPosition ?? 0) + 1,
    });
  }

  /**
   * Remove from queue
   */
  async removeFromQueue(id: string): Promise<Idea | null> {
    return await this.update(id, { status: 'pending', queuePosition: null });
  }

  /**
   * Delete an idea
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(ideas).where(eq(ideas.id, id));
    logger.info('Deleted idea', { id });
    return result.rowCount > 0;
  }

  /**
   * Count ideas by status
   */
  async countByStatus(status?: string): Promise<number> {
    let query = db.select({ count: sql<number>`count(*)` }).from(ideas);

    if (status) {
      query = query.where(eq(ideas.status, status as any));
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
        status: ideas.status,
        count: sql<number>`count(*)`,
      })
      .from(ideas)
      .groupBy(ideas.status);

    return results.reduce((acc, r) => {
      acc[r.status] = r.count;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Generate a unique ID for an idea
   */
  private generateId(): string {
    return `idea_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

// Export singleton instance
export const ideaRepository = new IdeaRepository();