# 监控与告警系统设计

## 1. 概述

本文档描述 ProjectFactory 系统的监控与告警系统设计，提供全栈可观测性和智能告警。

### 1.1 设计目标

| 目标 | 描述 |
|------|------|
| 全栈监控 | 覆盖应用/系统/基础设施 |
| 智能告警 | 减少噪音，提高准确性 |
| SLA 保障 | 99.9% 可用性目标 |
| 快速定位 | 端到端追踪 |

### 1.2 监控架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          监控架构                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                        │
│  │  应用指标   │  │   日志      │  │   追踪      │                        │
│  │  Metrics   │  │   Logs     │  │   Traces   │                        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                        │
│         └────────────────┴────────────────┘                                │
│                            ↓                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Prometheus + OpenTelemetry                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                            ↓                                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                        │
│  │   Grafana   │  │  AlertManager │  │   PagerDuty │                        │
│  │   Dashboard │  │   告警路由   │  │   告警升级  │                        │
│  └─────────────┘  └─────────────┘  └─────────────┘                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 指标体系

### 2.1 指标分类

```typescript
// src/monitoring/types.ts
enum MetricCategory {
  // 业务指标
  BUSINESS = 'business',

  // 技术指标
  TECHNICAL = 'technical',

  // LLM 指标
  LLM = 'llm',

  // 系统指标
  SYSTEM = 'system',
}

interface MetricDefinition {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  category: MetricCategory;
  description: string;
  unit: string;
  labels: string[];
  buckets?: number[];
}

// 业务指标
const BUSINESS_METRICS: MetricDefinition[] = [
  {
    name: 'pf_projects_total',
    type: 'counter',
    category: MetricCategory.BUSINESS,
    description: '创建的项目总数',
    unit: 'projects',
    labels: ['type', 'status'],
  },
  {
    name: 'pf_project_duration_seconds',
    type: 'histogram',
    category: MetricCategory.BUSINESS,
    description: '项目生成耗时',
    unit: 'seconds',
    labels: ['type', 'stage'],
    buckets: [1, 5, 10, 30, 60, 120, 300, 600],
  },
  {
    name: 'pf_quality_score',
    type: 'histogram',
    category: MetricCategory.BUSINESS,
    description: '项目质量评分',
    unit: 'score',
    labels: ['type'],
    buckets: [0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  },
  {
    name: 'pf_active_iterations',
    type: 'gauge',
    category: MetricCategory.BUSINESS,
    description: '当前活跃迭代数',
    unit: 'iterations',
    labels: [],
  },
];

// LLM 指标
const LLM_METRICS: MetricDefinition[] = [
  {
    name: 'pf_llm_requests_total',
    type: 'counter',
    category: MetricCategory.LLM,
    description: 'LLM 请求总数',
    unit: 'requests',
    labels: ['model', 'agent', 'status'],
  },
  {
    name: 'pf_llm_duration_seconds',
    type: 'histogram',
    category: MetricCategory.LLM,
    description: 'LLM 请求耗时',
    unit: 'seconds',
    labels: ['model', 'agent'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  },
  {
    name: 'pf_llm_tokens_total',
    type: 'counter',
    category: MetricCategory.LLM,
    description: 'LLM Token 使用量',
    unit: 'tokens',
    labels: ['model', 'type'],  // type: input/output
  },
  {
    name: 'pf_llm_errors_total',
    type: 'counter',
    category: MetricCategory.LLM,
    description: 'LLM 错误数',
    unit: 'errors',
    labels: ['model', 'error_type'],
  },
  {
    name: 'pf_llm_rate_limit_hits_total',
    type: 'counter',
    category: MetricCategory.LLM,
    description: 'LLM 限流次数',
    unit: 'hits',
    labels: ['model'],
  },
];

// 系统指标
const SYSTEM_METRICS: MetricDefinition[] = [
  {
    name: 'pf_http_requests_total',
    type: 'counter',
    category: MetricCategory.TECHNICAL,
    description: 'HTTP 请求总数',
    unit: 'requests',
    labels: ['method', 'path', 'status'],
  },
  {
    name: 'pf_http_request_duration_seconds',
    type: 'histogram',
    category: MetricCategory.TECHNICAL,
    description: 'HTTP 请求耗时',
    unit: 'seconds',
    labels: ['method', 'path'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  },
  {
    name: 'pf_db_query_duration_seconds',
    type: 'histogram',
    category: MetricCategory.TECHNICAL,
    description: '数据库查询耗时',
    unit: 'seconds',
    labels: ['operation', 'table'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
  },
  {
    name: 'pf_cache_hit_ratio',
    type: 'gauge',
    category: MetricCategory.TECHNICAL,
    description: '缓存命中率',
    unit: 'ratio',
    labels: ['cache_level'],
  },
];
```

### 2.2 指标收集器

```typescript
// src/monitoring/collector.ts
import { Registry, Counter, Gauge, Histogram, Summary } from 'prom-client';

class MetricsCollector {
  private registry: Registry;
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();
  private histograms: Map<string, Histogram> = new Map();
  private summaries: Map<string, Summary> = new Map();

  constructor() {
    this.registry = new Registry();

    // 注册默认指标
    this.registerDefaultMetrics();
  }

  // 注册默认系统指标
  private registerDefaultMetrics() {
    // 进程指标
    new Gauge({
      name: 'process_cpu_usage',
      help: 'Process CPU usage',
      registers: [this.registry],
    }).set(0);

    new Gauge({
      name: 'process_memory_bytes',
      help: 'Process memory usage in bytes',
      registers: [this.registry],
    }).set(0);

    // Node.js 特定指标
    new Gauge({
      name: 'nodejs_event_loop_lag_seconds',
      help: 'Node.js event loop lag',
      registers: [this.registry],
    }).set(0);
  }

  // 注册指标
  register(definition: MetricDefinition) {
    switch (definition.type) {
      case 'counter':
        const counter = new Counter({
          name: definition.name,
          help: definition.description,
          labelNames: definition.labels,
          registers: [this.registry],
        });
        this.counters.set(definition.name, counter);
        break;

      case 'gauge':
        const gauge = new Gauge({
          name: definition.name,
          help: definition.description,
          labelNames: definition.labels,
          registers: [this.registry],
        });
        this.gauges.set(definition.name, gauge);
        break;

      case 'histogram':
        const histogram = new Histogram({
          name: definition.name,
          help: definition.description,
          labelNames: definition.labels,
          buckets: definition.buckets,
          registers: [this.registry],
        });
        this.histograms.set(definition.name, histogram);
        break;

      case 'summary':
        const summary = new Summary({
          name: definition.name,
          help: definition.description,
          labelNames: definition.labels,
          registers: [this.registry],
        });
        this.summaries.set(definition.name, summary);
        break;
    }
  }

  // 增加计数器
  incCounter(name: string, labels?: Record<string, string>, value?: number) {
    this.counters.get(name)?.inc(labels || {}, value || 1);
  }

  // 设置仪表值
  setGauge(name: string, value: number, labels?: Record<string, string>) {
    this.gauges.get(name)?.set(labels || {}, value);
  }

  // 观察直方图
  observeHistogram(name: string, value: number, labels?: Record<string, string>) {
    this.histograms.get(name)?.observe(labels || {}, value);
  }

  // 获取指标
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}

export const metricsCollector = new MetricsCollector();

// 初始化所有指标
[...BUSINESS_METRICS, ...LLM_METRICS, ...SYSTEM_METRICS].forEach(m =>
  metricsCollector.register(m)
);
```

---

## 3. 告警规则

### 3.1 告警定义

```typescript
// src/monitoring/alerts/rules.ts
interface AlertRule {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  enabled: boolean;
  conditions: AlertCondition[];
  duration?: number;  // 持续时间 (秒)
  annotations: {
    summary: string;
    description: string;
    runbookUrl?: string;
    dashboardUrl?: string;
  };
  labels: Record<string, string>;
  actions: AlertAction[];
}

enum AlertSeverity {
  CRITICAL = 'critical',  // P1 - 立即处理
  HIGH = 'high',          // P2 - 15 分钟内
  MEDIUM = 'medium',      // P3 - 1 小时内
  LOW = 'low',            // P4 - 工作时间处理
}

interface AlertCondition {
  type: 'threshold' | 'absence' | 'change' | 'error_rate';
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number;
  for?: string;  // 持续时间
}

interface AlertAction {
  type: 'notification' | 'webhook' | 'runbook' | 'auto_action';
  config: Record<string, unknown>;
}

// 预定义告警规则
const ALERT_RULES: AlertRule[] = [
  // === LLM 告警 ===
  {
    id: 'llm-high-latency',
    name: 'LLM 高延迟',
    description: 'LLM 请求 P99 延迟超过 60 秒',
    severity: AlertSeverity.HIGH,
    enabled: true,
    conditions: [{
      type: 'threshold',
      metric: 'histogram_quantile(0.99, rate(pf_llm_duration_seconds_bucket[5m]))',
      operator: '>',
      value: 60,
      for: '5m',
    }],
    annotations: {
      summary: 'LLM 请求延迟过高',
      description: 'LLM 请求 P99 延迟超过 60 秒，可能影响用户体验',
      runbookUrl: 'https://wiki.projectfactory.io/runbooks/llm-latency',
    },
    labels: { team: 'platform', service: 'llm' },
    actions: [
      { type: 'notification', config: { channel: '#alerts-platform' } },
    ],
  },

  {
    id: 'llm-error-rate',
    name: 'LLM 错误率过高',
    description: 'LLM 请求错误率超过 5%',
    severity: AlertSeverity.CRITICAL,
    enabled: true,
    conditions: [{
      type: 'threshold',
      metric: 'rate(pf_llm_errors_total[5m]) / rate(pf_llm_requests_total[5m])',
      operator: '>',
      value: 0.05,
      for: '5m',
    }],
    annotations: {
      summary: 'LLM 错误率过高',
      description: '5 分钟内 LLM 错误率超过 5%，需要立即调查',
      runbookUrl: 'https://wiki.projectfactory.io/runbooks/llm-errors',
      dashboardUrl: 'https://grafana.projectfactory.io/d/llm-metrics',
    },
    labels: { team: 'platform', service: 'llm' },
    actions: [
      { type: 'notification', config: { channel: '#alerts-critical' } },
      { type: 'webhook', config: { url: '/api/incidents/create' } },
    ],
  },

  {
    id: 'llm-rate-limit',
    name: 'LLM 限流频繁',
    description: 'LLM API 限流发生频率过高',
    severity: AlertSeverity.MEDIUM,
    enabled: true,
    conditions: [{
      type: 'threshold',
      metric: 'increase(pf_llm_rate_limit_hits_total[15m])',
      operator: '>',
      value: 20,
    }],
    annotations: {
      summary: 'LLM API 限流频繁',
      description: '15 分钟内限流发生超过 20 次',
      runbookUrl: 'https://wiki.projectfactory.io/runbooks/llm-rate-limit',
    },
    labels: { team: 'platform', service: 'llm' },
    actions: [
      { type: 'notification', config: { channel: '#alerts-platform' } },
    ],
  },

  // === 项目生成告警 ===
  {
    id: 'project-failure-rate',
    name: '项目失败率过高',
    description: '项目生成失败率超过 20%',
    severity: AlertSeverity.HIGH,
    enabled: true,
    conditions: [{
      type: 'threshold',
      metric: 'increase(pf_projects_total{status="failed"}[1h]) / increase(pf_projects_total[1h])',
      operator: '>',
      value: 0.2,
      for: '30m',
    }],
    annotations: {
      summary: '项目生成失败率过高',
      description: '项目生成失败率超过 20%，需要检查代码生成流程',
      runbookUrl: 'https://wiki.projectfactory.io/runbooks/project-failures',
    },
    labels: { team: 'product', service: 'generator' },
    actions: [
      { type: 'notification', config: { channel: '#alerts-product' } },
      { type: 'runbook', config: { url: '/runbooks/project-failures' } },
    ],
  },

  {
    id: 'project-quality-low',
    name: '项目质量下降',
    description: '最近项目的平均质量评分低于 60',
    severity: AlertSeverity.MEDIUM,
    enabled: true,
    conditions: [{
      type: 'threshold',
      metric: 'avg(pf_quality_score)',
      operator: '<',
      value: 60,
      for: '1h',
    }],
    annotations: {
      summary: '项目质量评分下降',
      description: '最近 1 小时内项目的平均质量评分低于 60',
      runbookUrl: 'https://wiki.projectfactory.io/runbooks/quality-degradation',
    },
    labels: { team: 'product', service: 'quality' },
    actions: [
      { type: 'notification', config: { channel: '#alerts-product' } },
    ],
  },

  // === 系统告警 ===
  {
    id: 'api-error-rate',
    name: 'API 错误率过高',
    description: 'HTTP 5xx 错误率超过 1%',
    severity: AlertSeverity.CRITICAL,
    enabled: true,
    conditions: [{
      type: 'threshold',
      metric: 'rate(pf_http_requests_total{status=~"5.."}[5m]) / rate(pf_http_requests_total[5m])',
      operator: '>',
      value: 0.01,
      for: '5m',
    }],
    annotations: {
      summary: 'API 错误率过高',
      description: 'API 5xx 错误率超过 1%，可能影响所有用户',
      runbookUrl: 'https://wiki.projectfactory.io/runbooks/api-errors',
      dashboardUrl: 'https://grafana.projectfactory.io/d/api-metrics',
    },
    labels: { team: 'platform', service: 'api' },
    actions: [
      { type: 'notification', config: { channel: '#alerts-critical' } },
      { type: 'webhook', config: { url: '/api/incidents/create' } },
    ],
  },

  {
    id: 'api-latency-high',
    name: 'API 延迟过高',
    description: 'API P99 延迟超过 2 秒',
    severity: AlertSeverity.HIGH,
    enabled: true,
    conditions: [{
      type: 'threshold',
      metric: 'histogram_quantile(0.99, rate(pf_http_request_duration_seconds_bucket[5m]))',
      operator: '>',
      value: 2,
      for: '10m',
    }],
    annotations: {
      summary: 'API P99 延迟过高',
      description: 'API P99 延迟超过 2 秒',
      runbookUrl: 'https://wiki.projectfactory.io/runbooks/api-latency',
    },
    labels: { team: 'platform', service: 'api' },
    actions: [
      { type: 'notification', config: { channel: '#alerts-platform' } },
    ],
  },

  {
    id: 'database-slow-queries',
    name: '数据库慢查询',
    description: '数据库查询 P99 延迟超过 500ms',
    severity: AlertSeverity.MEDIUM,
    enabled: true,
    conditions: [{
      type: 'threshold',
      metric: 'histogram_quantile(0.99, rate(pf_db_query_duration_seconds_bucket[5m]))',
      operator: '>',
      value: 0.5,
      for: '5m',
    }],
    annotations: {
      summary: '数据库慢查询',
      description: '数据库查询 P99 延迟超过 500ms',
      runbookUrl: 'https://wiki.projectfactory.io/runbooks/database-performance',
    },
    labels: { team: 'platform', service: 'database' },
    actions: [
      { type: 'notification', config: { channel: '#alerts-platform' } },
    ],
  },

  // === 可用性告警 ===
  {
    id: 'service-down',
    name: '服务不可用',
    description: '服务健康检查连续失败',
    severity: AlertSeverity.CRITICAL,
    enabled: true,
    conditions: [{
      type: 'absence',
      metric: 'up{job="backend"}',
      operator: '==',
      value: 0,
      for: '1m',
    }],
    annotations: {
      summary: 'Backend 服务不可用',
      description: 'Backend 服务健康检查连续失败超过 1 分钟',
      runbookUrl: 'https://wiki.projectfactory.io/runbooks/service-down',
      dashboardUrl: 'https://grafana.projectfactory.io/d/service-health',
    },
    labels: { team: 'platform', service: 'infrastructure' },
    actions: [
      { type: 'notification', config: { channel: '#alerts-critical' } },
      { type: 'webhook', config: { url: '/api/incidents/create' } },
      { type: 'auto_action', config: { action: 'scale_up' } },
    ],
  },
];
```

### 3.2 告警管理器

```typescript
// src/monitoring/alerts/manager.ts
class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, ActiveAlert> = new Map();
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.loadRules();
  }

  private loadRules() {
    for (const rule of ALERT_RULES) {
      this.rules.set(rule.id, rule);
    }
  }

  // 评估告警规则
  async evaluate(): Promise<Alert[]> {
    const alerts: Alert[] = [];

    for (const [id, rule] of this.rules) {
      if (!rule.enabled) continue;

      const isTriggered = await this.checkConditions(rule);

      if (isTriggered && !this.activeAlerts.has(id)) {
        // 新触发的告警
        const alert = this.createAlert(rule);
        this.activeAlerts.set(id, alert);
        await this.fireAlert(alert);
        alerts.push(alert);
      } else if (!isTriggered && this.activeAlerts.has(id)) {
        // 告警恢复
        await this.resolveAlert(id);
      }
    }

    return alerts;
  }

  private async checkConditions(rule: AlertRule): Promise<boolean> {
    // PromQL 查询示例
    for (const condition of rule.conditions) {
      const query = this.buildPromQL(condition);
      const result = await prometheus.query(query);

      if (!this.evaluateCondition(result, condition)) {
        return false;
      }
    }
    return true;
  }

  private buildPromQL(condition: AlertCondition): string {
    // 简化实现
    return condition.metric;
  }

  private evaluateCondition(result: QueryResult, condition: AlertCondition): boolean {
    const value = result.value;

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

  private createAlert(rule: AlertRule): ActiveAlert {
    return {
      id: `alert_${rule.id}_${Date.now()}`,
      rule,
      status: 'firing',
      firedAt: Date.now(),
      labels: rule.labels,
      annotations: rule.annotations,
    };
  }

  private async fireAlert(alert: ActiveAlert) {
    console.log(`[ALERT] ${alert.rule.name} - ${alert.annotations.summary}`);

    for (const action of alert.rule.actions) {
      await this.executeAction(action, alert);
    }

    // 发送事件
    await this.eventBus.publish({
      type: 'alert.fired',
      payload: alert,
    });
  }

  private async executeAction(action: AlertAction, alert: ActiveAlert) {
    switch (action.type) {
      case 'notification':
        await this.sendNotification(action.config as NotificationConfig, alert);
        break;
      case 'webhook':
        await this.callWebhook(action.config as WebhookConfig, alert);
        break;
      case 'runbook':
        // 记录 runbook 链接
        break;
      case 'auto_action':
        await this.executeAutoAction(action.config, alert);
        break;
    }
  }

  private async sendNotification(config: NotificationConfig, alert: ActiveAlert) {
    const { channel } = config;
    const message = this.formatSlackMessage(alert);
    await slackClient.send(channel, message);
  }

  private formatSlackMessage(alert: ActiveAlert): object {
    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `[${alert.rule.severity.toUpperCase()}] ${alert.rule.name}`,
          },
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: alert.annotations.summary },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Severity:*\n${alert.rule.severity}` },
            { type: 'mrkdwn', text: `*Fired At:*\n${new Date(alert.firedAt).toISOString()}` },
          ],
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View Runbook' },
              url: alert.annotations.runbookUrl,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View Dashboard' },
              url: alert.annotations.dashboardUrl,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Acknowledge' },
              action_id: 'acknowledge',
              value: alert.id,
            },
          ],
        },
      ],
    };
  }

  private async resolveAlert(alertId: string) {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return;

    alert.status = 'resolved';
    alert.resolvedAt = Date.now();

    console.log(`[ALERT] ${alert.rule.name} resolved`);

    // 发送恢复通知
    await slackClient.send('#alerts', {
      text: `:white_check_mark: [RESOLVED] ${alert.rule.name}`,
    });

    this.activeAlerts.delete(alertId);

    await this.eventBus.publish({
      type: 'alert.resolved',
      payload: alert,
    });
  }
}
```

---

## 4. Dashboard 设计

### 4.1 主要 Dashboard

```typescript
// grafana/dashboards/project-factory-overview.json
const DASHBOARD_CONFIG = {
  title: 'ProjectFactory Overview',
  tags: ['project-factory', 'overview'],
  timezone: 'browser',
  refresh: '30s',
  panels: [
    // 概览
    {
      title: 'Active Projects',
      type: 'stat',
      gridPos: { x: 0, y: 0, w: 6, h: 4 },
      targets: [{
        expr: 'sum(pf_active_iterations)',
        legendFormat: 'Active',
      }],
      options: {
        colorMode: 'value',
        graphMode: 'area',
      },
      fieldConfig: {
        defaults: {
          unit: 'short',
          thresholds: {
            steps: [
              { value: 0, color: 'green' },
              { value: 50, color: 'yellow' },
              { value: 100, color: 'red' },
            ],
          },
        },
      },
    },
    {
      title: 'Projects Created (24h)',
      type: 'stat',
      gridPos: { x: 6, y: 0, w: 6, h: 4 },
      targets: [{
        expr: 'increase(pf_projects_total[24h])',
        legendFormat: 'Created',
      }],
    },
    {
      title: 'Average Quality Score',
      type: 'gauge',
      gridPos: { x: 12, y: 0, w: 6, h: 4 },
      targets: [{
        expr: 'avg(pf_quality_score)',
        legendFormat: 'Avg Score',
      }],
      fieldConfig: {
        defaults: {
          min: 0,
          max: 100,
          unit: 'percent',
          thresholds: {
            steps: [
              { value: 0, color: 'red' },
              { value: 60, color: 'yellow' },
              { value: 80, color: 'green' },
            ],
          },
        },
      },
    },

    // LLM Metrics
    {
      title: 'LLM Request Latency (P50/P95/P99)',
      type: 'graph',
      gridPos: { x: 0, y: 4, w: 12, h: 8 },
      targets: [
        {
          expr: 'histogram_quantile(0.50, rate(pf_llm_duration_seconds_bucket[5m]))',
          legendFormat: 'P50',
        },
        {
          expr: 'histogram_quantile(0.95, rate(pf_llm_duration_seconds_bucket[5m]))',
          legendFormat: 'P95',
        },
        {
          expr: 'histogram_quantile(0.99, rate(pf_llm_duration_seconds_bucket[5m]))',
          legendFormat: 'P99',
        },
      ],
    },
    {
      title: 'LLM Token Usage (24h)',
      type: 'graph',
      gridPos: { x: 12, y: 4, w: 12, h: 8 },
      targets: [
        {
          expr: 'increase(pf_llm_tokens_total{type="input"}[24h])',
          legendFormat: 'Input',
        },
        {
          expr: 'increase(pf_llm_tokens_total{type="output"}[24h])',
          legendFormat: 'Output',
        },
      ],
      stack: true,
    },

    // API Metrics
    {
      title: 'Request Rate',
      type: 'graph',
      gridPos: { x: 0, y: 12, w: 8, h: 8 },
      targets: [{
        expr: 'rate(pf_http_requests_total[5m])',
        legendFormat: '{{method}} {{path}}',
      }],
    },
    {
      title: 'Error Rate',
      type: 'graph',
      gridPos: { x: 8, y: 12, w: 8, h: 8 },
      targets: [{
        expr: 'rate(pf_http_requests_total{status=~"5.."}[5m]) / rate(pf_http_requests_total[5m])',
        legendFormat: '5xx Error Rate',
      }],
    },
    {
      title: 'P99 Latency',
      type: 'graph',
      gridPos: { x: 16, y: 12, w: 8, h: 8 },
      targets: [{
        expr: 'histogram_quantile(0.99, rate(pf_http_request_duration_seconds_bucket[5m]))',
        legendFormat: 'P99',
      }],
    },

    // 生成管道状态
    {
      title: 'Project Generation Pipeline',
      type: 'bargauge',
      gridPos: { x: 0, y: 20, w: 24, h: 8 },
      targets: [{
        expr: 'sum by (stage) (pf_active_iterations)',
        legendFormat: '{{stage}}',
      }],
      options: {
        displayMode: 'gradient',
        orientation: 'horizontal',
      },
    },
  ],
};
```

---

## 5. SLA/SLO 监控

### 5.1 SLO 定义

```typescript
// src/monitoring/slo.ts
interface SLO {
  id: string;
  name: string;
  target: number;  // 目标值 (如 0.999)
  window: string;  // 时间窗口 (如 30d)
  sli: SLIDefinition;
  errorBudgetPolicy: ErrorBudgetPolicy;
}

interface SLIDefinition {
  type: 'availability' | 'latency' | 'quality';
  query: string;
  threshold?: number;
}

interface ErrorBudgetPolicy {
  burnRateThreshold: number;
  alertSeverity: AlertSeverity;
}

const SERVICE_SLOS: SLO[] = [
  {
    id: 'api-availability',
    name: 'API 可用性',
    target: 0.999,
    window: '30d',
    sli: {
      type: 'availability',
      query: '1 - (sum(rate(pf_http_requests_total{status=~"5.."}[5m])) / sum(rate(pf_http_requests_total[5m])))',
    },
    errorBudgetPolicy: {
      burnRateThreshold: 14.4,  // 1% 消耗率
      alertSeverity: AlertSeverity.CRITICAL,
    },
  },
  {
    id: 'api-latency',
    name: 'API 延迟',
    target: 0.99,
    window: '30d',
    sli: {
      type: 'latency',
      query: 'histogram_quantile(0.99, rate(pf_http_request_duration_seconds_bucket[5m]))',
      threshold: 2,  // 2 秒
    },
    errorBudgetPolicy: {
      burnRateThreshold: 14.4,
      alertSeverity: AlertSeverity.HIGH,
    },
  },
  {
    id: 'llm-latency',
    name: 'LLM 延迟',
    target: 0.95,
    window: '30d',
    sli: {
      type: 'latency',
      query: 'histogram_quantile(0.95, rate(pf_llm_duration_seconds_bucket[5m]))',
      threshold: 30,  // 30 秒
    },
    errorBudgetPolicy: {
      burnRateThreshold: 14.4,
      alertSeverity: AlertSeverity.HIGH,
    },
  },
  {
    id: 'project-success-rate',
    name: '项目成功率',
    target: 0.95,
    window: '30d',
    sli: {
      type: 'quality',
      query: 'increase(pf_projects_total{status="completed"}[24h]) / increase(pf_projects_total[24h])',
      threshold: 0.95,
    },
    errorBudgetPolicy: {
      burnRateThreshold: 14.4,
      alertSeverity: AlertSeverity.MEDIUM,
    },
  },
];

// Error Budget 计算
function calculateErrorBudget(slo: SLO, currentValue: number): ErrorBudget {
  const target = slo.target;
  const totalBudget = 1 - target;  // 0.1% for 99.9%

  // 消耗的 budget
  const consumed = Math.max(0, 1 - currentValue);
  const budgetRemaining = totalBudget - consumed;
  const budgetPercentRemaining = (budgetRemaining / totalBudget) * 100;

  // 预计耗尽时间
  const burnRate = consumed / totalBudget;
  const daysUntilExhaustion = burnRate > 0 ? 30 / burnRate : Infinity;

  return {
    slo,
    totalBudget,
    consumed,
    budgetRemaining,
    budgetPercentRemaining,
    currentValue,
    daysUntilExhaustion,
    status: budgetPercentRemaining < 50 ? 'critical' : budgetPercentRemaining < 20 ? 'danger' : 'healthy',
  };
}
```

---

## 6. 相关文档

- [可观测性设计](./OBSERVABILITY.md)
- [性能优化](./PERFORMANCE_OPTIMIZATION.md)
- [部署架构](./DEPLOYMENT_ARCHITECTURE.md)

---

**最后更新**: 2026-04-14
