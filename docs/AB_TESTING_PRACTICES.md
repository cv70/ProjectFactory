# A/B 测试实践指南

## 1. 概述

本文档描述 ProjectFactory 系统的 A/B 测试实践，包括实验设计、执行和分析方法。

### 1.1 测试框架

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           A/B 测试框架                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   实验设计       │───▶│   流量分配       │───▶│   指标收集       │         │
│  │  Experiment    │    │  Traffic Split │    │  Metrics       │         │
│  │  Design        │    │                 │    │  Collection     │         │
│  │                 │    │ • 哈希分配       │    │                 │         │
│  │ • 假设定义      │    │ • 层级分层       │    │ • 核心指标      │         │
│  │ • 样本计算      │    │ • 互斥组        │    │ • 辅助指标      │         │
│  │ • 变更集设计    │    │ • 毒药实验       │    │ • 事件追踪      │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│           │                      │                      │                    │
│           ▼                      ▼                      ▼                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         分析引擎                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │   │
│  │  │ 统计分析    │  │ 序列分析    │  │ 异常检测    │               │   │
│  │  │ Statistical │  │ Sequential  │  │ Anomaly    │               │   │
│  │  │ Analysis    │  │ Analysis    │  │ Detection   │               │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        决策引擎                                     │   │
│  │  • 显著性判断    • 提前终止    • 自动回滚    • 渐进式推广          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 实验设计

### 2.1 假设定义

```typescript
// ab-testing/design/hypothesis.ts
interface Hypothesis {
  id: string;
  name: string;
  description: string;

  // 假设陈述
  statement: {
    control: string;  // 对照组行为
    treatment: string; // 实验组行为
    expected: string;  // 期望差异
  };

  // 指标定义
  primaryMetric: MetricDefinition;
  secondaryMetrics: MetricDefinition[];

  // 最小可检测效应
  minimumDetectableEffect: {
    relative: number;  // 相对百分比
    absolute: number;  // 绝对值
  };

  // 样本量参数
  sampleSizeParams: {
    baseline: number;
    alpha: number;      // Type I error
    beta: number;       // Type II error
    power: number;     // 1 - beta
  };

  // 风险评估
  riskAssessment: {
    business: 'low' | 'medium' | 'high';
    technical: 'low' | 'medium' | 'high';
    rollbackPlan: string;
  };
}

interface MetricDefinition {
  name: string;
  type: 'ratio' | 'mean' | 'percentile' | 'count';
  aggregation: 'sum' | 'avg' | 'max' | 'min';

  // 漏斗位置
  funnelStage: 'acquisition' | 'activation' | 'retention' | 'referral' | 'revenue';

  // 预期变化方向
  expectedDirection: 'increase' | 'decrease' | 'no_change';

  // 敏感度
  sensitivity: 'high' | 'medium' | 'low';
}

// ProjectFactory 示例假设
const HYPOTHESES: Hypothesis[] = [
  {
    id: 'h-001',
    name: '简化创建流程提升完成率',
    description: '将项目创建流程从 5 步简化为 3 步，减少用户摩擦',
    statement: {
      control: '用户需要完成 5 个步骤才能创建项目',
      treatment: '用户只需完成 3 个步骤即可创建项目',
      expected: '项目创建完成率提升 20%',
    },
    primaryMetric: {
      name: 'project_creation_completion_rate',
      type: 'ratio',
      aggregation: 'avg',
      funnelStage: 'activation',
      expectedDirection: 'increase',
      sensitivity: 'high',
    },
    secondaryMetrics: [
      {
        name: 'time_to_first_project',
        type: 'mean',
        aggregation: 'avg',
        funnelStage: 'activation',
        expectedDirection: 'decrease',
        sensitivity: 'medium',
      },
      {
        name: 'bounce_rate_at_creation',
        type: 'ratio',
        aggregation: 'avg',
        funnelStage: 'acquisition',
        expectedDirection: 'decrease',
        sensitivity: 'high',
      },
    ],
    minimumDetectableEffect: {
      relative: 0.20,  // 20% 相对提升
      absolute: 0.05,  // 5% 绝对提升
    },
    sampleSizeParams: {
      baseline: 0.25,   // 25% 基准完成率
      alpha: 0.05,
      beta: 0.20,
      power: 0.80,
    },
    riskAssessment: {
      business: 'medium',
      technical: 'low',
      rollbackPlan: '通过 Feature Flag 关闭实验分支，立即恢复 5 步流程',
    },
  },
];
```

### 2.2 样本量计算

```typescript
// ab-testing/design/sample-calculator.ts
class SampleSizeCalculator {
  // 基于比率的样本量计算
  calculateForRatio(params: {
    baseline: number;
    mde: number;           // 最小可检测效应 (绝对值)
    alpha: number;
    power: number;
  }): number {
    const { baseline, mde, alpha, power } = params;

    const p1 = baseline;
    const p2 = baseline + mde;

    const zAlpha = this.normalQuantile(1 - alpha / 2);
    const zBeta = this.normalQuantile(power);

    const pooledP = (p1 + p2) / 2;
    const effectSize = Math.abs(p2 - p1);

    // 样本量公式 (双样本比率检验)
    const n = (
      2 *
      pooledP *
      (1 - pooledP) *
      Math.pow(zAlpha + zBeta, 2)
    ) / Math.pow(effectSize, 2);

    return Math.ceil(n);
  }

  // 基于均值的样本量计算
  calculateForMean(params: {
    baseline: number;
    mde: number;
    stdDev: number;
    alpha: number;
    power: number;
  }): number {
    const { baseline, mde, stdDev, alpha, power } = params;

    const zAlpha = this.normalQuantile(1 - alpha / 2);
    const zBeta = this.normalQuantile(power);

    const effectSize = Math.abs(mde);

    // 样本量公式 (双样本均值检验)
    const n = (
      2 *
      Math.pow(stdDev, 2) *
      Math.pow(zAlpha + zBeta, 2)
    ) / Math.pow(effectSize, 2);

    return Math.ceil(n);
  }

  // 计算实验持续时间
  calculateDuration(
    sampleSize: number,
    dailyUsers: number,
    trafficAllocation: number
  ): number {
    const dailySampleSize = dailyUsers * trafficAllocation;
    return Math.ceil(sampleSize / dailySampleSize);
  }

  // 正态分布分位数
  private normalQuantile(p: number): number {
    // Approximation using Abramowitz and Stegun
    const a = [
      -3.969683028665376e+01, 2.209460984245205e+02,
      -2.759285104469687e+02, 1.383577518672690e+02,
      -3.066479806614716e+01, 2.506628277459239e+00,
    ];
    const b = [
      -5.447609879822406e+01, 1.615858368580409e+02,
      -1.155989671855518e+02, 8.781222777585472e+01,
      -1.899486122961166e+01, 1.332540870721080e+00,
    ];

    let q: number, t: number, x: number;

    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;

    q = p - 0.5;
    t = Math.abs(q);
    if (t < 0.42) {
      x = t * t * (((a[0] * t + a[1]) * t + a[2]) * t + a[3]) * t + a[4]) * t + a[5]) / ((((b[0] * t + b[1]) * t + b[2]) * t + b[3]) * t + b[4]) * t + b[5]);
    } else {
      x = -Math.log(4.0 * p * (1 - p));
      x = (((((a[0] * x + a[1]) * x + a[2]) * x + a[3]) * x + a[4]) * x + a[5]) / ((((b[0] * x + b[1]) * x + b[2]) * x + b[3]) * x + b[4]) * x + b[5]);
    }

    return q < 0 ? -x : x;
  }
}
```

---

## 3. 流量分配

### 3.1 分桶策略

```typescript
// ab-testing/assignment/bucket-manager.ts
class ExperimentBucketManager {
  private buckets: Map<string, BucketConfig> = new Map();
  private hasher: MurmurHash3;

  constructor() {
    this.hasher = new MurmurHash3();
  }

  // 用户分桶
  assignUserToExperiment(
    userId: string,
    experimentId: string
  ): 'control' | 'treatment' {
    const bucket = this.getBucket(userId, experimentId);
    return bucket < 50 ? 'control' : 'treatment';
  }

  // 层级化流量分配
  assignToLayer(
    userId: string,
    layerId: string,
    layerConfig: LayerConfig
  ): string | null {
    // 计算用户的基础哈希
    const baseHash = this.hash(`${userId}:${layerId}`);

    // 检查用户是否在层内
    if (baseHash > layerConfig.trafficAllocation) {
      return null; // 用户不在此层
    }

    // 分配到实验
    for (const experiment of layerConfig.experiments) {
      const expHash = this.hash(`${userId}:${experiment.id}`);

      if (expHash < experiment.trafficAllocation) {
        return experiment.id;
      }
    }

    return null;
  }

  // 毒药实验 (用于一致性验证)
  assignToPoisonExperiment(
    userId: string,
    poisonConfig: PoisonConfig
  ): boolean {
    const hash = this.hash(`${userId}:${poisonConfig.id}`);
    return hash < poisonConfig.trafficAllocation;
  }

  private getBucket(userId: string, experimentId: string): number {
    const hashInput = `${userId}:${experimentId}`;
    const hash = this.hash(hashInput);
    return hash % 100;
  }

  private hash(input: string): number {
    return this.hasher.hash128(input).value % 10000 / 10000;
  }
}

interface LayerConfig {
  id: string;
  name: string;
  trafficAllocation: number; // 0-1
  experiments: ExperimentInLayer[];
  mutexGroups: string[][];   // 互斥实验组
}

interface ExperimentInLayer {
  id: string;
  trafficAllocation: number;
  mutexGroup?: string;
}
```

### 3.2 实验配置

```yaml
# ab-testing/config/experiment-template.yaml
experiments:
  - id: "exp-001-simplified-creation"
    name: "简化项目创建流程"
    status: "running"
    hypothesis: "h-001"

    # 流量配置
    traffic:
      allocation: 0.20        # 20% 流量参与实验
      layer: "user-experience"
      startTime: "2026-04-01T00:00:00Z"
      endTime: "2026-04-30T23:59:59Z"

    # 目标群体
    targeting:
      include:
        - countries: ["US", "CN", "EU"]
          userAge: { min: 30 } # 账户年龄 >= 30 天
          userSegment: ["active"]  # 活跃用户
        - userIdRegex: "^(test_|demo_)"  # 排除测试用户
      exclude:
        - userTier: ["internal"]
        - countries: ["XX"]  # 排除特定国家

    # 变体定义
    variants:
      control:
        weight: 50
        config:
          steps: 5
          showAdvancedOptions: true
      treatment:
        weight: 50
        config:
          steps: 3
          showAdvancedOptions: false

    # 指标
    metrics:
      primary:
        name: "project_creation_completion_rate"
        source: "analytics"
      secondary:
        - name: "time_to_first_project"
          source: "analytics"
        - name: "bounce_rate_at_creation"
          source: "analytics"

    # 告警阈值
    alerts:
      - metric: "project_creation_completion_rate"
        condition: "decrease > 30%"
        action: "slack:#ab-testing-alerts"
      - metric: "error_rate"
        condition: "increase > 5%"
        action: "slack:#ab-testing-alerts"

    # 决策规则
    decisionRules:
      earlyStop:
        enabled: true
        minSampleSize: 1000
        conditions:
          - metric: "project_creation_completion_rate"
            significance: 0.99
            direction: "decrease"
            duration: "2 days"
```

---

## 4. 统计分析

### 4.1 结果分析

```typescript
// ab-testing/analysis/statistical-analysis.ts
interface ExperimentResult {
  experimentId: string;
  status: 'running' | 'completed' | 'stopped';
  startTime: Date;
  endTime?: Date;

  variants: VariantResult[];

  conclusion: {
    winner: 'control' | 'treatment' | 'inconclusive';
    confidence: number;
    lift: {
      relative: number;
      absolute: number;
    };
    pValue: number;
  };

  recommendations: string[];
}

interface VariantResult {
  name: string;
  sampleSize: number;
  metrics: MetricResult[];
}

interface MetricResult {
  name: string;
  value: number;
  confidenceInterval: [number, number];
  statisticalTest: {
    testType: 't-test' | 'chi-square' | 'mann-whitney';
    statistic: number;
    pValue: number;
    significant: boolean;
  };
}

class StatisticalAnalyzer {
  // 分析实验结果
  analyzeExperiment(
    experiment: Experiment,
    data: ExperimentData
  ): ExperimentResult {
    const variantResults = this.analyzeVariants(experiment, data);

    // 确定获胜者
    const conclusion = this.determineWinner(experiment, variantResults);

    // 生成建议
    const recommendations = this.generateRecommendations(conclusion);

    return {
      experimentId: experiment.id,
      status: experiment.status,
      startTime: experiment.startTime,
      endTime: experiment.endTime,
      variants: variantResults,
      conclusion,
      recommendations,
    };
  }

  private analyzeVariants(
    experiment: Experiment,
    data: ExperimentData
  ): VariantResult[] {
    const variants = experiment.variants;

    return variants.map(variant => {
      const variantData = data.filter(d => d.variant === variant.name);

      const metrics = experiment.primaryMetric.map(metric => {
        return this.analyzeMetric(metric, variantData, data);
      });

      return {
        name: variant.name,
        sampleSize: variantData.length,
        metrics,
      };
    });
  }

  private analyzeMetric(
    metric: MetricDefinition,
    variantData: DataPoint[],
    allData: DataPoint[]
  ): MetricResult {
    const values = variantData.map(d => d.value);

    // 计算统计量
    const mean = this.mean(values);
    const stdDev = this.stdDev(values);
    const n = values.length;

    // 置信区间
    const confidenceInterval = this.confidenceInterval(mean, stdDev, n, 0.95);

    // 统计检验
    const controlData = allData.filter(d => d.variant === 'control');
    const treatmentData = variantData;

    const testResult = this.performTest(
      metric,
      controlData.map(d => d.value),
      treatmentData.map(d => d.value)
    );

    return {
      name: metric.name,
      value: mean,
      confidenceInterval,
      statisticalTest: testResult,
    };
  }

  private performTest(
    metric: MetricDefinition,
    control: number[],
    treatment: number[]
  ): MetricResult['statisticalTest'] {
    if (metric.type === 'ratio') {
      // 卡方检验
      const result = this.chiSquareTest(control, treatment);
      return {
        testType: 'chi-square',
        ...result,
      };
    } else {
      // t 检验
      const result = this.tTest(control, treatment);
      return {
        testType: 't-test',
        ...result,
      };
    }
  }

  private chiSquareTest(control: number[], treatment: number[]): {
    statistic: number;
    pValue: number;
    significant: boolean;
  } {
    const n1 = control.length;
    const n2 = treatment.length;

    // 计算比率
    const p1 = control.filter(x => x > 0).length / n1;
    const p2 = treatment.filter(x => x > 0).length / n2;

    // 计算卡方统计量
    const pooledP = (control.reduce((a, b) => a + b, 0) + treatment.reduce((a, b) => a + b, 0)) /
                    (n1 + n2);

    const statistic =
      (p1 - p2) ** 2 /
      (pooledP * (1 - pooledP) * (1 / n1 + 1 / n2));

    const pValue = 1 - this.chiSquareCDF(statistic, 1);

    return {
      statistic,
      pValue,
      significant: pValue < 0.05,
    };
  }

  private tTest(sample1: number[], sample2: number[]): {
    statistic: number;
    pValue: number;
    significant: boolean;
  } {
    const n1 = sample1.length;
    const n2 = sample2.length;
    const mean1 = this.mean(sample1);
    const mean2 = this.mean(sample2);
    const var1 = this.variance(sample1);
    const var2 = this.variance(sample2);

    // 合并方差
    const pooledVar =
      ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);

    // t 统计量
    const statistic =
      (mean1 - mean2) / Math.sqrt(pooledVar * (1 / n1 + 1 / n2));

    // 自由度
    const df = n1 + n2 - 2;

    const pValue = 2 * (1 - this.tCDF(Math.abs(statistic), df));

    return {
      statistic,
      pValue,
      significant: pValue < 0.05,
    };
  }

  private mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private variance(values: number[]): number {
    const m = this.mean(values);
    return values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1);
  }

  private stdDev(values: number[]): number {
    return Math.sqrt(this.variance(values));
  }

  private confidenceInterval(
    mean: number,
    stdDev: number,
    n: number,
    confidence: number
  ): [number, number] {
    const z = 1.96; // 95% confidence
    const se = stdDev / Math.sqrt(n);
    return [mean - z * se, mean + z * se];
  }

  // 简化版实现
  private chiSquareCDF(x: number, df: number): number {
    return 1 - Math.exp(-x / 2);
  }

  private tCDF(t: number, df: number): number {
    return 0.5; // Simplified
  }
}
```

### 4.2 序列分析

```typescript
// ab-testing/analysis/sequential-analysis.ts
class SequentialAnalyzer {
  // 序列检验 (E 值)
  calculateEValue(
    observations: number[],
    threshold: number = 0.95
  ): SequentialResult {
    let eValue = 1;
    const eValues: number[] = [];

    for (const obs of observations) {
      // 更新 E 值
      eValue *= this.likelihoodRatio(obs);

      // 标准化 E 值
      const normalizedE = eValue / Math.sqrt(observations.indexOf(obs) + 1);

      eValues.push(normalizedE);

      // 检查是否超过阈值
      if (normalizedE > 1 / (1 - threshold)) {
        return {
          stopped: true,
          eValue: normalizedE,
          sampleSize: observations.indexOf(obs) + 1,
          conclusion: 'significant',
        };
      }
    }

    return {
      stopped: false,
      eValue: eValues[eValues.length - 1],
      sampleSize: observations.length,
      conclusion: 'inconclusive',
    };
  }

  private likelihoodRatio(obs: number): number {
    // 简化的似然比计算
    return obs > 0 ? 1.1 : 0.9;
  }
}

interface SequentialResult {
  stopped: boolean;
  eValue: number;
  sampleSize: number;
  conclusion: 'significant' | 'inconclusive';
}
```

---

## 5. 实验平台

### 5.1 SDK 集成

```typescript
// ab-testing/sdk/client.ts
import { v4 as uuid } from 'uuid';

interface ExperimentConfig {
  apiUrl: string;
  projectId: string;
  userId: string;
  attributes: UserAttributes;
}

interface UserAttributes {
  country: string;
  userTier: string;
  accountAge: number;
  createdAt: Date;
}

class ABTestingClient {
  private config: ExperimentConfig;
  private assignments: Map<string, string> = new Map();
  private queue: AnalyticsEvent[] = [];

  constructor(config: ExperimentConfig) {
    this.config = config;
    this.loadCachedAssignments();
  }

  // 获取实验变体
  getVariant(experimentId: string): string {
    // 检查缓存
    if (this.assignments.has(experimentId)) {
      return this.assignments.get(experimentId)!;
    }

    // 从服务器获取
    const variant = this.fetchAssignment(experimentId);

    // 缓存
    this.assignments.set(experimentId, variant);
    this.cacheAssignments();

    return variant;
  }

  // 追踪指标
  trackMetric(metricName: string, value: number, properties?: Record<string, any>): void {
    const event: AnalyticsEvent = {
      id: uuid(),
      type: 'metric',
      experimentId: this.getCurrentExperiment(),
      variant: this.getCurrentVariant(),
      metricName,
      value,
      properties,
      timestamp: Date.now(),
      userId: this.config.userId,
    };

    if (navigator.onLine) {
      this.flushEvent(event);
    } else {
      this.queue.push(event);
    }
  }

  // 追踪页面浏览
  trackPageView(pageName: string, properties?: Record<string, any>): void {
    this.trackEvent('page_view', { pageName, ...properties });
  }

  // 追踪用户操作
  trackAction(actionName: string, properties?: Record<string, any>): void {
    this.trackEvent('user_action', { actionName, ...properties });
  }

  private async fetchAssignment(experimentId: string): Promise<string> {
    try {
      const response = await fetch(
        `${this.config.apiUrl}/api/v1/experiments/${experimentId}/assign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: this.config.userId,
            attributes: this.config.attributes,
          }),
        }
      );

      const data = await response.json();
      return data.variant;
    } catch (error) {
      console.error('Failed to fetch experiment assignment:', error);
      return 'control'; // 默认对照组
    }
  }

  private trackEvent(eventName: string, properties: Record<string, any>): void {
    const event: AnalyticsEvent = {
      id: uuid(),
      type: 'event',
      experimentId: this.getCurrentExperiment(),
      variant: this.getCurrentVariant(),
      eventName,
      properties,
      timestamp: Date.now(),
      userId: this.config.userId,
    };

    this.queue.push(event);

    if (navigator.onLine && this.queue.length >= 10) {
      this.flushQueue();
    }
  }

  private async flushEvent(event: AnalyticsEvent): Promise<void> {
    await fetch(`${this.config.apiUrl}/api/v1/analytics/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  }

  private async flushQueue(): Promise<void> {
    const events = this.queue.splice(0, this.queue.length);

    await fetch(`${this.config.apiUrl}/api/v1/analytics/events/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    });
  }

  private loadCachedAssignments(): void {
    const cached = localStorage.getItem('ab_assignments');
    if (cached) {
      this.assignments = new Map(JSON.parse(cached));
    }
  }

  private cacheAssignments(): void {
    localStorage.setItem(
      'ab_assignments',
      JSON.stringify(Array.from(this.assignments.entries()))
    );
  }
}
```

### 5.2 后端 API

```yaml
# ab-testing/api/openapi.yaml
openapi: 3.0.0
info:
  title: A/B Testing Platform API
  version: 1.0.0

paths:
  /api/v1/experiments/{experimentId}/assign:
    post:
      summary: "获取实验分配"
      parameters:
        - name: experimentId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                userId:
                  type: string
                attributes:
                  $ref: "#/components/schemas/UserAttributes"
      responses:
        200:
          content:
            application/json:
              schema:
                type: object
                properties:
                  variant:
                    type: string
                    enum: [control, treatment]
                  assignedAt:
                    type: string
                    format: date-time

  /api/v1/experiments:
    get:
      summary: "列出实验"
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [draft, running, paused, completed]
      responses:
        200:
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Experiment"

  /api/v1/experiments/{experimentId}/results:
    get:
      summary: "获取实验结果"
      parameters:
        - name: experimentId
          in: path
          required: true
      responses:
        200:
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ExperimentResult"

  /api/v1/analytics/events:
    post:
      summary: "提交分析事件"
      requestBody:
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/AnalyticsEvent"
      responses:
        201:
          description: "Event recorded"
```

---

## 6. 最佳实践

### 6.1 实验检查清单

```markdown
# A/B 测试检查清单

## 实验前
- [ ] 明确业务假设
- [ ] 定义成功指标和护栏指标
- [ ] 计算所需样本量
- [ ] 确定实验持续时间
- [ ] 完成技术和业务评审
- [ ] 准备回滚计划
- [ ] 配置监控告警

## 实验中
- [ ] 验证流量分配正确
- [ ] 检查核心指标无异常下降
- [ ] 监控样本比率平衡
- [ ] 记录任何外部因素 (假期, 营销活动等)

## 实验后
- [ ] 确认达到最小样本量
- [ ] 分析统计显著性
- [ ] 评估实际业务影响
- [ ] 制定后续行动计划
- [ ] 文档化 learnings
- [ ] 分享结果给团队
```

### 6.2 常见陷阱

```typescript
// 常见 A/B 测试陷阱及规避

const COMMON_PITFALLS = [
  {
    name: "新奇效应",
    description: "用户因新鲜感而短期表现不同",
    solution: "延长实验时间，观察效应是否持久"
  },
  {
    name: "选择偏差",
    description: "实验组和对照组不具有可比性",
    solution: "使用随机分桶，确保用户特征均匀分布"
  },
  {
    name: "多重检验",
    description: "同时检验多个指标增加假阳性率",
    solution: "预先指定主要指标，控制 Family-wise Error Rate"
  },
  {
    name: "Peeking 问题",
    description: "看到结果后频繁检查，提前终止实验",
    solution: "使用序列分析或预先确定检查时间点"
  },
  {
    name: "辛普森悖论",
    description: "分组数据与汇总数据呈现相反趋势",
    solution: "检查各子群的分组数据，确保结果一致"
  }
];
```

---

## 7. 相关文档

- [A/B 测试与灰度发布](./AB_TESTING_FEATURE_FLAGS.md)
- [数据分析](./DATA_WAREHOUSE_ANALYTICS.md)
- [产品分析](../analytics/PRODUCT_ANALYTICS.md)

---

**最后更新**: 2026-04-14
