# 监控与运维

## 1. 监控体系

### 1.1 监控层次

```
┌─────────────────────────────────────────────────────────────────┐
│                        业务层监控                                │
│  - 项目生成成功率  - 平均生成时间  - 用户体验                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        应用层监控                                │
│  - API响应时间  - 错误率  - 吞吐量  - 并发数                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Agent层监控                               │
│  - Agent状态  - 执行时间  - 成功率  - 资源使用                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        基础设施监控                              │
│  - CPU/Memory/Disk  - 网络  - 容器  - 数据库                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 指标定义

```typescript
// monitoring/metrics.ts

export interface MetricDefinition {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  description: string;
  labels?: string[];
}

export const metrics: Record<string, MetricDefinition> = {
  // 业务指标
  'project_generation_total': {
    name: 'project_generation_total',
    type: 'counter',
    description: 'Total number of project generations',
    labels: ['type', 'status'],
  },
  'project_generation_duration_seconds': {
    name: 'project_generation_duration_seconds',
    type: 'histogram',
    description: 'Project generation duration in seconds',
    labels: ['type'],
  },
  'generation_success_rate': {
    name: 'generation_success_rate',
    type: 'gauge',
    description: 'Success rate of project generations',
    labels: ['type'],
  },

  // API指标
  'http_requests_total': {
    name: 'http_requests_total',
    type: 'counter',
    description: 'Total number of HTTP requests',
    labels: ['method', 'path', 'status'],
  },
  'http_request_duration_seconds': {
    name: 'http_request_duration_seconds',
    type: 'histogram',
    description: 'HTTP request duration in seconds',
    labels: ['method', 'path'],
  },
  'http_requests_in_progress': {
    name: 'http_requests_in_progress',
    type: 'gauge',
    description: 'Number of HTTP requests in progress',
    labels: ['method', 'path'],
  },

  // Agent指标
  'agent_execution_total': {
    name: 'agent_execution_total',
    type: 'counter',
    description: 'Total number of agent executions',
    labels: ['agent_name', 'phase', 'status'],
  },
  'agent_execution_duration_seconds': {
    name: 'agent_execution_duration_seconds',
    type: 'histogram',
    description: 'Agent execution duration in seconds',
    labels: ['agent_name', 'phase'],
  },
  'llm_requests_total': {
    name: 'llm_requests_total',
    type: 'counter',
    description: 'Total number of LLM requests',
    labels: ['model', 'agent'],
  },
  'llm_tokens_total': {
    name: 'llm_tokens_total',
    type: 'counter',
    description: 'Total number of LLM tokens',
    labels: ['model', 'type'],
  },

  // 资源指标
  'system_cpu_usage_percent': {
    name: 'system_cpu_usage_percent',
    type: 'gauge',
    description: 'System CPU usage percentage',
  },
  'system_memory_usage_bytes': {
    name: 'system_memory_usage_bytes',
    type: 'gauge',
    description: 'System memory usage in bytes',
  },
  'system_disk_usage_bytes': {
    name: 'system_disk_usage_bytes',
    type: 'gauge',
    description: 'System disk usage in bytes',
    labels: ['mount'],
  },

  // 数据库指标
  'db_queries_total': {
    name: 'db_queries_total',
    type: 'counter',
    description: 'Total number of database queries',
    labels: ['operation', 'table'],
  },
  'db_query_duration_seconds': {
    name: 'db_query_duration_seconds',
    type: 'histogram',
    description: 'Database query duration in seconds',
    labels: ['operation', 'table'],
  },
  'db_connections_active': {
    name: 'db_connections_active',
    type: 'gauge',
    description: 'Number of active database connections',
  },
};
```

## 2. 指标收集

### 2.1 Prometheus集成

```typescript
// monitoring/prometheus.ts

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

export class PrometheusMetrics {
  private registry: Registry;

  constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({ register: this.registry });
  }

  // 计数器
  createCounter(name: string, help: string): Counter<string> {
    return new Counter({
      name,
      help,
      registers: [this.registry],
    });
  }

  // 直方图
  createHistogram(name: string, help: string, buckets?: number[]): Histogram<string> {
    return new Histogram({
      name,
      help,
      buckets,
      registers: [this.registry],
    });
  }

  // 仪表盘
  createGauge(name: string, help: string): Gauge<string> {
    return new Gauge({
      name,
      help,
      registers: [this.registry],
    });
  }

  // 获取指标
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  // 获取特定指标
  async getMetric(name: string): Promise<string> {
    const metric = this.registry.getSingleMetric(name);
    return metric ? metric.collect().toString() : '';
  }
}

// 使用示例
const prometheus = new PrometheusMetrics();

const httpRequestsTotal = prometheus.createCounter(
  'http_requests_total',
  'Total HTTP requests'
);

const httpRequestDuration = prometheus.createHistogram(
  'http_request_duration_seconds',
  'HTTP request duration',
  [0.1, 0.5, 1, 2, 5]
);

// 中间件
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestsTotal.labels(
      req.method,
      req.path,
      res.statusCode.toString()
    ).inc();
    httpRequestDuration.labels(req.method, req.path).observe(duration);
  });

  next();
}
```

### 2.2 系统指标收集

```typescript
// monitoring/system.ts

import * as os from 'os';
import * as fs from 'fs/promises';

export class SystemMetricsCollector {
  async collect(): Promise<SystemMetrics> {
    return {
      cpu: await this.getCpuUsage(),
      memory: await this.getMemoryUsage(),
      disk: await this.getDiskUsage(),
      network: await this.getNetworkStats(),
      uptime: os.uptime(),
    };
  }

  private async getCpuUsage(): Promise<CpuMetrics> {
    const cpus = os.cpus();
    const total = cpus.length;

    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
    cpus.forEach(cpu => {
      user += cpu.times.user;
      nice += cpu.times.nice;
      sys += cpu.times.sys;
      idle += cpu.times.idle;
      irq += cpu.times.irq;
    });

    const totalCpu = user + nice + sys + idle + irq;
    const usage = ((totalCpu - idle) / totalCpu) * 100;

    return {
      total,
      usage: Math.round(usage * 100) / 100,
      loadAverage: os.loadavg(),
    };
  }

  private async getMemoryUsage(): Promise<MemoryMetrics> {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;

    return {
      total,
      used,
      free,
      usagePercent: Math.round((used / total) * 100 * 100) / 100,
    };
  }

  private async getDiskUsage(): Promise<DiskMetrics> {
    const stats = await fs.stat('/');

    // 这里简化处理，实际应使用系统命令获取磁盘使用率
    return {
      total: stats.size,
      used: 0,
      free: 0,
      usagePercent: 0,
    };
  }

  private async getNetworkStats(): Promise<NetworkMetrics> {
    const interfaces = os.networkInterfaces();

    let inbound = 0, outbound = 0;

    Object.values(interfaces).forEach(iface => {
      iface?.forEach(addr => {
        if (addr.family === 'IPv4') {
          // 简化处理，实际需要获取实时网络统计
        }
      });
    });

    return { inbound, outbound };
  }
}

export interface SystemMetrics {
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  network: NetworkMetrics;
  uptime: number;
}

export interface CpuMetrics {
  total: number;
  usage: number;
  loadAverage: number[];
}

export interface MemoryMetrics {
  total: number;
  used: number;
  free: number;
  usagePercent: number;
}

export interface DiskMetrics {
  total: number;
  used: number;
  free: number;
  usagePercent: number;
}

export interface NetworkMetrics {
  inbound: number;  // bytes/sec
  outbound: number; // bytes/sec
}
```

## 3. 日志管理

### 3.1 日志结构

```typescript
// logging/logger.ts

import winston from 'winston';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: {
    projectId?: string;
    userId?: string;
    agent?: string;
    phase?: string;
  };
  data?: Record<string, unknown>;
  error?: Error;
}

export class Logger {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
              return `${timestamp} [${level}]: ${message} ${metaStr}`;
            })
          ),
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
        }),
      ],
    });
  }

  info(message: string, context?: LogEntry['context'], data?: LogEntry['data']): void {
    this.logger.info(message, { context, data });
  }

  warn(message: string, context?: LogEntry['context'], data?: LogEntry['data']): void {
    this.logger.warn(message, { context, data });
  }

  error(message: string, error?: Error, context?: LogEntry['context'], data?: LogEntry['data']): void {
    this.logger.error(message, { error, context, data });
  }

  debug(message: string, context?: LogEntry['context'], data?: LogEntry['data']): void {
    this.logger.debug(message, { context, data });
  }
}

export const logger = new Logger();
```

### 3.2 结构化日志

```typescript
// logging/structured.ts

export class StructuredLogger {
  constructor(private projectId: string) {}

  logAgentStart(agent: string, phase: string) {
    logger.info('Agent started', {
      context: { projectId: this.projectId, agent, phase },
      data: { timestamp: new Date() },
    });
  }

  logAgentComplete(agent: string, phase: string, duration: number) {
    logger.info('Agent completed', {
      context: { projectId: this.projectId, agent, phase },
      data: { duration, timestamp: new Date() },
    });
  }

  logLLMCall(model: string, promptTokens: number, completionTokens: number, cost: number) {
    logger.info('LLM call completed', {
      context: { projectId: this.projectId },
      data: {
        model,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        cost,
        timestamp: new Date(),
      },
    });
  }

  logError(error: Error, phase?: string) {
    logger.error('Error occurred', error, {
      context: { projectId: this.projectId, phase },
      data: { timestamp: new Date() },
    });
  }

  logCodeGeneration(filesGenerated: number, linesGenerated: number) {
    logger.info('Code generated', {
      context: { projectId: this.projectId },
      data: {
        filesGenerated,
        linesGenerated,
        timestamp: new Date(),
      },
    });
  }
}
```

## 4. 告警管理

### 4.1 告警规则

```typescript
// monitoring/alerts.ts

export interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: Metrics) => boolean;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  actions?: AlertAction[];
  cooldown: number; // seconds
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'slack';
  config: Record<string, unknown>;
}

export const alertRules: AlertRule[] = [
  // 系统资源告警
  {
    id: 'cpu-high',
    name: 'High CPU Usage',
    condition: (m) => m.cpu.usage > 80,
    severity: 'warning',
    message: 'CPU usage is above 80%',
    cooldown: 300,
  },
  {
    id: 'cpu-critical',
    name: 'Critical CPU Usage',
    condition: (m) => m.cpu.usage > 90,
    severity: 'critical',
    message: 'CPU usage is above 90%',
    cooldown: 300,
  },
  {
    id: 'memory-high',
    name: 'High Memory Usage',
    condition: (m) => m.memory.usagePercent > 80,
    severity: 'warning',
    message: 'Memory usage is above 80%',
    cooldown: 300,
  },
  {
    id: 'disk-full',
    name: 'Disk Almost Full',
    condition: (m) => m.disk.usagePercent > 85,
    severity: 'critical',
    message: 'Disk usage is above 85%',
    cooldown: 600,
  },

  // 应用告警
  {
    id: 'high-error-rate',
    name: 'High Error Rate',
    condition: (m) => m.http.errorRate > 0.05,
    severity: 'error',
    message: 'Error rate is above 5%',
    cooldown: 60,
  },
  {
    id: 'slow-response',
    name: 'Slow API Response',
    condition: (m) => m.http.p95ResponseTime > 1000,
    severity: 'warning',
    message: 'P95 response time is above 1s',
    cooldown: 120,
  },

  // Agent告警
  {
    id: 'agent-failure',
    name: 'Agent Failure',
    condition: (m) => m.agent.failureRate > 0.3,
    severity: 'error',
    message: 'Agent failure rate is above 30%',
    cooldown: 180,
  },
  {
    id: 'llm-timeout',
    name: 'LLM Timeout',
    condition: (m) => m.llm.timeoutRate > 0.1,
    severity: 'warning',
    message: 'LLM timeout rate is above 10%',
    cooldown: 300,
  },
];
```

### 4.2 告警管理器

```typescript
// monitoring/alert-manager.ts

export class AlertManager {
  private rules: AlertRule[];
  private activeAlerts: Map<string, Alert> = new Map();
  private cooldowns: Map<string, number> = new Map();

  constructor(rules: AlertRule[]) {
    this.rules = rules;
  }

  async evaluate(metrics: Metrics): Promise<Alert[]> {
    const newAlerts: Alert[] = [];

    for (const rule of this.rules) {
      if (this.isInCooldown(rule.id)) continue;

      if (rule.condition(metrics)) {
        const alert: Alert = {
          id: this.generateAlertId(rule.id),
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          message: rule.message,
          triggeredAt: new Date(),
          metrics: this.extractRelevantMetrics(rule, metrics),
        };

        newAlerts.push(alert);
        this.activeAlerts.set(rule.id, alert);
        this.setCooldown(rule.id, rule.cooldown);

        await this.sendNotification(alert, rule.actions);
      } else if (this.activeAlerts.has(rule.id)) {
        // 告警恢复
        await this.alertRecovered(rule.id);
      }
    }

    return newAlerts;
  }

  private isInCooldown(ruleId: string): boolean {
    const cooldownEnd = this.cooldowns.get(ruleId);
    return cooldownEnd ? Date.now() < cooldownEnd : false;
  }

  private setCooldown(ruleId: string, duration: number): void {
    this.cooldowns.set(ruleId, Date.now() + duration * 1000);
  }

  private async sendNotification(alert: Alert, actions?: AlertAction[]): Promise<void> {
    if (!actions) return;

    for (const action of actions) {
      switch (action.type) {
        case 'webhook':
          await this.sendWebhook(alert, action.config);
          break;
        case 'email':
          await this.sendEmail(alert, action.config);
          break;
        case 'slack':
          await this.sendSlack(alert, action.config);
          break;
      }
    }
  }

  private async alertRecovered(ruleId: string): Promise<void> {
    const alert = this.activeAlerts.get(ruleId);
    if (!alert) return;

    logger.info(`Alert recovered: ${alert.ruleName}`, {
      context: { alertId: alert.id },
      data: {
        triggeredAt: alert.triggeredAt,
        recoveredAt: new Date(),
      },
    });

    this.activeAlerts.delete(ruleId);
  }

  private generateAlertId(ruleId: string): string {
    return `${ruleId}-${Date.now()}`;
  }

  private extractRelevantMetrics(rule: AlertRule, metrics: Metrics): Record<string, unknown> {
    // 根据规则提取相关指标
    return {};
  }

  private async sendWebhook(alert: Alert, config: Record<string, unknown>): Promise<void> {
    // 实现webhook发送
  }

  private async sendEmail(alert: Alert, config: Record<string, unknown>): Promise<void> {
    // 实现邮件发送
  }

  private async sendSlack(alert: Alert, config: Record<string, unknown>): Promise<void> {
    // 实现Slack通知
  }
}
```

## 5. 健康检查

```typescript
// monitoring/health.ts

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  output?: string;
  observedValue?: unknown;
  observedUnit?: string;
  affectedEndpoints?: string[];
}

export interface HealthReport {
  status: 'pass' | 'fail' | 'warn';
  timestamp: string;
  checks: Record<string, HealthCheck>;
}

export class HealthChecker {
  private checks: Map<string, () => Promise<HealthCheck>> = new Map();

  register(name: string, check: () => Promise<HealthCheck>): void {
    this.checks.set(name, check);
  }

  async checkAll(): Promise<HealthReport> {
    const checks: Record<string, HealthCheck> = {};
    let overallStatus: 'pass' | 'fail' | 'warn' = 'pass';

    for (const [name, check] of this.checks) {
      try {
        checks[name] = await check();
        if (checks[name].status === 'fail') {
          overallStatus = 'fail';
        } else if (checks[name].status === 'warn' && overallStatus === 'pass') {
          overallStatus = 'warn';
        }
      } catch (error) {
        checks[name] = {
          name,
          status: 'fail',
          output: String(error),
        };
        overallStatus = 'fail';
      }
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}

// 使用示例
const healthChecker = new HealthChecker();

// 数据库检查
healthChecker.register('database', async () => {
  const start = Date.now();
  try {
    await db.query('SELECT 1');
    return {
      name: 'database',
      status: 'pass',
      output: 'Database connection successful',
      observedValue: Date.now() - start,
      observedUnit: 'ms',
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'fail',
      output: String(error),
    };
  }
});

// LLM API检查
healthChecker.register('llm', async () => {
  const start = Date.now();
  try {
    await llm.complete('test');
    return {
      name: 'llm',
      status: 'pass',
      output: 'LLM API responding',
      observedValue: Date.now() - start,
      observedUnit: 'ms',
    };
  } catch (error) {
    return {
      name: 'llm',
      status: 'fail',
      output: String(error),
    };
  }
});

// SQLite检查
healthChecker.register('sqlite', async () => {
  try {
    await db.query('SELECT 1');
    return {
      name: 'sqlite',
      status: 'pass',
      output: 'SQLite connection successful',
    };
  } catch (error) {
    return {
      name: 'sqlite',
      status: 'fail',
      output: String(error),
    };
  }
});
```

---

**版本**: 0.1.0
**更新日期**: 2026-04-14
**状态**: 设计阶段
