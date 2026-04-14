# 端到端测试框架

## 概述

端到端测试框架（End-to-End Testing Framework）是确保ProjectFactory系统质量和稳定性的关键基础设施。E2E测试从用户视角验证整个系统功能，覆盖从前端界面到后端服务的完整流程，确保各组件集成后的正确性和用户体验。

## 核心价值

- **用户视角验证**：从真实用户角度验证系统功能
- **完整流程覆盖**：覆盖从前端到后端的完整链路
- **可靠稳定**：稳定的测试执行环境，减少 flaky tests
- **快速反馈**：快速的测试执行，及时发现问题
- **CI/CD集成**：与CI/CD流水线无缝集成

## 测试架构

### 测试金字塔

```
┌─────────────────────────────────────────────────────────────────┐
│                         测试金字塔                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                         ▲ E2E Tests                              │
│                        ╱ ╲ 真实场景                             │
│                       ╱   ╲ 验证完整流程                        │
│                      ╱─────╲                                    │
│                     ╱ Unit  ╲                                   │
│                    ╱  Tests  ╲                                  │
│                   ╱───────────╲                                  │
│                  ╱ Integration ╲                                 │
│                 ╱   Tests      ╲                                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 比例: Unit ~70% | Integration ~20% | E2E ~10%             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 测试类型

```typescript
// 测试类型枚举
enum TestType {
  UNIT = 'unit',                       // 单元测试
  INTEGRATION = 'integration',         // 集成测试
  E2E = 'e2e',                       // 端到端测试
  CONTRACT = 'contract',             // 契约测试
  PERFORMANCE = 'performance',        // 性能测试
  SECURITY = 'security',             // 安全测试
  ACCESSIBILITY = 'accessibility',    // 可访问性测试
}

// E2E测试配置
interface E2ETestConfig {
  // 测试URL
  baseUrl: string;

  // 浏览器配置
  browser: {
    type: 'chromium' | 'firefox' | 'webkit';
    headless: boolean;
    viewport: { width: number; height: number };
    locale: string;
    timezone: string;
  };

  // 等待配置
  wait: {
    defaultTimeout: number;           // 默认超时(ms)
    navigationTimeout: number;       // 导航超时
    actionTimeout: number;           // 操作超时
  };

  // 重试配置
  retries: {
    onFailure: number;              // 失败重试次数
    onTimeout: number;              // 超时重试次数
  };

  // 截图配置
  screenshot: {
    onFailure: boolean;
    onSuccess: boolean;            // 仅debug模式
    directory: string;
  };

  // 视频配置
  video: {
    record: 'never' | 'on-failure' | 'always';
    directory: string;
  };
}

// 测试环境配置
const TEST_ENVIRONMENTS = {
  local: {
    baseUrl: 'http://localhost:3000',
    browser: {
      type: 'chromium',
      headless: true,
    },
  },

  staging: {
    baseUrl: 'https://staging.projectfactory.ai',
    browser: {
      type: 'chromium',
      headless: true,
    },
  },

  production: {
    baseUrl: 'https://projectfactory.ai',
    browser: {
      type: 'chromium',
      headless: true,
    },
  },
};
```

## 测试框架

### Playwright配置

```typescript
// Playwright配置
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // 项目配置
  projects: [
    // Chromium配置
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.BASE_URL || 'http://localhost:3000',
      },
    },

    // Firefox配置
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        baseURL: process.env.BASE_URL || 'http://localhost:3000',
      },
    },

    // Webkit配置
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        baseURL: process.env.BASE_URL || 'http://localhost:3000',
      },
    },

    // 移动端配置
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        baseURL: process.env.BASE_URL || 'http://localhost:3000',
      },
    },
  ],

  // 测试目录
  testDir: './tests/e2e',

  // 全局setup/teardown
  globalSetup: './tests/e2e/setup/global-setup.ts',
  globalTeardown: './tests/e2e/setup/global-teardown.ts',

  // 报告配置
  reporter: [
    ['html', { outputFolder: 'reports/e2e' }],
    ['json', { outputFile: 'reports/e2e/results.json' }],
    ['list'],
  ],

  // trace配置
  trace: {
    mode: 'on-first-retry',
    outputDir: 'traces',
  },

  // 截图配置
  screenshot: {
    mode: 'only-on-failure',
    dir: 'screenshots',
  },

  // 视频配置
  video: {
    mode: 'retain-on-failure',
    dir: 'videos',
  },

  // 超时配置
  timeout: {
    test: 30000,          // 单个测试超时
    expect: 5000,          // expect超时
    navigation: 30000,     // 导航超时
  },

  // 重试配置
  retries: process.env.CI ? 2 : 0,
});
```

### 测试编写

```typescript
// 示例：登录E2E测试
import { test, expect } from '@playwright/test';
import { UserFactory } from '../factories/user-factory';
import { LoginPage } from '../pages/login-page';
import { DashboardPage } from '../pages/dashboard-page';

test.describe('Authentication', () => {
  let userFactory: UserFactory;
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    userFactory = new UserFactory();
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
  });

  test('should login successfully with valid credentials', async () => {
    // 准备测试数据
    const user = await userFactory.create({
      email: 'test@example.com',
      password: 'SecurePassword123!',
    });

    // 执行登录流程
    await loginPage.goto();
    await loginPage.fillEmail(user.email);
    await loginPage.fillPassword(user.password);
    await loginPage.clickLogin();

    // 验证结果
    await expect(dashboardPage.getWelcomeMessage()).toBeVisible();
    await expect(dashboardPage.getUserName()).toContainText(user.displayName);
  });

  test('should show error with invalid credentials', async () => {
    await loginPage.goto();
    await loginPage.fillEmail('invalid@example.com');
    await loginPage.fillPassword('wrongpassword');
    await loginPage.clickLogin();

    await expect(loginPage.getErrorMessage()).toContainText('Invalid email or password');
  });

  test('should validate email format', async () => {
    await loginPage.goto();
    await loginPage.fillEmail('notanemail');
    await loginPage.fillPassword('somepassword');
    await loginPage.clickLogin();

    await expect(loginPage.getEmailError()).toContainText('Please enter a valid email');
  });

  test('should remember me functionality', async () => {
    const user = await userFactory.create();
    const storageState = await loginPage.loginWithRememberMe(user);

    // 重新打开页面，应该自动登录
    const newContext = await loginPage.context();
    await newContext.addCookies(storageState.cookies);
    await newContext.addStorageState(storageState);

    await dashboardPage.goto();
    await expect(dashboardPage.getUserName()).toBeVisible();
  });
});
```

### 页面对象模型

```typescript
// 页面对象基类
abstract class BasePage {
  constructor(protected page: Page) {}

  // 等待元素可见
  async waitForSelector(selector: string, options?: WaitForSelectorOptions): Promise<void> {
    await this.page.waitForSelector(selector, {
      state: 'visible',
      timeout: 10000,
      ...options,
    });
  }

  // 点击元素
  async click(selector: string): Promise<void> {
    await this.waitForSelector(selector);
    await this.page.click(selector);
  }

  // 填写输入框
  async fill(selector: string, value: string): Promise<void> {
    await this.waitForSelector(selector);
    await this.page.fill(selector, value);
  }

  // 获取文本内容
  async getText(selector: string): Promise<string> {
    await this.waitForSelector(selector);
    return this.page.textContent(selector);
  }

  // 等待导航完成
  async waitForNavigation(options?: WaitForNavigationOptions): Promise<void> {
    await this.page.waitForNavigation(options);
  }

  // 截图
  async screenshot(name?: string): Promise<Buffer> {
    return this.page.screenshot({
      path: name ? `screenshots/${name}.png` : undefined,
      fullPage: true,
    });
  }
}

// 登录页面
class LoginPage extends BasePage {
  private selectors = {
    emailInput: '[data-testid="login-email"]',
    passwordInput: '[data-testid="login-password"]',
    loginButton: '[data-testid="login-submit"]',
    errorMessage: '[data-testid="login-error"]',
    emailError: '[data-testid="email-error"]',
    loadingSpinner: '[data-testid="loading-spinner"]',
    forgotPasswordLink: '[data-testid="forgot-password"]',
    rememberMeCheckbox: '[data-testid="remember-me"]',
  };

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await this.waitForSelector(this.selectors.loginButton);
  }

  async fillEmail(email: string): Promise<void> {
    await this.fill(this.selectors.emailInput, email);
  }

  async fillPassword(password: string): Promise<void> {
    await this.fill(this.selectors.passwordInput, password);
  }

  async clickLogin(): Promise<void> {
    await this.click(this.selectors.loginButton);
    await this.waitForNavigation();
  }

  async getErrorMessage(): Promise<string> {
    return this.getText(this.selectors.errorMessage);
  }

  async getEmailError(): Promise<string> {
    return this.getText(this.selectors.emailError);
  }

  async loginWithRememberMe(user: TestUser): Promise<StorageState> {
    await this.goto();
    await this.fillEmail(user.email);
    await this.fillPassword(user.password);
    await this.click(this.selectors.rememberMeCheckbox);
    await this.clickLogin();

    await this.waitForNavigation();
    await this.page.waitForLoadState('networkidle');

    return this.page.context().storageState();
  }
}

// 项目列表页面
class ProjectListPage extends BasePage {
  private selectors = {
    projectCards: '[data-testid="project-card"]',
    createButton: '[data-testid="create-project-button"]',
    searchInput: '[data-testid="project-search"]',
    filterDropdown: '[data-testid="project-filter"]',
    emptyState: '[data-testid="empty-state"]',
    pagination: '[data-testid="pagination"]',
    loadingSkeleton: '[data-testid="loading-skeleton"]',
  };

  async waitForProjectsLoad(): Promise<void> {
    await this.page.waitForSelector(this.selectors.projectCards, { state: 'visible' });
    await this.page.waitForLoadState('networkidle');
  }

  async getProjectCount(): Promise<number> {
    return this.page.locator(this.selectors.projectCards).count();
  }

  async searchForProject(name: string): Promise<void> {
    await this.fill(this.selectors.searchInput, name);
    await this.page.waitForResponse(response =>
      response.url().includes('/api/projects') && response.status() === 200
    );
    await this.waitForProjectsLoad();
  }

  async clickProject(name: string): Promise<void> {
    await this.click(`[data-testid="project-card"][data-project-name="${name}"]`);
  }

  async createNewProject(): Promise<void> {
    await this.click(this.selectors.createButton);
  }
}
```

## 测试数据管理

### 测试工厂

```typescript
// 用户工厂
class UserFactory {
  private apiClient: APIClient;

  constructor() {
    this.apiClient = new APIClient();
  }

  async create(data?: Partial<User>): Promise<User> {
    const userData = {
      email: `user_${Date.now()}@test.com`,
      password: 'TestPassword123!',
      displayName: `Test User ${Date.now()}`,
      ...data,
    };

    const response = await this.apiClient.post('/auth/register', userData);
    return response.data as User;
  }

  async createWithProjects(count: number = 3): Promise<User & { projects: Project[] }> {
    const user = await this.create();
    const projects = await Promise.all(
      Array.from({ length: count }, () =>
        new ProjectFactory().create({ ownerId: user.id })
      )
    );

    return { ...user, projects };
  }

  async cleanup(email: string): Promise<void> {
    await this.apiClient.delete(`/users/by-email/${email}`);
  }
}

// 项目工厂
class ProjectFactory {
  async create(data?: Partial<Project>): Promise<Project> {
    const projectData = {
      name: `Test Project ${Date.now()}`,
      description: 'Created by E2E tests',
      type: 'web-application',
      ...data,
    };

    const response = await this.apiClient.post('/projects', projectData);
    return response.data as Project;
  }

  async createWithArtifacts(projectId: string): Promise<Project> {
    // 创建项目
    const project = await this.create({ id: projectId });

    // 创建制品
    await this.apiClient.post(`/projects/${projectId}/artifacts`, {
      type: 'source',
      files: [{ path: 'index.ts', content: 'console.log("test")' }],
    });

    return project;
  }
}

// 测试数据清理
class TestDataCleanup {
  private users: string[] = [];
  private projects: string[] = [];
  private apiClient: APIClient;

  async registerUser(email: string): Promise<void> {
    this.users.push(email);
  }

  async registerProject(id: string): Promise<void> {
    this.projects.push(id);
  }

  async cleanup(): Promise<void> {
    // 逆序删除（先删依赖项）
    for (const projectId of this.projects.reverse()) {
      try {
        await this.apiClient.delete(`/projects/${projectId}`);
      } catch (e) {
        console.warn(`Failed to delete project ${projectId}:`, e);
      }
    }

    for (const email of this.users.reverse()) {
      try {
        await this.apiClient.delete(`/users/by-email/${email}`);
      } catch (e) {
        console.warn(`Failed to delete user ${email}:`, e);
      }
    }
  }
}
```

## API测试

```typescript
// API集成测试
test.describe('Projects API', () => {
  let apiClient: APIClient;
  let authToken: string;
  let testUser: User;

  test.beforeAll(async () => {
    // 创建测试用户并获取token
    const response = await apiClient.post('/auth/register', {
      email: `api-test-${Date.now()}@test.com`,
      password: 'TestPassword123!',
    });
    testUser = response.data;
    authToken = response.data.token;
    apiClient.setAuthToken(authToken);
  });

  test.afterAll(async () => {
    // 清理测试用户
    await apiClient.delete(`/users/${testUser.id}`);
  });

  test('should create a project', async () => {
    const response = await apiClient.post('/projects', {
      name: 'API Test Project',
      description: 'Created by API test',
      type: 'web-application',
    });

    expect(response.status).toBe(201);
    expect(response.data).toMatchObject({
      name: 'API Test Project',
      status: 'draft',
    });
  });

  test('should list user projects', async () => {
    const response = await apiClient.get('/projects');

    expect(response.status).toBe(200);
    expect(response.data.items).toBeInstanceOf(Array);
    expect(response.data.totalCount).toBeGreaterThan(0);
  });

  test('should get project by ID', async () => {
    // 先创建一个项目
    const createResponse = await apiClient.post('/projects', {
      name: 'Get Test Project',
      type: 'cli-tool',
    });

    const projectId = createResponse.data.id;
    const getResponse = await apiClient.get(`/projects/${projectId}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.data.id).toBe(projectId);
  });

  test('should update project', async () => {
    const project = await apiClient.post('/projects', {
      name: 'Update Test',
      type: 'library',
    });

    const updateResponse = await apiClient.patch(`/projects/${project.data.id}`, {
      name: 'Updated Name',
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.data.name).toBe('Updated Name');
  });

  test('should delete project', async () => {
    const project = await apiClient.post('/projects', {
      name: 'Delete Test',
      type: 'template',
    });

    const deleteResponse = await apiClient.delete(`/projects/${project.data.id}`);
    expect(deleteResponse.status).toBe(204);

    // 验证删除
    const getResponse = await apiClient.get(`/projects/${project.data.id}`);
    expect(getResponse.status).toBe(404);
  });

  test('should trigger generation', async () => {
    const project = await apiClient.post('/projects', {
      name: 'Generation Test',
      type: 'api-service',
    });

    const response = await apiClient.post(`/projects/${project.data.id}/generate`);

    expect(response.status).toBe(202);
    expect(response.data).toMatchObject({
      status: 'queued',
      projectId: project.data.id,
    });
  });
});
```

## 性能测试

```typescript
// 性能测试用例
test.describe('Performance Tests', () => {
  test('should load dashboard within 2 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;
    console.log(`Dashboard load time: ${loadTime}ms`);

    expect(loadTime).toBeLessThan(2000);
  });

  test('should complete login within 1 second', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const user = await new UserFactory().create();

    const startTime = Date.now();
    await loginPage.goto();
    await loginPage.fillEmail(user.email);
    await loginPage.fillPassword(user.password);
    await loginPage.clickLogin();
    await page.waitForURL('**/dashboard');

    const loginTime = Date.now() - startTime;
    console.log(`Login time: ${loginTime}ms`);

    expect(loginTime).toBeLessThan(1000);
  });

  test('should handle concurrent project creation', async ({ browser }) => {
    const context = await browser.newContext();
    const promises: Promise<any>[] = [];

    // 创建10个并发请求
    for (let i = 0; i < 10; i++) {
      const page = await context.newPage();
      promises.push(
        new ProjectFactory().create({ name: `Concurrent Project ${i}` })
      );
    }

    const results = await Promise.allSettled(promises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;

    expect(successCount).toBe(10);
  });
});

// 负载测试
test.describe('Load Tests', () => {
  test('should handle 100 concurrent users', async ({ browser }) => {
    const context = await browser.newContext();
    const users = await Promise.all(
      Array.from({ length: 100 }, () => new UserFactory().create())
    );

    const promises = users.map((user, index) =>
      (async () => {
        const page = await context.newPage();
        const loginPage = new LoginPage(page);

        await loginPage.goto();
        await loginPage.fillEmail(user.email);
        await loginPage.fillPassword(user.password);
        await loginPage.clickLogin();
        await page.waitForURL('**/dashboard', { timeout: 30000 });
        await page.close();
      })()
    );

    const results = await Promise.allSettled(promises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;

    expect(successCount).toBeGreaterThan(90); // 90%成功率
  });
});
```

## CI/CD集成

### GitHub Actions配置

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  e2e:
    timeout-minutes: 30
    strategy:
      matrix:
        shard: [1, 2, 3, 4]  # 分片并行
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

      - name: Build application
        run: npm run build

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests (shard ${{ matrix.shard }}/4)
        env:
          BASE_URL: ${{ secrets.E2E_BASE_URL }}
          API_URL: ${{ secrets.E2E_API_URL }}
        run: |
          npx playwright test \
            --shard=${{ matrix.shard }}/4 \
            --reporter=html \
            --trace=on-first-retry

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-results-shard-${{ matrix.shard }}
          path: |
            test-results/
            playwright-report/
            screenshots/
            traces/

      - name: Upload to Dashboards
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-results
          path: reports/e2e/results.json

  e2e-contract:
    timeout-minutes: 20
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run contract tests
        run: npm run test:contract
```

## 测试报告

### 报告配置

```typescript
// 自定义报告器
class CustomReporter implements Reporter {
  private results: TestResult[] = [];

  onTestEnd(test: TestCase, result: TestResult): void {
    this.results.push({
      testId: test.id,
      title: test.title,
      status: result.status,
      duration: result.duration,
      errors: result.errors,
      screenshots: result.attachments.filter(a => a.type === 'screenshot'),
    });
  }

  onEnd(): void {
    this.generateReport();
  }

  private generateReport(): void {
    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'passed').length,
      failed: this.results.filter(r => r.status === 'failed').length,
      flaky: this.results.filter(r => r.status === 'passed' && r.retries > 0).length,
      avgDuration: this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length,
    };

    // 生成HTML报告
    this.writeHtmlReport(summary, this.results);
  }
}
```

## 配置示例

```yaml
# E2E测试配置
e2e_testing:
  # 测试环境
  environments:
    local:
      base_url: "http://localhost:3000"
      api_url: "http://localhost:4000"
    staging:
      base_url: "https://staging.projectfactory.ai"
      api_url: "https://api-staging.projectfactory.ai"

  # 浏览器配置
  browsers:
    - name: "chromium"
      headless: true
      viewport:
        width: 1920
        height: 1080
    - name: "firefox"
      headless: true
    - name: "webkit"
      headless: true

  # 等待配置
  timeouts:
    default: 30000
    navigation: 30000
    action: 10000
    assertion: 5000

  # 重试配置
  retries:
    on_failure: 2
    on_timeout: 1

  # 截图和视频
  artifacts:
    screenshot_on_failure: true
    video: "on-failure"
    trace: "on-first-retry"

  # 测试隔离
  isolation:
    fresh_context: true
    fresh_storage: true
    isolate_databases: true
```

---

**最后更新**: 2026-04-14
