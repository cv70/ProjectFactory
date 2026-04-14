# 安全设计文档

## 1. 安全架构

### 1.1 安全设计原则

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           安全设计原则                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        纵深防御                                        │   │
│  │   多层安全防护，每层独立安全机制                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↑                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         最小权限原则                                    │   │
│  │   每个组件只拥有完成其功能所需的最小权限                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↑                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         零信任架构                                      │   │
│  │   始终验证，不默认信任任何请求或组件                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↑                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         安全默认原则                                    │   │
│  │   默认配置即为最安全配置，需手动开启不安全的选项                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 安全架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              安全架构总览                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         边界层                                         │   │
│  │                                                                       │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │   │
│  │   │  WAF        │  │  DDoS      │  │  Rate      │                │   │
│  │   │  (Web应用防火墙)│  │  Protection │  │  Limiter   │                │   │
│  │   └─────────────┘  └─────────────┘  └─────────────┘                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         认证授权层                                     │   │
│  │                                                                       │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │   │
│  │   │  API Key    │  │  JWT        │  │  RBAC      │                │   │
│  │   │  Auth       │  │  Token      │  │  (基于角色的访问控制)│                │   │
│  │   └─────────────┘  └─────────────┘  └─────────────┘                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         数据安全层                                     │   │
│  │                                                                       │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │   │
│  │   │  Encryption │  │  Input      │  │  Output    │                │   │
│  │   │             │  │  Validation │  │  Sanitization│                │   │
│  │   └─────────────┘  └─────────────┘  └─────────────┘                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         运行时安全层                                   │   │
│  │                                                                       │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │   │
│  │   │  Sandbox    │  │  Process   │  │  Memory   │                │   │
│  │   │             │  │  Isolation │  │  Protection│                │   │
│  │   └─────────────┘  └─────────────┘  └─────────────┘                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         审计与监控层                                   │   │
│  │                                                                       │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │   │
│  │   │  Audit Log  │  │  Security  │  │  Threat   │                │   │
│  │   │             │  │  Monitoring │  │  Detection │                │   │
│  │   └─────────────┘  └─────────────┘  └─────────────┘                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. 认证与授权

### 2.1 认证机制

```typescript
// 认证机制

// API Key 认证
interface ApiKeyAuth {
  type: 'api-key';
  headerName: 'X-API-Key';
  keyPrefix: 'pf_'  // 密钥前缀，便于识别
  keyLength: 32     // 密钥长度
  rotationPeriod: number;  // 强制轮换周期（天）
}

// JWT 认证
interface JwtAuth {
  type: 'jwt';
  algorithm: 'HS256' | 'RS256';
  expiration: number;       // Token 有效期（秒）
  refreshExpiration: number;  // Refresh Token 有效期
  issuer: 'project-factory';
}

// 认证配置
interface AuthConfig {
  apiKey: ApiKeyAuth;
  jwt: JwtAuth;
  rateLimit: {
    windowMs: number;      // 时间窗口
    maxRequests: number;   // 最大请求数
  };
}

// 认证服务
class AuthService {
  // API Key 验证
  async validateApiKey(key: string): Promise<AuthResult> {
    const hash = await this.hashKey(key);

    const apiKey = await this.db.apiKeys.findOne({
      where: { hash, isActive: true }
    });

    if (!apiKey) {
      return { valid: false, error: 'Invalid API key' };
    }

    // 检查过期
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { valid: false, error: 'API key expired' };
    }

    // 检查轮换
    if (this.shouldRotate(apiKey)) {
      await this.initiateRotation(apiKey);
    }

    // 更新最后使用时间
    await this.updateLastUsed(apiKey.id);

    return {
      valid: true,
      identity: {
        type: 'api-key',
        keyId: apiKey.id,
        permissions: apiKey.permissions
      }
    };
  }

  // JWT 验证
  async validateJwt(token: string): Promise<AuthResult> {
    try {
      const decoded = await this.jwtService.verify(token);

      // 验证颁发者
      if (decoded.iss !== 'project-factory') {
        return { valid: false, error: 'Invalid issuer' };
      }

      // 验证过期
      if (decoded.exp < Date.now() / 1000) {
        return { valid: false, error: 'Token expired' };
      }

      return {
        valid: true,
        identity: {
          type: 'jwt',
          userId: decoded.sub,
          permissions: decoded.permissions
        }
      };
    } catch (error) {
      return { valid: false, error: 'Invalid token' };
    }
  }
}

// 认证中间件
function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: 'No authorization header' });
    return;
  }

  if (authHeader.startsWith('Bearer ')) {
    // JWT 认证
    const token = authHeader.slice(7);
    const result = await authService.validateJwt(token);

    if (!result.valid) {
      res.status(401).json({ error: result.error });
      return;
    }

    req.identity = result.identity;
  } else if (authHeader.startsWith('X-API-Key ')) {
    // API Key 认证
    const key = authHeader.slice(10);
    const result = await authService.validateApiKey(key);

    if (!result.valid) {
      res.status(401).json({ error: result.error });
      return;
    }

    req.identity = result.identity;
  } else {
    res.status(401).json({ error: 'Invalid authorization type' });
    return;
  }

  next();
}
```

### 2.2 授权机制 (RBAC)

```typescript
// RBAC 授权

// 角色定义
enum Role {
  ADMIN = 'admin',           // 管理员 - 完全权限
  OPERATOR = 'operator',     // 操作员 - 管理项目和执行操作
  DEVELOPER = 'developer',    // 开发者 - 查看和管理自己的项目
  VIEWER = 'viewer',         // 查看者 - 只读访问
  SYSTEM = 'system'          // 系统 - 内部服务账户
}

// 权限定义
enum Permission {
  // 项目权限
  PROJECT_CREATE = 'project:create',
  PROJECT_READ = 'project:read',
  PROJECT_UPDATE = 'project:update',
  PROJECT_DELETE = 'project:delete',
  PROJECT_EXECUTE = 'project:execute',

  // 创意权限
  IDEA_CREATE = 'idea:create',
  IDEA_READ = 'idea:read',
  IDEA_UPDATE = 'idea:update',
  IDEA_DELETE = 'idea:delete',

  // 知识库权限
  KNOWLEDGE_READ = 'knowledge:read',
  KNOWLEDGE_WRITE = 'knowledge:write',

  // 系统权限
  SYSTEM_CONFIG = 'system:config',
  SYSTEM_MONITOR = 'system:monitor',
  SYSTEM_USER = 'system:user'
}

// 角色权限映射
const rolePermissions: Record<Role, Permission[]> = {
  [Role.ADMIN]: Object.values(Permission),
  [Role.OPERATOR]: [
    Permission.PROJECT_CREATE,
    Permission.PROJECT_READ,
    Permission.PROJECT_UPDATE,
    Permission.PROJECT_DELETE,
    Permission.PROJECT_EXECUTE,
    Permission.IDEA_CREATE,
    Permission.IDEA_READ,
    Permission.IDEA_UPDATE,
    Permission.KNOWLEDGE_READ,
    Permission.KNOWLEDGE_WRITE,
    Permission.SYSTEM_MONITOR
  ],
  [Role.DEVELOPER]: [
    Permission.PROJECT_READ,
    Permission.PROJECT_UPDATE,
    Permission.IDEA_CREATE,
    Permission.IDEA_READ,
    Permission.KNOWLEDGE_READ
  ],
  [Role.VIEWER]: [
    Permission.PROJECT_READ,
    Permission.IDEA_READ,
    Permission.KNOWLEDGE_READ
  ],
  [Role.SYSTEM]: [
    Permission.PROJECT_CREATE,
    Permission.PROJECT_READ,
    Permission.PROJECT_EXECUTE,
    Permission.IDEA_CREATE,
    Permission.IDEA_READ,
    Permission.KNOWLEDGE_READ,
    Permission.KNOWLEDGE_WRITE
  ]
};

// 授权服务
class AuthorizationService {
  // 检查权限
  async checkPermission(
    identity: Identity,
    permission: Permission,
    resource?: Resource
  ): Promise<boolean> {
    // 获取用户角色
    const roles = await this.getUserRoles(identity.userId);

    // 检查每个角色
    for (const role of roles) {
      const permissions = rolePermissions[role];

      if (permissions.includes(permission)) {
        // 检查资源级权限
        if (resource) {
          return await this.checkResourcePermission(identity, role, permission, resource);
        }
        return true;
      }
    }

    return false;
  }

  // 资源级权限检查
  async checkResourcePermission(
    identity: Identity,
    role: Role,
    permission: Permission,
    resource: Resource
  ): Promise<boolean> {
    // 管理员可以操作所有资源
    if (role === Role.ADMIN) return true;

    // 开发者只能操作自己的资源
    if (role === Role.DEVELOPER) {
      return resource.ownerId === identity.userId;
    }

    // 其他角色不能操作资源
    return false;
  }
}

// 授权中间件工厂
function requirePermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const identity = req.identity;

    if (!identity) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const hasPermission = await authService.checkPermission(identity, permission);

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    next();
  };
}

// 使用示例
router.delete('/projects/:id',
  authMiddleware,
  requirePermission(Permission.PROJECT_DELETE),
  async (req, res) => {
    // 删除项目逻辑
  }
);
```

## 3. 数据安全

### 3.1 输入验证

```typescript
// 输入验证

// Zod Schema 定义
const projectSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name too long')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Invalid name format'),

  type: z.enum(['web-app', 'cli-tool', 'library', 'api-service']),

  features: z.array(z.string())
    .min(1, 'At least one feature required')
    .max(50, 'Too many features'),

  techStack: z.array(z.string())
    .min(1, 'At least one tech stack required'),

  constraints: z.object({
    maxBudget: z.number().positive().optional(),
    maxComplexity: z.enum(['low', 'medium', 'high']).optional()
  }).optional()
});

// 深度验证
class InputValidator {
  // SQL 注入防护
  validateSqlInput(input: string): string {
    const dangerous = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', '--', ';', '/*', '*/'];
    const upper = input.toUpperCase();

    for (const pattern of dangerous) {
      if (upper.includes(pattern)) {
        throw new ValidationError(`Invalid input pattern: ${pattern}`);
      }
    }

    return input;
  }

  // XSS 防护
  sanitizeHtml(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // 命令注入防护
  validateCommandInput(input: string): string {
    const dangerous = [';', '|', '&', '$', '`', '>', '<', '\n', '\r'];
    const sanitized = dangerous.reduce((acc, char) => acc.replaceAll(char, ''), input);

    if (sanitized !== input) {
      throw new ValidationError('Invalid command characters');
    }

    return sanitized;
  }

  // 路径遍历防护
  validatePath(input: string): string {
    if (input.includes('..') || input.includes('~')) {
      throw new ValidationError('Path traversal not allowed');
    }

    // 规范化路径
    return path.normalize(input);
  }
}

// 验证中间件
function validateBody<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors
        });
      } else {
        next(error);
      }
    }
  };
}
```

### 3.2 敏感数据处理

```typescript
// 敏感数据处理

// 敏感字段标记
const SENSITIVE_FIELDS = [
  'password',
  'apiKey',
  'secret',
  'token',
  'privateKey',
  'accessKey'
];

// 数据脱敏
function sanitizeData<T>(data: T, fields: string[] = SENSITIVE_FIELDS): T {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item, fields)) as T;
  }

  const result: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (fields.some(f => key.toLowerCase().includes(f))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      result[key] = sanitizeData(value, fields);
    } else {
      result[key] = value;
    }
  }

  return result;
}

// 加密存储
class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;

  constructor() {
    // 从环境变量或密钥管理服务获取密钥
    const keyHex = process.env.ENCRYPTION_KEY;
    if (!keyHex) {
      throw new Error('ENCRYPTION_KEY not set');
    }
    this.key = Buffer.from(keyHex, 'hex');
  }

  // 加密
  encrypt(plaintext: string): EncryptedData {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  // 解密
  decrypt(data: EncryptedData): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(data.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));

    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

// 密钥存储
class KeyStorage {
  // 生成 API 密钥
  async generateApiKey(): Promise<ApiKeyRecord> {
    const key = crypto.randomBytes(32);
    const hash = await crypto.hash('sha256', key);

    const record = {
      id: generateId(),
      keyPrefix: 'pf_' + key.slice(0, 8).toString('hex'),
      hash,
      createdAt: new Date(),
      expiresAt: this.calculateExpiration(90),  // 90 天过期
      isActive: true
    };

    await this.db.apiKeys.create(record);
    return { ...record, key: 'pf_' + key.toString('hex') };  // 返回完整密钥（仅此一次）
  }
}
```

## 4. 运行时安全

### 4.1 沙箱隔离

```typescript
// 代码执行沙箱

// 隔离级别
enum IsolationLevel {
  NONE = 'none',         // 无隔离，直接执行
  PROCESS = 'process',    // 进程隔离
  VM = 'vm',             // 虚拟机隔离
  CONTAINER = 'container' // 容器隔离
}

// 沙箱配置
interface SandboxConfig {
  isolation: IsolationLevel;
  timeout: number;           // 执行超时 ms
  memoryLimit?: number;      // 内存限制 MB
  cpuLimit?: number;         // CPU 限制
  networkAccess: boolean;     // 是否允许网络访问
  filesystemAccess: {
    allowed: string[];       // 允许访问的目录
    readOnly: boolean;
  };
  envVars: {                 // 环境变量
    allowed: string[];
    values: Record<string, string>;
  };
}

// 进程隔离执行器
class ProcessSandbox {
  async execute(
    code: string,
    config: SandboxConfig
  ): Promise<ExecutionResult> {
    const child = spawn('node', ['--eval', code], {
      cwd: config.filesystemAccess.allowed[0] || '/tmp',
      env: {
        ...this.filterEnv(config.envVars),
        NODE_OPTIONS: '--max-old-space-size=' + (config.memoryLimit || 512)
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: config.timeout
    });

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => stdout += data);
      child.stderr.on('data', (data) => stderr += data);

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          stdout,
          stderr,
          exitCode: code
        });
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          stdout,
          stderr: error.message,
          exitCode: -1
        });
      });
    });
  }
}

// 生成代码验证
class CodeValidator {
  private dangerousPatterns = [
    /require\s*\(\s*['"]child_process['"]\s*\)/,
    /require\s*\(\s*['"]fs['"]\s*\)/,
    /eval\s*\(/,
    /Function\s*\(/,
    /process\./,
    /child_process\./,
    /exec\s*\(/,
    /spawn\s*\(/,
    /fork\s*\(/,
    /\.\.\//,  // 路径遍历
  ];

  validate(code: string): ValidationResult {
    const violations: Violation[] = [];

    for (const pattern of this.dangerousPatterns) {
      const match = code.match(pattern);
      if (match) {
        violations.push({
          pattern: pattern.source,
          match: match[0],
          line: this.findLineNumber(code, match.index!)
        });
      }
    }

    return {
      valid: violations.length === 0,
      violations
    };
  }
}
```

### 4.2 资源限制

```typescript
// 资源限制

interface ResourceLimits {
  maxMemory: number;        // MB
  maxCpuTime: number;       // ms
  maxFileSize: number;      // bytes
  maxFiles: number;         // 最多文件数
  maxNetworkRequests: number;  // 最多网络请求数
}

// 资源监控器
class ResourceMonitor {
  private limits: ResourceLimits;
  private currentUsage: Map<string, ResourceUsage> = new Map();

  // 检查限制
  checkLimit(operation: string, usage: ResourceUsage): LimitCheckResult {
    const current = this.currentUsage.get(operation) || {
      memory: 0,
      cpuTime: 0,
      fileSize: 0,
      fileCount: 0,
      networkRequests: 0
    };

    if (usage.memory + current.memory > this.limits.maxMemory) {
      return { allowed: false, reason: 'Memory limit exceeded' };
    }

    if (usage.cpuTime + current.cpuTime > this.limits.maxCpuTime) {
      return { allowed: false, reason: 'CPU time limit exceeded' };
    }

    if (usage.fileSize > this.limits.maxFileSize) {
      return { allowed: false, reason: 'File size limit exceeded' };
    }

    if (usage.fileCount + current.fileCount > this.limits.maxFiles) {
      return { allowed: false, reason: 'File count limit exceeded' };
    }

    if (usage.networkRequests + current.networkRequests > this.limits.maxNetworkRequests) {
      return { allowed: false, reason: 'Network request limit exceeded' };
    }

    return { allowed: true };
  }

  // 更新使用量
  updateUsage(operation: string, usage: ResourceUsage): void {
    const current = this.currentUsage.get(operation) || initialUsage;
    this.currentUsage.set(operation, {
      memory: current.memory + usage.memory,
      cpuTime: current.cpuTime + usage.cpuTime,
      fileSize: Math.max(current.fileSize, usage.fileSize),
      fileCount: current.fileCount + usage.fileCount,
      networkRequests: current.networkRequests + usage.networkRequests
    });
  }
}
```

## 5. 审计日志

### 5.1 审计事件

```typescript
// 审计事件

enum AuditEventType {
  // 认证事件
  AUTH_LOGIN = 'auth:login',
  AUTH_LOGOUT = 'auth:logout',
  AUTH_TOKEN_REFRESH = 'auth:token_refresh',
  AUTH_FAILURE = 'auth:failure',

  // 项目事件
  PROJECT_CREATE = 'project:create',
  PROJECT_UPDATE = 'project:update',
  PROJECT_DELETE = 'project:delete',
  PROJECT_EXECUTE = 'project:execute',

  // 敏感操作
  CONFIG_CHANGE = 'config:change',
  USER_CREATE = 'user:create',
  USER_DELETE = 'user:delete',
  PERMISSION_CHANGE = 'permission:change',
  API_KEY_CREATE = 'api_key:create',
  API_KEY_REVOKE = 'api_key:revoke',

  // 安全事件
  SECURITY_VIOLATION = 'security:violation',
  RATE_LIMIT_EXCEEDED = 'security:rate_limit',
  INVALID_INPUT = 'security:invalid_input'
}

// 审计日志记录
interface AuditLog {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;

  // 主体
  subject: {
    type: 'user' | 'api_key' | 'system';
    id: string;
    ip?: string;
    userAgent?: string;
  };

  // 客体
  object?: {
    type: string;
    id: string;
    name?: string;
  };

  // 动作
  action: {
    type: 'create' | 'read' | 'update' | 'delete' | 'execute';
    details?: Record<string, any>;
  };

  // 结果
  result: {
    success: boolean;
    error?: string;
  };

  // 上下文
  context: {
    workflowId?: string;
    requestId: string;
    sessionId?: string;
  };
}

// 审计服务
class AuditService {
  private queue: AuditLog[] = [];
  private flushInterval = 5000;  // 5 秒刷新

  // 记录事件
  async log(event: AuditLog): Promise<void> {
    // 异步写入
    this.queue.push(event);

    // 如果队列太长，立即刷新
    if (this.queue.length >= 100) {
      await this.flush();
    }
  }

  // 批量写入
  private async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.queue.length);
    await this.db.auditLogs.createMany(batch);
  }

  // 查询审计日志
  async query(filter: AuditFilter): Promise<AuditLog[]> {
    return this.db.auditLogs.findMany({
      where: {
        ...filter,
        timestamp: {
          gte: filter.startDate,
          lte: filter.endDate
        }
      },
      orderBy: { timestamp: 'desc' },
      limit: filter.limit || 100
    });
  }
}

// 审计中间件
function auditMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = generateId();
  req.requestId = requestId;

  // 记录开始
  const startTime = Date.now();

  res.on('finish', () => {
    const event: AuditLog = {
      id: generateId(),
      timestamp: new Date(),
      eventType: determineEventType(req.method, req.path),
      subject: {
        type: req.identity?.type || 'anonymous',
        id: req.identity?.id || 'anonymous',
        ip: req.ip,
        userAgent: req.headers['user-agent']
      },
      action: {
        type: req.method.toLowerCase() as any,
        details: {
          path: req.path,
          query: req.query,
          statusCode: res.statusCode
        }
      },
      result: {
        success: res.statusCode < 400,
        error: res.statusCode >= 400 ? res.statusMessage : undefined
      },
      context: {
        requestId,
        workflowId: req.headers['x-workflow-id'] as string
      }
    };

    auditService.log(event);
  });

  next();
}
```

## 6. 安全监控

### 6.1 威胁检测

```typescript
// 威胁检测

interface ThreatSignature {
  id: string;
  name: string;
  pattern: RegExp | string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'block' | 'alert' | 'log';
}

const threatSignatures: ThreatSignature[] = [
  // SQL 注入
  {
    id: 'sql-injection-1',
    name: 'SQL Injection Basic',
    pattern: /(\bunion\b|\bselect\b|\binsert\b|\bdrop\b|\bexec\b)/i,
    severity: 'high',
    action: 'block'
  },

  // XSS
  {
    id: 'xss-script-tag',
    name: 'XSS Script Tag',
    pattern: /<script[^>]*>.*?<\/script>/gi,
    severity: 'critical',
    action: 'block'
  },

  // 路径遍历
  {
    id: 'path-traversal',
    name: 'Path Traversal',
    pattern: /\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\//i,
    severity: 'high',
    action: 'block'
  },

  // 命令注入
  {
    id: 'command-injection',
    name: 'Command Injection',
    pattern: /[;&|`$]/,
    severity: 'critical',
    action: 'block'
  }
];

// 威胁检测器
class ThreatDetector {
  async detect(input: string): Promise<ThreatDetection[]> {
    const detections: ThreatDetection[] = [];

    for (const signature of threatSignatures) {
      let match;

      if (typeof signature.pattern === 'string') {
        match = input.includes(signature.pattern);
      } else {
        match = input.match(signature.pattern);
      }

      if (match) {
        detections.push({
          signature,
          match: typeof match === 'string' ? match : match[0],
          timestamp: new Date()
        });
      }
    }

    return detections;
  }

  async handleDetections(detections: ThreatDetection[]): Promise<void> {
    for (const detection of detections) {
      switch (detection.signature.action) {
        case 'block':
          throw new SecurityError('Threat detected and blocked', detection);
        case 'alert':
          await this.sendAlert(detection);
          break;
        case 'log':
          await this.logThreat(detection);
          break;
      }
    }
  }
}
```

---

**版本**: 1.0.0
**创建日期**: 2026-04-14
**状态**: 安全设计完成
