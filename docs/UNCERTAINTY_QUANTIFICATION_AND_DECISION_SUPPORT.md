# 不确定性量化与决策支持系统

## 概述

不确定性量化与决策支持系统（Uncertainty Quantification & Decision Support System）是 ProjectFactory 系统的人机协作核心组件，负责在生成过程中识别、量化、呈现不确定性，并在关键决策点为人类提供清晰的选项和建议，实现 AI 能力与人类判断的最佳结合。

## 核心价值

- **透明决策**：让用户理解决策背后的逻辑和置信度
- **风险可控**：在不确定领域引入人工判断，避免盲目信任
- **效率与质量的平衡**：AI 处理确定性高的问题，人类处理不确定性高的问题
- **持续学习**：从人工决策中学习，改进系统的不确定性估计

## 不确定性模型

### 不确定性分类

```typescript
// 不确定性类型
enum UncertaintyType {
  // 输入不确定性：需求描述模糊或不完整
  INPUT = 'input',

  // 知识不确定性：缺乏相关领域的知识
  KNOWLEDGE = 'knowledge',

  // 模型不确定性：模型能力边界
  MODEL = 'model',

  // 随机不确定性：固有的随机性
  ALEATORY = 'aleatory',

  // 认知不确定性：知识边界
  EPISTEMIC = 'epistemic',
}

// 不确定性级别
enum UncertaintyLevel {
  LOW = 'low',           // 0-25% 不确定
  MEDIUM = 'medium',     // 25-50% 不确定
  HIGH = 'high',         // 50-75% 不确定
  VERY_HIGH = 'very_high', // 75-100% 不确定
}

// 不确定性量化
interface UncertaintyQuantification {
  type: UncertaintyType;
  level: UncertaintyLevel;

  // 数值表示（0-1，1 表示完全不确定）
  probability: number;

  // 置信区间
  confidenceInterval?: {
    lower: number;
    upper: number;
    confidence: number;  // 如 0.95 表示 95% 置信区间
  };

  // 备选方案数量
  alternativesCount: number;

  // 相关证据
  evidence: {
    supporting: string[];   // 支持某结论的证据
    contradicting: string[]; // 反对的证据
  };
}
```

### 不确定性上下文

```typescript
// 生成阶段的不确定性
interface GenerationUncertainty {
  // 需求理解不确定性
  requirementUnderstanding: UncertaintyQuantification;

  // 技术选型不确定性
  technologyChoice: UncertaintyQuantification;

  // 实现方案不确定性
  implementationApproach: UncertaintyQuantification;

  // 质量估计不确定性
  qualityEstimation: UncertaintyQuantification;

  // 时间估算不确定性
  effortEstimation: UncertaintyQuantification;
}

// 决策点
interface DecisionPoint {
  id: string;
  stage: DevelopmentStage;

  // 决策问题
  question: string;
  description: string;

  // 选项
  options: DecisionOption[];

  // 当前选择（如果已有）
  selectedOption?: string;
  selectedBy?: 'ai' | 'human';

  // 决策依据
  rationale?: string;

  // 不确定性信息
  uncertainty: UncertaintyQuantification;

  // 影响评估
  impact: {
    quality: number;       // 对质量的影响（-10 到 +10）
    effort: number;        // 对工作量影响（天）
    risk: number;         // 对风险的影响（0-1）
  };
}

interface DecisionOption {
  id: string;
  label: string;
  description: string;

  // 预期结果
  expectedOutcome: {
    quality: number;       // 预期质量（0-100）
    effort: number;        // 预期工作量（天）
    risk: number;         // 预期风险（0-1）
  };

  // AI 推荐度（0-1）
  aiRecommendation: number;

  // 是否需要人工确认
  requiresHumanApproval: boolean;
}
```

## 不确定性检测

### 多阶段检测

```typescript
// 不确定性检测器
class UncertaintyDetector {
  // 检测需求不确定性
  async detectRequirementUncertainty(
    requirement: string
  ): Promise<UncertaintyQuantification> {
    const signals = await this.analyzeRequirementSignals(requirement);

    return {
      type: UncertaintyType.INPUT,
      level: this.assessLevel(signals.ambiguityScore),
      probability: signals.ambiguityScore,
      confidenceInterval: signals.confidenceInterval,
      alternativesCount: signals.possibleInterpretations.length,
      evidence: {
        supporting: signals.supportingEvidence,
        contradicting: signals.contradictingEvidence,
      },
    };
  }

  // 分析需求信号
  private async analyzeRequirementSignals(
    requirement: string
  ): Promise<RequirementAnalysis> {
    // 1. 模糊性检测
    const ambiguityScore = await this.detectAmbiguity(requirement);

    // 2. 完整性检测
    const completenessScore = await this.detectCompleteness(requirement);

    // 3. 一致性检测
    const consistencyScore = await this.detectConsistency(requirement);

    // 4. 可能解释
    const possibleInterpretations = await this.generateInterpretations(requirement);

    return {
      ambiguityScore: this.weightedAverage([
        { score: ambiguityScore, weight: 0.4 },
        { score: 1 - completenessScore, weight: 0.3 },
        { score: 1 - consistencyScore, weight: 0.3 },
      ]),
      confidenceInterval: this.calculateConfidenceInterval(possibleInterpretations),
      possibleInterpretations,
      supportingEvidence: this.findSupportingEvidence(requirement),
      contradictingEvidence: this.findContradictingEvidence(requirement),
    };
  }

  // 模糊性检测
  private async detectAmbiguity(text: string): Promise<number> {
    // 检测模糊词汇
    const vagueWords = [
      '可能', '也许', '大约', '差不多',
      '快速', '高效', '优化', '增强',
      '用户友好', '易于使用', '高性能',
    ];

    const vagueCount = vagueWords.filter(w => text.includes(w)).length;
    return Math.min(vagueCount / 5, 1); // 归一化到 0-1
  }

  // 完整性检测
  private async detectCompleteness(text: string): Promise<number> {
    // 检查必要的组成部分
    const requiredParts = [
      { pattern: /用户|角色|使用者/, weight: 0.2 },
      { pattern: /功能|行为|操作/, weight: 0.3 },
      { pattern: /输入|数据|信息/, weight: 0.2 },
      { pattern: /输出|结果|响应/, weight: 0.2 },
      { pattern: /边界|限制|条件/, weight: 0.1 },
    ];

    let score = 0;
    for (const part of requiredParts) {
      if (part.pattern.test(text)) score += part.weight;
    }

    return score;
  }
}
```

### 知识不确定性检测

```typescript
// 知识不确定性检测
class KnowledgeUncertaintyDetector {
  private knowledgeGraph: KnowledgeGraph;
  private modelCapabilities: ModelCapabilities;

  async detectKnowledgeUncertainty(
    domain: string,
    question: string
  ): Promise<UncertaintyQuantification> {
    // 1. 检查知识库覆盖
    const coverage = await this.knowledgeGraph.getCoverage(domain);

    // 2. 检查模型能力
    const capabilityScore = await this.modelCapabilities.assess(question);

    // 3. 检测知识冲突
    const conflicts = await this.knowledgeGraph.detectConflicts(question);

    // 4. 评估时效性
    const freshness = await this.knowledgeGraph.getFreshness(domain);

    const uncertainty = 1 - (coverage * 0.3 + capabilityScore * 0.3 + freshness * 0.2 + (1 - conflicts.length * 0.1) * 0.2);

    return {
      type: UncertaintyType.KNOWLEDGE,
      level: this.assessLevel(uncertainty),
      probability: uncertainty,
      confidenceInterval: {
        lower: Math.max(0, uncertainty - 0.1),
        upper: Math.min(1, uncertainty + 0.1),
        confidence: 0.8,
      },
      alternativesCount: conflicts.length + 1,
      evidence: {
        supporting: coverage > 0.8 ? [`知识库覆盖度: ${(coverage * 100).toFixed(1)}%`] : [],
        contradicting: conflicts.map(c => \`知识冲突: \${c.description}\`),
      },
    };
  }
}
```

## 决策支持界面

### 决策卡片组件

```typescript
// 决策卡片属性
interface DecisionCardProps {
  decision: DecisionPoint;
  onSelect: (optionId: string, rationale?: string) => void;
  onSkip: () => void;
}

// 决策卡片渲染
const DecisionCard: React.FC<DecisionCardProps> = ({ decision, onSelect, onSkip }) => {
  return (
    <div className="decision-card">
      {/* 头部信息 */}
      <div className="decision-header">
        <span className="decision-stage">{decision.stage}</span>
        <UncertaintyBadge level={decision.uncertainty.level} />
      </div>

      {/* 问题描述 */}
      <h3 className="decision-question">{decision.question}</h3>
      <p className="decision-description">{decision.description}</p>

      {/* 不确定性说明 */}
      <UncertaintyPanel uncertainty={decision.uncertainty} />

      {/* 选项列表 */}
      <div className="decision-options">
        {decision.options.map(option => (
          <OptionPanel
            key={option.id}
            option={option}
            onSelect={() => onSelect(option.id)}
          />
        ))}
      </div>

      {/* 影响评估 */}
      <ImpactAssessment impact={decision.impact} />

      {/* 操作按钮 */}
      <div className="decision-actions">
        <button onClick={onSkip} className="skip-button">
          AI自行决定（风险自负）
        </button>
      </div>
    </div>
  );
};

// 不确定性徽章
const UncertaintyBadge: React.FC<{ level: UncertaintyLevel }> = ({ level }) => {
  const config = {
    [UncertaintyLevel.LOW]: { color: 'green', text: '低不确定性' },
    [UncertaintyLevel.MEDIUM]: { color: 'yellow', text: '中等不确定性' },
    [UncertaintyLevel.HIGH]: { color: 'orange', text: '高不确定性' },
    [UncertaintyLevel.VERY_HIGH]: { color: 'red', text: '极高不确定性' },
  };

  const { color, text } = config[level];

  return (
    <span className={\`badge badge-\${color}\`}>
      <UncertaintyIcon level={level} />
      {text}
    </span>
  );
};

// 选项面板
const OptionPanel: React.FC<{
  option: DecisionOption;
  onSelect: () => void;
}> = ({ option, onSelect }) => {
  const recommendationColor = option.aiRecommendation > 0.7 ? 'green' :
                              option.aiRecommendation > 0.4 ? 'yellow' : 'red';

  return (
    <div className="option-panel" onClick={onSelect}>
      <div className="option-header">
        <span className="option-label">{option.label}</span>
        <span className={\`recommendation recommendation-\${recommendationColor}\`}>
          AI 推荐度: {(option.aiRecommendation * 100).toFixed(0)}%
        </span>
      </div>

      <p className="option-description">{option.description}</p>

      <div className="option-metrics">
        <Metric label="预期质量" value={\`\${option.expectedOutcome.quality}/100\`} />
        <Metric label="工作量的估计" value={\`\${option.expectedOutcome.effort} 天\`} />
        <Metric label="风险等级" value={\`\${(option.expectedOutcome.risk * 100).toFixed(0)}%\`} />
      </div>

      {option.requiresHumanApproval && (
        <div className="approval-required">
          ⚠️ 需要人工确认
        </div>
      )}
    </div>
  );
};
```

### 不确定性可视化

```typescript
// 不确定性可视化配置
const UNCERTAINTY_VISUALIZATION = {
  // 置信区间图
  ConfidenceInterval: {
    type: 'band',
    data: [
      { estimate: 75, lower: 65, upper: 85, label: '质量分数' },
      { estimate: 5, lower: 3, upper: 10, label: '工作量(天)' },
    ],
    colors: {
      low: '#10b981',      // 绿色 - 低不确定
      medium: '#f59e0b',  // 黄色 - 中等不确定
      high: '#ef4444',    // 红色 - 高不确定
    },
  },

  // 概率分布图
  ProbabilityDistribution: {
    type: 'histogram',
    bins: 20,
    showMode: true,
    showMean: true,
    showMedian: true,
  },

  // 多选项比较图
  OptionComparison: {
    type: 'radar',
    metrics: ['质量', '速度', '安全性', '可维护性', '成本'],
    showOptimal: true,
    showCurrent: true,
  },
};
```

## 决策流程

### 人机协作决策

```typescript
// 决策流程管理器
class DecisionFlowManager {
  private uncertaintyDetector: UncertaintyDetector;
  private humanConfirmationQueue: DecisionQueue;
  private decisionHistory: DecisionStore;

  // 处理决策
  async processDecision(
    context: DecisionContext
  ): Promise<DecisionResult> {
    // 1. 检测不确定性
    const uncertainty = await this.detectOverallUncertainty(context);

    // 2. 确定决策模式
    const mode = this.determineDecisionMode(uncertainty);

    // 3. 根据模式执行
    switch (mode) {
      case 'ai_autonomous':
        return this.aiAutonomousDecision(context);

      case 'ai_recommend_human_confirm':
        return this.humanConfirmDecision(context, uncertainty);

      case 'human_decide':
        return this.humanDecision(context, uncertainty);

      case 'collaborative':
        return this.collaborativeDecision(context, uncertainty);
    }
  }

  // 确定决策模式
  private determineDecisionMode(
    uncertainty: UncertaintyQuantification
  ): DecisionMode {
    const threshold = this.config.uncertaintyThreshold;

    if (uncertainty.probability <= threshold.low) {
      return 'ai_autonomous';
    } else if (uncertainty.probability <= threshold.medium) {
      return 'ai_recommend_human_confirm';
    } else if (uncertainty.probability <= threshold.high) {
      return 'collaborative';
    } else {
      return 'human_decide';
    }
  }

  // AI 自主决策
  private async aiAutonomousDecision(
    context: DecisionContext
  ): Promise<DecisionResult> {
    const option = await this.aiSelectOption(context);

    await this.decisionHistory.record({
      ...option,
      decisionMode: 'ai_autonomous',
      uncertainty: context.uncertainty,
    });

    return {
      decision: option,
      madeBy: 'ai',
      rationale: option.rationale,
    };
  }

  // 需要人工确认的决策
  private async humanConfirmDecision(
    context: DecisionContext,
    uncertainty: UncertaintyQuantification
  ): Promise<DecisionResult> {
    const recommendation = await this.aiSelectOption(context);

    // 创建决策卡片，放入确认队列
    const decisionCard = this.createDecisionCard(context, recommendation, uncertainty);

    await this.humanConfirmationQueue.enqueue(decisionCard);

    // 返回 AI 推荐但不执行，等待确认
    return {
      pendingConfirmation: true,
      recommendation,
      decisionCard,
      uncertainty,
    };
  }

  // 协作决策
  private async collaborativeDecision(
    context: DecisionContext,
    uncertainty: UncertaintyQuantification
  ): Promise<DecisionResult> {
    // AI 提供多个选项及分析
    const analysis = await this.provideOptionAnalysis(context);

    // 人类选择一个或提出新方案
    const humanChoice = await this.humanConfirmationQueue.enqueueWithAnalysis(
      analysis,
      uncertainty
    );

    // 记录人类决策
    await this.decisionHistory.record({
      ...humanChoice,
      decisionMode: 'collaborative',
      uncertainty,
    });

    return humanChoice;
  }
}

type DecisionMode =
  | 'ai_autonomous'      // AI 自主决策
  | 'ai_recommend_human_confirm'  // AI 推荐，等待确认
  | 'human_decide'        // 人类决定
  | 'collaborative';      // 协作决策
```

### 决策阈值配置

```typescript
// 决策阈值配置
interface DecisionThresholds {
  // 不确定性阈值（0-1）
  uncertainty: {
    low: number;      // <= 0.25: AI 自主
    medium: number;   // <= 0.50: 需确认
    high: number;     // <= 0.75: 协作
    // > 0.75: 人类决定
  };

  // 影响阈值
  impact: {
    qualityThreshold: number;    // 质量影响阈值
    effortThreshold: number;     // 工作量阈值（天）
    riskThreshold: number;      // 风险阈值（0-1）
  };

  // 特殊规则
  specialRules: {
    securityCritical: boolean;   // 安全相关必须人工
    breakingChanges: boolean;     // 破坏性变更必须人工
    firstTimeDomain: boolean;    // 新领域必须人工
  };
}

const DEFAULT_THRESHOLDS: DecisionThresholds = {
  uncertainty: {
    low: 0.25,
    medium: 0.50,
    high: 0.75,
  },

  impact: {
    qualityThreshold: 10,    // >= 10 分质量变化需关注
    effortThreshold: 5,       // >= 5 天工作量变化需关注
    riskThreshold: 0.3,       // >= 30% 风险变化需关注
  },

  specialRules: {
    securityCritical: true,
    breakingChanges: true,
    firstTimeDomain: true,
  },
};
```

## 不确定性通信

### 用户通知

```typescript
// 不确定性通知服务
class UncertaintyNotificationService {
  // 通知用户存在需要确认的决策
  async notifyPendingDecision(decision: DecisionPoint): Promise<void> {
    const notification: UserNotification = {
      type: 'decision_required',
      title: '需要您的决策',
      body: decision.question,
      priority: this.mapUncertaintyToPriority(decision.uncertainty),
      actions: [
        { label: '立即查看', action: 'view_decision', payload: { id: decision.id } },
        { label: '稍后提醒', action: 'snooze', payload: { id: decision.id, minutes: 30 } },
        { label: '信任 AI', action: 'ai_autonomous', payload: { id: decision.id } },
      ],
      deadline: this.calculateDeadline(decision),
    };

    await this.notificationService.send(notification);
  }

  // 解释不确定性来源
  async explainUncertainty(uncertainty: UncertaintyQuantification): Promise<Explanation> {
    return {
      summary: this.generateSummary(uncertainty),
      details: this.generateDetails(uncertainty),
      recommendations: this.generateRecommendations(uncertainty),
      riskLevel: this.assessRiskLevel(uncertainty),
    };
  }

  // 生成不确定性摘要
  private generateSummary(u: UncertaintyQuantification): string {
    const levelText = {
      [UncertaintyLevel.LOW]: '低',
      [UncertaintyLevel.MEDIUM]: '中等',
      [UncertaintyLevel.HIGH]: '高',
      [UncertaintyLevel.VERY_HIGH]: '极高',
    };

    const typeText = {
      [UncertaintyType.INPUT]: '需求描述',
      [UncertaintyType.KNOWLEDGE]: '相关知识',
      [UncertaintyType.MODEL]: '模型能力',
      [UncertaintyType.ALEATORY]: '固有随机性',
      [UncertaintyType.EPISTEMIC]: '认知边界',
    };

    return \`当前决策有\${levelText[u.level]}（\${(u.probability * 100).toFixed(0)}%）的不确定性，主要来源于\${typeText[u.type]}。\`;
  }
}
```

## 学习与改进

### 从人类决策中学习

```typescript
// 决策学习器
class DecisionLearner {
  private feedbackStore: FeedbackStore;

  // 记录人类决策反馈
  async recordFeedback(feedback: DecisionFeedback): Promise<void> {
    await this.feedbackStore.save(feedback);

    // 1. 更新不确定性估计
    await this.updateUncertaintyModel(feedback);

    // 2. 更新 AI 推荐模型
    await this.updateRecommendationModel(feedback);

    // 3. 识别新的决策模式
    await this.identifyNewPatterns(feedback);
  }

  // 更新不确定性模型
  private async updateUncertaintyModel(
    feedback: DecisionFeedback
  ): Promise<void> {
    // 如果 AI 的不确定性估计与实际不符，调整模型
    const estimated = feedback.estimatedUncertainty;
    const actual = feedback.humanConfidence;

    const error = actual - estimated;

    // 调整不确定性估计偏差
    this.uncertaintyModel.adjust(error);
  }

  // 更新推荐模型
  private async updateRecommendationModel(
    feedback: DecisionFeedback
  ): Promise<void> {
    // 学习人类偏好的模式
    if (feedback.overriddenRecommendation) {
      this.preferenceModel.learn(
        feedback.context,
        feedback.selectedOption,
        feedback.overriddenRecommendation
      );
    }
  }

  // 分析决策偏差
  async analyzeDecisionBias(): Promise<BiasReport> {
    const decisions = await this.feedbackStore.getRecentDecisions();

    return {
      // 人类决策的系统性偏差
      humanBiases: this.detectHumanBiases(decisions),

      // AI 估计的系统性偏差
      aiBiases: this.detectAIBiases(decisions),

      // 需要调整的阈值
      thresholdAdjustments: this.calculateThresholdAdjustments(decisions),

      // 改进建议
      improvements: this.suggestImprovements(decisions),
    };
  }
}

interface DecisionFeedback {
  decisionId: string;
  context: DecisionContext;
  aiRecommendedOption?: string;
  selectedOption: string;
  selectedBy: 'ai' | 'human';

  // 人类信心
  humanConfidence: number;

  // AI 估计的不确定性
  estimatedUncertainty: UncertaintyQuantification;

  // 反馈原因
  rationale?: string;

  // 反馈时间
  feedbackAt: Date;
}
```

## 配置示例

```yaml
# 不确定性量化与决策支持配置
uncertainty_decision_support:
  # 不确定性检测
  detection:
    enabled: true
    real_time: true
    analysis_depth: "comprehensive"  # basic | comprehensive | deep

  # 决策阈值
  decision_thresholds:
    uncertainty:
      ai_autonomous_max: 0.25
      human_confirm_max: 0.50
      collaborative_max: 0.75

    impact:
      quality_significant: 10
      effort_significant_days: 5
      risk_significant: 0.3

  # 人机协作
  human_collaboration:
    enabled: true
    notification_enabled: true
    batch_decisions: true
    batch_window_minutes: 30

  # 学习配置
  learning:
    enabled: true
    feedback_collection: "explicit"  # explicit | implicit | both
    min_samples_for_update: 50
    model_update_interval: "1d"

  # 可视化
  visualization:
    show_confidence_interval: true
    show_probability_distribution: true
    show_comparison_radar: true
```

---

**最后更新**: 2026-04-14
