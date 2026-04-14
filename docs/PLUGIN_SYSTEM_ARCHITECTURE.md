# 插件系统与扩展性架构

## 概述

本文档定义 ProjectFactory 系统的插件系统（Plugin System）与扩展性（Extensibility）架构，支持第三方开发者扩展系统功能、实现自定义工作流、构建插件市场，实现生态开放与核心系统的平衡。

## 1. 插件架构概述

### 1.1 插件类型分类

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           插件类型层级                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  🔌 Agent 插件                                                             │
│  ├── 自定义 Agent（新的角色如安全审查员、性能优化专家）                      │
│  ├── Agent 扩展（扩展现有 Agent 的能力）                                    │
│  └── Agent 模板（预配置的 Agent 组合）                                      │
│                                                                              │
│  🎯 触发器插件                                                              │
│  ├── 事件触发器（GitHub Star、Slack 消息、定时任务）                        │
│  ├── Webhook 接收器（接收外部系统事件）                                     │
│  └── 条件触发器（质量阈值、资源配额）                                       │
│                                                                              │
│  📦 动作插件                                                                │
│  ├── 通知动作（邮件、Slack、Discord、短信）                                  │
│  ├── 集成动作（GitHub PR、 Jira Issue、Linear Task）                        │
│  └── 自定义动作（运行脚本、调用 API）                                        │
│                                                                              │
│  🎨 UI 插件                                                                │
│  ├── 页面扩展（在 Dashboard 中添加新页面）                                   │
│  ├── 组件扩展（自定义项目卡片、统计图表）                                   │
│  └── 小部件（Widget、快捷操作）                                             │
│                                                                              │
│  📊 分析插件                                                                │
│  ├── 自定义指标（业务特定指标）                                             │
│  ├── 报告生成器                                                             │
│  └── 数据导出器                                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 插件架构原则

| 原则 | 描述 | 实现方式 |
|------|------|----------|
| 沙箱隔离 | 插件运行在隔离环境，不影响核心系统 | 独立进程/Worker |
| 版本解耦 | 插件与核心系统独立演进 | 语义版本+兼容层 |
| 接口稳定 | 核心 API 向后兼容 | 契约测试 |
| 热插拔 | 无需重启即可加载/卸载插件 | 动态加载 |
| 权限最小化 | 插件只获取必要权限 | Capability System |

## 2. 插件模型

### 2.1 插件定义

```typescript
// src/plugins/plugin-model.ts

interface Plugin {
  // 标识
  id: string;
  name: string;
  version: string;
  description: string;

  // 分类
  category: PluginCategory;

  // 插件类型（主类型）
  type: PluginType;

  // 入口
  entry: {
    main: string;           // 主入口文件
    renderer?: string;       // UI 插件渲染入口
    worker?: string;         // 后台任务入口
  };

  // 权限需求
  permissions: Permission[];

  // 依赖
  dependencies: PluginDependency[];

  // 配置 Schema
  configSchema: JSONSchema;

  // 作者
  author: {
    name: string;
    email?: string;
    url?: string;
  };

  // 生命周期钩子
  hooks?: PluginHooks;

  // 扩展点
  extensions?: ExtensionPoint[];

  // 元数据
  manifest: PluginManifest;
  createdAt: Date;
  updatedAt: Date;
}

type PluginCategory =
  | 'agent'
  | 'trigger'
  | 'action'
  | 'ui'
  | 'analytics'
  | 'integration'
  | 'utility';

type PluginType =
  | 'agent'           // Agent 插件
  | 'trigger'         // 触发器插件
  | 'action'          // 动作插件
  | 'ui'              // UI 插件
  | 'integration'      // 集成插件
  | 'composite';      // 复合插件（包含多种类型）

interface PluginManifest {
  schemaVersion: string;     // 清单格式版本
  apiVersion: string;       // 要求的 API 版本
  minCoreVersion?: string;   // 最低核心版本
  maxCoreVersion?: string;   // 最高核心版本
  experimental: boolean;      // 实验性插件
  deprecated: boolean;       // 已废弃
  tags: string[];
  screenshots?: string[];
  changelog?: string;
}

interface PluginDependency {
  pluginId: string;
  versionRange: string;      // e.g., "^1.0.0" or ">=1.0.0 <2.0.0"
  optional: boolean;
}

// 权限定义
interface Permission {
  name: string;
  description: string;
  dangerous: boolean;         // 危险权限需要确认
}

// 插件生命周期钩子
interface PluginHooks {
  // 安装/卸载
  onInstall?: (context: PluginContext) => Promise<void>;
  onUninstall?: (context: PluginContext) => Promise<void>;
  onEnable?: (context: PluginContext) => Promise<void>;
  onDisable?: (context: PluginContext) => Promise<void>;

  // 升级
  onUpgrade?: (context: PluginContext, fromVersion: string) => Promise<void>;

  // 生命周期
  onStartup?: (context: PluginContext) => Promise<void>;
  onShutdown?: (context: PluginContext) => Promise<void>;
}

// 扩展点定义
interface ExtensionPoint {
  id: string;
  name: string;
  description: string;
  type: 'agent' | 'trigger' | 'action' | 'ui' | 'filter';
  schema: JSONSchema;         // 扩展配置 Schema
}
```

### 2.2 Agent 插件模型

```typescript
// src/plugins/agent/plugin-agent.ts

interface AgentPlugin {
  // 基础信息
  id: string;
  name: string;
  version: string;

  // Agent 配置
  agent: {
    // Agent 类型
    type: 'idea-generator' | 'architect' | 'coder' | 'tester' | 'reviewer' | 'optimizer' | 'custom';

    // 角色定义
    role: {
      name: string;           // e.g., 'security-reviewer'
      description: string;
      capabilities: string[];
    };

    // Prompt 模板
    prompt?: {
      system?: string;
      user?: string;
      examples?: Array<{ input: string; output: string }>;
    };

    // 工具定义
    tools?: AgentTool[];

    // 行为配置
    behavior: {
      maxIterations?: number;
      timeoutMs?: number;
      temperature?: number;
      fallbackModel?: string;
    };
  };

  // 与核心系统集成
  integration: {
    // 订阅的事件
    subscribeEvents?: string[];

    // 触发的工作流阶段
    triggerStages?: ProjectStage[];

    // 优先级（多个 Agent 时的执行顺序）
    priority?: number;
  };
}

interface AgentTool {
  id: string;
  name: string;
  description: string;

  // 输入 Schema
  inputSchema: JSONSchema;

  // 输出 Schema
  outputSchema: JSONSchema;

  // 执行函数
  handler: string;  // 指向插件中的函数

  // 权限需求
  requiredPermissions?: string[];
}

type ProjectStage =
  | 'idea-generation'
  | 'architecture'
  | 'code-generation'
  | 'testing'
  | 'review'
  | 'optimization'
  | 'git-commit'
  | 'completion';
```

### 2.3 触发器和动作插件

```typescript
// src/plugins/trigger/plugin-trigger.ts

interface TriggerPlugin {
  id: string;
  name: string;

  // 触发器类型
  type: 'event' | 'schedule' | 'webhook' | 'poll' | 'manual';

  // 触发器配置
  config: {
    // 事件类型（如果是事件触发器）
    eventTypes?: string[];

    // Cron 表达式（如果是定时触发器）
    cron?: string;

    // Webhook 路径（如果是 Webhook 触发器）
    webhookPath?: string;

    // 轮询间隔（如果是轮询触发器）
    pollIntervalMs?: number;

    // 轮询端点
    pollEndpoint?: string;
  };

  // 过滤器
  filters?: TriggerFilter[];

  // 条件
  conditions?: TriggerCondition[];

  // 触发时执行的动作
  actions: TriggeredAction[];
}

interface TriggerFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'matches';
  value: unknown;
}

interface TriggerCondition {
  type: 'javascript' | 'jsonata' | 'sql';
  expression: string;
}

interface TriggeredAction {
  // 动作类型
  actionType: 'workflow' | 'agent' | 'webhook' | 'notification' | 'custom';

  // 动作配置
  config: Record<string, unknown>;

  // 输入映射
  inputMapping?: Record<string, string>;

  // 错误处理
  onError?: {
    action: 'continue' | 'stop' | 'retry';
    maxRetries?: number;
  };
}

interface ActionPlugin {
  id: string;
  name: string;

  // 动作定义
  action: {
    id: string;
    name: string;
    description: string;

    // 输入 Schema
    inputSchema: JSONSchema;

    // 输出 Schema
    outputSchema: JSONSchema;

    // 执行函数
    handler: string;

    // 权限需求
    requiredPermissions?: string[];

    // 超时配置
    timeoutMs?: number;
  };

  // UI 配置（如果需要用户输入）
  ui?: {
    label: string;
    description?: string;
    icon?: string;
    fields: UIField[];
  };
}

interface UIField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'code' | 'json';
  label: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: unknown }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}
```

## 3. 插件运行环境

### 3.1 插件隔离容器

```typescript
// src/plugins/runtime/plugin-container.ts

// 插件隔离容器
class PluginContainer {
  private plugin: Plugin;
  private worker: Worker | null = null;
  private api: PluginAPI;
  private state: PluginState;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    this.state = {
      status: 'loaded',
      errors: [],
      metrics: {},
    };
  }

  // 初始化插件
  async initialize(context: PluginContext): Promise<void> {
    // 1. 验证权限
    await this.validatePermissions();

    // 2. 创建隔离的 API 桥接
    this.api = this.createAPIBridge(context);

    // 3. 加载插件代码
    await this.loadPluginCode();

    // 4. 调用安装钩子
    if (this.plugin.hooks?.onInstall) {
      await this.plugin.hooks.onInstall(context);
    }

    this.state.status = 'initialized';
  }

  // 执行插件主入口
  async execute(entry: string, params: unknown): Promise<unknown> {
    if (this.state.status !== 'initialized' && this.state.status !== 'running') {
      throw new Error(`Plugin ${this.plugin.id} is not initialized`);
    }

    // 使用 Worker 执行以隔离
    return await this.executeInWorker(entry, params);
  }

  // 销毁插件
  async dispose(): Promise<void> {
    // 1. 调用卸载钩子
    if (this.plugin.hooks?.onUninstall) {
      await this.plugin.hooks.onUninstall(this.api.getContext());
    }

    // 2. 终止 Worker
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.state.status = 'disposed';
  }

  // 创建 API 桥接（限制插件可访问的 API）
  private createAPIBridge(context: PluginContext): PluginAPI {
    return {
      // 受限的项目 API
      projects: {
        list: this.wrapMethod(context.projects.list, ['list']),
        get: this.wrapMethod(context.projects.get, ['get']),
        create: this.wrapMethod(context.projects.create, ['create']),
        update: this.wrapMethod(context.projects.update, ['update']),
        delete: this.wrapMethod(context.projects.delete, ['delete']),
      },

      // 受限的文件 API
      files: {
        read: this.wrapMethod(context.files.read, ['read']),
        write: this.wrapMethod(context.files.write, ['write']),
        list: this.wrapMethod(context.files.list, ['list']),
      },

      // 配置 API（只读）
      config: this.createReadOnlyProxy(context.config),

      // 日志 API
      logger: {
        info: (message: string, meta?: Record<string, unknown>) => {
          console.log(`[Plugin:${this.plugin.id}]`, message, meta);
        },
        warn: (message: string, meta?: Record<string, unknown>) => {
          console.warn(`[Plugin:${this.plugin.id}]`, message, meta);
        },
        error: (message: string, meta?: Record<string, unknown>) => {
          console.error(`[Plugin:${this.plugin.id}]`, message, meta);
        },
      },

      // HTTP 客户端（受限）
      http: this.createRestrictedHTTPClient(),

      // 存储 API（插件私有存储）
      storage: {
        get: (key: string) => this.pluginStorage.get(`${this.plugin.id}:${key}`),
        set: (key: string, value: unknown) => this.pluginStorage.set(`${this.plugin.id}:${key}`, value),
        delete: (key: string) => this.pluginStorage.delete(`${this.plugin.id}:${key}`),
      },

      // 事件发布
      events: {
        emit: (event: string, data: unknown) => context.eventBus.emit(event, data),
        subscribe: (event: string, handler: EventHandler) =>
          context.eventBus.subscribe(event, handler),
      },

      // 上下文信息
      context: {
        pluginId: this.plugin.id,
        pluginVersion: this.plugin.version,
        tenantId: context.tenantId,
        userId: context.userId,
        permissions: this.plugin.permissions,
      },
    };
  }

  // 创建受限的 HTTP 客户端
  private createRestrictedHTTPClient(): RestrictedHTTPClient {
    return {
      async get(url: string, options?: RequestInit): Promise<Response> {
        // 验证 URL 白名单
        if (!this.isAllowedURL(url)) {
          throw new Error(`URL not allowed: ${url}`);
        }
        return fetch(url, { ...options, method: 'GET' });
      },

      async post(url: string, data: unknown, options?: RequestInit): Promise<Response> {
        if (!this.isAllowedURL(url)) {
          throw new Error(`URL not allowed: ${url}`);
        }
        return fetch(url, {
          ...options,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      },

      isAllowedURL(url: string): boolean {
        // 检查是否在允许的域名列表中
        const allowedDomains = this.plugin.permissions
          .filter(p => p.name.startsWith('http:'))
          .map(p => p.name.substring(5));

        try {
          const parsed = new URL(url);
          return allowedDomains.some(domain => parsed.hostname === domain);
        } catch {
          return false;
        }
      },
    };
  }
}

interface PluginState {
  status: 'loaded' | 'initialized' | 'running' | 'error' | 'disposed';
  errors: Array<{ message: string; timestamp: Date }>;
  metrics: Record<string, number>;
}
```

### 3.2 插件管理器

```typescript
// src/plugins/plugin-manager.ts

class PluginManager {
  private plugins: Map<string, PluginContainer> = new Map();
  private pluginRegistry: PluginRegistry;
  private eventBus: EventBus;

  // 安装插件
  async install(source: PluginSource): Promise<Plugin> {
    // 1. 下载/读取插件包
    const pluginPackage = await this.downloadPlugin(source);

    // 2. 验证插件签名
    await this.verifySignature(pluginPackage);

    // 3. 验证依赖
    await this.validateDependencies(pluginPackage);

    // 4. 验证权限
    await this.validatePermissions(pluginPackage);

    // 5. 解压到插件目录
    const installedPath = await this.extractPlugin(pluginPackage);

    // 6. 加载插件清单
    const plugin = await this.loadPluginManifest(installedPath);

    // 7. 初始化插件容器
    const container = new PluginContainer(plugin);
    await container.initialize(this.createPluginContext());

    // 8. 注册插件
    this.plugins.set(plugin.id, container);

    // 9. 调用生命周期钩子
    if (plugin.hooks?.onEnable) {
      await plugin.hooks.onEnable(this.createPluginContext());
    }

    return plugin;
  }

  // 卸载插件
  async uninstall(pluginId: string): Promise<void> {
    const container = this.plugins.get(pluginId);

    if (!container) {
      throw new NotFoundError('Plugin');
    }

    // 调用卸载钩子
    await container.dispose();

    // 从注册表移除
    this.plugins.delete(pluginId);
  }

  // 启用插件
  async enable(pluginId: string): Promise<void> {
    const container = this.plugins.get(pluginId);

    if (!container) {
      throw new NotFoundError('Plugin');
    }

    const plugin = container.getPlugin();

    if (plugin.hooks?.onEnable) {
      await plugin.hooks.onEnable(this.createPluginContext());
    }
  }

  // 禁用插件
  async disable(pluginId: string): Promise<void> {
    const container = this.plugins.get(pluginId);

    if (!container) {
      throw new NotFoundError('Plugin');
    }

    const plugin = container.getPlugin();

    if (plugin.hooks?.onDisable) {
      await plugin.hooks.onDisable(this.createPluginContext());
    }
  }

  // 执行插件
  async execute(pluginId: string, entry: string, params: unknown): Promise<unknown> {
    const container = this.plugins.get(pluginId);

    if (!container) {
      throw new NotFoundError('Plugin');
    }

    return container.execute(entry, params);
  }

  // 获取所有已安装插件
  getInstalledPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).map(c => c.getPlugin());
  }

  // 按类型获取插件
  getPluginsByType(type: PluginType): Plugin[] {
    return this.getInstalledPlugins().filter(p => p.type === type);
  }

  // 获取插件状态
  getPluginStatus(pluginId: string): PluginState {
    const container = this.plugins.get(pluginId);
    return container?.getState() || { status: 'not_found', errors: [], metrics: {} };
  }
}
```

### 3.3 插件安全模型

```typescript
// src/plugins/security/plugin-security.ts

// 能力系统（Capability System）
class CapabilitySystem {
  // 定义系统能力
  private capabilities = new Map<string, {
    name: string;
    description: string;
    dangerous: boolean;
  }>();

  // 插件被授予的能力
  private grantedCapabilities = new Map<string, Set<string>>();

  // 初始化能力定义
  initialize(): void {
    // 项目能力
    this.registerCapability('projects:list', 'List projects', false);
    this.registerCapability('projects:read', 'Read project details', false);
    this.registerCapability('projects:create', 'Create projects', false);
    this.registerCapability('projects:update', 'Update projects', false);
    this.registerCapability('projects:delete', 'Delete projects', true);

    // 文件能力
    this.registerCapability('files:read', 'Read files', false);
    this.registerCapability('files:write', 'Write files', true);
    this.registerCapability('files:delete', 'Delete files', true);
    this.registerCapability('files:execute', 'Execute files', true);

    // 网络能力
    this.registerCapability('http:api.example.com', 'Access example.com API', false);
    this.registerCapability('http:webhook.site.com', 'Access webhook.site.com', false);

    // 系统能力
    this.registerCapability('system:execute', 'Execute system commands', true);
    this.registerCapability('system:env', 'Access environment variables', true);
    this.registerCapability('system:secrets', 'Access secrets', true);
  }

  // 检查插件是否有某能力
  hasCapability(pluginId: string, capability: string): boolean {
    const capabilities = this.grantedCapabilities.get(pluginId);
    if (!capabilities) return false;

    // 检查直接授予
    if (capabilities.has(capability)) return true;

    // 检查通配符
    const [category] = capability.split(':');
    return capabilities.has(`${category}:*`);
  }

  // 授予能力
  grantCapability(pluginId: string, capability: string): void {
    const capabilities = this.grantedCapabilities.get(pluginId) || new Set();
    capabilities.add(capability);
    this.grantedCapabilities.set(pluginId, capabilities);
  }

  // 撤销能力
  revokeCapability(pluginId: string, capability: string): void {
    const capabilities = this.grantedCapabilities.get(pluginId);
    if (capabilities) {
      capabilities.delete(capability);
    }
  }
}

// 插件代码验证器
class PluginValidator {
  // 静态分析检查
  async validate(plugin: Plugin): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 1. 检查清单完整性
    if (!this.validateManifest(plugin)) {
      errors.push({ code: 'INVALID_MANIFEST', message: 'Invalid plugin manifest' });
    }

    // 2. 检查入口文件存在
    for (const entry of Object.values(plugin.entry)) {
      if (entry && !(await this.fileExists(entry))) {
        errors.push({ code: 'MISSING_ENTRY', message: `Entry file not found: ${entry}` });
      }
    }

    // 3. 检查危险权限
    for (const permission of plugin.permissions) {
      if (permission.dangerous) {
        warnings.push({
          code: 'DANGEROUS_PERMISSION',
          message: `Plugin requires dangerous permission: ${permission.name}`,
        });
      }
    }

    // 4. 检查依赖兼容性
    for (const dep of plugin.dependencies) {
      if (!this.checkDependencyCompatibility(dep)) {
        errors.push({
          code: 'INCOMPATIBLE_DEPENDENCY',
          message: `Incompatible dependency: ${dep.pluginId} ${dep.versionRange}`,
        });
      }
    }

    // 5. 代码安全扫描（如果提供源码）
    if (plugin.source) {
      const securityIssues = await this.scanForSecurityIssues(plugin.source);
      errors.push(...securityIssues);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // 安全扫描规则
  private async scanForSecurityIssues(source: string): Promise<ValidationError[]> {
    const issues: ValidationError[] = [];

    // 检测 eval 使用
    if (source.includes('eval(')) {
      issues.push({ code: 'SECURITY_EVAL', message: 'Use of eval() is not allowed' });
    }

    // 检测 eval 等危险模式
    const dangerousPatterns = [
      { pattern: /eval\s*\(/, code: 'DANGEROUS_EVAL' },
      { pattern: /Function\s*\(/, code: 'DANGEROUS_FUNCTION' },
      { pattern: /__import__\s*\(/, code: 'DANGEROUS_IMPORT' },
      { pattern: /process\.env/, code: 'ENV_ACCESS' },
      { pattern: /child_process/, code: 'CHILD_PROCESS' },
      { pattern: /require\s*\(\s*['"]crypto/, code: 'CRYPTO_BYPASS' },
    ];

    for (const { pattern, code } of dangerousPatterns) {
      if (pattern.test(source)) {
        issues.push({ code, message: `Security issue detected: ${code}` });
      }
    }

    return issues;
  }
}
```

## 4. 插件市场

### 4.1 插件市场模型

```typescript
// src/plugins/marketplace/marketplace-model.ts

interface MarketplacePlugin {
  // 插件信息
  plugin: Plugin;

  // 市场信息
  marketplace: {
    pluginId: string;          // 市场中的唯一 ID
    slug: string;              // URL 友好的 slug

    // 统计
    stats: {
      downloads: number;
      installs: number;        // 当前安装数
      rating: number;          // 1-5 星
      ratingCount: number;
    };

    // 分类
    categories: string[];
    tags: string[];

    // 媒体
    icon?: string;
    screenshots?: string[];
    videoUrl?: string;

    // 文档
    documentation?: string;
    changelog?: string;
    faq?: string;

    // 发布信息
    status: 'draft' | 'pending_review' | 'published' | 'rejected' | 'deprecated';
    publishedAt?: Date;
    lastUpdated?: Date;

    // 作者
    author: {
      name: string;
      email: string;
      url?: string;
      verified: boolean;
    };

    // 版本
    versions: PluginVersion[];
    currentVersion: string;
  };
}

interface PluginVersion {
  version: string;
  changelog: string;
  releaseDate: Date;
  downloadUrl: string;
  signature: string;
  coreCompatibility: {
    minVersion: string;
    maxVersion: string;
  };
  size: number;           // bytes
  checksum: string;
}

// 插件审查
interface PluginReview {
  id: string;
  pluginId: string;
  version: string;

  reviewer: {
    id: string;
    name: string;
    role: 'admin' | 'moderator';
  };

  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';

  // 审查结果
  checks: ReviewCheck[];

  feedback?: string;
  reviewedAt: Date;
}

interface ReviewCheck {
  name: string;
  status: 'passed' | 'failed' | 'warning';
  message?: string;
  details?: string;
}

// 审查清单
const ReviewChecklist = [
  { name: 'manifest_valid', label: 'Manifest is valid', required: true },
  { name: 'code_quality', label: 'Code quality standards', required: false },
  { name: 'security_scan', label: 'Security scan passed', required: true },
  { name: 'permission_review', label: 'Permissions are appropriate', required: true },
  { name: 'documentation', label: 'Documentation is complete', required: false },
  { name: 'ui_guidelines', label: 'UI follows design guidelines', required: false, appliesTo: 'ui' },
  { name: 'api_guidelines', label: 'API follows guidelines', required: false, appliesTo: 'integration' },
];
```

### 4.2 插件市场服务

```typescript
// src/plugins/marketplace/marketplace-service.ts

class MarketplaceService {
  private store: MarketplaceStore;

  // 搜索插件
  async searchPlugins(query: {
    text?: string;
    category?: PluginCategory;
    tags?: string[];
    sort?: 'downloads' | 'rating' | 'recent' | 'name';
    page?: number;
    pageSize?: number;
  }): Promise<SearchResult<MarketplacePlugin>> {
    const plugins = await this.store.search({
      text: query.text,
      category: query.category,
      tags: query.tags,
      status: 'published',
    });

    // 排序
    const sorted = this.sortPlugins(plugins, query.sort || 'downloads');

    // 分页
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      items: sorted.slice(start, end),
      total: sorted.length,
      page,
      pageSize,
      hasMore: end < sorted.length,
    };
  }

  // 获取插件详情
  async getPlugin(slug: string): Promise<MarketplacePlugin | null> {
    return this.store.findBySlug(slug);
  }

  // 获取插件版本
  async getVersion(pluginId: string, version: string): Promise<PluginVersion | null> {
    const plugin = await this.store.findById(pluginId);
    return plugin?.marketplace.versions.find(v => v.version === version) || null;
  }

  // 发布插件
  async publishPlugin(pluginId: string, userId: string): Promise<void> {
    // 1. 创建审查请求
    const review = await this.createReview(pluginId);

    // 2. 发送通知给审查者
    await this.notifyModerators(review);

    // 3. 更新插件状态
    await this.store.updateStatus(pluginId, 'pending_review');
  }

  // 安装市场插件
  async installFromMarketplace(
    marketplacePluginId: string,
    tenantId: string
  ): Promise<Plugin> {
    // 1. 获取插件信息
    const marketplacePlugin = await this.store.findById(marketplacePluginId);

    if (!marketplacePlugin) {
      throw new NotFoundError('MarketplacePlugin');
    }

    // 2. 下载插件包
    const source = await this.downloadPlugin(
      marketplacePlugin.marketplace.currentVersion
    );

    // 3. 安装到租户
    return await pluginManager.install(source);
  }

  // 评分
  async ratePlugin(
    pluginId: string,
    userId: string,
    rating: number,
    review?: string
  ): Promise<void> {
    // 验证购买/安装
    const hasInstalled = await this.userHasInstalled(pluginId, userId);
    if (!hasInstalled) {
      throw new Error('Only installed plugins can be rated');
    }

    // 检查是否已评分
    const existingRating = await this.store.getRating(pluginId, userId);

    if (existingRating) {
      await this.store.updateRating(existingRating.id, rating, review);
    } else {
      await this.store.createRating(pluginId, userId, rating, review);
    }

    // 更新平均评分
    await this.updateAverageRating(pluginId);
  }
}
```

## 5. 插件开发 SDK

### 5.1 SDK 设计

```typescript
// src/plugins/sdk/plugin-sdk.ts

// 插件 SDK 入口
export class ProjectFactoryPlugin {
  // 插件实例
  private plugin: PluginInstance;

  // 初始化
  constructor(config: PluginConfig) {
    this.plugin = {
      id: config.id,
      name: config.name,
      version: config.version,
    };
  }

  // 注册触发器
  registerTrigger(trigger: PluginTrigger): void {
    this.plugin.triggers = this.plugin.triggers || [];
    this.plugin.triggers.push(trigger);
  }

  // 注册动作
  registerAction(action: PluginAction): void {
    this.plugin.actions = this.plugin.actions || [];
    this.plugin.actions.push(action);
  }

  // 注册 Agent
  registerAgent(agent: PluginAgent): void {
    this.plugin.agents = this.plugin.agents || [];
    this.plugin.agents.push(agent);
  }

  // 注册 UI 扩展
  registerUIExtension(extension: UIExtension): void {
    this.plugin.uiExtensions = this.plugin.uiExtensions || [];
    this.plugin.uiExtensions.push(extension);
  }

  // 定义配置 Schema
  defineConfig(schema: JSONSchema): void {
    this.plugin.configSchema = schema;
  }

  // 定义权限需求
  requirePermissions(...permissions: string[]): void {
    this.plugin.permissions = permissions;
  }

  // 注册生命周期钩子
  onInstall(handler: () => Promise<void>): void {
    this.plugin.hooks = this.plugin.hooks || {};
    this.plugin.hooks.onInstall = handler;
  }

  onEnable(handler: () => Promise<void>): void {
    this.plugin.hooks = this.plugin.hooks || {};
    this.plugin.hooks.onEnable = handler;
  }

  onDisable(handler: () => Promise<void>): void {
    this.plugin.hooks = this.plugin.hooks || {};
    this.plugin.hooks.onDisable = handler;
  }

  onUninstall(handler: () => Promise<void>): void {
    this.plugin.hooks = this.plugin.hooks || {};
    this.plugin.hooks.onUninstall = handler;
  }

  // 获取 API
  getAPI(): PluginAPI {
    return this.api;
  }

  // 获取上下文
  getContext(): PluginContext {
    return this.context;
  }
}

// 触发器定义辅助函数
export function createTrigger(config: {
  id: string;
  name: string;
  type: 'event' | 'schedule' | 'webhook';
  handler: (params: unknown, context: PluginContext) => Promise<void>;
}): PluginTrigger {
  return config;
}

// 动作定义辅助函数
export function createAction(config: {
  id: string;
  name: string;
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
  handler: (input: unknown, context: PluginContext) => Promise<unknown>;
}): PluginAction {
  return config;
}

// Agent 定义辅助函数
export function createAgent(config: {
  id: string;
  name: string;
  role: string;
  prompt: {
    system?: string;
    examples?: Array<{ input: string; output: string }>;
  };
  tools?: ToolDefinition[];
}): PluginAgent {
  return config;
}
```

### 5.2 插件模板

```typescript
// src/plugins/templates/template-generator.ts

// 插件项目模板
const PluginTemplate = {
  name: 'example-plugin',
  version: '1.0.0',
  description: 'An example plugin for ProjectFactory',

  // package.json
  packageJson: {
    name: '@projectfactory/plugin-example',
    version: '1.0.0',
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: {
      build: 'tsc',
      test: 'jest',
    },
    dependencies: {
      '@projectfactory/plugin-sdk': '^1.0.0',
    },
    devDependencies: {
      typescript: '^5.0.0',
      '@types/node': '^20.0.0',
    },
  },

  // tsconfig.json
  tsconfig: {
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      moduleResolution: 'node',
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
    },
    include: ['src/**/*'],
  },

  // 源码模板
  srcFiles: {
    'index.ts': `
import { ProjectFactoryPlugin, createTrigger, createAction } from '@projectfactory/plugin-sdk';

// 创建插件实例
const plugin = new ProjectFactoryPlugin({
  id: 'example-plugin',
  name: 'Example Plugin',
  version: '1.0.0',
});

// 定义配置
plugin.defineConfig({
  type: 'object',
  properties: {
    apiKey: { type: 'string' },
    webhookUrl: { type: 'string' },
  },
  required: ['apiKey'],
});

// 注册触发器
plugin.registerTrigger(createTrigger({
  id: 'example-trigger',
  name: 'Example Trigger',
  type: 'schedule',
  handler: async (params, context) => {
    // 你的触发逻辑
    const data = await context.http.get('https://api.example.com/data');
    await context.events.emit('example-event', data);
  },
}));

// 注册动作
plugin.registerAction(createAction({
  id: 'example-action',
  name: 'Example Action',
  inputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string' },
    },
    required: ['message'],
  },
  handler: async (input, context) => {
    // 你的动作逻辑
    await context.logger.info('Executing example action', input);
    return { success: true };
  },
}));

// 注册生命周期钩子
plugin.onEnable(async () => {
  console.log('Plugin enabled');
});

plugin.onDisable(async () => {
  console.log('Plugin disabled');
});

// 导出插件
export default plugin;
`,

    'manifest.json': `{
  "schemaVersion": "1.0",
  "apiVersion": "1.0",
  "name": "example-plugin",
  "version": "1.0.0",
  "category": "utility",
  "permissions": [
    { "name": "projects:read", "description": "Read project data" }
  ]
}`,
  },
};

// 生成插件项目
async function generatePluginProject(
  outputDir: string,
  template: PluginTemplate
): Promise<void> {
  for (const [filename, content] of Object.entries(template.srcFiles)) {
    const filePath = `${outputDir}/${filename}`;
    await fs.writeFile(filePath, content);
  }

  await fs.writeFile(
    `${outputDir}/package.json`,
    JSON.stringify(template.packageJson, null, 2)
  );

  await fs.writeFile(
    `${outputDir}/tsconfig.json`,
    JSON.stringify(template.tsconfig, null, 2)
  );
}
```

## 6. 扩展点系统

### 6.1 扩展点定义

```typescript
// src/plugins/extensions/extension-points.ts

// 系统定义的扩展点
const SystemExtensionPoints: ExtensionPoint[] = [
  // Agent 扩展点
  {
    id: 'agent.idea-generator',
    name: 'Idea Generator Extension',
    description: 'Extend idea generation with custom generators',
    type: 'agent',
    schema: {
      type: 'object',
      properties: {
        generatorType: { type: 'string' },
        customPrompt: { type: 'string' },
      },
    },
  },

  // 触发器扩展点
  {
    id: 'trigger.project-created',
    name: 'Project Created Trigger',
    description: 'Trigger actions when a project is created',
    type: 'trigger',
    schema: {
      type: 'object',
      properties: {
        conditions: { type: 'array' },
      },
    },
  },

  // 动作扩展点
  {
    id: 'action.notify',
    name: 'Notification Action',
    description: 'Send notifications',
    type: 'action',
    schema: {
      type: 'object',
      properties: {
        channel: { type: 'string' },
        template: { type: 'string' },
      },
    },
  },

  // UI 扩展点
  {
    id: 'ui.project-card',
    name: 'Project Card Extension',
    description: 'Add custom content to project cards',
    type: 'ui',
    schema: {
      type: 'object',
      properties: {
        position: { type: 'string', enum: ['header', 'body', 'footer'] },
        component: { type: 'string' },
      },
    },
  },

  // 过滤器扩展点
  {
    id: 'filter.quality-gate',
    name: 'Quality Gate Filter',
    description: 'Custom quality gate logic',
    type: 'filter',
    schema: {
      type: 'object',
      properties: {
        threshold: { type: 'number' },
      },
    },
  },
];

// 扩展点注册表
class ExtensionPointRegistry {
  private extensionPoints = new Map<string, ExtensionPoint>();
  private extensions = new Map<string, PluginExtension[]>();

  constructor() {
    // 注册系统扩展点
    for (const ep of SystemExtensionPoints) {
      this.register(ep);
    }
  }

  // 注册扩展点
  register(extensionPoint: ExtensionPoint): void {
    this.extensionPoints.set(extensionPoint.id, extensionPoint);
    this.extensions.set(extensionPoint.id, []);
  }

  // 注册扩展
  registerExtension(extensionPointId: string, extension: PluginExtension): void {
    const extensions = this.extensions.get(extensionPointId);
    if (!extensions) {
      throw new Error(`Unknown extension point: ${extensionPointId}`);
    }

    extensions.push(extension);
  }

  // 获取扩展点
  get(extensionPointId: string): ExtensionPoint | undefined {
    return this.extensionPoints.get(extensionPointId);
  }

  // 获取所有扩展
  getExtensions(extensionPointId: string): PluginExtension[] {
    return this.extensions.get(extensionPointId) || [];
  }

  // 执行扩展
  async executeExtensions<T>(
    extensionPointId: string,
    context: unknown,
    executor: (extension: PluginExtension, context: unknown) => Promise<T>
  ): Promise<T[]> {
    const extensions = this.getExtensions(extensionPointId);
    return Promise.all(extensions.map(ep => executor(ep, context)));
  }
}
```

### 6.2 内置扩展点实现

```typescript
// src/plugins/extensions/implementations.ts

// Agent 扩展实现
class AgentExtensionExecutor {
  constructor(
    private registry: ExtensionPointRegistry,
    private agentExecutor: AgentExecutor
  ) {}

  // 执行 Idea Generator 扩展
  async executeIdeaGeneratorExtensions(
    context: IdeaGenerationContext
  ): Promise<Idea[]> {
    // 执行所有注册的扩展
    const results = await this.registry.executeExtensions<Idea[]>(
      'agent.idea-generator',
      context,
      async (extension, ctx) => {
        const container = pluginManager.getContainer(extension.pluginId);
        return container.execute('generate', ctx);
      }
    );

    // 合并所有结果
    return results.flat();
  }
}

// UI 扩展渲染器
class UIExtensionRenderer {
  constructor(
    private registry: ExtensionPointRegistry,
    private react: typeof React
  ) {}

  // 渲染 Project Card 扩展
  async renderProjectCardExtensions(
    projectId: string,
    container: HTMLElement
  ): Promise<void> {
    const extensions = this.registry.getExtensions('ui.project-card');

    for (const extension of extensions) {
      const container = pluginManager.getContainer(extension.pluginId);

      // 获取渲染组件
      const Component = await container.execute('render', {
        projectId,
        position: extension.config.position,
      });

      // 渲染到 DOM
      const element = this.react.createElement(Component);
      this.react.render(element, container);
    }
  }
}
```

---

**最后更新**: 2026-04-14
**版本**: v1.0
