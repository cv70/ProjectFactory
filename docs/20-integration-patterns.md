# 集成模式

## 1. 集成层次

### 1.1 系统集成层次

```
┌─────────────────────────────────────────────────────────────────┐
│                        表现层集成                                │
│  - 前端组件集成  - 跨端一致性  - 统一主题                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        服务层集成                                │
│  - API网关  - 服务发现  - 服务降级  - 熔断机制               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        数据层集成                                │
│  - 数据一致性  - 分布式事务  - 数据同步  - 备份恢复              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        外部集成                                  │
│  - LLM提供商  - 云服务  - 第三方API  - 消息队列               │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 外部服务集成

### 2.1 LLM提供商集成

```typescript
// integration/llm/providers.ts

export interface LLMProvider {
  name: string;
  models: string[];
  capabilities: string[];
  client: LLMClient;
}

export interface LLMClient {
  complete(prompt: string, options?: CompletionOptions): Promise<string>;
  chat(messages: Message[], options?: ChatOptions): Promise<Message>;
  embedding(text: string): Promise<number[]>;
  stream(messages: Message[]): AsyncGenerator<string, void, unknown>;
}

export class LLMProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();

  constructor() {
    this.register(new OpenAIProvider());
    this.register(new AnthropicProvider());
    this.register(new AzureOpenAIProvider());
    this.register(new HuggingFaceProvider());
  }

  register(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  async getModel(
    modelName: string,
    providerName?: string
  ): Promise<LLMClient> {
    // 1. 确定提供商
    let provider: LLMProvider;
    if (providerName) {
      provider = this.providers.get(providerName)!;
    } else {
      provider = this.findProviderForModel(modelName);
    }

    if (!provider) {
      throw new Error(`Provider not found for model: ${modelName}`);
    }

    // 2. 初始化客户端
    return await provider.client.initialize(modelName);
  }

  private findProviderForModel(modelName: string): LLMProvider {
    for (const provider of this.providers.values()) {
      if (provider.models.includes(modelName)) {
        return provider;
      }
    }
    throw new Error(`Model not found: ${modelName}`);
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<Message> {
    const modelName = options?.model || this.getDefaultModel();
    const client = await this.getModel(modelName);
    return await client.chat(messages, options);
  }
}

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  models = ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
  capabilities = ['chat', 'completion', 'embedding', 'function-calling'];

  client: any;

  async initialize(modelName: string): Promise<LLMClient> {
    const { Configuration, OpenAIApi } = await import('openai');

    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.client = {
      complete: async (prompt, options) => {
        const api = new OpenAIApi(configuration);
        const response = await api.createCompletion({
          model: modelName,
          prompt,
          ...options,
        });
        return response.choices[0].text;
      },

      chat: async (messages, options) => {
        const api = new OpenAIApi(configuration);
        const response = await api.createChatCompletion({
          model: modelName,
          messages,
          ...options,
        });
        return response.choices[0].message;
      },

      embedding: async (text) => {
        const api = new OpenAIApi(configuration);
        const response = await api.createEmbedding({
          model: 'text-embedding-ada-002',
          input: text,
        });
        return response.data[0].embedding;
      },
    };

    return this.client;
  }
}
```

### 2.2 全文检索集成

```typescript
// integration/search/sqlite-fts.ts

export class SQLiteFTSIntegration {
  private db: Database;

  async initialize(): Promise<void> {
    // 创建全文检索表
    await this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts
      USING fts5(title, content, metadata);
    `);
  }

  async upsert(item: KnowledgeItem): Promise<void> {
    await this.db.run(`
      INSERT INTO knowledge_fts (id, title, content, metadata)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        metadata = excluded.metadata
    `, [item.id, item.title, item.content, JSON.stringify(item.metadata)]);
  }

  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const limit = options.limit || 10;
    const results = await this.db.all(`
      SELECT id, title, content, metadata, bm25(knowledge_fts) as score
      FROM knowledge_fts
      WHERE knowledge_fts MATCH ?
      ORDER BY score
      LIMIT ?
    `, [query, limit]);

    return results.map(r => ({
      id: r.id,
      score: r.score,
      payload: JSON.parse(r.metadata),
    }));
  }

  async optimize(): Promise<void> {
    await this.db.exec('INSERT INTO knowledge_fts(knowledge_fts) VALUES("optimize")');
  }
}
```

### 2.3 消息队列集成

```typescript
// integration/messaging/redis.ts

export class RedisMessaging {
  private client: Redis;
  private subscribers: Map<string, Set<Consumer>> = new Map();

  async initialize(): Promise<void> {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  async publish(channel: string, message: any): Promise<void> {
    await this.client.publish(channel, JSON.stringify(message));
  }

  async subscribe(
    channel: string,
    consumer: Consumer
  ): Promise<void> {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());

      // 订阅Redis频道
      await this.client.subscribe(channel);

      // 监听消息
      this.client.on('message', (chan, message) => {
        if (chan === channel) {
          const data = JSON.parse(message);
          this.deliverToConsumers(channel, data);
        }
      });
    }

    this.subscribers.get(channel)!.add(consumer);
  }

  private async deliverToConsumers(
    channel: string,
    data: any
  ): Promise<void> {
    const consumers = this.subscribers.get(channel);
    if (!consumers) return;

    for (const consumer of consumers) {
      await consumer(data);
    }
  }

  async unsubscribe(channel: string, consumer: Consumer): Promise<void> {
    const consumers = this.subscribers.get(channel);
    if (consumers) {
      consumers.delete(consumer);
      if (consumers.size === 0) {
        await this.client.unsubscribe(channel);
        this.subscribers.delete(channel);
      }
    }
  }
}
```

## 3. 服务间集成

### 3.1 API网关

```typescript
// integration/gateway/api-gateway.ts

export class APIGateway {
  private routes: Map<string, ServiceRoute> = new Map();

  registerService(route: ServiceRoute): void {
    this.routes.set(route.path, route);
  }

  async handleRequest(req: Request): Promise<Response> {
    const route = this.findRoute(req.path, req.method);
    if (!route) {
      return { status: 404, body: { error: 'Not Found' } };
    }

    // 1. 验证
    const validation = await this.validateRequest(req, route);
    if (!validation.valid) {
      return { status: 400, body: { error: validation.error } };
    }

    // 2. 认证
    const auth = await this.authenticate(req, route);
    if (!auth.valid) {
      return { status: 401, body: { error: 'Unauthorized' } };
    }

    // 3. 限流
    const rateLimit = await this.checkRateLimit(req, route);
    if (!rateLimit.allowed) {
      return {
        status: 429,
        body: { error: 'Rate limit exceeded' },
        headers: { 'Retry-After': String(rateLimit.retryAfter) },
      };
    }

    // 4. 熔断
    const circuit = await this.checkCircuitBreaker(route);
    if (circuit.open) {
      return {
        status: 503,
        body: { error: 'Service unavailable' },
      headers: { 'Retry-After': String(circuit.retryAfter) },
      };
    }

    // 5. 转发请求
    const response = await this.forwardRequest(req, route);

    // 6. 记录指标
    await this.recordMetrics(req, route, response);

    return response;
  }

  private async forwardRequest(
    req: Request,
    route: ServiceRoute
  ): Promise<Response> {
    // 实现请求转发逻辑
    // - 超时控制
    // - 重试机制
    // - 错误处理

    return { status: 200, body: {} };
  }
}
```

### 3.2 服务发现

```typescript
// integration/discovery/service-registry.ts

export class ServiceRegistry {
  private services: Map<string, ServiceInfo> = new Map();

  register(service: ServiceInfo): void {
    this.services.set(service.id, {
      ...service,
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
    });
  }

  unregister(serviceId: string): void {
    this.services.delete(serviceId);
  }

  heartbeat(serviceId: string): void {
    const service = this.services.get(serviceId);
    if (service) {
      service.lastHeartbeat = Date.now();
    }
  }

  discover(serviceType: string): ServiceInfo[] {
    const services = Array.from(this.services.values());
    return services.filter(s => s.type === serviceType && this.isHealthy(s));
  }

  private isHealthy(service: ServiceInfo): boolean {
    const age = Date.now() - service.lastHeartbeat;
    return age < 30000; // 30秒内有心跳则健康
  }

  async getService(serviceId: string): Promise<ServiceInfo> {
    const service = this.services.get(serviceId);

    if (!service) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    // 检查健康状态
    if (!this.isHealthy(service)) {
      throw new Error(`Service unhealthy: ${serviceId}`);
    }

    return service;
  }
}
```

## 4. 数据一致性

### 4.1 分布式锁

```typescript
// integration/consistency/distributed-lock.ts

export class DistributedLock {
  constructor(private redis: Redis) {}

  async acquire(
    lockKey: string,
    ttl: number,
    retryDelay: number = 100
  ): Promise<Lock> {
    while (true) {
      const acquired = await this.redis.set(
        lockKey,
        '1',
        'PX', ttl, // 设置过期时间
        'NX'  // 只在不存在时设置
      );

      if (acquired === 'OK') {
        const lockId = generateId();
        return {
          key: lockKey,
          id: lockId,
          acquired: true,
        };
      }

      // 等待重试
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  async release(lock: Lock): Promise<void> {
    // 使用Lua脚本确保只释放自己持有的锁
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    await this.redis.eval(script, 1, lock.key, lock.id);
  }

  async withLock<T>(
    lockKey: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const lock = await this.acquire(lockKey, 30000); // 30秒

    try {
      return await fn();
    } finally {
      await this.release(lock);
    }
  }
}
```

### 4.2 事务管理

```typescript
// integration/consistency/transaction.ts

export class TransactionManager {
  private database: Database;
  private redis: Redis;

  async execute<T>(
    operations: TransactionOperation[]
  ): Promise<T> {
    const transactionId = generateId();

    try {
      // 开始事务
      await this.beginTransaction(transactionId);

      // 执行操作
      for (const op of operations) {
        await this.executeOperation(op, transactionId);
      }

      // 提交事务
      await this.commitTransaction(transactionId);

      return operations.map(op => op.result) as unknown as T;
    } catch (error) {
      // 回滚事务
      await this.rollbackTransaction(transactionId);
      throw error;
    }
  }

  private async beginTransaction(transactionId: string): Promise<void> {
    // 记录事务开始
    await this.redis.hset(`tx:${transactionId}`, {
      status: 'active',
      startedAt: Date.now(),
    });
  }

  private async commitTransaction(transactionId: string): Promise<void> {
    // 标记事务完成
    await this.redis.hset(`tx:${transactionId}`, {
      status: 'committed',
      completedAt: Date.now(),
    });

    // 设置过期时间
    await this.redis.expire(`tx:${transactionId}`, 86400); // 24小时
  }

  private async rollbackTransaction(transactionId: string): Promise<void> {
    // 标记事务回滚
    await this.redis.hset(`tx:${transactionId}`, {
      status: 'rolledback',
      completedAt: Date.now(),
    });
  }
}
```

## 5. 监控集成

### 5.1 指标收集

```typescript
// integration/monitoring/metrics-collector.ts

export class MetricsCollector {
  private pushgateway?: Pushgateway;
  private metrics: Map<string, Metric> = new Map();

  async initialize(): Promise<void> {
    // 初始化Prometheus Push Gateway（可选）
    if (process.env.PROMETHEUS_PUSHGATEWAY) {
      const { Pushgateway } = await import('prom-client');
      this.pushgateway = new Pushgateway({
        url: process.env.PROMETHEUS_PUSHGATEWAY,
      });
    }
  }

  counter(name: string, labels?: Record<string, string>): Counter {
    const key = this.makeKey('counter', name, labels);
    if (!this.metrics.has(key)) {
      const { Counter } = await import('prom-client');
      this.metrics.set(key, new Counter({
        name,
        help: `Counter for ${name}`,
        labelNames: labels ? Object.keys(labels) : undefined,
      }));
    }
    return this.metrics.get(key) as Counter;
  }

  histogram(name: string, labels?: Record<string, string>): Histogram {
    const key = this.makeKey('histogram', name, labels);
    if (!this.metrics.has(key)) {
      const { Histogram } = await import('prom-client');
      this.metrics.set(key, new Histogram({
        name,
        help: `Histogram for ${name}`,
        labelNames: labels ? Object.keys(labels) : undefined,
        buckets: [0.1, 0.5, 1, 5, 10],
      }));
    }
    return this.metrics.get(key) as Histogram;
  }

  gauge(name: string, labels?: Record<string, string>): Gauge {
    const key = this.makeKey('gauge', name, labels);
    if (!this.metrics.has(key)) {
      const { Gauge } = await import('prom-client');
      this.metrics.set(key, new Gauge({
        name,
        help: `Gauge for ${name}`,
        labelNames: labels ? Object.keys(labels) : undefined,
      }));
    }
    return this.metrics.get(key) as Gauge;
  }

  async pushMetrics(): Promise<void> {
    if (this.pushgateway) {
      await this.pushgateway.push({ metrics: Array.from(this.metrics.values()) });
    }
  }

  private makeKey(type: string, name: string, labels?: Record<string, string>): string {
    const labelStr = labels ? JSON.stringify(labels) : '';
    return `${type}:${name}:${labelStr}`;
  }
}
```

---

**版本**: 0.1.0
**更新日期**: 2026-04-14
**状态**: 设计阶段
