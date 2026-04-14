# 错误处理与系统韧性

## 概述

错误处理与系统韧性系统（Error Handling & System Resilience）是确保ProjectFactory系统持续稳定运行的关键能力。系统涵盖异常处理、降级策略、重试机制、超时控制、熔断保护和故障恢复等各个方面，确保系统在面对各类故障时能够优雅应对、快速恢复。

## 核心价值

- **快速失效**：fail-secure原则，故障时安全返回
- **优雅降级**：部分功能不可用时保持核心功能
- **自动重试**：瞬时故障自动恢复
- **熔断保护**：防止故障级联扩散
- **可观测**：错误追踪和根因分析

## 错误分类模型

### 错误类型层次

```typescript
// 错误类型枚举
enum ErrorType {
  // 客户端错误 (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',       // 参数验证错误
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR', // 认证失败
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',   // 权限不足
  NOT_FOUND = 'NOT_FOUND',                     // 资源不存在
  CONFLICT = 'CONFLICT',                       // 资源冲突
  RATE_LIMITED = 'RATE_LIMITED',              // 请求过于频繁

  // 服务端错误 (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',           // 内部错误
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE', // 服务不可用
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',         // 网关超时

  // 业务错误
  BUSINESS_ERROR = 'BUSINESS_ERROR',           // 业务逻辑错误
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',   // 资源耗尽

  // 系统错误
  NETWORK_ERROR = 'NETWORK_ERROR',             // 网络错误
  DATABASE_ERROR = 'DATABASE_ERROR',           // 数据库错误
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',            // 超时错误
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR', // 外部服务错误
}

// 错误严重级别
enum ErrorSeverity {
  CRITICAL = 'critical',     // 系统不可用
  HIGH = 'high',             // 核心功能受影响
  MEDIUM = 'medium',         // 非核心功能受影响
  LOW = 'low',              // 轻微问题
}

// 应用错误类
class AppError extends Error {
  constructor(
    public type: ErrorType,
    public code: string,
    message: string,
    public severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    public details?: Record<string, any>,
    public cause?: Error
  ) {
    super(message);
    this.name = 'AppError';
  }

  // HTTP状态码映射
  get statusCode(): number {
    const mapping: Record<ErrorType, number> = {
      [ErrorType.VALIDATION_ERROR]: 400,
      [ErrorType.AUTHENTICATION_ERROR]: 401,
      [ErrorType.AUTHORIZATION_ERROR]: 403,
      [ErrorType.NOT_FOUND]: 404,
      [ErrorType.CONFLICT]: 409,
      [ErrorType.RATE_LIMITED]: 429,
      [ErrorType.INTERNAL_ERROR]: 500,
      [ErrorType.SERVICE_UNAVAILABLE]: 503,
      [ErrorType.GATEWAY_TIMEOUT]: 504,
      [ErrorType.BUSINESS_ERROR]: 422,
      [ErrorType.RESOURCE_EXHAUSTED]: 429,
      [ErrorType.NETWORK_ERROR]: 503,
      [ErrorType.DATABASE_ERROR]: 503,
      [ErrorType.TIMEOUT_ERROR]: 504,
      [ErrorType.EXTERNAL_SERVICE_ERROR]: 502,
    };
    return mapping[this.type] || 500;
  }

  // 是否可重试
  get retryable(): boolean {
    const retryableTypes = [
      ErrorType.SERVICE_UNAVAILABLE,
      ErrorType.GATEWAY_TIMEOUT,
      ErrorType.NETWORK_ERROR,
      ErrorType.DATABASE_ERROR,
      ErrorType.EXTERNAL_SERVICE_ERROR,
    ];
    return retryableTypes.includes(this.type);
  }

  // 转换为API响应格式
  toResponse(): ErrorResponse {
    return {
      error: {
        code: this.code,
        type: this.type,
        message: this.message,
        details: this.details,
        requestId: getCurrentRequestId(),
        timestamp: new Date().toISOString(),
      },
    };
  }
}
```

### 错误工厂

```typescript
// 错误工厂
class ErrorFactory {
  // 验证错误
  static validationError(
    message: string,
    details?: Record<string, string[]>
  ): AppError {
    return new AppError(
      ErrorType.VALIDATION_ERROR,
      'VALIDATION_ERROR',
      message,
      ErrorSeverity.MEDIUM,
      details
    );
  }

  // 认证错误
  static authenticationError(message = 'Authentication required'): AppError {
    return new AppError(
      ErrorType.AUTHENTICATION_ERROR,
      'AUTH_ERROR',
      message,
      ErrorSeverity.HIGH
    );
  }

  // 权限错误
  static authorizationError(message = 'Permission denied'): AppError {
    return new AppError(
      ErrorType.AUTHORIZATION_ERROR,
      'AUTHZ_ERROR',
      message,
      ErrorSeverity.HIGH
    );
  }

  // 未找到
  static notFound(resource: string, id?: string): AppError {
    return new AppError(
      ErrorType.NOT_FOUND,
      'NOT_FOUND',
      id ? `${resource} with ID ${id} not found` : `${resource} not found`,
      ErrorSeverity.MEDIUM
    );
  }

  // 业务错误
  static businessError(message: string, details?: Record<string, any>): AppError {
    return new AppError(
      ErrorType.BUSINESS_ERROR,
      'BUSINESS_ERROR',
      message,
      ErrorSeverity.MEDIUM,
      details
    );
  }

  // 外部服务错误
  static externalServiceError(
    service: string,
    originalError?: Error
  ): AppError {
    return new AppError(
      ErrorType.EXTERNAL_SERVICE_ERROR,
      'EXTERNAL_SERVICE_ERROR',
      `External service ${service} is unavailable`,
      ErrorSeverity.HIGH,
      { service },
      originalError
    );
  }

  // 超时错误
  static timeoutError(operation: string, timeout: number): AppError {
    return new AppError(
      ErrorType.TIMEOUT_ERROR,
      'TIMEOUT',
      `Operation ${operation} timed out after ${timeout}ms`,
      ErrorSeverity.MEDIUM,
      { operation, timeout }
    );
  }

  // 数据库错误
  static databaseError(originalError: Error): AppError {
    return new AppError(
      ErrorType.DATABASE_ERROR,
      'DB_ERROR',
      'Database operation failed',
      ErrorSeverity.HIGH,
      undefined,
      originalError
    );
  }
}
```

## 重试机制

### 重试策略

```typescript
// 重试配置
interface RetryConfig {
  // 最大尝试次数
  maxAttempts: number;

  // 初始间隔
  initialDelay: number;           // ms

  // 最大间隔
  maxDelay: number;               // ms

  // 退避策略
  backoff: 'fixed' | 'exponential' | 'linear';

  // 抖动
  jitter: boolean;

  // 可重试的错误
  retryableErrors: ErrorType[];

  // 重试条件函数
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

// 预设重试策略
const RETRY_STRATEGIES = {
  // 快速重试（短暂故障）
  fast: {
    maxAttempts: 3,
    initialDelay: 100,
    maxDelay: 1000,
    backoff: 'exponential',
    jitter: true,
    retryableErrors: [
      ErrorType.NETWORK_ERROR,
      ErrorType.TIMEOUT_ERROR,
      ErrorType.SERVICE_UNAVAILABLE,
    ],
  },

  // 标准重试（外部服务）
  standard: {
    maxAttempts: 5,
    initialDelay: 1000,
    maxDelay: 30000,
    backoff: 'exponential',
    jitter: true,
    retryableErrors: [
      ErrorType.EXTERNAL_SERVICE_ERROR,
      ErrorType.GATEWAY_TIMEOUT,
      ErrorType.SERVICE_UNAVAILABLE,
    ],
  },

  // 持久重试（关键操作）
  persistent: {
    maxAttempts: 10,
    initialDelay: 5000,
    maxDelay: 60000,
    backoff: 'exponential',
    jitter: true,
    retryableErrors: [
      ErrorType.EXTERNAL_SERVICE_ERROR,
      ErrorType.DATABASE_ERROR,
      ErrorType.SERVICE_UNAVAILABLE,
    ],
  },

  // 无重试
  none: {
    maxAttempts: 1,
    initialDelay: 0,
    maxDelay: 0,
    backoff: 'fixed',
    jitter: false,
    retryableErrors: [],
  },
};

// 重试执行器
class RetryExecutor {
  execute<T>(
    operation: () => Promise<T>,
    config: RetryConfig
  ): Promise<T> {
    return this.retry(operation, 1, config);
  }

  private async retry<T>(
    operation: () => Promise<T>,
    attempt: number,
    config: RetryConfig
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const appError = error instanceof AppError ? error : new AppError(
        ErrorType.INTERNAL_ERROR,
        'UNKNOWN_ERROR',
        String(error),
        ErrorSeverity.HIGH
      );

      // 检查是否应该重试
      if (attempt >= config.maxAttempts) {
        throw error;
      }

      if (!config.retryableErrors.includes(appError.type)) {
        throw error;
      }

      if (config.shouldRetry && !config.shouldRetry(appError, attempt)) {
        throw error;
      }

      // 计算延迟
      const delay = this.calculateDelay(attempt, config);

      // 记录重试
      console.warn(`Retrying operation, attempt ${attempt + 1} after ${delay}ms`, {
        error: appError.message,
        type: appError.type,
      });

      // 等待后重试
      await this.sleep(delay);

      return this.retry(operation, attempt + 1, config);
    }
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay: number;

    switch (config.backoff) {
      case 'exponential':
        delay = config.initialDelay * Math.pow(2, attempt - 1);
        break;
      case 'linear':
        delay = config.initialDelay * attempt;
        break;
      case 'fixed':
      default:
        delay = config.initialDelay;
    }

    // 添加抖动
    if (config.jitter) {
      delay = delay * (0.5 + Math.random());
    }

    // 限制最大延迟
    return Math.min(delay, config.maxDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 重试装饰器

```typescript
// 重试装饰器
function retryable<T extends (...args: any[]) => Promise<any>>(
  config: RetryConfig
): (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) => void {
  return function (
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const originalMethod = descriptor.value!;
    const executor = new RetryExecutor();

    descriptor.value = async function (...args: any[]): Promise<any> {
      return executor.execute(() => originalMethod.apply(this, args), config);
    } as T;

    return descriptor;
  };
}

// 使用示例
class ExternalAPIService {
  @retryable(RETRY_STRATEGIES.standard)
  async callExternalAPI(data: Request): Promise<Response> {
    const response = await fetch('https://external-api.example.com', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  }
}
```

## 超时控制

### 超时管理器

```typescript
// 超时配置
interface TimeoutConfig {
  // 默认超时
  default: number;              // ms

  // 操作特定超时
  operations: Partial<Record<OperationType, number>>;
}

// 操作类型
enum OperationType {
  DATABASE_QUERY = 'database_query',
  DATABASE_TRANSACTION = 'database_transaction',
  HTTP_REQUEST = 'http_request',
  FILE_IO = 'file_io',
  LLM_INFERENCE = 'llm_inference',
  GENERATION = 'generation',
}

// 预设超时
const TIMEOUT_CONFIG: TimeoutConfig = {
  default: 30000,  // 30秒

  operations: {
    [OperationType.DATABASE_QUERY]: 5000,        // 5秒
    [OperationType.DATABASE_TRANSACTION]: 30000,   // 30秒
    [OperationType.HTTP_REQUEST]: 15000,          // 15秒
    [OperationType.FILE_IO]: 10000,               // 10秒
    [OperationType.LLM_INFERENCE]: 60000,         // 60秒
    [OperationType.GENERATION]: 300000,           // 5分钟
  },
};

// 超时包装器
class TimeoutWrapper {
  static async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    operationName = 'Operation'
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) =>
        setTimeout(() => {
          reject(ErrorFactory.timeoutError(operationName, timeoutMs));
        }, timeoutMs)
      ),
    ]);
  }

  // 数据库查询超时
  static async withQueryTimeout<T>(
    db: Database,
    sql: string,
    params: any[],
    timeoutMs = TIMEOUT_CONFIG.operations[OperationType.DATABASE_QUERY]
  ): Promise<T> {
    return this.withTimeout(
      () => db.execute(sql, params),
      timeoutMs,
      'Database query'
    );
  }

  // LLM推理超时
  static async withLLMTimeout<T>(
    llm: LLM,
    prompt: string,
    timeoutMs = TIMEOUT_CONFIG.operations[OperationType.LLM_INFERENCE]
  ): Promise<T> {
    return this.withTimeout(
      () => llm.invoke(prompt),
      timeoutMs,
      'LLM inference'
    );
  }
}
```

## 熔断保护

### 熔断器

```typescript
// 熔断器状态
enum CircuitState {
  CLOSED = 'closed',      // 正常，熔断器关闭
  OPEN = 'open',          // 熔断，开启状态
  HALF_OPEN = 'half_open', // 半开状态
}

// 熔断器配置
interface CircuitBreakerConfig {
  name: string;

  // 故障阈值
  failureThreshold: number;      // 失败次数阈值
  successThreshold: number;     // 成功次数阈值（用于从OPEN转到HALF_OPEN）

  // 超时配置
  timeout: number;             // OPEN状态持续时间(ms)

  // 半开配置
  halfOpenRequests: number;     // 半开状态下允许的请求数

  // 监控的错误类型
  monitoredErrors: ErrorType[];

  // 是否监控超时
  monitorTimeout: boolean;
}

// 熔断器实现
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private halfOpenRequestsExecuted = 0;

  constructor(private config: CircuitBreakerConfig) {}

  // 执行带熔断保护的操作
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // 检查状态
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenRequestsExecuted = 0;
      } else {
        throw new AppError(
          ErrorType.SERVICE_UNAVAILABLE,
          'CIRCUIT_OPEN',
          `Circuit breaker ${this.config.name} is OPEN`,
          ErrorSeverity.HIGH,
          {
            lastFailure: this.lastFailureTime,
            retryAfter: this.getRetryAfter(),
          }
        );
      }
    }

    // 尝试执行
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      this.halfOpenRequestsExecuted++;

      // 达到成功阈值，关闭熔断器
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        console.log(`Circuit breaker ${this.config.name} CLOSED`);
      }
    }
  }

  private onFailure(error: Error): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    // 检查是否应该打开熔断器
    if (this.state === CircuitState.HALF_OPEN) {
      // 半开状态下失败，立即打开
      this.state = CircuitState.OPEN;
      console.warn(`Circuit breaker ${this.config.name} OPEN (half-open failure)`);
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      console.warn(`Circuit breaker ${this.config.name} OPEN (threshold exceeded)`);
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    const elapsed = Date.now() - this.lastFailureTime.getTime();
    return elapsed >= this.config.timeout;
  }

  private getRetryAfter(): number {
    if (!this.lastFailureTime) return 0;
    const elapsed = Date.now() - this.lastFailureTime.getTime();
    return Math.max(0, this.config.timeout - elapsed);
  }

  getState(): { state: CircuitState; metrics: CircuitMetrics } {
    return {
      state: this.state,
      metrics: {
        failureCount: this.failureCount,
        successCount: this.successCount,
        lastFailureTime: this.lastFailureTime,
      },
    };
  }
}

// 熔断器注册表
class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  register(config: CircuitBreakerConfig): CircuitBreaker {
    const breaker = new CircuitBreaker(config);
    this.breakers.set(config.name, breaker);
    return breaker;
  }

  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  getAllStates(): Record<string, { state: CircuitState; metrics: CircuitMetrics }> {
    const states: Record<string, any> = {};
    this.breakers.forEach((breaker, name) => {
      states[name] = breaker.getState();
    });
    return states;
  }
}
```

## 降级策略

### 降级服务

```typescript
// 降级策略配置
interface DegradationConfig {
  name: string;
  priority: number;           // 优先级，越低越先被降级

  // 降级条件
  conditions: {
    errorRateThreshold?: number;    // 错误率阈值
    latencyThreshold?: number;     // 延迟阈值(ms)
    errorCountThreshold?: number;    // 连续错误数
  };

  // 降级动作
  action: DegradationAction;

  // 恢复条件
  recovery: {
    minRequests?: number;          // 最少请求数
    errorRateBelow?: number;       // 错误率需低于
    latencyBelow?: number;        // 延迟需低于
  };
}

type DegradationAction =
  | { type: 'disable_feature'; feature: string }
  | { type: 'use_fallback'; fallback: any }
  | { type: 'reduce_quality'; level: 'high' | 'medium' | 'low' }
  | { type: 'cache_response'; ttl: number }
  | { type: 'return_mock'; mock: any };

// 预设降级策略
const DEGRADATION_STRATEGIES: DegradationConfig[] = [
  // LLM服务降级
  {
    name: 'llm_service',
    priority: 1,
    conditions: {
      errorRateThreshold: 0.1,    // 10%错误率
      latencyThreshold: 30000,      // 30秒延迟
    },
    action: { type: 'reduce_quality', level: 'medium' },
    recovery: {
      minRequests: 10,
      errorRateBelow: 0.05,
      latencyBelow: 10000,
    },
  },

  // 通知服务降级
  {
    name: 'notifications',
    priority: 5,
    conditions: {
      errorCountThreshold: 5,
    },
    action: { type: 'disable_feature', feature: 'email_notifications' },
    recovery: {
      minRequests: 5,
      errorRateBelow: 0.01,
    },
  },

  // 分析服务降级
  {
    name: 'analytics',
    priority: 10,
    conditions: {
      errorRateThreshold: 0.2,
    },
    action: { type: 'cache_response', ttl: 300 },  // 使用缓存
    recovery: {
      minRequests: 10,
      errorRateBelow: 0.1,
    },
  },
];

// 降级管理器
class DegradationManager {
  private states: Map<string, 'normal' | 'degraded'> = new Map();
  private metrics: Map<string, ServiceMetrics> = new Map();

  // 记录指标
  recordMetric(service: string, metric: ServiceMetric): void {
    const current = this.metrics.get(service) || { errors: 0, requests: 0, latencies: [] };
    current.requests++;
    if (metric.error) current.errors++;
    if (metric.latency) current.latencies.push(metric.latency);

    // 只保留最近1000个延迟数据
    if (current.latencies.length > 1000) {
      current.latencies = current.latencies.slice(-1000);
    }

    this.metrics.set(service, current);

    // 检查是否需要降级
    this.checkDegradation(service);
  }

  // 检查降级条件
  private checkDegradation(service: string): void {
    const metric = this.metrics.get(service);
    if (!metric) return;

    const strategy = DEGRADATION_STRATEGIES.find(s => s.name === service);
    if (!strategy) return;

    const errorRate = metric.errors / metric.requests;
    const avgLatency = metric.latencies.reduce((a, b) => a + b, 0) / metric.latencies.length;

    // 检查降级条件
    const shouldDegrade =
      (strategy.conditions.errorRateThreshold && errorRate >= strategy.conditions.errorRateThreshold) ||
      (strategy.conditions.latencyThreshold && avgLatency >= strategy.conditions.latencyThreshold);

    if (shouldDegrade && this.states.get(service) !== 'degraded') {
      this.degrade(service, strategy);
    }

    // 检查恢复条件
    if (this.states.get(service) === 'degraded') {
      const shouldRecover =
        (!strategy.recovery.minRequests || metric.requests >= strategy.recovery.minRequests) &&
        (!strategy.recovery.errorRateBelow || errorRate < strategy.recovery.errorRateBelow) &&
        (!strategy.recovery.latencyBelow || avgLatency < strategy.recovery.latencyBelow);

      if (shouldRecover) {
        this.recover(service);
      }
    }
  }

  private degrade(service: string, strategy: DegradationConfig): void {
    this.states.set(service, 'degraded');
    console.warn(`Service ${service} degraded:`, strategy.action);
  }

  private recover(service: string): void {
    this.states.set(service, 'normal');
    this.metrics.get(service && { errors: 0, requests: 0, latencies: [] });
    console.log(`Service ${service} recovered`);
  }

  isDegraded(service: string): boolean {
    return this.states.get(service) === 'degraded';
  }
}
```

## 错误边界

### React错误边界

```typescript
// React错误边界组件
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // 记录错误
    console.error('ErrorBoundary caught:', error, errorInfo);

    // 上报错误
    this.props.onError?.(error, errorInfo);

    // 记录到错误追踪服务
    errorTracker.capture(error, {
      componentStack: errorInfo.componentStack,
      props: this.props,
    });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      // 渲染降级UI
      if (this.props.fallback) {
        return this.props.fallback(this.state.error);
      }

      return (
        <div className="error-boundary">
          <h1>Something went wrong</h1>
          <p>We're sorry for the inconvenience.</p>
          <button onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// 全局错误处理器
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);

  // 上报到错误追踪
  errorTracker.capture(event.reason, {
    type: 'unhandledrejection',
  });
});

window.addEventListener('error', (event) => {
  if (event.error) {
    errorTracker.capture(event.error, {
      type: 'window.error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  }
});
```

### 后端错误处理中间件

```typescript
// 错误处理中间件
function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 记录错误日志
  logger.error('Request error', {
    error: {
      message: err.message,
      stack: err.stack,
      type: err.constructor.name,
    },
    request: {
      method: req.method,
      path: req.path,
      body: req.body,
      params: req.params,
      query: req.query,
    },
    user: req.user?.id,
    requestId: req.headers['x-request-id'],
  });

  // 处理AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json(err.toResponse());
    return;
  }

  // 处理验证错误
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        type: ErrorType.VALIDATION_ERROR,
        message: 'Request validation failed',
        details: err.errors,
        requestId: getCurrentRequestId(),
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // 未知错误
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      type: ErrorType.INTERNAL_ERROR,
      message: isProduction ? 'Internal server error' : err.message,
      requestId: getCurrentRequestId(),
      timestamp: new Date().toISOString(),
      ...(isProduction ? {} : { stack: err.stack }),
    },
  });
}

// 404处理
function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      type: ErrorType.NOT_FOUND,
      message: `Route ${req.method} ${req.path} not found`,
      requestId: getCurrentRequestId(),
      timestamp: new Date().toISOString(),
    },
  });
}
```

## 配置示例

```yaml
# 错误处理与系统韧性配置
resilience:
  # 重试策略
  retry:
    default_strategy: "standard"
    strategies:
      fast:
        max_attempts: 3
        initial_delay: 100
        max_delay: 1000
        backoff: "exponential"
        jitter: true
      standard:
        max_attempts: 5
        initial_delay: 1000
        max_delay: 30000
        backoff: "exponential"
        jitter: true
      persistent:
        max_attempts: 10
        initial_delay: 5000
        max_delay: 60000
        backoff: "exponential"
        jitter: true

  # 超时配置
  timeout:
    default: 30000
    operations:
      database_query: 5000
      database_transaction: 30000
      http_request: 15000
      llm_inference: 60000
      generation: 300000

  # 熔断器配置
  circuit_breaker:
    enabled: true
    services:
      - name: "llm_service"
        failure_threshold: 5
        success_threshold: 3
        timeout: 60000
        half_open_requests: 2
      - name: "external_api"
        failure_threshold: 10
        success_threshold: 5
        timeout: 30000
        half_open_requests: 3

  # 降级策略
  degradation:
    enabled: true
    strategies:
      - name: "llm_service"
        priority: 1
        conditions:
          error_rate_threshold: 0.1
          latency_threshold: 30000
        action:
          type: "reduce_quality"
          level: "medium"
      - name: "notifications"
        priority: 5
        conditions:
          error_count_threshold: 5
        action:
          type: "disable_feature"
          feature: "email_notifications"

  # 错误报告
  error_reporting:
    enabled: true
    provider: "sentry"  # sentry | datadog | custom
    dsn: "${SENTRY_DSN}"
    environment: "${NODE_ENV}"
    sample_rate: 0.1  # 采样率

  # 日志配置
  logging:
    error_log_level: "error"
    include_stack_trace: true
    log_request_id: true
    log_user_context: true
```

---

**最后更新**: 2026-04-14
