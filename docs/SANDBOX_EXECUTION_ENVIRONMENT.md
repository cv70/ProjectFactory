# 沙箱执行环境设计

## 概述

沙箱执行环境是无限生成系统的安全执行层，用于在隔离环境中运行、测试和验证AI生成的代码。没有沙箱，生成系统将无法安全地执行未验证的代码，存在严重的安全风险。本系统提供多层隔离、资源限制和完整监控能力。

## 核心价值

```
安全执行 = 隔离 × 限制 × 监控 × 快速恢复

沙箱环境的核心价值：
1. 防止恶意代码损害宿主系统
2. 限制资源使用防止DoS攻击
3. 提供完整执行日志用于调试
4. 快速创建/销毁支持高频测试
5. 模拟真实环境保证测试有效性
```

## 隔离级别

### 隔离级别分类

```typescript
// 隔离级别枚举
enum IsolationLevel {
  // 进程级隔离 - 同一容器内进程隔离
  PROCESS = 'process',

  // 容器级隔离 - Docker容器
  CONTAINER = 'container',

  // VM级隔离 - 完整虚拟机
  VM = 'vm',

  // 远程沙箱 - 远程专用沙箱服务
  REMOTE = 'remote',

  // 混合模式 - 根据风险级别选择
  HYBRID = 'hybrid'
}

// 隔离级别对比
const isolationComparison = {
  PROCESS: {
    overhead: '< 5ms',
    isolation: '低',
    security: '有限',
    cost: '最低',
   适用场景: '可信代码、快速验证'
  },
  CONTAINER: {
    overhead: '100-500ms',
    isolation: '中',
    security: '良好',
    cost: '低',
    适用场景: '一般代码、外部依赖'
  },
  VM: {
    overhead: '5-30s',
    isolation: '高',
    security: '最强',
    cost: '高',
    适用场景: '高风险代码、系统级测试'
  },
  REMOTE: {
    overhead: '50-200ms',
    isolation: '高',
    security: '最强',
    cost: '中等',
    适用场景: '第三方代码、跨语言测试'
  }
};
```

### 分层隔离架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           外部请求入口                                    │
│                    (代码执行请求、测试请求)                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          风险评估层                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │ 代码分析    │  │ 来源验证    │  │ 历史信誉    │  │ 依赖扫描    │   │
│  │ (静态分析)  │  │ (签名/来源) │  │ (之前执行)  │  │ (第三方库)  │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                    │                                     │
│                              风险评分 ────► 隔离级别选择                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   PROCESS级      │    │   CONTAINER级    │    │     VM级         │
│   沙箱           │    │   沙箱           │    │     沙箱         │
│  ┌────────────┐  │    │  ┌────────────┐  │    │  ┌────────────┐  │
│  │  进程池    │  │    │  │  Docker    │  │    │  │  MicroVM   │  │
│  │  资源限制  │  │    │  │  容器      │  │    │  │  完整OS    │  │
│  │  seccomp   │  │    │  │  cgroups   │  │    │  │  独立内核  │  │
│  └────────────┘  │    │  └────────────┘  │    │  └────────────┘  │
└──────────────────┘    └──────────────────┘    └──────────────────┘
          │                         │                         │
          └─────────────────────────┼─────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          执行监控层                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │ 系统调用    │  │ 资源使用    │  │ 网络流量    │  │ 文件系统    │   │
│  │ 追踪        │  │ 监控        │  │ 监控        │  │ 监控        │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          结果收集层                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │ 执行输出    │  │ 覆盖率      │  │ 性能指标    │  │ 安全报告    │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## 沙箱类型

### 1. 进程级沙箱

```typescript
// 进程沙箱配置
interface ProcessSandboxConfig {
  name: string;
  timeout: number;                  // 超时时间 (ms)
  maxMemory: number;               // 最大内存 (bytes)
  maxCpuTime: number;              // 最大CPU时间 (ms)

  // 权限限制
  permissions: {
    // 文件系统权限
    fs: {
      readPaths: string[];         // 允许读取的路径
      writePaths: string[];        // 允许写入的路径
      createTemp: boolean;          // 是否允许创建临时文件
    };

    // 网络权限
    network: {
      allowed: boolean;             // 是否允许网络访问
      allowedHosts?: string[];     // 允许访问的Host
      allowedPorts?: number[];     // 允许访问的端口
    };

    // 系统调用限制
    syscalls: {
      allowed: string[];            // 允许的系统调用
      denied: string[];             // 禁止的系统调用
      useSeccomp: boolean;          // 启用seccomp
    };
  };

  // 环境变量
  env: Record<string, string>;

  // 工作目录
  cwd: string;
}

// 进程沙箱实现
class ProcessSandbox {
  constructor(private config: ProcessSandboxConfig) {}

  async execute(code: string, language: string): Promise<ExecutionResult> {
    // 1. 创建工作目录
    const workDir = await this.createWorkDir();

    // 2. 写入代码文件
    await this.writeCode(workDir, code, language);

    // 3. 设置资源限制
    const limits = this.computeLimits();

    // 4. 创建进程
    const process = await this.spawnProcess(workDir, language, limits);

    // 5. 监控执行
    const result = await this.monitorExecution(process);

    // 6. 清理
    await this.cleanup(workDir);

    return result;
  }

  private computeLimits(): RLimits {
    return {
      maxMemory: this.config.maxMemory,
      maxCpuTime: this.config.maxCpuTime,
      maxProcesses: 10,
      maxOpenFiles: 100,
      maxFileSize: 10 * 1024 * 1024
    };
  }
}
```

### 2. 容器级沙箱

```typescript
// 容器沙箱配置
interface ContainerSandboxConfig {
  // 基础镜像
  image: string;

  // 资源限制
  resources: {
    cpu: {
      limit: number;                // CPU限制 (核心数)
      request: number;
    };
    memory: {
      limit: string;                // 内存限制 (如: '512MB')
      request: string;
    };
    disk: {
      limit: string;               // 磁盘限制
      EphemeralStorage?: string;   // 临时存储
    };
  };

  // 网络配置
  network: {
    enabled: boolean;
    mode: 'bridge' | 'host' | 'none';
    dns?: string[];
  };

  // 安全配置
  security: {
    readOnlyRootFilesystem: boolean;
    allowPrivilegeEscalation: boolean;
    runAsNonRoot: boolean;
    seccompProfile: string;
    capabilities: {
      add: string[];
      drop: string[];
    };
  };

  // 初始化脚本
  initScript?: string;

  // 准备脚本 (依赖安装等)
  setupScript?: string;
}

// 容器沙箱管理器
class ContainerSandboxManager {
  constructor(
    private docker: Docker,
    private config: ContainerSandboxConfig
  ) {}

  async create(): Promise<ContainerHandle> {
    // 1. 拉取镜像
    await this.pullImage();

    // 2. 创建容器
    const container = await this.docker.createContainer({
      Image: this.config.image,
      HostConfig: {
        Memory: this.parseMemory(this.config.resources.memory.limit),
        NanoCpus: this.config.resources.cpu.limit * 1e9,
        DiskQuota: this.parseDisk(this.config.resources.disk.limit),
        NetworkMode: this.config.network.mode,
        SecurityOpt: [`seccomp:${this.config.security.seccompProfile}`],
        ReadonlyRootfs: this.config.security.readOnlyRootFilesystem,
        CapDrop: this.config.security.capabilities.drop,
      },
      Entrypoint: ['/bin/sh', '-c'],
      Cmd: ['sleep', 'infinity']  // 保持容器运行
    });

    // 3. 等待容器就绪
    await this.waitForReady(container);

    // 4. 运行初始化脚本
    if (this.config.initScript) {
      await this.runScript(container, this.config.initScript);
    }

    return new ContainerHandle(container);
  }

  async execute(
    container: ContainerHandle,
    code: string,
    language: string
  ): Promise<ExecutionResult> {
    // 1. 写入代码
    await container.putFile(`/code.${this.getExtension(language)}`, code);

    // 2. 执行代码
    const result = await container.exec([
      this.getRunner(language),
      `/code.${this.getExtension(language)}`
    ], {
      timeout: 30000,
      env: this.config.env
    });

    // 3. 返回结果
    return result;
  }
}

// 预定义容器配置
const predefinedSandboxImages = {
  'node-18': {
    image: 'sandbox-node:18-alpine',
    description: 'Node.js 18 环境',
    suitable: ['javascript', 'typescript']
  },
  'python-3.11': {
    image: 'sandbox-python:3.11-slim',
    description: 'Python 3.11 环境',
    suitable: ['python']
  },
  'java-17': {
    image: 'sandbox-java:17-slim',
    description: 'Java 17 环境',
    suitable: ['java', 'kotlin']
  },
  'go-1.21': {
    image: 'sandbox-go:1.21-alpine',
    description: 'Go 1.21 环境',
    suitable: ['go']
  },
  'rust-1.72': {
    image: 'sandbox-rust:1.72-slim',
    description: 'Rust 1.72 环境',
    suitable: ['rust']
  },
  'dotnet-8': {
    image: 'sandbox-dotnet:8.0-alpine',
    description: '.NET 8 环境',
    suitable: ['csharp', 'fsharp']
  }
};
```

### 3. VM级沙箱

```typescript
// MicroVM配置
interface MicroVMSandboxConfig {
  // VM规格
  vcpu: number;                     // 虚拟CPU数量
  memory: string;                  // 内存大小
  disk: string;                    // 磁盘大小

  // 启动镜像
  kernel: string;                  // 内核镜像
  initrd: string;                  // 初始ramdisk

  // 配置
  config: {
    hostname: string;
    rootPassword?: string;          // 可选，使用密钥更好
    sshKeys?: string[];
    cloudInit?: string;            // cloud-init配置
  };

  // 网络
  network: {
    internetAccess: boolean;
    staticIP?: string;
    macAddress?: string;
  };

  // 超时
  bootTimeout: number;             // 启动超时
  executionTimeout: number;        // 执行超时
}

// MicroVM沙箱 (使用firecracker)
class MicroVMSandbox {
  private vmPool: VM.pool;
  private activeVMs: Map<string, VM>;

  constructor(private config: MicroVMSandboxConfig) {
    this.vmPool = new VM.Pool({
      minSize: 2,
      maxSize: 10,
      createVM: () => this.createVM(),
      destroyVM: (vm) => this.destroyVM(vm)
    });
  }

  private async createVM(): Promise<VM> {
    const vm = await Firecracker.create({
      vcpu: this.config.vcpu,
      memory: this.config.memory,
      kernel: this.config.kernel,
      initrd: this.config.initrd
    });

    await vm.start();
    await this.waitForBoot(vm);

    return vm;
  }

  async execute(code: string, language: string): Promise<ExecutionResult> {
    // 1. 获取或创建VM
    const vm = await this.vmPool.acquire();

    try {
      // 2. 写入代码
      await vm.writeFile(`/root/code.${this.getExtension(language)}`, code);

      // 3. 执行代码
      const result = await vm.exec({
        cmd: this.getRunner(language),
        args: [`/root/code.${this.getExtension(language)}`],
        timeout: this.config.executionTimeout
      });

      return result;
    } finally {
      // 4. 归还VM到池
      await this.vmPool.release(vm);

      // 5. 如果VM需要重置则销毁
      if (vm.needsReset) {
        await this.vmPool.destroy(vm);
      }
    }
  }
}
```

### 4. 远程沙箱服务

```typescript
// 远程沙箱配置
interface RemoteSandboxConfig {
  endpoint: string;                // 沙箱服务端点
  apiKey: string;                  // API密钥
  region?: string;                 // 区域选择

  // 请求配置
  request: {
    timeout: number;               // 请求超时
    retries: number;               // 重试次数
  };

  // 备用方案
  fallback?: RemoteSandboxConfig; // 备用服务
}

// 远程沙箱客户端
class RemoteSandboxClient {
  constructor(private config: RemoteSandboxConfig) {}

  async execute(request: RemoteExecutionRequest): Promise<ExecutionResult> {
    const client = this.createHttpClient();

    try {
      const response = await client.post(`${this.config.endpoint}/execute`, {
        code: request.code,
        language: request.language,
        stdin: request.stdin,
        files: request.files,
        environment: request.environment,
        resources: request.resources
      }, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Request-ID': request.id
        },
        timeout: this.config.request.timeout
      });

      return this.parseResponse(response);
    } catch (error) {
      // 尝试备用服务
      if (this.config.fallback) {
        const fallbackClient = new RemoteSandboxClient(this.config.fallback);
        return fallbackClient.execute(request);
      }
      throw error;
    }
  }
}

// 远程执行请求
interface RemoteExecutionRequest {
  id: string;
  code: string;
  language: string;
  stdin?: string;
  files?: Record<string, string>;  // 额外文件
  environment?: Record<string, string>;
  resources?: {
    timeoutMs?: number;
    memoryMb?: number;
  };
}
```

## 风险评估

### 风险评分系统

```typescript
// 风险评估器
class RiskAssessor {
  constructor(
    private codeAnalyzer: StaticAnalyzer,
    private dependencyScanner: DependencyScanner,
    private reputationStore: ReputationStore
  ) {}

  async assess(code: string, context: ExecutionContext): Promise<RiskAssessment> {
    // 1. 静态代码分析
    const staticAnalysis = await this.codeAnalyzer.analyze(code);

    // 2. 依赖分析
    const dependencyAnalysis = await this.dependencyScanner.scan(
      context.dependencies || []
    );

    // 3. 历史信誉
    const reputation = await this.reputationStore.getReputation(
      context.origin || 'unknown'
    );

    // 4. 综合评分
    const score = this.calculateScore(
      staticAnalysis,
      dependencyAnalysis,
      reputation
    );

    // 5. 确定隔离级别
    const isolationLevel = this.determineIsolationLevel(score);

    // 6. 生成建议
    const recommendations = this.generateRecommendations(
      score,
      staticAnalysis,
      dependencyAnalysis
    );

    return {
      score,
      level: isolationLevel,
      factors: {
        staticAnalysis,
        dependencyAnalysis,
        reputation
      },
      recommendations,
      approved: score < 80  // 得分>=80需要更高隔离
    };
  }

  private calculateScore(
    staticAnalysis: StaticAnalysisResult,
    dependencyAnalysis: DependencyAnalysisResult,
    reputation: Reputation
  ): number {
    // 权重配置
    const weights = {
      static: 0.4,
      dependency: 0.35,
      reputation: 0.25
    };

    // 静态分析得分 (0-100, 越低越危险)
    const staticScore = 100 - (staticAnalysis.riskScore * 100);

    // 依赖分析得分
    const depScore = 100 - (
      dependencyAnalysis.vulnerabilityCount * 20 +
      dependencyAnalysis.unknownCount * 10
    );

    // 信誉得分 (0-100)
    const repScore = reputation.score;

    return Math.round(
      staticScore * weights.static +
      depScore * weights.dependency +
      repScore * weights.reputation
    );
  }

  private determineIsolationLevel(score: number): IsolationLevel {
    if (score >= 90) return 'PROCESS';
    if (score >= 70) return 'CONTAINER';
    if (score >= 50) return 'REMOTE';
    return 'VM';
  }
}

// 风险评估结果
interface RiskAssessment {
  score: number;                    // 0-100风险评分
  level: IsolationLevel;           // 推荐隔离级别
  factors: {
    staticAnalysis: StaticAnalysisResult;
    dependencyAnalysis: DependencyAnalysisResult;
    reputation: Reputation;
  };
  recommendations: string[];
  approved: boolean;
}
```

### 危险模式检测

```typescript
// 危险模式检测规则
const dangerousPatterns = [
  {
    name: '文件系统遍历',
    pattern: /\.\.\/|\.\.\\\/|path\.join.*\.\./,
    severity: 'high',
    description: '检测路径遍历攻击'
  },
  {
    name: '命令注入',
    pattern: /exec\(|spawn\(|eval\(|execSync\(/,
    severity: 'critical',
    description: '检测命令注入风险'
  },
  {
    name: '网络连接',
    pattern: /http\.request|socket\.connect|net\.connect/,
    severity: 'medium',
    description: '检测网络连接请求'
  },
  {
    name: '环境变量访问',
    pattern: /process\.env\.|os\.environ/,
    severity: 'low',
    description: '检测环境变量访问'
  },
  {
    name: '敏感API',
    pattern: /crypto\.|tls\.|ssl\./,
    severity: 'medium',
    description: '检测加密API使用'
  },
  {
    name: '_child_process',
    pattern: /child_process|spawn|execFile/,
    severity: 'high',
    description: '检测子进程创建'
  },
  {
    name: '动态代码生成',
    pattern: /new Function|eval\(|setTimeout.*string|setInterval.*string/,
    severity: 'high',
    description: '检测动态代码执行'
  },
  {
    name: '文件操作',
    pattern: /fs\.write|fs\.read|open\(|readFile|writeFile/,
    severity: 'medium',
    description: '检测文件系统操作'
  }
];

// 恶意软件特征
const malwareSignatures = [
  {
    name: '加密通信',
    pattern: /base64.*decode|fromCharCode.*charCodeAt/,
    severity: 'high'
  },
  {
    name: '自我复制',
    pattern: /fs\.copyFile.*__filename|readFile.*writeFile.*__filename/,
    severity: 'critical'
  },
  {
    name: '持久化',
    pattern: /crontab|schtasks|launchctl|systemd/,
    severity: 'high'
  },
  {
    name: '权限提升',
    pattern: /sudo|chmod.*777|setuid|sudoers/,
    severity: 'critical'
  }
];
```

## 资源限制

### 资源配额配置

```typescript
// 资源配额
interface ResourceQuota {
  // 时间限制
  time: {
    execution: number;              // 执行时间上限 (ms)
    idle: number;                   // 空闲超时 (ms)
    absolute: number;               // 绝对最大时间 (ms)
  };

  // 内存限制
  memory: {
    max: number;                   // 最大内存 (bytes)
    warningThreshold: number;      // 警告阈值
  };

  // CPU限制
  cpu: {
    maxPercent: number;             // 最大CPU百分比
    maxCores: number;               // 最大核心数
  };

  // 存储限制
  storage: {
    maxTempSize: number;           // 临时存储最大
    maxOutputSize: number;         // 输出最大大小
    maxFileCount: number;          // 最大文件数
  };

  // 网络限制
  network: {
    maxConnections: number;        // 最大连接数
    maxBandwidth: number;          // 最大带宽 (bytes/s)
    maxDNSQueries: number;          // 最大DNS查询
  };

  // 进程限制
  process: {
    maxCount: number;              // 最大进程数
    maxThreads: number;            // 最大线程数
    maxFileDescriptors: number;   // 最大文件描述符
  };
}

// 预定义配额
const predefinedQuotas: Record<string, ResourceQuota> = {
  // 快速测试 - 5秒超时，256MB内存
  quick: {
    time: { execution: 5000, idle: 1000, absolute: 10000 },
    memory: { max: 256 * 1024 * 1024, warningThreshold: 200 * 1024 * 1024 },
    cpu: { maxPercent: 50, maxCores: 1 },
    storage: { maxTempSize: 50 * 1024 * 1024, maxOutputSize: 1 * 1024 * 1024, maxFileCount: 20 },
    network: { maxConnections: 5, maxBandwidth: 1024 * 1024, maxDNSQueries: 10 },
    process: { maxCount: 10, maxThreads: 50, maxFileDescriptors: 50 }
  },

  // 标准测试 - 30秒超时，1GB内存
  standard: {
    time: { execution: 30000, idle: 5000, absolute: 60000 },
    memory: { max: 1024 * 1024 * 1024, warningThreshold: 800 * 1024 * 1024 },
    cpu: { maxPercent: 80, maxCores: 2 },
    storage: { maxTempSize: 200 * 1024 * 1024, maxOutputSize: 10 * 1024 * 1024, maxFileCount: 100 },
    network: { maxConnections: 20, maxBandwidth: 10 * 1024 * 1024, maxDNSQueries: 50 },
    process: { maxCount: 50, maxThreads: 200, maxFileDescriptors: 200 }
  },

  // 深度测试 - 5分钟超时，4GB内存
  deep: {
    time: { execution: 300000, idle: 30000, absolute: 600000 },
    memory: { max: 4 * 1024 * 1024 * 1024, warningThreshold: 3 * 1024 * 1024 * 1024 },
    cpu: { maxPercent: 100, maxCores: 4 },
    storage: { maxTempSize: 1024 * 1024 * 1024, maxOutputSize: 100 * 1024 * 1024, maxFileCount: 500 },
    network: { maxConnections: 100, maxBandwidth: 100 * 1024 * 1024, maxDNSQueries: 200 },
    process: { maxCount: 200, maxThreads: 500, maxFileDescriptors: 500 }
  }
};
```

### cgroups配置

```bash
# cgroups 配置示例

# 创建沙箱控制组
mkdir -p /sys/fs/cgroup/sandbox/${sandbox_id}

# 设置内存限制
echo "256M" > /sys/fs/cgroup/sandbox/${sandbox_id}/memory.limit_in_bytes
echo "256M" > /sys/fs/cgroup/sandbox/${sandbox_id}/memory.soft_limit_in_bytes
echo "50M" > /sys/fs/cgroup/sandbox/${sandbox_id}/memory.low_limit_in_bytes

# 设置CPU限制
echo "1024" > /sys/fs/cgroup/sandbox/${sandbox_id}/cpu.cfs_quota_us
echo "1000" > /sys/fs/cgroup/sandbox/${sandbox_id}/cpu.cfs_period_us

# 设置进程数限制
echo "10" > /sys/fs/cgroup/sandbox/${sandbox_id}/pids.max

# 设置IO限制
echo "10485760" > /sys/fs/cgroup/sandbox/${sandbox_id}/blkio.throttle.read_bps_device
echo "10485760" > /sys/fs/cgroup/sandbox/${sandbox_id}/blkio.throttle.write_bps_device
```

## 执行监控

### 系统调用追踪

```typescript
// 系统调用追踪器
class SyscallTracer {
  private tracer: Tracer;

  constructor(private sandbox: Sandbox) {}

  async trace<T>(
    fn: () => Promise<T>,
    options: TraceOptions = {}
  ): Promise<TraceResult<T>> {
    const startTime = Date.now();
    const syscalls: Syscall[] = [];
    const events: TraceEvent[] = [];

    // 启动追踪
    this.tracer.start({
      onSyscall: (syscall) => {
        syscalls.push({
          timestamp: Date.now() - startTime,
          name: syscall.name,
          args: syscall.args,
          result: syscall.result,
          duration: syscall.duration
        });
      },
      onEvent: (event) => {
        events.push({
          timestamp: Date.now() - startTime,
          type: event.type,
          data: event.data
        });
      }
    });

    try {
      const result = await fn();
      return {
        result,
        syscalls,
        events,
        duration: Date.now() - startTime,
        success: true
      };
    } catch (error) {
      return {
        result: null,
        syscalls,
        events,
        duration: Date.now() - startTime,
        success: false,
        error: error.message
      };
    } finally {
      this.tracer.stop();
    }
  }

  // 分析追踪结果
  analyze(result: TraceResult<any>): SyscallAnalysis {
    return {
      totalCalls: result.syscalls.length,
      uniqueCalls: [...new Set(result.syscalls.map(s => s.name))],

      // 分类统计
      fileOperations: result.syscalls.filter(s =>
        ['open', 'read', 'write', 'close', 'stat'].includes(s.name)
      ),
      networkOperations: result.syscalls.filter(s =>
        ['socket', 'connect', 'send', 'recv'].includes(s.name)
      ),
      processOperations: result.syscalls.filter(s =>
        ['fork', 'exec', 'wait', 'exit'].includes(s.name)
      ),

      // 风险评估
      suspiciousCalls: this.findSuspiciousCalls(result.syscalls),
      resourceUsage: this.calculateResourceUsage(result.syscalls)
    };
  }
}
```

### 行为监控

```typescript
// 行为监控器
class BehaviorMonitor {
  private rules: MonitoringRule[];

  constructor() {
    this.rules = this.loadRules();
  }

  // 监控执行
  async monitor(
    execution: Execution
  ): Promise<BehaviorReport> {
    const violations: Violation[] = [];
    const alerts: Alert[] = [];

    // 文件系统行为
    const fsBehavior = await this.monitorFileSystem(execution);
    violations.push(...fsBehavior.violations);

    // 网络行为
    const netBehavior = await this.monitorNetwork(execution);
    violations.push(...netBehavior.violations);

    // 进程行为
    const procBehavior = await this.monitorProcess(execution);
    violations.push(...procBehavior.violations);

    // 系统资源
    const resourceUsage = await this.monitorResources(execution);

    // 生成报告
    return {
      executionId: execution.id,
      duration: execution.duration,
      violations,
      alerts,
      resourceUsage,
      riskLevel: this.calculateRiskLevel(violations),
      verdict: violations.length === 0 ? 'safe' : 'unsafe'
    };
  }

  // 违规检测
  private checkViolation(
    action: string,
    resource: string,
    details: any
  ): Violation | null {
    for (const rule of this.rules) {
      if (rule.action === action && rule.resource === resource) {
        if (rule.condition(details)) {
          return {
            rule: rule.name,
            action,
            resource,
            details,
            severity: rule.severity,
            timestamp: Date.now()
          };
        }
      }
    }
    return null;
  }
}

// 监控规则
interface MonitoringRule {
  name: string;
  action: string;                  // 操作类型
  resource: string;                // 资源类型
  condition: (details: any) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

// 预定义规则
const monitoringRules: MonitoringRule[] = [
  {
    name: '禁止系统目录写入',
    action: 'write',
    resource: 'filesystem',
    condition: (details) => details.path.startsWith('/etc') ||
                            details.path.startsWith('/bin') ||
                            details.path.startsWith('/sbin'),
    severity: 'critical',
    description: '不允许写入系统目录'
  },
  {
    name: '禁止网络出站连接',
    action: 'connect',
    resource: 'network',
    condition: (details) => details.external === true,
    severity: 'high',
    description: '不允许建立外部网络连接'
  },
  {
    name: '禁止创建子进程',
    action: 'fork',
    resource: 'process',
    condition: () => true,
    severity: 'medium',
    description: '不允许创建子进程'
  },
  {
    name: '内存使用警告',
    action: 'memory',
    resource: 'resource',
    condition: (details) => details.usage > 0.8,  // 80%阈值
    severity: 'medium',
    description: '内存使用超过80%触发警告'
  }
];
```

## 执行结果

### 结果结构

```typescript
// 执行结果
interface ExecutionResult {
  id: string;                      // 执行ID
  sandboxId: string;               // 沙箱ID

  // 执行状态
  status: 'success' | 'timeout' | 'error' | 'killed' | 'crashed';

  // 输出
  stdout: string;                   // 标准输出
  stderr: string;                   // 标准错误

  // 性能指标
  metrics: {
    duration: number;              // 执行时长 (ms)
    cpuTime: number;               // CPU时间 (ms)
    memoryPeak: number;             // 峰值内存 (bytes)
    networkIn: number;             // 网络入站 (bytes)
    networkOut: number;            // 网络出站 (bytes)
    diskRead: number;              // 磁盘读取 (bytes)
    diskWrite: number;             // 磁盘写入 (bytes)
  };

  // 测试结果 (如果有)
  testResults?: TestResult[];

  // 覆盖率 (如果有)
  coverage?: CoverageReport;

  // 安全报告
  securityReport?: SecurityReport;

  // 错误信息
  error?: {
    type: string;
    message: string;
    stack?: string;
  };

  // 元数据
  metadata: {
    sandboxType: IsolationLevel;
    quota: string;
    executedAt: Date;
    completedAt: Date;
  };
}

// 测试结果
interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  assertions: number;
  failures?: Failure[];
}

// 覆盖率报告
interface CoverageReport {
  lines: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
  statements: CoverageMetric;
}

// 安全报告
interface SecurityReport {
  scanCompleted: boolean;
  vulnerabilities: Vulnerability[];
  warnings: string[];
  riskScore: number;
}
```

## 沙箱池管理

### 池化架构

```typescript
// 沙箱池管理器
class SandboxPool {
  private pools: Map<IsolationLevel, Pool<Sandbox>>;

  constructor(
    private configs: SandboxConfigs,
    private metrics: SandboxMetrics
  ) {
    this.pools = new Map();
    this.initializePools();
  }

  private initializePools() {
    // 进程沙箱池 - 大池，快速
    this.pools.set('PROCESS', new Pool({
      min: 5,
      max: 50,
      create: () => this.createProcessSandbox(),
      destroy: (s) => s.terminate(),
      validate: (s) => s.isHealthy()
    }));

    // 容器沙箱池 - 中等池
    this.pools.set('CONTAINER', new Pool({
      min: 2,
      max: 20,
      create: () => this.createContainerSandbox(),
      destroy: (s) => s.destroy(),
      validate: (s) => s.isHealthy()
    }));

    // VM沙箱池 - 小池，重量级
    this.pools.set('VM', new Pool({
      min: 1,
      max: 5,
      create: () => this.createVMSandbox(),
      destroy: (s) => s.destroy(),
      validate: (s) => s.isHealthy()
    }));
  }

  // 获取沙箱
  async acquire(level: IsolationLevel): Promise<Sandbox> {
    const pool = this.pools.get(level);
    if (!pool) {
      throw new Error(`Unknown isolation level: ${level}`);
    }

    return pool.acquire();
  }

  // 归还沙箱
  async release(level: IsolationLevel, sandbox: Sandbox) {
    const pool = this.pools.get(level);
    if (!pool) {
      throw new Error(`Unknown isolation level: ${level}`);
    }

    // 检查是否需要重置
    if (sandbox.needsReset()) {
      await sandbox.reset();
    }

    pool.release(sandbox);
  }

  // 获取统计
  getStats(): PoolStats[] {
    return Array.from(this.pools.entries()).map(([level, pool]) => ({
      level,
      total: pool.total,
      active: pool.active,
      available: pool.available,
      waiting: pool.waiting,
      utilization: pool.utilization
    }));
  }
}
```

### 自动扩缩容

```typescript
// 自动扩缩容策略
class SandboxAutoscaler {
  constructor(
    private pool: SandboxPool,
    private metrics: SandboxMetrics
  ) {
    this.startAutoscaling();
  }

  private startAutoscaling() {
    // 每30秒检查一次
    setInterval(() => this.checkAndScale(), 30000);
  }

  private async checkAndScale() {
    const stats = this.pool.getStats();

    for (const stat of stats) {
      const utilization = stat.active / stat.total;

      // 扩容: 利用率>70% 且 有等待队列
      if (utilization > 0.7 && stat.waiting > 0) {
        await this.scaleUp(stat.level);
      }

      // 缩容: 利用率<30% 持续10分钟
      if (utilization < 0.3) {
        await this.scaleDown(stat.level);
      }
    }
  }

  private async scaleUp(level: IsolationLevel) {
    const currentStats = this.pool.getStats().find(s => s.level === level);
    const maxScale = this.getMaxScale(level);

    if (currentStats && currentStats.total < maxScale) {
      console.log(`Scaling up ${level} sandbox pool`);
      // 触发池扩容
      await this.pool.scale(level, currentStats.total + 2);
    }
  }

  private async scaleDown(level: IsolationLevel) {
    const currentStats = this.pool.getStats().find(s => s.level === level);
    const minScale = this.getMinScale(level);

    if (currentStats && currentStats.total > minScale) {
      console.log(`Scaling down ${level} sandbox pool`);
      // 触发池缩容
      await this.pool.scale(level, currentStats.total - 2);
    }
  }
}
```

## 集成方案

### 与测试系统集成

```typescript
// 沙箱测试执行器
class SandboxTestExecutor {
  constructor(
    private pool: SandboxPool,
    private coverageCollector: CoverageCollector
  ) {}

  async executeTests(request: TestExecutionRequest): Promise<TestExecutionResult> {
    // 1. 获取合适级别的沙箱
    const sandbox = await this.pool.acquire(request.isolationLevel);

    try {
      // 2. 写入测试代码
      await sandbox.writeFiles({
        [`test.${request.language}`]: request.testCode,
        [`source.${request.language}`]: request.sourceCode
      });

      // 3. 执行测试
      const result = await sandbox.exec(request.runner, {
        args: request.runnerArgs,
        timeout: request.timeout
      });

      // 4. 收集覆盖率
      const coverage = await this.coverageCollector.collect(sandbox);

      // 5. 解析测试结果
      const testResults = this.parseTestResults(result.stdout, result.stderr);

      return {
        success: result.status === 'success',
        testResults,
        coverage,
        metrics: result.metrics,
        logs: result.stdout + result.stderr
      };
    } finally {
      // 6. 归还沙箱
      await this.pool.release(request.isolationLevel, sandbox);
    }
  }
}
```

## 监控指标

```typescript
// 沙箱指标
const sandboxMetrics = {
  // 执行指标
  executionsTotal: Counter;
  executionsByLevel: Counter;
  executionsByStatus: Counter;

  // 性能指标
  executionDuration: Histogram;
  queueWaitTime: Histogram;

  // 资源指标
  activeSandboxes: Gauge;
  poolUtilization: Gauge;

  // 安全指标
  securityViolationsTotal: Counter;
  timeoutExecutions: Counter;

  // 错误指标
  sandboxErrors: Counter;
  containerFailures: Counter;
  vmBootFailures: Counter;
};
```

## 配置

```typescript
// 沙箱配置
interface SandboxConfig {
  // 默认隔离级别
  defaultLevel: IsolationLevel;

  // 默认配额
  defaultQuota: string;

  // 池配置
  pools: {
    process: { min: number; max: number };
    container: { min: number; max: number };
    vm: { min: number; max: number };
  };

  // 镜像配置
  images: {
    default: string;
    byLanguage: Record<string, string>;
  };

  // 安全配置
  security: {
    enableSyscallTracing: boolean;
    enableNetworkMonitoring: boolean;
    enableFSMonitoring: boolean;
    maxRiskScore: number;
  };

  // 超时配置
  timeouts: {
    quick: number;
    standard: number;
    deep: number;
  };
}
```

---

**最后更新**: 2026-04-14
