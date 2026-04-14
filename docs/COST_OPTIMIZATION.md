# 成本优化设计

## 概述

本文档定义 ProjectFactory 系统的成本优化策略，涵盖云资源成本、LLM 调用成本、人力成本的全面优化方案，目标是在保证系统能力和质量的前提下最大化成本效率。

## 1. 成本结构分析

### 1.1 成本分类

```
总成本 = 基础设施成本 + LLM 成本 + 人力成本 + 运营成本
```

| 成本类型 | 占比 | 可优化性 | 优化优先级 |
|----------|------|----------|------------|
| LLM API 调用 | 60-70% | 🟠 中 | P1 |
| 计算资源 (CPU/GPU) | 15-20% | 🟢 高 | P2 |
| 存储成本 | 5-10% | 🟢 高 | P2 |
| 网络传输 | 3-5% | 🟢 高 | P2 |
| 人力成本 | 70%+ (OPEX) | 🟡 低 | P3 |
| 监控/日志 | 2-3% | 🟠 中 | P2 |

### 1.2 成本模型

```typescript
// src/infra/cost/cost-model.ts
interface CostItem {
  category: 'llm' | 'compute' | 'storage' | 'network' | 'labor';
  service: string;
  unit: string;
  unitCost: number;
  quantity: number;
  period: 'hourly' | 'monthly' | 'per-request';
}

interface CostBudget {
  monthly: number;
  warningThreshold: number;  // 百分比
  criticalThreshold: number;
}

class CostModel {
  private items: CostItem[] = [];
  private budget: CostBudget;

  constructor(budget: CostBudget) {
    this.budget = budget;
  }

  addCostItem(item: CostItem): void {
    this.items.push(item);
  }

  calculateTotalCost(period: 'daily' | 'monthly' | 'yearly'): number {
    return this.items.reduce((total, item) => {
      const baseCost = item.unitCost * item.quantity;

      switch (item.period) {
        case 'hourly':
          return total + baseCost * (period === 'daily' ? 24 : period === 'monthly' ? 720 : 8760);
        case 'monthly':
          return total + baseCost * (period === 'yearly' ? 12 : 1);
        case 'per-request':
          return total + baseCost; // 需要根据请求量调整
        default:
          return total + baseCost;
      }
    }, 0);
  }

  calculateForecast(): { daily: number; monthly: number; yearly: number } {
    return {
      daily: this.calculateTotalCost('daily'),
      monthly: this.calculateTotalCost('monthly'),
      yearly: this.calculateTotalCost('yearly'),
    };
  }

  checkBudget(actualCost: number): { status: 'ok' | 'warning' | 'critical'; percentage: number } {
    const percentage = (actualCost / this.budget.monthly) * 100;

    if (percentage >= this.budget.criticalThreshold) {
      return { status: 'critical', percentage };
    }
    if (percentage >= this.budget.warningThreshold) {
      return { status: 'warning', percentage };
    }
    return { status: 'ok', percentage };
  }

  getCostByCategory(): Map<string, number> {
    const costs = new Map<string, number>();

    for (const item of this.items) {
      const current = costs.get(item.category) || 0;
      costs.set(item.category, current + item.unitCost * item.quantity);
    }

    return costs;
  }
}

// 预设的成本模型
export const costModel = new CostModel({
  monthly: 10000,  // 每月预算 10,000 美元
  warningThreshold: 80,
  criticalThreshold: 95,
});

// LLM 成本计算
const llmCostModel = {
  'gpt-4o': { input: 5.00, output: 15.00, unit: '1M tokens' },
  'gpt-4o-mini': { input: 0.15, output: 0.60, unit: '1M tokens' },
  'claude-3-5-sonnet': { input: 3.00, output: 15.00, unit: '1M tokens' },
  'claude-3-5-haiku': { input: 0.80, output: 4.00, unit: '1M tokens' },
};
```

## 2. LLM 成本优化

### 2.1 模型选择策略

```typescript
// src/agents/llm/model-selector.ts
interface ModelCapability {
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  reasoning: boolean;
  vision: boolean;
  costPer1MInputTokens: number;
  costPer1MOutputTokens: number;
}

const availableModels: ModelCapability[] = [
  {
    name: 'gpt-4o',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    reasoning: true,
    vision: true,
    costPer1MInputTokens: 5.00,
    costPer1MOutputTokens: 15.00,
  },
  {
    name: 'gpt-4o-mini',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    reasoning: true,
    vision: false,
    costPer1MInputTokens: 0.15,
    costPer1MOutputTokens: 0.60,
  },
  {
    name: 'claude-3-5-sonnet',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    reasoning: true,
    vision: true,
    costPer1MInputTokens: 3.00,
    costPer1MOutputTokens: 15.00,
  },
  {
    name: 'claude-3-5-haiku',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    reasoning: true,
    vision: false,
    costPer1MInputTokens: 0.80,
    costPer1MOutputTokens: 4.00,
  },
];

type TaskComplexity = 'low' | 'medium' | 'high';

class ModelSelector {
  // 任务类型到复杂度的映射
  private taskComplexityMap: Record<string, TaskComplexity> = {
    'simple-code-generation': 'low',
    'code-review-quick': 'low',
    'file-creation': 'low',
    'architecture-design': 'high',
    'complex-code-generation': 'high',
    'detailed-code-review': 'medium',
    'test-generation': 'medium',
    'documentation-generation': 'medium',
    'idea-evaluation': 'medium',
    'quality-assessment': 'high',
  };

  // 复杂度到模型的映射
  private complexityToModel: Record<TaskComplexity, string> = {
    low: 'gpt-4o-mini',
    medium: 'claude-3-5-haiku',
    high: 'gpt-4o',
  };

  selectModel(taskType: string, contextSize?: number): string {
    const complexity = this.taskComplexityMap[taskType] || 'medium';

    // 检查上下文大小是否超过模型限制
    const candidateModel = availableModels.find(m => m.name === this.complexityToModel[complexity]);

    if (contextSize && candidateModel && contextSize > candidateModel.contextWindow) {
      // 需要选择更大上下文的模型
      const largerModel = availableModels
        .filter(m => m.contextWindow >= contextSize)
        .sort((a, b) => a.costPer1MInputTokens - b.costPer1MInputTokens)[0];

      return largerModel?.name || candidateModel.name;
    }

    return this.complexityToModel[complexity];
  }

  estimateCost(taskType: string, inputTokens: number, outputTokens: number): number {
    const modelName = this.selectModel(taskType);
    const model = availableModels.find(m => m.name === modelName);

    if (!model) return 0;

    const inputCost = (inputTokens / 1_000_000) * model.costPer1MInputTokens;
    const outputCost = (outputTokens / 1_000_000) * model.costPer1MOutputTokens;

    return inputCost + outputCost;
  }

  getOptimalModelForTask(taskType: string, requiredCapabilities: string[]): string {
    // 过滤满足能力要求的模型
    const capableModels = availableModels.filter(model => {
      if (requiredCapabilities.includes('reasoning') && !model.reasoning) return false;
      if (requiredCapabilities.includes('vision') && !model.vision) return false;
      return true;
    });

    // 按成本排序，选择最便宜的
    return capableModels.sort((a, b) =>
      a.costPer1MInputTokens - b.costPer1MInputTokens
    )[0]?.name || 'gpt-4o-mini';
  }
}

export const modelSelector = new ModelSelector();
```

### 2.2 Prompt 压缩

```typescript
// src/agents/llm/prompt-compression.ts
class PromptCompressor {
  // 移除冗余格式
  compress(prompt: string): string {
    return prompt
      .replace(/\s+/g, ' ')           // 合并空白
      .replace(/<!--[\s\S]*?-->/g, '') // 移除 HTML 注释
      .trim();
  }

  // 上下文摘要压缩
  async compressContext(
    context: Array<{ role: string; content: string }>,
    maxTokens: number
  ): Promise<Array<{ role: string; content: string }>> {
    const currentTokens = await this.countTokens(context);

    if (currentTokens <= maxTokens) {
      return context;
    }

    // 按重要性排序：系统消息 > 用户消息 > 助手消息
    const sorted = this.sortByImportance(context);

    // 迭代压缩直到满足 token 限制
    let compressed = sorted;
    while (await this.countTokens(compressed) > maxTokens) {
      compressed = this.reduceTokens(compressed);
    }

    return this.reassembleMessages(compressed);
  }

  private sortByImportance(messages: Array<{ role: string; content: string }>) {
    const rolePriority = { system: 3, user: 2, assistant: 1 };
    return [...messages].sort((a, b) =>
      (rolePriority[b.role as keyof typeof rolePriority] || 0) -
      (rolePriority[a.role as keyof typeof rolePriority] || 0)
    );
  }

  private reduceTokens(messages: Array<{ role: string; content: string }>) {
    // 减少每个消息的内容
    return messages.map(msg => ({
      ...msg,
      content: msg.content.slice(0, msg.content.length * 0.8),
    }));
  }

  private reassembleMessages(messages: Array<{ role: string; content: string }>) {
    // 保持消息顺序
    return messages;
  }

  private async countTokens(messages: Array<{ role: string; content: string }>): Promise<number> {
    // 简化的 token 计数
    const text = messages.map(m => m.content).join(' ');
    return Math.ceil(text.length / 4); // 粗略估算
  }
}

export const promptCompressor = new PromptCompressor();
```

### 2.3 缓存与复用

```typescript
// src/agents/llm/response-caching.ts
interface CachedLLMResponse {
  promptHash: string;
  response: unknown;
  model: string;
  createdAt: number;
  accessCount: number;
  hitCount: number;
}

class LLMResponseCache {
  private cache = new Map<string, CachedLLMResponse>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize = 10000, ttlMs = 7 * 24 * 3600 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  generateKey(prompt: string, model: string, options?: Record<string, unknown>): string {
    // 使用 prompt + model + options 的哈希作为缓存键
    const data = JSON.stringify({ prompt, model, options });
    return this.hash(data);
  }

  private hash(data: string): string {
    // 简单的哈希实现
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  get(key: string): CachedLLMResponse | undefined {
    const cached = this.cache.get(key);

    if (!cached) return undefined;

    if (Date.now() - cached.createdAt > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    cached.hitCount++;
    cached.accessCount++;
    return cached;
  }

  set(key: string, response: unknown, model: string): void {
    if (this.cache.size >= this.maxSize) {
      this.evict();
    }

    this.cache.set(key, {
      promptHash: key,
      response,
      model,
      createdAt: Date.now(),
      accessCount: 1,
      hitCount: 0,
    });
  }

  private evict(): void {
    // LRU 驱逐策略
    let oldest: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, value] of this.cache) {
      if (value.accessCount < oldestAccess) {
        oldestAccess = value.accessCount;
        oldest = key;
      }
    }

    if (oldest) this.cache.delete(oldest);
  }

  getStats(): { size: number; hitRate: number; totalHits: number } {
    let totalHits = 0;
    let totalAccess = 0;

    for (const value of this.cache.values()) {
      totalHits += value.hitCount;
      totalAccess += value.accessCount;
    }

    return {
      size: this.cache.size,
      hitRate: totalAccess > 0 ? totalHits / totalAccess : 0,
      totalHits,
    };
  }
}

export const llmResponseCache = new LLMResponseCache();
```

### 2.4 批量处理与分页

```typescript
// src/agents/llm/batch-processing.ts
interface LLMBatchItem {
  id: string;
  prompt: string;
  options?: LLMOptions;
  priority: 'high' | 'normal' | 'low';
}

class LLMBatchProcessor {
  private queue: LLMBatchItem[] = [];
  private processing = false;
  private batchSize = 10;
  private batchWindowMs = 500;  // 500ms 窗口内收集请求

  async addToBatch(item: LLMBatchItem): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.queue.push({ ...item, resolve: resolve as any, reject });
      if (!this.processing) {
        this.processing = true;
        setTimeout(() => this.processBatch(), this.batchWindowMs);
      }
    });
  }

  private async processBatch(): Promise<void> {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    // 按优先级排序
    this.queue.sort((a, b) => {
      const priority = { high: 0, normal: 1, low: 2 };
      return priority[a.priority] - priority[b.priority];
    });

    // 取出当前批次
    const batch = this.queue.splice(0, this.batchSize);

    try {
      // 并发处理批次（受并发限制控制）
      const results = await Promise.all(
        batch.map(item => this.executeLLM(item.prompt, item.options))
      );

      // 分发结果
      batch.forEach((item, i) => {
        item.resolve(results[i]);
      });
    } catch (error) {
      batch.forEach(item => item.reject(error));
    }

    // 继续处理下一批次
    if (this.queue.length > 0) {
      setTimeout(() => this.processBatch(), 100);
    } else {
      this.processing = false;
    }
  }

  private async executeLLM(prompt: string, options?: LLMOptions): Promise<unknown> {
    // 检查缓存
    const cacheKey = llmResponseCache.generateKey(prompt, options?.model || 'default');
    const cached = llmResponseCache.get(cacheKey);
    if (cached) {
      return cached.response;
    }

    // 调用 LLM
    const response = await llm.invoke(prompt, options);

    // 缓存结果
    llmResponseCache.set(cacheKey, response, options?.model || 'default');

    return response;
  }
}

export const llmBatchProcessor = new LLMBatchProcessor();
```

## 3. 基础设施成本优化

### 3.1 计算资源优化

```typescript
// src/infra/compute/smart-scaling.ts
interface ScalingConfig {
  minInstances: number;
  maxInstances: number;
  scaleUpThreshold: number;    // CPU 使用率阈值
  scaleUpCooldown: number;     // 扩容冷却时间（秒）
  scaleDownThreshold: number;  // 缩容阈值
  scaleDownCooldown: number;   // 缩容冷却时间（秒）
  targetCPUUtilization: number;
}

class SmartScalingManager {
  private config: ScalingConfig;
  private currentInstances: number = 1;
  private lastScaleUp: number = 0;
  private lastScaleDown: number = 0;
  private metrics: MetricsCollector;

  constructor(config: ScalingConfig, metrics: MetricsCollector) {
    this.config = config;
    this.metrics = metrics;
  }

  async evaluate(): Promise<{ action: 'scale_up' | 'scale_down' | 'none'; instances: number }> {
    const cpuUtilization = await this.metrics.getCPUUtilization();
    const requestQueue = await this.metrics.getRequestQueueDepth();
    const avgLatency = await this.metrics.getAverageLatency();

    // 扩容条件
    const shouldScaleUp =
      (cpuUtilization > this.config.scaleUpThreshold * 100 ||
       requestQueue > 100 ||
       avgLatency > 1000) &&
      this.currentInstances < this.config.maxInstances &&
      Date.now() - this.lastScaleUp > this.config.scaleUpCooldown * 1000;

    if (shouldScaleUp) {
      const newInstances = Math.min(
        this.currentInstances + 1,
        this.config.maxInstances
      );
      return { action: 'scale_up', instances: newInstances };
    }

    // 缩容条件
    const shouldScaleDown =
      cpuUtilization < this.config.scaleDownThreshold * 100 &&
      requestQueue < 10 &&
      avgLatency < 100 &&
      this.currentInstances > this.config.minInstances &&
      Date.now() - this.lastScaleDown > this.config.scaleDownCooldown * 1000;

    if (shouldScaleDown) {
      const newInstances = Math.max(
        this.currentInstances - 1,
        this.config.minInstances
      );
      return { action: 'scale_down', instances: newInstances };
    }

    return { action: 'none', instances: this.currentInstances };
  }

  async scaleTo(targetInstances: number): Promise<void> {
    console.log(`Scaling from ${this.currentInstances} to ${targetInstances} instances`);

    // 执行扩容/缩容操作
    // await this.executeScaling(targetInstances);

    if (targetInstances > this.currentInstances) {
      this.lastScaleUp = Date.now();
    } else {
      this.lastScaleDown = Date.now();
    }

    this.currentInstances = targetInstances;
  }

  getCurrentInstances(): number {
    return this.currentInstances;
  }
}

// 成本感知的调度器
class CostAwareScheduler {
  private scalingManager: SmartScalingManager;

  async scheduleOffPeakReduction(): Promise<void> {
    // 在低峰期自动缩减
    const hour = new Date().getHours();

    if (hour >= 22 || hour < 6) {
      // 夜间低峰期
      await this.scalingManager.scaleTo(1);
    } else if (hour >= 9 && hour < 18) {
      // 工作时间
      await this.scalingManager.scaleTo(3);
    } else {
      // 其他时间
      await this.scalingManager.scaleTo(2);
    }
  }
}
```

### 3.2 Spot/Preemptible 实例

```typescript
// src/infra/compute/spot-manager.ts
interface SpotInstanceConfig {
  percentageDiscount: number;   // vs On-Demand 价格
  maxPrice: number;             // 最高愿意支付价格
  interruptionBehavior: 'terminate' | 'stop' | 'hibernate';
  replacementTimeout: number;   // 替换超时（秒）
}

class SpotInstanceManager {
  private config: SpotInstanceConfig;
  private currentSpotInstances: string[] = [];
  private onDemandInstances: string[] = [];
  private interruptionHandler: (instanceId: string) => Promise<void>;

  constructor(config: SpotInstanceConfig) {
    this.config = config;
    this.setupInterruptionHandler();
  }

  private setupInterruptionHandler(): void {
    // 设置 Spot 实例中断处理
    // AWS: Register instance notifcation handler
    // GCP: Set up preemptible instance shutdown script
  }

  async launchSpotInstances(count: number): Promise<string[]> {
    const instanceIds: string[] = [];

    for (let i = 0; i < count; i++) {
      try {
        const instanceId = await this.requestSpotInstance({
          maxPrice: this.config.maxPrice,
          interruptionBehavior: this.config.interruptionBehavior,
        });
        instanceIds.push(instanceId);
        this.currentSpotInstances.push(instanceId);
      } catch (error) {
        console.error(`Failed to launch spot instance ${i}:`, error);
      }
    }

    return instanceIds;
  }

  async handleInterruption(instanceId: string): Promise<void> {
    console.log(`Spot instance ${instanceId} interrupted`);

    // 1. 优雅地迁移工作负载
    await this.migrateWorkload(instanceId);

    // 2. 启动替换实例
    const newInstance = await this.launchSpotInstances(1);

    // 3. 更新路由
    await this.updateLoadBalancer(newInstance);

    // 4. 从列表中移除
    this.currentSpotInstances = this.currentSpotInstances.filter(id => id !== instanceId);
  }

  private async migrateWorkload(instanceId: string): Promise<void> {
    // 将该实例上的工作迁移到 On-Demand 或其他 Spot 实例
    const targetInstance = this.onDemandInstances[0] || this.currentSpotInstances[0];

    if (targetInstance) {
      // 等待现有连接完成
      await this.drainConnections(instanceId);
      // 执行工作迁移
      await this.migrateToTarget(instanceId, targetInstance);
    }
  }

  async calculateSavings(): Promise<{ monthly: number; vsOnDemand: number; percentage: number }> {
    const spotCount = this.currentSpotInstances.length;
    const onDemandCount = this.onDemandInstances.length;

    const onDemandPrice = 0.10; // 每小时每实例
    const spotPrice = onDemandPrice * (1 - this.config.percentageDiscount / 100);

    const monthlyOnDemand = (spotCount + onDemandCount) * onDemandPrice * 730;
    const monthlySpot = (spotCount * spotPrice + onDemandCount * onDemandPrice) * 730;

    return {
      monthly: monthlySpot,
      vsOnDemand: monthlyOnDemand,
      percentage: ((monthlyOnDemand - monthlySpot) / monthlyOnDemand) * 100,
    };
  }
}

export const spotManager = new SpotInstanceManager({
  percentageDiscount: 60,        // 60% 折扣
  maxPrice: 0.05,                 // 最高 $0.05/小时
  interruptionBehavior: 'hibernate',
  replacementTimeout: 60,
});
```

### 3.3 存储成本优化

```typescript
// src/infra/storage/storage-optimizer.ts
interface StorageTier {
  name: 'hot' | 'warm' | 'cold' | 'archive';
  retention: number;        // 天数
  accessLatency: string;
  costPerGBMonth: number;
}

const storageTiers: StorageTier[] = [
  { name: 'hot', retention: 7, accessLatency: '<10ms', costPerGBMonth: 0.023 },
  { name: 'warm', retention: 30, accessLatency: '<100ms', costPerGBMonth: 0.01 },
  { name: 'cold', retention: 90, accessLatency: '<1s', costPerGBMonth: 0.004 },
  { name: 'archive', retention: 365, accessLatency: '<1h', costPerGBMonth: 0.00099 },
];

class StorageTierManager {
  private currentTier: Map<string, string> = new Map();

  async moveToTier(resourceId: string, targetTier: string): Promise<void> {
    const currentTierName = this.currentTier.get(resourceId);

    if (currentTierName === targetTier) return;

    console.log(`Moving ${resourceId} from ${currentTierName} to ${targetTier}`);

    // 执行数据迁移
    // await this.executeMigration(resourceId, targetTier);

    this.currentTier.set(resourceId, targetTier);
  }

  async autoTier(): Promise<void> {
    // 分析每个资源的访问模式
    const resources = await this.getAllStorageResources();

    for (const resource of resources) {
      const accessPattern = await this.analyzeAccessPattern(resource.id);
      const recommendedTier = this.calculateOptimalTier(accessPattern);

      if (recommendedTier !== this.currentTier.get(resource.id)) {
        await this.moveToTier(resource.id, recommendedTier);
      }
    }
  }

  private async analyzeAccessPattern(resourceId: string): Promise<{
    accessFrequency: number;
    lastAccess: number;
    dataSize: number;
  }> {
    // 分析最近 30 天的访问模式
    return {
      accessFrequency: 10,    // 每天访问次数
      lastAccess: Date.now(),
      dataSize: 1024 * 1024 * 1024, // 1GB
    };
  }

  private calculateOptimalTier(pattern: { accessFrequency: number; lastAccess: number }): string {
    const daysSinceAccess = (Date.now() - pattern.lastAccess) / (24 * 3600 * 1000);

    if (pattern.accessFrequency > 100 || daysSinceAccess < 7) {
      return 'hot';
    } else if (pattern.accessFrequency > 10 || daysSinceAccess < 30) {
      return 'warm';
    } else if (pattern.accessFrequency > 1 || daysSinceAccess < 90) {
      return 'cold';
    }
    return 'archive';
  }

  async calculateMonthlyCost(): Promise<number> {
    let totalCost = 0;

    for (const [resourceId, tierName] of this.currentTier) {
      const tier = storageTiers.find(t => t.name === tierName);
      if (tier) {
        const resourceSize = await this.getResourceSize(resourceId);
        totalCost += (resourceSize / (1024 * 1024 * 1024)) * tier.costPerGBMonth;
      }
    }

    return totalCost;
  }
}

export const storageOptimizer = new StorageTierManager();
```

## 4. 数据传输成本优化

### 4.1 网络优化策略

```typescript
// src/infra/network/cost-optimizer.ts
class NetworkCostOptimizer {
  // 使用 CDN 减少跨区域流量
  async getOptimalEndpoint(userLocation: string): Promise<string> {
    const endpoints = {
      'us-west': 'api-us-west.projectfactory.io',
      'us-east': 'api-us-east.projectfactory.io',
      'eu': 'api-eu.projectfactory.io',
      'apac': 'api-apac.projectfactory.io',
    };

    return endpoints[userLocation as keyof typeof endpoints] || endpoints['us-east'];
  }

  // 压缩传输数据
  compressPayload(payload: unknown): { data: string; compression: string } {
    const json = JSON.stringify(payload);

    if (json.length > 1024) {
      // 使用 gzip 压缩
      return {
        data: this.gzipCompress(json),
        compression: 'gzip',
      };
    }

    return { data: json, compression: 'none' };
  }

  // 批量请求减少连接开销
  async batchRequests<T>(
    items: Array<{ endpoint: string; params: unknown }>,
    batchSize = 50
  ): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await this.executeBatch(batch);
      results.push(...batchResults);
    }

    return results;
  }

  private async executeBatch<T>(batch: Array<{ endpoint: string; params: unknown }>): Promise<T[]> {
    // 将多个请求合并为一个
    return Promise.all(
      batch.map(item => this.executeRequest(item.endpoint, item.params))
    );
  }

  private gzipCompress(data: string): string {
    // 实现 gzip 压缩
    return data;
  }

  private async executeRequest<T>(endpoint: string, params: unknown): Promise<T> {
    // 执行请求
    return {} as T;
  }
}

export const networkOptimizer = new NetworkCostOptimizer();
```

### 4.2 API 调用优化

```typescript
// src/infra/api/api-cost-tracker.ts
interface APICallMetrics {
  endpoint: string;
  method: string;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
  avgLatency: number;
  cacheHitRate: number;
}

class APICallCostTracker {
  private metrics: Map<string, APICallMetrics> = new Map();

  recordCall(
    endpoint: string,
    method: string,
    tokens: number,
    cost: number,
    cacheHit: boolean,
    latency: number
  ): void {
    const key = `${method}:${endpoint}`;
    const existing = this.metrics.get(key) || {
      endpoint,
      method,
      requestCount: 0,
      totalTokens: 0,
      totalCost: 0,
      avgLatency: 0,
      cacheHitRate: 0,
    };

    const newCount = existing.requestCount + 1;
    const newCacheHits = (existing.cacheHitRate * existing.requestCount + (cacheHit ? 1 : 0));

    this.metrics.set(key, {
      ...existing,
      requestCount: newCount,
      totalTokens: existing.totalTokens + tokens,
      totalCost: existing.totalCost + cost,
      avgLatency: (existing.avgLatency * existing.requestCount + latency) / newCount,
      cacheHitRate: newCacheHits / newCount,
    });
  }

  getTopCostEndpoints(limit = 10): APICallMetrics[] {
    return Array.from(this.metrics.values())
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, limit);
  }

  getTotalCost(): number {
    return Array.from(this.metrics.values())
      .reduce((sum, m) => sum + m.totalCost, 0);
  }

  generateCostReport(): {
    totalCost: number;
    byEndpoint: APICallMetrics[];
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    const topCost = this.getTopCostEndpoints(3);

    for (const metric of topCost) {
      if (metric.cacheHitRate < 0.3) {
        recommendations.push(
          `Consider adding caching for ${metric.endpoint} (current hit rate: ${(metric.cacheHitRate * 100).toFixed(1)}%)`
        );
      }

      if (metric.avgLatency > 1000) {
        recommendations.push(
          `High latency detected for ${metric.endpoint}: ${metric.avgLatency.toFixed(0)}ms`
        );
      }
    }

    return {
      totalCost: this.getTotalCost(),
      byEndpoint: topCost,
      recommendations,
    };
  }
}

export const costTracker = new APICallCostTracker();
```

## 5. 成本监控与告警

### 5.1 成本指标定义

```typescript
// src/infra/monitoring/cost-metrics.ts
const costMetrics = {
  // LLM 成本
  llmCostPerProject: {
    type: 'gauge',
    description: '单个项目的 LLM 成本（美元）',
    target: { warning: 5, critical: 10 },
  },
  llmCostPer1KTokens: {
    type: 'gauge',
    description: '每千 token 的平均成本',
    target: { warning: 0.5, critical: 1 },
  },
  llmCacheHitRate: {
    type: 'gauge',
    description: 'LLM 响应缓存命中率',
    target: { warning: 0.3, critical: 0.2 }, // 高于这些值才是好的
  },

  // 基础设施成本
  computeCostPerHour: {
    type: 'gauge',
    description: '每小时计算成本',
    target: { warning: 0.5, critical: 1 },
  },
  storageCostPerGB: {
    type: 'gauge',
    description: '每 GB 存储月成本',
    target: { warning: 0.05, critical: 0.1 },
  },
  networkCostPerGB: {
    type: 'gauge',
    description: '每 GB 网络传输成本',
    target: { warning: 0.1, critical: 0.2 },
  },

  // 效率指标
  costPerCompletedProject: {
    type: 'gauge',
    description: '每个已完成项目的总成本',
    target: { warning: 10, critical: 20 },
  },
  costEfficiencyRatio: {
    type: 'gauge',
    description: '成本效率比（产出/成本）',
    target: { warning: 0.5, critical: 0.2 }, // 高于这些值才是好的
  },
};
```

### 5.2 成本告警规则

```typescript
// src/infra/monitoring/cost-alerts.ts
const costAlertRules = [
  {
    name: 'daily_cost_threshold',
    condition: () => {
      const todayCost = getTodayCost();
      const dailyBudget = getMonthlyBudget() / 30;
      return todayCost > dailyBudget;
    },
    severity: 'warning',
    message: 'Daily cost exceeds proportional budget',
  },
  {
    name: 'monthly_budget_80pct',
    condition: () => {
      const monthlyCost = getMonthCost();
      const budget = getMonthlyBudget();
      return monthlyCost > budget * 0.8;
    },
    severity: 'warning',
    message: 'Monthly cost has reached 80% of budget',
  },
  {
    name: 'monthly_budget_95pct',
    condition: () => {
      const monthlyCost = getMonthCost();
      const budget = getMonthlyBudget();
      return monthlyCost > budget * 0.95;
    },
    severity: 'critical',
    message: 'Monthly cost has reached 95% of budget - immediate action required',
  },
  {
    name: 'anomalous_spend_increase',
    condition: () => {
      const todayCost = getTodayCost();
      const avgDailyCost = getAvgDailyCostLast7Days();
      return todayCost > avgDailyCost * 3;
    },
    severity: 'critical',
    message: 'Anomalous cost increase detected - possible cost anomaly',
  },
  {
    name: 'high_llm_cost',
    condition: () => {
      const llmCost = getLLMCostToday();
      const avgLLMCost = getAvgDailyLLMCostLast7Days();
      return llmCost > avgLLMCost * 2;
    },
    severity: 'warning',
    message: 'LLM costs are significantly higher than average',
  },
];

// 成本异常检测
class CostAnomalyDetector {
  private historicalData: Array<{ date: string; cost: number }> = [];

  async detectAnomalies(currentCost: number): Promise<{ isAnomalous: boolean; deviation: number }> {
    if (this.historicalData.length < 7) {
      return { isAnomalous: false, deviation: 0 };
    }

    const mean = this.historicalData.reduce((sum, d) => sum + d.cost, 0) / this.historicalData.length;
    const variance = this.historicalData.reduce((sum, d) => sum + Math.pow(d.cost - mean, 2), 0) / this.historicalData.length;
    const stdDev = Math.sqrt(variance);

    const deviation = Math.abs(currentCost - mean) / (stdDev || 1);

    return {
      isAnomalous: deviation > 2.5,
      deviation,
    };
  }

  recordCost(date: string, cost: number): void {
    this.historicalData.push({ date, cost });
    if (this.historicalData.length > 30) {
      this.historicalData.shift();
    }
  }
}
```

## 6. 成本优化效果评估

### 6.1 ROI 计算模型

```typescript
// src/infra/cost/roi-calculator.ts
interface CostOptimization {
  name: string;
  implementationCost: number;
  monthlySavings: number;
  timeframe: number;  // 月
}

class ROICalculator {
  calculateROI(optimization: CostOptimization): {
    totalSavings: number;
    netSavings: number;
    paybackMonths: number;
    roi: number;
  } {
    const totalSavings = optimization.monthlySavings * optimization.timeframe;
    const netSavings = totalSavings - optimization.implementationCost;
    const paybackMonths = optimization.implementationCost / optimization.monthlySavings;
    const roi = (netSavings / optimization.implementationCost) * 100;

    return {
      totalSavings,
      netSavings,
      paybackMonths,
      roi,
    };
  }

  prioritizeOptimizations(optimizations: CostOptimization[]): CostOptimization[] {
    // 按 ROI 排序
    return optimizations
      .map(opt => ({
        ...opt,
        roi: this.calculateROI(opt).roi,
      }))
      .sort((a, b) => b.roi - a.roi);
  }
}

const optimizationOptions: CostOptimization[] = [
  {
    name: 'LLM Response Caching',
    implementationCost: 5000,
    monthlySavings: 3000,  // 50% LLM 成本节省
    timeframe: 12,
  },
  {
    name: 'Spot Instances (60%)',
    implementationCost: 8000,
    monthlySavings: 2000,
    timeframe: 12,
  },
  {
    name: 'Model Downgrade for Simple Tasks',
    implementationCost: 2000,
    monthlySavings: 1500,
    timeframe: 12,
  },
  {
    name: 'Auto-tiering Storage',
    implementationCost: 3000,
    monthlySavings: 500,
    timeframe: 12,
  },
];
```

### 6.2 成本报告模板

```typescript
// src/infra/cost/report-generator.ts
interface CostReport {
  period: { start: Date; end: Date };
  summary: {
    totalCost: number;
    budget: number;
    variance: number;
    variancePercentage: number;
  };
  byCategory: Array<{
    category: string;
    cost: number;
    percentage: number;
    vsLastPeriod: number;
  }>;
  byService: Array<{
    service: string;
    cost: number;
    percentage: number;
  }>;
  trends: Array<{
    date: string;
    cost: number;
    cumulative: number;
  }>;
  topCostDrivers: Array<{
    resource: string;
    cost: number;
    recommendation: string;
  }>;
  savingsAchievements: Array<{
    optimization: string;
    implementedDate: Date;
    actualSavings: number;
    vsProjected: number;
  }>;
  forecast: {
    monthlyProjection: number;
    quarterlyProjection: number;
    annualProjection: number;
  };
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    estimatedSavings: number;
    effort: 'low' | 'medium' | 'high';
  }>;
}

class CostReportGenerator {
  async generateReport(startDate: Date, endDate: Date): Promise<CostReport> {
    const costData = await this.fetchCostData(startDate, endDate);
    const lastPeriodData = await this.fetchCostData(
      new Date(startDate.getTime() - 30 * 24 * 3600 * 1000),
      startDate
    );

    return {
      period: { start: startDate, end: endDate },
      summary: this.calculateSummary(costData),
      byCategory: this.breakdownByCategory(costData),
      byService: this.breakdownByService(costData),
      trends: this.calculateTrends(costData),
      topCostDrivers: this.identifyCostDrivers(costData),
      savingsAchievements: await this.getSavingsAchievements(),
      forecast: this.generateForecast(costData),
      recommendations: this.generateRecommendations(costData),
    };
  }

  async sendReport(report: CostReport): Promise<void> {
    const emailContent = this.formatAsEmail(report);
    // await sendEmail('cost-team@company.com', 'Monthly Cost Report', emailContent);
  }
}
```

---

**最后更新**: 2026-04-14
**版本**: v1.0
