# 多租户隔离与资源配额系统设计

## 概述

多租户隔离与资源配额系统是无限生成平台的共享资源管理核心，负责在共享基础设施上为多个租户提供隔离的执行环境、独立的资源配额和公平的资源分配。对于一个面向用户的SaaS平台，多租户隔离和资源配额是不可或缺的基础能力。

## 核心价值

```
多租户管理 = 隔离 × 配额 × 公平 × 安全 × 可观测

多租户系统的核心价值：
1. 租户隔离 - 确保租户间互不干扰
2. 资源公平 - 基于配额的公平资源分配
3. 成本控制 - 防止资源滥用
4. 安全保证 - 防止跨租户数据泄露
5. 独立计量 - 租户级别用量追踪
```

## 租户模型

### 租户类型

```typescript
// 租户类型
enum TenantType {
  INDIVIDUAL = 'individual',       // 个人用户
  TEAM = 'team',                 // 团队
  ORGANIZATION = 'organization',  // 组织
  ENTERPRISE = 'enterprise'       // 企业
}

// 租户
interface Tenant {
  id: string;
  name: string;
  type: TenantType;
  status: TenantStatus;

  // 层级关系
  parentId?: string;             // 父租户 (用于团队/组织)
  children?: string[];           // 子租户

  // 配额
  quotas: ResourceQuota;

  // 计费
  billing: {
    planId: string;
    paymentMethod?: string;
    billingEmail: string;
  };

  // 设置
  settings: TenantSettings;

  // 限制
  limits: TenantLimits;

  // 标签
  tags: string[];

  // 生命周期
  createdAt: Date;
  updatedAt: Date;
  suspendedAt?: Date;
}

// 租户状态
enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
  DELETED = 'deleted'
}

// 资源配额
interface ResourceQuota {
  // 计算资源
  compute: {
    cpuHours: number;            // CPU小时/月
    concurrentGenerations: number; // 最大并发生成数
    executionTimeout: number;     // 执行超时(ms)
  };

  // 存储资源
  storage: {
    totalBytes: number;         // 总存储(bytes)
    maxFileSize: number;        // 最大文件大小
    maxFiles: number;           // 最大文件数
  };

  // AI资源
  ai: {
    tokensPerMonth: number;      // 每月Token数
    requestsPerDay: number;     // 每日请求数
    maxConcurrentRequests: number; // 最大并发请求
  };

  // 项目限制
  projects: {
    maxProjects: number;        // 最大项目数
    archivedProjects: number;    // 归档项目数
  };

  // 团队限制
  team: {
    maxMembers: number;         // 最大成员数
    maxInvitations: number;     // 最大邀请数
  };
}

// 租户设置
interface TenantSettings {
  // 隔离级别
  isolationLevel: 'shared' | 'dedicated' | 'isolated';

  // 网络策略
  networkPolicy: {
    allowInternetAccess: boolean;
    allowedIPRanges?: string[];
    vpcId?: string;
  };

  // 存储策略
  storagePolicy: {
    encryptionEnabled: boolean;
    retentionDays: number;
    backupEnabled: boolean;
  };

  // 合规设置
  compliance: {
    dataResidency: string;     // 数据驻留地
    gdprEnabled: boolean;
    soc2Enabled: boolean;
  };
}
```

### 租户层级

```
┌─────────────────────────────────────────────────────────────────────┐
│                        组织 (Organization)                            │
│  - 企业级配额                                                        │
│  - 统一计费                                                         │
│  - 跨团队资源池                                                      │
│  - SSO集成                                                          │
└─────────────────────────────────────────────────────────────────────┘
                    │
                    ├──────────────────────────────────┐
                    │                                  │
                    ▼                                  ▼
        ┌───────────────────┐              ┌───────────────────┐
        │     团队 A         │              │     团队 B         │
        │  - 团队级配额        │              │  - 团队级配额        │
        │  - 独立成员管理      │              │  - 独立成员管理      │
        │  - 团队资源池        │              │  - 团队资源池        │
        └───────────────────┘              └───────────────────┘
                    │
                    ├──────────────────────────────────┐
                    │                                  │
                    ▼                                  ▼
        ┌───────────────────┐              ┌───────────────────┐
        │   个人用户 A1      │              │   个人用户 A2      │
        │  - 个人配额         │              │  - 个人配额         │
        │  - 独立项目         │              │  - 独立项目         │
        └───────────────────┘              └───────────────────┘
```

## 隔离机制

### 计算隔离

```typescript
// 计算隔离策略
interface ComputeIsolation {
  // 隔离类型
  type: 'shared' | 'namespace' | 'cgroup' | 'vm';

  // 资源限制
  limits: {
    maxCpuLimit: number;         // CPU限制
    maxMemoryLimit: number;     // 内存限制
    maxDiskIOPS: number;        // 磁盘IOPS
    maxNetworkBandwidth: number; // 网络带宽
  };

  // 调度策略
  scheduling: {
    algorithm: 'cfs' | 'fair' | 'realtime';
    weight?: number;            // 权重 (用于公平调度)
    priority?: number;           // 优先级
  };

  // QoS配置
  qos: {
    guaranteedCpu?: number;    // 保障CPU
    burstCpu?: number;          // 突发CPU
    guaranteedMemory?: number;  // 保障内存
  };
}

// 隔离执行器
class IsolationExecutor {
  constructor(
    private containerManager: ContainerManager,
    private quotaManager: QuotaManager
  ) {}

  // 为租户创建隔离环境
  async createIsolationEnvironment(
    tenantId: string
  ): Promise<IsolationEnvironment> {
    const tenant = await this.getTenant(tenantId);
    const quotas = await this.quotaManager.getQuotas(tenantId);

    // 1. 创建网络命名空间
    const namespace = await this.createNetworkNamespace(tenantId);

    // 2. 创建资源组
    const resourceGroup = await this.createResourceGroup(tenantId, quotas);

    // 3. 配置配额
    await this.configureQuotas(resourceGroup, quotas);

    // 4. 设置网络策略
    await this.configureNetworkPolicy(namespace, tenant.settings.networkPolicy);

    return {
      id: generateId('env'),
      tenantId,
      namespace,
      resourceGroup,
      createdAt: new Date()
    };
  }

  // 在隔离环境中执行
  async executeInIsolation(
    request: ExecutionRequest
  ): Promise<ExecutionResult> {
    const tenantId = request.tenantId;

    // 1. 验证配额
    const quotaCheck = await this.quotaManager.checkQuota(tenantId, 'compute');
    if (!quotaCheck.allowed) {
      throw new QuotaExceededError(quotaCheck);
    }

    // 2. 获取隔离环境
    const env = await this.getOrCreateEnvironment(tenantId);

    // 3. 执行
    const result = await this.containerManager.run({
      image: request.image,
      command: request.command,
      namespace: env.namespace,
      resourceGroup: env.resourceGroup,
      limits: this.getTenantLimits(tenantId)
    });

    // 4. 更新用量
    await this.quotaManager.recordUsage(tenantId, 'compute', {
      cpuSeconds: result.cpuTime,
      memoryBytes: result.memoryUsed
    });

    return result;
  }
}

// 资源组
interface ResourceGroup {
  id: string;
  tenantId: string;
  name: string;
  limits: ComputeLimits;
  currentUsage: ResourceUsage;
}
```

### 存储隔离

```typescript
// 存储隔离策略
interface StorageIsolation {
  // 存储类型
  type: 'shared' | 'directory' | 'quota' | 'filesystem';

  // 挂载点
  mountPoint: string;

  // 配额
  quotas: {
    maxBytes: number;
    maxFiles: number;
    maxInodes?: number;
  };

  // 权限
  permissions: {
    read: string[];
    write: string[];
    admin: string[];
  };

  // 加密
  encryption: {
    enabled: boolean;
    algorithm: string;
    keySource: 'tenant' | 'platform' | 'kms';
  };
}

// 存储隔离管理器
class StorageIsolationManager {
  constructor(
    private storageBackend: StorageBackend,
    private quotaManager: QuotaManager
  ) {}

  // 创建租户存储
  async createTenantStorage(tenantId: string): Promise<TenantStorage> {
    const tenant = await this.getTenant(tenantId);
    const quotas = tenant.quotas.storage;

    // 1. 创建存储目录
    const path = `/tenants/${tenantId}`;
    await this.storageBackend.createDirectory(path);

    // 2. 设置配额
    await this.storageBackend.setQuota(path, {
      maxBytes: quotas.totalBytes,
      maxFiles: quotas.maxFiles
    });

    // 3. 设置权限
    await this.storageBackend.setPermissions(path, {
      owner: tenantId,
      group: tenant.type,
      mode: '750'
    });

    // 4. 配置加密
    if (tenant.settings.storagePolicy.encryptionEnabled) {
      await this.storageBackend.enableEncryption(path, {
        algorithm: 'AES-256-GCM',
        keyId: tenantId
      });
    }

    return {
      tenantId,
      path,
      quotas,
      usedBytes: 0,
      fileCount: 0
    };
  }

  // 检查存储配额
  async checkStorageQuota(tenantId: string, size: number): Promise<boolean> {
    const storage = await this.getTenantStorage(tenantId);
    return (storage.usedBytes + size) <= storage.quotas.maxBytes;
  }
}
```

### 网络隔离

```typescript
// 网络隔离策略
interface NetworkIsolation {
  // 隔离类型
  type: 'shared' | 'vlan' | 'vxlan' | 'vpc';

  // 网络配置
  network: {
    cidr: string;               // 网络段
    gateway: string;
    dns: string[];
  };

  // 访问控制
  accessControl: {
    inbound: FirewallRule[];
    outbound: FirewallRule[];
    internal: boolean;          // 是否允许内部通信
  };

  // 带宽限制
  bandwidth: {
    ingressMbps: number;
    egressMbps: number;
    burstMbps?: number;
  };
}

// 防火墙规则
interface FirewallRule {
  id: string;
  direction: 'inbound' | 'outbound';
  protocol: 'tcp' | 'udp' | 'icmp' | 'all';
  port?: number | string;       // 端口或范围
  source?: string;              // 源IP
  destination?: string;          // 目标IP
  action: 'allow' | 'deny';
}
```

## 资源配额管理

### 配额引擎

```typescript
// 配额管理器
class QuotaManager {
  private quotaStore: QuotaStore;
  private usageTracker: UsageTracker;

  constructor(
    private quotaRules: QuotaRule[],
    private enforcement: QuotaEnforcement
  ) {}

  // 检查配额
  async checkQuota(
    tenantId: string,
    resourceType: ResourceType,
    requested?: number
  ): Promise<QuotaCheckResult> {
    const tenant = await this.getTenant(tenantId);
    const quota = await this.getQuota(tenantId, resourceType);
    const usage = await this.getCurrentUsage(tenantId, resourceType);

    const available = quota.limit - usage.current;
    const allowed = requested ? requested <= available : true;

    // 计算配额状态
    const percentage = (usage.current / quota.limit) * 100;
    let status: QuotaStatus;
    if (percentage >= 100) status = 'exhausted';
    else if (percentage >= 90) status = 'critical';
    else if (percentage >= 75) status = 'warning';
    else status = 'normal';

    // 触发告警
    if (percentage >= quota.warningThreshold) {
      await this.triggerQuotaAlert(tenantId, resourceType, percentage);
    }

    return {
      allowed,
      resourceType,
      quota: {
        limit: quota.limit,
        used: usage.current,
        available,
        percentage
      },
      status,
      retryAfter: allowed ? undefined : this.estimateRetryAfter(tenantId, resourceType)
    };
  }

  // 预留配额
  async reserveQuota(
    tenantId: string,
    resourceType: ResourceType,
    amount: number,
    ttl: number
  ): Promise<Reservation> {
    // 1. 检查配额
    const check = await this.checkQuota(tenantId, resourceType, amount);
    if (!check.allowed) {
      throw new QuotaExceededError(check);
    }

    // 2. 创建预留
    const reservation: Reservation = {
      id: generateId('res'),
      tenantId,
      resourceType,
      amount,
      status: 'active',
      expiresAt: new Date(Date.now() + ttl),
      createdAt: new Date()
    };

    await this.quotaStore.saveReservation(reservation);

    // 3. 暂时减少可用配额
    await this.reduceAvailableQuota(tenantId, resourceType, amount);

    return reservation;
  }

  // 释放预留
  async releaseReservation(reservationId: string): Promise<void> {
    const reservation = await this.quotaStore.getReservation(reservationId);

    if (reservation.status === 'active') {
      // 恢复配额
      await this.restoreAvailableQuota(
        reservation.tenantId,
        reservation.resourceType,
        reservation.amount
      );

      reservation.status = 'released';
      reservation.releasedAt = new Date();
      await this.quotaStore.updateReservation(reservation);
    }
  }

  // 消耗配额 (实际使用)
  async consumeQuota(
    tenantId: string,
    resourceType: ResourceType,
    amount: number
  ): Promise<void> {
    // 更新使用量
    await this.usageTracker.record(tenantId, resourceType, amount);

    // 检查是否超过软限制
    const quota = await this.getQuota(tenantId, resourceType);
    const usage = await this.getCurrentUsage(tenantId, resourceType);

    if (usage.current > quota.softLimit) {
      // 触发超额告警
      await this.triggerOverageAlert(tenantId, resourceType, usage.current - quota.softLimit);
    }
  }
}

// 配额检查结果
interface QuotaCheckResult {
  allowed: boolean;
  resourceType: ResourceType;
  quota: {
    limit: number;
    used: number;
    available: number;
    percentage: number;
  };
  status: QuotaStatus;
  retryAfter?: number;
}

// 配额状态
enum QuotaStatus {
  NORMAL = 'normal',
  WARNING = 'warning',
  CRITICAL = 'critical',
  EXHAUSTED = 'exhausted',
  OVERAGE = 'overage'
}

// 资源类型
enum ResourceType {
  CPU = 'cpu',
  MEMORY = 'memory',
  STORAGE = 'storage',
  TOKENS = 'tokens',
  REQUESTS = 'requests',
  CONCURRENT_GENERATIONS = 'concurrent_generations',
  PROJECTS = 'projects',
  TEAM_MEMBERS = 'team_members'
}
```

### 配额规则引擎

```typescript
// 配额规则
interface QuotaRule {
  id: string;
  name: string;

  // 适用条件
  conditions: {
    tenantTypes?: TenantType[];
    plans?: string[];
    regions?: string[];
    tags?: string[];
  };

  // 配额配置
  quotas: Partial<ResourceQuota>;

  // 优先级
  priority: number;

  // 是否可叠加
  stackable: boolean;
}

// 规则引擎
class QuotaRuleEngine {
  constructor(
    private ruleStore: QuotaRuleStore,
    private planQuotaMapper: PlanQuotaMapper
  ) {}

  // 计算租户配额
  async calculateQuotas(tenantId: string): Promise<ResourceQuota> {
    const tenant = await this.getTenant(tenantId);
    const applicableRules = await this.getApplicableRules(tenant);

    // 1. 获取计划基础配额
    let quotas = this.planQuotaMapper.getBaseQuotas(tenant.billing.planId);

    // 2. 应用规则 (按优先级排序)
    for (const rule of applicableRules.sort((a, b) => b.priority - a.priority)) {
      quotas = this.applyRule(quotas, rule);
    }

    return quotas;
  }

  // 应用规则
  private applyRule(
    current: ResourceQuota,
    rule: QuotaRule
  ): ResourceQuota {
    if (!rule.stackable) {
      // 非叠加规则覆盖
      return { ...current, ...rule.quotas };
    }

    // 叠加规则: 取较大值
    return this.mergeWithMax(current, rule.quotas);
  }

  // 合并配额 (取最大值)
  private mergeWithMax(
    a: ResourceQuota,
    b: Partial<ResourceQuota>
  ): ResourceQuota {
    const result = { ...a };

    if (b.compute) {
      result.compute = {
        cpuHours: Math.max(a.compute.cpuHours, b.compute.cpuHours || 0),
        concurrentGenerations: Math.max(
          a.compute.concurrentGenerations,
          b.compute.concurrentGenerations || 0
        ),
        executionTimeout: Math.min(
          a.compute.executionTimeout,
          b.compute.executionTimeout || Infinity
        )
      };
    }

    if (b.storage) {
      result.storage = {
        totalBytes: Math.max(a.storage.totalBytes, b.storage.totalBytes || 0),
        maxFileSize: Math.max(a.storage.maxFileSize, b.storage.maxFileSize || 0),
        maxFiles: Math.max(a.storage.maxFiles, b.storage.maxFiles || 0)
      };
    }

    if (b.ai) {
      result.ai = {
        tokensPerMonth: Math.max(a.ai.tokensPerMonth, b.ai.tokensPerMonth || 0),
        requestsPerDay: Math.max(a.ai.requestsPerDay, b.ai.requestsPerDay || 0),
        maxConcurrentRequests: Math.max(
          a.ai.maxConcurrentRequests,
          b.ai.maxConcurrentRequests || 0
        )
      };
    }

    return result;
  }
}
```

## 公平调度

### 公平调度器

```typescript
// 公平调度器
class FairShareScheduler {
  constructor(
    private resourcePool: ResourcePool,
    private quotaManager: QuotaManager
  ) {}

  // 分配资源
  async allocate(
    request: AllocationRequest
  ): Promise<Allocation> {
    // 1. 计算公平份额
    const fairShare = await this.calculateFairShare(request.tenantId);

    // 2. 计算权重
    const weight = await this.calculateWeight(request.tenantId);

    // 3. 确定分配量
    const allocationAmount = Math.min(
      request.requested,
      fairShare.available,
      weight.share
    );

    // 4. 分配
    const allocation: Allocation = {
      id: generateId('alloc'),
      tenantId: request.tenantId,
      resourceType: request.resourceType,
      requested: request.requested,
      allocated: allocationAmount,
      fairShareUsed: allocationAmount / fairShare.total,
      timestamp: new Date()
    };

    // 5. 预留资源
    await this.resourcePool.reserve(allocation);

    // 6. 启动过期检查
    if (request.timeout) {
      setTimeout(() => this.expireAllocation(allocation.id), request.timeout);
    }

    return allocation;
  }

  // 计算公平份额
  private async calculateFairShare(tenantId: string): Promise<FairShare> {
    const totalResources = await this.resourcePool.getTotalResources();
    const activeTenants = await this.quotaManager.getActiveTenants();

    // 计算租户权重总和
    let totalWeight = 0;
    const tenantWeights: Map<string, number> = new Map();

    for (const tenant of activeTenants) {
      const weight = await this.calculateWeight(tenant);
      tenantWeights.set(tenant, weight);
      totalWeight += weight;
    }

    // 计算租户的公平份额
    const tenantWeight = tenantWeights.get(tenantId) || 1;
    const share = (tenantWeight / totalWeight) * totalResources;

    return {
      tenantId,
      total: totalResources,
      share,
      weight: tenantWeight,
      percentage: tenantWeight / totalWeight
    };
  }

  // 计算权重
  private async calculateWeight(tenantId: string): Promise<number> {
    const tenant = await this.getTenant(tenantId);
    const usage = await this.quotaManager.getUsage(tenantId);

    // 基础权重
    let weight = 1;

    // 付费用户更高权重
    if (tenant.billing.planId !== 'free') {
      weight *= 2;
    }

    // 使用量越少权重越高 (鼓励节约)
    const usageRatio = usage.current / usage.quota;
    if (usageRatio < 0.5) {
      weight *= 1.5;
    } else if (usageRatio < 0.8) {
      weight *= 1.2;
    }

    return weight;
  }
}

// 资源池
interface ResourcePool {
  getTotalResources(): Promise<number>;
  reserve(allocation: Allocation): Promise<void>;
  release(allocationId: string): Promise<void>;
}

// 分配
interface Allocation {
  id: string;
  tenantId: string;
  resourceType: ResourceType;
  requested: number;
  allocated: number;
  fairShareUsed: number;
  timestamp: Date;
}
```

### 优先级调度

```typescript
// 优先级调度器
class PriorityScheduler {
  private queues: Map<Priority, PriorityQueue>;

  constructor(
    private quotaManager: QuotaManager,
    private fairShareScheduler: FairShareScheduler
  ) {
    // 初始化优先级队列
    this.queues = new Map([
      [Priority.CRITICAL, new PriorityQueue()],
      [Priority.HIGH, new PriorityQueue()],
      [Priority.NORMAL, new PriorityQueue()],
      [Priority.LOW, new PriorityQueue()]
    ]);
  }

  // 入队
  async enqueue(request: ScheduleRequest): Promise<void> {
    // 1. 确定优先级
    const priority = this.determinePriority(request);

    // 2. 配额检查
    const quotaCheck = await this.quotaManager.checkQuota(
      request.tenantId,
      request.resourceType
    );

    if (!quotaCheck.allowed) {
      throw new QuotaExceededError(quotaCheck);
    }

    // 3. 入队
    const entry: QueueEntry = {
      id: generateId('entry'),
      request,
      priority,
      tenantId: request.tenantId,
      enqueuedAt: new Date(),
      weight: await this.calculateWeight(request)
    };

    await this.queues.get(priority)!.enqueue(entry);
  }

  // 出队
  async dequeue(): Promise<QueueEntry | null> {
    // 从高优先级到低优先级
    for (const [priority, queue] of this.queues) {
      if (await queue.length() > 0) {
        const entry = await queue.dequeue();

        // 检查配额
        const quotaCheck = await this.quotaManager.checkQuota(
          entry.tenantId,
          entry.request.resourceType
        );

        if (quotaCheck.allowed) {
          return entry;
        } else {
          // 配额不足，重新入队 (降低优先级)
          entry.priority = this.lowerPriority(priority);
          await this.queues.get(entry.priority)!.enqueue(entry);
        }
      }
    }

    return null;
  }

  // 确定优先级
  private determinePriority(request: ScheduleRequest): Priority {
    // SLA要求
    if (request.sla?.priority === 'critical') return Priority.CRITICAL;
    if (request.sla?.priority === 'high') return Priority.HIGH;

    // 租户类型
    const tenant = await this.getTenant(request.tenantId);
    if (tenant.type === 'enterprise') return Priority.HIGH;

    // 付费用户
    if (tenant.billing.planId !== 'free') return Priority.NORMAL;

    return Priority.LOW;
  }
}

// 优先级
enum Priority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3
}
```

## 用量追踪

### 用量记录

```typescript
// 用量追踪器
class UsageTracker {
  constructor(
    private metricsStore: MetricsStore,
    private aggregationService: AggregationService
  ) {}

  // 记录使用量
  async record(
    tenantId: string,
    resourceType: ResourceType,
    amount: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const entry: UsageEntry = {
      id: generateId('usage'),
      tenantId,
      resourceType,
      amount,
      timestamp: new Date(),
      metadata
    };

    // 1. 存储原始记录
    await this.metricsStore.record(entry);

    // 2. 更新实时计数器
    await this.updateRealtimeCounter(tenantId, resourceType, amount);

    // 3. 触发配额检查
    await this.checkQuotaExceeded(tenantId, resourceType);
  }

  // 获取当前用量
  async getCurrentUsage(
    tenantId: string,
    resourceType: ResourceType
  ): Promise<UsageSnapshot> {
    const now = new Date();
    const periodStart = this.getPeriodStart(now);

    // 查询周期内总用量
    const result = await this.metricsStore.aggregate({
      tenantId,
      resourceType,
      startTime: periodStart,
      endTime: now,
      aggregation: 'sum'
    });

    return {
      tenantId,
      resourceType,
      period: { start: periodStart, end: now },
      current: result.value,
      lastUpdated: now
    };
  }

  // 获取周期用量
  async getUsageHistory(
    tenantId: string,
    resourceType: ResourceType,
    period: UsagePeriod
  ): Promise<TimeSeriesUsage> {
    const buckets = await this.aggregationService.aggregateByTime({
      tenantId,
      resourceType,
      startTime: period.start,
      endTime: period.end,
      interval: period.interval
    });

    return {
      tenantId,
      resourceType,
      period,
      buckets
    };
  }
}

// 用量条目
interface UsageEntry {
  id: string;
  tenantId: string;
  resourceType: ResourceType;
  amount: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}
```

## 租户生命周期

### 租户创建与删除

```typescript
// 租户服务
class TenantService {
  constructor(
    private tenantStore: TenantStore,
    private quotaManager: QuotaManager,
    private isolationManager: IsolationManager
  ) {}

  // 创建租户
  async createTenant(request: CreateTenantRequest): Promise<Tenant> {
    // 1. 验证唯一性
    await this.validateUnique(request.name, request.email);

    // 2. 创建租户记录
    const tenant: Tenant = {
      id: generateId('tenant'),
      name: request.name,
      type: request.type,
      status: TenantStatus.PENDING,

      quotas: await this.quotaManager.calculateQuotas(request.planId),
      billing: {
        planId: request.planId,
        billingEmail: request.billingEmail
      },
      settings: this.getDefaultSettings(request.type),

      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.tenantStore.save(tenant);

    // 3. 创建隔离环境
    await this.isolationManager.createIsolationEnvironment(tenant.id);

    // 4. 初始化配额
    await this.quotaManager.initializeQuotas(tenant.id);

    // 5. 发送欢迎邮件
    await this.sendWelcomeEmail(tenant);

    return tenant;
  }

  // 删除租户
  async deleteTenant(tenantId: string): Promise<void> {
    const tenant = await this.getTenant(tenantId);

    // 1. 检查是否可以删除
    if (await this.hasActiveResources(tenantId)) {
      throw new ActiveResourcesError('Cannot delete tenant with active resources');
    }

    // 2. 归档数据
    await this.archiveTenantData(tenantId);

    // 3. 清理隔离环境
    await this.isolationManager.cleanupEnvironment(tenantId);

    // 4. 删除配额
    await this.quotaManager.deleteQuotas(tenantId);

    // 5. 更新状态
    tenant.status = TenantStatus.DELETED;
    tenant.deletedAt = new Date();
    await this.tenantStore.update(tenant);
  }

  // 暂停租户
  async suspendTenant(tenantId: string, reason: string): Promise<void> {
    const tenant = await this.getTenant(tenantId);

    // 1. 停止所有活动
    await this.stopAllActivities(tenantId);

    // 2. 撤销API访问
    await this.revokeAccess(tenantId);

    // 3. 更新状态
    tenant.status = TenantStatus.SUSPENDED;
    tenant.suspendedAt = new Date();
    tenant.suspensionReason = reason;
    await this.tenantStore.update(tenant);

    // 4. 通知
    await this.notifyTenant(tenantId, 'suspended', reason);
  }
}
```

## 监控与告警

### 租户监控

```typescript
// 租户监控服务
class TenantMonitoringService {
  constructor(
    private metricsCollector: MetricsCollector,
    private alertManager: AlertManager
  ) {}

  // 收集租户指标
  async collectTenantMetrics(tenantId: string): Promise<TenantMetrics> {
    const usage = await this.getCurrentUsage(tenantId);
    const quotas = await this.quotaManager.getQuotas(tenantId);

    return {
      tenantId,
      timestamp: new Date(),
      usage: {
        compute: this.calculateUsagePercentage(usage.compute, quotas.compute),
        storage: this.calculateUsagePercentage(usage.storage, quotas.storage),
        ai: this.calculateUsagePercentage(usage.ai, quotas.ai)
      },
      health: this.calculateHealth(usage, quotas)
    };
  }

  // 告警规则
  async checkAlerts(tenantId: string): Promise<void> {
    const metrics = await this.collectTenantMetrics(tenantId);

    // 配额告警
    for (const [resource, percentage] of Object.entries(metrics.usage)) {
      if (percentage >= 100) {
        await this.alertManager.raise({
          type: 'quota_exhausted',
          tenantId,
          severity: 'critical',
          details: { resource, percentage }
        });
      } else if (percentage >= 90) {
        await this.alertManager.raise({
          type: 'quota_critical',
          tenantId,
          severity: 'high',
          details: { resource, percentage }
        });
      }
    }

    // 健康告警
    if (metrics.health === 'critical') {
      await this.alertManager.raise({
        type: 'tenant_health_critical',
        tenantId,
        severity: 'high',
        details: metrics
      });
    }
  }
}
```

## 配置

```typescript
// 多租户配置
interface MultiTenantConfig {
  // 隔离级别
  isolation: {
    defaultLevel: 'shared' | 'namespace' | 'cgroup' | 'vm';
    allowDedicated: boolean;
    allowIsolated: boolean;
  };

  // 配额配置
  quotas: {
    defaultPlan: string;
    allowOverage: boolean;
    overageGracePeriod: number;       // 宽限期 (小时)
    maxOveragePercentage: number;    // 最大超额百分比
  };

  // 公平调度
  fairScheduling: {
    enabled: boolean;
    weights: {
      paid: number;
      free: number;
      enterprise: number;
    };
    minSharePercentage: number;     // 最小份额百分比
  };

  // 租户限制
  limits: {
    maxTenantsPerOrganization: number;
    maxOrganizationsPerUser: number;
    tenantNameMinLength: number;
    tenantNameMaxLength: number;
  };

  // 生命周期
  lifecycle: {
    pendingTimeout: number;          // 待验证超时 (小时)
    suspensionGracePeriod: number;   // 暂停宽限期 (天)
    deletionRetentionPeriod: number; // 删除保留期 (天)
  };

  // 合规
  compliance: {
    requireEmailVerification: boolean;
    requirePaymentMethod: boolean;
    dataResidencyOptions: string[];
    defaultDataResidency: string;
  };
}
```

## 最佳实践

### 1. 隔离策略选择

```
- 个人用户 → 共享命名空间隔离
- 团队 → 资源组隔离
- 企业 → 专用资源池
- 高安全要求 → VM级隔离
```

### 2. 配额设置

```
- 基于套餐设置基础配额
- 支持自定义配额覆盖
- 设置软限制和硬限制
- 保留合理的使用缓冲
```

### 3. 公平调度

```
- 考虑租户权重
- 防止资源饥饿
- 优先保障高优先级租户
- 动态调整公平份额
```

---

**最后更新**: 2026-04-15
