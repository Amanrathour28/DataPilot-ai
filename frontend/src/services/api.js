import axios from 'axios'

const getBaseUrl = () => {
  // Support both standard env variable naming conventions
  let envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    envUrl = envUrl.trim().replace(/\/+$/, '')
    // If the configured URL includes /api/v1 or /api, strip it since api client appends /api/v1
    if (envUrl.endsWith('/api/v1')) {
      envUrl = envUrl.slice(0, -7)
    } else if (envUrl.endsWith('/api')) {
      envUrl = envUrl.slice(0, -4)
    }
    return envUrl
  }
  // In production browser environments without explicit env var, default to the current origin
  // (vercel.json routes /api/* to the serverless Python backend on the same origin)
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return window.location.origin
  }
  return 'http://localhost:8000'
}

const BASE_URL = getBaseUrl()

const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 90000, // 90s timeout for large dataset operations
})

// Attach JWT token to every request reliably
api.interceptors.request.use(
  (config) => {
    let token = localStorage.getItem('datapilot_token')
    if (!token) {
      try {
        const authStorage = localStorage.getItem('datapilot_auth')
        if (authStorage) {
          const parsed = JSON.parse(authStorage)
          token = parsed?.state?.token
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // Safe dev/diagnostic logging
    if (import.meta.env.DEV) {
      console.debug(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`)
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Handle errors and map them to human-readable explanations
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status
    const url = error.config?.url || 'unknown'
    const method = error.config?.method?.toUpperCase() || 'REQUEST'
    const rawDetail = error.response?.data?.detail

    let detailStr = ''
    if (typeof rawDetail === 'string') {
      detailStr = rawDetail
    } else if (Array.isArray(rawDetail)) {
      detailStr = rawDetail.map(d => (typeof d === 'string' ? d : d.msg || d.message || JSON.stringify(d))).join('; ')
    } else if (rawDetail && typeof rawDetail === 'object') {
      detailStr = rawDetail.message || rawDetail.error || JSON.stringify(rawDetail)
    }

    let userMessage = 'An unexpected error occurred.'

    if (!error.response) {
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        userMessage = 'The request timed out. The server may still be processing large files or operations.'
      } else {
        userMessage = `Unable to connect to the DataPilot backend (${BASE_URL}). Please verify your network connection or server status.`
      }
    } else if (status === 401) {
      localStorage.removeItem('datapilot_token')
      localStorage.removeItem('datapilot_auth')
      userMessage = detailStr || 'Your session has expired. Please sign in again.'
    } else if (status === 403) {
      userMessage = detailStr || 'Access denied: You do not have permission to perform this action.'
    } else if (status === 404) {
      userMessage = detailStr || 'The requested resource was not found.'
    } else if (status === 409) {
      userMessage = detailStr || 'A conflict occurred with an existing resource.'
    } else if (status === 413) {
      userMessage = 'The uploaded file is too large (maximum allowed size is 100 MB).'
    } else if (status === 415) {
      userMessage = detailStr || 'Unsupported file type. Please upload a valid CSV, XLSX, or JSON file.'
    } else if (status === 422) {
      userMessage = detailStr || 'Validation error: Please check the submitted fields and try again.'
    } else if (status >= 500) {
      userMessage = detailStr || 'The server encountered an internal error. Please try again or contact support.'
    } else {
      userMessage = detailStr || error.message || 'Request failed.'
    }

    // Attach structured diagnostic info
    error.userMessage = userMessage
    error.statusCode = status || 0
    error.detail = detailStr

    console.warn(`[API ${status || 'Network Error'}] ${method} ${url}:`, userMessage)

    return Promise.reject(error)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register:         (data) => api.post('/auth/register', data).then(r => r.data),
  login:            (data) => api.post('/auth/login', data).then(r => r.data),
  me:               ()     => api.get('/auth/me').then(r => r.data),
  forgotPassword:   (email) => api.post('/auth/forgot-password', { email }).then(r => r.data),
  verifyResetToken: (token) => api.get(`/auth/verify-reset-token?token=${encodeURIComponent(token)}`).then(r => r.data),
  resetPassword:    (token, newPassword) => api.post('/auth/reset-password', { token, new_password: newPassword }).then(r => r.data),
  googleAuth:       (credential) => api.post('/auth/google', { credential }).then(r => r.data),
}

// ── Workspaces ────────────────────────────────────────────────────────────────
export const workspacesApi = {
  list:   (organizationId) => {
    const url = organizationId ? `/workspaces?organization_id=${encodeURIComponent(organizationId)}` : '/workspaces'
    return api.get(url).then(r => r.data)
  },
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
    return api.post(`/datasets/upload?workspace_id=${encodeURIComponent(workspaceId)}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 2 minutes for large file uploads
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total))
        }
      },
    }).then(r => r.data)
  },
  uploadBatch: (workspaceId, files, onProgress) => {
    const form = new FormData()
    files.forEach(f => form.append('files', f))
    return api.post(`/datasets/upload-batch?workspace_id=${encodeURIComponent(workspaceId)}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000,
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total))
        }
      },
    }).then(r => r.data)
  },
  list: (workspaceId) => {
    if (!workspaceId) return Promise.resolve([])
    return api.get(`/datasets?workspace_id=${encodeURIComponent(workspaceId)}`).then(r => r.data)
  },
  get:           (id)          => api.get(`/datasets/${id}`).then(r => r.data),
  profile:       (id)          => api.get(`/datasets/${id}/profile`).then(r => r.data),
  delete:        (id)          => api.delete(`/datasets/${id}`),
  reprofile:     (id)          => api.post(`/datasets/${id}/reprofile`).then(r => r.data),
  preview:       (id, limit = 50, offset = 0) => api.get(`/datasets/${id}/preview?limit=${limit}&offset=${offset}`).then(r => r.data),
  query:         (id, query)   => api.post(`/datasets/${id}/query`, { query }).then(r => r.data),
  relationships: (workspaceId) => api.get(`/datasets/relationships?workspace_id=${encodeURIComponent(workspaceId)}`).then(r => r.data),
  semantic:      (id)          => api.get(`/datasets/${id}/semantic`).then(r => r.data),
}

// ── Investigations ────────────────────────────────────────────────────────────
export const investigationsApi = {
  create:       (workspaceId, data) => {
    const payload = typeof data === 'object' ? { workspace_id: workspaceId, ...data } : { workspace_id: workspaceId, objective: data }
    return api.post(`/investigations?workspace_id=${encodeURIComponent(workspaceId)}`, payload).then(r => r.data)
  },
  start:        (id)                => api.post(`/investigations/${id}/start`).then(r => r.data),
  list:         (params)            => {
    if (typeof params === 'string') {
      return api.get(`/investigations?workspace_id=${encodeURIComponent(params)}`).then(r => r.data)
    }
    const query = new URLSearchParams()
    if (params?.workspaceId) query.set('workspace_id', params.workspaceId)
    if (params?.organizationId) query.set('organization_id', params.organizationId)
    if (params?.filter) query.set('filter', params.filter)
    const qs = query.toString()
    return api.get(`/investigations${qs ? `?${qs}` : ''}`).then(r => r.data)
  },
  get:          (id)                => api.get(`/investigations/${id}`).then(r => r.data),
  debug:        (id)                => api.get(`/investigations/${id}/debug`).then(r => r.data),
  replay:       (id)                => api.post(`/investigations/${id}/replay`).then(r => r.data),
  pause:        (id)                => api.post(`/investigations/${id}/pause`).then(r => r.data),
  resume:       (id)                => api.post(`/investigations/${id}/resume`).then(r => r.data),
  cancel:       (id)                => api.post(`/investigations/${id}/cancel`).then(r => r.data),
  getEvidence:  (id)                => api.get(`/investigations/${id}/evidence`).then(r => r.data),
  getStreamUrl: (id, lastEventId)   => {
    let token = localStorage.getItem('datapilot_token')
    if (!token) {
      try {
        const authStorage = localStorage.getItem('datapilot_auth')
        if (authStorage) {
          const parsed = JSON.parse(authStorage)
          token = parsed?.state?.token
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
    const params = new URLSearchParams()
    if (token) params.set('token', token)
    if (lastEventId) params.set('last_event_id', lastEventId)
    const queryString = params.toString()
    return `${BASE_URL}/api/v1/investigations/${id}/stream${queryString ? `?${queryString}` : ''}`
  },
}

// ── Organizations & Team ──────────────────────────────────────────────────────
export const organizationsApi = {
  list:             ()                  => api.get('/organizations').then(r => r.data),
  create:           (data)              => api.post('/organizations', data).then(r => r.data),
  get:              (id)                => api.get(`/organizations/${id}`).then(r => r.data),
  update:           (id, data)          => api.patch(`/organizations/${id}`, data).then(r => r.data),
  members:          (id)                => api.get(`/organizations/${id}/members`).then(r => r.data),
  updateMemberRole: (orgId, uId, role)  => api.patch(`/organizations/${orgId}/members/${uId}`, { role }).then(r => r.data),
  removeMember:     (orgId, uId)        => api.delete(`/organizations/${orgId}/members/${uId}`),
  invitations:      (orgId)             => api.get(`/organizations/${orgId}/invitations`).then(r => r.data),
  createInvitation: (orgId, data)       => api.post(`/organizations/${orgId}/invitations`, data).then(r => r.data),
  revokeInvitation: (orgId, inviteId)   => api.delete(`/organizations/${orgId}/invitations/${inviteId}`),
  getInvitation:    (token)             => api.get(`/invitations/${token}`).then(r => r.data),
  acceptInvitation: (token)             => api.post(`/invitations/${token}/accept`).then(r => r.data),
  auditLogs:        (orgId, limit = 100)=> api.get(`/organizations/${orgId}/audit-logs?limit=${limit}`).then(r => r.data),
}

// ── Collaboration & Investigation Sharing ─────────────────────────────────────
export const collaborationApi = {
  getMembers:       (investigationId)   => api.get(`/investigations/${investigationId}/members`).then(r => r.data),
  addMember:        (investigationId, data) => api.post(`/investigations/${investigationId}/members`, data).then(r => r.data),
  removeMember:     (investigationId, uId)  => api.delete(`/investigations/${investigationId}/members/${uId}`),
  getComments:      (investigationId)   => api.get(`/investigations/${investigationId}/comments`).then(r => r.data),
  postComment:      (investigationId, data) => api.post(`/investigations/${investigationId}/comments`, data).then(r => r.data),
  triggerFollowUp:  (investigationId, commentId) => api.post(`/investigations/${investigationId}/comments/${commentId}/follow-up`).then(r => r.data),
  getReviews:       (investigationId)   => api.get(`/investigations/${investigationId}/reviews`).then(r => r.data),
  submitReview:     (investigationId, data) => api.post(`/investigations/${investigationId}/reviews`, data).then(r => r.data),
}

// ── In-App Notifications ──────────────────────────────────────────────────────
export const notificationsApi = {
  list:             (limit = 50)        => api.get(`/notifications?limit=${limit}`).then(r => r.data),
  markRead:         (id)                => api.patch(`/notifications/${id}/read`).then(r => r.data),
  markAllRead:      ()                  => api.post('/notifications/read-all').then(r => r.data),
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
