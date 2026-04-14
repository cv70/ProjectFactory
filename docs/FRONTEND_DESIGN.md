# 前端详细设计文档

## 1. 设计理念

### 1.1 设计目标

| 目标 | 说明 | 优先级 |
|------|------|--------|
| **清晰** | 状态和信息一目了然 | P0 |
| **响应** | 实时更新，无需刷新 | P0 |
| **高效** | 快速操作，减少等待 | P1 |
| **美观** | 现代简洁的界面 | P2 |

### 1.2 设计原则

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              设计原则                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. 状态可见性                                                               │
│     - 所有系统状态实时可见                                                    │
│     - 进度、指标、错误一目了然                                                │
│     - 历史状态可追溯                                                         │
│                                                                              │
│  2. 操作确定性                                                               │
│     - 所有操作有明确反馈                                                      │
│     - 长时间操作显示进度                                                      │
│     - 错误状态清晰说明                                                        │
│                                                                              │
│  3. 降级优雅                                                                 │
│     - 离线时展示缓存数据                                                      │
│     - API 失败时显示友好提示                                                  │
│     - 优雅降级到简化视图                                                      │
│                                                                              │
│  4. 响应式设计                                                               │
│     - 适配桌面和移动设备                                                      │
│     - 断点尺寸合理                                                           │
│     - 触摸友好                                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. 技术架构

### 2.1 技术栈

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **框架** | React | 18.x | UI 框架 |
| **语言** | TypeScript | 5.x | 类型安全 |
| **构建** | Vite | 5.x | 快速构建 |
| **路由** | React Router | 6.x | 路由管理 |
| **状态** | Zustand | 4.x | 轻量状态管理 |
| **数据** | TanStack Query | 5.x | 服务端状态 |
| **样式** | Tailwind CSS | 3.x | 原子化 CSS |
| **图表** | Recharts | 2.x | 数据可视化 |
| **图标** | Lucide React | - | 图标库 |
| **终端** | xterm.js | - | 终端模拟器 |

### 2.2 目录结构

```
frontend/
├── src/
│   ├── main.tsx                 # 入口文件
│   ├── App.tsx                  # 根组件
│   ├── App.css                  # 全局样式
│   │
│   ├── components/              # 公共组件
│   │   ├── ui/                  # 基础 UI 组件
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Spinner.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/              # 布局组件
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── ...
│   │   │
│   │   └── charts/              # 图表组件
│   │       ├── LineChart.tsx
│   │       ├── BarChart.tsx
│   │       └── ...
│   │
│   ├── pages/                   # 页面组件
│   │   ├── Dashboard.tsx        # 总览页
│   │   ├── Projects.tsx         # 项目列表
│   │   ├── ProjectDetail.tsx    # 项目详情
│   │   ├── Ideas.tsx            # 创意列表
│   │   ├── Knowledge.tsx         # 知识库
│   │   ├── Settings.tsx         # 设置页
│   │   └── Logs.tsx             # 日志查看
│   │
│   ├── features/                # 功能模块
│   │   ├── projects/            # 项目相关
│   │   │   ├── api.ts
│   │   │   ├── hooks.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── ideas/               # 创意相关
│   │   │   ├── api.ts
│   │   │   ├── hooks.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── knowledge/           # 知识库相关
│   │   │   ├── api.ts
│   │   │   ├── hooks.ts
│   │   │   └── types.ts
│   │   │
│   │   └── monitoring/          # 监控相关
│   │       ├── api.ts
│   │       ├── hooks.ts
│   │       └── types.ts
│   │
│   ├── services/                # 服务层
│   │   ├── api.ts               # API 客户端
│   │   ├── websocket.ts         # WebSocket 客户端
│   │   └── logger.ts            # 日志服务
│   │
│   ├── store/                   # 状态管理
│   │   ├── index.ts             # store 导出
│   │   ├── useUIStore.ts        # UI 状态
│   │   ├── useProjectStore.ts   # 项目状态
│   │   └── useSystemStore.ts    # 系统状态
│   │
│   ├── hooks/                   # 公共 hooks
│   │   ├── useWebSocket.ts
│   │   ├── useLocalStorage.ts
│   │   └── ...
│   │
│   ├── utils/                   # 工具函数
│   │   ├── format.ts            # 格式化
│   │   ├── date.ts              # 日期处理
│   │   └── ...
│   │
│   └── types/                   # 类型定义
│       ├── api.ts               # API 类型
│       ├── models.ts             # 数据模型
│       └── events.ts             # 事件类型
│
├── public/                      # 静态资源
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

### 2.3 组件架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              组件架构                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         App (根组件)                                    │    │
│  │                                                                       │    │
│  │   ┌─────────────────────────────────────────────────────────────┐   │    │
│  │   │                     Router                                   │   │    │
│  │   │   /              → Dashboard                               │   │    │
│  │   │   /projects       → ProjectList                            │   │    │
│  │   │   /projects/:id  → ProjectDetail                          │   │    │
│  │   │   /ideas          → IdeaList                               │   │    │
│  │   │   /knowledge      → KnowledgeBase                          │   │    │
│  │   │   /settings       → Settings                               │   │    │
│  │   │   /logs           → Logs                                   │   │    │
│  │   └─────────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 3. 页面设计

### 3.1 Dashboard（总览页）

**页面职责**：展示系统全局状态和关键指标

**布局结构**：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Dashboard                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        概览指标卡片                                     │  │
│  │                                                                       │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │  │
│  │  │ 活跃项目    │  │ 已完成      │  │ 成功率     │  │ 平均质量   │  │  │
│  │  │    5       │  │   127      │  │   94%     │  │    78     │  │  │
│  │  │   ↑2      │  │   ↑12     │  │   ↑3%    │  │   ↑5     │  │  │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘  │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │      系统状态                │  │         活跃项目列表                  │  │
│  │                             │  │                                     │  │
│  │  ● 运行中                   │  │  ┌─────────────────────────────┐   │  │
│  │    运行时间: 127h           │  │  │ #128 - 数据转换工具           │   │  │
│  │                             │  │  │ 状态: 编码中 | 进度: 65%     │   │  │
│  │  ┌───────────────────────┐ │  │  │ 预计剩余: 15分钟              │   │  │
│  │  │ LLM: GPT-4            │ │  │  └─────────────────────────────┘   │  │
│  │  │ 队列: 3               │ │  │  ┌─────────────────────────────┐   │  │
│  │  │ 知识库: 1,234 条      │ │  │  │ #129 - REST API生成器       │   │  │
│  │  └───────────────────────┘ │  │  │ │ 状态: 测试中 | 进度: 85%   │   │  │
│  │                             │  │  │ 预计剩余: 5分钟             │   │  │
│  │  Pipeline:                 │  │  └─────────────────────────────┘   │  │
│  │  ┌───────────────────────┐ │  │                                     │  │
│  │  │ ● Ideas    ● Projects │ │  └─────────────────────────────────────┘  │
│  │  │ ● Iteration            │ │                                        │
│  │  └───────────────────────┘ │  ┌─────────────────────────────────────┐  │
│  │                             │  │         最近生成的项目                 │  │
│  └─────────────────────────────┘  │                                     │  │
│                                   │  ┌─────────────────────────────┐   │  │
│  ┌─────────────────────────────┐  │  │ CLI工具 - 3小时前 - 质量:85  │   │  │
│  │      生成趋势 (7天)         │  │  └─────────────────────────────┘   │  │
│  │                             │  │  ┌─────────────────────────────┐   │  │
│  │  █                          │  │  │ Web应用 - 6小时前 - 质量:72  │   │  │
│  │  █ █                        │  │  └─────────────────────────────┘   │  │
│  │  █ █ █                      │  └─────────────────────────────────────┘  │
│  │  █ █ █ █  █                 │                                           │
│  │  ────────────────────        │  ┌─────────────────────────────────────┐  │
│  │  Mon Tue Wed Thu Fri Sat Sun│  │         快捷操作                     │  │
│  └─────────────────────────────┘  │                                     │  │
│                                   │  [新建项目] [查看队列] [系统设置]      │  │
│                                   └─────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**组件结构**：

```typescript
// Dashboard 页面组件
function Dashboard() {
  return (
    <div className="dashboard">
      {/* 概览指标 */}
      <MetricsOverview />

      <div className="dashboard-grid">
        {/* 左侧栏 */}
        <aside className="sidebar">
          <SystemStatus />
          <GenerationTrend />
        </aside>

        {/* 主内容 */}
        <main className="main-content">
          <ActiveProjects />
          <RecentProjects />
          <QuickActions />
        </main>
      </div>
    </div>
  );
}
```

### 3.2 ProjectDetail（项目详情页）

**页面职责**：展示单个项目的详细信息和实时进度

**布局结构**：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Project #128 - 数据转换工具                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [← 返回列表]  [暂停项目]  [取消项目]  [查看代码]  [查看日志]                │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        项目信息卡片                                     │  │
│  │                                                                       │  │
│  │  类型: 数据转换工具    复杂度: 中    技术栈: TypeScript + Node.js      │  │
│  │  状态: 编码中          进度: 65%     预计剩余: 15分钟                  │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────┐  ┌────────────────────────────────────┐ │
│  │       阶段进度                 │  │         阶段详情                     │ │
│  │                               │  │                                     │ │
│  │   ① 需求   ✅ 完成            │  │  阶段: 编码中                        │ │
│  │       │                       │  │                                     │ │
│  │   ② 架构   ✅ 完成            │  │  正在生成:                           │ │
│  │       │                       │  │  - src/utils/transformer.ts        │ │
│  │   ③ 编码   🔄 进行中          │  │  - src/services/parser.ts          │ │
│  │       │                       │  │  - src/types/index.ts              │ │
│  │   ④ 测试   ⏳ 等待中          │  │                                     │ │
│  │       │                       │  │  已生成: 12/18 文件                 │ │
│  │   ⑤ 审查   ⏳ 等待中          │  │  代码行数: 2,456                     │ │
│  │       │                       │  │                                     │ │
│  │   ⑥ 部署   ⏳ 等待中          │  │  [查看架构] [查看代码] [查看测试]     │ │
│  │                               │  │                                     │ │
│  └──────────────────────────────┘  └────────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                           实时日志                                     │  │
│  │  ─────────────────────────────────────────────────────────────────   │  │
│  │  [14:23:45] CoderAgent: 开始生成文件...                              │  │
│  │  [14:23:46] 生成: src/utils/transformer.ts                          │  │
│  │  [14:23:47] 生成: src/services/parser.ts                           │  │
│  │  [14:23:48] 生成: src/types/index.ts                                │  │
│  │  [14:23:50] 验证语法...                                             │  │
│  │  [14:23:51] 语法验证通过                                            │  │
│  │  [14:23:52] 继续生成下一个模块...                                    │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                           质量指标                                     │  │
│  │  ─────────────────────────────────────────────────────────────────   │  │
│  │                                                                       │  │
│  │  覆盖率: ████████████░░░░░░░░░  65%  (目标: 80%)                    │  │
│  │  质量:   ████████████████░░░░  78/100                               │  │
│  │  Lint:  0 错误 (目标: 0)                                              │  │
│  │  构建:   等待中                                                        │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**组件结构**：

```typescript
// ProjectDetail 页面
function ProjectDetail() {
  const { projectId } = useParams();
  const { project, loading, error } = useProject(projectId);

  // WebSocket 订阅实时更新
  useWebSocketSubscription(`project:${projectId}`);

  if (loading) return <ProjectDetailSkeleton />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="project-detail">
      {/* 头部操作栏 */}
      <ProjectHeader project={project} />

      {/* 项目信息 */}
      <ProjectInfo project={project} />

      <div className="detail-grid">
        {/* 阶段进度 */}
        <StageProgress project={project} />

        {/* 阶段详情 */}
        <StageDetails project={project} />
      </div>

      {/* 实时日志 */}
      <RealTimeLog projectId={projectId} />

      {/* 质量指标 */}
      <QualityMetrics project={project} />
    </div>
  );
}
```

### 3.3 KnowledgeBase（知识库页面）

**页面职责**：管理和浏览知识库条目

**布局结构**：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              知识库                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [搜索知识库...]                    [筛选 ▼]  [类型 ▼]  [+ 添加知识]         │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                           知识统计                                     │  │
│  │                                                                       │  │
│  │  代码模式: 456    最佳实践: 234    失败案例: 89    领域知识: 123        │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │  📦 代码模式: React Hooks 封装模式                               │  │  │
│  │  │  标签: React, Hooks, TypeScript                                 │  │  │
│  │  │  使用: 23次 | 成功率: 91% | 质量: 85                            │  │  │
│  │  │  来源: 项目 #128 | 添加: 2026-04-14                            │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                       │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │  ⚠️ 失败案例: 数据库连接池泄漏                                    │  │  │
│  │  │  标签: PostgreSQL, Connection Pool                              │  │  │
│  │  │  影响项目: 3 | 教训: 记得在 finally 中关闭连接                   │  │  │
│  │  │  来源: 项目 #45 | 添加: 2026-04-12                              │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                       │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │  ✅ 最佳实践: API 错误处理规范                                   │  │  │
│  │  │  标签: API, Error Handling, Best Practice                      │  │  │
│  │  │  使用: 56次 | 成功率: 98% | 质量: 92                            │  │  │
│  │  │  来源: 系统 | 添加: 2026-04-01                                  │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                           知识详情                                     │  │
│  │  ─────────────────────────────────────────────────────────────────  │  │
│  │                                                                       │  │
│  │  // React Hook 封装模式示例                                          │  │
│  │                                                                       │  │
│  │  function useAsyncData<T>(                                         │  │
│  │    fetcher: () => Promise<T>,                                       │  │
│  │    deps?: DependencyList                                            │  │
│  │  ) {                                                                │  │
│  │    const [data, setData] = useState<T>();                           │  │
│  │    const [loading, setLoading] = useState(true);                    │  │
│  │    const [error, setError] = useState<Error>();                     │  │
│  │                                                                       │  │
│  │    useEffect(() => {                                                │  │
│  │      fetcher()                                                     │  │
│  │        .then(setData)                                              │  │
│  │        .catch(setError)                                            │  │
│  │        .finally(() => setLoading(false));                          │  │
│  │    }, deps || []);                                                 │  │
│  │                                                                       │  │
│  │    return { data, loading, error };                                 │  │
│  │  }                                                                 │  │
│  │                                                                       │  │
│  │  [复制代码]  [使用此模式]  [编辑]  [删除]                              │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 4. 组件设计

### 4.1 基础 UI 组件

```typescript
// Button 组件
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
}

function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  children,
  onClick
}: ButtonProps) {
  const baseClasses = 'btn';
  const variantClasses = `btn-${variant}`;
  const sizeClasses = `btn-${size}`;

  return (
    <button
      className={`${baseClasses} ${variantClasses} ${sizeClasses}`}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? <Spinner size="sm" /> : icon}
      {children}
    </button>
  );
}

// Card 组件
interface CardProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

function Card({ title, subtitle, actions, children, className }: CardProps) {
  return (
    <div className={`card ${className || ''}`}>
      {(title || actions) && (
        <div className="card-header">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      <div className="card-content">{children}</div>
    </div>
  );
}

// Badge 组件
interface BadgeProps {
  variant: 'default' | 'success' | 'warning' | 'error' | 'info';
  children: ReactNode;
}

function Badge({ variant, children }: BadgeProps) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}
```

### 4.2 业务组件

```typescript
// ProjectCard 组件
interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
  onPause?: () => void;
  onCancel?: () => void;
}

function ProjectCard({ project, onClick, onPause, onCancel }: ProjectCardProps) {
  const statusColors = {
    pending: 'gray',
    queued: 'blue',
    generating: 'yellow',
    testing: 'orange',
    building: 'purple',
    completed: 'green',
    failed: 'red'
  };

  return (
    <Card
      className="project-card"
      actions={
        <div className="project-actions">
          <Button size="sm" variant="ghost" onClick={onClick}>
            详情
          </Button>
          {project.status === 'generating' && (
            <Button size="sm" variant="secondary" onClick={onPause}>
              暂停
            </Button>
          )}
          {['pending', 'queued'].includes(project.status) && (
            <Button size="sm" variant="danger" onClick={onCancel}>
              取消
            </Button>
          )}
        </div>
      }
    >
      <div className="project-header" onClick={onClick}>
        <h4 className="project-name">{project.name}</h4>
        <Badge variant={statusColors[project.status]}>{project.status}</Badge>
      </div>

      <p className="project-description">{project.description}</p>

      <div className="project-metrics">
        <div className="metric">
          <span className="metric-label">质量</span>
          <QualityIndicator score={project.qualityScore} />
        </div>
        <div className="metric">
          <span className="metric-label">覆盖率</span>
          <span className="metric-value">{project.testCoverage}%</span>
        </div>
        <div className="metric">
          <span className="metric-label">Lint</span>
          <span className={`metric-value ${project.lintErrors > 0 ? 'error' : ''}`}>
            {project.lintErrors}
          </span>
        </div>
      </div>

      {project.error && (
        <div className="project-error">
          <span>错误:</span> {project.error}
        </div>
      )}
    </Card>
  );
}

// QualityIndicator 组件
function QualityIndicator({ score }: { score: number }) {
  const color = score >= 70 ? 'green' : score >= 50 ? 'yellow' : 'red';

  return (
    <div className="quality-indicator">
      <div className="quality-bar">
        <div className={`quality-fill ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="quality-value">{score}</span>
    </div>
  );
}

// StageProgress 组件
interface StageProgressProps {
  stages: Stage[];
  currentStage: string;
}

function StageProgress({ stages, currentStage }: StageProgressProps) {
  return (
    <div className="stage-progress">
      {stages.map((stage, index) => {
        const status = getStageStatus(stage, currentStage);

        return (
          <div key={stage.id} className="stage-item">
            <div className={`stage-icon ${status}`}>
              {status === 'completed' ? '✓' : status === 'active' ? index + 1 : index + 1}
            </div>
            <div className="stage-info">
              <span className="stage-name">{stage.name}</span>
              <span className="stage-status">{stage.status}</span>
            </div>
            {index < stages.length - 1 && <div className={`stage-line ${status}`} />}
          </div>
        );
      })}
    </div>
  );
}
```

### 4.3 实时组件

```typescript
// RealTimeLog 组件
function RealTimeLog({ projectId }: { projectId: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const logsEndRef = useRef<HTMLDivElement>(null);

  // WebSocket 订阅
  useEffect(() => {
    const ws = connectWebSocket(`/ws/projects/${projectId}/logs`);

    ws.onmessage = (event) => {
      const log = JSON.parse(event.data);
      setLogs((prev) => [...prev.slice(-999), log]); // 保留最近 1000 条
    };

    return () => ws.close();
  }, [projectId]);

  // 自动滚动
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const filteredLogs = logs.filter((log) => filter === 'all' || log.type === filter);

  return (
    <div className="realtime-log">
      <div className="log-header">
        <h4>实时日志</h4>
        <div className="log-filters">
          <button onClick={() => setFilter('all')}>全部</button>
          <button onClick={() => setFilter('info')}>信息</button>
          <button onClick={() => setFilter('warn')}>警告</button>
          <button onClick={() => setFilter('error')}>错误</button>
        </div>
      </div>

      <div className="log-content">
        {filteredLogs.map((log) => (
          <div key={log.id} className={`log-entry ${log.type}`}>
            <span className="log-time">[{log.timestamp}]</span>
            <span className="log-agent">[{log.agent}]</span>
            <span className="log-message">{log.message}</span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
```

## 5. 状态管理

### 5.1 Store 设计

```typescript
// useProjectStore - 项目状态
interface ProjectState {
  // 状态
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  error: string | null;

  // 操作
  fetchProjects: () => Promise<void>;
  fetchProject: (id: string) => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<Project>;
  pauseProject: (id: string) => Promise<void>;
  resumeProject: (id: string) => Promise<void>;
  cancelProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const { projects } = await api.getProjects();
      set({ projects, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  fetchProject: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const { project } = await api.getProject(id);
      set({ currentProject: project, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  createProject: async (input) => {
    set({ loading: true, error: null });
    try {
      const { project } = await api.createProject(input);
      set((state) => ({
        projects: [...state.projects, project],
        loading: false
      }));
      return project;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  pauseProject: async (id: string) => {
    await api.pauseProject(id);
    // 更新本地状态
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, status: 'paused' } : p
      )
    }));
  },

  resumeProject: async (id: string) => {
    await api.resumeProject(id);
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, status: 'generating' } : p
      )
    }));
  },

  cancelProject: async (id: string) => {
    await api.cancelProject(id);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id)
    }));
  }
}));

// useSystemStore - 系统状态
interface SystemState {
  // 状态
  status: SystemStatus | null;
  metrics: SystemMetrics | null;
  alerts: Alert[];

  // 操作
  fetchStatus: () => Promise<void>;
  fetchMetrics: () => Promise<void>;
  dismissAlert: (id: string) => void;
}

export const useSystemStore = create<SystemState>((set, get) => ({
  status: null,
  metrics: null,
  alerts: [],

  fetchStatus: async () => {
    try {
      const status = await api.getStatus();
      set({ status });
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  },

  fetchMetrics: async () => {
    try {
      const metrics = await api.getMetrics();
      set({ metrics });
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  },

  dismissAlert: (id: string) => {
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== id)
    }));
  }
}));
```

### 5.2 TanStack Query 集成

```typescript
// API 钩子
export function useProjects(params?: ProjectListParams) {
  return useQuery({
    queryKey: ['projects', params],
    queryFn: () => api.getProjects(params),
    refetchInterval: 30000, // 每 30 秒刷新
    staleTime: 10000
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => api.getProject(id),
    enabled: !!id
  });
}

export function useProjectLogs(projectId: string) {
  return useQuery({
    queryKey: ['project-logs', projectId],
    queryFn: () => api.getProjectLogs(projectId),
    refetchInterval: 5000 // 每 5 秒刷新日志
  });
}

// 变更操作
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectInput) => api.createProject(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });
}

export function usePauseProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.pauseProject(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });
}
```

## 6. API 交互

### 6.1 API 客户端

```typescript
// services/api.ts
const API_BASE = '/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    });

    const text = await response.text();

    // 尝试解析 JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // 返回 HTML 错误页
      return { error: `Server returned non-JSON: ${text.slice(0, 100)}` };
    }

    if (!response.ok) {
      return { error: data.error || `HTTP ${response.status}` };
    }

    return { data: data as T };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

// API 方法
export const api = {
  // Projects
  getProjects: (params?: ProjectListParams) =>
    fetchApi<{ projects: Project[] }>(
      `/projects?${new URLSearchParams(params as any)}`
    ),

  getProject: (id: string) =>
    fetchApi<{ project: Project }>(`/projects/${id}`),

  createProject: (input: CreateProjectInput) =>
    fetchApi<{ project: Project }>('/projects', {
      method: 'POST',
      body: JSON.stringify(input)
    }),

  pauseProject: (id: string) =>
    fetchApi<void>(`/projects/${id}/pause`, { method: 'POST' }),

  // Ideas
  getIdeas: (params?: IdeaListParams) =>
    fetchApi<{ ideas: Idea[] }>(
      `/ideas?${new URLSearchParams(params as any)}`
    ),

  // Status
  getStatus: () =>
    fetchApi<SystemStatus>('/status'),

  getMetrics: () =>
    fetchApi<SystemMetrics>('/metrics')
};
```

### 6.2 WebSocket 客户端

```typescript
// services/websocket.ts
type MessageHandler = (data: unknown) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(url: string) {
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { type, data } = message;

        const handlers = this.handlers.get(type);
        if (handlers) {
          handlers.forEach((handler) => handler(data));
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.attemptReconnect(url);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  subscribe(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    // 返回取消订阅函数
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  private attemptReconnect(url: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(url), 1000 * this.reconnectAttempts);
    }
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}

export const wsClient = new WebSocketClient();

// Hook
function useWebSocketSubscription(type: string, handler: MessageHandler) {
  useEffect(() => {
    const unsubscribe = wsClient.subscribe(type, handler);
    return unsubscribe;
  }, [type, handler]);
}
```

## 7. 样式设计

### 7.1 Tailwind 配置

```javascript
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8'
        },
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'monospace']
      }
    }
  },
  plugins: []
};
```

### 7.2 组件样式

```css
/* 卡片样式 */
.card {
  @apply bg-white rounded-lg shadow-sm border border-gray-200;
}

.card-header {
  @apply flex items-center justify-between px-4 py-3 border-b border-gray-200;
}

.card-title {
  @apply text-lg font-semibold text-gray-900;
}

.card-content {
  @apply p-4;
}

/* 按钮样式 */
.btn {
  @apply inline-flex items-center justify-center gap-2 rounded-md font-medium;
  @apply transition-colors duration-200;
  @apply focus:outline-none focus:ring-2 focus:ring-offset-2;
}

.btn-primary {
  @apply bg-primary-600 text-white hover:bg-primary-700;
  @apply focus:ring-primary-500;
}

.btn-secondary {
  @apply bg-gray-100 text-gray-900 hover:bg-gray-200;
  @apply focus:ring-gray-500;
}

.btn-danger {
  @apply bg-red-600 text-white hover:bg-red-700;
  @apply focus:ring-red-500;
}

/* 徽章样式 */
.badge {
  @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium;
}

.badge-success {
  @apply bg-green-100 text-green-800;
}

.badge-warning {
  @apply bg-yellow-100 text-yellow-800;
}

.badge-error {
  @apply bg-red-100 text-red-800;
}

/* 质量指示器 */
.quality-indicator {
  @apply flex items-center gap-2;
}

.quality-bar {
  @apply w-20 h-2 bg-gray-200 rounded-full overflow-hidden;
}

.quality-fill {
  @apply h-full rounded-full transition-all duration-300;
}

.quality-fill.green {
  @apply bg-green-500;
}

.quality-fill.yellow {
  @apply bg-yellow-500;
}

.quality-fill.red {
  @apply bg-red-500;
}
```

## 8. 响应式设计

### 8.1 断点定义

| 断点 | 尺寸 | 说明 |
|------|------|------|
| sm | 640px | 手机横向 |
| md | 768px | 平板 |
| lg | 1024px | 小笔记本 |
| xl | 1280px | 桌面 |
| 2xl | 1536px | 大屏 |

### 8.2 响应式布局

```typescript
// Dashboard 响应式布局
function Dashboard() {
  return (
    <div className="dashboard">
      {/* 移动端：堆叠布局 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricsCard title="活跃项目" value={5} />
        <MetricsCard title="已完成" value={127} />
        <MetricsCard title="成功率" value="94%" />
        <MetricsCard title="平均质量" value={78} />
      </div>

      {/* 桌面端：侧边栏布局 */}
      <div className="hidden lg:grid grid-cols-4 gap-6">
        <aside className="col-span-1">
          <SystemStatus />
        </aside>
        <main className="col-span-3">
          <ActiveProjects />
        </main>
      </div>
    </div>
  );
}
```

---

**版本**: 1.0.0
**创建日期**: 2026-04-14
**状态**: 前端详细设计
