# 故障排查

## 1. 常见问题

### 1.1 Agent执行失败

#### 现象
- Agent执行过程中停止
- 出现"Agent failed"错误
- 项目生成无法继续

#### 原因分析
| 原因 | 检查方法 | 解决方案 |
|------|---------|---------|
| LLM API超时 | 检查网络连接 | 增加超时时间、重试 |
| LLM API错误 | 查看错误日志 | 检查API密钥、额度 |
| Prompt过长 | 检查token使用 | 简化Prompt |
| 内存不足 | 检查系统资源 | 增加内存、优化配置 |

#### 解决步骤

```bash
# 1. 查看Agent日志
kubectl logs -n projectfactory deployment/projectfactory-api -c api --tail=100

# 2. 检查LLM连接
curl -X POST https://api.openai.com/v1/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","prompt":"test","max_tokens":5}'

# 3. 检查系统资源
kubectl top pods -n projectfactory

# 4. 查看Agent执行状态
curl http://localhost:3000/api/v1/projects/:id
```

### 1.2 代码生成失败

#### 现象
- Development Agent无法生成代码
- 生成的代码无法编译
- 代码格式错误

#### 原因分析
| 原因 | 检查方法 | 解决方案 |
|------|---------|---------|
| 模板文件缺失 | 检查templates目录 | 重新部署模板 |
| Prompt不明确 | 查看生成的代码 | 优化Prompt模板 |
| 类型定义错误 | 检查类型错误 | 更新类型定义 |

#### 解决步骤

```bash
# 1. 检查模板
ls -la backend/templates/
curl http://localhost:3000/api/v1/generation/templates

# 2. 测试代码生成
curl -X POST http://localhost:3000/api/v1/generation/preview \
  -H "Content-Type: application/json" \
  -d '{
    "requirements": "Test project",
    "templateId": "tpl_crud_basic"
  }'

# 3. 查看代码日志
kubectl logs -n projectfactory deployment/projectfactory-api --tail=500 | grep -i "code"
```

### 1.3 质量检查失败

#### 现象
- Quality Agent报告质量问题
- 测试覆盖率不足
- 安全扫描失败

#### 原因分析
| 原因 | 检查方法 | 解决方案 |
|------|---------|---------|
| 生成的代码质量差 | 查看质量报告 | 优化代码生成Prompt |
| 测试生成不完整 | 检查测试文件 | 改进测试生成逻辑 |
| 安全规则过严 | 查看安全规则 | 调整安全规则 |

#### 解决步骤

```bash
# 1. 查看质量报告
curl http://localhost:3000/api/v1/projects/:id/quality

# 2. 运行静态分析
cd backend && npm run lint
cd frontend && npm run lint

# 3. 运行安全扫描
npm audit
npm run security:scan

# 4. 查看测试覆盖率
npm run test:coverage
```

### 1.4 部署失败

#### 现象
- 无法部署生成的项目
- Docker构建失败
- 健康检查失败

#### 原因分析
| 原因 | 检查方法 | 解决方案 |
|------|---------|---------|
| Dockerfile错误 | 查看构建日志 | 修复Dockerfile模板 |
| 依赖问题 | 检查package.json | 优化依赖管理 |
| 端口冲突 | 检查端口占用 | 使用不同端口 |

#### 解决步骤

```bash
# 1. 查看部署日志
kubectl logs -n projectfactory deployment/generated-project --tail=100

# 2. 检查构建状态
kubectl describe pod -n projectfactory generated-project-xxx

# 3. 本地测试构建
cd storage/projects/:id
docker build -t test .

# 4. 检查端口
netstat -tunlp | grep LISTEN
```

## 2. 性能问题

### 2.1 响应缓慢

#### 诊断

```bash
# 1. 检查API响应时间
curl -w "@curl-format.txt" http://localhost:3000/api/v1/projects

# curl-format.txt
# time_namelookup: %{time_namelookup}\n
# time_connect: %{time_connect}\n
# time_appconnect: %{time_appconnect}\n
# time_pretransfer: %{time_pretransfer}\n
# time_starttransfer: %{time_starttransfer}\n
# time_total: %{time_total}\n
# http_code: %{http_code}\n

# 2. 检查数据库查询
kubectl logs deployment/projectfactory-api | grep -i "db query"

# 3. 检查LLM调用时间
kubectl logs deployment/projectfactory-api | grep -i "llm.*duration"
```

#### 解决方案

| 问题 | 解决方案 |
|------|---------|
| 数据库慢查询 | 添加索引、优化查询 |
| LLM响应慢 | 使用缓存、并发调用 |
| 内存瓶颈 | 增加内存、优化算法 |
| 网络延迟 | 使用CDN、就近部署 |

### 2.2 高内存使用

#### 诊断

```bash
# 1. 检查内存使用
kubectl top pods -n projectfactory

# 2. 检查内存泄漏
kubectl logs deployment/projectfactory-api | grep -i "memory"

# 3. 检查缓存大小
redis-cli MEMORY STATS
```

#### 解决方案

```typescript
// 优化内存使用

// 1. 使用流式处理
async function processLargeData(data: unknown[]) {
  for (const item of data) {
    await processItem(item);
    // 不要在内存中积累所有结果
  }
}

// 2. 限制缓存大小
const MAX_CACHE_SIZE = 1000;
if (cache.size >= MAX_CACHE_SIZE) {
  cache.delete(cache.keys().next().value);
}

// 3. 及时释放资源
function cleanup() {
  // 释放大对象
  largeObject = null;

  // 清空缓存
  cache.clear();

  // 关闭连接
  connection.close();
}
```

## 3. 数据库问题

### 3.1 SQLite锁问题

#### 现象
- Database is locked
- 等待超时

#### 原因
- 并发写操作
- 长事务
- 文件系统权限

#### 解决方案

```typescript
// 1. 使用WAL模式
const db = new Database('data.db');
db.pragma('journal_mode = WAL');

// 2. 设置适当的超时
db.pragma('busy_timeout', 5000);

// 3. 使用连接池
const pool = new DatabasePool({
  filename: 'data.db',
  maxConnections: 10,
});

// 4. 避免长事务
async function transaction() {
  try {
    await db.exec('BEGIN TRANSACTION');
    // 快速操作
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}
```

### 3.2 数据损坏

#### 现象
- Database disk image is malformed
- 无法读取数据

#### 检测与修复

```bash
# 1. 检测损坏
sqlite3 data.db "PRAGMA integrity_check;"

# 2. 导出数据
sqlite3 data.db ".dump" > backup.sql

# 3. 创建新数据库
sqlite3 new.db ".read backup.sql"

# 4. 替换损坏的数据库
mv new.db data.db
```

## 4. LLM API问题

### 4.1 速率限制

#### 现象
- 429 Too Many Requests
- API调用失败

#### 解决方案

```typescript
// 实现速率限制
class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  async waitForToken(): Promise<void> {
    this.refillTokens();

    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    const waitTime = 1000 - (Date.now() - this.lastRefill);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    await this.waitForToken();
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + Math.floor(elapsed / 1000));
    this.lastRefill = now;
  }
}

// 使用
const limiter = new RateLimiter(60); // 每分钟60次
await limiter.waitForToken();
const result = await llm.complete(prompt);
```

### 4.2 成本优化

#### 策略

| 策略 | 说明 | 预期节省 |
|------|------|---------|
| 使用缓存 | 缓存LLM响应 | 30-50% |
| 模型选择 | 根据任务选择模型 | 20-40% |
| Token优化 | 优化Prompt | 10-20% |
| 批量处理 | 合并请求 | 5-10% |

```typescript
// 1. 实现缓存
async function getCachedOrGenerate(key: string, prompt: string): Promise<string> {
  const cached = await cache.get(key);
  if (cached) return cached;

  const result = await llm.complete(prompt);
  await cache.set(key, result, { ttl: 3600 });
  return result;
}

// 2. 模型选择
function selectModel(task: string): string {
  switch (task) {
    case 'simple':
      return 'gpt-3.5-turbo';  // 更便宜
    case 'complex':
      return 'gpt-4';           // 更强
    case 'code':
      return 'gpt-4';           // 更适合代码
    default:
      return 'gpt-3.5-turbo';
  }
}

// 3. Token优化
function optimizePrompt(prompt: string): string {
  // 移除冗余信息
  let optimized = prompt
    .replace(/(\r?\n){3,}/g, '\n\n')
    .replace(/\s+/g, ' ')
    .trim();

  // 使用简洁的表达
  optimized = optimized
    .replace(/I want you to/g, '')
    .replace(/Please/g, '')
    .replace(/Thank you/g, '');

  return optimized;
}
```

## 5. 紧急恢复

### 5.1 数据恢复流程

```bash
#!/bin/bash
# scripts/emergency-recovery.sh

# 1. 停止服务
kubectl scale deployment projectfactory-api --replicas=0 -n projectfactory

# 2. 从备份恢复
LATEST_BACKUP=$(aws s3 ls s3://projectfactory-backups/ | sort | tail -1 | awk '{print $2}')
aws s3 sync s3://projectfactory-backups/$LATEST_BACKUP /tmp/restore

# 3. 恢复数据库
kubectl cp /tmp/restore/data.db \
  projectfactory-api:/app/storage/data.db -n projectfactory

# 4. 重启服务
kubectl scale deployment projectfactory-api --replicas=3 -n projectfactory

# 5. 验证服务
kubectl rollout status deployment/projectfactory-api -n projectfactory
curl http://localhost:3000/health
```

### 5.2 快速回滚

```bash
#!/bin/bash
# scripts/rollback.sh

VERSION=$1

# 回滚API
kubectl rollout undo deployment/projectfactory-api --to-revision=$VERSION -n projectfactory

# 回滚Frontend
kubectl rollout undo deployment/projectfactory-frontend --to-revision=$VERSION -n projectfactory

# 等待回滚完成
kubectl rollout status deployment/projectfactory-api -n projectfactory
kubectl rollout status deployment/projectfactory-frontend -n projectfactory

# 验证
curl -f http://localhost:3000/health || echo "API健康检查失败"
```

## 6. 调试工具

### 6.1 日志分析

```typescript
// tools/log-analyzer.ts
export class LogAnalyzer {
  analyze(logs: LogEntry[]): AnalysisResult {
    return {
      errorCount: this.countErrors(logs),
      errorTypes: this.categorizeErrors(logs),
      timeline: this.buildTimeline(logs),
      patterns: this.detectPatterns(logs),
      recommendations: this.generateRecommendations(logs),
    };
  }

  private countErrors(logs: LogEntry[]): number {
    return logs.filter(l => l.level === 'error').length;
  }

  private categorizeErrors(logs: LogEntry[]): ErrorCategory[] {
    const categories: Record<string, number> = {};

    for (const log of logs) {
      if (log.level === 'error') {
        const type = this.extractErrorType(log.message);
        categories[type] = (categories[type] || 0) + 1;
      }
    }

    return Object.entries(categories)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }

  private detectPatterns(logs: LogEntry[]): Pattern[] {
    // 使用字符串相似度算法
    const patterns: Map<string, Pattern> = new Map();

    for (const log of logs) {
      const key = this.normalizeMessage(log.message);

      if (patterns.has(key)) {
        const pattern = patterns.get(key)!;
        pattern.count++;
        pattern.examples.push(log);
      } else {
        patterns.set(key, {
          message: log.message,
          count: 1,
          examples: [log],
        });
      }
    }

    return Array.from(patterns.values())
      .filter(p => p.count > 3) // 至少出现3次
      .sort((a, b) => b.count - a.count);
  }

  private generateRecommendations(logs: LogEntry[]): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // 基于错误模式生成建议
    const errors = this.categorizeErrors(logs);

    for (const error of errors) {
      recommendations.push(this.getErrorRecommendation(error));
    }

    return recommendations;
  }
}
```

### 6.2 性能分析

```typescript
// tools/performance-analyzer.ts
export class PerformanceAnalyzer {
  analyze(metrics: Metrics[]): PerformanceReport {
    return {
      avgResponseTime: this.calculateAvg(metrics, 'responseTime'),
      p50ResponseTime: this.calculatePercentile(metrics, 50, 'responseTime'),
      p95ResponseTime: this.calculatePercentile(metrics, 95, 'responseTime'),
      p99ResponseTime: this.calculatePercentile(metrics, 99, 'responseTime'),
      throughput: this.calculateThroughput(metrics),
      errorRate: this.calculateErrorRate(metrics),
      bottlenecks: this.identifyBottlenecks(metrics),
      recommendations: this.getOptimizationRecommendations(metrics),
    };
  }

  private identifyBottlenecks(metrics: Metrics[]): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // 数据库瓶颈
    const dbQueries = metrics.filter(m => m.type === 'db_query');
    const avgDbTime = this.calculateAvg(dbQueries, 'duration');
    if (avgDbTime > 100) {
      bottlenecks.push({
        type: 'database',
        severity: 'high',
        description: `Database queries are slow (${avgDbTime}ms avg)`,
        recommendation: 'Add indexes, optimize queries, or upgrade database',
      });
    }

    // LLM瓶颈
    const llmCalls = metrics.filter(m => m.type === 'llm_call');
    const avgLlmTime = this.calculateAvg(llmCalls, 'duration');
    if (avgLlmTime > 5000) {
      bottlenecks.push({
        type: 'llm',
        severity: 'medium',
        description: `LLM calls are slow (${avgLlmTime}ms avg)`,
        recommendation: 'Use caching, switch to faster model, or implement streaming',
      });
    }

    return bottlenecks;
  }
}
```

---

**版本**: 0.1.0
**更新日期**: 2026-04-14
**状态**: 设计阶段
