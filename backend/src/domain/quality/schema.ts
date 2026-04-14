import { z } from 'zod';

// Quality metrics schema
export const qualityMetricSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  timestamp: z.number(),
  codeComplexity: z.number().int().optional(),
  maintainabilityIndex: z.number().int().optional(),
  technicalDebt: z.number().int().optional(),
  documentationCoverage: z.number().int().optional(),
  securityScore: z.number().int().optional(),
  performanceScore: z.number().int().optional(),
  duplicateCodePercentage: z.number().int().optional(),
  customMetrics: z.record(z.unknown()).optional(),
});

export type QualityMetric = z.infer<typeof qualityMetricSchema>;

// Create quality metric input
export const createQualityMetricSchema = qualityMetricSchema.partial({
  id: true,
});

export type CreateQualityMetricInput = z.infer<typeof createQualityMetricSchema>;
