# WebSocket 与实时通信设计

## 1. 概述

本文档描述 ProjectFactory 系统的 WebSocket 与实时通信架构，支持即时消息推送和双向通信。

### 1.1 设计目标

| 目标 | 描述 |
|------|------|
| 低延迟 | 消息延迟 < 100ms |
| 高并发 | 支持 10,000+ 并发连接 |
| 可靠性 | 消息确认与重传 |
| 可扩展 | 支持集群部署 |
| 断线恢复 | 自动重连与消息同步 |

### 1.2 实时通信架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        实时通信架构                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  客户端                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  WebSocket Client                                                     │   │
│  │  - 自动重连 (指数退避)                                                │   │
│  │  - 消息队列                                                           │   │
│  │  - 心跳检测                                                           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ↑                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Socket.io Gateway                                 │   │
│  │                                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │   │
│  │  │  认证       │  │   限流      │  │   路由      │                  │   │
│  │  │  中间件     │  │   中间件    │  │   中间件    │                  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ↑                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Redis Adapter (集群)                              │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ↑                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      业务服务 (多个实例)                               │   │
│  │                                                                       │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │   │
│  │  │ Project │  │  Idea   │  │  User   │  │ System  │                 │   │
│  │  │ Service │  │ Service │  │ Service │  │ Service │                 │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘                 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. WebSocket 服务

### 2.1 服务端实现

```typescript
// src/websocket/server.ts
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken } from '../auth/jwt';
import { rateLimitMiddleware } from '../rate-limit';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  tenantId?: string;
}

class WebSocketServer {
  private io: SocketIOServer;
  private rooms: Map<string, Set<string>> = new Map();  // room -> sockets

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingInterval: 25000,
      pingTimeout: 20000,
    });

    this.setupMiddleware();
    this.setupConnectionHandler();
  }

  private setupMiddleware() {
    // 认证中间件
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token ||
                      socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = await verifyToken(token);
        socket.userId = decoded.userId;
        socket.tenantId = decoded.tenantId;

        next();
      } catch (error) {
        next(new Error('Invalid token'));
      }
    });

    // 限流中间件
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      const clientId = socket.userId || socket.id;
      const isAllowed = await rateLimitMiddleware.check(`ws:${clientId}`);

      if (!isAllowed) {
        return next(new Error('Rate limit exceeded'));
      }

      next();
    });
  }

  private setupConnectionHandler() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`Client connected: ${socket.id}, user: ${socket.userId}`);

      // 加入用户房间
      if (socket.userId) {
        socket.join(`user:${socket.userId}`);
      }

      // 加入租户房间
      if (socket.tenantId) {
        socket.join(`tenant:${socket.tenantId}`);
      }

      // 房间管理
      this.handleRoomManagement(socket);

      // 事件处理
      this.handleEvents(socket);

      // 断开连接
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        this.cleanupSocketRooms(socket);
      });
    });
  }

  // 广播到房间
  broadcastToRoom(room: string, event: string, data: unknown) {
    this.io.to(room).emit(event, data);
  }

  // 广播到租户
  broadcastToTenant(tenantId: string, event: string, data: unknown) {
    this.io.to(`tenant:${tenantId}`).emit(event, data);
  }

  // 发送给特定用户
  sendToUser(userId: string, event: string, data: unknown) {
    this.io.to(`user:${userId}`).emit(event, data);
  }
}

export const wsServer = new WebSocketServer(httpServer);
```

### 2.2 房间管理

```typescript
// src/websocket/rooms.ts
class RoomManager {
  // 加入项目房间
  joinProjectRoom(socket: AuthenticatedSocket, projectId: string) {
    socket.join(`project:${projectId}`);
    this.trackRoomMembership(`project:${projectId}`, socket.id);
  }

  // 离开项目房间
  leaveProjectRoom(socket: AuthenticatedSocket, projectId: string) {
    socket.leave(`project:${projectId}`);
    this.untrackRoomMembership(`project:${projectId}`, socket.id);
  }

  // 加入生成进度房间
  joinGenerationRoom(socket: AuthenticatedSocket, projectId: string) {
    socket.join(`generation:${projectId}`);
  }

  // 离开生成进度房间
  leaveGenerationRoom(socket: AuthenticatedSocket, projectId: string) {
    socket.leave(`generation:${projectId}`);
  }

  // 获取房间人数
  getRoomSize(room: string): number {
    const sockets = this.io.sockets.adapter.rooms.get(room);
    return sockets?.size || 0;
  }

  // 追踪房间成员
  private trackRoomMembership(room: string, socketId: string) {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room)!.add(socketId);
  }

  private untrackRoomMembership(room: string, socketId: string) {
    this.rooms.get(room)?.delete(socketId);
    if (this.rooms.get(room)?.size === 0) {
      this.rooms.delete(room);
    }
  }

  private cleanupSocketRooms(socket: AuthenticatedSocket) {
    for (const [room, sockets] of this.rooms.entries()) {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          this.rooms.delete(room);
        }
      }
    }
  }
}
```

---

## 3. 事件类型

### 3.1 事件定义

```typescript
// src/websocket/events.ts

// 客户端 -> 服务端事件
enum ClientEvent {
  // 房间管理
  JOIN_PROJECT = 'join:project',
  LEAVE_PROJECT = 'leave:project',
  JOIN_GENERATION = 'join:generation',
  LEAVE_GENERATION = 'leave:generation',

  // 订阅
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',

  // 消息
  SEND_MESSAGE = 'message',

  // 心跳
  PING = 'ping',
}

// 服务端 -> 客户端事件
enum ServerEvent {
  // 连接
  CONNECTED = 'connected',
  ERROR = 'error',

  // 项目事件
  PROJECT_UPDATED = 'project:updated',
  PROJECT_DELETED = 'project:deleted',
  PROJECT_COMPLETED = 'project:completed',
  PROJECT_FAILED = 'project:failed',

  // 生成进度
  GENERATION_STARTED = 'generation:started',
  GENERATION_PROGRESS = 'generation:progress',
  GENERATION_STAGE_CHANGED = 'generation:stage_changed',
  GENERATION_COMPLETED = 'generation:completed',
  GENERATION_FAILED = 'generation:failed',
  GENERATION_LOG = 'generation:log',

  // Idea 事件
  IDEA_CREATED = 'idea:created',
  IDEA_UPDATED = 'idea:updated',
  IDEA_APPROVED = 'idea:approved',
  IDEA_REJECTED = 'idea:rejected',

  // 通知
  NOTIFICATION = 'notification',

  // 心跳响应
  PONG = 'pong',
}

// 事件消息格式
interface WSMessage<T = unknown> {
  id: string;          // 消息唯一 ID
  type: string;        // 事件类型
  payload: T;         // 消息数据
  timestamp: number;   // 时间戳
  acknowledged?: boolean;  // 是否已确认
}

// 生成进度消息
interface GenerationProgressMessage {
  projectId: string;
  stage: string;
  progress: number;    // 0-100
  currentFile?: string;
  logs: Array<{
    timestamp: number;
    level: 'info' | 'warn' | 'error';
    message: string;
  }>;
  estimatedTimeRemaining?: number;  // 毫秒
}
```

### 3.2 事件处理

```typescript
// src/websocket/handlers.ts
class WSEventHandler {
  constructor(
    private roomManager: RoomManager,
    private eventBus: EventBus
  ) {}

  setupHandlers(socket: AuthenticatedSocket) {
    // 加入项目房间
    socket.on(ClientEvent.JOIN_PROJECT, async (projectId: string) => {
      // 验证权限
      const hasAccess = await this.verifyProjectAccess(socket.userId!, projectId);
      if (!hasAccess) {
        socket.emit(ServerEvent.ERROR, { code: 'ACCESS_DENIED' });
        return;
      }

      this.roomManager.joinProjectRoom(socket, projectId);
      socket.emit(ServerEvent.CONNECTED, { room: `project:${projectId}` });
    });

    // 离开项目房间
    socket.on(ClientEvent.LEAVE_PROJECT, (projectId: string) => {
      this.roomManager.leaveProjectRoom(socket, projectId);
    });

    // 订阅生成进度
    socket.on(ClientEvent.JOIN_GENERATION, (projectId: string) => {
      this.roomManager.joinGenerationRoom(socket, projectId);
    });

    // 订阅 Idea 更新
    socket.on(ClientEvent.SUBSCRIBE, (data: { type: 'idea' | 'project'; id: string }) => {
      socket.join(`${data.type}:${data.id}`);
    });

    // 取消订阅
    socket.on(ClientEvent.UNSUBSCRIBE, (data: { type: string; id: string }) => {
      socket.leave(`${data.type}:${data.id}`);
    });

    // 心跳
    socket.on(ClientEvent.PING, () => {
      socket.emit(ServerEvent.PONG, { timestamp: Date.now() });
    });
  }

  // 广播生成进度
  broadcastGenerationProgress(projectId: string, progress: GenerationProgressMessage) {
    const room = `generation:${projectId}`;
    const message = this.createMessage(ServerEvent.GENERATION_PROGRESS, progress);

    wsServer.broadcastToRoom(room, ServerEvent.GENERATION_PROGRESS, message);
  }

  // 广播项目更新
  broadcastProjectUpdate(tenantId: string, project: Project) {
    wsServer.broadcastToTenant(tenantId, ServerEvent.PROJECT_UPDATED, {
      id: project.id,
      changes: project,
    });
  }

  private createMessage<T>(type: string, payload: T): WSMessage<T> {
    return {
      id: crypto.randomUUID(),
      type,
      payload,
      timestamp: Date.now(),
    };
  }

  private async verifyProjectAccess(userId: string, projectId: string): Promise<boolean> {
    const project = await projectService.getById(projectId);
    return project?.ownerId === userId;
  }
}
```

---

## 4. 消息确认与重传

### 4.1 可靠消息

```typescript
// src/websocket/reliable-messaging.ts
interface ReliableMessage<T = unknown> {
  id: string;
  type: string;
  payload: T;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

class ReliableMessaging {
  private pendingMessages: Map<string, ReliableMessage> = new Map();
  private ackTimeout = 5000;  // 5 秒

  // 发送可靠消息
  async sendReliable<T>(
    socket: AuthenticatedSocket,
    event: string,
    payload: T
  ): Promise<boolean> {
    const message: ReliableMessage<T> = {
      id: crypto.randomUUID(),
      type: event,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
    };

    // 存储消息
    this.pendingMessages.set(message.id, message);

    // 发送
    socket.emit(event, message);

    // 等待确认
    const acknowledged = await this.waitForAck(message.id);

    if (!acknowledged) {
      // 重试
      return this.retryMessage(socket, message);
    }

    return true;
  }

  // 处理确认
  handleAck(socket: AuthenticatedSocket, ackId: string) {
    const message = this.pendingMessages.get(ackId);
    if (message) {
      message.acknowledged = true;
      this.pendingMessages.delete(ackId);
    }
  }

  // 重试未确认的消息
  private async retryMessage<T>(
    socket: AuthenticatedSocket,
    message: ReliableMessage<T>
  ): Promise<boolean> {
    while (message.retryCount < message.maxRetries) {
      message.retryCount++;
      socket.emit(message.type, message);

      const acknowledged = await this.waitForAck(message.id);
      if (acknowledged) {
        return true;
      }
    }

    this.pendingMessages.delete(message.id);
    return false;
  }

  private waitForAck(messageId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, this.ackTimeout);

      // 监听确认
      const checkAck = (ackId: string) => {
        if (ackId === messageId) {
          clearTimeout(timeout);
          socket.off('message:ack', checkAck);
          resolve(true);
        }
      };

      socket.on('message:ack', checkAck);
    });
  }
}
```

### 4.2 消息队列

```typescript
// src/websocket/message-queue.ts
class WSMessageQueue {
  private queues: Map<string, ReliableMessage[]> = new Map();
  private processing = new Set<string>();

  // 添加消息到队列
  enqueue(socketId: string, message: ReliableMessage) {
    if (!this.queues.has(socketId)) {
      this.queues.set(socketId, []);
    }
    this.queues.get(socketId)!.push(message);
  }

  // 处理队列
  async processQueue(socketId: string, socket: AuthenticatedSocket) {
    if (this.processing.has(socketId)) return;
    this.processing.add(socketId);

    const queue = this.queues.get(socketId);
    if (!queue || queue.length === 0) {
      this.processing.delete(socketId);
      return;
    }

    while (queue.length > 0) {
      const message = queue[0];

      try {
        socket.emit(message.type, message.payload);
        queue.shift();

        // 短暂延迟避免发送过快
        await this.sleep(10);
      } catch (error) {
        console.error('Failed to send message:', error);
        break;
      }
    }

    this.processing.delete(socketId);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

---

## 5. 断线重连

### 5.1 客户端重连

```typescript
// src/websocket/client.ts
class WebSocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private heartbeatInterval: number | null = null;
  private messageQueue: WSMessage[] = [];

  connect(url: string, auth: { token: string }) {
    this.socket = io(url, {
      auth,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: this.maxReconnectDelay,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    // 连接成功
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.startHeartbeat();

      // 发送离线期间排队的消息
      this.flushMessageQueue();
    });

    // 断开连接
    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.stopHeartbeat();

      if (reason === 'io server disconnect') {
        // 服务端断开，稍后重连
        this.socket?.connect();
      }
    });

    // 重连尝试
    this.socket.on('reconnect_attempt', (attempt) => {
      console.log(`Reconnect attempt ${attempt}`);
      this.reconnectAttempts = attempt;
    });

    // 错误
    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
    });
  }

  // 心跳保活
  private startHeartbeat() {
    this.heartbeatInterval = window.setInterval(() => {
      this.socket?.emit('ping', { timestamp: Date.now() });
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // 发送消息 (离线时排队)
  send(event: string, payload: unknown) {
    const message: WSMessage = {
      id: crypto.randomUUID(),
      type: event,
      payload,
      timestamp: Date.now(),
    };

    if (this.socket?.connected) {
      this.socket.emit(event, message);
    } else {
      // 离线，排队
      this.messageQueue.push(message);
    }
  }

  // 发送排队的消息
  private async flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message && this.socket?.connected) {
        this.socket.emit(message.type, message.payload);
      }
    }
  }

  // 订阅事件
  on<T>(event: string, handler: (data: T) => void) {
    this.socket?.on(event, handler);
  }

  // 取消订阅
  off(event: string) {
    this.socket?.off(event);
  }

  // 断开连接
  disconnect() {
    this.stopHeartbeat();
    this.socket?.disconnect();
    this.socket = null;
  }
}

// React Hook
function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    clientRef.current = new WebSocketClient();
    clientRef.current.connect(WS_URL, { token });

    clientRef.current.on('connect', () => setConnected(true));
    clientRef.current.on('disconnect', () => setConnected(false));

    return () => {
      clientRef.current?.disconnect();
    };
  }, []);

  return {
    connected,
    send: (event: string, data: unknown) => clientRef.current?.send(event, data),
    on: (event: string, handler: (data: unknown) => void) =>
      clientRef.current?.on(event, handler),
  };
}
```

---

## 6. 集群与扩展

### 6.1 Redis Adapter

```typescript
// src/websocket/redis-adapter.ts
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

class RedisAdapterSetup {
  private pubClient: RedisClientType;
  private subClient: RedisClientType;

  async setup(): Promise<typeof import('@socket.io/redis-adapter')> {
    this.pubClient = createClient({
      url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
    });

    this.subClient = this.pubClient.duplicate();

    await Promise.all([
      this.pubClient.connect(),
      this.subClient.connect(),
    ]);

    const adapter = createAdapter(this.pubClient, this.subClient);
    return adapter;
  }
}
```

### 6.2 水平扩展

```typescript
// 多实例部署
// 使用 Redis Adapter 后，所有实例共享连接状态
// 消息可以通过 Redis 广播到所有实例

const io = new SocketIOServer({
  adapter: await new RedisAdapterSetup().setup(),
});
```

---

## 7. 相关文档

- [API 规格说明](./API_SPECIFICATION.md)
- [前端设计](./FRONTEND_DESIGN.md)
- [事件驱动架构](./EVENT_DRIVEN_ARCHITECTURE.md)

---

**最后更新**: 2026-04-14
