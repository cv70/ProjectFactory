# 契约测试设计

## 1. 概述

本文档描述 ProjectFactory 系统的契约测试设计，确保微服务间接口的兼容性和一致性。

### 1.1 契约测试策略

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           契约测试层次                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  消费者驱动契约 (Consumer-Driven Contracts)                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   Consumer A          Provider X          Consumer B                 │   │
│  │   ┌─────────┐         ┌─────────┐         ┌─────────┐               │   │
│  │   │ 需要:   │ ──────▶ │ 提供:   │ ◀────── │ 需要:   │               │   │
│  │   │ id,     │         │ id,     │         │ id,     │               │   │
│  │   │ name,   │         │ name,   │         │ title,  │               │   │
│  │   │ status  │         │ status  │         │ status  │               │   │
│  │   └─────────┘         └─────────┘         └─────────┘               │   │
│  │        │                   │                   │                     │   │
│  │        ▼                   ▼                   ▼                     │   │
│  │   ┌─────────────────────────────────────────────────────┐           │   │
│  │   │              Pact Broker / Contract Store           │           │   │
│  │   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │           │   │
│  │   │  │ idea-service│  │project-svc  │  │ quality-svc │ │           │   │
│  │   │  │  contracts  │  │  contracts  │  │  contracts  │ │           │   │
│  │   │  └─────────────┘  └─────────────┘  └─────────────┘ │           │   │
│  │   └─────────────────────────────────────────────────────┘           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 消费者端测试

### 2.1 Pact 文件定义

```typescript
// consumer/idea-service/pacts/project-service.json
{
  "consumer": {
    "name": "idea-service"
  },
  "provider": {
    "name": "project-service"
  },
  "interactions": [
    {
      "description": "获取想法的所有项目",
      "request": {
        "method": "GET",
        "path": "/api/v1/ideas/:ideaId/projects",
        "headers": {
          "Accept": "application/json",
          "X-Request-ID": "(string)"
        },
        "pathMatchers": [
          {
            "match": "regex",
            "regex": "^[0-9a-f-]{36}$",
            "example": "550e8400-e29b-41d4-a716-446655440000"
          }
        ]
      },
      "response": {
        "status": 200,
        "headers": {
          "Content-Type": "application/json"
        },
        "body": {
          "projects": [
            {
              "id": "(string)",
              "name": "(string)",
              "status": "(string)",
              "createdAt": "(datetime ISO8601)"
            }
          ]
        },
        "bodyMatchers": {
          "$.projects": {
            "min": 0,
            "max": 100
          },
          "$.projects[*].id": {
            "match": "type"
          },
          "$.projects[*].status": {
            "match": "regex",
            "regex": "^(pending|in_progress|completed|failed)$"
          }
        }
      },
      "plugins": [
        {
          "name": "matches",
          "version": 1
        }
      ]
    },
    {
      "description": "创建新项目",
      "request": {
        "method": "POST",
        "path": "/api/v1/projects",
        "headers": {
          "Content-Type": "application/json"
        },
        "body": {
          "ideaId": "(string)",
          "name": "(string)",
          "type": "(string)"
        },
        "bodyMatchers": {
          "$.ideaId": {
            "match": "type"
          },
          "$.name": {
            "minLength": 1,
            "maxLength": 255
          }
        }
      },
      "response": {
        "status": 201,
        "body": {
          "id": "(string)",
          "ideaId": "(string)",
          "name": "(string)",
          "status": "pending",
          "createdAt": "(datetime)"
        }
      }
    }
  ],
  "metadata": {
    "pactSpecificationVersion": "3.0.0",
    "pact-js": {
      "version": "10.17.0"
    }
  }
}
```

### 2.2 消费者端测试代码

```typescript
// consumer/idea-service/__tests__/project-service.pact.test.ts
import { Pact } from '@pact-foundation/pact';
import { Matchers } from '@pact-foundation/pact/dsl/matchers';

const { like, eachLike, string, regex, integer } = Matchers;

const provider = new Pact({
  consumer: 'idea-service',
  provider: 'project-service',
  port: 1234,
  logLevel: 'warn',
});

describe('Project Service Consumer', () => {
  beforeAll(() => provider.setup());
  afterEach(() => provider.verify());
  afterAll(() => provider.finalize());

  describe('GET /api/v1/ideas/:ideaId/projects', () => {
    it('返回想法的所有项目', async () => {
      const ideaId = '550e8400-e29b-41d4-a716-446655440000';

      await provider.addInteraction({
        states: [
          {
            description: '想法存在且有三个项目',
            providersState: {
              ideaId,
              projectCount: 3,
            },
          },
        ],
        uponReceiving: '获取想法的所有项目',
        withRequest: {
          method: 'GET',
          path: `/api/v1/ideas/${ideaId}/projects`,
          headers: {
            Accept: 'application/json',
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            projects: eachLike({
              id: string('project-123'),
              name: string('My Project'),
              status: string('in_progress'),
              createdAt: regex({
                matcher: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
                example: '2026-04-14T10:30:00.000Z',
              }),
            }),
          },
        },
      });

      const projects = await projectServiceClient.getProjectsByIdea(ideaId);

      expect(projects).toHaveLength(3);
      expect(projects[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        status: expect.stringMatching(/^(pending|in_progress|completed|failed)$/),
      });
    });

    it('想法不存在时返回空列表', async () => {
      const nonExistentIdeaId = 'non-existent-id';

      await provider.addInteraction({
        states: [
          {
            description: '想法不存在',
            providersState: {
              ideaId: nonExistentIdeaId,
              exists: false,
            },
          },
        ],
        uponReceiving: '获取不存在的想法的项目',
        withRequest: {
          method: 'GET',
          path: `/api/v1/ideas/${nonExistentIdeaId}/projects`,
          headers: {
            Accept: 'application/json',
          },
        },
        willRespondWith: {
          status: 200,
          body: {
            projects: [],
          },
        },
      });

      const projects = await projectServiceClient.getProjectsByIdea(nonExistentIdeaId);
      expect(projects).toHaveLength(0);
    });
  });

  describe('POST /api/v1/projects', () => {
    it('成功创建项目', async () => {
      await provider.addInteraction({
        states: [
          {
            description: '想法存在',
            providersState: {
              ideaId: '550e8400-e29b-41d4-a716-446655440000',
              exists: true,
            },
          },
        ],
        uponReceiving: '创建新项目',
        withRequest: {
          method: 'POST',
          path: '/api/v1/projects',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            ideaId: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Test Project',
            type: 'web-app',
          },
        },
        willRespondWith: {
          status: 201,
          body: {
            id: string('new-project-id'),
            ideaId: '550e8400-e29b-41d4-a716-446655440000',
            name: string('Test Project'),
            status: string('pending'),
            createdAt: string('2026-04-14T10:30:00.000Z'),
          },
        },
      });

      const project = await projectServiceClient.createProject({
        ideaId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Project',
        type: 'web-app',
      });

      expect(project).toMatchObject({
        id: expect.any(String),
        name: 'Test Project',
        status: 'pending',
      });
    });
  });
});
```

---

## 3. 提供者端测试

### 3.1 提供者验证脚本

```typescript
// provider/project-service/__tests__/pact-verify.ts
import { Verifier } from '@pact-foundation/pact';
import * as path from 'path';

describe('Pact Verification', () => {
  let verifier: Verifier;

  beforeAll(() => {
    verifier = new Verifier({
      provider: 'project-service',
      providerBaseUrl: 'http://localhost:3002',
      pactBrokerUrl: process.env.PACT_BROKER_URL || 'http://localhost:8080',
      pactBrokerToken: process.env.PACT_BROKER_TOKEN,
      consumerVersionTag: ['main', 'prod'],
      publishVerificationResult: process.env.CI === 'true',
      providerVersion: process.env.GIT_SHA || '1.0.0',

      stateHandlers: {
        '想法存在且有三个项目': async ({ ideaId }) => {
          await db.projects.createMany({
            data: [
              { id: 'p1', ideaId, name: 'Project 1', status: 'in_progress' },
              { id: 'p2', ideaId, name: 'Project 2', status: 'pending' },
              { id: 'p3', ideaId, name: 'Project 3', status: 'completed' },
            ],
          });
        },
        '想法不存在': async ({ ideaId }) => {
          await db.projects.deleteMany({ where: { ideaId } });
        },
        '想法存在': async ({ ideaId }) => {
          await db.ideas.upsert({
            where: { id: ideaId },
            create: { id: ideaId, title: 'Test Idea' },
            update: {},
          });
        },
      },

      requestFilter: (req, res, next) => {
        // 添加测试请求头
        req.headers['X-Test-Request'] = 'true';
        next();
      },
    });
  });

  it('验证与 idea-service 的契约', async () => {
    await verifier.verifyProvider();
  });

  it('验证与 quality-service 的契约', async () => {
    const qualityVerifier = new Verifier({
      provider: 'project-service',
      providerBaseUrl: 'http://localhost:3002',
      pactFiles: [
        path.resolve(__dirname, '../../pacts/quality-service-project-service.json'),
      ],
    });

    await qualityVerifier.verifyProvider();
  });
});
```

### 3.2 状态管理

```typescript
// provider/project-service/src/pact/state-manager.ts
interface ProviderState {
  description: string;
  params: Record<string, any>;
}

class PactStateManager {
  private handlers: Map<string, (params: any) => Promise<void>> = new Map();

  register(description: string, handler: (params: any) => Promise<void>): void {
    this.handlers.set(description, handler);
  }

  async handle(state: ProviderState): Promise<void> {
    const handler = this.handlers.get(state.description);

    if (!handler) {
      console.warn(`No handler for state: ${state.description}`);
      return;
    }

    console.log(`Setting up state: ${state.description}`, state.params);

    try {
      await handler(state.params);
    } catch (error) {
      console.error(`Failed to setup state: ${state.description}`, error);
      throw error;
    }
  }
}

// 状态处理器注册
const stateManager = new PactStateManager();

stateManager.register('想法存在且有三个项目', async ({ ideaId, projectCount }) => {
  await db.transaction(async (trx) => {
    // 确保想法存在
    const idea = await trx.ideas.findUnique({ where: { id: ideaId } });
    if (!idea) {
      await trx.ideas.create({
        data: {
          id: ideaId,
          title: 'Test Idea',
          description: 'Created by pact test',
        },
      });
    }

    // 清理现有项目
    await trx.projects.deleteMany({ where: { ideaId } });

    // 创建指定数量的项目
    const projects = Array.from({ length: projectCount }, (_, i) => ({
      ideaId,
      name: `Project ${i + 1}`,
      status: ['in_progress', 'pending', 'completed'][i % 3],
    }));

    await trx.projects.createMany({ data: projects });
  });
});

stateManager.register('想法不存在', async ({ ideaId }) => {
  await db.projects.deleteMany({ where: { ideaId } });
  await db.ideas.deleteMany({ where: { id: ideaId } });
});

stateManager.register('想法存在', async ({ ideaId }) => {
  const exists = await db.ideas.findUnique({ where: { id: ideaId } });
  if (!exists) {
    await db.ideas.create({
      data: {
        id: ideaId,
        title: 'Existing Idea',
      },
    });
  }
});
```

---

## 4. 契约管理

### 4.1 Pact Broker 集成

```yaml
# ci/pact.yml
name: Pact Contract Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  contract_test:
    runs-on: ubuntu-latest
    services:
      pact_broker:
        image: pactfoundation/pact-broker:latest
        ports:
          - 8080:80
        environment:
          PACT_BROKER_DATABASE_URL: postgres://postgres:postgres@localhost:5432/pact_broker

      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: project_factory_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run consumer tests
        run: npm run test:pact:consumer
        env:
          PACT_BROKER_URL: http://localhost:8080
          PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}

      - name: Publish pacts
        run: npm run pact:publish
        env:
          PACT_BROKER_URL: http://localhost:8080
          PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}

      - name: Run provider verification
        run: npm run test:pact:provider
        env:
          PACT_BROKER_URL: http://localhost:8080
          PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}

      - name: Check contract compatibility
        run: npm run pact:can-i-deploy
        env:
          PACT_BROKER_URL: http://localhost:8080
          PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}
```

### 4.2 契约版本管理

```typescript
// scripts/pact-version.ts
import semver from 'semver';

interface ContractVersion {
  version: string;
  consumer: string;
  provider: string;
  createdAt: Date;
  contentHash: string;
}

class ContractVersionManager {
  async publishContract(
    consumer: string,
    provider: string,
    pactContent: any
  ): Promise<ContractVersion> {
    const contentHash = this.calculateHash(pactContent);
    const version = this.determineVersion(consumer, provider, contentHash);

    const contract: ContractVersion = {
      version,
      consumer,
      provider,
      createdAt: new Date(),
      contentHash,
    };

    await this.brokerStore.create(contract);
    await this.brokerStore.publishPact(consumer, provider, pactContent, version);

    console.log(`Published contract ${version} for ${consumer} -> ${provider}`);

    return contract;
  }

  private determineVersion(
    consumer: string,
    provider: string,
    contentHash: string
  ): string {
    // 获取当前最新版本
    const latest = await this.brokerStore.getLatestVersion(consumer, provider);

    if (!latest) {
      return '1.0.0'; // 首次发布
    }

    // 检查内容是否变化
    if (latest.contentHash === contentHash) {
      console.log('Contract content unchanged, skipping version bump');
      return latest.version;
    }

    // 有破坏性变更时 bump major
    if (this.hasBreakingChanges(latest.content, pactContent)) {
      return semver.inc(latest.version, 'major')!;
    }

    // 有新功能时 bump minor
    if (this.hasNewFeatures(latest.content, pactContent)) {
      return semver.inc(latest.version, 'minor')!;
    }

    // 修复问题时 bump patch
    return semver.inc(latest.version, 'patch')!;
  }

  private hasBreakingChanges(oldContent: any, newContent: any): boolean {
    const removedFields = this.findRemovedFields(oldContent.interactions, newContent.interactions);
    return removedFields.length > 0;
  }
}
```

---

## 5. 集成测试

### 5.1 端到端契约测试

```typescript
// e2e/contract.e2e.test.ts
import { test, expect } from '@playwright/test';

test.describe('Service Contract E2E', () => {
  test('完整的想法到项目流程', async ({ request }) => {
    // 1. Idea Service 创建想法
    const ideaResponse = await request.post('/api/v1/ideas', {
      data: {
        title: 'E2E Test Idea',
        description: 'Testing full flow',
      },
    });
    expect(ideaResponse.ok()).toBeTruthy();
    const idea = await ideaResponse.json();
    const ideaId = idea.id;

    // 2. Project Service 验证能获取到该想法的项目
    const projectsResponse = await request.get(`/api/v1/ideas/${ideaId}/projects`);
    expect(projectsResponse.ok()).toBeTruthy();
    const projectsData = await projectsResponse.json();
    expect(projectsData.projects).toBeDefined();

    // 3. Project Service 创建项目
    const createProjectResponse = await request.post('/api/v1/projects', {
      data: {
        ideaId,
        name: 'E2E Test Project',
        type: 'web-app',
      },
    });
    expect(createProjectResponse.status()).toBe(201);
    const project = await createProjectResponse.json();

    // 4. Idea Service 验证项目创建
    const updatedProjectsResponse = await request.get(`/api/v1/ideas/${ideaId}/projects`);
    const updatedProjects = await updatedProjectsResponse.json();
    expect(updatedProjects.projects.length).toBeGreaterThan(0);
    expect(updatedProjects.projects.some((p: any) => p.id === project.id)).toBeTruthy();

    // 5. Quality Service 验证能查询项目质量
    const qualityResponse = await request.get(`/api/v1/projects/${project.id}/quality`);
    expect(qualityResponse.ok()).toBeTruthy();
  });

  test('服务降级时的契约处理', async ({ request }) => {
    // 模拟 Project Service 不可用
    await simulateServiceDown('project-service');

    // Idea Service 应该优雅处理
    const response = await request.get('/api/v1/ideas/test-id/projects');

    // 应该返回 503 Service Unavailable 或者 空数据
    if (response.status() === 503) {
      const error = await response.json();
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    } else {
      // 或者返回空数据（降级策略）
      const data = await response.json();
      expect(data.projects).toEqual([]);
      expect(data.degraded).toBe(true);
    }

    // 恢复服务
    await simulateServiceUp('project-service');
  });
});
```

---

## 6. 相关文档

- [API 规格说明](./API_SPECIFICATION.md)
- [GraphQL API](./GRAPHQL_API.md)
- [微服务架构](./MICROSERVICES_ARCHITECTURE.md)
- [测试策略](./TESTING_STRATEGY.md)

---

**最后更新**: 2026-04-14
