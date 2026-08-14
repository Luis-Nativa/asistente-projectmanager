const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

async function request(endpoint: string, options: RequestOptions = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  
  if (response.status === 401) {
    // Token expirado, intentar refresh
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Reintentar con nuevo token
      headers['Authorization'] = `Bearer ${localStorage.getItem('token')}`;
      const retryResponse = await fetch(`${API_URL}${endpoint}`, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      return retryResponse.json();
    } else {
      // Refresh falló, redirigir a PIN
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/d/' + window.location.pathname.split('/')[2] + '/pin';
      }
      throw new Error('Sesión expirada');
    }
  }
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error en la petición');
  }
  
  return response.json();
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
  
  if (!refreshToken) {
    return false;
  }
  
  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    localStorage.setItem('token', data.token);
    return true;
  } catch (error) {
    return false;
  }
}

export const api = {
  auth: {
    login: async (slug: string, pin: string) => {
      const response = await fetch(`${API_URL}/api/auth/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, pin }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'PIN inválido');
      }
      
      const data = await response.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('share', JSON.stringify(data.share));
      return data;
    },
    
    logout: () => {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('share');
    },
    
    getShare: () => {
      const share = localStorage.getItem('share');
      return share ? JSON.parse(share) : null;
    },
  },
  
  dashboard: {
    get: () => request('/api/dashboard'),
  },
  
  tasks: {
    list: (params?: { status?: string; project_id?: string }) => {
      const query = new URLSearchParams(params as any).toString();
      return request(`/api/tasks${query ? '?' + query : ''}`);
    },
    create: (data: any) => request('/api/tasks', { method: 'POST', body: data }),
    update: (id: string, data: any) => request(`/api/tasks/${id}`, { method: 'PATCH', body: data }),
    delete: (id: string) => request(`/api/tasks/${id}`, { method: 'DELETE' }),
    addSubtask: (taskId: string, data: { title: string; position?: number }) => 
      request(`/api/tasks/${taskId}/subtasks`, { method: 'POST', body: data }),
    updateSubtask: (subtaskId: string, data: any) => 
      request(`/api/subtasks/${subtaskId}`, { method: 'PATCH', body: data }),
  },
  
  projects: {
    list: () => request('/api/projects'),
    create: (data: any) => request('/api/projects', { method: 'POST', body: data }),
    update: (id: string, data: any) => request(`/api/projects/${id}`, { method: 'PATCH', body: data }),
  },
  
  expenses: {
    list: (params?: { project_id?: string; status?: string }) => {
      const query = new URLSearchParams(params as any).toString();
      return request(`/api/expenses${query ? '?' + query : ''}`);
    },
    create: (data: any) => request('/api/expenses', { method: 'POST', body: data }),
    update: (id: string, data: any) => request(`/api/expenses/${id}`, { method: 'PATCH', body: data }),
  },
  
  notes: {
    list: () => request('/api/notes'),
    create: (data: any) => request('/api/notes', { method: 'POST', body: data }),
    update: (id: string, data: any) => request(`/api/notes/${id}`, { method: 'PATCH', body: data }),
    delete: (id: string) => request(`/api/notes/${id}`, { method: 'DELETE' }),
  },
  
  ask: {
    query: (question: string) => request('/api/ask', { method: 'POST', body: { question } }),
  },
  
  shares: {
    list: () => request('/api/shares'),
    create: (data: any) => request('/api/shares', { method: 'POST', body: data }),
    update: (id: string, data: any) => request(`/api/shares/${id}`, { method: 'PATCH', body: data }),
    delete: (id: string) => request(`/api/shares/${id}`, { method: 'DELETE' }),
    regeneratePin: (id: string) => request(`/api/shares/${id}/regenerate-pin`, { method: 'POST' }),
  },
  
  activity: {
    list: (params?: { limit?: number; entity_type?: string; entity_id?: string }) => {
      const query = new URLSearchParams(params as any).toString();
      return request(`/api/activity${query ? '?' + query : ''}`);
    },
  },
  
  comments: {
    list: (taskId: string) => request(`/api/tasks/${taskId}/comments`),
    create: (taskId: string, body: string) => request(`/api/tasks/${taskId}/comments`, { method: 'POST', body: { body } }),
    delete: (commentId: string) => request(`/api/comments/${commentId}`, { method: 'DELETE' }),
  },
  
  review: {
    get: (projectId: string, since?: string) => {
      const query = since ? `?since=${since}` : '';
      return request(`/api/projects/${projectId}/review${query}`);
    },
  },
};
