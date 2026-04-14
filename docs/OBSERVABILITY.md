# 可观测性设计

## 1. 概述

本文档描述 ProjectFactory 系统的可观测性设计方案，包括日志、指标、追踪三大支柱，以及告警和可视化。

### 1.1 设计目标

| 目标 | 描述 |
|------|------|
| 全链路追踪 | 请求从入口到出口的完整追踪 |
| 统一日志 | 结构化日志，支持多级别、多维度查询 |
| 指标采集 | 业务指标、技术指标、LLM 调用指标 |
| 告警通知 | 多渠道告警，支持升级策略 |
| SLA 保障 | 99.9% 可用性目标 |

### 1.2 可观测性架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           可观测性架构                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  应用层                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                    │
│  │  日志 (Loki)  │  │  指标(Prometheus)│ │  追踪(Jaeger) │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                    │
│           ↓                ↓                ↓                             │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                    OTEL Collector                            │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                              ↓                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                    │
│  │    Loki      │  │  Prometheus  │  │   Jaeger     │                    │
│  │  (日志存储)   │  │  (指标存储)   │  │  (追踪存储)   │                    │
│  └──────────────┘  └──────────────┘  └──────────────┘                    │
│                              ↓                                              │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                    Grafana (可视化)                          │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 日志系统

### 2.1 日志架构

```typescript
// src/logging/types.ts
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

interface LogEntry {
  timestamp: string;           // ISO 8601 格式
  level: LogLevel;
  message: string;
  service: string;             // 服务名称
  version: string;             // 服务版本
  traceId?: string;            // 追踪 ID
  spanId?: string;             // Span ID
  userId?: string;             // 用户 ID
  tenantId?: string;           // 租户 ID
  requestId?: string;         // 请求 ID
  duration?: number;           // 请求耗时 (ms)
  statusCode?: number;         // HTTP 状态码
  method?: string;             // HTTP 方法
  path?: string;               // 请求路径
  userAgent?: string;          // 用户代理
  ip?: string;                 // 客户端 IP
  error?: {
    name: string;
    message: string;
    stack?: string;
    cause?: string;
  };
  metadata?: Record<string, unknown>;
  // Agent 特定字段
  agent?: {
    name: string;
    inputTokens: number;
    outputTokens: number;
    model: string;
    latency: number;
  };
  // 项目特定字段
  project?: {
    id: string;
    type: string;
    stage: string;
  };
}

// 日志采样策略
interface SamplingPolicy {
  type: 'deterministic' | 'rate' | 'priority';
  rate?: number;               // 采样率 (0-1)
  priorityThreshold?: LogLevel; // 只采样 >= 此级别的日志
}

// 采样配置
const DEFAULT_SAMPLING: SamplingPolicy = {
  type: 'deterministic',
  rate: 1.0,  // 生产环境可调整为 0.1
};
```

### 2.2 日志客户端

```typescript
// src/logging/client.ts
import { AsyncLocalStorage } from 'async_hooks';

const asyncLocalStorage = new AsyncLocalStorage<{
  traceId: string;
  spanId: string;
  requestId: string;
  userId?: string;
  tenantId?: string;
}>();

class Logger {
  private service: string;
  private version: string;
  private samplingPolicy: SamplingPolicy;
  private transports: Transport[];

  constructor(config: LoggerConfig) {
    this.service = config.service;
    this.version = config.version;
    this.samplingPolicy = config.sampling || DEFAULT_SAMPLING;
    this.transports = config.transports || [new ConsoleTransport()];
  }

  private shouldSample(entry: LogEntry): boolean {
    if (this.samplingPolicy.type === 'rate') {
      return Math.random() < (this.samplingPolicy.rate || 1);
    }
    if (this.samplingPolicy.type === 'priority') {
      return entry.level >= (this.samplingPolicy.priorityThreshold || LogLevel.INFO);
    }
    // deterministic - 基于 traceId 的一致性采样
    const traceNum = parseInt(entry.traceId || '0', 16);
    return (traceNum % 1000) / 1000 < (this.samplingPolicy.rate || 1);
  }

  private formatEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
    const context = asyncLocalStorage.getStore() || {};
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      version: this.version,
      traceId: context.traceId,
      spanId: context.spanId,
      requestId: context.requestId,
      userId: context.userId,
      tenantId: context.tenantId,
      ...meta,
    };
  }

  private async log(entry: LogEntry) {
    if (!this.shouldSample(entry)) return;

    for (const transport of this.transports) {
      await transport.write(entry);
    }
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.log(this.formatEntry(LogLevel.DEBUG, message, meta));
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.log(this.formatEntry(LogLevel.INFO, message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.log(this.formatEntry(LogLevel.WARN, message, meta));
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>) {
    this.log(this.formatEntry(LogLevel.ERROR, message, {
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: (error as any).cause?.message,
      } : undefined,
      ...meta,
    }));
  }

  fatal(message: string, error?: Error, meta?: Record<string, unknown>) {
    this.log(this.formatEntry(LogLevel.FATAL, message, {
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      ...meta,
    }));
  }

  // 创建子日志器
  child(meta: Record<string, unknown>): Logger {
    const childLogger = new Logger({
      service: this.service,
      version: this.version,
      sampling: this.samplingPolicy,
      transports: this.transports,
    });
    return {
      ...childLogger,
      log: (entry: LogEntry) => {
        this.log({ ...entry, ...meta });
      },
    } as Logger;
  }
}

// Console Transport (开发环境)
class ConsoleTransport implements Transport {
  async write(entry: LogEntry) {
    const color = this.getColor(entry.level);
    const prefix = `${color}[${entry.level}]${entry.timestamp} [${entry.service}]`;
    console.log(prefix, entry.message, {
      traceId: entry.traceId,
      requestId: entry.requestId,
      ...entry.metadata,
    });
  }

  private getColor(level: LogLevel): string {
    const colors = { [LogLevel.DEBUG]: '\x1b[36m', [LogLevel.INFO]: '\x1b[32m', [LogLevel.WARN]: '\x1b[33m', [LogLevel.ERROR]: '\x1b[31m', [LogLevel.FATAL]: '\x1b[35m' };
    return colors[level];
  }
}

// Loki Transport (生产环境)
class LokiTransport implements Transport {
  private lokiUrl: string;
  private batchSize: number;
  private flushInterval: number;
  private buffer: LogEntry[];

  constructor(lokiUrl: string) {
    this.lokiUrl = lokiUrl;
    this.batchSize = 100;
    this.flushInterval = 5000;
    this.buffer = [];
    setInterval(() => this.flush(), this.flushInterval);
  }

  async write(entry: LogEntry) {
    this.buffer.push(entry);
    if (this.buffer.length >= this.batchSize) {
      await this.flush();
    }
  }

  private async flush() {
    if (this.buffer.length === 0) return;
    const entries = [...this.buffer];
    this.buffer = [];

    await fetch(this.lokiUrl + '/loki/api/v1/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        streams: [{
          stream: { service: 'project-factory' },
          values: entries.map(e => [String(Date.now() * 1000000), JSON.stringify(e)]),
        }],
      }),
    });
  }
}
```

### 2.3 Express 中间件

```typescript
// src/logging/middleware.ts
import { Request, Response, NextFunction } from 'express';

export function loggingMiddleware(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();

    // 设置追踪上下文
    req.traceId = traceId;
    req.requestId = requestId;

    const start = Date.now();

    // 使用 AsyncLocalStorage 传播上下文
    asyncLocalStorage.run(
      {
        traceId,
        spanId: crypto.randomUUID(),
        requestId,
        userId: req.user?.id,
        tenantId: req.user?.tenantId,
      },
      () => {
        // 响应完成时记录日志
        res.on('finish', () => {
          logger.info(`${req.method} ${req.path}`, {
            duration: Date.now() - start,
            statusCode: res.statusCode,
            method: req.method,
            path: req.path,
            userAgent: req.headers['user-agent'],
            ip: req.ip,
          });
        });
        next();
      }
    );
  };
}

// Agent 日志中间件
export function agentLoggingMiddleware(logger: Logger) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const agentName = req.headers['x-agent-name'] as string;

    if (agentName) {
      logger.info(`Agent request: ${agentName}`, {
        agent: { name: agentName },
      });
    }

    next();
  };
}
```

---

## 3. 指标系统

### 3.1 指标定义

```typescript
// src/metrics/types.ts
enum MetricType {
  COUNTER = 'counter',         // 累计值 (只增不减)
  GAUGE = 'gauge',             // 瞬时值 (可增可减)
  HISTOGRAM = 'histogram',     // 直方图 (分布统计)
  SUMMARY = 'summary',         // 摘要 (分位数)
}

// 指标定义
interface MetricDefinition {
  name: string;
  type: MetricType;
  description: string;
  unit: string;
  labels: string[];
  buckets?: number[];          // HISTOGRAM 的桶边界
}

// 业务指标
const BUSINESS_METRICS = {
  projectsCreated: {
    name: 'pf_projects_created_total',
    type: MetricType.COUNTER,
    description: '创建的项目总数',
    unit: 'projects',
    labels: ['project_type', 'status'],
  },

  projectGenerationDuration: {
    name: 'pf_project_generation_duration_seconds',
    type: MetricType.HISTOGRAM,
    description: '项目生成耗时',
    unit: 'seconds',
    labels: ['project_type', 'stage'],
    buckets: [1, 5, 10, 30, 60, 120, 300, 600],
  },

  qualityScore: {
    name: 'pf_project_quality_score',
    type: MetricType.HISTOGRAM,
    description: '项目品质评分分布',
    unit: 'score',
    labels: ['project_type'],
    buckets: [0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  },

  activeProjects: {
    name: 'pf_active_projects',
    type: MetricType.GAUGE,
    description: '当前活跃项目数',
    unit: 'projects',
    labels: ['stage'],
  },
};

// LLM 指标
const LLM_METRICS = {
  llmRequestsTotal: {
    name: 'pf_llm_requests_total',
    type: MetricType.COUNTER,
    description: 'LLM 请求总数',
    unit: 'requests',
    labels: ['model', 'status', 'agent'],
  },

  llmRequestDuration: {
    name: 'pf_llm_request_duration_seconds',
    type: MetricType.HISTOGRAM,
    description: 'LLM 请求耗时',
    unit: 'seconds',
    labels: ['model', 'agent'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  },

  llmTokensUsed: {
    name: 'pf_llm_tokens_used_total',
    type: MetricType.COUNTER,
    description: '使用的 token 总数',
    unit: 'tokens',
    labels: ['model', 'type'],  // type: input/output
  },

  llmErrorsTotal: {
    name: 'pf_llm_errors_total',
    type: MetricType.COUNTER,
    description: 'LLM 错误总数',
    unit: 'errors',
    labels: ['model', 'error_type'],
  },

  llmRateLimitHits: {
    name: 'pf_llm_rate_limit_hits_total',
    type: MetricType.COUNTER,
    description: 'LLM 限流次数',
    unit: 'hits',
    labels: ['model'],
  },
};

// 系统指标
const SYSTEM_METRICS = {
  httpRequestsTotal: {
    name: 'pf_http_requests_total',
    type: MetricType.COUNTER,
    description: 'HTTP 请求总数',
    unit: 'requests',
    labels: ['method', 'path', 'status'],
  },

  httpRequestDuration: {
    name: 'pf_http_request_duration_seconds',
    type: MetricType.HISTOGRAM,
    description: 'HTTP 请求耗时',
    unit: 'seconds',
    labels: ['method', 'path'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  },

  dbQueryDuration: {
    name: 'pf_db_query_duration_seconds',
    type: MetricType.HISTOGRAM,
    description: '数据库查询耗时',
    unit: 'seconds',
    labels: ['operation', 'table'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
  },

  cacheHitRatio: {
    name: 'pf_cache_hit_ratio',
    type: MetricType.GAUGE,
    description: '缓存命中率',
    unit: 'ratio',
    labels: ['cache_level', 'cache_type'],
  },

  workerPoolUtilization: {
    name: 'pf_worker_pool_utilization',
    type: MetricType.GAUGE,
    description: ' Worker 池利用率',
    unit: 'ratio',
    labels: ['pool_name'],
  },
};
```

### 3.2 指标收集器

```typescript
// src/metrics/collector.ts
import { client as promClient, Counter, Gauge, Histogram, Registry } from 'prom-client';

class MetricsCollector {
  private registry: Registry;
  private counters: Map<string, Counter>;
  private gauges: Map<string, Gauge>;
  private histograms: Map<string, Histogram>;

  constructor() {
    this.registry = new promClient.Registry();
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
  }

  // 创建指标
  createCounter(name: string, config: MetricDefinition) {
    const counter = new promClient.Counter({
      name: config.name,
      help: config.description,
      labelNames: config.labels,
      registers: [this.registry],
    });
    this.counters.set(name, counter);
    return counter;
  }

  createGauge(name: string, config: MetricDefinition) {
    const gauge = new promClient.Gauge({
      name: config.name,
      help: config.description,
      labelNames: config.labels,
      registers: [this.registry],
    });
    this.gauges.set(name, gauge);
    return gauge;
  }

  createHistogram(name: string, config: MetricDefinition) {
    const histogram = new promClient.Histogram({
      name: config.name,
      help: config.description,
      labelNames: config.labels,
      buckets: config.buckets,
      registers: [this.registry],
    });
    this.histograms.set(name, histogram);
    return histogram;
  }

  // 记录指标
  incCounter(name: string, labels?: Record<string, string>) {
    const counter = this.counters.get(name);
    if (counter) {
      counter.inc(labels || {});
    }
  }

  setGauge(name: string, value: number, labels?: Record<string, string>) {
    const gauge = this.gauges.get(name);
    if (gauge) {
      gauge.set(labels || {}, value);
    }
  }

  observeHistogram(name: string, value: number, labels?: Record<string, string>) {
    const histogram = this.histograms.get(name);
    if (histogram) {
      histogram.observe(labels || {}, value);
    }
  }

  // 获取所有指标
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  // 获取内容类型
  getContentType(): string {
    return this.registry.contentType;
  }
}

// 全局收集器
const metricsCollector = new MetricsCollector();

// 初始化所有指标
function initMetrics() {
  // 业务指标
  metricsCollector.createCounter('projects_created', BUSINESS_METRICS.projectsCreated);
  metricsCollector.createHistogram('project_generation_duration', BUSINESS_METRICS.projectGenerationDuration);
  metricsCollector.createHistogram('quality_score', BUSINESS_METRICS.qualityScore);
  metricsCollector.createGauge('active_projects', BUSINESS_METRICS.activeProjects);

  // LLM 指标
  metricsCollector.createCounter('llm_requests_total', LLM_METRICS.llmRequestsTotal);
  metricsCollector.createHistogram('llm_request_duration', LLM_METRICS.llmRequestDuration);
  metricsCollector.createCounter('llm_tokens_used', LLM_METRICS.llmTokensUsed);
  metricsCollector.createCounter('llm_errors_total', LLM_METRICS.llmErrorsTotal);
  metricsCollector.createCounter('llm_rate_limit_hits', LLM_METRICS.llmRateLimitHits);

  // 系统指标
  metricsCollector.createCounter('http_requests_total', SYSTEM_METRICS.httpRequestsTotal);
  metricsCollector.createHistogram('http_request_duration', SYSTEM_METRICS.httpRequestDuration);
  metricsCollector.createHistogram('db_query_duration', SYSTEM_METRICS.dbQueryDuration);
  metricsCollector.createGauge('cache_hit_ratio', SYSTEM_METRICS.cacheHitRatio);
  metricsCollector.createGauge('worker_pool_utilization', SYSTEM_METRICS.workerPoolUtilization);
}

export { metricsCollector, initMetrics };
```

### 3.3 中间件集成

```typescript
// src/metrics/middleware.ts
import { Request, Response, NextFunction } from 'express';

const activeRequests = new Map<string, number>();

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  const path = normalizePath(req.path); // 去除动态参数

  // 增加活跃请求数
  const current = activeRequests.get(path) || 0;
  activeRequests.set(path, current + 1);

  res.on('finish', () => {
    // 减少活跃请求数
    const count = activeRequests.get(path) || 1;
    activeRequests.set(path, Math.max(0, count - 1));

    // 计算耗时
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1e9;

    // 记录 HTTP 指标
    metricsCollector.incCounter('http_requests_total', {
      method: req.method,
      path,
      status: String(res.statusCode),
    });

    metricsCollector.observeHistogram('http_request_duration', duration, {
      method: req.method,
      path,
    });
  });

  next();
}

// 路径归一化 (去除 ID 等动态部分)
function normalizePath(path: string): string {
  return path
    .replace(/\/[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
}

// LLM 调用中间件
export function llmMetricsMiddleware(agent: string, model: string) {
  return async (originalFn: Function, ...args: any[]) => {
    const start = Date.now();

    try {
      const result = await originalFn(...args);

      // 成功指标
      metricsCollector.incCounter('llm_requests_total', {
        model,
        agent,
        status: 'success',
      });

      const duration = (Date.now() - start) / 1000;
      metricsCollector.observeHistogram('llm_request_duration', duration, {
        model,
        agent,
      });

      // Token 使用
      if (result.usage) {
        metricsCollector.incCounter('llm_tokens_used', {
          model,
          type: 'input',
        }, result.usage.inputTokens);
        metricsCollector.incCounter('llm_tokens_used', {
          model,
          type: 'output',
        }, result.usage.outputTokens);
      }

      return result;
    } catch (error) {
      // 错误指标
      metricsCollector.incCounter('llm_requests_total', {
        model,
        agent,
        status: 'error',
      });

      metricsCollector.incCounter('llm_errors_total', {
        model,
        error_type: error.name || 'UnknownError',
      });

      throw error;
    }
  };
}
```

---

## 4. 分布式追踪

### 4.1 追踪架构

```typescript
// src/tracing/types.ts
interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  samplingPriority?: number;
  baggage?: Record<string, string>;
}

interface Span {
  name: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, string | number | boolean>;
  logs: SpanLog[];
  status: SpanStatus;
  service: string;
  operation: string;
}

interface SpanLog {
  timestamp: number;
  fields: Record<string, unknown>;
}

enum SpanStatus {
  OK = 0,
  ERROR = 1,
}

// 追踪采样策略
interface TracingSamplingPolicy {
  type: 'always' | 'never' | 'probabilistic' | 'rate-limiting';
  rate?: number;
  minTracesPerSecond?: number;
}

const DEFAULT_TRACING_SAMPLING: TracingSamplingPolicy = {
  type: 'probabilistic',
  rate: 0.1, // 采样 10%
};
```

### 4.2 追踪客户端

```typescript
// src/tracing/client.ts
import { AsyncLocalStorage } from 'async_hooks';

const asyncLocalStorage = new AsyncLocalStorage<TraceContext>();

class TracingClient {
  private serviceName: string;
  private exporter: SpanExporter;
  private sampler: Sampler;

  constructor(config: TracingConfig) {
    this.serviceName = config.serviceName;
    this.exporter = config.exporter || new JaegerExporter(config.jaegerEndpoint);
    this.sampler = new Sampler(config.sampling || DEFAULT_TRACING_SAMPLING);
  }

  // 创建根 Span
  startSpan(name: string, options?: StartSpanOptions): Span {
    const context = asyncLocalStorage.getStore();
    const traceId = context?.traceId || crypto.randomUUID();
    const spanId = crypto.randomUUID();

    const span: Span = {
      name,
      traceId,
      spanId,
      parentSpanId: context?.spanId,
      startTime: Date.now(),
      tags: {},
      logs: [],
      status: SpanStatus.OK,
      service: this.serviceName,
      operation: name,
    };

    // 存储当前 span 上下文
    asyncLocalStorage.run({ ...context, spanId, traceId }, () => {
      // span logic
    });

    return span;
  }

  // 结束 Span
  async endSpan(span: Span, error?: Error) {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;

    if (error) {
      span.status = SpanStatus.ERROR;
      span.tags['error'] = true;
      span.tags['error.message'] = error.message;
      span.tags['error.type'] = error.name;
      span.logs.push({
        timestamp: Date.now(),
        fields: { event: 'error', message: error.message, stack: error.stack },
      });
    }

    await this.exporter.export(span);
  }

  // 添加标签
  setTag(span: Span, key: string, value: string | number | boolean) {
    span.tags[key] = value;
  }

  // 添加日志
  log(span: Span, fields: Record<string, unknown>) {
    span.logs.push({ timestamp: Date.now(), fields });
  }

  // 获取当前上下文
  getCurrentContext(): TraceContext | undefined {
    return asyncLocalStorage.getStore();
  }

  // 创建子追踪
  withSpan<T>(name: string, fn: (span: Span) => T, options?: StartSpanOptions): T {
    const span = this.startSpan(name, options);
    try {
      const result = fn(span);
      this.endSpan(span);
      return result;
    } catch (error) {
      this.endSpan(span, error as Error);
      throw error;
    }
  }

  async withSpanAsync<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    options?: StartSpanOptions
  ): Promise<T> {
    const span = this.startSpan(name, options);
    try {
      const result = await fn(span);
      this.endSpan(span);
      return result;
    } catch (error) {
      this.endSpan(span, error as Error);
      throw error;
    }
  }
}

// Jaeger Exporter
class JaegerExporter implements SpanExporter {
  constructor(private endpoint: string) {}

  async export(span: Span) {
    const jaegerSpan = {
      traceID: span.traceId,
      spanID: span.spanId,
      parentSpanID: span.parentSpanId || '0',
      operationName: span.name,
      startTime: span.startTime * 1000, // Jaeger 使用微秒
      duration: (span.duration || 0) * 1000,
      tags: Object.entries(span.tags).map(([key, value]) => ({ key, vType: typeof value, v: value })),
      logs: span.logs.map((log) => ({
        timestamp: log.timestamp * 1000,
        fields: Object.entries(log.fields).map(([key, value]) => ({ key, vType: typeof value, v: String(value) })),
      })),
    };

    await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-thrift' },
      body: JSON.stringify(jaegerSpan),
    });
  }
}
```

### 4.3 Agent 追踪

```typescript
// src/tracing/agent.ts
// 为 Agent 添加分布式追踪支持

interface AgentSpanContext {
  agentName: string;
  agentType: 'idea-generator' | 'architect' | 'coder' | 'tester' | 'reviewer';
  iteration: number;
  input: unknown;
  output?: unknown;
  tokensUsed?: { input: number; output: number };
}

// 追踪 Agent 执行
export function traceAgentExecution<T>(
  tracing: TracingClient,
  agentName: string,
  agentType: string
) {
  return function <T>(target: Function, context: ClassMethodDecoratorContext) {
    return async function (this: any, ...args: any[]) {
      const span = tracing.startSpan(`agent.${agentType}.${agentName}`, {
        attributes: {
          'agent.name': agentName,
          'agent.type': agentType,
        },
      });

      try {
        tracing.setTag(span, 'agent.input', JSON.stringify(args).slice(0, 1000));

        const result = await target.apply(this, args);

        tracing.setTag(span, 'agent.output', JSON.stringify(result).slice(0, 1000));
        tracing.setTag(span, 'agent.status', 'success');

        return result;
      } catch (error) {
        tracing.setTag(span, 'agent.status', 'error');
        tracing.log(span, { error: (error as Error).message });
        throw error;
      } finally {
        tracing.endSpan(span);
      }
    };
  };
}

// LangGraph 节点追踪
export function traceLangGraphNode(
  tracing: TracingClient,
  nodeName: string,
  config?: { includeInput?: boolean; includeOutput?: boolean }
) {
  return async (state: any, parentSpan?: Span): Promise<any> => {
    const span = tracing.startSpan(`langgraph.node.${nodeName}`, {
      parent: parentSpan,
      attributes: {
        'langgraph.node': nodeName,
        'langgraph.step': state.iterationCount || 0,
      },
    });

    try {
      if (config?.includeInput) {
        tracing.setTag(span, 'langgraph.input', JSON.stringify(state).slice(0, 1000));
      }

      const result = await executeNode(nodeName, state);

      if (config?.includeOutput) {
        tracing.setTag(span, 'langgraph.output', JSON.stringify(result).slice(0, 1000));
      }

      tracing.endSpan(span);
      return result;
    } catch (error) {
      tracing.endSpan(span, error as Error);
      throw error;
    }
  };
}
```

---

## 5. 告警系统

### 5.1 告警定义

```typescript
// src/alerts/types.ts
interface Alert {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  conditions: AlertCondition[];
  actions: AlertAction[];
  annotations?: Record<string, string>;
  labels: Record<string, string>;
  createdAt: number;
  updatedAt: number;
  lastTriggeredAt?: number;
  triggerCount: number;
}

enum AlertSeverity {
  CRITICAL = 'critical',   // P1 - 立即处理
  HIGH = 'high',           // P2 - 15 分钟内
  MEDIUM = 'medium',       // P3 - 1 小时内
  LOW = 'low',             // P4 - 工作时间处理
  INFO = 'info',           // 信息
}

enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
}

interface AlertCondition {
  type: 'threshold' | 'absence' | 'change' | 'error_rate';
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number;
  duration: number;        // 持续时间 (秒)
  severity?: AlertSeverity;
}

interface AlertAction {
  type: 'notification' | 'webhook' | 'runbook' | 'auto-scale';
  config: {
    channel?: string;
    url?: string;
    runbookUrl?: string;
    scalingAction?: {
      minReplicas: number;
      maxReplicas: number;
      targetCPUPercent?: number;
    };
  };
}
```

### 5.2 预定义告警

```typescript
// src/alerts/definitions.ts
const ALERT_DEFINITIONS: Alert[] = [
  // LLM 相关告警
  {
    id: 'llm-high-latency',
    name: 'LLM 高延迟',
    description: 'LLM 请求延迟超过 30 秒',
    severity: AlertSeverity.HIGH,
    status: AlertStatus.ACTIVE,
    conditions: [{
      type: 'threshold',
      metric: 'pf_llm_request_duration_seconds',
      operator: '>',
      value: 30,
      duration: 300, // 5 分钟
    }],
    actions: [{
      type: 'notification',
      config: { channel: '#alerts-llm' },
    }],
    labels: { team: 'platform', service: 'llm' },
  },

  {
    id: 'llm-error-rate',
    name: 'LLM 错误率过高',
    description: 'LLM 请求错误率超过 5%',
    severity: AlertSeverity.CRITICAL,
    status: AlertStatus.ACTIVE,
    conditions: [{
      type: 'threshold',
      metric: 'pf_llm_errors_total / pf_llm_requests_total',
      operator: '>',
      value: 0.05,
      duration: 300,
    }],
    actions: [{
      type: 'notification',
      config: { channel: '#alerts-critical' },
    }, {
      type: 'webhook',
      config: { url: '/api/incidents/create' },
    }],
    labels: { team: 'platform', service: 'llm' },
  },

  {
    id: 'llm-rate-limit',
    name: 'LLM 限流频繁',
    description: 'LLM 限流发生频率过高',
    severity: AlertSeverity.MEDIUM,
    status: AlertStatus.ACTIVE,
    conditions: [{
      type: 'threshold',
      metric: 'pf_llm_rate_limit_hits_total',
      operator: '>',
      value: 10,
      duration: 600,
    }],
    actions: [{
      type: 'notification',
      config: { channel: '#alerts-llm' },
    }],
    labels: { team: 'platform', service: 'llm' },
  },

  // 项目生成告警
  {
    id: 'project-failure-rate',
    name: '项目失败率过高',
    description: '项目生成失败率超过 20%',
    severity: AlertSeverity.HIGH,
    status: AlertStatus.ACTIVE,
    conditions: [{
      type: 'threshold',
      metric: 'rate(pf_projects_created_total{status="failed"}[5m]) / rate(pf_projects_created_total[5m])',
      operator: '>',
      value: 0.2,
      duration: 1800,
    }],
    actions: [{
      type: 'notification',
      config: { channel: '#alerts-product' },
    }, {
      type: 'runbook',
      config: { runbookUrl: '/runbooks/project-failures' },
    }],
    labels: { team: 'product', service: 'generator' },
  },

  {
    id: 'project-quality-low',
    name: '项目质量下降',
    description: '最近项目的平均质量评分低于 60',
    severity: AlertSeverity.MEDIUM,
    status: AlertStatus.ACTIVE,
    conditions: [{
      type: 'threshold',
      metric: 'avg(pf_project_quality_score)',
      operator: '<',
      value: 60,
      duration: 3600,
    }],
    actions: [{
      type: 'notification',
      config: { channel: '#alerts-product' },
    }],
    labels: { team: 'product', service: 'generator' },
  },

  // 系统告警
  {
    id: 'high-error-rate',
    name: 'HTTP 错误率过高',
    description: 'HTTP 5xx 错误率超过 1%',
    severity: AlertSeverity.CRITICAL,
    status: AlertStatus.ACTIVE,
    conditions: [{
      type: 'threshold',
      metric: 'rate(pf_http_requests_total{status=~"5.."}[5m]) / rate(pf_http_requests_total[5m])',
      operator: '>',
      value: 0.01,
      duration: 300,
    }],
    actions: [{
      type: 'notification',
      config: { channel: '#alerts-critical' },
    }, {
      type: 'webhook',
      config: { url: '/api/incidents/create' },
    }],
    labels: { team: 'platform', service: 'api' },
  },

  {
    id: 'api-latency-high',
    name: 'API 延迟过高',
    description: 'API P99 延迟超过 2 秒',
    severity: AlertSeverity.HIGH,
    status: AlertStatus.ACTIVE,
    conditions: [{
      type: 'threshold',
      metric: 'histogram_quantile(0.99, pf_http_request_duration_seconds)',
      operator: '>',
      value: 2,
      duration: 600,
    }],
    actions: [{
      type: 'notification',
      config: { channel: '#alerts-platform' },
    }],
    labels: { team: 'platform', service: 'api' },
  },

  {
    id: 'cache-hit-rate-low',
    name: '缓存命中率低',
    description: 'L2 缓存命中率低于 70%',
    severity: AlertSeverity.MEDIUM,
    status: AlertStatus.ACTIVE,
    conditions: [{
      type: 'threshold',
      metric: 'pf_cache_hit_ratio{cache_level="L2"}',
      operator: '<',
      value: 0.7,
      duration: 1800,
    }],
    actions: [{
      type: 'notification',
      config: { channel: '#alerts-platform' },
    }],
    labels: { team: 'platform', service: 'cache' },
  },
];
```

### 5.3 告警管理器

```typescript
// src/alerts/manager.ts
class AlertManager {
  private alerts: Map<string, Alert>;
  private evaluator: AlertEvaluator;
  private notifier: AlertNotifier;

  constructor() {
    this.alerts = new Map();
    this.evaluator = new AlertEvaluator();
    this.notifier = new AlertNotifier();
  }

  // 加载告警定义
  loadAlerts(definitions: Alert[]) {
    for (const def of definitions) {
      this.alerts.set(def.id, def);
    }
  }

  // 评估告警条件
  async evaluateAlerts(metrics: MetricsSnapshot): Promise<Alert[]> {
    const triggered: Alert[] = [];

    for (const alert of this.alerts.values()) {
      if (alert.status !== AlertStatus.ACTIVE) continue;

      const isTriggered = await this.evaluator.evaluate(alert, metrics);

      if (isTriggered && !alert.lastTriggeredAt) {
        // 新触发的告警
        alert.lastTriggeredAt = Date.now();
        alert.triggerCount++;
        await this.notifier.notify(alert);
      } else if (!isTriggered && alert.lastTriggeredAt) {
        // 告警恢复
        alert.status = AlertStatus.RESOLVED;
        await this.notifier.notifyRecovery(alert);
      }

      triggered.push(alert);
    }

    return triggered.filter(a => a.lastTriggeredAt);
  }

  // 确认告警
  async acknowledgeAlert(alertId: string, userId: string) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.status = AlertStatus.ACKNOWLEDGED;
      alert.annotations = {
        ...alert.annotations,
        acknowledgedBy: userId,
        acknowledgedAt: String(Date.now()),
      };
    }
  }

  // 获取活跃告警
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(
      a => a.status === AlertStatus.ACTIVE || a.status === AlertStatus.ACKNOWLEDGED
    );
  }

  // 获取告警统计
  getAlertStats(): AlertStats {
    const active = this.getActiveAlerts();
    return {
      total: this.alerts.size,
      active: active.length,
      bySeverity: {
        critical: active.filter(a => a.severity === AlertSeverity.CRITICAL).length,
        high: active.filter(a => a.severity === AlertSeverity.HIGH).length,
        medium: active.filter(a => a.severity === AlertSeverity.MEDIUM).length,
        low: active.filter(a => a.severity === AlertSeverity.LOW).length,
      },
    };
  }
}

// 告警评估器
class AlertEvaluator {
  async evaluate(alert: Alert, metrics: MetricsSnapshot): Promise<boolean> {
    for (const condition of alert.conditions) {
      const metricValue = await metrics.getValue(condition.metric);
      if (!this.checkCondition(condition, metricValue)) {
        return false;
      }
    }
    return true;
  }

  private checkCondition(condition: AlertCondition, value: number): boolean {
    switch (condition.operator) {
      case '>': return value > condition.value;
      case '<': return value < condition.value;
      case '>=': return value >= condition.value;
      case '<=': return value <= condition.value;
      case '==': return value === condition.value;
      case '!=': return value !== condition.value;
      default: return false;
    }
  }
}

// 告警通知器
class AlertNotifier {
  async notify(alert: Alert) {
    for (const action of alert.actions) {
      switch (action.type) {
        case 'notification':
          await this.sendNotification(alert, action.config);
          break;
        case 'webhook':
          await this.callWebhook(alert, action.config.url!);
          break;
        case 'runbook':
          // 附带 runbook 链接
          break;
        case 'auto-scale':
          await this.performScaling(alert, action.config.scalingAction!);
          break;
      }
    }
  }

  private async sendNotification(alert: Alert, config: { channel: string }) {
    const message = this.formatAlertMessage(alert);
    await slackClient.send(config.channel, message);
  }

  private formatAlertMessage(alert: Alert): string {
    return {
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `🚨 ${alert.name}` },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Severity:*\n${alert.severity}` },
            { type: 'mrkdwn', text: `*Status:*\n${alert.status}` },
            { type: 'mrkdwn', text: `*Triggered:*\n${new Date(alert.lastTriggeredAt!).toISOString()}` },
          ],
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: alert.description },
        },
      ],
    };
  }
}
```

---

## 6. Grafana Dashboard

### 6.1 Dashboard 配置

```json
// grafana/dashboards/project-factory.json
{
  "dashboard": {
    "title": "ProjectFactory Overview",
    "tags": ["project-factory", "overview"],
    "timezone": "browser",
    "panels": [
      {
        "title": "Active Projects",
        "type": "stat",
        "gridPos": { "x": 0, "y": 0, "w": 6, "h": 4 },
        "targets": [{
          "expr": "sum(pf_active_projects)",
          "legendFormat": "Active"
        }]
      },
      {
        "title": "Projects Created (24h)",
        "type": "stat",
        "gridPos": { "x": 6, "y": 0, "w": 6, "h": 4 },
        "targets": [{
          "expr": "increase(pf_projects_created_total[24h])",
          "legendFormat": "Created"
        }]
      },
      {
        "title": "Average Quality Score",
        "type": "gauge",
        "gridPos": { "x": 12, "y": 0, "w": 6, "h": 4 },
        "targets": [{
          "expr": "avg(pf_project_quality_score)",
          "legendFormat": "Avg Score"
        }],
        "fieldConfig": {
          "defaults": {
            "min": 0,
            "max": 100,
            "thresholds": {
              "steps": [
                { "value": 0, "color": "red" },
                { "value": 60, "color": "yellow" },
                { "value": 80, "color": "green" }
              ]
            }
          }
        }
      },
      {
        "title": "LLM Request Latency (P50/P95/P99)",
        "type": "graph",
        "gridPos": { "x": 0, "y": 4, "w": 12, "h": 8 },
        "targets": [
          { "expr": "histogram_quantile(0.50, rate(pf_llm_request_duration_seconds_bucket[5m]))", "legendFormat": "P50" },
          { "expr": "histogram_quantile(0.95, rate(pf_llm_request_duration_seconds_bucket[5m]))", "legendFormat": "P95" },
          { "expr": "histogram_quantile(0.99, rate(pf_llm_request_duration_seconds_bucket[5m]))", "legendFormat": "P99" }
        ]
      },
      {
        "title": "Token Usage (24h)",
        "type": "graph",
        "gridPos": { "x": 12, "y": 4, "w": 12, "h": 8 },
        "targets": [
          { "expr": "increase(pf_llm_tokens_used_total{type=\"input\"}[24h])", "legendFormat": "Input" },
          { "expr": "increase(pf_llm_tokens_used_total{type=\"output\"}[24h])", "legendFormat": "Output" }
        ],
        "stack": true
      },
      {
        "title": "Project Generation Pipeline",
        "type": "graph",
        "gridPos": { "x": 0, "y": 12, "w": 24, "h": 8 },
        "targets": [
          { "expr": "sum by (stage) (pf_active_projects)", "legendFormat": "{{stage}}" }
        ],
        "options": {
          "stack": true
        }
      }
    ]
  }
}
```

---

## 7. SLA/SLO 监控

### 7.1 SLO 定义

```typescript
// src/monitoring/slo.ts
interface SLI {
  name: string;
  description: string;
  query: string;
  target: number;
  window: string;  // 30d
}

const SERVICE_LEVEL_INDICATORS: SLI[] = [
  {
    name: 'availability',
    description: '系统可用性',
    query: '1 - (sum(rate(pf_http_requests_total{status=~"5.."}[5m])) / sum(rate(pf_http_requests_total[5m])))',
    target: 0.999,  // 99.9%
    window: '30d',
  },
  {
    name: 'latency_p95',
    description: 'API P95 延迟',
    query: 'histogram_quantile(0.95, rate(pf_http_request_duration_seconds_bucket[5m]))',
    target: 2.0,  // 2 秒
    window: '30d',
  },
  {
    name: 'llm_latency_p99',
    description: 'LLM P99 延迟',
    query: 'histogram_quantile(0.99, rate(pf_llm_request_duration_seconds_bucket[5m]))',
    target: 60.0,  // 60 秒
    window: '30d',
  },
  {
    name: 'error_rate',
    description: '错误率',
    query: 'sum(rate(pf_llm_errors_total[5m])) / sum(rate(pf_llm_requests_total[5m]))',
    target: 0.01,  // 1%
    window: '30d',
  },
  {
    name: 'project_success_rate',
    description: '项目成功率',
    query: 'increase(pf_projects_created_total{status="completed"}[24h]) / increase(pf_projects_created_total[24h])',
    target: 0.95,  // 95%
    window: '30d',
  },
];

// SLO 错误预算
interface ErrorBudget {
  sli: SLI;
  totalBudget: number;   // 总预算 (时间百分比)
  spentBudget: number;    // 已消耗
  remainingBudget: number;
  projectedExhaustion: Date | null;
}

function calculateErrorBudget(sli: SLI, actualValue: number): ErrorBudget {
  const totalBudget = 1 - sli.target;  // 对于可用性，目标 99.9%，则预算 0.1%
  const spentBudget = actualValue > sli.target
    ? (actualValue - sli.target) / (1 - sli.target)  // 相对于预算的消耗
    : 0;

  const remainingBudget = totalBudget - spentBudget;
  const daysInMonth = 30;
  const burnRate = spentBudget / daysInMonth;

  return {
    sli,
    totalBudget: totalBudget * 100,
    spentBudget: spentBudget * 100,
    remainingBudget: remainingBudget * 100,
    projectedExhaustion: burnRate > 0
      ? new Date(Date.now() + (remainingBudget / burnRate) * 24 * 60 * 60 * 1000)
      : null,
  };
}
```

---

## 8. 相关文档

- [前端设计](./FRONTEND_DESIGN.md)
- [后端设计](./BACKEND_DESIGN.md)
- [部署架构](./DEPLOYMENT_ARCHITECTURE.md)
- [性能优化](./PERFORMANCE_OPTIMIZATION.md)

---

**最后更新**: 2026-04-14
