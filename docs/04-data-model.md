# 数据模型设计

## 1. 数据库设计概览

### 1.1 存储分配

| 存储 | 用途 | 数据类型 |
|------|------|---------|
| SQLite | 项目元数据、状态、配置、知识库、用户数据 | 结构化关系数据 |
| 文件系统 | 生成的代码、文档、构建产物 | 文件 |
| Redis | 缓存、会话、队列 | 键值对 |

## 2. SQLite Schema

### 2.1 核心表结构

```sql
-- 项目表
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('crud', 'data-tool', 'script', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'stopped'
  )),
  current_phase TEXT,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  user_id TEXT,

  -- 需求阶段
  requirements_json TEXT, -- JSON

  -- 架构阶段
  architecture_json TEXT, -- JSON

  -- 开发阶段
  codebase_json TEXT, -- JSON

  -- 质量阶段
  quality_report_json TEXT, -- JSON

  -- 部署阶段
  deployment_json TEXT, -- JSON

  -- 时间戳
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,

  -- 路径
  code_path TEXT,
  deploy_url TEXT,

  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_type ON projects(type);
CREATE INDEX idx_projects_created_at ON projects(created_at);

-- 项目阶段表
CREATE TABLE project_phases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  phase_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TEXT,
  completed_at TEXT,
  duration_seconds INTEGER,
  result_json TEXT, -- JSON
  error_message TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_project_phases_project_id ON project_phases(project_id);

-- Agent日志表
CREATE TABLE agent_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  message TEXT NOT NULL,
  data_json TEXT, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_agent_logs_project_id ON agent_logs(project_id);
CREATE INDEX idx_agent_logs_created_at ON agent_logs(created_at);

-- 知识库表
CREATE TABLE knowledge_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN (
    'code-pattern', 'best-practice', 'failure-case', 'component'
  )),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  tags TEXT, -- JSON array
  language TEXT,
  framework TEXT,
  usage_count INTEGER DEFAULT 0,
  success_rate REAL DEFAULT 1.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_knowledge_items_type ON knowledge_items(type);
CREATE INDEX idx_knowledge_items_tags ON knowledge_items(tags);
CREATE INDEX idx_knowledge_items_language ON knowledge_items(language);

-- 模板表
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  config_json TEXT NOT NULL, -- JSON
  preview_image TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 用户表
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  settings_json TEXT, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 系统配置表
CREATE TABLE system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 监控指标表
CREATE TABLE metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  labels_json TEXT, -- JSON
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_metrics_name ON metrics(metric_name);
CREATE INDEX idx_metrics_recorded_at ON metrics(recorded_at);

-- 告警表
CREATE TABLE alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  title TEXT NOT NULL,
  message TEXT,
  data_json TEXT, -- JSON
  resolved BOOLEAN DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE INDEX idx_alerts_resolved ON alerts(resolved);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);
```

### 2.2 TypeScript类型定义

```typescript
// types/project.ts
export type ProjectType = 'crud' | 'data-tool' | 'script' | 'other';
export type ProjectStatus = 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
export type PhaseName = 'requirement' | 'architecture' | 'development' | 'quality' | 'deployment' | 'evolution';

export interface Project {
  id: string;
  name: string;
  description?: string;
  type: ProjectType;
  status: ProjectStatus;
  currentPhase?: PhaseName;
  progress: number;
  userId?: string;

  // 阶段数据
  requirements?: Requirement;
  architecture?: Architecture;
  codebase?: Codebase;
  qualityReport?: QualityReport;
  deployment?: Deployment;

  // 时间戳
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;

  // 路径
  codePath?: string;
  deployUrl?: string;
}

export interface Requirement {
  title: string;
  description: string;
  features: Feature[];
  techRequirements: TechRequirements;
  risks: string[];
  assumptions: string[];
}

export interface Feature {
  name: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  acceptanceCriteria: string[];
}

export interface TechRequirements {
  frontend: string[];
  backend: string[];
  database: string[];
}

export interface Architecture {
  overview: string;
  techStack: TechStack;
  apis: API[];
  databaseSchema: DatabaseSchema;
  directoryStructure: DirectoryNode;
}

export interface TechStack {
  frontend: string[];
  backend: string[];
  database: string;
  infra: string[];
}

export interface API {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  description: string;
  requestSchema?: any;
  responseSchema?: any;
}

export interface DatabaseSchema {
  tables: TableSchema[];
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey?: boolean;
}

export interface DirectoryNode {
  name: string;
  type: 'file' | 'directory';
  children?: DirectoryNode[];
}

export interface Codebase {
  frontend: {
    files: CodeFile[];
    config: Record<string, unknown>;
  };
  backend: {
    files: CodeFile[];
    config: Record<string, unknown>;
  };
  configs: ConfigFile[];
}

export interface CodeFile {
  path: string;
  content: string;
  language: string;
}

export interface ConfigFile {
  name: string;
  path: string;
  content: string;
}

export interface QualityReport {
  staticAnalysis: StaticAnalysisResult;
  securityScan: SecurityScanResult;
  tests: TestResult;
  overallScore: number;
}

export interface StaticAnalysisResult {
  score: number;
  issues: AnalysisIssue[];
  fileCount: number;
  lineCount: number;
}

export interface AnalysisIssue {
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  rule: string;
}

export interface SecurityScanResult {
  passed: boolean;
  vulnerabilities: Vulnerability[];
}

export interface Vulnerability {
  severity: 'critical' | 'high' | 'medium' | 'low';
  package: string;
  version: string;
  cve?: string;
  description: string;
}

export interface TestResult {
  generated: TestFile[];
  passed: number;
  failed: number;
  coverage: number;
}

export interface TestFile {
  path: string;
  name: string;
  assertions: number;
}

export interface Deployment {
  buildResult: BuildResult;
  deployResult: DeployResult;
  healthCheck: HealthCheck;
  url: string;
}

export interface BuildResult {
  success: boolean;
  duration: number;
  artifacts: string[];
}

export interface DeployResult {
  success: boolean;
  duration: number;
  environment: string;
  url: string;
}

export interface HealthCheck {
  healthy: boolean;
  checks: HealthCheckItem[];
}

export interface HealthCheckItem {
  name: string;
  status: 'pass' | 'fail';
  responseTime: number;
}

export interface ProjectPhase {
  id: number;
  projectId: string;
  phaseName: PhaseName;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  durationSeconds?: number;
  result?: Record<string, unknown>;
  errorMessage?: string;
}

export interface AgentLog {
  id: number;
  projectId: string;
  phase: PhaseName;
  agentName: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
  createdAt: Date;
}

// types/knowledge.ts
export type KnowledgeItemType = 'code-pattern' | 'best-practice' | 'failure-case' | 'component';

export interface KnowledgeItem {
  id: string;
  type: KnowledgeItemType;
  title: string;
  description?: string;
  content: string;
  tags: string[];
  language?: string;
  framework?: string;
  usageCount: number;
  successRate: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeSearchResult {
  id: string;
  type: KnowledgeItemType;
  title: string;
  description?: string;
  similarity: number;
}

// types/template.ts
export interface Template {
  id: string;
  name: string;
  type: ProjectType;
  description?: string;
  config: TemplateConfig;
  previewImage?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateConfig {
  techStack: TechStack;
  structure: DirectoryNode;
  files: TemplateFile[];
  requirements?: string[];
}

export interface TemplateFile {
  path: string;
  template: string; // 模板内容，包含占位符
  type: string;
}

// types/monitoring.ts
export interface SystemMetrics {
  cpu: MetricSnapshot;
  memory: MetricSnapshot;
  disk: MetricSnapshot;
  network: NetworkMetrics;
  agents: AgentMetrics;
  queue: QueueMetrics;
}

export interface MetricSnapshot {
  current: number;
  average5m: number;
  average15m: number;
  peak: number;
}

export interface NetworkMetrics {
  inbound: number; // bytes/sec
  outbound: number; // bytes/sec
}

export interface AgentMetrics {
  total: number;
  active: number;
  idle: number;
  error: number;
  byType: Record<string, {
    total: number;
    active: number;
    avgDuration: number;
  }>;
}

export interface QueueMetrics {
  pending: number;
  active: number;
  completed: number;
  failed: number;
  avgWaitTime: number;
}

// types/alert.ts
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface Alert {
  id: number;
  alertType: string;
  severity: AlertSeverity;
  title: string;
  message?: string;
  data?: Record<string, unknown>;
  resolved: boolean;
  createdAt: Date;
  resolvedAt?: Date;
}
```

## 3. Redis数据结构

### 3.1 缓存键命名规范

```
pf:cache:{type}:{id}           # 通用缓存
pf:session:{userId}           # 用户会话
pf:llm:{hash}                 # LLM响应缓存
pf:queue:{jobId}              # 队列任务状态
pf:locks:{resource}           # 分布式锁
pf:rate:{ip}:{endpoint}       # 限流计数器
```

### 4.2 缓存数据结构

```typescript
// 缓存类型
export interface CacheTypes {
  // 项目缓存
  'project': Project;

  // 用户缓存
  'user': User;

  // 知识库缓存
  'knowledge': KnowledgeItem;

  // 模板缓存
  'template': Template;

  // LLM响应缓存
  'llm': {
    response: string;
    model: string;
    promptHash: string;
    tokens: number;
  };

  // 搜索结果缓存
  'search': KnowledgeSearchResult[];
}

// Session数据
export interface SessionData {
  userId: string;
  createdAt: Date;
  lastAccessed: Date;
  preferences: {
    theme: 'light' | 'dark';
    language: string;
  };
}

// 队列任务状态
export interface QueueJobState {
  id: string;
  type: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.3 TTL配置

| 键模式 | TTL | 说明 |
|--------|-----|------|
| pf:llm:* | 24h | LLM响应缓存 |
| pf:search:* | 1h | 搜索结果 |
| pf:project:* | 1h | 项目详情 |
| pf:template:* | 会话期 | 模板 |
| pf:session:* | 7d | 用户会话 |
| pf:rate:* | 1m | 限流计数器 |

## 4. 文件系统结构

### 5.1 生成的项目存储

```
storage/
├── projects/
│   ├── {projectId}/
│   │   ├── frontend/
│   │   │   ├── src/
│   │   │   ├── package.json
│   │   │   ├── tsconfig.json
│   │   │   └── vite.config.ts
│   │   ├── backend/
│   │   │   ├── src/
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   ├── docs/
│   │   │   ├── README.md
│   │   │   ├── API.md
│   │   │   └── DEPLOYMENT.md
│   │   ├── .dockerignore
│   │   └── docker-compose.yml
│   └── build/
│       └── {projectId}/
│           └── docker-image.tar
├── logs/
│   ├── projects/
│   │   └── {projectId}.log
│   ├── agents/
│   │   ├── requirement.log
│   │   ├── architecture.log
│   │   └── ...
│   └── system.log
├── backups/
│   └── data.db.{timestamp}
└── templates/
    └── {templateId}/
        ├── schema.yaml
        └── files/
```

### 5.2 项目元数据文件

```yaml
# storage/projects/{projectId}/.metadata.yaml
id: string
name: string
description: string
type: string
status: string
createdAt: string
completedAt?: string
deployUrl?: string
qualityScore: number
```

## 5. 数据关系图

```
┌─────────────┐         ┌─────────────────┐         ┌─────────────┐
│   Users     │ 1    *  │   Projects      │ 1    *  │ ProjectPhases│
└─────────────┘         └─────────────────┘         └─────────────┘
                               │ 1
                               │ *
                               │
                        ┌─────────────┐
                        │  AgentLogs  │
                        └─────────────┘

┌─────────────┐         ┌─────────────────┐
│ Knowledge   │ *    *  │   Templates     │
│   Items     │         └─────────────────┘
└─────────────┘
         │
         │ (全文检索索引)
         ↓
    ┌─────────┐
    │ SQLite  │
    └─────────┘
```

## 6. 数据迁移

### 7.1 迁移脚本

```typescript
// db/migrations/001_initial.ts
export const migration001 = {
  version: '001',
  name: 'initial_schema',
  up: (db: Database.Database) => {
    db.exec(`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  },
  down: (db: Database.Database) => {
    db.exec('DROP TABLE IF EXISTS projects;');
  },
};
```

### 7.2 数据种子

```typescript
// db/seeds/001_templates.ts
export const seedTemplates = async (db: Database.Database) => {
  const templates = [
    {
      id: 'crud-basic',
      name: 'Basic CRUD App',
      type: 'crud',
      description: 'A simple CRUD application with React frontend and Node backend',
      config: { /* config */ },
    },
    // 更多模板...
  ];

  for (const template of templates) {
    await db.prepare(
      'INSERT INTO templates (id, name, type, description, config_json) VALUES (?, ?, ?, ?, ?)'
    ).run(
      template.id,
      template.name,
      template.type,
      template.description,
      JSON.stringify(template.config)
    );
  }
};
```

---

**版本**: 0.1.0
**更新日期**: 2026-04-14
**状态**: 设计阶段
