# Agent详细设计

## 1. Agent体系架构

### 1.1 Agent层次结构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Meta Agent (元控制器)                        │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  - 工作流编排                                                 │  │
│  │  - Agent协调                                                 │  │
│  │  - 错误处理                                                   │  │
│  │  - 状态管理                                                   │  │
│  │  - 决策制定                                                   │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                    ↓ coordinates
    ┌───────────────┼───────────────┼───────────────┐
    ↓               ↓               ↓               ↓
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Requirement │ │ Architecture│ │ Development │ │  Quality    │
│   Agent     │ │   Agent     │ │   Agent     │ │   Agent     │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
    ↓               ↓               ↓               ↓
    └───────────────┴───────────────┴───────────────┘
                    ↓
            ┌─────────────┐
            │ Deployment  │
            │   Agent     │
            └─────────────┘
                    ↓
            ┌─────────────┐
            │ Evolution  │
            │   Agent     │
            └─────────────┘
```

### 1.2 Agent生命周期

```
┌─────────────┐
│  Initialize │ ← 加载配置、连接服务
└──────┬──────┘
       ↓
┌─────────────┐
│  Activate   │ ← 准备接收任务
└──────┬──────┘
       ↓
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Execute    │ ←→ │  Think      │ ←→ │  Act        │
│  (循环)     │     │  (LLM调用)  │     │  (执行动作)  │
└──────┬──────┘     └─────────────┘     └─────────────┘
       ↓
┌─────────────┐
│  Finalize   │ ← 清理资源、保存状态
└──────┬──────┘
       ↓
┌─────────────┐
│ Deactivate  │ ← 释放资源
└─────────────┘
```

## 2. Meta Agent设计

### 2.1 职责

| 职责 | 描述 |
|------|------|
| 工作流编排 | 管理项目生成的整体流程 |
| Agent协调 | 分配任务给适当的Agent |
| 状态管理 | 跟踪项目整体状态 |
| 错误处理 | 处理跨阶段错误 |
| 决策制定 | 根据质量分数决定下一步 |
| 重试管理 | 管理失败重试逻辑 |

### 2.2 工作流定义

```typescript
// agents/meta/workflow.ts
export interface WorkflowStep {
  name: string;
  agent: string;
  inputFrom?: string;  // 从哪个步骤获取输入
  validate?: (result: AgentResult) => boolean;
  onFail?: 'retry' | 'skip' | 'abort';
  maxRetries?: number;
}

export const projectGenerationWorkflow: WorkflowStep[] = [
  {
    name: 'requirement-analysis',
    agent: 'RequirementAgent',
    validate: (result) => {
      const requirements = result.data as Requirement;
      return requirements.features.length > 0 &&
             requirements.techRequirements.frontend.length > 0;
    },
    onFail: 'retry',
    maxRetries: 3,
  },
  {
    name: 'architecture-design',
    agent: 'ArchitectureAgent',
    inputFrom: 'requirement-analysis',
    validate: (result) => {
      const architecture = result.data as Architecture;
      return architecture.techStack.frontend.length > 0 &&
             architecture.apis.length > 0;
    },
    onFail: 'retry',
    maxRetries: 2,
  },
  {
    name: 'code-generation',
    agent: 'DevelopmentAgent',
    inputFrom: 'architecture-design',
    validate: (result) => {
      const codebase = result.data as Codebase;
      return codebase.frontend.files.length > 0 &&
             codebase.backend.files.length > 0;
    },
    onFail: 'retry',
    maxRetries: 3,
  },
  {
    name: 'quality-validation',
    agent: 'QualityAgent',
    inputFrom: 'code-generation',
    validate: (result) => {
      const report = result.data as QualityReport;
      return report.overallScore >= 80;
    },
    onFail: 'retry',
    maxRetries: 3,
  },
  {
    name: 'deployment',
    agent: 'DeploymentAgent',
    inputFrom: 'quality-validation',
    onFail: 'abort',
  },
];
```

### 2.3 决策树

```
Meta Agent决策流程:

项目启动
    │
    ↓
执行Requirement Agent
    │
    ├─→ 成功 ──→ 执行Architecture Agent
    │               │
    │               ├─→ 成功 ──→ 执行Development Agent
    │               │               │
    │               │               ├─→ 成功 ──→ 执行Quality Agent
    │               │               │               │
    │               │               │               ├─→ 分数≥80% ──→ 执行Deployment Agent
    │               │               │               │               │
    │               │               │               │               ├─→ 成功 ──→ [完成]
    │               │               │               │               │
    │               │               │               │               └─→ 失败 ──→ [失败]
    │               │               │               │
    │               │               │               └─→ 分数<80%
    │               │               │                       │
    │               │               │                       ├─→ 重试<3 ──→ [回到Development Agent]
    │               │               │                       │
    │               │               │                       └─→ 重试≥3 ──→ [失败]
    │               │               │
    │               │               └─→ 失败
    │               │                       │
    │               │                       ├─→ 重试<3 ──→ [重试Development Agent]
    │               │                       │
    │               │                       └─→ 重试≥3 ──→ [失败]
    │               │
    │               └─→ 失败
    │                       │
    │                       ├─→ 重试<2 ──→ [重试Architecture Agent]
    │                       │
    │                       └─→ 重试≥2 ──→ [失败]
    │
    └─→ 失败
            │
            ├─→ 重试<3 ──→ [重试Requirement Agent]
            │
            └─→ 重试≥3 ──→ [失败]
```

## 3. Requirement Agent设计

### 3.1 职责

| 职责 | 描述 |
|------|------|
| 需求分析 | 理解用户意图 |
| 需求补全 | 补充缺失的细节 |
| PRD生成 | 生成产品需求文档 |
| 风险识别 | 识别潜在风险 |
| 技术可行性 | 评估技术可行性 |

### 3.2 Prompt策略

```typescript
// agents/requirement/prompts.ts

// 系统提示词
export const SYSTEM_PROMPT = `你是一个经验丰富的产品经理和技术需求分析师。你的任务是：

1. 理解用户提供的需求描述
2. 补充缺失的需求细节
3. 生成完整的产品需求文档（PRD）
4. 识别技术风险和挑战
5. 评估技术可行性

重要原则：
- 对模糊的需求，做出合理的假设并明确说明
- 功能列表应该遵循MVP原则，先做核心功能
- 技术需求要具体，避免模糊的描述
- 风险识别要全面，考虑技术、业务、时间等方面

输出格式要求为JSON，包含以下字段：
- title: 项目标题
- description: 项目描述（1-2段）
- features: 功能列表，每个功能包含name、description、priority、acceptanceCriteria
- techRequirements: 技术需求，包含frontend、backend、database
- risks: 风险列表
- assumptions: 假设列表`;

// 需求补全提示词
export const ELABORATION_PROMPT = `基于以下需求描述，我需要你：

1. 识别哪些需求细节缺失
2. 生成需要向用户确认的问题
3. 如果可以合理推断，补充这些细节

原始需求：
{requirement}

请输出：
1. 缺失的细节列表
2. 需要确认的问题列表（如果需要）
3. 补充后的完整需求（如果可以推断）`;

// 风险识别提示词
export const RISK_ANALYSIS_PROMPT = `分析以下需求，识别潜在的技术风险：

需求：
{requirement}

请从以下维度分析：
1. 技术复杂度
2. 集成难度
3. 性能要求
4. 安全考虑
5. 可维护性

输出每个风险的：
- 严重程度（low/medium/high）
- 影响范围
- 缓解建议`;
```

### 3.3 工作流

```
┌─────────────┐
│ 接收需求    │
└──────┬──────┘
       ↓
┌─────────────┐
│ 需求分析    │ → 解析用户输入，提取关键信息
└──────┬──────┘
       ↓
┌─────────────┐
│ 查询知识库  │ → 查找类似项目
└──────┬──────┘
       ↓
┌─────────────┐
│ 需求补全    │ → 补充缺失细节
└──────┬──────┘
       ↓
    ┌─────┴─────┐
    ↓           ↓
[需要确认?]   [不需要]
    │           │
    ↓           ↓
生成问题     生成PRD
    │           │
    └─────┬─────┘
          ↓
┌─────────────┐
│ 风险分析    │
└──────┬──────┘
       ↓
┌─────────────┐
│ 可行性评估  │
└──────┬──────┘
       ↓
┌─────────────┐
│ 输出PRD     │
└─────────────┘
```

## 4. Architecture Agent设计

### 4.1 职责

| 职责 | 描述 |
|------|------|
| 技术选型 | 选择合适的技术栈 |
| 系统设计 | 设计系统架构 |
| API设计 | 设计RESTful API |
| 数据库设计 | 设计数据库Schema |
| 架构验证 | 验证架构合理性 |

### 4.2 Prompt策略

```typescript
// agents/architecture/prompts.ts

export const SYSTEM_PROMPT = `你是一个资深的系统架构师。你的任务是：

1. 基于需求文档设计系统架构
2. 选择合适的技术栈
3. 设计RESTful API
4. 设计数据库Schema
5. 规划项目目录结构

技术选择原则：
- 优先选择成熟、稳定的技术
- 考虑团队熟悉度（虽然我们是AI，但要考虑可维护性）
- 考虑社区支持和生态
- 避免过度设计

输出格式为JSON，包含：
- overview: 架构概述
- techStack: 技术栈
- apis: API列表
- databaseSchema: 数据库Schema
- directoryStructure: 目录结构`;

export const TECH_SELECTION_PROMPT = `基于以下需求，推荐技术栈：

需求：
{requirements}

约束条件：
- 前端必须使用React + TypeScript
- 后端必须使用Node.js + TypeScript
- 数据库可以使用SQLite、PostgreSQL等

请推荐：
1. 具体的技术版本
2. 推荐理由
3. 潜在风险`;

export const API_DESIGN_PROMPT = `基于以下功能需求，设计RESTful API：

功能列表：
{features}

请为每个功能设计：
1. HTTP方法（GET/POST/PUT/DELETE）
2. 端点路径
3. 请求参数
4. 响应格式

输出格式为JSON数组。`;

export const DB_DESIGN_PROMPT = `基于以下需求，设计数据库Schema：

需求：
{requirements}

API列表：
{apis}

请设计：
1. 表结构（表名、字段、类型、约束）
2. 索引策略
3. 外键关系

输出格式为JSON。`;
```

### 4.3 架构验证

```typescript
// agents/architecture/validator.ts

export interface ArchitectureValidation {
  valid: boolean;
  issues: ArchitectureIssue[];
  score: number;  // 0-100
}

export interface ArchitectureIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'tech-stack' | 'api' | 'database' | 'security';
  message: string;
  suggestion?: string;
}

export async function validateArchitecture(
  architecture: Architecture,
  requirements: Requirement
): Promise<ArchitectureValidation> {
  const issues: ArchitectureIssue[] = [];

  // 1. 技术栈验证
  issues.push(...validateTechStack(architecture.techStack));

  // 2. API验证
  issues.push(...validateAPIs(architecture.apis, requirements.features));

  // 3. 数据库验证
  issues.push(...validateDatabase(architecture.databaseSchema, requirements.features));

  // 4. 安全验证
  issues.push(...validateSecurity(architecture));

  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;

  const score = Math.max(0, 100 - (errors * 20) - (warnings * 5));

  return {
    valid: errors === 0,
    issues,
    score,
  };
}
```

## 5. Development Agent设计

### 5.1 职责

| 职责 | 描述 |
|------|------|
| 前端代码生成 | 生成React组件和页面 |
| 后端代码生成 | 生成Node.js/Express API |
| 配置文件生成 | 生成各类配置文件 |
| 代码组织 | 组织代码结构 |
| 类型定义 | 生成TypeScript类型 |

### 5.2 代码生成策略

```typescript
// agents/development/strategy.ts

export interface CodeGenerationStrategy {
  approach: 'template-based' | 'llm-based' | 'hybrid';
  useTemplates: string[];
  generateWithLLM: boolean;
  postProcess: (code: string) => string;
}

// 前端代码生成策略
export const frontendGenerationStrategy: CodeGenerationStrategy = {
  approach: 'hybrid',
  useTemplates: ['react-component', 'react-page', 'react-hook'],
  generateWithLLM: true,
  postProcess: (code) => {
    // 格式化代码
    // 添加必要的导入
    // 添加类型注释
    return code;
  },
};

// 后端代码生成策略
export const backendGenerationStrategy: CodeGenerationStrategy = {
  approach: 'hybrid',
  useTemplates: ['express-route', 'express-controller', 'service'],
  generateWithLLM: true,
  postProcess: (code) => {
    // 格式化代码
    // 添加错误处理
    // 添加日志
    return code;
  },
};
```

### 5.3 Prompt策略

```typescript
// agents/development/prompts.ts

export const COMPONENT_GENERATION_PROMPT = `基于以下需求，生成React组件：

需求：
{requirement}

架构：
{architecture}

请生成：
{targetComponent}

要求：
1. 使用TypeScript
2. 使用Tailwind CSS
3. 组件应该是函数组件
4. 使用React Hooks进行状态管理
5. 添加必要的Props类型定义
6. 添加注释说明

输出完整的代码，包括导入语句。`;

export const API_GENERATION_PROMPT = `基于以下API设计，生成Express路由代码：

API设计：
{apiDesign}

数据模型：
{dataModel}

要求：
1. 使用TypeScript
2. 使用Express Router
3. 添加适当的错误处理
4. 添加请求验证（使用zod）
5. 添加日志
6. 输出JSON响应

输出完整的代码。`;
```

## 6. Quality Agent设计

### 6.1 职责

| 职责 | 描述 |
|------|------|
| 静态代码分析 | ESLint、TypeScript检查 |
| 安全扫描 | 依赖漏洞、代码安全 |
| 测试生成 | 生成单元测试和集成测试 |
| 测试执行 | 运行测试并收集结果 |
| 质量评分 | 计算综合质量分数 |

### 6.2 静态分析

```typescript
// agents/quality/static-analysis.ts

export interface StaticAnalysisConfig {
  eslint: {
    enabled: boolean;
    rules: Record<string, 'off' | 'warn' | 'error'>;
  };
  typescript: {
    enabled: boolean;
    strictMode: boolean;
  };
  complexity: {
    enabled: boolean;
    maxComplexity: number;
  };
  duplication: {
    enabled: boolean;
    threshold: number;
  };
}

export async function runStaticAnalysis(
  codebase: Codebase,
  config: StaticAnalysisConfig
): Promise<StaticAnalysisResult> {
  const results: AnalysisIssue[] = [];

  // 1. TypeScript类型检查
  if (config.typescript.enabled) {
    const typeErrors = await runTypeScriptCheck(codebase);
    results.push(...typeErrors);
  }

  // 2. ESLint检查
  if (config.eslint.enabled) {
    const lintErrors = await runESLint(codebase, config.eslint.rules);
    results.push(...lintErrors);
  }

  // 3. 复杂度分析
  if (config.complexity.enabled) {
    const complexityIssues = await analyzeComplexity(
      codebase,
      config.complexity.maxComplexity
    );
    results.push(...complexityIssues);
  }

  // 4. 重复代码检测
  if (config.duplication.enabled) {
    const duplicationIssues = await detectDuplication(
      codebase,
      config.duplication.threshold
    );
    results.push(...duplicationIssues);
  }

  // 计算分数
  const errors = results.filter(r => r.severity === 'error').length;
  const warnings = results.filter(r => r.severity === 'warning').length;

  const score = calculateScore(errors, warnings);

  return {
    score,
    issues: results,
    fileCount: countFiles(codebase),
    lineCount: countLines(codebase),
  };
}
```

### 6.3 测试生成

```typescript
// agents/quality/test-generation.ts

export interface TestGenerationConfig {
  generateUnitTests: boolean;
  generateIntegrationTests: boolean;
  coverageTarget: number;
  testingFramework: 'jest' | 'vitest' | 'mocha';
}

export async function generateTests(
  codebase: Codebase,
  config: TestGenerationConfig
): Promise<TestGenerationResult> {
  const tests: TestFile[] = [];

  // 1. 为组件生成单元测试
  if (config.generateUnitTests) {
    for (const file of codebase.frontend.files) {
      if (file.path.endsWith('.tsx') && file.path.includes('components/')) {
        const test = await generateComponentTest(file);
        tests.push(test);
      }
    }

    for (const file of codebase.backend.files) {
      if (file.path.endsWith('.ts') && file.path.includes('services/')) {
        const test = await generateServiceTest(file);
        tests.push(test);
      }
    }
  }

  // 2. 生成集成测试
  if (config.generateIntegrationTests) {
    const apiTests = await generateAPITests(codebase.backend);
    tests.push(...apiTests);
  }

  return { tests, framework: config.testingFramework };
}

export async function generateComponentTest(
  componentFile: CodeFile
): Promise<TestFile> {
  const prompt = `
基于以下React组件，生成Jest测试代码：

组件代码：
${componentFile.content}

要求：
1. 测试组件渲染
2. 测试用户交互
3. 测试Props变化
4. 使用React Testing Library
5. 添加描述性的测试名称
`;

  const testCode = await callLLM(prompt);

  return {
    path: componentFile.path.replace('.tsx', '.test.tsx'),
    name: path.basename(componentFile.path, '.tsx'),
    content: testCode,
    assertions: countAssertions(testCode),
  };
}
```

## 7. Deployment Agent设计

### 7.1 职责

| 职责 | 描述 |
|------|------|
| 构建配置 | 生成构建脚本和配置 |
| Docker化 | 生成Dockerfile和Compose |
| 部署执行 | 执行部署流程 |
| 健康检查 | 验证部署结果 |
| 回滚处理 | 处理部署失败 |

### 7.2 部署配置

```typescript
// agents/deployment/config.ts

export interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  frontend: {
    buildCommand: string;
    outputDir: string;
    port: number;
  };
  backend: {
    buildCommand: string;
    port: number;
    nodeEnv: string;
  };
  database: {
    type: 'sqlite' | 'postgresql';
    port: number;
    persistence: boolean;
  };
  docker: {
    registry?: string;
    imagePrefix: string;
  };
  healthCheck: {
    enabled: boolean;
    interval: number;
    timeout: number;
    retries: number;
  };
}
```

### 7.3 Dockerfile生成

```typescript
// agents/deployment/docker.ts

export async function generateDockerfile(
  project: Project,
  config: DeploymentConfig
): Promise<Dockerfile> {
  const dockerfile: string[] = [];

  // 前端Dockerfile
  dockerfile.push(`# Frontend`);
  dockerfile.push(`FROM node:20-alpine AS frontend-builder`);
  dockerfile.push(`WORKDIR /app`);
  dockerfile.push(`COPY frontend/package*.json ./`);
  dockerfile.push(`RUN npm ci`);
  dockerfile.push(`COPY frontend/ ./`);
  dockerfile.push(`RUN npm run build`);
  dockerfile.push(``);
  dockerfile.push(`FROM node:20-alpine AS frontend`);
  dockerfile.push(`WORKDIR /app`);
  dockerfile.push(`COPY --from=frontend-builder /app/dist ./dist`);
  dockerfile.push(`EXPOSE ${config.frontend.port}`);
  dockerfile.push(`CMD ["npx", "serve", "-s", "dist", "-l", "${config.frontend.port}"]`);

  // 后端Dockerfile
  dockerfile.push(``);
  dockerfile.push(`# Backend`);
  dockerfile.push(`FROM node:20-alpine`);
  dockerfile.push(`WORKDIR /app`);
  dockerfile.push(`COPY backend/package*.json ./`);
  dockerfile.push(`RUN npm ci --only=production`);
  dockerfile.push(`COPY backend/dist ./dist`);
  dockerfile.push(`EXPOSE ${config.backend.port}`);
  dockerfile.push(`ENV NODE_ENV=${config.backend.nodeEnv}`);
  dockerfile.push(`CMD ["node", "dist/index.js"]`);

  return {
    frontend: dockerfile.slice(1, 11).join('\n'),
    backend: dockerfile.slice(12).join('\n'),
  };
}
```

## 8. Evolution Agent设计

### 8.1 职责

| 职责 | 描述 |
|------|------|
| 反馈收集 | 收集用户反馈和系统数据 |
| 数据分析 | 分析反馈和性能数据 |
| 知识提取 | 提取可复用的知识 |
| 知识库更新 | 更新SQLite知识库 |
| 优化建议 | 生成改进建议 |

### 8.2 反馈分析

```typescript
// agents/evolution/feedback-analyzer.ts

export interface FeedbackAnalysis {
  themes: FeedbackTheme[];
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
  };
  priorityItems: PrioritizedItem[];
}

export interface FeedbackTheme {
  name: string;
  description: string;
  feedbackCount: number;
  sentiment: number;  // -1 to 1
}

export async function analyzeFeedback(
  feedbacks: Feedback[]
): Promise<FeedbackAnalysis> {
  // 1. 主题识别
  const themes = await identifyThemes(feedbacks);

  // 2. 情感分析
  const sentiment = await analyzeSentiment(feedbacks);

  // 3. 优先级排序
  const priorityItems = await prioritizeItems(feedbacks, themes);

  return { themes, sentiment, priorityItems };
}
```

### 8.3 知识提取

```typescript
// agents/evolution/knowledge-extractor.ts

export interface ExtractedKnowledge {
  type: KnowledgeItemType;
  title: string;
  description: string;
  content: string;
  tags: string[];
  confidence: number;
}

export async function extractKnowledgeFromSuccess(
  project: Project
): Promise<ExtractedKnowledge[]> {
  const knowledge: ExtractedKnowledge[] = [];

  // 1. 提取成功的代码模式
  const codePatterns = await extractCodePatterns(project.codebase!);
  knowledge.push(...codePatterns);

  // 2. 提取最佳实践
  const bestPractices = await extractBestPractices(project);
  knowledge.push(...bestPractices);

  // 3. 提取成功的架构决策
  const architectureDecisions = await extractArchitectureDecisions(project);
  knowledge.push(...architectureDecisions);

  return knowledge;
}

export async function extractKnowledgeFromFailure(
  project: Project
): Promise<ExtractedKnowledge[]> {
  const knowledge: ExtractedKnowledge[] = [];

  // 1. 分析失败原因
  const failureAnalysis = await analyzeFailure(project);

  // 2. 生成失败案例
  const failureCase = {
    type: 'failure-case' as KnowledgeItemType,
    title: `${project.type}失败案例`,
    description: failureAnalysis.description,
    content: JSON.stringify(failureAnalysis, null, 2),
    tags: ['failure', project.type, ...failureAnalysis.causes],
    confidence: 0.9,
  };

  knowledge.push(failureCase);

  return knowledge;
}
```

---

**版本**: 0.1.0
**更新日期**: 2026-04-14
**状态**: 设计阶段
