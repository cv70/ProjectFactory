# 前端架构设计

## 1. 设计目标

前端作为系统的"表现层"，需要实现：

- **实时监控**：系统运行状态的实时可视化
- **交互控制**：人机协作的控制面板
- **历史追溯**：生成历史和知识库的查询界面
- **配置管理**：系统参数和策略的可视化配置

## 2. 技术架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         React Application                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    表现层 (UI Components)                     ││
│  │  Pages | Widgets | Charts | Forms | Modals                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    状态层 (State Management)                  ││
│  │  Global Store | Local State | Server State (React Query)    ││
│  └─────────────────────────────────────────────────────────────┘│
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    服务层 (Services)                          ││
│  │  API Client | WebSocket | EventBus | Storage                ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 目录结构

```
frontend/
├── src/
│   ├── app/                    # 应用入口
│   │   ├── App.tsx
│   │   ├── Router.tsx
│   │   └── Providers.tsx
│   │
│   ├── pages/                  # 页面组件
│   │   ├── Dashboard/          # 仪表盘首页
│   │   ├── Projects/           # 项目管理
│   │   ├── Ideas/              # 创意队列
│   │   ├── Knowledge/          # 知识库
│   │   ├── Monitor/            # 实时监控
│   │   ├── Settings/           # 系统设置
│   │   └── Analytics/          # 数据分析
│   │
│   ├── components/             # 可复用组件
│   │   ├── ui/                 # 基础UI组件 (shadcn/ui)
│   │   ├── charts/             # 图表组件
│   │   ├── forms/              # 表单组件
│   │   ├── layouts/            # 布局组件
│   │   └── widgets/            # 业务组件
│   │
│   ├── features/               # 功能模块 (按领域划分)
│   │   ├── project/            # 项目相关功能
│   │   ├── idea/               # 创意相关功能
│   │   ├── monitor/            # 监控相关功能
│   │   └── knowledge/          # 知识相关功能
│   │
│   ├── hooks/                  # 自定义Hooks
│   │   ├── useWebSocket.ts     # WebSocket连接
│   │   ├── useProject.ts       # 项目数据
│   │   ├── useMonitor.ts       # 监控数据
│   │   └── useKnowledge.ts     # 知识库数据
│   │
│   ├── stores/                 # 全局状态 (Zustand)
│   │   ├── systemStore.ts      # 系统状态
│   │   ├── projectStore.ts     # 项目状态
│   │   ├── notificationStore.ts# 通知状态
│   │   └── settingsStore.ts    # 设置状态
│   │
│   ├── services/               # 服务层
│   │   ├── api/                # REST API
│   │   ├── websocket/          # WebSocket
│   │   ├── storage/            # 本地存储
│   │   └── analytics/          # 数据分析
│   │
│   ├── types/                  # TypeScript类型
│   │   ├── api.ts              # API类型
│   │   ├── project.ts          # 项目类型
│   │   ├── monitor.ts          # 监控类型
│   │   └── knowledge.ts        # 知识类型
│   │
│   ├── utils/                  # 工具函数
│   │   ├── format.ts           # 格式化
│   │   ├── validation.ts       # 验证
│   │   └── helpers.ts          # 辅助函数
│   │
│   └── styles/                 # 样式文件
│       ├── globals.css         # 全局样式
│       └── themes/             # 主题配置
│
├── public/                     # 静态资源
├── tests/                      # 测试文件
└── package.json
```

## 3. 核心页面设计

### 3.1 Dashboard（仪表盘）

系统首页，展示系统整体运行状态：

```
┌─────────────────────────────────────────────────────────────────┐
│  ProjectFactory - 无限自动化项目生成系统                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ 活跃项目: 5   │  │ 队列创意: 23  │  │ 今日完成: 3   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    实时运行状态                              ││
│  │  [当前阶段] Idea Generation > Architecture > Coding        ││
│  │  [项目名称] task-manager-cli                               ││
│  │  [进度] ████████░░░░░░░░ 60%                               ││
│  │  [质量分数] 75/100                                          ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────────┐  ┌────────────────────────────────────┐│
│  │     生成趋势图       │  │         知识库热力图              ││
│  │   📈 折线图          │  │      🗺️ 矩阵热力图               ││
│  └────────────────────┘  └────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  最近生成的项目                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🟢 task-manager-cli     CLI Tool    Score: 85    Just now  ││
│  │ 🟢 markdown-converter   Library     Score: 78    2h ago    ││
│  │ 🟡 api-gateway          API Service Score: 65    4h ago    ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Projects（项目管理）

项目列表和详情：

```
┌─────────────────────────────────────────────────────────────────┐
│  项目管理                                    [+ 新建] [🔍 搜索] │
├─────────────────────────────────────────────────────────────────┤
│  筛选: [全部] [进行中] [已完成] [失败]    排序: [时间↓] [分数↓]│
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ task-manager-cli                              🟢 Completed  ││
│  │ CLI工具 - 任务管理命令行工具                                 ││
│  │ 测试覆盖: 92%  质量: 85  构建: ✓  Lint: 0 errors            ││
│  │ [查看代码] [查看日志] [重新生成] [删除]                      ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ api-gateway                                  🟡 Optimizing  ││
│  │ API服务 - 智能API网关                                       ││
│  │ 当前进度: ████████░░ 60%  阶段: Testing                    ││
│  │ [查看进度] [查看日志] [暂停] [取消]                          ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Ideas（创意队列）

创意生成和管理：

```
┌─────────────────────────────────────────────────────────────────┐
│  创意队列                              [生成新创意] [设置策略]   │
├─────────────────────────────────────────────────────────────────┤
│  生成状态: 自动中 (每1分钟)    队列大小: 23/100                 │
├─────────────────────────────────────────────────────────────────┤
│  待处理创意                                                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🆕 file-organizer                                          ││
│  │    文件自动分类整理工具 - 自动识别文件类型并分类             ││
│  │    类型: CLI Tool | 复杂度: Low | 价值: 78                  ││
│  │    [开始生成] [查看详情] [移除]                             ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🆕 data-visualizer                                         ││
│  │    数据可视化组件库 - 支持多种图表类型                      ││
│  │    类型: Library | 复杂度: Medium | 价值: 85               ││
│  │    [开始生成] [查看详情] [移除]                             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 Knowledge（知识库）

知识管理和查询：

```
┌─────────────────────────────────────────────────────────────────┐
│  知识库                                    [导入] [导出] [搜索] │
├─────────────────────────────────────────────────────────────────┤
│  知识类型: [全部] [模式] [模板] [经验] [失败案例]              │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────────────────────────────┐│
│  │  知识统计       │  │  知识列表                              ││
│  │  模式: 128      │  │  - Repository Pattern                 ││
│  │  模板: 45       │  │  - Factory Pattern                    ││
│  │  经验: 89       │  │  - CLI Project Template               ││
│  │  失败: 12       │  │  - API Service Template               ││
│  └────────────────┘  └────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  向量相似度搜索                                                  │
│  [输入描述，搜索相似知识...]                          [搜索]   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.5 Monitor（实时监控）

系统运行监控：

```
┌─────────────────────────────────────────────────────────────────┐
│  实时监控                                       最后更新: 2s前  │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐   │
│  │ CPU: 45%       │  │ Memory: 2.1GB  │  │ Disk: 128GB    │   │
│  └────────────────┘  └────────────────┘  └────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Agent执行状态                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ IdeaGenerator  🟢 Running   当前: file-organizer            ││
│  │ Architect      ⚪ Waiting   等待任务...                     ││
│  │ Coder          ⚪ Waiting   等待任务...                     ││
│  │ Tester         🟡 Finishing 当前: task-manager-cli          ││
│  │ Reviewer       ⚪ Waiting   等待任务...                     ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  LLM调用统计                                                    │
│  今日调用: 1,234  Tokens: 2.5M  成本: $12.50  平均延迟: 1.2s  │
└─────────────────────────────────────────────────────────────────┘
```

## 4. 组件设计

### 4.1 核心组件

```typescript
// 实时状态指示器
interface StatusIndicatorProps {
  status: 'running' | 'idle' | 'error' | 'success';
  label: string;
  pulse?: boolean;
}

// 进度条
interface ProgressBarProps {
  progress: number;  // 0-100
  stage: string;
  subStages?: Array<{ name: string; status: StageStatus }>;
}

// 项目卡片
interface ProjectCardProps {
  project: Project;
  actions: ProjectAction[];
  onClick?: () => void;
}

// 创意卡片
interface IdeaCardProps {
  idea: Idea;
  onAccept?: () => void;
  onReject?: () => void;
  onViewDetails?: () => void;
}

// Agent状态面板
interface AgentStatusPanelProps {
  agents: AgentStatus[];
  currentAgent?: string;
}

// 知识搜索框
interface KnowledgeSearchProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  suggestions?: string[];
}

// 趋势图表
interface TrendChartProps {
  data: TrendDataPoint[];
  timeRange: 'hour' | 'day' | 'week' | 'month';
  metric: 'projects' | 'quality' | 'tokens' | 'errors';
}
```

### 4.2 布局组件

```typescript
// 主布局
interface MainLayoutProps {
  sidebar: React.ReactNode;
  header: React.ReactNode;
  children: React.ReactNode;
}

// 仪表盘布局
interface DashboardLayoutProps {
  widgets: DashboardWidget[];
  columns?: 2 | 3 | 4;
}

// 详情页布局
interface DetailLayoutProps {
  header: React.ReactNode;
  tabs?: TabItem[];
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}
```

## 5. 状态管理设计

### 5.1 全局状态 (Zustand)

```typescript
// 系统状态
interface SystemStore {
  // 状态
  isRunning: boolean;
  currentStage: ProjectStage;
  activeProjects: Project[];
  systemMetrics: SystemMetrics;

  // Actions
  startSystem: () => void;
  stopSystem: () => void;
  updateMetrics: (metrics: SystemMetrics) => void;
}

// 项目状态
interface ProjectStore {
  // 状态
  projects: Project[];
  currentProject: Project | null;
  filters: ProjectFilters;
  sortBy: ProjectSortKey;

  // Actions
  loadProjects: () => Promise<void>;
  selectProject: (id: string) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => Promise<void>;
}

// 通知状态
interface NotificationStore {
  // 状态
  notifications: Notification[];
  unreadCount: number;

  // Actions
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
}
```

### 5.2 服务端状态 (React Query)

```typescript
// 项目数据
const useProjects = (filters: ProjectFilters) => {
  return useQuery({
    queryKey: ['projects', filters],
    queryFn: () => api.getProjects(filters),
    refetchInterval: 5000, // 5秒刷新
  });
};

// 创意数据
const useIdeas = () => {
  return useQuery({
    queryKey: ['ideas'],
    queryFn: () => api.getIdeas(),
    refetchInterval: 3000,
  });
};

// 知识库搜索
const useKnowledgeSearch = (query: string) => {
  return useQuery({
    queryKey: ['knowledge', 'search', query],
    queryFn: () => api.searchKnowledge(query),
    enabled: query.length > 2,
  });
};
```

## 6. 实时通信设计

### 6.1 WebSocket连接

```typescript
// WebSocket服务
class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // 连接
  connect(url: string): void;

  // 订阅
  subscribe(event: WSEvent, handler: EventHandler): void;
  unsubscribe(event: WSEvent, handler: EventHandler): void;

  // 发送
  send(type: string, payload: unknown): void;

  // 断线重连
  private reconnect(): void;
}

// 事件类型
type WSEvent =
  | 'system:status'        // 系统状态更新
  | 'project:created'      // 项目创建
  | 'project:progress'     // 项目进度更新
  | 'project:completed'    // 项目完成
  | 'project:failed'       // 项目失败
  | 'idea:generated'       // 新创意生成
  | 'agent:started'        // Agent开始执行
  | 'agent:completed'      // Agent完成执行
  | 'metrics:update'       // 指标更新
  | 'notification:new';    // 新通知
```

### 6.2 实时更新Hook

```typescript
const useRealtimeUpdates = () => {
  const { updateProject, updateMetrics } = useProjectStore();
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    const ws = websocketService;

    ws.subscribe('project:progress', (data) => {
      updateProject(data.projectId, data.updates);
    });

    ws.subscribe('metrics:update', (data) => {
      updateMetrics(data.metrics);
    });

    ws.subscribe('notification:new', (data) => {
      addNotification(data.notification);
    });

    return () => ws.disconnect();
  }, []);
};
```

## 7. API设计

### 7.1 REST API客户端

```typescript
// API客户端
const api = {
  // 系统
  system: {
    getStatus: () => GET('/api/system/status'),
    getMetrics: () => GET('/api/system/metrics'),
    start: () => POST('/api/system/start'),
    stop: () => POST('/api/system/stop'),
    updateConfig: (config: Config) => PUT('/api/system/config', config),
  },

  // 项目
  projects: {
    list: (filters?: ProjectFilters) => GET('/api/projects', { params: filters }),
    get: (id: string) => GET(`/api/projects/${id}`),
    create: (ideaId: string) => POST('/api/projects', { ideaId }),
    cancel: (id: string) => POST(`/api/projects/${id}/cancel`),
    retry: (id: string) => POST(`/api/projects/${id}/retry`),
    delete: (id: string) => DELETE(`/api/projects/${id}`),
    getLogs: (id: string) => GET(`/api/projects/${id}/logs`),
    getCode: (id: string) => GET(`/api/projects/${id}/code`),
  },

  // 创意
  ideas: {
    list: (filters?: IdeaFilters) => GET('/api/ideas', { params: filters }),
    get: (id: string) => GET(`/api/ideas/${id}`),
    generate: (params: GenerateParams) => POST('/api/ideas/generate', params),
    accept: (id: string) => POST(`/api/ideas/${id}/accept`),
    reject: (id: string) => POST(`/api/ideas/${id}/reject`),
  },

  // 知识库
  knowledge: {
    search: (query: string) => GET('/api/knowledge/search', { params: { q: query } }),
    list: (type?: KnowledgeType) => GET('/api/knowledge', { params: { type } }),
    get: (id: string) => GET(`/api/knowledge/${id}`),
    create: (knowledge: Knowledge) => POST('/api/knowledge', knowledge),
    update: (id: string, updates: Partial<Knowledge>) => PUT(`/api/knowledge/${id}`, updates),
    delete: (id: string) => DELETE(`/api/knowledge/${id}`),
  },

  // 监控
  monitor: {
    getAgentStatus: () => GET('/api/monitor/agents'),
    getLLMStats: (range: TimeRange) => GET('/api/monitor/llm', { params: range }),
    getResourceUsage: () => GET('/api/monitor/resources'),
  },
};
```

## 8. 样式与主题

### 8.1 设计系统

```typescript
// 颜色系统
const colors = {
  // 品牌色
  primary: {
    50: '#f0f9ff',
    500: '#3b82f6',
    900: '#1e3a8a',
  },
  // 状态色
  success: '#22c55e',
  warning: '#eab308',
  error: '#ef4444',
  info: '#3b82f6',
  // 中性色
  gray: { ... },
};

// 间距系统
const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
};

// 字体系统
const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'Consolas', 'monospace'],
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
  },
};
```

### 8.2 暗色主题支持

```typescript
// 主题配置
const themes = {
  light: {
    background: '#ffffff',
    foreground: '#0f172a',
    card: '#ffffff',
    border: '#e2e8f0',
    muted: '#64748b',
  },
  dark: {
    background: '#0f172a',
    foreground: '#f8fafc',
    card: '#1e293b',
    border: '#334155',
    muted: '#94a3b8',
  },
};
```

## 9. 性能优化策略

### 9.1 代码分割

```typescript
// 路由懒加载
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Projects = lazy(() => import('./pages/Projects'));
const Knowledge = lazy(() => import('./pages/Knowledge'));
const Monitor = lazy(() => import('./pages/Monitor'));
```

### 9.2 虚拟列表

```typescript
// 长列表虚拟化
import { VirtualList } from '@tanstack/react-virtual';

const ProjectList = ({ projects }: { projects: Project[] }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: projects.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // 每行高度
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      {/* 虚拟列表实现 */}
    </div>
  );
};
```

### 9.3 缓存策略

- React Query缓存：数据缓存5秒-1分钟
- 本地存储：用户偏好设置持久化
- Service Worker：静态资源缓存

## 10. 测试策略

### 10.1 单元测试

- 组件测试：Vitest + Testing Library
- Hook测试：@testing-library/react-hooks
- Store测试：直接调用actions断言

### 10.2 集成测试

- API Mock：MSW (Mock Service Worker)
- WebSocket Mock：自定义Mock实现
- E2E：Playwright

## 11. 构建与部署

### 11.1 构建配置

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
});
```

### 11.2 环境配置

```typescript
// .env.development
VITE_API_URL=http://localhost:8888/api
VITE_WS_URL=ws://localhost:8888/ws

// .env.production
VITE_API_URL=/api
VITE_WS_URL=wss://api.example.com/ws
```
