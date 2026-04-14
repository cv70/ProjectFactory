# 通知与告警系统设计

## 概述

通知与告警系统是无限生成平台的用户交互和运维保障核心，负责及时向用户和运维团队传递重要信息，包括生成进度、任务完成、系统异常等。没有通知系统，用户将无法了解生成任务的状态，运维团队也无法及时发现和处理系统问题。

## 核心价值

```
通知告警 = 传递 × 路由 × 聚合 × 升级 × 闭环

通知系统的核心价值：
1. 及时触达 - 确保重要信息及时通知到用户
2. 多渠道覆盖 - 支持多种通知方式
3. 智能聚合 - 减少通知噪音，提高效率
4. 优先级管理 - 重要告警优先处理
5. 闭环跟踪 - 确保告警得到处理
```

## 通知类型

### 通知分类

```typescript
// 通知类型
enum NotificationType {
  // 用户通知
  GENERATION_COMPLETE = 'generation_complete',
  GENERATION_FAILED = 'generation_failed',
  QUALITY_ALERT = 'quality_alert',
  PROJECT_SHARED = 'project_shared',
  COMMENT_ADDED = 'comment_added',

  // 系统通知
  SYSTEM_MAINTENANCE = 'system_maintenance',
  SYSTEM_UPDATE = 'system_update',
  POLICY_CHANGE = 'policy_change',

  // 账单通知
  BILLING_WARNING = 'billing_warning',
  BILLING_ALERT = 'billing_alert',
  PAYMENT_FAILED = 'payment_failed',

  // 安全通知
  SECURITY_ALERT = 'security_alert',
  LOGIN_ALERT = 'login_alert',
  ACCESS_GRANTED = 'access_granted',

  // 告警通知
  ERROR_RATE_HIGH = 'error_rate_high',
  LATENCY_HIGH = 'latency_high',
  RESOURCE_LOW = 'resource_low',
  DEPENDENCY_DOWN = 'dependency_down'
}

// 通知优先级
enum NotificationPriority {
  CRITICAL = 0,    // 紧急
  HIGH = 1,        // 高
  NORMAL = 2,      // 普通
  LOW = 3          // 低
}

// 通知渠道
enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  WEBHOOK = 'webhook',
  IN_APP = 'in_app',
  SLACK = 'slack',
  DISCORD = 'discord',
  TEAMS = 'teams'
}

// 通知
interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;

  // 接收者
  recipient: {
    userId?: string;
    tenantId: string;
    email?: string;
    phone?: string;
  };

  // 内容
  title: string;
  message: string;
  data?: Record<string, any>;

  // 渠道
  channels: NotificationChannel[];

  // 配置
  config: NotificationConfig;

  // 状态
  status: NotificationStatus;

  // 追踪
  tracking?: {
    sentAt?: Date;
    deliveredAt?: Date;
    readAt?: Date;
    clickedAt?: Date;
  };

  // 生命周期
  createdAt: Date;
  expiresAt?: Date;
}

// 通知配置
interface NotificationConfig {
  // 免打扰
  doNotDisturb?: {
    enabled: boolean;
    startTime?: string;       // HH:mm
    endTime?: string;
    timezone?: string;
  };

  // 聚合
  aggregation?: {
    enabled: boolean;
    windowMinutes: number;
    maxItems: number;
  };

  // 频率限制
  rateLimit?: {
    maxPerHour: number;
    maxPerDay: number;
  };
}

// 通知状态
enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  EXPIRED = 'expired'
}
```

### 告警类型

```typescript
// 告警类型
enum AlertType {
  // 基础设施
  HOST_DOWN = 'host_down',
  SERVICE_DOWN = 'service_down',
  CONTAINER_DOWN = 'container_down',
  PROCESS_DOWN = 'process_down',

  // 性能
  CPU_HIGH = 'cpu_high',
  MEMORY_HIGH = 'memory_high',
  DISK_FULL = 'disk_full',
  NETWORK_LATENCY = 'network_latency',

  // 应用
  ERROR_RATE_HIGH = 'error_rate_high',
  LATENCY_HIGH = 'latency_high',
  REQUEST_TIMEOUT = 'request_timeout',
  QUEUE_BACKLOG = 'queue_backlog',

  // 生成任务
  GENERATION_STALLED = 'generation_stalled',
  GENERATION_FAILED = 'generation_failed',
  BUILD_FAILED = 'build_failed',
  TEST_FAILED = 'test_failed',

  // 成本
  COST_ANOMALY = 'cost_anomaly',
  QUOTA_EXCEEDED = 'quota_exceeded',

  // 安全
  AUTH_FAILURE = 'auth_failure',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  VULNERABILITY_DETECTED = 'vulnerability_detected'
}

// 告警严重性
enum AlertSeverity {
  P1_CRITICAL = 'P1_CRITICAL',     // 立即处理
  P2_HIGH = 'P2_HIGH',           // 尽快处理
  P3_MEDIUM = 'P3_MEDIUM',       // 工作日处理
  P4_LOW = 'P4_LOW'              // 计划处理
}

// 告警
interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;

  // 摘要
  summary: string;
  description: string;

  // 来源
  source: {
    host?: string;
    service?: string;
    component?: string;
    region?: string;
  };

  // 详情
  details: {
    metric?: string;
    value?: number;
    threshold?: number;
    unit?: string;
    comparison?: 'above' | 'below' | 'equals';
  };

  // 时间
  occurredAt: Date;
  detectedAt: Date;

  // 状态
  status: AlertStatus;

  // 分配
  assignee?: {
    userId: string;
    assignedAt: Date;
    assignedBy: string;
  };

  // 响应
  response?: {
    acknowledgedAt?: Date;
    acknowledgedBy?: string;
    acknowledgedNote?: string;
    resolvedAt?: Date;
    resolvedBy?: string;
    resolution?: string;
  };

  // 升级
  escalation?: {
    level: number;
    lastEscalatedAt?: Date;
    nextEscalationAt?: Date;
  };

  // 元数据
  annotations?: Record<string, string>;
  labels: Record<string, string>;
}

// 告警状态
enum AlertStatus {
  FIRING = 'firing',           // 触发中
  ACKNOWLEDGED = 'acknowledged', // 已确认
  RESOLVED = 'resolved',       // 已解决
  EXPIRED = 'expired'          // 已过期
}
```

## 通知服务

### 通知管理器

```typescript
// 通知管理器
class NotificationManager {
  constructor(
    private channelHandlers: Map<NotificationChannel, ChannelHandler>,
    private templateEngine: TemplateEngine,
    private userPreferences: UserPreferenceStore
  ) {}

  // 发送通知
  async send(notification: Notification): Promise<NotificationResult> {
    // 1. 验证接收者
    await this.validateRecipient(notification);

    // 2. 检查用户偏好
    const preferences = await this.userPreferences.get(notification.recipient.userId);

    if (!this.shouldSend(notification, preferences)) {
      return { sent: false, reason: 'user_opt_out' };
    }

    // 3. 检查免打扰
    if (this.isDoNotDisturb(notification, preferences)) {
      // 加入延迟队列
      await this.delayNotification(notification, preferences);
      return { sent: false, reason: 'dnd' };
    }

    // 4. 检查频率限制
    if (await this.isRateLimited(notification)) {
      return { sent: false, reason: 'rate_limited' };
    }

    // 5. 渲染模板
    const rendered = await this.render(notification);

    // 6. 发送到各渠道
    const results = await Promise.all(
      notification.channels.map(channel =>
        this.sendToChannel(channel, notification.recipient, rendered)
      )
    );

    // 7. 记录发送历史
    await this.recordHistory(notification, results);

    return {
      sent: true,
      channelResults: results
    };
  }

  // 批量发送
  async sendBatch(notifications: Notification[]): Promise<BatchResult> {
    const results = await Promise.all(
      notifications.map(n => this.send(n))
    );

    return {
      total: notifications.length,
      succeeded: results.filter(r => r.sent).length,
      failed: results.filter(r => !r.sent).length,
      results
    };
  }
}
```

### 渠道处理器

```typescript
// 渠道处理器接口
interface ChannelHandler {
  channel: NotificationChannel;

  send(recipient: Recipient, content: RenderedContent): Promise<ChannelResult>;

  validate(recipient: Recipient): Promise<boolean>;

  getStatus(notificationId: string): Promise<DeliveryStatus>;
}

// Email处理器
class EmailHandler implements ChannelHandler {
  channel = NotificationChannel.EMAIL;

  constructor(
    private emailClient: EmailClient,
    private templateEngine: TemplateEngine
  ) {}

  async send(recipient: Recipient, content: RenderedContent): Promise<ChannelResult> {
    const email = {
      to: recipient.email,
      subject: content.title,
      html: content.body,
      text: content.plainText,
      attachments: content.attachments
    };

    try {
      const result = await this.emailClient.send(email);
      return {
        success: true,
        messageId: result.messageId,
        deliveredAt: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async validate(recipient: Recipient): Promise<boolean> {
    return !!recipient.email && this.isValidEmail(recipient.email);
  }
}

// 推送处理器
class PushHandler implements ChannelHandler {
  channel = NotificationChannel.PUSH;

  constructor(
    private pushService: PushService,
    private deviceStore: DeviceStore
  ) {}

  async send(recipient: Recipient, content: RenderedContent): Promise<ChannelResult> {
    const devices = await this.deviceStore.getUserDevices(recipient.userId!);

    const results = await Promise.all(
      devices.map(device =>
        this.pushService.send({
          deviceToken: device.token,
          title: content.title,
          body: content.body,
          data: content.data,
          badge: content.badge,
          sound: content.sound
        })
      )
    );

    return {
      success: results.every(r => r.success),
      messageId: results[0]?.messageId,
      deliveredAt: new Date()
    };
  }
}

// Webhook处理器
class WebhookHandler implements ChannelHandler {
  channel = NotificationChannel.WEBHOOK;

  constructor(
    private httpClient: HttpClient,
    private webhookStore: WebhookStore
  ) {}

  async send(recipient: Recipient, content: RenderedContent): Promise<ChannelResult> {
    const webhooks = await this.webhookStore.getWebhooks(recipient.userId!);

    const results = await Promise.all(
      webhooks.map(webhook =>
        this.httpClient.post(webhook.url, {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': this.sign(content, webhook.secret)
          },
          body: {
            event: content.type,
            timestamp: new Date().toISOString(),
            data: content.data
          }
        })
      )
    );

    return {
      success: results.every(r => r.status === 200),
      deliveredAt: new Date()
    };
  }
}
```

## 告警管理

### 告警引擎

```typescript
// 告警引擎
class AlertEngine {
  constructor(
    private alertRules: AlertRule[],
    private alertStore: AlertStore,
    private notificationManager: NotificationManager,
    private escalationManager: EscalationManager
  ) {}

  // 处理告警
  async processAlert(alertData: AlertData): Promise<Alert> {
    // 1. 创建告警
    const alert = await this.createAlert(alertData);

    // 2. 检查是否重复
    const isDuplicate = await this.checkDuplicate(alert);

    if (isDuplicate && this.shouldSuppressDuplicate(alert)) {
      await this.suppressAlert(alert);
      return alert;
    }

    // 3. 分配告警
    await this.assignAlert(alert);

    // 4. 发送通知
    await this.notifyAlert(alert);

    // 5. 设置升级
    await this.scheduleEscalation(alert);

    return alert;
  }

  // 创建告警
  private async createAlert(data: AlertData): Promise<Alert> {
    const alert: Alert = {
      id: generateId('alert'),
      type: data.type,
      severity: this.determineSeverity(data),
      summary: data.summary,
      description: data.description,
      source: data.source,
      details: data.details,
      occurredAt: data.occurredAt,
      detectedAt: new Date(),
      status: AlertStatus.FIRING,
      labels: data.labels || {}
    };

    await this.alertStore.save(alert);
    return alert;
  }

  // 确定严重性
  private determineSeverity(data: AlertData): AlertSeverity {
    // 基于类型的默认严重性
    const severityMap: Record<AlertType, AlertSeverity> = {
      [AlertType.HOST_DOWN]: AlertSeverity.P1_CRITICAL,
      [AlertType.SERVICE_DOWN]: AlertSeverity.P1_CRITICAL,
      [AlertType.ERROR_RATE_HIGH]: AlertSeverity.P2_HIGH,
      [AlertType.LATENCY_HIGH]: AlertSeverity.P2_HIGH,
      [AlertType.GENERATION_STALLED]: AlertSeverity.P3_MEDIUM,
      [AlertType.QUOTA_EXCEEDED]: AlertSeverity.P3_MEDIUM,
      [AlertType.COST_ANOMALY]: AlertSeverity.P4_LOW
    };

    // 检查阈值
    if (data.details?.value !== undefined && data.details?.threshold !== undefined) {
      const deviation = Math.abs(data.details.value - data.details.threshold) / data.details.threshold;

      if (deviation > 0.5) {
        return this.escalateSeverity(severityMap[data.type]);
      }
    }

    return severityMap[data.type] || AlertSeverity.P3_MEDIUM;
  }

  // 检查重复
  private async checkDuplicate(alert: Alert): Promise<boolean> {
    const recentAlerts = await this.alertStore.query({
      type: alert.type,
      source: alert.source,
      status: AlertStatus.FIRING,
      since: Date.now() - 60 * 60 * 1000 // 最近1小时
    });

    return recentAlerts.length > 0;
  }

  // 分配告警
  private async assignAlert(alert: Alert): Promise<void> {
    // 查找合适的处理人
    const assignee = await this.findAssignee(alert);

    if (assignee) {
      alert.assignee = {
        userId: assignee.id,
        assignedAt: new Date(),
        assignedBy: 'system'
      };
      await this.alertStore.update(alert);
    }
  }

  // 发送通知
  private async notifyAlert(alert: Alert): Promise<void> {
    const notification: Notification = {
      id: generateId('notif'),
      type: this.mapAlertToNotificationType(alert.type),
      priority: this.mapSeverityToPriority(alert.severity),
      recipient: {
        userId: alert.assignee?.userId,
        tenantId: alert.labels.tenantId
      },
      title: `[${alert.severity}] ${alert.summary}`,
      message: alert.description,
      data: {
        alertId: alert.id,
        alertType: alert.type,
        severity: alert.severity
      },
      channels: this.getChannelsForSeverity(alert.severity),
      config: {},
      status: NotificationStatus.PENDING,
      createdAt: new Date()
    };

    await this.notificationManager.send(notification);
  }
}
```

### 升级策略

```typescript
// 升级管理器
class EscalationManager {
  constructor(
    private escalationPolicies: EscalationPolicy[],
    private userService: UserService,
    private notificationManager: NotificationManager
  ) {}

  // 计划升级
  async scheduleEscalation(alert: Alert): Promise<void> {
    const policy = this.getPolicy(alert);

    if (!policy) return;

    // 计算升级时间
    const escalationDelay = this.calculateDelay(policy, 1);

    alert.escalation = {
      level: 1,
      nextEscalationAt: new Date(Date.now() + escalationDelay)
    };

    // 安排升级任务
    await this.scheduleEscalationTask(alert, escalationDelay);
  }

  // 执行升级
  async escalate(alert: Alert): Promise<void> {
    const currentLevel = alert.escalation?.level || 0;
    const policy = this.getPolicy(alert);

    if (!policy) return;

    // 获取下一级处理人
    const nextLevel = currentLevel + 1;
    const assignees = policy.levels[nextLevel];

    if (!assignees || assignees.length === 0) {
      // 尝试更高级别
      return;
    }

    // 更新告警
    alert.assignee = {
      userId: assignees[0].userId,
      assignedAt: new Date(),
      assignedBy: 'escalation'
    };

    alert.escalation = {
      level: nextLevel,
      lastEscalatedAt: new Date(),
      nextEscalationAt: new Date(Date.now() + this.calculateDelay(policy, nextLevel))
    };

    // 发送升级通知
    await this.sendEscalationNotification(alert, nextLevel);
  }

  // 升级策略
  private getPolicy(alert: Alert): EscalationPolicy | null {
    return this.escalationPolicies.find(p =>
      p.alertTypes.includes(alert.type)
    );
  }

  private calculateDelay(policy: EscalationPolicy, level: number): number {
    const levelConfig = policy.levels[level];
    if (!levelConfig) return Infinity;

    // 转换为毫秒
    return levelConfig.delayMinutes * 60 * 1000;
  }
}

// 升级策略
interface EscalationPolicy {
  id: string;
  name: string;
  alertTypes: AlertType[];

  levels: {
    [level: number]: {
      delayMinutes: number;
      assignees: { userId: string; type: 'user' | 'role' | 'team' }[];
      notifyChannels: NotificationChannel[];
    };
  };

  maxLevel: number;
  repeatInterval?: number;
}
```

## 告警规则

### 规则定义

```typescript
// 告警规则
interface AlertRule {
  id: string;
  name: string;
  description: string;

  // 条件
  conditions: RuleConditions;

  // 过滤
  filters?: {
    severity?: AlertSeverity[];
    source?: string[];
    labels?: Record<string, string>;
  };

  // 分组
  groupBy?: string[];

  // 告警配置
  alertConfig: {
    severity: AlertSeverity;
    summary: string;
    description?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };

  // 抑制
  inhibiton?: {
    enabled: boolean;
    bySeverity: boolean;
    timeWindow: number;
  };

  // 状态
  enabled: boolean;
}

// 规则条件
interface RuleConditions {
  // 类型: metric | event | external
  type: 'metric' | 'event' | 'external';

  // 度量条件
  metric?: {
    metric: string;
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    value: number;
    duration?: number;           // 持续时间 (秒)
    interval?: number;            // 检查间隔 (秒)
  };

  // 事件条件
  event?: {
    type: string;
    filter?: Record<string, any>;
  };

  // 外部条件
  external?: {
    source: string;
    query: string;
  };
}

// 预定义规则
const predefinedRules: AlertRule[] = [
  {
    id: 'high-error-rate',
    name: 'High Error Rate',
    description: '当错误率超过5%时触发',
    conditions: {
      type: 'metric',
      metric: {
        metric: 'error_rate',
        operator: '>',
        value: 5,
        duration: 300,  // 持续5分钟
        interval: 60
      }
    },
    alertConfig: {
      severity: AlertSeverity.P2_HIGH,
      summary: 'Error rate is above 5%',
      labels: { component: 'gateway' }
    },
    enabled: true
  },
  {
    id: 'generation-failed',
    name: 'Generation Task Failed',
    description: '当生成任务失败时触发',
    conditions: {
      type: 'event',
      event: {
        type: 'generation.failed'
      }
    },
    alertConfig: {
      severity: AlertSeverity.P3_MEDIUM,
      summary: 'Generation task failed: {{taskId}}',
      description: '任务失败原因: {{reason}}'
    },
    groupBy: ['projectId'],
    inhibiton: {
      enabled: true,
      bySeverity: true,
      timeWindow: 600
    },
    enabled: true
  },
  {
    id: 'quota-exceeded',
    name: 'Resource Quota Exceeded',
    description: '当资源配额超限时触发',
    conditions: {
      type: 'metric',
      metric: {
        metric: 'quota_usage_percent',
        operator: '>=',
        value: 100,
        duration: 0
      }
    },
    alertConfig: {
      severity: AlertSeverity.P2_HIGH,
      summary: 'Quota exceeded for {{resourceType}}',
      labels: { component: 'billing' }
    },
    enabled: true
  }
];
```

## 通知聚合

### 聚合引擎

```typescript
// 通知聚合器
class NotificationAggregator {
  constructor(
    private aggregationRules: AggregationRule[]
  ) {}

  // 聚合通知
  async aggregate(notifications: Notification[]): Promise<AggregatedNotification[]> {
    // 1. 分组
    const groups = this.groupNotifications(notifications);

    // 2. 对每组进行聚合
    const aggregated: AggregatedNotification[] = [];

    for (const [key, group] of Object.entries(groups)) {
      if (group.length === 1) {
        aggregated.push({
          ...group[0],
          aggregated: false,
          count: 1
        });
      } else {
        aggregated.push(await this.createAggregated(group));
      }
    }

    return aggregated;
  }

  // 分组
  private groupNotifications(notifications: Notification[]): Record<string, Notification[]> {
    const groups: Record<string, Notification[]> = {};

    for (const notification of notifications) {
      const key = this.getGroupKey(notification);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(notification);
    }

    return groups;
  }

  // 获取分组键
  private getGroupKey(notification: Notification): string {
    const rule = this.findMatchingRule(notification);

    if (rule?.groupBy) {
      return rule.groupBy.map(field =>
        this.getNestedValue(notification, field)
      ).join(':');
    }

    // 默认按类型和接收者分组
    return `${notification.type}:${notification.recipient.userId}`;
  }

  // 创建聚合通知
  private async createAggregated(group: Notification[]): Promise<AggregatedNotification> {
    const first = group[0];

    return {
      ...first,
      id: generateId('aggregated'),
      aggregated: true,
      count: group.length,

      // 聚合标题
      title: `${first.title} (${group.length} notifications)`,

      // 聚合内容
      message: this.generateAggregatedMessage(group),

      // 时间范围
      timeRange: {
        earliest: Math.min(...group.map(n => n.createdAt.getTime())),
        latest: Math.max(...group.map(n => n.createdAt.getTime()))
      },

      // 汇总数据
      summary: this.generateSummary(group),

      // 原始通知列表
      originalNotifications: group
    };
  }

  // 生成聚合消息
  private generateAggregatedMessage(group: Notification[]): string {
    const byType = this.groupBy(group, 'type');

    const lines = [];
    for (const [type, notifications] of Object.entries(byType)) {
      lines.push(`- ${type}: ${notifications.length} notifications`);
    }

    return `You have ${group.length} notifications:\n${lines.join('\n')}`;
  }
}

// 聚合规则
interface AggregationRule {
  id: string;
  name: string;

  // 匹配条件
  match: {
    types?: NotificationType[];
    channels?: NotificationChannel[];
    priorities?: NotificationPriority[];
  };

  // 分组字段
  groupBy?: string[];

  // 聚合配置
  config: {
    windowMinutes: number;
    maxItems: number;
    minItems?: number;
  };
}
```

## 用户偏好

### 偏好管理

```typescript
// 用户通知偏好
interface UserNotificationPreferences {
  userId: string;

  // 全局设置
  global: {
    enabled: boolean;
    doNotDisturb: {
      enabled: boolean;
      startTime?: string;
      endTime?: string;
      timezone?: string;
    };
  };

  // 渠道设置
  channels: {
    [channel in NotificationChannel]?: {
      enabled: boolean;
      address?: string;         // email, phone, etc.
      verified?: boolean;
    };
  };

  // 类型设置
  types: {
    [type in NotificationType]?: {
      enabled: boolean;
      channels: NotificationChannel[];
      priority?: NotificationPriority;  // 只接收此优先级及以上
      aggregation?: {
        enabled: boolean;
        windowMinutes?: number;
      };
    };
  };

  // 关键词过滤
  filters: {
    keywords?: {
      include?: string[];
      exclude?: string[];
    };
    languages?: string[];
  };

  // 更新
  updatedAt: Date;
}

// 偏好服务
class UserPreferenceService {
  constructor(
    private preferenceStore: UserPreferenceStore
  ) {}

  // 获取偏好
  async getPreferences(userId: string): Promise<UserNotificationPreferences> {
    const stored = await this.preferenceStore.get(userId);

    if (stored) {
      return stored;
    }

    // 返回默认偏好
    return this.getDefaultPreferences(userId);
  }

  // 更新偏好
  async updatePreferences(
    userId: string,
    updates: Partial<UserNotificationPreferences>
  ): Promise<void> {
    const current = await this.getPreferences(userId);

    const updated: UserNotificationPreferences = {
      ...current,
      ...updates,
      updatedAt: new Date()
    };

    await this.preferenceStore.save(updated);
  }

  // 获取默认偏好
  private getDefaultPreferences(userId: string): UserNotificationPreferences {
    return {
      userId,
      global: {
        enabled: true,
        doNotDisturb: {
          enabled: false
        }
      },
      channels: {
        [NotificationChannel.EMAIL]: {
          enabled: true
        },
        [NotificationChannel.IN_APP]: {
          enabled: true
        }
      },
      types: {},
      filters: {},
      updatedAt: new Date()
    };
  }
}
```

## 模板管理

### 模板引擎

```typescript
// 通知模板
interface NotificationTemplate {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;

  // 内容
  content: {
    title: string;
    body: string;
    plainText?: string;
  };

  // 变量
  variables: TemplateVariable[];

  // 样式
  style?: {
    primaryColor?: string;
    logoUrl?: string;
    footer?: string;
  };

  // 本地化
  localization?: {
    [locale: string]: {
      title: string;
      body: string;
      plainText?: string;
    };
  };

  version: number;
  status: 'active' | 'deprecated';
}

// 模板变量
interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'url' | 'object';
  required: boolean;
  default?: any;
  description?: string;
}

// 模板服务
class TemplateService {
  constructor(
    private templateStore: TemplateStore
  ) {}

  // 渲染模板
  async render(
    templateId: string,
    variables: Record<string, any>
  ): Promise<RenderedContent> {
    const template = await this.templateStore.get(templateId);

    // 替换变量
    const title = this.substituteVariables(template.content.title, variables);
    const body = this.substituteVariables(template.content.body, variables);
    const plainText = template.content.plainText
      ? this.substituteVariables(template.content.plainText, variables)
      : this.htmlToPlainText(body);

    return {
      type: template.type,
      title,
      body,
      plainText,
      variables
    };
  }

  // 替换变量
  private substituteVariables(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)(?:\.(\w+))?\}\}/g, (match, key, subkey) => {
      const value = variables[key];

      if (value === undefined) {
        return match;
      }

      if (subkey && typeof value === 'object') {
        return String(value[subkey]);
      }

      return String(value);
    });
  }
}

// 预定义模板
const predefinedTemplates: NotificationTemplate[] = [
  {
    id: 'generation-complete-email',
    type: NotificationType.GENERATION_COMPLETE,
    channel: NotificationChannel.EMAIL,
    content: {
      title: 'Your project "{{projectName}}" is ready!',
      body: `
        <h1>Great news!</h1>
        <p>Your generated project <strong>{{projectName}}</strong> is ready.</p>
        <p><a href="{{projectUrl}}">View Project</a></p>
        <p>Generation time: {{duration}}</p>
      `
    },
    variables: [
      { name: 'projectName', type: 'string', required: true },
      { name: 'projectUrl', type: 'url', required: true },
      { name: 'duration', type: 'string', required: false }
    ],
    version: 1,
    status: 'active'
  },
  {
    id: 'alert-p1-slack',
    type: NotificationType.SECURITY_ALERT,
    channel: NotificationChannel.SLACK,
    content: {
      title: ':rotating_light: [P{{severity}}] {{summary}}',
      body: `
        *{{summary}}*
        {{description}}

        *Source:* {{source}}
        *Time:* {{occurredAt}}

        <{{alertUrl}}|View Alert> | <{{ackUrl}}|Acknowledge>
      `
    },
    variables: [
      { name: 'severity', type: 'string', required: true },
      { name: 'summary', type: 'string', required: true },
      { name: 'description', type: 'string', required: false },
      { name: 'source', type: 'string', required: false },
      { name: 'occurredAt', type: 'date', required: true },
      { name: 'alertUrl', type: 'url', required: true },
      { name: 'ackUrl', type: 'url', required: true }
    ],
    version: 1,
    status: 'active'
  }
];
```

## 监控与报告

### 通知指标

```typescript
// 通知指标
const notificationMetrics = {
  // 发送指标
  sentTotal: Counter,
  sentByChannel: Counter,
  sentByType: Counter,
  sentByPriority: Counter,

  // 送达指标
  deliveredTotal: Counter,
  deliveryRate: Gauge,
  deliveryLatency: Histogram,

  // 打开指标
  openedTotal: Counter,
  openRate: Gauge,

  // 点击指标
  clickedTotal: Counter,
  clickRate: Gauge,

  // 失败指标
  failedTotal: Counter,
  failedByReason: Counter,

  // 聚合指标
  aggregatedTotal: Counter,
  aggregationRate: Gauge,

  // 告警指标
  alertsTotal: Counter,
  alertsBySeverity: Counter,
  alertsByType: Counter,
  alertTimeToAcknowledge: Histogram,
  alertTimeToResolve: Histogram,
  alertMTTR: Gauge // Mean Time To Resolve
};
```

### 报告服务

```typescript
// 通知报告
interface NotificationReport {
  period: {
    start: Date;
    end: Date;
  };

  summary: {
    totalSent: number;
    totalDelivered: number;
    deliveryRate: number;
    totalOpened: number;
    openRate: number;
    totalClicked: number;
    clickRate: number;
  };

  byChannel: Record<string, ChannelStats>;
  byType: Record<string, TypeStats>;
  byPriority: Record<string, PriorityStats>;

  topTemplates: TemplateUsage[];
  userEngagement: UserEngagementStats[];
}

// 告警报告
interface AlertReport {
  period: {
    start: Date;
    end: Date;
  };

  summary: {
    totalAlerts: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  };

  performance: {
    mtta: number;      // Mean Time To Acknowledge
    mttr: number;      // Mean Time To Resolve
    resolvedCount: number;
    unresolvedCount: number;
  };

  topAlertingServices: ServiceAlertCount[];
  alertTrend: TimeSeriesData[];
}
```

## 配置

```typescript
// 通知系统配置
interface NotificationConfig {
  // 全局设置
  global: {
    enabled: boolean;
    defaultChannels: NotificationChannel[];
  };

  // 渠道配置
  channels: {
    [channel in NotificationChannel]?: {
      enabled: boolean;
      config: Record<string, any>;
      rateLimits?: {
        maxPerMinute: number;
        maxPerHour: number;
        maxPerDay: number;
      };
    };
  };

  // 聚合配置
  aggregation: {
    enabled: boolean;
    defaultWindowMinutes: number;
    defaultMaxItems: number;
    rules: AggregationRule[];
  };

  // 告警配置
  alerting: {
    enabled: boolean;
    rules: AlertRule[];
    suppression: {
      enabled: boolean;
      windowMinutes: number;
    };
  };

  // 升级配置
  escalation: {
    enabled: boolean;
    policies: EscalationPolicy[];
  };

  // 模板配置
  templates: {
    precompiled: boolean;
    cacheEnabled: boolean;
    maxCacheSize: number;
  };

  // 监控配置
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    reportSchedule: {
      daily: boolean;
      weekly: boolean;
      monthly: boolean;
    };
  };
}
```

## 最佳实践

### 1. 通知策略

```
- 紧急告警 → 即时推送 + 短信 + 电话
- 高优先级 → 推送 + 邮件
- 普通通知 → 邮件 + In-App
- 低优先级 → In-App 仅
```

### 2. 告警管理

```
- 避免告警风暴 → 聚合和抑制
- 设置合理阈值 → 基于历史基线
- 及时确认和升级 → 避免告警被忽视
- 定期回顾和调优 → 减少噪音
```

### 3. 用户体验

```
- 提供清晰的退订选项
- 允许细粒度偏好设置
- 支持免打扰时段
- 聚合低优先级通知
```

---

**最后更新**: 2026-04-15
