# 多租户架构设计

## 概述

本文档定义 ProjectFactory 系统的多租户架构，支持多个租户（组织/团队）在共享基础设施上安全隔离地运行，实现资源高效利用和独立运营。

## 1. 多租户架构概述

### 1.1 租户模型

```typescript
// src/tenant/tenant-model.ts
interface Tenant {
  id: string;
  name: string;
  slug: string;                    // URL 友好的标识符
  status: TenantStatus;
  plan: TenantPlan;

  // 联系信息
  contact: {
    email: string;
    phone?: string;
    billingEmail: string;
  };

  // 设置
  settings: TenantSettings;

  // 资源配额
  quotas: TenantQuotas;

  // 计费信息
  billing: {
    stripeCustomerId?: string;
    paymentMethod?: string;
    billingCycle: 'monthly' | 'annual';
  };

  // 时间戳
  createdAt: Date;
  updatedAt: Date;
  suspendedAt?: Date;
}

type TenantStatus = 'active' | 'suspended' | 'pending' | 'deleted';

interface TenantPlan {
  id: string;
  name: string;                     // 'free' | 'starter' | 'professional' | 'enterprise'
  tier: number;                     // 用于优先级排序

  // 特性开关
  features: {
    maxProjects: number;
    maxTeamMembers: number;
    concurrentBuilds: number;
    storageGB: number;
    apiRequestsPerMonth: number;
    advancedAnalytics: boolean;
    customBranding: boolean;
    ssoEnabled: boolean;
    prioritySupport: boolean;
  };
}

interface TenantSettings {
  timezone: string;
  locale: string;                   // i18n 语言
  defaultProjectVisibility: 'private' | 'internal' | 'public';

  // 安全设置
  security: {
    mfaRequired: boolean;
    sessionTimeoutMinutes: number;
    ipWhitelist?: string[];
    passwordMinLength: number;
  };

  // 通知设置
  notifications: {
    emailOnProjectComplete: boolean;
    emailOnQualityAlert: boolean;
    slackWebhookUrl?: string;
  };

  // 自定义品牌
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    customDomain?: string;
  };
}

interface TenantQuotas {
  used: {
    projects: number;
    teamMembers: number;
    storageBytes: number;
    apiRequestsThisMonth: number;
  };

  limits: {
    projects: number;
    teamMembers: number;
    storageBytes: number;
    apiRequestsPerMonth: number;
    concurrentBuilds: number;
  };
}
```

### 1.2 租户计划定义

```typescript
// src/tenant/plans.ts
const TenantPlans: Record<string, TenantPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    tier: 0,
    features: {
      maxProjects: 3,
      maxTeamMembers: 1,
      concurrentBuilds: 1,
      storageGB: 1,
      apiRequestsPerMonth: 1000,
      advancedAnalytics: false,
      customBranding: false,
      ssoEnabled: false,
      prioritySupport: false,
    },
  },

  starter: {
    id: 'starter',
    name: 'Starter',
    tier: 1,
    features: {
      maxProjects: 20,
      maxTeamMembers: 5,
      concurrentBuilds: 3,
      storageGB: 10,
      apiRequestsPerMonth: 50000,
      advancedAnalytics: false,
      customBranding: true,
      ssoEnabled: false,
      prioritySupport: false,
    },
  },

  professional: {
    id: 'professional',
    name: 'Professional',
    tier: 2,
    features: {
      maxProjects: 100,
      maxTeamMembers: 25,
      concurrentBuilds: 10,
      storageGB: 100,
      apiRequestsPerMonth: 500000,
      advancedAnalytics: true,
      customBranding: true,
      ssoEnabled: false,
      prioritySupport: true,
    },
  },

  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    tier: 3,
    features: {
      maxProjects: -1,               // 无限制
      maxTeamMembers: -1,
      concurrentBuilds: 50,
      storageGB: 1000,
      apiRequestsPerMonth: -1,
      advancedAnalytics: true,
      customBranding: true,
      ssoEnabled: true,
      prioritySupport: true,
    },
  },
};
```

## 2. 隔离策略

### 2.1 隔离级别

```
┌─────────────────────────────────────────────────────────────────┐
│                        隔离级别层级                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Level 0: 逻辑隔离（默认）                                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  同一数据库实例，使用 tenant_id 区分数据                      │ │
│  │  共享计算资源，性能可能受其他租户影响                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Level 1: Schema 隔离                                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  每个租户独立数据库 Schema                                    │ │
│  │  共享数据库实例，但表结构隔离                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Level 2: 数据库隔离                                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  每个租户独立数据库实例                                       │ │
│  │  完全隔离，资源独占                                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Level 3: 基础设施隔离                                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  租户独占计算/存储/网络资源                                   │ │
│  │  最高隔离级别，适合企业客户                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据隔离实现

```typescript
// src/tenant/data-isolation.ts

// 租户上下文
interface TenantContext {
  tenantId: string;
  plan: TenantPlan;
  quotas: TenantQuotas;
  settings: TenantSettings;
  userId?: string;
  userRole?: TenantRole;
}

type TenantRole = 'owner' | 'admin' | 'member' | 'viewer';

// 租户感知的数据访问层
class TenantAwareRepository<T> {
  private tenantContext: TenantContext;
  private baseQuery: QueryBuilder;

  constructor(tenantContext: TenantContext) {
    this.tenantContext = tenantContext;
    this.baseQuery = db.query(T.tableName).where('tenant_id', tenantContext.tenantId);
  }

  // 创建时自动注入 tenant_id
  async create(data: Omit<T, 'id' | 'tenant_id' | 'created_at'>): Promise<T> {
    const record = {
      ...data,
      tenant_id: this.tenantContext.tenantId,
      created_at: new Date(),
    };

    return this.baseQuery.insert(record).returning('*');
  }

  // 查询时自动添加租户过滤
  async findById(id: string): Promise<T | null> {
    return this.baseQuery
      .where('id', id)
      .first();
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<T[]> {
    let query = this.baseQuery;

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return query;
  }

  // 更新时验证租户所有权
  async update(id: string, data: Partial<T>): Promise<T> {
    const existing = await this.findById(id);

    if (!existing) {
      throw new NotFoundError('Resource');
    }

    return this.baseQuery
      .where('id', id)
      .update({
        ...data,
        updated_at: new Date(),
      })
      .returning('*');
  }

  // 删除时验证租户所有权
  async delete(id: string): Promise<void> {
    const existing = await this.findById(id);

    if (!existing) {
      throw new NotFoundError('Resource');
    }

    await this.baseQuery.where('id', id).delete();
  }
}

// 全局租户上下文
class TenantContextHolder {
  private static context: AsyncLocalStorage<TenantContext>;

  static setContext(context: TenantContext): void {
    this.context.enterWith(context);
  }

  static getContext(): TenantContext {
    const context = this.context.getStore();
    if (!context) {
      throw new Error('No tenant context available');
    }
    return context;
  }

  static runWithContext<T>(context: TenantContext, fn: () => Promise<T>): Promise<T> {
    return this.context.run(context, fn);
  }
}
```

### 2.3 中间件实现

```typescript
// src/tenant/tenant-middleware.ts

// 租户解析中间件
async function tenantResolutionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. 从 JWT 提取租户 ID
    const tokenTenantId = req.user?.tenantId;

    // 2. 从 Header 提取租户 ID（可选）
    const headerTenantId = req.headers['x-tenant-id'] as string;

    // 3. 从 URL 子域名提取租户（可选）
    const subdomainTenantId = extractSubdomain(req.headers.host || '');

    // 4. 确定最终租户 ID
    let tenantId = tokenTenantId || headerTenantId || subdomainTenantId;

    // 5. 如果是超级管理员，可以指定租户
    if (req.user?.isSuperAdmin && headerTenantId) {
      tenantId = headerTenantId;
    }

    if (!tenantId) {
      res.status(400).json({
        success: false,
        error: { code: 'TENANT_REQUIRED', message: 'Tenant ID is required' },
      });
      return;
    }

    // 6. 加载租户信息
    const tenant = await TenantService.getById(tenantId);

    if (!tenant) {
      res.status(404).json({
        success: false,
        error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' },
      });
      return;
    }

    if (tenant.status === 'suspended') {
      res.status(403).json({
        success: false,
        error: { code: 'TENANT_SUSPENDED', message: 'Tenant is suspended' },
      });
      return;
    }

    // 7. 设置租户上下文
    const context: TenantContext = {
      tenantId: tenant.id,
      plan: tenant.plan,
      quotas: tenant.quotas,
      settings: tenant.settings,
      userId: req.user?.id,
      userRole: req.user?.tenantRole,
    };

    TenantContextHolder.setContext(context);

    next();
  } catch (error) {
    next(error);
  }
}

// 租户资源校验中间件
function tenantResourceMiddleware(
  resourceType: 'project' | 'idea' | 'file'
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const context = TenantContextHolder.getContext();
    const resourceId = req.params.id;

    const resource = await ResourceService.getWithTenantCheck(
      resourceType,
      resourceId,
      context.tenantId
    );

    if (!resource) {
      res.status(404).json({
        success: false,
        error: { code: 'RESOURCE_NOT_FOUND', message: `${resourceType} not found` },
      });
      return;
    }

    (req as any).tenantResource = resource;
    next();
  };
}

// 配额检查中间件
function quotaCheckMiddleware(quotaType: keyof TenantQuotas['limits']): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const context = TenantContextHolder.getContext();
    const limit = context.quotas.limits[quotaType];
    const used = context.quotas.used[quotaType as keyof TenantQuotas['used']];

    if (limit !== -1 && used >= limit) {
      res.status(403).json({
        success: false,
        error: {
          code: 'QUOTA_EXCEEDED',
          message: `${quotaType} quota exceeded`,
          quota: { limit, used },
        },
      });
      return;
    }

    next();
  };
}
```

## 3. 租户管理

### 3.1 租户服务

```typescript
// src/tenant/tenant-service.ts
class TenantService {
  // 创建租户
  async create(data: {
    name: string;
    slug: string;
    contact: Tenant['contact'];
    planId?: string;
  }): Promise<Tenant> {
    // 验证 slug 唯一性
    const existing = await this.findBySlug(data.slug);
    if (existing) {
      throw new ConflictError('Tenant slug already exists');
    }

    const plan = TenantPlans[data.planId || 'free'];

    const tenant: Tenant = {
      id: generateId(),
      name: data.name,
      slug: data.slug,
      status: 'pending',
      plan,
      contact: data.contact,
      settings: this.getDefaultSettings(),
      quotas: {
        used: { projects: 0, teamMembers: 0, storageBytes: 0, apiRequestsThisMonth: 0 },
        limits: {
          projects: plan.features.maxProjects,
          teamMembers: plan.features.maxTeamMembers,
          storageBytes: plan.features.storageGB * 1024 * 1024 * 1024,
          apiRequestsPerMonth: plan.features.apiRequestsPerMonth,
          concurrentBuilds: plan.features.concurrentBuilds,
        },
      },
      billing: { billingCycle: 'monthly' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert('tenants').values(tenant);

    // 创建租户的默认资源
    await this.initializeTenantResources(tenant);

    return tenant;
  }

  // 升级/降级计划
  async changePlan(tenantId: string, newPlanId: string): Promise<Tenant> {
    const tenant = await this.getById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    const newPlan = TenantPlans[newPlanId];
    if (!newPlan) throw new ValidationError('Invalid plan ID');

    // 验证配额兼容性（降级时检查）
    if (newPlan.tier < tenant.plan.tier) {
      await this.validateDowngrade(tenant, newPlan);
    }

    // 更新计划
    tenant.plan = newPlan;
    tenant.quotas.limits = {
      projects: newPlan.features.maxProjects,
      teamMembers: newPlan.features.maxTeamMembers,
      storageBytes: newPlan.features.storageGB * 1024 * 1024 * 1024,
      apiRequestsPerMonth: newPlan.features.apiRequestsPerMonth,
      concurrentBuilds: newPlan.features.concurrentBuilds,
    };
    tenant.updatedAt = new Date();

    await db.update('tenants').set(tenant).where('id', tenantId);

    return tenant;
  }

  // 暂停租户
  async suspend(tenantId: string, reason: string): Promise<void> {
    const tenant = await this.getById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    tenant.status = 'suspended';
    tenant.suspendedAt = new Date();
    tenant.updatedAt = new Date();

    await db.update('tenants').set(tenant).where('id', tenantId);

    // 停止所有正在运行的任务
    await JobService.cancelAllForTenant(tenantId);

    // 通知租户管理员
    await NotificationService.sendEmail(
      tenant.contact.email,
      'account-suspended',
      { reason }
    );
  }

  // 恢复租户
  async reactivate(tenantId: string): Promise<Tenant> {
    const tenant = await this.getById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    tenant.status = 'active';
    tenant.suspendedAt = undefined;
    tenant.updatedAt = new Date();

    await db.update('tenants').set(tenant).where('id', tenantId);

    return tenant;
  }

  // 获取租户使用统计
  async getUsageStats(tenantId: string): Promise<TenantUsageStats> {
    const tenant = await this.getById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    const [projectCount, memberCount, storageUsage] = await Promise.all([
      db.query('projects').where('tenant_id', tenantId).count(),
      db.query('tenant_members').where('tenant_id', tenantId).count(),
      this.calculateStorageUsage(tenantId),
    ]);

    return {
      projects: { used: projectCount, limit: tenant.quotas.limits.projects },
      teamMembers: { used: memberCount, limit: tenant.quotas.limits.teamMembers },
      storage: { used: storageUsage, limit: tenant.quotas.limits.storageBytes },
      apiRequests: {
        used: tenant.quotas.used.apiRequestsThisMonth,
        limit: tenant.quotas.limits.apiRequestsPerMonth,
      },
    };
  }
}
```

### 3.2 租户成员管理

```typescript
// src/tenant/tenant-member-service.ts
interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  role: TenantRole;
  invitedBy: string;
  invitedAt: Date;
  joinedAt?: Date;
  status: 'invited' | 'active' | 'removed';
}

class TenantMemberService {
  // 邀请成员
  async invite(
    tenantId: string,
    email: string,
    role: TenantRole,
    invitedBy: string
  ): Promise<TenantMember> {
    const tenant = await TenantService.getById(tenantId);

    // 检查配额
    const currentMembers = await this.countMembers(tenantId);
    if (currentMembers >= tenant.quotas.limits.teamMembers) {
      throw new QuotaExceededError('teamMembers');
    }

    // 检查是否已是成员
    const existing = await this.findByEmail(tenantId, email);
    if (existing) {
      throw new ConflictError('User is already a member');
    }

    // 创建邀请
    const member: TenantMember = {
      id: generateId(),
      tenantId,
      userId: '', // 等待用户注册
      role,
      invitedBy,
      invitedAt: new Date(),
      status: 'invited',
    };

    await db.insert('tenant_members').values(member);

    // 发送邀请邮件
    await this.sendInviteEmail(member, email, tenant);

    return member;
  }

  // 接受邀请
  async acceptInvite(inviteToken: string, userId: string): Promise<void> {
    const invite = await this.findByToken(inviteToken);
    if (!invite || invite.status !== 'invited') {
      throw new InvalidTokenError('Invite');
    }

    // 检查租户状态
    const tenant = await TenantService.getById(invite.tenantId);
    if (tenant?.status !== 'active') {
      throw new Error('Tenant is not active');
    }

    // 更新成员记录
    await db.update('tenant_members')
      .set({
        userId,
        joinedAt: new Date(),
        status: 'active',
      })
      .where('id', invite.id);
  }

  // 更新成员角色
  async updateRole(memberId: string, newRole: TenantRole, updatedBy: string): Promise<void> {
    const member = await this.getById(memberId);

    // 验证权限
    const updater = await this.getById(updatedBy);
    if (updater.role !== 'owner' && updater.role !== 'admin') {
      throw new AuthorizationError('Only owners and admins can update roles');
    }

    // 不能修改 owner 角色
    if (member.role === 'owner') {
      throw new AuthorizationError('Cannot change owner role');
    }

    await db.update('tenant_members')
      .set({ role: newRole })
      .where('id', memberId);
  }

  // 移除成员
  async remove(memberId: string, removedBy: string): Promise<void> {
    const member = await this.getById(memberId);
    const remover = await this.getById(removedBy);

    // 验证权限
    if (remover.role !== 'owner' && remover.role !== 'admin') {
      throw new AuthorizationError('Only owners and admins can remove members');
    }

    // 不能移除 owner
    if (member.role === 'owner') {
      throw new AuthorizationError('Cannot remove owner');
    }

    // 不能移除自己
    if (member.userId === remover.userId) {
      throw new AuthorizationError('Cannot remove yourself');
    }

    await db.update('tenant_members')
      .set({ status: 'removed' })
      .where('id', memberId);
  }
}
```

## 4. 计费与配额

### 4.1 配额执行

```typescript
// src/tenant/quota-enforcement.ts

// 配额检查装饰器
function QuotaEnforced(quotaType: keyof TenantQuotas['limits']) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const context = TenantContextHolder.getContext();
      const limit = context.quotas.limits[quotaType];

      // -1 表示无限制
      if (limit === -1) {
        return originalMethod.apply(this, args);
      }

      const used = context.quotas.used[quotaType as keyof TenantQuotas['used']];

      if (used >= limit) {
        throw new QuotaExceededError(quotaType, limit, used);
      }

      // 执行操作
      const result = await originalMethod.apply(this, args);

      // 更新使用量
      await this.updateQuotaUsage(context.tenantId, quotaType);

      return result;
    };

    return descriptor;
  };
}

// API 速率限制
class TenantRateLimiter {
  private limiters: Map<string, RateLimiter> = new Map();

  getLimiter(tenantId: string): RateLimiter {
    let limiter = this.limiters.get(tenantId);

    if (!limiter) {
      limiter = new RateLimiter({
        windowMs: 60000,        // 1 分钟窗口
        max: this.getLimitForTenant(tenantId),
      });
      this.limiters.set(tenantId, limiter);
    }

    return limiter;
  }

  private getLimitForTenant(tenantId: string): number {
    const context = TenantContextHolder.getContext();
    const plan = context.plan;

    // 根据计划设置不同的速率限制
    switch (plan.id) {
      case 'free': return 60;     // 60 请求/分钟
      case 'starter': return 300; // 300 请求/分钟
      case 'professional': return 1000;
      case 'enterprise': return 5000;
      default: return 60;
    }
  }

  async checkLimit(tenantId: string): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const limiter = this.getLimiter(tenantId);
    return limiter.check(tenantId);
  }
}

// 资源配额检查
class ResourceQuotaChecker {
  async checkProjectQuota(tenantId: string): Promise<void> {
    const tenant = await TenantService.getById(tenantId);
    const projectCount = await ProjectService.countByTenant(tenantId);

    if (projectCount >= tenant.quotas.limits.projects) {
      throw new QuotaExceededError('projects', tenant.quotas.limits.projects, projectCount);
    }
  }

  async checkStorageQuota(tenantId: string, additionalBytes: number = 0): Promise<void> {
    const tenant = await TenantService.getById(tenantId);
    const currentUsage = await this.calculateStorageUsage(tenantId);

    if (currentUsage + additionalBytes > tenant.quotas.limits.storageBytes) {
      throw new QuotaExceededError('storage', tenant.quotas.limits.storageBytes, currentUsage);
    }
  }
}
```

### 4.2 使用量追踪

```typescript
// src/tenant/usage-tracker.ts
interface UsageRecord {
  tenantId: string;
  metric: string;
  value: number;
  period: 'daily' | 'monthly';
  timestamp: Date;
}

class UsageTracker {
  // 记录 API 使用
  async recordAPIRequest(tenantId: string): Promise<void> {
    await this.increment('api_requests', tenantId, 'monthly');
  }

  // 记录存储使用
  async recordStorageUsage(tenantId: string, bytes: number): Promise<void> {
    await this.set('storage_bytes', tenantId, bytes);
  }

  // 记录项目创建
  async recordProjectCreated(tenantId: string): Promise<void> {
    await this.increment('projects', tenantId, 'lifetime');
  }

  // 获取月度使用统计
  async getMonthlyUsage(tenantId: string): Promise<{
    apiRequests: number;
    storageBytes: number;
    projects: number;
  }> {
    const records = await db.query('usage_records')
      .where('tenant_id', tenantId)
      .where('period', 'monthly')
      .where('timestamp', '>=', this.getMonthStart());

    return {
      apiRequests: this.sum(records, 'api_requests'),
      storageBytes: this.sum(records, 'storage_bytes'),
      projects: this.sum(records, 'projects'),
    };
  }

  // 定期重置月度配额
  @Cron('0 0 * * *')  // 每天午夜
  async resetMonthlyQuotas(): Promise<void> {
    const tenants = await TenantService.getAllActive();

    for (const tenant of tenants) {
      tenant.quotas.used.apiRequestsThisMonth = 0;
      await db.update('tenants').set({
        quotas: tenant.quotas,
      }).where('id', tenant.id);
    }

    console.log(`Reset monthly quotas for ${tenants.length} tenants`);
  }

  // 生成使用报告
  async generateUsageReport(tenantId: string, period: { start: Date; end: Date }): Promise<UsageReport> {
    const records = await db.query('usage_records')
      .where('tenant_id', tenantId)
      .where('timestamp', '>=', period.start)
      .where('timestamp', '<=', period.end);

    return {
      tenantId,
      period,
      metrics: this.aggregateMetrics(records),
      trend: this.calculateTrend(records),
      forecast: this.forecastUsage(records),
    };
  }
}
```

## 5. 租户隔离的数据库策略

### 5.1 多租户数据库架构

```typescript
// src/tenant/database-strategy.ts

// 租户数据库策略
type DatabaseStrategy = 'shared' | 'schema' | 'database';

class TenantDatabaseManager {
  private strategy: DatabaseStrategy;
  private connectionPools: Map<string, Pool> = new Map();

  constructor(strategy: DatabaseStrategy = 'shared') {
    this.strategy = strategy;
  }

  // 获取租户的数据库连接
  async getConnection(tenantId: string): Promise<Pool> {
    switch (this.strategy) {
      case 'shared':
        return this.getSharedConnection();

      case 'schema':
        return this.getSchemaConnection(tenantId);

      case 'database':
        return this.getDedicatedConnection(tenantId);

      default:
        throw new Error(`Unknown database strategy: ${this.strategy}`);
    }
  }

  // Schema 隔离策略
  private async getSchemaConnection(tenantId: string): Promise<Pool> {
    const schemaName = `tenant_${tenantId}`;

    // 使用 Search Path 隔离
    const pool = this.connectionPools.get('shared')!;

    // 每个请求设置 Search Path
    await pool.query(`SET search_path TO ${schemaName}`);

    return pool;
  }

  // 独立数据库策略
  private async getDedicatedConnection(tenantId: string): Promise<Pool> {
    let pool = this.connectionPools.get(tenantId);

    if (!pool) {
      const tenantConfig = await this.getTenantDatabaseConfig(tenantId);

      pool = new Pool({
        host: tenantConfig.host,
        port: tenantConfig.port,
        database: tenantConfig.database,
        user: tenantConfig.user,
        password: tenantConfig.password,
        max: 10,
      });

      this.connectionPools.set(tenantId, pool);
    }

    return pool;
  }

  // 为企业客户创建独立数据库
  async createTenantDatabase(tenantId: string): Promise<void> {
    if (this.strategy !== 'database') return;

    const dbName = `projectfactory_${tenantId}`;

    // 创建数据库
    await db.query(`CREATE DATABASE ${dbName}`);

    // 运行初始化脚本
    await this.runMigrations(dbName);

    console.log(`Created dedicated database for tenant: ${tenantId}`);
  }

  // 删除租户数据库（当删除租户时）
  async deleteTenantDatabase(tenantId: string): Promise<void> {
    if (this.strategy !== 'database') return;

    const dbName = `projectfactory_${tenantId}`;
    await db.query(`DROP DATABASE ${dbName} WITH (FORCE)`);

    // 关闭连接池
    const pool = this.connectionPools.get(tenantId);
    if (pool) {
      await pool.end();
      this.connectionPools.delete(tenantId);
    }

    console.log(`Deleted dedicated database for tenant: ${tenantId}`);
  }
}
```

## 6. 租户安全

### 6.1 租户访问控制

```typescript
// src/tenant/tenant-access-control.ts

// 租户级权限检查
class TenantAccessControl {
  // 检查用户是否有权访问租户资源
  async canAccess(
    userId: string,
    tenantId: string,
    resourceType: string,
    action: 'read' | 'write' | 'delete'
  ): Promise<boolean> {
    const member = await TenantMemberService.getByUserAndTenant(userId, tenantId);

    if (!member || member.status !== 'active') {
      return false;
    }

    const permissions = this.getRolePermissions(member.role);

    return permissions[resourceType]?.includes(action) || false;
  }

  // 获取角色权限
  private getRolePermissions(role: TenantRole): Record<string, string[]> {
    const permissions: Record<TenantRole, Record<string, string[]>> = {
      owner: {
        '*': ['read', 'write', 'delete', 'admin'],
        billing: ['read', 'write'],
        members: ['read', 'write', 'delete'],
        settings: ['read', 'write'],
      },

      admin: {
        projects: ['read', 'write', 'delete'],
        ideas: ['read', 'write', 'delete'],
        files: ['read', 'write', 'delete'],
        members: ['read', 'write', 'delete'],
        settings: ['read'],
      },

      member: {
        projects: ['read', 'write'],
        ideas: ['read', 'write'],
        files: ['read', 'write'],
      },

      viewer: {
        projects: ['read'],
        ideas: ['read'],
        files: ['read'],
      },
    };

    return permissions[role];
  }

  // 资源级权限检查
  async checkResourcePermission(
    userId: string,
    resourceId: string,
    resourceType: string,
    action: string
  ): Promise<void> {
    const resource = await ResourceService.getById(resourceType, resourceId);

    if (!resource) {
      throw new NotFoundError('Resource');
    }

    const context = TenantContextHolder.getContext();

    // 验证资源属于当前租户
    if (resource.tenantId !== context.tenantId) {
      throw new AuthorizationError('Access denied');
    }

    // 检查权限
    const canAccess = await this.canAccess(
      context.userId!,
      context.tenantId,
      resourceType,
      action
    );

    if (!canAccess) {
      throw new AuthorizationError(`Cannot ${action} this ${resourceType}`);
    }
  }
}

// 资源所有权验证装饰器
function TenantOwned(resourceType: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const resourceId = args[0]; // 假设第一个参数是资源 ID
      const context = TenantContextHolder.getContext();

      const resource = await ResourceService.getById(resourceType, resourceId);

      if (!resource) {
        throw new NotFoundError('Resource');
      }

      if (resource.tenantId !== context.tenantId) {
        throw new AuthorizationError('Access denied');
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
```

---

**最后更新**: 2026-04-14
**版本**: v1.0
