# Testing Infrastructure

## 1. 概述

本文档定义 ProjectFactory 系统的测试基础设施（Testing Infrastructure），确保系统各组件的高质量交付和可靠运行。

### 1.1 测试架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         测试基础设施架构                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        测试执行层                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  单元测试   │  │  集成测试   │  │  E2E 测试   │              │   │
│  │  │  Vitest    │  │  Supertest  │  │   Playwright │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  契约测试   │  │  性能测试   │  │  安全测试   │              │   │
│  │  │   Pact     │  │ k6/Artillery │  │  OWASP ZAP  │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────┼─────────────────────────────────┐   │
│  │                           测试数据层                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  Fixtures   │  │  Mock 数据   │  │ Factories    │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  Test DB    │  │  Seed Data   │  │  Test Utils  │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────┼─────────────────────────────────┐   │
│  │                           报告层                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  Coverage   │  │  Test Report │  │  CI/CD      │              │   │
│  │  │  Istanbul   │  │   Allure     │  │  Integration │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 单元测试框架

### 2.1 测试配置

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  test: {
    // 测试环境
    environment: 'node',

    // 全局测试 API
    globals: true,

    // 测试文件匹配
    include: [
      'tests/unit/**/*.test.ts',
      'tests/unit/**/*.test.tsx',
      'tests/unit/**/*.spec.ts',
      'tests/unit/**/*.spec.tsx'
    ],

    // 排除的文件
    exclude: [
      'node_modules',
      'dist',
      '**/*.d.ts'
    ],

    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.d.ts',
        '*.config.ts',
        'dist/**'
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80
      }
    },

    // 测试超时
    testTimeout: 10000,

    // 重试失败测试
    retry: process.env.CI ? 2 : 0,

    // 并行执行
    parallel: true,

    // 报告器
    reporters: ['default', 'html'],

    // setup 文件
    setupFiles: ['./tests/setup.ts']
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

### 2.2 单元测试最佳实践

```typescript
// tests/setup.ts
import { vi } from 'vitest';

// Mock 环境变量
process.env.LLM_API_KEY = 'test-api-key';
process.env.NODE_ENV = 'test';

// Mock LLM 服务
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue({
      content: 'Mocked LLM response'
    }),
    withStructuredOutput: vi.fn().mockReturnThis()
  }))
}));

// Mock 数据库
vi.mock('@/infra/database', () => ({
  database: {
    query: vi.fn().mockResolvedValue([]),
    queryOne: vi.fn().mockResolvedValue(null),
    insert: vi.fn().mockResolvedValue(1),
    update: vi.fn().mockResolvedValue(1)
  }
}));

// 全局 teardown
afterAll(() => {
  vi.clearAllMocks();
});
```

### 2.3 Agent 单元测试

```typescript
// tests/unit/agents/idea-generator.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IdeaGeneratorAgent } from '@/agents/idea-generator';
import { MockExecutionContext } from '../mocks';

describe('IdeaGeneratorAgent', () => {
  let agent: IdeaGeneratorAgent;
  let mockContext: MockExecutionContext;

  beforeEach(() => {
    agent = new IdeaGeneratorAgent({
      model: 'gpt-4',
      temperature: 0.7
    });

    mockContext = new MockExecutionContext();
  });

  describe('generate', () => {
    it('should generate ideas based on domain context', async () => {
      const result = await agent.generate(
        {
          domain: 'web-development',
          count: 5,
          constraints: ['must use TypeScript', 'must be scalable']
        },
        mockContext
      );

      expect(result.ideas).toHaveLength(5);
      expect(result.ideas[0]).toMatchObject({
        title: expect.any(String),
        description: expect.any(String),
        feasibility: expect.any(Number)
      });
    });

    it('should respect count parameter', async () => {
      const result = await agent.generate(
        { domain: 'cli-tools', count: 3 },
        mockContext
      );

      expect(result.ideas).toHaveLength(3);
    });

    it('should validate generated ideas', async () => {
      const result = await agent.generate(
        { domain: 'api-development' },
        mockContext
      );

      for (const idea of result.ideas) {
        expect(idea.title).toBeDefined();
        expect(idea.title.length).toBeGreaterThan(0);
        expect(idea.feasibility).toBeGreaterThanOrEqual(0);
        expect(idea.feasibility).toBeLessThanOrEqual(1);
      }
    });

    it('should handle LLM errors gracefully', async () => {
      // Mock LLM to throw error
      mockContext.llm.invoke = vi.fn().mockRejectedValue(
        new Error('LLM service unavailable')
      );

      await expect(
        agent.generate({ domain: 'test' }, mockContext)
      ).rejects.toThrow('Failed to generate ideas');
    });
  });

  describe('evaluate', () => {
    it('should evaluate idea feasibility', async () => {
      const idea = {
        id: '1',
        title: 'Test Idea',
        description: 'A test project idea',
        domain: 'web-development'
      };

      const result = await agent.evaluate(idea, mockContext);

      expect(result).toMatchObject({
        feasibility: expect.any(Number),
        strengths: expect.any(Array),
        weaknesses: expect.any(Array),
        recommendations: expect.any(Array)
      });
    });
  });
});
```

### 2.4 服务层测试

```typescript
// tests/unit/services/project-service.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectService } from '@/services/project-service';
import { ProjectRepository } from '@/repositories/project-repository';
import { EventEmitter } from 'events';

describe('ProjectService', () => {
  let service: ProjectService;
  let mockRepo: ProjectRepository;
  let eventEmitter: EventEmitter;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    } as unknown as ProjectRepository;

    eventEmitter = new EventEmitter();
    service = new ProjectService(mockRepo, eventEmitter);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createProject', () => {
    it('should create a new project with generated ID', async () => {
      const input = {
        name: 'test-project',
        type: 'web-app' as const,
        description: 'A test project'
      };

      mockRepo.create.mockResolvedValue({
        id: 'proj-123',
        ...input,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await service.createProject(input);

      expect(result.id).toBe('proj-123');
      expect(result.name).toBe(input.name);
      expect(mockRepo.create).toHaveBeenCalledWith(input);
    });

    it('should emit project:created event', async () => {
      const eventPromise = new Promise((resolve) => {
        eventEmitter.once('project:created', resolve);
      });

      mockRepo.create.mockResolvedValue({
        id: 'proj-123',
        name: 'test',
        status: 'pending'
      } as any);

      await service.createProject({ name: 'test', type: 'web-app' });
      const emitted = await eventPromise;

      expect(emitted).toHaveProperty('projectId', 'proj-123');
    });

    it('should reject invalid project type', async () => {
      await expect(
        service.createProject({
          name: 'test',
          type: 'invalid-type' as any
        })
      ).rejects.toThrow('Invalid project type');
    });
  });

  describe('updateProject', () => {
    it('should update existing project', async () => {
      const existing = {
        id: 'proj-123',
        name: 'original',
        status: 'pending'
      };

      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue({
        ...existing,
        name: 'updated'
      });

      const result = await service.updateProject('proj-123', { name: 'updated' });

      expect(result.name).toBe('updated');
      expect(mockRepo.update).toHaveBeenCalledWith('proj-123', { name: 'updated' });
    });

    it('should throw error for non-existent project', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        service.updateProject('non-existent', { name: 'test' })
      ).rejects.toThrow('Project not found');
    });
  });
});
```

---

## 3. 集成测试

### 3.1 API 集成测试

```typescript
// tests/integration/api/projects.test.ts
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { createTestDb, cleanTestDb, seedTestData } from '../helpers';

describe('Projects API', () => {
  beforeAll(async () => {
    await createTestDb();
    await seedTestData();
  });

  afterAll(async () => {
    await cleanTestDb();
  });

  describe('GET /api/v1/projects', () => {
    it('should return paginated projects', async () => {
      const response = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', 'Bearer test-token')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        data: expect.any(Array),
        meta: {
          page: 1,
          limit: 10,
          total: expect.any(Number)
        }
      });
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/v1/projects')
        .query({ status: 'completed' });

      expect(response.status).toBe(200);
      expect(response.body.data.every(
        (p: any) => p.status === 'completed'
      )).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/projects');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/projects', () => {
    it('should create a new project', async () => {
      const newProject = {
        name: 'new-test-project',
        type: 'web-app',
        description: 'A new test project'
      };

      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', 'Bearer test-token')
        .send(newProject);

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        id: expect.any(String),
        name: newProject.name,
        type: newProject.type
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', 'Bearer test-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({ field: 'name' })
      );
    });
  });

  describe('GET /api/v1/projects/:id', () => {
    it('should return project by ID', async () => {
      const response = await request(app)
        .get('/api/v1/projects/proj-123')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('proj-123');
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .get('/api/v1/projects/non-existent')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
    });
  });
});
```

### 3.2 工作流集成测试

```typescript
// tests/integration/workflows/generation.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkflowOrchestrator } from '@/orchestration/orchestrator';
import { createMockAgent, MockLLMService } from '../mocks';

describe('Generation Workflow', () => {
  let orchestrator: WorkflowOrchestrator;
  let mockLLM: MockLLMService;

  beforeEach(() => {
    mockLLM = new MockLLMService();
    orchestrator = new WorkflowOrchestrator({
      llm: mockLLM,
      maxRetries: 3,
      timeout: 60000
    });
  });

  afterEach(() => {
    orchestrator.stop();
  });

  it('should execute full generation workflow', async () => {
    const project = await orchestrator.startGeneration({
      idea: {
        title: 'Test Project',
        description: 'A test project for integration testing'
      },
      config: {
        generateTests: true,
        generateDocs: true
      }
    });

    expect(project).toMatchObject({
      id: expect.any(String),
      status: expect.stringMatching(/completed|failed/),
      artifacts: expect.any(Object)
    });

    if (project.status === 'completed') {
      expect(project.artifacts.code).toBeDefined();
      expect(project.artifacts.tests).toBeDefined();
    }
  });

  it('should handle agent failures gracefully', async () => {
    // Mock architect agent to fail
    mockLLM.setFailure('architect', new Error('Architect failed'));

    const project = await orchestrator.startGeneration({
      idea: { title: 'Test' }
    });

    expect(project.status).toBe('failed');
    expect(project.errors).toContainEqual(
      expect.objectContaining({ agent: 'architect' })
    );
  });

  it('should support cancellation', async () => {
    const projectPromise = orchestrator.startGeneration({
      idea: { title: 'Long Running Project' }
    });

    // Cancel after a short delay
    setTimeout(() => orchestrator.cancel(projectPromise.id), 100);

    const project = await projectPromise;

    expect(project.status).toBe('cancelled');
  });

  it('should emit progress events', async () => {
    const progressEvents: any[] = [];

    orchestrator.on('progress', (event) => {
      progressEvents.push(event);
    });

    await orchestrator.startGeneration({
      idea: { title: 'Test Project' }
    });

    expect(progressEvents).toContainEqual(
      expect.objectContaining({ stage: 'idea-analysis' })
    );
    expect(progressEvents).toContainEqual(
      expect.objectContaining({ stage: 'architecture-design' })
    );
  });
});
```

---

## 4. 端到端测试

### 4.1 E2E 测试配置

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-results.json' }]
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  projects: [
    // Chromium
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },

    // Firefox
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },

    // WebKit
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },

    // Mobile
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] }
    }
  ],

  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
```

### 4.2 E2E 测试用例

```typescript
// tests/e2e/project-creation.spec.ts
import { test, expect } from '@playwright/test';
import { generateTestIdea } from '../helpers';

test.describe('Project Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should create a new project from idea', async ({ page }) => {
    // 导航到创建页面
    await page.click('text=New Project');

    // 输入想法
    const idea = generateTestIdea();
    await page.fill('[name="title"]', idea.title);
    await page.fill('[name="description"]', idea.description);

    // 选择项目类型
    await page.selectOption('[name="type"]', 'web-app');

    // 提交
    await page.click('text=Generate Project');

    // 等待生成完成
    await expect(page.locator('.progress-bar')).toBeVisible();

    // 验证项目创建成功
    await expect(page.locator('.project-card')).toBeVisible({
      timeout: 300000 // 5 分钟超时
    });

    // 验证项目详情
    await expect(page.locator('.project-title')).toHaveText(idea.title);
  });

  test('should track project generation progress', async ({ page }) => {
    await page.goto('/projects/new');
    await page.fill('[name="title"]', 'Complex Web App');

    await page.click('text=Generate');

    // 验证进度更新
    const stages = ['Analysis', 'Architecture', 'Code Generation', 'Testing'];

    for (const stage of stages) {
      await expect(page.locator(`text=${stage}`)).toHaveClass(/active|completed/);
    }
  });

  test('should handle generation errors', async ({ page }) => {
    await page.goto('/projects/new');
    await page.fill('[name="title"]', 'Intentional Error Test');

    await page.click('text=Generate');

    // 等待错误显示
    await expect(page.locator('.error-message')).toBeVisible({
      timeout: 60000
    });

    // 验证错误信息
    await expect(page.locator('.error-message')).toContainText('generation failed');
  });
});

test.describe('Dashboard', () => {
  test('should display project statistics', async ({ page }) => {
    await page.goto('/dashboard');

    // 验证统计数据
    await expect(page.locator('[data-testid="total-projects"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-projects"]')).toBeVisible();
    await expect(page.locator('[data-testid="completed-projects"]')).toBeVisible();
  });

  test('should filter projects by status', async ({ page }) => {
    await page.goto('/dashboard');

    // 点击过滤选项
    await page.click('text=Completed');

    // 验证过滤结果
    const projectCards = page.locator('.project-card');
    const count = await projectCards.count();

    for (let i = 0; i < count; i++) {
      await expect(projectCards.nth(i)).toHaveAttribute('data-status', 'completed');
    }
  });
});
```

---

## 5. 契约测试

### 5.1 消费者契约

```typescript
// tests/contracts/consumer-idea-service.pact.ts
import { Pact } from '@pact-foundation/pact';
import path from 'path';

const provider = new Pact({
  consumer: 'frontend-app',
  provider: 'idea-service',
  dir: path.resolve(__dirname, '../../pacts'),
  logLevel: 'warn'
});

describe('Idea Service Consumer Contract', () => {
  beforeAll(async () => {
    await provider.setup();
  });

  afterAll(async () => {
    await provider.finalize();
  });

  describe('GET /ideas', () => {
    it('should return list of ideas', async () => {
      await provider.addInteraction({
        states: [{ description: 'ideas exist' }],
        uponReceiving: 'a request for all ideas',
        withRequest: {
          method: 'GET',
          path: '/api/v1/ideas',
          headers: { Accept: 'application/json' }
        },
        willRespondWith: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            data: Pact.Matchers.eachLike({
              id: Pact.Matchers.string('idea-123'),
              title: Pact.Matchers.string('Test Idea'),
              status: Pact.Matchers.string('pending'),
              createdAt: Pact.Matchers.isoDateTime()
            }, { min: 1 })
          }
        }
      });

      const response = await fetch(`${provider.mockService.baseUrl}/api/v1/ideas`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBeGreaterThan(0);
    });
  });

  describe('POST /ideas', () => {
    it('should create a new idea', async () => {
      await provider.addInteraction({
        states: [{ description: 'no ideas exist' }],
        uponReceiving: 'a request to create an idea',
        withRequest: {
          method: 'POST',
          path: '/api/v1/ideas',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: {
            title: 'New Idea',
            description: 'Idea description',
            domain: 'web-development'
          }
        },
        willRespondWith: {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
          body: {
            data: {
              id: Pact.Matchers.string('new-idea-456'),
              title: 'New Idea',
              status: 'pending'
            }
          }
        }
      });

      const response = await fetch(`${provider.mockService.baseUrl}/api/v1/ideas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New Idea',
          description: 'Idea description',
          domain: 'web-development'
        })
      });

      expect(response.status).toBe(201);
    });
  });
});
```

### 5.2 提供者验证

```typescript
// tests/contracts/provider-verification.ts
import { Verifier } from '@pact-foundation/pact';
import path from 'path';

describe('Pact Provider Verification', () => {
  const verifier = new Verifier({
    provider: 'idea-service',
    providerBaseUrl: process.env.PROVIDER_URL || 'http://localhost:3001',
    pactFiles: [
      path.resolve(__dirname, '../../pacts/frontend-app-idea-service.json')
    ],
    stateHandlers: {
      'ideas exist': async () => {
        // 设置测试数据
        await db.seedIdeas();
      },
      'no ideas exist': async () => {
        await db.clearIdeas();
      }
    },
    publishingResults: process.env.CI === 'true' ? {
      providerVersion: process.env.GIT_COMMIT,
      pactBroker: process.env.PACT_BROKER_URL,
      consumerVersionSelectors: [
        { latest: true }
      ]
    } : undefined
  });

  it('should verify the contract', async () => {
    await verifier.verifyProvider();
  });
});
```

---

## 6. 性能测试

### 6.1 性能测试配置

```typescript
// k6/config.ts
import http from 'k6/http';
import { Rate, Trend, Counter } from 'k6/metrics';

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // 预热
    { duration: '5m', target: 100 },  // 持续
    { duration: '2m', target: 200 },  // 峰值
    { duration: '5m', target: 200 },  // 持续
    { duration: '2m', target: 0 }   // 冷却
  ],

  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.95']
  }
};

// 自定义指标
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const projectCreation = new Trend('project_creation');

export default function () {
  // 场景 1: 获取项目列表
  const listRes = http.get(`${__ENV.BASE_URL}/api/v1/projects`);
  errorRate.add(listRes.status !== 200);
  responseTime.add(listRes.timings.duration);

  // 场景 2: 创建项目
  const createRes = http.post(
    `${__ENV.BASE_URL}/api/v1/projects`,
    JSON.stringify({
      name: `load-test-project-${Date.now()}`,
      type: 'web-app',
      description: 'Performance test project'
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  errorRate.add(createRes.status !== 201);
  projectCreation.add(createRes.timings.duration);
}
```

### 6.2 性能基准测试

```typescript
// benchmarks/api.benchmark.ts
import { benchmark, BenchmarkConfig } from '@/testing/benchmark';

const config: BenchmarkConfig = {
  iterations: 1000,
  warmup: 100,
  reportInterval: 100
};

benchmark('API Performance', config, async (ctx) => {
  const { iterations, report } = ctx;

  const results = {
    'GET /projects': [] as number[],
    'POST /projects': [] as number[],
    'GET /ideas': [] as number[]
  };

  for (let i = 0; i < iterations; i++) {
    // GET /projects
    const start1 = Date.now();
    await request.get('/api/v1/projects');
    results['GET /projects'].push(Date.now() - start1);

    // POST /projects
    const start2 = Date.now();
    await request.post('/api/v1/projects', { name: `bench-${i}` });
    results['POST /projects'].push(Date.now() - start2);

    // GET /ideas
    const start3 = Date.now();
    await request.get('/api/v1/ideas');
    results['GET /ideas'].push(Date.now() - start3);

    if ((i + 1) % report.interval === 0) {
      report.progress(i + 1, iterations);
    }
  }

  // 计算统计
  return {
    'GET /projects': calculateStats(results['GET /projects']),
    'POST /projects': calculateStats(results['POST /projects']),
    'GET /ideas': calculateStats(results['GET /ideas'])
  };
});

function calculateStats(values: number[]) {
  const sorted = values.sort((a, b) => a - b);
  return {
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    min: sorted[0],
    max: sorted[sorted.length - 1]
  };
}
```

---

## 7. 测试数据管理

### 7.1 测试工厂

```typescript
// tests/factories/index.ts
import { Factory } from 'factory-ts';
import { v4 as uuid } from 'uuid';

export const ProjectFactory = Factory.makeFactory({
  id: uuid(),
  name: 'Test Project',
  type: 'web-app' as const,
  description: 'A test project',
  status: 'pending' as const,
  createdAt: new Date(),
  updatedAt: new Date()
});

export const IdeaFactory = Factory.makeFactory({
  id: uuid(),
  title: 'Test Idea',
  description: 'A test idea',
  domain: 'web-development',
  status: 'pending' as const,
  feasibility: 0.8,
  createdAt: new Date()
});

export const UserFactory = Factory.makeFactory({
  id: uuid(),
  email: 'test@example.com',
  name: 'Test User',
  role: 'user' as const,
  createdAt: new Date()
});

// 生成随机项目
export function generateProject(overrides?: Partial<Project>): Project {
  return ProjectFactory.build(overrides);
}

// 生成随机想法
export function generateIdea(overrides?: Partial<Idea>): Idea {
  return IdeaFactory.build(overrides);
}

// 生成多个项目
export function generateProjects(count: number): Project[] {
  return ProjectFactory.buildList(count);
}
```

### 7.2 测试数据库

```typescript
// tests/helpers/database.ts
import { Database } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.resolve(__dirname, '../../data/test.db');

export async function createTestDb(): Promise<void> {
  // 删除已存在的测试数据库
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  // 创建新的测试数据库
  const db = new Database(TEST_DB_PATH);

  // 运行迁移
  const migrations = fs.readdirSync('./drizzle/migrations')
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const migration of migrations) {
    const sql = fs.readFileSync(`./drizzle/migrations/${migration}`, 'utf-8');
    db.exec(sql);
  }

  db.close();
}

export async function cleanTestDb(): Promise<void> {
  const db = new Database(TEST_DB_PATH);

  // 清空所有表
  db.exec(`
    DELETE FROM projects;
    DELETE FROM ideas;
    DELETE FROM users;
    DELETE FROM audit_log;
  `);

  db.close();
}

export async function seedTestData(): Promise<void> {
  const db = new Database(TEST_DB_PATH);

  // 插入测试数据
  db.exec(`
    INSERT INTO users (id, email, name, role) VALUES
    ('user-1', 'test@example.com', 'Test User', 'user'),
    ('user-2', 'admin@example.com', 'Admin User', 'admin');

    INSERT INTO ideas (id, title, description, domain, status) VALUES
    ('idea-1', 'Test Idea 1', 'Description 1', 'web-development', 'pending'),
    ('idea-2', 'Test Idea 2', 'Description 2', 'cli-tools', 'completed');

    INSERT INTO projects (id, name, type, status, user_id) VALUES
    ('proj-1', 'Project 1', 'web-app', 'completed', 'user-1'),
    ('proj-2', 'Project 2', 'library', 'in_progress', 'user-1');
  `);

  db.close();
}

export function getTestDb(): Database {
  return new Database(TEST_DB_PATH);
}
```

---

## 8. CI/CD 集成

### 8.1 GitHub Actions 配置

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit
        env:
          LLM_API_KEY: ${{ secrets.LLM_API_KEY }}

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
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

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/test
          LLM_API_KEY: ${{ secrets.LLM_API_KEY }}

  e2e-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          BASE_URL: http://localhost:3000

      - name: Upload Playwright Report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

  contract-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run consumer contract tests
        run: npm run test:contracts:consumer

      - name: Publish to Pact Broker
        if: github.ref == 'refs/heads/main'
        run: npm run pact:publish
        env:
          PACT_BROKER_URL: ${{ secrets.PACT_BROKER_URL }}
          PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}

      - name: Run provider verification
        run: npm run test:contracts:provider
        env:
          PACT_BROKER_URL: ${{ secrets.PACT_BROKER_URL }}
          PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}
```

### 8.2 测试报告

```typescript
// Allure 报告配置
const allureConfig = {
  resultsDir: './allure-results',
  reportDir: './allure-report',

  categories: [
    {
      name: 'Known Bugs',
      matchedStatuses: ['broken']
    },
    {
      name: 'Product defects',
      matchedStatuses: ['failed']
    },
    {
      name: 'Test defects',
      matchedStatuses: ['broken']
    }
  ],

  environment: {
    backend: process.env.BACKEND_VERSION || 'local',
    frontend: process.env.FRONTEND_VERSION || 'local'
  }
};
```

---

## 9. 相关文档

- [测试策略设计](./TESTING_STRATEGY.md)
- [CI/CD 流水线设计](./CI_CD_PIPELINE.md)
- [契约测试设计](./CONTRACT_TESTING.md)
- [性能基准测试](./PERFORMANCE_BENCHMARKING.md)

---

**最后更新**: 2026-04-14
