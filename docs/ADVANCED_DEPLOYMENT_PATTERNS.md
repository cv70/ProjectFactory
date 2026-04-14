# Advanced Deployment Patterns

## 1. 概述

本文档定义 ProjectFactory 系统的先进部署模式（Advanced Deployment Patterns），确保系统能够安全、可靠地进行版本发布和服务更新。

### 1.1 部署模式概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         先进部署模式架构                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        部署策略层                                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  滚动更新   │  │  蓝绿部署   │  │  金丝雀发布  │              │   │
│  │  │  Rolling   │  │ Blue-Green │  │  Canary    │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  特性开关   │  │  渐进式发布  │  │  回滚策略   │              │   │
│  │  │ Feature     │  │ Progressive│  │  Rollback  │              │   │
│  │  │ Flags     │  │ Release   │  │ Strategies │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────┼─────────────────────────────────┐   │
│  │                           基础设施层                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  Kubernetes │  │   Docker    │  │  CI/CD     │              │   │
│  │  │  Deployments│  │  Compose   │  │  Pipelines │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 滚动更新策略

### 2.1 Kubernetes 滚动更新

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: projectfactory-api
  labels:
    app: projectfactory
    component: api
spec:
  replicas: 6
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2        # 最多超出期望副本数
      maxUnavailable: 0   # 滚动过程中始终保持 6 个可用
  selector:
    matchLabels:
      app: projectfactory
      component: api
  template:
    metadata:
      labels:
        app: projectfactory
        component: api
    spec:
      # 终止gracePeriodSeconds
      terminationGracePeriodSeconds: 60

      # 容器配置
      containers:
        - name: api
          image: projectfactory/api:${VERSION}
          ports:
            - containerPort: 3000
              name: http

          # 健康检查
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
            failureThreshold: 3

          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
            failureThreshold: 3

          # 资源限制
          resources:
            requests:
              cpu: "100m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "1Gi"

          # 优雅终止
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "sleep 10"]

---

# 滚动更新配置
apiVersion: v1
kind: ConfigMap
metadata:
  name: rolling-update-config
data:
  maxSurge: "2"
  maxUnavailable: "0"
  minReadySeconds: "30"
  revisionHistoryLimit: "5"
```

### 2.2 滚动更新控制器

```typescript
// controllers/rolling-update.controller.ts
class RollingUpdateController {
  private kubernetes: KubernetesClient;
  private metricsClient: MetricsClient;

  // 执行滚动更新
  async executeUpdate(
    deployment: DeploymentConfig,
    options: RollingUpdateOptions
  ): Promise<UpdateResult> {
    const { maxSurge, maxUnavailable, minReadySeconds } = options;

    // 1. 创建新版本副本集
    const newRS = await this.createNewReplicaSet(deployment);

    // 2. 逐步增加新版本副本
    const originalReplicas = deployment.spec.replicas;
    let updatedReplicas = 0;

    while (updatedReplicas < originalReplicas) {
      // 增加新版本
      const surgeCount = Math.min(maxSurge, originalReplicas - updatedReplicas);
      await this.scaleReplicaSet(newRS, updatedReplicas + surgeCount);

      // 等待新版本就绪
      await this.waitForReady(newRS, minReadySeconds);

      // 减少旧版本
      const unavailableCount = Math.min(maxUnavailable, originalReplicas - updatedReplicas);
      await this.scaleReplicaSet(deployment.currentRS, updatedReplicas - unavailableCount);

      updatedReplicas += surgeCount;

      // 记录进度
      await this.recordProgress({
        phase: 'rolling-update',
        updated: updatedReplicas,
        total: originalReplicas
      });
    }

    // 3. 清理旧版本
    await this.cleanupOldReplicaSets(deployment);

    return {
      success: true,
      newVersion: newRS.version,
      downtime: 0
    };
  }

  // 健康检查
  private async waitForReady(
    replicaSet: ReplicaSet,
    minReadySeconds: number
  ): Promise<void> {
    const startTime = Date.now();

    while (true) {
      const status = await this.kubernetes.getReplicaSetStatus(replicaSet);

      if (status.readyReplicas === status.replicas &&
          Date.now() - startTime >= minReadySeconds * 1000) {
        return;
      }

      // 检查是否有错误
      const crashCount = await this.checkCrashLoop(status);
      if (crashCount > 3) {
        throw new Error(`Too many crashes during rolling update: ${crashCount}`);
      }

      await sleep(5000);
    }
  }

  // 回滚
  async rollback(deployment: Deployment): Promise<void> {
    const previousRS = await this.kubernetes.getPreviousReplicaSet(deployment);

    if (!previousRS) {
      throw new Error('No previous version to rollback to');
    }

    // 快速切换
    await this.kubernetes.scaleReplicaSet(previousRS, deployment.spec.replicas);
    await this.kubernetes.scaleReplicaSet(deployment.currentRS, 0);

    // 等待就绪
    await this.waitForReady(previousRS, 30);
  }
}
```

---

## 3. 蓝绿部署

### 3.1 蓝绿部署配置

```yaml
# kubernetes/blue-green-deployment.yaml
apiVersion: v1
kind: Service
metadata:
  name: projectfactory-active
  labels:
    app: projectfactory
spec:
  # 生产环境指向蓝色环境
  selector:
    app: projectfactory
    slot: blue
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP

---
# 蓝色环境 (当前生产)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: projectfactory-blue
  labels:
    app: projectfactory
    slot: blue
spec:
  replicas: 6
  selector:
    matchLabels:
      app: projectfactory
      slot: blue
  template:
    metadata:
      labels:
        app: projectfactory
        slot: blue
        version: v1.0.0
    spec:
      containers:
        - name: api
          image: projectfactory/api:v1.0.0
          ports:
            - containerPort: 3000
          env:
            - name: SLOT
              value: blue

---
# 绿色环境 (新版本)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: projectfactory-green
  labels:
    app: projectfactory
    slot: green
spec:
  replicas: 0  # 初始为 0
  selector:
    matchLabels:
      app: projectfactory
      slot: green
  template:
    metadata:
      labels:
        app: projectfactory
        slot: green
        version: v1.1.0
    spec:
      containers:
        - name: api
          image: projectfactory/api:v1.1.0
          ports:
            - containerPort: 3000
          env:
            - name: SLOT
              value: green
```

### 3.2 蓝绿部署控制器

```typescript
// controllers/blue-green.controller.ts
class BlueGreenDeploymentController {
  private kubernetes: KubernetesClient;
  private loadBalancer: LoadBalancerController;

  // 执行蓝绿切换
  async switchover(
    options: BlueGreenOptions
  ): Promise<SwitchoverResult> {
    const { targetSlot, healthCheck = true, warmupTime = 300 } = options;

    // 1. 预热绿色环境
    await this.warmupEnvironment(targetSlot);

    // 2. 启动绿色环境
    await this.scaleEnvironment(targetSlot, 6);

    // 3. 健康检查
    if (healthCheck) {
      const healthy = await this.performHealthCheck(targetSlot);

      if (!healthy) {
        await this.abortSwitchover(targetSlot);
        throw new Error('Health check failed for new environment');
      }
    }

    // 4. 等待预热
    await this.waitForWarmup(targetSlot, warmupTime);

    // 5. 切换流量
    await this.switchTraffic(targetSlot);

    // 6. 关闭蓝色环境
    await this.scaleEnvironment(this.getOtherSlot(targetSlot), 0);

    return {
      success: true,
      previousSlot: this.getOtherSlot(targetSlot),
      activeSlot: targetSlot,
      switchoverTime: Date.now()
    };
  }

  // 切换流量
  private async switchTraffic(targetSlot: 'blue' | 'green'): Promise<void> {
    const service = await this.kubernetes.getService('projectfactory-active');

    // 更新 selector 指向新环境
    await this.kubernetes.patchService(service, {
      spec: {
        selector: {
          app: 'projectfactory',
          slot: targetSlot
        }
      }
    });

    // 等待负载均衡器更新
    await this.loadBalancer.waitForPropagation(30000);

    // 记录切换事件
    await this.recordSwitchover(targetSlot);
  }

  // 回滚
  async rollback(): Promise<void> {
    const currentSlot = await this.getCurrentActiveSlot();
    const targetSlot = this.getOtherSlot(currentSlot);

    console.log(`Rolling back from ${currentSlot} to ${targetSlot}`);

    // 直接切换回旧环境
    await this.switchTraffic(targetSlot);

    // 关闭新环境
    await this.scaleEnvironment(currentSlot, 0);
  }

  // 获取当前活跃环境
  private async getCurrentActiveSlot(): Promise<'blue' | 'green'> {
    const service = await this.kubernetes.getService('projectfactory-active');
    return service.spec.selector.slot as 'blue' | 'green';
  }
}

// 流量切换配置
interface BlueGreenOptions {
  targetSlot: 'blue' | 'green';
  healthCheck?: boolean;
  warmupTime?: number;
  runTests?: boolean;
  approvalRequired?: boolean;
}
```

---

## 4. 金丝雀发布

### 4.1 金丝雀配置

```yaml
# kubernetes/canary-deployment.yaml
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: projectfactory-api
  namespace: default
spec:
  # 目标Deployment
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: projectfactory-api

  # 金丝雀Deployment
  canaryAnalysis:
    # 分析间隔
    interval: 1m

    # 最大金丝雀副本数
    maxWeight: 50

    # 步进值
    stepWeight: 10

    # 失败阈值
    threshold: 5

    # 成功阈值
    successThreshold: 3

    # 指标检查
    metrics:
      - name: request-success-rate
        interval: 1m
        thresholdRange:
          min: 99
      - name: request-duration
        interval: 1m
        thresholdRange:
          max: 500
      - name: error-rate
        interval: 1m
        thresholdRange:
          max: 1

    # 自动推进
    autoPromotionEnabled: false

    # 告警
    webhooks:
      - name: validation
        url: http://flagger-load-tester/gate/check
        timeout: 10s
        metadata:
          type: prometheus
      - name: before-increase
        url: http://flagger-load-tester/gate/hold
        timeout: 10s
      - name: confirm-rollback
        url: http://flagger-load-tester/gate/rollback
        timeout: 10s
```

### 4.2 金丝雀控制器

```typescript
// controllers/canary.controller.ts
class CanaryDeploymentController {
  private flagger: FlaggerClient;
  private metricsServer: MetricsServer;
  private alertManager: AlertManager;

  // 启动金丝雀发布
  async startCanary(
    canary: CanaryConfig
  ): Promise<CanaryRelease> {
    // 1. 创建金丝雀Deployment
    await this.createCanaryDeployment(canary);

    // 2. 初始化分析
    await this.initializedCanaryAnalysis(canary);

    // 3. 启动渐进式流量切换
    const release = await this.executeProgressiveRollout(canary);

    return release;
  }

  // 执行渐进式发布
  private async executeProgressiveRollout(
    canary: CanaryConfig
  ): Promise<CanaryRelease> {
    const { analysis } = canary;
    let currentWeight = 0;
    let consecutiveSuccess = 0;
    let consecutiveFailure = 0;

    while (currentWeight < analysis.maxWeight) {
      // 增加权重
      currentWeight = Math.min(
        currentWeight + analysis.stepWeight,
        analysis.maxWeight
      );

      console.log(`Increasing canary weight to ${currentWeight}%`);

      // 应用权重
      await this.setCanaryWeight(canary, currentWeight);

      // 等待分析间隔
      await this.sleep(analysis.interval * 1000);

      // 获取指标
      const metrics = await this.collectCanaryMetrics(canary);

      // 分析结果
      const result = this.analyzeCanaryHealth(metrics, analysis);

      if (result.healthy) {
        consecutiveSuccess++;
        consecutiveFailure = 0;

        if (consecutiveSuccess >= analysis.successThreshold) {
          // 达到成功阈值，推进发布
          await this.promoteCanary(canary);
          return { status: 'promoted', finalWeight: currentWeight };
        }
      } else {
        consecutiveFailure++;
        consecutiveSuccess = 0;

        if (consecutiveFailure >= analysis.threshold) {
          // 达到失败阈值，回滚
          await this.abortCanary(canary);
          return { status: 'aborted', failedAtWeight: currentWeight };
        }

        // 减少流量
        await this.reduceCanaryWeight(canary, analysis.stepWeight);
      }
    }

    // 完成发布
    await this.promoteCanary(canary);
    return { status: 'promoted', finalWeight: 100 };
  }

  // 分析金丝雀健康
  private analyzeCanaryHealth(
    metrics: CanaryMetrics,
    analysis: CanaryAnalysis
  ): AnalysisResult {
    const checks: CheckResult[] = [];

    // 检查成功率
    checks.push({
      name: 'request-success-rate',
      passed: metrics.successRate >= analysis.metrics[0].thresholdRange.min,
      value: metrics.successRate
    });

    // 检查延迟
    checks.push({
      name: 'request-duration',
      passed: metrics.latency.p99 <= analysis.metrics[1].thresholdRange.max,
      value: metrics.latency.p99
    });

    // 检查错误率
    checks.push({
      name: 'error-rate',
      passed: metrics.errorRate <= analysis.metrics[2].thresholdRange.max,
      value: metrics.errorRate
    });

    const allPassed = checks.every(c => c.passed);

    return {
      healthy: allPassed,
      checks,
      recommendation: allPassed ? 'promote' : 'wait'
    };
  }

  // 回滚金丝雀
  async rollbackCanary(canary: CanaryConfig): Promise<void> {
    console.log('Rolling back canary deployment...');

    // 记录回滚原因
    await this.recordRollbackEvent(canary, {
      reason: 'Health check failed',
      timestamp: new Date()
    });

    // 减少金丝雀权重
    await this.setCanaryWeight(canary, 0);

    // 等待流量清空
    await this.sleep(30000);

    // 删除金丝雀Deployment
    await this.deleteCanaryDeployment(canary);

    // 发送告警
    await this.alertManager.send({
      severity: 'warning',
      title: 'Canary Deployment Rolled Back',
      canary: canary.name
    });
  }
}
```

---

## 5. 特性开关系统

### 5.1 特性开关配置

```typescript
// feature-flags/config.ts
interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rollout: RolloutConfig;
  targeting: TargetingConfig;
  metadata: {
    owner: string;
    tier: 'critical' | 'high' | 'medium' | 'low';
    createdAt: Date;
    expectedCleanupDate?: Date;
  };
}

//  rollout 配置
interface RolloutConfig {
  type: 'boolean' | 'percentage' | 'gradual' | 'schedule';
  value?: boolean;
  percentage?: number;
  schedule?: {
    start: Date;
    end?: Date;
  };
  gradual?: {
    startDate: Date;
    endDate: Date;
    stages: { date: Date; percentage: number }[];
  };
}

//  targeting 配置
interface TargetingConfig {
  enabled: boolean;
  rules: TargetingRule[];
}

interface TargetingRule {
  name: string;
  conditions: Condition[];
  percentage?: number;
}

interface Condition {
  attribute: string;  // 'userId' | 'email' | 'country' | 'platform'
  operator: 'eq' | 'neq' | 'in' | 'notIn' | 'contains' | 'regex';
  value: string | string[];
}

// 预定义特性开关
const featureFlags: FeatureFlag[] = [
  {
    key: 'new-idea-generation-algorithm',
    name: 'New Idea Generation Algorithm',
    description: 'Use the improved idea generation algorithm with better diversity',
    enabled: false,
    rollout: {
      type: 'percentage',
      percentage: 0
    },
    targeting: {
      enabled: true,
      rules: [
        {
          name: 'Internal users',
          conditions: [
            { attribute: 'email', operator: 'contains', value: '@company.com' }
          ],
          percentage: 100
        }
      ]
    },
    metadata: {
      owner: 'platform-team',
      tier: 'high',
      createdAt: new Date('2026-04-01')
    }
  },

  {
    key: 'advanced-code-review',
    name: 'Advanced Code Review',
    description: 'Enable AI-powered code review with deeper analysis',
    enabled: true,
    rollout: {
      type: 'gradual',
      gradual: {
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-05-01'),
        stages: [
          { date: new Date('2026-04-01'), percentage: 10 },
          { date: new Date('2026-04-08'), percentage: 25 },
          { date: new Date('2026-04-15'), percentage: 50 },
          { date: new Date('2026-04-22'), percentage: 75 },
          { date: new Date('2026-04-29'), percentage: 100 }
        ]
      }
    },
    targeting: {
      enabled: false,
      rules: []
    },
    metadata: {
      owner: 'quality-team',
      tier: 'critical',
      createdAt: new Date('2026-03-15')
    }
  }
];
```

### 5.2 特性开关服务

```typescript
// services/feature-flag.service.ts
class FeatureFlagService {
  private flags: Map<string, FeatureFlag>;
  private cache: Cache;
  private analytics: AnalyticsClient;

  constructor() {
    this.flags = new Map();
    this.cache = new Map();
  }

  // 初始化
  async initialize(): Promise<void> {
    const flags = await this.loadFlagsFromStorage();
    for (const flag of flags) {
      this.flags.set(flag.key, flag);
    }
  }

  // 检查特性是否启用
  async isEnabled(
    key: string,
    context: EvaluationContext
  ): Promise<boolean> {
    const flag = this.flags.get(key);
    if (!flag) return false;

    // 检查缓存
    const cacheKey = `${key}:${context.userId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60000) {
      return cached.value;
    }

    // 计算启用状态
    const enabled = await this.evaluate(flag, context);

    // 更新缓存
    this.cache.set(cacheKey, { value: enabled, timestamp: Date.now() });

    // 记录分析事件
    await this.analytics.track('feature_flag_evaluated', {
      key,
      userId: context.userId,
      enabled
    });

    return enabled;
  }

  // 评估特性
  private async evaluate(
    flag: FeatureFlag,
    context: EvaluationContext
  ): Promise<boolean> {
    // 如果未启用
    if (!flag.enabled) return false;

    // 检查 rollout 类型
    switch (flag.rollout.type) {
      case 'boolean':
        return flag.rollout.value || false;

      case 'percentage':
        return this.isInPercentageRollout(context, flag.rollout.percentage || 0);

      case 'gradual':
        return this.evaluateGradualRollout(flag, context);

      case 'schedule':
        return this.evaluateScheduleRollout(flag);
    }

    // 检查 targeting
    if (flag.targeting.enabled) {
      return this.evaluateTargeting(flag, context);
    }

    return false;
  }

  // 百分比 rollout
  private isInPercentageRollout(
    context: EvaluationContext,
    percentage: number
  ): boolean {
    // 使用一致性哈希确保同一用户始终得到相同结果
    const hash = this.hash(`${context.userId}:${percentage}`);
    return hash % 100 < percentage;
  }

  // 渐进式 rollout
  private evaluateGradualRollout(
    flag: FeatureFlag,
    context: EvaluationContext
  ): boolean {
    const gradual = flag.rollout.gradual!;
    const now = new Date();

    // 找到当前阶段
    let currentPercentage = 0;
    for (const stage of gradual.stages) {
      if (stage.date <= now) {
        currentPercentage = stage.percentage;
      }
    }

    return this.isInPercentageRollout(context, currentPercentage);
  }

  // Targeting 规则
  private async evaluateTargeting(
    flag: FeatureFlag,
    context: EvaluationContext
  ): Promise<boolean> {
    for (const rule of flag.targeting.rules) {
      if (this.matchesRule(rule, context)) {
        return this.isInPercentageRollout(
          context,
          rule.percentage ?? 100
        );
      }
    }
    return false;
  }

  // 启用特性
  async enable(key: string, rollout?: Partial<RolloutConfig>): Promise<void> {
    const flag = this.flags.get(key);
    if (!flag) throw new Error(`Feature flag not found: ${key}`);

    flag.enabled = true;
    if (rollout) {
      flag.rollout = { ...flag.rollout, ...rollout };
    }

    await this.saveFlag(flag);
    await this.invalidateCache(key);

    // 记录变更
    await this.recordFlagChange(key, 'enabled', flag);
  }

  // 禁用特性
  async disable(key: string): Promise<void> {
    const flag = this.flags.get(key);
    if (!flag) throw new Error(`Feature flag not found: ${key}`);

    flag.enabled = false;

    await this.saveFlag(flag);
    await this.invalidateCache(key);

    await this.recordFlagChange(key, 'disabled', flag);
  }
}

// 评估上下文
interface EvaluationContext {
  userId: string;
  email?: string;
  country?: string;
  platform?: string;
  attributes?: Record<string, unknown>;
}
```

### 5.3 特性开关中间件

```typescript
// middleware/feature-flag.middleware.ts
function featureFlagMiddleware(
  flags: FeatureFlagService
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    // 构建评估上下文
    const context: EvaluationContext = {
      userId: req.user?.id || 'anonymous',
      email: req.user?.email,
      country: req.headers['cf-ipcountry'] as string,
      platform: req.headers['user-agent']
    };

    // 将启用的特性附加到请求
    const enabledFlags: Record<string, boolean> = {};

    // 评估所有请求相关的特性
    const requestFlags = ['new-idea-generation-algorithm', 'advanced-code-review'];

    for (const key of requestFlags) {
      enabledFlags[key] = await flags.isEnabled(key, context);
    }

    req.enabledFeatures = enabledFlags;

    next();
  };
}

// 使用示例
app.use(featureFlagMiddleware(featureFlagService));

app.get('/api/projects', async (req, res) => {
  if (req.enabledFeatures['new-idea-generation-algorithm']) {
    // 使用新算法
  } else {
    // 使用旧算法
  }
});
```

---

## 6. 回滚策略

### 6.1 自动回滚

```typescript
// rollback/auto-rollback.service.ts
class AutoRollbackService {
  private monitoring: MonitoringService;
  private deployment: DeploymentController;
  private notification: NotificationService;

  // 监控并触发回滚
  async monitorAndRollback(
    deploymentId: string,
    config: RollbackConfig
  ): Promise<void> {
    const { thresholds, checkInterval } = config;

    let consecutiveFailures = 0;

    while (true) {
      // 获取当前指标
      const metrics = await this.monitoring.getDeploymentMetrics(deploymentId);

      // 检查是否需要回滚
      const shouldRollback = this.evaluateRollbackCriteria(metrics, thresholds);

      if (shouldRollback) {
        consecutiveFailures++;

        if (consecutiveFailures >= thresholds.consecutiveFailures) {
          console.log(`Triggering automatic rollback for ${deploymentId}`);

          // 执行回滚
          await this.deployment.rollback(deploymentId);

          // 发送通知
          await this.notification.send({
            type: 'critical',
            title: 'Automatic Rollback Triggered',
            deploymentId,
            reason: this.getRollbackReason(metrics, thresholds)
          });

          return;
        }
      } else {
        consecutiveFailures = 0;
      }

      await this.sleep(checkInterval);
    }
  }

  // 评估回滚条件
  private evaluateRollbackCriteria(
    metrics: DeploymentMetrics,
    thresholds: RollbackThresholds
  ): boolean {
    // 检查错误率
    if (metrics.errorRate > thresholds.maxErrorRate) {
      return true;
    }

    // 检查延迟
    if (metrics.latency.p99 > thresholds.maxLatency) {
      return true;
    }

    // 检查成功率
    if (metrics.successRate < thresholds.minSuccessRate) {
      return true;
    }

    // 检查健康检查
    if (!metrics.healthy) {
      return true;
    }

    return false;
  }
}

// 回滚配置
interface RollbackConfig {
  thresholds: {
    maxErrorRate: number;
    maxLatency: number;
    minSuccessRate: number;
    consecutiveFailures: number;
  };
  checkInterval: number;
  automatic: boolean;
}
```

### 6.2 数据库回滚

```typescript
// rollback/database-rollback.service.ts
class DatabaseRollbackService {
  private db: DatabaseManager;
  private backup: BackupService;

  // 创建数据库回滚点
  async createRollbackPoint(
    deploymentId: string
  ): Promise<RollbackPoint> {
    const backup = await this.backup.createFullBackup({
      type: 'pre-deployment',
      deploymentId,
      description: `Pre-deployment backup for ${deploymentId}`
    });

    return {
      id: uuid(),
      deploymentId,
      backupId: backup.id,
      type: 'full',
      createdAt: new Date()
    };
  }

  // 执行数据库回滚
  async rollbackToPoint(
    rollbackPoint: RollbackPoint
  ): Promise<RollbackResult> {
    const backup = await this.backup.getBackup(rollbackPoint.backupId);

    if (!backup) {
      throw new Error(`Backup not found: ${rollbackPoint.backupId}`);
    }

    // 执行回滚
    await this.db.transaction(async (tx) => {
      // 恢复数据
      await this.restoreFromBackup(backup, tx);

      // 记录回滚
      await this.recordRollback(tx, rollbackPoint);
    });

    return {
      success: true,
      rollbackPointId: rollbackPoint.id,
      tablesAffected: backup.tables
    };
  }

  // 部分回滚
  async partialRollback(
    tables: string[],
    beforeTimestamp: Date
  ): Promise<void> {
    for (const table of tables) {
      await this.db.query(`
        INSERT INTO ${table}_backup
        SELECT * FROM ${table}
        WHERE updated_at > ?
      `, [beforeTimestamp.toISOString()]);

      await this.db.query(`
        DELETE FROM ${table}
        WHERE updated_at > ?
      `, [beforeTimestamp.toISOString()]);

      await this.db.query(`
        INSERT INTO ${table}
        SELECT * FROM ${table}_backup
      `);
    }
  }
}
```

---

## 7. 发布准备清单

### 7.1 发布检查清单

```typescript
// release/checklist.ts
interface ReleaseChecklist {
  deploymentId: string;
  version: string;
  checks: ChecklistItem[];
  completedAt?: Date;
  approvedBy?: string;
}

interface ChecklistItem {
  id: string;
  category: 'documentation' | 'testing' | 'security' | 'operations' | 'business';
  title: string;
  description: string;
  required: boolean;
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  checkedBy?: string;
  checkedAt?: Date;
}

// 发布检查清单
const releaseChecklistTemplate: Omit<ChecklistItem, 'id' | 'status'>[] = [
  // 文档
  { category: 'documentation', title: '更新 API 文档', description: '确保 API 变更已记录', required: true },
  { category: 'documentation', title: '更新部署文档', description: '更新部署和配置说明', required: true },
  { category: 'documentation', title: '发布说明', description: '编写版本发布说明', required: true },

  // 测试
  { category: 'testing', title: '单元测试通过', description: '所有单元测试必须通过', required: true },
  { category: 'testing', title: '集成测试通过', description: '所有集成测试必须通过', required: true },
  { category: 'testing', title: 'E2E 测试通过', description: '端到端测试必须通过', required: true },
  { category: 'testing', title: '性能测试达标', description: '性能指标必须在阈值内', required: true },
  { category: 'testing', title: '安全扫描通过', description: '无高危安全漏洞', required: true },

  // 安全
  { category: 'security', title: '代码审查完成', description: '所有代码变更已审查', required: true },
  { category: 'security', title: '依赖审计通过', description: '无已知漏洞依赖', required: true },
  { category: 'security', title: '密钥轮换', description: '必要时轮换密钥', required: false },

  // 运维
  { category: 'operations', title: '监控告警配置', description: '新版本指标已配置', required: true },
  { category: 'operations', title: '回滚计划', description: '回滚方案已准备', required: true },
  { category: 'operations', title: '数据库迁移', description: '迁移脚本已测试', required: false },
  { category: 'operations', title: '容量规划', description: '确认有足够容量', required: true },

  // 业务
  { category: 'business', title: '利益相关者通知', description: '通知相关团队', required: true },
  { category: 'business', title: '支持文档更新', description: '支持文档已更新', required: false }
];

// 检查清单服务
class ReleaseChecklistService {
  // 生成检查清单
  async generateChecklist(
    deploymentId: string,
    version: string
  ): Promise<ReleaseChecklist> {
    return {
      deploymentId,
      version,
      checks: releaseChecklistTemplate.map((item, index) => ({
        ...item,
        id: `check-${index + 1}`,
        status: 'pending'
      }))
    };
  }

  // 执行检查
  async executeCheck(
    checklistId: string,
    checkId: string,
    result: CheckResult
  ): Promise<void> {
    const checklist = await this.getChecklist(checklistId);
    const check = checklist.checks.find(c => c.id === checkId);

    if (!check) throw new Error(`Check not found: ${checkId}`);

    check.status = result.passed ? 'passed' : 'failed';
    check.checkedBy = result.checkedBy;
    check.checkedAt = new Date();

    await this.saveChecklist(checklist);

    // 如果失败的是必需项，阻止发布
    if (!result.passed && check.required) {
      await this.blockRelease(checklistId, `Required check failed: ${check.title}`);
    }
  }

  // 验证清单
  async validateChecklist(checklistId: string): Promise<ValidationResult> {
    const checklist = await this.getChecklist(checklistId);

    const failed = checklist.checks.filter(
      c => c.status === 'failed' && c.required
    );

    const pending = checklist.checks.filter(
      c => c.status === 'pending'
    );

    return {
      valid: failed.length === 0 && pending.length === 0,
      failedRequired: failed.map(c => c.title),
      pendingChecks: pending.length
    };
  }
}
```

### 7.2 发布审批

```typescript
// release/approval.service.ts
class ReleaseApprovalService {
  private workflow: WorkflowEngine;
  private checklist: ReleaseChecklistService;

  // 创建发布审批流程
  async createApprovalWorkflow(
    release: Release
  ): Promise<ApprovalWorkflow> {
    // 生成检查清单
    const checklist = await this.checklist.generateChecklist(
      release.id,
      release.version
    );

    // 确定审批人
    const approvers = await this.determineApprovers(release);

    // 创建工作流
    const workflow = await this.workflow.create({
      name: `Release Approval: ${release.version}`,
      steps: [
        {
          id: 'checklist',
          type: 'checklist',
          config: { checklistId: checklist.id },
          approvers: []
        },
        {
          id: 'security-review',
          type: 'approval',
          approvers: ['security-team']
        },
        {
          id: 'ops-review',
          type: 'approval',
          approvers: ['ops-team']
        },
        {
          id: 'final-approval',
          type: 'approval',
          approvers: ['release-manager']
        }
      ]
    });

    return {
      id: workflow.id,
      release,
      checklist,
      currentStep: 'checklist',
      status: 'in-progress',
      createdAt: new Date()
    };
  }

  // 审批发布
  async approve(
    workflowId: string,
    approver: string,
    decision: 'approved' | 'rejected',
    comments?: string
  ): Promise<void> {
    const workflow = await this.workflow.get(workflowId);

    if (!workflow.canApprove(approver)) {
      throw new Error(`User ${approver} cannot approve this workflow`);
    }

    if (decision === 'rejected') {
      await this.workflow.reject(workflowId, approver, comments);
      return;
    }

    // 记录审批
    await this.workflow.approve(workflowId, approver, comments);

    // 检查是否所有审批都通过
    if (workflow.isApproved()) {
      await this.workflow.complete(workflowId);
      await this.initiateDeployment(workflow.release);
    }
  }
}
```

---

## 8. 相关文档

- [CI/CD 流水线设计](./CI_CD_PIPELINE.md)
- [部署架构设计](./DEPLOYMENT_ARCHITECTURE.md)
- [A/B 测试与灰度发布](./AB_TESTING_FEATURE_FLAGS.md)
- [容错与降级设计](./FAULT_TOLERANCE.md)

---

**最后更新**: 2026-04-14
