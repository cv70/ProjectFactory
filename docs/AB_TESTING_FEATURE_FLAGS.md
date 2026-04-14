# A/B 测试与灰度发布设计

## 概述

本文档定义 ProjectFactory 系统的 A/B 测试和灰度发布策略，支持功能实验、渐进式发布和特性开关管理，实现数据的驱动决策和风险可控的功能发布。

## 1. A/B 测试架构

### 1.1 核心概念

```
┌─────────────────────────────────────────────────────────────────┐
│                       A/B 测试框架                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Experiment (实验)                                                │
│  ├── id: string                                                 │
│  ├── name: string                                                │
│  ├── hypothesis: string                                         │
│  ├── status: 'draft' | 'running' | 'paused' | 'completed'      │
│  ├── startTime?: Date                                           │
│  ├── endTime?: Date                                             │
│  └── variants: Variant[]                                        │
│                                                                  │
│  Variant (变体)                                                  │
│  ├── id: string                                                 │
│  ├── name: string                                               │
│  ├── weight: number (0-100, 所有变体权重和为 100)                │
│  ├── config: Record<string, any>  // 变体特定配置                │
│  └── metrics: MetricSnapshot                                   │
│                                                                  │
│  Metric (指标)                                                  │
│  ├── name: string                                               │
│  ├── type: 'counter' | 'gauge' | 'histogram'                   │
│  ├── value: number                                              │
│  └── conversions: number                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 实验配置

```typescript
// src/experiment/experiment-model.ts
interface Experiment {
  id: string;
  name: string;
  description: string;

  // 假设
  hypothesis: string;

  // 状态
  status: ExperimentStatus;

  // 时间范围
  startTime?: Date;
  endTime?: Date;

  // 目标
  targeting: TargetingConfig;

  // 变体
  variants: Variant[];

  // 指标
  primaryMetrics: string[];
  secondaryMetrics: string[];

  // 元数据
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived';

interface Variant {
  id: string;
  name: string;
  description: string;

  // 流量权重 (0-100)
  weight: number;

  // 变体特定配置
  config: Record<string, unknown>;

  // 随机分配时使用的 Bucket
  bucket?: string;
}

interface TargetingConfig {
  // 目标用户百分比
  percentage: number;

  // 用户筛选条件
  filters?: UserFilter[];

  // 特定用户白名单
  includeUserIds?: string[];

  // 特定用户黑名单
  excludeUserIds?: string[];

  // 目标租户
  tenantIds?: string[];

  // 目标平台
  platforms?: ('web' | 'ios' | 'android')[];
}

interface UserFilter {
  field: string;       // e.g., 'country', 'plan', 'createdAt'
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin';
  value: unknown;
}
```

## 2. 实验分配算法

### 2.1 哈希桶分配

```typescript
// src/experiment/assignment-engine.ts

// 用户到变体的确定性分配
class ExperimentAssignmentEngine {
  // 基于用户 ID 的确定性哈希分配
  assignVariant(
    userId: string,
    experimentId: string
  ): string {
    // 组合 userId 和 experimentId 确保同一用户总是被分配到同一变体
    const hashInput = `${userId}:${experimentId}`;
    const hash = this.hash(hashInput);

    // 将哈希映射到 0-99 的桶
    const bucket = hash % 100;

    // 根据桶确定变体
    const experiment = this.getExperiment(experimentId);
    return this.getVariantForBucket(experiment.variants, bucket);
  }

  // MurmurHash3 实现
  private hash(input: string): number {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;

    for (let i = 0; i < input.length; i++) {
      const ch = input.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  // 根据桶号确定变体
  private getVariantForBucket(variants: Variant[], bucket: number): string {
    let cumulativeWeight = 0;

    for (const variant of variants) {
      cumulativeWeight += variant.weight;
      if (bucket < cumulativeWeight) {
        return variant.id;
      }
    }

    // 默认返回最后一个变体（通常是 Control）
    return variants[variants.length - 1].id;
  }

  // 检查用户是否在实验目标范围内
  isUserInExperiment(
    userId: string,
    experimentId: string,
    targeting: TargetingConfig
  ): boolean {
    // 检查百分比
    const hashInput = `${userId}:${experimentId}:eligibility`;
    const hash = this.hash(hashInput);
    const bucket = hash % 100;

    if (bucket >= targeting.percentage) {
      return false;
    }

    // 检查白名单
    if (targeting.includeUserIds?.includes(userId)) {
      return true;
    }

    // 检查黑名单
    if (targeting.excludeUserIds?.includes(userId)) {
      return false;
    }

    return true;
  }
}

// 实验服务
class ExperimentService {
  private assignmentEngine: ExperimentAssignmentEngine;
  private trackingService: ExperimentTrackingService;

  // 获取用户应该看到的变体配置
  async getVariantForUser(
    experimentId: string,
    userId: string,
    userContext: UserContext
  ): Promise<Variant | null> {
    const experiment = await this.getExperiment(experimentId);

    if (!experiment) return null;
    if (experiment.status !== 'running') return null;

    // 检查用户是否在实验范围内
    if (!this.assignmentEngine.isUserInExperiment(userId, experimentId, experiment.targeting)) {
      return null;
    }

    // 分配变体
    const variantId = this.assignmentEngine.assignVariant(userId, experimentId);
    return experiment.variants.find(v => v.id === variantId)!;
  }

  // 批量获取用户参与的所有实验
  async getExperimentsForUser(
    userId: string,
    userContext: UserContext
  ): Promise<Map<string, Variant>> {
    const activeExperiments = await this.getActiveExperiments();
    const results = new Map<string, Variant>();

    for (const experiment of activeExperiments) {
      const variant = await this.getVariantForUser(experiment.id, userId, userContext);
      if (variant) {
        results.set(experiment.id, variant);
      }
    }

    return results;
  }
}
```

### 2.2 分配缓存

```typescript
// src/experiment/assignment-cache.ts

// 分配结果缓存，避免重复计算
class ExperimentAssignmentCache {
  private cache: Map<string, { variantId: string; expiresAt: number }> = new Map();
  private ttlMs: number;

  constructor(ttlMs = 3600000) {  // 默认 1 小时
    this.ttlMs = ttlMs;
  }

  // 获取缓存的分配结果
  get(userId: string, experimentId: string): string | null {
    const key = this.makeKey(userId, experimentId);
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.variantId;
  }

  // 设置分配结果
  set(userId: string, experimentId: string, variantId: string): void {
    const key = this.makeKey(userId, experimentId);
    this.cache.set(key, {
      variantId,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  // 批量获取
  getMany(userId: string, experimentIds: string[]): Map<string, string | null> {
    const results = new Map<string, string | null>();

    for (const experimentId of experimentIds) {
      results.set(experimentId, this.get(userId, experimentId));
    }

    return results;
  }

  // 批量设置
  setMany(userId: string, assignments: Map<string, string>): void {
    for (const [experimentId, variantId] of assignments) {
      this.set(userId, experimentId, variantId);
    }
  }

  private makeKey(userId: string, experimentId: string): string {
    return `${userId}:${experimentId}`;
  }
}
```

## 3. 指标追踪

### 3.1 事件追踪

```typescript
// src/experiment/tracking.ts

// 实验事件
interface ExperimentEvent {
  experimentId: string;
  variantId: string;
  userId: string;
  eventName: string;
  eventValue?: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// 漏斗步骤
interface FunnelStep {
  name: string;
  eventName: string;
  conversionEvent?: string;  // 到达下一步的事件
}

class ExperimentTrackingService {
  private eventQueue: ExperimentEvent[] = [];
  private flushIntervalMs: number = 5000;

  constructor() {
    // 定期刷新事件到数据仓库
    setInterval(() => this.flush(), this.flushIntervalMs);
  }

  // 追踪曝光事件
  async trackExposure(
    experimentId: string,
    variantId: string,
    userId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const event: ExperimentEvent = {
      experimentId,
      variantId,
      userId,
      eventName: 'exposure',
      timestamp: new Date(),
      metadata,
    };

    await this.track(event);
  }

  // 追踪转化事件
  async trackConversion(
    experimentId: string,
    variantId: string,
    userId: string,
    metricName: string,
    value?: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const event: ExperimentEvent = {
      experimentId,
      variantId,
      userId,
      eventName: `conversion:${metricName}`,
      eventValue: value,
      timestamp: new Date(),
      metadata,
    };

    await this.track(event);
  }

  // 追踪自定义事件
  async trackCustomEvent(
    experimentId: string,
    variantId: string,
    userId: string,
    eventName: string,
    value?: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const event: ExperimentEvent = {
      experimentId,
      variantId,
      userId,
      eventName: `custom:${eventName}`,
      eventValue: value,
      timestamp: new Date(),
      metadata,
    };

    await this.track(event);
  }

  private async track(event: ExperimentEvent): Promise<void> {
    // 验证事件
    this.validateEvent(event);

    // 加入队列
    this.eventQueue.push(event);

    // 如果队列已满，立即刷新
    if (this.eventQueue.length >= 1000) {
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = this.eventQueue.splice(0, this.eventQueue.length);

    // 批量写入数据仓库
    await this.writeEventsToDataWarehouse(events);

    console.log(`Flushed ${events.length} experiment events`);
  }

  private validateEvent(event: ExperimentEvent): void {
    if (!event.experimentId) throw new Error('experimentId is required');
    if (!event.variantId) throw new Error('variantId is required');
    if (!event.userId) throw new Error('userId is required');
    if (!event.eventName) throw new Error('eventName is required');
  }
}
```

### 3.2 漏斗分析

```typescript
// src/experiment/funnel-analysis.ts

// 漏斗分析
class FunnelAnalysis {
  async analyzeFunnel(
    experimentId: string,
    variantIds: string[],
    funnel: FunnelStep[],
    period: { start: Date; end: Date }
  ): Promise<FunnelResult> {
    const results: FunnelResult = {
      experimentId,
      funnelSteps: [],
      variantResults: new Map(),
    };

    // 为每个变体计算漏斗
    for (const variantId of variantIds) {
      const variantFunnel = await this.calculateVariantFunnel(
        experimentId,
        variantId,
        funnel,
        period
      );
      results.variantResults.set(variantId, variantFunnel);
    }

    // 计算统计显著性
    results.statisticalSignificance = this.calculateSignificance(
      results.variantResults,
      funnel[funnel.length - 1].name
    );

    return results;
  }

  private async calculateVariantFunnel(
    experimentId: string,
    variantId: string,
    funnel: FunnelStep[],
    period: { start: Date; end: Date }
  ): Promise<VariantFunnelResult> {
    const stepResults: FunnelStepResult[] = [];
    let previousCount = 0;

    for (const step of funnel) {
      // 获取到达该步骤的用户数
      const count = await this.countUniqueUsers(
        experimentId,
        variantId,
        step.eventName,
        period
      );

      const conversionRate = previousCount > 0
        ? (count / previousCount) * 100
        : 0;

      stepResults.push({
        stepName: step.name,
        eventName: step.eventName,
        userCount: count,
        conversionFromPrevious: conversionRate,
        conversionFromFirst: 0,  // 稍后计算
      });

      previousCount = count;
    }

    // 计算从第一步开始的转化率
    const firstCount = stepResults[0]?.userCount || 1;
    for (const step of stepResults) {
      step.conversionFromFirst = (step.userCount / firstCount) * 100;
    }

    return {
      variantId,
      steps: stepResults,
      overallConversion: stepResults[stepResults.length - 1]?.conversionFromFirst || 0,
    };
  }

  // 统计显著性检验（简化版）
  private calculateSignificance(
    variantResults: Map<string, VariantFunnelResult>,
    metricName: string
  ): StatisticalSignificance {
    const variants = Array.from(variantResults.values());

    if (variants.length < 2) {
      return { isSignificant: false, pValue: 1, confidenceLevel: 0 };
    }

    // Z-test for proportions
    const control = variants[0];
    const treatment = variants[1];

    const p1 = control.overallConversion / 100;
    const p2 = treatment.overallConversion / 100;

    const n1 = control.steps[0]?.userCount || 1;
    const n2 = treatment.steps[0]?.userCount || 1;

    const pooledP = (p1 * n1 + p2 * n2) / (n1 + n2);
    const standardError = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2));

    const zScore = standardError > 0 ? (p2 - p1) / standardError : 0;

    // 简化的 p-value 计算
    const pValue = this.normalCDF(Math.abs(zScore));

    return {
      isSignificant: pValue < 0.05,
      pValue,
      confidenceLevel: (1 - pValue) * 100,
      zScore,
      effectSize: ((p2 - p1) / p1) * 100,  // 相对提升百分比
    };
  }

  private normalCDF(x: number): number {
    // 简化的正态分布 CDF
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }
}

interface FunnelResult {
  experimentId: string;
  funnelSteps: FunnelStep[];
  variantResults: Map<string, VariantFunnelResult>;
  statisticalSignificance: StatisticalSignificance;
}

interface VariantFunnelResult {
  variantId: string;
  steps: FunnelStepResult[];
  overallConversion: number;
}

interface FunnelStepResult {
  stepName: string;
  eventName: string;
  userCount: number;
  conversionFromPrevious: number;
  conversionFromFirst: number;
}

interface StatisticalSignificance {
  isSignificant: boolean;
  pValue: number;
  confidenceLevel: number;
  zScore: number;
  effectSize: number;
}
```

## 4. 灰度发布

### 4.1 灰度策略

```typescript
// src/rollout/rollout-strategies.ts

// 灰度发布配置
interface RolloutConfig {
  featureId: string;
  strategy: RolloutStrategy;

  // 目标百分比
  percentage: number;

  // 时间计划
  schedule?: RolloutSchedule;

  // 目标条件
  targeting?: TargetingConfig;

  // 回滚条件
  autoRollback?: AutoRollbackConfig;
}

type RolloutStrategy = 'canary' | 'feature-flag' | 'blue-green' | 'ring-based';

interface RolloutSchedule {
  type: 'immediate' | 'gradual' | 'scheduled';
  stages?: Array<{
    percentage: number;
    durationMinutes: number;
  }>;
  startTime?: Date;
  endTime?: Date;
}

interface AutoRollbackConfig {
  enabled: boolean;
  triggerConditions: RollbackCondition[];
}

interface RollbackCondition {
  metric: string;          // e.g., 'error_rate', 'latency_p99'
  threshold: number;       // 触发回滚的阈值
  windowMinutes: number;   // 监控窗口
  comparison: 'gt' | 'lt' | 'gte' | 'lte';
}

class RolloutManager {
  private rolloutCache: Map<string, number> = new Map();  // 用户 ID -> 百分比桶
  private experimentService: ExperimentService;

  // 启动灰度发布
  async startRollout(config: RolloutConfig): Promise<void> {
    console.log(`Starting rollout for feature: ${config.featureId}`);

    // 更新 Feature Flag
    await FeatureFlagService.update(config.featureId, {
      enabled: true,
      rolloutPercentage: config.percentage,
      strategy: config.strategy,
    });

    // 如果有阶段计划，设置定时任务
    if (config.schedule?.type === 'gradual' && config.schedule.stages) {
      await this.scheduleGradualRollout(config);
    }

    // 如果有自动回滚配置，启动监控
    if (config.autoRollback?.enabled) {
      await this.startRolloutMonitor(config);
    }
  }

  // 更新灰度百分比
  async updatePercentage(featureId: string, newPercentage: number): Promise<void> {
    await FeatureFlagService.update(featureId, {
      rolloutPercentage: newPercentage,
    });

    console.log(`Updated rollout percentage for ${featureId}: ${newPercentage}%`);
  }

  // 完成灰度发布（100%）
  async completeRollout(featureId: string): Promise<void> {
    await FeatureFlagService.update(featureId, {
      rolloutPercentage: 100,
      status: 'released',
    });

    console.log(`Completed rollout for feature: ${featureId}`);
  }

  // 回滚
  async rollback(featureId: string): Promise<void> {
    await FeatureFlagService.update(featureId, {
      rolloutPercentage: 0,
      status: 'rollback',
    });

    console.log(`Rolled back feature: ${featureId}`);
  }

  // 阶段式灰度
  private async scheduleGradualRollout(config: RolloutConfig): Promise<void> {
    const stages = config.schedule!.stages!;

    for (const stage of stages) {
      await this.delay(stage.durationMinutes * 60 * 1000);
      await this.updatePercentage(config.featureId, stage.percentage);
    }
  }

  // 回滚监控
  private async startRolloutMonitor(config: RolloutConfig): Promise<void> {
    const checkIntervalMs = 60000;  // 每分钟检查

    const interval = setInterval(async () => {
      const metrics = await this.getRolloutMetrics(config.featureId);

      for (const condition of config.autoRollback!.triggerConditions) {
        const metricValue = metrics[condition.metric];

        const shouldRollback = this.evaluateCondition(
          metricValue,
          condition.threshold,
          condition.comparison
        );

        if (shouldRollback) {
          console.warn(`Auto-rollback triggered for ${config.featureId}: ${condition.metric} exceeded threshold`);
          await this.rollback(config.featureId);
          clearInterval(interval);
          return;
        }
      }
    }, checkIntervalMs);
  }

  private evaluateCondition(value: number, threshold: number, comparison: string): boolean {
    switch (comparison) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      default: return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 4.2 环式发布

```typescript
// src/rollout/ring-based-rollout.ts

// 环式发布配置
interface RingConfig {
  rings: Ring[];
  currentRingIndex: number;
}

interface Ring {
  name: string;
  description: string;
  priority: number;  // 1 = 最内环

  // 环内用户选择
  criteria: {
    type: 'internal' | 'beta' | 'early-access' | 'general';
    userCount?: number;
    specificUserIds?: string[];
    plan?: string[];
  };
}

// 环式发布管理器
class RingBasedRolloutManager {
  private rings: Ring[] = [
    {
      name: 'dev-ring',
      description: '内部开发团队',
      priority: 1,
      criteria: { type: 'internal' },
    },
    {
      name: 'beta-ring',
      description: 'Beta 测试用户',
      priority: 2,
      criteria: { type: 'beta' },
    },
    {
      name: 'early-access-ring',
      description: '早期订阅用户',
      priority: 3,
      criteria: { type: 'early-access' },
    },
    {
      name: 'general-ring',
      description: '所有用户',
      priority: 4,
      criteria: { type: 'general' },
    },
  ];

  // 检查用户是否在当前环内
  isUserInCurrentRing(userId: string, ringName: string): boolean {
    const ring = this.rings.find(r => r.name === ringName);
    if (!ring) return false;

    return this.matchesRingCriteria(userId, ring.criteria);
  }

  // 获取用户所属的环
  getUserRing(userId: string): Ring | null {
    // 按优先级排序（从内到外）
    const sortedRings = [...this.rings].sort((a, b) => a.priority - b.priority);

    for (const ring of sortedRings) {
      if (this.matchesRingCriteria(userId, ring.criteria)) {
        return ring;
      }
    }

    return null;
  }

  // 提升到下一个环
  async promoteToNextRing(featureId: string): Promise<void> {
    const currentRingIndex = await this.getCurrentRingIndex(featureId);
    const nextRing = this.rings[currentRingIndex + 1];

    if (!nextRing) {
      console.log(`Feature ${featureId} is already in the outermost ring`);
      return;
    }

    await FeatureFlagService.update(featureId, {
      currentRing: nextRing.name,
    });

    console.log(`Promoted ${featureId} to ring: ${nextRing.name}`);
  }

  private matchesRingCriteria(userId: string, criteria: Ring['criteria']): boolean {
    switch (criteria.type) {
      case 'internal':
        return this.isInternalUser(userId);

      case 'beta':
        return this.isBetaTester(userId);

      case 'early-access':
        return this.hasEarlyAccessPlan(userId);

      case 'general':
        return true;

      case 'specific-user-ids':
        return criteria.specificUserIds?.includes(userId) || false;

      case 'plan':
        return this.userHasPlan(userId, criteria.plan || []);

      default:
        return false;
    }
  }

  private isInternalUser(userId: string): boolean {
    // 检查用户是否在内部域名白名单
    return userId.endsWith('@projectfactory.io');
  }

  private isBetaTester(userId: string): boolean {
    // 检查用户是否申请了 Beta
    return true; // 实现查询
  }

  private hasEarlyAccessPlan(userId: string): boolean {
    return true; // 实现查询
  }

  private userHasPlan(userId: string, plans: string[]): boolean {
    return true; // 实现查询
  }
}
```

## 5. 特性开关管理

### 5.1 Feature Flag 系统

```typescript
// src/feature-flags/flag-service.ts

// Feature Flag 配置
interface FeatureFlag {
  id: string;
  name: string;
  description: string;

  // 开关状态
  enabled: boolean;

  // 灰度百分比 (0-100)
  rolloutPercentage: number;

  // 变体配置
  variants?: Array<{
    name: string;
    value: unknown;
    weight: number;
  }>;

  // 目标配置
  targeting?: TargetingConfig;

  // 关联的实验
  experimentId?: string;

  // 元数据
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();
  private flagsByName: Map<string, string> = new Map();  // name -> id

  // 获取 Flag 值（用户视角）
  async getFlagValue(
    flagIdOrName: string,
    userId: string,
    defaultValue: unknown
  ): Promise<unknown> {
    const flag = await this.getFlag(flagIdOrName);
    if (!flag) return defaultValue;

    // 如果 Flag 未启用，返回默认值
    if (!flag.enabled) return defaultValue;

    // 如果有变体配置，使用实验分配
    if (flag.variants && flag.variants.length > 0) {
      return this.assignVariant(flag, userId);
    }

    // 如果有灰度百分比，使用灰度分配
    if (flag.rolloutPercentage < 100) {
      return this.shouldEnableForUser(flag, userId) ? true : defaultValue;
    }

    return true;
  }

  // 创建 Flag
  async createFlag(data: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>): Promise<FeatureFlag> {
    const flag: FeatureFlag = {
      ...data,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.flags.set(flag.id, flag);
    if (flag.name) {
      this.flagsByName.set(flag.name, flag.id);
    }

    return flag;
  }

  // 更新 Flag
  async updateFlag(flagId: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag> {
    const flag = this.flags.get(flagId);
    if (!flag) throw new NotFoundError('FeatureFlag');

    const updated = {
      ...flag,
      ...updates,
      updatedAt: new Date(),
    };

    this.flags.set(flagId, updated);

    return updated;
  }

  // 删除 Flag
  async deleteFlag(flagId: string): Promise<void> {
    const flag = this.flags.get(flagId);
    if (flag?.name) {
      this.flagsByName.delete(flag.name);
    }
    this.flags.delete(flagId);
  }

  // 灰度判断
  private shouldEnableForUser(flag: FeatureFlag, userId: string): boolean {
    const hashInput = `${userId}:${flag.id}:rollout`;
    const hash = this.hash(hashInput);
    const bucket = hash % 100;

    return bucket < flag.rolloutPercentage;
  }

  // 变体分配
  private assignVariant(flag: FeatureFlag, userId: string): unknown {
    const hashInput = `${userId}:${flag.id}:variant`;
    const hash = this.hash(hashInput);
    const bucket = hash % 100;

    let cumulativeWeight = 0;
    for (const variant of flag.variants!) {
      cumulativeWeight += variant.weight;
      if (bucket < cumulativeWeight) {
        return variant.value;
      }
    }

    return flag.variants![flag.variants!.length - 1].value;
  }

  private hash(input: string): number {
    // 使用之前定义的哈希函数
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;

    for (let i = 0; i < input.length; i++) {
      const ch = input.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
}

// 全局 Flag 服务实例
export const featureFlagService = new FeatureFlagService();
```

### 5.2 Flag 使用中间件

```typescript
// src/feature-flags/flag-middleware.ts

// Feature Flag 中间件（用于 API 请求）
function featureFlagMiddleware(
  flagName: string,
  options?: {
    defaultValue?: unknown;
    passToClient?: boolean;
  }
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;
    const value = await featureFlagService.getFlagValue(
      flagName,
      userId,
      options?.defaultValue ?? false
    );

    // 添加到响应头（供前端使用）
    if (options?.passToClient) {
      res.setHeader('X-Feature-Flag', `${flagName}=${value}`);
    }

    // 添加到请求对象
    (req as any).featureFlags = (req as any).featureFlags || {};
    (req as any).featureFlags[flagName] = value;

    next();
  };
}

// React Hook for Feature Flags
// const useFeatureFlag = (flagName: string, defaultValue?: unknown) => {
//   const [value, setValue] = useState(defaultValue);
//
//   useEffect(() => {
//     fetch(`/api/feature-flags/${flagName}`)
//       .then(res => res.json())
//       .then(data => setValue(data.value));
//   }, [flagName]);
//
//   return value;
// };

// Server Component 版本
// async function getFeatureFlag(flagName: string): Promise<boolean> {
//   const userId = getCurrentUserId();
//   return featureFlagService.getFlagValue(flagName, userId, false);
// }
```

## 6. 实验与发布集成

### 6.1 CI/CD 集成

```typescript
// src/experiment/cicd-integration.ts

// 发布流程中的实验检查
class ExperimentReleaseChecker {
  // 发布前检查
  async preReleaseCheck(releaseId: string): Promise<{
    canRelease: boolean;
    warnings: string[];
    blockers: string[];
  }> {
    const release = await this.getRelease(releaseId);
    const blockers: string[] = [];
    const warnings: string[] = [];

    // 检查是否有实验正在运行
    const activeExperiments = await this.getActiveExperiments();

    for (const feature of release.features) {
      // 检查 Feature Flag 配置
      const flag = await FeatureFlagService.getFlag(feature.id);
      if (!flag) {
        blockers.push(`Feature ${feature.id} has no feature flag configured`);
      }

      // 检查相关实验的状态
      if (flag?.experimentId) {
        const experiment = activeExperiments.find(e => e.id === flag.experimentId);

        if (experiment && experiment.status === 'running') {
          blockers.push(`Feature ${feature.id} has an active experiment. Complete or pause it before release.`);
        }
      }
    }

    return {
      canRelease: blockers.length === 0,
      warnings,
      blockers,
    };
  }

  // 发布时自动创建实验
  async createReleaseExperiment(release: Release): Promise<void> {
    const experiment = await ExperimentService.create({
      name: `Release experiment: ${release.version}`,
      description: `A/B test for release ${release.version}`,
      hypothesis: `New features in ${release.version} will improve key metrics`,
      targeting: {
        percentage: 50,
      },
      variants: [
        {
          name: 'control',
          description: 'Current version',
          weight: 50,
          config: { version: release.previousVersion },
        },
        {
          name: 'treatment',
          description: 'New release',
          weight: 50,
          config: { version: release.version },
        },
      ],
      primaryMetrics: ['activation_rate', 'task_completion_rate'],
    });

    console.log(`Created experiment ${experiment.id} for release ${release.version}`);
  }
}
```

### 6.2 决策仪表板数据

```typescript
// src/experiment/decision-dashboard.ts

// 实验决策数据
interface ExperimentDashboardData {
  experiment: Experiment;
  summary: {
    totalUsers: number;
    variantBreakdown: Record<string, number>;
    duration: string;
    status: ExperimentStatus;
  };

  results: {
    primaryMetrics: MetricResult[];
    secondaryMetrics: MetricResult[];
    statisticalSignificance: StatisticalSignificance;
  };

  recommendation: 'ship' | 'iterate' | 'rollback' | 'insufficient-data';

  confidence: number;
}

interface MetricResult {
  name: string;
  controlValue: number;
  treatmentValue: number;
  difference: number;
  differencePercent: number;
  isSignificant: boolean;
}

class ExperimentDashboardService {
  async generateRecommendation(experimentId: string): Promise<ExperimentDashboardData> {
    const experiment = await ExperimentService.getById(experimentId);
    const funnelResults = await FunnelAnalysis.analyzeFunnel(
      experimentId,
      experiment.variants.map(v => v.id),
      experiment.funnel,
      { start: experiment.startTime!, end: new Date() }
    );

    // 计算建议
    const significance = funnelResults.statisticalSignificance;
    const treatmentOverall = Array.from(funnelResults.variantResults.values())[1]?.overallConversion || 0;
    const controlOverall = Array.from(funnelResults.variantResults.values())[0]?.overallConversion || 0;

    let recommendation: ExperimentDashboardData['recommendation'];
    let confidence: number;

    if (!significance.isSignificant) {
      recommendation = 'insufficient-data';
      confidence = significance.confidenceLevel;
    } else if (significance.effectSize > 5) {
      recommendation = 'ship';
      confidence = significance.confidenceLevel;
    } else if (significance.effectSize < -5) {
      recommendation = 'rollback';
      confidence = significance.confidenceLevel;
    } else {
      recommendation = 'iterate';
      confidence = significance.confidenceLevel;
    }

    return {
      experiment,
      summary: this.generateSummary(experiment, funnelResults),
      results: this.formatResults(funnelResults),
      statisticalSignificance: significance,
      recommendation,
      confidence,
    };
  }

  private generateSummary(experiment: Experiment, results: FunnelResult): ExperimentDashboardData['summary'] {
    const variantCounts: Record<string, number> = {};

    for (const variant of experiment.variants) {
      const variantResult = results.variantResults.get(variant.id);
      variantCounts[variant.name] = variantResult?.steps[0]?.userCount || 0;
    }

    const duration = experiment.startTime
      ? `${Math.floor((Date.now() - experiment.startTime.getTime()) / (1000 * 60 * 60 * 24))} days`
      : 'N/A';

    return {
      totalUsers: Object.values(variantCounts).reduce((a, b) => a + b, 0),
      variantBreakdown: variantCounts,
      duration,
      status: experiment.status,
    };
  }
}
```

---

**最后更新**: 2026-04-14
**版本**: v1.0
