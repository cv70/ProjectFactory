# 测试策略设计文档

## 1. 测试体系架构

### 1.1 测试金字塔

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              测试金字塔                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                                    ▲                                         │
│                                   ╱ ╲                                        │
│                                  ╱   ╲                                       │
│                                 ╱█████ ╲      E2E 测试 (少量)                  │
│                                ╱████████╲     端到端验证                        │
│                               ╱██████████╲                                   │
│                              ╱────────────╲                                  │
│                             ╱──────────────╲     集成测试 (适量)                │
│                            ╱────────────────╲    模块间协作                     │
│                           ╱──────────────────╲                               │
│                          ╱────────────────────╲                               │
│                         ╱──────────────────────╲    单元测试 (大量)             │
│                        ╱────────────────────────╲   核心逻辑验证                │
│                       ╱──────────────────────────╲                           │
│                      ╱────────────────────────────╲                           │
│                                                                              │
│  比例:   70% 单元测试  |  20% 集成测试  |  10% E2E 测试                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 测试类型定义

```typescript
// 测试类型枚举
enum TestType {
  UNIT = 'unit',                    // 单元测试
  INTEGRATION = 'integration',      // 集成测试
  E2E = 'e2e',                     // 端到端测试
  PERFORMANCE = 'performance',      // 性能测试
  SECURITY = 'security',            // 安全测试
  FUZZ = 'fuzz',                   // 模糊测试
  REGRESSION = 'regression'        // 回归测试
}

// 测试级别
enum TestLevel {
  AGENT = 'agent',                 // Agent 级别
  SERVICE = 'service',             // 服务级别
  SYSTEM = 'system'               // 系统级别
}

// 测试配置
interface TestConfig {
  type: TestType;
  level: TestLevel;
  target: string;                 // 测试目标
  timeout: number;                // 超时时间
  retries: number;                // 重试次数
  priority: 'critical' | 'high' | 'medium' | 'low';
}
```

## 2. 单元测试设计

### 2.1 Agent 单元测试

```typescript
// Agent 单元测试策略

describe('IdeaGeneratorAgent', () => {
  // 1. 基础功能测试
  describe('Basic Functionality', () => {
    it('should generate valid ideas', async () => {
      const agent = new IdeaGeneratorAgent(mockConfig);
      const result = await agent.execute(
        { count: 3 },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toHaveLength(3);
      expect(result.output[0]).toMatchSchema(ideaSchema);
    });

    it('should respect constraints', async () => {
      const agent = new IdeaGeneratorAgent(mockConfig);
      const result = await agent.execute(
        {
          count: 5,
          constraints: {
            maxComplexity: 'low',
            allowedTypes: ['cli-tool']
          }
        },
        mockContext
      );

      for (const idea of result.output) {
        expect(idea.complexity).toBe('low');
        expect(idea.projectType).toBe('cli-tool');
      }
    });
  });

  // 2. 边界条件测试
  describe('Edge Cases', () => {
    it('should handle empty domain', async () => {
      const agent = new IdeaGeneratorAgent(mockConfig);
      const result = await agent.execute(
        { domain: '', count: 1 },
        mockContext
      );

      expect(result.success).toBe(true);
    });

    it('should limit max count to 10', async () => {
      const agent = new IdeaGeneratorAgent(mockConfig);
      const result = await agent.execute(
        { count: 100 },
        mockContext
      );

      expect(result.output).toHaveLength(10);
    });

    it('should handle API failure gracefully', async () => {
      mockLLM.invoke.mockRejectedValue(new Error('API Error'));

      const agent = new IdeaGeneratorAgent(mockConfig);
      const result = await agent.execute(
        { count: 1 },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  // 3. 性能测试
  describe('Performance', () => {
    it('should complete within timeout', async () => {
      const agent = new IdeaGeneratorAgent(mockConfig);
      const start = Date.now();

      await agent.execute({ count: 3 }, mockContext);

      expect(Date.now() - start).toBeLessThan(60000); // 1 分钟
    });

    it('should track token usage', async () => {
      const agent = new IdeaGeneratorAgent(mockConfig);
      const result = await agent.execute({ count: 3 }, mockContext);

      expect(result.metrics.tokensUsed).toBeGreaterThan(0);
      expect(result.metrics.cost).toBeGreaterThan(0);
    });
  });
});
```

### 2.2 工具函数测试

```typescript
// 工具函数测试示例

describe('KnowledgeRetriever', () => {
  describe('semanticSearch', () => {
    it('should return relevant results', async () => {
      const retriever = new KnowledgeRetriever(mockDb);
      const results = await retriever.semanticSearch(
        'React hooks',
        { limit: 5 }
      );

      expect(results).toHaveLength(5);
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('should respect similarity threshold', async () => {
      const retriever = new KnowledgeRetriever(mockDb);
      const results = await retriever.semanticSearch(
        'xyzabc',
        { similarityThreshold: 0.8 }
      );

      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(0.8);
      }
    });
  });

  describe('keywordSearch', () => {
    it('should find exact matches first', async () => {
      const retriever = new KnowledgeRetriever(mockDb);
      const results = await retriever.keywordSearch(['typescript']);

      expect(results[0].matchType).toBe('exact');
    });
  });
});

describe('WorkflowEngine', () => {
  describe('execute', () => {
    it('should execute workflow in correct order', async () => {
      const engine = new WorkflowEngine(mockConfig);
      const execution = await engine.execute(
        'project-generation',
        { idea: mockIdea },
        mockContext
      );

      expect(execution.status).toBe('completed');

      // 验证节点执行顺序
      const nodeOrder = execution.history.map(h => h.nodeId);
      expect(nodeOrder).toEqual([
        'start',
        'ideation',
        'architecture',
        'coding',
        'testing',
        'deploy',
        'end'
      ]);
    });

    it('should handle node failure', async () => {
      mockAgent.execute.mockRejectedValueOnce(new Error('Node failed'));

      const engine = new WorkflowEngine(mockConfig);
      const execution = await engine.execute(
        'project-generation',
        { idea: mockIdea },
        mockContext
      );

      expect(execution.status).toBe('failed');
      expect(execution.error).toBeDefined();
    });

    it('should respect timeout', async () => {
      mockAgent.execute.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 60000))
      );

      const engine = new WorkflowEngine(mockConfig);

      await expect(
        engine.execute('project-generation', { idea: mockIdea }, mockContext)
      ).rejects.toThrow('Workflow timeout');
    });
  });
});
```

## 3. 集成测试设计

### 3.1 服务集成测试

```typescript
// 服务集成测试

describe('ProjectService Integration', () => {
  let db: TestDatabase;
  let projectService: ProjectService;

  beforeAll(async () => {
    db = await TestDatabase.create();
    projectService = new ProjectService(db);
  });

  afterAll(async () => {
    await db.close();
  });

  describe('Project Lifecycle', () => {
    it('should create and progress through stages', async () => {
      // 1. 创建项目
      const project = await projectService.create({
        name: 'Test Project',
        type: 'web-app',
        ideaId: 'idea_123'
      });

      expect(project.status).toBe('initializing');
      expect(project.stage).toBe('pending');

      // 2. 启动项目
      const started = await projectService.start(project.id);
      expect(started.status).toBe('generating');
      expect(started.stage).toBe('ideation');

      // 3. 更新阶段
      const updated = await projectService.updateStage(project.id, {
        stage: 'architecture',
        architecture: mockArchitecture
      });
      expect(updated.stage).toBe('architecture');

      // 4. 完成项目
      const completed = await projectService.complete(project.id);
      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeDefined();
    });

    it('should handle failure gracefully', async () => {
      const project = await projectService.create({
        name: 'Failing Project',
        type: 'cli-tool'
      });

      await projectService.fail(project.id, {
        stage: 'coding',
        error: 'Compilation failed'
      });

      const failed = await projectService.get(project.id);
      expect(failed.status).toBe('failed');
      expect(failed.error).toBe('Compilation failed');
    });
  });
});

// API 集成测试
describe('API Integration', () => {
  const request = supertest(app);

  describe('POST /api/projects', () => {
    it('should create project', async () => {
      const response = await request
        .post('/api/projects')
        .send({
          name: 'API Test',
          type: 'web-app'
        })
        .expect(201);

      expect(response.body.project).toBeDefined();
      expect(response.body.project.id).toBeDefined();
    });

    it('should validate input', async () => {
      const response = await request
        .post('/api/projects')
        .send({
          name: '',  // 无效名称
          type: 'invalid-type'  // 无效类型
        })
        .expect(400);

      expect(response.body.error).toContain('Validation failed');
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should return project', async () => {
      const created = await request
        .post('/api/projects')
        .send({ name: 'Test', type: 'cli-tool' });

      const response = await request
        .get(`/api/projects/${created.body.project.id}`)
        .expect(200);

      expect(response.body.project.name).toBe('Test');
    });

    it('should return 404 for non-existent project', async () => {
      await request.get('/api/projects/non-existent').expect(404);
    });
  });
});
```

### 3.2 Agent 协作测试

```typescript
// Agent 协作集成测试

describe('Multi-Agent Collaboration', () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    orchestrator = new Orchestrator(mockConfig);
  });

  it('should coordinate IdeaGenerator → Architect → Coder', async () => {
    const result = await orchestrator.executeProject({
      idea: {
        title: 'Test CLI Tool',
        description: 'A test CLI tool',
        type: 'cli-tool'
      }
    });

    // 验证 IdeaGenerator 输出
    expect(result.idea).toBeDefined();
    expect(result.idea.title).toBe('Test CLI Tool');

    // 验证 Architect 输出
    expect(result.architecture).toBeDefined();
    expect(result.architecture.pattern).toBeDefined();

    // 验证 Coder 输出
    expect(result.codebase).toBeDefined();
    expect(result.codebase.files.length).toBeGreaterThan(0);
  });

  it('should handle iteration on test failure', async () => {
    // Mock 测试失败
    mockTesterAgent.execute
      .mockResolvedValueOnce({ success: false, errors: ['Test failed'] })
      .mockResolvedValueOnce({ success: true });

    const result = await orchestrator.executeProject({
      idea: mockIdea,
      maxIterations: 3
    });

    // 验证重试逻辑
    expect(mockCoderAgent.execute).toHaveBeenCalledTimes(2);
    expect(result.tests).toBeDefined();
  });
});
```

## 4. E2E 测试设计

### 4.1 关键流程 E2E

```typescript
// E2E 测试

describe('Project Generation E2E', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should complete full project generation', async () => {
    // 1. 创建项目
    const createResponse = await request
      .post('/api/projects')
      .send({
        name: 'E2E Test Project',
        type: 'web-app',
        idea: 'A simple web dashboard'
      })
      .expect(201);

    const projectId = createResponse.body.project.id;

    // 2. 等待项目完成（轮询）
    await waitForProjectCompletion(projectId, { timeout: 300000 });

    // 3. 验证项目状态
    const project = await request.get(`/api/projects/${projectId}`);
    expect(project.body.project.status).toBe('completed');
    expect(project.body.project.qualityScore).toBeGreaterThanOrEqual(70);

    // 4. 验证生成的文件
    const files = await request.get(`/api/projects/${projectId}/files`);
    expect(files.body.files.length).toBeGreaterThan(0);

    // 5. 验证测试覆盖率
    expect(project.body.project.testCoverage).toBeGreaterThanOrEqual(80);

    // 6. 验证构建成功
    expect(project.body.project.buildSuccess).toBe(true);
  });

  it('should handle project failure gracefully', async () => {
    const createResponse = await request
      .post('/api/projects')
      .send({
        name: 'Failing Project',
        type: 'invalid-type'  // 会导致失败的输入
      })
      .expect(201);

    const projectId = createResponse.body.project.id;

    // 等待失败
    await waitForProjectFinalStatus(projectId, { timeout: 60000 });

    const project = await request.get(`/api/projects/${projectId}`);
    expect(project.body.project.status).toBe('failed');
    expect(project.body.project.error).toBeDefined();
  });
});

// WebSocket E2E 测试
describe('WebSocket Events E2E', () => {
  it('should receive real-time updates', async () => {
    const ws = new WebSocket('ws://localhost:3001/ws/projects/test-id');

    const updates: ProjectUpdate[] = [];

    ws.onmessage = (event) => {
      updates.push(JSON.parse(event.data));
    };

    // 创建项目触发更新
    await request
      .post('/api/projects')
      .send({ name: 'WS Test', type: 'cli-tool' });

    // 等待几个更新
    await new Promise(resolve => setTimeout(resolve, 5000));

    expect(updates.length).toBeGreaterThan(0);
    expect(updates[0].type).toBe('stage_changed');

    ws.close();
  });
});
```

### 4.2 回归测试套件

```typescript
// 回归测试套件

describe('Regression Suite', () => {
  // 每次发布前运行的关键回归测试

  describe('Previously Fixed Issues', () => {
    // Issue #123: 项目创建时内存泄漏
    it('should not leak memory on project creation', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 100; i++) {
        await request.post('/api/projects').send({
          name: `Memory Test ${i}`,
          type: 'cli-tool'
        });
      }

      // 强制 GC（如果可用）
      if (global.gc) global.gc();

      const finalMemory = process.memoryUsage().heapUsed;
      const increase = (finalMemory - initialMemory) / initialMemory;

      expect(increase).toBeLessThan(0.5); // 内存增长应小于 50%
    });

    // Issue #456: 并发创建项目时竞态条件
    it('should handle concurrent project creation', async () => {
      const promises = Array(10).fill(null).map((_, i) =>
        request.post('/api/projects').send({
          name: `Concurrent Test ${i}`,
          type: 'web-app'
        })
      );

      const results = await Promise.all(promises);

      // 所有请求都应该成功
      results.forEach(res => {
        expect(res.status).toBe(201);
      });

      // 所有项目应该独立存在
      const projects = await request.get('/api/projects');
      expect(projects.body.projects.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Critical Paths', () => {
    it('should complete basic CRUD operations', async () => {
      // Create
      const created = await request
        .post('/api/projects')
        .send({ name: 'CRUD Test', type: 'api-service' });

      // Read
      const read = await request.get(`/api/projects/${created.body.project.id}`);
      expect(read.body.project.id).toBe(created.body.project.id);

      // Update
      await request
        .patch(`/api/projects/${created.body.project.id}`)
        .send({ name: 'Updated Name' });

      // Verify Update
      const updated = await request.get(`/api/projects/${created.body.project.id}`);
      expect(updated.body.project.name).toBe('Updated Name');

      // Delete
      await request.delete(`/api/projects/${created.body.project.id}`);

      // Verify Delete
      await request.get(`/api/projects/${created.body.project.id}`).expect(404);
    });
  });
});
```

## 5. 测试覆盖策略

### 5.1 覆盖率目标

```typescript
// 测试覆盖率配置

interface CoverageTarget {
  type: TestType;
  statements: number;    // 语句覆盖率
  branches: number;      // 分支覆盖率
  functions: number;     // 函数覆盖率
  lines: number;         // 行覆盖率
}

const coverageTargets: CoverageTarget[] = [
  {
    type: TestType.UNIT,
    statements: 90,      // 90%
    branches: 85,        // 85%
    functions: 95,       // 95%
    lines: 90
  },
  {
    type: TestType.INTEGRATION,
    statements: 70,
    branches: 60,
    functions: 80,
    lines: 70
  },
  {
    type: TestType.E2E,
    statements: 50,
    branches: 40,
    functions: 60,
    lines: 50
  }
];

// 关键模块覆盖率要求
const criticalModulesCoverage = {
  'workflow-engine': {
    statements: 95,
    branches: 90
  },
  'knowledge-retriever': {
    statements: 90,
    branches: 85
  },
  'auth-service': {
    statements: 95,
    branches: 95
  }
};
```

### 5.2 覆盖率检查

```typescript
// 覆盖率检查脚本

import { execSync } from 'child_process';
import * as fs from 'fs';

interface CoverageReport {
  totals: {
    lines: CoverageMetric;
    statements: CoverageMetric;
    functions: CoverageMetric;
    branches: CoverageMetric;
  };
  fileCoverage: Record<string, CoverageMetric>;
}

interface CoverageMetric {
  total: number;
  covered: number;
  pct: number;
}

function checkCoverage(): boolean {
  // 生成覆盖率报告
  execSync('npm run test:coverage', { cwd: __dirname + '/../..' });

  // 读取报告
  const report: CoverageReport = JSON.parse(
    fs.readFileSync('coverage/coverage-final.json', 'utf-8')
  );

  const results: string[] = [];
  let allPassed = true;

  // 检查总体覆盖率
  for (const target of coverageTargets) {
    const actual = report.totals.lines.pct; // 使用行覆盖率作为代表
    if (actual < target.lines) {
      results.push(`❌ ${target.type}: ${actual}% (target: ${target.lines}%)`);
      allPassed = false;
    } else {
      results.push(`✅ ${target.type}: ${actual}%`);
    }
  }

  // 检查关键模块
  for (const [module, target] of Object.entries(criticalModulesCoverage)) {
    const coverage = report.fileCoverage[module];
    if (coverage) {
      if (coverage.pct < target.statements) {
        results.push(`❌ ${module}: ${coverage.pct}% (target: ${target.statements}%)`);
        allPassed = false;
      } else {
        results.push(`✅ ${module}: ${coverage.pct}%`);
      }
    }
  }

  console.log('\n📊 Coverage Report:');
  console.log(results.join('\n'));

  return allPassed;
}
```

## 6. 测试自动化

### 6.1 CI/CD 集成

```yaml
# .github/workflows/test.yml

name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  # 单元测试
  unit-tests:
    name: Unit Tests
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

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true

  # 集成测试
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    services:
      sqlite:
        image: ubuntu:latest
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

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  # E2E 测试
  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          API_URL: http://localhost:3001

      - name: Upload screenshots
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: e2e-screenshots
          path: tests/e2e/screenshots/

  # 覆盖率检查
  coverage-check:
    name: Coverage Check
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Check coverage
        run: npm run test:coverage-check
```

### 6.2 测试环境管理

```typescript
// 测试环境配置

interface TestEnvironment {
  name: 'local' | 'ci' | 'staging';
  database: {
    type: 'sqlite' | 'postgres';
    url: string;
  };
  llm: {
    mock: boolean;
    apiKey?: string;
  };
  storage: {
    type: 'memory' | 'disk';
    path: string;
  };
}

const testEnvironments: Record<string, TestEnvironment> = {
  local: {
    name: 'local',
    database: {
      type: 'sqlite',
      url: ':memory:'
    },
    llm: {
      mock: false,
      apiKey: process.env.LLM_API_KEY
    },
    storage: {
      type: 'disk',
      path: './test-data'
    }
  },

  ci: {
    name: 'ci',
    database: {
      type: 'sqlite',
      url: ':memory:'
    },
    llm: {
      mock: true  // CI 中使用 Mock
    },
    storage: {
      type: 'memory'
    }
  },

  staging: {
    name: 'staging',
    database: {
      type: 'postgres',
      url: process.env.STAGING_DB_URL
    },
    llm: {
      mock: false,
      apiKey: process.env.LLM_API_KEY
    },
    storage: {
      type: 'disk',
      path: '/tmp/test-storage'
    }
  }
};

// 测试夹具
describe('withTestEnvironment', () => {
  let env: TestEnvironment;

  beforeAll(async () => {
    env = testEnvironments[process.env.NODE_ENV || 'ci'];
    await setupTestEnvironment(env);
  });

  afterAll(async () => {
    await teardownTestEnvironment(env);
  });

  it('should run tests with environment', () => {
    // 测试代码
  });
});
```

---

**版本**: 1.0.0
**创建日期**: 2026-04-14
**状态**: 测试策略设计完成
