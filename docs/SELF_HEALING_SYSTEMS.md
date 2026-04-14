# 自愈系统设计

## 1. 概述

本文档定义 ProjectFactory 系统的自愈（Self-Healing）能力设计，使系统能够自动检测、诊断和恢复故障，减少人工干预需求。

### 1.1 自愈系统原则

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           自愈系统原则                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │     自动检测     │  │     自动诊断     │  │     自动恢复     │         │
│  │   Detection    │  │   Diagnosis    │  │   Recovery     │         │
│  │                 │  │                 │  │                 │         │
│  │ • 健康监控     │  │ • 根因分析     │  │ • 策略执行     │         │
│  │ • 异常识别     │  │ • 影响评估     │  │ • 回滚机制     │         │
│  │ • 告警触发     │  │ • 方案生成     │  │ • 验证确认     │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │     自动适应     │  │     自动优化     │  │     自动预防     │         │
│  │   Adaptation   │  │   Optimization  │  │   Prevention   │         │
│  │                 │  │                 │  │                 │         │
│  │ • 负载均衡     │  │ • 性能调优     │  │ • 容量规划     │         │
│  │ • 故障转移     │  │ • 资源调整     │  │ • 趋势预测     │         │
│  │ • 降级熔断     │  │ • 配置优化     │  │ • 预防维护     │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 健康监控体系

### 2.1 健康检查架构

```typescript
// 健康检查接口定义
interface HealthCheck {
  name: string;
  type: 'liveness' | 'readiness' | 'startup';
  timeout: number;
  interval: number;
  threshold: number;  // 连续失败次数阈值
}

interface HealthStatus {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  responseTime: number;
  details?: Record<string, unknown>;
}

// 健康检查配置
const healthChecks: HealthCheck[] = [
  {
    name: 'api-server',
    type: 'readiness',
    timeout: 5000,
    interval: 10,
    threshold: 3
  },
  {
    name: 'database',
    type: 'readiness',
    timeout: 3000,
    interval: 5,
    threshold: 3
  },
  {
    name: 'llm-provider',
    type: 'readiness',
    timeout: 10000,
    interval: 30,
    threshold: 5
  },
  {
    name: 'storage',
    type: 'liveness',
    timeout: 2000,
    interval: 15,
    threshold: 3
  }
];
```

### 2.2 核心指标采集

```typescript
// 系统级指标
interface SystemMetrics {
  // CPU 指标
  cpu: {
    usage: number;           // 百分比
    loadAverage: number[];   // 1/5/15 分钟
    throttle: number;        // 节流次数
  };

  // 内存指标
  memory: {
    used: number;
    available: number;
    percentage: number;
    gcCount: number;          // GC 次数
    gcDuration: number;      // GC 耗时
  };

  // 进程指标
  process: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    openHandles: number;
    activeRequests: number;
  };
}

// 应用级指标
interface ApplicationMetrics {
  // HTTP 指标
  http: {
    requestsTotal: number;
    requestsActive: number;
    requestDuration: Histogram;
    errorsByStatus: Record<string, number>;
  };

  // 数据库指标
  database: {
    connectionsActive: number;
    connectionsIdle: number;
    queryDuration: Histogram;
    queryErrors: number;
  };

  // 业务指标
  business: {
    projectsGenerated: number;
    projectsActive: number;
    ideasProcessed: number;
    agentExecutions: number;
    averageQualityScore: number;
  };
}

// 自愈指标
interface HealerMetrics {
  incidentsDetected: number;
  incidentsResolved: number;
  incidentsEscalated: number;
  averageResolutionTime: number;
  falsePositiveRate: number;
}
```

### 2.3 异常检测模式

```typescript
// 异常检测器类型
type AnomalyDetector =
  | 'threshold'      // 阈值检测
  | 'statistical'    // 统计异常检测
  | 'ml-based'       // ML 异常检测
  | 'pattern';       // 模式匹配

// 阈值检测配置
interface ThresholdConfig {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==';
  value: number;
  duration?: number;  // 持续时间
  severity: 'warning' | 'critical';
}

// 统计异常检测配置
interface StatisticalConfig {
  metric: string;
  method: 'z-score' | 'mad' | 'iqr';
  threshold: number;
  baselineWindows: number[];  // 基线窗口（小时）
}

// 异常检测规则
const anomalyRules: AnomalyRule[] = [
  {
    id: 'cpu-high',
    type: 'threshold',
    config: {
      metric: 'system.cpu.usage',
      operator: '>',
      value: 90,
      duration: 300,  // 5分钟
      severity: 'warning'
    },
    action: 'scale-up'
  },
  {
    id: 'response-slow',
    type: 'statistical',
    config: {
      metric: 'http.request.duration',
      method: 'z-score',
      threshold: 3,
      baselineWindows: [1, 24, 168]  // 1小时/24小时/周
    },
    action: 'investigate'
  },
  {
    id: 'error-rate-spike',
    type: 'threshold',
    config: {
      metric: 'http.errorsByStatus.500',
      operator: '>',
      value: 10,
      duration: 60,
      severity: 'critical'
    },
    action: 'incident'
  }
];
```

---

## 3. 根因分析系统

### 3.1 故障分类

```typescript
// 故障类型分类
enum FailureCategory {
  // 基础设施层
  INFRASTRUCTURE = 'infrastructure',      // 硬件/网络/存储
  INFRA_COMPUTE = 'infra-compute',         // 计算资源
  INFRA_NETWORK = 'infra-network',          // 网络连接
  INFRA_STORAGE = 'infra-storage',          // 存储问题

  // 应用层
  APPLICATION = 'application',              // 应用崩溃
  APP_CRASH = 'app-crash',                 // 进程崩溃
  APP_HANG = 'app-hang',                   // 进程挂起
  APP_DEADLOCK = 'app-deadlock',           // 死锁

  // 依赖层
  DEPENDENCY = 'dependency',               // 外部依赖
  DEP_LLM = 'dep-llm',                    // LLM 提供商
  DEP_DATABASE = 'dep-database',           // 数据库
  DEP_STORAGE = 'dep-storage',            // 存储服务
  DEP_EXTERNAL = 'dep-external',           // 外部 API

  // 业务层
  BUSINESS = 'business',                  // 业务逻辑
  BUS_VALIDATION = 'bus-validation',       // 验证失败
  BUS_LOGIC = 'bus-logic',                // 逻辑错误
  BUS_TIMEOUT = 'bus-timeout',            // 业务超时

  // 未知
  UNKNOWN = 'unknown'
}

// 故障信息结构
interface Failure {
  id: string;
  category: FailureCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  symptom: string;
  affectedComponents: string[];
  errorMessage?: string;
  stackTrace?: string;
  context: Record<string, unknown>;
}
```

### 3.2 根因分析流程

```typescript
// RCA 阶段定义
enum RCAStage {
  DETECT = 'detect',           // 检测阶段
  TRIAGE = 'triage',           // 分诊阶段
  INVESTIGATE = 'investigate', // 调查阶段
  DIAGNOSE = 'diagnose',       // 诊断阶段
  RESOLVE = 'resolve',         // 解决阶段
  REVIEW = 'review'            // 复盘阶段
}

// RCA 上下文
interface RCAContext {
  failure: Failure;
  currentStage: RCAStage;
  evidence: Evidence[];
  hypotheses: Hypothesis[];
  timeline: TimelineEvent[];
  resolution?: Resolution;
}

// 证据收集
interface Evidence {
  type: 'log' | 'metric' | 'trace' | 'snapshot' | 'config';
  source: string;
  timestamp: Date;
  content: unknown;
  relevance: number;  // 0-1
}

// 假设
interface Hypothesis {
  id: string;
  description: string;
  probability: number;  // 0-1
  supportingEvidence: string[];  // evidence IDs
  refutingEvidence: string[];   // evidence IDs
  testStrategy?: string;
}

// RCA 执行器
class RCACExecutor {
  async analyze(failure: Failure): Promise<RCAReport> {
    const ctx: RCAContext = {
      failure,
      currentStage: RCAStage.DETECT,
      evidence: [],
      hypotheses: [],
      timeline: []
    };

    // 1. 分诊 - 确定故障类别
    ctx = await this.triage(ctx);

    // 2. 调查 - 收集证据
    ctx = await this.investigate(ctx);

    // 3. 诊断 - 生成假设并验证
    ctx = await this.diagnose(ctx);

    // 4. 解决 - 制定修复方案
    ctx = await this.resolve(ctx);

    // 5. 复盘 - 输出报告
    return this.review(ctx);
  }

  private async triage(ctx: RCAContext): Promise<RCAContext> {
    // 基于症状模式匹配确定类别
    const patterns = await this.matchPatterns(ctx.failure.symptom);
    ctx.failure.category = patterns.mostLikely.category;
    ctx.failure.severity = this.assessSeverity(ctx.failure);
    ctx.currentStage = RCAStage.TRIAGE;
    return ctx;
  }
}

// RCA 报告
interface RCAReport {
  failure: Failure;
  rootCause: string;
  confidence: number;
  evidenceChain: Evidence[];
  timeline: TimelineEvent[];
  resolution: Resolution;
  lessons: string[];
  preventionRecommendations: string[];
}
```

### 3.3 日志分析引擎

```typescript
// 日志分析配置
const logAnalysisConfig = {
  // 日志源
  sources: [
    { type: 'application', path: '/var/log/projectfactory/app.log' },
    { type: 'system', path: '/var/log/projectfactory/system.log' },
    { type: 'access', path: '/var/log/projectfactory/access.log' },
    { type: 'error', path: '/var/log/projectfactory/error.log' }
  ],

  // 异常模式
  patterns: [
    {
      name: 'OutOfMemory',
      regex: /OutOfMemoryError|Java heap space|allocation failed/,
      severity: 'critical',
      category: FailureCategory.APPLICATION
    },
    {
      name: 'ConnectionTimeout',
      regex: /connection.*timeout|ETIMEDOUT|EHOSTUNREACH/,
      severity: 'warning',
      category: FailureCategory.DEPENDENCY
    },
    {
      name: 'DatabaseDeadlock',
      regex: /deadlock detected|lock wait timeout/,
      severity: 'high',
      category: FailureCategory.DEP_DATABASE
    },
    {
      name: 'LLMAPIFailure',
      regex: /OpenAI.*error|rate limit exceeded|model.*unavailable/,
      severity: 'medium',
      category: FailureCategory.DEP_LLM
    }
  ],

  // 聚合规则
  aggregation: {
    windowSize: '5m',
    minOccurrences: 3,
    groupBy: ['pattern', 'component', 'instance']
  }
};

// 日志分析结果
interface LogAnalysisResult {
  matchedPatterns: MatchedPattern[];
  anomalies: Anomaly[];
  correlationId?: string;
  recommendations: string[];
}
```

---

## 4. 自动恢复策略

### 4.1 恢复策略库

```typescript
// 恢复策略类型
enum RecoveryStrategyType {
  RESTART = 'restart',           // 重启
  SCALE = 'scale',               // 扩缩容
  ROLLBACK = 'rollback',         // 回滚
  FAILOVER = 'failover',         // 故障转移
  CIRCUIT_BREAK = 'circuit-break', // 熔断
  RETRY = 'retry',               // 重试
  GRACEFUL_DEGRADE = 'graceful-degrade', // 优雅降级
  ESCALATE = 'escalate'          // 升级
}

// 恢复策略配置
interface RecoveryStrategy {
  type: RecoveryStrategyType;
  trigger: {
    condition: string;
    metrics?: string[];
    duration?: number;
  };
  action: {
    command?: string;
    parameters?: Record<string, unknown>;
  };
  rollback?: RecoveryStrategy;  // 回退策略
  validation?: {
    checkEndpoint?: string;
    timeout: number;
    retries: number;
  };
}

// 预定义恢复策略
const recoveryStrategies: RecoveryStrategy[] = [
  // 1. 进程崩溃恢复
  {
    type: RecoveryStrategyType.RESTART,
    trigger: {
      condition: 'process.exitCode != 0',
      duration: 0
    },
    action: {
      command: 'systemctl restart projectfactory'
    },
    validation: {
      checkEndpoint: '/health',
      timeout: 30000,
      retries: 3
    }
  },

  // 2. 内存泄漏恢复
  {
    type: RecoveryStrategyType.RESTART,
    trigger: {
      condition: 'memory.percentage > 90',
      metrics: ['system.memory.percentage'],
      duration: 300  // 5分钟
    },
    action: {
      command: 'systemctl restart projectfactory'
    },
    rollback: {
      type: RecoveryStrategyType.ESCALATE,
      action: { command: 'notify-oncall' }
    }
  },

  // 3. LLM 提供商故障
  {
    type: RecoveryStrategyType.CIRCUIT_BREAK,
    trigger: {
      condition: 'llm.errorRate > 0.5',
      metrics: ['llm.errors', 'llm.total'],
      duration: 60
    },
    action: {
      parameters: {
        provider: 'openai',
        state: 'open',  // 打开熔断器
        timeout: 60000  // 1分钟
      }
    }
  },

  // 4. 数据库连接池耗尽
  {
    type: RecoveryStrategyType.RESTART,
    trigger: {
      condition: 'db.connectionsActive >= db.maxConnections',
      duration: 60
    },
    action: {
      command: 'systemctl restart projectfactory-database'
    }
  },

  // 5. 磁盘空间不足
  {
    type: RecoveryStrategyType.GRACEFUL_DEGRADE,
    trigger: {
      condition: 'disk.percentage > 95',
      duration: 60
    },
    action: {
      parameters: {
        actions: ['pause-generation', 'archive-old-projects', 'clear-cache']
      }
    }
  },

  // 6. 高负载扩缩容
  {
    type: RecoveryStrategyType.SCALE,
    trigger: {
      condition: 'cpu.loadAverage > 10',
      metrics: ['system.cpu.loadAverage'],
      duration: 180  // 3分钟
    },
    action: {
      parameters: {
        scaleUp: 2,
        maxInstances: 10
      }
    }
  },

  // 7. 部署故障回滚
  {
    type: RecoveryStrategyType.ROLLBACK,
    trigger: {
      condition: 'deployment.healthCheckFailed',
      duration: 0
    },
    action: {
      command: 'kubectl rollout undo deployment/projectfactory'
    },
    validation: {
      checkEndpoint: '/health',
      timeout: 60000,
      retries: 5
    }
  }
];
```

### 4.2 恢复执行引擎

```typescript
// 恢复执行器
class RecoveryExecutor {
  private strategyRegistry: Map<string, RecoveryStrategy>;
  private executionHistory: RecoveryExecution[];
  private maxRetries = 3;

  async execute(
    failure: Failure,
    strategyType: RecoveryStrategyType
  ): Promise<RecoveryResult> {
    const strategy = this.findStrategy(failure.category, strategyType);
    if (!strategy) {
      return { success: false, reason: 'No strategy found' };
    }

    const execution: RecoveryExecution = {
      id: uuid(),
      failure,
      strategy,
      status: 'pending',
      startTime: new Date()
    };

    try {
      // 执行恢复动作
      await this.executeAction(strategy.action);

      // 验证恢复
      const validated = await this.validate(strategy.validation);

      if (validated) {
        execution.status = 'success';
        execution.endTime = new Date();
        execution.resolution = 'auto-recovered';
      } else {
        // 尝试回退策略
        if (strategy.rollback) {
          return this.executeRollback(execution, strategy.rollback);
        }
        execution.status = 'failed';
        execution.resolution = 'validation-failed';
      }
    } catch (error) {
      execution.status = 'error';
      execution.error = error.message;

      if (strategy.rollback) {
        return this.executeRollback(execution, strategy.rollback);
      }
    }

    // 如果连续失败，升级处理
    if (execution.status === 'failed' || execution.status === 'error') {
      const recentFailures = this.getRecentFailures(failure.component);
      if (recentFailures >= this.maxRetries) {
        await this.escalate(failure);
        execution.resolution = 'escalated';
      }
    }

    this.executionHistory.push(execution);
    return execution;
  }

  private async executeAction(
    action: RecoveryStrategy['action']
  ): Promise<void> {
    if (action.command) {
      await execAsync(action.command);
    }
    // 其他动作类型处理...
  }

  private async validate(
    validation?: RecoveryStrategy['validation']
  ): Promise<boolean> {
    if (!validation) return true;

    for (let i = 0; i < validation.retries; i++) {
      try {
        const response = await fetch(validation.checkEndpoint);
        if (response.ok) return true;
      } catch {
        await sleep(5000);
      }
    }
    return false;
  }
}

// 恢复执行记录
interface RecoveryExecution {
  id: string;
  failure: Failure;
  strategy: RecoveryStrategy;
  status: 'pending' | 'running' | 'success' | 'failed' | 'error';
  startTime: Date;
  endTime?: Date;
  resolution?: string;
  error?: string;
}
```

### 4.3 优雅降级策略

```typescript
// 降级级别定义
enum DegradationLevel {
  FULL = 'full',                 // 完整功能
  REDUCED = 'reduced',           // 降级运行
  MINIMAL = 'minimal',           // 最小运行
  EMERGENCY = 'emergency'        // 紧急模式
}

// 降级规则
interface DegradationRule {
  level: DegradationLevel;
  condition: string;
  disabledFeatures: string[];
  reducedCapabilities: Record<string, unknown>;
  recoveryThreshold: string;
}

// 降级配置
const degradationRules: DegradationRule[] = [
  {
    level: DegradationLevel.REDUCED,
    condition: 'llm.latency > 30000 OR llm.errorRate > 0.1',
    disabledFeatures: [
      'code-review',
      'quality-analysis',
      'auto-optimization'
    ],
    reducedCapabilities: {
      'idea-generation': { batchSize: 1, timeout: 120000 },
      'code-generation': { maxRetries: 1 }
    },
    recoveryThreshold: 'llm.latency < 10000 AND llm.errorRate < 0.05'
  },
  {
    level: DegradationLevel.MINIMAL,
    condition: 'llm.unavailable OR storage.percentage > 90',
    disabledFeatures: [
      'idea-generation',
      'code-review',
      'quality-analysis',
      'auto-optimization',
      'multi-agent'
    ],
    reducedCapabilities: {
      'basic-execution': { timeout: 30000 },
      'logging': { level: 'error' }
    },
    recoveryThreshold: 'llm.available AND storage.percentage < 80'
  },
  {
    level: DegradationLevel.EMERGENCY,
    condition: 'system.crash OR deployment.corrupt',
    disabledFeatures: ['*'],  // 全部禁用
    reducedCapabilities: {
      'emergency-mode': true,
      'logging': { level: 'critical', buffer: false }
    },
    recoveryThreshold: 'manual-intervention'
  }
];

// 降级管理器
class DegradationManager {
  private currentLevel: DegradationLevel = DegradationLevel.FULL;
  private featureFlags: Map<string, boolean>;

  async evaluateAndDegrade(): Promise<void> {
    for (const rule of degradationRules) {
      if (await this.matchesCondition(rule.condition)) {
        if (rule.level > this.currentLevel) {
          await this.applyDegradation(rule);
        }
        break;
      }
    }
  }

  async applyDegradation(rule: DegradationRule): Promise<void> {
    console.log(`Applying degradation: ${rule.level}`);

    // 禁用功能
    for (const feature of rule.disabledFeatures) {
      if (feature === '*') {
        this.disableAllFeatures();
      } else {
        this.featureFlags.set(feature, false);
      }
    }

    // 应用降级能力
    this.applyReducedCapabilities(rule.reducedCapabilities);

    // 更新状态
    this.currentLevel = rule.level;

    // 发送通知
    await this.notifyDegradation(rule);
  }

  async recover(targetLevel: DegradationLevel): Promise<void> {
    console.log(`Recovering from ${this.currentLevel} to ${targetLevel}`);

    // 逐步恢复
    const levels = [DegradationLevel.MINIMAL, DegradationLevel.REDUCED, DegradationLevel.FULL];

    for (const level of levels) {
      if (level >= targetLevel) break;
      await this.recoverLevel(level);
    }

    this.currentLevel = targetLevel;
  }
}
```

---

## 5. 自愈工作流

### 5.1 自愈状态机

```typescript
// 自愈状态
enum HealingState {
  NORMAL = 'normal',             // 正常运行
  DETECTING = 'detecting',       // 检测中
  DIAGNOSING = 'diagnosing',     // 诊断中
  TREATING = 'treating',         // 治疗中
  RECOVERING = 'recovering',     // 恢复中
  ESCALATING = 'escalating',     // 升级中
  RESOLVED = 'resolved'          // 已解决
}

// 自愈事件
enum HealingEvent {
  ANOMALY_DETECTED = 'anomaly-detected',
  RCA_COMPLETE = 'rca-complete',
  STRATEGY_SELECTED = 'strategy-selected',
  RECOVERY_STARTED = 'recovery-started',
  RECOVERY_COMPLETE = 'recovery-complete',
  RECOVERY_FAILED = 'recovery-failed',
  VERIFICATION_COMPLETE = 'verification-complete',
  ESCALATION_COMPLETE = 'escalation-complete',
  TIMEOUT = 'timeout'
}

// 自愈上下文
interface HealingContext {
  failure: Failure;
  state: HealingState;
  rcaReport?: RCAReport;
  strategy?: RecoveryStrategy;
  executions: RecoveryExecution[];
  startTime: Date;
  timeout: number;
}

// 自愈状态机
const healingStateMachine: StateMachineConfig<HealingState, HealingEvent> = {
  initial: HealingState.NORMAL,

  states: {
    [HealingState.NORMAL]: {
      on: {
        ANOMALY_DETECTED: HealingState.DETECTING
      }
    },

    [HealingState.DETECTING]: {
      entry: ['collectEvidence', 'startTimer'],
      on: {
        RCA_COMPLETE: HealingState.DIAGNOSING,
        TIMEOUT: HealingState.ESCALATING
      }
    },

    [HealingState.DIAGNOSING]: {
      entry: ['analyzeRootCause', 'selectStrategy'],
      on: {
        STRATEGY_SELECTED: HealingState.TREATING,
        TIMEOUT: HealingState.ESCALATING
      }
    },

    [HealingState.TREATING]: {
      entry: ['executeRecovery', 'monitorProgress'],
      on: {
        RECOVERY_COMPLETE: HealingState.RECOVERING,
        RECOVERY_FAILED: HealingState.DIAGNOSING,  // 重试
        TIMEOUT: HealingState.ESCALATING
      }
    },

    [HealingState.RECOVERING]: {
      entry: ['verifyRecovery', 'validateHealth'],
      on: {
        VERIFICATION_COMPLETE: HealingState.RESOLVED,
        TIMEOUT: HealingState.ESCALATING
      }
    },

    [HealingState.ESCALATING]: {
      entry: ['notifyOncall', 'createIncident', 'preserveEvidence'],
      on: {
        ESCALATION_COMPLETE: HealingState.NORMAL  // 人工接管后回归正常
      }
    },

    [HealingState.RESOLVED]: {
      entry: ['logResolution', 'updateKnowledgeBase', 'celebrateRecovery'],
      on: {
        ANOMALY_DETECTED: HealingState.DETECTING
      }
    }
  }
};
```

### 5.2 自愈编排器

```typescript
// 自愈编排器
class HealingOrchestrator {
  private stateMachine: StateMachine;
  private context: HealingContext;
  private knowledgeBase: FailureKnowledgeBase;

  async heal(failure: Failure): Promise<HealingResult> {
    console.log(`Starting healing process for failure: ${failure.id}`);

    // 初始化上下文
    this.context = {
      failure,
      state: HealingState.NORMAL,
      executions: [],
      startTime: new Date(),
      timeout: 300000  // 5分钟超时
    };

    // 启动状态机
    this.stateMachine = new StateMachine(healingStateMachine, this.context);

    // 设置超时
    const timeoutHandle = setTimeout(() => {
      this.stateMachine.trigger(HealingEvent.TIMEOUT);
    }, this.context.timeout);

    try {
      // 执行自愈流程
      while (!this.isTerminalState(this.context.state)) {
        const event = await this.determineNextEvent();
        await this.stateMachine.trigger(event);

        // 根据状态执行相应动作
        await this.executeStateAction();
      }

      return this.buildResult();
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private async executeStateAction(): Promise<void> {
    switch (this.context.state) {
      case HealingState.DETECTING:
        // 收集证据
        await this.collectEvidence();
        break;

      case HealingState.DIAGNOSING:
        // 根因分析
        const rca = new RCACExecutor();
        this.context.rcaReport = await rca.analyze(this.context.failure);
        this.stateMachine.trigger(HealingEvent.RCA_COMPLETE);
        break;

      case HealingState.TREATING:
        // 选择并执行恢复策略
        const strategy = this.selectStrategy();
        const executor = new RecoveryExecutor();
        const result = await executor.execute(this.context.failure, strategy.type);
        this.context.executions.push(result);

        if (result.status === 'success') {
          this.stateMachine.trigger(HealingEvent.RECOVERY_COMPLETE);
        } else {
          this.stateMachine.trigger(HealingEvent.RECOVERY_FAILED);
        }
        break;

      case HealingState.RECOVERING:
        // 验证恢复
        const verified = await this.verifyRecovery();
        if (verified) {
          this.stateMachine.trigger(HealingEvent.VERIFICATION_COMPLETE);
        } else {
          this.stateMachine.trigger(HealingEvent.TIMEOUT);
        }
        break;

      case HealingState.ESCALATING:
        // 升级处理
        await this.escalate();
        this.stateMachine.trigger(HealingEvent.ESCALATION_COMPLETE);
        break;

      case HealingState.RESOLVED:
        // 更新知识库
        await this.updateKnowledgeBase();
        break;
    }
  }
}
```

### 5.3 故障知识库

```typescript
// 故障案例
interface FailureCase {
  id: string;
  symptom: string;
  rootCause: string;
  category: FailureCategory;
  resolution: string;
  strategies: RecoveryStrategy[];
  successRate: number;
  avgResolutionTime: number;
  createdAt: Date;
  tags: string[];
}

// 知识库操作
class FailureKnowledgeBase {
  private cases: FailureCase[] = [];

  async findSimilar(symptom: string): Promise<FailureCase[]> {
    // 基于症状相似度搜索
    const embeddings = await this.getEmbedding(symptom);
    return this.cases
      .map(c => ({
        case: c,
        similarity: cosineSimilarity(embeddings, c.embedding)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
      .map(r => r.case);
  }

  async addCase(
    failure: Failure,
    rca: RCAReport,
    strategy: RecoveryStrategy,
    success: boolean
  ): Promise<void> {
    const newCase: FailureCase = {
      id: uuid(),
      symptom: failure.symptom,
      rootCause: rca.rootCause,
      category: failure.category,
      resolution: rca.resolution.description,
      strategies: [strategy],
      successRate: success ? 1 : 0,
      avgResolutionTime: Date.now() - failure.timestamp.getTime(),
      createdAt: new Date(),
      tags: this.extractTags(failure)
    };

    // 更新已有案例或新增
    const existing = this.cases.find(c => c.rootCause === rca.rootCause);
    if (existing) {
      existing.successRate =
        (existing.successRate * existing.resolutions.length + (success ? 1 : 0)) /
        (existing.resolutions.length + 1);
      existing.resolutions.push(rca.resolution.description);
    } else {
      this.cases.push(newCase);
    }
  }

  async getRecommendedStrategy(
    category: FailureCategory,
    context: Record<string, unknown>
  ): Promise<RecoveryStrategy | null> {
    const relevantCases = this.cases
      .filter(c => c.category === category)
      .sort((a, b) => b.successRate - a.successRate);

    if (relevantCases.length === 0) return null;

    // 返回成功率最高的策略
    return relevantCases[0].strategies[0];
  }
}
```

---

## 6. 监控与告警集成

### 6.1 告警规则

```yaml
# Prometheus 告警规则
groups:
  - name: projectfactory-self-healing
    interval: 30s
    rules:
      # 自愈触发告警
      - alert: SelfHealingTriggered
        expr: healer_incidents_total > 0
        for: 0m
        labels:
          severity: warning
          category: self-healing
        annotations:
          summary: "自愈系统触发 ({{ $value }} 次)"
          description: "自愈系统已触发 {{ $value }} 次事件"

      # 自愈失败告警
      - alert: SelfHealingFailed
        expr: healer_recovery_failed_total > healer_recovery_success_total
        for: 5m
        labels:
          severity: critical
          category: self-healing
        annotations:
          summary: "自愈恢复失败"
          description: "自愈恢复失败次数超过成功次数"

      # 连续故障告警
      - alert: RecurringFailures
        expr: |
          increase(failure_total[1h]) > 10
        for: 5m
        labels:
          severity: warning
          category: reliability
        annotations:
          summary: "连续故障检测"
          description: "过去1小时发生 {{ $value }} 次故障"

      # 自愈超时告警
      - alert: SelfHealingTimeout
        expr: healer_recovery_duration_seconds > 300
        for: 0m
        labels:
          severity: critical
          category: self-healing
        annotations:
          summary: "自愈执行超时"
          description: "自愈执行超过5分钟仍未完成"
```

### 6.2 通知集成

```typescript
// 通知配置
const notificationConfig = {
  channels: {
    slack: {
      enabled: true,
      webhookUrl: process.env.SLACK_WEBHOOK,
      channels: {
        warning: '#alerts-warning',
        critical: '#alerts-critical',
        resolved: '#alerts-resolved'
      }
    },
    pagerduty: {
      enabled: true,
      apiKey: process.env.PAGERDUTY_API_KEY,
      serviceId: process.env.PAGERDUTY_SERVICE_ID,
      escalationPolicyId: process.env.PAGERDUTY_ESCALATION_POLICY
    },
    email: {
      enabled: true,
      smtp: {
        host: process.env.SMTP_HOST,
        port: 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      },
      recipients: {
        warning: ['team@example.com'],
        critical: ['oncall@example.com', 'lead@example.com'],
        resolved: ['team@example.com']
      }
    }
  },

  // 通知策略
  strategy: {
    // 告警聚合
    aggregation:
      window: '5m',
      maxAlerts: 10,

    // 静默规则
    silence:
      maintenanceWindow: '0 2-5 * * *',  # 凌晨2-5点
      holidays: ['2026-01-01', '2026-12-25']
  }
};
```

---

## 7. 演练与测试

### 7.1 混沌实验

```typescript
// 自愈混沌实验
const selfHealingExperiments: ChaosExperiment[] = [
  {
    name: 'kill-agent-process',
    description: '验证 Agent 进程异常恢复',
    action: {
      type: 'exec',
      command: 'kill -9 $(pgrep -f "agent-.*\\.js")'
    },
    expectations: {
      detectionTime: '< 10s',
      recoveryTime: '< 60s',
      recoveryStrategy: 'RESTART'
    }
  },
  {
    name: 'simulate-llm-timeout',
    description: '验证 LLM 超时处理',
    action: {
      type: 'delay',
      component: 'llm-provider',
      delay: 60000
    },
    expectations: {
      detectionTime: '< 30s',
      degradationLevel: 'REDUCED',
      recoveryStrategy: 'CIRCUIT_BREAK'
    }
  },
  {
    name: 'disk-space-exhaustion',
    description: '验证磁盘空间耗尽处理',
    action: {
      type: 'fill-disk',
      path: '/var/log',
      percentage: 95
    },
    expectations: {
      detectionTime: '< 60s',
      degradationLevel: 'MINIMAL',
      recoveryStrategy: 'GRACEFUL_DEGRADE'
    }
  },
  {
    name: 'database-connection-failure',
    description: '验证数据库连接失败恢复',
    action: {
      type: 'network',
      component: 'database',
      action: 'isolate'
    },
    expectations: {
      detectionTime: '< 10s',
      recoveryTime: '< 120s',
      recoveryStrategy: 'FAILOVER'
    }
  }
];
```

### 7.2 游戏日测试

```yaml
# 游戏日测试场景
game_day:
  name: "ProjectFactory Self-Healing Game Day"
  duration: "4 hours"
  participants:
    - name: "On-Call Engineer"
      role: "Observer & Escalation Path"
    - name: "SRE Team"
      role: "Monitor & Validate"

  scenarios:
    - phase: "Morning (9:00-10:30)"
      experiments:
        - name: "Single Component Failure"
          target: "IdeaGenerator Agent"
          expectedRecovery: "< 3 minutes"

    - phase: "Mid-Morning (10:30-12:00)"
      experiments:
        - name: "Cascading Failure"
          target: "Multiple Agents"
          expectedRecovery: "< 5 minutes"
          requiresHumanApproval: true

    - phase: "Afternoon (14:00-16:00)"
      experiments:
        - name: "Dependency Failure"
          target: "LLM Provider"
          expectedBehavior: "Graceful Degradation"

  success_criteria:
    detectionRate: "> 95%"
    falsePositiveRate: "< 5%"
    averageRecoveryTime: "< 5 minutes"
    customerImpact: "Zero"

  learnings:
    - category: "Detection"
      items:
        - "监控指标覆盖需加强"
        - "异常检测阈值需调整"
    - category: "Recovery"
      items:
        - "某些场景需要更多自动恢复选项"
        - "降级策略需简化"
```

---

## 8. 相关文档

- [监控与告警系统](./MONITORING_ALERTING.md)
- [错误处理与系统韧性](./ERROR_HANDLING_RESILIENCE.md)
- [容错与降级设计](./FAULT_TOLERANCE.md)
- [可观测性设计](./OBSERVABILITY.md)
- [故障排查指南](./17-troubleshooting.md)

---

**最后更新**: 2026-04-14
