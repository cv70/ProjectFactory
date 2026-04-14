# 用户反馈收集与分析系统设计

## 概述

用户反馈收集与分析系统是无限生成系统的学习进化引擎，负责收集、处理、分析用户对生成项目的反馈，并将其转化为系统改进的输入。没有反馈系统，生成系统将无法学习和进化，陷入"盲目生成"的困境。

## 核心价值

```
持续改进 = 收集 → 分析 → 学习 → 优化 → 验证

反馈系统的核心价值：
1. 理解真实需求 - 知道用户真正想要什么
2. 发现质量问题 - 识别生成代码的不足
3. 指导优化方向 - 确定系统改进的优先级
4. 验证改进效果 - 确认优化确实有效
5. 积累知识经验 - 将反馈转化为学习数据
```

## 反馈类型

### 反馈分类

```typescript
// 反馈类型枚举
enum FeedbackType {
  // 用户反馈
  USER_RATING = 'user_rating',           // 用户评分
  USER_COMMENT = 'user_comment',         // 用户评论
  USER_BUG_REPORT = 'user_bug_report',   // Bug报告
  USER_FEATURE_REQUEST = 'user_feature_request', // 功能请求

  // 系统反馈
  USAGE_METRICS = 'usage_metrics',       // 使用指标
  PERFORMANCE_DATA = 'performance_data', // 性能数据
  ERROR_REPORTS = 'error_reports',       // 错误报告

  // 生成反馈
  GENERATION_QUALITY = 'generation_quality', // 生成质量
  BUILD_RESULTS = 'build_results',       // 构建结果
  TEST_RESULTS = 'test_results',         // 测试结果

  // 运营反馈
  BUSINESS_METRICS = 'business_metrics', // 业务指标
  COST_ANALYSIS = 'cost_analysis',       // 成本分析
}

// 反馈优先级
enum FeedbackPriority {
  CRITICAL = 'critical',                 // 立即处理
  HIGH = 'high',                        // 高优先级
  MEDIUM = 'medium',                    // 正常处理
  LOW = 'low',                          // 低优先级
  COSMETIC = 'cosmetic'                 // 可忽略
}

// 反馈状态
enum FeedbackStatus {
  NEW = 'new',                          // 新反馈
  TRIAGED = 'triaged',                  // 已分类
  ASSIGNED = 'assigned',                // 已分配
  IN_PROGRESS = 'in_progress',          // 处理中
  RESOLVED = 'resolved',                // 已解决
  VERIFIED = 'verified',                // 已验证
  CLOSED = 'closed',                    // 已关闭
  DISMISSED = 'dismissed'               // 已驳回
}
```

### 反馈数据结构

```typescript
// 反馈记录
interface Feedback {
  id: string;                          // 唯一标识
  type: FeedbackType;                   // 反馈类型
  priority: FeedbackPriority;          // 优先级
  status: FeedbackStatus;               // 状态

  // 来源信息
  source: FeedbackSource;               // 来源
  sourceId?: string;                    // 来源ID (如用户ID)
  projectId?: string;                   // 关联项目
  generationId?: string;                // 关联生成记录

  // 内容
  content: FeedbackContent;             // 反馈内容

  // 上下文
  context: {
    projectType?: string;               // 项目类型
    techStack?: string[];               // 技术栈
    domain?: string;                    // 领域
    useCase?: string;                   // 用例
    timestamp: Date;
    userAgent?: string;
    ipHash?: string;                    // 脱敏IP
  };

  // 处理信息
  assignee?: string;                   // 分配给
  resolvedAt?: Date;
  resolution?: Resolution;
  verifiedAt?: Date;

  // 分析信息
  analysis?: FeedbackAnalysis;

  // 元数据
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
}

// 来源
interface FeedbackSource {
  type: 'user' | 'system' | 'automated' | 'integration';
  channel: string;                     // channel: web, api, email, slack
  campaign?: string;                    // 来源活动
}

// 反馈内容
interface FeedbackContent {
  // 评分 (1-5)
  rating?: number;

  // 文本反馈
  summary?: string;                    // 简短总结
  description?: string;                // 详细描述
  attachments?: Attachment[];          // 附件

  // 结构化数据
  structuredData?: Record<string, any>;

  // 情感分析
  sentiment?: {
    score: number;                     // -1 到 1
    label: 'positive' | 'neutral' | 'negative';
    confidence: number;
  };
}

// 附件
interface Attachment {
  type: 'image' | 'log' | 'code' | 'file';
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

// 分析结果
interface FeedbackAnalysis {
  // 问题分类
  category: string;                   // 问题分类
  subcategory?: string;                // 子分类

  // 根因分析
  rootCause?: string;
  impactScope?: string;

  // 建议
  suggestedFix?: string;
  suggestedImprovement?: string;

  // 关联
  relatedFeedbackIds?: string[];
  relatedIssues?: string[];

  // AI分析置信度
  confidence?: number;

  // 分析方法
  analysisMethod?: 'manual' | 'automated' | 'hybrid';
  analyzedBy?: string;
  analyzedAt?: Date;
}

// 解决方案
interface Resolution {
  type: 'fixed' | 'workaround' | 'won't_fix' | 'duplicate' | 'cannot_reproduce';
  description?: string;
  changes?: Change[];
  resolvedBy: string;
  resolvedAt: Date;
}

// 变更记录
interface Change {
  type: 'prompt_change' | 'code_change' | 'config_change' | 'architecture_change';
  description: string;
  diff?: string;
  rollbackPlan?: string;
}
```

## 收集渠道

### 渠道配置

```typescript
// 反馈渠道接口
interface FeedbackChannel {
  name: string;                        // 渠道名称
  type: 'inline' | 'external' | 'automated';

  // 收集配置
  config: {
    enabled: boolean;
    autoSubmit?: boolean;
    batchInterval?: number;            // 批处理间隔
  };

  // 验证规则
  validation: {
    requiredFields: string[];
    maxLength?: number;
    allowedTypes?: FeedbackType[];
  };
}

// 内联渠道 - 直接在产品中收集
const inlineChannels: FeedbackChannel[] = [
  {
    name: '项目生成后评分',
    type: 'inline',
    config: { enabled: true, autoSubmit: false },
    validation: {
      requiredFields: ['rating', 'summary'],
      maxLength: 5000
    }
  },
  {
    name: '代码审查反馈',
    type: 'inline',
    config: { enabled: true, autoSubmit: false },
    validation: {
      requiredFields: ['generationId', 'feedbackType'],
      maxLength: 10000
    }
  },
  {
    name: '使用中反馈',
    type: 'inline',
    config: { enabled: true, autoSubmit: true, batchInterval: 60000 },
    validation: {
      requiredFields: ['summary']
    }
  }
];

// 外部渠道 - 从外部系统收集
const externalChannels: FeedbackChannel[] = [
  {
    name: 'API导入',
    type: 'external',
    config: { enabled: true },
    validation: {
      requiredFields: ['type', 'content', 'sourceId']
    }
  },
  {
    name: 'Webhook',
    type: 'external',
    config: { enabled: true },
    validation: {
      requiredFields: ['event', 'payload']
    }
  },
  {
    name: 'Email导入',
    type: 'external',
    config: { enabled: false },
    validation: {
      requiredFields: ['from', 'subject', 'body']
    }
  }
];

// 自动化渠道 - 系统自动生成反馈
const automatedChannels: FeedbackChannel[] = [
  {
    name: '构建失败报告',
    type: 'automated',
    config: { enabled: true, autoSubmit: true },
    validation: {
      requiredFields: ['generationId', 'errorType', 'errorLog']
    }
  },
  {
    name: '测试失败报告',
    type: 'automated',
    config: { enabled: true, autoSubmit: true },
    validation: {
      requiredFields: ['generationId', 'testResults']
    }
  },
  {
    name: '性能退化警报',
    type: 'automated',
    config: { enabled: true, autoSubmit: true },
    validation: {
      requiredFields: ['metric', 'currentValue', 'threshold']
    }
  }
];
```

### 收集服务

```typescript
// 反馈收集服务
class FeedbackCollector {
  constructor(
    private channels: Map<string, FeedbackChannel>,
    private queue: FeedbackQueue
  ) {}

  // 提交反馈
  async submit(
    channel: string,
    feedback: SubmitFeedbackRequest
  ): Promise<FeedbackSubmitResult> {
    // 1. 验证渠道
    const channelConfig = this.channels.get(channel);
    if (!channelConfig || !channelConfig.enabled) {
      throw new Error(`Feedback channel ${channel} is not available`);
    }

    // 2. 验证数据
    const validation = this.validateFeedback(channelConfig, feedback);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    // 3. 预处理
    const processedFeedback = await this.preprocess(feedback);

    // 4. 进入队列
    await this.queue.enqueue(processedFeedback);

    // 5. 触发自动分析
    this.triggerAutoAnalysis(processedFeedback);

    return {
      success: true,
      feedbackId: processedFeedback.id,
      estimatedProcessingTime: this.estimateProcessingTime(channel)
    };
  }

  // 批量提交
  async submitBatch(
    channel: string,
    feedbacks: SubmitFeedbackRequest[]
  ): Promise<BatchSubmitResult> {
    const results: FeedbackSubmitResult[] = [];
    const errors: string[] = [];

    for (const feedback of feedbacks) {
      try {
        const result = await this.submit(channel, feedback);
        results.push(result);
      } catch (error) {
        errors.push(`${feedback}: ${error.message}`);
      }
    }

    return {
      total: feedbacks.length,
      succeeded: results.filter(r => r.success).length,
      failed: errors.length,
      results,
      errors
    };
  }

  // 预处理
  private async preprocess(
    feedback: SubmitFeedbackRequest
  ): Promise<Feedback> {
    return {
      id: generateId('fb'),
      type: feedback.type,
      priority: this.calculatePriority(feedback),
      status: FeedbackStatus.NEW,
      source: { type: 'user', channel: feedback.channel },
      content: {
        rating: feedback.rating,
        summary: feedback.summary,
        description: feedback.description,
        sentiment: await this.analyzeSentiment(feedback)
      },
      context: {
        projectType: feedback.context?.projectType,
        techStack: feedback.context?.techStack,
        domain: feedback.context?.domain,
        timestamp: new Date()
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: []
    };
  }

  // 计算优先级
  private calculatePriority(feedback: SubmitFeedbackRequest): FeedbackPriority {
    // 基于评分
    if (feedback.rating !== undefined) {
      if (feedback.rating <= 2) return FeedbackPriority.HIGH;
      if (feedback.rating === 3) return FeedbackPriority.MEDIUM;
      return FeedbackPriority.LOW;
    }

    // 基于关键词
    const criticalKeywords = ['crash', 'broken', 'cannot', 'error', 'fail'];
    if (feedback.summary &&
        criticalKeywords.some(k => feedback.summary!.toLowerCase().includes(k))) {
      return FeedbackPriority.HIGH;
    }

    return FeedbackPriority.MEDIUM;
  }
}

// 反馈提交请求
interface SubmitFeedbackRequest {
  type: FeedbackType;
  channel: string;

  // 内容
  rating?: number;
  summary?: string;
  description?: string;
  structuredData?: Record<string, any>;

  // 上下文
  context?: {
    projectType?: string;
    techStack?: string[];
    domain?: string;
    generationId?: string;
    userId?: string;
  };

  // 附件
  attachments?: File[];
}
```

## 分析引擎

### 分析管道

```typescript
// 分析管道
class FeedbackAnalysisPipeline {
  constructor(
    private nlp: NLPService,
    private classifier: ClassifierModel,
    private sentimentAnalyzer: SentimentAnalyzer,
    private rootCauseAnalyzer: RootCauseAnalyzer
  ) {}

  // 执行分析
  async analyze(feedback: Feedback): Promise<FeedbackAnalysis> {
    // 1. 文本预处理
    const processed = await this.preprocess(feedback.content);

    // 2. 分类
    const classification = await this.classifier.classify({
      text: processed.text,
      type: feedback.type,
      context: feedback.context
    });

    // 3. 情感分析
    const sentiment = await this.sentimentAnalyzer.analyze(processed.text);

    // 4. 根因分析
    const rootCause = await this.rootCauseAnalyzer.analyze({
      feedback,
      classification
    });

    // 5. 关联分析
    const relations = await this.findRelatedFeedback(feedback);

    // 6. 生成建议
    const suggestions = await this.generateSuggestions({
      classification,
      rootCause,
      relations
    });

    return {
      category: classification.category,
      subcategory: classification.subcategory,
      rootCause: rootCause.cause,
      impactScope: rootCause.impact,
      suggestedFix: suggestions.fix,
      suggestedImprovement: suggestions.improvement,
      relatedFeedbackIds: relations.map(r => r.id),
      confidence: classification.confidence,
      analysisMethod: 'hybrid',
      analyzedAt: new Date()
    };
  }

  // 预处理
  private async preprocess(content: FeedbackContent): Promise<ProcessedText> {
    // 提取文本
    const rawText = [
      content.summary,
      content.description,
      JSON.stringify(content.structuredData)
    ].filter(Boolean).join(' ');

    // 清洗
    const cleaned = this.cleanText(rawText);

    // 分词
    const tokens = await this.nlp.tokenize(cleaned);

    // 提取关键短语
    const phrases = await this.nlp.extractPhrases(cleaned);

    return {
      text: cleaned,
      tokens,
      phrases,
      original: rawText
    };
  }
}

// NLP服务
interface NLPService {
  tokenize(text: string): Promise<string[]>;
  extractPhrases(text: string): Promise<string[]>;
  extractEntities(text: string): Promise<Entity[]>;
  summarize(text: string, maxLength: number): Promise<string>;
  translate(text: string, targetLang: string): Promise<string>;
}

// 实体
interface Entity {
  type: 'person' | 'organization' | 'technology' | 'feature' | 'error';
  value: string;
  confidence: number;
}
```

### 问题分类

```typescript
// 问题分类器
class FeedbackClassifier {
  // 预定义类别
  private categories = {
    code_quality: {
      name: '代码质量问题',
      subcategories: ['readability', 'maintainability', 'performance', 'security', 'style']
    },
    functionality: {
      name: '功能问题',
      subcategories: ['missing_feature', 'wrong_behavior', 'incomplete', 'inconsistent']
    },
    usability: {
      name: '可用性问题',
      subcategories: ['ui_issue', 'navigation', 'documentation', 'accessibility']
    },
    technical: {
      name: '技术问题',
      subcategories: ['build_error', 'runtime_error', 'compatibility', 'integration']
    },
    generation: {
      name: '生成问题',
      subcategories: ['template_issue', 'context_understanding', 'output_format', 'completeness']
    },
    other: {
      name: '其他',
      subcategories: ['question', 'suggestion', 'complaint', 'praise']
    }
  };

  // 分类
  async classify(input: ClassificationInput): Promise<ClassificationResult> {
    // 1. 关键词匹配
    const keywordMatch = this.matchKeywords(input.text);

    // 2. 规则匹配
    const ruleMatch = this.matchRules(input.text, input.type);

    // 3. ML分类
    const mlResult = await this.mlClassify(input);

    // 4. 综合判断
    return this.combineResults(keywordMatch, ruleMatch, mlResult);
  }

  // 关键词匹配
  private matchKeywords(text: string): CategoryScore[] {
    const keywordMap: Record<string, string> = {
      'security': 'security',
      'vulnerable': 'security',
      'xss': 'security',
      'injection': 'security',
      'performance': 'performance',
      'slow': 'performance',
      'memory': 'performance',
      'leak': 'performance',
      'error': 'runtime_error',
      'crash': 'runtime_error',
      'exception': 'runtime_error',
      'fail': 'build_error',
      'build': 'build_error',
      'compile': 'build_error',
      'missing': 'missing_feature',
      'need': 'missing_feature',
      'should': 'suggestion',
      'could': 'suggestion',
      'great': 'praise',
      'love': 'praise'
    };

    const scores: Map<string, number> = new Map();
    const lowerText = text.toLowerCase();

    for (const [keyword, category] of Object.entries(keywordMap)) {
      if (lowerText.includes(keyword)) {
        scores.set(category, (scores.get(category) || 0) + 1);
      }
    }

    return Array.from(scores.entries())
      .map(([category, score]) => ({ category, score }))
      .sort((a, b) => b.score - a.score);
  }

  // 规则匹配
  private matchRules(text: string, type: FeedbackType): CategoryScore[] {
    const rules: PatternRule[] = [
      {
        pattern: /(stack\s*)?trace|error\s*:|exception\s*:|at\s+[\w.]+\(/i,
        category: 'runtime_error',
        weight: 0.9
      },
      {
        pattern: /cannot\s+(find|read|write|access|connect)/i,
        category: 'runtime_error',
        weight: 0.8
      },
      {
        pattern: /typeerror|referenceerror|syntaxerror|urierror/i,
        category: 'runtime_error',
        weight: 0.9
      },
      {
        pattern: /lint|warning|eslint|prettier/i,
        category: 'code_quality',
        weight: 0.7
      },
      {
        pattern: /test|fail|pass|coverage/i,
        category: 'functionality',
        weight: 0.5
      }
    ];

    return rules
      .filter(rule => rule.pattern.test(text))
      .map(rule => ({ category: rule.category, score: rule.weight }));
  }
}

// 分类输入
interface ClassificationInput {
  text: string;
  type: FeedbackType;
  context?: {
    projectType?: string;
    techStack?: string[];
  };
}

// 分类结果
interface ClassificationResult {
  category: string;
  subcategory: string;
  confidence: number;
  reasoning: string;
  alternativeCategories?: string[];
}
```

### 情感分析

```typescript
// 情感分析器
class SentimentAnalyzer {
  constructor(private model: SentimentModel) {}

  async analyze(text: string): Promise<SentimentResult> {
    // 1. 基础情感分析
    const base = await this.model.predict(text);

    // 2. 方面抽取
    const aspects = await this.extractAspects(text);

    // 3. 方面情感
    const aspectSentiments = await this.analyzeAspectSentiments(text, aspects);

    // 4. 综合结果
    return {
      overall: {
        score: base.score,
        label: this.scoreToLabel(base.score),
        confidence: base.confidence
      },
      aspects: aspectSentiments,
      highlights: this.extractHighlights(text, aspects)
    };
  }

  private async extractAspects(text: string): Promise<Aspect[]> {
    const aspects: Aspect[] = [];

    // 领域关键词
    const domainKeywords = [
      { keyword: 'code', aspect: 'code_quality' },
      { keyword: 'generation', aspect: 'generation_quality' },
      { keyword: 'speed', aspect: 'performance' },
      { keyword: 'documentation', aspect: 'documentation' },
      { keyword: 'api', aspect: 'api_design' },
      { keyword: 'test', aspect: 'testing' }
    ];

    const lowerText = text.toLowerCase();
    for (const { keyword, aspect } of domainKeywords) {
      if (lowerText.includes(keyword)) {
        const context = this.extractContext(text, keyword);
        aspects.push({ name: aspect, context, mentions: this.countMentions(text, keyword) });
      }
    }

    return aspects;
  }

  private async analyzeAspectSentiments(
    text: string,
    aspects: Aspect[]
  ): Promise<AspectSentiment[]> {
    return aspects.map(aspect => ({
      ...aspect,
      sentiment: this.analyzeAspectContext(aspect.context)
    }));
  }
}

// 情感结果
interface SentimentResult {
  overall: {
    score: number;                    // -1 到 1
    label: 'positive' | 'neutral' | 'negative';
    confidence: number;
  };
  aspects: AspectSentiment[];
  highlights: string[];
}

// 方面
interface Aspect {
  name: string;
  context: string;
  mentions: number;
}

// 方面情感
interface AspectSentiment extends Aspect {
  sentiment: {
    score: number;
    label: 'positive' | 'neutral' | 'negative';
  };
}
```

## 聚合与洞察

### 聚合分析

```typescript
// 反馈聚合器
class FeedbackAggregator {
  constructor(private db: Database) {}

  // 聚合分析
  async aggregate(
    filter: AggregateFilter,
    groupBy: string[]
  ): Promise<AggregateResult> {
    // 1. 获取原始数据
    const feedbacks = await this.fetchFeedbacks(filter);

    // 2. 按维度聚合
    const dimensions = this.groupByDimensions(feedbacks, groupBy);

    // 3. 计算指标
    const metrics = this.calculateMetrics(dimensions);

    // 4. 趋势分析
    const trends = await this.analyzeTrends(feedbacks, groupBy);

    // 5. 异常检测
    const anomalies = this.detectAnomalies(dimensions);

    return {
      summary: this.generateSummary(metrics),
      dimensions,
      trends,
      anomalies,
      insights: await this.generateInsights(dimensions, trends)
    };
  }

  // 按时间聚合
  async aggregateByTime(
    filter: AggregateFilter,
    interval: 'hour' | 'day' | 'week' | 'month'
  ): Promise<TimeSeriesData> {
    const feedbacks = await this.fetchFeedbacks({
      ...filter,
      timeRange: filter.timeRange
    });

    const buckets = this.createTimeBuckets(feedbacks, interval);

    return {
      interval,
      buckets: buckets.map(bucket => ({
        timestamp: bucket.key,
        count: bucket.feedbacks.length,
        avgRating: this.calculateAvgRating(bucket.feedbacks),
        sentiment: this.aggregateSentiment(bucket.feedbacks),
        topCategories: this.getTopCategories(bucket.feedbacks, 3)
      }))
    };
  }

  // 按项目聚合
  async aggregateByProject(projectId: string): Promise<ProjectFeedbackAnalysis> {
    const feedbacks = await this.fetchFeedbacks({ projectId });

    return {
      projectId,
      totalFeedbacks: feedbacks.length,
      avgRating: this.calculateAvgRating(feedbacks),
      sentimentDistribution: this.getSentimentDistribution(feedbacks),
      categoryDistribution: this.getCategoryDistribution(feedbacks),
      topIssues: this.getTopIssues(feedbacks, 5),
      recentFeedbacks: feedbacks.slice(0, 10),
      trend: await this.calculateTrend(projectId)
    };
  }

  // 生成洞察
  private async generateInsights(
    dimensions: DimensionData,
    trends: TrendData
  ): Promise<Insight[]> {
    const insights: Insight[] = [];

    // 负面趋势洞察
    if (trends.negativeTrends.length > 0) {
      insights.push({
        type: 'negative_trend',
        title: '负面趋势检测',
        description: `以下方面呈现负面趋势: ${trends.negativeTrends.join(', ')}`,
        severity: 'warning',
        recommendations: trends.negativeTrends.map(t => `分析${t}下降原因并制定改进计划`)
      });
    }

    // 聚类问题洞察
    const clusteredIssues = this.clusterSimilarIssues(dimensions);
    if (clusteredIssues.length > 0) {
      insights.push({
        type: 'clustered_issue',
        title: '集中问题发现',
        description: `发现${clusteredIssues.length}个集中问题簇`,
        details: clusteredIssues.slice(0, 3),
        severity: 'info'
      });
    }

    // 改进机会洞察
    const opportunities = this.identifyOpportunities(dimensions);
    insights.push({
      type: 'opportunity',
      title: '改进机会',
      description: '基于用户反馈识别的改进机会',
      opportunities,
      severity: 'info'
    });

    return insights;
  }
}

// 聚合过滤器
interface AggregateFilter {
  timeRange?: {
    start: Date;
    end: Date;
  };
  projectIds?: string[];
  types?: FeedbackType[];
  categories?: string[];
  sentiment?: ('positive' | 'neutral' | 'negative')[];
  priority?: FeedbackPriority[];
  status?: FeedbackStatus[];
}

// 聚合结果
interface AggregateResult {
  summary: {
    total: number;
    avgRating: number;
    sentimentDistribution: Record<string, number>;
    categoryDistribution: Record<string, number>;
  };
  dimensions: DimensionData[];
  trends: TrendData;
  anomalies: Anomaly[];
  insights: Insight[];
}
```

### 趋势分析

```typescript
// 趋势分析
class TrendAnalyzer {
  // 检测趋势
  async detectTrends(
    data: TimeSeriesData,
    config: TrendConfig
  ): Promise<Trend[]> {
    const trends: Trend[] = [];

    for (const metric of config.metrics) {
      const values = data.buckets.map(b => b[metric]);

      // 线性回归
      const regression = this.linearRegression(values);

      // 检测趋势
      if (Math.abs(regression.slope) > config.minSlope) {
        trends.push({
          metric,
          direction: regression.slope > 0 ? 'increasing' : 'decreasing',
          slope: regression.slope,
          significance: regression.rSquared,
          label: this.getTrendLabel(regression.slope, regression.rSquared),
          forecast: this.forecast(values, config.forecastPeriods)
        });
      }

      // 检测突变
      const changepoints = this.detectChangepoints(values);
      for (const point of changepoints) {
        trends.push({
          metric,
          direction: 'changepoint',
          changepoint: point,
          severity: 'warning'
        });
      }
    }

    return trends;
  }

  // 预测
  private forecast(values: number[], periods: number): Forecast[] {
    const regression = this.linearRegression(values);
    const lastValue = values[values.length - 1];

    return Array.from({ length: periods }, (_, i) => ({
      period: i + 1,
      predicted: lastValue + regression.slope * (i + 1),
      confidence: 1 - (i + 1) / (values.length + periods)  // 置信度随时间下降
    }));
  }
}

// 趋势
interface Trend {
  metric: string;
  direction: 'increasing' | 'decreasing' | 'stable' | 'changepoint';
  slope?: number;
  significance?: number;
  label?: string;
  forecast?: Forecast[];
  changepoint?: number;
  severity?: 'info' | 'warning' | 'critical';
}
```

## 学习集成

### 反馈驱动的学习

```typescript
// 学习服务
class FeedbackLearningService {
  constructor(
    private experienceStore: ExperienceStore,
    private promptOptimizer: PromptOptimizer,
    private componentRegistry: ComponentRegistry
  ) {}

  // 处理反馈并学习
  async learnFromFeedback(feedback: Feedback): Promise<LearningResult> {
    const results: LearningResult[] = [];

    // 1. 分析反馈
    const analysis = await this.analyzeFeedback(feedback);

    // 2. 更新经验库
    if (analysis.shouldUpdateExperience) {
      await this.experienceStore.record({
        type: 'feedback',
        source: feedback.id,
        content: analysis.insights,
        timestamp: new Date()
      });
    }

    // 3. 优化Prompt
    if (analysis.promptImprovements.length > 0) {
      const promptResult = await this.promptOptimizer.improve({
        currentPrompts: analysis.relatedPrompts,
        feedback: analysis.feedbackInsights,
        expectedImprovement: analysis.promptImprovements
      });
      results.push(promptResult);
    }

    // 4. 更新组件评分
    if (feedback.relatedComponents) {
      await this.updateComponentScores(feedback);
    }

    // 5. 识别模式
    if (analysis.patterns.length > 0) {
      await this.recordPatterns(analysis.patterns);
    }

    return this.mergeResults(results);
  }

  // 批量学习
  async learnFromFeedbackBatch(
    feedbacks: Feedback[],
    options: BatchLearningOptions
  ): Promise<BatchLearningResult> {
    // 1. 聚类相似反馈
    const clusters = await this.clusterFeedbacks(feedbacks);

    // 2. 提取共同模式
    const patterns = await this.extractPatterns(clusters);

    // 3. 生成改进建议
    const suggestions = await this.generateImprovements(patterns);

    // 4. 应用改进
    const applied = await this.applyImprovements(suggestions, options);

    return {
      clustersProcessed: clusters.length,
      patternsExtracted: patterns.length,
      suggestionsGenerated: suggestions.length,
      improvementsApplied: applied.length,
      estimatedImpact: this.estimateImpact(applied)
    };
  }
}

// 经验存储
interface ExperienceStore {
  record(experience: Experience): Promise<void>;
  retrieve(filter: ExperienceFilter): Promise<Experience[]>;
  findSimilar(context: LearningContext): Promise<Experience[]>;
  update(id: string, updates: Partial<Experience>): Promise<void>;
}

// 经验
interface Experience {
  id: string;
  type: 'feedback' | 'success' | 'failure' | 'pattern';
  content: any;
  context: LearningContext;
  timestamp: Date;
  usefulness: number;
  validated: boolean;
}

// 学习上下文
interface LearningContext {
  projectType?: string;
  techStack?: string[];
  domain?: string;
  task?: string;
  constraints?: string[];
}
```

## 可视化与报表

### 仪表板数据

```typescript
// 反馈仪表板
interface FeedbackDashboard {
  // 概览指标
  overview: {
    totalFeedbacks: number;
    avgRating: number;
    sentimentDistribution: Record<string, number>;
    trend: 'improving' | 'stable' | 'declining';
  };

  // 实时指标
  realtime: {
    feedbacksToday: number;
    feedbacksThisWeek: number;
    pendingReviews: number;
    unresolvedIssues: number;
  };

  // 分类分布
  categories: {
    distribution: Record<string, number>;
    trend: Record<string, Trend>;
    topIssues: Issue[];
  };

  // 项目排名
  projectRankings: {
    byRating: ProjectMetric[];
    byVolume: ProjectMetric[];
    byTrend: ProjectMetric[];
    byResolution: ProjectMetric[];
  };

  // 团队绩效
  teamPerformance: {
    avgResolutionTime: number;
    resolutionRate: number;
    backlogSize: number;
    teamLoad: Record<string, number>;
  };

  // 趋势图表
  charts: {
    feedbackOverTime: TimeSeriesData;
    ratingDistribution: HistogramData;
    categoryTrend: StackedAreaData;
    resolutionTime: BoxPlotData;
  };

  // 最新反馈
  recentFeedbacks: Feedback[];

  // 待处理事项
  actionItems: ActionItem[];
}
```

### 报表生成

```typescript
// 报表服务
class ReportService {
  // 生成日报
  async generateDailyReport(date: Date): Promise<DailyReport> {
    return {
      date,
      summary: await this.getDailySummary(date),
      highlights: await this.getDailyHighlights(date),
      issues: await this.getDailyIssues(date),
      trend: await this.getDailyTrend(date),
      recommendations: await this.getRecommendations(date)
    };
  }

  // 生成周报
  async generateWeeklyReport(
    startDate: Date,
    endDate: Date
  ): Promise<WeeklyReport> {
    return {
      period: { start: startDate, end: endDate },
      overview: await this.getWeeklyOverview(startDate, endDate),
      comparisons: await this.compareToPreviousWeek(startDate, endDate),
      trends: await this.analyzeWeeklyTrends(startDate, endDate),
      topIssues: await this.getTopWeeklyIssues(startDate, endDate, 10),
      actionPlan: await this.generateActionPlan(startDate, endDate)
    };
  }

  // 生成专题报告
  async generateTopicReport(
    topic: string,
    timeRange: TimeRange
  ): Promise<TopicReport> {
    return {
      topic,
      timeRange,
      summary: await this.getTopicSummary(topic, timeRange),
      feedbackAnalysis: await this.analyzeTopicFeedbacks(topic, timeRange),
      rootCauses: await this.analyzeRootCauses(topic, timeRange),
      recommendations: await this.generateTopicRecommendations(topic, timeRange)
    };
  }
}
```

## 集成方案

### 与生成系统集成

```typescript
// 反馈集成
class GenerationFeedbackIntegrator {
  constructor(
    private feedbackCollector: FeedbackCollector,
    private learningService: FeedbackLearningService
  ) {}

  // 收集生成结果反馈
  async collectGenerationFeedback(
    generationId: string,
    result: GenerationResult
  ): Promise<void> {
    // 1. 收集构建结果
    if (!result.buildSuccess) {
      await this.feedbackCollector.submit('automated', {
        type: 'build_results',
        generationId,
        structuredData: {
          errorType: result.errorType,
          errorMessage: result.errorMessage,
          errorLog: result.errorLog
        }
      });
    }

    // 2. 收集测试结果
    if (result.testResults) {
      await this.feedbackCollector.submit('automated', {
        type: 'test_results',
        generationId,
        structuredData: result.testResults
      });
    }

    // 3. 收集质量指标
    await this.feedbackCollector.submit('automated', {
      type: 'generation_quality',
      generationId,
      structuredData: {
        coverage: result.metrics.coverage,
        complexity: result.metrics.complexity,
        maintainability: result.metrics.maintainability
      }
    });
  }

  // 处理用户评分反馈
  async processUserFeedback(
    feedback: UserFeedback
  ): Promise<void> {
    // 1. 收集反馈
    await this.feedbackCollector.submit('inline', feedback);

    // 2. 触发学习
    await this.learningService.learnFromFeedback(feedback);
  }
}
```

## 配置

```typescript
// 反馈系统配置
interface FeedbackConfig {
  // 收集配置
  collection: {
    enabled: boolean;
    channels: {
      inline: boolean;
      external: boolean;
      automated: boolean;
    };
    batchInterval: number;           // 批处理间隔 (ms)
    maxQueueSize: number;           // 最大队列大小
  };

  // 分析配置
  analysis: {
    enabled: boolean;
    sentiment: {
      enabled: boolean;
      provider: 'openai' | 'local';
    };
    classification: {
      enabled: boolean;
      customCategories: string[];
    };
    autoTagging: {
      enabled: boolean;
      maxTags: number;
    };
  };

  // 处理配置
  processing: {
    autoTriage: boolean;
    autoAssign: boolean;
    assignmentRules: AssignmentRule[];
    escalationRules: EscalationRule[];
  };

  // 学习配置
  learning: {
    enabled: boolean;
    minConfidenceThreshold: number;
    learningInterval: number;       // 学习间隔 (小时)
    maxExperiencesPerCycle: number;
  };

  // 通知配置
  notifications: {
    enabled: boolean;
    channels: string[];
    rules: NotificationRule[];
  };

  // 保留策略
  retention: {
    rawFeedbackDays: number;        // 原始反馈保留天数
    analyzedFeedbackDays: number;  // 分析后保留天数
    aggregatedDataDays: number;     // 聚合数据保留天数
  };
}
```

## 最佳实践

### 1. 反馈收集

```
- 简化提交流程，降低用户参与门槛
- 在关键时刻主动邀请反馈
- 提供多种反馈渠道满足不同用户习惯
- 保护用户隐私，处理数据脱敏
```

### 2. 分析处理

```
- 及时响应用户反馈，建立信任
- 区分表面症状和根本原因
- 优先处理高频问题和严重问题
- 记录分析过程，便于回顾和改进
```

### 3. 持续学习

```
- 将反馈闭环作为系统改进的依据
- 验证改进效果，形成反馈闭环
- 定期回顾反馈趋势，调整策略
- 建立反馈知识库，积累经验
```

---

**最后更新**: 2026-04-15
