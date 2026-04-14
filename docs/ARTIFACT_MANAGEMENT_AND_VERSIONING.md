# 制品管理与版本控制

## 概述

制品管理（Artifact Management）是无限项目生成系统的核心基础设施之一，负责管理所有生成的产物——代码文件、构建产物、部署包、文档等。制品管理需要支持版本化存储、依赖追踪、变更历史、回滚能力，以及与版本控制系统的深度集成。

## 核心价值

- **可追溯性**：每个生成的制品都可追溯其来源、生成条件、验证结果
- **可复用性**：通过版本化和依赖管理，支持制品的高效复用
- **可回滚性**：任何变更都可回滚，确保系统稳定性
- **可分享性**：制品可发布到市场供其他用户或系统使用

## 制品类型体系

### 制品分类

```typescript
// 制品类型枚举
enum ArtifactType {
  // 源代码制品
  SOURCE_CODE = 'source_code',        // 源代码文件
  CONFIG_FILE = 'config_file',        // 配置文件
  BUILD_SCRIPT = 'build_script',      // 构建脚本

  // 构建产物
  COMPILED_BIN = 'compiled_bin',      // 编译产物
  PACKAGE = 'package',                // 安装包/分发包
  CONTAINER_IMAGE = 'container_image', // Docker镜像

  // 测试制品
  TEST_SUITE = 'test_suite',          // 测试套件
  TEST_REPORT = 'test_report',        // 测试报告
  COVERAGE_DATA = 'coverage_data',   // 覆盖率数据

  // 文档制品
  API_DOC = 'api_doc',               // API文档
  USER_DOC = 'user_doc',             // 用户文档
  ARCH_DOC = 'arch_doc',             // 架构文档

  // 元数据制品
  METADATA = 'metadata',             // 元数据
  MANIFEST = 'manifest',             // 清单文件
  CHECKSUM = 'checksum',             // 校验和
}

// 制品状态
enum ArtifactStatus {
  DRAFT = 'draft',                   // 草稿
  GENERATED = 'generated',            // 已生成
  VALIDATED = 'validated',            // 已验证
  PUBLISHED = 'published',            // 已发布
  DEPRECATED = 'deprecated',         // 已废弃
  DELETED = 'deleted',               // 已删除
}
```

### 制品元数据模型

```typescript
interface ArtifactMetadata {
  // 基础信息
  id: string;                         // 唯一标识 (UUID v4)
  name: string;                       // 制品名称
  version: string;                     // 语义化版本 (semver)
  type: ArtifactType;                  // 制品类型
  status: ArtifactStatus;              // 当前状态

  // 起源追踪
  projectId: string;                   // 所属项目ID
  generationId: string;                // 生成批次ID
  sourcePrompt: string;                // 原始需求
  generatorAgent: string;              // 生成Agent

  // 内容信息
  checksum: string;                    // SHA-256校验和
  size: number;                       // 文件大小(bytes)
  mimeType: string;                   // MIME类型
  encoding: string;                   // 编码方式

  // 依赖关系
  dependencies: DependencyInfo[];      // 依赖的制品
  dependents: string[];               // 依赖本制品的其他制品ID

  // 生成上下文
  context: {
    modelId: string;                  // 使用的LLM模型
    temperature: number;              // 生成温度
    tokensUsed: number;               // 消耗的token数
    generationTime: number;           // 生成耗时(ms)
    costUsd: number;                  // 生成成本(美元)
  };

  // 质量指标
  qualityMetrics: {
    qualityScore: number;              // 质量评分 (0-100)
    testCoverage?: number;             // 测试覆盖率
    lintScore?: number;                // 代码规范评分
    securityScore?: number;            // 安全评分
  };

  // 版本历史
  lineage: LineageEntry[];             // 血缘记录

  // 时间戳
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

interface DependencyInfo {
  artifactId: string;
  versionRange: string;               // semver范围
  type: 'required' | 'optional' | 'peer';
}

interface LineageEntry {
  version: string;
  timestamp: Date;
  changeReason: string;
  changeType: 'create' | 'update' | 'regenerate' | 'fork';
  generatedFrom?: string;             // 派生于哪个版本
}
```

## 制品存储架构

### 存储层次

```
┌─────────────────────────────────────────────────────────────┐
│                      制品服务层                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  版本管理   │  │  依赖解析   │  │  元数据服务 │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      缓存层 (L1-L3)                         │
│  L1: 内存缓存 (热点制品)                                     │
│  L2: 本地磁盘 (最近访问)                                     │
│  L3: 对象存储 (全部制品)                                     │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      持久化层                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ SQLite   │  │ S3/MinIO │  │ Git Repo │                   │
│  │ (元数据) │  │ (大文件) │  │ (代码)   │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### 分层存储策略

```typescript
// 存储层级定义
enum StorageTier {
  HOT = 'hot',      // 热存储：内存/SSD，最快访问
  WARM = 'warm',    // 温存储：普通磁盘，近期访问
  COLD = 'cold',    // 冷存储：对象存储，归档制品
  FROZEN = 'frozen' // 冰存储：长期归档，极少访问
}

// 自动分层配置
interface TieringConfig {
  // 热度阈值配置
  tieringRules: {
    hotTier: {
      maxSize: '10GB',
      maxAge: '1h',
      maxItems: 10000,
      accessThreshold: 10,  // 最近1小时访问次数
    },
    warmTier: {
      maxSize: '100GB',
      maxAge: '30d',
      maxItems: 100000,
      accessThreshold: 1,   // 最近30天至少访问1次
    },
    coldTier: {
      maxSize: '1TB',
      maxAge: '180d',
      accessThreshold: 0.1, // 180天内访问次数>0.1/月
    },
  };

  // 压缩配置
  compression: {
    enabled: true,
    algorithm: 'zstd',      // 高压缩比算法
    coldTierOnly: false,   // 所有层都压缩
    minSizeForCompression: '1KB',
  };

  // 去重配置
  deduplication: {
    enabled: true,
    algorithm: 'sha256',    // 内容寻址
    chunkSize: '4KB',       // 分块大小
  };
}
```

## 版本管理机制

### 语义化版本控制

```typescript
interface VersionScheme {
  // 版本号格式: major.minor.patch[-prerelease][+build]
  format: 'semver';

  // 版本号更新规则
  autoIncrement: {
    majorOnBreaking: true,    // 重大变更自动升主版本
    minorOnFeature: true,    // 新功能自动升次版本
    patchOnFix: true,        // 修复自动升补丁版本
  };

  // 预发布版本
  prerelease: {
    enabled: true,
    types: ['alpha', 'beta', 'rc'],
    autoPromoteAfterDays: {
      alpha: 7,
      beta: 14,
      rc: 7,
    },
  };
}

// 版本比较器
class VersionComparator {
  compare(v1: string, v2: string): -1 | 0 | 1 {
    // 完整实现语义化版本比较
  }

  satisfies(version: string, range: string): boolean {
    // 检查版本是否满足范围要求
  }

  getNextVersion(
    current: string,
    bumpType: 'major' | 'minor' | 'patch'
  ): string {
    // 计算下一个版本号
  }
}
```

### 版本分支模型

```
main (发布分支)
  └── v1.0.0
  └── v1.1.0
  └── v2.0.0

develop (开发分支)
  └── feature/ai-feature
  └── feature/new-generator

artifact/xxx (制品分支)
  └── artifact/project-123
  └── artifact/project-456
```

## 依赖管理

### 依赖解析引擎

```typescript
interface DependencyResolver {
  // 解析依赖图
  resolve(artifactId: string): DependencyGraph;

  // 检查循环依赖
  detectCycles(graph: DependencyGraph): CycleInfo[];

  // 计算最优版本组合
  resolveVersions(
    requirements: PackageRequirement[]
  ): ResolvedVersions;

  // 检查版本冲突
  checkConflicts(deps: DependencyInfo[]): Conflict[];
}

interface DependencyGraph {
  root: string;
  nodes: Map<string, ArtifactNode>;
  edges: DependencyEdge[];
}

interface ArtifactNode {
  id: string;
  version: string;
  metadata: ArtifactMetadata;
}

interface DependencyEdge {
  from: string;
  to: string;
  type: 'required' | 'optional' | 'peer';
  versionConstraint: string;
}

// 依赖计算结果
interface ResolvedDependencyTree {
  dependencies: ResolvedDependency[];
  versionConflicts: Conflict[];
  circularDeps: Cycle[];
  missingDeps: MissingDependency[];
}

interface ResolvedDependency {
  artifactId: string;
  version: string;
  depth: number;
  reason: string;          // 为什么依赖这个版本
  isDev: boolean;          // 是否是开发依赖
}
```

### 依赖锁定机制

```typescript
// 依赖锁文件
interface DependencyLock {
  version: '1.0.0';
  artifacts: LockedArtifact[];
  metadata: {
    generatedAt: Date;
    generator: string;
    checksum: string;
  };
}

interface LockedArtifact {
  id: string;
  version: string;
  checksum: string;
  resolvedUrl: string;
  dependencies: Record<string, string>; // artifactId -> version
}
```

## 变更追踪与历史

### 变更事件模型

```typescript
interface ArtifactChangeEvent {
  id: string;
  artifactId: string;
  version: string;

  // 变更详情
  change: {
    type: ChangeType;
    field?: string;
    oldValue?: any;
    newValue?: any;
  };

  // 变更原因
  reason: {
    category: 'generation' | 'human_edit' | 'auto_fix' | 'regeneration';
    description: string;
    triggeredBy?: string;  // userId 或 agentId
    prompt?: string;        // 如果是AI生成
  };

  // 变更影响
  impact: {
    affectedArtifacts: string[];
    breakingChanges: boolean;
    migrationRequired: boolean;
  };

  timestamp: Date;
}

enum ChangeType {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
  REGENERATED = 'regenerated',
  FORKED = 'forked',
  MERGED = 'merged',
  RESTORED = 'restored',
}
```

### 历史查询API

```typescript
// 历史查询接口
interface ArtifactHistoryQuery {
  artifactId?: string;
  projectId?: string;
  timeRange?: {
    start: Date;
    end: Date;
  };
  changeTypes?: ChangeType[];
  limit?: number;
  offset?: number;
}

interface ArtifactHistoryService {
  // 查询变更历史
  queryHistory(query: ArtifactHistoryQuery): Promise<ArtifactChangeEvent[]>;

  // 获取特定版本
  getVersion(artifactId: string, version: string): Promise<Artifact>;

  // 比较两个版本
  diff(
    artifactId: string,
    fromVersion: string,
    toVersion: string
  ): Promise<DiffResult>;

  // 时间旅行查询
  getStateAt(artifactId: string, timestamp: Date): Promise<Artifact>;

  // 获取变更统计
  getStatistics(
    artifactId: string,
    period: { start: Date; end: Date }
  ): Promise<ChangeStatistics>;
}

interface DiffResult {
  from: string;
  to: string;
  additions: number;
  deletions: number;
  modifications: FileDiff[];
}

interface FileDiff {
  path: string;
  type: 'added' | 'deleted' | 'modified';
  hunks: DiffHunk[];
}
```

## 回滚机制

### 回滚策略

```typescript
interface RollbackStrategy {
  // 自动回滚条件
  autoRollback: {
    enabled: boolean;
    triggers: {
      qualityScoreBelow: number;    // 质量分低于阈值
      testFailureRateAbove: number;  // 测试失败率高于阈值
      securityScanFailed: boolean;   // 安全扫描失败
      deploymentFailed: boolean;    // 部署失败
    };
    maxRetries: number;             // 最大重试次数
    rollbackWindow: string;          // 回滚时间窗口
  };

  // 手动回滚配置
  manualRollback: {
    requireApproval: boolean;       // 是否需要审批
    approvers: string[];            // 审批人列表
    notificationRequired: boolean;  // 是否需要通知
  };
}

// 回滚执行器
class RollbackExecutor {
  async rollback(
    artifactId: string,
    targetVersion: string,
    options: {
      force: boolean;
      skipTests: boolean;
      backup: boolean;
    }
  ): Promise<RollbackResult>;

  async rollbackWithHealthCheck(
    artifactId: string,
    targetVersion: string
  ): Promise<RollbackResult>;
}

interface RollbackResult {
  success: boolean;
  artifactId: string;
  fromVersion: string;
  toVersion: string;
  duration: number;
  steps: RollbackStep[];
  errors: string[];
}

interface RollbackStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  duration?: number;
  error?: string;
}
```

### 健康检查

```typescript
interface HealthCheck {
  artifactId: string;
  version: string;
  checks: HealthCheckResult[];
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
}

interface HealthCheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  details?: Record<string, any>;
  duration: number;
}

// 健康检查项
const HEALTH_CHECKS = {
  // 功能检查
  syntax_valid: '检查代码语法',
  imports_resolved: '检查导入是否可解析',
  dependencies_installed: '检查依赖是否已安装',

  // 质量检查
  lint_pass: '检查代码规范',
  type_check_pass: '检查类型正确性',
  test_pass: '检查测试通过率',

  // 安全检查
  no_known_vulnerabilities: '检查已知漏洞',
  no_sensitive_data: '检查敏感数据泄露',

  // 构建检查
  build_success: '检查构建成功',
  artifact_valid: '检查产物有效性',
};
```

## 与版本控制系统集成

### Git集成服务

```typescript
interface GitIntegrationService {
  // 创建制品仓库
  createArtifactRepo(
    projectId: string,
    artifactId: string
  ): Promise<GitRepo>;

  // 提交制品
  commitArtifact(
    repoId: string,
    files: ArtifactFile[],
    message: string,
    metadata?: CommitMetadata
  ): Promise<Commit>;

  // 创建分支
  createBranch(
    repoId: string,
    branchName: string,
    baseBranch?: string
  ): Promise<Branch>;

  // 合并分支
  mergeBranches(
    repoId: string,
    sourceBranch: string,
    targetBranch: string
  ): Promise<MergeResult>;

  // 创建标签
  createTag(
    repoId: string,
    tagName: string,
    target: string
  ): Promise<Tag>;

  // 获取提交历史
  getCommitHistory(
    repoId: string,
    options?: HistoryOptions
  ): Promise<Commit[]>;
}

interface GitRepo {
  id: string;
  name: string;
  url: string;
  defaultBranch: string;
  createdAt: Date;
}

interface Commit {
  hash: string;
  message: string;
  author: {
    name: string;
    email: string;
  };
  timestamp: Date;
  parents: string[];
  files: string[];
}

interface CommitMetadata {
  artifactId?: string;
  generationId?: string;
  qualityScore?: number;
  testCoverage?: number;
}
```

### 仓库模板

```typescript
// 标准制品仓库结构
const ARTIFACT_REPO_TEMPLATE = {
  // 源代码
  'src/': {
    description: '源代码目录',
    maxSize: '100MB',
    allowedExtensions: ['.ts', '.js', '.py', '.go', '.rs'],
  },

  // 配置文件
  'config/': {
    description: '配置文件目录',
    maxSize: '1MB',
    allowedExtensions: ['.json', '.yaml', '.yml', '.toml', '.env'],
  },

  // 测试
  'tests/': {
    description: '测试文件目录',
    maxSize: '50MB',
    allowedExtensions: ['.test.ts', '.spec.ts', '_test.py'],
  },

  // 文档
  'docs/': {
    description: '文档目录',
    maxSize: '10MB',
    allowedExtensions: ['.md', '.pdf', '.html'],
  },

  // 构建产物
  'dist/': {
    description: '构建产物目录',
    maxSize: '500MB',
    ignored: true,  // 通常被.gitignore
  },

  // 元数据文件
  'METADATA.json': {
    description: '制品元数据',
    required: true,
  },

  'DEPENDENCIES.lock': {
    description: '依赖锁定文件',
    required: true,
  },
};
```

## 制品发布管理

### 发布工作流

```typescript
interface PublishWorkflow {
  name: string;
  stages: PublishStage[];
  gateConditions: GateCondition[];

  // 发布审批
  approval?: {
    required: boolean;
    approvers: string[] | 'owners' | 'maintainers';
    timeout: string;
  };
}

interface PublishStage {
  name: string;
  actions: PublishAction[];
  onFailure: 'abort' | 'retry' | 'skip';
}

interface PublishAction {
  type: 'validate' | 'sign' | 'publish' | 'notify';
  config: Record<string, any>;
}

interface GateCondition {
  name: string;
  check: (artifact: Artifact) => Promise<GateResult>;
}

interface GateResult {
  passed: boolean;
  message?: string;
  details?: Record<string, any>;
}

// 预设发布工作流
const PUBLISH_WORKFLOWS = {
  // 内部发布
  internal: {
    name: '内部发布',
    stages: [
      { name: '验证', actions: [{ type: 'validate', config: { checks: ['quality', 'security'] } }] },
      { name: '发布', actions: [{ type: 'publish', config: { target: 'internal_registry' } }] },
    ],
    gateConditions: [
      { name: '质量门槛', check: (a) => Promise.resolve({ passed: a.qualityScore >= 60 }) },
    ],
  },

  // 公开发布
  public: {
    name: '公开发布',
    stages: [
      { name: '全面验证', actions: [{ type: 'validate', config: { checks: ['quality', 'security', 'license', 'docs'] } }] },
      { name: '签名', actions: [{ type: 'sign', config: { key: 'release_key' } }] },
      { name: '发布', actions: [{ type: 'publish', config: { target: 'public_marketplace' } }] },
      { name: '通知', actions: [{ type: 'notify', config: { channels: ['email', 'slack'] } }] },
    ],
    approval: { required: true, approvers: 'maintainers', timeout: '24h' },
    gateConditions: [
      { name: '质量门槛', check: (a) => Promise.resolve({ passed: a.qualityScore >= 80 }) },
      { name: '安全扫描', check: (a) => Promise.resolve({ passed: a.securityScore >= 90 }) },
    ],
  },
};
```

## 制品检索与发现

### 搜索引擎

```typescript
interface ArtifactSearchEngine {
  // 全文搜索
  search(query: SearchQuery): Promise<SearchResult[]>;

  // 语义搜索
  semanticSearch(query: string, options?: SemanticSearchOptions): Promise<SearchResult[]>;

  // 相似制品
  findSimilar(artifactId: string, limit?: number): Promise<Artifact[]>;

  // 高级筛选
  filter(filter: ArtifactFilter): Promise<Artifact[]>;
}

interface SearchQuery {
  keywords: string[];
  filters?: {
    type?: ArtifactType[];
    status?: ArtifactStatus[];
    projectId?: string;
    tags?: string[];
    dateRange?: { start: Date; end: Date };
    qualityScore?: { min: number; max: number };
  };
  sort?: {
    field: 'relevance' | 'createdAt' | 'updatedAt' | 'qualityScore' | 'downloads';
    order: 'asc' | 'desc';
  };
  pagination?: { page: number; pageSize: number };
}

interface SemanticSearchOptions {
  embeddingModel?: string;
  maxResults?: number;
  similarityThreshold?: number;
  includeMetadata?: boolean;
}
```

## 配置示例

```yaml
# 制品管理配置
artifact_management:
  storage:
    primary_backend: "s3"
    backends:
      hot: { type: "memory", max_size: "10GB" }
      warm: { type: "local_disk", path: "/data/artifacts/warm" }
      cold: { type: "s3", bucket: "projectfactory-artifacts", region: "us-east-1" }
    tiering:
      enabled: true
      check_interval: "1h"
      rules:
        - if_access_count > 100 in 1h: move_to_hot
        - if_age > 30d and access_count < 1: move_to_cold
        - if_age > 180d: move_to_frozen

  versioning:
    scheme: "semver"
    auto_increment: true
    prerelease:
      enabled: true
      types: ["alpha", "beta", "rc"]

  git_integration:
    enabled: true
    default_branch: "main"
    max_repo_size: "1GB"
    auto_init: true
    template: "standard"

  publish:
    default_workflow: "internal"
    require_approval: false
    auto_archive_after_days: 90

  retention:
    max_versions: 100
    keep_released_versions: 5
    prune_draft_after_days: 30
```

## 最佳实践

### 制品命名规范

```typescript
// 推荐的制品命名格式
const ARTIFACT_NAMING = {
  // 格式: {type}-{project}-{purpose}-{version}
  // 示例: src-aisaas-api-v1.0.0

  rules: [
    '使用小写字母和连字符',
    '包含制品类型前缀',
    '包含项目标识',
    '包含用途说明',
    '版本号独立管理',
  ],

  examples: [
    'src-task-automation',
    'config-cicd-template',
    'docs-api-reference',
    'test-e2e-checkout-flow',
  ],
};
```

### 安全最佳实践

```typescript
// 制品安全扫描
const SECURITY_SCANNING = {
  // 扫描时机
  scan_on: [
    'before_publish',      // 发布前
    'on_dependency_change', // 依赖变更时
    'scheduled',           // 定时扫描
  ],

  // 扫描项目
  checks: [
    'known_vulnerabilities', // 已知漏洞
    'secret_leaks',         // 密钥泄露
    'license_compliance',   // 许可证合规
    'malware_detection',    // 恶意软件检测
    'supply_chain_risks',   // 供应链风险
  ],

  // 漏洞处理
  vulnerability_handling: {
    critical: { action: 'block', notify: true },
    high: { action: 'warn', notify: true },
    medium: { action: 'warn', notify: false },
    low: { action: 'log', notify: false },
  },
};
```

### 性能优化

```typescript
// 性能优化策略
const PERFORMANCE_OPTIMIZATION = {
  // 缓存策略
  caching: {
    metadata_cache_ttl: '5m',
    content_cache_ttl: '1h',
    search_cache_ttl: '30s',
    max_cached_artifacts: 10000,
  },

  // 并发控制
  concurrency: {
    max_concurrent_uploads: 10,
    max_concurrent_downloads: 50,
    max_concurrent_operations: 100,
    queue_size: 1000,
  },

  // 大文件处理
  large_file_handling: {
    chunk_upload_threshold: '100MB',
    chunk_size: '10MB',
    parallel_uploads: true,
    resumable: true,
  },
};
```

---

**最后更新**: 2026-04-14
