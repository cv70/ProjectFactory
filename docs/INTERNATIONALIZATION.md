# 国际化与本地化设计

## 概述

本文档定义 ProjectFactory 系统的国际化（i18n）和本地化（l10n）策略，支持多语言、多地区、多时区的用户界面和服务端消息，满足全球化部署需求。

## 1. 国际化架构

### 1.1 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      客户端 (React)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  i18next     │  │  react-i18n │  │  FormatJS   │         │
│  │  核心        │  │  集成        │  │  格式化     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                      语言检测层                               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │ URL     │  │ Cookie  │  │浏览器   │  │用户偏好  │         │
│  │ 前缀    │  │         │  │语言     │  │设置      │         │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘         │
├─────────────────────────────────────────────────────────────┤
│                      服务端 (Node.js)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │ i18next     │  │ 消息模板    │  │ 地区数据    │           │
│  │ Backend     │  │ 管理        │  │ (CLDR)     │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
├─────────────────────────────────────────────────────────────┤
│                      翻译资源                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ en.json │  │ zh.json │  │ ja.json │  │ ...     │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 支持的语言和地区

```typescript
// src/i18n/supported-locales.ts
interface LocaleConfig {
  code: string;          // IETF 语言标签 (e.g., 'en-US')
  name: string;         // 英文名称
  nativeName: string;   // 本地名称
  direction: 'ltr' | 'rtl';  // 文本方向
  dateFormat: string;    // 日期格式
  numberFormat: {
    decimal: string;
    thousands: string;
    currency: string;
  };
}

const SupportedLocales: LocaleConfig[] = [
  {
    code: 'en-US',
    name: 'English (US)',
    nativeName: 'English',
    direction: 'ltr',
    dateFormat: 'MM/DD/YYYY',
    numberFormat: { decimal: '.', thousands: ',', currency: '$' },
  },
  {
    code: 'en-GB',
    name: 'English (UK)',
    nativeName: 'English (UK)',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: { decimal: '.', thousands: ',', currency: '£' },
  },
  {
    code: 'zh-CN',
    name: 'Chinese (Simplified)',
    nativeName: '简体中文',
    direction: 'ltr',
    dateFormat: 'YYYY-MM-DD',
    numberFormat: { decimal: '.', thousands: ',', currency: '¥' },
  },
  {
    code: 'zh-TW',
    name: 'Chinese (Traditional)',
    nativeName: '繁體中文',
    direction: 'ltr',
    dateFormat: 'YYYY/MM/DD',
    numberFormat: { decimal: '.', thousands: ',', currency: 'NT$' },
  },
  {
    code: 'ja-JP',
    name: 'Japanese',
    nativeName: '日本語',
    direction: 'ltr',
    dateFormat: 'YYYY/MM/DD',
    numberFormat: { decimal: '.', thousands: ',', currency: '¥' },
  },
  {
    code: 'ko-KR',
    name: 'Korean',
    nativeName: '한국어',
    direction: 'ltr',
    dateFormat: 'YYYY-MM-DD',
    numberFormat: { decimal: '.', thousands: ',', currency: '₩' },
  },
  {
    code: 'de-DE',
    name: 'German',
    nativeName: 'Deutsch',
    direction: 'ltr',
    dateFormat: 'DD.MM.YYYY',
    numberFormat: { decimal: ',', thousands: '.', currency: '€' },
  },
  {
    code: 'fr-FR',
    name: 'French',
    nativeName: 'Français',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: { decimal: ',', thousands: ' ', currency: '€' },
  },
  {
    code: 'es-ES',
    name: 'Spanish',
    nativeName: 'Español',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: { decimal: ',', thousands: '.', currency: '€' },
  },
  {
    code: 'pt-BR',
    name: 'Portuguese (Brazil)',
    nativeName: 'Português (Brasil)',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: { decimal: ',', thousands: '.', currency: 'R$' },
  },
  {
    code: 'ar-SA',
    name: 'Arabic',
    nativeName: 'العربية',
    direction: 'rtl',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: { decimal: '٫', thousands: '٬', currency: '﷼' },
  },
  {
    code: 'hi-IN',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    direction: 'ltr',
    dateFormat: 'DD-MM-YYYY',
    numberFormat: { decimal: '.', thousands: ',', currency: '₹' },
  },
];

const DefaultLocale = 'en-US';
const SupportedLanguageCodes = SupportedLocales.map(l => l.code.split('-')[0]);
```

## 2. 前端国际化实现

### 2.1 i18next 配置

```typescript
// frontend/src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslations from './locales/en.json';
import zhCNTranslations from './locales/zh-CN.json';
import jaJPTranslations from './locales/ja-JP.json';

// 命名空间
const namespaces = [
  'common',      // 通用词汇和短句
  'dashboard',   // 仪表盘页面
  'projects',    // 项目相关
  'settings',    // 设置页面
  'errors',      // 错误消息
  'help',        // 帮助文档
];

// 资源定义
const resources = {
  'en-US': {
    common: enTranslations.common,
    dashboard: enTranslations.dashboard,
    projects: enTranslations.projects,
    settings: enTranslations.settings,
    errors: enTranslations.errors,
    help: enTranslations.help,
  },
  'zh-CN': {
    common: zhCNTranslations.common,
    dashboard: zhCNTranslations.dashboard,
    projects: zhCNTranslations.projects,
    settings: zhCNTranslations.settings,
    errors: zhCNTranslations.errors,
    help: zhCNTranslations.help,
  },
  'ja-JP': {
    common: jaJPTranslations.common,
    dashboard: jaJPTranslations.dashboard,
    projects: jaJPTranslations.projects,
    settings: jaJPTranslations.settings,
    errors: jaJPTranslations.errors,
    help: jaJPTranslations.help,
  },
};

i18n
  .use(LanguageDetector)           // 自动检测语言
  .use(initReactI18next)          // React 绑定
  .init({
    resources,
    ns: namespaces,
    defaultNS: 'common',

    // 语言检测配置
    detection: {
      order: ['path', 'cookie', 'navigator', 'htmlTag'],
      paths: ['/en/', '/zh/', '/ja/'],  // URL 路径
      cookieOptions: {
        path: '/',
        sameSite: 'strict',
      },
    },

    // 回退配置
    fallbackLng: {
      'zh-Hans': ['zh-CN', 'en-US'],
      'zh-Hant': ['zh-TW', 'en-US'],
      default: ['en-US'],
    },

    // 插值配置
    interpolation: {
      escapeValue: false,  // React 已经处理了 XSS
      format: (value, format, locale) => {
        if (value instanceof Date) {
          return formatDate(value, format || 'short', locale);
        }
        if (typeof value === 'number') {
          return formatNumber(value, format || 'decimal', locale);
        }
        return value;
      },
    },

    // 默认语言
    lng: 'en-US',

    // 命名空间配置
    nsSeparator: ':',
    keySeparator: '.',

    // 开发配置
    debug: process.env.NODE_ENV === 'development',

    // 缺少键的处理
    missingKeyHandler: (lng, ns, key) => {
      console.warn(`Missing translation key: ${ns}:${key}`);
    },
  });

export default i18n;

// 辅助函数
export const formatDate = (date: Date, format: string, locale: string): string => {
  const localeConfig = SupportedLocales.find(l => l.code === locale) || SupportedLocales[0];

  const options: Intl.DateTimeFormatOptions = {
    short: { year: 'numeric', month: 'short', day: 'numeric' },
    medium: { year: 'numeric', month: 'long', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' },
    full: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', hour: 'numeric', minute: 'numeric' },
  }[format] || { year: 'numeric', month: 'short', day: 'numeric' };

  return new Intl.DateTimeFormat(locale, options).format(date);
};

export const formatNumber = (num: number, format: string, locale: string): string => {
  const localeConfig = SupportedLocales.find(l => l.code === locale) || SupportedLocales[0];

  const options: Intl.NumberFormatOptions = {
    decimal: { minimumFractionDigits: 0, maximumFractionDigits: 2 },
    currency: { style: 'currency', currency: localeConfig.numberFormat.currency },
    percent: { style: 'percent' },
    compact: { notation: 'compact' },
  }[format] || {};

  return new Intl.NumberFormat(locale, options).format(num);
};
```

### 2.2 翻译文件结构

```typescript
// frontend/src/i18n/locales/en.json
{
  "common": {
    "app": {
      "name": "ProjectFactory",
      "tagline": "Infinite Automated Project Generation"
    },
    "nav": {
      "dashboard": "Dashboard",
      "projects": "Projects",
      "ideas": "Ideas",
      "settings": "Settings",
      "help": "Help",
      "logout": "Log out"
    },
    "actions": {
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete",
      "edit": "Edit",
      "create": "Create",
      "submit": "Submit",
      "confirm": "Confirm",
      "close": "Close",
      "back": "Back",
      "next": "Next",
      "previous": "Previous",
      "retry": "Retry",
      "refresh": "Refresh",
      "search": "Search",
      "filter": "Filter",
      "export": "Export",
      "import": "Import"
    },
    "status": {
      "loading": "Loading...",
      "saving": "Saving...",
      "success": "Success",
      "error": "Error",
      "warning": "Warning",
      "info": "Info",
      "pending": "Pending",
      "inProgress": "In Progress",
      "completed": "Completed",
      "failed": "Failed"
    },
    "pagination": {
      "showing": "Showing {{start}} to {{end}} of {{total}}",
      "page": "Page {{current}} of {{total}}",
      "perPage": "{{count}} per page",
      "firstPage": "First page",
      "lastPage": "Last page",
      "nextPage": "Next page",
      "prevPage": "Previous page"
    },
    "empty": {
      "title": "No data",
      "description": "There are no items to display."
    },
    "time": {
      "justNow": "Just now",
      "minutesAgo": "{{count}} minute ago",
      "minutesAgo_plural": "{{count}} minutes ago",
      "hoursAgo": "{{count}} hour ago",
      "hoursAgo_plural": "{{count}} hours ago",
      "daysAgo": "{{count}} day ago",
      "daysAgo_plural": "{{count}} days ago"
    }
  },

  "dashboard": {
    "title": "Dashboard",
    "welcome": "Welcome back, {{name}}",
    "overview": {
      "title": "Overview",
      "totalProjects": "Total Projects",
      "activeProjects": "Active Projects",
      "completedToday": "Completed Today",
      "totalIdeas": "Total Ideas"
    },
    "recentActivity": {
      "title": "Recent Activity",
      "viewAll": "View all"
    },
    "quickActions": {
      "title": "Quick Actions",
      "newProject": "New Project",
      "viewIdeas": "View Ideas",
      "generateNow": "Generate Now"
    }
  },

  "projects": {
    "list": {
      "title": "Projects",
      "newProject": "New Project",
      "searchPlaceholder": "Search projects...",
      "filterByStatus": "Filter by status",
      "sortBy": "Sort by"
    },
    "card": {
      "createdOn": "Created on {{date}}",
      "lastModified": "Last modified {{date}}",
      "qualityScore": "Quality score: {{score}}",
      "viewProject": "View Project",
      "deleteProject": "Delete Project"
    },
    "detail": {
      "overview": "Overview",
      "files": "Files",
      "tests": "Tests",
      "reviews": "Reviews",
      "history": "History",
      "settings": "Settings"
    },
    "status": {
      "pending": "Pending",
      "queued": "Queued",
      "generating": "Generating",
      "testing": "Testing",
      "building": "Building",
      "reviewing": "Reviewing",
      "completed": "Completed",
      "failed": "Failed"
    }
  },

  "errors": {
    "generic": {
      "title": "Something went wrong",
      "description": "An unexpected error occurred. Please try again.",
      "retry": "Try Again",
      "contactSupport": "Contact Support"
    },
    "notFound": {
      "title": "Page not found",
      "description": "The page you're looking for doesn't exist or has been moved.",
      "goHome": "Go to Homepage"
    },
    "unauthorized": {
      "title": "Unauthorized",
      "description": "You need to log in to access this page."
    },
    "forbidden": {
      "title": "Access denied",
      "description": "You don't have permission to access this resource."
    },
    "validation": {
      "required": "{{field}} is required",
      "minLength": "{{field}} must be at least {{min}} characters",
      "maxLength": "{{field}} must be at most {{max}} characters",
      "invalidFormat": "{{field}} has an invalid format",
      "invalidEmail": "Please enter a valid email address"
    },
    "network": {
      "title": "Connection error",
      "description": "Unable to connect to the server. Please check your internet connection.",
      "retry": "Retry"
    }
  }
}
```

```typescript
// frontend/src/i18n/locales/zh-CN.json
{
  "common": {
    "app": {
      "name": "ProjectFactory",
      "tagline": "无限自动化项目生成"
    },
    "nav": {
      "dashboard": "仪表盘",
      "projects": "项目",
      "ideas": "创意",
      "settings": "设置",
      "help": "帮助",
      "logout": "退出登录"
    },
    "actions": {
      "save": "保存",
      "cancel": "取消",
      "delete": "删除",
      "edit": "编辑",
      "create": "创建",
      "submit": "提交",
      "confirm": "确认",
      "close": "关闭",
      "back": "返回",
      "next": "下一步",
      "previous": "上一步",
      "retry": "重试",
      "refresh": "刷新",
      "search": "搜索",
      "filter": "筛选",
      "export": "导出",
      "import": "导入"
    },
    "status": {
      "loading": "加载中...",
      "saving": "保存中...",
      "success": "成功",
      "error": "错误",
      "warning": "警告",
      "info": "提示",
      "pending": "等待中",
      "inProgress": "进行中",
      "completed": "已完成",
      "failed": "失败"
    },
    "pagination": {
      "showing": "显示第 {{start}} 至 {{end}} 条，共 {{total}} 条",
      "page": "第 {{current}} 页，共 {{total}} 页",
      "perPage": "每页 {{count}} 条",
      "firstPage": "首页",
      "lastPage": "末页",
      "nextPage": "下一页",
      "prevPage": "上一页"
    },
    "empty": {
      "title": "暂无数据",
      "description": "当前没有可显示的内容。"
    },
    "time": {
      "justNow": "刚刚",
      "minutesAgo": "{{count}} 分钟前",
      "minutesAgo_plural": "{{count}} 分钟前",
      "hoursAgo": "{{count}} 小时前",
      "hoursAgo_plural": "{{count}} 小时前",
      "daysAgo": "{{count}} 天前",
      "daysAgo_plural": "{{count}} 天前"
    }
  },

  "dashboard": {
    "title": "仪表盘",
    "welcome": "欢迎回来，{{name}}",
    "overview": {
      "title": "概览",
      "totalProjects": "项目总数",
      "activeProjects": "活跃项目",
      "completedToday": "今日完成",
      "totalIdeas": "创意总数"
    },
    "recentActivity": {
      "title": "最近活动",
      "viewAll": "查看全部"
    },
    "quickActions": {
      "title": "快捷操作",
      "newProject": "新建项目",
      "viewIdeas": "查看创意",
      "generateNow": "立即生成"
    }
  },

  "projects": {
    "list": {
      "title": "项目",
      "newProject": "新建项目",
      "searchPlaceholder": "搜索项目...",
      "filterByStatus": "按状态筛选",
      "sortBy": "排序"
    },
    "card": {
      "createdOn": "创建于 {{date}}",
      "lastModified": "最后修改于 {{date}}",
      "qualityScore": "质量评分：{{score}}",
      "viewProject": "查看项目",
      "deleteProject": "删除项目"
    },
    "detail": {
      "overview": "概览",
      "files": "文件",
      "tests": "测试",
      "reviews": "审查",
      "history": "历史",
      "settings": "设置"
    },
    "status": {
      "pending": "等待中",
      "queued": "排队中",
      "generating": "生成中",
      "testing": "测试中",
      "building": "构建中",
      "reviewing": "审查中",
      "completed": "已完成",
      "failed": "失败"
    }
  },

  "errors": {
    "generic": {
      "title": "出了点问题",
      "description": "发生了意外错误，请重试。",
      "retry": "重试",
      "contactSupport": "联系支持"
    },
    "notFound": {
      "title": "页面未找到",
      "description": "您访问的页面不存在或已被移动。",
      "goHome": "返回首页"
    },
    "unauthorized": {
      "title": "未授权",
      "description": "您需要登录才能访问此页面。"
    },
    "forbidden": {
      "title": "访问被拒绝",
      "description": "您没有权限访问此资源。"
    },
    "validation": {
      "required": "{{field}} 不能为空",
      "minLength": "{{field}} 至少需要 {{min}} 个字符",
      "maxLength": "{{field}} 最多 {{max}} 个字符",
      "invalidFormat": "{{field}} 格式无效",
      "invalidEmail": "请输入有效的电子邮件地址"
    },
    "network": {
      "title": "连接错误",
      "description": "无法连接到服务器，请检查网络连接。",
      "retry": "重试"
    }
  }
}
```

## 3. 后端国际化实现

### 3.1 服务端 i18n 配置

```typescript
// backend/src/i18n/index.ts
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import middleware from 'i18next-http-middleware';

class I18nService {
  private static instance: I18nService;
  private initialized = false;

  private constructor() {}

  static getInstance(): I18nService {
    if (!I18nService.instance) {
      I18nService.instance = new I18nService();
    }
    return I18nService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await i18next
      .use(Backend)
      .use(middleware.LanguageDetector)
      .init({
        // 后端配置
        backend: {
          loadPath: './locales/{{lng}}/{{ns}}.json',
          addPath: './locales/{{lng}}/{{ns}}.missing.json',
        },

        // 命名空间
        ns: ['common', 'errors', 'validation', 'emails'],
        defaultNS: 'common',

        // 语言检测
        detection: {
          order: ['header', 'querystring', 'cookie'],
          caches: ['cookie'],
          cookieOptions: {
            path: '/',
            sameSite: 'strict',
          },
          header: 'accept-language',
          headerLookups: {
            header: 'i18next-lang',
          },
        },

        // 回退
        fallbackLng: 'en',

        // 预加载
        preload: ['en', 'zh', 'ja'],

        // 保存缺失的键
        saveMissing: process.env.NODE_ENV === 'development',
        missingKeyHandler: (lng, ns, key) => {
          console.warn(`Missing i18n key: ${ns}:${key} (${lng})`);
        },

        // 命名空间分隔符
        nsSeparator: ':',
        keySeparator: '.',

        // interpolation
        interpolation: {
          escapeValue: false,
        },
      });

    this.initialized = true;
  }

  getHandler() {
    return middleware.handle(i18next);
  }

  t(key: string, options?: Record<string, unknown>): string {
    return i18next.t(key, options);
  }

  changeLanguage(lng: string): Promise<void> {
    return i18next.changeLanguage(lng);
  }

  getCurrentLanguage(): string {
    return i18next.language;
  }

  getSupportedLanguages(): string[] {
    return i18next.options.supportedLngs || [];
  }
}

export const i18nService = I18nService.getInstance();

// Express 中间件使用
// app.use(i18nService.getHandler());

// 控制器中使用
// const errorMessage = i18nService.t('errors.project.notFound', { id: projectId });
```

### 3.2 后端翻译消息

```typescript
// backend/locales/en/errors.json
{
  "project": {
    "notFound": "Project not found: {{id}}",
    "alreadyExists": "Project with name '{{name}}' already exists",
    "invalidStatus": "Invalid project status: {{status}}",
    "cannotDelete": "Cannot delete project in status: {{status}}"
  },
  "idea": {
    "notFound": "Idea not found: {{id}}",
    "alreadyExists": "Idea with title '{{title}}' already exists",
    "invalidPriority": "Invalid priority value: {{priority}}"
  },
  "auth": {
    "invalidCredentials": "Invalid email or password",
    "tokenExpired": "Authentication token has expired",
    "tokenInvalid": "Invalid authentication token",
    "insufficientPermissions": "Insufficient permissions for this action"
  },
  "validation": {
    "required": "{{field}} is required",
    "minLength": "{{field}} must be at least {{min}} characters",
    "maxLength": "{{field}} must be at most {{max}} characters",
    "invalidEmail": "Invalid email address",
    "invalidUrl": "Invalid URL format"
  },
  "llm": {
    "apiError": "AI service error: {{message}}",
    "rateLimit": "AI service rate limit exceeded. Please try again later.",
    "timeout": "AI service request timed out",
    "quotaExceeded": "AI service quota exceeded"
  },
  "quality": {
    "coverageTooLow": "Test coverage {{coverage}}% is below threshold {{threshold}}%",
    "lintErrors": "{{count}} lint errors found",
    "buildFailed": "Build failed: {{message}}"
  }
}
```

## 4. 多语言内容处理

### 4.1 动态内容翻译

```typescript
// src/i18n/dynamic-content.ts

// 动态内容的翻译处理
interface TranslatedContent {
  original: string;
  translations: Record<string, string>;
  lastUpdated: number;
}

class DynamicTranslationService {
  private cache: Map<string, TranslatedContent> = new Map();
  private translationService: TranslationService;

  constructor(translationService: TranslationService) {
    this.translationService = translationService;
  }

  // 翻译用户生成的内容（如项目描述）
  async translateContent(
    content: string,
    targetLocales: string[],
    options?: {
      preserveFormat?: boolean;
      context?: string;
    }
  ): Promise<Record<string, string>> {
    const cacheKey = this.hashContent(content);
    const cached = this.cache.get(cacheKey);

    // 检查缓存
    if (cached) {
      const missingLocales = targetLocales.filter(l => !cached.translations[l]);
      if (missingLocales.length === 0) {
        return cached.translations;
      }
    }

    // 并行翻译到所有目标语言
    const translations = await Promise.all(
      targetLocales.map(async (locale) => {
        const existing = cached?.translations[locale];
        if (existing) return { locale, translation: existing };

        const translation = await this.translationService.translate(content, {
          targetLocale: locale,
          context: options?.context,
          preserveFormat: options?.preserveFormat,
        });

        return { locale, translation };
      })
    );

    // 构建结果
    const result: Record<string, string> = {};
    for (const { locale, translation } of translations) {
      result[locale] = translation;
    }

    // 缓存
    this.cache.set(cacheKey, {
      original: content,
      translations: result,
      lastUpdated: Date.now(),
    });

    return result;
  }

  private hashContent(content: string): string {
    // 简单的哈希实现
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) - hash) + content.charCodeAt(i);
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  // 清除缓存
  clearCache(): void {
    this.cache.clear();
  }
}

// 项目描述的多语言处理
class ProjectDescriptionTranslator {
  async translateProjectDescriptions(
    projectId: string,
    targetLocales: string[]
  ): Promise<void> {
    const project = await projectService.findById(projectId);

    if (!project.description) return;

    const translations = await dynamicTranslationService.translateContent(
      project.description,
      targetLocales,
      { context: 'project_description' }
    );

    await projectService.updateTranslations(projectId, translations);
  }
}
```

### 4.2 AI 生成内容的多语言支持

```typescript
// src/i18n/ai-content.ts

// AI 生成内容的多语言支持
class AIGeneratedContentManager {
  private llmService: LLMService;

  // 使用指定语言生成内容
  async generateLocalizedContent(
    prompt: string,
    targetLocale: string,
    options?: {
      maxTokens?: number;
      tone?: 'formal' | 'casual' | 'technical';
    }
  ): Promise<string> {
    // 构建本地化的提示
    const localizedPrompt = await this.buildLocalizedPrompt(prompt, targetLocale, options);

    // 生成内容
    const content = await this.llmService.generate(localizedPrompt, {
      maxTokens: options?.maxTokens,
      temperature: 0.7,
    });

    return content;
  }

  private async buildLocalizedPrompt(
    originalPrompt: string,
    locale: string,
    options?: { tone?: string }
  ): Promise<string> {
    const localeInstructions: Record<string, string> = {
      'en-US': 'Write in American English.',
      'en-GB': 'Write in British English.',
      'zh-CN': '使用简体中文。保持专业但友好的语气。',
      'zh-TW': '使用繁體中文。保持專業但友善的語氣。',
      'ja-JP': '日本語で書いてください。丁寧語を使用してください。',
      'ko-KR': '한국어로 작성하세요. 격식체와 반말을 적절히 섞어 사용하세요.',
      'de-DE': 'Schreiben Sie auf Deutsch. Verwenden Sie eine formelle Ansprache.',
      'fr-FR': 'Écrivez en français. Utilisez un ton formel et courtois.',
      'es-ES': 'Escribe en español. Usa un tono formal y cortés.',
    };

    const toneInstructions: Record<string, string> = {
      formal: 'Use a formal, professional tone.',
      casual: 'Use a casual, friendly tone.',
      technical: 'Use a technical, precise tone.',
    };

    const instructions: string[] = [];

    if (localeInstructions[locale]) {
      instructions.push(localeInstructions[locale]);
    }

    if (options?.tone && toneInstructions[options.tone]) {
      instructions.push(toneInstructions[options.tone]);
    }

    return instructions.length > 0
      ? `${originalPrompt}\n\n${instructions.join('\n')}`
      : originalPrompt;
  }

  // 生成多语言版本的项目文档
  async generateProjectDocumentation(
    project: Project,
    locales: string[]
  ): Promise<Record<string, { readme: string; changelog: string; contributing: string }>> {
    const results: Record<string, any> = {};

    // 先生成英文版本作为基础
    const basePrompts = {
      readme: `Create a comprehensive README for a project called "${project.name}". Description: ${project.description}`,
      changelog: `Create a CHANGELOG template for "${project.name}". Include sections for Added, Changed, Fixed, and Removed.`,
      contributing: `Create a CONTRIBUTING guide for "${project.name}".`,
    };

    // 生成基础版本
    const baseContent = await Promise.all([
      this.generateLocalizedContent(basePrompts.readme, 'en-US', { tone: 'technical' }),
      this.generateLocalizedContent(basePrompts.changelog, 'en-US', { tone: 'formal' }),
      this.generateLocalizedContent(basePrompts.contributing, 'en-US', { tone: 'formal' }),
    ]);

    results['en-US'] = {
      readme: baseContent[0],
      changelog: baseContent[1],
      contributing: baseContent[2],
    };

    // 翻译到其他语言
    for (const locale of locales) {
      if (locale === 'en-US') continue;

      results[locale] = {
        readme: await this.generateLocalizedContent(baseContent[0], locale, { tone: 'technical' }),
        changelog: await this.generateLocalizedContent(baseContent[1], locale, { tone: 'formal' }),
        contributing: await this.generateLocalizedContent(baseContent[2], locale, { tone: 'formal' }),
      };
    }

    return results;
  }
}
```

## 5. 地区化格式化

### 5.1 日期、时间、数字格式化

```typescript
// src/i18n/formatting.ts

// 地区特定的格式化工具
class LocaleFormatter {
  private locale: string;

  constructor(locale: string) {
    this.locale = locale;
  }

  // 日期格式化
  formatDate(date: Date | number, format: 'short' | 'medium' | 'long' | 'full' = 'medium'): string {
    const options: Intl.DateTimeFormatOptions = {
      short: { year: 'numeric', month: 'short', day: 'numeric' },
      medium: { year: 'numeric', month: 'long', day: 'numeric' },
      long: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' },
      full: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', hour: 'numeric', minute: 'numeric' },
    }[format];

    return new Intl.DateTimeFormat(this.locale, options).format(
      typeof date === 'number' ? new Date(date) : date
    );
  }

  // 相对时间格式化
  formatRelativeTime(date: Date | number): string {
    const now = Date.now();
    const timestamp = typeof date === 'number' ? date : date.getTime();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const rtf = new Intl.RelativeTimeFormat(this.locale, { numeric: 'auto' });

    if (days > 0) return rtf.format(-days, 'day');
    if (hours > 0) return rtf.format(-hours, 'hour');
    if (minutes > 0) return rtf.format(-minutes, 'minute');
    return rtf.format(-seconds, 'second');
  }

  // 数字格式化
  formatNumber(num: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(this.locale, options).format(num);
  }

  // 货币格式化
  formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat(this.locale, {
      style: 'currency',
      currency,
    }).format(amount);
  }

  // 百分比格式化
  formatPercent(num: number, decimals = 1): string {
    return new Intl.NumberFormat(this.locale, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  }

  // 列表格式化
  formatList(items: string[], style: 'long' | 'short' | 'narrow' = 'long'): string {
    return new Intl.ListFormat(this.locale, { style }).format(items);
  }

  // 名字格式化
  formatName(name: { givenName?: string; familyName?: string }, style: 'long' | 'short' | 'narrow' = 'long'): string {
    return new Intl.DisplayNames(this.locale, { type: 'personalName' }).of(`${name.givenName} ${name.familyName}`) || '';
  }
}

// Hook for React
// const format = useFormatter();
// format.formatDate(new Date(), 'long');
// format.formatCurrency(100, 'USD');

import { createContext, useContext } from 'react';

const FormatterContext = createContext<LocaleFormatter | null>(null);

export function useFormatter(): LocaleFormatter {
  const formatter = useContext(FormatterContext);
  if (!formatter) {
    throw new Error('useFormatter must be used within FormatterProvider');
  }
  return formatter;
}
```

### 5.2 时区处理

```typescript
// src/i18n/timezone.ts

interface TimezoneConfig {
  userTimezone?: string;
  projectTimezone?: string;
  defaultTimezone: string;
}

class TimezoneService {
  private defaultTimezone: string;

  constructor(config: TimezoneConfig) {
    this.defaultTimezone = config.defaultTimezone;
  }

  // 获取用户的时区
  getUserTimezone(): string {
    // 优先使用用户设置
    const userTimezone = getUserPreference('timezone');
    if (userTimezone) return userTimezone;

    // 尝试从浏览器获取
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return this.defaultTimezone;
    }
  }

  // 转换时间到指定时区
  convertToTimezone(date: Date | number, timezone: string): Date {
    const d = typeof date === 'number' ? new Date(date) : date;
    // 使用 Intl API 进行时区转换
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const parts = formatter.formatToParts(d);
    const values: Record<string, string> = {};
    for (const part of parts) {
      values[part.type] = part.value;
    }

    return new Date(
      `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`
    );
  }

  // 格式化时间（带时区信息）
  formatWithTimezone(date: Date, locale: string, timezone: string): string {
    const formatter = new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZoneName: 'short',
    });

    return formatter.format(date);
  }

  // 获取时区列表
  getTimezoneList(): Array<{ value: string; label: string; offset: string }> {
    const timezones = [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Asia/Singapore',
      'Australia/Sydney',
      'Pacific/Auckland',
    ];

    return timezones.map(tz => {
      const offset = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'shortOffset',
      }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || '';

      return {
        value: tz,
        label: tz.replace(/_/g, ' ').replace(/\//g, ' / '),
        offset,
      };
    });
  }
}

export const timezoneService = new TimezoneService({
  defaultTimezone: 'UTC',
});
```

## 6. RTL（从右到左）支持

### 6.1 RTL 布局处理

```typescript
// frontend/src/i18n/rtl.tsx

// RTL 检测和布局切换
function getDirection(locale: string): 'ltr' | 'rtl' {
  const rtlLocales = ['ar', 'he', 'fa', 'ur'];
  const lang = locale.split('-')[0];
  return rtlLocales.includes(lang) ? 'rtl' : 'ltr';
}

// RTL 样式提供器
export function RTLProvider({ children, locale }: { children: React.ReactNode; locale: string }) {
  const direction = getDirection(locale);

  return (
    <div dir={direction} lang={locale}>
      {children}
    </div>
  );
}

// RTL 转换 hook
function useRTLSwitch() {
  const { i18n } = useTranslation();
  const direction = getDirection(i18n.language);

  // RTL 特定的样式调整
  const rtlStyles: CSSProperties = direction === 'rtl' ? {
    // 水平 margin/padding 翻转
    marginLeft: undefined,
    marginRight: undefined,
    // 文本对齐
    textAlign: 'right',
  } : {};

  return {
    direction,
    isRTL: direction === 'rtl',
    styles: rtlStyles,
  };
}

// RTL 安全的 spacing
function rtlSpacing(value: string | number, isRTL: boolean): string {
  if (typeof value === 'number') {
    value = `${value}px`;
  }

  if (isRTL) {
    // 交换左右值
    const parts = value.split(/\s+/);
    if (parts.length === 1) return value;
    if (parts.length === 2) {
      return `${parts[1]} ${parts[0]}`;
    }
    if (parts.length === 4) {
      return `${parts[0]} ${parts[3]} ${parts[2]} ${parts[1]}`;
    }
  }

  return value;
}

// RTL 安全的图标
function getRTLIcon(name: string, isRTL: boolean): string {
  const rtlIcons: Record<string, string> = {
    'arrow-left': 'arrow-right',
    'arrow-right': 'arrow-left',
    'chevron-left': 'chevron-right',
    'chevron-right': 'chevron-left',
  };

  return isRTL ? (rtlIcons[name] || name) : name;
}
```

## 7. 本地化最佳实践

### 7.1 翻译键命名规范

```typescript
// 翻译键命名约定
const TranslationKeyConvention = {
  // 使用小写和点号分隔
  // {页面}.{组件}.{元素}.{状态}

  // 示例
  'common.buttons.save': 'Save',
  'common.buttons.cancel': 'Cancel',

  'dashboard.welcome.message': 'Welcome, {{name}}',

  'project.detail.header.title': 'Project Details',

  'errors.validation.required': '{{field}} is required',

  // 复数形式使用 _plural 后缀
  'common.time.minutesAgo': '{{count}} minute ago',
  'common.time.minutesAgo_plural': '{{count}} minutes ago',
};
```

### 7.2 本地化检查清单

```typescript
// 本地化发布检查清单
const LocalizationChecklist = {
  beforeRelease: [
    // 文本内容
    'allUserFacingTextTranslated: 所有用户可见文本已翻译',
    'noHardcodedStrings: 无硬编码字符串',
    'pluralsCorrectlyHandled: 复数形式正确处理',
    'placeholdersCorrectlyOrdered: 占位符顺序正确',

    // 格式化
    'datesFormattedPerLocale: 日期按地区格式化',
    'numbersFormattedPerLocale: 数字按地区格式化',
    'currenciesCorrectlyDisplayed: 货币正确显示',

    // 布局
    'rtlLayoutTested: RTL 布局已测试',
    'textExpansionConsidered: 文本扩展已考虑',
    'noTextOverflow: 无文本溢出',

    // 功能
    'languageSwitcherWorks: 语言切换器正常工作',
    'userPreferencePersisted: 用户偏好已保存',
    'fallbackLanguageWorks: 回退语言正常工作',

    // 性能
    'lazyLoadedTranslations: 翻译延迟加载',
    'noExcessiveBundleSize: 无过多包大小增加',
  ],
};
```

---

**最后更新**: 2026-04-14
**版本**: v1.0
