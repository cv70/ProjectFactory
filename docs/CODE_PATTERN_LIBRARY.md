# 代码模式库

## 概述

代码模式库（Code Pattern Library）是 ProjectFactory 系统的核心知识组件，用于沉淀、索引和复用经过验证的代码模式。通过系统化地积累最佳实践，系统能够生成更高质量的代码，减少重复发明轮子，并加速新项目的开发。

## 核心价值

- **质量保证**：复用经过验证的代码模式，减少新代码带来的风险
- **效率提升**：新项目 = 模式组合 + 少量定制
- **知识传承**：将专家经验编码为可执行的模式
- **一致性保证**：确保生成代码遵循统一的架构和编码规范

## 模式分类体系

### 按复杂度分类

```typescript
// 模式复杂度等级
enum PatternComplexity {
  // 基础模式（语言/框架内置）
  FOUNDATIONAL = 'foundational',

  // 设计模式（23种GoF模式）
  DESIGN = 'design',

  // 架构模式（分层/微服务/事件驱动等）
  ARCHITECTURAL = 'architectural',

  // 复合模式（多个基础模式的组合）
  COMPOSITE = 'composite',

  // 领域特定模式（业务相关的专业模式）
  DOMAIN_SPECIFIC = 'domain_specific',
}

// 模式元数据
interface PatternMetadata {
  id: string;
  name: string;
  category: PatternCategory;
  complexity: PatternComplexity;

  // 使用统计
  usageCount: number;
  successRate: number;
  avgQualityScore: number;

  // 适用性
  applicableTo: ProjectType[];
  languageAgnostic: boolean;
  supportedLanguages: string[];

  // 关联
  dependencies: string[];      // 依赖的其他模式
  predecessors: string[];     // 通常在之前使用的模式
  successors: string[];       // 通常在之后使用的模式
}
```

### 按领域分类

```typescript
// 领域分类
enum PatternDomain {
  // 前端
  FRONTEND_UI = 'frontend_ui',
  FRONTEND_STATE = 'frontend_state',
  FRONTEND_ROUTING = 'frontend_routing',

  // 后端
  BACKEND_API = 'backend_api',
  BACKEND_BUSINESS = 'backend_business',
  BACKEND_DATA = 'backend_data',

  // 架构
  ARCHITECTURE_LAYERED = 'architecture_layered',
  ARCHITECTURE_MICROSERVICE = 'architecture_microservice',
  ARCHITECTURE_EVENT_DRIVEN = 'architecture_event_driven',

  // 基础设施
  INFRA_DEPLOYMENT = 'infra_deployment',
  INFRA_CACHING = 'infra_caching',
  INFRA_MESSAGING = 'infra_messaging',

  // 质量
  QUALITY_TESTING = 'quality_testing',
  QUALITY_MONITORING = 'quality_monitoring',
  QUALITY_DOCUMENTATION = 'quality_documentation',
}

// 模式定义
interface CodePattern {
  id: string;
  metadata: PatternMetadata;

  // 模式内容
  description: string;
  intent: string;                    // 意图
  motivation: string;               // 动机
  applicability: string[];          // 适用场景

  // 代码示例（多语言）
  examples: {
    language: string;
    code: string;
    explanation: string;
  }[];

  // 参与者（模式中涉及的类和对象）
  participants: {
    role: string;
    description: string;
    responsibilities: string[];
  }[];

  // 协作关系
  collaborations: string[];

  // 效果（优缺点）
  consequences: {
    benefits: string[];
    drawbacks: string[];
    antiPatterns: string[];         // 反模式
  };

  // 变体
  variants: {
    name: string;
    description: string;
    useWhen: string;
  }[];

  // 实施指南
  implementation: {
    prerequisites: string[];
    steps: string[];
    commonPitfalls: string[];
    validationCriteria: string[];
  };

  // 质量指标
  qualityMetrics: {
    maintainability: number;        // 1-10
    extensibility: number;
    testability: number;
    performance: number;
  };

  // 标签（用于搜索）
  tags: string[];
}
```

## 模式存储架构

### 分层存储

```typescript
// 存储层次
interface PatternStorage {
  // 热数据：高频访问模式（内存缓存）
  hot: {
    patterns: CodePattern[];
    lastAccessed: Date;
    accessCount: number;
  };

  // 温数据：中频访问模式（本地数据库）
  warm: {
    patterns: CodePattern[];
    lastAccessed: Date;
    totalCount: number;
  };

  // 冷数据：低频访问模式（对象存储）
  cold: {
    patterns: CodePattern[];
    archiveDate: Date;
  };
}

// 访问模式自动升级/降级
class PatternStorageManager {
  private HOT_THRESHOLD = 1000;      // 访问次数阈值
  private WARM_THRESHOLD = 100;      // 降级阈值

  async accessPattern(patternId: string): Promise<CodePattern> {
    const pattern = await this.getFromStorage(patternId);

    // 更新访问统计
    await this.updateAccessStats(patternId);

    // 检查是否需要升级
    if (pattern.metadata.usageCount >= this.HOT_THRESHOLD) {
      await this.promoteToHot(patternId);
    }

    return pattern;
  }

  private async promoteToHot(patternId: string): Promise<void> {
    // 从温存储移到热存储
  }

  private async demoteToWarm(patternId: string): Promise<void> {
    // 从热存储移到温存储
  }
}
```

### 模式索引

```typescript
// 多维索引
class PatternIndex {
  // 按ID索引
  byId: Map<string, CodePattern>;

  // 按领域索引
  byDomain: Map<PatternDomain, CodePattern[]>;

  // 按复杂度索引
  byComplexity: Map<PatternComplexity, CodePattern[]>;

  // 按语言索引
  byLanguage: Map<string, CodePattern[]>;

  // 按标签索引
  byTag: Map<string, CodePattern[]>;

  // 语义索引（向量嵌入）
  semanticIndex: VectorIndex;

  // 全文搜索索引
  fullTextIndex: FullTextIndex;

  // 组合搜索
  async search(query: PatternSearchQuery): Promise<PatternSearchResult[]> {
    const results: PatternSearchResult[] = [];

    // 1. 语义相似度搜索
    if (query.semantic) {
      const semanticResults = await this.semanticIndex.search(
        query.semantic,
        query.limit
      );
      results.push(...semanticResults);
    }

    // 2. 精确过滤
    if (query.domain || query.complexity || query.language) {
      results.push(...this.filter(results, query));
    }

    // 3. 标签匹配
    if (query.tags && query.tags.length > 0) {
      results.push(...this.matchTags(query.tags));
    }

    // 4. 关键词搜索
    if (query.keywords) {
      results.push(...await this.fullTextIndex.search(query.keywords));
    }

    // 5. 排序和去重
    return this.deduplicateAndSort(results, query.sortBy);
  }
}

interface PatternSearchQuery {
  semantic?: string;              // 语义描述
  domain?: PatternDomain;
  complexity?: PatternComplexity;
  language?: string;
  tags?: string[];
  keywords?: string[];
  applicableTo?: ProjectType[];
  limit?: number;
  sortBy?: 'relevance' | 'popularity' | 'quality';
}

interface PatternSearchResult {
  pattern: CodePattern;
  relevanceScore: number;
  matchReasons: string[];
}
```

## 核心模式库

### 创建型模式

```typescript
// 工厂方法模式
const FACTORY_METHOD_PATTERN: CodePattern = {
  id: 'factory-method',
  metadata: {
    id: 'factory-method',
    name: 'Factory Method',
    category: PatternDomain.BACKEND_BUSINESS,
    complexity: PatternComplexity.DESIGN,
    usageCount: 15420,
    successRate: 0.94,
    avgQualityScore: 8.5,
    applicableTo: ['web-app', 'api-service', 'library'],
    languageAgnostic: true,
    supportedLanguages: ['typescript', 'javascript', 'python', 'java', 'go'],
  },

  intent: '定义创建对象的接口，让子类决定实例化哪个类',

  examples: [
    {
      language: 'typescript',
      code: `
abstract class Creator {
  abstract createProduct(): Product;

  operation(): string {
    const product = this.createProduct();
    return \`Creator: \${product.operation()}\`;
  }
}

class ConcreteCreatorA extends Creator {
  createProduct(): Product {
    return new ConcreteProductA();
  }
}
      `,
      explanation: 'TypeScript 实现工厂方法模式',
    },
  ],

  implementation: {
    prerequisites: [
      '了解对象创建的一般性问题',
      '有足够的抽象层次支持子类扩展',
    ],
    steps: [
      '识别需要客户端代码无法选择其类的场景',
      '声明Creator类及其工厂方法',
      '在ConcreteCreator中实现工厂方法',
      '更新客户端代码使用Creator实例',
    ],
    commonPitfalls: [
      '工厂方法不应该经常变化',
      '避免在工厂方法中包含过多业务逻辑',
    ],
    validationCriteria: [
      '对象创建逻辑与使用逻辑分离',
      '新增产品类型不需要修改现有代码',
    ],
  },
};
```

### 结构型模式

```typescript
// 装饰器模式
const DECORATOR_PATTERN: CodePattern = {
  id: 'decorator',
  metadata: {
    id: 'decorator',
    name: 'Decorator',
    category: PatternDomain.BACKEND_BUSINESS,
    complexity: PatternComplexity.DESIGN,
    usageCount: 12380,
    successRate: 0.91,
    avgQualityScore: 8.2,
    applicableTo: ['web-app', 'api-service', 'library'],
    languageAgnostic: false,
    supportedLanguages: ['typescript', 'python', 'java'],
  },

  intent: '动态地给对象添加职责，比继承更灵活',

  examples: [
    {
      language: 'typescript',
      code: `
interface Component {
  operation(): string;
}

class ConcreteComponent implements Component {
  operation(): string {
    return 'ConcreteComponent';
  }
}

class Decorator implements Component {
  constructor(protected component: Component) {}

  operation(): string {
    return this.component.operation();
  }
}

class LoggingDecorator extends Decorator {
  operation(): string {
    console.log('Before operation');
    const result = super.operation();
    console.log('After operation');
    return result;
  }
}
      `,
      explanation: 'TypeScript 装饰器模式用于日志增强',
    },
  ],
};
```

### 行为型模式

```typescript
// 策略模式
const STRATEGY_PATTERN: CodePattern = {
  id: 'strategy',
  metadata: {
    id: 'strategy',
    name: 'Strategy',
    category: PatternDomain.BACKEND_BUSINESS,
    complexity: PatternComplexity.DESIGN,
    usageCount: 18720,
    successRate: 0.96,
    avgQualityScore: 8.7,
    applicableTo: ['web-app', 'cli-tool', 'api-service', 'library'],
    languageAgnostic: true,
    supportedLanguages: ['typescript', 'javascript', 'python', 'java', 'go'],
  },

  intent: '定义一系列算法，把它们一个个封装起来，使它们可相互替换',

  examples: [
    {
      language: 'typescript',
      code: `
interface PaymentStrategy {
  pay(amount: number): Promise<PaymentResult>;
}

class CreditCardPayment implements PaymentStrategy {
  constructor(private cardNumber: string) {}

  async pay(amount: number): Promise<PaymentResult> {
    // 信用卡支付逻辑
    return { success: true, transactionId: 'xxx' };
  }
}

class PaymentContext {
  constructor(private strategy: PaymentStrategy) {}

  async executePayment(amount: number) {
    return this.strategy.pay(amount);
  }
}
      `,
      explanation: '策略模式用于支付方式选择',
    },
  ],
};
```

## 架构模式

### 分层架构

```typescript
// 分层架构模式
const LAYERED_ARCHITECTURE_PATTERN: CodePattern = {
  id: 'layered-architecture',
  metadata: {
    id: 'layered-architecture',
    name: 'Layered Architecture',
    category: PatternDomain.ARCHITECTURE_LAYERED,
    complexity: PatternComplexity.ARCHITECTURAL,
    usageCount: 45230,
    successRate: 0.98,
    avgQualityScore: 9.1,
    applicableTo: ['web-app', 'api-service'],
    languageAgnostic: true,
    supportedLanguages: ['typescript', 'python', 'java', 'go'],
  },

  description: `
┌─────────────────────────────────────────────┐
│              Presentation Layer            │
│  (Controllers, Views, API Endpoints)        │
├─────────────────────────────────────────────┤
│              Application Layer             │
│  (Use Cases, Application Services)          │
├─────────────────────────────────────────────┤
│                Domain Layer                │
│  (Entities, Value Objects, Domain Services) │
├─────────────────────────────────────────────┤
│            Infrastructure Layer            │
│  (Repositories, External Services, DB)     │
└─────────────────────────────────────────────┘
  `,

  examples: [
    {
      language: 'typescript',
      code: `
// Domain Layer
class Order {
  constructor(
    public readonly id: string,
    public readonly items: OrderItem[],
    public readonly status: OrderStatus
  ) {}

  calculateTotal(): Money { /* ... */ }
  addItem(item: OrderItem): void { /* ... */ }
}

// Application Layer
class CreateOrderUseCase {
  constructor(
    private orderRepository: OrderRepository,
    private paymentService: PaymentService
  ) {}

  async execute(request: CreateOrderRequest): Promise<Order> {
    const order = new Order(request.items);
    await this.orderRepository.save(order);
    await this.paymentService.charge(order.calculateTotal());
    return order;
  }
}

// Infrastructure Layer
class DrizzleOrderRepository implements OrderRepository {
  constructor(private db: Database) {}

  async save(order: Order): Promise<void> {
    await this.db.insert(ordersTable).values(order);
  }
}
      `,
      explanation: '标准四层架构的 TypeScript 实现',
    },
  ],

  applicability: [
    '构建企业级业务应用',
    '需要清晰职责分离的大型项目',
    '团队规模较大的协作项目',
  ],

  consequences: {
    benefits: [
      '职责清晰，便于理解',
      '层之间解耦，易于测试',
      '便于团队分工协作',
    ],
    drawbacks: [
      '增加代码复杂度',
      '可能带来性能开销',
      '需要谨慎管理依赖方向',
    ],
    antiPatterns: [
      '过早抽象（YAGNI 违反）',
      '上帝对象（把业务逻辑都放在一个类）',
      '循环依赖',
    ],
  },
};
```

## 模式发现与学习

### 自动模式发现

```typescript
// 代码分析器自动发现模式
class PatternDiscovery {
  private astAnalyzer: ASTAnalyzer;
  private graphAnalyzer: DependencyGraphAnalyzer;

  async discoverPatterns(code: string, language: string): Promise<DiscoveredPattern[]> {
    const ast = this.astAnalyzer.parse(code, language);
    const dependencies = this.graphAnalyzer.analyze(ast);

    const patterns: DiscoveredPattern[] = [];

    // 发现创建型模式
    patterns.push(...this.findCreationalPatterns(ast));

    // 发现结构型模式
    patterns.push(...this.findStructuralPatterns(ast, dependencies));

    // 发现行为型模式
    patterns.push(...this.findBehavioralPatterns(ast));

    // 评估发现质量
    return patterns.map(p => ({
      ...p,
      confidence: this.calculateConfidence(p, ast),
    }));
  }

  private findStructuralPatterns(
    ast: AST,
    dependencies: DependencyGraph
  ): DiscoveredPattern[] {
    const patterns: DiscoveredPattern[] = [];

    // 装饰器检测
    if (this.isDecoratorPattern(ast)) {
      patterns.push({
        type: 'decorator',
        confidence: 0.95,
        locations: this.findDecoratorUsages(ast),
      });
    }

    // 适配器检测
    if (this.isAdapterPattern(ast)) {
      patterns.push({
        type: 'adapter',
        confidence: 0.92,
        locations: this.findAdapterUsages(ast),
      });
    }

    return patterns;
  }
}
```

### 模式推荐引擎

```typescript
// 基于上下文的模式推荐
class PatternRecommender {
  private embeddingModel: EmbeddingModel;

  async recommend(
    context: ProjectContext,
    task: DevelopmentTask
  ): Promise<PatternRecommendation[]> {
    // 1. 分析任务特征
    const taskEmbedding = await this.embeddingModel.embed(
      \`\${task.description} \${task.technologies.join(' ')}\`
    );

    // 2. 找到相似任务的解决方案
    const similarTasks = await this.findSimilarTasks(task);

    // 3. 提取使用的模式
    const patternsUsed = await this.extractPatternsFromTasks(similarTasks);

    // 4. 过滤和排序
    return patternsUsed
      .filter(p => this.isApplicable(p, context))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(p => ({
        pattern: p.pattern,
        confidence: p.score,
        reason: p.reason,
        example: p.bestExample,
      }));
  }
}

interface PatternRecommendation {
  pattern: CodePattern;
  confidence: number;
  reason: string;
  example: CodeExample;
}
```

## 模式版本管理

```typescript
// 模式版本
interface PatternVersion {
  version: string;              // 语义版本
  changelog: string;
  breakingChanges: string[];
  deprecatedUsages: string[];

  //向后兼容的改进
  improvements: {
    description: string;
    impact: 'performance' | 'maintainability' | 'usability';
  }[];

  // 迁移指南
  migration: {
    fromVersion: string;
    toVersion: string;
    steps: string[];
    automated?: boolean;
  };
}
```

## 配置示例

```yaml
# 代码模式库配置
code_pattern_library:
  # 存储配置
  storage:
    hot_threshold: 1000        # 访问次数阈值
    warm_storage_size: 10000   # 温存储最大数量
    cold_archive_after_days: 90

  # 索引配置
  indexing:
    semantic_enabled: true
    semantic_model: "text-embedding-3-small"
    fulltext_enabled: true
    update_interval: "1h"

  # 发现配置
  discovery:
    enabled: true
    languages: ["typescript", "python", "go", "java"]
    min_confidence: 0.8
    auto_categorize: true

  # 推荐配置
  recommendation:
    max_results: 5
    similarity_threshold: 0.7
    include_success_rate: true
    min_success_rate: 0.85
```

## 最佳实践

### 模式选择指南

1. **从问题出发**：先理解要解决的问题，再选择模式
2. **保持简单**：优先使用简单的模式，避免过度设计
3. **考虑变化方向**：选择能够适应未来变化的模式
4. **评估权衡**：理解每个模式的好处和代价

### 模式文档编写规范

```typescript
// 模式文档检查清单
const PATTERN_DOCUMENTATION_CHECKLIST = [
  // 元数据
  'id: 唯一标识符（kebab-case）',
  'name: 人类可读名称',
  'category: 正确的分类',
  'complexity: 准确的复杂度等级',

  // 内容
  'intent: 一句话描述意图',
  'motivation: 问题背景和动机',
  'applicability: 适用场景列表',
  'examples: 至少2个语言示例',

  // 实现
  'prerequisites: 前置条件',
  'steps: 实施步骤',
  'commonPitfalls: 常见陷阱',
  'validationCriteria: 验证标准',

  // 质量
  'qualityMetrics: 质量评分',
  'tags: 搜索标签',
];
```

---

**最后更新**: 2026-04-14
