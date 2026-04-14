# 边缘计算架构设计

## 1. 概述

本文档描述 ProjectFactory 系统的边缘计算架构，支持在边缘节点进行项目生成和 AI 推理，减少延迟并提升用户体验。

### 1.1 边缘计算架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           边缘计算架构                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                            ┌─────────────┐                                  │
│                            │   Cloud     │                                  │
│                            │  (Central)  │                                  │
│                            │             │                                  │
│                            │ • 训练      │                                  │
│                            │ • 部署模型  │                                  │
│                            │ • 数据聚合  │                                  │
│                            │ • 监控分析  │                                  │
│                            └──────┬──────┘                                  │
│                                   │                                          │
│                    ┌──────────────┼──────────────┐                          │
│                    │              │              │                          │
│                    ▼              ▼              ▼                          │
│              ┌─────────┐   ┌─────────┐   ┌─────────┐                       │
│              │  Edge   │   │  Edge   │   │  Edge   │                       │
│              │ Node A  │   │ Node B  │   │ Node C  │                       │
│              │ (US-E) │   │ (EU-W) │   │ (AP-SE) │                       │
│              │         │   │         │   │         │                       │
│              │ • 推理  │   │ • 推理  │   │ • 推理  │                       │
│              │ • 代码  │   │ • 代码  │   │ • 代码  │                       │
│              │ 生成    │   │ 生成    │   │ 生成    │                       │
│              │ • 缓存  │   │ • 缓存  │   │ • 缓存  │                       │
│              └─────────┘   └─────────┘   └─────────┘                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 边缘节点设计

### 2.1 边缘节点规格

```yaml
# edge/node-specifications.yaml
edgeNodes:
  # 小型边缘节点 (开发者本地)
  small:
    resources:
      cpu: "4"
      memory: "8Gi"
      storage: "100Gi"
    capabilities:
      - code-generation
      - local-caching
      - offline-mode
    maxConcurrentProjects: 2
    model: "quantized-7b"

  # 中型边缘节点 (办公室/小型机房)
  medium:
    resources:
      cpu: "16"
      memory: "64Gi"
      storage: "500Gi"
    capabilities:
      - code-generation
      - quality-analysis
      - local-caching
      - ml-inference
    maxConcurrentProjects: 10
    model: "70b"

  # 大型边缘节点 (边缘数据中心)
  large:
    resources:
      cpu: "64"
      memory: "256Gi"
      storage: "2Ti"
    capabilities:
      - full-pipeline
      - distributed-caching
      - ml-inference
      - gpu-acceleration
    maxConcurrentProjects: 50
    model: "distributed-70b"
```

### 2.2 边缘代理配置

```yaml
# edge/agent-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: edge-agent
  labels:
    app: projectfactory
    component: edge-agent
spec:
  replicas: 1
  selector:
    matchLabels:
      app: edge-agent
  template:
    spec:
      nodeSelector:
        edge.node/type: "compute"
      tolerations:
        - key: "edge-only"
          operator: "Exists"
          effect: "NoSchedule"
      containers:
        - name: edge-agent
          image: projectfactory/edge-agent:latest
          ports:
            - containerPort: 8080
              name: http
            - containerPort: 9090
              name: metrics
          env:
            - name: EDGE_NODE_ID
              valueFrom:
                fieldRef:
                  fieldPath: spec.nodeName
            - name: CENTRAL_API_URL
              value: "https://api.projectfactory.com"
            - name: CACHE_TTL
              value: "3600"
            - name: MODEL_PATH
              value: "/models/llm"
          resources:
            requests:
              memory: "4Gi"
              cpu: "2"
              nvidia.com/gpu: "1"
            limits:
              memory: "8Gi"
              cpu: "4"
              nvidia.com/gpu: "1"
          volumeMounts:
            - name: model-storage
              mountPath: /models
            - name: cache-storage
              mountPath: /cache
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 60
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 15
      volumes:
        - name: model-storage
          persistentVolumeClaim:
            claimName: edge-models-pvc
        - name: cache-storage
          emptyDir:
            medium: Memory
            sizeLimit: 2Gi
```

---

## 3. 边缘推理

### 3.1 模型服务

```typescript
// edge/inference/model-server.ts
import { InferenceSession } from 'onnxruntime-node';
import { Tensor } from 'onnxruntime-node';

interface ModelConfig {
  name: string;
  path: string;
  quantize: 'int8' | 'int4' | 'fp16' | 'fp32';
  maxBatchSize: number;
  maxContextLength: number;
}

class EdgeModelServer {
  private session: InferenceSession;
  private config: ModelConfig;
  private tokenizer: any;

  async initialize(config: ModelConfig): Promise<void> {
    this.config = config;

    // 加载量化模型
    const modelPath = this.selectModelVariant(config);

    this.session = await InferenceSession.create(modelPath, {
      executionProviders: [
        { name: 'CUDA', deviceId: 0 },
        { name: 'CPU' },
      ],
    });

    this.tokenizer = await this.loadTokenizer(config.path);
  }

  async infer(
    prompt: string,
    options: InferenceOptions
  ): Promise<InferenceResult> {
    const startTime = Date.now();

    // Tokenize
    const inputIds = await this.tokenizer.encode(prompt, {
      maxLength: this.config.maxContextLength,
      truncation: true,
    });

    // Run inference
    const output = await this.session.run({
      input_ids: new Tensor('int64', inputIds, [1, inputIds.length]),
    });

    // Decode
    const generatedText = await this.tokenizer.decode(
      output.logits.data,
      { skipSpecialTokens: true }
    );

    return {
      text: generatedText,
      tokens: output.logits.data.length,
      latency: Date.now() - startTime,
      model: this.config.name,
    };
  }

  // 模型变体选择
  private selectModelVariant(config: ModelConfig): string {
    const gpuMemory = this.getAvailableGPUMemory();

    if (config.quantize === 'int4' && gpuMemory < 8 * 1024 * 1024 * 1024) {
      return `${config.path}/model.int4.gguf`;
    }
    if (config.quantize === 'int8' && gpuMemory < 16 * 1024 * 1024 * 1024) {
      return `${config.path}/model.int8.gguf`;
    }
    if (config.quantize === 'fp16') {
      return `${config.path}/model.fp16.gguf`;
    }

    return `${config.path}/model.fp32.gguf`;
  }

  private getAvailableGPUMemory(): number {
    // GPU 内存检测逻辑
    return 8 * 1024 * 1024 * 1024; // 默认 8GB
  }
}
```

### 3.2 批处理优化

```typescript
// edge/inference/batch-processor.ts
class BatchProcessor {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private readonly maxBatchSize = 8;
  private readonly maxWaitTime = 50; // ms

  async addRequest(request: InferenceRequest): Promise<InferenceResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        request,
        resolve,
        reject,
        enqueuedAt: Date.now(),
      });

      this.scheduleProcess();
    });
  }

  private scheduleProcess(): void {
    if (this.processing) return;

    // 等待足够多的请求或超时
    const timeout = setTimeout(() => {
      this.processBatch();
    }, this.maxWaitTime);

    if (this.queue.length >= this.maxBatchSize) {
      clearTimeout(timeout);
      this.processBatch();
    }
  }

  private async processBatch(): Promise<void> {
    if (this.queue.length === 0) return;

    this.processing = true;

    // 收集请求
    const batch = this.queue.splice(0, this.maxBatchSize);

    try {
      // 批量推理
      const results = await this.modelServer.inferBatch(
        batch.map(b => b.request)
      );

      // 分发结果
      for (let i = 0; i < batch.length; i++) {
        batch[i].resolve(results[i]);
      }
    } catch (error) {
      for (const item of batch) {
        item.reject(error);
      }
    } finally {
      this.processing = false;

      // 继续处理剩余请求
      if (this.queue.length > 0) {
        this.scheduleProcess();
      }
    }
  }
}
```

---

## 4. 边缘缓存

### 4.1 分布式缓存

```typescript
// edge/cache/distributed-cache.ts
interface CacheEntry {
  key: string;
  value: any;
  version: string;
  ttl: number;
  createdAt: number;
  source: 'local' | 'peer' | 'central';
}

class EdgeCacheManager {
  private localCache: Map<string, CacheEntry> = new Map();
  private peerClients: Map<string, PeerClient> = new Map();
  private syncInterval = 5000; // 5 秒同步

  constructor(
    private nodeId: string,
    private centralCache: CentralCacheClient
  ) {
    this.startPeerDiscovery();
    this.startSync();
  }

  async get(key: string): Promise<CacheEntry | null> {
    // 1. 检查本地缓存
    const local = this.localCache.get(key);
    if (local && !this.isExpired(local)) {
      return local;
    }

    // 2. 检查 peer 缓存
    for (const [peerId, client] of this.peerClients) {
      try {
        const peerValue = await client.get(key);
        if (peerValue && !this.isExpired(peerValue)) {
          // 回填本地
          this.localCache.set(key, peerValue);
          return peerValue;
        }
      } catch {
        // Peer 不可用，继续
      }
    }

    // 3. 从中心获取
    const central = await this.centralCache.get(key);
    if (central) {
      this.localCache.set(key, central);
      return central;
    }

    return null;
  }

  async set(key: string, value: any, options?: SetOptions): Promise<void> {
    const entry: CacheEntry = {
      key,
      value,
      version: this.generateVersion(),
      ttl: options?.ttl || 3600,
      createdAt: Date.now(),
      source: 'local',
    };

    // 写入本地
    this.localCache.set(key, entry);

    // 广播给 peers
    this.broadcastToPeers(key, entry);

    // 异步同步到中心
    this.centralCache.set(key, entry).catch(console.error);
  }

  // Peer 发现
  private async startPeerDiscovery(): Promise<void> {
    const peers = await this.discoveryService.findPeers({
      service: 'edge-cache',
      region: this.getRegion(),
    });

    for (const peer of peers) {
      if (peer.nodeId !== this.nodeId) {
        this.peerClients.set(
          peer.nodeId,
          new PeerClient(peer.address, peer.port)
        );
      }
    }
  }

  // 定期同步
  private async startSync(): Promise<void> {
    setInterval(async () => {
      const entries = Array.from(this.localCache.entries())
        .filter(([_, e]) => !this.isExpired(e))
        .map(([k, v]) => ({ key: k, entry: v }));

      await this.centralCache.syncBatch(this.nodeId, entries);
    }, this.syncInterval);
  }
}
```

### 4.2 缓存策略

```yaml
# edge/cache-strategies.yaml
cacheStrategies:
  # 代码模板缓存 (长期)
  codeTemplates:
    tier: "edge-permanent"
    ttl: -1 # 永不过期
    sizeLimit: "1Gi"
    evictionPolicy: "lru"
    preload: true

  # LLM 响应缓存 (中期)
  llmResponses:
    tier: "edge-medium"
    ttl: 3600
    sizeLimit: "500Mi"
    evictionPolicy: "lru"
    invalidation: "manual"

  # 项目元数据缓存 (短期)
  projectMetadata:
    tier: "edge-short"
    ttl: 300
    sizeLimit: "100Mi"
    evictionPolicy: "ttl"

  # 用户会话缓存 (实时)
  userSessions:
    tier: "local-only"
    ttl: 1800
    sizeLimit: "50Mi"
    evictionPolicy: "lru"

# 区域亲和性
regionalAffinity:
  - region: "us-east"
    cachePriority:
      - edge-us-east-1
      - edge-us-east-2
      - central
  - region: "eu-west"
    cachePriority:
      - edge-eu-west-1
      - central
```

---

## 5. 边缘编排

### 5.1 任务调度

```typescript
// edge/orchestration/task-scheduler.ts
interface EdgeTask {
  id: string;
  type: 'generation' | 'inference' | 'analysis';
  priority: number;
  requirements: {
    minGPU?: number;
    minMemory?: number;
    maxLatency?: number;
  };
  payload: any;
  deadline?: number;
}

class EdgeTaskScheduler {
  private queues: Map<string, EdgeTask[]> = new Map();
  private nodes: Map<string, EdgeNode> = new Map();

  async scheduleTask(task: EdgeTask): Promise<ScheduleResult> {
    // 1. 找到符合条件的节点
    const candidates = await this.findCandidateNodes(task.requirements);

    if (candidates.length === 0) {
      // 降级到中心
      return this.scheduleToCentral(task);
    }

    // 2. 选择最佳节点
    const selectedNode = this.selectBestNode(candidates, task);

    // 3. 发送任务到节点
    try {
      await this.sendToNode(selectedNode, task);
      return {
        scheduled: true,
        nodeId: selectedNode.id,
        estimatedLatency: this.estimateLatency(selectedNode, task),
      };
    } catch (error) {
      // 节点不可用，尝试下一个
      return this.retrySchedule(task, candidates.filter(n => n.id !== selectedNode.id));
    }
  }

  private async findCandidateNodes(
    requirements: EdgeTask['requirements']
  ): Promise<EdgeNode[]> {
    const allNodes = Array.from(this.nodes.values());

    return allNodes.filter(node => {
      if (requirements.minGPU && node.availableGPU < requirements.minGPU) {
        return false;
      }
      if (requirements.minMemory && node.availableMemory < requirements.minMemory) {
        return false;
      }
      if (requirements.maxLatency) {
        const latency = this.estimateLatency(node, { requirements });
        if (latency > requirements.maxLatency) {
          return false;
        }
      }
      return node.status === 'healthy';
    });
  }

  private selectBestNode(nodes: EdgeNode[], task: EdgeTask): EdgeNode {
    // 加权评分选择
    return nodes.sort((a, b) => {
      const scoreA = this.calculateNodeScore(a, task);
      const scoreB = this.calculateNodeScore(b, task);
      return scoreB - scoreA;
    })[0];
  }

  private calculateNodeScore(node: EdgeNode, task: EdgeTask): number {
    const factors = {
      // 负载因素 (越低越好)
      loadFactor: 1 - node.currentLoad / node.maxCapacity,
      // 延迟因素 (越低越好)
      latencyFactor: 1 - node.latency / 100, // 假设 100ms 为最大值
      // GPU 可用性 (越高越好)
      gpuFactor: node.availableGPU / node.totalGPU,
      // 优先级匹配
      priorityMatch: node.supportedPriorities.includes(task.priority) ? 1 : 0,
    };

    return (
      factors.loadFactor * 0.3 +
      factors.latencyFactor * 0.3 +
      factors.gpuFactor * 0.2 +
      factors.priorityMatch * 0.2
    );
  }
}
```

### 5.2 故障转移

```yaml
# edge/failover/edge-failover.yaml
apiVersion: projectfactory.io/v1
kind: EdgeFailoverPolicy
metadata:
  name: default-failover
spec:
  # 健康检查配置
  healthCheck:
    interval: 10s
    timeout: 5s
    failureThreshold: 3
    successThreshold: 2

  # 故障转移策略
  failover:
    enabled: true
    mode: "automatic" # automatic | manual
    gracePeriod: 30s

    # 降级路径
    degradation:
      - level: 1
        trigger: "node_unreachable"
        action:
          type: "retry"
          target: "nearest_peer"
          maxRetries: 3

      - level: 2
        trigger: "multiple_nodes_unreachable"
        action:
          type: "route_to_central"
          fallbackEnabled: true

      - level: 3
        trigger: "region_outage"
        action:
          type: "failover_to_region"
          targetRegions:
            - "us-east"
            - "us-west"
            - "eu-central"

  # 恢复策略
  recovery:
    autoRecover: true
    rebalanceEnabled: true
    rebalanceDelay: 5m
```

---

## 6. 同步与一致性

### 6.1 CRDT 数据结构

```typescript
// edge/sync/crdt/ORMap.ts
// 基于 CRDT 的无冲突复制数据结构

class ORMap<K, V> {
  private state: Map<K, { value: V; vectorClock: VectorClock }> = new Map();

  set(key: K, value: V, vectorClock: VectorClock): void {
    const existing = this.state.get(key);

    if (!existing || this.isNewer(vectorClock, existing.vectorClock)) {
      this.state.set(key, { value, vectorClock });
    }
  }

  get(key: K): V | undefined {
    return this.state.get(key)?.value;
  }

  merge(other: ORMap<K, V>): void {
    for (const [key, { value, vectorClock }] of other.state) {
      this.set(key, value, vectorClock);
    }
  }

  private isNewer(a: VectorClock, b: VectorClock): boolean {
    let aGreater = false;
    let bGreater = false;

    for (const [node, aTime] of a.entries()) {
      const bTime = b.get(node) || 0;
      if (aTime > bTime) aGreater = true;
      if (aTime < bTime) bGreater = true;
    }

    return aGreater && !bGreater;
  }
}

// 项目状态同步
class ProjectStateSync {
  private stateMap: ORMap<string, ProjectState>;
  private syncChannel: SyncChannel;

  async onLocalUpdate(projectId: string, update: ProjectUpdate): void {
    const clock = this.vectorClock.increment(this.nodeId);
    this.stateMap.set(projectId, {
      ...update,
      vectorClock: clock,
    });

    // 广播更新
    await this.syncChannel.broadcast({
      type: 'state-update',
      projectId,
      update,
      clock,
    });
  }

  async onRemoteUpdate(remoteUpdate: RemoteUpdate): void {
    const current = this.stateMap.get(remoteUpdate.projectId);

    if (!current || this.isNewer(remoteUpdate.clock, current.vectorClock)) {
      this.stateMap.set(remoteUpdate.projectId, {
        ...remoteUpdate.update,
        vectorClock: remoteUpdate.clock,
      });
    }
  }
}
```

---

## 7. 离线支持

### 7.1 离线队列

```typescript
// edge/offline/offline-queue.ts
interface OfflineOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'idea' | 'project' | 'file';
  payload: any;
  timestamp: number;
  retries: number;
  maxRetries: 5;
}

class OfflineQueueManager {
  private queue: OfflineOperation[] = [];
  private db: IndexedDB;

  constructor() {
    this.db = new IndexedDB('projectfactory-offline');
  }

  async enqueue(operation: Omit<OfflineOperation, 'id' | 'retries'>): Promise<void> {
    const op: OfflineOperation = {
      ...operation,
      id: crypto.randomUUID(),
      retries: 0,
    };

    await this.db.put('operations', op);
    this.queue.push(op);

    // 尝试立即同步
    if (navigator.onLine) {
      this.processQueue();
    }
  }

  async processQueue(): Promise<void> {
    if (!navigator.onLine) return;

    const pending = await this.db.getAll('operations');

    for (const op of pending) {
      try {
        await this.syncOperation(op);
        await this.db.delete('operations', op.id);
      } catch (error) {
        op.retries++;

        if (op.retries >= op.maxRetries) {
          await this.db.put('failed_operations', op);
          await this.db.delete('operations', op.id);
        } else {
          await this.db.put('operations', op);
        }
      }
    }
  }

  private async syncOperation(op: OfflineOperation): Promise<void> {
    const response = await fetch(`${API_BASE}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(op),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }
  }
}
```

### 7.2 离线检测

```typescript
// edge/offline/connectivity-detector.ts
class ConnectivityDetector {
  private listeners: Set<(online: boolean) => void> = new Set();
  private currentState: boolean = navigator.onLine;

  constructor() {
    window.addEventListener('online', () => this.handleChange(true));
    window.addEventListener('offline', () => this.handleChange(false));
  }

  isOnline(): boolean {
    return this.currentState;
  }

  async checkRealConnectivity(): Promise<boolean> {
    if (!this.currentState) return false;

    try {
      const response = await fetch(`${API_BASE}/health`, {
        method: 'HEAD',
        cache: 'no-store',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  onConnectivityChange(callback: (online: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private handleChange(online: boolean): void {
    if (this.currentState !== online) {
      this.currentState = online;
      this.listeners.forEach(cb => cb(online));
    }
  }
}
```

---

## 8. 相关文档

- [服务网格](./SERVICE_MESH.md)
- [缓存策略](./CACHING_STRATEGY.md)
- [事件驱动架构](./EVENT_DRIVEN_ARCHITECTURE.md)
- [混沌工程](./CHAOS_ENGINEERING.md)
- [监控与告警](./MONITORING_ALERTING.md)

---

**最后更新**: 2026-04-14
