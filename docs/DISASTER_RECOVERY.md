# 灾难恢复与业务连续性设计

## 概述

本文档定义 ProjectFactory 系统的灾难恢复（DR）和业务连续性（BC）策略，确保系统在面临各类故障和灾难时能够快速恢复，最大限度减少业务中断。

## 1. 风险评估

### 1.1 威胁分类

| 威胁类型 | 可能性 | 影响程度 | 优先级 |
|----------|--------|----------|--------|
| 单节点硬件故障 | 🟠 中 | 🔴 高 | P1 |
| 数据中心级故障 | 🟡 低 | 🔴 极高 | P0 |
| 网络中断 | 🟠 中 | 🟠 高 | P1 |
| 软件缺陷导致数据损坏 | 🟡 低 | 🔴 高 | P1 |
| 安全攻击/勒索软件 | 🟡 低 | 🔴 极高 | P0 |
| 人为操作失误 | 🟡 低 | 🟠 高 | P2 |
| 第三方服务故障 | 🟠 中 | 🟠 中 | P2 |

### 1.2 业务影响分析（BIA）

```
恢复时间目标 (RTO): 4 小时
恢复点目标 (RPO): 1 小时

关键业务功能：
1. 项目生成流水线 - 中断将阻止新项目产生
2. 知识库查询 - 影响所有 AI 功能
3. 项目状态追踪 - 影响监控和报告
4. 用户认证 - 影响所有用户操作
```

## 2. 备份策略

### 2.1 备份类型

```typescript
// src/infra/backup/backup-config.ts
interface BackupConfig {
  // 数据库备份
  database: {
    fullBackup: {
      frequency: 'daily',        // 每日全量
      retention: 30,             // 保留 30 天
      time: '02:00 UTC',        // 凌晨 2 点
      compression: true,
    };
    incrementalBackup: {
      frequency: 'hourly',      // 每小时增量
      retention: 7,             // 保留 7 天
    };
    pointInTimeRecovery: {
      enabled: true,
      window: 72 * 3600,        // 72 小时 PITR 窗口
    };
  };

  // 文件系统备份
  files: {
    projectsDirectory: {
      frequency: 'daily',
      retention: 14,
      excludes: ['node_modules/**', '.git/**', 'dist/**'],
    };
    generatedArtifacts: {
      frequency: 'hourly',
      retention: 7,
    };
  };

  // 配置备份
  config: {
    frequency: 'daily',
    retention: 30,
    destinations: ['s3', 'local'],
  };
}

export const backupConfig: BackupConfig = {
  database: {
    fullBackup: { frequency: 'daily', retention: 30, time: '02:00 UTC', compression: true },
    incrementalBackup: { frequency: 'hourly', retention: 7 },
    pointInTimeRecovery: { enabled: true, window: 72 * 3600 },
  },
  files: {
    projectsDirectory: { frequency: 'daily', retention: 14, excludes: ['node_modules/**', '.git/**', 'dist/**'] },
    generatedArtifacts: { frequency: 'hourly', retention: 7 },
  },
  config: { frequency: 'daily', retention: 30, destinations: ['s3', 'local'] },
};
```

### 2.2 备份执行器

```typescript
// src/infra/backup/backup-executor.ts
interface BackupMetadata {
  id: string;
  type: 'full' | 'incremental' | 'config';
  startedAt: number;
  completedAt?: number;
  sizeBytes?: number;
  checksum?: string;
  status: 'in_progress' | 'completed' | 'failed';
  error?: string;
}

class BackupExecutor {
  private backupHistory: BackupMetadata[] = [];
  private s3Client: any;
  private localBackupPath = '/backups';

  async executeFullBackup(): Promise<BackupMetadata> {
    const metadata: BackupMetadata = {
      id: `backup-${Date.now()}`,
      type: 'full',
      startedAt: Date.now(),
      status: 'in_progress',
    };

    try {
      // 1. 数据库全量备份
      await this.backupDatabase();

      // 2. 文件系统备份
      await this.backupFileSystem();

      // 3. 配置备份
      await this.backupConfig();

      metadata.status = 'completed';
      metadata.completedAt = Date.now();
    } catch (error) {
      metadata.status = 'failed';
      metadata.error = (error as Error).message;
    }

    this.backupHistory.push(metadata);
    return metadata;
  }

  private async backupDatabase(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `db-full-${timestamp}.sql.gz`;

    // 执行 pg_dump
    // await execAsync(`pg_dump -Fc -f ${this.localBackupPath}/${filename}`);

    // 验证备份完整性
    // await this.verifyBackup(filename);

    // 上传到 S3
    await this.uploadToS3(`${this.localBackupPath}/${filename}`, `backups/${filename}`);
  }

  private async backupFileSystem(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `projects-${timestamp}.tar.gz`;

    // 使用 tar 打包，排除大文件和临时文件
    const excludes = backupConfig.files.projectsDirectory.excludes
      .map(p => `--exclude=${p}`)
      .join(' ');

    // await execAsync(`tar -czf ${filename} ${excludes} ./projects`);

    await this.uploadToS3(`${filename}`, `backups/${filename}`);
  }

  private async uploadToS3(localPath: string, s3Key: string): Promise<void> {
    // 使用 AWS SDK 上传
    // await this.s3Client.upload(localPath, s3Key);
    console.log(`Uploading ${localPath} to s3://bucket/${s3Key}`);
  }

  async restoreFromBackup(backupId: string, targetPath?: string): Promise<void> {
    const backup = this.backupHistory.find(b => b.id === backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    console.log(`Starting restore from backup: ${backupId}`);

    // 1. 停止所有服务
    await this.stopServices();

    // 2. 恢复数据库
    await this.restoreDatabase(backup);

    // 3. 恢复文件系统
    await this.restoreFileSystem(backup, targetPath);

    // 4. 重新启动服务
    await this.startServices();

    console.log(`Restore completed successfully`);
  }

  private async stopServices(): Promise<void> {
    // 停止 API 服务
    // 停止后台处理器
    // 停止定时任务
    console.log('Services stopped');
  }

  private async startServices(): Promise<void> {
    // 启动 API 服务
    // 启动后台处理器
    // 启动定时任务
    console.log('Services started');
  }

  getBackupHistory(limit = 10): BackupMetadata[] {
    return this.backupHistory.slice(-limit);
  }

  getLatestSuccessfulBackup(type: 'full' | 'incremental' | 'config'): BackupMetadata | undefined {
    return this.backupHistory
      .filter(b => b.type === type && b.status === 'completed')
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))[0];
  }
}

export const backupExecutor = new BackupExecutor();
```

### 2.3 增量备份与 PITR

```typescript
// src/infra/backup/incremental-backup.ts
class IncrementalBackupManager {
  private walArchiver: any;
  private lastCheckpoint: string = '';

  async executeIncrementalBackup(): Promise<void> {
    // 1. 获取自上次备份以来的 WAL 日志
    const walFiles = await this.getWalFilesSince(this.lastCheckpoint);

    // 2. 归档 WAL 文件
    for (const walFile of walFiles) {
      await this.archiveWal(walFile);
    }

    // 3. 更新检查点
    this.lastCheckpoint = await this.getCurrentCheckpoint();
  }

  async pointInTimeRecovery(targetTime: Date): Promise<void> {
    // 1. 获取目标时间之前的最近全量备份
    const fullBackup = await this.getFullBackupBefore(targetTime);
    if (!fullBackup) {
      throw new Error('No full backup found before target time');
    }

    // 2. 恢复到全量备份点
    await this.restoreFullBackup(fullBackup);

    // 3. 重放 WAL 日志到目标时间
    const walFiles = await this.getWalFilesBetween(fullBackup.timestamp, targetTime);
    await this.replayWalFiles(walFiles, targetTime);

    console.log(`PITR completed to ${targetTime.toISOString()}`);
  }

  private async getWalFilesSince(checkpoint: string): Promise<string[]> {
    // 查询 PostgreSQL WAL 目录获取新文件
    // return await this.walArchiver.getFilesSince(checkpoint);
    return [];
  }

  private async archiveWal(walFile: string): Promise<void> {
    // 压缩并上传到 S3
    // await this.s3Client.uploadCompressed(`wal/${walFile}`);
  }

  private async replayWalFiles(walFiles: string[], targetTime: Date): Promise<void> {
    for (const walFile of walFiles) {
      // 下载并解压 WAL 文件
      // 执行 pg_xlogReplay
      // 检查是否已达到目标时间
      if (new Date() >= targetTime) break;
    }
  }
}

export const incrementalBackupManager = new IncrementalBackupManager();
```

## 3. 高可用架构

### 3.1 多区域部署

```yaml
# deployment/multi-region-config.yaml
regions:
  primary:
    name: us-west-2
    weight: 70
    endpoints:
      - api.projectfactory.io
    database:
      replica: primary
      autoFailover: true

  secondary:
    name: us-east-1
    weight: 30
    endpoints:
      - api-secondary.projectfactory.io
    database:
      replica: read-replica
      autoFailover: true

  tertiary:
    name: eu-west-1
    weight: 0  # 灾难恢复时启用
    endpoints:
      - api-dr.projectfactory.io
    database:
      replica: cross-region-replica
      autoFailover: false  # 手动触发
```

### 3.2 故障转移机制

```typescript
// src/infra/ha/failover-manager.ts
interface FailoverConfig {
  healthCheckInterval: number;    // 健康检查间隔（秒）
  failureThreshold: number;      // 失败次数阈值
  recoveryThreshold: number;     // 恢复健康需要的成功次数
  maxFailoverDuration: number;    // 最大故障转移时间（秒）
}

class FailoverManager {
  private config: FailoverConfig;
  private currentRegion: string = 'primary';
  private failureCount = 0;
  private healthyCount = 0;

  constructor(config: FailoverConfig) {
    this.config = config;
    this.startHealthChecks();
  }

  private startHealthChecks(): void {
    setInterval(() => this.checkRegionHealth(), this.config.healthCheckInterval * 1000);
  }

  private async checkRegionHealth(): Promise<void> {
    const health = await this.performHealthCheck(this.currentRegion);

    if (health.healthy) {
      this.healthyCount++;
      this.failureCount = 0;

      if (this.healthyCount >= this.config.recoveryThreshold) {
        console.log(`Region ${this.currentRegion} recovered`);
        this.healthyCount = 0;
      }
    } else {
      this.failureCount++;
      this.healthyCount = 0;

      if (this.failureCount >= this.config.failureThreshold) {
        await this.initiateFailover();
      }
    }
  }

  private async performHealthCheck(region: string): Promise<{ healthy: boolean; latency: number }> {
    // 检查 API 可用性
    // 检查数据库连接
    // 检查关键服务状态
    return { healthy: true, latency: 50 };
  }

  async initiateFailover(): Promise<void> {
    console.warn(`Initiating failover from ${this.currentRegion}...`);

    // 1. 停止写入当前区域
    await this.drainWriteConnections(this.currentRegion);

    // 2. 选择目标区域
    const targetRegion = await this.selectFailoverTarget();
    console.log(`Selected failover target: ${targetRegion}`);

    // 3. 提升目标区域数据库为主节点
    await this.promoteDatabase(targetRegion);

    // 4. 更新 DNS 路由
    await this.updateDnsRouting(targetRegion);

    // 5. 恢复写入连接
    await this.restoreWriteConnections(targetRegion);

    // 6. 验证故障转移
    await this.verifyFailover(targetRegion);

    console.log(`Failover completed to ${targetRegion}`);
    this.currentRegion = targetRegion;
    this.failureCount = 0;
  }

  private async selectFailoverTarget(): Promise<string> {
    // 根据延迟、可用性和数据新鲜度选择目标区域
    const regions = ['secondary', 'tertiary'];
    let bestRegion = 'secondary';
    let bestScore = 0;

    for (const region of regions) {
      const score = await this.evaluateRegionHealth(region);
      if (score > bestScore) {
        bestScore = score;
        bestRegion = region;
      }
    }

    return bestRegion;
  }

  private async evaluateRegionHealth(region: string): Promise<number> {
    // 综合评分：延迟、数据延迟、可用性
    const latencyScore = Math.max(0, 100 - await this.getRegionLatency(region));
    const dataFreshness = await this.getDataFreshnessScore(region);
    const availability = await this.getRegionAvailability(region);

    return latencyScore * 0.3 + dataFreshness * 0.4 + availability * 0.3;
  }

  private async verifyFailover(region: string): Promise<void> {
    // 执行一系列验证检查
    const checks = [
      await this.verifyDatabaseWritable(region),
      await this.verifyApiResponsive(region),
      await this.verifyDataIntegrity(region),
    ];

    if (!checks.every(c => c)) {
      throw new Error('Failover verification failed');
    }
  }

  async manualFailback(): Promise<void> {
    if (this.currentRegion === 'primary') {
      console.log('Already on primary region, no failback needed');
      return;
    }

    console.log('Initiating manual failback to primary region...');
    await this.initiateFailover();
  }
}

export const failoverManager = new FailoverManager({
  healthCheckInterval: 10,
  failureThreshold: 3,
  recoveryThreshold: 3,
  maxFailoverDuration: 300,
});
```

### 3.3 数据库高可用

```typescript
// src/infra/database/ha-database.ts
class HADatabaseManager {
  private pool: Pool;
  private primaryEndpoint: string;
  private replicaEndpoints: string[] = [];

  async initialize(): Promise<void> {
    // 1. 建立主库连接
    this.pool = new Pool({ connectionString: this.primaryEndpoint });

    // 2. 验证主从复制状态
    await this.verifyReplicationStatus();

    // 3. 设置自动故障检测
    this.setupConnectionMonitoring();
  }

  private setupConnectionMonitoring(): void {
    this.pool.on('error', async (err) => {
      console.error('Database pool error:', err);
      await this.handleConnectionFailure();
    });
  }

  private async handleConnectionFailure(): Promise<void> {
    // 尝试从从库读取以验证从库状态
    const readPool = new Pool({ connectionString: this.replicaEndpoints[0] });

    try {
      await readPool.query('SELECT 1');
      console.log('Read replica is available');
    } catch (error) {
      console.error('All database replicas unavailable');
      // 触发全面故障转移
      await failoverManager.initiateFailover();
    }
  }

  // 读写分离
  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    // 写入操作走主库
    if (this.isWriteOperation(sql)) {
      return this.pool.query(sql, params);
    }

    // 读取操作走从库（负载均衡）
    const replicaEndpoint = this.selectReplica();
    const readPool = new Pool({ connectionString: replicaEndpoint });
    return readPool.query(sql, params);
  }

  private isWriteOperation(sql: string): boolean {
    const writeKeywords = ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE'];
    return writeKeywords.some(kw => sql.toUpperCase().includes(kw));
  }

  private selectReplica(): string {
    // 简单轮询负载均衡
    const index = Math.floor(Math.random() * this.replicaEndpoints.length);
    return this.replicaEndpoints[index];
  }
}

export const haDatabase = new HADatabaseManager();
```

## 4. 灾难恢复流程

### 4.1 恢复场景与策略

```typescript
// src/infra/dr/recovery-scenarios.ts
interface RecoveryScenario {
  name: string;
  trigger: string;
  rto: number;       // 恢复时间目标（分钟）
  rpo: number;       // 恢复点目标（分钟）
  steps: RecoveryStep[];
}

type RecoveryStep = {
  order: number;
  action: string;
  responsible: 'automated' | 'ops-team' | 'dev-team';
  timeout: number;   // 超时时间（分钟）
  verification?: string;
};

const recoveryScenarios: RecoveryScenario[] = [
  {
    name: '单节点故障',
    trigger: '健康检查失败 × 3',
    rto: 15,
    rpo: 0,
    steps: [
      { order: 1, action: '自动重启失败节点', responsible: 'automated', timeout: 5 },
      { order: 2, action: '验证服务恢复', responsible: 'automated', timeout: 5, verification: 'health-check' },
      { order: 3, action: '如重启失败，替换节点', responsible: 'ops-team', timeout: 10 },
    ],
  },
  {
    name: '数据库主节点故障',
    trigger: '主库不可达',
    rto: 30,
    rpo: 1,
    steps: [
      { order: 1, action: '检测主库故障', responsible: 'automated', timeout: 1 },
      { order: 2, action: '提升从库为主库', responsible: 'automated', timeout: 5 },
      { order: 3, action: '更新连接字符串', responsible: 'automated', timeout: 2 },
      { order: 4, action: '验证数据库写入', responsible: 'automated', timeout: 5, verification: 'write-test' },
      { order: 5, action: '重新路由流量', responsible: 'automated', timeout: 5 },
      { order: 6, action: '通知相关团队', responsible: 'automated', timeout: 1 },
    ],
  },
  {
    name: '区域级故障',
    trigger: '整个区域不可用',
    rto: 240,
    rpo: 60,
    steps: [
      { order: 1, action: '确认区域故障', responsible: 'ops-team', timeout: 15 },
      { order: 2, action: '激活备份区域', responsible: 'ops-team', timeout: 30 },
      { order: 3, action: '恢复数据库到备份区域', responsible: 'automated', timeout: 120, verification: 'db-integrity-check' },
      { order: 4, action: '恢复文件系统备份', responsible: 'automated', timeout: 60 },
      { order: 5, action: '更新 DNS 指向', responsible: 'automated', timeout: 5 },
      { order: 6, action: '验证所有服务', responsible: 'ops-team', timeout: 30, verification: 'full-health-check' },
      { order: 7, action: '通知用户', responsible: 'dev-team', timeout: 15 },
    ],
  },
  {
    name: '数据损坏/误删除',
    trigger: '数据一致性检查失败',
    rto: 60,
    rpo: 5,
    steps: [
      { order: 1, action: '确认数据损坏范围', responsible: 'dev-team', timeout: 10 },
      { order: 2, action: '停止写入服务', responsible: 'automated', timeout: 2 },
      { order: 3, action: '恢复到上一个干净备份点', responsible: 'automated', timeout: 30, verification: 'data-integrity-check' },
      { order: 4, action: '验证应用状态', responsible: 'dev-team', timeout: 10 },
      { order: 5, action: '恢复服务', responsible: 'automated', timeout: 5 },
      { order: 6, action: '分析根本原因', responsible: 'dev-team', timeout: 30 },
    ],
  },
];
```

### 4.2 自动化恢复执行器

```typescript
// src/infra/dr/recovery-executor.ts
interface RecoveryExecution {
  scenario: string;
  startedAt: number;
  completedAt?: number;
  status: 'in_progress' | 'completed' | 'failed' | 'manual_intervention_required';
  steps: Map<number, { status: string; completedAt?: number; error?: string }>;
  currentStep?: number;
}

class RecoveryExecutor {
  private executions: RecoveryExecution[] = [];
  private alerting: AlertingService;
  private rollbackPlan?: RecoveryPlan;

  async executeScenario(scenarioName: string): Promise<RecoveryExecution> {
    const scenario = recoveryScenarios.find(s => s.name === scenarioName);
    if (!scenario) {
      throw new Error(`Unknown recovery scenario: ${scenarioName}`);
    }

    // 1. 创建执行记录
    const execution: RecoveryExecution = {
      scenario: scenarioName,
      startedAt: Date.now(),
      status: 'in_progress',
      steps: new Map(),
    };
    this.executions.push(execution);

    // 2. 记录当前状态（用于回滚）
    await this.captureCurrentState();

    // 3. 发送告警
    await this.alerting.send('critical', `Starting recovery: ${scenarioName}`);

    // 4. 按步骤执行
    for (const step of scenario.steps) {
      execution.currentStep = step.order;

      try {
        await this.executeStep(step, execution);
        execution.steps.set(step.order, { status: 'completed', completedAt: Date.now() });
      } catch (error) {
        execution.steps.set(step.order, {
          status: 'failed',
          error: (error as Error).message,
        });

        if (step.responsible === 'automated') {
          // 自动步骤失败，尝试回滚
          await this.rollback();
          execution.status = 'failed';
          break;
        } else {
          // 手动步骤需要人工介入
          execution.status = 'manual_intervention_required';
          await this.alerting.send('critical', `Manual intervention required: Step ${step.order}`);
        }
      }

      // 验证步骤
      if (step.verification) {
        const verified = await this.verifyStep(step.verification);
        if (!verified) {
          throw new Error(`Verification failed for step: ${step.action}`);
        }
      }
    }

    execution.status = 'completed';
    execution.completedAt = Date.now();
    await this.alerting.send('info', `Recovery completed: ${scenarioName}`);

    return execution;
  }

  private async executeStep(step: RecoveryStep, execution: RecoveryExecution): Promise<void> {
    console.log(`Executing step ${step.order}: ${step.action}`);

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Step timeout')), step.timeout * 60 * 1000)
    );

    const action = this.performStepAction(step.action);

    await Promise.race([action, timeout]);
  }

  private async performStepAction(action: string): Promise<void> {
    // 根据 action 类型执行相应操作
    switch (action) {
      case '自动重启失败节点':
        // await restartFailedNode();
        break;
      case '提升从库为主库':
        // await promoteReplica();
        break;
      case '更新 DNS 指向':
        // await updateDnsRouting();
        break;
      // ... 其他操作
    }
  }

  private async verifyStep(verification: string): Promise<boolean> {
    switch (verification) {
      case 'health-check':
        // return await performHealthCheck();
      case 'write-test':
        // return await performWriteTest();
      case 'db-integrity-check':
        // return await performDbIntegrityCheck();
      case 'data-integrity-check':
        // return await performDataIntegrityCheck();
      case 'full-health-check':
        // return await performFullHealthCheck();
      default:
        return true;
    }
  }

  private async captureCurrentState(): Promise<void> {
    // 捕获当前系统状态用于回滚
    // 保存数据库连接信息
    // 保存配置文件
    // 保存内存状态
  }

  async rollback(): Promise<void> {
    console.log('Initiating rollback...');
    if (this.rollbackPlan) {
      // 执行回滚计划
    }
  }

  getExecutionHistory(): RecoveryExecution[] {
    return this.executions;
  }
}

export const recoveryExecutor = new RecoveryExecutor();
```

## 5. 业务连续性

### 5.1 降级服务策略

```typescript
// src/infra/bc/graceful-degradation.ts
interface DegradationLevel {
  level: number;
  name: string;
  affectedFeatures: string[];
  enabledConditions: string[];
}

const degradationLevels: DegradationLevel[] = [
  {
    level: 0,
    name: 'full',
    affectedFeatures: [],
    enabledConditions: ['all-services-healthy'],
  },
  {
    level: 1,
    name: 'degraded-llm',
    affectedFeatures: ['advanced-code-review', 'complex-architecture-suggestions'],
    enabledConditions: ['llm-high-latency'],
  },
  {
    level: 2,
    name: 'degraded-knowledge',
    affectedFeatures: ['semantic-search', 'contextual-suggestions'],
    enabledConditions: ['knowledge-base-unavailable'],
  },
  {
    level: 3,
    name: 'basic-mode',
    affectedFeatures: ['project-generation', 'file-creation'],
    enabledConditions: ['high-load'],
  },
  {
    level: 4,
    name: 'read-only',
    affectedFeatures: ['project-creation', 'modifications'],
    enabledConditions: ['database-write-failure'],
  },
];

class GracefulDegradationManager {
  private currentLevel = 0;
  private featureFlags: Map<string, boolean> = new Map();

  async evaluateAndDegrade(): Promise<void> {
    const conditions = await this.evaluateConditions();

    let newLevel = 0;
    for (const level of degradationLevels) {
      if (this.shouldEnableLevel(level, conditions)) {
        newLevel = level.level;
      }
    }

    if (newLevel !== this.currentLevel) {
      await this.transitionToLevel(newLevel);
    }
  }

  private async evaluateConditions(): Promise<Map<string, boolean>> {
    const conditions = new Map<string, boolean>();

    conditions.set('all-services-healthy', await this.checkServicesHealth());
    conditions.set('llm-high-latency', await this.checkLLMLatency() > 5000);
    conditions.set('knowledge-base-unavailable', !(await this.checkKnowledgeBaseHealth()));
    conditions.set('high-load', await this.checkSystemLoad() > 0.9);
    conditions.set('database-write-failure', !(await this.checkDatabaseWritable()));

    return conditions;
  }

  private shouldEnableLevel(level: DegradationLevel, conditions: Map<string, boolean>): boolean {
    return level.enabledConditions.every(c => conditions.get(c) ?? false);
  }

  private async transitionToLevel(level: number): Promise<void> {
    const previousLevel = this.currentLevel;
    this.currentLevel = level;

    const levelInfo = degradationLevels.find(l => l.level === level)!;
    console.log(`Degrading to level ${level}: ${levelInfo.name}`);

    // 禁用受影响的特性
    for (const feature of levelInfo.affectedFeatures) {
      this.featureFlags.set(feature, false);
    }

    // 发送通知
    await this.notifyDegradation(previousLevel, level);

    // 记录指标
    metrics.increment(`degradation.level_${level}`);
  }

  isFeatureEnabled(feature: string): boolean {
    return this.featureFlags.get(feature) ?? true;
  }

  private async checkServicesHealth(): Promise<boolean> {
    // 检查所有服务健康状态
    return true;
  }

  private async checkLLMLatency(): Promise<number> {
    // 返回当前 LLM 平均延迟
    return 100;
  }

  private async checkKnowledgeBaseHealth(): Promise<boolean> {
    return true;
  }

  private async checkSystemLoad(): Promise<number> {
    return 0.5;
  }

  private async checkDatabaseWritable(): Promise<boolean> {
    return true;
  }

  private async notifyDegradation(from: number, to: number): Promise<void> {
    console.log(`System degraded from level ${from} to level ${to}`);
  }
}

export const degradationManager = new GracefulDegradationManager();
```

### 5.2 熔断机制

```typescript
// src/infra/bc/circuit-breaker.ts
interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;        // 熔断打开持续时间
  monitorWindow: number;   // 监控窗口
}

class AdaptiveCircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.config.timeout) {
        this.state = 'half-open';
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();

      if (this.state === 'half-open') {
        this.successCount++;
        if (this.successCount >= this.config.successThreshold) {
          this.state = 'closed';
          this.failureCount = 0;
        }
      } else {
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.lastFailureTime = Date.now();
      this.failureCount++;

      if (this.state === 'half-open') {
        this.state = 'open';
      } else if (this.failureCount >= this.config.failureThreshold) {
        this.state = 'open';
      }

      throw error;
    }
  }

  getState(): string {
    return this.state;
  }
}

// 为不同服务创建独立的熔断器
export const llmCircuitBreaker = new AdaptiveCircuitBreaker({
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000,
  monitorWindow: 120000,
});

export const databaseCircuitBreaker = new AdaptiveCircuitBreaker({
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 30000,
  monitorWindow: 60000,
});

export const knowledgeBaseCircuitBreaker = new AdaptiveCircuitBreaker({
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000,
  monitorWindow: 120000,
});
```

## 6. 演练计划

### 6.1 演练类型

```typescript
// src/infra/dr/drill-scheduler.ts
interface DrillSchedule {
  name: string;
  type: 'table-top' | 'simulation' | 'full-dr';
  frequency: 'quarterly' | 'bi-annual' | 'annual';
  participants: string[];
  lastDrill?: number;
  nextDrill?: number;
}

const drillSchedule: DrillSchedule[] = [
  {
    name: '数据库故障转移演练',
    type: 'simulation',
    frequency: 'quarterly',
    participants: ['ops-team', 'dev-team'],
    nextDrill: Date.now() + 90 * 24 * 3600 * 1000,
  },
  {
    name: '区域故障切换演练',
    type: 'full-dr',
    frequency: 'bi-annual',
    participants: ['ops-team', 'dev-team', 'sre-team'],
    nextDrill: Date.now() + 180 * 24 * 3600 * 1000,
  },
  {
    name: '数据恢复演练',
    type: 'simulation',
    frequency: 'quarterly',
    participants: ['dev-team'],
    nextDrill: Date.now() + 60 * 24 * 3600 * 1000,
  },
  {
    name: '降级服务演练',
    type: 'table-top',
    frequency: 'annual',
    participants: ['dev-team', 'product-team'],
  },
];
```

### 6.2 演练执行脚本

```typescript
// src/infra/dr/drill-executor.ts
class DisasterRecoveryDrill {
  private isDrillMode = false;

  async executeDrill(drill: DrillSchedule): Promise<DrillResult> {
    console.log(`Starting DR drill: ${drill.name}`);
    this.isDrillMode = true;

    const result: DrillResult = {
      drillName: drill.name,
      startedAt: Date.now(),
      status: 'in_progress',
      steps: [],
    };

    try {
      switch (drill.name) {
        case '数据库故障转移演练':
          await this.simulateDatabaseFailover(result);
          break;
        case '区域故障切换演练':
          await this.simulateRegionFailover(result);
          break;
        case '数据恢复演练':
          await this.simulateDataRecovery(result);
          break;
      }

      result.status = 'completed';
    } catch (error) {
      result.status = 'failed';
      result.error = (error as Error).message;
    } finally {
      this.isDrillMode = false;
    }

    result.completedAt = Date.now();
    await this.recordDrillResult(result);

    return result;
  }

  private async simulateDatabaseFailover(result: DrillResult): Promise<void> {
    result.steps.push({ name: '模拟主库故障', status: 'completed', duration: 1000 });
    result.steps.push({ name: '验证从库提升', status: 'completed', duration: 5000 });
    result.steps.push({ name: '验证应用连接', status: 'completed', duration: 3000 });
    result.steps.push({ name: '回滚到正常状态', status: 'completed', duration: 5000 });
  }

  private async simulateRegionFailover(result: DrillResult): Promise<void> {
    result.steps.push({ name: '模拟区域故障', status: 'completed', duration: 2000 });
    result.steps.push({ name: 'DNS 切换', status: 'completed', duration: 10000 });
    result.steps.push({ name: '验证备份区域', status: 'completed', duration: 15000 });
    result.steps.push({ name: '回滚到主区域', status: 'completed', duration: 20000 });
  }

  private async simulateDataRecovery(result: DrillResult): Promise<void> {
    result.steps.push({ name: '模拟数据损坏', status: 'completed', duration: 1000 });
    result.steps.push({ name: '从备份恢复', status: 'completed', duration: 30000 });
    result.steps.push({ name: '验证数据完整性', status: 'completed', duration: 5000 });
    result.steps.push({ name: '恢复正常服务', status: 'completed', duration: 2000 });
  }

  private async recordDrillResult(result: DrillResult): Promise<void> {
    // 记录演练结果到数据库
    // 发送演练报告
    console.log(`Drill ${result.drillName} completed: ${result.status}`);
  }

  isDrillActive(): boolean {
    return this.isDrillMode;
  }
}

interface DrillResult {
  drillName: string;
  startedAt: number;
  completedAt?: number;
  status: 'in_progress' | 'completed' | 'failed';
  steps: Array<{ name: string; status: string; duration: number }>;
  error?: string;
}

export const drDrill = new DisasterRecoveryDrill();
```

## 7. 监控与告警

### 7.1 DR 相关指标

```typescript
// src/infra/monitoring/dr-metrics.ts
const disasterRecoveryMetrics = {
  // 备份指标
  backupSuccessRate: {
    type: 'gauge',
    description: '备份成功率',
    threshold: { warning: 0.95, critical: 0.9 },
  },
  backupAge: {
    type: 'gauge',
    description: '最新备份的年龄（小时）',
    threshold: { warning: 25, critical: 49 },
  },
  backupDuration: {
    type: 'histogram',
    description: '备份执行时间',
  },

  // 恢复指标
  lastRecoveryTime: {
    type: 'gauge',
    description: '最近一次恢复的时间戳',
  },
  recoveryDuration: {
    type: 'histogram',
    description: '恢复操作耗时',
  },

  // 高可用指标
  failoverCount: {
    type: 'counter',
    description: '故障转移次数',
    threshold: { warning: 2, critical: 5 },
  },
  databaseReplicationLag: {
    type: 'gauge',
    description: '主从复制延迟（秒）',
    threshold: { warning: 30, critical: 60 },
  },
  circuitBreakerState: {
    type: 'gauge',
    description: '熔断器状态 (0=closed, 1=half-open, 2=open)',
  },

  // RTO/RPO 指标
  actualRTO: {
    type: 'gauge',
    description: '实际恢复时间目标',
    threshold: { warning: 240, critical: 480 },  // 分钟
  },
  actualRPO: {
    type: 'gauge',
    description: '实际恢复点目标',
    threshold: { warning: 60, critical: 120 },  // 分钟
  },
};
```

### 7.2 DR 告警规则

```typescript
// src/infra/monitoring/dr-alerts.ts
const disasterRecoveryAlerts = [
  {
    name: 'backup_failed',
    condition: () => {
      const lastBackup = backupExecutor.getLatestSuccessfulBackup('full');
      return !lastBackup || Date.now() - (lastBackup.completedAt || 0) > 25 * 3600 * 1000;
    },
    severity: 'critical',
    message: 'Database backup has not completed in the last 25 hours',
  },
  {
    name: 'replication_lag_high',
    condition: () => {
      const lag = getDatabaseReplicationLag();
      return lag > 30;
    },
    severity: 'warning',
    message: 'Database replication lag exceeds 30 seconds',
  },
  {
    name: 'circuit_breaker_open',
    condition: () => {
      return llmCircuitBreaker.getState() === 'open' ||
             databaseCircuitBreaker.getState() === 'open';
    },
    severity: 'critical',
    message: 'Circuit breaker is in open state',
  },
  {
    name: 'failover_recent',
    condition: () => {
      const lastFailover = getLastFailoverTime();
      return Date.now() - lastFailover < 24 * 3600 * 1000;
    },
    severity: 'info',
    message: 'A failover occurred within the last 24 hours',
  },
];
```

---

**最后更新**: 2026-04-14
**版本**: v1.0
