# Human-in-the-Loop 系统

## 1. 概述

本文档定义 ProjectFactory 系统的 Human-in-the-Loop（人机协作）能力设计，解决 think.md 中"人机协作模式"——AI 处理 80% 常规工作，人类聚焦 20% 关键决策。

### 1.1 人机协作架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        人机协作系统架构                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       协作管理层                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  决策路由    │  │  介入触发    │  │  状态同步    │              │   │
│  │  │ Decision     │  │ Intervention │  │ State Sync   │              │   │
│  │  │  Router     │  │  Trigger     │  │              │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────┼─────────────────────────────────┐   │
│  │                           介入层                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  审批节点    │  │  确认节点    │  │  咨询节点    │              │   │
│  │  │  Approval    │  │  Confirm     │  │   Consult    │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  否决节点    │  │  仲裁节点    │  │  反馈节点    │              │   │
│  │  │   Veto      │  │  Arbitrate   │  │   Feedback   │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────┼─────────────────────────────────┐   │
│  │                           通知层                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  实时通知    │  │  待办列表    │  │  决策面板    │              │   │
│  │  │  Real-time   │  │  Todo List   │  │ Decision    │              │   │
│  │  │  Notif      │  │              │  │ Panel       │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 协作模式

```typescript
// 人机协作模式
enum HumanInterventionMode {
  // 完全自动
  FULL_AUTO = 'full-auto',             // 无需人工干预

  // 审批模式
  APPROVAL = 'approval',               // 需要审批才能继续

  // 确认模式
  CONFIRM = 'confirm',                // 需要确认信息

  // 咨询模式
  CONSULT = 'consult',                // 寻求建议但不强制

  // 监控模式
  MONITOR = 'monitor',                // 人工监控但不干预

  // 仲裁模式
  ARBITRATE = 'arbitrate'            // 需要仲裁决策
}

// 介入级别
enum InterventionLevel {
  NONE = 0,            // 无介入
  LOW = 1,            // 低介入 - 提供建议
  MEDIUM = 2,         // 中介入 - 需要确认
  HIGH = 3,           // 高介入 - 需要审批
  CRITICAL = 4        // 关键介入 - 必须人工决策
}

// 决策点配置
interface DecisionPointConfig {
  id: string;
  name: string;
  description: string;
  mode: HumanInterventionMode;
  interventionLevel: InterventionLevel;
  autoEscalateAfter?: number;        // 自动升级时间 (ms)
  assignableTo: string[];           // 可分配角色
  timeoutAction: 'approve' | 'reject' | 'escalate' | 'skip';
}
```

---

## 2. 决策路由系统

### 2.1 决策点定义

```typescript
// 决策点
interface DecisionPoint {
  id: string;
  type: DecisionPointType;
  context: DecisionContext;
  requiredLevel: InterventionLevel;
  status: DecisionStatus;
  assignee?: HumanAssignee;
  createdAt: Date;
  deadline?: Date;
  decision?: HumanDecision;
}

// 决策点类型
enum DecisionPointType {
  // 项目级决策
  PROJECT_APPROVAL = 'project-approval',       // 项目审批
  PROJECT_REJECT = 'project-reject',          // 项目拒绝
  PROJECT_PRIORITY = 'project-priority',      // 优先级调整

  // 架构级决策
  ARCHITECTURE_APPROVAL = 'architecture-approval', // 架构审批
  TECH_STACK_CHANGE = 'tech-stack-change',   // 技术栈变更

  // 代码级决策
  CODE_REVIEW = 'code-review',              // 代码审查
  SECURITY_EXCEPTION = 'security-exception', // 安全例外
  DEPENDENCY_APPROVAL = 'dependency-approval', // 依赖审批

  // 质量级决策
  QUALITY_GATE_BYPASS = 'quality-gate-bypass', // 质量门绕过
  RELEASE_DECISION = 'release-decision',     // 发布决策

  // 冲突决策
  CONFLICT_RESOLUTION = 'conflict-resolution', // 冲突解决
  PRIORITY_CONFLICT = 'priority-conflict',   // 优先级冲突

  // 异常决策
  EXCEPTION_HANDLING = 'exception-handling', // 异常处理
  ESCALATION = 'escalation'                 // 升级处理
}

// 决策上下文
interface DecisionContext {
  taskId: string;
  projectId?: string;
  decisionType: DecisionPointType;
  summary: string;                    // 决策摘要
  details: Record<string, unknown>;   // 详细信息
  options?: DecisionOption[];         // 可选方案
  recommended?: string;              // 推荐方案
  uncertainty?: UncertaintyInfo;      // 不确定性信息
  risk?: RiskAssessment;             // 风险评估
  history?: DecisionHistory[];        // 决策历史
}

// 不确定性信息
interface UncertaintyInfo {
  level: 'low' | 'medium' | 'high';
  factors: string[];
  confidence: number;                // 置信度 0-1
  ambiguousPoints: string[];
  dataQuality: 'good' | 'fair' | 'poor';
}
```

### 2.2 路由引擎

```typescript
// 决策路由引擎
class DecisionRouter {
  private rules: RoutingRule[];
  private mlModel?: RoutingModel;

  // 路由决策
  async route(context: DecisionContext): Promise<RoutingDecision> {
    // 1. 匹配规则
    const matchedRules = this.matchRules(context);

    if (matchedRules.length > 0) {
      // 使用规则
      return this.applyRules(matchedRules, context);
    }

    // 2. 使用 ML 模型
    if (this.mlModel) {
      return this.applyMLModel(context);
    }

    // 3. 默认路由
    return this.defaultRouting(context);
  }

  // 匹配路由规则
  private matchRules(context: DecisionContext): RoutingRule[] {
    return this.rules
      .filter(rule => this.evaluateCondition(rule.condition, context))
      .sort((a, b) => b.priority - a.priority);
  }

  // 应用规则
  private applyRules(
    rules: RoutingRule[],
    context: DecisionContext
  ): RoutingDecision {
    const topRule = rules[0];

    return {
      interventionLevel: topRule.interventionLevel,
      mode: topRule.mode,
      assignee: topRule.assignee,
      reason: `Matched rule: ${topRule.name}`,
      confidence: 1.0
    };
  }

  // ML 模型路由
  private async applyMLModel(
    context: DecisionContext
  ): Promise<RoutingDecision> {
    const features = this.extractFeatures(context);
    const prediction = await this.mlModel.predict(features);

    return {
      interventionLevel: prediction.level,
      mode: prediction.mode,
      assignee: prediction.assignee,
      reason: 'ML model prediction',
      confidence: prediction.confidence
    };
  }

  // 评估条件
  private evaluateCondition(
    condition: RoutingCondition,
    context: DecisionContext
  ): boolean {
    switch (condition.type) {
      case 'risk-above':
        return (context.risk?.level || 0) >= condition.value;
      case 'uncertainty-above':
        return (context.uncertainty?.confidence || 1) <= condition.value;
      case 'project-type':
        return context.details['projectType'] === condition.value;
      case 'value-below':
        return (context.details['estimatedValue'] as number) < condition.value;
      case 'contains-blocked':
        return condition.values.some(v =>
          JSON.stringify(context.details).includes(v)
        );
      default:
        return false;
    }
  }
}

// 路由规则
interface RoutingRule {
  id: string;
  name: string;
  condition: RoutingCondition;
  interventionLevel: InterventionLevel;
  mode: HumanInterventionMode;
  assignee?: string;
  priority: number;
  enabled: boolean;
}

// 路由条件
interface RoutingCondition {
  type: 'risk-above' | 'uncertainty-above' | 'project-type' | 'value-below' | 'contains-blocked';
  value?: number | string;
  values?: string[];
}

// 路由决策
interface RoutingDecision {
  interventionLevel: InterventionLevel;
  mode: HumanInterventionMode;
  assignee?: string;
  reason: string;
  confidence: number;
  autoApproveIf?: {
    condition: string;
    action: string;
  };
}
```

### 2.3 自动升级机制

```typescript
// 自动升级管理器
class EscalationManager {
  private escalationPaths: Map<string, EscalationPath>;
  private notificationService: NotificationService;

  // 检查是否需要升级
  async checkEscalation(decisionPoint: DecisionPoint): Promise<boolean> {
    if (!decisionPoint.deadline) return false;

    const now = Date.now();
    const deadline = decisionPoint.deadline.getTime();

    // 已超时
    if (now > deadline) {
      return true;
    }

    // 即将超时
    const warningThreshold = 0.2; // 20% 剩余时间
    const timeRemaining = deadline - now;
    const totalTime = deadline - decisionPoint.createdAt.getTime();

    if (timeRemaining / totalTime < warningThreshold) {
      await this.notifyImminentEscalation(decisionPoint);
    }

    return false;
  }

  // 执行升级
  async escalate(decisionPoint: DecisionPoint): Promise<void> {
    const path = this.escalationPaths.get(decisionPoint.type);
    if (!path) {
      throw new Error(`No escalation path for: ${decisionPoint.type}`);
    }

    // 获取下一级处理人
    const nextLevel = this.getNextLevel(decisionPoint.assignee, path);

    // 创建升级记录
    const escalation: Escalation = {
      id: uuid(),
      decisionPointId: decisionPoint.id,
      fromLevel: decisionPoint.assignee?.level || 'human',
      toLevel: nextLevel,
      reason: 'timeout',
      timestamp: new Date()
    };

    // 更新决策点
    decisionPoint.assignee = {
      type: nextLevel === 'manager' ? 'human' : 'role',
      id: nextLevel,
      level: nextLevel
    };

    // 延长截止时间
    decisionPoint.deadline = new Date(
      Date.now() + path.defaultTimeout
    );

    // 通知
    await this.notificationService.sendEscalation(escalation);
  }

  // 配置升级路径
  configureEscalationPath(type: DecisionPointType, path: EscalationPath): void {
    this.escalationPaths.set(type, path);
  }
}

// 升级路径
interface EscalationPath {
  levels: EscalationLevel[];
  defaultTimeout: number;  // ms
  maxEscalations: number;
}

// 升级级别
interface EscalationLevel {
  level: string;
  type: 'human' | 'role' | 'system';
  assignee: string;
  timeout?: number;
}
```

---

## 3. 介入节点设计

### 3.1 审批节点

```typescript
// 审批节点
interface ApprovalNode extends DecisionPoint {
  type: DecisionPointType.PROJECT_APPROVAL;
  content: {
    title: string;
    description: string;
    projectDetails: ProjectDetails;
    impact: ImpactAssessment;
    alternatives?: string[];
    attachments?: Attachment[];
  };
  decision: {
    approve: boolean;
    comments?: string;
    conditions?: string[];        // 批准条件
    delegatedTo?: string;         // 委托给他人
  };
}

// 审批服务
class ApprovalService {
  private approvalWorkflow: ApprovalWorkflow;

  // 发起审批
  async requestApproval(node: ApprovalNode): Promise<ApprovalRequest> {
    // 验证节点完整性
    this.validate(node);

    // 创建审批请求
    const request: ApprovalRequest = {
      id: uuid(),
      nodeId: node.id,
      status: 'pending',
      createdAt: new Date(),
      deadline: this.calculateDeadline(node),
      assignees: await this.determineAssignees(node),
      notifications: await this.createNotifications(node)
    };

    // 发送通知
    await this.notifyAssignees(request);

    return request;
  }

  // 处理审批
  async processApproval(
    requestId: string,
    decision: ApprovalDecision
  ): Promise<ApprovalResult> {
    const request = await this.getRequest(requestId);

    // 验证审批人权限
    if (!this.canApprove(request, decision.userId)) {
      throw new Error('Unauthorized to approve this request');
    }

    // 记录决策
    const result: ApprovalResult = {
      requestId,
      decision: decision.approve ? 'approved' : 'rejected',
      comments: decision.comments,
      conditions: decision.conditions,
      decidedBy: decision.userId,
      decidedAt: new Date()
    };

    // 执行后续动作
    if (decision.approve) {
      await this.handleApproval(result, request);
    } else {
      await this.handleRejection(result, request);
    }

    return result;
  }

  // 批量审批
  async batchApprove(
    requestIds: string[],
    userId: string,
    comments?: string
  ): Promise<BatchApprovalResult> {
    const results: ApprovalResult[] = [];

    for (const id of requestIds) {
      try {
        const result = await this.processApproval(id, {
          userId,
          approve: true,
          comments
        });
        results.push(result);
      } catch (error) {
        results.push({
          requestId: id,
          decision: 'failed',
          error: error.message
        });
      }
    }

    return {
      total: requestIds.length,
      succeeded: results.filter(r => r.decision === 'approved').length,
      failed: results.filter(r => r.decision === 'failed').length,
      results
    };
  }

  // 计算截止时间
  private calculateDeadline(node: ApprovalNode): Date {
    const baseTime = 24 * 60 * 60 * 1000; // 24小时

    // 根据紧急程度调整
    const urgency = node.content.impact?.urgency || 'normal';
    const multipliers = {
      low: 2,
      normal: 1,
      high: 0.5,
      critical: 0.25
    };

    return new Date(Date.now() + baseTime * multipliers[urgency]);
  }
}

// 审批决策
interface ApprovalDecision {
  userId: string;
  approve: boolean;
  comments?: string;
  conditions?: string[];
}
```

### 3.2 确认节点

```typescript
// 确认节点
interface ConfirmNode extends DecisionPoint {
  type: 'info-confirm' | 'change-confirm' | 'action-confirm';
  content: {
    title: string;
    message: string;
    currentState: Record<string, unknown>;
    proposedChange?: Record<string, unknown>;
    impact?: string;
    confirmText?: string;       // 确认按钮文本
    cancelText?: string;        // 取消按钮文本
  };
  response?: {
    confirmed: boolean;
    acknowledged: boolean;
    notes?: string;
  };
}

// 确认服务
class ConfirmationService {
  // 发起确认请求
  async requestConfirmation(node: ConfirmNode): Promise<ConfirmRequest> {
    return {
      id: uuid(),
      nodeId: node.id,
      type: node.type,
      message: node.content.message,
      deadline: node.deadline,
      status: 'pending'
    };
  }

  // 处理确认
  async processConfirmation(
    nodeId: string,
    response: ConfirmResponse
  ): Promise<void> {
    const node = await this.getNode(nodeId);

    if (response.confirmed) {
      // 继续流程
      await this.proceedWithFlow(node);
    } else if (response.acknowledged === false) {
      // 否决并回滚
      await this.rollbackFlow(node);
    } else {
      // 暂停等待进一步指示
      await this.pauseFlow(node, response.notes);
    }
  }
}

// 确认响应
interface ConfirmResponse {
  confirmed: boolean;
  acknowledged?: boolean;  // 仅用于 info-confirm
  notes?: string;
}
```

### 3.3 咨询节点

```typescript
// 咨询节点
interface ConsultNode extends DecisionPoint {
  type: 'advice' | 'review' | 'input';
  content: {
    title: string;
    question: string;
    context: Record<string, unknown>;
    options?: string[];
    requestedExpertise?: string[];  // 所需专业知识
    deadline?: Date;
  };
  response?: {
    advice?: string;
    recommendation?: string;
    voted?: string[];
    drafted?: unknown;
  };
}

// 咨询建议服务
class ConsultationService {
  private expertiseMatcher: ExpertiseMatcher;

  // 发起咨询
  async requestConsultation(node: ConsultNode): Promise<ConsultRequest> {
    // 匹配专家
    const experts = await this.expertiseMatcher.findExperts({
      requiredExpertise: node.content.requestedExpertise,
      context: node.content.context
    });

    return {
      id: uuid(),
      nodeId: node.id,
      question: node.content.question,
      experts,
      responses: [],
      deadline: node.deadline
    };
  }

  // 收集建议
  async collectAdvice(
    consultId: string,
    advice: ExpertAdvice
  ): Promise<void> {
    const request = await this.getConsultRequest(consultId);

    request.responses.push({
      expertId: advice.expertId,
      advice: advice.content,
      confidence: advice.confidence,
      submittedAt: new Date()
    });

    // 检查是否收集足够
    if (request.responses.length >= this.minResponses) {
      await this.synthesizeAdvice(request);
    }
  }

  // 综合建议
  private async synthesizeAdvice(
    request: ConsultRequest
  ): Promise<SynthesizedAdvice> {
    // 使用 LLM 综合所有建议
    const prompt = `
请综合以下专家建议，生成一个综合建议：

专家建议：
${request.responses.map((r, i) => `${i + 1}. ${r.advice}`).join('\n')}

请输出：
1. 综合建议
2. 主要共识点
3. 分歧点
4. 置信度
`;

    const response = await this.llm.generate(prompt);

    return {
      synthesized: response.summary,
      consensus: response.consensus,
      disagreements: response.disagreements,
      confidence: response.confidence,
      expertCount: request.responses.length
    };
  }
}

// 专家建议
interface ExpertAdvice {
  expertId: string;
  content: string;
  confidence: number;
}
```

---

## 4. 状态同步系统

### 4.1 状态管理

```typescript
// 人机协作状态
interface CollaborationState {
  sessionId: string;
  userId?: string;
  agentId: string;
  projectId?: string;
  currentPhase: string;
  pendingDecisions: DecisionPoint[];
  completedDecisions: CompletedDecision[];
  interventions: Intervention[];
  lastSyncAt: Date;
  syncVersion: number;
}

// 状态同步服务
class StateSyncService {
  private subscribers: Map<string, Set<StateSubscriber>> = new Map();
  private stateCache: Map<string, CollaborationState>;

  // 同步状态
  async sync(state: CollaborationState): Promise<void> {
    const previous = this.stateCache.get(state.sessionId);

    // 检测变更
    const changes = this.detectChanges(previous, state);

    // 更新缓存
    this.stateCache.set(state.sessionId, {
      ...state,
      lastSyncAt: new Date(),
      syncVersion: state.syncVersion + 1
    });

    // 通知订阅者
    if (changes.length > 0) {
      await this.notifySubscribers(state.sessionId, changes);
    }
  }

  // 订阅状态变更
  subscribe(
    sessionId: string,
    subscriber: StateSubscriber
  ): () => void {
    if (!this.subscribers.has(sessionId)) {
      this.subscribers.set(sessionId, new Set());
    }
    this.subscribers.get(sessionId)!.add(subscriber);

    return () => {
      this.subscribers.get(sessionId)?.delete(subscriber);
    };
  }

  // 获取当前状态
  async getState(sessionId: string): Promise<CollaborationState | null> {
    return this.stateCache.get(sessionId) || null;
  }

  // 检测变更
  private detectChanges(
    previous: CollaborationState | undefined,
    current: CollaborationState
  ): StateChange[] {
    if (!previous) return [{ type: 'full', data: current }];

    const changes: StateChange[] = [];

    // 检测新增决策点
    const newDecisions = current.pendingDecisions.filter(
      d => !previous.pendingDecisions.find(p => p.id === d.id)
    );
    if (newDecisions.length > 0) {
      changes.push({ type: 'decisions-added', data: newDecisions });
    }

    // 检测完成的决策
    const completedDecisions = current.completedDecisions.filter(
      d => !previous.completedDecisions.find(p => p.id === d.id)
    );
    if (completedDecisions.length > 0) {
      changes.push({ type: 'decisions-completed', data: completedDecisions });
    }

    // 检测阶段变更
    if (previous.currentPhase !== current.currentPhase) {
      changes.push({
        type: 'phase-changed',
        data: { from: previous.currentPhase, to: current.currentPhase }
      });
    }

    return changes;
  }
}

// 状态订阅者
interface StateSubscriber {
  id: string;
  onStateChange: (changes: StateChange[]) => Promise<void>;
  filter?: (change: StateChange) => boolean;
}

// 状态变更
interface StateChange {
  type: 'full' | 'decisions-added' | 'decisions-completed' | 'phase-changed' | 'error';
  data: unknown;
  timestamp: Date;
}
```

### 4.2 冲突解决

```typescript
// 并发控制
class ConcurrencyController {
  private locks: Map<string, Lock> = new Map();

  // 获取操作锁
  async acquireLock(
    resourceId: string,
    operation: string,
    userId: string
  ): Promise<LockHandle> {
    const existing = this.locks.get(resourceId);

    if (existing && existing.userId !== userId) {
      // 检查锁是否过期
      if (Date.now() < existing.expiresAt.getTime()) {
        throw new ConcurrentModificationError(
          `Resource ${resourceId} is locked by ${existing.userId}`
        );
      }
    }

    const lock: Lock = {
      resourceId,
      operation,
      userId,
      acquiredAt: new Date(),
      expiresAt: new Date(Date.now() + this.lockTimeout)
    };

    this.locks.set(resourceId, lock);

    return {
      release: () => this.releaseLock(resourceId, userId)
    };
  }

  // 释放锁
  private releaseLock(resourceId: string, userId: string): void {
    const lock = this.locks.get(resourceId);
    if (lock && lock.userId === userId) {
      this.locks.delete(resourceId);
    }
  }
}

// 操作冲突解决
class OperationConflictResolver {
  // 解决操作冲突
  async resolveConflict(
    localOp: Operation,
    remoteOp: Operation,
    context: ConflictContext
  ): Promise<ResolvedOperation> {
    // 策略：基于时间戳和优先级的合并
    if (localOp.timestamp > remoteOp.timestamp) {
      // 本地操作更新
      return {
        operation: localOp,
        strategy: 'local-wins',
        reason: 'Local operation is newer'
      };
    }

    if (remoteOp.timestamp > localOp.timestamp) {
      // 远程操作更新
      return {
        operation: remoteOp,
        strategy: 'remote-wins',
        reason: 'Remote operation is newer'
      };
    }

    // 时间相同，基于优先级
    if (localOp.priority > remoteOp.priority) {
      return {
        operation: localOp,
        strategy: 'priority-wins',
        reason: 'Local operation has higher priority'
      };
    }

    return {
      operation: remoteOp,
      strategy: 'remote-wins',
      reason: 'Same timestamp, remote has higher priority'
    };
  }

  // 自动合并
  async autoMerge(
    localState: State,
    remoteState: State
  ): Promise<MergeResult> {
    // 尝试自动合并
    const conflicts = this.findConflicts(localState, remoteState);

    if (conflicts.length === 0) {
      return {
        merged: this.mergeWithoutConflict(localState, remoteState),
        conflicts: []
      };
    }

    // 尝试语义合并
    const semanticallyMerged = await this.semanticMerge(
      localState,
      remoteState,
      conflicts
    );

    if (semanticallyMerged) {
      return {
        merged: semanticallyMerged,
        conflicts: []
      };
    }

    // 无法自动合并
    return {
      merged: null,
      conflicts
    };
  }
}
```

---

## 5. 通知与提醒

### 5.1 通知服务

```typescript
// 通知服务
class NotificationService {
  private channels: NotificationChannel[];
  private templates: Map<string, NotificationTemplate>;

  // 发送通知
  async send(notification: Notification): Promise<void> {
    // 选择渠道
    const channel = this.selectChannel(notification);

    // 渲染模板
    const rendered = this.render(notification.template, notification.data);

    // 发送
    await channel.send({
      ...rendered,
      priority: notification.priority,
      metadata: notification.metadata
    });
  }

  // 批量发送
  async sendBatch(notifications: Notification[]): Promise<void> {
    await Promise.all(notifications.map(n => this.send(n)));
  }

  // 选择渠道
  private selectChannel(notification: Notification): NotificationChannel {
    const urgency = notification.priority;

    if (urgency === 'urgent') {
      return this.findChannel('sms') || this.findChannel('push');
    }

    if (urgency === 'high') {
      return this.findChannel('push') || this.findChannel('email');
    }

    return this.findChannel('email') || this.findChannel('in-app');
  }
}

// 通知配置
interface NotificationConfig {
  channels: {
    email: { enabled: boolean; address: string };
    sms: { enabled: boolean; phone: string };
    push: { enabled: boolean; deviceToken: string };
    inApp: { enabled: boolean };
    slack: { enabled: boolean; webhook: string };
  };
  digestFrequency: 'realtime' | 'hourly' | 'daily';
  quietHours: { start: string; end: string };
}

// 决策提醒配置
const decisionReminderConfig = {
  // 即将到期提醒
  beforeDeadline: [
    { offset: '1h', message: 'Decision required in 1 hour' },
    { offset: '30m', message: 'Decision required in 30 minutes' },
    { offset: '10m', message: 'URGENT: Decision required in 10 minutes' }
  ],

  // 已到期提醒
  afterDeadline: [
    { offset: '5m', message: 'Decision deadline passed', escalation: true },
    { offset: '30m', message: 'Decision overdue - escalated', escalation: true }
  ]
};
```

### 5.2 待办管理

```typescript
// 待办服务
class TodoService {
  // 创建待办
  async createTodo(
    userId: string,
    item: TodoItem
  ): Promise<Todo> {
    const todo: Todo = {
      id: uuid(),
      userId,
      type: item.type,
      title: item.title,
      description: item.description,
      priority: item.priority,
      dueDate: item.dueDate,
      decisionPointId: item.decisionPointId,
      status: 'pending',
      createdAt: new Date()
    };

    await this.todoStore.save(todo);
    await this.notifyUser(userId, todo);

    return todo;
  }

  // 获取用户待办
  async getUserTodos(
    userId: string,
    filter?: TodoFilter
  ): Promise<Todo[]> {
    let todos = await this.todoStore.findByUser(userId);

    if (filter?.status) {
      todos = todos.filter(t => t.status === filter.status);
    }

    if (filter?.type) {
      todos = todos.filter(t => t.type === filter.type);
    }

    if (filter?.priority) {
      todos = todos.filter(t => t.priority >= filter.priority);
    }

    // 按优先级和截止日期排序
    return todos.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      if (a.dueDate && b.dueDate) {
        return a.dueDate.getTime() - b.dueDate.getTime();
      }
      return 0;
    });
  }

  // 批量完成
  async batchComplete(
    todoIds: string[],
    userId: string
  ): Promise<BatchResult> {
    const results: { id: string; success: boolean }[] = [];

    for (const id of todoIds) {
      const todo = await this.todoStore.findById(id);

      if (todo.userId !== userId) {
        results.push({ id, success: false });
        continue;
      }

      await this.todoStore.update(id, { status: 'completed' });
      results.push({ id, success: true });
    }

    return {
      total: todoIds.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };
  }
}

// 待办项
interface Todo {
  id: string;
  userId: string;
  type: 'approval' | 'confirmation' | 'consultation' | 'review';
  title: string;
  description?: string;
  priority: number;
  dueDate?: Date;
  decisionPointId?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  createdAt: Date;
}
```

---

## 6. 快速回滚机制

### 6.1 回滚策略

```typescript
// 回滚策略
interface RollbackStrategy {
  id: string;
  name: string;
  type: 'full' | 'partial' | 'incremental';
  trigger: RollbackTrigger;
  steps: RollbackStep[];
  validation: RollbackValidation;
  timeout: number;
}

// 回滚触发条件
interface RollbackTrigger {
  type: 'manual' | 'automatic' | 'scheduled';
  conditions?: RollbackCondition[];
  maxAttempts?: number;
}

// 回滚条件
interface RollbackCondition {
  metric: string;
  operator: '<' | '>' | '<=' | '>=' | '==';
  value: number;
  duration?: number;  // 持续时间 (ms)
}

// 回滚步骤
interface RollbackStep {
  order: number;
  action: 'restore-state' | 'revert-code' | 'restore-config' | 'notify' | 'validate';
  target: string;
  parameters?: Record<string, unknown>;
  rollbackOnFailure: boolean;
}

// 回滚管理器
class RollbackManager {
  private strategies: Map<string, RollbackStrategy>;

  // 执行回滚
  async execute(
    projectId: string,
    strategyId: string,
    targetVersion?: Version
  ): Promise<RollbackResult> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) throw new Error(`Strategy not found: ${strategyId}`);

    const result: RollbackResult = {
      strategyId,
      projectId,
      startTime: new Date(),
      steps: [],
      status: 'in-progress'
    };

    try {
      // 备份当前状态
      await this.backupCurrentState(projectId);

      // 执行回滚步骤
      for (const step of strategy.steps.sort((a, b) => a.order - b.order)) {
        const stepResult = await this.executeStep(step, projectId, targetVersion);
        result.steps.push(stepResult);

        if (!stepResult.success && step.rollbackOnFailure) {
          throw new Error(`Rollback step failed: ${step.action}`);
        }
      }

      // 验证回滚
      const validation = await this.validateRollback(projectId, strategy);
      if (!validation.passed) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      result.status = 'completed';
      result.successful = true;
    } catch (error) {
      result.status = 'failed';
      result.successful = false;
      result.error = error.message;

      // 尝试恢复
      await this.attemptRecovery(projectId);
    }

    result.endTime = new Date();
    result.duration = result.endTime.getTime() - result.startTime.getTime();

    return result;
  }

  // 创建快照
  async createSnapshot(
    projectId: string,
    description?: string
  ): Promise<Snapshot> {
    const snapshot: Snapshot = {
      id: uuid(),
      projectId,
      description,
      files: await this.captureFiles(projectId),
      database: await this.captureDatabase(projectId),
      configuration: await this.captureConfiguration(projectId),
      metadata: {
        createdBy: 'system',
        version: await this.getProjectVersion(projectId),
        timestamp: new Date()
      }
    };

    await this.snapshotStore.save(snapshot);
    return snapshot;
  }
}

// 回滚验证
interface RollbackValidation {
  checks: ValidationCheck[];
  passed: boolean;
  errors?: string[];
}

interface ValidationCheck {
  name: string;
  type: 'file-exists' | 'checksum' | 'service-up' | 'config-match';
  target: string;
  expected: unknown;
}
```

### 6.2 状态恢复

```typescript
// 状态恢复服务
class StateRecoveryService {
  // 恢复到指定快照
  async restoreToSnapshot(
    projectId: string,
    snapshotId: string
  ): Promise<RecoveryResult> {
    const snapshot = await this.getSnapshot(snapshotId);

    if (snapshot.projectId !== projectId) {
      throw new Error('Snapshot does not belong to this project');
    }

    // 恢复文件
    await this.restoreFiles(projectId, snapshot.files);

    // 恢复配置
    await this.restoreConfiguration(projectId, snapshot.configuration);

    // 清理缓存
    await this.clearCaches(projectId);

    // 重启服务
    await this.restartServices(projectId);

    // 验证恢复
    const verification = await this.verifyRecovery(projectId, snapshot);

    return {
      successful: verification.passed,
      verification
    };
  }

  // 增量回滚
  async incrementalRollback(
    projectId: string,
    targetVersion: Version
  ): Promise<void> {
    // 获取当前版本和目标版本之间的变更
    const changes = await this.getChangesBetweenVersions(
      projectId,
      targetVersion
    );

    // 逆向应用变更
    for (const change of changes.reverse()) {
      await this.reverseChange(projectId, change);
    }
  }

  // 验证恢复
  private async verifyRecovery(
    projectId: string,
    snapshot: Snapshot
  ): Promise<RecoveryVerification> {
    const results: CheckResult[] = [];

    // 验证文件
    for (const file of snapshot.files) {
      const exists = await this.fileExists(projectId, file.path);
      const checksum = exists ? await this.calculateChecksum(projectId, file.path) : null;

      results.push({
        type: 'file',
        target: file.path,
        passed: exists && checksum === file.checksum,
        details: { exists, checksum }
      });
    }

    // 验证配置
    const currentConfig = await this.getConfiguration(projectId);
    results.push({
      type: 'configuration',
      target: 'main',
      passed: this.compareConfig(currentConfig, snapshot.configuration),
      details: { match: true }
    });

    const passed = results.every(r => r.passed);

    return {
      passed,
      checks: results,
      timestamp: new Date()
    };
  }
}
```

---

## 7. 决策面板设计

### 7.1 面板组件

```typescript
// 决策面板配置
const decisionPanelConfig = {
  title: '人机协作决策中心',

  // 概览统计
  overviewStats: [
    { key: 'pending', label: '待处理', icon: 'clock', color: 'warning' },
    { key: 'overdue', label: '已逾期', icon: 'alert', color: 'danger' },
    { key: 'completedToday', label: '今日完成', icon: 'check', color: 'success' },
    { key: 'avgTime', label: '平均耗时', icon: 'timer', format: 'duration' }
  ],

  // 决策列表
  decisionList: {
    columns: [
      { key: 'type', label: '类型', width: 120 },
      { key: 'title', label: '标题' },
      { key: 'project', label: '项目', width: 150 },
      { key: 'urgency', label: '紧急度', width: 100 },
      { key: 'deadline', label: '截止时间', width: 150 },
      { key: 'assignee', label: '处理人', width: 120 },
      { key: 'actions', label: '操作', width: 200 }
    ],
    filters: [
      { key: 'status', label: '状态', options: ['pending', 'overdue', 'completed'] },
      { key: 'type', label: '类型', options: ['approval', 'confirm', 'consult', 'review'] },
      { key: 'priority', label: '优先级', options: ['low', 'medium', 'high', 'critical'] }
    ],
    sorting: ['deadline', 'priority', 'createdAt']
  },

  // 决策详情面板
  detailPanel: {
    sections: [
      { key: 'summary', label: '摘要' },
      { key: 'context', label: '上下文' },
      { key: 'options', label: '可选方案' },
      { key: 'risk', label: '风险评估' },
      { key: 'history', label: '历史记录' },
      { key: 'comments', label: '评论' }
    ],
    actions: ['approve', 'reject', 'delegate', 'request-info', 'add-comment']
  },

  // 快捷操作
  quickActions: [
    { key: 'batch-approve', label: '批量批准', icon: 'check-all', confirmation: true },
    { key: 'batch-reject', label: '批量拒绝', icon: 'x-all', confirmation: true },
    { key: 'delegate', label: '委托', icon: 'user-switch' },
    { key: 'extend-deadline', label: '延长期限', icon: 'clock-plus' }
  ]
};

// 面板数据
interface PanelData {
  overview: {
    pending: number;
    overdue: number;
    completedToday: number;
    avgTime: number;
  };
  decisions: DecisionSummary[];
  urgentItems: UrgentItem[];
  recentActivity: Activity[];
}

// 决策摘要
interface DecisionSummary {
  id: string;
  type: DecisionPointType;
  title: string;
  project: { id: string; name: string };
  urgency: 'low' | 'medium' | 'high' | 'critical';
  deadline: Date;
  status: 'pending' | 'overdue' | 'completed';
  assignee: { id: string; name: string };
}
```

### 7.2 实时更新

```typescript
// WebSocket 事件
enum WSClientEvent {
  DECISION_CREATED = 'decision:created',
  DECISION_UPDATED = 'decision:updated',
  DECISION_COMPLETED = 'decision:completed',
  DECISION_ESCALATED = 'decision:escalated',
  ASSIGNMENT_CHANGED = 'assignment:changed',
  COMMENT_ADDED = 'comment:added',
  DEADLINE_EXTENDED = 'deadline:extended'
}

// 实时服务
class RealtimeService {
  private connections: Map<string, WebSocket>;
  private rooms: Map<string, Set<string>>;  // room -> userIds

  // 加入房间
  joinRoom(userId: string, room: string): void {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room)!.add(userId);
  }

  // 离开房间
  leaveRoom(userId: string, room: string): void {
    this.rooms.get(room)?.delete(userId);
  }

  // 广播到房间
  async broadcastToRoom(
    room: string,
    event: WSClientEvent,
    data: unknown
  ): Promise<void> {
    const userIds = this.rooms.get(room);
    if (!userIds) return;

    const message = JSON.stringify({ event, data, timestamp: Date.now() });

    for (const userId of userIds) {
      const ws = this.connections.get(userId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  // 发送决策更新
  async sendDecisionUpdate(
    decisionId: string,
    update: DecisionUpdate
  ): Promise<void> {
    await this.broadcastToRoom(
      `decision:${decisionId}`,
      WSClientEvent.DECISION_UPDATED,
      update
    );

    // 通知所有相关用户
    await this.notifyRelatedUsers(decisionId, update);
  }
}
```

---

## 8. 相关文档

- [Agent 协作框架](./AGENT_COLLABORATION_FRAMEWORK.md)
- [工作流编排设计](./WORKFLOW_ORCHESTRATION.md)
- [监控与告警系统](./MONITORING_ALERTING.md)
- [错误处理与系统韧性](./ERROR_HANDLING_RESILIENCE.md)

---

**最后更新**: 2026-04-14
