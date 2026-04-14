# ProjectFactory 架构设计文档

## 1. 概述

ProjectFactory 是一个自主软件开发系统，能够持续生成多样化的软件项目构思，并将这些构思转化为功能完整的代码项目，然后迭代优化这些项目——所有过程都无需人工干预。

### 1.1 设计原则

- **模块化**: 各 Agent 职责单一，易于独立开发和测试
- **可扩展**: 支持新的 Agent 类型、项目类型和质量标准
- **可观测**: 完整的状态追踪和日志记录
- **可恢复**: 支持系统重启后从上次状态继续
- **质量优先**: 多层质量门禁确保产出质量

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Meta System (元系统)                              │
│                    OrchestratorAgent + Scheduler                         │
│                    状态管理 + 资源调度 + 协作编排                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ↓                           ↓                           ↓
┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
│   Agent Layer     │    │  Resource Layer  │    │  Knowledge Layer  │
│  (各专业 Agent)   │    │  (资源管理)       │    │  (知识沉淀)       │
└───────────────────┘    └───────────────────┘    └───────────────────┘
        │                           │                           │
        ├───────────────────────────┼───────────────────────────┤
        │                           │                           │
        ↓                           ↓                           ↓
┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
│  IdeaGenerator    │    │  Workspace Mgmt   │    │  Pattern Library  │
│  Architect        │    │  Git Manager     │    │  Best Practices   │
│  Coder            │    │  Build Executor  │    │  Failed Cases     │
│  Tester           │    │  Test Runner     │    │  Success Metrics  │
│  Reviewer         │    │  Cost Tracker     │    │                   │
│  Optimizer        │    │  Resource Pool   │    │                   │
└───────────────────┘    └───────────────────┘    └───────────────────┘
```

## 3. 核心流程

### 3.1 项目生成主流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        OrchestratorAgent                                │
│                        (状态机编排)                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    v
┌─────────────────────────────────────────────────────────────────────────┐
│                        IdeaGeneratorAgent                                │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                │
│  │   Planner    │ → │  Executor    │ → │   Critic     │                │
│  │  (策略规划)   │   │  (执行生成)   │   │  (评估优化)  │                │
│  └──────────────┘   └──────────────┘   └──────────────┘                │
│       ↓                  ↓                  ↓                           │
│  生成策略          生成多个Idea         评估并优化                         │
│                         ↓                                             │
│                    存储到 ideas 表                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    v
┌─────────────────────────────────────────────────────────────────────────┐
│                        ArchitectAgent                                   │
│  - 分析项目需求                                                          │
│  - 设计目录结构                                                          │
│  - 定义架构模式                                                          │
│  - 确定技术栈配置                                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    v
┌─────────────────────────────────────────────────────────────────────────┐
│                        CoderAgent                                       │
│  - 生成项目代码                                                          │
│  - 创建配置文件                                                          │
│  - 编写文档                                                              │
│  - 生成 README                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    v
┌─────────────────────────────────────────────────────────────────────────┐
│                        TesterAgent                                      │
│  - 生成测试用例                                                          │
│  - 执行测试                                                              │
│  - 分析测试结果                                                          │
│  - 计算覆盖率                                                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    v
┌─────────────────────────────────────────────────────────────────────────┐
│                        ReviewerAgent                                    │
│  - 静态代码分析                                                          │
│  - 安全检查                                                              │
│  - 性能评估                                                              │
│  - 生成质量评分                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    v
┌─────────────────────────────────────────────────────────────────────────┐
│                        Quality Gate                                      │
│  ✓ Test Coverage ≥ 80%                                                  │
│  ✓ Lint Errors = 0                                                       │
│  ✓ Build Success                                                         │
│  ✓ Quality Score ≥ 70                                                   │
└─────────────────────────────────────────────────────────────────────────┘
                    │               │
                    │               ↓
                    │         (未通过) → OptimizerAgent
                    │                       │
                    │                       ↓
                    │                  返回开发
                    │
                    ↓
               (通过)
                    │
                    v
┌─────────────────────────────────────────────────────────────────────────┐
│                        GitAgent                                         │
│  - 初始化 Git 仓库                                                      │
│  - 创建提交记录                                                          │
│  - 管理版本标签                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 迭代优化流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        OptimizerAgent                                   │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                │
│  │   Analyze    │ → │   Plan       │ → │  Execute     │                │
│  │  (问题分析)   │   │  (迭代计划)   │   │  (执行改进)   │                │
│  └──────────────┘   └──────────────┘   └──────────────┘                │
│       ↓                  ↓                  ↓                           │
│  识别改进点          制定迭代计划         执行代码修改                      │
│   - 性能瓶颈         - 功能增强          - 重新测试                         │
│   - 代码冗余         - Bug修复           - 质量评估                         │
│   - 安全漏洞         - 代码重构          - Git提交                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 4. 分层架构设计

### 4.1 表现层 (Presentation Layer)

```typescript
// backend/src/api/
├── routes/           // 路由定义
│   ├── ideas.ts      // Ideas 相关路由
│   ├── projects.ts   // Projects 相关路由
│   ├── status.ts     // 系统状态路由
│   └── health.ts     // 健康检查路由
├── controllers/      // 控制器
│   ├── idea.controller.ts
│   ├── project.controller.ts
│   └── status.controller.ts
├── middleware/       // 中间件
│   ├── auth.ts
│   ├── logging.ts
│   └── error.ts
└── server.ts         // Express 服务器入口
```

**职责**:
- 提供 HTTP API 接口
- 请求参数验证
- 响应格式化
- 错误处理

### 4.2 编排层 (Orchestration Layer)

```typescript
// backend/src/orchestration/
├── orchestrator/     // 核心编排器
│   ├── orchestrator.ts        // 主编排器
│   ├── state-machine.ts       // 状态机
│   └── workflow-builder.ts    // 工作流构建器
├── scheduler/        // 调度器
│   ├── scheduler.ts           // 主调度器
│   ├── task-queue.ts          // 任务队列
│   └── resource-manager.ts    // 资源管理器
└── langgraph/         // LangGraph 集成
    ├── graph-builder.ts
    └── state-management.ts
```

**职责**:
- Agent 协作编排
- 工作流状态管理
- 任务调度和分发
- 资源分配和管理

### 4.3 Agent 层 (Agent Layer)

```typescript
// backend/src/agents/
├── base/
│   ├── base-agent.ts           // Agent 基类
│   ├── agent-interface.ts      // Agent 接口
│   └── agent-factory.ts        // Agent 工厂
├── idea-generator/
│   ├── planner-agent.ts        // 策略规划 Agent
│   ├── executor-agent.ts       // 执行生成 Agent
│   └── critic-agent.ts         // 评估 Agent
├── architect/
│   └── architect-agent.ts
├── coder/
│   └── coder-agent.ts
├── tester/
│   └── tester-agent.ts
├── reviewer/
│   └── reviewer-agent.ts
├── optimizer/
│   └── optimizer-agent.ts
└── git/
    └── git-agent.ts
```

**职责**:
- 各专业领域的任务执行
- 使用 LangChain.js 与 LLM 交互
- 基于 LangChain 的 Chain/Agent 模式
- 任务结果验证

### 4.4 领域层 (Domain Layer)

```typescript
// backend/src/domain/
├── idea/
│   ├── schema.ts               // Idea 数据模型
│   ├── repository.ts           // Idea 数据访问
│   └── service.ts              // Idea 业务逻辑
├── project/
│   ├── schema.ts               // Project 数据模型
│   ├── repository.ts           // Project 数据访问
│   └── service.ts              // Project 业务逻辑
├── iteration/
│   ├── schema.ts               // Iteration 数据模型
│   ├── repository.ts           // Iteration 数据访问
│   └── service.ts              // Iteration 业务逻辑
├── quality/
│   ├── schema.ts               // Quality Metrics 数据模型
│   ├── calculator.ts           // 质量评分计算器
│   └── gate.ts                 // 质量门禁
└── common/
    ├── types.ts                // 通用类型定义
    └── constants.ts            // 常量定义
```

**职责**:
- 业务实体定义
- 业务逻辑封装
- 数据访问抽象

### 4.5 基础设施层 (infra Layer)

```typescript
// backend/src/infra/
├── database/
│   ├── connection.ts           // 数据库连接
│   └── migrations/             // 数据库迁移
├── workspace/
│   ├── manager.ts              // 工作区管理
│   ├── file-operations.ts      // 文件操作
│   └── template-loader.ts      // 模板加载
├── git/
│   ├── manager.ts              // Git 操作封装
│   └── commit-handler.ts       // 提交处理
├── build/
│   ├── executor.ts             // 构建执行
│   └── test-runner.ts          // 测试运行
├── llm/
│   ├── client.ts               // LLM 客户端
│   └── prompt-manager.ts       // Prompt 管理
└── storage/
    ├── local-storage.ts        // 本地存储
    └── object-storage.ts       // 对象存储（可选）
```

**职责**:
- 外部系统集成
- 基础功能封装
- 技术适配

### 4.6 工具层 (Utils Layer)

```typescript
// backend/src/utils/
├── logger.ts          // 日志工具
├── retry.ts           // 重试工具
├── prompts.ts         // Prompt 模板
├── validation.ts      // 验证工具
├── time.ts            // 时间工具
├── hash.ts            // 哈希工具
└── json.ts            // JSON 工具
```

### 4.7 配置层 (Config Layer)

```typescript
// backend/src/config/
├── project-factory.ts // 主配置
├── env.ts             // 环境变量
├── index.ts           // 配置导出
└── validation.ts      // 配置验证
```

## 5. 状态管理

### 5.1 项目状态机

```
┌──────────┐
│ pending  │ ──────────→ initializing
└──────────┘
    │
    ↓
┌──────────┐
│ queued   │ ──────────→ in_progress
└──────────┘
    │
    ↓
┌──────────┐
│ in_progress │
└──────────┘
    │
    ├─────────→ generating (代码生成)
    │            ↓
    │         testing (测试)
    │            ↓
    │         building (构建)
    │            ↓
    │         reviewing (审查)
    │
    ├─────────→ completed
    │
    └─────────→ failed
```

### 5.2 LangGraph 状态定义

```typescript
// backend/src/orchestration/langgraph/types.ts
export interface ProjectFactoryState {
  // 当前项目信息
  projectId?: string;
  idea?: Idea;
  project?: Project;

  // 执行状态
  currentAgent: string;
  stage: 'idea-generation' | 'architecture' | 'coding' | 'testing' | 'reviewing' | 'optimizing' | 'git' | 'done';
  step: number;
  totalSteps: number;

  // 中间结果
  architecture?: Architecture;
  generatedFiles?: GeneratedFile[];
  testResults?: TestResults;
  reviewResult?: ReviewResult;
  qualityMetrics?: QualityMetrics;

  // 迭代信息
  iterationCount: number;
  maxIterations: number;
  qualityScore: number;

  // 错误处理
  errors: Error[];
  retryCount: number;

  // 元数据
  metadata: Record<string, unknown>;
}
```

## 6. 数据模型

### 6.1 核心实体关系

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│     Idea     │──────→│   Project    │←──────│ Iterations   │
└──────────────┘       └──────────────┘       └──────────────┘
        │                       │
        │                       ↓
        │               ┌──────────────┐
        │               │QualityMetrics│
        │               └──────────────┘
        │
        └───────────────→┌──────────────┐
                        │ RuntimeState  │
                        └──────────────┘
```

### 6.2 数据表说明

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `ideas` | 存储生成的项目创意 | status, projectType, complexity |
| `projects` | 存储开发的项目 | status, qualityScore, testCoverage |
| `iterations` | 存储迭代记录 | type, qualityBefore, qualityAfter |
| `quality_metrics` | 存储质量指标 | codeComplexity, maintainabilityIndex |
| `runtime_state` | 存储运行时状态 | state, activeProjects |

## 7. 质量保证体系

### 7.1 多层验证机制

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        质量保证体系                                       │
├─────────────────────────────────────────────────────────────────────────┤
│  Layer 1: Idea Validation (创意验证)                                      │
│  - 独创性检查                                                             │
│  - 可行性评估                                                             │
│  - 复杂度验证                                                             │
├─────────────────────────────────────────────────────────────────────────┤
│  Layer 2: Code Generation Quality (生成质量)                              │
│  - 代码规范检查                                                           │
│  - 安全扫描                                                               │
│  - 文档完整性                                                             │
├─────────────────────────────────────────────────────────────────────────┤
│  Layer 3: Automated Testing (自动化测试)                                 │
│  - 单元测试覆盖                                                           │
│  - 集成测试                                                               │
│  - 边界条件测试                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│  Layer 4: Build Verification (构建验证)                                   │
│  - 编译/打包成功                                                          │
│  - 依赖解析正确                                                           │
│  - 启动测试通过                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│  Layer 5: Code Review (代码审查)                                         │
│  - 静态分析                                                               │
│  - 最佳实践检查                                                           │
│  - 性能评估                                                               │
├─────────────────────────────────────────────────────────────────────────┤
│  Layer 6: Quality Gate (质量门禁)                                        │
│  - Test Coverage ≥ 80%                                                  │
│  - Lint Errors = 0                                                       │
│  - Build Success                                                         │
│  - Quality Score ≥ 70                                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 质量评分算法

```typescript
// 质量评分 = 加权平均
qualityScore =
  codeQuality * 0.3 +
  testCoverage * 0.3 +
  documentationScore * 0.2 +
  securityScore * 0.1 +
  performanceScore * 0.1
```

## 8. 资源管理

### 8.1 资源限制

| 资源类型 | 限制 | 说明 |
|---------|------|------|
| 最大并发项目 | 5 | 同时开发的项目数量 |
| 每日最大成本 | $50 | LLM API 调用成本 |
| 最大重试次数 | 3 | 失败任务重试次数 |
| 请求超时 | 120s | LLM 请求超时 |
| 队列最大大小 | 100 | Idea 队列大小 |

### 8.2 资源监控

```typescript
// backend/src/infra/metrics/
export interface ResourceMetrics {
  // 项目统计
  totalIdeas: number;
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  failedProjects: number;

  // LLM 使用
  totalLLMCalls: number;
  totalTokens: number;
  totalCost: number;

  // 时间统计
  avgIdeaGenerationTime: number;
  avgProjectDevelopmentTime: number;
  avgIterationTime: number;

  // 质量统计
  avgQualityScore: number;
  avgTestCoverage: number;
}
```

## 9. 错误处理与恢复

### 9.1 错误分类

| 错误类型 | 处理策略 | 重试次数 |
|---------|---------|---------|
| 网络错误 | 自动重试 | 3 |
| LLM 超时 | 自动重试 | 3 |
| LLM 限流 | 指数退避 | 5 |
| 解析错误 | 记录并跳过 | 0 |
| 语法错误 | 请求修复 | 2 |
| 测试失败 | 进入优化流程 | - |

### 9.2 恢复机制

1. **状态持久化**: 所有状态保存在数据库
2. **检查点机制**: 关键节点保存检查点
3. **回滚支持**: 支持回滚到上一个检查点
4. **断点续传**: 系统重启后继续执行

## 10. 可观测性

### 10.1 日志级别

| 级别 | 用途 | 示例 |
|------|------|------|
| DEBUG | 详细调试信息 | Agent 内部状态 |
| INFO | 常规操作信息 | 项目生成完成 |
| WARN | 警告信息 | 质量分数偏低 |
| ERROR | 错误信息 | LLM 调用失败 |
| FATAL | 致命错误 | 数据库连接失败 |

### 10.2 关键指标

- **吞吐量**: 每天生成/完成的项目数
- **延迟**: 平均项目开发时间
- **成功率**: 项目完成率
- **质量**: 平均质量分数
- **成本**: 平均每项目成本

## 11. 扩展点

### 11.1 支持新的 Agent 类型

```typescript
// 实现 AgentInterface
interface AgentInterface {
  name: string;
  canHandle(task: Task): boolean;
  execute(task: Task): Promise<Result>;
}

// 在 AgentFactory 中注册
agentFactory.register(new CustomAgent());
```

### 11.2 支持新的项目类型

```typescript
// 添加新的项目类型到枚举
export const projectTypeSchema = z.enum([
  'web-app',
  'cli-tool',
  'library',
  'api-service',
  // 添加新类型
  'mobile-app',
  'desktop-app',
]);
```

### 11.3 支持新的质量标准

```typescript
// 在 QualityGate 中添加新标准
export const qualityGates = [
  new TestCoverageGate(80),
  new LintErrorGate(0),
  new BuildSuccessGate(),
  // 添加新标准
  new SecurityScoreGate(70),
];
```

## 12. 技术栈说明

| 组件 | 选型 | 理由 |
|------|------|------|
| 后端语言 | TypeScript | 类型安全，Node.js 生态 |
| Web 框架 | Express | 成熟稳定，生态丰富 |
| Agent 框架 | LangChain.js + LangGraph | 状态机编排，易扩展，成熟的 Agent 模式 |
| ORM | Drizzle ORM | 类型安全，性能优秀 |
| 数据库 | SQLite (better-sqlite3) | 轻量级，无需额外部署 |
| 验证 | Zod | 类型推导，易于使用 |
| 测试 | Vitest | 快速，与 TypeScript 配合好 |

### 12.1 LangChain.js 使用说明

所有 Agent 基于 **LangChain.js** 的以下核心组件实现：

#### 12.1.1 Chat Models

```typescript
import { ChatOpenAI } from '@langchain/openai';

const llm = new ChatOpenAI({
  modelName: 'gpt-4',
  temperature: 0.7,
  maxTokens: 4096,
});
```

#### 12.1.2 Structured Outputs

使用 `withStructuredOutput` 确保输出符合预定义 schema：

```typescript
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';

const ideaSchema = z.object({
  title: z.string(),
  description: z.string(),
  features: z.array(z.string()),
});

const llmWithSchema = llm.withStructuredOutput(ideaSchema);
const result = await llmWithSchema.invoke(prompt);
```

#### 12.1.3 Chains

使用 LangChain 的 Chain 模式编排 Agent：

```typescript
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

const plannerChain = PromptTemplate.fromTemplate(plannerPrompt)
  .pipe(llm)
  .pipe(new StringOutputParser());
```

#### 12.1.4 LangGraph 状态机

使用 LangGraph 构建复杂工作流：

```typescript
import { StateGraph } from '@langchain/langgraph';

const graph = new StateGraph<ProjectFactoryState>({
  channels: {
    projectId: null,
    idea: null,
    // ...
  },
});

graph.addNode('idea-generator', ideaGeneratorNode);
graph.addEdge('idea-generator', 'architect');
// ...
```

## 13. 实现路径

### 阶段 1: 基础设施 (当前进行中)
- [x] 项目结构搭建
- [x] 数据库设计
- [x] 配置系统
- [ ] 基础 Agent 框架
- [ ] LangGraph 集成
- [ ] API 路由

### 阶段 2: 核心流程
- [ ] IdeaGeneratorAgent (Planner + Executor + Critic)
- [ ] ArchitectAgent
- [ ] CoderAgent
- [ ] TesterAgent
- [ ] ReviewerAgent
- [ ] GitAgent

### 阶段 3: 质量与优化
- [ ] 质量门禁系统
- [ ] OptimizerAgent
- [ ] 迭代流程

### 阶段 4: 高级特性
- [ ] 多并发项目支持
- [ ] 智能调度算法
- [ ] 知识沉淀与复用
- [ ] 成本优化

## 14. 风险与应对

| 风险 | 影响 | 应对策略 |
|------|------|---------|
| LLM 质量不稳定 | 项目质量下降 | 多轮审查 + 人工抽检 |
| 成本超支 | 预算控制失败 | 成本监控 + 阈值告警 |
| 生成重复项目 | 资源浪费 | 创意去重 + 多样性控制 |
| 安全漏洞 | 安全风险 | 自动安全扫描 + 沙箱隔离 |
| 系统复杂度过高 | 维护困难 | 模块化设计 + 完整文档 |

## 15. 未来展望

### 15.1 短期目标
- 实现完整的端到端流程
- 支持多种项目类型
- 建立稳定的质量标准

### 15.2 中期目标
- 实现跨项目知识复用
- 建立自动化的架构演进
- 支持更复杂的项目类型

### 15.3 长期愿景
- 自我改进系统（元学习）
- 跨领域知识迁移
- 自主发现新需求
