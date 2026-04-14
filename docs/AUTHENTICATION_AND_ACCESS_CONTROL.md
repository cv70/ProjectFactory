# 用户认证与访问控制系统

## 概述

用户认证与访问控制（Authentication & Access Control）是ProjectFactory系统的基础安全组件，负责用户身份验证、权限管理和会话安全。系统需要支持多种认证方式、细粒度的RBAC/ABAC权限模型、多租户隔离、以及符合安全最佳实践的会话管理。

## 核心价值

- **安全认证**：支持多种认证协议，保障用户身份安全
- **细粒度授权**：基于RBAC/ABAC的权限模型
- **多租户隔离**：确保租户间的数据和权限隔离
- **会话安全**：安全的会话管理和Token机制
- **审计追溯**：完整的认证和访问审计日志

## 用户模型

### 用户类型

```typescript
// 用户角色枚举
enum UserRole {
  SUPER_ADMIN = 'super_admin',       // 超级管理员
  ORG_ADMIN = 'org_admin',           // 组织管理员
  TEAM_ADMIN = 'team_admin',         // 团队管理员
  DEVELOPER = 'developer',           // 开发者
  VIEWER = 'viewer',                 // 查看者
  GUEST = 'guest',                   // 访客
}

// 用户状态
enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification',
  DELETED = 'deleted',
}

// 用户模型
interface User {
  id: string;
  email: string;
  passwordHash?: string;           // 密码哈希（本地认证时）

  // 身份信息
  profile: {
    displayName: string;
    avatar?: string;
    bio?: string;
    phone?: string;
  };

  // 角色和租户
  role: UserRole;
  tenantId?: string;              // 所属租户

  // 认证方式
  authMethods: AuthMethod[];

  // 状态
  status: UserStatus;

  // 安全设置
  security: {
    mfaEnabled: boolean;
    mfaMethod?: 'totp' | 'sms' | 'email';
    passwordChangedAt?: Date;
    lastLoginAt?: Date;
    loginIpWhitelist?: string[];
  };

  // 配额
  quotas: UserQuota;

  // 时间戳
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

interface AuthMethod {
  type: 'email_password' | 'google' | 'github' | 'saml' | 'ldap';
  provider?: string;
  providerId?: string;             // 第三方ID
  linkedAt: Date;
  lastUsedAt?: Date;
}

interface UserQuota {
  projectsLimit: number;
  storageLimitGB: number;
  apiRequestsPerDay: number;
  concurrentGenerations: number;
}
```

### 租户模型

```typescript
// 租户类型
enum TenantType {
  INDIVIDUAL = 'individual',       // 个人
  TEAM = 'team',                   // 团队
  ORGANIZATION = 'organization',    // 组织
  ENTERPRISE = 'enterprise',       // 企业
}

// 租户模型
interface Tenant {
  id: string;
  slug: string;                   // URL友好标识符
  name: string;
  type: TenantType;

  // 联系信息
  contact: {
    email: string;
    phone?: string;
    address?: string;
  };

  // 设置
  settings: TenantSettings;

  // 配额
  quotas: TenantQuota;

  // 订阅
  subscription?: Subscription;

  // SSO配置
  sso?: SSOConfig;

  // 子域
  domain?: string;                // 自定义域名

  // Logo
  logo?: string;

  timestamps: {
    createdAt: Date;
    updatedAt: Date;
    suspendedAt?: Date;
  };
}

interface TenantSettings {
  defaultRole: UserRole;
  allowedAuthMethods: AuthMethod['type'][];
  mfaRequired: boolean;
  sessionTimeout: string;          // e.g., '24h'
  ipWhitelist?: string[];
  branding?: {
    primaryColor?: string;
    customCss?: string;
  };
}

interface TenantQuota {
  users: number;
  projects: number;
  storageGB: number;
  apiRequestsPerMonth: number;
  generationsPerMonth: number;
}

interface Subscription {
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'past_due' | 'canceled' | 'trial';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

interface SSOConfig {
  enabled: boolean;
  type: 'saml' | 'oidc';
  provider?: string;              // 'okta' | 'azure' | 'google'
  entryPoint?: string;
  certificate?: string;            // Base64编码的证书
  tenantIdAttribute?: string;      // SAML属性名
}
```

## 认证服务

### 认证流程

```typescript
// 认证请求
interface AuthRequest {
  method: AuthMethod['type'];
  email?: string;
  password?: string;
  providerToken?: string;          // OAuth token
  totpCode?: string;              // TOTP验证码
  samlResponse?: string;          // SAML响应

  // 上下文
  context: {
    ip: string;
    userAgent: string;
    timestamp: Date;
  };
}

// 认证响应
interface AuthResponse {
  success: boolean;
  user?: User;
  error?: AuthError;

  // Token（成功时）
  tokens?: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };

  // MFA（需要第二步）
  mfaRequired?: {
    method: 'totp' | 'sms' | 'email';
    challengeId: string;
  };
}

interface AuthError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// 认证服务
class AuthService {
  // 邮箱密码登录
  async loginWithEmail(
    email: string,
    password: string,
    context: AuthContext
  ): Promise<AuthResponse> {
    // 1. 查找用户
    const user = await this.userStore.findByEmail(email);
    if (!user) {
      return { success: false, error: { code: 'USER_NOT_FOUND', message: '用户不存在' } };
    }

    // 2. 验证密码
    const valid = await this.passwordService.verify(password, user.passwordHash);
    if (!valid) {
      await this.logFailedAttempt(user.id, context);
      return { success: false, error: { code: 'INVALID_PASSWORD', message: '密码错误' } };
    }

    // 3. 检查状态
    if (user.status !== UserStatus.ACTIVE) {
      return { success: false, error: { code: 'USER_INACTIVE', message: '账户未激活' } };
    }

    // 4. 检查MFA
    if (user.security.mfaEnabled) {
      const challenge = await this.mfaService.createChallenge(user.id);
      return {
        success: true,
        mfaRequired: { method: user.security.mfaMethod, challengeId: challenge.id },
      };
    }

    // 5. 生成Token
    return this.createAuthResponse(user, context);
  }

  // OAuth登录
  async loginWithOAuth(provider: string, token: string, context: AuthContext): Promise<AuthResponse> {
    // 1. 验证Provider Token
    const providerUser = await this.oauthService.verifyToken(provider, token);

    // 2. 查找或创建用户
    let user = await this.userStore.findByProvider(provider, providerUser.id);
    if (!user) {
      user = await this.createUserFromOAuth(provider, providerUser);
    }

    // 3. 生成Token
    return this.createAuthResponse(user, context);
  }

  // MFA验证
  async verifyMFA(challengeId: string, code: string, context: AuthContext): Promise<AuthResponse> {
    const challenge = await this.mfaService.getChallenge(challengeId);
    if (!challenge || challenge.expiresAt < new Date()) {
      return { success: false, error: { code: 'INVALID_CHALLENGE', message: '验证码已过期' } };
    }

    const user = await this.userStore.findById(challenge.userId);
    const valid = await this.mfaService.verifyCode(user, code);
    if (!valid) {
      return { success: false, error: { code: 'INVALID_MFA', message: '验证码错误' } };
    }

    return this.createAuthResponse(user, context);
  }
}
```

### Token管理

```typescript
// Token类型
enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh',
  API = 'api',
  INVITATION = 'invitation',
  PASSWORD_RESET = 'password_reset',
}

// Token模型
interface Token {
  id: string;
  type: TokenType;
  userId: string;
  tokenHash: string;              // 哈希存储

  // 范围
  scope?: string[];               // 权限范围

  // 有效期
  expiresAt: Date;
  issuedAt: Date;
  revokedAt?: Date;

  // 上下文
  context: {
    ip: string;
    userAgent: string;
  };
}

// Token服务
class TokenService {
  // 生成Access Token (JWT)
  generateAccessToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      type: TokenType.ACCESS,
      scope: this.getScopes(user),
    };

    return this.jwtService.sign(payload, {
      expiresIn: '15m',
      algorithm: 'RS256',
    });
  }

  // 生成Refresh Token
  async generateRefreshToken(user: User, context: TokenContext): Promise<Token> {
    const token: Token = {
      id: this.generateId(),
      type: TokenType.REFRESH,
      userId: user.id,
      tokenHash: await this.hashToken(), // 存储哈希而非原始值
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天
      issuedAt: new Date(),
      context: {
        ip: context.ip,
        userAgent: context.userAgent,
      },
    };

    await this.tokenStore.save(token);
    return token;
  }

  // 验证Access Token
  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      const payload = this.jwtService.verify(token, { algorithms: ['RS256'] });
      return payload;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new TokenExpiredError();
      }
      throw new InvalidTokenError();
    }
  }

  // 刷新Token
  async refreshTokens(refreshToken: string, context: TokenContext): Promise<AuthTokens> {
    // 1. 查找Token
    const token = await this.tokenStore.findByHash(await this.hashToken(refreshToken));
    if (!token || token.revokedAt) {
      throw new InvalidTokenError();
    }

    // 2. 检查过期
    if (token.expiresAt < new Date()) {
      throw new TokenExpiredError();
    }

    // 3. 撤销旧Token
    await this.tokenStore.revoke(token.id);

    // 4. 生成新Token
    const user = await this.userStore.findById(token.userId);
    return this.generateAllTokens(user, context);
  }

  // 撤销Token
  async revokeToken(tokenId: string): Promise<void> {
    await this.tokenStore.revoke(tokenId);
  }

  // 撤销用户所有Token
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.tokenStore.revokeAll(userId);
  }
}
```

## 授权模型

### RBAC权限

```typescript
// 权限定义
enum Permission {
  // 项目权限
  PROJECT_CREATE = 'project:create',
  PROJECT_READ = 'project:read',
  PROJECT_UPDATE = 'project:update',
  PROJECT_DELETE = 'project:delete',
  PROJECT_EXPORT = 'project:export',

  // 生成权限
  GENERATION_CREATE = 'generation:create',
  GENERATION_READ = 'generation:read',
  GENERATION_CANCEL = 'generation:cancel',

  // 模板权限
  TEMPLATE_CREATE = 'template:create',
  TEMPLATE_PUBLISH = 'template:publish',
  TEMPLATE_DELETE = 'template:delete',

  // 团队权限
  TEAM_CREATE = 'team:create',
  TEAM_MANAGE = 'team:manage',
  TEAM_INVITE = 'team:invite',
  TEAM_REMOVE = 'team:remove',

  // 租户权限
  TENANT_SETTINGS = 'tenant:settings',
  TENANT_BILLING = 'tenant:billing',
  TENANT_USERS = 'tenant:users',

  // 系统权限
  SYSTEM_VIEW = 'system:view',
  SYSTEM_CONFIG = 'system:config',
}

// 角色权限映射
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission),
  [UserRole.ORG_ADMIN]: [
    Permission.PROJECT_CREATE,
    Permission.PROJECT_READ,
    Permission.PROJECT_UPDATE,
    Permission.PROJECT_DELETE,
    Permission.GENERATION_CREATE,
    Permission.GENERATION_READ,
    Permission.GENERATION_CANCEL,
    Permission.TEMPLATE_CREATE,
    Permission.TEMPLATE_PUBLISH,
    Permission.TENANT_SETTINGS,
    Permission.TENANT_BILLING,
    Permission.TENANT_USERS,
  ],
  [UserRole.TEAM_ADMIN]: [
    Permission.PROJECT_CREATE,
    Permission.PROJECT_READ,
    Permission.PROJECT_UPDATE,
    Permission.PROJECT_DELETE,
    Permission.GENERATION_CREATE,
    Permission.GENERATION_READ,
    Permission.GENERATION_CANCEL,
    Permission.TEMPLATE_CREATE,
    Permission.TEAM_INVITE,
    Permission.TEAM_REMOVE,
  ],
  [UserRole.DEVELOPER]: [
    Permission.PROJECT_CREATE,
    Permission.PROJECT_READ,
    Permission.PROJECT_UPDATE,
    Permission.GENERATION_CREATE,
    Permission.GENERATION_READ,
  ],
  [UserRole.VIEWER]: [
    Permission.PROJECT_READ,
    Permission.GENERATION_READ,
  ],
  [UserRole.GUEST]: [],
};
```

### ABAC策略

```typescript
// 属性类型
type AttributeType = 'user' | 'resource' | 'environment' | 'action';

// 属性定义
interface Attribute {
  id: string;
  name: string;
  type: AttributeType;
  valueType: 'string' | 'number' | 'boolean' | 'array' | 'object';
}

// 属性上下文
interface Attributes {
  user: {
    id: string;
    role: UserRole;
    tenantId: string;
    quotas: UserQuota;
    tags?: string[];
  };
  resource: {
    id: string;
    type: string;
    ownerId: string;
    tenantId: string;
    sensitivity?: string;
    tags?: string[];
  };
  environment: {
    time: Date;
    ip: string;
    location?: string;
    deviceType?: string;
  };
  action: {
    type: string;
    method?: string;
  };
}

// ABAC策略
interface ABACPolicy {
  id: string;
  name: string;
  description: string;

  // 条件
  condition: PolicyCondition;

  // 效果
  effect: 'permit' | 'deny';

  // 优先级
  priority: number;

  enabled: boolean;
}

interface PolicyCondition {
  // 主体属性条件
  subject?: {
    role?: { equals?: UserRole; in?: UserRole[] };
    tags?: { containsAny?: string[] };
    quotas?: Record<string, { gte?: number; lte?: number }>;
  };

  // 资源属性条件
  resource?: {
    type?: { equals?: string; in?: string[] };
    ownerId?: { equals?: string };
    sensitivity?: { lte?: number };
    tags?: { containsAny?: string[] };
  };

  // 环境条件
  environment?: {
    time?: { between?: [Date, Date] };
    ip?: { in?: string[]; notIn?: string[] };
    location?: { equals?: string; in?: string[] };
  };
}

// 策略引擎
class PolicyEngine {
  // 评估访问请求
  async evaluate(request: AccessRequest): Promise<AccessDecision> {
    // 1. 获取所有适用策略
    const policies = await this.getApplicablePolicies(request);

    // 2. 按优先级排序
    policies.sort((a, b) => b.priority - a.priority);

    // 3. 评估策略
    for (const policy of policies) {
      if (await this.matchesCondition(policy.condition, request.attributes)) {
        return {
          decision: policy.effect,
          policyId: policy.id,
          reason: `Matched policy: ${policy.name}`,
        };
      }
    }

    // 4. 默认拒绝
    return { decision: 'deny', reason: 'No matching policy' };
  }

  // 批量检查权限
  async checkPermissions(
    userId: string,
    permissions: Permission[]
  ): Promise<Record<Permission, boolean>> {
    const results: Record<Permission, boolean> = {} as any;

    for (const permission of permissions) {
      const decision = await this.evaluate({
        subject: { id: userId },
        action: { type: permission },
        resource: {},
      });
      results[permission] = decision.decision === 'permit';
    }

    return results;
  }
}
```

## 会话管理

### 会话模型

```typescript
// 会话模型
interface Session {
  id: string;
  userId: string;

  // 认证信息
  authMethod: AuthMethod['type'];
  authenticatedAt: Date;

  // 安全上下文
  security: {
    ip: string;
    userAgent: string;
    deviceFingerprint?: string;
    mfaVerified: boolean;
  };

  // 状态
  status: 'active' | 'expired' | 'revoked';

  // 活跃度
  activity: {
    lastActiveAt: Date;
    lastActivity: string;
    activityCount: number;
  };

  // 过期
  expiresAt: Date;
  createdAt: Date;
}

// 会话服务
class SessionService {
  // 创建会话
  async createSession(user: User, context: SessionContext): Promise<Session> {
    // 1. 检查并发会话限制
    const activeSessions = await this.sessionStore.countActive(user.id);
    const maxSessions = this.getMaxSessions(user.role);

    if (activeSessions >= maxSessions) {
      // 撤销最早的会话
      await this.revokeOldestSession(user.id);
    }

    const session: Session = {
      id: this.generateId(),
      userId: user.id,
      authMethod: context.authMethod,
      authenticatedAt: new Date(),
      security: {
        ip: context.ip,
        userAgent: context.userAgent,
        deviceFingerprint: context.deviceFingerprint,
        mfaVerified: user.security.mfaEnabled ? false : true,
      },
      status: 'active',
      activity: {
        lastActiveAt: new Date(),
        lastActivity: 'session_created',
        activityCount: 1,
      },
      expiresAt: new Date(Date.now() + this.getSessionTimeout(user.role)),
      createdAt: new Date(),
    };

    await this.sessionStore.save(session);
    return session;
  }

  // 验证会话
  async validateSession(sessionId: string): Promise<Session | null> {
    const session = await this.sessionStore.findById(sessionId);
    if (!session) return null;

    if (session.status !== 'active') return null;
    if (session.expiresAt < new Date()) {
      await this.expireSession(sessionId);
      return null;
    }

    return session;
  }

  // 更新活跃度
  async updateActivity(sessionId: string, activity: string): Promise<void> {
    await this.sessionStore.update(sessionId, {
      activity: {
        lastActiveAt: new Date(),
        lastActivity: activity,
        $inc: { activityCount: 1 },
      },
    });
  }

  // 撤销会话
  async revokeSession(sessionId: string): Promise<void> {
    await this.sessionStore.update(sessionId, { status: 'revoked' });
  }

  // 撤销所有会话
  async revokeAllSessions(userId: string): Promise<void> {
    await this.sessionStore.revokeAll(userId);
  }
}
```

## 密码安全

### 密码策略

```typescript
// 密码策略
interface PasswordPolicy {
  minLength: number;                // 最小长度
  maxLength: number;               // 最大长度
  requireUppercase: boolean;       // 需要大写字母
  requireLowercase: boolean;       // 需要小写字母
  requireNumbers: boolean;          // 需要数字
  requireSpecialChars: boolean;     // 需要特殊字符
  disallowCommon: boolean;          // 禁止常见密码
  disallowUserInfo: boolean;        // 禁止包含用户信息
  maxAge?: number;                 // 最大使用天数
  historyCount?: number;           // 密码历史数量
}

// 预设密码策略
const PASSWORD_POLICIES: Record<TenantType, PasswordPolicy> = {
  [TenantType.ENTERPRISE]: {
    minLength: 16,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    disallowCommon: true,
    disallowUserInfo: true,
    maxAge: 90,
    historyCount: 12,
  },
  [TenantType.ORGANIZATION]: {
    minLength: 12,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    disallowCommon: true,
    disallowUserInfo: true,
    maxAge: 180,
    historyCount: 6,
  },
  [TenantType.TEAM]: {
    minLength: 10,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    disallowCommon: true,
    disallowUserInfo: true,
    maxAge: 365,
    historyCount: 3,
  },
  [TenantType.INDIVIDUAL]: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: false,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
    disallowCommon: true,
    disallowUserInfo: true,
    historyCount: 0,
  },
};

// 密码哈希服务
class PasswordService {
  // 哈希密码
  async hash(password: string): Promise<string> {
    // 使用 Argon2id 算法
    return this.argon2.hash(password, {
      type: argon2id,
      memoryCost: 65536, // 64MB
      timeCost: 3,
      parallelism: 4,
    });
  }

  // 验证密码
  async verify(password: string, hash: string): Promise<boolean> {
    try {
      return await this.argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  // 检查密码强度
  checkStrength(password: string): PasswordStrength {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    const score = Object.values(checks).filter(Boolean).length;

    return {
      score: (score / 5) * 100,
      level: score < 3 ? 'weak' : score < 5 ? 'medium' : 'strong',
      checks,
    };
  }
}
```

## MFA认证

### MFA服务

```typescript
// MFA服务
class MFAService {
  // 生成TOTP密钥
  async generateTOTPSecret(userId: string): Promise<TOTPSecret> {
    const secret = speakeasy.generateSecret({
      name: `ProjectFactory:${userId}`,
      length: 20,
    });

    const backupCodes = this.generateBackupCodes();

    await this.mfaStore.save({
      userId,
      type: 'totp',
      secret: secret.base32,
      backupCodes: await this.hashBackupCodes(backupCodes),
      createdAt: new Date(),
    });

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      backupCodes,
    };
  }

  // 验证TOTP
  async verifyTOTP(userId: string, code: string): Promise<boolean> {
    const mfa = await this.mfaStore.findByUserId(userId);
    if (!mfa || mfa.type !== 'totp') return false;

    const valid = speakeasy.totp.verify({
      secret: mfa.secret,
      encoding: 'base32',
      token: code,
      window: 1,  // 允许1个时间步的误差
    });

    if (valid) {
      await this.mfaStore.updateLastUsed(userId);
    }

    return valid;
  }

  // 验证备份码
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const mfa = await this.mfaStore.findByUserId(userId);
    if (!mfa) return false;

    const hashedCode = await this.hash(code);
    const index = mfa.backupCodes.indexOf(hashedCode);

    if (index === -1) return false;

    // 使用后移除
    mfa.backupCodes.splice(index, 1);
    await this.mfaStore.update(userId, { backupCodes: mfa.backupCodes });

    return true;
  }
}
```

## 审计日志

### 审计事件

```typescript
// 审计事件类型
enum AuditEventType {
  // 认证事件
  AUTH_LOGIN_SUCCESS = 'auth:login:success',
  AUTH_LOGIN_FAILURE = 'auth:login:failure',
  AUTH_LOGOUT = 'auth:logout',
  AUTH_MFA_ENABLED = 'auth:mfa:enabled',
  AUTH_MFA_DISABLED = 'auth:mfa:disabled',
  AUTH_PASSWORD_CHANGED = 'auth:password:changed',
  AUTH_PASSWORD_RESET_REQUESTED = 'auth:password:reset:requested',
  AUTH_PASSWORD_RESET_COMPLETED = 'auth:password:reset:completed',
  AUTH_TOKEN_REFRESHED = 'auth:token:refreshed',
  AUTH_TOKEN_REVOKED = 'auth:token:revoked',

  // 授权事件
  AUTHZ_ACCESS_GRANTED = 'authz:access:granted',
  AUTHZ_ACCESS_DENIED = 'authz:access:denied',

  // 用户管理事件
  USER_CREATED = 'user:created',
  USER_UPDATED = 'user:updated',
  USER_DELETED = 'user:deleted',
  USER_ROLE_CHANGED = 'user:role:changed',
  USER_SUSPENDED = 'user:suspended',
  USER_ACTIVATED = 'user:activated',

  // 租户事件
  TENANT_CREATED = 'tenant:created',
  TENANT_SETTINGS_CHANGED = 'tenant:settings:changed',
  TENANT_SUBSCRIPTION_CHANGED = 'tenant:subscription:changed',
}

// 审计日志条目
interface AuditLog {
  id: string;
  eventType: AuditEventType;

  // 参与者
  actor: {
    userId?: string;
    role?: UserRole;
    ip: string;
    userAgent: string;
  };

  // 目标
  target?: {
    type: 'user' | 'tenant' | 'project' | 'session';
    id: string;
    attributes?: Record<string, any>;
  };

  // 结果
  result: {
    success: boolean;
    errorCode?: string;
    errorMessage?: string;
  };

  // 变更详情
  changes?: {
    field: string;
    oldValue?: any;
    newValue?: any;
  }[];

  // 元数据
  metadata?: Record<string, any>;

  timestamp: Date;
}

// 审计服务
class AuditService {
  // 记录事件
  async log(event: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    const entry: AuditLog = {
      ...event,
      id: this.generateId(),
      timestamp: new Date(),
    };

    await this.auditStore.save(entry);

    // 异步通知（不阻塞）
    this.notifySubscribers(entry).catch(console.error);
  }

  // 查询审计日志
  async query(query: AuditQuery): Promise<AuditResult> {
    return this.auditStore.query(query);
  }

  // 导出审计报告
  async exportReport(
    startDate: Date,
    endDate: Date,
    filters?: AuditFilters
  ): Promise<AuditReport> {
    const logs = await this.auditStore.query({
      startDate,
      endDate,
      ...filters,
      limit: 100000,
    });

    return {
      period: { start: startDate, end: endDate },
      summary: this.generateSummary(logs),
      charts: this.generateCharts(logs),
      details: logs,
    };
  }
}
```

## 配置示例

```yaml
# 认证与访问控制配置
authentication:
  # Session配置
  session:
    timeout: "24h"
    max_concurrent: 5
    remember_me_duration: "30d"

  # Token配置
  token:
    access_token_ttl: "15m"
    refresh_token_ttl: "30d"
    api_key_ttl: "1y"
    algorithm: "RS256"

  # 密码策略
  password_policy:
    min_length: 12
    max_length: 128
    require_uppercase: true
    require_lowercase: true
    require_numbers: true
    require_special_chars: true
    disallow_common: true
    disallow_user_info: true
    history_count: 6

  # MFA配置
  mfa:
    required_for_roles: ["super_admin", "org_admin"]
    allowed_methods: ["totp", "email"]
    totp_issuer: "ProjectFactory"
    backup_codes_count: 10

  # OAuth配置
  oauth:
    providers:
      google:
        enabled: true
        client_id: "${GOOGLE_CLIENT_ID}"
        client_secret: "${GOOGLE_CLIENT_SECRET}"
      github:
        enabled: true
        client_id: "${GITHUB_CLIENT_ID}"
        client_secret: "${GITHUB_CLIENT_SECRET}"

  # SSO配置
  sso:
    enabled: false
    default_provider: "okta"
    jit_provisioning: true

  # 审计配置
  audit:
    enabled: true
    log_level: "info"
    retention_days: 365
    export_formats: ["json", "csv"]
```

---

**最后更新**: 2026-04-14
