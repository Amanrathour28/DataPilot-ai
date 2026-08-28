import { useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import useAuthStore from '../../stores/authStore'
import useWorkspaceStore from '../../stores/workspaceStore'

export default function AppLayout() {
  const { user, token } = useAuthStore()
  const { fetchWorkspaces } = useWorkspaceStore()

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  useEffect(() => {
    fetchWorkspaces()
  }, [])

  return (
    <div className="flex h-screen overflow-hidden app-canvas">
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative z-10">
        <div className="h-full animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
