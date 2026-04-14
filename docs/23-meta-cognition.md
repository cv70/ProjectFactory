# 元认知系统架构设计 (Meta-Cognition System)

**版本**: 1.0.0 | **状态**: 设计阶段

## 1. 设计理念与概述

元认知（Meta-Cognition）系统的核心是赋予AI系统“**思考自己的思考**”的能力。通过构建闭环的认知架构，系统能够从历史经验中自我进化。本系统具备四大核心能力：

1. **自我感知与评估 (Awareness & Evaluation)**：感知当前状态、资源、能力边界，并评估输出质量。
2. **自我反思与诊断 (Reflection & Diagnosis)**：分析成功模式与失败根因，进行深度归因。
3. **自我改进 (Improvement)**：基于反思结果，动态调整Prompt、工作流和Agent策略。
4. **自我预测与学习 (Prediction & Learning)**：预测任务难度，沉淀元知识，实现跨项目知识迁移。

## 2. 系统架构蓝图

系统采用分层闭环架构，从数据采集到策略应用形成完整的反馈流：

```text
┌───────────────────────────────────────────────────────────────────────┐
│                       Meta-Cognition System                           │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐         │
│  │  自我感知与评估 │   │  自我反思与诊断 │   │   自我改进器   │         │
│  │ (Observer &    │──▶│ (Diagnoser &   │──▶│ (Improver)     │         │
│  │  Evaluator)    │   │  Analyzer)     │   │                │         │
│  └────────────────┘   └────────────────┘   └────────────────┘         │
│          ▲                    │                    │                  │
│          │                    ▼                    ▼                  │
│          │            ┌─────────────────────────────────────┐         │
│          └────────────│         元学习与预测引擎            │         │
│                       │ (Meta-Learning & Prediction Engine) │         │
│                       └─────────────────────────────────────┘         │
│                                  │                                    │
├──────────────────────────────────┼────────────────────────────────────┤
│                                  ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    元知识库 (Meta-Knowledge Base)               │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 3. 核心层级设计

### 3.1 第一层：自我感知与评估 (Self-Awareness & Evaluation)
**职责**：理解系统当前状态，评估产出质量，捕捉异常。

```typescript
// backend/src/meta-cognition/awareness/

// 1. 系统能力与状态感知
interface StateObserver {
  takeSnapshot(): Promise<SystemSnapshot>;
  detectAnomalies(): Promise<Anomaly[]>;    // 检测资源、成功率、耗时等异常
  buildContext(): Promise<SystemContext>;   // 构建时间、负载、任务和知识上下文
}

interface CapabilityMetrics {
  projectGeneration: { successRate: number; avgDuration: number; };
  agentPerformance: Record<string, AgentMetrics>;
  resources: { memory: number; cpu: number; apiQuota: number; };
}

// 2. 产出质量评估
interface SelfEvaluator {
  evaluateIdea(idea: Idea): Promise<QualityAssessment>;
  evaluateCode(code: GeneratedCode): Promise<CodeQualityAssessment>;
}

interface QualityAssessment {
  uniqueness: number;      // 独创性 0-1
  feasibility: number;     // 可行性 0-1
  confidence: number;      // 评估置信度 0-1
  overall: number;         // 综合评分
}
```

### 3.2 第二层：自我反思与诊断 (Self-Reflection & Diagnosis)
**职责**：对成功经验进行模式提取，对失败案例进行根因分析。

```typescript
// backend/src/meta-cognition/reflection/

// 1. 失败分析与诊断
interface SelfDiagnoser {
  diagnoseFailure(failure: ExecutionFailure): Promise<Diagnosis>;
  identifyFailurePatterns(projects: Project[]): Promise<FailurePattern[]>;
}

interface Diagnosis {
  rootCause: RootCause;           // 根因 (如: 算力限制, 上下文不足, 依赖冲突等)
  confidence: number;             // 诊断置信度
  suggestedActions: Action[];     // 建议动作 (重试, 降级, 调整Prompt等)
  relatedPatterns: Pattern[];     // 关联的历史模式
}

// 2. 成功分析与决策回顾
interface SuccessAnalyzer {
  analyzeSuccesses(projects: Project[]): Promise<SuccessPattern[]>;
  extractSuccessFactors(project: Project): Promise<SuccessFactor[]>;
}

interface DecisionReviewer {
  reviewDecisions(project: Project): Promise<DecisionReview[]>; // 评估AI历史决策质量
}
```

### 3.3 第三层：自我改进 (Self-Improvement)
**职责**：识别改进机会，生成并执行调整策略（含A/B测试）。

```typescript
// backend/src/meta-cognition/improvement/

interface SelfImprover {
  // 识别改进点
  identifyImprovements(snapshot: SystemSnapshot): Promise<ImprovementOpportunity[]>;
  
  // 生成与应用调整策略
  generateStrategyAdjustment(diagnosis: Diagnosis): Promise<StrategyAdjustment>;
  applyAdjustment(adjustment: StrategyAdjustment): Promise<void>;
  
  // A/B测试改进效果
  testImprovement(improvement: ImprovementOpportunity): Promise<ABTestResult>;
}

interface StrategyAdjustment {
  targetAgent: string;
  parameterAdjustments: { param: string; newValue: unknown; reason: string }[];
  promptAdjustments: { type: 'add_context' | 'refine_constraint'; content: string }[];
  workflowAdjustments: { type: 'change_order' | 'add_review'; details: unknown }[];
}
```

### 3.4 第四层：元学习与预测 (Meta-Learning & Prediction)
**职责**：从历史经验中持续学习，更新知识库，预测未来状态。

```typescript
// backend/src/meta-cognition/learning/

interface MetaLearningEngine {
  // 经验沉淀
  recordExperience(experience: Experience): Promise<void>;
  updateKnowledgeBase(learnings: ExtractedKnowledge[]): Promise<void>;
  
  // 预测能力
  predictOptimalStrategy(context: ExecutionContext): Promise<StrategyPrediction>;
  predictSystemState(horizon: number): Promise<PredictedState>; // 预测负载与资源
}
```

---

## 4. 元知识库设计 (Meta-Knowledge Base)

系统沉淀的知识是元认知运作的基础。

### 4.1 知识分类体系

| 知识类别 | 具体内容 | 来源与用途 |
|---------|---------|----------|
| **策略知识** | 参数调优经验、Prompt优化模板、工作流调整规则 | 来源于自适应学习，用于改进Agent性能 |
| **模式知识** | 成功架构模式、高频失败模式、防坑反模式(Anti-pattern) | 来源于成功/失败分析，用于前置预测和诊断 |
| **诊断知识** | 错误码映射、症状关联图谱、根因推理树 | 来源于历史诊断记录，用于加速问题定位 |

### 4.2 数据存储设计 (SQLite 示例)

```sql
CREATE TABLE meta_knowledge (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,         -- strategy, pattern, diagnosis
  type TEXT NOT NULL,             -- SUCCESS_PATTERN, PROMPT_OPTIMIZATION等
  content TEXT NOT NULL,          -- JSON格式的具体知识内容
  source TEXT NOT NULL,           -- experience, manual, aggregation
  confidence REAL NOT NULL,       -- 置信度 0-1
  success_rate REAL DEFAULT 1.0,  -- 采纳该知识后的成功率
  usage_count INTEGER DEFAULT 0,  -- 被调用次数
  created_at INTEGER NOT NULL,
  last_used INTEGER,
  validity_period INTEGER         -- 有效期（过期需重新验证）
);

CREATE INDEX idx_knowledge_type ON meta_knowledge(type);
CREATE INDEX idx_knowledge_confidence ON meta_knowledge(confidence);
```

---

## 5. 系统运行机制 (Feedback Loops)

### 5.1 实时阻断与恢复循环 (短循环)
针对单次任务执行的即时纠偏：
`Agent执行 -> Evaluator发现质量未达标 -> Diagnoser定位根因 -> Improver动态降级/调整参数 -> Agent重试`

### 5.2 周期性演进循环 (长循环)
针对系统整体能力的异步提升（如每日/每周运行）：
`提取近期项目日志 -> Success/Failure Analyzer挖掘新模式 -> Meta-Learning Engine聚合泛化 -> 更新SQLite知识库 -> 更新全局基础Prompt和路由策略`

### 5.3 改进效果验证机制 (A/B Testing)
任何重大策略调整（如修改底层Agent的System Prompt），均需经过 `Improver.testImprovement()`：
1. 选取部分任务进入实验组（Treatment Group）。
2. 对比控制组（Control Group）的成功率、耗时、Token消耗。
3. 若效果显著提升，则全量固化到 `meta_knowledge` 中。

---

## 6. 元能力评估矩阵 (Meta-Capability Matrix)

系统内置定期对“自身认知能力”的打分机制：

| 元能力维度 | 描述 | 评估指标 | 依赖链 |
|-----------|------|---------|--------|
| **自我感知** | 理解自身状态和能力边界的精准度 | 异常漏报率、状态预测准确率 | 无 |
| **自我反思** | 分析成功/失败原因的深刻度 | 根因命中率、模式提取数量 | 依赖自我感知 |
| **自我改进** | 基于反思结果改进自身的有效性 | 策略调整成功率、A/B测试胜率 | 依赖自我反思 |
| **知识吸收** | 从经验中获取新知识的泛化能力 | 跨项目迁移成功率、知识使用频次 | 依赖自我反思 |

---

## 7. 实施演进路线 (Roadmap)

### Phase 1: 基础观测与规则诊断 (高优先级)
* 实现 `Self-Evaluator`：基于规则和简单LLM Prompt对代码和创意进行打分。
* 实现 `StateObserver`：监控Token消耗、成功率和内存。
* 搭建 SQLite 知识库骨架，手动录入基础防御规则。

### Phase 2: 自动化诊断与局部调优 (中优先级)
* 实现 `Self-Diagnoser`：针对常见构建错误、语法错误进行自动化归因。
* 实现 `Self-Improver`：支持运行时动态调整 `temperature`、截断上下文和触发重试机制。
* 建立失败案例日志采集机制。

### Phase 3: 全局模式挖掘与自进化 (低优先级)
* 实现 `Success/Failure Analyzer`：异步挖掘长尾模式。
* 引入 A/B 测试框架，实现 Prompt 的自动化演进。
* 实现完整的元能力评估矩阵，自动生成系统健康度报告。

---

## 8. 风险预案

| 潜在风险 | 影响描述 | 缓解策略 (Mitigation) |
|---------|---------|--------------------|
| **知识污染** | 系统学习了偶发性的错误模式，导致后续决策全部带偏。 | 引入“置信度衰减”机制；新模式需经过A/B测试验证；提供人工审核接口清理脏知识。 |
| **过度优化(震荡)** | 策略调整过于频繁，陷入局部最优或性能震荡。 | 设置策略调整冷却期(Cooldown)；控制最大调整步长；保持“探索-利用(Explore-Exploit)”平衡。 |
| **元认知死循环** | 评估器或诊断器自身出错，引发无限重试或无限反思。 | 设置硬性的反思次数上限(Max_Reflection_Depth)；引入超时熔断机制。 |
| **算力与成本消耗** | “思考自己的思考”需消耗大量额外的LLM Token。 | 对元认知任务使用轻量级模型(如GPT-4o-mini/Claude-3-Haiku)；仅在任务失败或定期复盘时触发深度反思。 |