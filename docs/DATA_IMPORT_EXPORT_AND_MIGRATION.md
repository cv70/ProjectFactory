# 数据导入导出与迁移系统

## 概述

数据导入导出与迁移系统（Data Import/Export & Migration System）负责管理系统数据的导入、导出和迁移能力。该系统支持多种格式的数据交换，支持数据的批量迁移和同步，为用户提供灵活的数据管理能力，同时也为系统的备份恢复和数据迁移提供基础设施。

## 核心价值

- **格式多样**：支持JSON、CSV、XML、Excel等多种格式
- **批量操作**：支持大规模数据的批量导入导出
- **增量同步**：支持增量数据的同步和更新
- **格式验证**：导入前进行数据格式和内容验证
- **断点续传**：支持大文件的断点续传
- **数据转换**：支持数据格式的转换和映射

## 导入系统

### 导入任务模型

```typescript
// 导入任务状态
enum ImportTaskStatus {
  PENDING = 'pending',           // 等待处理
  VALIDATING = 'validating',     // 验证中
  IMPORTING = 'importing',       // 导入中
  COMPLETED = 'completed',       // 已完成
  FAILED = 'failed',            // 失败
  CANCELLED = 'cancelled',       // 已取消
  PARTIAL = 'partial',          // 部分成功
}

// 导入任务
interface ImportTask {
  id: string;
  name: string;
  description?: string;

  // 源信息
  source: {
    type: 'file' | 'url' | 'api' | 'database';
    url?: string;
    format: DataFormat;
    size?: number;
    checksum?: string;
  };

  // 目标信息
  target: {
    entityType: string;         // 目标实体类型
    mode: 'create' | 'update' | 'upsert' | 'replace';
    batchSize: number;
  };

  // 映射配置
  mapping: FieldMapping[];

  // 转换配置
  transformations: Transformation[];

  // 验证配置
  validation: {
    strict: boolean;
    skipInvalidRows: boolean;
    maxErrors: number;
  };

  // 结果
  result?: {
    totalRows: number;
    importedRows: number;
    skippedRows: number;
    failedRows: number;
    errors: ImportError[];
    startTime: Date;
    endTime?: Date;
    duration?: number;
  };

  status: ImportTaskStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform?: TransformationType;
  defaultValue?: any;
  required: boolean;
}

interface Transformation {
  field: string;
  type: TransformationType;
  config?: Record<string, any>;
}

type TransformationType =
  | 'trim'
  | 'lowercase'
  | 'uppercase'
  | 'capitalize'
  | 'date_format'
  | 'number_format'
  | 'lookup'
  | 'regex_replace'
  | 'split'
  | 'join'
  | 'json_parse'
  | 'base64_decode';

interface ImportError {
  row: number;
  field: string;
  value: any;
  error: string;
  original?: any;
}
```

### 导入处理器

```typescript
// 导入服务
class ImportService {
  // 创建导入任务
  async createImport(
    request: CreateImportRequest,
    userId: string
  ): Promise<ImportTask> {
    // 1. 验证请求
    await this.validateRequest(request);

    // 2. 创建任务
    const task: ImportTask = {
      id: this.generateId(),
      name: request.name,
      source: request.source,
      target: request.target,
      mapping: request.mapping,
      transformations: request.transformations,
      validation: request.validation,
      status: ImportTaskStatus.PENDING,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.taskStore.save(task);

    // 3. 触发异步处理
    this.processImport(task.id).catch(console.error);

    return task;
  }

  // 处理导入
  async processImport(taskId: string): Promise<void> {
    const task = await this.taskStore.findById(taskId);
    if (!task) throw new NotFoundError();

    try {
      // 更新状态
      await this.updateStatus(taskId, ImportTaskStatus.VALIDATING);

      // 1. 获取数据源
      const data = await this.fetchData(task.source);

      // 2. 验证数据
      const validation = await this.validateData(task, data);
      if (!validation.valid && task.validation.strict) {
        await this.failTask(taskId, validation.errors);
        return;
      }

      // 更新状态
      await this.updateStatus(taskId, ImportTaskStatus.IMPORTING);

      // 3. 解析数据
      const records = await this.parseData(task.source.format, data);

      // 4. 转换数据
      const transformed = await this.transformData(records, task);

      // 5. 映射字段
      const mapped = await this.mapFields(transformed, task.mapping);

      // 6. 批量导入
      const result = await this.executeImport(mapped, task);

      // 7. 完成
      await this.completeTask(taskId, result);

    } catch (error) {
      await this.failTask(taskId, [error.message]);
    }
  }

  // 数据验证
  private async validateData(
    task: ImportTask,
    data: Buffer
  ): Promise<ValidationResult> {
    const errors: ImportError[] = [];
    const records = await this.parseData(task.source.format, data);

    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      // 验证必填字段
      for (const mapping of task.mapping) {
        if (mapping.required && !record[mapping.sourceField]) {
          errors.push({
            row: i + 1,
            field: mapping.sourceField,
            value: record[mapping.sourceField],
            error: 'Required field is missing',
          });

          if (errors.length >= task.validation.maxErrors) break;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // 批量导入
  private async executeImport(
    records: Record<string, any>[],
    task: ImportTask
  ): Promise<ImportResult> {
    const result: ImportResult = {
      totalRows: records.length,
      importedRows: 0,
      skippedRows: 0,
      failedRows: 0,
      errors: [],
      startTime: new Date(),
    };

    // 分批处理
    for (let i = 0; i < records.length; i += task.target.batchSize) {
      const batch = records.slice(i, i + task.target.batchSize);

      try {
        const batchResult = await this.processBatch(batch, task);
        result.importedRows += batchResult.imported;
        result.skippedRows += batchResult.skipped;
        result.failedRows += batchResult.failed;
        result.errors.push(...batchResult.errors);

      } catch (error) {
        result.failedRows += batch.length;
        result.errors.push({
          row: i + 1,
          field: '',
          value: null,
          error: error.message,
        });
      }

      // 更新进度
      await this.updateProgress(task.id, result);
    }

    result.endTime = new Date();
    result.duration = result.endTime.getTime() - result.startTime.getTime();

    return result;
  }
}
```

### 支持的格式

```typescript
// 数据格式定义
enum DataFormat {
  JSON = 'json',
  JSONL = 'jsonl',           // JSON Lines
  CSV = 'csv',
  TSV = 'tsv',
  XML = 'xml',
  XLSX = 'xlsx',
  XLS = 'xls',
}

// 格式解析器
class DataParser {
  async parse(format: DataFormat, data: Buffer): Promise<Record<string, any>[]> {
    switch (format) {
      case DataFormat.JSON:
        return this.parseJSON(data);
      case DataFormat.JSONL:
        return this.parseJSONL(data);
      case DataFormat.CSV:
        return this.parseCSV(data);
      case DataFormat.XLSX:
        return this.parseExcel(data);
      case DataFormat.XML:
        return this.parseXML(data);
      default:
        throw new UnsupportedFormatError(format);
    }
  }

  // JSON解析
  private async parseJSON(data: Buffer): Promise<Record<string, any>[]> {
    const content = data.toString('utf-8');
    const parsed = JSON.parse(content);

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (parsed.data && Array.isArray(parsed.data)) {
      return parsed.data;
    }

    throw new Error('JSON must contain an array or object with data array');
  }

  // CSV解析
  private async parseCSV(data: Buffer): Promise<Record<string, any>[]> {
    const content = data.toString('utf-8');
    const lines = content.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    const headers = this.parseCSVLine(lines[0]);
    const records: Record<string, any>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const record: Record<string, any> = {};

      headers.forEach((header, index) => {
        record[header] = values[index] || '';
      });

      records.push(record);
    }

    return records;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }
}
```

## 导出系统

### 导出任务模型

```typescript
// 导出任务
interface ExportTask {
  id: string;
  name: string;

  // 源信息
  source: {
    entityType: string;
    filters?: QueryFilter[];
    sort?: SortOption[];
    selectedFields?: string[];
  };

  // 目标信息
  target: {
    type: 'download' | 'storage' | 'email' | 'webhook' | 's3';
    format: DataFormat;
    compression?: 'none' | 'zip' | 'gzip';
    url?: string;              // storage/webhook/s3
  };

  // 选项
  options: {
    includeMetadata: boolean;
    includeHeaders: boolean;
    dateFormat: string;
    batchSize: number;
  };

  // 结果
  result?: {
    fileUrl?: string;
    fileSize?: number;
    recordCount: number;
    checksum?: string;
    downloadCount: number;
    expiresAt?: Date;
  };

  status: ExportTaskStatus;
  createdBy: string;
  createdAt: Date;
  completedAt?: Date;
}

enum ExportTaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

// 导出格式选项
interface ExportOptions {
  format: DataFormat;
  compression?: 'none' | 'zip' | 'gzip';
  includeMetadata?: boolean;
  includeHeaders?: boolean;
  dateFormat?: string;
  selectedFields?: string[];
}
```

### 导出处理器

```typescript
// 导出服务
class ExportService {
  // 创建导出
  async createExport(
    request: CreateExportRequest,
    userId: string
  ): Promise<ExportTask> {
    const task: ExportTask = {
      id: this.generateId(),
      name: request.name,
      source: request.source,
      target: request.target,
      options: request.options,
      status: ExportTaskStatus.PENDING,
      createdBy: userId,
      createdAt: new Date(),
    };

    await this.taskStore.save(task);

    // 触发异步处理
    this.processExport(task.id).catch(console.error);

    return task;
  }

  // 处理导出
  private async processExport(taskId: string): Promise<void> {
    const task = await this.taskStore.findById(taskId);

    try {
      await this.updateStatus(taskId, ExportTaskStatus.PROCESSING);

      // 1. 查询数据
      const records = await this.queryData(task.source);

      // 2. 转换数据
      const transformed = await this.transformForExport(records, task.options);

      // 3. 序列化为指定格式
      const content = await this.serialize(transformed, task.target.format);

      // 4. 压缩（如需要）
      const finalContent = await this.compress(content, task.target.compression);

      // 5. 上传/存储
      const result = await this.storeResult(task, finalContent);

      // 6. 完成
      await this.completeTask(taskId, result);

    } catch (error) {
      await this.failTask(taskId, error.message);
    }
  }

  // 获取导出文件
  async getExportFile(taskId: string): Promise<ExportFile> {
    const task = await this.taskStore.findById(taskId);
    if (!task || task.status !== ExportTaskStatus.COMPLETED) {
      throw new NotFoundError('Export not found or not completed');
    }

    // 检查过期
    if (task.result?.expiresAt && task.result.expiresAt < new Date()) {
      throw new ExpiredError('Export has expired');
    }

    // 增加下载计数
    task.result.downloadCount++;
    await this.taskStore.save(task);

    // 获取文件
    const file = await this.storage.get(task.result.fileUrl);

    return {
      name: `${task.name}.${task.target.format}`,
      content: file.content,
      size: file.size,
      contentType: this.getContentType(task.target.format),
    };
  }
}
```

## 数据迁移

### 迁移任务模型

```typescript
// 迁移任务
interface MigrationTask {
  id: string;
  name: string;
  description?: string;

  // 源配置
  source: {
    type: 'internal' | 'external' | 'backup';
    connection?: ConnectionConfig;
    snapshotId?: string;
  };

  // 目标配置
  target: {
    type: 'internal' | 'external';
    connection?: ConnectionConfig;
  };

  // 迁移范围
  scope: {
    entityTypes: string[];
    filters?: Record<string, QueryFilter[]>;
    limit?: number;
  };

  // 迁移选项
  options: {
    mode: 'full' | 'incremental' | 'delta';
    conflictResolution: 'source' | 'target' | 'merge';
    preserveIds: boolean;
    preserveTimestamps: boolean;
    dryRun: boolean;
  };

  // 映射配置
  entityMappings: EntityMigrationMapping[];

  // 进度
  progress?: {
    totalEntities: number;
    migratedEntities: number;
    failedEntities: number;
    currentEntity: string;
    startedAt?: Date;
    estimatedCompletion?: Date;
  };

  status: MigrationTaskStatus;
  createdBy: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

interface EntityMigrationMapping {
  sourceEntity: string;
  targetEntity: string;
  fieldMappings: FieldMapping[];
  transforms: Transformation[];
}

enum MigrationTaskStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  VALIDATING = 'validating',
  MIGRATING = 'migrating',
  VALIDATING_TARGET = 'validating',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PARTIAL = 'partial',
}
```

### 迁移执行器

```typescript
// 迁移服务
class MigrationService {
  // 创建迁移任务
  async createMigration(
    request: CreateMigrationRequest,
    userId: string
  ): Promise<MigrationTask> {
    // 1. 验证源和目标连接
    await this.validateConnections(request.source, request.target);

    // 2. 分析源数据
    const sourceAnalysis = await this.analyzeSource(request.source);

    // 3. 分析目标数据
    const targetAnalysis = await this.analyzeTarget(request.target);

    // 4. 生成映射建议
    const mappings = await this.suggestMappings(sourceAnalysis, targetAnalysis);

    // 5. 创建任务
    const task: MigrationTask = {
      ...request,
      id: this.generateId(),
      entityMappings: mappings,
      status: MigrationTaskStatus.DRAFT,
      createdBy: userId,
      createdAt: new Date(),
    };

    await this.taskStore.save(task);

    return task;
  }

  // 执行迁移
  async executeMigration(taskId: string): Promise<void> {
    const task = await this.taskStore.findById(taskId);

    try {
      // 验证
      await this.updateStatus(taskId, MigrationTaskStatus.VALIDATING);
      await this.validateMigration(task);
      await this.updateStatus(taskId, MigrationTaskStatus.MIGRATING);

      // 获取源数据快照
      const snapshot = await this.createSnapshot(task);

      // 迁移每个实体
      for (const mapping of task.entityMappings) {
        await this.migrateEntity(task, mapping, snapshot);
      }

      // 验证目标
      await this.updateStatus(taskId, MigrationTaskStatus.VALIDATING_TARGET);
      await this.validateTarget(task);

      // 完成
      await this.completeMigration(taskId);

    } catch (error) {
      await this.failMigration(taskId, error);
    }
  }

  // 迁移单个实体
  private async migrateEntity(
    task: MigrationTask,
    mapping: EntityMigrationMapping,
    snapshot: MigrationSnapshot
  ): Promise<void> {
    const sourceRecords = await this.getSourceRecords(task, mapping.sourceEntity);

    for (const record of sourceRecords) {
      try {
        // 转换
        const transformed = this.transformRecord(record, mapping.transforms);

        // 映射字段
        const mapped = this.mapFields(transformed, mapping.fieldMappings);

        // 冲突处理
        const resolved = await this.resolveConflict(mapped, task, mapping);

        // 写入目标
        await this.writeTargetRecord(task.target, mapping.targetEntity, resolved);

        task.progress.migratedEntities++;

      } catch (error) {
        task.progress.failedEntities++;
        await this.recordMigrationError(task.id, mapping.sourceEntity, record, error);
      }

      // 更新进度
      await this.updateProgress(task.id);
    }
  }
}
```

## 数据格式转换

### 转换规则

```typescript
// 内置转换函数
const builtInTransforms: Record<TransformationType, TransformFunction> = {
  trim: (value: string) => value?.trim(),

  lowercase: (value: string) => value?.toLowerCase(),

  uppercase: (value: string) => value?.toUpperCase(),

  capitalize: (value: string) =>
    value?.charAt(0).toUpperCase() + value?.slice(1).toLowerCase(),

  date_format: (value: string | Date, config: { format: string }) =>
    dayjs(value).format(config.format),

  number_format: (value: number, config: { decimals: number; separator: string }) =>
    value.toFixed(config.decimals).replace(/\B(?=(\d{3})+(?!\d))/g, config.separator),

  json_parse: (value: string) => JSON.parse(value),

  base64_decode: (value: string) => Buffer.from(value, 'base64').toString('utf-8'),

  lookup: (value: any, config: { table: Record<string, any> }) =>
    config.table[value] ?? value,
};

// 复杂转换：正则替换
const regex_replace: TransformFunction = (
  value: string,
  config: { pattern: string; replacement: string; flags?: string }
) => {
  const regex = new RegExp(config.pattern, config.flags || 'g');
  return value.replace(regex, config.replacement);
};

// 复杂转换：分割
const split: TransformFunction = (
  value: string,
  config: { delimiter: string; index?: number }
) => {
  const parts = value.split(config.delimiter);
  return config.index !== undefined ? parts[config.index] : parts;
};

// 复杂转换：合并
const join: TransformFunction = (
  values: any[],
  config: { delimiter: string }
) => {
  if (!Array.isArray(values)) values = [values];
  return values.join(config.delimiter);
};
```

## 配置示例

```yaml
# 数据导入导出配置
data_management:
  # 导入配置
  import:
    max_file_size: "100MB"
    supported_formats: ["json", "jsonl", "csv", "xlsx", "xml"]
    default_batch_size: 1000
    max_concurrent_imports: 5
    temp_storage_path: "/tmp/imports"
    validation:
      strict_mode: true
      max_errors: 100
      skip_invalid_rows: false

  # 导出配置
  export:
    max_records: 1000000
    supported_formats: ["json", "csv", "xlsx", "xml"]
    compression: "gzip"
    default_retention_days: 7
    download_expiry_hours: 24

  # 迁移配置
  migration:
    batch_size: 500
    checkpoint_interval: 100
    preserve_timestamps: true
    dry_run_enabled: true
    conflict_resolution: "source"
    max_retries: 3

  # 存储配置
  storage:
    type: "local"  # local | s3 | gcs
    local:
      path: "/data/exports"
    s3:
      bucket: "${S3_BUCKET}"
      region: "${AWS_REGION}"
      prefix: "exports/"
```

---

**最后更新**: 2026-04-14
