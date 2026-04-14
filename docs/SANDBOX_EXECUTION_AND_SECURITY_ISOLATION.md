# 沙箱执行与安全隔离系统

## 概述

沙箱执行与安全隔离系统（Sandbox Execution & Security Isolation System）是 ProjectFactory 系统的安全核心，负责在隔离环境中安全地执行生成的代码、运行测试、验证功能。通过多层安全隔离机制，确保恶意代码、危险操作和资源滥用不会影响宿主系统和数据安全，同时提供足够的执行能力完成项目验证。

## 核心价值

- **安全隔离**：防止恶意代码影响宿主系统
- **资源控制**：限制 CPU、内存、网络等资源使用
- **行为审计**：记录代码执行行为，支持问题诊断
- **灵活执行**：支持多种执行环境和运行时
- **快速响应**：超时和异常自动终止机制

## 沙箱架构

### 分层隔离架构

```typescript
// 隔离级别
enum IsolationLevel {
  // 进程级隔离（最快，安全性较低）
  PROCESS = 'process',

  // 容器级隔离（Docker）
  CONTAINER = 'container',

  // 虚拟机级隔离（最安全，资源开销大）
  VM = 'vm',

  // 浏览器沙箱（Web 代码执行）
  BROWSER = 'browser',
}

// 沙箱配置
interface SandboxConfig {
  // 隔离级别
  isolationLevel: IsolationLevel;

  // 超时配置
  timeout: {
    execution: number;           // 执行超时（毫秒）
    idle: number;               // 空闲超时
    startup: number;            // 启动超时
  };

  // 资源限制
  resources: {
    cpuLimit?: number;          // CPU 限制（核心数）
    memoryLimit?: number;       // 内存限制（字节）
    diskLimit?: number;         // 磁盘限制（字节）
    networkEnabled: boolean;     // 是否启用网络
    internetAccess: boolean;    // 是否允许互联网访问
  };

  // 文件系统权限
  filesystem: {
    readablePaths: string[];    // 可读路径
    writablePaths: string[];     // 可写路径
    executablePaths: string[];   // 可执行路径
    tempDir?: string;           // 临时目录
  };

  // 环境变量
  environment: Record<string, string>;

  // 网络限制
  network: {
    allowedPorts?: number[];    // 允许访问的端口
    blockedHosts?: string[];   // 禁止访问的主机
    bandwidthLimit?: number;    // 带宽限制（字节/秒）
  };
}

// 默认沙箱配置
const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  isolationLevel: IsolationLevel.CONTAINER,

  timeout: {
    execution: 60000,            // 1 分钟
    idle: 300000,               // 5 分钟
    startup: 10000,              // 10 秒
  },

  resources: {
    cpuLimit: 2,
    memoryLimit: 512 * 1024 * 1024,  // 512MB
    diskLimit: 100 * 1024 * 1024,    // 100MB
    networkEnabled: true,
    internetAccess: false,
  },

  filesystem: {
    readablePaths: ['/app'],
    writablePaths: ['/tmp', '/app/output'],
    executablePaths: ['/usr/bin', '/usr/local/bin'],
    tempDir: '/tmp/sandbox',
  },

  environment: {
    NODE_ENV: 'sandbox',
    PATH: '/usr/bin:/usr/local/bin',
  },

  network: {
    allowedPorts: [80, 443],
    blockedHosts: ['169.254.169.254'],  // 阻止元数据服务
  },
};
```

### 沙箱提供器

```typescript
// 沙箱提供器接口
interface SandboxProvider {
  // 创建沙箱
  create(config: SandboxConfig): Promise<Sandbox>;

  // 获取沙箱状态
  getStatus(sandboxId: string): Promise<SandboxStatus>;

  // 销毁沙箱
  destroy(sandboxId: string): Promise<void>;
}

// Docker 容器沙箱
class DockerSandboxProvider implements SandboxProvider {
  private docker: Dockerode;
  private config: DockerSandboxConfig;

  async create(config: SandboxConfig): Promise<Sandbox> {
    // 1. 拉取基础镜像
    const image = await this.pullImage(config.image || 'node:20-alpine');

    // 2. 创建容器
    const container = await this.docker.createContainer({
      Image: image.id,
      Cmd: ['sleep', 'infinity'],  // 保持容器运行
      HostConfig: {
        // 资源限制
        Memory: config.resources.memoryLimit,
        NanoCpus: config.resources.cpuLimit * 1e9,
        DiskQuota: config.resources.diskLimit,

        // 网络配置
        NetworkMode: config.resources.networkEnabled ? 'sandbox-net' : 'none',

        // 安全配置
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges'],
        ReadonlyRootfs: false,

        // 卷挂载
        Binds: [
          \`\${config.filesystem.tempDir}:/tmp:rw\`,
        ],
      },
      Env: Object.entries(config.environment).map(
        ([k, v]) => \`\${k}=\${v}\`
      ),
    });

    // 3. 启动容器
    await container.start();

    // 4. 创建沙箱实例
    return new DockerSandbox(container.id, this.docker);
  }

  async destroy(sandboxId: string): Promise<void> {
    const container = this.docker.getContainer(sandboxId);
    await container.stop({ t: 5 });  // 5秒优雅停止
    await container.remove({ force: true });
  }
}

// 进程级沙箱（使用 native 相关）
class ProcessSandboxProvider implements SandboxProvider {
  private runningProcesses: Map<string, ChildProcess>;

  async create(config: SandboxConfig): Promise<Sandbox> {
    // 使用 worker_threads + vm 提供进程级隔离
    const sandbox = new VMSandbox(config);
    return sandbox;
  }
}
```

## 代码执行器

### 执行器接口

```typescript
// 执行请求
interface ExecutionRequest {
  code: string | string[];     // 代码或文件列表
  language: ProgrammingLanguage;
  entryPoint?: string;         // 入口文件

  // 执行选项
  options: {
    timeout?: number;
    workingDirectory?: string;
    environment?: Record<string, string>;
    stdin?: string;
  };

  // 沙箱配置覆盖
  sandboxOverride?: Partial<SandboxConfig>;
}

// 执行结果
interface ExecutionResult {
  // 执行状态
  status: ExecutionStatus;

  // 输出
  stdout: string;
  stderr: string;

  // 资源使用
  resources: {
    cpuTime: number;           // CPU 时间（毫秒）
    memoryPeak: number;        // 内存峰值（字节）
    networkBytes?: number;     // 网络流量
  };

  // 性能指标
  metrics?: {
    executionTime: number;
    linesOfCode?: number;
    coverage?: CoverageReport;
  };

  // 错误信息
  error?: {
    type: ExecutionErrorType;
    message: string;
    stack?: string;
    location?: { line: number; column: number };
  };

  // 元数据
  metadata: {
    sandboxId: string;
    startedAt: Date;
    completedAt: Date;
  };
}

type ExecutionStatus =
  | 'success'
  | 'timeout'
  | 'out_of_memory'
  | 'out_of_resources'
  | 'security_violation'
  | 'runtime_error'
  | 'compilation_error'
  | 'cancelled';

type ExecutionErrorType =
  | 'SyntaxError'
  | 'ReferenceError'
  | 'TypeError'
  | 'RangeError'
  | 'SecurityError'
  | 'ResourceError';
```

### 执行管理器

```typescript
// 代码执行管理器
class CodeExecutionManager {
  private sandboxProvider: SandboxProvider;
  private queue: ExecutionQueue;
  private resourceMonitor: ResourceMonitor;

  // 执行代码
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    // 1. 验证请求
    await this.validateRequest(request);

    // 2. 获取或创建沙箱
    const sandbox = await this.acquireSandbox(request);

    // 3. 排队等待执行
    const jobId = await this.queue.enqueue({
      sandboxId: sandbox.id,
      request,
      priority: request.priority || 5,
    });

    try {
      // 4. 执行代码
      const result = await sandbox.run(request);

      // 5. 记录资源使用
      await this.resourceMonitor.record(result.sandboxId, result.resources);

      // 6. 返回结果
      return result;
    } catch (error) {
      // 处理执行错误
      return this.handleExecutionError(error, request);
    } finally {
      // 7. 释放沙箱（根据空闲情况决定是否销毁）
      await this.releaseSandbox(sandbox, request);
    }
  }

  // 获取沙箱
  private async acquireSandbox(request: ExecutionRequest): Promise<Sandbox> {
    // 1. 查找空闲沙箱
    const idle = await this.sandboxProvider.findIdle({
      language: request.language,
      config: request.sandboxOverride,
    });

    if (idle) {
      return idle;
    }

    // 2. 检查沙箱数量限制
    const currentCount = await this.sandboxProvider.getActiveCount();
    const maxCount = this.config.maxSandboxes;

    if (currentCount >= maxCount) {
      // 等待空闲沙箱
      return this.waitForSandbox(maxCount);
    }

    // 3. 创建新沙箱
    const config = this.mergeConfig(request.sandboxOverride);
    return this.sandboxProvider.create(config);
  }
}

// 沙箱包装器
class Sandbox {
  constructor(
    private containerId: string,
    private docker: Dockerode
  ) {}

  async run(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();

    // 1. 上传代码到沙箱
    await this.uploadCode(request);

    // 2. 执行代码
    const exec = await this.docker.getContainer(this.containerId).exec({
      Cmd: this.buildCommand(request),
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      Env: Object.entries(request.options.environment || {}).map(
        ([k, v]) => \`\${k}=\${v}\`
      ),
    });

    const stream = await exec.start({ hijack: true, stdin: false });

    // 3. 收集输出
    const { stdout, stderr } = await this.collectOutput(stream, request.options.timeout);

    // 4. 获取退出码
    const inspect = await exec.inspect();
    const exitCode = inspect.ExitCode;

    return {
      status: this.determineStatus(exitCode),
      stdout,
      stderr,
      resources: await this.getResourceUsage(),
      metadata: {
        sandboxId: this.containerId,
        startedAt: new Date(startTime),
        completedAt: new Date(),
      },
    };
  }

  private buildCommand(request: ExecutionRequest): string[] {
    switch (request.language) {
      case 'typescript':
      case 'javascript':
        return ['node', request.entryPoint || 'index.js'];

      case 'python':
        return ['python', request.entryPoint || 'main.py'];

      case 'go':
        return ['go', 'run', request.entryPoint || 'main.go'];

      default:
        throw new Error(\`Unsupported language: \${request.language}\`);
    }
  }
}
```

## 安全策略

### 安全规则引擎

```typescript
// 安全规则
interface SecurityRule {
  id: string;
  name: string;
  description: string;

  // 检测器
  detector: SecurityDetector;

  // 动作
  action: SecurityAction;

  // 严重程度
  severity: 'low' | 'medium' | 'high' | 'critical';

  enabled: boolean;
}

type SecurityDetector = (
  code: string,
  context: ExecutionContext
) => Promise<SecurityViolation | null>;

type SecurityAction =
  | 'block'           // 直接阻止执行
  | 'warn'            // 警告但允许执行
  | 'quarantine';     // 隔离并标记

// 内置安全规则
const SECURITY_RULES: SecurityRule[] = [
  {
    id: 'sec-001',
    name: '禁止系统命令执行',
    description: '检测并阻止执行系统命令的尝试',
    detector: async (code) => {
      const patterns = [
        /child_process|exec|spawn|eval/,
        /__import__|subprocess|os\.system/,
        /Runtime\.getRuntime\(\)/,
      ];

      for (const pattern of patterns) {
        if (pattern.test(code)) {
          return {
            type: 'command_injection',
            message: '检测到潜在的系统命令执行',
            matches: code.match(pattern),
          };
        }
      }
      return null;
    },
    action: 'block',
    severity: 'critical',
    enabled: true,
  },

  {
    id: 'sec-002',
    name: '禁止网络访问',
    description: '阻止非必要的网络访问',
    detector: async (code, context) => {
      if (!context.sandboxConfig.resources.networkEnabled) {
        return null;  // 网络已禁用
      }

      const networkPatterns = [
        /fetch\(|XMLHttpRequest|axios/,
        /requests\.|urllib\.|http\.client/,
        /net\.Socket|http\.Request/,
      ];

      for (const pattern of networkPatterns) {
        if (pattern.test(code)) {
          return {
            type: 'network_access',
            message: '检测到网络访问尝试',
            matches: code.match(pattern),
          };
        }
      }
      return null;
    },
    action: context => context.allowNetworkBypass ? 'warn' : 'block',
    severity: 'high',
    enabled: true,
  },

  {
    id: 'sec-003',
    name: '禁止文件系统越权访问',
    description: '阻止访问沙箱外的文件系统',
    detector: async (code) => {
      const forbiddenPaths = [
        /\.\.\//g,                    // 路径遍历
        /\/etc\/passwd/,
        /\/root\//,
        /~\/.ssh/,
        /C:\\Windows/,
      ];

      for (const pattern of forbiddenPaths) {
        if (pattern.test(code)) {
          return {
            type: 'filesystem_violation',
            message: '检测到越权文件系统访问',
            matches: code.match(pattern),
          };
        }
      }
      return null;
    },
    action: 'block',
    severity: 'critical',
    enabled: true,
  },

  {
    id: 'sec-004',
    name: '禁止无限循环检测',
    description: '检测可能导致无限循环的代码模式',
    detector: async (code) => {
      // 使用静态分析检测潜在的无限循环
      const infiniteLoopPatterns = [
        /while\s*\(\s*true\s*\)/,
        /for\s*\(\s*;\s*;\s*\)/,
        /while\s*\(\s*1\s*\)/,
      ];

      for (const pattern of infiniteLoopPatterns) {
        const match = code.match(pattern);
        if (match) {
          // 检查循环体内是否有 break
          const loopBody = this.extractLoopBody(code, match.index);
          if (!/break|return|throw/.test(loopBody)) {
            return {
              type: 'infinite_loop',
              message: '检测到可能的无限循环',
              matches: match,
            };
          }
        }
      }
      return null;
    },
    action: 'quarantine',
    severity: 'medium',
    enabled: true,
  },

  {
    id: 'sec-005',
    name: '内存耗尽检测',
    description: '防止创建过大的数据结构导致内存耗尽',
    detector: async (code) => {
      const memoryExhaustionPatterns = [
        /new\s+Array\(\s*\d{7,}\s*\)/,  // 巨大的数组
        /while\s*\(\s*true\s*\)\s*\{[^}]*push/,
      ];

      for (const pattern of memoryExhaustionPatterns) {
        if (pattern.test(code)) {
          return {
            type: 'memory_exhaustion',
            message: '检测到可能导致内存耗尽的代码',
            matches: code.match(pattern),
          };
        }
      }
      return null;
    },
    action: 'block',
    severity: 'high',
    enabled: true,
  },
];
```

### 安全策略执行器

```typescript
// 安全策略执行器
class SecurityPolicyEnforcer {
  private rules: SecurityRule[];
  private auditLog: AuditLog;

  // 执行安全检查
  async enforce(
    code: string,
    context: ExecutionContext
  ): Promise<SecurityEnforcementResult> {
    const violations: SecurityViolation[] = [];
    const warnings: string[] = [];

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      const violation = await rule.detector(code, context);
      if (violation) {
        violations.push(violation);

        // 确定动作
        let action = rule.action;
        if (typeof action === 'function') {
          action = action(context);
        }

        // 记录审计日志
        await this.auditLog.record({
          ruleId: rule.id,
          ruleName: rule.name,
          violation,
          action,
          context,
        });

        // 根据严重程度处理
        if (action === 'block' || rule.severity === 'critical') {
          return {
            allowed: false,
            violations,
            blockedBy: rule.id,
          };
        }
      }
    }

    return {
      allowed: true,
      violations,
      warnings: violations.map(v => v.message),
    };
  }
}
```

## 资源监控

### 资源使用监控

```typescript
// 资源监控器
class ResourceMonitor {
  private metricsCollector: MetricsCollector;

  // 记录资源使用
  async record(sandboxId: string, resources: ResourceUsage): Promise<void> {
    await this.metricsCollector.record({
      metric: 'sandbox.resources',
      tags: { sandbox_id: sandboxId },
      fields: {
        cpu_time_ms: resources.cpuTime,
        memory_peak_bytes: resources.memoryPeak,
        network_bytes: resources.networkBytes || 0,
      },
      timestamp: new Date(),
    });
  }

  // 获取实时资源使用
  async getCurrentUsage(sandboxId: string): Promise<ResourceUsage> {
    const container = this.docker.getContainer(sandboxId);
    const stats = await container.stats({ stream: false });

    return {
      cpuTime: stats.cpu_stats.cpu_usage.total_usage,
      memoryPeak: stats.memory_stats.max_usage || stats.memory_stats.usage,
      networkBytes: this.sumNetworkBytes(stats.networks),
    };
  }

  // 检查资源限制
  async checkLimits(
    sandboxId: string,
    limits: ResourceLimits
  ): Promise<boolean> {
    const current = await this.getCurrentUsage(sandboxId);

    if (limits.memoryLimit && current.memoryPeak > limits.memoryLimit) {
      return false;
    }

    if (limits.cpuLimit && current.cpuTime > limits.cpuLimit * 1000) {
      return false;
    }

    return true;
  }
}
```

## 沙箱管理界面

### 沙箱状态面板

```typescript
// 沙箱管理界面
const SandboxDashboard: React.FC = () => {
  const [sandboxes, setSandboxes] = useState<SandboxStatus[]>([]);
  const [stats, setStats] = useState<SandboxStats>({});

  useEffect(() => {
    const ws = new WebSocket('/api/sandbox/status');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setSandboxes(data.sandboxes);
      setStats(data.stats);
    };

    return () => ws.close();
  }, []);

  return (
    <div className="sandbox-dashboard">
      <h2>沙箱执行状态</h2>

      {/* 统计概览 */}
      <div className="stats-overview">
        <StatCard
          title="活跃沙箱"
          value={stats.active}
          icon={<ActiveIcon />}
        />
        <StatCard
          title="总执行次数"
          value={stats.totalExecutions}
          icon={<ExecutionIcon />}
        />
        <StatCard
          title="平均执行时间"
          value={\`\${stats.avgExecutionTime}ms\`}
          icon={<TimeIcon />}
        />
        <StatCard
          title="安全阻止"
          value={stats.blocked}
          icon={<SecurityIcon />}
          color={stats.blocked > 0 ? 'red' : 'green'}
        />
      </div>

      {/* 沙箱列表 */}
      <div className="sandbox-list">
        {sandboxes.map(sandbox => (
          <SandboxCard key={sandbox.id} sandbox={sandbox} />
        ))}
      </div>
    </div>
  );
};

// 沙箱卡片
const SandboxCard: React.FC<{ sandbox: SandboxStatus }> = ({ sandbox }) => {
  const statusColor = {
    idle: 'green',
    running: 'blue',
    paused: 'yellow',
    error: 'red',
  }[sandbox.status];

  return (
    <div className={\`sandbox-card sandbox-\${sandbox.status}\`}>
      <div className="sandbox-header">
        <span className="sandbox-id">\${sandbox.id.slice(0, 8)}</span>
        <Badge color={statusColor}>{sandbox.status}</Badge>
      </div>

      <div className="sandbox-info">
        <div>语言: {sandbox.language}</div>
        <div>运行时间: {formatDuration(sandbox.uptime)}</div>
        <div>内存: {formatBytes(sandbox.memoryUsage)}</div>
      </div>

      <div className="sandbox-actions">
        <button onClick={() => pauseSandbox(sandbox.id)}>暂停</button>
        <button onClick={() => terminateSandbox(sandbox.id)}>终止</button>
        <button onClick={() => inspectSandbox(sandbox.id)}>详情</button>
      </div>
    </div>
  );
};
```

## 配置示例

```yaml
# 沙箱执行配置
sandbox:
  # 默认隔离级别
  default_isolation: "container"  # process | container | vm | browser

  # 容器配置
  container:
    image: "node:20-alpine"
    max_instances: 50
    idle_timeout_minutes: 10

  # 资源限制
  resources:
    default:
      cpu_limit: 2
      memory_limit: "512MB"
      disk_limit: "100MB"
      timeout_seconds: 60

    testing:
      cpu_limit: 4
      memory_limit: "2GB"
      disk_limit: "500MB"
      timeout_seconds: 300

    build:
      cpu_limit: 8
      memory_limit: "8GB"
      disk_limit: "2GB"
      timeout_seconds: 600

  # 网络配置
  network:
    enabled: true
    allow_internet: false
    allowed_ports: [80, 443]
    blocked_hosts:
      - "169.254.169.254"  # 云元数据服务
      - "metadata.google.internal"

  # 安全规则
  security:
    enabled: true
    block_on_first_violation: true
    rules:
      - id: "command_injection"
        severity: "critical"
        action: "block"
      - id: "filesystem_violation"
        severity: "critical"
        action: "block"
      - id: "infinite_loop"
        severity: "medium"
        action: "quarantine"

  # 监控
  monitoring:
    enabled: true
    collect_metrics: true
    log_execution: true
    audit_retention_days: 90
```

---

**最后更新**: 2026-04-14
