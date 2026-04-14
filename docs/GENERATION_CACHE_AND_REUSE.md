# 生成缓存与复用系统设计

## 概述

生成缓存与复用系统是无限生成系统的性能优化核心，通过缓存中间结果和生成产物，实现输入相似的请求复用已有结果，避免重复计算。没有缓存系统，每次生成都将从零开始，浪费大量计算资源和时间。

## 核心价值

```
缓存复用 = 相似匹配 × 结果存储 × 失效管理 × 版本控制

缓存系统的核心价值：
1. 性能提升 - 命中缓存可减少90%+计算时间
2. 成本节省 - 减少重复LLM调用
3. 一致性保证 - 相同输入产生相同输出
4. 加速迭代 - 快速获取历史生成结果
5. 模式识别 - 发现重复生成模式
```

## 缓存架构

### 缓存类型

```typescript
// 缓存类型枚举
enum CacheType {
  // 内存缓存
  MEMORY = 'memory',                   // 进程内LRU缓存

  // 分布式缓存
  REDIS = 'redis',                    // Redis缓存
  MEMCACHED = 'memcached',           // Memcached缓存

  // 持久化缓存
  DISK = 'disk',                     // 磁盘文件缓存
  DATABASE = 'database',             // 数据库缓存

  // 混合缓存
  HYBRID = 'hybrid'                  // 多级混合缓存
}

// 缓存级别
enum CacheLevel {
  L1 = 'l1',                         // 进程内
  L2 = 'l2',                         // 分布式
  L3 = 'l3'                          // 持久化
}

// 缓存配置
interface CacheConfig {
  type: CacheType;
  levels?: CacheLevel[];

  // 存储配置
  storage: {
    maxSize: number;                 // 最大大小 (bytes)
    maxEntries: number;             // 最大条目数
    ttl?: number;                    // 过期时间 (ms)
  };

  // LRU配置
  eviction: {
    policy: 'lru' | 'lfu' | 'fifo' | 'random';
    checkInterval: number;          // 检查间隔 (ms)
  };

  // 持久化配置
  persistence?: {
    enabled: boolean;
    path?: string;
    format: 'json' | 'binary' | 'compressed';
  };
}

// 多级缓存配置
const multiLevelCacheConfig: CacheConfig = {
  type: CacheType.HYBRID,
  levels: [CacheLevel.L1, CacheLevel.L2, CacheLevel.L3],

  storage: {
    maxSize: 1024 * 1024 * 1024,    // 1GB总大小
    maxEntries: 100000,
    ttl: 7 * 24 * 60 * 60 * 1000   // 7天
  },

  eviction: {
    policy: 'lru',
    checkInterval: 60000
  }
};
```

### 缓存条目

```typescript
// 缓存条目
interface CacheEntry<T = any> {
  // 键
  key: string;
  keyHash: string;                   // 哈希值 (用于快速比较)

  // 值
  value: T;

  // 元数据
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    accessedAt: Date;
    accessCount: number;

    // 大小
    size: number;                    // 字节数
    compressed: boolean;

    // 来源
    source?: {
      pipelineId?: string;
      stageId?: string;
      generationId?: string;
    };
  };

  // 血缘
  lineage?: LineageRef[];

  // 版本
  version: {
    current: number;
    parent?: string;
  };

  // 标签
  tags: string[];

  // 状态
  status: 'active' | 'stale' | 'invalid';
}

// 血缘引用
interface LineageRef {
  entityId: string;
  entityType: string;
  pipelineId: string;
  version: string;
}
```

## 相似性匹配

### 语义缓存

```typescript
// 语义缓存管理器
class SemanticCacheManager {
  constructor(
    private vectorStore: VectorStore,
    private cacheStore: CacheStore,
    private similarityThreshold = 0.95
  ) {}

  // 查找相似缓存
  async findSimilar(
    request: GenerationRequest,
    options: SimilarityOptions = {}
  ): Promise<CacheHit | null> {
    // 1. 生成请求嵌入
    const embedding = await this.generateEmbedding(request);

    // 2. 搜索相似条目
    const candidates = await this.vectorStore.search({
      vector: embedding,
      topK: options.topK || 5,
      filters: this.buildFilters(request),
      minScore: options.minScore || this.similarityThreshold
    });

    // 3. 精确匹配检查
    for (const candidate of candidates) {
      const exactMatch = await this.checkExactMatch(request, candidate);

      if (exactMatch.matches) {
        // 更新访问统计
        await this.updateAccessStats(candidate.key);

        return {
          hit: true,
          entry: candidate.entry,
          similarity: exactMatch.similarity,
          matchType: exactMatch.matchType,
          timeSaved: Date.now() - candidate.entry.metadata.createdAt.getTime()
        };
      }
    }

    return null;
  }

  // 存储新条目
  async store(
    request: GenerationRequest,
    result: GenerationResult
  ): Promise<string> {
    // 1. 生成缓存键
    const key = await this.generateKey(request);

    // 2. 生成嵌入
    const embedding = await this.generateEmbedding(request);

    // 3. 创建缓存条目
    const entry: CacheEntry<GenerationResult> = {
      key,
      keyHash: await this.hash(key),
      value: result,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
        accessCount: 1,
        size: this.estimateSize(result),
        compressed: false,
        source: {
          pipelineId: result.pipelineId,
          stageId: result.stageId
        }
      },
      lineage: result.lineage,
      version: { current: 1 },
      tags: this.extractTags(request),
      status: 'active'
    };

    // 4. 存储
    await this.cacheStore.set(key, entry);

    // 5. 存储嵌入向量
    await this.vectorStore.insert({
      id: key,
      vector: embedding,
      metadata: {
        key,
        requestHash: entry.keyHash
      }
    });

    return key;
  }

  // 生成嵌入
  private async generateEmbedding(
    request: GenerationRequest
  ): Promise<number[]> {
    // 使用语言模型生成语义嵌入
    const text = this.normalizeRequest(request);
    return await this.embeddingModel.embed(text);
  }

  // 生成缓存键
  private async generateKey(request: GenerationRequest): Promise<string> {
    // 规范化请求
    const normalized = this.normalizeRequest(request);

    // 生成确定性哈希
    const hash = await this.hash(normalized);

    // 包含版本信息
    return `gen:${request.type}:${request.language || 'any'}:${hash}`;
  }

  // 规范化请求
  private normalizeRequest(request: GenerationRequest): string {
    return JSON.stringify({
      type: request.type,
      language: request.language,
      framework: request.framework,
      requirements: request.requirements,
      constraints: request.constraints,
      // 规范化顺序
    }, Object.keys(request).sort());
  }

  // 检查精确匹配
  private async checkExactMatch(
    request: GenerationRequest,
    candidate: CacheCandidate
  ): Promise<ExactMatchResult> {
    const cachedRequest = candidate.entry.metadata.source;

    // 检查关键字段
    const matchType = this.getMatchType(request, candidate.entry);

    if (matchType === 'exact') {
      return { matches: true, similarity: 1.0, matchType };
    }

    if (matchType === 'semantic' && candidate.score >= this.similarityThreshold) {
      return { matches: true, similarity: candidate.score, matchType };
    }

    return { matches: false, similarity: candidate.score, matchType };
  }
}

// 缓存命中
interface CacheHit {
  hit: boolean;
  entry?: CacheEntry;
  similarity?: number;
  matchType?: 'exact' | 'semantic' | 'partial';
  timeSaved?: number;
}

// 精确匹配结果
interface ExactMatchResult {
  matches: boolean;
  similarity: number;
  matchType: 'exact' | 'semantic' | 'partial' | 'none';
}
```

### 匹配策略

```typescript
// 匹配策略
enum MatchStrategy {
  EXACT = 'exact',                   // 完全匹配
  SEMANTIC = 'semantic',           // 语义相似
  PARTIAL = 'partial',             // 部分匹配
  TEMPLATE = 'template',           // 模板匹配
  FUZZY = 'fuzzy'                  // 模糊匹配
}

// 匹配配置
interface MatchConfig {
  strategy: MatchStrategy | MatchStrategy[];

  // 阈值配置
  thresholds: {
    exact: number;                 // 完全匹配阈值
    semantic: number;             // 语义匹配阈值
    partial: number;              // 部分匹配阈值
    fuzzy: number;                // 模糊匹配阈值
  };

  // 权重配置
  weights: {
    requirement: number;          // 需求匹配权重
    language: number;             // 语言匹配权重
    framework: number;            // 框架匹配权重
    context: number;              // 上下文匹配权重
  };

  // 回退策略
  fallback: {
    enabled: boolean;
    strategies: MatchStrategy[];
  };
}

// 模板匹配器
class TemplateMatcher {
  private templates: Map<string, Template>;

  constructor() {
    this.templates = new Map();
  }

  // 匹配模板
  async match(
    request: GenerationRequest
  ): Promise<TemplateMatch | null> {
    // 1. 查找候选模板
    const candidates = this.findCandidateTemplates(request);

    // 2. 评分
    const scored = await this.scoreTemplates(request, candidates);

    // 3. 选择最佳
    const best = scored[0];

    if (best && best.score >= this.threshold) {
      return best;
    }

    return null;
  }

  // 生成模板
  async generateTemplate(
    request: GenerationRequest,
    result: GenerationResult
  ): Promise<Template> {
    const template: Template = {
      id: generateId('tpl'),
      name: this.generateName(request),
      pattern: this.extractPattern(request),
      slots: this.extractSlots(request, result),
      constraints: this.extractConstraints(request),
      generatedFrom: result.lineage,
      usageCount: 1,
      effectiveness: 0,
      createdAt: new Date()
    };

    this.templates.set(template.id, template);
    return template;
  }

  // 提取模式
  private extractPattern(request: GenerationRequest): string {
    // 将具体值替换为占位符
    return JSON.stringify(request, (key, value) => {
      if (this.isVariable(key, value)) {
        return `{{${key}}}`;
      }
      return value;
    });
  }

  // 提取槽位
  private extractSlots(
    request: GenerationRequest,
    result: GenerationResult
  ): TemplateSlot[] {
    const slots: TemplateSlot[] = [];

    // 提取需求中的变量
    for (const [key, value] of Object.entries(request.requirements || {})) {
      slots.push({
        name: key,
        type: typeof value,
        source: 'requirements',
        example: value
      });
    }

    // 提取语言/框架
    if (request.language) {
      slots.push({
        name: 'language',
        type: 'string',
        source: 'context',
        example: request.language
      });
    }

    return slots;
  }
}

// 模板
interface Template {
  id: string;
  name: string;
  pattern: string;
  slots: TemplateSlot[];
  constraints: TemplateConstraint[];
  generatedFrom?: LineageRef[];
  usageCount: number;
  effectiveness: number;
  createdAt: Date;
}

// 模板槽位
interface TemplateSlot {
  name: string;
  type: string;
  source: 'requirements' | 'context' | 'input';
  example: any;
}

// 模板匹配
interface TemplateMatch {
  template: Template;
  score: number;
  bindings: Record<string, any>;
}
```

## 失效管理

### 缓存失效策略

```typescript
// 缓存失效器
class CacheInvalidator {
  constructor(
    private cacheStore: CacheStore,
    private lineageTracker: LineageTracker
  ) {}

  // 失效缓存
  async invalidate(
    pattern: InvalidationPattern
  ): Promise<InvalidationResult> {
    const { type, target, reason } = pattern;

    let invalidated = 0;
    const errors: string[] = [];

    switch (type) {
      case 'key':
        invalidated = await this.invalidateByKey(target as string);
        break;

      case 'tag':
        invalidated = await this.invalidateByTag(target as string[], reason);
        break;

      case 'pattern':
        invalidated = await this.invalidateByPattern(target as string, reason);
        break;

      case 'lineage':
        invalidated = await this.invalidateByLineage(target as LineageRef, reason);
        break;

      case 'dependency':
        invalidated = await this.invalidateByDependency(target as string, reason);
        break;

      case 'time':
        invalidated = await this.invalidateByTime(target as TimeRange, reason);
        break;
    }

    return { invalidated, errors };
  }

  // 按血缘失效
  private async invalidateByLineage(
    ref: LineageRef,
    reason: string
  ): Promise<number> {
    // 1. 查找所有受影响的条目
    const affected = await this.lineageTracker.findAffectedEntities(ref);

    // 2. 级联失效
    let count = 0;
    for (const entity of affected) {
      const result = await this.cacheStore.delete(entity.id);
      if (result) count++;
    }

    return count;
  }

  // 按依赖失效
  private async invalidateByDependency(
    dependencyKey: string,
    reason: string
  ): Promise<number> {
    // 查找依赖此资源的缓存条目
    const entries = await this.cacheStore.findByDependency(dependencyKey);

    let count = 0;
    for (const entry of entries) {
      // 检查是否是直接依赖
      if (this.hasDirectDependency(entry, dependencyKey)) {
        await this.cacheStore.delete(entry.key);
        count++;
      }
    }

    return count;
  }

  // 级联失效
  async cascadeInvalidate(
    trigger: InvalidationTrigger
  ): Promise<CascadeResult> {
    const invalidated = new Set<string>();
    const queue: string[] = [trigger.affectedKey];

    while (queue.length > 0) {
      const key = queue.shift()!;

      if (invalidated.has(key)) continue;

      const entry = await this.cacheStore.get(key);
      if (!entry) continue;

      // 失效当前条目
      await this.cacheStore.delete(key);
      invalidated.add(key);

      // 查找依赖此条目的其他条目
      const dependents = await this.cacheStore.findDependents(key);
      for (const dep of dependents) {
        queue.push(dep.key);
      }
    }

    return {
      totalInvalidated: invalidated.size,
      keys: Array.from(invalidated)
    };
  }
}

// 失效模式
interface InvalidationPattern {
  type: 'key' | 'tag' | 'pattern' | 'lineage' | 'dependency' | 'time';
  target: string | string[] | LineageRef | TimeRange;
  reason: string;
  cascade?: boolean;
}

// 失效触发
interface InvalidationTrigger {
  type: 'source_changed' | 'dependency_updated' | 'manual' | 'expired';
  affectedKey: string;
  reason?: string;
}
```

### TTL管理

```typescript
// TTL管理器
class TTLManager {
  private expirationQueue: PriorityQueue<CacheEntry>;

  constructor(private cacheStore: CacheStore) {
    // 按过期时间排序的队列
    this.expirationQueue = new PriorityQueue({
      comparator: (a, b) =>
        (a.metadata.createdAt.getTime() + a.metadata.ttl) -
        (b.metadata.createdAt.getTime() + b.metadata.ttl)
    });

    // 启动过期检查
    this.startExpirationChecker();
  }

  // 设置TTL
  async setTTL(key: string, ttl: number): Promise<void> {
    const entry = await this.cacheStore.get(key);
    if (!entry) return;

    entry.metadata.ttl = ttl;
    await this.cacheStore.update(key, entry);

    // 加入过期队列
    await this.expirationQueue.enqueue(entry);
  }

  // 刷新TTL
  async refreshTTL(key: string): Promise<void> {
    const entry = await this.cacheStore.get(key);
    if (!entry) return;

    entry.metadata.accessedAt = new Date();
    await this.cacheStore.update(key, entry);

    // 重新加入过期队列
    await this.expirationQueue.enqueue(entry);
  }

  // 启动过期检查
  private startExpirationChecker() {
    setInterval(async () => {
      const now = Date.now();

      while (await this.expirationQueue.length() > 0) {
        const next = await this.expirationQueue.peek();
        const expirationTime = next.metadata.createdAt.getTime() + next.metadata.ttl;

        if (expirationTime <= now) {
          const expired = await this.expirationQueue.dequeue();

          // 验证是否仍然过期
          if (await this.shouldExpire(expired)) {
            await this.cacheStore.delete(expired.key);
          }
        } else {
          // 队列头部未过期，后面的也不会过期
          break;
        }
      }
    }, 60000); // 每分钟检查
  }

  private async shouldExpire(entry: CacheEntry): Promise<boolean> {
    // 检查是否有软引用
    if (entry.metadata.softReference) {
      // 内存压力大时应该过期
      return this.isMemoryPressureHigh();
    }
    return true;
  }
}
```

## 版本控制

### 缓存版本管理

```typescript
// 缓存版本管理器
class CacheVersionManager {
  constructor(
    private cacheStore: CacheStore,
    private versionStore: VersionStore
  ) {}

  // 存储新版本
  async storeVersion(
    key: string,
    value: any,
    options: VersionOptions = {}
  ): Promise<Version> {
    // 1. 获取当前版本
    const current = await this.versionStore.getCurrent(key);

    // 2. 创建新版本
    const version: Version = {
      id: generateId('ver'),
      key,
      version: current ? current.version + 1 : 1,
      value,
      parentVersion: current?.id,

      // 元数据
      createdAt: new Date(),
      createdBy: options.createdBy || 'system',
      changeReason: options.changeReason,

      // 差异
      diff: current ? await this.computeDiff(current.value, value) : null,

      // 标签
      tags: options.tags || []
    };

    // 3. 存储版本
    await this.versionStore.store(version);

    // 4. 更新当前引用
    await this.versionStore.setCurrent(key, version.id);

    // 5. 更新缓存条目
    const entry = await this.cacheStore.get(key);
    if (entry) {
      entry.version.current = version.version;
      await this.cacheStore.update(key, entry);
    }

    return version;
  }

  // 获取版本
  async getVersion(key: string, version?: number): Promise<any> {
    if (version === undefined) {
      // 获取最新版本
      const current = await this.versionStore.getCurrent(key);
      return current?.value;
    }

    const v = await this.versionStore.getByVersion(key, version);
    return v?.value;
  }

  // 回滚到指定版本
  async rollback(key: string, targetVersion: number): Promise<void> {
    const target = await this.versionStore.getByVersion(key, targetVersion);

    if (!target) {
      throw new Error(`Version ${targetVersion} not found for key ${key}`);
    }

    // 创建新版本记录回滚
    await this.storeVersion(key, target.value, {
      changeReason: `Rollback to version ${targetVersion}`,
      tags: ['rollback']
    });
  }

  // 获取版本历史
  async getVersionHistory(
    key: string,
    options: HistoryOptions = {}
  ): Promise<VersionInfo[]> {
    const versions = await this.versionStore.getHistory(key, {
      limit: options.limit || 10,
      startVersion: options.startVersion
    });

    return versions.map(v => ({
      id: v.id,
      version: v.version,
      createdAt: v.createdAt,
      createdBy: v.createdBy,
      changeReason: v.changeReason,
      tags: v.tags
    }));
  }
}

// 版本
interface Version {
  id: string;
  key: string;
  version: number;
  value: any;
  parentVersion: string | null;
  createdAt: Date;
  createdBy: string;
  changeReason?: string;
  diff?: any;
  tags: string[];
}
```

## 预热策略

### 缓存预热

```typescript
// 缓存预热器
class CacheWarmer {
  constructor(
    private cacheManager: SemanticCacheManager,
    private predictionService: PredictionService
  ) {}

  // 预热策略
  async warm(
    strategy: WarmStrategy,
    scope: WarmScope
  ): Promise<WarmResult> {
    switch (strategy) {
      case 'eager':
        return this.eagerWarm(scope);

      case 'lazy':
        return this.lazyWarm(scope);

      case 'predictive':
        return this.predictiveWarm(scope);

      case 'background':
        return this.backgroundWarm(scope);
    }
  }

  // 预测性预热
  private async predictiveWarm(scope: WarmScope): Promise<WarmResult> {
    // 1. 分析历史模式
    const patterns = await this.predictionService.analyzePatterns(scope);

    // 2. 预测即将到来的请求
    const predictions = await this.predictionService.predict({
      patterns,
      horizon: scope.horizon || '1h'
    });

    // 3. 预热预测会命中的缓存
    let warmed = 0;
    for (const prediction of predictions) {
      if (prediction.probability > this.confidenceThreshold) {
        await this.prewarm(prediction.request);
        warmed++;
      }
    }

    return {
      strategy: 'predictive',
      warmedCount: warmed,
      predictionsCount: predictions.length
    };
  }

  // 预热单个请求
  private async prewarm(request: GenerationRequest): Promise<void> {
    // 检查是否已在缓存中
    const existing = await this.cacheManager.findSimilar(request, {
      minScore: 0.99
    });

    if (existing) return;

    // 触发生成并缓存
    const result = await this.generationService.generate(request);
    await this.cacheManager.store(request, result);
  }
}

// 预热策略
enum WarmStrategy {
  EAGER = 'eager',                 // 积极预热
  LAZY = 'lazy',                   // 懒加载
  PREDICTIVE = 'predictive',       // 预测性预热
  BACKGROUND = 'background'        // 后台预热
}

// 预热范围
interface WarmScope {
  type: 'all' | 'popular' | 'pattern' | 'custom';
  filters?: Record<string, any>;
  horizon?: '15m' | '30m' | '1h' | '6h' | '24h';
  limit?: number;
}
```

## 监控与统计

### 缓存指标

```typescript
// 缓存指标
const cacheMetrics = {
  // 命中指标
  hitsTotal: Counter;
  hitsByType: Counter;
  missTotal: Counter;

  // 命中率
  hitRate: Gauge;
  hitRateByKeyType: Gauge;

  // 延迟指标
  lookupLatency: Histogram;
  storeLatency: Histogram;

  // 大小指标
  cacheSize: Gauge;
  cacheEntries: Gauge;
  evictedEntries: Counter;

  // 过期指标
  expiredEntries: Counter;
  ttlRefreshes: Counter;

  // 相似性指标
  similarityDistribution: Histogram;
  semanticHits: Counter;
  exactHits: Counter;

  // 预热指标
  prewarmedEntries: Counter;
  predictionAccuracy: Gauge;
};

// 缓存统计
interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;

  byType: Record<string, {
    entries: number;
    size: number;
    hitRate: number;
    avgTTL: number;
  }>;

  topAccessed: CacheEntry[];
  expiringSoon: CacheEntry[];
}
```

## 配置

```typescript
// 缓存配置
interface GenerationCacheConfig {
  // 缓存级别
  levels: {
    l1: {
      enabled: boolean;
      type: 'memory';
      maxSize: number;
      maxEntries: number;
    };
    l2: {
      enabled: boolean;
      type: 'redis';
      url: string;
      maxSize: number;
    };
    l3: {
      enabled: boolean;
      type: 'disk' | 'database';
      path?: string;
      maxSize: number;
    };
  };

  // 相似性匹配
  similarity: {
    enabled: boolean;
    threshold: number;
    embeddingModel: string;
    maxCandidates: number;
  };

  // 失效策略
  eviction: {
    policy: 'lru' | 'lfu' | 'ttl' | 'weighted';
    checkInterval: number;
    maxTTL?: number;
    minTTL?: number;
  };

  // 版本控制
  versioning: {
    enabled: boolean;
    maxVersions: number;
    retentionDays: number;
  };

  // 预热
  warmup: {
    enabled: boolean;
    strategy: 'eager' | 'lazy' | 'predictive' | 'background';
    predictiveModels?: string[];
  };

  // 指标
  metrics: {
    enabled: boolean;
    reportInterval: number;
  };
}
```

## 最佳实践

### 1. 缓存策略选择

```
- 高频访问数据 → L1 + L2 多级缓存
- 低频访问数据 → L2 单级缓存
- 需版本追踪 → 启用版本控制
- 需语义匹配 → 启用向量缓存
```

### 2. TTL设计

```
- 频繁变更的数据 → 短TTL (分钟级)
- 相对稳定的数据 → 中TTL (小时级)
- 几乎不变的数据 → 长TTL (天级)
- 模板类数据 → 根据更新频率设置
```

### 3. 失效处理

```
- 主动失效 > 被动过期
- 级联失效要谨慎，避免雪崩
- 保留历史版本，支持回滚
- 记录失效原因，便于排查
```

---

**最后更新**: 2026-04-15
