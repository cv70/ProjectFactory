# 服务网格架构设计

## 1. 概述

本文档描述 ProjectFactory 系统的服务网格架构设计，实现服务间通信的可观测性、安全性和流量管理。

### 1.1 服务网格架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           服务网格架构                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                              ┌─────────────┐                                │
│                              │   Control   │                                │
│                              │    Plane    │                                │
│                              │  (Istiod)   │                                │
│                              └──────┬──────┘                                │
│                                     │                                       │
│    ┌────────────────────────────────┼────────────────────────────────┐   │
│    │                                │                                │   │
│    │   Data Plane (Sidecar Proxies) │                                │   │
│    │                                │                                │   │
│    │  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐        │   │
│    │  │Idea │  │Proj │  │Agent│  │Qual │  │ LLM │  │Git  │        │   │
│    │  │Svc  │  │Svc  │  │Svc  │  │Svc  │  │Proxy│  │Svc  │        │   │
│    │  └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘        │   │
│    │     │        │        │        │        │        │             │   │
│    │     └────────┴────────┴────────┴────────┴────────┘             │   │
│    │                         mTLS 通信                               │   │
│    └─────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│    ┌─────────────────────────────────────────────────────────────────┐   │
│    │                      可观测性                                     │   │
│    │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │   │
│    │  │  Loki   │  │Prometheus│ │ Jaeger  │  │ Grafana │          │   │
│    │  └─────────┘  └─────────┘  └─────────┘  └─────────┘          │   │
│    └─────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Istio 配置

### 2.1 控制平面配置

```yaml
# istio/istiod.yaml
apiVersion: install.istio.io/v1alpha1
kind: IstioOperator
metadata:
  name: projectfactory-control-plane
spec:
  profile: default
  revision: 1-17-0

  components:
    istiod:
      enabled: true
      k8s:
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
        hpa:
          minReplicas: 2
          maxReplicas: 5
          targetCPUUtilizationPercentage: 80

  meshConfig:
    enableAutoMtls: true
    defaultConfig:
      proxyMetadata:
        ISTIO_META_DNS_CAPTURE: "true"
        ISTIO_META_DNS_AUTO_ALLOCATE: "true"
      tracing:
        sampling: 10
        zipkin:
          address: jaeger-collector.observability:9411

    # 流量管理
    trafficManagement:
      automaticPolicyAttachment: true

    # 遥测
    enableTelemetry: true

  values:
    global:
      imagePullPolicy: IfNotPresent
      imagePullSecrets:
        - name: regcred
      defaultNodeSelector: {}
      defaultTolerations:
        - key: "dedicated"
          operator: "Equal"
          value: "istio"
```

### 2.2 数据平面配置

```yaml
# istio/gateway.yaml
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
        number: 80
        name: http
        protocol: HTTP
      hosts:
        - "*"
      tls:
        httpsRedirect: true

    - port:
        number: 443
        name: https
        protocol: HTTPS
      tls:
        mode: SIMPLE
        credentialName: projectfactory-tls-cert
      hosts:
        - "*"

    - port:
        number: 9443
        name: grpc-web
        protocol: GRPC-WEB
      hosts:
        - "*"
```

### 2.3 虚拟服务配置

```yaml
# istio/virtual-service.yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: idea-service
  namespace: projectfactory
spec:
  hosts:
    - idea-service
    - idea-service.projectfactory.svc.cluster.local
  http:
    - match:
        - headers:
            x-request-type:
              exact: internal
      route:
        - destination:
            host: idea-service
            subset: stable
          weight: 100
      retries:
        attempts: 3
        perTryTimeout: 5s
        retryOn: connect-failure,refused-stream,unavailable,cancelled,retriable-status-codes

    - route:
        - destination:
            host: idea-service
            subset: stable
            port:
              number: 4001
          weight: 90
        - destination:
            host: idea-service
            subset: canary
            port:
              number: 4001
          weight: 10
      retries:
        attempts: 2
        perTryTimeout: 10s
      timeout: 30s

  exportTo:
    - "projectfactory"
```

---

## 3. 流量管理

### 3.1 流量分割

```yaml
# istio/traffic-splitting.yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: project-service-traffic-split
  namespace: projectfactory
spec:
  hosts:
    - project-service
  http:
    - route:
        # 90% 到稳定版本
        - destination:
            host: project-service-v1
            subset: stable
          weight: 90
        # 10% 到金丝雀版本
        - destination:
            host: project-service-v2
            subset: canary
          weight: 10

---
# 目标规则
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: project-service
  namespace: projectfactory
spec:
  host: project-service
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        h2UpgradePolicy: UPGRADE
        http1MaxPendingRequests: 100
        http2MaxRequests: 1000
    loadBalancer:
      simple: LEAST_CONN
      localityLbSetting:
        enabled: true
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50

  subsets:
    - name: stable
      labels:
        version: v1
    - name: canary
      labels:
        version: v2
```

### 3.2 地域负载均衡

```yaml
# istio/locality-load-balancing.yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: idea-service-locality
  namespace: projectfactory
spec:
  host: idea-service
  trafficPolicy:
    loadBalancer:
      simple: LEAST_CONN
      localityLbSetting:
        enabled: true
        distribute:
          - from: us-east-1/*
            to:
              "us-east-1/*": 80
              "us-west-2/*": 20
          - from: us-west-2/*
            to:
              "us-west-2/*": 80
              "us-east-1/*": 20
        failover:
          - from: us-east-1
            to: us-west-2
          - from: us-west-2
            to: us-east-1
```

### 3.3 熔断器配置

```yaml
# istio/circuit-breaker.yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: llm-proxy-circuit-breaker
  namespace: projectfactory
spec:
  host: llm-proxy
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 50
      http:
        http2MaxRequests: 100
        maxRequestsPerConnection: 10
    outlierDetection:
      # 连续 5 次 5xx 错误则弹出实例
      consecutive5xxErrors: 5
      interval: 10s
      baseEjectionTime: 30s
      maxEjectionPercent: 60
      minHealthPercent: 40
```

---

## 4. 安全通信

### 4.1 mTLS 配置

```yaml
# istio/peer-authentication.yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: projectfactory-mtls
  namespace: projectfactory
spec:
  mtls:
    mode: STRICT
  selector:
    matchLabels:
      app: projectfactory-services
```

```yaml
# istio/authorization-policy.yaml
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

    # 拒绝其他所有访问
    - to:
        - operation:
            paths: ["/*"]
```

### 4.2 请求认证

```yaml
# istio/request-authentication.yaml
apiVersion: security.istio.io/v1beta1
kind: RequestAuthentication
metadata:
  name: jwt-auth
  namespace: projectfactory
spec:
  selector:
    matchLabels:
      app: projectfactory-services
  jwtRules:
    - issuer: "projectfactory-auth"
      audiences:
        - "projectfactory-api"
      forwardOriginalToken: true
      validateClaims:
        - name: "exp"
          required: true
        - name: "iat"
          required: true
        - name: "sub"
          required: true
```

---

## 5. 可观测性

### 5.1 遥测配置

```yaml
# istio/telemetry.yaml
apiVersion: telemetry.istio.io/v1alpha1
kind: Telemetry
metadata:
  name: projectfactory-telemetry
  namespace: projectfactory
spec:
  tracing:
    - providers:
        - name: jaeger
      randomSamplingPercentage: 10
      useRequestIdForTraceSampling: true
      customTags:
        service.name:
          literal:
            value: $(HOSTNAME)
        service.version:
          environment:
            name: VERSION
            defaultValue: unknown

  metrics:
    - providers:
        - name: prometheus
      descriptors:
        - name: request_duration_ms
          type: HISTOGRAM
          unit: ms
          buckets:
            - 5
            - 10
            - 25
            - 50
            - 100
            - 250
            - 500
            - 1000
            - 2500
            - 5000
      overrides:
        - matchRules:
            - metricName: request_duration_ms
              customMetricTags:
                version:
                  environment:
                    name: CANARY_VERSION
                    defaultValue: stable
          tagOverrides:
            destination_service:
              operation: UPSERT
              value: "projectfactory.$(HOSTNAME)"

  accessLogging:
    - providers:
        - name: envoy
      filter:
        expression: "response.code >= 400"
```

### 5.2 指标收集

```yaml
# istio/prometheus-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: observability
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s

    scrape_configs:
      # Istio 控制平面指标
      - job_name: 'istiod'
        kubernetes_sd_configs:
          - role: pod
            namespaces:
              names:
                - istio-system
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_label_app]
            action: keep
            regex: istiod

      # Envoy 代理指标
      - job_name: 'istio-proxy'
        kubernetes_sd_configs:
          - role: pod
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_container_name]
            action: keep
            regex: istio-proxy
          - source_labels: [__meta_kubernetes_pod_namespace]
            action: replace
            target_label: namespace
          - source_labels: [__meta_kubernetes_pod_name]
            action: replace
            target_label: pod_name
```

### 5.3 追踪配置

```yaml
# istio/jaeger-config.yaml
apiVersion: jaegertracing.io/v1
kind: Jaeger
metadata:
  name: projectfactory-jaeger
  namespace: observability
spec:
  strategy: production
  collector:
    maxReplicas: 3
    resources:
      requests:
        cpu: 100m
        memory: 256Mi
  query:
    replicas: 2
    resources:
      requests:
        cpu: 100m
        memory: 512Mi
  storage:
    type: elasticsearch
    elasticsearch:
      nodeCount: 3
      redundancyPolicy: SingleRedundancy
      storage:
        size: 100Gi
  ingress:
    enabled: true
    annotations:
      kubernetes.io/ingress.class: nginx
```

---

## 6. 故障注入

### 6.1 混沌工程配置

```yaml
# istio/fault-injection.yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: idea-service-fault-injection
  namespace: projectfactory
spec:
  hosts:
    - idea-service
  http:
    - match:
        - headers:
            x-test-mode:
              exact: chaos
      fault:
        delay:
          percentage:
            value: 10
          fixedDelay: 5s
        abort:
          percentage:
            value: 5
          httpStatus: 503
      route:
        - destination:
            host: idea-service

---
# 流量镜像 (用于测试)
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: project-service-mirroring
  namespace: projectfactory
spec:
  hosts:
    - project-service
  http:
    - route:
        - destination:
            host: project-service
            subset: stable
      mirror:
        host: project-service
        subset: canary
      mirrorPercent: 50
```

---

## 7. 高级流量管理

### 7.1 超时与重试

```yaml
# istio/timeout-retry.yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: llm-proxy-timeouts
  namespace: projectfactory
spec:
  hosts:
    - llm-proxy
  http:
    - route:
        - destination:
            host: llm-proxy
      # 超时配置
      timeout: 60s
      # 重试配置
      retries:
        attempts: 3
        perTryTimeout: 30s
        retryOn:
          - connect-failure
          - refused-stream
          - unavailable
          - 503
        retryRemoteLocalities: true
```

### 7.2 限流

```yaml
# istio/rate-limiting.yaml
apiVersion: networking.istio.io/v1alpha1
kind: EnvoyFilter
metadata:
  name: rate-limit-filter
  namespace: projectfactory
spec:
  workloadSelector:
    labels:
      app: idea-service
  configPatches:
    - applyTo: HTTP_FILTER
      match:
        context: SIDECAR_INBOUND
        listener:
          filterChain:
            filter:
              name: envoy.filters.network.http_connection_manager
      patch:
        operation: INSERT_BEFORE
        value:
          name: envoy.filters.http.local_ratelimit
          typed_config:
            "@type": type.googleapis.com/udpa.type.v1.TypedStruct
            type_url: type.googleapis.com/envoy.extensions.filters.http.local_ratelimit.v3.LocalRateLimit
            value:
              stat_prefix: http_local_rate_limiter
              token_bucket:
                max_tokens: 10000
                tokens_per_fill: 1000
                fill_interval: 1s
              filter_enabled:
                runtime_key: local_rate_limit_enabled
                default_value:
                  numerator: 100
                  denominator: HUNDRED
```

---

## 8. 相关文档

- [API 网关](./API_GATEWAY.md)
- [监控与告警](./MONITORING_ALERTING.md)
- [可观测性](./OBSERVABILITY.md)
- [微服务架构](./MICROSERVICES_ARCHITECTURE.md)
- [容错与降级](./FAULT_TOLERANCE.md)

---

**最后更新**: 2026-04-14
