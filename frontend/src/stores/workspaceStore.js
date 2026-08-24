import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { workspacesApi } from '../services/api'

const useWorkspaceStore = create(
  persist(
    (set, get) => ({
      workspaces: [],
      activeWorkspace: null,
      isLoading: false,
      error: null,

      fetchWorkspaces: async () => {
        set({ isLoading: true, error: null })
        try {
          const workspaces = await workspacesApi.list()
          set({ workspaces, isLoading: false })
          // Auto-select first workspace if none selected
          if (!get().activeWorkspace && workspaces.length > 0) {
            set({ activeWorkspace: workspaces[0] })
          }
          return workspaces
        } catch (err) {
          set({ error: 'Failed to load workspaces', isLoading: false })
          return []
        }
      },

      setActiveWorkspace: (workspace) => {
        set({ activeWorkspace: workspace })
      },

      createWorkspace: async (data) => {
        const workspace = await workspacesApi.create(data)
        set((state) => ({
          workspaces: [workspace, ...state.workspaces],
          activeWorkspace: workspace,
        }))
        return workspace
      },

      clear: () => set({ workspaces: [], activeWorkspace: null }),
    }),
    {
      name: 'datapilot_workspace',
      partialize: (state) => ({ activeWorkspace: state.activeWorkspace }),
    }
  )
)

export default useWorkspaceStore
