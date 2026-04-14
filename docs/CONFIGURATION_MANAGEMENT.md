# 配置管理系统设计

## 概述

本文档定义 ProjectFactory 系统的配置管理架构，涵盖运行时配置、热更新、多环境管理、配置版本化等核心能力，支持系统在不重启的情况下动态调整行为。

## 1. 配置架构

### 1.1 配置层次

```
┌─────────────────────────────────────────────────────────┐
│                     全局默认配置                           │
│  (代码中硬编码的默认值)                                    │
├─────────────────────────────────────────────────────────┤
│                     环境变量配置                          │
│  (系统环境变量、.env 文件)                               │
├─────────────────────────────────────────────────────────┤
│                     启动配置文件                         │
│  (config.yaml, config.json)                             │
├─────────────────────────────────────────────────────────┤
│                     远程配置中心                          │
│  (Apollo / etcd / Consul)                               │
├─────────────────────────────────────────────────────────┤
│                     数据库配置                           │
│  (运行时动态配置，存储在 SQLite)                          │
├─────────────────────────────────────────────────────────┤
│                     实例级覆盖                           │
│  (单个实例的临时覆盖)                                    │
└─────────────────────────────────────────────────────────┘
```

### 1.2 配置分类

| 类型 | 示例 | 更新方式 | 影响范围 |
|------|------|----------|----------|
| 系统级 | 日志级别、端口号 | 重启生效 | 全局 |
| 业务级 | 质量阈值、并发数 | 热更新 | 全局/分组 |
| 运行时 | 当前活跃项目数 | 动态调整 | 单实例 |
| 特性开关 | feature.xxx | 热更新 | 按用户/分组 |
| 租户级 | 租户特定配置 | 热更新 | 单租户 |

## 2. 配置模型

### 2.1 核心配置 Schema

```typescript
// src/config/config-schema.ts
import { z } from 'zod';

// 基础配置类型
const ConfigValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.record(z.string()),
]);

type ConfigValue = z.infer<typeof ConfigValueSchema>;

// 配置项定义
interface ConfigDefinition {
  key: string;
  value: ConfigValue;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'secret';
  description: string;
  category: 'system' | 'business' | 'feature' | 'tenant';
  defaultValue?: ConfigValue;
  min?: number;
  max?: number;
  options?: string[];  // 枚举选项
  validator?: (value: ConfigValue) => boolean;
  sensitive: boolean;   // 是否敏感（不记录日志）
  editable: boolean;    // 是否可运行时编辑
}

// 配置分组
interface ConfigGroup {
  name: string;
  description: string;
  items: ConfigDefinition[];
  dependencies?: string[];  // 依赖的其他配置组
}

// 所有配置定义
const configDefinitions: ConfigGroup[] = [
  {
    name: 'llm',
    description: 'LLM 模型配置',
    items: [
      {
        key: 'llm.defaultModel',
        type: 'string',
        description: '默认使用的 LLM 模型',
        defaultValue: 'gpt-4o-mini',
        options: ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet', 'claude-3-5-haiku'],
        sensitive: false,
        editable: true,
      },
      {
        key: 'llm.maxTokens',
        type: 'number',
        description: '最大输出 token 数',
        defaultValue: 16384,
        min: 1024,
        max: 128000,
        sensitive: false,
        editable: true,
      },
      {
        key: 'llm.temperature',
        type: 'number',
        description: '生成温度',
        defaultValue: 0.7,
        min: 0,
        max: 2,
        sensitive: false,
        editable: true,
      },
      {
        key: 'llm.apiKey',
        type: 'secret',
        description: 'LLM API 密钥',
        sensitive: true,
        editable: false,  // 敏感配置只能通过环境变量设置
      },
      {
        key: 'llm.maxConcurrentCalls',
        type: 'number',
        description: '最大并发调用数',
        defaultValue: 5,
        min: 1,
        max: 20,
        sensitive: false,
        editable: true,
      },
    ],
  },
  {
    name: 'quality',
    description: '质量门控配置',
    items: [
      {
        key: 'quality.minCoverage',
        type: 'number',
        description: '最低测试覆盖率',
        defaultValue: 0.8,
        min: 0,
        max: 1,
        sensitive: false,
        editable: true,
      },
      {
        key: 'quality.minQualityScore',
        type: 'number',
        description: '最低质量分数',
        defaultValue: 70,
        min: 0,
        max: 100,
        sensitive: false,
        editable: true,
      },
      {
        key: 'quality.maxLintErrors',
        type: 'number',
        description: '允许的最大 lint 错误数',
        defaultValue: 0,
        min: 0,
        max: 100,
        sensitive: false,
        editable: true,
      },
      {
        key: 'quality.maxIterations',
        type: 'number',
        description: '单个项目最大迭代次数',
        defaultValue: 5,
        min: 1,
        max: 20,
        sensitive: false,
        editable: true,
      },
    ],
  },
  {
    name: 'pipeline',
    description: '流水线配置',
    items: [
      {
        key: 'pipeline.maxConcurrentProjects',
        type: 'number',
        description: '最大并发项目数',
        defaultValue: 10,
        min: 1,
        max: 50,
        sensitive: false,
        editable: true,
      },
      {
        key: 'pipeline.ideaGenerationInterval',
        type: 'number',
        description: '创意生成间隔（毫秒）',
        defaultValue: 60000,
        min: 10000,
        max: 3600000,
        sensitive: false,
        editable: true,
      },
      {
        key: 'pipeline.enabledAgents',
        type: 'array',
        description: '启用的 Agent 列表',
        defaultValue: ['idea-generator', 'architect', 'coder', 'tester', 'reviewer'],
        sensitive: false,
        editable: true,
      },
    ],
  },
  {
    name: 'features',
    description: '特性开关',
    items: [
      {
        key: 'feature.autoDeploy',
        type: 'boolean',
        description: '自动部署已完成项目',
        defaultValue: false,
        sensitive: false,
        editable: true,
      },
      {
        key: 'feature.knowledgeBase',
        type: 'boolean',
        description: '启用知识库',
        defaultValue: true,
        sensitive: false,
        editable: true,
      },
      {
        key: 'feature.advancedReview',
        type: 'boolean',
        description: '启用高级代码审查',
        defaultValue: true,
        sensitive: false,
        editable: true,
      },
    ],
  },
];
```

### 2.2 配置值对象

```typescript
// src/config/config-entry.ts
interface ConfigEntry {
  id: string;
  key: string;
  value: ConfigValue;
  source: 'default' | 'env' | 'file' | 'remote' | 'database' | 'override';
  version: number;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
  updatedBy?: string;
  comment?: string;
  status: 'active' | 'pending' | 'archived';
  rollout?: RolloutConfig;  // 分组发布配置
}

interface RolloutConfig {
  enabled: boolean;
  percentage?: number;      // 百分比 rollout
  targetGroups?: string[];   // 目标用户组
  startTime?: number;        //  rollout 开始时间
  endTime?: number;          // rollout 结束时间
}

interface ConfigChange {
  id: string;
  configKey: string;
  oldValue?: ConfigValue;
  newValue: ConfigValue;
  changeType: 'create' | 'update' | 'delete' | 'rollback';
  changedBy: string;
  changedAt: number;
  reason?: string;
  ticketId?: string;
  approvedBy?: string;
  approvedAt?: number;
}
```

## 3. 配置服务

### 3.1 配置管理器

```typescript
// src/config/config-manager.ts
class ConfigManager {
  private store: ConfigStore;
  private cache: Map<string, { value: ConfigValue; expiresAt: number }>;
  private validators: Map<string, (value: ConfigValue) => boolean>;
  private subscribers: Map<string, Set<(value: ConfigValue) => void>>;
  private changeListeners: Set<(change: ConfigChange) => void>;

  constructor(store: ConfigStore) {
    this.store = store;
    this.cache = new Map();
    this.validators = new Map();
    this.subscribers = new Map();
    this.changeListeners = new Set();

    this.initializeValidators();
  }

  private initializeValidators(): void {
    for (const group of configDefinitions) {
      for (const item of group.items) {
        if (item.validator) {
          this.validators.set(item.key, item.validator);
        }
      }
    }
  }

  async get<T extends ConfigValue>(key: string, options?: {
    useCache?: boolean;
    defaultValue?: T;
  }): Promise<T> {
    const { useCache = true, defaultValue } = options || {};

    // 检查缓存
    if (useCache) {
      const cached = this.cache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value as T;
      }
    }

    // 从存储获取
    const entry = await this.store.get(key);

    if (entry) {
      // 更新缓存
      this.cache.set(key, {
        value: entry.value,
        expiresAt: Date.now() + 5000,  // 5 秒缓存
      });

      return entry.value as T;
    }

    // 返回默认值或查找默认值定义
    const definition = this.findDefinition(key);
    if (definition?.defaultValue !== undefined) {
      return definition.defaultValue as T;
    }

    if (defaultValue !== undefined) {
      return defaultValue;
    }

    throw new Error(`Config key not found: ${key}`);
  }

  async set(
    key: string,
    value: ConfigValue,
    options?: {
      source?: ConfigEntry['source'];
      comment?: string;
      changeTicketId?: string;
    }
  ): Promise<ConfigEntry> {
    // 验证
    await this.validate(key, value);

    // 获取旧值
    const oldEntry = await this.store.get(key);
    const oldValue = oldEntry?.value;

    // 创建变更记录
    const change: ConfigChange = {
      id: generateId(),
      configKey: key,
      oldValue,
      newValue: value,
      changeType: oldEntry ? 'update' : 'create',
      changedBy: getCurrentUser(),
      changedAt: Date.now(),
      comment: options?.comment,
      ticketId: options?.changeTicketId,
    };

    // 持久化
    const entry = await this.store.set(key, value, {
      ...options,
      version: (oldEntry?.version || 0) + 1,
    });

    // 清除缓存
    this.cache.delete(key);

    // 通知变更
    await this.notifyChange(change);

    return entry;
  }

  async batchSet(
    entries: Array<{ key: string; value: ConfigValue; comment?: string }>
  ): Promise<ConfigEntry[]> {
    const results: ConfigEntry[] = [];

    for (const entry of entries) {
      const result = await this.set(entry.key, entry.value, { comment: entry.comment });
      results.push(result);
    }

    return results;
  }

  async getAll(group?: string): Promise<Map<string, ConfigEntry>> {
    const definitions = group
      ? configDefinitions.find(g => g.name === group)?.items || []
      : configDefinitions.flatMap(g => g.items);

    const results = new Map<string, ConfigEntry>();

    for (const def of definitions) {
      const entry = await this.store.get(def.key);
      if (entry) {
        results.set(def.key, entry);
      }
    }

    return results;
  }

  async validate(key: string, value: ConfigValue): Promise<void> {
    const definition = this.findDefinition(key);

    if (!definition) {
      throw new Error(`Unknown config key: ${key}`);
    }

    // 类型检查
    const typeChecks: Record<string, (v: ConfigValue) => boolean> = {
      string: v => typeof v === 'string',
      number: v => typeof v === 'number',
      boolean: v => typeof v === 'boolean',
      array: v => Array.isArray(v),
      object: v => typeof v === 'object' && !Array.isArray(v),
      secret: v => typeof v === 'string',
    };

    if (!typeChecks[definition.type](value)) {
      throw new Error(`Invalid type for ${key}: expected ${definition.type}`);
    }

    // 范围检查
    if (definition.type === 'number') {
      if (definition.min !== undefined && (value as number) < definition.min) {
        throw new Error(`Value for ${key} is below minimum: ${definition.min}`);
      }
      if (definition.max !== undefined && (value as number) > definition.max) {
        throw new Error(`Value for ${key} exceeds maximum: ${definition.max}`);
      }
    }

    // 枚举检查
    if (definition.options && !definition.options.includes(value as string)) {
      throw new Error(`Value for ${key} not in options: ${definition.options.join(', ')}`);
    }

    // 自定义验证器
    const validator = this.validators.get(key);
    if (validator && !validator(value)) {
      throw new Error(`Validation failed for ${key}`);
    }
  }

  private findDefinition(key: string): ConfigDefinition | undefined {
    for (const group of configDefinitions) {
      const item = group.items.find(i => i.key === key);
      if (item) return item;
    }
    return undefined;
  }

  private async notifyChange(change: ConfigChange): Promise<void> {
    // 通知监听器
    for (const listener of this.changeListeners) {
      try {
        await listener(change);
      } catch (error) {
        console.error('Config change listener error:', error);
      }
    }

    // 通知特定 key 的订阅者
    const keySubscribers = this.subscribers.get(change.configKey);
    if (keySubscribers) {
      for (const callback of keySubscribers) {
        try {
          await callback(change.newValue);
        } catch (error) {
          console.error('Config subscriber error:', error);
        }
      }
    }
  }

  // 订阅配置变更
  subscribe(key: string, callback: (value: ConfigValue) => void): () => void {
    const subscribers = this.subscribers.get(key) || new Set();
    subscribers.add(callback);
    this.subscribers.set(key, subscribers);

    // 返回取消订阅函数
    return () => {
      subscribers.delete(callback);
    };
  }

  // 监听所有配置变更
  onChange(listener: (change: ConfigChange) => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  // 热更新配置
  async hotReload(key: string, value: ConfigValue): Promise<void> {
    await this.set(key, value, { source: 'remote', comment: 'Hot reload' });
  }

  // 回滚配置
  async rollback(key: string, version: number): Promise<void> {
    const entry = await this.store.getHistory(key, version);

    if (!entry) {
      throw new Error(`Config version not found: ${key}@${version}`);
    }

    await this.set(key, entry.value, {
      source: 'rollback',
      comment: `Rollback to version ${version}`,
    });
  }
}
```

### 3.2 配置存储

```typescript
// src/config/config-store.ts
interface ConfigStore {
  get(key: string): Promise<ConfigEntry | null>;
  set(key: string, value: ConfigValue, options?: any): Promise<ConfigEntry>;
  delete(key: string): Promise<void>;
  getHistory(key: string, limit?: number): Promise<ConfigEntry[]>;
  getByGroup(group: string): Promise<ConfigEntry[]>;
  search(pattern: string): Promise<ConfigEntry[]>;
}

class DatabaseConfigStore implements ConfigStore {
  private db: Database;

  async get(key: string): Promise<ConfigEntry | null> {
    const result = await this.db.query(
      'SELECT * FROM config_entries WHERE key = $1 AND status = $2',
      [key, 'active']
    );
    return result[0] || null;
  }

  async set(key: string, value: ConfigValue, options?: any): Promise<ConfigEntry> {
    const entry: ConfigEntry = {
      id: generateId(),
      key,
      value,
      source: options?.source || 'database',
      version: options?.version || 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'active',
    };

    await this.db.query(
      `INSERT INTO config_entries (id, key, value, source, version, created_at, updated_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [entry.id, entry.key, JSON.stringify(entry.value), entry.source, entry.version, entry.createdAt, entry.updatedAt, entry.status]
    );

    return entry;
  }

  async delete(key: string): Promise<void> {
    await this.db.query(
      'UPDATE config_entries SET status = $1, updated_at = $2 WHERE key = $3',
      ['archived', Date.now(), key]
    );
  }

  async getHistory(key: string, limit = 10): Promise<ConfigEntry[]> {
    const result = await this.db.query(
      `SELECT * FROM config_entries WHERE key = $1 ORDER BY version DESC LIMIT $2`,
      [key, limit]
    );
    return result;
  }

  async getByGroup(group: string): Promise<ConfigEntry[]> {
    const groupConfig = configDefinitions.find(g => g.name === group);
    if (!groupConfig) return [];

    const keys = groupConfig.items.map(i => i.key);
    const result = await this.db.query(
      `SELECT * FROM config_entries WHERE key = ANY($1) AND status = $2`,
      [keys, 'active']
    );
    return result;
  }

  async search(pattern: string): Promise<ConfigEntry[]> {
    const result = await this.db.query(
      `SELECT * FROM config_entries WHERE key LIKE $1 AND status = $2`,
      [`%${pattern}%`, 'active']
    );
    return result;
  }
}
```

## 4. 环境管理

### 4.1 多环境配置

```typescript
// src/config/environment-manager.ts
type Environment = 'development' | 'staging' | 'production' | 'test';

interface EnvironmentConfig {
  name: Environment;
  description: string;
  baseUrl: string;
  configOverrides: Record<string, ConfigValue>;
}

const environmentConfigs: EnvironmentConfig[] = [
  {
    name: 'development',
    description: '本地开发环境',
    baseUrl: 'http://localhost:3000',
    configOverrides: {
      'llm.defaultModel': 'gpt-4o-mini',
      'llm.maxConcurrentCalls': 2,
      'pipeline.maxConcurrentProjects': 3,
      'feature.autoDeploy': false,
    },
  },
  {
    name: 'staging',
    description: '预发布环境',
    baseUrl: 'https://staging.projectfactory.io',
    configOverrides: {
      'llm.defaultModel': 'gpt-4o',
      'llm.maxConcurrentCalls': 5,
      'pipeline.maxConcurrentProjects': 10,
      'feature.autoDeploy': true,
    },
  },
  {
    name: 'production',
    description: '生产环境',
    baseUrl: 'https://projectfactory.io',
    configOverrides: {
      'llm.defaultModel': 'gpt-4o',
      'llm.maxConcurrentCalls': 10,
      'pipeline.maxConcurrentProjects': 20,
      'feature.autoDeploy': true,
    },
  },
  {
    name: 'test',
    description: '测试环境',
    baseUrl: 'http://localhost:3001',
    configOverrides: {
      'llm.defaultModel': 'gpt-4o-mini',
      'llm.maxConcurrentCalls': 1,
      'pipeline.maxConcurrentProjects': 1,
    },
  },
];

class EnvironmentManager {
  private currentEnv: Environment;
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.currentEnv = this.detectEnvironment();
    this.configManager = configManager;
  }

  private detectEnvironment(): Environment {
    // 从环境变量检测
    const env = process.env.NODE_ENV;
    if (env && ['development', 'staging', 'production', 'test'].includes(env)) {
      return env as Environment;
    }

    // 从 URL 检测
    if (process.env.BASE_URL) {
      const envConfig = environmentConfigs.find(e => process.env.BASE_URL?.includes(e.baseUrl));
      if (envConfig) return envConfig.name;
    }

    return 'development';
  }

  getCurrent(): Environment {
    return this.currentEnv;
  }

  getConfig(): EnvironmentConfig {
    return environmentConfigs.find(e => e.name === this.currentEnv)!;
  }

  async applyEnvironmentConfig(): Promise<void> {
    const envConfig = this.getConfig();

    console.log(`Applying environment config for: ${this.currentEnv}`);

    for (const [key, value] of Object.entries(envConfig.configOverrides)) {
      // 只设置尚未存在的配置
      try {
        await this.configManager.get(key, { useCache: false });
        // 配置已存在，跳过
      } catch {
        await this.configManager.set(key, value, {
          source: 'env',
          comment: `Default value for ${this.currentEnv}`,
        });
      }
    }
  }

  // 跨环境配置对比
  async compareConfig(): Promise<Map<string, { value: ConfigValue; envs: Record<Environment, ConfigValue | 'not_set'> }>> {
    const allConfigs = new Map<string, { value: ConfigValue; envs: Record<Environment, ConfigValue | 'not_set'> }>();

    for (const envConfig of environmentConfigs) {
      const previousEnv = this.currentEnv;
      this.currentEnv = envConfig.name;

      const configs = await this.configManager.getAll();

      for (const [key, entry] of configs) {
        let existing = allConfigs.get(key);
        if (!existing) {
          existing = { value: entry.value, envs: { development: 'not_set', staging: 'not_set', production: 'not_set', test: 'not_set' } };
          allConfigs.set(key, existing);
        }
        existing.envs[envConfig.name] = entry.value;
      }

      this.currentEnv = previousEnv;
    }

    return allConfigs;
  }
}
```

### 4.2 Secret 管理

```typescript
// src/config/secret-manager.ts
interface SecretConfig {
  key: string;
  description: string;
  source: 'env' | 'vault' | 'aws-secrets' | 'gcp-secret-manager';
  path?: string;  // Secret store 中的路径
  version?: number;
}

const secretConfigs: SecretConfig[] = [
  { key: 'llm.apiKey', description: 'OpenAI API Key', source: 'env' },
  { key: 'database.url', description: 'Database connection URL', source: 'env' },
  { key: 'jwt.secret', description: 'JWT signing secret', source: 'vault', path: 'secret/data/projectfactory/jwt' },
  { key: 'aws.accessKeyId', description: 'AWS Access Key', source: 'aws-secrets', path: 'projectfactory/prod/access-key' },
  { key: 'aws.secretAccessKey', description: 'AWS Secret Key', source: 'aws-secrets', path: 'projectfactory/prod/secret-key' },
];

class SecretManager {
  private cache: Map<string, { value: string; expiresAt: number }>;
  private ttlSeconds: number;

  constructor(ttlSeconds = 3600) {
    this.cache = new Map();
    this.ttlSeconds = ttlSeconds;
  }

  async getSecret(key: string): Promise<string> {
    // 检查缓存
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const config = secretConfigs.find(s => s.key === key);
    if (!config) {
      throw new Error(`Unknown secret: ${key}`);
    }

    let value: string;

    switch (config.source) {
      case 'env':
        value = process.env[key.replace('.', '_').toUpperCase()] || '';
        break;

      case 'vault':
        value = await this.fetchFromVault(config.path!);
        break;

      case 'aws-secrets':
        value = await this.fetchFromAWS(config.path!);
        break;

      case 'gcp-secret-manager':
        value = await this.fetchFromGCP(config.path!);
        break;

      default:
        throw new Error(`Unsupported secret source: ${config.source}`);
    }

    if (!value) {
      throw new Error(`Secret not found: ${key}`);
    }

    // 缓存
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlSeconds * 1000,
    });

    return value;
  }

  private async fetchFromVault(path: string): Promise<string> {
    // 使用 Vault client 获取 secret
    // const client = new VaultClient(process.env.VAULT_ADDR!, process.env.VAULT_TOKEN!);
    // const secret = await client.read(path);
    // return secret.data.data['value'];
    return '';
  }

  private async fetchFromAWS(path: string): Promise<string> {
    // 使用 AWS Secrets Manager
    // const client = new AWS.SecretsManager({ region: 'us-east-1' });
    // const secret = await client.getSecretValue({ SecretId: path }).promise();
    // return secret.SecretString || '';
    return '';
  }

  private async fetchFromGCP(path: string): Promise<string> {
    // 使用 GCP Secret Manager
    // const client = new SecretManagerServiceClient();
    // const [accessResponse] = await client.accessSecretVersion({ name: path });
    // return accessResponse.payload?.data?.toString() || '';
    return '';
  }

  // 刷新单个 secret
  async refresh(key: string): Promise<string> {
    this.cache.delete(key);
    return this.getSecret(key);
  }

  // 刷新所有 secrets
  async refreshAll(): Promise<void> {
    this.cache.clear();
    for (const config of secretConfigs) {
      await this.getSecret(config.key);
    }
  }
}

export const secretManager = new SecretManager();
```

## 5. 配置变更管理

### 5.1 变更审批流程

```typescript
// src/config/change-management.ts
interface ChangeRequest {
  id: string;
  title: string;
  description: string;
  changes: Array<{
    key: string;
    oldValue?: ConfigValue;
    newValue: ConfigValue;
    reason: string;
  }>;
  requestedBy: string;
  requestedAt: number;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'applied' | 'cancelled';
  reviewers: Array<{
    userId: string;
    decision?: 'approve' | 'reject';
    comment?: string;
    decidedAt?: number;
  }>;
  scheduledAt?: number;      // 计划应用时间
  appliedAt?: number;
  appliedBy?: string;
  ticketId?: string;         // 关联的业务工单
  tags?: string[];
}

class ConfigChangeManagement {
  private store: ChangeStore;
  private configManager: ConfigManager;
  private notificationService: NotificationService;

  async createChangeRequest(request: Omit<ChangeRequest, 'id' | 'status' | 'requestedAt' | 'reviewers'>): Promise<ChangeRequest> {
    // 验证变更
    for (const change of request.changes) {
      const definition = this.findDefinition(change.key);
      if (!definition) {
        throw new Error(`Unknown config key: ${change.key}`);
      }
      if (!definition.editable) {
        throw new Error(`Config key is not editable: ${change.key}`);
      }
    }

    const fullRequest: ChangeRequest = {
      ...request,
      id: generateId(),
      status: 'draft',
      requestedAt: Date.now(),
      reviewers: [],
    };

    await this.store.saveRequest(fullRequest);

    return fullRequest;
  }

  async submitForReview(requestId: string): Promise<ChangeRequest> {
    const request = await this.store.getRequest(requestId);
    if (!request) throw new Error('Change request not found');

    if (request.status !== 'draft') {
      throw new Error(`Cannot submit request in status: ${request.status}`);
    }

    request.status = 'pending_review';

    // 自动分配审核人
    request.reviewers = await this.assignReviewers(request);

    await this.store.saveRequest(request);
    await this.notificationService.notifyReviewers(request);

    return request;
  }

  async approve(requestId: string, reviewerId: string, comment?: string): Promise<ChangeRequest> {
    const request = await this.store.getRequest(requestId);
    if (!request) throw new Error('Change request not found');

    const reviewer = request.reviewers.find(r => r.userId === reviewerId);
    if (!reviewer) throw new Error('User is not a reviewer');

    reviewer.decision = 'approve';
    reviewer.comment = comment;
    reviewer.decidedAt = Date.now();

    // 检查是否所有审核人都已批准
    if (request.reviewers.every(r => r.decision === 'approve')) {
      request.status = 'approved';
    }

    await this.store.saveRequest(request);

    return request;
  }

  async reject(requestId: string, reviewerId: string, comment: string): Promise<ChangeRequest> {
    const request = await this.store.getRequest(requestId);
    if (!request) throw new Error('Change request not found');

    const reviewer = request.reviewers.find(r => r.userId === reviewerId);
    if (!reviewer) throw new Error('User is not a reviewer');

    reviewer.decision = 'reject';
    reviewer.comment = comment;
    reviewer.decidedAt = Date.now();

    request.status = 'rejected';

    await this.store.saveRequest(request);

    return request;
  }

  async apply(requestId: string, applierId: string): Promise<ChangeRequest> {
    const request = await this.store.getRequest(requestId);
    if (!request) throw new Error('Change request not found');

    if (request.status !== 'approved') {
      throw new Error(`Cannot apply request in status: ${request.status}`);
    }

    // 应用变更
    for (const change of request.changes) {
      await this.configManager.set(change.key, change.newValue, {
        source: 'change-request',
        comment: `Applied via change request ${requestId}`,
      });
    }

    request.status = 'applied';
    request.appliedAt = Date.now();
    request.appliedBy = applierId;

    await this.store.saveRequest(request);
    await this.notificationService.notifyApplied(request);

    return request;
  }

  async schedule(requestId: string, scheduledAt: number): Promise<ChangeRequest> {
    const request = await this.store.getRequest(requestId);
    if (!request) throw new Error('Change request not found');

    if (request.status !== 'approved') {
      throw new Error(`Cannot schedule request in status: ${request.status}`);
    }

    request.scheduledAt = scheduledAt;
    await this.store.saveRequest(request);

    // 设置定时任务
    this.scheduleApply(requestId, scheduledAt);

    return request;
  }

  private async scheduleApply(requestId: string, scheduledAt: number): Promise<void> {
    const delay = scheduledAt - Date.now();
    if (delay <= 0) return;

    setTimeout(async () => {
      try {
        await this.apply(requestId, 'system');
      } catch (error) {
        console.error(`Failed to apply scheduled change request ${requestId}:`, error);
      }
    }, delay);
  }

  private async assignReviewers(request: ChangeRequest): Promise<ChangeRequest['reviewers']> {
    // 根据变更的影响范围自动分配审核人
    const reviewers: ChangeRequest['reviewers'] = [];

    // 高风险变更需要额外审核
    const highRiskKeys = ['llm.apiKey', 'security', 'database.url'];
    const isHighRisk = request.changes.some(c =>
      highRiskKeys.includes(c.key) || c.key.startsWith('security.')
    );

    // 基础审核人
    reviewers.push({ userId: 'ops-lead' });

    if (isHighRisk) {
      reviewers.push({ userId: 'security-lead' });
      reviewers.push({ userId: 'architect' });
    }

    return reviewers;
  }
}
```

### 5.2 配置版本历史

```typescript
// src/config/config-history.ts
interface ConfigHistoryEntry {
  id: string;
  key: string;
  value: ConfigValue;
  version: number;
  changeType: 'create' | 'update' | 'delete' | 'rollback';
  changedBy: string;
  changedAt: number;
  reason?: string;
  ticketId?: string;
  changeRequestId?: string;
}

class ConfigHistory {
  private store: HistoryStore;

  async getHistory(key: string, options?: {
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): Promise<ConfigHistoryEntry[]> {
    return this.store.getHistory(key, options);
  }

  async getChangeTimeline(keys?: string[], startTime?: number, endTime?: number): Promise<{
    date: string;
    changes: ConfigHistoryEntry[];
  }[]> {
    const entries = await this.store.getTimeline(keys, startTime, endTime);

    // 按日期分组
    const grouped = new Map<string, ConfigHistoryEntry[]>();

    for (const entry of entries) {
      const date = new Date(entry.changedAt).toISOString().split('T')[0];
      const existing = grouped.get(date) || [];
      existing.push(entry);
      grouped.set(date, existing);
    }

    return Array.from(grouped.entries())
      .map(([date, changes]) => ({ date, changes }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  async compareVersions(key: string, version1: number, version2: number): Promise<{
    version1: ConfigValue;
    version2: ConfigValue;
    diff: ConfigDiff;
  }> {
    const [entry1, entry2] = await Promise.all([
      this.store.getVersion(key, version1),
      this.store.getVersion(key, version2),
    ]);

    if (!entry1 || !entry2) {
      throw new Error('Version not found');
    }

    return {
      version1: entry1.value,
      version2: entry2.value,
      diff: this.calculateDiff(entry1.value, entry2.value),
    };
  }

  private calculateDiff(oldValue: ConfigValue, newValue: ConfigValue): ConfigDiff {
    // 简单的 diff 计算
    return {
      type: 'modified',
      oldValue,
      newValue,
    };
  }

  async exportConfig(startTime?: number, endTime?: number): Promise<string> {
    const entries = await this.store.getTimeline(undefined, startTime, endTime);

    // 导出为 JSON 格式
    return JSON.stringify({
      exportedAt: Date.now(),
      entries,
    }, null, 2);
  }

  async importConfig(data: string): Promise<{ imported: number; skipped: number }> {
    const parsed = JSON.parse(data);
    let imported = 0;
    let skipped = 0;

    for (const entry of parsed.entries) {
      try {
        await this.store.save(entry);
        imported++;
      } catch {
        skipped++;
      }
    }

    return { imported, skipped };
  }
}
```

## 6. 配置监控与告警

### 6.1 配置健康监控

```typescript
// src/config/config-monitor.ts
interface ConfigHealthStatus {
  key: string;
  isHealthy: boolean;
  issues: string[];
  lastChecked: number;
}

class ConfigHealthMonitor {
  private configManager: ConfigManager;
  private status: Map<string, ConfigHealthStatus>;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.status = new Map();
  }

  async checkHealth(): Promise<ConfigHealthStatus[]> {
    const results: ConfigHealthStatus[] = [];

    for (const group of configDefinitions) {
      for (const item of group.items) {
        const status = await this.checkKey(item.key);
        results.push(status);
        this.status.set(item.key, status);
      }
    }

    return results;
  }

  private async checkKey(key: string): Promise<ConfigHealthStatus> {
    const issues: string[] = [];

    try {
      const value = await this.configManager.get(key);

      // 检查值是否有效
      if (value === undefined || value === null) {
        issues.push('Value is null or undefined');
      }

      // 检查定义
      const definition = this.findDefinition(key);
      if (!definition) {
        issues.push('Definition not found');
      }

      // 类型检查
      if (definition && !this.isValidType(value, definition.type)) {
        issues.push(`Invalid type: expected ${definition.type}`);
      }

      // 范围检查
      if (definition?.type === 'number') {
        const num = value as number;
        if (definition.min !== undefined && num < definition.min) {
          issues.push(`Value below minimum: ${definition.min}`);
        }
        if (definition.max !== undefined && num > definition.max) {
          issues.push(`Value exceeds maximum: ${definition.max}`);
        }
      }

    } catch (error) {
      issues.push(`Failed to get value: ${(error as Error).message}`);
    }

    return {
      key,
      isHealthy: issues.length === 0,
      issues,
      lastChecked: Date.now(),
    };
  }

  private isValidType(value: ConfigValue, type: string): boolean {
    switch (type) {
      case 'string': return typeof value === 'string';
      case 'number': return typeof value === 'number';
      case 'boolean': return typeof value === 'boolean';
      case 'array': return Array.isArray(value);
      case 'object': return typeof value === 'object' && !Array.isArray(value);
      case 'secret': return typeof value === 'string';
      default: return true;
    }
  }

  getUnhealthyConfigs(): ConfigHealthStatus[] {
    return Array.from(this.status.values()).filter(s => !s.isHealthy);
  }

  async notifyUnhealthy(): Promise<void> {
    const unhealthy = this.getUnhealthyConfigs();

    if (unhealthy.length > 0) {
      console.warn(`Unhealthy configs detected: ${unhealthy.map(u => u.key).join(', ')}`);
      // await notificationService.sendAlert('critical', 'Unhealthy configs detected', unhealthy);
    }
  }
}
```

### 6.2 配置相关告警规则

```typescript
// src/config/config-alerts.ts
const configAlertRules = [
  {
    name: 'config_not_found',
    condition: async (key: string) => {
      try {
        await configManager.get(key);
        return false;
      } catch {
        return true;
      }
    },
    severity: 'critical',
    message: 'Critical config key not found',
  },
  {
    name: 'config_value_changed',
    condition: async (key: string, expectedValue: ConfigValue) => {
      const currentValue = await configManager.get(key);
      return currentValue !== expectedValue;
    },
    severity: 'warning',
    message: 'Config value differs from expected',
  },
  {
    name: 'sensitive_config_exposed',
    condition: async (key: string) => {
      const definition = configDefinitions.flatMap(g => g.items).find(i => i.key === key);
      return definition?.sensitive && process.env[key] !== undefined;
    },
    severity: 'critical',
    message: 'Sensitive config found in environment variables (should use secret manager)',
  },
];
```

---

**最后更新**: 2026-04-14
**版本**: v1.0
