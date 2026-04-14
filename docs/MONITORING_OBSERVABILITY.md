# 监控与可观测性设计文档

## 1. 可观测性架构

### 1.1 三大支柱

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           可观测性三大支柱                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│     ┌─────────────┐         ┌─────────────┐         ┌─────────────┐        │
│     │   Metrics   │         │    Logs    │         │   Traces    │        │
│     │    指标     │         │    日志     │         │    链路     │        │
│     ├─────────────┤         ├─────────────┤         ├─────────────┤        │
│     │  数值测量    │         │  事件记录    │         │  请求链路   │        │
│     │  CPU/内存   │         │  操作日志    │         │  跨服务调用 │        │
│     │  请求率     │         │  错误追踪    │         │  延迟分析   │        │
│     │  错误率     │         │  调试信息    │         │  依赖关系   │        │
│     └─────────────┘         └─────────────┘         └─────────────┘        │
│                                                                              │
│                                 ↑                                            │
│                                 │                                            │
│                    ┌─────────────────────────┐                            │
│                    │      Correlation ID       │                            │
│                    │       关联标识           │                            │
│                    └─────────────────────────┘                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 可观测性架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           可观测性架构                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Application Layer                             │   │
│  │                                                                       │   │
│  │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐              │   │
│  │   │ Metrics│  │  Logs  │  │ Traces │  │ Events │              │   │
│  │   │ Collector│  │Collector│  │Collector│  │Collector│              │   │
│  │   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘              │   │
│  └─────────┼────────────┼────────────┼────────────┼────────────────────┘   │
│            │            │            │            │                      │
│            ▼            ▼            ▼            ▼                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Collector Layer                                  │   │
│  │                                                                       │   │
│  │   ┌─────────┐  ┌─────────┐  ┌─────────┐                            │   │
│  │   │  OTLP   │  │ Fluentd │  │  Jaeger │                            │   │
│  │   │ Receiver│  │ Bitaggr │  │  Agent  │                            │   │
│  │   └────┬────┘  └────┬────┘  └────┬────┘                            │   │
│  └─────────┼────────────┼────────────┼─────────────────────────────────┘   │
│            │            │            │                                    │
│            ▼            ▼            ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Storage Layer                                     │   │
│  │                                                                       │   │
│  │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐              │   │
│  │   │Prometheus│  │Elastic │  │  Tempo  │  │  SQLite │              │   │
│  │   │         │  │Search  │  │         │  │         │              │   │
│  │   └─────────┘  └─────────┘  └─────────┘  └─────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│            │                                                                 │
│            ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Visualization Layer                                │   │
│  │                                                                       │   │
│  │   ┌─────────┐  ┌─────────┐  ┌─────────┐                            │   │
│  │   │ Grafana │  │  Kibana │  │ Jaeger   │                            │   │
│  │   │         │  │         │  │ UI       │                            │   │
│  │   └─────────┘  └─────────┘  └─────────┘                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. 指标体系 (Metrics)

### 2.1 指标分类

```typescript
// 指标类型枚举
enum MetricType {
  // 系统指标
  SYSTEM_CPU = 'system.cpu',
  SYSTEM_MEMORY = 'system.memory',
  SYSTEM_DISK = 'system.disk',
  SYSTEM_NETWORK = 'system.network',

  // 应用指标
  APP_REQUEST_COUNT = 'app.request.count',
  APP_REQUEST_DURATION = 'app.request.duration',
  APP_REQUEST_ERROR = 'app.request.error',

  // 业务指标
  BIZ_PROJECT_COUNT = 'biz.project.count',
  BIZ_PROJECT_SUCCESS = 'biz.project.success',
  BIZ_PROJECT_FAILURE = 'biz.project.failure',
  BIZ_PROJECT_DURATION = 'biz.project.duration',

  // Agent 指标
  AGENT_EXECUTION_COUNT = 'agent.execution.count',
  AGENT_EXECUTION_DURATION = 'agent.execution.duration',
  AGENT_EXECUTION_ERROR = 'agent.execution.error',
  AGENT_TOKEN_USAGE = 'agent.token.usage',

  // 知识库指标
  KB_HIT_RATE = 'kb.hit_rate',
  KB_ENTRY_COUNT = 'kb.entry_count',
  KB_USAGE = 'kb.usage'
}

// 指标数据点
interface MetricPoint {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

// 指标定义
interface MetricDefinition {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  description: string;
  unit: string;
  labels: string[];
  buckets?: number[];  // histogram buckets
}
```

### 2.2 核心指标

```typescript
// 系统指标
const systemMetrics: MetricDefinition[] = [
  {
    name: 'system_cpu_usage',
    type: 'gauge',
    description: 'CPU 使用率',
    unit: 'percent',
    labels: ['core']
  },
  {
    name: 'system_memory_usage',
    type: 'gauge',
    description: '内存使用率',
    unit: 'bytes',
    labels: ['type']  // heap, rss, external
  },
  {
    name: 'system_disk_usage',
    type: 'gauge',
    description: '磁盘使用率',
    unit: 'bytes',
    labels: ['path', 'type']
  }
];

// 业务指标
const businessMetrics: MetricDefinition[] = [
  {
    name: 'project_generation_total',
    type: 'counter',
    description: '项目生成总数',
    unit: 'count',
    labels: ['status', 'type']
  },
  {
    name: 'project_generation_duration_seconds',
    type: 'histogram',
    description: '项目生成耗时',
    unit: 'seconds',
    labels: ['type', 'stage'],
    buckets: [60, 300, 600, 1800, 3600, 7200]  // 1m, 5m, 10m, 30m, 1h, 2h
  },
  {
    name: 'project_quality_score',
    type: 'gauge',
    description: '项目质量评分',
    unit: 'score',
    labels: ['type']
  },
  {
    name: 'project_test_coverage_percent',
    type: 'gauge',
    description: '项目测试覆盖率',
    unit: 'percent',
    labels: ['type']
  }
];

// Agent 指标
const agentMetrics: MetricDefinition[] = [
  {
    name: 'agent_execution_total',
    type: 'counter',
    description: 'Agent 执行总数',
    unit: 'count',
    labels: ['agent', 'status']
  },
  {
    name: 'agent_execution_duration_seconds',
    type: 'histogram',
    description: 'Agent 执行耗时',
    unit: 'seconds',
    labels: ['agent'],
    buckets: [1, 5, 10, 30, 60, 120, 300]
  },
  {
    name: 'agent_token_usage_total',
    type: 'counter',
    description: 'Token 使用总量',
    unit: 'tokens',
    labels: ['agent', 'model']
  },
  {
    name: 'agent_cost_total',
    type: 'counter',
    description: 'Agent 成本总量',
    unit: 'dollars',
    labels: ['agent', 'model']
  }
];

// 知识库指标
const knowledgeMetrics: MetricDefinition[] = [
  {
    name: 'knowledge_retrieval_total',
    type: 'counter',
    description: '知识检索次数',
    unit: 'count',
    labels: ['type', 'hit']
  },
  {
    name: 'knowledge_extraction_total',
    type: 'counter',
    description: '知识提取次数',
    unit: 'count',
    labels: ['type', 'status']
  }
];
```

### 2.3 指标收集器

```typescript
// 指标收集器

class MetricsCollector {
  private registry: Map<string, MetricFamily> = new Map();
  private interval: NodeJS.Timeout;

  constructor(private options: CollectorOptions) {
    // 启动定期收集
    this.interval = setInterval(() => this.collect(), options.interval || 10000);
  }

  // 记录指标
  record(name: string, value: number, labels?: Record<string, string>): void {
    const family = this.registry.get(name);
    if (!family) return;

    family.samples.push({
      value,
      labels: labels || {},
      timestamp: Date.now()
    });
  }

  // 增加计数器
  increment(name: string, labels?: Record<string, string>): void {
    this.record(name, 1, labels);
  }

  // 设置 gauge
  set(name: string, value: number, labels?: Record<string, string>): void {
    const family = this.registry.get(name);
    if (!family) return;

    // gauge 只保留最新值
    family.samples = [{
      value,
      labels: labels || {},
      timestamp: Date.now()
    }];
  }

  // 观察直方图
  observe(name: string, value: number, labels?: Record<string, string>): void {
    const family = this.registry.get(name);
    if (!family || family.type !== 'histogram') return;

    family.samples.push({
      value,
      labels: labels || {},
      timestamp: Date.now()
    });
  }

  // 收集系统指标
  private async collect(): Promise<void> {
    // CPU
    const cpuUsage = await this.getCpuUsage();
    this.set('system_cpu_usage', cpuUsage);

    // 内存
    const memUsage = process.memoryUsage();
    this.set('system_memory_usage', memUsage.heapUsed, { type: 'heap' });
    this.set('system_memory_usage', memUsage.rss, { type: 'rss' });

    // 活跃请求
    this.set('app_active_requests', this.activeRequests);
  }

  // 获取 Prometheus 格式
  toPrometheusFormat(): string {
    let output = '';

    for (const [name, family] of this.registry) {
      output += `# HELP ${name} ${family.description}\n`;
      output += `# TYPE ${name} ${family.type}\n`;

      for (const sample of family.samples) {
        const labelStr = Object.entries(sample.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');

        output += `${name}${labelStr ? `{${labelStr}}` : ''} ${sample.value}\n`;
      }
    }

    return output;
  }
}

// 指标中间件
function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const labels = {
      method: req.method,
      path: req.route?.path || req.path,
      status: res.statusCode.toString()
    };

    metrics.increment('app_request_count', labels);
    metrics.observe('app_request_duration_seconds', duration / 1000, labels);

    if (res.statusCode >= 400) {
      metrics.increment('app_request_errors', labels);
    }
  });

  next();
}
```

## 3. 日志体系 (Logs)

### 3.1 日志格式

```typescript
// 日志格式定义
interface LogEntry {
  // 时间戳
  timestamp: string;           // ISO 8601 格式

  // 级别
  level: 'debug' | 'info' | 'warn' | 'error';

  // 消息
  message: string;
  template?: string;           // 模板消息

  // 上下文
  service: string;            // 服务名称
  version?: string;           // 服务版本
  environment?: string;      // 环境

  // 请求上下文
  requestId?: string;         // 请求 ID
  correlationId?: string;     // 关联 ID
  sessionId?: string;        // 会话 ID
  userId?: string;           // 用户 ID

  // Agent 上下文
  agentName?: string;        // Agent 名称
  projectId?: string;        // 项目 ID
  workflowId?: string;       // 工作流 ID

  // 堆栈信息
  stack?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };

  // 自定义数据
  metadata?: Record<string, any>;

  // 来源
  source: {
    file?: string;
    line?: number;
    column?: number;
    function?: string;
  };
}
```

### 3.2 日志级别策略

```typescript
// 日志级别使用规范

// DEBUG: 详细调试信息
// - 输入输出数据
// - 中间计算步骤
// - 循环迭代信息
logger.debug('Processing project', {
  projectId: 'proj_123',
  stage: 'coding',
  fileIndex: 5,
  totalFiles: 20
});

// INFO: 重要业务事件
// - API 请求成功
// - 项目阶段完成
// - 关键决策点
logger.info('Project stage completed', {
  projectId: 'proj_123',
  previousStage: 'coding',
  currentStage: 'testing',
  duration: 180000
});

// WARN: 警告信息
// - 重试操作
// - 降级行为
// - 非关键错误
logger.warn('Test coverage below target', {
  projectId: 'proj_123',
  actualCoverage: 72,
  targetCoverage: 80
});

// ERROR: 错误信息
// - 操作失败
// - 异常捕获
// - 业务异常
logger.error('Failed to generate code', {
  projectId: 'proj_123',
  error: error.message,
  stack: error.stack,
  agent: 'CoderAgent'
});
```

### 3.3 结构化日志

```typescript
// 结构化日志服务

class StructuredLogger {
  constructor(private context: LoggerContext) {}

  // 创建带上下文的 logger
  child(additionalContext: Record<string, any>): StructuredLogger {
    return new StructuredLogger({
      ...this.context,
      ...additionalContext
    });
  }

  // 记录日志
  log(level: LogEntry['level'], message: string, data?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      metadata: data,
      source: this.getCallerInfo()
    };

    // 输出到控制台
    this.output(entry);

    // 发送到日志收集器
    this.sendToCollector(entry);
  }

  // 便捷方法
  debug(message: string, data?: Record<string, any>) {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, any>) {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, any>) {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, any>) {
    this.log('error', message, data);
  }

  // 格式化输出
  private output(entry: LogEntry): void {
    const formatted = JSON.stringify(entry);

    switch (entry.level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }
}

// Agent 日志
class AgentLogger extends StructuredLogger {
  constructor(agentName: string) {
    super({ service: 'agent', agentName });
  }

  // Agent 特定方法
  executionStart(input: any) {
    this.info('Agent execution started', {
      input: this.sanitize(input)
    });
  }

  executionComplete(output: any, metrics: ExecutionMetrics) {
    this.info('Agent execution completed', {
      output: this.sanitize(output),
      duration: metrics.duration,
      tokensUsed: metrics.tokensUsed,
      cost: metrics.cost
    });
  }

  executionError(error: Error) {
    this.error('Agent execution failed', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });
  }

  // 脱敏敏感数据
  private sanitize(data: any): any {
    const sensitiveKeys = ['apiKey', 'token', 'password', 'secret'];
    return JSON.parse(JSON.stringify(data, (key, value) => {
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
        return '[REDACTED]';
      }
      return value;
    }));
  }
}
```

## 4. 链路追踪 (Traces)

### 4.1 追踪模型

```typescript
// 追踪数据模型

interface Trace {
  traceId: string;
  spanId: string;
  parentSpanId?: string;

  // 操作信息
  operationName: string;
  service: string;

  // 时间
  startTime: number;
  endTime: number;
  duration: number;  // ms

  // 标签
  tags: Record<string, string>;

  // 事件
  events: TraceEvent[];

  // 状态
  status: 'ok' | 'error';

  // 错误信息
  error?: {
    message: string;
    type: string;
    stack?: string;
  };
}

interface TraceEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, string>;
}

// 追踪上下文传播
interface TraceContext {
  traceId: string;
  spanId: string;
  sampled: boolean;
  baggage: Record<string, string>;
}
```

### 4.2 追踪实现

```typescript
// 追踪服务

class TracingService {
  private activeSpans: Map<string, Span> = new Map();

  // 开始追踪
  startSpan(
    name: string,
    context: TraceContext,
    options?: SpanOptions
  ): Span {
    const span: Span = {
      name,
      traceId: context.traceId,
      spanId: this.generateSpanId(),
      parentSpanId: context.spanId,
      startTime: Date.now(),
      tags: options?.tags || {},
      events: [],
      sampled: context.sampled
    };

    this.activeSpans.set(span.spanId, span);

    // 注入追踪头
    this.injectContext(span);

    return span;
  }

  // 结束追踪
  endSpan(spanId: string, status: 'ok' | 'error', error?: Error): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;

    if (error) {
      span.error = {
        message: error.message,
        type: error.name,
        stack: error.stack
      };
    }

    // 发送到收集器
    this.exportSpan(span);

    this.activeSpans.delete(spanId);
  }

  // 添加事件
  addSpanEvent(spanId: string, event: TraceEvent): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.events.push({
      ...event,
      timestamp: Date.now()
    });
  }

  // 设置标签
  setSpanTag(spanId: string, key: string, value: string): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.tags[key] = value;
  }

  // HTTP 中间件
  tracingMiddleware(req: Request, res: Response, next: NextFunction) {
    // 提取追踪上下文
    const context = this.extractContext(req.headers);

    // 创建根 span
    const span = this.startSpan(`${req.method} ${req.path}`, context, {
      tags: {
        'http.method': req.method,
        'http.url': req.url,
        'http.target': req.path
      }
    });

    // 添加请求 ID
    req.headers['x-trace-id'] = span.traceId;
    req.headers['x-span-id'] = span.spanId;

    // 响应完成时结束 span
    res.on('finish', () => {
      this.setSpanTag(span.spanId, 'http.status_code', res.statusCode.toString());

      if (res.statusCode >= 400) {
        this.endSpan(span.spanId, 'error');
      } else {
        this.endSpan(span.spanId, 'ok');
      }
    });

    next();
  }
}

// Agent 追踪装饰器
function traced(agentName: string) {
  return function (
    target: any,
    methodName: string,
    descriptor: PropertyDescriptor
  ) {
    const original = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const tracer = Container.get(TracingService);
      const context = tracer.extractContext(args[0]?.headers || {});

      const span = tracer.startSpan(`${agentName}.${methodName}`, context);

      try {
        const result = await original.apply(this, args);
        tracer.setSpanTag(span.spanId, 'status', 'ok');
        return result;
      } catch (error) {
        tracer.setSpanTag(span.spanId, 'status', 'error');
        tracer.endSpan(span.spanId, 'error', error);
        throw error;
      } finally {
        tracer.endSpan(span.spanId, 'ok');
      }
    };

    return descriptor;
  };
}
```

## 5. 告警系统

### 5.1 告警规则

```typescript
// 告警规则定义

interface AlertRule {
  id: string;
  name: string;
  description: string;

  // 条件
  condition: AlertCondition;

  // 级别
  severity: 'critical' | 'warning' | 'info';

  // 冷却时间（避免重复告警）
  cooldown: number;  // ms

  // 告警目标
  targets: AlertTarget[];

  // 是否启用
  enabled: boolean;
}

interface AlertCondition {
  type: 'threshold' | 'anomaly' | 'status';

  // 阈值条件
  metric?: string;
  operator?: '>' | '<' | '>=' | '<=' | '==';
  value?: number;
  duration?: number;  // 持续时间

  // 异常检测
  anomaly?: {
    metric: string;
    threshold: number;  // 标准差倍数
    baseline?: string;   // 基线时间段
  };

  // 状态条件
  statusCheck?: {
    service: string;
    expected: 'healthy' | 'unhealthy';
  };
}

interface AlertTarget {
  type: 'webhook' | 'email' | 'slack' | 'pagerduty';
  config: Record<string, any>;
}

// 预定义告警规则
const defaultAlertRules: AlertRule[] = [
  // 系统告警
  {
    id: 'cpu-high',
    name: 'CPU 使用率过高',
    description: 'CPU 使用率持续超过 80%',
    condition: {
      type: 'threshold',
      metric: 'system_cpu_usage',
      operator: '>',
      value: 80,
      duration: 300000  // 5 分钟
    },
    severity: 'warning',
    cooldown: 600000,
    targets: [{ type: 'slack', config: { channel: '#alerts' } }],
    enabled: true
  },
  {
    id: 'memory-high',
    name: '内存使用率过高',
    description: '内存使用率持续超过 85%',
    condition: {
      type: 'threshold',
      metric: 'system_memory_percent',
      operator: '>',
      value: 85,
      duration: 300000
    },
    severity: 'warning',
    cooldown: 600000,
    targets: [{ type: 'slack', config: { channel: '#alerts' } }],
    enabled: true
  },

  // 业务告警
  {
    id: 'project-failure-rate',
    name: '项目失败率过高',
    description: '过去 1 小时内项目失败率超过 20%',
    condition: {
      type: 'threshold',
      metric: 'project_failure_rate',
      operator: '>',
      value: 0.2,
      duration: 60000
    },
    severity: 'critical',
    cooldown: 1800000,
    targets: [
      { type: 'slack', config: { channel: '#critical' } },
      { type: 'pagerduty', config: {} }
    ],
    enabled: true
  },
  {
    id: 'project-duration-slow',
    name: '项目生成时间过长',
    description: '项目平均生成时间超过预期 2 倍',
    condition: {
      type: 'threshold',
      metric: 'project_generation_duration_seconds',
      operator: '>',
      value: 7200,  // 2 小时
      duration: 300000
    },
    severity: 'warning',
    cooldown: 600000,
    targets: [{ type: 'slack', config: { channel: '#monitoring' } }],
    enabled: true
  },

  // Agent 告警
  {
    id: 'agent-error-rate',
    name: 'Agent 错误率过高',
    description: '特定 Agent 错误率超过 10%',
    condition: {
      type: 'threshold',
      metric: 'agent_execution_error_rate',
      operator: '>',
      value: 0.1,
      duration: 300000
    },
    severity: 'critical',
    cooldown: 600000,
    targets: [{ type: 'slack', config: { channel: '#critical' } }],
    enabled: true
  },

  // 成本告警
  {
    id: 'cost-overrun',
    name: '日成本超限',
    description: '日 Token 消耗成本超过 $50',
    condition: {
      type: 'threshold',
      metric: 'daily_cost_total',
      operator: '>',
      value: 50,
      duration: 0
    },
    severity: 'warning',
    cooldown: 43200000,  // 12 小时
    targets: [{ type: 'email', config: { to: 'admin@example.com' } }],
    enabled: true
  }
];
```

### 5.2 告警评估器

```typescript
// 告警评估器

class AlertEvaluator {
  private rules: Map<string, AlertRule> = new Map();
  private lastFired: Map<string, number> = new Map();
  private metricsStore: MetricsStore;

  constructor(metricsStore: MetricsStore) {
    this.metricsStore = metricsStore;
  }

  // 加载规则
  loadRules(rules: AlertRule[]): void {
    for (const rule of rules) {
      this.rules.set(rule.id, rule);
    }
  }

  // 评估所有规则
  async evaluate(): Promise<Alert[]> {
    const alerts: Alert[] = [];

    for (const [id, rule] of this.rules) {
      if (!rule.enabled) continue;

      // 检查冷却时间
      const lastFiredTime = this.lastFired.get(id);
      if (lastFiredTime && Date.now() - lastFiredTime < rule.cooldown) {
        continue;
      }

      // 评估规则
      const fired = await this.evaluateRule(rule);

      if (fired) {
        const alert = await this.createAlert(rule);
        alerts.push(alert);
        this.lastFired.set(id, Date.now());

        // 发送通知
        await this.sendNotifications(alert);
      }
    }

    return alerts;
  }

  // 评估单条规则
  private async evaluateRule(rule: AlertRule): Promise<boolean> {
    const condition = rule.condition;

    switch (condition.type) {
      case 'threshold':
        return this.evaluateThreshold(condition);

      case 'anomaly':
        return this.evaluateAnomaly(condition);

      case 'status':
        return this.evaluateStatus(condition);

      default:
        return false;
    }
  }

  // 阈值评估
  private async evaluateThreshold(condition: AlertCondition): Promise<boolean> {
    if (!condition.metric || condition.operator === undefined || condition.value === undefined) {
      return false;
    }

    // 获取当前指标值
    const currentValue = await this.metricsStore.getLatest(condition.metric);

    // 检查持续时间
    if (condition.duration && condition.duration > 0) {
      const values = await this.metricsStore.getRange(
        condition.metric,
        Date.now() - condition.duration,
        Date.now()
      );

      // 所有值都满足条件
      return values.every(v => this.compare(v, condition.operator, condition.value));
    }

    // 瞬时值检查
    return this.compare(currentValue, condition.operator, condition.value);
  }

  // 比较操作
  private compare(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      default: return false;
    }
  }
}

// 告警通知
class AlertNotifier {
  async send(alert: Alert, target: AlertTarget): Promise<void> {
    switch (target.type) {
      case 'slack':
        await this.sendSlack(alert, target.config);
        break;
      case 'email':
        await this.sendEmail(alert, target.config);
        break;
      case 'webhook':
        await this.sendWebhook(alert, target.config);
        break;
      case 'pagerduty':
        await this.sendPagerDuty(alert, target.config);
        break;
    }
  }

  private async sendSlack(alert: Alert, config: any): Promise<void> {
    const payload = {
      channel: config.channel,
      attachments: [{
        color: this.getSeverityColor(alert.severity),
        title: alert.name,
        text: alert.description,
        fields: [
          { title: 'Severity', value: alert.severity, short: true },
          { title: 'Status', value: alert.status, short: true },
          { title: 'Fired At', value: new Date(alert.firedAt).toISOString(), short: true }
        ],
        footer: 'ProjectFactory Alert'
      }]
    };

    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }
}
```

## 6. 仪表盘

### 6.1 核心仪表盘

```typescript
// Grafana 仪表盘配置

interface GrafanaDashboard {
  title: string;
  tags: string[];
  panels: GrafanaPanel[];
}

// 系统概览仪表盘
const systemOverviewDashboard: GrafanaDashboard = {
  title: 'ProjectFactory - System Overview',
  tags: ['projectfactory', 'overview'],
  panels: [
    // 1. 系统状态卡片
    {
      type: 'stat',
      title: 'System Status',
      targets: [
        { expr: 'up', refId: 'A' }
      ],
      options: {
        colorMode: 'background',
        graphMode: 'none'
      }
    },

    // 2. 活跃项目数
    {
      type: 'stat',
      title: 'Active Projects',
      targets: [
        { expr: 'project_generation_total{status="running"}', refId: 'A' }
      ]
    },

    // 3. 今日完成项目
    {
      type: 'stat',
      title: 'Projects Completed Today',
      targets: [
        { expr: 'increase(project_generation_total{status="completed"}[24h])', refId: 'A' }
      ]
    },

    // 4. 成功率
    {
      type: 'gauge',
      title: 'Success Rate',
      targets: [
        { expr: 'rate(project_generation_total{status="completed"}[1h]) / rate(project_generation_total[1h]) * 100', refId: 'A' }
      ],
      fieldConfig: {
        defaults: {
          min: 0,
          max: 100,
          unit: 'percent',
          thresholds: {
            steps: [
              { value: 0, color: 'red' },
              { value: 70, color: 'yellow' },
              { value: 90, color: 'green' }
            ]
          }
        }
      }
    },

    // 5. 项目生成趋势
    {
      type: 'timeseries',
      title: 'Project Generation Trend',
      targets: [
        { expr: 'rate(project_generation_total[5m])', refId: 'A', legendFormat: 'Total' },
        { expr: 'rate(project_generation_total{status="completed"}[5m])', refId: 'B', legendFormat: 'Completed' },
        { expr: 'rate(project_generation_total{status="failed"}[5m])', refId: 'C', legendFormat: 'Failed' }
      ],
      gridPos: { x: 0, y: 6, w: 12, h: 8 }
    },

    // 6. 质量分布
    {
      type: 'histogram',
      title: 'Quality Score Distribution',
      targets: [
        { expr: 'project_quality_score', refId: 'A' }
      ],
      bucketOffset: 0
    },

    // 7. Token 消耗趋势
    {
      type: 'timeseries',
      title: 'Token Usage',
      targets: [
        { expr: 'rate(agent_token_usage_total[5m])', refId: 'A' }
      ],
      unit: 'short'
    },

    // 8. Agent 执行时间
    {
      type: 'timeseries',
      title: 'Agent Execution Duration',
      targets: [
        { expr: 'histogram_quantile(0.95, rate(agent_execution_duration_seconds_bucket[5m]))', refId: 'A', legendFormat: 'p95' },
        { expr: 'histogram_quantile(0.50, rate(agent_execution_duration_seconds_bucket[5m]))', refId: 'B', legendFormat: 'p50' }
      ],
      unit: 's'
    }
  ]
};
```

### 6.2 项目详情仪表盘

```typescript
const projectDetailDashboard: GrafanaDashboard = {
  title: 'ProjectFactory - Project Detail',
  tags: ['projectfactory', 'project'],
  panels: [
    // 项目进度
    {
      type: 'gauge',
      title: 'Project Progress',
      targets: [
        { expr: 'project_progress_percent', refId: 'A' }
      ],
      options: {
        showThresholdLabels: true,
        thresholds: {
          steps: [
            { value: 0, color: 'red' },
            { value: 25, color: 'orange' },
            { value: 50, color: 'yellow' },
            { value: 75, color: 'blue' },
            { value: 100, color: 'green' }
          ]
        }
      }
    },

    // 阶段时间线
    {
      type: 'timeline',
      title: 'Stage Timeline',
      targets: [
        { expr: 'project_stage_duration_seconds', refId: 'A' }
      ]
    },

    // 代码行数
    {
      type: 'stat',
      title: 'Lines of Code',
      targets: [
        { expr: 'project_loc_total', refId: 'A' }
      ],
      options: {
        colorMode: 'value'
      }
    },

    // 测试覆盖率
    {
      type: 'gauge',
      title: 'Test Coverage',
      targets: [
        { expr: 'project_test_coverage_percent', refId: 'A' }
      ],
      fieldConfig: {
        defaults: {
          min: 0,
          max: 100,
          unit: 'percent',
          thresholds: {
            steps: [
              { value: 0, color: 'red' },
              { value: 50, color: 'yellow' },
              { value: 80, color: 'green' }
            ]
          }
        }
      }
    },

    // 实时日志
    {
      type: 'log',
      title: 'Real-time Logs',
      targets: [
        { expr: '{project_id="$project_id"}', refId: 'A' }
      ],
      options: {
        showLabels: true,
        showCommonLabels: true,
        wrapLogMessage: true
      }
    }
  ]
};
```

---

**版本**: 1.0.0
**创建日期**: 2026-04-14
**状态**: 监控与可观测性设计完成
