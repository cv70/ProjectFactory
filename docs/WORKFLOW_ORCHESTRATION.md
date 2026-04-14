# 工作流编排设计文档

## 1. 工作流架构

### 1.1 工作流系统概述

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           工作流编排系统架构                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Workflow Definition                              │   │
│  │                          工作流定义层                                   │   │
│  │                                                                       │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │   │
│  │   │  Graph      │  │  Schema     │  │  Validator  │                │   │
│  │   │  Definition │  │  Definition │  │             │                │   │
│  │   └─────────────┘  └─────────────┘  └─────────────┘                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       Workflow Engine                                  │   │
│  │                          工作流引擎                                   │   │
│  │                                                                       │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │   │
│  │   │  Executor   │  │  Scheduler │  │  State      │                │   │
│  │   │             │  │            │  │  Manager    │                │   │
│  │   └─────────────┘  └─────────────┘  └─────────────┘                │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Agent Layer                                   │   │
│  │                           Agent 层                                    │   │
│  │                                                                       │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │   │
│  │   │  Idea       │  │  Architect │  │  Coder      │                │   │
│  │   │  Generator  │  │            │  │             │                │   │
│  │   └─────────────┘  └─────────────┘  └─────────────┘                │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 工作流定义模型

```typescript
// 工作流定义

interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;

  // 节点定义
  nodes: WorkflowNode[];

  // 边定义
  edges: WorkflowEdge[];

  // 入口和出口
  entryNode: string;
  exitNodes: string[];

  // 配置
  config: WorkflowConfig;

  // 元数据
  metadata: {
    author: string;
    createdAt: Date;
    updatedAt: Date;
    tags: string[];
  };
}

interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;

  // Agent 配置
  agent?: {
    type: string;           // Agent 类型
    input: Record<string, any>;  // 输入参数
    output?: string;        // 输出绑定
  };

  // 条件配置
  condition?: {
    type: 'expression' | 'function' | 'agent';
    expression?: string;
    functionName?: string;
  };

  // 并行配置
  parallel?: {
    enabled: boolean;
    branches: string[];
    strategy: 'all' | 'any' | 'race' | 'sequential';
    waitFor?: number;  // 超时时间
  };

  // 循环配置
  loop?: {
    enabled: boolean;
    maxIterations: number;
    untilCondition?: string;
  };

  // 错误处理
  error?: {
    strategy: 'retry' | 'skip' | 'fail' | 'continue';
    maxRetries?: number;
    backoff?: 'fixed' | 'exponential';
    delay?: number;
  };

  // 超时配置
  timeout?: {
    duration: number;  // ms
    action?: 'fail' | 'continue' | 'skip';
  };

  // UI 配置
  ui?: {
    position: { x: number; y: number };
    icon?: string;
    color?: string;
  };
}

type NodeType =
  | 'agent'       // Agent 执行节点
  | 'condition'   // 条件分支
  | 'parallel'    // 并行执行
  | 'loop'        // 循环执行
  | 'wait'        // 等待事件
  | 'notify'      // 发送通知
  | 'end'         // 结束节点
  | 'start';      // 开始节点

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;

  // 条件
  condition?: {
    type: 'always' | 'success' | 'failure' | 'expression';
    expression?: string;
  };

  // 权重（用于条件分支）
  weight?: number;

  // UI 配置
  ui?: {
    label?: string;
    animated?: boolean;
  };
}

interface WorkflowConfig {
  // 并发控制
  concurrency?: {
    maxParallelNodes: number;
    maxConcurrentWorkflows: number;
  };

  // 重试策略
  retry?: {
    enabled: boolean;
    maxAttempts: number;
    backoff: 'fixed' | 'exponential';
    initialDelay: number;
    maxDelay: number;
  };

  // 超时策略
  timeout?: {
    workflow: number;  // 整个工作流超时
    node: number;      // 单个节点超时
  };

  // 持久化
  persistence?: {
    saveStateInterval: number;
    saveOnError: boolean;
  };

  // 监控
  monitoring?: {
    emitEvents: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}
```

## 2. 核心工作流定义

### 2.1 项目生成主工作流

```typescript
// 项目生成工作流

const projectGenerationWorkflow: WorkflowDefinition = {
  id: 'project-generation',
  name: 'Project Generation Workflow',
  version: '1.0.0',
  description: '端到端项目生成工作流',

  nodes: [
    // 开始节点
    {
      id: 'start',
      type: 'start',
      name: '开始',
      ui: { position: { x: 0, y: 300 }, icon: 'play' }
    },

    // 1. 需求生成阶段
    {
      id: 'ideation',
      type: 'agent',
      name: '创意生成',
      agent: { type: 'IdeaGenerator' },
      timeout: { duration: 120000 },
      ui: { position: { x: 200, y: 300 }, icon: 'lightbulb', color: '#FFD700' }
    },

    {
      id: 'idea-evaluation',
      type: 'condition',
      name: '创意评估',
      condition: {
        type: 'expression',
        expression: 'ideation.valueScore >= 0.7'
      },
      ui: { position: { x: 350, y: 300 }, icon: 'question' }
    },

    // 2. 架构设计阶段
    {
      id: 'architecture',
      type: 'agent',
      name: '架构设计',
      agent: { type: 'Architect' },
      timeout: { duration: 180000 },
      error: { strategy: 'retry', maxRetries: 2 },
      ui: { position: { x: 500, y: 250 }, icon: 'drafting', color: '#4169E1' }
    },

    {
      id: 'arch-review',
      type: 'agent',
      name: '架构评审',
      agent: { type: 'ArchitectReviewer' },
      ui: { position: { x: 650, y: 250 }, icon: 'search' }
    },

    // 3. 代码生成阶段（可并行）
    {
      id: 'code-generation',
      type: 'parallel',
      name: '代码生成',
      parallel: {
        enabled: true,
        branches: ['frontend-code', 'backend-code', 'config-code'],
        strategy: 'all'
      },
      timeout: { duration: 600000 },
      ui: { position: { x: 800, y: 300 }, icon: 'code', color: '#32CD32' }
    },

    {
      id: 'frontend-code',
      type: 'agent',
      name: '前端代码',
      agent: { type: 'FrontendCoder' },
      ui: { position: { x: 750, y: 150 }, icon: 'monitor' }
    },

    {
      id: 'backend-code',
      type: 'agent',
      name: '后端代码',
      agent: { type: 'BackendCoder' },
      ui: { position: { x: 800, y: 250 }, icon: 'server' }
    },

    {
      id: 'config-code',
      type: 'agent',
      name: '配置文件',
      agent: { type: 'ConfigCoder' },
      ui: { position: { x: 850, y: 350 }, icon: 'file' }
    },

    // 4. 测试生成阶段
    {
      id: 'test-generation',
      type: 'agent',
      name: '测试生成',
      agent: { type: 'Tester' },
      timeout: { duration: 300000 },
      ui: { position: { x: 950, y: 300 }, icon: 'test', color: '#FF6347' }
    },

    // 5. 质量审查阶段
    {
      id: 'quality-gate',
      type: 'condition',
      name: '质量门禁',
      condition: {
        type: 'function',
        functionName: 'evaluateQualityGate'
      },
      ui: { position: { x: 1100, y: 300 }, icon: 'shield', color: '#9400D3' }
    },

    {
      id: 'review',
      type: 'agent',
      name: '代码审查',
      agent: { type: 'Reviewer' },
      timeout: { duration: 180000 },
      ui: { position: { x: 1250, y: 250 }, icon: 'eye' }
    },

    // 6. 部署阶段
    {
      id: 'deploy',
      type: 'agent',
      name: '部署',
      agent: { type: 'Deployer' },
      timeout: { duration: 300000 },
      error: { strategy: 'retry', maxRetries: 3 },
      ui: { position: { x: 1400, y: 300 }, icon: 'rocket', color: '#FF4500' }
    },

    // 7. 知识沉淀
    {
      id: 'knowledge',
      type: 'agent',
      name: '知识沉淀',
      agent: { type: 'KnowledgeExtractor' },
      ui: { position: { x: 1550, y: 300 }, icon: 'database', color: '#00CED1' }
    },

    // 结束节点
    {
      id: 'end',
      type: 'end',
      name: '结束',
      ui: { position: { x: 1700, y: 300 }, icon: 'flag' }
    },

    // 失败节点
    {
      id: 'failed',
      type: 'end',
      name: '失败',
      ui: { position: { x: 1100, y: 450 }, icon: 'x-circle', color: '#DC143C' }
    }
  ],

  edges: [
    // 开始 → 创意生成
    { source: 'start', target: 'ideation', ui: { label: '' } },

    // 创意生成 → 创意评估
    { source: 'ideation', target: 'idea-evaluation' },

    // 创意评估 → 架构设计（通过）
    {
      source: 'idea-evaluation',
      target: 'architecture',
      condition: { type: 'success' }
    },

    // 创意评估 → 失败（不通过）
    {
      source: 'idea-evaluation',
      target: 'failed',
      condition: { type: 'failure' }
    },

    // 架构设计 → 架构评审
    { source: 'architecture', target: 'arch-review' },

    // 架构评审 → 代码生成
    { source: 'arch-review', target: 'code-generation' },

    // 代码生成 → 测试生成
    { source: 'code-generation', target: 'test-generation' },

    // 测试生成 → 质量门禁
    { source: 'test-generation', target: 'quality-gate' },

    // 质量门禁 → 审查（通过）
    {
      source: 'quality-gate',
      target: 'review',
      condition: { type: 'expression', expression: 'quality.passed' }
    },

    // 质量门禁 → 代码生成（不通过，重试）
    {
      source: 'quality-gate',
      target: 'code-generation',
      condition: { type: 'expression', expression: '!quality.passed && retryCount < maxRetries' }
    },

    // 质量门禁 → 失败
    {
      source: 'quality-gate',
      target: 'failed',
      condition: { type: 'expression', expression: '!quality.passed && retryCount >= maxRetries' }
    },

    // 审查 → 部署
    { source: 'review', target: 'deploy' },

    // 部署 → 知识沉淀
    { source: 'deploy', target: 'knowledge' },

    // 知识沉淀 → 结束
    { source: 'knowledge', target: 'end' }
  ],

  entryNode: 'start',
  exitNodes: ['end', 'failed'],

  config: {
    concurrency: {
      maxParallelNodes: 10,
      maxConcurrentWorkflows: 5
    },
    retry: {
      enabled: true,
      maxAttempts: 3,
      backoff: 'exponential',
      initialDelay: 1000,
      maxDelay: 30000
    },
    timeout: {
      workflow: 3600000,  // 1 小时
      node: 600000        // 10 分钟
    },
    persistence: {
      saveStateInterval: 30000,
      saveOnError: true
    },
    monitoring: {
      emitEvents: true,
      logLevel: 'info'
    }
  },

  metadata: {
    author: 'system',
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: ['project', 'generation', 'full-stack']
  }
};
```

### 2.2 简单项目工作流（优化版）

```typescript
// 简单项目工作流 - 用于低复杂度项目

const simpleProjectWorkflow: WorkflowDefinition = {
  id: 'simple-project-generation',
  name: 'Simple Project Generation Workflow',
  version: '1.0.0',
  description: '用于简单项目的精简工作流',

  nodes: [
    { id: 'start', type: 'start', name: '开始' },
    {
      id: 'generate',
      type: 'agent',
      name: '一体化生成',
      agent: { type: 'SimpleProjectCoder' },  // 一个 Agent 完成所有代码
      timeout: { duration: 600000 }
    },
    {
      id: 'test',
      type: 'agent',
      name: '测试',
      agent: { type: 'Tester' },
      timeout: { duration: 180000 }
    },
    {
      id: 'quality-check',
      type: 'condition',
      name: '质量检查',
      condition: { type: 'expression', expression: 'quality.coverage >= 80 && quality.errors == 0' }
    },
    {
      id: 'deploy',
      type: 'agent',
      name: '部署',
      agent: { type: 'Deployer' }
    },
    { id: 'end', type: 'end', name: '结束' },
    { id: 'failed', type: 'end', name: '失败' }
  ],

  edges: [
    { source: 'start', target: 'generate' },
    { source: 'generate', target: 'test' },
    { source: 'test', target: 'quality-check' },
    { source: 'quality-check', target: 'deploy', condition: { type: 'success' } },
    { source: 'quality-check', target: 'failed', condition: { type: 'failure' } },
    { source: 'deploy', target: 'end' }
  ],

  entryNode: 'start',
  exitNodes: ['end', 'failed'],

  config: {
    concurrency: { maxParallelNodes: 5, maxConcurrentWorkflows: 3 },
    timeout: { workflow: 1800000, node: 600000 }  // 30 分钟总超时
  }
};
```

### 2.3 复杂项目工作流（并行版）

```typescript
// 复杂项目工作流 - 充分利用并行能力

const complexProjectWorkflow: WorkflowDefinition = {
  id: 'complex-project-generation',
  name: 'Complex Project Generation Workflow',
  version: '1.0.0',

  nodes: [
    { id: 'start', type: 'start', name: '开始' },

    // 架构设计
    {
      id: 'architecture',
      type: 'agent',
      name: '架构设计',
      agent: { type: 'Architect' }
    },

    // 模块划分
    {
      id: 'module-planning',
      type: 'agent',
      name: '模块规划',
      agent: { type: 'ModulePlanner' }
    },

    // 并行生成各模块
    {
      id: 'parallel-modules',
      type: 'parallel',
      name: '并行模块生成',
      parallel: {
        enabled: true,
        branches: ['module-auth', 'module-api', 'module-frontend', 'module-db'],
        strategy: 'all'
      }
    },

    { id: 'module-auth', type: 'agent', name: '认证模块', agent: { type: 'AuthCoder' } },
    { id: 'module-api', type: 'agent', name: 'API模块', agent: { type: 'ApiCoder' } },
    { id: 'module-frontend', type: 'agent', name: '前端模块', agent: { type: 'FrontendCoder' } },
    { id: 'module-db', type: 'agent', name: '数据库模块', agent: { type: 'DbCoder' } },

    // 集成
    {
      id: 'integration',
      type: 'agent',
      name: '集成测试',
      agent: { type: 'IntegrationTester' }
    },

    // 部署
    { id: 'deploy', type: 'agent', name: '部署', agent: { type: 'Deployer' } },
    { id: 'end', type: 'end', name: '结束' },
    { id: 'failed', type: 'end', name: '失败' }
  ],

  edges: [
    { source: 'start', target: 'architecture' },
    { source: 'architecture', target: 'module-planning' },
    { source: 'module-planning', target: 'parallel-modules' },
    { source: 'parallel-modules', target: 'integration' },
    { source: 'integration', target: 'deploy' },
    { source: 'deploy', target: 'end' }
  ],

  entryNode: 'start',
  exitNodes: ['end', 'failed']
};
```

## 3. 工作流引擎实现

### 3.1 引擎核心

```typescript
// 工作流引擎

class WorkflowEngine {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private executor: AgentExecutor;
  private stateManager: StateManager;
  private eventBus: EventBus;

  // 注册工作流
  registerWorkflow(workflow: WorkflowDefinition): void {
    // 验证工作流
    this.validateWorkflow(workflow);

    // 存储
    this.workflows.set(workflow.id, workflow);

    // 发布事件
    this.eventBus.publish({
      type: 'workflow.registered',
      payload: { workflowId: workflow.id, version: workflow.version }
    });
  }

  // 验证工作流
  private validateWorkflow(workflow: WorkflowDefinition): void {
    // 1. 检查入口节点存在
    if (!workflow.nodes.find(n => n.id === workflow.entryNode)) {
      throw new ValidationError('Entry node not found');
    }

    // 2. 检查出口节点存在
    for (const exitNode of workflow.exitNodes) {
      if (!workflow.nodes.find(n => n.id === exitNode)) {
        throw new ValidationError(`Exit node ${exitNode} not found`);
      }
    }

    // 3. 检查所有边的节点引用有效
    for (const edge of workflow.edges) {
      if (!workflow.nodes.find(n => n.id === edge.source)) {
        throw new ValidationError(`Edge source ${edge.source} not found`);
      }
      if (!workflow.nodes.find(n => n.id === edge.target)) {
        throw new ValidationError(`Edge target ${edge.target} not found`);
      }
    }

    // 4. 检查没有孤立节点
    const connectedNodes = new Set<string>();
    for (const edge of workflow.edges) {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    }
    for (const node of workflow.nodes) {
      if (node.type !== 'start' && node.type !== 'end' && !connectedNodes.has(node.id)) {
        throw new ValidationError(`Isolated node: ${node.id}`);
      }
    }
  }

  // 执行工作流
  async execute(
    workflowId: string,
    input: Record<string, any>,
    context: ExecutionContext
  ): Promise<WorkflowResult> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new WorkflowNotFoundError(workflowId);
    }

    // 创建执行实例
    const execution: WorkflowExecution = {
      id: generateId(),
      workflowId,
      workflowVersion: workflow.version,
      status: 'running',
      input,
      currentNode: workflow.entryNode,
      state: { ...input },
      history: [],
      startedAt: new Date()
    };

    this.executions.set(execution.id, execution);

    try {
      // 执行主循环
      while (execution.status === 'running') {
        // 检查超时
        if (this.isTimeout(execution, workflow)) {
          execution.status = 'timeout';
          break;
        }

        // 获取当前节点
        const node = workflow.nodes.find(n => n.id === execution.currentNode);
        if (!node) {
          execution.status = 'failed';
          break;
        }

        // 执行节点
        const result = await this.executeNode(execution, node, context);

        // 处理结果
        this.handleNodeResult(execution, node, result, workflow);
      }

      // 计算结果
      return this.calculateResult(execution);
    } catch (error) {
      execution.status = 'failed';
      execution.error = error as Error;
      throw error;
    } finally {
      // 持久化执行状态
      await this.stateManager.save(execution);
    }
  }

  // 执行单个节点
  private async executeNode(
    execution: WorkflowExecution,
    node: WorkflowNode,
    context: ExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now();

    try {
      // 超时检查
      if (node.timeout) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new TimeoutError()), node.timeout!.duration);
        });
      }

      let result: NodeExecutionResult;

      switch (node.type) {
        case 'start':
        case 'end':
          result = { success: true, output: null };
          break;

        case 'agent':
          result = await this.executeAgentNode(execution, node, context);
          break;

        case 'condition':
          result = await this.executeConditionNode(execution, node, context);
          break;

        case 'parallel':
          result = await this.executeParallelNode(execution, node, context);
          break;

        case 'loop':
          result = await this.executeLoopNode(execution, node, context);
          break;

        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }

      // 记录历史
      execution.history.push({
        nodeId: node.id,
        startTime,
        endTime: Date.now(),
        result
      });

      return result;
    } catch (error) {
      return this.handleNodeError(execution, node, error as Error);
    }
  }

  // 执行 Agent 节点
  private async executeAgentNode(
    execution: WorkflowExecution,
    node: WorkflowNode,
    context: ExecutionContext
  ): Promise<NodeExecutionResult> {
    const agent = this.executor.getAgent(node.agent!.type);

    // 准备输入
    const input = this.prepareInput(node.agent!.input, execution.state);

    // 执行
    const agentResult = await agent.execute(input, context);

    // 更新状态
    if (node.agent!.output) {
      execution.state[node.agent!.output] = agentResult.output;
    }

    return {
      success: agentResult.success,
      output: agentResult.output,
      artifacts: agentResult.artifacts,
      metrics: agentResult.metrics,
      errors: agentResult.errors
    };
  }

  // 执行条件节点
  private async executeConditionNode(
    execution: WorkflowExecution,
    node: WorkflowNode,
    context: ExecutionContext
  ): Promise<NodeExecutionResult> {
    const condition = node.condition!;

    let passed: boolean;

    switch (condition.type) {
      case 'expression':
        passed = this.evaluateExpression(condition.expression!, execution.state);
        break;

      case 'function':
        passed = this.evaluateFunction(condition.functionName!, execution.state);
        break;

      case 'agent':
        passed = await this.evaluateWithAgent(condition, execution, context);
        break;

      default:
        passed = true;
    }

    return {
      success: true,
      output: { passed }
    };
  }

  // 执行并行节点
  private async executeParallelNode(
    execution: WorkflowExecution,
    node: WorkflowNode,
    context: ExecutionContext
  ): Promise<NodeExecutionResult> {
    const { branches, strategy, waitFor } = node.parallel!;

    const branchPromises = branches.map(branchId =>
      this.executeBranch(execution, branchId, context)
    );

    let results: NodeExecutionResult[];

    switch (strategy) {
      case 'all':
        results = await Promise.all(branchPromises);
        break;

      case 'any':
        results = [await Promise.any(branchPromises)];
        break;

      case 'race':
        results = [await Promise.race(branchPromises)];
        break;

      case 'sequential':
        results = [];
        for (const branchId of branches) {
          const branchResult = await this.executeBranch(execution, branchId, context);
          results.push(branchResult);
          if (!branchResult.success) break;
        }
        break;
    }

    const allSuccess = results.every(r => r.success);

    return {
      success: allSuccess,
      output: { results }
    };
  }

  // 处理节点结果
  private handleNodeResult(
    execution: WorkflowExecution,
    node: WorkflowNode,
    result: NodeExecutionResult,
    workflow: WorkflowDefinition
  ): void {
    // 确定下一个节点
    const nextNode = this.determineNextNode(
      execution.currentNode,
      result,
      workflow
    );

    if (nextNode) {
      execution.currentNode = nextNode;
    } else {
      // 检查是否到达出口
      if (workflow.exitNodes.includes(execution.currentNode)) {
        execution.status = 'completed';
        execution.completedAt = new Date();
      }
    }
  }

  // 确定下一个节点
  private determineNextNode(
    currentNodeId: string,
    result: NodeExecutionResult,
    workflow: WorkflowDefinition
  ): string | null {
    const outgoingEdges = workflow.edges.filter(e => e.source === currentNodeId);

    for (const edge of outgoingEdges) {
      if (this.evaluateEdgeCondition(edge, result, workflow)) {
        return edge.target;
      }
    }

    return null;
  }
}
```

### 3.2 状态管理

```typescript
// 状态管理

interface ExecutionState {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  currentNode: string;
  state: Record<string, any>;
  history: NodeExecutionRecord[];
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: Error;
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

class StateManager {
  private persistence: StatePersistence;
  private cache: Map<string, ExecutionState> = new Map();

  // 保存状态
  async save(execution: WorkflowExecution): Promise<void> {
    const state = this.toExecutionState(execution);

    // 更新缓存
    this.cache.set(execution.id, state);

    // 持久化
    await this.persistence.save(state);
  }

  // 加载状态
  async load(executionId: string): Promise<ExecutionState | null> {
    // 先检查缓存
    if (this.cache.has(executionId)) {
      return this.cache.get(executionId)!;
    }

    // 从持久化加载
    const state = await this.persistence.load(executionId);
    if (state) {
      this.cache.set(executionId, state);
    }

    return state;
  }

  // 恢复执行
  async resume(executionId: string, context: ExecutionContext): Promise<void> {
    const state = await this.load(executionId);
    if (!state) {
      throw new ExecutionNotFoundError(executionId);
    }

    if (state.status !== 'paused') {
      throw new Error(`Cannot resume execution in status: ${state.status}`);
    }

    // 恢复执行
    const engine = new WorkflowEngine(/* ... */);
    await engine.resume(state, context);
  }
}
```

## 4. 工作流监控

### 4.1 执行监控

```typescript
// 工作流监控

interface WorkflowMetrics {
  executionId: string;
  workflowId: string;
  status: ExecutionStatus;
  progress: number;  // 0-100
  currentNode: string;
  elapsedTime: number;
  estimatedRemaining: number;
  nodeMetrics: Map<string, NodeMetrics>;
}

interface NodeMetrics {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
  retryCount: number;
  error?: string;
}

// 监控服务
class WorkflowMonitor {
  private metricsCollector: MetricsCollector;
  private eventBus: EventBus;

  // 启动监控
  startMonitoring(executionId: string): void {
    // 定期收集指标
    const interval = setInterval(async () => {
      const metrics = await this.collectMetrics(executionId);
      this.emitMetrics(executionId, metrics);
    }, 5000);  // 每 5 秒

    // 存储 interval ID
    this.activeMonitors.set(executionId, interval);
  }

  // 停止监控
  stopMonitoring(executionId: string): void {
    const interval = this.activeMonitors.get(executionId);
    if (interval) {
      clearInterval(interval);
      this.activeMonitors.delete(executionId);
    }
  }

  // 收集指标
  private async collectMetrics(executionId: string): Promise<WorkflowMetrics> {
    const execution = await this.stateManager.load(executionId);

    return {
      executionId,
      workflowId: execution!.workflowId,
      status: execution!.status,
      progress: this.calculateProgress(execution!),
      currentNode: execution!.currentNode,
      elapsedTime: Date.now() - execution!.startedAt.getTime(),
      estimatedRemaining: this.estimateRemaining(execution!),
      nodeMetrics: this.collectNodeMetrics(execution!)
    };
  }
}

// WebSocket 实时推送
class WorkflowRealtimeServer {
  private wss: WebSocketServer;
  private subscriptions: Map<string, Set<WebSocket>> = new Map();

  // 订阅执行
  subscribe(executionId: string, ws: WebSocket): void {
    if (!this.subscriptions.has(executionId)) {
      this.subscriptions.set(executionId, new Set());
    }
    this.subscriptions.get(executionId)!.add(ws);

    // 发送最新状态
    const state = await this.stateManager.load(executionId);
    ws.send(JSON.stringify({ type: 'state', data: state }));
  }

  // 广播更新
  broadcast(executionId: string, update: WorkflowUpdate): void {
    const subscribers = this.subscriptions.get(executionId);
    if (subscribers) {
      const message = JSON.stringify(update);
      for (const ws of subscribers) {
        ws.send(message);
      }
    }
  }
}
```

### 4.2 告警规则

```typescript
// 告警规则

interface AlertRule {
  id: string;
  name: string;
  condition: AlertCondition;
  severity: 'info' | 'warning' | 'critical';
  cooldown: number;  // 重复告警间隔
}

interface AlertCondition {
  type: 'timeout' | 'error_rate' | 'duration' | 'failure';
  threshold: number;
  window?: number;  // 时间窗口 ms
}

const defaultAlertRules: AlertRule[] = [
  {
    id: 'execution-timeout',
    name: '执行超时告警',
    condition: { type: 'timeout', threshold: 3600000 },  // 1 小时
    severity: 'critical',
    cooldown: 300000
  },
  {
    id: 'node-timeout',
    name: '节点超时告警',
    condition: { type: 'timeout', threshold: 600000 },  // 10 分钟
    severity: 'warning',
    cooldown: 300000
  },
  {
    id: 'failure-rate',
    name: '失败率告警',
    condition: { type: 'failure', threshold: 0.3, window: 3600000 },
    severity: 'critical',
    cooldown: 600000
  },
  {
    id: 'slow-execution',
    name: '慢执行告警',
    condition: { type: 'duration', threshold: 1800000 },  // 30 分钟
    severity: 'info',
    cooldown: 600000
  }
];

// 告警处理
class AlertManager {
  async checkAndAlert(executionId: string, metrics: WorkflowMetrics): Promise<void> {
    for (const rule of this.alertRules) {
      if (await this.isConditionMet(rule, metrics)) {
        if (this.canAlert(rule)) {
          await this.sendAlert(rule, metrics);
          this.recordAlert(rule);
        }
      }
    }
  }
}
```

---

**版本**: 1.0.0
**创建日期**: 2026-04-14
**状态**: 工作流编排设计完成
