# ProjectFactory 目录结构说明

```
ProjectFactory/
├── README.md                    # 项目说明文档
├── think.md                     # 设计思考文档
│
├── backend/                     # 后端服务
│   ├── package.json             # 项目依赖配置
│   ├── tsconfig.json            # TypeScript 配置
│   ├── drizzle.config.ts        # Drizzle ORM 配置
│   ├── .env.example             # 环境变量示例
│   │
│   ├── docs/                    # 文档目录
│   │   ├── ARCHITECTURE.md      # 架构设计文档
│   │   ├── AGENTS.md            # Agent 设计文档
│   │   ├── DIRECTORY.md        # 目录结构说明（本文件）
│   │   ├── API.md               # API 文档
│   │   └── DEPLOYMENT.md        # 部署文档
│   │
│   ├── src/                     # 源代码目录
│   │   │
│   │   ├── main.ts              # 应用入口
│   │   │
│   │   ├── api/                 # API 层
│   │   │   ├── server.ts        # Express 服务器
│   │   │   ├── routes/          # 路由定义
│   │   │   │   ├── ideas.ts     # Ideas 路由
│   │   │   │   ├── projects.ts  # Projects 路由
│   │   │   │   ├── status.ts    # 状态路由
│   │   │   │   └── health.ts    # 健康检查路由
│   │   │   ├── controllers/     # 控制器
│   │   │   │   ├── idea.controller.ts
│   │   │   │   ├── project.controller.ts
│   │   │   │   └── status.controller.ts
│   │   │   ├── middleware/      # 中间件
│   │   │   │   ├── auth.ts      # 认证中间件
│   │   │   │   ├── logging.ts   # 日志中间件
│   │   │   │   ├── error.ts     # 错误处理中间件
│   │   │   │   └── validation.ts # 请求验证中间件
│   │   │   └── dto/             # 数据传输对象
│   │   │       ├── idea.dto.ts
│   │   │       └── project.dto.ts
│   │   │
│   │   ├── orchestration/       # 编排层
│   │   │   ├── orchestrator/    # 核心编排器
│   │   │   │   ├── orchestrator.ts       # 主编排器
│   │   │   │   ├── state-machine.ts      # 状态机
│   │   │   │   └── workflow-builder.ts    # 工作流构建器
│   │   │   ├── scheduler/       # 调度器
│   │   │   │   ├── scheduler.ts          # 主调度器
│   │   │   │   ├── task-queue.ts         # 任务队列
│   │   │   │   └── resource-manager.ts   # 资源管理器
│   │   │   └── langgraph/       # LangGraph 集成
│   │   │       ├── graph-builder.ts      # 图构建器
│   │   │       ├── state-management.ts    # 状态管理
│   │   │       ├── project-graph.ts       # 项目图
│   │   │       └── nodes.ts               # 节点定义
│   │   │
│   │   ├── agents/              # Agent 层
│   │   │   ├── base/            # Agent 基础
│   │   │   │   ├── agent-interface.ts     # Agent 接口
│   │   │   │   ├── base-agent.ts         # Agent 基类
│   │   │   │   ├── agent-factory.ts      # Agent 工厂
│   │   │   │   └── types.ts              # Agent 类型定义
│   │   │   ├── idea-generator/   # 创意生成 Agent
│   │   │   │   ├── planner-agent.ts      # 策略规划
│   │   │   │   ├── executor-agent.ts     # 执行生成
│   │   │   │   └── critic-agent.ts       # 评估优化
│   │   │   ├── architect/       # 架构设计 Agent
│   │   │   │   └── architect-agent.ts
│   │   │   ├── coder/           # 代码生成 Agent
│   │   │   │   └── coder-agent.ts
│   │   │   ├── tester/          # 测试 Agent
│   │   │   │   └── tester-agent.ts
│   │   │   ├── reviewer/        # 代码审查 Agent
│   │   │   │   └── reviewer-agent.ts
│   │   │   ├── optimizer/       # 优化 Agent
│   │   │   │   └── optimizer-agent.ts
│   │   │   └── git/             # Git 操作 Agent
│   │   │       └── git-agent.ts
│   │   │
│   │   ├── domain/              # 领域层
│   │   │   ├── idea/            # Idea 领域
│   │   │   │   ├── schema.ts            # 数据模型
│   │   │   │   ├── repository.ts        # 数据访问
│   │   │   │   ├── service.ts           # 业务逻辑
│   │   │   │   └── persistence.ts       # 持久化实现
│   │   │   ├── project/         # Project 领域
│   │   │   │   ├── schema.ts
│   │   │   │   ├── repository.ts
│   │   │   │   └── service.ts
│   │   │   ├── iteration/       # Iteration 领域
│   │   │   │   ├── schema.ts
│   │   │   │   ├── repository.ts
│   │   │   │   └── service.ts
│   │   │   ├── quality/         # Quality 领域
│   │   │   │   ├── schema.ts
│   │   │   │   ├── calculator.ts        # 质量计算
│   │   │   │   └── gate.ts              # 质量门禁
│   │   │   └── common/          # 通用领域
│   │   │       ├── types.ts             # 类型定义
│   │   │       └── constants.ts          # 常量定义
│   │   │
│   │   ├── infra/      # 基础设施层
│   │   │   ├── database/        # 数据库
│   │   │   │   ├── connection.ts         # 数据库连接
│   │   │   │   └── migrations/           # 数据库迁移
│   │   │   ├── workspace/       # 工作区管理
│   │   │   │   ├── manager.ts            # 工作区管理器
│   │   │   │   ├── file-operations.ts    # 文件操作
│   │   │   │   └── template-loader.ts    # 模板加载器
│   │   │   ├── git/             # Git 操作
│   │   │   │   ├── manager.ts            # Git 管理器
│   │   │   │   └── commit-handler.ts     # 提交处理
│   │   │   ├── build/           # 构建执行
│   │   │   │   ├── executor.ts           # 构建执行器
│   │   │   │   ├── test-runner.ts        # 测试运行器
│   │   │   │   └── linter.ts             # 代码检查
│   │   │   ├── llm/             # LLM 集成
│   │   │   │   ├── client.ts             # LLM 客户端
│   │   │   │   ├── prompt-manager.ts     # Prompt 管理器
│   │   │   │   └── cost-tracker.ts       # 成本追踪
│   │   │   └── storage/         # 存储抽象
│   │   │       ├── local-storage.ts      # 本地存储
│   │   │       └── object-storage.ts     # 对象存储
│   │   │
│   │   ├── config/              # 配置层
│   │   │   ├── project-factory.ts         # 主配置
│   │   │   ├── env.ts                     # 环境变量
│   │   │   ├── index.ts                   # 配置导出
│   │   │   └── validation.ts              # 配置验证
│   │   │
│   │   └── utils/               # 工具层
│   │       ├── logger.ts        # 日志工具
│   │       ├── retry.ts         # 重试工具
│   │       ├── prompts.ts       # Prompt 模板
│   │       ├── validation.ts    # 验证工具
│   │       ├── time.ts          # 时间工具
│   │       ├── hash.ts          # 哈希工具
│   │       ├── json.ts          # JSON 工具
│   │       └── errors.ts        # 错误类型
│   │
│   ├── drizzle/                 # Drizzle ORM 配置
│   │   ├── config.ts            # 配置文件
│   │   └── schema.ts            # 数据库表定义
│   │
│   ├── tests/                   # 测试目录
│   │   ├── unit/                # 单元测试
│   │   │   ├── agents/          # Agent 测试
│   │   │   ├── domain/          # 领域测试
│   │   │   └── utils/           # 工具测试
│   │   ├── integration/         # 集成测试
│   │   │   ├── api/             # API 测试
│   │   │   └── orchestration/   # 编排测试
│   │   └── e2e/                 # 端到端测试
│   │       └── workflow/        # 工作流测试
│   │
│   ├── data/                    # 数据目录（.gitignore）
│   │   └── project-factory.db   # SQLite 数据库
│   │
│   └── dist/                    # 编译输出目录（.gitignore）
│
├── projects/                    # 生成的项目目录
│   ├── active/                  # 活跃项目（.gitignore）
│   ├── completed/              # 已完成项目（.gitignore）
│   └── archived/               # 归档项目（.gitignore）
│
└── templates/                  # 项目模板
    ├── web-app/               # Web 应用模板
    ├── cli-tool/              # CLI 工具模板
    ├── library/               # 库模板
    └── api-service/           # API 服务模板
```

## 目录说明

### 根目录

| 目录/文件 | 说明 |
|-----------|------|
| `README.md` | 项目介绍和快速开始指南 |
| `think.md` | 设计思考文档，记录系统的设计理念和实现思路 |

### backend/

后端服务目录，包含所有服务器端代码。

#### src/main.ts

应用入口文件，负责：
- 加载配置
- 初始化数据库连接
- 初始化 Agents
- 启动 Express 服务器
- 启动调度器

#### src/api/

API 层，处理 HTTP 请求和响应。

- `server.ts`: Express 服务器设置
- `routes/`: 定义 API 端点路由
- `controllers/`: 业务逻辑控制
- `middleware/`: 中间件（认证、日志、错误处理）
- `dto/`: 数据传输对象定义

#### src/orchestration/

编排层，负责 Agent 协调和任务调度。

- `orchestrator/`: 核心编排器
- `scheduler/`: 任务调度和资源管理
- `langgraph/`: LangGraph 状态机集成

#### src/agents/

Agent 层，包含所有专业 Agent。

- `base/`: Agent 基础类和接口
- `idea-generator/`: 创意生成（三段式：Planner → Executor → Critic）
- `architect/`: 架构设计
- `coder/`: 代码生成
- `tester/`: 测试生成和执行
- `reviewer/`: 代码审查
- `optimizer/`: 项目优化
- `git/`: Git 版本控制

#### src/domain/

领域层，定义业务实体和业务逻辑。

- `idea/`: 创意实体
- `project/`: 项目实体
- `iteration/`: 迭代实体
- `quality/`: 质量指标
- `common/`: 通用类型和常量

#### src/infra/

基础设施层，封装外部系统交互。

- `database/`: 数据库连接和迁移
- `workspace/`: 工作区文件操作
- `git/`: Git 操作封装
- `build/`: 构建和测试执行
- `llm/`: LLM API 调用
- `storage/`: 存储抽象

#### src/config/

配置层，管理系统配置。

- `project-factory.ts`: 主配置定义
- `env.ts`: 环境变量加载
- `validation.ts`: 配置验证

#### src/utils/

工具层，通用工具函数。

- `logger.ts`: 日志工具
- `retry.ts`: 重试策略
- `prompts.ts`: Prompt 模板
- `validation.ts`: 数据验证
- `time.ts`: 时间处理
- `hash.ts`: 哈希工具
- `json.ts`: JSON 处理
- `errors.ts`: 错误类型定义

#### tests/

测试目录。

- `unit/`: 单元测试
- `integration/`: 集成测试
- `e2e/`: 端到端测试

#### drizzle/

Drizzle ORM 相关配置。

- `config.ts`: 数据库连接配置
- `schema.ts`: 数据库表定义（与 src/infra/database/schema.ts 可能共享）

### projects/

生成的项目存放目录。

- `active/`: 正在开发的项目
- `completed/`: 已完成的项目
- `archived/`: 已归档的项目

### templates/

项目模板目录，为不同类型的项目提供基础模板。

- `web-app/`: Web 应用模板
- `cli-tool/`: CLI 工具模板
- `library/`: 库模板
- `api-service/`: API 服务模板

## 代码组织原则

### 1. 依赖方向

```
api → orchestration → agents → domain → infra
     ↘               ↘        ↓
      config          utils
```

- 上层依赖下层
- 下层不依赖上层
- utils 和 config 被所有层依赖

### 2. 文件命名约定

- 类文件：PascalCase，如 `AgentFactory.ts`
- 函数文件：kebab-case，如 `agent-factory.ts`
- 类型文件：-types.ts，如 `agent-types.ts`
- 测试文件：*.test.ts

### 3. 模块划分

每个目录对应一个明确的职责范围：
- `api/`: HTTP 交互
- `orchestration/`: 流程编排
- `agents/`: 任务执行
- `domain/`: 业务逻辑
- `infra/`: 基础设施
- `config/`: 配置管理
- `utils/`: 通用工具

### 4. 导入规则

- 同层内使用相对路径：`./utils/helper.ts`
- 跨层使用别名：`@/domain/idea/schema.ts`
- 避免循环依赖

## 环境变量

创建 `.env` 文件：

```env
# Server
PORT=8888

# Database
DATABASE_PATH=./data/project-factory.db

# LLM
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=4096

# Workspace
WORKSPACE_ROOT=./projects
WORKSPACE_ACTIVE=./projects/active
WORKSPACE_COMPLETED=./projects/completed
WORKSPACE_ARCHIVED=./projects/archived

# Quality
MIN_TEST_COVERAGE=80
MAX_LINT_ERRORS=0
MIN_QUALITY_SCORE=70

# Resources
MAX_COST_PER_DAY=50
MAX_CONCURRENT_PROJECTS=5
MAX_RETRIES=3
```

## 开发规范

### 1. TypeScript

- 使用严格模式
- 导出类型时优先使用 `export type`
- 避免使用 `any`

### 2. 错误处理

- 使用自定义错误类型
- 记录详细的错误上下文
- 提供有意义的错误消息

### 3. 日志

- 使用统一的 logger
- 记录关键操作和错误
- 使用适当的日志级别

### 4. 测试

- 每个功能对应测试文件
- 测试覆盖率目标：80%+
- 包含边界条件和错误情况

### 5. 提交消息

使用 conventional commits 格式：

```
feat(agents): add OptimizerAgent
fix(database): handle connection timeout
docs(architecture): update design diagrams
```
