# 成本核算与计费系统设计

## 概述

成本核算与计费系统是无限生成系统的商业化基础设施，负责精确追踪、计算和分摊所有生成活动的成本，支持多种计费模式和商业化场景。对于一个提供付费服务的生成平台，精确的成本核算和灵活的计费是不可或缺的能力。

## 核心价值

```
成本管理 = 追踪 × 计算 × 分摊 × 计费 × 分析

成本系统的核心价值：
1. 成本透明 - 精确了解每个操作的真实成本
2. 资源优化 - 基于成本数据优化资源配置
3. 灵活计费 - 支持多种计费模式和定价策略
4. 财务合规 - 满足财务审计和税务要求
5. 商业智能 - 提供成本分析和盈利预测
```

## 成本模型

### 成本类型

```typescript
// 成本类型
enum CostType {
  // 计算成本
  COMPUTE = 'compute',               // 计算成本
  MEMORY = 'memory',                 // 内存成本
  STORAGE = 'storage',               // 存储成本
  NETWORK = 'network',               // 网络成本

  // AI成本
  LLM_INFERENCE = 'llm_inference',   // LLM推理成本
  EMBEDDING = 'embedding',           // 嵌入计算成本
  MODEL_TRAINING = 'model_training', // 模型训练成本

  // 运营成本
  API_CALLS = 'api_calls',           // 外部API调用
  THIRD_PARTY = 'third_party',       // 第三方服务
  BANDWIDTH = 'bandwidth',           // 带宽成本

  // 人工成本
  HUMAN_REVIEW = 'human_review',     // 人工审核
  SUPPORT = 'support',               // 客户支持
}

// 成本来源
interface CostSource {
  id: string;
  type: CostType;
  provider: string;                   // 云服务商/内部
  region?: string;                   // 区域
  tier?: string;                     // 层级
  unit: string;                      // 单位 (per_token, per_hour, per_gb)
  unitCost: number;                  // 单价
}

// 成本条目
interface CostEntry {
  id: string;
  timestamp: Date;

  // 成本来源
  source: CostSource;
  type: CostType;

  // 计量信息
  quantity: number;                   // 数量
  unit: string;                      // 单位
  unitCost: number;                  // 单价

  // 计算
  cost: number;                      // 总成本

  // 归因
  attribution: {
    tenantId?: string;
    projectId?: string;
    userId?: string;
    generationId?: string;
    pipelineId?: string;
  };

  // 元数据
  metadata: Record<string, any>;

  // 状态
  status: 'pending' | 'confirmed' | 'written_off';
}
```

### 成本计算模型

```typescript
// 成本计算器
class CostCalculator {
  constructor(
    private costSources: Map<CostType, CostSource[]>,
    private metricsCollector: MetricsCollector
  ) {}

  // 计算生成成本
  async calculateGenerationCost(
    generation: GenerationRequest,
    result: GenerationResult
  ): Promise<CostBreakdown> {
    const breakdown: CostBreakdown = {
      generationId: generation.id,
      timestamp: new Date(),
      totalCost: 0,
      categories: []
    };

    // 1. LLM推理成本
    const llmCost = await this.calculateLLMCost(result);
    breakdown.categories.push(llmCost);
    breakdown.totalCost += llmCost.cost;

    // 2. 计算资源成本
    const computeCost = await this.calculateComputeCost(result);
    breakdown.categories.push(computeCost);
    breakdown.totalCost += computeCost.cost;

    // 3. 存储成本
    const storageCost = await this.calculateStorageCost(result);
    breakdown.categories.push(storageCost);
    breakdown.totalCost += storageCost.cost;

    // 4. 网络成本
    if (result.networkTransfer) {
      const networkCost = await this.calculateNetworkCost(result.networkTransfer);
      breakdown.categories.push(networkCost);
      breakdown.totalCost += networkCost.cost;
    }

    // 5. 安全扫描成本
    const securityCost = await this.calculateSecurityCost(result);
    breakdown.categories.push(securityCost);
    breakdown.totalCost += securityCost.cost;

    return breakdown;
  }

  // 计算LLM成本
  private async calculateLLMCost(result: GenerationResult): Promise<CostCategory> {
    const inputTokens = result.usage.input_tokens;
    const outputTokens = result.usage.output_tokens;

    const source = this.costSources.get(CostType.LLM_INFERENCE)!;
    const modelSource = source.find(s => s.provider === result.model);

    const inputCost = inputTokens * (modelSource?.unitCost || 0) / 1000;
    const outputCost = outputTokens * (modelSource?.unitCost || 0) / 1000 * 1.5; // 输出token通常更贵

    return {
      type: CostType.LLM_INFERENCE,
      provider: result.model,
      quantity: inputTokens + outputTokens,
      unit: 'tokens',
      unitCost: modelSource?.unitCost || 0,
      cost: inputCost + outputCost,
      details: {
        inputTokens,
        outputTokens,
        inputCost,
        outputCost
      }
    };
  }

  // 计算计算资源成本
  private async calculateComputeCost(result: GenerationResult): Promise<CostCategory> {
    const duration = result.executionDuration; // ms
    const memory = result.peakMemory; // bytes

    const source = this.costSources.get(CostType.COMPUTE)!;

    // CPU成本 (按核心小时计算)
    const cpuHours = (duration / 1000 / 3600) * result.cpuCores;
    const cpuCost = cpuHours * source[0].unitCost;

    // 内存成本
    const memoryGbHours = (duration / 1000 / 3600) * (memory / (1024 * 1024 * 1024));
    const memorySource = source.find(s => s.tier === 'memory');
    const memoryCost = memoryGbHours * (memorySource?.unitCost || 0);

    return {
      type: CostType.COMPUTE,
      provider: 'internal',
      quantity: duration,
      unit: 'ms',
      unitCost: 0,
      cost: cpuCost + memoryCost,
      details: {
        duration,
        cpuHours,
        memoryGbHours,
        cpuCost,
        memoryCost
      }
    };
  }
}

// 成本分类
interface CostBreakdown {
  generationId: string;
  timestamp: Date;
  totalCost: number;
  categories: CostCategory[];
}

interface CostCategory {
  type: CostType;
  provider: string;
  quantity: number;
  unit: string;
  unitCost: number;
  cost: number;
  details: Record<string, any>;
}
```

## 计量系统

### 资源计量

```typescript
// 计量服务
class MeteringService {
  constructor(
    private metricsStore: MetricsStore,
    private aggregationEngine: AggregationEngine
  ) {}

  // 计量API调用
  async meterAPICall(metric: APIMetric): Promise<void> {
    const entry: MeteringEntry = {
      id: generateId('meter'),
      timestamp: new Date(),
      type: 'api_call',
      dimensions: {
        apiEndpoint: metric.endpoint,
        method: metric.method,
        statusCode: metric.statusCode,
        tier: metric.tier
      },
      value: 1,
      unit: 'calls',
      cost: await this.calculateAPICallCost(metric)
    };

    await this.metricsStore.record(entry);
  }

  // 计量Token使用
  async meterTokenUsage(metric: TokenMetric): Promise<void> {
    const entry: MeteringEntry = {
      id: generateId('meter'),
      timestamp: new Date(),
      type: 'token_usage',
      dimensions: {
        model: metric.model,
        operation: metric.operation, // completion, embedding, etc.
        tier: metric.tier
      },
      value: metric.tokenCount,
      unit: 'tokens',
      cost: await this.calculateTokenCost(metric)
    };

    await this.metricsStore.record(entry);
  }

  // 计量计算资源
  async meterComputeUsage(metric: ComputeMetric): Promise<void> {
    const entry: MeteringEntry = {
      id: generateId('meter'),
      timestamp: new Date(),
      type: 'compute_usage',
      dimensions: {
        resourceType: metric.resourceType,
        region: metric.region,
        instanceType: metric.instanceType
      },
      value: metric.duration,
      unit: 'ms',
      cost: await this.calculateComputeCost(metric)
    };

    await this.metricsStore.record(entry);
  }

  // 计量存储使用
  async meterStorageUsage(metric: StorageMetric): Promise<void> {
    const entry: MeteringEntry = {
      id: generateId('meter'),
      timestamp: new Date(),
      type: 'storage_usage',
      dimensions: {
        storageType: metric.storageType, // ssd, hdd, cache
        region: metric.region
      },
      value: metric.bytes,
      unit: 'bytes',
      cost: await this.calculateStorageCost(metric)
    };

    await this.metricsStore.record(entry);
  }
}

// 计量条目
interface MeteringEntry {
  id: string;
  timestamp: Date;
  type: string;
  dimensions: Record<string, string>;
  value: number;
  unit: string;
  cost: number;
}
```

### 聚合引擎

```typescript
// 聚合引擎
class AggregationEngine {
  // 按时间聚合
  async aggregateByTime(
    filter: AggregateFilter,
    interval: 'hour' | 'day' | 'week' | 'month'
  ): Promise<TimeAggregate[]> {
    const buckets = await this.createTimeBuckets(filter, interval);

    for (const bucket of buckets) {
      const entries = await this.getEntriesInRange(bucket.start, bucket.end, filter);

      bucket.metrics = {
        count: entries.length,
        totalValue: entries.reduce((sum, e) => sum + e.value, 0),
        totalCost: entries.reduce((sum, e) => sum + e.cost, 0),
        avgValue: entries.length > 0
          ? entries.reduce((sum, e) => sum + e.value, 0) / entries.length
          : 0
      };
    }

    return buckets;
  }

  // 按维度聚合
  async aggregateByDimension(
    filter: AggregateFilter,
    dimension: string
  ): Promise<DimensionAggregate[]> {
    const entries = await this.getEntries(filter);

    const groups = this.groupBy(entries, dimension);

    return Object.entries(groups).map(([value, groupEntries]) => ({
      dimension,
      value,
      count: groupEntries.length,
      totalValue: groupEntries.reduce((sum, e) => sum + e.value, 0),
      totalCost: groupEntries.reduce((sum, e) => sum + e.cost, 0)
    }));
  }

  // 按用户聚合
  async aggregateByUser(
    filter: AggregateFilter
  ): Promise<UserAggregate[]> {
    const entries = await this.getEntriesWithUser(filter);

    const groups = this.groupBy(entries, 'userId');

    return Object.entries(groups).map(([userId, userEntries]) => ({
      userId,
      totalCost: userEntries.reduce((sum, e) => sum + e.cost, 0),
      byType: this.aggregateByType(userEntries),
      byProject: this.aggregateByProject(userEntries)
    }));
  }
}
```

## 计费模型

### 计费套餐

```typescript
// 计费套餐
interface BillingPlan {
  id: string;
  name: string;
  type: 'free' | 'starter' | 'professional' | 'enterprise';

  // 价格
  pricing: {
    // 按量付费
    usageBased: boolean;

    // 套餐费
    baseFee: number;                // 月费
    baseFeeInterval: 'month' | 'year';

    // 包含额度
    included: {
      apiCalls: number;             // 包含API调用数
      tokens: number;               // 包含Token数
      storage: number;              // 包含存储 (bytes)
      projects: number;             // 包含项目数
    };
  };

  // 超额费率
  overage: {
    apiCalls: number;              // 每1000次
    tokens: number;                 // 每1K tokens
    storage: number;                // 每GB
    compute: number;               // 每CPU小时
  };

  // 限制
  limits: {
    maxProjects: number;
    maxTeamMembers: number;
    maxConcurrentGenerations: number;
    maxFileSize: number;
  };

  // 功能
  features: {
    prioritySupport: boolean;
    customBranding: boolean;
    advancedAnalytics: boolean;
    sso: boolean;
    sla: number;                    // SLA百分比
  };

  // 生效时间
  effectiveFrom: Date;
  effectiveTo?: Date;
}

// 预定义套餐
const predefinedPlans: BillingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    type: 'free',
    pricing: {
      usageBased: true,
      baseFee: 0,
      baseFeeInterval: 'month',
      included: {
        apiCalls: 100,
        tokens: 10000,
        storage: 100 * 1024 * 1024, // 100MB
        projects: 3
      }
    },
    overage: {
      apiCalls: 0, // 不支持超额
      tokens: 0,
      storage: 0,
      compute: 0
    },
    limits: {
      maxProjects: 3,
      maxTeamMembers: 1,
      maxConcurrentGenerations: 1,
      maxFileSize: 5 * 1024 * 1024
    },
    features: {
      prioritySupport: false,
      customBranding: false,
      advancedAnalytics: false,
      sso: false,
      sla: 99
    },
    effectiveFrom: new Date()
  },
  {
    id: 'starter',
    name: 'Starter',
    type: 'starter',
    pricing: {
      usageBased: true,
      baseFee: 29,
      baseFeeInterval: 'month',
      included: {
        apiCalls: 5000,
        tokens: 500000,
        storage: 5 * 1024 * 1024 * 1024, // 5GB
        projects: 20
      }
    },
    overage: {
      apiCalls: 2,      // $2/1000 calls
      tokens: 0.002,   // $0.002/token
      storage: 0.10,    // $0.10/GB
      compute: 0.05    // $0.05/CPUhour
    },
    limits: {
      maxProjects: 20,
      maxTeamMembers: 5,
      maxConcurrentGenerations: 3,
      maxFileSize: 50 * 1024 * 1024
    },
    features: {
      prioritySupport: false,
      customBranding: false,
      advancedAnalytics: false,
      sso: false,
      sla: 99.5
    },
    effectiveFrom: new Date()
  },
  {
    id: 'professional',
    name: 'Professional',
    type: 'professional',
    pricing: {
      usageBased: true,
      baseFee: 99,
      baseFeeInterval: 'month',
      included: {
        apiCalls: 50000,
        tokens: 5000000,
        storage: 50 * 1024 * 1024 * 1024, // 50GB
        projects: 100
      }
    },
    overage: {
      apiCalls: 1,
      tokens: 0.001,
      storage: 0.05,
      compute: 0.03
    },
    limits: {
      maxProjects: 100,
      maxTeamMembers: 20,
      maxConcurrentGenerations: 10,
      maxFileSize: 200 * 1024 * 1024
    },
    features: {
      prioritySupport: true,
      customBranding: true,
      advancedAnalytics: true,
      sso: false,
      sla: 99.9
    },
    effectiveFrom: new Date()
  }
];
```

### 计费引擎

```typescript
// 计费引擎
class BillingEngine {
  constructor(
    private planStore: BillingPlanStore,
    private usageTracker: UsageTracker,
    private pricingCalculator: PricingCalculator
  ) {}

  // 计算账单
  async calculateBill(request: BillRequest): Promise<Bill> {
    const plan = await this.planStore.getPlan(request.planId);
    const usage = await this.usageTracker.getUsage(request);

    const bill: Bill = {
      id: generateId('bill'),
      tenantId: request.tenantId,
      period: request.period,

      // 基础费用
      baseFee: plan.pricing.baseFee,

      // 使用量费用
      usageCharges: await this.calculateUsageCharges(usage, plan),

      // 超额费用
      overageCharges: await this.calculateOverageCharges(usage, plan),

      // 折扣
      discounts: await this.calculateDiscounts(request, usage, plan),

      // 总计
      subtotal: 0,
      tax: 0,
      total: 0
    };

    bill.subtotal = bill.baseFee +
                    bill.usageCharges.reduce((sum, c) => sum + c.amount, 0) -
                    bill.discounts.reduce((sum, d) => sum + d.amount, 0);

    bill.tax = bill.subtotal * request.taxRate;
    bill.total = bill.subtotal + bill.tax;

    return bill;
  }

  // 计算使用量费用
  private async calculateUsageCharges(
    usage: Usage,
    plan: BillingPlan
  ): Promise<UsageCharge[]> {
    const charges: UsageCharge[] = [];

    // API调用
    if (usage.apiCalls > plan.pricing.included.apiCalls) {
      charges.push({
        type: 'api_calls',
        description: 'API Calls',
        quantity: usage.apiCalls,
        included: plan.pricing.included.apiCalls,
        billed: usage.apiCalls - plan.pricing.included.apiCalls,
        rate: plan.overage.apiCalls,
        amount: (usage.apiCalls - plan.pricing.included.apiCalls) * plan.overage.apiCalls
      });
    }

    // Tokens
    if (usage.tokens > plan.pricing.included.tokens) {
      charges.push({
        type: 'tokens',
        description: 'AI Tokens',
        quantity: usage.tokens,
        included: plan.pricing.included.tokens,
        billed: usage.tokens - plan.pricing.included.tokens,
        rate: plan.overage.tokens,
        amount: (usage.tokens - plan.pricing.included.tokens) * plan.overage.tokens
      });
    }

    // 存储
    if (usage.storage > plan.pricing.included.storage) {
      const gbStored = (usage.storage - plan.pricing.included.storage) / (1024 * 1024 * 1024);
      charges.push({
        type: 'storage',
        description: 'Storage',
        quantity: gbStored,
        included: plan.pricing.included.storage / (1024 * 1024 * 1024),
        billed: gbStored,
        rate: plan.overage.storage,
        amount: gbStored * plan.overage.storage
      });
    }

    return charges;
  }

  // 应用折扣
  private async calculateDiscounts(
    request: BillRequest,
    usage: Usage,
    plan: BillingPlan
  ): Promise<Discount[]> {
    const discounts: Discount[] = [];

    // 年付折扣
    if (request.billingInterval === 'year') {
      discounts.push({
        type: 'annual_commitment',
        description: 'Annual Payment Discount',
        amount: (plan.pricing.baseFee * 12) * 0.2, // 20%年付折扣
        code: 'ANNUAL20'
      });
    }

    // 量大折扣
    if (usage.tokens > 10000000) { // 10M tokens
      discounts.push({
        type: 'volume_discount',
        description: 'High Volume Discount',
        amount: usage.tokens * plan.overage.tokens * 0.1, // 10%折扣
        code: 'VOL10'
      });
    }

    return discounts;
  }
}

// 账单
interface Bill {
  id: string;
  tenantId: string;
  period: {
    start: Date;
    end: Date;
  };

  baseFee: number;
  usageCharges: UsageCharge[];
  overageCharges: UsageCharge[];
  discounts: Discount[];

  subtotal: number;
  tax: number;
  total: number;

  status: 'draft' | 'issued' | 'paid' | 'overdue';
}

// 使用量费用
interface UsageCharge {
  type: string;
  description: string;
  quantity: number;
  included: number;
  billed: number;
  rate: number;
  amount: number;
}

// 折扣
interface Discount {
  type: string;
  description: string;
  amount: number;
  code?: string;
}
```

## 成本分摊

### 成本中心

```typescript
// 成本中心
interface CostCenter {
  id: string;
  name: string;
  type: 'department' | 'team' | 'project' | 'product';

  // 层级结构
  parentId?: string;
  children?: string[];

  // 预算
  budget?: {
    amount: number;
    period: 'month' | 'quarter' | 'year';
    alerts: {
      threshold: number;         // 百分比
      enabled: boolean;
    }[];
  };

  // 成本分摊规则
  allocationRules: AllocationRule[];

  // 财务信息
  financialCode?: string;
  costOwner?: string;
}

// 成本分摊规则
interface AllocationRule {
  id: string;
  name: string;
  priority: number;

  // 条件
  conditions: {
    type: 'always' | 'project_tag' | 'user_department' | 'time_range';
    value: any;
  };

  // 分摊方式
  method: {
    type: 'percentage' | 'fixed' | 'proportional' | 'direct';
    value: number;
  };

  // 目标
  target: {
    type: 'cost_center' | 'account';
    id: string;
  };
}

// 成本分摊服务
class CostAllocationService {
  constructor(
    private costCenterStore: CostCenterStore,
    private allocationEngine: AllocationEngine
  ) {}

  // 分摊成本
  async allocateCost(
    cost: CostEntry,
    options: AllocationOptions
  ): Promise<AllocationResult[]> {
    const allocations: AllocationResult[] = [];

    // 1. 查找适用的成本中心
    const costCenter = await this.costCenterStore.findMatchingCostCenter(cost);

    if (!costCenter) {
      return allocations;
    }

    // 2. 获取分摊规则
    const rules = await this.getApplicableRules(costCenter);

    // 3. 应用规则
    for (const rule of rules) {
      const allocation = await this.applyAllocationRule(cost, rule);
      allocations.push(allocation);
    }

    // 4. 记录分摊结果
    await this.recordAllocations(allocations);

    return allocations;
  }

  // 生成成本报告
  async generateCostReport(
    request: CostReportRequest
  ): Promise<CostReport> {
    const allocations = await this.getAllocations(request);

    // 按成本中心聚合
    const byCostCenter = this.aggregateByCostCenter(allocations);

    // 按类型聚合
    const byType = this.aggregateByType(allocations);

    // 按时间聚合
    const byTime = await this.aggregateByTime(allocations, request.interval);

    return {
      reportId: generateId('cost_report'),
      generatedAt: new Date(),
      period: request.period,
      scope: request.scope,
      summary: {
        totalCost: allocations.reduce((sum, a) => sum + a.amount, 0),
        byCostCenter: byCostCenter.length,
        byType: byType.length
      },
      byCostCenter,
      byType,
      byTime,
      trends: await this.calculateTrends(byTime),
      recommendations: await this.generateRecommendations(byCostCenter, byType)
    };
  }
}

// 分摊结果
interface AllocationResult {
  id: string;
  costEntryId: string;
  costCenterId: string;
  ruleId: string;
  amount: number;
  percentage: number;
  timestamp: Date;
}
```

## 预算管理

### 预算系统

```typescript
// 预算管理器
class BudgetManager {
  constructor(
    private budgetStore: BudgetStore,
    private alertService: AlertService
  ) {}

  // 设置预算
  async setBudget(
    scope: BudgetScope,
    budget: BudgetConfig
  ): Promise<Budget> {
    const newBudget: Budget = {
      id: generateId('budget'),
      ...scope,
      ...budget,
      spent: 0,
      status: 'active',
      createdAt: new Date()
    };

    await this.budgetStore.save(newBudget);
    return newBudget;
  }

  // 检查预算
  async checkBudget(scope: BudgetScope): Promise<BudgetCheckResult> {
    const budget = await this.budgetStore.findActive(scope);
    if (!budget) {
      return { exceeded: false, hasBudget: false };
    }

    const spent = await this.calculateSpent(scope, budget);

    const percentage = (spent / budget.amount) * 100;

    // 检查是否触发告警
    for (const alert of budget.alerts) {
      if (percentage >= alert.threshold && !alert.triggered) {
        await this.triggerBudgetAlert(budget, spent, percentage, alert);
        alert.triggered = true;
        await this.budgetStore.update(budget);
      }
    }

    return {
      exceeded: spent > budget.amount,
      hasBudget: true,
      budgetId: budget.id,
      budgetAmount: budget.amount,
      spent,
      remaining: Math.max(0, budget.amount - spent),
      percentage,
      status: this.getBudgetStatus(percentage)
    };
  }

  // 预算状态
  private getBudgetStatus(percentage: number): BudgetStatus {
    if (percentage >= 100) return 'exceeded';
    if (percentage >= 90) return 'critical';
    if (percentage >= 75) return 'warning';
    if (percentage >= 50) return 'caution';
    return 'healthy';
  }
}

// 预算
interface Budget {
  id: string;
  name: string;
  amount: number;
  period: 'month' | 'quarter' | 'year';
  alerts: {
    threshold: number;
    enabled: boolean;
    triggered?: boolean;
  }[];

  spent: number;
  status: 'active' | 'paused' | 'exceeded';
  createdAt: Date;
}

// 预算范围
interface BudgetScope {
  tenantId?: string;
  costCenterId?: string;
  projectId?: string;
  userId?: string;
}
```

## 报表与分析

### 成本分析

```typescript
// 成本分析服务
class CostAnalysisService {
  constructor(
    private costStore: CostStore,
    private metricsStore: MetricsStore
  ) {}

  // 成本趋势分析
  async analyzeTrends(
    scope: AnalysisScope
  ): Promise<CostTrendAnalysis> {
    // 获取历史数据
    const historical = await this.getHistoricalCosts(scope);

    // 计算趋势
    const trend = this.calculateTrend(historical);

    // 预测未来
    const forecast = this.forecastFutureCosts(historical, scope.forecastPeriods);

    // 异常检测
    const anomalies = this.detectAnomalies(historical);

    return {
      historical,
      trend,
      forecast,
      anomalies,
      insights: this.generateInsights(trend, forecast, anomalies)
    };
  }

  // 成本效益分析
  async analyzeCostEfficiency(
    scope: AnalysisScope
  ): Promise<CostEfficiencyAnalysis> {
    const costs = await this.getCosts(scope);
    const outputs = await this.getOutputs(scope);

    return {
      costPerUnit: costs.total / outputs.total,
      costByCategory: this.aggregateByCategory(costs),
      efficiencyByProject: this.calculateEfficiencyByProject(costs, outputs),
      optimizationOpportunities: await this.findOptimizationOpportunities(costs, outputs)
    };
  }

  // ROI分析
  async analyzeROI(
    scope: AnalysisScope
  ): Promise<ROIAnalysis> {
    const costs = await this.getCosts(scope);
    const value = await this.calculateGeneratedValue(scope);

    const totalCost = costs.total;
    const totalValue = value.total;
    const netValue = totalValue - totalCost;
    const roi = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

    return {
      totalCost,
      totalValue,
      netValue,
      roi,
      paybackPeriod: this.calculatePaybackPeriod(costs, value),
      breakEvenPoint: this.calculateBreakEven(costs, value)
    };
  }
}

// 成本趋势分析
interface CostTrendAnalysis {
  historical: TimeSeriesData[];
  trend: {
    direction: 'increasing' | 'decreasing' | 'stable';
    slope: number;
    significance: number;
  };
  forecast: ForecastData[];
  anomalies: Anomaly[];
  insights: string[];
}
```

## 支付集成

### 支付网关

```typescript
// 支付服务
class PaymentService {
  constructor(
    private paymentProviders: Map<string, PaymentProvider>,
    private invoiceService: InvoiceService
  ) {}

  // 创建订阅
  async createSubscription(
    request: SubscriptionRequest
  ): Promise<Subscription> {
    const plan = await this.planStore.getPlan(request.planId);
    const provider = this.paymentProviders.get(request.paymentMethod.provider);

    const subscription = await provider.createSubscription({
      customerId: request.customerId,
      planId: plan.stripePriceId || plan.id,
      interval: plan.pricing.baseFeeInterval
    });

    return {
      id: subscription.id,
      customerId: request.customerId,
      planId: request.planId,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd
    };
  }

  // 处理Webhook
  async handleWebhook(
    provider: string,
    event: WebhookEvent
  ): Promise<void> {
    const paymentProvider = this.paymentProviders.get(provider);

    switch (event.type) {
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionCancelled(event.data);
        break;

      case 'payment.failed':
        await this.handlePaymentFailed(event.data);
        break;
    }
  }

  // 发票
  async generateInvoice(bill: Bill): Promise<Invoice> {
    return this.invoiceService.generate({
      customerId: bill.tenantId,
      period: bill.period,
      items: [
        { description: 'Base Fee', amount: bill.baseFee },
        ...bill.usageCharges.map(c => ({
          description: `${c.description} (${c.billed} ${c.type})`,
          amount: c.amount
        }))
      ],
      subtotal: bill.subtotal,
      tax: bill.tax,
      total: bill.total
    });
  }
}
```

## 配置

```typescript
// 成本系统配置
interface CostManagementConfig {
  // 成本追踪
  tracking: {
    enabled: boolean;
    granularity: 'realtime' | 'hourly' | 'daily';
    retentionDays: number;
  };

  // 成本源
  costSources: {
    [key in CostType]?: {
      enabled: boolean;
      provider: string;
      unitCost: number;
      unit: string;
    };
  };

  // 计费配置
  billing: {
    currency: string;
    taxRate: number;
    defaultPlan: string;
    billingInterval: 'month' | 'year';
    gracePeriodDays: number;
  };

  // 预算配置
  budget: {
    enabled: boolean;
    defaultAlerts: number[];
    enforcement: 'soft' | 'hard';
  };

  // 报表配置
  reporting: {
    enabled: boolean;
    schedules: {
      daily: boolean;
      weekly: boolean;
      monthly: boolean;
    };
    recipients: string[];
  };

  // 支付配置
  payment: {
    providers: {
      [providerId: string]: {
        enabled: boolean;
        config: Record<string, any>;
      };
    };
    methods: ('card' | 'bank_transfer' | 'invoice')[];
  };
}
```

## 最佳实践

### 1. 成本控制

```
- 实时追踪所有成本
- 设置预算告警
- 定期审查成本趋势
- 优化资源使用
```

### 2. 计费策略

```
- 清晰的定价结构
- 透明的用量报告
- 灵活的套餐选择
- 优惠激励机制
```

### 3. 财务合规

```
- 准确的计量和记录
- 完整的审计日志
- 合规的发票格式
- 税务处理正确
```

---

**最后更新**: 2026-04-15
