import { z } from 'zod';
import { BaseAgent } from '../base/base-agent.js';
import type { AgentTask, AgentResult, ExecutionContext, AgentCapabilities, GeneratedFile } from '../base/types.js';
import { prompts } from '../../utils/prompts.js';
import { filesystem } from '../../infra/filesystem.js';
import { createLogger } from '../../utils/logger.js';
import { llmClientFactory } from '../../infra/llm-client.js';

const logger = createLogger('CoderAgent');

/**
 * Code generation output schema
 */
const codeGenerationSchema = z.object({
  files: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
    })
  ),
  installationInstructions: z.string().optional(),
  usageInstructions: z.string().optional(),
});

/**
 * Agent capabilities
 */
const agentCapabilities: AgentCapabilities = {
  supportsParallel: false,
  maxRetries: 3,
  timeoutMs: 300000, // 5 minutes for code generation
};

/**
 * CoderAgent - generates code files for a project
 */
export class CoderAgent extends BaseAgent {
  readonly name = 'CoderAgent';
  readonly description = 'Generates code files for a project based on architecture';
  readonly version = '1.0.0';
  readonly capabilities = agentCapabilities;

  /**
   * Get the task type this agent handles
   */
  protected getTaskType(): string {
    return 'coding';
  }

  /**
   * Build prompt for code generation
   */
  protected buildPrompt(task: AgentTask, _context: ExecutionContext): string {
    const { idea, architecture } = task.input as {
      idea: Record<string, unknown>;
      architecture: Record<string, unknown>;
    };

    if (!idea || !architecture) {
      throw new Error('Both idea and architecture input are required');
    }

    return prompts.architect.generateCode
      .replace('{title}', String(idea.title || ''))
      .replace('{description}', String(idea.description || ''))
      .replace('{projectType}', String(idea.projectType || ''))
      .replace('{features}', JSON.stringify(idea.features || []))
      .replace('{techStack}', JSON.stringify(idea.techStack || []))
      .replace('{architecture}', JSON.stringify(architecture, null, 2));
  }

  /**
   * Parse LLM response into generated files
   */
  protected async parseResponse(
    response: string,
    _context: ExecutionContext
  ): Promise<z.infer<typeof codeGenerationSchema>> {
    // Try to extract JSON from the response
    const jsonMatch =
      response.match(/```json\n?([\s\S]*?)\n?```/) || response.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);

    if (!jsonMatch) {
      throw new Error('Failed to parse JSON from LLM response');
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    return codeGenerationSchema.parse(parsed);
  }

  /**
   * Execute the actual task
   */
  protected async executeTask(task: AgentTask, context: ExecutionContext): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      logger.info('Executing CoderAgent', { task: task.description });

      const { projectPath } = task.metadata || {};
      if (!projectPath) {
        throw new Error('Project path is required in task metadata');
      }

      const prompt = this.buildPrompt(task, context);

      const llm = llmClientFactory.forCodeGeneration();

      const messages = [{ role: 'user' as const, content: prompt }];
      const response = await llm.invoke(messages);

      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      const generated = await this.parseResponse(content, context);

      // Write files to disk
      const files: GeneratedFile[] = [];
      for (const file of generated.files) {
        const fullPath = `${projectPath}/${file.path}`;
        await filesystem.writeFile(fullPath, file.content);
        files.push({
          path: file.path,
          content: file.content,
          language: getLanguageFromPath(file.path),
          size: file.content.length,
          isNew: true,
        });
      }

      logger.info('Code files generated', {
        count: files.length,
        path: projectPath,
      });

      return this.createSuccessResult(
        {
          files,
          installationInstructions: generated.installationInstructions,
          usageInstructions: generated.usageInstructions,
        },
        startTime,
        undefined,
        {
          filesChanged: files.map((f) => f.path),
          recommendations: [
            'Run TesterAgent to generate and run tests',
            'Then run ReviewerAgent to check code quality',
          ],
        }
      );
    } catch (error) {
      logger.error('CoderAgent failed', error);
      return this.createErrorResult(error as Error, startTime);
    }
  }
}

/**
 * Generate code for a project
 */
export async function generateCode(
  idea: {
    title: string;
    description: string;
    projectType: string;
    features: string[];
    techStack: string[];
  },
  architecture: Record<string, unknown>,
  projectPath: string
): Promise<{
  files: GeneratedFile[];
  installationInstructions?: string;
  usageInstructions?: string;
}> {
  const agent = new CoderAgent();

  const result = await agent.execute(
    {
      type: 'coding',
      priority: 9,
      description: `Generate code for ${idea.title}`,
      input: { idea, architecture },
      metadata: { projectPath },
    },
    {
      executionId: `coder_${Date.now()}`,
      stage: 'coding',
      iterationCount: 0,
      maxIterations: 1,
      metadata: {},
      startedAt: Date.now(),
      previousResults: new Map(),
    }
  );

  if (!result.success) {
    throw new Error('Code generation failed: ' + result.error);
  }

  return result.data as any;
}

/**
 * Detect language from file path
 */
function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
  };
  return languageMap[ext] || 'text';
}
