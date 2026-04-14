# 错误处理与系统韧性设计

## 概述

本文档定义 ProjectFactory 系统的错误处理策略和韧性架构，确保系统在面对各类故障时能够优雅降级、自动恢复，并提供有意义的错误反馈。

## 1. 错误分类体系

### 1.1 错误层次结构

```typescript
// src/error/error-hierarchy.ts

// 基础错误类
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true  // vs 编程错误
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// 业务错误
class BusinessError extends AppError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, 400);
    this.details = details;
  }
  details?: Record<string, unknown>;
}

// 验证错误
class ValidationError extends AppError {
  constructor(
    message: string,
    public fieldErrors: Array<{ field: string; message: string }>
  ) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

// 认证错误
class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

// 授权错误
class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 'AUTHORIZATION_ERROR', 403);
  }
}

// 资源不存在
class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    super(
      identifier ? `${resource} not found: ${identifier}` : `${resource} not found`,
      'NOT_FOUND',
      404
    );
  }
}

// 资源冲突
class ConflictError extends AppError {
  constructor(message: string, code: string = 'CONFLICT') {
    super(message, code, 409);
  }
}

// LLM 相关错误
class LLMError extends AppError {
  constructor(
    message: string,
    public provider: 'openai' | 'anthropic' | 'local',
    public retryable: boolean = true
  ) {
    super(message, 'LLM_ERROR', 502, retryable);
  }
}

// 限流错误
class RateLimitError extends AppError {
  constructor(
    message: string = 'Rate limit exceeded',
    public retryAfterMs?: number
  ) {
    super(message, 'RATE_LIMIT', 429);
  }
}

// 超时错误
class TimeoutError extends AppError {
  constructor(
    message: string = 'Operation timed out',
    public operation?: string
  ) {
    super(message, 'TIMEOUT', 408);
  }
}

// 系统错误（不可恢复）
class SystemError extends AppError {
  constructor(message: string, code: string = 'SYSTEM_ERROR') {
    super(message, code, 500, false);
  }
}

// 数据库错误
class DatabaseError extends AppError {
  constructor(
    message: string,
    public operation: string,
    public retryable: boolean = true
  ) {
    super(message, 'DATABASE_ERROR', 500, retryable);
  }
}

// 文件系统错误
class FileSystemError extends AppError {
  constructor(
    message: string,
    public path?: string,
    public operation?: string
  ) {
    super(message, 'FILE_SYSTEM_ERROR', 500, true);
  }
}
```

### 1.2 错误代码规范

```typescript
// src/error/error-codes.ts
const ErrorCodes = {
  // 通用错误 (1000-1999)
  UNKNOWN_ERROR: { code: 'UNKNOWN_ERROR', statusCode: 500, message: 'An unknown error occurred' },
  INVALID_INPUT: { code: 'INVALID_INPUT', statusCode: 400, message: 'Invalid input provided' },
  RESOURCE_NOT_FOUND: { code: 'RESOURCE_NOT_FOUND', statusCode: 404, message: 'Resource not found' },

  // 认证错误 (2000-2999)
  AUTH_REQUIRED: { code: 'AUTH_REQUIRED', statusCode: 401, message: 'Authentication required' },
  AUTH_INVALID_TOKEN: { code: 'AUTH_INVALID_TOKEN', statusCode: 401, message: 'Invalid authentication token' },
  AUTH_TOKEN_EXPIRED: { code: 'AUTH_TOKEN_EXPIRED', statusCode: 401, message: 'Authentication token has expired' },
  AUTH_INSUFFICIENT_PERMISSIONS: { code: 'AUTH_INSUFFICIENT_PERMISSIONS', statusCode: 403, message: 'Insufficient permissions' },

  // 项目相关错误 (3000-3999)
  PROJECT_NOT_FOUND: { code: 'PROJECT_NOT_FOUND', statusCode: 404, message: 'Project not found' },
  PROJECT_ALREADY_EXISTS: { code: 'PROJECT_ALREADY_EXISTS', statusCode: 409, message: 'Project already exists' },
  PROJECT_INACTIVE: { code: 'PROJECT_INACTIVE', statusCode: 400, message: 'Project is not active' },
  PROJECT_VALIDATION_FAILED: { code: 'PROJECT_VALIDATION_FAILED', statusCode: 400, message: 'Project validation failed' },

  // 质量门控错误 (4000-4999)
  QUALITY_THRESHOLD_NOT_MET: { code: 'QUALITY_THRESHOLD_NOT_MET', statusCode: 400, message: 'Quality threshold not met' },
  COVERAGE_TOO_LOW: { code: 'COVERAGE_TOO_LOW', statusCode: 400, message: 'Test coverage too low' },
  LINT_ERRORS_FOUND: { code: 'LINT_ERRORS_FOUND', statusCode: 400, message: 'Lint errors found' },
  BUILD_FAILED: { code: 'BUILD_FAILED', statusCode: 400, message: 'Build failed' },

  // LLM 相关错误 (5000-5999)
  LLM_API_ERROR: { code: 'LLM_API_ERROR', statusCode: 502, message: 'LLM API error' },
  LLM_RATE_LIMIT: { code: 'LLM_RATE_LIMIT', statusCode: 429, message: 'LLM rate limit exceeded' },
  LLM_TIMEOUT: { code: 'LLM_TIMEOUT', statusCode: 504, message: 'LLM request timed out' },
  LLM_INVALID_RESPONSE: { code: 'LLM_INVALID_RESPONSE', statusCode: 502, message: 'Invalid LLM response' },
  LLM_QUOTA_EXCEEDED: { code: 'LLM_QUOTA_EXCEEDED', statusCode: 429, message: 'LLM quota exceeded' },

  // 数据库错误 (6000-6999)
  DB_CONNECTION_FAILED: { code: 'DB_CONNECTION_FAILED', statusCode: 503, message: 'Database connection failed' },
  DB_QUERY_FAILED: { code: 'DB_QUERY_FAILED', statusCode: 500, message: 'Database query failed' },
  DB_TRANSACTION_FAILED: { code: 'DB_TRANSACTION_FAILED', statusCode: 500, message: 'Database transaction failed' },
  DB_DEADLOCK: { code: 'DB_DEADLOCK', statusCode: 503, message: 'Database deadlock detected', retryable: true },

  // Agent 相关错误 (7000-7999)
  AGENT_INITIALIZATION_FAILED: { code: 'AGENT_INITIALIZATION_FAILED', statusCode: 500, message: 'Agent initialization failed' },
  AGENT_EXECUTION_FAILED: { code: 'AGENT_EXECUTION_FAILED', statusCode: 500, message: 'Agent execution failed' },
  AGENT_TIMEOUT: { code: 'AGENT_TIMEOUT', statusCode: 504, message: 'Agent execution timed out' },
  AGENT_INVALID_OUTPUT: { code: 'AGENT_INVALID_OUTPUT', statusCode: 500, message: 'Agent produced invalid output' },

  // 工作流相关错误 (8000-8999)
  WORKFLOW_NOT_FOUND: { code: 'WORKFLOW_NOT_FOUND', statusCode: 404, message: 'Workflow not found' },
  WORKFLOW_INVALID_STATE: { code: 'WORKFLOW_INVALID_STATE', statusCode: 400, message: 'Invalid workflow state' },
  WORKFLOW_STAGE_FAILED: { code: 'WORKFLOW_STAGE_FAILED', statusCode: 500, message: 'Workflow stage failed' },
  WORKFLOW_CIRCULAR_DEPENDENCY: { code: 'WORKFLOW_CIRCULAR_DEPENDENCY', statusCode: 400, message: 'Circular dependency detected' },
} as const;

type ErrorCode = keyof typeof ErrorCodes;
```

## 2. 全局错误处理

### 2.1 Express 错误中间件

```typescript
// src/error/express-error-handler.ts
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
    timestamp: number;
    stack?: string;  // 仅在开发环境
  };
}

class GlobalErrorHandler {
  private env: string;
  private logger: Logger;
  private metrics: MetricsCollector;

  constructor(env: string, logger: Logger, metrics: MetricsCollector) {
    this.env = env;
    this.logger = logger;
    this.metrics = metrics;
  }

  // Express 错误处理中间件
  handleError(
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const requestId = (req as any).requestId || generateRequestId();

    // 记录错误
    this.logError(error, req, requestId);

    // 增加错误指标
    this.incrementErrorMetrics(error);

    // 构建响应
    const response = this.buildErrorResponse(error, requestId);

    // 发送响应
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    res.status(statusCode).json(response);
  }

  private logError(error: Error, req: Request, requestId: string): void {
    const logContext = {
      requestId,
      method: req.method,
      url: req.url,
      userId: (req as any).user?.id,
      errorCode: error instanceof AppError ? error.code : 'UNKNOWN',
      stack: error.stack,
    };

    if (error instanceof AppError && error.isOperational) {
      this.logger.warn('Operational error', { ...logContext, message: error.message });
    } else {
      this.logger.error('Programming error', { ...logContext, message: error.message });
    }
  }

  private incrementErrorMetrics(error: Error): void {
    const errorType = this.categorizeError(error);
    this.metrics.increment(`error.${errorType}`);
  }

  private categorizeError(error: Error): string {
    if (error instanceof LLMError) return 'llm';
    if (error instanceof DatabaseError) return 'database';
    if (error instanceof ValidationError) return 'validation';
    if (error instanceof AuthenticationError) return 'auth';
    if (error instanceof BusinessError) return 'business';
    return 'system';
  }

  private buildErrorResponse(error: Error, requestId: string): ErrorResponse {
    const isOperational = error instanceof AppError ? error.isOperational : false;

    return {
      success: false,
      error: {
        code: error instanceof AppError ? error.code : 'UNKNOWN_ERROR',
        message: isOperational ? error.message : 'An internal error occurred',
        details: error instanceof BusinessError ? error.details : undefined,
        requestId,
        timestamp: Date.now(),
        stack: this.env === 'development' ? error.stack : undefined,
      },
    };
  }

  // 404 处理
  handleNotFound(req: Request, res: Response): void {
    res.status(404).json({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `Route ${req.method} ${req.url} not found`,
        requestId: (req as any).requestId || generateRequestId(),
        timestamp: Date.now(),
      },
    });
  }

  // 异步错误包装
  wrapAsync<T>(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
  ): (req: Request, res: Response, next: NextFunction) => void {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

// 使用示例
// app.get('/api/projects/:id', errorHandler.wrapAsync(async (req, res) => {
//   const project = await projectService.findById(req.params.id);
//   if (!project) throw new NotFoundError('Project', req.params.id);
//   res.json(project);
// }));
```

### 2.2 统一错误响应格式

```typescript
// src/error/error-response.ts
interface APIError {
  code: string;
  message: string;
  details?: {
    field?: string;
    issues?: Array<{ field: string; message: string }>;
    context?: Record<string, unknown>;
  };
  requestId: string;
  timestamp: number;
  helpUrl?: string;  // 指向文档的链接
}

// 错误响应构建器
class ErrorResponseBuilder {
  private error: APIError;

  constructor(code: string, message: string, requestId: string) {
    this.error = { code, message, requestId, timestamp: Date.now() };
  }

  withField(field: string): this {
    this.error.details = { ...this.error.details, field };
    return this;
  }

  withFieldErrors(errors: Array<{ field: string; message: string }>): this {
    this.error.details = { ...this.error.details, issues: errors };
    return this;
  }

  withContext(context: Record<string, unknown>): this {
    this.error.details = { ...this.error.details, context };
    return this;
  }

  withHelpUrl(url: string): this {
    this.error.helpUrl = url;
    return this;
  }

  build(): APIError {
    return this.error;
  }
}

// 快速创建常见错误
const Errors = {
  badRequest: (requestId: string, message: string) =>
    new ErrorResponseBuilder('BAD_REQUEST', message, requestId).build(),

  unauthorized: (requestId: string) =>
    new ErrorResponseBuilder('UNAUTHORIZED', 'Authentication required', requestId).build(),

  forbidden: (requestId: string) =>
    new ErrorResponseBuilder('FORBIDDEN', 'Access denied', requestId).build(),

  notFound: (requestId: string, resource: string) =>
    new ErrorResponseBuilder('NOT_FOUND', `${resource} not found`, requestId).build(),

  conflict: (requestId: string, message: string) =>
    new ErrorResponseBuilder('CONFLICT', message, requestId).build(),

  tooManyRequests: (requestId: string, retryAfter?: number) => {
    const error = new ErrorResponseBuilder('TOO_MANY_REQUESTS', 'Rate limit exceeded', requestId).build();
    if (retryAfter) {
      (error as any).retryAfter = retryAfter;
    }
    return error;
  },

  internal: (requestId: string) =>
    new ErrorResponseBuilder('INTERNAL_ERROR', 'An internal error occurred', requestId).build(),
};
```

## 3. 重试策略

### 3.1 可重试错误判断

```typescript
// src/error/retry-strategy.ts
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors?: string[];   // 可重试的错误码
  nonRetryableErrors?: string[]; // 不可重试的错误码
}

class RetryStrategy {
  private config: RetryConfig;

  constructor(config: RetryConfig) {
    this.config = {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitter: true,
      ...config,
    };
  }

  shouldRetry(error: Error, attemptNumber: number): boolean {
    // 已达到最大重试次数
    if (attemptNumber >= this.config.maxRetries) {
      return false;
    }

    // 检查不可重试的错误
    if (error instanceof AppError && !error.isOperational) {
      return false;  // 编程错误不重试
    }

    // 检查明确的不可重试错误码
    if (this.config.nonRetryableErrors?.includes(error.message)) {
      return false;
    }

    // 检查可重试错误码
    if (this.config.retryableErrors && this.config.retryableErrors.length > 0) {
      return this.config.retryableErrors.some(code =>
        error.message.includes(code) || (error as any).code?.includes(code)
      );
    }

    // 默认根据错误类型判断
    return this.isRetryableError(error);
  }

  private isRetryableError(error: Error): boolean {
    // 网络错误通常可重试
    if (error.name === 'NetworkError' || error.message.includes('ECONNREFUSED')) {
      return true;
    }

    // 超时通常可重试
    if (error instanceof TimeoutError) {
      return true;
    }

    // LLM 限流可重试
    if (error instanceof LLMError && error.retryable) {
      return true;
    }

    // 数据库死锁可重试
    if (error instanceof DatabaseError && error.retryable) {
      return true;
    }

    // HTTP 429/502/503/504 可重试
    if (error instanceof AppError) {
      return [429, 502, 503, 504].includes(error.statusCode);
    }

    return false;
  }

  getDelay(attemptNumber: number): number {
    // 指数退避
    let delay = this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attemptNumber);

    // 限制最大延迟
    delay = Math.min(delay, this.config.maxDelayMs);

    // 添加抖动
    if (this.config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    onRetry?: (error: Error, attempt: number) => void
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (!this.shouldRetry(lastError, attempt)) {
          throw lastError;
        }

        if (onRetry) {
          onRetry(lastError, attempt);
        }

        if (attempt < this.config.maxRetries) {
          const delay = this.getDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 预定义的重试策略
const RetryStrategies = {
  // 快速重试（用于实时操作）
  fast: new RetryStrategy({
    maxRetries: 2,
    initialDelayMs: 100,
    maxDelayMs: 1000,
    backoffMultiplier: 2,
  }),

  // 标准重试（用于普通操作）
  standard: new RetryStrategy({
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  }),

  // 慢速重试（用于后台任务）
  slow: new RetryStrategy({
    maxRetries: 5,
    initialDelayMs: 5000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    jitter: true,
  }),

  // LLM 调用重试
  llm: new RetryStrategy({
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: ['rate_limit', 'timeout', 'server_error', 'overloaded'],
  }),

  // 数据库重试
  database: new RetryStrategy({
    maxRetries: 3,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    nonRetryableErrors: ['invalid_input', 'constraint_violation'],
  }),
};
```

### 3.2 重试装饰器

```typescript
// src/error/retry-decorator.ts

// 装饰器方式使用重试
function retry(config?: Partial<RetryConfig>) {
  const strategy = new RetryStrategy(config || {});

  return function <T>(
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return strategy.executeWithRetry(
        () => originalMethod.apply(this, args),
        (error, attempt) => {
          console.warn(`Retry attempt ${attempt + 1} for ${_propertyKey}:`, error.message);
        }
      );
    };

    return descriptor;
  };
}

// 使用示例
class LLMService {
  @retry(RetryStrategies.llm)
  async generate(prompt: string): Promise<string> {
    // LLM 调用
    return '';
  }

  @retry(RetryStrategies.database)
  async query(sql: string): Promise<any[]> {
    // 数据库查询
    return [];
  }
}
```

## 4. 断路器模式

### 4.1 断路器实现

```typescript
// src/resilience/circuit-breaker.ts
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerConfig {
  failureThreshold: number;      // 打开断路器的失败次数
  successThreshold: number;      // 半开状态下的成功次数
  timeout: number;               // 断路器打开持续时间（毫秒）
  halfOpenRequests: number;      // 半开状态下允许的请求数
}

interface CircuitBreakerStats {
  totalRequests: number;
  failedRequests: number;
  successfulRequests: number;
  rejectedRequests: number;
  state: CircuitState;
  lastFailureTime?: number;
  lastSuccessTime?: number;
}

class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt = 0;
  private halfOpenRequestsLeft = 0;
  private config: CircuitBreakerConfig;
  private stats: CircuitBreakerStats;

  constructor(name: string, config: CircuitBreakerConfig) {
    this.config = config;
    this.stats = {
      totalRequests: 0,
      failedRequests: 0,
      successfulRequests: 0,
      rejectedRequests: 0,
      state: 'CLOSED',
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.stats.totalRequests++;

    // 检查是否可以执行
    if (!this.canExecute()) {
      this.stats.rejectedRequests++;
      throw new Error(`Circuit breaker is ${this.state}`);
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

  private canExecute(): boolean {
    switch (this.state) {
      case 'CLOSED':
        return true;

      case 'OPEN':
        if (Date.now() >= this.nextAttempt) {
          this.toHalfOpen();
          return true;
        }
        return false;

      case 'HALF_OPEN':
        if (this.halfOpenRequestsLeft > 0) {
          this.halfOpenRequestsLeft--;
          return true;
        }
        return false;

      default:
        return false;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    switch (this.state) {
      case 'HALF_OPEN':
        this.successCount++;
        if (this.successCount >= this.config.successThreshold) {
          this.toClosed();
        }
        break;

      case 'CLOSED':
        // 正常处理
        break;
    }

    this.stats.successfulRequests++;
    this.stats.lastSuccessTime = Date.now();
  }

  private onFailure(): void {
    this.failureCount++;
    this.stats.failedRequests++;
    this.stats.lastFailureTime = Date.now();

    switch (this.state) {
      case 'HALF_OPEN':
        // 半开状态下失败，直接打开
        this.toOpen();
        break;

      case 'CLOSED':
        if (this.failureCount >= this.config.failureThreshold) {
          this.toOpen();
        }
        break;
    }
  }

  private toOpen(): void {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + this.config.timeout;
    this.halfOpenRequestsLeft = 0;
    this.stats.state = 'OPEN';
    console.warn('Circuit breaker opened');
  }

  private toHalfOpen(): void {
    this.state = 'HALF_OPEN';
    this.successCount = 0;
    this.halfOpenRequestsLeft = this.config.halfOpenRequests;
    this.stats.state = 'HALF_OPEN';
    console.info('Circuit breaker half-open');
  }

  private toClosed(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenRequestsLeft = 0;
    this.stats.state = 'CLOSED';
    console.info('Circuit breaker closed');
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): CircuitBreakerStats {
    return { ...this.stats };
  }

  // 手动控制
  reset(): void {
    this.toClosed();
  }

  forceOpen(): void {
    this.toOpen();
  }
}

// 为不同服务创建断路器
const circuitBreakers = {
  llm: new CircuitBreaker('llm', {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000,
    halfOpenRequests: 3,
  }),

  database: new CircuitBreaker('database', {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 30000,
    halfOpenRequests: 1,
  }),

  knowledgeBase: new CircuitBreaker('knowledge-base', {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 60000,
    halfOpenRequests: 5,
  }),

  fileStorage: new CircuitBreaker('file-storage', {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 30000,
    halfOpenRequests: 3,
  }),
};
```

### 4.2 带断路器的服务调用

```typescript
// src/resilience/resilient-client.ts
interface ResilientConfig {
  circuitBreaker: CircuitBreaker;
  retryStrategy: RetryStrategy;
  timeout: number;
  fallback?: () => Promise<any>;
}

class ResilientClient<T> {
  private config: ResilientConfig;

  constructor(config: ResilientConfig) {
    this.config = config;
  }

  async call(operation: () => Promise<T>): Promise<T> {
    // 使用断路器包装
    const wrappedOperation = async () => {
      // 使用重试策略
      return this.config.retryStrategy.executeWithRetry(operation);
    };

    try {
      return await this.config.circuitBreaker.execute(wrappedOperation);
    } catch (error) {
      // 如果有 fallback，尝试 fallback
      if (this.config.fallback) {
        console.warn('Circuit breaker open, attempting fallback');
        return this.config.fallback();
      }
      throw error;
    }
  }
}

// LLM 调用客户端
class ResilientLLMClient extends ResilientClient<string> {
  constructor(service: 'openai' | 'anthropic') {
    const breaker = service === 'openai' ? circuitBreakers.llm : circuitBreakers.llm;

    super({
      circuitBreaker: breaker,
      retryStrategy: RetryStrategies.llm,
      timeout: 30000,
      fallback: async () => {
        // 降级到缓存或返回错误消息
        console.warn('LLM fallback activated');
        return 'I apologize, but I encountered an issue processing your request. Please try again later.';
      },
    });
  }

  async generate(prompt: string, options?: LLMOptions): Promise<string> {
    return this.call(() => this.doGenerate(prompt, options));
  }

  private async doGenerate(prompt: string, options?: LLMOptions): Promise<string> {
    // 实际的 LLM 调用
    return '';
  }
}
```

## 5. 优雅降级

### 5.1 降级策略

```typescript
// src/resilience/graceful-degradation.ts
interface DegradationStrategy<T> {
  name: string;
  priority: number;
  isAvailable: () => Promise<boolean>;
  execute: () => Promise<T>;
}

class GracefulDegradation {
  private strategies: Map<string, DegradationStrategy<any>[]> = new Map();

  register<T>(feature: string, strategy: DegradationStrategy<T>): void {
    const existing = this.strategies.get(feature) || [];
    existing.push(strategy as DegradationStrategy<any>);
    existing.sort((a, b) => b.priority - a.priority);
    this.strategies.set(feature, existing);
  }

  async execute<T>(feature: string): Promise<T> {
    const strategies = this.strategies.get(feature);

    if (!strategies || strategies.length === 0) {
      throw new Error(`No degradation strategy for feature: ${feature}`);
    }

    const errors: Error[] = [];

    for (const strategy of strategies) {
      try {
        const isAvailable = await strategy.isAvailable();
        if (!isAvailable) {
          console.info(`Strategy ${strategy.name} is not available`);
          continue;
        }

        return await strategy.execute();
      } catch (error) {
        console.warn(`Strategy ${strategy.name} failed:`, error);
        errors.push(error as Error);
      }
    }

    // 所有策略都失败
    throw new Error(`All degradation strategies failed for ${feature}: ${errors.map(e => e.message).join(', ')}`);
  }

  // 取消注册
  unregister(feature: string, strategyName: string): void {
    const strategies = this.strategies.get(feature);
    if (strategies) {
      this.strategies.set(feature, strategies.filter(s => s.name !== strategyName));
    }
  }
}

// 项目生成的降级策略
const projectGenerationDegradation = new GracefulDegradation();

// 策略 1: 完整 AI 生成（最高优先级）
projectGenerationDegradation.register('project-generation', {
  name: 'full-ai-generation',
  priority: 100,
  isAvailable: async () => {
    const breaker = circuitBreakers.llm;
    return breaker.getState() !== 'OPEN';
  },
  execute: async () => {
    // 完整的 AI 生成流程
    return await orchestrator.executeFullPipeline();
  },
});

// 策略 2: 简化模板生成
projectGenerationDegradation.register('project-generation', {
  name: 'template-generation',
  priority: 50,
  isAvailable: async () => true,
  execute: async () => {
    // 使用预定义模板生成
    return await projectGenerator.generateFromTemplate();
  },
});

// 策略 3: 基础脚手架
projectGenerationDegradation.register('project-generation', {
  name: 'basic-scaffold',
  priority: 10,
  isAvailable: async () => true,
  execute: async () => {
    // 仅创建基本目录结构
    return await projectGenerator.createBasicScaffold();
  },
});
```

### 5.2 功能开关控制

```typescript
// src/resilience/feature-flags.ts
interface FeatureFlag {
  name: string;
  enabled: boolean;
  rolloutPercentage?: number;
  targetUsers?: string[];
  conditions?: Record<string, unknown>;
}

class FeatureFlagManager {
  private flags: Map<string, FeatureFlag> = new Map();
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.loadDefaultFlags();
  }

  private loadDefaultFlags(): void {
    this.flags.set('advanced-code-review', {
      name: 'advanced-code-review',
      enabled: true,
      rolloutPercentage: 100,
    });

    this.flags.set('ai-architecture-suggestions', {
      name: 'ai-architecture-suggestions',
      enabled: true,
      rolloutPercentage: 50,
    });

    this.flags.set('auto-knowledge-extraction', {
      name: 'auto-knowledge-extraction',
      enabled: true,
      rolloutPercentage: 100,
    });

    this.flags.set('experimental-optimizer', {
      name: 'experimental-optimizer',
      enabled: false,
    });
  }

  async isEnabled(flagName: string, userId?: string): Promise<boolean> {
    const flag = this.flags.get(flagName) || await this.loadFlagFromConfig(flagName);

    if (!flag) return false;
    if (!flag.enabled) return false;

    // 检查 rollout 百分比
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      if (userId) {
        // 基于用户 ID 的确定性分配
        const hash = this.hash(`${flagName}:${userId}`);
        const bucket = hash % 100;
        if (bucket >= flag.rolloutPercentage) {
          return false;
        }
      } else {
        // 随机分配
        if (Math.random() * 100 > flag.rolloutPercentage) {
          return false;
        }
      }
    }

    // 检查目标用户
    if (flag.targetUsers && flag.targetUsers.length > 0) {
      if (!userId || !flag.targetUsers.includes(userId)) {
        return false;
      }
    }

    // 检查条件
    if (flag.conditions) {
      if (!this.evaluateConditions(flag.conditions)) {
        return false;
      }
    }

    return true;
  }

  private async loadFlagFromConfig(name: string): Promise<FeatureFlag | null> {
    try {
      const value = await this.configManager.get(`feature.${name}`);
      return typeof value === 'boolean' ? { name, enabled: value } : value;
    } catch {
      return null;
    }
  }

  private evaluateConditions(conditions: Record<string, unknown>): boolean {
    // 实现条件评估逻辑
    return true;
  }

  private hash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  // 运行时更新
  async setFlag(flag: FeatureFlag): Promise<void> {
    this.flags.set(flag.name, flag);
    await this.configManager.set(`feature.${flag.name}`, flag);
  }

  // 批量检查
  async checkFlags(flagNames: string[], userId?: string): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    for (const name of flagNames) {
      results.set(name, await this.isEnabled(name, userId));
    }
    return results;
  }
}

// 使用示例
const featureFlags = new FeatureFlagManager(configManager);

if (await featureFlags.isEnabled('advanced-code-review', userId)) {
  // 使用高级代码审查
}
```

## 6. 超时管理

### 6.1 超时配置

```typescript
// src/resilience/timeout-manager.ts
interface TimeoutConfig {
  name: string;
  duration: number;
  action: 'throw' | 'cancel' | 'log';
}

const TimeoutConfigs: TimeoutConfig[] = [
  // API 超时
  { name: 'api.read', duration: 5000, action: 'throw' },
  { name: 'api.write', duration: 10000, action: 'throw' },
  { name: 'api.longRunning', duration: 60000, action: 'log' },

  // LLM 超时
  { name: 'llm.generate', duration: 30000, action: 'throw' },
  { name: 'llm.embed', duration: 10000, action: 'throw' },

  // 数据库超时
  { name: 'db.query', duration: 5000, action: 'throw' },
  { name: 'db.transaction', duration: 30000, action: 'throw' },

  // Agent 超时
  { name: 'agent.simpleTask', duration: 60000, action: 'throw' },
  { name: 'agent.complexTask', duration: 300000, action: 'throw' },
  { name: 'agent.workflow', duration: 1800000, action: 'log' },

  // 外部服务超时
  { name: 'external.github', duration: 10000, action: 'throw' },
  { name: 'external.webhook', duration: 5000, action: 'throw' },
];

class TimeoutManager {
  private configs: Map<string, TimeoutConfig> = new Map();

  constructor() {
    for (const config of TimeoutConfigs) {
      this.configs.set(config.name, config);
    }
  }

  async withTimeout<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const config = this.configs.get(name);

    if (!config) {
      // 使用默认超时
      return this.withDefaultTimeout(name, operation);
    }

    return this.executeWithTimeout(operation, config);
  }

  private async withDefaultTimeout<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<T> {
    return this.executeWithTimeout(operation, {
      name,
      duration: 30000,
      action: 'throw',
    });
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    config: TimeoutConfig
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (config.action === 'throw') {
          reject(new TimeoutError(`Operation ${config.name} timed out after ${config.duration}ms`, config.name));
        } else if (config.action === 'log') {
          console.warn(`Operation ${config.name} timed out after ${config.duration}ms`);
        }
      }, config.duration);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  // 装饰器方式
  timeout(name: string) {
    return function <T>(
      _target: any,
      _propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        return new TimeoutManager().withTimeout(name, () =>
          originalMethod.apply(this, args)
        );
      };

      return descriptor;
    };
  }

  // 动态调整超时
  setTimeout(name: string, duration: number): void {
    const existing = this.configs.get(name);
    if (existing) {
      this.configs.set(name, { ...existing, duration });
    } else {
      this.configs.set(name, { name, duration, action: 'throw' });
    }
  }
}

export const timeoutManager = new TimeoutManager();

// 使用示例
class ProjectService {
  @timeoutManager.timeout('agent.complexTask')
  async generateProject(idea: Idea): Promise<Project> {
    // 这个方法会有 5 分钟超时
    return orchestrator.generate(idea);
  }
}
```

## 7. 错误监控与告警

### 7.1 错误收集

```typescript
// src/monitoring/error-collector.ts
interface CollectedError {
  id: string;
  type: string;
  message: string;
  stack?: string;
  context: {
    userId?: string;
    requestId?: string;
    userAgent?: string;
    url?: string;
    method?: string;
  };
  metadata: {
    timestamp: number;
    environment: string;
    version: string;
    service: string;
  };
  resolved: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
}

class ErrorCollector {
  private errors: Map<string, CollectedError> = new Map();
  private alertThreshold = 10;  // 同一错误 5 分钟内出现 10 次触发告警
  private errorCounts: Map<string, number[]> = new Map();  // 错误代码 -> 时间戳数组

  collect(error: Error, context: CollectedError['context']): string {
    const id = generateId();
    const errorKey = this.getErrorKey(error);

    const collected: CollectedError = {
      id,
      type: error.constructor.name,
      message: error.message,
      stack: error.stack,
      context,
      metadata: {
        timestamp: Date.now(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || 'unknown',
        service: 'projectfactory',
      },
      resolved: false,
    };

    this.errors.set(id, collected);
    this.trackErrorCount(errorKey);

    return id;
  }

  private getErrorKey(error: Error): string {
    // 根据错误类型和消息生成唯一键
    const code = (error as any).code || error.constructor.name;
    const message = error.message.substring(0, 100);  // 截断长消息
    return `${code}:${message}`;
  }

  private trackErrorCount(errorKey: string): void {
    const now = Date.now();
    const timestamps = this.errorCounts.get(errorKey) || [];

    // 清理 5 分钟前的记录
    const recentTimestamps = timestamps.filter(t => now - t < 5 * 60 * 1000);
    recentTimestamps.push(now);
    this.errorCounts.set(errorKey, recentTimestamps);

    // 检查是否触发告警
    if (recentTimestamps.length >= this.alertThreshold) {
      this.triggerAlert(errorKey, recentTimestamps.length);
    }
  }

  private async triggerAlert(errorKey: string, count: number): Promise<void> {
    const error = Array.from(this.errors.values()).find(
      e => this.getErrorKey(e as any) === errorKey
    );

    console.error(`ALERT: Error ${errorKey} occurred ${count} times in 5 minutes`, {
      error,
    });

    // 发送告警
    // await alertingService.send('critical', `Error ${errorKey} spike detected`, { count });
  }

  getErrors(options?: {
    status?: 'resolved' | 'unresolved' | 'all';
    type?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): CollectedError[] {
    let results = Array.from(this.errors.values());

    if (options?.status === 'resolved') {
      results = results.filter(e => e.resolved);
    } else if (options?.status === 'unresolved') {
      results = results.filter(e => !e.resolved);
    }

    if (options?.type) {
      results = results.filter(e => e.type === options.type);
    }

    if (options?.startTime) {
      results = results.filter(e => e.metadata.timestamp >= options.startTime!);
    }

    if (options?.endTime) {
      results = results.filter(e => e.metadata.timestamp <= options.endTime!);
    }

    // 按时间倒序
    results.sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);

    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  resolveError(errorId: string, resolvedBy: string): void {
    const error = this.errors.get(errorId);
    if (error) {
      error.resolved = true;
      error.resolvedAt = Date.now();
      error.resolvedBy = resolvedBy;
    }
  }

  getErrorStats(): {
    total: number;
    resolved: number;
    unresolved: number;
    byType: Record<string, number>;
  } {
    const errors = Array.from(this.errors.values());

    return {
      total: errors.length,
      resolved: errors.filter(e => e.resolved).length,
      unresolved: errors.filter(e => !e.resolved).length,
      byType: errors.reduce((acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}

export const errorCollector = new ErrorCollector();
```

### 7.2 错误告警规则

```typescript
// src/monitoring/error-alerts.ts
const ErrorAlertRules = [
  {
    name: 'error_rate_spike',
    condition: () => {
      const recent = errorCollector.getErrors({
        startTime: Date.now() - 5 * 60 * 1000,
      });
      return recent.length > 50;
    },
    severity: 'critical',
    message: 'Error rate spike detected',
  },
  {
    name: 'critical_error_type',
    condition: () => {
      const criticalErrors = errorCollector.getErrors({ type: 'SystemError' });
      return criticalErrors.length > 0;
    },
    severity: 'critical',
    message: 'Critical system error detected',
  },
  {
    name: 'llm_error_rate',
    condition: () => {
      const llmErrors = errorCollector.getErrors({ type: 'LLMError' });
      const recent = llmErrors.filter(e => e.metadata.timestamp > Date.now() - 5 * 60 * 1000);
      return recent.length > 10;
    },
    severity: 'warning',
    message: 'High LLM error rate detected',
  },
  {
    name: 'unresolved_errors',
    condition: () => {
      const stats = errorCollector.getErrorStats();
      return stats.unresolved > 100;
    },
    severity: 'warning',
    message: 'Many unresolved errors',
  },
  {
    name: 'database_error',
    condition: () => {
      const dbErrors = errorCollector.getErrors({ type: 'DatabaseError' });
      return dbErrors.length > 0;
    },
    severity: 'critical',
    message: 'Database error detected',
  },
];
```

---

**最后更新**: 2026-04-14
**版本**: v1.0
