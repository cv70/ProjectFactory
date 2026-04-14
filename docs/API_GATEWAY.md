# API 网关设计

## 1. 概述

本文档描述 ProjectFactory 系统的 API 网关设计，作为系统的统一入口。

### 1.1 设计目标

| 目标 | 描述 |
|------|------|
| 统一入口 | 所有 API 通过网关访问 |
| 认证授权 | 集中式身份验证 |
| 限流保护 | 防止滥用和 DDoS |
| 协议转换 | REST → gRPC / WebSocket |
| 可观测性 | 请求日志和追踪 |

### 1.2 网关架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          API 网关架构                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  客户端                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Mobile App  │  Web App  │  CLI  │  Third-party API                  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        API Gateway                                    │   │
│  │                                                                       │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │   │
│  │  │   TLS   │  │   认证   │  │   限流   │  │   路由   │  │   CORS  │    │   │
│  │  │  Termination │  │   │  │   │  │   │  │   │  │   │       │    │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │   │
│  │                                                                       │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                   │   │
│  │  │  日志   │  │  监控   │  │  缓存   │  │  协议   │                   │   │
│  │  │   │  │  │   │  │  │   │  │  │  转换   │                   │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                       │
│  │   Backend    │  │   Auth      │  │   Storage   │                       │
│  │   API        │  │   Service   │  │   Service   │                       │
│  └─────────────┘  └─────────────┘  └─────────────┘                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 网关配置

### 2.1 服务定义

```typescript
// src/gateway/config.ts
interface ServiceConfig {
  name: string;
  host: string;
  port: number;
  timeout: number;
  retries: number;
  circuitBreaker?: {
    threshold: number;
    timeout: number;
  };
}

interface RouteConfig {
  path: string;                    // 匹配路径
  method?: string[];              // HTTP 方法
  service: string;                // 目标服务
  targetPath?: string;            // 目标路径 (可重写)
  auth?: boolean;                 // 是否需要认证
  rateLimit?: {
    limit: number;
    window: number;
  };
  cache?: {
    ttl: number;
    key?: string;
  };
  transforms?: {
    request?: Transform[];
    response?: Transform[];
  };
}

interface Transform {
  type: 'header' | 'body' | 'query';
  operation: 'add' | 'remove' | 'rename' | 'map';
  source: string;
  target?: string;
}

const SERVICES: Record<string, ServiceConfig> = {
  backend: {
    name: 'backend-api',
    host: process.env.BACKEND_HOST || 'localhost',
    port: parseInt(process.env.BACKEND_PORT || '3000'),
    timeout: 30000,
    retries: 3,
    circuitBreaker: {
      threshold: 5,
      timeout: 60000,
    },
  },
  auth: {
    name: 'auth-service',
    host: process.env.AUTH_HOST || 'localhost',
    port: parseInt(process.env.AUTH_PORT || '3001'),
    timeout: 10000,
    retries: 2,
  },
  storage: {
    name: 'storage-service',
    host: process.env.STORAGE_HOST || 'localhost',
    port: parseInt(process.env.STORAGE_PORT || '3002'),
    timeout: 60000,
    retries: 1,
  },
};

const ROUTES: RouteConfig[] = [
  // Backend API
  {
    path: '/api/v1/projects',
    method: ['GET', 'POST'],
    service: 'backend',
    auth: true,
    rateLimit: { limit: 100, window: 60000 },
  },
  {
    path: '/api/v1/projects/:id',
    method: ['GET', 'PUT', 'DELETE'],
    service: 'backend',
    auth: true,
  },
  {
    path: '/api/v1/ideas',
    method: ['GET', 'POST'],
    service: 'backend',
    auth: true,
    rateLimit: { limit: 50, window: 60000 },
  },
  {
    path: '/api/v1/generate/:projectId',
    method: ['POST'],
    service: 'backend',
    auth: true,
    rateLimit: { limit: 10, window: 3600000 },  // 10 per hour
  },

  // Auth Service
  {
    path: '/api/v1/auth/*',
    service: 'auth',
    transforms: {
      response: [{
        type: 'header',
        operation: 'add',
        source: 'X-Auth-Version',
        target: '2.0',
      }],
    },
  },

  // Storage Service
  {
    path: '/api/v1/files/*',
    service: 'storage',
    auth: true,
    timeout: 120000,  // 文件上传需要更长超时
  },

  // WebSocket
  {
    path: '/ws',
    service: 'backend',
    transforms: {
      request: [{
        type: 'header',
        operation: 'add',
        source: 'X-Forwarded-Proto',
        target: 'wss',
      }],
    },
  },
];
```

### 2.2 请求处理

```typescript
// src/gateway/handler.ts
class GatewayHandler {
  constructor(
    private router: Router,
    private authMiddleware: AuthMiddleware,
    private rateLimiter: RateLimiter,
    private circuitBreaker: CircuitBreaker,
    private logger: Logger
  ) {}

  async handleRequest(ctx: GatewayContext): Promise<void> {
    const start = Date.now();
    const traceId = ctx.headers['x-trace-id'] || crypto.randomUUID();

    try {
      // 1. 解析路由
      const route = this.router.match(ctx.path, ctx.method);
      if (!route) {
        return this.handleNotFound(ctx);
      }

      // 2. 认证
      if (route.auth !== false) {
        await this.authMiddleware.authenticate(ctx);
      }

      // 3. 限流
      await this.rateLimiter.check(ctx, route);

      // 4. 请求转换
      const transformedRequest = this.applyRequestTransforms(ctx, route);

      // 5. 转发请求
      const response = await this.forwardRequest(route, transformedRequest);

      // 6. 响应转换
      this.applyResponseTransforms(ctx, response, route);

      // 记录日志
      this.logger.info('Gateway request', {
        traceId,
        path: ctx.path,
        method: ctx.method,
        status: response.status,
        duration: Date.now() - start,
      });

    } catch (error) {
      this.handleError(ctx, error, traceId);
    }
  }

  private async forwardRequest(
    route: RouteConfig,
    request: TransformedRequest
  ): Promise<ServiceResponse> {
    const service = SERVICES[route.service];

    return this.circuitBreaker.execute(
      () => httpClient.request({
        method: request.method,
        url: `http://${service.host}:${service.port}${request.path}`,
        headers: request.headers,
        body: request.body,
        timeout: route.timeout || service.timeout,
        retries: service.retries,
      }),
      service.name
    );
  }
}

interface GatewayContext {
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
  query: Record<string, string>;
}
```

---

## 3. 中间件

### 3.1 认证中间件

```typescript
// src/gateway/middleware/auth.ts
class AuthMiddleware {
  constructor(
    private jwtVerifier: JWTVerifier,
    private tokenIntrospector: TokenIntrospector
  ) {}

  async authenticate(ctx: GatewayContext): Promise<void> {
    const token = this.extractToken(ctx);

    if (!token) {
      throw new GatewayError(401, 'Authentication required', 'AUTH_REQUIRED');
    }

    try {
      // 验证 JWT
      const decoded = await this.jwtVerifier.verify(token);

      ctx.headers['x-user-id'] = decoded.userId;
      ctx.headers['x-tenant-id'] = decoded.tenantId;
      ctx.headers['x-scopes'] = decoded.scopes?.join(',') || '';

    } catch (error) {
      // JWT 无效，尝试 introspect
      if (error instanceof TokenExpiredError) {
        const introspected = await this.tokenIntrospector.introspect(token);

        if (!introspected.active) {
          throw new GatewayError(401, 'Token expired', 'TOKEN_EXPIRED');
        }

        ctx.headers['x-user-id'] = introspected.userId;
        ctx.headers['x-tenant-id'] = introspected.tenantId;
      } else {
        throw new GatewayError(401, 'Invalid token', 'INVALID_TOKEN');
      }
    }
  }

  private extractToken(ctx: GatewayContext): string | null {
    // Bearer token
    const auth = ctx.headers['authorization'];
    if (auth?.startsWith('Bearer ')) {
      return auth.slice(7);
    }

    // API Key
    const apiKey = ctx.headers['x-api-key'];
    if (apiKey) {
      return apiKey;
    }

    return null;
  }
}
```

### 3.2 限流中间件

```typescript
// src/gateway/middleware/rate-limit.ts
class RateLimiter {
  private limiters: Map<string, TokenBucket> = new Map();

  async check(ctx: GatewayContext, route: RouteConfig): Promise<void> {
    if (!route.rateLimit) return;

    const key = this.getClientKey(ctx);
    const limiter = this.getOrCreateLimiter(key, route.rateLimit);

    const allowed = await limiter.tryConsume();

    // 设置限流响应头
    ctx.headers['X-RateLimit-Limit'] = String(route.rateLimit.limit);
    ctx.headers['X-RateLimit-Remaining'] = String(limiter.getRemaining());
    ctx.headers['X-RateLimit-Reset'] = String(limiter.getResetTime());

    if (!allowed) {
      throw new GatewayError(
        429,
        'Rate limit exceeded',
        'RATE_LIMIT_EXCEEDED',
        { retryAfter: limiter.getRetryAfter() }
      );
    }
  }

  private getClientKey(ctx: GatewayContext): string {
    // 基于用户 ID 或 IP
    return ctx.headers['x-user-id'] ||
           ctx.headers['x-forwarded-for'] ||
           'anonymous';
  }
}

// Token Bucket 实现
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refillRate: number  // tokens per second
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async tryConsume(tokens: number = 1): Promise<boolean> {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  getRemaining(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  getResetTime(): number {
    const tokensNeeded = this.capacity - this.tokens;
    return Math.ceil(tokensNeeded / this.refillRate) + Math.floor(Date.now() / 1000);
  }

  getRetryAfter(): number {
    return Math.ceil((1 - this.tokens) / this.refillRate);
  }
}
```

### 3.3 熔断器

```typescript
// src/gateway/middleware/circuit-breaker.ts
enum CircuitState {
  CLOSED = 'closed',      // 正常
  OPEN = 'open',         // 熔断
  HALF_OPEN = 'half_open',  // 半开
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private lastFailure: number | null = null;

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000  // 毫秒
  ) {}

  async execute<T>(
    fn: () => Promise<T>,
    serviceName: string
  ): Promise<T> {
    // 检查熔断状态
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new GatewayError(
          503,
          `Service ${serviceName} temporarily unavailable`,
          'SERVICE_UNAVAILABLE'
        );
      }
    }

    try {
      const result = await fn();

      // 成功重置
      if (this.state === CircuitState.HALF_OPEN) {
        this.reset();
      }

      this.failures = 0;
      return result;

    } catch (error) {
      this.recordFailure();

      if (this.failures >= this.threshold) {
        this.state = CircuitState.OPEN;
        this.lastFailure = Date.now();
      }

      throw error;
    }
  }

  private recordFailure() {
    this.failures++;
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailure) return true;
    return Date.now() - this.lastFailure >= this.timeout;
  }

  private reset() {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.lastFailure = null;
  }

  getState(): CircuitState {
    return this.state;
  }
}
```

---

## 4. 路由配置

### 4.1 路由器

```typescript
// src/gateway/router.ts
class Router {
  private routes: Route[] = [];

  constructor(routes: RouteConfig[]) {
    this.buildRoutes(routes);
  }

  private buildRoutes(configs: RouteConfig[]) {
    for (const config of configs) {
      const pattern = this.pathToRegex(config.path);

      this.routes.push({
        ...config,
        pattern,
        regex: new RegExp(`^${pattern}$`),
      });
    }

    // 按优先级排序
    this.routes.sort((a, b) => {
      // 静态路径优先
      if (!a.path.includes(':') && b.path.includes(':')) return -1;
      if (a.path.includes(':') && !b.path.includes(':')) return 1;
      return 0;
    });
  }

  match(path: string, method: string): Route | null {
    for (const route of this.routes) {
      if (!route.method?.includes(method)) continue;

      const match = path.match(route.regex);
      if (match) {
        return {
          ...route,
          params: this.extractParams(route.pattern, match),
        };
      }
    }

    return null;
  }

  private pathToRegex(path: string): string {
    return path
      .replace(/:(\w+)/g, '(?<$1>[^/]+)')  // 命名参数
      .replace(/\*/g, '.*');  // 通配符
  }

  private extractParams(pattern: string, match: RegExpMatchArray): Record<string, string> {
    const params: Record<string, string> = {};
    const paramNames = (pattern.match(/:(\w+)/g) || []).map(m => m.slice(1));

    for (const name of paramNames) {
      if (match.groups?.[name]) {
        params[name] = match.groups[name];
      }
    }

    return params;
  }
}
```

---

## 5. 错误处理

### 5.1 错误响应

```typescript
// src/gateway/error.ts
class GatewayError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

// 错误映射
const ERROR_MAPPINGS: Record<string, { status: number; code: string }> = {
  'AUTH_REQUIRED': { status: 401, code: 'AUTH_REQUIRED' },
  'INVALID_TOKEN': { status: 401, code: 'INVALID_TOKEN' },
  'TOKEN_EXPIRED': { status: 401, code: 'TOKEN_EXPIRED' },
  'ACCESS_DENIED': { status: 403, code: 'ACCESS_DENIED' },
  'NOT_FOUND': { status: 404, code: 'NOT_FOUND' },
  'RATE_LIMIT_EXCEEDED': { status: 429, code: 'RATE_LIMIT_EXCEEDED' },
  'SERVICE_UNAVAILABLE': { status: 503, code: 'SERVICE_UNAVAILABLE' },
};

// 错误格式化
function formatError(error: unknown, includeStack = false): GatewayErrorResponse {
  if (error instanceof GatewayError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
      },
      timestamp: Date.now(),
    };
  }

  // 未知错误
  console.error('Unhandled gateway error:', error);

  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
    },
    timestamp: Date.now(),
  };
}
```

---

## 6. 相关文档

- [API 规格说明](./API_SPECIFICATION.md)
- [安全设计](./SECURITY_DESIGN.md)
- [部署架构](./DEPLOYMENT_ARCHITECTURE.md)

---

**最后更新**: 2026-04-14
