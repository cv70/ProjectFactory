# 移动端适配设计

## 1. 概述

本文档描述 ProjectFactory 系统的移动端适配设计方案，包括 PWA（Progressive Web App）、响应式设计、移动端交互优化等内容。

### 1.1 设计目标

| 目标 | 描述 |
|------|------|
| 跨设备一致性 | 移动端、平板、桌面端体验一致 |
| 离线可用性 | PWA 支持离线访问核心功能 |
| 触屏优化 | 针对触屏交互优化 |
| 性能优先 | 移动端性能敏感，优化首屏加载 |

### 1.2 技术选型

```
┌─────────────────────────────────────────────────────────────┐
│                        移动端技术栈                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PWA (Service Worker + Web App Manifest)                   │
│           ↓                    ↓                            │
│  React 18 + TypeScript    响应式 CSS (Tailwind/Media)       │
│           ↓                    ↓                            │
│  状态管理 (Zustand)       触屏手势 (Hammer.js)               │
│           ↓                    ↓                            │
│  离线存储 (IndexedDB)     推送通知 (Push API)               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. PWA 配置

### 2.1 Web App Manifest

```typescript
// src/pwa/manifest.ts
interface WebAppManifest {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui';
  orientation: 'portrait' | 'landscape' | 'any';
  background_color: string;
  theme_color: string;
  icons: Array<{
    src: string;
    sizes: string;
    type: 'image/png' | 'image/svg+xml';
    purpose: 'any' | 'maskable';
  }>;
  categories: string[];
  shortcuts: Array<{
    name: string;
    short_name: string;
    description: string;
    url: string;
    icons: Array<{ src: string; sizes: string }>;
  }>;
}

const manifest: WebAppManifest = {
  name: 'ProjectFactory',
  short_name: 'PF',
  description: '无限自动化项目生成系统',
  start_url: '/dashboard',
  display: 'standalone',
  orientation: 'any',
  background_color: '#0f172a',
  theme_color: '#6366f1',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  categories: ['developer tools', 'productivity'],
  shortcuts: [
    { name: '新建项目', short_name: '新建', description: '创建新项目', url: '/projects/new', icons: [{ src: '/icons/shortcut-new.png', sizes: '96x96' }] },
    { name: '查看Ideas', short_name: 'Ideas', description: '查看项目想法', url: '/ideas', icons: [{ src: '/icons/shortcut-ideas.png', sizes: '96x96' }] },
  ],
};
```

### 2.2 Service Worker

```typescript
// src/pwa/sw.ts
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'pf-v1';
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/projects',
  '/ideas',
  '/offline.html',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests - network only
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => new Response('{"error":"offline"}', {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // Static assets - cache first
  if (request.destination === 'style' || request.destination === 'script' || request.destination === 'image') {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
      )
    );
    return;
  }

  // HTML pages - network first with offline fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/offline.html')))
  );
});

// Push notification
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge.png',
      tag: data.tag,
      data: data.url,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data));
});
```

---

## 3. 响应式布局

### 3.1 断点系统

```typescript
// src/styles/breakpoints.ts
enum Breakpoint {
  SM = 640,   // 手机横屏
  MD = 768,   // 平板竖屏
  LG = 1024,  // 平板横屏 / 小笔记本
  XL = 1280,  // 笔记本
  XXL = 1536, // 桌面显示器
}

type DeviceType = 'mobile' | 'tablet' | 'desktop';

function getDeviceType(width: number): DeviceType {
  if (width < Breakpoint.MD) return 'mobile';
  if (width < Breakpoint.LG) return 'tablet';
  return 'desktop';
}

interface ResponsiveState {
  width: number;
  height: number;
  device: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
  isDarkMode: boolean;
  prefersReducedMotion: boolean;
}
```

### 3.2 布局组件

```tsx
// src/components/layout/ResponsiveLayout.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';

interface ResponsiveContextValue extends ResponsiveState {
  isUnder: (bp: Breakpoint) => boolean;
  isOver: (bp: Breakpoint) => boolean;
}

const ResponsiveContext = createContext<ResponsiveContextValue | null>(null);

export function ResponsiveProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ResponsiveState>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
    device: 'desktop',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isPortrait: true,
    isLandscape: false,
    isDarkMode: false,
    prefersReducedMotion: false,
  });

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const device = getDeviceType(width);
      setState({
        width,
        height,
        device,
        isMobile: device === 'mobile',
        isTablet: device === 'tablet',
        isDesktop: device === 'desktop',
        isPortrait: height > width,
        isLandscape: width > height,
        isDarkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
        prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const isUnder = (bp: Breakpoint) => state.width < bp;
  const isOver = (bp: Breakpoint) => state.width >= bp;

  return (
    <ResponsiveContext.Provider value={{ ...state, isUnder, isOver }}>
      {children}
    </ResponsiveContext.Provider>
  );
}

export const useResponsive = () => {
  const ctx = useContext(ResponsiveContext);
  if (!ctx) throw new Error('useResponsive must be used within ResponsiveProvider');
  return ctx;
};
```

### 3.3 响应式组件示例

```tsx
// src/components/layout/ResponsiveLayout.tsx
import React from 'react';
import { useResponsive } from './ResponsiveContext';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isMobile, isTablet, isLandscape } = useResponsive();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* 移动端底部导航 */}
      {isMobile && <MobileBottomNav />}

      {/* 平板侧边导航 */}
      {isTablet && !isLandscape && <TabletSideNav />}

      {/* 桌面端顶部导航 */}
      {!isMobile && <DesktopTopNav />}

      <main className={isMobile ? 'pb-20' : ''}>
        {children}
      </main>
    </div>
  );
}

// 移动端底部导航
function MobileBottomNav() {
  const [active, setActive] = useState('/dashboard');
  const { isUnder } = useResponsive();

  const navItems = [
    { path: '/dashboard', icon: HomeIcon, label: '首页' },
    { path: '/projects', icon: FolderIcon, label: '项目' },
    { path: '/ideas', icon: LightbulbIcon, label: '想法' },
    { path: '/settings', icon: CogIcon, label: '设置' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-slate-800 border-t border-slate-700 flex items-center justify-around safe-area-pb z-50">
      {navItems.map((item) => (
        <button
          key={item.path}
          onClick={() => setActive(item.path)}
          className={`flex flex-col items-center gap-0.5 p-2 ${
            active === item.path ? 'text-indigo-400' : 'text-slate-400'
          }`}
        >
          <item.icon className="w-6 h-6" />
          <span className="text-xs">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
```

---

## 4. 触屏手势

### 4.1 手势配置

```typescript
// src/utils/touch gestures.ts
import Hammer from 'hammerjs';

interface GestureConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onPinch?: (scale: number) => void;
  onRotate?: (angle: number) => void;
  onTap?: (e: HammerInput) => void;
  onLongPress?: (e: HammerInput) => void;
}

function setupGestures(element: HTMLElement, config: GestureConfig) {
  const hammer = new Hammer(element);

  // 识别所有手势
  hammer.get('swipe').set({ direction: Hammer.DIRECTION_ALL });
  hammer.get('pinch').set({ enable: true });
  hammer.get('rotate').set({ enable: true });

  // 滑动
  if (config.onSwipeLeft) hammer.on('swipeleft', config.onSwipeLeft);
  if (config.onSwipeRight) hammer.on('swiperight', config.onSwipeRight);
  if (config.onSwipeUp) hammer.on('swipeup', config.onSwipeUp);
  if (config.onSwipeDown) hammer.on('swipedown', config.onSwipeDown);

  // 双指缩放
  if (config.onPinch) {
    hammer.on('pinch', (e) => config.onPinch!(e.scale));
  }

  // 双指旋转
  if (config.onRotate) {
    hammer.on('rotate', (e) => config.onRotate!(e.rotation));
  }

  // 点击
  if (config.onTap) hammer.on('tap', config.onTap);

  // 长按
  if (config.onLongPress) hammer.on('press', config.onLongPress);

  return () => hammer.destroy();
}

// 项目卡片滑动操作
function useProjectCardGestures(projectId: string) {
  const router = useRouter();

  useEffect(() => {
    const el = document.getElementById(`project-${projectId}`);
    if (!el) return;

    return setupGestures(el, {
      onSwipeLeft: () => router.push(`/projects/${projectId}/archive`),
      onSwipeRight: () => router.push(`/projects/${projectId}/details`),
      onLongPress: () => showProjectMenu(projectId),
    });
  }, [projectId]);
}
```

### 4.2 虚拟列表（长列表优化）

```tsx
// src/components/virtual/VirtualList.tsx
import React, { useRef, useState, useCallback } from 'react';

interface VirtualListProps<T> {
  items: T[];
  height: number;
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
}

export function VirtualList<T>({ items, height, itemHeight, renderItem, overscan = 3 }: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length - 1, Math.ceil((scrollTop + height) / itemHeight) + overscan);

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startIndex * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div ref={containerRef} style={{ height, overflow: 'auto' }} onScroll={handleScroll}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, i) => (
            <div key={startIndex + i} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## 5. 离线数据同步

### 5.1 IndexedDB 存储

```typescript
// src/offline/db.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface ProjectFactoryDB extends DBSchema {
  ideas: {
    key: string;
    value: Idea;
    indexes: { 'by-status': string; 'by-created': number };
  };
  projects: {
    key: string;
    value: Project;
    indexes: { 'by-status': string; 'by-updated': number };
  };
  syncQueue: {
    key: string;
    value: SyncOperation;
    indexes: { 'by-timestamp': number };
  };
  cache: {
    key: string;
    value: { data: unknown; expiry: number };
  };
}

let dbPromise: Promise<IDBPDatabase<ProjectFactoryDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ProjectFactoryDB>('project-factory', 1, {
      upgrade(db) {
        // Ideas store
        const ideaStore = db.createObjectStore('ideas', { keyPath: 'id' });
        ideaStore.createIndex('by-status', 'status');
        ideaStore.createIndex('by-created', 'createdAt');

        // Projects store
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectStore.createIndex('by-status', 'status');
        projectStore.createIndex('by-updated', 'updatedAt');

        // Sync queue
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        syncStore.createIndex('by-timestamp', 'timestamp');

        // Cache store
        db.createObjectStore('cache', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}

// CRUD Operations
export const ideaDB = {
  async getAll() {
    const db = await getDB();
    return db.getAll('ideas');
  },

  async get(id: string) {
    const db = await getDB();
    return db.get('ideas', id);
  },

  async put(idea: Idea) {
    const db = await getDB();
    await db.put('ideas', idea);
    // Queue sync operation
    await addToSyncQueue('idea', 'put', idea);
  },

  async delete(id: string) {
    const db = await getDB();
    await db.delete('ideas', id);
    await addToSyncQueue('idea', 'delete', { id });
  },
};

export const projectDB = {
  async getAll() {
    const db = await getDB();
    return db.getAll('projects');
  },

  async get(id: string) {
    const db = await getDB();
    return db.get('projects', id);
  },

  async put(project: Project) {
    const db = await getDB();
    await db.put('projects', project);
    await addToSyncQueue('project', 'put', project);
  },
};
```

### 5.2 同步队列

```typescript
// src/offline/sync.ts
interface SyncOperation {
  id?: number;
  entity: 'idea' | 'project' | 'iteration';
  action: 'put' | 'delete';
  data: unknown;
  timestamp: number;
  retries: number;
}

export async function addToSyncQueue(entity: string, action: string, data: unknown) {
  const db = await getDB();
  await db.add('syncQueue', {
    entity,
    action,
    data,
    timestamp: Date.now(),
    retries: 0,
  });
}

export async function processSyncQueue() {
  if (!navigator.onLine) return;

  const db = await getDB();
  const operations = await db.getAllFromIndex('syncQueue', 'by-timestamp');

  for (const op of operations) {
    try {
      await syncOperation(op);
      await db.delete('syncQueue', op.id!);
    } catch (error) {
      if (op.retries >= 3) {
        // Move to dead letter queue
        await db.delete('syncQueue', op.id!);
        await db.add('syncQueue', { ...op, retries: op.retries + 1 });
      } else {
        await db.put('syncQueue', { ...op, retries: op.retries + 1 });
      }
    }
  }
}

// Listen for online event
window.addEventListener('online', () => {
  processSyncQueue();
});

// Periodic sync
setInterval(processSyncQueue, 30000); // Every 30 seconds
```

---

## 6. 推送通知

### 6.1 通知服务

```typescript
// src/notifications/service.ts
interface NotificationPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
  icon?: string;
  actions?: Array<{ action: string; title: string }>;
}

export const notificationService = {
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported');
    }
    return Notification.requestPermission();
  },

  async subscribe(userId: string): Promise<PushSubscription> {
    const permission = await this.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission denied');
    }

    const registration = await navigator.serviceWorker.ready;

    // Generate VAPID key pair (store in backend)
    const vapidPublicKey = await fetch('/api/notifications/vapid-key').then(r => r.json());

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    // Send subscription to backend
    await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, subscription }),
    });

    return subscription;
  },

  async show(payload: NotificationPayload) {
    if (Notification.permission === 'granted') {
      new Notification(payload.title, {
        body: payload.body,
        tag: payload.tag,
        icon: payload.icon || '/icons/icon-192.png',
        badge: '/icons/badge.png',
        data: { url: payload.url },
        actions: payload.actions,
      });
    }
  },
};

// Notification types
const NOTIFICATION_TYPES = {
  PROJECT_COMPLETED: 'project:completed',
  PROJECT_FAILED: 'project:failed',
  QUALITY_ALERT: 'quality:alert',
  ITERATION_COMPLETED: 'iteration:completed',
} as const;

// Handler for different notification types
self.addEventListener('push', async (event) => {
  const data = event.data?.json();
  if (!data) return;

  switch (data.type) {
    case NOTIFICATION_TYPES.PROJECT_COMPLETED:
      await showProjectCompletedNotification(data);
      break;
    case NOTIFICATION_TYPES.QUALITY_ALERT:
      await showQualityAlertNotification(data);
      break;
  }
});

async function showProjectCompletedNotification(data: NotificationData) {
  const { projectName, qualityScore, duration } = data;
  await self.registration.showNotification('🎉 项目生成完成', {
    body: `${projectName} 已完成，品质评分 ${qualityScore}，耗时 ${duration}`,
    tag: NOTIFICATION_TYPES.PROJECT_COMPLETED,
    url: `/projects/${data.projectId}`,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge.png',
    actions: [
      { action: 'view', title: '查看' },
      { action: 'dismiss', title: '忽略' },
    ],
  });
}
```

---

## 7. 性能优化

### 7.1 代码分割

```typescript
// src/routes/lazy.tsx
import { lazy, Suspense } from 'react';

// 路由级别代码分割
export const LazyDashboard = lazy(() => import('./pages/Dashboard'));
export const LazyProjects = lazy(() => import('./pages/Projects'));
export const LazyIdeas = lazy(() => import('./pages/Ideas'));
export const LazySettings = lazy(() => import('./pages/Settings'));
export const LazyProjectDetail = lazy(() => import('./pages/ProjectDetail'));

// 组件级别代码分割
export const LazyCodeEditor = lazy(() => import('./components/CodeEditor'));
export const LazyMetricsChart = lazy(() => import('./components/MetricsChart'));

// Loading fallback
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
    </div>
  );
}

// 使用示例
<Suspense fallback={<LoadingSpinner />}>
  <LazyDashboard />
</Suspense>
```

### 7.2 资源优化

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#0f172a" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

  <!-- 预连接 -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

  <!-- 预加载关键资源 -->
  <link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin />

  <!-- 异步加载 CSS -->
  <link rel="stylesheet" href="/styles/main.css" media="print" onload="this.media='all'" />

  <!-- DNS 预解析 -->
  <link rel="dns-prefetch" href="//api.projectfactory.io" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

### 7.3 图片优化

```tsx
// src/components/ui/ResponsiveImage.tsx
interface ResponsiveImageProps {
  src: string;
  alt: string;
  sizes?: string;
  className?: string;
  placeholder?: 'blur' | 'empty';
}

export function ResponsiveImage({ src, alt, sizes = '100vw', className, placeholder = 'blur' }: ResponsiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // 生成响应式 srcset
  const generateSrcset = (src: string) => {
    const widths = [320, 640, 960, 1280, 1920];
    return widths
      .map((w) => {
        const url = src.replace(/^(.+)(\.\w+)$/, `$1-${w}$2`);
        return `${url} ${w}w`;
      })
      .join(', ');
  };

  if (error) {
    return (
      <div className={`bg-slate-700 flex items-center justify-center ${className}`}>
        <ImageOffIcon className="w-8 h-8 text-slate-500" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {placeholder === 'blur' && !loaded && (
        <div className="absolute inset-0 bg-slate-700 animate-pulse" />
      )}
      <img
        src={src}
        srcSet={generateSrcset(src)}
        sizes={sizes}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}
```

---

## 8. 安全考虑

### 8.1 移动端安全

```typescript
// src/security/mobile.ts
export const mobileSecurity = {
  // 防止 XSS
  sanitizeUserInput(input: string): string {
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  },

  // 安全的 localStorage（加密存储敏感数据）
  secureStorage: {
    set(key: string, value: unknown) {
      const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify(value),
        getEncryptionKey()
      ).toString();
      localStorage.setItem(key, encrypted);
    },

    get<T>(key: string): T | null {
      const encrypted = localStorage.getItem(key);
      if (!encrypted) return null;
      try {
        const decrypted = CryptoJS.AES.decrypt(encrypted, getEncryptionKey());
        return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
      } catch {
        return null;
      }
    },
  },

  // 防止中间人攻击（证书绑定）
  async verifyCertificate(): Promise<boolean> {
    if (!navigator.serviceWorker) return true;
    // 在实际实现中验证证书
    return true;
  },

  // 会话超时
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
};
```

---

## 9. 监控埋点

### 9.1 移动端性能监控

```typescript
// src/analytics/mobile.ts
interface MobileMetrics {
  // 网络
  effectiveType: '2g' | '3g' | '4g' | 'slow-2g';
  downlink: number;
  rtt: number;

  // 性能
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
  cumulativeLayoutShift: number;

  // 行为
  touchLatency: number;
  scrollFPS: number;
}

export function trackMobileMetrics() {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

  if (connection) {
    trackEvent('network', {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
    });
  }

  // Web Vitals
  import('web-vitals').then(({ getCLS, getFID, getLCP, getFCP, getTTFB }) => {
    getCLS((metric) => sendToAnalytics('cls', metric.value));
    getFID((metric) => sendToAnalytics('fid', metric.value));
    getLCP((metric) => sendToAnalytics('lcp', metric.value));
    getFCP((metric) => sendToAnalytics('fcp', metric.value));
    getTTFB((metric) => sendToAnalytics('ttfb', metric.value));
  });

  // 触屏手势追踪
  document.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    trackEvent('touch', {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now(),
    });
  }, { passive: true });
}
```

---

## 10. 测试策略

### 10.1 移动端测试

```typescript
// tests/mobile/*.test.ts

// 响应式测试
describe('Responsive Layout', () => {
  const viewports = [
    { width: 375, height: 812, name: 'iPhone X' },
    { width: 768, height: 1024, name: 'iPad' },
    { width: 1024, height: 1366, name: 'iPad Pro' },
  ];

  viewports.forEach(({ width, height, name }) => {
    it(`renders correctly on ${name}`, () => {
      global.innerWidth = width;
      global.innerHeight = height;
      global.dispatchEvent(new Event('resize'));

      render(<Dashboard />);
      expect(screen.getByTestId('responsive-layout')).toBeVisible();
    });
  });
});

// 触屏手势测试
describe('Touch Gestures', () => {
  it('swipe left archives project', () => {
    const { getByTestId } = render(<ProjectCard project={mockProject} />);

    const hammer = new Hammer(getByTestId('project-card'));
    hammer.emit('swipeleft', { direction: Hammer.DIRECTION_LEFT });

    expect(mockRouter.push).toHaveBeenCalledWith(`/projects/${mockProject.id}/archive`);
  });
});

// PWA 测试
describe('PWA', () => {
  it('registers service worker', async () => {
    await render(<App />);
    expect(navigator.serviceWorker.controller).toBeTruthy();
  });

  it('shows offline page when network unavailable', async () => {
    // Mock offline
    navigator.onLine = false;

    render(<App />);
    expect(screen.getByTestId('offline-banner')).toBeVisible();
  });
});
```

---

## 11. 相关文档

- [前端设计](./FRONTEND_DESIGN.md)
- [API 规格说明](./API_SPECIFICATION.md)
- [安全设计](./SECURITY_DESIGN.md)

---

**最后更新**: 2026-04-14
