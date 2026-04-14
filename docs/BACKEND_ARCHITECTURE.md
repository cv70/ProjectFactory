# 后端架构设计

## 1. 设计目标

后端作为系统的"大脑"和"执行引擎"，需要实现：

- **智能编排**：通过LangGraph实现Agent协作编排
- **持久化存储**：SQLite存储项目、创意、知识等结构化数据
- **全文检索**：SQLite FTS实现知识库的文本检索
- **实时通信**：WebSocket推送系统状态
- **REST API**：提供前端交互接口

## 2. 整体架构

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        表现层 (Presentation)                      │
│  HTTP Routes | WebSocket Handlers | Middleware                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        编排层 (Orchestration)                     │
│  LangGraph State Machine | Workflow Engine | Task Scheduler     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        智能层 (Intelligence)                     │
│  LangChain Agents | LLM Integration | Decision Engine           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        领域层 (Domain)                           │
│  Project | Idea | Knowledge | Metric | Execution               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        存储层 (Storage)                          │
│  SQLite (关系数据 + 全文检索) | File System (项目存储)        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        基础层 (infra)                    │
│  Project Sandbox | Build Environment | Test Environment        │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 目录结构

```
backend/
├── src/
│   ├── main.ts                 # 应用入口
│   │
│   ├── api/                    # API层
│   │   ├── routes/             # 路由定义
│   │   │   ├── system.ts       # 系统相关
│   │   │   ├── projects.ts     # 项目相关
│   │   │   ├── ideas.ts        # 创意相关
│   │   │   ├── knowledge.ts    # 知识库相关
│   │   │   └── monitor.ts      # 监控相关
│   │   ├── controllers/        # 控制器
│   │   ├── middleware/         # 中间件
│   │   │   ├── auth.ts
│   │   │   ├── error.ts
│   │   │   ├── logging.ts
│   │   │   └── validation.ts
│   │   └── websocket/          # WebSocket
│   │       └── handler.ts
│   │
│   ├── orchestration/          # 编排层
│   │   ├── langgraph/          # LangGraph集成
│   │   │   ├── graph-builder.ts
│   │   │   ├── state-management.ts
│   │   │   ├── nodes.ts
│   │   │   └── edges.ts
│   │   ├── scheduler/          # 任务调度
│   │   │   ├── scheduler.ts
│   │   │   ├── task-queue.ts
│   │   │   └── priority-queue.ts
│   │   └── workflow/           # 工作流定义
│   │       ├── project-workflow.ts
│   │       ├── idea-workflow.ts
│   │       └── learning-workflow.ts
│   │
│   ├── agents/                 # Agent层
│   │   ├── base/               # 基础Agent
│   │   │   ├── base-agent.ts
│   │   │   ├── agent-interface.ts
│   │   │   ├── agent-factory.ts
│   │   │   └── types.ts
│   │   ├── meta/               # 元Agent
│   │   │   ├── observer.ts     # 自我观察
│   │   │   ├── optimizer.ts    # 自我优化
│   │   │   └── learner.ts      # 学习者
│   │   ├── idea/               # 创意Agent
│   │   │   ├── generator.ts    # 创意生成
│   │   │   ├── evaluator.ts    # 创意评估
│   │   │   └── trend-analyzer.ts # 趋势分析
│   │   ├── architecture/       # 架构Agent
│   │   │   ├── designer.ts     # 架构设计
│   │   │   └── pattern-recommender.ts
│   │   ├── code/               # 代码Agent
│   │   │   ├── generator.ts    # 代码生成
│   │   │   ├── reviewer.ts     # 代码审查
│   │   │   └── optimizer.ts    # 代码优化
│   │   ├── test/               # 测试Agent
│   │   │   ├── generator.ts    # 测试生成
│   │   │   ├── runner.ts       # 测试执行
│   │   │   └── analyzer.ts     # 结果分析
│   │   ├── deploy/             # 部署Agent
│   │   │   ├── builder.ts      # 构建执行
│   │   │   └── deployer.ts     # 部署管理
│   │   └── monitor/            # 监控Agent
│   │       └── collector.ts    # 数据收集
│   │
│   ├── domain/                 # 领域层
│   │   ├── project/            # 项目领域
│   │   │   ├── schema.ts
│   │   │   ├── repository.ts
│   │   │   └── service.ts
│   │   ├── idea/               # 创意领域
│   │   │   ├── schema.ts
│   │   │   ├── repository.ts
│   │   │   └── service.ts
│   │   ├── knowledge/          # 知识领域
│   │   │   ├── schema.ts
│   │   │   ├── repository.ts
│   │   │   └── service.ts
│   │   ├── execution/          # 执行领域
│   │   │   ├── schema.ts
│   │   │   ├── repository.ts
│   │   │   └── service.ts
│   │   └── metric/             # 指标领域
│   │       ├── schema.ts
│   │       ├── collector.ts
│   │       └── aggregator.ts
│   │
│   ├── infra/         # 基础设施层
│   │   ├── database/           # 数据库
│   │   │   ├── connection.ts
│   │   │   └── migrations/
│   │   ├── llm/                # LLM集成
│   │   │   ├── client.ts
│   │   │   ├── models.ts
│   │   │   ├── prompts.ts
│   │   │   └── cost-tracker.ts
│   │   ├── workspace/          # 工作区管理
│   │   │   ├── manager.ts
│   │   │   ├── sandbox.ts
│   │   │   └── file-ops.ts
│   │   ├── build/              # 构建环境
│   │   │   ├── executor.ts
│   │   │   └── test-runner.ts
│   │   └── storage/            # 存储
│   │       ├── local.ts
│   │       └── archive.ts
│   │
│   ├── config/                 # 配置
│   │   ├── index.ts
│   │   ├── env.ts
│   │   └── validation.ts
│   │
│   ├── utils/                  # 工具
│   │   ├── logger.ts
│   │   ├── retry.ts
│   │   ├── metrics.ts
│   │   └── errors.ts
│   │
│   └── types/                  # 类型
│       ├── common.ts
│       ├── project.ts
│       ├── agent.ts
│       └── knowledge.ts
│
├── drizzle/                    # Drizzle配置
│   ├── schema.ts               # 数据库表定义
│   └── config.ts               # Drizzle配置
│
├── tests/                      # 测试
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── data/                       # 数据目录
│   └── project-factory.db      # SQLite数据库
│
├── projects/                   # 生成项目存储
│   ├── active/
│   ├── completed/
│   └── archived/
│
└── package.json
```

## 3. 核心组件设计

### 3.1 LangGraph状态机

```typescript
// 项目生成状态
interface ProjectGenerationState {
  // 项目标识
  projectId?: string;
  ideaId: string;

  // 数据对象
  idea: Idea;
  project?: Project;
  architecture?: Architecture;
  code?: GeneratedCode;
  tests?: GeneratedTests;
  testResults?: TestResults;
  review?: CodeReview;
  deployment?: DeploymentInfo;

  // 执行状态
  currentStage: ProjectStage;
  step: number;
  totalSteps: number;
  progress: number; // 0-100

  // 迭代信息
  iterationCount: number;
  maxIterations: number;
  qualityScore: number;

  // 错误处理
  errors: ExecutionError[];
  retryCount: number;

  // 元数据
  metadata: Record<string, unknown>;
  startTime: number;
  lastUpdate: number;
}

// 项目阶段
type ProjectStage =
  | 'ideation'        // 创意生成
  | 'architecture'    // 架构设计
  | 'coding'          // 代码生成
  | 'testing'         // 测试生成
  | 'review'          // 代码审查
  | 'optimizing'      // 优化迭代
  | 'building'        // 构建打包
  | 'deploying'       // 部署
  | 'completed'       // 完成
  | 'failed';         // 失败
```

### 3.2 LangGraph图定义

```typescript
// 创建项目生成图
export function createProjectGenerationGraph(): StateGraph<ProjectGenerationState> {
  const graph = new StateGraph<ProjectGenerationState>({
    channels: {
      projectId: null,
      ideaId: { value: (x, y) => y ?? x },
      idea: { value: (x) => x },
      project: null,
      architecture: null,
      code: null,
      tests: null,
      testResults: null,
      review: null,
      deployment: null,
      currentStage: null,
      step: { value: (x) => (x ?? 0) + 1, default: 0 },
      totalSteps: { value: () => 10, default: 10 },
      progress: null,
      iterationCount: { value: (x) => x ?? 0, default: 0 },
      maxIterations: { value: () => 3, default: 3 },
      qualityScore: null,
      errors: { value: (x, y) => [...(x ?? []), ...(y ?? [])], default: () => [] },
      retryCount: { value: (x) => x ?? 0, default: 0 },
      metadata: { value: (x, y) => ({ ...(x ?? {}), ...(y ?? {}) }), default: () => ({}) },
      startTime: null,
      lastUpdate: null,
    },
  });

  // 添加节点
  graph.addNode('ideation', ideationNode);
  graph.addNode('architecture', architectureNode);
  graph.addNode('coding', codingNode);
  graph.addNode('testing', testingNode);
  graph.addNode('review', reviewNode);
  graph.addNode('quality-gate', qualityGateNode);
  graph.addNode('optimizing', optimizingNode);
  graph.addNode('building', buildingNode);
  graph.addNode('deploying', deployingNode);
  graph.addNode('error', errorNode);

  // 添加边
  graph.setEntryPoint('ideation');

  graph.addEdge('ideation', 'architecture');
  graph.addEdge('architecture', 'coding');
  graph.addEdge('coding', 'testing');
  graph.addEdge('testing', 'review');
  graph.addConditionalEdges(
    'review',
    shouldOptimize,
    {
      optimize: 'optimizing',
      build: 'building',
    }
  );
  graph.addEdge('optimizing', 'coding'); // 优化后回到编码
  graph.addEdge('building', 'deploying');
  graph.addEdge('deploying', END);

  // 错误处理
  graph.addConditionalEdges(
    ['ideation', 'architecture', 'coding', 'testing', 'review', 'building', 'deploying'],
    hasError,
    {
      error: 'error',
      continue: null, // 继续正常流程
    }
  );

  return graph.compile();
}

// 条件函数
function shouldOptimize(state: ProjectGenerationState): 'optimize' | 'build' {
  const config = getConfig();
  if (state.qualityScore < config.quality.minQualityScore) {
    return 'optimize';
  }
  if (state.iterationCount < state.maxIterations && state.qualityScore < 90) {
    return 'optimize';
  }
  return 'build';
}

function hasError(state: ProjectGenerationState): 'error' | 'continue' {
  if (state.errors.length > 0 && state.retryCount >= 3) {
    return 'error';
  }
  return 'continue';
}
```

### 3.3 基础Agent类

```typescript
// Agent基类
export abstract class BaseAgent<TInput = unknown, TOutput = unknown> {
  protected readonly llm: ChatOpenAI;
  protected readonly logger: Logger;
  protected readonly knowledgeBase: KnowledgeBase;

  constructor(
    protected config: AgentConfig,
    dependencies: AgentDependencies
  ) {
    this.llm = new ChatOpenAI({
      modelName: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      timeout: config.timeout,
    });
    this.logger = dependencies.logger;
    this.knowledgeBase = dependencies.knowledgeBase;
  }

  // 执行Agent
  async execute(
    input: TInput,
    context: ExecutionContext
  ): Promise<AgentResult<TOutput>> {
    const startTime = Date.now();
    const metrics: AgentMetrics = {
      executionTime: 0,
      llmCalls: 0,
      tokensUsed: 0,
      cost: 0,
    };

    try {
      // 检索相关知识
      const relevantKnowledge = await this.retrieveKnowledge(input, context);
      context.metadata.knowledge = relevantKnowledge;

      // 执行LLM调用
      const result = await this.invokeLLM(input, context, metrics);

      // 验证输出
      const validated = await this.validateOutput(result);

      // 提取新知识
      if (validated.success) {
        await this.extractKnowledge(validated.data, context);
      }

      metrics.executionTime = Date.now() - startTime;

      return {
        success: validated.success,
        data: validated.data,
        error: validated.error,
        metrics,
      };
    } catch (error) {
      this.logger.error(`${this.name} failed`, { error, input });
      metrics.executionTime = Date.now() - startTime;

      return {
        success: false,
        error: error as Error,
        metrics,
      };
    }
  }

  // 子类实现
  protected abstract getSystemPrompt(): string;
  protected abstract getInputSchema(): z.ZodType<TOutput>;
  protected abstract prepareInput(input: TInput, context: ExecutionContext): Record<string, unknown>;

  // 知识检索
  protected async retrieveKnowledge(
    input: TInput,
    context: ExecutionContext
  ): Promise<KnowledgeItem[]> {
    const query = this.buildQuery(input, context);
    return this.knowledgeBase.search(query, { limit: 5 });
  }

  // LLM调用
  protected async invokeLLM(
    input: TInput,
    context: ExecutionContext,
    metrics: AgentMetrics
  ): Promise<TOutput> {
    const prompt = this.buildPrompt(input, context);
    const schema = this.getInputSchema();

    const structuredLLM = this.llm.withStructuredOutput(schema);
    const result = await structuredLLM.invoke(prompt);

    // 追踪token使用
    metrics.llmCalls++;
    metrics.tokensUsed += result.usage?.totalTokens || 0;
    metrics.cost += this.calculateCost(result.usage);

    return result;
  }

  // 知识提取
  protected async extractKnowledge(
    output: TOutput,
    context: ExecutionContext
  ): Promise<void> {
    const extractor = new KnowledgeExtractor(this.knowledgeBase);
    await extractor.extract(output, {
      agent: this.name,
      project: context.projectId,
      timestamp: Date.now(),
    });
  }

  protected abstract buildQuery(input: TInput, context: ExecutionContext): string;
  protected abstract buildPrompt(input: TInput, context: ExecutionContext): string;
  protected abstract validateOutput(output: TOutput): Promise<ValidationResult<TOutput>>;

  protected calculateCost(usage?: { promptTokens: number; completionTokens: number }): number {
    if (!usage) return 0;
    // 根据模型定价计算成本
    const pricing = MODEL_PRICING[this.config.model];
    return (usage.promptTokens * pricing.input + usage.completionTokens * pricing.output) / 1000;
  }
}
```

### 3.4 知识库集成

```typescript
// SQLite FTS知识库
export class SQLiteKnowledgeBase implements KnowledgeBase {
  private db: Database;

  constructor(config: SQLiteConfig) {
    this.db = new Database(config.path);
  }

  // 初始化全文检索表
  async initialize(): Promise<void> {
    await this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts
      USING fts5(
        title,
        content,
        type,
        source,
        metadata,
        tokenize = "porter unicode61"
      );

      CREATE TABLE IF NOT EXISTS knowledge (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT,
        metadata TEXT,
        usage_count INTEGER DEFAULT 0,
        last_used_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  // 搜索知识
  async search(
    query: string,
    options: { type?: string; limit?: number; threshold?: number }
  ): Promise<KnowledgeItem[]> {
    const limit = options.limit || 5;
    const typeFilter = options.type ? `AND type = '${options.type}'` : '';

    const results = await this.db.all(`
      SELECT
        k.id,
        k.type,
        k.title,
        k.content,
        k.source,
        k.metadata,
        k.usage_count,
        k.last_used_at,
        bm25(knowledge_fts) as score
      FROM knowledge k
      INNER JOIN knowledge_fts fts ON k.id = fts.id
      WHERE knowledge_fts MATCH ? ${typeFilter}
      ORDER BY score
      LIMIT ?
    `, [query, limit]);

    return results.map(r => ({
      id: r.id,
      type: r.type,
      title: r.title,
      content: r.content,
      source: r.source,
      metadata: JSON.parse(r.metadata || '{}'),
      score: r.score,
      usageCount: r.usage_count,
      lastUsedAt: r.last_used_at,
    }));
  }

  // 添加知识
  async add(knowledge: KnowledgeInput): Promise<string> {
    const id = generateId();
    const now = Date.now();

    await this.db.run(`
      INSERT INTO knowledge (id, type, title, content, source, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, knowledge.type, knowledge.title, knowledge.content,
        knowledge.source, JSON.stringify(knowledge.metadata), now, now]);

    await this.db.run(`
      INSERT INTO knowledge_fts (id, title, content, type, source, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, knowledge.title, knowledge.content, knowledge.type,
        knowledge.source, JSON.stringify(knowledge.metadata)]);

    return id;
  }

  // 更新使用计数
  async recordUsage(id: string): Promise<void> {
    await this.db.run(`
      UPDATE knowledge
      SET usage_count = usage_count + 1,
          last_used_at = ?,
          updated_at = ?
      WHERE id = ?
    `, [Date.now(), Date.now(), id]);
  }
}
```

### 3.5 SQLite数据模型

```typescript
// 核心表定义
export const schema = {
  // 项目表
  projects: sqliteTable('projects', {
    id: text('id').primaryKey(),
    ideaId: text('idea_id').notNull().references(() => ideas.id),
    name: text('name').notNull(),
    description: text('description'),
    type: text('type', { enum: ['web-app', 'cli-tool', 'library', 'api-service'] }),
    status: text('status', {
      enum: ['pending', 'generating', 'testing', 'building', 'completed', 'failed']
    }).default('pending'),
    stage: text('stage'),
    progress: integer('progress').default(0),
    qualityScore: integer('quality_score').default(0),
    testCoverage: integer('test_coverage').default(0),
    buildSuccess: integer('build_success', { mode: 'boolean' }).default(false),
    path: text('path'),
    gitRepo: text('git_repo'),
    version: text('version').default('0.1.0'),
    iterationCount: integer('iteration_count').default(0),
    createdAt: integer('created_at').notNull(),
    completedAt: integer('completed_at'),
    error: text('error'),
    metadata: text('metadata', { mode: 'json' }),
  }),

  // 创意表
  ideas: sqliteTable('ideas', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    type: text('type', { enum: ['web-app', 'cli-tool', 'library', 'api-service'] }),
    complexity: text('complexity', { enum: ['low', 'medium', 'high'] }),
    valueScore: integer('value_score'),
    status: text('status', {
      enum: ['pending', 'queued', 'accepted', 'rejected', 'in_progress', 'completed', 'failed']
    }).default('pending'),
    priority: integer('priority').default(5),
    features: text('features', { mode: 'json' }).$type<string[]>(),
    techStack: text('tech_stack', { mode: 'json' }).$type<string[]>(),
    createdAt: integer('created_at').notNull(),
    pickedAt: integer('picked_at'),
    completedAt: integer('completed_at'),
    metadata: text('metadata', { mode: 'json' }),
  }),

  // 执行记录表
  executions: sqliteTable('executions', {
    id: text('id').primaryKey(),
    projectId: text('project_id').references(() => projects.id),
    agent: text('agent').notNull(),
    stage: text('stage').notNull(),
    status: text('status', { enum: ['running', 'completed', 'failed'] }),
    input: text('input', { mode: 'json' }),
    output: text('output', { mode: 'json' }),
    llmCalls: integer('llm_calls').default(0),
    tokensUsed: integer('tokens_used').default(0),
    cost: real('cost').default(0),
    duration: integer('duration'),
    error: text('error'),
    createdAt: integer('created_at').notNull(),
    completedAt: integer('completed_at'),
  }),

  // 知识表（全文检索）
  knowledge: sqliteTable('knowledge', {
    id: text('id').primaryKey(),
    type: text('type', {
      enum: ['pattern', 'template', 'best-practice', 'failure', 'decision']
    }).notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    source: text('source'),
    metadata: text('metadata', { mode: 'json' }),
    usageCount: integer('usage_count').default(0),
    lastUsedAt: integer('last_used_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  }),

  // 系统指标表
  metrics: sqliteTable('metrics', {
    id: text('id').primaryKey(),
    timestamp: integer('timestamp').notNull(),
    // 项目统计
    totalProjects: integer('total_projects').default(0),
    activeProjects: integer('active_projects').default(0),
    completedProjects: integer('completed_projects').default(0),
    failedProjects: integer('failed_projects').default(0),
    // 创意统计
    totalIdeas: integer('total_ideas').default(0),
    queuedIdeas: integer('queued_ideas').default(0),
    // LLM统计
    llmCalls: integer('llm_calls').default(0),
    tokensUsed: integer('tokens_used').default(0),
    totalCost: real('total_cost').default(0),
    // 资源统计
    cpuUsage: real('cpu_usage'),
    memoryUsage: real('memory_usage'),
    diskUsage: real('disk_usage'),
  }),

  // 系统配置表
  config: sqliteTable('config', {
    id: text('id').primaryKey(),
    key: text('key').notNull().unique(),
    value: text('value', { mode: 'json' }).notNull(),
    description: text('description'),
    updatedAt: integer('updated_at').notNull(),
  }),
};
```

## 4. API设计

### 4.1 REST API端点

```typescript
// 系统相关
GET    /api/system/status          // 获取系统状态
POST   /api/system/start           // 启动系统
POST   /api/system/stop            // 停止系统
GET    /api/system/metrics         // 获取系统指标
GET    /api/system/config          // 获取配置
PUT    /api/system/config          // 更新配置

// 项目相关
GET    /api/projects               // 获取项目列表
GET    /api/projects/:id           // 获取项目详情
POST   /api/projects               // 创建项目（从创意）
DELETE /api/projects/:id           // 删除项目
POST   /api/projects/:id/retry     // 重试失败项目
POST   /api/projects/:id/cancel    // 取消项目
GET    /api/projects/:id/logs      // 获取项目日志
GET    /api/projects/:id/code      // 获取项目代码

// 创意相关
GET    /api/ideas                  // 获取创意列表
GET    /api/ideas/:id              // 获取创意详情
POST   /api/ideas/generate         // 生成新创意
POST   /api/ideas/:id/accept       // 接受创意
POST   /api/ideas/:id/reject       // 拒绝创意
DELETE /api/ideas/:id              // 删除创意

// 知识库相关
GET    /api/knowledge/search       // 搜索知识
GET    /api/knowledge              // 获取知识列表
GET    /api/knowledge/:id          // 获取知识详情
POST   /api/knowledge              // 添加知识
PUT    /api/knowledge/:id          // 更新知识
DELETE /api/knowledge/:id          // 删除知识
POST   /api/knowledge/sync         // 同步知识库

// 监控相关
GET    /api/monitor/agents         // 获取Agent状态
GET    /api/monitor/llm            // 获取LLM统计
GET    /api/monitor/resources      // 获取资源使用
GET    /api/monitor/trends         // 获取趋势数据
```

### 4.2 WebSocket事件

```typescript
// 客户端 → 服务器
{
  type: 'subscribe',
  channels: ['projects', 'ideas', 'metrics', 'agents']
}

{
  type: 'command',
  command: 'start' | 'stop' | 'pause' | 'resume',
  params?: Record<string, unknown>
}

// 服务器 → 客户端
{
  type: 'system:status',
  data: {
    isRunning: boolean,
    activeProjects: number,
    currentStage: string
  }
}

{
  type: 'project:created',
  data: Project
}

{
  type: 'project:progress',
  data: {
    projectId: string,
    stage: string,
    progress: number,
    message: string
  }
}

{
  type: 'project:completed',
  data: {
    projectId: string,
    qualityScore: number,
    duration: number
  }
}

{
  type: 'project:failed',
  data: {
    projectId: string,
    error: string,
    stage: string
  }
}

{
  type: 'idea:generated',
  data: Idea
}

{
  type: 'agent:started',
  data: {
    agent: string,
    projectId: string,
    stage: string
  }
}

{
  type: 'agent:completed',
  data: {
    agent: string,
    projectId: string,
    duration: number,
    tokensUsed: number
  }
}

{
  type: 'metrics:update',
  data: SystemMetrics
}
```

## 5. 调度器设计

```typescript
// 任务调度器
class TaskScheduler {
  private queues: Map<string, PriorityQueue<Task>>;
  private workers: Map<string, Worker[]>;
  private maxWorkers = 5;

  // 添加任务
  async enqueue(task: Task): Promise<void> {
    const queue = this.getQueue(task.type);
    queue.enqueue(task, task.priority);
    this.notifyWorkers();
  }

  // 获取任务
  async dequeue(type?: string): Promise<Task | null> {
    const queue = this.getQueue(type);
    return queue.dequeue();
  }

  // 启动工作线程
  async startWorkers(count?: number): Promise<void> {
    const workerCount = count || this.maxWorkers;

    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(this);
      await worker.start();
      this.workers.set(`worker-${i}`, worker);
    }
  }

  // 停止工作线程
  async stopWorkers(): Promise<void> {
    for (const [id, worker] of this.workers) {
      await worker.stop();
      this.workers.delete(id);
    }
  }

  // 获取队列状态
  getStatus(): QueueStatus {
    return {
      queues: Array.from(this.queues.entries()).map(([type, queue]) => ({
        type,
        size: queue.size,
        processing: queue.processing,
      })),
      workers: {
        total: this.workers.size,
        active: Array.from(this.workers.values()).filter(w => w.isActive).length,
      },
    };
  }
}

// 工作线程
class Worker {
  private active = false;
  private currentTask: Task | null = null;

  constructor(private scheduler: TaskScheduler) {}

  async start(): Promise<void> {
    this.active = true;
    this.process();
  }

  async stop(): Promise<void> {
    this.active = false;
    await this.currentTask?.cancel();
  }

  get isActive(): boolean {
    return this.active && this.currentTask !== null;
  }

  private async process(): Promise<void> {
    while (this.active) {
      try {
        const task = await this.scheduler.dequeue();
        if (!task) {
          await sleep(1000);
          continue;
        }

        this.currentTask = task;
        await this.executeTask(task);
        this.currentTask = null;
      } catch (error) {
        this.currentTask = null;
      }
    }
  }

  private async executeTask(task: Task): Promise<void> {
    const executor = this.getExecutor(task.type);
    await executor.execute(task);
  }
}
```

## 6. 监控与日志

### 6.1 结构化日志

```typescript
// 日志配置
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

// 使用示例
logger.info({ project: 'task-manager', stage: 'coding' }, 'Starting code generation');
logger.error({ error: e, project: 'api-gateway' }, 'Build failed');
logger.debug({ agent: 'Architect', input }, 'Agent execution started');
```

### 6.2 指标收集

```typescript
// 指标收集器
class MetricsCollector {
  private metrics: Map<string, Metric>;

  // 记录指标
  record(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags);
    const metric = this.metrics.get(key) || {
      name,
      tags: tags || {},
      values: [],
    };
    metric.values.push({ value, timestamp: Date.now() });
    this.metrics.set(key, metric);
  }

  // 获取指标摘要
  getSummary(name: string, tags?: Record<string, string>): MetricSummary {
    const key = this.buildKey(name, tags);
    const metric = this.metrics.get(key);
    if (!metric) return null;

    const values = metric.values.map(v => v.value);
    return {
      name,
      tags: metric.tags,
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      latest: values[values.length - 1],
    };
  }
}
```

## 7. 错误处理与恢复

```typescript
// 错误分类
enum ErrorType {
  Network = 'network',
  LLMTimeout = 'llm_timeout',
  LLMRateLimit = 'llm_rate_limit',
  ValidationError = 'validation',
  BuildError = 'build',
  TestFailure = 'test_failure',
  SystemError = 'system',
}

// 错误处理器
class ErrorHandler {
  private retryStrategies: Map<ErrorType, RetryStrategy>;

  constructor() {
    this.retryStrategies = new Map([
      [ErrorType.Network, { maxRetries: 3, backoff: 'exponential' }],
      [ErrorType.LLMTimeout, { maxRetries: 3, backoff: 'linear' }],
      [ErrorType.LLMRateLimit, { maxRetries: 5, backoff: 'exponential', delay: 60000 }],
    ]);
  }

  // 处理错误
  async handle(error: Error, context: ExecutionContext): Promise<ErrorResult> {
    const errorType = this.classifyError(error);
    const strategy = this.retryStrategies.get(errorType);

    if (strategy && context.retryCount < strategy.maxRetries) {
      return { shouldRetry: true, delay: this.calculateDelay(strategy, context.retryCount) };
    }

    await this.logError(error, context);
    await this.notifyError(error, context);

    return { shouldRetry: false };
  }

  private classifyError(error: Error): ErrorType {
    // 根据错误信息分类
  }

  private calculateDelay(strategy: RetryStrategy, retryCount: number): number {
    switch (strategy.backoff) {
      case 'exponential':
        return 1000 * Math.pow(2, retryCount);
      case 'linear':
        return 1000 * (retryCount + 1);
      default:
        return 0;
    }
  }
}
```

## 8. 部署配置

### 8.1 环境变量

```env
# 服务器
PORT=8888
HOST=0.0.0.0

# 数据库
DATABASE_PATH=./data/project-factory.db

# LLM
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=4096

# 工作区
WORKSPACE_ROOT=./projects
WORKSPACE_ACTIVE=./projects/active
WORKSPACE_COMPLETED=./projects/completed
WORKSPACE_ARCHIVED=./projects/archived

# 调度
MAX_CONCURRENT_PROJECTS=5
IDEA_GENERATION_INTERVAL=60000

# 日志
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# WebSocket
WS_HEARTBEAT_INTERVAL=30000
```

### 8.2 PM2配置

```json
{
  "name": "project-factory",
  "script": "dist/main.js",
  "instances": 1,
  "exec_mode": "fork",
  "env": {
    "NODE_ENV": "production"
  },
  "error_file": "./logs/error.log",
  "out_file": "./logs/out.log",
  "log_date_format": "YYYY-MM-DD HH:mm:ss",
  "merge_logs": true,
  "max_memory_restart": "2G",
  "autorestart": true,
  "watch": false,
  "ignore_watch": ["node_modules", "logs", "data", "projects"]
}
```
