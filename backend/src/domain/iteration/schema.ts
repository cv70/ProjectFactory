import { z } from 'zod';

// Iteration types
export const iterationTypeSchema = z.enum(['feature', 'bugfix', 'refactor', 'optimization']);
export type IterationType = z.infer<typeof iterationTypeSchema>;

// Iteration status
export const iterationStatusSchema = z.enum(['planned', 'in_progress', 'completed', 'failed']);
export type IterationStatus = z.infer<typeof iterationStatusSchema>;

// Iteration schema
export const iterationSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  type: iterationTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  status: iterationStatusSchema.default('planned'),
  qualityBefore: z.number().int().min(0).max(100).default(0),
  qualityAfter: z.number().int().min(0).max(100).optional(),
  filesChanged: z.array(z.string()).default('[]'),
  testCoverageBefore: z.number().int().min(0).max(100).default(0),
  testCoverageAfter: z.number().int().min(0).max(100).optional(),
  createdAt: z.number(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  analysis: z.string().optional(),
  plan: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type Iteration = z.infer<typeof iterationSchema>;

// Create iteration input
export const createIterationSchema = iterationSchema.partial({
  id: true,
  status: true,
  qualityAfter: true,
  filesChanged: true,
  testCoverageAfter: true,
  startedAt: true,
  completedAt: true,
  analysis: true,
  plan: true,
  error: true,
  metadata: true,
});

export type CreateIterationInput = z.infer<typeof createIterationSchema>;

// Update iteration input
export const updateIterationSchema = iterationSchema.partial({
  id: true,
  projectId: true,
  type: true,
  title: true,
  description: true,
});

export type UpdateIterationInput = z.infer<typeof updateIterationSchema>;
