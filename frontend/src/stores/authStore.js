import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '../services/api'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const { access_token, user: returnedUser } = await authApi.login({ email, password })
          localStorage.setItem('datapilot_token', access_token)
          const user = returnedUser || (await authApi.me())
          set({ token: access_token, user, isLoading: false })
          return { success: true }
        } catch (err) {
          // Auto-register demo account if cold-starting on fresh DB
          if (err.response?.status === 401 && email === 'demo@datapilot.ai') {
            try {
              const { access_token, user: returnedUser } = await authApi.register({
                email: 'demo@datapilot.ai',
                password: 'Password123!',
                name: 'Demo User',
              })
              localStorage.setItem('datapilot_token', access_token)
              const user = returnedUser || (await authApi.me())
              set({ token: access_token, user, isLoading: false })
              return { success: true }
            } catch (regErr) {
              const message = regErr.response?.data?.detail || 'Login failed'
              set({ error: message, isLoading: false })
              return { success: false, error: message }
            }
          }
          const message =
            typeof err.response?.data?.detail === 'string'
              ? err.response.data.detail
              : err.response?.data?.detail?.[0]?.msg || err.message || 'Login failed'
          set({ error: message, isLoading: false })
          return { success: false, error: message }
        }
      },

      register: async (email, password, name) => {
        set({ isLoading: true, error: null })
        try {
          const { access_token, user: returnedUser } = await authApi.register({ email, password, name })
          localStorage.setItem('datapilot_token', access_token)
          const user = returnedUser || (await authApi.me())
          set({ token: access_token, user, isLoading: false })
          return { success: true }
        } catch (err) {
          let message = 'Registration failed'
          const detail = err.response?.data?.detail
          if (typeof detail === 'string') {
            message = detail
          } else if (Array.isArray(detail)) {
            message = detail.map((d) => d.msg || d.message).join(', ')
          } else if (err.message) {
            message = err.message
          }
          set({ error: message, isLoading: false })
          return { success: false, error: message }
        }
      },

      loginWithGoogle: async (credential) => {
        set({ isLoading: true, error: null })
        try {
          const { access_token, user: returnedUser } = await authApi.googleAuth(credential)
          localStorage.setItem('datapilot_token', access_token)
          const user = returnedUser || (await authApi.me())
          set({ token: access_token, user, isLoading: false })
          return { success: true }
        } catch (err) {
          const message =
            typeof err.response?.data?.detail === 'string'
              ? err.response.data.detail
              : err.message || 'Google sign-in failed'
          set({ error: message, isLoading: false })
          return { success: false, error: message }
        }
      },

      logout: () => {
        localStorage.removeItem('datapilot_token')
        localStorage.removeItem('datapilot_auth')
        set({ user: null, token: null, error: null })
      },

      fetchMe: async () => {
        const token = localStorage.getItem('datapilot_token')
        if (!token) return
        try {
          const user = await authApi.me()
          set({ user, token })
        } catch {
          get().logout()
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'datapilot_auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)

export default useAuthStore
