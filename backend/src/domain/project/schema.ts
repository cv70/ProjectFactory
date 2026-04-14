import { z } from 'zod';

// Project types
export const projectTypeSchema = z.enum(['web-app', 'cli-tool', 'library', 'api-service']);
export type ProjectType = z.infer<typeof projectTypeSchema>;

// Project status
export const projectStatusSchema = z.enum([
  'initializing',
  'generating',
  'testing',
  'building',
  'reviewing',
  'completed',
  'failed',
]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

// Project schema
export const projectSchema = z.object({
  id: z.string(),
  ideaId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().min(1),
  type: projectTypeSchema,
  status: projectStatusSchema.default('initializing'),
  path: z.string(),
  gitRepo: z.string().optional(),
  version: z.string().default('0.1.0'),
  qualityScore: z.number().int().min(0).max(100).default(0),
  testCoverage: z.number().int().min(0).max(100).default(0),
  lintErrors: z.number().int().min(0).default(0),
  buildSuccess: z.boolean().default(false),
  createdAt: z.number(),
  completedAt: z.number().optional(),
  architecture: z.record(z.unknown()).optional(),
  structure: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type Project = z.infer<typeof projectSchema>;

// Create project input
export const createProjectSchema = projectSchema.partial({
  id: true,
  status: true,
  gitRepo: true,
  version: true,
  qualityScore: true,
  testCoverage: true,
  lintErrors: true,
  buildSuccess: true,
  createdAt: true,
  completedAt: true,
  architecture: true,
  structure: true,
  error: true,
  metadata: true,
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

// Update project input
export const updateProjectSchema = projectSchema.partial({
  id: true,
  ideaId: true,
  name: true,
  description: true,
  type: true,
  path: true,
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
