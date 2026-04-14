import { z } from 'zod';

// Project types
export const projectTypeSchema = z.enum(['web-app', 'cli-tool', 'library', 'api-service']);
export type ProjectType = z.infer<typeof projectTypeSchema>;

// Idea status
export const ideaStatusSchema = z.enum(['pending', 'queued', 'in_progress', 'completed', 'failed']);
export type IdeaStatus = z.infer<typeof ideaStatusSchema>;

// Complexity levels
export const complexitySchema = z.enum(['low', 'medium', 'high']);
export type Complexity = z.infer<typeof complexitySchema>;

// Idea schema
export const ideaSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(100),
  description: z.string().min(10),
  projectType: projectTypeSchema,
  features: z.array(z.string().min(1)).min(1).max(10),
  techStack: z.array(z.string().min(1)).min(1).max(10),
  targetAudience: z.string().min(1),
  complexity: complexitySchema,
  status: ideaStatusSchema.default('pending'),
  createdAt: z.number(),
  queuePosition: z.number().optional(),
  pickedAt: z.number().optional(),
  completedAt: z.number().optional(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type Idea = z.infer<typeof ideaSchema>;

// Create idea input (without generated fields)
export const createIdeaSchema = ideaSchema.partial({
  id: true,
  status: true,
  createdAt: true,
  queuePosition: true,
  pickedAt: true,
  completedAt: true,
  error: true,
  metadata: true,
});

export type CreateIdeaInput = z.infer<typeof createIdeaSchema>;

// Update idea input
export const updateIdeaSchema = ideaSchema.partial({
  id: true,
  title: true,
  description: true,
  projectType: true,
  features: true,
  techStack: true,
  targetAudience: true,
  complexity: true,
});

export type UpdateIdeaInput = z.infer<typeof updateIdeaSchema>;