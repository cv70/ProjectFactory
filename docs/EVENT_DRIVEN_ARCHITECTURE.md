# 事件驱动架构设计

## 1. 概述

本文档描述 ProjectFactory 系统的事件驱动架构，支持松耦合的微服务通信和异步处理。

### 1.1 设计目标

| 目标 | 描述 |
|------|------|
| 松耦合 | 服务间无直接依赖 |
| 异步处理 | 非阻塞式事件处理 |
| 最终一致 | 事件驱动数据同步 |
| 可追溯 | 完整事件日志 |
| 容错性 | 失败重试和补偿 |

### 1.2 事件架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         事件驱动架构                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  生产者                                                                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                         │
│  │ Project │  │  Idea   │  │  User   │  │ System  │                         │
│  │ Service │  │ Service │  │ Service │  │         │                         │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘                         │
│       │            │            │            │                               │
│       └────────────┴────────────┴────────────┘                               │
│                          ↓                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Event Bus (Redis Pub/Sub)                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                          ↓                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Event Router                                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│       ↓            ↓            ↓            ↓                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                         │
│  │ Project │  │Notifier │  │Analytics│  │ Audit   │                         │
│  │ Handler │  │ Handler │  │ Handler │  │ Handler │                         │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 事件模型

### 2.1 事件结构

```typescript
// src/events/types.ts
interface DomainEvent<T = unknown> {
  id: string;                    // 事件唯一 ID (UUID)
  type: string;                  // 事件类型
  version: number;               // 事件版本
  timestamp: number;            // 事件发生时间
  correlationId?: string;        // 关联 ID (用于追踪)
  causationId?: string;          // 因果 ID
  source: {
    service: string;            // 来源服务
    version: string;            // 服务版本
  };
  userId?: string;               // 操作用户
  tenantId?: string;             // 租户 ID
  payload: T;                   // 事件数据
  metadata?: Record<string, unknown>;
}

interface EventMetadata {
  partitionKey: string;          // 分区键
  retryCount: number;           // 重试次数
  maxRetries: number;           // 最大重试次数
  firstAttemptAt?: number;
  lastAttemptAt?: number;
}

// 事件类型枚举
enum EventType {
  // 项目事件
  PROJECT_CREATED = 'project.created',
  PROJECT_UPDATED = 'project.updated',
  PROJECT_DELETED = 'project.deleted',
  PROJECT_COMPLETED = 'project.completed',
  PROJECT_FAILED = 'project.failed',

  // 生成事件
  GENERATION_STARTED = 'generation.started',
  GENERATION_STAGE_CHANGED = 'generation.stage_changed',
  GENERATION_PROGRESS = 'generation.progress',
  GENERATION_COMPLETED = 'generation.completed',
  GENERATION_FAILED = 'generation.failed',

  // Idea 事件
  IDEA_CREATED = 'idea.created',
  IDEA_EVALUATED = 'idea.evaluated',
  IDEA_APPROVED = 'idea.approved',
  IDEA_REJECTED = 'idea.rejected',

  // 用户事件
  USER_SIGNED_UP = 'user.signed_up',
  USER_UPDATED = 'user.updated',
  USER_SUBSCRIPTION_CHANGED = 'user.subscription_changed',

  // 系统事件
  SYSTEM_HEALTH_CHANGED = 'system.health_changed',
  QUOTA_EXCEEDED = 'quota.exceeded',
}
```

### 2.2 事件示例

```typescript
// 项目创建事件
interface ProjectCreatedEvent {
  projectId: string;
  name: string;
  description: string;
  projectType: ProjectType;
  ownerId: string;
  tags: string[];
}

const projectCreatedEvent: DomainEvent<ProjectCreatedEvent> = {
  id: 'evt_123e4567-e89b-12d3-a456-426614174000',
  type: EventType.PROJECT_CREATED,
  version: 1,
  timestamp: Date.now(),
  correlationId: 'corr_123',
  source: {
    service: 'project-service',
    version: '1.0.0',
  },
  userId: 'user_123',
  tenantId: 'tenant_456',
  payload: {
    projectId: 'proj_789',
    name: 'My Awesome Project',
    description: 'A web application',
    projectType: 'WEB_APP',
    ownerId: 'user_123',
    tags: ['typescript', 'react'],
  },
};

// 生成阶段变更事件
interface GenerationStageChangedEvent {
  projectId: string;
  previousStage: string;
  currentStage: string;
  status: StageStatus;
  progress: number;
}
```

---

## 3. 事件总线

### 3.1 Event Bus 实现

```typescript
// src/events/bus.ts
import { Redis } from 'ioredis';
import { DomainEvent, EventType } from './types';

type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void>;

class EventBus {
  private redis: Redis;
  private handlers: Map<string, EventHandler[]> = new Map();
  private subscription: Redis | null = null;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  // 发布事件
  async publish<T>(event: DomainEvent<T>): Promise<void> {
    const channel = this.getChannelName(event.type);
    const message = JSON.stringify(event);

    // 持久化到 Redis List (用于事件溯源)
    await this.redis.lpush(`events:${event.type}`, message);

    // 发布到 Pub/Sub
    await this.redis.publish(channel, message);

    console.log(`Event published: ${event.type}`, { id: event.id });
  }

  // 订阅事件
  async subscribe<T>(
    eventType: EventType,
    handler: EventHandler<T>
  ): Promise<void> {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler as EventHandler);

    // 确保 Redis 订阅
    if (!this.subscription) {
      await this.ensureSubscription();
    }
  }

  // 订阅多个事件类型
  async subscribeMany(
    eventTypes: EventType[],
    handler: EventHandler
  ): Promise<void> {
    for (const eventType of eventTypes) {
      await this.subscribe(eventType, handler);
    }
  }

  // 内部订阅
  private async ensureSubscription(): Promise<void> {
    this.subscription = this.redis.duplicate();

    const channels = Array.from(this.handlers.keys());
    await this.subscription.subscribe(...channels);

    this.subscription.on('message', async (channel, message) => {
      const eventType = channel as EventType;
      const event = JSON.parse(message) as DomainEvent;

      const handlers = this.handlers.get(eventType) || [];
      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (error) {
          console.error(`Handler error for ${eventType}:`, error);
        }
      }
    });
  }

  private getChannelName(eventType: EventType): string {
    return `event:${eventType}`;
  }
}

export const eventBus = new EventBus(new Redis());
```

### 3.2 事件构建器

```typescript
// src/events/builder.ts
class EventBuilder {
  private event: Partial<DomainEvent>;

  constructor(type: string) {
    this.event = {
      id: crypto.randomUUID(),
      type,
      version: 1,
      timestamp: Date.now(),
    };
  }

  withCorrelationId(id: string): this {
    this.event.correlationId = id;
    return this;
  }

  withUser(userId: string, tenantId?: string): this {
    this.event.userId = userId;
    this.event.tenantId = tenantId;
    return this;
  }

  withSource(service: string, version: string): this {
    this.event.source = { service, version };
    return this;
  }

  withPayload<T>(payload: T): this {
    this.event.payload = payload;
    return this;
  }

  withMetadata(metadata: Record<string, unknown>): this {
    this.event.metadata = metadata;
    return this;
  }

  build<T = unknown>(): DomainEvent<T> {
    return this.event as DomainEvent<T>;
  }
}

// 创建事件的快捷方法
export function createEvent<T>(
  type: EventType,
  payload: T,
  context: {
    userId?: string;
    tenantId?: string;
    correlationId?: string;
  }
): DomainEvent<T> {
  return new EventBuilder(type)
    .withSource('project-factory', process.env.APP_VERSION || '1.0.0')
    .withUser(context.userId || '', context.tenantId)
    .withCorrelationId(context.correlationId || crypto.randomUUID())
    .withPayload(payload)
    .build<T>();
}
```

---

## 4. 事件处理器

### 4.1 处理器基类

```typescript
// src/events/handler.ts
interface HandlerOptions {
  retryCount?: number;
  retryDelay?: number;
  deadLetterQueue?: string;
}

abstract class BaseEventHandler<T = unknown> {
  abstract readonly eventType: EventType;
  protected options: HandlerOptions;

  constructor(options: HandlerOptions = {}) {
    this.options = {
      retryCount: options.retryCount ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      deadLetterQueue: options.deadLetterQueue ?? 'events:dead-letter',
    };
  }

  async handle(event: DomainEvent<T>): Promise<void> {
    console.log(`Handling event: ${event.type}`, { id: event.id });

    try {
      await this.process(event);
    } catch (error) {
      await this.handleError(event, error as Error);
    }
  }

  protected abstract process(event: DomainEvent<T>): Promise<void>;

  protected async handleError(
    event: DomainEvent,
    error: Error
  ): Promise<void> {
    const retryCount = (event.metadata?.retryCount as number) || 0;

    if (retryCount < this.options.retryCount!) {
      // 重试
      console.log(`Retrying event ${event.id}, attempt ${retryCount + 1}`);

      await this.delay(this.options.retryDelay! * Math.pow(2, retryCount));

      // 重新发布带重试计数的事件
      await eventBus.publish({
        ...event,
        metadata: {
          ...event.metadata,
          retryCount: retryCount + 1,
          lastError: error.message,
        },
      });
    } else {
      // 发送到死信队列
      console.error(`Event ${event.id} failed after ${retryCount} retries`);
      await this.sendToDeadLetter(event, error);
    }
  }

  protected async sendToDeadLetter(
    event: DomainEvent,
    error: Error
  ): Promise<void> {
    await redis.lpush(this.options.deadLetterQueue!, JSON.stringify({
      event,
      error: {
        message: error.message,
        stack: error.stack,
      },
      failedAt: Date.now(),
    }));
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### 4.2 具体处理器

```typescript
// src/events/handlers/project-handlers.ts

// 项目创建处理器
class ProjectCreatedHandler extends BaseEventHandler<ProjectCreatedEvent> {
  readonly eventType = EventType.PROJECT_CREATED;

  protected async process(event: DomainEvent<ProjectCreatedEvent>): Promise<void> {
    const { projectId, ownerId } = event.payload;

    // 1. 创建初始文件结构
    await projectService.createDefaultStructure(projectId);

    // 2. 更新用户统计
    await userService.incrementProjectCount(ownerId);

    // 3. 发送欢迎通知
    await notificationService.sendWelcomeEmail(ownerId, projectId);

    // 4. 记录分析事件
    await analyticsService.track('project_created', {
      projectId,
      projectType: event.payload.projectType,
      userId: ownerId,
    });
  }
}

// 生成完成处理器
class GenerationCompletedHandler extends BaseEventHandler<GenerationCompletedEvent> {
  readonly eventType = EventType.GENERATION_COMPLETED;

  protected async process(event: DomainEvent<GenerationCompletedEvent>): Promise<void> {
    const { projectId, qualityScore, duration } = event.payload;

    // 1. 更新项目状态
    await projectService.markCompleted(projectId);

    // 2. 更新质量指标
    await metricsService.recordQualityScore(projectId, qualityScore);

    // 3. 触发质量检查
    if (qualityScore < 70) {
      await projectService.requestReview(projectId);
    }

    // 4. 发送完成通知
    await notificationService.sendCompletionNotice(projectId, {
      qualityScore,
      duration,
    });

    // 5. 更新分析数据
    await analyticsService.track('generation_completed', {
      projectId,
      qualityScore,
      duration,
    });
  }
}

// Idea 评估通过处理器
class IdeaApprovedHandler extends BaseEventHandler<IdeaApprovedEvent> {
  readonly eventType = EventType.IDEA_APPROVED;

  protected async process(event: DomainEvent<IdeaApprovedEvent>): Promise<void> {
    const { ideaId, approvedBy } = event.payload;

    // 1. 更新 Idea 状态
    await ideaService.updateStatus(ideaId, 'approved');

    // 2. 创建关联项目 (如果需要)
    const idea = await ideaService.getById(ideaId);
    if (idea.autoCreateProject) {
      await projectService.createFromIdea(idea);
    }

    // 3. 发送通知给作者
    await notificationService.notify(idea.authorId, {
      type: 'idea_approved',
      title: 'Your idea was approved!',
      ideaId,
    });

    // 4. 触发 Webhook
    await webhookService.dispatch('idea.approved', {
      ideaId,
      approvedBy,
      timestamp: Date.now(),
    });
  }
}
```

---

## 5. Saga 模式

### 5.1 Saga 定义

```typescript
// src/events/saga.ts
interface SagaState {
  id: string;
  type: string;
  status: 'running' | 'completed' | 'failed' | 'compensating';
  currentStep: number;
  steps: SagaStep[];
  context: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

interface SagaStep {
  name: string;
  execute: () => Promise<void>;
  compensate: () => Promise<void>;
  onError?: (error: Error) => Promise<void>;
}

class SagaOrchestrator {
  async execute<T>(saga: {
    id: string;
    type: string;
    steps: SagaStep[];
    context: T;
  }): Promise<SagaState> {
    const state: SagaState = {
      id: saga.id,
      type: saga.type,
      status: 'running',
      currentStep: 0,
      steps: saga.steps,
      context: saga.context as Record<string, unknown>,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 保存初始状态
    await this.saveState(state);

    // 执行步骤
    for (let i = 0; i < saga.steps.length; i++) {
      state.currentStep = i;
      state.updatedAt = Date.now();
      await this.saveState(state);

      try {
        await saga.steps[i].execute();
        console.log(`Saga ${saga.id}: Step ${i} (${saga.steps[i].name}) completed`);
      } catch (error) {
        console.error(`Saga ${saga.id}: Step ${i} failed`, error);

        // 执行补偿
        await this.compensate(state, i);

        state.status = 'failed';
        state.updatedAt = Date.now();
        await this.saveState(state);

        throw error;
      }
    }

    state.status = 'completed';
    state.completedAt = Date.now();
    state.updatedAt = Date.now();
    await this.saveState(state);

    return state;
  }

  private async compensate(state: SagaState, failedStep: number): Promise<void> {
    state.status = 'compensating';
    await this.saveState(state);

    // 从失败的步骤开始逆向补偿
    for (let i = failedStep - 1; i >= 0; i--) {
      try {
        await state.steps[i].compensate();
        console.log(`Saga ${state.id}: Compensated step ${i}`);
      } catch (error) {
        console.error(`Saga ${state.id}: Compensation failed for step ${i}`, error);
        // 记录补偿失败，继续其他补偿
      }
    }
  }

  private async saveState(state: SagaState): Promise<void> {
    await redis.set(`saga:${state.id}`, JSON.stringify(state));
  }
}

export const sagaOrchestrator = new SagaOrchestrator();
```

### 5.2 项目生成 Saga

```typescript
// src/events/sagas/project-generation-saga.ts

// 项目生成 Saga
async function runProjectGenerationSaga(
  projectId: string,
  userId: string,
  ideaId?: string
) {
  const sagaId = `saga:project:${projectId}:${Date.now()}`;

  const steps: SagaStep[] = [
    // 步骤 1: 生成代码
    {
      name: 'generate-code',
      execute: async () => {
        await projectService.generateCode(projectId);
      },
      compensate: async () => {
        await projectService.cleanupGeneratedFiles(projectId);
      },
    },

    // 步骤 2: 运行测试
    {
      name: 'run-tests',
      execute: async () => {
        await projectService.runTests(projectId);
      },
      compensate: async () => {
        // 测试失败难以补偿，仅记录
        console.log('Test compensation not possible');
      },
    },

    // 步骤 3: 执行 Lint
    {
      name: 'run-lint',
      execute: async () => {
        await projectService.runLint(projectId);
      },
      compensate: async () => {
        await projectService.fixLintErrors(projectId);
      },
    },

    // 步骤 4: 质量评估
    {
      name: 'quality-check',
      execute: async () => {
        const score = await projectService.calculateQualityScore(projectId);
        if (score < 70) {
          throw new Error(`Quality score ${score} below threshold`);
        }
      },
      compensate: async () => {
        // 质量分数难以补偿
      },
    },

    // 步骤 5: Git 提交
    {
      name: 'git-commit',
      execute: async () => {
        await gitService.commit(projectId, {
          message: `Generated by ProjectFactory: ${projectId}`,
          author: userId,
        });
      },
      compensate: async () => {
        await gitService.rollback(projectId);
      },
    },
  ];

  return sagaOrchestrator.execute({
    id: sagaId,
    type: 'project-generation',
    steps,
    context: { projectId, userId, ideaId },
  });
}
```

---

## 6. 事件溯源

### 6.1 事件存储

```typescript
// src/events/store.ts
interface EventStore {
  save(event: DomainEvent): Promise<void>;
  getById(id: string): Promise<DomainEvent | null>;
  getByType(type: EventType, options?: { limit?: number; offset?: number }): Promise<DomainEvent[]>;
  getByCorrelationId(correlationId: string): Promise<DomainEvent[]>;
  getByAggregateId(aggregateId: string): Promise<DomainEvent[]>;
}

class RedisEventStore implements EventStore {
  constructor(private redis: Redis) {}

  async save(event: DomainEvent): Promise<void> {
    const key = `event:${event.id}`;
    await this.redis.set(key, JSON.stringify(event));

    // 按类型索引
    await this.redis.zadd(
      `events:by-type:${event.type}`,
      event.timestamp,
      event.id
    );

    // 按聚合 ID 索引
    if (event.payload && typeof event.payload === 'object' && 'id' in event.payload) {
      const aggregateId = (event.payload as any).id;
      await this.redis.zadd(
        `events:by-aggregate:${aggregateId}`,
        event.timestamp,
        event.id
      );
    }

    // 按相关性索引
    if (event.correlationId) {
      await this.redis.zadd(
        `events:by-correlation:${event.correlationId}`,
        event.timestamp,
        event.id
      );
    }
  }

  async getById(id: string): Promise<DomainEvent | null> {
    const data = await this.redis.get(`event:${id}`);
    return data ? JSON.parse(data) : null;
  }

  async getByType(
    type: EventType,
    options?: { limit?: number; offset?: number }
  ): Promise<DomainEvent[]> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const ids = await this.redis.zrange(
      `events:by-type:${type}`,
      offset,
      offset + limit - 1
    );

    return this.getByIds(ids);
  }

  async getByCorrelationId(correlationId: string): Promise<DomainEvent[]> {
    const ids = await this.redis.zrange(
      `events:by-correlation:${correlationId}`,
      0,
      -1
    );

    return this.getByIds(ids);
  }

  private async getByIds(ids: string[]): Promise<DomainEvent[]> {
    if (ids.length === 0) return [];

    const events = await Promise.all(
      ids.map((id) => this.redis.get(`event:${id}`))
    );

    return events.filter(Boolean).map((e) => JSON.parse(e));
  }
}
```

### 6.2 投影重建

```typescript
// src/events/projections.ts

// 项目投影
class ProjectProjection {
  private projection: Map<string, ProjectState> = new Map();

  async rebuild(): Promise<void> {
    console.log('Rebuilding project projection...');

    const events = await eventStore.getByType(EventType.PROJECT_CREATED);
    const updatedEvents = await eventStore.getByType(EventType.PROJECT_UPDATED);

    // 按时间顺序处理
    const allEvents = [...events, ...updatedEvents].sort(
      (a, b) => a.timestamp - b.timestamp
    );

    for (const event of allEvents) {
      await this.apply(event);
    }

    console.log(`Projection rebuilt: ${this.projection.size} projects`);
  }

  private async apply(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case EventType.PROJECT_CREATED:
        this.applyCreated(event.payload as ProjectCreatedEvent);
        break;
      case EventType.PROJECT_UPDATED:
        this.applyUpdated(event.payload as ProjectUpdatedEvent);
        break;
      case EventType.PROJECT_COMPLETED:
        this.applyCompleted(event.payload as ProjectCompletedEvent);
        break;
      case EventType.PROJECT_DELETED:
        this.applyDeleted(event.payload as ProjectDeletedEvent);
        break;
    }
  }

  private applyCreated(payload: ProjectCreatedEvent): void {
    this.projection.set(payload.projectId, {
      id: payload.projectId,
      name: payload.name,
      description: payload.description,
      status: 'created',
      createdAt: Date.now(),
    });
  }

  private applyUpdated(payload: ProjectUpdatedEvent): void {
    const project = this.projection.get(payload.projectId);
    if (project) {
      Object.assign(project, payload.changes);
    }
  }

  getById(projectId: string): ProjectState | undefined {
    return this.projection.get(projectId);
  }
}
```

---

## 7. 相关文档

- [后端设计](./BACKEND_DESIGN.md)
- [微服务架构](./MICROSERVICES.md)
- [可观测性设计](./OBSERVABILITY.md)

---

**最后更新**: 2026-04-14
