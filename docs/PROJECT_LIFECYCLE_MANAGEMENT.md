# 项目生命周期管理系统设计

## 概述

项目生命周期管理系统是无限生成系统的核心编排层，负责管理从创意诞生到产品退役的完整生命周期。没有生命周期管理，生成系统将变成无序的状态机，无法跟踪项目演进历史，也无法做出合理的迭代决策。

## 核心价值

```
项目生命周期 = 创意 → 设计 → 开发 → 测试 → 部署 → 运营 → 迭代 → 退役

核心价值：
1. 全流程可视化 - 清晰了解每个项目的当前状态
2. 标准化流程 - 确保每个阶段都执行必要的检查
3. 历史可追溯 - 完整记录每个决策和变更
4. 自动化流转 - 减少人工干预，加速流程
5. 持续优化 - 基于数据分析不断改进
```

## 生命周期阶段

### 阶段定义

```typescript
// 项目阶段枚举
enum ProjectStage {
  // 创意阶段
  IDEA = 'idea',                  // 创意生成
  CONCEPT = 'concept',            // 概念验证

  // 设计阶段
  PLANNING = 'planning',          // 项目规划
  ARCHITECTURE = 'architecture',  // 架构设计
  DESIGN = 'design',              // 详细设计

  // 开发阶段
  DEVELOPMENT = 'development',    // 开发中
  CODE_REVIEW = 'code_review',    // 代码审查
  TESTING = 'testing',            // 测试中

  // 交付阶段
  STAGING = 'staging',            // 预发布
  DEPLOYMENT = 'deployment',      // 部署中
  RELEASED = 'released',          // 已发布

  // 运营阶段
  ACTIVE = 'active',              // 运营中
  MONITORING = 'monitoring',     // 监控中
  MAINTAINING = 'maintaining',   // 维护中

  // 演进阶段
  ITERATING = 'iterating',       // 迭代中
  OPTIMIZING = 'optimizing',     // 优化中
  DEPRECATING = 'deprecating',   // 废弃中

  // 终结阶段
  ARCHIVED = 'archived',         // 已归档
  SUNSET = 'sunset'               // 已下线
}

// 阶段转换关系
const stageTransitions: Record<ProjectStage, ProjectStage[]> = {
  [ProjectStage.IDEA]: [ProjectStage.CONCEPT, ProjectStage.PLANNING],
  [ProjectStage.CONCEPT]: [ProjectStage.PLANNING, ProjectStage.ARCHIVED],
  [ProjectStage.PLANNING]: [ProjectStage.ARCHITECTURE],
  [ProjectStage.ARCHITECTURE]: [ProjectStage.DESIGN],
  [ProjectStage.DESIGN]: [ProjectStage.DEVELOPMENT],
  [ProjectStage.DEVELOPMENT]: [ProjectStage.CODE_REVIEW, ProjectStage.TESTING],
  [ProjectStage.CODE_REVIEW]: [ProjectStage.DEVELOPMENT, ProjectStage.TESTING],
  [ProjectStage.TESTING]: [ProjectStage.STAGING, ProjectStage.DEVELOPMENT],
  [ProjectStage.STAGING]: [ProjectStage.DEPLOYMENT],
  [ProjectStage.DEPLOYMENT]: [ProjectStage.RELEASED],
  [ProjectStage.RELEASED]: [ProjectStage.ACTIVE, ProjectStage.MONITORING],
  [ProjectStage.ACTIVE]: [ProjectStage.MONITORING, ProjectStage.ITERATING, ProjectStage.DEPRECATING],
  [ProjectStage.MONITORING]: [ProjectStage.MAINTAINING, ProjectStage.ITERATING],
  [ProjectStage.MAINTAINING]: [ProjectStage.ITERATING, ProjectStage.OPTIMIZING, ProjectStage.DEPRECATING],
  [ProjectStage.ITERATING]: [ProjectStage.DEVELOPMENT, ProjectStage.ACTIVE],
  [ProjectStage.OPTIMIZING]: [ProjectStage.ACTIVE, ProjectStage.DEVELOPMENT],
  [ProjectStage.DEPRECATING]: [ProjectStage.ARCHIVED, ProjectStage.SUNSET],
  [ProjectStage.ARCHIVED]: [],
  [ProjectStage.SUNSET]: []
};
```

### 阶段详情

```typescript
// 阶段定义
interface StageDefinition {
  stage: ProjectStage;
  name: string;
  description: string;

  // 进入条件
  entryCriteria: EntryCriterion[];

  // 退出条件
  exitCriteria: ExitCriterion[];

  // 阶段任务
  tasks: StageTask[];

  // 阶段时长建议
  suggestedDuration: {
    min: number;  // 天
    max: number;
    ideal: number;
  };

  // 阶段角色
  roles: string[];

  // 阶段产物
  artifacts: Artifact[];
}

// 创意阶段
const ideaStage: StageDefinition = {
  stage: ProjectStage.IDEA,
  name: '创意生成',
  description: '产生项目想法，评估可行性',

  entryCriteria: [
    { type: 'trigger', description: '用户提交想法' },
    { type: 'trigger', description: '系统自动生成想法' },
    { type: 'trigger', description: '市场趋势分析触发' }
  ],

  exitCriteria: [
    { type: 'approval', description: '价值评估通过', threshold: 70 },
    { type: 'feasibility', description: '技术可行性确认' },
    { type: 'resource', description: '资源可用性确认' }
  ],

  tasks: [
    { id: 'idea-1', name: '想法描述', automatable: true },
    { id: 'idea-2', name: '价值分析', automatable: true },
    { id: 'idea-3', name: '可行性评估', automatable: true },
    { id: 'idea-4', name: '资源估算', automatable: true },
    { id: 'idea-5', name: '风险评估', automatable: true }
  ],

  suggestedDuration: { min: 0, max: 1, ideal: 0 },
  roles: ['IdeaAgent', 'ValueAssessor'],
  artifacts: ['IdeaReport', 'ValueScore', 'RiskAssessment']
};

// 架构设计阶段
const architectureStage: StageDefinition = {
  stage: ProjectStage.ARCHITECTURE,
  name: '架构设计',
  description: '设计系统架构和技术选型',

  entryCriteria: [
    { type: 'document', description: '需求规格说明书' },
    { type: 'approval', description: '规划阶段审批通过' }
  ],

  exitCriteria: [
    { type: 'review', description: '架构评审通过' },
    { type: 'document', description: '架构设计文档完成' },
    { type: 'approval', description: '技术选型审批通过' }
  ],

  tasks: [
    { id: 'arch-1', name: '系统边界定义', automatable: true },
    { id: 'arch-2', name: '技术栈选型', automatable: true },
    { id: 'arch-3', name: '架构模式设计', automatable: true },
    { id: 'arch-4', name: '数据模型设计', automatable: true },
    { id: 'arch-5', name: 'API设计', automatable: true },
    { id: 'arch-6', name: '安全设计', automatable: true },
    { id: 'arch-7', name: '部署架构设计', automatable: true }
  ],

  suggestedDuration: { min: 1, max: 3, ideal: 2 },
  roles: ['ArchitectAgent'],
  artifacts: ['ArchitectureDiagram', 'API_Spec', 'DataModel', 'TechStack']
};

// 开发阶段
const developmentStage: StageDefinition = {
  stage: ProjectStage.DEVELOPMENT,
  name: '开发中',
  description: '代码编写和单元测试',

  entryCriteria: [
    { type: 'document', description: '架构设计文档' },
    { type: 'approval', description: '架构评审通过' }
  ],

  exitCriteria: [
    { type: 'metric', description: '代码覆盖率 >= 80%' },
    { type: 'metric', description: 'lint错误 = 0' },
    { type: 'metric', description: '构建成功' },
    { type: 'review', description: '代码审查通过' }
  ],

  tasks: [
    { id: 'dev-1', name: '项目脚手架搭建', automatable: true },
    { id: 'dev-2', name: '核心模块开发', automatable: true },
    { id: 'dev-3', name: '单元测试编写', automatable: true },
    { id: 'dev-4', name: '持续集成配置', automatable: true },
    { id: 'dev-5', name: '文档编写', automatable: true }
  ],

  suggestedDuration: { min: 3, max: 14, ideal: 7 },
  roles: ['CoderAgent'],
  artifacts: ['SourceCode', 'TestCode', 'BuildArtifacts']
};
```

## 数据模型

### 项目实体

```typescript
// 项目实体
interface Project {
  id: string;                      // 唯一标识
  name: string;                    // 项目名称
  description: string;             // 项目描述

  // 分类
  type: ProjectType;              // 项目类型
  domain: string;                  // 领域
  tags: string[];                  // 标签

  // 生命周期状态
  stage: ProjectStage;             // 当前阶段
  status: ProjectStatus;           // 状态 (active/paused/failed/completed)
  priority: Priority;              // 优先级

  // 进度
  progress: number;                // 0-100
  estimatedCompletion?: Date;      // 预计完成时间
  actualCompletion?: Date;          // 实际完成时间

  // 指标
  metrics: ProjectMetrics;

  // 关联
  parentId?: string;               // 父项目 (如果是子项目)
  childIds: string[];              // 子项目
  relatedIdeas: string[];          // 相关创意
  dependencies: string[];          // 依赖项目

  // 资源
  ownerId: string;                 // 负责人
  teamIds: string[];               // 团队成员
  budget?: ResourceBudget;         // 预算

  // 配置
  config: ProjectConfig;

  // 生命周期
  createdAt: Date;
  updatedAt: Date;
  stageChangedAt: Date;           // 阶段变更时间

  // 废弃信息
  deprecatedAt?: Date;
  sunsetDate?: Date;
  archivedAt?: Date;
}

// 项目类型
enum ProjectType {
  WEB_APP = 'web-app',
  MOBILE_APP = 'mobile-app',
  API_SERVICE = 'api-service',
  CLI_TOOL = 'cli-tool',
  LIBRARY = 'library',
  BOT = 'bot',
  DATASET = 'dataset',
  TEMPLATE = 'template'
}

// 项目状态
enum ProjectStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  BLOCKED = 'blocked',
  FAILED = 'failed',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

// 项目指标
interface ProjectMetrics {
  // 质量指标
  quality: {
    testCoverage: number;
    lintErrors: number;
    buildSuccess: boolean;
    qualityScore: number;
  };

  // 开发指标
  development: {
    codeLines: number;
    commitCount: number;
    openIssues: number;
    closedIssues: number;
  };

  // 运营指标 (如果是已部署项目)
  operational?: {
    uptime: number;               // 可用率 %
    responseTime: number;          // 响应时间 ms
    errorRate: number;             // 错误率 %
    requestsPerDay: number;        // 日请求量
  };

  // 价值指标
  value: {
    usageCount: number;            // 使用次数
    userSatisfaction: number;      // 用户满意度
    businessImpact: number;        // 业务影响
  };
}
```

### 阶段记录

```typescript
// 阶段记录
interface StageRecord {
  id: string;
  projectId: string;
  stage: ProjectStage;

  // 进入/退出
  enteredAt: Date;
  exitedAt?: Date;
  duration?: number;               // 实际耗时 (小时)

  // 状态
  status: 'in_progress' | 'completed' | 'skipped' | 'failed';

  // 入口检查
  entryChecks: CheckResult[];

  // 出口检查
  exitChecks: CheckResult[];

  // 任务记录
  tasks: TaskRecord[];

  // 产物
  artifacts: ArtifactRecord[];

  // 变更记录
  changes: ChangeRecord[];

  // 评审记录
  reviews: ReviewRecord[];

  // 问题记录
  issues: IssueRecord[];

  // 元数据
  metadata: Record<string, any>;
}

// 检查结果
interface CheckResult {
  criterion: string;
  passed: boolean;
  details?: string;
  checkedAt: Date;
}

// 任务记录
interface TaskRecord {
  taskId: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  assignee?: string;
  startedAt?: Date;
  completedAt?: Date;
  output?: any;
}
```

### 变更历史

```typescript
// 变更历史
interface ChangeHistory {
  id: string;
  projectId: string;

  // 变更类型
  type: ChangeType;
  category: string;                // 变更分类

  // 变更内容
  description: string;
  before: any;
  after: any;

  // 变更原因
  reason: string;
  trigger: ChangeTrigger;          // 触发源

  // 变更影响
  impact: {
    scope: string[];               // 影响范围
    severity: 'low' | 'medium' | 'high';
    risk: 'low' | 'medium' | 'high';
  };

  // 审批
  approval?: {
    approvedBy: string;
    approvedAt: Date;
    comments?: string;
  };

  // 执行
  executedBy: string;
  executedAt: Date;
}

// 变更类型
enum ChangeType {
  STAGE_TRANSITION = 'stage_transition',
  CONFIG_UPDATE = 'config_update',
  REQUIREMENT_CHANGE = 'requirement_change',
  RESOURCE_REALLOCATION = 'resource_reallocation',
  PRIORITY_CHANGE = 'priority_change',
  SCHEDULE_CHANGE = 'schedule_change',
  TEAM_CHANGE = 'team_change'
}

// 变更触发
enum ChangeTrigger {
  AUTOMATIC = 'automatic',        // 自动触发
  MANUAL = 'manual',              // 手动触发
  SYSTEM = 'system',              // 系统触发 (如超时)
  USER = 'user'                   // 用户触发
}
```

## 核心服务

### 1. 阶段管理服务

```typescript
// 阶段管理服务
interface StageManagementService {
  // 获取当前阶段
  getCurrentStage(projectId: string): Promise<ProjectStage>;

  // 获取阶段定义
  getStageDefinition(stage: ProjectStage): StageDefinition;

  // 进入阶段
  enterStage(
    projectId: string,
    stage: ProjectStage,
    context?: EnterContext
  ): Promise<StageTransitionResult>;

  // 退出阶段
  exitStage(
    projectId: string,
    result: ExitResult
  ): Promise<StageTransitionResult>;

  // 获取阶段历史
  getStageHistory(projectId: string): Promise<StageRecord[]>;

  // 检查是否可以进入指定阶段
  canTransitionTo(
    projectId: string,
    targetStage: ProjectStage
  ): Promise<TransitionCheckResult>;

  // 执行阶段任务
  executeStageTasks(
    projectId: string,
    taskIds: string[]
  ): Promise<TaskExecutionResult>;
}

// 进入上下文
interface EnterContext {
  trigger: 'automatic' | 'manual';
  triggeredBy?: string;
  reason?: string;
  metadata?: Record<string, any>;
}

// 退出结果
interface ExitResult {
  success: boolean;
  exitChecks: CheckResult[];
  tasksCompleted: string[];
  tasksPending: string[];
  artifacts: ArtifactRecord[];
  recommendation?: ProjectStage;  // 建议下一阶段
}

// 阶段转换结果
interface StageTransitionResult {
  success: boolean;
  previousStage: ProjectStage;
  currentStage: ProjectStage;
  duration: number;               // 阶段耗时
  errors?: string[];
  warnings?: string[];
}
```

### 2. 进度跟踪服务

```typescript
// 进度跟踪服务
interface ProgressTrackingService {
  // 更新进度
  updateProgress(
    projectId: string,
    progress: number,
    metrics?: Partial<ProjectMetrics>
  ): Promise<void>;

  // 计算进度
  calculateProgress(projectId: string): Promise<number>;

  // 获取进度详情
  getProgressDetails(projectId: string): Promise<ProgressDetails>;

  // 获取阶段进度
  getStageProgress(projectId: string): Promise<StageProgress[]>;

  // 预测完成时间
  predictCompletion(projectId: string): Promise<Date>;

  // 进度预警
  checkProgressAlerts(projectId: string): Promise<Alert[]>;
}

// 进度详情
interface ProgressDetails {
  overall: number;                 // 总体进度
  byStage: Record<ProjectStage, number>;
  byTask: TaskProgress[];
  trend: 'accelerating' | 'stable' | 'decelerating' | 'stalled';
  onTrack: boolean;
  estimatedCompletion?: Date;
}

// 阶段进度
interface StageProgress {
  stage: ProjectStage;
  status: 'pending' | 'in_progress' | 'completed';
  progress: number;
  duration: number;               // 当前持续时间
  estimatedDuration?: number;      // 预计总时间
  onSchedule: boolean;
}
```

### 3. 自动化引擎

```typescript
// 自动化引擎
interface LifecycleAutomationEngine {
  // 注册自动化规则
  registerRule(rule: AutomationRule): void;

  // 触发自动化
  trigger(event: LifecycleEvent): Promise<AutomationResult[]>;

  // 获取适用规则
  getApplicableRules(event: LifecycleEvent): AutomationRule[];
}

// 自动化规则
interface AutomationRule {
  id: string;
  name: string;

  // 触发条件
  trigger: {
    type: EventType;
    conditions: Condition[];
  };

  // 执行动作
  actions: AutomationAction[];

  // 约束
  constraints: {
    maxExecutions?: number;
    timeWindow?: { start: string; end: string };
    dependencies?: string[];
  };

  // 状态
  enabled: boolean;
  priority: number;
}

// 自动化事件
interface LifecycleEvent {
  type: EventType;
  projectId: string;
  stage: ProjectStage;
  timestamp: Date;
  data?: any;
}

// 事件类型
enum EventType {
  PROJECT_CREATED = 'project_created',
  STAGE_ENTERED = 'stage_entered',
  STAGE_EXITED = 'stage_exited',
  TASK_COMPLETED = 'task_completed',
  CHECK_PASSED = 'check_passed',
  CHECK_FAILED = 'check_failed',
  THRESHOLD_EXCEEDED = 'threshold_exceeded',
  DEADLINE_APPROACHING = 'deadline_approaching',
  DEADLINE_PASSED = 'deadline_passed',
  ISSUE_REPORTED = 'issue_reported'
}

// 自动化动作
interface AutomationAction {
  type: ActionType;
  params: Record<string, any>;
}

// 动作类型
enum ActionType {
  TRANSITION_STAGE = 'transition_stage',
  ASSIGN_TASK = 'assign_task',
  SEND_NOTIFICATION = 'send_notification',
  UPDATE_METRICS = 'update_metrics',
  CREATE_ISSUE = 'create_issue',
  ESCALATE = 'escalate',
  RUN_SCRIPT = 'run_script',
  APPROVE = 'approve',
  REJECT = 'reject'
}
```

### 4. 决策支持服务

```typescript
// 决策支持服务
interface DecisionSupportService {
  // 获取阶段建议
  getStageRecommendations(projectId: string): Promise<Recommendation[]>;

  // 获取下一步建议
  getNextSteps(projectId: string): Promise<NextStep[]>;

  // 获取风险警告
  getRiskWarnings(projectId: string): Promise<RiskWarning[]>;

  // 获取资源建议
  getResourceRecommendations(projectId: string): Promise<ResourceRecommendation[]>;

  // 决策分析
  analyzeDecision(
    projectId: string,
    decision: Decision
  ): Promise<DecisionAnalysis>;
}

// 建议
interface Recommendation {
  id: string;
  type: 'stage_transition' | 'optimization' | 'resource' | 'risk_mitigation';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  rationale: string;
  confidence: number;              // 置信度 0-1
  estimatedImpact?: string;
  actionItems: string[];
  automatable: boolean;
}

// 下一步
interface NextStep {
  task: string;
  reason: string;
  priority: number;
  estimatedDuration?: number;
  dependencies?: string[];
  responsible?: string;
}

// 风险警告
interface RiskWarning {
  id: string;
  riskType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  indicators: string[];
  mitigation?: string;
  contingency?: string;
}
```

## 状态机

### 完整状态机

```typescript
// 生命周期状态机
class ProjectLifecycleStateMachine {
  private states: Map<ProjectStage, StateDefinition>;

  constructor() {
    this.initializeStates();
  }

  private initializeStates() {
    this.states = new Map([
      [ProjectStage.IDEA, {
        onEnter: async (project) => {
          // 初始化创意评估
          await this.runIdeaAssessment(project);
        },
        onExit: async (project, nextStage) => {
          // 保存创意评估结果
          await this.saveAssessment(project);
        },
        transitions: [ProjectStage.CONCEPT, ProjectStage.PLANNING],
        autoTransitions: []
      }],

      [ProjectStage.DEVELOPMENT, {
        onEnter: async (project) => {
          // 初始化开发环境
          await this.initializeDevEnvironment(project);
          // 启动持续集成
          await this.startCI(project);
        },
        onExit: async (project, nextStage) => {
          // 停止开发环境
          await this.cleanupDevEnvironment(project);
        },
        transitions: [ProjectStage.CODE_REVIEW, ProjectStage.TESTING],
        autoTransitions: [
          { condition: (p) => p.metrics.quality.buildSuccess === false,
            target: ProjectStage.DEVELOPMENT,
            action: 'rebuild' }
        ]
      }],

      [ProjectStage.RELEASED, {
        onEnter: async (project) => {
          // 初始化监控
          await this.initializeMonitoring(project);
          // 启动健康检查
          await this.startHealthChecks(project);
        },
        onExit: async (project, nextStage) => {
          // 停止监控
          await this.stopMonitoring(project);
        },
        transitions: [ProjectStage.ACTIVE, ProjectStage.MONITORING],
        autoTransitions: [
          { condition: (p) => p.metrics.operational?.uptime < 99,
            target: ProjectStage.MONITORING,
            action: 'investigate' }
        ]
      }],

      [ProjectStage.DEPRECATING, {
        onEnter: async (project) => {
          // 通知用户
          await this.notifyDeprecation(project);
          // 启动过渡期
          await this.startDeprecationPeriod(project);
        },
        onExit: async (project, nextStage) => {
          // 执行最终清理
          await this.finalCleanup(project);
        },
        transitions: [ProjectStage.ARCHIVED, ProjectStage.SUNSET],
        autoTransitions: []
      }]
    ]);
  }

  // 执行转换
  async transition(
    project: Project,
    targetStage: ProjectStage,
    context?: TransitionContext
  ): Promise<TransitionResult> {
    const currentState = this.states.get(project.stage);
    const targetState = this.states.get(targetStage);

    // 1. 验证转换有效性
    if (!currentState.transitions.includes(targetStage)) {
      return { success: false, error: 'Invalid transition' };
    }

    // 2. 执行退出动作
    await currentState.onExit(project, targetStage);

    // 3. 执行入口检查
    const entryChecks = await this.runEntryChecks(targetStage, project);
    if (!entryChecks.allPassed) {
      return { success: false, error: 'Entry checks failed', details: entryChecks };
    }

    // 4. 更新项目状态
    project.stage = targetStage;
    project.stageChangedAt = new Date();

    // 5. 执行进入动作
    await targetState.onEnter(project);

    // 6. 记录历史
    await this.recordTransition(project, currentState, targetState, context);

    return { success: true, newStage: targetStage };
  }

  // 运行自动转换
  async processAutoTransitions(project: Project): Promise<void> {
    const state = this.states.get(project.stage);

    for (const autoTransition of state.autoTransitions) {
      if (autoTransition.condition(project)) {
        await this.transition(project, autoTransition.target, {
          trigger: 'automatic',
          reason: autoTransition.action
        });
      }
    }
  }
}
```

## 流程编排

### 主流程

```typescript
// 生命周期管理器
class LifecycleManager {
  constructor(
    private stageService: StageManagementService,
    private automationEngine: LifecycleAutomationEngine,
    private decisionSupport: DecisionSupportService,
    private notificationService: NotificationService
  ) {}

  // 启动新项目
  async startNewProject(
    request: CreateProjectRequest
  ): Promise<Project> {
    // 1. 创建项目
    const project = await this.createProject(request);

    // 2. 进入创意阶段
    await this.stageService.enterStage(project.id, ProjectStage.IDEA);

    // 3. 触发自动化规则
    await this.automationEngine.trigger({
      type: EventType.PROJECT_CREATED,
      projectId: project.id,
      stage: ProjectStage.IDEA,
      timestamp: new Date()
    });

    return project;
  }

  // 处理项目迭代
  async processIteration(
    projectId: string
  ): Promise<IterationResult> {
    const project = await this.getProject(projectId);

    // 1. 检查当前阶段任务
    const pendingTasks = await this.getPendingTasks(projectId);

    // 2. 执行待处理任务
    for (const task of pendingTasks) {
      await this.executeTask(project, task);
    }

    // 3. 检查退出条件
    const exitChecks = await this.runExitChecks(project);

    if (exitChecks.allPassed) {
      // 4. 获取下一步建议
      const recommendations = await this.decisionSupport.getStageRecommendations(projectId);

      // 5. 建议转换到下一阶段
      if (recommendations.length > 0 && recommendations[0].type === 'stage_transition') {
        await this.stageService.exitStage(projectId, { success: true, exitChecks });
        await this.stageService.enterStage(projectId, recommendations[0].actionItems[0] as ProjectStage);
      }
    }

    // 6. 触发自动化
    await this.automationEngine.trigger({
      type: EventType.STAGE_EXITED,
      projectId,
      stage: project.stage,
      timestamp: new Date()
    });

    return { success: true, project };
  }

  // 项目归档
  async archiveProject(projectId: string): Promise<void> {
    const project = await this.getProject(projectId);

    // 1. 确保可以归档
    if (project.stage !== ProjectStage.DEPRECATING) {
      throw new Error('Only deprecated projects can be archived');
    }

    // 2. 停止所有活动
    await this.stopAllActivities(projectId);

    // 3. 归档数据
    await this.archiveProjectData(projectId);

    // 4. 转换到归档状态
    await this.stageService.enterStage(projectId, ProjectStage.ARCHIVED);
  }
}
```

### 阶段流程

```typescript
// 阶段流程定义
const stageFlows: Record<ProjectStage, StageFlow> = {
  [ProjectStage.DEVELOPMENT]: {
    name: '开发流程',
    steps: [
      {
        id: 'dev-setup',
        name: '环境搭建',
        tasks: [
          { name: '初始化代码仓库', agent: 'GitAgent', automatable: true },
          { name: '配置开发环境', agent: 'CoderAgent', automatable: true },
          { name: '搭建CI/CD', agent: 'CoderAgent', automatable: true }
        ],
        exitCriteria: [
          { name: '代码仓库存在', check: () => true },
          { name: 'CI配置完成', check: () => true }
        ]
      },
      {
        id: 'dev-implement',
        name: '功能实现',
        tasks: [
          { name: '生成核心模块', agent: 'CoderAgent', automatable: true },
          { name: '生成API', agent: 'CoderAgent', automatable: true },
          { name: '生成前端', agent: 'CoderAgent', automatable: true }
        ],
        parallel: true,
        exitCriteria: [
          { name: '代码覆盖率 >= 80%', check: (p) => p.metrics.quality.testCoverage >= 80 }
        ]
      },
      {
        id: 'dev-review',
        name: '代码审查',
        tasks: [
          { name: '自动审查', agent: 'ReviewerAgent', automatable: true },
          { name: '修复问题', agent: 'CoderAgent', automatable: true }
        ],
        loop: true,
        exitCriteria: [
          { name: '无高风险问题', check: () => true },
          { name: '代码审查通过', check: () => true }
        ]
      }
    ],
    qualityGates: [
      { name: '构建成功', threshold: true },
      { name: '测试通过率', threshold: 0.95 },
      { name: '覆盖率', threshold: 0.8 },
      { name: '安全扫描', threshold: 0 }
    ]
  }
};
```

## 监控与告警

### 生命周期指标

```typescript
// 生命周期指标
const lifecycleMetrics = {
  // 项目指标
  totalProjects: Gauge,
  projectsByStage: Gauge,
  projectsByType: Gauge,

  // 阶段指标
  stageDuration: Histogram,
  stageTransitionsTotal: Counter,
  autoTransitionsTotal: Counter,

  // 质量指标
  projectsPassingQualityGates: Gauge,
  projectsFailingQualityGates: Gauge,

  // 效率指标
  averageTimeToMarket: Gauge,
  averageIterationTime: Gauge,
  projectsCompletedOnTime: Gauge,

  // 风险指标
  projectsAtRisk: Gauge,
  overdueProjects: Gauge,
  blockedProjects: Gauge
};
```

### 告警规则

```typescript
// 告警规则
const alertRules: AlertRule[] = [
  {
    name: '阶段超时告警',
    condition: (project) => {
      const stage = getStageDefinition(project.stage);
      const duration = Date.now() - project.stageChangedAt;
      return duration > stage.suggestedDuration.max * 24 * 60 * 60 * 1000;
    },
    severity: 'warning',
    message: '项目在当前阶段停留时间超过建议最大值'
  },
  {
    name: '进度落后告警',
    condition: (project) => {
      const expectedProgress = calculateExpectedProgress(project);
      return project.progress < expectedProgress - 0.2;  // 落后20%以上
    },
    severity: 'warning',
    message: '项目进度落后于预期'
  },
  {
    name: '质量门禁失败',
    condition: (project) => {
      return project.metrics.quality.buildSuccess === false ||
             project.metrics.quality.lintErrors > 0;
    },
    severity: 'error',
    message: '项目质量门禁失败'
  },
  {
    name: '资源耗尽告警',
    condition: (project) => {
      return project.budget &&
             project.budget.used / project.budget.total > 0.9;
    },
    severity: 'critical',
    message: '项目预算即将耗尽'
  }
];
```

## 集成方案

### 与生成系统集成

```typescript
// 生命周期感知的生成器
class LifecycleAwareGenerator {
  constructor(
    private lifecycleManager: LifecycleManager,
    private componentRegistry: ComponentRegistry
  ) {}

  // 生成项目
  async generateProject(idea: Idea): Promise<Project> {
    // 1. 创建项目
    const project = await this.lifecycleManager.startNewProject({
      name: idea.name,
      description: idea.description,
      type: idea.type,
      domain: idea.domain
    });

    // 2. 进入规划阶段
    await this.lifecycleManager.processIteration(project.id);

    // 3. 进入架构阶段
    await this.lifecycleManager.processIteration(project.id);

    // 4. 返回进行中的项目
    return this.getProject(project.id);
  }
}
```

### 与监控系统集成

```typescript
// 生命周期事件监听器
class LifecycleEventListener {
  constructor(private metrics: MetricsService) {}

  async onStageEntered(event: StageEnteredEvent) {
    this.metrics.increment('stage_transitions_total', {
      stage: event.stage,
      trigger: event.trigger
    });

    this.metrics.startTimer('stage_duration', {
      project_id: event.projectId,
      stage: event.stage
    });
  }

  async onStageExited(event: StageExitedEvent) {
    this.metrics.increment('stage_transitions_total', {
      stage: event.stage,
      result: event.success ? 'completed' : 'failed'
    });

    this.metrics.endTimer('stage_duration', {
      project_id: event.projectId,
      stage: event.stage
    });
  }

  async onProjectCompleted(event: ProjectCompletedEvent) {
    const duration = event.completedAt - event.startedAt;

    this.metrics.record('time_to_market', duration, {
      project_type: event.projectType
    });
  }
}
```

## 配置

```typescript
// 生命周期配置
interface LifecycleConfig {
  // 阶段配置
  stages: {
    [key in ProjectStage]?: {
      enabled: boolean;
      suggestedDuration?: number;   // 天数
      maxDuration?: number;
      autoTransition?: boolean;
    };
  };

  // 转换规则
  transitions: {
    allowBackward: boolean;
    requireApproval: boolean;
    approvalRoles: string[];
  };

  // 自动化规则
  automation: {
    enabled: boolean;
    rules: AutomationRule[];
  };

  // 告警配置
  alerts: {
    enabled: boolean;
    rules: AlertRule[];
    channels: string[];
  };

  // 保留策略
  retention: {
    archiveAfterDays: number;       // 多少天后归档
    deleteAfterDays: number;        // 多少天后删除
    keepHistoryDays: number;        // 历史保留天数
  };
}
```

## 最佳实践

### 1. 阶段管理

```
- 每个阶段必须有明确的入口/出口标准
- 阶段转换需要记录完整历史
- 自动化应处理常规流程，特殊情况需要人工介入
- 定期回顾和优化阶段流程
```

### 2. 进度跟踪

```
- 使用客观指标而非主观估计
- 频繁更新进度，保持数据新鲜度
- 设置进度预警，提前发现问题
- 对落后项目进行根因分析
```

### 3. 质量门禁

```
- 在关键节点设置质量门禁
- 质量问题必须修复才能继续
- 记录质量趋势，持续改进
- 平衡速度与质量的关系
```

### 4. 风险管理

```
- 识别项目全生命周期的风险
- 设置风险预警阈值
- 制定风险缓解和应急预案
- 定期评审和更新风险列表
```

---

**最后更新**: 2026-04-15
