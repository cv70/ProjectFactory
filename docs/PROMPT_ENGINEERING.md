# Prompt 工程设计文档

## 1. 设计理念

### 1.1 Prompt 工程在系统中的角色

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Prompt 工程定位                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         User Intent                                     │   │
│  │                           用户意图                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Prompt Engineering                                │   │
│  │                                                                       │   │
│  │    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │   │
│  │    │  Intent     │  │  Context    │  │  Output     │                │   │
│  │    │ 理解        │  │ 增强        │  │ 约束        │                │   │
│  │    └─────────────┘  └─────────────┘  └─────────────┘                │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         LLM Output                                     │   │
│  │                          LLM 输出                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Prompt 设计原则

| 原则 | 描述 | 示例 |
|------|------|------|
| **清晰性** | 指令明确，无歧义 | "生成一个 REST API" vs "创建一个用户管理 REST API，包含增删改查" |
| **结构性** | 输出格式可预期 | 使用 JSON Schema 约束输出 |
| **上下文丰富** | 提供足够背景信息 | 包含领域知识、约束条件、示例 |
| **角色设定** | 明确 AI 扮演角色 | "你是一个经验丰富的架构师" |
| **分步引导** | 复杂任务拆解 | 使用思维链引导 |
| **质量约束** | 明确质量标准 | "代码必须通过 ESLint 检查" |

## 2. Agent Prompt 模板

### 2.1 IdeaGeneratorAgent Prompt

```typescript
// IdeaGeneratorAgent 的 Prompt 模板

// System Prompt
const ideaGeneratorSystemPrompt = `你是 IdeaFactory 的创意生成专家。

## 你的职责
1. 生成有价值的软件项目创意
2. 分析市场需求和趋势
3. 评估创意的可行性和价值

## 约束条件
- 每个创意必须是原创的
- 创意必须具有实际应用价值
- 技术上必须是可行的
- 必须考虑目标用户的需求

## 输出格式
必须输出符合以下 JSON Schema 的结构化数据：
{
  "title": "项目标题",
  "description": "项目描述，2-3句话",
  "projectType": "web-app | cli-tool | library | api-service",
  "features": ["功能1", "功能2", ...],
  "techStack": ["技术1", "技术2", ...],
  "targetAudience": "目标用户描述",
  "complexity": "low | medium | high",
  "valueScore": 0.0-1.0,
  "noveltyScore": 0.0-1.0,
  "feasibilityScore": 0.0-1.0
}

## 质量标准
- valueScore >= 0.7 才算有价值
- noveltyScore < 0.3 会被标记为"常规创意"
- feasibilityScore < 0.5 需要特别说明`;

// User Prompt Template
const ideaGeneratorUserPrompt = `## 上下文信息
{context}

## 生成要求
{requirements}

## 约束条件
{constraints}

## 生成 {count} 个创意`;

// 使用示例
function buildIdeaPrompt(input: IdeaInput, context: IdeaContext): string {
  return `
## 上下文信息
- 最近生成的创意: ${context.recentIdeas.map(i => i.title).join(', ') || '无'}
- 当前知识库模式: ${context.knowledgePatterns.join(', ') || '基础模式'}
- 市场趋势: ${context.trends.join(', ') || '通用趋势'}

## 生成要求
- 主题: ${input.domain || '不限'}
- 类型偏好: ${input.preferredTypes?.join(', ') || '不限'}
- 复杂度: ${input.complexityPreference || 'medium'}

## 约束条件
- 每个项目代码行数预估不超过 ${input.maxLOC || 5000} 行
- 使用技术栈: ${input.allowedTechStacks?.join(', ') || 'TypeScript + Node.js'}

请生成 3 个有价值的项目创意。
`;
}
```

### 2.2 ArchitectAgent Prompt

```typescript
// ArchitectAgent 的 Prompt 模板

const architectSystemPrompt = `你是 IdeaFactory 的架构设计专家。

## 你的职责
1. 根据需求设计系统架构
2. 选择合适的技术栈
3. 定义模块边界和接口
4. 确保架构的可扩展性和可维护性

## 设计原则
- KISS (Keep It Simple, Stupid)
- DRY (Don't Repeat Yourself)
- SOLID 原则
- 领域驱动设计

## 架构模式库
你熟悉以下架构模式：
- MVC (Model-View-Controller)
- Layered Architecture
- Clean Architecture
- Hexagonal Architecture (Ports & Adapters)
- Event-Driven Architecture
- Microservices Architecture

## 输出格式
{
  "architecture": {
    "pattern": "架构模式名称",
    "layers": ["层级列表"],
    "modules": [
      {
        "name": "模块名",
        "responsibility": "模块职责",
        "dependencies": ["依赖模块"],
        "interfaces": ["接口列表"]
      }
    ],
    "techStack": {
      "frontend": ["前端技术"],
      "backend": ["后端技术"],
      "database": ["数据库"],
      "infrastructure": ["基础设施"]
    },
    "files": [
      {
        "path": "文件路径",
        "purpose": "文件用途",
        "content": "关键代码或描述"
      }
    ]
  }
}`;

const architectUserPrompt = `## 需求信息
项目名称: {projectName}
项目类型: {projectType}
项目描述: {description}

## 功能需求
{features}

## 约束条件
- 技术栈偏好: {techStackPreference}
- 部署环境: {deploymentEnvironment}
- 性能要求: {performanceRequirements}
- 安全要求: {securityRequirements}

## 质量标准
- 每个模块必须有明确的职责
- 必须定义清晰的接口
- 必须考虑错误处理
- 必须包含日志记录

请设计该系统的架构。`;
```

### 2.3 CoderAgent Prompt

```typescript
// CoderAgent 的 Prompt 模板

const coderSystemPrompt = `你是 IdeaFactory 的代码生成专家。

## 你的职责
1. 根据架构设计生成完整代码
2. 遵循最佳实践和编码规范
3. 确保代码质量和可读性
4. 生成必要的测试代码

## 编码规范
- TypeScript: 严格模式
- 变量命名: 驼峰命名法
- 文件组织: 按功能模块分组
- 错误处理: 始终处理可能的错误

## 代码模板
### React 组件
- 使用函数组件 + Hooks
- Props 使用 Interface 定义
- 使用 Tailwind CSS 进行样式化

### Node.js 服务
- 使用 Express 或 Fastify
- 路由分离
- 中间件模式
- 错误中间件

### 测试代码
- 使用 Vitest
- Arrange-Act-Assert 模式
- 覆盖率 >= 80%

## 输出格式
{
  "files": [
    {
      "path": "文件路径",
      "language": "typescript | javascript | json | ...",
      "content": "完整文件内容"
    }
  ],
  "summary": "生成的文件列表和说明"
}`;

const coderUserPrompt = `## 架构信息
{architecture}

## 文件生成任务
{taskDescription}

## 上下文
- 已生成的文件: {existingFiles}
- 相关模式: {patterns}
- 审查反馈: {reviewFeedback}

## 约束
- 单文件不超过 500 行
- 使用 TypeScript 4.x+
- 遵循项目现有的代码风格
- 所有函数必须有 JSDoc 注释

请生成以下文件:
{filesToGenerate}`;
```

### 2.4 ReviewerAgent Prompt

```typescript
// ReviewerAgent 的 Prompt 模板

const reviewerSystemPrompt = `你是 IdeaFactory 的代码审查专家。

## 你的职责
1. 审查代码质量和规范性
2. 识别潜在的 Bug 和安全问题
3. 评估代码的可维护性
4. 提出改进建议

## 审查维度
1. **正确性**: 代码逻辑是否正确
2. **安全性**: 是否有安全漏洞
3. **性能**: 是否有性能问题
4. **可读性**: 代码是否易于理解
5. **可维护性**: 是否易于修改和扩展
6. **测试覆盖**: 是否有足够的测试

## 严重程度分级
- **Critical**: 必须立即修复的安全漏洞
- **High**: 应该修复的严重问题
- **Medium**: 建议修复的问题
- **Low**: 可选优化的代码风格

## 输出格式
{
  "review": {
    "overallScore": 0-100,
    "passed": true | false,
    "dimensions": {
      "correctness": { "score": 0-100, "issues": [] },
      "security": { "score": 0-100, "issues": [] },
      "performance": { "score": 0-100, "issues": [] },
      "readability": { "score": 0-100, "issues": [] },
      "maintainability": { "score": 0-100, "issues": [] }
    },
    "summary": "总体评价",
    "suggestions": ["改进建议1", "改进建议2"]
  }
}`;

const reviewerUserPrompt = `## 代码信息
文件: {filePath}
语言: {language}

## 代码内容
\`\`\`${language}
{code}
\`\`\`

## 审查标准
- 最低质量分数: {minQualityScore}
- 必须无 Critical 问题
- 必须通过安全扫描

请审查上述代码并提供详细报告。`;
```

## 3. 思维链 (Chain of Thought) Prompt

### 3.1 复杂决策 Prompt

```typescript
// 用于复杂架构决策的思维链 Prompt

const cotArchitectPrompt = `## 任务
为以下需求选择最合适的架构模式：

需求: {requirements}

## 候选架构模式
1. Monolithic Architecture (单体架构)
2. Layered Architecture (分层架构)
3. Clean Architecture (清晰架构)
4. Microservices Architecture (微服务架构)
5. Event-Driven Architecture (事件驱动架构)

## 决策流程
请按以下步骤进行分析：

### 步骤 1: 需求分析
- 功能复杂度: {complexity}
- 团队规模: {teamSize}
- 部署环境: {deployment}

### 步骤 2: 权衡分析
对于每个候选架构，分析：
- 优点
- 缺点
- 适用场景
- 风险

### 步骤 3: 决策
基于以上分析，选择最适合的架构，并说明理由。

### 步骤 4: 风险评估
- 主要风险点
- 缓解措施

## 输出格式
{
  "analysis": {
    "step1": { "findings": [] },
    "step2": [
      { "pattern": "...", "pros": [], "cons": [], "risks": [] }
    ],
    "step3": { "selected": "...", "reasoning": "..." },
    "step4": { "risks": [], "mitigations": [] }
  },
  "recommendation": "最终推荐"
}`;
```

### 3.2 问题诊断 Prompt

```typescript
// 用于诊断问题的思维链 Prompt

const cotDiagnosisPrompt = `## 问题描述
{problemDescription}

## 错误信息
\`\`\`
{errorMessage}
\`\`\`

## 相关代码
\`\`\`typescript
{relatedCode}
\`\`\`

## 诊断流程

### 步骤 1: 理解问题
- 问题的本质是什么？
- 问题在什么情况下发生？
- 问题的影响范围？

### 步骤 2: 根因分析
- 可能的原因有哪些？
- 每个原因的证据是什么？
- 最可能的原因是什么？

### 步骤 3: 解决方案
- 如何解决这个问题？
- 解决方案的权衡？
- 最佳解决方案是什么？

### 步骤 4: 预防措施
- 如何防止问题再次发生？
- 需要什么监控？

## 输出格式
{
  "diagnosis": {
    "step1": { "nature": "...", "conditions": [], "impact": "..." },
    "step2": { "causes": [], "evidence": [], "mostLikely": "..." },
    "step3": { "solutions": [], "tradeoffs": [], "bestSolution": "..." },
    "step4": { "preventiveMeasures": [], "monitoring": "..." }
  },
  "conclusion": "诊断结论"
}`;
```

## 4. Few-Shot Prompt 示例

### 4.1 代码生成 Few-Shot

```typescript
const fewShotCodeGenPrompt = `你是一个代码生成专家。请根据描述生成 TypeScript 代码。

## 示例 1
描述: "一个简单的计算器函数"
输入:
\`\`\`typescript
function calculate(a: number, b: number, operation: 'add' | 'subtract' | 'multiply' | 'divide'): number
\`\`\`
输出:
\`\`\`typescript
function calculate(a: number, b: number, operation: 'add' | 'subtract' | 'multiply' | 'divide'): number {
  switch (operation) {
    case 'add':
      return a + b;
    case 'subtract':
      return a - b;
    case 'multiply':
      return a * b;
    case 'divide':
      if (b === 0) {
        throw new Error('Division by zero');
      }
      return a / b;
    default:
      throw new Error('Invalid operation');
  }
}
\`\`\`

## 示例 2
描述: "一个异步数据获取函数，带错误处理"
输入:
\`\`\`typescript
async function fetchUser(userId: string): Promise<User>
\`\`\`
输出:
\`\`\`typescript
interface User {
  id: string;
  name: string;
  email: string;
}

async function fetchUser(userId: string): Promise<User> {
  try {
    const response = await fetch(\`/api/users/\${userId}\`);

    if (!response.ok) {
      throw new Error(\`Failed to fetch user: \${response.statusText}\`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(\`Failed to fetch user: \${error.message}\`);
    }
    throw new Error('Failed to fetch user: Unknown error');
  }
}
\`\`\`

## 请生成以下代码
描述: "一个 React Hook，用于管理异步数据加载状态"
输入:
\`\`\`typescript
function useAsyncData<T>(fetcher: () => Promise<T>): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}
\`\`\`
输出:`;
```

## 5. Prompt 版本管理

### 5.1 Prompt 版本策略

```typescript
// Prompt 版本管理

interface PromptVersion {
  version: string;
  prompt: string;
  variables: string[];
  expectedOutput: string;
  testCases: {
    input: Record<string, any>;
    expectedOutput: any;
    minScore?: number;
  }[];
  metrics: {
    successRate: number;
    avgScore: number;
    usageCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Prompt 注册表
const promptRegistry = {
  'idea-generator:v1.0': {
    version: '1.0',
    prompt: ideaGeneratorSystemPrompt,
    variables: ['context', 'requirements', 'constraints', 'count'],
    expectedOutput: 'ProjectIdea',
    testCases: [
      {
        input: { domain: 'e-commerce', count: 3 },
        expectedOutput: { ideas: [] },
        minScore: 0.7
      }
    ],
    metrics: {
      successRate: 0.85,
      avgScore: 0.78,
      usageCount: 156
    }
  },

  'architect:v1.0': {
    version: '1.0',
    prompt: architectSystemPrompt,
    variables: ['projectName', 'projectType', 'description', 'features'],
    expectedOutput: 'Architecture',
    testCases: [],
    metrics: {
      successRate: 0.92,
      avgScore: 0.82,
      usageCount: 89
    }
  },

  'coder:v1.0': {
    version: '1.0',
    prompt: coderSystemPrompt,
    variables: ['architecture', 'taskDescription', 'existingFiles', 'patterns'],
    expectedOutput: 'Codebase',
    testCases: [],
    metrics: {
      successRate: 0.88,
      avgScore: 0.75,
      usageCount: 234
    }
  }
};

// Prompt 选择策略
function selectPrompt(
  agentType: string,
  context: {
    complexity?: 'low' | 'medium' | 'high';
    domain?: string;
    hasHistory?: boolean;
  }
): PromptVersion {
  const basePrompt = promptRegistry[`${agentType}:latest`];

  // 根据上下文调整 Prompt
  if (context.complexity === 'high') {
    return enhanceForHighComplexity(basePrompt);
  }

  if (context.hasHistory) {
    return enhanceWithHistory(basePrompt);
  }

  return basePrompt;
}
```

### 5.2 Prompt A/B 测试

```typescript
// Prompt A/B 测试框架

interface PromptExperiment {
  id: string;
  name: string;
  variants: {
    promptId: string;
    weight: number;  // 流量权重
  }[];
  metrics: {
    conversionRate: number;
    qualityScore: number;
    tokenCost: number;
  };
  status: 'running' | 'completed' | 'paused';
}

// 运行实验
async function runPromptExperiment(experiment: PromptExperiment): Promise<void> {
  const variant = selectVariant(experiment.variants);

  // 使用选中的 Prompt 变体
  const result = await executeWithPrompt(variant.promptId, context);

  // 记录结果
  await recordExperimentResult(experiment.id, variant.promptId, result);
}

// 统计分析
async function analyzeExperiment(experimentId: string): Promise<ExperimentResult> {
  const results = await getExperimentResults(experimentId);

  return {
    experimentId,
    winner: identifyWinner(results),
    confidence: calculateConfidence(results),
    recommendations: generateRecommendations(results)
  };
}
```

## 6. Prompt 优化策略

### 6.1 自动优化流程

```typescript
// Prompt 自动优化

interface PromptOptimization {
  // 1. 收集反馈
  collectFeedback(promptId: string): FeedbackData[];

  // 2. 分析问题
  analyzeIssues(feedback: FeedbackData[]): IssueReport;

  // 3. 生成改进
  generateImprovements(issues: IssueReport): PromptCandidate[];

  // 4. 测试改进
  testCandidates(candidates: PromptCandidate[]): TestResult[];

  // 5. 选择最佳
  selectBest(candidates: TestResult[]): PromptVersion;
}

class PromptOptimizer {
  async optimize(promptId: string): Promise<PromptVersion> {
    // 1. 收集反馈
    const feedback = await this.collectFeedback(promptId);

    // 2. 分析问题
    const issues = this.analyzeIssues(feedback);

    // 3. 生成改进方案
    const candidates = await this.generateImprovements(issues);

    // 4. A/B 测试
    const testResults = await this.testCandidates(candidates);

    // 5. 选择最佳
    const best = this.selectBest(testResults);

    // 发布新版本
    return this.publishNewVersion(promptId, best);
  }

  // 使用 LLM 自动改进 Prompt
  private async generateImprovements(issues: IssueReport): Promise<PromptCandidate[]> {
    const improvePrompt = `你是一个 Prompt 工程专家。

当前 Prompt 的问题:
${issues.summary}

改进要求:
1. 保持 Prompt 的核心意图
2. 解决已识别的问题
3. 不引入新的问题

请生成 3 个改进版本的 Prompt。`;

    const response = await this.llm.invoke(improvePrompt);
    return this.parseCandidates(response);
  }
}
```

### 6.2 上下文窗口优化

```typescript
// 上下文窗口管理

interface ContextWindow {
  maxTokens: number;
  currentTokens: number;
  priority: 'system' | 'knowledge' | 'history' | 'input';
}

class ContextWindowManager {
  private windows: Map<string, ContextWindow> = new Map();

  // 动态调整上下文
  adjust(context: ExecutionContext): AdjustedContext {
    const availableTokens = this.calculateAvailableTokens(context);

    return {
      systemPrompt: this.fit(context.systemPrompt, availableTokens * 0.1),
      knowledge: this.fitPriority(context.knowledge, availableTokens * 0.3, 'knowledge'),
      history: this.fitPriority(context.history, availableTokens * 0.3, 'history'),
      input: this.fit(context.input, availableTokens * 0.3)
    };
  }

  // 知识检索增强 (RAG)
  retrieveRelevantKnowledge(query: string, maxTokens: number): KnowledgeEntry[] {
    // 向量相似度搜索
    const embeddings = this.getEmbeddings(query);
    const similar = this.vectorIndex.search(embeddings, { limit: 5 });

    // 选择最相关的知识
    return this.selectMostRelevant(similar, maxTokens);
  }
}
```

---

**版本**: 1.0.0
**创建日期**: 2026-04-14
**状态**: Prompt 工程设计完成
