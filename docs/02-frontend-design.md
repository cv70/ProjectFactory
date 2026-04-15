# 前端设计

## 1. 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18+ | UI框架 |
| TypeScript | 5+ | 类型安全 |
| Vite | 5+ | 构建工具 |
| TailwindCSS | 3+ | 样式框架 |
| TanStack Query | 5+ | 数据获取与缓存 |
| Zustand | 4+ | 状态管理 |
| React Router | 6+ | 路由管理 |
| React Hook Form | 7+ | 表单管理 |
| Zod | 3+ | Schema验证 |
| Recharts | 2+ | 数据可视化 |
| Monaco Editor | latest | 代码编辑器 |
| xterm.js | 5+ | 终端模拟 |

## 2. 目录结构

```
frontend/
├── src/
│   ├── components/           # 通用组件
│   │   ├── ui/              # 基础UI组件
│   │   ├── layout/          # 布局组件
│   │   ├── project/         # 项目相关组件
│   │   ├── code/            # 代码相关组件
│   │   ├── logs/            # 日志相关组件
│   │   └── charts/          # 图表组件
│   ├── pages/               # 页面组件
│   │   ├── Dashboard/       # 仪表盘
│   │   ├── Projects/        # 项目列表
│   │   ├── ProjectDetail/   # 项目详情
│   │   ├── KnowledgeBase/   # 知识库
│   │   ├── Settings/        # 设置
│   │   └── Monitoring/      # 监控大屏
│   ├── hooks/               # 自定义Hooks
│   ├── services/            # API服务
│   ├── stores/              # Zustand状态
│   ├── types/               # TypeScript类型
│   ├── utils/               # 工具函数
│   ├── constants/           # 常量定义
│   └── App.tsx              # 入口组件
├── public/                   # 静态资源
├── tailwind.config.js       # Tailwind配置
├── tsconfig.json           # TypeScript配置
└── vite.config.ts          # Vite配置
```

## 3. 核心页面设计

### 3.1 仪表盘 (Dashboard)

#### 布局
```
┌─────────────────────────────────────────────────────────────────┐
│  Header: Logo | 导航菜单 | 用户信息                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ 总项目数    │  │ 进行中      │  │ 成功率      │              │
│  │   128       │  │    12       │  │   87%       │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    近期生成趋势                           │   │
│  │                    [折线图]                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    项目类型分布                          │   │
│  │                    [饼图]                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    最近项目列表                          │   │
│  │  ┌─────┬──────┬──────┬──────┬──────┐                      │   │
│  │  │名称 │ 状态 │ 类型  │ 进度  │ 操作 │                      │   │
│  │  ├─────┼──────┼──────┼──────┼──────┤                      │   │
│  │  │ ... │ ...  │ ...  │ ...  │ ...  │                      │   │
│  │  └─────┴──────┴──────┴──────┴──────┘                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 关键指标卡片

```typescript
interface MetricCardProps {
  title: string;
  value: number | string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  icon?: ReactNode;
}
```

### 3.2 想法列表 (Ideas)

#### 功能
- 展示所有项目想法
- **主题自动生成**：输入主题，点击生成，自动创建多个 Idea
- **手动添加**：点击按钮展开表单，填写 Idea 详情
- **手动开发触发**：点击"开始开发"按钮直接触发项目开发
- 删除 Idea

#### 布局
```
┌─────────────────────────────────────────────────────────────────┐
│  Project Ideas                                      [+ 添加]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [主题输入框........................] [生成] [手动添加]         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  想法卡片 1                                             │   │
│  │  标题: AI Task Manager        状态: pending  复杂度: 中   │   │
│  │  描述: An intelligent task manager...                   │   │
│  │  技术栈: React, Node.js, OpenAI                         │   │
│  │  功能: AI task prioritization, Natural language...     │   │
│  │                                    [开始开发] [删除]     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  想法卡片 2                                             │   │
│  │  ...                                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 主题生成表单
```
┌─────────────────────────────────────────────────────────────────┐
│  输入主题: [AI助手________________]              [生成 ideas]  │
└─────────────────────────────────────────────────────────────────┘
```

#### 手动添加表单
```
┌─────────────────────────────────────────────────────────────────┐
│  标题:       [____________________]                             │
│  项目类型:   [Web应用 ▼]                                        │
│  描述:       [____________________]                             │
│              [____________________]                             │
│  功能特性:   [____________________]  (每行一个)                  │
│              [____________________]                             │
│  技术栈:     [React, Node.js_____]  (逗号分隔)                  │
│  目标用户:   [____________________]                             │
│  复杂度:     [中 ▼]                                             │
│                                        [添加] [取消]            │
└─────────────────────────────────────────────────────────────────┘
```

#### 组件定义

```typescript
interface Idea {
  id: string;
  title: string;
  description: string;
  projectType: 'web-app' | 'cli-tool' | 'library' | 'api-service';
  features: string[];
  techStack: string[];
  targetAudience: string;
  complexity: 'low' | 'medium' | 'high';
  status: 'pending' | 'queued' | 'in_progress' | 'completed' | 'failed';
  createdAt: number;
  metadata?: {
    topic?: string;
    generatedAt?: number;
  };
}

interface IdeaListProps {
  onGenerate: (topic: string) => Promise<void>;
  onAdd: (idea: Partial<Idea>) => Promise<void>;
  onDevelop: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}
```

### 3.3 项目列表 (Projects)

#### 功能
- 项目列表展示
- 筛选与搜索
- 排序
- 分页
- 批量操作

#### 筛选条件
- 状态：全部、进行中、已完成、失败
- 类型：CRUD、数据工具、脚本、其他
- 时间范围：今天、本周、本月、全部
- 搜索：项目名称、描述

#### 列表项

```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  type: ProjectType;
  status: ProjectStatus;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
  metrics: {
    generationTime: number;
    codeQuality: number;
    testCoverage: number;
  };
}
```

### 3.4 项目详情 (ProjectDetail)

#### 布局
```
┌─────────────────────────────────────────────────────────────────┐
│  [返回] 项目名称 - 状态标签 - 操作菜单                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  进度概览                                                │   │
│  │  ████████████████░░░░  75%                               │   │
│  │                                                         │   │
│  │  需求 ✓  架构 ✓  开发 ◎  验证 ○  部署 ○                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  实时日志 [控制台样式]                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  代码预览 [Monaco Editor]                               │   │
│  │  - src/                                                 │   │
│  │    - components/                                        │   │
│  │    - App.tsx                                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  质量指标                                                │   │
│  │  ┌────────┬────────┬────────┬────────┐                    │   │
│  │  │ 静态分析 │ 单元测试 │ 覆盖率 │ 安全扫描 │                    │   │
│  │  │   92%   │   85%  │  82%  │  通过   │                    │   │
│  │  └────────┴────────┴────────┴────────┘                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 标签页切换
- 概览
- 代码
- 文档
- 测试
- 部署
- 历史版本

### 3.5 知识库 (KnowledgeBase)

#### 功能
- 代码模式浏览
- 最佳实践查看
- 失败案例库
- 知识图谱可视化
- 搜索与筛选

#### 知识图谱

```typescript
interface KnowledgeNode {
  id: string;
  type: 'pattern' | 'practice' | 'failure' | 'component';
  label: string;
  description: string;
  tags: string[];
  usageCount: number;
  successRate: number;
}

interface KnowledgeEdge {
  source: string;
  target: string;
  type: 'related' | 'alternative' | 'derived';
  weight: number;
}
```

### 3.6 监控大屏 (Monitoring)

#### 布局
```
┌─────────────────────────────────────────────────────────────────┐
│  系统监控 - 实时状态 [自动刷新 10s]                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ 系统资源使用率      │  │ Agent状态           │              │
│  │ [CPU/Memory/Disk]   │  │ [活跃/空闲/错误]    │              │
│  └─────────────────────┘  └─────────────────────┘              │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ 生成速率            │  │ 质量趋势           │              │
│  │ [项目/小时]         │  │ [成功率趋势]        │              │
│  └─────────────────────┘  └─────────────────────┘              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 实时日志流                                             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 4. 通用组件设计

### 4.1 基础UI组件

```
components/ui/
├── Button/
├── Input/
├── Select/
├── Modal/
├── Card/
├── Badge/
├── Progress/
├── Spinner/
├── Tabs/
└── Tooltip/
```

### 4.2 布局组件

```typescript
// AppLayout
interface AppLayoutProps {
  children: ReactNode;
}

// SidebarLayout
interface SidebarLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
}

// PageHeader
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}
```

### 4.3 项目组件

```typescript
// ProjectCard
interface ProjectCardProps {
  project: Project;
  onDetail: (id: string) => void;
  onRestart: (id: string) => void;
  onDelete: (id: string) => void;
}

// PhaseIndicator
interface PhaseIndicatorProps {
  phases: Phase[];
  currentPhase: number;
}

// QualityMetrics
interface QualityMetricsProps {
  metrics: QualityMetrics;
}
```

### 4.4 代码组件

```typescript
// CodeViewer
interface CodeViewerProps {
  files: CodeFile[];
  defaultFile?: string;
  readOnly?: boolean;
}

// CodeDiff
interface CodeDiffProps {
  before: string;
  after: string;
  filename: string;
}
```

### 4.5 日志组件

```typescript
// LogViewer
interface LogViewerProps {
  logs: LogEntry[];
  autoScroll?: boolean;
  filters?: LogFilter;
}

// LogConsole
interface LogConsoleProps {
  source: WebSocket;
  filter?: LogFilter;
}
```

## 5. 状态管理

### 5.1 Zustand Store结构

```typescript
// stores/projectStore.ts
interface ProjectStore {
  projects: Project[];
  currentProject: Project | null;
  filters: ProjectFilters;
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (project: Project | null) => void;
  updateFilters: (filters: Partial<ProjectFilters>) => void;
  fetchProjects: () => Promise<void>;
  createProject: (data: CreateProjectData) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

// stores/monitoringStore.ts
interface MonitoringStore {
  metrics: SystemMetrics;
  logs: LogEntry[];
  isRealtime: boolean;
  subscribe: () => void;
  unsubscribe: () => void;
}

// stores/settingsStore.ts
interface SettingsStore {
  theme: 'light' | 'dark';
  language: string;
  notifications: NotificationSettings;
  updateSettings: (settings: Partial<Settings>) => void;
}
```

### 5.2 全局状态

```typescript
// stores/appStore.ts
interface AppStore {
  user: User | null;
  sidebarOpen: boolean;
  notifications: Notification[];
  setLoading: (loading: boolean) => void;
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
}
```

## 6. API服务层

### 6.1 API客户端

```typescript
// services/apiClient.ts
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    // implementation
  }

  async post<T>(path: string, data: unknown): Promise<T> {
    // implementation
  }

  async put<T>(path: string, data: unknown): Promise<T> {
    // implementation
  }

  async delete<T>(path: string): Promise<T> {
    // implementation
  }

  subscribe<T>(path: string, callback: (data: T) => void): WebSocket {
    // WebSocket subscription
  }
}
```

### 6.2 服务定义

```typescript
// services/projectService.ts
export const projectService = {
  list: (params: ProjectListParams) =>
    apiClient.get<ProjectListResponse>('/projects', params),

  get: (id: string) =>
    apiClient.get<Project>(`/projects/${id}`),

  create: (data: CreateProjectData) =>
    apiClient.post<Project>('/projects', data),

  update: (id: string, data: UpdateProjectData) =>
    apiClient.put<Project>(`/projects/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/projects/${id}`),

  subscribe: (id: string, callback: (event: ProjectEvent) => void) =>
    apiClient.subscribe<ProjectEvent>(`/projects/${id}/events`, callback),
};

// services/monitoringService.ts
export const monitoringService = {
  getMetrics: () =>
    apiClient.get<SystemMetrics>('/metrics'),

  getLogs: (params: LogQueryParams) =>
    apiClient.get<LogEntry[]>('/logs', params),

  subscribeLogs: (callback: (log: LogEntry) => void) =>
    apiClient.subscribe<LogEntry>('/logs/stream', callback),
};

// services/knowledgeService.ts
export const knowledgeService = {
  search: (query: string, filters?: KnowledgeFilters) =>
    apiClient.get<KnowledgeItem[]>('/knowledge/search', { query, ...filters }),

  get: (id: string) =>
    apiClient.get<KnowledgeItem>(`/knowledge/${id}`),

  create: (data: CreateKnowledgeData) =>
    apiClient.post<KnowledgeItem>('/knowledge', data),

  update: (id: string, data: UpdateKnowledgeData) =>
    apiClient.put<KnowledgeItem>(`/knowledge/${id}`, data),

  getGraph: () =>
    apiClient.get<KnowledgeGraph>('/knowledge/graph'),
};
```

## 7. 实时通信

### 7.1 WebSocket封装

```typescript
// hooks/useWebSocket.ts
interface UseWebSocketOptions {
  onMessage?: (data: unknown) => void;
  onError?: (error: Event) => void;
  reconnect?: boolean;
}

export function useWebSocket(
  url: string,
  options: UseWebSocketOptions = {}
) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<unknown>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLastMessage(data);
      options.onMessage?.(data);
    };

    ws.onerror = (error) => {
      setIsConnected(false);
      options.onError?.(error);
    };

    ws.onclose = () => {
      setIsConnected(false);
      if (options.reconnect) {
        setTimeout(() => {
          // reconnect logic
        }, 5000);
      }
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [url, options.reconnect]);

  const send = useCallback((data: unknown) => {
    wsRef.current?.send(JSON.stringify(data));
  }, []);

  return { isConnected, lastMessage, send };
}
```

### 7.2 项目进度订阅

```typescript
// hooks/useProjectProgress.ts
export function useProjectProgress(projectId: string) {
  const [progress, setProgress] = useState<ProjectProgress | null>(null);
  const { isConnected, lastMessage } = useWebSocket(
    `/api/projects/${projectId}/progress`
  );

  useEffect(() => {
    if (lastMessage) {
      setProgress(lastMessage as ProjectProgress);
    }
  }, [lastMessage]);

  return { progress, isConnected };
}
```

## 8. 样式主题

### 8.1 颜色系统

```css
/* light theme */
--color-primary: #3b82f6;
--color-success: #10b981;
--color-warning: #f59e0b;
--color-error: #ef4444;
--color-bg: #ffffff;
--color-bg-secondary: #f3f4f6;
--color-text: #1f2937;
--color-text-secondary: #6b7280;
--color-border: #e5e7eb;

/* dark theme */
--color-primary: #60a5fa;
--color-success: #34d399;
--color-warning: #fbbf24;
--color-error: #f87171;
--color-bg: #111827;
--color-bg-secondary: #1f2937;
--color-text: #f9fafb;
--color-text-secondary: #9ca3af;
--color-border: #374151;
```

### 8.2 响应式断点

```typescript
const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};
```

---

**版本**: 0.2.0
**更新日期**: 2026-04-15
**状态**: 设计阶段
**变更**: 新增 Idea 管理 UI，支持主题自动生成、手动添加、手动触发开发
