# 项目验收与质量门禁系统

## 概述

项目验收与质量门禁系统（Project Acceptance & Quality Gates System）是 ProjectFactory 系统的质量守门员，负责定义、度量和强制执行项目从生成到交付的全流程质量标准。通过多阶段的质量门禁，确保只有符合质量要求的项目才能进入下一阶段或发布，从根本上保障系统输出的可靠性。

## 核心价值

- **质量标准化**：建立统一的验收标准，消除质量不一致
- **风险前置**：在早期发现问题，降低修复成本
- **自动化决策**：减少人工评审负担，加速高质量项目的流转
- **持续反馈**：通过质量数据分析指导系统改进
- **透明可追溯**：完整的质量记录，支持审计和问责

## 质量门禁架构

### 门禁阶段定义

```typescript
// 门禁阶段
enum GateStage {
  // 需求阶段门禁
  REQUIREMENT_GATE = 'requirement_gate',

  // 架构设计门禁
  ARCHITECTURE_GATE = 'architecture_gate',

  // 代码生成门禁
  CODE_GENERATION_GATE = 'code_generation_gate',

  // 测试验证门禁
  TEST_GATE = 'test_gate',

  // 代码审查门禁
  REVIEW_GATE = 'review_gate',

  // 部署验收门禁
  DEPLOYMENT_GATE = 'deployment_gate',

  // 最终发布门禁
  RELEASE_GATE = 'release_gate',
}

// 门禁结果
enum GateResult {
  PASS = 'pass',               // 通过
  FAIL = 'fail',               // 失败
  CONDITIONAL_PASS = 'conditional_pass',  // 有条件通过
  PENDING = 'pending',        // 待审核
  SKIPPED = 'skipped',        // 跳过
}

// 质量门禁定义
interface QualityGate {
  id: string;
  name: string;
  stage: GateStage;

  // 检查项
  checks: QualityCheck[];

  // 通过条件
  passCriteria: PassCriteria;

  // 配置
  config: {
    blocking: boolean;          // 是否阻断后续流程
    autoExecute: boolean;     // 是否自动执行
    requiresHumanApproval: boolean;
    timeout?: number;          // 超时时间（毫秒）
  };
}

interface QualityCheck {
  id: string;
  name: string;
  description: string;

  // 检查类型
  type: CheckType;

  // 检查器
  checker: CheckFunction;

  // 权重（用于综合评分）
  weight: number;

  // 阈值
  thresholds: {
    warning?: number;
    error?: number;
    critical?: number;
  };

  // 分类
  category: CheckCategory;
}

type CheckType =
  | 'static_analysis'    // 静态分析
  | 'test'              // 测试
  | 'performance'       // 性能测试
  | 'security'          // 安全扫描
  | 'compliance'        // 合规检查
  | 'manual_review';    // 人工审查

type CheckCategory =
  | 'correctness'       // 正确性
  | 'security'          // 安全性
  | 'performance'       // 性能
  | 'maintainability'  // 可维护性
  | 'usability'        // 可用性
  | 'reliability';     // 可靠性
```

### 默认门禁配置

```typescript
// 需求阶段门禁
const REQUIREMENT_GATE: QualityGate = {
  id: 'gate-requirement',
  name: '需求验证门禁',
  stage: GateStage.REQUIREMENT_GATE,

  checks: [
    {
      id: 'req-completeness',
      name: '需求完整性',
      description: '验证需求是否包含所有必要的组成部分',
      type: 'static_analysis',
      checker: checkRequirementCompleteness,
      weight: 0.3,
      thresholds: { warning: 0.7, error: 0.5, critical: 0.3 },
      category: 'correctness',
    },
    {
      id: 'req-consistency',
      name: '需求一致性',
      description: '验证需求描述之间是否存在冲突',
      type: 'static_analysis',
      checker: checkRequirementConsistency,
      weight: 0.25,
      thresholds: { warning: 0.9, error: 0.7, critical: 0.5 },
      category: 'correctness',
    },
    {
      id: 'req-feasibility',
      name: '需求可行性',
      description: '评估需求在技术约束下是否可行',
      type: 'manual_review',
      checker: assessRequirementFeasibility,
      weight: 0.25,
      thresholds: { warning: 0.7, error: 0.5, critical: 0.3 },
      category: 'correctness',
    },
    {
      id: 'req-clarity',
      name: '需求清晰度',
      description: '评估需求描述的清晰程度',
      type: 'static_analysis',
      checker: assessRequirementClarity,
      weight: 0.2,
      thresholds: { warning: 0.7, error: 0.5, critical: 0.3 },
      category: 'usability',
    },
  ],

  passCriteria: {
    mode: 'weighted_average',  // weighted_average | all_or_nothing | any_pass
    threshold: 0.6,
    allowConditionalPass: true,
  },

  config: {
    blocking: true,
    autoExecute: true,
    requiresHumanApproval: true,
    timeout: 300000, // 5分钟
  },
};

// 代码生成门禁
const CODE_GENERATION_GATE: QualityGate = {
  id: 'gate-code-generation',
  name: '代码生成门禁',
  stage: GateStage.CODE_GENERATION_GATE,

  checks: [
    {
      id: 'code-compiles',
      name: '编译通过',
      description: '代码必须能够成功编译',
      type: 'static_analysis',
      checker: checkCodeCompiles,
      weight: 0.2,
      thresholds: { error: 1 }, // 必须为1（100%通过）
      category: 'correctness',
    },
    {
      id: 'code-lint',
      name: '代码规范',
      description: '代码必须符合编码规范',
      type: 'static_analysis',
      checker: checkCodeLinting,
      weight: 0.15,
      thresholds: { warning: 0.95, error: 0.85, critical: 0.7 },
      category: 'maintainability',
    },
    {
      id: 'code-coverage',
      name: '测试覆盖率',
      description: '单元测试覆盖率必须达标',
      type: 'test',
      checker: checkTestCoverage,
      weight: 0.2,
      thresholds: { warning: 0.8, error: 0.7, critical: 0.5 },
      category: 'correctness',
    },
    {
      id: 'code-security',
      name: '安全扫描',
      description: '必须通过基本的安全扫描',
      type: 'security',
      checker: checkSecurityScan,
      weight: 0.2,
      thresholds: { warning: 0.9, error: 0.8, critical: 0.7 },
      category: 'security',
    },
    {
      id: 'code-complexity',
      name: '圈复杂度',
      description: '代码复杂度必须在可接受范围内',
      type: 'static_analysis',
      checker: checkCyclomaticComplexity,
      weight: 0.1,
      thresholds: { warning: 10, error: 15, critical: 20 },
      category: 'maintainability',
    },
    {
      id: 'code-duplication',
      name: '代码重复',
      description: '代码重复率必须低于阈值',
      type: 'static_analysis',
      checker: checkCodeDuplication,
      weight: 0.15,
      thresholds: { warning: 0.05, error: 0.1, critical: 0.2 },
      category: 'maintainability',
    },
  ],

  passCriteria: {
    mode: 'weighted_average',
    threshold: 0.75,
    allowConditionalPass: false,
  },

  config: {
    blocking: true,
    autoExecute: true,
    requiresHumanApproval: true,
    timeout: 600000, // 10分钟
  },
};
```

## 门禁执行引擎

### 执行器

```typescript
// 门禁执行器
class GateExecutor {
  private checkRunners: Map<CheckType, CheckRunner>;
  private resultsStore: ResultsStore;

  // 执行单个门禁
  async executeGate(
    gate: QualityGate,
    context: ExecutionContext
  ): Promise<GateExecutionResult> {
    const startTime = Date.now();
    const results: CheckResult[] = [];

    // 1. 并行执行所有检查
    const checkPromises = gate.checks.map(check =>
      this.executeCheck(check, context)
    );

    const checkResults = await Promise.allSettled(checkPromises);

    // 2. 处理结果
    for (let i = 0; i < gate.checks.length; i++) {
      const result = checkResults[i];
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        // 检查执行失败
        results.push({
          checkId: gate.checks[i].id,
          status: 'error',
          message: result.reason.message,
          duration: 0,
        });
      }
    }

    // 3. 计算门禁结果
    const gateResult = this.calculateGateResult(gate, results);

    const execution: GateExecutionResult = {
      gateId: gate.id,
      executedAt: new Date(),
      duration: Date.now() - startTime,
      results,
      overallResult: gateResult,
    };

    // 4. 存储结果
    await this.resultsStore.save(execution);

    // 5. 发送通知
    if (gateResult === 'fail' && gate.config.blocking) {
      await this.notifyGateFailure(execution);
    }

    return execution;
  }

  // 执行单个检查
  private async executeCheck(
    check: QualityCheck,
    context: ExecutionContext
  ): Promise<CheckResult> {
    const runner = this.checkRunners.get(check.type);
    if (!runner) {
      throw new Error(\`No runner for check type: \${check.type}\`);
    }

    const startTime = Date.now();

    try {
      const result = await runner.run(check, context);

      return {
        checkId: check.id,
        status: this.mapStatus(result.passed, check.thresholds),
        score: result.score,
        message: result.message,
        details: result.details,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        checkId: check.id,
        status: 'error',
        message: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  // 计算门禁结果
  private calculateGateResult(
    gate: QualityGate,
    results: CheckResult[]
  ): GateResult {
    const { mode, threshold, allowConditionalPass } = gate.passCriteria;

    const passedResults = results.filter(r => r.status === 'pass');
    const failedResults = results.filter(r => r.status === 'fail');

    switch (mode) {
      case 'all_or_nothing':
        return failedResults.length === 0 ? 'pass' : 'fail';

      case 'weighted_average':
        const weightedScore = this.calculateWeightedScore(gate, results);
        if (weightedScore >= threshold) {
          return 'pass';
        }
        if (allowConditionalPass && weightedScore >= threshold * 0.8) {
          return 'conditional_pass';
        }
        return 'fail';

      case 'any_pass':
        return passedResults.length > 0 ? 'pass' : 'fail';

      default:
        return 'fail';
    }
  }
}

interface CheckResult {
  checkId: string;
  status: 'pass' | 'warning' | 'fail' | 'error';
  score: number;
  message: string;
  details?: Record<string, any>;
  duration: number;
}

interface GateExecutionResult {
  gateId: string;
  executedAt: Date;
  duration: number;
  results: CheckResult[];
  overallResult: GateResult;
}
```

### 检查运行器

```typescript
// 静态分析检查运行器
class StaticAnalysisRunner implements CheckRunner {
  async run(check: QualityCheck, context: ExecutionContext): Promise<CheckOutput> {
    switch (check.id) {
      case 'code-lint':
        return this.runLinting(context);

      case 'code-complexity':
        return this.runComplexityAnalysis(context);

      case 'code-duplication':
        return this.runDuplicationAnalysis(context);

      default:
        return { passed: false, score: 0, message: 'Unknown check' };
    }
  }

  private async runLinting(context: ExecutionContext): Promise<CheckOutput> {
    const result = await context.tools.runLinter({
      files: context.project.sourceFiles,
      config: context.config.linting,
    });

    const passRate = result.passedCount / result.totalCount;

    return {
      passed: passRate >= 0.85,
      score: passRate,
      message: \`\${result.passedCount}/\${result.totalCount} 检查通过\`,
      details: {
        errors: result.errors,
        warnings: result.warnings,
      },
    };
  }
}

// 测试检查运行器
class TestRunner implements CheckRunner {
  async run(check: QualityCheck, context: ExecutionContext): Promise<CheckOutput> {
    if (check.id === 'code-coverage') {
      return this.runCoverageCheck(context);
    }
    return { passed: false, score: 0, message: 'Unknown test check' };
  }

  private async runCoverageCheck(context: ExecutionContext): Promise<CheckOutput> {
    const result = await context.tools.runTests({
      project: context.project,
      coverage: true,
      coverageThreshold: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    });

    const overallCoverage = (
      result.coverage.branches +
      result.coverage.functions +
      result.coverage.lines +
      result.coverage.statements
    ) / 4;

    return {
      passed: overallCoverage >= 0.8,
      score: overallCoverage,
      message: \`覆盖率: \${(overallCoverage * 100).toFixed(1)}%\`,
      details: result.coverage,
    };
  }
}

// 安全扫描运行器
class SecurityScannerRunner implements CheckRunner {
  async run(check: QualityCheck, context: ExecutionContext): Promise<CheckOutput> {
    const result = await context.tools.runSecurityScan({
      project: context.project,
      rules: ['sql-injection', 'xss', 'csrf', 'hardcoded-secrets'],
    });

    const riskScore = 1 - (result.vulnerabilities.length / 100);

    return {
      passed: result.vulnerabilities.filter(v => v.severity === 'critical').length === 0,
      score: riskScore,
      message: \`发现 \${result.vulnerabilities.length} 个安全风险\`,
      details: result.vulnerabilities,
    };
  }
}
```

## 质量门禁界面

### 门禁仪表板

```typescript
// 门禁仪表板组件
const QualityGatesDashboard: React.FC<{
  projectId: string;
}> = ({ projectId }) => {
  const [gates, setGates] = useState<GateExecutionResult[]>([]);

  useEffect(() => {
    loadGateResults(projectId).then(setGates);
  }, [projectId]);

  return (
    <div className="quality-gates-dashboard">
      <h2>质量门禁状态</h2>

      {/* 总体状态 */}
      <OverallStatusCard gates={gates} />

      {/* 门禁阶段流程 */}
      <GatePipeline gates={gates} />

      {/* 各门禁详情 */}
      <div className="gate-details">
        {gates.map(gate => (
          <GateCard key={gate.gateId} gate={gate} />
        ))}
      </div>
    </div>
  );
};

// 门禁卡片
const GateCard: React.FC<{ gate: GateExecutionResult }> = ({ gate }) => {
  const resultColor = {
    pass: 'green',
    fail: 'red',
    conditional_pass: 'yellow',
    pending: 'gray',
  }[gate.overallResult];

  return (
    <div className={\`gate-card gate-\${resultColor}\`}>
      <div className="gate-header">
        <h3>{gate.gateId}</h3>
        <Badge color={resultColor}>{gate.overallResult}</Badge>
      </div>

      <div className="gate-duration">
        执行时间: {(gate.duration / 1000).toFixed(1)}秒
      </div>

      {/* 检查结果列表 */}
      <div className="check-results">
        {gate.results.map(result => (
          <CheckResultRow key={result.checkId} result={result} />
        ))}
      </div>
    </div>
  );
};

// 检查结果行
const CheckResultRow: React.FC<{ result: CheckResult }> = ({ result }) => {
  const statusIcon = {
    pass: '✓',
    warning: '⚠',
    fail: '✗',
    error: '!',
  }[result.status];

  return (
    <div className={\`check-result check-\${result.status}\`}>
      <span className="status-icon">{statusIcon}</span>
      <span className="check-name">{result.checkId}</span>
      <span className="check-score">{(result.score * 100).toFixed(0)}%</span>
    </div>
  );
};
```

## 门禁管理

### 门禁配置管理

```typescript
// 门禁配置管理器
class GateConfigManager {
  private configStore: ConfigStore;

  // 获取门禁配置
  async getGateConfig(stage: GateStage): Promise<QualityGate> {
    return this.configStore.get(\`gate.\${stage}\`);
  }

  // 更新门禁配置
  async updateGateConfig(
    stage: GateStage,
    updates: Partial<QualityGate>
  ): Promise<void> {
    const current = await this.getGateConfig(stage);
    const updated = { ...current, ...updates };

    await this.validateGateConfig(updated);
    await this.configStore.set(\`gate.\${stage}\`, updated);
  }

  // 添加新检查
  async addCheck(
    stage: GateStage,
    check: QualityCheck
  ): Promise<void> {
    const gate = await this.getGateConfig(stage);
    gate.checks.push(check);
    await this.validateGateConfig(gate);
    await this.configStore.set(\`gate.\${stage}\`, gate);
  }

  // 移除检查
  async removeCheck(
    stage: GateStage,
    checkId: string
  ): Promise<void> {
    const gate = await this.getGateConfig(stage);
    gate.checks = gate.checks.filter(c => c.id !== checkId);
    await this.configStore.set(\`gate.\${stage}\`, gate);
  }
}
```

## 配置示例

```yaml
# 质量门禁配置
quality_gates:
  # 全局配置
  global:
    blocking: true                    # 失败是否阻断
    auto_execute: true               # 是否自动执行
    require_human_approval: true     # 是否需要人工确认
    timeout_minutes: 10

  # 门禁定义
  gates:
    requirement:
      enabled: true
      threshold: 0.6
      blocking: true

    architecture:
      enabled: true
      threshold: 0.7
      blocking: true

    code_generation:
      enabled: true
      threshold: 0.75
      blocking: true
      require_human_approval: true

    test:
      enabled: true
      threshold: 0.8
      blocking: true

    review:
      enabled: true
      threshold: 0.7
      blocking: true

    deployment:
      enabled: true
      threshold: 0.85
      blocking: true

    release:
      enabled: true
      threshold: 0.9
      blocking: true
      require_human_approval: true

  # 通知配置
  notifications:
    on_failure:
      channels: ["slack", "email"]
      notify_roles: ["admin", "qa"]
    on_success:
      channels: []
```

---

**最后更新**: 2026-04-14
