# 无服务器架构设计

## 1. 概述

本文档描述 ProjectFactory 系统的无服务器 (Serverless) 架构设计，利用云函数实现弹性扩展和成本优化。

### 1.1 Serverless 架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Serverless 架构                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         事件源                                        │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │   │
│  │  │  HTTP   │  │   Cron  │  │   SNS   │  │   S3   │            │   │
│  │  │ Requests│  │  Jobs   │  │  Events │  │  Files  │            │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘            │   │
│  └───────┼───────────┼───────────┼───────────┼──────────────────────┘   │
│          └───────────┴───────────┴───────────┘                          │
│                              ↓                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        函数计算层                                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │   │
│  │  │  Lambda     │  │   Cloud     │  │   Edge     │             │   │
│  │  │  Functions  │  │   Workers   │  │   Workers  │             │   │
│  │  │             │  │             │  │             │             │   │
│  │  │ • Idea Gen │  │ • Quality   │  │ • Routing  │             │   │
│  │  │ • Code Gen │  │   Check    │  │ • Auth     │             │   │
│  │  │ • Review   │  │ • Reports  │  │ • Static   │             │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        状态层                                        │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │   │
│  │  │ DynamoDB│  │   S3    │  │  Redis  │  │   SQS   │            │   │
│  │  │ (State) │  │(Files) │  │ (Cache) │  │ (Queue) │            │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 函数设计

### 2.1 函数类型定义

```yaml
# serverless/functions.yaml
functions:
  # HTTP 处理函数
  http:
    apiHandler:
      runtime: nodejs20.x
      memory: 512MB
      timeout: 30s
      events:
        - http:
            path: /api/{proxy+}
            method: [GET, POST, PUT, DELETE, PATCH]
      layers:
        - arn:aws:lambda:us-east-1:123456789012:layer:common-utils:1

    authHandler:
      runtime: nodejs20.x
      memory: 256MB
      timeout: 10s
      events:
        - http:
            path: /auth/{proxy+}
            method: [POST]

  # 定时触发函数
  scheduled:
    ideaGenerator:
      runtime: nodejs20.x
      memory: 1024MB
      timeout: 300s  # 5 分钟
      schedule: rate(1 hour)
      events:
        - schedule: cron(0 * * * ? *)

    reportGenerator:
      runtime: nodejs20.x
      memory: 512MB
      timeout: 180s
      schedule: rate(1 day)
      events:
        - schedule: cron(0 2 * * ? *)

  # 事件驱动函数
  eventDriven:
    projectCreated:
      runtime: nodejs20.x
      memory: 512MB
      timeout: 60s
      events:
        - sqs:
            queue: project-creation-queue
            batchSize: 1
      reservedConcurrency: 10

    qualityCheck:
      runtime: nodejs20.x
      memory: 1024MB
      timeout: 120s
      events:
        - s3:
            bucket: projectfactory-code
            events: [s3:ObjectCreated:*]
            rules:
              - prefix: generated/
      reservedConcurrency: 5

    codeReview:
      runtime: nodejs20.x
      memory: 2048MB
      timeout: 300s
      events:
        - sns:
            topic: code-review-events
            filterPolicy:
              eventType:
                - pull_request.opened
                - pull_request.updated
```

### 2.2 函数配置

```yaml
# serverless/serverless.yml
service: projectfactory
frameworkVersion: "3"

provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1
  stage: ${opt:stage, 'dev'}

  # IAM 角色
  iam:
    role:
      statements:
        - Effect: Allow
          Action:
            - s3:GetObject
            - s3:PutObject
            - s3:DeleteObject
          Resource: "arn:aws:s3:::projectfactory-*/*"
        - Effect: Allow
          Action:
            - sqs:ReceiveMessage
            - sqs:DeleteMessage
            - sqs:SendMessage
          Resource: "arn:aws:sqs:*:*:projectfactory-*"
        - Effect: Allow
          Action:
            - dynamodb:Query
            - dynamodb:Scan
            - dynamodb:GetItem
            - dynamodb:PutItem
            - dynamodb:UpdateItem
          Resource:
            - "arn:aws:dynamodb:*:*:table/ideas"
            - "arn:aws:dynamodb:*:*:table/projects"
            - "arn:aws:dynamodb:*:*:table/quality-metrics"

  # 环境变量
  environment:
    NODE_ENV: ${self:provider.stage}
    DYNAMODB_TABLE_PREFIX: ${self:provider.stage}
    REDIS_URL: ${env:REDIS_URL}
    LLM_API_KEY: ${env:LLM_API_KEY}

  # VPC 配置 (可选)
  vpc:
    securityGroupIds:
      - !GetAtt SecurityGroups.Default
    subnetIds:
      - !Ref Subnets.Private1
      - !Ref Subnets.Private2

  # 日志
  logs:
    restApi:
      format: json
      retention: 14 days

functions:
  apiHandler:
    handler: src/handlers/api.main
    events:
      - http:
          path: /api/{proxy+}
          method: ANY
          cors: true
    layers:
      - !Ref CommonUtilsLayer

  ideaGenerator:
    handler: src/handlers/idea-generator.main
    memorySize: 1024
    timeout: 300
    events:
      - schedule: cron(0 * * * ? *)

  projectCreator:
    handler: src/handlers/project-creator.main
    memorySize: 512
    timeout: 120
    events:
      - sqs:
          queue: !GetAtt ProjectCreationQueue.Url
          batchSize: 1

# 自定义层
resources:
  Layers:
    CommonUtilsLayer:
      Type: AWS::Lambda::LayerVersion
      Properties:
        ContentUri: layers/common-utils/
        CompatibleRuntimes:
          - nodejs20.x
```

---

## 3. 事件驱动设计

### 3.1 事件总线

```yaml
# serverless/events/event-bus.yaml
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  EventBus:
    Type: AWS::Events::EventBus
    Properties:
      Name: projectfactory-events

  # 规则
  IdeaCreatedRule:
    Type: AWS::Events::Rule
    Properties:
      EventBusName: !Ref EventBus
      Description: "Route idea created events"
      State: ENABLED
      Targets:
        - Id: projectCreatorQueue
          Arn: !GetAtt ProjectCreationQueue.Arn
        - Id: analyticsTopic
          Arn: !Ref AnalyticsTopic

  QualityCheckRule:
    Type: AWS::Events::Rule
    Properties:
      EventBusName: !Ref EventBus
      Description: "Route code generation completed events"
      EventPattern:
        source:
          - projectfactory.project
        detail-type:
          - code.generation.completed
      Targets:
        - Id: qualityCheckQueue
          Arn: !GetAtt QualityCheckQueue.Arn

  # 默认规则
  DefaultRule:
    Type: AWS::Events::Rule
    Properties:
      EventBusName: !Ref EventBus
      Description: "Catch all events for logging"
      EventPattern:
        source:
          - projectfactory
      Targets:
        - Id: cloudwatchLogs
          Arn: !GetAtt CloudWatchLogsGroup.Arn

Outputs:
  EventBusArn:
    Value: !GetAtt EventBus.Arn
  EventBusName:
    Value: !Ref EventBus
```

### 3.2 事件类型

```typescript
// serverless/events/types.ts
// 事件类型定义

type EventType =
  // 想法事件
  | 'idea.created'
  | 'idea.updated'
  | 'idea.completed'
  | 'idea.failed'

  // 项目事件
  | 'project.created'
  | 'project.started'
  | 'project.progress'
  | 'project.completed'
  | 'project.failed'

  // 代码事件
  | 'code.generation.started'
  | 'code.generation.progress'
  | 'code.generation.completed'
  | 'code.generation.failed'

  // 质量事件
  | 'quality.check.started'
  | 'quality.check.completed'
  | 'quality.check.failed'

  // 用户事件
  | 'user.created'
  | 'user.login'
  | 'user.action';

// 事件结构
interface BaseEvent<T = any> {
  id: string;           // 事件 ID
  version: string;     // 事件版本
  type: EventType;     // 事件类型
  source: string;      // 事件源
  timestamp: string;    // ISO 时间戳
  correlationId?: string;
  causationId?: string;
  data: T;
  metadata?: Record<string, any>;
}

// 事件示例
interface IdeaCreatedEvent extends BaseEvent<{
  ideaId: string;
  title: string;
  description: string;
  createdBy: string;
  tags: string[];
}> {}

interface ProjectProgressEvent extends BaseEvent<{
  projectId: string;
  ideaId: string;
  stage: 'generating' | 'testing' | 'building' | 'reviewing';
  progress: number;       // 0-100
  message?: string;
}> {}

// 事件处理函数签名
type EventHandler<T extends BaseEvent = any> = (
  event: T,
  context: LambdaContext
) => Promise<void>;
```

### 3.3 事件处理器

```typescript
// serverless/handlers/event-processor.ts
import { DynamoDBStreamEvent, Context } from 'aws-lambda';

class EventProcessor {
  constructor(
    private eventBus: EventBridgeClient,
    private logger: Logger
  ) {}

  // 处理 SQS 事件
  async handleSQSEvent(event: SQSEvent, context: Context): Promise<SQSBatchResponse> {
    const results: SQSBatchItemFailure[] = [];

    for (const record of event.Records) {
      try {
        const event = JSON.parse(record.body) as BaseEvent;
        await this.processEvent(event);
      } catch (error) {
        this.logger.error('Failed to process record', { error, record });

        // 消息重试处理
        if (this.shouldRetry(record)) {
          results.push({ itemIdentifier: record.messageId });
        }
      }
    }

    return { batchItemFailures: results };
  }

  // 处理 DynamoDB Stream
  async handleDynamoDBStream(event: DynamoDBStreamEvent): Promise<void> {
    for (const record of event.Records) {
      if (record.eventName === 'INSERT') {
        const newImage = DynamoDB.unmarshall(record.dynamodb!.NewImage!);
        await this.handleEntityCreated(newImage);
      } else if (record.eventName === 'MODIFY') {
        const newImage = DynamoDB.unmarshall(record.dynamodb!.NewImage!);
        await this.handleEntityUpdated(newImage);
      } else if (record.eventName === 'REMOVE') {
        const oldImage = DynamoDB.unmarshall(record.dynamodb!.OldImage!);
        await this.handleEntityDeleted(oldImage);
      }
    }
  }

  // 发布事件到 EventBridge
  async publish<T>(event: Omit<BaseEvent<T>, 'id' | 'timestamp'>): Promise<void> {
    await this.eventBus.putEvents({
      Entries: [
        {
          EventBusName: process.env.EVENT_BUS_NAME,
          Source: event.source,
          DetailType: event.type,
          Detail: JSON.stringify({
            ...event,
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });
  }

  private async processEvent(event: BaseEvent): Promise<void> {
    this.logger.info('Processing event', { type: event.type, id: event.id });

    switch (event.type) {
      case 'idea.created':
        await this.handleIdeaCreated(event as IdeaCreatedEvent);
        break;
      case 'project.progress':
        await this.handleProjectProgress(event as ProjectProgressEvent);
        break;
      // ... 其他事件处理
    }
  }
}
```

---

## 4. 状态管理

### 4.1 DynamoDB 表设计

```yaml
# serverless/dynamodb/tables.yaml
Resources:
  # 想法表
  IdeasTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: ${self:provider.stage}-ideas
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
        - AttributeName: userId
          AttributeType: S
        - AttributeName: status
          AttributeType: S
        - AttributeName: createdAt
          AttributeType: S
        - AttributeName: GSI1PK
          AttributeType: S
        - AttributeName: GSI1SK
          AttributeType: S
      KeySchema:
        - AttributeName: id
          KeyType: HASH
      GlobalSecondaryIndexes:
        - IndexName: UserStatusIndex
          KeySchema:
            - AttributeName: userId
              KeyType: HASH
            - AttributeName: status
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
        - IndexName: GSI1
          KeySchema:
            - AttributeName: GSI1PK
              KeyType: HASH
            - AttributeName: GSI1SK
              KeyType: RANGE
          Projection:
            ProjectionType: KEYS_ONLY
      TimeToLiveSpecification:
        AttributeName: ttl
        Enabled: true
      StreamSpecification:
        StreamViewType: NEW_AND_OLD_IMAGES

  # 项目表
  ProjectsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: ${self:provider.stage}-projects
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
        - AttributeName: ideaId
          AttributeType: S
        - AttributeName: userId
          AttributeType: S
        - AttributeName: status
          AttributeType: S
      KeySchema:
        - AttributeName: id
          KeyType: HASH
      GlobalSecondaryIndexes:
        - IndexName: IdeaIndex
          KeySchema:
            - AttributeName: ideaId
              KeyType: HASH
          Projection:
            ProjectionType: ALL
        - IndexName: UserIndex
          KeySchema:
            - AttributeName: userId
              KeyType: HASH
            - AttributeName: status
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
```

### 4.2 状态机

```yaml
# serverless/step-functions/state-machine.yaml
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  ProjectGenerationStateMachine:
    Type: AWS::StepFunctions::StateMachine
    Properties:
      StateMachineName: ${self:provider.stage}-project-generation
      StateMachineType: EXPRESS
      DefinitionSubstitutions:
        IdeaTable: !Ref IdeasTable
        ProjectTable: !Ref ProjectsTable
        QueueArn: !GetAtt ProcessingQueue.Arn
      Definition:
        Comment: "Project generation workflow"
        StartAt: ValidateIdea
        States:
          ValidateIdea:
            Type: Task
            Resource: arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:${self:service}-${self:provider.stage}-validateIdea
            Next: CheckIdeaStatus

          CheckIdeaStatus:
            Type: Choice
            Choices:
              - Variable: $.status
                StringEquals: "approved"
                Next: CreateProject
              - Variable: $.status
                StringEquals: "needs_review"
                Next: NotifyReview
            Default: FailState

          CreateProject:
            Type: Task
            Resource: arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:${self:service}-${self:provider.stage}-createProject
            Next: GenerateCode

          GenerateCode:
            Type: Task
            Resource: ${_lambdaGenerateCode}
            Next: QualityCheck
            Retry:
              - ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException"]
                IntervalSeconds: 2
                MaxAttempts: 3
                BackoffRate: 2

          QualityCheck:
            Type: Task
            Resource: ${_lambdaQualityCheck}
            Next: PublishResult
            Retry:
              - ErrorEquals: ["Lambda.ServiceException"]
                IntervalSeconds: 5
                MaxAttempts: 2

          PublishResult:
            Type: Task
            Resource: ${_lambdaPublishResult}
            Next: CompleteState

          NotifyReview:
            Type: Task
            Resource: ${_lambdaNotifyReview}
            Next: WaitForReview

          WaitForReview:
            Type: Wait
            Seconds: 3600
            Next: CheckIdeaStatus

          FailState:
            Type: Fail
            Error: $.error
            Cause: $.cause

          CompleteState:
            Type: Succeed

Outputs:
  StateMachineArn:
    Value: !GetAtt ProjectGenerationStateMachine.Arn
```

---

## 5. 冷启动优化

### 5.1 预配置

```yaml
# serverless/provisioned-concurrency.yaml
Resources:
  # 为高频函数配置预配置并发
  ApiHandlerConcurrency:
    Type: AWS::Lambda::Version
    Properties:
      FunctionName: !Ref ApiHandler
      ProvisionedConcurrencyConfig:
        ProvisionedConcurrentExecutions: 10

  # 配置异步调用保留策略
  IdeaGeneratorEventConfig:
    Type: AWS::Lambda::EventInvokeConfig
    Properties:
      FunctionName: !Ref IdeaGenerator
      Qualifier: $LATEST
      MaximumEventAge: 21600  # 6 小时
      MaximumRetryAttempts: 2
```

### 5.2 依赖优化

```bash
# serverless/layers/dependencies/Dockerfile
FROM public.ecr.aws/lambda/nodejs:20

# 安装生产依赖
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 清理不必要的文件
RUN rm -rf node_modules/.cache
RUN find node_modules -type d -name "test" -exec rm -rf {} +
RUN find node_modules -type f -name "*.ts" -delete
RUN find node_modules -type f -name "*.map" -delete

CMD ["index.handler"]
```

### 5.3 初始化代码

```typescript
// serverless/handlers/with-warm-start.ts
// 冷启动优化 - 在处理函数外初始化连接池

// 全局连接 (函数实例级别)
let dbConnection: Database | null = null;
let redisClient: Redis | null = null;
let llmClient: LLMClient | null = null;

// 初始化函数
async function initialize(): Promise<void> {
  // 复用已有连接
  if (dbConnection) return;

  const connections = await Promise.all([
    // 数据库连接 - 使用连接池
    createDatabasePool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 10,  // 连接池大小
      idleTimeoutMillis: 30000,
    }),

    // Redis 连接
    new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: true,
    }),

    // LLM 客户端 (预热)
    new LLMClient({
      apiKey: process.env.LLM_API_KEY,
      model: 'gpt-4',
    }),
  ]);

  dbConnection = connections[0] as Database;
  redisClient = connections[1] as Redis;
  llmClient = connections[2] as LLMClient;

  await redisClient.connect();
}

// 处理函数
export const handler = async (event: any, context: Context) => {
  // 设置函数超时
  context.callbackWaitsForEmptyEventLoop = false;

  // 初始化连接
  await initialize();

  try {
    // 处理请求
    return await processRequest(event);
  } finally {
    // 不关闭连接，等待下次调用复用
  }
};
```

---

## 6. 成本优化

### 6.1 成本分析

```typescript
// serverless/cost/cost-calculator.ts
interface CostEstimate {
  monthlyCost: number;
  breakdown: {
    compute: number;
    requests: number;
    storage: number;
    dataTransfer: number;
  };
  recommendations: CostOptimization[];
}

class ServerlessCostCalculator {
  private pricing = {
    lambda: {
      request: 0.20 / 1000000,  // $0.20 per 1M requests
      duration: {
        '128MB': 0.0000066667,  // $0.0000066667 per 100ms
        '256MB': 0.0000133334,
        '512MB': 0.0000266667,
        '1024MB': 0.0000533333,
      },
    },
    dynamodb: {
      onDemand: {
        write: 1.25 / 1000000,  // $1.25 per 1M writes
        read: 0.25 / 1000000,   // $0.25 per 1M reads
      },
      storage: 0.25 / 1024,     // $0.25 per GB-month
    },
    s3: {
      storage: {
        standard: 0.023,         // $0.023 per GB
        intelligent: 0.023,      // $0.023 per GB
      },
      requests: {
        PUT: 0.005 / 1000,
        GET: 0.0004 / 1000,
      },
    },
  };

  estimateMonthlyCost(usage: ServerlessUsage): CostEstimate {
    const breakdown = {
      compute: this.calculateComputeCost(usage),
      requests: this.calculateRequestCost(usage),
      storage: this.calculateStorageCost(usage),
      dataTransfer: this.calculateDataTransferCost(usage),
    };

    const monthlyCost = Object.values(breakdown).reduce((a, b) => a + b, 0);

    return {
      monthlyCost,
      breakdown,
      recommendations: this.generateRecommendations(usage, breakdown),
    };
  }

  private calculateComputeCost(usage: ServerlessUsage): number {
    let total = 0;

    for (const fn of usage.functions) {
      const pricePerGbSecond = this.pricing.lambda.duration[`${fn.memoryMB}MB`];
      const gbSeconds = (fn.memoryMB / 1024) * fn.avgDurationMs / 1000 * fn.monthlyInvocations;
      const functionCost = gbSeconds * pricePerGbSecond;

      // 应用预配置折扣
      if (fn.provisionedConcurrency) {
        const reservedCost = (fn.memoryMB / 1024) * fn.provisionedConcurrency * 730 * pricePerGbSecond;
        const onDemandCost = functionCost - reservedCost;
        total += reservedCost + onDemandCost * 0.5; // 50% 折扣
      } else {
        total += functionCost;
      }
    }

    return total;
  }

  private generateRecommendations(
    usage: ServerlessUsage,
    breakdown: CostEstimate['breakdown']
  ): CostOptimization[] {
    const recommendations: CostOptimization[] = [];

    // 检查是否应该使用预配置
    if (breakdown.compute > 100) {
      recommendations.push({
        type: 'provisioned_concurrency',
        potentialSavings: breakdown.compute * 0.3,
        description: '使用预配置并发可节省 30% 成本',
        action: '为高频函数配置预配置并发',
      });
    }

    // 检查内存配置
    for (const fn of usage.functions) {
      const avgMemoryUsage = fn.avgMemoryUsedMB / fn.memoryMB;
      if (avgMemoryUsage < 0.5) {
        recommendations.push({
          type: 'memory_optimization',
          potentialSavings: breakdown.compute * 0.2,
          description: `函数 ${fn.name} 内存使用率仅 ${(avgMemoryUsage * 100).toFixed(0)}%`,
          action: `考虑降低 ${fn.name} 的内存配置`,
        });
      }
    }

    // 检查 DynamoDB 容量
    if (breakdown.storage > 50) {
      recommendations.push({
        type: 'dynamodb_optimization',
        potentialSavings: breakdown.storage * 0.4,
        description: 'DynamoDB 成本较高',
        action: '考虑使用 DynamoDB 自动扩展或转换为 S3',
      });
    }

    return recommendations;
  }
}
```

### 6.2 成本监控

```yaml
# serverless/monitoring/cost-dashboard.yaml
dashboard:
  title: "Serverless 成本监控"
  widgets:
    - type: "metric"
      title: "Lambda 成本趋势"
      stats:
        - Sum
      period: 86400
      metrics:
        - namespace: "AWS/Lambda"
          name: "Duration"
          dimensions:
            FunctionName: "*"
          statistic: Sum

    - type: "pie"
      title: "成本分布"
      metrics:
        - label: "Compute"
          value: 150.00
        - label: "Requests"
          value: 30.00
        - label: "Storage"
          value: 50.00
        - label: "Data Transfer"
          value: 20.00
```

---

## 7. 相关文档

- [事件驱动架构](./EVENT_DRIVEN_ARCHITECTURE.md)
- [批处理系统](./BATCH_PROCESSING.md)
- [成本优化](./COST_OPTIMIZATION.md)
- [监控与告警](./MONITORING_ALERTING.md)

---

**最后更新**: 2026-04-14
