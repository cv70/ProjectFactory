# 成本分析与优化

## 1. 成本构成

### 1.1 成本分类

```
总成本 = 基础设施成本 + LLM API成本 + 存储成本 + 运维成本
```

| 类别 | 说明 | 占比（预估） |
|------|------|-------------|
| 基础设施 | 服务器、网络、监控 | 30% |
| LLM API | OpenAI/Anthropic等 | 40% |
| 存储 | 数据库、向量存储、备份 | 15% |
| 运维 | 人力、工具、支持 | 15% |

### 1.2 基础设施成本

| 资源 | 规格 | 月成本 | 年成本 |
|------|------|--------|--------|
| Kubernetes集群 | 3节点 × 8C/16G | $300 | $3,600 |
| Load Balancer | ALB | $20 | $240 |
| CDN | Cloudflare免费版 | $0 | $0 |
| 监控 | Grafana Cloud免费 | $0 | $0 |
| **小计** | | **$320** | **$3,840** |

### 1.3 LLM API成本

#### OpenAI定价（2026）

| 模型 | 输入价格 | 输出价格 | 适用场景 |
|------|---------|---------|---------|
| GPT-4 | $0.03/1K | $0.06/1K | 复杂任务 |
| GPT-4 Turbo | $0.01/1K | $0.03/1K | 平衡选择 |
| GPT-3.5 Turbo | $0.0015/1K | $0.002/1K | 简单任务 |

#### 单个项目Token使用估算

```
需求分析:    2,000 输入 + 3,000 输出 = 5,000 tokens
架构设计:    4,000 输入 + 6,000 输出 = 10,000 tokens
代码生成:    20,000 输入 + 40,000 输出 = 60,000 tokens
质量检查:    10,000 输入 + 5,000 输出 = 15,000 tokens
---------------------------------------------------
总计:        36,000 输入 + 54,000 输出 = 90,000 tokens

使用GPT-4 Turbo:
输入成本: 36 × $0.01 = $0.36
输出成本: 54 × $0.03 = $1.62
总计: $1.98/项目
```

#### 月度成本估算

| 生成数量 | 月成本（GPT-4） | 月成本（GPT-4 Turbo） | 月成本（GPT-3.5） |
|---------|-----------------|---------------------|------------------|
| 10 | $19.80 | $19.80 | $1.62 |
| 50 | $99.00 | $99.00 | $8.10 |
| 100 | $198.00 | $198.00 | $16.20 |
| 500 | $990.00 | $990.00 | $81.00 |
| 1,000 | $1,980.00 | $1,980.00 | $162.00 |

### 1.4 存储成本

| 存储 | 用量 | 月成本 | 年成本 |
|------|------|--------|--------|
| SQLite | 10GB | $0 | $0 |
| 备份 | 500GB | $10 | $120 |
| **小计** | | **$10** | **$120** |

## 2. 成本优化策略

### 2.1 LLM成本优化

#### 策略1: 智能模型选择

```typescript
// optimization/model-selector.ts

interface ModelCost {
  name: string;
  inputCost: number;  // per 1K tokens
  outputCost: number;
  capabilities: string[];
}

const MODELS: Record<string, ModelCost> = {
  'gpt-4': {
    name: 'GPT-4',
    inputCost: 0.03,
    outputCost: 0.06,
    capabilities: ['complex-reasoning', 'code-generation', 'architecture'],
  },
  'gpt-4-turbo': {
    name: 'GPT-4 Turbo',
    inputCost: 0.01,
    outputCost: 0.03,
    capabilities: ['reasoning', 'code-generation'],
  },
  'gpt-3.5-turbo': {
    name: 'GPT-3.5 Turbo',
    inputCost: 0.0015,
    outputCost: 0.002,
    capabilities: ['simple-tasks', 'text-processing'],
  },
};

export function selectOptimalModel(
  task: string,
  complexity: 'low' | 'medium' | 'high'
): string {
  // 根据任务和复杂度选择模型
  if (task === 'requirement-analysis' && complexity === 'high') {
    return 'gpt-4-turbo';
  }
  if (task === 'code-generation' && complexity === 'low') {
    return 'gpt-3.5-turbo';
  }
  if (task === 'architecture-design') {
    return 'gpt-4';
  }
  return 'gpt-3.5-turbo'; // 默认最便宜的
}
```

**预期节省**: 20-40%

#### 策略2: 响应缓存

```typescript
// optimization/cache.ts

export class LLMMCache {
  private cache: Map<string, CachedResponse> = new Map();
  private readonly TTL = 24 * 60 * 60 * 1000; // 24小时

  async getOrCall(
    key: string,
    fn: () => Promise<string>
  ): Promise<string> {
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < this.TTL) {
      metrics.cacheHits++;
      return cached.response;
    }

    metrics.cacheMisses++;
    const response = await fn();
    this.cache.set(key, {
      response,
      timestamp: Date.now(),
    });
    return response;
  }

  generateKey(prompt: string, options: LLMOptions): string {
    return `${prompt}|${JSON.stringify(options)}`;
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): CacheStats {
    const total = metrics.cacheHits + metrics.cacheMisses;
    return {
      hits: metrics.cacheHits,
      misses: metrics.cacheMisses,
      hitRate: total > 0 ? metrics.cacheHits / total : 0,
      total: total,
    };
  }
}
```

**预期节省**: 30-50%

#### 策略3: Token优化

```typescript
// optimization/token-optimizer.ts

export function optimizePrompt(prompt: string): string {
  let optimized = prompt;

  // 1. 移除冗余表达
  optimized = optimized
    .replace(/\bI want you to\b/gi, '')
    .replace(/\bPlease\b/gi, '')
    .replace(/\bCould you\b/gi, '')
    .replace(/\bCan you\b/gi, '')
    .replace(/\bMake sure to\b/gi, '')
    .replace(/\bRemember to\b/gi, '')
    .replace(/\bDon't forget to\b/gi, '');

  // 2. 压缩空白
  optimized = optimized
    .replace(/\n{3,}/g, '\n\n')  // 最多2个换行
    .replace(/[ \t]+/g, ' ')    // 合并空格/tab
    .replace(/^\s+|\s+$/g, '');  // 去除首尾空格

  // 3. 使用简洁表达
  optimized = optimized
    .replace(/\bin order to\b/gi, 'to')
    .replace(/\bas a result of\b/gi, 'due to')
    .replace(/\bbased on the fact that\b/gi, 'since')
    .replace(/\bfor the purpose of\b/gi, 'for')
    .replace(/\bat this point in time\b/gi, 'now');

  return optimized.trim();
}

export function estimateTokens(text: string): number {
  // GPT-3.5/4 大约4个字符=1 token
  return Math.ceil(text.length / 4);
}

export function estimateCost(tokens: number, model: string): number {
  const costs = {
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
  };

  const modelCost = costs[model as keyof typeof costs];
  if (!modelCost) return 0;

  // 假设40%输入，60%输出
  const inputTokens = tokens * 0.4;
  const outputTokens = tokens * 0.6;

  return (inputTokens * modelCost.input + outputTokens * modelCost.output) / 1000;
}
```

**预期节省**: 10-20%

### 2.2 基础设施优化

#### 策略1: 自动扩缩容

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: projectfactory-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: projectfactory-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
```

**预期节省**: 20-40%（按实际使用）

#### 策略2: Spot实例

```yaml
# 使用AWS Spot实例节省70-90%
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig
metadata:
  name: projectfactory
managedNodeGroups:
  - name: spot-ng
    spot: true
    instanceType: mixed
    minSize: 2
    maxSize: 10
    desiredCapacity: 3
```

**预期节省**: 70-90%

### 2.3 存储优化

#### 策略1: 数据压缩

```typescript
// optimization/compression.ts

import { compress, decompress } from 'lz4';

export async function compressData(data: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    compress(data, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

export async function decompressData(data: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    decompress(data, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// 压缩率预估
// 文本: 60-70%
// JSON: 70-80%
// 代码: 50-60%
```

**预期节省**: 40-60%（存储空间）

#### 策略2: 数据生命周期管理

```yaml
# k8s/retention-policy.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: retention-policy
data:
  PROJECT_RETENTION_DAYS: "90"
  LOG_RETENTION_DAYS: "30"
  CACHE_RETENTION_DAYS: "7"
  BACKUP_RETENTION_DAYS: "365"
```

**预期节省**: 随数据增长而增加

## 3. 成本监控

### 3.1 成本追踪

```typescript
// monitoring/cost-tracker.ts

export interface CostRecord {
  timestamp: Date;
  project: string;
  agent: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export class CostTracker {
  private records: CostRecord[] = [];

  track(record: Omit<CostRecord, 'timestamp' | 'cost'>): void {
    const cost = this.calculateCost(
      record.inputTokens,
      record.outputTokens,
      record.model
    );

    this.records.push({
      ...record,
      timestamp: new Date(),
      cost,
    });
  }

  getDailyCost(date: Date): number {
    const dayRecords = this.records.filter(
      r => r.timestamp.toDateString() === date.toDateString()
    );
    return dayRecords.reduce((sum, r) => sum + r.cost, 0);
  }

  getMonthlyCost(year: number, month: number): number {
    const monthRecords = this.records.filter(
      r => r.timestamp.getFullYear() === year &&
           r.timestamp.getMonth() === month
    );
    return monthRecords.reduce((sum, r) => sum + r.cost, 0);
  }

  getProjectCost(projectId: string): ProjectCost {
    const projectRecords = this.records.filter(r => r.project === projectId);

    return {
      projectId,
      totalCost: projectRecords.reduce((sum, r) => sum + r.cost, 0),
      breakdown: this.groupByAgent(projectRecords),
      averageCost: this.calculateAverage(projectRecords),
    };
  }

  generateReport(startDate: Date, endDate: Date): CostReport {
    const periodRecords = this.records.filter(
      r => r.timestamp >= startDate && r.timestamp <= endDate
    );

    return {
      period: { start: startDate, end: endDate },
      totalCost: periodRecords.reduce((sum, r) => sum + r.cost, 0),
      byModel: this.groupByModel(periodRecords),
      byAgent: this.groupByAgent(periodRecords),
      byProject: this.groupByProject(periodRecords),
      daily: this.calculateDailyCosts(startDate, endDate),
    };
  }

  private calculateCost(input: number, output: number, model: string): number {
    // 根据模型定价计算成本
    return 0; // 实现
  }
}
```

### 3.2 成本告警

```typescript
// monitoring/cost-alerts.ts

export interface CostThreshold {
  period: 'hourly' | 'daily' | 'monthly';
  limit: number;
  action: 'alert' | 'throttle' | 'stop';
}

export const COST_THRESHOLDS: CostThreshold[] = [
  {
    period: 'hourly',
    limit: 50,
    action: 'alert',
  },
  {
    period: 'daily',
    limit: 500,
    action: 'throttle',
  },
  {
    period: 'daily',
    limit: 1000,
    action: 'stop',
  },
];

export class CostAlertManager {
  async checkThresholds(): Promise<void> {
    for (const threshold of COST_THRESHOLDS) {
      const currentCost = await this.getCostForPeriod(threshold.period);

      if (currentCost >= threshold.limit) {
        await this.handleThreshold(threshold, currentCost);
      }
    }
  }

  private async getCostForPeriod(period: string): Promise<number> {
    // 计算指定时间段的成本
    return 0;
  }

  private async handleThreshold(
    threshold: CostThreshold,
    currentCost: number
  ): Promise<void> {
    switch (threshold.action) {
      case 'alert':
        await this.sendAlert(currentCost);
        break;
      case 'throttle':
        await this.throttleOperations();
        break;
      case 'stop':
        await this.stopOperations();
        break;
    }
  }

  private async sendAlert(cost: number): Promise<void> {
    // 发送告警通知
  }

  private async throttleOperations(): Promise<void> {
    // 限制操作速率
  }

  private async stopOperations(): Promise<void> {
    // 停止新的生成任务
  }
}
```

## 4. ROI分析

### 4.1 成本效益计算

```
ROI = (收益 - 成本) / 成本 × 100%
```

| 指标 | 传统开发 | 自动化生成 | 改善 |
|------|---------|-----------|------|
| 单项目成本 | $10,000 | $20 | 99.8% |
| 开发周期 | 4周 | 4小时 | 97.1% |
| 人力投入 | 1人月 | 0人 | 100% |
| **月产出** | 1个项目 | 100个项目 | 10000% |

### 4.2 投资回报周期

```
前期投入（3个月）:
- 基础设施: $320 × 3 = $960
- 开发成本: 0（自我开发）
- LLM成本: $200 × 3 = $600
- 合计: $1,560

月度运营成本:
- 基础设施: $320
- LLM成本（100项目）: $200
- 存储: $10
- 合计: $530

收益计算:
假设每个项目价值: $10,000
月产出: 100个项目
月收益: $1,000,000
净收益: $1,000,000 - $530 = $999,470

ROI = ($999,470 × 12 - $1,560) / $1,560 × 100% = 768,600%

投资回收期: $1,560 / $999,470 = 0.0016个月 ≈ 1小时
```

## 5. 成本优化检查清单

- [ ] 实施模型智能选择
- [ ] 启用响应缓存
- [ ] 优化Prompt长度
- [ ] 配置自动扩缩容
- [ ] 使用Spot实例（适用时）
- [ ] 压缩存储数据
- [ ] 实施数据生命周期管理
- [ ] 设置成本告警
- [ ] 定期审查成本报告
- [ ] 评估替代LLM提供商

---

**版本**: 0.1.0
**更新日期**: 2026-04-14
**状态**: 设计阶段
