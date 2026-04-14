# Webhook 与集成平台设计

## 概述

本文档定义 ProjectFactory 系统的 Webhook 与集成平台架构，支持事件通知、第三方集成、自动化工作流和生态扩展，实现与外部系统的无缝连接。

## 1. Webhook 架构

### 1.1 Webhook 模型

```typescript
// src/integrations/webhook-model.ts

interface Webhook {
  id: string;
  name: string;
  description?: string;

  // 订阅者信息
  subscriber: {
    tenantId: string;
    userId: string;
    url: string;                    // Webhook 端点 URL
    secret?: string;                // 用于签名验证
  };

  // 订阅配置
  subscription: {
    // 事件类型
    events: WebhookEventType[];

    // 过滤条件
    filters?: WebhookFilter[];

    // 是否激活
    active: boolean;

    // 重试配置
    retry: {
      enabled: boolean;
      maxRetries: number;
      initialDelayMs: number;
      backoffMultiplier: number;
    };
  };

  // 交付配置
  delivery: {
    // 签名算法
    signatureAlgorithm: 'hmac-sha256' | 'hmac-sha512';

    // 超时
    timeoutMs: number;

    // 内容类型
    contentType: 'application/json' | 'application/x-www-form-urlencoded';

    // 是否包含元数据
    includeMetadata: boolean;
  };

  // 统计
  stats: {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    lastDeliveryAt?: Date;
    lastSuccessAt?: Date;
    lastFailureAt?: Date;
  };

  // 元数据
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

type WebhookEventType =
  // 项目事件
  | 'project.created'
  | 'project.started'
  | 'project.stage_changed'
  | 'project.completed'
  | 'project.failed'

  // 质量事件
  | 'quality.passed'
  | 'quality.failed'

  // 用户事件
  | 'user.created'
  | 'user.invited'

  // 资源配额事件
  | 'quota.warning'
  | 'quota.exceeded'

  // 系统事件
  | 'system.maintenance'
  | 'system.alert';

interface WebhookFilter {
  field: string;       // e.g., 'project.type', 'quality.score'
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: unknown;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;

  // 交付状态
  status: 'pending' | 'success' | 'failed' | 'retrying';

  // 请求信息
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: string;
  };

  // 响应信息
  response?: {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
    durationMs: number;
  };

  // 错误信息
  error?: {
    code: string;
    message: string;
    attempt: number;
  };

  // 时间
  createdAt: Date;
  completedAt?: Date;
  nextRetryAt?: Date;
}
```

### 1.2 Webhook 管理服务

```typescript
// src/integrations/webhook-service.ts

class WebhookService {
  private store: WebhookStore;
  private queue: MessageQueue;
  private signatureService: SignatureService;

  // 创建 Webhook
  async createWebhook(
    tenantId: string,
    userId: string,
    config: {
      name: string;
      url: string;
      events: WebhookEventType[];
      secret?: string;
      filters?: WebhookFilter[];
    }
  ): Promise<Webhook> {
    // 验证 URL
    await this.validateUrl(config.url);

    // 生成 secret（如果未提供）
    const secret = config.secret || this.generateSecret();

    const webhook: Webhook = {
      id: generateId(),
      name: config.name,
      subscriber: {
        tenantId,
        userId,
        url: config.url,
        secret,
      },
      subscription: {
        events: config.events,
        filters: config.filters,
        active: true,
        retry: {
          enabled: true,
          maxRetries: 3,
          initialDelayMs: 1000,
          backoffMultiplier: 2,
        },
      },
      delivery: {
        signatureAlgorithm: 'hmac-sha256',
        timeoutMs: 30000,
        contentType: 'application/json',
        includeMetadata: true,
      },
      stats: {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
    };

    await this.store.save(webhook);

    return webhook;
  }

  // 更新 Webhook
  async updateWebhook(
    webhookId: string,
    updates: Partial<{
      name: string;
      url: string;
      events: WebhookEventType[];
      filters: WebhookFilter[];
      active: boolean;
      retry: Webhook['subscription']['retry'];
    }>
  ): Promise<Webhook> {
    const webhook = await this.store.findById(webhookId);

    if (!webhook) {
      throw new NotFoundError('Webhook');
    }

    if (updates.url) {
      await this.validateUrl(updates.url);
    }

    const updated = {
      ...webhook,
      ...updates,
      updatedAt: new Date(),
    };

    await this.store.save(updated);

    return updated;
  }

  // 删除 Webhook
  async deleteWebhook(webhookId: string): Promise<void> {
    await this.store.delete(webhookId);
  }

  // 测试 Webhook
  async testWebhook(webhookId: string): Promise<WebhookDelivery> {
    const webhook = await this.store.findById(webhookId);

    if (!webhook) {
      throw new NotFoundError('Webhook');
    }

    // 发送测试事件
    const testEvent = this.createTestEvent(webhook);

    return await this.deliverEvent(testEvent, webhook);
  }

  // 触发 Webhook 事件
  async trigger(
    eventType: WebhookEventType,
    payload: Record<string, unknown>
  ): Promise<void> {
    // 查找所有订阅该事件的 Webhook
    const webhooks = await this.store.findByEventType(eventType);

    for (const webhook of webhooks) {
      // 应用过滤器
      if (webhook.subscription.filters) {
        if (!this.matchesFilters(payload, webhook.subscription.filters)) {
          continue;
        }
      }

      // 创建事件
      const event: WebhookEvent = {
        id: generateId(),
        webhookId: webhook.id,
        eventType,
        payload,
        timestamp: new Date(),
        tenantId: webhook.subscriber.tenantId,
      };

      // 加入交付队列
      await this.queue.enqueue('webhook-deliveries', event);
    }
  }

  // 交付事件
  async deliverEvent(
    event: WebhookEvent,
    webhook: Webhook
  ): Promise<WebhookDelivery> {
    const delivery: WebhookDelivery = {
      id: generateId(),
      webhookId: webhook.id,
      eventId: event.id,
      status: 'pending',
      request: {
        url: webhook.subscriber.url,
        method: 'POST',
        headers: this.buildHeaders(webhook, event),
        body: JSON.stringify(this.buildPayload(webhook, event)),
      },
      createdAt: new Date(),
    };

    try {
      // 发送请求
      const startTime = Date.now();
      const response = await this.sendRequest(delivery.request, webhook.delivery.timeoutMs);
      const duration = Date.now() - startTime;

      delivery.status = 'success';
      delivery.response = {
        statusCode: response.statusCode,
        headers: response.headers,
        body: response.body,
        durationMs: duration,
      };
      delivery.completedAt = new Date();

      // 更新统计
      await this.updateStats(webhook.id, { successfulDeliveries: 1 });

    } catch (error) {
      delivery.status = 'failed';
      delivery.error = {
        code: (error as Error).name,
        message: (error as Error).message,
        attempt: 1,
      };

      // 检查是否需要重试
      if (webhook.subscription.retry.enabled) {
        await this.scheduleRetry(delivery, webhook);
      }

      await this.updateStats(webhook.id, { failedDeliveries: 1 });
    }

    // 记录交付
    await this.store.saveDelivery(delivery);

    return delivery;
  }

  // 构建请求头
  private buildHeaders(webhook: Webhook, event: WebhookEvent): Record<string, string> {
    const body = JSON.stringify(this.buildPayload(webhook, event));
    const signature = this.signatureService.sign(
      body,
      webhook.subscriber.secret!,
      webhook.delivery.signatureAlgorithm
    );

    const headers: Record<string, string> = {
      'Content-Type': webhook.delivery.contentType,
      'X-Webhook-Event': event.eventType,
      'X-Webhook-Delivery-Id': event.id,
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': event.timestamp.toISOString(),
    };

    return headers;
  }

  // 构建载荷
  private buildPayload(webhook: Webhook, event: WebhookEvent): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      event: event.eventType,
      timestamp: event.timestamp.toISOString(),
      data: event.payload,
    };

    if (webhook.delivery.includeMetadata) {
      payload.metadata = {
        deliveryId: event.id,
        webhookId: webhook.id,
        version: '1.0',
      };
    }

    return payload;
  }
}
```

### 1.3 签名验证

```typescript
// src/integrations/signature-service.ts

// Webhook 签名验证
class SignatureService {
  // 生成签名
  sign(
    payload: string,
    secret: string,
    algorithm: 'hmac-sha256' | 'hmac-sha512'
  ): string {
    const hmac = algorithm === 'hmac-sha256'
      ? crypto.createHmac('sha256', secret)
      : crypto.createHmac('sha512', secret);

    hmac.update(payload, 'utf8');

    return `${algorithm.split('-')[1]}=${hmac.digest('hex')}`;
  }

  // 验证签名
  verify(
    payload: string,
    signature: string,
    secret: string,
    algorithm: 'hmac-sha256' | 'hmac-sha512',
    timestamp?: Date
  ): boolean {
    // 检查时间戳（防止重放攻击）
    if (timestamp) {
      const age = Date.now() - timestamp.getTime();
      const maxAge = 5 * 60 * 1000;  // 5 分钟

      if (age > maxAge) {
        console.warn('Webhook timestamp too old, possible replay attack');
        return false;
      }
    }

    // 计算期望的签名
    const expectedSignature = this.sign(payload, secret, algorithm);

    // 使用定时安全比较
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  // Express 中间件：验证 Webhook 签名
  verifyWebhookSignature(secretProvider: (req: Request) => string | Promise<string>) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const signature = req.headers['x-webhook-signature'] as string;
      const timestamp = req.headers['x-webhook-timestamp'] as string;

      if (!signature) {
        res.status(401).json({ error: 'Missing signature' });
        return;
      }

      const secret = await secretProvider(req);
      const timestampDate = timestamp ? new Date(parseInt(timestamp) * 1000) : undefined;

      const rawBody = (req as any).rawBody;

      const isValid = this.verify(
        rawBody,
        signature,
        secret,
        'hmac-sha256',
        timestampDate
      );

      if (!isValid) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      next();
    };
  }
}
```

## 2. 第三方集成

### 2.1 集成模型

```typescript
// src/integrations/integration-model.ts

interface Integration {
  id: string;
  type: IntegrationType;
  name: string;
  description?: string;

  // 租户信息
  tenantId: string;

  // 连接配置
  config: IntegrationConfig;

  // 认证信息
  auth: {
    type: 'api_key' | 'oauth2' | 'basic' | 'bearer';
    credentials: EncryptedCredentials;
    expiresAt?: Date;
  };

  // 状态
  status: 'disconnected' | 'connected' | 'error' | 'pending';

  // 最后同步
  lastSyncAt?: Date;
  lastError?: string;

  // 元数据
  createdAt: Date;
  updatedAt: Date;
}

type IntegrationType =
  | 'github'
  | 'gitlab'
  | 'slack'
  | 'discord'
  | 'jira'
  | 'linear'
  | 'notion'
  | 'figma'
  | 'aws'
  | 'gcp'
  | 'azure';

type IntegrationConfig =
  | GitHubConfig
  | SlackConfig
  | JiraConfig
  | GenericConfig;

interface GitHubConfig {
  repository: string;
  branch?: string;
  defaultBranch?: string;
  webhookSecret?: string;
  prTemplate?: string;
}

interface SlackConfig {
  workspaceId: string;
  workspaceName: string;
  defaultChannel?: string;
  notificationEvents: string[];
}

interface JiraConfig {
  siteUrl: string;
  projectKey: string;
  issueType?: string;
  autoCreateIssues?: boolean;
}

// 加密凭证
interface EncryptedCredentials {
  encrypted: string;
  algorithm: string;
  iv: string;
}
```

### 2.2 GitHub 集成

```typescript
// src/integrations/github-integration.ts

class GitHubIntegration {
  private config: GitHubConfig;
  private httpClient: HttpClient;
  private eventEmitter: EventEmitter;

  constructor(config: GitHubConfig, credentials: { token: string }) {
    this.config = config;
    this.httpClient = new HttpClient({
      baseURL: 'https://api.github.com',
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
  }

  // 创建仓库
  async createRepository(
    name: string,
    options?: {
      description?: string;
      private?: boolean;
      autoInit?: boolean;
    }
  ): Promise<GitHubRepository> {
    const response = await this.httpClient.post('/user/repos', {
      name,
      description: options?.description || '',
      private: options?.private ?? true,
      auto_init: options?.autoInit ?? true,
    });

    return response.data;
  }

  // 创建文件
  async createFile(
    repo: string,
    path: string,
    content: string,
    message: string,
    options?: { branch?: string }
  ): Promise<GitHubFile> {
    const encodedContent = Buffer.from(content).toString('base64');

    const response = await this.httpClient.put(
      `/repos/${this.config.repository}/contents/${path}`,
      {
        message,
        content: encodedContent,
        branch: options?.branch || this.config.branch,
      }
    );

    return response.data;
  }

  // 创建 Pull Request
  async createPullRequest(
    title: string,
    body: string,
    head: string,
    base?: string
  ): Promise<GitHubPR> {
    const response = await this.httpClient.post(
      `/repos/${this.config.repository}/pulls`,
      {
        title,
        body,
        head,
        base: base || this.config.defaultBranch || 'main',
      }
    );

    return response.data;
  }

  // 创建 Issue
  async createIssue(
    title: string,
    body?: string,
    options?: {
      labels?: string[];
      assignees?: string[];
    }
  ): Promise<GitHubIssue> {
    const response = await this.httpClient.post(
      `/repos/${this.config.repository}/issues`,
      {
        title,
        body,
        labels: options?.labels,
        assignees: options?.assignees,
      }
    );

    return response.data;
  }

  // 设置 Webhook
  async setupWebhook(webhookUrl: string, events: string[]): Promise<void> {
    await this.httpClient.post(`/repos/${this.config.repository}/hooks`, {
      url: webhookUrl,
      content_type: 'json',
      insecure_ssl: '0',
      events,
      active: true,
    });
  }

  // 获取提交状态
  async getCommitStatus(
    sha: string
  ): Promise<{ state: string; checks: GitHubCheck[] }> {
    const response = await this.httpClient.get(
      `/repos/${this.config.repository}/commits/${sha}/status`
    );

    return {
      state: response.data.state,
      checks: response.data.statuses || [],
    };
  }

  // 触发工作流
  async triggerWorkflow(
    workflowId: string,
    inputs?: Record<string, string>
  ): Promise<void> {
    await this.httpClient.post(
      `/repos/${this.config.repository}/actions/workflows/${workflowId}/dispatches`,
      {
        ref: this.config.branch || 'main',
        inputs,
      }
    );
  }
}

// GitHub Webhook 事件处理
class GitHubWebhookHandler {
  handleEvent(event: GitHubWebhookEvent): void {
    switch (event.type) {
      case 'push':
        this.handlePush(event.payload);
        break;

      case 'pull_request':
        this.handlePullRequest(event.payload);
        break;

      case 'check_run':
      case 'check_suite':
        this.handleCheck(event.payload);
        break;

      case 'installation':
        this.handleInstallation(event.payload);
        break;

      default:
        console.log(`Unhandled GitHub webhook event: ${event.type}`);
    }
  }

  private async handleCheck(payload: any): Promise<void> {
    const { action, check_run, repository } = payload;

    // 触发项目状态更新
    await projectService.updateStatusFromGitHub({
      repository: repository.full_name,
      sha: check_run.head_sha,
      status: check_run.conclusion,
      checkName: check_run.name,
    });
  }
}
```

### 2.3 Slack 集成

```typescript
// src/integrations/slack-integration.ts

class SlackIntegration {
  private config: SlackConfig;
  private client: SlackWebClient;

  constructor(config: SlackConfig, credentials: { botToken: string }) {
    this.config = config;
    this.client = new SlackWebClient(credentials.botToken);
  }

  // 发送消息
  async sendMessage(
    channel: string,
    message: string | SlackMessageBlock[]
  ): Promise<SlackMessage> {
    const result = await this.client.chat.postMessage({
      channel,
      text: typeof message === 'string' ? message : undefined,
      blocks: typeof message === 'string' ? undefined : message,
    });

    return result as SlackMessage;
  }

  // 发送项目完成通知
  async notifyProjectComplete(
    project: { id: string; name: string; qualityScore: number }
  ): Promise<void> {
    const message = this.buildProjectCompleteMessage(project);

    await this.sendMessage(
      this.config.defaultChannel!,
      message
    );
  }

  // 发送质量问题告警
  async notifyQualityIssue(
    project: { id: string; name: string },
    issue: { type: string; message: string }
  ): Promise<void> {
    const message = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚠️ Quality Issue Detected',
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Project:*\n${project.name}` },
          { type: 'mrkdwn', text: `*Issue:*\n${issue.type}` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: issue.message,
        },
      },
    ];

    await this.sendMessage(
      this.config.defaultChannel!,
      message
    );
  }

  // 发送每日摘要
  async sendDailySummary(summary: DailySummary): Promise<void> {
    const message = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 Daily Project Summary',
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Projects Completed*\n${summary.projectsCompleted}`,
          },
          {
            type: 'mrkdwn',
            text: `*Success Rate*\n${summary.successRate}%`,
          },
          {
            type: 'mrkdwn',
            text: `*Total Cost*\n$${summary.totalCost.toFixed(2)}`,
          },
        ],
      },
    ];

    await this.sendMessage(
      this.config.defaultChannel!,
      message
    );
  }

  private buildProjectCompleteMessage(
    project: { id: string; name: string; qualityScore: number }
  ): SlackMessageBlock[] {
    const qualityEmoji = project.qualityScore >= 80 ? '✅' :
                         project.qualityScore >= 60 ? '⚠️' : '❌';

    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${qualityEmoji} Project Completed`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Project:*\n${project.name}` },
          { type: 'mrkdwn', text: `*Quality Score:*\n${project.qualityScore}/100` },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Project' },
            url: `https://projectfactory.io/projects/${project.id}`,
          },
        ],
      },
    ];
  }
}
```

## 3. OAuth 集成

### 3.1 OAuth 2.0 提供商

```typescript
// src/integrations/oauth-provider.ts

// OAuth 2.0 配置
interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
}

class OAuthProvider {
  // 生成授权 URL
  getAuthorizationUrl(
    state: string,
    codeVerifier?: string
  ): { url: string; codeChallenge?: string } {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      state,
    });

    if (codeVerifier) {
      const codeChallenge = this.generateCodeChallenge(codeVerifier);
      params.set('code_challenge', codeChallenge);
      params.set('code_challenge_method', 'S256');
    }

    return {
      url: `${this.config.authorizationUrl}?${params.toString()}`,
      codeChallenge,
    };
  }

  // 交换 Access Token
  async exchangeCodeForToken(
    code: string,
    codeVerifier?: string
  ): Promise<OAuthTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      redirect_uri: this.config.redirectUri,
    });

    if (codeVerifier) {
      params.set('code_verifier', codeVerifier);
    }

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`OAuth token exchange failed: ${response.statusText}`);
    }

    return response.json();
  }

  // 刷新 Access Token
  async refreshToken(refreshToken: string): Promise<OAuthTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: refreshToken,
    });

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    return response.json();
  }

  // PKCE Code Challenge
  private generateCodeChallenge(codeVerifier: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(codeVerifier);
    const digest = hash.digest('baseurl');
    return digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
}

// 预配置的 OAuth 提供商
const OAuthProviders: Record<string, OAuthConfig> = {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    redirectUri: 'https://projectfactory.io/integrations/github/callback',
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['repo', 'read:user', 'write:packages', 'notifications'],
  },

  slack: {
    clientId: process.env.SLACK_CLIENT_ID!,
    clientSecret: process.env.SLACK_CLIENT_SECRET!,
    redirectUri: 'https://projectfactory.io/integrations/slack/callback',
    authorizationUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes: ['chat:write', 'channels:read', 'groups:read', 'im:read'],
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: 'https://projectfactory.io/integrations/google/callback',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['openid', 'email', 'profile'],
  },
};
```

## 4. 集成工作流

### 4.1 自动化工作流

```typescript
// src/integrations/automation-workflows.ts

interface AutomationWorkflow {
  id: string;
  name: string;
  description?: string;
  tenantId: string;

  // 触发器
  trigger: {
    type: 'event' | 'schedule' | 'webhook';
    config: TriggerConfig;
  };

  // 条件
  conditions?: WorkflowCondition[];

  // 操作
  actions: WorkflowAction[];

  // 状态
  enabled: boolean;

  // 统计
  stats: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    lastRunAt?: Date;
  };

  createdAt: Date;
  updatedAt: Date;
}

type TriggerConfig =
  | { type: 'event'; eventType: string }
  | { type: 'schedule'; cron: string }
  | { type: 'webhook'; hookId: string };

interface WorkflowCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains';
  value: unknown;
}

type WorkflowAction =
  | { type: 'send_email'; template: string; to: string[] }
  | { type: 'send_webhook'; url: string; method: string; body: unknown }
  | { type: 'create_issue'; provider: string; config: Record<string, unknown> }
  | { type: 'update_record'; table: string; id: string; data: Record<string, unknown> }
  | { type: 'notify_slack'; channel: string; message: string }
  | { type: 'delay'; durationMs: number }
  | { type: 'condition'; conditions: WorkflowCondition[]; thenActions: WorkflowAction[]; elseActions?: WorkflowAction[] };

// 工作流引擎
class WorkflowEngine {
  private store: WorkflowStore;
  private eventBus: EventBus;

  // 执行工作流
  async execute(workflow: AutomationWorkflow, triggerData: unknown): Promise<void> {
    // 检查条件
    if (workflow.conditions && !this.evaluateConditions(workflow.conditions, triggerData)) {
      console.log(`Workflow ${workflow.id} conditions not met, skipping`);
      return;
    }

    // 执行操作
    for (const action of workflow.actions) {
      try {
        await this.executeAction(action, triggerData);
      } catch (error) {
        console.error(`Workflow ${workflow.id} action failed:`, error);

        // 记录失败
        await this.recordFailure(workflow.id, action, error as Error);

        // 如果是关键操作失败，停止工作流
        if (this.isCriticalAction(action)) {
          throw error;
        }
      }
    }

    // 更新统计
    await this.updateStats(workflow.id, { successfulRuns: 1 });
  }

  private async executeAction(
    action: WorkflowAction,
    context: unknown
  ): Promise<void> {
    switch (action.type) {
      case 'send_email':
        await this.sendEmail(action, context);
        break;

      case 'send_webhook':
        await this.sendWebhook(action, context);
        break;

      case 'create_issue':
        await this.createIssue(action, context);
        break;

      case 'notify_slack':
        await this.notifySlack(action, context);
        break;

      case 'delay':
        await this.delay(action.durationMs);
        break;

      case 'condition':
        await this.executeConditional(action, context);
        break;
    }
  }

  private async sendWebhook(
    action: { type: 'send_webhook'; url: string; method: string; body: unknown },
    context: unknown
  ): Promise<void> {
    const resolvedBody = this.resolveTemplate(action.body, context);

    await fetch(action.url, {
      method: action.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resolvedBody),
    });
  }

  private async executeConditional(
    action: WorkflowAction & { conditions: WorkflowCondition[]; thenActions: WorkflowAction[]; elseActions?: WorkflowAction[] },
    context: unknown
  ): Promise<void> {
    const result = this.evaluateConditions(action.conditions, context);

    const actionsToExecute = result ? action.thenActions : (action.elseActions || []);

    for (const subAction of actionsToExecute) {
      await this.executeAction(subAction, context);
    }
  }

  private resolveTemplate(template: unknown, context: unknown): unknown {
    if (typeof template === 'string') {
      // 简单的模板替换 {{variable.path}}
      return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
        const value = this.getNestedValue(context, path.trim());
        return String(value ?? '');
      });
    }

    if (Array.isArray(template)) {
      return template.map(item => this.resolveTemplate(item, context));
    }

    if (typeof template === 'object' && template !== null) {
      const resolved: any = {};
      for (const [key, value] of Object.entries(template)) {
        resolved[key] = this.resolveTemplate(value, context);
      }
      return resolved;
    }

    return template;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

// 预定义工作流模板
const WorkflowTemplates = [
  {
    name: 'Project Complete Notification',
    description: '项目完成时发送通知',
    trigger: { type: 'event', eventType: 'project.completed' },
    actions: [
      {
        type: 'notify_slack',
        channel: '#projects',
        message: '✅ Project {{project.name}} completed with quality score {{project.qualityScore}}',
      },
    ],
  },
  {
    name: 'Quality Alert',
    description: '质量分数低于阈值时创建 GitHub Issue',
    trigger: { type: 'event', eventType: 'quality.failed' },
    conditions: [
      { field: 'quality.score', operator: 'lt', value: 70 },
    ],
    actions: [
      {
        type: 'create_issue',
        provider: 'github',
        config: {
          title: 'Quality Alert: {{project.name}}',
          body: 'Quality score {{quality.score}} is below threshold',
          labels: ['bug', 'quality'],
        },
      },
    ],
  },
];
```

---

**最后更新**: 2026-04-14
**版本**: v1.0
