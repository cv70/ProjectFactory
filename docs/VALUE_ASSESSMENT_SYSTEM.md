# 价值评估系统

## 1. 概述

本文档定义 ProjectFactory 系统的价值评估（Value Assessment）能力设计，解决 think.md 中提出的核心难题："生成 10000 个没人用的软件 ≠ 成功"。

### 1.1 价值评估体系

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           价值评估体系                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │    内在价值      │  │    使用价值      │  │    商业价值      │         │
│  │  Intrinsic      │  │    Usage        │  │    Business     │         │
│  │                 │  │                 │  │                 │         │
│  │ • 代码质量     │  │ • 用户数量     │  │ • 收入潜力     │         │
│  │ • 技术创新     │  │ • 使用频率     │  │ • 市场定位     │         │
│  │ • 可维护性     │  │ • 满意度       │  │ • 成本效益     │         │
│  │ • 复用潜力     │  │ • 留存率       │  │ • 竞争壁垒     │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │    战略价值      │  │    社会价值      │  │    学习价值      │         │
│  │  Strategic     │  │    Social       │  │    Learning    │         │
│  │                 │  │                 │  │                 │         │
│  │ • 能力建设     │  │ • 问题解决     │  │ • 知识积累     │         │
│  │ • 技术储备     │  │ • 效率提升     │  │ • 模式发现     │         │
│  │ • 生态贡献     │  │ • 教育意义     │  │ • 迭代优化     │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 多维价值模型

### 2.1 价值维度定义

```typescript
// 价值维度枚举
enum ValueDimension {
  CODE_QUALITY = 'code-quality',           // 代码质量
  TECHNICAL_INNOVATION = 'innovation',      // 技术创新
  MAINTAINABILITY = 'maintainability',      // 可维护性
  REUSABILITY = 'reusability',             // 可复用性
  USER_ADOPTION = 'user-adoption',          // 用户采纳
  USAGE_FREQUENCY = 'usage-frequency',      // 使用频率
  USER_SATISFACTION = 'satisfaction',       // 用户满意度
  RETENTION = 'retention',                  // 用户留存
  REVENUE_POTENTIAL = 'revenue',            // 收入潜力
  MARKET_POSITION = 'market',               // 市场定位
  COST_EFFICIENCY = 'cost-efficiency',      // 成本效益
  COMPETITIVE_EDGE = 'competitive-edge',    // 竞争优势
  CAPABILITY_BUILDING = 'capability',       // 能力建设
  TECH_RESERVE = 'tech-reserve',           // 技术储备
  ECOSYSTEM_VALUE = 'ecosystem',            // 生态价值
  PROBLEM_SOLVING = 'problem-solving',      // 问题解决
  EFFICIENCY_GAIN = 'efficiency',           // 效率提升
  EDUCATIONAL_VALUE = 'education',          // 教育意义
  KNOWLEDGE_ACCUMULATION = 'knowledge',     // 知识积累
  PATTERN_DISCOVERY = 'pattern-discovery'   // 模式发现
}

// 价值评分
interface ValueScore {
  dimension: ValueDimension;
  score: number;           // 0-100
  weight: number;          // 权重
  evidence: Evidence[];
  confidence: number;      // 置信度 0-1
  timestamp: Date;
}

// 综合价值评估
interface ValueAssessment {
  projectId: string;
  overallScore: number;   // 加权总分 0-100
  dimensionScores: ValueScore[];
  tier: ValueTier;        // 价值层级
  recommendation: ValueRecommendation;
  assessedAt: Date;
}

// 价值层级
enum ValueTier {
  TIER_S = 'S',  // 卓越 - 具有突破性价值
  TIER_A = 'A',  // 优秀 - 高价值项目
  TIER_B = 'B',  // 良好 - 有一定价值
  TIER_C = 'C',  // 一般 - 价值有限
  TIER_D = 'D'   // 待优化 - 需要重大改进或废弃
}

// 价值建议
enum ValueRecommendation {
  PROMOTE = 'promote',           // 推广
  MAINTAIN = 'maintain',         // 维持
  ITERATE = 'iterate',           // 迭代优化
  ARCHIVE = 'archive',           // 归档
  DECOMMISSION = 'decommission'  // 停用
}
```

### 2.2 价值权重配置

```typescript
// 不同阶段的价值权重
const valueWeights: Record<ProjectPhase, Record<ValueDimension, number>> = {
  [ProjectPhase.GENERATION]: {
    // 生成阶段更注重内在价值
    [ValueDimension.CODE_QUALITY]: 0.20,
    [ValueDimension.INNOVATION]: 0.15,
    [ValueDimension.MAINTAINABILITY]: 0.15,
    [ValueDimension.REUSABILITY]: 0.10,
    [ValueDimension.USER_ADOPTION]: 0.05,
    [ValueDimension.USAGE_FREQUENCY]: 0.05,
    [ValueDimension.SATISFACTION]: 0.05,
    [ValueDimension.RETENTION]: 0.05,
    [ValueDimension.REVENUE]: 0.02,
    [ValueDimension.MARKET]: 0.02,
    [ValueDimension.COST_EFFICIENCY]: 0.03,
    [ValueDimension.COMPETITIVE_EDGE]: 0.03,
    [ValueDimension.CAPABILITY]: 0.05,
    [ValueDimension.TECH_RESERVE]: 0.03,
    [ValueDimension.ECOSYSTEM]: 0.02
  },

  [ProjectPhase.GROWTH]: {
    // 成长阶段更注重使用价值
    [ValueDimension.CODE_QUALITY]: 0.10,
    [ValueDimension.INNOVATION]: 0.08,
    [ValueDimension.MAINTAINABILITY]: 0.08,
    [ValueDimension.REUSABILITY]: 0.05,
    [ValueDimension.USER_ADOPTION]: 0.15,
    [ValueDimension.USAGE_FREQUENCY]: 0.12,
    [ValueDimension.SATISFACTION]: 0.10,
    [ValueDimension.RETENTION]: 0.10,
    [ValueDimension.REVENUE]: 0.05,
    [ValueDimension.MARKET]: 0.05,
    [ValueDimension.COST_EFFICIENCY]: 0.03,
    [ValueDimension.COMPETITIVE_EDGE]: 0.05,
    [ValueDimension.CAPABILITY]: 0.02,
    [ValueDimension.TECH_RESERVE]: 0.02
  },

  [ProjectPhase.MATURE]: {
    // 成熟阶段更注重商业价值
    [ValueDimension.CODE_QUALITY]: 0.05,
    [ValueDimension.INNOVATION]: 0.05,
    [ValueDimension.MAINTAINABILITY]: 0.05,
    [ValueDimension.REUSABILITY]: 0.03,
    [ValueDimension.USER_ADOPTION]: 0.10,
    [ValueDimension.USAGE_FREQUENCY]: 0.10,
    [ValueDimension.SATISFACTION]: 0.08,
    [ValueDimension.RETENTION]: 0.08,
    [ValueDimension.REVENUE]: 0.15,
    [ValueDimension.MARKET]: 0.10,
    [ValueDimension.COST_EFFICIENCY]: 0.08,
    [ValueDimension.COMPETITIVE_EDGE]: 0.08,
    [ValueDimension.CAPABILITY]: 0.02,
    [ValueDimension.TECH_RESERVE]: 0.02,
    [ValueDimension.ECOSYSTEM]: 0.03
  }
};

// 计算综合价值分
function calculateOverallScore(
  dimensionScores: ValueScore[],
  weights: Record<ValueDimension, number>
): number {
  return dimensionScores.reduce((total, ds) => {
    const weight = weights[ds.dimension] || 0;
    return total + (ds.score * weight);
  }, 0);
}
```

---

## 3. 价值评估方法

### 3.1 代码质量评估

```typescript
// 代码质量指标
interface CodeQualityMetrics {
  // 静态分析指标
  static: {
    complexity: number;          // 圈复杂度
    cognitiveComplexity: number; // 认知复杂度
    linesOfCode: number;         // 代码行数
    commentRatio: number;        // 注释比例
    duplicationRatio: number;    // 重复率
    typeCoverage: number;         // 类型覆盖率
  };

  // 动态分析指标
  dynamic: {
    testCoverage: number;        // 测试覆盖率
    bugDensity: number;          // BUG 密度
    vulnerabilityCount: number;  // 漏洞数量
    performanceScore: number;    // 性能得分
  };

  // 结构指标
  structure: {
    coupling: number;            // 耦合度
    cohesion: number;            // 内聚度
    abstraction: number;         // 抽象度
    moduleIndependence: number;  // 模块独立性
  };
}

// 代码质量评分器
class CodeQualityScorer {
  async score(metrics: CodeQualityMetrics): Promise<ValueScore> {
    const evidence = [];

    // 复杂度评分
    const complexityScore = this.scoreComplexity(metrics.static.complexity);
    evidence.push({ metric: 'complexity', value: complexityScore });

    // 可维护性评分
    const maintainabilityScore = this.scoreMaintainability(metrics);
    evidence.push({ metric: 'maintainability', value: maintainabilityScore });

    // 测试覆盖评分
    const coverageScore = metrics.dynamic.testCoverage * 100;
    evidence.push({ metric: 'coverage', value: coverageScore });

    // 安全性评分
    const securityScore = this.scoreSecurity(metrics.dynamic.vulnerabilityCount);
    evidence.push({ metric: 'security', value: securityScore });

    // 综合得分
    const score = (
      complexityScore * 0.25 +
      maintainabilityScore * 0.25 +
      coverageScore * 0.30 +
      securityScore * 0.20
    );

    return {
      dimension: ValueDimension.CODE_QUALITY,
      score,
      weight: 0,
      evidence,
      confidence: this.calculateConfidence(metrics),
      timestamp: new Date()
    };
  }

  private scoreComplexity(complexity: number): number {
    if (complexity <= 10) return 100;
    if (complexity <= 20) return 90;
    if (complexity <= 30) return 70;
    if (complexity <= 50) return 50;
    if (complexity <= 100) return 30;
    return 10;
  }

  private scoreSecurity(vulnerabilities: number): number {
    if (vulnerabilities === 0) return 100;
    if (vulnerabilities <= 3) return 80;
    if (vulnerabilities <= 10) return 60;
    if (vulnerabilities <= 20) return 40;
    return 20;
  }
}
```

### 3.2 技术创新评估

```typescript
// 技术创新指标
interface InnovationMetrics {
  // 技术新颖性
  novelty: {
    uniquePatterns: number;          // 独特设计模式数
    novelTechnologies: number;        // 新技术采用数
    creativeSolutions: number;        // 创造性解决方案数
  };

  // 技术影响力
  impact: {
    architectureScore: number;        // 架构创新度
    apiDesignScore: number;           // API 设计创新度
    algorithmNovelty: number;         // 算法新颖度
  };

  // 技术可扩展性
  extensibility: {
    pluginArchitecture: boolean;     // 插件架构
    extensionPoints: number;           // 扩展点数量
    customizationFlexibility: number; // 定制灵活性
  };

  // 技术复用性
  reusability: {
    componentLibrary: boolean;        // 组件库
    sharedModules: number;            // 共享模块数
    abstractionLevel: number;          // 抽象层级
  };
}

// 创新评分器
class InnovationScorer {
  async score(metrics: InnovationMetrics): Promise<ValueScore> {
    // 新颖性得分
    const noveltyScore = (
      (metrics.novelty.uniquePatterns / 10) * 30 +
      (metrics.novelty.novelTechnologies / 5) * 30 +
      (metrics.novelty.creativeSolutions / 5) * 40
    );

    // 影响力得分
    const impactScore = (
      metrics.impact.architectureScore * 0.4 +
      metrics.impact.apiDesignScore * 0.3 +
      metrics.impact.algorithmNovelty * 0.3
    );

    // 可扩展性得分
    const extensibilityScore = (
      (metrics.extensibility.pluginArchitecture ? 40 : 0) +
      Math.min(metrics.extensibility.extensionPoints * 5, 30) +
      metrics.extensibility.customizationFlexibility * 0.3
    );

    // 综合创新得分
    const score = (
      noveltyScore * 0.35 +
      impactScore * 0.35 +
      extensibilityScore * 0.30
    );

    return {
      dimension: ValueDimension.TECHNICAL_INNOVATION,
      score: Math.min(score, 100),
      weight: 0,
      evidence: [
        { metric: 'novelty', value: noveltyScore },
        { metric: 'impact', value: impactScore },
        { metric: 'extensibility', value: extensibilityScore }
      ],
      confidence: 0.75,
      timestamp: new Date()
    };
  }
}
```

### 3.3 用户采纳评估

```typescript
// 用户采纳指标
interface UserAdoptionMetrics {
  // 获取指标
  acquisition: {
    views: number;              // 页面浏览量
    downloads: number;           // 下载次数
    installations: number;       // 安装次数
    registrations: number;       // 注册用户数
    activationRate: number;      // 激活率
  };

  // 参与指标
  engagement: {
    dailyActiveUsers: number;    // 日活用户
    weeklyActiveUsers: number;   // 周活用户
    monthlyActiveUsers: number;  // 月活用户
    sessionDuration: number;     // 平均会话时长
    sessionCount: number;        // 会话数
    featureAdoptionRate: number; // 功能采用率
  };

  // 留存指标
  retention: {
    day1Retention: number;       // 次日留存
    day7Retention: number;       // 7日留存
    day30Retention: number;     // 30日留存
    churnRate: number;          // 流失率
  };

  // 推荐指标
  advocacy: {
    netPromoterScore: number;    // NPS
    referralRate: number;        // 推荐率
    reviewsCount: number;        // 评论数
    ratingAverage: number;        // 平均评分
  };
}

// 用户采纳评分器
class UserAdoptionScorer {
  async score(metrics: UserAdoptionMetrics): Promise<ValueScore> {
    // 获取得分
    const acquisitionScore = this.scoreAcquisition(metrics.acquisition);

    // 参与得分
    const engagementScore = this.scoreEngagement(metrics.engagement);

    // 留存得分
    const retentionScore = this.scoreRetention(metrics.retention);

    // 推荐得分
    const advocacyScore = this.scoreAdvocacy(metrics.advocacy);

    const score = (
      acquisitionScore * 0.20 +
      engagementScore * 0.30 +
      retentionScore * 0.30 +
      advocacyScore * 0.20
    );

    return {
      dimension: ValueDimension.USER_ADOPTION,
      score,
      weight: 0,
      evidence: [
        { metric: 'acquisition', value: acquisitionScore },
        { metric: 'engagement', value: engagementScore },
        { metric: 'retention', value: retentionScore },
        { metric: 'advocacy', value: advocacyScore }
      ],
      confidence: this.calculateConfidence(metrics),
      timestamp: new Date()
    };
  }

  private scoreAcquisition(a: UserAdoptionMetrics['acquisition']): number {
    // 基于行业基准评分
    const installScore = Math.min(a.installations / 1000 * 100, 100);
    const activationScore = a.activationRate * 100;
    return (installScore + activationScore) / 2;
  }

  private scoreEngagement(e: UserAdoptionMetrics['engagement']): number {
    if (e.dailyActiveUsers === 0) return 0;

    const dauScore = Math.min(e.dailyActiveUsers / 100 * 100, 50);
    const sessionScore = Math.min(e.sessionDuration / 600 * 50, 50); // 10分钟满分
    return dauScore + sessionScore;
  }

  private scoreRetention(r: UserAdoptionMetrics['retention']): number {
    const d1Score = r.day1Retention * 100 * 0.3;
    const d7Score = r.day7Retention * 100 * 0.35;
    const d30Score = r.day30Retention * 100 * 0.35;
    return d1Score + d7Score + d30Score;
  }

  private scoreAdvocacy(a: UserAdoptionMetrics['advocacy']): number {
    const npsScore = ((a.netPromoterScore + 100) / 200) * 50;
    const ratingScore = (a.ratingAverage / 5) * 50;
    return npsScore + ratingScore;
  }
}
```

---

## 4. 价值预测模型

### 4.1 潜力评估

```typescript
// 项目潜力指标
interface PotentialIndicators {
  // 市场因素
  market: {
    marketSize: number;              // 市场规模 (TAM)
    serviceableMarket: number;       // 可服务市场 (SAM)
    obtainableMarket: number;        // 可获得市场 (SOM)
    growthRate: number;             // 市场增长率
    marketTrend: 'rising' | 'stable' | 'declining';
  };

  // 竞争因素
  competition: {
    competitionIntensity: number;     // 竞争强度 0-100
    differentiators: number;          // 差异化因素数
    competitiveAdvantage: number;     // 竞争优势度
    barriersToEntry: number;         // 进入壁垒
  };

  // 技术因素
  technology: {
    technologyTrend: 'emerging' | 'stable' | 'mature' | 'declining';
    innovationPotential: number;     // 创新潜力
    technicalFeasibility: number;     // 技术可行性
  };

  // 用户因素
  users: {
    targetUsersSize: number;         // 目标用户规模
    userNeedsIntensity: number;       // 用户需求强度
    willingnessToPay: number;        // 付费意愿
    switchingCost: number;           // 转换成本
  };
}

// 潜力预测器
class PotentialPredictor {
  async predict(
    project: Project,
    indicators: PotentialIndicators
  ): Promise<PotentialPrediction> {
    // 市场潜力
    const marketPotential = this.predictMarketPotential(indicators.market);

    // 竞争潜力
    const competitivePotential = this.predictCompetitivePotential(
      indicators.competition
    );

    // 技术潜力
    const techPotential = this.predictTechPotential(indicators.technology);

    // 用户潜力
    const userPotential = this.predictUserPotential(indicators.users);

    // 综合潜力
    const overallPotential = (
      marketPotential * 0.30 +
      competitivePotential * 0.25 +
      techPotential * 0.20 +
      userPotential * 0.25
    );

    // 预测置信度
    const confidence = this.calculateConfidence(indicators);

    // 预测时间范围
    const timeHorizon = this.predictTimeToValue(overallPotential);

    return {
      projectId: project.id,
      overallPotential,
      dimensions: {
        market: marketPotential,
        competitive: competitivePotential,
        technology: techPotential,
        user: userPotential
      },
      confidence,
      timeToValue: timeHorizon,
      riskFactors: this.identifyRiskFactors(indicators),
      recommendations: this.generateRecommendations(indicators, overallPotential)
    };
  }

  private predictMarketPotential(market: PotentialIndicators['market']): number {
    // 市场规模得分
    const sizeScore = Math.min(market.marketSize / 1000000000 * 100, 100);

    // 增长率得分
    const growthScore = Math.min(market.growthRate / 0.5 * 100, 100);

    // 趋势得分
    const trendScores = { rising: 100, stable: 70, declining: 30 };
    const trendScore = trendScores[market.marketTrend];

    return (sizeScore * 0.4 + growthScore * 0.3 + trendScore * 0.3);
  }

  private predictTimeToValue(potential: number): { min: number; max: number } {
    // 基于潜力预测实现价值的时间
    if (potential >= 80) return { min: 3, max: 6 };      // 3-6个月
    if (potential >= 60) return { min: 6, max: 12 };    // 6-12个月
    if (potential >= 40) return { min: 12, max: 18 };   // 12-18个月
    if (potential >= 20) return { min: 18, max: 24 };   // 18-24个月
    return { min: 24, max: 36 };                          // 24-36个月
  }
}

// 潜力预测结果
interface PotentialPrediction {
  projectId: string;
  overallPotential: number;           // 0-100
  dimensions: {
    market: number;
    competitive: number;
    technology: number;
    user: number;
  };
  confidence: number;                  // 置信度 0-1
  timeToValue: { min: number; max: number };  // 月份
  riskFactors: string[];
  recommendations: string[];
}
```

### 4.2 趋势分析

```typescript
// 价值趋势分析
class ValueTrendAnalyzer {
  async analyzeTrend(
    projectId: string,
    period: { start: Date; end: Date }
  ): Promise<ValueTrend> {
    // 获取历史评估数据
    const historicalAssessments = await this.getHistoricalAssessments(
      projectId,
      period
    );

    // 计算趋势
    const trendData = this.calculateTrend(historicalAssessments);

    // 检测异常
    const anomalies = this.detectAnomalies(historicalAssessments);

    // 预测未来趋势
    const forecast = this.forecast(trendData, period);

    // 生成洞察
    const insights = this.generateInsights(trendData, anomalies);

    return {
      projectId,
      period,
      currentScore: historicalAssessments[0]?.overallScore || 0,
      trend: trendData,
      anomalies,
      forecast,
      insights
    };
  }

  private calculateTrend(
    assessments: ValueAssessment[]
  ): TrendData {
    if (assessments.length < 2) {
      return { direction: 'stable', changeRate: 0, volatility: 0 };
    }

    const scores = assessments.map(a => a.overallScore);
    const n = scores.length;

    // 计算平均变化率
    const changes = [];
    for (let i = 1; i < n; i++) {
      changes.push(scores[i] - scores[i - 1]);
    }
    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;

    // 计算波动性
    const mean = scores.reduce((a, b) => a + b, 0) / n;
    const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
    const volatility = Math.sqrt(variance);

    // 确定趋势方向
    let direction: 'rising' | 'stable' | 'declining';
    if (avgChange > 2) direction = 'rising';
    else if (avgChange < -2) direction = 'declining';
    else direction = 'stable';

    return {
      direction,
      changeRate: avgChange,
      volatility,
      projectedNext: scores[0] + avgChange * n
    };
  }

  private forecast(trendData: TrendData, period: { start: Date; end: Date }): Forecast {
    // 简单线性回归预测
    const monthsDiff = Math.max(
      (period.end.getTime() - period.start.getTime()) / (30 * 24 * 60 * 60 * 1000),
      1
    );

    return {
      projectedScore: Math.max(0, Math.min(100,
        trendData.projectedNext + trendData.changeRate * monthsDiff
      )),
      confidence: Math.max(0, 1 - trendData.volatility / 50),
      confidenceInterval: {
        lower: Math.max(0, trendData.projectedNext - trendData.volatility * 2),
        upper: Math.min(100, trendData.projectedNext + trendData.volatility * 2)
      }
    };
  }
}

// 趋势数据
interface TrendData {
  direction: 'rising' | 'stable' | 'declining';
  changeRate: number;     // 平均变化率 (每月)
  volatility: number;     // 波动性
  projectedNext: number;   // 预测下一期值
}

// 预测结果
interface Forecast {
  projectedScore: number;
  confidence: number;
  confidenceInterval: { lower: number; upper: number };
}
```

---

## 5. 价值决策引擎

### 5.1 决策规则

```typescript
// 价值决策配置
const valueDecisions: ValueDecisionRule[] = [
  // S级项目 - 全力推广
  {
    condition: (assessment) =>
      assessment.tier === ValueTier.TIER_S,
    actions: [
      { type: 'PROMOTE', priority: 'critical' },
      { type: 'ALLOCATE_RESOURCES', amount: 'maximum' },
      { type: 'FEATURE_FLAG', enabled: true },
      { type: 'MARKETING', level: 'aggressive' }
    ]
  },

  // A级项目 - 积极发展
  {
    condition: (assessment) =>
      assessment.tier === ValueTier.TIER_A,
    actions: [
      { type: 'PROMOTE', priority: 'high' },
      { type: 'ALLOCATE_RESOURCES', amount: 'high' },
      { type: 'ITERATE', frequency: 'weekly' }
    ]
  },

  // B级项目 - 维持优化
  {
    condition: (assessment) =>
      assessment.tier === ValueTier.TIER_B,
    actions: [
      { type: 'MAINTAIN', priority: 'normal' },
      { type: 'ALLOCATE_RESOURCES', amount: 'normal' },
      { type: 'ITERATE', frequency: 'monthly' }
    ]
  },

  // C级项目 - 评估是否值得迭代
  {
    condition: (assessment) =>
      assessment.tier === ValueTier.TIER_C,
    actions: [
      { type: 'EVALUATE', decisionDeadline: '30d' },
      { type: 'POTENTIAL_TEST', duration: '60d' },
      { type: 'REASSESS', interval: '30d' }
    ]
  },

  // D级项目 - 归档或停用
  {
    condition: (assessment) =>
      assessment.tier === ValueTier.TIER_D,
    actions: [
      { type: 'ARCHIVE', afterDays: 90 },
      { type: 'NOTIFY_USERS', beforeDays: 30 },
      { type: 'DECOMMISSION', ifNoUsageAfterDays: 180 }
    ]
  },

  // 下降趋势项目 - 预警
  {
    condition: (assessment, trend) =>
      trend?.direction === 'declining' && trend.changeRate < -5,
    actions: [
      { type: 'ALERT', level: 'warning' },
      { type: 'INVESTIGATE', reason: 'value-decline' },
      { type: 'INTERVENTION', required: true }
    ]
  },

  // 潜力项目但当前价值低 - 观察
  {
    condition: (assessment, _, potential) =>
      assessment.overallScore < 40 && potential?.overallPotential > 60,
    actions: [
      { type: 'MONITOR', frequency: 'weekly' },
      { type: 'PATIENT_INVESTMENT', duration: '6m' },
      { type: 'MARKET_VALIDATION', required: true }
    ]
  }
];

// 决策引擎
class ValueDecisionEngine {
  async makeDecisions(
    assessment: ValueAssessment,
    trend?: ValueTrend,
    potential?: PotentialPrediction
  ): Promise<Decision[]> {
    const applicableRules = valueDecisions.filter(rule =>
      rule.condition(assessment, trend, potential)
    );

    // 按优先级排序
    applicableRules.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.actions[0].priority] -
             priorityOrder[b.actions[0].priority];
    });

    // 执行决策
    const decisions: Decision[] = [];
    for (const rule of applicableRules) {
      for (const action of rule.actions) {
        decisions.push({
          id: uuid(),
          assessment,
          action,
          reason: rule.reason,
          createdAt: new Date()
        });
      }
    }

    return decisions;
  }
}

// 决策
interface Decision {
  id: string;
  assessment: ValueAssessment;
  action: ValueDecisionAction;
  reason: string;
  createdAt: Date;
}

// 决策动作
interface ValueDecisionAction {
  type: 'PROMOTE' | 'MAINTAIN' | 'ITERATE' | 'ARCHIVE' | 'DECOMMISSION' |
        'ALLOCATE_RESOURCES' | 'FEATURE_FLAG' | 'MARKETING' | 'EVALUATE' |
        'POTENTIAL_TEST' | 'REASSESS' | 'ALERT' | 'INVESTIGATE' |
        'INTERVENTION' | 'MONITOR' | 'PATIENT_INVESTMENT' | 'MARKET_VALIDATION' |
        'NOTIFY_USERS';
  priority?: 'critical' | 'high' | 'normal' | 'low';
  amount?: 'maximum' | 'high' | 'normal' | 'low';
  enabled?: boolean;
  level?: string;
  frequency?: string;
  duration?: string;
  interval?: string;
  afterDays?: number;
  beforeDays?: number;
  decisionDeadline?: string;
  required?: boolean;
  reason?: string;
}
```

### 5.2 资源分配优化

```typescript
// 资源分配配置
interface ResourceAllocation {
  totalBudget: number;
  allocations: {
    projectId: string;
    tier: ValueTier;
    currentScore: number;
    potentialScore: number;
    allocatedBudget: number;
    priority: number;
  }[];
}

// 资源分配优化器
class ResourceAllocationOptimizer {
  optimize(
    projects: ValueAssessment[],
    potentials: Map<string, PotentialPrediction>,
    totalBudget: number
  ): ResourceAllocation {
    // 计算每个项目的优先级得分
    const prioritizedProjects = projects.map(p => {
      const potential = potentials.get(p.projectId);
      const priorityScore = this.calculatePriorityScore(p, potential);

      return {
        projectId: p.projectId,
        tier: p.tier,
        currentScore: p.overallScore,
        potentialScore: potential?.overallPotential || 0,
        priorityScore,
        potential: potential
      };
    }).sort((a, b) => b.priorityScore - a.priorityScore);

    // 分配资源
    const allocations = this.allocateBudget(prioritizedProjects, totalBudget);

    return {
      totalBudget,
      allocations
    };
  }

  private calculatePriorityScore(
    assessment: ValueAssessment,
    potential?: PotentialPrediction
  ): number {
    const currentScore = assessment.overallScore;
    const potentialScore = potential?.overallPotential || 50;

    // 潜力权重 (更高潜力项目获得更高优先级)
    const potentialWeight = 0.6;
    const currentWeight = 0.4;

    return (potentialScore * potentialWeight) + (currentScore * currentWeight);
  }

  private allocateBudget(
    projects: PrioritizedProject[],
    totalBudget: number
  ): ResourceAllocation['allocations'] {
    const allocations: ResourceAllocation['allocations'] = [];
    let remainingBudget = totalBudget;
    let remainingProjects = projects.length;

    // S级项目优先分配
    const tierBudgetMultipliers = {
      [ValueTier.TIER_S]: 2.0,
      [ValueTier.TIER_A]: 1.5,
      [ValueTier.TIER_B]: 1.0,
      [ValueTier.TIER_C]: 0.5,
      [ValueTier.TIER_D]: 0.0
    };

    for (const project of projects) {
      const baseBudget = totalBudget / projects.length;
      const multiplier = tierBudgetMultipliers[project.tier];

      let allocated: number;
      if (project.tier === ValueTier.TIER_S) {
        // S级项目保证最低投入
        allocated = Math.min(baseBudget * multiplier, remainingBudget * 0.4);
      } else if (project.tier === ValueTier.TIER_D) {
        // D级项目不分配
        allocated = 0;
      } else {
        // 按优先级比例分配
        allocated = (project.priorityScore /
          projects.reduce((sum, p) => sum + p.priorityScore, 0)) *
          remainingBudget;
      }

      remainingBudget -= allocated;
      remainingProjects--;

      allocations.push({
        projectId: project.projectId,
        tier: project.tier,
        currentScore: project.currentScore,
        potentialScore: project.potentialScore,
        allocatedBudget: Math.round(allocated),
        priority: project.priorityScore
      });
    }

    return allocations;
  }
}
```

---

## 6. 反馈闭环系统

### 6.1 用户反馈收集

```typescript
// 反馈收集渠道
interface FeedbackChannel {
  type: 'in-app' | 'email' | 'survey' | 'support' | 'social' | 'review';
  enabled: boolean;
  autoCollect: boolean;
  sentimentAnalysis: boolean;
}

// 反馈配置
const feedbackConfig = {
  channels: [
    {
      type: 'in-app',
      enabled: true,
      autoCollect: true,
      sentimentAnalysis: true
    },
    {
      type: 'email',
      enabled: true,
      autoCollect: false,
      sentimentAnalysis: true
    },
    {
      type: 'survey',
      enabled: true,
      autoCollect: false,
      sentimentAnalysis: false
    }
  ],

  // 自动反馈触发
  autoTriggers: [
    {
      event: 'project.first-use',
      feedbackRequest: 'nps-survey'
    },
    {
      event: 'project.milestone',
      feedbackRequest: 'satisfaction-survey'
    },
    {
      event: 'support.ticket',
      feedbackRequest: 'csat-survey'
    }
  ]
};

// 反馈数据
interface Feedback {
  id: string;
  projectId: string;
  userId: string;
  type: string;
  rating?: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  categories: string[];
  content: string;
  extractedFeatures: string[];
  createdAt: Date;
}

// 反馈分析
class FeedbackAnalyzer {
  async analyze(feedback: Feedback[]): Promise<FeedbackAnalysis> {
    // 情感分析
    const sentimentDistribution = this.analyzeSentiment(feedback);

    // 主题提取
    const themes = this.extractThemes(feedback);

    // 痛点识别
    const painPoints = this.identifyPainPoints(feedback);

    // 功能反馈映射
    const featureFeedback = this.mapFeatureFeedback(feedback);

    // 改进建议
    const suggestions = this.generateSuggestions(painPoints, themes);

    return {
      sentimentDistribution,
      themes,
      painPoints,
      featureFeedback,
      suggestions,
      overallSentiment: this.calculateOverallSentiment(sentimentDistribution)
    };
  }

  private extractThemes(feedback: Feedback[]): Theme[] {
    // 使用 LLM 提取主题
    const themes: Theme[] = [];
    const themeGroups = new Map<string, Feedback[]>();

    for (const fb of feedback) {
      const detectedThemes = await this.detectThemes(fb.content);
      for (const theme of detectedThemes) {
        if (!themeGroups.has(theme)) {
          themeGroups.set(theme, []);
        }
        themeGroups.get(theme)!.push(fb);
      }
    }

    for (const [theme, fbs] of themeGroups) {
      themes.push({
        name: theme,
        frequency: fbs.length,
        sentiment: this.calculateSentiment(fbs),
        topFeedback: fbs.slice(0, 3)
      });
    }

    return themes.sort((a, b) => b.frequency - a.frequency);
  }
}
```

### 6.2 价值迭代优化

```typescript
// 迭代优化决策
interface IterationOptimization {
  projectId: string;
  currentWeaknesses: Weakness[];
  prioritizedImprovements: Improvement[];
  expectedImpact: ImpactEstimate;
  resourceRequirement: ResourceEstimate;
}

// 改进项
interface Improvement {
  dimension: ValueDimension;
  currentScore: number;
  targetScore: number;
  improvementActions: string[];
  confidence: number;
}

// 迭代优化器
class IterationOptimizer {
  async generateOptimizations(
    assessment: ValueAssessment,
    feedbackAnalysis: FeedbackAnalysis,
    trend: ValueTrend
  ): Promise<IterationOptimization[]> {
    // 识别弱点
    const weaknesses = this.identifyWeaknesses(assessment);

    // 优先化改进项
    const improvements = this.prioritizeImprovements(
      weaknesses,
      feedbackAnalysis,
      trend
    );

    // 估算影响
    const impacts = this.estimateImpacts(improvements);

    // 估算资源
    const resources = this.estimateResources(improvements);

    return [{
      projectId: assessment.projectId,
      currentWeaknesses: weaknesses,
      prioritizedImprovements: improvements,
      expectedImpact: impacts,
      resourceRequirement: resources
    }];
  }

  private prioritizeImprovements(
    weaknesses: Weakness[],
    feedback: FeedbackAnalysis,
    trend: ValueTrend
  ): Improvement[] {
    // 计算每个改进项的优先级得分
    const scoredImprovements = weaknesses.map(w => {
      // 反馈权重
      const feedbackWeight = feedback.themes
        .filter(t => t.name === w.dimension)
        .reduce((sum, t) => sum + t.frequency, 0);

      // 趋势权重
      const trendWeight = trend.direction === 'declining' ? 2 : 1;

      // 当前分数权重 (分数越低改进价值越高)
      const scoreWeight = (100 - w.currentScore) / 100;

      const priorityScore = (
        w.impactWeight * 0.4 +
        feedbackWeight * 0.3 +
        trendWeight * 0.2 +
        scoreWeight * 0.1
      );

      return {
        dimension: w.dimension,
        currentScore: w.currentScore,
        targetScore: this.calculateRealisticTarget(w.currentScore),
        improvementActions: this.suggestActions(w),
        confidence: 0.7,
        priorityScore
      };
    });

    return scoredImprovements
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 5); // 最多5个改进项
  }

  private calculateRealisticTarget(currentScore: number): number {
    // 现实的目标分数 (基于行业基准和提升难度)
    if (currentScore < 30) return Math.min(currentScore + 30, 70);
    if (currentScore < 50) return Math.min(currentScore + 20, 80);
    if (currentScore < 70) return Math.min(currentScore + 15, 90);
    return Math.min(currentScore + 10, 95);
  }
}
```

---

## 7. 价值仪表盘

### 7.1 核心指标展示

```typescript
// 价值仪表盘配置
const valueDashboardConfig = {
  // 概览指标
  overview: {
    totalProjects: { label: '项目总数', format: 'number' },
    averageScore: { label: '平均价值分', format: 'score' },
    topTierCount: { label: 'S/A级项目', format: 'number', tier: ['S', 'A'] },
    valueTrend: { label: '价值趋势', format: 'trend' }
  },

  // 分层展示
  tiers: {
    S: { label: 'S级 - 卓越', color: '#FFD700', icon: 'trophy' },
    A: { label: 'A级 - 优秀', color: '#4CAF50', icon: 'star' },
    B: { label: 'B级 - 良好', color: '#2196F3', icon: 'thumbs-up' },
    C: { label: 'C级 - 一般', color: '#FF9800', icon: 'minus' },
    D: { label: 'D级 - 待优化', color: '#F44336', icon: 'exclamation' }
  },

  // 维度雷达图
  dimensions: [
    ValueDimension.CODE_QUALITY,
    ValueDimension.TECHNICAL_INNOVATION,
    ValueDimension.USER_ADOPTION,
    ValueDimension.USAGE_FREQUENCY,
    ValueDimension.SATISFACTION,
    ValueDimension.REVENUE
  ],

  // 趋势图配置
  trendCharts: {
    defaultPeriod: '90d',
    periods: ['7d', '30d', '90d', '1y'],
    metrics: ['overallScore', 'userAdoption', 'satisfaction', 'revenue']
  }
};

// 仪表盘数据
interface ValueDashboard {
  overview: {
    totalProjects: number;
    averageScore: number;
    tierDistribution: Record<ValueTier, number>;
    valueTrend: TrendData;
  };

  topProjects: {
    id: string;
    name: string;
    tier: ValueTier;
    score: number;
    trend: 'rising' | 'stable' | 'declining';
  }[];

  dimensionalRadar: {
    dimension: ValueDimension;
    score: number;
    benchmark: number;
  }[];

  alerts: {
    type: 'warning' | 'critical';
    message: string;
    affectedProjects: string[];
  }[];
}
```

### 7.2 报告生成

```typescript
// 价值报告配置
const valueReportConfig = {
  types: {
    executive: {
      title: '价值评估执行报告',
      sections: ['overview', 'tier-distribution', 'key-highlights', 'investments'],
      frequency: 'monthly'
    },
    operational: {
      title: '价值运营报告',
      sections: ['trends', 'improvements', 'alerts', 'resource-allocation'],
      frequency: 'weekly'
    },
    project: {
      title: '项目价值报告',
      sections: ['scores', 'trends', 'feedback', 'recommendations'],
      frequency: 'per-project'
    }
  },

  recipients: {
    executive: ['cxo@example.com'],
    operational: ['sre@example.com', 'product@example.com'],
    project: ['project-team@example.com']
  }
};

// 报告生成器
class ValueReportGenerator {
  async generate(
    type: 'executive' | 'operational' | 'project',
    params: Record<string, unknown>
  ): Promise<ValueReport> {
    const config = valueReportConfig.types[type];
    const sections = await Promise.all(
      config.sections.map(section => this.generateSection(section, params))
    );

    return {
      id: uuid(),
      type,
      title: config.title,
      generatedAt: new Date(),
      sections
    };
  }

  private async generateSection(
    section: string,
    params: Record<string, unknown>
  ): Promise<ReportSection> {
    switch (section) {
      case 'overview':
        return this.generateOverviewSection(params);
      case 'tier-distribution':
        return this.generateTierSection(params);
      case 'trends':
        return this.generateTrendSection(params);
      case 'recommendations':
        return this.generateRecommendationsSection(params);
      default:
        return { title: section, content: {} };
    }
  }
}
```

---

## 8. 相关文档

- [系统愿景和核心理念](./think.md)
- [数据分析设计](./DATA_WAREHOUSE_ANALYTICS.md)
- [A/B 测试实践指南](./AB_TESTING_PRACTICES.md)
- [多租户架构设计](./MULTITENANCY_ARCHITECTURE.md)

---

**最后更新**: 2026-04-14
