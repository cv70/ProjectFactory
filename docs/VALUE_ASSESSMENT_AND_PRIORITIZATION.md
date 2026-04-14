# 价值评估与优先级系统

## 概述

价值评估（Value Assessment）是无限项目生成系统的核心决策引擎，负责评估每个生成想法的潜在价值、可行性和社会效益，从而指导生成队列的优先级排序。价值评估解决了think.md中提出的核心问题："生成10000个没人用的软件 ≠ 成功"。

## 核心价值

- **价值导向**：确保系统生成的是"有用"的软件，而非无意义产出
- **优先级排序**：基于价值而非单纯的新颖性排序生成任务
- **资源优化**：将计算资源分配给高价值项目
- **质量预测**：预测生成项目的潜在质量和影响力
- **组合优化**：发现组合创新的高价值机会

## 价值模型

### 多维价值评估

```typescript
// 价值维度
enum ValueDimension {
  // 实用性价值
  UTILITY = 'utility',           // 功能实用性

  // 商业价值
  COMMERCIAL = 'commercial',      // 商业变现潜力

  // 技术价值
  TECHNICAL = 'technical',        // 技术创新性

  // 社会价值
  SOCIAL = 'social',             // 社会效益

  // 教育价值
  EDUCATIONAL = 'educational',    // 学习参考价值

  // 生态价值
  ECOSYSTEM = 'ecosystem',       // 对生态系统的贡献
}

// 价值评分
interface ValueScore {
  // 各维度评分 (0-100)
  utility: number;
  commercial: number;
  technical: number;
  social: number;
  educational: number;
  ecosystem: number;

  // 综合评分 (加权平均)
  overall: number;

  // 置信度
  confidence: number;            // 0-1

  // 评估元数据
  metadata: {
    evaluatedAt: Date;
    evaluator: string;           // 'model' | 'human' | 'hybrid'
    factors: ValueFactor[];      // 影响因素
  };
}

interface ValueFactor {
  dimension: ValueDimension;
  factor: string;               // 因素名称
  impact: number;               // 影响值 (-1 to 1)
  evidence: string[];           // 支持证据
  weight: number;               // 权重
}
```

### 价值评估指标

```typescript
// 评估指标定义
interface ValueMetrics {
  // 实用性指标
  utility: {
    problemSeverity: number;       // 问题严重程度 (0-10)
    targetUserCount: number;      // 目标用户规模
    useCaseClarity: number;       // 用例清晰度 (0-1)
    solutionUniqueness: number;   // 解决方案独特性 (0-1)
    estimatedAdoptionRate: number; // 预估采用率 (0-1)
  };

  // 商业指标
  commercial: {
    marketSize: number;          // 市场规模 (百万美元)
    monetizationPotential: number; // 变现潜力 (0-10)
    competitiveAdvantage: number; // 竞争优势 (0-10)
    barriersToEntry: number;     // 进入壁垒 (0-10)
    recurringRevenuePotential: number; // 经常性收入潜力 (0-10)
  };

  // 技术指标
  technical: {
    innovationScore: number;     // 创新程度 (0-10)
    complexityHandling: number;   // 复杂度处理能力 (0-10)
    scalabilityScore: number;    // 可扩展性 (0-10)
    maintainabilityScore: number; // 可维护性 (0-10)
    reusabilityScore: number;    // 可复用性 (0-10)
  };

  // 社会影响指标
  social: {
    accessibilityScore: number;  // 可访问性 (0-10)
    privacyImpact: number;       // 隐私影响 (-10 to 10)
    environmentalImpact: number; // 环境影响 (-10 to 10)
    inclusivityScore: number;   // 包容性 (0-10)
    safetyScore: number;        // 安全性 (0-10)
  };

  // 教育价值指标
  educational: {
    learningValue: number;      // 学习价值 (0-10)
    documentationQuality: number; // 文档质量 (0-10)
    code readability: number;    // 代码可读性 (0-10)
    teachingApplicability: number; // 教学适用性 (0-10)
  };
}
```

### 综合价值计算

```typescript
// 价值计算器
class ValueCalculator {
  // 计算综合价值分
  calculateOverallScore(metrics: ValueMetrics): ValueScore {
    // 1. 计算各维度得分
    const utilityScore = this.computeUtilityScore(metrics.utility);
    const commercialScore = this.computeCommercialScore(metrics.commercial);
    const technicalScore = this.computeTechnicalScore(metrics.technical);
    const socialScore = this.computeSocialScore(metrics.social);
    const educationalScore = this.computeEducationalScore(metrics.educational);
    const ecosystemScore = this.computeEcosystemScore(metrics.ecosystem);

    // 2. 应用权重
    const weights = this.getDimensionWeights();
    const overall =
      utilityScore * weights.utility +
      commercialScore * weights.commercial +
      technicalScore * weights.technical +
      socialScore * weights.social +
      educationalScore * weights.educational +
      ecosystemScore * weights.ecosystem;

    // 3. 计算置信度
    const confidence = this.computeConfidence(metrics);

    return {
      utility: utilityScore,
      commercial: commercialScore,
      technical: technicalScore,
      social: socialScore,
      educational: educationalScore,
      ecosystem: ecosystemScore,
      overall,
      confidence,
      metadata: {
        evaluatedAt: new Date(),
        evaluator: 'model',
        factors: this.extractFactors(metrics),
      },
    };
  }

  // 实用性得分计算
  private computeUtilityScore(utility: ValueMetrics['utility']): number {
    return (
      utility.problemSeverity * 0.25 +
      this.normalizeUserCount(utility.targetUserCount) * 0.2 +
      utility.useCaseClarity * 0.2 +
      utility.solutionUniqueness * 0.15 +
      utility.estimatedAdoptionRate * 0.2
    ) * 10; // 转换为0-100
  }

  // 商业价值计算
  private computeCommercialScore(commercial: ValueMetrics['commercial']): number {
    return (
      this.normalizeMarketSize(commercial.marketSize) * 0.25 +
      commercial.monetizationPotential * 0.2 +
      commercial.competitiveAdvantage * 0.2 +
      commercial.barriersToEntry * 0.15 +
      commercial.recurringRevenuePotential * 0.2
    ) * 10;
  }

  // 技术创新性计算
  private computeTechnicalScore(technical: ValueMetrics['technical']): number {
    return (
      technical.innovationScore * 0.3 +
      technical.complexityHandling * 0.2 +
      technical.scalabilityScore * 0.15 +
      technical.maintainabilityScore * 0.2 +
      technical.reusabilityScore * 0.15
    ) * 10;
  }
}
```

## 想法评估引擎

### 评估流程

```typescript
// 想法评估请求
interface IdeaAssessmentRequest {
  idea: {
    title: string;
    description: string;
    problemStatement: string;
    proposedSolution: string;
    targetUsers: string[];
    useCases: UseCase[];
  };

  // 上下文
  context: {
    existingProjects: string[];   // 现有项目列表
    marketTrends: Trend[];        // 市场趋势
    technologyTrends: Trend[];    // 技术趋势
    competitiveProjects: Project[]; // 竞品项目
  };

  // 约束条件
  constraints?: {
    maxComplexity?: number;       // 最大复杂度
    requiredLicenses?: string[];   // 要求的许可证
    targetDomains?: string[];     // 目标领域
    resourceBudget?: ResourceSpec; // 资源预算
  };
}

interface UseCase {
  id: string;
  title: string;
  description: string;
  userPersona: string;
  expectedOutcome: string;
  successCriteria: string[];
}

// 想法评估结果
interface IdeaAssessment {
  ideaId: string;

  // 价值评估
  valueScore: ValueScore;

  // 可行性评估
  feasibility: FeasibilityScore;

  // 风险评估
  riskAssessment: RiskAssessment;

  // 优先级
  priority: PriorityLevel;

  // 生成建议
  generationRecommendations: GenerationRecommendation[];

  // 拒绝理由（如果不通过）
  rejectionReasons?: string[];

  metadata: {
    assessedAt: Date;
    assessor: string;
    processingTimeMs: number;
  };
}

interface FeasibilityScore {
  technicalFeasibility: number;   // 技术可行性 (0-100)
  resourceFeasibility: number;    // 资源可行性 (0-100)
  timelineFeasibility: number;    // 时间可行性 (0-100)
  overall: number;                // 综合可行性 (0-100)
  blockers: string[];             // 阻碍因素
}

interface RiskAssessment {
  technicalRisks: Risk[];
  businessRisks: Risk[];
  complianceRisks: Risk[];
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface Risk {
  category: string;
  description: string;
  likelihood: number;           // 0-1
  impact: number;                // 0-10
  mitigation: string;
}

enum PriorityLevel {
  P0 = 'P0',  // 必须生成 (价值极高)
  P1 = 'P1',  // 应该生成 (价值较高)
  P2 = 'P2',  // 可以生成 (价值一般)
  P3 = 'P3',  // 延后生成 (价值较低)
  REJECTED = 'rejected',         // 拒绝生成
}
```

### 评估Agent

```typescript
// 评估Agent
class AssessmentAgent {
  name = 'AssessmentAgent';
  llm: ChatOpenAI;

  // 评估想法
  async assess(request: IdeaAssessmentRequest): Promise<IdeaAssessment> {
    const startTime = Date.now();

    // 1. 理解想法
    const idea = await this.parseIdea(request.idea);

    // 2. 收集上下文
    const context = await this.collectContext(request.context);

    // 3. 评估价值
    const valueScore = await this.evaluateValue(idea, context);

    // 4. 评估可行性
    const feasibility = await this.evaluateFeasibility(idea, context);

    // 5. 评估风险
    const riskAssessment = await this.evaluateRisks(idea, context);

    // 6. 确定优先级
    const priority = this.determinePriority(valueScore, feasibility, riskAssessment);

    // 7. 生成建议
    const recommendations = await this.generateRecommendations(
      idea,
      valueScore,
      feasibility
    );

    // 8. 决定是否拒绝
    const rejectionReasons = this.evaluateRejections(
      valueScore,
      feasibility,
      riskAssessment
    );

    return {
      ideaId: this.generateId(request.idea),
      valueScore,
      feasibility,
      riskAssessment,
      priority,
      generationRecommendations: recommendations,
      rejectionReasons,
      metadata: {
        assessedAt: new Date(),
        assessor: this.name,
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  // 价值评估提示
  private getValueEvaluationPrompt(
    idea: ParsedIdea,
    context: AssessmentContext
  ): string {
    return `
你是价值评估专家。请评估以下想法的多维价值：

想法：
- 标题：${idea.title}
- 描述：${idea.description}
- 问题陈述：${idea.problemStatement}
- 解决方案：${idea.proposedSolution}
- 目标用户：${idea.targetUsers.join(', ')}

现有项目分析：
${context.existingProjectsSummary}

市场趋势：
${context.marketTrendsSummary}

请从以下维度评估（0-100分）：
1. 实用性 - 功能对用户的实际帮助程度
2. 商业价值 - 变现潜力、市场规模
3. 技术价值 - 创新性、复杂性处理
4. 社会价值 - 对社会的正面影响
5. 教育价值 - 对学习的帮助
6. 生态价值 - 对生态系统的贡献

请提供各维度评分及支持证据。
`;
  }
}
```

## 优先级队列

### 优先级计算

```typescript
// 优先级计算器
class PriorityCalculator {
  // 计算最终优先级
  calculatePriority(
    valueScore: ValueScore,
    feasibility: FeasibilityScore,
    riskAssessment: RiskAssessment,
    constraints?: PriorityConstraints
  ): PriorityLevel {
    // 1. 基础优先级
    let priority = this.computeBasePriority(valueScore);

    // 2. 调整可行性
    if (feasibility.overall < 30) {
      priority = this.lowerPriority(priority, 2);
    } else if (feasibility.overall < 50) {
      priority = this.lowerPriority(priority, 1);
    }

    // 3. 调整风险
    if (riskAssessment.overallRiskLevel === 'critical') {
      priority = PriorityLevel.REJECTED;
    } else if (riskAssessment.overallRiskLevel === 'high') {
      priority = this.lowerPriority(priority, 2);
    }

    // 4. 应用约束
    if (constraints) {
      priority = this.applyConstraints(priority, constraints);
    }

    // 5. 考虑资源效率
    priority = this.adjustForResourceEfficiency(priority, valueScore, feasibility);

    return priority;
  }

  // 资源效率调整
  private adjustForResourceEfficiency(
    priority: PriorityLevel,
    valueScore: ValueScore,
    feasibility: FeasibilityScore
  ): PriorityLevel {
    // 高价值/低资源 = 提升优先级
    // 低价值/高资源 = 降低优先级
    const efficiency = valueScore.overall / feasibility.overall;

    if (efficiency > 3 && priority !== PriorityLevel.P0) {
      return this.raisePriority(priority, 1);
    } else if (efficiency < 0.5) {
      return this.lowerPriority(priority, 1);
    }

    return priority;
  }
}
```

### 优先级队列管理

```typescript
// 优先级队列
class PriorityQueue {
  private queues: Map<PriorityLevel, IdeaQueue>;

  // 入队
  enqueue(assessment: IdeaAssessment): void {
    const priority = assessment.priority;

    if (priority === PriorityLevel.REJECTED) {
      this.handleRejected(assessment);
      return;
    }

    const queue = this.queues.get(priority);
    queue.enqueue({
      assessment,
      insertedAt: new Date(),
      waitTime: 0,
    });

    // 更新指标
    this.metrics.recordEnqueue(priority);
  }

  // 出队（获取下一个要生成的任务）
  dequeue(resourceSpec: ResourceSpec): QueuedIdea | null {
    // 按优先级从高到低尝试
    for (const priority of PRIORITY_ORDER) {
      const queue = this.queues.get(priority);

      // 找到匹配资源的任务
      const idea = queue.findMatching(spec => this.matchesResource(spec, resourceSpec));
      if (idea) {
        queue.dequeue(idea.id);
        this.metrics.recordDequeue(priority);
        return idea;
      }
    }

    return null;
  }

  // 批量出队
  dequeueBatch(resourceSpecs: ResourceSpec[], batchSize: number): QueuedIdea[] {
    const results: QueuedIdea[] = [];

    for (let i = 0; i < batchSize; i++) {
      const spec = resourceSpecs[i % resourceSpecs.length];
      const idea = this.dequeue(spec);
      if (idea) {
        results.push(idea);
      }
    }

    return results;
  }

  // 获取队列状态
  getQueueStatus(): QueueStatus {
    const status: QueueStatus = {
      totalPending: 0,
      byPriority: {},
      averageWaitTime: 0,
    };

    for (const [priority, queue] of this.queues) {
      status.byPriority[priority] = queue.length();
      status.totalPending += queue.length();
    }

    return status;
  }
}

// 优先级顺序
const PRIORITY_ORDER: PriorityLevel[] = [
  PriorityLevel.P0,
  PriorityLevel.P1,
  PriorityLevel.P2,
  PriorityLevel.P3,
];
```

## 价值预测模型

### 生成后价值预测

```typescript
// 价值预测模型
class ValuePredictionModel {
  // 预测生成后的实际价值
  async predictActualValue(projectId: string): Promise<PredictedValue> {
    // 1. 获取项目元数据
    const metadata = await this.getProjectMetadata(projectId);

    // 2. 收集使用数据
    const usageData = await this.collectUsageData(projectId);

    // 3. 分析用户反馈
    const feedback = await this.analyzeFeedback(projectId);

    // 4. 计算预测值
    return {
      predictedDownloads: this.predictDownloads(metadata, usageData),
      predictedRating: this.predictRating(feedback),
      predictedEngagement: this.predictEngagement(usageData),
      predictedRevenue: this.predictRevenue(metadata, usageData),
      confidence: this.computePredictionConfidence(usageData),
    };
  }

  // 下载量预测
  private predictDownloads(
    metadata: ProjectMetadata,
    usageData: UsageData
  ): Prediction {
    const features = this.extractFeatures(metadata, usageData);

    // 使用回归模型预测
    const basePrediction = this.regressionModel.predict(features);

    // 应用时间衰减
    const timeDecay = this.computeTimeDecay(usageData.firstPublishedAt);

    return {
      value: Math.round(basePrediction * timeDecay),
      confidence: this.computeFeatureConfidence(features),
      range: {
        min: Math.round(basePrediction * 0.7),
        max: Math.round(basePrediction * 1.3),
      },
    };
  }
}

interface PredictedValue {
  predictedDownloads: Prediction;
  predictedRating: Prediction;
  predictedEngagement: Prediction;
  predictedRevenue: Prediction;
  confidence: number;
}

interface Prediction {
  value: number;
  confidence: number;
  range: { min: number; max: number };
}
```

## 组合创新发现

### 组合机会识别

```typescript
// 组合创新引擎
class CombinatorialInnovationEngine {
  // 发现组合创新机会
  async discoverOpportunities(
    existingProjects: Project[]
  ): Promise<CombinatorialOpportunity[]> {
    // 1. 分析现有项目的能力
    const capabilities = await this.analyzeCapabilities(existingProjects);

    // 2. 识别能力组合
    const combinations = this.generateCombinations(capabilities);

    // 3. 评估组合价值
    const evaluated = await this.evaluateCombinations(combinations);

    // 4. 排序和过滤
    return evaluated
      .filter(c => c.valueScore.overall > 60)
      .sort((a, b) => b.valueScore.overall - a.valueScore.overall)
      .slice(0, 100);
  }

  // 组合评估
  private async evaluateCombinations(
    combinations: CapabilityCombination[]
  ): Promise<EvaluatedCombination[]> {
    return Promise.all(
      combinations.map(async combo => {
        const idea = this.synthesizeIdea(combo);
        const assessment = await this.assessmentAgent.assess({
          idea,
          context: { existingProjects: [] },
        });

        return {
          combination: combo,
          idea,
          valueScore: assessment.valueScore,
          feasibility: assessment.feasibility,
        };
      })
    );
  }

  // 想法综合
  private synthesizeIdea(combo: CapabilityCombination): SynthesizedIdea {
    return {
      title: `Combined: ${combo.capabilities.map(c => c.name).join(' + ')}`,
      description: `A novel solution combining ${combo.capabilities.length} capabilities`,
      problemStatement: combo.synergisticProblem,
      proposedSolution: combo.synergisticSolution,
      targetUsers: combo.unifiedTargetUsers,
      innovationType: 'combinatorial',
      parentProjects: combo.capabilities.map(c => c.projectId),
    };
  }
}

interface CombinatorialOpportunity {
  id: string;
  capabilities: CapabilityReference[];
  idea: SynthesizedIdea;
  valueScore: ValueScore;
  synergyLevel: number;         // 协同效应程度
  noveltyScore: number;          // 新颖性评分
  implementationEffort: number; // 实现难度 (1-10)
}
```

## 决策支持仪表盘

### 实时指标

```typescript
// 评估系统仪表盘
interface AssessmentDashboard {
  // 实时统计
  stats: {
    ideasAssessed: number;       // 已评估想法数
    ideasGenerated: number;      // 已生成项目数
    avgAssessmentTime: number;   // 平均评估时间(ms)
    approvalRate: number;         // 通过率
    rejectionRate: number;        // 拒绝率
  };

  // 优先级分布
  priorityDistribution: Record<PriorityLevel, number>;

  // 价值分布
  valueDistribution: {
    avgOverallScore: number;
    medianOverallScore: number;
    topDimensionScores: Record<ValueDimension, number>;
  };

  // 趋势
  trends: {
    dailyAssessmentVolume: TimeSeries;
    dailyApprovalRate: TimeSeries;
    avgValueScoreTrend: TimeSeries;
  };

  // 预测准确性
  predictionAccuracy?: {
    downloadPredictionAccuracy: number;
    ratingPredictionAccuracy: number;
  };
}
```

## 配置示例

```yaml
# 价值评估配置
value_assessment:
  # 评估模型
  model:
    provider: "openai"
    model: "gpt-4"
    temperature: 0.3
    max_tokens: 2000

  # 价值维度权重
  dimension_weights:
    utility: 0.25
    commercial: 0.20
    technical: 0.15
    social: 0.15
    educational: 0.15
    ecosystem: 0.10

  # 优先级阈值
  priority_thresholds:
    P0: 90    # >= 90
    P1: 75    # >= 75
    P2: 50    # >= 50
    P3: 30    # >= 30
    rejected: 0  # < 30

  # 可行性要求
  feasibility_requirements:
    min_technical_feasibility: 40
    min_resource_feasibility: 50
    max_blockers: 2

  # 风险容忍度
  risk_tolerance:
    max_risk_level: "high"  # 不允许critical风险
    auto_reject_on_critical: true

  # 评估限制
  limits:
    max_ideas_per_day: 1000
    max_assessment_time_ms: 5000
    max_context_projects: 50

  # 缓存配置
  cache:
    assessment_result_ttl: "1h"
    value_score_ttl: "24h"
```

## 最佳实践

### 评估质量保证

```typescript
const ASSESSMENT_QUALITY = {
  // 多角度评估
  multi_perspective: {
    enabled: true,
    perspectives: [
      'user_view',      // 用户视角
      'developer_view', // 开发者视角
      'business_view',  // 商业视角
      'society_view',  // 社会视角
    ],
    aggregate_method: 'weighted_average',
  },

  // 置信度校准
  confidence_calibration: {
    enabled: true,
    recalibrate_after_n_predictions: 100,
    target_accuracy: 0.85,
  },

  // 人类审核
  human_review: {
    enabled: true,
    threshold_for_review: 80,  # 价值分>=80需要人工审核
    sample_rate: 0.1,         # 随机抽样10%审核
    expert_panel: true,
  },

  // 偏见检测
  bias_detection: {
    enabled: true,
    check_dimensions: [
      'gender_bias',
      'cultural_bias',
      'economic_bias',
    ],
    auto_correct: true,
  },
};
```

---

**最后更新**: 2026-04-14
