const API_BASE = '/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || 'Request failed' };
    }

    return { data: data as T };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

// Types
export interface Idea {
  id: string;
  title: string;
  description: string;
  projectType: 'web-app' | 'cli-tool' | 'library' | 'api-service';
  features: string[];
  techStack: string[];
  targetAudience: string;
  complexity: 'low' | 'medium' | 'high';
  status: 'pending' | 'queued' | 'in_progress' | 'completed' | 'failed';
  createdAt: number;
  queuePosition?: number;
  error?: string;
}

export interface Project {
  id: string;
  ideaId: string;
  name: string;
  description: string;
  type: 'web-app' | 'cli-tool' | 'library' | 'api-service';
  status: 'initializing' | 'generating' | 'testing' | 'building' | 'completed' | 'failed';
  path: string;
  gitRepo?: string;
  version: string;
  qualityScore: number;
  testCoverage: number;
  lintErrors: number;
  buildSuccess: boolean;
  createdAt: number;
  completedAt?: number;
  error?: string;
}

export interface SystemStatus {
  status: 'running' | 'stopped';
  uptime: number;
  timestamp: number;
  config: {
    llm: {
      baseUrl: string;
      model: string;
    };
    pipeline: {
      ideaGeneration: boolean;
      projectDevelopment: boolean;
      iteration: boolean;
    };
  };
  ideas: {
    pending?: number;
    queued?: number;
    in_progress?: number;
    completed?: number;
    failed?: number;
    queuedCount?: number;
  };
  projects: {
    initializing?: number;
    generating?: number;
    testing?: number;
    building?: number;
    completed?: number;
    failed?: number;
    activeCount?: number;
  };
}

// API Client
export const api = {
  // Ideas
  async getIdeas(params?: { status?: string; limit?: number; offset?: number }): Promise<{ ideas: Idea[] }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));

    const response = await fetchApi<{ ideas: Idea[] }>(`/ideas?${query.toString()}`);
    if (response.error) throw new Error(response.error);
    return response.data!;
  },

  async getIdea(id: string): Promise<{ idea: Idea }> {
    const response = await fetchApi<{ idea: Idea }>(`/ideas/${id}`);
    if (response.error) throw new Error(response.error);
    return response.data!;
  },

  async getQueuedIdeas(limit?: number): Promise<{ ideas: Idea[] }> {
    const query = limit ? `?limit=${limit}` : '';
    const response = await fetchApi<{ ideas: Idea[] }>(`/ideas/queued${query}`);
    if (response.error) throw new Error(response.error);
    return response.data!;
  },

  async createIdea(input: Partial<Idea>): Promise<{ idea: Idea }> {
    const response = await fetchApi<{ idea: Idea }>('/ideas', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (response.error) throw new Error(response.error);
    return response.data!;
  },

  async generateIdeas(topic: string, count: number = 3): Promise<{ ideas: Idea[]; count: number }> {
    const response = await fetchApi<{ ideas: Idea[]; count: number }>('/ideas/generate', {
      method: 'POST',
      body: JSON.stringify({ topic, count }),
    });
    if (response.error) throw new Error(response.error);
    return response.data!;
  },

  async developIdea(id: string): Promise<{ success: boolean; projectId?: string; error?: string }> {
    const response = await fetchApi<{ success: boolean; projectId?: string; error?: string }>(
      `/ideas/${id}/develop`,
      { method: 'POST' }
    );
    if (response.error) throw new Error(response.error);
    return response.data!;
  },

  async queueIdea(id: string): Promise<{ idea: Idea }> {
    const response = await fetchApi<{ idea: Idea }>(`/ideas/${id}/queue`, {
      method: 'POST',
    });
    if (response.error) throw new Error(response.error);
    return response.data!;
  },

  async deleteIdea(id: string): Promise<void> {
    const response = await fetchApi<void>(`/ideas/${id}`, { method: 'DELETE' });
    if (response.error) throw new Error(response.error);
  },

  // Projects
  async getProjects(params?: { status?: string; limit?: number; offset?: number }): Promise<{ projects: Project[] }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));

    const response = await fetchApi<{ projects: Project[] }>(`/projects?${query.toString()}`);
    if (response.error) throw new Error(response.error);
    return response.data!;
  },

  async getProject(id: string): Promise<{ project: Project }> {
    const response = await fetchApi<{ project: Project }>(`/projects/${id}`);
    if (response.error) throw new Error(response.error);
    return response.data!;
  },

  async getActiveProjects(): Promise<{ projects: Project[] }> {
    const response = await fetchApi<{ projects: Project[] }>('/projects/active');
    if (response.error) throw new Error(response.error);
    return response.data!;
  },

  // Status
  async getStatus(): Promise<SystemStatus> {
    const response = await fetchApi<SystemStatus>('/status');
    if (response.error) throw new Error(response.error);
    return response.data!;
  },

  async getHealth(): Promise<{ healthy: boolean; checks: Record<string, string> }> {
    const response = await fetchApi<{ healthy: boolean; checks: Record<string, string> }>('/status/health');
    if (response.error) throw new Error(response.error);
    return response.data!;
  },
};
