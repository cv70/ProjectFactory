import { create } from 'zustand';
import { api, type Idea, type Project, type SystemStatus } from '../lib/api';

interface AppState {
  // Data
  ideas: Idea[];
  projects: Project[];
  status: SystemStatus | null;

  // UI State
  loading: boolean;
  error: string | null;
  selectedIdeaId: string | null;
  selectedProjectId: string | null;

  // Language & Theme
  language: 'zh' | 'en';
  theme: 'light' | 'dark';

  // Tab Navigation
  activeTab: 'home' | 'ideas' | 'projects';

  // Actions
  fetchIdeas: () => Promise<void>;
  fetchProjects: () => Promise<void>;
  fetchStatus: () => Promise<void>;
  createIdea: (input: Partial<Idea>) => Promise<void>;
  generateIdeas: (topic: string, count?: number) => Promise<void>;
  developIdea: (id: string) => Promise<{ success: boolean; projectId?: string; error?: string }>;
  deleteIdea: (id: string) => Promise<void>;
  setSelectedIdea: (id: string | null) => void;
  setSelectedProject: (id: string | null) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setLanguage: (language: 'zh' | 'en') => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setActiveTab: (tab: 'home' | 'ideas' | 'projects') => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  ideas: [],
  projects: [],
  status: null,
  loading: false,
  error: null,
  selectedIdeaId: null,
  selectedProjectId: null,
  language: 'zh',
  theme: 'dark',
  activeTab: 'home',

  // Actions
  fetchIdeas: async () => {
    set({ loading: true, error: null });
    try {
      const { ideas } = await api.getIdeas();
      set({ ideas, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const { projects } = await api.getProjects();
      set({ projects, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  fetchStatus: async () => {
    try {
      const status = await api.getStatus();
      set({ status });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  createIdea: async (input: Partial<Idea>) => {
    set({ loading: true, error: null });
    try {
      await api.createIdea(input);
      await get().fetchIdeas();
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  generateIdeas: async (topic: string, count: number = 3) => {
    set({ loading: true, error: null });
    try {
      await api.generateIdeas(topic, count);
      await get().fetchIdeas();
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  developIdea: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const result = await api.developIdea(id);
      await get().fetchIdeas();
      await get().fetchProjects();
      set({ loading: false });
      return result;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      return { success: false, error: (error as Error).message };
    }
  },

  deleteIdea: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await api.deleteIdea(id);
      await get().fetchIdeas();
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  setSelectedIdea: (id: string | null) => {
    set({ selectedIdeaId: id });
  },

  setSelectedProject: (id: string | null) => {
    set({ selectedProjectId: id });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  },

  setLanguage: (language: 'zh' | 'en') => {
    set({ language });
    localStorage.setItem('language', language);
  },

  setTheme: (theme: 'light' | 'dark') => {
    set({ theme });
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  },

  setActiveTab: (tab: 'home' | 'ideas' | 'projects') => {
    set({ activeTab: tab });
  },
}));
