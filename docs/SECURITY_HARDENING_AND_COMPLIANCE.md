# 安全加固与合规系统

## 概述

安全加固与合规系统（Security Hardening & Compliance System）是ProjectFactory系统的基础安全屏障，负责实施纵深防御策略、保障数据安全、满足合规要求。系统涵盖网络安全、应用安全、数据安全、安全监控和合规审计等多个层面，确保系统在面对各类安全威胁时保持稳健运行。

## 核心价值

- **纵深防御**：多层安全防护，快速失效（Fail-secure）
- **数据保护**：端到端加密，数据脱敏，最小权限
- **威胁防护**：WAF、防火墙、入侵检测、漏洞管理
- **合规保障**：满足SOC2、GDPR、ISO27001等合规要求
- **安全运营**：持续监控、快速响应、持续改进

## 安全架构

### 纵深防御模型

```
┌─────────────────────────────────────────────────────────────────┐
│                        纵深防御体系                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  第1层: 边界安全                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ DDoS防护 | WAF | 防火墙 | VPN/零信任网关                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  第2层: 网络安全                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ VPC隔离 | 安全组 | 网络分段 | mTLS                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  第3层: 应用安全                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 输入验证 | 输出编码 | 认证授权 | 会话管理 | API安全         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  第4层: 数据安全                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 加密存储 | 访问控制 | 数据脱敏 | 备份加密                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  第5层: 主机安全                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 最小化镜像 | 安全配置 | 漏洞管理 | 容器安全                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 网络安全

### 防火墙配置

```typescript
// 网络安全配置
interface NetworkSecurityConfig {
  // VPC配置
  vpc: {
    cidr: string;                    // VPC CIDR
    enableDnsHostnames: boolean;
    enableDnsSupport: boolean;
  };

  // 子网配置
  subnets: {
    public: string[];               // 公有子网
    private: string[];              // 私有子网
    database: string[];             // 数据库子网
  };

  // 安全组规则
  securityGroups: SecurityGroupRule[];

  // 网络ACL
  networkACLs: NetworkACLRule[];
}

interface SecurityGroupRule {
  type: 'ingress' | 'egress';
  protocol: 'tcp' | 'udp' | 'icmp' | 'all';
  fromPort: number;
  toPort: number;
  cidr: string;
  description: string;
}

// 预设安全组配置
const SECURITY_GROUP_CONFIG = {
  // 负载均衡
  'lb-sg': {
    ingress: [
      { type: 'ingress', protocol: 'tcp', fromPort: 443, toPort: 443, cidr: '0.0.0.0/0', description: 'HTTPS' },
      { type: 'ingress', protocol: 'tcp', fromPort: 80, toPort: 80, cidr: '0.0.0.0/0', description: 'HTTP' },
    ],
    egress: [
      { type: 'egress', protocol: 'all', fromPort: 0, toPort: 65535, cidr: '0.0.0.0/0', description: 'Allow all' },
    ],
  },

  // 应用服务
  'app-sg': {
    ingress: [
      { type: 'ingress', protocol: 'tcp', fromPort: 3000, toPort: 3000, cidr: '10.0.0.0/16', description: 'From LB' },
      { type: 'ingress', protocol: 'tcp', fromPort: 22, toPort: 22, cidr: '10.0.0.0/16', description: 'SSH from bastion' },
    ],
    egress: [
      { type: 'egress', protocol: 'tcp', fromPort: 5432, toPort: 5432, cidr: '10.0.1.0/24', description: 'To RDS' },
      { type: 'egress', protocol: 'tcp', fromPort: 6379, toPort: 6379, cidr: '10.0.2.0/24', description: 'To Redis' },
    ],
  },

  // 数据库
  'db-sg': {
    ingress: [
      { type: 'ingress', protocol: 'tcp', fromPort: 5432, toPort: 5432, cidr: '10.0.0.0/16', description: 'From app' },
    ],
    egress: [],
  },
};
```

### DDoS防护

```typescript
// DDoS防护配置
interface DDoSProtectionConfig {
  enabled: boolean;
  provider: 'cloudflare' | 'aws-shield' | 'azure-ddos';

  // 速率限制
  rateLimiting: {
    enabled: boolean;
    requestsPerMinute: number;
    burstSize: number;
  };

  // 流量清洗
  scrubbing: {
    enabled: boolean;
    thresholdGbps: number;
    automaticActivation: boolean;
  };

  // 规则
  rules: DDoSRule[];
}

interface DDoSRule {
  name: string;
  conditions: TrafficCondition[];
  action: 'block' | 'challenge' | 'rate_limit';
}

interface TrafficCondition {
  field: 'src_ip' | 'uri' | 'header' | 'user_agent';
  operator: 'equals' | 'contains' | 'regex' | 'in';
  value: string | string[];
}
```

## 应用安全

### 输入验证

```typescript
// 输入验证规则
interface ValidationRules {
  // 字符串验证
  string: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    trim?: boolean;
    sanitize?: boolean;  // 移除危险字符
  };

  // 数值验证
  number: {
    min?: number;
    max?: number;
    integer?: boolean;
    positive?: boolean;
  };

  // 特殊验证
  special: {
    email?: boolean;
    url?: boolean;
    uuid?: boolean;
    ip?: boolean;
    creditCard?: boolean;
  };

  // 危险字符检测
  dangerous: {
    sqlInjection: boolean;
    xss: boolean;
    commandInjection: boolean;
    pathTraversal: boolean;
  };
}

// 预设验证规则
const PRESET_VALIDATION_RULES = {
  // 用户名
  username: {
    string: {
      minLength: 3,
      maxLength: 30,
      pattern: '^[a-zA-Z0-9_-]+$',
    },
    dangerous: {
      sqlInjection: true,
      xss: true,
    },
  },

  // 邮箱
  email: {
    special: { email: true },
    dangerous: { sqlInjection: true, xss: true },
  },

  // 密码
  password: {
    string: {
      minLength: 8,
      maxLength: 128,
    },
    special: {
      // 自定义强度检查
    },
  },

  // 搜索输入
  searchQuery: {
    string: {
      maxLength: 500,
      trim: true,
      sanitize: true,
    },
    dangerous: {
      sqlInjection: true,
      xss: true,
      commandInjection: true,
      pathTraversal: true,
    },
  },
};

// 验证服务
class InputValidationService {
  validate(value: any, rules: ValidationRules): ValidationResult {
    const errors: ValidationError[] = [];

    // 字符串验证
    if (typeof value === 'string') {
      if (rules.string?.minLength && value.length < rules.string.minLength) {
        errors.push({ field: 'length', message: `Minimum length is ${rules.string.minLength}` });
      }
      if (rules.string?.maxLength && value.length > rules.string.maxLength) {
        errors.push({ field: 'length', message: `Maximum length is ${rules.string.maxLength}` });
      }
      if (rules.string?.pattern && !new RegExp(rules.string.pattern).test(value)) {
        errors.push({ field: 'pattern', message: 'Invalid format' });
      }
    }

    // 危险字符检测
    if (rules.dangerous?.sqlInjection && this.containsSQLInjection(value)) {
      errors.push({ field: 'security', message: 'Invalid characters detected' });
    }
    if (rules.dangerous?.xss && this.containsXSS(value)) {
      errors.push({ field: 'security', message: 'Potential XSS detected' });
    }

    return { valid: errors.length === 0, errors };
  }

  // SQL注入检测
  private containsSQLInjection(value: string): boolean {
    const patterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
      /(--|;|\/\*|\*\/|@@|char\(|nchar\(|varchar\()/i,
    ];
    return patterns.some(p => p.test(value));
  }

  // XSS检测
  private containsXSS(value: string): boolean {
    const patterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<\/?[a-z][\s\S]*>/i,
    ];
    return patterns.some(p => p.test(value));
  }
}
```

### 认证安全

```typescript
// 认证安全配置
interface AuthenticationSecurityConfig {
  // 密码策略
  password: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    maxAge?: number;              // 天数
    preventReuse?: number;         // 历史密码数量
    lockoutThreshold?: number;    // 锁定阈值
    lockoutDuration?: number;     // 锁定时长(分钟)
  };

  // 会话管理
  session: {
    timeout: number;              // 分钟
    absoluteTimeout: number;      // 绝对超时(小时)
    concurrentLimit?: number;     // 并发会话限制
    rotationOnAuth: boolean;       // 认证后轮换
  };

  // MFA配置
  mfa: {
    required: boolean;
    allowedMethods: ('totp' | 'sms' | 'email' | 'backup_code')[];
    trustedDevices?: {
      enabled: boolean;
      maxDevices: number;
      deviceExpiry: number;       // 天数
    };
  };

  // 暴力攻击防护
  bruteForce: {
    enabled: boolean;
    maxAttempts: number;
    windowMinutes: number;
    lockoutMinutes: number;
    progressiveLockout: boolean;   // 渐进锁定
  };
}

// 暴力攻击检测
class BruteForceProtection {
  private attempts: Map<string, AttemptInfo> = new Map();

  checkLoginAttempt(ip: string, email: string): AttemptResult {
    const key = `${ip}:${email}`;
    const info = this.attempts.get(key);

    if (!info) {
      return { allowed: true, remainingAttempts: this.maxAttempts };
    }

    // 检查窗口期
    if (Date.now() - info.windowStart > this.windowMs) {
      this.attempts.delete(key);
      return { allowed: true, remainingAttempts: this.maxAttempts };
    }

    // 检查是否已锁定
    if (info.lockedUntil && Date.now() < info.lockedUntil) {
      return {
        allowed: false,
        locked: true,
        lockedUntil: info.lockedUntil,
        remainingAttempts: 0,
      };
    }

    return {
      allowed: true,
      remainingAttempts: this.maxAttempts - info.attempts,
    };
  }

  recordFailedAttempt(ip: string, email: string): void {
    const key = `${ip}:${email}`;
    let info = this.attempts.get(key);

    if (!info || Date.now() - info.windowStart > this.windowMs) {
      info = { attempts: 0, windowStart: Date.now() };
    }

    info.attempts++;

    // 检查是否需要锁定
    if (info.attempts >= this.maxAttempts) {
      info.lockedUntil = Date.now() + this.lockoutMs;
    }

    this.attempts.set(key, info);
  }
}
```

## 数据安全

### 加密配置

```typescript
// 加密配置
interface EncryptionConfig {
  // 算法
  algorithm: 'AES-256-GCM' | 'AES-256-CBC' | 'ChaCha20-Poly1305';

  // 密钥管理
  keyManagement: {
    provider: 'aws-kms' | 'gcp-kms' | 'azure-keyvault' | 'hashicorp-vault';
    keyId: string;
    rotationPeriod?: number;        // 天数
  };

  // 静态加密
  atRest: {
    database: {
      enabled: boolean;
      algorithm: string;
    };
    storage: {
      enabled: boolean;
      bucketEncryption: string;
    };
    backups: {
      enabled: boolean;
      encrypted: boolean;
    };
  };

  // 传输加密
  inTransit: {
    tls: {
      enabled: boolean;
      minVersion: '1.2' | '1.3';
      cipherSuites: string[];
      certificateRotation: boolean;
    };
    internal: {
      mTLS: boolean;
      serviceMesh: boolean;
    };
  };
}

// 加密服务
class EncryptionService {
  // 加密数据
  async encrypt(plaintext: string, context?: EncryptionContext): Promise<EncryptedData> {
    // 生成数据密钥
    const dataKey = await this.generateDataKey();

    // 生成IV
    const iv = crypto.randomBytes(12);

    // 加密
    const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // 使用主密钥加密数据密钥
    const encryptedDataKey = await this.encryptKeyWithMasterKey(dataKey);

    return {
      version: 1,
      algorithm: 'AES-256-GCM',
      iv: iv.toString('base64'),
      encryptedData: encrypted.toString('base64'),
      authTag: authTag.toString('base64'),
      encryptedKey: encryptedDataKey,
      encryptedAt: new Date().toISOString(),
    };
  }

  // 解密数据
  async decrypt(data: EncryptedData): Promise<string> {
    // 解密数据密钥
    const dataKey = await this.decryptKeyWithMasterKey(data.encryptedKey);

    // 解密内容
    const iv = Buffer.from(data.iv, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey, iv);
    decipher.setAuthTag(Buffer.from(data.authTag, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(data.encryptedData, 'base64'),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
```

### 数据脱敏

```typescript
// 数据脱敏规则
interface DataMaskingRule {
  field: string;
  type: 'full' | 'partial' | 'hash' | 'null' | 'random' | 'custom';
  pattern?: {
    prefix?: number;              // 保留前缀
    suffix?: number;               // 保留后缀
    maskChar?: string;             // 掩码字符
    regex?: string;               // 正则匹配
  };
  condition?: MaskingCondition;
}

interface MaskingCondition {
  field?: string;
  operator: 'equals' | 'in' | 'regex';
  value: any;
}

// 预设脱敏规则
const DATA_MASKING_RULES: DataMaskingRule[] = [
  // 个人信息
  { field: 'email', type: 'partial', pattern: { prefix: 2, suffix: 1, maskChar: '*' } },
  { field: 'phone', type: 'partial', pattern: { prefix: 3, suffix: 2, maskChar: '*' } },
  { field: 'ssn', type: 'partial', pattern: { prefix: 4, suffix: 0, maskChar: '*' } },
  { field: 'creditCard', type: 'partial', pattern: { prefix: 4, suffix: 4, maskChar: '*' } },

  // 敏感数据
  { field: 'password', type: 'hash' },
  { field: 'apiKey', type: 'partial', pattern: { prefix: 4, suffix: 4, maskChar: '*' } },
  { field: 'secretKey', type: 'full', pattern: { maskChar: '*' } },

  // 医疗/财务
  { field: 'medicalRecord', type: 'hash' },
  { field: 'bankAccount', type: 'partial', pattern: { prefix: 4, suffix: 4, maskChar: '*' } },
];

// 脱敏服务
class DataMaskingService {
  mask(data: Record<string, any>, rules: DataMaskingRule[]): Record<string, any> {
    const masked = { ...data };

    for (const rule of rules) {
      if (this.shouldMask(rule, masked)) {
        masked[rule.field] = this.applyMask(data[rule.field], rule);
      }
    }

    return masked;
  }

  private applyMask(value: any, rule: DataMaskingRule): any {
    if (value === null || value === undefined) return value;

    switch (rule.type) {
      case 'full':
        return rule.pattern?.maskChar?.repeat(String(value).length) || '****';

      case 'partial':
        const str = String(value);
        const prefix = rule.pattern?.prefix || 0;
        const suffix = rule.pattern?.suffix || 0;
        const maskChar = rule.pattern?.maskChar || '*';
        const maskLength = str.length - prefix - suffix;
        if (maskLength <= 0) return str;
        return str.slice(0, prefix) + maskChar.repeat(maskLength) + str.slice(-suffix);

      case 'hash':
        return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);

      case 'null':
        return null;

      case 'random':
        return this.generateRandom(String(value).length);
    }
  }
}
```

## 漏洞管理

### 漏洞扫描配置

```typescript
// 漏洞扫描配置
interface VulnerabilityScanningConfig {
  // SAST (静态应用安全测试)
  sast: {
    enabled: boolean;
    tools: ('sonarqube' | 'semgrep' | 'bandit')[];
    scanOnPush: boolean;
    scanOnPullRequest: boolean;
    severityThreshold: 'critical' | 'high' | 'medium' | 'low';
    failOnSeverity?: string[];
  };

  // DAST (动态应用安全测试)
  dast: {
    enabled: boolean;
    tools: ('owasp-zap' | 'acunetix' | 'burp')[];
    scanOnDeploy: boolean;
    scheduledScan?: {
      enabled: boolean;
      interval: string;           // cron表达式
    };
    targetUrls: string[];
  };

  // 依赖扫描
  dependency: {
    enabled: boolean;
    tools: ('snyk' | 'trivy' | 'npm-audit')[];
    failOnCritical: boolean;
    autoFix?: {
      enabled: boolean;
      autoMerge: boolean;
    };
  };

  // 容器扫描
  container: {
    enabled: boolean;
    tools: ('trivy' | 'clair' | 'anchore')[];
    scanOnPush: boolean;
    failOnCritical: boolean;
    allowedImages?: string[];       // 允许的镜像列表
  };
}

// 漏洞报告
interface VulnerabilityReport {
  id: string;
  scanType: 'sast' | 'dast' | 'dependency' | 'container';
  target: string;
  timestamp: Date;

  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };

  vulnerabilities: Vulnerability[];
}

interface Vulnerability {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  cwe?: string;                   // CWE ID
  cve?: string;                   // CVE ID
  cvss?: number;                  // CVSS评分

  location: {
    file?: string;
    line?: number;
    package?: string;
    image?: string;
  };

  status: 'open' | 'in_progress' | 'resolved' | 'false_positive' | 'accepted';
  assignedTo?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
}
```

## 安全监控

### SIEM集成

```typescript
// 安全事件模型
interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';

  // 时间
  timestamp: Date;

  // 来源
  source: {
    ip: string;
    userAgent?: string;
    userId?: string;
    sessionId?: string;
  };

  // 目标
  target?: {
    resource: string;
    action: string;
  };

  // 详情
  details: Record<string, any>;

  // 关联
  correlationId?: string;
  relatedEvents?: string[];
}

// 安全事件类型
enum SecurityEventType {
  // 认证事件
  AUTH_LOGIN_SUCCESS = 'auth.login.success',
  AUTH_LOGIN_FAILURE = 'auth.login.failure',
  AUTH_LOGIN_LOCKOUT = 'auth.login.lockout',
  AUTH_MFA_SUCCESS = 'auth.mfa.success',
  AUTH_MFA_FAILURE = 'auth.mfa.failure',
  AUTH_TOKEN_EXPIRED = 'auth.token.expired',
  AUTH_TOKEN_INVALID = 'auth.token.invalid',

  // 授权事件
  AUTHZ_ACCESS_GRANTED = 'authz.access.granted',
  AUTHZ_ACCESS_DENIED = 'authz.access.denied',
  AUTHZ_PRIVILEGE_ESCALATION = 'authz.privilege.escalation',

  // 数据事件
  DATA_ACCESS = 'data.access',
  DATA_MODIFICATION = 'data.modification',
  DATA_DELETION = 'data.deletion',
  DATA_EXPORT = 'data.export',

  // 攻击事件
  ATTACK_SQL_INJECTION = 'attack.sql_injection',
  ATTACK_XSS = 'attack.xss',
  ATTACK_CSRF = 'attack.csrf',
  ATTACK_DOS = 'attack.dos',
  ATTACK_BRUTE_FORCE = 'attack.brute_force',
  ATTACK_PATH_TRAVERSAL = 'attack.path_traversal',

  // 合规事件
  COMPLIANCE_POLICY_VIOLATION = 'compliance.policy_violation',
  COMPLIANCE_DATA_BREACH = 'compliance.data_breach',
}

// SIEM转发器
class SIEMForwarder {
  private buffer: SecurityEvent[] = [];
  private flushInterval = 5000;

  async log(event: SecurityEvent): Promise<void> {
    this.buffer.push(event);

    if (this.buffer.length >= this.batchSize) {
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    // 发送到SIEM
    await Promise.all([
      this.sendToElasticsearch(events),
      this.sendToSplunk(events),
      this.sendToDatadog(events),
    ]);
  }
}
```

## 合规管理

### 合规框架配置

```typescript
// 合规框架
interface ComplianceFramework {
  name: string;                    // 'SOC2' | 'GDPR' | 'ISO27001' | 'HIPAA' | 'PCI-DSS'
  version: string;

  // 控制项
  controls: ComplianceControl[];
}

interface ComplianceControl {
  id: string;
  category: string;
  title: string;
  description: string;

  // 实现状态
  implementation: {
    status: 'implemented' | 'partial' | 'not_implemented' | 'not_applicable';
    evidence?: string[];
    lastReviewed?: Date;
    reviewedBy?: string;
  };

  // 自动化程度
  automation: 'automated' | 'manual' | 'hybrid';

  // 映射到安全措施
  securityMeasures: string[];

  // 审计信息
  audit?: {
    lastAuditDate?: Date;
    auditor?: string;
    result?: 'pass' | 'fail' | 'observation';
    findings?: string[];
  };
}

// SOC2合规控制
const SOC2_CONTROLS: ComplianceControl[] = [
  {
    id: 'CC1.1',
    category: 'Control Environment',
    title: 'Board and Management Oversight',
    description: 'Board and management demonstrate commitment to integrity and ethical values',
    implementation: { status: 'implemented' },
    automation: 'hybrid',
    securityMeasures: ['security_committee', 'code_of_conduct', 'security_training'],
  },
  {
    id: 'CC2.1',
    category: 'Communication',
    title: 'Internal Communication',
    description: 'Internal communication about security responsibilities',
    implementation: { status: 'implemented' },
    automation: 'automated',
    securityMeasures: ['slack_alerts', 'security_dashboard'],
  },
  {
    id: 'CC6.1',
    category: 'Logical Access',
    title: 'Logical Access Security',
    description: 'Logical access security measures to protect against unauthorized access',
    implementation: { status: 'implemented' },
    automation: 'automated',
    securityMeasures: ['authentication', 'authorization', 'mfa', 'session_management'],
  },
  {
    id: 'CC7.1',
    category: 'System Operations',
    title: 'System Operations',
    description: 'Operations to detect and prevent malware and unauthorized changes',
    implementation: { status: 'implemented' },
    automation: 'automated',
    securityMeasures: ['waf', 'ids', 'vulnerability_scanning', 'patch_management'],
  },
  {
    id: 'CC8.1',
    category: 'Change Management',
    title: 'Change Management',
    description: 'Change management processes to prevent unauthorized changes',
    implementation: { status: 'implemented' },
    automation: 'automated',
    securityMeasures: ['cicd_security', 'code_review', 'infrastructure_as_code'],
  },
];

// GDPR合规控制
const GDPR_CONTROLS: ComplianceControl[] = [
  {
    id: 'GDPR-Art.5',
    category: 'Principles',
    title: 'Data Processing Principles',
    description: 'Personal data shall be processed lawfully, fairly, and transparently',
    implementation: { status: 'implemented' },
    automation: 'hybrid',
    securityMeasures: ['data_classification', 'consent_management', 'privacy_notice'],
  },
  {
    id: 'GDPR-Art.32',
    category: 'Security',
    title: 'Security of Processing',
    description: 'Implement appropriate technical and organizational measures',
    implementation: { status: 'implemented' },
    automation: 'automated',
    securityMeasures: ['encryption', 'access_control', 'vulnerability_management'],
  },
];
```

## 渗透测试

### 渗透测试计划

```typescript
// 渗透测试配置
interface PenetrationTestPlan {
  id: string;
  name: string;
  scope: {
    targets: string[];
    excludedTargets?: string[];
    testTypes: ('blackbox' | 'greybox' | 'whitebox')[];
  };

  // 测试阶段
  phases: TestPhase[];

  // 规则
  rules: {
    startDate: Date;
    endDate: Date;
    maxRequestsPerSecond: number;
    criticalTestsRequireApproval: boolean;
  };

  // 应急联系
  emergencyContacts: {
    securityTeam: string;
    onCallEngineer: string;
    escalationPath: string[];
  };
}

interface TestPhase {
  name: string;
  order: number;
  tests: SecurityTest[];
}

interface SecurityTest {
  id: string;
  name: string;
  category: 'network' | 'application' | 'api' | 'social_engineering';
  description: string;
  methodology: string[];
  tools?: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  expectedDuration?: string;
}
```

## 配置示例

```yaml
# 安全加固配置
security:
  # 网络安全
  network:
    vpc_cidr: "10.0.0.0/16"
    enable_private_subnets: true
    security_groups:
      strict_egress: true
      default_deny: true

  # DDoS防护
  ddos_protection:
    enabled: true
    provider: "cloudflare"
    rate_limiting:
      requests_per_minute: 1000
      burst_size: 2000

  # 应用安全
  application:
    input_validation:
      enabled: true
      strict_mode: true
      sanitize_html: true

    csrf:
      enabled: true
      token_rotation: true

    cors:
      allowed_origins:
        - "https://projectfactory.ai"
        - "https://*.projectfactory.ai"
      allow_credentials: true

  # 认证安全
  authentication:
    password_policy:
      min_length: 12
      require_uppercase: true
      require_lowercase: true
      require_numbers: true
      require_special: true
      max_age_days: 90
      prevent_reuse: 12

    mfa:
      required_roles: ["admin", "org_admin"]
      allowed_methods: ["totp", "email"]

    brute_force_protection:
      enabled: true
      max_attempts: 5
      window_minutes: 15
      lockout_minutes: 30

  # 数据安全
  data:
    encryption:
      at_rest: true
      algorithm: "AES-256-GCM"
      key_management: "aws-kms"

    in_transit:
      tls_version: "1.3"
      cipher_suites:
        - "TLS_AES_256_GCM_SHA384"
        - "TLS_CHACHA20_POLY1305_SHA256"

    masking:
      enabled: true
      rules: "preset"

  # 漏洞扫描
  vulnerability_scanning:
    sast:
      enabled: true
      fail_on: "high"
    dast:
      enabled: true
      schedule: "weekly"
    dependency:
      enabled: true
      auto_fix: true
    container:
      enabled: true
      fail_on_critical: true

  # 合规
  compliance:
    frameworks:
      - "SOC2"
      - "GDPR"
    audit:
      schedule: "annual"
      last_audit: "2025-06-01"
```

---

**最后更新**: 2026-04-14
