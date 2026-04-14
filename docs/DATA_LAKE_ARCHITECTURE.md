# 数据湖架构设计

## 1. 概述

本文档描述 ProjectFactory 系统的数据湖架构，实现海量项目数据的存储、分析和机器学习能力。

### 1.1 数据湖架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           数据湖架构                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                           数据源层                                     │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │   │
│  │  │  Ideas  │  │Projects │  │ Quality │  │  Users  │  │ System  │   │   │
│  │  │  Events │  │  Events │  │ Metrics │  │ Behavior│  │  Logs   │   │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘   │   │
│  └───────┼───────────┼───────────┼───────────┼───────────┼──────────┘   │
│          └───────────┴───────────┴───────────┴───────────┘                │
│                              ↓                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                           摄取层                                      │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐               │   │
│  │  │ Kafka   │  │  Flink  │  │ Debezium│  │  S3     │               │   │
│  │  │ Ingest  │  │ Stream  │  │ CDC     │  │  Sink   │               │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                           存储层                                      │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐               │   │
│  │  │  Bronze │  │  Silver │  │  Gold   │  │  ML     │               │   │
│  │  │ (Raw)   │  │(Cleaned)│  │(Business)│  │(Features)│              │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                           处理层                                      │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐               │   │
│  │  │ Spark   │  │Presto   │  │  dbt    │  │MLflow   │               │   │
│  │  │ Batch   │  │ Query   │  │ Transform│  │Training │               │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                           访问层                                      │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐               │   │
│  │  │ Analytics│  │  API   │  │Dashboard│  │  ML     │               │   │
│  │  │  Studio │  │ Service │  │         │  │ Inference│              │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 数据存储

### 2.1 存储层设计

```yaml
# data-lake/storage/layers.yaml
storage:
  # Bronze 层 - 原始数据
  bronze:
    path: "s3://projectfactory-datalake/bronze/"
    format: "parquet"
    compression: "snappy"
    partitionBy:
      - "date"
      - "source"
    retention:
      duration: "90 days"
      sizeLimit: "100TB"

    schemas:
      ideas_raw:
        columns:
          - name: id
            type: string
          - name: raw_json
            type: string
          - name: ingested_at
            type: timestamp
          - name: source
            type: string
          - name: partition_date
            type: date

      projects_raw:
        columns:
          - name: id
            type: string
          - name: idea_id
            type: string
          - name: raw_json
            type: string
          - name: files_generated
            type: int
          - name: quality_score
            type: float
          - name: ingested_at
            type: timestamp

  # Silver 层 - 清洗数据
  silver:
    path: "s3://projectfactory-datalake/silver/"
    format: "parquet"
    compression: "zstd"
    partitionBy:
      - "year"
      - "month"
      - "entity_type"
    retention:
      duration: "2 years"

    schemas:
      ideas:
        columns:
          - name: id
            type: uuid
          - name: title
            type: string
          - name: description
            type: string
          - name: tags
            type: array<string>
          - name: status
            type: string
          - name: created_at
            type: timestamp
          - name: updated_at
            type: timestamp
          - name: processing_time_ms
            type: bigint
        indexes:
          - name: idx_ideas_status
            columns: ["status"]
          - name: idx_ideas_created
            columns: ["created_at"]

      projects:
        columns:
          - name: id
            type: uuid
          - name: idea_id
            type: uuid
          - name: name
            type: string
          - name: type
            type: string
          - name: status
            type: string
          - name: language
            type: string
          - name: file_count
            type: int
          - name: line_count
            type: bigint
          - name: quality_score
            type: float
          - name: created_at
            type: timestamp
          - name: completed_at
            type: timestamp

  # Gold 层 - 业务聚合数据
  gold:
    path: "s3://projectfactory-datalake/gold/"
    format: "delta"
    versionControl: true
    retention:
      duration: "forever"

    schemas:
      daily_metrics:
        columns:
          - name: date
            type: date
          - name: entity_type
            type: string
          - name: total_count
            type: bigint
          - name: success_count
            type: bigint
          - name: avg_quality_score
            type: float
          - name: avg_processing_time_ms
            type: bigint
          - name: p95_processing_time_ms
            type: bigint

      user_analytics:
        columns:
          - name: user_id
            type: string
          - name: date
            type: date
          - name: ideas_created
            type: int
          - name: projects_started
            type: int
          - name: projects_completed
            type: int
          - name: total_credits_used
            type: bigint
```

### 2.2 Iceberg 表配置

```sql
-- 创建 Ideas 表 (Iceberg)
CREATE TABLE silver.ideas (
    id STRING,
    title STRING,
    description STRING,
    tags ARRAY<STRING>,
    status STRING,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    processing_time_ms BIGINT,
    source_system STRING,
    partition_date DATE
)
USING iceberg
PARTITIONED BY (days(created_at), bucket(16, id))
TBLPROPERTIES (
    'write.target-file-size-bytes' = '134217728',
    'write.metadata.delete-after-commit-duration' = '100 days',
    'write.metadata.previous-versions-max' = '100',
    'read.split.target-size' = '134217728'
);

-- 创建 Quality Metrics 表
CREATE TABLE silver.quality_metrics (
    project_id STRING,
    idea_id STRING,
    metric_type STRING,
    metric_name STRING,
    metric_value DOUBLE,
    threshold DOUBLE,
    passed BOOLEAN,
    measured_at TIMESTAMP,
    partition_date DATE
)
USING iceberg
PARTITIONED BY (days(measured_at), metric_type)
TBLPROPERTIES (
    'write.target-file-size-bytes' = '67108864'
);
```

---

## 3. 数据摄取

### 3.1 Kafka 摄取管道

```yaml
# data-lake/pipelines/kafka-ingest.yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: projectfactory.ideas
  labels:
    strimzi.io/cluster: projectfactory
spec:
  partitions: 32
  replicas: 3
  config:
    retention.ms: 604800000  # 7 days
    cleanup.policy: delete
    min.insync.replicas: 2
---
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: projectfactory.projects
spec:
  partitions: 64
  replicas: 3
---
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: projectfactory.quality
spec:
  partitions: 32
  replicas: 3
```

```typescript
// data-lake/pipelines/kafka-consumer.ts
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';

interface IngestionMessage {
  eventType: 'idea_created' | 'idea_updated' | 'project_created' | 'quality_recorded';
  timestamp: number;
  payload: any;
  metadata: {
    source: string;
    version: string;
    correlationId: string;
  };
}

class DataLakeIngestionPipeline {
  private kafka: Kafka;
  private consumer: Consumer;
  private s3Writer: S3Writer;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'datalake-ingest',
      brokers: ['kafka-1:9092', 'kafka-2:9092', 'kafka-3:9092'],
    });

    this.consumer = this.kafka.consumer({
      groupId: 'datalake-consumer-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });

    this.s3Writer = new S3Writer({
      bucket: 'projectfactory-datalake',
      prefix: 'bronze',
    });
  }

  async start(): Promise<void> {
    await this.consumer.connect();

    await this.consumer.subscribe({
      topics: [
        'projectfactory.ideas',
        'projectfactory.projects',
        'projectfactory.quality',
        'projectfactory.audit',
      ],
      fromBeginning: false,
    });

    await this.consumer.run({
      partitionsConsumedConcurrently: 8,
      eachMessage: async (payload) => {
        await this.processMessage(payload);
      },
    });
  }

  private async processMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;

    if (!message.value) return;

    const data: IngestionMessage = JSON.parse(message.value.toString());

    // 添加元数据
    const enrichedData = {
      ...data,
      _ingestion: {
        topic,
        partition,
        offset: message.offset,
        timestamp: Date.now(),
      },
    };

    // 写入 S3 Bronze 层
    const s3Path = this.getS3Path(topic, data);

    await this.s3Writer.write({
      path: s3Path,
      data: enrichedData,
      format: 'parquet',
      compression: 'snappy',
    });

    // 发送到清洗主题
    await this.sendToSilverTopic(topic, enrichedData);
  }

  private getS3Path(topic: string, data: IngestionMessage): string {
    const date = new Date(data.timestamp);
    const dateStr = date.toISOString().split('T')[0];
    const hour = date.getHours();

    const entityType = topic.split('.')[1];

    return `bronze/${entityType}/date=${dateStr}/hour=${hour}/${data.eventId}.parquet`;
  }
}
```

### 3.2 CDC 变更数据捕获

```yaml
# data-lake/pipelines/debezium.yaml
apiVersion: debezium.io/v1beta1
kind: Connector
metadata:
  name: projectfactory-sqlite-cdc
spec:
  class: io.debezium.connector.sqlite.SqliteConnector
  config:
    database.hostname: sqlite-server
    database.port: 5432
    database.user: cdc_user
    database.password: ${CDC_PASSWORD}
    database.dbname: project_factory

    # 捕获的表
    table.include.list: "public.ideas,public.projects,public.iterations,public.quality_metrics"

    # 序列化配置
    key.converter: org.apache.kafka.connect.json.JsonConverter
    value.converter: org.apache.kafka.connect.json.JsonConverter

    # 主题配置
    topic.prefix: projectfactory
    topic.per.table: true

    # 快照配置
    snapshot.mode: schema_only
    snapshot.lock.timeout.ms: 10000

    # 增量快照
    incremental.snapshot.chunk.size: 1000
    signal.data.collection: "public.debezium_signals"

    # 偏移量存储
    offset.storage: org.apache.kafka.connect.storage.FileOffsetBackingStore
    offset.storage.file.filename: /data/offsets.dat
    offset.flush.interval.ms: 10000
```

---

## 4. 数据处理

### 4.1 Spark 批处理作业

```scala
// data-lake/processing/ideas-batch-job.scala
import org.apache.spark.sql._
import org.apache.spark.sql.functions._
import org.apache.spark.sql.types._
import org.apache.iceberg.spark.actions._

class IdeasSilverJob {
  def run(spark: SparkSession, config: JobConfig): Unit = {
    val bronzePath = s"s3://projectfactory-datalake/bronze/ideas/"
    val silverPath = s"s3://projectfactory-datalake/silver/ideas/"

    // 读取 Bronze 层数据
    val bronzeDF = spark.read
      .format("parquet")
      .load(bronzePath)

    // 解析 JSON 数据
    val parsedDF = bronzeDF
      .select(
        $"id",
        from_json($"raw_json", IdeasSchema.jsonSchema).as("data"),
        $"ingested_at",
        $"partition_date"
      )
      .select(
        $"id",
        $"data.title".as("title"),
        $"data.description".as("description"),
        $"data.tags".as("tags"),
        $"data.status".as("status"),
        $"data.created_at".as("created_at"),
        $"data.updated_at".as("updated_at"),
        $"ingested_at",
        $"partition_date"
      )

    // 数据清洗
    val cleanedDF = parsedDF
      .filter($"title".isNotNull)
      .filter(length($"title") <= 200)
      .withColumn("cleaned_at", current_timestamp())
      .withColumn(
        "processing_time_ms",
        when(
          $"updated_at".isNotNull && $"created_at".isNotNull,
          unix_timestamp($"updated_at") - unix_timestamp($"created_at")
        ).otherwise(lit(null))
      )

    // 去重
    val deduplicatedDF = cleanedDF
      .dropDuplicatesWithinWatermark($"id", "10 minutes")

    // 写入 Silver 层
    deduplicatedDF.write
      .format(" iceberg")
      .mode("append")
      .option("target-file-size-bytes", "134217728")
      .partitionBy("partition_date")
      .save(silverPath)

    // 优化文件
    SparkActions.getInstance()
      .rewriteDataFiles()
      .table(s"projectfactory.silver.ideas")
      .option("target-file-size-bytes", "134217728")
      .execute()
  }
}
```

### 4.2 dbt 转换模型

```sql
-- data-lake/transform/dbt/models/marts/daily_metrics.sql
{{
  config(
    materialized='incremental',
    unique_key='date || entity_type',
    partition_by=['date'],
    cluster_by=['entity_type']
  )
}}

WITH ideas_daily AS (
  SELECT
    DATE(created_at) AS date,
    'idea' AS entity_type,
    COUNT(*) AS total_count,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS success_count,
    AVG(processing_time_ms) AS avg_processing_time_ms,
    APPROX_PERCENTILE(processing_time_ms, 0.95) AS p95_processing_time_ms
  FROM {{ ref('ideas') }}
  WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY DATE(created_at)
),

projects_daily AS (
  SELECT
    DATE(created_at) AS date,
    'project' AS entity_type,
    COUNT(*) AS total_count,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS success_count,
    AVG(processing_time_ms) AS avg_processing_time_ms,
    APPROX_PERCENTILE(processing_time_ms, 0.95) AS p95_processing_time_ms
  FROM {{ ref('projects') }}
  WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY DATE(created_at)
),

quality_daily AS (
  SELECT
    DATE(measured_at) AS date,
    'quality' AS entity_type,
    COUNT(*) AS total_count,
    SUM(CASE WHEN passed THEN 1 ELSE 0 END) AS success_count,
    AVG(metric_value) AS avg_quality_score,
    AVG( CASE WHEN metric_name = 'coverage' THEN metric_value END) AS avg_coverage,
    AVG(CASE WHEN metric_name = 'complexity' THEN metric_value END) AS avg_complexity
  FROM {{ ref('quality_metrics') }}
  WHERE measured_at >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY DATE(measured_at)
)

SELECT * FROM ideas_daily
UNION ALL
SELECT * FROM projects_daily
UNION ALL
SELECT * FROM quality_daily
```

---

## 5. 数据质量

### 5.1 数据质量规则

```yaml
# data-lake/quality/data-quality-rules.yaml
qualityRules:
  ideas:
    - name: "no_null_titles"
      description: "标题不能为空"
      type: "not_null"
      column: "title"
      severity: "critical"
      action: "alert"

    - name: "title_max_length"
      description: "标题长度限制"
      type: "length_check"
      column: "title"
      config:
        max: 200
      severity: "warning"
      action: "quarantine"

    - name: "valid_status"
      description: "状态值有效"
      type: "accepted_values"
      column: "status"
      config:
        values: ["pending", "in_progress", "completed", "failed"]
      severity: "critical"
      action: "block"

    - name: "created_before_updated"
      description: "创建时间早于更新时间"
      type: "custom"
      sql: "created_at <= updated_at"
      severity: "critical"
      action: "quarantine"

  projects:
    - name: "valid_quality_score"
      description: "质量分数在 0-100 之间"
      type: "range"
      column: "quality_score"
      config:
        min: 0
        max: 100
      severity: "warning"
      action: "alert"

    - name: "positive_file_count"
      description: "文件数量必须为正"
      type: "greater_than"
      column: "file_count"
      config:
        value: 0
      severity: "critical"
      action: "block"
```

### 5.2 数据质量监控

```typescript
// data-lake/quality/quality-monitor.ts
interface QualityCheckResult {
  ruleName: string;
  tableName: string;
  status: 'passed' | 'failed' | 'warning';
  totalRows: number;
  failedRows: number;
  failedPercentage: number;
  threshold: number;
  executedAt: Date;
}

class DataQualityMonitor {
  private rules: QualityRule[];
  private alerts: AlertService;

  async runQualityChecks(tableName: string): Promise<QualityCheckResult[]> {
    const tableRules = this.rules.filter(r => r.tableName === tableName);
    const results: QualityCheckResult[] = [];

    for (const rule of tableRules) {
      const result = await this.executeRule(rule);
      results.push(result);

      // 根据结果采取行动
      if (result.status === 'failed') {
        await this.handleFailure(rule, result);
      }
    }

    return results;
  }

  private async executeRule(rule: QualityRule): Promise<QualityCheckResult> {
    const query = this.buildQualityQuery(rule);

    const result = await this.spark.sql(query);
    const row = result.collect()[0];

    const totalRows = row['total_rows'];
    const failedRows = row['failed_rows'];
    const failedPercentage = (failedRows / totalRows) * 100;

    let status: 'passed' | 'failed' | 'warning' = 'passed';

    if (failedPercentage > rule.severityThresholds.critical) {
      status = 'failed';
    } else if (failedPercentage > rule.severityThresholds.warning) {
      status = 'warning';
    }

    return {
      ruleName: rule.name,
      tableName: rule.tableName,
      status,
      totalRows,
      failedRows,
      failedPercentage,
      threshold: rule.severityThresholds[status],
      executedAt: new Date(),
    };
  }

  private async handleFailure(
    rule: QualityRule,
    result: QualityCheckResult
  ): Promise<void> {
    switch (rule.action) {
      case 'alert':
        await this.alerts.send({
          type: 'data_quality_alert',
          severity: result.status === 'failed' ? 'critical' : 'warning',
          message: `Data quality check failed: ${rule.name}`,
          metadata: {
            table: rule.tableName,
            failedRows: result.failedRows,
            percentage: result.failedPercentage,
          },
        });
        break;

      case 'quarantine':
        await this.quarantineFailedRows(rule, result);
        break;

      case 'block':
        await this.blockPipeline(rule.tableName);
        break;
    }
  }
}
```

---

## 6. 数据访问

### 6.1 查询服务

```typescript
// data-lake/access/query-service.ts
import { PrestoClient } from 'presto-client';

interface QueryRequest {
  sql: string;
  catalog?: string;
  schema?: string;
  properties?: Record<string, string>;
}

interface QueryResult {
  columns: ColumnInfo[];
  rows: any[];
  metadata: {
    executionTimeMs: number;
    scannedBytes: number;
    rowsScanned: number;
  };
}

class DataLakeQueryService {
  private presto: PrestoClient;
  private cache: QueryCache;

  constructor() {
    this.presto = new PrestoClient({
      host: 'presto-coordinator',
      port: 8080,
      user: 'projectfactory-datalake',
    });
  }

  async executeQuery(request: QueryRequest): Promise<QueryResult> {
    const startTime = Date.now();

    // 检查缓存
    const cacheKey = this.getCacheKey(request);
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      return { ...cached, fromCache: true };
    }

    // 构建完整 SQL
    const fullSQL = this.buildFullSQL(request);

    // 执行查询
    const result = await this.presto.query(fullSQL);

    const queryResult: QueryResult = {
      columns: result.columns,
      rows: result.rows,
      metadata: {
        executionTimeMs: Date.now() - startTime,
        scannedBytes: result.stats?.scannedBytes || 0,
        rowsScanned: result.stats?.rowsScanned || 0,
      },
    };

    // 缓存结果
    await this.cache.set(cacheKey, queryResult, {
      ttl: 300, // 5 分钟
      tags: [request.schema || 'default'],
    });

    return queryResult;
  }

  // 分析查询
  async explainPlan(sql: string): Promise<ExplainPlan> {
    const result = await this.presto.query(`EXPLAIN ${sql}`);
    return this.parseExplainPlan(result.rows);
  }

  // 查询采样
  async sampleData(
    table: string,
    options: { limit: number; strategy: 'random' | 'head' }
  ): Promise<any[]> {
    let sql: string;

    if (options.strategy === 'random') {
      sql = `SELECT * FROM ${table} ORDER BY RANDOM() LIMIT ${options.limit}`;
    } else {
      sql = `SELECT * FROM ${table} LIMIT ${options.limit}`;
    }

    const result = await this.executeQuery({ sql });
    return result.rows;
  }
}
```

### 6.2 REST API

```yaml
# data-lake/api/query-api.yaml
openapi: 3.0.0
info:
  title: Data Lake API
  version: 1.0.0

paths:
  /api/v1/query:
    post:
      summary: "执行查询"
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                sql:
                  type: string
                  description: "SQL 查询语句"
                catalog:
                  type: string
                  default: " iceberg"
                schema:
                  type: string
                  default: "gold"
                properties:
                  type: object
                  description: "额外属性"
      responses:
        200:
          description: "查询成功"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/QueryResult"

  /api/v1/tables:
    get:
      summary: "列出所有表"
      parameters:
        - name: schema
          in: query
          schema:
            type: string
            enum: [bronze, silver, gold]
      responses:
        200:
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/TableInfo"

  /api/v1/tables/{schema}/{table}/sample:
    get:
      summary: "采样表数据"
      parameters:
        - name: schema
          in: path
          required: true
        - name: table
          in: path
          required: true
        - name: limit
          in: query
          schema:
            type: integer
            default: 100
        - name: strategy
          in: query
          schema:
            type: string
            enum: [random, head]
            default: head
      responses:
        200:
          content:
            application/json:
              schema:
                type: object
                properties:
                  columns:
                    type: array
                  rows:
                    type: array
                  metadata:
                    $ref: "#/components/schemas/TableMetadata"

  /api/v1/quality/reports:
    get:
      summary: "获取数据质量报告"
      parameters:
        - name: start_date
          in: query
          schema:
            type: string
            format: date
        - name: end_date
          in: query
          schema:
            type: string
            format: date
        - name: table
          in: query
          schema:
            type: string
      responses:
        200:
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/QualityReport"
```

---

## 7. ML 特征工程

### 7.1 特征存储

```yaml
# data-lake/ml/feature-store.yaml
featureStore:
  online:
    storage: "Redis"
    path: "s3://projectfactory-datalake/features/online/"
    ttl: "7 days"

  offline:
    storage: "S3"
    path: "s3://projectfactory-datalake/features/offline/"
    format: "parquet"
    partitionBy:
      - "feature_name"
      - "date"

  tables:
    idea_features:
      description: "想法相关特征"
      entities:
        - name: "idea"
          type: "string"
      features:
        - name: "title_embedding"
          type: "vector<float>"
          dimension: 768
          source: "openai/text-embedding-3"
        - name: "title_length"
          type: "int"
        - name: "description_length"
          type: "int"
        - name: "tags_count"
          type: "int"
        - name: "is_popular_topic"
          type: "boolean"
        - name: "topic_category"
          type: "string"

    project_features:
      description: "项目相关特征"
      entities:
        - name: "project"
          type: "string"
      features:
        - name: "file_count"
          type: "int"
        - name: "line_count"
          type: "bigint"
        - name: "avg_file_size"
          type: "float"
        - name: "language"
          type: "string"
        - name: "has_tests"
          type: "boolean"
        - name: "has_documentation"
          type: "boolean"
        - name: "complexity_score"
          type: "float"
        - name: "quality_score_trend"
          type: "array<float>"
```

### 7.2 特征管道

```python
# data-lake/ml/feature-pipeline.py
from feast import FeatureStore
import pandas as pd

class FeaturePipeline:
    def __init__(self, repo_path: str):
        self.fs = FeatureStore(repo_path=repo_path)

    def generate_idea_features(self, idea_ids: list[str]) -> pd.DataFrame:
        """生成想法特征"""
        features = self.fs.get_feature_service("idea_features")

        # 从在线存储获取
        feature_vector = self.fs.retrieve_online_features(
            features=features,
            entity_rows=[{"idea": idea_id} for idea_id in idea_ids]
        )

        return pd.DataFrame(feature_vector)

    def generate_project_features(self, project_ids: list[str]) -> pd.DataFrame:
        """生成项目特征"""
        features = self.fs.get_feature_service("project_features")

        feature_vector = self.fs.retrieve_online_features(
            features=features,
            entity_rows=[{"project": project_id} for project_id in project_ids]
        )

        return pd.DataFrame(feature_vector)

    def generate_training_dataset(
        self,
        entity_df: pd.DataFrame,
        feature_services: list[str]
    ) -> pd.DataFrame:
        """生成训练数据集"""
        # 获取历史特征
        training_df = self.fs.get_historical_features(
            entity_df=entity_df,
            feature_services=feature_services,
        ).to_df()

        return training_df

    def register_new_features(
        self,
        feature_view_name: str,
        features_df: pd.DataFrame
    ):
        """注册新特征"""
        # 写入离线存储
        self.fs.write_to_offline_store(
            feature_view_name=feature_view_name,
            df=features_df,
        )

        # 推送特征到在线存储
        self.fs.materialize_incremental(
            feature_view_name=feature_view_name,
            end_date=pd.Timestamp.now(),
        )
```

---

## 8. 相关文档

- [数据仓库与分析](./DATA_WAREHOUSE_ANALYTICS.md)
- [事件驱动架构](./EVENT_DRIVEN_ARCHITECTURE.md)
- [批处理系统](./BATCH_PROCESSING.md)
- [机器学习平台](./ML_PLATFORM.md)

---

**最后更新**: 2026-04-14
