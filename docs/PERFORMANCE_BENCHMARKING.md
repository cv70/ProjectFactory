# 性能基准测试设计

## 1. 概述

本文档描述 ProjectFactory 系统的性能基准测试设计，建立性能回归检测和优化效果衡量标准。

### 1.1 设计目标

| 目标 | 描述 |
|------|------|
| 可重复性 | 相同条件下结果一致 |
| 全面覆盖 | 覆盖关键路径 |
| 自动化 | 集成到 CI/CD |
| 可视化 | 结果趋势展示 |

### 1.2 测试范围

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         性能测试范围                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   API 延迟      │  │   吞吐量        │  │   并发能力      │         │
│  │   Latency       │  │   Throughput    │  │   Concurrency   │         │
│  │   P50/P95/P99   │  │   RPS           │  │   Max Users     │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   LLM 调用      │  │   数据库查询    │  │   缓存命中     │         │
│  │   Latency       │  │   Latency       │  │   Hit Rate     │         │
│  │   Token Usage   │  │   Queries/sec   │  │   Latency      │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   内存使用      │  │   启动时间     │  │   生成速度     │         │
│  │   Memory       │  │   Startup Time │  │   Gen Speed    │         │
│  │   RSS/Heap    │  │   Cold/Warm    │  │   Lines/sec    │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 测试场景

### 2.1 基准测试定义

```typescript
// benchmarks/scenarios.ts
interface BenchmarkScenario {
  name: string;
  description: string;
  category: 'api' | 'llm' | 'database' | 'generation' | 'system';
 权重: number;  // 在综合评分中的权重
  thresholds: {
    p50: number;  // 毫秒
    p95: number;
    p99: number;
    min: number;
  };
}

const BENCHMARK_SCENARIOS: BenchmarkScenario[] = [
  // API 基准
  {
    name: 'api_list_projects',
    description: '获取项目列表',
    category: 'api',
    weight: 0.1,
    thresholds: { p50: 50, p95: 100, p99: 200, min: 10 },
  },
  {
    name: 'api_get_project',
    description: '获取单个项目',
    category: 'api',
    weight: 0.1,
    thresholds: { p50: 30, p95: 80, p99: 150, min: 5 },
  },
  {
    name: 'api_create_project',
    description: '创建项目',
    category: 'api',
    weight: 0.15,
    thresholds: { p50: 200, p95: 500, p99: 1000, min: 50 },
  },
  {
    name: 'api_start_generation',
    description: '启动项目生成',
    category: 'api',
    weight: 0.15,
    thresholds: { p50: 500, p95: 1000, p99: 2000, min: 100 },
  },

  // LLM 基准
  {
    name: 'llm_code_generation',
    description: '代码生成调用',
    category: 'llm',
    weight: 0.2,
    thresholds: { p50: 5000, p95: 15000, p99: 30000, min: 1000 },
  },
  {
    name: 'llm_quality_review',
    description: '质量审查调用',
    category: 'llm',
    weight: 0.1,
    thresholds: { p50: 3000, p95: 10000, p99: 20000, min: 500 },
  },

  // 数据库基准
  {
    name: 'db_query_projects',
    description: '查询项目列表',
    category: 'database',
    weight: 0.05,
    thresholds: { p50: 10, p95: 50, p99: 100, min: 1 },
  },
  {
    name: 'db_insert_project',
    description: '插入项目记录',
    category: 'database',
    weight: 0.05,
    thresholds: { p50: 20, p95: 50, p99: 100, min: 5 },
  },

  // 生成基准
  {
    name: 'generation_small_project',
    description: '生成小型项目 (10 文件)',
    category: 'generation',
    weight: 0.05,
    thresholds: { p50: 60000, p95: 120000, p99: 180000, min: 30000 },
  },
  {
    name: 'generation_medium_project',
    description: '生成中型项目 (50 文件)',
    category: 'generation',
    weight: 0.03,
    thresholds: { p50: 300000, p95: 600000, p99: 900000, min: 120000 },
  },
  {
    name: 'generation_lines_per_second',
    description: '代码生成速度',
    category: 'generation',
    weight: 0.02,
    thresholds: { p50: 50, p95: 30, p99: 20, min: 10 },  // lines/sec
  },
];
```

### 2.2 测试工具

```typescript
// benchmarks/runner.ts
import autocannon from 'autocannon';
import { Redis } from 'ioredis';

class BenchmarkRunner {
  private redis: Redis;

  constructor() {
    this.redis = new Redis();
  }

  // 运行 API 基准测试
  async runAPIBenchmark(
    url: string,
    scenarios: string[]
  ): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    for (const scenario of scenarios) {
      console.log(`Running API benchmark: ${scenario}`);

      const result = await autocannon({
        url: `${url}/api/v1/${scenario}`,
        connections: 10,
        duration: 30,
        pipelining: 1,
        workers: 4,
      });

      results.push(this.processResult(scenario, result));
    }

    return results;
  }

  // 运行 LLM 基准测试
  async runLLMBenchmark(
    scenario: string,
    iterations: number = 10
  ): Promise<BenchmarkResult> {
    const latencies: number[] = [];
    const tokenUsage = { input: 0, output: 0 };

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();

      const result = await llmClient.generate({
        model: 'gpt-4',
        prompt: this.getLLMPrompt(scenario),
      });

      latencies.push(Date.now() - start);
      tokenUsage.input += result.usage.inputTokens;
      tokenUsage.output += result.usage.outputTokens;
    }

    return {
      scenario,
      latencies,
      percentile: this.calculatePercentiles(latencies),
      tokenUsage,
      timestamp: Date.now(),
    };
  }

  // 运行数据库基准测试
  async runDatabaseBenchmark(
    scenario: string,
    iterations: number = 100
  ): Promise<BenchmarkResult> {
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();

      await this.executeDBScenario(scenario);

      latencies.push(Date.now() - start);
    }

    return {
      scenario,
      latencies,
      percentile: this.calculatePercentiles(latencies),
      timestamp: Date.now(),
    };
  }

  private calculatePercentiles(latencies: number[]): Percentiles {
    const sorted = [...latencies].sort((a, b) => a - b);

    return {
      min: sorted[0],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      max: sorted[sorted.length - 1],
      avg: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    };
  }
}

interface BenchmarkResult {
  scenario: string;
  latencies: number[];
  percentile: Percentiles;
  tokenUsage?: { input: number; output: number };
  timestamp: number;
}

interface Percentiles {
  min: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  avg: number;
}
```

---

## 3. 性能回归

### 3.1 回归检测

```typescript
// benchmarks/regression.ts
interface RegressionResult {
  scenario: string;
  baseline: Percentiles;
  current: Percentiles;
  delta: {
    p50: number;      // 百分比变化
    p95: number;
    p99: number;
  };
  status: 'passed' | 'warning' | 'regression';
  threshold: number;  // 允许的最大变化百分比
}

class RegressionDetector {
  constructor(private baselineStore: BaselineStore) {}

  async detect(
    scenario: string,
    current: Percentiles
  ): Promise<RegressionResult> {
    const baseline = await this.baselineStore.get(scenario);
    const thresholds = this.getThresholds(scenario);

    if (!baseline) {
      // 首次运行，保存为基准
      await this.baselineStore.set(scenario, current);
      return {
        scenario,
        baseline: current,
        current,
        delta: { p50: 0, p95: 0, p99: 0 },
        status: 'passed',
        threshold: thresholds.maxRegression,
      };
    }

    const delta = {
      p50: this.percentChange(baseline.p50, current.p50),
      p95: this.percentChange(baseline.p95, current.p95),
      p99: this.percentChange(baseline.p99, current.p99),
    };

    const maxDelta = Math.max(delta.p50, delta.p95, delta.p99);

    let status: 'passed' | 'warning' | 'regression' = 'passed';
    if (maxDelta > thresholds.maxRegression) {
      status = 'regression';
    } else if (maxDelta > thresholds.warningThreshold) {
      status = 'warning';
    }

    return {
      scenario,
      baseline,
      current,
      delta,
      status,
      threshold: thresholds.maxRegression,
    };
  }

  private percentChange(baseline: number, current: number): number {
    if (baseline === 0) return 0;
    return ((current - baseline) / baseline) * 100;
  }
}

// 基准存储
class BaselineStore {
  private redis: Redis;

  async get(scenario: string): Promise<Percentiles | null> {
    const data = await this.redis.get(`benchmark:baseline:${scenario}`);
    return data ? JSON.parse(data) : null;
  }

  async set(scenario: string, baseline: Percentiles): Promise<void> {
    await this.redis.set(
      `benchmark:baseline:${scenario}`,
      JSON.stringify(baseline)
    );
  }
}
```

### 3.2 性能评分

```typescript
// benchmarks/score.ts
interface PerformanceScore {
  overall: number;           // 0-100
  letterGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  scenarios: ScenarioScore[];
  timestamp: number;
}

interface ScenarioScore {
  scenario: string;
  baseline: Percentiles;
  current: Percentiles;
  score: number;             // 0-100
  weight: number;
  status: 'passed' | 'warning' | 'regression';
}

function calculatePerformanceScore(
  results: RegressionResult[],
  scenarios: BenchmarkScenario[]
): PerformanceScore {
  const scenarioScores: ScenarioScore[] = [];
  let totalWeight = 0;
  let weightedSum = 0;

  for (const result of results) {
    const scenario = scenarios.find(s => s.name === result.scenario);
    if (!scenario) continue;

    const score = this.calculateScenarioScore(result, scenario);
    const status = result.status === 'passed' ? 'passed' :
                   result.status === 'warning' ? 'warning' : 'regression';

    scenarioScores.push({
      scenario: result.scenario,
      baseline: result.baseline,
      current: result.current,
      score,
      weight: scenario.weight,
      status,
    });

    totalWeight += scenario.weight;
    weightedSum += score * scenario.weight;
  }

  const overall = Math.round(weightedSum / totalWeight);

  return {
    overall,
    letterGrade: this.getLetterGrade(overall),
    scenarios: scenarioScores,
    timestamp: Date.now(),
  };
}

private calculateScenarioScore(
  result: RegressionResult,
  scenario: BenchmarkScenario
): number {
  // 基于 p99 计算
  const baseline = result.baseline.p99;
  const current = result.current.p99;
  const threshold = scenario.thresholds.p99;

  // 如果当前值低于基准阈值，得满分
  if (current <= threshold) {
    return 100;
  }

  // 超出阈值越多，分数越低
  const overrun = (current - threshold) / threshold;
  const score = Math.max(0, 100 - overrun * 100);

  return Math.round(score);
}

private getLetterGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
```

---

## 4. 持续性能测试

### 4.1 CI/CD 集成

```yaml
# .github/workflows/performance.yml
name: Performance Benchmarks

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # 每天凌晨运行

jobs:
  benchmark:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Setup environment
        run: |
          cp .env.example .env
          # 配置测试环境变量
          echo "DATABASE_URL=${{ secrets.DATABASE_URL }}" >> .env
          echo "REDIS_URL=${{ secrets.REDIS_URL }}" >> .env

      - name: Run benchmarks
        run: npm run benchmark
        env:
          NODE_ENV: production

      - name: Check for regressions
        run: npm run benchmark:check-regression
        continue-on-error: true

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: benchmark-results
          path: benchmark-results/
          retention-days: 30

      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const results = require('./benchmark-results/summary.json');
            const { markdownTable } = require('./scripts/benchmark-table');

            const comment = `
            ## Performance Benchmarks

            ### Overall Score: ${results.overall} (${results.letterGrade})

            ${markdownTable(results.scenarios)}

            ${results.overall >= 80 ? '✅ Performance checks passed' : '⚠️ Performance regression detected'}
            `;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

### 4.2 性能趋势

```typescript
// benchmarks/trends.ts
interface PerformanceTrend {
  scenario: string;
  period: '7d' | '30d' | '90d';
  dataPoints: TrendPoint[];
  trend: 'improving' | 'stable' | 'degrading';
  changePercent: number;
}

interface TrendPoint {
  timestamp: number;
  p50: number;
  p95: number;
  p99: number;
  score: number;
}

async function generateTrends(
  scenario: string,
  period: '7d' | '30d' | '90d'
): Promise<PerformanceTrend> {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

  const results = await redis.zrangebyscore(
    `benchmark:results:${scenario}`,
    startTime,
    Date.now(),
    'WITHSCORES'
  );

  const dataPoints: TrendPoint[] = results.map((r: string) => JSON.parse(r));

  const trend = calculateTrend(dataPoints);
  const changePercent = this.calculateChangePercent(dataPoints);

  return {
    scenario,
    period,
    dataPoints,
    trend,
    changePercent,
  };
}

function calculateTrend(dataPoints: TrendPoint[]): 'improving' | 'stable' | 'degrading' {
  if (dataPoints.length < 2) return 'stable';

  // 使用线性回归
  const xValues = dataPoints.map((_, i) => i);
  const yValues = dataPoints.map(p => p.p99);

  const slope = linearRegressionSlope(xValues, yValues);
  const avgY = yValues.reduce((a, b) => a + b, 0) / yValues.length;

  // 斜率 / 平均值 = 变化百分比
  const percentChange = (slope * dataPoints.length) / avgY;

  if (percentChange < -0.05) return 'improving';   // p99 下降 = 改善
  if (percentChange > 0.05) return 'degrading';    // p99 上升 = 恶化
  return 'stable';
}
```

---

## 5. 相关文档

- [性能优化](./PERFORMANCE_OPTIMIZATION.md)
- [CI/CD 流水线](./CI_CD_PIPELINE.md)
- [监控与告警](./MONITORING_ALERTING.md)

---

**最后更新**: 2026-04-14
