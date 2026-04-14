# Agent 设计文档

## 前言

所有 Agent 基于 **LangChain.js** 框架实现，使用其以下核心能力：

- **Chat Models**: LLM 交互封装
- **Chains**: 任务链式编排
- **Tools**: 可调用工具
- **Structured Outputs**: 类型化输出保证
- **LangGraph**: 复杂状态机工作流

## 1. Agent 基类设计

### 1.1 Agent 接口

```typescript
// backend/src/agents/base/agent-interface.ts
export interface AgentInterface<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;

  // 判断是否能处理特定任务
  canHandle(task: Task): boolean;

  // 执行任务
  execute(input: TInput, context: ExecutionContext): Promise<AgentResult<TOutput>>;

  // 获取 LangChain Chain
  getChain(): BaseChain;
}
```

### 1.2 基础 Agent 实现（基于 LangChain）

```typescript
// backend/src/agents/base/base-agent.ts
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';

export abstract class BaseAgent<TInput = unknown, TOutput = unknown>
  implements AgentInterface<TInput, TOutput>
{
  protected readonly llm: ChatOpenAI;
  protected readonly logger: Logger;
  protected chain: RunnableSequence | null = null;

  constructor(
    protected config: AgentConfig,
    dependencies: AgentDependencies
  ) {
    // 使用 LangChain 的 ChatOpenAI
    this.llm = new ChatOpenAI({
      modelName: dependencies.llmConfig.model,
      temperature: dependencies.llmConfig.temperature,
      maxTokens: dependencies.llmConfig.maxTokens,
      timeout: dependencies.llmConfig.timeout,
    });
    this.logger = dependencies.logger;
  }

  abstract getChain(): RunnableSequence;

  async execute(
    input: TInput,
    context: ExecutionContext
  ): Promise<AgentResult<TOutput>> {
    const startTime = Date.now();

    try {
      // 获取 Chain 并执行
      const chain = this.getChain();

      // 将输入转换为 Chain 可接受的格式
      const chainInput = this.prepareChainInput(input, context);

      // 执行 Chain
      const result = await chain.invoke(chainInput);

      // 解析结果
      const data = this.parseOutput(result);

      return {
        success: true,
        data,
        metrics: this.calculateMetrics(startTime),
      };
    } catch (error) {
      this.logger.error(`${this.name} execution failed`, { error });
      return {
        success: false,
        error: error as Error,
        metrics: this.calculateMetrics(startTime),
      };
    }
  }

  protected createStructuredChain<T>(
    promptTemplate: string,
    schema: z.ZodType<T>
  ): RunnableSequence {
    const prompt = PromptTemplate.fromTemplate(promptTemplate);

    // 使用 LangChain 的 withStructuredOutput
    const structuredLLM = this.llm.withStructuredOutput(schema);

    return RunnableSequence.from([prompt, structuredLLM]);
  }
}
```

### 1.3 执行上下文

```typescript
// backend/src/agents/base/types.ts
export interface ExecutionContext {
  projectId: string;
  idea?: Idea;
  project?: Project;
  workspace: Workspace;
  state: ProjectFactoryState;
  metadata: Record<string, unknown>;
}

export interface AgentResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  metrics: AgentMetrics;
  artifacts?: Artifact[];
}

export interface Artifact {
  type: 'file' | 'directory' | 'data' | 'metric';
  path?: string;
  content?: string;
  data?: unknown;
  description?: string;
}

export interface AgentMetrics {
  executionTime: number;
  llmCalls: number;
  tokensUsed: number;
  cost: number;
}
```

## 2. IdeaGeneratorAgent

### 2.1 架构设计

IdeaGeneratorAgent 采用三段式结构：
- **PlannerAgent**: 制定创意生成策略
- **ExecutorAgent**: 执行创意生成
- **CriticAgent**: 评估和优化创意

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      IdeaGeneratorAgent                                  │
│                           ┌──────────┐                                    │
│                      →→→→│ Planner  │→→→→                                   │
│                      │   └──────────┘   │                                   │
│                      │        ↓        │                                   │
│                      │   ┌──────────┐   │                                   │
│                      └←←←│Executor │←←←←                                    │
│                          └──────────┘                                       │
│                              ↓                                             │
│                          ┌──────────┐                                      │
│                          │ Critic   │                                      │
│                          └──────────┘                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 PlannerAgent

```typescript
// backend/src/agents/idea-generator/planner-agent.ts
import { RunnableSequence } from '@langchain/core/runnables';
import { z } from 'zod';
import { BaseAgent } from '../base/base-agent';

const plannerOutputSchema = z.object({
  strategy: z.string(),
  dimensions: z.object({
    projectTypes: z.array(z.string()),
    complexities: z.array(z.string()),
    techStacks: z.array(z.array(z.string())),
    audiences: z.array(z.string()),
  }),
  focusAreas: z.array(z.string()),
  constraints: z.array(z.string()),
});

export class PlannerAgent extends BaseAgent<PlannerInput, PlannerOutput> {
  readonly name = 'IdeaPlanner';
  readonly description = 'Plan the generation of diverse software ideas';

  getChain(): RunnableSequence {
    // 使用基类的 createStructuredChain 方法
    return this.createStructuredChain(
      prompts.ideaGeneration.planner,
      plannerOutputSchema
    );
  }

  protected prepareChainInput(input: PlannerInput, context: ExecutionContext) {
    return {
      batchSize: input.batchSize,
      // 添加更多上下文信息
      recentIdeas: input.recentIdeas ?? [],
      marketTrends: input.marketTrends ?? [],
      typeDistribution: this.getTypeDistribution(context),
    };
  }

  private getTypeDistribution(context: ExecutionContext): string {
    // 从数据库查询类型分布，返回格式化的字符串
    return JSON.stringify({
      'web-app': context.metadata.typeDistribution?.['web-app'] ?? 0,
      'cli-tool': context.metadata.typeDistribution?.['cli-tool'] ?? 0,
      // ...
    });
  }
}

interface PlannerInput {
  batchSize: number;
  recentIdeas?: Idea[];
  marketTrends?: string[];
}

interface PlannerOutput {
  strategy: string;
  dimensions: {
    projectTypes: string[];
    complexities: string[];
    techStacks: string[][];
    audiences: string[];
  };
  focusAreas: string[];
  constraints: string[];
}
```

### 2.3 ExecutorAgent

```typescript
// backend/src/agents/idea-generator/executor-agent.ts
export class ExecutorAgent extends BaseAgent<
  ExecutorInput,
  ExecutorOutput
> {
  readonly name = 'IdeaExecutor';
  readonly description = 'Generate specific software ideas';

  getSystemPrompt(): string {
    return prompts.ideaGeneration.executor;
  }

  async execute(
    input: ExecutorInput,
    context: ExecutionContext
  ): Promise<AgentResult<ExecutorOutput>> {
    const startTime = Date.now();

    const ideas = await this.callLLM(
      this.buildPrompt({
        plan: input.plan,
        batchSize: input.batchSize,
        existingIdeas: input.existingIdeas,
      }),
      z.array(createIdeaSchema)
    );

    // 生成唯一 ID
    const ideasWithIds = (ideas as CreateIdeaInput[]).map(idea => ({
      ...idea,
      id: this.generateId(),
      status: 'pending' as const,
      createdAt: Date.now(),
    }));

    return {
      success: true,
      data: { ideas: ideasWithIds },
      metrics: this.calculateMetrics(startTime),
    };
  }
}

interface ExecutorInput {
  plan: PlannerOutput;
  batchSize: number;
  existingIdeas?: Idea[];
}

interface ExecutorOutput {
  ideas: CreateIdeaInput[];
}
```

### 2.4 CriticAgent

```typescript
// backend/src/agents/idea-generator/critic-agent.ts
export class CriticAgent extends BaseAgent<
  CriticInput,
  CriticOutput
> {
  readonly name = 'IdeaCritic';
  readonly description = 'Evaluate and improve generated ideas';

  getSystemPrompt(): string {
    return prompts.ideaGeneration.critic;
  }

  async execute(
    input: CriticInput,
    context: ExecutionContext
  ): Promise<AgentResult<CriticOutput>> {
    const startTime = Date.now();

    const evaluation = await this.callLLM(
      this.buildPrompt({
        ideas: input.ideas,
        evaluationCriteria: input.criteria,
      }),
      criticOutputSchema
    );

    // 根据评估结果处理
    const { evaluations, overallScore } = evaluation as CriticOutput;

    // 如果整体分数过低，请求重新生成
    if (overallScore < 5) {
      return {
        success: false,
        error: new Error(`Idea quality too low: ${overallScore}`),
        metrics: this.calculateMetrics(startTime),
      };
    }

    // 过滤掉拒绝的创意
    const approvedIdeas = input.ideas.filter((_, index) =>
      evaluations[index]?.action !== 'reject'
    );

    // 标记需要改进的创意
    const ideasNeedingImprovement = input.ideas.filter((_, index) =>
      evaluations[index]?.action === 'improve'
    );

    return {
      success: true,
      data: {
        approvedIdeas,
        ideasNeedingImprovement,
        overallScore,
        feedback: evaluations,
      },
      metrics: this.calculateMetrics(startTime),
    };
  }
}

interface CriticInput {
  ideas: Idea[];
  criteria?: EvaluationCriteria;
}

interface EvaluationCriteria {
  uniqueness: number;
  feasibility: number;
  marketRelevance: number;
  clarity: number;
}

interface CriticOutput {
  overallScore: number;
  evaluations: Array<{
    id: string;
    score: number;
    feedback: string;
    action: 'keep' | 'improve' | 'reject';
  }>;
  suggestions: string[];
}
```

## 3. ArchitectAgent

### 3.1 设计说明

ArchitectAgent 负责将项目创意转换为可执行的技术架构，基于 LangChain.js 实现。

```typescript
// backend/src/agents/architect/architect-agent.ts
import { RunnableSequence } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import { BaseAgent } from '../base/base-agent';

const architectureSchema = z.object({
  structure: z.array(z.object({
    path: z.string(),
    type: z.enum(['file', 'directory']),
    purpose: z.string(),
  })),
  dependencies: z.object({
    dependencies: z.record(z.string()),
    devDependencies: z.record(z.string()),
  }),
  configFiles: z.array(z.string()),
  buildCommands: z.array(z.string()),
  techStack: z.array(z.string()),
  architecturePattern: z.string(),
});

export class ArchitectAgent extends BaseAgent<ArchitectInput, ArchitectOutput> {
  readonly name = 'Architect';
  readonly description = 'Design project architecture and structure';

  getChain(): RunnableSequence {
    const prompt = PromptTemplate.fromTemplate(`
You are an Architect Agent for ProjectFactory.

Design the structure for this project:

Title: {title}
Description: {description}
Type: {projectType}
Features: {features}
Tech Stack: {techStack}
Complexity: {complexity}

Available Templates:
{templates}

Create a comprehensive project structure including:
1. Root level files and their purpose
2. Directory structure with explanations
3. Key files that need to be created
4. Package.json structure with dependencies
5. Configuration files needed
6. Build setup requirements

Return your response as a JSON object with:
- structure: array of objects with path, type (file/directory), and purpose
- dependencies: object with dependencies and devDependencies
- configFiles: array of config file paths
- buildCommands: array of commands for building/testing
- techStack: array of technologies
- architecturePattern: description of the architecture pattern
`);

    const structuredLLM = this.llm.withStructuredOutput(architectureSchema);

    return RunnableSequence.from([prompt, structuredLLM]);
  }

  protected async prepareChainInput(input: ArchitectInput, context: ExecutionContext) {
    // 选择合适的模板
    const templates = await this.getTemplates(input.idea.projectType, input.idea.complexity);

    return {
      title: input.idea.title,
      description: input.idea.description,
      projectType: input.idea.projectType,
      features: input.idea.features.join(', '),
      techStack: input.idea.techStack.join(', '),
      complexity: input.idea.complexity,
      templates: templates.map(t => `${t.name}: ${t.description}`).join('\n'),
    };
  }

  private async getTemplates(type: ProjectType, complexity: Complexity): Promise<ProjectTemplate[]> {
    // 从模板库加载模板
  }
}

interface ArchitectInput {
  idea: Idea;
}

interface ArchitectOutput {
  structure: Array<{
    path: string;
    type: 'file' | 'directory';
    purpose: string;
  }>;
  dependencies: {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  configFiles: string[];
  buildCommands: string[];
  techStack: string[];
  architecturePattern: string;
}
```

## 4. CoderAgent

### 4.1 设计说明

CoderAgent 根据架构设计生成实际代码。

```typescript
// backend/src/agents/coder/coder-agent.ts
export class CoderAgent extends BaseAgent<
  CoderInput,
  CoderOutput
> {
  readonly name = 'Coder';
  readonly description = 'Generate production-ready code';

  async execute(
    input: CoderInput,
    context: ExecutionContext
  ): Promise<AgentResult<CoderOutput>> {
    const startTime = Date.now();

    // 分批生成代码，避免超时
    const files: GeneratedFile[] = [];
    const structure = input.architecture.structure;

    for (const item of structure) {
      if (item.type === 'file') {
        const fileContent = await this.generateFileContent(
          item,
          input.architecture,
          context
        );
        files.push(fileContent);
      }
    }

    // 生成配置文件
    const configFiles = await this.generateConfigFiles(
      input.architecture,
      context
    );

    return {
      success: true,
      data: {
        files: [...files, ...configFiles],
        installationInstructions: this.generateInstallInstructions(input.architecture),
        usageInstructions: this.generateUsageInstructions(input.architecture),
      },
      metrics: this.calculateMetrics(startTime),
      artifacts: files.map(f => ({
        type: 'file',
        path: f.path,
        content: f.content,
      })),
    };
  }

  private async generateFileContent(
    file: { path: string; purpose: string },
    architecture: ArchitectOutput,
    context: ExecutionContext
  ): Promise<GeneratedFile> {
    const prompt = this.buildPrompt({
      filePath: file.path,
      purpose: file.purpose,
      architecture,
      context,
    });

    const content = await this.callLLM(prompt) as string;

    return { path: file.path, content };
  }
}

interface CoderInput {
  idea: Idea;
  architecture: ArchitectOutput;
}

interface CoderOutput {
  files: GeneratedFile[];
  installationInstructions: string;
  usageInstructions: string;
}

interface GeneratedFile {
  path: string;
  content: string;
}
```

## 5. TesterAgent

### 5.1 设计说明

TesterAgent 生成测试并执行验证。

```typescript
// backend/src/agents/tester/tester-agent.ts
export class TesterAgent extends BaseAgent<
  TesterInput,
  TesterOutput
> {
  readonly name = 'Tester';
  readonly description = 'Generate and run tests';

  async execute(
    input: TesterInput,
    context: ExecutionContext
  ): Promise<AgentResult<TesterOutput>> {
    const startTime = Date.now();

    // 1. 生成测试代码
    const testFiles = await this.generateTests(
      input.codeStructure,
      context
    );

    // 2. 写入测试文件
    await this.writeTestFiles(testFiles, context.workspace);

    // 3. 执行测试
    const testResults = await this.runTests(context.workspace);

    // 4. 分析测试结果
    const analysis = await this.analyzeTestResults(testResults);

    return {
      success: analysis.passed,
      data: {
        testFiles,
        testResults,
        analysis,
      },
      metrics: this.calculateMetrics(startTime),
      artifacts: testFiles.map(f => ({
        type: 'file',
        path: f.path,
        content: f.content,
      })),
    };
  }

  private async generateTests(
    codeStructure: CodeStructure,
    context: ExecutionContext
  ): Promise<GeneratedFile[]> {
    const result = await this.callLLM(
      prompts.testing.generateTests
        .replace('{codeStructure}', JSON.stringify(codeStructure)),
      testFilesSchema
    );

    return (result as { testFiles: GeneratedFile[] }).testFiles;
  }

  private async runTests(workspace: Workspace): Promise<TestExecutionResult> {
    // 在工作区运行测试命令
    const framework = this.detectTestFramework(workspace);

    switch (framework) {
      case 'vitest':
        return this.runVitest(workspace);
      case 'jest':
        return this.runJest(workspace);
      case 'pytest':
        return this.runPytest(workspace);
      default:
        throw new Error(`Unsupported test framework: ${framework}`);
    }
  }

  private async analyzeTestResults(
    results: TestExecutionResult
  ): Promise<TestAnalysis> {
    return await this.callLLM(
      prompts.testing.analyzeResults.replace('{testResults}', JSON.stringify(results)),
      testAnalysisSchema
    ) as TestAnalysis;
  }
}

interface TesterInput {
  codeStructure: CodeStructure;
  projectType: ProjectType;
}

interface TesterOutput {
  testFiles: GeneratedFile[];
  testResults: TestExecutionResult;
  analysis: TestAnalysis;
}

interface CodeStructure {
  files: Array<{ path: string; content: string }>;
}

interface TestExecutionResult {
  passed: boolean;
  passCount: number;
  failCount: number;
  coverage?: number;
  output: string;
}

interface TestAnalysis {
  passed: boolean;
  passCount: number;
  failCount: number;
  coverage: number;
  failures: Array<{ test: string; error: string }>;
  recommendations: string[];
}
```

## 6. ReviewerAgent

### 6.1 设计说明

ReviewerAgent 对代码进行全面审查并给出质量评分。

```typescript
// backend/src/agents/reviewer/reviewer-agent.ts
export class ReviewerAgent extends BaseAgent<
  ReviewerInput,
  ReviewerOutput
> {
  readonly name = 'Reviewer';
  readonly description = 'Review code for quality and best practices';

  async execute(
    input: ReviewerInput,
    context: ExecutionContext
  ): Promise<AgentResult<ReviewerOutput>> {
    const startTime = Date.now();

    // 1. 运行 linter
    const lintResults = await this.runLinter(context.workspace);

    // 2. 静态代码分析
    const staticAnalysis = await this.runStaticAnalysis(context.workspace);

    // 3. LLM 深度审查
    const llmReview = await this.callLLM(
      this.buildPrompt({
        project: input.project,
        code: input.code,
        lintResults,
        staticAnalysis,
      }),
      reviewOutputSchema
    );

    // 4. 计算综合质量分数
    const qualityScore = this.calculateQualityScore({
      llmReview,
      lintResults,
      staticAnalysis,
    });

    // 5. 判断是否通过质量门禁
    const approved = this.checkQualityGate(qualityScore, lintResults);

    return {
      success: true,
      data: {
        ...llmReview as ReviewerOutput,
        qualityScore,
        approved,
      },
      metrics: this.calculateMetrics(startTime),
    };
  }

  private calculateQualityScore(scores: QualityScores): number {
    return (
      scores.llmReview.codeQuality * 0.3 +
      scores.llmReview.securityScore * 0.2 +
      scores.llmReview.documentationScore * 0.2 +
      scores.staticAnalysis.maintainabilityIndex / 100 * 0.15 +
      (100 - scores.lintResults.errorCount * 10) * 0.15
    );
  }

  private checkQualityGate(
    qualityScore: number,
    lintResults: LintResults
  ): boolean {
    const config = getQualityConfig();

    return (
      qualityScore >= config.minQualityScore &&
      lintResults.errorCount <= config.maxLintErrors
    );
  }
}

interface ReviewerInput {
  project: {
    id: string;
    name: string;
    type: ProjectType;
  };
  code: CodeStructure;
}

interface ReviewerOutput {
  overallScore: number;
  codeQuality: number;
  securityScore: number;
  documentationScore: number;
  lintErrors: Array<{ file: string; line: number; message: string; severity: string }>;
  issues: Array<{ type: string; description: string; severity: string; file?: string; line?: number }>;
  recommendations: string[];
  approved: boolean;
}

interface QualityScores {
  llmReview: {
    codeQuality: number;
    securityScore: number;
    documentationScore: number;
  };
  lintResults: LintResults;
  staticAnalysis: StaticAnalysisResult;
}
```

## 7. OptimizerAgent

### 7.1 设计说明

OptimizerAgent 分析项目并规划改进。

```typescript
// backend/src/agents/optimizer/optimizer-agent.ts
export class OptimizerAgent extends BaseAgent<
  OptimizerInput,
  OptimizerOutput
> {
  readonly name = 'Optimizer';
  readonly description = 'Analyze and plan project improvements';

  async execute(
    input: OptimizerInput,
    context: ExecutionContext
  ): Promise<AgentResult<OptimizerOutput>> {
    const startTime = Date.now();

    // 1. 分析项目
    const analysis = await this.callLLM(
      prompts.optimizer.analyze
        .replace('{title}', input.project.name)
        .replace('{qualityScore}', input.qualityScore.toString())
        .replace('{testCoverage}', input.testCoverage.toString())
        .replace('{projectCode}', JSON.stringify(input.code, null, 2)),
      optimizerAnalysisSchema
    );

    // 2. 如果分数已达目标，无需优化
    const optimizerAnalysis = analysis as OptimizerAnalysis;
    if (optimizerAnalysis.currentIssues.length === 0) {
      return {
        success: true,
        data: {
          action: 'complete',
          reason: 'No optimization needed',
        },
        metrics: this.calculateMetrics(startTime),
      };
    }

    // 3. 创建迭代计划
    const iterationPlan = await this.createIterationPlan(
      optimizerAnalysis,
      input.project,
      context
    );

    return {
      success: true,
      data: {
        action: 'optimize',
        analysis: optimizerAnalysis,
        iterationPlan,
      },
      metrics: this.calculateMetrics(startTime),
    };
  }

  private async createIterationPlan(
    analysis: OptimizerAnalysis,
    project: Project,
    context: ExecutionContext
  ): Promise<IterationPlan> {
    const topIssue = analysis.currentIssues[0];

    return {
      type: topIssue.type,
      title: topIssue.type + ': ' + topIssue.description,
      description: topIssue.description,
      filesToModify: this.identifyFilesToModify(topIssue, context.workspace),
      steps: this.generateSteps(topIssue),
      expectedQualityImprovement: topIssue.estimatedImpact,
    };
  }
}

interface OptimizerInput {
  project: Project;
  code: CodeStructure;
  qualityScore: number;
  testCoverage: number;
}

interface OptimizerOutput {
  action: 'optimize' | 'complete';
  reason?: string;
  analysis?: OptimizerAnalysis;
  iterationPlan?: IterationPlan;
}

interface OptimizerAnalysis {
  currentIssues: Array<{
    type: 'feature' | 'bugfix' | 'refactor' | 'optimization';
    description: string;
    priority: number;
    impact: number;
  }>;
  recommendedActions: Array<{
    action: string;
    description: string;
    estimatedQualityImprovement: number;
  }>;
  priorityOrder: number[];
}

interface IterationPlan {
  type: 'feature' | 'bugfix' | 'refactor' | 'optimization';
  title: string;
  description: string;
  filesToModify: string[];
  steps: string[];
  expectedQualityImprovement: number;
}
```

## 8. GitAgent

### 8.1 设计说明

GitAgent 管理 Git 操作，包括初始化、提交和版本控制。

```typescript
// backend/src/agents/git/git-agent.ts
export class GitAgent extends BaseAgent<
  GitInput,
  GitOutput
> {
  readonly name = 'Git';
  readonly description = 'Manage git operations';

  async execute(
    input: GitInput,
    context: ExecutionContext
  ): Promise<AgentResult<GitOutput>> {
    const startTime = Date.now();

    switch (input.action) {
      case 'init':
        return await this.initRepo(context.workspace);

      case 'commit':
        return await this.commit(
          input.changes,
          input.message,
          context.workspace
        );

      case 'tag':
        return await this.tag(
          input.tag,
          context.workspace
        );

      default:
        throw new Error(`Unknown git action: ${input.action}`);
    }
  }

  private async initRepo(workspace: Workspace): Promise<AgentResult<GitOutput>> {
    const git = simpleGit(workspace.path);

    // 初始化仓库
    await git.init();

    // 创建 .gitignore
    await this.createGitignore(workspace);

    // 添加所有文件
    await git.add('.');

    // 初始提交
    const initialCommit = await git.commit('Initial commit by ProjectFactory');

    return {
      success: true,
      data: {
        repo: workspace.path,
        commit: initialCommit.commit,
        branch: 'main',
      },
      metrics: this.calculateMetrics(startTime),
    };
  }

  private async commit(
    changes: Array<{ path: string; changeType: string }>,
    customMessage?: string,
    workspace: Workspace
  ): Promise<AgentResult<GitOutput>> {
    const git = simpleGit(workspace.path);

    // 生成提交消息
    let message = customMessage;
    if (!message) {
      message = await this.generateCommitMessage(changes);
    }

    // 添加变更的文件
    for (const change of changes) {
      await git.add(change.path);
    }

    // 提交
    const result = await git.commit(message);

    return {
      success: true,
      data: {
        repo: workspace.path,
        commit: result.commit,
        message,
      },
      metrics: this.calculateMetrics(startTime),
    };
  }

  private async generateCommitMessage(
    changes: Array<{ path: string; changeType: string }>
  ): Promise<string> {
    const result = await this.callLLM(
      prompts.git.commitMessage.replace('{changes}', JSON.stringify(changes)),
      commitMessageSchema
    ) as { message: string };

    return result.message;
  }
}

interface GitInput {
  action: 'init' | 'commit' | 'tag';
  changes?: Array<{ path: string; changeType: string }>;
  message?: string;
  tag?: string;
}

interface GitOutput {
  repo: string;
  commit?: string;
  message?: string;
  branch?: string;
}
```

## 9. Agent 工厂

```typescript
// backend/src/agents/base/agent-factory.ts
export class AgentFactory {
  private static agents = new Map<string, AgentInterface>();

  static register(agent: AgentInterface): void {
    this.agents.set(agent.name, agent);
  }

  static get(name: string): AgentInterface | undefined {
    return this.agents.get(name);
  }

  static getAll(): AgentInterface[] {
    return Array.from(this.agents.values());
  }

  static getForTask(task: Task): AgentInterface | undefined {
    return this.getAll().find(agent => agent.canHandle(task));
  }
}

// 初始化时注册所有 Agent
export function initializeAgents(dependencies: AgentDependencies): void {
  AgentFactory.register(new PlannerAgent(dependencies));
  AgentFactory.register(new ExecutorAgent(dependencies));
  AgentFactory.register(new CriticAgent(dependencies));
  AgentFactory.register(new ArchitectAgent(dependencies));
  AgentFactory.register(new CoderAgent(dependencies));
  AgentFactory.register(new TesterAgent(dependencies));
  AgentFactory.register(new ReviewerAgent(dependencies));
  AgentFactory.register(new OptimizerAgent(dependencies));
  AgentFactory.register(new GitAgent(dependencies));
}
```

## 10. Agent 协作

### 10.1 LangGraph 工作流

```typescript
// backend/src/orchestration/langgraph/project-graph.ts
export async function createProjectGraph(): Promise<CompiledGraph<ProjectFactoryState>> {
  const graph = new StateGraph<ProjectFactoryState>({
    channels: {
      projectId: null,
      idea: null,
      project: null,
      currentAgent: null,
      stage: null,
      step: { value: (x, y) => (y ?? x) + 1, default: () => 0 },
      totalSteps: { value: (x) => x, default: 10 },
      architecture: null,
      generatedFiles: null,
      testResults: null,
      reviewResult: null,
      qualityMetrics: null,
      iterationCount: { value: (x) => x, default: 0 },
      maxIterations: { value: (x) => x, default: 10 },
      qualityScore: { value: (x) => x, default: 0 },
      errors: { value: (x, y) => [...x, ...y], default: () => [] },
      retryCount: { value: (x) => x, default: 0 },
      metadata: { value: (x) => x, default: () => ({}) },
    },
  });

  // 添加节点
  graph.addNode('idea-generator', ideaGeneratorNode);
  graph.addNode('architect', architectNode);
  graph.addNode('coder', coderNode);
  graph.addNode('tester', testerNode);
  graph.addNode('reviewer', reviewerNode);
  graph.addNode('optimizer', optimizerNode);
  graph.addNode('git', gitNode);
  graph.addNode('check-quality', qualityGateNode);

  // 添加边
  graph.addEdge('idea-generator', 'architect');
  graph.addEdge('architect', 'coder');
  graph.addEdge('coder', 'tester');
  graph.addEdge('tester', 'reviewer');
  graph.addConditionalEdges(
    'reviewer',
    shouldOptimize,
    {
      optimize: 'optimizer',
      pass: 'git',
    }
  );
  graph.addEdge('optimizer', 'coder');
  graph.addEdge('git', END);

  // 设置入口
  graph.setEntryPoint('idea-generator');

  return graph.compile();
}

function shouldOptimize(state: ProjectFactoryState): 'optimize' | 'pass' {
  if (state.qualityScore < 70 || state.iterationCount < state.maxIterations) {
    return 'optimize';
  }
  return 'pass';
}
```

### 10.2 节点实现示例

```typescript
async function ideaGeneratorNode(
  state: ProjectFactoryState
): Promise<Partial<ProjectFactoryState>> {
  const planner = AgentFactory.get('IdeaPlanner');
  const executor = AgentFactory.get('IdeaExecutor');
  const critic = AgentFactory.get('IdeaCritic');

  // 三段式执行
  const planResult = await planner!.execute({}, buildContext(state));
  const ideaResult = await executor!.execute(planResult.data!, buildContext(state));
  const finalResult = await critic!.execute(ideaResult.data!, buildContext(state));

  return {
    idea: finalResult.data?.approvedIdeas[0],
    currentAgent: 'IdeaGenerator',
    stage: 'idea-generation',
  };
}
```

## 11. 总结

Agent 设计遵循以下原则：

1. **单一职责**: 每个 Agent 只负责一个特定的任务
2. **可组合**: Agent 可以独立使用，也可以通过 LangGraph 组合成复杂流程
3. **可观测**: 每个 Agent 执行都记录详细指标
4. **可恢复**: 状态持久化，支持断点续传
5. **可扩展**: 通过 AgentFactory 轻松添加新 Agent
