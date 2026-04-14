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

  // Actions
  fetchIdeas: () => Promise<void>;
  fetchProjects: () => Promise<void>;
  fetchStatus: () => Promise<void>;
  queueIdea: (id: string) => Promise<void>;
  deleteIdea: (id: string) => Promise<void>;
  setSelectedIdea: (id: string | null) => void;
  setSelectedProject: (id: string | null) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
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

  queueIdea: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await api.queueIdea(id);
      await get().fetchIdeas();
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
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
}));
