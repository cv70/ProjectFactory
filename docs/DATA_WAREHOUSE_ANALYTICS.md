# 数据仓库与数据分析设计

## 概述

本文档定义 ProjectFactory 系统的数据仓库（Data Warehouse）与数据分析（Analytics）架构，支持业务洞察、性能分析、趋势预测和决策支持，实现数据驱动的产品迭代。

## 1. 数据架构概览

### 1.1 数据流架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              数据流架构                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│  │   OLTP      │     │   事件      │     │   外部      │                   │
│  │  SQLite     │────▶│   日志      │     │   数据      │                   │
│  │  (主数据)   │     │             │     │   (GITHUB等) │                   │
│  └─────────────┘     └─────────────┘     └─────────────┘                   │
│         │                   │                   │                            │
│         └───────────────────┴───────────────────┘                            │
│                             │                                                │
│                    ┌────────▼────────┐                                     │
│                    │   数据集成层      │                                     │
│                    │  (ETL/CDC)      │                                     │
│                    └────────┬────────┘                                     │
│                             │                                                │
│         ┌───────────────────┼───────────────────┐                          │
│         │                   │                   │                          │
│  ┌──────▼──────┐     ┌──────▼──────┐     ┌──────▼──────┐                  │
│  │   数据湖     │     │   数据仓库   │     │   流处理    │                  │
│  │  (原始数据)  │     │ (聚合数据)   │     │  (实时)     │                  │
│  └─────────────┘     └─────────────┘     └─────────────┘                  │
│                             │                                                │
│                    ┌────────▼────────┐                                     │
│                    │   分析服务层     │                                     │
│                    │  (OLAP/BI)      │                                     │
│                    └────────┬────────┘                                     │
│                             │                                                │
│         ┌───────────────────┼───────────────────┐                          │
│         │                   │                   │                          │
│  ┌──────▼──────┐     ┌──────▼──────┐     ┌──────▼──────┐                  │
│  │   仪表板    │     │   报表      │     │   API       │                  │
│  │             │     │             │     │  (分析)     │                  │
│  └─────────────┘     └─────────────┘     └─────────────┘                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 数据模型（星型模型）

```typescript
// src/analytics/dimensional-model.ts

// 事实表
interface ProjectGenerationFact {
  // 代理键
  factId: string;
  projectId: string;

  // 时间维度
  dateId: number;           // YYYYMMDD 格式
  timeId: number;           // 时间戳
  hourOfDay: number;
  dayOfWeek: number;
  month: number;
  quarter: number;
  year: number;

  // 租户维度
  tenantId: string;
  tenantPlan: string;

  // 项目维度
  projectType: string;
  projectStatus: string;
  projectComplexity: 'simple' | 'medium' | 'complex';

  // 质量维度
  qualityScore: number;
  testCoverage: number;
  lintErrorCount: number;
  buildSuccess: boolean;

  // 指标
  generationDurationSeconds: number;
  llmTokensUsed: number;
  llmCostUsd: number;
  iterationCount: number;
  fileCount: number;

  // 状态标志
  isSuccess: boolean;
  isFirstAttempt: boolean;
  isWithinSla: boolean;
}

// 维度表
interface DateDimension {
  dateId: number;           // YYYYMMDD
  date: Date;
  dayOfWeek: string;
  dayOfWeekShort: string;
  dayOfMonth: number;
  dayOfYear: number;
  weekOfYear: number;
  monthName: string;
  monthNameShort: string;
  month: number;
  quarter: number;
  quarterName: string;
  year: number;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
}

interface TenantDimension {
  tenantId: string;
  tenantName: string;
  plan: string;
  planTier: number;
  createdAt: Date;
  region: string;
  industry?: string;
  companySize?: string;
  isActive: boolean;
}

interface ProjectDimension {
  projectId: string;
  projectName: string;
  projectType: string;
  techStack: string[];
  complexity: 'simple' | 'medium' | 'complex';
  hasTests: boolean;
  hasDocumentation: boolean;
  isPublic: boolean;
}

interface LLMCallFact {
  factId: string;
  timestamp: Date;

  // 维度
  tenantId: string;
  agentType: string;         // architect, coder, reviewer, etc.
  model: string;             // gpt-4o, claude-3-5-sonnet, etc.

  // 指标
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  costUsd: number;

  // 状态
  isSuccess: boolean;
  errorCode?: string;
  isCached: boolean;
  isRetry: boolean;
}
```

## 2. 数据管道

### 2.1 ETL 管道

```typescript
// src/analytics/etl-pipeline.ts

interface ETLPipeline {
  id: string;
  name: string;
  description: string;

  // 源配置
  source: {
    type: 'database' | 'api' | 'file' | 'stream';
    connection: string;
    query?: string;
    schedule?: string;       // cron 表达式
  };

  // 转换配置
  transformations: Transformation[];

  // 目标配置
  destination: {
    type: 'warehouse' | 'lake' | 'database';
    table: string;
    writeMode: 'append' | 'upsert' | 'overwrite';
  };

  // 状态
  status: 'idle' | 'running' | 'failed' | 'disabled';
  lastRun?: Date;
  lastSuccess?: Date;
  nextRun?: Date;
}

type Transformation =
  | { type: 'filter'; condition: string }
  | { type: 'map'; mappings: Record<string, string> }
  | { type: 'aggregate'; groupBy: string[]; aggregations: Aggregation[] }
  | { type: 'join'; otherTable: string; joinKey: string; joinType: 'inner' | 'left' | 'right' }
  | { type: 'deduplicate'; keys: string[] };

interface Aggregation {
  field: string;
  function: 'sum' | 'count' | 'avg' | 'min' | 'max' | 'count_distinct';
  alias: string;
}

// ETL 执行器
class ETLPipelineExecutor {
  private warehouse: DataWarehouse;
  private logger: Logger;

  async execute(pipeline: ETLPipeline): Promise<ETLResult> {
    const startTime = Date.now();
    let recordsProcessed = 0;
    let recordsFailed = 0;
    const errors: string[] = [];

    console.log(`Starting ETL pipeline: ${pipeline.name}`);

    try {
      // 1. 提取数据
      const sourceData = await this.extract(pipeline.source);

      // 2. 转换数据
      let transformedData = sourceData;
      for (const transformation of pipeline.transformations) {
        transformedData = await this.transform(transformedData, transformation);
      }

      // 3. 加载数据
      const loadResult = await this.load(
        pipeline.destination,
        transformedData
      );

      recordsProcessed = loadResult.recordsProcessed;
      recordsFailed = loadResult.recordsFailed;
      errors.push(...loadResult.errors);

      const result: ETLResult = {
        pipelineId: pipeline.id,
        status: 'success',
        startTime: new Date(startTime),
        endTime: new Date(),
        durationMs: Date.now() - startTime,
        recordsProcessed,
        recordsFailed,
        errors,
      };

      await this.logResult(result);

      return result;
    } catch (error) {
      const result: ETLResult = {
        pipelineId: pipeline.id,
        status: 'failed',
        startTime: new Date(startTime),
        endTime: new Date(),
        durationMs: Date.now() - startTime,
        recordsProcessed,
        recordsFailed,
        errors: [...errors, (error as Error).message],
      };

      await this.logResult(result);
      await this.sendFailureAlert(pipeline, result);

      return result;
    }
  }

  // 数据提取
  private async extract(source: ETLPipeline['source']): Promise<any[]> {
    switch (source.type) {
      case 'database':
        return await this.extractFromDatabase(source);

      case 'api':
        return await this.extractFromAPI(source);

      case 'stream':
        return await this.extractFromStream(source);

      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }
  }

  // 增量提取（CDC - Change Data Capture）
  private async extractIncremental(
    source: ETLPipeline['source'],
    lastSyncTime: Date
  ): Promise<any[]> {
    const incrementalQuery = `
      SELECT *
      FROM ${source.connection}
      WHERE updated_at > '${lastSyncTime.toISOString()}'
    `;

    return await this.extractFromDatabase({
      ...source,
      query: incrementalQuery,
    });
  }

  // 数据转换
  private async transform(data: any[], transformation: Transformation): Promise<any[]> {
    switch (transformation.type) {
      case 'filter':
        return data.filter(item => this.evaluateCondition(item, transformation.condition));

      case 'map':
        return data.map(item => {
          const mapped: any = {};
          for (const [targetKey, sourceKey] of Object.entries(transformation.mappings)) {
            mapped[targetKey] = item[sourceKey as keyof typeof item];
          }
          return mapped;
        });

      case 'aggregate':
        return this.aggregate(data, transformation);

      case 'join':
        return this.join(data, transformation);

      case 'deduplicate':
        return this.deduplicate(data, transformation);

      default:
        return data;
    }
  }

  // 数据加载
  private async load(
    destination: ETLPipeline['destination'],
    data: any[]
  ): Promise<{ recordsProcessed: number; recordsFailed: number; errors: string[] }> {
    switch (destination.writeMode) {
      case 'append':
        return await this.appendLoad(destination, data);

      case 'upsert':
        return await this.upsertLoad(destination, data);

      case 'overwrite':
        return await this.overwriteLoad(destination, data);
    }
  }

  private async appendLoad(
    destination: ETLPipeline['destination'],
    data: any[]
  ): Promise<{ recordsProcessed: number; recordsFailed: number; errors: string[] }> {
    // 批量插入
    const batchSize = 1000;
    let recordsProcessed = 0;
    let recordsFailed = 0;
    const errors: string[] = [];

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);

      try {
        await this.warehouse.insert(destination.table, batch);
        recordsProcessed += batch.length;
      } catch (error) {
        recordsFailed += batch.length;
        errors.push(`Batch ${i / batchSize}: ${(error as Error).message}`);
      }
    }

    return { recordsProcessed, recordsFailed, errors };
  }
}

interface ETLResult {
  pipelineId: string;
  status: 'success' | 'failed';
  startTime: Date;
  endTime: Date;
  durationMs: number;
  recordsProcessed: number;
  recordsFailed: number;
  errors: string[];
}
```

### 2.2 预定义管道

```typescript
// src/analytics/pipelines.ts

// 预定义 ETL 管道
const PredefinedPipelines: ETLPipeline[] = [
  // 项目生成事实表
  {
    id: 'project-generation-fact',
    name: 'Project Generation Facts',
    description: '抽取项目生成数据到数据仓库',
    source: {
      type: 'database',
      connection: 'sqlite:projects',
      query: `
        SELECT
          p.id as project_id,
          p.created_at,
          p.completed_at,
          p.status,
          p.quality_score,
          p.iteration_count,
          p.file_count,
          p.tenant_id,
          p.project_type,
          t.plan as tenant_plan
        FROM projects p
        JOIN tenants t ON p.tenant_id = t.id
      `,
    },
    transformations: [
      {
        type: 'map',
        mappings: {
          fact_id: 'id',
          date_id: 'created_at',
          tenant_id: 'tenant_id',
          project_status: 'status',
          quality_score: 'quality_score',
          iteration_count: 'iteration_count',
          generation_duration_seconds: 'duration_seconds',
          file_count: 'file_count',
        },
      },
    ],
    destination: {
      type: 'warehouse',
      table: 'fact_project_generation',
      writeMode: 'append',
    },
  },

  // LLM 使用统计
  {
    id: 'llm-usage-fact',
    name: 'LLM Usage Facts',
    description: '追踪 LLM 调用和成本',
    source: {
      type: 'database',
      connection: 'sqlite:llm_logs',
      query: `
        SELECT
          id,
          tenant_id,
          agent_type,
          model,
          input_tokens,
          output_tokens,
          duration_ms,
          cost_usd,
          is_success,
          is_cached,
          created_at
        FROM llm_calls
      `,
    },
    transformations: [],
    destination: {
      type: 'warehouse',
      table: 'fact_llm_usage',
      writeMode: 'append',
    },
  },

  // 每日聚合
  {
    id: 'daily-metrics-aggregate',
    name: 'Daily Metrics Aggregation',
    description: '生成每日聚合指标',
    source: {
      type: 'database',
      connection: 'sqlite:fact_project_generation',
    },
    transformations: [
      {
        type: 'aggregate',
        groupBy: ['date_id', 'tenant_id', 'project_type'],
        aggregations: [
          { field: 'id', function: 'count', alias: 'project_count' },
          { field: 'generation_duration_seconds', function: 'avg', alias: 'avg_generation_duration' },
          { field: 'quality_score', function: 'avg', alias: 'avg_quality_score' },
          { field: 'llm_cost_usd', function: 'sum', alias: 'total_llm_cost' },
        ],
      },
    ],
    destination: {
      type: 'warehouse',
      table: 'agg_daily_metrics',
      writeMode: 'upsert',
    },
  },
];
```

## 3. 分析查询

### 3.1 业务指标定义

```typescript
// src/analytics/metrics-definitions.ts

// 业务指标库
const BusinessMetrics = {
  // 项目生成指标
  projectGeneration: {
    totalProjects: {
      name: 'Total Projects',
      description: '累计生成的项目总数',
      query: (filters: DateRange) => `
        SELECT COUNT(*) as value
        FROM fact_project_generation
        WHERE date_id BETWEEN ${formatDateId(filters.start)} AND ${formatDateId(filters.end)}
      `,
      unit: 'count',
    },

    successfulProjects: {
      name: 'Successful Projects',
      description: '成功完成的项目数',
      query: (filters: DateRange) => `
        SELECT COUNT(*) as value
        FROM fact_project_generation
        WHERE is_success = true
          AND date_id BETWEEN ${formatDateId(filters.start)} AND ${formatDateId(filters.end)}
      `,
      unit: 'count',
    },

    successRate: {
      name: 'Success Rate',
      description: '项目成功率',
      query: (filters: DateRange) => `
        SELECT
          CAST(SUM(CASE WHEN is_success THEN 1 ELSE 0 END) AS FLOAT) /
          CAST(COUNT(*) AS FLOAT) * 100 as value
        FROM fact_project_generation
        WHERE date_id BETWEEN ${formatDateId(filters.start)} AND ${formatDateId(filters.end)}
      `,
      unit: 'percentage',
    },

    avgGenerationTime: {
      name: 'Average Generation Time',
      description: '平均项目生成时间（分钟）',
      query: (filters: DateRange) => `
        SELECT AVG(generation_duration_seconds) / 60 as value
        FROM fact_project_generation
        WHERE date_id BETWEEN ${formatDateId(filters.start)} AND ${formatDateId(filters.end)}
      `,
      unit: 'minutes',
    },

    avgQualityScore: {
      name: 'Average Quality Score',
      description: '平均质量分数',
      query: (filters: DateRange) => `
        SELECT AVG(quality_score) as value
        FROM fact_project_generation
        WHERE date_id BETWEEN ${formatDateId(filters.start)} AND ${formatDateId(filters.end)}
      `,
      unit: 'score',
    },

    projectsByType: {
      name: 'Projects by Type',
      description: '按类型分布的项目数',
      query: (filters: DateRange) => `
        SELECT project_type, COUNT(*) as count
        FROM fact_project_generation
        WHERE date_id BETWEEN ${formatDateId(filters.start)} AND ${formatDateId(filters.end)}
        GROUP BY project_type
      `,
      unit: 'breakdown',
    },
  },

  // LLM 成本指标
  llmCosts: {
    totalCost: {
      name: 'Total LLM Cost',
      description: 'LLM 调用总成本',
      query: (filters: DateRange) => `
        SELECT SUM(cost_usd) as value
        FROM fact_llm_usage
        WHERE date_id BETWEEN ${formatDateId(filters.start)} AND ${formatDateId(filters.end)}
      `,
      unit: 'currency',
    },

    costByModel: {
      name: 'Cost by Model',
      description: '按模型分布的成本',
      query: (filters: DateRange) => `
        SELECT model, SUM(cost_usd) as cost, SUM(input_tokens + output_tokens) as tokens
        FROM fact_llm_usage
        WHERE date_id BETWEEN ${formatDateId(filters.start)} AND ${formatDateId(filters.end)}
        GROUP BY model
      `,
      unit: 'breakdown',
    },

    costPerProject: {
      name: 'Cost per Project',
      description: '每个项目的平均 LLM 成本',
      query: (filters: DateRange) => `
        SELECT SUM(l.cost_usd) / COUNT(DISTINCT p.project_id) as value
        FROM fact_llm_usage l
        JOIN fact_project_generation p ON l.project_id = p.project_id
        WHERE l.date_id BETWEEN ${formatDateId(filters.start)} AND ${formatDateId(filters.end)}
      `,
      unit: 'currency',
    },

    tokenUsage: {
      name: 'Token Usage',
      description: 'Token 使用量',
      query: (filters: DateRange) => `
        SELECT
          SUM(input_tokens) as input,
          SUM(output_tokens) as output,
          SUM(input_tokens + output_tokens) as total
        FROM fact_llm_usage
        WHERE date_id BETWEEN ${formatDateId(filters.start)} AND ${formatDateId(filters.end)}
      `,
      unit: 'tokens',
    },
  },

  // 租户指标
  tenantMetrics: {
    activeTenants: {
      name: 'Active Tenants',
      description: '有项目生成的活跃租户数',
      query: (filters: DateRange) => `
        SELECT COUNT(DISTINCT tenant_id) as value
        FROM fact_project_generation
        WHERE date_id BETWEEN ${formatDateId(filters.start)} AND ${formatDateId(filters.end)}
      `,
      unit: 'count',
    },

    projectsByTenant: {
      name: 'Projects by Tenant',
      description: '租户项目分布',
      query: (filters: DateRange, limit = 10) => `
        SELECT t.tenant_name, COUNT(*) as projects, SUM(p.quality_score) / COUNT(*) as avg_quality
        FROM fact_project_generation p
        JOIN dim_tenant t ON p.tenant_id = t.tenant_id
        WHERE p.date_id BETWEEN ${formatDateId(filters.start)} AND ${formatDateId(filters.end)}
        GROUP BY t.tenant_id, t.tenant_name
        ORDER BY projects DESC
        LIMIT ${limit}
      `,
      unit: 'breakdown',
    },

    tenantRetention: {
      name: 'Tenant Retention Rate',
      description: '租户留存率',
      query: (filters: DateRange) => `
        WITH last_period AS (
          SELECT tenant_id
          FROM fact_project_generation
          WHERE date_id = ${formatDateId(subtractDays(filters.end, 30))}
        ),
        current_period AS (
          SELECT tenant_id
          FROM fact_project_generation
          WHERE date_id BETWEEN ${formatDateId(filters.start)} AND ${formatDateId(filters.end)}
        )
        SELECT
          CAST(COUNT(DISTINCT l.tenant_id) AS FLOAT) /
          CAST(COUNT(DISTINCT l.tenant_id) AS FLOAT) * 100 as value
        FROM last_period l
        JOIN current_period c ON l.tenant_id = c.tenant_id
      `,
      unit: 'percentage',
    },
  },
};

interface DateRange {
  start: Date;
  end: Date;
}
```

### 3.2 分析服务

```typescript
// src/analytics/analytics-service.ts

class AnalyticsService {
  private warehouse: DataWarehouse;

  // 执行指标查询
  async executeMetric(
    metricName: string,
    filters?: {
      dateRange?: DateRange;
      tenantId?: string;
      projectType?: string;
    }
  ): Promise<MetricResult> {
    const metric = this.findMetric(metricName);

    if (!metric) {
      throw new Error(`Unknown metric: ${metricName}`);
    }

    // 构建查询
    const query = metric.query(filters?.dateRange || this.getDefaultDateRange());

    // 添加租户过滤
    let finalQuery = query;
    if (filters?.tenantId) {
      finalQuery = finalQuery.replace(
        'WHERE',
        `WHERE tenant_id = '${filters.tenantId}' AND`
      );
    }

    const result = await this.warehouse.execute(finalQuery);

    return {
      metricName,
      value: result[0]?.value || 0,
      unit: metric.unit,
      timestamp: new Date(),
    };
  }

  // 执行多指标查询
  async executeMetrics(
    metricNames: string[],
    filters?: {
      dateRange?: DateRange;
      tenantId?: string;
    }
  ): Promise<MetricResult[]> {
    return Promise.all(
      metricNames.map(name => this.executeMetric(name, filters))
    );
  }

  // 获取仪表板数据
  async getDashboardData(tenantId?: string): Promise<DashboardData> {
    const dateRange = this.getDefaultDateRange();

    const [
      projectMetrics,
      llmCostMetrics,
      tenantMetrics,
    ] = await Promise.all([
      this.executeMetrics([
        'totalProjects',
        'successfulProjects',
        'successRate',
        'avgGenerationTime',
        'avgQualityScore',
      ], { dateRange, tenantId }),
      this.executeMetrics([
        'totalCost',
        'costByModel',
        'costPerProject',
      ], { dateRange, tenantId }),
      this.executeMetrics([
        'activeTenants',
        'projectsByTenant',
      ], { dateRange, tenantId }),
    ]);

    // 获取趋势数据
    const trendData = await this.getTrendData('7d', tenantId);

    return {
      summary: {
        projects: projectMetrics,
        llmCosts: llmCostMetrics,
        tenants: tenantMetrics,
      },
      trends: trendData,
      generatedAt: new Date(),
    };
  }

  // 获取趋势数据
  async getTrendData(
    period: '24h' | '7d' | '30d' | '90d',
    tenantId?: string
  ): Promise<TrendData[]> {
    const dateRange = this.getDateRangeForPeriod(period);

    const query = `
      SELECT
        date_id,
        COUNT(*) as project_count,
        AVG(quality_score) as avg_quality,
        SUM(llm_cost_usd) as total_cost
      FROM fact_project_generation
      WHERE date_id BETWEEN ${formatDateId(dateRange.start)} AND ${formatDateId(dateRange.end)}
        ${tenantId ? `AND tenant_id = '${tenantId}'` : ''}
      GROUP BY date_id
      ORDER BY date_id
    `;

    const results = await this.warehouse.execute(query);

    return results.map(row => ({
      date: parseDateId(row.date_id),
      projectCount: row.project_count,
      avgQuality: row.avg_quality,
      totalCost: row.total_cost,
    }));
  }

  // 获取漏斗数据
  async getFunnelData(
    filters?: { tenantId?: string; dateRange?: DateRange }
  ): Promise<FunnelStage[]> {
    const stages = [
      { name: 'Started', event: 'project.started' },
      { name: 'Architecture Designed', event: 'project.architecture_completed' },
      { name: 'Code Generated', event: 'project.code_generated' },
      { name: 'Tests Written', event: 'project.tests_completed' },
      { name: 'Quality Approved', event: 'project.quality_approved' },
      { name: 'Completed', event: 'project.completed' },
    ];

    const results: FunnelStage[] = [];

    for (const stage of stages) {
      const count = await this.getEventCount(stage.event, filters);
      results.push({
        name: stage.name,
        event: stage.event,
        count,
        dropOff: results.length > 0
          ? results[results.length - 1].count - count
          : 0,
        dropOffRate: results.length > 0
          ? ((results[results.length - 1].count - count) / results[results.length - 1].count) * 100
          : 0,
      });
    }

    return results;
  }

  // 获取租户排名
  async getTenantRanking(
    metric: string,
    period: '7d' | '30d' | '90d',
    limit = 10
  ): Promise<TenantRank[]> {
    const dateRange = this.getDateRangeForPeriod(period);

    const metricToColumn: Record<string, string> = {
      projects: 'COUNT(*)',
      quality: 'AVG(quality_score)',
      cost: 'SUM(llm_cost_usd)',
      efficiency: 'AVG(generation_duration_seconds)',
    };

    const column = metricToColumn[metric] || metricToColumn.projects;

    const query = `
      SELECT
        t.tenant_id,
        t.tenant_name,
        t.plan,
        ${column} as value
      FROM fact_project_generation p
      JOIN dim_tenant t ON p.tenant_id = t.tenant_id
      WHERE p.date_id BETWEEN ${formatDateId(dateRange.start)} AND ${formatDateId(dateRange.end)}
      GROUP BY t.tenant_id, t.tenant_name, t.plan
      ORDER BY value DESC
      LIMIT ${limit}
    `;

    const results = await this.warehouse.execute(query);

    return results.map((row, index) => ({
      rank: index + 1,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      plan: row.plan,
      value: row.value,
    }));
  }
}

interface MetricResult {
  metricName: string;
  value: number;
  unit: string;
  timestamp: Date;
}

interface DashboardData {
  summary: {
    projects: MetricResult[];
    llmCosts: MetricResult[];
    tenants: MetricResult[];
  };
  trends: TrendData[];
  generatedAt: Date;
}

interface TrendData {
  date: Date;
  projectCount: number;
  avgQuality: number;
  totalCost: number;
}

interface FunnelStage {
  name: string;
  event: string;
  count: number;
  dropOff: number;
  dropOffRate: number;
}

interface TenantRank {
  rank: number;
  tenantId: string;
  tenantName: string;
  plan: string;
  value: number;
}
```

## 4. BI 仪表板

### 4.1 仪表板配置

```typescript
// src/analytics/dashboard-config.ts

interface Dashboard {
  id: string;
  name: string;
  description: string;
  category: 'executive' | 'operations' | 'engineering' | 'financial';

  // 布局
  layout: DashboardLayout;

  // 过滤
  defaultFilters?: DashboardFilters;

  // 权限
  requiredRoles: string[];

  // 元数据
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DashboardLayout {
  columns: number;  // 通常 12 列
  widgets: DashboardWidget[];
}

interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'funnel' | 'rank';

  // 位置
  gridPosition: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // 数据配置
  dataSource: {
    metric?: string;
    chartType?: 'line' | 'bar' | 'pie' | 'area' | 'donut';
    dimensions?: string[];
    measures?: string[];
  };

  // 展示配置
  display: {
    title?: string;
    subtitle?: string;
    showTrend?: boolean;
    comparisonPeriod?: 'previous' | 'last_week' | 'last_month';
    colorScheme?: string[];
  };
}

interface DashboardFilters {
  dateRange?: {
    preset?: 'today' | '7d' | '30d' | '90d' | 'custom';
    start?: Date;
    end?: Date;
  };
  tenant?: {
    type: 'all' | 'specific';
    tenantIds?: string[];
  };
  projectType?: string[];
}

// 预定义仪表板
const PredefinedDashboards: Dashboard[] = [
  {
    id: 'executive-overview',
    name: 'Executive Overview',
    description: '高管视角的核心业务指标',
    category: 'executive',
    layout: {
      columns: 12,
      widgets: [
        {
          id: 'total-projects',
          type: 'metric',
          gridPosition: { x: 0, y: 0, width: 3, height: 2 },
          dataSource: { metric: 'totalProjects' },
          display: { title: 'Total Projects', showTrend: true },
        },
        {
          id: 'success-rate',
          type: 'metric',
          gridPosition: { x: 3, y: 0, width: 3, height: 2 },
          dataSource: { metric: 'successRate' },
          display: { title: 'Success Rate', showTrend: true },
        },
        {
          id: 'total-cost',
          type: 'metric',
          gridPosition: { x: 6, y: 0, width: 3, height: 2 },
          dataSource: { metric: 'totalCost' },
          display: { title: 'LLM Cost', showTrend: true },
        },
        {
          id: 'project-trend',
          type: 'chart',
          gridPosition: { x: 0, y: 2, width: 8, height: 4 },
          dataSource: { chartType: 'line', dimensions: ['date'], measures: ['projectCount'] },
          display: { title: 'Project Trend' },
        },
        {
          id: 'projects-by-type',
          type: 'chart',
          gridPosition: { x: 8, y: 2, width: 4, height: 4 },
          dataSource: { chartType: 'donut', dimensions: ['projectType'], measures: ['count'] },
          display: { title: 'Projects by Type' },
        },
      ],
    },
    defaultFilters: {
      dateRange: { preset: '30d' },
    },
    requiredRoles: ['owner', 'admin'],
  },

  {
    id: 'operations-dashboard',
    name: 'Operations Dashboard',
    description: '运维团队的操作监控仪表板',
    category: 'operations',
    layout: {
      columns: 12,
      widgets: [
        {
          id: 'generation-funnel',
          type: 'funnel',
          gridPosition: { x: 0, y: 0, width: 6, height: 4 },
          dataSource: {},
          display: { title: 'Project Generation Funnel' },
        },
        {
          id: 'error-rate',
          type: 'metric',
          gridPosition: { x: 6, y: 0, width: 3, height: 2 },
          dataSource: { metric: 'errorRate' },
          display: { title: 'Error Rate' },
        },
        {
          id: 'avg-latency',
          type: 'metric',
          gridPosition: { x: 9, y: 0, width: 3, height: 2 },
          dataSource: { metric: 'avgGenerationTime' },
          display: { title: 'Avg Generation Time' },
        },
      ],
    },
    requiredRoles: ['owner', 'admin', 'operations'],
  },
];
```

### 4.2 实时分析

```typescript
// src/analytics/realtime-analytics.ts

// 实时分析服务
class RealtimeAnalyticsService {
  private eventBus: EventBus;
  private metrics: Map<string, number>;
  private updateIntervalMs: number = 1000;

  constructor() {
    this.metrics = new Map();
    this.setupEventListeners();
  }

  // 设置事件监听
  private setupEventListeners(): void {
    // 项目开始生成
    this.eventBus.subscribe('project.started', (event) => {
      this.incrementCounter('projects_started');
      this.recordGauge('active_generations', event.activeCount);
    });

    // 项目完成
    this.eventBus.subscribe('project.completed', (event) => {
      this.incrementCounter('projects_completed');
      this.decrementGauge('active_generations');
      this.recordHistogram('generation_duration', event.duration);
      this.recordGauge('avg_quality', event.qualityScore);
    });

    // LLM 调用
    this.eventBus.subscribe('llm.call_completed', (event) => {
      this.incrementCounter('llm_calls');
      this.incrementCounter('llm_tokens', event.tokens);
      this.incrementCounter('llm_cost', event.cost);
    });

    // 错误
    this.eventBus.subscribe('error', (event) => {
      this.incrementCounter('errors');
      this.incrementCounter(`errors.${event.type}`, 1);
    });
  }

  // 获取实时指标快照
  getMetricsSnapshot(): RealtimeMetrics {
    return {
      timestamp: new Date(),

      counters: Object.fromEntries(this.metrics),
      gauges: this.getGaugeValues(),
      percentiles: this.calculatePercentiles(),
    };
  }

  // 获取活动事件流
  async *getEventStream(
    filters?: { types?: string[]; tenantId?: string }
  ): AsyncIterable<AnalyticsEvent> {
    while (true) {
      const events = await this.fetchRecentEvents(100, filters);

      for (const event of events) {
        yield event;
      }

      await this.delay(1000);  // 轮询间隔
    }
  }

  // 获取实时仪表板数据
  async getRealtimeDashboard(): Promise<RealtimeDashboard> {
    const snapshot = this.getMetricsSnapshot();

    return {
      timestamp: snapshot.timestamp,

      overview: {
        projectsStarted: snapshot.counters['projects_started'] || 0,
        projectsCompleted: snapshot.counters['projects_completed'] || 0,
        activeGenerations: snapshot.gauges['active_generations'] || 0,
        totalCost: snapshot.counters['llm_cost'] || 0,
      },

      performance: {
        avgGenerationTime: snapshot.percentiles['p50_generation_duration'] || 0,
        p95GenerationTime: snapshot.percentiles['p95_generation_duration'] || 0,
        successRate: this.calculateSuccessRate(),
      },

      recentActivity: await this.getRecentActivity(10),

      alerts: await this.getActiveAlerts(),
    };
  }

  // 计算百分位数
  private calculatePercentiles(): Record<string, number> {
    const histograms = this.getHistograms();

    return {
      p50_generation_duration: this.percentile(histograms['generation_duration'], 0.5),
      p95_generation_duration: this.percentile(histograms['generation_duration'], 0.95),
      p99_generation_duration: this.percentile(histograms['generation_duration'], 0.99),
    };
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }
}

interface RealtimeMetrics {
  timestamp: Date;
  counters: Record<string, number>;
  gauges: Record<string, number>;
  percentiles: Record<string, number>;
}

interface RealtimeDashboard {
  timestamp: Date;
  overview: {
    projectsStarted: number;
    projectsCompleted: number;
    activeGenerations: number;
    totalCost: number;
  };
  performance: {
    avgGenerationTime: number;
    p95GenerationTime: number;
    successRate: number;
  };
  recentActivity: ActivityItem[];
  alerts: Alert[];
}
```

---

**最后更新**: 2026-04-14
**版本**: v1.0
