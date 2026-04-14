# 运维手册 (Operational Runbook)

## 1. 概述

本文档是 ProjectFactory 系统的运维操作手册，提供日常运维、故障排查、应急响应的详细操作流程。

### 1.1 手册结构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            运维手册结构                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  第一部分：日常运维                                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  1. 环境配置     2. 服务管理     3. 日志分析     4. 备份恢复          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  第二部分：故障排查                                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  5. 常见问题     6. 诊断工具     7. 性能分析     8. 网络排查          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  第三部分：应急响应                                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  9. 告警响应    10. 故障处理    11. 降级操作    12. 灾难恢复          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  第四部分：安全运维                                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ 13. 密钥轮换    14. 漏洞修复    15. 渗透测试    16. 合规审计          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 联系人

| 角色 | 职责 | 联系方式 |
|------|------|----------|
| 值班 SRE | 7x24 轮值 | oncall@example.com |
| 系统负责人 | 技术决策 | tech-lead@example.com |
| 安全响应 | 安全事件 | security@example.com |
| 数据库 DBA | 数据库问题 | dba@example.com |

---

## 2. 日常运维

### 2.1 环境配置检查

```bash
#!/bin/bash
# scripts/daily-check.sh - 日常环境检查脚本

echo "=========================================="
echo "ProjectFactory 日常检查 $(date)"
echo "=========================================="

# 1. 检查服务状态
echo -e "\n[1/8] 检查服务状态..."
if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo "  ✅ 前端服务: 运行中"
else
    echo "  ❌ 前端服务: 异常"
fi

if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    echo "  ✅ 后端服务: 运行中"
else
    echo "  ❌ 后端服务: 异常"
fi

# 2. 检查数据库连接
echo -e "\n[2/8] 检查数据库..."
sqlite3 /data/project-factory.db "SELECT COUNT(*) FROM ideas;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    COUNT=$(sqlite3 /data/project-factory.db "SELECT COUNT(*) FROM ideas;")
    echo "  ✅ 数据库: 正常 (记录数: $COUNT)"
else
    echo "  ❌ 数据库: 异常"
fi

# 3. 检查磁盘空间
echo -e "\n[3/8] 检查磁盘空间..."
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    echo "  ✅ 磁盘使用率: ${DISK_USAGE}% (正常)"
else
    echo "  ⚠️  磁盘使用率: ${DISK_USAGE}% (偏高)"
fi

# 4. 检查内存使用
echo -e "\n[4/8] 检查内存使用..."
MEMORY=$(free -m | awk 'NR==2 {printf "%.1f", $3/$2 * 100}')
echo "  📊 内存使用率: ${MEMORY}%"

# 5. 检查 Redis
echo -e "\n[5/8] 检查 Redis..."
if redis-cli ping > /dev/null 2>&1; then
    echo "  ✅ Redis: 运行中"
else
    echo "  ❌ Redis: 异常"
fi

# 6. 检查 LLM 服务
echo -e "\n[6/8] 检查 LLM 服务..."
LLM_LATENCY=$(curl -sf http://localhost:3001/api/v1/health/llm \
    -w "%{time_total}" -o /dev/null 2>&1)
if [ ! -z "$LLM_LATENCY" ]; then
    echo "  ✅ LLM 服务: 正常 (延迟: ${LLM_LATENCY}s)"
else
    echo "  ⚠️  LLM 服务: 响应慢"
fi

# 7. 检查后台任务队列
echo -e "\n[7/8] 检查任务队列..."
QUEUE_SIZE=$(redis-cli llen projectfactory:queue 2>/dev/null || echo "0")
echo "  📊 队列任务数: $QUEUE_SIZE"

# 8. 检查日志错误
echo -e "\n[8/8] 检查错误日志..."
ERROR_COUNT=$(tail -n 1000 /var/log/projectfactory/error.log 2>/dev/null \
    | grep "$(date +%Y-%m-%d)" | grep -c "ERROR" || echo "0")
echo "  📊 今日错误数: $ERROR_COUNT"

echo -e "\n=========================================="
echo "检查完成 $(date)"
echo "=========================================="
```

### 2.2 服务管理

```bash
# 服务管理命令

# 启动所有服务
sudo systemctl start projectfactory-backend
sudo systemctl start projectfactory-frontend
sudo systemctl start projectfactory-worker

# 重启服务
sudo systemctl restart projectfactory-backend

# 查看服务状态
sudo systemctl status projectfactory-backend

# 查看服务日志
sudo journalctl -u projectfactory-backend -f

# 服务健康检查
curl http://localhost:3001/health | jq
```

### 2.3 日志分析

```bash
# 实时查看错误日志
tail -f /var/log/projectfactory/error.log | grep ERROR

# 分析错误类型分布
awk -F',' '/ERROR/ {print $NF}' /var/log/projectfactory/error.log \
    | sort | uniq -c | sort -rn

# 查看特定时间范围的日志
sed -n '/2026-04-14 10:00:00/,/2026-04-14 11:00:00/p' \
    /var/log/projectfactory/app.log

# 分析 API 响应时间
grep "API" /var/log/projectfactory/access.log \
    | awk '{print $NF}' | sort -n | awk '
    BEGIN { count=0; sum=0 }
    { sum+=$1; count++ }
    END {
        print "平均响应时间:", sum/count "ms"
        print "最大响应时间:", $1 "ms"
    }'

# 查看慢查询 (响应时间 > 1s)
grep -E "[0-9]{4,}ms" /var/log/projectfactory/slow.log

# 分析用户操作
grep "POST\|GET" /var/log/projectfactory/access.log \
    | awk '{print $6, $7}' | sort | uniq -c | sort -rn | head -20
```

### 2.4 备份与恢复

```bash
#!/bin/bash
# scripts/backup.sh - 数据库备份脚本

BACKUP_DIR="/backup/projectfactory"
DATE=$(date +%Y%m%d_%H%M%S)
DB_PATH="/data/project-factory.db"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
echo "正在备份数据库..."
cp $DB_PATH $BACKUP_DIR/db_$DATE.sqlite

# 备份配置
echo "正在备份配置文件..."
tar -czf $BACKUP_DIR/config_$DATE.tar.gz \
    /etc/projectfactory/ \
    /opt/projectfactory/.env

# 备份项目文件
echo "正在备份项目文件..."
tar -czf $BACKUP_DIR/projects_$DATE.tar.gz \
    /data/projects/

# 创建加密备份
echo "正在加密备份..."
openssl enc -aes-256-cbc -salt -in $BACKUP_DIR/db_$DATE.sqlite \
    -out $BACKUP_DIR/db_$DATE.sqlite.enc \
    -pass pass:$BACKUP_PASSWORD

# 清理 7 天前的备份
find $BACKUP_DIR -mtime +7 -delete

# 上传到远程存储
rclone copy $BACKUP_DIR remote:backups/projectfactory/ \
    --include "*.sqlite*" \
    --include "*.tar.gz"

echo "备份完成: $DATE"
```

```bash
# 数据库恢复

# 1. 停止服务
sudo systemctl stop projectfactory-backend

# 2. 恢复数据库
sqlite3 /data/project-factory.db ".recover" | sqlite3 /data/project-factory.db.new
mv /data/project-factory.db.new /data/project-factory.db

# 3. 验证数据
sqlite3 /data/project-factory.db "SELECT COUNT(*) FROM ideas;"
sqlite3 /data/project-factory.db "SELECT COUNT(*) FROM projects;"

# 4. 重启服务
sudo systemctl start projectfactory-backend
```

---

## 3. 故障排查

### 3.1 服务无响应

```bash
# 1. 检查端口监听
netstat -tlnp | grep -E "3000|3001|6379"

# 2. 检查进程状态
ps aux | grep -E "node|redis" | grep -v grep

# 3. 检查资源限制
cat /etc/security/limits.conf | grep nofile
sysctl fs.file-max

# 4. 查看详细错误
sudo strace -p $(pgrep -f "node.*backend") -f 2>&1 | head -100

# 5. 检查内存泄漏
valgrind --leak-check=full node /opt/projectfactory/backend/dist/main.js
```

### 3.2 数据库问题

```sql
-- 活跃连接数
SELECT COUNT(*) FROM sqlite_master;

-- 锁定等待
SELECT * FROM sqlite_master WHERE type='table';

-- 重建索引
REINDEX;
ANALYZE;

-- 检查表大小
SELECT name, COUNT(*) as count FROM sqlite_master WHERE type='table' GROUP BY name;
```

### 3.3 性能问题

```bash
# CPU 问题定位
top -Hp $(pgrep -f "node.*backend")
perf top -p $(pgrep -f "node.*backend")

# 内存问题定位
node --inspect /opt/projectfactory/backend/dist/main.js
# 然后在 Chrome DevTools 中使用 Memory Profiler

# I/O 问题定位
iotop
iostat -x 1 5

# 网络问题定位
ss -s
netstat -i
```

### 3.4 诊断工具箱

```typescript
// src/utils/diagnostics.ts
class DiagnosticsToolkit {
  // 系统信息收集
  async collectSystemInfo(): Promise<SystemInfo> {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      loadAverage: os.loadavg(),
    };
  }

  // 应用状态收集
  async collectAppStatus(): Promise<AppStatus> {
    return {
      pid: process.pid,
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      uptime: process.uptime(),
      env: {
        nodeVersion: process.version,
        env: process.env.NODE_ENV,
      },
    };
  }

  // 健康检查
  async healthCheck(): Promise<HealthCheckResult> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkLLM(),
      this.checkStorage(),
    ]);

    return {
      timestamp: Date.now(),
      results: checks.map((c, i) => ({
        name: ['database', 'redis', 'llm', 'storage'][i],
        status: c.status === 'fulfilled' ? 'healthy' : 'unhealthy',
        details: c.status === 'fulfilled' ? c.value : c.reason,
      })),
    };
  }

  // 生成诊断报告
  async generateReport(): Promise<DiagnosticReport> {
    return {
      generatedAt: Date.now(),
      system: await this.collectSystemInfo(),
      app: await this.collectAppStatus(),
      health: await this.healthCheck(),
      logs: await this.getRecentErrors(50),
      metrics: await this.getMetrics(),
    };
  }
}
```

---

## 4. 应急响应

### 4.1 告警响应流程

```yaml
# 告警级别与响应
alerts:
  critical:
    # 服务完全不可用
    response_time: 5m
    escalation: immediate
    actions:
      - check_status_page
      - invoke_incident
      - begin_rollback

  high:
    # 功能严重降级
    response_time: 15m
    escalation: 30m
    actions:
      - analyze_logs
      - scale_resources
      - prepare_rollback

  medium:
    # 非核心功能异常
    response_time: 1h
    escalation: 2h
    actions:
      - schedule_fix
      - monitor_trends

  low:
    # 轻微问题
    response_time: 24h
    escalation: 72h
    actions:
      - add_to_backlog
```

### 4.2 故障处理手册

```bash
#!/bin/bash
# scripts/incident.sh - 事件响应脚本

INCIDENT_ID=$(date +%Y%m%d_%H%M%S)
INCIDENT_DIR="/incidents/$INCIDENT_ID"

mkdir -p $INCIDENT_DIR

echo "=========================================="
echo "事件响应启动 - ID: $INCIDENT_ID"
echo "时间: $(date)"
echo "=========================================="

# 1. 收集证据
echo -e "\n[1] 收集证据..."

# 系统状态快照
echo "保存系统状态..."
uname -a > $INCIDENT_DIR/system.txt
df -h > $INCIDENT_DIR/disk.txt
free -m > $INCIDENT_DIR/memory.txt
netstat -tlnp > $INCIDENT_DIR/ports.txt
ps aux > $INCIDENT_DIR/processes.txt

# 应用日志
echo "保存应用日志..."
cp /var/log/projectfactory/*.log $INCIDENT_DIR/

# 数据库状态
echo "导出数据库状态..."
sqlite3 /data/project-factory.db ".schema" > $INCIDENT_DIR/schema.sql
sqlite3 /data/project-factory.db "SELECT * FROM ideas LIMIT 100;" > $INCIDENT_DIR/ideas_sample.txt

# 2. 通知团队
echo -e "\n[2] 通知团队..."
# 发送告警通知
curl -X POST "https://hooks.example.com/alerts" \
    -d "{\"incident\":\"$INCIDENT_ID\",\"status\":\"investigating\"}"

# 3. 开始修复
echo -e "\n[3] 准备修复..."

# 根据错误类型选择修复策略
ERROR_TYPE=$(tail -n 100 /var/log/projectfactory/error.log | grep ERROR | tail -n 1 | awk '{print $NF}')
case $ERROR_TYPE in
    "DB_CONNECTION")
        echo "数据库连接问题 - 尝试重连..."
        sudo systemctl restart projectfactory-backend
        ;;
    "MEMORY_OVERFLOW")
        echo "内存溢出 - 增加限制..."
        sudo systemctl stop projectfactory-backend
        sudo systemctl start projectfactory-backend
        ;;
    *)
        echo "未知错误类型 - 手动检查"
        ;;
esac

# 4. 验证修复
echo -e "\n[4] 验证修复..."
sleep 10
if curl -sf http://localhost:3001/health > /dev/null; then
    echo "✅ 服务已恢复"
    curl -X POST "https://hooks.example.com/alerts" \
        -d "{\"incident\":\"$INCIDENT_ID\",\"status\":\"resolved\"}"
else
    echo "❌ 服务仍未恢复 - 继续排查"
fi

echo -e "\n=========================================="
echo "事件响应完成"
echo "详细记录: $INCIDENT_DIR"
echo "=========================================="
```

### 4.3 降级操作

```bash
#!/bin/bash
# scripts/degrade.sh - 服务降级脚本

DEGRADATION_LEVEL=${1:-1}

echo "执行降级 - Level: $DEGRADATION_LEVEL"

case $DEGRADATION_LEVEL in
  1)
    echo "Level 1: 禁用非关键功能..."
    # 禁用分析功能
    curl -X POST http://localhost:3001/api/v1/admin/features \
        -d '{"feature": "analytics", "enabled": false}'
    # 禁用推荐功能
    curl -X POST http://localhost:3001/api/v1/admin/features \
        -d '{"feature": "recommendations", "enabled": false}'
    echo "✅ Level 1 降级完成"
    ;;

  2)
    echo "Level 2: 切换到只读模式..."
    # 停止写入操作
    curl -X POST http://localhost:3001/api/v1/admin/mode \
        -d '{"mode": "read-only"}'
    # 暂停项目生成
    curl -X POST http://localhost:3001/api/v1/admin/pause-generation
    echo "✅ Level 2 降级完成"
    ;;

  3)
    echo "Level 3: 启用紧急模式..."
    # 停止所有生成任务
    curl -X POST http://localhost:3001/api/v1/admin/emergency-mode
    # 启用静态页面
    curl -X POST http://localhost:3001/api/v1/admin/static-mode
    # 显示维护公告
    echo "系统正在维护中..." > /var/www/maintenance.html
    echo "✅ Level 3 降级完成"
    ;;

  *)
    echo "未知降级级别: $DEGRADATION_LEVEL"
    ;;
esac
```

### 4.4 灾难恢复

```bash
#!/bin/bash
# scripts/disaster-recovery.sh - 灾难恢复脚本

echo "=========================================="
echo "灾难恢复流程"
echo "=========================================="

# 1. 评估损失
echo -e "\n[1] 评估损失..."
read -p "数据库是否损坏? (y/n) " DB_DAMAGED
read -p "文件系统是否损坏? (y/n) " FS_DAMAGED
read -p "需要从备份恢复吗? (y/n) " NEED_RESTORE

# 2. 停止所有服务
echo -e "\n[2] 停止所有服务..."
sudo systemctl stop projectfactory-frontend
sudo systemctl stop projectfactory-worker
sudo systemctl stop projectfactory-backend

# 3. 数据库恢复
if [ "$DB_DAMAGED" = "y" ]; then
    echo -e "\n[3] 恢复数据库..."
    LATEST_BACKUP=$(rclone ls remote:backups/projectfactory/ \
        | grep "db_.*\.sqlite\.enc" | tail -1 | awk '{print $2}')

    if [ ! -z "$LATEST_BACKUP" ]; then
        echo "下载备份: $LATEST_BACKUP"
        rclone copy "remote:backups/projectfactory/$LATEST_BACKUP" /tmp/

        # 解密
        openssl enc -d -aes-256-cbc -in /tmp/$(basename $LATEST_BACKUP) \
            -out /tmp/db_recovered.sqlite -pass pass:$BACKUP_PASSWORD

        # 恢复
        mv /data/project-factory.db /data/project-factory.db.broken
        cp /tmp/db_recovered.sqlite /data/project-factory.db

        echo "✅ 数据库已恢复"
    else
        echo "❌ 未找到可用备份"
    fi
fi

# 4. 文件系统恢复
if [ "$FS_DAMAGED" = "y" ]; then
    echo -e "\n[4] 恢复文件系统..."
    rclone copy remote:backups/projectfactory/projects_*.tar.gz /tmp/
    tar -xzf /tmp/projects_latest.tar.gz -C /data/
    echo "✅ 文件系统已恢复"
fi

# 5. 服务重启
echo -e "\n[5] 重启服务..."
sudo systemctl start projectfactory-backend
sudo systemctl start projectfactory-worker
sudo systemctl start projectfactory-frontend

# 6. 验证
echo -e "\n[6] 验证服务..."
sleep 5
if curl -sf http://localhost:3001/health | grep "healthy"; then
    echo "✅ 服务已恢复正常"
else
    echo "⚠️  服务可能仍有问题，请手动检查"
fi

echo -e "\n=========================================="
echo "灾难恢复完成"
echo "=========================================="
```

---

## 5. 安全运维

### 5.1 密钥轮换

```bash
#!/bin/bash
# scripts/rotate-keys.sh - 密钥轮换脚本

echo "开始密钥轮换..."

# 1. 生成新密钥
echo "[1] 生成新密钥..."
NEW_API_KEY=$(openssl rand -hex 32)
NEW_JWT_SECRET=$(openssl rand -hex 64)
NEW_ENCRYPTION_KEY=$(openssl rand -hex 32)

# 2. 更新配置 (使用密钥管理服务)
echo "[2] 更新配置..."
curl -X POST http://localhost:3001/api/v1/admin/config/rotate-keys \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d "{\"apiKey\": \"$NEW_API_KEY\", \"jwtSecret\": \"$NEW_JWT_SECRET\"}"

# 3. 通知相关服务
echo "[3] 通知服务..."
curl -X POST http://localhost:3002/api/v1/admin/refresh-credentials

# 4. 验证新密钥
echo "[4] 验证新密钥..."
curl -H "X-API-Key: $NEW_API_KEY" http://localhost:3001/api/v1/health

# 5. 记录审计日志
echo "[5] 记录审计..."
echo "$(date): API Key rotated" >> /var/log/projectfactory/audit.log

# 6. 旧密钥作废 (延迟 24 小时)
echo "[6] 旧密钥将在 24 小时后作废..."
at now + 24 hours -f - <<EOF
curl -X POST http://localhost:3001/api/v1/admin/revoke-old-key
EOF

echo "✅ 密钥轮换完成"
```

### 5.2 漏洞修复

```bash
# 安全更新流程

# 1. 检查已知漏洞
echo "检查安全漏洞..."
npm audit --audit-level=high
snyk test
trivy image projectfactory/backend:latest

# 2. 应用安全补丁
echo "应用安全补丁..."
npm audit fix

# 3. 更新依赖版本
echo "更新依赖..."
npm update --save
npm audit fix --force

# 4. 重新构建
echo "重新构建..."
docker build -t projectfactory/backend:latest .

# 5. 验证构建
echo "验证构建..."
docker run --rm projectfactory/backend:latest npm audit

# 6. 部署
echo "部署..."
kubectl rolling-update projectfactory --image=projectfactory/backend:latest
```

### 5.3 安全监控

```bash
# 实时安全监控

# 1. 监控异常登录
echo "检查异常登录..."
last -50 | grep -E "root|admin" | tail -20

# 2. 检查防火墙
echo "检查防火墙规则..."
sudo iptables -L -n | grep -v ACCEPT

# 3. 检查开放端口
echo "检查开放端口..."
netstat -tlnp | grep -v -E "3000|3001|6379"

# 4. 检查可疑进程
echo "检查可疑进程..."
ps aux | grep -v -E "node|redis|nginx" | awk '{print $11}' | sort | uniq

# 5. 检查 SSH 密钥
echo "检查 SSH 配置..."
cat /etc/ssh/sshd_config | grep -E "PasswordAuth|PubkeyAuth|PermitRoot"

# 6. 检查日志中的攻击迹象
echo "检查攻击迹象..."
grep -E "sqlmap|nikto|dirbuster|nmap" /var/log/nginx/access.log | head -20
grep " UNION SELECT\|-- 'OR 1=1" /var/log/projectfactory/app.log | head -10
```

---

## 6. 监控仪表盘

### 6.1 Grafana 仪表盘配置

```yaml
# grafana/dashboards/projectfactory.json
{
  "dashboard": {
    "title": "ProjectFactory 运维仪表盘",
    "panels": [
      {
        "title": "服务状态",
        "type": "stat",
        "targets": [
          {
            "expr": "up{job=\"projectfactory-backend\"}",
            "legendFormat": "Backend"
          },
          {
            "expr": "up{job=\"projectfactory-frontend\"}",
            "legendFormat": "Frontend"
          },
          {
            "expr": "up{job=\"projectfactory-worker\"}",
            "legendFormat": "Worker"
          }
        ]
      },
      {
        "title": "API 响应时间 (P99)",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P99"
          }
        ]
      },
      {
        "title": "错误率",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "5xx"
          }
        ]
      },
      {
        "title": "队列深度",
        "type": "graph",
        "targets": [
          {
            "expr": "redis_queue_length",
            "legendFormat": "待处理任务"
          }
        ]
      },
      {
        "title": "资源使用",
        "type": "gauge",
        "targets": [
          {
            "expr": "node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes * 100",
            "legendFormat": "内存"
          }
        ]
      }
    ]
  }
}
```

---

## 7. 相关文档

- [监控与告警](./MONITORING_ALERTING.md)
- [容错与降级设计](./FAULT_TOLERANCE.md)
- [灾难恢复](./DISASTER_RECOVERY.md)
- [安全设计](./SECURITY_DESIGN.md)

---

**最后更新**: 2026-04-14
