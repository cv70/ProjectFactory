# 多区域架构设计

## 1. 概述

本文档描述 ProjectFactory 系统的多区域架构设计，实现全球化部署和高可用性。

### 1.1 多区域架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          多区域架构                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         全球负载均衡                                   │   │
│  │                     (Cloudflare / Route53)                           │   │
│  └──────────────────────────────┬────────────────────────────────────┘   │
│                                  │                                          │
│       ┌─────────────────────────┼─────────────────────────┐               │
│       │                         │                         │               │
│       ▼                         ▼                         ▼               │
│  ┌─────────┐               ┌─────────┐               ┌─────────┐        │
│  │  US-E   │               │  EU-W   │               │  AP-SE  │        │
│  │ Virginia│               │ Dublin  │               │Singapore│        │
│  │         │               │         │               │         │        │
│  │ • Primary│◄──────────────┼─────────┼──────────────►│ • Warm │        │
│  │ • Write │   Replication  │ • Read  │   Replication  │ • Read │        │
│  └────┬────┘               └────┬────┘               └────┬────┘        │
│       │                          │                          │               │
│       │    ┌────────────────────┴────────────────────┐    │               │
│       │    │                                         │    │               │
│       ▼    ▼                                         ▼    ▼               │
│  ┌─────────┐  ┌─────────┐                       ┌─────────┐            │
│  │ DynamoDB│  │   S3    │                       │  Redis  │            │
│  │ Global │  │ Transfer│                       │ Cluster │            │
│  │ Tables │  │         │                       │         │            │
│  └─────────┘  └─────────┘                       └─────────┘            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 区域配置

### 2.1 区域拓扑

```yaml
# multi-region/regions.yaml
regions:
  # 主区域 (US East)
  us-east-1:
    name: "US East (N. Virginia)"
    priority: 1
    role: "primary"
    services:
      - api-gateway
      - application
      - dynamodb
      - redis
      - s3
    capacity:
      apiGateway:
        instances: 3
      application:
        minReplicas: 5
        maxReplicas: 50
      database:
        instanceClass: db.r6g.2xlarge
        MultiAZ: true

  # 灾备区域 (EU West)
  eu-west-1:
    name: "Europe (Ireland)"
    priority: 2
    role: "secondary"
    replication: "async"
    services:
      - api-gateway
      - application
      - redis
      - s3
    capacity:
      apiGateway:
        instances: 2
      application:
        minReplicas: 2
        maxReplicas: 20

  # 亚太区域
  ap-southeast-1:
    name: "Asia Pacific (Singapore)"
    priority: 3
    role: "warm-standby"
    replication: "async"
    services:
      - api-gateway
      - application
      - redis
      - s3
    capacity:
      apiGateway:
        instances: 2
      application:
        minReplicas: 2
        maxReplicas: 20

# 全局服务
global:
  dynamodb:
    type: "global"
    tables:
      - ideas
      - projects
      - users
    replication:
      type: "automatic"
      replicatesTo: [eu-west-1, ap-southeast-1]

  s3:
    type: "global"
    bucket: "projectfactory-global"
    versioning: true
    replication:
      type: "crr"
      destinations:
        - region: eu-west-1
          storageClass: STANDARD
        - region: ap-southeast-1
          storageClass: STANDARD_IA

  route53:
    healthCheck:
      enabled: true
      interval: 30
      threshold: 3
    failover:
      type: "geolocation"
```

### 2.2 流量路由

```yaml
# multi-region/routing-policy.yaml
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  # 主域名
  MainDomain:
    Type: AWS::Route53::HostedZone
    Properties:
      Name: projectfactory.com
      HostedZoneConfig:
        Comment: "Main hosted zone"

  # 健康检查
  PrimaryHealthCheck:
    Type: AWS::Route53::HealthCheck
    Properties:
      HealthCheckConfig:
        Type: HTTPS
        FullyQualifiedDomainName: api.projectfactory.com
        Port: 443
        ResourcePath: /health
        RequestInterval: 10
        FailureThreshold: 3

  # DNS 记录
  APIARecordSet:
    Type: AWS::Route53::RecordSet
    Properties:
      HostedZoneName: !Ref MainDomain
      Name: api.projectfactory.com
      Type: A
      SetIdentifier: us-east-1
      GeoLocation:
        CountryCode: "*"
      Region: us-east-1
      AliasTarget:
        DNSName: !GetAtt APIGatewayRegional.DomainName
        HostedZoneId: !GetAtt APIGatewayRegional.HostedZoneId
      HealthCheckId: !Ref PrimaryHealthCheck
      Failover: "PRIMARY"

  APIARecordSetSecondary:
    Type: AWS::Route53::RecordSet
    Properties:
      HostedZoneName: !Ref MainDomain
      Name: api.projectfactory.com
      Type: A
      SetIdentifier: eu-west-1
      GeoLocation:
        ContinentCode: EU
      Region: eu-west-1
      AliasTarget:
        DNSName: !GetAtt APIGatewayRegionalEU.DomainName
        HostedZoneId: !GetAtt APIGatewayRegionalEU.HostedZoneId
      Failover: "SECONDARY"

  # 地理位置路由
  APIGeoRecordSet:
    Type: AWS::Route53::RecordSet
    Properties:
      HostedZoneName: !Ref MainDomain
      Name: api.projectfactory.com
      Type: A
      GeoLocation:
        CountryCode: "*"
      SetIdentifier: us-east-1-default
      Region: us-east-1
      AliasTarget:
        DNSName: !GetAtt APIGatewayRegional.DomainName
        HostedZoneId: !GetAtt APIGatewayRegional.HostedZoneId
```

---

## 3. 数据复制

### 3.1 DynamoDB 全局表

```yaml
# multi-region/dynamodb-global.yaml
Resources:
  # 全局想法表
  IdeasGlobalTable:
    Type: AWS::DynamoDB::GlobalTable
    Properties:
      TableName: ideas
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
        - AttributeName: userId
          AttributeType: S
        - AttributeName: status
          AttributeType: S
        - AttributeName: createdAt
          AttributeType: S
      KeySchema:
        - AttributeName: id
          KeyType: HASH
      BillingMode: PAY_PER_REQUEST
      StreamSpecification:
        StreamViewType: NEW_AND_OLD_IMAGES

      GlobalSecondaryIndexes:
        - IndexName: UserStatusIndex
          KeySchema:
            - AttributeName: userId
              KeyType: HASH
            - AttributeName: status
              KeyType: RANGE
          Projection:
            ProjectionType: ALL

        - IndexName: CreatedAtIndex
          KeySchema:
            - AttributeName: status
              KeyType: HASH
            - AttributeName: createdAt
              KeyType: RANGE
          Projection:
            ProjectionType: KEYS_ONLY

      Replicas:
        - Region: us-east-1
          TableClass: STANDARD
          PointInTimeRecoverySpecification:
            PointInTimeRecoveryEnabled: true

        - Region: eu-west-1
          TableClass: STANDARD
          PointInTimeRecoverySpecification:
            PointInTimeRecoveryEnabled: true

        - Region: ap-southeast-1
          TableClass: STANDARD
          PointInTimeRecoverySpecification:
            PointInTimeRecoveryEnabled: true

  # 全局项目表
  ProjectsGlobalTable:
    Type: AWS::DynamoDB::GlobalTable
    Properties:
      TableName: projects
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
        - AttributeName: ideaId
          AttributeType: S
        - AttributeName: userId
          AttributeType: S
      KeySchema:
        - AttributeName: id
          KeyType: HASH
      BillingMode: PAY_PER_REQUEST
      StreamSpecification:
        StreamViewType: NEW_AND_OLD_IMAGES

      Replicas:
        - Region: us-east-1
          TableClass: STANDARD
        - Region: eu-west-1
          TableClass: STANDARD
        - Region: ap-southeast-1
          TableClass: STANDARD
```

### 3.2 S3 跨区域复制

```yaml
# multi-region/s3-replication.yaml
Resources:
  # 源存储桶
  SourceBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: projectfactory-source
      VersioningStatus: Enabled
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256
      LifecycleConfiguration:
        Rules:
          - Id: ArchiveOldVersions
            Status: Enabled
            NoncurrentVersionTransitions:
              - StorageClass: GLACIER
                NoncurrentDays: 30

  # 复制配置
  SourceBucketReplication:
    Type: AWS::S3::BucketReplicationConfig
    Properties:
      Role: !GetAtt ReplicationRole.Arn
      Rules:
        - ID: replicate-to-eu
          Status: Enabled
          Destination:
            Bucket: arn:aws:s3:::projectfactory-eu
            StorageClass: STANDARD
          SourceSelectionCriteria:
            SseKmsEncryptedObjects:
              Status: Enabled
        - ID: replicate-to-ap
          Status: Enabled
          Destination:
            Bucket: arn:aws:s3:::projectfactory-ap
            StorageClass: STANDARD_IA

  # 复制 IAM 角色
  ReplicationRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Principal:
              Service: s3.amazonaws.com
            Action: sts:AssumeRole
      Policies:
        - PolicyName: ReplicationPolicy
          PolicyDocument:
            Version: "2012-10-17"
            Statement:
              - Effect: Allow
                Action:
                  - s3:GetReplicationConfiguration
                  - s3:ListBucket
                Resource: !GetAtt SourceBucket.Arn
              - Effect: Allow
                Action:
                  - s3:ReplicateObject
                  - s3:ReplicateTags
                Resource: "arn:aws:s3:::projectfactory-*/*"
```

---

## 4. 故障转移

### 4.1 自动故障转移配置

```typescript
// multi-region/failover/auto-failover.ts
interface FailoverConfig {
  healthCheckInterval: number;      // ms
  failureThreshold: number;         // 连续失败次数
  recoveryThreshold: number;         // 连续成功次数
  timeout: number;                   // ms
}

class GlobalFailoverManager {
  private config: FailoverConfig;
  private currentPrimary: string;
  private healthStatus: Map<string, HealthStatus> = new Map();

  constructor(config: FailoverConfig, primaryRegion: string) {
    this.config = config;
    this.currentPrimary = primaryRegion;
  }

  // 健康检查
  async checkRegionHealth(region: string): Promise<HealthStatus> {
    const start = Date.now();

    try {
      const response = await fetch(`${this.getRegionEndpoint(region)}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.config.timeout),
      });

      const latency = Date.now() - start;

      const status: HealthStatus = {
        region,
        healthy: response.ok,
        latency,
        lastCheck: new Date(),
        consecutiveFailures: 0,
      };

      this.healthStatus.set(region, status);

      return status;
    } catch (error) {
      const status: HealthStatus = {
        region,
        healthy: false,
        latency: Date.now() - start,
        lastCheck: new Date(),
        consecutiveFailures: (this.healthStatus.get(region)?.consecutiveFailures || 0) + 1,
      };

      this.healthStatus.set(region, status);

      // 检查是否需要故障转移
      if (status.consecutiveFailures >= this.config.failureThreshold) {
        await this.initiateFailover(region);
      }

      return status;
    }
  }

  // 故障转移
  async initiateFailover(failedRegion: string): Promise<void> {
    console.log(`Initiating failover from ${failedRegion}`);

    // 找到最佳候选区域
    const candidate = await this.findBestCandidate(failedRegion);

    if (!candidate) {
      console.error('No healthy candidate region available');
      await this.notifyAlert('CRITICAL', 'No healthy region available');
      return;
    }

    // 更新路由
    await this.updateRouting(candidate.region);

    // 更新复制方向
    await this.updateReplication(candidate.region);

    // 更新锁定
    await this.acquireGlobalLock(failedRegion, candidate.region);

    // 通知
    await this.notifyFailover(failedRegion, candidate.region);

    this.currentPrimary = candidate.region;
  }

  // 恢复
  async initiateRecovery(): Promise<void> {
    const primaryHealth = this.healthStatus.get(this.currentPrimary);

    if (!primaryHealth?.healthy) {
      return; // 主区域仍不健康
    }

    // 检查是否应该回切
    const shouldRecover = await this.shouldRecover();

    if (shouldRecover) {
      console.log(`Initiating recovery to primary region`);

      await this.updateRouting(this.currentPrimary);
      await this.releaseGlobalLock();
      await this.notifyRecovery();
    }
  }

  private async shouldRecover(): Promise<boolean> {
    // 检查主区域是否稳定恢复
    const consecutiveHealthy = await this.getConsecutiveHealthyCount(this.currentPrimary);

    return consecutiveHealthy >= this.config.recoveryThreshold;
  }
}
```

### 4.2 数据一致性处理

```typescript
// multi-region/consistency/conflict-resolution.ts
interface ConflictResolution {
  strategy: 'last-write-wins' | 'server-wins' | 'client-wins' | 'custom';
  timestampTolerance?: number;  // ms
  customResolver?: (local: Entity, remote: Entity) => Entity;
}

class ReplicationConflictResolver {
  private resolvers: Map<string, ConflictResolution> = new Map();

  constructor() {
    // 默认策略
    this.resolvers.set('ideas', {
      strategy: 'last-write-wins',
      timestampTolerance: 1000,
    });

    this.resolvers.set('projects', {
      strategy: 'custom',
      customResolver: this.resolveProjectConflict.bind(this),
    });

    this.resolvers.set('quality_metrics', {
      strategy: 'server-wins',  // 服务端数据优先
    });
  }

  resolve(entityType: string, local: Entity, remote: Entity): Entity {
    const config = this.resolvers.get(entityType) || { strategy: 'last-write-wins' };

    switch (config.strategy) {
      case 'last-write-wins':
        return this.lastWriteWins(local, remote, config.timestampTolerance);

      case 'server-wins':
        return remote;

      case 'client-wins':
        return local;

      case 'custom':
        return config.customResolver!(local, remote);

      default:
        return remote;
    }
  }

  private lastWriteWins(
    local: Entity,
    remote: Entity,
    tolerance?: number
  ): Entity {
    const localTime = new Date(local.updatedAt).getTime();
    const remoteTime = new Date(remote.updatedAt).getTime();

    // 如果时间差在容差范围内，合并更新
    if (tolerance && Math.abs(localTime - remoteTime) < tolerance) {
      return this.mergeUpdates(local, remote);
    }

    return localTime > remoteTime ? local : remote;
  }

  private resolveProjectConflict(local: Project, remote: Project): Project {
    // 自定义冲突解决逻辑
    // 例如：保留最新的质量分数，但合并文件列表
    return {
      ...remote,
      files: this.mergeFileLists(local.files, remote.files),
      qualityScore: Math.max(local.qualityScore, remote.qualityScore),
    };
  }

  private mergeFileLists(
    localFiles: File[],
    remoteFiles: File[]
  ): File[] {
    // 合并文件列表，保留最新版本
    const merged = new Map<string, File>();

    for (const file of [...localFiles, ...remoteFiles]) {
      const existing = merged.get(file.path);
      if (!existing || new Date(file.updatedAt) > new Date(existing.updatedAt)) {
        merged.set(file.path, file);
      }
    }

    return Array.from(merged.values());
  }
}
```

---

## 5. 延迟优化

### 5.1 边缘缓存

```yaml
# multi-region/edge/caching.yaml
# CloudFront 配置
Distribution:
  Type: AWS::CloudFront::Distribution
  Properties:
    DistributionConfig:
      Enabled: true
      PriceClass: PriceClass_100  # 全球

      # 默认缓存行为
      DefaultCacheBehavior:
        TargetOriginId: api-origin
        ViewerProtocolPolicy: redirect-to-https
        CachePolicyId: !Ref APICachePolicy
        OriginRequestPolicyId: !Ref APIOriginRequestPolicy

        # 缓存键
        CachePolicyId: managed-CachingOptimized
        OriginRequestPolicyId: managed-ElementHost-5D3F91F3

      # 缓存策略
      CachePolicyConfig:
        Name: projectfactory-api-cache
        MinTTL: 0
        MaxTTL: 3600
        DefaultTTL: 300
        ParametersInCacheKeyAndForwardedToOrigin:
          QueryStringsConfig:
            Quantity: 2
            QueryStrings:
              - items: "page,limit"
          HeadersConfig:
            Quantity: 1
            Headers:
              - Name: Authorization
          CookiesConfig:
            Quantity: 1
            CookieBehavior: whitelist
            Cookies:
              - items: "session_id"

      # 起源组 (故障转移)
      OriginGroups:
        Quantity: 1
        OriginGroups:
          - Id: api-origin-group
            FailoverCriteria:
              StatusCodes:
                Quantity: 4
                Items:
                  - 500
                  - 502
                  - 503
                  - 504
            Members:
              Quantity: 2
              Items:
                - OriginId: us-east-1-origin
                - OriginId: eu-west-1-origin

      # 自定义错误页面
      CustomErrorResponses:
        - ErrorCode: 503
          ResponsePagePath: /errors/service-unavailable.html
          ResponseCode: 503
          ErrorCachingMinTTL: 60
```

### 5.2 数据库读写分离

```typescript
// multi-region/database/read-replica-router.ts
interface ReplicaEndpoint {
  region: string;
  endpoint: string;
  latency: number;
  healthy: boolean;
}

class ReadReplicaRouter {
  private replicas: Map<string, ReplicaEndpoint> = new Map();
  private primary: string;

  constructor(primaryRegion: string) {
    this.primary = primaryRegion;
  }

  // 添加副本
  addReplica(endpoint: ReplicaEndpoint): void {
    this.replicas.set(endpoint.region, endpoint);
  }

  // 移除副本
  removeReplica(region: string): void {
    this.replicas.delete(region);
  }

  // 获取最近的健康副本
  async getReadReplica(userLocation?: GeoLocation): Promise<ReplicaEndpoint | null> {
    const candidates = Array.from(this.replicas.values())
      .filter(r => r.healthy)
      .map(r => ({
        ...r,
        score: this.calculateScore(r, userLocation),
      }))
      .sort((a, b) => b.score - a.score);

    if (candidates.length === 0) {
      return null;
    }

    const replica = candidates[0];

    // 检查延迟是否可接受
    if (replica.latency > 100) { // 100ms 阈值
      console.warn(`Replica ${replica.region} latency is high: ${replica.latency}ms`);
    }

    return replica;
  }

  // 写入操作路由到主节点
  async write<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    const primary = this.replicas.get(this.primary);

    if (!primary?.healthy) {
      throw new Error('Primary region unavailable');
    }

    return operation();
  }

  // 读取操作路由到最近副本
  async read<T>(
    operation: (endpoint: ReplicaEndpoint) => Promise<T>,
    userLocation?: GeoLocation
  ): Promise<T> {
    const replica = await this.getReadReplica(userLocation);

    if (!replica) {
      // 降级到主节点
      const primary = this.replicas.get(this.primary);
      if (primary?.healthy) {
        return operation(primary);
      }
      throw new Error('No healthy database endpoint available');
    }

    return operation(replica);
  }

  private calculateScore(
    replica: ReplicaEndpoint,
    userLocation?: GeoLocation
  ): number {
    // 延迟权重 (越低越好)
    const latencyScore = Math.max(0, 100 - replica.latency * 2);

    // 地理邻近权重 (越近越好)
    let geoScore = 50;
    if (userLocation) {
      const distance = this.getGeoDistance(userLocation, replica.region);
      geoScore = Math.max(0, 100 - distance);
    }

    return latencyScore * 0.7 + geoScore * 0.3;
  }
}
```

---

## 6. 灾难恢复

### 6.1 RTO/RPO 目标

```yaml
# multi-region/disaster-recovery/objectives.yaml
disasterRecovery:
  # RTO: Recovery Time Objective - 系统不可接受的最长时间
  rto:
    critical: 15m      # 关键业务 15 分钟
    standard: 1h       # 标准业务 1 小时
    low: 4h           # 非关键业务 4 小时

  # RPO: Recovery Point Objective - 可接受的最大数据丢失
  rpo:
    critical: 1m      # 关键业务 1 分钟
    standard: 15m     # 标准业务 15 分钟
    low: 1h          # 非关键业务 1 小时

  # 数据复制配置
  replication:
    sync:
      enabled: true
      regions: [eu-west-1]  # 实时同步区域
      lag: 0
    async:
      enabled: true
      regions: [ap-southeast-1]
      lag: 60  # 秒

  # 备份策略
  backup:
    full:
      frequency: daily
      retention: 30 days
      regions: [us-east-1, eu-west-1]
    incremental:
      frequency: hourly
      retention: 7 days
    pointInTime:
      enabled: true
      retention: 35 days
```

### 6.2 灾难恢复流程

```bash
#!/bin/bash
# multi-region/disaster-recovery/runbook.sh

set -e

echo "=========================================="
echo "灾难恢复流程 - $(date)"
echo "=========================================="

# 1. 评估损失
echo "[1] 评估损失..."
read -p "受影响区域: " AFFECTED_REGION
read -p "估计恢复时间: " ESTIMATED_RTO
read -p "数据丢失估计: " ESTIMATED_RPO

# 2. 确认灾备状态
echo "[2] 确认灾备状态..."
echo "检查区域健康状态..."
aws ec2 describe-instance-status \
    --region eu-west-1 \
    --filters Name=instance-state-name,Values=running \
    --query 'InstanceStatuses[*].[InstanceId,InstanceState.Name]'

# 3. 激活灾备区域
echo "[3] 激活灾备区域..."
echo "更新 DNS 路由..."
aws route53 change-resource-record-sets \
    --hosted-zone-id Z1234567890ABC \
    --change-batch file://dns-failover.json

echo "启用应用实例..."
aws autoscaling set-desired-capacity \
    --auto-scaling-group-name projectfactory-app-eu \
    --desired-capacity 5 \
    --region eu-west-1

# 4. 验证服务
echo "[4] 验证服务..."
echo "等待服务启动..."
sleep 60

# 健康检查
HEALTH=$(curl -sf https://api-eu.projectfactory.com/health || echo "FAILED")
if [ "$HEALTH" = "FAILED" ]; then
    echo "健康检查失败!"
    exit 1
fi

echo "服务已恢复: $HEALTH"

# 5. 通知
echo "[5] 通知相关方..."
# 发送通知到 Slack/PagerDuty

# 6. 记录
echo "[6] 记录事件..."
echo "$(date): 故障转移完成 - 从 $AFFECTED_REGION 到 eu-west-1" >> /var/log/disaster-recovery.log

echo "=========================================="
echo "灾难恢复完成"
echo "=========================================="
```

---

## 7. 成本管理

### 7.1 跨区域成本分析

```typescript
// multi-region/cost/cost-analyzer.ts
interface RegionCost {
  region: string;
  compute: number;
  storage: number;
  transfer: number;
  total: number;
}

class MultiRegionCostAnalyzer {
  async analyzeCosts(): Promise<{
    total: number;
    byRegion: RegionCost[];
    recommendations: CostOptimization[];
  }> {
    const costsByRegion = await Promise.all([
      this.getRegionCosts('us-east-1'),
      this.getRegionCosts('eu-west-1'),
      this.getRegionCosts('ap-southeast-1'),
    ]);

    const total = costsByRegion.reduce((sum, r) => sum + r.total, 0);

    const recommendations = this.generateOptimizations(costsByRegion);

    return {
      total,
      byRegion: costsByRegion,
      recommendations,
    };
  }

  private async getRegionCosts(region: string): Promise<RegionCost> {
    // 获取区域成本
    const compute = await this.getComputeCosts(region);
    const storage = await this.getStorageCosts(region);
    const transfer = await this.getTransferCosts(region);

    return {
      region,
      compute,
      storage,
      transfer,
      total: compute + storage + transfer,
    };
  }

  private generateOptimizations(costs: RegionCost[]): CostOptimization[] {
    const recommendations: CostOptimization[] = [];

    // 检查是否需要所有区域
    const primary = costs.find(c => c.region === 'us-east-1');
    if (primary && primary.total < 1000) {
      recommendations.push({
        type: 'consolidate_regions',
        potentialSavings: costs.filter(c => c.region !== 'us-east-1')
          .reduce((sum, c) => sum + c.total, 0),
        description: '考虑将低流量区域的工作负载合并到主区域',
        priority: 'medium',
      });
    }

    // 检查数据传输成本
    for (const cost of costs) {
      if (cost.transfer > cost.compute * 0.3) {
        recommendations.push({
          type: 'reduce_data_transfer',
          region: cost.region,
          potentialSavings: cost.transfer * 0.3,
          description: `${cost.region} 数据传输成本较高`,
          priority: 'high',
        });
      }
    }

    return recommendations;
  }
}
```

---

## 8. 相关文档

- [灾难恢复](./DISASTER_RECOVERY.md)
- [部署架构](./DEPLOYMENT_ARCHITECTURE.md)
- [容错与降级](./FAULT_TOLERANCE.md)
- [监控与告警](./MONITORING_ALERTING.md)

---

**最后更新**: 2026-04-14
