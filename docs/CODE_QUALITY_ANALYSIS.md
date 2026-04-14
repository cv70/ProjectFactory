# 代码质量分析设计

## 1. 概述

本文档描述 ProjectFactory 系统的代码质量分析设计，确保生成的代码符合高质量标准。

### 1.1 设计目标

| 目标 | 描述 |
|------|------|
| 全面覆盖 | 多维度质量分析 |
| 自动化 | 集成到生成流程 |
| 可配置 | 灵活的质量阈值 |
| 可视化 | 质量报告展示 |

### 1.2 质量维度

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          代码质量维度                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                      │
│  │   复杂度    │  │   安全性    │  │   性能      │                      │
│  │  Complexity │  │  Security   │  │  Performance│                      │
│  └─────────────┘  └─────────────┘  └─────────────┘                      │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                      │
│  │   可读性    │  │   可维护性  │  │   测试覆盖  │                      │
│  │ Readability │  │ Maintainability│ │ Test Coverage│                      │
│  └─────────────┘  └─────────────┘  └─────────────┘                      │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                      │
│  │   风格一致  │  │   依赖健康  │  │   文档完整  │                      │
│  │  Consistency│  │ Dependencies │  │  Documentation│                      │
│  └─────────────┘  └─────────────┘  └─────────────┘                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 分析引擎

### 2.1 分析器接口

```typescript
// src/quality/analyzers/base.ts
interface AnalyzerResult {
  passed: boolean;
  score: number;         // 0-100
  metrics: QualityMetric[];
  issues: QualityIssue[];
  suggestions: QualitySuggestion[];
}

interface QualityMetric {
  name: string;
  value: number;
  threshold: number;
  unit: string;
  passed: boolean;
}

interface QualityIssue {
  severity: 'critical' | 'major' | 'minor' | 'info';
  type: string;
  message: string;
  location: {
    file: string;
    line?: number;
    column?: number;
  };
  rule?: string;
  effort?: 'small' | 'medium' | 'large';
}

interface QualitySuggestion {
  type: string;
  message: string;
  location: {
    file: string;
    line?: number;
  };
  autoFixable: boolean;
}

abstract class BaseAnalyzer {
  abstract readonly name: string;
  abstract readonly supportedLanguages: string[];

  async analyze(context: AnalysisContext): Promise<AnalyzerResult> {
    const files = await this.collectFiles(context);

    const results = await Promise.map(
      files,
      (file) => this.analyzeFile(file, context),
      { concurrency: 5 }
    );

    return this.aggregateResults(results);
  }

  protected abstract collectFiles(context: AnalysisContext): Promise<string[]>;
  protected abstract analyzeFile(file: string, context: AnalysisContext): Promise<FileAnalysisResult>;
  protected abstract aggregateResults(results: FileAnalysisResult[]): AnalyzerResult;
}

interface AnalysisContext {
  projectPath: string;
  language: string;
  config: QualityConfig;
}

interface FileAnalysisResult {
  file: string;
  metrics: QualityMetric[];
  issues: QualityIssue[];
  suggestions: QualitySuggestion[];
}
```

### 2.2 复杂度分析器

```typescript
// src/quality/analyzers/complexity.ts
class ComplexityAnalyzer extends BaseAnalyzer {
  readonly name = 'complexity';
  readonly supportedLanguages = ['typescript', 'javascript', 'python', 'java'];

  protected async collectFiles(context: AnalysisContext): Promise<string[]> {
    return glob(`${context.projectPath}/**/*.{ts,js,py,java}`, {
      ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**'],
    });
  }

  protected async analyzeFile(
    file: string,
    context: AnalysisContext
  ): Promise<FileAnalysisResult> {
    const source = await readFile(file);
    const ast = parseAST(source, context.language);
    const metrics: QualityMetric[] = [];
    const issues: QualityIssue[] = [];

    // 圈复杂度
    const cyclomatic = calculateCyclomaticComplexity(ast);
    metrics.push({
      name: 'cyclomatic_complexity',
      value: cyclomatic,
      threshold: context.config.maxComplexity,
      unit: 'complexity',
      passed: cyclomatic <= context.config.maxComplexity,
    });

    if (cyclomatic > context.config.maxComplexity) {
      issues.push({
        severity: cyclomatic > 20 ? 'critical' : 'major',
        type: 'complexity',
        message: `圈复杂度 ${cyclomatic} 超过阈值 ${context.config.maxComplexity}`,
        location: { file },
        rule: 'max-complexity',
      });
    }

    // 认知复杂度
    const cognitive = calculateCognitiveComplexity(ast);
    metrics.push({
      name: 'cognitive_complexity',
      value: cognitive,
      threshold: context.config.maxCognitiveComplexity,
      unit: 'complexity',
      passed: cognitive <= context.config.maxCognitiveComplexity,
    });

    // 嵌套深度
    const maxNesting = calculateMaxNesting(ast);
    metrics.push({
      name: 'max_nesting_depth',
      value: maxNesting,
      threshold: context.config.maxNestingDepth,
      unit: 'levels',
      passed: maxNesting <= context.config.maxNestingDepth,
    });

    if (maxNesting > context.config.maxNestingDepth) {
      issues.push({
        severity: 'minor',
        type: 'nesting',
        message: `嵌套深度 ${maxNesting} 超过阈值 ${context.config.maxNestingDepth}`,
        location: { file },
        rule: 'max-nesting',
      });
    }

    // 函数长度
    const functions = extractFunctions(ast);
    for (const fn of functions) {
      if (fn.lines > context.config.maxFunctionLines) {
        issues.push({
          severity: 'minor',
          type: 'function-length',
          message: `函数 ${fn.name} 长度 ${fn.lines} 行超过阈值 ${context.config.maxFunctionLines}`,
          location: { file, line: fn.startLine },
          rule: 'max-function-length',
        });
      }
    }

    return { file, metrics, issues, suggestions: [] };
  }
}

// 计算圈复杂度
function calculateCyclomaticComplexity(ast: AST): number {
  let complexity = 1;

  // 遍历 AST 查找分支节点
  traverse(ast, {
    IfExpression: () => complexity++,
    SwitchCase: () => complexity++,
    ForStatement: () => complexity++,
    WhileStatement: () => complexity++,
    CatchClause: () => complexity++,
    ConditionalExpression: () => complexity++,
    LogicalExpression(node) {
      if (node.operator === '&&' || node.operator === '||') {
        complexity++;
      }
    },
  });

  return complexity;
}
```

### 2.3 安全分析器

```typescript
// src/quality/analyzers/security.ts
class SecurityAnalyzer extends BaseAnalyzer {
  readonly name = 'security';
  readonly supportedLanguages = ['typescript', 'javascript'];

  private securityRules = [
    {
      id: 'no-eval',
      pattern: /\beval\s*\(/,
      severity: 'critical',
      message: '使用 eval() 可能导致代码注入攻击',
    },
    {
      id: 'no-inner-html',
      pattern: /\.innerHTML\s*=/,
      severity: 'major',
      message: '直接设置 innerHTML 可能导致 XSS 攻击',
    },
    {
      id: 'no-dangerous-globals',
      pattern: /\b(Function|setTimeout|setInterval)\s*\(\s*['"`]/,
      severity: 'major',
      message: '动态代码执行可能存在安全风险',
    },
    {
      id: 'no-sensitive-data-hardcode',
      pattern: /(password|secret|api_key|apikey|token)\s*[=:]\s*['"][^'"]+['"]/i,
      severity: 'critical',
      message: '硬编码的敏感数据',
    },
    {
      id: 'no-sql-injection',
      pattern: /\$\{?\s*(sql|query)\s*\}/i,
      severity: 'critical',
      message: '可能的 SQL 注入风险',
    },
    {
      id: 'no-crypto-md5',
      pattern: /crypto\.createHash\s*\(\s*['"]md5['"]/,
      severity: 'major',
      message: 'MD5 不适合用于安全场景',
    },
  ];

  protected async analyzeFile(
    file: string,
    context: AnalysisContext
  ): Promise<FileAnalysisResult> {
    const source = await readFile(file);
    const issues: QualityIssue[] = [];

    for (const rule of this.securityRules) {
      const matches = source.matchAll(new RegExp(rule.pattern, 'g'));

      for (const match of matches) {
        const lineNumber = source.substring(0, match.index).split('\n').length;

        issues.push({
          severity: rule.severity as any,
          type: 'security',
          message: rule.message,
          location: {
            file,
            line: lineNumber,
            column: match.index,
          },
          rule: rule.id,
          effort: 'small',
        });
      }
    }

    // 检查依赖漏洞
    const dependencyIssues = await this.checkDependencies(file, context);

    return {
      file,
      metrics: [],
      issues: [...issues, ...dependencyIssues],
      suggestions: [],
    };
  }

  private async checkDependencies(
    file: string,
    context: AnalysisContext
  ): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    const pkgLock = await readJSON(`${context.projectPath}/package-lock.json`);

    for (const [name, version] of Object.entries(pkgLock.packages || {})) {
      const vulns = await this.checkVulnerability(name, version.version);

      for (const vuln of vulns) {
        issues.push({
          severity: vuln.severity,
          type: 'vulnerability',
          message: `依赖 ${name}@${version.version} 存在漏洞: ${vuln.title}`,
          location: { file: 'package-lock.json' },
          rule: `vuln-${vuln.id}`,
          effort: 'medium',
        });
      }
    }

    return issues;
  }
}
```

### 2.4 代码风格分析器

```typescript
// src/quality/analyzers/style.ts
class StyleAnalyzer extends BaseAnalyzer {
  readonly name = 'style';
  readonly supportedLanguages = ['typescript', 'javascript'];

  private linter: ESLint;

  constructor() {
    this.linter = new ESLint({
      overrideConfig: {
        extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
        rules: {
          'max-len': ['error', { code: 120, ignoreUrls: true }],
          'no-trailing-spaces': 'error',
          'semi': ['error', 'always'],
          'quotes': ['error', 'single', { avoidEscape: true }],
          'indent': ['error', 2],
          'comma-dangle': ['error', 'always-multiline'],
          'no-unused-vars': 'warn',
          'no-console': 'warn',
        },
      },
      useEslintrc: false,
    });
  }

  protected async analyzeFile(
    file: string,
    context: AnalysisContext
  ): Promise<FileAnalysisResult> {
    const results = await this.linter.lintText(await readFile(file), {
      filePath: file,
    });

    const issues: QualityIssue[] = results[0]?.messages.map((msg) => ({
      severity: this.severityMap[msg.severity],
      type: 'lint',
      message: msg.message,
      location: {
        file,
        line: msg.line,
        column: msg.column,
      },
      rule: msg.ruleId || undefined,
    })) || [];

    return {
      file,
      metrics: [],
      issues,
      suggestions: [],
    };
  }

  private severityMap = {
    2: 'major' as const,
    1: 'minor' as const,
    0: 'info' as const,
  };
}
```

---

## 3. 质量评分

### 3.1 综合评分

```typescript
// src/quality/scorer.ts
interface QualityScore {
  overall: number;          // 0-100
  letterGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: {
    complexity: number;
    security: number;
    style: number;
    coverage: number;
    documentation: number;
  };
  breakdown: {
    passedChecks: number;
    failedChecks: number;
    warnings: number;
  };
}

class QualityScorer {
  calculateScore(results: AnalyzerResult[]): QualityScore {
    const dimensionScores: Record<string, number[]> = {
      complexity: [],
      security: [],
      style: [],
      coverage: [],
      documentation: [],
    };

    for (const result of results) {
      for (const metric of result.metrics) {
        const dimension = this.getDimension(metric.name);
        if (dimension) {
          dimensionScores[dimension].push(
            metric.passed ? 100 : 0
          );
        }
      }
    }

    const dimensions = {
      complexity: this.average(dimensionScores.complexity),
      security: this.average(dimensionScores.security),
      style: this.average(dimensionScores.style),
      coverage: this.average(dimensionScores.coverage),
      documentation: this.average(dimensionScores.documentation),
    };

    const overall = Object.values(dimensions).reduce((a, b) => a + b, 0) / 5;

    return {
      overall: Math.round(overall),
      letterGrade: this.getLetterGrade(overall),
      dimensions,
      breakdown: this.countResults(results),
    };
  }

  private getDimension(metricName: string): string | null {
    if (metricName.includes('complexity') || metricName.includes('nesting')) {
      return 'complexity';
    }
    if (metricName.includes('security') || metricName.includes('vuln')) {
      return 'security';
    }
    if (metricName.includes('lint') || metricName.includes('style')) {
      return 'style';
    }
    if (metricName.includes('coverage')) {
      return 'coverage';
    }
    if (metricName.includes('doc')) {
      return 'documentation';
    }
    return null;
  }

  private average(values: number[]): number {
    if (values.length === 0) return 100;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private getLetterGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private countResults(results: AnalyzerResult[]) {
    let passed = 0;
    let failed = 0;
    let warnings = 0;

    for (const result of results) {
      for (const metric of result.metrics) {
        if (metric.passed) passed++;
        else failed++;
      }
      warnings += result.issues.filter(i => i.severity === 'minor').length;
    }

    return { passedChecks: passed, failedChecks: failed, warnings };
  }
}

// 质量阈值配置
const QUALITY_THRESHOLDS = {
  overall: 70,           // 综合评分 >= 70
  complexity: 80,       // 复杂度 >= 80
  security: 90,         // 安全性 >= 90 (必须高)
  style: 70,             // 风格 >= 70
  coverage: 80,          // 覆盖率 >= 80
  criticalIssues: 0,     // 严重问题 = 0
  majorIssues: 5,        // 主要问题 <= 5
};

function meetsQualityGate(score: QualityScore): boolean {
  if (score.overall < QUALITY_THRESHOLDS.overall) return false;
  if (score.dimensions.security < QUALITY_THRESHOLDS.security) return false;
  if (score.breakdown.failedChecks > QUALITY_THRESHOLDS.majorIssues) return false;

  const criticalIssues = getCriticalIssueCount(score);
  if (criticalIssues > QUALITY_THRESHOLDS.criticalIssues) return false;

  return true;
}
```

---

## 4. 测试覆盖率

### 4.1 覆盖率分析

```typescript
// src/quality/coverage.ts
interface CoverageReport {
  lineCoverage: number;      // 行覆盖率
  branchCoverage: number;    // 分支覆盖率
  functionCoverage: number;  // 函数覆盖率
  statementCoverage: number; // 语句覆盖率
  uncoveredLines: number[];
  uncoveredBranches: number[];
  files: FileCoverage[];
}

interface FileCoverage {
  file: string;
  lineCoverage: number;
  branchCoverage: number;
  coveredLines: number;
  totalLines: number;
}

class CoverageAnalyzer {
  async analyze(projectPath: string): Promise<CoverageReport> {
    // 使用 Istanbul/nyc 分析覆盖率
    const coverage = await this.runCoverage(projectPath);

    return {
      lineCoverage: coverage.lines.pct,
      branchCoverage: coverage.branches.pct,
      functionCoverage: coverage.functions.pct,
      statementCoverage: coverage.statements.pct,
      uncoveredLines: coverage.uncoveredLines,
      uncoveredBranches: coverage.uncoveredBranches,
      files: this.aggregateFileCoverage(coverage),
    };
  }

  private async runCoverage(projectPath: string): Promise<IstanbulCoverage> {
    // 执行测试并收集覆盖率
    const result = await execAsync(
      `npx nyc --reporter=json mocha "**/*.test.ts"`,
      { cwd: projectPath }
    );

    return JSON.parse(result.stdout);
  }

  generateBadge(coverage: number): string {
    const color = coverage >= 80 ? 'green' : coverage >= 60 ? 'yellow' : 'red';
    return `https://img.shields.io/badge/coverage-${coverage}%25-${color}`;
  }
}
```

---

## 5. 质量报告

### 5.1 报告生成

```typescript
// src/quality/reporter.ts
interface QualityReport {
  projectId: string;
  generatedAt: number;
  duration: number;

  score: QualityScore;
  coverage?: CoverageReport;

  issuesBySeverity: Record<string, QualityIssue[]>;
  issuesByType: Record<string, QualityIssue[]>;

  topIssues: QualityIssue[];
  suggestions: QualitySuggestion[];

  comparedTo?: {
    previousScore: number;
    trend: 'improving' | 'stable' | 'declining';
  };
}

class QualityReporter {
  async generateReport(
    projectId: string,
    results: AnalyzerResult[],
    coverage?: CoverageReport,
    previousReport?: QualityReport
  ): Promise<QualityReport> {
    const scorer = new QualityScorer();
    const score = scorer.calculateScore(results);

    // 按严重性分组
    const issuesBySeverity = this.groupBySeverity(results);

    // 按类型分组
    const issuesByType = this.groupByType(results);

    // 取前 10 个最重要的问题
    const topIssues = this.getTopIssues(results, 10);

    return {
      projectId,
      generatedAt: Date.now(),
      duration: 0,
      score,
      coverage,
      issuesBySeverity,
      issuesByType,
      topIssues,
      suggestions: this.getAutoFixableSuggestions(results),
      comparedTo: previousReport ? {
        previousScore: previousReport.score.overall,
        trend: this.getTrend(score.overall, previousReport.score.overall),
      } : undefined,
    };
  }

  private groupBySeverity(results: AnalyzerResult[]): Record<string, QualityIssue[]> {
    const groups: Record<string, QualityIssue[]> = {
      critical: [],
      major: [],
      minor: [],
      info: [],
    };

    for (const result of results) {
      for (const issue of result.issues) {
        groups[issue.severity]?.push(issue);
      }
    }

    return groups;
  }

  private getTopIssues(results: AnalyzerResult[], limit: number): QualityIssue[] {
    const severityWeight = { critical: 4, major: 3, minor: 2, info: 1 };

    const allIssues = results.flatMap(r => r.issues);

    return allIssues
      .sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity])
      .slice(0, limit);
  }

  private getTrend(current: number, previous: number): 'improving' | 'stable' | 'declining' {
    const diff = current - previous;
    if (diff > 5) return 'improving';
    if (diff < -5) return 'declining';
    return 'stable';
  }

  // 生成 Markdown 报告
  toMarkdown(report: QualityReport): string {
    return `
# Quality Report

**Project:** ${report.projectId}
**Generated:** ${new Date(report.generatedAt).toISOString()}

## Overall Score: ${report.score.overall} (${report.score.letterGrade})

${this.renderScoreBadge(report.score)}

## Coverage

${report.coverage ? `
| Type | Coverage |
|------|----------|
| Lines | ${report.coverage.lineCoverage}% |
| Branches | ${report.coverage.branchCoverage}% |
| Functions | ${report.coverage.functionCoverage}% |
` : 'N/A'}

## Issues Summary

| Severity | Count |
|----------|-------|
| Critical | ${report.issuesBySeverity.critical?.length || 0} |
| Major | ${report.issuesBySeverity.major?.length || 0} |
| Minor | ${report.issuesBySeverity.minor?.length || 0} |

## Top Issues

${report.topIssues.map((issue, i) => `
${i + 1}. [${issue.severity.toUpperCase()}] ${issue.message}
   - File: \`${issue.location.file}\`${issue.location.line ? `:${issue.location.line}` : ''}
`).join('\n')}

## Suggestions

${report.suggestions.map(s => `- ${s.message}`).join('\n')}
`;
  }
}
```

---

## 6. 相关文档

- [测试策略](./TESTING_STRATEGY.md)
- [后端设计](./BACKEND_DESIGN.md)
- [质量门禁](./QUALITY_GATES.md)

---

**最后更新**: 2026-04-14
