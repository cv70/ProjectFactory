# 最佳实践与标准规范

## 概述

最佳实践与标准规范（Best Practices & Standards）是 ProjectFactory 系统的质量基准线，系统化地定义了软件开发全生命周期的最佳实践、编码规范、设计原则和操作标准。这些规范是代码生成、质量评估和系统改进的核心参考依据。

## 核心价值

- **质量一致性**：确保生成的代码符合行业最佳实践
- **知识标准化**：将隐性经验转化为可执行的明确规范
- **效率提升**：减少决策时间，明确的规范减少歧义
- **新人友好**：降低团队新成员的学习曲线

## 规范体系架构

### 规范分层

```typescript
// 规范层级
enum StandardLevel {
  // 必须遵循（违规将导致质量问题）
  MANDATORY = 'mandatory',

  // 推荐遵循（强烈建议，偏离需有充分理由）
  RECOMMENDED = 'recommended',

  // 参考遵循（视情况使用）
  OPTIONAL = 'optional',

  // 实验性（新技术，待验证）
  EXPERIMENTAL = 'experimental',
}

// 规范元数据
interface StandardMetadata {
  id: string;                      // 如 "TS-001"
  title: string;
  category: StandardCategory;
  level: StandardLevel;

  // 适用范围
  scope: {
    languages?: string[];         // 适用语言
    projectTypes?: ProjectType[]; // 适用项目类型
    stages?: DevelopmentStage[];  // 适用阶段
  };

  // 关联
  relatedStandards: string[];
  relatedPatterns: string[];
  relatedAntiPatterns: string[];

  // 版本信息
  version: string;
  lastUpdated: Date;
  status: 'active' | 'deprecated' | 'superseded';
}
```

### 规范分类

```typescript
// 规范分类
enum StandardCategory {
  // 代码风格
  STYLE_NAMING = 'style_naming',           // 命名规范
  STYLE_FORMATTING = 'style_formatting',   // 格式化规范
  STYLE_COMMENTS = 'style_comments',       // 注释规范

  // 代码质量
  QUALITY_ERROR_HANDLING = 'quality_error_handling',   // 错误处理
  QUALITY_TESTING = 'quality_testing',                 // 测试规范
  QUALITY_SECURITY = 'quality_security',               // 安全规范
  QUALITY_PERFORMANCE = 'quality_performance',         // 性能规范

  // 架构设计
  ARCH_DESIGN = 'arch_design',             // 设计原则
  ARCH_COMPONENT = 'arch_component',       // 组件设计
  ARCH_API = 'arch_api',                   // API设计

  // 流程规范
  PROCESS_REVIEW = 'process_review',       // 评审流程
  PROCESS_DOCUMENTATION = 'process_documentation', // 文档规范
  PROCESS_VERSIONING = 'process_versioning',     // 版本规范

  // 数据规范
  DATA_MODELING = 'data_modeling',         // 数据建模
  DATA_VALIDATION = 'data_validation',     // 数据验证
  DATA_MIGRATION = 'data_migration',      // 数据迁移
}
```

## 代码风格规范

### TypeScript 命名规范

```typescript
// 命名规范集合
const TYPESCRIPT_NAMING_STANDARDS: Standard[] = [
  {
    id: 'TS-NAMING-001',
    title: '变量和函数使用 camelCase',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.STYLE_NAMING,
    rule: {
      pattern: /^[a-z][a-zA-Z0-9]*$/,
      valid: ['userName', 'getUserById', 'isActive', 'maxCount'],
      invalid: ['UserName', 'get_user_by_id', 'is_active', 'MaxCount'],
    },
    rationale: 'TypeScript/JavaScript 社区惯例，与 JavaScript 内置 API 一致',
  },

  {
    id: 'TS-NAMING-002',
    title: '类和接口使用 PascalCase',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.STYLE_NAMING,
    rule: {
      pattern: /^[A-Z][a-zA-Z0-9]*$/,
      valid: ['UserService', 'IUserRepository', 'ApiResponse'],
      invalid: ['userService', 'user_service', 'api_response'],
    },
    rationale: '区分类型和值，IDE 智能提示更清晰',
  },

  {
    id: 'TS-NAMING-003',
    title: '常量使用 UPPER_SNAKE_CASE',
    level: StandardLevel.RECOMMENDED,
    category: StandardCategory.STYLE_NAMING,
    rule: {
      pattern: /^[A-Z][A-Z0-9_]*$/,
      valid: ['MAX_RETRY_COUNT', 'API_BASE_URL', 'DEFAULT_TIMEOUT'],
      invalid: ['maxRetryCount', 'apiBaseUrl', 'defaultTimeout'],
    },
    rationale: '明确标识不可变值，与社区惯例一致',
  },

  {
    id: 'TS-NAMING-004',
    title: '私有属性使用 _ 前缀',
    level: StandardLevel.OPTIONAL,
    category: StandardCategory.STYLE_NAMING,
    rule: {
      pattern: /^_[a-z][a-zA-Z0-9]*$/,
      valid: ['_privateField', '_internalCache'],
      invalid: ['privateField', 'm_privateField'],
    },
    rationale: '明确标识私有成员，与 Python 惯例一致',
  },

  {
    id: 'TS-NAMING-005',
    title: '接口名称不使用 I 前缀',
    level: StandardLevel.RECOMMENDED,
    category: StandardCategory.STYLE_NAMING,
    rule: {
      valid: ['UserRepository', 'PaymentGateway'],
      invalid: ['IUserRepository', 'IPaymentGateway'],
    },
    rationale: 'TypeScript 类型系统已通过 interface 关键字区分，避免冗余',
  },

  {
    id: 'TS-NAMING-006',
    title: '布尔值使用 is/has/should/can 前缀',
    level: StandardLevel.RECOMMENDED,
    category: StandardCategory.STYLE_NAMING,
    rule: {
      valid: ['isActive', 'hasPermission', 'shouldUpdate', 'canDelete'],
      invalid: ['active', 'permission', 'update', 'delete'],
    },
    rationale: '明确标识布尔类型，提高代码可读性',
  },

  {
    id: 'TS-NAMING-007',
    title: '事件处理器使用 handle/on 前缀',
    level: StandardLevel.RECOMMENDED,
    category: StandardCategory.STYLE_NAMING,
    rule: {
      valid: ['handleClick', 'onSubmit', 'handleChange'],
      invalid: ['clickHandler', 'submitEvent', 'changeHandler'],
    },
    rationale: '明确标识事件处理逻辑',
  },

  {
    id: 'TS-NAMING-008',
    title: '文件名称使用 kebab-case',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.STYLE_NAMING,
    rule: {
      valid: ['user-service.ts', 'api-client.ts', 'index.ts'],
      invalid: ['UserService.ts', 'apiClient.ts', 'Api_Client.ts'],
    },
    rationale: '与 npm 包命名惯例一致，跨平台兼容性好',
  },
];
```

### TypeScript 代码格式规范

```typescript
// 格式化规范
const TYPESCRIPT_FORMATTING_STANDARDS: Standard[] = [
  {
    id: 'TS-FMT-001',
    title: '使用 2 空格缩进',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.STYLE_FORMATTING,
    rule: {
      indent: 2,
      valid: ['  function foo() {', '    return true;', '  }'],
    },
    tooling: {
      prettier: { "useTabs": false, "tabWidth": 2 },
      eslint: { "indent": ["error", 2] },
    },
  },

  {
    id: 'TS-FMT-002',
    title: '行末不保留分号',
    level: StandardLevel.RECOMMENDED,
    category: StandardCategory.STYLE_FORMATTING,
    rule: {
      semi: false,
      valid: ['const x = 1', 'const y = 2'],
    },
    tooling: {
      prettier: { "semi": false },
    },
    rationale: '减少视觉噪音，JavaScript 自动插入分号机制可靠',
  },

  {
    id: 'TS-FMT-003',
    title: '使用单引号字符串',
    level: StandardLevel.OPTIONAL,
    category: StandardCategory.STYLE_FORMATTING,
    rule: {
      quoteStyle: 'single',
      valid: ["const str = 'hello'"],
      invalid: ['const str = "hello"'],
    },
    tooling: {
      prettier: { "singleQuote": true },
    },
  },

  {
    id: 'TS-FMT-004',
    title: '对象末尾保留逗号',
    level: StandardLevel.RECOMMENDED,
    category: StandardCategory.STYLE_FORMATTING,
    rule: {
      trailingComma: 'all',
      valid: ['const obj = {', '  a: 1,', '  b: 2,', '}'],
    },
    tooling: {
      prettier: { "trailingComma": "all" },
    },
    rationale: '减少 diff，提高代码审查效率',
  },

  {
    id: 'TS-FMT-005',
    title: '箭头函数省略 return',
    level: StandardLevel.OPTIONAL,
    category: StandardCategory.STYLE_FORMATTING,
    rule: {
      implicitReturns: true,
      valid: ['const add = (a, b) => a + b'],
      invalid: ['const add = (a, b) => { return a + b }'],
    },
    rationale: '简洁，但复杂逻辑应使用显式 return',
  },

  {
    id: 'TS-FMT-006',
    title: '最大行长度 100 字符',
    level: StandardLevel.RECOMMENDED,
    category: StandardCategory.STYLE_FORMATTING,
    rule: {
      printWidth: 100,
    },
    tooling: {
      prettier: { "printWidth": 100 },
    },
  },

  {
    id: 'TS-FMT-007',
    title: '导入分组排序',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.STYLE_FORMATTING,
    rule: {
      importOrder: [
        '^@/.*$',           // 路径别名
        '^@core/.*$',      // 核心模块
        '^@components/.*$', // 组件
        '^[a-z].*$',       // 其他导入
        '^\\.\\./.*$',     // 父级相对导入
        '^\\./.*$',        // 同级相对导入
      ],
      groups: [
        'react',           // React 相关
        'types',          // 类型定义
        'builtins',       // 内置模块
        'external',       // 外部依赖
        'internal',       // 内部导入
      ],
    },
    tooling: {
      eslint: { "import/order": "error" },
    },
  },
];
```

## 错误处理规范

### 错误处理最佳实践

```typescript
// 错误处理规范
const ERROR_HANDLING_STANDARDS: Standard[] = [
  {
    id: 'ERR-001',
    title: '使用自定义 Error 类区分错误类型',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.QUALITY_ERROR_HANDLING,
    code: `
class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

class NotFoundError extends Error {
  constructor(
    message: string,
    public resourceType?: string,
    public resourceId?: string
  ) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

// 使用
function validateUserInput(input: unknown) {
  if (!input) {
    throw new ValidationError('Input is required', 'input', 'REQUIRED');
  }
}
    `,
    rationale: '便于错误分类处理和监控告警',
  },

  {
    id: 'ERR-002',
    title: '异步操作必须使用 try-catch',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.QUALITY_ERROR_HANDLING,
    code: `
// ✅ 正确
async function fetchUser(id: string) {
  try {
    const response = await api.get(\`/users/\${id}\`);
    return response.data;
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error; // 重新抛出已知错误
    }
    logger.error('Failed to fetch user', { id, error });
    throw new Error('Failed to fetch user'); // 转换为通用错误
  }
}

// ❌ 错误
async function fetchUser(id: string) {
  const response = await api.get(\`/users/\${id}\`); // 可能未被捕获
  return response.data;
}
    `,
    rationale: '防止未处理的异步错误导致进程崩溃',
  },

  {
    id: 'ERR-003',
    title: '错误信息包含上下文',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.QUALITY_ERROR_HANDLING,
    code: `
// ✅ 正确
class OrderError extends Error {
  constructor(
    message: string,
    public orderId: string,
    public context: Record<string, unknown>
  ) {
    super(message);
    this.name = 'OrderError';
  }
}

throw new OrderError(
  'Failed to process payment',
  order.id,
  { amount: order.total, currency: 'USD' }
);

// ❌ 错误
throw new Error('Failed to process payment');
    `,
    rationale: '便于问题定位和调试',
  },

  {
    id: 'ERR-004',
    title: '使用 Result 模式处理可恢复错误',
    level: StandardLevel.RECOMMENDED,
    category: StandardCategory.QUALITY_ERROR_HANDLING,
    code: `
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

async function tryParseJSON(json: string): Promise<Result<unknown>> {
  try {
    return { success: true, data: JSON.parse(json) };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

// 使用
const result = await tryParseJSON(input);
if (result.success) {
  console.log(result.data);
} else {
  console.error('Parse failed:', result.error);
}
    `,
    rationale: '显式处理错误，避免 try-catch 滥用',
  },

  {
    id: 'ERR-005',
    title: '顶层错误处理器防止进程崩溃',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.QUALITY_ERROR_HANDLING,
    code: `
// Express
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof ValidationError) {
    return res.status(400).json({ error: err.message, field: err.field });
  }

  res.status(500).json({ error: 'Internal server error' });
});

// Node.js 进程
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
});
    `,
    rationale: '捕获所有未处理错误，防止静默失败',
  },
];
```

## 安全规范

### 安全最佳实践

```typescript
// 安全规范
const SECURITY_STANDARDS: Standard[] = [
  {
    id: 'SEC-001',
    title: '永远不信任用户输入',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.QUALITY_SECURITY,
    code: `
// 1. 验证输入
const userSchema = z.object({
  email: z.string().email(),
  age: z.number().min(0).max(150),
  name: z.string().min(1).max(100).regex(/^[a-zA-Z\s]+$/),
});

function createUser(input: unknown) {
  const validated = userSchema.parse(input); // 验证失败会抛异常
  // ...
}

// 2. 参数化查询防注入
const user = await db.query(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);

// 3. HTML 转义防 XSS
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
    `,
    rationale: '用户输入是安全漏洞的主要来源',
  },

  {
    id: 'SEC-002',
    title: '敏感数据必须加密存储',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.QUALITY_SECURITY,
    code: `
// 密码使用 bcrypt 哈希
import bcrypt from 'bcrypt';

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// API 密钥使用 AES-256-GCM 加密
import crypto from 'crypto';

function encryptApiKey(plaintext: string, key: Buffer): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
  };
}
    `,
    rationale: '即使数据库泄露，攻击者也无法获取明文敏感数据',
  },

  {
    id: 'SEC-003',
    title: 'JWT Token 安全实践',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.QUALITY_SECURITY,
    code: `
interface TokenPayload {
  sub: string;        // 用户 ID
  email: string;
  role: string;
  iat: number;        // 签发时间
  exp: number;        // 过期时间
  jti: string;        // 唯一 ID，用于撤销
}

// 生成 Token
function generateToken(payload: Omit<TokenPayload, 'iat' | 'exp' | 'jti'>): string {
  const now = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      ...payload,
      iat: now,
      exp: now + 15 * 60,        // 15 分钟过期
      jti: crypto.randomUUID(),    // 用于撤销
    },
    process.env.JWT_SECRET!,
    { algorithm: 'HS256' }
  );
}

// 验证 Token
function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
}

// Refresh Token 策略
async function refreshTokens(refreshToken: string): Promise<Tokens> {
  // Refresh Token 有效期更长（如 7 天）
  // 存储在 httpOnly cookie 中
  // 可以撤销
}
    `,
    rationale: '确保身份验证安全，防止令牌伪造和重用',
  },

  {
    id: 'SEC-004',
    title: '速率限制防止滥用',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.QUALITY_SECURITY,
    code: `
import rateLimit from 'express-rate-limit';

// API 速率限制
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 分钟窗口
  max: 100,                   // 最多 100 请求
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 登录速率限制（更严格）
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,                      // 15 分钟内最多 5 次登录尝试
  message: { error: 'Too many login attempts' },
});

app.use('/api', apiLimiter);
app.post('/login', loginLimiter, authController.login);
    `,
    rationale: '防止暴力破解和 DDoS 攻击',
  },
];
```

## API 设计规范

### RESTful API 设计

```typescript
// API 设计规范
const API_DESIGN_STANDARDS: Standard[] = [
  {
    id: 'API-001',
    title: '使用名词复数形式表示资源',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.ARCH_API,
    examples: `
✅ GET    /users          # 获取用户列表
✅ GET    /users/:id      # 获取单个用户
✅ POST   /users          # 创建用户
✅ PUT    /users/:id      # 更新用户（完整）
✅ PATCH  /users/:id      # 部分更新用户
✅ DELETE /users/:id      # 删除用户

❌ GET    /getUsers
❌ POST   /createUser
❌ DELETE /deleteUser
    `,
    rationale: '符合 REST 惯例，语义清晰',
  },

  {
    id: 'API-002',
    title: '使用 HTTP 方法正确表达操作',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.ARCH_API,
    code: `
// GET - 查询，不应有副作用
GET /orders?status=pending

// POST - 创建资源
POST /orders
Body: { "customerId": "123", "items": [...] }

// PUT - 完整替换资源
PUT /orders/:id
Body: { "customerId": "123", "items": [...], "status": "shipped" }

// PATCH - 部分更新
PATCH /orders/:id
Body: { "status": "cancelled" }

// DELETE - 删除资源
DELETE /orders/:id

// 特殊情况：动作使用动词
POST /orders/:id/cancel    # 取消订单
POST /orders/:id/refund    # 退款
    `,
  },

  {
    id: 'API-003',
    title: '统一的响应格式',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.ARCH_API,
    code: `
// 成功响应
{
  "success": true,
  "data": {
    "id": "123",
    "name": "John",
    "email": "john@example.com"
  },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}

// 错误响应
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  },
  "requestId": "req_abc123"
}
    `,
  },

  {
    id: 'API-004',
    title: '使用 ISO 8601 日期格式',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.ARCH_API,
    code: `
const createdAt = "2024-01-15T10:30:00.000Z";

// ❌ 避免
const badDate = "2024-01-15"           // 不明确时区
const worseDate = "01/15/2024"         // 美式格式
const worstDate = "1705312200"         // Unix 时间戳

// ✅ 推荐
const goodDate = "2024-01-15T10:30:00Z"           // UTC
const betterDate = "2024-01-15T10:30:00+08:00"    // 指定时区
    `,
  },

  {
    id: 'API-005',
    title: '版本化 API',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.ARCH_API,
    code: `
// URL 版本（最直观）
GET /api/v1/users
GET /api/v2/users

// Header 版本（更 RESTful）
GET /users
Accept: application/vnd.company.v2+json

// 演变策略
1. 添加新字段到响应（向后兼容）
2. 新增端点（不破坏现有）
3. 重大变更才升版本
    `,
  },
];
```

## 数据库设计规范

```typescript
// 数据库设计规范
const DATABASE_STANDARDS: Standard[] = [
  {
    id: 'DB-001',
    title: '表名使用 snake_case 复数形式',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.DATA_MODELING,
    examples: `
✅ users, orders, order_items, product_categories
❌ User, Orders, orderItem, productCategories
    `,
  },

  {
    id: 'DB-002',
    title: '主键使用 UUID',
    level: StandardLevel.RECOMMENDED,
    category: StandardCategory.DATA_MODELING,
    code: `
// 使用 UUID v4 作为主键
import { v4 as uuidv4 } from 'uuid';

// 应用层生成
const id = uuidv4(); // "550e8400-e29b-41d4-a716-446655440000"

// 数据库自增（也可接受，但分布式的灵活性较差）
// BIGSERIAL PRIMARY KEY
    `,
    rationale: 'UUID 无需数据库往返，支持分布式生成',
  },

  {
    id: 'DB-003',
    title: '时间戳字段命名规范',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.DATA_MODELING,
    code: `
-- ✅ 命名规范
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
deleted_at TIMESTAMP WITH TIME ZONE  -- 软删除

-- ❌ 不规范命名
createTime TIMESTAMP
create_date TIMESTAMP
lastModified TIMESTAMP
    `,
  },

  {
    id: 'DB-004',
    title: '外键必须建立索引',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.DATA_MODELING,
    code: `
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 显式创建索引（某些数据库需要）
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
    `,
    rationale: '外键查询频繁，索引对性能至关重要',
  },

  {
    id: 'DB-005',
    title: '敏感字段加密存储',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.DATA_MODELING,
    code: `
// 不应明文存储
-- ❌ 危险
email VARCHAR(255)
phone VARCHAR(20)
credit_card_number VARCHAR(20)

// ✅ 加密存储
email_encrypted BYTEA          -- 加密
phone_encrypted BYTEA          -- 加密
credit_card_encrypted BYTEA    -- 加密
credit_card_last_four CHAR(4)  -- 仅存储后四位用于显示
    `,
  },
];
```

## 测试规范

```typescript
// 测试规范
const TESTING_STANDARDS: Standard[] = [
  {
    id: 'TEST-001',
    title: '测试命名：描述性名称',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.QUALITY_TESTING,
    code: `
// ✅ 描述性名称
describe('OrderService', () => {
  it('should calculate total price correctly for multiple items with different tax rates', () => {
    // ...
  });

  it('should throw ValidationError when creating order with negative quantity', () => {
    // ...
  });
});

// ❌ 模糊名称
describe('OrderService', () => {
  it('test calculate', () => { /* ... */ });
  it('test error', () => { /* ... */ });
});
    `,
  },

  {
    id: 'TEST-002',
    title: '测试结构：Arrange-Act-Assert',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.QUALITY_TESTING,
    code: `
it('should calculate discount correctly for VIP customers', () => {
  // Arrange - 准备测试数据
  const customer = createCustomer({ type: 'VIP', tier: 'gold' });
  const order = createOrder({ items: [...], subtotal: 1000 });

  // Act - 执行被测试的操作
  const discount = discountService.calculate(order, customer);

  // Assert - 验证结果
  expect(discount).toBe(100); // 10% VIP discount
});
    `,
  },

  {
    id: 'TEST-003',
    title: '单元测试覆盖率 ≥ 80%',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.QUALITY_TESTING,
    code: `
// 覆盖率配置（jest.config.js）
module.exports = {
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/services/':
      {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
  },
};
    `,
    rationale: '确保核心业务逻辑有充分测试',
  },

  {
    id: 'TEST-004',
    title: '集成测试覆盖关键业务流程',
    level: StandardLevel.MANDATORY,
    category: StandardCategory.QUALITY_TESTING,
    code: `
describe('User Registration Flow', () => {
  it('should complete registration with email verification', async () => {
    // 1. Create user
    const user = await createUser({ email: 'test@example.com' });

    // 2. Send verification email
    const email = await waitForEmail('test@example.com');
    expect(email.subject).toContain('Verify your email');

    // 3. Extract verification token
    const token = extractTokenFromEmail(email);

    // 4. Verify email
    await verifyEmail(token);
    const verifiedUser = await getUserByEmail('test@example.com');
    expect(verifiedUser.emailVerified).toBe(true);
  });
});
    `,
  },
];
```

## 配置示例

```yaml
# 最佳实践配置
best_practices:
  # 启用规范检查
  linting:
    enabled: true
    strict_mode: true
    fail_on_violation: true

  # 代码格式化
  formatting:
    provider: "prettier"
    config:
      print_width: 100
      tab_width: 2
      use_tabs: false
      semi: false
      single_quote: true
      trailing_comma: "all"

  # 测试配置
  testing:
    coverage_threshold: 80
    coverage_enforcement: true
    test_naming: "descriptive"
    structure: "arrange_act_assert"

  # 安全扫描
  security:
    enabled: true
    scan_on_push: true
    block_on_vulnerability: true
    min_severity: "high"

  # 代码审查
  review:
    require_approval: true
    min_reviewers: 1
    block_on_style_violation: false
    block_on_security_issue: true
```

## 规范执行

### 自动化检查

```typescript
// 规范检查器
class StandardsEnforcer {
  private linter: Linter;
  private formatter: Formatter;

  // 代码风格检查
  async checkStyle(code: string, language: string): Promise<StyleViolation[]> {
    const config = this.getStyleConfig(language);
    return this.linter.check(code, config);
  }

  // 格式化代码
  async format(code: string, language: string): Promise<string> {
    return this.formatter.format(code, this.getFormatConfig(language));
  }

  // 批量检查项目
  async checkProject(project: Project): Promise<CheckReport> {
    const violations: Violation[] = [];

    for (const file of project.sourceFiles) {
      const fileViolations = await this.checkFile(file);
      violations.push(...fileViolations);
    }

    return {
      totalFiles: project.sourceFiles.length,
      totalViolations: violations.length,
      violationsByCategory: this.groupByCategory(violations),
      violationsBySeverity: this.groupBySeverity(violations),
      pass: violations.filter(v => v.level === 'MANDATORY').length === 0,
    };
  }
}
```

---

**最后更新**: 2026-04-14
