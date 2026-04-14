# 数据库架构与优化

## 概述

数据库架构与优化系统（Database Architecture & Optimization System）是ProjectFactory系统的核心数据基础设施，负责管理所有业务数据的存储、查询性能和数据安全。系统采用SQLite作为主数据库，通过精心设计的数据模型、索引策略、查询优化和备份机制，确保数据的可靠性、一致性和高性能访问。

## 核心价值

- **可靠存储**：ACID事务保障，数据完整可靠
- **性能优化**：多层索引，查询优化，高效访问
- **模式设计**：规范化与反规范化的平衡
- **扩展能力**：分区表、分库分表策略
- **运维便利**：备份恢复、监控告警

## 数据库架构

### 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                       数据库架构                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  应用层                                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Connection Pool | Query Builder | ORM (Drizzle)          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  SQLite主库                                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  主库 (project-factory.db)                                 │ │
│  │  ├── ideas                                                 │ │
│  │  ├── projects                                              │ │
│  │  ├── generations                                           │ │
│  │  ├── users                                                 │ │
│  │  ├── tenants                                               │ │
│  │  └── ...                                                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  只读副本 (Read Replicas)                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  副本1 (读流量分发)                                        │ │
│  │  副本2 (负载均衡)                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  备份与归档                                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  WAL日志 | 增量备份 | 冷存储归档                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 数据库schema设计

```typescript
// Drizzle ORM Schema定义
import { sqliteTable, text, integer, real, blob } from 'drizzle-orm/sqlite-core';

// 用户表
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),                    // UUID
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),

  // 角色和租户
  role: text('role', { enum: ['super_admin', 'org_admin', 'developer', 'viewer'] })
    .notNull().default('developer'),
  tenantId: text('tenant_id').references(() => tenants.id),

  // 认证信息
  authMethod: text('auth_method', {
    enum: ['email_password', 'google', 'github', 'saml']
  }).notNull().default('email_password'),
  passwordChangedAt: integer('password_changed_at', { mode: 'timestamp' }),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),

  // MFA
  mfaEnabled: integer('mfa_enabled', { mode: 'boolean' }).default(false),
  mfaSecret: text('mfa_secret'),

  // 状态
  status: text('status', {
    enum: ['active', 'inactive', 'suspended', 'pending']
  }).notNull().default('active'),

  // 时间戳
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().defaultNow(),
});

// 租户表
export const tenants = sqliteTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  type: text('type', { enum: ['individual', 'team', 'organization', 'enterprise'] })
    .notNull().default('individual'),

  // 联系信息
  email: text('email').notNull(),
  phone: text('phone'),

  // 配额
  quotas: text('quotas', { mode: 'json' }).$type<{
    maxProjects: number;
    maxStorageGb: number;
    maxUsers: number;
    maxGenerationsPerMonth: number;
  }>(),

  // 订阅
  subscription: text('subscription', { mode: 'json' }).$type<{
    plan: 'free' | 'starter' | 'professional' | 'enterprise';
    status: 'active' | 'past_due' | 'canceled';
    currentPeriodEnd: Date;
  }>(),

  // 设置
  settings: text('settings', { mode: 'json' }).$type<Record<string, any>>(),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().defaultNow(),
});

// 项目表
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type', {
    enum: ['web_application', 'cli_tool', 'library', 'api_service', 'template']
  }).notNull().default('web_application'),

  // 所有者
  ownerId: text('owner_id').notNull()
    .references(() => users.id),
  tenantId: text('tenant_id')
    .references(() => tenants.id),

  // 状态
  status: text('status', {
    enum: ['draft', 'queued', 'in_progress', 'completed', 'failed', 'archived']
  }).notNull().default('draft'),

  // 元数据
  metadata: text('metadata', { mode: 'json' }).$type<{
    language?: string;
    framework?: string;
    complexity?: number;
    tags?: string[];
  }>(),

  // 质量指标
  qualityScore: integer('quality_score'),         // 0-100
  testCoverage: real('test_coverage'),            // 0-1
  lintErrors: integer('lint_errors').default(0),

  // 源信息
  sourceUrl: text('source_url'),
  commitSha: text('commit_sha'),

  // 统计
  stats: text('stats', { mode: 'json' }).$type<{
    generationCount: number;
    lastGenerationAt?: Date;
    downloadCount: number;
    viewCount: number;
  }>(),

  // 可见性
  visibility: text('visibility', { enum: ['public', 'private', 'unlisted'] })
    .notNull().default('private'),

  // 时间戳
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().defaultNow(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

// 生成记录表
export const generations = sqliteTable('generations', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull()
    .references(() => projects.id),

  // 状态
  status: text('status', {
    enum: ['queued', 'running', 'completed', 'failed', 'cancelled']
  }).notNull().default('queued'),

  // 阶段
  stage: text('stage', {
    enum: ['planning', 'architecting', 'coding', 'testing', 'reviewing', 'deploying']
  }),

  // 进度
  progress: integer('progress').default(0),       // 0-100

  // 配置
  config: text('config', { mode: 'json' }).$type<{
    model?: string;
    temperature?: number;
    priority?: 'low' | 'normal' | 'high';
  }>(),

  // 结果
  result: text('result', { mode: 'json' }).$type<{
    filesGenerated?: number;
    testsGenerated?: number;
    qualityScore?: number;
    duration?: number;
    error?: string;
  }>(),

  // 资源使用
  usage: text('usage', { mode: 'json' }).$type<{
    tokensUsed?: number;
    costUsd?: number;
    computeSeconds?: number;
  }>(),

  // 时间戳
  queuedAt: integer('queued_at', { mode: 'timestamp' }).defaultNow(),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
});

// 想法表
export const ideas = sqliteTable('ideas', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  problemStatement: text('problem_statement'),
  proposedSolution: text('proposed_solution'),

  // 分类
  category: text('category'),
  tags: text('tags', { mode: 'json' }).$type<string[]>(),

  // 目标用户
  targetUsers: text('target_users', { mode: 'json' }).$type<string[]>(),

  // 价值评估
  valueAssessment: text('value_assessment', { mode: 'json' }).$type<{
    overall: number;
    utility: number;
    commercial: number;
    technical: number;
    confidence: number;
  }>(),

  // 优先级
  priority: text('priority', { enum: ['P0', 'P1', 'P2', 'P3'] }),

  // 状态
  status: text('status', {
    enum: ['pending', 'approved', 'rejected', 'in_progress', 'completed']
  }).notNull().default('pending'),

  // 来源
  source: text('source', { enum: ['user', 'ai', 'system', 'marketplace'] })
    .notNull().default('user'),

  // 关联项目
  projectId: text('project_id')
    .references(() => projects.id),

  // 创建者
  createdBy: text('created_by')
    .references(() => users.id),

  // 时间戳
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).defaultNow(),
});
```

## 索引设计

### 索引策略

```typescript
// 索引定义
const INDEX_DEFINITIONS = {
  // 用户表索引
  users: [
    { name: 'users_email_idx', columns: ['email'], unique: true },
    { name: 'users_tenant_idx', columns: ['tenant_id'] },
    { name: 'users_status_idx', columns: ['status'] },
    { name: 'users_created_idx', columns: ['created_at'] },
  ],

  // 项目表索引
  projects: [
    { name: 'projects_owner_idx', columns: ['owner_id'] },
    { name: 'projects_tenant_idx', columns: ['tenant_id'] },
    { name: 'projects_status_idx', columns: ['status'] },
    { name: 'projects_type_idx', columns: ['type'] },
    { name: 'projects_visibility_idx', columns: ['visibility'] },
    { name: 'projects_created_idx', columns: ['created_at'] },
    { name: 'projects_quality_idx', columns: ['quality_score'] },

    // 复合索引
    { name: 'projects_owner_status_idx', columns: ['owner_id', 'status'] },
    { name: 'projects_tenant_type_idx', columns: ['tenant_id', 'type'] },
  ],

  // 生成记录表索引
  generations: [
    { name: 'generations_project_idx', columns: ['project_id'] },
    { name: 'generations_status_idx', columns: ['status'] },
    { name: 'generations_stage_idx', columns: ['stage'] },
    { name: 'generations_queued_idx', columns: ['queued_at'] },

    // 复合索引
    { name: 'generations_project_status_idx', columns: ['project_id', 'status'] },
  ],

  // 想法表索引
  ideas: [
    { name: 'ideas_status_idx', columns: ['status'] },
    { name: 'ideas_priority_idx', columns: ['priority'] },
    { name: 'ideas_category_idx', columns: ['category'] },
    { name: 'ideas_created_idx', columns: ['created_at'] },
    { name: 'ideas_value_idx', columns: ['value_assessment->>\'$.overall\''] },

    // 复合索引
    { name: 'ideas_status_priority_idx', columns: ['status', 'priority'] },
  ],
};

// 生成索引SQL
function generateIndexSQL(table: string, indexes: any[]): string {
  return indexes.map(idx => {
    const columns = idx.columns.join(', ');
    const unique = idx.unique ? 'UNIQUE' : '';
    return `CREATE ${unique} INDEX IF NOT EXISTS ${idx.name} ON ${table} (${columns});`;
  }).join('\n');
}
```

### 查询优化

```typescript
// 常见查询优化模式

// 1. 分页查询优化
const PAGINATION_QUERY = `
-- 使用游标分页（高效）
SELECT p.*, u.display_name as owner_name
FROM projects p
LEFT JOIN users u ON p.owner_id = u.id
WHERE
  p.deleted_at IS NULL
  AND p.created_at < :cursor  -- 游标
  AND p.tenant_id = :tenantId
ORDER BY p.created_at DESC
LIMIT :pageSize;

-- 计数查询（带过滤）
SELECT COUNT(*)
FROM projects p
WHERE
  p.deleted_at IS NULL
  AND p.tenant_id = :tenantId
  AND p.status = :status;
`;

// 2. 热门项目查询
const POPULAR_PROJECTS_QUERY = `
SELECT
  p.*,
  u.display_name as owner_name,
  json_extract(p.stats, '$.downloadCount') as downloads,
  json_extract(p.stats, '$.viewCount') as views
FROM projects p
LEFT JOIN users u ON p.owner_id = u.id
WHERE
  p.deleted_at IS NULL
  AND p.visibility = 'public'
  AND p.status = 'completed'
ORDER BY
  json_extract(p.stats, '$.downloadCount') DESC,
  p.quality_score DESC
LIMIT :limit;
`;

// 3. 生成统计聚合查询
const GENERATION_STATS_QUERY = `
SELECT
  DATE(g.created_at) as date,
  COUNT(*) as total,
  SUM(CASE WHEN g.status = 'completed' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN g.status = 'failed' THEN 1 ELSE 0 END) as failed,
  AVG(g.result->>'$.duration') as avg_duration,
  AVG(g.usage->>'$.tokensUsed') as avg_tokens
FROM generations g
JOIN projects p ON g.project_id = p.id
WHERE
  g.created_at >= :startDate
  AND g.created_at < :endDate
  AND p.tenant_id = :tenantId
GROUP BY DATE(g.created_at)
ORDER BY date DESC;
`;

// 4. 用户活动查询
const USER_ACTIVITY_QUERY = `
SELECT
  u.id,
  u.display_name,
  u.email,
  COUNT(DISTINCT p.id) as project_count,
  COUNT(DISTINCT g.id) as generation_count,
  MAX(g.created_at) as last_activity
FROM users u
LEFT JOIN projects p ON u.id = p.owner_id AND p.deleted_at IS NULL
LEFT JOIN generations g ON p.id = g.project_id
WHERE u.tenant_id = :tenantId
GROUP BY u.id
ORDER BY last_activity DESC NULLS LAST;
`;
```

## 查询构建器

```typescript
// TypeScript查询构建器
import { eq, and, or, desc, asc, sql, like, inArray } from 'drizzle-orm';

// 项目查询服务
class ProjectQueryBuilder {
  constructor(private db: Database) {}

  // 构建复杂查询
  buildListQuery(filters: ProjectFilters): PreparedStatement {
    const conditions: SQL[] = [];

    // 基础过滤
    conditions.push(sql`deleted_at IS NULL`);

    if (filters.tenantId) {
      conditions.push(eq(projects.tenantId, filters.tenantId));
    }

    if (filters.ownerId) {
      conditions.push(eq(projects.ownerId, filters.ownerId));
    }

    if (filters.status) {
      conditions.push(eq(projects.status, filters.status));
    }

    if (filters.type) {
      conditions.push(eq(projects.type, filters.type));
    }

    if (filters.visibility) {
      conditions.push(eq(projects.visibility, filters.visibility));
    }

    // 搜索
    if (filters.search) {
      conditions.push(
        or(
          like(projects.name, `%${filters.search}%`),
          like(projects.description, `%${filters.search}%`)
        )
      );
    }

    // 质量分过滤
    if (filters.minQualityScore) {
      conditions.push(sql`quality_score >= ${filters.minQualityScore}`);
    }

    // 排序
    const orderBy = this.buildOrderBy(filters.sortBy, filters.sortOrder);

    // 执行查询
    return this.db
      .select({
        project: projects,
        owner: {
          id: users.id,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(projects)
      .leftJoin(users, eq(projects.ownerId, users.id))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(filters.limit || 20)
      .offset(filters.offset || 0);
  }

  // 构建排序
  private buildOrderBy(sortBy?: string, sortOrder?: 'asc' | 'desc'): SQL {
    const order = sortOrder === 'asc' ? asc : desc;

    switch (sortBy) {
      case 'name':
        return order(projects.name);
      case 'qualityScore':
        return order(projects.qualityScore);
      case 'createdAt':
      default:
        return order(projects.createdAt);
    }
  }

  // 聚合统计
  async getAggregations(filters: ProjectFilters): Promise<ProjectAggregations> {
    const conditions = this.buildConditions(filters);

    const result = await this.db
      .select({
        total: sql<number>`COUNT(*)`,
        byStatus: sql<Record<string, number>>`
          JSON_OBJECT(
            'draft', SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END),
            'in_progress', SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END),
            'completed', SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)
          )
        `,
        avgQuality: sql<number>`AVG(quality_score)`,
      })
      .from(projects)
      .where(and(...conditions));

    return result[0];
  }
}
```

## 事务管理

### 事务模式

```typescript
// 事务包装器
class TransactionManager {
  constructor(private db: Database) {}

  // 自动事务
  async withTransaction<T>(
    callback: (tx: Transaction) => Promise<T>
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      try {
        const result = await callback(tx);
        return result;
      } catch (error) {
        tx.rollback();
        throw error;
      }
    });
  }

  // 创建项目（事务示例）
  async createProject(
    data: CreateProjectInput,
    userId: string
  ): Promise<Project> {
    return this.withTransaction(async (tx) => {
      // 1. 创建项目
      const [project] = await tx
        .insert(projects)
        .values({
          id: generateId(),
          name: data.name,
          description: data.description,
          type: data.type,
          ownerId: userId,
          status: 'draft',
        })
        .returning();

      // 2. 创建初始版本记录
      await tx
        .insert(projectVersions)
        .values({
          id: generateId(),
          projectId: project.id,
          version: '0.0.1',
          changelog: 'Initial version',
        });

      // 3. 记录审计日志
      await tx
        .insert(auditLogs)
        .values({
          id: generateId(),
          entityType: 'project',
          entityId: project.id,
          action: 'created',
          userId,
          timestamp: new Date(),
        });

      return project;
    });
  }

  // 批量操作（事务示例）
  async batchUpdateStatus(
    projectIds: string[],
    status: ProjectStatus,
    userId: string
  ): Promise<number> {
    return this.withTransaction(async (tx) => {
      const result = await tx
        .update(projects)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(and(
          inArray(projects.id, projectIds),
          eq(projects.status, 'draft')  // 只更新草稿状态
        ));

      // 批量记录审计
      await tx
        .insert(auditLogs)
        .values(projectIds.map(id => ({
          id: generateId(),
          entityType: 'project',
          entityId: id,
          action: 'status_changed',
          userId,
          changes: JSON.stringify({ status }),
          timestamp: new Date(),
        })));

      return result.changes;
    });
  }
}
```

## 备份与恢复

### 备份策略

```typescript
// 备份配置
interface BackupConfig {
  // 备份类型
  type: 'full' | 'incremental' | 'wal';

  // 频率
  schedule: {
    full: string;                // cron: '0 2 * * *' (每天凌晨2点)
    incremental: string;         // cron: '0 */4 * * *' (每4小时)
  };

  // 保留策略
  retention: {
    daily: number;              // 保留天数
    weekly: number;             // 保留周数
    monthly: number;            // 保留月数
  };

  // 存储
  storage: {
    type: 'local' | 's3' | 'gcs';
    path: string;
    encryption: boolean;
  };

  // 压缩
  compression: {
    enabled: boolean;
    algorithm: 'zstd' | 'gzip';
  };
}

// 备份执行器
class BackupExecutor {
  async executeFullBackup(): Promise<BackupResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${this.config.storage.path}/full-${timestamp}.db`;

    // 1. 创建检查点
    await this.db.execute(sql`PRAGMA wal_checkpoint(TRUNCATE)`);

    // 2. 执行VACUUM
    await this.db.execute(sql`VACUUM`);

    // 3. 复制数据库文件
    await this.backupDatabase(backupPath);

    // 4. 计算校验和
    const checksum = await this.calculateChecksum(backupPath);

    // 5. 压缩（如配置）
    const compressedPath = await this.compress(backupPath);

    // 6. 上传到存储
    await this.uploadToStorage(compressedPath);

    // 7. 清理旧备份
    await this.cleanupOldBackups();

    return {
      id: generateId(),
      type: 'full',
      path: compressedPath || backupPath,
      checksum,
      size: await this.getFileSize(compressedPath || backupPath),
      timestamp: new Date(),
    };
  }

  // 增量备份（WAL）
  async executeIncrementalBackup(): Promise<BackupResult> {
    // SQLite WAL模式下的增量备份
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${this.config.storage.path}/wal-${timestamp}.wal`;

    // 复制WAL文件
    await this.backupWAL(backupPath);

    return {
      id: generateId(),
      type: 'incremental',
      path: backupPath,
      timestamp: new Date(),
    };
  }

  // 恢复数据库
  async restore(backupId: string): Promise<void> {
    const backup = await this.findBackup(backupId);

    // 1. 停止写入
    await this.db.execute(sql`PRAGMA blocking = true`);

    // 2. 关闭所有连接
    await this.closeAllConnections();

    // 3. 恢复文件
    await this.restoreDatabase(backup.path);

    // 4. 重启数据库
    await this.restartDatabase();
  }
}
```

## 性能监控

### 慢查询分析

```typescript
// 慢查询配置
const SLOW_QUERY_CONFIG = {
  threshold: 100,  // 100ms
  sampleRate: 1.0, // 100%采样
  logFile: 'logs/slow-queries.log',
};

// 查询性能分析器
class QueryProfiler {
  async analyzeQuery(sql: string, params?: any[]): Promise<QueryAnalysis> {
    const start = Date.now();

    // 执行EXPLAIN QUERY PLAN
    const explain = await this.db
      .execute(sql`EXPLAIN QUERY PLAN ${sql}`, params);

    const duration = Date.now() - start;

    // 获取查询计划
    const plan = this.parseExplainOutput(explain);

    // 检查索引使用
    const indexUsage = this.analyzeIndexUsage(plan);

    // 建议
    const suggestions = this.generateSuggestions(plan, indexUsage);

    return {
      sql: sql.toString(),
      duration,
      plan,
      indexUsage,
      suggestions,
      estimatedCost: plan.scan?.estimate || 'unknown',
    };
  }

  // 生成优化建议
  private generateSuggestions(
    plan: QueryPlan,
    indexUsage: IndexUsage
  ): string[] {
    const suggestions: string[] = [];

    // 全表扫描警告
    if (plan.scan === 'SCAN TABLE') {
      suggestions.push('Warning: Full table scan detected. Consider adding an index.');
    }

    // 缺失索引建议
    if (plan.usesIndex === false && plan.filter) {
      suggestions.push(`Consider adding an index on: ${plan.filter}`);
    }

    // 复合索引建议
    if (plan.type === 'SEARCH' && plan.multiColumn) {
      suggestions.push('Consider using a composite index for these columns.');
    }

    return suggestions;
  }
}
```

## 配置示例

```yaml
# 数据库配置
database:
  # SQLite配置
  sqlite:
    path: "data/project-factory.db"
    journal_mode: "WAL"
    synchronous: "NORMAL"
    cache_size: -64000  # 64MB
    page_size: 4096
    mmap_size: 268435456  # 256MB
    temp_store: "MEMORY"

  # 连接池
  connection_pool:
    max_connections: 10
    min_connections: 2
    acquire_timeout: 30s
    idle_timeout: 10m

  # 性能优化
  optimization:
    automatic_vacuum: "INCREMENTAL"
    optimize_on_startup: true
    cache_warming: true

  # 备份
  backup:
    enabled: true
    type: "full"  # full | incremental | wal
    schedule:
      full: "0 2 * * *"  # 每天凌晨2点
      incremental: "0 */4 * * *"  # 每4小时
    retention:
      daily: 7
      weekly: 4
      monthly: 12
    storage:
      type: "s3"
      bucket: "projectfactory-backups"
      path: "backups/"
      encryption: true

  # 慢查询监控
  monitoring:
    slow_query_threshold_ms: 100
    log_slow_queries: true
    explain_sampling_rate: 0.1

  # 索引
  indexes:
    auto_create: true
    auto_analyze: true
    analyze_threshold: 1000
```

---

**最后更新**: 2026-04-14
