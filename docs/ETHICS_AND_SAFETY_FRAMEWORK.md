# Ethics and Safety Framework

## 1. 概述

本文档定义 ProjectFactory 系统的伦理与安全框架（Ethics and Safety Framework），确保无限生成系统始终产出符合伦理规范、安全可靠的软件项目。

### 1.1 框架架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        伦理与安全框架                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       伦理管理层                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  伦理规则    │  │  偏见检测    │  │  价值对齐    │              │   │
│  │  │  Policy     │  │ Bias Detect │  │ Value Align │              │   │
│  │  │  Engine    │  │             │  │             │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────┼─────────────────────────────────┐   │
│  │                           安全层                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  输入验证    │  │  输出过滤    │  │  漏洞防护    │              │   │
│  │  │ Input Valid │  │Output Filter│  │ Vuln Prevent│              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  恶意代码    │  │  依赖安全    │  │  敏感信息    │              │   │
│  │  │  检测       │  │  扫描        │  │  保护        │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────┼─────────────────────────────────┐   │
│  │                          合规层                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  许可证    │  │  隐私合规    │  │  审计追踪    │              │   │
│  │  │  检查      │  │  GDPR/CCPA  │  │  Audit Trail │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 伦理规则引擎

### 2.1 伦理规则定义

```typescript
// 伦理规则类型
enum EthicalRuleType {
  PROHIBITION = 'prohibition',         // 禁止规则
  OBLIGATION = 'obligation',           // 义务规则
  PERMISSION = 'permission',           // 许可规则
  GUIDELINE = 'guideline'             // 指导规则
}

// 伦理规则
interface EthicalRule {
  id: string;
  name: string;
  type: EthicalRuleType;
  category: EthicalCategory;
  description: string;
  pattern: string | RegExp;           // 匹配模式
  severity: 'error' | 'warning' | 'info';
  action: RuleAction;
  exemptions?: string[];               // 例外情况
  metadata: {
    source: string;                   // 规则来源 (法律/道德/公司政策)
    effectiveDate: Date;
    reviewDate?: Date;
  };
}

// 伦理类别
enum EthicalCategory {
  // 内容相关
  CONTENT_SAFETY = 'content-safety',       // 内容安全
  HATE_SPEECH = 'hate-speech',            // 仇恨言论
  HARASSMENT = 'harassment',              // 骚扰
  VIOLENCE = 'violence',                  // 暴力

  // 隐私相关
  PRIVACY = 'privacy',                     // 隐私
  DATA_COLLECTION = 'data-collection',     // 数据收集
  SURVEILLANCE = 'surveillance',          // 监控

  // 安全相关
  SECURITY = 'security',                   // 安全
  VULNERABILITY = 'vulnerability',        // 漏洞
  MALWARE = 'malware',                   // 恶意软件

  // 公平相关
  FAIRNESS = 'fairness',                 // 公平
  DISCRIMINATION = 'discrimination',     // 歧视
  BIAS = 'bias',                       // 偏见

  // 知识产权
  INTELLECTUAL_PROPERTY = 'intellectual-property', // 知识产权
  PLAGIARISM = 'plagiarism',           // 抄袭
  LICENSE = 'license',                 // 许可证

  // 社会影响
  SOCIAL_IMPACT = 'social-impact',     // 社会影响
  MANIPULATION = 'manipulation',       // 操控
  ADDICTION = 'addiction'             // 成瘾性设计
}

// 规则动作
interface RuleAction {
  type: 'block' | 'warn' | 'audit' | 'require-review';
  message: string;
  remediation?: string;
}

// 预定义伦理规则
const ethicalRules: EthicalRule[] = [
  // 禁止生成恶意软件
  {
    id: 'eth-001',
    name: '禁止生成恶意软件',
    type: EthicalRuleType.PROHIBITION,
    category: EthicalCategory.MALWARE,
    description: '禁止生成任何形式的恶意软件、病毒、木马、勒索软件',
    pattern: /(?:malware|virus|trojan|ransomware|keylogger|backdoor|rootkit)/i,
    severity: 'error',
    action: {
      type: 'block',
      message: '检测到潜在的恶意软件生成请求，此操作被禁止'
    },
    metadata: {
      source: '法律-计算机犯罪法',
      effectiveDate: new Date('2024-01-01')
    }
  },

  // 禁止生成钓鱼内容
  {
    id: 'eth-002',
    name: '禁止生成钓鱼内容',
    type: EthicalRuleType.PROHIBITION,
    category: EthicalCategory.SECURITY,
    description: '禁止生成钓鱼网站、钓鱼邮件模板或钓鱼相关代码',
    pattern: /(?:phishing|credential.*harvest|fake.*login|social.*engineering)/i,
    severity: 'error',
    action: {
      type: 'block',
      message: '检测到钓鱼相关内容的生成请求'
    },
    metadata: {
      source: '法律-网络钓鱼法',
      effectiveDate: new Date('2024-01-01')
    }
  },

  // 禁止歧视性内容
  {
    id: 'eth-003',
    name: '禁止歧视性内容',
    type: EthicalRuleType.PROHIBITION,
    category: EthicalCategory.DISCRIMINATION,
    description: '禁止生成基于种族、性别、年龄、宗教、残疾、性取向等的歧视性内容',
    pattern: /(?:discriminat|racist|sexist|homophobic|ableist|prejudice)/i,
    severity: 'error',
    action: {
      type: 'block',
      message: '检测到潜在的歧视性内容'
    },
    metadata: {
      source: '道德准则',
      effectiveDate: new Date('2024-01-01')
    }
  },

  // 隐私数据处理
  {
    id: 'eth-004',
    name: '隐私数据处理规范',
    type: EthicalRuleType.OBLIGATION,
    category: EthicalCategory.PRIVACY,
    description: '生成的代码必须遵循数据隐私最佳实践，如 GDPR、CCPA',
    pattern: /(?:collect.*user.*data|track.*user|personal.*data|pii|sensitive.*data)/i,
    severity: 'warning',
    action: {
      type: 'warn',
      message: '检测到可能涉及用户数据收集的代码',
      remediation: '请确保实现适当的数据保护措施'
    },
    metadata: {
      source: '法律-GDPR/CCPA',
      effectiveDate: new Date('2024-01-01')
    }
  },

  // 开源许可证合规
  {
    id: 'eth-005',
    name: '开源许可证合规',
    type: EthicalRuleType.OBLIGATION,
    category: EthicalCategory.LICENSE,
    description: '引入第三方依赖时必须检查并遵守其许可证',
    pattern: /(?:import.*from|npm.*install|require|include)/i,
    severity: 'warning',
    action: {
      type: 'audit',
      message: '建议检查所有引入代码的许可证兼容性'
    },
    metadata: {
      source: '公司政策',
      effectiveDate: new Date('2024-01-01')
    }
  }
];
```

### 2.2 伦理检查器

```typescript
// 伦理检查器
class EthicalChecker {
  private rules: Map<string, EthicalRule>;
  private contextAnalyzer: ContextAnalyzer;

  // 检查内容
  async check(
    content: string,
    context: CheckContext
  ): Promise<EthicalCheckResult> {
    const violations: Violation[] = [];
    const warnings: Warning[] = [];
    const recommendations: Recommendation[] = [];

    // 1. 规则匹配
    const matches = await this.matchRules(content);

    for (const match of matches) {
      const rule = match.rule;

      switch (rule.severity) {
        case 'error':
          violations.push(this.createViolation(match, context));
          break;
        case 'warning':
          warnings.push(this.createWarning(match, context));
          break;
        case 'info':
          recommendations.push(this.createRecommendation(match));
          break;
      }
    }

    // 2. 上下文分析
    const contextAnalysis = await this.contextAnalyzer.analyze(content, context);

    // 3. 综合评估
    const assessment = this.assess(content, violations, warnings, contextAnalysis);

    return {
      violations,
      warnings,
      recommendations,
      contextAnalysis,
      assessment,
      passed: violations.length === 0,
      requiresReview: contextAnalysis.requiresHumanReview,
      timestamp: new Date()
    };
  }

  // 匹配规则
  private async matchRules(content: string): Promise<RuleMatch[]> {
    const matches: RuleMatch[] = [];

    for (const rule of this.rules.values()) {
      // 检查是否有例外
      if (rule.exemptions?.some(e => content.includes(e))) {
        continue;
      }

      // 匹配模式
      const regex = typeof rule.pattern === 'string'
        ? new RegExp(rule.pattern, 'gi')
        : rule.pattern;

      const ruleMatches = content.match(regex);
      if (ruleMatches) {
        matches.push({
          rule,
          matches: ruleMatches,
          positions: this.findPositions(content, regex)
        });
      }
    }

    return matches;
  }

  // 创建违规报告
  private createViolation(
    match: RuleMatch,
    context: CheckContext
  ): Violation {
    return {
      ruleId: match.rule.id,
      ruleName: match.rule.name,
      category: match.rule.category,
      severity: match.rule.severity,
      matches: match.matches,
      positions: match.positions,
      message: match.rule.action.message,
      remediation: match.rule.action.remediation,
      context: this.getContextSnippet(context, match.positions)
    };
  }
}

// 检查上下文
interface CheckContext {
  type: 'code' | 'prompt' | 'documentation' | 'config';
  projectType?: string;
  domain?: string;
  language?: string;
  framework?: string;
}

// 规则匹配
interface RuleMatch {
  rule: EthicalRule;
  matches: string[];
  positions: MatchPosition[];
}

// 匹配位置
interface MatchPosition {
  start: number;
  end: number;
  line: number;
  column: number;
}
```

---

## 3. 偏见检测与缓解

### 3.1 偏见类型定义

```typescript
// 偏见类型
enum BiasType {
  // 认知偏见
  COGNITIVE = 'cognitive',
  CONFIRMATION = 'confirmation',       // 确认偏见
  ANCHORING = 'anchoring',           // 锚定偏见
  AVAILABILITY = 'availability',      // 可得性启发

  // 数据偏见
  DATA = 'data',
  SAMPLING = 'sampling',             // 采样偏见
  REPRESENTATION = 'representation',  // 代表性偏见
  HISTORICAL = 'historical',         // 历史偏见

  // 算法偏见
  ALGORITHMIC = 'algorithmic',
  TRAINING = 'training',             // 训练偏见
  FEATURE = 'feature',               // 特征偏见
  EVALUATION = 'evaluation',         // 评估偏见

  // 内容偏见
  CONTENT = 'content',
  STEREOTYPING = 'stereotyping',    // 刻板印象
  LANGUAGE = 'language',            // 语言偏见
  REPRESENTATION_BIAS = 'representation-bias' // 表征偏见
}

// 偏见检测规则
interface BiasDetectionRule {
  id: string;
  type: BiasType;
  name: string;
  description: string;
  indicator: string | RegExp;
  threshold: number;
  mitigation: BiasMitigationStrategy;
}

// 偏见缓解策略
interface BiasMitigationStrategy {
  type: 'reweight' | 'resample' | 'regularize' | 'debias' | 'curate';
  implementation: string;
  parameters?: Record<string, unknown>;
}

// 偏见检测器
class BiasDetector {
  private rules: BiasDetectionRule[];
  private embeddingModel: EmbeddingModel;

  // 检测偏见
  async detect(content: string): Promise<BiasReport> {
    const detections: BiasDetection[] = [];

    for (const rule of this.rules) {
      const matches = await this.findMatches(content, rule);

      if (matches.length > 0) {
        detections.push({
          rule,
          count: matches.length,
          positions: matches,
          severity: this.calculateSeverity(rule, matches.length)
        });
      }
    }

    // 语义偏见检测
    const semanticBiases = await this.detectSemanticBias(content);

    return {
      detections,
      semanticBiases,
      overallScore: this.calculateOverallScore([...detections, ...semanticBiases]),
      recommendations: this.generateRecommendations(detections)
    };
  }

  // 语义偏见检测
  private async detectSemanticBias(
    content: string
  ): Promise<SemanticBiasDetection[]> {
    const detections: SemanticBiasDetection[] = [];

    // 检测刻板印象
    const stereotypes = await this.detectStereotypes(content);
    if (stereotypes.length > 0) {
      detections.push({
        type: BiasType.STEREOTYPING,
        score: this.calculateStereotypeScore(stereotypes),
        examples: stereotypes
      });
    }

    // 检测代表性偏见
    const representation = await this.detectRepresentationBias(content);
    if (representation.score > 0.3) {
      detections.push({
        type: BiasType.REPRESENTATION_BIAS,
        score: representation.score,
        examples: representation.examples
      });
    }

    return detections;
  }

  // 检测刻板印象
  private async detectStereotypes(
    content: string
  ): Promise<StereotypeExample[]> {
    const stereotypes = await this.getKnownStereotypes();
    const examples: StereotypeExample[] = [];

    for (const stereotype of stereotypes) {
      const embedding1 = await this.embeddingModel.encode(stereotype.pattern);
      const embedding2 = await this.embeddingModel.encode(content);

      const similarity = this.cosineSimilarity(embedding1, embedding2);

      if (similarity > 0.8) {
        examples.push({
          stereotype: stereotype.category,
          pattern: stereotype.pattern,
          similarity,
          suggestion: stereotype.alternative
        });
      }
    }

    return examples;
  }
}

// 偏见报告
interface BiasReport {
  detections: BiasDetection[];
  semanticBiases: SemanticBiasDetection[];
  overallScore: number;  // 0-1, 越低越好
  recommendations: string[];
}
```

### 3.2 偏见缓解

```typescript
// 偏见缓解器
class BiasMitigator {
  // 缓解内容偏见
  async mitigateContentBias(
    content: string,
    biasType: BiasType,
    strategy: BiasMitigationStrategy
  ): Promise<MitigatedContent> {
    switch (strategy.type) {
      case 'debias':
        return this.debiasContent(content, strategy.parameters);

      case 'curate':
        return this.curateContent(content, strategy.parameters);

      case 'regularize':
        return this.regularizeContent(content, strategy.parameters);

      default:
        return { content, changes: [] };
    }
  }

  // 去偏内容
  private async debiasContent(
    content: string,
    params?: Record<string, unknown>
  ): Promise<MitigatedContent> {
    const changes: ContentChange[] = [];

    // 1. 识别偏见词汇并替换
    const biasedWords = await this.identifyBiasedWords(content);

    for (const word of biasedWords) {
      const neutral = await this.findNeutralAlternative(word);
      if (neutral) {
        content = content.replace(new RegExp(word, 'gi'), neutral);
        changes.push({
          type: 'replacement',
          original: word,
          replacement: neutral,
          reason: 'biased-term'
        });
      }
    }

    // 2. 增加多样性表达
    content = await this.enhanceDiverseRepresentation(content);

    return { content, changes };
  }

  // 增强多样性表达
  private async enhanceDiverseRepresentation(content: string): Promise<string> {
    // 添加包容性语言建议
    const inclusiveAdditions: Record<string, string> = {
      'he/she': 'they',
      'his/her': 'their',
      'mankind': 'humankind',
      'manhours': 'person-hours',
      'manmade': 'artificial',
      'executive': 'leader',
      'fireman': 'firefighter',
      'policeman': 'police officer',
      'stewardess': 'flight attendant',
      'waiter/waitress': 'server'
    };

    for (const [biased, inclusive] of Object.entries(inclusiveAdditions)) {
      content = content.replace(new RegExp(biased, 'gi'), inclusive);
    }

    return content;
  }

  // 查找中性替代词
  private async findNeutralAlternative(word: string): Promise<string | null> {
    const alternatives = await this.getAlternatives(word);
    if (alternatives.length === 0) return null;

    // 选择最中性的替代词
    return alternatives.sort((a, b) => b.neutralityScore - a.neutralityScore)[0]?.term;
  }
}
```

---

## 4. 安全扫描系统

### 4.1 安全检查类型

```typescript
// 安全检查类型
enum SecurityCheckType {
  // 代码安全
  CODE = 'code',
  SQL_INJECTION = 'sql-injection',
  XSS = 'xss',
  CSRF = 'csrf',
  COMMAND_INJECTION = 'command-injection',
  PATH_TRAVERSAL = 'path-traversal',
  DESERIALIZATION = 'deserialization',

  // 依赖安全
  DEPENDENCY = 'dependency',
  KNOWN_VULNERABILITY = 'known-vulnerability',
  MALICIOUS_PACKAGE = 'malicious-package',
  OUTDATED_DEPENDENCY = 'outdated-dependency',

  // 配置安全
  CONFIG = 'config',
  HARD_CREDENTIALS = 'hard-credentials',
  INSECURE_PROTOCOL = 'insecure-protocol',
  WEAK_CRYPTO = 'weak-crypto',

  // 隐私安全
  PRIVACY = 'privacy',
  DATA_EXPOSURE = 'data-exposure',
  TRACKING = 'tracking',
  CONSENT = 'consent'
}

// 安全检查规则
interface SecurityCheckRule {
  id: string;
  type: SecurityCheckType;
  name: string;
  pattern: string | RegExp;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cwe?: string;                    // CWE ID
  cve?: string;                    // CVE ID
  remediation: string;
  example?: {
    vulnerable: string;
    fixed: string;
  };
}

// 预定义安全规则
const securityRules: SecurityCheckRule[] = [
  // SQL 注入
  {
    id: 'sec-001',
    type: SecurityCheckType.SQL_INJECTION,
    name: 'SQL 注入漏洞',
    pattern: /(?:query|select|insert|update|delete|drop).*[\+\`\"]/gi,
    severity: 'critical',
    cwe: 'CWE-89',
    remediation: '使用参数化查询或 ORM',
    example: {
      vulnerable: 'db.query("SELECT * FROM users WHERE id = " + userId)',
      fixed: 'db.query("SELECT * FROM users WHERE id = ?", [userId])'
    }
  },

  // XSS
  {
    id: 'sec-002',
    type: SecurityCheckType.XSS,
    name: '跨站脚本攻击',
    pattern: /(?:innerHTML|outerHTML|document\.write|\.html\()/gi,
    severity: 'high',
    cwe: 'CWE-79',
    remediation: '使用 textContent 或进行输入转义',
    example: {
      vulnerable: 'element.innerHTML = userInput',
      fixed: 'element.textContent = userInput'
    }
  },

  // 硬编码凭证
  {
    id: 'sec-003',
    type: SecurityCheckType.HARD_CREDENTIALS,
    name: '硬编码凭证',
    pattern: /(?:password|api[_-]?key|secret|token|auth).*=[\s]*["\'](?![${<])[a-zA-Z0-9]{8,}/gi,
    severity: 'critical',
    cwe: 'CWE-798',
    remediation: '使用环境变量或密钥管理服务'
  },

  // 命令注入
  {
    id: 'sec-004',
    type: SecurityCheckType.COMMAND_INJECTION,
    name: '命令注入漏洞',
    pattern: /(?:exec|spawn|execSync|system|popen|eval)\s*\([^)]*(?:\+|concat|template).*\)/gi,
    severity: 'critical',
    cwe: 'CWE-78',
    remediation: '避免使用 shell 命令，或使用严格的输入验证'
  },

  // 路径遍历
  {
    id: 'sec-005',
    type: SecurityCheckType.PATH_TRAVERSAL,
    name: '路径遍历漏洞',
    pattern: /(?:readFile|readFileSync|createReadStream|open|include|require).*[\+\`].*(?:path|filename|file)/gi,
    severity: 'high',
    cwe: 'CWE-22',
    remediation: '使用 path.resolve 和输入验证'
  },

  // 已知漏洞检测 (模式)
  {
    id: 'sec-006',
    type: SecurityCheckType.KNOWN_VULNERABILITY,
    name: '已知漏洞依赖',
    pattern: /(?:lodash|axios|minimist|js-yaml|xmlhttprequest)@[<=]/gi,
    severity: 'high',
    remediation: '更新到最新安全版本'
  }
];
```

### 4.2 安全扫描器

```typescript
// 安全扫描器
class SecurityScanner {
  private rules: Map<SecurityCheckType, SecurityCheckRule[]>;
  private dependencyScanner: DependencyScanner;

  // 扫描代码
  async scanCode(
    code: string,
    language: string
  ): Promise<SecurityScanResult> {
    const findings: SecurityFinding[] = [];

    // 1. 静态模式扫描
    for (const [type, rules] of this.rules) {
      for (const rule of rules) {
        const matches = await this.findMatches(code, rule.pattern);
        if (matches.length > 0) {
          findings.push({
            type,
            rule,
            matches: matches.map(m => ({
              line: m.line,
              column: m.column,
              code: m.snippet
            })),
            severity: rule.severity
          });
        }
      }
    }

    // 2. 语义分析
    const semanticFindings = await this.semanticAnalysis(code, language);
    findings.push(...semanticFindings);

    // 3. 计算安全分数
    const score = this.calculateSecurityScore(findings);

    return {
      findings,
      score,
      riskLevel: this.assessRiskLevel(score, findings),
      recommendations: this.generateRecommendations(findings),
      scannedAt: new Date()
    };
  }

  // 扫描依赖
  async scanDependencies(
    packageLock: PackageLockContent
  ): Promise<DependencyScanResult> {
    const vulnerabilities: Vulnerability[] = [];

    for (const [name, version] of Object.entries(packageLock.dependencies)) {
      // 查询已知漏洞
      const vuln = await this.checkKnownVulnerabilities(name, version.version);

      if (vuln) {
        vulnerabilities.push(vuln);
      }
    }

    return {
      totalDependencies: Object.keys(packageLock.dependencies).length,
      vulnerabilities,
      criticalCount: vulnerabilities.filter(v => v.severity === 'critical').length,
      highCount: vulnerabilities.filter(v => v.severity === 'high').length,
      mediumCount: vulnerabilities.filter(v => v.severity === 'medium').length,
      lowCount: vulnerabilities.filter(v => v.severity === 'low').length,
      licenseIssues: await this.checkLicenses(packageLock)
    };
  }

  // 检查恶意包
  async checkMaliciousPackages(
    packages: string[]
  ): Promise<MaliciousPackageReport> {
    const suspicious: SuspiciousPackage[] = [];

    for (const pkg of packages) {
      // 检查包名相似度 (typosquatting)
      const similarMalicious = await this.checkTyposquatting(pkg);
      if (similarMalicious) {
        suspicious.push({
          package: pkg,
          risk: 'typosquatting',
          similarTo: similarMalicious,
          recommendation: 'Verify package name spelling'
        });
      }

      // 检查包权限
      const permissions = await this.checkPackagePermissions(pkg);
      if (this.hasExcessivePermissions(permissions)) {
        suspicious.push({
          package: pkg,
          risk: 'excessive-permissions',
          permissions,
          recommendation: 'Review package permissions'
        });
      }
    }

    return {
      checked: packages.length,
      suspicious: suspicious.length,
      packages: suspicious
    };
  }

  // 计算安全分数
  private calculateSecurityScore(findings: SecurityFinding[]): number {
    if (findings.length === 0) return 100;

    const weights = {
      critical: 40,
      high: 20,
      medium: 10,
      low: 5
    };

    const totalDeduction = findings.reduce(
      (sum, f) => sum + weights[f.severity],
      0
    );

    return Math.max(0, 100 - totalDeduction);
  }
}

// 安全发现
interface SecurityFinding {
  type: SecurityCheckType;
  rule: SecurityCheckRule;
  matches: {
    line: number;
    column: number;
    snippet: string;
  }[];
  severity: 'critical' | 'high' | 'medium' | 'low';
}
```

---

## 5. 输入验证与过滤

### 5.1 输入验证规则

```typescript
// 输入验证器
class InputValidator {
  private validators: Map<string, Validator>;

  // 验证输入
  validate(
    input: unknown,
    rules: ValidationRule[]
  ): ValidationResult {
    const errors: ValidationError[] = [];

    for (const rule of rules) {
      const error = this.validateRule(input, rule);
      if (error) {
        errors.push(error);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: this.sanitize(input, rules)
    };
  }

  // 验证单条规则
  private validateRule(input: unknown, rule: ValidationRule): ValidationError | null {
    switch (rule.type) {
      case 'required':
        if (input === null || input === undefined || input === '') {
          return { rule: rule.name, message: rule.message };
        }
        break;

      case 'type':
        if (typeof input !== rule.value) {
          return { rule: rule.name, message: `${rule.name} must be of type ${rule.value}` };
        }
        break;

      case 'minLength':
        if (typeof input === 'string' && input.length < (rule.value as number)) {
          return { rule: rule.name, message: rule.message };
        }
        break;

      case 'maxLength':
        if (typeof input === 'string' && input.length > (rule.value as number)) {
          return { rule: rule.name, message: rule.message };
        }
        break;

      case 'pattern':
        if (typeof input === 'string' && !new RegExp(rule.value as string).test(input)) {
          return { rule: rule.name, message: rule.message };
        }
        break;

      case 'allowList':
        if (!rule.value.includes(input)) {
          return { rule: rule.name, message: `${rule.name} is not allowed` };
        }
        break;

      case 'denyList':
        if (rule.value.includes(input)) {
          return { rule: rule.name, message: `${rule.name} is not permitted` };
        }
        break;

      case 'custom':
        if (rule.validator && !rule.validator(input)) {
          return { rule: rule.name, message: rule.message };
        }
        break;
    }

    return null;
  }

  // 清理输入
  private sanitize(input: unknown, rules: ValidationRule[]): unknown {
    if (typeof input !== 'string') return input;

    let sanitized = input;

    // 应用清理规则
    for (const rule of rules) {
      if (rule.type === 'pattern' && rule.sanitize) {
        sanitized = sanitized.replace(new RegExp(rule.value as string, 'gi'), '');
      }
    }

    return sanitized;
  }
}

// 验证规则
interface ValidationRule {
  name: string;
  type: 'required' | 'type' | 'minLength' | 'maxLength' | 'pattern' | 'allowList' | 'denyList' | 'custom';
  value?: unknown;
  message: string;
  sanitize?: boolean;
  validator?: (input: unknown) => boolean;
}

// 预定义验证规则
const inputValidationRules = {
  // 项目名称
  projectName: [
    { name: 'required', type: 'required', message: '项目名称不能为空' },
    { name: 'minLength', type: 'minLength', value: 3, message: '项目名称至少3个字符' },
    { name: 'maxLength', type: 'maxLength', value: 100, message: '项目名称最多100个字符' },
    { name: 'pattern', type: 'pattern', value: '^[a-zA-Z0-9-_]+$', message: '项目名称只能包含字母、数字、下划线和连字符' }
  ],

  // 代码
  code: [
    { name: 'maxLength', type: 'maxLength', value: 1000000, message: '代码量过大' },
    { name: 'denyList', type: 'denyList', value: ['eval(', 'Function(', 'exec(', 'spawn('], message: '检测到不安全的代码模式' }
  ],

  // 描述
  description: [
    { name: 'maxLength', type: 'maxLength', value: 10000, message: '描述过长' },
    { name: 'pattern', type: 'pattern', value: /[<>]/, sanitize: true, message: '禁止使用 HTML 标签' }
  ]
};
```

### 5.2 输出过滤

```typescript
// 输出过滤器
class OutputFilter {
  private filters: OutputFilterRule[];

  // 过滤输出
  filter(output: GeneratedOutput): FilteredOutput {
    const removed: RemovedContent[] = [];
    const warnings: ContentWarning[] = [];

    let content = output.content;

    for (const filter of this.filters) {
      if (filter.match(content)) {
        if (filter.action === 'remove') {
          removed.push({
            ruleId: filter.id,
            content: filter.matchContent || 'matched',
            reason: filter.reason
          });
          content = filter.remove(content);
        } else if (filter.action === 'warn') {
          warnings.push({
            ruleId: filter.id,
            message: filter.warningMessage
          });
        }
      }
    }

    return {
      content,
      originalContent: output.content,
      removed,
      warnings,
      filtered: removed.length > 0 || warnings.length > 0
    };
  }
}

// 输出过滤规则
interface OutputFilterRule {
  id: string;
  name: string;
  pattern: string | RegExp;
  action: 'remove' | 'warn' | 'review';
  remove?: (content: string) => string;
  matchContent?: string;
  reason: string;
  warningMessage?: string;
}

// 预定义输出过滤规则
const outputFilters: OutputFilterRule[] = [
  // 移除敏感信息
  {
    id: 'filter-001',
    name: '移除敏感信息',
    pattern: /(?:password|secret|api[_-]?key|token|credential)\s*[:=]\s*["\'](?![${])[a-zA-Z0-9+/=]{8,}/gi,
    action: 'remove',
    remove: (content) => content.replace(/(password|secret|api[_-]?key|token|credential)\s*[:=]\s*["\'][^"\']+["\']/gi, '$1 = "[REDACTED]"'),
    reason: '敏感信息脱敏'
  },

  // 警告外部链接
  {
    id: 'filter-002',
    name: '外部链接警告',
    pattern: /https?:\/\/(?!localhost|127\.0\.0\.1)([^\s]+)/gi,
    action: 'warn',
    reason: '外部链接需要审查',
    warningMessage: '此内容包含外部链接，请确保链接安全'
  },

  // 移除调试代码
  {
    id: 'filter-003',
    name: '移除调试代码',
    pattern: /(?:console\.(log|debug|info)|debugger|console\.trace)\s*\(/gi,
    action: 'remove',
    remove: (content) => content.replace(/(?:console\.(log|debug|info|trace)|debugger)\s*\([^)]*\)\s*;?\s*/gi, ''),
    reason: '移除调试代码'
  }
];
```

---

## 6. 合规管理

### 6.1 许可证合规

```typescript
// 许可证类型
enum LicenseType {
  // 开源许可证
  PERMISSIVE = 'permissive',         // MIT, BSD, Apache
  COPYLEFT = 'copyleft',             // GPL, AGPL, LGPL
  WEAK_COPYLEFT = 'weak-copyleft',  // MPL, CDDL, EPL

  // 专有许可证
  PROPRIETARY = 'proprietary',

  // 特殊许可证
  PUBLIC_DOMAIN = 'public-domain',
  UNLICENSED = 'unlicensed'
}

// 许可证信息
interface License {
  spdxId: string;
  name: string;
  type: LicenseType;
  permissions: string[];
  conditions: string[];
  limitations: string[];
  compatibility: LicenseType[];
  incompatible: LicenseType[];
}

// 许可证检查器
class LicenseChecker {
  private licenses: Map<string, License>;

  // 检查许可证兼容性
  checkCompatibility(licenses: string[]): CompatibilityResult {
    const results: LicenseResult[] = [];

    for (const license of licenses) {
      const licenseInfo = this.licenses.get(license);
      if (!licenseInfo) {
        results.push({
          license,
          status: 'unknown',
          message: 'License not recognized'
        });
        continue;
      }

      const issues: string[] = [];

      // 检查 copyleft 兼容性
      for (const other of licenses) {
        if (license === other) continue;

        const otherInfo = this.licenses.get(other);
        if (otherInfo && otherInfo.incompatible.includes(licenseInfo.type)) {
          issues.push(`Incompatible with ${other}: ${licenseInfo.type} cannot be combined with ${otherInfo.type}`);
        }
      }

      results.push({
        license,
        status: issues.length === 0 ? 'compatible' : 'conflict',
        licenseInfo,
        issues
      });
    }

    return {
      overall: results.every(r => r.status === 'compatible') ? 'compatible' : 'conflicts',
      results,
      recommendations: this.generateRecommendations(results)
    };
  }

  // 检查许可证义务
  checkObligations(license: string): Obligation[] {
    const licenseInfo = this.licenses.get(license);
    if (!licenseInfo) return [];

    return licenseInfo.conditions.map(condition => ({
      license,
      condition,
      description: this.describeCondition(condition),
      compliance: this.getComplianceGuidance(condition)
    }));
  }

  // 推荐许可证
  recommendLicense(context: RecommendationContext): string[] {
    const recommendations: string[] = [];

    if (context.allowCommercial) {
      if (context.allowModification) {
        if (context.allowDistribution) {
          recommendations.push('MIT', 'Apache-2.0', 'BSD-3-Clause');
        } else {
          recommendations.push('MIT', 'Apache-2.0');
        }
      } else {
        recommendations.push('Apache-2.0', 'BSD-3-Clause');
      }
    } else {
      recommendations.push('GPL-3.0', 'AGPL-3.0');
    }

    return recommendations;
  }
}

// 许可证结果
interface LicenseResult {
  license: string;
  status: 'compatible' | 'conflict' | 'unknown';
  licenseInfo?: License;
  issues: string[];
}
```

### 6.2 隐私合规

```typescript
// 隐私法规
enum PrivacyRegulation {
  GDPR = 'gdpr',           // 欧盟通用数据保护条例
  CCPA = 'ccpa',          // 加州消费者隐私法
  HIPAA = 'hipaa',         // 健康保险便携性和责任法
  SOC2 = 'soc2',          // SOC 2 合规
  PIPL = 'pipl'           // 中国个人信息保护法
}

// 隐私检查项
interface PrivacyCheckItem {
  regulation: PrivacyRegulation;
  requirement: string;
  description: string;
  checkType: 'implemented' | 'documented' | 'configurable';
  severity: 'required' | 'recommended';
}

// 隐私合规检查器
class PrivacyComplianceChecker {
  private checks: Map<PrivacyRegulation, PrivacyCheckItem[]>;

  // 执行隐私检查
  async checkPrivacyCompliance(
    project: GeneratedProject,
    regulations: PrivacyRegulation[]
  ): Promise<PrivacyComplianceReport> {
    const results: RegulationResult[] = [];

    for (const regulation of regulations) {
      const checks = this.checks.get(regulation) || [];
      const regulationResults = await this.checkRegulation(project, regulation, checks);

      results.push(regulationResults);
    }

    return {
      regulations: results,
      overallCompliance: this.calculateOverallCompliance(results),
      gaps: this.identifyGaps(results),
      recommendations: this.generateRecommendations(results)
    };
  }

  // 检查特定法规
  private async checkRegulation(
    project: GeneratedProject,
    regulation: PrivacyRegulation,
    checks: PrivacyCheckItem[]
  ): Promise<RegulationResult> {
    const checkResults: CheckResult[] = [];

    for (const check of checks) {
      const result = await this.performCheck(project, check);
      checkResults.push(result);
    }

    const complianceScore = checkResults
      .filter(r => r.status === 'pass')
      .length / checkResults.length;

    return {
      regulation,
      complianceScore,
      status: complianceScore >= 0.8 ? 'compliant' : 'non-compliant',
      checkResults
    };
  }

  // GDPR 特定检查
  private readonly gdprChecks: PrivacyCheckItem[] = [
    {
      regulation: PrivacyRegulation.GDPR,
      requirement: 'lawful-basis',
      description: '数据处理的法律依据',
      checkType: 'documented',
      severity: 'required'
    },
    {
      regulation: PrivacyRegulation.GDPR,
      requirement: 'consent-mechanism',
      description: '有效的同意机制',
      checkType: 'implemented',
      severity: 'required'
    },
    {
      regulation: PrivacyRegulation.GDPR,
      requirement: 'right-to-erasure',
      description: '数据删除权实现',
      checkType: 'implemented',
      severity: 'required'
    },
    {
      regulation: PrivacyRegulation.GDPR,
      requirement: 'data-portability',
      description: '数据可携带性',
      checkType: 'implemented',
      severity: 'required'
    },
    {
      regulation: PrivacyRegulation.GDPR,
      requirement: 'privacy-by-design',
      description: '默认隐私设计',
      checkType: 'documented',
      severity: 'required'
    },
    {
      regulation: PrivacyRegulation.GDPR,
      requirement: 'breach-notification',
      description: '数据泄露通知机制',
      checkType: 'implemented',
      severity: 'required'
    }
  ];
}
```

---

## 7. 审计追踪

### 7.1 审计日志

```typescript
// 审计事件类型
enum AuditEventType {
  // 生成事件
  PROJECT_GENERATED = 'project-generated',
  CODE_GENERATED = 'code-generated',
  COMPONENT_SELECTED = 'component-selected',

  // 安全事件
  ETHICAL_VIOLATION = 'ethical-violation',
  SECURITY_SCAN = 'security-scan',
  VULNERABILITY_FOUND = 'vulnerability-found',
  SENSITIVE_DATA_DETECTED = 'sensitive-data-detected',

  // 合规事件
  LICENSE_CHECK = 'license-check',
  PRIVACY_CHECK = 'privacy-check',
  COMPLIANCE_ISSUE = 'compliance-issue',

  // 人工介入事件
  HUMAN_REVIEW = 'human-review',
  HUMAN_APPROVAL = 'human-approval',
  HUMAN_REJECTION = 'human-rejection',

  // 系统事件
  RULE_CHANGED = 'rule-changed',
  POLICY_UPDATED = 'policy-updated'
}

// 审计事件
interface AuditEvent {
  id: string;
  type: AuditEventType;
  timestamp: Date;
  actor: {
    type: 'user' | 'system' | 'agent';
    id: string;
    name: string;
  };
  resource?: {
    type: string;
    id: string;
    name: string;
  };
  action: {
    verb: string;
    target?: string;
  };
  outcome: {
    status: 'success' | 'failure' | 'partial';
    details?: string;
  };
  metadata: Record<string, unknown>;
  compliance?: {
    regulation?: PrivacyRegulation;
    license?: string;
    policy?: string;
  };
}

// 审计日志服务
class AuditLogService {
  private storage: AuditStorage;

  // 记录事件
  async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: AuditEvent = {
      ...event,
      id: uuid(),
      timestamp: new Date()
    };

    // 存储事件
    await this.storage.append(fullEvent);

    // 实时告警 (如果需要)
    if (this.requiresAlert(event)) {
      await this.sendAlert(event);
    }
  }

  // 查询审计日志
  async query(query: AuditQuery): Promise<AuditEvent[]> {
    return this.storage.query(query);
  }

  // 生成审计报告
  async generateReport(
    period: { start: Date; end: Date },
    scope: 'summary' | 'detailed'
  ): Promise<AuditReport> {
    const events = await this.storage.query({
      startDate: period.start,
      endDate: period.end
    });

    const summary = this.summarizeEvents(events);

    return {
      period,
      summary,
      events: scope === 'detailed' ? events : undefined,
      generatedAt: new Date()
    };
  }
}

// 审计查询
interface AuditQuery {
  startDate?: Date;
  endDate?: Date;
  types?: AuditEventType[];
  actorIds?: string[];
  resourceTypes?: string[];
  outcomes?: ('success' | 'failure' | 'partial')[];
  limit?: number;
}
```

### 7.2 合规报告

```typescript
// 合规报告生成器
class ComplianceReportGenerator {
  // 生成定期合规报告
  async generatePeriodicReport(
    period: CompliancePeriod
  ): Promise<ComplianceReport> {
    return {
      // 基本信息
      period,
      generatedAt: new Date(),

      // 伦理合规
      ethicalCompliance: await this.getEthicalCompliance(period),

      // 安全合规
      securityCompliance: await this.getSecurityCompliance(period),

      // 隐私合规
      privacyCompliance: await this.getPrivacyCompliance(period),

      // 许可证合规
      licenseCompliance: await this.getLicenseCompliance(period),

      // 事件统计
      eventSummary: await this.getEventSummary(period),

      // 风险评估
      riskAssessment: await this.assessRisks(period),

      // 改进建议
      recommendations: await this.generateRecommendations(period)
    };
  }

  // 导出合规证据
  async exportEvidence(
    period: CompliancePeriod,
    format: 'json' | 'pdf' | 'csv'
  ): Promise<EvidencePackage> {
    const events = await this.getAuditEvents(period);
    const findings = await this.getFindings(period);
    const attestations = await this.getAttestations(period);

    return {
      period,
      format,
      contents: {
        auditTrail: events,
        findings,
        attestations,
        metadata: {
          exportedAt: new Date(),
          exportedBy: 'system',
          checksum: await this.calculateChecksum(events)
        }
      }
    };
  }
}

// 合规期间
interface CompliancePeriod {
  start: Date;
  end: Date;
  type: 'monthly' | 'quarterly' | 'annual' | 'custom';
}
```

---

## 8. 相关文档

- [安全设计](./SECURITY_DESIGN.md)
- [零信任安全架构](./ZERO_TRUST_SECURITY.md)
- [端到端加密设计](./END_TO_END_ENCRYPTION.md)
- [审计日志与合规设计](./AUDIT_LOGGING_COMPLIANCE.md)

---

**最后更新**: 2026-04-14
