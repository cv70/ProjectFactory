# 数据流设计

## 1. 概述

数据流设计描述系统中数据的流动路径、转换过程和存储位置。理解数据流对于构建可靠的系统至关重要。

## 2. 核心数据流

### 2.1 项目生成完整数据流

```
┌─────────────────────────────────────────────────────────────────┐
│                       项目生成数据流                              │
└─────────────────────────────────────────────────────────────────┘

  [外部输入]
      ↓
  ┌─────────────┐    [市场数据]    [历史项目]    [用户反馈]
  │ 趋势分析器   │ ←─────────────←─────────────←────────────
  └─────────────┘
      ↓
  ┌─────────────┐    [分析结果]           [知识库检索]
  │ 创意生成器   │ ←──────────────────────────────
  └─────────────┘
      ↓
  ┌─────────────┐    [创意对象]            [相似创意]
  │ 价值评估器   │ ←──────────────────────────────
  └─────────────┘
      ↓
  ┌─────────────┐    [已接受创意]          [架构模式]
  │ 架构设计器   │ ←──────────────────────────────
  └─────────────┘
      ↓
  ┌─────────────┐    [架构方案]            [代码模板]
  │ 代码生成器   │ ←──────────────────────────────
  └─────────────┘
      ↓
  ┌─────────────┐    [源代码]              [测试模式]
  │ 测试生成器   │ ←──────────────────────────────
  └─────────────┘
      ↓
  ┌─────────────┐    [测试代码]            [执行环境]
  │ 测试执行器   │ ←──────────────────────────────
  └─────────────┘
      ↓
  ┌─────────────┐    [测试结果]            [审查规则]
  │ 代码审查器   │ ←──────────────────────────────
  └─────────────┘
      ↓
  ┌─────────────┐    [质量分数]
  │ 质量门禁     │ ────[通过]──→ 部署流程
  └─────────────┘       ↓
                   [未通过]
                      ↓
              ┌─────────────┐
              │ 优化器      │ ──┐
              └─────────────┘   │
                     ↑         │
                     └─────────┘
                   (迭代循环)
```

### 2.2 数据流状态机

```typescript
// 项目生成状态转换
interface ProjectStateTransition {
  from: ProjectStage;
  to: ProjectStage;
  trigger: Trigger;
  dataTransform: DataTransform;
  storageActions: StorageAction[];
}

const PROJECT_STATE_TRANSITIONS: ProjectStateTransition[] = [
  {
    from: 'pending',
    to: 'ideation',
    trigger: 'idea_picked',
    dataTransform: (idea: Idea) => ({
      projectId: generateId(),
      ideaId: idea.id,
      stage: 'ideation',
      startTime: Date.now(),
    }),
    storageActions: [
      { type: 'insert', table: 'projects', data: 'transformed' },
      { type: 'update', table: 'ideas', data: { status: 'in_progress' } },
    ],
  },
  {
    from: 'ideation',
    to: 'architecture',
    trigger: 'architecture_completed',
    dataTransform: (architecture: Architecture) => ({
      architecture,
      stage: 'architecture',
      progress: 20,
    }),
    storageActions: [
      { type: 'update', table: 'projects', data: 'transformed' },
      { type: 'insert', table: 'knowledge', data: 'architecture_patterns' },
    ],
  },
  // ... 更多状态转换
];
```

## 3. 数据模型定义

### 3.1 核心数据模型

```typescript
// 创意模型
interface Idea {
  id: string;
  title: string;
  description: string;
  type: ProjectType;
  complexity: Complexity;
  valueScore: number;
  status: IdeaStatus;
  priority: number;
  features: string[];
  techStack: string[];
  targetAudience: string;
  createdAt: number;
  pickedAt?: number;
  completedAt?: number;
  metadata: {
    source?: string;
    similarIdeas?: string[];
    marketTrends?: string[];
    generatedBy?: string;
  };
}

// 项目模型
interface Project {
  id: string;
  ideaId: string;
  name: string;
  description: string;
  type: ProjectType;
  status: ProjectStatus;
  stage: ProjectStage;
  progress: number; // 0-100
  qualityScore: number;
  testCoverage: number;
  buildSuccess: boolean;
  path: string;
  gitRepo?: string;
  version: string;
  iterationCount: number;
  createdAt: number;
  completedAt?: number;
  architecture?: Architecture;
  structure?: ProjectStructure;
  error?: string;
  metadata: {
    generatedBy?: string;
    totalTokens?: number;
    totalCost?: number;
    duration?: number;
  };
}

// 执行记录模型
interface ExecutionRecord {
  id: string;
  projectId?: string;
  ideaId?: string;
  agent: string;
  stage: string;
  status: ExecutionStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  llmCalls: number;
  tokensUsed: number;
  cost: number;
  duration: number;
  error?: string;
  createdAt: number;
  completedAt?: number;
  metadata: {
    retryCount?: number;
    knowledgeUsed?: string[];
  };
}

// 知识模型
interface Knowledge {
  id: string;
  type: KnowledgeType;
  title: string;
  content: string;
  category?: string;
  tags: string[];
  source: 'generated' | 'imported' | 'learned';
  sourceProject?: string;
  sourceAgent?: string;
  embedding?: number[];
  usageCount: number;
  quality: number; // 0-100
  lastUsedAt?: number;
  createdAt: number;
  updatedAt: number;
  metadata: {
    language?: string;
    framework?: string;
    complexity?: string;
    useCase?: string[];
  };
}
```

### 3.2 流式数据模型

```typescript
// WebSocket流式事件
interface StreamEvent {
  id: string;
  type: StreamEventType;
  timestamp: number;
  data: StreamEventData;
  metadata?: Record<string, unknown>;
}

type StreamEventType =
  | 'agent:start'
  | 'agent:progress'
  | 'agent:complete'
  | 'agent:error'
  | 'llm:call'
  | 'llm:response'
  | 'file:created'
  | 'file:updated'
  | 'test:run'
  | 'test:result'
  | 'build:start'
  | 'build:complete'
  | 'metric:update'
  | 'log:line';

// 实时进度流
interface ProgressStream {
  projectId: string;
  stage: ProjectStage;
  progress: number;
  message: string;
  timestamp: number;
  details?: {
    currentFile?: string;
    totalFiles?: number;
    completedFiles?: number;
    currentStep?: string;
    totalSteps?: number;
  };
}

// LLM调用流
interface LLMStream {
  agent: string;
  model: string;
  prompt: string;
  response: string | null;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost: number;
  duration: number;
  timestamp: number;
}
```

## 4. 知识流转设计

### 4.1 知识生命周期

```
┌─────────────────────────────────────────────────────────────────┐
│                        知识生命周期                                │
└─────────────────────────────────────────────────────────────────┘

  [生成阶段]
  ┌─────────────┐    Agent执行    ┌─────────────┐
  │ 项目执行     │ ─────────────→ │ 原始数据     │
  └─────────────┘                 └─────────────┘
                                      ↓
  ┌─────────────┐    提取模式    ┌─────────────┐
  │ 知识提取器   │ ─────────────→ │ 知识候选项   │
  └─────────────┘                 └─────────────┘
                                      ↓
  ┌─────────────┐    质量评估    ┌─────────────┐
  │ 知识评估器   │ ─────────────→ │ 知识验证     │
  └─────────────┘                 └─────────────┘
                                      ↓
  [存储阶段]
  ┌─────────────┐    格式化     ┌─────────────┐
  │ 知识格式化   │ ─────────────→ │ 结构化知识   │
  └─────────────┘                 └─────────────┘
                                      ↓
  ┌─────────────┐    存储索引    ┌─────────────┐
  │ 知识存储器   │ ─────────────→ │ SQLite      │
  └─────────────┘                 └─────────────┘
                                      ↓
  [使用阶段]
  ┌─────────────┐    文本检索    ┌─────────────┐
  │ 查询处理器   │ ─────────────→ │ 匹配知识     │
  └─────────────┘                 └─────────────┘
                                      ↓
  ┌─────────────┐    知识应用    ┌─────────────┐
  │ Agent决策    │ ─────────────→ │ 改进输出     │
  └─────────────┘                 └─────────────┘
                                      ↓
  [优化阶段]
  ┌─────────────┐    使用追踪    ┌─────────────┐
  │ 使用分析器   │ ─────────────→ │ 使用统计     │
  └─────────────┘                 └─────────────┘
                                      ↓
  ┌─────────────┐    质量反馈    ┌─────────────┐
  │ 知识优化器   │ ─────────────→ │ 知识更新     │
  └─────────────┘                 └─────────────┘
```

### 4.2 知识提取流程

```typescript
// 知识提取器
class KnowledgeExtractor {
  private extractors: Map<KnowledgeType, KnowledgeExtractorStrategy>;

  // 从Agent输出中提取知识
  async extract(
    output: AgentOutput,
    context: ExtractionContext
  ): Promise<KnowledgeExtraction[]> {
    const extractions: KnowledgeExtraction[] = [];

    // 1. 提取架构模式
    if (context.agent === 'Architect') {
      const patterns = await this.extractArchitecturalPatterns(output);
      extractions.push(...patterns);
    }

    // 2. 提取代码模式
    if (context.agent === 'Coder') {
      const patterns = await this.extractCodePatterns(output);
      extractions.push(...patterns);
    }

    // 3. 提取测试模式
    if (context.agent === 'Tester') {
      const patterns = await this.extractTestPatterns(output);
      extractions.push(...patterns);
    }

    // 4. 提取决策经验
    const decisions = await this.extractDecisions(output, context);
    extractions.push(...decisions);

    // 5. 提取失败教训
    if (output.success === false) {
      const failures = await this.extractFailures(output, context);
      extractions.push(...failures);
    }

    return extractions;
  }

  // 提取架构模式
  private async extractArchitecturalPatterns(
    output: ArchitectureOutput
  ): Promise<KnowledgeExtraction[]> {
    const patterns: KnowledgeExtraction[] = [];

    // 提取设计模式
    const designPatterns = this.detectDesignPatterns(output.architecture);
    for (const pattern of designPatterns) {
      patterns.push({
        type: 'pattern',
        title: `${pattern.name} Pattern`,
        content: pattern.description,
        category: 'architecture',
        tags: ['pattern', 'architecture', pattern.name],
        quality: this.assessQuality(pattern),
      });
    }

    // 提取目录结构模式
    if (output.structure) {
      patterns.push({
        type: 'template',
        title: `${output.projectType} Project Structure`,
        content: JSON.stringify(output.structure),
        category: 'structure',
        tags: ['template', 'structure', output.projectType],
        quality: 80,
      });
    }

    return patterns;
  }

  // 提取代码模式
  private async extractCodePatterns(
    output: CodeOutput
  ): Promise<KnowledgeExtraction[]> {
    const patterns: KnowledgeExtraction[] = [];

    for (const file of output.files) {
      // 提取函数模式
      const functions = this.extractFunctions(file.content);
      for (const func of functions) {
        if (this.isReusablePattern(func)) {
          patterns.push({
            type: 'pattern',
            title: `${func.name} Pattern`,
            content: func.code,
            category: 'code',
            tags: ['pattern', 'function', file.language],
            quality: this.assessFunctionQuality(func),
          });
        }
      }

      // 提取错误处理模式
      const errorHandlers = this.extractErrorHandlers(file.content);
      for (const handler of errorHandlers) {
        patterns.push({
          type: 'best-practice',
          title: 'Error Handling Pattern',
          content: handler.code,
          category: 'error-handling',
          tags: ['best-practice', 'error', file.language],
          quality: 75,
        });
      }
    }

    return patterns;
  }

  // 提取决策经验
  private async extractDecisions(
    output: AgentOutput,
    context: ExtractionContext
  ): Promise<KnowledgeExtraction[]> {
    const decisions: KnowledgeExtraction[] = [];

    // 分析技术选型决策
    if (context.agent === 'Architect' && output.techStack) {
      for (const tech of output.techStack) {
        decisions.push({
          type: 'decision',
          title: `Tech Stack: ${tech}`,
          content: `Selected ${tech} for ${context.projectType} based on: ${output.rationale}`,
          category: 'tech-stack',
          tags: ['decision', 'tech-stack', tech],
          quality: 70,
        });
      }
    }

    return decisions;
  }
}
```

### 4.3 知识检索与使用

```typescript
// 知识检索器
class KnowledgeRetriever {
  private db: Database;
  private cache: Map<string, CachedKnowledge>;

  // 文本检索
  async search(
    query: string,
    options: SearchOptions
  ): Promise<KnowledgeItem[]> {
    // 1. 检查缓存
    const cacheKey = this.buildCacheKey(query, options);
    const cached = this.cache.get(cacheKey);
    if (cached && !this.isExpired(cached)) {
      return cached.items;
    }

    // 2. 构建查询条件
    const conditions = this.buildConditions(options);

    // 3. 全文检索
    const results = await this.db.query(
      'SELECT * FROM knowledge_items WHERE content MATCH ? OR title MATCH ? LIMIT ?',
      [query, query, options.limit || 5]
    );

    // 4. 应用过滤条件
    const filtered = this.applyFilters(results, conditions);

    // 5. 计算相关性分数
    const scored = filtered.map(item => ({
      ...item,
      score: this.calculateRelevance(item, query),
    }));

    // 6. 缓存结果
    this.cache.set(cacheKey, {
      items: scored,
      timestamp: Date.now(),
      ttl: 60000, // 1分钟
    });

    // 7. 更新使用统计
    await this.updateUsageStats(scored);

    return scored;
  }

  // 上下文感知检索
  async searchWithContext(
    query: string,
    context: RetrievalContext
  ): Promise<KnowledgeItem[]> {
    // 1. 构建增强查询
    const enhancedQuery = this.enhanceQuery(query, context);

    // 2. 构建过滤条件
    const filter = {
      type: context.type,
      language: context.language,
      quality: { gte: context.minQuality || 70 },
      ...context.filter,
    };

    // 3. 执行检索
    return await this.search(enhancedQuery, {
      limit: 3,
      filter,
    });
  }

  // 知识推荐
  async recommend(context: RecommendationContext): Promise<KnowledgeItem[]> {
    // 1. 分析项目特征
    const features = this.analyzeProjectFeatures(context.project);

    // 2. 查找相似项目
    const similarProjects = await this.findSimilarProjects(features);

    // 3. 获取这些项目使用的知识
    const usedKnowledge = await Promise.all(
      similarProjects.map(p => this.getKnowledgeByProject(p.id))
    );

    // 4. 统计并推荐高频知识
    const frequency = this.countFrequency(usedKnowledge.flat());
    return frequency
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(item => item.knowledge);
  }

  private buildConditions(options: SearchOptions): Record<string, unknown> {
    const conditions: Record<string, unknown> = {};
    if (options.filter?.type) {
      conditions.type = options.filter.type;
    }
    if (options.filter?.language) {
      conditions.language = options.filter.language;
    }
    if (options.filter?.verifiedOnly) {
      conditions.verified = true;
    }
    return conditions;
  }

  private calculateRelevance(item: KnowledgeItem, query: string): number {
    // 基于关键词匹配计算相关性
    const queryTerms = query.toLowerCase().split(/\s+/);
    const itemText = `${item.title} ${item.description} ${item.content}`.toLowerCase();

    let score = 0;
    for (const term of queryTerms) {
      if (itemText.includes(term)) {
        score += 0.2;
      }
    }

    // 使用率和成功率加成
    score += Math.log1p(item.usageCount) / 20;
    score += item.successRate * 0.3;

    return Math.min(score, 1);
  }
}
```

## 5. 状态管理数据流

### 5.1 LangGraph状态流转

```typescript
// 状态转换函数
interface StateTransitionFunction<T extends State> {
  (state: T): Promise<Partial<T>>;
}

// 项目生成节点
const projectGenerationNodes: Record<string, StateTransitionFunction<ProjectGenerationState>> = {
  // 创意生成节点
  ideation: async (state) => {
    const generator = new IdeaGeneratorAgent(config);
    const result = await generator.execute(
      { ideaId: state.ideaId },
      buildContext(state)
    );

    return {
      idea: result.data,
      currentStage: 'ideation',
      progress: 10,
      lastUpdate: Date.now(),
    };
  },

  // 架构设计节点
  architecture: async (state) => {
    const architect = new ArchitectAgent(config);
    const result = await architect.execute(
      { idea: state.idea! },
      buildContext(state)
    );

    return {
      architecture: result.data,
      currentStage: 'architecture',
      progress: 25,
      lastUpdate: Date.now(),
    };
  },

  // 代码生成节点
  coding: async (state) => {
    const coder = new CoderAgent(config);
    const result = await coder.execute(
      {
        idea: state.idea!,
        architecture: state.architecture!,
      },
      buildContext(state)
    );

    return {
      code: result.data,
      currentStage: 'coding',
      progress: 50,
      lastUpdate: Date.now(),
    };
  },

  // 测试节点
  testing: async (state) => {
    const tester = new TesterAgent(config);
    const result = await tester.execute(
      { code: state.code! },
      buildContext(state)
    );

    return {
      tests: result.data.tests,
      testResults: result.data.results,
      currentStage: 'testing',
      progress: 70,
      testCoverage: result.data.results.coverage,
      lastUpdate: Date.now(),
    };
  },

  // 审查节点
  review: async (state) => {
    const reviewer = new ReviewerAgent(config);
    const result = await reviewer.execute(
      {
        code: state.code!,
        tests: state.tests!,
        testResults: state.testResults!,
      },
      buildContext(state)
    );

    return {
      review: result.data,
      qualityScore: result.data.qualityScore,
      currentStage: 'review',
      progress: 85,
      lastUpdate: Date.now(),
    };
  },

  // 质量门禁节点
  'quality-gate': async (state) => {
    const gate = new QualityGate(config);
    const result = await gate.check(state);

    if (!result.passed) {
      return {
        errors: result.failures.map(f => ({
          step: 'quality-gate',
          error: f,
          timestamp: Date.now(),
        })),
        lastUpdate: Date.now(),
      };
    }

    return { lastUpdate: Date.now() };
  },

  // 优化节点
  optimizing: async (state) => {
    const optimizer = new OptimizerAgent(config);
    const result = await optimizer.execute(
      {
        project: state.project!,
        code: state.code!,
        review: state.review!,
        qualityScore: state.qualityScore!,
      },
      buildContext(state)
    );

    return {
      iterationCount: state.iterationCount + 1,
      lastUpdate: Date.now(),
    };
  },

  // 构建节点
  building: async (state) => {
    const builder = new BuildAgent(config);
    const result = await builder.execute(
      { project: state.project! },
      buildContext(state)
    );

    return {
      buildSuccess: result.data.success,
      currentStage: 'building',
      progress: 95,
      lastUpdate: Date.now(),
    };
  },

  // 部署节点
  deploying: async (state) => {
    const deployer = new DeployAgent(config);
    const result = await deployer.execute(
      { project: state.project! },
      buildContext(state)
    );

    return {
      currentStage: 'deploying',
      progress: 100,
      project: {
        ...state.project!,
        status: 'completed',
        completedAt: Date.now(),
        gitRepo: result.data.repoUrl,
      },
      lastUpdate: Date.now(),
    };
  },
};
```

### 5.2 状态持久化

```typescript
// 状态检查点
class StateCheckpointManager {
  private db: Database;

  // 保存检查点
  async saveCheckpoint(
    projectId: string,
    state: ProjectGenerationState
  ): Promise<void> {
    const checkpoint = {
      id: generateId(),
      projectId,
      stage: state.currentStage,
      state: JSON.stringify(state),
      timestamp: Date.now(),
    };

    await this.db.insert(checkpoints).values(checkpoint);
  }

  // 恢复检查点
  async restoreCheckpoint(
    projectId: string,
    stage?: ProjectStage
  ): Promise<ProjectGenerationState | null> {
    let query = this.db
      .select()
      .from(checkpoints)
      .where(eq(checkpoints.projectId, projectId));

    if (stage) {
      query = query.where(eq(checkpoints.stage, stage));
    }

    const checkpoint = await query.orderBy(desc(checkpoints.timestamp)).limit(1);

    if (!checkpoint.length) return null;

    return JSON.parse(checkpoint[0].state);
  }

  // 获取检查点历史
  async getCheckpointHistory(
    projectId: string
  ): Promise<Checkpoint[]> {
    return await this.db
      .select()
      .from(checkpoints)
      .where(eq(checkpoints.projectId, projectId))
      .orderBy(desc(checkpoints.timestamp));
  }
}
```

## 6. 实时数据流

### 6.1 WebSocket数据推送

```typescript
// 事件分发器
class EventDispatcher {
  private clients: Map<string, WebSocket>;
  private subscriptions: Map<string, Set<string>>; // client -> channels

  // 订阅频道
  subscribe(clientId: string, channels: string[]): void {
    const subs = this.subscriptions.get(clientId) || new Set();
    channels.forEach(ch => subs.add(ch));
    this.subscriptions.set(clientId, subs);
  }

  // 分发事件
  dispatch(event: StreamEvent, channels: string[]): void {
    for (const [clientId, subs] of this.subscriptions) {
      const ws = this.clients.get(clientId);
      if (!ws || ws.readyState !== WebSocket.OPEN) continue;

      // 检查客户端是否订阅了相关频道
      const isSubscribed = channels.some(ch => subs.has(ch));
      if (isSubscribed) {
        ws.send(JSON.stringify(event));
      }
    }
  }

  // 广播系统事件
  broadcastSystemEvent(event: SystemEvent): void {
    this.dispatch(
      {
        id: generateId(),
        type: 'system:status',
        timestamp: Date.now(),
        data: event,
      },
      ['system', 'all']
    );
  }

  // 推送项目事件
  broadcastProjectEvent(projectId: string, event: ProjectEvent): void {
    this.dispatch(
      {
        id: generateId(),
        type: `project:${event.type}`,
        timestamp: Date.now(),
        data: { projectId, ...event },
      },
      ['projects', `project:${projectId}`, 'all']
    );
  }
}
```

### 6.2 流式数据聚合

```typescript
// 数据聚合器
class StreamAggregator {
  private windows: Map<string, TimeWindow>;

  // 添加数据点
  addPoint(series: string, value: number, timestamp: number): void {
    const window = this.getWindow(series);
    window.points.push({ value, timestamp });

    // 保持窗口大小
    if (window.points.length > window.maxPoints) {
      window.points.shift();
    }

    // 触发聚合
    if (this.shouldAggregate(window)) {
      this.aggregate(window);
    }
  }

  // 聚合数据
  private aggregate(window: TimeWindow): void {
    const points = window.points;
    const aggregation = {
      series: window.series,
      windowStart: points[0].timestamp,
      windowEnd: points[points.length - 1].timestamp,
      count: points.length,
      min: Math.min(...points.map(p => p.value)),
      max: Math.max(...points.map(p => p.value)),
      avg: points.reduce((sum, p) => sum + p.value, 0) / points.length,
      sum: points.reduce((sum, p) => sum + p.value, 0),
    };

    // 发送聚合数据
    this.emitAggregation(aggregation);

    // 清空窗口
    window.points = [];
  }

  // 获取实时统计
  getStats(series: string): SeriesStats | null {
    const window = this.windows.get(series);
    if (!window || window.points.length === 0) return null;

    const values = window.points.map(p => p.value);
    return {
      series,
      current: values[values.length - 1],
      avg: values.reduce((sum, v) => sum + v, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      trend: this.calculateTrend(values),
    };
  }

  // 计算趋势
  private calculateTrend(values: number[]): 'up' | 'down' | 'stable' {
    if (values.length < 2) return 'stable';

    const recent = values.slice(-10);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const change = (last - first) / first;

    if (change > 0.05) return 'up';
    if (change < -0.05) return 'down';
    return 'stable';
  }
}
```

## 7. 数据质量保证

### 7.1 数据验证

```typescript
// 数据验证器
class DataValidator {
  // 验证创意数据
  validateIdea(idea: unknown): ValidationResult<Idea> {
    const schema = z.object({
      id: z.string(),
      title: z.string().min(3).max(100),
      description: z.string().min(10).max(1000),
      type: z.enum(['web-app', 'cli-tool', 'library', 'api-service']),
      complexity: z.enum(['low', 'medium', 'high']),
      valueScore: z.number().min(0).max(100),
      status: z.enum(['pending', 'queued', 'accepted', 'rejected', 'in_progress', 'completed', 'failed']),
      priority: z.number().min(1).max(10),
      features: z.array(z.string()).min(1).max(20),
      techStack: z.array(z.string()).min(1).max(10),
      createdAt: z.number(),
    });

    return schema.safeParse(idea);
  }

  // 验证项目数据
  validateProject(project: unknown): ValidationResult<Project> {
    const schema = z.object({
      id: z.string(),
      ideaId: z.string(),
      name: z.string().min(3).max(100),
      type: z.enum(['web-app', 'cli-tool', 'library', 'api-service']),
      status: z.enum(['pending', 'generating', 'testing', 'building', 'completed', 'failed']),
      stage: z.enum(['ideation', 'architecture', 'coding', 'testing', 'review', 'optimizing', 'building', 'deploying', 'completed', 'failed']),
      progress: z.number().min(0).max(100),
      qualityScore: z.number().min(0).max(100),
      testCoverage: z.number().min(0).max(100),
      createdAt: z.number(),
    });

    return schema.safeParse(project);
  }

  // 验证知识数据
  validateKnowledge(knowledge: unknown): ValidationResult<Knowledge> {
    const schema = z.object({
      id: z.string(),
      type: z.enum(['pattern', 'template', 'best-practice', 'failure', 'decision']),
      title: z.string().min(3).max(200),
      content: z.string().min(10).max(10000),
      tags: z.array(z.string()).min(1).max(20),
      source: z.enum(['generated', 'imported', 'learned']),
      quality: z.number().min(0).max(100),
      createdAt: z.number(),
    });

    return schema.safeParse(knowledge);
  }
}
```

### 7.2 数据清洗

```typescript
// 数据清洗器
class DataCleaner {
  // 清洗创意
  cleanIdea(idea: Partial<Idea>): CleanedIdea {
    return {
      id: idea.id || generateId(),
      title: this.cleanText(idea.title || '').trim(),
      description: this.cleanText(idea.description || '').trim(),
      type: this.validateProjectType(idea.type),
      complexity: this.validateComplexity(idea.complexity),
      valueScore: this.clampNumber(idea.valueScore, 0, 100),
      status: this.validateIdeaStatus(idea.status),
      priority: this.clampNumber(idea.priority, 1, 10),
      features: this.deduplicateArray(idea.features || []),
      techStack: this.deduplicateArray(idea.techStack || []),
      createdAt: idea.createdAt || Date.now(),
      metadata: idea.metadata || {},
    };
  }

  // 清洗文本
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')     // 合并空白字符
      .replace(/[\r\n]+/g, ' ')  // 合并换行
      .trim();
  }

  // 去重数组
  private deduplicateArray<T>(arr: T[]): T[] {
    return Array.from(new Set(arr));
  }

  // 限制数字范围
  private clampNumber(num: number | undefined, min: number, max: number): number {
    if (num === undefined) return min;
    return Math.max(min, Math.min(max, num));
  }
}
```

## 8. 数据备份与恢复

### 8.1 备份策略

```typescript
// 备份管理器
class BackupManager {
  // 创建完整备份
  async createFullBackup(): Promise<Backup> {
    const backup = {
      id: generateId(),
      type: 'full',
      timestamp: Date.now(),
      size: 0,
      data: {
        database: await this.backupDatabase(),
        projects: await this.backupProjects(),
        knowledge: await this.backupKnowledge(),
        config: await this.backupConfig(),
      },
    };

    backup.size = JSON.stringify(backup).length;
    await this.saveBackup(backup);

    return backup;
  }

  // 增量备份
  async createIncrementalBackup(lastBackup: Backup): Promise<Backup> {
    const backup = {
      id: generateId(),
      type: 'incremental',
      timestamp: Date.now(),
      size: 0,
      basedOn: lastBackup.id,
      data: {
        database: await this.getDatabaseChanges(lastBackup.timestamp),
        projects: await this.getNewProjects(lastBackup.timestamp),
        knowledge: await this.getNewKnowledge(lastBackup.timestamp),
      },
    };

    backup.size = JSON.stringify(backup).length;
    await this.saveBackup(backup);

    return backup;
  }

  // 恢复备份
  async restoreBackup(backupId: string): Promise<void> {
    const backup = await this.loadBackup(backupId);

    if (backup.type === 'full') {
      await this.restoreFull(backup.data);
    } else {
      const basedOn = await this.loadBackup(backup.basedOn!);
      await this.restoreIncremental(basedOn.data, backup.data);
    }
  }
}
```

### 8.2 数据迁移

```typescript
// 数据迁移器
class DataMigrator {
  private migrations: Migration[] = [];

  // 执行迁移
  async migrate(): Promise<void> {
    const currentVersion = await this.getCurrentVersion();

    for (const migration of this.migrations) {
      if (migration.version > currentVersion) {
        await this.applyMigration(migration);
        await this.updateVersion(migration.version);
      }
    }
  }

  // 注册迁移
  register(migration: Migration): void {
    this.migrations.push(migration);
  }

  // 应用迁移
  private async applyMigration(migration: Migration): Promise<void> {
    console.log(`Applying migration ${migration.version}: ${migration.description}`);

    try {
      await migration.up();
      console.log(`Migration ${migration.version} completed`);
    } catch (error) {
      console.error(`Migration ${migration.version} failed:`, error);
      throw error;
    }
  }
}

// 迁移示例
migrator.register({
  version: 1,
  description: 'Add quality metrics to projects table',
  up: async () => {
    await db.schema.alterTable('projects')
      .addColumn('codeComplexity', 'integer')
      .addColumn('maintainabilityIndex', 'integer')
      .execute();
  },
  down: async () => {
    await db.schema.alterTable('projects')
      .dropColumn('codeComplexity')
      .dropColumn('maintainabilityIndex')
      .execute();
  },
});
```
