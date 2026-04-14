# 容量规划指南

## 1. 概述

本文档描述 ProjectFactory 系统的容量规划策略，确保系统在不同负载下稳定运行，并优化成本效益。

### 1.1 容量规划框架

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          容量规划框架                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │    需求预测      │ ──▶ │    容量建模      │ ──▶ │    成本估算      │         │
│  │  Demand Forecast │    │ Capacity Model  │    │  Cost Estimate  │         │
│  │                 │    │                 │    │                 │         │
│  │ • 用户增长       │    │ • 资源需求      │    │ • 基础设施成本   │         │
│  │ • 使用模式      │    │ • 性能基准      │    │ • 许可证成本     │         │
│  │ • 季节性波动    │    │ • 扩展策略      │    │ • 运营成本       │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│           │                    │                    │                     │
│           ▼                    ▼                    ▼                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         容量优化循环                                  │   │
│  │  监控 ──▶ 分析 ──▶ 规划 ──▶ 实施 ──▶ 验证                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 资源模型

### 2.1 计算资源需求

```typescript
// capacity/compute-calculator.ts
interface WorkloadProfile {
  name: string;
  users: {
    concurrent: number;
    peakPerHour: number;
    avgSessionDuration: number; // 秒
  };
  operations: {
    apiRequestsPerSession: number;
    llmCallsPerProject: number;
    filesGeneratedPerProject: number;
  };
}

interface ResourceRequirements {
  cpu: {
    cores: number;
    reserved: number;
    burstable: number;
  };
  memory: {
    sizeGB: number;
    swapGB: number;
  };
  storage: {
    capacityGB: number;
    iops: number;
    throughputMBps: number;
  };
  network: {
    bandwidthMbps: number;
    connections: number;
  };
}

class ComputeCalculator {
  calculate(profile: WorkloadProfile): ResourceRequirements {
    const { users, operations } = profile;

    // API 层需求
    const apiCores = Math.ceil(
      (users.concurrent * 0.1) / 100 + // 100 并发需要 0.1 核
      (users.peakPerHour * 0.01) / 3600 // 每小时峰值需求
    );

    // LLM 调用需求 (计算密集型)
    const llmCores = Math.ceil(
      (operations.llmCallsPerProject * users.peakPerHour) /
        (3600 / operations.avgSessionDuration) *
        2 // 每个 LLM 调用需要约 2 核
    );

    // 文件处理需求
    const fileCores = Math.ceil(
      (operations.filesGeneratedPerProject * users.peakPerHour) /
        (3600 / operations.avgSessionDuration) *
        0.5
    );

    const totalCores = apiCores + llmCores + fileCores;

    return {
      cpu: {
        cores: totalCores,
        reserved: Math.ceil(totalCores * 0.7),
        burstable: Math.ceil(totalCores * 1.5),
      },
      memory: {
        sizeGB: Math.ceil(totalCores * 1.5), // 每核约 1.5GB
        swapGB: Math.ceil(totalCores * 0.5),
      },
      storage: {
        capacityGB: this.calculateStorage(users),
        iops: this.calculateIOPS(users),
        throughputMBps: this.calculateThroughput(users),
      },
      network: {
        bandwidthMbps: this.calculateBandwidth(users),
        connections: users.concurrent * 2,
      },
    };
  }

  private calculateStorage(users: WorkloadProfile['users']): number {
    // 每个项目约 10MB，活跃项目 1000 个
    const activeProjects = 1000;
    const perProjectMB = 10;
    const knowledgeBaseGB = 50;
    const logsGB = 20;
    const backupsGB = 100;

    return (
      (activeProjects * perProjectMB) / 1024 +
      knowledgeBaseGB +
      logsGB +
      backupsGB
    );
  }

  private calculateIOPS(users: WorkloadProfile['users']): number {
    // 基础 IOPS + 用户 IOPS
    return 100 + users.concurrent * 10;
  }

  private calculateThroughput(users: WorkloadProfile['users']): number {
    // MB/s
    return 10 + users.concurrent * 0.5;
  }

  private calculateBandwidth(users: WorkloadProfile['users']): number {
    // Mbps
    return 50 + users.concurrent * 0.1;
  }
}
```

### 2.2 数据库容量规划

```typescript
// capacity/database-capacity.ts
interface TableGrowthModel {
  tableName: string;
  rowsPerProject: number;
  avgRowSizeBytes: number;
  retentionDays: number;
  growthRatePerDay: number; // 百分比
}

interface DatabaseCapacity {
  totalSizeGB: number;
  indexSizeGB: number;
  tempSizeGB: number;
  recommendedPoolSize: number;
  recommendedConnectionLimit: number;
}

class DatabaseCapacityPlanner {
  private tableModels: TableGrowthModel[] = [
    {
      tableName: 'ideas',
      rowsPerProject: 1,
      avgRowSizeBytes: 2048,
      retentionDays: 365,
      growthRatePerDay: 0.01,
    },
    {
      tableName: 'projects',
      rowsPerProject: 5,
      avgRowSizeBytes: 4096,
      retentionDays: 730,
      growthRatePerDay: 0.005,
    },
    {
      tableName: 'iterations',
      rowsPerProject: 10,
      avgRowSizeBytes: 8192,
      retentionDays: 180,
      growthRatePerDay: 0.02,
    },
    {
      tableName: 'quality_metrics',
      rowsPerProject: 50,
      avgRowSizeBytes: 512,
      retentionDays: 90,
      growthRatePerDay: 0.05,
    },
    {
      tableName: 'audit_logs',
      rowsPerProject: 100,
      avgRowSizeBytes: 256,
      retentionDays: 30,
      growthRatePerDay: 0.1,
    },
  ];

  calculateCapacity(projectsPerDay: number): DatabaseCapacity {
    const tableSizes = this.tableModels.map(model => {
      const totalRows = model.rowsPerProject * projectsPerDay * model.retentionDays;
      const dataSize = (totalRows * model.avgRowSizeBytes) / (1024 * 1024 * 1024);
      const indexSize = dataSize * 0.3; // 索引约为数据的 30%

      return {
        tableName: model.tableName,
        dataSizeGB: dataSize,
        indexSizeGB: indexSize,
      };
    });

    const totalDataSize = tableSizes.reduce((sum, t) => sum + t.dataSizeGB, 0);
    const totalIndexSize = tableSizes.reduce((sum, t) => sum + t.indexSizeGB, 0);
    const tempSize = totalDataSize * 0.1; // 临时空间 10%

    // 连接池大小计算
    const recommendedPoolSize = Math.min(
      Math.ceil(projectsPerDay / 100), // 每 100 项目需要一个连接
      50 // 最大 50
    );

    return {
      totalSizeGB: Math.ceil(totalDataSize + totalIndexSize + tempSize),
      indexSizeGB: Math.ceil(totalIndexSize),
      tempSizeGB: Math.ceil(tempSize),
      recommendedPoolSize,
      recommendedConnectionLimit: recommendedPoolSize * 2,
    };
  }

  // SQLite 特定优化
  optimizeSQLiteConfig(capacity: DatabaseCapacity): string {
    return `
-- SQLite 配置优化
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -${capacity.totalSizeGB * 1024}; -- 缓存大小
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = ${capacity.totalSizeGB * 1024 * 1024}; -- 内存映射

-- 定期维护
PRAGMA incremental_vacuum;
ANALYZE;
`;
  }
}
```

---

## 3. 扩展策略

### 3.1 自动扩展配置

```yaml
# k8s/hpa/backend-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 2
  maxReplicas: 20
  metrics:
    # CPU 指标
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70

    # 内存指标
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80

    # 自定义指标 - 队列深度
    - type: Pods
      pods:
        metric:
          name: job_queue_depth
        target:
          type: AverageValue
          averageValue: "100"

  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
        - type: Pods
          value: 4
          periodSeconds: 15
      selectPolicy: Max
```

### 3.2 扩展预测

```typescript
// capacity/scaling-predictor.ts
interface MetricTimeSeries {
  timestamp: number;
  value: number;
}

interface ScalingPrediction {
  recommendedReplicas: number;
  confidence: number;
  predictedTimeToScale: number;
  cooldownRecommendation: number;
}

class ScalingPredictor {
  private history: MetricTimeSeries[] = [];
  private readonly lookbackHours = 24;
  private readonly predictionHorizon = 60; // 分钟

  // 添加指标数据点
  addDataPoint(timestamp: number, value: number): void {
    this.history.push({ timestamp, value });

    // 保持历史数据
    const cutoff = Date.now() - this.lookbackHours * 60 * 60 * 1000;
    this.history = this.history.filter(h => h.timestamp > cutoff);
  }

  // 预测未来扩展需求
  predict(): ScalingPrediction {
    const currentReplicas = this.getCurrentReplicas();
    const utilization = this.calculateCurrentUtilization();
    const trend = this.calculateTrend();
    const seasonal = this.calculateSeasonalPattern();

    // 综合预测
    const predictedUtilization = utilization + trend + seasonal;

    // 推荐副本数
    const recommendedReplicas = this.calculateReplicasForUtilization(predictedUtilization);

    // 置信度
    const confidence = this.calculateConfidence();

    // 距离下次扩展的时间
    const predictedTimeToScale = this.calculateTimeToScale(
      recommendedReplicas,
      currentReplicas
    );

    // 冷却时间建议
    const cooldownRecommendation = this.calculateCooldown(recommendedReplicas);

    return {
      recommendedReplicas,
      confidence,
      predictedTimeToScale,
      cooldownRecommendation,
    };
  }

  private calculateTrend(): number {
    if (this.history.length < 10) return 0;

    // 线性回归
    const n = this.history.length;
    const xSum = this.history.reduce((sum, h, i) => sum + i, 0);
    const ySum = this.history.reduce((sum, h) => sum + h.value, 0);
    const xySum = this.history.reduce((sum, h, i) => sum + i * h.value, 0);
    const xxSum = this.history.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * xySum - xSum * ySum) / (n * xxSum - xSum * xSum);

    // 将斜率转换为利用率变化
    return slope * 10; // 放大因子
  }

  private calculateSeasonalPattern(): number {
    // 简化的季节性计算
    const hour = new Date().getHours();

    // 假设高峰期在 10-12 点和 14-17 点
    if (hour >= 10 && hour <= 12) return 10;
    if (hour >= 14 && hour <= 17) return 15;
    if (hour >= 18 && hour <= 22) return 5;

    return 0;
  }

  private calculateReplicasForUtilization(utilization: number): number {
    const baseReplicas = this.getCurrentReplicas();

    if (utilization > 80) {
      return Math.min(Math.ceil(baseReplicas * 1.5), 20);
    }
    if (utilization > 70) {
      return Math.min(baseReplicas + 1, 20);
    }
    if (utilization < 30) {
      return Math.max(baseReplicas - 1, 2);
    }

    return baseReplicas;
  }
}
```

---

## 4. 成本估算

### 4.1 成本模型

```typescript
// capacity/cost-estimator.ts
interface CostEstimate {
  period: 'monthly' | 'yearly';
  currency: string;
  breakdown: CostBreakdown;
  total: number;
  byService: Record<string, number>;
  recommendations: CostOptimization[];
}

interface CostBreakdown {
  compute: {
    cost: number;
    vcpuHours: number;
    memoryGBHours: number;
  };
  storage: {
    cost: number;
    storageGBMonths: number;
    iops: number;
  };
  network: {
    cost: number;
    bandwidthGB: number;
  };
  llm: {
    cost: number;
    inputTokens: number;
    outputTokens: number;
  };
  thirdParty: {
    cost: number;
    services: Record<string, number>;
  };
}

class CostEstimator {
  private pricing = {
    compute: {
      vcpuPerHour: 0.048,      // $0.048/vCPU/hour
      gbMemoryPerHour: 0.0061, // $0.0061/GB/hour
    },
    storage: {
      ssdGBPerMonth: 0.12,
      hddGBPerMonth: 0.03,
      iopsPremium: 0.0001,
    },
    network: {
      perGB: 0.09,
    },
    llm: {
      gpt4InputPer1K: 0.03,
      gpt4OutputPer1K: 0.06,
      gpt35InputPer1K: 0.0005,
      gpt35OutputPer1K: 0.0015,
    },
  };

  estimate(workload: WorkloadProfile, duration: { months: number }): CostEstimate {
    const breakdown: CostBreakdown = {
      compute: this.estimateCompute(workload, duration),
      storage: this.estimateStorage(workload, duration),
      network: this.estimateNetwork(workload, duration),
      llm: this.estimateLLM(workload, duration),
      thirdParty: this.estimateThirdParty(workload, duration),
    };

    const total = Object.values(breakdown).reduce(
      (sum, cat) => sum + cat.cost,
      0
    );

    return {
      period: duration.months === 12 ? 'yearly' : 'monthly',
      currency: 'USD',
      breakdown,
      total: Math.round(total * 100) / 100,
      byService: {
        compute: breakdown.compute.cost,
        storage: breakdown.storage.cost,
        network: breakdown.network.cost,
        llm: breakdown.llm.cost,
        'third-party': breakdown.thirdParty.cost,
      },
      recommendations: this.generateRecommendations(breakdown),
    };
  }

  private estimateCompute(
    workload: WorkloadProfile,
    duration: { months: number }
  ): CostBreakdown['compute'] {
    const calculator = new ComputeCalculator();
    const resources = calculator.calculate(workload);

    const hoursPerMonth = 730;
    const totalHours = hoursPerMonth * duration.months;

    const vcpuHours = resources.cpu.cores * totalHours;
    const memoryGBHours = resources.memory.sizeGB * totalHours;

    return {
      cost: vcpuHours * this.pricing.compute.vcpuPerHour +
            memoryGBHours * this.pricing.compute.gbMemoryPerHour,
      vcpuHours,
      memoryGBHours,
    };
  }

  private estimateLLM(
    workload: WorkloadProfile,
    duration: { months: number }
  ): CostBreakdown['llm'] {
    const projectsPerMonth = workload.users.peakPerHour * 730;

    // 平均每个项目使用 LLM
    const avgLLMCallsPerProject = workload.operations.llmCallsPerProject;
    const avgInputTokensPerCall = 1000;
    const avgOutputTokensPerCall = 500;

    const totalInputTokens = projectsPerMonth * avgLLMCallsPerProject * avgInputTokensPerCall;
    const totalOutputTokens = projectsPerMonth * avgLLMCallsPerProject * avgOutputTokensPerCall;

    // 混合使用 GPT-4 (20%) 和 GPT-3.5 (80%)
    const gpt4InputTokens = totalInputTokens * 0.2;
    const gpt4OutputTokens = totalOutputTokens * 0.2;
    const gpt35InputTokens = totalInputTokens * 0.8;
    const gpt35OutputTokens = totalOutputTokens * 0.8;

    const gpt4Cost = (gpt4InputTokens / 1000) * this.pricing.llm.gpt4InputPer1K +
                      (gpt4OutputTokens / 1000) * this.pricing.llm.gpt4OutputPer1K;

    const gpt35Cost = (gpt35InputTokens / 1000) * this.pricing.llm.gpt35InputPer1K +
                       (gpt35OutputTokens / 1000) * this.pricing.llm.gpt35OutputPer1K;

    return {
      cost: gpt4Cost + gpt35Cost,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    };
  }

  private generateRecommendations(breakdown: CostBreakdown): CostOptimization[] {
    const recommendations: CostOptimization[] = [];

    // 检查是否使用预留实例
    if (breakdown.compute.cost > 1000) {
      recommendations.push({
        type: 'reserved_instances',
        potentialSavings: breakdown.compute.cost * 0.3,
        description: '使用预留实例可节省 30-40% 计算成本',
        action: '考虑购买 1 年或 3 年预留实例',
      });
    }

    // 检查存储类型
    recommendations.push({
      type: 'storage_tiering',
      potentialSavings: breakdown.storage.cost * 0.5,
      description: '冷数据使用低频存储',
      action: '配置生命周期策略，移动 90 天以上数据到 S3 Glacier',
    });

    // 检查 LLM 优化
    if (breakdown.llm.cost > 500) {
      recommendations.push({
        type: 'llm_caching',
        potentialSavings: breakdown.llm.cost * 0.2,
        description: '启用 LLM 响应缓存',
        action: '使用 Redis 缓存常见查询结果',
      });
    }

    return recommendations;
  }
}

interface CostOptimization {
  type: string;
  potentialSavings: number;
  description: string;
  action: string;
}
```

### 4.2 成本仪表盘配置

```typescript
// capacity/cost-dashboard.ts
const costDashboardConfig = {
  title: "ProjectFactory 成本仪表盘",
  panels: [
    {
      title: "每日成本趋势",
      type: "graph",
      targets: [
        {
          expr: "sum(rate(projectfactory_cost_total[1d]))",
          legendFormat: "日成本"
        }
      ],
      thresholds: [
        { value: 100, color: "green" },
        { value: 500, color: "yellow" },
        { value: 1000, color: "red" }
      ]
    },
    {
      title: "成本分布",
      type: "piechart",
      targets: [
        {
          expr: "sum by service (projectfactory_cost)",
          legendFormat: "{{service}}"
        }
      ]
    },
    {
      title: "单位项目成本",
      type: "stat",
      targets: [
        {
          expr: "sum(projectfactory_cost_total) / sum(projectfactory_projects_completed_total)",
          legendFormat: "$/项目"
        }
      ]
    },
    {
      title: "成本预测",
      type: "timeseries",
      targets: [
        {
          expr: "predict_linear(projectfactory_cost_total[7d], 30 * 24 * 3600)",
          legendFormat: "30 天预测"
        }
      ]
    }
  ]
};
```

---

## 5. 容量测试

### 5.1 负载测试场景

```yaml
# capacity/load-tests/scenarios.yaml
scenarios:
  baseline:
    name: "基线负载"
    description: "正常运行负载"
    load:
      users: 50
      spawnRate: 5
      duration: 300
    phases:
      - duration: 60
        users: 25
      - duration: 180
        users: 50
      - duration: 60
        users: 25

  peak:
    name: "峰值负载"
    description: "预期峰值负载"
    load:
      users: 200
      spawnRate: 20
      duration: 300
    phases:
      - duration: 60
        users: 100
      - duration: 120
        users: 200
      - duration: 120
        users: 150

  stress:
    name: "压力测试"
    description: "超过设计容量的压力测试"
    load:
      users: 500
      spawnRate: 50
      duration: 300
    phases:
      - duration: 60
        users: 200
      - duration: 60
        users: 350
      - duration: 60
        users: 500
      - duration: 60
        users: 200

  spike:
    name: "流量突增"
    description: "模拟流量突增"
    load:
      users: 100
      spawnRate: 100
      duration: 120
    phases:
      - duration: 20
        users: 50
      - duration: 10
        users: 500  # 突增
      - duration: 30
        users: 500
      - duration: 60
        users: 50

  sustained:
    name: "持续负载"
    description: "24 小时持续负载"
    load:
      users: 100
      spawnRate: 10
      duration: 86400  # 24 小时
    phases:
      - duration: 3600
        users: 80
      - duration: 7200
        users: 100
      - duration: 3600
        users: 120
      - duration: 72000
        users: 100
```

### 5.2 性能基准

```typescript
// capacity/benchmarks/performance-baseline.ts
const performanceBaselines = {
  api: {
    listProjects: {
      p50: 50,    // ms
      p95: 100,
      p99: 200,
      max: 500,
    },
    getProject: {
      p50: 30,
      p95: 80,
      p99: 150,
      max: 300,
    },
    createProject: {
      p50: 200,
      p95: 500,
      p99: 1000,
      max: 2000,
    },
  },
  llm: {
    codeGeneration: {
      p50: 5000,
      p95: 15000,
      p99: 30000,
      max: 60000,
    },
    qualityReview: {
      p50: 3000,
      p95: 10000,
      p99: 20000,
      max: 40000,
    },
  },
  database: {
    query: {
      p50: 5,
      p95: 20,
      p99: 50,
      max: 100,
    },
    insert: {
      p50: 10,
      p95: 30,
      p99: 100,
      max: 200,
    },
  },
  throughput: {
    concurrentUsers: 200,
    requestsPerSecond: 1000,
    projectsPerHour: 50,
  },
};

function validatePerformance(results: PerformanceResults): ValidationResult {
  const violations: Violation[] = [];

  for (const [endpoint, baseline] of Object.entries(performanceBaselines.api)) {
    const result = results.api[endpoint];

    if (result.p99 > baseline.p99) {
      violations.push({
        type: 'latency',
        endpoint,
        metric: 'p99',
        expected: baseline.p99,
        actual: result.p99,
        severity: result.p99 > baseline.max ? 'critical' : 'warning',
      });
    }
  }

  return {
    passed: violations.filter(v => v.severity === 'critical').length === 0,
    violations,
  };
}
```

---

## 6. 相关文档

- [性能优化](./PERFORMANCE_OPTIMIZATION.md)
- [性能基准测试](./PERFORMANCE_BENCHMARKING.md)
- [成本优化](./COST_OPTIMIZATION.md)
- [监控与告警](./MONITORING_ALERTING.md)

---

**最后更新**: 2026-04-14
