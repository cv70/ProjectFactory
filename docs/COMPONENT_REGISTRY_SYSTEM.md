# 组件注册系统设计

## 概述

组件注册系统是无限生成系统的核心基础设施，负责管理、存储、发现和组合可复用组件。没有组件库，无限生成将变成无意义的大量重复代码。本系统实现组件的全生命周期管理，支持版本控制、依赖解析、智能搜索和自动组合。

## 核心价值

```
无限生成 = 组合创新 × 组件复用 × 质量保证

组件注册系统的核心价值：
1. 减少重复造轮子 - 一次创建，无数次使用
2. 保证质量一致性 - 经过验证的组件可信赖
3. 加速生成过程 - 组合比从零生成快10-100倍
4. 知识沉淀 - 将经验固化为可复用资产
```

## 组件类型体系

### 类型分类

```typescript
// 组件类型枚举
enum ComponentType {
  // 基础层组件
  TEMPLATE = 'template',           // 项目模板
  PATTERN = 'pattern',             // 设计模式
  COMPONENT = 'component',         // UI/功能组件

  // 技能层组件
  SKILL = 'skill',                // 可执行技能
  VALIDATOR = 'validator',        // 验证规则
  TRANSFORMER = 'transformer',    // 数据转换器

  // 领域层组件
  DOMAIN = 'domain',               // 领域模型
  WORKFLOW = 'workflow',           // 工作流模板
  INTEGRATION = 'integration',     // 集成方案

  // 解决方案层
  SOLUTION = 'solution',           // 完整解决方案
  STARTER = 'starter',             // 启动包
}
```

### 层级关系

```
┌─────────────────────────────────────────────────────────────┐
│                      解决方案层 (Solution)                     │
│  完整项目模板、启动包、行业解决方案                              │
├─────────────────────────────────────────────────────────────┤
│                      领域层 (Domain)                         │
│  电商领域、社交领域、数据处理领域等                              │
├─────────────────────────────────────────────────────────────┤
│                      技能层 (Skill)                          │
│  认证技能、支付技能、搜索技能、通知技能等                         │
├─────────────────────────────────────────────────────────────┤
│                      模式层 (Pattern)                        │
│  CRUD模式、事件溯源模式、CQRS模式等                            │
├─────────────────────────────────────────────────────────────┤
│                      模板层 (Template)                       │
│  React组件模板、API服务模板、数据库Schema模板等                  │
├─────────────────────────────────────────────────────────────┤
│                      基础层 (Base)                           │
│  基础类、工具函数、类型定义、配置模板等                           │
└─────────────────────────────────────────────────────────────┘
```

## 数据模型

### 组件注册表

```typescript
// 组件注册记录
interface ComponentRegistry {
  id: string;                      // 唯一标识 (如: comp_abc123)
  name: string;                    // 组件名称 (如: user-auth)
  version: string;                 // 语义化版本 (如: 1.2.3)

  type: ComponentType;             // 组件类型
  category: string;                // 分类标签 (如: auth, payment)

  // 描述信息
  description: string;             // 简短描述
  longDescription?: string;       // 详细说明 (Markdown)

  // 代码信息
  sourceCode?: string;             // 源代码 (内联)
  filePaths?: string[];            // 文件路径列表
  entryPoint?: string;             // 入口文件

  // 元数据
  language: string;                // 编程语言 (typescript, python)
  framework?: string;              // 框架 (react, express)
  dependencies?: Dependency[];     // 依赖关系

  // 属性
  props?: ComponentProperty[];    // 输入属性定义
  outputs?: string[];             // 输出接口
  events?: string[];               // 事件定义

  // 质量指标
  quality: QualityMetrics;         // 质量数据
  usageStats: UsageStats;          // 使用统计

  // 生命周期
  createdAt: Date;
  updatedAt: Date;
  deprecatedAt?: Date;
  sunsetAt?: Date;                // 计划停用日期

  // 可见性
  visibility: 'public' | 'private' | 'team';
  tags: string[];                 // 标签
  keywords: string[];             // 搜索关键词
}

// 属性定义
interface ComponentProperty {
  name: string;
  type: string;                    // TypeScript类型
  required: boolean;
  default?: any;
  description: string;
  validation?: string;             // 验证规则
}

// 质量指标
interface QualityMetrics {
  testCoverage: number;            // 测试覆盖率 0-100
  maintainabilityIndex: number;    // 可维护性指数 0-100
  complexity: number;              // 圈复杂度
  duplicatedLines: number;         // 重复代码行数

  // 代码质量评分
  codeQualityScore: number;        // 综合质量分 0-100

  // 安全扫描
  securityScore: number;           // 安全评分 0-100
  vulnerabilities: Vulnerability[];

  // 性能指标
  bundleSize?: number;             // 包大小 (bytes)
  loadTime?: number;                // 加载时间 (ms)
}

// 使用统计
interface UsageStats {
  downloadCount: number;            // 下载次数
  projectCount: number;              // 使用项目数
  instanceCount: number;            // 实例数
  lastUsedAt?: Date;
  rating: number;                   // 评分 1-5
  reviewCount: number;               // 评价数
}
```

### 版本管理

```typescript
// 版本记录
interface ComponentVersion {
  id: string;
  componentId: string;             // 所属组件ID
  version: string;                  // 语义化版本

  // 版本信息
  releaseNotes: string;             // 发布说明
  breakingChanges?: string[];       // 破坏性变更
  deprecations?: string[];          // 废弃警告

  // 代码快照
  snapshot: string;                 // 代码快照或仓库引用

  // 兼容性
  peerDependencies?: Dependency[];
  bundledDependencies?: Dependency[];

  // 发布信息
  publishedAt: Date;
  publishedBy: string;
  releaseType: 'major' | 'minor' | 'patch' | 'alpha' | 'beta';
}

// 依赖关系
interface Dependency {
  name: string;                     // 依赖名称
  versionRange: string;             // 版本范围 (如: ^1.0.0, >=2.0.0)
  type: 'production' | 'development';
  optional?: boolean;
}
```

### 组件分类索引

```typescript
// 分类索引
interface CategoryIndex {
  id: string;
  name: string;
  path: string[];                   // 层级路径 (如: ['frontend', 'ui', 'form'])
  description: string;

  // 统计
  componentCount: number;
  subCategories: string[];

  // 导航
  parentId?: string;
  childIds: string[];
}
```

## 核心服务

### 1. 注册服务

```typescript
// 注册服务接口
interface RegistryService {
  // 注册新组件
  register(request: RegisterRequest): Promise<ComponentRegistry>;

  // 更新组件
  update(id: string, request: UpdateRequest): Promise<ComponentRegistry>;

  // 发布新版本
  publishVersion(id: string, version: PublishRequest): Promise<ComponentVersion>;

  // 弃用组件
  deprecate(id: string, reason: string, sunsetDate?: Date): Promise<void>;

  // 删除组件 (软删除)
  delete(id: string): Promise<void>;

  // 恢复已删除组件
  restore(id: string): Promise<void>;
}

// 注册请求
interface RegisterRequest {
  name: string;
  type: ComponentType;
  category: string;

  description: string;
  longDescription?: string;

  sourceCode?: string;
  filePaths?: string[];

  language: string;
  framework?: string;
  dependencies?: Dependency[];

  props?: ComponentProperty[];
  visibility: 'public' | 'private' | 'team';
  tags: string[];
}
```

### 2. 发现服务

```typescript
// 发现服务接口
interface DiscoveryService {
  // 搜索组件
  search(request: SearchRequest): Promise<SearchResult[]>;

  // 智能推荐
  recommend(context: RecommendationContext): Promise<ComponentRecommendation[]>;

  // 相似组件
  findSimilar(id: string): Promise<ComponentRegistry[]>;

  // 按标签发现
  findByTags(tags: string[]): Promise<ComponentRegistry[]>;

  // 按分类浏览
  browse(categoryPath: string[]): Promise<CategoryBrowseResult>;
}

// 搜索请求
interface SearchRequest {
  query: string;                   // 搜索关键词

  // 过滤器
  type?: ComponentType[];
  language?: string[];
  framework?: string[];
  category?: string[];
  tags?: string[];

  // 质量门槛
  minCoverage?: number;
  minQualityScore?: number;
  noVulnerabilities?: boolean;

  // 分页
  page: number;
  pageSize: number;

  // 排序
  sortBy: 'relevance' | 'downloads' | 'rating' | 'updated';
  sortOrder: 'asc' | 'desc';
}

// 搜索结果
interface SearchResult {
  component: ComponentRegistry;
  score: number;                   // 相关性得分
  matchedFields: string[];          // 匹配的字段
  highlight?: string;               // 高亮片段
}

// 推荐上下文
interface RecommendationContext {
  projectType?: string;            // 项目类型
  techStack?: string[];            // 技术栈
  domain?: string;                 // 领域
  useCase?: string;                // 用例
  constraints?: string[];          // 约束条件
}

// 推荐结果
interface ComponentRecommendation {
  component: ComponentRegistry;
  reason: string;                  // 推荐理由
  confidence: number;              // 置信度 0-1
  alternativeIds?: string[];        // 备选方案
}
```

### 3. 依赖解析服务

```typescript
// 依赖解析服务
interface DependencyResolver {
  // 解析依赖树
  resolve(componentId: string, version?: string): Promise<DependencyTree>;

  // 检查兼容性
  checkCompatibility(
    componentId: string,
    existingDeps: Dependency[]
  ): Promise<CompatibilityResult>;

  // 获取升级建议
  getUpgradeSuggestions(
    componentId: string,
    currentVersion: string
  ): Promise<UpgradeSuggestion[]>;
}

// 依赖树
interface DependencyTree {
  root: DependencyNode;
  flat: DependencyNode[];          // 扁平化列表
  cycles: string[][];              // 检测到的循环依赖
}

// 依赖节点
interface DependencyNode {
  id: string;
  name: string;
  version: string;
  children: DependencyNode[];
  type: 'production' | 'development';
}

// 兼容性检查结果
interface CompatibilityResult {
  compatible: boolean;
  conflicts: ConflictInfo[];
  warnings: string[];
}

// 冲突信息
interface ConflictInfo {
  dependency: string;
  requiredVersion: string;
  existingVersion: string;
  conflictType: 'version' | 'peer' | 'optional';
}

// 升级建议
interface UpgradeSuggestion {
  fromVersion: string;
  toVersion: string;
  breaking: boolean;
  migrationGuide?: string;
  risk: 'low' | 'medium' | 'high';
}
```

### 4. 组合服务

```typescript
// 组合服务
interface CompositionService {
  // 组合组件
  compose(request: ComposeRequest): Promise<CompositionResult>;

  // 验证组合
  validateComposition(components: string[]): Promise<ValidationResult>;

  // 生成组合代码
  generateCode(
    componentIds: string[],
    config?: CompositionConfig
  ): Promise<GeneratedCode>;

  // 预览组合结果
  preview(request: ComposeRequest): Promise<CompositionPreview>;
}

// 组合请求
interface ComposeRequest {
  components: ComponentSelection[];
  target: CompositionTarget;
  constraints?: CompositionConstraints;
}

// 组件选择
interface ComponentSelection {
  componentId: string;
  version?: string;
  overrides?: Record<string, any>; // 属性覆盖
  position?: string;                 // 放置位置
}

// 组合目标
interface CompositionTarget {
  projectType: 'web-app' | 'api' | 'cli' | 'library';
  framework: string;
  language: string;
  outputPath: string;
}

// 组合约束
interface CompositionConstraints {
  maxBundleSize?: number;
  allowedLicenses?: string[];
  excludedComponents?: string[];
  forcedVersions?: Record<string, string>;
}

// 组合结果
interface CompositionResult {
  success: boolean;
  generatedFiles: GeneratedFile[];
  dependencyChanges: DependencyChange[];
  warnings: string[];
  errors: string[];
}

// 生成的文件
interface GeneratedFile {
  path: string;
  content: string;
  action: 'create' | 'merge' | 'conflict';
  conflicts?: string[];
}

// 依赖变更
interface DependencyChange {
  action: 'add' | 'update' | 'remove';
  name: string;
  fromVersion?: string;
  toVersion?: string;
}
```

## 存储架构

### 向量数据库索引

```typescript
// 向量嵌入
interface ComponentEmbedding {
  componentId: string;
  version: string;

  // 多维度嵌入
  semanticEmbedding: number[];    // 语义嵌入 (1536维)
  codeEmbedding: number[];        // 代码嵌入
  apiEmbedding: number[];          // API签名嵌入

  // 文本特征
  textFeatures: {
    nameTokens: string[];
    descriptionTokens: string[];
    codeTokens: string[];
    tagsTokens: string[];
  };

  // 更新信息
  embeddedAt: Date;
  embeddingModel: string;
}
```

### 搜索索引结构

```typescript
// 搜索索引
interface SearchIndex {
  // 倒排索引
  invertedIndex: Map<string, Set<string>>; // token -> componentIds

  // 正排索引
  forwardIndex: Map<string, ComponentRegistry>;

  // 分类索引
  categoryTree: CategoryTree;

  // 标签索引
  tagIndex: Map<string, {
    components: Set<string>;
    synonyms: string[];
  }>;

  // 权重配置
  fieldWeights: {
    name: number;                  // 默认 10.0
    description: number;           // 默认 5.0
    tags: number;                  // 默认 8.0
    code: number;                  // 默认 3.0
  };
}
```

## API 接口

### REST API

```
# 组件注册表 API

## 注册

### 注册新组件
POST /api/v1/components
Content-Type: multipart/form-data

{
  "name": "user-auth",
  "type": "component",
  "category": "auth",
  "description": "用户认证组件",
  "language": "typescript",
  "framework": "react",
  "visibility": "public",
  "tags": ["auth", "jwt", "security"]
}

### 上传组件代码
POST /api/v1/components/{id}/upload
Content-Type: multipart/form-data

file: 组件代码压缩包

## 发现

### 搜索组件
GET /api/v1/components/search?q={query}&type={type}&page={page}&size={size}

### 获取组件详情
GET /api/v1/components/{id}

### 获取特定版本
GET /api/v1/components/{id}/versions/{version}

### 获取推荐组件
GET /api/v1/components/recommend?context={context}

## 依赖

### 解析依赖
GET /api/v1/components/{id}/dependencies?version={version}

### 检查兼容性
POST /api/v1/components/check-compatibility
{
  "componentId": "comp_xxx",
  "existingDependencies": [
    {"name": "lodash", "version": "^4.0.0"}
  ]
}

## 组合

### 组合预览
POST /api/v1/components/compose/preview
{
  "components": [
    {"componentId": "comp_auth", "version": "1.2.0"},
    {"componentId": "comp_ui", "version": "2.0.0"}
  ],
  "target": {
    "projectType": "web-app",
    "framework": "react",
    "language": "typescript"
  }
}

### 执行组合
POST /api/v1/components/compose
{
  ...
}
```

## 质量门禁

### 注册质量检查

```typescript
// 注册前质量检查
const registryQualityGates: QualityGate[] = [
  {
    name: '代码完整性',
    check: async (component) => {
      const hasCode = component.sourceCode || component.filePaths?.length;
      return { passed: !!hasCode, message: '必须提供源代码或文件路径' };
    }
  },
  {
    name: '类型定义',
    check: async (component) => {
      if (component.language === 'typescript') {
        return {
          passed: component.filePaths?.some(p => p.endsWith('.d.ts')),
          message: 'TypeScript组件必须包含类型定义文件'
        };
      }
      return { passed: true };
    }
  },
  {
    name: '测试覆盖',
    check: async (component) => {
      return {
        passed: component.quality.testCoverage >= 80,
        message: `测试覆盖率需>=80%，当前: ${component.quality.testCoverage}%`
      };
    }
  },
  {
    name: '安全扫描',
    check: async (component) => {
      return {
        passed: component.quality.vulnerabilities.length === 0,
        message: `发现${component.quality.vulnerabilities.length}个安全漏洞`
      };
    }
  },
  {
    name: '文档完整性',
    check: async (component) => {
      return {
        passed: component.description.length >= 20 && !!component.longDescription,
        message: '需要提供完整的描述文档'
      };
    }
  },
  {
    name: '许可证检查',
    check: async (component) => {
      const allowedLicenses = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC'];
      return {
        passed: component.license && allowedLicenses.includes(component.license),
        message: '组件必须使用白名单内的开源许可证'
      };
    }
  }
];
```

## 生命周期管理

### 组件状态机

```
                    ┌─────────────┐
                    │   draft     │ ← 创建/导入
                    └──────┬──────┘
                           │ 提交审核
                           ▼
                    ┌─────────────┐
           ┌───────│  reviewing  │───────┐
           │       └──────┬──────┘       │
      审核拒绝            │           审核通过
           │             ▼                │
           ▼      ┌─────────────┐         │
    ┌──────────┐  │  published  │ ◄────────┘
    │ rejected │  └──────┬──────┘
    └──────────┘         │ 发现问题/弃用
                        ▼
                 ┌─────────────┐
                 │ deprecated  │ ← 软弃用 (仍可用但不推荐)
                 └──────┬──────┘
                        │ 超期/永久删除
                        ▼
                 ┌─────────────┐
                 │   sunset    │ ← 硬弃用 (不可用)
                 └──────┬──────┘
                        │ 数据保留期
                        ▼
                 ┌─────────────┐
                 │   archived  │ ← 归档 (仅元数据)
                 └─────────────┘
```

### 版本策略

```typescript
// 版本生命周期
interface VersionLifecycle {
  // Alpha版本 - 早期测试
  alpha: {
    stability: 'unstable';
    supportPeriod: '3 months';
    deprecatedAfterDays: 90;
  };

  // Beta版本 - 公开测试
  beta: {
    stability: 'beta';
    supportPeriod: '6 months';
    deprecatedAfterDays: 180;
  };

  // 稳定版本
  stable: {
    stability: 'stable';
    supportPeriod: '12 months';
    deprecatedAfterDays: 365;
  };

  // LTS版本
  lts: {
    stability: 'lts';
    supportPeriod: '24 months';
    deprecatedAfterDays: 730;
  };
}
```

## 缓存策略

### 多级缓存架构

```typescript
// 缓存配置
const cacheConfig = {
  // L1: 内存缓存 (热点组件)
  memory: {
    ttl: '5 minutes',
    maxSize: 1000,                 // 组件数
    strategy: 'lru'
  },

  // L2: Redis缓存 (频繁访问)
  redis: {
    ttl: '1 hour',
    keyPrefix: 'component:',
    compression: true
  },

  // L3: 数据库缓存 (冷数据)
  database: {
    ttl: '7 days',
    archiveAfterDays: 30
  },

  // L4: CDN缓存 (版本文件)
  cdn: {
    ttl: '30 days',
    invalidation: 'on-publish'
  }
};
```

## 访问控制

### 权限模型

```typescript
// 权限定义
enum ComponentPermission {
  READ = 'read',                   // 读取组件
  WRITE = 'write',                 // 修改组件
  DELETE = 'delete',               // 删除组件
  PUBLISH = 'publish',              // 发布版本
  TRANSFER = 'transfer',           // 转移所有权
  MANAGE = 'manage'                 // 管理设置
}

// 角色定义
interface ComponentRole {
  role: 'owner' | 'maintainer' | 'developer' | 'viewer';
  permissions: ComponentPermission[];
  componentId?: string;           // 如果是组件级角色
  teamId?: string;                 // 如果是团队角色
}

// 访问控制列表
interface ComponentACL {
  componentId: string;
  entries: ACLEntry[];
}

// ACL条目
interface ACLEntry {
  principalType: 'user' | 'team' | 'organization';
  principalId: string;
  permissions: ComponentPermission[];
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
}
```

## 集成方案

### 与代码生成系统集成

```typescript
// 组件选择器
class ComponentSelector {
  constructor(
    private registry: RegistryService,
    private resolver: DependencyResolver,
    private composer: CompositionService
  ) {}

  // 智能选择组件
  async selectComponents(context: GenerationContext): Promise<SelectedComponents> {
    // 1. 分析需求
    const requirements = await this.analyzeRequirements(context);

    // 2. 搜索候选组件
    const candidates = await this.findCandidates(requirements);

    // 3. 评估和排序
    const scored = await this.scoreAndRank(candidates, context);

    // 4. 解决依赖
    const dependencyTree = await this.resolver.resolveTree(scored.map(c => c.id));

    // 5. 验证兼容性
    const compatible = await this.validateCompatibility(dependencyTree);

    // 6. 返回最优组合
    return this.buildSelection(compatible, context);
  }
}
```

### 与知识库系统集成

```typescript
// 组件知识图谱
interface ComponentKnowledgeGraph {
  // 节点类型
  nodes: {
    component: ComponentRegistry;
    domain: Domain;
    pattern: Pattern;
    skill: Skill;
    useCase: UseCase;
  };

  // 关系类型
  edges: {
    implements: ['component', 'pattern'];      // 组件实现模式
    uses: ['component', 'component'];         // 组件依赖
    solves: ['component', 'problem'];        // 组件解决问题
    belongsTo: ['component', 'domain'];       // 组件属于领域
    similarTo: ['component', 'component'];    // 组件相似
  };
}
```

## 监控指标

### 关键指标

```typescript
// 注册表指标
const registryMetrics = {
  // 数量指标
  totalComponents: Gauge;
  componentsByType: Gauge;
  componentsByCategory: Gauge;

  // 活动指标
  registrationsPerDay: Counter;
  updatesPerDay: Counter;
  deletionsPerDay: Counter;

  // 使用指标
  searchesPerDay: Counter;
  downloadsPerDay: Counter;
  compositionsPerDay: Counter;

  // 质量指标
  averageCoverage: Gauge;
  averageQualityScore: Gauge;
  vulnerabilityCount: Gauge;

  // 性能指标
  searchLatency: Histogram;
  resolveLatency: Histogram;
  composeLatency: Histogram;
};
```

## 配置

```typescript
// 组件注册表配置
interface ComponentRegistryConfig {
  // 存储
  storage: {
    type: 'sqlite' | 'postgres' | '混合';
    sqlitePath: string;
    vectorDbUrl?: string;
    s3Bucket?: string;
  };

  // 质量门槛
  quality: {
    minCoverage: number;           // 默认 80
    minQualityScore: number;       // 默认 70
    allowedLicenses: string[];
    maxVulnerabilities: number;    // 默认 0
  };

  // 生命周期
  lifecycle: {
    draftRetentionDays: number;    // 默认 30
    deprecatedGraceDays: number;   // 默认 90
    archiveAfterDays: number;      // 默认 365
  };

  // 缓存
  cache: {
    memoryMaxSize: number;
    redisTtlSeconds: number;
    cdnTtlSeconds: number;
  };

  // 限制
  limits: {
    maxFileSize: number;           // 默认 10MB
    maxComponentsPerUser: number;  // 默认 100
    maxVersionsPerComponent: number; // 默认 50
  };
}
```

## 最佳实践

### 1. 组件设计原则

```
单一职责: 每个组件只做一件事
清晰接口: Props/API定义明确，类型安全
最小依赖: 依赖越少，越容易复用
向后兼容: 版本升级不破坏现有使用
文档完整: README + API文档 + 示例
测试覆盖: 核心路径必须有测试
```

### 2. 命名规范

```
组件名称: kebab-case (如: user-auth, payment-gateway)
版本号: semver (如: 1.2.3)
分类路径: slash-separated (如: frontend/ui/forms)
标签: snake-case (如: auth, jwt_token)
```

### 3. 发布流程

```
1. 本地开发和测试
2. 创建Pull Request
3. 代码审查和质量检查
4. 合并到main分支
5. 发布Alpha版本
6. 收集反馈，修复问题
7. 发布Beta版本
8. 稳定性测试
9. 发布Stable版本
10. 持续监控和维护
```

---

**最后更新**: 2026-04-14
