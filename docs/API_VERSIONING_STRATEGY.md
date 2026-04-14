# API 版本管理策略

## 概述

本文档定义 ProjectFactory 系统的 API 版本管理策略，确保 API 在迭代演进过程中保持向后兼容，同时支持重大变革和平滑迁移。

## 1. 版本策略概述

### 1.1 版本策略选择

| 策略 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| URL 路径版本 | 明确、易调试 | 破坏 REST 美感 | 公开 API、主要版本 |
| Header 版本 | 保持 URL 干净 | 调试困难 | 内部 API、细微版本 |
| Query 参数版本 | 灵活 | 容易被忽略 | 可选功能参数 |
| 日期版本 | 语义清晰 | URL 较长 | 长期支持版本 |

ProjectFactory 采用 **URL 路径版本** 作为主要策略，理由：
- 公开 API 需要明确版本
- 便于调试和测试
- 与 API Gateway 集成友好

### 1.2 版本号规范

```
主版本.次版本.补丁版本

v1.0.0
  │  │  └── 补丁版本：Bug 修复，完全向后兼容
  │  └───── 次版本：新功能，向后兼容
  └───────── 主版本：破坏性变更，不兼容旧版
```

| 变更类型 | 版本递增 | 示例 |
|----------|----------|------|
| 补丁版本 | P++ | 1.0.0 → 1.0.1 |
| 次版本 | M++ | 1.0.1 → 1.1.0 |
| 主版本 | M++ | 1.3.2 → 2.0.0 |

## 2. 版本生命周期

### 2.1 版本状态定义

```typescript
// src/api/versioning/version-states.ts
type VersionStatus = 'current' | 'deprecated' | ' sunset' | 'removed';

interface VersionInfo {
  version: string;           // e.g., "v2.1.0"
  status: VersionStatus;
  releaseDate: Date;
  endOfLifeDate?: Date;      // 废弃日期
  sunsetDate?: Date;         // 最终下线日期
  migrationGuide?: string;   // 迁移指南 URL
  breakingChanges: string[]; // 破坏性变更列表
}

const VersionLifecycle = {
  // 当前活跃版本
  current: {
    description: '完全支持，包含所有新功能',
    supportLevel: 'full',
    deprecationPolicy: '12 个月前通知',
  },

  // 已废弃版本
  deprecated: {
    description: '继续支持但不再添加新功能',
    supportLevel: 'security-only',
    deprecationPolicy: '6 个月后进入 sunset',
  },

  // 最终维护期
  sunset: {
    description: '仅安全修复，不承诺 SLA',
    supportLevel: 'best-effort',
    deprecationPolicy: '3 个月后完全移除',
  },

  // 已移除
  removed: {
    description: '不再可用，请求返回 410 Gone',
    supportLevel: 'none',
  },
};
```

### 2.2 版本时间线

```
v1.0.0 ────────────────────────────────────────────────────→ (2025-01)
   │                                                          │
   │ v1.1.0 ────────────────────────────────────────────→    │
   │    │                                                       │
   │    │ v2.0.0 ───────────────────────────────────────→     │
   │    │    │                                                 │
2024-01    2024-06    2024-12    2025-06    2025-12    2026-06
   │          │          │          │          │          │
   │          │          │          │          │          │
   └──────────┴──────────┴──────────┴──────────┴──────────┴──→ Current
                    │          │          │
                    └──────────┴──────────┴── Deprecated (6 months)
                               │          │
                               └──────────┴── Sunset (3 months)
                                          │
                                          └── Removed
```

## 3. 版本路由实现

### 3.1 Express 版本路由

```typescript
// src/api/routes/versioned-routes.ts
interface VersionConfig {
  version: string;
  routes: Router;
  middleware?: RequestHandler[];
}

class APIVersionRouter {
  private versions: Map<string, VersionConfig> = new Map();
  private defaultVersion: string;

  constructor(defaultVersion: string = 'v1') {
    this.defaultVersion = defaultVersion;
  }

  register(version: string, routes: Router, middleware?: RequestHandler[]): void {
    this.versions.set(version, { version, routes, middleware });
  }

  getRouter(): Router {
    const router = Router();

    // 版本选择中间件
    router.use(this.versionSelectionMiddleware.bind(this));

    // 为每个版本注册路由
    for (const [version, config] of this.versions) {
      const versionPrefix = `/api/${version}`;

      router.use(versionPrefix, ...(config.middleware || []), config.routes);

      console.log(`Registered API routes: ${versionPrefix}`);
    }

    // 未版本化的请求使用默认版本（重定向）
    router.use('/api', (req, res, next) => {
      // 将请求重定向到默认版本
      const targetUrl = `/api/${this.defaultVersion}${req.path}`;
      res.redirect(301, targetUrl);
    });

    return router;
  }

  private versionSelectionMiddleware(req: Request, res: Response, next: NextFunction): void {
    // 从 URL 提取版本或使用默认版本
    const versionMatch = req.url.match(/^\/api\/(v\d+)/);
    const requestedVersion = versionMatch ? versionMatch[1] : this.defaultVersion;

    // 检查版本是否存在
    if (!this.versions.has(requestedVersion)) {
      // 返回支持的版本列表
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_VERSION',
          message: `API version '${requestedVersion}' is not supported`,
          supportedVersions: Array.from(this.versions.keys()),
        },
      });
    }

    // 将版本信息附加到请求对象
    (req as any).apiVersion = requestedVersion;

    next();
  }
}

// 使用示例
const apiRouter = new APIVersionRouter('v1');

apiRouter.register('v1', v1Routes);
apiRouter.register('v2', v2Routes);

app.use(apiRouter.getRouter());
```

### 3.2 版本兼容性检查

```typescript
// src/api/versioning/compatibility-checker.ts
interface BreakingChange {
  type: 'field_removed' | 'field_renamed' | 'type_changed' | 'required_added' | 'enum_changed';
  path: string;
  oldValue?: any;
  newValue?: any;
}

interface CompatibilityReport {
  fromVersion: string;
  toVersion: string;
  breakingChanges: BreakingChange[];
  isCompatible: boolean;
  migrationSteps: string[];
}

class CompatibilityChecker {
  private schemaCache: Map<string, SchemaDefinition> = new Map();

  async checkCompatibility(
    fromVersion: string,
    toVersion: string,
    resource: string
  ): Promise<CompatibilityReport> {
    const oldSchema = await this.getSchema(fromVersion, resource);
    const newSchema = await this.getSchema(toVersion, resource);

    const breakingChanges = this.findBreakingChanges(oldSchema, newSchema);

    return {
      fromVersion,
      toVersion,
      breakingChanges,
      isCompatible: breakingChanges.length === 0,
      migrationSteps: this.generateMigrationSteps(breakingChanges),
    };
  }

  private findBreakingChanges(
    oldSchema: SchemaDefinition,
    newSchema: SchemaDefinition
  ): BreakingChange[] {
    const changes: BreakingChange[] = [];

    for (const [path, oldField] of Object.entries(oldSchema.fields)) {
      const newField = newSchema.fields[path];

      if (!newField) {
        changes.push({
          type: 'field_removed',
          path,
          oldValue: oldField.type,
        });
        continue;
      }

      // 类型变更
      if (oldField.type !== newField.type) {
        changes.push({
          type: 'type_changed',
          path,
          oldValue: oldField.type,
          newValue: newField.type,
        });
      }

      // 必填字段添加
      if (!oldField.required && newField.required) {
        changes.push({
          type: 'required_added',
          path,
        });
      }

      // 枚举值变更
      if (oldField.enum && newField.enum) {
        const removedValues = oldField.enum.filter(v => !newField.enum!.includes(v));
        if (removedValues.length > 0) {
          changes.push({
            type: 'enum_changed',
            path,
            oldValue: oldField.enum,
            newValue: newField.enum,
          });
        }
      }
    }

    return changes;
  }

  private generateMigrationSteps(changes: BreakingChange[]): string[] {
    return changes.map(change => {
      switch (change.type) {
        case 'field_removed':
          return `Remove usage of '${change.path}' field - it has been deprecated.`;
        case 'field_renamed':
          return `Rename '${change.path}' to '${change.newValue}' - update your integration.`;
        case 'type_changed':
          return `Update '${change.path}' type from ${change.oldValue} to ${change.newValue}.`;
        case 'required_added':
          return `Add required field '${change.path}' to your requests.`;
        case 'enum_changed':
          return `Update '${change.path}' enum values - removed: ${change.oldValue}.`;
        default:
          return `Review changes to '${change.path}'.`;
      }
    });
  }
}
```

## 4. 破坏性变更管理

### 4.1 破坏性变更类型

| 变更类型 | 示例 | 影响 |
|----------|------|------|
| 删除/重命名端点 | DELETE /projects → /workspaces | 客户端需要更新 |
| 删除/重命名字段 | `name` → `projectName` | 数据映射需要更新 |
| 变更字段类型 | `count: int` → `count: string` | 序列化需要更新 |
| 变更认证方式 | API Key → OAuth 2.0 | 集成需要重新开发 |
| 移除功能 | 删除批量导入 | 功能不可用 |

### 4.2 破坏性变更处理策略

```typescript
// src/api/versioning/breaking-change-handler.ts
class BreakingChangeHandler {
  // 渐进式移除策略
  async deprecateField(
    resource: string,
    field: string,
    removalVersion: string
  ): Promise<void> {
    // 1. 当前版本：添加废弃警告到响应
    await this.addDeprecationWarning(resource, field);

    // 2. 保留旧字段，但标记为废弃
    await this.addSunsetHeader(resource, field, removalVersion);

    // 3. 添加迁移指南
    await this.addMigrationGuide(resource, field);
  }

  // 向后兼容的字段重命名
  async renameField(
    resource: string,
    oldField: string,
    newField: string
  ): Promise<void> {
    // 1. 在响应中同时包含新旧字段
    await this.addAliasField(resource, oldField, newField);

    // 2. 请求中接受新旧两种字段名
    await this.allowAliasInput(resource, oldField, newField);

    // 3. 记录使用旧字段的客户端
    await this.trackDeprecatedFieldUsage(resource, oldField);
  }

  // 变更字段类型
  async changeFieldType(
    resource: string,
    field: string,
    oldType: string,
    newType: string
  ): Promise<void> {
    // 1. 添加新的类型字段
    await this.addNewTypeField(resource, `${field}_new`);

    // 2. 保持旧字段继续工作
    await this.addAutoConversion(resource, field, oldType, newType);

    // 3. 发送类型转换警告
    await this.sendConversionWarning(resource, field);
  }
}
```

## 5. API 废弃流程

### 5.1 废弃通知

```typescript
// src/api/versioning/deprecation-notice.ts
interface DeprecationNotice {
  type: 'field' | 'endpoint' | 'version';
  identifier: string;
  deprecatedSince: string;      // 引入废弃的版本
  sunsetDate: Date;
  replacement?: string;
  migrationGuide?: string;
}

class DeprecationNoticeService {
  // 在响应中添加 Deprecation 头
  addDeprecationHeaders(
    res: Response,
    notice: DeprecationNotice
  ): void {
    res.set({
      'Deprecation': `true`,
      'Sunset': notice.sunsetDate.toUTCString(),
      'Link': this.buildLinkHeader(notice),
      'X-API-Deprecated': notice.identifier,
    });
  }

  private buildLinkHeader(notice: DeprecationNotice): string {
    const links: string[] = [];

    if (notice.replacement) {
      links.push(`<${notice.replacement}>; rel="successor-version"`);
    }

    if (notice.migrationGuide) {
      links.push(`<${notice.migrationGuide}>; rel="deprecation-guide"`);
    }

    links.push(`<https://docs.projectfactory.io/deprecations/${notice.identifier}>; rel="alternate"`);

    return links.join(', ');
  }

  // 废弃端点
  async deprecateEndpoint(
    endpoint: string,
    method: string,
    sunsetDate: Date,
    options?: { replacement?: string; migrationGuide?: string }
  ): Promise<void> {
    const notice: DeprecationNotice = {
      type: 'endpoint',
      identifier: `${method} ${endpoint}`,
      deprecatedSince: this.getCurrentVersion(),
      sunsetDate,
      replacement: options?.replacement,
      migrationGuide: options?.migrationGuide,
    };

    await this.storeNotice(notice);
  }

  // 废弃字段
  async deprecateField(
    resource: string,
    field: string,
    sunsetDate: Date,
    options?: { replacement?: string }
  ): Promise<void> {
    const notice: DeprecationNotice = {
      type: 'field',
      identifier: `${resource}.${field}`,
      deprecatedSince: this.getCurrentVersion(),
      sunsetDate,
      replacement: options?.replacement,
    };

    await this.storeNotice(notice);
  }
}
```

### 5.2 废弃监控

```typescript
// src/api/versioning/deprecation-monitor.ts
interface DeprecationUsageReport {
  deprecatedItem: string;
  usageCount: number;
  clientVersions: Record<string, number>;
  estimatedSunsetImpact: 'low' | 'medium' | 'high';
}

class DeprecationMonitor {
  private usageTracker: Map<string, {
    count: number;
    clientVersions: Map<string, number>;
    lastUsed: number;
  }> = new Map();

  // 记录废弃 API 的使用
  recordUsage(deprecatedItem: string, clientVersion: string): void {
    const existing = this.usageTracker.get(deprecatedItem);

    if (existing) {
      existing.count++;
      existing.lastUsed = Date.now();
      const count = existing.clientVersions.get(clientVersion) || 0;
      existing.clientVersions.set(clientVersion, count + 1);
    } else {
      this.usageTracker.set(deprecatedItem, {
        count: 1,
        clientVersions: new Map([[clientVersion, 1]]),
        lastUsed: Date.now(),
      });
    }
  }

  // 生成废弃使用报告
  async generateUsageReport(): Promise<DeprecationUsageReport[]> {
    const reports: DeprecationUsageReport[] = [];
    const notices = await this.getAllDeprecationNotices();

    for (const notice of notices) {
      const usage = this.usageTracker.get(notice.identifier);

      if (!usage) {
        reports.push({
          deprecatedItem: notice.identifier,
          usageCount: 0,
          clientVersions: {},
          estimatedSunsetImpact: 'low',
        });
        continue;
      }

      const clientVersions: Record<string, number> = {};
      for (const [version, count] of usage.clientVersions) {
        clientVersions[version] = count;
      }

      reports.push({
        deprecatedItem: notice.identifier,
        usageCount: usage.count,
        clientVersions,
        estimatedSunsetImpact: this.estimateImpact(usage.count, notices.length),
      });
    }

    return reports;
  }

  private estimateImpact(count: number, totalDeprecations: number): 'low' | 'medium' | 'high' {
    const avgUsage = count / totalDeprecations;
    if (count < 10) return 'low';
    if (count < 100) return 'medium';
    return 'high';
  }
}
```

## 6. 版本化最佳实践

### 6.1 API 设计检查清单

```typescript
// 版本化设计检查
const VersioningChecklist = {
  beforeReleasingNewVersion: [
    // 变更评估
    'assessedBreakingChanges: 已评估所有变更是否破坏兼容性',
    'documentedBreakingChanges: 已文档化所有破坏性变更',
    'reviewedWithTeam: 已与团队 review 兼容性影响',

    // 沟通计划
    'notifiedClients: 已提前通知所有客户端（至少 12 个月）',
    'publishedMigrationGuide: 已发布迁移指南',
    'setSunsetDate: 已设置废弃日期',

    // 技术实现
    'implementedDeprecationHeaders: 已实现 Deprecation 头',
    'addedSunsetHeaders: 已添加 Sunset 响应头',
    'updatedDocumentation: 已更新 API 文档',

    // 测试
    'testedCompatibility: 已测试与旧版本的兼容性',
    'testedMigrationPath: 已测试迁移路径',
    'loadTestedNewVersion: 已对新版本进行负载测试',
  ],

  breakingChangeRules: [
    // 不允许的破坏性变更
    'neverRemoveFieldsWithoutDeprecation: 不在无废弃通知的情况下移除字段',
    'neverChangeFieldTypes: 不改变现有字段的类型',
    'neverRemoveRequiredFields: 不将可选字段改为必填',
    'neverChangeEnumValues: 不移除或改变枚举值',
    'neverBreakAuthentication: 不破坏现有认证机制',
  ],

  backwardCompatibleChanges: [
    // 允许的变更
    'addNewOptionalFields: 添加新的可选字段',
    'addNewEndpoints: 添加新的端点',
    'addNewEnumValues: 添加新的枚举值（旧客户端忽略）',
    'addNewQueryParameters: 添加新的查询参数（旧客户端忽略）',
    'expandErrorCodes: 扩展错误码',
  ],
};
```

### 6.2 版本选择策略

```typescript
// src/api/versioning/client-version-selector.ts

// 客户端版本选择建议
class ClientVersionSelector {
  // 推荐策略
  static getRecommendation(clientVersion: string, availableVersions: string[]): {
    recommended: string;
    alternatives: string[];
    action: 'upgrade' | 'continue' | 'no-action';
  } {
    const sorted = availableVersions
      .map(v => ({ version: v, parsed: this.parseVersion(v) }))
      .filter(v => v.parsed !== null)
      .sort((a, b) => this.compareVersions(a.parsed!, b.parsed!));

    const current = this.parseVersion(clientVersion);

    // 查找最新的稳定版本
    const latestStable = sorted.find(v => !v.version.includes('beta'));

    // 查找最新的兼容版本
    const latestCompatible = sorted.find(v =>
      v.parsed!.major === current!.major &&
      v.parsed!.minor >= current!.minor
    );

    if (latestCompatible && latestCompatible.version !== clientVersion) {
      return {
        recommended: latestCompatible.version,
        alternatives: [latestStable?.version].filter(Boolean),
        action: 'upgrade',
      };
    }

    return {
      recommended: clientVersion,
      alternatives: sorted.slice(0, 3).map(v => v.version),
      action: 'continue',
    };
  }

  private static parseVersion(version: string): { major: number; minor: number; patch: number } | null {
    const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
    if (!match) return null;
    return {
      major: parseInt(match[1]),
      minor: parseInt(match[2]),
      patch: parseInt(match[3]),
    };
  }

  private static compareVersions(a: { major: number; minor: number; patch: number },
                                  b: { major: number; minor: number; patch: number }): number {
    if (a.major !== b.major) return b.major - a.major;
    if (a.minor !== b.minor) return b.minor - a.minor;
    return b.patch - a.patch;
  }
}
```

---

**最后更新**: 2026-04-14
**版本**: v1.0
