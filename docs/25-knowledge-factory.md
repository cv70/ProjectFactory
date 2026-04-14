# 知识沉淀系统设计

## 1. 系统概述

知识沉淀系统负责从每个项目的开发过程中提取可复用的知识，并在未来的项目生成中应用这些知识。

```
┌─────────────────────────────────────────────────────────────────┐
│                    Knowledge Factory                          │
│                  (知识工厂 - 知识沉淀系统)                      │
└─────────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ↓                   ↓                   ↓
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  Extraction   │ → │   Storage    │ → │  Application │
│  (知识提取)   │   │   (知识存储)   │   │   (知识应用)   │
└───────────────┘   └───────────────┘   └───────────────┘
```

## 2. 知识分类

### 2.1 知识类型体系

```
Knowledge
├── Code Patterns (代码模式)
│   ├── React Patterns
│   ├── Node.js Patterns
│   ├── Database Patterns
│   └── Common Patterns
│
├── Best Practices (最佳实践)
│   ├── Security Practices
│   ├── Performance Practices
│   ├── Testing Practices
│   └── Code Organization
│
├── Failure Cases (失败案例)
│   ├── Common Errors
│   ├── Anti-Patterns
│   ├── Edge Cases
│   └── Integration Issues
│
├── Architecture Decisions (架构决策)
│   ├── Tech Stack Choices
│   ├── Design Patterns
│   ├── System Boundaries
│   └── Scalability Decisions
│
├── Prompts (Prompt 模板)
│   ├── Idea Generation Prompts
│   ├── Architecture Prompts
│   ├── Code Generation Prompts
│   └── Review Prompts
│
└── Templates (项目模板)
    ├── CRUD Templates
    ├── API Templates
    ├── CLI Templates
    └── Microservice Templates
```

### 2.2 知识模型定义

```typescript
// backend/src/knowledge/schema.ts

export interface KnowledgeItem {
  id: string;
  type: KnowledgeType;
  subtype: string;              // 子类型
  title: string;
  description: string;

  // 内容
  content: string;              // 知识正文
  codeSnippet?: string;           // 代码片段
  configuration?: unknown;       // 配置信息

  // 元数据
  tags: string[];
  category: string;
  language?: string;
  framework?: string;
  complexity: 'simple' | 'medium' | 'complex';

  // 使用统计
  usageCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;

  // 质量评估
  confidence: number;            // 知识可信度 0-1
  quality: number;                // 质量评分 0-1
  verified: boolean;             // 是否人工验证

  // 来源信息
  sourceProjectId?: string;        // 来源项目
  sourceAgent?: string;           // 提取Agent
  extractionContext?: string;    // 提取上下文

  // 时间相关
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  validityPeriod?: number;        // 有效期（秒）
  expiresAt?: Date;
}

export enum KnowledgeType {
  CODE_PATTERN = 'code-pattern',
  BEST_PRACTICE = 'best-practice',
  FAILURE_CASE = 'failure-case',
  ARCHITECTURE_DECISION = 'architecture-decision',
  PROMPT_TEMPLATE = 'prompt-template',
  PROJECT_TEMPLATE = 'project-template',
}
```

## 3. 知识提取

### 3.1 提取器架构

```typescript
// backend/src/knowledge/extractor.ts

interface KnowledgeExtractor {
  // 从项目提取知识
  extractFromProject(project: Project): Promise<ExtractionResult>;

  // 从Agent输出提取知识
  extractFromAgentOutput(
    agentName: string,
    output: AgentOutput,
    context: ExecutionContext
  ): Promise<KnowledgeItem[]>;

  // 从代码中提取模式
  extractFromCode(code: GeneratedCode): Promise<CodePattern[]>;

  // 从测试结果中提取知识
  extractFromTestResults(results: TestResults): Promise<TestKnowledge[]>;
}

interface ExtractionResult {
  extractedItems: KnowledgeItem[];
  sourceMetrics: ExtractionMetrics;
  confidence: number;        // 提取置信度
}

interface ExtractionMetrics {
  duration: number;
  filesProcessed: number;
  patternsFound: number;
  itemsCreated: number;
}
```

### 3.2 提取策略

#### 3.2.1 代码模式提取

```typescript
class CodePatternExtractor {
  // AST分析提取模式
  async extractByAST(code: string): Promise<Pattern[]> {
    // 1. 解析AST
    const ast = this.parseAST(code);

    // 2. 识别模式
    const patterns = this.identifyPatterns(ast);

    // 3. 提取元数据
    const enrichedPatterns = await this.enrichMetadata(patterns);

    // 4. 评估质量
    const qualityScores = await this.assessQuality(enrichedPatterns);

    return enrichedPatterns.map((p, i) => ({
      ...p,
      quality: qualityScores[i],
    }));
  }

  // 常见代码模式
  private identifyPatterns(ast: AST): Pattern[] {
    return [
      ...this.findSingletonPatterns(ast),
      ...this.findFactoryPatterns(ast),
      ...this.findObserverPatterns(ast),
      ...this.findErrorHandlingPatterns(ast),
      ...this.findStateManagementPatterns(ast),
    ];
  }
}
```

#### 3.2.2 最佳实践提取

```typescript
class BestPracticeExtractor {
  // 从代码审查结果提取最佳实践
  async extractFromReview(review: CodeReview): Promise<BestPractice[]> {
    const practices: BestPractice[] = [];

    // 提取命名规范
    practices.push(...this.extractNamingPractices(review));

    // 提取错误处理
    practices.push(...this.extractErrorHandlingPractices(review));

    // 提取类型使用
    practices.push(...this.extractTypeUsagePractices(review));

    // 提取性能优化
    practices.push(...this.extractPerformancePractices(review));

    return practices;
  }
}
```

#### 3.2.3 失败案例提取

```typescript
class FailureCaseExtractor {
  // 从错误日志提取失败案例
  async extractFromErrors(
    errors: Error[],
    context: ExecutionContext
  ): Promise<FailureCase[]> {
    return errors.map(error => ({
      id: this.generateId(),
      type: KnowledgeType.FAILURE_CASE,
      subtype: this.classifyError(error),
      title: this.generateTitle(error),
      description: error.message,

      // 错误详情
      errorMessage: error.message,
      stackTrace: error.stack,
      context: context,

      // 根因分析
      rootCause: this.analyzeRootCause(error, context),

      // 解决方案
      solution: this.generateSolution(error),
      preventActions: this.generatePreventionActions(error),

      // 标签
      tags: this.extractTags(error),

      usageCount: 0,
      successCount: 0,
      confidence: 0.7,
      createdAt: new Date(),
    }));
  }
}
```

## 4. 知识存储

### 4.1 数据库设计

```sql
-- 知识库主表
CREATE TABLE knowledge_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  subtype TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  code_snippet TEXT,
  configuration JSON,

  -- 元数据
  tags JSON,
  category TEXT,
  language TEXT,
  framework TEXT,
  complexity TEXT CHECK (complexity IN ('simple', 'medium', 'complex')),

  -- 使用统计
  usage_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  success_rate REAL DEFAULT 1.0,

  -- 质量评估
  confidence REAL NOT NULL,
  quality REAL NOT NULL,
  verified BOOLEAN DEFAULT 0,

  -- 来源信息
  source_project_id TEXT,
  source_agent TEXT,
  extraction_context TEXT,

  -- 时间相关
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_used INTEGER,
  validity_period INTEGER,
  expires_at INTEGER
);

-- 全文检索索引
CREATE VIRTUAL TABLE knowledge_fts USING fts5(
  id,
  title,
  description,
  content,
  tokenize = 'porter'
);

-- 索引
CREATE INDEX idx_knowledge_type ON knowledge_items(type, subtype);
CREATE INDEX idx_knowledge_tags ON knowledge_items(tags);
CREATE INDEX idx_knowledge_usage ON knowledge_items(usage_count DESC);
CREATE INDEX idx_knowledge_quality ON knowledge_items(quality DESC);
CREATE INDEX idx_knowledge_validity ON knowledge_items(expires_at);
```

### 4.2 存储接口

```typescript
// backend/src/knowledge/repository.ts

interface KnowledgeRepository {
  // 创建知识
  create(item: KnowledgeItem): Promise<KnowledgeItem>;

  // 批量创建
  createMany(items: KnowledgeItem[]): Promise<void>;

  // 获取知识
  getById(id: string): Promise<KnowledgeItem | null>;

  // 检索知识
  search(options: SearchOptions): Promise<KnowledgeItem[]>;

  // 更新使用统计
  updateUsage(id: string, success: boolean): Promise<void>;

  // 更新知识
  update(id: string, updates: Partial<KnowledgeItem>): Promise<void>;

  // 删除过期知识
  deleteExpired(): Promise<number>;

  // 获取统计
  getStatistics(): Promise<KnowledgeStatistics>;
}

interface SearchOptions {
  query?: string;
  type?: KnowledgeType;
  subtype?: string;
  tags?: string[];
  language?: string;
  framework?: string;
  complexity?: string;
  minQuality?: number;
  minConfidence?: number;
  verifiedOnly?: boolean;
  limit?: number;
  offset?: number;
}

interface KnowledgeStatistics {
  totalItems: number;
  byType: Record<KnowledgeType, number>;
  averageQuality: number;
  averageUsage: number;
  recentItems: KnowledgeItem[];
  mostUsedItems: KnowledgeItem[];
}
```

## 5. 知识应用

### 5.1 知识推荐引擎

```typescript
// backend/src/knowledge/recommender.ts

interface KnowledgeRecommender {
  // 推荐代码模式
  recommendCodePatterns(context: CodeContext): Promise<CodePattern[]>;

  // 推荐最佳实践
  recommendBestPractices(context: ProjectContext): Promise<BestPractice[]>;

  // 推荐Prompt模板
  recommendPrompts(task: Task): Promise<PromptTemplate[]>;

  // 推荐项目模板
  recommendTemplates(idea: Idea): Promise<ProjectTemplate[]>;

  // 跨项目推荐
  recommendCrossProject(knowledgeType: KnowledgeType): Promise<KnowledgeItem[]>;
}

interface RecommendationContext {
  projectType: string;
  features: string[];
  techStack: string[];
  complexity: string;
  previousSuccesses: string[];
  currentIssues: string[];
}

interface RecommendationResult {
  items: KnowledgeItem[];
  relevanceScores: number[];
  rationale: string;
}
```

### 5.2 应用策略

#### 5.2.1 基于规则的应用

```typescript
class RuleBasedApplicator {
  applyRules(context: ExecutionContext): AppliedKnowledge[] {
    const applied: AppliedKnowledge[] = [];

    // 规则1：React项目应用React模式
    if (context.techStack.includes('react')) {
      const patterns = this.getPatterns('react', context.complexity);
      applied.push(...patterns.map(p => ({
        knowledge: p,
        method: 'injection',
        reason: 'React project requires React patterns',
      })));
    }

    // 规则2：高复杂度项目应用错误处理模式
    if (context.complexity === 'high') {
      const practices = this.getPractices('error-handling');
      applied.push(...practices);
    }

    // 规则3：API项目应用API设计最佳实践
    if (context.projectType === 'api-service') {
      const practices = this.getPractices('api-design');
      applied.push(...practices);
    }

    return applied;
  }
}
```

#### 5.2.2 基于相似度的应用

```typescript
class SimilarityBasedApplicator {
  async applyBySimilarity(
    context: ExecutionContext
  ): Promise<AppliedKnowledge[]> {
    // 1. 获取成功的历史项目
    const similarProjects = await this.findSimilarProjects(context);

    // 2. 提取这些项目使用的知识
    const usedKnowledge = await this.getUsedKnowledge(similarProjects);

    // 3. 计算相似度分数
    const scoredKnowledge = usedKnowledge.map(k => ({
      knowledge: k,
      similarity: this.calculateSimilarity(k, context),
      successRate: k.successRate,
    }));

    // 4. 排序并返回
    return scoredKnowledge
      .sort((a, b) => (b.similarity + b.successRate * 0.3) - (a.similarity + a.successRate * 0.3))
      .slice(0, 10)
      .map(sk => ({
        knowledge: sk.knowledge,
        method: 'similarity',
        reason: `Similarity: ${sk.similarity.toFixed(2)}, Success Rate: ${sk.successRate.toFixed(2)}`,
      }));
  }
}
```

## 6. 知识质量保证

### 6.1 质量评估

```typescript
interface KnowledgeQualityAssessor {
  // 评估新知识
  assessNewKnowledge(item: KnowledgeItem): Promise<QualityAssessment>;

  // 评估知识有效性
  assessValidity(item: KnowledgeItem): Promise<boolean>;

  // 评估知识冗余度
  assessRedundancy(item: KnowledgeItem): Promise<number>;

  // 评估知识一致性
  assessConsistency(item: KnowledgeItem): Promise<ConsistencyReport>;
}

interface QualityAssessment {
  completeness: number;       // 完整性 0-1
  correctness: number;        // 正确性 0-1
  relevance: number;         // 相关性 0-1
  uniqueness: number;        // 独特性 0-1
  overall: number;           // 综合评分 0-1
  issues: QualityIssue[];
}
```

### 6.2 知识更新机制

```typescript
interface KnowledgeUpdater {
  // 更新成功统计
  updateSuccess(id: string): Promise<void>;

  // 更新失败统计
  updateFailure(id: string): Promise<void>;

  // 重新评估质量
  reassessQuality(): Promise<void>;

  // 合并相似知识
  mergeSimilar(threshold: number): Promise<number>;

  // 清理过期知识
  cleanupExpired(): Promise<number>;

  // 清理低质量知识
  cleanupLowQuality(threshold: number): Promise<number>;
}
```

## 7. 知识可视化

### 7.1 前端界面设计

```
Knowledge Dashboard
├── Knowledge Library
│   ├── Code Patterns
│   ├── Best Practices
│   ├── Failure Cases
│   └── Architecture Decisions
├── Knowledge Search
│   ├── Full Text Search
│   ├── Filter by Type
│   ├── Filter by Tech Stack
│   └── Filter by Quality
├── Knowledge Analytics
│   ├── Usage Statistics
│   ├── Quality Trends
│   ├── Knowledge Growth
│   └── Success Rate Analysis
└── Knowledge Management
    ├── Manual Review Queue
    ├── Merge Suggestions
    └── Delete Queue
```

### 7.2 知识图谱可视化

```typescript
// 前端知识图谱组件
interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  layout: GraphLayout;
}

interface KnowledgeNode {
  id: string;
  type: KnowledgeType;
  title: string;
  quality: number;
  usage: number;
  position: { x: number; y: number };
}

interface KnowledgeEdge {
  source: string;
  target: string;
  type: 'related' | 'derived' | 'contradicts';
  strength: number;
}
```

## 8. 实现优先级

### 8.1 Phase 1（核心功能）

1. 知识提取器基础实现
   - 代码模式提取
   - 最佳实践提取
   - 失败案例提取

2. 知识存储实现
   - 数据库schema
   - CRUD操作
   - 基础检索

3. 简单应用机制
   - 基于规则的应用
   - 简单推荐算法

### 8.2 Phase 2（进阶功能）

1. 智能推荐引擎
   - 相似度计算
   - 协同过滤
   - 个性化推荐

2. 知识质量评估
   - 自动质量评分
   - 人工审核队列
   - 知识合并

3. 知识可视化
   - 知识库浏览器
   - 使用统计图表
   - 知识图谱

### 8.3 Phase 3（高级功能）

1. 知识推理能力
   - 推理引擎
   - 知识关联分析
   - 跨项目知识迁移

2. 自适应学习
   - 学习效果追踪
   - 策略自动调整
   - 知识权重优化

---

**版本**: 0.1.0
**更新日期**: 2026-04-14
**状态**: 设计阶段
