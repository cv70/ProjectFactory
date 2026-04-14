# 性能基准

## 1. 性能指标

### 1.1 关键指标

| 类别 | 指标 | 目标值 |
|------|------|--------|
| 生成速度 | 项目生成时间 | < 4小时 |
| API性能 | P95响应时间 | < 500ms |
| 并发处理 | 同时进行的项目数 | > 5 |
| 资源利用率 | CPU使用率 | < 80% |
| 数据库性能 | 查询P95 | < 50ms |
| LLM性能 | API延迟 | < 2s |

## 2. 基准测试

### 2.1 生成性能测试

```typescript
// benchmark/generation.ts

export interface GenerationBenchmark {
  projectType: string;
  complexity: 'simple' | 'medium' | 'complex';
  results: GenerationResult[];
  summary: GenerationSummary;
}

export interface GenerationResult {
  attempt: number;
  totalTime: number;
  phaseTimings: Record<string, number>;
  llmCalls: number;
  tokensUsed: number;
  success: boolean;
  qualityScore: number;
}

export class GenerationBenchmarker {
  async benchmark(projectType: string): Promise<GenerationBenchmark> {
    const complexities = ['simple', 'medium', 'complex'];
    const attempts = 5;

    const results: GenerationResult[] = [];

    for (const complexity of complexities) {
      for (let i = 0; i < attempts; i++) {
        const result = await this.runGenerationTest(
          projectType,
          complexity
        );
        results.push(result);
      }
    }

    return {
      projectType,
      results,
      summary: this.calculateSummary(results),
    };
  }

  private async runGenerationTest(
    projectType: string,
    complexity: string
  ): Promise<GenerationResult> {
    const start = Date.now();
    const phaseTimings: Record<string, number> = {};
    const llmCalls: { count: 0, tokens: 0 };

    try {
      // 需求分析
      const reqStart = Date.now();
      await this.metaAgent.executePhase('requirement');
      phaseTimings.requirement = Date.now() - reqStart;
      llmCalls.count += 1;
      llmCalls.tokens += 5000;

      // 架构设计
      const archStart = Date.now();
      await this.metaAgent.executePhase('architecture');
      phaseTimings.architecture = Date.now() - archStart;
      llmCalls.count += 1;
      llmCalls.tokens += 10000;

      // 代码生成
      const devStart = Date.now();
      await this.metaAgent.executePhase('development');
      phaseTimings.development = Date.now() - devStart;
      llmCalls.count += 10;
      llmCalls.tokens += 50000;

      // 质量检查
      const qualStart = Date.now();
      const quality = await this.metaAgent.executePhase('quality');
      phaseTimings.quality = Date.now() - qualStart;
      llmCalls.count += 5;
      llmCalls.tokens += 25000;

      return {
        attempt: 1,
        totalTime: Date.now() - start,
        phaseTimings,
        llmCalls: llmCalls.count,
        tokensUsed: llmCalls.tokens,
        success: true,
        qualityScore: quality.overallScore,
      };

    } catch (error) {
      return {
        attempt: 1,
        totalTime: Date.now() - start,
        phaseTimings,
        llmCalls: llmCalls.count,
        tokensUsed: llmCalls.tokens,
        success: false,
        qualityScore: 0,
      };
    }
  }

  private calculateSummary(results: GenerationResult[]): GenerationSummary {
    const successful = results.filter(r => r.success);

    return {
      totalAttempts: results.length,
      successRate: successful.length / results.length,
      avgTotalTime: this.average(results, r => r.totalTime),
      p95TotalTime: this.percentile(results, 95, r => r.totalTime),
      avgLLMCalls: this.average(results, r => r.llmCalls),
      avgTokensUsed: this.average(results, r => r.tokensUsed),
      avgQualityScore: this.average(successful, r => r.qualityScore),
      phaseBreakdown: {
        requirement: {
          avg: this.average(results, r => r.phaseTimings.requirement || 0),
          pct: this.calculatePercentage(results, r => r.phaseTimings.requirement || 0),
        },
        architecture: {
          avg: this.average(results, r => r.phaseTimings.architecture || 0),
          pct: this.calculatePercentage(results, r => r.phaseTimings.architecture || 0),
        },
        development: {
          avg: this.average(results, r => r.phaseTimings.development || 0),
          pct: this.calculatePercentage(results, r => r.phaseTimings.development || 0),
        },
        quality: {
          avg: this.average(results, r => r.phaseTimings.quality || 0),
          pct: this.calculatePercentage(results, r => r.phaseTimings.quality || 0),
        },
      },
    };
  }
}
```

### 2.2 API性能测试

```typescript
// benchmark/api.ts

export class APIBenchmarker {
  async benchmarkEndpoint(
    endpoint: string,
    options: BenchmarkOptions
  ): Promise<APIBenchmarkResult> {
    const results: RequestResult[] = [];

    // 预热
    await this.warmup(endpoint, options.method);

    // 基准测试
    for (let i = 0; i < options.iterations; i++) {
      const result = await this.makeRequest(endpoint, options);
      results.push(result);
    }

    return {
      endpoint,
      method: options.method,
      iterations: results.length,
      summary: this.calculateAPISummary(results),
    };
  }

  async loadTest(
    endpoint: string,
    config: LoadTestConfig
  ): Promise<LoadTestResult> {
    const concurrency = config.concurrency || 10;
    const duration = config.duration || 60000; // 1分钟

    const promises: Promise<RequestResult>[] = [];

    // 启动并发请求
    for (let i = 0; i < concurrency; i++) {
      const worker = async () => {
        const results: RequestResult[] = [];
        const startTime = Date.now();

        while (Date.now() - startTime < duration) {
          const result = await this.makeRequest(endpoint, config);
          results.push(result);
        }

        return results;
      };

      promises.push(worker());
    }

    // 等待所有worker完成
    const allResults = await Promise.all(promises);
    const flatResults = allResults.flat();

    return {
      endpoint,
      concurrency,
      duration,
      totalRequests: flatResults.length,
      successful: flatResults.filter(r => r.status === 200).length,
      failed: flatResults.filter(r => r.status !== 200).length,
      summary: {
        requestsPerSecond: flatResults.length / (duration / 1000),
        avgLatency: this.average(flatResults, r => r.latency),
        p50Latency: this.percentile(flatResults, 50, r => r.latency),
        p95Latency: this.percentile(flatResults, 95, r => r.latency),
        p99Latency: this.percentile(flatResults, 99, r => r.latency),
        errorRate: (flatResults.filter(r => r.status !== 200).length / flatResults.length) * 100,
      },
    };
  }
}
```

### 2.3 数据库性能测试

```typescript
// benchmark/database.ts

export class DatabaseBenchmarker {
  async benchmarkQueries(queries: QueryBenchmark[]): Promise<DBBenchmarkResult> {
    const results: Map<string, QueryResult[]> = new Map();

    for (const query of queries) {
      const queryResults: QueryResult[] = [];

      for (let i = 0; i < query.iterations; i++) {
        const result = await this.executeQuery(query);
        queryResults.push(result);
      }

      results.set(query.name, queryResults);
    }

    return {
      queries: Array.from(results.entries()).map(([name, res]) => ({
        name,
        results: res,
        summary: this.calculateQuerySummary(res),
      })),
    };
  }

  async benchmarkSchema(schemaSize: number): Promise<SchemaBenchmarkResult> {
    const tables = this.generateTestSchema(schemaSize);

    // 测试INSERT性能
    const insertResult = await this.benchmarkInsert(tables);

    // 测试SELECT性能
    const selectResult = await this.benchmarkSelect(tables);

    // 测试UPDATE性能
    const updateResult = await this.benchmarkUpdate(tables);

    // 测试DELETE性能
    const deleteResult = await this.benchmarkDelete(tables);

    return {
      schemaSize,
      insert: insertResult,
      select: selectResult,
      update: updateResult,
      delete: deleteResult,
    };
  }
}
```

## 3. 性能监控

### 3.1 实时性能跟踪

```typescript
// monitoring/performance/tracker.ts

export class PerformanceTracker {
  private metrics: Map<string, PerformanceMetric> = new Map();

  trackOperation(
    name: string,
    operation: () => Promise<any>
  ): Promise<any> {
    const start = Date.now();

    try {
      const result = await operation();
      const duration = Date.now() - start;

      this.recordMetric(name, {
        duration,
        success: true,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      this.recordMetric(name, {
        duration,
        success: false,
        error: String(error),
      });

      throw error;
    }
  }

  private recordMetric(name: string, data: MetricData): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        name,
        samples: [],
        successCount: 0,
        errorCount: 0,
        totalTime: 0,
      });
    }

    const metric = this.metrics.get(name)!;
    metric.samples.push({ ...data, timestamp: Date.now() });
    metric.totalTime += data.duration;
    data.success ? metric.successCount++ : metric.errorCount++;

    // 保持最近的1000个样本
    if (metric.samples.length > 1000) {
      metric.samples.shift();
    }
  }

  getMetrics(name: string): PerformanceSummary {
    const metric = this.metrics.get(name);
    if (!metric) {
      throw new Error(`Metric not found: ${name}`);
    }

    const durations = metric.samples.map(s => s.duration);

    return {
      name,
      totalCalls: metric.samples.length,
      successRate: metric.successCount / metric.samples.length,
      avgDuration: metric.totalTime / metric.samples.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      p50Duration: this.percentile(durations, 50),
      p95Duration: this.percentile(durations, 95),
      p99Duration: this.percentile(durations, 99),
      errorRate: metric.errorCount / metric.samples.length,
      lastSample: metric.samples[metric.samples.length - 1],
    };
  }

  getAllMetrics(): Map<string, PerformanceSummary> {
    const summaries = new Map<string, PerformanceSummary>();

    for (const [name] of this.metrics.keys()) {
      summaries.set(name, this.getMetrics(name));
    }

    return summaries;
  }

  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }

  private average(values: number[], fn: (v: number) => number): number {
    return values.reduce((sum, v) => sum + fn(v), 0) / values.length;
  }
}
```

### 3.2 性能告警

```typescript
// monitoring/performance/alerts.ts

export interface PerformanceAlert {
  metric: string;
  threshold: Threshold;
  currentValue: number;
  severity: 'info' | 'warning' | 'critical';
  timestamp: Date;
}

export class PerformanceAlertManager {
  private thresholds: Map<string, Threshold[]> = new Map();

  setThresholds(metric: string, thresholds: Threshold[]): void {
    this.thresholds.set(metric, thresholds);
  }

  async checkMetrics(metrics: Map<string, PerformanceSummary>): Promise<PerformanceAlert[]> {
    const alerts: PerformanceAlert[] = [];

    for (const [name, summary] of metrics) {
      const thresholds = this.thresholds.get(name);
      if (!thresholds) continue;

      for (const threshold of thresholds) {
        const currentValue = summary.p95Duration; // 使用P95

        const severity = this.evaluateThreshold(
          currentValue,
          threshold
        );

        if (severity !== 'ok') {
          alerts.push({
            metric: name,
            threshold,
            currentValue,
            severity,
            timestamp: new Date(),
          });
        }
      }
    }

    return alerts;
  }

  private evaluateThreshold(
    value: number,
    threshold: Threshold
  ): 'ok' | 'warning' | 'critical' {
    switch (threshold.type) {
      case 'upper':
        if (value > threshold.value) return 'critical';
        if (value > threshold.value * 0.9) return 'warning';
        return 'ok';
      case 'lower':
        if (value < threshold.value) return 'critical';
        if (value < threshold.value * 1.1) return 'warning';
        return 'ok';
      default:
        return 'ok';
    }
  }

  async sendAlert(alert: PerformanceAlert): Promise<void> {
    const message = `[${alert.severity.toUpperCase()}] Performance Alert\n` +
      `Metric: ${alert.metric}\n` +
      `Current: ${alert.currentValue}\n` +
      `Threshold: ${alert.threshold.value}`;

    await alertingService.send({
      level: alert.severity === 'critical' ? 'error' : 'warning',
      message,
    });
  }
}
```

## 4. 性能优化建议

```typescript
// optimization/performance/advisor.ts

export class PerformanceAdvisor {
  async analyze(metrics: Map<string, PerformanceSummary>): Promise<OptimizationAdvice[]> {
    const advice: OptimizationAdvice[] = [];

    // 分析每个指标
    for (const [name, summary] of metrics) {
      const metricAdvice = await this.analyzeMetric(name, summary);
      advice.push(...metricAdvice);
    }

    // 优先级排序
    advice.sort((a, b) => this.calculatePriorityScore(b) - this.calculatePriorityScore(a));

    return advice;
  }

  private async analyzeMetric(
    name: string,
    summary: PerformanceSummary
  ): Promise<OptimizationAdvice[]> {
    const advice: OptimizationAdvice[] = [];

    // 1. 检查响应时间
    if (summary.p95Duration > 1000) {
      advice.push({
        type: 'response-time',
        metric: name,
        severity: 'high',
        description: `${name} P95 response time (${summary.p95Duration}ms) exceeds threshold`,
        recommendation: await this.getOptimizationForResponseTime(name, summary),
        expectedImprovement: '30-50%',
      });
    }

    // 2. 检查错误率
    if (summary.errorRate > 0.05) {
      advice.push({
        type: 'error-rate',
        metric: name,
        severity: 'high',
        description: `${name} error rate (${(summary.errorRate * 100).toFixed(2)}%) exceeds threshold`,
        recommendation: 'Review error logs and implement retry logic',
        expectedImprovement: 'Reduce error rate to < 1%',
      });
    }

    // 3. 检查方差
    const durations = this.getRecentSamples(name, 100).map(s => s.duration);
    const variance = this.calculateVariance(durations);

    if (variance > summary.avgDuration * 2) {
      advice.push({
        type: 'variance',
        metric: name,
        severity: 'medium',
        description: `${name} response time is inconsistent (variance: ${variance.toFixed(0)}ms²)`,
        recommendation: 'Investigate performance outliers and implement consistent processing',
        expectedImprovement: 'Reduce variance by 50%',
      });
    }

    return advice;
  }

  private async getOptimizationForResponseTime(
    name: string,
    summary: PerformanceSummary
  ): Promise<string> {
    // 基于指标名称生成优化建议
    const suggestions = {
      'generation-time': 'Consider parallel processing of independent phases, optimize LLM prompt to reduce tokens, or cache frequently used responses',
      'api-response-time': 'Add database indexes, implement query result caching, optimize database queries, or consider read replicas',
      'database-query': 'Review query execution plan, add appropriate indexes, or denormalize data',
      'llm-call': 'Use streaming responses, implement request batching, or switch to faster model',
    };

    return suggestions[name] || 'Review code for optimization opportunities';
  }

  private calculatePriorityScore(advice: OptimizationAdvice): number {
    let score = 0;

    if (advice.severity === 'critical') score += 30;
    else if (advice.severity === 'high') score += 20;
    else if (advice.severity === 'medium') score += 10;

    if (advice.expectedImprovement) {
      const improvement = parseFloat(advice.expectedImprovement);
      score += improvement * 10;
    }

    return score;
  }
}
```

---

**版本**: 0.1.0
**更新日期**: 2026-04-14
**状态**: 设计阶段
