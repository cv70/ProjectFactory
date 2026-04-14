# 混沌工程设计

## 1. 概述

本文档描述 ProjectFactory 系统的混沌工程实践，通过主动注入故障来验证系统的容错能力和恢复机制。

### 1.1 混沌工程成熟度模型

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         混沌工程成熟度                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Level 1: 探索 (Chaos Experiment)                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  • 手动执行故障注入                                                   │   │
│  │  • 单一服务、单一故障类型                                             │   │
│  │  • 非生产环境                                                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│  Level 2: 建立 (Steady State)                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  • 定义业务指标基线                                                   │   │
│  │  • 自动化实验执行                                                     │   │
│  │  • 生产前环境验证                                                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│  Level 3: 测量 (Measurement)                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  • 收集 SLO/SLI 指标                                                 │   │
│  │  • 测量 MTTR、可用性影响                                              │   │
│  │  • 与告警集成                                                         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│  Level 4: 优化 (Optimization)                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  • 持续改进实验                                                       │   │
│  │  • 覆盖关键场景                                                       │   │
│  │  • 自动修复验证                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│  Level 5: 成熟 (Resilience Culture)                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  • 游戏日 (Game Days)                                                 │   │
│  │  • 全公司参与                                                         │   │
│  │  • 定期演练                                                           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 实验设计

### 2.1 稳态定义

```typescript
// chaos/steady-state.ts
interface SteadyStateHypothesis {
  name: string;
  description: string;
  probes: Probe[];
  tolerance: number; // 允许的偏差百分比
}

interface Probe {
  name: string;
  type: 'http' | 'metric' | 'custom';
  config: ProbeConfig;
  expected: ExpectedResult;
}

interface ProbeConfig {
  // HTTP 探测
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;

  // 指标探测
  promql?: string;
  range?: string;

  // 自定义探测
  script?: string;
}

interface ExpectedResult {
  statusCode?: number;
  latency?: { max: number };
  bodyContains?: string;
  metricValue?: { min: number; max: number };
}

// ProjectFactory 稳态假设
const STEADY_STATE_HYPOTHESES: SteadyStateHypothesis[] = [
  {
    name: 'API 可用性',
    description: '所有 API 端点正常响应',
    tolerance: 0.99,
    probes: [
      {
        name: 'health-check',
        type: 'http',
        config: {
          url: 'http://backend:3001/health',
          method: 'GET',
        },
        expected: {
          statusCode: 200,
          bodyContains: '"status":"healthy"',
        },
      },
      {
        name: 'project-creation',
        type: 'http',
        config: {
          url: 'http://backend:3001/api/v1/projects',
          method: 'POST',
          body: { ideaId: 'test-id', name: 'chaos-test' },
        },
        expected: {
          statusCode: 201,
          latency: { max: 2000 },
        },
      },
    ],
  },
  {
    name: '数据库可用性',
    description: '数据库读写操作正常',
    tolerance: 0.999,
    probes: [
      {
        name: 'db-read',
        type: 'http',
        config: {
          url: 'http://backend:3001/api/v1/ideas',
          method: 'GET',
        },
        expected: {
          statusCode: 200,
          latency: { max: 100 },
        },
      },
    ],
  },
  {
    name: '队列处理能力',
    description: '后台任务正常处理',
    tolerance: 0.95,
    probes: [
      {
        name: 'queue-depth',
        type: 'metric',
        config: {
          promql: 'redis_queue_depth{job="projectfactory"}',
        },
        expected: {
          metricValue: { min: 0, max: 1000 },
        },
      },
    ],
  },
];
```

### 2.2 故障场景库

```yaml
# chaos/scenarios/
name: "idea-service-kill-pod"
description: "模拟 Idea Service Pod 被终止"
version: "1.0"
enabled: true

# 前置条件
preconditions:
  - name: "service-must-be-healthy"
    check: http
    url: "http://idea-service:4001/health"
    expected:
      statusCode: 200

# 动作
action:
  type: "kill-pod"
  selector:
    app: idea-service
  count: 1
  gracePeriod: 0 # 立即杀死，不等待优雅关闭

# 稳态验证
steadyState:
  - name: "api-available"
    probes:
      - http:
          url: "http://backend:3001/api/v1/ideas"
          expected:
            statusCode: 200
            latency:
              max: 5000
  - name: "no-error-spike"
    probes:
      - promql: |
          rate(http_requests_total{service="idea-service",status=~"5.."}[1m])
        expected:
          metricValue:
            max: 0.1 # 错误率不超过 10%

# 恢复动作
recovery:
  - name: "wait-for-recovery"
    type: "wait"
    duration: 60s

# 观察期
observation:
  duration: 300s
  interval: 5s

# 清理
teardown:
  - type: "verify-deployment"
    selector:
      app: idea-service
    expected:
      replicas: 3

---
name: "llm-proxy-latency-injection"
description: "模拟 LLM 服务响应延迟"
version: "1.0"
enabled: true

action:
  type: "network-latency"
  selector:
    app: llm-proxy
  delay:
    min: 5000
    max: 10000
  jitter: 1000
  packetLoss: 0

steadyState:
  - name: "fallback-triggered"
    probes:
      - promql: |
          rate(fallback_triggers_total{service="llm"}[1m])
        expected:
          metricValue:
            min: 0 # 有 fallback 触发

observation:
  duration: 180s

---
name: "redis-network-partition"
description: "模拟 Redis 网络分区"
version: "1.0"
enabled: true

action:
  type: "network-partition"
  selector:
    app: redis
  blockedTargets:
    - backend

steadyState:
  - name: "cache-fallback-works"
    probes:
      - http:
          url: "http://backend:3001/api/v1/ideas"
          expected:
            statusCode: 200
            latency:
              max: 10000 # 降级模式下延迟增加

teardown:
  - type: "restore-network"
    selector:
      app: redis

---
name: "database-connection-exhaustion"
description: "模拟数据库连接池耗尽"
version: "1.0"
enabled: false

action:
  type: "resource-exhaustion"
  selector:
    app: backend
  resource: connections
  limit: 1 # 只允许 1 个连接

steadyState:
  - name: "requests-queued"
    probes:
      - promql: |
          sum(rate(http_requests_in_flight{service="backend"}[1m]))
        expected:
          metricValue:
            min: 10 # 有请求排队

observation:
  duration: 120s
```

---

## 3. 故障注入工具

### 3.1 Litmus Chaos Operator

```yaml
# chaos/litmus/chaos-engineer-rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: chaos-engineer
  namespace: projectfactory
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: chaos-engineer
  namespace: projectfactory
rules:
  - apiGroups: [""]
    resources: ["pods", "services", "endpoints"]
    verbs: ["get", "list", "watch", "delete"]
  - apiGroups: ["litmuschaos.io"]
    resources: ["chaosengines", "chaosexperiments", "chaosresults"]
    verbs: ["get", "list", "create", "update", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: chaos-engineer
  namespace: projectfactory
subjects:
  - kind: ServiceAccount
    name: chaos-engineer
    namespace: projectfactory
roleRef:
  kind: Role
  name: chaos-engineer
  apiGroup: rbac.authorization.k8s.io
```

### 3.2 混沌实验执行器

```typescript
// chaos/executor/experiment-runner.ts
import { Kubernetes } from 'kubernetes-client';
import { LitmusChaosClient } from '@chaos-mesh/sdk';

class ChaosExperimentRunner {
  private k8s: Kubernetes;
  private litmus: LitmusChaosClient;

  async execute(
    experiment: ChaosExperiment,
    options: ExecutionOptions
  ): Promise<ExperimentResult> {
    console.log(`Starting chaos experiment: ${experiment.name}`);

    // 1. 验证前置条件
    const preconditionsMet = await this.verifyPreconditions(
      experiment.preconditions
    );

    if (!preconditionsMet && !options.skipPreconditions) {
      throw new PreconditionNotMetError(experiment.name);
    }

    // 2. 记录稳态基线
    const baseline = await this.captureBaseline(experiment.steadyState);

    // 3. 执行混沌动作
    console.log(`Executing action: ${experiment.action.type}`);
    await this.executeAction(experiment.action);

    // 4. 监控恢复
    const recovery = await this.monitorRecovery(
      experiment.steadyState,
      experiment.observation
    );

    // 5. 清理
    await this.cleanup(experiment.teardown);

    // 6. 生成报告
    return {
      experiment: experiment.name,
      startedAt: new Date(),
      completedAt: new Date(),
      steadyStateMaintained: recovery.maintained,
      recoveryTime: recovery.time,
      baseline,
      observations: recovery.observations,
      verdict: this.determineVerdict(recovery, experiment.tolerance),
    };
  }

  private async monitorRecovery(
    hypotheses: SteadyStateHypothesis[],
    observation: ObservationConfig
  ): Promise<RecoveryResult> {
    const observations: Observation[] = [];
    const startTime = Date.now();

    while (Date.now() - startTime < observation.duration) {
      const snapshot = await this.captureCurrentState(hypotheses);
      observations.push({
        timestamp: Date.now(),
        data: snapshot,
      });

      // 检查稳态是否恢复
      const allHealthy = await this.verifySteadyState(snapshot, hypotheses);

      if (allHealthy) {
        return {
          maintained: true,
          time: Date.now() - startTime,
          observations,
        };
      }

      await this.sleep(observation.interval);
    }

    return {
      maintained: false,
      time: observation.duration,
      observations,
    };
  }

  private determineVerdict(
    recovery: RecoveryResult,
    tolerance: number
  ): 'pass' | 'fail' | 'warning' {
    if (!recovery.maintained) {
      return 'fail';
    }

    if (recovery.time > tolerance * 300000) {
      // 超过容许时间的 50%
      return 'warning';
    }

    return 'pass';
  }
}
```

### 3.3 自动化演练调度

```yaml
# chaos/scheduler/game-day-schedule.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: chaos-game-day
  namespace: projectfactory
spec:
  schedule: "0 2 * * 6" # 每周六凌晨 2 点
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: chaos-engineer
          containers:
            - name: game-day
              image: projectfactory/chaos-runner:latest
              env:
                - name: GAME_DAY_TYPE
                  value: "full-resilience"
                - name: NOTIFICATION_WEBHOOK
                  valueFrom:
                    secretKeyRef:
                      name: chaos-secrets
                      key: webhook-url
                - name: SLACK_CHANNEL
                  value: "#incidents"
              command:
                - node
                - dist/game-day.js
          restartPolicy: OnFailure
```

---

## 4. 游戏日设计

### 4.1 游戏日流程

```markdown
# ProjectFactory 游戏日流程

## 1. 准备阶段 (1 小时)
- [ ] 通知所有参与者
- [ ] 确认备份完成
- [ ] 验证监控告警正常
- [ ] 准备应急响应团队
- [ ] 锁定生产环境变更

## 2. 简报阶段 (15 分钟)
- [ ] 介绍游戏日目标
- [ ] 说明演练场景
- [ ] 宣布规则和角色

## 3. 演练阶段 (3 小时)
| 时间 | 场景 | 参与者 | 预期结果 |
|------|------|--------|----------|
| 10:00 | 服务中断 - Idea Service | SRE | 自动恢复 |
| 11:00 | 网络延迟 - LLM Proxy | Backend | 触发降级 |
| 12:00 | 数据库高负载 | DBA | 连接池管理 |
| 13:00 | 队列积压 | Backend | 自动扩容 |
| 14:00 | 全部 Region 故障 | SRE | 灾难恢复 |

## 4. 复盘阶段 (1 小时)
- [ ] 记录问题
- [ ] 分析根本原因
- [ ] 制定改进计划
- [ ] 更新 Runbook
```

### 4.2 演练场景卡

```yaml
# chaos/game-day/scenario-cards/
scenario: "Region Failure"
duration: 60 minutes
severity: Critical
team: ["sre-oncall", "backend-lead", "dba"]

steps:
  - step: 1
    action: "模拟 us-east-1 region 完全不可用"
    injection: |
      kubectl label nodes -l topology.kubernetes.io/region=us-east-1 --overwrite node.kubernetes.io/exclude-from-eviction=true
    expected:
      - traffic failover to us-west-2
      - RTO < 5 minutes
      - zero data loss
    verification:
      - check: "API health"
        command: "curl http://api.projectfactory.com/health"
      - check: "Database replication lag"
        command: "SELECT now() - pg_last_xact_replay_timestamp()"
      - check: "Error rates"
        command: "promql query rate(http_errors_total[5m])"

  - step: 2
    action: "验证降级模式功能"
    injection: |
      # 禁用非关键功能
      curl -X POST http://backend:3001/admin/features \
        -d '{"features": ["analytics", "recommendations"], "enabled": false}'
    expected:
      - core functionality maintained
      - error rates < 0.1%
      - latency p99 < 2s

  - step: 3
    action: "恢复区域"
    injection: |
      kubectl label nodes -l topology.kubernetes.io/region=us-east-1 node.kubernetes.io/exclude-eviction-
    expected:
      - 自动回切流量
      - 数据同步完成
      - 稳态恢复

rollback:
  - "立即恢复所有节点标签"
  - "重新启用所有功能"
  - "验证数据完整性"

postGameDay:
  actionItems:
    - "更新灾难恢复文档"
    - "优化 failover 流程"
    - "增加监控告警"
```

---

## 5. 监控与告警集成

### 5.1 混沌指标收集

```typescript
// chaos/metrics/chaos-metrics.ts
const chaosMetrics = {
  // 实验执行计数
  experimentsTotal: new Counter({
    name: 'chaos_experiments_total',
    help: 'Total number of chaos experiments executed',
    labelNames: ['experiment', 'verdict', 'environment'],
  }),

  // 实验持续时间
  experimentDuration: new Histogram({
    name: 'chaos_experiment_duration_seconds',
    help: 'Chaos experiment duration',
    labelNames: ['experiment'],
    buckets: [60, 300, 600, 1800, 3600],
  }),

  // 稳态恢复时间
  recoveryTime: new Histogram({
    name: 'chaos_recovery_time_seconds',
    help: 'Time to recover steady state after chaos',
    labelNames: ['experiment', 'failure_type'],
    buckets: [5, 10, 30, 60, 120, 300, 600],
  }),

  // 服务影响指标
  serviceImpact: new Gauge({
    name: 'chaos_service_impact',
    help: 'Service impact during chaos experiment',
    labelNames: ['service', 'metric'],
  }),

  // 实验准备状态
  experimentReadiness: new Gauge({
    name: 'chaos_experiment_ready',
    help: 'Whether chaos experiment is in ready state',
    labelNames: ['experiment'],
  }),
};
```

### 5.2 告警规则

```yaml
# chaos/alerts/chaos-alerts.yaml
groups:
  - name: chaos-engineering
    rules:
      # 实验失败告警
      - alert: ChaosExperimentFailed
        expr: chaos_experiments_total{verdict="fail"} > 0
        for: 0m
        labels:
          severity: warning
        annotations:
          summary: "混沌实验失败"
          description: "实验 {{ $labels.experiment }} 在 {{ $labels.environment }} 环境执行失败"

      # 恢复时间过长告警
      - alert: ChaosRecoveryTimeExceeded
        expr: chaos_recovery_time_seconds > 300
        for: 0m
        labels:
          severity: warning
        annotations:
          summary: "混沌恢复时间过长"
          description: "实验 {{ $labels.experiment }} 恢复时间超过 5 分钟"

      # 游戏日状态
      - alert: GameDayInProgress
        expr: chaos_game_day_active == 1
        for: 0m
        labels:
          severity: info
        annotations:
          summary: "游戏日进行中"
          description: "混沌工程游戏日正在进行中"

      # 实验就绪状态异常
      - alert: ChaosExperimentNotReady
        expr: chaos_experiment_ready < 1
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "混沌实验未就绪"
          description: "实验 {{ $labels.experiment }} 处于未就绪状态"
```

---

## 6. 持续改进

### 6.1 实验结果分析

```typescript
// chaos/analytics/experiment-analytics.ts
interface ExperimentAnalysis {
  experiment: string;
  period: string;
  totalRuns: number;
  passRate: number;
  avgRecoveryTime: number;
  trend: 'improving' | 'stable' | 'degrading';
  recommendations: string[];
}

async function analyzeExperimentResults(
  experiment: string,
  period: { start: Date; end: Date }
): Promise<ExperimentAnalysis> {
  const results = await queryExperimentResults(experiment, period);

  const totalRuns = results.length;
  const passRuns = results.filter(r => r.verdict === 'pass').length;
  const recoveryTimes = results
    .filter(r => r.recoveryTime)
    .map(r => r.recoveryTime);

  const avgRecoveryTime = recoveryTimes.length > 0
    ? recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length
    : 0;

  const trend = calculateTrend(results);

  return {
    experiment,
    period: `${period.start.toISOString()} - ${period.end.toISOString()}`,
    totalRuns,
    passRate: totalRuns > 0 ? passRuns / totalRuns : 0,
    avgRecoveryTime,
    trend,
    recommendations: generateRecommendations(results),
  };
}

function calculateTrend(results: ExperimentResult[]): 'improving' | 'stable' | 'degrading' {
  if (results.length < 3) return 'stable';

  // 比较最近 1/3 和最早 1/3 的平均恢复时间
  const recentAvg = avg(results.slice(-3).map(r => r.recoveryTime));
  const oldAvg = avg(results.slice(0, 3).map(r => r.recoveryTime));

  const changePercent = (recentAvg - oldAvg) / oldAvg * 100;

  if (changePercent < -10) return 'improving';
  if (changePercent > 10) return 'degrading';
  return 'stable';
}
```

---

## 7. 相关文档

- [容错与降级设计](./FAULT_TOLERANCE.md)
- [灾难恢复](./DISASTER_RECOVERY.md)
- [监控与告警](./MONITORING_ALERTING.md)
- [服务网格](./SERVICE_MESH.md)
- [运维手册](./OPERATIONAL_RUNBOOK.md)

---

**最后更新**: 2026-04-14
