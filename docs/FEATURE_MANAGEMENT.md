# 特性管理 (Feature Management) 设计

## 1. 概述

本文档描述 ProjectFactory 系统的特性管理 (Feature Flags) 设计，支持渐进式发布和动态配置。

### 1.1 设计目标

| 目标 | 描述 |
|------|------|
| 灰度发布 | 支持按用户百分比发布 |
| 动态切换 | 运行时启用/禁用特性 |
| 条件匹配 | 支持复杂条件规则 |
| 实时生效 | 配置变更即时推送 |
| 回滚快速 | 一键关闭问题特性 |

### 1.2 特性管理架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        特性管理架构                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │   Owner     │ →  │   Dashboard │ →  │   SDK       │                     │
│  │   Portal    │    │   (Web)     │    │   (Client)  │                     │
│  └─────────────┘    └─────────────┘    └─────────────┘                     │
│         ↓                  ↓                  ↓                           │
│  ┌────────────────────────────────────────────────────────────┐            │
│  │                   Feature Store (Redis)                    │            │
│  └────────────────────────────────────────────────────────────┘            │
│                              ↓                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │   API       │    │   Eval      │    │   Notifier  │                     │
│  │   Server    │    │   Engine    │    │   (WS)     │                     │
│  └─────────────┘    └─────────────┘    └─────────────┘                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 数据模型

### 2.1 特性定义

```typescript
// src/features/types.ts
interface FeatureFlag {
  id: string;
  key: string;                    // 唯一标识符
  name: string;                   // 显示名称
  description: string;            // 描述
  enabled: boolean;              // 全局开关
  status: FeatureStatus;         // 发布状态

  // argeting 规则
  defaultValue: boolean | string | number | object;
  rules: TargetingRule[];

  // 变更历史
  createdAt: number;
  updatedAt: number;
  createdBy: string;

  // 元数据
  tags: string[];
  owner: string;
  rolloutPercentage?: number;
}

enum FeatureStatus {
  // 开发中
  DEV = 'dev',

  // 测试中
  TEST = 'test',

  // 灰度发布
  GRADUAL = 'gradual',

  // 全量发布
  RELEASE = 'release',

  // 禁用
  DISABLED = 'disabled',

  // 废弃
  DEPRECATED = 'deprecated',
}

interface TargetingRule {
  id: string;
  priority: number;              // 优先级 (数字越小越先)
  condition: RuleCondition;
  value: boolean | string | number | object;
  description?: string;
}

interface RuleCondition {
  type: 'user' | 'device' | 'context' | 'percentage';
  operator: 'eq' | 'neq' | 'in' | 'not_in' | 'gt' | 'lt' | 'contains' | 'regex';
  field: string;
  value: any;
}

interface FeatureContext {
  userId?: string;
  userAgent?: string;
  ip?: string;
  country?: string;
  platform?: string;
  appVersion?: string;
  tenantId?: string;
  attributes?: Record<string, unknown>;
}
```

### 2.2 预定义特性

```typescript
// 系统预置特性
const SYSTEM_FEATURES: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    key: 'new_code_generator',
    name: '新版代码生成器',
    description: '使用新的 LLM 提示词和生成策略',
    enabled: false,
    status: FeatureStatus.GRADUAL,
    defaultValue: false,
    rules: [
      {
        id: 'r1',
        priority: 1,
        condition: { type: 'percentage', operator: 'lt', field: 'userId', value: 10 },
        value: true,
        description: '10% 用户灰度',
      },
    ],
    tags: ['core', 'llm'],
    owner: 'platform-team',
    rolloutPercentage: 10,
  },
  {
    key: 'advanced_quality_metrics',
    name: '高级质量指标',
    description: '新增复杂度和可维护性指标',
    enabled: true,
    status: FeatureStatus.RELEASE,
    defaultValue: false,
    rules: [],
    tags: ['quality', 'analytics'],
    owner: 'quality-team',
  },
  {
    key: 'multi_agent_mode',
    name: '多 Agent 模式',
    description: '启用多 Agent 协作生成',
    enabled: false,
    status: FeatureStatus.TEST,
    defaultValue: false,
    rules: [
      {
        id: 'r1',
        priority: 1,
        condition: { type: 'user', operator: 'in', field: 'userId', value: ['user_internal_1', 'user_internal_2'] },
        value: true,
      },
    ],
    tags: ['experimental', 'agents'],
    owner: 'agent-team',
  },
];
```

---

## 3. 评估引擎

### 3.1 特性评估

```typescript
// src/features/evaluator.ts
class FeatureEvaluator {
  constructor(
    private featureStore: FeatureStore,
    private percentageHasher: PercentageHasher
  ) {}

  // 评估单个特性
  async evaluate(
    featureKey: string,
    context: FeatureContext
  ): Promise<EvaluationResult> {
    const feature = await this.featureStore.get(featureKey);

    if (!feature) {
      return {
        key: featureKey,
        value: null,
        reason: 'not_found',
      };
    }

    // 全局禁用
    if (!feature.enabled) {
      return {
        key: featureKey,
        value: feature.defaultValue,
        reason: 'globally_disabled',
      };
    }

    // 状态检查
    if (feature.status === FeatureStatus.DEPRECATED) {
      return {
        key: featureKey,
        value: feature.defaultValue,
        reason: 'deprecated',
      };
    }

    // 按优先级评估规则
    for (const rule of feature.rules.sort((a, b) => a.priority - b.priority)) {
      const matches = this.evaluateCondition(rule.condition, context);

      if (matches) {
        return {
          key: featureKey,
          value: rule.value,
          reason: `rule:${rule.id}`,
          matchedRule: rule,
        };
      }
    }

    // 返回默认值
    return {
      key: featureKey,
      value: feature.defaultValue,
      reason: 'default',
    };
  }

  // 批量评估
  async evaluateAll(
    context: FeatureContext
  ): Promise<Record<string, EvaluationResult>> {
    const features = await this.featureStore.getAll();
    const results: Record<string, EvaluationResult> = {};

    for (const feature of features) {
      results[feature.key] = await this.evaluate(feature.key, context);
    }

    return results;
  }

  // 评估条件
  private evaluateCondition(
    condition: RuleCondition,
    context: FeatureContext
  ): boolean {
    const value = this.getContextValue(condition.field, context);

    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'neq':
        return value !== condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(value);
      case 'gt':
        return typeof value === 'number' && value > condition.value;
      case 'lt':
        return typeof value === 'number' && value < condition.value;
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'regex':
        return new RegExp(condition.value).test(String(value));
      case 'percentage':
        return this.percentageHasher.isInPercentage(
          context.userId || context.ip || 'anonymous',
          condition.value as number
        );
      default:
        return false;
    }
  }

  private getContextValue(field: string, context: FeatureContext): unknown {
    return (context as any)[field] || context.attributes?.[field];
  }
}

interface EvaluationResult {
  key: string;
  value: boolean | string | number | object | null;
  reason: string;
  matchedRule?: TargetingRule;
}
```

### 3.2 百分比哈希

```typescript
// 确定性百分比分配
class PercentageHasher {
  private seed: number;

  constructor(seed: number = 0) {
    this.seed = seed;
  }

  // 确定性哈希 (相同输入总是得到相同结果)
  isInPercentage(
    identifier: string,
    percentage: number,
    salt: string = ''
  ): boolean {
    const hash = this.hash(`${salt}:${identifier}`);
    const bucket = hash % 100;
    return bucket < percentage;
  }

  private hash(input: string): number {
    let hash = this.seed;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  // 获取用户桶
  getBucket(identifier: string, salt: string = ''): number {
    return this.hash(`${salt}:${identifier}`) % 100;
  }
}
```

---

## 4. SDK 实现

### 4.1 客户端 SDK

```typescript
// src/features/client.ts
class FeatureClient {
  private evaluator: FeatureEvaluator;
  private store: Map<string, EvaluationResult> = new Map();
  private refreshInterval: number = 30000; // 30 秒
  private listeners: Set<(key: string, value: unknown) => void> = new Set();

  constructor(
    private apiBase: string,
    private context: FeatureContext
  ) {
    this.evaluator = new FeatureEvaluator(
      new RemoteFeatureStore(apiBase),
      new PercentageHasher()
    );
  }

  // 初始化 (预加载特性)
  async init(): Promise<void> {
    await this.refresh();

    // 定期刷新
    setInterval(() => this.refresh(), this.refreshInterval);

    // 订阅变更
    this.subscribeToUpdates();
  }

  // 获取特性值
  isEnabled(featureKey: string): boolean {
    const result = this.store.get(featureKey);
    return result?.value === true;
  }

  getValue<T>(featureKey: string, defaultValue: T): T {
    const result = this.store.get(featureKey);
    if (result?.value === null || result?.value === undefined) {
      return defaultValue;
    }
    return result.value as T;
  }

  // 获取所有启用的特性
  getEnabledFeatures(): string[] {
    return Array.from(this.store.entries())
      .filter(([, v]) => v.value === true)
      .map(([k]) => k);
  }

  // 刷新本地缓存
  async refresh(): Promise<void> {
    const results = await this.evaluator.evaluateAll(this.context);

    for (const [key, result] of Object.entries(results)) {
      const oldValue = this.store.get(key);
      this.store.set(key, result);

      // 通知变更
      if (oldValue?.value !== result.value) {
        this.notifyListeners(key, result.value);
      }
    }
  }

  // 订阅变更
  subscribe(callback: (key: string, value: unknown) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(key: string, value: unknown): void {
    for (const listener of this.listeners) {
      try {
        listener(key, value);
      } catch (e) {
        console.error('Feature listener error:', e);
      }
    }
  }

  // WebSocket 实时更新
  private subscribeToUpdates(): void {
    const ws = new WebSocket(`${this.apiBase}/features/subscribe`);

    ws.onmessage = (event) => {
      const { type, key, value } = JSON.parse(event.data);

      if (type === 'feature_changed') {
        this.store.set(key, value);
        this.notifyListeners(key, value);
      }
    };

    ws.onclose = () => {
      // 断线重连
      setTimeout(() => this.subscribeToUpdates(), 5000);
    };
  }
}

// React Hook
function useFeature(featureKey: string): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const featureClient = getFeatureClient();

    setEnabled(featureClient.isEnabled(featureKey));

    const unsubscribe = featureClient.subscribe((key, value) => {
      if (key === featureKey) {
        setEnabled(value === true);
      }
    });

    return unsubscribe;
  }, [featureKey]);

  return enabled;
}

// 使用示例
function ProjectGenerator() {
  const multiAgentEnabled = useFeature('multi_agent_mode');

  return multiAgentEnabled ? (
    <MultiAgentGenerator />
  ) : (
    <SingleAgentGenerator />
  );
}
```

---

## 5. 管理 API

### 5.1 管理接口

```typescript
// src/features/api.ts
interface FeatureAPI {
  // 列表
  list(): Promise<FeatureFlag[]>;

  // 获取
  get(key: string): Promise<FeatureFlag>;

  // 创建
  create(feature: CreateFeatureInput): Promise<FeatureFlag>;

  // 更新
  update(key: string, input: UpdateFeatureInput): Promise<FeatureFlag>;

  // 删除
  delete(key: string): Promise<void>;

  // 切换状态
  toggle(key: string, enabled: boolean): Promise<FeatureFlag>;

  // 添加规则
  addRule(key: string, rule: TargetingRule): Promise<FeatureFlag>;

  // 删除规则
  removeRule(key: string, ruleId: string): Promise<FeatureFlag>;

  // 批量操作
  bulkUpdate(keys: string[], input: BulkUpdateInput): Promise<void>;

  // 评估
  evaluate(key: string, context: FeatureContext): Promise<EvaluationResult>;

  // 审计日志
  getAuditLog(key: string): Promise<AuditLog[]>;
}

interface CreateFeatureInput {
  key: string;
  name: string;
  description?: string;
  defaultValue: boolean | string | number | object;
  enabled?: boolean;
  tags?: string[];
  owner?: string;
}

interface UpdateFeatureInput {
  name?: string;
  description?: string;
  defaultValue?: boolean | string | number | object;
  enabled?: boolean;
  status?: FeatureStatus;
  tags?: string[];
  owner?: string;
}
```

### 5.2 WebSocket 通知

```typescript
// WebSocket 实时推送
class FeatureNotifier {
  private subscribers: Map<string, Set<WebSocket>> = new Map();

  constructor(private redis: Redis) {
    this.subscribeToRedis();
  }

  async notify(featureKey: string, oldValue: unknown, newValue: unknown): Promise<void> {
    const message = JSON.stringify({
      type: 'feature_changed',
      key: featureKey,
      oldValue,
      newValue,
      timestamp: Date.now(),
    });

    // 推送给所有订阅者
    const subscribers = this.subscribers.get(featureKey) || new Set();
    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }

    // 发布到 Redis 供其他服务使用
    await this.redis.publish('feature_updates', message);
  }

  subscribe(featureKey: string, ws: WebSocket): void {
    if (!this.subscribers.has(featureKey)) {
      this.subscribers.set(featureKey, new Set());
    }
    this.subscribers.get(featureKey)!.add(ws);
  }

  unsubscribe(featureKey: string, ws: WebSocket): void {
    this.subscribers.get(featureKey)?.delete(ws);
  }

  private async subscribeToRedis(): Promise<void> {
    const subscriber = this.redis.duplicate();

    await subscriber.subscribe('feature_updates');

    subscriber.on('message', (_, message) => {
      const { key } = JSON.parse(message);
      this.subscribers.get(key)?.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    });
  }
}
```

---

## 6. 灰度发布策略

### 6.1 发布策略

```typescript
// 灰度发布配置
interface RolloutStrategy {
  type: 'gradual' | 'immediate' | 'scheduled';
  percentage?: number;
  schedule?: {
    startTime: Date;
    endTime?: Date;
    targetPercentage: number;
  };
  target?: {
    type: 'all' | 'user_list' | 'percentage' | 'attribute';
    value?: string[] | number;
  };
}

// 渐进式发布
async function gradualRollout(
  featureKey: string,
  targetPercentage: number,
  increment: number = 10,
  intervalMs: number = 60 * 60 * 1000 // 1 小时
): Promise<void> {
  const feature = await featureAPI.get(featureKey);

  for (let current = 0; current <= targetPercentage; current += increment) {
    await featureAPI.update(featureKey, {
      rules: [
        {
          id: 'rollout_rule',
          priority: 1,
          condition: {
            type: 'percentage',
            operator: 'lt',
            field: 'userId',
            value: current,
          },
          value: true,
          description: `Rollout ${current}%`,
        },
      ],
    });

    console.log(`Feature ${featureKey} rolled out to ${current}%`);

    // 等待间隔
    if (current < targetPercentage) {
      await sleep(intervalMs);
    }
  }
}

// 回滚
async function emergencyRollback(featureKey: string): Promise<void> {
  await featureAPI.update(featureKey, {
    enabled: false,
    status: FeatureStatus.DISABLED,
  });

  console.log(`Feature ${featureKey} emergency rollback completed`);
}
```

### 6.2 A/B 测试集成

```typescript
// 特性与 A/B 测试集成
interface Experiment {
  id: string;
  featureKey: string;
  variants: {
    name: string;
    value: boolean | string | number | object;
    percentage: number;
  }[];
  startTime: Date;
  endTime?: Date;
}

async function createExperimentFeature(
  experiment: Experiment
): Promise<string> {
  const featureKey = `exp:${experiment.id}`;

  const rules: TargetingRule[] = experiment.variants
    .sort((a, b) => a.percentage - b.percentage)
    .map((variant, index) => ({
      id: `variant_${index}`,
      priority: index + 1,
      condition: {
        type: 'percentage',
        operator: 'lt',
        field: 'userId',
        value: variant.percentage,
      } as RuleCondition,
      value: variant.value,
      description: `Variant: ${variant.name}`,
    }));

  await featureAPI.create({
    key: featureKey,
    name: `Experiment: ${experiment.id}`,
    description: 'A/B Test variant assignment',
    defaultValue: experiment.variants[0].value,
    enabled: true,
    status: FeatureStatus.GRADUAL,
    tags: ['experiment', experiment.id],
  });

  return featureKey;
}
```

---

## 7. 相关文档

- [A/B 测试与灰度发布](./AB_TESTING_FEATURE_FLAGS.md)
- [API 规格说明](./API_SPECIFICATION.md)
- [后端设计](./BACKEND_DESIGN.md)

---

**最后更新**: 2026-04-14
