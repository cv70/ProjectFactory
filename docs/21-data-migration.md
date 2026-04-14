# 数据迁移策略

## 1. 迁移场景

### 1.1 迁移类型

| 类型 | 说明 | 复杂度 |
|------|------|--------|
| Schema迁移 | 表结构变更 | 中 |
| 数据迁移 | 数据转移 | 高 |
| 存储迁移 | SQLite → PostgreSQL | 高 |
| 版本迁移 | API版本升级 | 中 |

## 2. Schema迁移

### 2.1 迁移管理

```typescript
// migration/schema.ts

export interface Migration {
  version: number;
  name: string;
  up: (db: Database) => Promise<void>;
  down: (db: Database) => Promise<void>;
}

export class SchemaMigrator {
  private migrations: Map<number, Migration> = new Map();

  register(migration: Migration): void {
    this.migrations.set(migration.version, migration);
  }

  async migrate(targetVersion?: number): Promise<MigrationResult> {
    const currentVersion = await this.getCurrentVersion();

    const versions = Array.from(this.migrations.keys())
      .filter(v => v > currentVersion)
      .sort((a, b) => a - b);

    const target = targetVersion || versions[versions.length - 1];

    const migrationsToApply = versions.filter(v => v <= target);

    const results: MigrationResult = {
      from: currentVersion,
      to: target,
      migrations: [],
      success: false,
      rollbackData: [],
    };

    try {
      for (const version of migrationsToApply) {
        const migration = this.migrations.get(version)!;

        console.log(`Applying migration: ${migration.name} (v${version})`);

        await migration.up(this.db);
        await this.recordMigration(version, 'applied');

        results.migrations.push({
          version,
          name: migration.name,
          status: 'applied',
        });
      }

      await this.setCurrentVersion(target);
      results.success = true;

    } catch (error) {
      console.error('Migration failed:', error);
      results.error = String(error);

      // 自动回滚
      await this.rollback(results.migrations);
    }

    return results;
  }

  async rollback(appliedMigrations: Array<{version: number, name: string}>): Promise<void> {
    console.log('Rolling back migrations...');

    // 按相反顺序回滚
    for (const mig of [...appliedMigrations].reverse()) {
      const migration = this.migrations.get(mig.version)!;

      console.log(`Rolling back: ${migration.name} (v${mig.version})`);

      try {
        await migration.down(this.db);
        await this.recordMigration(mig.version, 'rolled-back');
      } catch (error) {
        console.error(`Rollback failed for v${mig.version}:`, error);
        // 继续尝试回滚其他迁移
      }
    }
  }

  private async getCurrentVersion(): Promise<number> {
    const row = await this.db.get('SELECT version FROM migrations ORDER BY version DESC LIMIT 1');
    return row?.version || 0;
  }

  private async setCurrentVersion(version: number): Promise<void> {
    await this.db.run(`
      INSERT INTO migrations (version, status, applied_at)
      VALUES (?, 'applied', datetime('now'))
    `, [version]);
  }
}
```

### 2.2 迁移示例

```typescript
// migrations/001_add_user_preferences.ts

export const migration001: Migration = {
  version: 1,
  name: 'Add user preferences',
  up: async (db) => {
    await db.exec(`
      ALTER TABLE users ADD COLUMN preferences_json TEXT;
      ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'light';
    `);

    // 迁移现有用户数据
    await db.exec(`
      UPDATE users SET preferences_json = '{"notifications": true}'
      WHERE preferences_json IS NULL
    `);
  },

  down: async (db) => {
    await db.exec(`
      ALTER TABLE users DROP COLUMN preferences_json;
      ALTER TABLE users DROP COLUMN theme;
    `);
  },
};

// migrations/002_add_agent_metrics.ts

export const migration002: Migration = {
  version: 2,
  name: 'Add agent metrics table',
  up: async (db) => {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS agent_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_name TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        metric_value REAL,
        recorded_at TEXT NOT NULL,
        tags TEXT,
        INDEX (agent_name, metric_name),
        INDEX (recorded_at)
      );
    `);
  },

  down: async (db) => {
    await db.exec(`DROP TABLE IF EXISTS agent_metrics`);
  },
};
```

## 3. 数据迁移

### 3.1 批量迁移

```typescript
// migration/data.ts

export class DataMigrator {
  private batchSize = 1000;

  async migrate(
    source: DataSource,
    target: DataSource,
    transformation: TransformFunction
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      total: 0,
      migrated: 0,
      failed: 0,
      errors: [],
    };

    console.log(`Starting data migration from ${source.name} to ${target.name}`);

    try {
      // 获取总记录数
      const total = await source.count();
      result.total = total;

      // 分批迁移
      for (let offset = 0; offset < total; offset += this.batchSize) {
        const records = await source.fetch(offset, this.batchSize);

        for (const record of records) {
          try {
            // 转换数据
            const transformed = await transformation(record);

            // 插入目标
            await target.insert(transformed);
            result.migrated++;
          } catch (error) {
            result.failed++;
            result.errors.push({
              record,
              error: String(error),
            });
          }
        }

        console.log(`Migrated ${result.migrated}/${total} records`);
      }

      console.log(`Migration complete: ${result.migrated} succeeded, ${result.failed} failed`);

    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }

    return result;
  }

  async migrateWithVerification(
    source: DataSource,
    target: DataSource,
    transformation: TransformFunction,
    verifier: VerifyFunction
  ): Promise<MigrationResult> {
    const result = await this.migrate(source, target, transformation);

    // 验证数据一致性
    const verificationResult = await verifier.verify(source, target);

    if (!verificationResult.match) {
      console.warn('Data verification failed:', verificationResult.mismatches);
      // 可以选择回滚或记录问题
    }

    result.verification = verificationResult;
    return result;
  }
}
```

## 4. 存储迁移

### 4.1 SQLite到PostgreSQL

```typescript
// migration/storage/migration-to-postgres.ts

export class StorageMigrator {
  async migrateToPostgres(
    sqlitePath: string,
    pgConfig: PostgresConfig
  ): Promise<void> {
    // 1. 连接源数据库
    const sqlite = new Database(sqlitePath);

    // 2. 连接目标数据库
    const pg = new PostgresClient(pgConfig);

    // 3. 分析SQLite Schema
    const schema = await this.analyzeSQLiteSchema(sqlite);

    // 4. 创建PostgreSQL表
    for (const table of schema.tables) {
      await this.createPostgreSQLTable(pg, table);
    }

    // 5. 迁移数据
    for (const table of schema.tables) {
      await this.migrateTableData(sqlite, pg, table);
    }

    // 6. 创建索引
    for (const table of schema.tables) {
      for (const index of table.indexes) {
        await this.createPostgreSQLIndex(pg, table.name, index);
      }
    }

    // 7. 验证数据
    await this.verifyMigration(sqlite, pg);

    console.log('Migration to PostgreSQL completed successfully');
  }

  private async migrateTableData(
    sqlite: Database.Database,
    pg: PostgresClient,
    table: TableSchema
  ): Promise<void> {
    console.log(`Migrating table: ${table.name}`);

    // 分批读取SQLite数据
    const countResult = await sqlite.get(`SELECT COUNT(*) as count FROM ${table.name}`);
    const total = countResult.count;

    const batchSize = 1000;
    for (let offset = 0; offset < total; offset += batchSize) {
      const rows = await sqlite.all(`
        SELECT * FROM ${table.name}
        LIMIT ${batchSize} OFFSET ${offset}
      `);

      // 转换并插入PostgreSQL
      for (const row of rows) {
        const transformed = this.transformRow(row, table);
        await pg.insert(table.name, transformed);
      }

      console.log(`Migrated ${Math.min(offset + batchSize, total)}/${total} rows`);
    }
  }

  private transformRow(row: any, table: TableSchema): any {
    const transformed: any = {};

    for (const column of table.columns) {
      let value = row[column.name];

      // 类型转换
      switch (column.type) {
        case 'INTEGER':
          value = value ? parseInt(value) : null;
          break;
        case 'TEXT':
          value = String(value);
          break;
        case 'REAL':
          value = value ? parseFloat(value) : null;
          break;
      }

      transformed[column.name] = value;
    }

    return transformed;
  }
}
```

### 4.2 数据导出导入

```typescript
// migration/storage/export-import.ts

export class DataExporter {
  async exportData(
    db: Database,
    tables?: string[]
  ): Promise<ExportResult> {
    const result: ExportResult = {
      tables: {},
      timestamp: new Date(),
      version: await this.getCurrentVersion(),
    };

    const tableList = tables || await this.getTableNames(db);

    for (const tableName of tableList) {
      const tableResult = await this.exportTable(db, tableName);
      result.tables[tableName] = tableResult;
    }

    // 生成导出文件
    const jsonData = JSON.stringify(result, null, 2);
    await fs.writeFile(
      `export-${Date.now()}.json`,
      jsonData
    );

    console.log(`Exported ${tableList.length} tables`);
    return result;
  }

  private async exportTable(
    db: Database,
    tableName: string
  ): Promise<TableExport> {
    const rows = await db.all(`SELECT * FROM ${tableName}`);
    const schema = await this.getTableSchema(db, tableName);

    return {
      name: tableName,
      schema,
      data: rows,
      rowCount: rows.length,
    };
  }
}

export class DataImporter {
  async importData(
    db: Database,
    exportFile: string
  ): Promise<ImportResult> {
    // 读取导出文件
    const data = JSON.parse(await fs.readFile(exportFile, 'utf-8'));

    const result: ImportResult = {
      imported: 0,
      failed: 0,
      tables: 0,
      errors: [],
    };

    try {
      // 检查版本兼容性
      if (!await this.isVersionCompatible(data.version)) {
        throw new Error(`Incompatible version: ${data.version}`);
      }

      // 导入每个表
      for (const tableName of Object.keys(data.tables)) {
        const tableData = data.tables[tableName];

        // 创建表
        await this.createTableFromSchema(db, tableName, tableData.schema);

        // 导入数据
        for (const row of tableData.data) {
          try {
            await this.insertRow(db, tableName, tableData.schema, row);
            result.imported++;
          } catch (error) {
            result.failed++;
            result.errors.push({
              table: tableName,
              row,
              error: String(error),
            });
          }
        }

        result.tables++;
      }

      // 更新版本
      await this.setCurrentVersion(data.version);

      console.log(`Imported ${result.tables} tables, ${result.imported} rows`);
      return result;

    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  }
}
```

## 5. 零停迁移

### 5.1 在线迁移策略

```typescript
// migration/zero-downtime.ts

export class ZeroDowntimeMigrator {
  async migrate(
    strategy: 'shadow' | 'dual-write' | 'toggle',
    migration: Migration
  ): Promise<void> {
    switch (strategy) {
      case 'shadow':
        await this.shadowWriteMigration(migration);
        break;
      case 'dual-write':
        await this.dualWriteMigration(migration);
        break;
      case 'toggle':
        await this.toggleSwitchMigration(migration);
        break;
    }
  }

  private async shadowWriteMigration(migration: Migration): Promise<void> {
    // 阶段1: 启动影子写
    console.log('Phase 1: Starting shadow writes');
    await migration.enableShadowWrites();

    // 阶段2: 复制现有数据
    console.log('Phase 2: Copying existing data');
    await migration.copyExistingData();

    // 阶段3: 验证数据一致性
    console.log('Phase 3: Verifying data consistency');
    const verification = await migration.verifyConsistency();

    // 阶段4: 切换
    if (verification.success) {
      console.log('Phase 4: Switching to new database');
      await migration.switch();
    } else {
      console.error('Verification failed, aborting migration');
      await migration.abort();
    }
  }

  private async dualWriteMigration(migration: Migration): Promise<void> {
    // 阶段1: 启动双写
    console.log('Phase 1: Starting dual writes');
    await migration.enableDualWrites();

    // 阶段2: 复制历史数据
    console.log('Phase 2: Copying historical data');
    await migration.copyHistoricalData();

    // 阶段3: 监控同步延迟
    console.log('Phase 3: Monitoring sync lag');
    const syncStatus = await migration.monitorSync();

    if (syncStatus.lag < 5000) { // 延迟小于5秒
      // 阶段4: 切换
      console.log('Phase 4: Switching to new database');
      await migration.switch();

      // 阶段5: 停止旧写
      console.log('Phase 5: Stopping old writes');
      await migration.disableOldWrites();
    } else {
      console.error('Sync lag too high: ' + syncStatus.lag);
    }
  }

  private async toggleSwitchMigration(migration: Migration): Promise<void> {
    // 使用流量切换
    console.log('Phase 1: Redirecting traffic');
    await migration.redirectTraffic(0.1); // 10%到新数据库

    // 验证
    const validation = await migration.validate();

    if (validation.success) {
      // 逐步增加流量
      for (const percentage of [0.25, 0.5, 0.75, 1.0]) {
        console.log(`Redirecting ${percentage * 100}% traffic`);
        await migration.redirectTraffic(percentage);
        await sleep(60000); // 等待1分钟

        const health = await migration.healthCheck();
        if (!health.healthy) {
          console.error('Health check failed, rolling back');
          await migration.redirectTraffic(0);
          throw new Error('Migration failed');
        }
      }

      console.log('Migration completed successfully');
    }
  }
}
```

## 6. 迁移回滚

```typescript
// migration/rollback.ts

export class MigrationRollback {
  async rollback(migrationId: string): Promise<RollbackResult> {
    // 查找迁移记录
    const migration = await this.getMigration(migrationId);

    const result: RollbackResult = {
      migrationId,
      rolledBack: false,
      error: null,
    };

    try {
      // 执行down脚本
      if (migration.down) {
        console.log(`Executing down migration: ${migration.name}`);
        await migration.down(this.db);
      }

      // 更新迁移状态
      await this.updateMigrationStatus(migrationId, 'rolled-back');

      result.rolledBack = true;
      console.log('Rollback completed');

    } catch (error) {
      result.error = String(error);
      console.error('Rollback failed:', error);
      throw error;
    }

    return result;
  }

  async emergencyRollback(): Promise<void> {
    // 导出当前状态
    const backup = await this.createBackup();

    // 恢复上一个稳定版本
    const stableMigration = await this.getLastStableMigration();

    if (stableMigration) {
      await this.executeRollback(stableMigration.id);
    } else {
      // 如果没有稳定版本，使用备份
      await this.restoreFromBackup(backup);
    }
  }

  async createBackup(): Promise<Backup> {
    const backupId = generateId();
    const backupPath = `backups/emergency-${backupId}.db`;

    // 复制数据库文件
    await fs.copyFile('data.db', backupPath);

    return {
      id: backupId,
      path: backupPath,
      createdAt: new Date(),
    };
  }
}
```

---

**版本**: 0.1.0
**更新日期**: 2026-04-14
**状态**: 设计阶段
