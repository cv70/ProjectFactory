# 可解释AI系统

## 概述

可解释AI系统（Explainable AI System）是 ProjectFactory 系统的信任建设核心组件，负责生成过程和决策的透明化，让用户和开发者能够理 AI 系统"为什么"做出特定的决策或生成特定的代码。通过系统化的解释机制，建立对 AI 生成结果的信任，同时支持问题诊断和持续改进。

## 核心价值

- **信任建立**：通过透明的决策过程建立用户信任
- **问题诊断**：当结果不符合预期时，能够定位问题根源
- **合规要求**：满足监管和审计的 AI 可解释性要求
- **持续改进**：基于解释反馈优化系统性能
- **知识传递**：帮助用户理解代码生成的逻辑

## 解释类型体系

### 解释层级

```typescript
// 解释层级
enum ExplanationLevel {
  // 黑盒级：只解释输入和输出
  BLACK_BOX = 'black_box',

  // 功能级：解释功能逻辑
  FUNCTIONAL = 'functional',

  // 实现级：解释具体实现细节
  IMPLEMENTATION = 'implementation',

  // 推理级：解释 AI 的推理过程
  REASONING = 'reasoning',

  // 批判级：解释局限性、假设和潜在问题
  CRITICAL = 'critical',
}

// 解释请求
interface ExplanationRequest {
  target: ExplanationTarget;
  level: ExplanationLevel;
  audience?: 'developer' | 'user' | 'auditor';
  format?: 'text' | 'visual' | 'interactive';
}

// 解释目标
type ExplanationTarget =
  | { type: 'requirement_interpretation'; data: Requirement }
  | { type: 'architecture_choice'; data: ArchitectureDecision }
  | { type: 'code_generation'; data: GeneratedCode }
  | { type: 'quality_assessment'; data: QualityMetrics }
  | { type: 'optimization_decision'; data: OptimizationAction }
  | { type: 'rejection_decision'; data: RejectionReason };
```

### 解释模型

```typescript
// 解释结果
interface Explanation {
  id: string;
  request: ExplanationRequest;

  // 层级和类型
  level: ExplanationLevel;
  category: ExplanationCategory;

  // 主要内容
  summary: string;                 // 一句话总结
  details: ExplanationSection[];   // 详细解释

  // 支持证据
  evidence: Evidence[];

  // 置信度
  confidence: {
    overall: number;              // 0-1
    reasoning: number;            // 推理置信度
    evidence: number;            // 证据置信度
  };

  // 局限性说明
  limitations: string[];

  // 元数据
  metadata: {
    generatedAt: Date;
    model: string;
    processingTime: number;      // 毫秒
  };
}

interface ExplanationSection {
  title: string;
  content: string;
  importance: 'critical' | 'important' | 'supplementary';
  expandable?: boolean;
  children?: ExplanationSection[];
}

interface Evidence {
  type: 'rule' | 'example' | 'data' | 'pattern' | 'constraint';
  description: string;
  relevance: number;              // 0-1，与解释的相关性
  source?: string;               // 来源引用
}
```

## 解释生成器

### 需求解释器

```typescript
// 需求解释器
class RequirementExplainer {
  private llm: LLM;

  async explain(
    requirement: string,
    interpretation: ParsedRequirement,
    level: ExplanationLevel
  ): Promise<Explanation> {
    switch (level) {
      case ExplanationLevel.BLACK_BOX:
        return this.blackBoxExplain(requirement, interpretation);

      case ExplanationLevel.FUNCTIONAL:
        return this.functionalExplain(requirement, interpretation);

      case ExplanationLevel.REASONING:
        return this.reasoningExplain(requirement, interpretation);

      case ExplanationLevel.CRITICAL:
        return this.criticalExplain(requirement, interpretation);

      default:
        return this.comprehensiveExplain(requirement, interpretation);
    }
  }

  // 功能级解释
  private functionalExplain(
    requirement: string,
    interpretation: ParsedRequirement
  ): Explanation {
    return {
      id: generateId(),
      request: { target: { type: 'requirement_interpretation', data: requirement }, level: ExplanationLevel.FUNCTIONAL },

      level: ExplanationLevel.FUNCTIONAL,
      category: ExplanationCategory.INTERPRETATION,

      summary: this.generateSummary(interpretation),

      details: [
        {
          title: '识别的功能',
          content: this.listIdentifiedFunctions(interpretation),
          importance: 'critical',
        },
        {
          title: '数据输入',
          content: this.describeInputs(interpretation),
          importance: 'important',
        },
        {
          title: '预期输出',
          content: this.describeOutputs(interpretation),
          importance: 'important',
        },
        {
          title: '约束条件',
          content: this.listConstraints(interpretation),
          importance: 'supplementary',
        },
      ],

      evidence: this.extractEvidence(interpretation),

      confidence: {
        overall: interpretation.confidence,
        reasoning: interpretation.reasoningConfidence,
        evidence: interpretation.evidenceConfidence,
      },

      limitations: this.identifyLimitations(interpretation),
      metadata: this.generateMetadata(),
    };
  }

  // 推理级解释
  private async reasoningExplain(
    requirement: string,
    interpretation: ParsedRequirement
  ): Promise<Explanation> {
    // 使用 LLM 生成推理过程解释
    const reasoning = await this.llm.generate(\`
      解释以下需求解析的推理过程：

      原始需求: \${requirement}

      解析结果:
      - 识别的实体: \${JSON.stringify(interpretation.entities)}
      - 识别的动作: \${JSON.stringify(interpretation.actions)}
      - 识别的约束: \${JSON.stringify(interpretation.constraints)}

      请详细解释:
      1. 为什么这样解析需求中的关键实体
      2. 如何确定需要实现的功能
      3. 基于什么假设和规则
      4. 可能的歧义和如何处理的
    \`, { format: 'explanation' });

    return {
      id: generateId(),
      request: { target: { type: 'requirement_interpretation', data: requirement }, level: ExplanationLevel.REASONING },

      level: ExplanationLevel.REASONING,
      category: ExplanationCategory.INTERPRETATION,

      summary: reasoning.summary,
      details: reasoning.details,
      evidence: this.extractEvidence(interpretation),
      confidence: {
        overall: interpretation.confidence,
        reasoning: 0.85,
        evidence: interpretation.evidenceConfidence,
      },
      limitations: this.identifyLimitations(interpretation),
      metadata: this.generateMetadata(),
    };
  }

  // 批判级解释
  private criticalExplain(
    requirement: string,
    interpretation: ParsedRequirement
  ): Explanation {
    return {
      id: generateId(),
      request: { target: { type: 'requirement_interpretation', data: requirement }, level: ExplanationLevel.CRITICAL },

      level: ExplanationLevel.CRITICAL,
      category: ExplanationCategory.INTERPRETATION,

      summary: this.generateCriticalSummary(interpretation),

      details: [
        {
          title: '可能的误解',
          content: this.identifyPossibleMisinterpretations(interpretation),
          importance: 'critical',
        },
        {
          title: '未明确的部分',
          content: this.identifyAmbiguities(interpretation),
          importance: 'critical',
        },
        {
          title: '假设条件',
          content: this.listAssumptions(interpretation),
          importance: 'important',
        },
        {
          title: '潜在问题',
          content: this.identifyPotentialIssues(interpretation),
          importance: 'important',
        },
        {
          title: '需要澄清的问题',
          content: this.listClarificationQuestions(interpretation),
          importance: 'supplementary',
        },
      ],

      evidence: [],
      confidence: {
        overall: 0.7,
        reasoning: 0.75,
        evidence: 0.65,
      },
      limitations: [
        '批判性分析基于规则，可能遗漏复杂场景',
        '假设条件可能不完整',
      ],
      metadata: this.generateMetadata(),
    };
  }
}
```

### 代码生成解释器

```typescript
// 代码生成解释器
class CodeGenerationExplainer {
  private llm: LLM;
  private codeAnalyzer: CodeAnalyzer;

  async explain(
    generatedCode: GeneratedCode,
    context: GenerationContext,
    level: ExplanationLevel
  ): Promise<Explanation> {
    // 1. 分析代码结构
    const analysis = await this.codeAnalyzer.analyze(generatedCode);

    // 2. 追溯决策过程
    const decisions = await this.traceDecisions(generatedCode, context);

    // 3. 生成解释
    switch (level) {
      case ExplanationLevel.IMPLEMENTATION:
        return this.implementationExplain(generatedCode, analysis, decisions);

      case ExplanationLevel.REASONING:
        return this.reasoningExplain(generatedCode, analysis, decisions);

      case ExplanationLevel.CRITICAL:
        return this.criticalExplain(generatedCode, analysis, decisions);

      default:
        return this.functionalExplain(generatedCode, analysis, decisions);
    }
  }

  // 实现级解释
  private implementationExplain(
    code: GeneratedCode,
    analysis: CodeAnalysis,
    decisions: DecisionTrace
  ): Explanation {
    return {
      id: generateId(),
      request: { target: { type: 'code_generation', data: code }, level: ExplanationLevel.IMPLEMENTATION },

      level: ExplanationLevel.IMPLEMENTATION,
      category: ExplanationCategory.GENERATION,

      summary: \`生成了 \${analysis.linesOfCode} 行代码，包含 \${analysis.functions.length} 个函数和 \${analysis.classes.length} 个类\`,

      details: [
        {
          title: '代码结构',
          content: this.describeStructure(analysis),
          importance: 'critical',
        },
        {
          title: '设计模式使用',
          content: this.explainPatterns(analysis),
          importance: 'important',
        },
        {
          title: '技术选型理由',
          content: decisions.technologyChoices.map(c =>
            \`\${c.technology}: \${c.rationale}\`
          ).join('\\n'),
          importance: 'important',
        },
        {
          title: '关键实现细节',
          content: this.explainKeyImplementations(analysis),
          importance: 'supplementary',
        },
      ],

      evidence: [
        ...decisions.technologyChoices.map(c => ({
          type: 'rule' as const,
          description: \`选择 \${c.technology}: \${c.reason}\`,
          relevance: 0.9,
          source: c.sourcePattern,
        })),
        ...analysis.patternsDetected.map(p => ({
          type: 'pattern' as const,
          description: \`应用了 \${p.name} 模式\`,
          relevance: p.confidence,
          source: p.documentation,
        })),
      ],

      confidence: {
        overall: analysis.confidence,
        reasoning: decisions.confidence,
        evidence: 0.95,
      },

      limitations: this.identifyLimitations(code, analysis),
      metadata: this.generateMetadata(),
    };
  }

  // 推理级解释
  private async reasoningExplain(
    code: GeneratedCode,
    analysis: CodeAnalysis,
    decisions: DecisionTrace
  ): Promise<Explanation> {
    // 使用 LLM 生成推理过程
    const reasoning = await this.llm.generate(\`
      解释以下代码生成的推理过程：

      生成代码概述:
      - 语言: \${code.language}
      - 行数: \${analysis.linesOfCode}
      - 主要功能: \${analysis.mainPurpose}

      决策过程:
      \${decisions.steps.map((s, i) => \`\${i + 1}. \${s.description}: \${s.rationale}\`).join('\\n')}

      请详细解释:
      1. 每一步决策的考虑因素
      2. 为什么选择当前的实现方式
      3. 有哪些备选方案被否决了，为什么
      4. 关键的转折点和权衡
    \`, { format: 'explanation' });

    return {
      id: generateId(),
      request: { target: { type: 'code_generation', data: code }, level: ExplanationLevel.REASONING },

      level: ExplanationLevel.REASONING,
      category: ExplanationCategory.GENERATION,

      summary: reasoning.summary,
      details: reasoning.details,
      evidence: decisions.steps.map(s => ({
        type: 'decision' as const,
        description: s.description,
        relevance: s.confidence,
      })),
      confidence: {
        overall: analysis.confidence,
        reasoning: 0.8,
        evidence: decisions.confidence,
      },
      limitations: this.identifyLimitations(code, analysis),
      metadata: this.generateMetadata(),
    };
  }
}
```

## 解释可视化

### 解释面板组件

```typescript
// 解释面板属性
interface ExplanationPanelProps {
  explanation: Explanation;
  onDrillDown?: (section: ExplanationSection) => void;
  onFeedback?: (feedback: ExplanationFeedback) => void;
}

// 解释面板组件
const ExplanationPanel: React.FC<ExplanationPanelProps> = ({
  explanation,
  onDrillDown,
  onFeedback,
}) => {
  return (
    <div className="explanation-panel">
      {/* 头部 */}
      <div className="explanation-header">
        <span className="explanation-level">
          {getLevelLabel(explanation.level)}
        </span>
        <ConfidenceIndicator confidence={explanation.confidence.overall} />
      </div>

      {/* 摘要 */}
      <div className="explanation-summary">
        <h3>{explanation.summary}</h3>
      </div>

      {/* 详细解释 */}
      <div className="explanation-details">
        {explanation.details.map((section, index) => (
          <ExplanationSectionComponent
            key={index}
            section={section}
            onDrillDown={onDrillDown}
          />
        ))}
      </div>

      {/* 证据展示 */}
      {explanation.evidence.length > 0 && (
        <EvidencePanel evidence={explanation.evidence} />
      )}

      {/* 局限性 */}
      {explanation.limitations.length > 0 && (
        <LimitationsPanel limitations={explanation.limitations} />
      )}

      {/* 反馈 */}
      <FeedbackPanel onFeedback={onFeedback} />
    </div>
  );
};

// 置信度指示器
const ConfidenceIndicator: React.FC<{ confidence: number }> = ({ confidence }) => {
  const color = confidence >= 0.8 ? 'green' :
                confidence >= 0.5 ? 'yellow' : 'red';

  return (
    <div className="confidence-indicator">
      <span className="confidence-label">置信度</span>
      <div className="confidence-bar">
        <div
          className={\`confidence-fill confidence-\${color}\`}
          style={{ width: \`\${confidence * 100}%\` }}
        />
      </div>
      <span className="confidence-value">\${(confidence * 100).toFixed(0)}%</span>
    </div>
  );
};

// 证据面板
const EvidencePanel: React.FC<{ evidence: Evidence[] }> = ({ evidence }) => {
  return (
    <div className="evidence-panel">
      <h4>支持证据</h4>
      <ul>
        {evidence.map((e, i) => (
          <li key={i} className="evidence-item">
            <span className="evidence-type">\${getEvidenceTypeLabel(e.type)}</span>
            <span className="evidence-description">\${e.description}</span>
            <span className="evidence-relevance">
              相关性: \${(e.relevance * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
```

### 推理链可视化

```typescript
// 推理链可视化
interface ReasoningChainVisualizationProps {
  trace: DecisionTrace;
}

// 推理链组件
const ReasoningChainVisualization: React.FC<ReasoningChainVisualizationProps> = ({
  trace,
}) => {
  return (
    <div className="reasoning-chain">
      <h4>推理过程</h4>

      <div className="chain-timeline">
        {trace.steps.map((step, index) => (
          <div key={index} className="chain-step">
            <div className="step-connector">
              {index > 0 && <div className="connector-line" />}
              <div className="step-node">
                {index + 1}
              </div>
            </div>

            <div className="step-content">
              <div className="step-header">
                <span className="step-title">\${step.title}</span>
                <span className="step-confidence">
                  \${(step.confidence * 100).toFixed(0)}%
                </span>
              </div>

              <p className="step-description">\${step.description}</p>

              <div className="step-rationale">
                <span className="rationale-label">理由:</span>
                <span className="rationale-content">\${step.rationale}</span>
              </div>

              {step.alternatives && step.alternatives.length > 0 && (
                <div className="step-alternatives">
                  <span className="alternatives-label">否决的备选方案:</span>
                  <ul>
                    {step.alternatives.map((alt, i) => (
                      <li key={i}>
                        <span className="alt-name">\${alt.name}</span>
                        <span className="alt-rejection">- \${alt.rejectionReason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

## 质量评估解释

### 质量分数解释

```typescript
// 质量评估解释器
class QualityAssessmentExplainer {
  async explainQualityScore(
    assessment: QualityAssessment,
    level: ExplanationLevel
  ): Promise<Explanation> {
    return {
      id: generateId(),
      request: { target: { type: 'quality_assessment', data: assessment }, level },

      level,
      category: ExplanationCategory.QUALITY,

      summary: \`综合质量分数: \${assessment.overallScore}/100 (等级: \${assessment.grade})\`,

      details: [
        {
          title: '各维度得分',
          content: this.explainDimensionScores(assessment),
          importance: 'critical',
        },
        {
          title: '关键指标分析',
          content: this.explainKeyMetrics(assessment),
          importance: 'important',
        },
        {
          title: '与标准对比',
          content: this.compareWithStandards(assessment),
          importance: 'important',
        },
      ],

      evidence: this.generateEvidence(assessment),
      confidence: {
        overall: assessment.confidence,
        reasoning: 0.9,
        evidence: 0.85,
      },

      limitations: [
        '自动化评估可能无法捕捉所有质量问题',
        '某些主观质量维度难以精确量化',
      ],

      metadata: {
        generatedAt: new Date(),
        model: 'quality-assessor-v1',
        processingTime: assessment.processingTime,
      },
    };
  }

  private explainDimensionScores(assessment: QualityAssessment): string {
    return assessment.dimensions
      .map(d => \`\${d.name}: \${d.score}/100 (\${d.trend === 'up' ? '↑' : d.trend === 'down' ? '↓' : '→'})\`)
      .join('\\n');
  }
}
```

## 用户反馈机制

### 解释反馈

```typescript
// 解释反馈
interface ExplanationFeedback {
  explanationId: string;
  userId: string;

  // 反馈类型
  type: 'helpful' | 'not_helpful' | 'incorrect' | 'missing_context';

  // 具体反馈
  comment?: string;

  // 评分
  clarity: number;        // 1-5
  completeness: number;   // 1-5
  accuracy: number;       // 1-5

  // 改进建议
  suggestions?: string[];

  createdAt: Date;
}

// 反馈收集组件
const ExplanationFeedbackPanel: React.FC<{
  explanationId: string;
  onSubmit: (feedback: ExplanationFeedback) => void;
}> = ({ explanationId, onSubmit }) => {
  const [feedback, setFeedback] = useState<Partial<ExplanationFeedback>>({});

  return (
    <div className="feedback-panel">
      <h4>这解释有帮助吗？</h4>

      <div className="feedback-ratings">
        <RatingField
          label="清晰度"
          value={feedback.clarity}
          onChange={(v) => setFeedback({ ...feedback, clarity: v })}
        />
        <RatingField
          label="完整性"
          value={feedback.completeness}
          onChange={(v) => setFeedback({ ...feedback, completeness: v })}
        />
        <RatingField
          label="准确性"
          value={feedback.accuracy}
          onChange={(v) => setFeedback({ ...feedback, accuracy: v })}
        />
      </div>

      <textarea
        placeholder="请提供其他反馈或建议..."
        value={feedback.comment}
        onChange={(e) => setFeedback({ ...feedback, comment: e.target.value })}
      />

      <button onClick={() => onSubmit(feedback as ExplanationFeedback)}>
        提交反馈
      </button>
    </div>
  );
};
```

## 配置示例

```yaml
# 可解释AI配置
explainable_ai:
  # 解释生成
  generation:
    enabled: true
    default_level: "functional"  # black_box | functional | implementation | reasoning | critical
    auto_generate: true
    cache_explanations: true

  # 解释器配置
  explainers:
    requirement:
      enabled: true
      include_reasoning: true
      include_critical: true

    code_generation:
      enabled: true
      trace_decisions: true
      explain_patterns: true
      show_alternatives: true

    quality_assessment:
      enabled: true
      explain_dimensions: true
      compare_with_standards: true

  # 可视化
  visualization:
    enabled: true
    show_confidence: true
    show_evidence: true
    show_reasoning_chain: true

  # 用户反馈
  feedback:
    enabled: true
    required_for_low_confidence: true
    collect_implicit: true
    min_samples_for_update: 100

  # 审计
  audit:
    enabled: true
    log_all_explanations: true
    retention_days: 365
```

---

**最后更新**: 2026-04-14
