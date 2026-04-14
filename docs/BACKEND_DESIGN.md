# 后端详细设计文档

## 1. 技术架构

### 1.1 技术栈

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **运行时** | Node.js | 20.x | 运行环境 |
| **语言** | TypeScript | 5.x | 类型安全 |
| **框架** | Express | 4.x | HTTP 框架 |
| **Agent 框架** | LangChain.js | 0.3.x | Agent 编排 |
| **状态管理** | LangGraph | 0.2.x | 工作流状态机 |
| **ORM** | Drizzle ORM | 0.36.x | 数据库操作 |
| **数据库** | SQLite | 3.x | 数据存储 |
| **验证** | Zod | 3.x | 数据验证 |
| **日志** | Winston | 3.x | 日志记录 |
| **测试** | Vitest | 1.x | 单元测试 |

### 1.2 目录结构

```
backend/
├── src/
│   ├── main.ts                     # 入口文件
│   │
│   ├── api/                        # API 层
│   │   ├── index.ts                # API 路由注册
│   │   ├── middleware/              # 中间件
│   │   │   ├── auth.ts              # 认证
│   │   │   ├── error.ts             # 错误处理
│   │   │   ├── logger.ts            # 请求日志
│   │   │   └── validate.ts          # 请求验证
│   │   │
│   │   └── routes/                  # 路由
│   │       ├── ideas.ts             # 创意路由
│   │       ├── projects.ts           # 项目路由
│   │       ├── status.ts            # 状态路由
│   │       ├── knowledge.ts          # 知识库路由
│   │       └── metrics.ts            # 指标路由
│   │
│   ├── agents/                      # Agent 层
│   │   ├── base/                    # 基础抽象
│   │   │   ├── base-agent.ts        # Agent 基类
│   │   │   ├── agent-interface.ts    # Agent 接口
│   │   │   ├── agent-factory.ts     # Agent 工厂
│   │   │   ├── types.ts             # 类型定义
│   │   │   └── index.ts
│   │   │
│   │   ├── idea-generator/           # 创意生成 Agent
│   │   │   ├── idea-generator.ts
│   │   │   ├── planner.ts
│   │   │   ├── executor.ts
│   │   │   ├── critic.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── architect/               # 架构设计 Agent
│   │   │   ├── architect.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── coder/                   # 代码生成 Agent
│   │   │   ├── coder.ts
│   │   │   ├── file-generator.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── tester/                  # 测试生成 Agent
│   │   │   ├── tester.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── reviewer/                # 代码审查 Agent
│   │   │   ├── reviewer.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── deployer/                # 部署 Agent
│   │   │   ├── deployer.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── knowledge/               # 知识管理 Agent
│   │   │   ├── knowledge.ts
│   │   │   ├── extractor.ts
│   │   │   ├── retriever.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── evolution/               # 演化 Agent
│   │   │   ├── evolution.ts
│   │   │   └── index.ts
│   │   │
│   │   └── orchestrator/            # 编排器
│   │       ├── orchestrator.ts
│   │       ├── workflow-engine.ts
│   │       └── index.ts
│   │
│   ├── orchestration/              # 编排层
│   │   ├── langgraph/               # LangGraph 实现
│   │   │   ├── types.ts             # 状态类型
│   │   │   ├── nodes.ts             # 节点定义
│   │   │   ├── edges.ts             # 边定义
│   │   │   ├── workflow.ts          # 工作流
│   │   │   └── index.ts
│   │   │
│   │   ├── scheduler.ts             # 调度器
│   │   ├── project-manager.ts       # 项目管理器
│   │   └── event-bus.ts             # 事件总线
│   │
│   ├── domain/                      # 领域层
│   │   ├── idea/                    # 创意领域
│   │   │   ├── schema.ts            # Zod schema
│   │   │   ├── persistence.ts       # 持久化
│   │   │   └── service.ts           # 领域服务
│   │   │
│   │   ├── project/                # 项目领域
│   │   │   ├── schema.ts
│   │   │   ├── persistence.ts
│   │   │   └── service.ts
│   │   │
│   │   ├── knowledge/              # 知识领域
│   │   │   ├── schema.ts
│   │   │   ├── persistence.ts
│   │   │   └── service.ts
│   │   │
│   │   └── quality/                # 质量领域
│   │       ├── schema.ts
│   │       ├── checker.ts
│   │       └── service.ts
│   │
│   ├── infra/                       # 基础设施层
│   │   ├── db/                      # 数据库
│   │   │   ├── config.ts            # 连接配置
│   │   │   ├── schema.ts            # 表定义
│   │   │   └── migrations/         # 迁移文件
│   │   │
│   │   ├── llm/                     # LLM 集成
│   │   │   ├── client.ts            # LLM 客户端
│   │   │   ├── chat.ts              # 聊天接口
│   │   │   └── embeddings.ts        # 向量接口
│   │   │
│   │   ├── filesystem.ts            # 文件系统
│   │   ├── git.ts                   # Git 操作
│   │   └── process.ts               # 进程管理
│   │
│   ├── config/                      # 配置层
│   │   ├── index.ts                # 配置加载
│   │   ├── schema.ts               # 配置 schema
│   │   └── validation.ts            # 配置验证
│   │
│   ├── utils/                       # 工具层
│   │   ├── logger.ts               # 日志工具
│   │   ├── retry.ts                # 重试工具
│   │   └── prompts.ts              # Prompt 模板
│   │
│   └── types/                       # 类型定义
│       ├── api.ts                   # API 类型
│       └── events.ts                 # 事件类型
│
├── drizzle/                        # Drizzle 配置
│   └── config.ts
│
├── data/                           # 数据目录
│   └── project-factory.db         # SQLite 数据库
│
├── tests/                          # 测试
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── package.json
├── tsconfig.json
└── drizzle.config.ts
```

## 2. Agent 架构

### 2.1 Base Agent 实现

```typescript
// agents/base/base-agent.ts
export abstract class BaseAgent<I, O> {
  abstract readonly name: string;
  abstract readonly description: string;

  protected llm: ChatOpenAI;
  protected config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    this.llm = new ChatOpenAI({
      model: config.model,
      temperature: config.temperature,
      apiKey: config.apiKey
    });
  }

  // 子类实现的方法
  abstract getSystemPrompt(): string;
  abstract getInputSchema(): z.ZodType<I>;
  abstract getOutputSchema(): z.ZodType<O>;

  // 执行入口
  async execute(input: I, context: AgentContext): Promise<AgentResult<O>> {
    const startTime = Date.now();

    try {
      // 1. 验证输入
      const validatedInput = this.getInputSchema().parse(input);

      // 2. 构建 Prompt
      const prompt = this.buildPrompt(validatedInput, context);

      // 3. 调用 LLM
      const response = await this.callLLM(prompt);

      // 4. 解析输出
      const output = this.getOutputSchema().parse(response);

      // 5. 计算指标
      const metrics = this.calculateMetrics(startTime);

      return {
        success: true,
        output,
        artifacts: this.createArtifacts(output),
        metrics,
        errors: []
      };
    } catch (error) {
      return {
        success: false,
        output: null as any,
        artifacts: [],
        metrics: this.calculateMetrics(startTime),
        errors: [this.normalizeError(error)]
      };
    }
  }

  // 构建 Prompt
  protected buildPrompt(input: I, context: AgentContext): Message[] {
    return [
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: JSON.stringify({ input, context }) }
    ];
  }

  // 调用 LLM
  protected async callLLM(prompt: Message[]): Promise<string> {
    const response = await this.llm.invoke(prompt);
    return response.content as string;
  }

  // 创建产物
  protected createArtifacts(output: O): Artifact[] {
    return [{ type: this.name.toLowerCase(), content: output }];
  }

  // 计算指标
  protected calculateMetrics(startTime: number): ExecutionMetrics {
    return {
      duration: Date.now() - startTime,
      tokensUsed: this.llm.getTotalTokens?.() || 0,
      cost: this.llm.getTotalCost?.() || 0,
      timestamp: new Date()
    };
  }
}
```

### 2.2 IdeaGeneratorAgent 实现

```typescript
// agents/idea-generator/idea-generator.ts
export class IdeaGeneratorAgent extends BaseAgent<IdeaInput, ProjectIdea> {
  name = 'IdeaGenerator';
  description = 'Generates valuable software project ideas';

  private planner: IdeaPlanner;
  private executor: IdeaExecutor;
  private critic: IdeaCritic;

  constructor(config: AgentConfig) {
    super(config);
    this.planner = new IdeaPlanner(this.llm);
    this.executor = new IdeaExecutor(this.llm);
    this.critic = new IdeaCritic(this.llm);
  }

  getSystemPrompt(): string {
    return `You are an IdeaGenerator Agent specialized in generating creative and valuable software project ideas.

Your role is to:
1. Analyze market trends and identify opportunities
2. Generate novel project ideas that solve real problems
3. Evaluate ideas based on feasibility, utility, and uniqueness
4. Provide detailed specifications for promising ideas

Output format must be a valid JSON matching the IdeaSchema.`;
  }

  getInputSchema(): z.ZodType<IdeaInput> {
    return z.object({
      domain: z.string().optional(),
      constraints: z.array(z.string()).optional(),
      count: z.number().min(1).max(10).default(3)
    });
  }

  getOutputSchema(): z.ZodType<ProjectIdea> {
    return z.object({
      title: z.string(),
      description: z.string(),
      projectType: z.enum(['web-app', 'cli-tool', 'library', 'api-service']),
      features: z.array(z.string()),
      techStack: z.array(z.string()),
      targetAudience: z.string(),
      complexity: z.enum(['low', 'medium', 'high']),
      valueScore: z.number().min(0).max(1),
      noveltyScore: z.number().min(0).max(1),
      feasibilityScore: z.number().min(0).max(1)
    });
  }

  async execute(input: IdeaInput, context: AgentContext): Promise<AgentResult<ProjectIdea>> {
    // 1. 规划阶段
    const plan = await this.planner.createPlan(input, context);

    // 2. 生成阶段
    const generatedIdeas = await this.executor.generate(plan, context);

    // 3. 评审阶段
    const evaluatedIdeas = await Promise.all(
      generatedIdeas.map(idea => this.critic.evaluate(idea, context))
    );

    // 4. 排序和筛选
    const sortedIdeas = evaluatedIdeas
      .filter(idea => idea.valueScore >= this.config.minValueThreshold)
      .sort((a, b) => b.valueScore - a.valueScore);

    if (sortedIdeas.length === 0) {
      return {
        success: false,
        output: null as any,
        artifacts: [],
        metrics: { duration: 0, tokensUsed: 0, cost: 0, timestamp: new Date() },
        errors: [{ message: 'No ideas met the value threshold' }]
      };
    }

    return {
      success: true,
      output: sortedIdeas[0],
      artifacts: [
        { type: 'idea', content: sortedIdeas[0] },
        { type: 'alternatives', content: sortedIdeas.slice(1, 5) }
      ],
      metrics: { duration: 0, tokensUsed: 0, cost: 0, timestamp: new Date() },
      errors: []
    };
  }
}

// IdeaPlanner
class IdeaPlanner {
  constructor(private llm: ChatOpenAI) {}

  async createPlan(input: IdeaInput, context: AgentContext): Promise<IdeaPlan> {
    const chain = this.llm.withStructuredOutput(IdeaPlanSchema);

    const result = await chain.invoke({
      query: `Create an idea generation plan for domain: ${input.domain || 'general software'}`,
      constraints: input.constraints?.join(', ') || 'none',
      count: input.count
    });

    return result;
  }
}
```

### 2.3 CoderAgent 实现

```typescript
// agents/coder/coder.ts
export class CoderAgent extends BaseAgent<CoderInput, Codebase> {
  name = 'Coder';
  description = 'Generates complete code implementations';

  async execute(input: CoderInput, context: AgentContext): Promise<AgentResult<Codebase>> {
    const { architecture, reviewFeedback } = input;
    const startTime = Date.now();

    // 1. 分析架构，提取文件列表
    const fileSpecs = this.extractFileSpecs(architecture);

    // 2. 获取相关知识
    const relevantPatterns = await context.knowledgeBase检索相关(architecture.type);
    const similarCode = await this.findSimilarCode(architecture);

    // 3. 按依赖顺序生成文件
    const generatedFiles: GeneratedFile[] = [];
    const sortedSpecs = this.topologicalSort(fileSpecs);

    for (const spec of sortedSpecs) {
      const file = await this.generateFile(spec, {
        architecture,
        existingCode: generatedFiles,
        patterns: relevantPatterns,
        similarCode,
        reviewFeedback
      });
      generatedFiles.push(file);
    }

    // 4. 生成配置和脚本
    const configs = await this.generateConfigs(architecture, generatedFiles);

    // 5. 验证代码
    const validation = await this.validateCode(generatedFiles);

    if (!validation.valid) {
      const fixedFiles = await this.autoFix(validation.errors, generatedFiles);
      return {
        success: true,
        output: { files: fixedFiles, configs },
        artifacts: [{ type: 'codebase', content: { files: fixedFiles, configs } }],
        metrics: this.calculateMetrics(startTime),
        errors: validation.errors
      };
    }

    return {
      success: true,
      output: { files: generatedFiles, configs },
      artifacts: [{ type: 'codebase', content: { files: generatedFiles, configs } }],
      metrics: this.calculateMetrics(startTime),
      errors: []
    };
  }

  private async generateFile(
    spec: FileSpec,
    context: GenerationContext
  ): Promise<GeneratedFile> {
    // 根据文件类型选择合适的生成策略
    const chain = this.getGenerationChain(spec.type);

    const result = await chain.invoke({
      spec,
      architecture: context.architecture,
      existingCode: context.existingCode,
      patterns: context.patterns,
      language: this.detectLanguage(spec.path)
    });

    return {
      path: spec.path,
      content: result.code,
      language: spec.language,
      type: spec.type,
      dependencies: spec.dependencies,
      hash: this.hashCode(result.code)
    };
  }

  private getGenerationChain(fileType: FileType): any {
    const schema = z.object({
      code: z.string(),
      explanation: z.string().optional()
    });

    return this.llm.withStructuredOutput(schema);
  }
}
```

## 3. LangGraph 状态机

### 3.1 状态定义

```typescript
// orchestration/langgraph/types.ts

// 项目工厂状态
export interface ProjectFactoryState {
  // 项目信息
  projectId: string;
  idea: ProjectIdea | null;
  architecture: Architecture | null;
  codebase: Codebase | null;
  tests: TestSuite | null;
  review: CodeReview | null;
  deployment: Deployment | null;

  // 流程状态
  stage: ProjectStage;
  stageHistory: StageRecord[];
  currentAction: string | null;

  // 质量指标
  qualityScore: number;
  testCoverage: number;
  lintErrors: number;
  buildSuccess: boolean;

  // 错误处理
  errors: ErrorRecord[];
  retryCount: number;
  maxRetries: number;

  // 元数据
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    createdBy: 'user' | 'system';
  };
}

// 项目阶段
export type ProjectStage =
  | 'idle'
  | 'ideation'
  | 'architecture'
  | 'coding'
  | 'testing'
  | 'reviewing'
  | 'deploying'
  | 'completed'
  | 'failed'
  | 'cancelled';

// 阶段记录
export interface StageRecord {
  stage: ProjectStage;
  enteredAt: Date;
  exitedAt: Date | null;
  duration: number | null;
  success: boolean;
  error?: string;
}

// 状态转换事件
export type StateEvent =
  | { type: 'START'; payload: { idea: ProjectIdea } }
  | { type: 'IDEATION_COMPLETE'; payload: { idea: ProjectIdea } }
  | { type: 'ARCHITECTURE_COMPLETE'; payload: { architecture: Architecture } }
  | { type: 'CODING_COMPLETE'; payload: { codebase: Codebase } }
  | { type: 'TESTING_COMPLETE'; payload: { tests: TestSuite } }
  | { type: 'REVIEW_COMPLETE'; payload: { review: CodeReview } }
  | { type: 'DEPLOY_COMPLETE'; payload: { deployment: Deployment } }
  | { type: 'ERROR'; payload: { error: string; recoverable: boolean } }
  | { type: 'RETRY' }
  | { type: 'CANCEL' };
```

### 3.2 节点定义

```typescript
// orchestration/langgraph/nodes.ts

import { ProjectFactoryState } from './types';
import { AgentResult } from '../agents/base/types';

export async function ideationNode(
  state: ProjectFactoryState,
  context: AgentContext
): Promise<Partial<ProjectFactoryState>> {
  const agent = context.agents.ideaGenerator;

  const result = await agent.execute(
    { count: 1 },
    context
  );

  if (!result.success) {
    return {
      stage: 'failed',
      errors: [...state.errors, { type: 'ideation', message: result.errors[0].message }]
    };
  }

  return {
    idea: result.output,
    stage: 'architecture',
    stageHistory: [
      ...state.stageHistory,
      { stage: 'ideation', enteredAt: new Date(), exitedAt: new Date(), duration: result.metrics.duration, success: true }
    ]
  };
}

export async function architectureNode(
  state: ProjectFactoryState,
  context: AgentContext
): Promise<Partial<ProjectFactoryState>> {
  const agent = context.agents.architect;

  const result = await agent.execute(
    { idea: state.idea! },
    context
  );

  if (!result.success) {
    return {
      stage: 'failed',
      errors: [...state.errors, { type: 'architecture', message: result.errors[0].message }]
    };
  }

  return {
    architecture: result.output,
    stage: 'coding',
    stageHistory: [
      ...state.stageHistory,
      { stage: 'architecture', enteredAt: new Date(), exitedAt: new Date(), duration: result.metrics.duration, success: true }
    ]
  };
}

export async function codingNode(
  state: ProjectFactoryState,
  context: AgentContext
): Promise<Partial<ProjectFactoryState>> {
  const agent = context.agents.coder;
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    const result = await agent.execute(
      {
        architecture: state.architecture!,
        reviewFeedback: attempt > 0 ? state.errors[state.errors.length - 1] : undefined
      },
      context
    );

    if (result.success) {
      return {
        codebase: result.output,
        stage: 'testing',
        stageHistory: [
          ...state.stageHistory,
          { stage: 'coding', enteredAt: new Date(), exitedAt: new Date(), duration: result.metrics.duration, success: true }
        ]
      };
    }

    attempt++;
    state.retryCount++;
  }

  return {
    stage: 'failed',
    errors: [...state.errors, { type: 'coding', message: 'Max retries exceeded' }]
  };
}

export async function testingNode(
  state: ProjectFactoryState,
  context: AgentContext
): Promise<Partial<ProjectFactoryState>> {
  const agent = context.agents.tester;

  const result = await agent.execute(
    { codebase: state.codebase! },
    context
  );

  if (!result.success) {
    return {
      stage: 'failed',
      errors: [...state.errors, { type: 'testing', message: result.errors[0].message }]
    };
  }

  // 运行测试
  const testResult = await context.tools.runTests(state.codebase!, result.output);

  if (!testResult.success) {
    return {
      stage: 'coding', // 返回重新生成
      errors: [...state.errors, { type: 'testing', message: 'Tests failed' }]
    };
  }

  return {
    tests: result.output,
    testCoverage: testResult.coverage,
    stage: 'reviewing',
    stageHistory: [
      ...state.stageHistory,
      { stage: 'testing', enteredAt: new Date(), exitedAt: new Date(), duration: result.metrics.duration, success: true }
    ]
  };
}
```

### 3.3 边定义

```typescript
// orchestration/langgraph/edges.ts

import { ProjectFactoryState } from './types';

export type EdgeCondition = 'always' | 'success' | 'failure';

export interface Edge {
  source: string;
  target: string;
  condition: EdgeCondition | ((state: ProjectFactoryState) => boolean);
}

// 边定义
export const edges: Edge[] = [
  // ideation → architecture
  { source: 'ideation', target: 'architecture', condition: 'success' },

  // architecture → coding
  { source: 'architecture', target: 'coding', condition: 'success' },

  // coding → testing
  { source: 'coding', target: 'testing', condition: 'success' },

  // testing → reviewing (测试通过)
  {
    source: 'testing',
    target: 'reviewing',
    condition: (state) => state.errors.length === 0
  },

  // testing → coding (测试失败，重试)
  {
    source: 'testing',
    target: 'coding',
    condition: (state) => state.errors.length > 0 && state.retryCount < state.maxRetries
  },

  // testing → failed (重试次数超限)
  {
    source: 'testing',
    target: 'failed',
    condition: (state) => state.errors.length > 0 && state.retryCount >= state.maxRetries
  },

  // reviewing → deploying (审查通过)
  {
    source: 'reviewing',
    target: 'deploying',
    condition: (state) => state.qualityScore >= 70
  },

  // reviewing → coding (需要修改)
  {
    source: 'reviewing',
    target: 'coding',
    condition: (state) => state.qualityScore < 70 && state.retryCount < state.maxRetries
  },

  // deploying → completed
  { source: 'deploying', target: 'completed', condition: 'success' },

  // deploying → failed
  { source: 'deploying', target: 'failed', condition: 'failure' },

  // 任何阶段 → failed (严重错误)
  {
    source: '*',
    target: 'failed',
    condition: (state) => state.errors.some(e => e.severity === 'critical')
  }
];

// 评估边条件
export function evaluateEdge(edge: Edge, state: ProjectFactoryState): boolean {
  if (edge.condition === 'always') return true;
  if (edge.condition === 'success') return state.errors.length === 0;
  if (edge.condition === 'failure') return state.errors.length > 0;

  // 函数条件
  if (typeof edge.condition === 'function') {
    return edge.condition(state);
  }

  return false;
}
```

### 3.4 工作流定义

```typescript
// orchestration/langgraph/workflow.ts

import { StateGraph } from '@langchain/langgraph';
import { ProjectFactoryState } from './types';
import * as nodes from './nodes';
import { edges, evaluateEdge } from './edges';

const workflow = new StateGraph<ProjectFactoryState>({
  channels: {
    projectId: { type: 'string' },
    idea: { type: 'any', nullable: true },
    architecture: { type: 'any', nullable: true },
    codebase: { type: 'any', nullable: true },
    tests: { type: 'any', nullable: true },
    review: { type: 'any', nullable: true },
    deployment: { type: 'any', nullable: true },
    stage: { type: 'string' },
    stageHistory: { type: 'array' },
    qualityScore: { type: 'number' },
    errors: { type: 'array' },
    retryCount: { type: 'number' }
  }
});

// 添加节点
workflow.addNode('idle', nodes.idleNode);
workflow.addNode('ideation', nodes.ideationNode);
workflow.addNode('architecture', nodes.architectureNode);
workflow.addNode('coding', nodes.codingNode);
workflow.addNode('testing', nodes.testingNode);
workflow.addNode('reviewing', nodes.reviewingNode);
workflow.addNode('deploying', nodes.deployingNode);
workflow.addNode('completed', nodes.completedNode);
workflow.addNode('failed', nodes.failedNode);

// 添加边
workflow.addEdge('idle', 'ideation');

// 条件边
workflow.addConditionalEdges(
  'ideation',
  (state) => state.errors.length === 0 ? 'architecture' : 'failed',
  {
    'architecture': nodes.architectureNode,
    'failed': nodes.failedNode
  }
);

// 类似的条件边添加...

// 设置入口和出口
workflow.setEntryPoint('idle');
workflow.setFinishPoint('completed');

export const app = workflow.compile();
```

## 4. API 设计

### 4.1 API 路由

```typescript
// api/routes/projects.ts
import { Router } from 'express';
import { z } from 'zod';
import { projectService } from '../../domain/project/service';
import { validateRequest } from '../middleware/validate';

const router = Router();

// Schema
const createProjectSchema = z.object({
  type: z.enum(['web-app', 'cli-tool', 'library', 'api-service']),
  idea: z.string().optional(),
  constraints: z.array(z.string()).optional()
});

const updateProjectSchema = z.object({
  status: z.enum(['paused', 'cancelled']).optional()
});

// 路由
router.get('/', async (req, res) => {
  const { status, limit, offset } = req.query;

  const projects = await projectService.list({
    status: status as string,
    limit: parseInt(limit as string) || 50,
    offset: parseInt(offset as string) || 0
  });

  res.json({ projects });
});

router.get('/:id', async (req, res) => {
  const project = await projectService.getById(req.params.id);

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  res.json({ project });
});

router.post('/', validateRequest(createProjectSchema), async (req, res) => {
  const project = await projectService.create(req.body);

  res.status(201).json({ project });
});

router.patch('/:id', validateRequest(updateProjectSchema), async (req, res) => {
  const project = await projectService.update(req.params.id, req.body);

  res.json({ project });
});

router.post('/:id/pause', async (req, res) => {
  await projectService.pause(req.params.id);
  res.json({ success: true });
});

router.post('/:id/resume', async (req, res) => {
  await projectService.resume(req.params.id);
  res.json({ success: true });
});

router.delete('/:id', async (req, res) => {
  await projectService.delete(req.params.id);
  res.json({ success: true });
});

export { router as projectsRouter };
```

### 4.2 中间件

```typescript
// api/middleware/error.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error('Request error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code
    });
  }

  // Zod validation error
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors
    });
  }

  // Default error
  return res.status(500).json({
    error: 'Internal server error'
  });
}

// api/middleware/validate.ts
export function validateRequest(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}
```

## 5. 数据模型

### 5.1 数据库 Schema

```typescript
// drizzle/schema.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const ideas = sqliteTable('ideas', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  projectType: text('project_type', {
    enum: ['web-app', 'cli-tool', 'library', 'api-service']
  }).notNull(),
  features: text('features', { mode: 'json' }).notNull().$type<string[]>(),
  techStack: text('tech_stack', { mode: 'json' }).notNull().$type<string[]>(),
  targetAudience: text('target_audience').notNull(),
  complexity: text('complexity', {
    enum: ['low', 'medium', 'high']
  }).notNull(),
  valueScore: real('value_score'),
  noveltyScore: real('novelty_score'),
  feasibilityScore: real('feasibility_score'),
  status: text('status', {
    enum: ['pending', 'queued', 'in_progress', 'completed', 'failed']
  }).notNull().default('pending'),
  error: text('error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' })
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  ideaId: text('idea_id').references(() => ideas.id),
  name: text('name').notNull(),
  description: text('description').notNull(),
  type: text('type', {
    enum: ['web-app', 'cli-tool', 'library', 'api-service']
  }).notNull(),
  status: text('status', {
    enum: ['initializing', 'generating', 'testing', 'building', 'completed', 'failed']
  }).notNull().default('initializing'),
  path: text('path').notNull(),
  gitRepo: text('git_repo'),
  qualityScore: integer('quality_score').default(0),
  testCoverage: real('test_coverage').default(0),
  lintErrors: integer('lint_errors').default(0),
  buildSuccess: integer('build_success', { mode: 'boolean' }).default(false),
  version: text('version').notNull().default('0.1.0'),
  error: text('error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' })
});

export const iterations = sqliteTable('iterations', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id).notNull(),
  iterationNumber: integer('iteration_number').notNull(),
  stage: text('stage').notNull(),
  trigger: text('trigger').notNull(),
  changes: text('changes', { mode: 'json' }).$type<Record<string, any>>(),
  qualityBefore: integer('quality_before'),
  qualityAfter: integer('quality_after'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const qualityMetrics = sqliteTable('quality_metrics', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id).notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  coverage: real('coverage').notNull(),
  qualityScore: integer('quality_score').notNull(),
  lintErrors: integer('lint_errors').notNull(),
  buildSuccess: integer('build_success', { mode: 'boolean' }).notNull(),
  cyclomaticComplexity: real('cyclomatic_complexity'),
  maintainabilityIndex: real('maintainability_index')
});

export const knowledgeEntries = sqliteTable('knowledge_entries', {
  id: text('id').primaryKey(),
  type: text('type', {
    enum: ['code_pattern', 'best_practice', 'failure_case', 'domain_knowledge']
  }).notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  keywords: text('keywords', { mode: 'json' }).$type<string[]>(),
  tags: text('tags', { mode: 'json' }).$type<string[]>(),
  embedding: text('embedding', { mode: 'json' }).$type<number[]>(),
  sourceProjectId: text('source_project_id').references(() => projects.id),
  qualityScore: real('quality_score'),
  usageCount: integer('usage_count').default(0),
  successRate: real('success_rate'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});
```

## 6. 事件驱动

### 6.1 事件总线

```typescript
// orchestration/event-bus.ts
type EventHandler = (event: DomainEvent) => void | Promise<void>;

interface DomainEvent {
  type: string;
  payload: unknown;
  timestamp: Date;
  correlationId: string;
}

class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private eventHistory: DomainEvent[] = [];
  private maxHistorySize = 1000;

  // 订阅
  subscribe(eventType: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    // 返回取消订阅函数
    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }

  // 发布
  async publish(event: DomainEvent): Promise<void> {
    // 记录历史
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // 获取处理器
    const handlers = this.handlers.get(event.type);

    if (handlers) {
      // 并行执行所有处理器
      await Promise.all(
        Array.from(handlers).map(handler =>
          Promise.resolve(handler(event)).catch(err => {
            console.error(`Error in event handler for ${event.type}:`, err);
          })
        )
      );
    }

    // 也触发通配符订阅
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      await Promise.all(
        Array.from(wildcardHandlers).map(handler => handler(event))
      );
    }
  }

  // 获取历史
  getHistory(eventType?: string): DomainEvent[] {
    if (eventType) {
      return this.eventHistory.filter(e => e.type === eventType);
    }
    return [...this.eventHistory];
  }
}

// 预定义事件类型
const ProjectEvents = {
  Created: 'project.created',
  Started: 'project.started',
  StageChanged: 'project.stage_changed',
  Completed: 'project.completed',
  Failed: 'project.failed'
} as const;

const IdeaEvents = {
  Generated: 'idea.generated',
  Queued: 'idea.queued',
  Dequeued: 'idea.dequeued'
} as const;

const QualityEvents = {
  CheckStarted: 'quality.check_started',
  CheckCompleted: 'quality.check_completed',
  GatePassed: 'quality.gate_passed',
  GateFailed: 'quality.gate_failed'
} as const;

export const eventBus = new EventBus();
```

## 7. 配置管理

### 7.1 配置 Schema

```typescript
// config/schema.ts
import { z } from 'zod';

export const configSchema = z.object({
  // 服务器配置
  server: z.object({
    port: z.number().default(3001),
    host: z.string().default('0.0.0.0')
  }),

  // 数据库配置
  database: z.object({
    url: z.string().default('./data/project-factory.db')
  }),

  // LLM 配置
  llm: z.object({
    provider: z.enum(['openai', 'anthropic', 'local']).default('openai'),
    apiKey: z.string(),
    baseUrl: z.string().optional(),
    model: z.string().default('gpt-4'),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().default(4096)
  }),

  // 工作区配置
  workspace: z.object({
    root: z.string().default('./projects'),
    activeDir: z.string().default('active'),
    completedDir: z.string().default('completed'),
    archivedDir: z.string().default('archived')
  }),

  // 流水线配置
  pipeline: z.object({
    maxConcurrentProjects: z.number().default(3),
    maxRetries: z.number().default(3),
    stageTimeout: z.record(z.string(), z.number()).default({
      ideation: 60000,
      architecture: 120000,
      coding: 300000,
      testing: 180000,
      reviewing: 120000,
      deploying: 180000
    })
  }),

  // 质量门禁配置
  quality: z.object({
    minCoverage: z.number().default(80),
    minQualityScore: z.number().default(70),
    maxLintErrors: z.number().default(0)
  }),

  // 知识库配置
  knowledge: z.object({
    maxEntries: z.number().default(10000),
    similarityThreshold: z.number().default(0.7),
    autoExtract: z.boolean().default(true)
  }),

  // 监控配置
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metricsInterval: z.number().default(60000)
  })
});

export type Config = z.infer<typeof configSchema>;
```

---

**版本**: 1.0.0
**创建日期**: 2026-04-14
**状态**: 后端详细设计
