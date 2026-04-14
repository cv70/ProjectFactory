# System Integration Architecture

## 1. 概述

本文档定义 ProjectFactory 系统的集成架构（Integration Architecture），确保前端、后端、各 Agent、数据库、外部服务之间的高效协作与集成。

### 1.1 集成架构概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         系统集成架构                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        前端层 (React)                                 │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  Web App    │  │  Admin UI   │  │  Dashboard  │              │   │
│  │  │  (Next.js)  │  │  Console    │  │             │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │         │                    │                    │                 │   │
│  │         └────────────────────┼────────────────────┘                 │   │
│  │                              │ REST API / WebSocket                   │   │
│  └──────────────────────────────┼───────────────────────────────────────┘   │
│                                 │                                           │
│  ┌──────────────────────────────┼───────────────────────────────────────┐   │
│  │                              ▼                                       │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │                     API Gateway                                 │ │   │
│  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │ │   │
│  │  │  │ Auth   │  │ Rate    │  │ Load    │  │ SSL    │         │ │   │
│  │  │  │ Handler│  │ Limiter │  │Balancer │  │ Term.  │         │ │   │
│  │  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘         │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                              │                                        │   │
│  └──────────────────────────────┼────────────────────────────────────────┘   │
│                                 │                                           │
│  ┌──────────────────────────────┼────────────────────────────────────────┐   │
│  │                              ▼                                        │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │              Orchestration Layer (LangGraph)                    │ │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │ │   │
│  │  │  │  Workflow   │  │  State      │  │  Task      │          │ │   │
│  │  │  │  Engine     │  │  Manager    │  │  Scheduler  │          │ │   │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘          │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                    │                                                   │   │
│  │  ┌─────────────────┼─────────────────┐                               │   │
│  │  ▼                 ▼                 ▼                               │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐             │   │
│  │  │ Idea    │  │Architect│  │ Coder   │  │ Tester  │             │   │
│  │  │Generator │  │ Agent   │  │ Agent   │  │ Agent   │             │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘             │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐             │   │
│  │  │Reviewer │  │Optimizer│  │ Git     │  │ Deploy  │             │   │
│  │  │ Agent   │  │ Agent   │  │ Agent   │  │ Agent   │             │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘             │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                 │                                           │
│  ┌─────────────────────────────┼─────────────────────────────────────────┐ │
│  │                             ▼                                         │ │
│  │  ┌────────────────────────────────────────────────────────────────┐ │ │
│  │  │                      Data Layer                                 │ │ │
│  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │ │ │
│  │  │  │ SQLite  │  │ Vector  │  │ File    │  │ Cache   │         │ │ │
│  │  │  │(Primary)│  │ Store   │  │ Storage │  │ (Redis) │         │ │ │
│  │  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘         │ │ │
│  │  └────────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 前端后端集成

### 2.1 API 集成层

```typescript
// API 客户端配置
interface APIClientConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  headers: Record<string, string>;
}

// API 路由定义
const apiRoutes = {
  // 认证
  auth: {
    login: 'POST /api/v1/auth/login',
    logout: 'POST /api/v1/auth/logout',
    refresh: 'POST /api/v1/auth/refresh',
    me: 'GET /api/v1/auth/me'
  },

  // 项目
  projects: {
    list: 'GET /api/v1/projects',
    create: 'POST /api/v1/projects',
    get: 'GET /api/v1/projects/:id',
    update: 'PUT /api/v1/projects/:id',
    delete: 'DELETE /api/v1/projects/:id',
    status: 'GET /api/v1/projects/:id/status',
    files: 'GET /api/v1/projects/:id/files',
    download: 'GET /api/v1/projects/:id/download'
  },

  // 想法
  ideas: {
    list: 'GET /api/v1/ideas',
    generate: 'POST /api/v1/ideas/generate',
    get: 'GET /api/v1/ideas/:id',
    update: 'PUT /api/v1/ideas/:id',
    delete: 'DELETE /api/v1/ideas/:id',
    convert: 'POST /api/v1/ideas/:id/convert'
  },

  // 模板
  templates: {
    list: 'GET /api/v1/templates',
    get: 'GET /api/v1/templates/:id',
    create: 'POST /api/v1/templates',
    update: 'PUT /api/v1/templates/:id'
  },

  // 任务
  tasks: {
    list: 'GET /api/v1/tasks',
    get: 'GET /api/v1/tasks/:id',
    cancel: 'POST /api/v1/tasks/:id/cancel',
    retry: 'POST /api/v1/tasks/:id/retry'
  },

  // 监控
  monitoring: {
    metrics: 'GET /api/v1/monitoring/metrics',
    health: 'GET /api/v1/monitoring/health',
    logs: 'GET /api/v1/monitoring/logs'
  }
};

// API 客户端类
class APIClient {
  private config: APIClientConfig;
  private token: string | null;

  constructor(config: APIClientConfig) {
    this.config = config;
    this.token = localStorage.getItem('token');
  }

  // 设置认证令牌
  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('token', token);
  }

  // 清除认证令牌
  clearToken(): void {
    this.token = null;
    localStorage.removeItem('token');
  }

  // GET 请求
  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('GET', url, { params });
  }

  // POST 请求
  async post<T>(url: string, data?: unknown): Promise<T> {
    return this.request<T>('POST', url, { data });
  }

  // 请求核心方法
  private async request<T>(
    method: string,
    url: string,
    options: { params?: Record<string, unknown>; data?: unknown }
  ): Promise<T> {
    const { params, data } = options;

    // 构建 URL
    let fullUrl = `${this.config.baseURL}${url}`;
    if (params) {
      const queryString = new URLSearchParams(
        params as Record<string, string>
      ).toString();
      fullUrl += `?${queryString}`;
    }

    // 构建请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // 发送请求
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const response = await fetch(fullUrl, {
          method,
          headers,
          body: data ? JSON.stringify(data) : undefined
        });

        if (!response.ok) {
          const error = await response.json();
          throw new APIError(response.status, error.message, error);
        }

        return response.json();
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.config.retries) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError;
  }
}

// API 错误类
class APIError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}
```

### 2.2 WebSocket 实时通信

```typescript
// WebSocket 服务配置
interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
}

// WebSocket 服务
class WebSocketService {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectAttempts = 0;
  private heartbeatTimer: number | null = null;
  private listeners: Map<string, Set<EventListener>> = new Map();

  constructor(config: WebSocketConfig) {
    this.config = config;
  }

  // 连接
  connect(token: string): void {
    const url = `${this.config.url}?token=${token}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.stopHeartbeat();
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  // 订阅事件
  subscribe(event: string, listener: EventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  // 发送消息
  send(event: string, data?: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data }));
    }
  }

  // 处理消息
  private handleMessage(data: string): void {
    try {
      const { event, payload } = JSON.parse(data);

      const listeners = this.listeners.get(event);
      if (listeners) {
        listeners.forEach(listener => listener(payload));
      }

      // 全局事件
      const globalListeners = this.listeners.get('*');
      if (globalListeners) {
        globalListeners.forEach(listener => listener({ event, payload }));
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  // 重连
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
      // 需要重新获取 token
      const token = localStorage.getItem('token');
      if (token) {
        this.connect(token);
      }
    }, delay);
  }

  // 心跳
  private startHeartbeat(): void {
    this.heartbeatTimer = window.setInterval(() => {
      this.send('ping');
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 事件类型定义
interface WSClientEvent {
  // 项目事件
  'project:created': { projectId: string; name: string };
  'project:updated': { projectId: string; changes: Record<string, unknown> };
  'project:status': { projectId: string; status: ProjectStatus };
  'project:completed': { projectId: string; qualityScore: number };

  // 任务事件
  'task:assigned': { taskId: string; agentId: string };
  'task:progress': { taskId: string; progress: number };
  'task:completed': { taskId: string; result: unknown };
  'task:failed': { taskId: string; error: string };

  // 生成事件
  'generation:started': { generationId: string };
  'generation:progress': { generationId: string; phase: string; progress: number };
  'generation:completed': { generationId: string; output: unknown };
  'generation:failed': { generationId: string; error: string };

  // 通知事件
  'notification': { type: string; message: string; data?: unknown };
}
```

### 2.3 状态管理集成

```typescript
// 全局状态管理
interface GlobalState {
  // 认证状态
  auth: {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
  };

  // 项目状态
  projects: {
    items: Project[];
    current: Project | null;
    loading: boolean;
    error: string | null;
  };

  // 生成状态
  generation: {
    active: boolean;
    currentTask: string | null;
    progress: number;
    logs: LogEntry[];
  };

  // UI 状态
  ui: {
    sidebarOpen: boolean;
    theme: 'light' | 'dark';
    notifications: Notification[];
  };
}

// 状态管理器
class StateManager {
  private state: GlobalState;
  private listeners: Set<StateListener> = new Set();
  private history: GlobalState[] = [];

  constructor(initialState: GlobalState) {
    this.state = initialState;
  }

  // 获取状态
  getState<K extends keyof GlobalState>(key: K): GlobalState[K] {
    return this.state[key];
  }

  // 更新状态
  setState<K extends keyof GlobalState>(
    key: K,
    value: Partial<GlobalState[K]> | ((prev: GlobalState[K]) => Partial<GlobalState[K]>)
  ): void {
    const prev = this.state[key];

    const partial = typeof value === 'function'
      ? value(prev)
      : value;

    this.state[key] = { ...prev, ...partial };

    // 记录历史
    this.history.push(JSON.parse(JSON.stringify(this.state)));

    // 通知监听器
    this.notify(key, this.state[key], prev);
  }

  // 订阅状态变更
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify<K extends keyof GlobalState>(
    key: K,
    current: GlobalState[K],
    prev: GlobalState[K]
  ): void {
    this.listeners.forEach(listener => {
      listener(key, current, prev);
    });
  }

  // 回滚状态
  undo(): boolean {
    if (this.history.length < 2) return false;

    this.history.pop(); // 移除当前状态
    this.state = JSON.parse(JSON.stringify(this.history[this.history.length - 1]));

    return true;
  }
}

// React Hook 集成
function useGlobalState<K extends keyof GlobalState>(key: K) {
  const stateManager = useContext(StateManagerContext);

  const state = stateManager.getState(key);

  const setState = useCallback(
    (value: Partial<GlobalState[K]> | ((prev: GlobalState[K]) => Partial<GlobalState[K]>)) => {
      stateManager.setState(key, value);
    },
    [key, stateManager]
  );

  return [state, setState] as const;
}
```

---

## 3. Agent 协作集成

### 3.1 Agent 通信协议

```typescript
// Agent 消息协议
interface AgentMessage {
  id: string;
  type: AgentMessageType;
  sender: string;
  receivers: string[];
  content: AgentContent;
  metadata: {
    conversationId: string;
    replyTo?: string;
    timestamp: Date;
    expiresAt?: Date;
  };
}

// 消息类型
enum AgentMessageType {
  // 任务消息
  TASK_REQUEST = 'TASK_REQUEST',
  TASK_RESPONSE = 'TASK_RESPONSE',
  TASK_PROGRESS = 'TASK_PROGRESS',
  TASK_CANCEL = 'TASK_CANCEL',

  // 协作消息
  CONSULT = 'CONSULT',
  CONSULT_RESPONSE = 'CONSULT_RESPONSE',
  PROPOSE = 'PROPOSE',
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',

  // 信息消息
  QUERY = 'QUERY',
  QUERY_RESPONSE = 'QUERY_RESPONSE',
  SHARE = 'SHARE',
  NOTIFY = 'NOTIFY',

  // 同步消息
  SYNC_REQUEST = 'SYNC_REQUEST',
  SYNC_RESPONSE = 'SYNC_RESPONSE',
  HEARTBEAT = 'HEARTBEAT'
}

// Agent 内容
interface AgentContent {
  intent: string;
  taskId?: string;
  data: unknown;
  attachments?: Attachment[];
}

// Agent 通信服务
class AgentCommunicationService {
  private messageBus: MessageBus;
  private agentRegistry: AgentRegistry;

  // 发送消息
  async send(message: Omit<AgentMessage, 'id' | 'timestamp'>): Promise<void> {
    const fullMessage: AgentMessage = {
      ...message,
      id: uuid(),
      timestamp: new Date()
    };

    await this.messageBus.publish(fullMessage);
  }

  // 请求任务执行
  async requestTask(
    agentId: string,
    task: Task
  ): Promise<TaskResult> {
    const message: Omit<AgentMessage, 'id' | 'timestamp'> = {
      type: AgentMessageType.TASK_REQUEST,
      sender: 'orchestrator',
      receivers: [agentId],
      content: {
        intent: 'EXECUTE_TASK',
        taskId: task.id,
        data: task
      }
    };

    await this.send(message);

    // 等待响应
    return this.waitForResponse<TaskResult>(task.id);
  }

  // 咨询 Agent
  async consult(
    agentId: string,
    question: string,
    context?: unknown
  ): Promise<string> {
    const conversationId = uuid();

    const message: Omit<AgentMessage, 'id' | 'timestamp'> = {
      type: AgentMessageType.CONSULT,
      sender: 'orchestrator',
      receivers: [agentId],
      content: {
        intent: 'REQUEST_ADVICE',
        data: { question, context }
      },
      metadata: {
        conversationId
      }
    };

    await this.send(message);

    // 等待响应
    const response = await this.waitForResponse<{ answer: string }>(conversationId);
    return response.answer;
  }

  // 广播消息
  async broadcast(
    type: AgentMessageType,
    data: unknown,
    receivers?: string[]
  ): Promise<void> {
    const allAgents = receivers || this.agentRegistry.getAllAgentIds();

    const message: Omit<AgentMessage, 'id' | 'timestamp'> = {
      type,
      sender: 'orchestrator',
      receivers: allAgents,
      content: {
        intent: 'BROADCAST',
        data
      }
    };

    await this.send(message);
  }

  // 等待响应
  private waitForResponse<T>(correlationId: string, timeout = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.messageBus.unsubscribe(correlationId);
        reject(new Error(`Timeout waiting for response: ${correlationId}`));
      }, timeout);

      this.messageBus.subscribe(correlationId, (message: AgentMessage) => {
        clearTimeout(timeoutId);
        resolve(message.content.data as T);
      });
    });
  }
}
```

### 3.2 任务分发集成

```typescript
// 任务分发器
class TaskDistributor {
  private agentRegistry: AgentRegistry;
  private loadBalancer: LoadBalancer;
  private taskQueue: PriorityQueue<Task>;

  // 分发任务
  async distribute(task: Task): Promise<DispatchResult> {
    // 1. 查找合适的 Agent
    const candidates = await this.findCandidates(task);

    if (candidates.length === 0) {
      return { success: false, reason: 'No available agents' };
    }

    // 2. 负载均衡选择
    const selectedAgent = this.loadBalancer.select(candidates, task);

    // 3. 分发任务
    try {
      await this.assignTask(selectedAgent, task);

      return {
        success: true,
        agentId: selectedAgent.id,
        estimatedCompletion: this.estimateCompletion(task, selectedAgent)
      };
    } catch (error) {
      // 任务分发失败，尝试其他 Agent
      const remaining = candidates.filter(a => a.id !== selectedAgent.id);

      if (remaining.length > 0) {
        return this.distribute(task); // 递归重试
      }

      return { success: false, reason: 'All agents failed' };
    }
  }

  // 查找候选 Agent
  private async findCandidates(task: Task): Promise<Agent[]> {
    const allAgents = this.agentRegistry.getAllAgents();

    return allAgents.filter(agent => {
      // 检查能力匹配
      if (!this.canHandleTask(agent, task)) {
        return false;
      }

      // 检查可用性
      if (!this.isAvailable(agent)) {
        return false;
      }

      // 检查资源
      if (!this.hasResources(agent, task)) {
        return false;
      }

      return true;
    });
  }

  // 分配任务
  private async assignTask(agent: Agent, task: Task): Promise<void> {
    await agent.receive({
      type: 'TASK_ASSIGN',
      task,
      priority: task.priority,
      deadline: task.deadline
    });

    // 更新 Agent 状态
    agent.status = 'busy';
    agent.currentTask = task.id;
    agent.load++;
  }
}
```

### 3.3 结果聚合

```typescript
// 结果聚合器
class ResultAggregator {
  // 聚合多个 Agent 的结果
  aggregate<T>(
    results: AgentResult<T>[],
    strategy: AggregationStrategy
  ): AggregatedResult<T> {
    switch (strategy) {
      case 'majority':
        return this.majorityVote(results);

      case 'weighted':
        return this.weightedAggregation(results);

      case 'consensus':
        return this.findConsensus(results);

      case 'best':
        return this.selectBest(results);

      default:
        return this.majorityVote(results);
    }
  }

  // 多数投票
  private majorityVote<T>(results: AgentResult<T>[]): AggregatedResult<T> {
    const votes = new Map<string, { value: T; count: number }>();

    for (const result of results) {
      const key = JSON.stringify(result.value);
      const existing = votes.get(key);

      if (existing) {
        existing.count++;
      } else {
        votes.set(key, { value: result.value, count: 1 });
      }
    }

    let maxCount = 0;
    let winner: T = results[0].value;

    for (const [, { value, count }] of votes) {
      if (count > maxCount) {
        maxCount = count;
        winner = value;
      }
    }

    return {
      value: winner,
      agreement: maxCount / results.length,
      details: Object.fromEntries(votes)
    };
  }

  // 加权聚合
  private weightedAggregation<T extends { score?: number }>(
    results: AgentResult<T>[]
  ): AggregatedResult<T> {
    let totalWeight = 0;
    let weightedSum = 0;
    let bestValue: T = results[0].value;
    let bestScore = results[0].value.score || 0;

    for (const result of results) {
      const weight = result.agent.weight || 1;
      const score = result.value.score || 0;

      weightedSum += score * weight;
      totalWeight += weight;

      if (score > bestScore) {
        bestScore = score;
        bestValue = result.value;
      }
    }

    return {
      value: bestValue,
      agreement: weightedSum / totalWeight,
      details: { weightedAverage: weightedSum / totalWeight }
    };
  }
}
```

---

## 4. 数据库集成

### 4.1 SQLite 集成

```typescript
// 数据库管理器
class DatabaseManager {
  private db: Database;
  private migrations: Migration[] = [];

  // 初始化
  async initialize(): Promise<void> {
    this.db = await open({
      filename: './data/project-factory.db',
      driver: better_sqlite3.Database
    });

    // 启用外键
    this.db.exec('PRAGMA foreign_keys = ON');

    // 运行迁移
    await this.runMigrations();
  }

  // 执行查询
  async query<T>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...(params || [])) as T[];
  }

  // 执行单个查询
  async queryOne<T>(
    sql: string,
    params?: unknown[]
  ): Promise<T | null> {
    const stmt = this.db.prepare(sql);
    return stmt.get(...(params || [])) as T | null;
  }

  // 执行插入
  async insert(
    table: string,
    data: Record<string, unknown>
  ): Promise<number> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map(() => '?').join(', ');

    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

    const stmt = this.db.prepare(sql);
    const result = stmt.run(...values);

    return result.lastInsertRowid as number;
  }

  // 执行更新
  async update(
    table: string,
    data: Record<string, unknown>,
    where: string,
    whereParams?: unknown[]
  ): Promise<number> {
    const setClause = Object.keys(data)
      .map(key => `${key} = ?`)
      .join(', ');

    const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`;

    const stmt = this.db.prepare(sql);
    const result = stmt.run(...Object.values(data), ...(whereParams || []));

    return result.changes;
  }

  // 事务
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.db.transaction(fn)();
  }
}

// 数据访问对象基类
abstract class BaseDAO<T> {
  constructor(
    protected db: DatabaseManager,
    protected tableName: string
  ) {}

  async findById(id: string): Promise<T | null> {
    return this.db.queryOne<T>(
      `SELECT * FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
  }

  async findAll(limit = 100, offset = 0): Promise<T[]> {
    return this.db.query<T>(
      `SELECT * FROM ${this.tableName} LIMIT ? OFFSET ?`,
      [limit, offset]
    );
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const id = uuid();
    const now = new Date().toISOString();

    await this.db.insert(this.tableName, {
      id,
      ...data,
      createdAt: now,
      updatedAt: now
    });

    return this.findById(id) as Promise<T>;
  }

  async update(id: string, data: Partial<T>): Promise<void> {
    await this.db.update(
      this.tableName,
      { ...data, updatedAt: new Date().toISOString() },
      'id = ?',
      [id]
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.query(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
  }
}
```

### 4.2 向量存储集成

```typescript
// 向量存储服务
class VectorStore {
  private client: LanceDB;

  // 初始化
  async initialize(): Promise<void> {
    this.client = await lance.connect('./data/vectors');
  }

  // 存储向量
  async store(vectors: VectorEntry[]): Promise<void> {
    const table = await this.client.openTable('embeddings');

    await table.add(vectors.map(v => ({
      id: v.id,
      values: v.embedding,
      metadata: JSON.stringify(v.metadata),
      document: v.document
    })));
  }

  // 相似度搜索
  async search(
    query: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const table = await this.client.openTable('embeddings');

    const results = await table
      .search(query)
      .limit(options.limit || 10)
      .where(options.filter || 'true')
      .execute();

    return results.map(r => ({
      id: r.id,
      score: r.score,
      document: r.document,
      metadata: JSON.parse(r.metadata)
    }));
  }

  // 语义搜索
  async semanticSearch(
    text: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    // 1. 文本转向量
    const embedding = await this.embeddingService.encode(text);

    // 2. 向量搜索
    return this.search(embedding, options);
  }
}

// 向量条目
interface VectorEntry {
  id: string;
  embedding: number[];
  document: string;
  metadata: Record<string, unknown>;
}
```

### 4.3 缓存集成

```typescript
// 缓存服务
class CacheService {
  private redis: Redis;
  private defaultTTL = 3600; // 1小时

  constructor(redis: Redis) {
    this.redis = redis;
  }

  // 获取
  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  // 设置
  async set<T>(
    key: string,
    value: T,
    ttl?: number
  ): Promise<void> {
    const serialized = JSON.stringify(value);
    await this.redis.set(key, serialized, 'EX', ttl || this.defaultTTL);
  }

  // 删除
  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  // 模式删除
  async deletePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // 缓存代理
  cached<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    options: CacheOptions = {}
  ): T {
    return (async (...args: Parameters<T>) => {
      const key = options.keyGenerator
        ? options.keyGenerator(...args)
        : `${fn.name}:${JSON.stringify(args)}`;

      // 尝试获取缓存
      const cached = await this.get(key);
      if (cached !== null) {
        return cached;
      }

      // 执行函数
      const result = await fn(...args);

      // 缓存结果
      await this.set(key, result, options.ttl);

      return result;
    }) as T;
  }
}

// 缓存选项
interface CacheOptions {
  ttl?: number;
  keyGenerator?: (...args: unknown[]) => string;
}
```

---

## 5. 外部服务集成

### 5.1 LLM 服务集成

```typescript
// LLM 服务配置
interface LLMServiceConfig {
  provider: 'openai' | 'anthropic' | 'local' | 'azure';
  apiKey?: string;
  endpoint?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
}

// LLM 服务
class LLMService {
  private config: LLMServiceConfig;
  private client: OpenAI | Anthropic;

  constructor(config: LLMServiceConfig) {
    this.config = config;
    this.client = this.createClient(config);
  }

  // 聊天完成
  async chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
    try {
      const response = await this.client.chat.complete({
        model: options?.model || this.config.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        temperature: options?.temperature ?? this.config.temperature,
        max_tokens: options?.maxTokens ?? this.config.maxTokens
      });

      return {
        content: response.choices[0]?.message?.content || '',
        usage: response.usage,
        model: response.model
      };
    } catch (error) {
      throw new LLMError('Chat completion failed', error);
    }
  }

  // 结构化输出
  async structuredOutput<T>(
    messages: ChatMessage[],
    schema: z.ZodSchema<T>
  ): Promise<T> {
    const response = await this.chat(messages);

    try {
      return schema.parse(JSON.parse(response.content));
    } catch (error) {
      throw new LLMError('Failed to parse structured output', error);
    }
  }

  // 流式输出
  async *streamChat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncGenerator<string> {
    const stream = await this.client.chat.stream({
      model: options?.model || this.config.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      temperature: options?.temperature ?? this.config.temperature,
      max_tokens: options?.maxTokens ?? this.config.maxTokens
    });

    for await (const chunk of stream) {
      yield chunk.choices[0]?.delta?.content || '';
    }
  }
}

// LLM 错误
class LLMError extends Error {
  constructor(
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'LLMError';
  }
}
```

### 5.2 Git 服务集成

```typescript
// Git 服务
class GitService {
  private client: simpleGit;

  // 初始化仓库
  async initRepo(path: string): Promise<void> {
    await this.client.init(path);
  }

  // 克隆仓库
  async clone(url: string, path: string): Promise<void> {
    await this.client.clone(url, path);
  }

  // 提交更改
  async commit(
    path: string,
    message: string,
    files?: string[]
  ): Promise<string> {
    const git = simpleGit(path);

    if (files && files.length > 0) {
      await git.add(files);
    } else {
      await git.add('.');
    }

    const result = await git.commit(message);
    return result.commit;
  }

  // 创建分支
  async createBranch(path: string, branchName: string): Promise<void> {
    const git = simpleGit(path);
    await git.checkoutLocalBranch(branchName);
  }

  // 切换分支
  async checkout(path: string, branchName: string): Promise<void> {
    const git = simpleGit(path);
    await git.checkout(branchName);
  }

  // 合并分支
  async merge(
    path: string,
    branchName: string,
    options?: { noFF?: boolean; message?: string }
  ): Promise<MergeResult> {
    const git = simpleGit(path);
    const result = await git.merge([branchName]);

    return {
      success: result.result === 'success',
      fastForward: result.fastForward,
      commits: result.insertions || 0,
      deletions: result.deletions || 0
    };
  }

  // 获取状态
  async status(path: string): Promise<RepoStatus> {
    const git = simpleGit(path);
    const status = await git.status();

    return {
      isClean: status.isClean(),
      current: status.current,
      tracking: status.tracking,
      staged: status.staged,
      modified: status.modified,
      files: [...status.staged, ...status.modified, ...status.not_added]
    };
  }

  // 推送
  async push(
    path: string,
    remote?: string,
    branch?: string
  ): Promise<void> {
    const git = simpleGit(path);
    await git.push(remote || 'origin', branch || 'main');
  }

  // 拉取
  async pull(path: string): Promise<void> {
    const git = simpleGit(path);
    await git.pull();
  }
}
```

### 5.3 云存储集成

```typescript
// 云存储服务
class CloudStorageService {
  private client: S3Client;
  private bucket: string;

  constructor(config: StorageConfig) {
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
    this.bucket = config.bucket;
  }

  // 上传文件
  async upload(
    key: string,
    body: Buffer | string,
    options?: UploadOptions
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: options?.contentType,
      Metadata: options?.metadata
    });

    await this.client.send(command);

    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }

  // 下载文件
  async download(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    });

    const response = await this.client.send(command);
    const stream = response.Body as Readable;

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  // 删除文件
  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key
    });

    await this.client.send(command);
  }

  // 生成预签名 URL
  async getPresignedUrl(
    key: string,
    expiresIn = 3600
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }
}
```

---

## 6. 监控与日志集成

### 6.1 监控指标导出

```typescript
// Prometheus 指标
class MetricsExporter {
  private registry: Registry;
  private httpServer: http.Server;

  constructor(port = 9090) {
    this.registry = new Registry();

    // 注册默认指标
    this.registerDefaultMetrics();

    // 启动 HTTP 服务器
    this.httpServer = http.createServer(async (req, res) => {
      if (req.url === '/metrics') {
        res.setHeader('Content-Type', this.registry.contentType);
        res.end(await this.registry.metrics());
      }
    });

    this.httpServer.listen(port);
  }

  // 注册默认指标
  private registerDefaultMetrics(): void {
    // HTTP 请求计数器
    const httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'path', 'status']
    });
    this.registry.registerMetric(httpRequestsTotal);

    // HTTP 请求延迟
    const httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration',
      labelNames: ['method', 'path'],
      buckets: [0.1, 0.3, 0.5, 1, 3, 5, 10]
    });
    this.registry.registerMetric(httpRequestDuration);

    // 生成任务计数器
    const generationTasksTotal = new Counter({
      name: 'generation_tasks_total',
      help: 'Total generation tasks',
      labelNames: ['type', 'status']
    });
    this.registry.registerMetric(generationTasksTotal);

    // Agent 执行延迟
    const agentExecutionDuration = new Histogram({
      name: 'agent_execution_duration_seconds',
      help: 'Agent execution duration',
      labelNames: ['agent', 'task_type'],
      buckets: [1, 5, 10, 30, 60, 120, 300]
    });
    this.registry.registerMetric(agentExecutionDuration);

    // 队列深度
    const queueDepth = new Gauge({
      name: 'task_queue_depth',
      help: 'Current task queue depth',
      labelNames: ['queue']
    });
    this.registry.registerMetric(queueDepth);
  }

  // 记录 HTTP 请求
  recordHttpRequest(
    method: string,
    path: string,
    status: number,
    duration: number
  ): void {
    const counter = this.registry.getMetric('http_requests_total') as Counter;
    counter.inc({ method, path, status: String(status) });

    const histogram = this.registry.getMetric('http_request_duration_seconds') as Histogram;
    histogram.observe({ method, path }, duration);
  }
}
```

### 6.2 日志集成

```typescript
// 日志服务
class LogService {
  private logger: Logger;
  private transports: Transport[];

  constructor(config: LogConfig) {
    this.transports = [
      // 控制台输出
      new ConsoleTransport({
        level: config.level,
        format: format.combine(
          format.timestamp(),
          format.colorize(),
          format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
          })
        )
      }),

      // 文件输出
      new FileTransport({
        level: 'info',
        filename: './logs/app.log',
        maxSize: '10m',
        maxFiles: 5
      }),

      // 错误日志
      new FileTransport({
        level: 'error',
        filename: './logs/error.log',
        maxSize: '10m',
        maxFiles: 5
      })
    ];

    this.logger = createLogger({
      level: config.level,
      transports: this.transports
    });
  }

  // 记录日志
  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    this.logger.error(message, { error: error?.stack, ...meta });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, meta);
  }

  // 结构化日志
  log(level: string, message: string, meta?: Record<string, unknown>): void {
    this.logger.log({ level, message, ...meta });
  }

  // 请求日志中间件
  requestLogger(): RequestHandler {
    return (req, res, next) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - start;
        this.info('HTTP Request', {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration,
          userAgent: req.get('User-Agent')
        });
      });

      next();
    };
  }
}
```

---

## 7. 相关文档

- [后端详细设计](./BACKEND_DESIGN.md)
- [前端详细设计](./FRONTEND_DESIGN.md)
- [Agent 协作框架](./AGENT_COLLABORATION_FRAMEWORK.md)
- [可观测性设计](./OBSERVABILITY.md)

---

**最后更新**: 2026-04-14
