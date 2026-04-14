# 审计日志与合规设计

## 概述

本文档定义 ProjectFactory 系统的审计日志（Audit Log）与合规（Compliance）架构，支持操作追踪、安全分析、合规报告和事件溯源，满足 SOC 2、GDPR 等合规要求。

## 1. 审计日志架构

### 1.1 审计事件模型

```typescript
// src/audit/audit-event-model.ts

interface AuditEvent {
  // 事件标识
  id: string;
  eventId: string;                    // 幂等标识（用于去重）
  eventType: AuditEventType;
  eventVersion: string;                // 事件格式版本

  // 时间戳
  timestamp: Date;
  timezone: string;

  // 执行者信息
  actor: {
    id: string;
    type: 'user' | 'system' | 'api-key' | 'service';
    name?: string;
    email?: string;
    ipAddress?: string;
    userAgent?: string;
    tenantId?: string;                 // 多租户支持
  };

  // 目标资源
  target: {
    id: string;
    type: string;
    name?: string;
    metadata?: Record<string, unknown>;
  };

  // 操作详情
  action: {
    type: 'create' | 'read' | 'update' | 'delete' | 'execute' | 'login' | 'logout';
    status: 'success' | 'failure' | 'partial';
    changes?: FieldChange[];          // 字段变更明细
  };

  // 上下文
  context: {
    service: string;
    serviceVersion: string;
    environment: 'development' | 'staging' | 'production';
    region?: string;
    requestId?: string;
    correlationId?: string;           // 用于追踪跨服务调用
  };

  // 额外数据
  metadata?: Record<string, unknown>;

  // 合规字段
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
  retentionDays?: number;             // 保留天数
}

type AuditEventType =
  // 认证事件
  | 'auth.login'
  | 'auth.logout'
  | 'auth.login_failed'
  | 'auth.token_refresh'
  | 'auth.mfa_enabled'
  | 'auth.mfa_disabled'
  | 'auth.password_changed'
  | 'auth.password_reset'

  // 用户管理事件
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.role_changed'

  // 租户事件
  | 'tenant.created'
  | 'tenant.plan_changed'
  | 'tenant.suspended'
  | 'tenant.reactivated'

  // 项目事件
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'project.exported'
  | 'project.archived'

  // 资源配置事件
  | 'config.created'
  | 'config.updated'
  | 'config.deleted'
  | 'config.secret_accessed'          // 敏感操作

  // 访问控制事件
  | 'permission.granted'
  | 'permission.revoked'
  | 'access.denied'

  // 财务事件
  | 'billing.invoice_created'
  | 'billing.payment_succeeded'
  | 'billing.payment_failed'
  | 'quota.exceeded'
  | 'quota.warning';

interface FieldChange {
  field: string;
  oldValue?: unknown;
  newValue?: unknown;
  displayOld?: string;               // 用于敏感值的显示
  displayNew?: string;
}
```

### 1.2 审计日志存储

```typescript
// src/audit/audit-storage.ts

// 审计日志存储策略
class AuditStorage {
  // 分层存储
  private hotStorage: Storage;        // SSD，用于近期数据
  private warmStorage: Storage;       // HDD，用于中期数据
  private coldStorage: Storage;       // S3/Glacier，用于归档数据

  // 存储策略
  private retentionPolicy: Map<string, number> = new Map([
    ['auth.login', 365],
    ['auth.*', 365],
    ['user.*', 365],
    ['tenant.*', 365],
    ['project.*', 180],
    ['config.*', 365],
    ['permission.*', 365],
    ['billing.*', 2555],             // 7年，财务记录
    ['default', 90],
  ]);

  // 写入审计事件
  async write(event: AuditEvent): Promise<void> {
    // 1. 确定保留期限
    const retentionDays = this.getRetentionDays(event.eventType);

    // 2. 追加合规字段
    const enrichedEvent = {
      ...event,
      retentionDays,
      dataClassification: this.classifyData(event),
      storedAt: new Date(),
    };

    // 3. 写入热存储（实时）
    await this.hotStorage.append(enrichedEvent);

    // 4. 异步写入冷存储（用于合规归档）
    this.scheduleColdArchive(event);
  }

  // 查询审计日志
  async query(options: AuditQueryOptions): Promise<AuditResult> {
    const { filters, pagination, timeRange, sort } = options;

    // 时间范围决定查询哪个存储层
    const now = Date.now();
    const timeRangeDays = (now - timeRange.start.getTime()) / (1000 * 60 * 60 * 24);

    let results: AuditEvent[] = [];

    if (timeRangeDays <= 30) {
      // 查询热存储
      results = await this.hotStorage.query(filters, timeRange, pagination);
    } else if (timeRangeDays <= 90) {
      // 查询热存储 + 暖存储
      const [hot, warm] = await Promise.all([
        this.hotStorage.query(filters, timeRange, pagination),
        this.warmStorage.query(filters, timeRange, pagination),
      ]);
      results = [...hot, ...warm];
    } else {
      // 需要查询冷存储（异步）
      results = await this.coldStorage.query(filters, timeRange, pagination);
    }

    return {
      events: results,
      total: results.length,
      hasMore: results.length === pagination.limit,
    };
  }

  // 获取特定资源的完整变更历史
  async getResourceHistory(
    resourceType: string,
    resourceId: string,
    options?: { limit?: number; timeRange?: TimeRange }
  ): Promise<AuditEvent[]> {
    const events = await this.query({
      filters: [
        { field: 'target.type', operator: 'eq', value: resourceType },
        { field: 'target.id', operator: 'eq', value: resourceId },
      ],
      timeRange: options?.timeRange || { start: new Date(0), end: new Date() },
      pagination: { limit: options?.limit || 100, offset: 0 },
      sort: { field: 'timestamp', order: 'desc' },
    });

    return events.events;
  }

  // 获取用户的所有操作
  async getActorActivity(
    actorId: string,
    options?: { limit?: number; eventTypes?: string[] }
  ): Promise<AuditEvent[]> {
    const filters = [
      { field: 'actor.id', operator: 'eq', value: actorId },
    ];

    if (options?.eventTypes) {
      filters.push({ field: 'eventType', operator: 'in', value: options.eventTypes });
    }

    const events = await this.query({
      filters,
      timeRange: { start: new Date(0), end: new Date() },
      pagination: { limit: options?.limit || 100, offset: 0 },
      sort: { field: 'timestamp', order: 'desc' },
    });

    return events.events;
  }

  private getRetentionDays(eventType: string): number {
    // 精确匹配
    if (this.retentionPolicy.has(eventType)) {
      return this.retentionPolicy.get(eventType)!;
    }

    // 通配符匹配
    for (const [pattern, days] of this.retentionPolicy) {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        if (regex.test(eventType)) {
          return days;
        }
      }
    }

    return this.retentionPolicy.get('default')!;
  }

  private classifyData(event: AuditEvent): AuditEvent['dataClassification'] {
    // 根据事件类型分类
    if (event.eventType.startsWith('auth.')) return 'confidential';
    if (event.eventType.startsWith('billing.')) return 'restricted';
    if (event.eventType.startsWith('config.')) return 'confidential';
    if (event.eventType.includes('secret')) return 'restricted';
    return 'internal';
  }
}

interface AuditQueryOptions {
  filters: AuditFilter[];
  timeRange: TimeRange;
  pagination: { limit: number; offset: number };
  sort?: { field: string; order: 'asc' | 'desc' };
}

interface TimeRange {
  start: Date;
  end: Date;
}

interface AuditFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: unknown;
}
```

## 2. 审计收集器

### 2.1 自动审计中间件

```typescript
// src/audit/audit-collector.ts

// 审计收集器
class AuditCollector {
  private eventQueue: AuditEvent[] = [];
  private flushIntervalMs: number = 1000;
  private maxBatchSize: number = 100;

  constructor(private storage: AuditStorage) {
    // 定期刷新事件
    setInterval(() => this.flush(), this.flushIntervalMs);
  }

  // 收集事件
  async collect(event: AuditEvent): Promise<void> {
    // 添加基础字段
    const enrichedEvent: AuditEvent = {
      ...event,
      eventId: event.eventId || generateId(),
      eventVersion: '1.0',
      timestamp: event.timestamp || new Date(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    // 验证事件
    this.validate(enrichedEvent);

    // 加入队列
    this.eventQueue.push(enrichedEvent);

    // 检查是否需要立即刷新
    if (this.eventQueue.length >= this.maxBatchSize) {
      await this.flush();
    }
  }

  // HTTP 请求审计中间件
  httpAuditMiddleware(): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      const requestId = req.headers['x-request-id'] as string || generateId();

      // 记录开始时间
      const startTime = Date.now();

      // 监听响应完成
      res.on('finish', () => {
        const duration = Date.now() - startTime;

        // 只审计 API 请求
        if (req.path.startsWith('/api/')) {
          this.collect({
            id: generateId(),
            eventId: requestId,
            eventType: this.inferEventType(req.method, req.path),
            timestamp: new Date(),
            actor: {
              id: req.user?.id || 'anonymous',
              type: req.user ? 'user' : 'api-key',
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
              tenantId: req.headers['x-tenant-id'] as string,
            },
            target: {
              id: this.extractResourceId(req.path),
              type: this.extractResourceType(req.path),
            },
            action: {
              type: this.methodToAction(req.method),
              status: res.statusCode < 400 ? 'success' : 'failure',
            },
            context: {
              service: 'api-gateway',
              serviceVersion: process.env.APP_VERSION || 'unknown',
              environment: process.env.NODE_ENV as any || 'development',
              requestId,
              correlationId: req.headers['x-correlation-id'] as string,
            },
            metadata: {
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
              duration,
              queryParams: Object.keys(req.query).length,
              bodyParams: Object.keys(req.body || {}).length,
            },
          });
        }
      });

      next();
    };
  }

  // 自动审计装饰器
  audit(eventType: string) {
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const collector = (global as any).auditCollector;

        // 执行前的快照
        const beforeSnapshot = await collector.captureSnapshot?.(args);

        try {
          const result = await originalMethod.apply(this, args);

          // 收集成功事件
          await collector.collect({
            id: generateId(),
            eventId: generateId(),
            eventType,
            timestamp: new Date(),
            actor: getCurrentActor(),
            target: extractTargetFromArgs(args),
            action: { type: 'execute', status: 'success' },
            context: getCurrentContext(),
            metadata: { args: sanitizeArgs(args), result: 'success' },
          });

          return result;
        } catch (error) {
          // 收集失败事件
          await collector.collect({
            id: generateId(),
            eventId: generateId(),
            eventType: `${eventType}.failed`,
            timestamp: new Date(),
            actor: getCurrentActor(),
            target: extractTargetFromArgs(args),
            action: { type: 'execute', status: 'failure' },
            context: getCurrentContext(),
            metadata: { error: (error as Error).message },
          });

          throw error;
        }
      };

      return descriptor;
    };
  }

  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = this.eventQueue.splice(0, this.eventQueue.length);

    try {
      await Promise.all(events.map(e => this.storage.write(e)));
    } catch (error) {
      console.error('Failed to flush audit events:', error);
      // 保留失败的事件以便重试
      this.eventQueue.unshift(...events);
    }
  }

  private validate(event: AuditEvent): void {
    if (!event.eventType) throw new Error('eventType is required');
    if (!event.actor?.id) throw new Error('actor.id is required');
  }

  private methodToAction(method: string): AuditEvent['action']['type'] {
    const mapping: Record<string, AuditEvent['action']['type']> = {
      GET: 'read',
      POST: 'create',
      PUT: 'update',
      PATCH: 'update',
      DELETE: 'delete',
    };
    return mapping[method] || 'execute';
  }
}
```

### 2.2 敏感操作审计

```typescript
// src/audit/sensitive-operations.ts

// 敏感操作定义
const SensitiveOperations: Record<string, {
  eventType: string;
  requireApproval: boolean;
  alertOnAccess: boolean;
  additionalFields: string[];
}> = {
  'config.secret_accessed': {
    eventType: 'config.secret_accessed',
    requireApproval: true,
    alertOnAccess: true,
    additionalFields: ['config.key', 'accessReason'],
  },
  'user.delete': {
    eventType: 'user.deleted',
    requireApproval: true,
    alertOnAccess: true,
    additionalFields: ['user.email', 'deletionReason'],
  },
  'tenant.suspended': {
    eventType: 'tenant.suspended',
    requireApproval: true,
    alertOnAccess: true,
    additionalFields: ['suspensionReason'],
  },
  'permission.granted': {
    eventType: 'permission.granted',
    requireApproval: false,
    alertOnAccess: false,
    additionalFields: ['permission.role', 'granteeId'],
  },
  'access.denied': {
    eventType: 'access.denied',
    requireApproval: false,
    alertOnAccess: true,
    additionalFields: ['accessReason', 'requiredPermission'],
  },
};

// 敏感操作审计包装
async function auditSensitiveOperation<T>(
  operation: () => Promise<T>,
  config: {
    eventType: string;
    targetId: string;
    targetType: string;
    reason?: string;
    additionalData?: Record<string, unknown>;
  }
): Promise<T> {
  const collector = (global as any).auditCollector as AuditCollector;

  // 记录访问
  await collector.collect({
    id: generateId(),
    eventId: generateId(),
    eventType: config.eventType,
    timestamp: new Date(),
    actor: getCurrentActor(),
    target: {
      id: config.targetId,
      type: config.targetType,
    },
    action: { type: 'read', status: 'success' },
    context: getCurrentContext(),
    metadata: {
      reason: config.reason,
      ...config.additionalData,
    },
  });

  // 如果需要告警
  const sensitiveConfig = SensitiveOperations[config.eventType];
  if (sensitiveConfig?.alertOnAccess) {
    await sendSecurityAlert({
      type: 'sensitive_access',
      eventType: config.eventType,
      actor: getCurrentActor(),
      target: { id: config.targetId, type: config.targetType },
      timestamp: new Date(),
    });
  }

  return operation();
}

// 访问 Secret 时的审计
async function auditSecretAccess(
  secretKey: string,
  accessReason: string
): Promise<string> {
  const collector = (global as any).auditCollector;

  await collector.collect({
    id: generateId(),
    eventId: generateId(),
    eventType: 'config.secret_accessed',
    timestamp: new Date(),
    actor: getCurrentActor(),
    target: {
      id: secretKey,
      type: 'secret',
    },
    action: { type: 'read', status: 'success' },
    context: getCurrentContext(),
    metadata: {
      accessReason,
      maskedKey: maskSecretKey(secretKey),
    },
    dataClassification: 'restricted',
  });

  // 返回实际的 secret 值（此处简化）
  return secretManager.getSecret(secretKey);
}
```

## 3. 合规报告

### 3.1 合规框架

```typescript
// src/audit/compliance-frameworks.ts

// 支持的合规框架
type ComplianceFramework = 'SOC2' | 'GDPR' | 'HIPAA' | 'ISO27001' | 'PCI-DSS';

interface ComplianceRequirement {
  framework: ComplianceFramework;
  controlId: string;
  controlName: string;
  description: string;
  auditFrequency: 'continuous' | 'monthly' | 'quarterly' | 'annually';
  evidenceRequirements: string[];
}

// 合规控制定义
const ComplianceControls: ComplianceRequirement[] = [
  // SOC 2 - 安全
  {
    framework: 'SOC2',
    controlId: 'CC6.1',
    controlName: 'Logical and Physical Access Controls',
    description: '限制对系统和数据的访问',
    auditFrequency: 'continuous',
    evidenceRequirements: [
      'access_logs',
      'user_authentication_events',
      'permission_change_logs',
    ],
  },
  {
    framework: 'SOC2',
    controlId: 'CC6.6',
    controlName: 'Security for Confidential Information',
    description: '保护机密信息的机密性',
    auditFrequency: 'monthly',
    evidenceRequirements: [
      'encryption_key_rotation_logs',
      'data_classification_logs',
      'confidential_access_logs',
    ],
  },

  // GDPR - 数据保护
  {
    framework: 'GDPR',
    controlId: 'Art.30',
    controlName: 'Records of Processing Activities',
    description: '维护处理活动记录',
    auditFrequency: 'continuous',
    evidenceRequirements: [
      'data_processing_logs',
      'consent_records',
      'data_subject_requests',
    ],
  },
  {
    framework: 'GDPR',
    controlId: 'Art.33',
    controlName: 'Notification of Data Breaches',
    description: '数据泄露通知',
    auditFrequency: 'continuous',
    evidenceRequirements: [
      'security_incident_logs',
      'breach_notification_records',
    ],
  },
];
```

### 3.2 合规报告生成

```typescript
// src/audit/compliance-reporter.ts

interface ComplianceReport {
  id: string;
  framework: ComplianceFramework;
  period: { start: Date; end: Date };
  generatedAt: Date;
  generatedBy: string;

  // 控制合规状态
  controls: ControlCompliance[];

  // 证据摘要
  evidence: EvidenceSummary[];

  // 异常事件
  exceptions: Exception[];

  // 总体评估
  overallStatus: 'compliant' | 'partially_compliant' | 'non_compliant';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  // 签章
  signedBy?: string;
  signedAt?: Date;
}

interface ControlCompliance {
  controlId: string;
  controlName: string;
  status: 'compliant' | 'non_compliant' | 'not_applicable' | 'needs_attention';
  lastAuditDate: Date;
  evidenceStatus: 'sufficient' | 'insufficient' | 'missing';
  findings: string[];
  remediationPlan?: string;
}

interface EvidenceSummary {
  requirement: string;
  evidenceType: string;
  coverage: number;  // 0-100%
  gaps: string[];
}

interface Exception {
  eventId: string;
  timestamp: Date;
  description: string;
  severity: 'low' | 'medium' | 'high';
  resolved: boolean;
  resolution?: string;
}

class ComplianceReporter {
  private auditStorage: AuditStorage;
  private controls: ComplianceRequirement[];

  // 生成合规报告
  async generateReport(
    framework: ComplianceFramework,
    period: { start: Date; end: Date },
    generatedBy: string
  ): Promise<ComplianceReport> {
    const controls = this.getControlsForFramework(framework);

    // 评估每个控制
    const controlCompliance = await Promise.all(
      controls.map(c => this.assessControl(c, period))
    );

    // 收集证据
    const evidence = await this.collectEvidence(framework, period);

    // 识别异常
    const exceptions = await this.identifyExceptions(period);

    // 计算总体状态
    const overallStatus = this.calculateOverallStatus(controlCompliance);
    const riskLevel = this.calculateRiskLevel(controlCompliance, exceptions);

    const report: ComplianceReport = {
      id: generateId(),
      framework,
      period,
      generatedAt: new Date(),
      generatedBy,
      controls: controlCompliance,
      evidence,
      exceptions,
      overallStatus,
      riskLevel,
    };

    return report;
  }

  // 评估单个控制
  private async assessControl(
    control: ComplianceRequirement,
    period: { start: Date; end: Date }
  ): Promise<ControlCompliance> {
    const evidence = await this.auditStorage.query({
      filters: [
        {
          field: 'eventType',
          operator: 'in',
          value: control.evidenceRequirements,
        },
      ],
      timeRange: period,
      pagination: { limit: 10000, offset: 0 },
    });

    // 检查证据覆盖
    const coverage = this.calculateCoverage(evidence.events, control.evidenceRequirements);

    // 检查是否有异常
    const findings = this.analyzeFindings(evidence.events, control);

    return {
      controlId: control.controlId,
      controlName: control.controlName,
      status: findings.length === 0 ? 'compliant' : findings.some(f => f.severity === 'high') ? 'non_compliant' : 'needs_attention',
      lastAuditDate: new Date(),
      evidenceStatus: coverage >= 95 ? 'sufficient' : coverage >= 70 ? 'insufficient' : 'missing',
      findings: findings.map(f => f.description),
    };
  }

  // 用户活动报告（用于内部审计）
  async generateUserActivityReport(
    userId: string,
    period: { start: Date; end: Date }
  ): Promise<{
    summary: {
      totalActions: number;
      actionsByType: Record<string, number>;
      actionsByStatus: Record<string, number>;
      lastActivity: Date;
    };
    timeline: AuditEvent[];
    riskIndicators: string[];
  }> {
    const events = await this.auditStorage.getActorActivity(userId, {
      limit: 10000,
    });

    const filteredEvents = events.filter(e =>
      e.timestamp >= period.start && e.timestamp <= period.end
    );

    // 统计
    const actionsByType: Record<string, number> = {};
    const actionsByStatus: Record<string, number> = {};

    for (const event of filteredEvents) {
      actionsByType[event.eventType] = (actionsByType[event.eventType] || 0) + 1;
      actionsByStatus[event.action.status] = (actionsByStatus[event.action.status] || 0) + 1;
    }

    // 风险指标
    const riskIndicators: string[] = [];

    if (actionsByStatus['failure'] > 10) {
      riskIndicators.push('High number of failed operations');
    }

    if (actionsByType['access.denied'] > 5) {
      riskIndicators.push('Multiple access denied events');
    }

    const suspiciousEvents = filteredEvents.filter(e =>
      e.eventType.includes('failed') ||
      e.eventType.includes('denied') ||
      e.action.status === 'failure'
    );

    if (suspiciousEvents.length > 0) {
      riskIndicators.push(`Found ${suspiciousEvents.length} suspicious events`);
    }

    return {
      summary: {
        totalActions: filteredEvents.length,
        actionsByType,
        actionsByStatus,
        lastActivity: filteredEvents[0]?.timestamp || null,
      },
      timeline: filteredEvents.slice(0, 100),  // 最近100条
      riskIndicators,
    };
  }
}
```

## 4. 安全告警

### 4.1 告警规则

```typescript
// src/audit/security-alerts.ts

interface SecurityAlert {
  id: string;
  type: AlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';

  // 触发详情
  trigger: {
    ruleId: string;
    event: AuditEvent;
    matchedCondition: string;
  };

  // 状态
  status: 'open' | 'acknowledged' | 'resolved' | 'false_positive';

  // 时间
  createdAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;

  // 响应
  acknowledgedBy?: string;
  resolvedBy?: string;
  resolution?: string;
}

type AlertType =
  | 'brute_force'
  | 'privilege_escalation'
  | 'data_exfiltration'
  | 'anomalous_access'
  | 'compliance_violation'
  | 'insider_threat';

// 安全告警规则
const SecurityAlertRules: Array<{
  id: string;
  name: string;
  type: AlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  condition: (event: AuditEvent, context: AlertContext) => boolean;
  description: string;
}> = [
  {
    id: 'brute_force_login',
    name: 'Brute Force Login Attempts',
    type: 'brute_force',
    severity: 'high',
    condition: (event) => {
      return event.eventType === 'auth.login_failed';
    },
    description: 'Multiple failed login attempts detected',
  },
  {
    id: 'privilege_escalation',
    name: 'Privilege Escalation',
    type: 'privilege_escalation',
    severity: 'critical',
    condition: (event) => {
      return event.eventType === 'permission.granted' &&
             (event.metadata?.role as string)?.includes('admin');
    },
    description: 'Admin privileges granted to user',
  },
  {
    id: 'anomalous_access',
    name: 'Anomalous Access Pattern',
    type: 'anomalous_access',
    severity: 'medium',
    condition: (event, context) => {
      // 检测异常访问时间
      const hour = new Date(event.timestamp).getHours();
      const isOffHours = hour < 6 || hour > 22;

      // 检测异常位置
      const lastLogin = context.lastKnownLogin;
      const locationChanged = lastLogin &&
        event.actor.ipAddress !== lastLogin.ipAddress;

      return isOffHours || locationChanged;
    },
    description: 'Access from unusual time or location',
  },
  {
    id: 'bulk_data_export',
    name: 'Bulk Data Export',
    type: 'data_exfiltration',
    severity: 'high',
    condition: (event) => {
      return event.eventType === 'project.exported' ||
             event.eventType === 'data.export';
    },
    description: 'Large scale data export detected',
  },
  {
    id: 'config_tampering',
    name: 'Configuration Tampering',
    type: 'compliance_violation',
    severity: 'high',
    condition: (event) => {
      return event.eventType.startsWith('config.') &&
             event.action.type === 'update';
    },
    description: 'System configuration was modified',
  },
];

class SecurityAlertManager {
  private rules: typeof SecurityAlertRules;
  private alertContext: Map<string, AlertContext> = new Map();

  async processEvent(event: AuditEvent): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = [];
    const context = this.getAlertContext(event.actor.id);

    for (const rule of this.rules) {
      try {
        if (rule.condition(event, context)) {
          const alert = await this.createAlert(rule, event);
          alerts.push(alert);

          // 发送即时通知
          await this.sendAlertNotification(alert);
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.id}:`, error);
      }
    }

    // 更新上下文
    this.updateAlertContext(event);

    return alerts;
  }

  // 告警聚合（减少重复告警）
  async aggregateAlerts(alerts: SecurityAlert[]): Promise<SecurityAlert[]> {
    const grouped = new Map<string, SecurityAlert[]>();

    for (const alert of alerts) {
      const key = `${alert.type}:${alert.trigger.ruleId}:${alert.trigger.event.actor.id}`;
      const existing = grouped.get(key) || [];
      existing.push(alert);
      grouped.set(key, existing);
    }

    // 合并短时间内的相同告警
    const aggregated: SecurityAlert[] = [];

    for (const [key, group] of grouped) {
      if (group.length > 1) {
        // 合并为单个告警
        aggregated.push(this.mergeAlerts(group));
      } else {
        aggregated.push(group[0]);
      }
    }

    return aggregated;
  }

  private mergeAlerts(alerts: SecurityAlert[]): SecurityAlert {
    return {
      ...alerts[0],
      id: generateId(),
      metadata: {
        aggregatedCount: alerts.length,
        originalAlertIds: alerts.map(a => a.id),
        timeRange: {
          first: alerts[alerts.length - 1].createdAt,
          last: alerts[0].createdAt,
        },
      },
    };
  }

  private async sendAlertNotification(alert: SecurityAlert): Promise<void> {
    // 根据严重级别选择通知方式
    switch (alert.severity) {
      case 'critical':
        // 立即通知（SMS + 电话）
        await this.sendCriticalNotification(alert);
        break;
      case 'high':
        // 立即通知（Slack + Email）
        await this.sendHighPriorityNotification(alert);
        break;
      case 'medium':
        // Email 通知
        await this.sendEmailNotification(alert);
        break;
      case 'low':
        // 日志记录
        console.warn('Security alert (low):', alert);
        break;
    }
  }
}

interface AlertContext {
  userId: string;
  lastKnownLogin?: {
    timestamp: Date;
    ipAddress: string;
  };
  recentAlertCount: number;
  recentAlertTimestamp: Date[];
}
```

### 4.2 实时监控

```typescript
// src/audit/real-time-monitor.ts

// 实时安全监控
class RealTimeSecurityMonitor {
  private alertManager: SecurityAlertManager;
  private eventStream: AsyncIterable<AuditEvent>;

  // 启动实时监控
  async startMonitoring(): Promise<void> {
    const eventStream = this.createEventStream();

    for await (const event of eventStream) {
      // 处理每个事件
      const alerts = await this.alertManager.processEvent(event);

      if (alerts.length > 0) {
        // 聚合告警
        const aggregated = await this.alertManager.aggregateAlerts(alerts);

        // 存储告警
        await this.storeAlerts(aggregated);

        // 触发工作流
        for (const alert of aggregated) {
          await this.triggerWorkflow(alert);
        }
      }
    }
  }

  // 创建事件流
  private async *createEventStream(): AsyncIterable<AuditEvent> {
    // 实时从消息队列读取事件
    while (true) {
      const event = await this.messageQueue.receive('audit-events');
      yield event;
    }
  }

  // 触发自动响应工作流
  private async triggerWorkflow(alert: SecurityAlert): Promise<void> {
    const workflow = this.getWorkflowForAlert(alert);

    if (workflow) {
      await workflow.execute(alert);
    }
  }

  // 仪表板实时数据
  async getDashboardMetrics(): Promise<SecurityDashboard> {
    const now = Date.now();

    return {
      summary: {
        totalEvents24h: await this.countEvents({ hours: 24 }),
        totalAlerts24h: await this.countAlerts({ hours: 24 }),
        openAlerts: await this.countAlerts({ status: 'open' }),
        criticalAlerts: await this.countAlerts({ severity: 'critical', status: 'open' }),
      },
      eventTrends: await this.getEventTrends({ hours: 24 }),
      topAlertTypes: await this.getTopAlertTypes({ days: 7 }),
      geographicDistribution: await this.getGeoDistribution({ hours: 24 }),
      recentAlerts: await this.getRecentAlerts({ limit: 10 }),
    };
  }
}
```

---

**最后更新**: 2026-04-14
**版本**: v1.0
