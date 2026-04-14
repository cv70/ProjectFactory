# 通知系统设计

## 1. 概述

本文档描述 ProjectFactory 系统的通知系统设计，支持多渠道推送和用户偏好管理。

### 1.1 设计目标

| 目标 | 描述 |
|------|------|
| 多渠道 | Email / WebSocket / Push / SMS |
| 即时性 | 消息延迟 < 1 秒 |
| 可靠性 | 消息送达保证 |
| 可配置 | 用户自定义通知偏好 |
| 可追踪 | 发送统计和回执 |

### 1.2 通知架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         通知系统架构                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  触发源                                                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                      │
│  │ Project │  │  Idea   │  │ Billing │  │ System  │                      │
│  │ Service │  │ Service │  │ Service │  │ Service │                      │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘                      │
│       └────────────┴────────────┴────────────┘                               │
│                          ↓                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Notification Service                              │   │
│  │                                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │   │
│  │  │  Preference │  │  Template   │  │   Queue     │                   │   │
│  │  │   Manager   │  │   Engine    │  │   Manager   │                   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                          ↓                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Channel Dispatchers                               │   │
│  │                                                                       │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │   │
│  │  │  Email  │  │   Web   │  │  Push   │  │   SMS   │                 │   │
│  │  │Provider │  │Socket   │  │Service  │  │Provider │                 │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘                 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 数据模型

### 2.1 通知类型

```typescript
// src/notifications/types.ts
enum NotificationType {
  // 项目相关
  PROJECT_COMPLETED = 'project.completed',
  PROJECT_FAILED = 'project.failed',
  PROJECT_SHARED = 'project.shared',
  PROJECT_COMMENTED = 'project.commented',

  // Idea 相关
  IDEA_APPROVED = 'idea.approved',
  IDEA_REJECTED = 'idea.rejected',
  IDEA_IMPLEMENTED = 'idea.implemented',

  // 账户相关
  SUBSCRIPTION_EXPIRING = 'subscription.expiring',
  SUBSCRIPTION_EXPIRED = 'subscription.expired',
  PASSWORD_CHANGED = 'password.changed',

  // 系统通知
  SYSTEM_MAINTENANCE = 'system.maintenance',
  SYSTEM_UPDATE = 'system.update',

  // 引用通知
  MENTION = 'mention',
}

interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;  // 额外数据
  channels: NotificationChannel[]; // 发送渠道
  status: NotificationStatus;
  read: boolean;
  sentAt?: number;
  readAt?: number;
  createdAt: number;
  expiresAt?: number;
}

enum NotificationChannel {
  EMAIL = 'email',
  WEBSOCKET = 'websocket',
  PUSH = 'push',
  SMS = 'sms',
}

enum NotificationStatus {
  PENDING = 'pending',
  SENDING = 'sending',
  SENT = 'sent',
  FAILED = 'failed',
  READ = 'read',
}

// 用户通知偏好
interface NotificationPreference {
  userId: string;
  channel: NotificationChannel;
  type: NotificationType;
  enabled: boolean;
  quietHours?: {
    enabled: boolean;
    start: string;  // HH:mm
    end: string;    // HH:mm
    timezone: string;
  };
  frequency?: NotificationFrequency;
}

enum NotificationFrequency {
  INSTANT = 'instant',
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
}
```

### 2.2 通知模板

```typescript
// src/notifications/templates.ts
interface NotificationTemplate {
  id: string;
  type: NotificationType;
  channels: NotificationChannel[];
  subject?: Record<NotificationChannel, string>;  // Email subject
  titleTemplate: string;
  bodyTemplate: string;
  variables: string[];
  i18n: Record<string, { title: string; body: string }>;
}

const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  {
    id: 'tpl_project_completed',
    type: NotificationType.PROJECT_COMPLETED,
    channels: [NotificationChannel.EMAIL, NotificationChannel.WEBSOCKET, NotificationChannel.PUSH],
    subject: {
      [NotificationChannel.EMAIL]: '🎉 Your project is ready!',
    },
    titleTemplate: 'Project {{projectName}} is ready!',
    bodyTemplate: `Your project "{{projectName}}" has been successfully generated.

📊 Quality Score: {{qualityScore}}
⏱️ Generation Time: {{duration}}
🔗 View Project: {{projectUrl}}`,
    variables: ['projectName', 'qualityScore', 'duration', 'projectUrl'],
    i18n: {
      zh: {
        title: '项目 {{projectName}} 已完成！',
        body: '您的项目 "{{projectName}}" 已成功生成。\n\n📊 质量评分：{{qualityScore}}\n⏱️ 生成耗时：{{duration}}\n🔗 查看项目：{{projectUrl}}',
      },
    },
  },
  {
    id: 'tpl_idea_approved',
    type: NotificationType.IDEA_APPROVED,
    channels: [NotificationChannel.EMAIL, NotificationChannel.WEBSOCKET],
    subject: {
      [NotificationChannel.EMAIL]: '💡 Your idea was approved!',
    },
    titleTemplate: 'Your idea "{{ideaTitle}}" was approved',
    bodyTemplate: `Great news! Your idea has been approved and is ready for implementation.

💡 Idea: {{ideaTitle}}
📝 Description: {{ideaDescription}}
🔗 View Details: {{ideaUrl}}`,
    variables: ['ideaTitle', 'ideaDescription', 'ideaUrl'],
    i18n: {
      zh: {
        title: '您的想法 "{{ideaTitle}}" 已通过审核！',
        body: '太好了！您的想法已通过审核，可以开始实现了。\n\n💡 想法：{{ideaTitle}}\n📝 描述：{{ideaDescription}}\n🔗 查看详情：{{ideaUrl}}',
      },
    },
  },
  {
    id: 'tpl_subscription_expiring',
    type: NotificationType.SUBSCRIPTION_EXPIRING,
    channels: [NotificationChannel.EMAIL, NotificationChannel.SMS],
    subject: {
      [NotificationChannel.EMAIL]: '⚠️ Your subscription is expiring soon',
    },
    titleTemplate: 'Subscription expiring in {{daysLeft}} days',
    bodyTemplate: `Your {{planName}} subscription will expire on {{expiryDate}}.

🔄 To continue enjoying uninterrupted service, please renew your subscription.

💳 Renew Now: {{renewUrl}}`,
    variables: ['planName', 'expiryDate', 'daysLeft', 'renewUrl'],
    i18n: {
      zh: {
        title: '您的订阅将在 {{daysLeft}} 天后到期',
        body: '您的 {{planName}} 订阅将于 {{expiryDate}} 到期。\n\n🔄 为继续享受不间断的服务，请续订。\n\n💳 立即续订：{{renewUrl}}',
      },
    },
  },
];
```

---

## 3. 通知服务

### 3.1 通知管理器

```typescript
// src/notifications/notification-service.ts
class NotificationService {
  constructor(
    private templateEngine: TemplateEngine,
    private preferenceManager: PreferenceManager,
    private channelDispatchers: Map<NotificationChannel, ChannelDispatcher>,
    private queue: Queue
  ) {}

  // 发送通知
  async send(
    userId: string,
    type: NotificationType,
    data: Record<string, unknown>,
    options?: { channels?: NotificationChannel[]; urgent?: boolean }
  ): Promise<Notification[]> {
    // 1. 获取用户偏好
    const preferences = await this.preferenceManager.getUserPreferences(userId);

    // 2. 确定发送渠道
    const channels = options?.channels ||
      this.getDefaultChannels(type) ||
      preferences.filter(p => p.enabled).map(p => p.channel);

    // 3. 检查免打扰时间
    if (this.isInQuietHours(preferences)) {
      // 仅紧急通知可发送
      if (!options?.urgent) {
        // 延迟到安静时段结束
        await this.scheduleForLater(userId, type, data, channels);
        return [];
      }
    }

    // 4. 获取模板
    const template = this.templateEngine.getTemplate(type);

    // 5. 渲染内容
    const { title, body } = this.templateEngine.render(template, data);

    // 6. 创建通知记录
    const notification = await this.createNotification({
      userId,
      type,
      title,
      body,
      data,
      channels,
      status: NotificationStatus.PENDING,
    });

    // 7. 发送到各渠道
    const results = await Promise.allSettled(
      channels.map(channel =>
        this.sendToChannel(channel, userId, title, body, data)
      )
    );

    // 8. 更新状态
    await this.updateNotificationStatus(notification.id, results);

    return [notification];
  }

  // 批量发送
  async sendBatch(
    userIds: string[],
    type: NotificationType,
    data: Record<string, unknown>
  ): Promise<void> {
    for (const userId of userIds) {
      await this.queue.add('send-notification', {
        userId,
        type,
        data,
      });
    }
  }

  // 获取用户通知
  async getUserNotifications(
    userId: string,
    options?: { limit?: number; offset?: number; unreadOnly?: boolean }
  ): Promise<Notification[]> {
    return db.notifications.findMany({
      where: {
        userId,
        ...(options?.unreadOnly && { read: false }),
      },
      orderBy: { createdAt: 'desc' },
      limit: options?.limit || 20,
      offset: options?.offset || 0,
    });
  }

  // 标记已读
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await db.notifications.update({
      where: { id: notificationId, userId },
      data: { read: true, readAt: Date.now() },
    });
  }

  private async sendToChannel(
    channel: NotificationChannel,
    userId: string,
    title: string,
    body: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const dispatcher = this.channelDispatchers.get(channel);
    if (!dispatcher) {
      throw new Error(`No dispatcher for channel: ${channel}`);
    }

    await dispatcher.send(userId, { title, body, data });
  }

  private isInQuietHours(preferences: NotificationPreference[]): boolean {
    const quietPref = preferences.find(p => p.quietHours?.enabled);
    if (!quietPref?.quietHours) return false;

    const now = new Date();
    const timezone = quietPref.quietHours.timezone;
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    });

    const currentTime = formatter.format(now);
    const { start, end } = quietPref.quietHours;

    // 处理跨天情况
    if (start <= end) {
      return currentTime >= start && currentTime <= end;
    } else {
      return currentTime >= start || currentTime <= end;
    }
  }
}
```

### 3.2 模板引擎

```typescript
// src/notifications/template-engine.ts
class TemplateEngine {
  private templates: Map<NotificationType, NotificationTemplate> = new Map();

  constructor(templates: NotificationTemplate[]) {
    for (const template of templates) {
      this.templates.set(template.type, template);
    }
  }

  getTemplate(type: NotificationType): NotificationTemplate {
    const template = this.templates.get(type);
    if (!template) {
      throw new Error(`Template not found for type: ${type}`);
    }
    return template;
  }

  render(
    template: NotificationTemplate,
    variables: Record<string, unknown>,
    locale: string = 'en'
  ): { title: string; body: string } {
    const i18n = template.i18n[locale] || template.i18n['en'];

    const title = this.interpolate(i18n.title, variables);
    const body = this.interpolate(i18n.body, variables);

    return { title, body };
  }

  // 变量替换
  private interpolate(text: string, variables: Record<string, unknown>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined
        ? String(variables[key])
        : match;
    });
  }
}
```

---

## 4. 渠道分发器

### 4.1 Email 分发器

```typescript
// src/notifications/channels/email.ts
interface EmailDispatcher {
  send(
    userId: string,
    content: { title: string; body: string },
    options?: { attachments?: Attachment[]; cc?: string[] }
  ): Promise<void>;
}

class EmailDispatcherImpl implements EmailDispatcher {
  constructor(
    private emailClient: SendGridClient,
    private fromEmail: string
  ) {}

  async send(
    userId: string,
    content: { title: string; body: string },
    options?: { attachments?: Attachment[]; cc?: string[] }
  ): Promise<void> {
    const user = await userService.getById(userId);
    if (!user?.email) {
      throw new Error(`User ${userId} has no email`);
    }

    const email: SendEmailRequest = {
      to: user.email,
      from: this.fromEmail,
      subject: content.title,
      text: content.body,
      html: this.markdownToHtml(content.body),
      ...(options?.attachments && { attachments: options.attachments }),
      ...(options?.cc && { cc: options.cc }),
    };

    // 加入发送队列
    await this.emailClient.send(email);

    // 记录发送
    await this.logEmailSent(userId, content);
  }

  private markdownToHtml(text: string): string {
    return text
      .split('\n\n')
      .map(p => `<p>${p}</p>`)
      .join('')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }
}
```

### 4.2 WebSocket 分发器

```typescript
// src/notifications/channels/websocket.ts
class WebSocketDispatcher implements ChannelDispatcher {
  async send(
    userId: string,
    content: { title: string; body: string; data?: Record<string, unknown> }
  ): Promise<void> {
    const message = {
      id: crypto.randomUUID(),
      type: 'notification',
      payload: {
        title: content.title,
        body: content.body,
        data: content.data,
        timestamp: Date.now(),
      },
    };

    wsServer.sendToUser(userId, 'notification', message);
  }
}
```

### 4.3 Push 分发器

```typescript
// src/notifications/channels/push.ts
class PushDispatcher implements ChannelDispatcher {
  constructor(
    private fcmClient: FCMClient,
    private vapidKey: string
  ) {}

  async send(
    userId: string,
    content: { title: string; body: string; data?: Record<string, unknown> }
  ): Promise<void> {
    const subscription = await this.getUserPushSubscription(userId);
    if (!subscription) {
      console.warn(`User ${userId} has no push subscription`);
      return;
    }

    const notification: WebPushPayload = {
      title: content.title,
      body: content.body,
      icon: '/icons/notification-icon.png',
      badge: '/icons/badge-icon.png',
      data: content.data,
      tag: content.data?.notificationId as string || crypto.randomUUID(),
      requireInteraction: this.isUrgentNotification(content.data),
    };

    await this.fcmClient.send(subscription, notification);
  }

  private isUrgentNotification(data?: Record<string, unknown>): boolean {
    const urgentTypes = [
      NotificationType.SUBSCRIPTION_EXPIRED,
      NotificationType.SUBSCRIPTION_EXPIRING,
    ];
    return urgentTypes.includes(data?.type as NotificationType);
  }
}
```

---

## 5. 偏好管理

### 5.1 用户偏好

```typescript
// src/notifications/preference-manager.ts
class PreferenceManager {
  // 获取用户的所有偏好
  async getUserPreferences(userId: string): Promise<NotificationPreference[]> {
    const prefs = await db.notificationPreferences.findMany({
      where: { userId },
    });

    // 合并默认偏好
    return this.mergeWithDefaults(prefs);
  }

  // 更新用户偏好
  async updatePreference(
    userId: string,
    channel: NotificationChannel,
    type: NotificationType,
    updates: Partial<NotificationPreference>
  ): Promise<void> {
    await db.notificationPreferences.upsert({
      where: { userId_channel_type: { userId, channel, type } },
      create: {
        userId,
        channel,
        type,
        enabled: updates.enabled ?? true,
        quietHours: updates.quietHours,
        frequency: updates.frequency ?? NotificationFrequency.INSTANT,
      },
      update: updates,
    });
  }

  // 批量更新
  async bulkUpdatePreferences(
    userId: string,
    preferences: Array<{
      channel: NotificationChannel;
      type: NotificationType;
      enabled: boolean;
    }>
  ): Promise<void> {
    await db.transaction(async (tx) => {
      for (const pref of preferences) {
        await tx.notificationPreferences.upsert({
          where: { userId_channel_type: { userId, ...pref } },
          create: { userId, ...pref },
          update: { enabled: pref.enabled },
        });
      }
    });
  }

  // 检查是否应该发送
  async shouldNotify(
    userId: string,
    type: NotificationType,
    channel: NotificationChannel
  ): Promise<boolean> {
    const prefs = await this.getUserPreferences(userId);
    const pref = prefs.find(p => p.channel === channel && p.type === type);

    if (!pref) {
      // 默认发送
      return true;
    }

    if (!pref.enabled) {
      return false;
    }

    // 检查免打扰
    if (pref.quietHours?.enabled) {
      const now = new Date();
      const currentTime = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: pref.quietHours.timezone,
      });

      const { start, end } = pref.quietHours;
      const isQuiet = start <= end
        ? currentTime >= start && currentTime <= end
        : currentTime >= start || currentTime <= end;

      if (isQuiet) {
        return false;
      }
    }

    return true;
  }

  // 合并默认偏好
  private mergeWithDefaults(
    userPrefs: NotificationPreference[]
  ): NotificationPreference[] {
    const defaults = this.getDefaultPreferences();

    // 按 channel + type 合并
    const merged = new Map<string, NotificationPreference>();

    for (const def of defaults) {
      merged.set(`${def.channel}_${def.type}`, def);
    }

    for (const userPref of userPrefs) {
      const key = `${userPref.channel}_${userPref.type}`;
      merged.set(key, { ...merged.get(key), ...userPref });
    }

    return Array.from(merged.values());
  }

  private getDefaultPreferences(): NotificationPreference[] {
    const defaults: NotificationPreference[] = [];
    const channels = Object.values(NotificationChannel);
    const types = Object.values(NotificationType);

    for (const channel of channels) {
      for (const type of types) {
        defaults.push({
          userId: '',
          channel,
          type,
          enabled: this.getDefaultEnabled(type, channel),
          frequency: NotificationFrequency.INSTANT,
        });
      }
    }

    return defaults;
  }

  private getDefaultEnabled(type: NotificationType, channel: NotificationChannel): boolean {
    // 关键通知默认开启
    const criticalTypes = [
      NotificationType.PROJECT_COMPLETED,
      NotificationType.PROJECT_FAILED,
      NotificationType.SUBSCRIPTION_EXPIRING,
      NotificationType.SUBSCRIPTION_EXPIRED,
    ];

    // 非关键通知 Email 默认关闭
    const nonCriticalChannels = [NotificationChannel.EMAIL];

    if (criticalTypes.includes(type)) {
      return true;
    }

    if (nonCriticalChannels.includes(channel)) {
      return false;
    }

    return true;
  }
}
```

---

## 6. 相关文档

- [WebSocket 与实时通信](./WEBSOCKET_REALTIME.md)
- [用户系统](./USER_SYSTEM.md)
- [API 规格说明](./API_SPECIFICATION.md)

---

**最后更新**: 2026-04-14
