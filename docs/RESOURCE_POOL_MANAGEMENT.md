# 资源池管理系统

## 概述

资源池管理（Resource Pool Management）是无限项目生成系统的核心基础设施，负责管理和调度用于代码生成、验证、构建、部署所需的计算资源。资源池需要支持动态伸缩、优先级调度、公平分配、隔离保障，以及成本优化。

## 核心价值

- **弹性伸缩**：根据负载自动扩缩容资源
- **公平调度**：确保多用户/多任务间的资源公平分配
- **隔离保障**：不同租户和任务间的资源隔离
- **成本优化**：在保证性能的前提下最小化资源成本
- **可观测性**：完整的资源使用监控和预警

## 资源类型体系

### 计算资源分类

```typescript
// 资源类型枚举
enum ResourceType {
  // 计算资源
  CPU = 'cpu',                         // CPU计算资源
  GPU = 'gpu',                         // GPU计算资源
  MEMORY = 'memory',                   // 内存资源

  // 存储资源
  DISK = 'disk',                       // 磁盘存储
  OBJECT_STORAGE = 'object_storage',   // 对象存储

  // 网络资源
  BANDWIDTH = 'bandwidth',             // 网络带宽
  EGRESS = 'egress',                   // 出站流量

  // 特殊资源
  CONTAINER = 'container',             // 容器实例
  NAMESPACE = 'namespace',             // 命名空间
  ENDPOINT = 'endpoint',               // API端点
}

// 资源规格
interface ResourceSpec {
  // CPU: 核数
  cpuCores: number;            // e.g., 4

  // 内存: GB
  memoryGB: number;            // e.g., 16

  // GPU: 规格描述
  gpuSpec?: {
    model: string;             // e.g., 'A100', 'T4'
    count: number;             // e.g., 1
    memoryGB?: number;         // e.g., 40
  };

  // 存储: GB
  diskGB: number;             // e.g., 100

  // 网络带宽: Mbps
  bandwidthMbps: number;       // e.g., 1000
}

// 预定义规格
const PREDEFINED_SPECS = {
  // 开发测试规格
  dev_small: {
    cpuCores: 2,
    memoryGB: 4,
    diskGB: 50,
    bandwidthMbps: 100,
  },
  dev_medium: {
    cpuCores: 4,
    memoryGB: 8,
    diskGB: 100,
    bandwidthMbps: 500,
  },

  // 生成任务规格
  gen_small: {
    cpuCores: 4,
    memoryGB: 16,
    diskGB: 200,
    bandwidthMbps: 500,
  },
  gen_medium: {
    cpuCores: 8,
    memoryGB: 32,
    diskGB: 500,
    bandwidthMbps: 1000,
  },
  gen_large: {
    cpuCores: 16,
    memoryGB: 64,
    diskGB: 1000,
    bandwidthMbps: 2000,
  },

  // 构建任务规格
  build_small: {
    cpuCores: 4,
    memoryGB: 8,
    diskGB: 100,
    bandwidthMbps: 500,
  },
  build_large: {
    cpuCores: 16,
    memoryGB: 32,
    diskGB: 500,
    bandwidthMbps: 1000,
  },

  // GPU任务规格
  gpu_small: {
    cpuCores: 4,
    memoryGB: 16,
    gpuSpec: { model: 'T4', count: 1, memoryGB: 16 },
    diskGB: 500,
    bandwidthMbps: 1000,
  },
  gpu_large: {
    cpuCores: 8,
    memoryGB: 32,
    gpuSpec: { model: 'A100', count: 1, memoryGB: 40 },
    diskGB: 1000,
    bandwidthMbps: 2000,
  },
};
```

### 资源池配置

```typescript
interface ResourcePool {
  id: string;
  name: string;
  type: 'general' | 'dedicated' | 'spot';  // 通用池/专用池/竞价池

  // 容量配置
  capacity: {
    minNodes: number;            // 最小节点数
    maxNodes: number;           // 最大节点数
    desiredNodes: number;       // 期望节点数
    nodeSpec: ResourceSpec;     // 单节点规格
  };

  // 区域配置
  region?: string;             // 部署区域
  availabilityZones?: string[]; // 可用区

  // 费用配置
  pricing: {
    unitPricePerHour: number;  // 每节点每小时价格
    currency: string;
    billingUnit: 'second' | 'minute' | 'hour';
  };

  // 调度配置
  scheduling: {
    priority: number;          // 池优先级 (1-100)
    preemptionEnabled: boolean; // 是否允许抢占
    allowBurst: boolean;        // 是否允许突发
  };

  // 隔离配置
  isolation: {
    dedicatedTenants: string[]; // 专用租户列表
    networkPolicy: string;      // 网络策略
    resourceQuota?: ResourceQuota; // 资源配额
  };
}

// 资源配额
interface ResourceQuota {
  maxCpuCores: number;
  maxMemoryGB: number;
  maxGpuCount: number;
  maxDiskGB: number;
  maxConcurrentTasks: number;
  maxEgressGB: number;
}
```

## 资源调度器

### 调度策略

```typescript
// 调度策略类型
enum SchedulingStrategy {
  FIFO = 'fifo',                 // 先进先出
  PRIORITY = 'priority',         // 优先级调度
  FAIR_SHARE = 'fair_share',     // 公平调度
  binpack = 'binpack',           // 紧凑分配
  SPREAD = 'spread',             // 分散分配
  EFFICIENT = 'efficient',       // 效率最优
}

// 任务优先级
enum TaskPriority {
  CRITICAL = 100,               // 关键任务
  HIGH = 75,                    // 高优先级
  NORMAL = 50,                  // 普通优先级
  LOW = 25,                     // 低优先级
  BATCH = 10,                   // 批处理任务
}

// 调度决策
interface SchedulingDecision {
  taskId: string;
  selectedPool: string;
  selectedNode?: string;
  estimatedStartTime: Date;
  estimatedWaitTime: number;    // 预估等待时间(ms)
  schedulingReason: string;
}

// 调度器接口
interface ResourceScheduler {
  // 提交调度请求
  schedule(task: TaskRequest): Promise<SchedulingDecision>;

  // 批量调度
  scheduleBatch(tasks: TaskRequest[]): Promise<SchedulingDecision[]>;

  // 抢占调度
  preempt(tasks: TaskRequest[]): Promise<PreemptionDecision[]>;

  // 重新调度
  reschedule(taskId: string): Promise<SchedulingDecision>;

  // 获取调度统计
  getStats(): SchedulerStats;
}

interface TaskRequest {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  requiredResources: ResourceSpec;
  estimatedDuration: number;     // 预估执行时间(ms)
  preferredPools?: string[];
  constraints?: TaskConstraints;
  tenantId: string;
  projectId: string;
}

interface TaskConstraints {
  requiredRegions?: string[];
  requiredAvailabilityZones?: string[];
  affinityRules?: AffinityRule[];
  antiAffinityRules?: AffinityRule[];
  maxWaitTime?: number;          // 最大等待时间
  spotInstanceAllowed?: boolean;
}

interface AffinityRule {
  taskId?: string;
  poolId?: string;
  nodeLabel?: string;
  weight: number;                // 1-100
}
```

### 公平调度算法

```typescript
// 公平调度器实现
class FairShareScheduler implements ResourceScheduler {
  private pools: Map<string, ResourcePool>;
  private taskQueues: Map<TaskPriority, TaskQueue>;
  private tenantWeights: Map<string, number>;
  private nodeAllocations: Map<string, NodeAllocation>;

  // 核心调度逻辑
  schedule(task: TaskRequest): Promise<SchedulingDecision> {
    // 1. 计算任务的份额权重
    const shareWeight = this.calculateShareWeight(task);

    // 2. 找到最适合的池
    const candidatePools = this.findCandidatePools(task);

    // 3. 执行公平调度算法
    const selectedPool = this.selectPoolByFairness(
      candidatePools,
      task.tenantId,
      shareWeight
    );

    // 4. 在选中的池中选择节点
    const selectedNode = this.selectNode(selectedPool, task);

    return {
      taskId: task.id,
      selectedPool: selectedPool.id,
      selectedNode: selectedNode?.id,
      estimatedStartTime: new Date(),
      estimatedWaitTime: this.estimateWaitTime(task, selectedPool),
      schedulingReason: this.getSchedulingReason(selectedPool, task),
    };
  }

  // 份额权重计算
  private calculateShareWeight(task: TaskRequest): number {
    const baseWeight = task.priority;
    const tenantWeight = this.tenantWeights.get(task.tenantId) || 1;
    const taskTypeWeight = TASK_TYPE_WEIGHTS[task.type] || 1;
    return baseWeight * tenantWeight * taskTypeWeight;
  }

  // 公平池选择
  private selectPoolByFairness(
    pools: ResourcePool[],
    tenantId: string,
    shareWeight: number
  ): ResourcePool {
    // 计算每个池的当前利用率
    // 选择利用率最低且满足需求的池
    // 确保 tenantId 获得公平的份额
    return pools.sort((a, b) =>
      this.getPoolFairnessScore(a, tenantId, shareWeight) -
      this.getPoolFairnessScore(b, tenantId, shareWeight)
    )[0];
  }
}

// 公平分数计算
interface FairnessScore {
  poolId: string;
  currentUsage: ResourceSpec;
  guaranteedShare: ResourceSpec;
  currentShare: ResourceSpec;
  fairnessRatio: number;         // 当前份额/保证份额
  overallScore: number;          // 综合评分
}
```

### 优先级调度

```typescript
// 优先级调度器
class PriorityScheduler implements ResourceScheduler {
  private priorityQueues: Map<TaskPriority, TaskQueue>;

  // 多级反馈队列调度
  schedule(task: TaskRequest): Promise<SchedulingDecision> {
    // 1. 插入到对应优先级队列
    const queue = this.priorityQueues.get(task.priority);
    queue.enqueue(task);

    // 2. 从高优先级队列开始尝试调度
    for (const priority of TaskPriority) {
      const highPriorityQueue = this.priorityQueues.get(priority);
      if (!highPriorityQueue.isEmpty()) {
        const pendingTask = highPriorityQueue.peek();
        const decision = this.trySchedule(pendingTask);

        if (decision) {
          highPriorityQueue.dequeue();
          return decision;
        }
      }
    }

    // 3. 所有队列都无法调度，进入等待
    throw new SchedulingError('No available resources', task.id);
  }
}

// 队列配置
const QUEUE_CONFIG = {
  [TaskPriority.CRITICAL]: {
    maxSize: 10,
    timeout: '1m',
    preemption: true,
    minResourceGuarantee: { cpuCores: 4, memoryGB: 16 },
  },
  [TaskPriority.HIGH]: {
    maxSize: 100,
    timeout: '5m',
    preemption: true,
    minResourceGuarantee: { cpuCores: 2, memoryGB: 8 },
  },
  [TaskPriority.NORMAL]: {
    maxSize: 500,
    timeout: '30m',
    preemption: false,
    minResourceGuarantee: { cpuCores: 1, memoryGB: 4 },
  },
  [TaskPriority.LOW]: {
    maxSize: 1000,
    timeout: '2h',
    preemption: false,
    minResourceGuarantee: { cpuCores: 0.5, memoryGB: 2 },
  },
  [TaskPriority.BATCH]: {
    maxSize: Infinity,
    timeout: '24h',
    preemption: false,
    minResourceGuarantee: { cpuCores: 0.5, memoryGB: 2 },
  },
};
```

## 资源分配

### 分配算法

```typescript
// 资源分配器
interface ResourceAllocator {
  // 分配资源
  allocate(requests: ResourceRequest[]): AllocationResult;

  // 释放资源
  release(allocationId: string): ReleaseResult;

  // 调整资源
  resize(allocationId: string, newSpec: ResourceSpec): ResizeResult;

  // 查询可用资源
  queryAvailable(spec: ResourceSpec, region?: string): AvailableResource[];
}

interface ResourceRequest {
  id: string;
  tenantId: string;
  projectId: string;
  poolId: string;
  spec: ResourceSpec;
  duration: number;              // 预估时长(ms)
  preemptible: boolean;          // 是否可抢占
}

interface AllocationResult {
  success: boolean;
  allocation?: ResourceAllocation;
  failureReason?: string;
}

interface ResourceAllocation {
  id: string;
  requestId: string;
  nodeId: string;
  poolId: string;
  resources: AllocatedResources;
  startTime: Date;
  expiresAt?: Date;
  metadata: AllocationMetadata;
}

interface AllocatedResources {
  cpuCores: number;
  memoryGB: number;
  gpuSpec?: GPUAllocation;
  diskGB: number;
  network带宽?: number;
}

interface AllocationMetadata {
  taskType: string;
  priority: TaskPriority;
  tenantId: string;
  projectId: string;
  costEstimate: number;
}

// 分配策略
enum AllocationStrategy {
  BEST_FIT = 'best_fit',         // 最佳适配
  FIRST_FIT = 'first_fit',       // 首次适配
  WORST_FIT = 'worst_fit',       // 最差适配
  RANDOM = 'random',            // 随机选择
}

// 分配算法实现
class BinPackAllocator implements ResourceAllocator {
  constructor(private strategy: AllocationStrategy = 'best_fit') {}

  allocate(requests: ResourceRequest[]): AllocationResult {
    // 按资源需求排序
    const sortedRequests = this.sortBySize(requests);

    for (const request of sortedRequests) {
      // 查找可用节点
      const nodes = this.findAvailableNodes(request);

      if (nodes.length === 0) {
        return { success: false, failureReason: 'No available nodes' };
      }

      // 根据策略选择节点
      const selectedNode = this.selectNode(nodes, request);

      // 执行分配
      const allocation = this.performAllocation(request, selectedNode);

      return { success: true, allocation };
    }

    return { success: false, failureReason: 'All requests failed' };
  }

  private sortBySize(requests: ResourceRequest[]): ResourceRequest[] {
    return requests.sort((a, b) => {
      const sizeA = a.spec.cpuCores * a.spec.memoryGB;
      const sizeB = b.spec.cpuCores * b.spec.memoryGB;
      return sizeB - sizeA;  // 降序，大的先分配
    });
  }

  private selectNode(nodes: Node[], request: ResourceRequest): Node {
    switch (this.strategy) {
      case 'best_fit':
        // 选择满足需求且剩余最小的节点
        return nodes.reduce((best, node) =>
          this.getFreeResource(node) < this.getFreeResource(best) ? node : best
        );
      case 'first_fit':
        // 选择第一个满足需求的节点
        return nodes[0];
      case 'worst_fit':
        // 选择剩余资源最多的节点
        return nodes.reduce((best, node) =>
          this.getFreeResource(node) > this.getFreeResource(best) ? node : best
        );
      default:
        return nodes[0];
    }
  }
}
```

## 弹性伸缩

### 自动扩缩容

```typescript
// 自动扩缩容策略
interface AutoScalingPolicy {
  id: string;
  name: string;
  poolId: string;

  // 扩缩容条件
  triggers: ScalingTrigger[];

  // 扩缩容配置
  scaling: {
    minNodes: number;
    maxNodes: number;
    desiredNodes?: number;

    // 扩容配置
    scaleUp: {
      increment: number;         // 每次扩容增加节点数
      cooldown: string;         // 扩容冷却时间
      stabilizationWindow?: string; // 稳定窗口
    };

    // 缩容配置
    scaleDown: {
      decrement: number;        // 每次缩容减少节点数
      cooldown: string;         // 缩容冷却时间
      utilizationThreshold?: number; // 利用率阈值
    };
  };

  // 预测性扩缩容
  predictive?: {
    enabled: boolean;
    lookahead: string;          // 预测窗口
    minConfidence: number;       // 最小置信度
  };
}

interface ScalingTrigger {
  type: 'cpu' | 'memory' | 'disk' | 'queue_depth' | 'custom' | 'time';
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'between';
  threshold: number;
  secondaryThreshold?: number;
  duration: string;             // 触发条件持续时间
}

interface ScalingAction {
  type: 'scale_up' | 'scale_down' | 'scale_to';
  nodeCount: number;
  reason: string;
  triggeredBy: string;
  timestamp: Date;
}

// 扩缩容执行器
class ScalingExecutor {
  async execute(policy: AutoScalingPolicy): Promise<ScalingAction[]> {
    const actions: ScalingAction[] = [];

    // 1. 检查扩容条件
    const scaleUp = await this.checkScaleUp(policy);
    if (scaleUp.shouldScale) {
      const action = await this.performScaleUp(policy, scaleUp.targetNodes);
      actions.push(action);
    }

    // 2. 检查缩容条件
    const scaleDown = await this.checkScaleDown(policy);
    if (scaleDown.shouldScale) {
      const action = await this.performScaleDown(policy, scaleDown.targetNodes);
      actions.push(action);
    }

    // 3. 记录执行日志
    await this.recordScalingActions(actions);

    return actions;
  }

  private async checkScaleUp(policy: AutoScalingPolicy): Promise<ScaleCheckResult> {
    const metrics = await this.getPoolMetrics(policy.poolId);
    const avgUtilization = this.calculateAvgUtilization(metrics);

    for (const trigger of policy.triggers) {
      if (this.evaluateTrigger(trigger, avgUtilization, metrics)) {
        const currentNodes = metrics.nodeCount;
        const targetNodes = Math.min(
          currentNodes + policy.scaling.scaleUp.increment,
          policy.scaling.maxNodes
        );

        return { shouldScale: true, targetNodes, reason: trigger.type };
      }
    }

    return { shouldScale: false, targetNodes: metrics.nodeCount };
  }
}

// 预测性扩缩容
class PredictiveScaler {
  async predictDemand(
    poolId: string,
    lookahead: string
  ): Promise<DemandPrediction> {
    // 1. 收集历史数据
    const historicalData = await this.getHistoricalMetrics(poolId, '7d');

    // 2. 分析趋势
    const trend = this.analyzeTrend(historicalData);

    // 3. 检测周期性
    const periodicity = this.detectPeriodicity(historicalData);

    // 4. 结合趋势和周期预测
    const prediction = this.combineForecast(trend, periodicity, lookahead);

    return {
      predictedDemand: prediction,
      confidence: prediction.confidence,
      factors: prediction.factors,
    };
  }

  async executePredictiveScaling(
    poolId: string,
    prediction: DemandPrediction
  ): Promise<void> {
    if (prediction.confidence < 0.8) {
      // 置信度不足，使用规则扩缩容
      return;
    }

    const currentNodes = await this.getCurrentNodeCount(poolId);
    const recommendedNodes = this.calculateRecommendedNodes(
      currentNodes,
      prediction.predictedDemand
    );

    await this.submitScalingRequest(poolId, recommendedNodes, 'predictive');
  }
}
```

### 节点管理

```typescript
// 节点接口
interface Node {
  id: string;
  poolId: string;
  status: NodeStatus;
  spec: ResourceSpec;
  allocatedResources: AllocatedResources;
  availableResources: ResourceSpec;

  // 生命周期
  createdAt: Date;
  lastHeartbeat: Date;
  uptime: number;

  // 成本
  costPerHour: number;
  totalCost: number;

  // 健康状态
  health: NodeHealth;
  labels: Record<string, string>;
  taints?: NodeTaint[];
}

enum NodeStatus {
  PENDING = 'pending',           // 正在启动
  RUNNING = 'running',           // 运行中
  DRAINING = 'draining',         // 排出中
  STOPPING = 'stopping',         // 停止中
  STOPPED = 'stopped',           // 已停止
  FAILED = 'failed',             // 失败
}

interface NodeHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  score: number;                  // 0-100
  issues: HealthIssue[];
  lastCheck: Date;
}

interface HealthIssue {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  since?: Date;
}

// 节点生命周期管理
class NodeLifecycleManager {
  // 创建节点
  async createNode(poolId: string, spec: ResourceSpec): Promise<Node> {
    // 1. 验证规格
    this.validateSpec(spec);

    // 2. 分配底层资源
    const underlyingResource = await this.allocateUnderlyingResource(poolId, spec);

    // 3. 初始化节点
    const node = await this.initializeNode(underlyingResource, spec);

    // 4. 注册到资源池
    await this.registerNode(poolId, node);

    return node;
  }

  // 节点就绪检查
  async nodeReady(nodeId: string): Promise<boolean> {
    const checks = await Promise.all([
      this.checkNetworkConnectivity(nodeId),
      this.checkStorageAccessible(nodeId),
      this.checkAgentRunning(nodeId),
      this.checkResourceAvailable(nodeId),
    ]);

    return checks.every(c => c.passed);
  }

  // 节点下线
  async drainNode(nodeId: string, options?: DrainOptions): Promise<void> {
    // 1. 标记为draining
    await this.updateNodeStatus(nodeId, NodeStatus.DRAINING);

    // 2. 迁移正在运行的任务
    const runningTasks = await this.getRunningTasks(nodeId);
    for (const task of runningTasks) {
      await this.migrateTask(task, options?.targetNode);
    }

    // 3. 等待任务迁移完成
    await this.waitForTasksCompletion(nodeId, options?.timeout || '10m');

    // 4. 释放资源
    await this.releaseNode(nodeId);
  }
}
```

## 成本管理

### 成本追踪

```typescript
// 成本模型
interface CostModel {
  // 计算成本
  compute: {
    cpuPerCoreHour: number;      // 每核每小时价格
    gpuPerUnitHour: Record<string, number>;  // 每GPU型号每小时价格
    memoryPerGBHour: number;     // 每GB内存每小时价格
  };

  // 存储成本
  storage: {
    diskPerGBMonth: number;      // 每GB每月价格
    objectStoragePerGBMonth: number;
    snapshotPerGBMonth: number;
  };

  // 网络成本
  network: {
    inboundPerGB: number;
    outboundPerGB: number;
    intraRegionPerGB: number;
  };

  // 其他成本
  other: {
    apiRequestPer1000: number;
    buildMinute: number;
    deploymentHour: number;
  };
}

// 成本计算
interface CostTracker {
  // 计算任务成本
  calculateTaskCost(task: TaskRequest, duration: number): CostBreakdown;

  // 计算池成本
  calculatePoolCost(poolId: string, period: TimePeriod): PoolCost;

  // 计算租户成本
  calculateTenantCost(tenantId: string, period: TimePeriod): TenantCost;

  // 获取成本分摊
  getCostAllocation(projectId: string): CostAllocation;
}

interface CostBreakdown {
  cpu: number;
  memory: number;
  gpu?: number;
  storage: number;
  network: number;
  other: number;
  total: number;
  currency: string;
}

interface PoolCost {
  poolId: string;
  period: TimePeriod;
  nodeHours: number;
  computeCost: number;
  storageCost: number;
  networkCost: number;
  totalCost: number;
  costByTaskType: Record<string, number>;
}

interface TenantCost {
  tenantId: string;
  period: TimePeriod;
  totalCost: number;
  byPool: Record<string, number>;
  byTaskType: Record<string, number>;
  trend: CostTrend;
}

interface CostTrend {
  currentPeriod: number;
  previousPeriod: number;
  changePercent: number;
  forecast: number;
}

// 成本优化建议
interface CostOptimizer {
  // 分析成本模式
  analyzeCostPatterns(tenantId: string): CostPattern[];

  // 生成优化建议
  generateOptimizationSuggestions(poolId: string): OptimizationSuggestion[];

  // 预测成本
  forecastCost(tenantId: string, horizon: string): CostForecast;
}

interface OptimizationSuggestion {
  type: 'rightsize' | 'spot_instance' | 'scheduled_scale' | 'storage_tiering';
  potentialSavings: number;
  currentWaste: number;
  action: string;
  impact: 'high' | 'medium' | 'low';
}
```

### 预算管理

```typescript
// 预算配置
interface Budget {
  id: string;
  tenantId: string;
  name: string;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

  // 预算限额
  limit: number;
  currency: string;

  // 预警阈值
  alerts: BudgetAlert[];

  // 行动
  actions: BudgetAction[];

  status: 'active' | 'paused' | 'exceeded';
}

interface BudgetAlert {
  threshold: number;             // 百分比 (e.g., 80)
  type: 'warning' | 'critical';
  notificationChannels: string[];
}

interface BudgetAction {
  threshold: number;
  type: 'block_new_tasks' | 'scale_down' | 'notify' | 'custom_webhook';
  config?: Record<string, any>;
}

// 预算控制器
class BudgetController {
  // 检查预算
  async checkBudget(tenantId: string, additionalCost: number): Promise<BudgetCheckResult> {
    const budgets = await this.getActiveBudgets(tenantId);

    for (const budget of budgets) {
      const currentSpend = await this.getCurrentSpend(budget);
      const projectedSpend = currentSpend + additionalCost;

      if (projectedSpend > budget.limit) {
        // 检查是否有对应阈值的行动
        const action = this.getActionForThreshold(budget, projectedSpend);

        return {
          allowed: action?.type !== 'block_new_tasks',
          action: action,
          budget: budget,
          currentSpend,
          projectedSpend,
          limit: budget.limit,
        };
      }
    }

    return { allowed: true };
  }

  // 执行预算行动
  async executeAction(action: BudgetAction): Promise<void> {
    switch (action.type) {
      case 'block_new_tasks':
        await this.blockNewTasks(action.config?.tenantId);
        break;
      case 'scale_down':
        await this.scaleDownPools(action.config?.poolIds);
        break;
      case 'notify':
        await this.sendNotification(action.config);
        break;
      case 'custom_webhook':
        await this.callWebhook(action.config);
        break;
    }
  }
}
```

## 资源监控

### 监控指标

```typescript
// 资源池指标
interface PoolMetrics {
  poolId: string;
  timestamp: Date;

  // 容量指标
  capacity: {
    totalNodes: number;
    availableNodes: number;
    usedNodes: number;
    pendingNodes: number;
  };

  // 利用率指标
  utilization: {
    cpuPercent: number;
    memoryPercent: number;
    gpuPercent?: number;
    diskPercent: number;
    networkPercent: number;
  };

  // 调度指标
  scheduling: {
    queueDepth: number;
    avgWaitTime: number;
    avgSchedulingTime: number;
    schedulingThroughput: number;  // 每秒调度数
  };

  // 任务指标
  tasks: {
    running: number;
    pending: number;
    completed: number;
    failed: number;
    preempted: number;
  };

  // 成本指标
  cost: {
    currentHourCost: number;
    todayCost: number;
    avgTaskCost: number;
  };
}

// 节点指标
interface NodeMetrics {
  nodeId: string;
  timestamp: Date;

  resourceUsage: {
    cpuCores: number;
    cpuPercent: number;
    memoryUsedGB: number;
    memoryPercent: number;
    gpuUsage?: GPUUsage;
    diskRead: number;
    diskWrite: number;
    networkRx: number;
    networkTx: number;
  };

  performance: {
    uptime: number;
    loadAverage: number[];
    contextSwitches: number;
    interrupts: number;
  };

  health: {
    status: string;
    errorCount: number;
    warningCount: number;
  };
}
```

### 告警规则

```typescript
// 告警规则
interface AlertRule {
  id: string;
  name: string;
  poolId?: string;              // null表示应用于所有池
  severity: 'critical' | 'warning' | 'info';

  // 条件
  condition: AlertCondition;

  // 行动
  actions: AlertAction[];

  // 抑制
  suppression?: {
    enabled: boolean;
    duration: string;
    repeatInterval?: string;
  };
}

interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number;
  duration?: string;             // 持续时间
}

// 预设告警规则
const PRESET_ALERT_RULES: Omit<AlertRule, 'id'>[] = [
  {
    name: 'High CPU Usage',
    severity: 'warning',
    condition: { metric: 'utilization.cpuPercent', operator: '>', value: 80, duration: '5m' },
    actions: [{ type: 'notify', channels: ['slack', 'email'] }],
  },
  {
    name: 'Critical CPU Usage',
    severity: 'critical',
    condition: { metric: 'utilization.cpuPercent', operator: '>', value: 95, duration: '1m' },
    actions: [
      { type: 'notify', channels: ['slack', 'email', 'sms'] },
      { type: 'auto_scale', increment: 2 },
    ],
  },
  {
    name: 'Low Availability',
    severity: 'critical',
    condition: { metric: 'capacity.availableNodes', operator: '<', value: 2, duration: '2m' },
    actions: [{ type: 'auto_scale', increment: 1 }],
  },
  {
    name: 'High Queue Depth',
    severity: 'warning',
    condition: { metric: 'scheduling.queueDepth', operator: '>', value: 100, duration: '10m' },
    actions: [{ type: 'notify', channels: ['slack'] }],
  },
  {
    name: 'Budget Warning',
    severity: 'warning',
    condition: { metric: 'cost.dailyPercent', operator: '>', value: 80, duration: '0' },
    actions: [{ type: 'notify', channels: ['email'] }],
  },
];
```

## 配置示例

```yaml
# 资源池管理配置
resource_pool_management:
  # 全局默认配置
  defaults:
    max_nodes_per_pool: 100
    default_spec: "gen_medium"
    enable_predictive_scaling: true
    cost_optimization_enabled: true

  # 资源池定义
  pools:
    - id: "pool-general-dev"
      name: "通用开发池"
      type: "general"
      capacity:
        min_nodes: 2
        max_nodes: 50
        desired_nodes: 5
        node_spec: "dev_medium"
      pricing:
        unit_price_per_hour: 0.05
        currency: "USD"
      scheduling:
        priority: 50
        preemption_enabled: true

    - id: "pool-gpu-ai"
      name: "GPU AI池"
      type: "dedicated"
      capacity:
        min_nodes: 1
        max_nodes: 20
        desired_nodes: 2
        node_spec: "gpu_large"
      pricing:
        unit_price_per_hour: 2.00
        currency: "USD"
      scheduling:
        priority: 80
        dedicated_tenants: ["ai-team", "ml-team"]

    - id: "pool-spot-build"
      name: "竞价构建池"
      type: "spot"
      capacity:
        min_nodes: 0
        max_nodes: 100
        desired_nodes: 10
        node_spec: "build_large"
      pricing:
        unit_price_per_hour: 0.02  # 竞价价格
        currency: "USD"
      scheduling:
        priority: 25
        preemption_enabled: true

  # 扩缩容策略
  auto_scaling:
    default_policy:
      scale_up:
        increment: 2
        cooldown: "5m"
        stabilization_window: "5m"
      scale_down:
        decrement: 1
        cooldown: "15m"
        utilization_threshold: 30

  # 告警配置
  alerts:
    enabled: true
    channels:
      - type: "slack"
        webhook_url: "${SLACK_WEBHOOK_URL}"
      - type: "email"
        recipients: ["ops-team@company.com"]
    rules: "preset"

  # 成本管理
  cost_management:
    enabled: true
    budget_enforcement: true
    show_forecasts: true
    optimization_suggestions: true
```

## 最佳实践

### 资源规划

```typescript
// 容量规划指南
const CAPACITY_PLANNING_GUIDE = {
  // 评估标准
  assessment: {
    concurrent_tasks: {
      small_team: 10,
      medium_team: 50,
      large_team: 200,
    },
    avg_task_duration: {
      code_generation: '30s - 5m',
      test_execution: '1m - 10m',
      build: '5m - 30m',
      deployment: '2m - 15m',
    },
    peak_multiplier: 3,  // 峰值/平均
  },

  // 规格选择建议
  spec_selection: {
    code_generation: {
      small: 'gen_small',
      medium: 'gen_medium',
      large: 'gen_large',
    },
    testing: {
      small: 'dev_small',
      medium: 'dev_medium',
      large: 'build_small',
    },
    building: {
      small: 'build_small',
      large: 'build_large',
    },
    ai_inference: {
      small: 'gpu_small',
      large: 'gpu_large',
    },
  },

  // 成本优化建议
  cost_optimization: {
    use_spot_for_batch: true,
    right_sizing_threshold: 0.7,  // 利用率低于70%考虑缩小
    schedule_scale_down: '22:00',  // 夜间缩容
    schedule_scale_up: '08:00',    # 早晨扩容
  },
};
```

### 隔离最佳实践

```typescript
// 租户隔离策略
const TENANT_ISOLATION = {
  // 网络隔离
  network: {
    isolation_mode: 'vpc',  // VPC隔离
    security_groups: true,
    network_policies: true,
  },

  // 资源隔离
  resource: {
    dedicated_pools: ['enterprise'],  // 企业租户专用池
    shared_pools: ['free', 'starter'], // 共享池
    quota_enforcement: 'strict',       // 严格配额
  },

  // 数据隔离
  data: {
    separate_databases: ['enterprise'],
    shared_database: ['free', 'starter'],
    encryption_per_tenant: true,
  },
};
```

---

**最后更新**: 2026-04-14
