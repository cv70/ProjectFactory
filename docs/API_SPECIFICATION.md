# API 规格说明文档

## 1. API 设计原则

### 1.1 RESTful 设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RESTful API 设计原则                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  资源导向                    统一接口                  状态码                 │
│  ─────────                   ───────                  ─────                  │
│                                                                              │
│  GET    /projects            获取资源列表              200 OK                │
│  GET    /projects/:id       获取单个资源              201 Created           │
│  POST   /projects           创建资源                  204 No Content         │
│  PUT    /projects/:id       更新资源                  400 Bad Request        │
│  DELETE /projects/:id       删除资源                  401 Unauthorized       │
│                                 404 Not Found         │
│                                 500 Internal Error    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 API 版本控制

```
/api/v1/projects     # v1 版本
/api/v2/projects     # v2 版本（如果有 Breaking Changes）
```

## 2. 项目 API

### 2.1 项目资源

```typescript
// 项目数据模型
interface Project {
  id: string;
  name: string;
  description: string;
  type: 'web-app' | 'cli-tool' | 'library' | 'api-service';
  status: ProjectStatus;
  stage?: ProjectStage;

  // 质量指标
  qualityScore: number;
  testCoverage: number;
  lintErrors: number;
  buildSuccess: boolean;

  // 路径
  path?: string;
  gitRepo?: string;

  // 版本
  version: string;

  // 错误
  error?: string;

  // 时间戳
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// 项目状态
type ProjectStatus =
  | 'initializing'
  | 'queued'
  | 'generating'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

// 项目阶段
type ProjectStage =
  | 'pending'
  | 'ideation'
  | 'architecture'
  | 'coding'
  | 'testing'
  | 'reviewing'
  | 'deploying';
```

### 2.2 项目接口

```typescript
// 获取项目列表
// GET /api/v1/projects

// Query Parameters
interface ListProjectsQuery {
  status?: ProjectStatus;      // 状态过滤
  stage?: ProjectStage;         // 阶段过滤
  type?: Project['type'];       // 类型过滤
  limit?: number;              // 限制数量，默认 20
  offset?: number;              // 偏移量，默认 0
  sortBy?: 'createdAt' | 'updatedAt' | 'qualityScore';
  order?: 'asc' | 'desc';
}

// Response
interface ListProjectsResponse {
  data: Project[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// 示例
// GET /api/v1/projects?status=generating&limit=10&sortBy=createdAt&order=desc

// 响应
// 200 OK
{
  "data": [
    {
      "id": "proj_abc123",
      "name": "Data Converter",
      "description": "A CLI tool for data conversion",
      "type": "cli-tool",
      "status": "generating",
      "stage": "coding",
      "qualityScore": 75,
      "testCoverage": 65,
      "lintErrors": 0,
      "buildSuccess": false,
      "version": "0.1.0",
      "createdAt": "2026-04-14T10:00:00Z",
      "updatedAt": "2026-04-14T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

```typescript
// 创建项目
// POST /api/v1/projects

// Request Body
interface CreateProjectRequest {
  name: string;                          // 必填，项目名称
  type: Project['type'];                 // 必填，项目类型
  description?: string;                  // 可选，描述
  idea?: {
    id?: string;                         // 使用已有创意
    title?: string;                      // 或创建新创意
    description?: string;
    features?: string[];
  };
  settings?: {
    autoStart?: boolean;                // 自动开始，默认 true
    maxIterations?: number;              // 最大迭代次数，默认 3
    qualityThreshold?: number;          // 质量阈值，默认 70
  };
}

// Response
// 201 Created
{
  "data": {
    "id": "proj_xyz789",
    "name": "New Project",
    "type": "web-app",
    "status": "initializing",
    "stage": "pending",
    "qualityScore": 0,
    "testCoverage": 0,
    "lintErrors": 0,
    "buildSuccess": false,
    "version": "0.1.0",
    "createdAt": "2026-04-14T11:00:00Z",
    "updatedAt": "2026-04-14T11:00:00Z"
  }
}

// 错误响应
// 400 Bad Request
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "name",
        "message": "Name is required"
      },
      {
        "field": "type",
        "message": "Invalid project type"
      }
    ]
  }
}
```

```typescript
// 获取单个项目
// GET /api/v1/projects/:id

// Response
// 200 OK
{
  "data": {
    "id": "proj_abc123",
    "name": "Data Converter",
    "description": "A CLI tool for data conversion",
    "type": "cli-tool",
    "status": "completed",
    "stage": "completed",
    "qualityScore": 85,
    "testCoverage": 82,
    "lintErrors": 0,
    "buildSuccess": true,
    "path": "/projects/completed/data-converter",
    "gitRepo": "https://github.com/example/data-converter",
    "version": "0.1.0",
    "createdAt": "2026-04-14T10:00:00Z",
    "updatedAt": "2026-04-14T12:00:00Z",
    "completedAt": "2026-04-14T12:00:00Z"
  }
}

// 错误响应
// 404 Not Found
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Project not found"
  }
}
```

```typescript
// 更新项目
// PATCH /api/v1/projects/:id

// Request Body
interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: 'paused' | 'cancelled';
}

// Response
// 200 OK
{
  "data": {
    "id": "proj_abc123",
    "status": "paused",
    "updatedAt": "2026-04-14T11:30:00Z"
  }
}
```

```typescript
// 删除项目
// DELETE /api/v1/projects/:id

// Response
// 204 No Content

// 错误响应
// 404 Not Found
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Project not found"
  }
}
```

```typescript
// 获取项目文件列表
// GET /api/v1/projects/:id/files

// Query Parameters
interface ListProjectFilesQuery {
  path?: string;            // 目录路径
  type?: 'source' | 'test' | 'config' | 'doc';
  extension?: string;       // 文件扩展名
}

// Response
// 200 OK
{
  "data": [
    {
      "path": "src/index.ts",
      "name": "index.ts",
      "type": "source",
      "language": "typescript",
      "size": 1024,
      "lines": 45,
      "lastModified": "2026-04-14T11:00:00Z"
    },
    {
      "path": "src/utils/helper.ts",
      "name": "helper.ts",
      "type": "source",
      "language": "typescript",
      "size": 2048,
      "lines": 87
    }
  ],
  "directories": [
    "src/utils",
    "src/types",
    "tests"
  ]
}
```

```typescript
// 获取项目文件内容
// GET /api/v1/projects/:id/files/*

// Response
// 200 OK
{
  "data": {
    "path": "src/index.ts",
    "content": "export function main() {\n  console.log('Hello');\n}",
    "language": "typescript",
    "size": 1024,
    "lines": 45,
    "lastModified": "2026-04-14T11:00:00Z"
  }
}
```

```typescript
// 获取项目日志
// GET /api/v1/projects/:id/logs

// Query Parameters
interface ListProjectLogsQuery {
  stage?: ProjectStage;           // 过滤阶段
  level?: 'debug' | 'info' | 'warn' | 'error';
  limit?: number;                // 默认 100
  offset?: number;
  startTime?: string;           // ISO 格式
  endTime?: string;
}

// Response
// 200 OK
{
  "data": [
    {
      "id": "log_001",
      "timestamp": "2026-04-14T10:30:00Z",
      "level": "info",
      "stage": "coding",
      "agent": "CoderAgent",
      "message": "Generated file: src/index.ts",
      "metadata": {
        "file": "src/index.ts",
        "lines": 45
      }
    },
    {
      "id": "log_002",
      "timestamp": "2026-04-14T10:30:05Z",
      "level": "error",
      "stage": "coding",
      "agent": "CoderAgent",
      "message": "Syntax error in generated code",
      "metadata": {
        "file": "src/utils/helper.ts",
        "error": "Unexpected token"
      }
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 100,
    "offset": 0,
    "hasMore": true
  }
}
```

```typescript
// 获取项目质量报告
// GET /api/v1/projects/:id/quality

// Response
// 200 OK
{
  "data": {
    "summary": {
      "qualityScore": 85,
      "grade": "B",
      "passed": true
    },
    "coverage": {
      "overall": 82,
      "byFile": [
        { "file": "src/index.ts", "coverage": 90 },
        { "file": "src/utils/helper.ts", "coverage": 75 }
      ]
    },
    "lint": {
      "errors": 0,
      "warnings": 3,
      "messages": [
        { "file": "src/index.ts", "line": 10, "message": "Unused variable" }
      ]
    },
    "complexity": {
      "average": 5.2,
      "max": 12,
      "files": [
        { "file": "src/utils/helper.ts", "complexity": 12 }
      ]
    }
  }
}
```

## 3. 创意 API

### 3.1 创意资源

```typescript
// 创意数据模型
interface Idea {
  id: string;
  title: string;
  description: string;
  projectType: 'web-app' | 'cli-tool' | 'library' | 'api-service';
  features: string[];
  techStack: string[];
  targetAudience: string;
  complexity: 'low' | 'medium' | 'high';

  // 评估分数
  valueScore?: number;
  noveltyScore?: number;
  feasibilityScore?: number;

  // 状态
  status: 'pending' | 'queued' | 'in_progress' | 'completed' | 'failed';
  queuePosition?: number;
  error?: string;

  // 时间戳
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
```

### 3.2 创意接口

```typescript
// 获取创意列表
// GET /api/v1/ideas

// Query Parameters
interface ListIdeasQuery {
  status?: Idea['status'];
  projectType?: Idea['projectType'];
  complexity?: Idea['complexity'];
  minValueScore?: number;
  limit?: number;
  offset?: number;
}

// Response
// 200 OK
{
  "data": [
    {
      "id": "idea_001",
      "title": "API Monitoring Dashboard",
      "description": "A real-time dashboard for API monitoring",
      "projectType": "web-app",
      "features": ["Real-time charts", "Alert system", "API health check"],
      "techStack": ["React", "Node.js", "WebSocket"],
      "targetAudience": "DevOps teams",
      "complexity": "medium",
      "valueScore": 0.85,
      "noveltyScore": 0.6,
      "feasibilityScore": 0.9,
      "status": "pending",
      "createdAt": "2026-04-14T09:00:00Z"
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

```typescript
// 创建创意
// POST /api/v1/ideas

// Request Body
interface CreateIdeaRequest {
  title?: string;
  description?: string;
  projectType?: Idea['projectType'];
  features?: string[];
  techStack?: string[];
  constraints?: string[];
  count?: number;           // 生成多个，默认 1
}

// Response
// 201 Created
{
  "data": {
    "id": "idea_002",
    "title": "CLI Data Transformer",
    "description": "Command-line tool for data transformation",
    "projectType": "cli-tool",
    "features": ["CSV to JSON", "Data validation", "Batch processing"],
    "techStack": ["TypeScript", "Node.js", "Commander.js"],
    "targetAudience": "Data engineers",
    "complexity": "low",
    "valueScore": 0.78,
    "noveltyScore": 0.7,
    "feasibilityScore": 0.95,
    "status": "pending",
    "createdAt": "2026-04-14T12:00:00Z"
  }
}
```

```typescript
// 获取创意详情
// GET /api/v1/ideas/:id

// Response
// 200 OK
{
  "data": {
    "id": "idea_001",
    "title": "API Monitoring Dashboard",
    "description": "A real-time dashboard for API monitoring",
    "projectType": "web-app",
    "features": [
      "Real-time charts",
      "Alert system",
      "API health check",
      "Rate limiting visualization"
    ],
    "techStack": [
      "React",
      "TypeScript",
      "Node.js",
      "WebSocket",
      "Chart.js"
    ],
    "targetAudience": "DevOps teams",
    "complexity": "medium",
    "valueScore": 0.85,
    "noveltyScore": 0.6,
    "feasibilityScore": 0.9,
    "status": "queued",
    "queuePosition": 3,
    "createdAt": "2026-04-14T09:00:00Z"
  }
}
```

```typescript
// 将创意加入队列
// POST /api/v1/ideas/:id/queue

// Request Body
interface QueueIdeaRequest {
  priority?: number;       // 优先级，1-10，默认 5
  scheduleAt?: string;     // 计划执行时间
}

// Response
// 200 OK
{
  "data": {
    "id": "idea_001",
    "status": "queued",
    "queuePosition": 3,
    "estimatedStartTime": "2026-04-14T13:00:00Z"
  }
}
```

```typescript
// 删除创意
// DELETE /api/v1/ideas/:id

// Response
// 204 No Content
```

## 4. 系统 API

### 4.1 系统状态

```typescript
// 获取系统状态
// GET /api/v1/system/status

// Response
// 200 OK
{
  "data": {
    "status": "running",
    "uptime": 3600000,  // 毫秒
    "version": "1.0.0",
    "environment": "production",
    "config": {
      "llm": {
        "provider": "openai",
        "model": "gpt-4",
        "baseUrl": "https://api.openai.com"
      },
      "pipeline": {
        "ideaGeneration": true,
        "projectDevelopment": true,
        "maxConcurrentProjects": 5
      }
    },
    "ideas": {
      "pending": 12,
      "queued": 3,
      "in_progress": 2,
      "completed": 156,
      "failed": 8
    },
    "projects": {
      "initializing": 1,
      "generating": 2,
      "testing": 1,
      "building": 1,
      "completed": 156,
      "failed": 8
    },
    "resources": {
      "cpu": { "usage": 45 },
      "memory": { "usage": 62 },
      "disk": { "usage": 38 }
    }
  }
}
```

### 4.2 系统指标

```typescript
// 获取系统指标
// GET /api/v1/system/metrics

// Query Parameters
interface SystemMetricsQuery {
  period?: '1h' | '24h' | '7d' | '30d';
  interval?: '5m' | '1h' | '1d';
}

// Response
// 200 OK
{
  "data": {
    "period": {
      "start": "2026-04-14T00:00:00Z",
      "end": "2026-04-14T23:59:59Z",
      "interval": "1h"
    },
    "generation": {
      "total": 24,
      "successful": 22,
      "failed": 2,
      "successRate": 0.92,
      "avgDuration": 1800000,  // 毫秒
      "avgQualityScore": 78
    },
    "usage": {
      "totalTokens": 15000000,
      "cost": 45.50,
      "avgCostPerProject": 1.89
    },
    "timeSeries": {
      "projects": [
        { "timestamp": "2026-04-14T00:00:00Z", "count": 2 },
        { "timestamp": "2026-04-14T01:00:00Z", "count": 3 }
      ],
      "quality": [
        { "timestamp": "2026-04-14T00:00:00Z", "avgScore": 82 },
        { "timestamp": "2026-04-14T01:00:00Z", "avgScore": 79 }
      ],
      "tokens": [
        { "timestamp": "2026-04-14T00:00:00Z", "count": 500000 },
        { "timestamp": "2026-04-14T01:00:00Z", "count": 750000 }
      ]
    }
  }
}
```

```typescript
// 健康检查
// GET /api/v1/system/health

// Response
// 200 OK (所有检查通过)
// 503 Service Unavailable (有检查失败)
{
  "data": {
    "healthy": true,
    "checks": {
      "database": {
        "status": "pass",
        "latency": 5
      },
      "llm": {
        "status": "pass",
        "latency": 250
      },
      "storage": {
        "status": "pass",
        "latency": 10
      },
      "workers": {
        "status": "pass",
        "activeWorkers": 3,
        "maxWorkers": 5
      }
    },
    "timestamp": "2026-04-14T12:00:00Z"
  }
}
```

## 5. 知识库 API

### 5.1 知识资源

```typescript
// 知识条目
interface KnowledgeEntry {
  id: string;
  type: 'code_pattern' | 'best_practice' | 'failure_case' | 'domain_knowledge';
  title: string;
  content: string;
  code?: string;
  summary: string;
  keywords: string[];
  tags: string[];

  source: {
    type: 'project' | 'user' | 'system';
    projectId?: string;
    author: string;
    createdAt: string;
  };

  quality: {
    score: number;
    usageCount: number;
    successRate: number;
    validated: boolean;
  };

  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 5.2 知识接口

```typescript
// 搜索知识
// GET /api/v1/knowledge

// Query Parameters
interface SearchKnowledgeQuery {
  q?: string;                        // 搜索文本
  type?: KnowledgeEntry['type'];   // 类型过滤
  tags?: string;                    // 标签过滤，逗号分隔
  language?: string;                // 编程语言
  minQualityScore?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'quality' | 'usage' | 'recency';
}

// Response
// 200 OK
{
  "data": [
    {
      "id": "know_001",
      "type": "code_pattern",
      "title": "useAsyncData Hook",
      "summary": "React hook for async data fetching with caching",
      "tags": ["react", "hooks", "async"],
      "quality": {
        "score": 92,
        "usageCount": 45,
        "successRate": 0.95,
        "validated": true
      }
    }
  ],
  "pagination": {
    "total": 156,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

```typescript
// 获取知识详情
// GET /api/v1/knowledge/:id

// Response
// 200 OK
{
  "data": {
    "id": "know_001",
    "type": "code_pattern",
    "title": "useAsyncData Hook",
    "content": "A custom React hook for managing async data fetching with automatic caching and error handling.",
    "code": "function useAsyncData<T>(...): {...}",
    "summary": "React hook for async data fetching with caching",
    "keywords": ["react", "hooks", "async", "data fetching"],
    "tags": ["react", "hooks", "async"],
    "source": {
      "type": "system",
      "author": "system",
      "createdAt": "2026-04-10T00:00:00Z"
    },
    "quality": {
      "score": 92,
      "usageCount": 45,
      "successRate": 0.95,
      "validated": true
    },
    "isActive": true,
    "createdAt": "2026-04-10T00:00:00Z",
    "updatedAt": "2026-04-14T00:00:00Z"
  }
}
```

## 6. WebSocket API

### 6.1 连接

```typescript
// WebSocket 连接
// ws://localhost:3001/ws?token=<jwt_token>

// 连接成功
{
  "type": "connected",
  "data": {
    "sessionId": "session_abc123",
    "timestamp": "2026-04-14T12:00:00Z"
  }
}
```

### 6.2 项目事件

```typescript
// 订阅项目更新
// Client -> Server
{
  "type": "subscribe",
  "data": {
    "channel": "project:proj_abc123"
  }
}

// Server -> Client (项目阶段更新)
{
  "type": "project:stage_changed",
  "data": {
    "projectId": "proj_abc123",
    "stage": "coding",
    "previousStage": "architecture",
    "timestamp": "2026-04-14T12:00:00Z"
  }
}

// Server -> Client (项目完成)
{
  "type": "project:completed",
  "data": {
    "projectId": "proj_abc123",
    "status": "completed",
    "qualityScore": 85,
    "duration": 3600000
  }
}

// Server -> Client (项目失败)
{
  "type": "project:failed",
  "data": {
    "projectId": "proj_abc123",
    "status": "failed",
    "error": "Compilation failed",
    "stage": "building"
  }
}
```

### 6.3 日志事件

```typescript
// 订阅日志
// Client -> Server
{
  "type": "subscribe",
  "data": {
    "channel": "logs:proj_abc123"
  }
}

// Server -> Client
{
  "type": "log",
  "data": {
    "projectId": "proj_abc123",
    "timestamp": "2026-04-14T12:00:00Z",
    "level": "info",
    "agent": "CoderAgent",
    "message": "Generated file: src/index.ts",
    "metadata": {
      "file": "src/index.ts",
      "lines": 45
    }
  }
}
```

## 7. 错误响应

### 7.1 错误格式

```typescript
// 统一错误响应格式
interface ErrorResponse {
  error: {
    code: string;           // 错误代码
    message: string;        // 用户友好的错误消息
    details?: any;          // 详细信息
    requestId?: string;     // 请求追踪 ID
  };
}
```

### 7.2 错误代码

| HTTP 状态码 | 错误代码 | 说明 |
|------------|----------|------|
| 400 | VALIDATION_ERROR | 请求参数验证失败 |
| 400 | INVALID_REQUEST | 无效的请求格式 |
| 401 | UNAUTHORIZED | 未认证 |
| 403 | FORBIDDEN | 无权限 |
| 404 | NOT_FOUND | 资源不存在 |
| 409 | CONFLICT | 资源冲突 |
| 422 | UNPROCESSABLE | 无法处理的实体 |
| 429 | RATE_LIMITED | 请求过于频繁 |
| 500 | INTERNAL_ERROR | 内部错误 |
| 503 | SERVICE_UNAVAILABLE | 服务不可用 |

### 7.3 错误示例

```json
// 400 Bad Request
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "name",
        "message": "Name is required",
        "value": null
      },
      {
        "field": "type",
        "message": "Invalid project type",
        "value": "invalid"
      }
    ],
    "requestId": "req_xyz789"
  }
}

// 401 Unauthorized
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token",
    "requestId": "req_abc123"
  }
}

// 404 Not Found
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Project not found",
    "requestId": "req_def456"
  }
}

// 429 Too Many Requests
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Please retry after 60 seconds.",
    "details": {
      "retryAfter": 60,
      "limit": "100 requests per minute"
    },
    "requestId": "req_ghi789"
  }
}

// 500 Internal Error
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "requestId": "req_jkl012"
  }
}
```

---

**版本**: 1.0.0
**创建日期**: 2026-04-14
**状态**: API 规格说明完成
