# 容错与降级设计

## 1. 概述

本文档描述 ProjectFactory 系统的容错与降级设计，确保系统在部分组件故障时仍能提供服务。

### 1.1 设计目标

| 目标 | 描述 |
|------|------|
| 优雅降级 | 部分故障不影响核心功能 |
| 快速恢复 | 自动故障检测和恢复 |
| 资源保护 | 防止故障级联 |
| 用户知情 | 清晰的降级状态提示 |

### 1.2 降级级别

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          降级级别定义                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Level 0: 正常                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  全功能正常运行                                                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Level 1: 部分降级                                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  • 非关键功能禁用                                                     │   │
│  │  • 分析报告延迟生成                                                   │   │
│  │  • 缓存降级到内存                                                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Level 2: 严重降级                                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  • 只读模式                                                           │   │
│  │  • 暂停新项目生成                                                     │   │
│  │  • 简化 UI                                                           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Level 3: 紧急模式                                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  • 仅核心 API 可用                                                    │   │
│  │  • 静态页面服务                                                       │   │
│  │  • 维护公告                                                           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 故障检测

### 2.1 健康检查

```typescript
// src/resilience/health-check.ts
interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  message?: string;
  timestamp: number;
}

interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  level: number;  // 0-3
  checks: HealthCheck[];
  version: string;
  uptime: number;
}

class HealthChecker {
  private checks: Map<string, HealthCheckFn> = new Map();

  register(name: string, check: HealthCheckFn) {
    this.checks.set(name, check);
  }

  async check(): Promise<HealthStatus> {
    const results = await Promise.allSettled(
      Array.from(this.checks.entries()).map(async ([name, check]) => {
        const start = Date.now();
        try {
          await check();
          return {
            name,
            status: 'healthy',
            latency: Date.now() - start,
            timestamp: Date.now(),
          } as HealthCheck;
        } catch (error) {
          return {
            name,
            status: 'unhealthy',
            latency: Date.now() - start,
            message: (error as Error).message,
            timestamp: Date.now(),
          } as HealthCheck;
        }
      })
    );

    const checks = results.map(r => r.status === 'fulfilled' ? r.value : {
      name: 'unknown',
      status: 'unhealthy' as const,
      message: 'Check failed',
      timestamp: Date.now(),
    });

    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
    const degradedCount = checks.filter(c => c.status === 'degraded').length;

    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let level = 0;

    if (unhealthyCount > 0) {
      overall = 'unhealthy';
      level = unhealthyCount >= checks.length / 2 ? 3 : 2;
    } else if (degradedCount > 0) {
      overall = 'degraded';
      level = 1;
    }

    return {
      overall,
      level,
      checks,
      version: process.env.APP_VERSION || '1.0.0',
      uptime: process.uptime(),
    };
  }
}

// 预定义健康检查
const healthChecker = new HealthChecker();

healthChecker.register('database', async () => {
  const result = await db.execute(sql`SELECT 1`);
  if (!result.rows.length) throw new Error('Database ping failed');
});

healthChecker.register('redis', async () => {
  const result = await redis.ping();
  if (result !== 'PONG') throw new Error('Redis ping failed');
});

healthChecker.register('llm', async () => {
  const latency = await measureLatency(() => llmClient.ping());
  if (latency > 5000) throw new Error('LLM latency too high');
});

healthChecker.register('storage', async () => {
  const accessible = await fs.access(STORAGE_PATH);
  if (!accessible) throw new Error('Storage not accessible');
});
```

### 2.2 故障检测器

```typescript
// src/resilience/fault-detector.ts
class FaultDetector {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private metrics: MetricsCollector;

  constructor(metrics: MetricsCollector) {
    this.metrics = metrics;
  }

  // 检测错误率异常
  detectErrorRateAnomaly(service: string): boolean {
    const errorRate = this.metrics.getErrorRate(service);
    const threshold = this.getThreshold(service, 'errorRate');

    if (errorRate > threshold) {
      this.triggerCircuitBreaker(service);
      return true;
    }

    return false;
  }

  // 检测延迟异常
  detectLatencyAnomaly(service: string): boolean {
    const p99 = this.metrics.getLatency(service, 'p99');
    const threshold = this.getThreshold(service, 'latency');

    return p99 > threshold;
  }

  // 获取阈值
  private getThreshold(service: string, metric: string): number {
    const thresholds = {
      llm: { errorRate: 0.1, latency: 30000 },
      database: { errorRate: 0.05, latency: 1000 },
      redis: { errorRate: 0.02, latency: 100 },
    };

    return thresholds[service]?.[metric] || 1;
  }

  // 触发熔断器
  private triggerCircuitBreaker(service: string) {
    let cb = this.circuitBreakers.get(service);
    if (!cb) {
      cb = new CircuitBreaker();
      this.circuitBreakers.set(service, cb);
    }
    cb.trip();
  }
}
```

---

## 3. 降级策略

### 3.1 功能降级矩阵

```typescript
// src/resilience/degradation-matrix.ts
interface DegradationLevel {
  level: number;
  name: string;
  disabledFeatures: string[];
  degradedFeatures: string[];
  enabledFeatures: string[];
}

const DEGRADATION_MATRIX: DegradationLevel[] = [
  {
    level: 0,
    name: '正常',
    disabledFeatures: [],
    degradedFeatures: [],
    enabledFeatures: ['all'],
  },
  {
    level: 1,
    name: '部分降级',
    disabledFeatures: [
      'analytics',
      'recommendations',
      'advanced_search',
    ],
    degradedFeatures: [
      'cache_tier2',
      'background_jobs',
    ],
    enabledFeatures: [
      'project_generation',
      'idea_management',
      'basic_api',
    ],
  },
  {
    level: 2,
    name: '严重降级',
    disabledFeatures: [
      'analytics',
      'recommendations',
      'advanced_search',
      'notifications',
      'email',
    ],
    degradedFeatures: [
      'quality_review',
      'auto_optimization',
    ],
    enabledFeatures: [
      'project_generation',
      'idea_management',
      'read_api',
    ],
  },
  {
    level: 3,
    name: '紧急模式',
    disabledFeatures: [
      'generation',
      'analytics',
      'notifications',
      'recommendations',
    ],
    degradedFeatures: [],
    enabledFeatures: [
      'read_api',
      'static_pages',
    ],
  },
];

// 获取当前降级级别
async function getCurrentDegradationLevel(): Promise<DegradationLevel> {
  const health = await healthChecker.check();

  if (health.level >= 3) return DEGRADATION_MATRIX[3];
  if (health.level === 2) return DEGRADATION_MATRIX[2];
  if (health.level === 1) return DEGRADATION_MATRIX[1];
  return DEGRADATION_MATRIX[0];
}
```

### 3.2 功能开关

```typescript
// src/resilience/feature-gates.ts
class FeatureGate {
  private features: Map<string, boolean> = new Map();
  private degradationLevel: DegradationLevel = DEGRADATION_MATRIX[0];

  async updateDegradationLevel() {
    this.degradationLevel = await getCurrentDegradationLevel();
  }

  isEnabled(feature: string): boolean {
    // 检查是否在禁用列表中
    if (this.degradationLevel.disabledFeatures.includes(feature)) {
      return false;
    }

    // 检查降级列表
    if (this.degradationLevel.degradedFeatures.includes(feature)) {
      return this.features.get(`degraded_${feature}`) ?? true;
    }

    // 检查明确启用
    return this.features.get(feature) ?? true;
  }

  // 降级执行
  async withFallback<T>(
    feature: string,
    primaryFn: () => Promise<T>,
    fallbackFn: () => Promise<T>
  ): Promise<T> {
    if (this.isEnabled(feature)) {
      try {
        return await primaryFn();
      } catch (error) {
        if (this.shouldFallback(error)) {
          return fallbackFn();
        }
        throw error;
      }
    }

    return fallbackFn();
  }

  private shouldFallback(error: Error): boolean {
    // 判断是否是可降级的错误
    return error instanceof TimeoutError ||
           error instanceof CircuitBreakerError ||
           error instanceof RateLimitError;
  }
}
```

---

## 4. 降级实现

### 4.1 LLM 降级

```typescript
// src/resilience/llm-fallback.ts
class LLMFallbackHandler {
  constructor(
    private primary: LLMProvider,
    private fallback: LLMProvider
  ) {}

  async complete(prompt: string, options: LLMOptions): Promise<LLMResponse> {
    try {
      // 尝试主 LLM
      return await this.callWithTimeout(this.primary.complete(prompt, options), 30000);
    } catch (primaryError) {
      console.warn('Primary LLM failed, trying fallback:', primaryError);

      try {
        // 使用降级 LLM
        return await this.callWithTimeout(
          this.fallback.complete(prompt, {
            ...options,
            model: 'gpt-3.5-turbo',  // 更便宜更快的模型
          }),
          60000
        );
      } catch (fallbackError) {
        throw new LLMServiceError('Both primary and fallback LLM failed', {
          primary: primaryError,
          fallback: fallbackError,
        });
      }
    }
  }

  private async callWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new TimeoutError(`Operation timed out after ${ms}ms`)), ms)
      ),
    ]);
  }
}

// 模型降级链
const llmProviders = [
  { name: 'gpt-4', timeout: 60000, maxRetries: 3 },
  { name: 'gpt-4-turbo', timeout: 45000, maxRetries: 2 },
  { name: 'gpt-3.5-turbo', timeout: 30000, maxRetries: 1 },
];

class LLMChain {
  async complete(prompt: string): Promise<LLMResponse> {
    let lastError: Error;

    for (const provider of llmProviders) {
      try {
        const result = await this.callProvider(provider, prompt);
        return result;
      } catch (error) {
        lastError = error;
        console.warn(`Provider ${provider.name} failed, trying next...`);
        continue;
      }
    }

    throw new Error(`All LLM providers failed. Last error: ${lastError?.message}`);
  }

  private async callProvider(provider: LLMProviderConfig, prompt: string): Promise<LLMResponse> {
    return this.callWithTimeout(
      llmClient.complete(prompt, { model: provider.name }),
      provider.timeout
    );
  }
}
```

### 4.2 缓存降级

```typescript
// src/resilience/cache-fallback.ts
class CacheFallback {
  private l1: MemoryCache;
  private l2: RedisCache;
  private db: DatabaseCache;

  async get<T>(key: string): Promise<T | null> {
    // L1: 内存缓存
    const l1Result = await this.l1.get<T>(key);
    if (l1Result !== null) return l1Result;

    // L2: Redis
    try {
      const l2Result = await this.l2.get<T>(key);
      if (l2Result !== null) {
        // 回填 L1
        await this.l1.set(key, l2Result);
        return l2Result;
      }
    } catch (redisError) {
      console.warn('Redis unavailable, trying database cache:', redisError);
    }

    // L3: 数据库缓存
    try {
      const dbResult = await this.db.get<T>(key);
      if (dbResult !== null) {
        // 回填 L1 (如果 Redis 恢复)
        await this.l1.set(key, dbResult).catch(() => {});
        return dbResult;
      }
    } catch (dbError) {
      console.warn('Database cache unavailable:', dbError);
    }

    return null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    // 写入 L1
    await this.l1.set(key, value);

    // 尝试写入 L2
    try {
      await this.l2.set(key, value);
    } catch (error) {
      console.warn('Failed to write to Redis:', error);
    }

    // 尝试写入 L3
    try {
      await this.db.set(key, value);
    } catch (error) {
      console.warn('Failed to write to database cache:', error);
    }
  }
}
```

### 4.3 UI 降级

```typescript
// src/resilience/ui-degradation.tsx
// 降级上下文
const DegradationContext = createContext<{
  level: number;
  isFeatureEnabled: (feature: string) => boolean;
}>({ level: 0, isFeatureEnabled: () => true });

// 降级包装组件
function DegradedFeature({
  feature,
  fallback,
  children
}: {
  feature: string;
  fallback: React.ReactNode;
  children: React.ReactNode;
}) {
  const { isFeatureEnabled } = useContext(DegradationContext);

  return isFeatureEnabled(feature) ? <>{children}</> : <>{fallback}</>;
}

// 降级模式下的 UI
function DegradedDashboard() {
  return (
    <div className="degraded-mode">
      <Banner type="warning">
        系统当前处于降级模式，部分功能暂时不可用。
        我们将尽快恢复完整服务。
      </Banner>

      {/* 简化导航 */}
      <nav>
        <Link to="/projects">项目</Link>
        <Link to="/ideas">想法</Link>
      </nav>

      {/* 核心功能 */}
      <main>
        <ProjectList />
        <IdeaList />
      </main>

      {/* 禁用的功能 */}
      <DegradedFeature
        feature="analytics"
        fallback={<AnalyticsDisabled />}
      >
        <AnalyticsDashboard />
      </DegradedFeature>

      <DegradedFeature
        feature="recommendations"
        fallback={null}
      >
        <Recommendations />
      </DegradedFeature>
    </div>
  );
}
```

---

## 5. 恢复策略

### 5.1 自动恢复

```typescript
// src/resilience/auto-recovery.ts
class AutoRecoveryManager {
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();

  constructor(
    private healthChecker: HealthChecker,
    private circuitBreakers: Map<string, CircuitBreaker>
  ) {
    this.setupDefaultStrategies();
  }

  private setupDefaultStrategies() {
    // 数据库恢复
    this.recoveryStrategies.set('database', {
      check: () => this.healthChecker.check().then(h => h.checks.find(c => c.name === 'database')?.status === 'healthy'),
      actions: [
        { type: 'retry', delay: 5000 },
        { type: 'restart', delay: 30000 },
        { type: 'failover', delay: 60000 },
      ],
    });

    // Redis 恢复
    this.recoveryStrategies.set('redis', {
      check: () => this.healthChecker.check().then(h => h.checks.find(c => c.name === 'redis')?.status === 'healthy'),
      actions: [
        { type: 'retry', delay: 2000 },
        { type: 'restart', delay: 15000 },
      ],
    });

    // LLM 恢复
    this.recoveryStrategies.set('llm', {
      check: () => this.healthChecker.check().then(h => h.checks.find(c => c.name === 'llm')?.status === 'healthy'),
      actions: [
        { type: 'retry', delay: 10000 },
        { type: 'model_fallback', delay: 0 },
      ],
    });
  }

  async attemptRecovery(service: string): Promise<boolean> {
    const strategy = this.recoveryStrategies.get(service);
    if (!strategy) return false;

    for (const action of strategy.actions) {
      console.log(`Attempting recovery action: ${action.type} for ${service}`);

      const success = await this.executeAction(service, action);

      if (success) {
        // 等待健康检查确认
        await this.waitForHealthy(service);

        console.log(`Recovery successful for ${service}`);
        return true;
      }

      if (action.delay > 0) {
        await this.sleep(action.delay);
      }
    }

    console.error(`All recovery attempts failed for ${service}`);
    return false;
  }

  private async executeAction(service: string, action: RecoveryAction): Promise<boolean> {
    switch (action.type) {
      case 'retry':
        return true;  // 重试总是成功，实际应检查

      case 'restart':
        await this.restartService(service);
        return true;

      case 'failover':
        await this.initiateFailover(service);
        return true;

      case 'model_fallback':
        await this.switchToFallbackModel(service);
        return true;

      default:
        return false;
    }
  }

  private async restartService(service: string): Promise<void> {
    console.log(`Restarting service: ${service}`);
    // 实现服务重启逻辑
  }

  private async initiateFailover(service: string): Promise<void> {
    console.log(`Initiating failover for: ${service}`);
    // 实现故障转移逻辑
  }

  private async switchToFallbackModel(service: string): Promise<void> {
    console.log(`Switching to fallback model for: ${service}`);
    // 实现模型切换
  }
}
```

---

## 6. 相关文档

- [错误处理与系统韧性](./ERROR_HANDLING_RESILIENCE.md)
- [性能优化](./PERFORMANCE_OPTIMIZATION.md)
- [灾难恢复](./DISASTER_RECOVERY.md)

---

**最后更新**: 2026-04-14
