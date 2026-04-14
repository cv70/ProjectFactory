# 部署指南

## 1. 部署架构

### 1.1 生产环境架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        负载均衡层                                │
│  Nginx / Cloudflare                                            │
└─────────────────────────────────────────────────────────────────┘
                    ↕ HTTP/HTTPS
┌─────────────────────────────────────────────────────────────────┐
│                        应用层 (3副本)                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ App #1   │  │ App #2   │  │ App #3   │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────────┘
         ↕              ↕              ↕
┌─────────────────────────────────────────────────────────────────┐
│                        数据层                                   │
│  ┌──────────┐  ┌──────────┐                                 │
│  │  SQLite  │  │  Redis   │                                 │
│  │ (Primary)│  │ (Cache)  │                                 │
│  └──────────┘  └──────────┘                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 环境配置

| 环境 | 用途 | 规格 | 副本数 |
|------|------|------|--------|
| Development | 开发测试 | 2C/4G/20G | 1 |
| Staging | 预发布验证 | 4C/8G/50G | 2 |
| Production | 生产环境 | 8C/16G/100G | 3 |

## 2. Docker部署

### 2.1 Docker Compose配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  # 后端API
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: projectfactory-api
    environment:
      NODE_ENV: ${NODE_ENV:-production}
      PORT: 3000
      DATABASE_URL: sqlite:///app/data/data.db
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    volumes:
      - ./storage:/app/storage
    ports:
      - "3000:3000"
    depends_on:
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # 前端
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: projectfactory-frontend
    ports:
      - "80:80"
    depends_on:
      - api
    restart: unless-stopped

  # Redis
  redis:
    image: redis:7-alpine
    container_name: projectfactory-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped
    command: redis-server --appendonly yes

  # Nginx (可选，用于生产环境)
  nginx:
    image: nginx:alpine
    container_name: projectfactory-nginx
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - api
    restart: unless-stopped

volumes:
  redis-data:
```

### 2.2 后端Dockerfile

```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS builder

# 安装依赖
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 复制源码
COPY ./

# 构建
RUN npm run build

# 生产镜像
FROM node:20-alpine

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /app/storage && \
    chown -R nodejs:nodejs /app

WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/index.js"]
```

### 2.3 前端Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 生产镜像
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### 2.4 前端Nginx配置

```nginx
# frontend/nginx.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # SPA路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API代理
    location /api {
        proxy_pass http://api:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 静态资源缓存
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

## 3. Kubernetes部署

### 3.1 Namespace配置

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: projectfactory
  labels:
    name: projectfactory
    environment: production
```

### 3.2 ConfigMap

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: projectfactory-config
  namespace: projectfactory
data:
  NODE_ENV: "production"
  PORT: "3000"
  REDIS_URL: "redis://redis-service:6379"
  LOG_LEVEL: "info"
  LOG_FORMAT: "json"
  METRICS_ENABLED: "true"
  METRICS_PORT: "9090"
  RATE_LIMIT_MAX: "100"
  RATE_LIMIT_WINDOW: "60000"
  MAX_CONCURRENT_PROJECTS: "5"
  MAX_LLM_CONCURRENCY: "10"
```

### 3.3 Secret

```yaml
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: projectfactory-secrets
  namespace: projectfactory
type: Opaque
stringData:
  JWT_SECRET: ${JWT_SECRET}
  OPENAI_API_KEY: ${OPENAI_API_KEY}
  ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
```

### 3.4 API部署

```yaml
# k8s/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: projectfactory-api
  namespace: projectfactory
  labels:
    app: projectfactory-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: projectfactory-api
  template:
    metadata:
      labels:
        app: projectfactory-api
    spec:
      containers:
      - name: api
        image: projectfactory/api:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: projectfactory-config
        - secretRef:
            name: projectfactory-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: storage
          mountPath: /app/storage
      volumes:
      - name: storage
        persistentVolumeClaim:
          claimName: projectfactory-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: projectfactory-api
  namespace: projectfactory
spec:
  selector:
    app: projectfactory-api
  ports:
  - protocol: TCP
    port: 3000
    targetPort: 3000
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: projectfactory-api-hpa
  namespace: projectfactory
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: projectfactory-api
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

### 3.5 前端部署

```yaml
# k8s/frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: projectfactory-frontend
  namespace: projectfactory
  labels:
    app: projectfactory-frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: projectfactory-frontend
  template:
    metadata:
      labels:
        app: projectfactory-frontend
    spec:
      containers:
      - name: frontend
        image: projectfactory/frontend:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: projectfactory-frontend
  namespace: projectfactory
spec:
  selector:
    app: projectfactory-frontend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
  type: ClusterIP
```

### 3.6 Ingress配置

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: projectfactory-ingress
  namespace: projectfactory
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.projectfactory.com
    secretName: projectfactory-tls
  - hosts:
    - app.projectfactory.com
    secretName: projectfactory-tls
  rules:
  - host: api.projectfactory.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: projectfactory-api
            port:
              number: 3000
  - host: app.projectfactory.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: projectfactory-frontend
            port:
              number: 80
```

## 4. CI/CD流水线

### 4.1 GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push API
        uses: docker/build-push-action@v4
        with:
          context: ./backend
          push: true
          tags: projectfactory/api:${{ github.sha }},projectfactory/api:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build and push Frontend
        uses: docker/build-push-action@v4
        with:
          context: ./frontend
          push: true
          tags: projectfactory/frontend:${{ github.sha }},projectfactory/frontend:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure kubectl
        uses: azure/k8s-set-context@v3
        with:
          method: kubeconfig
          kubeconfig: ${{ secrets.KUBE_CONFIG }}

      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/projectfactory-api \
            api=projectfactory/api:${{ github.sha }} \
            -n projectfactory

          kubectl set image deployment/projectfactory-frontend \
            frontend=projectfactory/frontend:${{ github.sha }} \
            -n projectfactory

          kubectl rollout status deployment/projectfactory-api -n projectfactory
          kubectl rollout status deployment/projectfactory-frontend -n projectfactory

      - name: Verify deployment
        run: |
          kubectl get pods -n projectfactory
          kubectl describe deployment/projectfactory-api -n projectfactory
```

## 5. 监控和日志

### 5.1 Prometheus配置

```yaml
# k8s/prometheus-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: projectfactory
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s

    scrape_configs:
      - job_name: 'projectfactory'
        kubernetes_sd_configs:
          - role: pod
            namespaces:
              names:
                - projectfactory
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_label_app]
            action: keep
            regex: projectfactory-api
          - source_labels: [__meta_kubernetes_pod_ip]
            target_label: __address__
            replacement: $1:9090
```

### 5.2 Grafana Dashboard

```yaml
# k8s/grafana-dashboard.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-dashboard
  namespace: projectfactory
  labels:
    grafana_dashboard: "1"
data:
  projectfactory-dashboard.json: |
    {
      "dashboard": {
        "title": "ProjectFactory Metrics",
        "panels": [
          {
            "title": "API Response Time",
            "targets": [
              {
                "expr": "histogram_quantile(0.95, http_request_duration_seconds_bucket)"
              }
            ]
          },
          {
            "title": "Active Generations",
            "targets": [
              {
                "expr": "active_generations"
              }
            ]
          },
          {
            "title": "Generation Success Rate",
            "targets": [
              {
                "expr": "generation_success_rate"
              }
            ]
          }
        ]
      }
    }
```

## 6. 备份和恢复

### 6.1 备份脚本

```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="/backups/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# 备份SQLite数据库
kubectl exec -n projectfactory -c api deployment/projectfactory-api -- \
  sqlite3 /app/storage/data.db ".backup /tmp/backup.db"
kubectl cp -n projectfactory \
  projectfactory-api:/tmp/backup.db \
  "$BACKUP_DIR/data.db"

# 上传到S3
aws s3 sync "$BACKUP_DIR" s3://projectfactory-backups/$(date +%Y%m%d)/

# 清理旧备份（保留30天）
find /backups -type d -mtime +30 -exec rm -rf {} \;
```

### 6.2 恢复脚本

```bash
#!/bin/bash
# scripts/restore.sh

BACKUP_DATE=$1
BACKUP_DIR="s3://projectfactory-backups/$BACKUP_DATE"

# 恢复SQLite
aws s3 cp "$BACKUP_DIR/data.db" /tmp/data.db
kubectl cp /tmp/data.db \
  projectfactory-api:/tmp/restore.db -n projectfactory
kubectl exec -n projectfactory -c api deployment/projectfactory-api -- \
  sqlite3 /app/storage/data.db ".restore /tmp/restore.db"

# 重启服务
kubectl rollout restart deployment/projectfactory-api -n projectfactory
```

---

**版本**: 0.1.0
**更新日期**: 2026-04-14
**状态**: 设计阶段
