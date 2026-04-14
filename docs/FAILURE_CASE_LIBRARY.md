# 失败案例库

## 概述

失败案例库（Failure Case Library）是 ProjectFactory 系统的核心诊断组件，用于系统性地收集、分类和分析项目开发过程中的失败案例。通过从错误中学习，系统能够避免重复犯错，持续改进生成质量，并形成预防性的知识体系。

## 核心价值

- **错误预防**：识别常见错误模式，在生成阶段预防
- **根因分析**：深入分析失败原因，形成可操作的改进建议
- **知识传承**：将失败经验转化为组织知识资产
- **持续改进**：通过数据分析发现系统性问题

## 失败分类体系

### 按阶段分类

```typescript
// 开发阶段
enum FailureStage {
  REQUIREMENT = 'requirement',           // 需求阶段
  DESIGN = 'design',                     // 设计阶段
  IMPLEMENTATION = 'implementation',     // 实现阶段
  TESTING = 'testing',                   // 测试阶段
  DEPLOYMENT = 'deployment',             // 部署阶段
  PRODUCTION = 'production',             // 生产阶段
  MAINTENANCE = 'maintenance',           // 维护阶段
}

// 失败类型
enum FailureType {
  // 需求阶段
  REQUIREMENT_AMBIGUITY = 'requirement_ambiguity',       // 需求模糊
  REQUIREMENT_INCOMPLETENESS = 'requirement_incompleteness', // 需求不完整
  REQUIREMENT_INCONSISTENCY = 'requirement_inconsistency',   // 需求不一致

  // 设计阶段
  DESIGN_ARCHITECTURE = 'design_architecture',           // 架构设计问题
  DESIGN_DATABASE = 'design_database',                   // 数据库设计问题
  DESIGN_API = 'design_api',                             // API设计问题
  DESIGN_SCALABILITY = 'design_scalability',           // 可扩展性不足

  // 实现阶段
  IMPLEMENTATION_LOGIC = 'implementation_logic',         // 业务逻辑错误
  IMPLEMENTATION_SECURITY = 'implementation_security', // 安全漏洞
  IMPLEMENTATION_PERFORMANCE = 'implementation_performance', // 性能问题
  IMPLEMENTATION_BUG = 'implementation_bug',           // 代码bug

  // 测试阶段
  TEST_COVERAGE = 'test_coverage',                     // 测试覆盖不足
  TEST_QUALITY = 'test_quality',                       // 测试质量差
  TEST_MISSED_BUG = 'test_missed_bug',                // 漏测bug

  // 部署阶段
  DEPLOYMENT_CONFIG = 'deployment_config',               // 配置错误
  DEPLOYMENT_DEPENDENCY = 'deployment_dependency',    // 依赖问题
  DEPLOYMENT_ROLLBACK = 'deployment_rollback',       // 回滚问题

  // 生产阶段
  PRODUCTION_OUTAGE = 'production_outage',               // 服务中断
  PRODUCTION_DATA = 'production_data',                 // 数据问题
  PRODUCTION_SECURITY = 'production_security',         // 安全事件

  // 维护阶段
  MAINTENANCE_DEBT = 'maintenance_debt',               // 技术债务
  MAINTENANCE_KNOWLEDGE = 'maintenance_knowledge',   // 知识流失
}
```

### 按严重程度分类

```typescript
// 严重程度等级
enum FailureSeverity {
  BLOCKER = 'blocker',     // 阻断性问题（项目无法继续）
  CRITICAL = 'critical',   // 严重问题（核心功能不可用）
  MAJOR = 'major',         // 重要问题（功能受限）
  MINOR = 'minor',         // 次要问题（不影响使用）
  TRIVIAL = 'trivial',     // 微小问题（ cosmetic）
}

// 业务影响等级
enum BusinessImpact {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}
```

## 失败案例模型

```typescript
// 失败案例
interface FailureCase {
  // 标识
  id: string;
  caseId: string;                    // 可读ID，如 "FC-2024-0001"

  // 分类
  stage: FailureStage;
  type: FailureType;
  severity: FailureSeverity;
  businessImpact: BusinessImpact;

  // 项目上下文
  context: {
    projectId: string;
    projectType: ProjectType;
    projectDomain: string;
    generationDate: Date;
    technologies: string[];
  };

  // 失败描述
  description: {
    summary: string;                // 一句话总结
    detailed: string;                // 详细描述
    userImpact: string;             // 对用户的影响
  };

  // 根因分析
  rootCause: {
    primary: string;                 // 主要原因
    secondary: string[];             // 次要原因
    rootCauseCategory: RootCauseCategory;
    fiveWhys: string[];             // 五问法分析
  };

  // 错误模式
  errorPattern: {
    patternId: string;
    patternName: string;
    relatedPatterns: string[];      // 相关模式
    antiPatterns: string[];         // 涉及的反模式
  };

  // 发现方式
  discovery: {
    method: 'manual' | 'automated' | 'user_report' | 'monitoring';
    detectedAt: FailureStage;
    timeToDetect: number;           // 从引入到发现的时间（天）
    timeToResolve: number;          // 从发现到解决的时间（天）
  };

  // 解决方案
  resolution: {
    actions: string[];
    codeChanges?: {
      file: string;
      change: string;
      before: string;
      after: string;
    }[];
    configChanges?: {
      key: string;
      before: string;
      after: string;
    }[];
    migratedPatterns?: string[];    // 迁移到的模式
  };

  // 预防措施
  prevention: {
    shortTerm: string[];           // 短期措施
    longTerm: string[];            // 长期措施
    detectionRules: string[];      // 检测规则
    guardRails: string[];          // 防护栏
  };

  // 经验教训
  lessons: {
    keyTakeaway: string;           // 关键收获
    recommendations: string[];
    applicableProjects: ProjectType[];
  };

  // 指标
  metrics: {
    cost: number;                  // 损失（美元）
    effortDays: number;            // 修复工作量（天）
    affectedUsers: number;         // 影响用户数
    occurrenceCount: number;       // 发生次数
  };

  // 元数据
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    resolvedAt: Date;
    createdBy: string;
    reviewedBy: string[];
    tags: string[];
  };
}

// 根因分类
enum RootCauseCategory {
  // 人的因素
  HUMAN_REQUIREMENT_MISUNDERSTANDING = 'human_requirement_misunderstanding',
  HUMAN_DESIGN_ERROR = 'human_design_error',
  HUMAN_CODING_ERROR = 'human_coding_error',
  HUMAN_INATTENTION = 'human_inattention',

  // 系统因素
  SYSTEM_COMPLEXITY = 'system_complexity',
  SYSTEM_INTEGRATION = 'system_integration',
  SYSTEM_DEPENDENCY = 'system_dependency',
  SYSTEM_SCALABILITY = 'system_scalability',

  // 过程因素
  PROCESS_INADEQUATE_TESTING = 'process_inadequate_testing',
  PROCESS_INADEQUATE_REVIEW = 'process_inadequate_review',
  PROCESS_INADEQUATE_DOCUMENTATION = 'process_inadequate_documentation',

  // 工具因素
  TOOL_LIMITATION = 'tool_limitation',
  TOOL_MISCONFIGURATION = 'tool_misconfiguration',
  TOOL_BUG = 'tool_bug',

  // 外部因素
  EXTERNAL_DEPENDENCY = 'external_dependency',
  EXTERNAL_SECURITY = 'external_security',
  EXTERNAL_REGULATION = 'external_regulation',
}
```

## 失败案例存储

### 存储架构

```typescript
// 失败案例存储
class FailureCaseStore {
  private db: Database;
  private cache: Cache;

  // 主存储（SQLite）
  async save(case: FailureCase): Promise<void> {
    await this.db.insert(failureCases).values(case);
    await this.invalidateCache(case.id);
  }

  // 全文搜索
  async search(query: FailureSearchQuery): Promise<FailureCase[]> {
    const cacheKey = \`search:\${JSON.stringify(query)}\`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const results = await this.db.query(failureCases)
      .filter(f =>
        query.stage ? f.stage === query.stage : true &&
        query.type ? f.type === query.type : true &&
        query.severity ? f.severity === query.severity : true
      )
      .orderBy(f => f.createdAt, 'desc')
      .limit(query.limit || 50);

    await this.cache.set(cacheKey, results, 300); // 5分钟缓存
    return results;
  }
}
```

### 索引与检索

```typescript
// 多维索引
class FailureIndex {
  // 按阶段索引
  byStage: Map<FailureStage, FailureCase[]>;

  // 按类型索引
  byType: Map<FailureType, FailureCase[]>;

  // 按技术栈索引
  byTechnology: Map<string, FailureCase[]>;

  // 按项目类型索引
  byProjectType: Map<ProjectType, FailureCase[]>;

  // 语义索引
  semanticIndex: VectorIndex;

  // 相似案例查找
  async findSimilar(case: FailureCase): Promise<FailureCase[]> {
    const embedding = await this.embedCase(case);
    return this.semanticIndex.search(embedding, { limit: 5 });
  }

  // 基于规则的建议
  async suggestPreventions(error: Error, context: ProjectContext): Promise<Prevention[]> {
    // 1. 查找历史上相似的失败
    const similar = await this.findSimilarByError(error);

    // 2. 提取预防措施
    return similar
      .flatMap(c => c.prevention.guardRails)
      .filter((p, i, arr) => arr.indexOf(p) === i) // 去重
      .slice(0, 5)
      .map(rail => ({
        rule: rail,
        sourceCase: similar[0].caseId,
        confidence: this.calculateConfidence(rail, similar),
      }));
  }
}
```

## 失败模式分析

### 模式挖掘

```typescript
// 失败模式挖掘器
class FailurePatternMiner {
  // 从案例中挖掘失败模式
  async minePatterns(cases: FailureCase[]): Promise<FailurePattern[]> {
    const patterns: FailurePattern[] = [];

    // 1. 按类型分组
    const byType = this.groupBy(cases, 'type');

    // 2. 发现高频模式
    for (const [type, typeCases] of byType) {
      if (typeCases.length >= MIN_OCCURRENCE) {
        patterns.push({
          id: \`fp-\${type}\`,
          type,
          frequency: typeCases.length,
          cases: typeCases.map(c => c.id),
          commonRootCauses: this.findCommonElements(typeCases, 'rootCause'),
          commonPreventions: this.findCommonElements(typeCases, 'prevention'),
        });
      }
    }

    // 3. 发现序列模式（前一个失败导致后一个失败）
    patterns.push(...this.mineSequencePatterns(cases));

    // 4. 发现关联模式
    patterns.push(...this.mineAssociationPatterns(cases));

    return patterns;
  }

  // 发现因果链
  private mineSequencePatterns(cases: FailureCase[]): FailurePattern[] {
    const sequences: Map<string, FailureCase[]> = new Map();

    for (const c of cases) {
      const key = \`\${c.stage}->\${c.context.projectType}\`;
      if (!sequences.has(key)) sequences.set(key, []);
      sequences.get(key)!.push(c);
    }

    return Array.from(sequences.entries())
      .filter(([_, cs]) => cs.length >= 3)
      .map(([sequence, cs]) => ({
        id: \`seq-\${sequence.replace('->', '-')}\`,
        sequence,
        frequency: cs.length,
        cases: cs.map(c => c.id),
      }));
  }
}

interface FailurePattern {
  id: string;
  type: string;                    // 模式类型
  frequency: number;               // 出现频率
  cases: string[];                // 相关案例
  commonRootCauses?: string[];     // 共同根因
  commonPreventions?: string[];   // 共同预防
  confidence: number;              // 置信度
}
```

### 趋势分析

```typescript
// 失败趋势分析
class FailureTrendAnalyzer {
  // 分析失败趋势
  async analyzeTrends(
    period: { start: Date; end: Date }
  ): Promise<FailureTrend> {
    const cases = await this.getCasesInPeriod(period);

    return {
      period,

      // 总体统计
      total: cases.length,
      bySeverity: this.countBy(cases, 'severity'),
      byStage: this.countBy(cases, 'stage'),
      byType: this.countBy(cases, 'type'),

      // 趋势
      trend: this.calculateTrend(cases),

      // 高频问题
      topPatterns: await this.getTopPatterns(cases, 5),

      // 新兴问题（最近增加的问题）
      emergingIssues: await this.detectEmergingIssues(cases),

      // 改善领域
      improvingAreas: await this.detectImprovingAreas(cases),

      // 建议
      recommendations: this.generateRecommendations(cases),
    };
  }

  // 检测新兴问题
  private async detectEmergingIssues(cases: FailureCase[]): Promise<EmergingIssue[]> {
    const recent = cases.filter(c =>
      c.createdAt > Date.now() - 30 * 24 * 60 * 60 * 1000 // 最近30天
    );
    const older = cases.filter(c =>
      c.createdAt <= Date.now() - 30 * 24 * 60 * 60 * 1000
    );

    const recentByType = this.countBy(recent, 'type');
    const olderByType = this.countBy(older, 'type');

    return Object.entries(recentByType)
      .filter(([type, count]) => count > olderByType[type] * 1.5) // 增长50%以上
      .map(([type, count]) => ({
        type,
        currentCount: count,
        previousCount: olderByType[type] || 0,
        growthRate: (count - olderByType[type]) / olderByType[type],
      }))
      .sort((a, b) => b.growthRate - a.growthRate);
  }
}

interface FailureTrend {
  period: { start: Date; end: Date };
  total: number;
  bySeverity: Record<FailureSeverity, number>;
  byStage: Record<FailureStage, number>;
  byType: Record<FailureType, number>;
  trend: 'improving' | 'stable' | 'worsening';
  topPatterns: FailurePattern[];
  emergingIssues: EmergingIssue[];
  improvingAreas: string[];
  recommendations: string[];
}
```

## 预防系统

### 实时检测

```typescript
// 生成阶段失败预防
class GenerationFailurePrevention {
  private linter: PatternLinter;
  private rules: PreventionRule[];

  // 在生成前检查
  async preGenerateCheck(context: GenerationContext): Promise<CheckResult> {
    const warnings: Warning[] = [];

    // 1. 检查是否涉及高风险模式
    const riskPatterns = await this.detectRiskyPatterns(context);
    warnings.push(...riskPatterns.map(p => ({
      type: 'risk_pattern',
      message: \`使用高风险模式: \${p.pattern}\`,
      mitigation: p.suggestedFix,
    })));

    // 2. 检查技术栈兼容性
    const compatibility = await this.checkCompatibility(context);
    if (!compatibility.valid) {
      warnings.push(...compatibility.issues.map(i => ({
        type: 'compatibility',
        message: i,
      })));
    }

    // 3. 检查历史失败案例
    const similarFailures = await this.findSimilarFailures(context);
    if (similarFailures.length > 0) {
      warnings.push({
        type: 'historical_failure',
        message: \`历史上类似需求导致 \${similarFailures.length} 次失败\`,
        mitigation: similarFailures[0].prevention.shortTerm,
      });
    }

    return {
      pass: warnings.filter(w => w.type === 'risk_pattern').length === 0,
      warnings,
    };
  }
}

interface PreventionRule {
  id: string;
  name: string;
  description: string;
  trigger: TriggerCondition;
  action: PreventionAction;
  enabled: boolean;
}
```

### 防护栏

```typescript
// 代码生成防护栏
const GENERATION_GUARD_RAILS: PreventionRule[] = [
  {
    id: 'gr-001',
    name: '禁止SQL拼接',
    description: '防止SQL注入漏洞',
    trigger: {
      type: 'code_pattern',
      pattern: /\$\{.*\}.*SELECT|INSERT|UPDATE|DELETE/i,
    },
    action: {
      type: 'block',
      message: '检测到潜在的SQL注入风险，请使用参数化查询',
      suggestion: '使用 ORM 或参数化查询',
    },
    enabled: true,
  },

  {
    id: 'gr-002',
    name: '禁止硬编码凭证',
    description: '防止凭证泄露',
    trigger: {
      type: 'code_pattern',
      pattern: /password\s*=\s*['"][^'"]+['"]|api[_-]?key\s*=\s*['"][^'"]+['"]/i,
    },
    action: {
      type: 'block',
      message: '检测到硬编码凭证，请使用环境变量或密钥管理服务',
      suggestion: '使用 process.env.API_KEY 或密钥管理服务',
    },
    enabled: true,
  },

  {
    id: 'gr-003',
    name: '必须错误处理',
    description: '确保异步操作有错误处理',
    trigger: {
      type: 'function_signature',
      patterns: ['async', 'Promise'],
      missing: 'try-catch',
    },
    action: {
      type: 'warn',
      message: '异步函数缺少错误处理',
    },
    enabled: true,
  },

  {
    id: 'gr-004',
    name: '资源清理',
    description: '确保资源在使用后被释放',
    trigger: {
      type: 'code_pattern',
      pattern: /new.*Stream|fs\.|database/,
      missing: 'finally|using|with',
    },
    action: {
      type: 'warn',
      message: '可能存在资源泄漏风险',
    },
    enabled: true,
  },
];
```

## 根因分析模板

### 五问法模板

```typescript
// 五问法分析模板
const FIVE_WHYS_TEMPLATE = `
## 五问法根因分析

### 第一次追问：为什么？
问题：[具体问题]
回答：[直接原因]

### 第二次追问：为什么？
问题：[直接原因]
回答：[更深层原因]

### 第三次追问：为什么？
问题：[更深层原因]
回答：[系统原因]

### 第四次追问：为什么？
问题：[系统原因]
回答：[根本原因]

### 第五次追问：为什么？
问题：[根本原因]
回答：[最终根因]

## 结论
- 主要根因：[最终根因]
- 影响范围：[影响范围]
- 修复优先级：[优先级]
`;
```

### 鱼骨图分析

```typescript
// 鱼骨图分类
const FISHBONE_CATEGORIES = {
  // 6M分类
  MAN: {
    label: '人（Man）',
    subcategories: [
      '知识不足',
      '技能欠缺',
      '注意力不集中',
      '沟通不畅',
      '疲劳',
    ],
  },

  MACHINE: {
    label: '机器（Machine）',
    subcategories: [
      '工具缺陷',
      '设备故障',
      '工具老化',
      '校准错误',
    ],
  },

  METHOD: {
    label: '方法（Method）',
    subcategories: [
      '流程不完善',
      '标准缺失',
      '指南不清晰',
      '培训不足',
    ],
  },

  MATERIAL: {
    label: '材料（Material）',
    subcategories: [
      '依赖不稳定',
      '版本冲突',
      '兼容性问题',
      '文档不足',
    ],
  },

  MEASUREMENT: {
    label: '测量（Measurement）',
    subcategories: [
      '指标不合理',
      '测量误差',
      '数据不准确',
      '监控缺失',
    ],
  },

  ENVIRONMENT: {
    label: '环境（Environment）',
    subcategories: [
      '时间压力',
      '团队协作',
      '组织文化',
      '外部依赖',
    ],
  },
};
```

## 配置示例

```yaml
# 失败案例库配置
failure_case_library:
  # 存储配置
  storage:
    backend: "sqlite"              # sqlite | postgres | mysql
    hot_cache_size: 1000          # 热数据缓存大小

  # 案例管理
  case_management:
    auto_categorize: true         # 自动分类
    similar_detection: true       # 相似案例检测
    trend_analysis: true          # 趋势分析
    min_occurrence_for_pattern: 3 # 形成模式的最小发生次数

  # 预防系统
  prevention:
    enabled: true
    pre_generate_check: true      # 生成前检查
    guard_rails: true            # 防护栏
    real_time_linting: true      # 实时检查

  # 告警配置
  alerting:
    new_pattern_threshold: 3      # 新模式告警阈值
    trend_worsening_threshold: 0.5 # 趋势恶化阈值
    channels:
      - type: "slack"
        channel: "#dev-failures"
      - type: "email"
        to: "dev-team@company.com"
```

## 最佳实践

### 案例编写规范

1. **客观描述**：准确描述事实，避免主观臆断
2. **完整根因**：深入分析，不要停留在表面原因
3. **可操作建议**：预防措施必须具体可执行
4. **经验总结**：提炼可迁移的经验教训

### 分类准确性

1. **多重分类**：一个案例可属于多个类型
2. **定期回顾**：定期审核分类准确性
3. **持续更新**：根据新案例调整分类体系

### 知识共享

1. **匿名处理**：敏感信息需脱敏
2. **奖励机制**：鼓励团队贡献案例
3. **定期回顾**：团队定期学习失败案例

---

**最后更新**: 2026-04-14
