# 配置管理

## 1. 配置层次

### 1.1 配置优先级

```
命令行参数 > 环境变量 > 配置文件 > 默认值
```

### 1.2 配置来源

| 来源 | 优先级 | 用途 |
|------|--------|------|
| 命令行参数 | 最高 | 临时覆盖，调试 |
| 环境变量 | 高 | 部署环境特定配置 |
| 配置文件 | 中 | 项目级配置 |
| 默认值 | 低 | 开发默认值 |

## 2. 环境配置

### 2.1 环境变量定义

```typescript
// config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  // 运行环境
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),

  // 数据库
  DATABASE_URL: z.string().default('sqlite://data.db'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // LLM
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_PROVIDER: z.enum(['openai', 'anthropic']).default('openai'),
  LLM_MODEL: z.string().default('gpt-4'),

  // 认证
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // 存储
  STORAGE_PATH: z.string().default('./storage'),
  PROJECTS_PATH: z.string().default('./storage/projects'),

  // 日志
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('pretty'),

  // 监控
  METRICS_ENABLED: z.coerce.boolean().default(true),
  METRICS_PORT: z.coerce.number().default(9090),

  // 限流
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().default(60000),

  // Agent
  MAX_CONCURRENT_PROJECTS: z.coerce.number().default(5),
  MAX_LLM_CONCURRENCY: z.coerce.number().default(10),
  GENERATION_TIMEOUT: z.coerce.number().default(86400000), // 24h

  // 安全
  CORS_ORIGIN: z.string().default('*'),
  CSP_ENABLED: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Invalid environment variables:');
      error.errors.forEach(err => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}
```

### 2.2 .env文件模板

```bash
# .env.example

# 运行环境
NODE_ENV=development
PORT=3000

# 数据库
DATABASE_URL=sqlite://./storage/data.db
REDIS_URL=redis://localhost:6379

# LLM (至少配置一个)
OPENAI_API_KEY=sk-xxx
# ANTHROPIC_API_KEY=sk-xxx
LLM_PROVIDER=openai
LLM_MODEL=gpt-4

# 认证 (生产环境必须设置)
JWT_SECRET=your-secret-key-at-least-32-characters
JWT_EXPIRES_IN=7d

# 存储
STORAGE_PATH=./storage
PROJECTS_PATH=./storage/projects

# 日志
LOG_LEVEL=debug
LOG_FORMAT=pretty

# 监控
METRICS_ENABLED=true
METRICS_PORT=9090

# 限流
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000

# Agent
MAX_CONCURRENT_PROJECTS=5
MAX_LLM_CONCURRENCY=10
GENERATION_TIMEOUT=86400000

# 安全
CORS_ORIGIN=http://localhost:5173
CSP_ENABLED=false
```

## 3. 配置文件

### 3.1 应用配置

```yaml
# config/app.yaml
app:
  name: ProjectFactory
  version: 0.1.0
  description: Automated Project Generation System

server:
  host: 0.0.0.0
  port: ${PORT:3000}
  cors:
    origins:
      - ${CORS_ORIGIN:http://localhost:5173}
    methods:
      - GET
      - POST
      - PUT
      - DELETE
    credentials: true

database:
  type: sqlite
  path: ${DATABASE_URL:./storage/data.db}
  pool:
    min: 1
    max: 5
  migrations:
    run: true
    path: ./db/migrations

redis:
  url: ${REDIS_URL:redis://localhost:6379}
  prefix: pf:
```

### 3.2 Agent配置

```yaml
# config/agents.yaml
agents:
  meta:
    timeout: 86400000  # 24h
    retry:
      maxAttempts: 3
      backoff: exponential
      baseDelay: 5000

  requirement:
    llm:
      provider: ${LLM_PROVIDER:openai}
      model: ${LLM_MODEL:gpt-4}
      temperature: 0.7
      maxTokens: 4000
    timeout: 300000  # 5min

  architecture:
    llm:
      provider: ${LLM_PROVIDER:openai}
      model: ${LLM_MODEL:gpt-4}
      temperature: 0.5
      maxTokens: 8000
    timeout: 600000  # 10min

  development:
    llm:
      provider: ${LLM_PROVIDER:openai}
      model: ${LLM_MODEL:gpt-4}
      temperature: 0.3
      maxTokens: 16000
    timeout: 1800000  # 30min
    concurrency:
      frontend: 5
      backend: 5
      config: 10

  quality:
    timeout: 600000  # 10min
    staticAnalysis:
      enabled: true
      rules: eslint-recommended
    securityScan:
      enabled: true
    tests:
      generate: true
      run: true
      coverageThreshold: 80

  deployment:
    timeout: 300000  # 5min
    docker:
      enabled: true
      registry: ${DOCKER_REGISTRY:}
    healthCheck:
      enabled: true
      retries: 3
      interval: 10000

  evolution:
    interval: 3600000  # 1h
    batchSize: 100
```

### 3.3 LLM配置

```yaml
# config/llm.yaml
providers:
  openai:
    apiKey: ${OPENAI_API_KEY}
    models:
      gpt-4:
        contextWindow: 8192
        inputCost: 0.03  # per 1k tokens
        outputCost: 0.06
      gpt-4-turbo:
        contextWindow: 128000
        inputCost: 0.01
        outputCost: 0.03
      gpt-3.5-turbo:
        contextWindow: 4096
        inputCost: 0.0015
        outputCost: 0.002

  anthropic:
    apiKey: ${ANTHROPIC_API_KEY}
    models:
      claude-3-opus:
        contextWindow: 200000
        inputCost: 0.015
        outputCost: 0.075
      claude-3-sonnet:
        contextWindow: 200000
        inputCost: 0.003
        outputCost: 0.015

defaults:
  provider: ${LLM_PROVIDER:openai}
  model: ${LLM_MODEL:gpt-4}
  temperature: 0.7
  maxTokens: 4000

cache:
  enabled: true
  ttl: 86400000  # 24h
  maxSize: 1000

rateLimit:
  requestsPerMinute: 60
  tokensPerMinute: 100000
```

## 4. 配置加载

### 4.1 配置管理器

```typescript
// config/index.ts
import { loadEnv, Env } from './env';
import { loadYaml } from './yaml';
import { deepMerge } from '../utils/objects';

export class ConfigManager {
  private env: Env;
  private config: Record<string, unknown>;

  constructor() {
    this.env = loadEnv();
    this.config = this.loadAllConfigs();
  }

  private loadAllConfigs(): Record<string, unknown> {
    const configs = [
      this.loadConfig('app'),
      this.loadConfig('agents'),
      this.loadConfig('llm'),
    ];

    return configs.reduce((acc, config) => deepMerge(acc, config), {});
  }

  private loadConfig(name: string): Record<string, unknown> {
    try {
      const path = `./config/${name}.yaml`;
      const config = loadYaml(path);
      return this.interpolateEnv(config);
    } catch (error) {
      console.warn(`Failed to load ${name}.yaml, using defaults`);
      return {};
    }
  }

  private interpolateEnv(config: unknown): unknown {
    // 替换 ${VAR} 或 ${VAR:default} 为环境变量值
    if (typeof config === 'string') {
      return config.replace(/\$\{(\w+)(?::([^}]*))?\}/g, (_, name, defaultValue) => {
        return process.env[name] || defaultValue || '';
      });
    }

    if (Array.isArray(config)) {
      return config.map(item => this.interpolateEnv(item));
    }

    if (typeof config === 'object' && config !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(config)) {
        result[key] = this.interpolateEnv(value);
      }
      return result;
    }

    return config;
  }

  get<T>(path: string, defaultValue?: T): T {
    const keys = path.split('.');
    let value: unknown = this.config;

    for (const key of keys) {
      if (typeof value !== 'object' || value === null) {
        return defaultValue as T;
      }
      value = (value as Record<string, unknown>)[key];
    }

    return (value as T) ?? (defaultValue as T);
  }

  getEnv(): Env {
    return this.env;
  }

  isDevelopment(): boolean {
    return this.env.NODE_ENV === 'development';
  }

  isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  isTest(): boolean {
    return this.env.NODE_ENV === 'test';
  }
}

export const config = new ConfigManager();
```

### 4.2 配置验证

```typescript
// config/validation.ts
import { z } from 'zod';
import { config } from './index';

const configSchema = z.object({
  app: z.object({
    name: z.string(),
    version: z.string(),
  }),

  server: z.object({
    host: z.string(),
    port: z.number().min(1).max(65535),
    cors: z.object({
      origins: z.array(z.string()),
    }),
  }),

  database: z.object({
    type: z.enum(['sqlite', 'postgresql']),
    path: z.string(),
  }),

  agents: z.object({
    meta: z.object({
      timeout: z.number().positive(),
    }),
    // ... 其他Agent配置
  }),

  llm: z.object({
    providers: z.record(z.string(), z.object({
      apiKey: z.string().optional(),
      models: z.record(z.string(), z.any()),
    })),
    defaults: z.object({
      provider: z.string(),
      model: z.string(),
    }),
  }),
});

export function validateConfig(): void {
  try {
    configSchema.parse({
      app: config.get('app'),
      server: config.get('server'),
      database: config.get('database'),
      agents: config.get('agents'),
      llm: config.get('llm'),
    });

    console.log('✓ Configuration validated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('✗ Configuration validation failed:');
      error.errors.forEach(err => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}
```

## 5. 动态配置

### 5.1 运行时配置更新

```typescript
// config/runtime.ts
import { EventEmitter } from 'events';

export class RuntimeConfig extends EventEmitter {
  private values: Map<string, unknown> = new Map();

  set(key: string, value: unknown): void {
    const oldValue = this.values.get(key);
    this.values.set(key, value);
    this.emit('change', { key, oldValue, newValue: value });
  }

  get<T>(key: string): T | undefined {
    return this.values.get(key) as T;
  }

  delete(key: string): void {
    const oldValue = this.values.get(key);
    this.values.delete(key);
    this.emit('change', { key, oldValue, newValue: undefined });
  }
}

export const runtimeConfig = new RuntimeConfig();

// 监听配置变化
runtimeConfig.on('change', ({ key, oldValue, newValue }) => {
  console.log(`Config changed: ${key}`, { oldValue, newValue });
});
```

### 5.2 特性开关

```typescript
// config/features.ts
export interface FeatureFlags {
  enableNewArchitecture: boolean;
  enableAdvancedQualityChecks: boolean;
  enableKnowledgeRAG: boolean;
  enableParallelGeneration: boolean;
}

const defaultFeatureFlags: FeatureFlags = {
  enableNewArchitecture: false,
  enableAdvancedQualityChecks: false,
  enableKnowledgeRAG: true,
  enableParallelGeneration: true,
};

export function getFeatureFlags(): FeatureFlags {
  return {
    ...defaultFeatureFlags,
    ...config.get<Partial<FeatureFlags>>('features'),
  };
}

export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return getFeatureFlags()[feature];
}
```

## 6. 配置文档

### 6.1 配置Schema生成

```typescript
// config/schema.ts
import { zodToJsonSchema } from 'zod-to-json-schema';
import { writeFileSync } from 'fs';
import { envSchema } from './env';

export function generateConfigSchema(): void {
  const schema = zodToJsonSchema(envSchema, {
    name: 'ProjectFactoryConfig',
  });

  writeFileSync(
    'config.schema.json',
    JSON.stringify(schema, null, 2)
  );
}
```

### 6.2 配置文档生成

```typescript
// config/docs.ts
import { envSchema } from './env';
import { writeFileSync } from 'fs';

export function generateConfigDocs(): void {
  const shape = envSchema.shape;
  const docs: string[] = [];

  docs.push('# Environment Variables\n');
  docs.push('| Variable | Type | Default | Description |');
  docs.push('|----------|------|---------|-------------|');

  for (const [name, schema] of Object.entries(shape)) {
    const zodSchema = schema as z.ZodTypeAny;
    const defaultValue = zodSchema._def.defaultValue?.();
    const typeName = zodSchema._def.typeName;

    docs.push(`| ${name} | ${typeName} | ${defaultValue ?? 'required'} | |`);
  }

  writeFileSync('docs/configuration.md', docs.join('\n'));
}
```

---

**版本**: 0.1.0
**更新日期**: 2026-04-14
**状态**: 设计阶段
