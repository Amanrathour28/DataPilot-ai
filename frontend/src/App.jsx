import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from './components/ui/Toast'

// Layout
import AppLayout from './components/layout/AppLayout'

// Auth pages
import Login    from './pages/auth/Login'
import Register from './pages/auth/Register'
import Landing  from './pages/Landing'

// App pages
import Dashboard      from './pages/dashboard/Dashboard'
import Datasets       from './pages/datasets/Datasets'
import DatasetDetail  from './pages/datasets/DatasetDetail'
import Investigations from './pages/investigations/Investigations'
import NewInvestigation from './pages/investigations/NewInvestigation'
import InvestigationDetail from './pages/investigations/InvestigationDetail'

import Knowledge from './pages/knowledge/Knowledge'
import Agents from './pages/agents/Agents'
import Analytics from './pages/analytics/Analytics'
import Memory from './pages/memory/Memory'
import SettingsPage from './pages/settings/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/"         element={<Landing />} />
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected app routes */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard"          element={<Dashboard />} />
              <Route path="/investigations"     element={<Investigations />} />
              <Route path="/investigations/new" element={<NewInvestigation />} />
              <Route path="/investigations/:id" element={<InvestigationDetail />} />
              <Route path="/datasets"           element={<Datasets />} />
              <Route path="/datasets/:id"       element={<DatasetDetail />} />
              <Route path="/knowledge"          element={<Knowledge />} />
              <Route path="/agents"             element={<Agents />} />
              <Route path="/analytics"          element={<Analytics />} />
              <Route path="/memory"             element={<Memory />} />
              <Route path="/settings"           element={<SettingsPage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
