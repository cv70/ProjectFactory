# API 设计指南

## 1. 概述

本文档定义 ProjectFactory 系统的 API 设计标准，确保一致性、可用性和可维护性。

### 1.1 API 设计原则

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API 设计原则                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   一致性        │  │    可发现性      │  │     安全性      │         │
│  │  Consistency   │  │  Discoverability │  │    Security     │         │
│  │                 │  │                 │  │                 │         │
│  │ • 统一命名     │  │ • OpenAPI 文档  │  │ • 认证鉴权     │         │
│  │ • 统一错误码   │  │ • 版本控制      │  │ • 输入验证     │         │
│  │ • 统一格式     │  │ • 自描述       │  │ • 限流熔断     │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   可扩展性      │  │    性能        │  │     可靠性      │         │
│  │  Scalability   │  │  Performance   │  │  Reliability    │         │
│  │                 │  │                 │  │                 │         │
│  │ • 版本管理     │  │ • 缓存策略     │  │ • 幂等性      │         │
│  │ • 向后兼容     │  │ • 分页         │  │ • 超时处理    │         │
│  │ • 渐进式      │  │ • 压缩         │  │ • 重试机制    │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. URL 设计

### 2.1 资源命名规范

```yaml
# URL 结构规范

# ✅ 正确示例
GET    /api/v1/ideas                    # 复数资源
GET    /api/v1/ideas/{id}              # 单个资源
POST   /api/v1/ideas                   # 创建资源
PUT    /api/v1/ideas/{id}             # 完整更新
PATCH  /api/v1/ideas/{id}              # 部分更新
DELETE /api/v1/ideas/{id}             # 删除资源

GET    /api/v1/ideas/{id}/projects     # 嵌套资源
GET    /api/v1/projects/{id}/quality   # 多层嵌套

POST   /api/v1/ideas/{id}/clone       # 资源操作
POST   /api/v1/projects/{id}/archive   # 状态变更
GET    /api/v1/ideas/search           # 搜索

# ❌ 错误示例
GET    /api/v1/getIdea                # 使用动词
GET    /api/v1/idea/{id}              # 单数资源
GET    /api/v1/ideas/{id}/getProjects # 嵌套过深
POST   /api/v1/deleteIdea              # 动词在 URL
```

### 2.2 路径参数 vs 查询参数

```yaml
# 路径参数: 用于标识特定资源
GET  /api/v1/ideas/{id}
GET  /api/v1/projects/{projectId}/iterations/{iterationId}

# 查询参数: 用于过滤、排序、分页
GET  /api/v1/ideas?status=completed&page=1&limit=20
GET  /api/v1/projects?sort=created_at:desc&tags=react,typescript

# 查询参数约定
filter:     # 精确过滤
  ?status=active
  ?created_after=2026-01-01

range:       # 范围过滤
  ?created_at__gte=2026-01-01
  ?created_at__lte=2026-12-31

search:      # 全文搜索
  ?q=project+generator
  ?search=title:AI

sort:        # 排序
  ?sort=created_at
  ?sort=created_at:desc
  ?sort=name:asc,created_at:desc

page:        # 分页
  ?page=1
  ?limit=20
  ?offset=0

fields:      # 字段选择
  ?fields=id,title,status

expand:       # 展开关联
  ?expand=projects,tags
```

---

## 3. 请求与响应

### 3.1 请求格式

```typescript
// Content-Type
Content-Type: application/json
Content-Type: application/json; charset=utf-8

// 请求头约定
Request:
  Authorization: Bearer <token>
  X-Request-ID: <uuid>
  X-Correlation-ID: <uuid>
  Accept: application/json
  Accept-Language: zh-CN,en-US
  X-API-Version: 2026-04-14

// 请求体示例
POST /api/v1/projects
{
  "data": {
    "type": "projects",
    "attributes": {
      "name": "my-project",
      "type": "web-app",
      "description": "A new project"
    },
    "relationships": {
      "idea": {
        "data": { "type": "ideas", "id": "550e8400-e29b-41d4-a716-446655440000" }
      }
    }
  }
}

// 分页请求
GET /api/v1/projects?page[number]=1&page[size]=20

// 过滤请求
GET /api/v1/projects?filter[status]=active&filter[language][$in]=typescript,javascript
```

### 3.2 响应格式

```typescript
// 成功响应
// 200 OK - 单个资源
{
  "data": {
    "type": "ideas",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "attributes": {
      "title": "AI Code Review System",
      "description": "An automated code review system using AI",
      "status": "completed",
      "createdAt": "2026-04-01T10:00:00Z",
      "updatedAt": "2026-04-01T12:00:00Z"
    },
    "relationships": {
      "projects": {
        "data": [
          { "type": "projects", "id": "p1" },
          { "type": "projects", "id": "p2" }
        ]
      }
    },
    "links": {
      "self": "/api/v1/ideas/550e8400-e29b-41d4-a716-446655440000"
    }
  },
  "meta": {
    "requestId": "req_abc123"
  }
}

// 201 Created - 创建资源
{
  "data": {
    "type": "projects",
    "id": "project_123",
    "attributes": {
      "name": "my-project",
      "status": "pending"
    }
  },
  "meta": {
    "created": true
  }
}

// 200 OK - 集合资源
{
  "data": [
    { "type": "ideas", "id": "1", "attributes": {...} },
    { "type": "ideas", "id": "2", "attributes": {...} }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalPages": 10,
      "totalCount": 200
    }
  },
  "links": {
    "self": "/api/v1/ideas?page=1",
    "first": "/api/v1/ideas?page=1",
    "prev": null,
    "next": "/api/v1/ideas?page=2",
    "last": "/api/v1/ideas?page=10"
  }
}
```

### 3.3 错误响应

```typescript
// 错误响应格式
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": [
      {
        "field": "name",
        "message": "名称不能为空",
        "code": "REQUIRED"
      },
      {
        "field": "type",
        "message": "类型必须是 web-app, cli-tool, library 或 api-service 之一",
        "code": "INVALID_ENUM"
      }
    ],
    "requestId": "req_xyz789",
    "timestamp": "2026-04-14T10:30:00Z",
    "traceId": "trace_abc123"
  }
}

// 错误代码定义
const ERROR_CODES = {
  // 4xx 客户端错误
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  RATE_LIMITED: 429,

  // 5xx 服务端错误
  INTERNAL_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

// 错误响应头
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1713086400
```

---

## 4. 认证与授权

### 4.1 认证方案

```yaml
# 认证方式
authentication:
  # Bearer Token (JWT)
  - type: bearer
    header: Authorization
    scheme: Bearer
    token: JWT

  # API Key
  - type: api_key
    header: X-API-Key
    in: header

  # OAuth 2.0
  - type: oauth2
    flows:
      - authorization_code
      - client_credentials
```

### 4.2 权限控制

```typescript
// 基于角色的权限定义
const PERMISSIONS = {
  // 想法权限
  'idea:read': ['viewer', 'editor', 'owner', 'admin'],
  'idea:create': ['editor', 'owner', 'admin'],
  'idea:update': ['editor', 'owner', 'admin'],
  'idea:delete': ['owner', 'admin'],

  // 项目权限
  'project:read': ['viewer', 'editor', 'owner', 'admin'],
  'project:create': ['editor', 'owner', 'admin'],
  'project:update': ['editor', 'owner', 'admin'],
  'project:delete': ['owner', 'admin'],
  'project:archive': ['editor', 'owner', 'admin'],
  'project:export': ['owner', 'admin'],

  // 管理权限
  'admin:read': ['admin'],
  'admin:write': ['admin'],
  'admin:settings': ['admin'],
};

// API 权限检查
const apiAuthorization = {
  '/api/v1/ideas': {
    GET: ['idea:read'],
    POST: ['idea:create'],
  },
  '/api/v1/ideas/{id}': {
    GET: ['idea:read'],
    PUT: ['idea:update'],
    PATCH: ['idea:update'],
    DELETE: ['idea:delete'],
  },
  '/api/v1/admin/**': {
    GET: ['admin:read'],
    POST: ['admin:write'],
    PUT: ['admin:write'],
    DELETE: ['admin:write'],
  },
};
```

---

## 5. 版本管理

### 5.1 版本策略

```yaml
# URL 版本
/api/v1/ideas
/api/v2/ideas

# 版本生命周期
version_policy:
  current: "v3"           # 当前稳定版本
  deprecated: ["v1"]       # 已废弃版本
  sunset: "2026-12-31"    # 废弃日期

# 版本头
Accept: application/vnd.projectfactory.v3+json
API-Version: 2026-04-14

# 响应头
API-Version: v3
Deprecation: true
Sunset: Sat, 31 Dec 2026 23:59:59 GMT
Link: <https://api.projectfactory.com/v4/ideas>; rel="successor-version"
```

### 5.2 兼容性策略

```typescript
// 破坏性变更
// ❌ 不兼容
- 删除字段
- 重命名字段/端点
- 修改字段类型
- 改变字段语义
- 要求新的必填字段
- 修改认证方式

// 兼容变更
// ✅ 兼容
- 添加新字段 (带默认值)
- 添加新的可选字段
- 添加新的端点
- 添加新的查询参数
- 添加新的响应字段
- 放宽验证规则
```

---

## 6. 性能优化

### 6.1 缓存策略

```yaml
# HTTP 缓存
cache_control:
  # 私有资源
  private:
    - /api/v1/users/me
    - /api/v1/projects/*/settings
    max_age: 300

  # 公共只读资源
  public:
    - /api/v1/ideas
    - /api/v1/templates
    max_age: 3600
    stale_while_revalidate: 60

  # 不缓存
  no_cache:
    - /api/v1/search
    - /api/v1/analytics

# ETag 策略
etag:
  enabled: true
  weak: true  # 使用弱 ETag
```

### 6.2 压缩与分页

```yaml
# 响应压缩
compression:
  accept_encoding:
    - gzip
    - br  # Brotli
  min_size: 1024  # 最小压缩大小 (bytes)
  level: 6       # 压缩级别 1-9

# 大响应分页
pagination:
  default_page_size: 20
  max_page_size: 100
  cursor_based:
    enabled: true
    cursor_field: "id"
    cursor_order: "desc"
  offset_based:
    enabled: true
    offset_param: "offset"
    limit_param: "limit"
```

---

## 7. 文档规范

### 7.1 OpenAPI 规范

```yaml
# openapi.yaml 示例
openapi: 3.0.3
info:
  title: ProjectFactory API
  version: 3.0.0
  description: |
    ProjectFactory 是一个无限全自动化生成项目的系统。

  contact:
    name: API Support
    email: api-support@projectfactory.com

  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.projectfactory.com/v3
    description: Production
  - url: https://staging-api.projectfactory.com/v3
    description: Staging

tags:
  - name: ideas
    description: 想法管理
  - name: projects
    description: 项目管理
  - name: quality
    description: 质量检查

paths:
  /ideas:
    get:
      summary: 获取想法列表
      description: |
        返回用户的想法列表，支持过滤、排序和分页。

      tags: [ideas]
      operationId: listIdeas
      parameters:
        - $ref: '#/components/parameters/PageParam'
        - $ref: '#/components/parameters/LimitParam'
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, in_progress, completed, failed]
        - name: sort
          in: query
          schema:
            type: string
            default: created_at:desc
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/IdeaList'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '429':
          $ref: '#/components/responses/RateLimited'

components:
  parameters:
    PageParam:
      name: page
      in: query
      schema:
        type: integer
        minimum: 1
        default: 1
    LimitParam:
      name: limit
      in: query
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20

  schemas:
    Idea:
      type: object
      properties:
        id:
          type: string
          format: uuid
        title:
          type: string
          minLength: 1
          maxLength: 200
        status:
          type: string
          enum: [pending, in_progress, completed, failed]
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    IdeaList:
      type: object
      properties:
        data:
          type: array
          items:
            $ref: '#/components/schemas/Idea'
        meta:
          type: object
          properties:
            pagination:
              $ref: '#/components/schemas/Pagination'

    Error:
      type: object
      properties:
        error:
          type: object
          properties:
            code:
              type: string
            message:
              type: string
            details:
              type: array
              items:
                type: object

  responses:
    Unauthorized:
      description: 未认证
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    RateLimited:
      description: 请求过于频繁
      headers:
        Retry-After:
          schema:
            type: integer
          description: 重试等待秒数
```

---

## 8. 安全最佳实践

### 8.1 安全头

```yaml
# 安全响应头
security_headers:
  Strict-Transport-Security:
    value: "max-age=31536000; includeSubDomains"
    description: "强制 HTTPS"

  X-Content-Type-Options:
    value: "nosniff"
    description: "防止 MIME 类型嗅探"

  X-Frame-Options:
    value: "DENY"
    description: "防止点击劫持"

  X-XSS-Protection:
    value: "1; mode=block"
    description: "XSS 防护"

  Content-Security-Policy:
    value: "default-src 'self'"
    description: "内容安全策略"

  Referrer-Policy:
    value: "strict-origin-when-cross-origin"
    description: "引用来源策略"

  Permissions-Policy:
    value: "geolocation=(), microphone=(), camera=()"
    description: "权限策略"
```

### 8.2 输入验证

```typescript
// 输入验证规则
const validationRules = {
  // 字符串
  string: {
    minLength: 1,
    maxLength: 10000,
    pattern: '^(?!\\s*$).+',  // 非空白字符串
  },

  // 邮箱
  email: {
    format: 'email',
    maxLength: 255,
  },

  // UUID
  uuid: {
    format: 'uuid',
    version: 4,
  },

  // 枚举
  status: {
    enum: ['pending', 'in_progress', 'completed', 'failed'],
  },

  // 数字范围
  page: {
    type: 'integer',
    minimum: 1,
    maximum: 1000,
  },

  // 数组
  tags: {
    type: 'array',
    items: { type: 'string', maxLength: 50 },
    minItems: 0,
    maxItems: 10,
    uniqueItems: true,
  },
};
```

---

## 9. 相关文档

- [API 规格说明](./API_SPECIFICATION.md)
- [API 网关](./API_GATEWAY.md)
- [API 版本管理策略](./API_VERSIONING_STRATEGY.md)
- [GraphQL API](./GRAPHQL_API.md)
- [安全设计](./SECURITY_DESIGN.md)

---

**最后更新**: 2026-04-14
