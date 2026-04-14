# 缓存与性能优化系统

## 概述

缓存与性能优化系统（Caching & Performance Optimization System）是确保ProjectFactory系统高并发、低延迟运行的关键基础设施。系统采用多级缓存架构，覆盖从CDN到内存的各个层次，结合智能缓存策略和性能监控，确保在负载高峰时依然保持卓越性能。

## 核心价值

- **多级缓存**：CDN → 应用层 → 内存层 → 数据库缓存
- **智能失效**：基于时间、容量、依赖的智能缓存失效策略
- **性能监控**：完整的缓存命中率和性能指标追踪
- **一致性保证**：缓存与源数据的最终一致性保障
- **弹性扩展**：缓存容量和节点的动态扩展

## 缓存架构

### 多级缓存架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        缓存层级                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  L1: CDN缓存 (Edge)                                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 静态资源、API响应、下载文件                                 │ │
│  │ TTL: 可配置，通常5min-24h                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  L2: 应用缓存 (Redis Cluster)                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 会话数据、Token、实时配置、热门数据                         │ │
│  │ TTL: 1min - 24h                                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  L3: 进程内缓存 (内存/LRU)                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 热点数据、计算结果、频次限制器                             │ │
│  │ TTL: 10s - 5min                                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  L4: 数据库缓存 (Query Cache)                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 查询结果集、聚合数据、统计数据                             │ │
│  │ TTL: 30s - 10min                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 缓存策略配置

```typescript
// 缓存配置
interface CacheConfig {
  // 缓存级别
  levels: CacheLevel[];

  // 全局策略
  global: {
    defaultTTL: number;            // 默认TTL（秒）
    maxMemory?: number;           // 最大内存使用
    evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'ttl';
    compression?: {
      enabled: boolean;
      algorithm: 'gzip' | 'lz4' | 'zstd';
      minSize: number;           // 最小压缩大小
    };
  };

  // 命名空间
  namespaces: Record<string, NamespaceConfig>;
}

interface CacheLevel {
  name: 'cdn' | 'redis' | 'memory' | 'db';
  enabled: boolean;
  config: Record<string, any>;
}

interface NamespaceConfig {
  ttl: number;                    // TTL（秒）
  maxSize?: number;               // 最大条目数
  evictionPolicy?: string;
  invalidateOn?: string[];        // 失效触发事件
}

// 缓存命名空间
const CACHE_NAMESPACES = {
  // 项目数据
  'project': {
    ttl: 300,                   // 5分钟
    maxSize: 10000,
    invalidateOn: ['project.updated', 'project.deleted'],
  },

  // 用户数据
  'user': {
    ttl: 600,                   // 10分钟
    maxSize: 50000,
    invalidateOn: ['user.updated'],
  },

  // 生成状态
  'generation': {
    ttl: 30,                    // 30秒
    maxSize: 5000,
  },

  // 配置数据
  'config': {
    ttl: 3600,                  // 1小时
    maxSize: 1000,
  },

  // API响应
  'api_response': {
    ttl: 60,                    // 1分钟
    maxSize: 50000,
    compression: { enabled: true, algorithm: 'gzip', minSize: 1024 },
  },
};
```

## 缓存客户端

### TypeScript缓存客户端

```typescript
// 缓存客户端接口
interface CacheClient {
  // 获取
  get<T>(key: string): Promise<T | null>;

  // 设置
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;

  // 删除
  delete(key: string): Promise<void>;

  // 检查存在
  has(key: string): Promise<boolean>;

  // 批量操作
  getMany<T>(keys: string[]): Promise<Map<string, T | null>>;
  setMany<T>(entries: Record<string, T>, options?: CacheOptions): Promise<void>;
  deleteMany(keys: string[]): Promise<void>;

  // 模式删除
  deletePattern(pattern: string): Promise<number>;

  // 统计
  stats(): Promise<CacheStats>;
}

interface CacheOptions {
  ttl?: number;                 // TTL（秒）
  tags?: string[];              // 标签
  version?: number;              // 版本号
  compress?: boolean;           // 是否压缩
}

// 缓存选项
interface CacheOptions {
  ttl?: number;
  tags?: string[];
  version?: number;
}

// Redis缓存实现
class RedisCacheClient implements CacheClient {
  private redis: Redis;
  private prefix: string;

  constructor(redis: Redis, prefix: string = 'cache') {
    this.redis = redis;
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(this.getKey(key));
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const serialized = JSON.stringify(value);
    const ttl = options?.ttl;

    if (ttl) {
      await this.redis.setex(this.getKey(key), ttl, serialized);
    } else {
      await this.redis.set(this.getKey(key), serialized);
    }

    // 设置标签
    if (options?.tags) {
      for (const tag of options.tags) {
        await this.redis.sadd(`${this.getKey(key)}:tags:${tag}`, key);
      }
    }
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(this.getKey(key));
  }

  async has(key: string): Promise<boolean> {
    return (await this.redis.exists(this.getKey(key))) === 1;
  }

  async getMany<T>(keys: string[]): Promise<Map<string, T | null>> {
    if (keys.length === 0) return new Map();

    const pipeline = this.redis.pipeline();
    for (const key of keys) {
      pipeline.get(this.getKey(key));
    }

    const results = await pipeline.exec();
    const map = new Map<string, T | null>();

    keys.forEach((key, index) => {
      const [err, value] = results[index];
      if (!err && value) {
        try {
          map.set(key, JSON.parse(value) as T);
        } catch {
          map.set(key, null);
        }
      } else {
        map.set(key, null);
      }
    });

    return map;
  }

  async deletePattern(pattern: string): Promise<number> {
    const keys = await this.redis.keys(`${this.prefix}:${pattern}`);
    if (keys.length === 0) return 0;
    return this.redis.del(...keys);
  }

  async stats(): Promise<CacheStats> {
    const info = await this.redis.info('stats');
    return {
      hits: this.parseInfoValue(info, 'keyspace_hits'),
      misses: this.parseInfoValue(info, 'keyspace_misses'),
      keys: await this.redis.dbsize(),
    };
  }
}

// 内存缓存实现
class MemoryCacheClient implements CacheClient {
  private cache: Map<string, CacheEntry>;
  private accessOrder: string[];
  private maxSize: number;
  private maxMemory: number;

  constructor(config: { maxSize?: number; maxMemory?: number }) {
    this.cache = new Map();
    this.accessOrder = [];
    this.maxSize = config.maxSize || 10000;
    this.maxMemory = config.maxMemory || 100 * 1024 * 1024; // 100MB
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // 检查过期
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      this.cache.delete(key);
      return null;
    }

    // 更新访问顺序
    this.updateAccessOrder(key);

    return entry.value as T;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    // 检查容量
    if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
      await this.evict();
    }

    const entry: CacheEntry = {
      value,
      ttl: options?.ttl,
      expiresAt: options?.ttl ? new Date(Date.now() + options.ttl * 1000) : null,
      tags: options?.tags,
      size: this.estimateSize(value),
      createdAt: new Date(),
    };

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
  }

  private async evict(): Promise<void> {
    if (this.accessOrder.length === 0) return;

    const oldestKey = this.accessOrder.shift();
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}
```

## 缓存策略

### 缓存模式

```typescript
// 缓存模式
enum CachePattern {
  // Cache-Aside (旁路缓存)
  CACHE_ASIDE = 'cache_aside',

  // Read-Through (读穿透)
  READ_THROUGH = 'read_through',

  // Write-Through (写穿透)
  WRITE_THROUGH = 'write_through',

  // Write-Behind (写回)
  WRITE_BEHIND = 'write_behind',

  // Refresh-Ahead (预刷新)
  REFRESH_AHEAD = 'refresh_ahead',
}

// 缓存-aside实现
class CacheAsideStrategy<T> {
  constructor(
    private cache: CacheClient,
    private source: () => Promise<T>,
    private key: string,
    private ttl: number
  ) {}

  async get(): Promise<T> {
    // 1. 先查缓存
    const cached = await this.cache.get<T>(this.key);
    if (cached !== null) {
      return cached;
    }

    // 2. 缓存未命中，从源获取
    const value = await this.source();

    // 3. 写入缓存
    await this.cache.set(this.key, value, { ttl: this.ttl });

    return value;
  }

  async invalidate(): Promise<void> {
    await this.cache.delete(this.key);
  }
}

// 读穿透实现
class ReadThroughStrategy<T> {
  async get(key: string, loader: () => Promise<T>, ttl: number): Promise<T> {
    // 1. 查缓存
    const cached = await this.cache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // 2. 缓存未命中，loader自动写入缓存
    const value = await loader();
    await this.cache.set(key, value, { ttl });

    return value;
  }
}

// 写穿透实现
class WriteThroughStrategy {
  async set(key: string, value: any, source: DataSource): Promise<void> {
    // 1. 写入缓存
    await this.cache.set(key, value);

    // 2. 同步写入源数据库
    await source.save(key, value);
  }
}

// 写回实现
class WriteBehindStrategy {
  private pendingWrites: Map<string, any> = new Map();
  private flushInterval: number = 5000; // 5秒

  async set(key: string, value: any): Promise<void> {
    // 1. 写入缓存
    await this.cache.set(key, value);

    // 2. 记录待写操作
    this.pendingWrites.set(key, value);

    // 3. 批量写回（异步）
    this.scheduleFlush();
  }

  private async scheduleFlush(): Promise<void> {
    // 实现批量写回逻辑
  }
}
```

### 缓存失效策略

```typescript
// 缓存失效策略
interface InvalidationStrategy {
  // 基于时间
  ttl: number;

  // 基于容量
  maxSize?: number;

  // 基于依赖
  dependencies?: string[];

  // 事件驱动失效
  events?: string[];

  // 主动刷新
  proactiveRefresh?: {
    enabled: boolean;
    refreshThreshold: number;     // 剩余TTL比例
    refreshAheadTime: number;    // 提前刷新时间
  };
}

// 事件驱动的缓存失效
class EventDrivenInvalidation {
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;

    // 订阅缓存失效事件
    this.eventBus.subscribe('cache.invalidate', this.handleInvalidate.bind(this));
  }

  async handleInvalidate(event: CacheInvalidateEvent): Promise<void> {
    const { keys, tags, pattern } = event;

    if (keys) {
      await this.cache.deleteMany(keys);
    }

    if (tags) {
      for (const tag of tags) {
        const keys = await this.cache.getKeysByTag(tag);
        await this.cache.deleteMany(keys);
      }
    }

    if (pattern) {
      await this.cache.deletePattern(pattern);
    }
  }

  // 清除相关缓存
  invalidateRelated(entityType: string, entityId: string): void {
    this.eventBus.publish({
      type: 'cache.invalidate',
      payload: {
        tags: [`${entityType}:${entityId}`, entityType],
      },
    });
  }
}

// 主动刷新
class ProactiveRefresh {
  private refreshQueue: PQueue;
  private running: boolean = false;

  async start(): Promise<void> {
    this.running = true;
    await this.runRefreshLoop();
  }

  private async runRefreshLoop(): Promise<void> {
    while (this.running) {
      // 扫描即将过期的缓存
      const expiringKeys = await this.findExpiringKeys({
        threshold: 0.2,  // 剩余20%TTL
      });

      // 并发刷新
      await this.refreshQueue.addAll(
        expiringKeys.map(key => () => this.refresh(key))
      );

      await this.sleep(10000); // 10秒
    }
  }

  private async refresh(key: string): Promise<void> {
    const value = await this.loader(key);
    await this.cache.set(key, value, { ttl: this.getTTL(key) });
  }
}
```

## 性能优化

### 查询优化

```typescript
// 查询缓存装饰器
function cachedQuery<T>(
  namespace: string,
  ttl: number,
  keyGenerator?: (args: any[]) => string
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cache = this.cache;
      const cacheKey = keyGenerator
        ? `${namespace}:${keyGenerator(args)}`
        : `${namespace}:${JSON.stringify(args)}`;

      // 尝试从缓存获取
      const cached = await cache.get<T>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // 执行原始方法
      const result = await originalMethod.apply(this, args);

      // 写入缓存
      await cache.set(cacheKey, result, { ttl });

      return result;
    };

    return descriptor;
  };
}

// 使用示例
class ProjectService {
  @cachedQuery('project', 300, (id) => `project:${id}`)
  async getProject(id: string): Promise<Project> {
    return this.db.projects.findById(id);
  }

  @cachedQuery('projects:list', 60, (opts) => JSON.stringify(opts))
  async listProjects(opts: ListOptions): Promise<Project[]> {
    return this.db.projects.findAll(opts);
  }
}

// N+1查询优化
class QueryOptimizer {
  // 批量加载
  async batchLoad<T, K>(
    items: T[],
    idExtractor: (item: T) => K,
    loader: (ids: K[]) => Promise<Map<K, any>>
  ): Promise<T[]> {
    // 提取所有ID
    const ids = items.map(idExtractor);

    // 批量查询
    const loaded = await this.cache.getMany(ids.map(id => `item:${id}`));

    // 找出未缓存的ID
    const missingIds = ids.filter(id => !loaded.has(id));

    // 批量加载缺失的
    if (missingIds.length > 0) {
      const loadedMissing = await loader(missingIds);
      // 写入缓存
      await this.cache.setMany(
        Object.fromEntries(loadedMissing),
        { ttl: 300 }
      );
      // 合并结果
      loadedMissing.forEach((value, key) => loaded.set(`item:${key}`, value));
    }

    // 返回完整数据
    return items.map(item => ({
      ...item,
      ...loaded.get(`item:${idExtractor(item)}`),
    }));
  }
}
```

### 响应缓存

```typescript
// HTTP响应缓存
interface ResponseCacheOptions {
  statusCodes?: number[];        // 缓存的状态码
  methods?: string[];            // 缓存的方法
  ttl?: number;
  varyBy?: string[];            // Vary头
  skip?: (req: Request) => boolean; // 跳过条件
}

// 响应缓存中间件
function responseCacheMiddleware(options: ResponseCacheOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 检查是否跳过
    if (options.skip?.(req)) return next();

    // 只缓存特定状态码
    const cacheKey = `http:${req.method}:${req.path}:${JSON.stringify(req.query)}`;

    // 尝试获取缓存
    const cached = await cache.get<CachedResponse>(cacheKey);
    if (cached) {
      // 设置缓存头
      res.set('X-Cache', 'HIT');
      res.set('Cache-Control', `private, max-age=${cached.ttl}`);
      return res.json(cached.body);
    }

    // 拦截响应
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode === 200 || options.statusCodes?.includes(res.statusCode)) {
        cache.set(cacheKey, {
          body,
          ttl: options.ttl || 60,
        });
      }
      res.set('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}
```

## 缓存监控

### 统计指标

```typescript
// 缓存统计
interface CacheStats {
  // 命中统计
  hits: number;
  misses: number;
  hitRate: number;              // 命中率

  // 容量统计
  size: number;                 // 当前条目数
  maxSize: number;              // 最大条目数
  memoryUsed: number;            // 内存使用
  memoryMax: number;

  // 操作统计
  sets: number;
  deletes: number;
  evictions: number;            // 驱逐数
  expirations: number;          // 过期数

  // 性能统计
  avgGetLatency: number;        // 平均获取延迟(ms)
  avgSetLatency: number;        // 平均设置延迟(ms)
}

// 命中率仪表盘
const CACHE_DASHBOARD_CONFIG = {
  panels: [
    {
      title: 'Cache Hit Rate',
      type: 'gauge',
      metrics: ['cache.hit_rate'],
      thresholds: {
        green: 0.8,
        yellow: 0.5,
        red: 0,
      },
    },
    {
      title: 'Cache Operations/s',
      type: 'graph',
      metrics: ['cache.ops.get', 'cache.ops.set', 'cache.ops.delete'],
    },
    {
      title: 'Memory Usage',
      type: 'graph',
      metrics: ['cache.memory.used', 'cache.memory.max'],
    },
    {
      title: 'Top Keys by Access',
      type: 'table',
      query: 'topk(10, cache.access.count)',
    },
  ],
};
```

## 配置示例

```yaml
# 缓存配置
caching:
  # 全局设置
  global:
    default_ttl: 300
    max_memory_per_node: "1GB"
    eviction_policy: "lru"
    compression:
      enabled: true
      algorithm: "lz4"
      min_size: "1KB"

  # Redis配置
  redis:
    cluster:
      enabled: true
      nodes:
        - host: "10.0.0.1"
          port: 6379
        - host: "10.0.0.2"
          port: 6379
        - host: "10.0.0.3"
          port: 6379
    sentinel:
      enabled: false
    max_memory: "2GB"
    max_connections: 10000

  # 进程内缓存
  memory:
    max_size: 10000
    max_memory: "100MB"

  # CDN配置
  cdn:
    enabled: true
    provider: "cloudflare"  # cloudflare | cloudfront | custom
    default_ttl: 3600
    static_ttl: 86400
    cache_control:
      immutable: ["/*.js", "/*.css", "/*.woff2"]
      no_cache: ["/api/*"]
    invalidation:
      automatic: true
      purge_on_deploy: true

  # 缓存命名空间
  namespaces:
    project:
      ttl: 300
      max_size: 10000
      invalidation_events: ["project.updated", "project.deleted"]

    user:
      ttl: 600
      max_size: 50000
      invalidation_events: ["user.updated", "user.deleted"]

    generation:
      ttl: 30
      max_size: 5000

    config:
      ttl: 3600
      max_size: 1000

  # 监控
  monitoring:
    enabled: true
    stats_interval: "60s"
    log_cache_misses: true
    miss_threshold: 0.5  # 命中率低于50%时告警
```

## 最佳实践

```typescript
// 缓存最佳实践
const CACHING_BEST_PRACTICES = {
  // 键命名
  key_naming: {
    format: "{namespace}:{entity}:{id}:{variant}",
    examples: [
      "project:123:summary",
      "user:456:profile",
      "config:feature_flags",
    ],
    rules: [
      "使用冒号分隔层级",
      "避免特殊字符",
      "保持键长度合理(< 256 bytes)",
    ],
  },

  // TTL设置
  ttl_guidelines: {
    "real-time_data": "10-30s",
    "user_data": "5-15min",
    "session_data": "1-24h",
    "static_config": "1-24h",
    "static_assets": "1d-1w",
  },

  // 序列化
  serialization: {
    prefer: "msgpack | protobuf | json",
    compress_threshold: "1KB",
    compress_algorithm: "lz4",
  },

  // 一致性
  consistency: {
    pattern: "eventual_consistency",
    max_staleness: "5min",
    invalidation: "async_events",
  },

  // 错误处理
  error_handling: {
    on_cache_error: "fallback_to_source",
    on_source_error: "return_cached_if_available",
    circuit_breaker: true,
  },
};
```

---

**最后更新**: 2026-04-14
