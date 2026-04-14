# 监控与可观测性架构

## 概述

监控与可观测性（Observability）是确保ProjectFactory系统稳定运行的关键基础设施。可观测性不仅是传统监控的升级，更强调对系统内部状态的深入理解，包括指标（Metrics）、日志（Logs）、追踪（Traces）三大支柱，以及在此基础上的告警、分析和可视化能力。

## 核心价值

- **全面可见**：覆盖基础设施、应用、业务各层的监控能力
- **根因分析**：快速定位和诊断问题
- **主动预警**：在问题影响用户前发现和预警
- **性能优化**：基于数据的性能分析和优化建议
- **SLA保障**：确保服务等级协议达成

## 可观测性架构

### 三支柱模型

```
┌─────────────────────────────────────────────────────────────────┐
│                      可观测性平台                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│   │   Metrics   │  │    Logs    │  │   Traces    │            │
│   │   指标      │  │   日志      │  │   追踪      │            │
│   └─────────────┘  └─────────────┘  └─────────────┘            │
│          │                │                │                     │
│          └────────────────┼────────────────┘                     │
│                           ▼                                      │
│                   ┌─────────────┐                               │
│                   │  Correlation │  关联分析                    │
│                   │    关联      │                               │
│                   └─────────────┘                               │
│                           │                                      │
│                           ▼                                      │
│                   ┌─────────────┐                               │
│                   │  Dashboard  │  可视化                        │
│                   │   仪表盘     │                               │
│                   └─────────────┘                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 数据流架构

```typescript
// 可观测性数据流
const OBSERVABILITY_FLOW = {
  // 数据采集层
  collection: {
    // 应用层
    instrumentation: {
      language: 'auto',  // TypeScript/Python auto-instrumentation
      frameworks: ['express', 'fastify', 'next.js', 'react'],
      libraries: ['langchain', 'drizzle', 'sqlite'],
    },

    // 基础设施层
    infrastructure: {
      system: ['cpu', 'memory', 'disk', 'network'],
      container: ['docker stats', 'containerd'],
      kubernetes: ['kubelet', 'kube-apiserver'],
    },

    // 网络层
    network: {
      proxy: ['nginx', 'envoy'],
      gateway: ['api-gateway'],
    },
  },

  // 数据处理层
  processing: {
    // 指标处理
    metrics: {
      aggregation: '1m,5m,15m,1h,1d',
      retention: '30d',
      downsampling: true,
    },

    // 日志处理
    logs: {
      parsing: 'json,regex,grok',
      enrichment: ['geoip', 'user-agent', 'trace-context'],
      retention: '90d',
    },

    // 追踪处理
    traces: {
      sampling: {
        head: 0.1,      // 头部采样10%
        tail: 1.0,      // 尾部采样100%（错误或慢请求）
      },
      retention: '7d',
    },
  },

  // 存储层
  storage: {
    metrics: 'prometheus',      // 或 VictoriaMetrics, Thanos
    logs: 'loki',              // 或 Elasticsearch
    traces: 'tempo',           // 或 Jaeger
  },

  // 可视化和告警
  visualization: 'grafana',
  alerting: 'alertmanager',
};
```

## 指标体系

### 指标类型

```typescript
// 指标类型枚举
enum MetricType {
  // 计数器 - 只增不减
  COUNTER = 'counter',

  // 仪表盘 - 当前值
  GAUGE = 'gauge',

  // 直方图 - 分布统计
  HISTOGRAM = 'histogram',

  // 摘要 - 分位数
  SUMMARY = 'summary',
}

// 预设指标定义
const METRIC_DEFINITIONS = {
  // 业务指标
  business: {
    projects_created_total: {
      type: MetricType.COUNTER,
      description: '创建的项目总数',
      labels: ['project_type', 'tenant_id'],
    },
    generations_started_total: {
      type: MetricType.COUNTER,
      description: '启动的生成任务总数',
      labels: ['priority', 'tenant_id'],
    },
    generations_completed_total: {
      type: MetricType.COUNTER,
      description: '完成的生成任务总数',
      labels: ['status', 'duration_bucket'],
    },
    generation_duration_seconds: {
      type: MetricType.HISTOGRAM,
      description: '生成任务耗时',
      buckets: [1, 5, 10, 30, 60, 120, 300, 600],
      labels: ['stage', 'project_type'],
    },
    active_generations: {
      type: MetricType.GAUGE,
      description: '当前活跃的生成任务数',
      labels: ['stage'],
    },
  },

  // 技术指标
  technical: {
    http_requests_total: {
      type: MetricType.COUNTER,
      description: 'HTTP请求总数',
      labels: ['method', 'path', 'status_code'],
    },
    http_request_duration_seconds: {
      type: MetricType.HISTOGRAM,
      description: 'HTTP请求延迟',
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
      labels: ['method', 'path'],
    },
    api_errors_total: {
      type: MetricType.COUNTER,
      description: 'API错误总数',
      labels: ['error_type', 'endpoint'],
    },
    database_connections: {
      type: MetricType.GAUGE,
      description: '数据库连接数',
      labels: ['state', 'database'],
    },
    database_query_duration_seconds: {
      type: MetricType.HISTOGRAM,
      description: '数据库查询耗时',
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      labels: ['operation', 'table'],
    },
  },

  // 资源指标
  resources: {
    cpu_usage_percent: {
      type: MetricType.GAUGE,
      description: 'CPU使用率',
      labels: ['instance'],
    },
    memory_usage_bytes: {
      type: MetricType.GAUGE,
      description: '内存使用量',
      labels: ['instance', 'type'],
    },
    disk_usage_bytes: {
      type: MetricType.GAUGE,
      description: '磁盘使用量',
      labels: ['instance', 'mount_point'],
    },
    network_throughput_bytes: {
      type: MetricType.COUNTER,
      description: '网络吞吐量',
      labels: ['instance', 'direction'],
    },
  },

  // LLM/AI指标
  ai: {
    llm_requests_total: {
      type: MetricType.COUNTER,
      description: 'LLM请求总数',
      labels: ['model', 'provider', 'status'],
    },
    llm_tokens_used_total: {
      type: MetricType.COUNTER,
      description: '使用的token总数',
      labels: ['model', 'type'],  // type: prompt/completion
    },
    llm_request_duration_seconds: {
      type: MetricType.HISTOGRAM,
      description: 'LLM请求耗时',
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      labels: ['model', 'provider'],
    },
    llm_cost_usd_total: {
      type: MetricType.COUNTER,
      description: 'LLM成本（美元）',
      labels: ['model', 'provider'],
    },
  },
};
```

### 自定义指标客户端

```typescript
// 指标客户端
class MetricsClient {
  private meter: Meter;
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();
  private histograms: Map<string, Histogram> = new Map();

  constructor(serviceName: string) {
    this.meter = this.getMeter(serviceName);
  }

  // 计数器
  counter(name: string, options?: CounterOptions): Counter {
    if (!this.counters.has(name)) {
      this.counters.set(name, this.meter.createCounter(name, options));
    }
    return this.counters.get(name);
  }

  // 仪表盘
  gauge(name: string, options?: GaugeOptions): Gauge {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, this.meter.createGauge(name, options));
    }
    return this.gauges.get(name);
  }

  // 直方图
  histogram(name: string, options?: HistogramOptions): Histogram {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, this.meter.createHistogram(name, options));
    }
    return this.histograms.get(name);
  }

  // 记录生成指标
  recordGeneration(duration: number, status: string, labels: Record<string, string>): void {
    this.counter('generations_completed_total', { labels }).add(1);
    this.histogram('generation_duration_seconds', { labels }).record(duration);
  }
}

// 使用示例
const metrics = new MetricsClient('generation-service');

// 记录生成
metrics.recordGeneration(45.6, 'success', {
  project_type: 'web-application',
  stage: 'coding',
});

// 记录HTTP
metrics.counter('http_requests_total', { labels: { method: 'POST', path: '/generate' } }).add(1);
```

## 日志体系

### 日志格式

```typescript
// 结构化日志格式
interface LogEntry {
  // 时间戳
  timestamp: string;           // ISO8601

  // 级别
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';

  // 服务信息
  service: {
    name: string;
    version: string;
    instance: string;
  };

  // 请求上下文
  request?: {
    id: string;
    path: string;
    method: string;
    userId?: string;
    ip: string;
    userAgent: string;
  };

  // 追踪上下文
  trace?: {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
  };

  // 消息
  message: string;
  template?: string;          // 消息模板
  parameters?: Record<string, any>; // 模板参数

  // 错误信息
  error?: {
    type: string;
    message: string;
    stack?: string;
    cause?: string;
  };

  // 自定义数据
  metadata?: Record<string, any>;

  // 持续时间（如果是操作日志）
  duration?: number;           // ms
}

// 日志级别
enum LogLevel {
  DEBUG = 0,   // 调试信息
  INFO = 1,    // 一般信息
  WARN = 2,    // 警告
  ERROR = 3,   // 错误
  FATAL = 4,   // 致命错误
}

// 日志记录器
class Logger {
  private serviceName: string;
  private minLevel: LogLevel;

  constructor(serviceName: string, minLevel: LogLevel = LogLevel.INFO) {
    this.serviceName = serviceName;
    this.minLevel = minLevel;
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, {
      ...metadata,
      error: error ? {
        type: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    });
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    if (level < this.minLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level].toLowerCase(),
      service: {
        name: this.serviceName,
        version: process.env.VERSION || 'unknown',
        instance: process.env.INSTANCE_ID || 'unknown',
      },
      message,
      ...(this.getCurrentTrace() && { trace: this.getCurrentTrace() }),
      ...(this.getCurrentRequest() && { request: this.getCurrentRequest() }),
      ...(metadata && { metadata }),
    };

    // 发送到日志收集器
    this.emit(entry);
  }
}
```

### 日志采样

```typescript
// 日志采样配置
const LOG_SAMPLING = {
  // 采样策略
  strategies: {
    // 错误日志：全部记录
    error: {
      sample_rate: 1.0,
      conditions: ['level === "error" || level === "fatal"'],
    },

    // 调试日志：采样1%
    debug: {
      sample_rate: 0.01,
      conditions: ['level === "debug"'],
    },

    // 慢请求日志：全部记录
    slow: {
      sample_rate: 1.0,
      conditions: ['duration > 5000'],
    },

    // 常规日志：采样10%
    normal: {
      sample_rate: 0.1,
      conditions: ['level === "info"'],
    },
  },

  // 动态采样
  dynamic: {
    enabled: true,
    target_rate: 0.1,         // 目标采样率
    max_rate: 1.0,            // 最大采样率
    min_rate: 0.01,           // 最小采样率
    adjustment_interval: '1m',
  },
};
```

## 分布式追踪

### 追踪上下文

```typescript
// 追踪上下文传播
interface TraceContext {
  traceId: string;          // 追踪ID
  spanId: string;           // Span ID
  parentSpanId?: string;    // 父Span ID
  sampled: boolean;         // 是否采样
  baggage?: Record<string, string>; //  baggage数据
}

// Span模型
interface Span {
  // 标识
  traceId: string;
  spanId: string;
  parentSpanId?: string;

  // 描述
  name: string;
  kind: 'server' | 'client' | 'producer' | 'consumer';

  // 时间
  startTime: number;        // Unix时间戳（纳秒）
  endTime?: number;

  // 状态
  status: {
    code: 'ok' | 'error';
    message?: string;
  };

  // 属性
  attributes: Record<string, string | number | boolean>;

  // 事件
  events: SpanEvent[];

  // 链接（跨追踪引用）
  links?: SpanLink[];

  // 资源
  resource: {
    service: string;
    version: string;
    instance: string;
  };
}

interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, string | number | boolean>;
}

interface SpanLink {
  traceId: string;
  spanId: string;
  attributes?: Record<string, string | number | boolean>;
}

// 追踪客户端
class TracingClient {
  private tracer: Tracer;
  private contextPropagator: ContextPropagator;

  // 创建追踪
  startSpan(
    name: string,
    options?: {
      kind?: Span['kind'];
      parent?: Span;
      attributes?: Record<string, any>;
    }
  ): SpanWrapper {
    const span = this.tracer.startSpan(name, {
      kind: options?.kind,
      parent: options?.parent,
      attributes: {
        'service.name': this.serviceName,
        ...options?.attributes,
      },
    });

    return new SpanWrapper(span, this);
  }

  // 注入上下文（跨进程传播）
  inject(context: TraceContext, carrier: Record<string, string>): void {
    this.contextPropagator.inject(context, carrier, 'http');
  }

  // 提取上下文
  extract(carrier: Record<string, string>): TraceContext | undefined {
    return this.contextPropagator.extract(carrier, 'http');
  }
}

// Span包装器
class SpanWrapper {
  constructor(
    private span: Span,
    private tracer: TracingClient
  ) {}

  // 设置属性
  setAttribute(key: string, value: string | number | boolean): this {
    this.span.attributes[key] = value;
    return this;
  }

  // 记录事件
  addEvent(name: string, attributes?: Record<string, any>): this {
    this.span.events.push({
      name,
      timestamp: Date.now() * 1000000, // 纳秒
      attributes,
    });
    return this;
  }

  // 记录错误
  recordError(error: Error): void {
    this.span.status = { code: 'error', message: error.message };
    this.span.events.push({
      name: 'exception',
      timestamp: Date.now() * 1000000,
      attributes: {
        'exception.type': error.name,
        'exception.message': error.message,
        'exception.stacktrace': error.stack,
      },
    });
  }

  // 结束
  end(): void {
    this.span.endTime = Date.now() * 1000000;
    this.tracer.sendSpan(this.span);
  }
}
```

### 自动instrumentation

```typescript
// HTTP instrumentation
const httpInstrumentation = {
  enabled: true,
  ignorePaths: ['/health', '/metrics'],
  server: {
    requestHook: (span, request) => {
      span.setAttribute('http.method', request.method);
      span.setAttribute('http.url', request.url);
      span.setAttribute('http.route', request.route);
      span.setAttribute('http.user_agent', request.headers['user-agent']);
    },
    responseHook: (span, response) => {
      span.setAttribute('http.status_code', response.status);
      if (response.status >= 400) {
        span.status = { code: 'error' };
      }
    },
    errorHook: (span, error) => {
      span.recordError(error);
    },
  },
  client: {
    requestHook: (span, request) => {
      span.setAttribute('http.method', request.method);
      span.setAttribute('http.url', request.url);
    },
    responseHook: (span, response) => {
      span.setAttribute('http.status_code', response.status);
    },
  },
};

// 数据库instrumentation
const databaseInstrumentation = {
  enabled: true,
  databases: ['sqlite', 'postgresql', 'mysql'],
  operationName: (operation, table) => `db.${operation}.${table}`,
  attributes: {
    'db.system': 'sqlite',
    'db.name': 'project_factory',
    'db.sql.table': '{table}',
  },
  slowThreshold: 100,  // 慢查询阈值(ms)
};

// LLM instrumentation
const llmInstrumentation = {
  enabled: true,
  providers: ['openai', 'anthropic', 'azure'],
  attributes: {
    'llm.request.model': '{model}',
    'llm.request.temperature': '{temperature}',
    'llm.request.max_tokens': '{max_tokens}',
    'llm.usage.prompt_tokens': '{usage.prompt_tokens}',
    'llm.usage.completion_tokens': '{usage.completion_tokens}',
    'llm.usage.total_tokens': '{usage.total_tokens}',
  },
  streaming: true,
};
```

## 告警系统

### 告警规则

```typescript
// 告警规则定义
interface AlertRule {
  id: string;
  name: string;
  description: string;

  // 条件
  condition: AlertCondition;

  // 评估
  evaluation: {
    interval: string;           // e.g., '1m'
    pendingDuration: string;     // 告警进入pending状态的时长
  };

  // 告警
  alert: {
    name: string;
    summary: string;            // 告警摘要
    description?: string;       // 详细描述
    severity: 'critical' | 'warning' | 'info';
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };

  // 行动
  actions: AlertAction[];

  // 状态
  status: 'active' | 'inactive';
}

// 告警条件
interface AlertCondition {
  // 指标条件
  metric?: {
    name: string;
    query: string;             // PromQL查询
    operator: '>' | '<' | '==' | '!=' | '>=' | '<=';
    value: number;
    for: string;               // 持续时间
  };

  // 复杂条件
  expr?: string;               // PromQL表达式
}

// 告警行动
interface AlertAction {
  type: 'notification' | 'webhook' | 'autoscaling' | 'runbook';

  config: {
    // 通知
    notification?: {
      channel: string;
      recipient?: string;
    };

    // Webhook
    webhook?: {
      url: string;
      method: 'POST' | 'PUT';
      headers?: Record<string, string>;
    };

    // 自动扩缩容
    autoscaling?: {
      action: 'scale_up' | 'scale_down';
      replicas: number;
    };

    // Runbook
    runbook?: {
      url: string;
      autoExecute: boolean;
    };
  };
}

// 预设告警规则
const PRESET_ALERT_RULES: AlertRule[] = [
  // 高错误率告警
  {
    id: 'high-error-rate',
    name: 'High Error Rate',
    description: 'API错误率超过5%',
    condition: {
      metric: {
        name: 'api_errors_rate',
        query: 'rate(api_errors_total[5m]) / rate(api_requests_total[5m])',
        operator: '>',
        value: 0.05,
        for: '2m',
      },
    },
    alert: {
      name: 'HighAPIErrorRate',
      summary: 'API错误率超过5% {{ $value | humanizePercentage }}',
      severity: 'critical',
    },
    actions: [
      { type: 'notification', config: { channel: 'pagerduty' } },
    ],
  },

  // 延迟告警
  {
    id: 'high-latency',
    name: 'High Latency',
    description: 'P99延迟超过2秒',
    condition: {
      metric: {
        name: 'http_request_duration_p99',
        query: 'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))',
        operator: '>',
        value: 2,
        for: '5m',
      },
    },
    alert: {
      name: 'HighLatency',
      summary: 'P99延迟 {{ $value | humanizeDuration }}',
      severity: 'warning',
    },
    actions: [
      { type: 'notification', config: { channel: 'slack' } },
    ],
  },

  // 生成失败告警
  {
    id: 'generation-failure',
    name: 'Generation Failure',
    description: '生成任务失败率超过20%',
    condition: {
      metric: {
        name: 'generation_failure_rate',
        query: 'rate(generations_completed_total{status="failed"}[10m]) / rate(generations_completed_total[10m])',
        operator: '>',
        value: 0.2,
        for: '5m',
      },
    },
    alert: {
      name: 'HighGenerationFailureRate',
      summary: '生成失败率 {{ $value | humanizePercentage }}',
      severity: 'critical',
      labels: { team: 'ai' },
    },
    actions: [
      { type: 'notification', config: { channel: 'pagerduty' } },
      { type: 'runbook', config: { url: '/runbooks/generation-failure' } },
    ],
  },

  // 资源不足告警
  {
    id: 'resource-exhaustion',
    name: 'Resource Exhaustion',
    description: '内存使用率超过90%',
    condition: {
      metric: {
        name: 'memory_usage_percent',
        query: 'memory_usage_bytes / memory_limit_bytes',
        operator: '>',
        value: 0.9,
        for: '5m',
      },
    },
    alert: {
      name: 'HighMemoryUsage',
      summary: '内存使用率 {{ $value | humanizePercentage }}',
      severity: 'warning',
    },
    actions: [
      { type: 'notification', config: { channel: 'slack' } },
      { type: 'autoscaling', config: { action: 'scale_up', replicas: 2 } },
    ],
  },
];
```

### 告警管理

```typescript
// 告警管理器
class AlertManager {
  // 评估告警规则
  async evaluateRules(): Promise<void> {
    const activeRules = await this.getActiveRules();

    for (const rule of activeRules) {
      await this.evaluateRule(rule);
    }
  }

  // 评估单个规则
  private async evaluateRule(rule: AlertRule): Promise<void> {
    const result = await this.query(rule.condition);

    if (result.firing && !rule.pending) {
      // 进入 firing 状态
      await this.fireAlert(rule, result);
    } else if (!result.firing && rule.pending) {
      // 从 firing 恢复
      await this.resolveAlert(rule);
    }
  }

  // 发送告警通知
  async sendAlert(alert: Alert): Promise<void> {
    // 去重
    if (await this.isDuplicate(alert)) {
      return;
    }

    // 发送通知
    for (const action of alert.rule.actions) {
      await this.executeAction(action, alert);
    }

    // 记录
    await this.storeAlert(alert);
  }

  // 告警聚合（减少告警风暴）
  async aggregate(alerts: Alert[]): Promise<AggregatedAlert[]> {
    // 按标签聚合
    const groups = new Map<string, Alert[]>();

    for (const alert of alerts) {
      const key = this.getAlertKey(alert);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(alert);
    }

    return Array.from(groups.entries()).map(([key, group]) => ({
      key,
      count: group.length,
      alerts: group,
      summary: this.generateSummary(group),
    }));
  }
}
```

## 仪表盘

### 预设仪表盘

```typescript
// 预设仪表盘
const PRESET_DASHBOARDS = {
  // 系统概览
  system_overview: {
    title: 'System Overview',
    panels: [
      {
        title: 'Request Rate',
        type: 'graph',
        targets: [
          { expr: 'rate(http_requests_total[5m])', legend: '{{method}} {{path}}' },
        ],
      },
      {
        title: 'Error Rate',
        type: 'graph',
        targets: [
          { expr: 'rate(api_errors_total[5m]) / rate(http_requests_total[5m])', legend: 'Error Rate' },
        ],
      },
      {
        title: 'Latency P50/P95/P99',
        type: 'graph',
        targets: [
          { expr: 'histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))', legend: 'P50' },
          { expr: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))', legend: 'P95' },
          { expr: 'histogram_quantile(0.99, rate(http_request_duration_seconds_seconds_bucket[5m]))', legend: 'P99' },
        ],
      },
    ],
  },

  // 生成服务仪表盘
  generation_service: {
    title: 'Generation Service',
    panels: [
      {
        title: 'Active Generations',
        type: 'stat',
        targets: [
          { expr: 'active_generations', legend: 'Active' },
        ],
      },
      {
        title: 'Generation Success Rate',
        type: 'gauge',
        targets: [
          { expr: 'rate(generations_completed_total{status="success"}[1h]) / rate(generations_completed_total[1h]) * 100', legend: 'Success Rate' },
        ],
      },
      {
        title: 'Generation Duration Distribution',
        type: 'heatmap',
        targets: [
          { expr: 'rate(generation_duration_seconds_bucket[5m])', legend: 'Duration' },
        ],
      },
      {
        title: 'Generations by Type',
        type: 'piechart',
        targets: [
          { expr: 'increase(generations_completed_total[24h])', legend: '{{project_type}}' },
        ],
      },
    ],
  },

  // AI/LLM 仪表盘
  ai_metrics: {
    title: 'AI/LLM Metrics',
    panels: [
      {
        title: 'Token Usage',
        type: 'graph',
        targets: [
          { expr: 'rate(llm_tokens_used_total{type="prompt"}[5m])', legend: 'Prompt Tokens' },
          { expr: 'rate(llm_tokens_used_total{type="completion"}[5m])', legend: 'Completion Tokens' },
        ],
      },
      {
        title: 'LLM Cost',
        type: 'stat',
        targets: [
          { expr: 'increase(llm_cost_usd_total[24h])', legend: 'Cost (24h)' },
        ],
      },
      {
        title: 'LLM Latency',
        type: 'graph',
        targets: [
          { expr: 'histogram_quantile(0.95, rate(llm_request_duration_seconds_bucket[5m]))', legend: 'P95 Latency' },
        ],
      },
    ],
  },
};
```

## 配置示例

```yaml
# 监控与可观测性配置
observability:
  # 服务标识
  service:
    name: "projectfactory"
    version: "${VERSION}"
    environment: "${ENV}"

  # OpenTelemetry配置
  otel:
    enabled: true
    exporter:
      otlp:
        endpoint: "${OTEL_EXPORTER_OTLP_ENDPOINT}"
        protocol: "grpc"
      jaeger:
        endpoint: "${JAEGER_ENDPOINT}"
    sampling:
      type: "tail"
      head:
        sampling_fraction: 0.1
      tail:
        rules:
          - name: "errors"
            conditions:
              - 'status.code == 2'  # ERROR
            sampling_fraction: 1.0
          - name: "slow"
            conditions:
              - 'duration > 5000'
            sampling_fraction: 1.0

  # 指标配置
  metrics:
    enabled: true
    export:
      prometheus:
        port: 9090
        path: "/metrics"
    aggregation:
      interval: "1m"
      retention: "30d"

  # 日志配置
  logging:
    level: "info"
    format: "json"
    sampling:
      enabled: true
      target_rate: 0.1
    export:
      loki:
        endpoint: "${LOKI_ENDPOINT}"

  # 告警配置
  alerting:
    enabled: true
    alertmanager:
      endpoint: "${ALERTMANAGER_ENDPOINT}"
    rules:
      evaluation_interval: "1m"
      notification:
        timeout: "10s"

  # 仪表盘配置
  dashboards:
    default_refresh: "30s"
    panels:
      - name: "system_overview"
        refresh: "10s"
      - name: "generation_service"
        refresh: "5s"
```

---

**最后更新**: 2026-04-14
