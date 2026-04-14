# API设计与集成模式

## 概述

API设计与集成模式定义了ProjectFactory系统的外部接口规范和内部服务协作方式。系统需要提供RESTful API和WebSocket两种主要接口，支持GraphQL作为查询层，提供完善的API版本管理、限流、熔断和集成模式，确保与外部系统的无缝对接。

## 核心价值

- **标准化接口**：统一的API设计规范，确保一致性和易用性
- **灵活集成**：支持多种集成模式和协议
- **安全可靠**：完善的认证、授权和限流机制
- **可观测**：完整的请求追踪和日志记录
- **易于演进**：API版本管理和向后兼容

## API设计原则

### RESTful API规范

```typescript
// API基础规范
const API_SPEC = {
  // 版本
  version: 'v1',
  basePath: '/api/v1',

  // 通用头
  headers: {
    request: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Bearer {token}',
      'X-Request-ID': '{uuid}',
      'X-Correlation-ID': '{uuid}',
    },
    response: {
      'Content-Type': 'application/json',
      'X-Request-ID': '{request_id}',
      'X-RateLimit-Limit': '{limit}',
      'X-RateLimit-Remaining': '{remaining}',
      'X-RateLimit-Reset': '{timestamp}',
    },
  },

  // 状态码
  statusCodes: {
    // 成功
    200: 'OK - 请求成功',
    201: 'Created - 资源创建成功',
    204: 'No Content - 请求成功但无返回内容',

    // 客户端错误
    400: 'Bad Request - 请求参数错误',
    401: 'Unauthorized - 未认证',
    403: 'Forbidden - 无权限',
    404: 'Not Found - 资源不存在',
    409: 'Conflict - 资源冲突',
    422: 'Unprocessable Entity - 请求格式正确但语义错误',
    429: 'Too Many Requests - 请求过于频繁',

    // 服务端错误
    500: 'Internal Server Error - 服务器内部错误',
    502: 'Bad Gateway - 网关错误',
    503: 'Service Unavailable - 服务不可用',
    504: 'Gateway Timeout - 网关超时',
  },
};
```

### 资源命名规范

```typescript
// 命名规范
const NAMING_CONVENTIONS = {
  // URL路径
  paths: {
    resource: '/{resource}',              // 资源列表
    resourceId: '/{resource}/{id}',       // 单个资源
    subResource: '/{resource}/{id}/{sub}', // 子资源
    actions: '/{resource}/{id}/{action}',  // 资源动作

    // 示例
    // GET    /projects              - 项目列表
    // POST   /projects              - 创建项目
    // GET    /projects/123          - 获取项目详情
    // PUT    /projects/123          - 更新项目
    // DELETE /projects/123          - 删除项目
    // POST   /projects/123/generate - 触发生成
    // GET    /projects/123/artifacts - 获取项目制品
  },

  // 查询参数
  queryParams: {
    pagination: {
      page: 'page',           // 页码 (默认1)
      pageSize: 'page_size',  // 每页数量 (默认20, 最大100)
    },
    sorting: {
      sort: 'sort',           // 排序字段
      order: 'order',         // 排序方向 (asc/desc)
    },
    filtering: {
      prefix: 'filter.',     // 过滤前缀
      // 示例: filter.status=active&filter.type=web
    },
    search: {
      q: 'q',                // 搜索关键词
      fuzzy: 'fuzzy',        // 模糊搜索 (true/false)
    },
  },

  // HTTP方法语义
  httpMethods: {
    GET: '查询资源，不修改任何数据，幂等',
    POST: '创建资源，非幂等',
    PUT: '完整替换资源，幂等',
    PATCH: '部分更新资源，幂等',
    DELETE: '删除资源，幂等',
    HEAD: '获取资源头信息，幂等',
    OPTIONS: '获取支持的HTTP方法',
  },
};
```

### 请求/响应模型

```typescript
// 标准错误响应
interface APIError {
  error: {
    code: string;              // 错误码，如 'VALIDATION_ERROR'
    message: string;           // 错误消息
    details?: ValidationError[]; // 详细错误信息
    requestId: string;        // 请求ID
    timestamp: string;         // 时间戳 ISO8601
    docsUrl?: string;          // 错误文档链接
  };
}

interface ValidationError {
  field: string;              // 字段路径，如 'email'
  message: string;            // 错误消息
  code: string;               // 错误码，如 'INVALID_FORMAT'
  value?: any;                // 错误的值
}

// 分页响应
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  links: {
    self: string;
    first: string;
    last: string;
    next?: string;
    prev?: string;
  };
}

// 标准列表响应
interface ListResponse<T> {
  data: T[];
  meta: {
    count: number;
    timestamp: string;
  };
}

// 标准单个资源响应
interface SingleResponse<T> {
  data: T;
  meta: {
    timestamp: string;
  };
}
```

## API端点定义

### 项目相关API

```typescript
// 项目API
const ProjectAPI = {
  // 端点定义
  endpoints: {
    // 项目列表
    listProjects: {
      method: 'GET',
      path: '/projects',
      summary: '获取项目列表',
      parameters: {
        query: {
          page: { type: 'integer', default: 1 },
          pageSize: { type: 'integer', default: 20, max: 100 },
          status: { type: 'string', enum: ['draft', 'generating', 'completed', 'failed'] },
          sort: { type: 'string', default: '-createdAt' },
        },
      },
      response: PaginatedResponse<ProjectSummary>,
    },

    // 创建项目
    createProject: {
      method: 'POST',
      path: '/projects',
      summary: '创建新项目',
      body: {
        type: 'CreateProjectRequest',
        required: ['name', 'description', 'type'],
      },
      response: SingleResponse<Project>,
    },

    // 获取项目详情
    getProject: {
      method: 'GET',
      path: '/projects/{id}',
      summary: '获取项目详情',
      parameters: {
        path: { id: { type: 'string', format: 'uuid' } },
      },
      response: SingleResponse<Project>,
    },

    // 更新项目
    updateProject: {
      method: 'PATCH',
      path: '/projects/{id}',
      summary: '更新项目',
      parameters: {
        path: { id: { type: 'string', format: 'uuid' } },
      },
      body: { type: 'UpdateProjectRequest' },
      response: SingleResponse<Project>,
    },

    // 删除项目
    deleteProject: {
      method: 'DELETE',
      path: '/projects/{id}',
      summary: '删除项目',
      parameters: {
        path: { id: { type: 'string', format: 'uuid' } },
      },
      response: { type: 'void', statusCode: 204 },
    },

    // 触发生成
    triggerGeneration: {
      method: 'POST',
      path: '/projects/{id}/generate',
      summary: '触发项目生成',
      parameters: {
        path: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'GenerationOptions',
        properties: {
          priority: { type: 'string', enum: ['low', 'normal', 'high', 'critical'] },
          callbackUrl: { type: 'string', format: 'uri' },
        },
      },
      response: SingleResponse<GenerationJob>,
    },

    // 获取生成状态
    getGenerationStatus: {
      method: 'GET',
      path: '/projects/{id}/generation',
      summary: '获取生成状态',
      parameters: {
        path: { id: { type: 'string', format: 'uuid' } },
      },
      response: SingleResponse<GenerationStatus>,
    },

    // 获取制品
    getArtifacts: {
      method: 'GET',
      path: '/projects/{id}/artifacts',
      summary: '获取项目制品',
      parameters: {
        path: { id: { type: 'string', format: 'uuid' } },
        query: {
          type: { type: 'string', enum: ['source', 'config', 'test', 'doc'] },
          version: { type: 'string' },
        },
      },
      response: ListResponse<Artifact>,
    },
  },
};
```

### Webhook API

```typescript
// Webhook API
const WebhookAPI = {
  // 注册Webhook
  registerWebhook: {
    method: 'POST',
    path: '/webhooks',
    summary: '注册Webhook',
    body: {
      type: 'CreateWebhookRequest',
      required: ['url', 'events'],
      properties: {
        url: { type: 'string', format: 'uri' },
        events: {
          type: 'array',
          items: { type: 'string', enum: WebhookEventType },
        },
        secret: { type: 'string' },
        active: { type: 'boolean', default: true },
        filters: {
          type: 'object',
          properties: {
            projectTypes: { type: 'array', items: { type: 'string' } },
            status: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    response: SingleResponse<Webhook>,
  },

  // Webhook事件类型
  eventTypes: [
    'project.created',
    'project.updated',
    'project.deleted',
    'generation.started',
    'generation.progress',
    'generation.completed',
    'generation.failed',
    'artifact.created',
    'quality.assessed',
  ],
};
```

## GraphQL API

### Schema设计

```typescript
// GraphQL Schema
const typeDefs = `
type Query {
  # 项目查询
  project(id: ID!): Project
  projects(
    first: Int
    after: String
    last: Int
    before: String
    where: ProjectWhereInput
    orderBy: ProjectOrderByInput
  ): ProjectConnection!

  # 用户查询
  me: User
  user(id: ID!): User

  # 模板查询
  templates(
    first: Int
    after: String
    where: TemplateWhereInput
  ): TemplateConnection!

  # 搜索
  search(query: String!, type: SearchType!): SearchResult!
}

type Mutation {
  # 项目操作
  createProject(input: CreateProjectInput!): Project!
  updateProject(id: ID!, input: UpdateProjectInput!): Project!
  deleteProject(id: ID!): Boolean!

  # 生成操作
  startGeneration(projectId: ID!, options: GenerationOptionsInput): GenerationJob!
  cancelGeneration(jobId: ID!): GenerationJob!

  # 收藏
  toggleFavorite(projectId: ID!): Favorite!
}

type Subscription {
  # 生成进度
  generationProgress(projectId: ID!): GenerationEvent!

  # 项目更新
  projectUpdated(id: ID!): Project!
}

# 类型定义
type Project {
  id: ID!
  name: String!
  description: String!
  type: ProjectType!
  status: ProjectStatus!
  visibility: Visibility!

  # 关系
  owner: User!
  artifacts: [Artifact!]!
  generations: [Generation!]!

  # 元数据
  qualityScore: Int
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Artifact {
  id: ID!
  name: String!
  type: ArtifactType!
  version: String!
  checksum: String!
  downloadUrl: String!
  size: Int!
}

# 输入类型
input CreateProjectInput {
  name: String!
  description: String!
  type: ProjectType!
  visibility: Visibility = PRIVATE
  templateId: ID
}

input ProjectWhereInput {
  status: ProjectStatus
  type: ProjectType
  ownerId: ID
  createdAfter: DateTime
  createdBefore: DateTime
}

# 连接类型 (分页)
type ProjectConnection {
  edges: [ProjectEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type ProjectEdge {
  node: Project!
  cursor: String!
}
`;
```

### Resolver实现

```typescript
// Resolver映射
const resolvers = {
  Query: {
    project: async (_, { id }, context) => {
      return context.loaders.project.load(id);
    },

    projects: async (_, args, context) => {
      return context.projectService.list({
        pagination: { first: args.first, after: args.after },
        filter: args.where,
        sort: args.orderBy,
      });
    },

    me: async (_, __, context) => {
      return context.auth.requireAuth(context.user);
    },
  },

  Mutation: {
    createProject: async (_, { input }, context) => {
      await context.auth.requirePermission('project:create');

      return context.projectService.create({
        ...input,
        ownerId: context.user.id,
      });
    },

    startGeneration: async (_, { projectId, options }, context) => {
      const project = await context.projectService.get(projectId);
      await context.auth.requireOwnership(project);

      return context.generationService.start({
        projectId,
        userId: context.user.id,
        priority: options?.priority,
        callbackUrl: options?.callbackUrl,
      });
    },
  },

  Subscription: {
    generationProgress: {
      subscribe: async function* (_, { projectId }, context) {
        const events = context.generationService.subscribe(projectId);
        for await (const event of events) {
          yield { generationProgress: event };
        }
      },
    },
  },

  // 字段解析器
  Project: {
    artifacts: async (project, _, context) => {
      return context.loaders.artifact.loadMany(
        project.artifactIds
      );
    },

    owner: async (project, _, context) => {
      return context.loaders.user.load(project.ownerId);
    },

    qualityScore: async (project, _, context) => {
      const metrics = await context.qualityService.getLatest(project.id);
      return metrics?.overallScore;
    },
  },
};
```

## 集成模式

### API网关模式

```typescript
// API网关配置
interface GatewayConfig {
  // 路由配置
  routes: Route[];

  // 全局限流
  globalRateLimit: {
    requests: number;
    window: string;          // e.g., '1m'
    keyBy: 'ip' | 'user' | 'api_key';
  };

  // 认证
  authentication: {
    enabled: boolean;
    type: 'jwt' | 'api_key' | 'oauth2';
    jwksUrl?: string;
  };

  // 熔断器
  circuitBreaker: {
    enabled: boolean;
    threshold: number;        // 失败率阈值
    timeout: string;         // 熔断持续时间
    halfOpenRequests: number; // 半开状态请求数
  };

  // 重试策略
  retry: {
    maxAttempts: number;
    backoff: 'fixed' | 'exponential';
    initialDelay: string;
    maxDelay: string;
    retryOn: number[];       // 重试的状态码
  };
}

// 路由定义
interface Route {
  path: string;              // e.g., '/api/v1/projects/*'
  method?: string;           // GET, POST, etc.
  upstream: {
    url: string;             // e.g., 'http://backend:3000'
    timeout: string;
  };

  // 中间件
  middleware: ('auth' | 'rateLimit' | 'logging' | 'cors')[];

  // 特定限流
  rateLimit?: {
    requests: number;
    window: string;
  };

  // 缓存
  cache?: {
    enabled: boolean;
    ttl: string;
    keyPattern?: string;
  };
}

// 预设路由
const ROUTES: Route[] = [
  {
    path: '/api/v1/projects/:id/generate',
    method: 'POST',
    upstream: { url: 'http://generation-service:3001', timeout: '5m' },
    middleware: ['auth', 'rateLimit'],
    rateLimit: { requests: 10, window: '1h' },
  },
  {
    path: '/api/v1/projects/*',
    upstream: { url: 'http://project-service:3000', timeout: '30s' },
    middleware: ['auth', 'logging', 'cors'],
    cache: { enabled: true, ttl: '1m' },
  },
  {
    path: '/api/v1/health',
    upstream: { url: 'http://health-service:3000', timeout: '5s' },
    middleware: [],
  },
];
```

### 熔断器实现

```typescript
// 熔断器状态机
enum CircuitState {
  CLOSED = 'closed',       // 正常，熔断器关闭
  OPEN = 'open',           // 熔断，开启状态
  HALF_OPEN = 'half_open', // 半开状态，允许部分请求
}

// 熔断器
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime?: Date;
  private successCount = 0;

  constructor(private config: CircuitBreakerConfig) {}

  // 执行请求
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new CircuitOpenError(this.config.name);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.successCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successCount >= this.config.halfOpenRequests) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
    } else if (this.failureCount >= this.config.threshold) {
      this.state = CircuitState.OPEN;
    }
  }

  private shouldAttemptReset(): boolean {
    const elapsed = Date.now() - this.lastFailureTime.getTime();
    return elapsed >= this.config.timeout;
  }

  getState(): CircuitState {
    return this.state;
  }
}
```

### 批量请求模式

```typescript
// 批量请求处理器
class BatchProcessor {
  private queue: Map<string, BatchRequest[]> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private batchSize: number = 100,
    private batchDelay: number = 50 // ms
  ) {}

  // 添加请求到批处理
  async add<T>(key: string, request: BatchRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.queue.has(key)) {
        this.queue.set(key, []);
      }

      this.queue.get(key).push({
        request,
        resolve,
        reject,
      });

      // 检查是否达到批量大小
      if (this.queue.get(key).length >= this.batchSize) {
        this.flush(key);
      } else {
        // 设置延迟刷新
        this.setTimer(key);
      }
    });
  }

  // 刷新指定key的请求
  private async flush(key: string): Promise<void> {
    const batch = this.queue.get(key);
    if (!batch || batch.length === 0) return;

    this.clearTimer(key);
    this.queue.delete(key);

    try {
      const results = await this.executeBatch(key, batch.map(b => b.request));
      results.forEach((result, index) => {
        batch[index].resolve(result);
      });
    } catch (error) {
      batch.forEach(b => b.reject(error));
    }
  }
}
```

## SDK设计

### TypeScript SDK

```typescript
// SDK客户端
class ProjectFactorySDK {
  private baseURL: string;
  private token?: string;
  private fetch: typeof fetch;

  constructor(config: SDKConfig) {
    this.baseURL = config.baseURL || 'https://api.projectfactory.ai';
    this.token = config.token;
    this.fetch = config.fetch || globalThis.fetch;
  }

  // 认证
  setToken(token: string): void {
    this.token = token;
  }

  // 项目操作
  async listProjects(options?: ListProjectsOptions): Promise<PaginatedResult<Project>> {
    return this.get('/projects', options);
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    return this.post('/projects', input);
  }

  async getProject(id: string): Promise<Project> {
    return this.get(`/projects/${id}`);
  }

  async triggerGeneration(projectId: string, options?: GenerationOptions): Promise<GenerationJob> {
    return this.post(`/projects/${projectId}/generate`, options);
  }

  // 生成
  async getGenerationStatus(projectId: string): Promise<GenerationStatus> {
    return this.get(`/projects/${projectId}/generation`);
  }

  async subscribeToGeneration(
    projectId: string,
    onEvent: (event: GenerationEvent) => void
  ): Promise<() => void> {
    const ws = new WebSocket(`${this.baseURL.replace('http', 'ws')}/projects/${projectId}/generation/stream`);

    ws.onmessage = (event) => {
      onEvent(JSON.parse(event.data));
    };

    return () => ws.close();
  }

  // 内部方法
  private async get<T>(path: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(path, this.baseURL);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) url.searchParams.set(k, String(v));
      });
    }

    return this.request(url.toString(), { method: 'GET' });
  }

  private async post<T>(path: string, body?: any): Promise<T> {
    return this.request(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private async request<T>(path: string, options: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-ID': crypto.randomUUID(),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await this.fetch(`${this.baseURL}${path}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new APIError(error.error);
    }

    return response.json();
  }
}

// 使用示例
const sdk = new ProjectFactorySDK({ token: 'your-token' });

// 列表项目
const projects = await sdk.listProjects({ page: 1, pageSize: 20 });

// 创建项目
const project = await sdk.createProject({
  name: 'My New Project',
  description: 'A project created with SDK',
  type: 'web-application',
});

// 触发生成并订阅进度
const job = await sdk.triggerGeneration(project.id, { priority: 'high' });

await sdk.subscribeToGeneration(project.id, (event) => {
  console.log(`Generation progress: ${event.progress}%`);
});
```

## API版本管理

### 版本策略

```typescript
// API版本配置
const API_VERSIONING = {
  strategy: 'path',  // 'path' | 'header' | 'query'

  // 当前活跃版本
  activeVersions: ['v1', 'v2'],

  // 弃用计划
  deprecation: {
    v1: {
      deprecatedAt: '2025-01-01',
      sunsetAt: '2026-01-01',
      migrationGuide: '/docs/migration/v1-to-v2',
    },
  },

  // 版本头
  headers: {
    supported: 'X-API-Version',
    deprecated: 'X-API-Deprecated',
    sunset: 'Sunset',
  },
};
```

### 响应头

```typescript
// API响应头
interface ResponseHeaders {
  // 标准头
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',

  // 请求追踪
  'X-Request-ID': string,
  'X-Correlation-ID': string,

  // 限流
  'X-RateLimit-Limit': number,
  'X-RateLimit-Remaining': number,
  'X-RateLimit-Reset': number,

  // 分页
  'X-Pagination-Total': number,
  'X-Pagination-Page': number,
  'X-Pagination-PageSize': number,

  // 版本
  'X-API-Version': string,
  'X-API-Deprecated'?: 'true',
  'Sunset'?: string,  // RFC 8594 弃用日期
}
```

## 配置示例

```yaml
# API配置
api:
  # 服务器配置
  server:
    host: "0.0.0.0"
    port: 3000
    timeout: "30s"

  # REST API
  rest:
    base_path: "/api/v1"
    compression: true
    cors:
      enabled: true
      origins: ["*"]
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
      headers: ["*"]

  # GraphQL
  graphql:
    enabled: true
    path: "/graphql"
    playground: true  # 仅开发环境
    introspection: true

  # WebSocket
  websocket:
    enabled: true
    path: "/ws"
    ping_interval: "30s"
    pong_timeout: "10s"

  # 限流
  rate_limit:
    enabled: true
    default:
      requests: 100
      window: "1m"
    authenticated:
      requests: 1000
      window: "1m"
    tier_limits:
      free:
        requests: 100
        window: "1m"
      pro:
        requests: 10000
        window: "1m"
      enterprise:
        requests: -1  # 无限制

  # 熔断器
  circuit_breaker:
    enabled: true
    failure_threshold: 5
    timeout: "60s"
    half_open_requests: 3

  # 缓存
  cache:
    enabled: true
    default_ttl: "5m"
    per_route_ttl:
      "/projects": "1m"
      "/health": "0"
```

---

**最后更新**: 2026-04-14
