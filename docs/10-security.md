# 安全设计

## 1. 安全架构

### 1.1 安全层次

```
┌─────────────────────────────────────────────────────────────────┐
│                        应用层安全                                │
│  - 输入验证  - 输出编码  - 认证授权  - 会话管理                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        数据层安全                                │
│  - 数据加密  - 访问控制  - 审计日志  - 备份恢复                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        网络层安全                                │
│  - HTTPS   - 防火墙  - DDoS防护  - WAF                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        基础设施安全                              │
│  - 容器安全  - 密钥管理  - 漏洞扫描  - 补丁管理                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 威胁模型

| 威胁类别 | 威胁示例 | 影响 | 缓解措施 |
|---------|---------|------|---------|
| 身份验证 | 暴力破解、凭证泄露 | 高 | MFA、速率限制 |
| 授权 | 越权访问、水平越权 | 高 | RBAC、最小权限 |
| 注入 | SQL注入、命令注入 | 高 | 参数化查询、输入验证 |
| XSS | 存储型、反射型XSS | 中 | 输出编码、CSP |
| CSRF | 跨站请求伪造 | 中 | CSRF Token |
| 数据泄露 | 敏感数据暴露 | 高 | 加密、最小化数据 |
| DoS | 资源耗尽攻击 | 中 | 限流、配额 |

## 2. 认证与授权

### 2.1 认证方案

```typescript
// security/auth/authentication.ts

export interface AuthenticationConfig {
  strategy: 'jwt' | 'oauth' | 'api-key' | 'session';
  jwt: {
    secret: string;
    expiresIn: string;
    algorithm: string;
  };
  oauth: {
    providers: OAuthProvider[];
  };
  api: {
    keyHeader: string;
    keyPrefix: string;
  };
}

export class AuthenticationService {
  async authenticate(credentials: Credentials): Promise<AuthResult> {
    // 1. 验证凭证
    const user = await this.validateCredentials(credentials);

    // 2. 检查账户状态
    if (user.status !== 'active') {
      throw new AuthenticationError('Account is inactive');
    }

    // 3. 检查失败次数
    if (await this.checkRateLimit(credentials.username)) {
      throw new AuthenticationError('Too many attempts');
    }

    // 4. 生成令牌
    const tokens = this.generateTokens(user);

    // 5. 记录登录
    await this.logLogin(user.id, credentials.ip);

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  private generateTokens(user: User): Tokens {
    const accessToken = jwt.sign(
      { sub: user.id, type: 'access' },
      this.config.jwt.secret,
      { expiresIn: this.config.jwt.expiresIn }
    );

    const refreshToken = jwt.sign(
      { sub: user.id, type: 'refresh' },
      this.config.jwt.secret,
      { expiresIn: '30d' }
    );

    return { accessToken, refreshToken };
  }

  private async validateCredentials(credentials: Credentials): Promise<User> {
    // 使用bcrypt验证密码
    const user = await this.userRepository.findByUsername(credentials.username);
    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
    if (!isValid) {
      throw new AuthenticationError('Invalid credentials');
    }

    return user;
  }

  private sanitizeUser(user: User): Partial<User> {
    // 移除敏感信息
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
```

### 2.2 授权方案

```typescript
// security/auth/authorization.ts

export interface Role {
  name: string;
  permissions: Permission[];
}

export interface Permission {
  resource: string;
  actions: string[];
}

export class AuthorizationService {
  private roles: Map<string, Role> = new Map();

  constructor() {
    this.initializeRoles();
  }

  hasPermission(user: User, resource: string, action: string): boolean {
    const role = this.roles.get(user.role);
    if (!role) return false;

    const permission = role.permissions.find(p => p.resource === resource);
    if (!permission) return false;

    return permission.actions.includes(action);
  }

  check(user: User, resource: string, action: string): void {
    if (!this.hasPermission(user, resource, action)) {
      throw new AuthorizationError(
        `User ${user.id} does not have permission ${action} on ${resource}`
      );
    }
  }

  private initializeRoles(): void {
    this.roles.set('admin', {
      name: 'admin',
      permissions: [
        { resource: 'projects', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'system', actions: ['configure', 'monitor'] },
      ],
    });

    this.roles.set('user', {
      name: 'user',
      permissions: [
        { resource: 'projects', actions: ['create', 'read', 'update'] },
        { resource: 'projects', actions: ['delete', { condition: 'owner' }] },
      ],
    });
  }
}
```

## 3. 输入验证

### 3.1 请求验证

```typescript
// security/validation/schema.ts

import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must be at most 100 characters')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Name can only contain letters, numbers, hyphens, and underscores'),
  description: z.string()
    .max(500, 'Description must be at most 500 characters')
    .optional(),
  type: z.enum(['crud', 'data-tool', 'script', 'other']),
  requirements: z.string()
    .max(10000, 'Requirements must be at most 10000 characters')
    .optional(),
});

export const loginSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

// 中间件
export function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
        });
      } else {
        next(error);
      }
    }
  };
}
```

### 3.2 SQL注入防护

```typescript
// security/database/anti-injection.ts

export class SecureDatabase {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    // 使用参数化查询
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  async findById<T>(table: string, id: string): Promise<T | undefined> {
    // 参数化查询示例
    return this.queryOne<T>(
      `SELECT * FROM ${this.escapeIdentifier(table)} WHERE id = ?`,
      [id]
    );
  }

  private escapeIdentifier(identifier: string): string {
    // 验证标识符格式
    if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
      throw new Error('Invalid table identifier');
    }
    return `"${identifier}"`;
  }

  // 列名白名单
  private allowedColumns: Record<string, string[]> = {
    projects: ['id', 'name', 'description', 'type', 'status', 'created_at'],
    users: ['id', 'username', 'email', 'role'],
  };

  async getWithColumns<T>(table: string, columns: string[]): Promise<T[]> {
    const allowed = this.allowedColumns[table] || [];
    const validColumns = columns.filter(c => allowed.includes(c));

    if (validColumns.length === 0) {
      return [];
    }

    const sql = `SELECT ${validColumns.join(', ')} FROM ${this.escapeIdentifier(table)}`;
    return this.query<T>(sql);
  }
}
```

## 4. 数据保护

### 4.1 敏感数据处理

```typescript
// security/data/protection.ts

export class DataProtectionService {
  private encryptionKey: Buffer;

  constructor(key: string) {
    this.encryptionKey = Buffer.from(key, 'hex');
  }

  // 加密敏感数据
  encrypt(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // 格式: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  // 解密敏感数据
  decrypt(encrypted: string): string {
    const [ivHex, authTagHex, encryptedData] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // 数据脱敏
  maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `${local[0]}*@${domain}`;
    return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
  }

  maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) return '***';
    return `${apiKey.substring(0, 4)}${'*'.repeat(apiKey.length - 8)}${apiKey.substring(apiKey.length - 4)}`;
  }

  // PII检测
  detectPII(text: string): PIIType[] {
    const patterns: Record<string, RegExp> = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /\b\d{3}-\d{3}-\d{4}\b/g,
      creditCard: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    };

    const detected: PIIType[] = [];

    for (const [type, pattern] of Object.entries(patterns)) {
      const matches = text.match(pattern);
      if (matches) {
        detected.push({ type, count: matches.length });
      }
    }

    return detected;
  }
}

export interface PIIType {
  type: string;
  count: number;
}
```

### 4.2 密钥管理

```typescript
// security/keys/management.ts

export interface SecretProvider {
  getSecret(name: string): Promise<string | undefined>;
  setSecret(name: string, value: string): Promise<void>;
}

export class KeyManagementService {
  constructor(private provider: SecretProvider) {}

  async getApiKey(service: string): Promise<string> {
    const key = await this.provider.getSecret(`api_key_${service}`);
    if (!key) {
      throw new Error(`API key for ${service} not found`);
    }
    return key;
  }

  async rotateApiKey(service: string): Promise<string> {
    const newKey = this.generateApiKey();
    await this.provider.setSecret(`api_key_${service}`, newKey);
    return newKey;
  }

  private generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // 环境变量验证
  validateRequiredKeys(keys: string[]): void {
    const missing: string[] = [];

    for (const key of keys) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
}
```

## 5. 安全扫描与监控

### 5.1 依赖漏洞扫描

```typescript
// security/scanning/dependencies.ts

export interface Vulnerability {
  severity: 'critical' | 'high' | 'medium' | 'low';
  package: string;
  version: string;
  cve?: string;
  description: string;
  fixedIn?: string;
}

export class DependencyScanner {
  async scanProject(projectPath: string): Promise<Vulnerability[]> {
    const packageJson = await this.readPackageJson(projectPath);
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    const vulnerabilities: Vulnerability[] = [];

    for (const [name, version] of Object.entries(dependencies)) {
      const vulns = await this.checkVulnerabilities(name, version as string);
      vulnerabilities.push(...vulns);
    }

    return vulnerabilities;
  }

  private async checkVulnerabilities(
    packageName: string,
    version: string
  ): Promise<Vulnerability[]> {
    // 调用npm audit API或类似服务
    const response = await fetch(
      `https://registry.npmjs.org/-/npm/v1/advisories?package_name=${packageName}`
    );

    const data = await response.json();
    const advisories = data.advisories || [];

    return advisories
      .filter((a: any) => a.vulnerable_versions.includes(version))
      .map((a: any) => ({
        severity: a.severity,
        package: packageName,
        version,
        cve: a.cves?.[0],
        description: a.overview,
        fixedIn: a.patched_versions,
      }));
  }

  async fixVulnerabilities(
    vulnerabilities: Vulnerability[]
  ): Promise<void> {
    // 自动修复漏洞
    for (const vuln of vulnerabilities) {
      if (vuln.fixedIn) {
        await this.exec(`npm install ${vuln.package}@${vuln.fixedIn}`);
      }
    }
  }
}
```

### 5.2 代码安全扫描

```typescript
// security/scanning/code.ts

export class CodeSecurityScanner {
  async scanFile(filePath: string, content: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    // 检测硬编码密钥
    issues.push(...this.detectHardcodedSecrets(filePath, content));

    // 检测不安全的函数调用
    issues.push(...this.detectUnsafeFunctions(filePath, content));

    // 检测SQL注入风险
    issues.push(...this.detectSQLInjection(filePath, content));

    // 检测XSS风险
    issues.push(...this.detectXSS(filePath, content));

    return issues;
  }

  private detectHardcodedSecrets(filePath: string, content: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const patterns = [
      { pattern: /password\s*=\s*['"][^'"]+['"]/gi, type: 'hardcoded-password' },
      { pattern: /api_key\s*=\s*['"][^'"]{20,}['"]/gi, type: 'hardcoded-api-key' },
      { pattern: /secret\s*=\s*['"][^'"]+['"]/gi, type: 'hardcoded-secret' },
      { pattern: /token\s*=\s*['"][^'"]{20,}['"]/gi, type: 'hardcoded-token' },
    ];

    for (const { pattern, type } of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        issues.push({
          type: 'security',
          severity: 'high',
          category: 'hardcoded-secret',
          message: `Potential hardcoded ${type} detected`,
          location: { file: filePath, line: this.getLineNumber(content, match.index) },
        });
      }
    }

    return issues;
  }

  private detectUnsafeFunctions(filePath: string, content: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const unsafeFunctions = [
      { name: 'eval', severity: 'critical' },
      { name: 'Function', severity: 'critical' },
      { name: 'exec', severity: 'critical' },
      { name: 'spawn', severity: 'high' },
    ];

    for (const { name, severity } of unsafeFunctions) {
      const pattern = new RegExp(`\\b${name}\\s*\\(`, 'g');
      let match;
      while ((match = pattern.exec(content)) !== null) {
        issues.push({
          type: 'security',
          severity,
          category: 'unsafe-function',
          message: `Use of unsafe function: ${name}`,
          location: { file: filePath, line: this.getLineNumber(content, match.index) },
        });
      }
    }

    return issues;
  }

  private detectSQLInjection(filePath: string, content: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const patterns = [
      // 字符串拼接SQL
      /query\s*=\s*['"]\s*SELECT.*\s*\+.*['"]/gi,
      /execute\s*\(\s*['"]\s*SELECT.*\$\{/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        issues.push({
          type: 'security',
          severity: 'high',
          category: 'sql-injection',
          message: 'Potential SQL injection vulnerability',
          location: { file: filePath, line: this.getLineNumber(content, match.index) },
        });
      }
    }

    return issues;
  }

  private detectXSS(filePath: string, content: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const patterns = [
      // 直接输出用户输入
      /dangerouslySetInnerHTML.*\$\{.*\}/gi,
      /innerHTML\s*=\s*.*\$\{/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        issues.push({
          type: 'security',
          severity: 'medium',
          category: 'xss',
          message: 'Potential XSS vulnerability',
          location: { file: filePath, line: this.getLineNumber(content, match.index) },
        });
      }
    }

    return issues;
  }
}
```

## 6. 安全配置

### 6.1 安全头配置

```typescript
// security/headers.ts

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: CSPConfig;
  hsts?: boolean;
  frameOptions?: 'deny' | 'sameorigin';
  contentTypeOptions?: boolean;
  referrerPolicy?: string;
}

export function securityHeaders(config: SecurityHeadersConfig) {
  const headers: Record<string, string> = {};

  // Content Security Policy
  if (config.contentSecurityPolicy) {
    const csp = buildCSP(config.contentSecurityPolicy);
    headers['Content-Security-Policy'] = csp;
  }

  // HSTS
  if (config.hsts) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }

  // X-Frame-Options
  if (config.frameOptions) {
    headers['X-Frame-Options'] = config.frameOptions === 'deny' ? 'DENY' : 'SAMEORIGIN';
  }

  // X-Content-Type-Options
  if (config.contentTypeOptions) {
    headers['X-Content-Type-Options'] = 'nosniff';
  }

  // Referrer-Policy
  if (config.referrerPolicy) {
    headers['Referrer-Policy'] = config.referrerPolicy;
  }

  return headers;
}

function buildCSP(config: CSPConfig): string {
  const directives: string[] = [];

  if (config.defaultSrc) directives.push(`default-src ${config.defaultSrc}`);
  if (config.scriptSrc) directives.push(`script-src ${config.scriptSrc}`);
  if (config.styleSrc) directives.push(`style-src ${config.styleSrc}`);
  if (config.imgSrc) directives.push(`img-src ${config.imgSrc}`);
  if (config.connectSrc) directives.push(`connect-src ${config.connectSrc}`);
  if (config.fontSrc) directives.push(`font-src ${config.fontSrc}`);

  return directives.join('; ');
}
```

### 6.2 Docker安全配置

```dockerfile
# 安全的Dockerfile示例
FROM node:20-alpine AS builder

# 使用非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# 只复制必要的文件
COPY package*.json ./
COPY tsconfig.json ./
COPY src/ ./src/

# 构建时使用最小权限
RUN npm ci --only=production && \
    npm run build && \
    chown -R nodejs:nodejs /app

FROM node:20-alpine

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 设置工作目录
WORKDIR /app

# 使用非root用户
USER nodejs

# 只复制构建产物
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# 只暴露必要端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/index.js"]
```

---

**版本**: 0.1.0
**更新日期**: 2026-04-14
**状态**: 设计阶段
