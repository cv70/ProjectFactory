# DevOps与自动化运维

## 概述

DevOps与自动化运维系统（DevOps & Automated Operations）是确保ProjectFactory系统持续交付和稳定运行的关键基础设施。系统涵盖从代码提交到生产部署的完整CI/CD流水线，以及自动化运维能力包括配置管理、部署自动化、扩缩容和故障恢复。

## 核心价值

- **持续交付**：自动化构建、测试和部署流程
- **基础设施即代码**：所有环境配置版本化管理
- **零停机部署**：支持滚动更新和蓝绿部署
- **自愈能力**：自动检测和恢复故障
- **多环境管理**：开发、测试、预生产、生产环境一致性

## CI/CD流水线

### 流水线架构

```
┌─────────────────────────────────────────────────────────────────┐
│                       CI/CD流水线                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    │
│  │  Commit │───▶│ Build   │───▶│  Test   │───▶│ Deploy  │    │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    │
│                                                                  │
│  Pipeline Stages:                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 1. Source (Git Push)                                      │ │
│  │ 2. Build (Compile + Bundle)                                │ │
│  │ 3. Unit Tests                                              │ │
│  │ 4. Integration Tests                                       │ │
│  │ 5. Security Scan                                           │ │
│  │ 6. E2E Tests                                               │ │
│  │ 7. Build Image                                             │ │
│  │ 8. Push to Registry                                        │ │
│  │ 9. Deploy to Staging                                       │ │
│  │ 10. Smoke Tests                                            │ │
│  │ 11. Deploy to Production (Canary/Rolling)                   │ │
│  │ 12. Monitor & Verify                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 流水线配置

```typescript
// 流水线配置
interface PipelineConfig {
  name: string;
  trigger: PipelineTrigger;
  stages: PipelineStage[];
  environment?: Record<string, string>;
  resources?: ResourceLimits;
}

interface PipelineTrigger {
  type: 'push' | 'pull_request' | 'schedule' | 'manual' | 'webhook';
  branches?: {
    include: string[];
    exclude?: string[];
  };
  paths?: {
    include?: string[];
    exclude?: string[];
  };
  cron?: string;
}

interface PipelineStage {
  name: string;
  steps: PipelineStep[];
  dependsOn?: string[];
  condition?: string;
  timeout?: string;
  parallel?: boolean;
}

interface PipelineStep {
  name: string;
  uses?: string;              // 预定义Action
  run?: string;              // 自定义命令
  with?: Record<string, any>; // Action参数
  env?: Record<string, string>;
  continueOnError?: boolean;
}

// 流水线定义
const PIPELINE_DEFINITIONS = {
  // 主流水线
  main: {
    name: 'projectfactory-main',
    trigger: {
      type: 'push',
      branches: {
        include: ['main', 'develop', 'release/**'],
      },
    },
    stages: [
      {
        name: 'build',
        steps: [
          { name: 'Checkout', uses: 'actions/checkout@v4' },
          { name: 'Setup Node', uses: 'actions/setup-node@v4', with: { node-version: '20' } },
          { name: 'Install', run: 'npm ci' },
          { name: 'Build', run: 'npm run build' },
          { name: 'Unit Tests', run: 'npm run test:unit' },
          { name: 'Lint', run: 'npm run lint' },
        ],
      },
      {
        name: 'test',
        dependsOn: ['build'],
        steps: [
          { name: 'Integration Tests', run: 'npm run test:integration' },
          { name: 'E2E Tests', uses: './.github/actions/run-e2e' },
        ],
      },
      {
        name: 'security',
        dependsOn: ['test'],
        steps: [
          { name: 'SAST', uses: 'aquasecurity/trivy-action@latest' },
          { name: 'Dependency Scan', run: 'npm audit --audit-level=high' },
          { name: 'Container Scan', uses: 'aquasecurity/trivy-action@latest', with: { scanner: 'container' } },
        ],
      },
      {
        name: 'deploy-staging',
        dependsOn: ['security'],
        condition: "branch == 'develop' || branch == 'main'",
        steps: [
          { name: 'Build Image', run: 'docker build -t $IMAGE_NAME:$GIT_SHA .' },
          { name: 'Push Image', run: 'docker push $IMAGE_NAME:$GIT_SHA' },
          { name: 'Deploy Staging', uses: 'k8s-deploy@latest', with: { namespace: 'staging' } },
        ],
      },
      {
        name: 'deploy-production',
        dependsOn: ['deploy-staging'],
        condition: "branch == 'main'",
        steps: [
          { name: 'Deploy Production', uses: 'k8s-deploy@latest', with: { namespace: 'production', strategy: 'canary' } },
          { name: 'Smoke Tests', run: 'npm run test:smoke' },
          { name: 'Notify', run: 'curl -X POST $SLACK_WEBHOOK' },
        ],
      },
    ],
  },
};
```

## 部署策略

### 部署类型

```typescript
// 部署策略
enum DeploymentStrategy {
  // 滚动更新
  ROLLING = 'rolling',

  // 蓝绿部署
  BLUE_GREEN = 'blue_green',

  // 金丝雀发布
  CANARY = 'canary',

  // 特性开关
  FEATURE_FLAG = 'feature_flag',
}

// 滚动更新配置
interface RollingUpdateConfig {
  strategy: DeploymentStrategy.ROLLING;
  config: {
    maxSurge: number | string;      // 最大超出副本数
    maxUnavailable: number | string; // 最大不可用副本数
    minReadySeconds: number;        // 最小就绪时间
    progressDeadlineSeconds: number; // 超时时间
  };
}

// 蓝绿部署配置
interface BlueGreenConfig {
  strategy: DeploymentStrategy.BLUE_GREEN;
  config: {
    activeColor: 'blue' | 'green';
    previewDuration: string;        // 预热时间
    autoPromotion: boolean;         // 自动提升
    rollbackOnFailure: boolean;      // 失败自动回滚
  };
}

// 金丝雀配置
interface CanaryConfig {
  strategy: DeploymentStrategy.CANARY;
  config: {
    // 流量分配
    trafficSplit: {
      canary: number;              // 金丝雀流量百分比
      stable: number;               // 稳定版本流量
    };
    // 渐进式权重
    steps?: {
      weight: number;
      duration: string;
    }[];
    // 自动调整
    autoPause?: {
      enabled: boolean;
      pauseDuration: string;
    };
    // 指标阈值
    metricsThresholds?: {
      errorRate?: number;
      latencyP99?: number;
    };
  };
}

// 部署执行器
class DeploymentExecutor {
  async execute(
    deployment: Deployment,
    strategy: DeploymentStrategy,
    config: RollingUpdateConfig | BlueGreenConfig | CanaryConfig
  ): Promise<DeploymentResult> {
    switch (strategy) {
      case DeploymentStrategy.ROLLING:
        return this.rollingUpdate(deployment, config as RollingUpdateConfig);
      case DeploymentStrategy.BLUE_GREEN:
        return this.blueGreenUpdate(deployment, config as BlueGreenConfig);
      case DeploymentStrategy.CANARY:
        return this.canaryUpdate(deployment, config as CanaryConfig);
    }
  }

  // 滚动更新
  private async rollingUpdate(
    deployment: Deployment,
    config: RollingUpdateConfig
  ): Promise<DeploymentResult> {
    const replicas = deployment.spec.replicas;
    const maxSurge = this.parseValue(config.config.maxSurge, replicas);
    const maxUnavailable = this.parseValue(config.config.maxUnavailable, replicas);

    // 分批更新
    const batchSize = Math.min(maxSurge, replicas);
    let updated = 0;

    while (updated < replicas) {
      const batch = Math.min(batchSize, replicas - updated);

      // 更新一批
      await this.updatePods(deployment, updated, updated + batch);

      // 等待就绪
      await this.waitForReady(deployment, config.config.minReadySeconds);

      updated += batch;
    }

    return { success: true, updatedReplicas: replicas };
  }

  // 金丝雀更新
  private async canaryUpdate(
    deployment: Deployment,
    config: CanaryConfig
  ): Promise<DeploymentResult> {
    // 1. 部署金丝雀版本（1个副本）
    await this.deployCanary(deployment, 1);

    // 2. 初始流量分配
    await this.setTrafficSplit(config.config.trafficSplit);

    // 3. 渐进式增加流量
    if (config.config.steps) {
      for (const step of config.config.steps) {
        await this.delay(this.parseDuration(step.duration));
        await this.setCanaryWeight(step.weight);
        await this.verifyMetrics(config.config.metricsThresholds);
      }
    }

    // 4. 完成部署
    await this.promoteCanary();

    return { success: true };
  }
}
```

## 环境管理

### 环境配置

```typescript
// 环境定义
interface Environment {
  name: string;
  type: 'development' | 'staging' | 'production';
  cluster?: string;
  region?: string;

  // 配置
  config: {
    replicas: number;
    resources: ResourceLimits;
    autoscaling?: AutoscalingConfig;
    env: Record<string, EnvVar>;
    secrets: SecretRef[];
  };

  // 域名
  ingress?: {
    host: string;
    path: string;
    tls: boolean;
  };

  // 数据库配置
  database?: {
    type: 'shared' | 'dedicated';
    tier: string;
    backup?: BackupConfig;
  };

  // 监控
  monitoring?: {
    enabled: boolean;
    alerting: boolean;
    dashboards: string[];
  };
}

// 环境定义
const ENVIRONMENTS: Record<string, Environment> = {
  development: {
    name: 'Development',
    type: 'development',
    config: {
      replicas: 1,
      resources: {
        requests: { cpu: '100m', memory: '256Mi' },
        limits: { cpu: '500m', memory: '1Gi' },
      },
      autoscaling: {
        enabled: false,
      },
    },
    monitoring: {
      enabled: false,
      alerting: false,
    },
  },

  staging: {
    name: 'Staging',
    type: 'staging',
    cluster: 'staging-us-east-1',
    config: {
      replicas: 2,
      resources: {
        requests: { cpu: '500m', memory: '1Gi' },
        limits: { cpu: '2000m', memory: '4Gi' },
      },
      autoscaling: {
        enabled: true,
        minReplicas: 2,
        maxReplicas: 10,
        targetCPUUtilization: 70,
      },
    },
    ingress: {
      host: 'staging.projectfactory.ai',
      path: '/',
      tls: true,
    },
    database: {
      type: 'shared',
      tier: 'db.t3.medium',
      backup: { enabled: true, retention: '7d' },
    },
    monitoring: {
      enabled: true,
      alerting: true,
      dashboards: ['staging-overview'],
    },
  },

  production: {
    name: 'Production',
    type: 'production',
    cluster: 'prod-us-east-1',
    config: {
      replicas: 5,
      resources: {
        requests: { cpu: '1000m', memory: '2Gi' },
        limits: { cpu: '4000m', memory: '8Gi' },
      },
      autoscaling: {
        enabled: true,
        minReplicas: 5,
        maxReplicas: 50,
        targetCPUUtilization: 60,
        targetMemoryUtilization: 70,
      },
    },
    ingress: {
      host: 'projectfactory.ai',
      path: '/',
      tls: true,
    },
    database: {
      type: 'dedicated',
      tier: 'db.r6g.large',
      backup: { enabled: true, retention: '30d' },
    },
    monitoring: {
      enabled: true,
      alerting: true,
      dashboards: ['production-overview', 'business-metrics', 'cost-analysis'],
    },
  },
};
```

## 自动化运维

### 自动扩缩容

```typescript
// 自动扩缩容配置
interface AutoscalingConfig {
  enabled: boolean;
  minReplicas: number;
  maxReplicas: number;

  // CPU基扩缩容
  targetCPUUtilization?: number;

  // 内存基扩缩容
  targetMemoryUtilization?: number;

  // 自定义指标
  customMetrics?: CustomMetric[];

  // 预测性扩缩容
  predictive?: {
    enabled: boolean;
    minReplicas: number;
    maxReplicas: number;
  };
}

interface CustomMetric {
  name: string;
  type: 'pods' | 'external' | 'object';
  metric: {
    name: string;
    selector?: LabelSelector;
  };
  target: {
    type: 'AverageValue' | 'Value' | 'Utilization';
    averageValue?: number;
    value?: number;
    utilization?: number;
  };
}

// 水平Pod自动扩缩容器
class HorizontalPodAutoscaler {
  async reconcile(hpa: HorizontalPodAutoscalerObject): Promise<void> {
    // 1. 获取当前副本数
    const currentReplicas = await this.getCurrentReplicas(hpa.scaleTargetRef);

    // 2. 获取指标值
    const metrics = await this.collectMetrics(hpa);

    // 3. 计算期望副本数
    const desiredReplicas = this.calculateDesiredReplicas(hpa, metrics, currentReplicas);

    // 4. 应用约束
    const clampedReplicas = this.clampReplicas(
      desiredReplicas,
      hpa.minReplicas,
      hpa.maxReplicas
    );

    // 5. 执行扩缩容
    if (clampedReplicas !== currentReplicas) {
      await this.scale(hpa.scaleTargetRef, clampedReplicas);
    }
  }

  private calculateDesiredReplicas(
    hpa: HorizontalPodAutoscalerObject,
    metrics: CollectedMetrics,
    currentReplicas: number
  ): number {
    // 计算总需求
    let totalDemand = 0;

    for (const metric of metrics) {
      const demand = this.calculateMetricDemand(metric, hpa);
      totalDemand += demand;
    }

    // 计算期望副本数
    const desiredReplicas = Math.ceil(totalDemand / hpa.targetCPUUtilization);

    return desiredReplicas;
  }
}
```

### 故障恢复

```typescript
// 自愈配置
interface SelfHealingConfig {
  enabled: boolean;

  // 健康检查
  healthCheck: {
    enabled: boolean;
    path: string;
    interval: string;
    timeout: string;
    failureThreshold: number;
    successThreshold: number;
  };

  // 自动重启
  autoRestart: {
    enabled: boolean;
    maxRestarts: number;
    window: string;
  };

  // 故障检测
  faultDetection: {
    // 进程崩溃
    processCrash: {
      enabled: boolean;
      action: 'restart' | 'page';
    };

    // OOM检测
    oomKill: {
      enabled: boolean;
      action: 'restart' | 'increase_memory';
    };

    // 性能降级
    performanceDegradation: {
      enabled: boolean;
      latencyThreshold: number;
      errorRateThreshold: number;
      action: 'alert' | 'restart';
    };
  };
}

// 自愈执行器
class SelfHealingExecutor {
  async executeAction(action: SelfHealingAction): Promise<void> {
    switch (action.type) {
      case 'restart':
        await this.restartPods(action.target);
        break;

      case 'increase_memory':
        await this.increaseResources(action.target, { memory: '2x' });
        break;

      case 'scale_out':
        await this.scaleOut(action.target, action.replicas);
        break;

      case 'page':
        await this.sendPage(action.target, action.message);
        break;

      case 'runbook':
        await this.executeRunbook(action.runbook);
        break;
    }
  }

  // 故障检测和自愈循环
  async runHealingLoop(): Promise<void> {
    const deployments = await this.getMonitoredDeployments();

    for (const deployment of deployments) {
      const health = await this.checkHealth(deployment);
      const metrics = await this.getMetrics(deployment);

      // 检测故障
      const faults = this.detectFaults(deployment, health, metrics);

      // 执行自愈
      for (const fault of faults) {
        const action = this.determineAction(fault);
        await this.executeAction(action);
      }
    }
  }
}
```

## 基础设施即代码

### Terraform配置

```typescript
// Terraform配置示例
const TERRAFORM_CONFIG = `
# main.tf
terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
  backend "s3" {
    bucket = "projectfactory-terraform-state"
    key    = "production/main.tfstate"
    region = "us-east-1"
  }
}

# EKS集群
resource "aws_eks_cluster" "main" {
  name     = "projectfactory-prod"
  role_arn = aws_iam_role.eks_cluster.arn
  version  = "1.27"

  vpc_config {
    subnet_ids = var.subnet_ids
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy,
  ]
}

# Node Group
resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "prod-nodes"
  node_role_arn   = aws_iam_role.nodes.arn
  subnet_ids      = var.subnet_ids
  instance_types  = ["t3.medium"]

  scaling_config {
    desired_size = 3
    max_size     = 10
    min_size     = 2
  }
}

# RDS数据库
resource "aws_db_instance" "main" {
  identifier     = "projectfactory-db"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.r6g.large"

  allocated_storage     = 100
  max_allocated_storage  = 500
  storage_encrypted      = true

  db_name  = "projectfactory"
  username = var.db_username
  password = var.db_password

  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window      = "mon:04:00-mon:05:00"

  multi_az               = true
  deletion_protection    = true
}

# ElastiCache
resource "aws_elasticache_cluster" "main" {
  cluster_id           = "projectfactory-cache"
  engine               = "redis"
  engine_version       = "7.0"
  node_type            = "cache.r6g.large"
  num_cache_nodes      = 2
  parameter_group_name = "default.redis7"
  port                 = 6379

  automatic_failover_enabled = true
  multi_az_enabled          = true
}
`;
```

## GitOps工作流

### ArgoCD配置

```typescript
// ArgoCD Application配置
const ARGOCD_APPLICATION = `
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: projectfactory-production
  namespace: argocd
spec:
  project: default
  source:
    repoURL: git@github.com:projectfactory/manifests.git
    targetRevision: HEAD
    path: production
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
      - PruneLast=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas
  revisionHistoryLimit: 10
`;

// 应用健康状态
const HEALTH_CHECKS = {
  deployment: {
    apiVersion: "apps/v1",
    kind: "Deployment",
    check: |
      # 检查副本数是否匹配
      deployment.spec.replicas == status.readyReplicas &&
      status.availableReplicas >= deployment.spec.replicas * 0.8
  },

  statefulset: {
    apiVersion: "apps/v1",
    kind: "StatefulSet",
    check: |
      status.readyReplicas == status.replicas
  },

  pod: {
    apiVersion: "v1",
    kind: "Pod",
    check: |
      status.phase == "Running" &&
      allContainersReady(status) &&
      !hasRestarts(status)
  },
};
```

## 配置示例

```yaml
# DevOps配置
devops:
  # CI/CD
  cicd:
    provider: "github-actions"  # github-actions | gitlab-ci | jenkins
    default_branch: "main"
    protected_branches: ["main", "release/**"]

  # 容器注册表
  registry:
    provider: "ecr"  # ecr | gcr | dockerhub
    url: "123456789.dkr.ecr.us-east-1.amazonaws.com"
    path: "projectfactory"

  # Kubernetes
  kubernetes:
    production:
      cluster: "prod-us-east-1"
      namespace: "production"
      context: "prod"
    staging:
      cluster: "staging-us-east-1"
      namespace: "staging"
      context: "staging"

  # 部署策略
  deployment:
    strategy: "canary"  # rolling | blue_green | canary
    canary:
      initial_weight: 5
      steps:
        - weight: 20
          duration: "10m"
        - weight: 50
          duration: "20m"
        - weight: 100
          duration: "30m"

  # 自动扩缩容
  autoscaling:
    enabled: true
    min_replicas: 2
    max_replicas: 50
    target_cpu_utilization: 70
    target_memory_utilization: 80

  # 自愈
  self_healing:
    enabled: true
    health_check:
      path: "/health"
      interval: "10s"
      timeout: "5s"
      failure_threshold: 3
    auto_restart:
      enabled: true
      max_restarts_per_hour: 5

  # 监控和告警
  monitoring:
    provider: "prometheus"
    alerting:
      enabled: true
      channels:
        - type: "slack"
          url: "${SLACK_WEBHOOK}"
        - type: "pagerduty"
          key: "${PAGERDUTY_KEY}"
```

---

**最后更新**: 2026-04-14
