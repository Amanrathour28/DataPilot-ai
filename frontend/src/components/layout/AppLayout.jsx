import { useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import useAuthStore from '../../stores/authStore'
import useWorkspaceStore from '../../stores/workspaceStore'

export default function AppLayout() {
  const { user, token } = useAuthStore()
  const { fetchWorkspaces } = useWorkspaceStore()

  // Redirect to login if not authenticated
  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  // Fetch workspaces on mount
  useEffect(() => {
    fetchWorkspaces()
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f0f1a]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="h-full animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
