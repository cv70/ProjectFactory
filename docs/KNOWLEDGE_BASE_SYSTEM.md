# 知识库系统详细设计

## 1. 知识库架构

### 1.1 知识库系统定位

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           知识库系统定位                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      生成流程                                         │   │
│  │                                                                       │   │
│  │   需求 → 创意 → 架构 → 代码 → 测试 → 审查 → 部署                    │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↑                                        │
│                                    │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      知识库系统                                         │   │
│  │                                                                       │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │   │
│  │   │  代码模式    │  │  最佳实践   │  │  失败案例   │                │   │
│  │   │  Code       │  │  Best      │  │  Failure    │                │   │
│  │   │  Patterns   │  │  Practices │  │  Cases      │                │   │
│  │   └─────────────┘  └─────────────┘  └─────────────┘                │   │
│  │                                                                       │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │   │
│  │   │  架构模式    │  │  领域知识   │  │  技术栈知识  │                │   │
│  │   │  Arch       │  │  Domain     │  │  Tech       │                │   │
│  │   │  Patterns   │  │  Knowledge  │  │  Stack      │                │   │
│  │   └─────────────┘  └─────────────┘  └─────────────┘                │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↑                                        │
│                                    │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      应用流程                                         │   │
│  │                                                                       │   │
│  │   检索 ← 相关知识 ← 上下文匹配 ← 知识推荐                             │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 知识库分层架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           知识库分层架构                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        API 层                                          │   │
│  │                                                                       │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │   │
│  │   │  REST API  │  │  GraphQL   │  │  WebSocket │                │   │
│  │   │  接口       │  │  接口       │  │  实时推送   │                │   │
│  │   └─────────────┘  └─────────────┘  └─────────────┘                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       服务层                                          │   │
│  │                                                                       │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │   │
│  │   │  Knowledge  │  │  Pattern   │  │  Similarity │                │   │
│  │   │  Service   │  │  Engine   │  │  Search     │                │   │
│  │   └─────────────┘  └─────────────┘  └─────────────┘                │   │
│  │                                                                       │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │   │
│  │   │  Extractor │  │  Validator │  │  Ranker    │                │   │
│  │   │  提取器     │  │  验证器     │  │  排序器     │                │   │
│  │   └─────────────┘  └─────────────┘  └─────────────┘                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       存储层                                          │   │
│  │                                                                       │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │   │
│  │   │  SQLite    │  │  Vector    │  │  File      │                │   │
│  │   │  (元数据)  │  │  Index     │  │  Storage   │                │   │
│  │   │            │  │  (向量索引) │  │  (代码存储) │                │   │
│  │   └─────────────┘  └─────────────┘  └─────────────┘                │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. 知识分类体系

### 2.1 知识类型定义

```typescript
// 知识类型枚举
enum KnowledgeType {
  // 代码模式
  CODE_PATTERN = 'code_pattern',           // 可复用的代码片段/模板
  ARCHITECTURE_PATTERN = 'architecture_pattern',  // 架构设计模式
  DESIGN_PATTERN = 'design_pattern',        // GoF 设计模式应用

  // 最佳实践
  BEST_PRACTICE = 'best_practice',         // 行业最佳实践
  CODING_STANDARD = 'coding_standard',    // 编码规范
  SECURITY_PRACTICE = 'security_practice', // 安全实践

  // 失败案例
  FAILURE_CASE = 'failure_case',            // 失败案例分析
  PITFALL = 'pitfall',                    // 常见陷阱
  LESSON_LEARNED = 'lesson_learned',      // 经验教训

  // 领域知识
  DOMAIN_KNOWLEDGE = 'domain_knowledge',   // 垂直领域知识
  TECH_STACK = 'tech_stack',              // 技术栈知识
  API_DESIGN = 'api_design',              // API 设计规范

  // 执行知识
  EXECUTION_TRACE = 'execution_trace',     // 执行轨迹
  OPTIMIZATION = 'optimization'            // 优化经验
}

// 知识条目结构
interface KnowledgeEntry {
  id: string;
  type: KnowledgeType;

  // 内容
  title: string;
  content: string;           // 主要描述
  code?: string;            // 代码示例

  // 语义信息
  summary: string;          // 摘要
  keywords: string[];
  tags: string[];

  // 向量表示
  embedding?: number[];     // 用于语义搜索

  // 来源信息
  source: {
    type: 'project' | 'user' | 'system' | 'learning';
    projectId?: string;
    author: string;
    createdAt: Date;
    confidence?: number;     // 知识置信度
  };

  // 质量信息
  quality: {
    score: number;          // 质量评分 0-100
    usageCount: number;     // 被使用次数
    successRate: number;    // 应用成功率
    lastUsed?: Date;
    validated: boolean;    // 是否经过验证
  };

  // 关联信息
  relations: {
    relatedIds: string[];  // 关联知识 ID
    projectIds: string[];  // 关联项目 ID
    patternIds: string[];  // 关联模式 ID
  };

  // 有效性
  validity: {
    isActive: boolean;
    expiresAt?: Date;
    deprecatedBy?: string;
    version: string;
  };

  // 元数据
  metadata: {
    language?: string;
    framework?: string;
    complexity?: 'low' | 'medium' | 'high';
    effort?: number;        // 实施成本 1-10
  };

  // 时间戳
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 知识关系图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           知识关系图                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                         ┌─────────────────┐                                │
│                         │  代码模式 #001   │                                │
│                         │  useAsyncData   │                                │
│                         └────────┬────────┘                                │
│                                  │                                           │
│         ┌───────────────────────┼───────────────────────┐                  │
│         │                       │                       │                  │
│         ▼                       ▼                       ▼                  │
│  ┌─────────────┐        ┌─────────────┐        ┌─────────────┐            │
│  │ API 模式 #012│        │ React 模式 #03 │        │ Hook 模式 #04│            │
│  │ 数据获取     │        │ 组件设计     │        │ 自定义Hooks │            │
│  └──────┬──────┘        └──────┬──────┘        └──────┬──────┘            │
│         │                       │                       │                  │
│         └───────────────────────┼───────────────────────┘                  │
│                                 ▼                                          │
│                         ┌─────────────────┐                                │
│                         │  最佳实践 #100  │                                │
│                         │  React 数据获取  │                                │
│                         └────────┬────────┘                                │
│                                  │                                           │
│                                  ▼                                          │
│                         ┌─────────────────┐                                │
│                         │  失败案例 #200  │                                │
│                         │  内存泄漏问题    │                                │
│                         └─────────────────┘                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 3. 知识提取

### 3.1 提取策略

```typescript
// 知识提取器

interface ExtractionStrategy {
  type: KnowledgeType;
  trigger: ExtractionTrigger;
  processor: ExtractorProcessor;
  validator: ExtractorValidator;
}

type ExtractionTrigger =
  | 'on_success'        // 项目成功完成后
  | 'on_failure'       // 项目失败时
  | 'on_iteration'      // 每次迭代后
  | 'manual'           // 手动触发
  | 'scheduled';       // 定时触发

// 提取策略定义
const extractionStrategies: ExtractionStrategy[] = [
  {
    type: KnowledgeType.CODE_PATTERN,
    trigger: 'on_success',
    processor: extractCodePattern,
    validator: validateCodePattern
  },
  {
    type: KnowledgeType.FAILURE_CASE,
    trigger: 'on_failure',
    processor: extractFailureCase,
    validator: validateFailureCase
  },
  {
    type: KnowledgeType.BEST_PRACTICE,
    trigger: 'on_iteration',
    processor: extractBestPractice,
    validator: validateBestPractice
  },
  {
    type: KnowledgeType.ARCHITECTURE_PATTERN,
    trigger: 'on_success',
    processor: extractArchitecturePattern,
    validator: validateArchitecture
  }
];

// 代码模式提取
async function extractCodePattern(context: ExtractionContext): Promise<KnowledgeEntry[]> {
  const patterns: KnowledgeEntry[] = [];
  const { codebase, projectId } = context;

  for (const file of codebase.files) {
    // 1. 识别代码结构
    const structures = identifyCodeStructures(file);

    for (const structure of structures) {
      // 2. 评估是否值得提取
      if (await shouldExtract(structure)) {
        // 3. 提取模式
        const pattern = await createPatternEntry(structure, projectId);

        // 4. 验证
        if (await validateCodePattern(pattern)) {
          patterns.push(pattern);
        }
      }
    }
  }

  return patterns;
}

// 代码结构识别
function identifyCodeStructures(file: SourceFile): CodeStructure[] {
  const structures: CodeStructure[] = [];

  // 1. 函数/方法
  for (const func of file.functions) {
    if (isComplexEnough(func)) {
      structures.push({
        type: 'function',
        name: func.name,
        ast: func,
        metrics: calculateComplexity(func)
      });
    }
  }

  // 2. 类
  for (const cls of file.classes) {
    structures.push({
      type: 'class',
      name: cls.name,
      ast: cls,
      methods: cls.methods.length
    });
  }

  // 3. React 组件/Hooks
  for (const component of file.reactComponents) {
    structures.push({
      type: 'react_component',
      name: component.name,
      hooks: component.hooks,
      props: component.props
    });
  }

  return structures;
}

// 模式质量评估
async function shouldExtract(structure: CodeStructure): Promise<boolean> {
  const metrics = structure.metrics;

  // 复杂度适中（不太简单也不太复杂）
  if (metrics.lines < 10 || metrics.lines > 200) return false;

  // 圈复杂度适中
  if (metrics.cyclomaticComplexity < 2 || metrics.cyclomaticComplexity > 15) return false;

  // 有足够的注释
  if (metrics.commentRatio < 0.1) return false;

  // 可复用性评估
  const reusabilityScore = await evaluateReusability(structure);
  if (reusabilityScore < 0.6) return false;

  return true;
}
```

### 3.2 失败案例提取

```typescript
// 失败案例提取

interface FailureCase {
  id: string;
  type: 'runtime_error' | 'logic_error' | 'quality_error' | 'timeout_error';
  severity: 'critical' | 'high' | 'medium' | 'low';

  // 问题描述
  problem: {
    summary: string;
    symptoms: string[];
    errorMessage?: string;
  };

  // 根因分析
  rootCause: {
    location: string;       // 代码位置
    category: string;       // 问题类别
    description: string;
    explanation: string;
  };

  // 解决方案
  solution: {
    approach: string;
    codeChanges?: string;
    steps: string[];
  };

  // 预防措施
  prevention: {
    checks: string[];
    patterns: string[];
    tests: string[];
  };

  // 关联
  context: {
    projectId: string;
    stage: string;
    agent?: string;
  };
}

// 失败案例提取器
async function extractFailureCase(
  project: Project,
  error: ProjectError
): Promise<FailureCase> {
  // 1. 分析错误类型
  const errorType = classifyError(error);

  // 2. 定位根因
  const rootCause = await analyzeRootCause(error);

  // 3. 生成解决方案
  const solution = await generateSolution(error, rootCause);

  // 4. 提取预防措施
  const prevention = await extractPrevention(error, rootCause);

  return {
    id: generateId(),
    type: errorType,
    severity: assessSeverity(error),
    problem: {
      summary: summarizeProblem(error),
      symptoms: extractSymptoms(error),
      errorMessage: error.message
    },
    rootCause: {
      location: rootCause.location,
      category: rootCause.category,
      description: rootCause.description,
      explanation: rootCause.explanation
    },
    solution: {
      approach: solution.approach,
      codeChanges: solution.codeChanges,
      steps: solution.steps
    },
    prevention: {
      checks: prevention.checks,
      patterns: prevention.patterns,
      tests: prevention.tests
    },
    context: {
      projectId: project.id,
      stage: project.stage,
      agent: error.agent
    }
  };
}

// 错误分类
function classifyError(error: ProjectError): FailureCase['type'] {
  if (error.code === 'ETIMEDOUT' || error.code === 'ETIME') {
    return 'timeout_error';
  }

  if (error instanceof TypeError || error instanceof ReferenceError) {
    return 'runtime_error';
  }

  if (error.category === 'quality' || error.category === 'coverage') {
    return 'quality_error';
  }

  return 'logic_error';
}

// 根因分析
async function analyzeRootCause(error: ProjectError): Promise<FailureCase['rootCause']> {
  // 使用 LLM 分析根因
  const chain = llm.withStructuredOutput(RootCauseSchema);

  const analysis = await chain.invoke({
    error: {
      message: error.message,
      stack: error.stack,
      context: error.context
    },
    code: await getRelevantCode(error.location)
  });

  return {
    location: analysis.location,
    category: analysis.category,
    description: analysis.description,
    explanation: analysis.explanation
  };
}
```

## 4. 知识检索

### 4.1 多维度检索

```typescript
// 知识检索服务

interface RetrievalQuery {
  // 文本查询
  text?: string;

  // 向量查询
  embedding?: number[];
  similarityThreshold?: number;

  // 过滤条件
  filters?: {
    types?: KnowledgeType[];
    tags?: string[];
    language?: string;
    framework?: string;
    minQualityScore?: number;
    isValidated?: boolean;
    dateRange?: {
      start: Date;
      end: Date;
    };
  };

  // 分页
  limit?: number;
  offset?: number;

  // 排序
  sortBy?: 'relevance' | 'quality' | 'usage' | 'recency';
}

interface RetrievalResult {
  knowledge: KnowledgeEntry;
  score: number;            // 相关性分数
  matchType: 'semantic' | 'keyword' | 'exact';
  highlights?: string[];   // 匹配高亮
  explanation?: string;     // 为什么匹配
}

// 多维度检索
class KnowledgeRetriever {
  // 语义检索
  async semanticSearch(
    query: string,
    options?: RetrievalOptions
  ): Promise<RetrievalResult[]>;

  // 关键词检索
  async keywordSearch(
    keywords: string[],
    options?: RetrievalOptions
  ): Promise<RetrievalResult[]>;

  // 混合检索
  async hybridSearch(
    query: RetrievalQuery,
    options?: RetrievalOptions
  ): Promise<RetrievalResult[]>;

  // 上下文感知检索
  async contextualSearch(
    context: RetrievalContext,
    options?: RetrievalOptions
  ): Promise<RetrievalResult[]>;
}

// 混合检索实现
async hybridSearch(
  query: RetrievalQuery,
  options?: RetrievalOptions
): Promise<RetrievalResult[]> {
  const results: RetrievalResult[] = [];
  const seen = new Set<string>();

  // 1. 语义搜索
  if (query.text || query.embedding) {
    const semanticResults = await this.semanticSearch(
      query.text || '',
      { ...options, embedding: query.embedding }
    );

    for (const result of semanticResults) {
      results.push({ ...result, matchType: 'semantic' });
      seen.add(result.knowledge.id);
    }
  }

  // 2. 关键词搜索
  if (query.filters?.tags || query.text) {
    const keywords = query.filters?.tags ||
      extractKeywords(query.text!);

    const keywordResults = await this.keywordSearch(keywords, options);

    for (const result of keywordResults) {
      if (!seen.has(result.knowledge.id)) {
        results.push({ ...result, matchType: 'keyword' });
        seen.add(result.knowledge.id);
      }
    }
  }

  // 3. 过滤
  let filtered = this.applyFilters(results, query.filters);

  // 4. 排序
  filtered = this.sortResults(filtered, query.sortBy);

  // 5. 分页
  const offset = query.offset || 0;
  const limit = query.limit || 20;

  return filtered.slice(offset, offset + limit);
}

// 上下文感知检索
async contextualSearch(
  context: RetrievalContext
): Promise<RetrievalResult[]> {
  // 1. 从上下文提取查询
  const { project, stage, language, framework } = context;

  // 2. 构建上下文查询
  const query: RetrievalQuery = {
    text: buildContextQuery(project, stage),
    filters: {
      language,
      framework,
      minQualityScore: 70,
      isValidated: true
    },
    limit: 10
  };

  // 3. 执行检索
  const results = await this.hybridSearch(query);

  // 4. 添加上下文相关性分数
  for (const result of results) {
    result.score *= calculateContextRelevance(result.knowledge, context);
  }

  // 5. 重新排序
  return results.sort((a, b) => b.score - a.score);
}
```

### 4.2 知识推荐

```typescript
// 知识推荐系统

interface RecommendationContext {
  project: {
    id: string;
    type: ProjectType;
    language: string;
    framework?: string;
  };
  stage: ProjectStage;
  currentTask?: string;
  previousKnowledge?: string[];
}

class KnowledgeRecommender {
  // 基于上下文的推荐
  async recommend(context: RecommendationContext): Promise<KnowledgeRecommendation[]> {
    const recommendations: KnowledgeRecommendation[] = [];

    // 1. 阶段相关推荐
    const stageRecommendations = await this.getStageRecommendations(context);
    recommendations.push(...stageRecommendations);

    // 2. 类型相关推荐
    const typeRecommendations = await this.getTypeRecommendations(context);
    recommendations.push(...typeRecommendations);

    // 3. 相似项目推荐
    const similarRecommendations = await this.getSimilarProjectRecommendations(context);
    recommendations.push(...similarRecommendations);

    // 4. 去重和排序
    return this.deduplicateAndRank(recommendations);
  }

  // 阶段推荐
  private async getStageRecommendations(
    context: RecommendationContext
  ): Promise<KnowledgeRecommendation[]> {
    // 每个阶段有对应的推荐知识
    const stageKnowledgeMap: Record<ProjectStage, KnowledgeType[]> = {
      ideation: [KnowledgeType.DOMAIN_KNOWLEDGE],
      architecture: [
        KnowledgeType.ARCHITECTURE_PATTERN,
        KnowledgeType.API_DESIGN
      ],
      coding: [
        KnowledgeType.CODE_PATTERN,
        KnowledgeType.BEST_PRACTICE,
        KnowledgeType.DESIGN_PATTERN
      ],
      testing: [
        KnowledgeType.BEST_PRACTICE,
        KnowledgeType.CODING_STANDARD
      ],
      reviewing: [
        KnowledgeType.CODING_STANDARD,
        KnowledgeType.SECURITY_PRACTICE
      ],
      deploying: [
        KnowledgeType.TECH_STACK,
        KnowledgeType.BEST_PRACTICE
      ]
    };

    const types = stageKnowledgeMap[context.stage] || [];

    const results = await this.retriever.hybridSearch({
      filters: {
        types,
        language: context.project.language,
        framework: context.project.framework,
        minQualityScore: 60
      },
      limit: 5
    });

    return results.map(r => ({
      knowledge: r.knowledge,
      reason: `Recommended for ${context.stage} stage`,
      priority: 'high',
      score: r.score
    }));
  }
}
```

## 5. 知识质量

### 5.1 质量评估

```typescript
// 知识质量评估

interface QualityMetrics {
  accuracy: number;         // 准确性
  completeness: number;     // 完整性
  relevance: number;        // 相关性
  reliability: number;      // 可靠性
  overall: number;         // 综合评分
}

class KnowledgeQualityAssessor {
  // 评估知识质量
  async assess(knowledge: KnowledgeEntry): Promise<QualityMetrics> {
    const [accuracy, completeness, relevance, reliability] = await Promise.all([
      this.assessAccuracy(knowledge),
      this.assessCompleteness(knowledge),
      this.assessRelevance(knowledge),
      this.assessReliability(knowledge)
    ]);

    const overall = (
      accuracy * 0.3 +
      completeness * 0.2 +
      relevance * 0.3 +
      reliability * 0.2
    );

    return { accuracy, completeness, relevance, reliability, overall };
  }

  // 准确性评估
  private async assessAccuracy(knowledge: KnowledgeEntry): Promise<number> {
    let score = 0.5;  // 基础分

    // 来源可靠性
    if (knowledge.source.type === 'system') score += 0.2;
    else if (knowledge.source.type === 'learning') score += 0.15;
    else if (knowledge.source.type === 'user') score += 0.1;

    // 验证状态
    if (knowledge.quality.validated) score += 0.2;

    // 代码正确性（如果是代码模式）
    if (knowledge.code) {
      const isValid = await this.validateCode(knowledge.code);
      if (isValid) score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  // 完整性评估
  private async assessCompleteness(knowledge: KnowledgeEntry): Promise<number> {
    let score = 0;
    let maxScore = 0;

    // 必填字段
    maxScore += 0.3;
    if (knowledge.title) score += 0.1;
    if (knowledge.content) score += 0.1;
    if (knowledge.summary) score += 0.1;

    // 代码示例
    maxScore += 0.2;
    if (knowledge.code) score += 0.2;

    // 标签
    maxScore += 0.2;
    if (knowledge.tags.length >= 3) score += 0.2;
    else if (knowledge.tags.length > 0) score += 0.1;

    // 元数据
    maxScore += 0.3;
    if (knowledge.keywords.length >= 5) score += 0.15;
    if (knowledge.metadata.language) score += 0.1;
    if (knowledge.metadata.complexity) score += 0.05;

    return score / maxScore;
  }
}
```

### 5.2 知识验证

```typescript
// 知识验证系统

interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  suggestedFixes?: string[];
}

interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  location?: string;
}

class KnowledgeValidator {
  // 验证知识条目
  async validate(knowledge: KnowledgeEntry): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];

    // 1. 基本验证
    issues.push(...this.validateBasicFields(knowledge));

    // 2. 内容验证
    issues.push(...this.validateContent(knowledge));

    // 3. 代码验证（如果是代码模式）
    if (knowledge.code) {
      issues.push(...await this.validateCode(knowledge));
    }

    // 4. 向量验证
    issues.push(...this.validateEmbedding(knowledge));

    // 5. 关联验证
    issues.push(...this.validateRelations(knowledge));

    const errors = issues.filter(i => i.severity === 'error');

    return {
      valid: errors.length === 0,
      issues,
      suggestedFixes: this.generateFixes(issues)
    };
  }

  // 基本字段验证
  private validateBasicFields(knowledge: KnowledgeEntry): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!knowledge.title || knowledge.title.length < 5) {
      issues.push({
        severity: 'error',
        code: 'TITLE_TOO_SHORT',
        message: 'Title must be at least 5 characters'
      });
    }

    if (!knowledge.content || knowledge.content.length < 50) {
      issues.push({
        severity: 'warning',
        code: 'CONTENT_TOO_SHORT',
        message: 'Content should be at least 50 characters'
      });
    }

    if (knowledge.tags.length === 0) {
      issues.push({
        severity: 'warning',
        code: 'NO_TAGS',
        message: 'At least one tag is recommended'
      });
    }

    return issues;
  }

  // 代码验证
  private async validateCode(knowledge: KnowledgeEntry): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    if (!knowledge.code) return issues;

    // 语法检查
    try {
      parseSyntax(knowledge.code, knowledge.metadata.language);
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'INVALID_SYNTAX',
        message: `Syntax error: ${error.message}`,
        location: error.location
      });
    }

    // 安全检查
    const securityIssues = await this.checkSecurity(knowledge.code);
    issues.push(...securityIssues);

    // 最佳实践检查
    const practiceIssues = await this.checkBestPractices(knowledge.code, knowledge.metadata.language);
    issues.push(...practiceIssues);

    return issues;
  }
}
```

## 6. 知识应用

### 6.1 生成时知识应用

```typescript
// 生成时知识应用

class KnowledgeApplicator {
  // 在代码生成时检索和应用相关知识
  async applyToGeneration(
    context: GenerationContext
  ): Promise<AppliedKnowledge[]> {
    const applied: AppliedKnowledge[] = [];

    // 1. 检索相关知识
    const relevant = await this.retriever.contextualSearch({
      project: context.project,
      stage: context.stage,
      language: context.language,
      framework: context.framework
    });

    // 2. 选择最相关的知识
    const selected = this.selectMostRelevant(relevant, context);

    // 3. 应用到生成
    for (const knowledge of selected) {
      const appliedItem = await this.applyKnowledge(knowledge, context);
      if (appliedItem) {
        applied.push(appliedItem);
      }
    }

    return applied;
  }

  // 应用知识到上下文
  private async applyKnowledge(
    knowledge: KnowledgeEntry,
    context: GenerationContext
  ): Promise<AppliedKnowledge | null> {
    switch (knowledge.type) {
      case KnowledgeType.CODE_PATTERN:
        return this.applyCodePattern(knowledge, context);

      case KnowledgeType.ARCHITECTURE_PATTERN:
        return this.applyArchitecturePattern(knowledge, context);

      case KnowledgeType.BEST_PRACTICE:
        return this.applyBestPractice(knowledge, context);

      case KnowledgeType.FAILURE_CASE:
        return this.applyFailureCase(knowledge, context);

      default:
        return null;
    }
  }

  // 应用代码模式
  private async applyCodePattern(
    pattern: KnowledgeEntry,
    context: GenerationContext
  ): Promise<AppliedKnowledge> {
    // 1. 准备模板
    const template = this.prepareTemplate(pattern.code);

    // 2. 适应上下文
    const adapted = await this.adaptToContext(template, context);

    // 3. 更新提示词
    context.prompt = this.injectIntoPrompt(context.prompt, {
      type: 'code_template',
      template: adapted,
      explanation: pattern.summary
    });

    return {
      knowledge: pattern,
      applicationType: 'code_generation',
      appliedAt: new Date()
    };
  }

  // 应用失败案例（避免重蹈覆辙）
  private async applyFailureCase(
    failure: KnowledgeEntry,
    context: GenerationContext
  ): Promise<AppliedKnowledge> {
    // 在提示词中添加警告
    context.prompt = this.injectIntoPrompt(context.prompt, {
      type: 'warning',
      content: `Avoid this common mistake: ${failure.problem.summary}`,
      relatedCode: failure.code
    });

    return {
      knowledge: failure,
      applicationType: 'error_prevention',
      appliedAt: new Date()
    };
  }
}
```

### 6.2 知识使用追踪

```typescript
// 知识使用追踪

class KnowledgeUsageTracker {
  // 记录知识使用
  async trackUsage(
    knowledgeId: string,
    context: UsageContext
  ): Promise<void> {
    // 1. 更新使用计数
    await this.db.knowledge.update({
      where: { id: knowledgeId },
      data: {
        usageCount: increment('usageCount'),
        lastUsed: new Date()
      }
    });

    // 2. 记录使用历史
    await this.db.knowledgeUsage.create({
      data: {
        id: generateId(),
        knowledgeId,
        projectId: context.projectId,
        stage: context.stage,
        generationId: context.generationId,
        result: context.result,  // 'success' | 'failure'
        feedback: context.feedback,
        timestamp: new Date()
      }
    });

    // 3. 评估是否需要更新质量分数
    await this.reevaluateQuality(knowledgeId);
  }

  // 重新评估质量
  private async reevaluateQuality(knowledgeId: string): Promise<void> {
    const usageHistory = await this.db.knowledgeUsage.findMany({
      where: { knowledgeId },
      orderBy: { timestamp: 'desc' },
      take: 20  // 最近 20 次使用
    });

    if (usageHistory.length < 5) return;  // 样本不足

    // 计算成功率
    const successCount = usageHistory.filter(u => u.result === 'success').length;
    const successRate = successCount / usageHistory.length;

    // 更新质量分数
    const qualityScore = calculateQualityScore(
      successRate,
      usageHistory.length,
      // 其他因素...
    );

    await this.db.knowledge.update({
      where: { id: knowledgeId },
      data: {
        'quality.successRate': successRate,
        'quality.score': qualityScore
      }
    });
  }
}
```

---

**版本**: 1.0.0
**创建日期**: 2026-04-14
**状态**: 知识库系统设计完成
