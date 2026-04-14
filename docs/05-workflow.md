# 工作流设计

## 1. 核心工作流

### 1.1 项目生成主流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        1. 项目初始化                              │
│  ┌─────────────┐                                                   │
│  │ 创建项目    │ → 生成项目ID → 初始化状态 → 创建目录结构          │
│  └─────────────┘                                                   │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                        2. 需求分析阶段                            │
│  ┌─────────────┐                                                   │
│  │ Requirement  │ → 分析需求 → 生成PRD → 输出架构需求               │
│  │   Agent     │                                                   │
│  └─────────────┘                                                   │
└─────────────────────────────────────────────────────────────────┘
                          ↓
                    [验证需求完整性]
                          │
              ┌───────────┴───────────┐
              ↓                       ↓
          [完整]                   [不完整]
              │                       │
              ↓                   重新分析
┌─────────────────────────────────────────────────────────────────┐
│                        3. 架构设计阶段                            │
│  ┌─────────────┐                                                   │
│  │ Architecture │ → 技术选型 → 系统设计 → API设计 → 数据库设计      │
│  │   Agent     │                                                   │
│  └─────────────┘                                                   │
└─────────────────────────────────────────────────────────────────┘
                          ↓
                    [验证架构合理性]
                          │
              ┌───────────┴───────────┐
              ↓                       ↓
          [合理]                   [不合理]
              │                   重新设计
              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        4. 代码生成阶段                            │
│  ┌─────────────┐   ┌─────────────┐                               │
│  │ Development │ → │ 前端代码生成 │                               │
│  │   Agent     │   │ 后端代码生成 │                               │
│  │             │   │ 配置文件生成 │                               │
│  └─────────────┘   └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                          ↓
                    [静态代码检查]
                          │
              ┌───────────┴───────────┐
              ↓                       ↓
          [通过]                   [未通过]
              │                     修正代码
              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        5. 质量验证阶段                            │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐             │
│  │ Quality     │ → │ 单元测试     │ → │ 集成测试     │             │
│  │   Agent     │   │ 安全扫描     │   │ 覆盖率分析   │             │
│  └─────────────┘   └─────────────┘   └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                          ↓
              ┌───────────────────────┐
              │     质量分数 ≥ 80%?   │
              └───────────┬───────────┘
                          │
              ┌───────────┴───────────┐
              ↓ [是]               [否] ↓
              │                       │
              ↓                       ↓
┌─────────────────────┐   ┌─────────────────────┐
│    6. 部署阶段       │   │  反馈给开发Agent重新   │
│  ┌─────────────┐     │   │  生成（最多3次）       │
│  │ Deployment  │ → 构建 → 部署 → 健康检查        │
│  │   Agent     │     │                         │
│  └─────────────┘     │                         │
└─────────────────────┘   └─────────────────────┘
          ↓
      [部署成功]
          │
          ↓
┌─────────────────────┐
│    7. 进化阶段       │
│  ┌─────────────┐     │
│  │ Evolution   │ → 收集反馈 → 分析数据 → 更新知识库 → 生成优化建议 │
│  │   Agent     │     │
│  └─────────────┘     │
└─────────────────────┘
```

### 1.2 状态机模型

```typescript
// workflow/state-machine.ts
export interface ProjectStateMachine {
  id: string;
  state: ProjectState;
  transitions: StateTransition[];
}

export type ProjectState =
  | 'idle'
  | 'requirement-analyzing'
  | 'architecture-designing'
  | 'code-generating'
  | 'quality-validating'
  | 'deploying'
  | 'completed'
  | 'failed';

export interface StateTransition {
  from: ProjectState;
  to: ProjectState;
  trigger: string;
  action: string;
}

// 状态转换规则
export const stateTransitions: StateTransition[] = [
  { from: 'idle', to: 'requirement-analyzing', trigger: 'start', action: 'startGeneration' },
  { from: 'requirement-analyzing', to: 'architecture-designing', trigger: 'complete', action: 'generateArchitecture' },
  { from: 'requirement-analyzing', to: 'failed', trigger: 'error', action: 'handleError' },
  { from: 'architecture-designing', to: 'code-generating', trigger: 'complete', action: 'generateCode' },
  { from: 'architecture-designing', to: 'failed', trigger: 'error', action: 'handleError' },
  { from: 'code-generating', to: 'quality-validating', trigger: 'complete', action: 'validateQuality' },
  { from: 'code-generating', to: 'failed', trigger: 'error', action: 'handleError' },
  { from: 'quality-validating', to: 'deploying', trigger: 'pass', action: 'deploy' },
  { from: 'quality-validating', to: 'code-generating', trigger: 'retry', action: 'regenerateCode' },
  { from: 'quality-validating', to: 'failed', trigger: 'max-retries', action: 'markAsFailed' },
  { from: 'deploying', to: 'completed', trigger: 'success', action: 'finalizeProject' },
  { from: 'deploying', to: 'failed', trigger: 'error', action: 'handleError' },
  { from: 'failed', to: 'idle', trigger: 'retry', action: 'restartGeneration' },
];
```

## 2. 子工作流

### 2.1 需求分析工作流

```
┌─────────────────────────────────────────────────────────────────┐
│                      需求分析工作流                                │
└─────────────────────────────────────────────────────────────────┘

1. 需求接收
   ├─ 解析用户输入
   ├─ 识别项目类型
   └─ 提取关键信息

2. 需求补全
   ├─ 查询知识库获取类似项目
   ├─ 补充缺失的需求细节
   └─ 生成需求问题列表

3. 交互确认（如需要）
   ├─ 向用户提问
   ├─ 收集用户回答
   └─ 更新需求文档

4. PRD生成
   ├─ 生成功能列表
   ├─ 定义验收标准
   ├─ 识别技术需求
   └─ 识别风险和假设

5. 输出验证
   ├─ 检查PRD完整性
   ├─ 验证技术可行性
   └─ 确认需求清晰度
```

### 2.2 架构设计工作流

```
┌─────────────────────────────────────────────────────────────────┐
│                      架构设计工作流                                │
└─────────────────────────────────────────────────────────────────┘

1. 技术选型
   ├─ 分析需求约束
   ├─ 查询知识库获取最佳实践
   ├─ 选择前端技术栈
   ├─ 选择后端技术栈
   └─ 选择数据库方案

2. 系统设计
   ├─ 设计系统架构
   ├─ 定义模块边界
   ├─ 设计数据流
   └─ 设计错误处理

3. API设计
   ├─ 设计RESTful端点
   ├─ 定义请求/响应Schema
   ├─ 设计认证方案
   └─ 定义错误码

4. 数据库设计
   ├─ 设计表结构
   ├─ 定义索引策略
   ├─ 设计关系约束
   └─ 规划数据迁移

5. 目录结构设计
   ├─ 设计前端目录
   ├─ 设计后端目录
   └─ 规划配置文件
```

### 2.3 代码生成工作流

```
┌─────────────────────────────────────────────────────────────────┐
│                      代码生成工作流                                │
└─────────────────────────────────────────────────────────────────┘

1. 前端代码生成
   ├─ 组件生成
   │  ├─ 页面组件
   │  ├─ 业务组件
   │  ├─ 通用组件
   │  └─ 布局组件
   ├─ 状态管理
   │  ├─ Store定义
   │  ├─ Actions
   │  └─ Selectors
   ├─ API服务
   │  ├─ 服务定义
   │  └─ 类型定义
   └─ 路由配置

2. 后端代码生成
   ├─ API路由
   │  ├─ 路由定义
   │  ├─ 中间件
   │  └─ 请求处理
   ├─ 业务逻辑
   │  ├─ 服务层
   │  ├─ 数据访问层
   │  └─ 数据验证
   ├─ 数据库
   │  ├─ Model定义
   │  └─ 迁移脚本
   └─ 配置文件

3. 配置生成
   ├─ 构建配置
   ├─ 环境配置
   ├─ Docker配置
   └─ 部署配置

4. 文档生成
   ├─ README
   ├─ API文档
   └─ 部署文档
```

### 2.4 质量验证工作流

```
┌─────────────────────────────────────────────────────────────────┐
│                      质量验证工作流                                │
└─────────────────────────────────────────────────────────────────┘

1. 静态代码分析
   ├─ TypeScript类型检查
   ├─ ESLint规则检查
   ├─ 代码复杂度分析
   ├─ 代码重复度检查
   └─ 生成分析报告

2. 安全扫描
   ├─ 依赖漏洞扫描
   ├─ 代码安全检查
   ├─ 密钥泄露检测
   └─ 生成安全报告

3. 测试生成
   ├─ 单元测试生成
   │  ├─ 组件测试
   │  ├─ 服务测试
   │  └─ 工具函数测试
   ├─ 集成测试生成
   └─ E2E测试生成

4. 测试执行
   ├─ 运行单元测试
   ├─ 运行集成测试
   ├─ 代码覆盖率分析
   └─ 生成测试报告

5. 质量评分
   ├─ 静态分析权重: 30%
   ├─ 安全扫描权重: 20%
   └─ 测试覆盖率权重: 50%

6. 决策
   ├─ 分数 ≥ 80%: 通过
   ├─ 分数 < 80%: 反馈重新生成
   └─ 最多重试3次
```

### 2.5 部署工作流

```
┌─────────────────────────────────────────────────────────────────┐
│                       部署工作流                                  │
└─────────────────────────────────────────────────────────────────┘

1. 构建准备
   ├─ 安装依赖
   ├─ 环境变量配置
   └─ 构建脚本生成

2. 前端构建
   ├─ TypeScript编译
   ├─ 资源打包
   ├─ 代码压缩
   └─ 生成构建产物

3. 后端构建
   ├─ TypeScript编译
   ├─ 依赖打包
   └─ 生成可执行文件

4. Docker镜像构建
   ├─ 前端镜像
   ├─ 后端镜像
   ├─ 数据库镜像
   └─ Compose文件生成

5. 部署执行
   ├─ 停止旧版本（如存在）
   ├─ 启动新容器
   ├─ 健康检查
   └─ 验证部署

6. 部署后验证
   ├─ API端点检查
   ├─ 前端页面检查
   ├─ 功能验证
   └─ 性能基准测试
```

### 2.6 进化工作流

```
┌─────────────────────────────────────────────────────────────────┐
│                       进化工作流                                  │
└─────────────────────────────────────────────────────────────────┘

1. 数据收集
   ├─ 用户反馈收集
   ├─ 错误日志收集
   ├─ 性能指标收集
   ├─ 使用数据收集
   └─ 代码质量指标收集

2. 数据分析
   ├─ 反馈分析
   │  ├─ 主题识别
   │  ├─ 情感分析
   │  └─ 优先级排序
   ├─ 错误分析
   │  ├─ 错误分类
   │  ├─ 根因分析
   │  └─ 频率统计
   ├─ 性能分析
   │  ├─ 瓶颈识别
   │  ├─ 优化机会
   │  └─ 对比分析
   └─ 趋势分析

3. 知识提取
   ├─ 成功模式提取
   ├─ 失败案例提取
   ├─ 最佳实践提取
   └─ 反模式识别

4. 知识库更新
   ├─ 验证新知识
   ├─ 更新现有知识
   ├─ 标记过时知识
   └─ 生成嵌入向量

5. 优化建议生成
   ├─ 代码优化建议
   ├─ 架构改进建议
   ├─ 测试策略建议
   └─ 文档完善建议

6. 自我改进
   ├─ Prompt优化
   ├─ Agent能力评估
   ├─ 工作流优化
   └─ 效率提升
```

## 3. 事件驱动工作流

### 3.1 事件定义

```typescript
// workflow/events.ts
export type EventType =
  | 'project.created'
  | 'project.started'
  | 'project.completed'
  | 'project.failed'
  | 'phase.started'
  | 'phase.completed'
  | 'phase.failed'
  | 'agent.started'
  | 'agent.completed'
  | 'agent.failed'
  | 'code.generated'
  | 'quality.checked'
  | 'deployment.started'
  | 'deployment.completed'
  | 'deployment.failed'
  | 'feedback.received';

export interface WorkflowEvent {
  type: EventType;
  projectId: string;
  timestamp: Date;
  correlationId: string;
  data?: Record<string, unknown>;
}
```

### 3.2 事件处理流程

```
┌─────────────┐
│   Event     │
│  Emitter    │
└──────┬──────┘
       │ emit()
       ↓
┌─────────────────────────────────────────────────────────┐
│                   Event Bus                            │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                │
│  │ Queue   │→ │ Router  │→ │ Handler │                │
│  └─────────┘  └─────────┘  └─────────┘                │
└─────────────────────────────────────────────────────────┘
       │                           │
       │                           ↓
       │                   ┌───────────────┐
       │                   │  Event       │
       │                   │  Handlers     │
       │                   │  ┌───────────┐│
       │                   │  │ DB Update ││
       │                   │  └───────────┘│
       │                   │  ┌───────────┐│
       │                   │  │ Notifier   ││
       │                   │  └───────────┘│
       │                   │  ┌───────────┐│
       │                   │  │ Logger     ││
       │                   │  └───────────┘│
       │                   └───────────────┘
       │                           │
       ↓                           ↓
┌─────────────┐           ┌─────────────┐
│ Subscribers │           │   Actions   │
└─────────────┘           └─────────────┘
```

### 3.3 订阅者定义

```typescript
// workflow/subscribers.ts
export const eventSubscribers: Record<EventType, EventHandler[]> = {
  'project.created': [
    db.project.create,
    orchestrator.initialize,
    monitoring.track,
  ],
  'project.started': [
    db.project.updateStatus,
    queue.job.start,
    monitoring.track,
  ],
  'phase.started': [
    db.phase.create,
    websocket.notify,
    monitoring.track,
  ],
  'phase.completed': [
    db.phase.update,
    orchestrator.nextPhase,
    websocket.notify,
  ],
  'phase.failed': [
    db.phase.update,
    orchestrator.handleError,
    websocket.notify,
    alert.trigger,
  ],
  'quality.checked': [
    db.qualityReport.save,
    orchestrator.decideNextAction,
  ],
  'deployment.completed': [
    db.deployment.save,
    evolution.start,
  ],
  'feedback.received': [
    db.feedback.save,
    evolution.process,
  ],
};
```

## 4. 错误处理工作流

### 4.1 错误分类

```typescript
export enum ErrorType {
  VALIDATION_ERROR = 'validation_error',      // 验证错误
  LLM_ERROR = 'llm_error',                    // LLM调用错误
  CODE_GENERATION_ERROR = 'code_gen_error',   // 代码生成错误
  QUALITY_ERROR = 'quality_error',            // 质量检查失败
  DEPLOYMENT_ERROR = 'deployment_error',      // 部署错误
  SYSTEM_ERROR = 'system_error',              // 系统错误
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface WorkflowError {
  type: ErrorType;
  severity: ErrorSeverity;
  phase: string;
  message: string;
  details?: Record<string, unknown>;
  recoverable: boolean;
  retryStrategy?: 'immediate' | 'delayed' | 'manual';
  maxRetries?: number;
}
```

### 4.2 错误处理流程

```
┌─────────────┐
│    Error    │
│  Detected   │
└──────┬──────┘
       │
       ↓
┌─────────────────────────────────────┐
│      Error Classification           │
│  ┌─────────┐  ┌─────────┐           │
│  │ Type    │  │Severity │           │
│  └─────────┘  └─────────┘           │
└─────────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────┐
│      Recoverability Check            │
└─────────────────────────────────────┘
       │
       ├─→ Recoverable
       │       │
       │       ↓
       │  ┌─────────────────┐
       │  │  Retry Strategy  │
       │  └─────────────────┘
       │       │
       │       ├─→ Immediate (retry now)
       │       ├─→ Delayed (retry after delay)
       │       └─→ Manual (wait for user)
       │
       └─→ Non-Recoverable
               │
               ↓
         ┌─────────────┐
         │  Notify     │
         │  User       │
         └─────────────┘
```

### 4.3 重试策略

```typescript
export interface RetryStrategy {
  type: 'immediate' | 'delayed' | 'exponential' | 'manual';
  maxAttempts: number;
  delay?: number;           // 固定延迟(ms)
  baseDelay?: number;        // 指数退避基数(ms)
  maxDelay?: number;        // 最大延迟(ms)
  backoffFactor?: number;   // 退避因子
}

export const defaultRetryStrategies: Record<ErrorType, RetryStrategy> = {
  [ErrorType.VALIDATION_ERROR]: {
    type: 'manual',
    maxAttempts: 1,
  },
  [ErrorType.LLM_ERROR]: {
    type: 'exponential',
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
  },
  [ErrorType.CODE_GENERATION_ERROR]: {
    type: 'delayed',
    maxAttempts: 3,
    delay: 5000,
  },
  [ErrorType.QUALITY_ERROR]: {
    type: 'delayed',
    maxAttempts: 3,
    delay: 10000,
  },
  [ErrorType.DEPLOYMENT_ERROR]: {
    type: 'manual',
    maxAttempts: 1,
  },
  [ErrorType.SYSTEM_ERROR]: {
    type: 'immediate',
    maxAttempts: 3,
  },
};
```

## 5. 性能优化工作流

### 5.1 缓存策略

```
┌─────────────────────────────────────────────────────────────────┐
│                      缓存工作流                                   │
└─────────────────────────────────────────────────────────────────┘

1. LLM响应缓存
   ├─ 生成Prompt Hash
   ├─ 检查缓存
   ├─ 命中: 返回缓存
   └─ 未命中: 调用LLM → 缓存结果

2. 知识检索缓存
   ├─ 生成查询Hash
   ├─ 检查缓存
   ├─ 命中: 返回缓存
   └─ 未命中: 查询SQLite → 缓存结果

3. 代码模板缓存
   ├─ 启动时加载到内存
   ├─ 定期刷新
   └─ LRU淘汰策略

4. 项目状态缓存
   ├─ 定期同步到DB
   ├─ 读写分离
   └─ 过期自动刷新
```

### 5.2 并发控制

```typescript
export interface ConcurrencyConfig {
  maxConcurrentProjects: number;
  maxConcurrentLLMCalls: number;
  maxConcurrentGenerations: number;
  agentConcurrency: {
    [agentName: string]: {
      maxConcurrent: number;
      queueSize: number;
    };
  };
}

export const defaultConcurrencyConfig: ConcurrencyConfig = {
  maxConcurrentProjects: 5,
  maxConcurrentLLMCalls: 10,
  maxConcurrentGenerations: 3,
  agentConcurrency: {
    RequirementAgent: { maxConcurrent: 3, queueSize: 10 },
    ArchitectureAgent: { maxConcurrent: 3, queueSize: 10 },
    DevelopmentAgent: { maxConcurrent: 2, queueSize: 5 },
    QualityAgent: { maxConcurrent: 5, queueSize: 10 },
    DeploymentAgent: { maxConcurrent: 2, queueSize: 5 },
  },
};
```

---

**版本**: 0.1.0
**更新日期**: 2026-04-14
**状态**: 设计阶段
