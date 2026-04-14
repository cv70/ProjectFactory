# 零信任安全架构

## 1. 概述

本文档描述 ProjectFactory 系统的零信任安全架构，基于"永不信任，始终验证"的原则实现全面安全防护。

### 1.1 零信任原则

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           零信任架构原则                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    1. 验证始终                                               2. 最小权限                                              │
│    ┌─────────────────┐                           ┌─────────────────┐   │
│    │  永不信任        │                           │  按需授权       │   │
│    │  始终验证        │                           │  最小访问       │   │
│    │                  │                           │                  │   │
│    │ • 身份验证       │                           │ • RBAC/ABAC    │   │
│    │ • 设备验证       │                           │ • 即时权限     │   │
│    │ • 上下文验证     │                           │ • 会话策略     │   │
│    └─────────────────┘                           └─────────────────┘   │
│                                                                              │
│    3. 微分段隔离                                               4. 持续监控                                              │
│    ┌─────────────────┐                           ┌─────────────────┐   │
│    │  网络微分段     │                           │  始终监控       │   │
│    │  服务间认证     │                           │  永不停止       │   │
│    │                  │                           │                  │   │
│    │ • Service Mesh │                           │ • 行为分析     │   │
│    │ • mTLS         │                           │ • 威胁检测     │   │
│    │ • 东西向流量   │                           │ • 审计日志     │   │
│    └─────────────────┘                           └─────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 身份与访问管理

### 2.1 身份提供商

```yaml
# zero-trust/identity/provider.yaml
identity:
  provider: "keycloak"  # or "auth0", "okta", "cognito"

  # 用户身份
  users:
    source: "ldap"  # or "oidc", "database"
    ldap:
      url: "ldap://ldap.internal:389"
      baseDn: "dc=projectfactory,dc=com"
      userFilter: "(uid={0})"
      bindDn: "cn=admin,dc=projectfactory,dc=com"

  # 服务身份
  workloads:
    source: "kubernetes"
    serviceAccountIssuer: "https://projectfactory.svc"
    tokenAudience: "https://projectfactory.svc"

  # 设备身份
  devices:
    source: "jamf"  # or "intune", "ws1"
    MDM:
      enrolled: true
      compliant: true
```

### 2.2 强认证

```typescript
// zero-trust/auth/mfa-authenticator.ts
interface MFAMethod {
  type: 'totp' | 'webauthn' | 'sms' | 'email' | 'backup_code';
  priority: number;
  enabled: boolean;
}

class MFAAuthenticator {
  private methods: Map<string, MFAMethod> = new Map();

  // 注册 MFA 方法
  async registerMethod(
    userId: string,
    method: MFAMethod
  ): Promise<RegistrationResult> {
    switch (method.type) {
      case 'totp':
        return this.registerTOTP(userId);
      case 'webauthn':
        return this.registerWebAuthn(userId);
      case 'backup_code':
        return this.generateBackupCodes(userId);
    }
  }

  // TOTP 注册
  private async registerTOTP(userId: string): Promise<RegistrationResult> {
    const secret = crypto.randomBytes(20);
    const otpauth = this.generateOTPAuthURL(secret, userId);

    // 生成 QR 码
    const qrCode = await this.generateQRCode(otpauth);

    // 存储密钥哈希
    const secretHash = await this.hashSecret(secret);
    await this.storeSecret(userId, 'totp', secretHash);

    return {
      pendingVerification: true,
      qrCode,
      secret,
    };
  }

  // WebAuthn 注册
  private async registerWebAuthn(userId: string): Promise<RegistrationResult> {
    const credential = await this.webAuthn.createCredential({
      rp: {
        name: "ProjectFactory",
        id: "projectfactory.com",
      },
      user: {
        id: userId,
        name: await this.getUsername(userId),
        displayName: await this.getDisplayName(userId),
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },   // ES256
        { alg: -257, type: "public-key" }, // RS256
      ],
      attestation: "enterprise",
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "required",
      },
    });

    await this.storeWebAuthnCredential(userId, credential);

    return { pendingVerification: false };
  }

  // 验证 MFA
  async verifyMFA(
    userId: string,
    token: string,
    methodType: string
  ): Promise<boolean> {
    switch (methodType) {
      case 'totp':
        return this.verifyTOTP(userId, token);
      case 'webauthn':
        return this.verifyWebAuthn(userId, token);
      case 'backup_code':
        return this.verifyBackupCode(userId, token);
    }
  }
}
```

### 2.3 即时权限 (JIT)

```yaml
# zero-trust/auth/just-in-time-access.yaml
jit:
  # 特权访问管理
  privilegedAccess:
    enabled: true
    approval_workflow:
      - step: "manager_approval"
        timeout: 4h
        auto_approve: false
      - step: "security_approval"
        required_for:
          - admin
          - database
        timeout: 1h

    # 权限范围
    scope:
      - role: "db_admin"
        resources:
          - "arn:aws:rds:*:*:db:projectfactory-*"
          - "arn:aws:redshift:*:*:cluster:projectfactory-*"
        actions:
          - "rds:Describe*"
          - "rds:Modify*"
          - "redshift:Describe*"
        max_duration: 4h

      - role: "s3_admin"
        resources:
          - "arn:aws:s3:::projectfactory-*"
        actions:
          - "s3:*"
        max_duration: 2h

  # 紧急访问
  emergencyAccess:
    enabled: true
    break_glass:
      enabled: true
      procedure: "notify_security_team"
      auto_expire: 1h
      audit: true
```

---

## 3. 网络安全

### 3.1 网络分段

```yaml
# zero-trust/network/segments.yaml
networkSegments:
  # 信任区域
  trusted:
    cidr: "10.0.0.0/8"
    description: "内部网络"
    securityLevel: "high"

  # 半信任区域
  dmz:
    cidr: "10.1.0.0/16"
    description: "DMZ 区域"
    securityLevel: "medium"

  # 隔离区域
  isolated:
    cidr: "10.2.0.0/16"
    description: "高敏感工作负载"
    securityLevel: "critical"

  # 访客区域
  guest:
    cidr: "172.16.0.0/16"
    description: "访客网络"
    securityLevel: "low"

# 防火墙策略
firewall:
  default_policy: "deny"
  rules:
    - name: "allow-https"
      from: "trusted"
      to: "any"
      port: 443
      protocol: tcp

    - name: "allow-ssh-bastion"
      from: "trusted"
      to: "isolated"
      port: 22
      protocol: tcp
      condition:
        src_port: 22  # 只能从堡垒机跳转

    - name: "deny-internal-lateral"
      from: "dmz"
      to: "trusted"
      action: deny
```

### 3.2 服务网格双向 TLS

```yaml
# zero-trust/network/mtls-config.yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: projectfactory
spec:
  mtls:
    mode: STRICT  # 强制 mTLS，不允许明文

---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: idea-service-authz
  namespace: projectfactory
spec:
  selector:
    matchLabels:
      app: idea-service
  action: ALLOW
  rules:
    # 允许 API Gateway 访问
    - from:
        - source:
            principals:
              - "cluster.local/ns/projectfactory/sa/api-gateway"
      to:
        - operation:
            methods: ["GET", "POST"]
            paths: ["/api/v1/*"]

    # 允许内部服务访问
    - from:
        - source:
            principals:
              - "cluster.local/ns/projectfactory/sa/*"
      to:
        - operation:
            methods: ["*"]
            paths: ["/internal/*"]

    # 拒绝所有其他访问
    - to:
        - operation:
            paths: ["/*"]
```

### 3.3 应用层网关

```yaml
# zero-trust/network/app-gateway.yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: projectfactory-gateway
  namespace: projectfactory
spec:
  selector:
    istio: ingressgateway
  servers:
    - port:
        number: 443
        name: https
        protocol: HTTPS
      tls:
        mode: MUTUAL  # 双向 TLS
        credentialName: projectfactory-mtls-cert
        privateKey: /etc/certs/tls.key
        serverCertificate: /etc/certs/tls.crt
        caCertificates: /etc/certs/ca.crt
      hosts:
        - "*.projectfactory.com"
```

---

## 4. 设备信任

### 4.1 设备注册与状态

```typescript
// zero-trust/device/device-trust.ts
interface DeviceInfo {
  deviceId: string;
  platform: 'ios' | 'android' | 'windows' | 'macos' | 'linux';
  manufacturer: string;
  model: string;
  osVersion: string;
  enrolledAt: Date;
  lastSeen: Date;
  trustScore: number;
  securityPosture: SecurityPosture;
}

interface SecurityPosture {
  mdmEnrolled: boolean;
  mdmCompliant: boolean;
  diskEncrypted: boolean;
  screenLockEnabled: boolean;
  osUpToDate: boolean;
  hasAntiVirus: boolean;
  jailbroken: boolean;
}

class DeviceTrustEvaluator {
  // 评估设备信任等级
  async evaluateDevice(deviceId: string): Promise<DeviceTrustLevel> {
    const device = await this.getDeviceInfo(deviceId);
    const posture = await this.getSecurityPosture(device);

    const factors = [
      await this.checkMDMEnrollment(posture),
      await this.checkDiskEncryption(posture),
      await this.checkScreenLock(posture),
      await this.checkOSVersion(posture),
      await this.checkMalware(posture),
    ];

    const score = factors.reduce((sum, f) => sum + f.weight * f.passed, 0);

    return {
      deviceId,
      trustLevel: this.calculateTrustLevel(score),
      score,
      factors,
      evaluatedAt: new Date(),
    };
  }

  private calculateTrustLevel(score: number): 'untrusted' | 'trusted' | 'high' {
    if (score < 60) return 'untrusted';
    if (score < 85) return 'trusted';
    return 'high';
  }

  // 基于设备信任的访问控制
  async authorizeDeviceAccess(
    deviceId: string,
    resource: string
  ): Promise<AccessDecision> {
    const trust = await this.evaluateDevice(deviceId);

    if (trust.trustLevel === 'untrusted') {
      return {
        allowed: false,
        reason: 'Device trust level is too low',
        remediation: [
          'Enroll device in MDM',
          'Enable disk encryption',
          'Update to latest OS version',
        ],
      };
    }

    // 高敏感资源需要高信任等级
    if (this.isHighSensitivityResource(resource) && trust.trustLevel !== 'high') {
      return {
        allowed: false,
        reason: 'Resource requires high trust level',
        currentLevel: trust.trustLevel,
        requiredLevel: 'high',
      };
    }

    return { allowed: true };
  }
}
```

### 4.2 持续验证

```typescript
// zero-trust/device/continuous-verification.ts
class ContinuousDeviceVerifier {
  private verificationInterval = 300000; // 5 分钟
  private riskSignals: RiskSignal[] = [];

  // 风险信号收集
  async collectRiskSignals(deviceId: string): Promise<RiskSignal[]> {
    const signals: RiskSignal[] = [];

    // 位置变化
    const location = await this.getDeviceLocation(deviceId);
    signals.push({
      type: 'location_change',
      weight: 0.3,
      risk: await this.evaluateLocationRisk(location),
    });

    // 时间异常
    const accessTime = await this.getLastAccessTime(deviceId);
    signals.push({
      type: 'time_anomaly',
      weight: 0.2,
      risk: this.evaluateTimeRisk(accessTime),
    });

    // 设备修改
    const deviceModified = await this.checkDeviceModified(deviceId);
    signals.push({
      type: 'device_modified',
      weight: 0.4,
      risk: deviceModified ? 1.0 : 0,
    });

    // 网络变化
    const networkChanged = await this.checkNetworkChange(deviceId);
    signals.push({
      type: 'network_change',
      weight: 0.2,
      risk: networkChanged ? 0.5 : 0,
    });

    return signals;
  }

  // 实时风险评估
  async assessRealTimeRisk(deviceId: string): Promise<RiskScore> {
    const signals = await this.collectRiskSignals(deviceId);
    const totalRisk = signals.reduce((sum, s) => sum + s.weight * s.risk, 0);

    if (totalRisk > 0.7) {
      await this.triggerReverification(deviceId);
    }

    if (totalRisk > 0.9) {
      await this.terminateSession(deviceId);
    }

    return {
      deviceId,
      score: totalRisk,
      signals,
      action: this.determineAction(totalRisk),
      assessedAt: new Date(),
    };
  }
}
```

---

## 5. 应用安全

### 5.1 最小权限应用

```yaml
# zero-trust/app/permissions-policy.yaml
# IAM 权限边界
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/${aws:PrincipalTag/ProjectTable}",
        "arn:aws:dynamodb:*:*:table/${aws:PrincipalTag/ProjectTable}/index/*"
      ],
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:Attributes": [
            "id",
            "title",
            "status",
            "createdAt"
          ]
        }
      }
    }
  ]
}

# 应用沙箱策略
sandbox:
  seccompProfile:
    type: RuntimeDefault
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL
  privileged: false
```

### 5.2 应用内授权

```typescript
// zero-trust/app/in-app-authz.ts
interface Permission {
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
}

class InAppAuthorizer {
  // 资源级权限检查
  async checkPermission(
    user: User,
    resource: Resource,
    action: string
  ): Promise<boolean> {
    // 获取用户权限
    const permissions = await this.getUserPermissions(user.id);

    // 检查权限
    for (const perm of permissions) {
      if (this.matchesResource(perm.resource, resource) &&
          perm.actions.includes(action) &&
          this.evaluateConditions(perm.conditions, user, resource)) {
        return true;
      }
    }

    return false;
  }

  // 行级安全
  async checkRowLevelAccess(
    user: User,
    rows: any[],
    action: 'read' | 'write' | 'delete'
  ): Promise<any[]> {
    const filtered = [];

    for (const row of rows) {
      if (await this.evaluateRowPolicy(user, row, action)) {
        filtered.push(row);
      }
    }

    return filtered;
  }

  private async evaluateRowPolicy(
    user: User,
    row: any,
    action: string
  ): Promise<boolean> {
    // 用户只能读写自己的数据
    if (row.userId === user.id) return true;

    // 管理员可以读写所有
    if (user.roles.includes('admin')) return true;

    // 共享数据
    if (row.sharedWith?.includes(user.id)) {
      return action === 'read'; // 共享只读
    }

    return false;
  }
}
```

---

## 6. 数据安全

### 6.1 数据分类

```yaml
# zero-trust/data/classification.yaml
dataClassification:
  # 公开数据
  public:
    color: "green"
    encryption: false
    accessControl: "none"
    examples:
      - "Public documentation"
      - "Marketing materials"

  # 内部数据
  internal:
    color: "blue"
    encryption: true
    accessControl: "authenticated"
    examples:
      - "Internal announcements"
      - "Team documentation"

  # 敏感数据
  sensitive:
    color: "yellow"
    encryption: true
    accessControl: "role_based"
    requiresMFA: true
    examples:
      - "User personal information"
      - "Project metadata"

  # 机密数据
  confidential:
    color: "orange"
    encryption: true
    accessControl: "explicit_grant"
    requiresMFA: true
    requiresApproval: true
    auditRequired: true
    examples:
      - "API keys"
      - "User credentials"
      - "Financial data"

  # 绝密数据
  restricted:
    color: "red"
    encryption: true
    accessControl: "just_in_time"
    requiresMFA: true
    requiresApproval: true
    auditRequired: true
    timeLimited: true
    examples:
      - "Database credentials"
      - "Infrastructure secrets"
```

### 6.2 数据丢失防护 (DLP)

```typescript
// zero-trust/data/dlp-engine.ts
interface DLPRule {
  id: string;
  name: string;
  priority: number;
  patterns: Pattern[];
  actions: DLPAction[];
  appliesTo: 'upload' | 'download' | 'email' | 'api';
}

interface Pattern {
  type: 'regex' | 'keyword' | 'file_type' | 'sensitive_field';
  value: string;
  confidence: 'low' | 'medium' | 'high';
}

interface DLPAction {
  type: 'block' | 'warn' | 'allow' | 'quarantine';
  notify?: string[];
  log?: boolean;
}

class DLPEngine {
  private rules: DLPRule[] = [];

  // 检测敏感数据
  async scanContent(
    content: string | Buffer,
    context: ScanContext
  ): Promise<DLPResult> {
    const matches: DLPMatch[] = [];

    for (const rule of this.rules.sort((a, b) => b.priority - a.priority)) {
      if (!this.ruleApplies(rule, context)) continue;

      for (const pattern of rule.patterns) {
        const found = await this.scanPattern(content, pattern);
        if (found) {
          matches.push({
            rule: rule.name,
            pattern,
            location: found.location,
            masked: this.maskSensitiveData(found.value, pattern),
          });
        }
      }
    }

    return {
      clean: matches.length === 0,
      matches,
      action: this.determineAction(matches),
    };
  }

  // 扫描文件
  async scanFile(
    file: FileUpload,
    context: ScanContext
  ): Promise<DLPResult> {
    // 1. 检查文件类型
    if (this.isBlockedFileType(file.type)) {
      return {
        clean: false,
        matches: [{
          rule: 'file_type_block',
          pattern: { type: 'file_type', value: file.type, confidence: 'high' },
          location: 'filename',
          masked: file.name,
        }],
        action: { type: 'block', notify: ['security'] },
      };
    }

    // 2. 扫描文件名
    const filenameResult = await this.scanContent(file.name, context);
    if (!filenameResult.clean) {
      return filenameResult;
    }

    // 3. 扫描文件内容
    const content = await this.extractContent(file);
    return this.scanContent(content, context);
  }

  private maskSensitiveData(value: string, pattern: Pattern): string {
    switch (pattern.type) {
      case 'regex':
        // 保留前两位和后四位
        return value.replace(/.(?=.{4})/g, '*');
      case 'keyword':
        return '[REDACTED]';
      default:
        return value;
    }
  }
}
```

---

## 7. 持续监控

### 7.1 安全态势感知

```yaml
# zero-trust/monitoring/security-posture.yaml
securityPosture:
  # 用户行为分析 (UEBA)
  ueba:
    enabled: true
    baseline_window: 30d
    anomaly_threshold: 3.0  # 标准差倍数

    risk_indicators:
      - name: impossible_travel
        description: "不可能的旅行"
        weight: 0.8
        conditions:
          - location_change > 500km
          - time_delta < 2h

      - name: unusual_access_pattern
        description: "异常访问模式"
        weight: 0.6
        conditions:
          - access_outside_business_hours
          - failed_login_attempts > 5

      - name: bulk_data_access
        description: "批量数据访问"
        weight: 0.5
        conditions:
          - data_volume > 10000 records
          - access_frequency > 100/minute

  # 实时告警
  alerts:
    - name: privileged_account_usage
      severity: high
      conditions:
        - action: "role_assigned"
          target: "admin"
      notify:
        - security_team
        - manager

    - name: data_exfiltration
      severity: critical
      conditions:
        - data_classification: "confidential"
          action: "download"
          volume: "> 100MB"
      notify:
        - security_team
        - dlp_team

    - name: anomalous_location
      severity: medium
      conditions:
        - impossible_travel: true
      notify:
        - security_team
```

### 7.2 威胁检测

```typescript
// zero-trust/monitoring/threat-detection.ts
interface ThreatIndicator {
  type: 'ioc' | 'ioa' | 'behavior';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
  MITRE_TTP?: string[];
}

class ThreatDetector {
  private models: Map<string, MLModel> = new Map();

  // 异常检测
  async detectAnomalies(
    userId: string,
    activities: Activity[]
  ): Promise<ThreatIndicator[]> {
    const indicators: ThreatIndicator[] = [];

    // 统计异常
    const statistical = await this.detectStatisticalAnomalies(activities);
    indicators.push(...statistical);

    // 序列异常
    const sequential = await this.detectSequentialAnomalies(activities);
    indicators.push(...sequential);

    // 机器学习异常
    const mlAnomalies = await this.detectMLAnomalies(userId, activities);
    indicators.push(...mlAnomalies);

    // 关联分析
    const correlated = await this.correlateIndicators(indicators);
    if (correlated.length > 0) {
      return [this.createCompoundIndicator(correlated)];
    }

    return indicators;
  }

  // 统计异常检测
  private async detectStatisticalAnomalies(
    activities: Activity[]
  ): Promise<ThreatIndicator[]> {
    const indicators: ThreatIndicator[] = [];

    // 计算基线
    const baseline = await this.getUserBaseline(activities[0].userId);

    // 检查访问频率
    const accessFrequency = this.calculateFrequency(activities);
    if (accessFrequency > baseline.frequency * 3) {
      indicators.push({
        type: 'behavior',
        severity: 'medium',
        confidence: 0.7,
        description: `访问频率异常: ${accessFrequency} vs 基线 ${baseline.frequency}`,
      });
    }

    // 检查访问时间
    const timeAnomaly = this.detectTimeAnomaly(activities, baseline);
    if (timeAnomaly) {
      indicators.push(timeAnomaly);
    }

    return indicators;
  }

  // MITRE ATT&CK 映射
  private mapToMITRE(indicator: ThreatIndicator): string[] {
    const mapping: Record<string, string[]> = {
      'unusual_access_pattern': ['T1078', 'T1078.004'], // 有效账户滥用
      'impossible_travel': ['T1530', 'T1070'], // 数据收集/修改
      'bulk_data_access': ['T1039', 'T1041'], // 数据泄露
    };

    return mapping[indicator.type] || [];
  }
}
```

---

## 8. 事件响应

### 8.1 安全编排自动化 (SOAR)

```yaml
# zero-trust/incident/soar-playbooks.yaml
playbooks:
  # 凭据泄露响应
  credential_compromise:
    trigger:
      conditions:
        - alert_type: "credential_compromise"
        - severity: "high"

    steps:
      - name: "隔离受影响账户"
        action: "disable_user_account"
        target: "{{alert.user_id}}"

      - name: "撤销所有会话"
        action: "revoke_all_sessions"
        target: "{{alert.user_id}}"

      - name: "轮换密码"
        action: "force_password_reset"
        target: "{{alert.user_id}}"

      - name: "阻止相关 IP"
        action: "block_ip"
        target: "{{alert.source_ip}}"

      - name: "创建事件记录"
        action: "create_incident"
        params:
          title: "凭据泄露 - {{alert.user_id}}"
          severity: "high"
          assignee: "security_team"

      - name: "通知安全团队"
        action: "send_notification"
        params:
          channel: "#security-alerts"
          message: "凭据泄露事件: {{alert.user_id}}"

      - name: "收集日志"
        action: "collect_logs"
        params:
          timeframe: "24h"
          sources:
            - "auth_logs"
            - "api_logs"
            - "cloudtrail"

    recovery:
      - name: "确认修复"
        action: "verify_account_secure"
        target: "{{alert.user_id}}"

      - name: "更新事件状态"
        action: "close_incident"
```

### 8.2 隔离与遏制

```bash
#!/bin/bash
# zero-trust/incident/containment.sh

set -e

echo "Starting containment procedure..."

# 1. 隔离用户
isolate_user() {
    local USER_ID=$1

    echo "[1] Isolating user: $USER_ID"

    # 禁用账户
    aws iam update-user --user-name "$USER_ID" --no-enable

    # 撤销所有访问密钥
    aws iam delete-access-key --user-name "$USER_ID" --access-key-id ALL

    # 更新密码
    aws iam update-login-profile --user-name "$USER_ID" --no-password-reset-required

    # 撤销 SAML 令牌
    aws iam delete-login-profile --user-name "$USER_ID"
}

# 2. 隔离主机
isolate_host() {
    local HOST_ID=$1

    echo "[2] Isolating host: $HOST_ID"

    # 从负载均衡器移除
    aws elbv2 deregister-targets \
        --target-group-arn "$TG_ARN" \
        --targets "$HOST_ID"

    # 隔离到专用 VLAN
    aws ec2 modify-instance-attribute \
        --instance-id "$HOST_ID" \
        --groups "$ISOLATION_SECURITY_GROUP"
}

# 3. 阻止 IP
block_ip() {
    local IP=$1

    echo "[3] Blocking IP: $IP"

    # 添加到 WAF 阻止列表
    aws wafv2 update-ip-set \
        --id "$IP_SET_ID" \
        --scope CLOUDFRONT \
        --addresses "$IP/32" \
        --lock-token "$LOCK_TOKEN"
}

# 4. 收集证据
collect_evidence() {
    local EVIDENCE_DIR="/incident/$INCIDENT_ID/evidence"

    echo "[4] Collecting evidence to: $EVIDENCE_DIR"

    mkdir -p "$EVIDENCE_DIR"

    # CloudTrail 日志
    aws cloudtrail lookup-events \
        --lookup-attributes AttributeKey=Username,AttributeValue="$USER_ID" \
        --output json > "$EVIDENCE_DIR/cloudtrail.json"

    # VPC Flow Logs
    aws ec2 get-flow-logs \
        --filter "Name=interface-id,Values=$INSTANCE_ID" \
        --output json > "$EVIDENCE_DIR/vpc-flow.json"

    # CloudWatch 日志
    aws logs filter-log-events \
        --log-group-name "/aws/lambda/$FUNCTION_NAME" \
        --filter-pattern "$USER_ID" \
        --output json > "$EVIDENCE_DIR/cloudwatch.json"
}

echo "Containment completed"
```

---

## 9. 相关文档

- [安全设计](./SECURITY_DESIGN.md)
- [安全加固指南](./SECURITY_HARDENING.md)
- [审计日志与合规](./AUDIT_LOGGING_COMPLIANCE.md)
- [端到端加密](./END_TO_END_ENCRYPTION.md)

---

**最后更新**: 2026-04-14
