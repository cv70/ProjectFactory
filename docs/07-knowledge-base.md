# 知识库设计

## 1. 知识库架构

### 1.1 知识层次结构

```
┌─────────────────────────────────────────────────────────────────┐
│                        知识库系统                                  │
└─────────────────────────────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        ↓           ↓           ↓
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  代码模式    │ │  最佳实践    │ │  失败案例   │
│  (Patterns) │ │ (Practices)  │ │ (Failures)  │
└─────────────┘ └─────────────┘ └─────────────┘
        │           │           │
        └───────────┼───────────┘
                    ↓
            ┌─────────────┐
            │   SQLite    │
            │   知识存储   │
            └─────────────┘
```

### 1.2 知识类型定义

```typescript
// knowledge/types.ts

export enum KnowledgeType {
  CODE_PATTERN = 'code-pattern',       // 可复用的代码模式
  BEST_PRACTICE = 'best-practice',     // 最佳实践
  FAILURE_CASE = 'failure-case',       // 失败案例
  COMPONENT = 'component',             // 可复用组件
  ARCHITECTURE = 'architecture',       // 架构决策
  PROMPT_TEMPLATE = 'prompt-template', // Prompt模板
}

export interface KnowledgeItem {
  id: string;
  type: KnowledgeType;
  title: string;
  description: string;
  content: string;

  // 元数据
  tags: string[];
  language: string;
  framework?: string;
  category: string;

  // 统计信息
  usageCount: number;
  successRate: number;
  lastUsed?: Date;

  // 质量指标
  confidence: number;        // 知识的可信度 0-1
  relevance: number;         // 当前相关性 0-1
  verified: boolean;         // 是否人工验证

  // 时间戳
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}
```

## 2. 代码模式库

### 2.1 模式分类

```typescript
// knowledge/patterns.ts

export enum PatternCategory {
  // React模式
  COMPONENT = 'react-component',
  HOOK = 'react-hook',
  STATE_MANAGEMENT = 'react-state',
  EFFECT = 'react-effect',

  // Node.js模式
  MIDDLEWARE = 'express-middleware',
  ROUTE_HANDLER = 'express-route',
  SERVICE = 'node-service',
  ERROR_HANDLING = 'error-handling',

  // 数据库模式
  QUERY = 'database-query',
  TRANSACTION = 'database-transaction',
  MIGRATION = 'database-migration',

  // 通用模式
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  CACHING = 'caching',
  LOGGING = 'logging',
}
```

### 2.2 代码模式结构

```typescript
// knowledge/pattern-structure.ts

export interface CodePattern extends KnowledgeItem {
  type: KnowledgeType.CODE_PATTERN;

  // 模式信息
  patternName: string;
  category: PatternCategory;

  // 代码
  code: string;
  language: string;

  // 复杂度
  complexity: 'simple' | 'medium' | 'complex';

  // 上下文
  useContext: string[];      // 适用场景
  requirements: string[];   // 依赖要求

  // 示例
  examples: {
    usage: string;
    output?: string;
  }[];

  // 变体
  variations?: CodePatternVariation[];
}

export interface CodePatternVariation {
  name: string;
  description: string;
  code: string;
}
```

### 2.3 React组件模式示例

```typescript
// knowledge/examples/react-table.ts

export const reactTablePattern: CodePattern = {
  id: 'pattern-react-data-table',
  type: KnowledgeType.CODE_PATTERN,
  title: 'React数据表格组件',
  description: '一个功能完整的数据表格组件，支持排序、筛选、分页',
  patternName: 'DataTable',
  category: PatternCategory.COMPONENT,
  complexity: 'medium',
  language: 'TypeScript',
  code: `
import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableRow } from './ui/table';

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  sortable?: boolean;
  filterable?: boolean;
  pageSize?: number;
}

export function DataTable<T>({ data, columns, sortable, filterable, pageSize = 10 }: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);

  // 过滤逻辑
  const filteredData = useMemo(() => {
    if (!filterable || !filter) return data;

    return data.filter(row =>
      columns.some(col =>
        String(col.accessor(row)).toLowerCase().includes(filter.toLowerCase())
      )
    );
  }, [data, columns, filterable, filter]);

  // 排序逻辑
  const sortedData = useMemo(() => {
    if (!sortable || !sortColumn) return filteredData;

    return [...filteredData].sort((a, b) => {
      const column = columns.find(c => c.accessor === sortColumn);
      if (!column) return 0;

      const aVal = column.accessor(a);
      const bVal = column.accessor(b);

      const cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredData, columns, sortable, sortColumn, sortDirection]);

  // 分页逻辑
  const paginatedData = useMemo(() => {
    const start = page * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const totalPages = Math.ceil(sortedData.length / pageSize);

  return (
    <div className="data-table">
      {filterable && (
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter..."
          className="filter-input"
        />
      )}

      <Table>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.header}>
                {sortable && (
                  <button onClick={() => handleSort(column.accessor)}>
                    {column.header}
                    {sortColumn === column.accessor && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                )}
                {!sortable && column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {paginatedData.map((row, i) => (
            <TableRow key={i}>
              {columns.map((column) => (
                <TableCell key={column.header}>
                  {String(column.accessor(row))}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
`,
  useContext: [
    '需要展示结构化数据',
    '需要排序功能',
    '需要分页功能',
    '需要筛选功能',
  ],
  requirements: [
    'React 18+',
    'TypeScript',
    '基础UI组件（Table、TableCell等）',
  ],
  examples: [
    {
      usage: `
interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

const columns: Column<User>[] = [
  { header: 'Name', accessor: (u) => u.name },
  { header: 'Email', accessor: (u) => u.email },
  { header: 'Role', accessor: (u) => u.role },
];

function UserList() {
  const users = useUsers();

  return <DataTable data={users} columns={columns} sortable filterable />;
}
`,
    },
  ],
  tags: ['react', 'component', 'table', 'data'],
  usageCount: 0,
  successRate: 1.0,
  confidence: 0.95,
  relevance: 1.0,
  verified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

## 3. 最佳实践库

### 3.1 最佳实践分类

```typescript
// knowledge/practices.ts

export enum PracticeCategory {
  CODE_QUALITY = 'code-quality',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  TESTING = 'testing',
  DEPLOYMENT = 'deployment',
  MAINTAINABILITY = 'maintainability',
}

export interface BestPractice extends KnowledgeItem {
  type: KnowledgeType.BEST_PRACTICE;

  category: PracticeCategory;

  // 实践信息
  principle: string;        // 核心原则
  rationale: string;         // 理由说明

  // 应用
  howToApply: string;        // 如何应用
  examples: string[];       // 示例

  // 反模式
  antiPattern?: {
    description: string;
    whyAvoid: string;
  };

  // 检查清单
  checklist: string[];
}
```

### 3.2 最佳实践示例

```typescript
// knowledge/examples/error-handling.ts

export const errorHandlingPractice: BestPractice = {
  id: 'practice-error-handling',
  type: KnowledgeType.BEST_PRACTICE,
  title: '统一的错误处理模式',
  description: '在Node.js/Express应用中实现统一、可追踪的错误处理',
  category: PracticeCategory.MAINTAINABILITY,
  principle: '所有错误都应该被捕获、记录、并以一致的格式返回给客户端',
  rationale: `
统一的错误处理有助于：
1. 简化客户端代码
2. 便于调试和日志分析
3. 提供更好的用户体验
4. 确保安全性（不泄露敏感信息）
  `,
  howToApply: `
1. 定义标准错误类
2. 使用全局错误处理中间件
3. 区分已知错误和未知错误
4. 记录详细的错误日志
5. 返回用户友好的错误消息
  `,
  examples: [
    `
// 1. 定义错误类
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

// 2. 错误处理中间件
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.name,
      },
    });
  }

  // 未知错误
  logger.error('Unexpected error:', err);
  res.status(500).json({
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  });
}

// 3. 在路由中使用
router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await getUser(req.params.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});
    `,
  ],
  antiPattern: {
    description: '在每个路由中单独处理错误，返回不一致的格式',
    whyAvoid: '导致代码重复、难以维护、客户端处理复杂',
  },
  checklist: [
    '所有已知错误都继承自AppError',
    '使用全局错误处理中间件',
    '生产环境不返回堆栈跟踪',
    '所有错误都记录到日志',
    '错误码有意义且一致',
  ],
  tags: ['error-handling', 'express', 'node', 'best-practice'],
  usageCount: 0,
  successRate: 1.0,
  confidence: 0.98,
  relevance: 1.0,
  verified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

## 4. 失败案例库

### 4.1 失败分类

```typescript
// knowledge/failures.ts

export enum FailureCategory {
  REQUIREMENT = 'requirement',      // 需求错误
  ARCHITECTURE = 'architecture',    // 架构问题
  CODE = 'code',                   // 代码问题
  DEPLOYMENT = 'deployment',        // 部署问题
  PERFORMANCE = 'performance',      // 性能问题
  SECURITY = 'security',           // 安全问题
}

export interface FailureCase extends KnowledgeItem {
  type: KnowledgeType.FAILURE_CASE;

  category: FailureCategory;

  // 失败信息
  failureType: string;
  symptoms: string[];            // 症状
  rootCause: string;             // 根因

  // 分析
  whyFailed: string;             // 为什么失败
  analysis: string;             // 详细分析

  // 解决方案
  solutions: FailureSolution[];
  recommendedSolution?: number;  // 推荐方案索引

  // 预防
  prevention: string[];          // 如何预防
  warningSigns: string[];       // 警告信号
}

export interface FailureSolution {
  description: string;
  steps: string[];
  complexity: 'simple' | 'medium' | 'complex';
  estimatedEffort: string;
  effectiveness: number;         // 0-1
}
```

### 4.2 失败案例示例

```typescript
// knowledge/examples/npm-leak.ts

export const npmTokenLeakCase: FailureCase = {
  id: 'failure-npm-token-leak',
  type: KnowledgeType.FAILURE_CASE,
  title: 'NPM Token泄露到公开仓库',
  description: '生成的项目配置中包含NPM token，导致token泄露到公开仓库',
  category: FailureCategory.SECURITY,
  failureType: 'Credential Leak',
  symptoms: [
    '构建日志中显示NPM token',
    '打包文件中包含.env文件',
    '公开仓库暴露敏感信息',
  ],
  rootCause: '在Docker构建过程中复制了.env文件到镜像中',
  whyFailed: '代码生成器没有正确处理环境变量文件，将其包含在构建产物中',
  analysis: `
当Dockerfile使用COPY . .复制项目文件时，会包含.env文件。
如果.env文件包含NPM token等敏感信息，这些信息会被打包到Docker镜像中。
当镜像被推送到公共仓库或被共享时，敏感信息就会泄露。

此外，如果.npmrc文件中包含_auth token，也会导致同样的问题。
  `,
  solutions: [
    {
      description: '使用.dockerignore文件',
      steps: [
        '创建.dockerignore文件',
        '添加.env到ignore列表',
        '添加.npmrc到ignore列表（如果包含token）',
        '确保敏感文件不被复制到镜像',
      ],
      complexity: 'simple',
      estimatedEffort: '5分钟',
      effectiveness: 1.0,
    },
    {
      description: '使用构建参数传递token',
      steps: [
        '在Dockerfile中使用ARG定义构建参数',
        '使用ENV设置环境变量',
        '在构建时通过--build-arg传递token',
        '确保token不进入镜像层',
      ],
      complexity: 'medium',
      estimatedEffort: '15分钟',
      effectiveness: 0.95,
    },
  ],
  recommendedSolution: 0,
  prevention: [
    '使用.dockerignore排除敏感文件',
    '使用环境变量而不是配置文件存储敏感信息',
    '在代码生成时自动添加.dockerignore',
    '使用密钥管理服务（如AWS Secrets Manager）',
    '定期检查生成的Dockerfile和Compose文件',
  ],
  warningSigns: [
    'Dockerfile中使用COPY . .',
    '没有.dockerignore文件',
    '.env文件被包含在项目中',
  ],
  tags: ['security', 'docker', 'npm', 'credentials', 'failure'],
  usageCount: 0,
  successRate: 1.0,
  confidence: 1.0,
  relevance: 1.0,
  verified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

## 5. Prompt模板库

### 5.1 Prompt分类

```typescript
// knowledge/prompts.ts

export enum PromptCategory {
  REQUIREMENT = 'requirement',
  ARCHITECTURE = 'architecture',
  CODE_GENERATION = 'code-generation',
  REFACTORING = 'refactoring',
  DEBUGGING = 'debugging',
  REVIEW = 'code-review',
  TESTING = 'testing',
}

export interface PromptTemplate extends KnowledgeItem {
  type: KnowledgeType.PROMPT_TEMPLATE;

  category: PromptCategory;

  // 模板信息
  template: string;
  variables: PromptVariable[];

  // 使用指南
  usage: string;
  examples: PromptExample[];

  // 优化信息
  performance: {
    avgTokens: number;
    avgCost: number;
    successRate: number;
  };
}

export interface PromptVariable {
  name: string;
  description: string;
  type: 'string' | 'number' | 'array' | 'object';
  required: boolean;
  defaultValue?: unknown;
}

export interface PromptExample {
  inputs: Record<string, unknown>;
  output: string;
  quality: number;  // 输出质量评分
}
```

### 5.2 Prompt模板示例

```typescript
// knowledge/examples/code-review-prompt.ts

export const codeReviewPromptTemplate: PromptTemplate = {
  id: 'prompt-code-review',
  type: KnowledgeType.PROMPT_TEMPLATE,
  title: '代码审查Prompt模板',
  description: '用于对生成的代码进行质量审查的Prompt模板',
  category: PromptCategory.REVIEW,
  template: `你是一个资深代码审查员。请审查以下代码，提供详细的反馈。

## 代码信息
语言: {language}
文件路径: {filePath}

## 代码内容
\`\`\`
{code}
\`\`\`

## 上下文
需求: {requirements}
架构: {architecture}

## 审查维度
请从以下维度审查代码：

1. **正确性**
   - 代码是否正确实现了功能？
   - 是否有明显的逻辑错误？
   - 边界条件是否处理？

2. **可读性**
   - 命名是否清晰？
   - 代码结构是否合理？
   - 是否需要添加注释？

3. **性能**
   - 是否存在性能问题？
   - 是否有不必要的计算或内存使用？
   - 是否应该使用缓存或优化？

4. **安全性**
   - 是否存在安全漏洞？
   - 输入是否正确验证？
   - 敏感信息是否正确处理？

5. **最佳实践**
   - 是否遵循语言/框架的最佳实践？
   - 是否遵循项目约定？

## 输出格式
请以JSON格式输出：

\`\`\`json
{
  "overallScore": <0-100>,
  "summary": "<简要总结>",
  "issues": [
    {
      "severity": "critical|major|minor|info",
      "category": "correctness|readability|performance|security|best-practice",
      "message": "<问题描述>",
      "location": "<文件位置>",
      "suggestion": "<改进建议>"
    }
  ],
  "positiveNotes": ["<值得肯定的点>"]
}
\`\`\`

注意：
- 请具体指出问题位置
- 提供可执行的改进建议
- 区分必须修复和建议改进的问题
`,
  variables: [
    {
      name: 'language',
      description: '代码语言',
      type: 'string',
      required: true,
    },
    {
      name: 'filePath',
      description: '文件路径',
      type: 'string',
      required: true,
    },
    {
      name: 'code',
      description: '代码内容',
      type: 'string',
      required: true,
    },
    {
      name: 'requirements',
      description: '需求描述',
      type: 'string',
      required: false,
    },
    {
      name: 'architecture',
      description: '架构描述',
      type: 'string',
      required: false,
    },
  ],
  usage: `
使用此模板进行代码审查：

1. 准备代码信息和上下文
2. 填充模板变量
3. 发送给LLM
4. 解析JSON输出
5. 根据审查结果进行改进
  `,
  examples: [
    {
      inputs: {
        language: 'TypeScript',
        filePath: 'src/services/user.ts',
        code: `
export class UserService {
  async getUser(id: number) {
    return await db.users.find(id);
  }
}
        `,
        requirements: '用户需要能够通过ID获取用户信息',
      },
      output: JSON.stringify({
        overallScore: 75,
        summary: '代码基本正确但缺少错误处理和类型定义',
        issues: [
          {
            severity: 'major',
            category: 'correctness',
            message: '缺少错误处理',
            location: 'src/services/user.ts:3',
            suggestion: '添加try-catch并处理用户不存在的情况',
          },
          {
            severity: 'major',
            category: 'best-practice',
            message: '缺少返回类型定义',
            location: 'src/services/user.ts:2',
            suggestion: '添加: Promise<User>返回类型',
          },
        ],
        positiveNotes: [
          '代码简洁明了',
          '函数命名清晰',
        ],
      }, null, 2),
      quality: 0.9,
    },
  ],
  performance: {
    avgTokens: 500,
    avgCost: 0.001,
    successRate: 0.95,
  },
  tags: ['prompt', 'code-review', 'quality'],
  usageCount: 0,
  successRate: 1.0,
  confidence: 0.92,
  relevance: 1.0,
  verified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

## 6. 知识检索

### 6.1 检索策略

```typescript
// knowledge/retrieval.ts

export interface RetrievalOptions {
  // 向量检索
  embeddingModel: string;
  topK: number;
  scoreThreshold: number;

  // 元数据过滤
  filters?: {
    type?: KnowledgeType[];
    language?: string[];
    framework?: string[];
    category?: string[];
    tags?: string[];
    verifiedOnly?: boolean;
    minConfidence?: number;
    minSuccessRate?: number;
  };

  // 重排序
  rerank: boolean;
  rerankModel?: string;

  // 多样性
  diversity: number;  // 0-1, 越高越多样
}

export interface RetrievalResult {
  item: KnowledgeItem;
  score: number;
  relevance: number;
}
```

### 6.2 知识检索

```typescript
// knowledge/retrieval.ts

export class KnowledgeRetriever {
  constructor(
    private store: SQLite,
    private llm: LLM
  ) {}

  async retrieve(
    query: string,
    options: RetrievalOptions
  ): Promise<RetrievalResult[]> {
    // 1. 构建查询条件
    const conditions = this.buildConditions(options.filters);

    // 2. 全文检索
    const results = await this.store.search('knowledge_items', {
      query: query,
      limit: options.topK * 3,
      conditions,
    });

    // 3. 计算相关性分数
    const scoredResults = await this.scoreResults(results, query);

    // 4. 重排序
    if (options.rerank) {
      await this.rerank(query, scoredResults);
    }

    // 5. 多样性过滤
    const diversified = this.diversify(
      scoredResults,
      options.diversity
    );

    // 6. 返回Top-K
    return diversified.slice(0, options.topK);
  }

  private buildConditions(filters?: RetrievalOptions['filters']): Record<string, unknown> {
    const conditions: Record<string, unknown> = {};

    if (filters?.type) {
      conditions.type = filters.type;
    }
    if (filters?.language) {
      conditions.language = filters.language;
    }
    if (filters?.framework) {
      conditions.framework = filters.framework;
    }
    if (filters?.verifiedOnly) {
      conditions.verified = true;
    }

    return conditions;
  }

  private async scoreResults(
    results: KnowledgeItem[],
    query: string
  ): Promise<RetrievalResult[]> {
    // 计算综合相关性分数
    return results.map(item => ({
      item,
      score: this.calculateScore(item, query),
      relevance: item.relevance,
    }));
  }

  private calculateScore(item: KnowledgeItem, query: string): number {
    // 基于关键词匹配和使用统计计算分数
    const queryTerms = query.toLowerCase().split(/\s+/);
    const itemText = `${item.title} ${item.description} ${item.content}`.toLowerCase();

    let score = 0;
    for (const term of queryTerms) {
      if (itemText.includes(term)) {
        score += 0.2;
      }
    }

    // 使用率加成
    const usageBoost = Math.log1p(item.usageCount) / 20;
    score += usageBoost;

    // 成功率加成
    score += item.successRate * 0.3;

    // 可信度加成
    if (item.verified) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }

  private async rerank(
    query: string,
    results: RetrievalResult[]
  ): Promise<void> {
    // 使用LLM进行重排序
    // 或者使用专门的重排序模型
  }

  private diversify(
    results: RetrievalResult[],
    diversity: number
  ): RetrievalResult[] {
    // MMR (Maximal Marginal Relevance) 算法
    if (diversity === 0) return results;

    const selected: RetrievalResult[] = [];
    const remaining = [...results];

    while (remaining.length > 0 && selected.length < results.length) {
      if (selected.length === 0) {
        selected.push(remaining.shift()!);
        continue;
      }

      let bestIndex = 0;
      let bestScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];

        // 相关性分数
        const relevance = candidate.relevance;

        // 与已选项的相似度（取最小）
        const similarity = selected.reduce((min, s) => {
          const sim = this.computeSimilarity(candidate, s);
          return Math.min(min, sim);
        }, 1);

        // MMR分数
        const score = (1 - diversity) * relevance + diversity * (1 - similarity);

        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }

      selected.push(remaining.splice(bestIndex, 1)[0]);
    }

    return selected;
  }

  private computeSimilarity(a: RetrievalResult, b: RetrievalResult): number {
    // 计算两个知识项之间的相似度
    // 基于类型、标签、类别等
    const itemA = a.item;
    const itemB = b.item;

    let similarity = 0;

    // 类型相同
    if (itemA.type === itemB.type) similarity += 0.3;

    // 标签重叠
    const commonTags = itemA.tags.filter(t => itemB.tags.includes(t));
    similarity += commonTags.length * 0.1;

    // 类别相同
    if (itemA.category === itemB.category) similarity += 0.3;

    return Math.min(similarity, 1);
  }
}
```

---

**版本**: 0.1.0
**更新日期**: 2026-04-14
**状态**: 设计阶段
