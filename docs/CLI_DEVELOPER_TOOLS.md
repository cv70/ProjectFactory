# CLI 工具与开发者工具设计

## 概述

本文档定义 ProjectFactory 系统的命令行界面（CLI）工具与开发者工具设计，支持本地开发、项目管理、自动化脚本和系统集成，提升开发者体验和操作效率。

## 1. CLI 架构概览

### 1.1 CLI 命令结构

```
projectfactory <command> [options] [arguments]

┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLI 命令层级                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  全局选项                                                                   │
│  --config <path>     配置文件路径                                           │
│  --output <format>  输出格式 (text|json|table)                             │
│  --verbose          详细输出                                               │
│  --quiet            静默模式                                               │
│  --help             显示帮助                                               │
│  --version          显示版本                                               │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  命令组                                                                     │
│  ├── init              初始化新项目                                         │
│  ├── generate         生成代码/项目                                         │
│  ├── dev              启动开发服务器                                       │
│  ├── build            构建项目                                             │
│  ├── test             运行测试                                             │
│  ├── deploy           部署项目                                             │
│  ├── config           配置管理                                             │
│  ├── project          项目管理                                             │
│  ├── agent            Agent 管理                                           │
│  ├── plugin           插件管理                                              │
│  └── system           系统管理                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 命令详细设计

```typescript
// src/cli/commands/command-registry.ts

// 命令定义接口
interface Command {
  name: string;
  description: string;
  aliases?: string[];

  // 子命令
  subcommands?: Command[];

  // 选项
  options: Option[];

  // 参数
  arguments?: Argument[];

  // 处理器
  handler: CommandHandler;

  // 帮助信息
  examples?: Example[];

  // 过滤器（权限等）
  filters?: CommandFilter[];
}

interface Option {
  name: string;
  short?: string;         // 短选项 e.g., 'v'
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  defaultValue?: unknown;
  required?: boolean;
  choices?: string[];
  implies?: string[];       // 隐含的其他选项
}

interface Argument {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required?: boolean;
  variadic?: boolean;       // 可变参数 (e.g., <files...>)
  defaultValue?: unknown;
}

interface Example {
  command: string;
  description: string;
}

// CLI 命令注册表
class CommandRegistry {
  private commands = new Map<string, Command>();

  register(command: Command): void {
    this.commands.set(command.name, command);

    // 注册别名
    for (const alias of command.aliases || []) {
      this.commands.set(alias, command);
    }
  }

  get(name: string): Command | undefined {
    return this.commands.get(name);
  }

  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  // 获取帮助信息
  getHelp(): string {
    const commands = this.getAll().filter(c => !c.aliases?.includes(c.name));

    return `
ProjectFactory CLI

用法:
  pf <command> [options] [arguments]

可用命令:
${commands.map(c => `  ${c.name.padEnd(15)} ${c.description}`).join('\n')}

全局选项:
  --config <path>     配置文件路径
  --output <format>   输出格式 (text|json|table)
  --verbose, -v        详细输出
  --quiet, -q          静默模式
  --help, -h           显示帮助
  --version            显示版本

更多信息: https://docs.projectfactory.io/cli
    `.trim();
  }
}
```

## 2. 核心命令实现

### 2.1 init 命令

```typescript
// src/cli/commands/init-command.ts

const InitCommand: Command = {
  name: 'init',
  description: 'Initialize a new ProjectFactory project',
  aliases: ['i'],
  arguments: [
    { name: 'project-name', type: 'string', description: 'Name of the project to initialize' },
  ],
  options: [
    { name: 'template', short: 't', type: 'string', description: 'Project template to use' },
    { name: 'typescript', short: 'T', type: 'boolean', description: 'Use TypeScript', defaultValue: true },
    { name: 'install', type: 'boolean', description: 'Install dependencies after initialization', defaultValue: true },
    { name: 'git', type: 'boolean', description: 'Initialize git repository', defaultValue: true },
    { name: 'output-dir', short: 'o', type: 'string', description: 'Output directory' },
  ],
  examples: [
    { command: 'pf init my-project', description: 'Create a new project with default settings' },
    { command: 'pf init my-project --template api --typescript', description: 'Create an API project with TypeScript' },
  ],

  async handler(args: ParsedArgs, ctx: CLIContext): Promise<void> {
    const projectName = args.positionals[0];

    if (!projectName) {
      throw new Error('Project name is required');
    }

    // 1. 验证项目名称
    if (!this.isValidProjectName(projectName)) {
      throw new Error(`Invalid project name: ${projectName}`);
    }

    // 2. 解析模板
    const template = args.options.template || 'default';

    // 3. 创建项目
    const spinner = ctx.spinner('Initializing project...');

    try {
      // 下载模板
      const templatePath = await this.resolveTemplate(template);

      // 生成项目文件
      const outputDir = args.options.outputDir || projectName;
      await this.generateProject(templatePath, outputDir, {
        projectName,
        typescript: args.options.typescript,
      });

      // 初始化配置
      await this.initializeConfig(outputDir);

      // 安装依赖
      if (args.options.install) {
        await this.installDependencies(outputDir);
      }

      // 初始化 Git
      if (args.options.git) {
        await this.initializeGit(outputDir);
      }

      spinner.succeed(`Project ${projectName} initialized successfully!`);

      // 显示下一步
      ctx.log('\nNext steps:');
      ctx.log(`  cd ${outputDir}`);
      ctx.log('  pf dev');

    } catch (error) {
      spinner.fail('Initialization failed');
      throw error;
    }
  },
};
```

### 2.2 generate 命令

```typescript
// src/cli/commands/generate-command.ts

const GenerateCommand: Command = {
  name: 'generate',
  description: 'Generate code, components, or entire projects',
  aliases: ['g'],
  subcommands: [
    {
      name: 'project',
      description: 'Generate a complete project',
      options: [
        { name: 'idea', type: 'string', description: 'Project idea/description' },
        { name: 'type', type: 'string', description: 'Project type', choices: ['web-app', 'cli-tool', 'api', 'library'] },
        { name: 'tech-stack', type: 'array', description: 'Tech stack to use' },
        { name: 'output', short: 'o', type: 'string', description: 'Output directory' },
      ],
      async handler(args: ParsedArgs, ctx: CLIContext): Promise<void> {
        const idea = args.options.idea || await this.promptForIdea();
        const projectType = args.options.type || 'web-app';
        const techStack = args.options.techStack || ['typescript', 'react'];

        ctx.log(`Generating ${projectType} project...`);

        // 调用后端 API 生成项目
        const response = await ctx.api.post('/api/v1/projects/generate', {
          idea,
          projectType,
          techStack,
        });

        const projectId = response.projectId;

        // 轮询项目状态
        await this.pollProjectStatus(projectId, ctx);

        ctx.log(`\nProject generated successfully!`);
        ctx.log(`  Project ID: ${projectId}`);
        ctx.log(`  Run: pf project open ${projectId}`);
      },
    },
    {
      name: 'component',
      description: 'Generate a component',
      arguments: [
        { name: 'name', type: 'string', description: 'Component name' },
      ],
      options: [
        { name: 'type', short: 't', type: 'string', description: 'Component type', choices: ['react', 'vue', 'svelte'] },
        { name: 'directory', short: 'd', type: 'string', description: 'Target directory' },
        { name: 'with-styles', type: 'boolean', description: 'Generate with styles', defaultValue: true },
        { name: 'with-test', type: 'boolean', description: 'Generate test file', defaultValue: true },
      ],
      async handler(args: ParsedArgs, ctx: CLIContext): Promise<void> {
        const name = args.positionals[0];
        const type = args.options.type || 'react';

        const response = await ctx.api.post('/api/v1/components/generate', {
          name,
          type,
          directory: args.options.directory,
          withStyles: args.options.withStyles,
          withTest: args.options.withTest,
        });

        ctx.log(`Component ${name} generated at ${response.path}`);
      },
    },
    {
      name: 'api',
      description: 'Generate API endpoint',
      arguments: [
        { name: 'name', type: 'string', description: 'Endpoint name' },
      ],
      options: [
        { name: 'method', short: 'm', type: 'string', description: 'HTTP method', choices: ['get', 'post', 'put', 'delete', 'patch'] },
        { name: 'resource', short: 'r', type: 'string', description: 'Resource name' },
      ],
      async handler(args: ParsedArgs, ctx: CLIContext): Promise<void> {
        // API 生成逻辑
      },
    },
  ],
  options: [
    { name: 'dry-run', type: 'boolean', description: 'Preview without generating' },
    { name: 'force', short: 'f', type: 'boolean', description: 'Overwrite existing files' },
  ],
  examples: [
    { command: 'pf generate project --idea "A task management app"', description: 'Generate a complete project' },
    { command: 'pf generate component Button --type react', description: 'Generate a React button component' },
    { command: 'pf generate api users --method get --resource /api/users', description: 'Generate a GET users API endpoint' },
  ],

  async handler(args: ParsedArgs, ctx: CLIContext): Promise<void> {
    // 显示子命令帮助
    ctx.log(GenerateCommand.subcommands?.map(sc => `  ${sc.name}: ${sc.description}`).join('\n'));
  },
};
```

### 2.3 project 命令

```typescript
// src/cli/commands/project-command.ts

const ProjectCommand: Command = {
  name: 'project',
  description: 'Manage projects',
  subcommands: [
    {
      name: 'list',
      description: 'List all projects',
      options: [
        { name: 'status', type: 'string', description: 'Filter by status' },
        { name: 'sort', type: 'string', description: 'Sort field', choices: ['name', 'created', 'updated'] },
        { name: 'format', short: 'f', type: 'string', description: 'Output format', choices: ['table', 'json', 'csv'] },
        { name: 'page', type: 'number', description: 'Page number' },
        { name: 'limit', short: 'l', type: 'number', description: 'Items per page', defaultValue: 20 },
      ],
      async handler(args: ParsedArgs, ctx: CLIContext): Promise<void> {
        const projects = await ctx.api.get('/api/v1/projects', {
          status: args.options.status,
          sort: args.options.sort,
          page: args.options.page,
          limit: args.options.limit,
        });

        // 根据格式输出
        switch (args.options.format) {
          case 'json':
            ctx.log(JSON.stringify(projects, null, 2));
            break;
          case 'csv':
            ctx.log(this.toCSV(projects));
            break;
          default:
            ctx.log(this.toTable(projects));
        }
      },
    },
    {
      name: 'open',
      description: 'Open a project in browser or editor',
      arguments: [
        { name: 'project-id', type: 'string', description: 'Project ID or name' },
      ],
      async handler(args: ParsedArgs, ctx: CLIContext): Promise<void> {
        const projectId = args.positionals[0];
        const project = await ctx.api.get(`/api/v1/projects/${projectId}`);

        // 打开浏览器
        await ctx.open(`https://projectfactory.io/projects/${project.id}`);
        ctx.log(`Opening ${project.name} in browser...`);
      },
    },
    {
      name: 'status',
      description: 'Show project status',
      arguments: [
        { name: 'project-id', type: 'string', description: 'Project ID or name' },
      ],
      async handler(args: ParsedArgs, ctx: CLIContext): Promise<void> {
        const projectId = args.positionals[0];
        const status = await ctx.api.get(`/api/v1/projects/${projectId}/status`);

        const statusEmoji = {
          pending: '⏳',
          generating: '🔄',
          testing: '🧪',
          reviewing: '👀',
          completed: '✅',
          failed: '❌',
        };

        ctx.log(`\nProject: ${status.name}`);
        ctx.log(`Status: ${statusEmoji[status.stage]} ${status.stage}`);
        ctx.log(`Progress: ${status.progress}%`);
        ctx.log(`Quality Score: ${status.qualityScore || 'N/A'}`);
        ctx.log(`Started: ${status.startedAt}`);
        ctx.log(`Updated: ${status.updatedAt}`);

        if (status.errors?.length > 0) {
          ctx.log('\nErrors:');
          status.errors.forEach((e: string) => ctx.log(`  ❌ ${e}`));
        }
      },
    },
    {
      name: 'logs',
      description: 'Stream project logs',
      arguments: [
        { name: 'project-id', type: 'string', description: 'Project ID or name' },
      ],
      options: [
        { name: 'follow', short: 'f', type: 'boolean', description: 'Follow log output' },
        { name: 'agent', type: 'string', description: 'Filter by agent type' },
        { name: 'lines', short: 'n', type: 'number', description: 'Number of lines to show', defaultValue: 50 },
      ],
      async handler(args: ParsedArgs, ctx: CLIContext): Promise<void> {
        const projectId = args.positionals[0];

        if (args.options.follow) {
          // WebSocket 流式日志
          await ctx.api.subscribe(`/api/v1/projects/${projectId}/logs/stream`, {
            agent: args.options.agent,
          }, (log) => {
            ctx.log(log.message);
          });
        } else {
          const logs = await ctx.api.get(`/api/v1/projects/${projectId}/logs`, {
            lines: args.options.lines,
            agent: args.options.agent,
          });

          logs.forEach((log: any) => {
            const timestamp = new Date(log.timestamp).toISOString().split('T')[1].slice(0, -1);
            ctx.log(`[${timestamp}] [${log.level}] [${log.agent}] ${log.message}`);
          });
        }
      },
    },
    {
      name: 'delete',
      description: 'Delete a project',
      arguments: [
        { name: 'project-id', type: 'string', description: 'Project ID or name' },
      ],
      options: [
        { name: 'force', short: 'f', type: 'boolean', description: 'Skip confirmation' },
      ],
      async handler(args: ParsedArgs, ctx: CLIContext): Promise<void> {
        const projectId = args.positionals[0];

        if (!args.options.force) {
          const confirmed = await ctx.prompt.confirm(`Delete project ${projectId}?`);
          if (!confirmed) {
            ctx.log('Cancelled');
            return;
          }
        }

        await ctx.api.delete(`/api/v1/projects/${projectId}`);
        ctx.log(`Project ${projectId} deleted`);
      },
    },
  ],

  handler(args: ParsedArgs, ctx: CLIContext): void {
    ctx.log('Usage: pf project <command>');
    ctx.log('Commands: list, open, status, logs, delete');
  },
};
```

### 2.4 config 命令

```typescript
// src/cli/commands/config-command.ts

const ConfigCommand: Command = {
  name: 'config',
  description: 'Manage configuration',
  subcommands: [
    {
      name: 'get',
      description: 'Get configuration value',
      arguments: [
        { name: 'key', type: 'string', description: 'Configuration key' },
      ],
      async handler(args: ParsedArgs, ctx: CLIContext): Promise<void> {
        const value = await ctx.config.get(args.positionals[0]);
        ctx.log(value);
      },
    },
    {
      name: 'set',
      description: 'Set configuration value',
      arguments: [
        { name: 'key', type: 'string', description: 'Configuration key' },
        { name: 'value', type: 'string', description: 'Configuration value' },
      ],
      async handler(args: ParsedArgs, ctx: CLIContext): Promise<void> {
        await ctx.config.set(args.positionals[0], args.positionals[1]);
        ctx.log(`Set ${args.positionals[0]} = ${args.positionals[1]}`);
      },
    },
    {
      name: 'list',
      description: 'List all configuration',
      options: [
        { name: 'format', short: 'f', type: 'string', description: 'Output format', choices: ['table', 'json'] },
        { name: 'show-secrets', type: 'boolean', description: 'Show secret values' },
      ],
      async handler(args: ParsedArgs, ctx: CLIContext): Promise<void> {
        const allConfig = await ctx.config.getAll();

        if (args.options.format === 'json') {
          ctx.log(JSON.stringify(allConfig, null, 2));
        } else {
          for (const [key, value] of Object.entries(allConfig)) {
            if (key.includes('secret') && !args.options.showSecrets) {
              ctx.log(`${key} = ****`);
            } else {
              ctx.log(`${key} = ${JSON.stringify(value)}`);
            }
          }
        }
      },
    },
    {
      name: 'init',
      description: 'Initialize CLI configuration',
      options: [
        { name: 'api-url', type: 'string', description: 'API URL' },
        { name: 'api-key', type: 'string', description: 'API Key' },
        { name: 'default-output', type: 'string', description: 'Default output directory' },
      ],
      async handler(args: ParsedArgs, ctx: CLIContext): Promise<void> {
        const apiUrl = args.options.apiUrl || await ctx.prompt.input('API URL:', { default: 'https://api.projectfactory.io' });
        const apiKey = args.options.apiKey || await ctx.prompt.password('API Key:');

        await ctx.config.set('api.url', apiUrl);
        await ctx.config.set('api.key', apiKey);

        if (args.options.defaultOutput) {
          await ctx.config.set('defaults.outputDir', args.options.defaultOutput);
        }

        ctx.log('Configuration initialized successfully');
      },
    },
  ],
};
```

## 3. CLI 框架

### 3.1 CLI 核心框架

```typescript
// src/cli/core/cli-framework.ts

// CLI 上下文
interface CLIContext {
  // 输出
  log(message: string): void;
  error(message: string): void;
  warn(message: string): void;

  // 交互
  spinner(text: string): Spinner;
  prompt: Prompt;

  // API
  api: APIClient;

  // 配置
  config: ConfigManager;

  // 系统
  open(url: string): Promise<void>;
  clipboard: ClipboardAPI;
}

class Spinner {
  private interval: NodeJS.Timeout | null = null;
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private frameIndex = 0;

  start(text: string): void {
    process.stdout.write(`${this.frames[0]} ${text}`);
    this.interval = setInterval(() => {
      process.stdout.write('\r' + '\x1b[K');
      process.stdout.write(`${this.frames[++this.frameIndex % this.frames.length]} ${text}`);
    }, 80);
  }

  succeed(text: string): void {
    this.stop();
    process.stdout.write('\r' + '\x1b[K');
    console.log('✅ ' + text);
  }

  fail(text: string): void {
    this.stop();
    process.stdout.write('\r' + '\x1b[K');
    console.log('❌ ' + text);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

// CLI 主程序
class CLI {
  private registry: CommandRegistry;
  private context: CLIContext;
  private parser: ArgumentParser;

  constructor() {
    this.registry = new CommandRegistry();
    this.parser = new ArgumentParser();
    this.context = this.createContext();

    this.registerCommands();
  }

  // 注册所有命令
  private registerCommands(): void {
    // 注册内置命令
    this.registry.register(InitCommand);
    this.registry.register(GenerateCommand);
    this.registry.register(ProjectCommand);
    this.registry.register(ConfigCommand);
    this.registry.register(AgentCommand);
    this.registry.register(PluginCommand);
    this.registry.register(SystemCommand);

    // 加载插件命令
    this.loadPluginCommands();
  }

  // 执行命令
  async run(argv: string[]): Promise<number> {
    try {
      // 解析参数
      const { command, args, globalOptions } = this.parser.parse(argv);

      // 应用全局选项
      this.applyGlobalOptions(globalOptions);

      // 查找命令
      const cmd = this.registry.get(command);

      if (!cmd) {
        this.context.error(`Unknown command: ${command}`);
        this.context.error(this.registry.getHelp());
        return 1;
      }

      // 执行前检查
      if (!this.checkPrerequisites(cmd)) {
        return 1;
      }

      // 执行命令
      await this.executeCommand(cmd, args);

      return 0;
    } catch (error) {
      this.context.error(`Error: ${(error as Error).message}`);

      if (process.env.DEBUG) {
        console.error((error as Error).stack);
      }

      return 1;
    }
  }

  // 执行命令
  private async executeCommand(cmd: Command, args: ParsedArgs): Promise<void> {
    // 如果有子命令，先处理子命令
    if (cmd.subcommands && args.positionals.length > 0) {
      const subcommand = args.positionals.shift();
      const subCmd = cmd.subcommands.find(sc => sc.name === subcommand);

      if (!subCmd) {
        this.context.error(`Unknown subcommand: ${subcommand}`);
        return;
      }

      await this.executeCommand(subCmd, args);
      return;
    }

    // 验证必需参数
    this.validateArguments(cmd, args);

    // 调用处理函数
    await cmd.handler(args, this.context);
  }
}
```

### 3.2 交互式提示

```typescript
// src/cli/core/prompt.ts

interface Prompt {
  // 文本输入
  input(message: string, options?: InputOptions): Promise<string>;

  // 密码输入
  password(message: string): Promise<string>;

  // 确认
  confirm(message: string, options?: ConfirmOptions): Promise<boolean>;

  // 选择
  select(message: string, choices: Choice[], options?: SelectOptions): Promise<string>;

  // 多选
  multiselect(message: string, choices: Choice[], options?: MultiselectOptions): Promise<string[]>;

  // 编辑器
  editor(message: string, options?: EditorOptions): Promise<string>;
}

interface InputOptions {
  default?: string;
  validate?: (value: string) => boolean | string;
}

interface Choice {
  label: string;
  value: string;
  description?: string;
}

// 实现（使用 Inquirer.js）
class InteractivePrompt implements Prompt {
  private inquirer: Inquirer;

  async input(message: string, options?: InputOptions): Promise<string> {
    const answer = await this.inquirer.prompt([
      {
        type: 'input',
        name: 'value',
        message,
        default: options?.default,
        validate: options?.validate,
      },
    ]);
    return answer.value;
  }

  async confirm(message: string, options?: ConfirmOptions): Promise<boolean> {
    const answer = await this.inquirer.prompt([
      {
        type: 'confirm',
        name: 'value',
        message,
        default: options?.default ?? true,
      },
    ]);
    return answer.value;
  }

  async select(message: string, choices: Choice[], options?: SelectOptions): Promise<string> {
    const answer = await this.inquirer.prompt([
      {
        type: 'list',
        name: 'value',
        message,
        choices: choices.map(c => ({
          name: c.description ? `${c.label} - ${c.description}` : c.label,
          value: c.value,
        })),
        default: options?.default,
      },
    ]);
    return answer.value;
  }

  async multiselect(message: string, choices: Choice[], options?: MultiselectOptions): Promise<string[]> {
    const answer = await this.inquirer.prompt([
      {
        type: 'checkbox',
        name: 'value',
        message,
        choices: choices.map(c => ({
          name: c.label,
          value: c.value,
          checked: options?.default?.includes(c.value),
        })),
        validate: (answer: string[]) => {
          if (options?.required && answer.length === 0) {
            return 'Please select at least one option';
          }
          return true;
        },
      },
    ]);
    return answer.value;
  }
}
```

### 3.3 输出格式化

```typescript
// src/cli/core/output-formatter.ts

// 输出格式化器
class OutputFormatter {
  // 表格输出
  toTable(data: any[], columns?: string[]): string {
    if (data.length === 0) return 'No data';

    const keys = columns || Object.keys(data[0]);

    // 计算列宽
    const widths = keys.map(key => {
      const values = data.map(row => String(row[key] || ''));
      return Math.max(key.length, ...values.map(v => v.length));
    });

    // 表头
    const header = keys.map((key, i) => key.padEnd(widths[i])).join(' | ');

    // 分隔线
    const separator = widths.map(w => '-'.repeat(w)).join('-+-');

    // 行
    const rows = data.map(row => {
      return keys.map((key, i) => String(row[key] || '').padEnd(widths[i])).join(' | ');
    });

    return [header, separator, ...rows].join('\n');
  }

  // JSON 输出
  toJSON(data: any, pretty = true): string {
    return JSON.stringify(data, null, pretty ? 2 : 0);
  }

  // CSV 输出
  toCSV(data: any[]): string {
    if (data.length === 0) return '';

    const keys = Object.keys(data[0]);
    const header = keys.join(',');

    const rows = data.map(row => {
      return keys.map(key => {
        const value = String(row[key] || '');
        // 转义引号
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });

    return [header, ...rows].join('\n');
  }

  // 树形输出
  toTree(data: any, indent = 0): string {
    const output: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        output.push('  '.repeat(indent) + key + ':');
        output.push(this.toTree(value, indent + 1));
      } else {
        const prefix = '  '.repeat(indent) + key + ':';
        const valStr = Array.isArray(value) ? `[${value.join(', ')}]` : String(value);
        output.push(`${prefix} ${valStr}`);
      }
    }

    return output.join('\n');
  }

  // 进度条
  progressBar(current: number, total: number, width = 40): string {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((current / total) * width);
    const empty = width - filled;

    return `[${'#'.repeat(filled)}${' '.repeat(empty)}] ${percentage}%`;
  }
}
```

## 4. 自动化与脚本

### 4.1 脚本执行器

```typescript
// src/cli/automation/script-runner.ts

// 自动化脚本定义
interface AutomationScript {
  id: string;
  name: string;
  description?: string;

  // 触发器
  trigger: ScriptTrigger;

  // 步骤
  steps: ScriptStep[];

  // 条件
  condition?: string;  // JavaScript 表达式

  // 配置
  config: {
    timeout?: number;
    retry?: RetryConfig;
    continueOnError?: boolean;
  };
}

interface ScriptTrigger {
  type: 'manual' | 'schedule' | 'event' | 'webhook';
  config: Record<string, unknown>;
}

interface ScriptStep {
  id: string;
  name: string;
  type: 'command' | 'http' | 'script' | 'condition' | 'loop' | 'parallel';
  config: StepConfig;
  onError?: {
    action: 'continue' | 'stop' | 'retry';
    maxRetries?: number;
  };
}

type StepConfig =
  | { type: 'command'; command: string; args?: string[] }
  | { type: 'http'; method: string; url: string; headers?: Record<string, string>; body?: unknown }
  | { type: 'script'; language: string; code: string }
  | { type: 'condition'; expression: string; thenSteps: string[]; elseSteps?: string[] }
  | { type: 'loop'; items: string[] | { from: string }; loopVariable: string; steps: string[] }
  | { type: 'parallel'; steps: string[] };

// 脚本执行引擎
class ScriptRunner {
  private context: ScriptExecutionContext;

  async execute(script: AutomationScript): Promise<ScriptResult> {
    const startTime = Date.now();
    const results: StepResult[] = [];
    const variables = new Map<string, unknown>();

    this.context.log(`Executing script: ${script.name}`);

    for (const step of script.steps) {
      const result = await this.executeStep(step, variables);
      results.push(result);

      if (result.status === 'failed') {
        if (!script.config.continueOnError && step.onError?.action === 'stop') {
          break;
        }
      }

      if (result.returnValue) {
        variables.set(`step.${step.id}.result`, result.returnValue);
      }
    }

    return {
      scriptId: script.id,
      status: results.every(r => r.status === 'success') ? 'success' : 'failed',
      startTime: new Date(startTime),
      endTime: new Date(),
      durationMs: Date.now() - startTime,
      stepResults: results,
      variables: Object.fromEntries(variables),
    };
  }

  private async executeStep(step: ScriptStep, variables: Map<string, unknown>): Promise<StepResult> {
    try {
      switch (step.type) {
        case 'command':
          return await this.executeCommand(step.config as { type: 'command'; command: string; args?: string[] }, variables);

        case 'http':
          return await this.executeHTTP(step.config as { type: 'http'; method: string; url: string }, variables);

        case 'script':
          return await this.executeScript(step.config as { type: 'script'; language: string; code: string }, variables);

        case 'condition':
          return await this.executeCondition(step.config as any, step, variables);

        case 'loop':
          return await this.executeLoop(step.config as any, step, variables);

        case 'parallel':
          return await this.executeParallel(step.config as any, variables);
      }
    } catch (error) {
      if (step.onError?.action === 'retry' && (step.onError.maxRetries || 0) > 0) {
        return this.retryStep(step, variables, step.onError.maxRetries!);
      }
      return { stepId: step.id, status: 'failed', error: (error as Error).message };
    }
  }
}
```

### 4.2 Cron 调度器

```typescript
// src/cli/automation/cron-scheduler.ts

// Cron 任务定义
interface CronJob {
  id: string;
  name: string;
  schedule: string;          // cron 表达式
  command: string;
  args?: string[];
  options?: {
    enabled?: boolean;
    timeout?: number;
    retry?: RetryConfig;
    notification?: NotificationConfig;
  };
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  successCount: number;
  failureCount: number;
}

// Cron 调度器
class CronScheduler {
  private jobs = new Map<string, CronJob>();
  private running = false;
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(private runner: ScriptRunner) {}

  // 添加任务
  addJob(job: CronJob): void {
    this.jobs.set(job.id, job);

    if (job.options?.enabled !== false) {
      this.scheduleJob(job);
    }
  }

  // 启动调度器
  start(): void {
    this.running = true;

    for (const job of this.jobs.values()) {
      if (job.options?.enabled !== false) {
        this.scheduleJob(job);
      }
    }

    console.log(`Cron scheduler started with ${this.jobs.size} jobs`);
  }

  // 停止调度器
  stop(): void {
    this.running = false;

    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }

    this.intervals.clear();
  }

  // 调度任务
  private scheduleJob(job: CronJob): void {
    // 解析 cron 表达式
    const interval = this.cronToInterval(job.schedule);

    // 计算下次运行时间
    job.nextRun = this.getNextRunTime(job.schedule);

    const timer = setInterval(async () => {
      if (!this.running) return;

      await this.runJob(job);
      job.nextRun = this.getNextRunTime(job.schedule);
    }, interval);

    this.intervals.set(job.id, timer);
  }

  // 运行任务
  private async runJob(job: CronJob): Promise<void> {
    job.lastRun = new Date();
    job.runCount++;

    console.log(`[Cron] Running job: ${job.name}`);

    try {
      const args = [job.command, ...(job.args || [])];
      await CLI.run(args);

      job.successCount++;
      console.log(`[Cron] Job ${job.name} completed successfully`);

      if (job.options?.notification?.onSuccess) {
        await this.sendNotification(job, 'success');
      }
    } catch (error) {
      job.failureCount++;
      console.error(`[Cron] Job ${job.name} failed:`, error);

      if (job.options?.notification?.onFailure) {
        await this.sendNotification(job, 'failure', (error as Error).message);
      }
    }
  }

  // Cron 表达式转毫秒间隔
  private cronToInterval(cron: string): number {
    // 简化的解析，实际应使用 cron-parser 库
    const parts = cron.split(' ');
    const [minute, hour, day, month, weekday] = parts;

    // 每分钟运行
    if (minute === '*') return 60000;

    // 每天运行
    if (minute !== '*' && hour !== '*') {
      return 24 * 60 * 60 * 1000;
    }

    return 60000;
  }

  private getNextRunTime(cron: string): Date {
    // 使用 cron-parser 计算下次运行时间
    const parser = new CronParser(cron);
    return parser.next();
  }
}
```

## 5. 开发工具集成

### 5.1 VS Code 扩展

```typescript
// src/cli/vscode-extension/package.json
{
  "name": "projectfactory-vscode",
  "displayName": "ProjectFactory",
  "description": "ProjectFactory IDE Integration",
  "version": "1.0.0",
  "publisher": "projectfactory",
  "engines": {
    "vscode": "^1.75.0"
  },
  "categories": ["Developer", "AI"],
  "activationEvents": [],
  "main": "./extension.js",
  "contributes": {
    "commands": [
      {
        "command": "projectfactory.generateProject",
        "title": "ProjectFactory: Generate Project",
        "category": "ProjectFactory"
      },
      {
        "command": "projectfactory.openDashboard",
        "title": "ProjectFactory: Open Dashboard",
        "category": "ProjectFactory"
      },
      {
        "command": "projectfactory.refreshStatus",
        "title": "ProjectFactory: Refresh Status",
        "category": "ProjectFactory"
      }
    ],
    "views": [
      {
        "id": "projectfactory.projects",
        "name": "Projects",
        "icon": "media/icon.svg"
      }
    ],
    "configuration": {
      "title": "ProjectFactory",
      "properties": {
        "projectfactory.apiUrl": {
          "type": "string",
          "default": "https://api.projectfactory.io",
          "description": "ProjectFactory API URL"
        },
        "projectfactory.autoRefresh": {
          "type": "boolean",
          "default": true,
          "description": "Auto refresh project status"
        }
      }
    }
  }
}
```

### 5.2 IDE 集成服务

```typescript
// src/cli/ide/ide-integration.ts

// IDE 集成接口
interface IDEIntegration {
  // 项目状态
  updateProjectStatus(status: ProjectStatus): void;

  // 输出面板
  showOutput(message: string, panel?: OutputPanel): void;

  // 进度
  showProgress(progress: ProgressInfo): void;

  // 通知
  showNotification(message: string, type: 'info' | 'warning' | 'error'): void;

  // 文件操作
  openFile(path: string, position?: { line: number; column: number }): void;
  createFile(path: string, content: string): Promise<void>;
  modifyFile(path: string, changes: FileChange[]): Promise<void>;

  // 代码Lens
  registerCodeLens(lens: CodeLensProvider): void;

  // 代码补全
  registerCompletionProvider(provider: CompletionProvider): void;

  // 悬浮提示
  registerHoverProvider(provider: HoverProvider): void;
}

// VS Code 集成实现
class VSCodeIntegration implements IDEIntegration {
  private vscode: typeof import('vscode');

  constructor(vscode: typeof import('vscode')) {
    this.vscode = vscode;
  }

  updateProjectStatus(status: ProjectStatus): void {
    const statusBar = this.vscode.window.createStatusBarItem(
      StatusBarAlignment.Left,
      100
    );

    const icon = this.getStatusIcon(status.stage);
    statusBar.text = `${icon} ${status.name}: ${status.stage}`;
    statusBar.tooltip = `Quality: ${status.qualityScore || 'N/A'}`;

    statusBar.command = {
      command: 'projectfactory.showProjectDetails',
      title: 'Show Details',
    };

    statusBar.show();
  }

  showOutput(message: string, panel = OutputPanel.Output): void {
    const output = this.vscode.window.createOutputChannel(panel);
    output.appendLine(message);
    output.show();
  }

  openFile(path: string, position?: { line: number; column: number }): void {
    const uri = this.vscode.Uri.file(path);
    this.vscode.commands.executeCommand('vscode.open', uri, {
      selection: position ? new this.vscode.Range(
        position.line, position.column,
        position.line, position.column
      ) : undefined,
    });
  }
}
```

---

**最后更新**: 2026-04-14
**版本**: v1.0
