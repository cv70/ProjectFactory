# 性能优化设计

## 概述

本文档定义 ProjectFactory 系统的性能优化策略，涵盖从代码级优化到系统级架构优化的完整方案。目标是在保证系统稳定性的前提下，最大化资源利用率和吞吐量。

## 1. 性能目标

### 1.1 核心指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| API P50 延迟 | < 100ms | Prometheus histogram |
| API P99 延迟 | < 500ms | Prometheus histogram |
| 端到端项目生成 | < 30 分钟 | 项目生命周期追踪 |
| 并发项目数 | 10+ | 活跃项目计数器 |
| LLM 调用成功率 | > 99.5% | 错误率计数器 |
| 知识库检索 | < 50ms | 查询延迟监控 |

### 1.2 资源效率目标

| 资源 | 目标利用率 | 峰值利用率 |
|------|-----------|-----------|
| CPU | 60-70% | 85% |
| 内存 | 50-60% | 80% |
| 磁盘 I/O | < 70% | 85% |
| 网络带宽 | < 60% | 80% |

## 2. 性能瓶颈分析

### 2.1 关键路径识别

```
用户请求 → API 网关 → 认证中间件 → 业务处理 → LLM 调用 → 知识库 → 响应
     ↓           ↓            ↓           ↓           ↓         ↓
   网络     连接建立    Token 验证    DB 查询    API 延迟    序列化
```

### 2.2 瓶颈分布

| 层级 | 瓶颈类型 | 影响程度 | 优先级 |
|------|----------|----------|--------|
| LLM 调用 | I/O 阻塞 | 🔴 高 | P0 |
| 数据库 | 连接竞争 | 🔴 高 | P0 |
| 知识库 | 检索延迟 | 🟠 中 | P1 |
| API 网关 | 并发限制 | 🟠 中 | P1 |
| 文件系统 | I/O 阻塞 | 🟡 低 | P2 |

### 2.3 瓶颈根因分析

#### LLM 调用瓶颈

```typescript
// 问题：同步串行调用导致等待时间过长
async function processIdeasSequential(ideas: Idea[]) {
  const results = [];
  for (const idea of ideas) {
    const result = await llm.invoke(idea.prompt); // 每次 2-5 秒
    results.push(result);
  }
  return results; // 总计 10+ 秒
}
```

#### 数据库连接池瓶颈

```typescript
// 问题：连接池配置不当导致连接等待
const pool = new Pool({
  max: 10,  // 连接数不足
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// 高并发时：waitingClients > 0
// 症状：queries timeout
```

## 3. 缓存策略

### 3.1 多级缓存架构

```
┌─────────────────────────────────────────────────────────┐
│                     L1: 进程内缓存                        │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │
│  │Prompt   │  │LLM      │  │配置     │                   │
│  │Cache    │  │Response │  │Cache    │                   │
│  │(Map)    │  │(LRU)    │  │(热配置) │                   │
│  └─────────┘  └─────────┘  └─────────┘                   │
├─────────────────────────────────────────────────────────┤
│                     L2: 分布式缓存                        │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │
│  │Session  │  │项目状态 │  │向量索引 │                   │
│  │Cache    │  │Cache    │  │Cache    │                   │
│  │(Redis)  │  │(Redis)  │  │(Redis)  │                   │
│  └─────────┘  └─────────┘  └─────────┘                   │
├─────────────────────────────────────────────────────────┤
│                     L3: 持久化缓存                        │
│  ┌─────────┐  ┌─────────┐                              │
│  │LLM      │  │生成产物 │                               │
│  │Log      │  │Artifact │                              │
│  │(DB)     │  │(磁盘)   │                               │
│  └─────────┘  └─────────┘                              │
└─────────────────────────────────────────────────────────┘
```

### 3.2 L1 进程内缓存实现

```typescript
// src/infra/cache/l1-cache.ts
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessCount: number;
}

class L1Cache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize = 1000, ttlMs = 60000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    entry.accessCount++;
    return entry.value;
  }

  set(key: K, value: V, ttlMs?: number): void {
    if (this.cache.size >= this.maxSize) {
      this.evictLeastUsed();
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.ttlMs),
      accessCount: 0,
    });
  }

  private evictLeastUsed(): void {
    let minAccess = Infinity;
    let evictKey: K | null = null;
    for (const [key, entry] of this.cache) {
      if (entry.accessCount < minAccess) {
        minAccess = entry.accessCount;
        evictKey = key;
      }
    }
    if (evictKey) this.cache.delete(evictKey);
  }
}

// 预定义的 L1 缓存实例
export const promptCache = new L1Cache<string, string>(2000, 5 * 60 * 1000);
export const configCache = new L1Cache<string, object>(100, 30 * 1000);
export const llmResponseCache = new L1Cache<string, unknown>(500, 2 * 60 * 1000);
```

### 3.3 L2 Redis 分布式缓存

```typescript
// src/infra/cache/redis-cache.ts
import Redis from 'ioredis';

class RedisCache {
  private client: Redis;
  private prefix: string;

  constructor(client: Redis, prefix = 'pf:') {
    this.client = client;
    this.prefix = prefix;
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(`${this.prefix}${key}`);
    return data ? JSON.parse(data) : null;
  }

  async set<T>(key: string, value: T, ttlSeconds = 3600): Promise<void> {
    await this.client.setex(
      `${this.prefix}${key}`,
      ttlSeconds,
      JSON.stringify(value)
    );
  }

  async del(key: string): Promise<void> {
    await this.client.del(`${this.prefix}${key}`);
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    const values = await this.client.mget(keys.map(k => `${this.prefix}${k}`));
    return values.map(v => v ? JSON.parse(v) : null);
  }
}

export const sessionCache = new RedisCache(new Redis(process.env.REDIS_URL!), 'session:');
export const projectStateCache = new RedisCache(new Redis(process.env.REDIS_URL!), 'project:');
export const vectorIndexCache = new RedisCache(new Redis(process.env.REDIS_URL!), 'vector:');
```

### 3.4 缓存失效策略

```typescript
// 缓存失效策略：Write-Through + TTL
class CachedProjectRepository {
  private cache: RedisCache;
  private db: ProjectRepository;

  async save(project: Project): Promise<void> {
    await this.db.save(project);
    await this.cache.set(`project:${project.id}`, project, 3600);
  }

  async findById(id: string): Promise<Project | null> {
    const cached = await this.cache.get<Project>(`project:${id}`);
    if (cached) return cached;

    const project = await this.db.findById(id);
    if (project) {
      await this.cache.set(`project:${id}`, project, 3600);
    }
    return project;
  }

  async invalidate(id: string): Promise<void> {
    await this.cache.del(`project:${id}`);
  }
}
```

## 4. 并发优化

### 4.1 并发级别定义

```typescript
// src/config/concurrency.ts
export const concurrencyConfig = {
  // API 层并发限制
  api: {
    maxConcurrentRequests: 100,
    requestQueueSize: 200,
    rateLimit: {
      windowMs: 60000,
      maxRequests: 1000,
    },
  },

  // LLM 调用并发控制
  llm: {
    maxConcurrentCalls: 5,        // OpenAI 默认限制
    maxRetries: 3,
    retryDelayMs: 1000,
    backoffMultiplier: 2,
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeoutMs: 30000,
    },
  },

  // 数据库连接池
  database: {
    minConnections: 5,
    maxConnections: 20,
    acquireTimeoutMs: 10000,
    idleTimeoutMs: 30000,
  },

  // 项目处理并发
  projects: {
    maxConcurrentProjects: 10,
    maxQueuedProjects: 50,
    workerPoolSize: 10,
  },

  // 文件 I/O 并发
  fileIO: {
    maxConcurrentReads: 50,
    maxConcurrentWrites: 20,
    chunkSize: 64 * 1024, // 64KB
  },
};
```

### 4.2 Worker Pool 实现

```typescript
// src/infra/worker/worker-pool.ts
type WorkerTask<T> = () => Promise<T>;

class WorkerPool {
  private taskQueue: Array<{
    task: WorkerTask<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = [];
  private runningCount = 0;
  private readonly size: number;

  constructor(size: number) {
    this.size = size;
  }

  async submit<T>(task: WorkerTask<T>): Promise<T> {
    if (this.runningCount < this.size) {
      this.runningCount++;
      return this.runTask(task);
    }

    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task, resolve, reject });
    });
  }

  private async runTask<T>(task: WorkerTask<T>): Promise<T> {
    try {
      const result = await task();
      return result;
    } finally {
      this.processNext();
    }
  }

  private processNext(): void {
    if (this.taskQueue.length > 0) {
      const { task, resolve, reject } = this.taskQueue.shift()!;
      this.runTask(task).then(resolve).catch(reject);
    } else {
      this.runningCount--;
    }
  }

  get stats() {
    return {
      poolSize: this.size,
      running: this.runningCount,
      queued: this.taskQueue.length,
    };
  }
}

export const projectWorkerPool = new WorkerPool(concurrencyConfig.projects.workerPoolSize);
export const fileWorkerPool = new WorkerPool(concurrencyConfig.fileIO.maxConcurrentWrites);
```

### 4.3 并发任务调度

```typescript
// src/orchestration/scheduler/task-scheduler.ts
interface ScheduledTask {
  id: string;
  priority: 'high' | 'medium' | 'low';
  execute: () => Promise<void>;
  maxRetries: number;
}

class TaskScheduler {
  private queues = {
    high: [] as ScheduledTask[],
    medium: [] as ScheduledTask[],
    low: [] as ScheduledTask[],
  };
  private running = new Set<string>();
  private workerPool: WorkerPool;

  constructor(workerPool: WorkerPool) {
    this.workerPool = workerPool;
  }

  async schedule(task: ScheduledTask): Promise<void> {
    this.queues[task.priority].push(task);
    await this.processQueue();
  }

  private async processQueue(): Promise<void> {
    const priorities: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];

    for (const priority of priorities) {
      const queue = this.queues[priority];
      while (queue.length > 0 && this.running.size < concurrencyConfig.projects.maxConcurrentProjects) {
        const task = queue.shift()!;
        this.running.add(task.id);
        this.workerPool.submit(() => this.executeWithRetry(task))
          .finally(() => this.running.delete(task.id));
      }
    }
  }

  private async executeWithRetry(task: ScheduledTask): Promise<void> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= task.maxRetries; attempt++) {
      try {
        await task.execute();
        return;
      } catch (error) {
        lastError = error as Error;
        if (attempt < task.maxRetries) {
          await this.delay(concurrencyConfig.llm.retryDelayMs * Math.pow(2, attempt));
        }
      }
    }
    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## 5. 数据库优化

### 5.1 连接池优化

```typescript
// src/infra/database/optimized-pool.ts
import { Pool, PoolConfig } from 'pg';

const optimizedPoolConfig: PoolConfig = {
  // 连接数配置 - 根据 CPU 核心数调整
  min: concurrencyConfig.database.minConnections,
  max: concurrencyConfig.database.maxConnections,
  idleTimeoutMillis: concurrencyConfig.database.idleTimeoutMs,
  connectionTimeoutMillis: concurrencyConfig.database.acquireTimeoutMs,

  // 性能优化选项
  allowExitOnIdle: false,

  // 健康检查
  idleCheckIntervalMillis: 30000,
};

// 连接池监控
class MonitoredPool {
  private pool: Pool;
  private metrics = {
    totalConnections: 0,
    idleConnections: 0,
    waitingClients: 0,
    queryDuration: [] as number[],
  };

  constructor(config: PoolConfig) {
    this.pool = new Pool(config);
    this.setupMonitoring();
  }

  private setupMonitoring(): void {
    this.pool.on('connect', () => {
      this.metrics.totalConnections++;
    });

    this.pool.on('idle', () => {
      this.metrics.idleConnections++;
    });

    this.pool.on('error', (err) => {
      console.error('Pool error:', err);
    });
  }

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const start = Date.now();
    try {
      const result = await this.pool.query(sql, params);
      this.metrics.queryDuration.push(Date.now() - start);
      return result.rows;
    } finally {
      this.metrics.idleConnections = this.pool.idleCount;
      this.metrics.waitingClients = this.pool.waitingClients;
    }
  }

  getMetrics() {
    const avgQueryDuration = this.metrics.queryDuration.length > 0
      ? this.metrics.queryDuration.reduce((a, b) => a + b, 0) / this.metrics.queryDuration.length
      : 0;

    return {
      ...this.metrics,
      avgQueryDuration,
      poolSize: this.pool.totalCount,
    };
  }
}

export const dbPool = new MonitoredPool(optimizedPoolConfig);
```

### 5.2 查询优化策略

```typescript
// 查询优化：预编译 + 参数化查询
class OptimizedQueries {
  // 预编译的查询语句
  private statements = {
    findProjectById: 'SELECT * FROM projects WHERE id = $1',
    findIdeasByStatus: 'SELECT * FROM ideas WHERE status = $1 ORDER BY created_at DESC LIMIT $2',
    updateProjectQuality: `
      UPDATE projects
      SET quality_score = $1, updated_at = NOW()
      WHERE id = $2
    `,
    insertQualityMetric: `
      INSERT INTO quality_metrics (project_id, metric_type, metric_value, recorded_at)
      VALUES ($1, $2, $3, NOW())
    `,
  };

  // 批量插入优化
  async batchInsert<T extends { table: string; data: Record<string, unknown>[] }>(
    table: string,
    data: Record<string, unknown>[]
  ): Promise<void> {
    if (data.length === 0) return;

    const keys = Object.keys(data[0]);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    data.forEach((row, i) => {
      const offset = i * keys.length;
      placeholders.push(
        `(${keys.map((_, j) => `$${offset + j + 1}`).join(', ')})`
      );
      values.push(...keys.map(k => row[k]));
    });

    const sql = `
      INSERT INTO ${table} (${keys.join(', ')})
      VALUES ${placeholders.join(', ')}
      ON CONFLICT DO NOTHING
    `;

    await dbPool.query(sql, values);
  }

  // 索引优化查询
  async findProjectsNeedingOptimization(limit: number): Promise<Project[]> {
    return dbPool.query(`
      SELECT p.*
      FROM projects p
      LEFT JOIN quality_metrics qm ON p.id = qm.project_id
      WHERE p.status = 'completed'
        AND p.iteration_count < $1
        AND (qm.metric_value < $2 OR qm.metric_type != 'quality_score')
      GROUP BY p.id
      ORDER BY p.quality_score ASC
      LIMIT $3
    `, [MAX_ITERATIONS, QUALITY_THRESHOLD, limit]);
  }
}

export const queries = new OptimizedQueries();
```

### 5.3 索引策略

```sql
-- 项目表索引
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_quality_score ON projects(quality_score) WHERE status = 'completed';
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX idx_projects_status_iterations ON projects(status, iteration_count);

-- 创意表索引
CREATE INDEX idx_ideas_status ON ideas(status);
CREATE INDEX idx_ideas_priority ON ideas(priority DESC) WHERE status = 'pending';
CREATE INDEX idx_ideas_created_at ON ideas(created_at DESC);

-- 质量指标索引
CREATE INDEX idx_quality_metrics_project ON quality_metrics(project_id, recorded_at DESC);
CREATE INDEX idx_quality_metrics_type ON quality_metrics(metric_type, metric_value);

-- 知识库索引
CREATE INDEX idx_knowledge_embedding ON knowledge_entries USING GIN (embedding_vector);
CREATE INDEX idx_knowledge_category ON knowledge_entries(category, confidence_score DESC);

-- 复合索引
CREATE INDEX idx_projects_active_quality ON projects(status, quality_score DESC)
  WHERE status IN ('in_progress', 'reviewing');
```

## 6. LLM 调用优化

### 6.1 批量处理优化

```typescript
// src/agents/llm/batch-llm.ts
class BatchLLMProcessor {
  private queue: Array<{
    prompt: string;
    options?: LLMOptions;
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = [];
  private processing = false;
  private batchSize = 10;
  private batchDelayMs = 100;

  async invoke(prompt: string, options?: LLMOptions): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.queue.push({ prompt, options, resolve, reject });
      if (!this.processing) {
        this.processBatch();
      }
    });
  }

  private async processBatch(): Promise<void> {
    this.processing = true;

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize);

      // 并发处理，但限制并发数
      const results = await Promise.all(
        batch.map(item => this.executeWithRetry(item.prompt, item.options))
      );

      results.forEach((result, i) => {
        batch[i].resolve(result);
      });

      // 批次间延迟，避免 API 限流
      if (this.queue.length > 0) {
        await this.delay(this.batchDelayMs);
      }
    }

    this.processing = false;
  }

  private async executeWithRetry(
    prompt: string,
    options?: LLMOptions
  ): Promise<unknown> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= concurrencyConfig.llm.maxRetries; attempt++) {
      try {
        return await this.llm.invoke(prompt, options);
      } catch (error) {
        lastError = error as Error;
        if (attempt < concurrencyConfig.llm.maxRetries) {
          const delay = concurrencyConfig.llm.retryDelayMs *
            Math.pow(concurrencyConfig.llm.backoffMultiplier, attempt);
          await this.delay(delay);
        }
      }
    }

    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const batchLLM = new BatchLLMProcessor();
```

### 6.2 断路器模式

```typescript
// src/agents/llm/circuit-breaker.ts
type CircuitState = 'closed' | 'open' | 'half-open';

class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly config: typeof concurrencyConfig.llm.circuitBreaker;

  constructor(config: typeof concurrencyConfig.llm.circuitBreaker) {
    this.config = config;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeoutMs) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
      console.warn(`Circuit breaker opened after ${this.failureCount} failures`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

export const llmCircuitBreaker = new CircuitBreaker(concurrencyConfig.llm.circuitBreaker);
```

### 6.3 流式响应处理

```typescript
// src/agents/llm/streaming.ts
class StreamingLLMHandler {
  async *streamGenerate(
    prompt: string,
    options?: LLMOptions
  ): AsyncGenerator<string> {
    const stream = await this.llm.stream(prompt, options);

    for await (const chunk of stream) {
      yield chunk.content;
    }
  }

  // 带缓冲的流式处理，减少 I/O 次数
  async *bufferedStream(
    prompt: string,
    options?: LLMOptions,
    bufferSize = 100
  ): AsyncGenerator<string> {
    const stream = await this.llm.stream(prompt, options);
    let buffer = '';

    for await (const chunk of stream) {
      buffer += chunk.content;

      if (buffer.length >= bufferSize) {
        yield buffer;
        buffer = '';
      }
    }

    if (buffer.length > 0) {
      yield buffer;
    }
  }
}

export const streamingLLM = new StreamingLLMHandler();
```

## 7. 知识库性能优化

### 7.1 向量索引优化

```typescript
// src/agents/knowledge/optimized-vector-store.ts
interface VectorIndexConfig {
  dimension: number;
  metric: 'cosine' | 'euclidean';
  indexType: 'hnsw' | 'ivf';
  M: number;           // HNSW 参数
  efConstruction: number;  // HNSW 参数
}

class OptimizedVectorStore {
  private index: any;
  private vectors: Float32Array[] = [];
  private config: VectorIndexConfig;

  constructor(config: VectorIndexConfig) {
    this.config = config;
    this.initIndex();
  }

  private initIndex(): void {
    // 使用 HNSW 索引，适合高效近似最近邻搜索
    this.index = {
      type: 'hnsw',
      M: this.config.M,
      efConstruction: this.config.efConstruction,
      efSearch: 100,  // 搜索精度
    };
  }

  async addVectors(vectors: Float32Array[], metadata: KnowledgeMetadata[]): Promise<void> {
    // 批量添加，优化 I/O
    const batchSize = 1000;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      const batchMeta = metadata.slice(i, i + batchSize);

      // 批量索引
      await this.indexBatch(batch, batchMeta);
    }
  }

  async search(
    queryVector: Float32Array,
    topK: number,
    filters?: Record<string, unknown>
  ): Promise<SearchResult[]> {
    // 带过滤条件的搜索
    if (filters) {
      return this.filteredSearch(queryVector, topK, filters);
    }

    // HNSW 搜索 O(log n)
    return this.hnswSearch(queryVector, topK);
  }

  private async hnswSearch(
    queryVector: Float32Array,
    topK: number
  ): Promise<SearchResult[]> {
    // 简化实现，实际使用 pgvector 或专门的向量数据库
    const results: SearchResult[] = [];

    // 模拟搜索过程
    const scores = this.vectors.map((v, i) => ({
      index: i,
      score: this.cosineSimilarity(queryVector, v),
    }));

    scores.sort((a, b) => b.score - a.score);

    return scores.slice(0, topK).map(s => ({
      id: s.index.toString(),
      score: s.score,
      metadata: {},
    }));
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export const vectorStore = new OptimizedVectorStore({
  dimension: 1536,  // OpenAI embedding dimension
  metric: 'cosine',
  indexType: 'hnsw',
  M: 16,
  efConstruction: 200,
});
```

### 7.2 检索缓存

```typescript
// src/agents/knowledge/retrieval-cache.ts
class RetrievalCache {
  private cache: L1Cache<string, SearchResult[]>;
  private ttlSeconds = 300;  // 5 分钟

  constructor() {
    this.cache = new L1Cache<string, SearchResult[]>(10000, this.ttlSeconds * 1000);
  }

  private generateCacheKey(query: string, topK: number, filters?: Record<string, unknown>): string {
    return JSON.stringify({ query, topK, filters });
  }

  async getOrCompute(
    query: string,
    topK: number,
    filters: Record<string, unknown> | undefined,
    compute: () => Promise<SearchResult[]>
  ): Promise<SearchResult[]> {
    const key = this.generateCacheKey(query, topK, filters);
    const cached = this.cache.get(key);

    if (cached) {
      return cached;
    }

    const results = await compute();
    this.cache.set(key, results);
    return results;
  }

  invalidate(query: string): void {
    // 实现基于前缀的失效
    console.log(`Invalidating cache for query: ${query}`);
  }

  clear(): void {
    // 清理所有缓存
  }
}

export const retrievalCache = new RetrievalCache();
```

## 8. 异步处理架构

### 8.1 消息队列设计

```typescript
// src/infra/queue/message-queue.ts
interface QueueMessage {
  id: string;
  type: string;
  payload: unknown;
  priority: 'high' | 'normal' | 'low';
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  scheduledAt?: number;
}

interface QueueConfig {
  maxSize: number;
  processingTimeout: number;
  deadLetterQueue: string[];
}

class InMemoryMessageQueue {
  private queues = {
    high: [] as QueueMessage[],
    normal: [] as QueueMessage[],
    low: [] as QueueMessage[],
  };
  private processing = new Map<string, Promise<void>>();
  private config: QueueConfig;

  constructor(config: QueueConfig) {
    this.config = config;
  }

  async enqueue(message: QueueMessage): Promise<void> {
    const queue = this.queues[message.priority];
    if (queue.length >= this.config.maxSize) {
      throw new Error('Queue is full');
    }
    queue.push(message);
  }

  async dequeue(workerId: string): Promise<QueueMessage | undefined> {
    // 按优先级取出消息
    for (const priority of ['high', 'normal', 'low'] as const) {
      const queue = this.queues[priority];
      if (queue.length > 0) {
        const message = queue.shift()!;

        // 设置处理超时
        const processingPromise = this.processWithTimeout(message, workerId);
        this.processing.set(message.id, processingPromise);

        return message;
      }
    }
    return undefined;
  }

  private async processWithTimeout(
    message: QueueMessage,
    workerId: string
  ): Promise<void> {
    try {
      await Promise.race([
        this.processMessage(message),
        this.timeout(this.config.processingTimeout),
      ]);
    } catch (error) {
      console.error(`Processing failed for message ${message.id}:`, error);
      await this.handleFailure(message);
    } finally {
      this.processing.delete(message.id);
    }
  }

  private async processMessage(message: QueueMessage): Promise<void> {
    // 实际的消息处理逻辑
    console.log(`Processing message ${message.id}`);
  }

  private async handleFailure(message: QueueMessage): Promise<void> {
    if (message.retryCount < message.maxRetries) {
      message.retryCount++;
      await this.enqueue(message);
    } else {
      // 发送到死信队列
      console.error(`Message ${message.id} sent to DLQ after ${message.maxRetries} retries`);
    }
  }

  private timeout(ms: number): Promise<void> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Processing timeout')), ms)
    );
  }

  getStats() {
    return {
      high: this.queues.high.length,
      normal: this.queues.normal.length,
      low: this.queues.low.length,
      processing: this.processing.size,
    };
  }
}

export const projectQueue = new InMemoryMessageQueue({
  maxSize: 1000,
  processingTimeout: 300000,  // 5 分钟
  deadLetterQueue: ['project-dlq'],
});
```

### 8.2 事件驱动架构

```typescript
// src/infra/events/event-bus.ts
type EventHandler<T = unknown> = (event: T) => Promise<void>;

interface Event {
  type: string;
  payload: unknown;
  timestamp: number;
  correlationId?: string;
}

class EventBus {
  private handlers = new Map<string, EventHandler[]>();
  private eventLog: Event[] = [];

  subscribe<T>(eventType: string, handler: EventHandler<T>): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler as EventHandler);
    this.handlers.set(eventType, handlers);
  }

  async publish(event: Event): Promise<void> {
    this.eventLog.push(event);

    const handlers = this.handlers.get(event.type) || [];
    await Promise.all(
      handlers.map(handler =>
        handler(event.payload).catch(err => {
          console.error(`Handler error for ${event.type}:`, err);
        })
      )
    );
  }

  getRecentEvents(count: number): Event[] {
    return this.eventLog.slice(-count);
  }
}

// 定义事件类型
const ProjectEvents = {
  IDEA_GENERATED: 'idea.generated',
  PROJECT_CREATED: 'project.created',
  PROJECT_STAGE_CHANGED: 'project.stage_changed',
  QUALITY_ASSESSED: 'project.quality_assessed',
  PROJECT_COMPLETED: 'project.completed',
  PROJECT_FAILED: 'project.failed',
} as const;

export const eventBus = new EventBus();

// 使用示例：订阅事件
eventBus.subscribe(ProjectEvents.PROJECT_STAGE_CHANGED, async (payload: unknown) => {
  const { projectId, fromStage, toStage } = payload as any;
  console.log(`Project ${projectId} transitioned from ${fromStage} to ${toStage}`);
  // 更新缓存、发送通知等
});
```

## 9. 资源管理

### 9.1 内存管理

```typescript
// src/infra/memory/memory-manager.ts
interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

class MemoryManager {
  private readonly threshold: number;
  private readonly checkInterval: number;

  constructor(threshold = 0.8, checkInterval = 30000) {
    this.threshold = threshold;
    this.checkInterval = checkInterval;

    // 定期检查内存
    setInterval(() => this.checkMemory(), checkInterval);
  }

  private checkMemory(): void {
    const stats = this.getMemoryStats();
    const usageRatio = stats.heapUsed / stats.heapTotal;

    if (usageRatio > this.threshold) {
      console.warn(`Memory usage high: ${(usageRatio * 100).toFixed(1)}%`);
      this.triggerCleanup();
    }
  }

  private triggerCleanup(): void {
    // 清理过期的缓存
    promptCache.cleanup?.();
    llmResponseCache.cleanup?.();

    // 触发 GC（如果可用）
    if (global.gc) {
      global.gc();
    }
  }

  getMemoryStats(): MemoryStats {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
    };
  }

  async forceCleanup(): Promise<MemoryStats> {
    this.triggerCleanup();
    // 等待下次事件循环，让 GC 完成
    await new Promise(resolve => setImmediate(resolve));
    return this.getMemoryStats();
  }
}

export const memoryManager = new MemoryManager();
```

### 9.2 连接池管理

```typescript
// src/infra/connections/connection-manager.ts
class ConnectionManager {
  private dbPool: Pool;
  private redisClients: Map<string, Redis> = new Map();
  private llmClients: Map<string, any> = new Map();

  constructor() {
    this.dbPool = new Pool(optimizedPoolConfig);
  }

  async getDatabase(): Promise<Pool> {
    return this.dbPool;
  }

  async getRedis(name = 'default'): Promise<Redis> {
    let client = this.redisClients.get(name);
    if (!client) {
      client = new Redis(process.env.REDIS_URL!);
      this.redisClients.set(name, client);
    }
    return client;
  }

  async healthCheck(): Promise<{
    database: boolean;
    redis: Record<string, boolean>;
  }> {
    const dbHealth = await this.checkDatabase();
    const redisHealth: Record<string, boolean> = {};

    for (const [name, client] of this.redisClients) {
      redisHealth[name] = (await client.ping()) === 'PONG';
    }

    return {
      database: dbHealth,
      redis: redisHealth,
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.dbPool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async closeAll(): Promise<void> {
    await this.dbPool.end();
    for (const client of this.redisClients.values()) {
      await client.quit();
    }
    this.redisClients.clear();
  }
}

export const connectionManager = new ConnectionManager();
```

## 10. 性能监控与告警

### 10.1 性能指标收集

```typescript
// src/infra/monitoring/performance-collector.ts
interface PerformanceMetrics {
  requestCount: number;
  errorCount: number;
  latencyMs: {
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: number;  // requests/second
}

class PerformanceCollector {
  private histogram: Map<string, number[]> = new Map();
  private counters: Map<string, number> = new Map();
  private startTime = Date.now();

  recordLatency(endpoint: string, latencyMs: number): void {
    const values = this.histogram.get(endpoint) || [];
    values.push(latencyMs);
    if (values.length > 10000) values.shift();
    this.histogram.set(endpoint, values);
  }

  incrementCounter(name: string, delta = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + delta);
  }

  getMetrics(): PerformanceMetrics {
    const now = Date.now();
    const uptime = (now - this.startTime) / 1000;

    const requestCount = this.counters.get('requests') || 0;
    const errorCount = this.counters.get('errors') || 0;

    return {
      requestCount,
      errorCount,
      latencyMs: this.calculateLatencies(),
      throughput: requestCount / uptime,
    };
  }

  private calculateLatencies(): { p50: number; p95: number; p99: number } {
    const allLatencies: number[] = [];
    for (const values of this.histogram.values()) {
      allLatencies.push(...values);
    }

    if (allLatencies.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    allLatencies.sort((a, b) => a - b);

    const percentile = (p: number) => {
      const index = Math.ceil(allLatencies.length * p) - 1;
      return allLatencies[index];
    };

    return {
      p50: percentile(0.5),
      p95: percentile(0.95),
      p99: percentile(0.99),
    };
  }

  reset(): void {
    this.histogram.clear();
    this.counters.clear();
    this.startTime = Date.now();
  }
}

export const perfCollector = new PerformanceCollector();
```

### 10.2 性能告警规则

```typescript
// src/infra/monitoring/alert-rules.ts
interface AlertRule {
  name: string;
  condition: () => boolean;
  severity: 'critical' | 'warning';
  message: string;
  cooldownMs: number;
  lastTriggered?: number;
}

const alertRules: AlertRule[] = [
  {
    name: 'high_latency',
    condition: () => {
      const metrics = perfCollector.getMetrics();
      return metrics.latencyMs.p99 > 1000;  // P99 > 1s
    },
    severity: 'warning',
    message: 'P99 latency exceeds 1 second',
  },
  {
    name: 'high_error_rate',
    condition: () => {
      const metrics = perfCollector.getMetrics();
      return metrics.requestCount > 100 && metrics.errorCount / metrics.requestCount > 0.05;
    },
    severity: 'critical',
    message: 'Error rate exceeds 5%',
  },
  {
    name: 'llm_circuit_open',
    condition: () => llmCircuitBreaker.getState() === 'open',
    severity: 'critical',
    message: 'LLM circuit breaker is OPEN',
  },
  {
    name: 'memory_high',
    condition: () => {
      const stats = memoryManager.getMemoryStats();
      return stats.heapUsed / stats.heapTotal > 0.9;
    },
    severity: 'warning',
    message: 'Memory usage exceeds 90%',
  },
  {
    name: 'queue_backlog',
    condition: () => {
      const stats = projectQueue.getStats();
      return stats.high + stats.normal > 500;
    },
    severity: 'warning',
    message: 'Message queue backlog exceeds 500',
  },
];

class AlertEvaluator {
  private readonly cooldownMs: number;

  constructor(cooldownMs = 60000) {
    this.cooldownMs = cooldownMs;
  }

  evaluate(): Alert[] {
    const alerts: Alert[] = [];

    for (const rule of alertRules) {
      if (rule.lastTriggered && Date.now() - rule.lastTriggered < rule.cooldownMs) {
        continue;
      }

      if (rule.condition()) {
        rule.lastTriggered = Date.now();
        alerts.push({
          name: rule.name,
          severity: rule.severity,
          message: rule.message,
          timestamp: Date.now(),
        });
      }
    }

    return alerts;
  }
}

export const alertEvaluator = new AlertEvaluator();
```

## 11. 性能测试策略

### 11.1 基准测试

```typescript
// tests/benchmark/api-benchmark.ts
interface BenchmarkResult {
  name: string;
  iterations: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
  throughput: number;
}

async function runBenchmark(
  name: string,
  fn: () => Promise<void>,
  iterations = 100
): Promise<BenchmarkResult> {
  const durations: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await fn();
    durations.push(Date.now() - start);
  }

  durations.sort((a, b) => a - b);

  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const p95 = durations[Math.floor(durations.length * 0.95)];

  return {
    name,
    iterations,
    avgMs: avg,
    minMs: durations[0],
    maxMs: durations[durations.length - 1],
    p95Ms: p95,
    throughput: 1000 / avg,
  };
}

// 基准测试用例
const benchmarks = [
  {
    name: 'llm_single_call',
    fn: async () => {
      await batchLLM.invoke('What is 2+2?', { model: 'gpt-4' });
    },
  },
  {
    name: 'vector_search',
    fn: async () => {
      const queryVector = new Float32Array(1536).fill(Math.random());
      await vectorStore.search(queryVector, 10);
    },
  },
  {
    name: 'db_query_simple',
    fn: async () => {
      await queries.findProjectById('test-id');
    },
  },
];
```

### 11.2 负载测试

```typescript
// tests/load/load-test.ts
interface LoadTestConfig {
  duration: number;      // 测试持续时间（秒）
  concurrentUsers: number;
  rampUpTime: number;     // 预热时间（秒）
  targetRPS: number;     // 目标 QPS
}

async function runLoadTest(
  endpoint: string,
  config: LoadTestConfig,
  requestFn: () => Promise<Response>
): Promise<LoadTestResult> {
  const results: { latency: number; status: number }[] = [];
  const startTime = Date.now();
  let activeRequests = 0;

  // 使用令牌桶算法控制 QPS
  const tokenBucket = {
    tokens: config.targetRPS,
    refillRate: config.targetRPS,
    lastRefill: Date.now(),

    consume(): boolean {
      const now = Date.now();
      const elapsed = (now - this.lastRefill) / 1000;
      this.tokens = Math.min(
        config.targetRPS,
        this.tokens + elapsed * this.refillRate
      );
      this.lastRefill = now;

      if (this.tokens >= 1) {
        this.tokens--;
        return true;
      }
      return false;
    },
  };

  const workers = Array.from({ length: config.concurrentUsers }, async (_, i) => {
    while (Date.now() - startTime < config.duration * 1000) {
      if (tokenBucket.consume()) {
        activeRequests++;
        const latency = Date.now();
        try {
          const response = await requestFn();
          results.push({
            latency: Date.now() - latency,
            status: response.status,
          });
        } finally {
          activeRequests--;
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }
  });

  await Promise.all(workers);

  return analyzeResults(results);
}
```

---

**最后更新**: 2026-04-14
**版本**: v1.0
