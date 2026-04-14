# 报告与数据分析系统

## 概述

报告与数据分析系统（Reporting & Analytics System）为ProjectFactory提供全面的数据分析和可视化能力。系统收集业务、技术和运营数据，通过多维度分析生成可操作的洞察，支持自定义报表、实时仪表盘和自动化报告，帮助管理层和运营团队做出数据驱动的决策。

## 核心价值

- **全面分析**：覆盖业务、技术、运营多维度的数据分析
- **实时洞察**：基于实时数据的快速响应能力
- **可视化**：丰富的图表和交互式仪表盘
- **自定义报表**：灵活的用户自定义报表能力
- **自动化报告**：定时生成和分发报告
- **趋势预测**：基于历史数据的趋势分析和预测

## 数据模型

### 分析事件

```typescript
// 分析事件类型
enum AnalyticsEventType {
  // 用户事件
  USER_LOGIN = 'user_login',
  USER_REGISTER = 'user_register',
  USER_LOGOUT = 'user_logout',

  // 项目事件
  PROJECT_CREATED = 'project_created',
  PROJECT_VIEWED = 'project_viewed',
  PROJECT_SHARED = 'project_shared',
  PROJECT_EXPORTED = 'project_exported',
  PROJECT_DELETED = 'project_deleted',

  // 生成事件
  GENERATION_STARTED = 'generation_started',
  GENERATION_COMPLETED = 'generation_completed',
  GENERATION_FAILED = 'generation_failed',
  GENERATION_CANCELLED = 'generation_cancelled',

  // 质量事件
  QUALITY_ASSESSED = 'quality_assessed',
  SECURITY_SCAN_COMPLETED = 'security_scan_completed',

  // 商业事件
  SUBSCRIPTION_STARTED = 'subscription_started',
  SUBSCRIPTION_RENEWED = 'subscription_renewed',
  SUBSCRIPTION_CANCELLED = 'subscription_cancelled',
  PAYMENT_COMPLETED = 'payment_completed',
}

// 分析事件
interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;

  // 时间
  timestamp: Date;

  // 用户上下文
  user?: {
    id: string;
  };

  // 实体上下文
  entity?: {
    type: string;
    id: string;
  };

  // 属性
  properties: Record<string, any>;

  // 上下文
  context: {
    ip?: string;
    userAgent?: string;
    sessionId?: string;
    tenantId?: string;
  };
}

// 事件聚合
interface AggregatedEvent {
  type: AnalyticsEventType;
  period: TimePeriod;

  // 计数
  count: number;
  uniqueUsers: number;
  uniqueSessions: number;

  // 数值属性
  sums: Record<string, number>;
  averages: Record<string, number>;
  extremes: Record<string, { min: number; max: number }>;

  // 分布
  distributions: Record<string, Record<string, number>>;
}
```

### 核心指标定义

```typescript
// 业务指标
const BUSINESS_METRICS = {
  // 活跃用户
  active_users: {
    name: 'Active Users',
    description: 'Unique users who performed at least one action',
    aggregation: 'unique_count',
    timeRanges: ['daily', 'weekly', 'monthly'],
    format: 'number',
  },

  // 新增用户
  new_users: {
    name: 'New Users',
    description: 'New user registrations',
    aggregation: 'count',
    timeRanges: ['daily', 'weekly', 'monthly'],
    format: 'number',
  },

  // 用户留存
  user_retention: {
    name: 'User Retention Rate',
    description: 'Percentage of users who return after N days',
    aggregation: 'retention',
    timeRanges: ['day_1', 'day_7', 'day_30'],
    format: 'percentage',
  },

  // 项目数量
  projects_count: {
    name: 'Total Projects',
    description: 'Total number of projects created',
    aggregation: 'count',
    timeRanges: ['daily', 'weekly', 'monthly', 'cumulative'],
    format: 'number',
  },

  // 生成次数
  generations_count: {
    name: 'Generation Count',
    description: 'Total number of generation tasks executed',
    aggregation: 'count',
    timeRanges: ['daily', 'weekly', 'monthly'],
    format: 'number',
  },

  // 生成成功率
  generation_success_rate: {
    name: 'Generation Success Rate',
    description: 'Percentage of successful generations',
    aggregation: 'rate',
    formula: 'generations_completed / generations_started * 100',
    timeRanges: ['daily', 'weekly', 'monthly'],
    format: 'percentage',
  },

  // 平均生成时间
  avg_generation_time: {
    name: 'Average Generation Time',
    description: 'Average time to complete a generation',
    aggregation: 'average',
    sourceField: 'generation_duration_seconds',
    timeRanges: ['daily', 'weekly', 'monthly'],
    format: 'duration',
  },

  // 项目质量分
  avg_quality_score: {
    name: 'Average Quality Score',
    description: 'Average quality score of generated projects',
    aggregation: 'average',
    sourceField: 'quality_score',
    timeRanges: ['daily', 'weekly', 'monthly'],
    format: 'score',
  },
};

// 技术指标
const TECHNICAL_METRICS = {
  // API延迟
  api_latency_p50: {
    name: 'API Latency P50',
    description: '50th percentile API response time',
    aggregation: 'percentile',
    percentile: 50,
    sourceField: 'http_request_duration_seconds',
    format: 'duration',
  },

  api_latency_p95: {
    name: 'API Latency P95',
    description: '95th percentile API response time',
    aggregation: 'percentile',
    percentile: 95,
    sourceField: 'http_request_duration_seconds',
    format: 'duration',
  },

  api_latency_p99: {
    name: 'API Latency P99',
    description: '99th percentile API response time',
    aggregation: 'percentile',
    percentile: 99,
    sourceField: 'http_request_duration_seconds',
    format: 'duration',
  },

  // 错误率
  error_rate: {
    name: 'Error Rate',
    description: 'Percentage of failed API requests',
    aggregation: 'rate',
    formula: 'errors / total_requests * 100',
    format: 'percentage',
  },

  // 吞吐量
  throughput: {
    name: 'API Throughput',
    description: 'Requests per second',
    aggregation: 'rate',
    sourceField: 'http_requests_total',
    format: 'rps',
  },
};

// 财务指标
const FINANCIAL_METRICS = {
  // 收入
  monthly_recurring_revenue: {
    name: 'Monthly Recurring Revenue (MRR)',
    description: 'Predictable monthly revenue from subscriptions',
    aggregation: 'sum',
    sourceField: 'subscription.amount',
    format: 'currency',
  },

  // 客户终身价值
  customer_lifetime_value: {
    name: 'Customer Lifetime Value',
    description: 'Predicted total revenue from a customer',
    aggregation: 'average',
    format: 'currency',
  },

  // 客户获取成本
  customer_acquisition_cost: {
    name: 'Customer Acquisition Cost',
    description: 'Average cost to acquire a new customer',
    aggregation: 'average',
    formula: 'total_marketing_spend / new_customers',
    format: 'currency',
  },

  // 流失率
  churn_rate: {
    name: 'Churn Rate',
    description: 'Percentage of customers who cancelled',
    aggregation: 'rate',
    formula: 'cancelled_subscriptions / total_subscriptions * 100',
    format: 'percentage',
  },
};
```

## 分析引擎

### 实时分析

```typescript
// 实时分析服务
class RealtimeAnalyticsService {
  private redis: Redis;
  private aggregator: StreamAggregator;

  // 记录事件
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    // 1. 验证事件
    this.validateEvent(event);

    // 2. 写入流
    await this.writeToStream(event);

    // 3. 更新实时计数器
    await this.updateCounters(event);

    // 4. 触发实时告警（如需要）
    await this.checkRealtimeAlerts(event);
  }

  // 更新实时计数器
  private async updateCounters(event: AnalyticsEvent): Promise<void> {
    const pipeline = this.redis.pipeline();

    // 增加事件计数
    const day = dayjs(event.timestamp).format('YYYY-MM-DD');
    const hour = dayjs(event.timestamp).format('YYYY-MM-DD-HH');

    // 日计数
    pipeline.incr(`analytics:${event.type}:day:${day}`);
    pipeline.expire(`analytics:${event.type}:day:${day}`, 90 * 24 * 3600);

    // 小时计数
    pipeline.incr(`analytics:${event.type}:hour:${hour}`);
    pipeline.expire(`analytics:${event.type}:hour:${hour}`, 7 * 24 * 3600);

    // 用户计数
    if (event.user) {
      pipeline.sadd(`analytics:users:day:${day}`, event.user.id);
    }

    await pipeline.exec();
  }

  // 获取实时指标
  async getRealtimeMetrics(types: AnalyticsEventType[]): Promise<RealtimeMetrics> {
    const now = dayjs();
    const today = now.format('YYYY-MM-DD');
    const hour = now.format('YYYY-MM-DD-HH');

    const metrics: RealtimeMetrics = {
      timestamp: new Date(),
      period: 'realtime',
      events: {},
    };

    for (const type of types) {
      const [dayCount, hourCount] = await Promise.all([
        this.redis.get(`analytics:${type}:day:${today}`),
        this.redis.get(`analytics:${type}:hour:${hour}`),
      ]);

      metrics.events[type] = {
        today: parseInt(dayCount || '0'),
        thisHour: parseInt(hourCount || '0'),
        trend: await this.calculateTrend(type, today),
      };
    }

    return metrics;
  }

  // 计算趋势
  private async calculateTrend(type: string, today: string): Promise<TrendDirection> {
    const todayCount = await this.redis.get(`analytics:${type}:day:${today}`);
    const yesterday = dayjs(today).subtract(1, 'day').format('YYYY-MM-DD');
    const yesterdayCount = await this.redis.get(`analytics:${type}:day:${yesterday}`);

    const todayVal = parseInt(todayCount || '0');
    const yesterdayVal = parseInt(yesterdayCount || '0');

    if (todayVal > yesterdayVal * 1.1) return 'up';
    if (todayVal < yesterdayVal * 0.9) return 'down';
    return 'stable';
  }
}
```

### 聚合分析

```typescript
// 聚合分析服务
class AggregationAnalyticsService {
  // 聚合事件
  async aggregate(
    eventType: AnalyticsEventType,
    period: TimePeriod
  ): Promise<AggregatedEvent> {
    const startTime = this.getPeriodStart(period);
    const endTime = this.getPeriodEnd(period);

    // 查询原始事件
    const events = await this.eventStore.query({
      type: eventType,
      timestamp: { $gte: startTime, $lt: endTime },
    });

    // 计算聚合
    return this.computeAggregation(eventType, period, events);
  }

  // 计算聚合
  private computeAggregation(
    eventType: AnalyticsEventType,
    period: TimePeriod,
    events: AnalyticsEvent[]
  ): AggregatedEvent {
    const aggregated: AggregatedEvent = {
      type: eventType,
      period,
      count: events.length,
      uniqueUsers: new Set(events.filter(e => e.user).map(e => e.user!.id)).size,
      uniqueSessions: new Set(events.filter(e => e.context.sessionId).map(e => e.context.sessionId)).size,
      sums: {},
      averages: {},
      extremes: {},
      distributions: {},
    };

    // 聚合数值属性
    const numericProperties = this.getNumericProperties(eventType);

    for (const prop of numericProperties) {
      const values = events.map(e => e.properties[prop]).filter(v => typeof v === 'number');

      if (values.length > 0) {
        aggregated.sums[prop] = values.reduce((a, b) => a + b, 0);
        aggregated.averages[prop] = values.reduce((a, b) => a + b, 0) / values.length;
        aggregated.extremes[prop] = {
          min: Math.min(...values),
          max: Math.max(...values),
        };
      }
    }

    // 聚合分布
    const categoricalProperties = this.getCategoricalProperties(eventType);

    for (const prop of categoricalProperties) {
      const distribution: Record<string, number> = {};

      for (const event of events) {
        const value = event.properties[prop];
        if (value !== undefined && value !== null) {
          distribution[String(value)] = (distribution[String(value)] || 0) + 1;
        }
      }

      aggregated.distributions[prop] = distribution;
    }

    return aggregated;
  }

  // 时间序列分析
  async getTimeSeries(
    metric: string,
    period: TimePeriod,
    granularity: 'hour' | 'day' | 'week' | 'month'
  ): Promise<TimeSeriesDataPoint[]> {
    const buckets = this.computeTimeBuckets(period, granularity);

    const pipeline = [
      { $match: { type: metric, timestamp: this.getPeriodFilter(period) } },
      { $bucket: { /* ... */ } },
    ];

    return this.eventStore.aggregate(pipeline);
  }
}

// 时间周期
interface TimePeriod {
  type: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  start: Date;
  end: Date;
}

// 时间序列数据点
interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  meta?: Record<string, any>;
}
```

### 漏斗分析

```typescript
// 漏斗分析
class FunnelAnalytics {
  // 定义漏斗
  interface FunnelDefinition {
    name: string;
    steps: FunnelStep[];
    timeWindow?: number;  // 天数
  }

  interface FunnelStep {
    name: string;
    event: AnalyticsEventType;
    conditions?: Record<string, any>;
  }

  // 分析漏斗
  async analyzeFunnel(
    definition: FunnelDefinition,
    period: TimePeriod
  ): Promise<FunnelResult> {
    const results: FunnelStepResult[] = [];

    let previousCount = 0;
    let totalUsers = await this.getUniqueUsers(definition.steps[0].event, period);

    for (let i = 0; i < definition.steps.length; i++) {
      const step = definition.steps[i];

      // 获取满足条件的用户
      const stepUsers = await this.getUsersForStep(step, period);

      // 计算转化
      const dropoff = i === 0 ? 0 : previousCount - stepUsers.size;
      const conversionRate = previousCount > 0 ? stepUsers.size / previousCount : 1;

      results.push({
        step: step.name,
        event: step.event,
        users: stepUsers.size,
        conversionRate,
        dropoff,
        dropoffRate: previousCount > 0 ? dropoff / previousCount : 0,
      });

      previousCount = stepUsers.size;
    }

    // 计算总体转化
    const startUsers = results[0].users;
    const endUsers = results[results.length - 1].users;
    const overallConversion = startUsers > 0 ? endUsers / startUsers : 0;

    return {
      name: definition.name,
      period,
      steps: results,
      overallConversion,
      averageConversionRate: results.slice(1).reduce((a, r) => a + r.conversionRate, 0) / (results.length - 1),
    };
  }

  // 预设漏斗
  const PRESET_FUNNELS: FunnelDefinition[] = [
    {
      name: 'User Onboarding',
      steps: [
        { name: 'Register', event: AnalyticsEventType.USER_REGISTER },
        { name: 'First Project', event: AnalyticsEventType.PROJECT_CREATED },
        { name: 'First Generation', event: AnalyticsEventType.GENERATION_STARTED },
        { name: 'Generation Complete', event: AnalyticsEventType.GENERATION_COMPLETED },
      ],
      timeWindow: 14,  // 14天内
    },
    {
      name: 'Project Creation',
      steps: [
        { name: 'Create Project', event: AnalyticsEventType.PROJECT_CREATED },
        { name: 'Start Generation', event: AnalyticsEventType.GENERATION_STARTED },
        { name: 'Generation Complete', event: AnalyticsEventType.GENERATION_COMPLETED },
        { name: 'Quality Check', event: AnalyticsEventType.QUALITY_ASSESSED },
      ],
    },
  ];
}
```

## 报表系统

### 报表模型

```typescript
// 报表定义
interface Report {
  id: string;
  name: string;
  description?: string;

  // 报表类型
  type: 'standard' | 'custom' | 'scheduled';

  // 数据源
  dataSource: {
    type: 'metrics' | 'events' | 'sql';
    query?: string;
    metrics?: string[];
    eventTypes?: AnalyticsEventType[];
  };

  // 可视化配置
  visualization: {
    type: 'table' | 'chart' | 'metric' | 'funnel' | 'heatmap';
    chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
    options?: ChartOptions;
  };

  // 时间范围
  timeRange: {
    preset?: 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'this_month' | 'last_month';
    custom?: { start: Date; end: Date };
  };

  // 过滤器
  filters?: ReportFilter[];

  // 刷新间隔
  refreshInterval?: number;  // 秒

  // 权限
  visibility: 'private' | 'team' | 'public';

  // 所有者
  createdBy: string;

  timestamps: {
    createdAt: Date;
    updatedAt: Date;
    lastRefreshedAt?: Date;
  };
}

interface ReportFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt' | 'in';
  value: any;
}

// 预设报表
const STANDARD_REPORTS: Report[] = [
  {
    id: 'overview_dashboard',
    name: 'Overview Dashboard',
    type: 'standard',
    dataSource: {
      type: 'metrics',
      metrics: ['active_users', 'projects_count', 'generations_count', 'generation_success_rate'],
    },
    visualization: {
      type: 'metric',
      options: { layout: 'grid' },
    },
    timeRange: { preset: 'today' },
    refreshInterval: 300,
    visibility: 'public',
  },

  {
    id: 'generation_analytics',
    name: 'Generation Analytics',
    type: 'standard',
    dataSource: {
      type: 'events',
      eventTypes: [AnalyticsEventType.GENERATION_STARTED, AnalyticsEventType.GENERATION_COMPLETED],
    },
    visualization: {
      type: 'chart',
      chartType: 'line',
      options: { showLegend: true, stacked: false },
    },
    timeRange: { preset: 'last_7_days' },
    filters: [
      { field: 'properties.status', operator: 'equals', value: 'success' },
    ],
  },

  {
    id: 'user_retention',
    name: 'User Retention',
    type: 'standard',
    dataSource: {
      type: 'metrics',
      metrics: ['user_retention'],
    },
    visualization: {
      type: 'chart',
      chartType: 'line',
    },
    timeRange: { preset: 'last_30_days' },
  },
];
```

### 报表生成

```typescript
// 报表服务
class ReportService {
  // 生成报表
  async generateReport(
    report: Report,
    options?: GenerateOptions
  ): Promise<ReportData> {
    // 1. 构建查询
    const query = this.buildQuery(report);

    // 2. 执行查询
    const rawData = await this.executeQuery(query);

    // 3. 转换数据
    const transformedData = this.transformData(rawData, report);

    // 4. 应用过滤器
    const filteredData = this.applyFilters(transformedData, report.filters);

    // 5. 计算汇总
    const aggregatedData = this.calculateAggregations(filteredData, report);

    return {
      reportId: report.id,
      generatedAt: new Date(),
      timeRange: options?.timeRange || report.timeRange,
      data: aggregatedData,
      metadata: {
        totalRows: filteredData.length,
        queryTime: 0, // 记录查询时间
      },
    };
  }

  // 导出报表
  async exportReport(
    reportId: string,
    format: 'pdf' | 'csv' | 'excel'
  ): Promise<ExportFile> {
    const report = await this.reportStore.findById(reportId);
    const data = await this.generateReport(report);

    switch (format) {
      case 'csv':
        return this.exportCSV(data);
      case 'excel':
        return this.exportExcel(data);
      case 'pdf':
        return this.exportPDF(data);
    }
  }
}
```

## 自动化报告

### 定时报告

```typescript
// 定时报告
interface ScheduledReport {
  id: string;
  name: string;

  // 关联报表
  reportId: string;

  // 调度
  schedule: {
    type: 'daily' | 'weekly' | 'monthly';
    time: string;           // HH:mm
    dayOfWeek?: number;     // 周几 (0-6)
    dayOfMonth?: number;    // 月几 (1-31)
    timezone: string;
  };

  // 分发
  delivery: {
    type: 'email' | 'webhook' | 'storage';
    recipients?: string[];
    webhookUrl?: string;
    storagePath?: string;
  };

  // 格式
  format: 'pdf' | 'csv' | 'excel';

  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  createdBy: string;
}

// 报告调度器
class ReportScheduler {
  private cron: Cron;

  async scheduleReport(scheduled: ScheduledReport): Promise<void> {
    const cronExpr = this.buildCronExpression(scheduled.schedule);

    await this.cron.schedule(cronExpr, async () => {
      await this.executeScheduledReport(scheduled);
    }, {
      timezone: scheduled.schedule.timezone,
    });
  }

  private async executeScheduledReport(scheduled: ScheduledReport): Promise<void> {
    // 1. 生成报表
    const report = await this.reportService.generateReport(
      await this.reportStore.findById(scheduled.reportId),
      { timeRange: this.getTimeRange(scheduled.schedule) }
    );

    // 2. 导出
    const file = await this.reportService.exportReport(
      scheduled.reportId,
      scheduled.format
    );

    // 3. 分发
    await this.deliverReport(file, scheduled.delivery);

    // 4. 更新状态
    scheduled.lastRun = new Date();
    scheduled.nextRun = this.getNextRun(scheduled.schedule);
    await this.scheduledReportStore.save(scheduled);
  }
}
```

## 可视化配置

### 图表配置

```typescript
// 图表选项
interface ChartOptions {
  // 标题
  title?: string;
  subtitle?: string;

  // 图例
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';

  // 轴
  xAxis?: {
    label?: string;
    type?: 'category' | 'time' | 'linear';
    format?: string;
  };
  yAxis?: {
    label?: string;
    type?: 'linear' | 'log';
    format?: string;
    min?: number;
    max?: number;
  };

  // 工具提示
  tooltip?: {
    show?: boolean;
    format?: string;
  };

  // 颜色
  colors?: string[];

  // 标注
  annotations?: Annotation[];
}

interface Annotation {
  type: 'line' | 'area' | 'point';
  value: number | Date;
  label?: string;
  color?: string;
  style?: 'solid' | 'dashed';
}

// 预设主题
const CHART_THEMES = {
  default: {
    colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
    fontFamily: 'Inter, sans-serif',
  },
  monochrome: {
    colors: ['#111827', '#374151', '#6b7280', '#9ca3af', '#d1d5db'],
    fontFamily: 'Inter, sans-serif',
  },
  vibrant: {
    colors: ['#06b6d4', '#8b5cf6', '#ec4899', '#f97316', '#84cc16'],
    fontFamily: 'Inter, sans-serif',
  },
};
```

## 配置示例

```yaml
# 报告与分析配置
reporting:
  # 数据保留
  retention:
    events: "90d"
    aggregated: "2y"
    reports: "1y"

  # 实时分析
  realtime:
    enabled: true
    stream_processing: "redis"
    window_size: "1h"
    metrics_refresh: "5s"

  # 报表生成
  report_generation:
    max_execution_time: "5m"
    max_rows: 100000
    cache_enabled: true
    cache_ttl: "5m"

  # 调度
  scheduling:
    enabled: true
    max_concurrent: 3
    timezone: "UTC"

  # 导出
  export:
    max_file_size: "50MB"
    formats: ["pdf", "csv", "excel"]

  # 可视化
  visualization:
    default_theme: "default"
    animations: true
    responsive: true
```

---

**最后更新**: 2026-04-14
