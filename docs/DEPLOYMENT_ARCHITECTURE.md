# 部署架构设计文档

## 1. 部署架构总览

### 1.1 部署模式

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              部署模式对比                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │      开发模式        │  │      生产模式        │  │      集群模式       │  │
│  │   (Development)     │  │   (Production)     │  │   (Kubernetes)    │  │
│  ├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤  │
│  │  • 本地开发         │  │  • 单机部署         │  │  • 容器编排         │  │
│  │  • 快速迭代         │  │  • 高可用           │  │  • 弹性伸缩         │  │
│  │  • 简化配置         │  │  • 自动运维         │  │  • 多节点分布       │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 生产部署架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              生产部署架构                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                              ┌─────────────────┐                              │
│                              │   Load Balancer │                              │
│                              │   (Nginx/HAProxy)│                              │
│                              └────────┬────────┘                              │
│                                       │                                        │
│                    ┌─────────────────┼─────────────────┐                    │
│                    │                 │                 │                    │
│                    ▼                 ▼                 ▼                    │
│              ┌──────────┐      ┌──────────┐      ┌──────────┐           │
│              │  API     │      │  API     │      │  API     │           │
│              │  Server 1│      │  Server 2│      │  Server 3│           │
│              └────┬─────┘      └────┬─────┘      └────┬─────┘           │
│                   │                 │                 │                    │
│                   └─────────────────┼─────────────────┘                    │
│                                     │                                      │
│                    ┌────────────────┼────────────────┐                    │
│                    │                │                │                    │
│                    ▼                ▼                ▼                    │
│              ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│              │  Worker  │    │  Worker  │    │  Worker  │             │
│              │  Process │    │  Process │    │  Process │             │
│              └────┬─────┘    └────┬─────┘    └────┬─────┘             │
│                   │                 │                 │                    │
│                   └─────────────────┼─────────────────┘                    │
│                                     │                                      │
│                    ┌─────────────────┼─────────────────┐                    │
│                    │                 │                 │                    │
│                    ▼                 ▼                 ▼                    │
│              ┌──────────┐      ┌──────────┐      ┌──────────┐           │
│              │  SQLite  │      │  SQLite  │      │  SQLite  │           │
│              │  (共享存储)│      │  (复制)   │      │  (复制)   │           │
│              └──────────┘      └──────────┘      └──────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. Docker 容器化

### 2.1 Dockerfile

```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS base

# 安装依赖阶段
FROM base AS deps
WORKDIR /app

# 复制 package files
COPY package.json package-lock.json* ./

# 安装依赖
RUN npm ci --only=production && npm cache clean --force

# 构建阶段
FROM base AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# 生产阶段
FROM base AS runner
WORKDIR /app

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 app

# 复制构建产物
COPY --from=deps --chown=app:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=app:nodejs /app/dist ./dist

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3001

# 暴露端口
EXPOSE 3001

# 切换用户
USER app

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3001/health || exit 1

# 启动命令
CMD ["node", "dist/main.js"]
```

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# Nginx 生产镜像
FROM nginx:alpine AS runner

# 复制构建产物
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# 创建非 root 用户
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

### 2.2 Nginx 配置

```nginx
# frontend/nginx.conf
upstream backend {
    server backend:3001;
    keepalive 32;
}

server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API 代理
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket 代理
    location /ws/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 健康检查
    location /health {
        access_log off;
        return 200 "healthy";
    }
}
```

### 2.3 Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  # 前端服务
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped

  # 后端 API 服务
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - LLM_API_KEY=${LLM_API_KEY}
      - DATABASE_URL=./data/project-factory.db
    volumes:
      - ./data:/app/data
      - ./projects:/app/projects
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    networks:
      - app-network
    restart: unless-stopped

networks:
  app-network:
    driver: bridge
```

## 3. Kubernetes 部署

### 3.1 Kubernetes 资源定义

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: project-factory
  labels:
    name: project-factory
    env: production
```

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: project-factory-config
  namespace: project-factory
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  MAX_CONCURRENT_PROJECTS: "5"
  DATABASE_PATH: "/data/project-factory.db"
```

```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: project-factory
  labels:
    app: backend
    component: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
        component: api
    spec:
      containers:
        - name: backend
          image: project-factory/backend:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 3001
              name: http
          env:
            - name: NODE_ENV
              valueFrom:
                configMapKeyRef:
                  name: project-factory-config
                  key: NODE_ENV
            - name: LLM_API_KEY
              valueFrom:
                secretKeyRef:
                  name: project-factory-secrets
                  key: llm-api-key
            - name: DATABASE_PATH
              valueFrom:
                configMapKeyRef:
                  name: project-factory-config
                  key: DATABASE_PATH
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 10
            periodSeconds: 30
            timeoutSeconds: 5
          readinessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
          volumeMounts:
            - name: data
              mountPath: /data
            - name: projects
              mountPath: /app/projects
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: project-factory-data
        - name: projects
          persistentVolumeClaim:
            claimName: project-factory-projects
```

```yaml
# k8s/frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: project-factory
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: frontend
          image: project-factory/frontend:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 80
              name: http
          resources:
            requests:
              memory: "64Mi"
              cpu: "50m"
            limits:
              memory: "256Mi"
              cpu: "200m"
          livenessProbe:
            httpGet:
              path: /health
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 10
```

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: project-factory
spec:
  selector:
    app: backend
  ports:
    - port: 3001
      targetPort: 3001
      name: http
  type: ClusterIP

---
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
  namespace: project-factory
spec:
  selector:
    app: frontend
  ports:
    - port: 80
      targetPort: 80
      name: http
  type: ClusterIP

---
apiVersion: v1
kind: Service
metadata:
  name: frontend-loadbalancer
  namespace: project-factory
spec:
  selector:
    app: frontend
  ports:
    - port: 80
      targetPort: 80
      name: http
    - port: 443
      targetPort: 443
      name: https
  type: LoadBalancer
```

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: project-factory
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

```yaml
# k8s/pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: project-factory-data
  namespace: project-factory
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: standard

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: project-factory-projects
  namespace: project-factory
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
  storageClassName: standard
```

### 3.2 Ingress 配置

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: project-factory-ingress
  namespace: project-factory
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "300"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - projectfactory.example.com
      secretName: project-factory-tls
  rules:
    - host: projectfactory.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: backend-service
                port:
                  number: 3001
          - path: /ws
            pathType: Prefix
            backend:
              service:
                name: backend-service
                port:
                  number: 3001
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-service
                port:
                  number: 80
```

## 4. CI/CD 流水线

### 4.1 GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # 阶段 1: 代码检查
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Type check
        run: npm run typecheck

  # 阶段 2: 单元测试
  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage.xml

  # 阶段 3: 构建
  build:
    name: Build Images
    runs-on: ubuntu-latest
    needs: test
    if: github.event_name == 'push'
    outputs:
      backend-image: ${{ steps.meta.outputs.tags['backend'] }}
      frontend-image: ${{ steps.meta.outputs.tags['frontend'] }}

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata (Backend)
        id: meta-backend
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/backend
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push (Backend)
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: ${{ steps.meta-backend.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Extract metadata (Frontend)
        id: meta-frontend
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push (Frontend)
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          push: true
          tags: ${{ steps.meta-frontend.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # 阶段 4: 部署到 Staging
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/develop'
    environment: staging

    steps:
      - name: Deploy to staging cluster
        run: |
          kubectl config use-context staging
          kubectl set image deployment/backend backend=${{ needs.build.outputs.backend-image }}
          kubectl set image deployment/frontend frontend=${{ needs.build.outputs.frontend-image }}
          kubectl rollout status deployment/backend
          kubectl rollout status deployment/frontend

  # 阶段 5: 部署到 Production
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
      - name: Deploy to production cluster
        run: |
          kubectl config use-context production
          kubectl set image deployment/backend backend=${{ needs.build.outputs.backend-image }}
          kubectl set image deployment/frontend frontend=${{ needs.build.outputs.frontend-image }}
          kubectl rollout status deployment/backend
          kubectl rollout status deployment/frontend
```

## 5. 运维监控

### 5.1 健康检查端点

```typescript
// 健康检查端点实现

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: HealthCheck;
    llm: HealthCheck;
    storage: HealthCheck;
    workers: HealthCheck;
  };
}

interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  latency?: number;
  message?: string;
}

app.get('/health', async (req, res) => {
  const checks: HealthStatus['checks'] = {
    database: await checkDatabase(),
    llm: await checkLLM(),
    storage: await checkStorage(),
    workers: await checkWorkers()
  };

  const allPass = Object.values(checks).every(c => c.status === 'pass');
  const anyFail = Object.values(checks).some(c => c.status === 'fail');

  const status: HealthStatus = {
    status: anyFail ? 'unhealthy' : allPass ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION || '1.0.0',
    checks
  };

  const statusCode = anyFail ? 503 : allPass ? 200 : 200;
  res.status(statusCode).json(status);
});

// 检查函数
async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await db.execute({ sql: 'SELECT 1' });
    return { status: 'pass', latency: Date.now() - start };
  } catch (error) {
    return { status: 'fail', message: (error as Error).message };
  }
}

async function checkLLM(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const response = await llmClient.healthCheck();
    return { status: 'pass', latency: Date.now() - start };
  } catch (error) {
    return { status: 'fail', message: (error as Error).message };
  }
}

async function checkStorage(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const fs = require('fs');
    const path = require('path');
    const testFile = path.join(process.cwd(), '.healthcheck');
    fs.writeFileSync(testFile, 'check');
    fs.unlinkSync(testFile);
    return { status: 'pass', latency: Date.now() - start };
  } catch (error) {
    return { status: 'fail', message: (error as Error).message };
  }
}

async function checkWorkers(): Promise<HealthCheck> {
  const activeWorkers = await workerManager.getActiveCount();
  const maxWorkers = config.maxConcurrentProjects;

  if (activeWorkers === 0) {
    return { status: 'warn', message: 'No active workers' };
  }

  if (activeWorkers >= maxWorkers) {
    return { status: 'warn', message: 'All workers busy' };
  }

  return { status: 'pass', message: `${activeWorkers}/${maxWorkers} workers active` };
}
```

### 5.2 日志管理

```typescript
// 日志配置

import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const esTransportOpts = {
  level: 'info',
  clientOpts: {
    node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    auth: process.env.ELASTICSEARCH_AUTH
  },
  indexPrefix: 'project-factory'
};

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'project-factory',
    version: process.env.APP_VERSION
  },
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),

    // 文件输出
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    }),

    // Elasticsearch (生产环境)
    ...(process.env.NODE_ENV === 'production'
      ? [new ElasticsearchTransport(esTransportOpts)]
      : [])
  ]
});

// 结构化日志
logger.log('info', 'Project generation started', {
  projectId: 'proj_123',
  ideaId: 'idea_456',
  stage: 'ideation'
});
```

---

**版本**: 1.0.0
**创建日期**: 2026-04-14
**状态**: 部署架构设计完成
