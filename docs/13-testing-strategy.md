# 测试策略

## 1. 测试层次

### 1.1 测试金字塔

```
              ▲
             /│\
            / │ \
           /  │  \      E2E测试 (5%)
          /   │   \     - 关键用户流程
         /    │    \    - 部署后验证
        /     │     \
       /      │      \   集成测试 (15%)
      /       │       \  - API集成
     /        │        \ - Agent集成
    /         │         \
   /          │          \ 单元测试 (80%)
  /           │           \ - 函数测试
 /            │            \ - 组件测试
/             │             \ - 工具测试
└─────────────┴─────────────┘
```

### 1.2 测试类型

| 类型 | 范围 | 速度 | 数量 |
|------|------|------|------|
| 单元测试 | 单个函数/组件 | 快 | 大量 |
| 集成测试 | 模块间交互 | 中 | 适量 |
| E2E测试 | 完整流程 | 慢 | 少量 |
| 性能测试 | 响应时间/吞吐 | 中 | 关键路径 |
| 安全测试 | 漏洞/权限 | 慢 | 全面 |

## 2. 单元测试

### 2.1 前端单元测试

```typescript
// frontend/src/components/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders with children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows loading state', () => {
    render(<Button loading>Click me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('applies variant styles', () => {
    const { rerender } = render(<Button variant="primary">Click</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-primary');

    rerender(<Button variant="secondary">Click</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-secondary');
  });
});
```

### 2.2 后端单元测试

```typescript
// backend/src/services/project.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectService } from './project';
import { ProjectRepository } from '../repositories/project';

describe('ProjectService', () => {
  let service: ProjectService;
  let repository: ProjectRepository;

  beforeEach(() => {
    repository = {
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    service = new ProjectService(repository);
  });

  describe('create', () => {
    it('creates a project with valid data', async () => {
      const data = {
        name: 'Test Project',
        type: 'crud' as const,
        description: 'Test description',
      };

      vi.mocked(repository.create).mockResolvedValue({
        id: 'proj_123',
        ...data,
        status: 'pending',
        createdAt: new Date(),
      });

      const result = await service.create(data);

      expect(result.name).toBe('Test Project');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining(data)
      );
    });

    it('throws validation error for invalid name', async () => {
      const data = {
        name: 'ab', // too short
        type: 'crud' as const,
      };

      await expect(service.create(data)).rejects.toThrow('Validation error');
    });
  });

  describe('startGeneration', () => {
    it('starts generation for pending project', async () => {
      vi.mocked(repository.findById).mockResolvedValue({
        id: 'proj_123',
        name: 'Test',
        type: 'crud',
        status: 'pending',
      });

      const result = await service.startGeneration('proj_123');

      expect(result.status).toBe('running');
    });

    it('throws error if project is not pending', async () => {
      vi.mocked(repository.findById).mockResolvedValue({
        id: 'proj_123',
        name: 'Test',
        type: 'crud',
        status: 'running',
      });

      await expect(
        service.startGeneration('proj_123')
      ).rejects.toThrow('Project is already running');
    });
  });
});
```

### 2.3 Agent单元测试

```typescript
// backend/src/agents/requirement.test.ts
import { describe, it, expect, vi } from 'vitest';
import { RequirementAgent } from './requirement';
import { MockLLM } from '../test/mocks/llm';

describe('RequirementAgent', () => {
  it('analyzes requirements and generates PRD', async () => {
    const mockLLM = new MockLLM();
    mockLLM.setResponse(JSON.stringify({
      title: 'Todo App',
      features: [
        { name: 'Create Todo', priority: 'high' },
        { name: 'Delete Todo', priority: 'medium' },
      ],
    }));

    const agent = new RequirementAgent({ llm: mockLLM });

    const result = await agent.execute({
      goal: 'I need a todo application',
    });

    expect(result.success).toBe(true);
    expect(result.data.title).toBe('Todo App');
    expect(result.data.features).toHaveLength(2);
  });

  it('handles invalid requirements gracefully', async () => {
    const mockLLM = new MockLLM();
    mockLLM.setResponse('invalid json');

    const agent = new RequirementAgent({ llm: mockLLM });

    const result = await agent.execute({
      goal: '',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to parse');
  });
});
```

## 3. 集成测试

### 3.1 API集成测试

```typescript
// backend/src/api/projects.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { TestDatabase } from '../test/helpers/database';

describe('Projects API', () => {
  let app: Express.Application;
  let db: TestDatabase;

  beforeAll(async () => {
    db = await TestDatabase.create();
    app = createApp({ database: db });
  });

  afterAll(async () => {
    await db.close();
  });

  describe('GET /api/v1/projects', () => {
    it('returns list of projects', async () => {
      await db.seedProjects([
        { id: 'proj_1', name: 'Project 1', type: 'crud' },
        { id: 'proj_2', name: 'Project 2', type: 'data-tool' },
      ]);

      const response = await request(app)
        .get('/api/v1/projects')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(2);
    });

    it('filters by status', async () => {
      await db.seedProjects([
        { id: 'proj_1', name: 'P1', status: 'completed' },
        { id: 'proj_2', name: 'P2', status: 'running' },
      ]);

      const response = await request(app)
        .get('/api/v1/projects?status=completed')
        .expect(200);

      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].status).toBe('completed');
    });
  });

  describe('POST /api/v1/projects', () => {
    it('creates a new project', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .send({
          name: 'New Project',
          type: 'crud',
          description: 'Test description',
        })
        .expect(201);

      expect(response.body.data.name).toBe('New Project');
      expect(response.body.data.status).toBe('pending');
    });

    it('validates required fields', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .send({ name: 'ab' }) // missing type, name too short
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
```

### 3.2 Agent集成测试

```typescript
// backend/src/agents/integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MetaAgent } from './meta';
import { TestEnvironment } from '../test/helpers/environment';

describe('Agent Integration', () => {
  let env: TestEnvironment;

  beforeAll(async () => {
    env = await TestEnvironment.create();
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it('executes full generation workflow', async () => {
    const metaAgent = new MetaAgent(env.agentContext);

    const result = await metaAgent.execute({
      goal: 'Create a simple todo application with CRUD operations',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    // 验证生成的项目
    const project = await env.db.getProject(result.data.projectId);
    expect(project.status).toBe('completed');
    expect(project.qualityReport.overallScore).toBeGreaterThan(80);
  }, 60000); // 60s timeout

  it('handles quality check failures and retries', async () => {
    // 模拟质量检查失败
    env.mockQualityCheck.failNext(2);

    const metaAgent = new MetaAgent(env.agentContext);

    const result = await metaAgent.execute({
      goal: 'Create a user management application',
    });

    // 最终应该成功（重试后）
    expect(result.success).toBe(true);
    expect(env.mockQualityCheck.callCount).toBe(3); // 2次失败 + 1次成功
  }, 90000);
});
```

## 4. E2E测试

### 4.1 用户流程测试

```typescript
// e2e/generation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Project Generation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('complete project generation flow', async ({ page }) => {
    // 1. 创建项目
    await page.click('text=New Project');
    await page.fill('input[name="name"]', 'E2E Test Project');
    await page.selectOption('select[name="type"]', 'crud');
    await page.fill('textarea[name="requirements"]', 'A simple CRUD application for managing users');
    await page.click('button:has-text("Create")');

    // 2. 等待项目创建
    await page.waitForSelector('text=E2E Test Project');

    // 3. 启动生成
    await page.click('button:has-text("Start Generation")');
    await page.waitForSelector('text=Generation Started');

    // 4. 监控进度
    await page.waitForSelector('text=requirement', { state: 'visible' });
    await page.waitForSelector('text=architecture', { state: 'visible' });
    await page.waitForSelector('text=development', { state: 'visible' });
    await page.waitForSelector('text=quality', { state: 'visible' });
    await page.waitForSelector('text=deployment', { state: 'visible' });

    // 5. 验证完成
    await page.waitForSelector('text=Completed', { timeout: 300000 });
    await expect(page.locator('.project-status')).toHaveText('Completed');

    // 6. 检查代码
    await page.click('tab=Code');
    await expect(page.locator('.file-tree')).toBeVisible();

    // 7. 检查部署URL
    const deployUrl = await page.locator('.deploy-url').textContent();
    expect(deployUrl).toMatch(/^https?:\/\//);
  });

  test('handles generation failure gracefully', async ({ page }) => {
    // 创建项目
    await page.click('text=New Project');
    await page.fill('input[name="name"]', 'Failing Project');
    await page.selectOption('select[name="type"]', 'crud');
    await page.fill('textarea[name="requirements"]', 'invalid requirements that will fail');
    await page.click('button:has-text("Create")');

    // 启动生成
    await page.click('button:has-text("Start Generation")');

    // 等待失败
    await page.waitForSelector('text=Failed', { timeout: 60000 });
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('button:has-text("Retry")')).toBeVisible();
  });
});
```

## 5. 性能测试

### 5.1 负载测试

```typescript
// tests/performance/load.ts
import { check } from 'k6';
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up
    { duration: '1m', target: 20 },   // Stay
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% < 500ms
    http_req_failed: ['rate<0.01'],   // Error rate < 1%
  },
};

export default function () {
  // 获取项目列表
  const listRes = http.get(`${__ENV.API_URL}/api/v1/projects`);
  check(listRes, {
    'list status 200': (r) => r.status === 200,
    'list response time < 200ms': (r) => r.timings.duration < 200,
  });

  // 创建项目
  const createRes = http.post(
    `${__ENV.API_URL}/api/v1/projects`,
    JSON.stringify({
      name: `Load Test ${Date.now()}`,
      type: 'crud',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(createRes, {
    'create status 201': (r) => r.status === 201,
  });
}
```

### 5.2 压力测试

```typescript
// tests/performance/stress.ts
import { check, sleep } from 'k6';
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '1m', target: 100 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 200 },
    { duration: '2m', target: 200 },
    { duration: '1m', target: 0 },
  ],
};

export default function () {
  const res = http.get(`${__ENV.API_URL}/api/v1/projects`);

  check(res, {
    'status 200': (r) => r.status === 200,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
  });

  sleep(1);
}
```

## 6. 测试配置

### 6.1 Vitest配置

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/**/*.test.ts',
        'src/types/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    setupFiles: ['src/test/setup.ts'],
    teardownTimeout: 10000,
    testTimeout: 30000,
  },
});
```

### 6.2 Playwright配置

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

## 7. CI/CD测试流程

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:7
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - run: npm ci
      - run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

---

**版本**: 0.1.0
**更新日期**: 2026-04-14
**状态**: 设计阶段
