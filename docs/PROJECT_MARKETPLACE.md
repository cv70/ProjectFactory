# 项目市场与分发系统

## 概述

项目市场（Project Marketplace）是无限项目生成系统的核心组成部分，负责将生成的制品发布、分类、搜索和分发。Marketplace不仅是软件的展示窗口，更是知识复用、价值变现、社区协作的核心平台。通过Marketplace，用户可以分享自己生成的优秀项目，也可以发现和复用他人分享的有价值成果。

## 核心价值

- **知识复用**：避免重复造轮子，加速项目开发
- **价值发现**：让优质项目获得曝光和认可
- **社区协作**：促进开发者间的交流与贡献
- **商业模式**：支持付费项目，实现价值变现
- **质量驱动**：通过评分和反馈机制驱动质量提升

## 市场角色体系

### 参与者类型

```typescript
// 市场参与者枚举
enum MarketplaceRole {
  GUEST = 'guest',               // 访客（仅浏览）
  USER = 'user',                 // 普通用户
  CONTRIBUTOR = 'contributor',   // 贡献者（可发布项目）
  MAINTAINER = 'maintainer',     // 项目维护者
  CURATOR = 'curator',           // 策展人（推荐项目）
  MODERATOR = 'moderator',      // 审核员
  ADMIN = 'admin',               // 管理员
}

// 用户档案
interface MarketplaceProfile {
  id: string;
  userId: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  role: MarketplaceRole;

  // 统计数据
  stats: {
    projectsPublished: number;
    projectsDownloaded: number;
    totalDownloads: number;
    averageRating: number;
    totalReviews: number;
    followers: number;
    following: number;
  };

  // 认证信息
  verification?: {
    verified: boolean;
    badges: Badge[];
    credentials?: string[];
  };

  // 链接
  links?: {
    website?: string;
    github?: string;
    twitter?: string;
    linkedin?: string;
  };

  // 时间
  joinedAt: Date;
  lastActiveAt: Date;
}

interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  awardedAt: Date;
}
```

### 权限模型

```typescript
// 权限定义
enum Permission {
  // 浏览权限
  VIEW_PROJECT = 'view_project',
  SEARCH_PROJECTS = 'search_projects',

  // 下载权限
  DOWNLOAD_PROJECT = 'download_project',

  // 评论权限
  CREATE_REVIEW = 'create_review',
  UPDATE_OWN_REVIEW = 'update_own_review',
  DELETE_OWN_REVIEW = 'delete_own_review',

  // 发布权限
  PUBLISH_PROJECT = 'publish_project',
  UPDATE_OWN_PROJECT = 'update_own_project',
  DELETE_OWN_PROJECT = 'delete_own_project',

  // 管理权限
  MANAGE_ANY_PROJECT = 'manage_any_project',
  MANAGE_REVIEWS = 'manage_reviews',
  MANAGE_USERS = 'manage_users',
  VIEW_ANALYTICS = 'view_analytics',
}

// 角色权限映射
const ROLE_PERMISSIONS: Record<MarketplaceRole, Permission[]> = {
  [MarketplaceRole.GUEST]: [
    Permission.VIEW_PROJECT,
    Permission.SEARCH_PROJECTS,
  ],
  [MarketplaceRole.USER]: [
    ...ROLE_PERMISSIONS[MarketplaceRole.GUEST],
    Permission.DOWNLOAD_PROJECT,
    Permission.CREATE_REVIEW,
    Permission.UPDATE_OWN_REVIEW,
    Permission.DELETE_OWN_REVIEW,
  ],
  [MarketplaceRole.CONTRIBUTOR]: [
    ...ROLE_PERMISSIONS[MarketplaceRole.USER],
    Permission.PUBLISH_PROJECT,
    Permission.UPDATE_OWN_PROJECT,
    Permission.DELETE_OWN_PROJECT,
  ],
  [MarketplaceRole.MAINTAINER]: [
    ...ROLE_PERMISSIONS[MarketplaceRole.CONTRIBUTOR],
    Permission.MANAGE_REVIEWS,
  ],
  [MarketplaceRole.CURATOR]: [
    ...ROLE_PERMISSIONS[MarketplaceRole.MAINTAINER],
    Permission.VIEW_ANALYTICS,
  ],
  [MarketplaceRole.MODERATOR]: [
    ...ROLE_PERMISSIONS[MarketplaceRole.CURATOR],
    Permission.MANAGE_ANY_PROJECT,
    Permission.MANAGE_USERS,
  ],
  [MarketplaceRole.ADMIN]: Object.values(Permission),
};

// 权限检查器
class PermissionChecker {
  async check(userId: string, permission: Permission): Promise<boolean> {
    const profile = await this.getProfile(userId);
    const permissions = ROLE_PERMISSIONS[profile.role];
    return permissions.includes(permission);
  }

  async require(userId: string, permission: Permission): Promise<void> {
    const hasPermission = await this.check(userId, permission);
    if (!hasPermission) {
      throw new ForbiddenError(`Missing permission: ${permission}`);
    }
  }
}
```

## 项目模型

### 项目条目

```typescript
// 项目类型
enum ProjectType {
  APPLICATION = 'application',     // 应用程序
  LIBRARY = 'library',             // 库/框架
  CLI_TOOL = 'cli_tool',           // CLI工具
  API_SERVICE = 'api_service',     // API服务
  TEMPLATE = 'template',           // 项目模板
  COMPONENT = 'component',          // 组件
  PLUGIN = 'plugin',               // 插件/扩展
  CONFIG = 'config',               // 配置集
  ARCHIVE = 'archive',             // 归档/杂项
}

// 项目可见性
enum ProjectVisibility {
  PUBLIC = 'public',               // 公开
  UNLISTED = 'unlisted',          // 不列出但可访问
  PRIVATE = 'private',            // 私有（仅自己可见）
}

// 项目条目
interface MarketplaceProject {
  id: string;
  slug: string;                    // URL友好的标识符

  // 基本信息
  name: string;
  shortDescription: string;        // 简短描述（100字符内）
  fullDescription: string;         // 完整描述（Markdown）
  projectType: ProjectType;
  visibility: ProjectVisibility;

  // 分类标签
  categories: string[];            // 分类列表
  tags: string[];                  // 标签列表
  language?: string;              // 主要语言
  languages?: string[];            // 涉及的语言

  // 技术信息
  technical: {
    framework?: string;            // 框架
    database?: string;             // 数据库
    architecture?: string;        // 架构风格
    dependencies?: DependencyInfo[];
    requirements?: string[];      // 系统要求
    installationGuide?: string;   // 安装指南
  };

  // 许可
  license: {
    type: string;                  // SPDX许可证ID
    url?: string;
    commercialUseAllowed?: boolean;
    modificationsAllowed?: boolean;
    attributionRequired?: boolean;
  };

  // 版本信息
  versions: ProjectVersion[];
  latestVersion: string;
  latestStableVersion?: string;

  // 统计数据
  stats: {
    downloads: number;
    views: number;
    favorites: number;
    forks: number;
  };

  // 评分
  rating: {
    average: number;               // 0-5
    count: number;                 // 评分次数
    distribution: Record<number, number>;  // 各星级数量
  };

  // 作者信息
  author: {
    id: string;
    displayName: string;
    avatar?: string;
    role: MarketplaceRole;
  };

  // 维护者
  maintainers: MarketplaceProfile[];

  // 资源链接
  resources: {
    homepage?: string;
    repository?: string;
    documentation?: string;
    apiReference?: string;
    demo?: string;
    changelog?: string;
  };

  // 媒体
  media?: {
    screenshots?: string[];
    videos?: string[];
    logo?: string;
  };

  // 审核状态
  moderation: {
    status: 'pending' | 'approved' | 'rejected' | 'flagged';
    reviewedBy?: string;
    reviewedAt?: Date;
    rejectionReason?: string;
  };

  // 时间戳
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  archivedAt?: Date;
}

interface ProjectVersion {
  version: string;                 // 语义化版本
  releaseNotes: string;              // 更新说明
  artifactUrl: string;              // 制品下载地址
  checksum: string;                 // SHA-256校验和
  size: number;                     // 文件大小
  dependencies: DependencyInfo[];
  compatibility: {
    minNodeVersion?: string;
    maxNodeVersion?: string;
    browsers?: string[];
  };

  // 发布信息
  releaseDate: Date;
  releaseType: 'major' | 'minor' | 'patch' | 'prerelease';
  isStable: boolean;
  isLatest: boolean;
}
```

### 项目分类体系

```typescript
// 分类树
interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;

  // 层级
  level: number;                    // 0为顶级
  parentId?: string;               // 父分类ID
  children?: Category[];

  // 统计
  stats: {
    projectCount: number;
    weeklyDownloads: number;
  };

  // 配置
  metadata: {
    requiredTags?: string[];       // 必选标签
    allowedProjectTypes?: ProjectType[];
    ageRestriction?: 'all' | '13+' | '18+';
  };
}

// 预设分类
const PRESET_CATEGORIES: Category[] = [
  // Web应用
  {
    id: 'web-app',
    slug: 'web-application',
    name: 'Web应用',
    description: '完整的Web应用程序',
    icon: 'globe',
    level: 0,
    stats: { projectCount: 0, weeklyDownloads: 0 },
    metadata: { allowedProjectTypes: [ProjectType.APPLICATION] },
  },
  {
    id: 'web-app-frontend',
    slug: 'frontend',
    name: '前端应用',
    description: '前端Web应用',
    icon: 'layout',
    level: 1,
    parentId: 'web-app',
    stats: { projectCount: 0, weeklyDownloads: 0 },
  },
  {
    id: 'web-app-backend',
    slug: 'backend',
    name: '后端服务',
    description: '后端API和服务',
    icon: 'server',
    level: 1,
    parentId: 'web-app',
    stats: { projectCount: 0, weeklyDownloads: 0 },
  },
  {
    id: 'web-app-fullstack',
    slug: 'fullstack',
    name: '全栈应用',
    description: '前后端一体应用',
    icon: 'layers',
    level: 1,
    parentId: 'web-app',
    stats: { projectCount: 0, weeklyDownloads: 0 },
  },

  // 开发者工具
  {
    id: 'dev-tools',
    slug: 'developer-tools',
    name: '开发者工具',
    description: '提升开发效率的工具',
    icon: 'tool',
    level: 0,
    stats: { projectCount: 0, weeklyDownloads: 0 },
    metadata: { allowedProjectTypes: [ProjectType.CLI_TOOL, ProjectType.LIBRARY] },
  },
  {
    id: 'dev-tools-cli',
    slug: 'cli-tools',
    name: 'CLI工具',
    description: '命令行工具',
    icon: 'terminal',
    level: 1,
    parentId: 'dev-tools',
    stats: { projectCount: 0, weeklyDownloads: 0 },
  },
  {
    id: 'dev-tools-automation',
    slug: 'automation',
    name: '自动化脚本',
    description: '自动化任务脚本',
    icon: 'zap',
    level: 1,
    parentId: 'dev-tools',
    stats: { projectCount: 0, weeklyDownloads: 0 },
  },

  // 库和框架
  {
    id: 'libraries',
    slug: 'libraries-frameworks',
    name: '库和框架',
    description: '可复用的代码库和框架',
    icon: 'package',
    level: 0,
    stats: { projectCount: 0, weeklyDownloads: 0 },
    metadata: { allowedProjectTypes: [ProjectType.LIBRARY, ProjectType.COMPONENT] },
  },

  // API服务
  {
    id: 'api-services',
    slug: 'api-services',
    name: 'API服务',
    description: 'RESTful API和GraphQL服务',
    icon: 'cloud',
    level: 0,
    stats: { projectCount: 0, weeklyDownloads: 0 },
    metadata: { allowedProjectTypes: [ProjectType.API_SERVICE] },
  },

  // 模板
  {
    id: 'templates',
    slug: 'templates',
    name: '项目模板',
    description: '快速启动项目的模板',
    icon: 'copy',
    level: 0,
    stats: { projectCount: 0, weeklyDownloads: 0 },
    metadata: { allowedProjectTypes: [ProjectType.TEMPLATE] },
  },
];
```

## 发布工作流

### 发布流程

```typescript
// 发布请求
interface PublishRequest {
  // 项目信息
  project: {
    name: string;
    shortDescription: string;
    fullDescription: string;
    projectType: ProjectType;
    categories: string[];
    tags: string[];
  };

  // 技术信息
  technical: {
    sourceUrl: string;            // 源码仓库地址
    language: string;
    framework?: string;
    license: string;
  };

  // 初始版本
  initialVersion: {
    version: string;
    releaseNotes: string;
    artifactUrl: string;
    checksums: Record<string, string>;
  };

  // 设置
  settings: {
    visibility: ProjectVisibility;
    price?: number;               // 如果是付费项目
    currency?: string;
    allowModifications: boolean;
    requireAttribution: boolean;
  };
}

// 发布审核
interface PublishReview {
  id: string;
  projectId: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'needs_revision';

  // 审核项目
  checks: ReviewCheck[];

  // 审核结果
  reviewedBy?: string;
  reviewedAt?: Date;
  decision?: {
    approved: boolean;
    reason?: string;
    feedback?: string;
  };

  timestamps: {
    submittedAt: Date;
    estimatedCompletionAt?: Date;
  };
}

interface ReviewCheck {
  type: 'license' | 'security' | 'quality' | 'content' | 'completeness';
  status: 'pending' | 'passed' | 'failed' | 'warning';
  details?: Record<string, any>;
  issues?: ReviewIssue[];
}

interface ReviewIssue {
  severity: 'blocking' | 'major' | 'minor' | 'suggestion';
  code: string;
  message: string;
  location?: string;
  suggestion?: string;
}

// 发布服务
class PublishService {
  // 提交发布
  async submitPublish(
    request: PublishRequest,
    userId: string
  ): Promise<PublishReview> {
    // 1. 验证请求
    await this.validateRequest(request);

    // 2. 检查权限
    await this.permissionChecker.require(userId, Permission.PUBLISH_PROJECT);

    // 3. 创建项目
    const project = await this.createProject(request, userId);

    // 4. 触发审核
    const review = await this.initiateReview(project);

    return review;
  }

  // 更新项目
  async updateProject(
    projectId: string,
    updates: Partial<MarketplaceProject>,
    userId: string
  ): Promise<MarketplaceProject> {
    // 1. 验证更新
    this.validateUpdates(updates);

    // 2. 检查所有权
    await this.verifyOwnership(projectId, userId);

    // 3. 执行更新
    return this.persistence.update(projectId, updates);
  }

  // 发布新版本
  async publishVersion(
    projectId: string,
    version: ProjectVersion,
    userId: string
  ): Promise<ProjectVersion> {
    // 1. 检查权限
    await this.verifyOwnership(projectId, userId);

    // 2. 验证版本号
    this.validateVersion(version);

    // 3. 安全扫描
    await this.securityScanner.scan(version.artifactUrl);

    // 4. 添加版本
    return this.addVersion(projectId, version);
  }
}
```

### 安全和质量检查

```typescript
// 自动检查项
const AUTOMATED_CHECKS = {
  // 许可证检查
  license: {
    name: 'License Compatibility Check',
    automated: true,
    failOn: ['unknown-license', 'proprietary'],
    warnOn: ['copyleft'],
  },

  // 安全扫描
  security: {
    name: 'Security Scan',
    automated: true,
    tools: ['npm audit', 'snyk', 'owasp dependency check'],
    failOn: ['critical-vulnerability', 'high-vulnerability'],
    warnOn: ['medium-vulnerability', 'low-vulnerability'],
  },

  // 代码质量
  quality: {
    name: 'Code Quality Check',
    automated: true,
    metrics: ['lint', 'test-coverage', 'maintainability'],
    thresholds: {
      testCoverage: 50,
      lintErrors: 0,
    },
  },

  // 内容检查
  content: {
    name: 'Content Moderation',
    automated: true,
    checks: ['profanity', 'spam', 'sensitive-content'],
    failOn: ['profanity', 'spam'],
  },

  // 完整性检查
  completeness: {
    name: 'Metadata Completeness',
    automated: true,
    required: ['name', 'description', 'license', 'sourceUrl'],
    recommended: ['documentation', 'screenshots', 'changelog'],
  },
};
```

## 搜索与发现

### 搜索系统

```typescript
// 搜索查询
interface SearchQuery {
  // 文本搜索
  query?: string;                  // 全文搜索词
  fuzzy?: boolean;                 // 模糊匹配

  // 过滤条件
  filters?: {
    projectType?: ProjectType[];
    category?: string[];
    tags?: string[];
    language?: string[];
    license?: string[];
    priceRange?: { min?: number; max?: number };
    ratingMin?: number;
    sortBy?: 'relevance' | 'downloads' | 'rating' | 'recent' | 'price';
    sortOrder?: 'asc' | 'desc';
  };

  // 分页
  pagination?: {
    page: number;
    pageSize: number;
  };

  // 高级选项
  options?: {
    includePrivate?: boolean;
    includeUnlisted?: boolean;
    boostedBy?: 'trending' | 'newest' | 'popular';
  };
}

// 搜索结果
interface SearchResult {
  projects: MarketplaceProject[];
  totalCount: number;
  pageCount: number;

  // 聚合信息
  aggregations: {
    projectTypes: Record<ProjectType, number>;
    categories: Record<string, number>;
    languages: Record<string, number>;
    licenses: Record<string, number>;
    priceRanges: Record<string, number>;
    ratingDistribution: Record<number, number>;
  };

  // 高亮信息
  highlights: Record<string, HighlightResult[]>;
}

interface HighlightResult {
  field: string;
  snippet: string;
  matches: number;
}

// 搜索服务
class SearchService {
  // 全文搜索
  async search(query: SearchQuery): Promise<SearchResult> {
    // 1. 解析查询
    const parsedQuery = this.parseQuery(query);

    // 2. 执行搜索
    const results = await this.searchEngine.search(parsedQuery);

    // 3. 聚合统计
    const aggregations = await this.computeAggregations(results);

    // 4. 返回结果
    return {
      projects: results.items,
      totalCount: results.totalCount,
      pageCount: results.pageCount,
      aggregations,
      highlights: results.highlights,
    };
  }

  // 语义搜索
  async semanticSearch(
    query: string,
    options?: SemanticSearchOptions
  ): Promise<SearchResult> {
    // 1. 嵌入查询
    const embedding = await this.embeddingService.embed(query);

    // 2. 向量搜索
    const results = await this.vectorIndex.search(embedding, {
      limit: options?.limit || 20,
      minScore: options?.minScore || 0.7,
    });

    // 3. 获取项目详情
    return this.getProjectsByIds(results.map(r => r.id));
  }

  // 推荐项目
  async recommend(
    userId: string,
    options?: RecommendOptions
  ): Promise<MarketplaceProject[]> {
    // 1. 获取用户历史
    const userHistory = await this.getUserHistory(userId);

    // 2. 构建推荐模型
    const recommendation = this.buildRecommendationModel(userHistory);

    // 3. 返回推荐结果
    return recommendation.getRecommendations({
      limit: options?.limit || 10,
      excludeViewed: true,
    });
  }
}
```

### 推荐系统

```typescript
// 推荐引擎
class RecommendationEngine {
  // 基于内容的推荐
  async contentBasedRecommend(
    projectId: string,
    limit: number = 10
  ): Promise<Recommendation[]> {
    const project = await this.getProject(projectId);

    // 找到相似项目
    const similar = await this.findSimilar(project, {
      maxResults: limit,
      weights: {
        category: 0.3,
        tags: 0.3,
        language: 0.2,
        framework: 0.2,
      },
    });

    return similar;
  }

  // 协同过滤推荐
  async collaborativeFiltering(
    userId: string,
    limit: number = 10
  ): Promise<Recommendation[]> {
    // 1. 获取相似用户
    const similarUsers = await this.findSimilarUsers(userId);

    // 2. 获取相似用户喜欢的项目
    const likedBySimilarUsers = await this.getLikedProjects(similarUsers);

    // 3. 排除已浏览的项目
    const viewedIds = await this.getViewedProjectIds(userId);

    return likedBySimilarUsers
      .filter(p => !viewedIds.includes(p.id))
      .slice(0, limit);
  }

  // 热门推荐
  async trendingProjects(limit: number = 10): Promise<Recommendation[]> {
    const trending = await this.analyticsStore.getTrending({
      period: '7d',
      metric: 'downloads',
      limit,
    });

    return trending.map(item => ({
      projectId: item.projectId,
      score: item.score,
      reason: 'trending',
    }));
  }

  // 新项目推荐
  async newestProjects(limit: number = 10): Promise<Recommendation[]> {
    return this.persistence
      .query({
        orderBy: 'publishedAt',
        order: 'desc',
        limit,
        filters: { visibility: ProjectVisibility.PUBLIC },
      });
  }
}

interface Recommendation {
  projectId: string;
  score: number;
  reason: string;
}
```

## 评分与评论

### 评分系统

```typescript
// 用户评分
interface ProjectReview {
  id: string;
  projectId: string;
  userId: string;

  // 评分 (1-5)
  rating: number;

  // 标题
  title?: string;

  // 内容
  content: string;

  // 各项评分
  breakdown?: {
    easeOfUse: number;
    documentation: number;
    features: number;
    performance: number;
    value: number;
  };

  // 反馈
  feedback: {
    foundHelpful: number;
    foundNotHelpful: number;
    replies: number;
  };

  // 状态
  status: 'published' | 'hidden' | 'deleted';

  timestamps: {
    createdAt: Date;
    updatedAt: Date;
    verifiedAt?: Date;              // 是否验证购买/使用
  };
}

// 评分统计
interface RatingStats {
  projectId: string;
  average: number;
  count: number;
  distribution: Record<number, number>;  // 1: x, 2: y, ...
  breakdownAverages?: {
    easeOfUse: number;
    documentation: number;
    features: number;
    performance: number;
    value: number;
  };
}

// 评分服务
class ReviewService {
  // 创建评分
  async createReview(
    userId: string,
    projectId: string,
    review: CreateReviewRequest
  ): Promise<ProjectReview> {
    // 1. 检查是否已评分
    const existing = await this.getUserReview(userId, projectId);
    if (existing) {
      throw new Error('Already reviewed');
    }

    // 2. 验证项目存在
    const project = await this.getProject(projectId);
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    // 3. 创建评分
    const newReview = await this.persistence.create({
      ...review,
      userId,
      projectId,
      status: 'published',
    });

    // 4. 更新项目评分统计
    await this.updateProjectRatingStats(projectId);

    return newReview;
  }

  // 更新评分
  async updateReview(
    reviewId: string,
    userId: string,
    updates: UpdateReviewRequest
  ): Promise<ProjectReview> {
    await this.verifyOwnership(reviewId, userId);
    const updated = await this.persistence.update(reviewId, updates);
    await this.updateProjectRatingStats(updated.projectId);
    return updated;
  }

  // 标记helpful
  async markHelpful(reviewId: string, userId: string): Promise<void> {
    await this.feedbackStore.increment(`review:${reviewId}:helpful`);
    await this.recordUserAction(userId, reviewId, 'mark_helpful');
  }
}
```

## 付费项目

### 定价模型

```typescript
// 项目定价
interface ProjectPricing {
  projectId: string;

  // 定价类型
  pricingType: 'free' | 'one-time' | 'subscription';

  // 价格信息
  price?: {
    amount: number;
    currency: string;
    displayPrice: string;          // 显示用
  };

  // 订阅配置
  subscription?: {
    interval: 'monthly' | 'yearly';
    trialDays: number;
    cancelPolicy: 'anytime' | 'with-notice';
  };

  // 许可条款
  licensing: {
    commercialUse: boolean;
    multipleInstances: boolean;
    modifications: boolean;
    attributionRequired: boolean;
  };

  // 销售收入分配
  revenueShare?: {
    authorPercent: number;          // 作者分成
    platformPercent: number;       // 平台分成
  };
}

// 购买记录
interface Purchase {
  id: string;
  userId: string;
  projectId: string;
  version?: string;                // 购买的特定版本

  // 交易信息
  transaction: {
    id: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    status: 'pending' | 'completed' | 'refunded' | 'failed';
  };

  // 许可证
  license: {
    key: string;
    type: string;
    issuedAt: Date;
    expiresAt?: Date;
    maxInstances?: number;
  };

  timestamps: {
    purchasedAt: Date;
    expiresAt?: Date;
    refundedAt?: Date;
  };
}

// 支付服务
class PaymentService {
  // 创建订单
  async createOrder(
    userId: string,
    projectId: string,
    paymentMethod: string
  ): Promise<Order> {
    const project = await this.getProject(projectId);
    const pricing = await this.getPricing(projectId);

    if (pricing.pricingType === 'free') {
      throw new Error('Project is free');
    }

    // 创建订单
    const order = await this.orders.create({
      userId,
      projectId,
      amount: pricing.price.amount,
      currency: pricing.price.currency,
      paymentMethod,
    });

    // 处理支付
    return this.processPayment(order);
  }

  // 验证许可证
  async validateLicense(
    userId: string,
    projectId: string,
    licenseKey: string
  ): Promise<boolean> {
    const purchase = await this.getPurchaseByLicenseKey(licenseKey);

    if (!purchase) return false;
    if (purchase.userId !== userId) return false;
    if (purchase.projectId !== projectId) return false;

    // 检查过期
    if (purchase.license.expiresAt && purchase.license.expiresAt < new Date()) {
      return false;
    }

    return true;
  }
}
```

## 排行榜与发现

### 排行榜

```typescript
// 排行榜类型
enum LeaderboardType {
  DOWNLOADS = 'downloads',
  RATINGS = 'ratings',
  TRENDING = 'trending',
  NEWEST = 'newest',
  EDITORS_CHOICE = 'editors_choice',
}

// 排行榜服务
class LeaderboardService {
  // 获取排行榜
  async getLeaderboard(
    type: LeaderboardType,
    options?: {
      category?: string;
      language?: string;
      period?: 'daily' | 'weekly' | 'monthly' | 'all';
      limit?: number;
      offset?: number;
    }
  ): Promise<LeaderboardEntry[]> {
    const cacheKey = `leaderboard:${type}:${JSON.stringify(options)}`;

    // 尝试从缓存获取
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // 计算排行榜
    const entries = await this.computeLeaderboard(type, options);

    // 缓存结果
    await this.cache.set(cacheKey, entries, { ttl: '5m' });

    return entries;
  }

  private async computeLeaderboard(
    type: LeaderboardType,
    options?: any
  ): Promise<LeaderboardEntry[]> {
    switch (type) {
      case LeaderboardType.TRENDING:
        return this.computeTrending(options);
      case LeaderboardType.DOWNLOADS:
        return this.computeByDownloads(options);
      case LeaderboardType.RATINGS:
        return this.computeByRatings(options);
      case LeaderboardType.EDITORS_CHOICE:
        return this.getEditorsChoice(options);
      default:
        return [];
    }
  }

  // 趋势计算 (考虑增长率)
  private async computeTrending(options: any): Promise<LeaderboardEntry[]> {
    const period = options?.period || '7d';
    const downloads = await this.analyticsStore.getDownloadStats(period);
    const previousDownloads = await this.analyticsStore.getDownloadStats(
      this.getPreviousPeriod(period)
    );

    // 计算增长率
    return downloads.map(current => {
      const previous = previousDownloads.get(current.projectId) || 0;
      const growthRate = previous === 0 ? 100 :
        ((current.count - previous) / previous) * 100;

      return {
        projectId: current.projectId,
        score: growthRate,
        currentValue: current.count,
        previousValue: previous,
        growthRate,
        rank: 0,
      };
    }).sort((a, b) => b.score - a.score);
  }
}

interface LeaderboardEntry {
  rank: number;
  projectId: string;
  project: MarketplaceProject;
  score: number;
  currentValue?: number;
  previousValue?: number;
  growthRate?: number;
}
```

## 配置示例

```yaml
# 市场配置
marketplace:
  # 基本设置
  general:
    name: "ProjectFactory Market"
    description: "AI-Generated Project Marketplace"
    url: "https://market.projectfactory.ai"

  # 发布设置
  publishing:
    require_review: true
    auto_approve_threshold: 95  # 质量分>=95自动通过
    review_timeout: "48h"
    max_versions_per_project: 50

  # 安全设置
  security:
    scan_on_publish: true
    fail_on_critical_vulnerability: true
    license_whitelist: ["MIT", "Apache-2.0", "BSD-3-Clause", "ISC"]
    license_blacklist: ["GPL-3.0"]  # 可能与商业使用冲突

  # 评分设置
  rating:
    allow_multiple_reviews: false
    require_purchase_to_review: false
    min_review_length: 20
    helpfulness_voting: true

  # 付费设置
  billing:
    platform_fee_percent: 15
    payout_threshold: 10
    payout_schedule: "monthly"
    supported_currencies: ["USD", "EUR", "CNY"]

  # 缓存设置
  cache:
    search_results_ttl: "1m"
    leaderboard_ttl: "5m"
    project_detail_ttl: "5m"

  # 排行榜配置
  leaderboard:
    trending_window: "7d"
    update_interval: "1h"
    max_entries: 100
```

## 最佳实践

### 项目展示最佳实践

```typescript
// README最佳实践
const README_BEST_PRACTICES = {
  required: [
    '项目名称和徽章',
    '简短描述（1-2句话）',
    '核心特性列表',
    '快速开始指南',
    '许可证声明',
  ],

  recommended: [
    '演示截图/视频',
    '架构图',
    '使用示例',
    'API文档链接',
    '贡献指南',
    '致谢',
  ],

  optional: [
    '变更日志',
    '路线图',
    '赞助商',
    '相关项目',
    'FAQ',
  ],

  formatting: {
    line_length: 80,
    code_block_language: true,
    headingierarchy: 'h1 -> h2 -> h3',
  },
};

// 质量检查清单
const QUALITY_CHECKLIST = {
  metadata: [
    { item: '项目名称清晰易懂', weight: 1 },
    { item: '简短描述准确', weight: 1 },
    { item: '完整描述详尽', weight: 1 },
    { item: '标签准确', weight: 0.5 },
    { item: '截图/视频清晰', weight: 0.5 },
  ],

  technical: [
    { item: '代码完整可运行', weight: 2 },
    { item: '测试覆盖率 >= 50%', weight: 1.5 },
    { item: '无安全漏洞', weight: 2 },
    { item: '文档完整', weight: 1 },
    { item: '许可证明确', weight: 1 },
  ],

  userExperience: [
    { item: '安装说明清晰', weight: 1 },
    { item: '使用示例可用', weight: 1 },
    { item: '错误处理完善', weight: 0.5 },
  ],
};
```

---

**最后更新**: 2026-04-14
