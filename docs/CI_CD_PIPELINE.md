# CI/CD 流水线设计

## 1. 概述

本文档描述 ProjectFactory 系统的持续集成/持续部署（CI/CD）流水线设计方案，包括构建、测试、部署流程。

### 1.1 设计目标

| 目标 | 描述 |
|------|------|
| 快速迭代 | 代码提交到部署 < 15 分钟 |
| 高可靠性 | 部署成功率 > 99% |
| 零停机 | 滚动部署，无服务中断 |
| 自动化 | 全流程自动化，最小化人工干预 |
| 可追溯 | 每次部署可追溯到代码版本 |

### 1.2 流水线架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CI/CD 流水线架构                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  代码提交                                                                    │
│      ↓                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      CI Pipeline (GitHub Actions)                     │   │
│  │                                                                       │   │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐           │   │
│  │  │ Checkout│ →  │  Install │ →  │  Lint   │ →  │  Test   │           │   │
│  │  │   Code  │    │   Deps   │    │         │    │         │           │   │
│  │  └─────────┘    └─────────┘    └─────────┘    └─────────┘           │   │
│  │                                                            ↓           │   │
│  │                              ┌─────────┐    ┌─────────┐    ┌─────────┐│   │
│  │                              │  Build  │ →  │ Security│ →  │  Push   ││   │
│  │                              │         │    │  Scan   │    │  Image  ││   │
│  │                              └─────────┘    └─────────┘    └─────────┘│   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                          │
│  镜像推送                                                                    │
│      ↓                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      CD Pipeline (ArgoCD)                             │   │
│  │                                                                       │   │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐            │   │
│  │  │ Staging │ →  │  E2E    │ →  │   Prod  │ →  │  Sync   │            │   │
│  │  │ Deploy  │    │  Tests  │    │ Blue/Green│  │ Monitor │            │   │
│  │  └─────────┘    └─────────┘    └─────────┘    └─────────┘            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. CI 流水线

### 2.1 工作流定义

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

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
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run TypeScript type check
        run: npm run typecheck

  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests with coverage
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint, test]
    if: github.event_name == 'push'
    outputs:
      image_tag: ${{ steps.meta.outputs.tags }}
      sha_tag: ${{ env.IMAGE_TAG }}
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push backend image
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build and push frontend image
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          push: true
          tags: ${{ steps.meta.outputs.tags }}-frontend
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Generate image tag
        run: echo "IMAGE_TAG=sha-${{ github.sha }}" >> $GITHUB_ENV

  security:
    name: Security Scan
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: '${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ env.IMAGE_TAG }}'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

      - name: Run Trivy config scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          security-checks: 'config'
          format: 'table'
          exit-code: '1'
          severity: 'CRITICAL,HIGH'

  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [build, security]
    if: github.event_name == 'push'
    environment:
      name: staging
      url: https://staging.projectfactory.io
    steps:
      - uses: actions/checkout@v4

      - name: Setup test environment
        run: |
          kubectl config use-context staging
          echo "${{ secrets.KUBE_CONFIG_STAGING }}" | base64 -d > kubeconfig

      - name: Run Playwright tests
        uses: microsoft/playwright-github-action@v1
        with:
          install-dependencies: true
          test-pattern: tests/e2e/**/*.spec.ts

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14
```

### 2.2 构建配置

```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 复制源码
COPY . .

# 构建
RUN npm run build

# 生产镜像
FROM node:20-alpine AS production

# 安全用户
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

# 复制构建产物
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# 环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 安全配置
USER nodejs

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# 启动
CMD ["node", "dist/main.js"]
```

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ENV NODE_ENV=production
RUN npm run build

# Nginx 生产镜像
FROM nginx:alpine AS production

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

# 安全配置
USER nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

### 2.3 Nginx 配置

```nginx
# frontend/nginx.conf
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'rt=$request_time uct="$upstream_connect_time" '
                    'uht="$upstream_header_time" urt="$upstream_response_time"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;

    # 限流
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_conn_zone $binary_remote_addr zone=conn_limit:10m;

    server {
        listen 80;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;

        # 安全头
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        # SPA 路由
        location / {
            try_files $uri $uri/ /index.html;

            # 缓存静态资源
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }

        # API 代理
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            limit_conn conn_limit 10;

            proxy_pass http://backend:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;

            # 超时配置
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # 健康检查
        location /health {
            access_log off;
            return 200 'healthy';
        }
    }
}
```

---

## 3. CD 流水线

### 3.1 ArgoCD 应用定义

```yaml
# k8s/argocd/application.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: project-factory
  namespace: argocd
  labels:
    app: project-factory
spec:
  project: default
  source:
    repoURL: https://github.com/projectfactory/project-factory.git
    targetRevision: HEAD
    path: k8s/production
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      retry:
        limit: 5
        backoff:
          duration: 5s
          factor: 2
          maxDuration: 3m
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas
  revisions:
    - HEAD
```

### 3.2 生产环境部署

```yaml
# k8s/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: production

resources:
  - namespace.yaml
  - backend-deployment.yaml
  - backend-service.yaml
  - frontend-deployment.yaml
  - frontend-service.yaml
  - ingress.yaml
  - configmap.yaml
  - secrets.yaml

images:
  - name: ghcr.io/projectfactory/backend
    newTag: sha-a1b2c3d4
  - name: ghcr.io/projectfactory/frontend
    newTag: sha-e5f6g7h8

commonLabels:
  environment: production
  team: platform

patchesStrategicMerge:
  - patches/backend-replicas.yaml
  - patches/frontend-replicas.yaml
```

```yaml
# k8s/production/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  labels:
    app: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: backend
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: backend
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
        - name: backend
          image: ghcr.io/projectfactory/backend:latest
          ports:
            - containerPort: 3000
              name: http
          envFrom:
            - configMapRef:
                name: backend-config
            - secretRef:
                name: backend-secrets
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 10
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 3
          securityContext:
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {}
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app: backend
                topologyKey: kubernetes.io/hostname
```

### 3.3 蓝绿部署

```yaml
# k8s/production/blue-green-deployment.yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: backend-bluegreen
spec:
  replicas: 5
  strategy:
    blueGreen:
      activeService: backend-active
      previewService: backend-preview
      autoPromotionEnabled: false
      scaleDownDelaySeconds: 60
      prePromotionChecks:
        - pause: {}  # 手动确认
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: backend
          image: ghcr.io/projectfactory/backend:latest
          ports:
            - containerPort: 3000
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
```

```bash
# 部署命令
kubectl argo rollouts set image backend-bluegreen \
  backend=ghcr.io/projectfactory/backend:sha-newcommitsha

# 手动 promote
kubectl argo rollouts promote backend-bluegreen

# 回滚
kubectl argo rollouts undo backend-bluegreen
```

---

## 4. 部署策略

### 4.1 金丝雀发布

```yaml
# k8s/production/canary-deployment.yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: backend-canary
spec:
  replicas: 10
  strategy:
    canary:
      steps:
        - setWeight: 5
        - pause: {duration: 5m}
        - setWeight: 20
        - pause: {duration: 10m}
        - setWeight: 50
        - pause: {}
      canaryMetadata:
        labels:
          track: canary
      stableMetadata:
        labels:
          track: stable
      trafficRouting:
        nginx:
          stableIngress: backend-stable
          additionalIngressAnnotations:
            canary-by-header: X-Canary
      analysis:
        templates:
          - templateName: success-rate
        startingStep: 1
        args:
          - name: service-name
            value: backend-canary
  selector:
    matchLabels:
      app: backend
  template:
    spec:
      containers:
        - name: backend
          image: ghcr.io/projectfactory/backend:sha-newcommitsha
```

```yaml
# analysis-template.yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
spec:
  args:
    - name: service-name
  metrics:
    - name: success-rate
      interval: 1m
      successCondition: result[0] >= 0.95
      failureLimit: 3
      provider:
        prometheus:
          address: http://prometheus:9090
          query: |
            sum(rate(http_requests_total{service="{{args.service-name}}",status!~"5.."}[5m]))
            /
            sum(rate(http_requests_total{service="{{args.service-name}}"}[5m]))
    - name: latency
      interval: 1m
      successCondition: result[0] <= 1000
      failureLimit: 3
      provider:
        prometheus:
          address: http://prometheus:9090
          query: |
            histogram_quantile(0.95,
              sum(rate(http_request_duration_seconds_bucket{service="{{args.service-name}}"}[5m])) by (le)
            )
```

### 4.2 回滚策略

```yaml
# k8s/production/rollback-policy.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: automatic-rollback-check
  namespace: production
spec:
  schedule: "*/5 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: checker
              image: bitnami/kubectl:latest
              command:
                - /bin/sh
                - -c
                - |
                  # 检查最近部署的错误率
                  ERROR_RATE=$(kubectl exec -n production \
                    $(kubectl get pod -n production -l app=backend -o jsonpath='{.items[0].metadata.name}') \
                    -c backend -- \
                    curl -s http://localhost:3000/metrics | \
                    grep 'http_requests_total{status="500"}' | \
                    awk '{print $2}')

                  if [ ! -z "$ERROR_RATE" ] && [ "$ERROR_RATE" -gt 10 ]; then
                    echo "High error rate detected, initiating rollback"
                    kubectl argo rollouts undo backend-canary
                  fi
          restartPolicy: OnFailure
```

---

## 5. 环境管理

### 5.1 环境配置

```yaml
# k8s/environments/dev/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: dev

commonLabels:
  environment: dev

patchesStrategicMerge:
  - patches/resources.yaml

images:
  - name: ghcr.io/projectfactory/backend
    newTag: dev-${{ env.COMMIT_SHA }}

configMapGenerator:
  - name: backend-config
    literals:
      - NODE_ENV=development
      - LOG_LEVEL=debug
      - DB_HOST=postgres-dev
      - REDIS_HOST=redis-dev
      - LLM_PROVIDER=openai
```

```yaml
# k8s/environments/staging/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: staging

commonLabels:
  environment: staging

patchesStrategicMerge:
  - patches/resources.yaml

images:
  - name: ghcr.io/projectfactory/backend
    newTag: sha-${{ env.COMMIT_SHA }}
```

```yaml
# k8s/environments/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: production

commonLabels:
  environment: production

patchesStrategicMerge:
  - patches/resources.yaml

images:
  - name: ghcr.io/projectfactory/backend
    newTag: sha-${{ env.IMAGE_TAG }}
```

### 5.2 密钥管理

```yaml
# k8s/production/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: backend-secrets
  namespace: production
type: Opaque
stringData:
  LLM_API_KEY: ${LLM_API_KEY}
  DATABASE_URL: postgresql://user:password@postgres:5432/projectfactory
  JWT_SECRET: ${JWT_SECRET}
  SESSION_SECRET: ${SESSION_SECRET}
---
# 使用 Sealed Secrets 加密
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: backend-secrets
  namespace: production
spec:
  encryptedData:
    LLM_API_KEY: AgA2...
    DATABASE_URL: AgB3...
    JWT_SECRET: AgC4...
    SESSION_SECRET: AgD5...
```

---

## 6. 发布流程

### 6.1 发布审批工作流

```yaml
# .github/workflows/release.yml
name: Release Pipeline

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Release version (e.g., v1.2.3)'
        required: true
      environment:
        description: 'Target environment'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production

jobs:
  pre-release-check:
    name: Pre-release Checks
    runs-on: ubuntu-latest
    steps:
      - name: Check version format
        run: |
          if [[ ! "${{ github.event.inputs.version }}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "Invalid version format. Use v1.2.3"
            exit 1
          fi

      - name: Check no uncommitted changes
        run: |
          if [[ -n "$(git status --porcelain)" ]]; then
            echo "Uncommitted changes detected"
            exit 1
          fi

      - name: Check release branch
        run: |
          if [[ "${{ github.ref }}" != "refs/heads/main" ]]; then
            echo "Releases only from main branch"
            exit 1
          fi

  create-release:
    name: Create Release
    needs: pre-release-check
    runs-on: ubuntu-latest
    outputs:
      release_id: ${{ steps.create_release.outputs.id }}
    steps:
      - uses: actions/checkout@v4

      - name: Create release
        id: create_release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.event.inputs.version }}
          release_name: Release ${{ github.event.inputs.version }}
          draft: true
          prerelease: false

  deploy-staging:
    name: Deploy to Staging
    needs: create-release
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Deploy to staging
        run: |
          kubectl config use-context staging
          kubectl set image deployment/backend \
            backend=ghcr.io/projectfactory/backend:${{ github.event.inputs.version }}
          kubectl rollout status deployment/backend --timeout=10m

      - name: Run smoke tests
        run: |
          curl -f https://staging.projectfactory.io/health || exit 1

  deploy-production:
    name: Deploy to Production
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Approval check
        run: |
          echo "Waiting for manual approval..."

      - name: Deploy to production
        run: |
          kubectl config use-context production
          kubectl argo rollouts set image backend \
            backend=ghcr.io/projectfactory/backend:${{ github.event.inputs.version }}
          kubectl argo rollouts promote backend

      - name: Monitor rollout
        run: |
          kubectl argo rollouts get rollout backend --watch &
          sleep 60
          kubectl argo rollouts status backend

  publish-release:
    name: Publish Release
    needs: deploy-production
    runs-on: ubuntu-latest
    steps:
      - name: Publish release
        run: |
          # 更新 release 为非草稿
          curl -X PATCH https://api.github.com/repos/${{ github.repository }}/releases/${{ needs.create-release.outputs.release_id }} \
            -H "Authorization: token ${{ secrets.GITHUB_TOKEN }}" \
            -d '{"draft": false}'

      - name: Notify Slack
        uses: slackapi/slack-github-action@v1
        with:
          channel-id: 'C0123456789'
          slack-message: ":rocket: Release ${{ github.event.inputs.version }} deployed to production"
```

### 6.2 发布检查清单

```markdown
# Release Checklist

## Pre-release
- [ ] 所有 CI 测试通过
- [ ] 安全扫描无 Critical/High 漏洞
- [ ] 更新 CHANGELOG.md
- [ ] 更新版本号

## Staging 部署
- [ ] E2E 测试通过
- [ ] 手动测试关键功能
- [ ] 性能基准测试通过

## Production 部署
- [ ] 产品经理审批
- [ ] 技术负责人审批
- [ ] 运营通知
- [ ] 回滚计划准备

## Post-release
- [ ] 监控系统正常
- [ ] 无错误率飙升
- [ ] 性能指标正常
- [ ] 更新文档
```

---

## 7. 相关文档

- [部署架构](./DEPLOYMENT_ARCHITECTURE.md)
- [测试策略](./TESTING_STRATEGY.md)
- [性能优化](./PERFORMANCE_OPTIMIZATION.md)

---

**最后更新**: 2026-04-14
