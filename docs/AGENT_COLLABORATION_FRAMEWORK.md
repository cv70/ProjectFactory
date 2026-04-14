# Agent 协作框架

## 1. 概述

本文档定义 ProjectFactory 系统中多 Agent 协作框架的设计，解决 think.md 中提出的"多 Agent 协作机制"问题，实现高效、智能的 Agent 协作体系。

### 1.1 协作框架架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Agent 协作框架                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        协作管理层                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │   │
│  │  │  任务分解器   │  │   协调器     │  │   冲突解决    │            │   │
│  │  │ Task Splitter │  │ Coordinator  │  │ Resolver    │            │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────┼─────────────────────────────────┐   │
│  │                                 ▼                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                      通信层 (Message Bus)                    │   │   │
│  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │   │   │
│  │  │  │ Direct  │  │ Publish │  │ Request │  │  Event  │        │   │   │
│  │  │  │ Message │  │/Subscribe│ │ Response│ │ Stream  │        │   │   │
│  │  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────┼─────────────────────────────────┐   │
│  │                            Agent 池                                  │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │   │
│  │  │  Idea   │  │Architect│  │  Coder  │  │ Tester  │  │Reviewer │   │   │
│  │  │Generator│  │  Agent  │  │  Agent  │  │  Agent  │  │  Agent  │   │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘   │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │   │
│  │  │Optimizer│  │  Git    │  │Deployer │  │Monitor  │  │ Meta    │   │   │
│  │  │  Agent  │  │  Agent  │  │  Agent  │  │  Agent  │  │ Agent   │   │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        共享上下文                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │   知识库     │  │   状态存储    │  │   记忆系统    │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 协作模式概览

```typescript
// 协作模式类型
enum CollaborationMode {
  SEQUENTIAL = 'sequential',       // 顺序执行
  PARALLEL = 'parallel',          // 并行执行
  PIPELINE = 'pipeline',          // 流水线
  HIERARCHICAL = 'hierarchical',  // 层级协作
  CONSENSUS = 'consensus',        // 共识决策
  SUPERVISOR = 'supervisor'       // 监督者模式
}

// Agent 角色
enum AgentRole {
  INITIATOR = 'initiator',         // 发起者
  PARTICIPANT = 'participant',     // 参与者
  COORDINATOR = 'coordinator',    // 协调者
  SUPERVISOR = 'supervisor',      // 监督者
  REVIEWER = 'reviewer',          // 审核者
  EXECUTOR = 'executor'           // 执行者
}

// 协作配置
interface CollaborationConfig {
  mode: CollaborationMode;
  timeout: number;                // 超时时间 (ms)
  maxRetries: number;             // 最大重试次数
  consensusThreshold: number;     // 共识阈值 (0-1)
  enableConflictResolution: boolean;
  enableProgressTracking: boolean;
}
```

---

## 2. 任务分解与分发

### 2.1 任务分解策略

```typescript
// 任务结构
interface Task {
  id: string;
  type: TaskType;
  description: string;
  input: unknown;
  outputType: string;
  constraints: TaskConstraints;
  dependencies: string[];         // 依赖的任务 ID
  parentId?: string;              // 父任务 ID
  children?: string[];           // 子任务 ID
  status: TaskStatus;
  assignedAgent?: string;
  result?: TaskResult;
}

// 任务类型
enum TaskType {
  // 想法相关
  IDEA_GENERATION = 'idea-generation',
  IDEA_EVALUATION = 'idea-evaluation',
  IDEA_REFINEMENT = 'idea-refinement',

  // 架构相关
  ARCHITECTURE_DESIGN = 'architecture-design',
  ARCHITECTURE_REVIEW = 'architecture-review',

  // 编码相关
  CODE_GENERATION = 'code-generation',
  CODE_REFACTORING = 'code-refactoring',
  CODE_OPTIMIZATION = 'code-optimization',

  // 测试相关
  TEST_GENERATION = 'test-generation',
  TEST_EXECUTION = 'test-execution',
  TEST_ANALYSIS = 'test-analysis',

  // 审查相关
  CODE_REVIEW = 'code-review',
  QUALITY_ASSESSMENT = 'quality-assessment',
  SECURITY_SCAN = 'security-scan',

  // 部署相关
  BUILD = 'build',
  DEPLOY = 'deploy',
  MONITOR = 'monitor',

  // 协调相关
  COORDINATION = 'coordination',
  DECISION = 'decision'
}

// 任务分解器
class TaskDecomposer {
  decompose(
    goal: string,
    context: ProjectContext
  ): Task[] {
    // 分析目标类型
    const goalType = this.classifyGoal(goal);

    // 选择分解策略
    const strategy = this.selectStrategy(goalType);

    // 执行分解
    const tasks = strategy.decompose(goal, context);

    // 构建依赖图
    const dependencyGraph = this.buildDependencyGraph(tasks);

    // 验证分解完整性
    this.validateDecomposition(tasks, goal);

    return tasks;
  }

  private classifyGoal(goal: string): GoalType {
    // 基于关键词和语义分类目标
    if (goal.includes('create') || goal.includes('generate')) {
      return GoalType.CREATION;
    }
    if (goal.includes('improve') || goal.includes('optimize')) {
      return GoalType.OPTIMIZATION;
    }
    if (goal.includes('fix') || goal.includes('resolve')) {
      return GoalType.FIX;
    }
    if (goal.includes('analyze') || goal.includes('review')) {
      return GoalType.ANALYSIS;
    }
    return GoalType.GENERAL;
  }

  private selectStrategy(goalType: GoalType): DecompositionStrategy {
    const strategies: Record<GoalType, DecompositionStrategy> = {
      [GoalType.CREATION]: new CreationDecompositionStrategy(),
      [GoalType.OPTIMIZATION]: new OptimizationDecompositionStrategy(),
      [GoalType.FIX]: new FixDecompositionStrategy(),
      [GoalType.ANALYSIS]: new AnalysisDecompositionStrategy(),
      [GoalType.GENERAL]: new GeneralDecompositionStrategy()
    };
    return strategies[goalType];
  }
}

// 创建类目标分解策略
class CreationDecompositionStrategy implements DecompositionStrategy {
  decompose(goal: string, context: ProjectContext): Task[] {
    const tasks: Task[] = [];

    // 1. 需求分析任务
    tasks.push(this.createTask(TaskType.IDEA_GENERATION, {
      description: `分析需求: ${goal}`,
      input: { goal, context },
      outputType: 'Requirements'
    }));

    // 2. 架构设计任务
    tasks.push(this.createTask(TaskType.ARCHITECTURE_DESIGN, {
      description: '设计系统架构',
      input: { requirements: '<from previous task>' },
      outputType: 'Architecture',
      dependencies: [tasks[0].id]
    }));

    // 3. 代码生成任务
    tasks.push(this.createTask(TaskType.CODE_GENERATION, {
      description: '生成项目代码',
      input: { architecture: '<from previous task>' },
      outputType: 'CodeFiles',
      dependencies: [tasks[1].id]
    }));

    // 4. 测试生成任务
    tasks.push(this.createTask(TaskType.TEST_GENERATION, {
      description: '生成测试代码',
      input: { code: '<from previous task>' },
      outputType: 'TestFiles',
      dependencies: [tasks[2].id]
    }));

    // 5. 质量审查任务
    tasks.push(this.createTask(TaskType.CODE_REVIEW, {
      description: '审查代码质量',
      input: { code: tasks[2].result, tests: tasks[3].result },
      outputType: 'ReviewReport',
      dependencies: [tasks[2].id, tasks[3].id]
    }));

    // 6. 构建部署任务
    tasks.push(this.createTask(TaskType.BUILD, {
      description: '构建项目',
      input: { code: tasks[2].result },
      outputType: 'BuildArtifact',
      dependencies: [tasks[4].id]
    }));

    return tasks;
  }
}
```

### 2.2 任务分发机制

```typescript
// 任务分发器
class TaskDispatcher {
  private agentRegistry: AgentRegistry;
  private loadBalancer: LoadBalancer;
  private affinityResolver: AffinityResolver;

  async dispatch(task: Task): Promise<DispatchResult> {
    // 1. 筛选可用 Agent
    const eligibleAgents = await this.findEligibleAgents(task);

    if (eligibleAgents.length === 0) {
      return { success: false, reason: 'No eligible agents' };
    }

    // 2. 评估 Agent 匹配度
    const scoredAgents = await this.scoreAgents(task, eligibleAgents);

    // 3. 选择最佳 Agent
    const selectedAgent = this.selectBestAgent(scoredAgents);

    // 4. 发送任务
    const dispatchResult = await this.sendToAgent(selectedAgent, task);

    return dispatchResult;
  }

  private async findEligibleAgents(task: Task): Promise<Agent[]> {
    const allAgents = this.agentRegistry.getAllAgents();

    return allAgents.filter(agent => {
      // 检查 Agent 类型是否匹配
      if (!this.canHandleTask(agent, task.type)) {
        return false;
      }

      // 检查 Agent 当前负载
      if (agent.currentLoad >= agent.maxLoad) {
        return false;
      }

      // 检查 Agent 状态
      if (agent.status !== AgentStatus.IDLE) {
        return false;
      }

      // 检查亲和性
      if (!this.affinityResolver.isCompatible(task, agent)) {
        return false;
      }

      return true;
    });
  }

  private async scoreAgents(
    task: Task,
    agents: Agent[]
  ): Promise<ScoredAgent[]> {
    const scores = await Promise.all(
      agents.map(async agent => {
        // 能力匹配度 (0-1)
        const capabilityScore = this.calculateCapabilityScore(task, agent);

        // 负载得分 (0-1, 负载越低得分越高)
        const loadScore = 1 - (agent.currentLoad / agent.maxLoad);

        // 历史表现得分 (0-1)
        const historyScore = await this.getHistoryScore(agent, task.type);

        // 亲和性得分 (0-1)
        const affinityScore = this.affinityResolver.getScore(task, agent);

        // 加权总分
        const totalScore = (
          capabilityScore * 0.4 +
          loadScore * 0.2 +
          historyScore * 0.25 +
          affinityScore * 0.15
        );

        return {
          agent,
          totalScore,
          breakdown: { capabilityScore, loadScore, historyScore, affinityScore }
        };
      })
    );

    return scores.sort((a, b) => b.totalScore - a.totalScore);
  }

  private selectBestAgent(scoredAgents: ScoredAgent[]): Agent {
    // 选择得分最高的 Agent
    // 如果最高得分 Agent 不可用，选择下一个
    for (const scored of scoredAgents) {
      if (scored.agent.status === AgentStatus.IDLE) {
        return scored.agent;
      }
    }
    return scoredAgents[0].agent;
  }
}

// Agent 注册表
class AgentRegistry {
  private agents: Map<string, Agent> = new Map();
  private capabilitiesIndex: Map<TaskType, Set<string>> = new Map();

  register(agent: Agent): void {
    this.agents.set(agent.id, agent);

    // 更新能力索引
    for (const capability of agent.capabilities) {
      if (!this.capabilitiesIndex.has(capability)) {
        this.capabilitiesIndex.set(capability, new Set());
      }
      this.capabilitiesIndex.get(capability)!.add(agent.id);
    }
  }

  findByCapability(taskType: TaskType): Agent[] {
    const agentIds = this.capabilitiesIndex.get(taskType);
    if (!agentIds) return [];
    return Array.from(agentIds).map(id => this.agents.get(id)!).filter(Boolean);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
}
```

### 2.3 负载均衡

```typescript
// 负载均衡器
class LoadBalancer {
  private strategy: LoadBalancingStrategy;

  constructor(strategy: LoadBalancingStrategy = 'least-loaded') {
    this.strategy = strategy;
  }

  select(agents: Agent[], task: Task): Agent {
    switch (this.strategy) {
      case 'least-loaded':
        return this.selectLeastLoaded(agents);
      case 'round-robin':
        return this.selectRoundRobin(agents);
      case 'capability-weighted':
        return this.selectCapabilityWeighted(agents, task);
      case 'affinity-based':
        return this.selectAffinityBased(agents, task);
      default:
        return this.selectLeastLoaded(agents);
    }
  }

  private selectLeastLoaded(agents: Agent[]): Agent {
    return agents.reduce((best, current) =>
      current.currentLoad < best.currentLoad ? current : best
    );
  }

  private selectCapabilityWeighted(agents: Agent[], task: Task): Agent {
    return agents.reduce((best, current) => {
      const bestMatch = this.calculateCapabilityMatch(best, task);
      const currentMatch = this.calculateCapabilityMatch(current, task);
      return currentMatch > bestMatch ? current : best;
    });
  }
}

// 负载状态
interface LoadState {
  agentId: string;
  currentLoad: number;
  maxLoad: number;
  activeTasks: number;
  queuedTasks: number;
  utilizationRate: number;        // 利用率
  estimatedCompletionTime: number; // 预计完成时间
}

// 负载监控
class LoadMonitor {
  private states: Map<string, LoadState> = new Map();

  updateLoad(agentId: string, state: Partial<LoadState>): void {
    const current = this.states.get(agentId) || this.createInitialState(agentId);
    this.states.set(agentId, { ...current, ...state });
  }

  getLoad(agentId: string): LoadState | undefined {
    return this.states.get(agentId);
  }

  getAverageLoad(): number {
    const loads = Array.from(this.states.values());
    if (loads.length === 0) return 0;
    return loads.reduce((sum, l) => sum + l.utilizationRate, 0) / loads.length;
  }

  isOverloaded(agentId: string): boolean {
    const state = this.states.get(agentId);
    return state ? state.utilizationRate > 0.9 : false;
  }
}
```

---

## 3. Agent 间通信

### 3.1 消息类型定义

```typescript
// 消息基类
interface Message {
  id: string;
  type: MessageType;
  sender: string;               // Agent ID
  receivers: string[];           // Agent ID 列表
  timestamp: Date;
  conversationId: string;        // 对话 ID
  replyTo?: string;             // 回复的消息 ID
  payload: unknown;
  metadata: MessageMetadata;
}

// 消息类型
enum MessageType {
  // 任务相关
  TASK_REQUEST = 'task-request',
  TASK_RESPONSE = 'task-response',
  TASK_PROGRESS = 'task-progress',
  TASK_CANCEL = 'task-cancel',

  // 协作相关
  PROPOSE = 'propose',           // 提议
  ACCEPT = 'accept',             // 接受
  REJECT = 'reject',             // 拒绝
  COUNTER = 'counter',           // 反提议
  AGREE = 'agree',               // 同意

  // 信息相关
  QUERY = 'query',               // 查询
  INFORM = 'inform',             // 通知
  SHARE = 'share',               // 分享
  REQUEST_INFO = 'request-info',

  // 协调相关
  COORDINATE = 'coordinate',
  NEGOTIATE = 'negotiate',
  SYNC = 'sync',
  COMMIT = 'commit',

  // 错误相关
  ERROR = 'error',
  REFUSE = 'refuse'
}

// 消息元数据
interface MessageMetadata {
  priority: 'low' | 'normal' | 'high' | 'urgent';
  ttl?: number;                 // 生存时间 (ms)
  retryCount?: number;
  correlationId?: string;
  traceId?: string;
}

// 消息内容类型
interface TaskRequestMessage extends Message {
  type: MessageType.TASK_REQUEST;
  payload: {
    task: Task;
    deadline?: Date;
    requirements?: string[];
    context?: Record<string, unknown>;
  };
}

interface ProposalMessage extends Message {
  type: MessageType.PROPOSE;
  payload: {
    proposalId: string;
    type: 'task-allocation' | 'resource-sharing' | 'decision' | 'solution';
    content: unknown;
    conditions?: string[];
    expiresAt?: Date;
  };
}

interface CoordinationMessage extends Message {
  type: MessageType.COORDINATE;
  payload: {
    action: 'barrier' | 'checkpoint' | 'merge' | 'split';
    participants: string[];
    barrierId?: string;
    checkpointId?: string;
  };
}
```

### 3.2 消息总线

```typescript
// 消息总线
class MessageBus {
  private subscriptions: Map<string, Set<MessageHandler>> = new Map();
  private messageQueue: PriorityQueue<Message>;
  private deadLetterQueue: Message[];
  private interceptors: MessageInterceptor[];

  constructor(config: MessageBusConfig) {
    this.messageQueue = new PriorityQueue((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.metadata.priority] - priorityOrder[b.metadata.priority];
    });
  }

  // 发布消息
  async publish(message: Message): Promise<void> {
    // 通过拦截器
    for (const interceptor of this.interceptors) {
      message = await interceptor.onPublish(message);
    }

    // 路由到订阅者
    const handlers = this.getHandlers(message.type);
    for (const handler of handlers) {
      try {
        await handler(message);
      } catch (error) {
        await this.handleDeliveryError(message, error);
      }
    }

    // 记录消息历史
    await this.recordMessage(message);
  }

  // 订阅消息
  subscribe(
    agentId: string,
    messageType: MessageType,
    handler: MessageHandler
  ): Subscription {
    const key = `${agentId}:${messageType}`;
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(handler);

    return {
      unsubscribe: () => {
        this.subscriptions.get(key)?.delete(handler);
      }
    };
  }

  // 请求-响应模式
  async request<T>(
    sender: string,
    receiver: string,
    message: Omit<Message, 'id' | 'timestamp' | 'sender' | 'receivers'>
  ): Promise<T> {
    const requestMessage: Message = {
      ...message,
      id: uuid(),
      sender,
      receivers: [receiver],
      timestamp: new Date()
    } as Message;

    return new Promise((resolve, reject) => {
      // 设置超时
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestMessage.id);
        reject(new Error(`Request timeout: ${requestMessage.id}`));
      }, 30000);

      // 存储待处理请求
      this.pendingRequests.set(requestMessage.id, { resolve, reject, timeout });

      // 发送请求
      this.publish(requestMessage);
    });
  }

  private getHandlers(type: MessageType): Set<MessageHandler> {
    // 支持通配符订阅
    const handlers = new Set<MessageHandler>();

    for (const [key, handlerSet] of this.subscriptions) {
      const [, subscribedType] = key.split(':');
      if (subscribedType === type || subscribedType === '*') {
        handlerSet.forEach(h => handlers.add(h));
      }
    }

    return handlers;
  }
}

// 消息拦截器
interface MessageInterceptor {
  onPublish(message: Message): Promise<Message>;
  onSubscribe(message: Message, handler: MessageHandler): Promise<void>;
}

// 消息处理函数
type MessageHandler = (message: Message) => Promise<void>;
```

### 3.3 事件流处理

```typescript
// 事件流处理器
class EventStreamProcessor {
  private streams: Map<string, EventStream> = new Map();

  createStream(
    name: string,
    config: StreamConfig
  ): EventStream {
    const stream: EventStream = {
      name,
      config,
      events: [],
      subscribers: new Set(),
      processing: false
    };
    this.streams.set(name, stream);
    return stream;
  }

  // 发布事件到流
  async publishToStream(
    streamName: string,
    event: AgentEvent
  ): Promise<void> {
    const stream = this.streams.get(streamName);
    if (!stream) {
      throw new Error(`Stream not found: ${streamName}`);
    }

    // 添加事件到流
    stream.events.push({
      ...event,
      sequence: stream.events.length
    });

    // 触发订阅者
    for (const subscriber of stream.subscribers) {
      await subscriber(event);
    }
  }

  // 订阅流
  subscribe(
    streamName: string,
    handler: (event: AgentEvent) => Promise<void>
  ): () => void {
    const stream = this.streams.get(streamName);
    if (!stream) {
      throw new Error(`Stream not found: ${streamName}`);
    }

    stream.subscribers.add(handler);

    return () => {
      stream.subscribers.delete(handler);
    };
  }

  // 流聚合
  async aggregate(
    streamNames: string[],
    aggregator: Aggregator
  ): Promise<unknown> {
    const allEvents: AgentEvent[][] = [];

    for (const name of streamNames) {
      const stream = this.streams.get(name);
      if (stream) {
        allEvents.push(stream.events);
      }
    }

    return aggregator.aggregate(allEvents.flat());
  }
}

// Agent 事件
interface AgentEvent {
  agentId: string;
  type: AgentEventType;
  timestamp: Date;
  data: unknown;
  correlationId?: string;
}

enum AgentEventType {
  TASK_START = 'task-start',
  TASK_COMPLETE = 'task-complete',
  TASK_FAIL = 'task-fail',
  STATUS_CHANGE = 'status-change',
  CAPABILITY_UPDATE = 'capability-update',
  LOAD_UPDATE = 'load-update',
  ERROR = 'error'
}
```

---

## 4. 协调与同步

### 4.1 协调协议

```typescript
// 协调协议类型
enum CoordinationProtocol {
  // 任务协调
  TASK_ASSIGNMENT = 'task-assignment',       // 任务分配
  TASK_SEQUENCING = 'task-sequencing',       // 任务排序
  TASK_DEPENDENCY = 'task-dependency',       // 任务依赖

  // 资源协调
  RESOURCE_LOCK = 'resource-lock',           // 资源锁定
  RESOURCE_ARBITRATION = 'resource-arbitration', // 资源仲裁

  // 决策协调
  VOTING = 'voting',                         // 投票
  AUCTION = 'auction',                       // 拍卖
  NEGOTIATION = 'negotiation'                // 协商
}

// 协调器
class Coordinator {
  private protocolHandlers: Map<CoordinationProtocol, ProtocolHandler>;
  private transactionLog: TransactionLog;

  async coordinate(
    protocol: CoordinationProtocol,
    participants: string[],
    context: CoordinationContext
  ): Promise<CoordinationResult> {
    const handler = this.protocolHandlers.get(protocol);
    if (!handler) {
      throw new Error(`Unknown protocol: ${protocol}`);
    }

    // 开始协调事务
    const transaction = await this.beginTransaction(protocol, participants);

    try {
      // 执行协调协议
      const result = await handler.execute(participants, context);

      // 提交事务
      await this.commitTransaction(transaction, result);

      return result;
    } catch (error) {
      // 回滚事务
      await this.rollbackTransaction(transaction);
      throw error;
    }
  }

  // 任务排序协调
  async coordinateTaskSequence(tasks: Task[]): Promise<Task[]> {
    // 构建任务依赖图
    const dag = this.buildDAG(tasks);

    // 检测环
    if (this.hasCycle(dag)) {
      throw new Error('Task dependency contains cycle');
    }

    // 拓扑排序
    const sorted = this.topologicalSort(dag);

    // 优化排序 (同一 Agent 的任务尽量连续)
    const optimized = this.optimizeTaskOrder(sorted, tasks);

    return optimized;
  }

  private buildDAG(tasks: Task[]): DAG {
    const dag: DAG = { nodes: [], edges: [] };

    // 添加节点
    for (const task of tasks) {
      dag.nodes.push({ id: task.id, data: task });
    }

    // 添加边 (依赖关系)
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        dag.edges.push({ from: depId, to: task.id });
      }
    }

    return dag;
  }
}

// 资源锁管理器
class ResourceLockManager {
  private locks: Map<string, ResourceLock> = new Map();
  private waitQueue: PriorityQueue<LockRequest>;

  async acquireLock(
    resourceId: string,
    agentId: string,
    options: LockOptions
  ): Promise<LockHandle> {
    const existingLock = this.locks.get(resourceId);

    // 检查是否可以获取锁
    if (existingLock && !this.canAcquire(existingLock, agentId, options)) {
      // 加入等待队列
      const request: LockRequest = {
        resourceId,
        agentId,
        options,
        priority: options.priority || 0,
        timestamp: new Date()
      };

      return new Promise((resolve, reject) => {
        this.waitQueue.enqueue(request);

        // 设置超时
        if (options.timeout) {
          setTimeout(() => {
            this.waitQueue.remove(request);
            reject(new Error('Lock acquisition timeout'));
          }, options.timeout);
        }
      });
    }

    // 创建锁
    const lock: ResourceLock = {
      resourceId,
      holder: agentId,
      type: options.type,
      acquiredAt: new Date(),
      expiresAt: options.expiry ? new Date(Date.now() + options.expiry) : undefined,
      references: 1
    };

    this.locks.set(resourceId, lock);

    return {
      release: () => this.releaseLock(resourceId, agentId),
      extend: (duration: number) => this.extendLock(resourceId, agentId, duration)
    };
  }

  private releaseLock(resourceId: string, agentId: string): void {
    const lock = this.locks.get(resourceId);
    if (!lock || lock.holder !== agentId) {
      throw new Error('Not the lock holder');
    }

    lock.references--;

    if (lock.references === 0) {
      this.locks.delete(resourceId);
      this.processWaitQueue(resourceId);
    }
  }

  private processWaitQueue(resourceId: string): void {
    // 处理等待队列中的请求
    const requests = this.waitQueue.items
      .filter(r => r.resourceId === resourceId)
      .sort((a, b) => b.priority - a.priority);

    if (requests.length > 0) {
      const next = requests[0];
      this.waitQueue.remove(next);
      // 这里需要触发下一个请求的 Promise resolve
    }
  }
}

interface LockOptions {
  type: 'shared' | 'exclusive';
  priority?: number;
  timeout?: number;
  expiry?: number;
  reusable?: boolean;
}
```

### 4.2 同步屏障

```typescript
// 同步屏障
class Barrier {
  private id: string;
  private participants: Set<string>;
  private waiting: Map<string, PromiseResolver<void>> = new Map();
  private triggered: boolean = false;
  private result?: unknown;

  constructor(id: string, participants: string[]) {
    this.id = id;
    this.participants = new Set(participants);
  }

  // 到达屏障
  async arrive(agentId: string, result?: unknown): Promise<void> {
    if (!this.participants.has(agentId)) {
      throw new Error(`Agent ${agentId} is not a participant`);
    }

    if (this.triggered) {
      // 已经触发，直接返回结果
      return;
    }

    // 记录结果
    if (result !== undefined) {
      this.storeResult(agentId, result);
    }

    // 移除等待者
    this.waiting.delete(agentId);

    // 检查是否所有参与者都到达
    if (this.waiting.size === 0) {
      this.trigger();
    }
  }

  // 等待所有参与者
  async wait(agentId: string): Promise<unknown> {
    if (!this.participants.has(agentId)) {
      throw new Error(`Agent ${agentId} is not a participant`);
    }

    if (this.triggered) {
      return this.result;
    }

    // 创建等待 Promise
    let resolver: PromiseResolver<void>;
    const promise = new Promise<void>(resolve => {
      resolver = resolve;
    });

    this.waiting.set(agentId, { promise, resolver: resolver! });

    // 设置超时
    return Promise.race([
      promise.then(() => this.result),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Barrier timeout')), 60000)
      )
    ]);
  }

  private trigger(): void {
    this.triggered = true;
    this.result = this.aggregateResults();
    this.waiting.forEach(({ resolver }) => resolver());
  }
}

// 检查点管理器
class CheckpointManager {
  private checkpoints: Map<string, Checkpoint> = new Map();

  async createCheckpoint(
    id: string,
    participants: string[],
    context: Record<string, unknown>
  ): Promise<Checkpoint> {
    const checkpoint: Checkpoint = {
      id,
      participants: new Set(participants),
      context,
      state: 'active',
      createdAt: new Date()
    };

    this.checkpoints.set(id, checkpoint);
    return checkpoint;
  }

  async waitForCheckpoint(
    checkpointId: string,
    agentId: string,
    state?: unknown
  ): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    // 记录状态
    if (state !== undefined) {
      checkpoint.states.set(agentId, state);
    }

    // 检查是否所有参与者都到达
    if (checkpoint.states.size === checkpoint.participants.size) {
      checkpoint.state = 'completed';
    }
  }

  async validateCheckpoint(
    checkpointId: string
  ): Promise<{ valid: boolean; errors?: string[] }> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      return { valid: false, errors: ['Checkpoint not found'] };
    }

    const errors: string[] = [];

    // 验证状态一致性
    for (const [agentId, state] of checkpoint.states) {
      if (!this.isStateValid(state)) {
        errors.push(`Invalid state from ${agentId}`);
      }
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }
}
```

---

## 5. 冲突解决

### 5.1 冲突类型

```typescript
// 冲突类型
enum ConflictType {
  // 资源冲突
  RESOURCE_CONTENTION = 'resource-contention',   // 资源争用
  DEADLOCK = 'deadlock',                         // 死锁

  // 任务冲突
  TASK_OVERLAP = 'task-overlap',                 // 任务重叠
  DUPLICATE_WORK = 'duplicate-work',             // 重复工作
  INCONSISTENT_OUTPUT = 'inconsistent-output',   // 输出不一致

  // 决策冲突
  DECISION_DISAGREEMENT = 'decision-disagreement',
  GOAL_CONFLICT = 'goal-conflict',
  PRIORITY_CONFLICT = 'priority-conflict',

  // 状态冲突
  STATE_INCONSISTENCY = 'state-inconsistency',
  VERSION_CONFLICT = 'version-conflict'
}

// 冲突结构
interface Conflict {
  id: string;
  type: ConflictType;
  participants: string[];
  timestamp: Date;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context: Record<string, unknown>;
  attempts: ResolutionAttempt[];
  resolution?: Resolution;
}

// 冲突检测器
class ConflictDetector {
  detectResourceContention(
    resourceId: string,
    requesters: string[]
  ): Conflict | null {
    if (requesters.length <= 1) return null;

    return {
      id: uuid(),
      type: ConflictType.RESOURCE_CONTENTION,
      participants: requesters,
      timestamp: new Date(),
      description: `Multiple agents competing for resource: ${resourceId}`,
      severity: this.calculateSeverity(requesters.length),
      context: { resourceId, requesters },
      attempts: []
    };
  }

  detectInconsistentOutput(
    outputs: Map<string, unknown>
  ): Conflict | null {
    // 检查输出是否一致
    const values = Array.from(outputs.values());
    const first = JSON.stringify(values[0]);

    const inconsistent = values.some(v => JSON.stringify(v) !== first);
    if (!inconsistent) return null;

    return {
      id: uuid(),
      type: ConflictType.INCONSISTENT_OUTPUT,
      participants: Array.from(outputs.keys()),
      timestamp: new Date(),
      description: 'Agents produced inconsistent outputs',
      severity: 'high',
      context: { outputs: Object.fromEntries(outputs) },
      attempts: []
    };
  }
}
```

### 5.2 冲突解决策略

```typescript
// 冲突解决策略
enum ResolutionStrategy {
  // 自动解决
  AUTO_RESOLVE = 'auto-resolve',           // 自动解决
  PRIORITY_BASED = 'priority-based',       // 基于优先级
  ROUND_ROBIN = 'round-robin',             // 轮询
  RANDOM = 'random',                       // 随机

  // 协调解决
  NEGOTIATION = 'negotiation',             // 协商
  VOTING = 'voting',                       // 投票
  ARBITRATION = 'arbitration',             // 仲裁
  CONSENSUS = 'consensus'                  // 共识
}

// 冲突解决器
class ConflictResolver {
  private strategies: Map<ConflictType, ResolutionStrategy[]>;
  private arbitrationAgent?: Agent;         // 仲裁 Agent

  async resolve(conflict: Conflict): Promise<Resolution> {
    // 选择解决策略
    const strategy = this.selectStrategy(conflict);

    // 执行解决
    const resolution = await this.executeStrategy(strategy, conflict);

    return resolution;
  }

  private selectStrategy(conflict: Conflict): ResolutionStrategy {
    const applicableStrategies = this.strategies.get(conflict.type) || [];

    // 根据冲突类型和严重程度选择策略
    if (conflict.severity === 'critical') {
      return ResolutionStrategy.ARBITRATION;
    }

    if (applicableStrategies.length === 0) {
      return ResolutionStrategy.PRIORITY_BASED;
    }

    return applicableStrategies[0];
  }

  private async executeStrategy(
    strategy: ResolutionStrategy,
    conflict: Conflict
  ): Promise<Resolution> {
    switch (strategy) {
      case ResolutionStrategy.AUTO_RESOLVE:
        return this.autoResolve(conflict);
      case ResolutionStrategy.PRIORITY_BASED:
        return this.priorityBasedResolve(conflict);
      case ResolutionStrategy.VOTING:
        return this.votingResolve(conflict);
      case ResolutionStrategy.ARBITRATION:
        return this.arbitrationResolve(conflict);
      case ResolutionStrategy.NEGOTIATION:
        return this.negotiationResolve(conflict);
      default:
        return this.priorityBasedResolve(conflict);
    }
  }

  // 优先级解决
  private async priorityBasedResolve(conflict: Conflict): Promise<Resolution> {
    // 获取参与者优先级
    const priorities = await this.getAgentPriorities(conflict.participants);

    // 选择最高优先级
    const winner = priorities[0];

    return {
      id: uuid(),
      conflictId: conflict.id,
      strategy: ResolutionStrategy.PRIORITY_BASED,
      winner,
      losers: conflict.participants.filter(p => p !== winner),
      actions: this.generateCompensationActions(conflict, winner),
      timestamp: new Date()
    };
  }

  // 投票解决
  private async votingResolve(conflict: Conflict): Promise<Resolution> {
    // 收集投票
    const votes = await this.collectVotes(conflict);

    // 统计票数
    const tally = this.tallyVotes(votes);

    // 多数获胜
    const winner = tally.mostVoted;

    return {
      id: uuid(),
      conflictId: conflict.id,
      strategy: ResolutionStrategy.VOTING,
      winner,
      tally,
      actions: [],
      timestamp: new Date()
    };
  }

  // 仲裁解决
  private async arbitrationResolve(conflict: Conflict): Promise<Resolution> {
    if (!this.arbitrationAgent) {
      throw new Error('Arbitration agent not available');
    }

    // 请求仲裁
    const result = await this.arbitrationAgent.arbitrate(conflict);

    return {
      id: uuid(),
      conflictId: conflict.id,
      strategy: ResolutionStrategy.ARBITRATION,
      winner: result.winner,
      reasoning: result.reasoning,
      actions: result.actions,
      timestamp: new Date()
    };
  }

  // 协商解决
  private async negotiationResolve(conflict: Conflict): Promise<Resolution> {
    // 多轮协商
    let currentOffer = this.generateInitialOffer(conflict);
    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
      // 收集反馈
      const responses = await this.collectResponses(conflict, currentOffer);

      // 检查是否达成共识
      if (this.hasConsensus(responses)) {
        return {
          id: uuid(),
          conflictId: conflict.id,
          strategy: ResolutionStrategy.NEGOTIATION,
          agreedOffer: currentOffer,
          participants: conflict.participants,
          timestamp: new Date()
        };
      }

      // 生成新提议
      currentOffer = this.generateNewOffer(currentOffer, responses);
      iterations++;
    }

    // 协商失败，降级到仲裁
    return this.arbitrationResolve(conflict);
  }
}

// 解决方案
interface Resolution {
  id: string;
  conflictId: string;
  strategy: ResolutionStrategy;
  winner?: string;
  losers?: string[];
  agreedOffer?: unknown;
  tally?: VoteTally;
  reasoning?: string;
  actions: CompensationAction[];
  timestamp: Date;
}
```

---

## 6. 共识机制

### 6.1 共识协议

```typescript
// 共识协议
class ConsensusProtocol {
  private quorumSize: number;
  private timeout: number;

  constructor(quorumSize: number, timeout: number = 30000) {
    this.quorumSize = quorumSize;
    this.timeout = timeout;
  }

  // 达成共识
  async reachConsensus(
    topic: string,
    participants: string[],
    value: unknown
  ): Promise<ConsensusResult> {
    // 阶段 1: 提议
    const proposal = await this.propose(topic, value, participants);

    // 阶段 2: 预投票
    const prevotes = await this.collectPrevotes(proposal, participants);

    // 检查是否准备提交
    if (this.hasQuorum(prevotes)) {
      // 阶段 3: 提交
      return this.commit(proposal, participants);
    } else {
      // 重新提议
      return this.reachConsensus(topic, participants, this.generateNewValue(value));
    }
  }

  private async propose(
    topic: string,
    value: unknown,
    participants: string[]
  ): Promise<Proposal> {
    const proposal: Proposal = {
      id: uuid(),
      topic,
      value,
      proposer: this.getLeader(),
      round: 1,
      createdAt: new Date()
    };

    // 广播提议
    await this.broadcast(proposal, participants);

    return proposal;
  }

  private async collectPrevotes(
    proposal: Proposal,
    participants: string[]
  ): Promise<Prevote[]> {
    const prevotes: Prevote[] = [];

    const promises = participants.map(async participant => {
      const response = await this.request<Prevote>(
        participant,
        MessageType.PROPOSE,
        { proposal }
      );
      return response;
    });

    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        prevotes.push(result.value);
      }
    }

    return prevotes;
  }

  private hasQuorum(votes: Prevote[]): boolean {
    return votes.filter(v => v.accept).length >= this.quorumSize;
  }

  private async commit(
    proposal: Proposal,
    participants: string[]
  ): Promise<ConsensusResult> {
    // 广播提交
    await this.broadcast({ type: 'commit', proposal }, participants);

    return {
      reached: true,
      value: proposal.value,
      participants: participants.length,
      rounds: proposal.round
    };
  }
}

// 投票收集器
class VoteCollector {
  async collectVotes(
    topic: string,
    voters: string[],
    options: unknown[]
  ): Promise<VoteResult> {
    const votes: Map<string, unknown> = new Map();

    for (const voter of voters) {
      try {
        const vote = await this.request(voter, MessageType.QUERY, { topic });
        votes.set(voter, vote);
      } catch (error) {
        console.error(`Vote collection failed from ${voter}:`, error);
      }
    }

    // 统计投票
    const tally = this.tally(votes, options);

    return {
      votes,
      tally,
      participation: votes.size / voters.length
    };
  }

  private tally(votes: Map<string, unknown>, options: unknown[]): VoteTally {
    const counts: Map<string, number> = new Map();

    for (const option of options) {
      counts.set(JSON.stringify(option), 0);
    }

    for (const vote of votes.values()) {
      const key = JSON.stringify(vote);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    // 找出最高票
    let maxCount = 0;
    let winner: unknown;

    for (const [key, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        winner = JSON.parse(key);
      }
    }

    return {
      counts: Object.fromEntries(counts),
      winner,
      maxCount,
      totalVotes: votes.size
    };
  }
}
```

### 6.2 决策聚合

```typescript
// 决策聚合器
class DecisionAggregator {
  async aggregate(
    decisions: AgentDecision[],
    method: AggregationMethod
  ): Promise<AggregatedDecision> {
    switch (method) {
      case AggregationMethod.WEIGHTED_VOTING:
        return this.weightedVoting(decisions);
      case AggregationMethod.DELPHI:
        return this.delphiMethod(decisions);
      case AggregationMethod.RANKING:
        return this.rankingAggregation(decisions);
      case AggregationMethod.CONDORCET:
        return this.condorcetMethod(decisions);
      default:
        return this.weightedVoting(decisions);
    }
  }

  // 加权投票
  private async weightedVoting(
    decisions: AgentDecision[]
  ): Promise<AggregatedDecision> {
    const scores: Map<string, number> = new Map();

    for (const decision of decisions) {
      const weight = decision.agentWeight || 1;
      const option = JSON.stringify(decision.choice);

      scores.set(option, (scores.get(option) || 0) + weight);
    }

    // 找出最高分
    let maxScore = 0;
    let winner: unknown;

    for (const [key, score] of scores) {
      if (score > maxScore) {
        maxScore = score;
        winner = JSON.parse(key);
      }
    }

    return {
      decision: winner,
      confidence: this.calculateConfidence(scores, decisions.length),
      breakdown: Object.fromEntries(scores),
      method: AggregationMethod.WEIGHTED_VOTING
    };
  }

  // Condorcet 方法
  private condorcetMethod(decisions: AgentDecision[]): AggregatedDecision {
    // 成对比较
    const pairwiseWins: Map<string, Set<string>> = new Map();

    for (const d1 of decisions) {
      for (const d2 of decisions) {
        if (d1 === d2) continue;

        // d1 相对于 d2 的偏好
        if (this.prefers(d1, d2)) {
          if (!pairwiseWins.has(d1.choice)) {
            pairwiseWins.set(d1.choice, new Set());
          }
          pairwiseWins.get(d1.choice)!.add(d2.choice);
        }
      }
    }

    // 找出 Condorcet 赢家
    let condorcetWinner: unknown;
    for (const [winner, losers] of pairwiseWins) {
      let isCondorcet = true;
      for (const loser of losers) {
        // 检查是否所有人都认为 winner 优于 loser
        const allPrefersWinner = decisions.every(d => this.prefers(d, winner, loser));
        if (!allPrefersWinner) {
          isCondorcet = false;
          break;
        }
      }
      if (isCondorcet) {
        condorcetWinner = winner;
        break;
      }
    }

    return {
      decision: condorcetWinner,
      confidence: condorcetWinner ? 0.9 : 0.5,
      method: AggregationMethod.CONDORCET
    };
  }
}

enum AggregationMethod {
  WEIGHTED_VOTING = 'weighted-voting',
  DELPHI = 'delphi',
  RANKING = 'ranking',
  CONDORCET = 'condorcet'
}
```

---

## 7. 共享上下文与记忆

### 7.1 上下文管理

```typescript
// 共享上下文
interface SharedContext {
  projectId: string;
  currentPhase: ProjectPhase;
  artifacts: Map<string, Artifact>;
  state: ProjectState;
  history: ContextEvent[];
  subscriptions: Map<string, Set<ContextWatcher>>;
}

// 上下文管理器
class ContextManager {
  private contexts: Map<string, SharedContext> = new Map();
  private versionControl: ContextVersionControl;

  // 创建上下文
  createContext(projectId: string): SharedContext {
    const context: SharedContext = {
      projectId,
      currentPhase: ProjectPhase.INITIALIZATION,
      artifacts: new Map(),
      state: {},
      history: [],
      subscriptions: new Map()
    };

    this.contexts.set(projectId, context);
    return context;
  }

  // 获取上下文快照
  async snapshot(contextId: string): Promise<ContextSnapshot> {
    const context = this.contexts.get(contextId);
    if (!context) throw new Error('Context not found');

    return {
      id: uuid(),
      contextId,
      version: this.versionControl.currentVersion(contextId),
      data: JSON.parse(JSON.stringify(context)),
      timestamp: new Date()
    };
  }

  // 更新上下文
  async update(
    contextId: string,
    update: ContextUpdate
  ): Promise<void> {
    const context = this.contexts.get(contextId);
    if (!context) throw new Error('Context not found');

    // 版本控制
    const version = this.versionControl.createVersion(contextId, update);

    // 应用更新
    this.applyUpdate(context, update);

    // 记录历史
    context.history.push({
      type: 'update',
      version,
      timestamp: new Date(),
      data: update
    });

    // 通知订阅者
    this.notifyWatchers(contextId, update);
  }

  // 订阅上下文变化
  subscribe(
    contextId: string,
    agentId: string,
    handler: ContextWatcher
  ): () => void {
    const context = this.contexts.get(contextId);
    if (!context) throw new Error('Context not found');

    if (!context.subscriptions.has(agentId)) {
      context.subscriptions.set(agentId, new Set());
    }
    context.subscriptions.get(agentId)!.add(handler);

    return () => {
      context.subscriptions.get(agentId)?.delete(handler);
    };
  }

  // 分支上下文 (用于实验)
  async branch(
    contextId: string,
    branchId: string
  ): Promise<SharedContext> {
    const parent = this.contexts.get(contextId);
    if (!parent) throw new Error('Context not found');

    const branch: SharedContext = {
      ...JSON.parse(JSON.stringify(parent)),
      projectId: branchId
    };

    this.contexts.set(branchId, branch);
    return branch;
  }

  // 合并上下文
  async merge(sourceId: string, targetId: string): Promise<void> {
    const source = this.contexts.get(sourceId);
    const target = this.contexts.get(targetId);

    if (!source || !target) throw new Error('Context not found');

    // 检测冲突
    const conflicts = this.detectConflicts(source, target);

    if (conflicts.length > 0) {
      // 需要解决冲突
      throw new Error(`Merge conflicts detected: ${conflicts.join(', ')}`);
    }

    // 无冲突，合并
    Object.assign(target, source);
  }
}

// 上下文版本控制
class ContextVersionControl {
  private versions: Map<string, Version[]> = new Map();

  createVersion(contextId: string, update: ContextUpdate): Version {
    const versions = this.versions.get(contextId) || [];
    const version: Version = {
      id: uuid(),
      contextId,
      parentId: versions.length > 0 ? versions[versions.length - 1].id : null,
      update,
      timestamp: new Date()
    };

    versions.push(version);
    this.versions.set(contextId, versions);

    return version;
  }

  currentVersion(contextId: string): string {
    const versions = this.versions.get(contextId);
    return versions ? versions[versions.length - 1].id : 'v0';
  }

  getHistory(contextId: string): Version[] {
    return this.versions.get(contextId) || [];
  }

  rollback(contextId: string, versionId: string): ContextUpdate | null {
    const versions = this.versions.get(contextId);
    if (!versions) return null;

    const version = versions.find(v => v.id === versionId);
    return version ? version.update : null;
  }
}
```

### 7.2 Agent 记忆系统

```typescript
// Agent 记忆类型
enum MemoryType {
  EPISODIC = 'episodic',           // 情景记忆 (具体经验)
  SEMANTIC = 'semantic',           // 语义记忆 (知识概念)
  PROCEDURAL = 'procedural'        // 程序记忆 (技能流程)
}

// 记忆结构
interface Memory {
  id: string;
  agentId: string;
  type: MemoryType;
  content: unknown;
  embedding?: number[];
  importance: number;               // 重要性 0-1
  encodingTime: Date;
  lastAccessTime: Date;
  accessCount: number;
  tags: string[];
  source: 'experience' | 'communication' | 'observation';
}

// 记忆管理器
class MemoryManager {
  private storage: MemoryStorage;
  private relevanceCalculator: RelevanceCalculator;

  // 存储记忆
  async store(memory: Omit<Memory, 'id' | 'encodingTime' | 'lastAccessTime' | 'accessCount'>): Promise<Memory> {
    const fullMemory: Memory = {
      ...memory,
      id: uuid(),
      encodingTime: new Date(),
      lastAccessTime: new Date(),
      accessCount: 0
    };

    await this.storage.save(fullMemory);

    // 定期整合到语义记忆
    if (fullMemory.type === MemoryType.EPISODIC) {
      await this.consolidateIfNeeded(fullMemory);
    }

    return fullMemory;
  }

  // 检索记忆
  async retrieve(
    agentId: string,
    query: string,
    options: RetrievalOptions = {}
  ): Promise<RetrievedMemory[]> {
    const queryEmbedding = await this.embeddingService.encode(query);

    // 计算相关性
    const memories = await this.storage.getByAgent(agentId);
    const scored = memories.map(memory => ({
      memory,
      relevance: this.relevanceCalculator.calculate(queryEmbedding, memory.embedding!),
      recency: this.calculateRecency(memory)
    }));

    // 加权评分
    const ranked = scored
      .map(s => ({
        ...s,
        score: s.relevance * 0.7 + s.recency * 0.3
      }))
      .filter(s => s.score > (options.threshold || 0.5))
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit || 10);

    // 更新访问时间
    for (const item of ranked) {
      await this.storage.updateAccess(item.memory.id);
    }

    return ranked;
  }

  // 情景记忆整合
  private async consolidateIfNeeded(memory: Memory): Promise<void> {
    // 检查是否需要整合
    const recentEpisodic = await this.storage.getRecent(
      memory.agentId,
      MemoryType.EPISODIC,
      24 * 60 * 60 * 1000 // 24小时内
    );

    if (recentEpisodic.length >= 10) {
      // 整合到语义记忆
      const semanticMemory = await this.extractSemanticKnowledge(recentEpisodic);
      await this.store({
        ...semanticMemory,
        agentId: memory.agentId,
        type: MemoryType.SEMANTIC,
        source: 'experience'
      });
    }
  }

  // 遗忘机制
  async forget(agentId: string): Promise<void> {
    const memories = await this.storage.getByAgent(agentId);

    for (const memory of memories) {
      // 计算保留分数
      const retentionScore = this.calculateRetentionScore(memory);

      if (retentionScore < 0.1) {
        await this.storage.delete(memory.id);
      } else if (retentionScore < 0.3) {
        // 降低重要性
        await this.storage.update(memory.id, {
          importance: memory.importance * 0.9
        });
      }
    }
  }

  private calculateRetentionScore(memory: Memory): number {
    const age = Date.now() - memory.encodingTime.getTime();
    const accessDecay = Math.pow(0.9, memory.accessCount);
    const importanceBoost = memory.importance;

    // 时间衰减
    const ageFactor = Math.exp(-age / (30 * 24 * 60 * 60 * 1000)); // 30天半衰期

    return ageFactor * accessDecay * (0.5 + 0.5 * importanceBoost);
  }
}

// 检索选项
interface RetrievalOptions {
  type?: MemoryType;
  threshold?: number;
  limit?: number;
  recencyWeight?: number;
  tags?: string[];
}

// 检索到的记忆
interface RetrievedMemory {
  memory: Memory;
  relevance: number;
  recency: number;
  score: number;
}
```

---

## 8. 协作监控与分析

### 8.1 协作指标

```typescript
// 协作指标收集器
class CollaborationMetricsCollector {
  async collect(): Promise<CollaborationMetrics> {
    return {
      // 效率指标
      efficiency: await this.collectEfficiencyMetrics(),

      // 通信指标
      communication: await this.collectCommunicationMetrics(),

      // 协调指标
      coordination: await this.collectCoordinationMetrics(),

      // 质量指标
      quality: await this.collectQualityMetrics()
    };
  }

  private async collectEfficiencyMetrics(): Promise<EfficiencyMetrics> {
    const tasks = await this.getCompletedTasks();

    return {
      averageTaskDuration: this.average(tasks.map(t => t.duration)),
      taskCompletionRate: this.calculateCompletionRate(tasks),
      parallelEfficiency: await this.calculateParallelEfficiency(),
      idleTimeRatio: await this.calculateIdleTimeRatio(),
      bottleneckAgents: await this.identifyBottleneckAgents()
    };
  }

  private async collectCommunicationMetrics(): Promise<CommunicationMetrics> {
    const messages = await this.getMessages();

    return {
      totalMessages: messages.length,
      messagesPerAgent: this.groupBy(messages, 'sender'),
      averageResponseTime: await this.calculateAverageResponseTime(),
      messageTypes: this.groupBy(messages, 'type'),
      conflictRate: this.calculateConflictRate(messages)
    };
  }

  private async identifyBottleneckAgents(): Promise<string[]> {
    const loads = await this.getAgentLoads();

    return loads
      .filter(l => l.utilizationRate > 0.8)
      .sort((a, b) => b.utilizationRate - a.utilizationRate)
      .slice(0, 3)
      .map(l => l.agentId);
  }
}

// 协作分析器
class CollaborationAnalyzer {
  async analyze(
    metrics: CollaborationMetrics
  ): Promise<CollaborationInsights> {
    return {
      efficiencyInsights: this.analyzeEfficiency(metrics.efficiency),
      communicationInsights: this.analyzeCommunication(metrics.communication),
      coordinationInsights: this.analyzeCoordination(metrics.coordination),
      recommendations: this.generateRecommendations(metrics)
    };
  }

  private analyzeEfficiency(efficiency: EfficiencyMetrics): EfficiencyInsights {
    const insights: string[] = [];

    if (efficiency.idleTimeRatio > 0.3) {
      insights.push('Agent idle time is high, consider better load balancing');
    }

    if (efficiency.parallelEfficiency < 0.5) {
      insights.push('Parallel execution efficiency is low, optimize task decomposition');
    }

    if (efficiency.bottleneckAgents.length > 0) {
      insights.push(`Bottleneck agents identified: ${efficiency.bottleneckAgents.join(', ')}`);
    }

    return {
      overallScore: this.calculateOverallEfficiencyScore(efficiency),
      insights,
      issues: this.identifyEfficiencyIssues(efficiency)
    };
  }

  private generateRecommendations(
    metrics: CollaborationMetrics
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // 基于分析生成建议
    if (metrics.efficiency.idleTimeRatio > 0.2) {
      recommendations.push({
        category: 'load-balancing',
        priority: 'high',
        description: 'Optimize task distribution to reduce agent idle time',
        expectedImpact: '15-25% efficiency improvement'
      });
    }

    if (metrics.coordination.avgConsensusTime > 60000) {
      recommendations.push({
        category: 'coordination',
        priority: 'medium',
        description: 'Reduce consensus building time with faster conflict resolution',
        expectedImpact: '10-20% latency reduction'
      });
    }

    return recommendations;
  }
}
```

---

## 9. 相关文档

- [工作流编排设计](./WORKFLOW_ORCHESTRATION.md)
- [Agent 设计](./06-agents.md)
- [错误处理与系统韧性](./ERROR_HANDLING_RESILIENCE.md)
- [自愈系统设计](./SELF_HEALING_SYSTEMS.md)

---

**最后更新**: 2026-04-14
