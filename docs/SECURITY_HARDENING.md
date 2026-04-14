# 安全加固指南

## 1. 概述

本文档提供 ProjectFactory 系统的安全加固指南，确保生产环境部署符合安全最佳实践。

### 1.1 加固策略总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            安全加固层次                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  第一层：网络安全                                                      │   │
│  │  • 防火墙配置    • 网络分段    • TLS 加密    • DDoS 防护              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  第二层：主机安全                                                      │   │
│  │  • 系统加固      • 权限最小化   • 入侵检测    • 安全更新              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  第三层：应用安全                                                      │   │
│  │  • 输入验证      • 输出编码      • 会话管理    • 敏感数据保护          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  第四层：运维安全                                                      │   │
│  │  • 密钥管理      • 审计日志      • 威胁监测    • 应急响应              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 系统加固

### 2.1 Linux 系统加固

```bash
#!/bin/bash
# security/hardening/system-hardening.sh

set -e

echo "开始系统安全加固..."

# 1. 更新系统
echo "[1/20] 更新系统包..."
apt-get update && apt-get upgrade -y

# 2. 安装安全工具
echo "[2/20] 安装安全工具..."
apt-get install -y \
    fail2ban \
    ufw \
    auditd \
    rsyslog \
    libpam-pwquality \
    clamav \
    tripwire

# 3. 禁用不必要的服务
echo "[3/20] 禁用不必要的服务..."
systemctl stop avahi-daemon
systemctl disable avahi-daemon
systemctl stop cups
systemctl disable cups
systemctl stop rpcbind
systemctl disable rpcbind

# 4. 配置防火墙
echo "[4/20] 配置防火墙 (UFW)..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

# 5. SSH 加固
echo "[5/20] 加固 SSH..."
cat > /etc/ssh/sshd_config.d/hardening.conf << 'EOF'
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
AllowTcpForwarding no
PermitEmptyPasswords no
Protocol 2
LoginGraceTime 60
EOF

systemctl reload sshd

# 6. 配置密码策略
echo "[6/20] 配置密码策略..."
cat >> /etc/pam.d/common-password << 'EOF'
password requisite pam_pwquality.so retry=3 minlen=16 ucredit=-1 lcredit=-1 dcredit=-1 ocredit=-1
EOF

# 7. 配置审计规则
echo "[7/20] 配置审计规则..."
cat >> /etc/audit/audit.rules << 'EOF'
# 审计密码修改
-w /etc/passwd -p wa -k identity
-w /etc/group -p wa -k identity
-w /etc/shadow -p wa -k identity
# 审计网络配置
-w /etc/sysctl.conf -p wa -k network
# 审计 SSH 配置
-w /etc/ssh/sshd_config -p wa -k sshd_config
EOF

systemctl restart auditd

# 8. 配置日志
echo "[8/20] 配置远程日志..."
cat >> /etc/rsyslog.conf << 'EOF'
*.* @@logserver.example.com:514
EOF

systemctl restart rsyslog

# 9. 禁用 ICMP 重定向
echo "[9/20] 禁用 ICMP 重定向..."
echo "net.ipv4.conf.all.accept_redirects = 0" >> /etc/sysctl.conf
echo "net.ipv6.conf.all.accept_redirects = 0" >> /etc/sysctl.conf
sysctl -p

# 10. 启用 ASLR
echo "[10/20] 启用 ASLR..."
echo "kernel.randomize_va_space = 2" >> /etc/sysctl.conf
sysctl -p

echo "系统加固完成!"
```

### 2.2 Docker 安全加固

```yaml
# security/docker/Dockerfile
FROM node:20-alpine AS builder

# 构建阶段
WORKDIR /build
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 运行阶段
FROM node:20-alpine

# 创建非 root 用户
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

# 从构建阶段复制
COPY --from=builder --chown=appuser:appgroup /build/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /build/dist ./dist

# 设置只读文件系统
RUN chown -R appuser:appgroup /app && \
    chmod -R 500 /app

USER appuser

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

EXPOSE 3001

# 使用 distroless 镜像运行
ENTRYPOINT ["node", "dist/main.js"]
```

```yaml
# security/docker/docker-compose-prod.yml
version: '3.9'

services:
  backend:
    image: projectfactory/backend:latest
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
      - /var/run
   Cap_drop:
      - ALL
    networks:
      - backend_network
    secrets:
      - db_password
      - redis_password
    ulimits:
      nproc: 50
      nofile:
        soft: 65536
        hard: 65536
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  frontend:
    image: projectfactory/frontend:latest
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
    Cap_drop:
      - ALL
    networks:
      - frontend_network
    restart: unless-stopped

networks:
  backend_network:
    driver: bridge
    internal: true
  frontend_network:
    driver: bridge

secrets:
  db_password:
    file: ./secrets/db_password.txt
  redis_password:
    file: ./secrets/redis_password.txt
```

---

## 3. 应用安全

### 3.1 输入验证

```typescript
// src/middleware/input-validation.ts
import { z } from 'zod';
import { createSanitizer, sanitizeHTML, sanitizeFilename } from 'sanitize-lib';

const sanitizer = createSanitizer({
  allowAttributes: ['href', 'src', 'alt', 'title'],
  allowTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3'],
  allowProtocols: ['https', 'mailto'],
});

// Idea 创建验证
const createIdeaSchema = z.object({
  title: z.string()
    .min(1, '标题不能为空')
    .max(200, '标题不能超过 200 字符')
    .transform(val => sanitizer.sanitize(val)),

  description: z.string()
    .max(5000, '描述不能超过 5000 字符')
    .transform(val => sanitizer.sanitize(val)),

  tags: z.array(z.string())
    .max(10, '最多 10 个标签')
    .transform(tags => tags.map(tag => sanitizeFilename(tag).slice(0, 50))),

  type: z.enum(['web-app', 'cli-tool', 'library', 'api-service'])
    .optional()
    .default('web-app'),
});

// 项目创建验证
const createProjectSchema = z.object({
  ideaId: z.string().uuid(),

  name: z.string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9-_]+$/, '名称只能包含字母、数字、下划线和连字符')
    .transform(val => val.toLowerCase()),

  type: z.enum(['web-app', 'cli-tool', 'library', 'api-service']),

  config: z.object({
    language: z.enum(['typescript', 'javascript', 'python', 'go', 'rust']),
    framework: z.string().optional(),
    features: z.array(z.string()).max(50),
  }),
});

export const validateInput = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: '输入验证失败',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
};
```

### 3.2 敏感数据保护

```typescript
// src/utils/data-protection.ts
import crypto from 'crypto';

// 字段级加密
interface EncryptionConfig {
  algorithm: string;
  keyDerivation: string;
  iterations: number;
}

class DataProtectionService {
  private encryptionKey: Buffer;
  private config: EncryptionConfig = {
    algorithm: 'aes-256-gcm',
    keyDerivation: 'pbkdf2',
    iterations: 100000,
  };

  constructor(masterKey: string) {
    // 从主密钥派生加密密钥
    const salt = crypto.createHash('sha256').update('projectfactory-salt').digest();
    this.encryptionKey = crypto.pbkdf2Sync(
      masterKey,
      salt,
      this.config.iterations,
      32,
      'sha256'
    );
  }

  // 加密敏感字段
  encryptField(plaintext: string): EncryptedField {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.config.algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm: this.config.algorithm,
    };
  }

  // 解密敏感字段
  decryptField(field: EncryptedField): string {
    const decipher = crypto.createDecipheriv(
      field.algorithm,
      this.encryptionKey,
      Buffer.from(field.iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(field.authTag, 'hex'));

    let decrypted = decipher.update(field.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // 数据脱敏
  maskSensitiveData(data: any, fields: string[]): any {
    const masked = { ...data };

    for (const field of fields) {
      if (masked[field]) {
        masked[field] = this.maskString(masked[field]);
      }
    }

    return masked;
  }

  private maskString(str: string): string {
    if (str.length <= 4) return '****';

    const visibleChars = 2;
    const maskedLength = str.length - (visibleChars * 2);

    return (
      str.slice(0, visibleChars) +
      '*'.repeat(Math.min(maskedLength, 8)) +
      str.slice(-visibleChars)
    );
  }
}

// API 密钥处理
class APIKeyService {
  private keyPrefix = 'pf_';
  private keyLength = 32;

  generateAPIKey(): string {
    const randomBytes = crypto.randomBytes(this.keyLength);
    return this.keyPrefix + randomBytes.toString('base64url');
  }

  hashAPIKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  verifyAPIKey(apiKey: string, storedHash: string): boolean {
    const hash = this.hashAPIKey(apiKey);
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
  }
}
```

### 3.3 会话管理

```typescript
// src/middleware/session.ts
import { randomBytes, timingSafeEqual } from 'crypto';

interface SessionConfig {
  secret: string;
  maxAge: number;
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'strict' | 'lax' | 'none';
}

class SessionManager {
  private sessions: Map<string, SessionData> = new Map();
  private config: SessionConfig;

  constructor(config: SessionConfig) {
    this.config = config;

    // 定期清理过期会话
    setInterval(() => this.cleanup(), 60000);
  }

  createSession(userId: string, metadata: SessionMetadata): string {
    const sessionId = this.generateSessionId();
    const session: SessionData = {
      id: sessionId,
      userId,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      metadata,
      factorsVerified: metadata.mfaEnabled ? [] : ['password'],
    };

    this.sessions.set(sessionId, session);

    return sessionId;
  }

  validateSession(sessionId: string): SessionData | null {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    // 检查过期
    if (Date.now() - session.lastAccessedAt > this.config.maxAge) {
      this.sessions.delete(sessionId);
      return null;
    }

    // 更新最后访问时间
    session.lastAccessedAt = Date.now();

    return session;
  }

  invalidateSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  // 升级认证级别 (MFA)
  upgradeSession(sessionId: string, factor: string): boolean {
    const session = this.sessions.get(sessionId);

    if (!session) return false;

    if (!session.factorsVerified.includes(factor)) {
      session.factorsVerified.push(factor);
      session.lastAccessedAt = Date.now();
    }

    return true;
  }

  private generateSessionId(): string {
    return randomBytes(32).toString('base64url');
  }

  private cleanup(): void {
    const now = Date.now();

    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastAccessedAt > this.config.maxAge) {
        this.sessions.delete(id);
      }
    }
  }
}

// HTTP 安全头
export const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};
```

---

## 4. 密钥管理

### 4.1 密钥轮换策略

```typescript
// src/security/key-rotation.ts
interface KeyVersion {
  version: number;
  keyId: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'active' | 'rotating' | 'expired';
}

class KeyRotationService {
  private activeKeys: Map<string, KeyVersion> = new Map();
  private keyStore: KeyStore;
  private rotationInterval = 90 * 24 * 60 * 60 * 1000; // 90 天

  async rotateKey(keyType: string): Promise<KeyRotationResult> {
    const currentKey = this.activeKeys.get(keyType);

    // 创建新版本
    const newVersion: KeyVersion = {
      version: (currentKey?.version || 0) + 1,
      keyId: crypto.randomUUID(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.rotationInterval * 2),
      status: 'active',
    };

    // 生成新密钥
    const newKey = await this.generateKey(keyType, newVersion);

    // 如果有旧密钥，标记为轮换中
    if (currentKey) {
      currentKey.status = 'rotating';
      currentKey.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 天宽限期
    }

    // 存储新密钥
    await this.keyStore.store(keyType, newVersion.keyId, newKey);

    // 更新活跃密钥
    this.activeKeys.set(keyType, newVersion);

    // 调度旧密钥作废
    this.scheduleKeyExpiration(keyType, currentKey?.keyId);

    return {
      keyId: newVersion.keyId,
      version: newVersion.version,
      rotationRequired: !!currentKey,
    };
  }

  // 获取当前密钥 (支持多版本并行)
  async getKeys(keyType: string): Promise<string[]> {
    const keys: string[] = [];
    const active = this.activeKeys.get(keyType);

    if (active) {
      keys.push(await this.keyStore.retrieve(keyType, active.keyId));
    }

    // 也返回轮换中的密钥
    const rotating = Array.from(this.activeKeys.values())
      .filter(k => k.status === 'rotating' && k.keyId.startsWith(keyType));

    for (const key of rotating) {
      if (Date.now() < key.expiresAt.getTime()) {
        keys.push(await this.keyStore.retrieve(keyType, key.keyId));
      }
    }

    return keys;
  }

  // 验证消息使用任意有效密钥
  async verifyWithAnyKey(
    keyType: string,
    message: string,
    signature: string
  ): Promise<boolean> {
    const keys = await this.getKeys(keyType);

    for (const key of keys) {
      if (await this.verifySignature(key, message, signature)) {
        return true;
      }
    }

    return false;
  }

  private async scheduleKeyExpiration(keyType: string, keyId?: string): Promise<void> {
    if (!keyId) return;

    const key = Array.from(this.activeKeys.values())
      .find(k => k.keyId === keyId && k.status === 'rotating');

    if (!key) return;

    const delay = key.expiresAt.getTime() - Date.now();

    setTimeout(async () => {
      await this.keyStore.delete(keyType, keyId);
      this.activeKeys.delete(keyType);
    }, delay);
  }
}
```

### 4.2 密钥存储

```yaml
# security/vault-config.hcl
# Vault 配置

storage "raft" {
  path = "/var/lib/vault/data"
  node_id = "node1"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = "false"
  tls_cert_file = "/etc/vault/tls/server.crt"
  tls_key_file = "/etc/vault/tls/server.key"
  tls_client_ca_file = "/etc/vault/tls/ca.crt"
}

seal "transit" {
  address = "https://vault-ha:8200"
  token = ""
  disable_regeneration = true
}

api_addr         = "https://vault:8200"
cluster_addr     = "https://vault:8201"
ui               = true
max_lease_ttl     = "768h"
default_lease_ttl = "768h"
```

```bash
# 初始化 Vault
vault operator init \
    -key-shares=5 \
    -key-threshold=3 \
    -format=json > vault-init.json

# 解封 Vault
vault operator unseal

# 创建加密密钥
vault secrets enable -path=secret kv-v2

# 创建策略
vault policy write projectfactory - << 'EOF'
path "secret/data/projectfactory/*" {
  capabilities = ["read", "list"]
}

path "secret/data/projectfactory/db" {
  capabilities = ["read"]
}

path "secret/data/projectfactory/llm" {
  capabilities = ["read"]
}
EOF

# 配置 Kubernetes 认证
vault auth enable kubernetes

vault write auth/kubernetes/config \
    token_reviewer_jwt="$(cat /var/run/secrets/token.jwt)" \
    kubernetes_host="https://$KUBERNETES_PORT_443_TCP_ADDR:443" \
    kubernetes_ca_cert=@/var/run/secrets/service-account.crt
```

---

## 5. 威胁检测

### 5.1 入侵检测规则

```yaml
# security/suricata/rules/projectfactory.rules
# SQL 注入检测
alert tcp any any -> $HOME_NET any (
    msg:"SQL Injection Attempt - UNION SELECT";
    content:"UNION";
    content:"SELECT";
    pcre:"/(?i)(union\s+(all\s+)?select)/";
    flow:to_server;
    sid:1000001;
    rev:1;
)

# XSS 攻击检测
alert http any any -> $HOME_NET any (
    msg:"XSS Attack - Script Tag";
    content:"<script";
    content:"java";
    pcre:"/(?i)<script[^>]*>[\s\S]*?<\/script>/";
    flow:to_server;
    sid:1000002;
    rev:1;
)

# 路径遍历检测
alert http any any -> $HOME_NET any (
    msg:"Path Traversal Attempt";
    content:"..";
    content:"etc";
    pcre:"/(?i)\.\.\/|\.\.%2f|\.\.%5c/";
    flow:to_server;
    sid:1000003;
    rev:1;
)

# 暴力破解检测
alert ssh any any -> $HOME_NET 22 (
    msg:"SSH Brute Force Attempt";
    threshold:type threshold, track by_src, count 5, seconds 60;
    flow:to_server;
    sid:1000004;
    rev:1;
)

# API 滥用检测
alert http any any -> $HOME_NET $HTTP_PORTS (
    msg:"API Rate Limit Exceeded";
    threshold:type limit, track by_src, seconds 60, count 100;
    content:"GET";
    content:"/api/";
    flow:to_server;
    sid:1000005;
    rev:1;
)
```

### 5.2 WAF 规则

```yaml
# security/modsecurity/crs/projectfactory.conf
# 模块化安全规则集

# 启用 OWASP Core Rule Set
Include /etc/modsecurity/crs/crs-setup.conf
Include /etc/modsecurity/crs/rules/*.conf

# 自定义规则

# 阻止可疑请求
SecRule REQUEST_HEADERS:User-Agent "@pmFromFile bad-user-agents.txt" \
    "id:9001,\
    phase:1,\
    deny,\
    status:403,\
    msg:'Blocked User-Agent'"

# 限制请求大小
SecRule REQUEST_BODY_LENGTH "@gt 10485760" \
    "id:9002,\
    phase:2,\
    deny,\
    status:413,\
    msg:'Request body too large'"

# 保护 API 端点
SecRule REQUEST_URI "@beginsWith /api/" \
    "id:9003,\
    phase:1,\
    chain,\
    msg:'API Protection'"
SecRule REQUEST_METHOD "!@pmAllowedMethods GET POST PUT DELETE PATCH" \
    "t:lowercase"

# SQL 注入保护
SecRule ARGS "@rx (?i)(union\s+select|insert\s+into|delete\s+from|drop\s+table|exec\s*\()" \
    "id:9004,\
    phase:2,\
    deny,\
    status:400,\
    msg:'SQL Injection Attempt'"
```

---

## 6. 安全审计

### 6.1 审计日志格式

```typescript
// src/security/audit-logger.ts
interface AuditEvent {
  timestamp: string;
  eventId: string;
  eventType: AuditEventType;
  actor: {
    id: string;
    type: 'user' | 'system' | 'api-key';
    ip?: string;
    userAgent?: string;
  };
  resource: {
    type: string;
    id: string;
    name?: string;
  };
  action: {
    type: string;
    result: 'success' | 'failure' | 'denied';
    details?: Record<string, any>;
  };
  context: {
    service: string;
    correlationId?: string;
    traceId?: string;
  };
}

enum AuditEventType {
  // 认证事件
  AUTH_LOGIN_SUCCESS = 'auth.login.success',
  AUTH_LOGIN_FAILED = 'auth.login.failed',
  AUTH_LOGOUT = 'auth.logout',
  AUTH_MFA_VERIFIED = 'auth.mfa.verified',
  AUTH_TOKEN_REFRESHED = 'auth.token.refreshed',

  // 授权事件
  ACCESS_GRANTED = 'access.granted',
  ACCESS_DENIED = 'access.denied',
  PERMISSION_CHANGED = 'permission.changed',

  // 数据事件
  DATA_CREATED = 'data.created',
  DATA_READ = 'data.read',
  DATA_UPDATED = 'data.updated',
  DATA_DELETED = 'data.deleted',
  DATA_EXPORTED = 'data.exported',

  // 安全事件
  SECURITY_VIOLATION = 'security.violation',
  RATE_LIMIT_EXCEEDED = 'security.rate_limit.exceeded',
  SUSPICIOUS_ACTIVITY = 'security.suspicious',
}

class AuditLogger {
  constructor(
    private storage: AuditStorage,
    private alertService: AlertService
  ) {}

  async log(event: AuditEvent): Promise<void> {
    // 添加审计标识
    const enrichedEvent: AuditEvent = {
      ...event,
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    // 存储事件
    await this.storage.write(enrichedEvent);

    // 检查是否需要告警
    if (this.isSecurityEvent(enrichedEvent)) {
      await this.alertService.sendSecurityAlert(enrichedEvent);
    }
  }

  private isSecurityEvent(event: AuditEvent): boolean {
    const securityTypes = [
      AuditEventType.AUTH_LOGIN_FAILED,
      AuditEventType.ACCESS_DENIED,
      AuditEventType.SECURITY_VIOLATION,
      AuditEventType.RATE_LIMIT_EXCEEDED,
      AuditEventType.SUSPICIOUS_ACTIVITY,
    ];

    return securityTypes.includes(event.eventType);
  }
}

// 查询审计日志
async function queryAuditLogs(
  filters: {
    startDate?: Date;
    endDate?: Date;
    eventTypes?: AuditEventType[];
    actorId?: string;
    resourceType?: string;
  },
  pagination: { page: number; pageSize: number }
): Promise<PaginatedResult<AuditEvent>> {
  return await auditStorage.query(filters, pagination);
}
```

---

## 7. 相关文档

- [安全设计](./SECURITY_DESIGN.md)
- [端到端加密](./END_TO_END_ENCRYPTION.md)
- [审计日志与合规](./AUDIT_LOGGING_COMPLIANCE.md)
- [运维手册](./OPERATIONAL_RUNBOOK.md)

---

**最后更新**: 2026-04-14
