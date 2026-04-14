# 多级缓存架构设计

## 1. 概述

本文档描述 ProjectFactory 系统的多级缓存架构设计，实现高命中率和低延迟。

### 1.1 设计目标

| 目标 | 描述 |
|------|------|
| 低延迟 | P99 缓存命中 < 5ms |
| 高可用 | 缓存故障不影响主服务 |
| 节省成本 | 减少数据库和 API 调用 |
| 一致性 | 缓存与源数据最终一致 |

### 1.2 缓存架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           多级缓存架构                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  L1: 进程内缓存 (Memory)                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Caffeine Cache                                                      │   │
│  │  - 大小: 10,000 条目                                                 │   │
│  │  - TTL: 1 分钟                                                       │   │
│  │  - 命中率目标: 60%                                                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                          │
│  L2: 分布式缓存 (Redis Cluster)                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Redis Cluster                                                       │   │
│  │  - 大小: 100,000 条目                                                │   │
│  │  - TTL: 5 分钟                                                       │   │
│  │  - 命中率目标: 25%                                                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                          │
│  L3: 数据库缓存 (SQLite)                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  SQLite (WAL 模式)                                                   │   │
│  │  - 查询结果缓存                                                      │   │
│  │  - 命中率目标: 10%                                                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 缓存策略

### 2.1 缓存类型

```typescript
// src/cache/types.ts

enum CacheType {
  // L1: 进程内缓存
  IN_MEMORY = 'in_memory',

  // L2: Redis 缓存
  REDIS = 'redis',

  // L3: 数据库缓存
  DATABASE = 'database',
}

interface CacheEntry<T> {
  key: string;
  value: T;
  type: CacheType;
  createdAt: number;
  expiresAt: number;
  hits: number;
  size: number;  // bytes
}

interface CacheConfig {
  type: CacheType;
  ttl: number;           // 生存时间 (ms)
  maxSize?: number;      // 最大条目数
  namespace?: string;    // 命名空间
}

const DEFAULT_CACHE_CONFIG: Record<string, CacheConfig> = {
  // 用户会话
  userSession: {
    type: CacheType.REDIS,
    ttl: 30 * 60 * 1000,  // 30 分钟
    namespace: 'session',
  },

  // 项目数据
  project: {
    type: CacheType.REDIS,
    ttl: 5 * 60 * 1000,  // 5 分钟
    namespace: 'project',
  },

  // 热门 Idea
  popularIdeas: {
    type: CacheType.IN_MEMORY,
    ttl: 60 * 1000,  // 1 分钟
    namespace: 'idea',
  },

  // LLM 响应
  llmResponse: {
    type: CacheType.REDIS,
    ttl: 60 * 60 * 1000,  // 1 小时
    namespace: 'llm',
  },

  // 查询结果
  queryResult: {
    type: CacheType.DATABASE,
    ttl: 10 * 60 * 1000,  // 10 分钟
    namespace: 'query',
  },
};
```

### 2.2 多级缓存管理器

```typescript
// src/cache/manager.ts
class MultiLevelCache<T> {
  private l1: InMemoryCache<T>;
  private l2: RedisCache<T>;
  private l3: DatabaseCache<T>;

  constructor(
    private name: string,
    private config: CacheConfig
  ) {
    this.l1 = new InMemoryCache<T>({
      maxSize: 10000,
      ttl: 60000,  // 1 分钟
    });

    this.l2 = new RedisCache<T>({
      prefix: `cache:${name}`,
      ttl: config.ttl,
    });

    this.l3 = new DatabaseCache<T>({
      table: `cache_${name}`,
      ttl: config.ttl * 2,
    });
  }

  // 获取缓存
  async get(key: string): Promise<T | null> {
    // L1
    let value = await this.l1.get(key);
    if (value !== null) {
      metrics.recordHit(CacheType.IN_MEMORY);
      return value;
    }

    // L2
    value = await this.l2.get(key);
    if (value !== null) {
      metrics.recordHit(CacheType.REDIS);
      // 回填 L1
      await this.l1.set(key, value);
      return value;
    }

    // L3
    value = await this.l3.get(key);
    if (value !== null) {
      metrics.recordHit(CacheType.DATABASE);
      // 回填 L1 和 L2
      await this.l1.set(key, value);
      await this.l2.set(key, value);
      return value;
    }

    metrics.recordMiss();
    return null;
  }

  // 设置缓存
  async set(key: string, value: T): Promise<void> {
    await Promise.all([
      this.l1.set(key, value),
      this.l2.set(key, value),
      this.l3.set(key, value),
    ]);
  }

  // 删除缓存
  async delete(key: string): Promise<void> {
    await Promise.all([
      this.l1.delete(key),
      this.l2.delete(key),
      this.l3.delete(key),
    ]);
  }

  // 清除命名空间
  async clear(): Promise<void> {
    await Promise.all([
      this.l1.clear(),
      this.l2.clear(this.name),
      this.l3.clear(this.name),
    ]);
  }

  // 获取统计
  async getStats(): Promise<CacheStats> {
    return {
      l1: await this.l1.getStats(),
      l2: await this.l2.getStats(),
      l3: await this.l3.getStats(),
    };
  }
}
```

### 2.3 L1 进程内缓存 (Caffeine)

```typescript
// src/cache/l1-caffeine.ts
import Caffeine from 'caffeine-cache';

interface InMemoryCacheConfig {
  maxSize: number;
  ttl: number;
  initialCapacity?: number;
}

class InMemoryCache<T> {
  private cache: Caffeine.Cache<string, T>;

  constructor(config: InMemoryCacheConfig) {
    this.cache = Caffeine.newBuilder()
      .maximumSize(config.maxSize)
      .expireAfterWriteMillis(config.ttl)
      .initialCapacity(config.initialCapacity || 1000)
      .recordStats()
      .build();
  }

  async get(key: string): Promise<T | null> {
    return this.cache.get(key) || null;
  }

  async set(key: string, value: T): Promise<void> {
    this.cache.put(key, value);
  }

  async delete(key: string): Promise<void> {
    this.cache.invalidate(key);
  }

  async clear(): Promise<void> {
    this.cache.invalidateAll();
  }

  getStats(): CacheLevelStats {
    const stats = this.cache.stats();
    return {
      size: this.cache.estimatedSize(),
      hits: stats.hits(),
      misses: stats.misses(),
      hitRate: stats.hitRate(),
      evictions: stats.evictionCount(),
    };
  }
}
```

### 2.4 L2 Redis 缓存

```typescript
// src/cache/l2-redis.ts
import Redis from 'ioredis';

interface RedisCacheConfig {
  prefix: string;
  ttl: number;
  compress?: boolean;
}

class RedisCache<T> {
  private redis: Redis;
  private prefix: string;
  private ttl: number;
  private compress: boolean;

  constructor(config: RedisCacheConfig) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: 6379,
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
    this.prefix = config.prefix;
    this.ttl = config.ttl;
    this.compress = config.compress ?? false;
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async get(key: string): Promise<T | null> {
    const data = await this.redis.get(this.getKey(key));
    if (!data) return null;

    try {
      const decoded = this.compress
        ? zlib.decompressSync(Buffer.from(data, 'base64'))
        : data;

      return JSON.parse(decoded.toString());
    } catch {
      return null;
    }
  }

  async set(key: string, value: T): Promise<void> {
    const serialized = JSON.stringify(value);
    const data = this.compress
      ? zlib.compressSync(serialized).toString('base64')
      : serialized;

    await this.redis.setex(this.getKey(key), Math.ceil(this.ttl / 1000), data);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(this.getKey(key));
  }

  async clear(pattern: string): Promise<void> {
    const keys = await this.redis.keys(`${this.prefix}:${pattern}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async getStats(): Promise<CacheLevelStats> {
    const info = await this.redis.info('stats');
    return {
      hits: parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0'),
      misses: parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0'),
    };
  }
}
```

---

## 3. 缓存模式

### 3.1 Cache-Aside

```typescript
// 缓存旁路模式
async function getProjectCacheAside(
  projectId: string
): Promise<Project> {
  const cache = cacheManager.get('project');

  // 1. 先查缓存
  const cached = await cache.get(`project:${projectId}`);
  if (cached) {
    return cached;
  }

  // 2. 缓存未命中，查数据库
  const project = await db.projects.findById(projectId);
  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  // 3. 写入缓存
  await cache.set(`project:${projectId}`, project);

  return project;
}

// 更新时删除缓存
async function updateProjectCacheAside(
  projectId: string,
  data: UpdateProjectInput
): Promise<Project> {
  // 1. 更新数据库
  const project = await db.projects.update(projectId, data);

  // 2. 删除缓存 (不是更新，避免不一致)
  await cacheManager.get('project').delete(`project:${projectId}`);

  return project;
}
```

### 3.2 Write-Through

```typescript
// 写穿模式
async function updateProjectWriteThrough(
  projectId: string,
  data: UpdateProjectInput
): Promise<Project> {
  const cache = cacheManager.get('project');

  // 1. 写数据库
  const project = await db.projects.update(projectId, data);

  // 2. 同步写缓存
  await cache.set(`project:${projectId}`, project);

  return project;
}
```

### 3.3 Read-Through

```typescript
// 读穿透模式
class ReadThroughCache<K, V> {
  constructor(
    private cache: MultiLevelCache<V>,
    private loader: (key: K) => Promise<V>
  ) {}

  async get(key: K): Promise<V> {
    // 1. 查缓存
    const cached = await this.cache.get(String(key));
    if (cached) {
      return cached;
    }

    // 2. 缓存未命中，加载数据
    const value = await this.loader(key);
    if (value) {
      await this.cache.set(String(key), value);
    }

    return value;
  }
}

// 使用
const projectCache = new ReadThroughCache<string, Project>(
  cacheManager.get('project'),
  (id) => db.projects.findById(id)
);

const project = await projectCache.get('proj_123');
```

---

## 4. 缓存失效

### 4.1 TTL 策略

```typescript
// TTL 配置
const TTL_STRATEGY = {
  // 静态数据 (变化少)
  static: {
    userProfile: 60 * 60 * 1000,      // 1 小时
    projectTemplate: 24 * 60 * 60 * 1000,  // 1 天
  },

  // 动态数据 (频繁变化)
  dynamic: {
    projectStatus: 10 * 1000,          // 10 秒
    generationProgress: 5 * 1000,      // 5 秒
    metrics: 30 * 1000,                // 30 秒
  },

  // 用户数据
  user: {
    session: 30 * 60 * 1000,           // 30 分钟
    preferences: 60 * 60 * 1000,        // 1 小时
    quota: 5 * 60 * 1000,              // 5 分钟
  },
};
```

### 4.2 手动失效

```typescript
// 基于事件的缓存失效
class CacheInvalidator {
  async invalidateProject(projectId: string): Promise<void> {
    const keys = [
      `project:${projectId}`,
      `project:${projectId}:files`,
      `project:${projectId}:metrics`,
      `project:${projectId}:history`,
    ];

    await Promise.all(
      keys.map((key) => cacheManager.get('project').delete(key))
    );

    // 发布失效事件
    await eventBus.publish({
      type: 'cache.invalidated',
      payload: { type: 'project', id: projectId, keys },
    });
  }

  // 模式匹配失效
  async invalidatePattern(pattern: string): Promise<void> {
    await cacheManager.get('project').clear(pattern);
  }
}

// 订阅项目更新事件
eventBus.subscribe('project.updated', async (event) => {
  await cacheInvalidator.invalidateProject(event.payload.projectId);
});
```

---

## 5. 缓存监控

### 5.1 缓存指标

```typescript
// 缓存指标收集
class CacheMetrics {
  private hits: Map<CacheType, number> = new Map();
  private misses: Map<CacheType, number> = new Map();

  recordHit(type: CacheType): void {
    this.hits.set(type, (this.hits.get(type) || 0) + 1);
  }

  recordMiss(): void {
    // L3 miss
    this.misses.set(CacheType.DATABASE, (this.misses.get(CacheType.DATABASE) || 0) + 1);
  }

  getMetrics(): CacheMetricsResult {
    const types = [CacheType.IN_MEMORY, CacheType.REDIS, CacheType.DATABASE];
    const total = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      byType: {} as Record<CacheType, { hits: number; misses: number; hitRate: number }>,
    };

    for (const type of types) {
      const h = this.hits.get(type) || 0;
      const m = this.misses.get(type) || 0;
      const rate = h + m > 0 ? h / (h + m) : 0;

      total.hits += h;
      total.misses += m;
      total.byType[type] = { hits: h, misses: m, hitRate: rate };
    }

    total.hitRate = total.hits + total.misses > 0
      ? total.hits / (total.hits + total.misses)
      : 0;

    return total;
  }
}

export const cacheMetrics = new CacheMetrics();
```

### 5.2 缓存告警

```typescript
// 缓存告警规则
const CACHE_ALERT_RULES = [
  {
    name: 'hit-rate-low',
    condition: (metrics) => metrics.hitRate < 0.8,
    severity: 'warning',
    message: `Cache hit rate below 80%: ${(metrics.hitRate * 100).toFixed(1)}%`,
  },
  {
    name: 'l1-evictions-high',
    condition: (_, stats) => stats.l1.evictions > 10000,
    severity: 'warning',
  },
  {
    name: 'redis-connection-failed',
    condition: (metrics) => metrics.redisErrors > 10,
    severity: 'critical',
  },
];
```

---

## 6. 相关文档

- [性能优化](./PERFORMANCE_OPTIMIZATION.md)
- [Redis 最佳实践](./REDIS_BEST_PRACTICES.md)
- [后端设计](./BACKEND_DESIGN.md)

---

**最后更新**: 2026-04-14
