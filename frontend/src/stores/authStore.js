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
          const { access_token } = await authApi.login({ email, password })
          localStorage.setItem('datapilot_token', access_token)
          const user = await authApi.me()
          set({ token: access_token, user, isLoading: false })
          return { success: true }
        } catch (err) {
          const message = err.response?.data?.detail || 'Login failed'
          set({ error: message, isLoading: false })
          return { success: false, error: message }
        }
      },

      register: async (email, password, name) => {
        set({ isLoading: true, error: null })
        try {
          const { access_token } = await authApi.register({ email, password, name })
          localStorage.setItem('datapilot_token', access_token)
          const user = await authApi.me()
          set({ token: access_token, user, isLoading: false })
          return { success: true }
        } catch (err) {
          const message = err.response?.data?.detail || 'Registration failed'
          set({ error: message, isLoading: false })
          return { success: false, error: message }
        }
      },

      logout: () => {
        localStorage.removeItem('datapilot_token')
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

      isAuthenticated: () => !!get().token && !!get().user,
    }),
    {
      name: 'datapilot_auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)

export default useAuthStore
