# AI模型服务与优化系统设计

## 概述

AI模型服务与优化系统是无限生成平台的智能核心，负责高效、稳定地提供LLM推理服务，支持代码生成、补全和分析等任务。系统涵盖模型管理、推理优化、成本控制和可靠性保障等关键能力。

## 核心价值

```
模型服务 = 管理 × 推理 × 优化 × 保障

模型服务的核心价值：
1. 高效推理 - 优化延迟和吞吐量
2. 成本控制 - 降低每次推理成本
3. 稳定可靠 - 多级容错保障
4. 灵活扩展 - 支持多种模型和场景
5. 智能路由 - 选择最优模型和配置
```

## 模型管理

### 模型类型

```typescript
// 模型类型
enum ModelType {
  // 代码生成
  CODE_GENERATION = 'code_generation',
  CODE_COMPLETION = 'code_completion',
  CODE_EXPLANATION = 'code_explanation',

  // 嵌入
  EMBEDDING = 'embedding',
  CODE_EMBEDDING = 'code_embedding',

  // 通用
  GENERAL_LLM = 'general_llm',
  VISION = 'vision'
}

// 模型配置
interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  type: ModelType;

  // 模型规格
  specs: {
    contextWindow: number;           // 上下文窗口 (tokens)
    maxOutputTokens: number;         // 最大输出
    supportsStreaming: boolean;
    supportsFunctionCalling: boolean;
  };

  // 能力
  capabilities: {
    languages: string[];             // 支持的语言
    modalities: ('text' | 'code' | 'image')[];
    specialFeatures: string[];
  };

  // 成本
  pricing: {
    inputPrice: number;             // $/1M tokens
    outputPrice: number;
    batchDiscount: number;           // 批处理折扣
  };

  // 部署
  deployment: {
    type: 'api' | 'self_hosted' | 'hybrid';
    endpoint?: string;
    regions: string[];
    replicas: number;
  };

  // 版本
  version: {
    current: string;
    available: string[];
    deprecated: string[];
  };
}

// 模型提供商
enum ModelProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  MISTRAL = 'mistral',
  COHERE = 'cohere',
  LOCAL = 'local',
  CUSTOM = 'custom'
}

// 预定义模型
const predefinedModels: ModelConfig[] = [
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: ModelProvider.OPENAI,
    type: ModelType.CODE_GENERATION,
    specs: {
      contextWindow: 128000,
      maxOutputTokens: 4096,
      supportsStreaming: true,
      supportsFunctionCalling: true
    },
    capabilities: {
      languages: ['en', 'zh', 'code'],
      modalities: ['text', 'code'],
      specialFeatures: ['function_calling', 'json_mode']
    },
    pricing: {
      inputPrice: 10,       // $10 / 1M tokens
      outputPrice: 30,
      batchDiscount: 0.5
    },
    deployment: {
      type: 'api',
      regions: ['us-east', 'eu-west'],
      replicas: 10
    },
    version: {
      current: '2024-04-09',
      available: ['2024-04-09', '2024-01-25'],
      deprecated: []
    }
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: ModelProvider.ANTHROPIC,
    type: ModelType.CODE_GENERATION,
    specs: {
      contextWindow: 200000,
      maxOutputTokens: 4096,
      supportsStreaming: true,
      supportsFunctionCalling: false
    },
    capabilities: {
      languages: ['en', 'zh', 'ja', 'code'],
      modalities: ['text', 'code'],
      specialFeatures: ['extended_thinking']
    },
    pricing: {
      inputPrice: 15,
      outputPrice: 75,
      batchDiscount: 0.6
    },
    deployment: {
      type: 'api',
      regions: ['us-east', 'eu-west'],
      replicas: 8
    },
    version: {
      current: '3.0.0',
      available: ['3.0.0', '3.5.0'],
      deprecated: ['2.1']
    }
  },
  {
    id: 'code-llama',
    name: 'Code Llama',
    provider: ModelProvider.LOCAL,
    type: ModelType.CODE_COMPLETION,
    specs: {
      contextWindow: 16384,
      maxOutputTokens: 2048,
      supportsStreaming: true,
      supportsFunctionCalling: false
    },
    capabilities: {
      languages: ['code'],
      modalities: ['code'],
      specialFeatures: ['infilling']
    },
    pricing: {
      inputPrice: 0,
      outputPrice: 0,
      batchDiscount: 1
    },
    deployment: {
      type: 'self_hosted',
      endpoint: 'http://llama-service:8080',
      regions: ['local'],
      replicas: 4
    },
    version: {
      current: '34b',
      available: ['34b', '13b', '7b'],
      deprecated: []
    }
  }
];
```

### 模型注册表

```typescript
// 模型注册表
class ModelRegistry {
  private models: Map<string, ModelConfig>;
  private versions: Map<string, ModelVersion>;

  constructor() {
    this.models = new Map();
    this.versions = new Map();
    this.loadPredefinedModels();
  }

  // 注册模型
  async registerModel(config: ModelConfig): Promise<void> {
    this.validateModelConfig(config);
    this.models.set(config.id, config);
    await this.loadModelVersion(config);
  }

  // 获取模型
  async getModel(modelId: string, version?: string): Promise<ModelInstance> {
    const config = this.models.get(modelId);
    if (!config) {
      throw new ModelNotFoundError(modelId);
    }

    const versionConfig = version || config.version.current;
    const modelVersion = this.versions.get(`${modelId}:${versionConfig}`);

    if (!modelVersion) {
      throw new ModelVersionNotFoundError(modelId, versionConfig);
    }

    return {
      id: modelId,
      version: versionConfig,
      config,
      instance: modelVersion
    };
  }

  // 列出可用模型
  async listModels(filter?: ModelFilter): Promise<ModelConfig[]> {
    let models = Array.from(this.models.values());

    if (filter) {
      if (filter.type) {
        models = models.filter(m => m.type === filter.type);
      }
      if (filter.provider) {
        models = models.filter(m => m.provider === filter.provider);
      }
      if (filter.capabilities?.languages) {
        models = models.filter(m =>
          filter.capabilities!.languages!.some(lang =>
            m.capabilities.languages.includes(lang)
          )
        );
      }
    }

    return models;
  }
}

// 模型实例
interface ModelInstance {
  id: string;
  version: string;
  config: ModelConfig;
  instance: ModelVersion;
}
```

## 推理服务

### 推理管道

```typescript
// 推理请求
interface InferenceRequest {
  id: string;
  modelId: string;
  version?: string;

  // 输入
  messages: ChatMessage[];
  prompt?: string;

  // 参数
  parameters: InferenceParameters;

  // 配置
  config: InferenceConfig;

  // 元数据
  metadata?: {
    tenantId?: string;
    projectId?: string;
    requestId?: string;
    priority?: number;
  };
}

// 推理参数
interface InferenceParameters {
  temperature?: number;              // 0-2
  topP?: number;                    // 0-1
  topK?: number;                    // 1-100
  maxTokens?: number;               // 最大token数
  stop?: string[];                  // 停止词
  presencePenalty?: number;          // -2 to 2
  frequencyPenalty?: number;         // -2 to 2

  // 特定参数
  responseFormat?: 'text' | 'json' | 'json_schema';
  jsonSchema?: object;
}

// 推理配置
interface InferenceConfig {
  timeout: number;                  // 超时 (ms)
  retry: {
    enabled: boolean;
    maxAttempts: number;
    backoff: 'exponential' | 'linear';
  };
  cache?: {
    enabled: boolean;
    ttl?: number;
  };
  streaming?: {
    enabled: boolean;
    chunkSize?: number;
  };
}

// 推理服务
class InferenceService {
  constructor(
    private modelRegistry: ModelRegistry,
    private requestRouter: RequestRouter,
    private cacheManager: CacheManager
  ) {}

  // 执行推理
  async infer(request: InferenceRequest): Promise<InferenceResponse> {
    // 1. 检查缓存
    if (request.config.cache?.enabled) {
      const cached = await this.cacheManager.get(request);
      if (cached) {
        return cached;
      }
    }

    // 2. 路由请求
    const target = await this.requestRouter.route(request);

    // 3. 执行推理
    const response = await this.executeInference(target, request);

    // 4. 缓存结果
    if (request.config.cache?.enabled) {
      await this.cacheManager.set(request, response);
    }

    // 5. 记录指标
    await this.recordMetrics(request, response);

    return response;
  }

  // 流式推理
  async *inferStream(
    request: InferenceRequest
  ): AsyncGenerator<StreamChunk, void, unknown> {
    // 1. 路由请求
    const target = await this.requestRouter.route(request);

    // 2. 流式执行
    for await (const chunk of target.model.stream(request)) {
      yield chunk;
    }
  }

  // 执行推理
  private async executeInference(
    target: ModelTarget,
    request: InferenceRequest
  ): Promise<InferenceResponse> {
    const startTime = Date.now();

    try {
      // 调用模型
      const result = await target.instance.invoke({
        messages: request.messages,
        parameters: request.parameters,
        config: {
          timeout: request.config.timeout,
          signal: AbortSignal.timeout(request.config.timeout)
        }
      });

      // 处理结果
      const response: InferenceResponse = {
        id: generateId('resp'),
        requestId: request.id,
        modelId: request.modelId,
        modelVersion: target.version,

        // 输出
        content: result.content,
        reasoning: result.reasoning,
        toolCalls: result.toolCalls,

        // 使用量
        usage: {
          inputTokens: result.usage.input_tokens,
          outputTokens: result.usage.output_tokens,
          totalTokens: result.usage.total_tokens
        },

        // 质量
        quality: {
          score: result.audit?.qualityScore,
          flags: result.audit?.flags
        },

        // 性能
        performance: {
          latencyMs: Date.now() - startTime,
          firstTokenMs: result.first_token_time,
          tokensPerSecond: result.usage.output_tokens /
            ((Date.now() - startTime) / 1000)
        }
      };

      return response;

    } catch (error) {
      throw this.handleInferenceError(error, target, request);
    }
  }
}

// 推理响应
interface InferenceResponse {
  id: string;
  requestId: string;
  modelId: string;
  modelVersion: string;

  // 输出
  content: string;
  reasoning?: string;
  toolCalls?: ToolCall[];

  // 使用量
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };

  // 质量
  quality?: {
    score?: number;
    flags?: string[];
  };

  // 性能
  performance: {
    latencyMs: number;
    firstTokenMs?: number;
    tokensPerSecond?: number;
  };
}
```

### 请求路由器

```typescript
// 请求路由器
class RequestRouter {
  constructor(
    private modelRegistry: ModelRegistry,
    private loadBalancer: LoadBalancer,
    private metricsCollector: MetricsCollector
  ) {}

  // 路由请求
  async route(request: InferenceRequest): Promise<ModelTarget> {
    // 1. 获取候选模型
    const candidates = await this.getCandidates(request);

    // 2. 评估候选
    const scored = await this.scoreCandidates(candidates, request);

    // 3. 选择最优
    const selected = this.selectBest(scored);

    // 4. 选择实例
    const instance = await this.loadBalancer.selectInstance(selected, request);

    return {
      modelId: selected.id,
      version: selected.version,
      config: selected.config,
      instance
    };
  }

  // 获取候选模型
  private async getCandidates(request: InferenceRequest): Promise<ModelCandidate[]> {
    const allModels = await this.modelRegistry.listModels({
      type: this.inferTaskType(request)
    });

    return allModels
      .filter(m => this.supportsRequest(m, request))
      .map(m => ({
        id: m.id,
        version: m.version.current,
        config: m,
        instances: [] // 将在负载均衡时填充
      }));
  }

  // 评估候选
  private async scoreCandidates(
    candidates: ModelCandidate[],
    request: InferenceRequest
  ): Promise<ScoredCandidate[]> {
    return Promise.all(
      candidates.map(async (candidate) => {
        // 计算分数
        const score = await this.calculateScore(candidate, request);
        return { ...candidate, score };
      })
    );
  }

  // 计算分数
  private async calculateScore(
    candidate: ModelCandidate,
    request: InferenceRequest
  ): Promise<number> {
    let score = 100;

    // 能力匹配 (-30 if not optimal)
    if (!this.isOptimalForTask(candidate.config, request)) {
      score -= 30;
    }

    // 上下文窗口 (-10 if tight)
    const neededTokens = this.estimateTokens(request);
    if (candidate.config.specs.contextWindow < neededTokens * 1.5) {
      score -= 10;
    }

    // 成本 (-20 for expensive)
    const cost = this.estimateCost(candidate.config, request);
    if (cost > 0.1) score -= 20;

    // 当前负载 (-10 if high)
    const load = await this.getModelLoad(candidate.id);
    if (load > 0.8) score -= 10;

    // 延迟 (-5 for high latency)
    const latency = await this.getModelLatency(candidate.id);
    if (latency > 2000) score -= 5;

    return Math.max(0, score);
  }
}

// 模型目标
interface ModelTarget {
  modelId: string;
  version: string;
  config: ModelConfig;
  instance: {
    id: string;
    endpoint: string;
    currentLoad: number;
  };
}
```

## 缓存管理

### 语义缓存

```typescript
// 推理缓存
class InferenceCache {
  constructor(
    private vectorStore: VectorStore,
    private kvCache: KVCache
  ) {}

  // 获取缓存
  async get(request: InferenceRequest): Promise<InferenceResponse | null> {
    // 1. 生成请求哈希
    const hash = await this.hashRequest(request);

    // 2. 精确匹配
    const exact = await this.kvCache.get(`exact:${hash}`);
    if (exact) {
      return exact;
    }

    // 3. 语义相似匹配
    const embedding = await this.embeddingModel.embed(this.normalizeRequest(request));
    const similar = await this.vectorStore.search(embedding, {
      topK: 1,
      threshold: 0.95
    });

    if (similar.length > 0 && similar[0].score >= 0.95) {
      const cached = await this.kvCache.get(`semantic:${similar[0].id}`);
      if (cached) {
        return { ...cached, cacheHit: 'semantic' };
      }
    }

    return null;
  }

  // 设置缓存
  async set(
    request: InferenceRequest,
    response: InferenceResponse
  ): Promise<void> {
    const hash = await this.hashRequest(request);

    // 1. 精确缓存
    await this.kvCache.set(`exact:${hash}`, response, {
      ttl: this.getTTL(request)
    });

    // 2. 语义缓存
    const embedding = await this.embeddingModel.embed(this.normalizeRequest(request));
    await this.vectorStore.insert({
      id: hash,
      vector: embedding,
      metadata: {
        requestHash: hash,
        modelId: request.modelId,
        createdAt: Date.now()
      }
    });

    await this.kvCache.set(`semantic:${hash}`, response, {
      ttl: this.getTTL(request) * 0.5  // 语义缓存更短
    });
  }

  // 生成请求哈希
  private async hashRequest(request: InferenceRequest): Promise<string> {
    const normalized = {
      modelId: request.modelId,
      messages: request.messages,
      params: {
        temperature: request.parameters.temperature,
        topP: request.parameters.topP,
        maxTokens: request.parameters.maxTokens
      }
    };

    return crypto.createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex')
      .substring(0, 16);
  }
}
```

## 成本优化

### Token优化

```typescript
// Token优化器
class TokenOptimizer {
  constructor(
    private promptAnalyzer: PromptAnalyzer
  ) {}

  // 优化提示
  async optimizePrompt(
    request: InferenceRequest,
    targetModel: ModelConfig
  ): Promise<OptimizedPrompt> {
    // 1. 分析当前token使用
    const analysis = await this.promptAnalyzer.analyze(request.messages);

    // 2. 识别优化机会
    const opportunities = this.identifyOpportunities(analysis, targetModel);

    // 3. 应用优化
    const optimized = await this.applyOptimizations(
      request.messages,
      opportunities
    );

    // 4. 估算节省
    const originalTokens = analysis.totalTokens;
    const optimizedTokens = await this.countTokens(optimized);

    return {
      original: request.messages,
      optimized,
      savings: {
        tokens: originalTokens - optimizedTokens,
        percentage: (originalTokens - optimizedTokens) / originalTokens,
        costSaving: this.calculateCostSaving(
          originalTokens - optimizedTokens,
          targetModel.pricing.inputPrice
        )
      }
    };
  }

  // 识别优化机会
  private identifyOpportunities(
    analysis: PromptAnalysis,
    model: ModelConfig
  ): OptimizationOpportunity[] {
    const opportunities: OptimizationOpportunity[] = [];

    // 上下文过长
    if (analysis.totalTokens > model.specs.contextWindow * 0.8) {
      opportunities.push({
        type: 'context_truncation',
        description: '上下文接近窗口限制',
        potentialSavings: 0.2,
        action: 'truncate_old_messages'
      });
    }

    // 重复系统提示
    if (analysis.systemMessageRepetitions > 0) {
      opportunities.push({
        type: 'dedupe_system_prompt',
        description: '系统提示重复',
        potentialSavings: analysis.systemMessageRepetitionTokens,
        action: 'dedupe_and_cache'
      });
    }

    // 冗长格式
    if (analysis.verboseFormatting) {
      opportunities.push({
        type: 'compact_formatting',
        description: '格式冗长',
        potentialSavings: 0.15,
        action: 'use_compact_format'
      });
    }

    return opportunities;
  }

  // 计算成本节省
  private calculateCostSaving(
    tokensSaved: number,
    pricePerMillion: number
  ): number {
    return (tokensSaved / 1_000_000) * pricePerMillion;
  }
}

// Token计数
async function countTokens(
  messages: ChatMessage[],
  model: string
): Promise<number> {
  const encoding = await getEncoding(model);

  let total = 0;
  for (const msg of messages) {
    total += countMessageTokens(msg, encoding);
  }

  // 加上格式token
  total += 3; // 每条消息的overhead

  return total;
}
```

### 批处理

```typescript
// 批处理调度器
class BatchScheduler {
  constructor(
    private queueManager: QueueManager,
    private metricsCollector: MetricsCollector
  ) {}

  // 提交批处理请求
  async submitBatch(
    requests: InferenceRequest[]
  ): Promise<BatchJob> {
    // 1. 验证请求
    this.validateBatch(requests);

    // 2. 创建作业
    const job: BatchJob = {
      id: generateId('batch'),
      requests,
      status: 'queued',
      createdAt: new Date(),
      priority: this.calculateBatchPriority(requests)
    };

    // 3. 进入队列
    await this.queueManager.enqueueBatch(job);

    return job;
  }

  // 处理批处理
  async processBatch(job: BatchJob): Promise<BatchResult> {
    const startTime = Date.now();
    const results: InferenceResponse[] = [];
    const errors: BatchError[] = [];

    // 1. 按模型分组
    const grouped = this.groupByModel(job.requests);

    // 2. 并行处理每组
    const processGroups = Object.entries(grouped).map(
      async ([modelId, requests]) => {
        const model = await this.getModel(modelId);

        // 使用批处理API
        const batchResponse = await model.createBatch(
          requests.map(r => ({
            custom_id: r.id,
            messages: r.messages,
            parameters: r.parameters
          }))
        );

        return this.processBatchResponse(batchResponse);
      }
    );

    const groupResults = await Promise.all(processGroups);

    // 3. 汇总结果
    for (const result of groupResults) {
      results.push(...result.successes);
      errors.push(...result.errors);
    }

    return {
      jobId: job.id,
      total: job.requests.length,
      succeeded: results.length,
      failed: errors.length,
      results,
      errors,
      duration: Date.now() - startTime,
      cost: this.calculateBatchCost(results)
    };
  }

  // 批处理定价
  private calculateBatchCost(results: InferenceResponse[]): number {
    return results.reduce((sum, r) => {
      const model = this.getModel(r.modelId);
      const inputCost = (r.usage.inputTokens / 1_000_000) *
        model.pricing.inputPrice;
      const outputCost = (r.usage.outputTokens / 1_000_000) *
        model.pricing.outputPrice;

      // 批处理折扣
      return sum + (inputCost + outputCost) * model.pricing.batchDiscount;
    }, 0);
  }
}
```

## 容错与保障

### 重试策略

```typescript
// 重试策略
interface RetryStrategy {
  maxAttempts: number;
  initialDelay: number;          // ms
  maxDelay: number;              // ms
  backoff: 'exponential' | 'linear' | 'jitter';
  retryableErrors: string[];
  nonRetryableErrors: string[];
}

// 默认重试策略
const defaultRetryStrategy: RetryStrategy = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoff: 'exponential',
  retryableErrors: [
    'timeout',
    'rate_limit',
    'server_error',
    'network_error'
  ],
  nonRetryableErrors: [
    'invalid_request',
    'authentication_error',
    'context_length_exceeded',
    'content_filtered'
  ]
};

// 重试执行器
class RetryExecutor {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    strategy: RetryStrategy = defaultRetryStrategy
  ): Promise<T> {
    let lastError: Error;
    let delay = strategy.initialDelay;

    for (let attempt = 1; attempt <= strategy.maxAttempts; attempt++) {
      try {
        return await operation();

      } catch (error) {
        lastError = error;

        if (!this.isRetryable(error, strategy)) {
          throw error;
        }

        if (attempt < strategy.maxAttempts) {
          await this.sleep(this.calculateDelay(delay, attempt, strategy));
          delay = Math.min(delay * 2, strategy.maxDelay);
        }
      }
    }

    throw lastError!;
  }

  private isRetryable(error: Error, strategy: RetryStrategy): boolean {
    return strategy.retryableErrors.some(e =>
      error.message.toLowerCase().includes(e.toLowerCase())
    );
  }

  private calculateDelay(
    baseDelay: number,
    attempt: number,
    strategy: RetryStrategy
  ): number {
    switch (strategy.backoff) {
      case 'exponential':
        return baseDelay * Math.pow(2, attempt - 1);
      case 'linear':
        return baseDelay * attempt;
      case 'jitter':
        return baseDelay * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5);
    }
  }
}
```

### 降级策略

```typescript
// 降级策略
interface DegradationStrategy {
  // 降级模型
  fallbackModels: {
    modelId: string;
    conditions: {
      maxLatency?: number;
      maxCost?: number;
      errorRate?: number;
    };
  }[];

  // 功能降级
  featureDegradation: {
    feature: string;
    degradedBehavior: string;
    conditions: {
      errorRate?: number;
      latencyP99?: number;
    };
  }[];

  // 响应降级
  responseDegradation: {
    type: 'partial' | 'cached' | 'fallback_message';
    conditions: any;
  };
}

// 模型降级执行器
class ModelDegradationHandler {
  constructor(
    private strategies: DegradationStrategy[],
    private fallbackRouter: FallbackRouter
  ) {}

  async executeWithFallback(
    request: InferenceRequest,
    primaryModel: ModelConfig
  ): Promise<InferenceResponse> {
    try {
      // 尝试主模型
      return await this.primaryInference(request);

    } catch (error) {
      // 检查是否应该降级
      const shouldDegrade = await this.shouldDegrade(error, primaryModel);

      if (!shouldDegrade) {
        throw error;
      }

      // 查找合适的降级模型
      const fallback = await this.findFallback(request, primaryModel);

      if (fallback) {
        return this.executeFallback(request, fallback);
      }

      // 最后降级手段
      return this.executeDegradedResponse(error);
    }
  }

  // 功能降级
  async executeWithFeatureDegradation(
    request: InferenceRequest,
    features: string[]
  ): Promise<DegradedInferenceResponse> {
    const results: Partial<DegradedInferenceResponse> = {};

    for (const feature of features) {
      try {
        results[feature as keyof DegradedInferenceResponse] =
          await this.executeFeature(feature, request);
      } catch (error) {
        // 使用降级行为
        const degraded = this.getDegradedBehavior(feature);
        results[feature as keyof DegradedInferenceResponse] = degraded;
      }
    }

    return {
      ...results,
      degraded: true,
      missingFeatures: features.filter(f => !results[f])
    };
  }
}
```

## 监控与指标

### 模型指标

```typescript
// 模型指标收集器
class ModelMetricsCollector {
  constructor(
    private metricsStore: MetricsStore,
    private alertsManager: AlertsManager
  ) {
    this.startCollection();
  }

  private collectionInterval = 10000; // 10秒

  private startCollection() {
    setInterval(() => this.collect(), this.collectionInterval);
  }

  async collect(): Promise<void> {
    // 收集各模型指标
    const models = await this.modelRegistry.listModels();

    for (const model of models) {
      const metrics = await this.collectModelMetrics(model);

      // 存储
      await this.storeMetrics(model.id, metrics);

      // 检查告警
      await this.checkAlerts(model, metrics);
    }
  }

  // 收集单个模型指标
  private async collectModelMetrics(model: ModelConfig): Promise<ModelMetrics> {
    return {
      // 请求量
      requestsTotal: await this.getCounter(`requests:${model.id}`),
      requestsPerMinute: await this.getRate(`requests:${model.id}`),

      // 延迟
      latency: {
        p50: await this.getPercentile(`latency:${model.id}`, 0.5),
        p95: await this.getPercentile(`latency:${model.id}`, 0.95),
        p99: await this.getPercentile(`latency:${model.id}`, 0.99),
        avg: await this.getAverage(`latency:${model.id}`)
      },

      // 错误
      errors: {
        total: await this.getCounter(`errors:${model.id}`),
        byType: await this.getErrorBreakdown(model.id),
        rate: await this.getErrorRate(model.id)
      },

      // Token使用
      tokens: {
        input: await this.getCounter(`tokens_input:${model.id}`),
        output: await this.getCounter(`tokens_output:${model.id}`)
      },

      // 成本
      cost: {
        total: await this.calculateTotalCost(model.id),
        perRequest: await this.calculateCostPerRequest(model.id)
      },

      // 缓存
      cache: {
        hitRate: await this.getCacheHitRate(model.id),
        hits: await this.getCounter(`cache_hits:${model.id}`),
        misses: await this.getCounter(`cache_misses:${model.id}`)
      }
    };
  }

  // 告警检查
  private async checkAlerts(model: ModelConfig, metrics: ModelMetrics): Promise<void> {
    // 错误率告警
    if (metrics.errors.rate > 0.05) { // 5%
      await this.alertsManager.raise({
        type: 'model_error_rate',
        severity: 'high',
        modelId: model.id,
        value: metrics.errors.rate,
        threshold: 0.05
      });
    }

    // 延迟告警
    if (metrics.latency.p99 > 5000) { // 5秒
      await this.alertsManager.raise({
        type: 'model_latency',
        severity: 'medium',
        modelId: model.id,
        value: metrics.latency.p99,
        threshold: 5000
      });
    }

    // 成本告警
    const costAlert = await this.checkCostAnomaly(model.id, metrics.cost.total);
    if (costAlert) {
      await this.alertsManager.raise({
        type: 'model_cost_anomaly',
        severity: 'medium',
        modelId: model.id,
        value: metrics.cost.total,
        expected: costAlert.expected
      });
    }
  }
}

// 模型指标
interface ModelMetrics {
  requestsTotal: number;
  requestsPerMinute: number;

  latency: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
  };

  errors: {
    total: number;
    byType: Record<string, number>;
    rate: number;
  };

  tokens: {
    input: number;
    output: number;
  };

  cost: {
    total: number;
    perRequest: number;
  };

  cache: {
    hitRate: number;
    hits: number;
    misses: number;
  };
}
```

## 配置

```typescript
// 模型服务配置
interface ModelServingConfig {
  // 模型管理
  models: {
    registry: ModelConfig[];
    autoUpdate: boolean;
    updateCheckInterval: number;
  };

  // 推理配置
  inference: {
    defaultTimeout: number;
    maxConcurrentRequests: number;
    requestQueueSize: number;
    retry: RetryStrategy;
  };

  // 缓存配置
  cache: {
    enabled: boolean;
    type: 'memory' | 'redis' | 'hybrid';
    ttl: number;
    semanticThreshold: number;
    maxSize: number;
  };

  // 优化配置
  optimization: {
    tokenOptimization: boolean;
    batchProcessing: boolean;
    batchSize: number;
    batchWindow: number;
  };

  // 降级配置
  degradation: {
    enabled: boolean;
    strategies: DegradationStrategy[];
    monitorInterval: number;
  };

  // 成本控制
  costControl: {
    maxCostPerRequest: number;
    monthlyBudget: number;
    alertThreshold: number;
    autoThrottle: boolean;
  };

  // 监控配置
  monitoring: {
    enabled: boolean;
    collectionInterval: number;
    retentionDays: number;
    alertChannels: string[];
  };
}
```

## 最佳实践

### 1. 模型选择

```
- 代码生成 → GPT-4/Claude 3
- 简单补全 → Code Llama
- 成本敏感 → 批处理+降级
- 低延迟 → 流式+边缘部署
```

### 2. 性能优化

```
- 启用语义缓存
- 优化Token使用
- 使用流式响应
- 合理设置超时
```

### 3. 成本控制

```
- 监控每次请求成本
- 使用批处理折扣
- 设置月度预算告警
- 自动降级到便宜模型
```

### 4. 可靠性

```
- 配置多重降级策略
- 监控错误率和延迟
- 实施重试机制
- 保留降级记录
```

---

**最后更新**: 2026-04-15
