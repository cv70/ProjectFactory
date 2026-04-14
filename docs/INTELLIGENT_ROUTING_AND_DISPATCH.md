# 智能路由与任务分发系统设计

## 概述

智能路由与任务分发系统是无限生成系统的核心调度层，负责将生成请求智能地路由到最合适的Agent、计算资源和执行环境。没有智能路由，系统将无法高效利用资源，也无法提供差异化的服务质量。

## 核心价值

```
智能调度 = 路由 × 负载均衡 × 优先级 × 亲和性

路由系统的核心价值：
1. 资源优化 - 将请求路由到最合适的资源
2. 负载均衡 - 防止单点过载
3. 差异化服务 - 满足不同SLA需求
4. 成本优化 - 优先使用低成本资源
5. 容错路由 - 失败自动重路由
```

## 路由策略

### 路由类型

```typescript
// 路由策略枚举
enum RoutingStrategy {
  // 基础策略
  RANDOM = 'random',                 // 随机路由
  ROUND_ROBIN = 'round_robin',     // 轮询路由
  LEAST_LOADED = 'least_loaded',   // 最小负载

  // 智能策略
  CAPABILITY_MATCH = 'capability_match',   // 能力匹配
  QUALITY_AWARE = 'quality_aware',       // 质量感知
  COST_AWARE = 'cost_aware',             // 成本感知
  LATENCY_AWARE = 'latency_aware',       // 延迟感知

  // 高级策略
  MULTI_CRITERIA = 'multi_criteria',     // 多标准路由
  ML_BASED = 'ml_based',               // ML预测路由
  EDGE_COMPUTING = 'edge_computing'     // 边缘计算路由
}

// 路由策略配置
interface RoutingStrategyConfig {
  strategy: RoutingStrategy;

  // 策略特定配置
  config: {
    // 权重配置 (多标准路由)
    weights?: {
      capability: number;          // 能力权重
      load: number;               // 负载权重
      latency: number;            // 延迟权重
      cost: number;              // 成本权重
      quality: number;            // 质量权重
    };

    // 阈值配置
    thresholds?: {
      maxLatency?: number;        // 最大延迟 (ms)
      maxLoad?: number;          // 最大负载 (0-1)
      minQuality?: number;        // 最低质量分
      maxCost?: number;           // 最大成本
    };

    // 回退配置
    fallback?: {
      strategy: RoutingStrategy;
      maxRetries: number;
    };
  };
}
```

### 路由决策器

```typescript
// 路由决策器
class RoutingDecider {
  constructor(
    private registry: ServiceRegistry,
    private metricsCollector: MetricsCollector,
    private model: RoutingModel
  ) {}

  // 做出路由决策
  async decide(request: RoutingRequest): Promise<RoutingDecision> {
    // 1. 分析请求
    const requirements = this.analyzeRequirements(request);

    // 2. 获取可用服务
    const candidates = await this.getCandidates(requirements);

    // 3. 评估每个候选
    const scored = await this.scoreCandidates(candidates, requirements);

    // 4. 选择最佳
    const selected = this.selectBest(scored, request.priority);

    // 5. 记录决策
    await this.recordDecision(request, selected);

    return selected;
  }

  // 分析请求需求
  private analyzeRequirements(request: RoutingRequest): RequirementAnalysis {
    return {
      // 任务类型
      taskType: this.classifyTask(request.task),

      // 所需能力
      requiredCapabilities: this.extractCapabilities(request.task),

      // 性能要求
      latencyRequirement: request.sla?.maxLatency,
      qualityRequirement: request.sla?.minQuality,

      // 资源要求
      memoryRequirement: request.resources?.memory,
      cpuRequirement: request.resources?.cpu,

      // 约束
      constraints: request.constraints,

      // 优先级
      priority: request.priority,
      tenantId: request.tenantId
    };
  }

  // 任务分类
  private classifyTask(task: GenerationTask): TaskType {
    // 基于任务特征分类
    if (task.type === 'code_generation') {
      if (task.complexity === 'high') return 'complex_coding';
      if (task.language === 'rust' || task.language === 'go') return 'systems_coding';
      return 'standard_coding';
    }

    if (task.type === 'test_generation') return 'testing';
    if (task.type === 'review') return 'review';
    if (task.type === 'architecture_design') return 'architecture';

    return 'general';
  }

  // 提取所需能力
  private extractCapabilities(task: GenerationTask): string[] {
    const capabilities: string[] = [];

    // 基础能力
    capabilities.push('code_generation');

    // 语言特定能力
    if (task.language) {
      capabilities.push(`lang_${task.language}`);
    }

    // 框架特定能力
    if (task.framework) {
      capabilities.push(`framework_${task.framework}`);
    }

    // 任务特定能力
    if (task.type === 'test_generation') {
      capabilities.push('testing', `test_${task.language || 'any'}`);
    }

    if (task.type === 'review') {
      capabilities.push('code_review');
    }

    return capabilities;
  }

  // 评估候选服务
  private async scoreCandidates(
    candidates: ServiceInstance[],
    requirements: RequirementAnalysis
  ): Promise<ScoredCandidate[]> {
    return Promise.all(
      candidates.map(async (candidate) => {
        // 多维度评分
        const scores = await this.calculateScores(candidate, requirements);

        // 加权求和
        const totalScore = this.weightedSum(scores);

        // 风险评估
        const risk = await this.assessRisk(candidate, requirements);

        return {
          candidate,
          scores,
          totalScore,
          risk
        };
      })
    );
  }

  // 计算多维度分数
  private async calculateScores(
    candidate: ServiceInstance,
    requirements: RequirementAnalysis
  ): Promise<Record<string, number>> {
    // 能力匹配度
    const capabilityScore = this.calculateCapabilityScore(
      candidate.capabilities,
      requirements.requiredCapabilities
    );

    // 当前负载
    const loadScore = 1 - candidate.currentLoad;

    // 延迟预测
    const latencyScore = await this.predictLatencyScore(
      candidate,
      requirements
    );

    // 质量历史
    const qualityScore = candidate.metrics?.qualityScore || 0.8;

    // 成本分数 (越低越好)
    const costScore = 1 - (candidate.costFactor || 0.5);

    // 距离分数 (边缘计算)
    const distanceScore = candidate.region === requirements.constraint?.region
      ? 1
      : 0.5;

    return {
      capability: capabilityScore,
      load: loadScore,
      latency: latencyScore,
      quality: qualityScore,
      cost: costScore,
      distance: distanceScore
    };
  }

  // 能力匹配度计算
  private calculateCapabilityScore(
    provided: string[],
    required: string[]
  ): number {
    if (required.length === 0) return 1;

    const matched = required.filter(r =>
      provided.some(p => p === r || p.startsWith(r.split('_')[0]))
    );

    return matched.length / required.length;
  }

  // 预测延迟
  private async predictLatencyScore(
    candidate: ServiceInstance,
    requirements: RequirementAnalysis
  ): Promise<number> {
    // 基于历史数据和当前状态预测延迟
    const predictedLatency = await this.model.predict({
      candidateId: candidate.id,
      taskType: requirements.taskType,
      currentLoad: candidate.currentLoad,
      queueLength: candidate.queueLength
    });

    // 如果没有要求，返回高分数
    if (!requirements.latencyRequirement) return 1;

    // 延迟越低，分数越高
    const ratio = requirements.latencyRequirement / predictedLatency;
    return Math.min(1, ratio);
  }

  // 加权求和
  private weightedSum(scores: Record<string, number>): number {
    const weights = {
      capability: 0.3,
      load: 0.15,
      latency: 0.2,
      quality: 0.2,
      cost: 0.1,
      distance: 0.05
    };

    return Object.entries(weights).reduce(
      (sum, [key, weight]) => sum + (scores[key] || 0) * weight,
      0
    );
  }
}

// 路由请求
interface RoutingRequest {
  id: string;
  task: GenerationTask;

  // SLA要求
  sla?: {
    maxLatency?: number;
    minQuality?: number;
    priority?: 'low' | 'normal' | 'high' | 'critical';
  };

  // 资源要求
  resources?: {
    memory?: number;
    cpu?: number;
    gpu?: boolean;
  };

  // 约束
  constraints?: {
    region?: string;
    priceLimit?: number;
    specificAgent?: string;
  };

  // 优先级
  priority: number;

  // 租户
  tenantId: string;

  // 上下文
  context?: Record<string, any>;
}

// 路由决策
interface RoutingDecision {
  targetInstance: ServiceInstance;
  strategy: RoutingStrategy;
  score: number;
  alternatives: ServiceInstance[];
  estimatedLatency: number;
  estimatedCost: number;
}
```

## 任务分发

### 分发器架构

```typescript
// 任务分发器
class TaskDispatcher {
  constructor(
    private router: RoutingDecider,
    private queueManager: QueueManager,
    private executor: TaskExecutor
  ) {}

  // 分发任务
  async dispatch(request: RoutingRequest): Promise<DispatchResult> {
    // 1. 路由决策
    const decision = await this.router.decide(request);

    // 2. 检查队列
    if (decision.targetInstance.isOverloaded) {
      // 进入队列
      const queuePosition = await this.queueManager.enqueue({
        request,
        priority: request.priority,
        decision
      });

      return {
        status: 'queued',
        queuePosition,
        estimatedWait: await this.queueManager.estimateWaitTime(queuePosition)
      };
    }

    // 3. 直接分发
    try {
      const result = await this.executor.execute(
        decision.targetInstance,
        request
      );

      return {
        status: 'dispatched',
        executedAt: new Date(),
        instanceId: decision.targetInstance.id,
        result
      };
    } catch (error) {
      // 失败重路由
      return this.handleFailure(request, decision, error);
    }
  }

  // 处理失败
  private async handleFailure(
    request: RoutingRequest,
    decision: RoutingDecision,
    error: Error
  ): Promise<DispatchResult> {
    // 尝试备选
    for (const alt of decision.alternatives) {
      try {
        const result = await this.executor.execute(alt, request);
        return {
          status: 'dispatched',
          executedAt: new Date(),
          instanceId: alt.id,
          result,
          failedAttempts: 1
        };
      } catch {
        continue;
      }
    }

    // 进入重试队列
    const retryEntry = await this.queueManager.enqueueRetry({
      request,
      originalDecision: decision,
      error: error.message,
      attemptCount: 1
    });

    return {
      status: 'retry_queued',
      queuePosition: retryEntry.position,
      error: error.message
    };
  }
}
```

### 队列管理

```typescript
// 队列管理器
class QueueManager {
  private queues: Map<string, PriorityQueue>;

  constructor(private metrics: MetricsCollector) {
    this.queues = new Map([
      ['critical', new PriorityQueue({ comparator: (a, b) => b.priority - a.priority })],
      ['high', new PriorityQueue({ comparator: (a, b) => b.priority - a.priority })],
      ['normal', new PriorityQueue({ comparator: (a, b) => b.priority - a.priority })],
      ['low', new PriorityQueue({ comparator: (a, b) => b.priority - a.priority })]
    ]);
  }

  // 入队
  async enqueue(entry: QueueEntry): Promise<QueuePosition> {
    const queue = this.getQueue(entry.priority);
    const position = await queue.enqueue(entry);

    // 更新指标
    this.metrics.increment('queue.enqueued', {
      priority: entry.priority,
      queue: queue.name
    });

    return position;
  }

  // 出队
  async dequeue(workerId: string): Promise<QueueEntry | null> {
    // 按优先级顺序尝试
    const priorities = ['critical', 'high', 'normal', 'low'];

    for (const priority of priorities) {
      const queue = this.queues.get(priority);
      const entry = await queue.dequeue();

      if (entry) {
        this.metrics.record('queue.wait_time', Date.now() - entry.enqueuedAt, {
          priority
        });

        return entry;
      }
    }

    return null;
  }

  // 估算等待时间
  async estimateWaitTime(position: QueuePosition): Promise<number> {
    const queue = this.queues.get(position.priority);

    // 基于队列长度和平均处理时间估算
    const avgProcessingTime = await this.getAverageProcessingTime(position.priority);
    const queueLength = await queue.length();

    return avgProcessingTime * (queueLength - position.order);
  }

  // 获取平均处理时间
  private async getAverageProcessingTime(priority: string): Promise<number> {
    const recentTimes = await this.metrics.getRecent('task.duration', {
      priority,
      limit: 100
    });

    if (recentTimes.length === 0) return 5000; // 默认5秒

    return recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length;
  }
}

// 队列条目
interface QueueEntry {
  id: string;
  request: RoutingRequest;
  priority: string;
  enqueuedAt: Date;
  position?: QueuePosition;
}

// 队列位置
interface QueuePosition {
  priority: string;
  order: number;
  estimatedWait: number;
}
```

## 负载均衡

### 负载均衡器

```typescript
// 负载均衡器
class LoadBalancer {
  constructor(
    private registry: ServiceRegistry,
    private metrics: MetricsCollector
  ) {}

  // 选择下一个服务实例
  async select(request: RoutingRequest): Promise<ServiceInstance> {
    const instances = await this.registry.getHealthyInstances();

    // 过滤符合条件的实例
    const candidates = this.filterCandidates(instances, request);

    if (candidates.length === 0) {
      throw new NoAvailableInstanceError('No instances match the requirements');
    }

    // 根据策略选择
    return this.applyStrategy(request.loadBalancingStrategy || 'least_loaded', candidates);
  }

  // 过滤候选
  private filterCandidates(
    instances: ServiceInstance[],
    request: RoutingRequest
  ): ServiceInstance[] {
    return instances.filter(instance => {
      // 能力检查
      if (!this.hasRequiredCapabilities(instance, request)) {
        return false;
      }

      // 资源检查
      if (request.resources?.memory && instance.availableMemory < request.resources.memory) {
        return false;
      }

      // 约束检查
      if (request.constraints?.region && instance.region !== request.constraints.region) {
        return false;
      }

      return true;
    });
  }

  // 应用负载均衡策略
  private applyStrategy(
    strategy: 'least_loaded' | 'round_robin' | 'random' | 'ip_hash',
    candidates: ServiceInstance[]
  ): ServiceInstance {
    switch (strategy) {
      case 'least_loaded':
        return this.selectLeastLoaded(candidates);

      case 'round_robin':
        return this.selectRoundRobin(candidates);

      case 'random':
        return this.selectRandom(candidates);

      case 'ip_hash':
        return this.selectByIPHash(candidates);

      default:
        return this.selectLeastLoaded(candidates);
    }
  }

  // 最小负载选择
  private selectLeastLoaded(candidates: ServiceInstance[]): ServiceInstance {
    return candidates.reduce((best, current) =>
      current.currentLoad < best.currentLoad ? current : best
    );
  }

  // 轮询选择
  private roundRobinIndex = 0;
  private selectRoundRobin(candidates: ServiceInstance[]): ServiceInstance {
    const selected = candidates[this.roundRobinIndex % candidates.length];
    this.roundRobinIndex++;
    return selected;
  }

  // 随机选择
  private selectRandom(candidates: ServiceInstance[]): ServiceInstance {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
}

// 服务实例
interface ServiceInstance {
  id: string;
  name: string;

  // 能力
  capabilities: string[];

  // 状态
  status: 'healthy' | 'degraded' | 'unhealthy';
  currentLoad: number;              // 0-1
  queueLength: number;

  // 资源
  availableMemory: number;
  availableCpu: number;

  // 位置
  region: string;
  datacenter?: string;

  // 成本
  costFactor: number;              // 0-1, 成本系数

  // 指标
  metrics?: {
    qualityScore: number;
    avgLatency: number;
    errorRate: number;
  };

  // 元数据
  metadata: Record<string, any>;
}
```

## 优先级调度

### 优先级队列

```typescript
// 多级优先级队列
class MultiLevelPriorityQueue {
  private levels: Map<number, PriorityQueue>;

  constructor(config: PriorityQueueConfig) {
    this.levels = new Map();

    // 创建多个优先级级别
    for (let i = 0; i < config.numLevels; i++) {
      this.levels.set(i, new PriorityQueue({
        comparator: (a, b) => {
          // 同级别内按时间排序
          return a.enqueuedAt - b.enqueuedAt;
        }
      }));
    }

    this.config = config;
  }

  // 入队
  async enqueue(item: QueueItem, priority: number): Promise<void> {
    const level = this.calculateLevel(priority);
    await this.levels.get(level)!.enqueue({
      ...item,
      priority,
      level,
      enqueuedAt: Date.now()
    });

    // 更新统计
    this.stats.totalEnqueued++;
    this.stats.byLevel[level]++;
  }

  // 出队
  async dequeue(): Promise<QueueItem | null> {
    // 从高优先级到低优先级
    for (let i = 0; i < this.config.numLevels; i--) {
      const queue = this.levels.get(i)!;

      if (await queue.length() > 0) {
        const item = await queue.dequeue();
        this.stats.totalDequeued++;
        return item;
      }
    }

    return null;
  }

  // 计算级别
  private calculateLevel(priority: number): number {
    // priority: 0-100 -> level: 0-9
    return Math.min(
      this.config.numLevels - 1,
      Math.floor((100 - priority) / (100 / this.config.numLevels))
    );
  }

  // 抢占式出队
  async preemptiveDequeue(minPriority: number): Promise<QueueItem | null> {
    // 只从指定优先级及以上的级别出队
    const startLevel = this.calculateLevel(minPriority);

    for (let i = 0; i <= startLevel; i++) {
      const queue = this.levels.get(i)!;

      if (await queue.length() > 0) {
        return await queue.dequeue();
      }
    }

    return null;
  }
}

// 优先级配置
interface PriorityQueueConfig {
  numLevels: number;               // 优先级级别数
  allowPreemption: boolean;        // 允许抢占
  agingEnabled: boolean;           // 启用老化
  agingInterval: number;           // 老化检查间隔
}

// 队列统计
interface QueueStats {
  totalEnqueued: number;
  totalDequeued: number;
  byLevel: Record<number, number>;
  avgWaitTime: Record<number, number>;
  maxWaitTime: Record<number, number>;
}
```

## 亲和性与反亲和性

### 亲和性规则

```typescript
// 亲和性规则
interface AffinityRule {
  name: string;

  // 规则类型
  type: 'affinity' | 'anti_affinity' | 'soft_affinity' | 'soft_anti_affinity';

  // 应用条件
  condition: {
    taskSelector?: Record<string, any>;  // 任务选择条件
    instanceSelector?: Record<string, any>; // 实例选择条件
  };

  // 目标
  target: {
    instances?: string[];               // 目标实例
    labels?: Record<string, string>;   // 目标标签
    zones?: string[];                  // 可用区
  };

  // 权重 (软规则)
  weight?: number;

  // 过期时间
  expiresAt?: Date;
}

// 亲和性调度器
class AffinityScheduler {
  constructor(
    private ruleStore: AffinityRuleStore,
    private metrics: MetricsCollector
  ) {}

  // 评估亲和性
  async evaluateAffinity(
    request: RoutingRequest,
    instance: ServiceInstance
  ): Promise<AffinityScore> {
    const rules = await this.ruleStore.getRules(request);

    let totalScore = 0;
    let matchedRules: string[] = [];
    let violatedRules: string[] = [];

    for (const rule of rules) {
      const result = await this.evaluateRule(request, instance, rule);

      if (result.matched) {
        matchedRules.push(rule.name);

        if (rule.type === 'affinity') {
          totalScore += rule.weight || 1;
        } else if (rule.type === 'anti_affinity') {
          // 反亲和性匹配是负分
          return {
            compatible: false,
            score: 0,
            reason: `Violates anti-affinity rule: ${rule.name}`,
            matchedRules: [],
            violatedRules: [rule.name]
          };
        } else if (rule.type === 'soft_affinity') {
          totalScore += (rule.weight || 0.5) * 0.5;
        } else if (rule.type === 'soft_anti_affinity') {
          totalScore -= (rule.weight || 0.5) * 0.5;
        }
      }
    }

    return {
      compatible: true,
      score: totalScore,
      reason: matchedRules.length > 0
        ? `Matched affinity rules: ${matchedRules.join(', ')}`
        : 'No affinity rules matched',
      matchedRules,
      violatedRules: []
    };
  }

  // 评估单条规则
  private async evaluateRule(
    request: RoutingRequest,
    instance: ServiceInstance,
    rule: AffinityRule
  ): Promise<{ matched: boolean }> {
    // 检查任务条件
    if (rule.condition.taskSelector) {
      if (!this.matchSelector(request, rule.condition.taskSelector)) {
        return { matched: false };
      }
    }

    // 检查实例条件
    if (rule.condition.instanceSelector) {
      if (!this.matchSelector(instance, rule.condition.instanceSelector)) {
        return { matched: false };
      }
    }

    // 检查目标
    if (rule.target.instances && !rule.target.instances.includes(instance.id)) {
      return { matched: false };
    }

    if (rule.target.labels) {
      const hasLabels = Object.entries(rule.target.labels).every(
        ([key, value]) => instance.labels?.[key] === value
      );
      if (!hasLabels) return { matched: false };
    }

    if (rule.target.zones && !rule.target.zones.includes(instance.zone)) {
      return { matched: false };
    }

    return { matched: true };
  }

  private matchSelector(obj: Record<string, any>, selector: Record<string, any>): boolean {
    return Object.entries(selector).every(
      ([key, value]) => obj[key] === value
    );
  }
}

// 亲和性分数
interface AffinityScore {
  compatible: boolean;
  score: number;
  reason: string;
  matchedRules: string[];
  violatedRules: string[];
}
```

## 流量管理

### 流量控制器

```typescript
// 流量控制器
class TrafficController {
  constructor(
    private circuitBreaker: CircuitBreaker,
    private rateLimiter: RateLimiter
  ) {}

  // 控制流量
  async control(request: RoutingRequest): Promise<TrafficControlResult> {
    // 1. 速率限制检查
    const rateLimitResult = await this.rateLimiter.check(request);
    if (!rateLimitResult.allowed) {
      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        retryAfter: rateLimitResult.retryAfter
      };
    }

    // 2. 熔断器检查
    const circuitResult = await this.circuitBreaker.check(request.serviceId);
    if (circuitResult.state === 'open') {
      return {
        allowed: false,
        reason: 'circuit_breaker_open',
        fallbackAvailable: circuitResult.fallbackAvailable
      };
    }

    return { allowed: true };
  }

  // 记录结果
  async recordResult(request: RoutingRequest, result: any): Promise<void> {
    await this.rateLimiter.record(request);
    await this.circuitBreaker.record(request.serviceId, result);
  }
}

// 熔断器
class CircuitBreaker {
  private circuits: Map<string, CircuitState>;

  constructor(private config: CircuitBreakerConfig) {
    this.circuits = new Map();
  }

  async check(serviceId: string): Promise<CircuitCheckResult> {
    const circuit = this.getOrCreateCircuit(serviceId);

    switch (circuit.state) {
      case 'closed':
        return { state: 'closed', fallbackAvailable: true };

      case 'open':
        if (circuit.lastFailureTime + this.config.resetTimeout < Date.now()) {
          // 进入半开状态
          circuit.state = 'half_open';
          return { state: 'half_open', fallbackAvailable: true };
        }
        return { state: 'open', fallbackAvailable: circuit.fallbackServiceId !== undefined };

      case 'half_open':
        return { state: 'half_open', fallbackAvailable: true };

      default:
        return { state: 'closed', fallbackAvailable: true };
    }
  }

  async record(serviceId: string, result: any): Promise<void> {
    const circuit = this.getOrCreateCircuit(serviceId);

    if (result.success) {
      // 成功，重置
      if (circuit.state === 'half_open') {
        circuit.state = 'closed';
        circuit.failureCount = 0;
      }
    } else {
      // 失败，增加计数
      circuit.failureCount++;
      circuit.lastFailureTime = Date.now();

      // 检查阈值
      if (circuit.failureCount >= this.config.failureThreshold) {
        circuit.state = 'open';
      }
    }
  }

  private getOrCreateCircuit(serviceId: string): CircuitState {
    if (!this.circuits.has(serviceId)) {
      this.circuits.set(serviceId, {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: 0
      });
    }
    return this.circuits.get(serviceId)!;
  }
}

// 熔断器配置
interface CircuitBreakerConfig {
  failureThreshold: number;         // 失败阈值
  resetTimeout: number;            // 重置超时 (ms)
  halfOpenRequests: number;        // 半开状态允许的请求数
}
```

## 监控与指标

### 路由指标

```typescript
// 路由指标
const routingMetrics = {
  // 请求指标
  requestsTotal: Counter;
  requestsByPriority: Counter;
  requestsByStrategy: Counter;

  // 决策指标
  routingDecisionsTotal: Counter;
  routingDecisionLatency: Histogram;
  routingScoreDistribution: Histogram;

  // 负载指标
  instanceLoad: Gauge;
  queueLength: Gauge;
  queueWaitTime: Histogram;

  // 质量指标
  routingAccuracy: Gauge;         // 路由准确性 (ML路由)
  predictionError: Histogram;     // 预测误差

  // 故障指标
  routingFailures: Counter;
  circuitBreakerState: Gauge;
  fallbackActivations: Counter;
};
```

## 配置

```typescript
// 路由配置
interface RoutingConfig {
  // 默认策略
  defaultStrategy: RoutingStrategy;

  // 策略配置
  strategies: {
    [key: string]: RoutingStrategyConfig;
  };

  // 负载均衡
  loadBalancing: {
    defaultStrategy: 'least_loaded' | 'round_robin' | 'random';
    healthCheckInterval: number;
    instanceTimeout: number;
  };

  // 队列配置
  queue: {
    enabled: boolean;
    maxSize: number;
    defaultPriority: number;
    priorityLevels: number;
  };

  // 亲和性
  affinity: {
    enabled: boolean;
    rules: AffinityRule[];
    evaluationInterval: number;
  };

  // 熔断器
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    resetTimeout: number;
  };

  // 限流
  rateLimit: {
    enabled: boolean;
    defaultLimit: number;
    windowSize: number;
  };

  // ML模型
  mlRouting: {
    enabled: boolean;
    modelPath: string;
    updateInterval: number;
    fallbackToRule: boolean;
  };
}
```

---

**最后更新**: 2026-04-15
