import axios from 'axios'

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.trim()
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://datapilot-backend-five.vercel.app'
  }
  return 'http://localhost:8000'
}

const BASE_URL = getBaseUrl()

const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('datapilot_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 globally — clear token and redirect to login if on a protected page
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('datapilot_token')
      const publicPaths = ['/login', '/register', '/']
      if (!publicPaths.includes(window.location.pathname)) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data) => api.post('/auth/register', data).then(r => r.data),
  login:    (data) => api.post('/auth/login', data).then(r => r.data),
  me:       ()     => api.get('/auth/me').then(r => r.data),
}

// ── Workspaces ────────────────────────────────────────────────────────────────
export const workspacesApi = {
  list:   ()               => api.get('/workspaces').then(r => r.data),
  create: (data)           => api.post('/workspaces', data).then(r => r.data),
  get:    (id)             => api.get(`/workspaces/${id}`).then(r => r.data),
  update: (id, data)       => api.patch(`/workspaces/${id}`, data).then(r => r.data),
  delete: (id)             => api.delete(`/workspaces/${id}`),
}

// ── Datasets ──────────────────────────────────────────────────────────────────
export const datasetsApi = {
  upload: (workspaceId, file, onProgress) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/datasets/upload?workspace_id=${workspaceId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total))
        }
      },
    }).then(r => r.data)
  },
  list:          (workspaceId) => api.get(`/datasets?workspace_id=${workspaceId}`).then(r => r.data),
  get:           (id)          => api.get(`/datasets/${id}`).then(r => r.data),
  profile:       (id)          => api.get(`/datasets/${id}/profile`).then(r => r.data),
  delete:        (id)          => api.delete(`/datasets/${id}`),
  reprofile:     (id)          => api.post(`/datasets/${id}/reprofile`).then(r => r.data),
  preview:       (id, limit = 50, offset = 0) => api.get(`/datasets/${id}/preview?limit=${limit}&offset=${offset}`).then(r => r.data),
  query:         (id, query)   => api.post(`/datasets/${id}/query`, { query }).then(r => r.data),
  relationships: (workspaceId) => api.get(`/datasets/relationships?workspace_id=${workspaceId}`).then(r => r.data),
  semantic:      (id)          => api.get(`/datasets/${id}/semantic`).then(r => r.data),
}

// ── Investigations ────────────────────────────────────────────────────────────
export const investigationsApi = {
  create:       (workspaceId, data) => api.post(`/investigations?workspace_id=${workspaceId}`, data).then(r => r.data),
  list:         (workspaceId)       => api.get(`/investigations?workspace_id=${workspaceId}`).then(r => r.data),
  get:          (id)                => api.get(`/investigations/${id}`).then(r => r.data),
  replay:       (id)                => api.post(`/investigations/${id}/replay`).then(r => r.data),
  pause:        (id)                => api.post(`/investigations/${id}/pause`).then(r => r.data),
  resume:       (id)                => api.post(`/investigations/${id}/resume`).then(r => r.data),
  cancel:       (id)                => api.post(`/investigations/${id}/cancel`).then(r => r.data),
  getEvidence:  (id)                => api.get(`/investigations/${id}/evidence`).then(r => r.data),
  getStreamUrl: (id)                => `${BASE_URL}/api/v1/investigations/${id}/stream`,
}

// ── Documents ─────────────────────────────────────────────────────────────────
export const documentsApi = {
  upload: (workspaceId, file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/documents/upload?workspace_id=${workspaceId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
  list:   (workspaceId)       => api.get(`/documents?workspace_id=${workspaceId}`).then(r => r.data),
  get:    (id)                => api.get(`/documents/${id}`).then(r => r.data),
  delete: (id)                => api.delete(`/documents/${id}`),
  search: (workspaceId, query, limit = 5) => api.post(`/documents/search?workspace_id=${workspaceId}`, { query, limit }).then(r => r.data),
}

// ── Memories ──────────────────────────────────────────────────────────────────
export const memoriesApi = {
  list:   (workspaceId, category) => {
    const url = category ? `/memories?workspace_id=${workspaceId}&category=${category}` : `/memories?workspace_id=${workspaceId}`
    return api.get(url).then(r => r.data)
  },
  create: (workspaceId, data)     => api.post(`/memories?workspace_id=${workspaceId}`, data).then(r => r.data),
  update: (id, data)              => api.patch(`/memories/${id}`, data).then(r => r.data),
  delete: (id)                    => api.delete(`/memories/${id}`),
}

// ── Analytics & Observability ─────────────────────────────────────────────────
export const analyticsApi = {
  summary:        (workspaceId) => api.get(`/analytics/summary?workspace_id=${workspaceId}`).then(r => r.data),
  agentsActivity: (workspaceId) => api.get(`/analytics/agents-activity?workspace_id=${workspaceId}`).then(r => r.data),
}

// ── System / Health ───────────────────────────────────────────────────────────
export const systemApi = {
  health: () => axios.get(`${BASE_URL}/health`).then(r => r.data),
}

export default api
