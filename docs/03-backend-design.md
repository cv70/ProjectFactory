# 后端设计

## 1. 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 20+ | 运行时 |
| TypeScript | 5+ | 类型安全 |
| Express | 4+ / Fastify | Web框架 |
| LangChain.js | latest | AI抽象层 |
| better-sqlite3 | 9+ | SQLite客户端 |
| bull | 4+ | 任务队列 |
| winston | 3+ | 日志 |
| zod | 3+ | Schema验证 |
| ws | 8+ | WebSocket |

## 2. 目录结构

```
backend/
├── src/
│   ├── api/                 # API路由
│   │   ├── index.ts
│   │   ├── projects.ts
│   │   ├── generation.ts
│   │   ├── deployment.ts
│   │   ├── knowledge.ts
│   │   ├── monitoring.ts
│   │   └── websocket.ts
│   ├── agents/              # Agent实现
│   │   ├── base.ts          # Agent基类
│   │   ├── meta.ts          # Meta Agent
│   │   ├── requirement.ts   # Requirement Agent
│   │   ├── architecture.ts  # Architecture Agent
│   │   ├── development.ts   # Development Agent
│   │   ├── quality.ts       # Quality Agent
│   │   ├── deployment.ts    # Deployment Agent
│   │   └── evolution.ts     # Evolution Agent
│   ├── orchestrator/        # 编排器
│   │   ├── index.ts
│   │   ├── workflow.ts
│   │   └── executor.ts
│   ├── langchain/           # LangChain抽象
│   │   ├── index.ts
│   │   ├── llm.ts
│   │   ├── chains.ts
│   │   ├── tools.ts
│   │   └── memory.ts
│   ├── services/            # 业务服务
│   │   ├── project.ts
│   │   ├── codegen.ts
│   │   ├── validation.ts
│   │   ├── deployment.ts
│   │   └── knowledge.ts
│   ├── db/                  # 数据库
│   │   ├── sqlite.ts
│   │   ├── migrations/
│   │   └── schema/
│   ├── queue/               # 任务队列
│   │   ├── index.ts
│   │   ├── producer.ts
│   │   ├── processor.ts
│   │   └── jobs/
│   ├── events/              # 事件系统
│   │   ├── bus.ts
│   │   ├── types.ts
│   │   └── handlers/
│   ├── monitoring/          # 监控
│   │   ├── metrics.ts
│   │   ├── health.ts
│   │   └── alerts.ts
│   ├── config/              # 配置
│   │   ├── index.ts
│   │   ├── env.ts
│   │   └── constants.ts
│   ├── utils/               # 工具
│   │   ├── logger.ts
│   │   ├── cache.ts
│   │   └── helpers.ts
│   ├── types/               # 类型定义
│   │   ├── agent.ts
│   │   ├── project.ts
│   │   └── index.ts
│   └── index.ts             # 入口文件
├── storage/                 # 数据存储
│   ├── data.db             # SQLite数据库
│   └── projects/           # 生成的项目代码
├── templates/              # 项目模板
└── package.json
```

## 3. 核心模块设计

### 3.1 API路由

```typescript
// api/index.ts
import express from 'express';
import projectRoutes from './projects';
import generationRoutes from './generation';
import deploymentRoutes from './deployment';
import knowledgeRoutes from './knowledge';
import monitoringRoutes from './monitoring';

const router = express.Router();

router.use('/projects', projectRoutes);
router.use('/generation', generationRoutes);
router.use('/deployment', deploymentRoutes);
router.use('/knowledge', knowledgeRoutes);
router.use('/monitoring', monitoringRoutes);

export default router;
```

#### 项目API

```typescript
// api/projects.ts
import express from 'express';
import { projectService } from '../services/project';
import { z } from 'zod';

const router = express.Router();

// GET /api/projects - 列表
router.get('/', async (req, res) => {
  const schema = z.object({
    page: z.coerce.number().default(1),
    limit: z.coerce.number().default(20),
    status: z.enum(['all', 'pending', 'running', 'completed', 'failed']).optional(),
    type: z.string().optional(),
  });

  const params = schema.parse(req.query);
  const result = await projectService.list(params);
  res.json(result);
});

// GET /api/projects/:id - 详情
router.get('/:id', async (req, res) => {
  const project = await projectService.get(req.params.id);
  res.json(project);
});

// POST /api/projects - 创建
router.post('/', async (req, res) => {
  const schema = z.object({
    name: z.string(),
    description: z.string(),
    type: z.enum(['crud', 'data-tool', 'script', 'other']),
    requirements: z.string().optional(),
  });

  const data = schema.parse(req.body);
  const project = await projectService.create(data);
  res.json(project);
});

// PUT /api/projects/:id - 更新
router.put('/:id', async (req, res) => {
  const project = await projectService.update(req.params.id, req.body);
  res.json(project);
});

// DELETE /api/projects/:id - 删除
router.delete('/:id', async (req, res) => {
  await projectService.delete(req.params.id);
  res.status(204).send();
});

// POST /api/projects/:id/start - 启动生成
router.post('/:id/start', async (req, res) => {
  const job = await projectService.startGeneration(req.params.id);
  res.json(job);
});

// POST /api/projects/:id/stop - 停止生成
router.post('/:id/stop', async (req, res) => {
  await projectService.stopGeneration(req.params.id);
  res.status(204).send();
});

export default router;
```

#### 生成API

```typescript
// api/generation.ts
import express from 'express';
import { generationService } from '../services/codegen';

const router = express.Router();

// GET /api/generation/templates - 模板列表
router.get('/templates', async (req, res) => {
  const templates = await generationService.getTemplates();
  res.json(templates);
});

// POST /api/generation/preview - 预览
router.post('/preview', async (req, res) => {
  const { requirements, template } = req.body;
  const preview = await generationService.preview(requirements, template);
  res.json(preview);
});

export default router;
```

### 3.2 Agent基类

```typescript
// agents/base.ts
import { LLM } from '../langchain/llm';
import { EventBus } from '../events/bus';

export interface AgentContext {
  projectId: string;
  userId?: string;
  llm: LLM;
  eventBus: EventBus;
  state: Record<string, unknown>;
}

export interface AgentConfig {
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  maxRetries?: number;
  timeout?: number;
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected context: AgentContext;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  async initialize(context: AgentContext): Promise<void> {
    this.context = context;
  }

  abstract execute(input: unknown): Promise<AgentResult>;

  protected async emit(event: string, data: unknown): Promise<void> {
    await this.context.eventBus.publish({
      type: event,
      data,
      projectId: this.context.projectId,
      timestamp: new Date(),
    });
  }

  protected async getLLMResponse(
    prompt: string,
    options?: LLMOptions
  ): Promise<string> {
    return await this.context.llm.complete(prompt, options);
  }

  protected async updateState(key: string, value: unknown): Promise<void> {
    this.context.state[key] = value;
  }

  protected getState(key: string): unknown {
    return this.context.state[key];
  }
}

export interface AgentResult {
  success: boolean;
  data?: unknown;
  error?: string;
  nextAction?: string;
  metadata?: Record<string, unknown>;
}
```

### 3.3 Meta Agent

```typescript
// agents/meta.ts
import { BaseAgent, AgentContext, AgentResult } from './base';
import { RequirementAgent } from './requirement';
import { ArchitectureAgent } from './architecture';
import { DevelopmentAgent } from './development';
import { QualityAgent } from './quality';
import { DeploymentAgent } from './deployment';
import { EvolutionAgent } from './evolution';

export class MetaAgent extends BaseAgent {
  private agents: Map<string, BaseAgent>;

  constructor() {
    super({
      name: 'MetaAgent',
      version: '1.0.0',
      description: '元控制器，协调所有Agent的工作',
      capabilities: ['orchestration', 'coordination', 'decision'],
    });

    this.agents = new Map();
    this.initializeAgents();
  }

  private initializeAgents(): void {
    this.agents.set('requirement', new RequirementAgent());
    this.agents.set('architecture', new ArchitectureAgent());
    this.agents.set('development', new DevelopmentAgent());
    this.agents.set('quality', new QualityAgent());
    this.agents.set('deployment', new DeploymentAgent());
    this.agents.set('evolution', new EvolutionAgent());
  }

  async execute(input: { goal: string }): Promise<AgentResult> {
    await this.emit('workflow-started', { goal: input.goal });

    try {
      // 1. 需求分析
      await this.emit('phase-started', { phase: 'requirement' });
      const requirementAgent = this.agents.get('requirement')!;
      const requirementResult = await requirementAgent.execute(input);
      if (!requirementResult.success) {
        return this.handleError('requirement', requirementResult.error!);
      }

      // 2. 架构设计
      await this.emit('phase-started', { phase: 'architecture' });
      const architectureAgent = this.agents.get('architecture')!;
      const architectureResult = await architectureAgent.execute(
        requirementResult.data
      );
      if (!architectureResult.success) {
        return this.handleError('architecture', architectureResult.error!);
      }

      // 3. 代码开发
      await this.emit('phase-started', { phase: 'development' });
      const developmentAgent = this.agents.get('development')!;
      const developmentResult = await developmentAgent.execute(
        architectureResult.data
      );
      if (!developmentResult.success) {
        return this.handleError('development', developmentResult.error!);
      }

      // 4. 质量验证
      await this.emit('phase-started', { phase: 'quality' });
      const qualityAgent = this.agents.get('quality')!;
      const qualityResult = await qualityAgent.execute(developmentResult.data);
      if (!qualityResult.success) {
        // 质量检查失败，反馈给开发Agent重新生成
        await this.emit('quality-failed', qualityResult.error);
        return await this.execute(input); // 重新开始
      }

      // 5. 部署
      await this.emit('phase-started', { phase: 'deployment' });
      const deploymentAgent = this.agents.get('deployment')!;
      const deploymentResult = await deploymentAgent.execute(
        qualityResult.data
      );
      if (!deploymentResult.success) {
        return this.handleError('deployment', deploymentResult.error!);
      }

      await this.emit('workflow-completed', {
        result: deploymentResult.data,
      });

      return {
        success: true,
        data: deploymentResult.data,
      };
    } catch (error) {
      await this.emit('workflow-failed', { error: String(error) });
      throw error;
    }
  }

  private async handleError(phase: string, error: string): Promise<AgentResult> {
    await this.emit('phase-failed', { phase, error });
    return {
      success: false,
      error: `${phase} phase failed: ${error}`,
    };
  }
}
```

### 3.4 Requirement Agent

```typescript
// agents/requirement.ts
import { BaseAgent, AgentResult } from './base';
import { ChatPromptTemplate } from 'langchain/prompts';
import { LLMChain } from 'langchain/chains';

export class RequirementAgent extends BaseAgent {
  private chain: LLMChain;

  constructor() {
    super({
      name: 'RequirementAgent',
      version: '1.0.0',
      description: '分析需求并生成详细的需求文档',
      capabilities: ['requirement-analysis', 'prd-generation'],
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', `你是一个需求分析专家。你的任务是：
1. 分析用户提供的需求
2. 补充缺失的需求细节
3. 生成详细的PRD文档
4. 识别技术风险和挑战

输出格式为JSON：
{
  "title": "项目标题",
  "description": "项目描述",
  "features": [
    {
      "name": "功能名称",
      "description": "功能描述",
      "priority": "high/medium/low",
      "acceptanceCriteria": ["验收标准1", "验收标准2"]
    }
  ],
  "techRequirements": {
    "frontend": ["技术栈要求"],
    "backend": ["技术栈要求"],
    "database": ["数据库要求"]
  },
  "risks": ["风险1", "风险2"],
  "assumptions": ["假设1", "假设2"]
}`],
      ['user', '{input}'],
    ]);

    this.chain = new LLMChain({
      llm: this.context.llm,
      prompt,
    });
  }

  async execute(input: { goal: string; context?: string }): Promise<AgentResult> {
    try {
      const result = await this.chain.call({
        input: input.goal,
      });

      const requirements = JSON.parse(result.text as string);

      await this.emit('requirement-generated', requirements);
      await this.updateState('requirements', requirements);

      return {
        success: true,
        data: requirements,
        metadata: {
          phase: 'requirement',
          featuresCount: requirements.features.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `需求分析失败: ${String(error)}`,
      };
    }
  }
}
```

### 3.5 Architecture Agent

```typescript
// agents/architecture.ts
import { BaseAgent, AgentResult } from './base';

export class ArchitectureAgent extends BaseAgent {
  async execute(input: unknown): Promise<AgentResult> {
    const requirements = input as any;

    // 调用LLM生成架构设计
    const prompt = this.buildArchitecturePrompt(requirements);
    const response = await this.getLLMResponse(prompt, {
      temperature: 0.7,
    });

    const architecture = this.parseArchitecture(response);

    await this.emit('architecture-generated', architecture);
    await this.updateState('architecture', architecture);

    return {
      success: true,
      data: {
        requirements,
        architecture,
      },
      metadata: {
        phase: 'architecture',
      },
    };
  }

  private buildArchitecturePrompt(requirements: any): string {
    return `基于以下需求，设计系统架构：

需求摘要：
- 标题：${requirements.title}
- 描述：${requirements.description}
- 功能：${requirements.features.map((f: any) => f.name).join(', ')}

请生成：
1. 系统架构图（描述）
2. 技术选型（前端、后端、数据库）
3. API设计
4. 数据库Schema
5. 目录结构

输出JSON格式。`;
  }

  private parseArchitecture(response: string): any {
    return JSON.parse(response);
  }
}
```

### 3.6 Development Agent

```typescript
// agents/development.ts
import { BaseAgent, AgentResult } from './base';
import { codegenService } from '../services/codegen';

export class DevelopmentAgent extends BaseAgent {
  async execute(input: unknown): Promise<AgentResult> {
    const { requirements, architecture } = input as any;

    await this.emit('code-generation-started');

    try {
      // 1. 生成前端代码
      await this.emit('frontend-generation-started');
      const frontendCode = await codegenService.generateFrontend(
        requirements,
        architecture
      );
      await this.emit('frontend-generation-completed', {
        filesCount: frontendCode.files.length,
      });

      // 2. 生成后端代码
      await this.emit('backend-generation-started');
      const backendCode = await codegenService.generateBackend(
        requirements,
        architecture
      );
      await this.emit('backend-generation-completed', {
        filesCount: backendCode.files.length,
      });

      // 3. 生成配置文件
      const configs = await codegenService.generateConfigs(architecture);

      const codebase = {
        frontend: frontendCode,
        backend: backendCode,
        configs,
      };

      await this.emit('code-generation-completed', codebase);
      await this.updateState('codebase', codebase);

      return {
        success: true,
        data: codebase,
        metadata: {
          phase: 'development',
          totalFiles:
            frontendCode.files.length + backendCode.files.length + configs.length,
        },
      };
    } catch (error) {
      await this.emit('code-generation-failed', { error: String(error) });
      return {
        success: false,
        error: `代码生成失败: ${String(error)}`,
      };
    }
  }
}
```

### 3.7 Quality Agent

```typescript
// agents/quality.ts
import { BaseAgent, AgentResult } from './base';
import { validationService } from '../services/validation';

export class QualityAgent extends BaseAgent {
  async execute(input: unknown): Promise<AgentResult> {
    const codebase = input as any;

    await this.emit('quality-check-started');

    const results = await Promise.all([
      // 静态分析
      this.runStaticAnalysis(codebase),
      // 安全扫描
      this.runSecurityScan(codebase),
      // 生成测试
      this.generateTests(codebase),
      // 运行测试
      this.runTests(codebase),
    ]);

    const [
      staticAnalysisResult,
      securityScanResult,
      testGenerationResult,
      testRunResult,
    ] = results;

    const qualityReport = {
      staticAnalysis: staticAnalysisResult,
      securityScan: securityScanResult,
      tests: {
        generated: testGenerationResult.tests,
        passed: testRunResult.passed,
        failed: testRunResult.failed,
        coverage: testRunResult.coverage,
      },
      overallScore: this.calculateOverallScore(
        staticAnalysisResult,
        securityScanResult,
        testRunResult
      ),
    };

    await this.emit('quality-check-completed', qualityReport);
    await this.updateState('quality', qualityReport);

    const isQualityAcceptable = qualityReport.overallScore >= 80;

    return {
      success: isQualityAcceptable,
      data: { codebase, qualityReport },
      error: isQualityAcceptable
        ? undefined
        : `质量分数 ${qualityReport.overallScore}% 低于阈值 80%`,
      metadata: {
        phase: 'quality',
        score: qualityReport.overallScore,
      },
    };
  }

  private async runStaticAnalysis(codebase: any): Promise<any> {
    return await validationService.runStaticAnalysis(codebase);
  }

  private async runSecurityScan(codebase: any): Promise<any> {
    return await validationService.runSecurityScan(codebase);
  }

  private async generateTests(codebase: any): Promise<any> {
    return await validationService.generateTests(codebase);
  }

  private async runTests(codebase: any): Promise<any> {
    return await validationService.runTests(codebase);
  }

  private calculateOverallScore(
    staticAnalysis: any,
    securityScan: any,
    testRun: any
  ): number {
    const staticScore = staticAnalysis.score || 0;
    const securityScore = securityScan.passed ? 100 : 0;
    const testScore = testRun.coverage || 0;

    return Math.round((staticScore + securityScore + testScore) / 3);
  }
}
```

### 3.8 Deployment Agent

```typescript
// agents/deployment.ts
import { BaseAgent, AgentResult } from './base';
import { deploymentService } from '../services/deployment';

export class DeploymentAgent extends BaseAgent {
  async execute(input: unknown): Promise<AgentResult> {
    const { codebase, qualityReport } = input as any;

    await this.emit('deployment-started');

    try {
      // 1. 构建
      await this.emit('build-started');
      const buildResult = await deploymentService.build(codebase);
      await this.emit('build-completed', buildResult);

      // 2. 部署
      await this.emit('deploy-started');
      const deployResult = await deploymentService.deploy(codebase);
      await this.emit('deploy-completed', deployResult);

      // 3. 健康检查
      await this.emit('health-check-started');
      const healthCheck = await deploymentService.healthCheck(deployResult.url);
      await this.emit('health-check-completed', healthCheck);

      if (!healthCheck.healthy) {
        return {
          success: false,
          error: '健康检查失败',
        };
      }

      const deployment = {
        buildResult,
        deployResult,
        healthCheck,
        url: deployResult.url,
      };

      await this.emit('deployment-completed', deployment);
      await this.updateState('deployment', deployment);

      return {
        success: true,
        data: deployment,
        metadata: {
          phase: 'deployment',
          url: deployResult.url,
        },
      };
    } catch (error) {
      await this.emit('deployment-failed', { error: String(error) });
      return {
        success: false,
        error: `部署失败: ${String(error)}`,
      };
    }
  }
}
```

### 3.9 Evolution Agent

```typescript
// agents/evolution.ts
import { BaseAgent, AgentResult } from './base';

export class EvolutionAgent extends BaseAgent {
  async execute(input: unknown): Promise<AgentResult> {
    const deployment = input as any;

    await this.emit('evolution-started');

    try {
      // 1. 收集反馈
      const feedback = await this.collectFeedback(deployment);

      // 2. 分析数据
      const analysis = await this.analyzeFeedback(feedback);

      // 3. 生成优化建议
      const suggestions = await this.generateSuggestions(analysis);

      // 4. 更新知识库
      await this.updateKnowledgeBase(suggestions);

      await this.emit('evolution-completed', suggestions);

      return {
        success: true,
        data: suggestions,
      };
    } catch (error) {
      await this.emit('evolution-failed', { error: String(error) });
      return {
        success: false,
        error: `进化分析失败: ${String(error)}`,
      };
    }
  }

  private async collectFeedback(deployment: any): Promise<any> {
    // 收集用户反馈、错误日志、性能数据等
    return {};
  }

  private async analyzeFeedback(feedback: any): Promise<any> {
    return await this.getLLMResponse(
      `分析以下反馈，识别问题和改进机会：\n${JSON.stringify(feedback)}`
    );
  }

  private async generateSuggestions(analysis: string): Promise<any> {
    return JSON.parse(analysis);
  }

  private async updateKnowledgeBase(suggestions: any): Promise<void> {
    // 更新SQLite中的知识库
  }
}
```

## 4. LangChain抽象层

### 4.1 LLM封装

```typescript
// langchain/llm.ts
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { BaseChatModel } from 'langchain/chat_models/base';

export class LLM {
  private model: BaseChatModel;

  constructor(config: LLMConfig) {
    switch (config.provider) {
      case 'openai':
        this.model = new ChatOpenAI({
          modelName: config.model || 'gpt-4',
          temperature: config.temperature || 0.7,
          maxTokens: config.maxTokens,
          openAIApiKey: config.apiKey,
        });
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    const response = await this.model.call([prompt], {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });

    return response.content as string;
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<Message> {
    const response = await this.model.call(messages, options);
    return response;
  }

  async embedding(text: string): Promise<number[]> {
    // 使用嵌入模型
    return [];
  }
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'azure';
  model?: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

### 4.2 Chain定义

```typescript
// langchain/chains.ts
import { LLMChain } from 'langchain/chains';
import { SequentialChain } from 'langchain/chains/sequential_chain';
import { LLM } from './llm';

export class RequirementChain {
  private chain: LLMChain;

  constructor(llm: LLM) {
    const prompt = `...`; // Prompt模板
    this.chain = new LLMChain({ llm: llm['model'], prompt });
  }

  async run(input: { goal: string }): Promise<any> {
    const result = await this.chain.run(input);
    return JSON.parse(result);
  }
}

export class ArchitectureChain {
  private chain: LLMChain;

  constructor(llm: LLM) {
    const prompt = `...`; // Prompt模板
    this.chain = new LLMChain({ llm: llm['model'], prompt });
  }

  async run(input: any): Promise<any> {
    const result = await this.chain.run(input);
    return JSON.parse(result);
  }
}

export class CodeGenerationChain {
  private chain: LLMChain;

  constructor(llm: LLM) {
    const prompt = `...`; // Prompt模板
    this.chain = new LLMChain({ llm: llm['model'], prompt });
  }

  async run(input: any): Promise<any> {
    const result = await this.chain.run(input);
    return JSON.parse(result);
  }
}
```

## 5. 数据访问层

### 5.1 SQLite数据库

```typescript
// db/sqlite.ts
import Database from 'better-sqlite3';
import { migrate } from './migrations';

export class SQLite {
  private db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  async initialize(): Promise<void> {
    await migrate(this.db);
  }

  async query<T>(
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  async queryOne<T>(
    sql: string,
    params: unknown[] = []
  ): Promise<T | undefined> {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params) as T | undefined;
  }

  async insert(sql: string, params: unknown[]): Promise<number> {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return result.lastInsertRowid as number;
  }

  async update(sql: string, params: unknown[]): Promise<number> {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return result.changes;
  }

  async delete(sql: string, params: unknown[]): Promise<number> {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return result.changes;
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
```

## 5. 任务队列

```typescript
// queue/index.ts
import Bull from 'bull';
import { createProcessor } from './processor';

export interface JobData {
  type: string;
  projectId: string;
  payload: Record<string, unknown>;
}

export function createQueue(redis: Redis): Bull.Queue<JobData> {
  const queue = new Bull('project-generation', {
    redis: {
      host: redis.options.host,
      port: redis.options.port,
    },
    defaultJobOptions: {
      removeOnComplete: 10,
      removeOnFail: 5,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  });

  queue.process(createProcessor());

  return queue;
}
```

---

**版本**: 0.1.0
**更新日期**: 2026-04-14
**状态**: 设计阶段
