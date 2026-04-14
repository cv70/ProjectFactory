# 前端组件库与UI架构

## 概述

前端组件库与UI架构定义了ProjectFactory系统的用户界面设计系统、组件库架构和交互模式。系统采用React + TypeScript构建，提供企业级的UI组件、设计令牌和交互规范，确保一致的用户体验和高效的界面开发。

## 核心价值

- **一致性**：统一的设计语言和交互模式
- **可复用性**：高度抽象的组件化设计
- **可访问性**：符合WCAG 2.1标准的无障碍支持
- **主题定制**：支持多主题和品牌定制
- **性能优化**：虚拟化、懒加载等性能最佳实践

## 设计系统

### 设计令牌

```typescript
// 设计令牌定义
const designTokens = {
  // 颜色系统
  colors: {
    // 主色
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',  // 主色
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },

    // 语义色
    semantic: {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    },

    // 中性色
    neutral: {
      0: '#ffffff',
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },

    // 背景色
    background: {
      primary: '#ffffff',
      secondary: '#f9fafb',
      tertiary: '#f3f4f6',
    },

    // 文字色
    text: {
      primary: '#111827',
      secondary: '#4b5563',
      tertiary: '#9ca3af',
      inverse: '#ffffff',
    },
  },

  // 字体系统
  typography: {
    fontFamily: {
      display: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      body: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      mono: '"JetBrains Mono", "Fira Code", monospace',
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  // 间距系统
  spacing: {
    0: '0',
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    8: '2rem',      // 32px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
    16: '4rem',     // 64px
  },

  // 圆角
  borderRadius: {
    none: '0',
    sm: '0.125rem',  // 2px
    base: '0.375rem', // 6px
    md: '0.5rem',    // 8px
    lg: '0.75rem',   // 12px
    xl: '1rem',      // 16px
    full: '9999px',
  },

  // 阴影
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },

  // 过渡动画
  transitions: {
    fast: '150ms ease-in-out',
    base: '200ms ease-in-out',
    slow: '300ms ease-in-out',
  },

  // Z-index层级
  zIndex: {
    dropdown: 1000,
    sticky: 1100,
    modal: 1200,
    popover: 1300,
    tooltip: 1400,
    toast: 1500,
  },
};
```

### 主题配置

```typescript
// 主题定义
interface Theme {
  name: string;
  tokens: Partial<typeof designTokens>;
  components?: ComponentThemes;
}

const themes: Record<string, Theme> = {
  light: {
    name: 'Light',
    tokens: {},
  },

  dark: {
    name: 'Dark',
    tokens: {
      colors: {
        background: {
          primary: '#111827',
          secondary: '#1f2937',
          tertiary: '#374151',
        },
        text: {
          primary: '#f9fafb',
          secondary: '#d1d5db',
          tertiary: '#9ca3af',
          inverse: '#111827',
        },
      },
    },
  },

  // 品牌定制主题
  brand: {
    name: 'Brand Theme',
    tokens: {
      colors: {
        primary: {
          500: '#6366f1',  // 自定义主色
          600: '#4f46e5',
        },
      },
    },
  },
};

// 主题上下文
interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: string) => void;
  themes: string[];
}
```

## 组件架构

### 组件分类

```typescript
// 组件分类
enum ComponentCategory {
  // 基础组件
  BASIC = 'basic',
  // 表单组件
  FORM = 'form',
  // 数据展示
  DATA_DISPLAY = 'data-display',
  // 反馈
  FEEDBACK = 'feedback',
  // 导航
  NAVIGATION = 'navigation',
  // 布局
  LAYOUT = 'layout',
}

// 组件元数据
interface ComponentMeta {
  name: string;
  category: ComponentCategory;
  description: string;
  props: PropDefinition[];
  slots?: SlotDefinition[];
  events?: EventDefinition[];
  examples?: string[];
}

// 基础组件列表
const basicComponents: ComponentMeta[] = [
  {
    name: 'Button',
    category: ComponentCategory.BASIC,
    description: '按钮组件，支持多种变体和尺寸',
    props: [
      { name: 'variant', type: 'primary | secondary | ghost | danger', default: 'primary' },
      { name: 'size', type: 'sm | md | lg', default: 'md' },
      { name: 'disabled', type: 'boolean', default: 'false' },
      { name: 'loading', type: 'boolean', default: 'false' },
      { name: 'leftIcon', type: 'ReactNode' },
      { name: 'rightIcon', type: 'ReactNode' },
    ],
    events: [
      { name: 'onClick', payload: 'MouseEvent' },
    ],
  },

  {
    name: 'Input',
    category: ComponentCategory.FORM,
    description: '输入框组件',
    props: [
      { name: 'type', type: 'text | email | password | number', default: 'text' },
      { name: 'value', type: 'string' },
      { name: 'placeholder', type: 'string' },
      { name: 'disabled', type: 'boolean' },
      { name: 'error', type: 'string' },
      { name: 'helperText', type: 'string' },
    ],
    events: [
      { name: 'onChange', payload: 'ChangeEvent' },
      { name: 'onFocus', payload: 'FocusEvent' },
      { name: 'onBlur', payload: 'FocusEvent' },
    ],
  },

  {
    name: 'Card',
    category: ComponentCategory.LAYOUT,
    description: '卡片容器',
    props: [
      { name: 'padding', type: 'none | sm | md | lg', default: 'md' },
      { name: 'shadow', type: 'none | sm | base | md | lg', default: 'base' },
      { name: 'bordered', type: 'boolean', default: 'false' },
    ],
    slots: [
      { name: 'header' },
      { name: 'footer' },
      { name: 'default' },
    ],
  },
];
```

### 组件实现示例

```typescript
// Button组件实现
import React from 'react';
import { tokens } from '../theme';
import { Spinner } from '../feedback/Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      style,
      ...props
    },
    ref
  ) => {
    const baseStyles: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: tokens.spacing[2],
      fontFamily: tokens.typography.fontFamily.body,
      fontWeight: tokens.typography.fontWeight.medium,
      borderRadius: tokens.borderRadius.md,
      border: 'none',
      cursor: disabled || loading ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: tokens.transitions.fast,
      ...style,
    };

    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        backgroundColor: tokens.colors.primary[500],
        color: tokens.colors.text.inverse,
      },
      secondary: {
        backgroundColor: tokens.colors.neutral[100],
        color: tokens.colors.text.primary,
      },
      ghost: {
        backgroundColor: 'transparent',
        color: tokens.colors.text.primary,
      },
      danger: {
        backgroundColor: tokens.colors.semantic.error,
        color: tokens.colors.text.inverse,
      },
    };

    const sizeStyles: Record<string, React.CSSProperties> = {
      sm: {
        padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
        fontSize: tokens.typography.fontSize.sm,
        height: '32px',
      },
      md: {
        padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
        fontSize: tokens.typography.fontSize.base,
        height: '40px',
      },
      lg: {
        padding: `${tokens.spacing[3]} ${tokens.spacing[6]}`,
        fontSize: tokens.typography.fontSize.lg,
        height: '48px',
      },
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        style={{
          ...baseStyles,
          ...variantStyles[variant],
          ...sizeStyles[size],
        }}
        {...props}
      >
        {loading && <Spinner size="sm" />}
        {leftIcon && !loading && leftIcon}
        {children}
        {rightIcon && !loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

## 布局组件

### 页面布局

```typescript
// 应用布局
interface AppLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  sidebar,
  header,
  footer,
}) => {
  return (
    <div style={styles.container}>
      {header && <header style={styles.header}>{header}</header>}
      <div style={styles.body}>
        {sidebar && <aside style={styles.sidebar}>{sidebar}</aside>}
        <main style={styles.main}>{children}</main>
      </div>
      {footer && <footer style={styles.footer}>{footer}</footer>}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: tokens.colors.background.secondary,
  },
  header: {
    height: '64px',
    backgroundColor: tokens.colors.background.primary,
    borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
    position: 'sticky',
    top: 0,
    zIndex: tokens.zIndex.sticky,
  },
  body: {
    display: 'flex',
    flex: 1,
  },
  sidebar: {
    width: '240px',
    backgroundColor: tokens.colors.background.primary,
    borderRight: `1px solid ${tokens.colors.neutral[200]}`,
    position: 'sticky',
    top: '64px',
    height: 'calc(100vh - 64px)',
    overflowY: 'auto',
  },
  main: {
    flex: 1,
    padding: tokens.spacing[6],
    maxWidth: '1400px',
  },
  footer: {
    padding: tokens.spacing[4],
    backgroundColor: tokens.colors.background.primary,
    borderTop: `1px solid ${tokens.colors.neutral[200]}`,
    textAlign: 'center',
  },
};
```

### 响应式断点

```typescript
// 响应式断点
const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// 响应式Hook
export const useBreakpoint = () => {
  const [breakpoint, setBreakpoint] = useState<string>('lg');

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width < 640) setBreakpoint('sm');
      else if (width < 768) setBreakpoint('md');
      else if (width < 1024) setBreakpoint('lg');
      else if (width < 1280) setBreakpoint('xl');
      else setBreakpoint('2xl');
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return {
    breakpoint,
    isSm: breakpoint === 'sm',
    isMd: breakpoint === 'md',
    isLg: breakpoint === 'lg',
    isXl: breakpoint === 'xl',
    is2xl: breakpoint === '2xl',
  };
};

// 响应式组件示例
const ResponsiveTable: React.FC = () => {
  const { isMd } = useBreakpoint();

  if (isMd) {
    // 移动端：卡片视图
    return <CardView />;
  }

  // 桌面端：表格视图
  return <TableView />;
};
```

## 业务组件

### 项目卡片

```typescript
// 项目卡片组件
interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
  onFavorite?: () => void;
  onDelete?: () => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onClick,
  onFavorite,
  onDelete,
}) => {
  return (
    <Card
      style={styles.card}
      onClick={onClick}
      hoverable
    >
      <div style={styles.header}>
        <ProjectTypeIcon type={project.type} size="lg" />
        <Menu>
          <MenuTrigger>
            <IconButton icon="more" size="sm" />
          </MenuTrigger>
          <MenuItems>
            <MenuItem onClick={onFavorite}>
              {project.isFavorite ? 'Remove from' : 'Add to'} Favorites
            </MenuItem>
            <MenuItem onClick={onDelete} variant="danger">
              Delete
            </MenuItem>
          </MenuItems>
        </Menu>
      </div>

      <div style={styles.content}>
        <h3 style={styles.title}>{project.name}</h3>
        <p style={styles.description}>{project.description}</p>
      </div>

      <div style={styles.footer}>
        <Badge variant={getStatusVariant(project.status)}>
          {project.status}
        </Badge>
        <span style={styles.date}>
          {formatDate(project.updatedAt)}
        </span>
      </div>

      {project.qualityScore && (
        <QualityIndicator score={project.qualityScore} />
      )}
    </Card>
  );
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  content: {
    marginTop: tokens.spacing[3],
  },
  title: {
    ...tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold,
    marginBottom: tokens.spacing[1],
  },
  description: {
    ...tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: tokens.spacing[4],
  },
  date: {
    ...tokens.typography.fontSize.xs,
    color: tokens.colors.text.tertiary,
  },
};
```

### 生成进度组件

```typescript
// 生成进度组件
interface GenerationProgressProps {
  status: GenerationStatus;
  stage: GenerationStage;
  progress: number;
  logs: LogEntry[];
  onCancel?: () => void;
  onViewLogs?: () => void;
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  status,
  stage,
  progress,
  logs,
  onCancel,
  onViewLogs,
}) => {
  const stages: GenerationStage[] = [
    'planning',
    'architecting',
    'coding',
    'testing',
    'reviewing',
    'completed',
  ];

  return (
    <Card padding="lg">
      <div style={styles.header}>
        <h3 style={styles.title}>Project Generation</h3>
        <Badge variant={getStatusVariant(status)}>{status}</Badge>
      </div>

      {/* 阶段进度 */}
      <StageProgress stages={stages} currentStage={stage} />

      {/* 进度条 */}
      <ProgressBar value={progress} showLabel style={styles.progress} />

      {/* 实时日志 */}
      <div style={styles.logs}>
        <div style={styles.logsHeader}>
          <span>Generation Logs</span>
          <Button variant="ghost" size="sm" onClick={onViewLogs}>
            View All
          </Button>
        </div>
        <LogStream entries={logs.slice(-10)} />
      </div>

      {/* 操作按钮 */}
      {status === 'in_progress' && (
        <div style={styles.actions}>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </Card>
  );
};

// 阶段进度指示器
interface StageProgressProps {
  stages: GenerationStage[];
  currentStage: GenerationStage;
}

const StageProgress: React.FC<StageProgressProps> = ({ stages, currentStage }) => {
  const currentIndex = stages.indexOf(currentStage);

  return (
    <div style={stageStyles.container}>
      {stages.map((stage, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={stage} style={stageStyles.step}>
            <div
              style={{
                ...stageStyles.indicator,
                ...(isCompleted && stageStyles.completed),
                ...(isCurrent && stageStyles.current),
              }}
            >
              {isCompleted ? (
                <CheckIcon size="sm" />
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
            <span
              style={{
                ...stageStyles.label,
                ...(isCurrent && stageStyles.labelCurrent),
              }}
            >
              {formatStageName(stage)}
            </span>
          </div>
        );
      })}
    </div>
  );
};
```

## 状态管理

### 全局状态

```typescript
// 全局状态类型
interface GlobalState {
  // 用户状态
  user: {
    current: User | null;
    isLoading: boolean;
    error: string | null;
  };

  // 主题状态
  theme: {
    current: string;
    direction: 'ltr' | 'rtl';
  };

  // 通知状态
  notifications: Notification[];

  // 模态框状态
  modals: {
    [key: string]: boolean;
  };

  // 侧边栏状态
  sidebar: {
    isCollapsed: boolean;
  };
}

// Context Providers
export const AppProviders: React.FC = ({ children }) => {
  return (
    <ThemeProvider defaultTheme="light">
      <AuthProvider>
        <NotificationProvider>
          <ModalProvider>
            {children}
          </ModalProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

// Auth Context
interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
}

export const AuthContext = React.createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

### 数据获取

```typescript
// API Hooks
export const useProjects = (options?: ListProjectsOptions) => {
  return useQuery({
    queryKey: ['projects', options],
    queryFn: () => api.projects.list(options),
    staleTime: 5 * 60 * 1000, // 5分钟
  });
};

export const useProject = (id: string) => {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => api.projects.get(id),
    enabled: !!id,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProjectInput) => api.projects.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useTriggerGeneration = () => {
  return useMutation({
    mutationFn: ({ projectId, options }: { projectId: string; options?: GenerationOptions }) =>
      api.projects.triggerGeneration(projectId, options),
  });
};
```

## 可访问性

### ARIA规范

```typescript
// 可访问性属性
const a11y = {
  // 按钮
  button: {
    role: 'button',
    tabIndex: 0,
  },

  // 模态框
  modal: {
    role: 'dialog',
    ariaModal: true,
    ariaLabelledby: '{titleId}',
    ariaDescribedby: '{descriptionId}',
  },

  // 下拉菜单
  menu: {
    role: 'menu',
  },
  menuItem: {
    role: 'menuitem',
  },

  // 标签页
  tabs: {
    role: 'tablist',
  },
  tab: {
    role: 'tab',
    ariaSelected: true,
    tabIndex: 0,
  },
  tabPanel: {
    role: 'tabpanel',
    ariaLabelledby: '{tabId}',
  },
};

// 焦点管理
export const useFocusTrap = (isActive: boolean) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();

    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);

  return containerRef;
};
```

## 配置示例

```yaml
# 前端配置
frontend:
  # 构建配置
  build:
    output: "dist"
    sourcemap: true
    minify: true
    target: "es2020"

  # 主题配置
  theme:
    default: "light"
    allowed: ["light", "dark"]
    brand_customization: true

  # 组件库配置
  components:
    tree_shaking: true
    icon_library: "lucide"
    date_library: "dayjs"

  # 性能配置
  performance:
    code_splitting: true
    lazy_loading: true
    prefetch: true

  # 可访问性
  a11y:
    auto_labelling: true
    focus_management: true
    skip_links: true
```

---

**最后更新**: 2026-04-14
