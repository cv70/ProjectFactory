# Agent协作模式

## 1. 协作模式概述

### 1.1 协作类型

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| 串行管道 | 按顺序执行 | 标准项目生成流程 |
| 并行分支 | 同时执行独立任务 | 多种方案探索 |
| 迭代循环 | 重复执行直到满意 | 质量优化阶段 |
| 投票协商 | 多Agent投票决策 | 有争议的决策 |
| 专家咨询 | 专门Agent提供建议 | 特定领域问题 |

## 2. 串行协作模式

### 2.1 标准流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Requirement │──→│ Architecture │──→│ Development │
│   Agent     │     │   Agent     │     │   Agent     │
└─────────────┘     └─────────────┘     └─────────────┘
                                            ↓
                                    ┌─────────────┐
                                    │   Quality   │
                                    │   Agent     │
                                    └─────────────┘
```

### 2.2 数据流转

```typescript
// collaboration/serial.ts

export interface SerialCollaborationResult<T> {
  phase: string;
  result: T;
  metadata: {
    agent: string;
    duration: number;
    tokensUsed: number;
    cost: number;
  };
  nextAgent?: string;
}

export class SerialCollaborator {
  async execute(
    initialInput: ProjectInput
  ): Promise<SerialCollaborationResult<FinalOutput>> {
    const history: SerialCollaborationResult<any>[] = [];

    // 阶段1: 需求分析
    const requirementResult = await this.executePhase({
      phase: 'requirement',
      agent: 'RequirementAgent',
      input: initialInput,
    });
    history.push(requirementResult);

    // 阶段2: 架构设计
    const architectureResult = await this.executePhase({
      phase: 'architecture',
      agent: 'ArchitectureAgent',
      input: requirementResult.result,
      context: { previousPhases: ['requirement'] },
    });
    history.push(architectureResult);

    // 阶段3: 代码开发
    const developmentResult = await this.executePhase({
      phase: 'development',
      agent: 'DevelopmentAgent',
      input: architectureResult.result,
      context: { previousPhases: ['requirement', 'architecture'] },
    });
    history.push(developmentResult);

    // 阶段4: 质量检查
    const qualityResult = await this.executePhase({
      phase: 'quality',
      agent: 'QualityAgent',
      input: developmentResult.result,
      context: { previousPhases: ['requirement', 'architecture', 'development'] },
    });
    history.push(qualityResult);

    return {
      phase: 'complete',
      result: this.combineResults(history),
      metadata: this.calculateTotalMetadata(history),
    };
  }

  private async executePhase<T>(
    config: PhaseConfig
  ): Promise<SerialCollaborationResult<T>> {
    const startTime = Date.now();

    // 执行Agent
    const agent = this.getAgent(config.agent);
    const result = await agent.execute(config.input);

    const duration = Date.now() - startTime;

    return {
      phase: config.phase,
      result,
      metadata: {
        agent: config.agent,
        duration,
        tokensUsed: result.tokensUsed || 0,
        cost: this.calculateCost(result.tokensUsed || 0),
      },
    };
  }
}
```

## 3. 并行协作模式

### 3.1 方案探索

```
                    ┌─────────────┐
                    │  Meta Agent │
                    └──────┬──────┘
                           │
             ┌─────────────┼─────────────┐
             ↓             ↓             ↓
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  方案 A     │ │  方案 B     │ │  方案 C     │
    │  (现代技术) │ │  (保守技术) │ │  (混合方案) │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │                │                │
           └────────────────┼────────────────┘
                            ↓
                    ┌─────────────┐
                    │  Meta Agent │
                    │  (评估选择) │
                    └─────────────┘
```

### 3.2 并行执行器

```typescript
// collaboration/parallel.ts

export interface ParallelTask<TInput, TOutput> {
  id: string;
  agent: string;
  input: TInput;
  weight?: number;  // 用于加权评分
}

export interface ParallelResult<T> {
  taskId: string;
  result: T;
  score: number;
  metadata: AgentMetadata;
}

export class ParallelExecutor {
  async execute<TInput, TOutput>(
    tasks: ParallelTask<TInput, TOutput>[]
  ): Promise<ParallelResult<TOutput>> {
    // 并行执行所有任务
    const promises = tasks.map(task => this.executeTask(task));
    const results = await Promise.allSettled(promises);

    // 处理结果
    const successful = results.filter(r => r.status === 'fulfilled')
      .map((r, i) => ({
        taskId: tasks[i].id,
        result: (r as PromiseFulfilledResult<any>).value,
        metadata: tasks[i],
      }));

    if (successful.length === 0) {
      throw new Error('All parallel tasks failed');
    }

    // 评估和选择最佳结果
    return await this.selectBestResult(successful);
  }

  private async executeTask<T>(
    task: ParallelTask<any, T>
  ): Promise<T> {
    const agent = this.getAgent(task.agent);
    return await agent.execute(task.input);
  }

  private async selectBestResult<T>(
    results: Array<{ taskId: string; result: T; metadata: any }>
  ): Promise<ParallelResult<T>> {
    // 1. 评分
    const scored = await Promise.all(
      results.map(async r => ({
        ...r,
        score: await this.evaluateResult(r.result, r.metadata),
      }))
    );

    // 2. 加权（如果配置）
    if (scored[0].metadata.weight) {
      scored.forEach(s => {
        s.score *= s.metadata.weight;
      });
    }

    // 3. 选择最佳
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    return {
      taskId: best.taskId,
      result: best.result,
      score: best.score,
      metadata: best.metadata,
    };
  }

  private async evaluateResult(
    result: any,
    metadata: any
  ): Promise<number> {
    // 综合评分：
    // - 代码质量 (30%)
    // - 生成速度 (20%)
    // - 技术栈合适度 (20%)
    // - 成本效益 (30%)

    let score = 0;

    if (result.qualityScore) {
      score += result.qualityScore * 0.3;
    }

    if (result.generationTime) {
      const speedScore = this.normalizeSpeed(result.generationTime);
      score += speedScore * 0.2;
    }

    if (result.techStackMatch) {
      score += result.techStackMatch * 0.2;
    }

    if (result.cost) {
      const costScore = this.normalizeCost(result.cost);
      score += costScore * 0.3;
    }

    return score;
  }
}
```

## 4. 迭代协作模式

### 4.1 质量优化循环

```
         ┌─────────────┐
         │  Initial   │
         │  Code      │
         └──────┬──────┘
                │
                ↓
    ┌───────────────────────┐
    │  Quality Analysis    │
    │  (静态+动态+安全)   │
    └──────────┬──────────┘
               │
               ↓
    ┌───────────────────────┐
    │  Issues Identified?   │
    └──────┬───────────────┘
           │  Yes
           ↓
    ┌───────────────────────┐
    │  Generate Fix       │
    │  (LLM + Knowledge)   │
    └──────────┬──────────┘
               │
               ↓
    ┌───────────────────────┐
    │  Re-analyze          │
    │  (Quality Check)     │
    └──────────┬──────────┘
               │
               ↓
         [Issues Fixed?]
               │
      ┌────────┴────────┐
      ↓ Yes              No ↓
   [Complete]        [Retry] (max 3)
```

### 4.2 迭代执行器

```typescript
// collaboration/iterative.ts

export interface IterationConfig {
  agent: string;
  maxIterations: number;
  convergenceThreshold: number;
  stopCondition?: (result: any) => boolean;
}

export class IterativeCollaborator {
  async execute(
    initialInput: any,
    config: IterationConfig
  ): Promise<IterationResult> {
    let currentInput = initialInput;
    const history: IterationHistory[] = [];
    let converged = false;
    let iteration = 0;

    while (!converged && iteration < config.maxIterations) {
      iteration++;

      // 执行Agent
      const result = await this.executeIteration(
        config.agent,
        currentInput,
        iteration
      );

      history.push({
        iteration,
        input: currentInput,
        output: result,
        score: result.qualityScore || 0,
      });

      // 检查收敛
      converged = this.checkConvergence(history, config);

      // 检查停止条件
      if (config.stopCondition && config.stopCondition(result)) {
        converged = true;
      }

      // 准备下一次输入
      if (!converged) {
        currentInput = await this.prepareNextInput(currentInput, result, history);
      }
    }

    return {
      finalResult: history[history.length - 1].output,
      iterations: history.length,
      converged,
      history,
    };
  }

  private checkConvergence(
    history: IterationHistory[],
    config: IterationConfig
  ): boolean {
    if (history.length < 2) return false;

    const recent = history.slice(-3);
    const scores = recent.map(h => h.score);

    // 检查分数是否稳定
    const variance = this.calculateVariance(scores);
    if (variance < config.convergenceThreshold) {
      return true;
    }

    // 检查是否达到目标
    if (recent[recent.length - 1].score >= 90) {
      return true;
    }

    return false;
  }

  private async prepareNextInput(
    previousInput: any,
    previousOutput: any,
    history: IterationHistory[]
  ): Promise<any> {
    // 构建改进请求
    const improvements = previousOutput.issues || [];
    const successfulChanges = history.slice(-2)
      .map(h => h.output.changes || [])
      .flat();

    return {
      ...previousInput,
      feedback: {
        issues: improvements,
        successfulChanges,
        iteration: history.length,
      },
    };
  }
}
```

## 5. 投票协商模式

### 5.1 决策场景

```
              ┌─────────────┐
              │  Meta Agent │
              │  (提出议题) │
              └──────┬──────┘
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
┌───────────┐  ┌───────────┐  ┌───────────┐
│ Frontend  │  │ Backend   │  │ Database  │
│   Agent   │  │   Agent   │  │   Agent   │
│ (技术A)   │  │ (技术B)   │  │ (技术C)   │
└─────┬─────┘  └─────┬─────┘  └─────┬─────┘
      │               │               │
      └───────────────┼───────────────┘
                      ↓
              ┌─────────────┐
              │  Vote/协商   │
              └──────┬──────┘
                     │
                     ↓
              ┌─────────────┐
              │  Meta Agent │
              │  (综合决策) │
              └─────────────┘
```

### 5.2 投票机制

```typescript
// collaboration/voting.ts

export interface Proposal {
  id: string;
  topic: string;
  description: string;
  options: ProposalOption[];
  votingAgents: string[];
  requiredConsensus: 'majority' | 'unanimous' | 'weighted';
}

export interface ProposalOption {
  id: string;
  name: string;
  details: any;
  proponent: string;  // 提出者
}

export interface Vote {
  agentId: string;
  optionId: string;
  reasoning?: string;
  confidence: number;  // 0-1
}

export class VotingSystem {
  async executeProposal(proposal: Proposal): Promise<ProposalResult> {
    // 收集投票
    const votes: Vote[] = [];

    for (const agentId of proposal.votingAgents) {
      const vote = await this.getAgentVote(agentId, proposal);
      votes.push(vote);
    }

    // 统计结果
    const results = this.countVotes(votes, proposal.options);
    const decision = this.makeDecision(results, proposal);

    // 记录决策过程
    await this.recordDecision(proposal, votes, decision);

    return decision;
  }

  private async getAgentVote(
    agentId: string,
    proposal: Proposal
  ): Promise<Vote> {
    const agent = this.getAgent(agentId);

    // 构建投票提示
    const prompt = `
你被邀请对以下技术决策进行投票：

议题: ${proposal.topic}
描述: ${proposal.description}

可选方案:
${proposal.options.map((o, i) => `
${i + 1}. ${o.name}
   提出者: ${o.proponent}
   详情: ${JSON.stringify(o.details)}
`).join('\n')}

请选择一个方案，并说明理由。
输出格式:
{
  "selectedOption": "方案ID",
  "reasoning": "选择理由",
  "confidence": 0-1的数值
}
`;

    const response = await agent.complete(prompt);
    return JSON.parse(response);
  }

  private countVotes(
    votes: Vote[],
    options: ProposalOption[]
  ): Map<string, VoteCount> {
    const counts = new Map<string, VoteCount>();

    for (const option of options) {
      const optionVotes = votes.filter(v => v.optionId === option.id);

      counts.set(option.id, {
        count: optionVotes.length,
        totalConfidence: optionVotes.reduce((sum, v) => sum + v.confidence, 0),
        reasoning: optionVotes.map(v => v.reasoning),
        voters: optionVotes.map(v => v.agentId),
      });
    }

    return counts;
  }

  private makeDecision(
    results: Map<string, VoteCount>,
    proposal: Proposal
  ): ProposalResult {
    const sortedOptions = Array.from(results.entries())
      .sort(([, a], [, b]) => {
        switch (proposal.requiredConsensus) {
          case 'majority':
            return b.count - a.count;
          case 'unanimous':
            return a.count === proposal.votingAgents.length ? -1 : 1;
          case 'weighted':
            return b.totalConfidence - a.totalConfidence;
        }
      });

    const [winningOptionId, count] = sortedOptions[0];

    return {
      winningOptionId,
      winningOption: proposal.options.find(o => o.id === winningOptionId)!,
      voteCounts: results,
      isConsensus: count.count === proposal.votingAgents.length,
    };
  }
}
```

## 6. 专家咨询模式

### 6.1 专家Agent

```
            ┌─────────────┐
            │  Main Agent │
            │  (遇到问题) │
            └──────┬──────┘
                   │
        ┌──────────┼──────────┐
        ↓          ↓          ↓
┌──────────┐ ┌──────────┐ ┌──────────┐
│Security  │ │Database  │ │   UI/UX   │
│ Expert   │ │ Expert   │ │ Expert   │
└────┬─────┘ └────┬─────┘ └────┬─────┘
     │              │              │
     └──────────────┼──────────────┘
                    ↓
            ┌─────────────┐
            │  Main Agent │
            │  (整合建议) │
            └─────────────┘
```

### 6.2 专家Agent定义

```typescript
// collaboration/expert.ts

export interface ExpertAgent {
  name: string;
  expertise: string[];
  capabilities: string[];
  consult(prompt: string): Promise<ExpertAdvice>;
}

export interface ExpertAdvice {
  advice: string;
  confidence: number;
  references?: string[];
  alternativeApproaches?: string[];
}

export class SecurityExpert implements ExpertAgent {
  name = 'SecurityExpert';
  expertise = ['security', 'authentication', 'encryption', 'OWASP'];
  capabilities = ['vulnerability-scan', 'threat-modeling', 'secure-coding'];

  async consult(prompt: string): Promise<ExpertAdvice> {
    const systemPrompt = `
你是一个安全专家，专门评估代码和架构的安全性。

你的专长包括：
- OWASP Top 10漏洞识别
- SQL注入/XSS/CSRF防护
- 认证授权最佳实践
- 敏感数据处理
- 加密方案选择

请针对用户的问题提供：
1. 安全评估
2. 风险识别（如果有）
3. 改进建议
4. 最佳实践参考

输出JSON格式。
`;

    const result = await this.llm.complete(prompt, {
      system: systemPrompt,
    });

    return JSON.parse(result);
  }
}

export class DatabaseExpert implements ExpertAgent {
  name = 'DatabaseExpert';
  expertise = ['database-design', 'performance', 'normalization', 'migrations'];
  capabilities = ['schema-design', 'query-optimization', 'indexing-strategy'];

  async consult(prompt: string): Promise<ExpertAdvice> {
    const systemPrompt = `
你是一个数据库专家，专门处理数据库设计和优化问题。

你的专长包括：
- 数据库选型（SQLite/PostgreSQL/MySQL等）
- Schema设计
- 索引策略
- 查询优化
- 数据迁移
- 性能调优

请针对用户的问题提供：
1. 数据库建议
2. Schema设计（如果适用）
3. 性能考虑
4. 迁移策略
5. 替代方案

输出JSON格式。
`;

    const result = await this.llm.complete(prompt, {
      system: systemPrompt,
    });

    return JSON.parse(result);
  }
}

export class ExpertConsultant {
  private experts: Map<string, ExpertAgent> = new Map();

  constructor() {
    this.experts.set('security', new SecurityExpert());
    this.experts.set('database', new DatabaseExpert());
    this.experts.set('ui-ux', new UIUXExpert());
    this.experts.set('performance', new PerformanceExpert());
  }

  async consult(
    expertType: string,
    question: string
  ): Promise<ExpertAdvice> {
    const expert = this.experts.get(expertType);
    if (!expert) {
      throw new Error(`Expert not found: ${expertType}`);
    }

    return await expert.consult(question);
  }

  async multiConsult(
    question: string
  ): Promise<MultiConsultationResult> {
    const expertTypes = Array.from(this.experts.keys());
    const results = await Promise.all(
      expertTypes.map(type => this.consult(type, question))
    );

    // 综合建议
    const consolidated = await this.consolidateAdvices(
      expertTypes,
      results
    );

    return {
      question,
      expertAdvices: results.map((r, i) => ({
        expertType: expertTypes[i],
        advice: r,
      })),
      consolidated,
    };
  }

  private async consolidateAdvices(
    expertTypes: string[],
    advices: ExpertAdvice[]
  ): Promise<ConsolidatedAdvice> {
    const prompt = `
综合以下专家的意见，给出最终建议：

问题：${this.currentQuestion}

专家意见：
${advices.map((a, i) => `
${expertTypes[i]}专家:
${a.advice}
信心度: ${a.confidence}
`).join('\n')}

请给出：
1. 综合建议
2. 优先级排序
3. 风险评估
4. 实施步骤

输出JSON格式。
`;

    const result = await this.llm.complete(prompt);
    return JSON.parse(result);
  }
}
```

## 7. 协作协调器

### 7.1 协作编排

```typescript
// collaboration/orchestrator.ts

export class CollaborationOrchestrator {
  private metaAgent: MetaAgent;
  private parallelExecutor: ParallelExecutor;
  private iterativeCollaborator: IterativeCollaborator;
  private votingSystem: VotingSystem;
  private expertConsultant: ExpertConsultant;

  async executeComplexProject(
    requirements: ProjectRequirements
  ): Promise<ProjectResult> {
    // 1. 需求分析（基础）
    const requirementResult = await this.metaAgent.executePhase({
      phase: 'requirement',
      input: requirements,
    });

    // 2. 技术栈决策（并行探索）
    const techOptions = [
      { id: 'modern', name: 'Modern Stack', techStack: modernStack },
      { id: 'conservative', name: 'Conservative Stack', techStack: conservativeStack },
      { id: 'balanced', name: 'Balanced Stack', techStack: balancedStack },
    ];

    const techSelection = await this.parallelExecutor.execute(
      techOptions.map(option => ({
        id: option.id,
        agent: 'ArchitectureAgent',
        input: {
          requirements: requirementResult.result,
          techStack: option.techStack,
        },
        weight: this.calculateTechWeight(requirements),
      }))
    );

    // 3. 架构设计（基于选择）
    const architectureResult = await this.metaAgent.executePhase({
      phase: 'architecture',
      input: {
        requirements: requirementResult.result,
        techStack: techSelection.result.techStack,
      },
    });

    // 4. 安全审查（专家咨询）
    const securityAdvice = await this.expertConsultant.consult(
      'security',
      `审查以下架构的安全性:\n${JSON.stringify(architectureResult.result)}`
    );

    // 5. 数据库优化（专家咨询）
    const dbAdvice = await this.expertConsultant.consult(
      'database',
      `优化以下数据库设计:\n${JSON.stringify(architectureResult.result.databaseSchema)}`
    );

    // 6. 整合建议到架构
    const optimizedArchitecture = await this.integrateExpertAdvice(
      architectureResult.result,
      [securityAdvice, dbAdvice]
    );

    // 7. 代码生成（迭代优化）
    const codeResult = await this.iterativeCollaborator.execute(
      { requirements: requirementResult.result, architecture: optimizedArchitecture },
      {
        agent: 'DevelopmentAgent',
        maxIterations: 3,
        convergenceThreshold: 5,
      }
    );

    // 8. 质量验证
    const qualityResult = await this.metaAgent.executePhase({
      phase: 'quality',
      input: codeResult.finalResult,
    });

    return {
      requirements: requirementResult.result,
      techStack: techSelection.result.techStack,
      architecture: optimizedArchitecture,
      code: codeResult.finalResult,
      quality: qualityResult.result,
      expertAdvices: [securityAdvice, dbAdvice],
      metadata: {
        iterations: codeResult.iterations,
        converged: codeResult.converged,
      },
    };
  }

  private async integrateExpertAdvice(
    architecture: Architecture,
    advices: ExpertAdvice[]
  ): Promise<Architecture> {
    const prompt = `
整合专家建议到架构设计中：

原始架构：
${JSON.stringify(architecture)}

专家建议：
${advices.map((a, i) => `专家${i + 1}: ${a.advice}`).join('\n')}

请：
1. 整合所有有效建议
2. 保持架构整体一致性
3. 记录修改原因

输出JSON格式。
`;

    const result = await this.llm.complete(prompt);
    return JSON.parse(result);
  }
}
```

---

**版本**: 0.1.0
**更新日期**: 2026-04-14
**状态**: 设计阶段
