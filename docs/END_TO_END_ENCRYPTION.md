# 端到端加密设计

## 1. 概述

本文档描述 ProjectFactory 系统的端到端加密（E2EE）设计方案，确保用户数据在传输和存储过程中的安全性。

### 1.1 设计目标

| 目标 | 描述 |
|------|------|
| 传输安全 | 所有网络通信使用 TLS 1.3 |
| 存储加密 | 敏感数据静态加密 |
| 密钥管理 | 安全的密钥生成、轮换、销毁机制 |
| 零知识架构 | 服务端无法解密用户数据 |
| 密钥分片 | 支持 Shamir's Secret Sharing |

### 1.2 加密架构概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           端到端加密架构                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  用户端密钥体系                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    用户主密钥 (User Master Key)                       │   │
│  │                         ↓                                             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │ 数据加密密钥   │  │ 签名密钥对    │  │ 恢复密钥分片   │               │   │
│  │  │ (DEK)        │  │ (Signing)   │  │ (Shamir)    │               │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  密钥流（客户端侧）                                                          │
│  User Input → Encrypt (DEK) → Encrypted Data → Server Storage              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 密钥体系

### 2.1 密钥类型

```typescript
// src/crypto/keys/types.ts

// 密钥算法
enum KeyAlgorithm {
  AES_256_GCM = 'AES-256-GCM',
  AES_256_CTR = 'AES-256-CTR',
  RSA_OAEP_4096 = 'RSA-OAEP-4096',
  RSA_PSS_4096 = 'RSA-PSS-4096',
  ECDH_P256 = 'ECDH-P256',
  ECDSA_P256 = 'ECDSA-P256',
  CHACHA20_POLY1305 = 'ChaCha20-Poly1305',
}

// 密钥用途
enum KeyPurpose {
  DATA_ENCRYPTION = 'data-encryption',
  KEY_ENCRYPTION = 'key-encryption',
  SIGNING = 'signing',
  KEY_AGREEMENT = 'key-agreement',
  AUTHENTICATION = 'authentication',
  RECOVERY = 'recovery',
}

// 密钥接口
interface CryptoKey {
  id: string;                    // 密钥唯一标识 (UUID v4)
  algorithm: KeyAlgorithm;        // 加密算法
  purpose: KeyPurpose[];         // 密钥用途
  createdAt: number;            // 创建时间戳
  expiresAt?: number;            // 过期时间戳
  rotatedAt?: number;            // 最近轮换时间
  status: 'active' | 'rotated' | 'revoked' | 'destroyed';
  metadata?: Record<string, unknown>;
}

// 数据加密密钥 (DEK)
interface DataEncryptionKey extends CryptoKey {
  purpose: [KeyPurpose.DATA_ENCRYPTION];
  encryptedKey?: string;         // 用 KEK 加密后的 DEK
}

// 密钥加密密钥 (KEK)
interface KeyEncryptionKey extends CryptoKey {
  purpose: [KeyPurpose.KEY_ENCRYPTION];
  salt: string;                   // 盐值
  iterations: number;             // PBKDF2 迭代次数
  derivationAlgorithm: 'PBKDF2' | 'Argon2';
}
```

### 2.2 密钥生成

```typescript
// src/crypto/keys/generation.ts
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';

export class KeyGenerator {
  // 生成随机密钥
  static async generateKey(algorithm: KeyAlgorithm): Promise<CryptoKey> {
    const keyData = await this.generateKeyMaterial(algorithm);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: this.getWebCryptoAlgorithm(algorithm) },
      true,
      this.getKeyUsages(algorithm)
    );

    return {
      id: crypto.randomUUID(),
      algorithm,
      purpose: [],
      createdAt: Date.now(),
      status: 'active',
    };
  }

  // 生成 DEK (数据加密密钥)
  static async generateDEK(): Promise<DataEncryptionKey> {
    const key = await this.generateKey(KeyAlgorithm.AES_256_GCM);
    return {
      ...key,
      purpose: [KeyPurpose.DATA_ENCRYPTION],
    } as DataEncryptionKey;
  }

  // 生成 KEK (从用户密码派生)
  static async deriveKEK(
    password: string,
    salt?: Uint8Array,
    iterations: number = 100000
  ): Promise<KeyEncryptionKey> {
    const actualSalt = salt || randomBytes(32);
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const kek = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: actualSalt,
        iterations,
        hash: 'SHA-256',
      },
      passwordKey,
      { name: 'AES-256-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
    );

    return {
      id: crypto.randomUUID(),
      algorithm: KeyAlgorithm.AES_256_GCM,
      purpose: [KeyPurpose.KEY_ENCRYPTION],
      createdAt: Date现在的位置(),
      status: 'active',
      salt: Buffer.from(actualSalt).toString('base64'),
      iterations,
      derivationAlgorithm: 'PBKDF2',
    };
  }

  // 生成密钥对 (非对称)
  static async generateKeyPair(
    algorithm: 'RSA-OAEP' | 'ECDSA-P256'
  ): Promise<CryptoKeyPair> {
    if (algorithm === 'RSA-OAEP') {
      return crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 4096,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['encrypt', 'decrypt']
      );
    }

    return crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );
  }

  // 获取密钥材料大小
  private static getKeyMaterialSize(algorithm: KeyAlgorithm): number {
    switch (algorithm) {
      case KeyAlgorithm.AES_256_GCM:
      case KeyAlgorithm.AES_256_CTR:
      case KeyAlgorithm.CHACHA20_POLY1305:
        return 32; // 256 bits
      default:
        throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
  }

  private static getWebCryptoAlgorithm(algorithm: KeyAlgorithm): string {
    const map: Record<KeyAlgorithm, string> = {
      [KeyAlgorithm.AES_256_GCM]: 'AES-GCM',
      [KeyAlgorithm.AES_256_CTR]: 'AES-CTR',
      [KeyAlgorithm.CHACHA20_POLY1305]: 'CHACHA20-POLY1305',
    };
    return map[algorithm] || algorithm;
  }

  private static getKeyUsages(algorithm: KeyAlgorithm): KeyUsage[] {
    switch (algorithm) {
      case KeyAlgorithm.AES_256_GCM:
      case KeyAlgorithm.AES_256_CTR:
      case KeyAlgorithm.CHACHA20_POLY1305:
        return ['encrypt', 'decrypt'];
      default:
        return [];
    }
  }
}
```

---

## 3. 数据加密

### 3.1 加密服务

```typescript
// src/crypto/services/encryption.ts
interface EncryptedData {
  ciphertext: string;           // Base64 编码的密文
  iv: string;                   // Base64 编码的初始向量
  authTag?: string;             // Base64 编码的认证标签 (GCM 模式)
  keyId: string;                // 加密密钥 ID
  algorithm: string;            // 算法标识
  version: number;              // 加密版本号
}

interface EncryptionOptions {
  algorithm?: KeyAlgorithm;
  generateIV?: boolean;         // 是否生成新的 IV
  addAuthTag?: boolean;          // 是否添加认证标签
}

export class EncryptionService {
  constructor(private keyStore: KeyStore) {}

  // 加密数据
  async encrypt(
    plaintext: string | Uint8Array,
    keyId?: string
  ): Promise<EncryptedData> {
    const key = keyId
      ? await this.keyStore.getKey(keyId)
      : await this.keyStore.getActiveKey(KeyPurpose.DATA_ENCRYPTION);

    if (!key) {
      throw new CryptoError('NO_KEY', 'No suitable encryption key found');
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = typeof plaintext === 'string'
      ? new TextEncoder().encode(plaintext)
      : plaintext;

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    return {
      ciphertext: Buffer.from(ciphertext).toString('base64'),
      iv: Buffer.from(iv).toString('base64'),
      keyId: key.meta.id,
      algorithm: 'AES-256-GCM',
      version: 1,
    };
  }

  // 解密数据
  async decrypt(encrypted: EncryptedData): Promise<string> {
    const key = await this.keyStore.getKey(encrypted.keyId);
    if (!key) {
      throw new CryptoError('KEY_NOT_FOUND', `Key ${encrypted.keyId} not found`);
    }

    const iv = Buffer.from(encrypted.iv, 'base64');
    const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(plaintext);
  }

  // 加密大文件 (分块)
  async encryptLargeFile(
    file: File,
    keyId?: string,
    onProgress?: (progress: number) => void
  ): Promise<EncryptedData> {
    const key = keyId
      ? await this.keyStore.getKey(keyId)
      : await this.keyStore.getActiveKey(KeyPurpose.DATA_ENCRYPTION);

    const chunkSize = 64 * 1024; // 64KB chunks
    const iv = crypto.getRandomValues(new Uint8Array(12));
    let offset = 0;
    const encryptedChunks: Uint8Array[] = [];

    // 使用 CTR 模式以便随机访问
    while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize);
      const chunkData = new Uint8Array(await chunk.arrayBuffer());
      const counter = new Uint8Array(16);
      new DataView(counter.buffer).setBigUint64(12, BigInt(offset / chunkSize));

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-CTR', counter: new Uint8Array([...iv.slice(0, 8), ...counter]) },
        key,
        chunkData
      );

      encryptedChunks.push(new Uint8Array(encrypted));
      offset += chunkSize;
      onProgress?.(offset / file.size);
    }

    // 合并所有块
    const totalLength = encryptedChunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLength);
    let pos = 0;
    for (const chunk of encryptedChunks) {
      result.set(chunk, pos);
      pos += chunk.length;
    }

    return {
      ciphertext: Buffer.from(result).toString('base64'),
      iv: Buffer.from(iv).toString('base64'),
      keyId: key.meta.id,
      algorithm: 'AES-256-CTR',
      version: 1,
    };
  }
}
```

### 3.2 字段级加密

```typescript
// src/crypto/services/field-encryption.ts

// 需要加密的敏感字段
const SENSITIVE_FIELDS = [
  'apiKey',
  'accessToken',
  'refreshToken',
  'privateKey',
  'secret',
  'password',
  'creditCard',
  'ssn',
] as const;

type SensitiveField = typeof SENSITIVE_FIELDS[number];

// 加密对象中的敏感字段
export function encryptSensitiveFields<T extends Record<string, unknown>>(
  obj: T,
  encryptionService: EncryptionService
): Promise<EncryptedRecord<T>> {
  const encrypted = { ...obj };

  for (const field of SENSITIVE_FIELDS) {
    if (field in obj && obj[field] != null) {
      const encryptedField = `${field}_encrypted` as keyof EncryptedRecord<T>;
      (encrypted as any)[encryptedField] = await encryptionService.encrypt(
        String(obj[field])
      );
      delete (encrypted as any)[field];
    }
  }

  return encrypted as EncryptedRecord<T>>;
}

// 加密项目配置
interface EncryptedProjectConfig {
  id: string;
  name_encrypted: EncryptedData;
  description_encrypted: EncryptedData;
  config_encrypted: EncryptedData;  // JSON stringify 后加密
  settings: {
    visibility: 'public' | 'private' | 'encrypted';
    encryptionKeyId?: string;
  };
  updatedAt: number;
}
```

---

## 4. 密钥管理

### 4.1 密钥存储

```typescript
// src/crypto/keystore.ts
interface KeyStore {
  getKey(id: string): Promise<CryptoKey | null>;
  getActiveKey(purpose: KeyPurpose): Promise<CryptoKey | null>;
  storeKey(key: CryptoKey, keyMaterial: CryptoKey): Promise<void>;
  rotateKey(id: string): Promise<CryptoKey>;
  revokeKey(id: string): Promise<void>;
}

// 浏览器端密钥存储 (IndexedDB)
export class BrowserKeyStore implements KeyStore {
  private db: IDBDatabase;

  async init() {
    this.db = await openDB('key-store', 1, {
      upgrade(db) {
        const store = db.createObjectStore('keys', { keyPath: 'id' });
        store.createIndex('by-purpose', 'purpose');
        store.createIndex('by-status', 'status');
        store.createIndex('by-created', 'createdAt');
      },
    });
  }

  async storeKey(meta: CryptoKey, keyMaterial: CryptoKey) {
    // 导出密钥材料为 JWK
    const exported = await crypto.subtle.exportKey('jwk', keyMaterial);
    await this.db.put('keys', { ...meta, keyMaterial: exported });
  }

  async getKey(id: string): Promise<CryptoKey | null> {
    const record = await this.db.get('keys', id);
    if (!record) return null;

    return crypto.subtle.importKey(
      'jwk',
      record.keyMaterial,
      { name: this.getAlgorithmName(record.algorithm) },
      true,
      this.getKeyUsages(record.purpose)
    );
  }

  async getActiveKey(purpose: KeyPurpose): Promise<CryptoKey | null> {
    const keys = await this.db.getAllFromIndex('keys', 'by-purpose', purpose);
    const active = keys.find((k: any) => k.status === 'active');
    if (!active) return null;
    return this.getKey(active.id);
  }

  async rotateKey(id: string): Promise<CryptoKey> {
    const oldMeta = await this.db.get('keys', id);
    const newKeyMaterial = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    // 标记旧密钥为已轮换
    await this.db.put('keys', { ...oldMeta, status: 'rotated', rotatedAt: Date.now() });

    // 存储新密钥
    const newMeta: CryptoKey = {
      id: crypto.randomUUID(),
      algorithm: oldMeta.algorithm,
      purpose: oldMeta.purpose,
      createdAt: Date.now(),
      status: 'active',
    };
    await this.storeKey(newMeta, newKeyMaterial);

    return newKeyMaterial;
  }

  private getAlgorithmName(algorithm: KeyAlgorithm): string {
    switch (algorithm) {
      case KeyAlgorithm.AES_256_GCM: return 'AES-GCM';
      case KeyAlgorithm.AES_256_CTR: return 'AES-CTR';
      default: return algorithm;
    }
  }
}
```

### 4.2 密钥轮换

```typescript
// src/crypto/rotation.ts
interface KeyRotationPolicy {
  dekRotationDays: number;        // DEK 轮换周期 (默认 90 天)
  kekRotationDays: number;        // KEK 轮换周期 (默认 365 天)
  autoRotate: boolean;           // 是否自动轮换
  minVersionToKeep: number;       // 保留的最小版本数
}

export class KeyRotationService {
  constructor(
    private keyStore: KeyStore,
    private policy: KeyRotationPolicy
  ) {}

  // 检查是否需要轮换
  async needsRotation(keyId: string): Promise<boolean> {
    const key = await this.keyStore.getKey(keyId);
    if (!key || key.status !== 'active') return false;

    const rotationPeriod = key.purpose.includes(KeyPurpose.KEY_ENCRYPTION)
      ? this.policy.kekRotationDays
      : this.policy.dekRotationDays;

    const daysSinceCreation = (Date.now() - key.createdAt) / (1000 * 60 * 60 * 24);
    return daysSinceCreation >= rotationPeriod;
  }

  // 执行轮换
  async rotateKey(keyId: string): Promise<CryptoKey> {
    const oldKey = await this.keyStore.getKey(keyId);
    if (!oldKey) throw new CryptoError('KEY_NOT_FOUND');

    // 1. 生成新密钥
    const newKey = await this.keyStore.rotateKey(keyId);

    // 2. 重新加密所有使用旧密钥的数据
    await this.reEncryptData(keyId, newKey);

    // 3. 删除旧密钥（软删除，保留用于解密历史数据）
    // 旧密钥保留在数据库中，状态为 'rotated'

    return newKey;
  }

  // 重新加密数据
  private async reEncryptData(oldKeyId: string, newKey: CryptoKey) {
    // 获取所有使用旧密钥加密的数据
    const encryptedRecords = await dataStore.getByKeyId(oldKeyId);

    for (const record of encryptedRecords) {
      // 解密
      const plaintext = await encryptionService.decrypt(record.encrypted);

      // 用新密钥重新加密
      const newEncrypted = await encryptionService.encrypt(plaintext);

      // 更新存储
      await dataStore.update(record.id, {
        encrypted: newEncrypted,
        previousKeyId: oldKeyId,
      });
    }
  }
}
```

---

## 5. 密钥分片与恢复

### 5.1 Shamir's Secret Sharing

```typescript
// src/crypto/shamir.ts
// 使用 Shamir's Secret Sharing 实现密钥分片

interface ShamirShare {
  x: bigint;      // 分片索引 (1-based)
  y: bigint;      // 分片值
}

interface ShamirConfig {
  threshold: number;   // 最少需要恢复的分片数 (k)
  shares: number;     // 总分片数 (n)
}

// 在 GF(256) 上实现 Shamir's Secret Sharing
export class ShamirSecretSharing {
  // 分割密钥为 n 个分片
  static split(secret: Uint8Array, config: ShamirConfig): ShamirShare[] {
    const { threshold, shares } = config;

    // 生成随机系数 (a1, a2, ..., a_{k-1})
    const coefficients: bigint[] = [this.bytesToBigint(secret)];
    for (let i = 1; i < threshold; i++) {
      coefficients.push(this.randomBigint(32));
    }

    // 在 GF(256) 上计算每个分片
    const result: ShamirShare[] = [];
    for (let x = 1n; x <= shares; x++) {
      let y = 0n;
      for (let i = 0; i < coefficients.length; i++) {
        y = this.gfAdd(y, this.gfMultiply(coefficients[i], this.gfPow(x, Bigint(i))));
      }
      result.push({ x, y });
    }

    return result;
  }

  // 从 k 个分片恢复密钥
  static combine(shares: ShamirShare[]): Uint8Array {
    if (shares.length < 2) throw new Error('Need at least 2 shares');

    // 拉格朗日插值
    let secret = 0n;
    for (let i = 0; i < shares.length; i++) {
      let numerator = 1n;
      let denominator = 1n;

      for (let j = 0; j < shares.length; j++) {
        if (i !== j) {
          numerator = this.gfMultiply(numerator, shares[j].x);
          denominator = this.gfMultiply(denominator, this.gfSub(shares[i].x, shares[j].x));
        }
      }

      const lagrangeCoeff = this.gfMultiply(numerator, this.gfInverse(denominator));
      secret = this.gfAdd(secret, this.gfMultiply(shares[i].y, lagrangeCoeff));
    }

    return this.bigintToBytes(secret);
  }

  // GF(256) 加法
  private static gfAdd(a: bigint, b: bigint): bigint {
    return (a ^ b) & 0xffn;
  }

  // GF(256) 乘法
  private static gfMultiply(a: bigint, b: bigint): bigint {
    let result = 0n;
    while (b > 0n) {
      if (b & 1n) result ^= a;
      a = ((a << 1n) ^ (a & 0x80n ? 0x11bn : 0n)) & 0xffn;
      b >>= 1n;
    }
    return result;
  }

  // GF(256) 幂
  private static gfPow(base: bigint, exp: bigint): bigint {
    let result = 1n;
    while (exp > 0n) {
      if (exp & 1n) result = this.gfMultiply(result, base);
      base = this.gfMultiply(base, base);
      exp >>= 1n;
    }
    return result;
  }

  // GF(256) 逆元
  private static gfInverse(a: bigint): bigint {
    return this.gfPow(a, 254n);
  }

  private static bytesToBigint(bytes: Uint8Array): bigint {
    let result = 0n;
    for (const byte of bytes) {
      result = (result << 8n) | Bigint(byte);
    }
    return result;
  }

  private static bigintToBytes(n: bigint): Uint8Array {
    const bytes: number[] = [];
    while (n > 0n) {
      bytes.unshift(Number(n & 0xffn));
      n >>= 8n;
    }
    return new Uint8Array(bytes);
  }

  private static randomBigint(bytes: number): bigint {
    const array = new Uint8Array(bytes);
    crypto.getRandomValues(array);
    return this.bytesToBigint(array);
  }
}

// 使用示例
async function setupRecoveryShares(masterKey: CryptoKey) {
  // 导出主密钥
  const exported = await crypto.subtle.exportKey('raw', masterKey);

  // 分割为 5 份，需要 3 份恢复
  const shares = ShamirSecretSharing.split(exported, { threshold: 3, shares: 5 });

  // 分发给信任的保管人
  const guardians = ['email1', 'email2', 'email3', 'email4', 'email5'];
  for (let i = 0; i < guardians.length; i++) {
    await secureStorage.store(`recovery-share-${i}`, {
      guardian: guardians[i],
      share: shares[i],
      storedAt: Date.now(),
    });
  }

  return { threshold: 3, totalShares: 5 };
}
```

### 5.2 密钥恢复流程

```typescript
// src/crypto/recovery.ts
interface RecoveryRequest {
  userId: string;
  method: 'shamir' | 'master-password' | 'biometric';
  guardianShares?: ShamirShare[];
  masterPassword?: string;
}

export class KeyRecoveryService {
  async initiateRecovery(request: RecoveryRequest): Promise<RecoveryChallenge> {
    switch (request.method) {
      case 'shamir':
        return this.initiateShamirRecovery(request);
      case 'master-password':
        return this.initiatePasswordRecovery(request);
      case 'biometric':
        return this.initiateBiometricRecovery();
    }
  }

  private async initiateShamirRecovery(request: RecoveryRequest): Promise<RecoveryChallenge> {
    // 验证分片数量
    if (!request.guardianShares || request.guardianShares.length < 3) {
      throw new CryptoError('INSUFFICIENT_SHARES', 'Need at least 3 shares');
    }

    // 解码分片
    const shares = request.guardianShares.map((s) => ({
      x: BigInt(s.x),
      y: BigInt(s.y),
    }));

    // 验证分片有效性（检查 x 坐标不重复）
    const xCoords = new Set(shares.map((s) => s.x.toString()));
    if (xCoords.size !== shares.length) {
      throw new CryptoError('INVALID_SHARES', 'Duplicate share coordinates');
    }

    // 恢复主密钥（不完整恢复，只是验证分片有效性）
    // 实际恢复需要所有分片值
    return {
      challengeId: crypto.randomUUID(),
      method: 'shamir',
      requiredShares: 3,
      providedShares: shares.length,
      status: 'pending',
    };
  }

  async completeRecovery(challenge: RecoveryChallenge, allShares: ShamirShare[]): Promise<CryptoKey> {
    // 恢复密钥
    const secretBytes = ShamirSecretSharing.combine(allShares);

    // 导入为 CryptoKey
    return crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }
}
```

---

## 6. 传输层安全

### 6.1 TLS 配置

```typescript
// src/security/tls.ts
interface TLSConfig {
  minVersion: 'TLSv1.2' | 'TLSv1.3';
  maxVersion: 'TLSv1.3' | 'TLSv1.4';
  cipherSuites: string[];
  certificatePinning: boolean;
  pinnedCertificates?: string[];
}

const recommendedTLSConfig: TLSConfig = {
  minVersion: 'TLSv1.3',
  maxVersion: 'TLSv1.3',
  cipherSuites: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_AES_128_GCM_SHA256',
    'TLS_CHACHA20_POLY1305_SHA256',
  ],
  certificatePinning: true,
};

// API 请求封装 (带证书锁定)
export class SecureAPIClient {
  constructor(private baseURL: string, private tlsConfig: TLSConfig) {}

  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    // 验证证书锁定
    if (this.tlsConfig.certificatePinning) {
      const cert = await this.getCertificate(url);
      if (!this.validatePinnedCertificate(cert)) {
        throw new SecurityError('CERTIFICATE_PINNING_FAILED');
      }
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        'X-Request-ID': crypto.randomUUID(),
        'X-Client-Version': APP_VERSION,
      },
    });

    if (!response.ok) {
      throw new APIError(response.status, await response.text());
    }

    return response.json();
  }

  private async getCertificate(url: string): Promise<string> {
    // 实现证书获取逻辑
    return '';
  }

  private validatePinnedCertificate(cert: string): boolean {
    const pinned = this.tlsConfig.pinnedCertificates || [];
    return pinned.includes(cert);
  }
}
```

### 6.2 请求签名

```typescript
// src/security/request-signing.ts
interface SignedRequest {
  signature: string;
  timestamp: number;
  nonce: string;
  headers: Record<string, string>;
}

export class RequestSigner {
  private privateKey: CryptoKey;

  async sign(request: RequestInit): Promise<SignedRequest> {
    const timestamp = Date.now();
    const nonce = crypto.randomUUID();

    const stringToSign = [
      request.method || 'GET',
      new URL(request.url as string).pathname,
      timestamp,
      nonce,
    ].join('\n');

    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
      'ECDSA',
      this.privateKey,
      encoder.encode(stringToSign)
    );

    return {
      signature: Buffer.from(signature).toString('base64'),
      timestamp,
      nonce,
      headers: {
        'X-Signature': Buffer.from(signature).toString('base64'),
        'X-Timestamp': timestamp.toString(),
        'X-Nonce': nonce,
      },
    };
  }
}
```

---

## 7. 零知识架构

### 7.1 服务端零知识设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          零知识架构                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  客户端                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  User Password                                                        │   │
│  │        ↓                                                               │   │
│  │  PBKDF2 (100k iterations, SHA-256)                                    │   │
│  │        ↓                                                               │   │
│  │  Master Key (never sent to server)                                    │   │
│  │        ↓                                                               │   │
│  │  Encrypt/Decrypt locally                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↑                                        │
│                                    │ 加密后的密文                             │
│                                    ↓                                        │
│  服务端                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Storage:                                                              │   │
│  │  - Encrypted project data (blob)                                      │   │
│  │  - Encrypted DEK (wrapped by user's KEK)                               │   │
│  │  - Salt (for PBKDF2)                                                  │   │
│  │  - Public signing key                                                 │   │
│  │                                                                       │   │
│  │  CANNOT decrypt user data (no master key)                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 加密流程

```typescript
// src/crypto/zero-knowledge.ts
interface ZKEncryptionResult {
  encryptedData: string;          // 加密后的数据
  wrappedDEK: string;            // 用 KEK 包装后的 DEK
  salt: string;                  // PBKDF2 盐值
  algorithm: string;             // 算法标识
  version: number;
}

export class ZeroKnowledgeService {
  // 用户注册 - 创建加密密钥
  async setupUserKeys(password: string): Promise<UserKeySetup> {
    // 1. 生成盐值
    const salt = crypto.getRandomValues(new Uint8Array(32));

    // 2. 从密码派生 KEK
    const kek = await this.deriveKey(password, salt);

    // 3. 生成 DEK
    const dek = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    // 4. 用 KEK 包装 DEK
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const wrappedDEK = await crypto.subtle.wrapKey(
      'raw',
      dek,
      kek,
      { name: 'AES-GCM', iv }
    );

    // 5. 生成签名密钥对
    const signingKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );

    return {
      salt: Buffer.from(salt).toString('base64'),
      wrappedDEK: Buffer.from(wrappedDEK).toString('base64'),
      iv: Buffer.from(iv).toString('base64'),
      signingPublicKey: await crypto.subtle.exportKey('spki', signingKeyPair.publicKey),
      encryptedPrivateKey: await this.encryptPrivateKey(signingKeyPair.privateKey, kek),
    };
  }

  // 加密数据
  async encryptData(
    data: string,
    wrappedDEK: string,
    iv: string,
    kek: CryptoKey
  ): Promise<string> {
    // 解包 DEK
    const dek = await crypto.subtle.unwrapKey(
      'raw',
      Buffer.from(wrappedDEK, 'base64'),
      kek,
      { name: 'AES-GCM', iv: Buffer.from(iv, 'base64') },
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    // 加密数据
    const dataIv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: dataIv },
      dek,
      new TextEncoder().encode(data)
    );

    // 返回 (iv + ciphertext + tag)
    return Buffer.concat([
      new Uint8Array(dataIv),
      new Uint8Array(encrypted),
    ]).toString('base64');
  }

  // 解密数据
  async decryptData(
    encryptedData: string,
    wrappedDEK: string,
    iv: string,
    kek: CryptoKey
  ): Promise<string> {
    const dek = await crypto.subtle.unwrapKey(
      'raw',
      Buffer.from(wrappedDEK, 'base64'),
      kek,
      { name: 'AES-GCM', iv: Buffer.from(iv, 'base64') },
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    const data = Buffer.from(encryptedData, 'base64');
    const dataIv = data.slice(0, 12);
    const ciphertext = data.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: dataIv },
      dek,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  }

  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['wrapKey', 'unwrapKey']
    );
  }
}
```

---

## 8. 安全审计

### 8.1 密钥审计日志

```typescript
// src/security/audit.ts
interface KeyAuditEvent {
  eventId: string;
  keyId: string;
  eventType: KeyAuditEventType;
  timestamp: number;
  actor: {
    userId: string;
    ip?: string;
    userAgent?: string;
  };
  metadata?: Record<string, unknown>;
}

enum KeyAuditEventType {
  KEY_GENERATED = 'key:generated',
  KEY_ACCESSED = 'key:accessed',
  KEY_ROTATED = 'key:rotated',
  KEY_REVOKED = 'key:revoked',
  KEY_EXPORTED = 'key:exported',
  KEY_DESTROYED = 'key:destroyed',
  ENCRYPTION_SUCCESS = 'encryption:success',
  DECRYPTION_SUCCESS = 'decryption:success',
  DECRYPTION_FAILED = 'encryption:failed',
}

export class KeyAuditLogger {
  async log(event: KeyAuditEvent): Promise<void> {
    // 异步写入审计日志
    await fetch('/api/audit/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...event,
        eventId: crypto.randomUUID(),
        timestamp: Date.now(),
      }),
    });
  }

  async getKeyHistory(keyId: string): Promise<KeyAuditEvent[]> {
    const response = await fetch(`/api/audit/keys/${keyId}`);
    return response.json();
  }
}
```

---

## 9. 合规考虑

### 9.1 加密标准合规

| 标准 | 要求 | 实现 |
|------|------|------|
| FIPS 140-2 | 加密模块认证 | 使用 WebCryptoAPI (FIPS 140-2 兼容) |
| GDPR Art. 32 | 适当技术措施 | E2EE + 密钥管理 + 审计日志 |
| SOC 2 | 加密控制 | 传输加密 + 静态加密 + 密钥轮换 |
| HIPAA | 医疗数据加密 | AES-256 + 密钥分片 |

### 9.2 密钥生命周期合规

```typescript
// 合规要求的密钥生命周期
const COMPLIANCE_LIFECYCLE = {
  // 密钥生成
  generation: {
    algorithm: 'AES-256-GCM',
    entropy: 'crypto.getRandomValues (256 bits)',
    documentation: true,
  },

  // 密钥存储
  storage: {
    location: 'client-side (IndexedDB)',
    encryption: 'AES-256-GCM',
    backup: 'encrypted Shamir shares',
  },

  // 密钥使用
  usage: {
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    maxOperations: Infinity,
    monitoring: true,
  },

  // 密钥轮换
  rotation: {
    automatic: true,
    frequencyDays: 90,
    dataReencryption: true,
  },

  // 密钥销毁
  destruction: {
    method: 'crypto.subtle.destroyKey',
    verification: true,
    certificate: true,
  },
};
```

---

## 10. 相关文档

- [安全设计](./SECURITY_DESIGN.md)
- [数据模型设计](./DATA_MODEL_DESIGN.md)
- [前端设计](./FRONTEND_DESIGN.md)

---

**最后更新**: 2026-04-14
