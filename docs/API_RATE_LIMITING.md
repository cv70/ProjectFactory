# API 限流与节流设计

## 1. 概述

本文档描述 ProjectFactory 系统的 API 限流（Rate Limiting）与节流（Throttling）设计方案，保护系统免受过载和滥用。

### 1.1 设计目标

| 目标 | 描述 |
|------|------|
| 系统保护 | 防止 API 过载，保护后端资源 |
| 公平使用 | 确保所有用户公平访问资源 |
| 收入保护 | 根据定价计划限制不同用户 |
| 可预测性 | 提供清晰的限流反馈 |

### 1.2 限流架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           限流架构                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  客户端                                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Rate Limit Header                                                     │   │
│  │  X-RateLimit-Limit: 1000                                              │   │
│  │  X-RateLimit-Remaining: 999                                           │   │
│  │  X-RateLimit-Reset: 1640995200                                        │   │
│  │  Retry-After: 3600 (when exceeded)                                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ↑                                        │
│                                    │                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Rate Limit Middleware                               │   │
│  │                                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │   │
│  │  │   Global    │  │    IP       │  │   User      │                   │   │
│  │  │   Limit     │  │    Limit    │  │    Limit    │                   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │   │
│  │         ↓                ↓                ↓                           │   │
│  │  ┌─────────────────────────────────────────────────────────────┐      │   │
│  │  │                  Token Bucket / Sliding Window              │      │   │
│  │  └─────────────────────────────────────────────────────────────┘      │   │
│  │                              ↓                                        │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │   │
│  │  │   Allow     │  │   Reject    │  │   Throttle  │                   │   │
│  │  │   Request   │  │   Request   │  │   Request   │                   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                        │
│  Redis Cluster                                                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 限流策略

### 2.1 限流算法

```typescript
// src/rate-limit/algorithms.ts

// Token Bucket 算法
interface TokenBucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number;  // 每秒补充的 token 数
}

class TokenBucketRateLimiter {
  constructor(
    private capacity: number,
    private refillRate: number
  ) {}

  // 检查是否可以获取 token
  tryConsume(bucket: TokenBucket, tokens: number = 1): boolean {
    this.refill(bucket);

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return true;
    }

    return false;
  }

  // 补充 token
  private refill(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;

    bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  // 获取bucket状态
  getBucketState(bucket: TokenBucket): { tokens: number; capacity: number; resetIn: number } {
    this.refill(bucket);
    return {
      tokens: bucket.tokens,
      capacity: bucket.capacity,
      resetIn: Math.ceil((bucket.capacity - bucket.tokens) / this.refillRate),
    };
  }
}

// Sliding Window 算法
class SlidingWindowRateLimiter {
  constructor(
    private windowSizeMs: number,
    private maxRequests: number
  ) {}

  // 检查是否允许请求
  async isAllowed(key: string): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    const now = Date.now();
    const windowStart = now - this.windowSizeMs;

    const requests = await redis.zremrangebyscore(key, 0, windowStart);
    const count = await redis.zcard(key);

    if (count < this.maxRequests) {
      await redis.zadd(key, now, `${now}-${Math.random()}`);
      await redis.expire(key, Math.ceil(this.windowSizeMs / 1000));

      return {
        allowed: true,
        remaining: this.maxRequests - count - 1,
        resetIn: Math.ceil(this.windowSizeMs / 1000),
      };
    }

    // 获取最旧请求的时间
    const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
    const resetIn = oldest.length >= 2
      ? Math.ceil((Number(oldest[1]) + this.windowSizeMs - now) / 1000)
      : this.windowSizeMs / 1000;

    return {
      allowed: false,
      remaining: 0,
      resetIn,
    };
  }
}

// Fixed Window Counter 算法
class FixedWindowRateLimiter {
  constructor(
    private windowSizeSec: number,
    private maxRequests: number
  ) {}

  async isAllowed(key: string): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    const now = Date.now();
    const windowKey = Math.floor(now / (this.windowSizeSec * 1000));
    const redisKey = `ratelimit:${key}:${windowKey}`;

    const count = await redis.incr(redisKey);

    if (count === 1) {
      await redis.expire(redisKey, this.windowSizeSec * 2); // 2x window for safety
    }

    const resetIn = this.windowSizeSec - (now / 1000) % this.windowSizeSec;

    if (count <= this.maxRequests) {
      return {
        allowed: true,
        remaining: this.maxRequests - count,
        resetIn,
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetIn,
    };
  }
}
```

### 2.2 限流配置

```typescript
// src/rate-limit/config.ts
interface RateLimitConfig {
  windowSizeMs: number;
  maxRequests: number;
  burstSize?: number;
  keyPrefix: string;
}

interface TierLimitConfig {
  [tier: string]: {
    default: RateLimitConfig;
    perEndpoint: Record<string, RateLimitConfig>;
  };
}

const RATE_LIMIT_TIERS: TierLimitConfig = {
  free: {
    default: { windowSizeMs: 60000, maxRequests: 100, keyPrefix: 'rl:free' },
    perEndpoint: {
      '/api/projects': { windowSizeMs: 60000, maxRequests: 10, keyPrefix: 'rl:free:project' },
      '/api/generate': { windowSizeMs: 3600000, maxRequests: 5, keyPrefix: 'rl:free:generate' },
      '/api/ideas': { windowSizeMs: 60000, maxRequests: 20, keyPrefix: 'rl:free:ideas' },
    },
  },
  starter: {
    default: { windowSizeMs: 60000, maxRequests: 1000, keyPrefix: 'rl:starter' },
    perEndpoint: {
      '/api/projects': { windowSizeMs: 60000, maxRequests: 50, keyPrefix: 'rl:starter:project' },
      '/api/generate': { windowSizeMs: 3600000, maxRequests: 20, keyPrefix: 'rl:starter:generate' },
    },
  },
  professional: {
    default: { windowSizeMs: 60000, maxRequests: 5000, keyPrefix: 'rl:pro' },
    perEndpoint: {
      '/api/projects': { windowSizeMs: 60000, maxRequests: 200, keyPrefix: 'rl:pro:project' },
      '/api/generate': { windowSizeMs: 3600000, maxRequests: 100, keyPrefix: 'rl:pro:generate' },
    },
  },
  enterprise: {
    default: { windowSizeMs: 60000, maxRequests: 50000, keyPrefix: 'rl:enterprise' },
    perEndpoint: {
      '/api/projects': { windowSizeMs: 60000, maxRequests: 1000, keyPrefix: 'rl:enterprise:project' },
      '/api/generate': { windowSizeMs: 3600000, maxRequests: 500, keyPrefix: 'rl:enterprise:generate' },
    },
  },
};

// 全局限流配置
const GLOBAL_RATE_LIMITS = {
  // 全局 IP 限流
  ipLimit: {
    windowSizeMs: 60000,
    maxRequests: 1000,
    keyPrefix: 'rl:global:ip',
  },

  // 全局 Token Bucket (突发)
  burstLimit: {
    capacity: 50,
    refillRate: 10, // 每秒补充 10 个
    keyPrefix: 'rl:burst',
  },

  // LLM API 特殊限流
  llmLimit: {
    windowSizeMs: 60000,
    maxRequests: 30, // 与 LLM API 提供商匹配
    keyPrefix: 'rl:llm',
  },
};
```

---

## 3. 中间件实现

### 3.1 Express 中间件

```typescript
// src/rate-limit/middleware.ts
import { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  limiter: TokenBucketRateLimiter | SlidingWindowRateLimiter | FixedWindowRateLimiter;
  keyGenerator: (req: Request) => string;
  skip?: (req: Request) => boolean;
  onRateLimited?: (req: Request, res: Response) => void;
}

export function rateLimitMiddleware(options: RateLimitOptions) {
  const {
    limiter,
    keyGenerator,
    skip = () => false,
    onRateLimited = defaultRateLimitedHandler,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // 跳过某些请求
    if (skip(req)) {
      return next();
    }

    const key = keyGenerator(req);
    const result = await limiter.isAllowed(key);

    // 设置响应头
    setRateLimitHeaders(res, result);

    if (result.allowed) {
      next();
    } else {
      onRateLimited(req, res, result);
    }
  };
}

function setRateLimitHeaders(
  res: Response,
  result: { remaining: number; resetIn: number }
) {
  res.set({
    'X-RateLimit-Limit': result.limit,
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + result.resetIn),
    'X-RateLimit-Window': String(result.windowSizeMs),
  });
}

function defaultRateLimitedHandler(req: Request, res: Response, result: any) {
  res.status(429).json({
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: result.resetIn,
  });
}

// 组合多个限流器
export function combineRateLimiters(
  limiters: RateLimitOptions[],
  mode: 'and' | 'or' = 'and'
): RateLimitOptions {
  return {
    limiter: limiters[0].limiter, // 主限流器 (用于接口)
    keyGenerator: limiters[0].keyGenerator,
    async onRateLimited(req, res) {
      // 检查所有限流器
      const results = await Promise.all(
        limiters.map(async (l) => {
          const key = l.keyGenerator(req);
          return { limiter: l, result: await l.limiter.isAllowed(key) };
        })
      );

      if (mode === 'and') {
        // 所有限流器都触发才拒绝 (宽松)
        const blocked = results.filter((r) => !r.result.allowed);
        if (blocked.length === results.length) {
          // 全部触发，返回最严格的 resetIn
          const maxResetIn = Math.max(...blocked.map((r) => r.result.resetIn));
          blocked[0].onRateLimited?.(req, res, { ...blocked[0].result, resetIn: maxResetIn });
        }
      } else {
        // 任意限流器触发即拒绝 (严格)
        const firstBlocked = results.find((r) => !r.result.allowed);
        if (firstBlocked) {
          firstBlocked.onRateLimited?.(req, res, firstBlocked.result);
        }
      }
    },
  };
}
```

### 3.2 应用级限流

```typescript
// src/rate-limit/application.ts
import { Application, Request, Response, NextFunction } from 'express';

// 获取用户限流配置
function getUserRateLimitConfig(user: AuthenticatedUser): RateLimitConfig {
  const tier = user.subscription?.tier || 'free';
  return RATE_LIMIT_TIERS[tier].default;
}

// 按用户限流
export function userRateLimiter(app: Application) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next();

    const config = getUserRateLimitConfig(req.user);
    const key = `user:${req.user.id}`;

    const limiter = new SlidingWindowRateLimiter(config.windowSizeMs, config.maxRequests);
    const result = await limiter.isAllowed(key);

    setRateLimitHeaders(res, {
      limit: config.maxRequests,
      remaining: result.remaining,
      resetIn: result.resetIn,
      windowSizeMs: config.windowSizeMs,
    });

    if (!result.allowed) {
      return res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: `You have exceeded your rate limit. Upgrade your plan for higher limits.`,
        tier: req.user.subscription?.tier || 'free',
        retryAfter: result.resetIn,
      });
    }

    next();
  };
}

// 按 IP 限流 (防滥用)
export function ipRateLimiter(app: Application) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const key = `ip:${ip}`;

    const limiter = new SlidingWindowRateLimiter(
      GLOBAL_RATE_LIMITS.ipLimit.windowSizeMs,
      GLOBAL_RATE_LIMITS.ipLimit.maxRequests
    );

    const result = await limiter.isAllowed(key);

    if (!result.allowed) {
      return res.status(429).json({
        error: 'IP_RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP address.',
        retryAfter: result.resetIn,
      });
    }

    next();
  };
}

// LLM API 特殊限流
export function llmRateLimiter(app: Application) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next();

    // 检查 LLM API 调用频率
    const key = `llm:${req.user.id}`;
    const limiter = new SlidingWindowRateLimiter(
      GLOBAL_RATE_LIMITS.llmLimit.windowSizeMs,
      GLOBAL_RATE_LIMITS.llmLimit.maxRequests
    );

    const result = await limiter.isAllowed(key);

    if (!result.allowed) {
      return res.status(429).json({
        error: 'LLM_RATE_LIMIT_EXCEEDED',
        message: 'LLM API rate limit exceeded. Please wait before making more requests.',
        retryAfter: result.resetIn,
      });
    }

    next();
  };
}

// 端点级别限流
export function endpointRateLimiter(app: Application) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next();

    const tier = req.user.subscription?.tier || 'free';
    const tierConfig = RATE_LIMIT_TIERS[tier];

    // 查找匹配的端点配置
    const endpointPath = Object.keys(tierConfig.perEndpoint).find((path) =>
      req.path.startsWith(path)
    );

    if (!endpointPath) return next();

    const config = tierConfig.perEndpoint[endpointPath];
    const limiter = new SlidingWindowRateLimiter(config.windowSizeMs, config.maxRequests);
    const key = `${config.keyPrefix}:${req.user.id}`;

    const result = await limiter.isAllowed(key);

    setRateLimitHeaders(res, {
      limit: config.maxRequests,
      remaining: result.remaining,
      resetIn: result.resetIn,
      windowSizeMs: config.windowSizeMs,
    });

    if (!result.allowed) {
      return res.status(429).json({
        error: 'ENDPOINT_RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded for ${endpointPath}.`,
        endpoint: endpointPath,
        retryAfter: result.resetIn,
      });
    }

    next();
  };
}
```

---

## 4. 节流策略

### 4.1 请求节流

```typescript
// src/throttling/request-throttler.ts
interface ThrottleConfig {
  maxConcurrent: number;        // 最大并发数
  maxQueued: number;            // 最大排队数
  queueTimeout: number;         // 排队超时 (ms)
  priorityLevels: number;        // 优先级级别数
}

class RequestThrottler {
  private queue: ThrottledRequest[] = [];
  private activeRequests = 0;
  private config: ThrottleConfig;

  constructor(config: ThrottleConfig) {
    this.config = config;
  }

  // 请求入口
  async throttle<T>(request: ThrottledRequest): Promise<ThrottleResult<T>> {
    // 检查并发限制
    if (this.activeRequests >= this.config.maxConcurrent) {
      // 加入队列
      const queued = await this.enqueue(request);

      if (!queued) {
        return {
          success: false,
          rejected: true,
          reason: 'QUEUE_FULL',
          message: 'Server is too busy. Please try again later.',
        };
      }

      // 等待执行
      return this.waitForExecution(request);
    }

    // 直接执行
    return this.execute(request);
  }

  private async execute<T>(request: ThrottledRequest): Promise<ThrottleResult<T>> {
    this.activeRequests++;

    try {
      const result = await Promise.race([
        request.handler(),
        this.createTimeout(request.timeout || 30000),
      ]);

      return {
        success: true,
        result,
        metadata: {
          queued: false,
          waitTime: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        rejected: false,
        reason: 'EXECUTION_ERROR',
        error,
      };
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  private async enqueue(request: ThrottledRequest): Promise<boolean> {
    if (this.queue.length >= this.config.maxQueued) {
      return false;
    }

    return new Promise((resolve) => {
      this.queue.push({
        ...request,
        resolve,
        enqueuedAt: Date.now(),
      });

      // 按优先级排序
      this.queue.sort((a, b) => b.priority - a.priority);
    });
  }

  private async waitForExecution<T>(
    request: ThrottledRequest
  ): Promise<ThrottleResult<T>> {
    const startTime = Date.now();
    const timeout = this.config.queueTimeout;

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (Date.now() - startTime > timeout) {
          // 超时，从队列移除
          const index = this.queue.indexOf(request as any);
          if (index >= 0) this.queue.splice(index, 1);

          clearInterval(checkInterval);
          resolve({
            success: false,
            rejected: true,
            reason: 'QUEUE_TIMEOUT',
            message: 'Request timed out in queue.',
          });
        }

        if (this.activeRequests < this.config.maxConcurrent && this.queue[0] === request) {
          clearInterval(checkInterval);
          const result = this.execute(request);
          resolve({
            ...(await result),
            metadata: {
              ...(await result).metadata,
              queued: true,
              waitTime: Date.now() - startTime,
            },
          });
        }
      }, 100);
    });
  }

  private processQueue() {
    if (this.queue.length > 0 && this.activeRequests < this.config.maxConcurrent) {
      const next = this.queue.shift();
      if (next) {
        next.resolve(true);
      }
    }
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), ms)
    );
  }

  // 获取状态
  getStatus(): ThrottlerStatus {
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.queue.length,
      maxConcurrent: this.config.maxConcurrent,
      maxQueued: this.config.maxQueued,
    };
  }
}

// 全局限流器
export const globalThrottler = new RequestThrottler({
  maxConcurrent: 100,
  maxQueued: 500,
  queueTimeout: 60000,
  priorityLevels: 5,
});
```

### 4.2 LLM 调用节流

```typescript
// src/throttling/llm-throttler.ts
interface LLMThrottleConfig {
  maxConcurrentCalls: number;
  maxTokensPerMinute: number;
  maxRequestsPerMinute: number;
}

class LLMCallThrottler {
  private activeCalls = 0;
  private tokenUsage: number[] = [];
  private requestTimes: number[] = [];
  private config: LLMThrottleConfig;

  constructor(config: LLMThrottleConfig) {
    this.config = config;
  }

  // 等待许可
  async acquire(tokens: number): Promise<boolean> {
    const now = Date.now();

    // 清理过期的使用记录
    this.tokenUsage = this.tokenUsage.filter((t) => now - t < 60000);
    this.requestTimes = this.requestTimes.filter((t) => now - t < 60000);

    // 检查请求频率
    if (this.requestTimes.length >= this.config.maxRequestsPerMinute) {
      const oldestRequest = this.requestTimes[0];
      const waitTime = 60000 - (now - oldestRequest);
      if (waitTime > 0) {
        await this.sleep(waitTime);
      }
    }

    // 检查 Token 限制
    const currentTokenUsage = this.tokenUsage.reduce((a, b) => a + b, 0);
    if (currentTokenUsage + tokens > this.config.maxTokensPerMinute) {
      const oldestToken = this.tokenUsage[0];
      const waitTime = 60000 - (now - oldestToken);
      if (waitTime > 0) {
        await this.sleep(waitTime);
      }
    }

    // 检查并发限制
    if (this.activeCalls >= this.config.maxConcurrentCalls) {
      await this.waitForActiveCall();
    }

    this.activeCalls++;
    this.tokenUsage.push(now);
    this.requestTimes.push(now);

    return true;
  }

  // 释放许可
  release(tokensUsed: number) {
    this.activeCalls--;
    // 记录实际使用的 token
    this.tokenUsage.push(tokensUsed);
  }

  private async waitForActiveCall(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (this.activeCalls < this.config.maxConcurrentCalls) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// LLM 节流实例
export const llmThrottler = new LLMCallThrottler({
  maxConcurrentCalls: 10,
  maxTokensPerMinute: 100000,
  maxRequestsPerMinute: 60,
});
```

---

## 5. 响应头与错误

### 5.1 标准响应头

```typescript
// src/rate-limit/headers.ts
interface RateLimitHeaders {
  'X-RateLimit-Limit': string;        // 限制次数
  'X-RateLimit-Remaining': string;    // 剩余次数
  'X-RateLimit-Reset': string;        // 重置时间戳
  'X-RateLimit-Window': string;      // 窗口大小
  'Retry-After'?: string;             // 距重试的秒数
}

function getRateLimitHeaders(
  limit: number,
  remaining: number,
  resetIn: number,
  windowSizeMs: number
): RateLimitHeaders {
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(Math.max(0, remaining)),
    'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + resetIn),
    'X-RateLimit-Window': String(Math.ceil(windowSizeMs / 1000)),
  };
}

// 429 响应体
interface RateLimitErrorResponse {
  error: string;
  message: string;
  code: string;
  tier?: string;
  retryAfter: number;
  upgradeUrl?: string;
  rateLimit: {
    limit: number;
    remaining: number;
    resetAt: string;
    windowSeconds: number;
  };
}

function createRateLimitError(
  limit: number,
  remaining: number,
  resetIn: number,
  windowSizeMs: number,
  userTier?: string
): RateLimitErrorResponse {
  return {
    error: 'Too Many Requests',
    message: `Rate limit exceeded. You have ${remaining} requests remaining.`,
    code: 'RATE_LIMIT_EXCEEDED',
    tier: userTier,
    retryAfter: resetIn,
    upgradeUrl: userTier ? `https://projectfactory.io/pricing?upgrade=${userTier}` : undefined,
    rateLimit: {
      limit,
      remaining: Math.max(0, remaining),
      resetAt: new Date((Date.now() + resetIn * 1000)).toISOString(),
      windowSeconds: Math.ceil(windowSizeMs / 1000),
    },
  };
}
```

### 5.2 错误码定义

```typescript
// src/rate-limit/errors.ts
enum RateLimitErrorCode {
  // 标准 HTTP 429
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // 特定场景
  IP_RATE_LIMIT_EXCEEDED = 'IP_RATE_LIMIT_EXCEEDED',
  USER_RATE_LIMIT_EXCEEDED = 'USER_RATE_LIMIT_EXCEEDED',
  ENDPOINT_RATE_LIMIT_EXCEEDED = 'ENDPOINT_RATE_LIMIT_EXCEEDED',
  LLM_RATE_LIMIT_EXCEEDED = 'LLM_RATE_LIMIT_EXCEEDED',

  // 资源相关
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  CONCURRENT_LIMIT_EXCEEDED = 'CONCURRENT_LIMIT_EXCEEDED',
  QUEUE_FULL = 'QUEUE_FULL',
  QUEUE_TIMEOUT = 'QUEUE_TIMEOUT',

  // 升级相关
  TIER_LIMIT_REACHED = 'TIER_LIMIT_REACHED',
}

interface RateLimitErrorContext {
  userId?: string;
  tenantId?: string;
  ip?: string;
  endpoint?: string;
  tier?: string;
  limit: number;
  current: number;
  resetAt: number;
  upgradeUrl?: string;
}
```

---

## 6. 监控与告警

### 6.1 限流监控

```typescript
// src/rate-limit/monitoring.ts
interface RateLimitMetrics {
  totalRequests: number;
  allowedRequests: number;
  rejectedRequests: number;
  throttledRequests: number;
  byTier: Record<string, {
    total: number;
    rejected: number;
    rejectionRate: number;
  }>;
  byEndpoint: Record<string, {
    total: number;
    rejected: number;
    rejectionRate: number;
  }>;
}

// 收集限流指标
export class RateLimitMetricsCollector {
  private metrics: RateLimitMetrics = {
    totalRequests: 0,
    allowedRequests: 0,
    rejectedRequests: 0,
    throttledRequests: 0,
    byTier: {},
    byEndpoint: {},
  };

  recordRequest(config: {
    allowed: boolean;
    tier?: string;
    endpoint?: string;
    throttled?: boolean;
  }) {
    this.metrics.totalRequests++;

    if (config.allowed) {
      this.metrics.allowedRequests++;
    } else {
      this.metrics.rejectedRequests++;
    }

    if (config.throttled) {
      this.metrics.throttledRequests++;
    }

    // 按 tier 统计
    if (config.tier) {
      if (!this.metrics.byTier[config.tier]) {
        this.metrics.byTier[config.tier] = { total: 0, rejected: 0, rejectionRate: 0 };
      }
      this.metrics.byTier[config.tier].total++;
      if (!config.allowed) {
        this.metrics.byTier[config.tier].rejected++;
      }
      this.metrics.byTier[config.tier].rejectionRate =
        this.metrics.byTier[config.tier].rejected / this.metrics.byTier[config.tier].total;
    }

    // 按 endpoint 统计
    if (config.endpoint) {
      if (!this.metrics.byEndpoint[config.endpoint]) {
        this.metrics.byEndpoint[config.endpoint] = { total: 0, rejected: 0, rejectionRate: 0 };
      }
      this.metrics.byEndpoint[config.endpoint].total++;
      if (!config.allowed) {
        this.metrics.byEndpoint[config.endpoint].rejected++;
      }
      this.metrics.byEndpoint[config.endpoint].rejectionRate =
        this.metrics.byEndpoint[config.endpoint].rejected / this.metrics.byEndpoint[config.endpoint].total;
    }
  }

  getMetrics(): RateLimitMetrics {
    return { ...this.metrics };
  }
}

// 限流告警规则
const RATE_LIMIT_ALERT_RULES = [
  {
    name: 'High Rejection Rate',
    condition: 'rejectedRequests / totalRequests > 0.1', // > 10%
    severity: 'warning',
    window: '5m',
  },
  {
    name: 'Critical Rejection Rate',
    condition: 'rejectedRequests / totalRequests > 0.3', // > 30%
    severity: 'critical',
    window: '5m',
  },
  {
    name: 'Free Tier High Rejection',
    condition: 'byTier.free.rejectionRate > 0.2',
    severity: 'info',
    window: '5m',
  },
];
```

---

## 7. 客户端 SDK

### 7.1 客户端重试逻辑

```typescript
// src/rate-limit/client-sdk.ts
class RateLimitAwareClient {
  private baseDelay: number = 1000;
  private maxDelay: number = 60000;
  private maxRetries: number = 3;

  async request<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (this.isRateLimitError(error)) {
          const retryAfter = this.getRetryAfter(error);
          const delay = this.calculateDelay(attempt, retryAfter);

          console.log(`Rate limited. Retrying in ${delay}ms...`);
          await this.sleep(delay);
        } else {
          throw error;
        }
      }
    }

    throw lastError!;
  }

  private isRateLimitError(error: any): boolean {
    return error?.response?.status === 429;
  }

  private getRetryAfter(error: any): number {
    const retryAfter = error?.response?.headers?.['retry-after'];
    if (retryAfter) {
      return parseInt(retryAfter, 10) * 1000;
    }
    return this.baseDelay;
  }

  private calculateDelay(attempt: number, retryAfter: number): number {
    // 指数退避 + jitter
    const exponentialDelay = Math.min(
      this.baseDelay * Math.pow(2, attempt),
      this.maxDelay
    );
    const jitter = Math.random() * 0.3 * exponentialDelay;

    // 使用 retry-after 头或指数退避的较大值
    return Math.max(retryAfter, exponentialDelay + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 使用示例
const apiClient = new RateLimitAwareClient();

async function createProject(data: CreateProjectInput) {
  return apiClient.request(() =>
    fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json())
  );
}
```

---

## 8. 相关文档

- [API 规格说明](./API_SPECIFICATION.md)
- [安全设计](./SECURITY_DESIGN.md)
- [后端设计](./BACKEND_DESIGN.md)

---

**最后更新**: 2026-04-14
