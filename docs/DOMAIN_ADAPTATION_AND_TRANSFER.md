# 领域适配与迁移系统

## 概述

领域适配与迁移系统（Domain Adaptation & Transfer System）是支持无限项目生成系统跨领域扩展的核心能力。think.md提出的渐进式实现路径中，阶段二的核心就是"跨领域适配"——将一个领域（如内部工具）的解决方案迁移到另一个领域（如电商SaaS）。本系统负责管理领域知识、提取可迁移模式、并智能适配目标领域。

## 核心价值

- **知识迁移**：将一个领域的解决方案快速适配到另一个领域
- **领域专业化**：为特定领域提供定制化的生成策略
- **组合创新**：发现跨领域的组合创新机会
- **降低重复**：避免为每个领域重新设计相似组件
- **加速演进**：快速占领新领域市场

## 领域模型

### 领域定义

```typescript
// 领域模型
interface Domain {
  id: string;
  slug: string;                    // URL友好标识符
  name: string;                    // 领域名称 (e.g., "E-commerce")
  description: string;              // 领域描述

  // 层级结构
  hierarchy: {
    level: number;                 // 0 = 顶级领域
    parentId?: string;             // 父领域ID
    children?: string[];           // 子领域ID
    ancestors?: string[];           // 祖先链
  };

  // 领域特征
  characteristics: DomainCharacteristics;

  // 领域知识
  knowledge: DomainKnowledge;

  // 领域约束
  constraints: DomainConstraints;

  // 统计
  stats: {
    projectsCount: number;
    templatesCount: number;
    patternsCount: number;
    avgQualityScore: number;
  };

  // 元数据
  metadata: {
    maturity: 'experimental' | 'alpha' | 'beta' | 'stable' | 'mature';
    supportedLanguages: string[];
    typicalProjectTypes: ProjectType[];
    defaultLicense: string;
  };

  timestamps: {
    createdAt: Date;
    updatedAt: Date;
  };
}

// 领域特征
interface DomainCharacteristics {
  // 业务特征
  business: {
    typicalUserRoles: string[];     // 典型用户角色
    commonWorkflows: string[];      // 常见工作流
    keyEntities: EntityDefinition[]; // 核心实体
    businessRules: string[];       // 典型业务规则
  };

  // 技术特征
  technical: {
    architecturePatterns: string[]; // 架构模式
    commonIntegrations: string[];    // 常见集成
    dataModels: string[];           // 数据模型模式
    apiStyles: ('rest' | 'graphql' | 'grpc')[];
  };

  // 领域特定需求
  domainSpecific: {
    complianceRequirements: string[]; // 合规要求
    scalabilityNeeds: string[];        // 扩展性需求
    securityRequirements: string[];    // 安全需求
    performanceBenchmarks: Record<string, number>; // 性能基准
  };
}

interface EntityDefinition {
  name: string;
  pluralName: string;
  description: string;
  attributes: AttributeDefinition[];
  relationships: Relationship[];
}

interface AttributeDefinition {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  validationRules?: string[];
  example?: any;
}

interface Relationship {
  targetEntity: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  description: string;
}
```

### 领域知识体系

```typescript
// 领域知识
interface DomainKnowledge {
  // 概念模型
  concepts: Concept[];

  // 业务词汇表
  vocabulary: VocabEntry[];

  // 规则库
  rules: DomainRule[];

  // 模式库
  patterns: DomainPattern[];

  // 示例项目
  referenceProjects: string[];      // 参考项目ID列表

  // 最佳实践
  bestPractices: BestPractice[];
}

interface Concept {
  id: string;
  term: string;
  definition: string;
  synonyms: string[];
  relatedConcepts: string[];
  category: string;
}

interface VocabEntry {
  term: string;
  domainSpecificMeaning: string;
  generalMeaning?: string;
  examples: string[];
  translations: Record<string, string>; // 翻译
}

interface DomainRule {
  id: string;
  name: string;
  description: string;
  condition: string;               // 规则条件 (DSL)
  action: string;                 // 规则动作
  priority: number;
  applicableTo: string[];          // 适用的实体/场景
  examples: string[];
}

interface DomainPattern {
  id: string;
  name: string;
  description: string;
  category: 'architectural' | 'design' | 'implementation';
  applicability: string[];          // 适用场景
  solution: PatternSolution;
  examples: string[];
}

interface PatternSolution {
  structure: string;              // 代码结构
  implementation: string;         // 实现代码模板
  configuration: Record<string, any>; // 配置模板
}
```

### 预设领域

```typescript
// 预设领域定义
const PRESET_DOMAINS: Domain[] = [
  // 顶级领域
  {
    id: 'web-application',
    slug: 'web-application',
    name: 'Web应用',
    description: '通用Web应用程序',
    hierarchy: { level: 0 },
    characteristics: {
      business: {
        typicalUserRoles: ['admin', 'user', 'guest'],
        commonWorkflows: ['认证流程', 'CRUD操作', '搜索过滤'],
        keyEntities: [
          { name: 'User', pluralName: 'Users', description: '系统用户', attributes: [], relationships: [] },
        ],
        businessRules: ['密码强度要求', '会话管理'],
      },
      technical: {
        architecturePatterns: ['MVC', 'SPA', 'SSR'],
        commonIntegrations: ['Database', 'Cache', 'FileStorage'],
        dataModels: ['User', 'Session', 'Content'],
        apiStyles: ['rest', 'graphql'],
      },
      domainSpecific: {
        complianceRequirements: ['GDPR', 'CCPA'],
        scalabilityNeeds: ['水平扩展', 'CDN支持'],
        securityRequirements: ['XSS防护', 'CSRF防护'],
        performanceBenchmarks: { 'first-contentful-paint': 1500 },
      },
    },
    knowledge: { concepts: [], vocabulary: [], rules: [], patterns: [], referenceProjects: [], bestPractices: [] },
    constraints: { maxComplexity: 8, disallowedPatterns: [], requiredPatterns: [] },
    stats: { projectsCount: 0, templatesCount: 0, patternsCount: 0, avgQualityScore: 0 },
    metadata: { maturity: 'mature', supportedLanguages: ['TypeScript', 'Python', 'Go'], typicalProjectTypes: ['APPLICATION'], timestamps: { createdAt: new Date(), updatedAt: new Date() } },
  },

  {
    id: 'e-commerce',
    slug: 'e-commerce',
    name: '电商',
    description: '电子商务平台和应用',
    hierarchy: { level: 0 },
    characteristics: {
      business: {
        typicalUserRoles: ['customer', 'merchant', 'admin', 'support'],
        commonWorkflows: ['商品浏览', '下单支付', '物流追踪', '售后服务'],
        keyEntities: [
          { name: 'Product', pluralName: 'Products', description: '商品', attributes: [], relationships: [] },
          { name: 'Order', pluralName: 'Orders', description: '订单', attributes: [], relationships: [] },
          { name: 'Payment', pluralName: 'Payments', description: '支付', attributes: [], relationships: [] },
        ],
        businessRules: ['库存扣减', '价格计算', '促销规则', '退款政策'],
      },
      technical: {
        architecturePatterns: ['Microservices', 'Event-Driven'],
        commonIntegrations: ['PaymentGateway', 'Logistics', 'Inventory', 'CRM'],
        dataModels: ['Product', 'Order', 'Customer', 'Inventory', 'Payment'],
        apiStyles: ['rest'],
      },
      domainSpecific: {
        complianceRequirements: ['PCI-DSS', 'ConsumerProtection'],
        scalabilityNeeds: ['大促弹性', '库存一致性'],
        securityRequirements: ['支付安全', '防刷单'],
        performanceBenchmarks: { 'checkout-latency': 2000 },
      },
    },
    knowledge: { concepts: [], vocabulary: [], rules: [], patterns: [], referenceProjects: [], bestPractices: [] },
    constraints: { maxComplexity: 9, disallowedPatterns: [], requiredPatterns: ['inventory-reservation'] },
    stats: { projectsCount: 0, templatesCount: 0, patternsCount: 0, avgQualityScore: 0 },
    metadata: { maturity: 'mature', supportedLanguages: ['TypeScript', 'Python'], typicalProjectTypes: ['APPLICATION', 'API_SERVICE'], timestamps: { createdAt: new Date(), updatedAt: new Date() } },
  },

  {
    id: 'saas',
    slug: 'saas',
    name: 'SaaS应用',
    description: '软件即服务应用',
    hierarchy: { level: 0 },
    characteristics: {
      business: {
        typicalUserRoles: ['tenant-admin', 'tenant-user', 'platform-admin'],
        commonWorkflows: ['订阅管理', '多租户管理', '计费结算'],
        keyEntities: [
          { name: 'Tenant', pluralName: 'Tenants', description: '租户', attributes: [], relationships: [] },
          { name: 'Subscription', pluralName: 'Subscriptions', description: '订阅', attributes: [], relationships: [] },
        ],
        businessRules: ['订阅等级', '用量限制', '升级降级'],
      },
      technical: {
        architecturePatterns: ['Multi-tenant', 'Microservices'],
        commonIntegrations: ['Billing', 'Email', 'Analytics'],
        dataModels: ['Tenant', 'Subscription', 'Plan', 'Usage'],
        apiStyles: ['rest', 'graphql'],
      },
      domainSpecific: {
        complianceRequirements: ['SOC2', 'ISO27001'],
        scalabilityNeeds: ['租户隔离', '资源配额'],
        securityRequirements: ['数据隔离', '访问控制'],
        performanceBenchmarks: { 'api-latency-p99': 200 },
      },
    },
    knowledge: { concepts: [], vocabulary: [], rules: [], patterns: [], referenceProjects: [], bestPractices: [] },
    constraints: { maxComplexity: 9, disallowedPatterns: [], requiredPatterns: ['multi-tenancy'] },
    stats: { projectsCount: 0, templatesCount: 0, patternsCount: 0, avgQualityScore: 0 },
    metadata: { maturity: 'stable', supportedLanguages: ['TypeScript'], typicalProjectTypes: ['APPLICATION', 'API_SERVICE'], timestamps: { createdAt: new Date(), updatedAt: new Date() } },
  },

  {
    id: 'internal-tool',
    slug: 'internal-tool',
    name: '内部工具',
    description: '企业内部工具和自动化脚本',
    hierarchy: { level: 0 },
    characteristics: {
      business: {
        typicalUserRoles: ['employee', 'manager', 'admin'],
        commonWorkflows: ['审批流程', '数据报表', '任务管理'],
        keyEntities: [
          { name: 'Task', pluralName: 'Tasks', description: '任务', attributes: [], relationships: [] },
          { name: 'Report', pluralName: 'Reports', description: '报表', attributes: [], relationships: [] },
        ],
        businessRules: ['权限控制', '审批链'],
      },
      technical: {
        architecturePatterns: ['Monolith', 'Microservices', 'CLI'],
        commonIntegrations: ['Database', 'Internal APIs', 'Scheduler'],
        dataModels: ['Task', 'Workflow', 'AuditLog'],
        apiStyles: ['rest', 'grpc'],
      },
      domainSpecific: {
        complianceRequirements: ['SOX', 'InternalAudit'],
        scalabilityNeeds: ['单租户', '小规模'],
        securityRequirements: ['访问审计', '单点登录'],
        performanceBenchmarks: {},
      },
    },
    knowledge: { concepts: [], vocabulary: [], rules: [], patterns: [], referenceProjects: [], bestPractices: [] },
    constraints: { maxComplexity: 6, disallowedPatterns: [], requiredPatterns: ['audit-logging'] },
    stats: { projectsCount: 0, templatesCount: 0, patternsCount: 0, avgQualityScore: 0 },
    metadata: { maturity: 'mature', supportedLanguages: ['TypeScript', 'Python', 'Go'], typicalProjectTypes: ['APPLICATION', 'CLI_TOOL'], timestamps: { createdAt: new Date(), updatedAt: new Date() } },
  },
];
```

## 知识迁移引擎

### 迁移流程

```typescript
// 迁移请求
interface TransferRequest {
  // 源域
  sourceDomain: {
    domainId: string;
    projectId?: string;          // 可选：具体项目
    patterns?: string[];          // 可选：特定模式
  };

  // 目标域
  targetDomain: {
    domainId: string;
    customizationHints?: string[]; // 定制提示
  };

  // 迁移选项
  options: {
    preserveArchitecture: boolean;  // 保留架构
    adaptPatterns: boolean;           // 适配模式
    translateVocabulary: boolean;     // 翻译词汇
    applyTargetConstraints: boolean; // 应用目标约束
  };
}

// 迁移结果
interface TransferResult {
  id: string;
  request: TransferRequest;

  // 迁移的知识
  transferredKnowledge: {
    patterns: TransferredPattern[];
    vocabulary: VocabMapping[];
    rules: TransferredRule[];
    entities: EntityMapping[];
  };

  // 适配建议
  adaptations: Adaptation[];

  // 冲突和解决方案
  conflicts: Conflict[];

  // 生成的想法
  generatedIdea?: GeneratedIdea;

  // 质量评估
  transferQuality: {
    completeness: number;         // 迁移完整度 (0-100)
    fidelity: number;             // 迁移保真度 (0-100)
    targetFitness: number;        // 目标适应性 (0-100)
  };

  metadata: {
    transferredAt: Date;
    processingTimeMs: number;
    confidence: number;
  };
}

interface TransferredPattern {
  sourcePattern: string;
  targetPattern: string;
  adaptation: string;
  confidence: number;
}

interface VocabMapping {
  sourceTerm: string;
  targetTerm: string;
  isExactMatch: boolean;
  explanation: string;
}

interface Adaptation {
  type: 'modify' | 'replace' | 'remove' | 'add';
  reason: string;
  original: string;
  adapted: string;
}
```

### 迁移Agent

```typescript
// 迁移Agent
class TransferAgent {
  name = 'TransferAgent';
  llm: ChatOpenAI;

  // 执行迁移
  async transfer(request: TransferRequest): Promise<TransferResult> {
    const startTime = Date.now();

    // 1. 获取源域知识
    const sourceKnowledge = await this.loadSourceKnowledge(request.sourceDomain);

    // 2. 获取目标域知识
    const targetKnowledge = await this.loadTargetKnowledge(request.targetDomain.domainId);

    // 3. 分析可迁移性
    const transferability = await this.analyzeTransferability(
      sourceKnowledge,
      targetKnowledge
    );

    // 4. 执行迁移
    const transferred = await this.executeTransfer(
      sourceKnowledge,
      targetKnowledge,
      transferability,
      request.options
    );

    // 5. 解决冲突
    const conflicts = await this.resolveConflicts(transferred);

    // 6. 生成适配建议
    const adaptations = await this.generateAdaptations(
      transferred,
      request.targetDomain.customizationHints
    );

    // 7. 生成新想法
    const idea = await this.synthesizeIdea(
      transferred,
      adaptations,
      request.targetDomain
    );

    // 8. 评估迁移质量
    const quality = this.assessTransferQuality(
      sourceKnowledge,
      transferred,
      idea
    );

    return {
      id: this.generateId(),
      request,
      transferredKnowledge: transferred,
      adaptations,
      conflicts,
      generatedIdea: idea,
      transferQuality: quality,
      metadata: {
        transferredAt: new Date(),
        processingTimeMs: Date.now() - startTime,
        confidence: quality.fidelity,
      },
    };
  }

  // 跨领域类比推理
  private async crossDomainAnalogy(
    sourceConcept: string,
    targetDomain: DomainKnowledge
  ): Promise<AnalogyResult> {
    const prompt = `
源领域概念: ${sourceConcept}

目标领域知识:
- 概念: ${targetDomain.concepts.map(c => c.term).join(', ')}
- 实体: ${targetDomain.concepts.map(c => c.term).join(', ')}

请找出目标领域中的对应概念，并解释类比关系。

格式:
{
  "targetConcept": "目标领域概念",
  "analogyExplanation": "类比解释",
  "similarity": 0-1,
  "adaptationsNeeded": ["需要的适配"]
}
`;

    return this.llm.withStructuredOutput(AnalogyResultSchema).invoke(prompt);
  }
}
```

### 模式适配器

```typescript
// 模式适配器
class PatternAdapter {
  // 适配架构模式
  adaptArchitecturePattern(
    sourcePattern: string,
    targetDomain: Domain
  ): AdaptedPattern {
    // 1. 查找目标域的等效模式
    const equivalent = this.findEquivalentPattern(sourcePattern, targetDomain);

    // 2. 如果没有等效模式，进行适配
    if (!equivalent) {
      return this.adaptPattern(sourcePattern, targetDomain);
    }

    return equivalent;
  }

  // 模式映射表
  private patternMapping: Record<string, Record<string, string>> = {
    // Web应用 -> 电商
    'session-management': {
      'e-commerce': 'shopping-cart-session',
      'saas': 'workspace-session',
      'internal-tool': 'workflow-session',
    },
    // 认证 -> 跨领域
    'jwt-auth': {
      'e-commerce': 'customer-auth',
      'saas': 'sso-auth',
      'internal-tool': 'ldap-auth',
    },
    // 数据模型适配
    'user-to-product': {
      'e-commerce': 'customer-to-product',
      'saas': 'member-to-resource',
    },
  };

  // 执行模式适配
  private adaptPattern(
    sourcePattern: string,
    targetDomain: Domain
  ): AdaptedPattern {
    const mapping = this.patternMapping[sourcePattern];
    if (mapping && mapping[targetDomain.id]) {
      return {
        original: sourcePattern,
        adapted: mapping[targetDomain.id],
        adaptations: this.computeAdaptations(sourcePattern, mapping[targetDomain.id]),
      };
    }

    // 默认：添加领域前缀
    return {
      original: sourcePattern,
      adapted: `${targetDomain.slug}-${sourcePattern}`,
      adaptations: ['prefix-added'],
    };
  }
}
```

## 领域学习系统

### 从项目中学习

```typescript
// 领域学习器
class DomainLearner {
  // 从项目学习领域知识
  async learnFromProject(projectId: string): Promise<LearnedKnowledge> {
    // 1. 提取项目结构
    const structure = await this.extractStructure(projectId);

    // 2. 识别领域概念
    const concepts = await this.identifyConcepts(structure);

    // 3. 提取业务规则
    const rules = await this.extractRules(structure);

    // 4. 识别模式
    const patterns = await this.identifyPatterns(structure);

    // 5. 学习词汇
    const vocabulary = await this.learnVocabulary(structure);

    return {
      concepts,
      rules,
      patterns,
      vocabulary,
      sourceProject: projectId,
      confidence: this.computeConfidence(structure),
    };
  }

  // 增量学习
  async incrementalLearn(
    domainId: string,
    projectId: string
  ): Promise<void> {
    // 1. 学习新项目
    const learned = await this.learnFromProject(projectId);

    // 2. 与现有知识合并
    const merged = await this.mergeWithExistingKnowledge(domainId, learned);

    // 3. 更新领域知识
    await this.updateDomainKnowledge(domainId, merged);

    // 4. 验证一致性
    await this.validateConsistency(domainId);
  }
}
```

### 知识融合

```typescript
// 知识融合引擎
class KnowledgeFusionEngine {
  // 融合多个领域的知识
  async fuseKnowledge(
    domains: string[],
    fusionStrategy: 'union' | 'intersection' | 'weighted'
  ): Promise<FusedKnowledge> {
    // 1. 收集各领域知识
    const domainKnowledges = await Promise.all(
      domains.map(d => this.getDomainKnowledge(d))
    );

    // 2. 根据策略融合
    switch (fusionStrategy) {
      case 'union':
        return this.fuseByUnion(domainKnowledges);
      case 'intersection':
        return this.fuseByIntersection(domainKnowledges);
      case 'weighted':
        return this.fuseByWeighted(domainKnowledges);
    }
  }

  // 融合概念
  private fuseConcepts(
    concepts: Concept[][],
    weights: number[]
  ): FusedConcept[] {
    // 按相似度聚类
    const clusters = this.clusterBySimilarity(concepts.flat());

    // 选择代表性概念
    return clusters.map(cluster => ({
      id: this.generateId(),
      term: this.selectRepresentative(cluster, weights),
      synonyms: this.collectSynonyms(cluster),
      relatedConcepts: this.mergeRelationships(cluster),
      confidence: this.computeClusterConfidence(cluster, weights),
    }));
  }
}
```

## 领域推荐

### 领域推荐引擎

```typescript
// 领域推荐
interface DomainRecommendation {
  domain: Domain;
  relevanceScore: number;
  matchReasons: string[];
  suggestedAdaptations: string[];
  confidence: number;
}

// 领域推荐器
class DomainRecommender {
  // 推荐最适合的领域
  async recommendForIdea(idea: Idea): Promise<DomainRecommendation[]> {
    // 1. 提取想法特征
    const features = this.extractFeatures(idea);

    // 2. 计算领域匹配度
    const scores = await this.computeDomainScores(features);

    // 3. 生成推荐
    return scores
      .filter(s => s.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .map(s => ({
        domain: s.domain,
        relevanceScore: s.score,
        matchReasons: s.reasons,
        suggestedAdaptations: s.adaptations,
        confidence: s.confidence,
      }));
  }

  // 特征提取
  private extractFeatures(idea: Idea): IdeaFeatures {
    return {
      keywords: this.extractKeywords(idea),
      entityTypes: this.identifyEntityTypes(idea),
      workflows: this.identifyWorkflows(idea),
      technicalRequirements: idea.technicalRequirements,
      businessModel: this.inferBusinessModel(idea),
    };
  }
}
```

## 配置示例

```yaml
# 领域适配配置
domain_adaptation:
  # 领域管理
  domains:
    storage: "sqlite"
    cache_ttl: "1h"
    auto_learn: true
    learning_interval: "daily"

  # 迁移设置
  transfer:
    enabled: true
    default_strategy: "weighted"
    confidence_threshold: 0.6
    max_transfer_depth: 3  # 最大跨领域深度

  # 知识提取
  knowledge_extraction:
    from_projects:
      enabled: true
      min_project_quality: 70
      extract_concepts: true
      extract_patterns: true
      extract_rules: true

    from_feedback:
      enabled: true
      feedback_weight: 0.3

  # 融合策略
  fusion:
    default_strategy: "weighted"
    weights:
      concept_overlap: 0.4
      pattern_compatibility: 0.3
      vocabulary_similarity: 0.3

  # 领域覆盖
  coverage:
    auto_expand: true
    target_domains: 20
    priority_domains:
      - "web-application"
      - "e-commerce"
      - "saas"
      - "internal-tool"
      - "mobile-app"
```

## 最佳实践

### 领域知识管理

```typescript
const DOMAIN_KNOWLEDGE_PRACTICES = {
  // 知识质量
  quality: {
    min_confidence_threshold: 0.7,
    require_validation: true,
    human_review_threshold: 0.85,
    auto_clean_invalid: true,
  },

  // 知识更新
  updates: {
    incremental: true,
    conflict_resolution: 'latest_wins',  # 或 'human_review'
    version_control: true,
    audit_changes: true,
  },

  // 知识共享
  sharing: {
    cross_domain_enabled: true,
    public_domains: ['web-application', 'internal-tool'],
    restricted_domains: ['enterprise'],
    sharing_benefits: true,  # 贡献者获得奖励
  },

  // 领域成熟度
  maturity_levels: {
    experimental: {
      min_projects: 0,
      min_quality: 0,
      auto_generation: false,
    },
    alpha: {
      min_projects: 5,
      min_quality: 50,
      auto_generation: false,
    },
    beta: {
      min_projects: 20,
      min_quality: 65,
      auto_generation: true,
    },
    stable: {
      min_projects: 50,
      min_quality: 75,
      auto_generation: true,
    },
    mature: {
      min_projects: 200,
      min_quality: 85,
      auto_generation: true,
    },
  },
};
```

---

**最后更新**: 2026-04-14
