import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { organizationsApi } from '../services/api'

const useOrganizationStore = create(
  persist(
    (set, get) => ({
      organizations: [],
      activeOrganization: null,
      isLoading: false,
      error: null,

      fetchOrganizations: async () => {
        set({ isLoading: true, error: null })
        try {
          const orgs = await organizationsApi.list()
          set({ organizations: orgs, isLoading: false })

          const current = get().activeOrganization
          const stillValid = orgs.find((o) => o.id === current?.id)

          if ((!stillValid || !current) && orgs.length > 0) {
            set({ activeOrganization: orgs[0] })
          } else if (orgs.length === 0) {
            // Auto-provision personal organization if none exist
            try {
              const newOrg = await organizationsApi.create({
                name: 'Personal Org',
                default_workspace_name: 'General',
              })
              set({ organizations: [newOrg], activeOrganization: newOrg })
            } catch (createErr) {
              console.error('Error auto-creating organization:', createErr)
            }
          }
          return orgs
        } catch (err) {
          console.error('Failed to load organizations:', err)
          set({ error: 'Failed to load organizations', isLoading: false })
          return []
        }
      },

      setActiveOrganization: (org) => {
        set({ activeOrganization: org })
      },

      createOrganization: async (data) => {
        const org = await organizationsApi.create(data)
        set((state) => ({
          organizations: [...state.organizations, org],
          activeOrganization: org,
        }))
        return org
      },

      clear: () => set({ organizations: [], activeOrganization: null }),
    }),
    {
      name: 'datapilot_organization',
      partialize: (state) => ({ activeOrganization: state.activeOrganization }),
    }
  )
)

export default useOrganizationStore
