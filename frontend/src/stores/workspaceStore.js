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
          
          // Auto-select valid workspace or fallback to first
          const current = get().activeWorkspace
          const stillValid = workspaces.find(w => w.id === current?.id)
          
          if ((!stillValid || !current) && workspaces.length > 0) {
            set({ activeWorkspace: workspaces[0] })
          } else if (workspaces.length === 0) {
            try {
              const newWs = await workspacesApi.create({
                name: 'Personal Workspace',
                slug: `personal-ws-${Date.now()}`
              })
              set({ workspaces: [newWs], activeWorkspace: newWs })
            } catch (createErr) {
              console.error('Error auto-creating default workspace:', createErr)
            }
          }
        } catch (err) {
          set({ error: 'Failed to load workspaces', isLoading: false })
          // If no activeWorkspace is selected, ensure a fallback exists
          const current = get().activeWorkspace
          if (!current) {
            const fallback = { id: 'default-ws', name: 'Personal Workspace' }
            set({ workspaces: [fallback], activeWorkspace: fallback })
          }
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
