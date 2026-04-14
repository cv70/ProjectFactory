# 开发者体验 (DX) 设计

## 1. 概述

本文档描述 ProjectFactory 系统的开发者体验设计，提供友好的开发、调试和贡献流程。

### 1.1 设计目标

| 目标 | 描述 |
|------|------|
| 快速上手 | 5 分钟内运行项目 |
| 高效调试 | 实时反馈和日志 |
| 文档完善 | 代码即文档 |
| 社区友好 | 清晰的贡献流程 |

### 1.2 开发者工具栈

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         开发者工具栈                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  代码编辑                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  VS Code + Extensions                                               │   │
│  │  - Tailwind CSS IntelliSense                                       │   │
│  │  - ESLint + Prettier                                               │   │
│  │  - GitLens                                                         │   │
│  │  - Thunder Client                                                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  本地开发                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Docker Compose + VS Code Dev Containers                             │   │
│  │  - PostgreSQL + Redis                                               │   │
│  │  - Hot Reload                                                      │   │
│  │  - Debugger                                                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  CLI 工具                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  pf-cli                                                            │   │
│  │  - pf init          初始化项目                                       │   │
│  │  - pf dev           启动开发服务器                                   │   │
│  │  - pf generate      生成代码                                         │   │
│  │  - pf test          运行测试                                         │   │
│  │  - pf deploy        部署到云                                         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 项目脚手架

### 2.1 初始化流程

```bash
# 创建新项目
$ pf init my-project

# 交互式向导
? 项目名称: my-project
? 描述: My awesome project
? 技术栈:
  ❯ ◉ React + TypeScript
    ◉ Next.js
    ◉ Express
    ◉ SQLite
? 特性:
  ◉ ◯ Authentication
    ◉ ◯ Database
    ◉ ◯ API
    ◯ Docker
    ◉ ◯ CI/CD

# 生成项目结构
my-project/
├── src/
│   ├── api/           # API 路由
│   ├── components/     # React 组件
│   ├── hooks/         # 自定义 Hooks
│   ├── lib/           # 工具函数
│   └── pages/         # Next.js 页面
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example       # 环境变量模板
├── docker-compose.yml # Docker 配置
├── Dockerfile
└── README.md
```

### 2.2 开发容器

```yaml
# .devcontainer/devcontainer.json
{
  "name": "ProjectFactory Dev",
  "image": "mcr.microsoft.com/devcontainers/typescript-node:20",
  "features": {
    "ghcr.io/devcontainers/features/docker-in-docker:2": {},
    "ghcr.io/devcontainers/features/github-cli:1": {}
  },
  "forwardPorts": [3000, 3001],
  "postCreateCommand": "npm install && npm run db:setup",
  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "bradlc.vscode-tailwindcss",
        "ms-azuretools.vscode-docker",
        "eamodio.gitlens",
        "humao.rest-client"
      ],
      "settings": {
        "editor.formatOnSave": true,
        "editor.defaultFormatter": "esbenp.prettier-vscode",
        "typescript.preferences.importModuleSpecifier": "relative"
      }
    }
  }
}
```

---

## 3. 调试工具

### 3.1 VS Code 调试配置

```jsonc
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug: Backend",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "tsx",
      "runtimeArgs": ["src/backend/main.ts"],
      "env": {
        "NODE_ENV": "development",
        "DATABASE_URL": "postgresql://localhost:5432/projectfactory"
      },
      "console": "integratedTerminal",
      "restart": true,
      "sourceMaps": true
    },
    {
      "name": "Debug: Frontend",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/frontend",
      "sourceMaps": true
    },
    {
      "name": "Debug: Tests",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "test:debug"],
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "test"
      }
    },
    {
      "name": "Debug: All (Compound)",
      "compounds": [
        {
          "name": "Debug: All",
          "configurations": ["Debug: Backend", "Debug: Frontend"]
        }
      ]
    }
  ]
}
```

### 3.2 API 调试

```typescript
// tests/debug/api-debug.ts
import request from 'supertest';

// 便捷调试函数
async function debugRequest(
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  options?: {
    body?: object;
    headers?: Record<string, string>;
    expectStatus?: number;
  }
) {
  const start = Date.now();
  const response = await request(app)[method](path)
    .set('Content-Type', 'application/json')
    .set('Authorization', `Bearer ${testToken}`)
    .send(options?.body);

  const duration = Date.now() - start;

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${method.toUpperCase()} ${path}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: ${response.status} ${response.status === 200 ? '✅' : '❌'}
Duration: ${duration}ms
Body: ${JSON.stringify(response.body, null, 2)}
Headers: ${JSON.stringify(response.headers, null, 2)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);

  if (options?.expectStatus && response.status !== options.expectStatus) {
    throw new Error(`Expected ${options.expectStatus}, got ${response.status}`);
  }

  return response;
}

// 使用示例
await debugRequest('post', '/api/v1/projects', {
  body: { name: 'Test Project', type: 'web-app' },
  expectStatus: 201,
});
```

---

## 4. 日志调试

### 4.1 开发日志

```typescript
// src/utils/logger.ts
import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'debug',
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

// 调试辅助函数
export function debugRequest(req: Request, label?: string) {
  if (!isDevelopment) return;

  console.log(`
┌────────────────────────────────────────────
│ ${label || 'Request'}
├────────────────────────────────────────────
│ ${req.method} ${req.url}
│ Headers: ${JSON.stringify(req.headers, null, 2).split('\n').join('\n│ ')}
│ Body: ${JSON.stringify(req.body, null, 2).split('\n').join('\n│ ')}
└────────────────────────────────────────────
  `);
}

export function debugResponse(res: Response, label?: string) {
  if (!isDevelopment) return;

  const body = res.getJson ? await res.getJson() : res.body;

  console.log(`
┌────────────────────────────────────────────
│ ${label || 'Response'}
├────────────────────────────────────────────
│ Status: ${res.statusCode}
│ Headers: ${JSON.stringify(res.getHeaders(), null, 2).split('\n').join('\n│ ')}
│ Body: ${JSON.stringify(body, null, 2).split('\n').join('\n│ ')}
└────────────────────────────────────────────
  `);
}
```

### 4.2 请求追踪

```typescript
// src/middleware/request-tracker.ts
import { v4 as uuid } from 'uuid';

export function requestTracker(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] as string || uuid();
  const start = Date.now();

  // 存储到响应头
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-Response-Time', '');

  // 添加到请求上下文
  (req as any).requestId = requestId;

  // 响应完成时记录
  res.on('finish', () => {
    const duration = Date.now() - start;
    res.setHeader('X-Response-Time', `${duration}ms`);

    const logLevel = res.statusCode >= 500 ? 'error' :
                     res.statusCode >= 400 ? 'warn' : 'info';

    logger[logLevel]({
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    }, `${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });

  next();
}
```

---

## 5. 代码生成辅助

### 5.1 LLM 调试

```typescript
// src/utils/llm-debug.ts
export class LLMDebugger {
  constructor(private verbose: boolean = true) {}

  async debug(
    prompt: string,
    options: LLMOptions,
    fn: () => Promise<LLMResponse>
  ): Promise<LLMResponse> {
    const start = Date.now();

    if (this.verbose) {
      console.log(`
╔═══════════════════════════════════════════════════════════════
║ LLM Request
╠═══════════════════════════════════════════════════════════════
║ Model: ${options.model}
║ Temperature: ${options.temperature}
║ Max Tokens: ${options.maxTokens}
╠═══════════════════════════════════════════════════════════════
║ Prompt:
║ ${prompt.substring(0, 500)}${prompt.length > 500 ? '...' : ''}
╚═══════════════════════════════════════════════════════════════
      `);
    }

    const response = await fn();
    const duration = Date.now() - start;

    if (this.verbose) {
      console.log(`
╔═══════════════════════════════════════════════════════════════
║ LLM Response (${duration}ms)
╠═══════════════════════════════════════════════════════════════
║ Usage: ${JSON.stringify(response.usage)}
╠═══════════════════════════════════════════════════════════════
║ Response:
║ ${response.content.substring(0, 500)}${response.content.length > 500 ? '...' : ''}
╚═══════════════════════════════════════════════════════════════
      `);
    }

    return response;
  }
}

// 使用
const debugger = new LLMDebugger(process.env.DEBUG_LLM === 'true');

const response = await debugger.debug(
  prompt,
  { model: 'gpt-4', temperature: 0.7 },
  () => llm.complete(prompt, { model: 'gpt-4' })
);
```

---

## 6. 文档生成

### 6.1 代码文档

```typescript
// scripts/generate-docs.ts
import { parse } from '@typescript-eslint/parser';
import { APIExtractor } from '@microsoft/api-extractor';

async function generateAPIDocs() {
  // 提取 API 文档
  await APIExtractor.invoke('./api-extractor.json', {
    messageCallback: (message) => {
      if (message.logLevel === 'error') {
        console.error(message.text);
      }
    },
  });

  // 生成 README
  await generateReadme();

  // 生成 CHANGELOG
  await generateChangelog();
}

// README 生成模板
const README_TEMPLATE = `
# {{projectName}}

{{description}}

## 快速开始

\`\`\`bash
# 安装
npm install

# 开发
npm run dev

# 测试
npm run test

# 构建
npm run build
\`\`\`

## 项目结构

\`\`\`
{{directoryStructure}}
\`\`\`

## API 文档

{{apiDocumentation}}

## 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
{{envVariables}}

## 许可证

{{license}}
`;
```

---

## 7. 相关文档

- [CLI 开发者工具](./CLI_DEVELOPER_TOOLS.md)
- [测试策略](./TESTING_STRATEGY.md)
- [前端设计](./FRONTEND_DESIGN.md)

---

**最后更新**: 2026-04-14
