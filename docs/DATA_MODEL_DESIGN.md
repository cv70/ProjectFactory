# 数据模型设计

## 1. 数据模型总览

### 1.1 实体关系图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              数据模型 ER 图                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐         ┌─────────────────┐                            │
│  │     ideas       │         │    projects     │                            │
│  ├─────────────────┤         ├─────────────────┤                            │
│  │ id (PK)         │────┐    │ id (PK)         │                            │
│  │ title           │    │    │ idea_id (FK)    │◄────┐                      │
│  │ description     │    └───►│ name            │     │                     │
│  │ project_type    │         │ description     │     │                     │
│  │ features        │         │ type            │     │                     │
│  │ tech_stack      │         │ status          │     │                     │
│  │ status          │         │ path            │     │                     │
│  │ ...             │         │ quality_score   │     │                     │
│  └─────────────────┘         │ ...            │     │                     │
│                              └─────────────────┘     │                     │
│                                    │                 │                     │
│                                    │ 1:N             │                     │
│                                    ▼                 │                     │
│  ┌─────────────────┐         ┌─────────────────┐    │                     │
│  │   iterations    │         │ quality_metrics │    │                     │
│  ├─────────────────┤         ├─────────────────┤    │                     │
│  │ id (PK)         │         │ id (PK)         │    │                     │
│  │ project_id (FK) │◄────────│ project_id (FK) │◄───┘                     │
│  │ stage           │         │ timestamp       │                          │
│  │ iteration_num   │         │ coverage         │                          │
│  │ trigger         │         │ quality_score   │                          │
│  │ changes         │         │ lint_errors     │                          │
│  │ quality_before  │         │ build_success   │                          │
│  │ quality_after   │         └─────────────────┘                          │
│  └─────────────────┘                                                      │
│                                                                            │
│  ┌─────────────────┐         ┌─────────────────┐                          │
│  │knowledge_entries│         │  agent_executions│                          │
│  ├─────────────────┤         ├─────────────────┤                          │
│  │ id (PK)         │         │ id (PK)          │                          │
│  │ type            │         │ agent_name       │                          │
│  │ title           │         │ project_id (FK)  │◄────┐                   │
│  │ content         │         │ stage           │     │                   │
│  │ keywords        │         │ success         │     │                   │
│  │ tags            │         │ duration_ms     │     │                   │
│  │ embedding       │         │ tokens_used     │     │                   │
│  │ source_project  │◄───────┤ errors          │     │                   │
│  │ quality_score   │         │ timestamp       │     │                   │
│  │ usage_count     │         └─────────────────┘     │                   │
│  │ is_active       │                               │                   │
│  └─────────────────┘                               │                   │
│                                                     │                   │
│  ┌─────────────────┐         ┌─────────────────┐   │                   │
│  │  runtime_state  │         │   events        │   │                   │
│  ├─────────────────┤         ├─────────────────┤   │                   │
│  │ id (PK)         │         │ id (PK)         │   │                   │
│  │ state_type      │         │ project_id (FK) │◄──┘                   │
│  │ state_data      │         │ event_type      │                          │
│  │ updated_at      │         │ payload         │                          │
│  └─────────────────┘         │ timestamp       │                          │
│                              └─────────────────┘                          │
│                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. 核心实体

### 2.1 Idea（创意）

```typescript
// 创意实体
interface Idea {
  // 基础信息
  id: string;
  title: string;
  description: string;

  // 类型信息
  projectType: 'web-app' | 'cli-tool' | 'library' | 'api-service';
  features: string[];
  techStack: string[];
  targetAudience: string;

  // 评估信息
  complexity: 'low' | 'medium' | 'high';
  valueScore?: number;        // 0-1，价值评分
  noveltyScore?: number;      // 0-1，新颖性评分
  feasibilityScore?: number;  // 0-1，可行性评分

  // 状态
  status: 'pending' | 'queued' | 'in_progress' | 'completed' | 'failed';
  error?: string;

  // 队列信息
  queuePosition?: number;
  queuedAt?: Date;

  // 时间戳
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// Idea 创建输入
interface CreateIdeaInput {
  title?: string;             // 可选，指定创意标题
  description?: string;       // 可选，指定描述
  projectType?: ProjectType;
  constraints?: string[];     // 约束条件
  count?: number;             // 生成数量，默认 1
}
```

**状态机**：

```
┌─────────┐    queue     ┌────────┐    start     ┌────────────┐
│ pending │ ──────────► │ queued │ ───────────► │ in_progress │
└─────────┘              └────────┘              └────────────┘
     ▲                         │                        │
     │                         │ cancel                 │ complete
     │                         ▼                        ▼
     │                    ┌─────────┐            ┌───────────┐
     └────────────────────│ failed  │◄─────────── │ completed │
                          └─────────┘   fail     └───────────┘
```

### 2.2 Project（项目）

```typescript
// 项目实体
interface Project {
  // 标识
  id: string;
  ideaId?: string;            // 关联的创意 ID

  // 基础信息
  name: string;
  description: string;
  type: 'web-app' | 'cli-tool' | 'library' | 'api-service';

  // 状态
  status: ProjectStatus;
  stage?: ProjectStage;      // 当前阶段

  // 路径信息
  path: string;              // 项目路径
  gitRepo?: string;          // Git 仓库 URL

  // 版本
  version: string;           // 语义版本，如 "0.1.0"

  // 质量指标
  qualityScore: number;       // 0-100
  testCoverage: number;       // 百分比 0-100
  lintErrors: number;
  buildSuccess: boolean;

  // 错误信息
  error?: string;

  // 时间戳
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// 项目状态
type ProjectStatus =
  | 'initializing'    // 初始化
  | 'queued'          // 排队中
  | 'generating'      // 生成中
  | 'paused'          // 暂停
  | 'completed'       // 完成
  | 'failed'          // 失败
  | 'cancelled';      // 取消

// 项目阶段
type ProjectStage =
  | 'pending'
  | 'ideation'
  | 'architecture'
  | 'coding'
  | 'testing'
  | 'reviewing'
  | 'deploying'
  | 'completed';
```

### 2.3 Iteration（迭代）

```typescript
// 迭代实体
interface Iteration {
  id: string;
  projectId: string;

  // 迭代信息
  iterationNumber: number;     // 迭代编号
  stage: ProjectStage;        // 发生迭代的阶段

  // 触发原因
  trigger: IterationTrigger;
  triggerReason?: string;

  // 变更内容
  changes: {
    filesAdded?: string[];
    filesModified?: string[];
    filesDeleted?: string[];
    codeBefore?: string;
    codeAfter?: string;
  };

  // 质量对比
  qualityBefore?: number;
  qualityAfter?: number;

  // 元数据
  createdAt: Date;
}

// 迭代触发类型
type IterationTrigger =
  | 'test_failure'      // 测试失败
  | 'lint_error'        // Lint 错误
  | 'quality_gate'      // 质量门禁
  | 'review_feedback'    // 审查反馈
  | 'user_request'       // 用户请求
  | 'auto_optimize';     // 自动优化
```

### 2.4 QualityMetric（质量指标）

```typescript
// 质量指标
interface QualityMetric {
  id: string;
  projectId: string;

  // 时间戳
  timestamp: Date;

  // 覆盖率
  coverage: number;           // 测试覆盖率 0-100

  // 质量评分
  qualityScore: number;       // 综合质量评分 0-100

  // 静态分析
  lintErrors: number;
  typeErrors: number;

  // 构建
  buildSuccess: boolean;
  buildDuration?: number;     // 构建耗时 ms

  // 复杂度指标
  cyclomaticComplexity?: number;  // 圈复杂度
  maintainabilityIndex?: number;  // 可维护性指数

  // 安全性
  securityIssues?: number;
}
```

### 2.5 KnowledgeEntry（知识条目）

```typescript
// 知识条目
interface KnowledgeEntry {
  id: string;

  // 类型
  type: KnowledgeType;

  // 内容
  title: string;
  content: string;
  code?: string;              // 代码示例

  // 分类
  keywords: string[];
  tags: string[];

  // 向量表示
  embedding?: number[];       // 用于语义搜索

  // 来源
  source: {
    type: 'project' | 'user' | 'system' | 'learning';
    projectId?: string;
    author: string;
    createdAt: Date;
  };

  // 质量
  quality: {
    score: number;            // 质量评分
    usageCount: number;       // 使用次数
    successRate: number;      // 应用成功率
    lastUsed?: Date;
  };

  // 关联
  related: {
    projectIds: string[];
    knowledgeIds: string[];
  };

  // 有效性
  validity: {
    isActive: boolean;
    expiresAt?: Date;
    deprecatedBy?: string;
  };

  // 时间戳
  createdAt: Date;
  updatedAt: Date;
}

// 知识类型
type KnowledgeType =
  | 'code_pattern'           // 代码模式
  | 'architecture_pattern'   // 架构模式
  | 'design_pattern'         // 设计模式
  | 'best_practice'          // 最佳实践
  | 'coding_standard'        // 编码规范
  | 'security_practice'      // 安全实践
  | 'failure_case'           // 失败案例
  | 'pitfall'                // 陷阱
  | 'lesson_learned'         // 经验教训
  | 'domain_knowledge'       // 领域知识
  | 'tech_stack'             // 技术栈知识
  | 'api_design';            // API 设计
```

### 2.6 AgentExecution（Agent 执行记录）

```typescript
// Agent 执行记录
interface AgentExecution {
  id: string;

  // Agent 信息
  agentName: string;
  agentVersion?: string;

  // 关联项目
  projectId?: string;
  stage?: ProjectStage;

  // 输入输出
  input: Record<string, any>;    // JSON
  output?: Record<string, any>;  // JSON

  // 结果
  success: boolean;
  durationMs: number;
  tokensUsed?: number;
  cost?: number;                 // 成本

  // 错误
  errors?: AgentError[];

  // 建议
  suggestions?: string[];

  // 时间戳
  timestamp: Date;
}

// Agent 错误
interface AgentError {
  type: string;
  message: string;
  stack?: string;
  recoverable: boolean;
}
```

## 3. SQLite 表定义

### 3.1 创建表 SQL

```sql
-- 创意表
CREATE TABLE ideas (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  project_type TEXT NOT NULL CHECK(project_type IN ('web-app', 'cli-tool', 'library', 'api-service')),
  features TEXT NOT NULL,  -- JSON array
  tech_stack TEXT NOT NULL,  -- JSON array
  target_audience TEXT NOT NULL DEFAULT '',
  complexity TEXT NOT NULL CHECK(complexity IN ('low', 'medium', 'high')) DEFAULT 'medium',
  value_score REAL,
  novelty_score REAL,
  feasibility_score REAL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'queued', 'in_progress', 'completed', 'failed')),
  error TEXT,
  queue_position INTEGER,
  queued_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX idx_ideas_status ON ideas(status);
CREATE INDEX idx_ideas_created_at ON ideas(created_at);

-- 项目表
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  idea_id TEXT REFERENCES ideas(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('web-app', 'cli-tool', 'library', 'api-service')),
  status TEXT NOT NULL DEFAULT 'initializing' CHECK(status IN ('initializing', 'queued', 'generating', 'paused', 'completed', 'failed', 'cancelled')),
  stage TEXT,
  path TEXT NOT NULL,
  git_repo TEXT,
  version TEXT NOT NULL DEFAULT '0.1.0',
  quality_score INTEGER DEFAULT 0,
  test_coverage REAL DEFAULT 0,
  lint_errors INTEGER DEFAULT 0,
  type_errors INTEGER DEFAULT 0,
  build_success INTEGER DEFAULT 0,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_idea_id ON projects(idea_id);
CREATE INDEX idx_projects_created_at ON projects(created_at);

-- 迭代表
CREATE TABLE iterations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  iteration_number INTEGER NOT NULL,
  stage TEXT NOT NULL,
  trigger TEXT NOT NULL,
  trigger_reason TEXT,
  changes TEXT,  -- JSON
  quality_before INTEGER,
  quality_after INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_iterations_project_id ON iterations(project_id);

-- 质量指标表
CREATE TABLE quality_metrics (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  timestamp INTEGER NOT NULL,
  coverage REAL NOT NULL,
  quality_score INTEGER NOT NULL,
  lint_errors INTEGER NOT NULL DEFAULT 0,
  type_errors INTEGER NOT NULL DEFAULT 0,
  build_success INTEGER NOT NULL DEFAULT 0,
  build_duration INTEGER,
  cyclomatic_complexity REAL,
  maintainability_index REAL,
  security_issues INTEGER DEFAULT 0
);

CREATE INDEX idx_quality_metrics_project_id ON quality_metrics(project_id);
CREATE INDEX idx_quality_metrics_timestamp ON quality_metrics(timestamp);

-- 知识库表
CREATE TABLE knowledge_entries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('code_pattern', 'architecture_pattern', 'design_pattern', 'best_practice', 'coding_standard', 'security_practice', 'failure_case', 'pitfall', 'lesson_learned', 'domain_knowledge', 'tech_stack', 'api_design')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  code TEXT,
  keywords TEXT,  -- JSON array
  tags TEXT,  -- JSON array
  embedding TEXT,  -- JSON array for vector
  source_type TEXT NOT NULL,
  source_project_id TEXT REFERENCES projects(id),
  source_author TEXT NOT NULL,
  quality_score REAL,
  usage_count INTEGER DEFAULT 0,
  success_rate REAL,
  last_used INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER,
  deprecated_by TEXT
);

CREATE INDEX idx_knowledge_type ON knowledge_entries(type);
CREATE INDEX idx_knowledge_tags ON knowledge_entries(tags);
CREATE INDEX idx_knowledge_source_project ON knowledge_entries(source_project_id);

-- Agent 执行记录表
CREATE TABLE agent_executions (
  id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  agent_version TEXT,
  project_id TEXT REFERENCES projects(id),
  stage TEXT,
  input TEXT NOT NULL,  -- JSON
  output TEXT,
  success INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  tokens_used INTEGER,
  cost REAL,
  errors TEXT,  -- JSON array
  suggestions TEXT,  -- JSON array
  timestamp INTEGER NOT NULL
);

CREATE INDEX idx_agent_executions_agent_name ON agent_executions(agent_name);
CREATE INDEX idx_agent_executions_project_id ON agent_executions(project_id);
CREATE INDEX idx_agent_executions_timestamp ON agent_executions(timestamp);

-- 事件表
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,  -- JSON
  correlation_id TEXT,
  timestamp INTEGER NOT NULL
);

CREATE INDEX idx_events_project_id ON events(project_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_timestamp ON events(timestamp);

-- 运行时状态表
CREATE TABLE runtime_state (
  id TEXT PRIMARY KEY,
  state_type TEXT NOT NULL,
  state_data TEXT NOT NULL,  -- JSON
  updated_at INTEGER NOT NULL
);
```

## 4. 索引策略

### 4.1 索引设计

| 表名 | 索引名 | 字段 | 类型 | 用途 |
|------|--------|------|------|------|
| ideas | idx_ideas_status | status | B-Tree | 按状态查询 |
| ideas | idx_ideas_created_at | created_at | B-Tree | 按时间排序 |
| projects | idx_projects_status | status | B-Tree | 按状态查询 |
| projects | idx_projects_idea_id | idea_id | B-Tree | 关联查询 |
| projects | idx_projects_created_at | created_at | B-Tree | 按时间排序 |
| iterations | idx_iterations_project_id | project_id | B-Tree | 关联查询 |
| quality_metrics | idx_quality_metrics_project_id | project_id | B-Tree | 关联查询 |
| quality_metrics | idx_quality_metrics_timestamp | timestamp | B-Tree | 时序查询 |
| knowledge_entries | idx_knowledge_type | type | B-Tree | 分类查询 |
| knowledge_entries | idx_knowledge_tags | tags | GIN | 标签搜索 |
| agent_executions | idx_agent_executions_agent_name | agent_name | B-Tree | Agent 查询 |
| agent_executions | idx_agent_executions_project_id | project_id | B-Tree | 关联查询 |
| events | idx_events_project_id | project_id | B-Tree | 关联查询 |
| events | idx_events_type | event_type | B-Tree | 类型查询 |

### 4.2 查询优化

```sql
-- 常用查询优化

-- 1. 获取活跃项目（带分页）
CREATE INDEX idx_projects_status_created ON projects(status, created_at DESC);

-- 2. 获取项目的最新质量指标
CREATE INDEX idx_quality_metrics_project_timestamp ON quality_metrics(project_id, timestamp DESC);

-- 3. 获取项目的执行历史
CREATE INDEX idx_agent_executions_project_timestamp ON agent_executions(project_id, timestamp DESC);

-- 4. 知识库语义搜索（使用 embedding）
-- SQLite 本身不支持向量索引，可以使用外部向量数据库
```

## 5. 数据迁移

### 5.1 迁移文件命名

```
drizzle/
├── config.ts
└── migrations/
    ├── 0000_initial_schema.ts
    ├── 0001_add_quality_metrics.ts
    ├── 0002_add_knowledge_base.ts
    └── 0003_add_agent_executions.ts
```

### 5.2 迁移示例

```typescript
// drizzle/migrations/0001_add_quality_metrics.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const qualityMetrics = sqliteTable('quality_metrics', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id).notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  coverage: real('coverage').notNull(),
  qualityScore: integer('quality_score').notNull(),
  lintErrors: integer('lint_errors').notNull().default(0),
  buildSuccess: integer('build_success', { mode: 'boolean' }).notNull().default(false)
});

export async function up(db: Database) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS quality_metrics (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      timestamp INTEGER NOT NULL,
      coverage REAL NOT NULL,
      quality_score INTEGER NOT NULL,
      lint_errors INTEGER NOT NULL DEFAULT 0,
      type_errors INTEGER NOT NULL DEFAULT 0,
      build_success INTEGER NOT NULL DEFAULT 0,
      build_duration INTEGER,
      cyclomatic_complexity REAL,
      maintainability_index REAL,
      security_issues INTEGER DEFAULT 0
    )
  `);

  await db.execute(sql`
    CREATE INDEX idx_quality_metrics_project_id ON quality_metrics(project_id)
  `);
}

export async function down(db: Database) {
  await db.execute(sql`DROP TABLE IF EXISTS quality_metrics`);
}
```

---

**版本**: 1.0.0
**创建日期**: 2026-04-14
**状态**: 数据模型设计完成
