# 批处理系统设计

## 1. 概述

本文档描述 ProjectFactory 系统的批处理系统设计，支持大规模数据处理和后台任务调度。

### 1.1 设计目标

| 目标 | 描述 |
|------|------|
| 高吞吐量 | 支持百万级数据处理 |
| 容错性 | 失败自动重试，保证最终一致 |
| 可监控 | 任务进度实时监控 |
| 资源控制 | 避免对在线服务造成影响 |
| 调度灵活 | 支持 Cron 和一次性任务 |

### 1.2 批处理架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          批处理架构                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                      │
│  │   Job       │    │   Job       │    │   Job       │                      │
│  │   Producer  │ →  │   Queue     │ →  │   Worker    │                      │
│  └─────────────┘    └─────────────┘    └─────────────┘                      │
│                                                  ↓                           │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Redis / BullMQ                               │   │
│  │                                                                       │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │   │
│  │  │  jobs   │  │  queues │  │ workers │  │  locks  │                 │   │
│  │  │ (Redis) │  │         │  │         │  │         │                 │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘                 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                       Job Scheduler (Cron)                             │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 任务队列

### 2.1 队列配置

```typescript
// src/batch/queue.ts
import Queue, { QueueEvents, Job } from 'bull';
import { RedisOptions } from 'ioredis';

interface QueueConfig {
  name: string;
  redis: RedisOptions;
  defaultJobOptions?: Queue.JobOptions;
  concurrency?: number;
}

const QUEUE_CONFIGS: Record<string, QueueConfig> = {
  // 代码生成队列
  codeGeneration: {
    name: 'code-generation',
    redis: { host: 'localhost', port: 6379, password: process.env.REDIS_PASSWORD },
    concurrency: 5,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 1000,
    },
  },

  // 测试执行队列
  testExecution: {
    name: 'test-execution',
    redis: { host: 'localhost', port: 6379 },
    concurrency: 10,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'fixed', delay: 3000 },
      removeOnComplete: 200,
      removeOnFail: 500,
    },
  },

  // 数据处理队列
  dataProcessing: {
    name: 'data-processing',
    redis: { host: 'localhost', port: 6379 },
    concurrency: 3,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: 50,
      removeOnFail: 200,
    },
  },

  // 邮件/通知队列
  notifications: {
    name: 'notifications',
    redis: { host: 'localhost', port: 6379 },
    concurrency: 20,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'fixed', delay: 1000 },
      removeOnComplete: 500,
      removeOnFail: 1000,
    },
  },

  // 清理队列 (低优先级)
  cleanup: {
    name: 'cleanup',
    redis: { host: 'localhost', port: 6379 },
    concurrency: 2,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: true,
    },
  },
};

// 创建队列
function createQueue(name: string): Queue {
  const config = QUEUE_CONFIGS[name];
  if (!config) throw new Error(`Unknown queue: ${name}`);

  return new Queue(config.name, {
    redis: config.redis,
    defaultJobOptions: config.defaultJobOptions,
  });
}

export const queues = {
  codeGeneration: createQueue('codeGeneration'),
  testExecution: createQueue('testExecution'),
  dataProcessing: createQueue('dataProcessing'),
  notifications: createQueue('notifications'),
  cleanup: createQueue('cleanup'),
};
```

### 2.2 任务定义

```typescript
// src/batch/jobs/project-jobs.ts
interface GenerateCodeJob {
  projectId: string;
  files: Array<{ path: string; content: string }>;
  options: {
    language: string;
    framework?: string;
    runLint?: boolean;
  };
}

interface RunTestsJob {
  projectId: string;
  testFiles: string[];
  coverage: boolean;
  timeout: number;
}

interface ProcessMetricsJob {
  projectId: string;
  period: 'daily' | 'weekly' | 'monthly';
  metrics: Array<'linesOfCode' | 'testCoverage' | 'qualityScore'>;
}

// 添加任务
async function scheduleCodeGeneration(data: GenerateCodeJob) {
  return queues.codeGeneration.add(data, {
    jobId: `generate:${data.projectId}:${Date.now()}`,
    priority: 1,
    timeout: 300000, // 5 分钟
  });
}

async function scheduleTestExecution(data: RunTestsJob) {
  return queues.testExecution.add(data, {
    jobId: `test:${data.projectId}:${Date.now()}`,
    priority: 2,
    timeout: data.timeout,
  });
}

// 批量添加任务
async function bulkScheduleProjects(projectIds: string[]) {
  const jobs = projectIds.map((id) => ({
    name: 'process-project',
    data: { projectId: id },
    opts: {
      jobId: `process:${id}`,
      priority: 5,
    },
  }));

  return queues.dataProcessing.addBulk(jobs);
}
```

---

## 3. Worker 实现

### 3.1 Worker 处理器

```typescript
// src/batch/workers/code-generation-worker.ts
import { Worker, Job } from 'bull';
import { queues } from '../queue';

const worker = new Worker(
  'code-generation',
  async (job: Job<GenerateCodeJob>) => {
    const { projectId, files, options } = job.data;

    console.log(`Processing code generation for project ${projectId}`);

    // 更新进度
    await job.progress(10);

    // 生成代码
    const generatedFiles = await codeGenerator.generate({
      projectId,
      files,
      language: options.language,
      framework: options.framework,
    });

    await job.progress(50);

    // 保存文件
    await projectRepository.saveFiles(projectId, generatedFiles);

    await job.progress(80);

    // Lint 检查
    if (options.runLint) {
      await linter.check(projectId);
    }

    await job.progress(100);

    return {
      success: true,
      filesGenerated: generatedFiles.length,
      projectId,
    };
  },
  {
    concurrency: queues.codeGeneration.concurrency || 5,
  }
);

// 事件处理
worker.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed:`, result);

  // 清理缓存
  cache.delete(`project:${job.data.projectId}`);

  // 发布完成事件
  eventBus.publish('code-generated', {
    projectId: job.data.projectId,
    result,
  });
});

worker.on('failed', (job, error) => {
  console.error(`Job ${job?.id} failed:`, error);

  // 发送告警
  alertService.send({
    type: 'job_failed',
    jobId: job?.id,
    error: error.message,
    projectId: job?.data.projectId,
  });
});

worker.on('progress', (job, progress) => {
  console.log(`Job ${job.id} progress: ${progress}%`);
});
```

### 3.2 任务处理器模式

```typescript
// src/batch/processors/base-processor.ts
abstract class BaseProcessor<T> {
  abstract readonly queueName: string;
  abstract readonly concurrency: number;

  protected abstract doProcess(job: Job<T>): Promise<void>;

  async process(job: Job<T>): Promise<void> {
    const startTime = Date.now();

    try {
      await this.doProcess(job);

      await this.logSuccess(job, Date.now() - startTime);
    } catch (error) {
      await this.handleError(job, error as Error);
      throw error;
    }
  }

  protected async handleError(job: Job<T>, error: Error): Promise<void> {
    await this.logError(job, error);

    if (job.attemptsMade < job.opts.attempts) {
      // 将在下一次重试
      return;
    }

    // 最终失败
    await this.onFinalFailure(job, error);
  }

  protected abstract logSuccess(job: Job<T>, duration: number): Promise<void>;
  protected abstract logError(job: Job<T>, error: Error): Promise<void>;
  protected abstract onFinalFailure(job: Job<T>, error: Error): Promise<void>;
}

// 具体实现
class ProjectMetricsProcessor extends BaseProcessor<ProcessMetricsJob> {
  readonly queueName = 'data-processing';
  readonly concurrency = 3;

  protected async doProcess(job: Job<ProcessMetricsJob>): Promise<void> {
    const { projectId, period, metrics } = job.data;

    for (const metric of metrics) {
      const value = await this.calculateMetric(projectId, metric);
      await metricsRepository.record(projectId, metric, value, period);
    }
  }

  protected async logSuccess(job: Job<ProcessMetricsJob>, duration: number): Promise<void> {
    await job.log(`Processed metrics in ${duration}ms`);
  }

  protected async logError(job: Job<ProcessMetricsJob>, error: Error): Promise<void> {
    await job.log(`Error: ${error.message}`);
  }

  protected async onFinalFailure(job: Job<ProcessMetricsJob>, error: Error): Promise<void> {
    await alertService.send({
      type: 'metrics_processing_failed',
      projectId: job.data.projectId,
      error: error.message,
    });
  }

  private async calculateMetric(
    projectId: string,
    metric: 'linesOfCode' | 'testCoverage' | 'qualityScore'
  ): Promise<number> {
    // 实现指标计算
    return 0;
  }
}
```

---

## 4. 调度器

### 4.1 Cron 调度

```typescript
// src/batch/scheduler.ts
import cron from 'node-cron';
import { queues } from './queue';

class JobScheduler {
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

  // 每日凌晨清理
  scheduleDailyCleanup() {
    const task = cron.schedule('0 0 * * *', async () => {
      console.log('Running daily cleanup...');

      await queues.cleanup.add('cleanup-old-projects', {
        olderThanDays: 90,
        status: 'archived',
      });

      await queues.cleanup.add('cleanup-orphan-files', {});

      await queues.cleanup.add('cleanup-old-logs', {
        olderThanDays: 30,
      });
    });

    this.scheduledJobs.set('daily-cleanup', task);
  }

  // 每小时处理待处理项目
  scheduleHourlyProcessing() {
    const task = cron.schedule('0 * * * *', async () => {
      console.log('Checking for pending projects...');

      const pendingProjects = await projectRepository.findPending({
        limit: 100,
      });

      for (const project of pendingProjects) {
        await queues.codeGeneration.add('process-project', {
          projectId: project.id,
          priority: project.priority || 5,
        });
      }
    });

    this.scheduledJobs.set('hourly-processing', task);
  }

  // 每5分钟检查失败任务
  scheduleFailedJobRetry() {
    const task = cron.schedule('*/5 * * * *', async () => {
      const failedJobs = await this.getRecentFailedJobs();

      for (const job of failedJobs) {
        if (job.attemptsMade < job.opts.attempts) {
          await job.retry();
        }
      }
    });

    this.scheduledJobs.set('failed-retry', task);
  }

  // 每日汇总报告
  scheduleDailyReport() {
    const task = cron.schedule('0 9 * * *', async () => {
      const report = await this.generateDailyReport();

      await queues.notifications.add('send-email', {
        to: 'team@projectfactory.io',
        subject: 'Daily ProjectFactory Report',
        body: report,
      });
    });

    this.scheduledJobs.set('daily-report', task);
  }

  // 启动所有调度
  startAll() {
    this.scheduleDailyCleanup();
    this.scheduleHourlyProcessing();
    this.scheduleFailedJobRetry();
    this.scheduleDailyReport();

    console.log(`Started ${this.scheduledJobs.size} scheduled jobs`);
  }

  // 停止所有调度
  stopAll() {
    for (const [name, task] of this.scheduledJobs) {
      task.stop();
      console.log(`Stopped scheduled job: ${name}`);
    }
    this.scheduledJobs.clear();
  }
}

export const scheduler = new JobScheduler();
```

### 4.2 延迟任务

```typescript
// src/batch/delayed-jobs.ts

// 延迟执行 (用于重试、退款等)
async function scheduleDelayedAction<T>(
  queueName: string,
  data: T,
  delayMs: number
): Promise<Job> {
  return queues[queueName].add('delayed-action', data, {
    delay: delayMs,
    jobId: `delayed:${Date.now()}:${Math.random()}`,
  });
}

// 定时执行
async function scheduleAtTime<T>(
  queueName: string,
  data: T,
  timestamp: number
): Promise<Job> {
  const delay = timestamp - Date.now();
  if (delay < 0) {
    throw new Error('Cannot schedule job in the past');
  }
  return queues[queueName].add('scheduled-action', data, {
    delay,
  });
}

//  repeatable jobs (按时间间隔重复)
async function scheduleRepeatingJob<T>(
  queueName: string,
  data: T,
  intervalMs: number,
  jobKey: string
): Promise<Job> {
  return queues[queueName].add(data, {
    repeat: {
      every: intervalMs,
    },
    jobId: `repeat:${jobKey}`,
  });
}
```

---

## 5. 监控

### 5.1 队列监控

```typescript
// src/batch/monitoring.ts
interface QueueMetrics {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

class QueueMonitor {
  async getMetrics(): Promise<QueueMetrics[]> {
    const metrics: QueueMetrics[] = [];

    for (const [name, queue] of Object.entries(queues)) {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      metrics.push({
        name,
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused: await queue.isPaused(),
      });
    }

    return metrics;
  }

  async getJobDetails(jobId: string): Promise<Job | null> {
    for (const queue of Object.values(queues)) {
      const job = await queue.getJob(jobId);
      if (job) return job;
    }
    return null;
  }

  // 获取队列健康状态
  async getHealthStatus(): Promise<HealthStatus> {
    const metrics = await this.getMetrics();

    const issues: string[] = [];

    for (const metric of metrics) {
      if (metric.waiting > 1000) {
        issues.push(`${metric.name}: High waiting count (${metric.waiting})`);
      }
      if (metric.failed > 100) {
        issues.push(`${metric.name}: High failure count (${metric.failed})`);
      }
    }

    return {
      healthy: issues.length === 0,
      issues,
      metrics,
    };
  }
}

export const queueMonitor = new QueueMonitor();

// Prometheus 指标
async function collectMetrics() {
  const metrics = await queueMonitor.getMetrics();

  for (const m of metrics) {
    queueMetrics.queueWaiting.labels(m.name).set(m.waiting);
    queueMetrics.queueActive.labels(m.name).set(m.active);
    queueMetrics.queueCompleted.labels(m.name).set(m.completed);
    queueMetrics.queueFailed.labels(m.name).set(m.failed);
  }
}
```

### 5.2 告警规则

```typescript
// src/batch/alerts.ts
const ALERT_RULES: AlertRule[] = [
  {
    name: 'queue-backlog',
    condition: (metrics) => metrics.waiting > 1000,
    severity: 'warning',
    message: (m) => `Queue ${m.name} has ${m.waiting} waiting jobs`,
  },
  {
    name: 'queue-failures',
    condition: (metrics) => metrics.failed > 100,
    severity: 'critical',
    message: (m) => `Queue ${m.name} has ${m.failed} failed jobs`,
  },
  {
    name: 'job-timeout',
    condition: (_, job) => (job?.processedOn && job.finishedOn &&
      job.finishedOn - job.processedOn > 300000), // > 5 min
    severity: 'warning',
    message: (m, j) => `Job ${j?.id} took ${j?.finishedOn! - j?.processedOn!}ms`,
  },
];

// 告警检查
async function checkAlerts() {
  const metrics = await queueMonitor.getMetrics();

  for (const rule of ALERT_RULES) {
    for (const metric of metrics) {
      if (rule.condition(metric)) {
        await alertService.send({
          type: rule.name,
          severity: rule.severity,
          message: rule.message(metric),
          timestamp: Date.now(),
        });
      }
    }
  }
}
```

---

## 6. 分布式锁

### 6.1 任务锁

```typescript
// src/batch/distributed-lock.ts
import Redis from 'ioredis';
import Redlock from 'redlock';

const redis = new Redis();
const redlock = new Redlock([redis], {
  driftFactor: 0.01,
  retryCount: 3,
  retryDelay: 200,
  retryJitter: 200,
});

// 任务锁
async function withJobLock<T>(
  jobId: string,
  fn: () => Promise<T>,
  ttl: number = 60000
): Promise<T> {
  const lock = await redlock.acquire([`job-lock:${jobId}`], ttl);

  try {
    return await fn();
  } finally {
    await lock.release();
  }
}

// 定时任务锁 (防止多实例重复执行)
async function withSchedulerLock(
  taskName: string,
  fn: () => Promise<void>,
  ttl: number = 300000
): Promise<void> {
  const lock = await redlock.acquire([`scheduler-lock:${taskName}`], ttl);

  try {
    await fn();
  } finally {
    await lock.release();
  }
}

// 批量处理锁
async function processWithLock<T>(
  batchId: string,
  itemId: string,
  fn: () => Promise<T>
): Promise<T> {
  return withJobLock(`${batchId}:${itemId}`, fn, 60000);
}
```

---

## 7. 相关文档

- [后端设计](./BACKEND_DESIGN.md)
- [部署架构](./DEPLOYMENT_ARCHITECTURE.md)
- [可观测性设计](./OBSERVABILITY.md)

---

**最后更新**: 2026-04-14
