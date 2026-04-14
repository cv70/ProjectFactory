# 数据迁移策略设计

## 1. 概述

本文档描述 ProjectFactory 系统的数据库迁移策略，确保 schema 变更的可靠性和零停机部署。

### 1.1 设计目标

| 目标 | 描述 |
|------|------|
| 零停机 | 迁移期间服务不中断 |
| 可回滚 | 支持回滚到上一版本 |
| 版本控制 | 所有迁移脚本版本化管理 |
| 幂等性 | 迁移可安全重复执行 |
| 数据完整性 | 迁移过程不丢失数据 |

### 1.2 迁移模式

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           迁移生命周期                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐   │
│  │  编写   │ → │  测试   │ → │  部署   │ → │  监控   │ → │  清理   │   │
│  │  迁移   │    │  迁移   │    │  迁移   │    │  回滚   │    │  历史   │   │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘   │
│                                                                              │
│  策略选择                                                                   │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐   │
│  │  Expand-Contract     │  │   Dual-Write         │  │   Shadow Table   │   │
│  │   (蓝绿迁移)         │  │   (双写)             │  │   (影子表)       │   │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 迁移框架

### 2.1 迁移文件结构

```typescript
// drizzle/migrations/meta/0000_snapshot.json
{
  "version": "0000",
  "id": "20260414000000",
  "prevId": "00000000-0000-0000-0000-000000000000",
  "timestamp": "2026-04-14T00:00:00.000Z",
  "migrationName": "create_projects_table",
  "tables": {
    "projects": {
      "name": "projects",
      "columns": {
        "id": { "name": "id", "type": "text", "primaryKey": true },
        "name": { "name": "name", "type": "text", "notNull": true },
        "status": { "name": "status", "type": "text", "notNull": true },
        "created_at": { "name": "created_at", "type": "integer", "notNull": true },
        "updated_at": { "name": "updated_at", "type": "integer", "notNull": true }
      },
      "indexes": {
        "projects_status_idx": { "columns": ["status"], "isUnique": false }
      }
    }
  }
}

// drizzle/migrations/0000_create_projects_table.ts
import { Migration } from 'drizzle';

export const up: Migration = async (db) => {
  // 创建表
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "projects" (
      "id" text PRIMARY KEY,
      "name" text NOT NULL,
      "status" text NOT NULL DEFAULT 'pending',
      "created_at" integer NOT NULL,
      "updated_at" integer NOT NULL
    )
  `);

  // 创建索引
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects" ("status")`);
};

export const down: Migration = async (db) => {
  await db.execute(sql`DROP TABLE IF EXISTS "projects"`);
};
```

### 2.2 迁移管理器

```typescript
// src/db/migration-manager.ts
class MigrationManager {
  constructor(
    private db: Database,
    private logger: Logger
  ) {}

  // 获取当前版本
  async getCurrentVersion(): Promise<string | null> {
    const result = await this.db.execute(sql`
      SELECT version FROM migrations ORDER BY applied_at DESC LIMIT 1
    `);
    return result.rows[0]?.version || null;
  }

  // 获取待执行迁移
  async getPendingMigrations(): Promise<Migration[]> {
    const current = await this.getCurrentVersion();
    const all = await this.getAllMigrations();

    if (!current) return all;

    return all.filter(m => m.id > current);
  }

  // 执行单个迁移
  async applyMigration(migration: Migration): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.execute('BEGIN');

      // 记录迁移开始
      await this.logMigrationStart(migration);

      // 执行迁移
      await migration.up(this.db);

      // 记录迁移完成
      await this.logMigrationComplete(migration);

      await client.execute('COMMIT');

      this.logger.info(`Migration ${migration.name} applied successfully`);
    } catch (error) {
      await client.execute('ROLLBACK');
      this.logger.error(`Migration ${migration.name} failed`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  // 回滚单个迁移
  async rollbackMigration(migration: Migration): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.execute('BEGIN');

      await migration.down(this.db);
      await this.deleteMigrationRecord(migration);

      await client.execute('COMMIT');

      this.logger.info(`Migration ${migration.name} rolled back`);
    } catch (error) {
      await client.execute('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // 批量执行迁移
  async migrate(): Promise<{ applied: number; failed?: MigrationError }> {
    const pending = await this.getPendingMigrations();

    for (const migration of pending) {
      try {
        await this.applyMigration(migration);
      } catch (error) {
        return {
          applied: pending.indexOf(migration),
          failed: { migration, error },
        };
      }
    }

    return { applied: pending.length };
  }
}
```

---

## 3. 零停机迁移策略

### 3.1 Expand-Contract 模式

```typescript
// 阶段 1: Expand - 添加新表/字段 (向后兼容)
async function expandPhase() {
  // 添加新字段 (nullable, 有默认值)
  await db.execute(sql`
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS quality_score real DEFAULT NULL
  `);

  // 添加新表
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS project_metrics (
      id text PRIMARY KEY,
      project_id text NOT NULL REFERENCES projects(id),
      metric_name text NOT NULL,
      metric_value real NOT NULL,
      created_at integer NOT NULL
    )
  `);

  // 创建新索引
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS project_metrics_project_id_idx
    ON project_metrics(project_id)
  `);
}

// 阶段 2: 数据迁移
async function dataMigration() {
  // 批量迁移数据
  const batchSize = 1000;
  let offset = 0;
  let migrated = 0;

  do {
    const rows = await db.execute(sql`
      SELECT * FROM old_table
      LIMIT ${batchSize} OFFSET ${offset}
    `);

    if (rows.length === 0) break;

    for (const row of rows) {
      await db.execute(sql`
        INSERT INTO new_table (id, name, created_at)
        VALUES (${row.id}, ${row.name}, ${row.created_at})
        ON CONFLICT (id) DO NOTHING
      `);
    }

    migrated += rows.length;
    offset += batchSize;

    // 记录进度
    await saveMigrationProgress('v1_to_v2', offset);
  } while (true);

  // 验证迁移
  const sourceCount = await db.execute(sql`SELECT COUNT(*) FROM old_table`);
  const targetCount = await db.execute(sql`SELECT COUNT(*) FROM new_table`);

  if (sourceCount !== targetCount) {
    throw new Error(`Data mismatch: source=${sourceCount}, target=${targetCount}`);
  }
}

// 阶段 3: Contract - 删除旧字段/表
async function contractPhase() {
  // 先删除引用
  await db.execute(sql`DROP INDEX IF EXISTS old_table_name_idx`);
  await db.execute(sql`DROP TABLE IF EXISTS old_table`);
}
```

### 3.2 双写模式

```typescript
// 双写管理器
class DualWriteManager {
  private writeToBoth = true;

  async writeProjects(data: ProjectInput): Promise<Project> {
    const [newRecord, oldRecord] = await Promise.all([
      this.writeToNewTable(data),
      this.writeToOldTable(data),
    ]);

    return newRecord;
  }

  // 后台同步任务
  async syncWorker() {
    const batchSize = 100;
    let lastId = await this.getLastSyncedId();

    while (true) {
      const rows = await db.execute(sql`
        SELECT * FROM old_table
        WHERE id > ${lastId}
        ORDER BY id
        LIMIT ${batchSize}
      `);

      if (rows.length === 0) break;

      for (const row of rows) {
        await this.syncRow(row);
      }

      lastId = rows[rows.length - 1].id;
      await this.saveLastSyncedId(lastId);

      await this.sleep(100); // 避免过载
    }
  }

  // 切换读写
  async switchToNew(): Promise<void> {
    // 1. 停止双写
    this.writeToBoth = false;

    // 2. 确保同步完成
    await this.waitForSyncComplete();

    // 3. 切换读取
    this.readFrom = 'new';
  }
}
```

### 3.3 影子表模式

```typescript
// 影子表迁移
async function shadowTableMigration() {
  // 1. 创建影子表
  await db.execute(sql`
    CREATE TABLE projects_shadow (
      LIKE projects INCLUDING ALL
    )
  `);

  // 2. 创建触发器同步数据
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION sync_to_shadow()
    RETURNS TRIGGER AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        INSERT INTO projects_shadow VALUES (NEW.*);
      ELSIF TG_OP = 'UPDATE' THEN
        UPDATE projects_shadow SET * = NEW.* WHERE id = OLD.id;
      ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM projects_shadow WHERE id = OLD.id;
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql
  `);

  await db.execute(sql`
    CREATE TRIGGER projects_sync_trigger
    AFTER INSERT OR UPDATE OR DELETE ON projects
    FOR EACH ROW EXECUTE FUNCTION sync_to_shadow()
  `);

  // 3. 验证数据一致性
  const sourceCount = await db.execute(sql`SELECT COUNT(*) FROM projects`);
  const shadowCount = await db.execute(sql`SELECT COUNT(*) FROM projects_shadow`);

  if (sourceCount !== shadowCount) {
    throw new Error('Shadow table out of sync');
  }
}
```

---

## 4. Schema 版本管理

### 4.1 版本表结构

```typescript
// drizzle/schema.ts
export const migrations = sqliteTable('migrations', {
  version: text('version').primaryKey(),
  name: text('name').notNull(),
  appliedAt: integer('applied_at', { mode: 'timestamp' }).notNull(),
  checksum: text('checksum').notNull(),
  executionTime: integer('execution_time_ms'),
});

export const migrationsLock = sqliteTable('migrations_lock', {
  id: integer('id').primaryKey(),
  lockedBy: text('locked_by'),
  lockedAt: integer('locked_at'),
  isReleased: integer('is_released', { mode: 'boolean' }).default(false),
});
```

### 4.2 迁移锁

```typescript
// 分布式迁移锁
class MigrationLock {
  constructor(private db: Database, private instanceId: string) {}

  async acquire(): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE migrations_lock
      SET locked_by = ${this.instanceId}, locked_at = unixepoch()
      WHERE id = 1 AND (locked_by IS NULL OR is_released = 1)
    `);

    return result.changes > 0;
  }

  async release(): Promise<void> {
    await this.db.execute(sql`
      UPDATE migrations_lock
      SET is_released = 1
      WHERE locked_by = ${this.instanceId}
    `);
  }

  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const acquired = await this.acquire();

    if (!acquired) {
      throw new Error('Could not acquire migration lock');
    }

    try {
      return await fn();
    } finally {
      await this.release();
    }
  }
}
```

---

## 5. 回滚策略

### 5.1 自动回滚

```typescript
// 自动回滚配置
interface RollbackConfig {
  enabled: boolean;
  maxRetries: number;
  rollbackOnError: boolean;
  notifyOnRollback: boolean;
}

async function migrateWithRollback(config: RollbackConfig) {
  const manager = new MigrationManager(db, logger);
  const pending = await manager.getPendingMigrations();

  for (const migration of pending) {
    try {
      await manager.applyMigration(migration);
    } catch (error) {
      if (config.rollbackOnError) {
        logger.warn(`Migration ${migration.name} failed, initiating rollback`);

        await manager.rollbackMigration(migration);

        if (config.notifyOnRollback) {
          await notifyRollback(migration, error);
        }
      }

      if (pending.indexOf(migration) < config.maxRetries) {
        continue;
      }

      throw error;
    }
  }
}
```

### 5.2 回滚检查清单

```markdown
# 数据库回滚检查清单

## 回滚前
- [ ] 确认回滚原因
- [ ] 备份当前数据库
- [ ] 通知相关团队
- [ ] 准备回滚脚本

## 回滚执行
- [ ] 获取迁移锁
- [ ] 执行 down() 迁移
- [ ] 验证数据完整性
- [ ] 释放迁移锁

## 回滚后
- [ ] 验证应用功能
- [ ] 监控系统指标
- [ ] 更新团队状态
- [ ] 记录事件
```

---

## 6. 相关文档

- [数据模型设计](./DATA_MODEL_DESIGN.md)
- [后端设计](./BACKEND_DESIGN.md)
- [部署架构](./DEPLOYMENT_ARCHITECTURE.md)

---

**最后更新**: 2026-04-14
