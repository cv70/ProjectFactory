# 微服务架构设计

## 1. 概述

本文档描述 ProjectFactory 系统如何从单体架构逐步演进到微服务架构，确保系统的可扩展性、可维护性和高可用性。

### 1.1 架构演进路线

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         架构演进路线                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Phase 1: 单体架构 (当前)                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  ┌────────────────────────────────────────────────────────────────┐  │   │
│  │  │                     ProjectFactory                              │  │   │
│  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │  │   │
│  │  │  │  API   │  │  Agent  │  │   LLM   │  │   DB   │           │  │   │
│  │  │  │ Layer  │  │  Core   │  │ Client  │  │         │           │  │   │
│  │  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘           │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│  Phase 2: 模块化单体                                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │   │
│  │  │  Idea   │  │ Project │  │  Agent  │  │ Quality │  │   Git  │   │   │
│  │  │ Service │  │ Service │  │ Service │  │ Service │  │ Service │   │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘   │   │
│  │                        ┌─────────┐                                   │   │
│  │                        │   LLM   │                                   │   │
│  │                        │ Service │                                   │   │
│  │                        └─────────┘                                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│  Phase 3: 微服务架构                                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐      │   │
│  │  │ Ideas │ │Project│ │ Agent │ │Quality│ │  Git  │ │  LLM  │      │   │
│  │  │  API  │ │  API  │ │  API  │ │  API  │ │  API  │ │Proxy  │      │   │
│  │  └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘      │   │
│  │      └─────────┴─────────┼─────────┴─────────┴─────────┘           │   │
│  │                    ┌──────┴──────┐                                   │   │
│  │                    │  API Gateway │                                   │   │
│  │                    └─────────────┘                                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 服务拆分策略

| 服务 | 职责 | 独立性 | 拆分优先级 |
|------|------|--------|-----------|
| Idea Service | 想法生成和管理 | 高 | P0 |
| Project Service |项目管理 | 高 | P0 |
| Agent Service | Agent 编排 | 中 | P1 |
| Quality Service | 质量检查和评分 | 中 | P1 |
| LLM Proxy | LLM 请求代理 | 高 | P0 |
| Git Service | Git 操作 | 中 | P2 |
| Storage Service | 文件存储 | 高 | P1 |
| Notification Service | 通知推送 | 低 | P2 |

---

## 2. 服务设计

### 2.1 Idea Service

```yaml
# idea-service/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: idea-service
  labels:
    app: projectfactory
    component: idea
spec:
  replicas: 3
  selector:
    app: idea-service
  template:
    spec:
      containers:
        - name: idea-service
          image: projectfactory/idea-service:latest
          ports:
            - containerPort: 4001
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: projectfactory-secrets
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: projectfactory-secrets
                  key: redis-url
          resources:
            requests:
              memory: "256Mi"
              cpu: "200m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: 4001
            initialDelaySeconds: 10
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /ready
              port: 4001
            initialDelaySeconds: 5
            periodSeconds: 10
```

### 2.2 服务间通信

```typescript
// src/services/communication/service-client.ts
import { Channel, Connection } from 'amqplib';

interface ServiceClient<T> {
  serviceName: string;
  baseUrl: string;
  timeout: number;
}

class ServiceClientFactory {
  private clients: Map<string, ServiceClient<any>> = new Map();
  private connection: Connection;

  async getClient<T>(serviceName: string): Promise<T> {
    if (this.clients.has(serviceName)) {
      return this.clients.get(serviceName) as T;
    }

    const config = this.getServiceConfig(serviceName);
    const client = this.createClient<T>(config);
    this.clients.set(serviceName, client);

    return client;
  }

  private createClient<T>(config: ServiceClient<T>): T {
    return {
      serviceName: config.serviceName,
      baseUrl: config.baseUrl,

      // 同步调用
      async call<T>(method: string, path: string, data?: any): Promise<T> {
        const response = await fetch(`${config.baseUrl}${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': generateRequestId(),
            'X-Service-Caller': process.env.SERVICE_NAME,
          },
          body: data ? JSON.stringify(data) : undefined,
          signal: AbortSignal.timeout(config.timeout),
        });

        if (!response.ok) {
          throw new ServiceError(method, path, response.status);
        }

        return response.json();
      },

      // 异步事件发布
      async publish(event: string, payload: any): Promise<void> {
        await this.publishEvent(config.serviceName, event, payload);
      },
    } as T;
  }

  // 事件发布
  async publishEvent(service: string, event: string, payload: any): Promise<void> {
    const channel = await this.connection.createChannel();

    await channel.publish(
      'events',
      `${service}.${event}`,
      Buffer.from(JSON.stringify({
        service,
        event,
        payload,
        timestamp: Date.now(),
        traceId: getCurrentTraceId(),
      })),
      { persistent: true }
    );
  }

  // 事件订阅
  async subscribe(
    service: string,
    event: string,
    handler: (payload: any) => Promise<void>
  ): Promise<void> {
    const channel = await this.connection.createChannel();

    await channel.consume(
      `${service}.${event}`,
      async (msg) => {
        if (msg) {
          try {
            const payload = JSON.parse(msg.content.toString());
            await handler(payload);
            channel.ack(msg);
          } catch (error) {
            // 死信队列处理
            channel.nack(msg, false, false);
          }
        }
      },
      { noAck: false }
    );
  }
}
```

### 2.3 服务注册与发现

```typescript
// src/services/discovery/service-registry.ts
class ServiceRegistry {
  private services: Map<string, ServiceInstance[]> = new Map();
  private healthChecks: Map<string, HealthChecker> = new Map();

  // 服务注册
  async register(service: ServiceDefinition): Promise<void> {
    const instance: ServiceInstance = {
      id: generateInstanceId(),
      name: service.name,
      version: service.version,
      address: service.address,
      port: service.port,
      metadata: service.metadata,
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
    };

    const instances = this.services.get(service.name) || [];
    instances.push(instance);
    this.services.set(service.name, instances);

    // 启动健康检查
    this.startHealthCheck(instance);

    console.log(`Service registered: ${service.name} (${instance.id})`);
  }

  // 服务发现
  async discover(serviceName: string): Promise<ServiceInstance> {
    const instances = this.services.get(serviceName);

    if (!instances || instances.length === 0) {
      throw new ServiceNotFoundError(serviceName);
    }

    // 负载均衡策略
    return this.selectInstance(instances);
  }

  // 负载均衡策略
  private selectInstance(instances: ServiceInstance[]): ServiceInstance {
    // 过滤健康实例
    const healthy = instances.filter(i => i.healthy);

    if (healthy.length === 0) {
      throw new NoHealthyInstancesError(serviceName);
    }

    // 加权随机负载均衡
    const weights = healthy.map(i => i.metadata.weight || 1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < healthy.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return healthy[i];
      }
    }

    return healthy[healthy.length - 1];
  }

  // 健康检查
  private startHealthCheck(instance: ServiceInstance): void {
    const check = new HealthChecker(instance, 30000); // 30s 间隔

    check.on('healthy', () => {
      instance.lastHeartbeat = Date.now();
      instance.healthy = true;
    });

    check.on('unhealthy', () => {
      instance.healthy = false;

      // 连续失败次数过多则移除
      if (instance.consecutiveFailures > 3) {
        this.removeInstance(instance);
      }
    });

    this.healthChecks.set(instance.id, check);
  }

  // 移除实例
  private removeInstance(instance: ServiceInstance): void {
    const instances = this.services.get(instance.name) || [];
    const filtered = instances.filter(i => i.id !== instance.id);
    this.services.set(instance.name, filtered);

    const check = this.healthChecks.get(instance.id);
    if (check) {
      check.stop();
      this.healthChecks.delete(instance.id);
    }

    console.log(`Service removed: ${instance.name} (${instance.id})`);
  }
}
```

---

## 3. 数据管理

### 3.1 数据库-per-服务模式

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           数据隔离架构                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐       │
│  │  Idea Service   │    │ Project Service │    │ Quality Service │       │
│  │                 │    │                 │    │                 │       │
│  │  ┌───────────┐  │    │  ┌───────────┐  │    │  ┌───────────┐  │       │
│  │  │ Ideas DB  │  │    │  │Projects DB │  │    │  │Quality DB │  │       │
│  │  │ SQLite    │  │    │  │ PostgreSQL│  │    │  │ PostgreSQL│  │       │
│  │  └───────────┘  │    │  └───────────┘  │    │  └───────────┘  │       │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘       │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Shared Services                              │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │   │
│  │  │   Redis         │  │   LLM Proxy     │  │   Storage       │    │   │
│  │  │   (Sessions)    │  │   (No State)    │  │   (Files)       │    │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 跨服务数据访问

```typescript
// src/services/data/api-client.ts
// 跨服务数据访问 - 严禁直接访问其他服务的数据库

class CrossServiceDataAccess {
  constructor(private httpClient: HttpClient) {}

  // 获取想法相关的项目
  async getProjectsByIdea(ideaId: string): Promise<Project[]> {
    // 通过 Project Service API 获取
    const response = await this.httpClient.get<Project[]>(
      `${PROJECT_SERVICE_URL}/api/v1/ideas/${ideaId}/projects`
    );
    return response.data;
  }

  // 获取项目的质量报告
  async getQualityReport(projectId: string): Promise<QualityReport> {
    const response = await this.httpClient.get<QualityReport>(
      `${QUALITY_SERVICE_URL}/api/v1/projects/${projectId}/quality`
    );
    return response.data;
  }

  // 获取想法生成器状态
  async getGeneratorStatus(ideaId: string): Promise<GeneratorStatus> {
    const response = await this.httpClient.get<GeneratorStatus>(
      `${AGENT_SERVICE_URL}/api/v1/ideas/${ideaId}/status`
    );
    return response.data;
  }
}

// 禁止模式 - 永远不要这样做
/*
 ❌ 禁止：直接连接其他服务的数据库
 const db = await connectToDatabase('postgresql://project-service:5432/projects');
 const projects = await db.query('SELECT * FROM projects WHERE idea_id = ?', [ideaId]);

 ❌ 禁止：共享数据库 schema
 // 在同一个数据库中创建其他服务的表
```

### 3.3 事件驱动数据同步

```typescript
// src/services/events/idea-events.ts
// 想法服务发布事件，其他服务订阅并更新本地数据

class IdeaEventPublisher {
  constructor(private eventBus: EventBus) {}

  async publishIdeaCreated(idea: Idea): Promise<void> {
    await this.eventBus.publish({
      type: 'IDEA_CREATED',
      payload: {
        id: idea.id,
        title: idea.title,
        description: idea.description,
        createdAt: idea.createdAt,
      },
      metadata: {
        correlationId: getCurrentCorrelationId(),
        causationId: getCurrentCausationId(),
      },
    });
  }

  async publishIdeaCompleted(ideaId: string, outcome: IdeaOutcome): Promise<void> {
    await this.eventBus.publish({
      type: 'IDEA_COMPLETED',
      payload: {
        ideaId,
        outcome,
        completedAt: Date.now(),
      },
    });
  }
}

// 项目服务订阅想法事件
class ProjectEventSubscriber {
  constructor(private eventBus: EventBus) {}

  async subscribe(): Promise<void> {
    // 订阅想法创建事件
    await this.eventBus.subscribe(
      'idea-service.IDEA_CREATED',
      async (event) => {
        // 在项目服务中创建初始项目记录
        await this.createInitialProject(event.payload);
      }
    );

    // 订阅想法完成事件
    await this.eventBus.subscribe(
      'idea-service.IDEA_COMPLETED',
      async (event) => {
        // 更新项目状态
        await this.updateProjectStatus(event.payload);
      }
    );
  }
}
```

---

## 4. 服务网格

### 4.1 Sidecar 代理配置

```yaml
# k8s/istio/virtual-service.yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: idea-service
spec:
  hosts:
    - idea-service
  http:
    - match:
        - headers:
            X-Circuit-Breaker:
              exact: "true"
      route:
        - destination:
            host: idea-service
            subset: fallback
          weight: 100
    - route:
        - destination:
            host: idea-service
            subset: stable
          weight: 100
  retries:
    attempts: 3
    perTryTimeout: 5s
    retryOn: gateway-error,connect-failure,reset
  timeout: 30s
```

### 4.2 熔断配置

```yaml
# k8s/istio/destination-rule.yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: idea-service
spec:
  host: idea-service
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        h2UpgradePolicy: UPGRADE
        http1MaxPendingRequests: 100
        http2MaxRequests: 1000
    loadBalancer:
      simple: LEAST_CONN
      localityLbSetting:
        enabled: true
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
```

---

## 5. 分布式事务

### 5.1 Saga 模式实现

```typescript
// src/services/saga/saga-orchestrator.ts
// 分布式事务使用 Saga 模式替代 2PC

interface SagaStep<TInput, TOutput> {
  name: string;
  compensate: (output: TOutput) => Promise<void>;
  execute: (input: TInput) => Promise<TOutput>;
}

class ProjectCreationSaga {
  private steps: SagaStep<any, any>[] = [
    {
      name: 'create-idea-record',
      execute: async (input) => {
        return await this.ideaService.create(input.idea);
      },
      compensate: async (output) => {
        await this.ideaService.delete(output.id);
      },
    },
    {
      name: 'create-project-record',
      execute: async (input) => {
        return await this.projectService.create({
          ideaId: input.idea.id,
          name: input.projectName,
        });
      },
      compensate: async (output) => {
        await this.projectService.delete(output.id);
      },
    },
    {
      name: 'initialize-storage',
      execute: async (input) => {
        return await this.storageService.initialize(input.projectId);
      },
      compensate: async (output) => {
        await this.storageService.cleanup(output.bucket);
      },
    },
    {
      name: 'start-agent-workflow',
      execute: async (input) => {
        return await this.agentService.start(input.projectId);
      },
      compensate: async (output) => {
        await this.agentService.stop(output.workflowId);
      },
    },
  ];

  async execute(input: ProjectCreationInput): Promise<SagaResult> {
    const context: Map<string, any> = new Map();
    const completedSteps: string[] = [];

    try {
      for (const step of this.steps) {
        console.log(`Executing step: ${step.name}`);

        const output = await step.execute(input);
        context.set(step.name, output);
        completedSteps.push(step.name);
      }

      return { success: true, context };
    } catch (error) {
      console.error(`Saga failed at step ${completedSteps.length}, starting compensation`);

      // 向后补偿
      for (const stepName of completedSteps.reverse()) {
        const step = this.steps.find(s => s.name === stepName);
        const output = context.get(stepName);

        try {
          console.log(`Compensating step: ${stepName}`);
          await step.compensate(output);
        } catch (compensateError) {
          console.error(`Compensation failed for ${stepName}:`, compensateError);
          // 记录用于人工干预
          await this.recordCompensationFailure(stepName, output, compensateError);
        }
      }

      return {
        success: false,
        error: error.message,
        failedStep: completedSteps[completedSteps.length - 1],
      };
    }
  }
}
```

### 5.2 事务补偿机制

```typescript
// src/services/saga/compensation-handler.ts
class CompensationHandler {
  constructor(
    private compensationLog: CompensationLogStore,
    private alertService: AlertService
  ) {}

  async handleCompensationFailure(
    saga: string,
    step: string,
    output: any,
    error: Error
  ): Promise<void> {
    // 记录补偿失败
    await this.compensationLog.record({
      saga,
      step,
      output,
      error: error.message,
      timestamp: Date.now(),
      retryCount: 0,
    });

    // 发送告警
    await this.alertService.send({
      severity: 'critical',
      title: `Saga 补偿失败: ${saga}.${step}`,
      message: `无法自动补偿，请人工干预`,
      metadata: {
        saga,
        step,
        output,
        error: error.message,
      },
    });

    // 启动定时重试
    await this.scheduleCompensationRetry(saga, step, output);
  }

  private async scheduleCompensationRetry(
    saga: string,
    step: string,
    output: any
  ): Promise<void> {
    // 延迟重试
    setTimeout(async () => {
      const record = await this.compensationLog.get(saga, step);

      if (record.retryCount < 5) {
        try {
          const handler = this.getCompensationHandler(step);
          await handler(output);

          await this.compensationLog.delete(saga, step);
          console.log(`补偿成功: ${saga}.${step}`);
        } catch (error) {
          record.retryCount++;
          await this.compensationLog.update(record);
          await this.scheduleCompensationRetry(saga, step, output);
        }
      } else {
        await this.escalateToHuman(saga, step, output);
      }
    }, 30000 * Math.pow(2, record.retryCount)); // 指数退避
  }
}
```

---

## 6. 服务监控

### 6.1 服务指标

```typescript
// src/services/metrics/service-metrics.ts
const serviceMetrics = {
  // 请求指标
  httpRequestsTotal: new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['service', 'method', 'path', 'status'],
  }),

  httpRequestDuration: new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration',
    labelNames: ['service', 'method', 'path'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  }),

  // 服务间调用指标
  rpcRequestsTotal: new Counter({
    name: 'rpc_requests_total',
    help: 'Total RPC requests',
    labelNames: ['caller', 'callee', 'method', 'status'],
  }),

  rpcRequestDuration: new Histogram({
    name: 'rpc_request_duration_seconds',
    help: 'RPC request duration',
    labelNames: ['caller', 'callee', 'method'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  }),

  // 熔断器指标
  circuitBreakerState: new Gauge({
    name: 'circuit_breaker_state',
    help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
    labelNames: ['service', 'circuit'],
  }),

  // 队列指标
  queueDepth: new Gauge({
    name: 'queue_depth',
    help: 'Current queue depth',
    labelNames: ['service', 'queue'],
  }),

  processingJobs: new Gauge({
    name: 'processing_jobs',
    help: 'Number of jobs currently being processed',
    labelNames: ['service', 'queue'],
  }),
};
```

### 6.2 分布式追踪

```typescript
// src/services/tracing/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';

const sdk = new NodeSDK({
  serviceName: process.env.SERVICE_NAME,
  traceExporter: new JaegerExporter({
    endpoint: 'http://jaeger:14268/api/traces',
  }),
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
  ],
});

sdk.start();

// 服务间调用传播 Trace Context
async function callService(
  serviceName: string,
  path: string,
  options?: RequestOptions
): Promise<Response> {
  const span = tracer.startSpan(`HTTP ${path}`, {
    attributes: {
      'peer.service': serviceName,
      'http.url': `${serviceName}${path}`,
    },
  });

  try {
    // 注入当前 Trace Context 到请求头
    const headers = {
      ...options.headers,
      'traceparent': formatTraceParent(span.spanContext()),
      'tracestate': formatTraceState(span.spanContext()),
    };

    const response = await fetch(`${serviceName}${path}`, {
      ...options,
      headers,
    });

    span.setStatus({ code: response.ok ? 0 : 1 });
    return response;
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: 2 });
    throw error;
  } finally {
    span.end();
  }
}
```

---

## 7. 部署策略

### 7.1 金丝雀部署

```yaml
# k8s/canary-deployment.yaml
apiVersion: argocd.rocks.io/v1alpha1
kind: Rollout
metadata:
  name: idea-service
spec:
  replicas: 10
  strategy:
    canary:
      steps:
        - setWeight: 5
        - pause: {duration: 10m}
        - setWeight: 20
        - pause: {duration: 10m}
        - setWeight: 50
        - pause: {duration: 10m}
        - setWeight: 100
      canaryMetadata:
        labels:
          role: canary
      stableMetadata:
        labels:
          role: stable
      trafficRouting:
        - type: istio
          istio:
            virtualService:
              name: idea-service
              routes:
                - canary
      analysis:
        templates:
          - templateName: success-rate
          - templateName: latency
        startingStep: 1
        args:
          - name: service-name
            value: idea-service
```

### 7.2 蓝绿部署

```bash
# 蓝绿部署脚本
#!/bin/bash
DEPLOYMENT_NAME="projectfactory"
BLUE_VERSION=$(kubectl get deployment $DEPLOYMENT_NAME-blue -o jsonpath='{.spec.template.spec.containers[0].image}')
GREEN_VERSION=${1:-"projectfactory/idea-service:v2.0.0"}

echo "当前版本: $BLUE_VERSION"
echo "新版本: $GREEN_VERSION"

# 部署绿色版本
kubectl clone deployment $DEPLOYMENT_NAME-blue $DEPLOYMENT_NAME-green
kubectl set image deployment/$DEPLOYMENT_NAME-green \
    idea-service=$GREEN_VERSION

# 等待绿色版本就绪
kubectl rollout status deployment/$DEPLOYMENT_NAME-green

# 切换流量
kubectl label deployment/$DEPLOYMENT_NAME-blue \
    version=blue --overwrite
kubectl label deployment/$DEPLOYMENT_NAME-green \
    version=green --overwrite

# 流量切换 (Istio)
kubectl patch virtualservice $DEPLOYMENT_NAME \
    --type='json' \
    -p='[{"op": "replace", "path": "/spec/http/0/mesh", "value": [{"destination": { "host": "'$DEPLOYMENT_NAME'-green" }}]}]'

# 验证
sleep 30
curl -sf http://idea-service/health || {
    echo "验证失败，回滚..."
    kubectl patch virtualservice $DEPLOYMENT_NAME \
        --type='json' \
        -p='[{"op": "replace", "path": "/spec/http/0/mesh", "value": [{"destination": { "host": "'$DEPLOYMENT_NAME'-blue" }}]}]'
    exit 1
}

# 删除旧版本
kubectl delete deployment $DEPLOYMENT_NAME-blue
kubectl rename deployment $DEPLOYMENT_NAME-green $DEPLOYMENT_NAME-blue

echo "部署成功!"
```

---

## 8. 相关文档

- [部署架构](./DEPLOYMENT_ARCHITECTURE.md)
- [事件驱动架构](./EVENT_DRIVEN_ARCHITECTURE.md)
- [API 网关](./API_GATEWAY.md)
- [监控与告警](./MONITORING_ALERTING.md)
- [容错与降级](./FAULT_TOLERANCE.md)

---

**最后更新**: 2026-04-14
