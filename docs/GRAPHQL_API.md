# GraphQL API 设计

## 1. 概述

本文档描述 ProjectFactory 系统的 GraphQL API 设计，提供灵活的查询能力和实时订阅。

### 1.1 设计目标

| 目标 | 描述 |
|------|------|
| 灵活查询 | 客户端选择所需字段 |
| 实时订阅 | 支持 WebSocket 实时更新 |
| 类型安全 | 自动生成 TypeScript 类型 |
| 高效加载 | 避免 N+1 查询问题 |
| 版本控制 | 无需版本控制，渐进演进 |

### 1.2 GraphQL 架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GraphQL 架构                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        GraphQL Schema                                  │   │
│  │                                                                       │   │
│  │  type Query {         type Mutation {        type Subscription {    │   │
│  │    projects          →   createProject       →   projectUpdated     │   │
│  │    ideas               updateProject           ideaCreated          │   │
│  │    project(id:)        deleteProject           buildProgress         │   │
│  │  }                     startGeneration       }                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      GraphQL Resolvers                                │   │
│  │                                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │   │
│  │  │  Query      │  │  Mutation   │  │  Subscription│                  │   │
│  │  │  Resolver   │  │  Resolver   │  │  Resolver   │                  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Data Loader (N+1 优化)                           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Schema 设计

### 2.1 核心类型

```graphql
# src/graphql/schema/core.graphql

scalar DateTime
scalar JSON
scalar Upload

# 项目类型
enum ProjectType {
  WEB_APP
  CLI_TOOL
  LIBRARY
  API_SERVICE
  MOBILE_APP
  DATA_PIPELINE
}

enum ProjectStatus {
  PENDING
  QUEUED
  IN_PROGRESS
  GENERATING
  TESTING
  BUILDING
  REVIEWING
  COMPLETED
  FAILED
  ARCHIVED
}

# 项目
type Project {
  id: ID!
  name: String!
  description: String
  projectType: ProjectType!
  status: ProjectStatus!
  qualityScore: Float
  iterationCount: Int!

  # 所有者
  owner: User!

  # 阶段信息
  currentStage: GenerationStage
  progress: Float!

  # 文件
  files: [ProjectFile!]!
  fileCount: Int!

  # 指标
  metrics: ProjectMetrics

  # 时间
  createdAt: DateTime!
  updatedAt: DateTime!
  completedAt: DateTime

  # 元数据
  tags: [String!]!
  metadata: JSON
}

type ProjectMetrics {
  linesOfCode: Int!
  testCoverage: Float
  lintErrors: Int!
  buildTime: Int
  testTime: Int
}

# 项目文件
type ProjectFile {
  id: ID!
  path: String!
  name: String!
  extension: String!
  content: String
  size: Int!
  language: String!
  lastModified: DateTime!
}

# 生成阶段
type GenerationStage {
  name: String!
  status: StageStatus!
  startedAt: DateTime
  completedAt: DateTime
  progress: Float!
  logs: [StageLog!]!
}

type StageLog {
  timestamp: DateTime!
  level: LogLevel!
  message: String!
}

enum StageStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  SKIPPED
}

enum LogLevel {
  DEBUG
  INFO
  WARN
  ERROR
}

# Idea
type Idea {
  id: ID!
  title: String!
  description: String!
  content: String
  tags: [String!]!
  status: IdeaStatus!
  score: Float

  # 评估信息
  evaluation: IdeaEvaluation

  # 关联项目
  project: Project

  # 作者
  author: User!

  createdAt: DateTime!
  updatedAt: DateTime!
}

enum IdeaStatus {
  DRAFT
  EVALUATING
  APPROVED
  REJECTED
  IMPLEMENTED
}

type IdeaEvaluation {
  feasibility: Float!
  innovation: Float!
  businessValue: Float!
  technicalComplexity: Float!
  overallScore: Float!
  feedback: String
}

# 用户
type User {
  id: ID!
  email: String!
  name: String!
  avatar: String

  # 订阅信息
  subscription: Subscription

  # 资源使用
  usage: UserUsage!

  # 项目
  projects(limit: Int, offset: Int): ProjectConnection!

  # Ideas
  ideas(limit: Int, offset: Int): IdeaConnection!

  createdAt: DateTime!
}

type Subscription {
  tier: SubscriptionTier!
  status: SubscriptionStatus!
  currentPeriodEnd: DateTime!
  cancelAtPeriodEnd: Boolean!
}

enum SubscriptionTier {
  FREE
  STARTER
  PROFESSIONAL
  ENTERPRISE
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELED
  TRIALING
}

type UserUsage {
  projectsCreated: Int!
  projectsLimit: Int!
  storageUsedBytes: BigInt!
  storageLimitBytes: BigInt!
  apiCallsThisMonth: Int!
  apiCallsLimit: Int!
}

# 连接类型 (分页)
interface Connection {
  edges: [Edge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

interface Edge {
  node: Node!
  cursor: String!
}

interface Node {
  id: ID!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

type ProjectConnection implements Connection {
  edges: [ProjectEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type ProjectEdge implements Edge {
  node: Project!
  cursor: String!
}

type IdeaConnection implements Connection {
  edges: [IdeaEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type IdeaEdge implements Edge {
  node: Idea!
  cursor: String!
}
```

### 2.2 查询类型

```graphql
# src/graphql/schema/query.graphql

type Query {
  # 项目查询
  project(id: ID!): Project
  projects(
    filter: ProjectFilterInput
    sort: ProjectSortInput
    first: Int
    after: String
    last: Int
    before: String
  ): ProjectConnection!

  # 获取项目文件
  projectFiles(projectId: ID!, path: String): [ProjectFile!]!
  projectFile(projectId: ID!, path: String!): ProjectFile

  # Idea 查询
  idea(id: ID!): Idea
  ideas(
    filter: IdeaFilterInput
    sort: IdeaSortInput
    first: Int
    after: String
    last: Int
    before: String
  ): IdeaConnection!

  # 用户查询
  me: User!
  user(id: ID!): User

  # 搜索
  search(
    query: String!
    type: SearchType
    limit: Int
  ): SearchResultConnection!

  # 统计数据
  stats: Stats!

  # 健康检查
  health: HealthStatus!
}

input ProjectFilterInput {
  status: [ProjectStatus!]
  projectType: [ProjectType!]
  tags: [String!]
  qualityScoreMin: Float
  qualityScoreMax: Float
  createdAfter: DateTime
  createdBefore: DateTime
  search: String
}

input ProjectSortInput {
  field: ProjectSortField!
  direction: SortDirection!
}

enum ProjectSortField {
  CREATED_AT
  UPDATED_AT
  QUALITY_SCORE
  NAME
}

enum SortDirection {
  ASC
  DESC
}

input IdeaFilterInput {
  status: [IdeaStatus!]
  tags: [String!]
  minScore: Float
  authorId: ID
}

enum SearchType {
  PROJECT
  IDEA
  ALL
}

type Stats {
  totalProjects: Int!
  completedProjects: Int!
  activeProjects: Int!
  totalIdeas: Int!
  averageQualityScore: Float!
  totalLinesOfCode: BigInt!
  thisMonthProjects: Int!
  projectsTrend: [TrendPoint!]!
}

type TrendPoint {
  date: DateTime!
  value: Float!
}

type HealthStatus {
  status: HealthLevel!
  version: String!
  uptime: Float!
  dependencies: [DependencyHealth!]!
}

enum HealthLevel {
  HEALTHY
  DEGRADED
  UNHEALTHY
}

type DependencyHealth {
  name: String!
  status: HealthLevel!
  latencyMs: Int
  message: String
}
```

### 2.3 变更类型

```graphql
# src/graphql/schema/mutation.graphql

type Mutation {
  # 项目操作
  createProject(input: CreateProjectInput!): CreateProjectPayload!
  updateProject(id: ID!, input: UpdateProjectInput!): UpdateProjectPayload!
  deleteProject(id: ID!): DeleteProjectPayload!
  archiveProject(id: ID!): ArchiveProjectPayload!

  # 项目生成
  startGeneration(projectId: ID!): StartGenerationPayload!
  stopGeneration(projectId: ID!): StopGenerationPayload!

  # 文件操作
  createFile(projectId: ID!, input: CreateFileInput!): CreateFilePayload!
  updateFile(projectId: ID!, fileId: ID!, input: UpdateFileInput!): UpdateFilePayload!
  deleteFile(projectId: ID!, fileId: ID!): DeleteFilePayload!

  # Idea 操作
  createIdea(input: CreateIdeaInput!): CreateIdeaPayload!
  updateIdea(id: ID!, input: UpdateIdeaInput!): UpdateIdeaPayload!
  deleteIdea(id: ID!): DeleteIdeaPayload!
  evaluateIdea(id: ID!): EvaluateIdeaPayload!
  approveIdea(id: ID!): ApproveIdeaPayload!
  rejectIdea(id: ID!, reason: String!): RejectIdeaPayload!

  # 用户操作
  updateProfile(input: UpdateProfileInput!): UpdateProfilePayload!
  uploadAvatar(file: Upload!): UploadAvatarPayload!

  # 订阅操作
  createSubscription(input: CreateSubscriptionInput!): CreateSubscriptionPayload!
  cancelSubscription: CancelSubscriptionPayload!

  # Webhook 操作
  createWebhook(input: CreateWebhookInput!): CreateWebhookPayload!
  deleteWebhook(id: ID!): DeleteWebhookPayload!
}

# Input 类型
input CreateProjectInput {
  name: String!
  description: String
  projectType: ProjectType!
  tags: [String!]
  metadata: JSON
}

input UpdateProjectInput {
  name: String
  description: String
  tags: [String!]
  metadata: JSON
}

input CreateFileInput {
  path: String!
  content: String!
}

input UpdateFileInput {
  content: String
}

input CreateIdeaInput {
  title: String!
  description: String!
  content: String
  tags: [String!]
}

input UpdateIdeaInput {
  title: String
  description: String
  content: String
  tags: [String!]
}

input UpdateProfileInput {
  name: String
  avatar: Upload
}

input CreateSubscriptionInput {
  tier: SubscriptionTier!
  paymentMethodId: String!
}

input CreateWebhookInput {
  url: String!
  events: [WebhookEvent!]!
  secret: String
}

enum WebhookEvent {
  PROJECT_CREATED
  PROJECT_COMPLETED
  PROJECT_FAILED
  GENERATION_STAGE_COMPLETED
  IDEA_APPROVED
  IDEA_REJECTED
}

# Payload 类型
type CreateProjectPayload {
  project: Project!
  errors: [ValidationError!]
}

type UpdateProjectPayload {
  project: Project
  errors: [ValidationError!]
}

type DeleteProjectPayload {
  success: Boolean!
}

type ArchiveProjectPayload {
  project: Project!
}

type StartGenerationPayload {
  project: Project!
  generationId: ID!
}

type StopGenerationPayload {
  project: Project!
}

type CreateFilePayload {
  file: ProjectFile!
}

type UpdateFilePayload {
  file: ProjectFile!
}

type DeleteFilePayload {
  success: Boolean!
}

type CreateIdeaPayload {
  idea: Idea!
  errors: [ValidationError!]
}

type UpdateIdeaPayload {
  idea: Idea
  errors: [ValidationError!]
}

type DeleteIdeaPayload {
  success: Boolean!
}

type EvaluateIdeaPayload {
  idea: Idea!
}

type ApproveIdeaPayload {
  idea: Idea!
}

type RejectIdeaPayload {
  idea: Idea!
}

type UpdateProfilePayload {
  user: User!
}

type UploadAvatarPayload {
  user: User!
  avatarUrl: String!
}

type CreateSubscriptionPayload {
  subscription: Subscription!
}

type CancelSubscriptionPayload {
  subscription: Subscription!
}

type CreateWebhookPayload {
  webhook: Webhook!
}

type DeleteWebhookPayload {
  success: Boolean!
}

type ValidationError {
  field: String!
  message: String!
  code: String!
}

type Webhook {
  id: ID!
  url: String!
  events: [WebhookEvent!]!
  active: Boolean!
  createdAt: DateTime!
}
```

### 2.4 订阅类型

```graphql
# src/graphql/schema/subscription.graphql

type Subscription {
  # 项目更新
  projectUpdated(projectId: ID!): ProjectUpdateEvent!
  allProjectsUpdated: ProjectUpdateEvent!

  # 生成进度
  generationProgress(projectId: ID!): GenerationProgressEvent!

  # Idea 事件
  ideaCreated: IdeaCreatedEvent!
  ideaUpdated(ideaId: ID!): IdeaUpdateEvent!

  # 通知
  notification: NotificationEvent!

  # 系统状态
  systemStatus: SystemStatusEvent!
}

type ProjectUpdateEvent {
  type: ProjectUpdateType!
  project: Project!
  timestamp: DateTime!
}

enum ProjectUpdateType {
  CREATED
  STATUS_CHANGED
  QUALITY_UPDATED
  COMPLETED
  FAILED
  ARCHIVED
}

type GenerationProgressEvent {
  projectId: ID!
  stage: String!
  progress: Float!
  logs: [StageLog!]!
  estimatedTimeRemaining: Int
}

type IdeaCreatedEvent {
  idea: Idea!
}

type IdeaUpdateEvent {
  idea: Idea!
  changes: [FieldChange!]!
}

type FieldChange {
  field: String!
  oldValue: JSON
  newValue: JSON
}

type NotificationEvent {
  id: ID!
  type: NotificationType!
  title: String!
  message: String!
  data: JSON
  read: Boolean!
  createdAt: DateTime!
}

enum NotificationType {
  INFO
  SUCCESS
  WARNING
  ERROR
}

type SystemStatusEvent {
  status: HealthLevel!
  message: String
  affectedProjects: [ID!]
}
```

---

## 3. Resolver 实现

### 3.1 Resolver 结构

```typescript
// src/graphql/resolvers/index.ts
import { IResolvers } from '@graphql-tools/utils';

export const resolvers: IResolvers = {
  Query: {
    project: (_, { id }, { dataLoaders }) => dataLoaders.projects.load(id),
    projects: (_, args, { services }) => services.project.findMany(args),
    idea: (_, { id }, { dataLoaders }) => dataLoaders.ideas.load(id),
    ideas: (_, args, { services }) => services.idea.findMany(args),
    me: (_, __, { user }) => user,
    search: (_, { query, type, limit }, { services }) =>
      services.search.execute({ query, type, limit }),
    stats: (_, __, { services }) => services.stats.getGlobal(),
    health: (_, __, { services }) => services.health.check(),
  },

  Mutation: {
    createProject: (_, { input }, { services, user }) =>
      services.project.create(input, user),
    updateProject: (_, { id, input }, { services, user }) =>
      services.project.update(id, input, user),
    deleteProject: (_, { id }, { services, user }) =>
      services.project.delete(id, user),
    startGeneration: (_, { projectId }, { services, user }) =>
      services.project.startGeneration(projectId, user),
    stopGeneration: (_, { projectId }, { services, user }) =>
      services.project.stopGeneration(projectId, user),
    // ... other mutations
  },

  Subscription: {
    projectUpdated: {
      subscribe: (_, { projectId }, { pubsub }) =>
        projectId
          ? pubsub.asyncIterator(`project:${projectId}`)
          : pubsub.asyncIterator('projects'),
    },
    generationProgress: {
      subscribe: (_, { projectId }, { pubsub }) =>
        pubsub.asyncIterator(`generation:${projectId}`),
      resolve: (payload) => payload,
    },
  },

  Project: {
    owner: (project, _, { dataLoaders }) => dataLoaders.users.load(project.ownerId),
    files: (project, _, { services }) => services.project.getFiles(project.id),
    metrics: (project, _, { services }) => services.project.getMetrics(project.id),
    currentStage: (project, _, { services }) =>
      services.project.getCurrentStage(project.id),
  },

  Idea: {
    author: (idea, _, { dataLoaders }) => dataLoaders.users.load(idea.authorId),
    project: (idea, _, { dataLoaders }) =>
      idea.projectId ? dataLoaders.projects.load(idea.projectId) : null,
    evaluation: (idea, _, { services }) =>
      services.idea.getEvaluation(idea.id),
  },

  // 字段解析器
  ProjectConnection: {
    edges: (connection) => connection.edges,
    pageInfo: (connection) => connection.pageInfo,
    totalCount: (connection) => connection.totalCount,
  },

  ProjectEdge: {
    node: (edge) => edge.node,
    cursor: (edge) => edge.cursor,
  },
};
```

### 3.2 DataLoader 实现

```typescript
// src/graphql/dataloader.ts
import DataLoader from 'dataloader';
import { sql } from 'drizzle-orm';
import { db } from '../db';

class DataLoaders {
  projects: DataLoader<string, Project>;
  users: DataLoader<string, User>;
  ideas: DataLoader<string, Idea>;

  constructor() {
    this.projects = this.createProjectsLoader();
    this.users = this.createUsersLoader();
    this.ideas = this.createIdeasLoader();
  }

  private createProjectsLoader() {
    return new DataLoader<string, Project>(async (ids) => {
      const projects = await db.execute(sql`
        SELECT * FROM projects WHERE id IN (${ids.join(',')})
      `);

      // 确保返回顺序与输入 ids 一致
      const projectMap = new Map(projects.rows.map((p) => [p.id, p]));
      return ids.map((id) => projectMap.get(id) || null);
    });
  }

  private createUsersLoader() {
    return new DataLoader<string, User>(async (ids) => {
      const users = await db.execute(sql`
        SELECT * FROM users WHERE id IN (${ids.join(',')})
      `);

      const userMap = new Map(users.rows.map((u) => [u.id, u]));
      return ids.map((id) => userMap.get(id) || null);
    });
  }
}

export const dataLoaders = new DataLoaders();
```

---

## 4. 订阅实现

### 4.1 PubSub

```typescript
// src/graphql/pubsub.ts
import { PubSub } from 'graphql-subscriptions';

export const pubsub = new PubSub();

// 事件常量
export const EVENTS = {
  PROJECT: {
    UPDATED: 'PROJECT_UPDATED',
    CREATED: 'PROJECT_CREATED',
    DELETED: 'PROJECT_DELETED',
  },
  GENERATION: {
    PROGRESS: 'GENERATION_PROGRESS',
    STAGE_COMPLETED: 'GENERATION_STAGE_COMPLETED',
  },
  IDEA: {
    CREATED: 'IDEA_CREATED',
    UPDATED: 'IDEA_UPDATED',
    APPROVED: 'IDEA_APPROVED',
    REJECTED: 'IDEA_REJECTED',
  },
  NOTIFICATION: {
    NEW: 'NOTIFICATION_NEW',
  },
} as const;

// 发布项目更新
export async function publishProjectUpdate(
  projectId: string,
  type: ProjectUpdateType,
  project: Project
) {
  await pubsub.publish(`${EVENTS.PROJECT.UPDATED}:${projectId}`, {
    projectUpdated: {
      type,
      project,
      timestamp: new Date(),
    },
  });

  // 全局更新
  await pubsub.publish(EVENTS.PROJECT.UPDATED, {
    projectUpdated: {
      type,
      project,
      timestamp: new Date(),
    },
  });
}

// 发布生成进度
export async function publishGenerationProgress(
  projectId: string,
  progress: GenerationProgress
) {
  await pubsub.publish(`${EVENTS.GENERATION.PROGRESS}:${projectId}`, {
    generationProgress: progress,
  });
}
```

### 4.2 Subscription Resolver

```typescript
// src/graphql/resolvers/subscriptions.ts
import { pubsub, EVENTS } from '../pubsub';

const subscriptionResolvers = {
  Subscription: {
    projectUpdated: {
      subscribe: (_, { projectId }) => {
        if (projectId) {
          return pubsub.asyncIterator(`${EVENTS.PROJECT.UPDATED}:${projectId}`);
        }
        return pubsub.asyncIterator(EVENTS.PROJECT.UPDATED);
      },
    },

    generationProgress: {
      subscribe: (_, { projectId }) => {
        return pubsub.asyncIterator(`${EVENTS.GENERATION.PROGRESS}:${projectId}`);
      },
      resolve: (payload) => payload.generationProgress,
    },

    ideaCreated: {
      subscribe: (_, __, { user }) => {
        // 只订阅用户自己的 idea 或公开 idea
        return pubsub.asyncIterator(EVENTS.IDEA.CREATED);
      },
    },

    notification: {
      subscribe: (_, __, { user }) => {
        return pubsub.asyncIterator(`${EVENTS.NOTIFICATION.NEW}:${user.id}`);
      },
    },
  },
};
```

---

## 5. 错误处理

### 5.1 GraphQL 错误

```typescript
// src/graphql/errors.ts
import { GraphQLError } from 'graphql';

export class GraphQLValidationError extends GraphQLError {
  constructor(
    message: string,
    extensions: {
      code: 'VALIDATION_ERROR';
      field: string;
      errors: Array<{ field: string; message: string }>;
    }
  ) {
    super(message, {
      extensions,
    });
  }
}

export class GraphQLNotFoundError extends GraphQLError {
  constructor(resource: string, id: string) {
    super(`${resource} not found`, {
      extensions: {
        code: 'NOT_FOUND',
        resource,
        id,
      },
    });
  }
}

export class GraphQLForbiddenError extends GraphQLError {
  constructor(message: string = 'Access denied') {
    super(message, {
      extensions: {
        code: 'FORBIDDEN',
      },
    });
  }
}

export class GraphQLAuthenticationError extends GraphQLError {
  constructor(message: string = 'Authentication required') {
    super(message, {
      extensions: {
        code: 'UNAUTHENTICATED',
      },
    });
  }
}

export class GraphQLRateLimitError extends GraphQLError {
  constructor(retryAfter: number) {
    super('Rate limit exceeded', {
      extensions: {
        code: 'RATE_LIMITED',
        retryAfter,
      },
    });
  }
}
```

### 5.2 错误格式化

```typescript
// src/graphql/format-error.ts
import { GraphQLError } from 'graphql';

export function formatError(error: GraphQLError) {
  // 开发环境显示完整错误
  if (process.env.NODE_ENV === 'development') {
    return error;
  }

  // 生产环境隐藏内部细节
  if (error.originalError) {
    return {
      message: 'An error occurred',
      extensions: error.extensions,
    };
  }

  return error;
}

// 错误码映射
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
```

---

## 6. 相关文档

- [API 规格说明](./API_SPECIFICATION.md)
- [后端设计](./BACKEND_DESIGN.md)
- [前端设计](./FRONTEND_DESIGN.md)

---

**最后更新**: 2026-04-14
