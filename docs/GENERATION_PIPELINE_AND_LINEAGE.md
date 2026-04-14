# 生成管道与血缘追踪系统设计

## 概述

生成管道与血缘追踪系统是无限生成系统的核心执行框架，负责协调多阶段生成流程、追踪每个代码单元的血缘关系、支持从任意历史点重新生成或分叉。没有管道与血缘追踪，系统将无法精确控制生成过程，也无法回溯和复用生成历史。

## 核心价值

```
生成控制 = 管道编排 × 血缘追踪 × 分叉重生成 × 版本快照

管道与血缘的核心价值：
1. 精确控制 - 按阶段精确控制生成过程
2. 血缘可溯 - 追踪每个代码单元的来源和演化
3. 可重复性 - 相同的输入可重现相同的输出
4. 分叉生成 - 从任意节点分叉创建变体
5. 选择性重生成 - 只重生成需要变更的部分
```

## 生成管道架构

### 管道阶段定义

```typescript
// 管道阶段枚举
enum PipelineStage {
  // 需求阶段
  REQUIREMENT_PARSING = 'requirement_parsing',   // 需求解析
  REQUIREMENT_ANALYSIS = 'requirement_analysis', // 需求分析
  REQUIREMENT_VALIDATION = 'requirement_validation', // 需求验证

  // 设计阶段
  ARCHITECTURE_DESIGN = 'architecture_design', // 架构设计
  API_DESIGN = 'api_design',                   // API设计
  DATA_MODEL_DESIGN = 'data_model_design',     // 数据模型设计
  UI_DESIGN = 'ui_design',                     // 界面设计

  // 实现阶段
  CODE_GENERATION = 'code_generation',         // 代码生成
  CONFIG_GENERATION = 'config_generation',     // 配置生成
  TEST_GENERATION = 'test_generation',         // 测试生成
  DOC_GENERATION = 'doc_generation',           // 文档生成

  // 验证阶段
  CODE_REVIEW = 'code_review',                 // 代码审查
  TEST_EXECUTION = 'test_execution',           // 测试执行
  QUALITY_GATE = 'quality_gate',               // 质量门禁
  SECURITY_SCAN = 'security_scan',             // 安全扫描

  // 输出阶段
  BUILD = 'build',                             // 构建
  DEPLOY = 'deploy'                           // 部署
}

// 阶段状态
enum StageStatus {
  PENDING = 'pending',         // 等待执行
  RUNNING = 'running',         // 执行中
  COMPLETED = 'completed',     // 已完成
  FAILED = 'failed',           // 执行失败
  SKIPPED = 'skipped',         // 已跳过
  BLOCKED = 'blocked'          // 被阻塞
}

// 阶段定义
interface StageDefinition {
  name: string;
  stage: PipelineStage;

  // 输入定义
  inputs: {
    required: string[];         // 必需输入
    optional: string[];         // 可选输入
  };

  // 输出定义
  outputs: {
    produced: string[];         // 产出物
    artifacts: ArtifactType[];  // 产物类型
  };

  // 执行配置
  config: {
    timeout: number;            // 超时时间 (ms)
    retryCount: number;         // 重试次数
    parallel: boolean;          // 是否可并行
    dependsOn: PipelineStage[]; // 依赖阶段
  };

  // Agent配置
  agent: {
    type: AgentType;            // Agent类型
    model?: string;            // 模型选择
    temperature?: number;       // 温度参数
    maxTokens?: number;        // 最大token数
  };

  // 质量配置
  quality: {
    minScore?: number;         // 最低分数
    maxIssues?: number;        // 最大问题数
  };
}

// 默认阶段定义
const defaultStages: StageDefinition[] = [
  {
    name: '需求解析',
    stage: PipelineStage.REQUIREMENT_PARSING,
    inputs: { required: ['idea'], optional: ['context', 'constraints'] },
    outputs: { produced: ['parsed_requirements'], artifacts: ['requirement_doc'] },
    config: { timeout: 60000, retryCount: 2, parallel: false, dependsOn: [] },
    agent: { type: 'idea_generator', temperature: 0.7 },
    quality: { minScore: 60 }
  },
  {
    name: '架构设计',
    stage: PipelineStage.ARCHITECTURE_DESIGN,
    inputs: { required: ['parsed_requirements'], optional: ['existing_architecture'] },
    outputs: { produced: ['architecture'], artifacts: ['architecture_diagram'] },
    config: { timeout: 180000, retryCount: 3, parallel: false, dependsOn: [PipelineStage.REQUIREMENT_PARSING] },
    agent: { type: 'architect', temperature: 0.5 },
    quality: { minScore: 70 }
  },
  {
    name: '代码生成',
    stage: PipelineStage.CODE_GENERATION,
    inputs: { required: ['architecture'], optional: ['component_library'] },
    outputs: { produced: ['source_code'], artifacts: ['code_files'] },
    config: { timeout: 300000, retryCount: 3, parallel: true, dependsOn: [PipelineStage.ARCHITECTURE_DESIGN] },
    agent: { type: 'coder', temperature: 0.4 },
    quality: { minScore: 80 }
  },
  {
    name: '测试生成',
    stage: PipelineStage.TEST_GENERATION,
    inputs: { required: ['source_code'], optional: ['coverage_target'] },
    outputs: { produced: ['test_code'], artifacts: ['test_files', 'coverage_report'] },
    config: { timeout: 180000, retryCount: 2, parallel: true, dependsOn: [PipelineStage.CODE_GENERATION] },
    agent: { type: 'tester', temperature: 0.3 },
    quality: { minScore: 70 }
  },
  {
    name: '质量门禁',
    stage: PipelineStage.QUALITY_GATE,
    inputs: { required: ['source_code', 'test_code'], optional: [] },
    outputs: { produced: ['quality_report'], artifacts: ['quality_metrics'] },
    config: { timeout: 120000, retryCount: 1, parallel: false, dependsOn: [PipelineStage.TEST_GENERATION] },
    agent: { type: 'reviewer', temperature: 0.2 },
    quality: { minScore: 85 }
  }
];
```

### 管道实例

```typescript
// 管道实例
interface Pipeline {
  id: string;                        // 管道ID
  name: string;                       // 管道名称
  projectId: string;                  // 关联项目

  // 配置
  stages: StageInstance[];            // 阶段实例列表
  config: PipelineConfig;              // 管道配置

  // 状态
  status: PipelineStatus;             // 管道状态
  currentStage?: string;              // 当前执行阶段

  // 执行信息
  startedAt?: Date;                   // 开始时间
  completedAt?: Date;                 // 完成时间
  duration?: number;                  // 总耗时 (ms)

  // 来源
  lineage: LineageInfo;               // 血缘信息
  forkedFrom?: string;                // 分叉自哪个管道
  parentPipelineId?: string;          // 父管道ID

  // 结果
  result?: PipelineResult;            // 管道结果
  error?: PipelineError;              // 错误信息
}

// 阶段实例
interface StageInstance {
  id: string;                         // 阶段实例ID
  stage: PipelineStage;                // 阶段类型
  name: string;                       // 阶段名称

  // 配置
  config: StageConfig;                // 阶段配置

  // 执行状态
  status: StageStatus;                // 阶段状态
  progress: number;                   // 进度 0-100

  // 执行信息
  startedAt?: Date;                   // 开始时间
  completedAt?: Date;                 // 完成时间
  duration?: number;                  // 耗时 (ms)
  retryCount: number;                 // 重试次数

  // 输入输出
  inputs: StageIO;                    // 阶段输入
  outputs: StageIO;                   // 阶段输出

  // 执行记录
  executionLog: ExecutionLog[];        // 执行日志
  artifacts: Artifact[];              // 产物

  // Agent执行信息
  agentExecution?: AgentExecution;    // Agent执行信息

  // 错误信息
  error?: StageError;

  // 血缘
  lineage: StageLineage;
}

// 输入输出
interface StageIO {
  data: Record<string, any>;          // 数据
  files: FileRef[];                   // 文件引用
  dependencies: DependencyRef[];       // 依赖引用
}

// 管道状态
enum PipelineStatus {
  CREATED = 'created',               // 已创建
  QUEUED = 'queued',                 // 排队中
  RUNNING = 'running',               // 执行中
  PAUSED = 'paused',                 // 已暂停
  COMPLETED = 'completed',            // 已完成
  FAILED = 'failed',                 // 失败
  CANCELLED = 'cancelled',            // 已取消
  BLOCKED = 'blocked'                 // 被阻塞
}
```

## 血缘追踪系统

### 血缘模型

```typescript
// 血缘记录
interface LineageRecord {
  id: string;                         // 记录ID
  type: LineageType;                 // 血缘类型

  // 实体信息
  entity: {
    type: 'file' | 'function' | 'class' | 'module' | 'component';
    id: string;
    name: string;
    path: string;
    hash: string;                    // 内容哈希
  };

  // 来源信息
  source: {
    type: 'generated' | 'copied' | 'derived' | 'transformed' | 'imported';
    sourceId?: string;               // 源实体ID
    sourcePath?: string;             // 源路径
    transformation?: string;         // 转换类型
  };

  // 生成信息
  generation: {
    pipelineId: string;              // 管道ID
    stageId: string;                 // 阶段ID
    iteration: number;               // 生成迭代次数
    prompt?: string;                 // 使用的提示
    model?: string;                  // 使用的模型
    parameters?: GenerationParameters; // 生成参数
  };

  // 版本信息
  version: {
    major: number;
    minor: number;
    patch: number;
    createdAt: Date;
    message?: string;
  };

  // 元数据
  metadata: Record<string, any>;
}

// 血缘类型
enum LineageType {
  // 文件级血缘
  FILE_GENERATED = 'file_generated',     // 文件被生成
  FILE_COPIED = 'file_copied',           // 文件被复制
  FILE_DERIVED = 'file_derived',         // 文件派生
  FILE_IMPORTED = 'file_imported',      // 文件导入

  // 代码级血缘
  FUNCTION_GENERATED = 'function_generated',
  FUNCTION_CALLED = 'function_called',
  CLASS_INHERITED = 'class_inherited',
  COMPONENT_COMPOSED = 'component_composed',

  // 数据血缘
  DATA_TRANSFORMED = 'data_transformed',
  DATA_AGGREGATED = 'data_aggregated',

  // 配置血缘
  CONFIG_DERIVED = 'config_derived',
  CONFIG_INHERITED = 'config_inherited'
}

// 血缘图
interface LineageGraph {
  nodes: Map<string, LineageNode>;       // 节点
  edges: LineageEdge[];                  // 边

  // 统计
  stats: {
    totalNodes: number;
    totalEdges: number;
    generationDepth: number;           // 生成深度
    branchFactor: number;              // 分支因子
  };
}

// 血缘节点
interface LineageNode {
  id: string;
  entity: LineageRecord['entity'];
  type: LineageType;

  // 位置
  position: {
    pipelineId: string;
    stage: PipelineStage;
    depth: number;
    order: number;
  };

  // 关系
  parents: string[];                    // 父节点IDs
  children: string[];                   // 子节点IDs

  // 状态
  status: 'active' | 'modified' | 'deleted' | 'deprecated';

  // 属性
  attributes: Record<string, any>;
}

// 血缘边
interface LineageEdge {
  id: string;
  source: string;                       // 源节点ID
  target: string;                       // 目标节点ID
  type: LineageType;

  // 转换信息
  transformation?: {
    type: string;
    rule?: string;
    confidence?: number;
  };
}
```

### 血缘追踪服务

```typescript
// 血缘追踪服务
class LineageTracker {
  constructor(
    private store: LineageStore,
    private graphBuilder: LineageGraphBuilder
  ) {}

  // 记录血缘
  async record(lineage: LineageRecord): Promise<void> {
    // 1. 存储记录
    await this.store.insert(lineage);

    // 2. 更新血缘图
    await this.graphBuilder.addNode(lineage);

    // 3. 建立父子关系
    if (lineage.source.sourceId) {
      await this.graphBuilder.addEdge({
        source: lineage.source.sourceId,
        target: lineage.entity.id,
        type: lineage.source.type
      });
    }

    // 4. 触发钩子
    await this.triggerHooks('lineage:created', lineage);
  }

  // 批量记录血缘
  async recordBatch(lineages: LineageRecord[]): Promise<void> {
    // 1. 批量存储
    await this.store.insertBatch(lineages);

    // 2. 批量更新图
    await this.graphBuilder.addNodesBatch(lineages);

    // 3. 建立关系
    await this.graphBuilder.addEdgesFromRecords(lineages);
  }

  // 查询血缘
  async query(filter: LineageFilter): Promise<LineageRecord[]> {
    return this.store.query(filter);
  }

  // 获取实体的完整血缘链
  async getLineageChain(entityId: string): Promise<LineageChain> {
    // 1. 获取祖先链
    const ancestors = await this.getAncestors(entityId);

    // 2. 获取后代链
    const descendants = await this.getDescendants(entityId);

    // 3. 构建完整链
    return {
      entityId,
      ancestors: ancestors.reverse(),  // 从根到当前
      descendants,
      depth: ancestors.length,
      branchFactor: descendants.length
    };
  }

  // 获取祖先链
  async getAncestors(entityId: string, depth?: number): Promise<LineageRecord[]> {
    const ancestors: LineageRecord[] = [];
    let currentId: string | undefined = entityId;
    let currentDepth = 0;

    while (currentId && (!depth || currentDepth < depth)) {
      const record = await this.store.findById(currentId);
      if (!record || !record.source.sourceId) break;

      const parent = await this.store.findById(record.source.sourceId);
      if (!parent) break;

      ancestors.push(parent);
      currentId = parent.entity.id;
      currentDepth++;
    }

    return ancestors;
  }

  // 获取后代链
  async getDescendants(entityId: string, depth?: number): Promise<LineageRecord[]> {
    return this.store.findDescendants(entityId, depth);
  }

  // 构建视图
  async buildView(entityId: string, options: ViewOptions): Promise<LineageView> {
    // 1. 获取相关节点
    const nodes = await this.getRelatedNodes(entityId, options.depth);

    // 2. 构建子图
    const subgraph = await this.graphBuilder.buildSubgraph(nodes);

    // 3. 布局
    const layout = await this.layoutGraph(subgraph, options.layout);

    // 4. 添加样式
    const styled = this.applyStyles(layout, options.styles);

    return {
      nodes: styled.nodes,
      edges: styled.edges,
      stats: this.calculateStats(subgraph)
    };
  }

  // 检测血缘变更
  async detectChanges(
    entityId: string,
    newHash: string
  ): Promise<LineageChange[]> {
    const current = await this.store.findById(entityId);
    if (!current) return [];

    const changes: LineageChange[] = [];

    // 检测内容变更
    if (current.entity.hash !== newHash) {
      changes.push({
        type: 'content_modified',
        entityId,
        oldHash: current.entity.hash,
        newHash,
        impact: this.assessImpact(entityId)
      });
    }

    // 检测依赖变更
    const oldDeps = current.source.sourceId ? [current.source.sourceId] : [];
    const newDeps = this.extractDependencies(newHash);

    for (const newDep of newDeps) {
      if (!oldDeps.includes(newDep)) {
        changes.push({
          type: 'dependency_added',
          entityId,
          dependency: newDep
        });
      }
    }

    for (const oldDep of oldDeps) {
      if (!newDeps.includes(oldDep)) {
        changes.push({
          type: 'dependency_removed',
          entityId,
          dependency: oldDep
        });
      }
    }

    return changes;
  }
}

// 血缘过滤器
interface LineageFilter {
  entityIds?: string[];
  entityTypes?: LineageRecord['entity']['type'][];
  sourceTypes?: LineageType[];
  pipelineIds?: string[];
  stages?: PipelineStage[];
  timeRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
}

// 血缘链
interface LineageChain {
  entityId: string;
  ancestors: LineageRecord[];
  descendants: LineageRecord[];
  depth: number;
  branchFactor: number;
}

// 血缘变更
interface LineageChange {
  type: 'content_modified' | 'dependency_added' | 'dependency_removed' | 'deleted';
  entityId: string;
  oldHash?: string;
  newHash?: string;
  dependency?: string;
  impact?: ImpactAssessment;
}
```

## 分叉与重生成

### 分叉机制

```typescript
// 分叉服务
class ForkService {
  constructor(
    private lineageTracker: LineageTracker,
    private pipelineExecutor: PipelineExecutor,
    private snapshotManager: SnapshotManager
  ) {}

  // 创建分叉
  async fork(
    request: ForkRequest
  ): Promise<ForkResult> {
    // 1. 加载原管道
    const originalPipeline = await this.pipelineExecutor.getPipeline(request.pipelineId);

    // 2. 创建快照
    const snapshot = await this.snapshotManager.createSnapshot(
      originalPipeline,
      request.snapshotDescription
    );

    // 3. 创建新管道
    const forkedPipeline = await this.createForkedPipeline(
      originalPipeline,
      request,
      snapshot
    );

    // 4. 记录血缘
    await this.lineageTracker.record({
      id: generateId('lin'),
      type: LineageType.FILE_DERIVED,
      entity: {
        type: 'pipeline',
        id: forkedPipeline.id,
        name: forkedPipeline.name,
        path: forkedPipeline.id,
        hash: await this.hashPipeline(forkedPipeline)
      },
      source: {
        type: 'derived',
        sourceId: originalPipeline.id
      },
      generation: {
        pipelineId: forkedPipeline.id,
        stageId: '',
        iteration: 0
      },
      version: { major: 1, minor: 0, patch: 0, createdAt: new Date() }
    });

    return {
      forkedPipeline,
      snapshot,
      lineageCreated: true
    };
  }

  // 从指定阶段分叉
  async forkFromStage(
    pipelineId: string,
    stageId: string,
    options: ForkOptions
  ): Promise<ForkResult> {
    // 1. 获取原管道和阶段
    const pipeline = await this.pipelineExecutor.getPipeline(pipelineId);
    const stage = pipeline.stages.find(s => s.id === stageId);

    // 2. 截取到指定阶段
    const truncatedStages = pipeline.stages
      .filter(s => s.stage !== stageId)
      .map(s => ({ ...s, status: StageStatus.SKIPPED }));

    // 3. 添加分叉的阶段
    const newStages = [
      ...truncatedStages,
      this.createForkedStage(stage, options)
    ];

    // 4. 创建新管道
    const forkedPipeline = await this.createPipeline({
      ...pipeline,
      stages: newStages,
      lineage: {
        forkedFrom: pipelineId,
        forkStage: stageId,
        forkReason: options.reason
      }
    });

    return { forkedPipeline };
  }

  // 选择性重生成
  async regenerate(
    request: RegenerateRequest
  ): Promise<RegenerateResult> {
    // 1. 分析需要重生成的实体
    const affectedEntities = await this.analyzeAffectedEntities(
      request.entityIds,
      request.options
    );

    // 2. 确定需要重新执行的阶段
    const stagesToRerun = await this.determineStagesToRerun(
      affectedEntities,
      request.options
    );

    // 3. 创建新管道执行
    const newPipeline = await this.pipelineExecutor.create({
      name: `regenerate-${request.entityIds.join('-')}`,
      rootPipelineId: request.pipelineId,
      stages: stagesToRerun,
      inputs: {
        affectedEntities,
        preserveUnchanged: request.options.preserveUnchanged
      }
    });

    // 4. 执行管道
    await this.pipelineExecutor.execute(newPipeline.id);

    // 5. 更新血缘
    await this.updateLineageForRegeneration(
      request.entityIds,
      newPipeline
    );

    return {
      newPipeline,
      affectedEntities,
      stagesRerun: stagesToRerun.map(s => s.stage)
    };
  }
}

// 分叉请求
interface ForkRequest {
  pipelineId: string;
  name: string;
  description?: string;
  snapshotDescription?: string;

  // 分叉选项
  options?: {
    stages?: PipelineStage[];          // 只分叉指定阶段
    deepFork?: boolean;               // 深度分叉 (包含所有子管道)
    preserveHistory?: boolean;         // 保留历史
  };
}

// 重生成请求
interface RegenerateRequest {
  pipelineId: string;
  entityIds: string[];                 // 需要重生成的实体IDs

  options: {
    strategy: 'selective' | 'cascade' | 'shallow';
    preserveUnchanged?: boolean;       // 保留未改变的实体
    updateLineage?: boolean;           // 更新血缘
    forceRerun?: string[];            // 强制重运行的阶段
  };
}
```

### 快照管理

```typescript
// 快照管理器
class SnapshotManager {
  constructor(private storage: SnapshotStorage) {}

  // 创建快照
  async createSnapshot(
    pipeline: Pipeline,
    description?: string
  ): Promise<Snapshot> {
    const snapshot: Snapshot = {
      id: generateId('snap'),
      pipelineId: pipeline.id,
      name: `Snapshot of ${pipeline.name}`,
      description,

      // 快照内容
      content: {
        // 管道配置
        config: pipeline.config,

        // 阶段状态
        stages: pipeline.stages.map(s => ({
          stage: s.stage,
          status: s.status,
          outputs: s.outputs,
          artifacts: s.artifacts
        })),

        // 输入数据
        inputs: pipeline.stages[0]?.inputs,

        // 代码快照
        code: await this.captureCodeSnapshot(pipeline),

        // 元数据
        metadata: {
          createdAt: new Date(),
          pipelineVersion: pipeline.lineage.version,
          gitCommit?: await this.getGitCommit()
        }
      },

      // 引用计数
      refCount: 0,

      createdAt: new Date()
    };

    await this.storage.save(snapshot);
    return snapshot;
  }

  // 恢复快照
  async restoreSnapshot(snapshotId: string): Promise<RestoreResult> {
    const snapshot = await this.storage.findById(snapshotId);

    // 1. 验证快照
    await this.validateSnapshot(snapshot);

    // 2. 创建恢复管道
    const pipeline = await this.createPipelineFromSnapshot(snapshot);

    // 3. 恢复代码
    await this.restoreCode(snapshot.content.code);

    return {
      pipeline,
      restoredStages: snapshot.content.stages.length
    };
  }

  // 比较快照
  async diffSnapshots(
    snapshotId1: string,
    snapshotId2: string
  ): Promise<SnapshotDiff> {
    const snapshot1 = await this.storage.findById(snapshotId1);
    const snapshot2 = await this.storage.findById(snapshotId2);

    return {
      stagesChanged: this.compareStages(snapshot1, snapshot2),
      codeChanged: await this.compareCode(snapshot1, snapshot2),
      inputsChanged: this.compareInputs(snapshot1, snapshot2),
      stats: {
        stagesAdded: 0,
        stagesRemoved: 0,
        stagesModified: 0,
        linesAdded: 0,
        linesRemoved: 0
      }
    };
  }

  // 清理旧快照
  async cleanupOldSnapshots(options: CleanupOptions): Promise<CleanupResult> {
    const oldSnapshots = await this.storage.findOld({
      olderThan: options.olderThan,
      keepMinCount: options.keepMinCount,
      tagged: options.tagged
    });

    const deleted: string[] = [];

    for (const snapshot of oldSnapshots) {
      if (snapshot.refCount === 0) {
        await this.storage.delete(snapshot.id);
        deleted.push(snapshot.id);
      }
    }

    return { deleted, freedBytes: deleted.length * 1024 * 1024 };
  }
}

// 快照
interface Snapshot {
  id: string;
  pipelineId: string;
  name: string;
  description?: string;

  content: {
    config: PipelineConfig;
    stages: SnapshotStage[];
    inputs: any;
    code: CodeSnapshot;
    metadata: {
      createdAt: Date;
      pipelineVersion: string;
      gitCommit?: string;
    };
  };

  refCount: number;
  createdAt: Date;
}

// 代码快照
interface CodeSnapshot {
  files: {
    path: string;
    content: string;
    hash: string;
    language: string;
  }[];
  checksum: string;
  size: number;
}
```

## 管道执行器

### 执行引擎

```typescript
// 管道执行器
class PipelineExecutor {
  private executingPipelines: Map<string, Pipeline>;

  constructor(
    private agentRegistry: AgentRegistry,
    private lineageTracker: LineageTracker,
    private qualityGate: QualityGate
  ) {
    this.executingPipelines = new Map();
  }

  // 创建管道
  async create(request: CreatePipelineRequest): Promise<Pipeline> {
    const pipeline: Pipeline = {
      id: generateId('pipe'),
      name: request.name,
      projectId: request.projectId,

      stages: await this.buildStages(request.stages),
      config: request.config,

      status: PipelineStatus.CREATED,
      lineage: {
        version: { major: 1, minor: 0, patch: 0 },
        createdAt: new Date()
      },

      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.savePipeline(pipeline);
    return pipeline;
  }

  // 执行管道
  async execute(pipelineId: string): Promise<ExecutionResult> {
    const pipeline = await this.getPipeline(pipelineId);

    // 1. 更新状态
    pipeline.status = PipelineStatus.RUNNING;
    pipeline.startedAt = new Date();
    await this.savePipeline(pipeline);

    this.executingPipelines.set(pipelineId, pipeline);

    // 2. 执行阶段
    try {
      for (const stage of pipeline.stages) {
        // 检查是否应该跳过
        if (stage.config.skip) {
          stage.status = StageStatus.SKIPPED;
          continue;
        }

        // 检查依赖
        const depsMet = await this.checkDependencies(stage);
        if (!depsMet) {
          stage.status = StageStatus.BLOCKED;
          continue;
        }

        // 执行阶段
        const result = await this.executeStage(pipeline, stage);

        if (!result.success) {
          // 处理失败
          const shouldRetry = await this.handleStageFailure(pipeline, stage, result.error);

          if (!shouldRetry) {
            pipeline.status = PipelineStatus.FAILED;
            pipeline.error = result.error;
            break;
          }
        }

        // 检查质量门禁
        if (stage.config.quality?.enabled) {
          const gateResult = await this.qualityGate.evaluate(stage.outputs);
          if (!gateResult.passed) {
            pipeline.status = PipelineStatus.FAILED;
            pipeline.error = { type: 'quality_gate_failed', details: gateResult };
            break;
          }
        }
      }

      // 3. 完成管道
      pipeline.status = PipelineStatus.COMPLETED;
      pipeline.completedAt = new Date();
      pipeline.duration = pipeline.completedAt.getTime() - pipeline.startedAt.getTime();

    } catch (error) {
      pipeline.status = PipelineStatus.FAILED;
      pipeline.error = this.formatError(error);
    } finally {
      await this.savePipeline(pipeline);
      this.executingPipelines.delete(pipelineId);
    }

    return this.formatExecutionResult(pipeline);
  }

  // 执行单个阶段
  private async executeStage(
    pipeline: Pipeline,
    stage: StageInstance
  ): Promise<StageExecutionResult> {
    // 1. 准备Agent
    const agent = await this.agentRegistry.getAgent(stage.config.agentType);

    // 2. 准备输入
    const inputs = await this.prepareInputs(pipeline, stage);

    // 3. 执行
    stage.status = StageStatus.RUNNING;
    stage.startedAt = new Date();

    const startTime = Date.now();

    try {
      const result = await agent.execute({
        prompt: this.buildPrompt(stage, inputs),
        context: {
          pipelineId: pipeline.id,
          stageId: stage.id,
          config: stage.config
        },
        signal: this.createAbortSignal(stage.config.timeout)
      });

      // 4. 处理输出
      stage.outputs = this.processOutputs(result);

      // 5. 记录血缘
      await this.lineageTracker.recordBatch(
        this.createLineageRecords(pipeline, stage, result)
      );

      stage.status = StageStatus.COMPLETED;
      stage.duration = Date.now() - startTime;

      return { success: true, result };

    } catch (error) {
      stage.status = StageStatus.FAILED;
      stage.error = this.formatError(error);
      stage.duration = Date.now() - startTime;

      return { success: false, error: stage.error };
    }
  }

  // 检查依赖
  private async checkDependencies(stage: StageInstance): Promise<boolean> {
    for (const depStage of stage.config.dependsOn) {
      const dep = stage.pipeline?.stages.find(s => s.stage === depStage);
      if (!dep || dep.status !== StageStatus.COMPLETED) {
        return false;
      }
    }
    return true;
  }
}
```

### 并行执行

```typescript
// 并行执行器
class ParallelExecutor {
  constructor(
    private executor: PipelineExecutor,
    private scheduler: TaskScheduler
  ) {}

  // 并行执行多个管道
  async executeParallel(
    pipelines: string[],
    options: ParallelOptions
  ): Promise<ParallelExecutionResult> {
    // 1. 创建任务
    const tasks = pipelines.map(id => ({
      id,
      priority: options.priorities?.[id] || 0,
      deps: options.dependencies?.[id] || []
    }));

    // 2. 拓扑排序
    const sorted = this.topologicalSort(tasks);

    // 3. 分批执行
    const results: Map<string, ExecutionResult> = new Map();

    for (const batch of this.createBatches(sorted, options.maxConcurrency)) {
      const batchResults = await Promise.all(
        batch.map(id => this.executor.execute(id))
      );

      batchResults.forEach((result, index) => {
        results.set(batch[index], result);
      });

      // 4. 检查是否需要等待
      if (options.waitOnFailure && batchResults.some(r => !r.success)) {
        // 停止执行
        break;
      }
    }

    return {
      total: pipelines.length,
      succeeded: Array.from(results.values()).filter(r => r.success).length,
      failed: Array.from(results.values()).filter(r => !r.success).length,
      results
    };
  }

  // 创建依赖批
  private createBatches(
    sorted: string[],
    maxConcurrency: number
  ): string[][] {
    const batches: string[][] = [];
    let currentBatch: string[] = [];

    for (const id of sorted) {
      currentBatch.push(id);

      if (currentBatch.length >= maxConcurrency) {
        batches.push(currentBatch);
        currentBatch = [];
      }
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }
}
```

## 版本控制集成

### Git集成

```typescript
// Git集成服务
class GitIntegration {
  constructor(
    private git: GitService,
    private lineageTracker: LineageTracker
  ) {}

  // 提交生成的代码
  async commitGeneratedCode(
    pipelineId: string,
    options: CommitOptions
  ): Promise<CommitResult> {
    // 1. 获取管道的代码变更
    const changes = await this.getPipelineChanges(pipelineId);

    // 2. 创建提交
    const commit = await this.git.createCommit({
      message: this.generateCommitMessage(pipelineId, changes),
      author: options.author,
      files: changes.map(c => ({
        path: c.path,
        content: c.content
      }))
    });

    // 3. 创建标签
    if (options.tag) {
      await this.git.createTag({
        tag: `${options.tagPrefix}${pipelineId}`,
        commit: commit.id,
        message: options.tagMessage
      });
    }

    // 4. 记录到血缘
    await this.lineageTracker.record({
      id: generateId('lin'),
      type: LineageType.FILE_GENERATED,
      entity: {
        type: 'git_commit',
        id: commit.id,
        name: commit.message,
        path: commit.id,
        hash: commit.hash
      },
      source: {
        type: 'generated',
        sourceId: pipelineId
      },
      generation: {
        pipelineId,
        stageId: '',
        iteration: 0
      },
      version: { major: 1, minor: 0, patch: 0, createdAt: new Date() }
    });

    return { commit, changes };
  }

  // 从Git历史恢复
  async restoreFromGit(
    commitHash: string,
    targetPath: string
  ): Promise<RestoreFromGitResult> {
    // 1. 获取提交的文件
    const files = await this.git.getCommitFiles(commitHash);

    // 2. 获取血缘信息
    const lineage = await this.lineageTracker.query({
      entityIds: files.map(f => f.path)
    });

    // 3. 恢复文件
    const restored = await this.git.checkoutFiles(commitHash, targetPath, files.map(f => f.path));

    return {
      restoredFiles: restored,
      lineageRecords: lineage
    };
  }

  // 生成提交信息
  private generateCommitMessage(
    pipelineId: string,
    changes: FileChange[]
  ): string {
    const summary = changes.length === 1
      ? `Generated: ${changes[0].path}`
      : `Generated: ${changes.length} files`;

    const details = changes
      .slice(0, 5)
      .map(c => `- ${c.action}: ${c.path}`)
      .join('\n');

    return `${summary}\n\n${details}\n\nGenerated by pipeline: ${pipelineId}`;
  }
}

// Git提交选项
interface CommitOptions {
  author?: {
    name: string;
    email: string;
  };
  tag?: boolean;
  tagPrefix?: string;
  tagMessage?: string;
  push?: boolean;
}
```

## 监控与可视化

### 执行监控

```typescript
// 管道监控
class PipelineMonitor {
  constructor(
    private metrics: MetricsCollector,
    private events: EventEmitter
  ) {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.events.on('stage:started', (data) => {
      this.metrics.increment('pipeline.stage.started', {
        pipeline: data.pipelineId,
        stage: data.stage
      });
    });

    this.events.on('stage:completed', (data) => {
      this.metrics.record('pipeline.stage.duration', data.duration, {
        pipeline: data.pipelineId,
        stage: data.stage,
        status: 'success'
      });
    });

    this.events.on('stage:failed', (data) => {
      this.metrics.record('pipeline.stage.duration', data.duration, {
        pipeline: data.pipelineId,
        stage: data.stage,
        status: 'failed'
      });
      this.metrics.increment('pipeline.stage.failed', {
        pipeline: data.pipelineId,
        stage: data.stage,
        error: data.errorType
      });
    });
  }

  // 获取实时状态
  async getRealtimeStatus(pipelineId: string): Promise<RealtimeStatus> {
    const pipeline = await this.getPipeline(pipelineId);

    return {
      pipelineId,
      status: pipeline.status,
      currentStage: pipeline.currentStage,
      progress: this.calculateProgress(pipeline),
      stages: pipeline.stages.map(s => ({
        id: s.id,
        name: s.stage,
        status: s.status,
        progress: s.progress,
        duration: s.duration,
        startedAt: s.startedAt
      })),
      estimatedCompletion: this.estimateCompletion(pipeline)
    };
  }

  // 获取血缘视图数据
  async getLineageView(
    pipelineId: string,
    options: ViewOptions
  ): Promise<LineageViewData> {
    const pipeline = await this.getPipeline(pipelineId);
    const lineageGraph = await this.lineageTracker.buildView(pipelineId, {
      depth: options.depth || 3,
      layout: options.layout || 'dagre'
    });

    return {
      pipelineId,
      nodes: lineageGraph.nodes,
      edges: lineageGraph.edges,
      stats: lineageGraph.stats,
      layout: this.applyLayout(lineageGraph, options.layout)
    };
  }
}
```

## 配置

```typescript
// 生成管道配置
interface GenerationPipelineConfig {
  // 管道配置
  pipeline: {
    defaultStages: StageDefinition[];
    allowCustomStages: boolean;
    maxStages: number;
    defaultTimeout: number;
  };

  // 执行配置
  execution: {
    parallelStages: boolean;
    maxParallelStages: number;
    retryEnabled: boolean;
    maxRetries: number;
    failFast: boolean;
  };

  // 血缘配置
  lineage: {
    enabled: boolean;
    trackAll: boolean;
    retentionDays: number;
    maxDepth: number;
  };

  // 快照配置
  snapshot: {
    enabled: boolean;
    autoSnapshot: boolean;
    retentionDays: number;
    maxSnapshots: number;
  };

  // 分叉配置
  fork: {
    enabled: boolean;
    allowDeepFork: boolean;
    maxForks: number;
    preserveHistory: boolean;
  };

  // Git集成
  git: {
    enabled: boolean;
    autoCommit: boolean;
    branchPrefix: string;
    tagPrefix: string;
  };
}
```

---

**最后更新**: 2026-04-15
