# API接口规范

## 1. API设计原则

### 1.1 RESTful设计原则

| 原则 | 描述 | 示例 |
|------|------|------|
| 资源命名 | 使用名词复数 | `/projects`, `/users` |
| HTTP方法 | 语义化使用方法 | GET读取, POST创建, PUT更新, DELETE删除 |
| 状态码 | 正确使用状态码 | 200成功, 201创建, 400错误请求, 404未找到 |
| 版本控制 | URL版本控制 | `/api/v1/projects` |
| 过滤/分页 | 查询参数 | `?page=1&limit=20&status=active` |

### 1.2 响应格式

#### 成功响应

```json
{
  "success": true,
  "data": {
    // 响应数据
  },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

#### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "name",
        "message": "Name is required"
      }
    ]
  }
}
```

## 2. 项目API

### 2.1 获取项目列表

```
GET /api/v1/projects
```

**Query Parameters**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| page | integer | 否 | 页码，默认1 |
| limit | integer | 否 | 每页数量，默认20 |
| status | string | 否 | 状态筛选 |
| type | string | 否 | 类型筛选 |
| search | string | 否 | 搜索关键词 |
| sortBy | string | 否 | 排序字段 |
| sortOrder | string | 否 | 排序方向 asc/desc |

**Response**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "proj_abc123",
        "name": "My Todo App",
        "description": "A simple todo application",
        "type": "crud",
        "status": "completed",
        "progress": 100,
        "currentPhase": "deployment",
        "createdAt": "2024-01-15T10:00:00Z",
        "updatedAt": "2024-01-15T14:30:00Z",
        "metrics": {
          "generationTime": 16200,
          "codeQuality": 92,
          "testCoverage": 85
        }
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 50
    }
  }
}
```

### 2.2 获取项目详情

```
GET /api/v1/projects/:id
```

**Response**

```json
{
  "success": true,
  "data": {
    "id": "proj_abc123",
    "name": "My Todo App",
    "description": "A simple todo application",
    "type": "crud",
    "status": "completed",
    "progress": 100,
    "currentPhase": "deployment",
    "requirements": {
      "title": "Todo Application",
      "features": [
        {
          "name": "Create Todo",
          "description": "Users can create new todos",
          "priority": "high"
        }
      ]
    },
    "architecture": {
      "techStack": {
        "frontend": ["React", "TypeScript", "TailwindCSS"],
        "backend": ["Node.js", "Express", "TypeScript"],
        "database": "SQLite"
      }
    },
    "qualityReport": {
      "staticAnalysis": { "score": 95 },
      "tests": { "coverage": 85, "passed": 20, "failed": 0 },
      "overallScore": 90
    },
    "deployment": {
      "url": "https://my-todo-app.example.com",
      "status": "healthy"
    },
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T14:30:00Z"
  }
}
```

### 2.3 创建项目

```
POST /api/v1/projects
```

**Request Body**

```json
{
  "name": "My Todo App",
  "description": "A simple todo application",
  "type": "crud",
  "requirements": "I need a todo app where users can create, edit, and delete todos. Each todo has a title, description, due date, and status. Users can mark todos as complete."
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "id": "proj_abc123",
    "name": "My Todo App",
    "description": "A simple todo application",
    "type": "crud",
    "status": "pending",
    "progress": 0,
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

### 2.4 启动项目生成

```
POST /api/v1/projects/:id/start
```

**Response**

```json
{
  "success": true,
  "data": {
    "projectId": "proj_abc123",
    "status": "running",
    "currentPhase": "requirement",
    "estimatedTime": 14400
  }
}
```

### 2.5 停止项目生成

```
POST /api/v1/projects/:id/stop
```

**Response**

```json
{
  "success": true,
  "data": {
    "projectId": "proj_abc123",
    "status": "stopped",
    "stoppedAt": "2024-01-15T11:00:00Z"
  }
}
```

### 2.6 删除项目

```
DELETE /api/v1/projects/:id
```

**Response**

```json
{
  "success": true,
  "data": null
}
```

### 2.7 获取项目代码

```
GET /api/v1/projects/:id/code
```

**Query Parameters**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| path | string | 否 | 文件路径筛选 |

**Response**

```json
{
  "success": true,
  "data": {
    "files": [
      {
        "path": "frontend/src/App.tsx",
        "content": "import React from 'react';\n...",
        "language": "typescript"
      },
      {
        "path": "backend/src/index.ts",
        "content": "import express from 'express';\n...",
        "language": "typescript"
      }
    ],
    "tree": {
      "name": "root",
      "type": "directory",
      "children": [
        {
          "name": "frontend",
          "type": "directory",
          "children": [
            { "name": "src", "type": "directory" },
            { "name": "package.json", "type": "file" }
          ]
        },
        {
          "name": "backend",
          "type": "directory"
        }
      ]
    }
  }
}
```

### 2.8 获取项目日志

```
GET /api/v1/projects/:id/logs
```

**Query Parameters**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| phase | string | 否 | 阶段筛选 |
| level | string | 否 | 日志级别 |
| limit | integer | 否 | 数量限制 |

**Response**

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": 1,
        "phase": "requirement",
        "agentName": "RequirementAgent",
        "level": "info",
        "message": "Started requirement analysis",
        "createdAt": "2024-01-15T10:01:00Z"
      },
      {
        "id": 2,
        "phase": "requirement",
        "agentName": "RequirementAgent",
        "level": "info",
        "message": "Generated 5 features",
        "createdAt": "2024-01-15T10:02:00Z"
      }
    ]
  }
}
```

## 3. 生成API

### 3.1 获取模板列表

```
GET /api/v1/generation/templates
```

**Response**

```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": "tpl_crud_basic",
        "name": "Basic CRUD",
        "type": "crud",
        "description": "A basic CRUD application with list, create, edit, delete functionality",
        "previewImage": "/images/templates/crud-basic.png"
      },
      {
        "id": "tpl_dashboard",
        "name": "Dashboard",
        "type": "dashboard",
        "description": "A dashboard application with charts and data visualization",
        "previewImage": "/images/templates/dashboard.png"
      }
    ]
  }
}
```

### 3.2 预览生成

```
POST /api/v1/generation/preview
```

**Request Body**

```json
{
  "requirements": "I need a blog application...",
  "templateId": "tpl_crud_basic"
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "estimatedFiles": 25,
    "estimatedLines": 2000,
    "estimatedTime": 14400,
    "techStack": {
      "frontend": ["React", "TypeScript"],
      "backend": ["Node.js", "Express"],
      "database": "SQLite"
    },
    "features": [
      "User authentication",
      "Post CRUD",
      "Comment system",
      "Tag management"
    ]
  }
}
```

## 4. 知识库API

### 4.1 搜索知识

```
GET /api/v1/knowledge/search
```

**Query Parameters**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| q | string | 是 | 搜索查询 |
| type | string | 否 | 类型筛选 |
| language | string | 否 | 语言筛选 |
| limit | integer | 否 | 结果数量 |

**Response**

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "knowledge_123",
        "type": "code-pattern",
        "title": "React DataTable Component",
        "description": "A reusable data table with sorting and pagination",
        "similarity": 0.95,
        "tags": ["react", "table", "component"]
      }
    ]
  }
}
```

### 4.2 获取知识详情

```
GET /api/v1/knowledge/:id
```

**Response**

```json
{
  "success": true,
  "data": {
    "id": "knowledge_123",
    "type": "code-pattern",
    "title": "React DataTable Component",
    "description": "A reusable data table with sorting and pagination",
    "content": "import React from 'react';\n...",
    "tags": ["react", "table", "component"],
    "usageCount": 150,
    "successRate": 0.95
  }
}
```

## 5. 监控API

### 5.1 获取系统指标

```
GET /api/v1/monitoring/metrics
```

**Response**

```json
{
  "success": true,
  "data": {
    "system": {
      "cpu": { "usage": 45.5, "cores": 8 },
      "memory": { "used": 4096, "total": 8192, "usagePercent": 50 },
      "disk": { "used": 50, "total": 100, "usagePercent": 50 }
    },
    "agents": {
      "total": 6,
      "active": 3,
      "idle": 3,
      "byType": {
        "RequirementAgent": { "active": 1, "avgDuration": 120 },
        "DevelopmentAgent": { "active": 2, "avgDuration": 300 }
      }
    },
    "queue": {
      "pending": 5,
      "active": 2,
      "completed": 100,
      "failed": 2
    },
    "generation": {
      "totalProjects": 102,
      "successRate": 0.87,
      "avgDuration": 14400
    }
  }
}
```

### 5.2 获取实时日志

```
GET /api/v1/monitoring/logs/stream
```

WebSocket连接，实时推送日志消息。

**Message Format**

```json
{
  "type": "log",
  "data": {
    "timestamp": "2024-01-15T10:00:00Z",
    "level": "info",
    "message": "Project generation started",
    "context": {
      "projectId": "proj_abc123",
      "phase": "requirement"
    }
  }
}
```

### 5.3 获取告警列表

```
GET /api/v1/monitoring/alerts
```

**Query Parameters**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| resolved | boolean | 否 | 是否已解决 |
| severity | string | 否 | 严重程度筛选 |

**Response**

```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "alert_123",
        "type": "cpu-high",
        "severity": "warning",
        "title": "High CPU Usage",
        "message": "CPU usage is above 80%",
        "resolved": false,
        "createdAt": "2024-01-15T10:00:00Z"
      }
    ]
  }
}
```

## 6. WebSocket事件

### 6.1 项目进度事件

**Channel**: `/api/v1/projects/:id/events`

**Events**

| 事件类型 | 描述 | 数据 |
|---------|------|------|
| `project.started` | 项目开始 | `{ projectId, startedAt }` |
| `phase.started` | 阶段开始 | `{ phase, startedAt }` |
| `phase.progress` | 阶段进度 | `{ phase, progress, message }` |
| `phase.completed` | 阶段完成 | `{ phase, duration, result }` |
| `phase.failed` | 阶段失败 | `{ phase, error }` |
| `project.completed` | 项目完成 | `{ projectId, duration, url }` |
| `project.failed` | 项目失败 | `{ projectId, error }` |

**Example**

```json
{
  "type": "phase.progress",
  "data": {
    "phase": "development",
    "progress": 75,
    "message": "Generated 15 of 20 files"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "projectId": "proj_abc123"
}
```

### 6.2 系统监控事件

**Channel**: `/api/v1/monitoring/realtime`

**Events**

| 事件类型 | 描述 | 数据 |
|---------|------|------|
| `metrics.update` | 指标更新 | `{ system, agents, queue }` |
| `alert.triggered` | 告警触发 | `{ alert }` |
| `alert.resolved` | 告警解决 | `{ alertId }` |

## 7. 错误码

| 错误码 | HTTP状态 | 描述 |
|--------|---------|------|
| `VALIDATION_ERROR` | 400 | 请求参数验证失败 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `UNAUTHORIZED` | 401 | 未授权 |
| `FORBIDDEN` | 403 | 权限不足 |
| `CONFLICT` | 409 | 资源冲突 |
| `RATE_LIMIT` | 429 | 请求频率超限 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |
| `SERVICE_UNAVAILABLE` | 503 | 服务不可用 |
| `PROJECT_NOT_FOUND` | 404 | 项目不存在 |
| `PROJECT_ALREADY_RUNNING` | 409 | 项目已在运行 |
| `GENERATION_FAILED` | 500 | 生成失败 |
| `LLM_ERROR` | 502 | LLM服务错误 |
| `DATABASE_ERROR` | 500 | 数据库错误 |

---

**版本**: 0.1.0
**更新日期**: 2026-04-14
**状态**: 设计阶段
